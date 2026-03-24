import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Landmark,
  PieChart,
  Plus,
  Receipt,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  Wallet,
} from "lucide-react";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

type ObligationsTab = "contas" | "cartoes" | "emprestimos";
type ObligationDialogMode = "conta" | "custoFixo" | "cartao" | "fatura" | "emprestimo" | "retencao";

type SavedPayable = {
  id?: number;
  cnpjId?: number | null;
  title?: string | null;
  description?: string | null;
  supplier?: string | null;
};

const obligationDialogMeta: Record<ObligationDialogMode, { title: string; description: string }> = {
  conta: {
    title: "Cadastrar conta a pagar",
    description: "Lance boletos, fornecedores e despesas previstas para manter o controle operacional do mês.",
  },
  custoFixo: {
    title: "Cadastrar custo fixo",
    description: "Registre uma despesa recorrente para acompanhar o impacto mensal no caixa e nas obrigações.",
  },
  cartao: {
    title: "Cadastrar cartão",
    description: "Adicione um cartão de crédito com limite, banco emissor e dia de vencimento para acompanhar exposição futura.",
  },
  fatura: {
    title: "Cadastrar fatura",
    description: "Lance a fatura do cartão já existente para acompanhar vencimento, fechamento e valor do período.",
  },
  emprestimo: {
    title: "Cadastrar empréstimo",
    description: "Cadastre empréstimos e passivos para acompanhar saldo contratado, amortização e pressão sobre o caixa.",
  },
  retencao: {
    title: "Cadastrar retenção",
    description: "Registre retenções ou abatimentos ligados a empréstimos para enxergar o avanço real dos descontos.",
  },
};

