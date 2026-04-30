import DashboardLayout from "@/components/DashboardLayout";
import LiaChat from "@/components/LiaChat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pause,
  Pencil,
  Play,
  Plus,
  Receipt,
  Repeat,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type CustoFixo = {
  id: number;
  nome: string;
  valor: number;
  frequencia: string;
  categoria: string | null;
  ativo: boolean;
  observacao: string | null;
};

type StatusFilter = "active" | "inactive" | "all";
type FrequencyFilter = "all" | "mensal" | "semanal" | "anual" | "único";
type SortKey = "name-asc" | "amount-desc" | "amount-asc" | "category-asc";

type FormState = {
  nome: string;
  valor: string;
  frequencia: string;
  categoria: string;
  observacao: string;
};

const KAIBREN_GOLD = "#D4AF37";
const PAGE_SIZES = [25, 50, 100];

const CATEGORIES = [
  "aluguel",
  "energia",
  "água",
  "internet",
  "telefone",
  "software",
  "contador",
  "seguro",
  "marketing",
  "logistica",
  "salário",
  "outros",
];

const FREQUENCY_LABEL: Record<string, string> = {
  mensal: "Mensal",
  semanal: "Semanal",
  anual: "Anual",
  "único": "Único",
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function formatCurrency(value: number) {
  return currency.format(value || 0);
}

/** Valor equivalente mensal (para comparar tudo na mesma régua) */
function monthlyEquivalent(c: { valor: number; frequencia: string }) {
  const v = Number(c.valor || 0);
  switch (c.frequencia) {
    case "mensal":
      return v;
    case "semanal":
      return v * 4.33;
    case "anual":
      return v / 12;
    case "único":
      return 0;
    default:
      return v;
  }
}

function emptyForm(): FormState {
  return { nome: "", valor: "", frequencia: "mensal", categoria: "outros", observacao: "" };
}

/* ───────────────────── HEADER ───────────────────── */

function HeaderBar({
  onCreate,
  onRefresh,
  isRefreshing,
}: {
  onCreate: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Financeiro · Custos Fixos</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Custos fixos da empresa</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Aluguel, salários, internet, software, contador, seguros — tudo o que recorre todo mês. Brenda usa essa tela para fechar a conta do mês e bater o caixa.
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
          Novo custo
        </Button>
      </div>
    </div>
  );
}

/* ───────────────────── STATS ───────────────────── */

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

/* ───────────────────── FILTERS ───────────────────── */

function FiltersBar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  frequency,
  onFrequencyChange,
  sort,
  onSortChange,
  onClear,
  activeCount,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  status: StatusFilter;
  onStatusChange: (v: StatusFilter) => void;
  frequency: FrequencyFilter;
  onFrequencyChange: (v: FrequencyFilter) => void;
  sort: SortKey;
  onSortChange: (v: SortKey) => void;
  onClear: () => void;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por nome, categoria, observação…"
              className="border-border/50 bg-card pl-9"
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-card p-1">
            {(["active", "inactive", "all"] as StatusFilter[]).map((opt) => {
              const active = status === opt;
              const label = opt === "active" ? "Ativos" : opt === "inactive" ? "Inativos" : "Todos";
              return (
                <button
                  key={opt}
                  onClick={() => onStatusChange(opt)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-[#D4AF37]/15 text-[#D4AF37]"
                      : "text-muted-foreground hover:bg-card/80 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
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
          <div className="grid gap-3 border-t border-border/40 pt-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Frequência</Label>
              <Select value={frequency} onValueChange={(v) => onFrequencyChange(v as FrequencyFilter)}>
                <SelectTrigger className="h-9 border-border/50 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                  <SelectItem value="único">Único</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ordenar por</Label>
              <Select value={sort} onValueChange={(v) => onSortChange(v as SortKey)}>
                <SelectTrigger className="h-9 border-border/50 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount-desc">Maior valor (mensal eq.)</SelectItem>
                  <SelectItem value="amount-asc">Menor valor (mensal eq.)</SelectItem>
                  <SelectItem value="name-asc">Nome A-Z</SelectItem>
                  <SelectItem value="category-asc">Categoria A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ───────────────── CATEGORY CHIPS ───────────────── */

function CategoryQuickFilter({
  rows,
  selected,
  onSelect,
}: {
  rows: { categoria: string | null; valor: number; frequencia: string }[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}) {
  const summary = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = (r.categoria || "outros").toLowerCase();
      map.set(key, (map.get(key) ?? 0) + monthlyEquivalent(r));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
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
            {cat} <span className="ml-1 text-[10px] opacity-70">{formatCurrency(total)}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────── EMPTY STATE ───────────────── */

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
        <Receipt className="h-5 w-5" style={{ color: KAIBREN_GOLD }} />
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

/* ─────────────── PAGINATION ─────────────── */

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

/* ─────────────── TABLE ─────────────── */

function CustosTable({
  rows,
  totalRows,
  page,
  pageSize,
  totalPages,
  onPage,
  onPageSize,
  onToggle,
  onEdit,
  onDelete,
  onEmptyCta,
}: {
  rows: CustoFixo[];
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
  onToggle: (c: CustoFixo) => void;
  onEdit: (c: CustoFixo) => void;
  onDelete: (c: CustoFixo) => void;
  onEmptyCta: () => void;
}) {
  if (rows.length === 0 && totalRows === 0) {
    return (
      <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
        <CardContent className="p-6">
          <EmptyState
            title="Nenhum custo fixo cadastrado"
            description="Cadastre aluguel, energia, internet, software e tudo o que recorre todo mês para acompanhar quanto a empresa precisa fazer só pra ficar de pé."
            cta="Cadastrar primeiro custo"
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
              <th className="px-4 py-3 text-left">Custo</th>
              <th className="hidden px-4 py-3 text-left md:table-cell">Categoria</th>
              <th className="px-4 py-3 text-center">Frequência</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="hidden px-4 py-3 text-right lg:table-cell">Mensal eq.</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const monthly = monthlyEquivalent(row);
              const sameAsValue = Math.abs(monthly - Number(row.valor || 0)) < 0.01;
              return (
                <tr key={row.id} className="border-b border-border/30 transition-colors hover:bg-card/60">
                  <td className="px-4 py-3.5">
                    {row.ativo ? (
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">Ativo</Badge>
                    ) : (
                      <Badge variant="outline" className="border-muted-foreground/30 bg-muted/40 text-muted-foreground">Inativo</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className={`font-medium ${row.ativo ? "text-foreground" : "text-muted-foreground line-through"}`}>{row.nome}</p>
                    {row.observacao ? <p className="line-clamp-1 text-xs text-muted-foreground">{row.observacao}</p> : null}
                  </td>
                  <td className="hidden px-4 py-3.5 md:table-cell">
                    <span className="text-xs capitalize text-muted-foreground">{row.categoria || "outros"}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-center">
                    <Badge variant="outline" className="border-border/60 bg-card/50 capitalize text-muted-foreground">
                      {FREQUENCY_LABEL[row.frequencia] ?? row.frequencia}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tracking-tight text-foreground">
                    {formatCurrency(Number(row.valor))}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3.5 text-right lg:table-cell">
                    {sameAsValue ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className="text-sm text-[#D4AF37]">{formatCurrency(monthly)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${
                          row.ativo
                            ? "text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
                            : "text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200"
                        }`}
                        onClick={() => onToggle(row)}
                        title={row.ativo ? "Pausar custo" : "Reativar custo"}
                      >
                        {row.ativo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]"
                        onClick={() => onEdit(row)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-red-500/10 hover:text-red-300"
                        onClick={() => onDelete(row)}
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
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
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

/* ─────────────── DIALOG ─────────────── */

function CustoDialog({
  open,
  initial,
  onOpenChange,
  onSubmit,
  isSaving,
}: {
  open: boolean;
  initial: CustoFixo | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: FormState) => Promise<void>;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>(emptyForm());

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        nome: initial.nome,
        valor: String(initial.valor).replace(".", ","),
        frequencia: initial.frequencia,
        categoria: initial.categoria || "outros",
        observacao: initial.observacao || "",
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, initial]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do custo.");
      return;
    }
    const valorNum = Number(form.valor.replace(",", "."));
    if (Number.isNaN(valorNum) || valorNum <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    await onSubmit(form);
  }

  const isEdit = Boolean(initial);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border/50 bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{isEdit ? "Editar custo fixo" : "Novo custo fixo"}</DialogTitle>
          <DialogDescription>
            Cadastre o custo recorrente com nome, valor, frequência e categoria. Ele é considerado no total mensal automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Nome do custo</Label>
            <Input
              className="border-border/50 bg-card"
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Ex.: Aluguel galpão, Internet fibra, Bling…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Valor (R$)</Label>
              <Input
                className="border-border/50 bg-card"
                value={form.valor}
                onChange={(e) => set("valor", e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Frequência</Label>
              <Select value={form.frequencia} onValueChange={(v) => set("frequencia", v)}>
                <SelectTrigger className="border-border/50 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                  <SelectItem value="único">Único</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Categoria</Label>
            <Select value={form.categoria} onValueChange={(v) => set("categoria", v)}>
              <SelectTrigger className="border-border/50 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Observação</Label>
            <Textarea
              className="border-border/50 bg-card"
              value={form.observacao}
              onChange={(e) => set("observacao", e.target.value)}
              placeholder="Detalhes opcionais (contrato, fornecedor, dia de débito…)"
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
            {isSaving ? "Salvando…" : isEdit ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────── PAGE ─────────────── */

export default function CustosFixos() {
  const [, navigate] = useLocation();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [frequency, setFrequency] = useState<FrequencyFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("amount-desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustoFixo | null>(null);

  const listQuery = trpc.listCustosFixos.useQuery();
  const createMutation = trpc.createCustoFixo.useMutation();
  const updateMutation = trpc.updateCustoFixo.useMutation();
  const deleteMutation = trpc.deleteCustoFixo.useMutation();
  const toggleMutation = trpc.toggleCustoFixo.useMutation();

  const all: CustoFixo[] = ((listQuery.data as CustoFixo[] | undefined) || []).map((c) => ({
    ...c,
    valor: Number(c.valor || 0),
    ativo: Boolean(c.ativo),
  }));

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((c) => {
      if (statusFilter === "active" && !c.ativo) return false;
      if (statusFilter === "inactive" && c.ativo) return false;
      if (frequency !== "all" && c.frequencia !== frequency) return false;
      if (categoryFilter && (c.categoria || "outros").toLowerCase() !== categoryFilter) return false;
      if (term) {
        const haystack = `${c.nome} ${c.categoria ?? ""} ${c.observacao ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [all, search, statusFilter, frequency, categoryFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      switch (sort) {
        case "amount-desc":
          return monthlyEquivalent(b) - monthlyEquivalent(a);
        case "amount-asc":
          return monthlyEquivalent(a) - monthlyEquivalent(b);
        case "name-asc":
          return a.nome.localeCompare(b.nome, "pt-BR");
        case "category-asc":
          return (a.categoria || "outros").localeCompare(b.categoria || "outros", "pt-BR");
        default:
          return 0;
      }
    });
    return list;
  }, [filtered, sort]);

  const totalRows = sorted.length;
  const totalPages = Math.max(Math.ceil(totalRows / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const pagedList = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, frequency, categoryFilter, sort, pageSize]);

  /* KPIs */
  const ativos = all.filter((c) => c.ativo);
  const inativos = all.filter((c) => !c.ativo);
  const monthlyTotal = ativos.reduce((sum, c) => sum + monthlyEquivalent(c), 0);
  const annualTotal = monthlyTotal * 12;
  const mensalCount = ativos.filter((c) => c.frequencia === "mensal").length;
  const anualCount = ativos.filter((c) => c.frequencia === "anual").length;

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (frequency !== "all" ? 1 : 0) +
    (categoryFilter ? 1 : 0) +
    (sort !== "amount-desc" ? 1 : 0);

  function clearFilters() {
    setSearch("");
    setFrequency("all");
    setCategoryFilter(null);
    setSort("amount-desc");
  }

  async function refreshAll() {
    setIsRefreshing(true);
    try {
      await listQuery.refetch();
    } finally {
      setIsRefreshing(false);
    }
  }

  function openCreateDialog() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEditDialog(c: CustoFixo) {
    setEditing(c);
    setDialogOpen(true);
  }

  async function handleSubmit(form: FormState) {
    const valorNum = Number(form.valor.replace(",", "."));
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          nome: form.nome.trim(),
          valor: valorNum,
          frequencia: form.frequencia,
          categoria: form.categoria || null,
          observacao: form.observacao || null,
        });
        toast.success(`"${form.nome}" atualizado.`);
      } else {
        await createMutation.mutateAsync({
          nome: form.nome.trim(),
          valor: valorNum,
          frequencia: form.frequencia,
          categoria: form.categoria || null,
          observacao: form.observacao || null,
        });
        toast.success("Custo fixo cadastrado.");
      }
      setDialogOpen(false);
      setEditing(null);
      await refreshAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar.");
    }
  }

  async function handleToggle(c: CustoFixo) {
    try {
      await toggleMutation.mutateAsync({ id: c.id, ativo: !c.ativo });
      toast.success(c.ativo ? `"${c.nome}" pausado.` : `"${c.nome}" reativado.`);
      await refreshAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao atualizar.");
    }
  }

  async function handleDelete(c: CustoFixo) {
    const ok = window.confirm(`Excluir "${c.nome}"? Esta ação não pode ser desfeita.`);
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync({ id: c.id });
      toast.success("Custo excluído.");
      await refreshAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir.");
    }
  }

  return (
    <DashboardLayout
      activeSection="custos-fixos"
      onNavigate={(section) => navigate(section === "dashboard" ? "/" : `/${section}`)}
    >
      <div className="space-y-5">
        <HeaderBar onCreate={openCreateDialog} onRefresh={refreshAll} isRefreshing={isRefreshing} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Custo fixo / mês"
            value={formatCurrency(monthlyTotal)}
            helper={`${ativos.length} item(ns) ativo(s)`}
            icon={Wallet}
            tone="gold"
          />
          <StatTile
            label="Projeção anual"
            value={formatCurrency(annualTotal)}
            helper="Custo mensal × 12"
            icon={TrendingUp}
            tone="neutral"
          />
          <StatTile
            label="Mensais ativos"
            value={`${mensalCount}`}
            helper={anualCount > 0 ? `+ ${anualCount} anual(is) cadastrado(s)` : "Custos recorrentes mensais"}
            icon={Repeat}
            tone="success"
          />
          <StatTile
            label="Pausados"
            value={`${inativos.length}`}
            helper={inativos.length > 0 ? "Não entram no total" : "Tudo ativo"}
            icon={AlertTriangle}
            tone={inativos.length > 0 ? "warning" : "neutral"}
          />
        </div>

        <FiltersBar
          search={search}
          onSearchChange={setSearch}
          status={statusFilter}
          onStatusChange={setStatusFilter}
          frequency={frequency}
          onFrequencyChange={setFrequency}
          sort={sort}
          onSortChange={setSort}
          onClear={clearFilters}
          activeCount={activeFilterCount}
        />

        {ativos.length > 0 ? (
          <CategoryQuickFilter rows={ativos} selected={categoryFilter} onSelect={setCategoryFilter} />
        ) : null}

        <CustosTable
          rows={pagedList}
          totalRows={totalRows}
          page={safePage}
          pageSize={pageSize}
          totalPages={totalPages}
          onPage={setPage}
          onPageSize={setPageSize}
          onToggle={handleToggle}
          onEdit={openEditDialog}
          onDelete={handleDelete}
          onEmptyCta={openCreateDialog}
        />
      </div>

      <LiaChat
        screenContext="Custos Fixos"
        pageData={`${ativos.length} custo(s) ativo(s) totalizando ${formatCurrency(monthlyTotal)}/mês. Projeção anual: ${formatCurrency(annualTotal)}. Mensais: ${mensalCount}. Anuais: ${anualCount}. Pausados: ${inativos.length}.`}
        quickPrompts={["Cadastra aluguel pra mim", "Quanto gasto de fixo por mês?", "Quais custos posso cortar?"]}
      />

      <CustoDialog
        open={dialogOpen}
        initial={editing}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        onSubmit={handleSubmit}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />
    </DashboardLayout>
  );
}
