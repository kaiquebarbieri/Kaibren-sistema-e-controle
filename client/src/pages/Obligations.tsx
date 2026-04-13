import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CreditCard,
  Landmark,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";

type AccountsSection = "payables" | "credit-cards" | "loans";
type DialogMode = AccountsSection | null;

type FormState = {
  cnpjId: string;
  title: string;
  amount: string;
  dueDate: string;
  notes: string;
  secondaryValue: string;
  installments: string;
};

type CnpjOption = {
  id: string;
  name: string;
  cnpj: string;
};

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

function toCurrency(value: number | string | null | undefined): string {
  const parsed = Number(value || 0);
  return parsed.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeDate(value: string | number | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function differenceInDays(target: Date) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((end - start) / 86400000);
}

function getStatusLabel(days: number | null) {
  if (days === null) return "Sem data";
  if (days < 0) return `Atrasado há ${Math.abs(days)} dia(s)`;
  if (days === 0) return "Vence hoje";
  return `Vence em ${days} dia(s)`;
}

function getDueBadge(days: number | null) {
  if (days === null) return { label: "Sem data", className: "border-muted-foreground/30 text-muted-foreground bg-muted/50" };
  if (days < 0) return { label: "Vencido", className: "animate-pulse border-red-500/50 bg-red-500/15 text-red-400" };
  if (days === 0) return { label: "Hoje", className: "border-red-500/50 bg-red-500/15 text-red-400" };
  if (days === 1) return { label: "Amanhã", className: "border-amber-500/50 bg-amber-500/15 text-amber-400" };
  if (days <= 7) return { label: `${days} dias`, className: "border-amber-500/50 bg-amber-500/15 text-amber-400" };
  return { label: "Em dia", className: "border-emerald-500/50 bg-emerald-500/15 text-emerald-400" };
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

function getSectionMeta(section: AccountsSection) {
  const map = {
    payables: {
      label: "Contas a Pagar",
      description: "Boletos, fornecedores, despesas, contas vencidas e próximos vencimentos.",
      icon: Receipt,
      accent: "from-rose-500 via-pink-500 to-orange-400",
      button: "Nova conta a pagar",
      empty: "Nenhuma conta a pagar cadastrada neste período.",
      badge: "Conta",
      metricTitle: "Total em contas",
      helperTitle: "Controle de vencimentos",
      helperText: "Este menu mostra somente contas a pagar, datas e alertas de atraso.",
    },
    "credit-cards": {
      label: "Cartão de Crédito",
      description: "Limites, vencimentos, fechamento, faturas e parcelas em acompanhamento diário.",
      icon: CreditCard,
      accent: "from-sky-500 via-blue-500 to-indigo-500",
      button: "Novo cartão",
      empty: "Nenhum cartão cadastrado.",
      badge: "Cartão",
      metricTitle: "Limite monitorado",
      helperTitle: "Controle de cartões",
      helperText: "Este menu mostra somente cartões, limite, banco, fechamento e vencimento da fatura.",
    },
    loans: {
      label: "Empréstimos",
      description: "Saldo total, parcelas, vencimentos e contratos ativos para controle gerencial.",
      icon: Landmark,
      accent: "from-amber-500 via-orange-500 to-rose-500",
      button: "Novo empréstimo",
      empty: "Nenhum empréstimo cadastrado.",
      badge: "Empréstimo",
      metricTitle: "Saldo monitorado",
      helperTitle: "Controle de contratos",
      helperText: "Este menu mostra somente empréstimos, parcelas, instituição e saldo contratado.",
    },
  } satisfies Record<AccountsSection, {
    label: string;
    description: string;
    icon: any;
    accent: string;
    button: string;
    empty: string;
    badge: string;
    metricTitle: string;
    helperTitle: string;
    helperText: string;
  }>;

  return map[section];
}

function MetricCard({ title, value, helper, index = 0 }: { title: string; value: string; helper: string; index?: number }) {
  return (
    <motion.div custom={index} variants={cardVariants} initial="hidden" animate="visible">
      <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
        <CardContent className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{helper}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AccountsRow({
  title,
  subtitle,
  amount,
  badge,
  days,
  onDelete,
  index = 0,
}: {
  title: string;
  subtitle: string;
  amount: string;
  badge: string;
  days: number | null;
  onDelete?: () => void;
  index?: number;
}) {
  const dueBadge = getDueBadge(days);
  return (
    <motion.div custom={index} variants={cardVariants} initial="hidden" animate="visible">
      <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm transition-colors hover:bg-card/80">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="w-fit">{badge}</Badge>
              <Badge variant="outline" className={`w-fit ${dueBadge.className}`}>{dueBadge.label}</Badge>
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight text-foreground">{title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 xl:items-end">
            <span className="text-lg font-semibold tracking-tight text-foreground">R$ {amount}</span>
            {onDelete ? (
              <Button variant="destructive" size="sm" onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
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
  const [form, setForm] = useState<FormState>({
    cnpjId: defaultCnpjId ?? "",
    title: "",
    amount: "",
    dueDate: formatDate(new Date()),
    notes: "",
    secondaryValue: "",
    installments: "1",
  });

  const meta = mode ? getSectionMeta(mode) : null;
  const isCard = mode === "credit-cards";
  const isLoan = mode === "loans";

  useEffect(() => {
    setForm((current) => ({
      ...current,
      cnpjId: current.cnpjId || defaultCnpjId || cnpjs[0]?.id || "",
    }));
  }, [defaultCnpjId, cnpjs]);

  async function handleSubmit() {
    if (!form.cnpjId) {
      toast.error("Selecione o CNPJ do cadastro.");
      return;
    }

    if (!form.title || !form.amount) {
      toast.error("Preencha pelo menos nome e valor.");
      return;
    }

    await onSubmit(form);
    setForm({
      cnpjId: defaultCnpjId ?? cnpjs[0]?.id ?? "",
      title: "",
      amount: "",
      dueDate: formatDate(new Date()),
      notes: "",
      secondaryValue: "",
      installments: "1",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/50 bg-card sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{meta ? meta.button : "Novo cadastro"}</DialogTitle>
          <DialogDescription>
            O cadastro salva diretamente no menu ativo e mantém o controle separado por categoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>CNPJ do cadastro</Label>
            <Select value={form.cnpjId} onValueChange={(value) => setForm((current) => ({ ...current, cnpjId: value }))}>
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

          <div className="space-y-2">
            <Label>{isCard ? "Nome do cartão" : isLoan ? "Nome do empréstimo" : "Título da conta"}</Label>
            <Input
              className="border-border/50 bg-card"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={isCard ? "Ex.: Cartão Santander" : isLoan ? "Ex.: Capital de giro" : "Ex.: Boleto do fornecedor"}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{isCard ? "Limite" : isLoan ? "Valor total" : "Valor"}</Label>
              <Input
                className="border-border/50 bg-card"
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>{isCard ? "Vencimento" : "Data de referência"}</Label>
              <Input
                className="border-border/50 bg-card"
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
              />
            </div>
          </div>

          {(isCard || isLoan) ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{isCard ? "Fechamento ou fatura atual" : "Parcela"}</Label>
                <Input
                  className="border-border/50 bg-card"
                  value={form.secondaryValue}
                  onChange={(event) => setForm((current) => ({ ...current, secondaryValue: event.target.value }))}
                  placeholder={isCard ? "Ex.: Fecha dia 25 / fatura 1.980,00" : "Ex.: 1.250,00"}
                />
              </div>
              <div className="space-y-2">
                <Label>{isCard ? "Compras / parcelas" : "Quantidade de parcelas"}</Label>
                <Input
                  className="border-border/50 bg-card"
                  value={form.installments}
                  onChange={(event) => setForm((current) => ({ ...current, installments: event.target.value }))}
                  placeholder={isCard ? "Ex.: 8 compras / 3 parcelas" : "12"}
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              className="border-border/50 bg-card"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Detalhes opcionais para deixar a leitura do controle mais clara"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionMenu({
  sections,
  activeSection,
  onNavigate,
  counts,
}: {
  sections: AccountsSection[];
  activeSection: AccountsSection;
  onNavigate: (section: AccountsSection) => void;
  counts: Record<AccountsSection, number>;
}) {
  return (
    <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
          <WalletCards className="h-5 w-5 text-primary" />
          Contas
        </CardTitle>
        <CardDescription>
          Cada submenu abre uma área própria, sem misturar cartões, empréstimos e contas a pagar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sections.map((section, i) => {
          const meta = getSectionMeta(section);
          const Icon = meta.icon;
          const isActive = activeSection === section;
          return (
            <motion.div key={section} custom={i} variants={cardVariants} initial="hidden" animate="visible">
              <button
                onClick={() => onNavigate(section)}
                className={`w-full rounded-2xl border p-4 text-left shadow-sm transition-all ${isActive ? "border-primary/50 bg-primary/10 text-foreground ring-1 ring-primary/20" : "border-border/50 bg-card hover:-translate-y-0.5 hover:shadow-md"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${isActive ? "text-primary" : "text-muted-foreground"}`}>Menu</p>
                    <p className="mt-3 text-lg font-semibold tracking-tight">{meta.label}</p>
                    <p className={`mt-2 text-sm leading-6 ${isActive ? "text-muted-foreground" : "text-muted-foreground"}`}>{meta.description}</p>
                  </div>
                  <div className={`rounded-2xl p-3 ${isActive ? "bg-primary/15" : "bg-muted"}`}>
                    <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                  </div>
                </div>
                <div className="mt-4 text-sm font-medium">{counts[section]} item(ns) visíveis</div>
              </button>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function EventRow({
  entry,
  badgeLabel,
  index = 0,
}: {
  entry: { id: number; title: string; subtitle: string; amount: number; dueDate: Date | null; days: number | null };
  badgeLabel: string;
  index?: number;
}) {
  const dueBadge = getDueBadge(entry.days);
  return (
    <motion.div key={entry.id} custom={index} variants={cardVariants} initial="hidden" animate="visible">
      <div className="rounded-2xl border border-border/50 bg-card p-4 transition-colors hover:bg-card/80">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{badgeLabel}</Badge>
              <Badge variant="outline" className={dueBadge.className}>{dueBadge.label}</Badge>
            </div>
            <p className="mt-3 text-base font-semibold tracking-tight text-foreground">{entry.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{entry.subtitle}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tracking-tight text-foreground">R$ {toCurrency(entry.amount)}</p>
            <p className="text-xs text-muted-foreground">{entry.dueDate ? entry.dueDate.toLocaleDateString("pt-BR") : "Sem data informada"}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TotalBanner({ label, total, accent }: { label: string; total: number; accent: string }) {
  return (
    <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
      <div className={`rounded-2xl bg-gradient-to-r ${accent} p-[1px]`}>
        <div className="flex items-center justify-between rounded-2xl bg-card px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">R$ {toCurrency(total)}</p>
          </div>
          <div className={`rounded-2xl bg-gradient-to-br ${accent} p-3`}>
            <AlertTriangle className="h-5 w-5 text-white" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ObligationsSectionView({
  section,
  selectedMonth,
  selectedYear,
  payables,
  creditCards,
  loans,
  payableTotal,
  creditLimitTotal,
  loanTotal,
  dueSoonPayables,
  overduePayables,
  onRefresh,
  onOpenDialog,
  onDelete,
}: {
  section: AccountsSection;
  selectedMonth: number;
  selectedYear: number;
  payables: any[];
  creditCards: any[];
  loans: any[];
  payableTotal: number;
  creditLimitTotal: number;
  loanTotal: number;
  dueSoonPayables: number;
  overduePayables: number;
  onRefresh: () => Promise<void>;
  onOpenDialog: (section: AccountsSection) => void;
  onDelete: (section: AccountsSection, id: number) => Promise<void>;
}) {
  const meta = getSectionMeta(section);
  const Icon = meta.icon;

  const payablesEvents = payables
    .map((item: any) => {
      const dueDate = normalizeDate(item.dueDate);
      return {
        id: Number(item.id),
        title: item.title || item.description || item.supplier || "Conta a pagar",
        subtitle: item.notes || item.supplier || "Sem observações",
        amount: Number(item.amount || 0),
        dueDate,
        days: dueDate ? differenceInDays(dueDate) : null,
      };
    })
    .sort((a, b) => {
      if (a.days === null && b.days === null) return 0;
      if (a.days === null) return 1;
      if (b.days === null) return -1;
      return a.days - b.days;
    })
    .slice(0, 6);

  const creditCardEvents = creditCards
    .map((item: any) => ({
      id: Number(item.id),
      title: item.name || "Cartão",
      subtitle: `${item.bankName || item.brand || "Banco não informado"} • fechamento ${item.closingDay || 1} / vencimento ${item.dueDay || 10}`,
      amount: Number(item.limitAmount || item.creditLimit || 0),
      dueDate: normalizeDate(item.nextDueDate || item.updatedAt),
      days: normalizeDate(item.nextDueDate || item.updatedAt) ? differenceInDays(normalizeDate(item.nextDueDate || item.updatedAt) as Date) : null,
    }))
    .slice(0, 6);

  const loanEvents = loans
    .map((item: any) => ({
      id: Number(item.id),
      title: item.name || "Empréstimo",
      subtitle: `${item.institution || "Instituição não informada"} • parcelas ${item.totalInstallments || 1}`,
      amount: Number(item.amount || item.totalAmount || 0),
      dueDate: normalizeDate(item.nextDueDate || item.startDate),
      days: normalizeDate(item.nextDueDate || item.startDate) ? differenceInDays(normalizeDate(item.nextDueDate || item.startDate) as Date) : null,
    }))
    .slice(0, 6);

  if (section === "credit-cards") {
    return (
      <div className="space-y-6">
        <TotalBanner label="Limite total monitorado" total={creditLimitTotal} accent={meta.accent} />

        <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-2xl tracking-tight">
                    <div className={`rounded-2xl bg-gradient-to-br p-3 text-white ${meta.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {meta.label}
                  </CardTitle>
                  <CardDescription className="mt-2 text-sm leading-6">{meta.description}</CardDescription>
                </div>
                <Badge variant="outline" className="border-border/50">{MONTHS[selectedMonth - 1]} {selectedYear}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard index={2} title="Cartões ativos" value={`${creditCards.length}`} helper="Quantidade de cartões acompanhados neste menu." />
                <MetricCard index={3} title="Limite total" value={`R$ ${toCurrency(creditLimitTotal)}`} helper="Soma dos limites cadastrados apenas para cartões." />
                <MetricCard index={4} title="Fechamento e vencimento" value="Faturas" helper="Acompanhe datas de fechamento e pagamento sem misturar com outras contas." />
              </div>
              <div className="rounded-2xl border border-dashed border-border/50 bg-background/70 p-4">
                <p className="text-sm font-medium text-foreground">{meta.helperTitle}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{meta.helperText}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button onClick={() => onOpenDialog(section)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {meta.button}
                  </Button>
                  <Button variant="outline" onClick={() => onRefresh()}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Recarregar dados
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={5} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
                <CalendarClock className="h-5 w-5 text-primary" />
                Agenda de cartões e faturas
              </CardTitle>
              <CardDescription>
                Aqui aparecem somente cartões, bancos, limites e referências de fechamento ou vencimento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {creditCardEvents.length > 0 ? creditCardEvents.map((entry, i) => (
                <EventRow key={entry.id} entry={entry} badgeLabel="Cartão de Crédito" index={6 + i} />
              )) : (
                <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  {meta.empty}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={12} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Listagem de cartões</CardTitle>
              <CardDescription>Somente itens de cartão de crédito aparecem nesta área.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {creditCards.length > 0 ? creditCards.map((item: any, i: number) => {
                const dueDate = normalizeDate(item.nextDueDate || item.updatedAt);
                const days = dueDate ? differenceInDays(dueDate) : null;
                return (
                  <AccountsRow
                    key={item.id}
                    index={13 + i}
                    title={item.name || "Cartão"}
                    subtitle={`${item.bankName || item.brand || "Banco não informado"} • fechamento ${item.closingDay || 1} / vencimento ${item.dueDay || 10}`}
                    amount={toCurrency(item.limitAmount || item.creditLimit)}
                    badge="Cartão de Crédito"
                    days={days}
                    onDelete={() => onDelete("credit-cards", Number(item.id))}
                  />
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  {meta.empty}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (section === "loans") {
    return (
      <div className="space-y-6">
        <TotalBanner label="Saldo total monitorado" total={loanTotal} accent={meta.accent} />

        <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-2xl tracking-tight">
                    <div className={`rounded-2xl bg-gradient-to-br p-3 text-white ${meta.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {meta.label}
                  </CardTitle>
                  <CardDescription className="mt-2 text-sm leading-6">{meta.description}</CardDescription>
                </div>
                <Badge variant="outline" className="border-border/50">{MONTHS[selectedMonth - 1]} {selectedYear}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard index={2} title="Contratos ativos" value={`${loans.length}`} helper="Quantidade de empréstimos acompanhados neste menu." />
                <MetricCard index={3} title="Saldo total" value={`R$ ${toCurrency(loanTotal)}`} helper="Soma dos valores cadastrados somente para empréstimos." />
                <MetricCard index={4} title="Parcelas" value="Acompanhamento" helper="Controle separado de contratos, parcelas e instituição financeira." />
              </div>
              <div className="rounded-2xl border border-dashed border-border/50 bg-background/70 p-4">
                <p className="text-sm font-medium text-foreground">{meta.helperTitle}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{meta.helperText}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button onClick={() => onOpenDialog(section)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {meta.button}
                  </Button>
                  <Button variant="outline" onClick={() => onRefresh()}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Recarregar dados
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={5} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
                <CalendarClock className="h-5 w-5 text-primary" />
                Agenda de contratos e parcelas
              </CardTitle>
              <CardDescription>
                Aqui aparecem somente empréstimos, instituições, parcelas e datas relacionadas ao contrato.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loanEvents.length > 0 ? loanEvents.map((entry, i) => (
                <EventRow key={entry.id} entry={entry} badgeLabel="Empréstimos" index={6 + i} />
              )) : (
                <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  {meta.empty}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={12} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Listagem de empréstimos</CardTitle>
              <CardDescription>Somente itens de empréstimos aparecem nesta área.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loans.length > 0 ? loans.map((item: any, i: number) => {
                const dueDate = normalizeDate(item.nextDueDate || item.startDate);
                const days = dueDate ? differenceInDays(dueDate) : null;
                return (
                  <AccountsRow
                    key={item.id}
                    index={13 + i}
                    title={item.name || "Empréstimo"}
                    subtitle={`${item.institution || "Instituição não informada"} • parcelas ${item.totalInstallments || 1}`}
                    amount={toCurrency(item.amount || item.totalAmount)}
                    badge="Empréstimos"
                    days={days}
                    onDelete={() => onDelete("loans", Number(item.id))}
                  />
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  {meta.empty}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TotalBanner label="Total a pagar no período" total={payableTotal} accent={meta.accent} />

      <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible">
        <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-3 text-2xl tracking-tight">
                  <div className={`rounded-2xl bg-gradient-to-br p-3 text-white ${meta.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {meta.label}
                </CardTitle>
                <CardDescription className="mt-2 text-sm leading-6">{meta.description}</CardDescription>
              </div>
              <Badge variant="outline" className="border-border/50">{MONTHS[selectedMonth - 1]} {selectedYear}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard index={2} title="Contas no período" value={`${payables.length}`} helper="Quantidade de contas a pagar visíveis neste menu." />
              <MetricCard index={3} title="Valor total" value={`R$ ${toCurrency(payableTotal)}`} helper="Soma das contas a pagar cadastradas no período selecionado." />
              <MetricCard index={4} title="Alertas" value={`${overduePayables + dueSoonPayables}`} helper={`${overduePayables} atrasada(s) e ${dueSoonPayables} com vencimento em até 7 dias.`} />
            </div>
            <div className="rounded-2xl border border-dashed border-border/50 bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">{meta.helperTitle}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{meta.helperText}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button onClick={() => onOpenDialog(section)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {meta.button}
                </Button>
                <Button variant="outline" onClick={() => onRefresh()}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Recarregar dados
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div custom={5} variants={cardVariants} initial="hidden" animate="visible">
        <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
              <CalendarClock className="h-5 w-5 text-primary" />
              Próximos vencimentos de contas a pagar
            </CardTitle>
            <CardDescription>
              Aqui aparecem somente vencimentos e movimentos ligados a contas a pagar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {payablesEvents.length > 0 ? payablesEvents.map((entry, i) => (
              <EventRow key={entry.id} entry={entry} badgeLabel="Contas a Pagar" index={6 + i} />
            )) : (
              <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                {meta.empty}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div custom={12} variants={cardVariants} initial="hidden" animate="visible">
        <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Listagem de contas a pagar</CardTitle>
            <CardDescription>Somente itens de contas a pagar aparecem nesta área.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {payables.length > 0 ? payables.map((item: any, i: number) => {
              const dueDate = normalizeDate(item.dueDate);
              const days = dueDate ? differenceInDays(dueDate) : null;
              return (
                <AccountsRow
                  key={item.id}
                  index={13 + i}
                  title={item.title || item.description || item.supplier || "Conta a pagar"}
                  subtitle={`${item.notes || item.supplier || "Sem observações"} • vencimento ${dueDate ? dueDate.toLocaleDateString("pt-BR") : "não informado"}`}
                  amount={toCurrency(item.amount)}
                  badge="Contas a Pagar"
                  days={days}
                  onDelete={() => onDelete("payables", Number(item.id))}
                />
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                {meta.empty}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function Obligations() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [, contasParams] = useRoute<{ tab?: string }>("/contas/:tab");
  const [, obrigacoesParams] = useRoute<{ tab?: string }>("/obrigacoes/:tab");
  const routeTab = contasParams?.tab ?? obrigacoesParams?.tab;
  const now = new Date();
  const [selectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear] = useState(now.getFullYear());
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<AccountsSection>(getSectionFromRoute(routeTab));

  useEffect(() => {
    setActiveSection(getSectionFromRoute(routeTab));
  }, [routeTab]);

  const cnpjsQuery = trpc.myCnpjs.list.useQuery();
  const cnpjs = (cnpjsQuery.data ?? []).map((item: any) => ({
    id: String(item.id),
    name: item.nomeFantasia || item.razaoSocial || `CNPJ ${item.id}`,
    cnpj: item.cnpj,
  }));
  const fallbackCnpjId = cnpjs[0]?.id ? Number(cnpjs[0].id) : undefined;

  const payablesQuery = trpc.finance.payables.list.useQuery(
    fallbackCnpjId ? { year: selectedYear, month: selectedMonth, cnpjId: fallbackCnpjId } : { year: selectedYear, month: selectedMonth },
    { enabled: true },
  );
  const creditCardsQuery = trpc.finance.creditCards.list.useQuery(
    fallbackCnpjId ? { cnpjId: fallbackCnpjId } : { cnpjId: 1 },
    { enabled: Boolean(fallbackCnpjId) },
  );
  const loansQuery = trpc.finance.loans.list.useQuery(
    fallbackCnpjId ? { cnpjId: fallbackCnpjId } : { cnpjId: 1 },
    { enabled: Boolean(fallbackCnpjId) },
  );

  const createPayableMutation = trpc.finance.payables.create.useMutation();
  const deletePayableMutation = trpc.finance.payables.delete.useMutation();
  const createCreditCardMutation = trpc.finance.creditCards.create.useMutation();
  const deleteCreditCardMutation = trpc.finance.creditCards.delete.useMutation();
  const createLoanMutation = trpc.finance.loans.create.useMutation();
  const deleteLoanMutation = trpc.finance.loans.delete.useMutation();

  const payables = payablesQuery.data ?? [];
  const creditCards = creditCardsQuery.data ?? [];
  const loans = loansQuery.data ?? [];
  const sections: AccountsSection[] = ["payables", "credit-cards", "loans"];

  const payableTotal = payables.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const creditLimitTotal = creditCards.reduce((sum: number, item: any) => sum + Number(item.limitAmount || item.creditLimit || 0), 0);
  const loanTotal = loans.reduce((sum: number, item: any) => sum + Number(item.amount || item.totalAmount || 0), 0);

  const dueSoonPayables = payables.filter((item: any) => {
    const dueDate = normalizeDate(item.dueDate);
    const days = dueDate ? differenceInDays(dueDate) : null;
    return days !== null && days >= 0 && days <= 7;
  }).length;

  const overduePayables = payables.filter((item: any) => {
    const dueDate = normalizeDate(item.dueDate);
    const days = dueDate ? differenceInDays(dueDate) : null;
    return days !== null && days < 0;
  }).length;

  const menuCounts = useMemo<Record<AccountsSection, number>>(() => ({
    payables: payables.length,
    "credit-cards": creditCards.length,
    loans: loans.length,
  }), [payables.length, creditCards.length, loans.length]);

  async function refreshAll() {
    await Promise.all([
      payablesQuery.refetch(),
      creditCardsQuery.refetch(),
      loansQuery.refetch(),
    ]);
  }

  function navigateToSection(section: AccountsSection) {
    setActiveSection(section);
    navigate(getSectionHref(section));
  }

  async function handleCreate(payload: FormState) {
    if (!dialogMode) return;
    if (!fallbackCnpjId) {
      toast.error("Cadastre ao menos um CNPJ para usar este módulo.");
      return;
    }

    const selectedCnpjId = Number(payload.cnpjId);

    if (dialogMode === "payables") {
      await createPayableMutation.mutateAsync({
        cnpjId: selectedCnpjId,
        title: payload.title,
        supplier: payload.title,
        amount: payload.amount,
        dueDate: payload.dueDate,
        category: "financeiro",
        notes: payload.notes || null,
      });
      toast.success("Conta a pagar salva e exibida no controle.");
    }

    if (dialogMode === "credit-cards") {
      await createCreditCardMutation.mutateAsync({
        cnpjId: selectedCnpjId,
        name: payload.title,
        brand: payload.notes || payload.secondaryValue || "outros",
        closingDay: 1,
        dueDay: 10,
        creditLimit: payload.amount,
        notes: [payload.secondaryValue, payload.installments, payload.notes].filter(Boolean).join(" • ") || null,
      });
      toast.success("Cartão salvo e exibido no controle.");
    }

    if (dialogMode === "loans") {
      await createLoanMutation.mutateAsync({
        cnpjId: selectedCnpjId,
        name: payload.title,
        institution: payload.notes || "Instituição não informada",
        totalAmount: payload.amount,
        startDate: payload.dueDate,
        loanType: "installment",
        totalInstallments: Number(payload.installments || 1),
      });
      toast.success("Empréstimo salvo e exibido no controle.");
    }

    await refreshAll();
    setDialogOpen(false);
    setDialogMode(null);
  }

  async function handleDelete(section: AccountsSection, id: number) {
    const confirmed = window.confirm("Deseja realmente excluir este item?");
    if (!confirmed) return;

    if (section === "payables") await deletePayableMutation.mutateAsync({ id });
    if (section === "credit-cards") await deleteCreditCardMutation.mutateAsync({ id });
    if (section === "loans") await deleteLoanMutation.mutateAsync({ id });

    toast.success("Item excluído com sucesso.");
    await refreshAll();
  }

  if (!user) return null;

  return (
    <DashboardLayout activeSection="contas" onNavigate={(section) => navigate(section === "dashboard" ? "/" : `/${section}`)}>
      <div className="space-y-6">
        <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="overflow-hidden rounded-2xl border-border/50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-xl">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl space-y-3">
                  <Badge variant="secondary" className="w-fit bg-white/10 text-white hover:bg-white/10">Contas</Badge>
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight">Dashboard de Contas para análise e controle</h1>
                    <p className="mt-2 text-sm leading-6 text-white/75">
                      Cada submenu agora abre sua própria área de controle. Contas a Pagar, Cartão de Crédito e Empréstimos ficaram separados para evitar mistura de informações.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => { setDialogMode(activeSection); setDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    {getSectionMeta(activeSection).button}
                  </Button>
                  <Button variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => refreshAll()}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Atualizar tela
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <ObligationsSectionView
          section={activeSection}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          payables={payables}
          creditCards={creditCards}
          loans={loans}
          payableTotal={payableTotal}
          creditLimitTotal={creditLimitTotal}
          loanTotal={loanTotal}
          dueSoonPayables={dueSoonPayables}
          overduePayables={overduePayables}
          onRefresh={refreshAll}
          onOpenDialog={(section) => {
            setDialogMode(section);
            setDialogOpen(true);
          }}
          onDelete={handleDelete}
        />
      </div>

      <AccountsDialog
        open={dialogOpen}
        mode={dialogMode}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setDialogMode(null);
        }}
        onSubmit={handleCreate}
        isSaving={createPayableMutation.isPending || createCreditCardMutation.isPending || createLoanMutation.isPending}
        cnpjs={cnpjs}
        defaultCnpjId={cnpjs[0]?.id}
      />
    </DashboardLayout>
  );
}