function fmt(v: number | string | null | undefined): string {
  const n = parseFloat(String(v || "0"));
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toPercent(value: number): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function BarRow({ label, amount, total, tone = "rose" }: { label: string; amount: number; total: number; tone?: "rose" | "emerald" | "sky" | "amber" }) {
  const percent = total > 0 ? Math.min((amount / total) * 100, 100) : 0;
  const toneClass = {
    rose: "bg-rose-500",
    emerald: "bg-emerald-500",
    sky: "bg-sky-500",
    amber: "bg-amber-500",
  }[tone];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">R$ {fmt(amount)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${toneClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function EmptyState({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          {actionLabel && onAction ? (
            <Button className="mt-4" onClick={onAction}>
              <Plus className="mr-2 h-4 w-4" />
              {actionLabel}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function FinanceHeader({
  selectedCnpjId,
  setSelectedCnpjId,
  cnpjs,
  selectedMonth,
  selectedYear,
  prevMonth,
  nextMonth,
  badge,
  title,
  description,
}: {
  selectedCnpjId: string;
  setSelectedCnpjId: (value: string) => void;
  cnpjs: any[];
  selectedMonth: number;
  selectedYear: number;
  prevMonth: () => void;
  nextMonth: () => void;
  badge: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="w-fit">{badge}</Badge>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:w-auto xl:flex xl:flex-none xl:items-center">
          <div className="min-w-0 w-full rounded-xl border bg-card px-3 py-2 shadow-sm md:min-w-[300px] xl:w-[360px]">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Subconta por CNPJ</Label>
            <Select value={selectedCnpjId} onValueChange={setSelectedCnpjId}>
              <SelectTrigger className="mt-1 border-0 px-0 shadow-none focus:ring-0">
                <SelectValue placeholder="Selecione a subconta" />
              </SelectTrigger>
              <SelectContent>
                {cnpjs.map((item: any) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {(item.nomeFantasia || item.razaoSocial)} • {item.cnpj}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-full items-center justify-between gap-2 rounded-xl border bg-card px-2 py-2 shadow-sm md:min-w-[260px] md:px-3 xl:w-[280px]">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-0 flex-1 text-center text-sm font-semibold leading-tight">{MONTHS[selectedMonth - 1]} {selectedYear}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button onClick={onClick} className="w-full min-w-0 rounded-xl sm:w-auto">
      <Plus className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}

function ObligationSpotlight({ eyebrow, title, description, accentClass, children }: { eyebrow: string; title: string; description: string; accentClass: string; children: React.ReactNode }) {
  return (
    <Card className={`overflow-hidden rounded-3xl border-0 text-white shadow-lg ${accentClass}`}>
      <CardContent className="relative pt-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.18),transparent_30%)]" />
        <div className="relative flex flex-col gap-6 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">{eyebrow}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-white/80">{description}</p>
          </div>
          <div className="grid w-full gap-3 sm:flex sm:flex-wrap 2xl:w-auto">{children}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightMetric({ label, value, helper, tone = "neutral", icon }: { label: string; value: string; helper: string; tone?: "neutral" | "danger" | "warning" | "success" | "info"; icon?: React.ReactNode }) {
  const toneClasses = {
    neutral: "border-border/70 bg-card",
    danger: "border-rose-200 bg-rose-50/80",
    warning: "border-amber-200 bg-amber-50/80",
    success: "border-emerald-200 bg-emerald-50/80",
    info: "border-sky-200 bg-sky-50/80",
  }[tone];

  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${toneClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{helper}</p>
        </div>
        {icon ? <div className="rounded-2xl bg-background/80 p-2 text-foreground shadow-sm">{icon}</div> : null}
      </div>
    </div>
  );
}

function ObligationListItem({ title, subtitle, badge, amount, accentClass }: { title: string; subtitle: string; badge: React.ReactNode; amount: string; accentClass: string }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border bg-card/95 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute inset-y-0 left-0 w-1.5 ${accentClass}`} />
      <div className="ml-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="font-medium tracking-tight">{title}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {badge}
          <span className="text-base font-semibold tracking-tight">{amount}</span>
        </div>
      </div>
    </div>
  );
}

function ObligationDialog({
  open,
  mode,
  onOpenChange,
  cnpjs,
  creditCards,
  loans,
  selectedYear,
  selectedMonth,
  activeCnpjId,
  editingPayable,
  onSaved,
}: {
  open: boolean;
  mode: ObligationDialogMode | null;
  onOpenChange: (open: boolean) => void;
  cnpjs: any[];
  creditCards: any[];
  loans: any[];
  selectedYear: number;
  selectedMonth: number;
  activeCnpjId: string;
  editingPayable?: any | null;
  onSaved: (savedPayable?: SavedPayable | null) => void;
}) {
  const utils = trpc.useUtils();
  const today = ymd(new Date());
  const [description, setDescription] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("financeiro");
  const [notes, setNotes] = useState("");
  const [recurrence, setRecurrence] = useState("monthly");
  const [cardName, setCardName] = useState("");
  const [bankName, setBankName] = useState("");
  const [closingDay, setClosingDay] = useState("1");
  const [dueDay, setDueDay] = useState("10");
  const [limitAmount, setLimitAmount] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string>("none");
  const [invoiceLabel, setInvoiceLabel] = useState("");
  const [loanName, setLoanName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [loanType, setLoanType] = useState<"installment" | "sales_retention">("installment");
  const [remainingAmount, setRemainingAmount] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("1");
  const [selectedLoanId, setSelectedLoanId] = useState<string>("none");
  const [entryDate, setEntryDate] = useState("");

  const activeCnpj = useMemo(
    () => cnpjs.find((item: any) => String(item.id) === activeCnpjId) ?? null,
    [cnpjs, activeCnpjId],
  );

  useEffect(() => {
    if (!open) return;

    if (editingPayable) {
      setDescription(editingPayable.title || editingPayable.description || "");
      setCounterparty(editingPayable.supplier || "");
      setAmount(String(editingPayable.amount || ""));
      setDueDate(String(editingPayable.dueDate || ""));
      setCategory(String(editingPayable.category || "financeiro"));
      setNotes(String(editingPayable.notes || ""));
      return;
    }

    setDescription("");
    setCounterparty("");
    setAmount("");
    setDueDate("");
    setCategory("financeiro");
    setNotes("");
    setRecurrence("monthly");
    setCardName("");
    setBankName("");
    setClosingDay("1");
    setDueDay("10");
    setLimitAmount("");
    setSelectedCardId(creditCards[0] ? String(creditCards[0].id) : "none");
    setInvoiceLabel("");
    setLoanName("");
    setInstitutionName("");
    setLoanType("installment");
    setRemainingAmount("");
    setTotalInstallments("1");
    setSelectedLoanId(loans[0] ? String(loans[0].id) : "none");
    setEntryDate("");
  }, [open, editingPayable, creditCards, loans]);

  const listInput = {
    year: selectedYear,
    month: selectedMonth,
    cnpjId: Number(activeCnpjId),
  };
  const dashboardInput = {
    referenceDate: today,
    year: selectedYear,
    month: selectedMonth,
    cnpjId: Number(activeCnpjId),
  };

  function upsertPayableInCache(payable: Record<string, any>) {
    utils.finance.payables.list.setData(listInput, (current) => {
      const items = Array.isArray(current) ? [...current] as Array<Record<string, any>> : [];
      const index = items.findIndex((item) => item.id === payable.id);
      if (index >= 0) {
        items[index] = { ...items[index], ...payable };
      } else {
        items.unshift(payable);
      }
      return items as any;
    });
  }

  async function refreshAfterSave(savedPayable?: SavedPayable | null) {
    await Promise.all([
      utils.finance.payables.list.invalidate(listInput),
      utils.finance.payables.dashboard.invalidate(dashboardInput),
      utils.finance.fixedCosts.payments.invalidate({ year: selectedYear, month: selectedMonth, cnpjId: Number(activeCnpjId) }),
      utils.finance.creditCards.list.invalidate({ cnpjId: Number(activeCnpjId) }),
      utils.finance.creditCards.invoices.invalidate({ year: selectedYear, month: selectedMonth, cnpjId: Number(activeCnpjId) }),
      utils.finance.loans.list.invalidate({ cnpjId: Number(activeCnpjId) }),
      utils.finance.loans.installments.invalidate({ year: selectedYear, month: selectedMonth, cnpjId: Number(activeCnpjId) }),
      utils.finance.loans.retentionEntries.invalidate({ year: selectedYear, month: selectedMonth, cnpjId: Number(activeCnpjId) }),
      utils.finance.dre.invalidate({ year: selectedYear, month: selectedMonth, cnpjId: Number(activeCnpjId) }),
    ]);
    onSaved(savedPayable ?? null);
    onOpenChange(false);
  }

  const createPayableMutation = trpc.finance.payables.create.useMutation();
  const updatePayableMutation = trpc.finance.payables.update.useMutation();
  const deletePayableMutation = trpc.finance.payables.delete.useMutation();
  const createFixedCostMutation = trpc.finance.fixedCosts.create.useMutation();
  const createCreditCardMutation = trpc.finance.creditCards.create.useMutation();
  const createCreditCardInvoiceMutation = trpc.finance.creditCards.upsertInvoice.useMutation();
  const createLoanMutation = trpc.finance.loans.create.useMutation();
  const createRetentionMutation = trpc.finance.loans.createRetentionEntry.useMutation();

  async function handleSubmit() {
    if (!mode) return;
    if (!activeCnpj) {
      toast.error("Selecione uma subconta de CNPJ antes de continuar.");
      return;
    }

    if (mode === "conta") {
      if (!description || !amount || !dueDate) {
        toast.error("Preencha descrição, valor e vencimento.");
        return;
      }

      const payload = {
        cnpjId: Number(activeCnpjId),
        title: description,
        supplier: counterparty || null,
        category,
        accountType: "boleto" as const,
        amount,
        dueDate,
        description: description || null,
        notes: notes || null,
      };

      if (editingPayable?.id) {
        await updatePayableMutation.mutateAsync({ id: editingPayable.id, ...payload });
        const updated = { ...editingPayable, ...payload };
        upsertPayableInCache(updated);
        toast.success("Conta a pagar atualizada.");
        await refreshAfterSave(updated);
        return;
      }

      const created = await createPayableMutation.mutateAsync(payload);
      const saved = { id: created?.id, ...payload };
      upsertPayableInCache(saved);
      toast.success("Conta a pagar cadastrada.");
      await refreshAfterSave(saved);
      return;
    }

    if (mode === "custoFixo") {
      if (!description || !amount) {
        toast.error("Preencha nome e valor do custo fixo.");
        return;
      }
      await createFixedCostMutation.mutateAsync({
        cnpjId: Number(activeCnpjId),
        name: description,
        category,
        amount,
        dueDay: dueDate ? Number(dueDate.slice(8, 10)) : 1,
        notes: notes || null,
      });
      toast.success("Custo fixo cadastrado.");
      await refreshAfterSave();
      return;
    }

    if (mode === "cartao") {
      if (!cardName || !bankName || !dueDay) {
        toast.error("Preencha nome do cartão, banco e dia de vencimento.");
        return;
      }
      await createCreditCardMutation.mutateAsync({
        cnpjId: Number(activeCnpjId),
        name: cardName,
        brand: bankName || "outros",
        lastFourDigits: null,
        closingDay: Number(closingDay || 1),
        dueDay: Number(dueDay),
        creditLimit: limitAmount || null,
        notes: notes || null,
      });
      toast.success("Cartão cadastrado.");
      await refreshAfterSave();
      return;
    }

    if (mode === "fatura") {
      if (selectedCardId === "none" || !amount) {
        toast.error("Selecione um cartão e informe o valor da fatura.");
        return;
      }
      await createCreditCardInvoiceMutation.mutateAsync({
        cardId: Number(selectedCardId),
        periodYear: selectedYear,
        periodMonth: selectedMonth,
        totalAmount: amount,
        minimumAmount: null,
        amountPaid: null,
        status: "pending",
        paidAt: null,
        notes: [invoiceLabel || null, dueDate ? `Vencimento: ${dueDate}` : null, entryDate ? `Fechamento: ${entryDate}` : null, notes || null].filter(Boolean).join(" | ") || null,
      });
      toast.success("Fatura cadastrada.");
      await refreshAfterSave();
      return;
    }

    if (mode === "emprestimo") {
      if (!loanName || !institutionName || !amount) {
        toast.error("Preencha nome, instituição e valor contratado do empréstimo.");
        return;
      }
      await createLoanMutation.mutateAsync({
        cnpjId: Number(activeCnpjId),
        name: loanName,
        institution: institutionName,
        loanType,
        totalAmount: amount,
        installmentAmount: loanType === "installment" ? amount : null,
        totalInstallments: loanType === "installment" ? Number(totalInstallments || 1) : null,
        interestRate: null,
        startDate: dueDate || today,
        dueDay: dueDate ? Number(dueDate.slice(8, 10)) : null,
        notes: [remainingAmount ? `Saldo em aberto informado: R$ ${remainingAmount}` : null, notes || null].filter(Boolean).join(" | ") || null,
      });
      toast.success("Empréstimo cadastrado.");
      await refreshAfterSave();
      return;
    }

    if (mode === "retencao") {
      if (selectedLoanId === "none" || !amount) {
        toast.error("Selecione um empréstimo e informe o valor da retenção.");
        return;
      }
      await createRetentionMutation.mutateAsync({
        loanId: Number(selectedLoanId),
        entryDate: entryDate || today,
        periodYear: selectedYear,
        periodMonth: selectedMonth,
        entryType: "manual",
        eventCategory: "abatimento_emprestimo",
        grossAmount: null,
        netAmount: null,
        retentionPercentApplied: null,
        retainedAmount: amount,
        sourceReference: description || "Retenção operacional",
        notes: notes || null,
      });
      toast.success("Retenção cadastrada.");
      await refreshAfterSave();
    }
  }

  const meta = mode ? obligationDialogMeta[mode] : null;
  const loading = createPayableMutation.isPending || updatePayableMutation.isPending || deletePayableMutation.isPending || createFixedCostMutation.isPending || createCreditCardMutation.isPending || createCreditCardInvoiceMutation.isPending || createLoanMutation.isPending || createRetentionMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{meta?.title ?? "Cadastro"}</DialogTitle>
          <DialogDescription>{meta?.description ?? "Preencha os dados para seguir."}</DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm">
          <p className="font-medium">Subconta ativa</p>
          <p className="mt-1 text-muted-foreground">
            {activeCnpj ? `${activeCnpj.nomeFantasia || activeCnpj.razaoSocial} • ${activeCnpj.cnpj}` : "Selecione um CNPJ na tela principal."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {(mode === "conta" || mode === "custoFixo") && (
            <>
              <div className="space-y-2">
                <Label>{mode === "conta" ? "Descrição" : "Nome do custo"}</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={mode === "conta" ? "Ex.: Boleto fornecedor" : "Ex.: Aluguel do galpão"} />
              </div>
              {mode === "conta" ? <div className="space-y-2"><Label>Fornecedor / favorecido</Label><Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Opcional" /></div> : null}
              <div className="space-y-2"><Label>Valor</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
              {mode === "conta" ? <div className="space-y-2"><Label>Vencimento</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div> : <div className="space-y-2"><Label>Recorrência</Label><Select value={recurrence} onValueChange={setRecurrence}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Mensal</SelectItem><SelectItem value="weekly">Semanal</SelectItem><SelectItem value="yearly">Anual</SelectItem></SelectContent></Select></div>}
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="financeiro, aluguel, energia..." />
              </div>
            </>
          )}

          {mode === "cartao" && (
            <>
              <div className="space-y-2"><Label>Nome do cartão</Label><Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Ex.: Visa Empresarial" /></div>
              <div className="space-y-2"><Label>Banco emissor</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Ex.: Nubank" /></div>
              <div className="space-y-2"><Label>Limite</Label><Input type="number" value={limitAmount} onChange={(e) => setLimitAmount(e.target.value)} placeholder="0,00" /></div>
              <div className="space-y-2"><Label>Dia de fechamento</Label><Input type="number" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} placeholder="Ex.: 25" /></div>
              <div className="space-y-2"><Label>Dia de vencimento</Label><Input type="number" value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="Ex.: 5" /></div>
            </>
          )}

          {mode === "fatura" && (
            <>
              <div className="space-y-2">
                <Label>Cartão</Label>
                <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cartão" /></SelectTrigger>
                  <SelectContent>
                    {creditCards.map((card: any) => (
                      <SelectItem key={card.id} value={String(card.id)}>{card.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Descrição da fatura</Label><Input value={invoiceLabel} onChange={(e) => setInvoiceLabel(e.target.value)} placeholder="Ex.: Fatura principal do mês" /></div>
              <div className="space-y-2"><Label>Valor</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
              <div className="space-y-2"><Label>Data de fechamento</Label><Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Data de vencimento</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            </>
          )}

          {mode === "emprestimo" && (
            <>
              <div className="space-y-2"><Label>Nome do empréstimo</Label><Input value={loanName} onChange={(e) => setLoanName(e.target.value)} placeholder="Ex.: Capital de giro março" /></div>
              <div className="space-y-2"><Label>Instituição</Label><Input value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} placeholder="Ex.: Mercado Pago" /></div>
              <div className="space-y-2"><Label>Tipo</Label><Select value={loanType} onValueChange={(value: "installment" | "sales_retention") => setLoanType(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="installment">Parcelado</SelectItem><SelectItem value="sales_retention">Retenção de vendas</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Valor contratado</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
              <div className="space-y-2"><Label>Saldo em aberto</Label><Input type="number" value={remainingAmount} onChange={(e) => setRemainingAmount(e.target.value)} placeholder="0,00" /></div>
              <div className="space-y-2"><Label>Início</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
              {loanType === "installment" ? <div className="space-y-2"><Label>Total de parcelas</Label><Input type="number" value={totalInstallments} onChange={(e) => setTotalInstallments(e.target.value)} placeholder="Ex.: 12" /></div> : null}
            </>
          )}

          {mode === "retencao" && (
            <>
              <div className="space-y-2">
                <Label>Empréstimo</Label>
                <Select value={selectedLoanId} onValueChange={setSelectedLoanId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o empréstimo" /></SelectTrigger>
                  <SelectContent>
                    {loans.map((loan: any) => (
                      <SelectItem key={loan.id} value={String(loan.id)}>{loan.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Descrição</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Retenção Mercado Pago" /></div>
              <div className="space-y-2"><Label>Valor</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
              <div className="space-y-2"><Label>Data</Label><Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></div>
            </>
          )}

          <div className="space-y-2 md:col-span-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anotações opcionais para facilitar o controle." rows={4} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? "Salvando..." : editingPayable ? "Salvar edição" : "Salvar cadastro"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Finance() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const [, obligationsParams] = useRoute("/obrigacoes/:tab");
  const isObligationsRoute = location.startsWith("/obrigacoes");
  const obligationTabParam = obligationsParams?.tab as ObligationsTab | undefined;
  const activeObligationTab: ObligationsTab = ["contas", "cartoes", "emprestimos"].includes(obligationTabParam || "")
    ? (obligationTabParam as ObligationsTab)
    : "contas";

  const now = new Date();
  const today = ymd(now);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedCnpjId, setSelectedCnpjId] = useState<string>("");
  const [obligationDialogMode, setObligationDialogMode] = useState<ObligationDialogMode | null>(null);
  const [obligationDialogOpen, setObligationDialogOpen] = useState(false);
  const [editingPayable, setEditingPayable] = useState<any | null>(null);
  const [savedPayableFeedback, setSavedPayableFeedback] = useState<{ id: number; title: string } | null>(null);
  const [highlightedPayableId, setHighlightedPayableId] = useState<number | null>(null);

  const cnpjsQuery = trpc.myCnpjs.list.useQuery();
  const statementsQuery = trpc.bankStatements.list.useQuery();
  const cnpjs = cnpjsQuery.data ?? [];

  useEffect(() => {
    if (!selectedCnpjId && cnpjs[0]?.id) {
      setSelectedCnpjId(String(cnpjs[0].id));
    }
  }, [cnpjs, selectedCnpjId]);

  const activeCnpjId = selectedCnpjId ? Number(selectedCnpjId) : undefined;
  const financeQueriesEnabled = Boolean(activeCnpjId);

  const payablesQuery = trpc.finance.payables.list.useQuery(
    { year: selectedYear, month: selectedMonth, cnpjId: activeCnpjId },
    { enabled: financeQueriesEnabled },
  );
  const payablesDashboardQuery = trpc.finance.payables.dashboard.useQuery(
    { referenceDate: today, year: selectedYear, month: selectedMonth, cnpjId: activeCnpjId },
    { enabled: financeQueriesEnabled },
  );
  const fixedCostPaymentsQuery = trpc.finance.fixedCosts.payments.useQuery(
    { year: selectedYear, month: selectedMonth, cnpjId: activeCnpjId as number },
    { enabled: financeQueriesEnabled },
  );
  const creditCardsQuery = trpc.finance.creditCards.list.useQuery(
    { cnpjId: activeCnpjId as number },
    { enabled: financeQueriesEnabled },
  );
  const creditCardInvoicesQuery = trpc.finance.creditCards.invoices.useQuery(
    { year: selectedYear, month: selectedMonth, cnpjId: activeCnpjId },
    { enabled: financeQueriesEnabled },
  );
  const loansQuery = trpc.finance.loans.list.useQuery(
    { cnpjId: activeCnpjId as number },
    { enabled: financeQueriesEnabled },
  );
  const loanInstallmentsQuery = trpc.finance.loans.installments.useQuery(
    { year: selectedYear, month: selectedMonth, cnpjId: activeCnpjId },
    { enabled: financeQueriesEnabled },
  );
  const retentionEntriesQuery = trpc.finance.loans.retentionEntries.useQuery(
    { year: selectedYear, month: selectedMonth, cnpjId: activeCnpjId },
    { enabled: financeQueriesEnabled },
  );
  const dreQuery = trpc.finance.dre.useQuery(
    { year: selectedYear, month: selectedMonth, cnpjId: activeCnpjId as number },
    { enabled: financeQueriesEnabled },
  );

  const statements = statementsQuery.data ?? [];
  const payables = payablesQuery.data ?? [];
  const payablesDashboard = payablesDashboardQuery.data;
  const fixedCostPayments = fixedCostPaymentsQuery.data ?? [];
  const creditCards = creditCardsQuery.data ?? [];
  const creditCardInvoices = creditCardInvoicesQuery.data ?? [];
  const loans = loansQuery.data ?? [];
  const loanInstallments = loanInstallmentsQuery.data ?? [];
  const retentionEntries = retentionEntriesQuery.data ?? [];
  const dre = dreQuery.data;

  useEffect(() => {
    if (!selectedCnpjId || statements.length === 0) return;
    const statementsForCnpj = statements.filter((statement: any) => String(statement.cnpjId) === selectedCnpjId);
    if (statementsForCnpj.length === 0) return;
    const sorted = [...statementsForCnpj].sort((a: any, b: any) => {
      const left = Number(a.periodYear) * 100 + Number(a.periodMonth);
      const right = Number(b.periodYear) * 100 + Number(b.periodMonth);
      return right - left;
    });
    const latest = sorted[0];
    const latestYear = Number(latest.periodYear);
    const latestMonth = Number(latest.periodMonth);
    if (latestYear !== selectedYear || latestMonth !== selectedMonth) {
      setSelectedYear(latestYear);
      setSelectedMonth(latestMonth);
    }
  }, [statements, selectedCnpjId, selectedMonth, selectedYear]);

  const selectedCnpj = useMemo(() => cnpjs.find((item: any) => String(item.id) === selectedCnpjId) ?? null, [cnpjs, selectedCnpjId]);
  const cnpjLabel = selectedCnpj ? `${selectedCnpj.nomeFantasia || selectedCnpj.razaoSocial} • ${selectedCnpj.cnpj}` : "Nenhuma subconta selecionada";

  const currentMonthStatements = useMemo(() => {
    if (!selectedCnpjId) return [];
    return statements.filter((statement: any) => Number(statement.periodYear) === selectedYear && Number(statement.periodMonth) === selectedMonth && String(statement.cnpjId) === selectedCnpjId);
  }, [statements, selectedYear, selectedMonth, selectedCnpjId]);

  const allTransactions = useMemo(() => {
    const transactions = Array.isArray(dre?.bankTransactions) ? dre.bankTransactions : [];
    if (!selectedCnpjId) return [];
    return transactions.filter((item: any) => String(item.cnpjId || "") === selectedCnpjId);
  }, [dre?.bankTransactions, selectedCnpjId]);

  const bankSummary = useMemo(() => {
    const entradas = Number(dre?.entradasTotais || 0);
    const saidas = Number(dre?.saidasTotais || 0);
    const saldo = entradas - saidas;
    const classified = Number(dre?.totalSaidasClassificadas || 0);
    const unclassified = Number(dre?.totalSaidasNaoClassificadas || 0);
    return { entradas, saidas, saldo, classified, unclassified };
  }, [dre?.entradasTotais, dre?.saidasTotais, dre?.totalSaidasClassificadas, dre?.totalSaidasNaoClassificadas]);

  const topExpenseCategories = useMemo(() => {
    const items = Array.isArray(dre?.topExpenseCategories) ? dre.topExpenseCategories : [];
    return items.filter((item: any) => Number(item.amount || 0) > 0);
  }, [dre?.topExpenseCategories]);

  const topCredits = useMemo(() => allTransactions.filter((item: any) => item.transactionType === "credit").slice(0, 5), [allTransactions]);
  const topDebits = useMemo(() => allTransactions.filter((item: any) => item.transactionType === "debit").slice(0, 8), [allTransactions]);

  const mercadoPagoSummary = useMemo(() => {
    const mercadoPagoStatements = currentMonthStatements.filter((statement: any) => String(statement.bankName || "").toLowerCase().includes("mercado pago"));
    const mercadoPagoTransactions = allTransactions.filter((txn: any) => String(txn.bankName || "").toLowerCase().includes("mercado pago"));
    const totalTransactions = mercadoPagoTransactions.length;
    const identified = mercadoPagoTransactions.filter((txn: any) => Number(txn.isIdentified || 0) === 1).length;
    const transfers = mercadoPagoTransactions
      .filter((txn: any) => String(txn.category || "").toLowerCase().includes("repasse para c6 bank"))
      .reduce((sum: number, txn: any) => sum + Math.abs(Number(txn.amount || 0)), 0);
    return {
      statementCount: mercadoPagoStatements.length,
      totalTransactions,
      identified,
      pending: Math.max(totalTransactions - identified, 0),
      transfers,
    };
  }, [allTransactions, currentMonthStatements]);

  const obligations = useMemo(() => {
    const totalCustos = Number(dre?.totalCustosFixos || 0);
    const totalCartoes = Number(dre?.totalCartoes || 0);
    const totalEmprestimos = Number(dre?.totalEmprestimos || 0);
    const totalContas = Number(dre?.totalContasPagas || 0);
    const total = totalCustos + totalCartoes + totalEmprestimos + totalContas;
    return { totalCustos, totalCartoes, totalEmprestimos, totalContas, total };
  }, [dre?.totalCustosFixos, dre?.totalCartoes, dre?.totalEmprestimos, dre?.totalContasPagas]);

  const alerts = Array.isArray(dre?.alerts) ? dre.alerts : [];

  function prevMonth() {
    const date = new Date(selectedYear, selectedMonth - 2, 1);
    setSelectedYear(date.getFullYear());
    setSelectedMonth(date.getMonth() + 1);
  }

  function nextMonth() {
    const date = new Date(selectedYear, selectedMonth, 1);
    setSelectedYear(date.getFullYear());
    setSelectedMonth(date.getMonth() + 1);
  }

  useEffect(() => {
    if (!savedPayableFeedback) return;
    const timeout = window.setTimeout(() => setSavedPayableFeedback(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [savedPayableFeedback]);

  useEffect(() => {
    if (!highlightedPayableId) return;
    const timeout = window.setTimeout(() => setHighlightedPayableId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [highlightedPayableId]);

  const deletePayableMutation = trpc.finance.payables.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        payablesQuery.refetch(),
        payablesDashboardQuery.refetch(),
        dreQuery.refetch(),
      ]);
      toast.success("Conta a pagar excluída.");
    },
    onError: () => toast.error("Não foi possível excluir a conta a pagar."),
  });

  const openObligationDialog = (mode: ObligationDialogMode, payable?: any | null) => {
    if (!selectedCnpjId) {
      toast.error("Cadastre e selecione um CNPJ para usar as subcontas.");
      return;
    }
    if (!isObligationsRoute) {
      navigate(mode === "conta" || mode === "custoFixo" ? "/obrigacoes/contas" : mode === "cartao" || mode === "fatura" ? "/obrigacoes/cartoes" : "/obrigacoes/emprestimos");
    }
    setEditingPayable(payable ?? null);
    setObligationDialogMode(mode);
    setObligationDialogOpen(true);
  };

  if (!user) return null;

  if (cnpjs.length === 0) {
    return (
      <DashboardLayout activeSection={isObligationsRoute ? "obrigacoes" : "financeiro"} onNavigate={(section) => navigate(`/${section}`)}>
        <div className="space-y-6">
          <EmptyState
            title="Nenhum CNPJ cadastrado"
            description="Cadastre ao menos um CNPJ para ativar as subcontas isoladas do Financeiro e de Obrigações. Depois disso, cada subconta funcionará sem misturar informações com as demais."
            actionLabel="Ir para CNPJs"
            onAction={() => navigate("/clientes")}
          />
        </div>
      </DashboardLayout>
    );
  }

  if (!selectedCnpjId) {
    return null;
  }

  if (isObligationsRoute) {
    const obligationTabs = [
      { key: "contas", label: "Contas a pagar", icon: Receipt, title: "Boletos, fornecedores e custos fixos", description: "Cadastre obrigações do mês, acompanhe vencimentos e mantenha controle claro das saídas futuras." },
      { key: "cartoes", label: "Cartões de crédito", icon: CreditCard, title: "Faturas e limites", description: "Controle o que está em aberto, o que já foi pago e o impacto das faturas no seu caixa futuro." },
      { key: "emprestimos", label: "Empréstimos", icon: Landmark, title: "Passivos e retenções", description: "Monitore empréstimos, retenções do Mercado Pago e evolução do saldo devedor." },
    ] as const;

    const currentTabMeta = obligationTabs.find((tab) => tab.key === activeObligationTab) ?? obligationTabs[0];

    return (
      <DashboardLayout activeSection="obrigacoes" onNavigate={(section) => navigate(`/${section}`)}>
        <div className="space-y-6">
          <FinanceHeader
            selectedCnpjId={selectedCnpjId}
            setSelectedCnpjId={setSelectedCnpjId}
            cnpjs={cnpjs}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            prevMonth={prevMonth}
            nextMonth={nextMonth}
            badge="Obrigações financeiras"
            title={currentTabMeta.title}
            description={`${currentTabMeta.description} Subconta ativa: ${cnpjLabel}.`}
          />

          <div className="rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-sm text-sky-900">
            <p className="font-semibold">Subconta isolada ativa</p>
            <p className="mt-1">Todos os cadastros, leituras e dashboards desta tela estão restritos ao CNPJ <span className="font-medium">{cnpjLabel}</span>.</p>
          </div>

          <div className="grid grid-cols-1 gap-2 rounded-2xl bg-muted/60 p-1 sm:grid-cols-3 sm:gap-1">
            {obligationTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => navigate(`/obrigacoes/${tab.key}`)}
                className={`flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-center text-sm font-medium transition-all sm:px-4 ${activeObligationTab === tab.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {activeObligationTab === "contas" ? (
            <div className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                <ObligationSpotlight
                  eyebrow="Central de contas"
                  title="Boletos, fornecedores e fixos por subconta"
                  description="Toda a rotina desta área está presa ao CNPJ ativo. Isso evita mistura entre subcontas e elimina divergência entre o filtro principal e o cadastro do modal."
                  accentClass="bg-gradient-to-br from-rose-500 via-rose-600 to-orange-500"
                >
                  <QuickActionButton label="Nova conta a pagar" onClick={() => openObligationDialog("conta")} />
                  <Button className="w-full sm:w-auto" variant="secondary" onClick={() => openObligationDialog("custoFixo")}>Novo custo fixo</Button>
                </ObligationSpotlight>

                <Card className="rounded-3xl border bg-card/95 shadow-sm">
                  <CardHeader>
                    <CardTitle>Radar executivo</CardTitle>
                    <CardDescription>{cnpjLabel}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">Vencendo hoje</p>
                          <p className="mt-2 text-3xl font-semibold text-amber-700">{payables.filter((item: any) => item.dueDate === today && item.status !== "paid").length}</p>
                        </div>
                        <CalendarClock className="h-8 w-8 text-amber-500" />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      <InsightMetric label="Em atraso" value={`R$ ${fmt(payablesDashboard?.totalOverdue || 0)}`} helper="Valor que continua pressionando o caixa até receber baixa." tone="danger" icon={<TrendingDown className="h-4 w-4" />} />
                      <InsightMetric label="Previsto no mês" value={`R$ ${fmt(payablesDashboard?.totalPending || 0)}`} helper="Compromissos futuros ainda não liquidados." tone="info" icon={<Target className="h-4 w-4" />} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <InsightMetric label="Contas do mês" value={String(payables.length)} helper="Boletos, parcelas e fornecedores monitorados nesta subconta." icon={<Receipt className="h-4 w-4" />} />
                <InsightMetric label="Total previsto" value={`R$ ${fmt(payablesDashboard?.totalPending || 0)}`} helper="Montante ainda aguardando pagamento." tone="warning" icon={<Wallet className="h-4 w-4" />} />
                <InsightMetric label="Custos fixos" value={`R$ ${fmt(obligations.totalCustos)}`} helper="Compromissos recorrentes lançados para este CNPJ." tone="success" icon={<Sparkles className="h-4 w-4" />} />
                <InsightMetric label="Valor controlado" value={`R$ ${fmt(obligations.totalContas + obligations.totalCustos)}`} helper="Base operacional acompanhada dentro desta subconta." tone="neutral" icon={<PieChart className="h-4 w-4" />} />
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                {payables.length > 0 ? (
                  <Card className="rounded-3xl border bg-card/95 shadow-sm">
                    <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle>Lista de contas a pagar</CardTitle>
                        <CardDescription>Visualize vencimento, status e impacto financeiro de cada obrigação somente desta subconta.</CardDescription>
                      </div>
                      <QuickActionButton label="Nova conta a pagar" onClick={() => openObligationDialog("conta")} />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {savedPayableFeedback ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm">
                          <p className="font-semibold">Cadastro salvo com sucesso.</p>
                          <p className="mt-1">A conta <span className="font-medium">{savedPayableFeedback.title}</span> foi adicionada à subconta <span className="font-medium">{cnpjLabel}</span> e ficou destacada por alguns segundos.</p>
                        </div>
                      ) : null}
                      {payables.slice(0, 12).map((item: any) => {
                        const mainTitle = item.title || item.description || item.supplier || "Conta a pagar";
                        const detailParts = [item.supplier, item.description].filter((value, index, array) => {
                          if (!value) return false;
                          return array.indexOf(value) === index;
                        });
                        const detailLabel = detailParts.length > 0 ? detailParts.join(" • ") : "Sem detalhes adicionais";

                        return (
                          <div key={item.id} className={`space-y-2 rounded-2xl border p-3 transition-all ${highlightedPayableId === item.id ? "border-emerald-300 bg-emerald-50/80 shadow-md ring-2 ring-emerald-200" : "border-border/60 bg-background/70"}`}>
                            <ObligationListItem
                              title={mainTitle}
                              subtitle={`${detailLabel} • ${item.category || "Sem categoria"} • vence ${item.dueDate || "sem data"}`}
                              badge={<Badge variant={item.status === "paid" ? "default" : item.status === "overdue" ? "destructive" : "outline"}>{item.status}</Badge>}
                              amount={`R$ ${fmt(item.amount)}`}
                              accentClass={item.status === "paid" ? "bg-emerald-500" : item.status === "overdue" ? "bg-rose-500" : "bg-amber-500"}
                            />
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button type="button" variant="outline" size="sm" onClick={() => openObligationDialog("conta", item)}>Editar</Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                  const confirmed = window.confirm(`Excluir a conta \"${mainTitle}\"?`);
                                  if (!confirmed) return;
                                  await deletePayableMutation.mutateAsync({ id: item.id });
                                }}
                              >
                                Excluir
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ) : (
                  <EmptyState title="Nenhuma conta a pagar cadastrada" description="Comece por boletos, fornecedores e despesas previstas para montar seu controle operacional desta subconta." actionLabel="Cadastrar conta a pagar" onAction={() => openObligationDialog("conta")} />
                )}

                <Card className="rounded-3xl border bg-card/95 shadow-sm">
                  <CardHeader>
                    <CardTitle>Custos fixos do período</CardTitle>
                    <CardDescription>Leitura separada para aluguel, folha, carro, água, luz e outros compromissos recorrentes deste CNPJ.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      <InsightMetric label="Pagamentos lançados" value={String(fixedCostPayments.length)} helper="Quantidade de registros para o período selecionado." tone="success" icon={<Sparkles className="h-4 w-4" />} />
                      <InsightMetric label="Impacto mensal" value={`R$ ${fmt(obligations.totalCustos)}`} helper="Quanto os custos fixos pesam no controle gerencial desta subconta." tone="neutral" icon={<Wallet className="h-4 w-4" />} />
                    </div>
                    <div className="space-y-3">
                      {fixedCostPayments.length > 0 ? fixedCostPayments.slice(0, 10).map((payment: any) => (
                        <ObligationListItem
                          key={payment.id}
                          title={payment.name || payment.description || "Custo fixo"}
                          subtitle={`Pagamento registrado em ${payment.referenceMonth || selectedMonth}/${payment.referenceYear || selectedYear}`}
                          badge={<Badge variant="outline">fixo</Badge>}
                          amount={`R$ ${fmt(payment.amount || payment.amountPaid)}`}
                          accentClass="bg-emerald-500"
                        />
                      )) : <p className="text-sm text-muted-foreground">Nenhum pagamento de custo fixo registrado para o período.</p>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}

          {activeObligationTab === "cartoes" ? (
            <div className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                <ObligationSpotlight
                  eyebrow="Painel de cartões"
                  title="Faturas, vencimentos e exposição do limite por subconta"
                  description="Aqui o objetivo é mostrar concentração de compromissos por cartão dentro do CNPJ ativo, sem misturar outras subcontas."
                  accentClass="bg-gradient-to-br from-sky-500 via-indigo-500 to-violet-600"
                >
                  <QuickActionButton label="Novo cartão" onClick={() => openObligationDialog("cartao")} />
                  <Button className="w-full sm:w-auto" variant="secondary" onClick={() => openObligationDialog("fatura")}>Nova fatura</Button>
                </ObligationSpotlight>

                <Card className="rounded-3xl border bg-card/95 shadow-sm">
                  <CardHeader>
                    <CardTitle>Resumo do uso</CardTitle>
                    <CardDescription>{cnpjLabel}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <InsightMetric label="Cartões cadastrados" value={String(creditCards.length)} helper="Base de cartões atualmente monitorada para esta operação." tone="info" icon={<CreditCard className="h-4 w-4" />} />
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      <InsightMetric label="Faturas do mês" value={String(creditCardInvoices.length)} helper="Competências com fechamento no período selecionado." tone="neutral" icon={<CalendarClock className="h-4 w-4" />} />
                      <InsightMetric label="Valor acompanhado" value={`R$ ${fmt(obligations.totalCartoes)}`} helper="Compromissos futuros desta subconta." tone="danger" icon={<TrendingDown className="h-4 w-4" />} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <InsightMetric label="Maior concentração" value={`R$ ${fmt(creditCardInvoices.reduce((max: number, invoice: any) => Math.max(max, Number(invoice.amount || invoice.totalAmount || 0)), 0))}`} helper="Maior fatura individual do período." tone="warning" icon={<Target className="h-4 w-4" />} />
                <InsightMetric label="Valor médio" value={`R$ ${fmt(creditCardInvoices.length > 0 ? creditCardInvoices.reduce((sum: number, invoice: any) => sum + Number(invoice.amount || invoice.totalAmount || 0), 0) / creditCardInvoices.length : 0)}`} helper="Leitura média para comparar comportamento das competências." tone="info" icon={<PieChart className="h-4 w-4" />} />
                <InsightMetric label="Cobertura visual" value={creditCardInvoices.length > 0 ? "Ativa" : "Vazia"} helper="Se não houver faturas, o painel já indica necessidade de cadastro." tone={creditCardInvoices.length > 0 ? "success" : "neutral"} icon={<Sparkles className="h-4 w-4" />} />
              </div>

              {creditCardInvoices.length > 0 ? (
                <Card className="rounded-3xl border bg-card/95 shadow-sm">
                  <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Faturas registradas</CardTitle>
                      <CardDescription>Monitore fechamento, vencimento e o peso real das faturas futuras da subconta selecionada.</CardDescription>
                    </div>
                    <QuickActionButton label="Nova fatura" onClick={() => openObligationDialog("fatura")} />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {creditCardInvoices.slice(0, 12).map((invoice: any) => (
                      <ObligationListItem
                        key={invoice.id}
                        title={invoice.cardName || invoice.description || "Fatura de cartão"}
                        subtitle={`Fechamento ${invoice.closingDate || "não informado"} • vencimento ${invoice.dueDate || "não informado"}`}
                        badge={<Badge variant="outline">fatura</Badge>}
                        amount={`R$ ${fmt(invoice.amount || invoice.totalAmount)}`}
                        accentClass="bg-violet-500"
                      />
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <EmptyState title="Nenhuma fatura cadastrada" description="Cadastre cartões e faturas para acompanhar saldos devidos e pagamentos realizados sem misturar outras subcontas." actionLabel="Cadastrar cartão ou fatura" onAction={() => openObligationDialog("fatura")} />
              )}
            </div>
          ) : null}

          {activeObligationTab === "emprestimos" ? (
            <div className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                <ObligationSpotlight
                  eyebrow="Painel de empréstimos"
                  title="Saldo, retenções e ritmo de amortização por subconta"
                  description="Este quadro destaca passivos ativos, parcelas do mês e retenções operacionais apenas do CNPJ ativo."
                  accentClass="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600"
                >
                  <QuickActionButton label="Novo empréstimo" onClick={() => openObligationDialog("emprestimo")} />
                  <Button className="w-full sm:w-auto" variant="secondary" onClick={() => openObligationDialog("retencao")}>Nova retenção</Button>
                </ObligationSpotlight>

                <Card className="rounded-3xl border bg-card/95 shadow-sm">
                  <CardHeader>
                    <CardTitle>Indicadores principais</CardTitle>
                    <CardDescription>{cnpjLabel}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <InsightMetric label="Empréstimos ativos" value={String(loans.length)} helper="Quantidade de contratos hoje em acompanhamento." tone="success" icon={<Landmark className="h-4 w-4" />} />
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      <InsightMetric label="Parcelas do mês" value={String(loanInstallments.length)} helper="Compromissos periódicos com vencimento no período." tone="info" icon={<CalendarClock className="h-4 w-4" />} />
                      <InsightMetric label="Retenção do mês" value={`R$ ${fmt(obligations.totalEmprestimos)}`} helper="Volume ligado a empréstimos nesta subconta." tone="warning" icon={<TrendingDown className="h-4 w-4" />} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <InsightMetric label="Saldo em aberto" value={`R$ ${fmt(loans.reduce((sum: number, loan: any) => sum + Number(loan.remainingAmount || loan.balance || 0), 0))}`} helper="Estimativa somada do saldo restante informado nos contratos." tone="danger" icon={<Wallet className="h-4 w-4" />} />
                <InsightMetric label="Retenções lançadas" value={String(retentionEntries.length)} helper="Quantidade de registros de abatimento/rastreamento no período." tone="neutral" icon={<Sparkles className="h-4 w-4" />} />
                <InsightMetric label="Valor contratado" value={`R$ ${fmt(loans.reduce((sum: number, loan: any) => sum + Number(loan.totalAmount || loan.amount || 0), 0))}`} helper="Base total dos empréstimos monitorados nesta subconta." tone="info" icon={<Target className="h-4 w-4" />} />
              </div>

              {loans.length > 0 ? (
                <Card className="rounded-3xl border bg-card/95 shadow-sm">
                  <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Empréstimos cadastrados</CardTitle>
                      <CardDescription>Registre saldos, retenções e parcelas com uma visão mais elegante do passivo em andamento.</CardDescription>
                    </div>
                    <QuickActionButton label="Novo empréstimo" onClick={() => openObligationDialog("emprestimo")} />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {loans.slice(0, 12).map((loan: any) => (
                      <ObligationListItem
                        key={loan.id}
                        title={loan.name || loan.description || "Empréstimo"}
                        subtitle={`Saldo restante R$ ${fmt(loan.remainingAmount || loan.balance || 0)} • instituição ${loan.institution || "não informada"}`}
                        badge={<Badge variant="outline">{loan.status || "ativo"}</Badge>}
                        amount={`R$ ${fmt(loan.totalAmount || loan.amount || 0)}`}
                        accentClass="bg-teal-500"
                      />
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <EmptyState title="Nenhum empréstimo cadastrado" description="Cadastre retenções e empréstimos nesta área para controle do passivo e pagamentos desta subconta." actionLabel="Cadastrar empréstimo" onAction={() => openObligationDialog("emprestimo")} />
              )}
            </div>
          ) : null}

          <ObligationDialog
            open={obligationDialogOpen}
            mode={obligationDialogMode}
            activeCnpjId={selectedCnpjId}
            editingPayable={editingPayable}
            onOpenChange={(open) => {
              setObligationDialogOpen(open);
              if (!open) setEditingPayable(null);
            }}
            cnpjs={cnpjs}
            creditCards={creditCards}
            loans={loans}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onSaved={(savedPayable) => {
              if (savedPayable?.id) {
                setSavedPayableFeedback({
                  id: Number(savedPayable.id),
                  title: String(savedPayable.title || savedPayable.description || savedPayable.supplier || "Conta a pagar"),
                });
                setHighlightedPayableId(Number(savedPayable.id));
              }
            }}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activeSection="financeiro" onNavigate={(section) => navigate(`/${section}`)}>
      <div className="space-y-6">
        <FinanceHeader
          selectedCnpjId={selectedCnpjId}
          setSelectedCnpjId={setSelectedCnpjId}
          cnpjs={cnpjs}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          prevMonth={prevMonth}
          nextMonth={nextMonth}
          badge="Financeiro profissional"
          title="DRE e caixa realizado por subconta"
          description="Aqui fica apenas o painel principal de caixa e análise do extrato da subconta selecionada. As obrigações continuam em dashboards próprios, mas sem misturar CNPJs."
        />

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
          <p className="font-semibold">Subconta isolada ativa</p>
          <p className="mt-1">O Financeiro agora lê apenas os dados do CNPJ <span className="font-medium">{cnpjLabel}</span> para este período.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-emerald-200 bg-emerald-50/70"><CardContent className="pt-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Entradas do caixa</p><p className="mt-2 text-2xl font-bold text-emerald-700">R$ {fmt(bankSummary.entradas)}</p><p className="mt-1 text-xs text-emerald-700/80">{cnpjLabel}</p></div><ArrowUpCircle className="h-8 w-8 text-emerald-500" /></div></CardContent></Card>
          <Card className="border-rose-200 bg-rose-50/70"><CardContent className="pt-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Saídas do caixa</p><p className="mt-2 text-2xl font-bold text-rose-700">R$ {fmt(bankSummary.saidas)}</p><p className="mt-1 text-xs text-rose-700/80">Somente débitos do extrato desta subconta</p></div><ArrowDownCircle className="h-8 w-8 text-rose-500" /></div></CardContent></Card>
          <Card className="border-sky-200 bg-sky-50/70"><CardContent className="pt-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Resultado de caixa</p><p className={`mt-2 text-2xl font-bold ${bankSummary.saldo >= 0 ? "text-sky-700" : "text-red-600"}`}>R$ {fmt(bankSummary.saldo)}</p><p className="mt-1 text-xs text-sky-700/80">Entrou menos saiu no período</p></div><Wallet className="h-8 w-8 text-sky-500" /></div></CardContent></Card>
          <Card className="border-violet-200 bg-violet-50/70"><CardContent className="pt-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Saídas classificadas</p><p className="mt-2 text-2xl font-bold text-violet-700">{toPercent(Number(dre?.percentualSaidasClassificadas || 0))}</p><p className="mt-1 text-xs text-violet-700/80">Quanto do extrato desta subconta já está explicado</p></div><PieChart className="h-8 w-8 text-violet-500" /></div></CardContent></Card>
        </div>

        {alerts.length > 0 ? (
          <div className="space-y-3">
            {alerts.map((alert: any, index: number) => (
              <div key={`${alert.type}-${index}`} className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${alert.type === "danger" ? "border-red-200 bg-red-50 text-red-800" : alert.type === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-sky-200 bg-sky-50 text-sky-800"}`}>
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>DRE de caixa realizado</CardTitle>
              <CardDescription>Este quadro usa apenas as movimentações do extrato do mês para o CNPJ selecionado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Entradas confirmadas</span><span className="font-medium text-emerald-600">R$ {fmt(bankSummary.entradas)}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Saídas confirmadas</span><span className="font-medium text-rose-600">R$ {fmt(bankSummary.saidas)}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Resultado do mês</span><span className={`font-semibold ${bankSummary.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>R$ {fmt(bankSummary.saldo)}</span></div>
              <div className="rounded-2xl border bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leitura estratégica</p>
                <p className="mt-2 text-sm text-muted-foreground">Se este número ficar negativo, esta subconta consumiu mais do que recebeu no período. O próximo passo é olhar as categorias de saída para descobrir exatamente onde o dinheiro foi embora.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Saídas classificadas</p><p className="mt-2 text-xl font-semibold">R$ {fmt(bankSummary.classified)}</p></div>
                <div className="rounded-xl border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Sem classificação</p><p className="mt-2 text-xl font-semibold text-amber-600">R$ {fmt(bankSummary.unclassified)}</p></div>
                <div className="rounded-xl border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Extratos usados</p><p className="mt-2 text-xl font-semibold">{currentMonthStatements.length}</p></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Painel Mercado Pago</CardTitle>
              <CardDescription>A automação continua restrita ao layout do Mercado Pago/Mercado Livre para facilitar repasses e ajustes deste fluxo na subconta ativa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Extratos no período</span><span className="font-medium">{mercadoPagoSummary.statementCount}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Movimentos lidos</span><span className="font-medium">{mercadoPagoSummary.totalTransactions}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Autoidentificados</span><span className="font-medium text-emerald-600">{mercadoPagoSummary.identified}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Repasses Mercado Pago → C6</span><span className="font-medium text-sky-600">R$ {fmt(mercadoPagoSummary.transfers)}</span></div>
              <div className="flex items-center justify-between border-t pt-3"><span className="text-muted-foreground">Pendentes no Mercado Pago</span><span className="font-medium text-amber-600">{mercadoPagoSummary.pending}</span></div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Onde o dinheiro mais saiu</CardTitle>
              <CardDescription>Estas categorias vêm das saídas do extrato já classificadas para o CNPJ ativo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {topExpenseCategories.length > 0 ? topExpenseCategories.map((item: any, index: number) => (
                <BarRow key={`${item.category}-${index}`} label={item.category} amount={Number(item.amount || 0)} total={bankSummary.saidas} tone={index === 0 ? "rose" : index === 1 ? "amber" : "sky"} />
              )) : (
                <p className="text-sm text-muted-foreground">Classifique as saídas do extrato para descobrir onde o caixa mais sangra nesta subconta.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Maiores movimentos recentes</CardTitle>
              <CardDescription>Créditos e débitos lidos diretamente dos extratos usados neste fechamento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="mb-2 font-medium text-emerald-700">Entradas recentes</p>
                <div className="space-y-2">
                  {topCredits.length > 0 ? topCredits.map((item: any, index: number) => (
                    <div key={`credit-${index}`} className="flex items-center justify-between rounded-xl border p-3">
                      <span className="line-clamp-1 pr-4">{item.description || "Crédito bancário"}</span>
                      <span className="font-medium text-emerald-600">R$ {fmt(item.amount)}</span>
                    </div>
                  )) : <p className="text-muted-foreground">Sem entradas relevantes no período.</p>}
                </div>
              </div>
              <div>
                <p className="mb-2 font-medium text-rose-700">Saídas recentes</p>
                <div className="space-y-2">
                  {topDebits.length > 0 ? topDebits.map((item: any, index: number) => (
                    <div key={`debit-${index}`} className="flex items-center justify-between rounded-xl border p-3">
                      <span className="line-clamp-1 pr-4">{item.description || item.category || "Débito bancário"}</span>
                      <span className="font-medium text-rose-600">R$ {fmt(item.amount)}</span>
                    </div>
                  )) : <p className="text-muted-foreground">Sem saídas relevantes no período.</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contas em controle</p><p className="mt-2 text-2xl font-bold">R$ {fmt(obligations.totalContas)}</p><p className="mt-1 text-xs text-muted-foreground">Somente desta subconta</p></CardContent></Card>
          <Card><CardContent className="pt-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cartões em controle</p><p className="mt-2 text-2xl font-bold">R$ {fmt(obligations.totalCartoes)}</p><p className="mt-1 text-xs text-muted-foreground">Somente desta subconta</p></CardContent></Card>
          <Card><CardContent className="pt-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empréstimos em controle</p><p className="mt-2 text-2xl font-bold">R$ {fmt(obligations.totalEmprestimos)}</p><p className="mt-1 text-xs text-muted-foreground">Somente desta subconta</p></CardContent></Card>
          <Card><CardContent className="pt-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custos fixos em controle</p><p className="mt-2 text-2xl font-bold">R$ {fmt(obligations.totalCustos)}</p><p className="mt-1 text-xs text-muted-foreground">Controle separado do resultado principal</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Próximo passo recomendado</CardTitle>
            <CardDescription>Para o DRE ficar mais preciso, classifique especialmente as saídas do C6 Bank por categoria dentro da subconta ativa. Isso melhora os gráficos e a leitura de onde o caixa está sendo consumido.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => navigate("/extratos")}>Abrir Extratos para classificar</Button>
            <Button variant="outline" onClick={() => navigate("/obrigacoes/contas")}>Abrir contas a pagar</Button>
            <Button variant="outline" onClick={() => navigate("/obrigacoes/cartoes")}>Abrir cartões</Button>
            <Button variant="outline" onClick={() => navigate("/obrigacoes/emprestimos")}>Abrir empréstimos</Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

