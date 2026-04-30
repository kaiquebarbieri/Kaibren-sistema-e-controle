import DashboardLayout from "@/components/DashboardLayout";
import LiaChat from "@/components/LiaChat";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleCheck,
  Copy,
  CreditCard,
  Flame,
  Landmark,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";

type AccountsSection = "payables" | "credit-cards" | "loans";
type DialogMode = AccountsSection | null;
type StatusFilter = "all" | "pending" | "overdue" | "due-soon" | "paid";
type SortKey = "due-asc" | "due-desc" | "amount-desc" | "amount-asc" | "title-asc";

type FormState = {
  cnpjId: string;
  title: string;
  amount: string;
  dueDate: string;
  notes: string;
  category: string;
  supplier: string;
  paymentMethod: string;
  closingDay: string;
  dueDay: string;
  brand: string;
  lastFourDigits: string;
  institution: string;
  totalInstallments: string;
  installmentAmount: string;
};

type CnpjOption = {
  id: string;
  name: string;
  cnpj: string;
};

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const PAGE_SIZES = [25, 50, 100];
const KAIBREN_GOLD = "#D4AF37";

function toCurrency(value: number | string | null | undefined): string {
  const parsed = Number(value || 0);
  return parsed.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeDate(value: string | number | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (isoDateOnly) {
      const [, y, m, d] = isoDateOnly;
      const local = new Date(Number(y), Number(m) - 1, Number(d));
      return Number.isNaN(local.getTime()) ? null : local;
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function differenceInDays(target: Date) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((end - start) / 86400000);
}

function getDueBadge(days: number | null, status?: string) {
  if (status === "paid") return { label: "Pago", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };
  if (days === null) return { label: "Sem data", className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground" };
  if (days < 0) return { label: `Atrasado ${Math.abs(days)}d`, className: "border-red-500/50 bg-red-500/15 text-red-300" };
  if (days === 0) return { label: "Vence hoje", className: "border-red-500/50 bg-red-500/15 text-red-300" };
  if (days === 1) return { label: "Amanhã", className: "border-amber-500/50 bg-amber-500/15 text-amber-300" };
  if (days <= 7) return { label: `${days} dias`, className: "border-amber-500/50 bg-amber-500/15 text-amber-300" };
  return { label: `${days} dias`, className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };
}

function getSectionFromRoute(tab?: string): AccountsSection {
  if (tab === "cartao-de-credito") return "credit-cards";
  if (tab === "emprestimos") return "loans";
  return "payables";
}

function getSectionHref(section: AccountsSection) {
  if (section === "credit-cards") return "/contas/cartao-de-credito";
  if (section === "loans") return "/contas/emprestimos";
  return "/contas/contas-a-pagar";
}

const SECTION_TABS: { key: AccountsSection; label: string; icon: any }[] = [
  { key: "payables", label: "Contas a Pagar", icon: Receipt },
  { key: "credit-cards", label: "Cartão de Crédito", icon: CreditCard },
  { key: "loans", label: "Empréstimos", icon: Landmark },
];

function getCtaLabel(section: AccountsSection) {
  if (section === "credit-cards") return "Novo cartão";
  if (section === "loans") return "Novo empréstimo";
  return "Nova conta";
}

/* ───────────────────────── HEADER ───────────────────────── */

function HeaderBar({
  activeSection,
  onNavigate,
  onCreate,
  onRefresh,
  isRefreshing,
}: {
  activeSection: AccountsSection;
  onNavigate: (section: AccountsSection) => void;
  onCreate: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Financeiro · Contas</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Obrigações financeiras</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Controle único de contas a pagar, cartões e empréstimos. Cada aba mantém sua área separada para evitar mistura de informação.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-border/60 bg-card text-foreground hover:bg-card/80"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RotateCcw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button
            onClick={onCreate}
            className="border-0 font-semibold text-black shadow-[0_8px_24px_-12px_rgba(212,175,55,0.6)] hover:opacity-90"
            style={{ backgroundColor: KAIBREN_GOLD }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {getCtaLabel(activeSection)}
          </Button>
        </div>
      </div>

      <div className="flex w-full overflow-x-auto rounded-2xl border border-border/50 bg-card/60 p-1">
        {SECTION_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onNavigate(tab.key)}
              className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37]/30"
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
              }`}
              aria-pressed={isActive}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────── STATS STRIP ──────────────────────── */

function StatTile({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper?: string;
  icon: any;
  tone?: "neutral" | "danger" | "warning" | "success" | "gold";
}) {
  const toneClasses = {
    neutral: "text-foreground",
    danger: "text-red-400",
    warning: "text-amber-300",
    success: "text-emerald-300",
    gold: "text-[#D4AF37]",
  }[tone];
  const ringClasses = {
    neutral: "bg-muted/60 text-muted-foreground",
    danger: "bg-red-500/15 text-red-300",
    warning: "bg-amber-500/15 text-amber-300",
    success: "bg-emerald-500/15 text-emerald-300",
    gold: "bg-[#D4AF37]/15 text-[#D4AF37]",
  }[tone];
  return (
    <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <p className={`text-2xl font-semibold tracking-tight ${toneClasses}`}>{value}</p>
          {helper ? <p className="text-xs leading-5 text-muted-foreground">{helper}</p> : null}
        </div>
        <div className={`rounded-xl p-2.5 ${ringClasses}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

/* ────────────────────────── FILTERS ────────────────────────── */

function FiltersBar({
  section,
  search,
  onSearchChange,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
  onClear,
  activeCount,
}: {
  section: AccountsSection;
  search: string;
  onSearchChange: (value: string) => void;
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  onClear: () => void;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const showPeriodAndStatus = section === "payables";
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }, []);

  return (
    <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={
                section === "payables"
                  ? "Buscar por título, fornecedor, categoria…"
                  : section === "credit-cards"
                  ? "Buscar por nome do cartão, banco, bandeira…"
                  : "Buscar por contrato, instituição…"
              }
              className="border-border/50 bg-card pl-9"
            />
          </div>
          {showPeriodAndStatus ? (
            <div className="flex items-center gap-2">
              <Select value={String(selectedMonth)} onValueChange={(v) => onMonthChange(Number(v))}>
                <SelectTrigger className="h-9 w-[140px] border-border/50 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(selectedYear)} onValueChange={(v) => onYearChange(Number(v))}>
                <SelectTrigger className="h-9 w-[100px] border-border/50 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <Button
            variant="outline"
            onClick={() => setOpen((v) => !v)}
            className="relative h-9 border-border/50 bg-card"
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filtros
            {activeCount > 0 ? (
              <span
                className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-black"
                style={{ backgroundColor: KAIBREN_GOLD }}
              >
                {activeCount}
              </span>
            ) : null}
          </Button>
          {activeCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={onClear} className="h-9 text-muted-foreground hover:text-foreground">
              <X className="mr-1.5 h-3.5 w-3.5" />
              Limpar
            </Button>
          ) : null}
        </div>

        {open ? (
          <div className="grid gap-3 border-t border-border/40 pt-3 sm:grid-cols-2 lg:grid-cols-4">
            {showPeriodAndStatus ? (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</Label>
                <Select value={status} onValueChange={(v) => onStatusChange(v as StatusFilter)}>
                  <SelectTrigger className="h-9 border-border/50 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="overdue">Vencidas</SelectItem>
                    <SelectItem value="due-soon">Vencem em 7 dias</SelectItem>
                    <SelectItem value="paid">Pagas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ordenar por</Label>
              <Select value={sort} onValueChange={(v) => onSortChange(v as SortKey)}>
                <SelectTrigger className="h-9 border-border/50 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due-asc">Vencimento mais próximo</SelectItem>
                  <SelectItem value="due-desc">Vencimento mais distante</SelectItem>
                  <SelectItem value="amount-desc">Maior valor</SelectItem>
                  <SelectItem value="amount-asc">Menor valor</SelectItem>
                  <SelectItem value="title-asc">Título A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ─────────────────────── PAGINATION ─────────────────────── */

function PaginationBar({
  page,
  totalPages,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-col gap-3 border-t border-border/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Mostrando <span className="font-semibold text-foreground">{from}–{to}</span> de <span className="font-semibold text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Por página</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
            <SelectTrigger className="h-8 w-[72px] border-border/50 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8 border-border/50 bg-card" disabled={page <= 1} onClick={() => onPage(1)}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 border-border/50 bg-card" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-xs text-muted-foreground">
            {page} / {totalPages || 1}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8 border-border/50 bg-card" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 border-border/50 bg-card" disabled={page >= totalPages} onClick={() => onPage(totalPages)}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── EMPTY STATE ──────────────────────── */

function EmptyState({
  title,
  description,
  cta,
  onCta,
}: {
  title: string;
  description: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 p-10 text-center">
      <div
        className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `${KAIBREN_GOLD}26` }}
      >
        <Wallet className="h-5 w-5" style={{ color: KAIBREN_GOLD }} />
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      {cta && onCta ? (
        <Button
          onClick={onCta}
          className="mt-4 border-0 font-semibold text-black hover:opacity-90"
          style={{ backgroundColor: KAIBREN_GOLD }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {cta}
        </Button>
      ) : null}
    </div>
  );
}

/* ─────────────────── URGENCY BANNER (BRENDA) ─────────────────── */

function UrgencyBanner({
  overdueCount,
  overdueValue,
  todayCount,
  todayValue,
  onClickOverdue,
  onClickToday,
}: {
  overdueCount: number;
  overdueValue: number;
  todayCount: number;
  todayValue: number;
  onClickOverdue: () => void;
  onClickToday: () => void;
}) {
  if (overdueCount === 0 && todayCount === 0) return null;
  return (
    <div className="rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-500/10 via-red-500/5 to-amber-500/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-red-500/20 p-2.5 text-red-300">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Atenção Brenda — você precisa olhar isso hoje</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {overdueCount > 0 ? (
                <>
                  <span className="font-semibold text-red-300">{overdueCount} conta(s) atrasada(s)</span>
                  {" "}totalizando <span className="font-semibold text-foreground">R$ {toCurrency(overdueValue)}</span>
                  {todayCount > 0 ? " · " : ""}
                </>
              ) : null}
              {todayCount > 0 ? (
                <>
                  <span className="font-semibold text-amber-300">{todayCount} vence(m) hoje</span>
                  {" "}— <span className="font-semibold text-foreground">R$ {toCurrency(todayValue)}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {overdueCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onClickOverdue}
              className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100"
            >
              Ver atrasadas
            </Button>
          ) : null}
          {todayCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onClickToday}
              className="border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100"
            >
              Ver vencimentos de hoje
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ──────────────── CATEGORY SUMMARY (BRENDA) ──────────────── */

function CategoryQuickFilter({
  rows,
  selected,
  onSelect,
}: {
  rows: { category: string | null; amount: number }[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}) {
  const summary = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = (r.category || "outros").toLowerCase();
      map.set(key, (map.get(key) ?? 0) + r.amount);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [rows]);
  if (summary.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Categoria:</span>
      <button
        onClick={() => onSelect(null)}
        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
          selected === null
            ? "border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#D4AF37]"
            : "border-border/50 bg-card text-muted-foreground hover:bg-card/80 hover:text-foreground"
        }`}
      >
        Todas
      </button>
      {summary.map(([cat, total]) => {
        const isActive = selected === cat;
        return (
          <button
            key={cat}
            onClick={() => onSelect(isActive ? null : cat)}
            className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
              isActive
                ? "border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#D4AF37]"
                : "border-border/50 bg-card text-muted-foreground hover:bg-card/80 hover:text-foreground"
            }`}
          >
            {cat} <span className="ml-1 text-[10px] opacity-70">R$ {toCurrency(total)}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────── PAYABLES TABLE ─────────────────────── */

type PayableRow = {
  id: number;
  title: string;
  supplier: string | null;
  category: string | null;
  amount: number;
  dueDate: Date | null;
  days: number | null;
  status: string;
  paymentMethod: string | null;
};

function PayablesTable({
  rows,
  page,
  pageSize,
  totalPages,
  totalRows,
  onPage,
  onPageSize,
  onRegisterPayment,
  onDuplicate,
  onDelete,
  onEmptyCta,
}: {
  rows: PayableRow[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalRows: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
  onRegisterPayment: (row: PayableRow) => void;
  onDuplicate: (row: PayableRow) => void;
  onDelete: (id: number) => void;
  onEmptyCta: () => void;
}) {
  if (rows.length === 0 && totalRows === 0) {
    return (
      <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
        <CardContent className="p-6">
          <EmptyState
            title="Nenhuma conta neste período"
            description="Cadastre boletos, faturas e despesas para começar a acompanhar vencimentos e atrasos."
            cta="Cadastrar primeira conta"
            onCta={onEmptyCta}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-border/50 bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-card/50 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Vencimento</th>
              <th className="px-4 py-3 text-left">Conta</th>
              <th className="hidden px-4 py-3 text-left md:table-cell">Categoria</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const dueBadge = getDueBadge(row.days, row.status);
              return (
                <tr key={row.id} className="border-b border-border/30 transition-colors hover:bg-card/60">
                  <td className="px-4 py-3.5">
                    <Badge variant="outline" className={`${dueBadge.className} font-medium`}>{dueBadge.label}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-foreground">
                    {row.dueDate ? row.dueDate.toLocaleDateString("pt-BR") : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-foreground">{row.title}</p>
                    {row.supplier ? <p className="text-xs text-muted-foreground">{row.supplier}</p> : null}
                  </td>
                  <td className="hidden px-4 py-3.5 md:table-cell">
                    <span className="text-xs capitalize text-muted-foreground">{row.category || "outros"}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tracking-tight text-foreground">R$ {toCurrency(row.amount)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {row.status !== "paid" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200"
                          onClick={() => onRegisterPayment(row)}
                          title="Marcar como pago"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                          <CircleCheck className="mr-1 h-3 w-3" />
                          Pago
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]"
                        onClick={() => onDuplicate(row)}
                        title="Duplicar para o próximo mês"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-red-500/10 hover:text-red-300"
                        onClick={() => onDelete(row.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && totalRows > 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum resultado para os filtros atuais.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <PaginationBar page={page} totalPages={totalPages} pageSize={pageSize} total={totalRows} onPage={onPage} onPageSize={onPageSize} />
    </Card>
  );
}

/* ─────────────────────── CARDS TABLE ─────────────────────── */

type CreditCardRow = {
  id: number;
  name: string;
  brand: string;
  lastFour: string | null;
  closingDay: number;
  dueDay: number;
  creditLimit: number;
  notes: string | null;
};

function CreditCardsTable({
  rows,
  page,
  pageSize,
  totalPages,
  totalRows,
  onPage,
  onPageSize,
  onDelete,
  onEmptyCta,
}: {
  rows: CreditCardRow[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalRows: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
  onDelete: (id: number) => void;
  onEmptyCta: () => void;
}) {
  if (rows.length === 0 && totalRows === 0) {
    return (
      <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
        <CardContent className="p-6">
          <EmptyState
            title="Nenhum cartão cadastrado"
            description="Cadastre seus cartões corporativos para acompanhar limites, fechamento e vencimento das faturas."
            cta="Cadastrar primeiro cartão"
            onCta={onEmptyCta}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-border/50 bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-card/50 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3 text-left">Cartão</th>
              <th className="hidden px-4 py-3 text-left md:table-cell">Bandeira</th>
              <th className="px-4 py-3 text-center">Fechamento</th>
              <th className="px-4 py-3 text-center">Vencimento</th>
              <th className="px-4 py-3 text-right">Limite</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/30 transition-colors hover:bg-card/60">
                <td className="px-4 py-3.5">
                  <p className="font-medium text-foreground">{row.name}</p>
                  {row.lastFour ? (
                    <p className="text-xs text-muted-foreground">•••• {row.lastFour}</p>
                  ) : row.notes ? (
                    <p className="line-clamp-1 text-xs text-muted-foreground">{row.notes}</p>
                  ) : null}
                </td>
                <td className="hidden px-4 py-3.5 md:table-cell">
                  <span className="text-xs capitalize text-muted-foreground">{row.brand || "—"}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-center text-foreground">
                  Dia <span className="font-semibold">{row.closingDay}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-center text-foreground">
                  Dia <span className="font-semibold">{row.dueDay}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tracking-tight text-foreground">R$ {toCurrency(row.creditLimit)}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:bg-red-500/10 hover:text-red-300"
                      onClick={() => onDelete(row.id)}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && totalRows > 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum resultado para os filtros atuais.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <PaginationBar page={page} totalPages={totalPages} pageSize={pageSize} total={totalRows} onPage={onPage} onPageSize={onPageSize} />
    </Card>
  );
}

/* ─────────────────────── LOANS TABLE ─────────────────────── */

type LoanRow = {
  id: number;
  name: string;
  institution: string;
  loanType: string;
  totalAmount: number;
  totalPaid: number;
  totalInstallments: number | null;
  installmentAmount: number;
  startDate: Date | null;
  dueDay: number | null;
};

function LoansTable({
  rows,
  page,
  pageSize,
  totalPages,
  totalRows,
  onPage,
  onPageSize,
  onDelete,
  onEmptyCta,
}: {
  rows: LoanRow[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalRows: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
  onDelete: (id: number) => void;
  onEmptyCta: () => void;
}) {
  if (rows.length === 0 && totalRows === 0) {
    return (
      <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
        <CardContent className="p-6">
          <EmptyState
            title="Nenhum empréstimo cadastrado"
            description="Cadastre contratos de capital de giro, retenções e parcelados para acompanhar saldo devedor e amortizações."
            cta="Cadastrar primeiro empréstimo"
            onCta={onEmptyCta}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-border/50 bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-card/50 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3 text-left">Contrato</th>
              <th className="hidden px-4 py-3 text-left md:table-cell">Instituição</th>
              <th className="px-4 py-3 text-left">Progresso</th>
              <th className="px-4 py-3 text-right">Saldo devedor</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const balance = Math.max(row.totalAmount - row.totalPaid, 0);
              const progress = row.totalAmount > 0 ? Math.min((row.totalPaid / row.totalAmount) * 100, 100) : 0;
              return (
                <tr key={row.id} className="border-b border-border/30 transition-colors hover:bg-card/60">
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-foreground">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.loanType === "sales_retention" ? "Retenção sobre vendas" : `${row.totalInstallments ?? "?"}x parcelas`}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3.5 md:table-cell">
                    <span className="text-xs text-muted-foreground">{row.institution}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex w-[160px] flex-col gap-1.5">
                      <Progress value={progress} className="h-1.5 bg-muted/50" />
                      <p className="text-[11px] text-muted-foreground">
                        <span className="font-semibold text-emerald-300">{progress.toFixed(0)}%</span> · R$ {toCurrency(row.totalPaid)} pagos
                      </p>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tracking-tight text-foreground">R$ {toCurrency(balance)}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right text-muted-foreground">R$ {toCurrency(row.totalAmount)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-red-500/10 hover:text-red-300"
                        onClick={() => onDelete(row.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && totalRows > 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum resultado para os filtros atuais.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <PaginationBar page={page} totalPages={totalPages} pageSize={pageSize} total={totalRows} onPage={onPage} onPageSize={onPageSize} />
    </Card>
  );
}

/* ────────────────────────── DIALOG ────────────────────────── */

const PAYABLE_CATEGORIES = ["fornecedor", "boleto", "imposto", "aluguel", "energia", "internet", "marketing", "logistica", "salário", "outros"];
const CARD_BRANDS = ["visa", "mastercard", "elo", "amex", "outros"];
const PAYMENT_METHODS = ["boleto", "pix", "transferência", "cartão", "dinheiro", "débito automático"];

function emptyForm(defaultCnpjId?: string): FormState {
  return {
    cnpjId: defaultCnpjId ?? "",
    title: "",
    amount: "",
    dueDate: formatDate(new Date()),
    notes: "",
    category: "outros",
    supplier: "",
    paymentMethod: "boleto",
    closingDay: "1",
    dueDay: "10",
    brand: "outros",
    lastFourDigits: "",
    institution: "",
    totalInstallments: "12",
    installmentAmount: "",
  };
}

function AccountsDialog({
  open,
  mode,
  onOpenChange,
  onSubmit,
  isSaving,
  cnpjs,
  defaultCnpjId,
}: {
  open: boolean;
  mode: DialogMode;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: FormState) => Promise<void>;
  isSaving: boolean;
  cnpjs: CnpjOption[];
  defaultCnpjId?: string;
}) {
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultCnpjId));

  useEffect(() => {
    if (open) {
      setForm((current) => ({
        ...current,
        cnpjId: current.cnpjId || defaultCnpjId || cnpjs[0]?.id || "",
      }));
    }
  }, [open, defaultCnpjId, cnpjs]);

  const isCard = mode === "credit-cards";
  const isLoan = mode === "loans";
  const isPayable = mode === "payables";

  const dialogTitle = isCard ? "Novo cartão" : isLoan ? "Novo empréstimo" : "Nova conta a pagar";
  const dialogDescription = isCard
    ? "Cadastre um cartão corporativo para acompanhar limite, fechamento e vencimento."
    : isLoan
    ? "Cadastre o contrato com instituição, valor total e plano de parcelas."
    : "Cadastre boleto, fornecedor ou despesa e acompanhe o vencimento.";

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.cnpjId) {
      toast.error("Selecione o CNPJ.");
      return;
    }
    if (!form.title || !form.amount) {
      toast.error("Preencha pelo menos título e valor.");
      return;
    }
    await onSubmit(form);
    setForm(emptyForm(defaultCnpjId));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border/50 bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">CNPJ</Label>
            <Select value={form.cnpjId} onValueChange={(v) => set("cnpjId", v)}>
              <SelectTrigger className="border-border/50 bg-card">
                <SelectValue placeholder="Selecione o CNPJ" />
              </SelectTrigger>
              <SelectContent>
                {cnpjs.map((cnpj) => (
                  <SelectItem key={cnpj.id} value={cnpj.id}>
                    {cnpj.name} · {cnpj.cnpj}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {isCard ? "Nome do cartão" : isLoan ? "Nome do contrato" : "Título da conta"}
            </Label>
            <Input
              className="border-border/50 bg-card"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={isCard ? "Ex.: Nubank Empresarial" : isLoan ? "Ex.: Capital de giro Itaú" : "Ex.: Boleto Mondial nº 1234"}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {isCard ? "Limite" : isLoan ? "Valor total contratado" : "Valor"}
              </Label>
              <Input
                className="border-border/50 bg-card"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {isLoan ? "Início do contrato" : "Vencimento"}
              </Label>
              <Input
                className="border-border/50 bg-card"
                type="date"
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            </div>
          </div>

          {isPayable ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Fornecedor</Label>
                  <Input
                    className="border-border/50 bg-card"
                    value={form.supplier}
                    onChange={(e) => set("supplier", e.target.value)}
                    placeholder="Ex.: Mondial, Cemig, Vivo…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => set("category", v)}>
                    <SelectTrigger className="border-border/50 bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYABLE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Forma de pagamento</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => set("paymentMethod", v)}>
                  <SelectTrigger className="border-border/50 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          {isCard ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Bandeira</Label>
                  <Select value={form.brand} onValueChange={(v) => set("brand", v)}>
                    <SelectTrigger className="border-border/50 bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CARD_BRANDS.map((b) => (
                        <SelectItem key={b} value={b} className="capitalize">{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Final (4 dígitos)</Label>
                  <Input
                    className="border-border/50 bg-card"
                    value={form.lastFourDigits}
                    onChange={(e) => set("lastFourDigits", e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="1234"
                    inputMode="numeric"
                    maxLength={4}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Fechamento (dia)</Label>
                  <Input
                    className="border-border/50 bg-card"
                    type="number"
                    min={1}
                    max={31}
                    value={form.closingDay}
                    onChange={(e) => set("closingDay", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Vencimento (dia)</Label>
                <Input
                  className="border-border/50 bg-card"
                  type="number"
                  min={1}
                  max={31}
                  value={form.dueDay}
                  onChange={(e) => set("dueDay", e.target.value)}
                />
              </div>
            </>
          ) : null}

          {isLoan ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Instituição financeira</Label>
                <Input
                  className="border-border/50 bg-card"
                  value={form.institution}
                  onChange={(e) => set("institution", e.target.value)}
                  placeholder="Ex.: Itaú, C6, Banco Inter, Mercado Livre…"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Nº de parcelas</Label>
                  <Input
                    className="border-border/50 bg-card"
                    type="number"
                    min={1}
                    value={form.totalInstallments}
                    onChange={(e) => set("totalInstallments", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Valor da parcela</Label>
                  <Input
                    className="border-border/50 bg-card"
                    value={form.installmentAmount}
                    onChange={(e) => set("installmentAmount", e.target.value)}
                    placeholder="0,00"
                    inputMode="decimal"
                  />
                </div>
              </div>
            </>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Observações</Label>
            <Textarea
              className="border-border/50 bg-card"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Detalhes opcionais"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving}
            className="border-0 font-semibold text-black hover:opacity-90"
            style={{ backgroundColor: KAIBREN_GOLD }}
          >
            {isSaving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────── PAGE ────────────────────────── */

export default function Obligations() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [, contasParams] = useRoute<{ tab?: string }>("/contas/:tab");
  const [, obrigacoesParams] = useRoute<{ tab?: string }>("/obrigacoes/:tab");
  const routeTab = contasParams?.tab ?? obrigacoesParams?.tab;

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<AccountsSection>(getSectionFromRoute(routeTab));

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("due-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setActiveSection(getSectionFromRoute(routeTab));
    setPage(1);
    setSearch("");
  }, [routeTab]);

  const cnpjsQuery = trpc.myCnpjs.list.useQuery();
  const cnpjs: CnpjOption[] = (cnpjsQuery.data ?? []).map((item: any) => ({
    id: String(item.id),
    name: item.nomeFantasia || item.razaoSocial || `CNPJ ${item.id}`,
    cnpj: item.cnpj,
  }));
  const fallbackCnpjId = cnpjs[0]?.id ? Number(cnpjs[0].id) : undefined;

  const payablesQuery = trpc.finance.payables.list.useQuery(
    fallbackCnpjId ? { year: selectedYear, month: selectedMonth, cnpjId: fallbackCnpjId } : { year: selectedYear, month: selectedMonth },
  );
  const creditCardsQuery = trpc.finance.creditCards.list.useQuery(
    { cnpjId: fallbackCnpjId ?? 1 },
    { enabled: Boolean(fallbackCnpjId) },
  );
  const loansQuery = trpc.finance.loans.list.useQuery(
    { cnpjId: fallbackCnpjId ?? 1 },
    { enabled: Boolean(fallbackCnpjId) },
  );

  const createPayableMutation = trpc.finance.payables.create.useMutation();
  const deletePayableMutation = trpc.finance.payables.delete.useMutation();
  const registerPaymentMutation = trpc.finance.payables.registerPayment.useMutation();
  const createCreditCardMutation = trpc.finance.creditCards.create.useMutation();
  const deleteCreditCardMutation = trpc.finance.creditCards.delete.useMutation();
  const createLoanMutation = trpc.finance.loans.create.useMutation();
  const deleteLoanMutation = trpc.finance.loans.delete.useMutation();

  const payablesRaw = payablesQuery.data ?? [];
  const creditCards = creditCardsQuery.data ?? [];
  const loans = loansQuery.data ?? [];

  /* ─── Payables: rows + filtros + ordenação ─── */
  const payableRows: PayableRow[] = useMemo(
    () =>
      payablesRaw.map((item: any) => {
        const dueDate = normalizeDate(item.dueDate);
        return {
          id: Number(item.id),
          title: item.title || item.description || "Conta a pagar",
          supplier: item.supplier ?? null,
          category: item.category ?? null,
          amount: Number(item.amount || 0),
          dueDate,
          days: dueDate ? differenceInDays(dueDate) : null,
          status: String(item.status ?? "pending"),
          paymentMethod: item.paymentMethod ?? null,
        };
      }),
    [payablesRaw],
  );

  const filteredPayables = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payableRows.filter((row) => {
      if (term) {
        const haystack = `${row.title} ${row.supplier ?? ""} ${row.category ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (categoryFilter && (row.category ?? "outros").toLowerCase() !== categoryFilter) return false;
      if (statusFilter === "paid" && row.status !== "paid") return false;
      if (statusFilter === "pending" && row.status !== "pending") return false;
      if (statusFilter === "overdue") {
        if (row.status === "paid") return false;
        if (row.days === null || row.days >= 0) return false;
      }
      if (statusFilter === "due-soon") {
        if (row.status === "paid") return false;
        if (row.days === null || row.days < 0 || row.days > 7) return false;
      }
      return true;
    });
  }, [payableRows, search, statusFilter, categoryFilter]);

  const sortedPayables = useMemo(() => {
    const list = [...filteredPayables];
    list.sort((a, b) => {
      switch (sort) {
        case "due-asc":
          return (a.days ?? Infinity) - (b.days ?? Infinity);
        case "due-desc":
          return (b.days ?? -Infinity) - (a.days ?? -Infinity);
        case "amount-desc":
          return b.amount - a.amount;
        case "amount-asc":
          return a.amount - b.amount;
        case "title-asc":
          return a.title.localeCompare(b.title, "pt-BR");
        default:
          return 0;
      }
    });
    return list;
  }, [filteredPayables, sort]);

  /* ─── Cards: rows + filtros ─── */
  const cardRows: CreditCardRow[] = useMemo(
    () =>
      creditCards.map((item: any) => ({
        id: Number(item.id),
        name: item.name || "Cartão",
        brand: item.brand || "outros",
        lastFour: item.lastFourDigits || null,
        closingDay: Number(item.closingDay || 1),
        dueDay: Number(item.dueDay || 10),
        creditLimit: Number(item.creditLimit || 0),
        notes: item.notes ?? null,
      })),
    [creditCards],
  );

  const filteredCards = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return cardRows;
    return cardRows.filter((row) => `${row.name} ${row.brand} ${row.notes ?? ""}`.toLowerCase().includes(term));
  }, [cardRows, search]);

  const sortedCards = useMemo(() => {
    const list = [...filteredCards];
    list.sort((a, b) => {
      switch (sort) {
        case "amount-desc":
          return b.creditLimit - a.creditLimit;
        case "amount-asc":
          return a.creditLimit - b.creditLimit;
        case "title-asc":
          return a.name.localeCompare(b.name, "pt-BR");
        default:
          return a.dueDay - b.dueDay;
      }
    });
    return list;
  }, [filteredCards, sort]);

  /* ─── Loans: rows + filtros ─── */
  const loanRows: LoanRow[] = useMemo(
    () =>
      loans.map((item: any) => ({
        id: Number(item.id),
        name: item.name || "Empréstimo",
        institution: item.institution || "Instituição não informada",
        loanType: item.loanType || "installment",
        totalAmount: Number(item.totalAmount || 0),
        totalPaid: Number(item.totalPaid || 0),
        totalInstallments: item.totalInstallments ? Number(item.totalInstallments) : null,
        installmentAmount: Number(item.installmentAmount || 0),
        startDate: normalizeDate(item.startDate),
        dueDay: item.dueDay ? Number(item.dueDay) : null,
      })),
    [loans],
  );

  const filteredLoans = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return loanRows;
    return loanRows.filter((row) => `${row.name} ${row.institution}`.toLowerCase().includes(term));
  }, [loanRows, search]);

  const sortedLoans = useMemo(() => {
    const list = [...filteredLoans];
    list.sort((a, b) => {
      switch (sort) {
        case "amount-desc":
          return (b.totalAmount - b.totalPaid) - (a.totalAmount - a.totalPaid);
        case "amount-asc":
          return (a.totalAmount - a.totalPaid) - (b.totalAmount - b.totalPaid);
        case "title-asc":
          return a.name.localeCompare(b.name, "pt-BR");
        default:
          return b.totalAmount - a.totalAmount;
      }
    });
    return list;
  }, [filteredLoans, sort]);

  /* ─── Pagination ─── */
  const activeList =
    activeSection === "payables" ? sortedPayables : activeSection === "credit-cards" ? sortedCards : sortedLoans;
  const totalRows = activeList.length;
  const totalPages = Math.max(Math.ceil(totalRows / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const pagedList = activeList.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [activeSection, search, statusFilter, sort, pageSize]);

  /* ─── KPIs Contas a Pagar ─── */
  const payableTotalPeriod = payableRows.reduce((sum, r) => sum + r.amount, 0);
  const overdueRows = payableRows.filter((r) => r.status !== "paid" && r.days !== null && r.days < 0);
  const dueSoonRows = payableRows.filter((r) => r.status !== "paid" && r.days !== null && r.days >= 0 && r.days <= 7);
  const todayRows = payableRows.filter((r) => r.status !== "paid" && r.days === 0);
  const paidRows = payableRows.filter((r) => r.status === "paid");
  const overdueValue = overdueRows.reduce((sum, r) => sum + r.amount, 0);
  const todayValue = todayRows.reduce((sum, r) => sum + r.amount, 0);
  const paidValue = paidRows.reduce((sum, r) => sum + r.amount, 0);

  /* ─── KPIs Cartões ─── */
  const creditLimitTotal = cardRows.reduce((sum, r) => sum + r.creditLimit, 0);
  const nextClosingCard = [...cardRows].sort((a, b) => a.closingDay - b.closingDay)[0];
  const nextDueCard = [...cardRows].sort((a, b) => a.dueDay - b.dueDay)[0];

  /* ─── KPIs Empréstimos ─── */
  const loanTotalContracted = loanRows.reduce((sum, r) => sum + r.totalAmount, 0);
  const loanTotalPaid = loanRows.reduce((sum, r) => sum + r.totalPaid, 0);
  const loanBalance = Math.max(loanTotalContracted - loanTotalPaid, 0);
  const loanProgress = loanTotalContracted > 0 ? (loanTotalPaid / loanTotalContracted) * 100 : 0;

  /* ─── Active filter count ─── */
  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (activeSection === "payables" && statusFilter !== "all" ? 1 : 0) +
    (activeSection === "payables" && categoryFilter ? 1 : 0) +
    (sort !== "due-asc" ? 1 : 0);

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setCategoryFilter(null);
    setSort("due-asc");
  }

  async function refreshAll() {
    setIsRefreshing(true);
    try {
      await Promise.all([payablesQuery.refetch(), creditCardsQuery.refetch(), loansQuery.refetch()]);
    } finally {
      setIsRefreshing(false);
    }
  }

  function navigateToSection(section: AccountsSection) {
    setActiveSection(section);
    navigate(getSectionHref(section));
  }

  function openCreateDialog() {
    setDialogMode(activeSection);
    setDialogOpen(true);
  }

  async function handleCreate(payload: FormState) {
    if (!dialogMode) return;
    if (!fallbackCnpjId) {
      toast.error("Cadastre ao menos um CNPJ para usar este módulo.");
      return;
    }

    const selectedCnpjId = Number(payload.cnpjId);

    try {
      if (dialogMode === "payables") {
        await createPayableMutation.mutateAsync({
          cnpjId: selectedCnpjId,
          title: payload.title,
          supplier: payload.supplier || null,
          category: payload.category || "outros",
          amount: payload.amount.replace(",", "."),
          dueDate: payload.dueDate,
          paymentMethod: payload.paymentMethod || null,
          notes: payload.notes || null,
        });
        toast.success("Conta cadastrada.");
      }

      if (dialogMode === "credit-cards") {
        await createCreditCardMutation.mutateAsync({
          cnpjId: selectedCnpjId,
          name: payload.title,
          brand: payload.brand || "outros",
          lastFourDigits: payload.lastFourDigits || null,
          closingDay: Number(payload.closingDay) || 1,
          dueDay: Number(payload.dueDay) || 10,
          creditLimit: payload.amount ? payload.amount.replace(",", ".") : null,
          notes: payload.notes || null,
        });
        toast.success("Cartão cadastrado.");
      }

      if (dialogMode === "loans") {
        await createLoanMutation.mutateAsync({
          cnpjId: selectedCnpjId,
          name: payload.title,
          institution: payload.institution || "Não informada",
          loanType: "installment",
          totalAmount: payload.amount.replace(",", "."),
          startDate: payload.dueDate,
          totalInstallments: Number(payload.totalInstallments) || 1,
          installmentAmount: payload.installmentAmount ? payload.installmentAmount.replace(",", ".") : null,
          notes: payload.notes || null,
        });
        toast.success("Empréstimo cadastrado.");
      }

      await refreshAll();
      setDialogOpen(false);
      setDialogMode(null);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao cadastrar.");
    }
  }

  async function handleDelete(section: AccountsSection, id: number) {
    const confirmed = window.confirm("Deseja realmente excluir este item?");
    if (!confirmed) return;

    try {
      if (section === "payables") await deletePayableMutation.mutateAsync({ id });
      if (section === "credit-cards") await deleteCreditCardMutation.mutateAsync({ id });
      if (section === "loans") await deleteLoanMutation.mutateAsync({ id });
      toast.success("Item excluído.");
      await refreshAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir.");
    }
  }

  async function handleDuplicate(row: PayableRow) {
    if (!fallbackCnpjId) {
      toast.error("Cadastre ao menos um CNPJ.");
      return;
    }
    const baseDate = row.dueDate ?? new Date();
    const next = new Date(baseDate);
    next.setMonth(next.getMonth() + 1);
    const nextDateStr = formatDate(next);
    try {
      await createPayableMutation.mutateAsync({
        cnpjId: fallbackCnpjId,
        title: row.title,
        supplier: row.supplier || null,
        category: row.category || "outros",
        amount: String(row.amount),
        dueDate: nextDateStr,
        paymentMethod: row.paymentMethod || null,
      });
      toast.success(`"${row.title}" duplicada para ${next.toLocaleDateString("pt-BR")}.`);
      await refreshAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao duplicar.");
    }
  }

  async function handleRegisterPayment(row: PayableRow) {
    const confirmed = window.confirm(`Marcar "${row.title}" como pago?`);
    if (!confirmed) return;
    try {
      await registerPaymentMutation.mutateAsync({
        id: row.id,
        paidAmount: String(row.amount),
        paidAt: new Date(),
        paymentMethod: row.paymentMethod ?? undefined,
      });
      toast.success("Pagamento registrado.");
      await refreshAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao registrar pagamento.");
    }
  }

  if (!user) return null;

  return (
    <DashboardLayout
      activeSection="contas"
      onNavigate={(section) => navigate(section === "dashboard" ? "/" : `/${section}`)}
    >
      <div className="space-y-5">
        <HeaderBar
          activeSection={activeSection}
          onNavigate={navigateToSection}
          onCreate={openCreateDialog}
          onRefresh={refreshAll}
          isRefreshing={isRefreshing}
        />

        {activeSection === "payables" ? (
          <>
            <UrgencyBanner
              overdueCount={overdueRows.length}
              overdueValue={overdueValue}
              todayCount={todayRows.length}
              todayValue={todayValue}
              onClickOverdue={() => setStatusFilter("overdue")}
              onClickToday={() => setStatusFilter("due-soon")}
            />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Total no período"
                value={`R$ ${toCurrency(payableTotalPeriod)}`}
                helper={`${payableRows.length} conta(s) • ${MONTHS[selectedMonth - 1]} ${selectedYear}`}
                icon={Wallet}
                tone="gold"
              />
              <StatTile
                label="Vencidas"
                value={`${overdueRows.length}`}
                helper={`R$ ${toCurrency(overdueValue)} em atraso`}
                icon={AlertTriangle}
                tone="danger"
              />
              <StatTile
                label="Vencem em 7 dias"
                value={`${dueSoonRows.length}`}
                helper="Atenção imediata"
                icon={CalendarClock}
                tone="warning"
              />
              <StatTile
                label="Pagas"
                value={`${paidRows.length}`}
                helper={`R$ ${toCurrency(paidValue)} quitados`}
                icon={CircleCheck}
                tone="success"
              />
            </div>
          </>
        ) : null}

        {activeSection === "credit-cards" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Cartões ativos"
              value={`${cardRows.length}`}
              helper="Total cadastrados"
              icon={CreditCard}
              tone="gold"
            />
            <StatTile
              label="Limite total"
              value={`R$ ${toCurrency(creditLimitTotal)}`}
              helper="Soma dos limites disponíveis"
              icon={Wallet}
              tone="neutral"
            />
            <StatTile
              label="Próximo fechamento"
              value={nextClosingCard ? `Dia ${nextClosingCard.closingDay}` : "—"}
              helper={nextClosingCard ? nextClosingCard.name : "Cadastre um cartão"}
              icon={CalendarClock}
              tone="warning"
            />
            <StatTile
              label="Próximo vencimento"
              value={nextDueCard ? `Dia ${nextDueCard.dueDay}` : "—"}
              helper={nextDueCard ? nextDueCard.name : "Cadastre um cartão"}
              icon={AlertTriangle}
              tone="danger"
            />
          </div>
        ) : null}

        {activeSection === "loans" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Contratos ativos"
              value={`${loanRows.length}`}
              helper="Empréstimos em andamento"
              icon={Landmark}
              tone="gold"
            />
            <StatTile
              label="Saldo devedor"
              value={`R$ ${toCurrency(loanBalance)}`}
              helper={`${loanProgress.toFixed(0)}% já amortizado`}
              icon={AlertTriangle}
              tone="danger"
            />
            <StatTile
              label="Já amortizado"
              value={`R$ ${toCurrency(loanTotalPaid)}`}
              helper="Total pago até hoje"
              icon={TrendingUp}
              tone="success"
            />
            <StatTile
              label="Total contratado"
              value={`R$ ${toCurrency(loanTotalContracted)}`}
              helper="Soma dos contratos"
              icon={Wallet}
              tone="neutral"
            />
          </div>
        ) : null}

        <FiltersBar
          section={activeSection}
          search={search}
          onSearchChange={setSearch}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
          status={statusFilter}
          onStatusChange={setStatusFilter}
          sort={sort}
          onSortChange={setSort}
          onClear={clearFilters}
          activeCount={activeFilterCount}
        />

        {activeSection === "payables" ? (
          <>
            {payableRows.length > 0 ? (
              <CategoryQuickFilter
                rows={payableRows}
                selected={categoryFilter}
                onSelect={setCategoryFilter}
              />
            ) : null}
            <PayablesTable
              rows={pagedList as PayableRow[]}
              page={safePage}
              pageSize={pageSize}
              totalPages={totalPages}
              totalRows={totalRows}
              onPage={setPage}
              onPageSize={setPageSize}
              onRegisterPayment={handleRegisterPayment}
              onDuplicate={handleDuplicate}
              onDelete={(id) => handleDelete("payables", id)}
              onEmptyCta={openCreateDialog}
            />
          </>
        ) : null}

        {activeSection === "credit-cards" ? (
          <CreditCardsTable
            rows={pagedList as CreditCardRow[]}
            page={safePage}
            pageSize={pageSize}
            totalPages={totalPages}
            totalRows={totalRows}
            onPage={setPage}
            onPageSize={setPageSize}
            onDelete={(id) => handleDelete("credit-cards", id)}
            onEmptyCta={openCreateDialog}
          />
        ) : null}

        {activeSection === "loans" ? (
          <LoansTable
            rows={pagedList as LoanRow[]}
            page={safePage}
            pageSize={pageSize}
            totalPages={totalPages}
            totalRows={totalRows}
            onPage={setPage}
            onPageSize={setPageSize}
            onDelete={(id) => handleDelete("loans", id)}
            onEmptyCta={openCreateDialog}
          />
        ) : null}
      </div>

      <LiaChat
        screenContext={
          activeSection === "payables"
            ? "Contas a Pagar"
            : activeSection === "credit-cards"
            ? "Cartão de Crédito"
            : "Empréstimos"
        }
        pageData={
          activeSection === "payables"
            ? `Período: ${MONTHS[selectedMonth - 1]} ${selectedYear}. Total ${payableRows.length} contas, R$ ${toCurrency(payableTotalPeriod)}. Vencidas: ${overdueRows.length} (R$ ${toCurrency(overdueValue)}). Vence em 7 dias: ${dueSoonRows.length}. Pagas: ${paidRows.length}.`
            : activeSection === "credit-cards"
            ? `${cardRows.length} cartão(ões) ativos. Limite total R$ ${toCurrency(creditLimitTotal)}. Próximo fechamento dia ${nextClosingCard?.closingDay ?? "—"} (${nextClosingCard?.name ?? ""}). Próximo vencimento dia ${nextDueCard?.dueDay ?? "—"} (${nextDueCard?.name ?? ""}).`
            : `${loanRows.length} contrato(s) ativos. Saldo devedor R$ ${toCurrency(loanBalance)} (${loanProgress.toFixed(0)}% amortizado). Total contratado R$ ${toCurrency(loanTotalContracted)}. Já pago R$ ${toCurrency(loanTotalPaid)}.`
        }
        quickPrompts={
          activeSection === "payables"
            ? ["Tem alguma conta atrasada?", "Cadastra um boleto pra mim", "Quanto vou pagar este mês?"]
            : activeSection === "credit-cards"
            ? ["Qual fatura vence primeiro?", "Cadastra um cartão novo", "Quanto de limite total?"]
            : ["Quanto falta pagar de empréstimos?", "Quanto já amortizei?", "Cadastra um empréstimo novo"]
        }
        cnpjId={fallbackCnpjId}
      />

      <AccountsDialog
        open={dialogOpen}
        mode={dialogMode}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setDialogMode(null);
        }}
        onSubmit={handleCreate}
        isSaving={
          createPayableMutation.isPending ||
          createCreditCardMutation.isPending ||
          createLoanMutation.isPending
        }
        cnpjs={cnpjs}
        defaultCnpjId={cnpjs[0]?.id}
      />
    </DashboardLayout>
  );
}
