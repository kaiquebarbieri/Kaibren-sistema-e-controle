import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  Info,
  Landmark,
  Pencil,
  Plus,
  Receipt,
  ShieldAlert,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

type Tab = "visao" | "pagar" | "custos" | "cartoes" | "emprestimos";

type LoanType = "installment" | "sales_retention";

type PayableStatus = "pending" | "paid" | "overdue" | "partial";

const FIXED_COST_CATEGORIES = [
  { value: "aluguel", label: "Aluguel" },
  { value: "internet", label: "Internet" },
  { value: "telefone", label: "Telefone" },
  { value: "contador", label: "Contador" },
  { value: "energia", label: "Energia" },
  { value: "agua", label: "Água" },
  { value: "software", label: "Software/Sistema" },
  { value: "seguro", label: "Seguro" },
  { value: "funcionario", label: "Funcionário" },
  { value: "transporte", label: "Transporte/Frete" },
  { value: "outros", label: "Outros" },
];

const CARD_BRANDS = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "elo", label: "Elo" },
  { value: "amex", label: "American Express" },
  { value: "outros", label: "Outros" },
];

const PAYABLE_TYPES = [
  { value: "boleto", label: "Boleto" },
  { value: "fornecedor", label: "Fornecedor" },
  { value: "cartao", label: "Cartão" },
  { value: "emprestimo", label: "Empréstimo" },
  { value: "imposto", label: "Imposto" },
  { value: "investimento", label: "Investimento" },
  { value: "outros", label: "Outros" },
];

const PAYABLE_STATUSES = [
  { value: "pending", label: "Pendente" },
  { value: "paid", label: "Pago" },
  { value: "overdue", label: "Atrasado" },
  { value: "partial", label: "Parcial" },
];

const RETENTION_CATEGORIES = [
  { value: "venda", label: "Venda" },
  { value: "taxa", label: "Taxa" },
  { value: "antecipacao", label: "Antecipação" },
  { value: "devolucao", label: "Devolução" },
  { value: "abatimento_emprestimo", label: "Abatimento do Empréstimo" },
  { value: "ajuste", label: "Ajuste" },
];

function fmt(v: number | string | null | undefined): string {
  const n = parseFloat(String(v || "0"));
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function statusBadgeClass(status: string) {
  if (status === "paid") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "partial") return "bg-amber-100 text-amber-700 border-amber-200";
  if (status === "overdue") return "bg-red-100 text-red-700 border-red-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function Finance() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/financeiro/:tab");
  const activeTab = (params?.tab as Tab) || "visao";

  const now = new Date();
  const today = ymd(now);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const [showCostForm, setShowCostForm] = useState(false);
  const [editingCostId, setEditingCostId] = useState<number | null>(null);
  const [costName, setCostName] = useState("");
  const [costCategory, setCostCategory] = useState("outros");
  const [costAmount, setCostAmount] = useState("");
  const [costDueDay, setCostDueDay] = useState("1");
  const [costNotes, setCostNotes] = useState("");

  const [showCardForm, setShowCardForm] = useState(false);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [cardName, setCardName] = useState("");
  const [cardBrand, setCardBrand] = useState("outros");
  const [cardLastFour, setCardLastFour] = useState("");
  const [cardClosingDay, setCardClosingDay] = useState("1");
  const [cardDueDay, setCardDueDay] = useState("10");
  const [cardLimit, setCardLimit] = useState("");
  const [cardNotes, setCardNotes] = useState("");

  const [editingInvoiceCardId, setEditingInvoiceCardId] = useState<number | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceAmountPaid, setInvoiceAmountPaid] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState<"paid" | "pending" | "partial">("pending");

  const [showLoanForm, setShowLoanForm] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<number | null>(null);
  const [loanName, setLoanName] = useState("");
  const [loanInstitution, setLoanInstitution] = useState("");
  const [loanType, setLoanType] = useState<LoanType>("installment");
  const [loanTotalAmount, setLoanTotalAmount] = useState("");
  const [loanTotalInstallments, setLoanTotalInstallments] = useState("");
  const [loanInstallmentAmount, setLoanInstallmentAmount] = useState("");
  const [loanInterestRate, setLoanInterestRate] = useState("");
  const [loanStartDate, setLoanStartDate] = useState(today);
  const [loanDueDay, setLoanDueDay] = useState("1");
  const [loanRetentionPercent, setLoanRetentionPercent] = useState("20");
  const [loanRetentionSource, setLoanRetentionSource] = useState("mercado_livre");
  const [loanNotes, setLoanNotes] = useState("");

  const [editingRetentionLoanId, setEditingRetentionLoanId] = useState<number | null>(null);
  const [retentionDate, setRetentionDate] = useState(today);
  const [retentionCategory, setRetentionCategory] = useState("abatimento_emprestimo");
  const [retentionGross, setRetentionGross] = useState("");
  const [retentionNet, setRetentionNet] = useState("");
  const [retentionAmount, setRetentionAmount] = useState("");
  const [retentionPercentApplied, setRetentionPercentApplied] = useState("");
  const [retentionReference, setRetentionReference] = useState("");
  const [retentionNotes, setRetentionNotes] = useState("");

  const [showPayableForm, setShowPayableForm] = useState(false);
  const [editingPayableId, setEditingPayableId] = useState<number | null>(null);
  const [payableTitle, setPayableTitle] = useState("");
  const [payableSupplier, setPayableSupplier] = useState("");
  const [payableCategory, setPayableCategory] = useState("operacional");
  const [payableType, setPayableType] = useState("boleto");
  const [payableAmount, setPayableAmount] = useState("");
  const [payableDueDate, setPayableDueDate] = useState(today);
  const [payableStatus, setPayableStatus] = useState<PayableStatus>("pending");
  const [payablePaidAmount, setPayablePaidAmount] = useState("");
  const [payableInstallmentLabel, setPayableInstallmentLabel] = useState("");
  const [payableReminderDaysBefore, setPayableReminderDaysBefore] = useState("1");
  const [payablePaymentMethod, setPayablePaymentMethod] = useState("");
  const [payableDescription, setPayableDescription] = useState("");
  const [payableNotes, setPayableNotes] = useState("");
  const [payableIsInvestment, setPayableIsInvestment] = useState("0");

  const fixedCostsQuery = trpc.finance.fixedCosts.list.useQuery();
  const fixedCostPaymentsQuery = trpc.finance.fixedCosts.payments.useQuery({ year: selectedYear, month: selectedMonth });
  const creditCardsQuery = trpc.finance.creditCards.list.useQuery();
  const creditCardInvoicesQuery = trpc.finance.creditCards.invoices.useQuery({ year: selectedYear, month: selectedMonth });
  const loansQuery = trpc.finance.loans.list.useQuery();
  const loanInstallmentsQuery = trpc.finance.loans.installments.useQuery({ year: selectedYear, month: selectedMonth });
  const retentionEntriesQuery = trpc.finance.loans.retentionEntries.useQuery({ year: selectedYear, month: selectedMonth });
  const payablesQuery = trpc.finance.payables.list.useQuery({ year: selectedYear, month: selectedMonth });
  const payablesDashboardQuery = trpc.finance.payables.dashboard.useQuery({ referenceDate: today, year: selectedYear, month: selectedMonth });
  const dreQuery = trpc.finance.dre.useQuery({ year: selectedYear, month: selectedMonth });

  const utils = trpc.useUtils();

  const invalidateFinance = async () => {
    await Promise.all([
      utils.finance.fixedCosts.list.invalidate(),
      utils.finance.fixedCosts.payments.invalidate(),
      utils.finance.creditCards.list.invalidate(),
      utils.finance.creditCards.invoices.invalidate(),
      utils.finance.loans.list.invalidate(),
      utils.finance.loans.installments.invalidate(),
      utils.finance.loans.retentionEntries.invalidate(),
      utils.finance.payables.list.invalidate(),
      utils.finance.payables.dashboard.invalidate(),
      utils.finance.dre.invalidate(),
    ]);
  };

  const createCostMutation = trpc.finance.fixedCosts.create.useMutation({
    onSuccess: async () => { await invalidateFinance(); resetCostForm(); toast.success("Custo fixo cadastrado."); },
  });
  const updateCostMutation = trpc.finance.fixedCosts.update.useMutation({
    onSuccess: async () => { await invalidateFinance(); resetCostForm(); toast.success("Custo fixo atualizado."); },
  });
  const deleteCostMutation = trpc.finance.fixedCosts.delete.useMutation({
    onSuccess: async () => { await invalidateFinance(); toast.success("Custo fixo removido."); },
  });
  const upsertPaymentMutation = trpc.finance.fixedCosts.upsertPayment.useMutation({
    onSuccess: async () => { await invalidateFinance(); toast.success("Pagamento de custo fixo atualizado."); },
  });

  const createCardMutation = trpc.finance.creditCards.create.useMutation({
    onSuccess: async () => { await invalidateFinance(); resetCardForm(); toast.success("Cartão cadastrado."); },
  });
  const updateCardMutation = trpc.finance.creditCards.update.useMutation({
    onSuccess: async () => { await invalidateFinance(); resetCardForm(); toast.success("Cartão atualizado."); },
  });
  const deleteCardMutation = trpc.finance.creditCards.delete.useMutation({
    onSuccess: async () => { await invalidateFinance(); toast.success("Cartão removido."); },
  });
  const upsertInvoiceMutation = trpc.finance.creditCards.upsertInvoice.useMutation({
    onSuccess: async () => { await invalidateFinance(); setEditingInvoiceCardId(null); toast.success("Fatura registrada."); },
  });

  const createLoanMutation = trpc.finance.loans.create.useMutation({
    onSuccess: async () => { await invalidateFinance(); resetLoanForm(); toast.success("Empréstimo cadastrado."); },
  });
  const updateLoanMutation = trpc.finance.loans.update.useMutation({
    onSuccess: async () => { await invalidateFinance(); resetLoanForm(); toast.success("Empréstimo atualizado."); },
  });
  const deleteLoanMutation = trpc.finance.loans.delete.useMutation({
    onSuccess: async () => { await invalidateFinance(); toast.success("Empréstimo removido."); },
  });
  const upsertInstallmentMutation = trpc.finance.loans.upsertInstallment.useMutation({
    onSuccess: async () => { await invalidateFinance(); toast.success("Parcela atualizada."); },
  });
  const createRetentionMutation = trpc.finance.loans.createRetentionEntry.useMutation({
    onSuccess: async () => { await invalidateFinance(); resetRetentionForm(); toast.success("Movimento de retenção lançado."); },
  });

  const createPayableMutation = trpc.finance.payables.create.useMutation({
    onSuccess: async () => { await invalidateFinance(); resetPayableForm(); toast.success("Conta a pagar cadastrada."); },
  });
  const updatePayableMutation = trpc.finance.payables.update.useMutation({
    onSuccess: async () => { await invalidateFinance(); resetPayableForm(); toast.success("Conta a pagar atualizada."); },
  });
  const deletePayableMutation = trpc.finance.payables.delete.useMutation({
    onSuccess: async () => { await invalidateFinance(); toast.success("Conta a pagar removida."); },
  });
  const registerPayablePaymentMutation = trpc.finance.payables.registerPayment.useMutation({
    onSuccess: async () => { await invalidateFinance(); toast.success("Pagamento da conta registrado."); },
  });

  function resetCostForm() {
    setShowCostForm(false);
    setEditingCostId(null);
    setCostName("");
    setCostCategory("outros");
    setCostAmount("");
    setCostDueDay("1");
    setCostNotes("");
  }

  function resetCardForm() {
    setShowCardForm(false);
    setEditingCardId(null);
    setCardName("");
    setCardBrand("outros");
    setCardLastFour("");
    setCardClosingDay("1");
    setCardDueDay("10");
    setCardLimit("");
    setCardNotes("");
  }

  function resetLoanForm() {
    setShowLoanForm(false);
    setEditingLoanId(null);
    setLoanName("");
    setLoanInstitution("");
    setLoanType("installment");
    setLoanTotalAmount("");
    setLoanTotalInstallments("");
    setLoanInstallmentAmount("");
    setLoanInterestRate("");
    setLoanStartDate(today);
    setLoanDueDay("1");
    setLoanRetentionPercent("20");
    setLoanRetentionSource("mercado_livre");
    setLoanNotes("");
  }

  function resetRetentionForm() {
    setEditingRetentionLoanId(null);
    setRetentionDate(today);
    setRetentionCategory("abatimento_emprestimo");
    setRetentionGross("");
    setRetentionNet("");
    setRetentionAmount("");
    setRetentionPercentApplied("");
    setRetentionReference("");
    setRetentionNotes("");
  }

  function resetPayableForm() {
    setShowPayableForm(false);
    setEditingPayableId(null);
    setPayableTitle("");
    setPayableSupplier("");
    setPayableCategory("operacional");
    setPayableType("boleto");
    setPayableAmount("");
    setPayableDueDate(today);
    setPayableStatus("pending");
    setPayablePaidAmount("");
    setPayableInstallmentLabel("");
    setPayableReminderDaysBefore("1");
    setPayablePaymentMethod("");
    setPayableDescription("");
    setPayableNotes("");
    setPayableIsInvestment("0");
  }

  function prevMonth() {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((current) => current - 1);
      return;
    }
    setSelectedMonth((current) => current - 1);
  }

  function nextMonth() {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((current) => current + 1);
      return;
    }
    setSelectedMonth((current) => current + 1);
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "visao", label: "Saúde + DRE", icon: TrendingUp },
    { key: "pagar", label: "Contas a Pagar", icon: Receipt },
    { key: "custos", label: "Custos Fixos", icon: Wallet },
    { key: "cartoes", label: "Cartões", icon: CreditCard },
    { key: "emprestimos", label: "Empréstimos", icon: Landmark },
  ];

  const fixedCosts = fixedCostsQuery.data ?? [];
  const fixedCostPayments = fixedCostPaymentsQuery.data ?? [];
  const creditCards = creditCardsQuery.data ?? [];
  const creditCardInvoices = creditCardInvoicesQuery.data ?? [];
  const loans = loansQuery.data ?? [];
  const loanInstallments = loanInstallmentsQuery.data ?? [];
  const retentionEntries = retentionEntriesQuery.data ?? [];
  const payables = payablesQuery.data ?? [];
  const payablesDashboard = payablesDashboardQuery.data;
  const dre = dreQuery.data;

  const salesRetentionLoans = useMemo(() => loans.filter((loan: any) => loan.loanType === "sales_retention"), [loans]);

  function getPaymentForCost(costId: number) {
    return fixedCostPayments.find((p: any) => p.fixedCostId === costId);
  }

  function getInvoiceForCard(cardId: number) {
    return creditCardInvoices.find((i: any) => i.cardId === cardId);
  }

  function getInstallmentForLoan(loanId: number) {
    return loanInstallments.find((i: any) => i.loanId === loanId);
  }

  const retentionByLoan = useMemo(() => {
    return retentionEntries.reduce((acc: Record<number, any[]>, entry: any) => {
      const loanId = entry.loanId;
      if (!acc[loanId]) acc[loanId] = [];
      acc[loanId].push(entry);
      return acc;
    }, {});
  }, [retentionEntries]);

  return (
    <DashboardLayout activeSection="financeiro">
      <div className="container max-w-7xl py-6 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Wallet className="h-7 w-7 text-primary" />
              Financeiro
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visão operacional com saúde financeira, DRE, contas a pagar, cartões, empréstimos e retenções do marketplace.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[150px] text-center text-sm font-semibold">
              {MONTHS[selectedMonth - 1]} {selectedYear}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-emerald-200 bg-emerald-50/70">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Resultado do mês</p>
                  <p className={`mt-2 text-2xl font-bold ${dre && dre.resultadoLiquido >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    R$ {fmt(dre?.resultadoLiquido)}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700/80">Usuário: {user?.name || "Operador"}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/70">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Contas em aberto</p>
                  <p className="mt-2 text-2xl font-bold text-amber-700">R$ {fmt(payablesDashboard?.totalPending)}</p>
                  <p className="mt-1 text-xs text-amber-700/80">{payablesDashboard?.pendingCount || 0} lançamentos pendentes</p>
                </div>
                <ShieldAlert className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-sky-200 bg-sky-50/70">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Retido pelo marketplace</p>
                  <p className="mt-2 text-2xl font-bold text-sky-700">R$ {fmt(dre?.totalRetencaoEmprestimos)}</p>
                  <p className="mt-1 text-xs text-sky-700/80">Abatimentos no período</p>
                </div>
                <Target className="h-8 w-8 text-sky-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => navigate(`/financeiro/${tab.key}`)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "visao" && (
          <div className="space-y-6">
            {dreQuery.isLoading ? (
              <div className="py-12 text-center text-muted-foreground">Carregando visão financeira...</div>
            ) : dre ? (
              <>
                {dre.alerts?.length > 0 && (
                  <div className="space-y-2">
                    {dre.alerts.map((alert: any, index: number) => (
                      <div
                        key={index}
                        className={`flex items-start gap-3 rounded-xl border p-3 ${
                          alert.type === "danger"
                            ? "border-red-200 bg-red-50 text-red-800"
                            : alert.type === "warning"
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-blue-200 bg-blue-50 text-blue-800"
                        }`}
                      >
                        {alert.type === "danger" ? (
                          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                        ) : alert.type === "warning" ? (
                          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        ) : (
                          <Info className="mt-0.5 h-5 w-5 shrink-0" />
                        )}
                        <span className="text-sm">{alert.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Card>
                    <CardContent className="pt-5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Receita bruta</p>
                      <p className="mt-2 text-2xl font-bold text-emerald-600">R$ {fmt(dre.receitaBruta)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Clientes + marketplace</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Despesas operacionais</p>
                      <p className="mt-2 text-2xl font-bold text-orange-600">R$ {fmt(dre.despesasOperacionais)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Inclui contas pagas, taxas e empréstimos</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saldo operacional</p>
                      <p className={`mt-2 text-2xl font-bold ${dre.saldoOperacional >= 0 ? "text-blue-600" : "text-red-600"}`}>
                        R$ {fmt(dre.saldoOperacional)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Entradas - saídas do mês</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saúde financeira</p>
                      <p className={`mt-2 text-2xl font-bold ${dre.health?.status === "saudavel" ? "text-emerald-600" : dre.health?.status === "atencao" ? "text-amber-600" : "text-red-600"}`}>
                        {dre.health?.status === "saudavel" ? "Saudável" : dre.health?.status === "atencao" ? "Atenção" : "Crítico"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Baseado em resultado, caixa e pendências</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle>DRE consolidado do período</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="border-b pb-2 font-semibold">Receitas</div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Receita total</span>
                        <span className="font-medium text-emerald-600">R$ {fmt(dre.receitaBruta)}</span>
                      </div>
                      <div className="flex justify-between pl-4 text-xs text-muted-foreground">
                        <span>Vendas clientes</span>
                        <span>R$ {fmt(dre.totalVendasClientes)}</span>
                      </div>
                      <div className="flex justify-between pl-4 text-xs text-muted-foreground">
                        <span>Vendas marketplace</span>
                        <span>R$ {fmt(dre.marketplaceSummary?.totalVendas)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CMV</span>
                        <span className="font-medium text-red-500">- R$ {fmt(dre.custoMercadoriaVendida)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Comissão Everton / Mondial</span>
                        <span className="font-medium text-red-500">- R$ {fmt(dre.totalComissaoEverton)}</span>
                      </div>
                      <div className="flex justify-between border-t py-2 font-semibold">
                        <span>Lucro bruto</span>
                        <span className="text-blue-600">R$ {fmt(dre.lucroBruto)}</span>
                      </div>

                      <div className="border-b pb-2 pt-4 font-semibold">Despesas operacionais</div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Custos fixos</span><span>- R$ {fmt(dre.totalCustosFixos)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Cartões</span><span>- R$ {fmt(dre.totalCartoes)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Empréstimos parcelados</span><span>- R$ {fmt(dre.totalEmprestimosMensais)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Retenção de empréstimos</span><span>- R$ {fmt(dre.totalRetencaoEmprestimos)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Taxas / antecipações / devoluções</span><span>- R$ {fmt(dre.totalTaxasMarketplace)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Contas pagas operacionais</span><span>- R$ {fmt(dre.totalContasPagas)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">LIS / cheque especial</span><span>- R$ {fmt(dre.totalLIS)}</span></div>
                      <div className="flex justify-between border-t py-2 font-semibold">
                        <span>Resultado líquido</span>
                        <span className={dre.resultadoLiquido >= 0 ? "text-emerald-600" : "text-red-600"}>R$ {fmt(dre.resultadoLiquido)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Saúde financeira</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="flex items-center justify-between"><span className="text-muted-foreground">Entradas</span><span className="font-medium text-emerald-600">R$ {fmt(dre.health?.entradas)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-muted-foreground">Saídas</span><span className="font-medium text-red-500">R$ {fmt(dre.health?.saidas)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-muted-foreground">Pendências</span><span className="font-medium text-amber-600">R$ {fmt(dre.health?.pendencias)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-muted-foreground">Atrasados</span><span className="font-medium text-red-600">R$ {fmt(dre.health?.atrasados)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-muted-foreground">Dinheiro parado / investimento</span><span className="font-medium text-sky-600">R$ {fmt(dre.health?.capitalParado)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-muted-foreground">Retido no Mercado Livre</span><span className="font-medium text-sky-600">R$ {fmt(dre.health?.retidoMercadoLivre)}</span></div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Fluxo médio</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-emerald-700">Média diária</span>
                            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                          </div>
                          <p className="mt-2 text-lg font-semibold text-emerald-700">R$ {fmt(dre.dailyDre?.resultado)}</p>
                          <p className="text-xs text-emerald-700/80">Entradas: R$ {fmt(dre.dailyDre?.entradas)} • Saídas: R$ {fmt(dre.dailyDre?.saidas)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-700">Fluxo mensal</span>
                            <ArrowDownRight className="h-4 w-4 text-slate-600" />
                          </div>
                          <p className="mt-2 text-lg font-semibold text-slate-800">R$ {fmt(dre.monthlyDre?.resultado)}</p>
                          <p className="text-xs text-slate-600">Entradas: R$ {fmt(dre.monthlyDre?.entradas)} • Saídas: R$ {fmt(dre.monthlyDre?.saidas)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Mercado Livre: composição do mês</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Vendas</span><span className="text-emerald-600">R$ {fmt(dre.marketplaceSummary?.totalVendas)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Taxas</span><span className="text-red-500">R$ {fmt(dre.marketplaceSummary?.totalTaxas)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Antecipações</span><span className="text-red-500">R$ {fmt(dre.marketplaceSummary?.totalAntecipacoes)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Devoluções</span><span className="text-red-500">R$ {fmt(dre.marketplaceSummary?.totalDevolucoes)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Abatimentos do empréstimo</span><span className="text-sky-600">R$ {fmt(dre.marketplaceSummary?.totalAbatimentosEmprestimo)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Ajustes</span><span className="text-amber-600">R$ {fmt(dre.marketplaceSummary?.totalAjustes)}</span></div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Pendências imediatas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Vencem amanhã</p>
                        <div className="mt-2 space-y-2">
                          {(payablesDashboard?.dueTomorrow ?? []).slice(0, 4).map((item: any) => (
                            <div key={item.id} className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{item.title}</span>
                                <span>R$ {fmt(item.amount)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">Vence em {item.dueDate}</p>
                            </div>
                          ))}
                          {(payablesDashboard?.dueTomorrow ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta com vencimento imediato.</p>}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Atrasadas</p>
                        <div className="mt-2 space-y-2">
                          {(payablesDashboard?.overdue ?? []).slice(0, 4).map((item: any) => (
                            <div key={item.id} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{item.title}</span>
                                <span>R$ {fmt(item.amount)}</span>
                              </div>
                              <p className="text-xs">Venceu em {item.dueDate}</p>
                            </div>
                          ))}
                          {(payablesDashboard?.overdue ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta atrasada no período.</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-muted-foreground">Nenhum dado disponível para este período.</div>
            )}
          </div>
        )}

        {activeTab === "pagar" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Contas a pagar operacionais</h2>
                <p className="text-sm text-muted-foreground">Registre boletos, fornecedores, impostos, parcelas e investimentos com alerta de vencimento.</p>
              </div>
              <Button size="sm" onClick={() => { resetPayableForm(); setShowPayableForm(true); }}>
                <Plus className="mr-1 h-4 w-4" /> Nova conta
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total pendente</p><p className="text-xl font-bold text-amber-600">R$ {fmt(payablesDashboard?.totalPending)}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total atrasado</p><p className="text-xl font-bold text-red-600">R$ {fmt(payablesDashboard?.totalOverdue)}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Pendências</p><p className="text-xl font-bold">{payablesDashboard?.pendingCount || 0}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Capital classificado</p><p className="text-xl font-bold text-sky-600">R$ {fmt(dre?.dinheiroParado)}</p></CardContent></Card>
            </div>

            {showPayableForm && (
              <Card className="border-primary/30">
                <CardContent className="grid gap-3 pt-4 lg:grid-cols-3">
                  <div>
                    <Label className="text-xs">Título</Label>
                    <Input value={payableTitle} onChange={(e) => setPayableTitle(e.target.value)} placeholder="Ex: Boleto transportadora" />
                  </div>
                  <div>
                    <Label className="text-xs">Fornecedor</Label>
                    <Input value={payableSupplier} onChange={(e) => setPayableSupplier(e.target.value)} placeholder="Opcional" />
                  </div>
                  <div>
                    <Label className="text-xs">Categoria</Label>
                    <Input value={payableCategory} onChange={(e) => setPayableCategory(e.target.value)} placeholder="Ex: logística" />
                  </div>
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={payableType} onValueChange={setPayableType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYABLE_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Valor</Label>
                    <Input type="number" step="0.01" value={payableAmount} onChange={(e) => setPayableAmount(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Vencimento</Label>
                    <Input type="date" value={payableDueDate} onChange={(e) => setPayableDueDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={payableStatus} onValueChange={(value: PayableStatus) => setPayableStatus(value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYABLE_STATUSES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Valor pago</Label>
                    <Input type="number" step="0.01" value={payablePaidAmount} onChange={(e) => setPayablePaidAmount(e.target.value)} placeholder="Opcional" />
                  </div>
                  <div>
                    <Label className="text-xs">Parcela</Label>
                    <Input value={payableInstallmentLabel} onChange={(e) => setPayableInstallmentLabel(e.target.value)} placeholder="Ex: 2/6" />
                  </div>
                  <div>
                    <Label className="text-xs">Lembrar antes (dias)</Label>
                    <Input type="number" min="0" max="30" value={payableReminderDaysBefore} onChange={(e) => setPayableReminderDaysBefore(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Forma de pagamento</Label>
                    <Input value={payablePaymentMethod} onChange={(e) => setPayablePaymentMethod(e.target.value)} placeholder="Pix, TED, cartão..." />
                  </div>
                  <div>
                    <Label className="text-xs">Classificar como investimento</Label>
                    <Select value={payableIsInvestment} onValueChange={setPayableIsInvestment}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Não</SelectItem>
                        <SelectItem value="1">Sim</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="lg:col-span-3">
                    <Label className="text-xs">Descrição</Label>
                    <Input value={payableDescription} onChange={(e) => setPayableDescription(e.target.value)} placeholder="Detalhes operacionais" />
                  </div>
                  <div className="lg:col-span-3">
                    <Label className="text-xs">Observações</Label>
                    <Input value={payableNotes} onChange={(e) => setPayableNotes(e.target.value)} placeholder="Observações e histórico" />
                  </div>
                  <div className="lg:col-span-3 flex gap-2">
                    <Button size="sm" onClick={() => {
                      if (!payableTitle || !payableAmount || !payableDueDate) {
                        toast.error("Preencha título, valor e vencimento.");
                        return;
                      }
                      const data = {
                        title: payableTitle,
                        supplier: payableSupplier || null,
                        category: payableCategory,
                        accountType: payableType as any,
                        amount: payableAmount,
                        dueDate: payableDueDate,
                        status: payableStatus,
                        paidAmount: payablePaidAmount || null,
                        paidAt: payableStatus === "paid" ? new Date() : null,
                        installmentLabel: payableInstallmentLabel || null,
                        reminderDaysBefore: parseInt(payableReminderDaysBefore || "1", 10),
                        description: payableDescription || null,
                        notes: payableNotes || null,
                        paymentMethod: payablePaymentMethod || null,
                        isInvestment: parseInt(payableIsInvestment, 10),
                      };
                      if (editingPayableId) updatePayableMutation.mutate({ id: editingPayableId, ...data });
                      else createPayableMutation.mutate(data);
                    }}>
                      <Check className="mr-1 h-4 w-4" /> {editingPayableId ? "Atualizar" : "Salvar"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={resetPayableForm}>
                      <X className="mr-1 h-4 w-4" /> Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              {payables.map((item: any) => (
                <Card key={item.id} className={item.status === "overdue" ? "border-red-200 bg-red-50/40" : item.status === "paid" ? "border-emerald-200 bg-emerald-50/40" : ""}>
                  <CardContent className="pt-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{item.title}</span>
                          <Badge variant="outline" className={statusBadgeClass(item.status)}>{PAYABLE_STATUSES.find((status) => status.value === item.status)?.label || item.status}</Badge>
                          <Badge variant="outline">{PAYABLE_TYPES.find((type) => type.value === item.accountType)?.label || item.accountType}</Badge>
                          {(item.isInvestment === 1 || item.accountType === "investimento") && <Badge className="bg-sky-100 text-sky-700">Investimento</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.supplier || "Sem fornecedor"} • Categoria: {item.category} • Vence em {item.dueDate}
                          {item.installmentLabel ? ` • Parcela ${item.installmentLabel}` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Valor: R$ {fmt(item.amount)} {item.paidAmount ? `• Pago: R$ ${fmt(item.paidAmount)}` : ""}
                          {item.paymentMethod ? ` • ${item.paymentMethod}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {item.status !== "paid" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => registerPayablePaymentMutation.mutate({
                              id: item.id,
                              paidAmount: String(item.amount),
                              paidAt: new Date(),
                              paymentMethod: item.paymentMethod || null,
                              notes: item.notes || null,
                            })}
                          >
                            <Check className="mr-1 h-3 w-3" /> Marcar pago
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                          setShowPayableForm(true);
                          setEditingPayableId(item.id);
                          setPayableTitle(item.title);
                          setPayableSupplier(item.supplier || "");
                          setPayableCategory(item.category || "operacional");
                          setPayableType(item.accountType);
                          setPayableAmount(String(item.amount));
                          setPayableDueDate(item.dueDate);
                          setPayableStatus(item.status);
                          setPayablePaidAmount(item.paidAmount ? String(item.paidAmount) : "");
                          setPayableInstallmentLabel(item.installmentLabel || "");
                          setPayableReminderDaysBefore(String(item.reminderDaysBefore || 1));
                          setPayablePaymentMethod(item.paymentMethod || "");
                          setPayableDescription(item.description || "");
                          setPayableNotes(item.notes || "");
                          setPayableIsInvestment(String(item.isInvestment || 0));
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                          if (confirm("Remover esta conta a pagar?")) deletePayableMutation.mutate({ id: item.id });
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {payables.length === 0 && <div className="py-10 text-center text-muted-foreground">Nenhuma conta a pagar cadastrada para este período.</div>}
            </div>
          </div>
        )}

        {activeTab === "custos" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Custos fixos</h2>
                <p className="text-sm text-muted-foreground">Mantenha a rotina mensal organizada e reflita os pagamentos no DRE.</p>
              </div>
              <Button size="sm" onClick={() => { resetCostForm(); setShowCostForm(true); }}>
                <Plus className="mr-1 h-4 w-4" /> Novo custo
              </Button>
            </div>

            {showCostForm && (
              <Card className="border-primary/30">
                <CardContent className="grid gap-3 pt-4 md:grid-cols-2">
                  <div><Label className="text-xs">Nome</Label><Input value={costName} onChange={(e) => setCostName(e.target.value)} /></div>
                  <div>
                    <Label className="text-xs">Categoria</Label>
                    <Select value={costCategory} onValueChange={setCostCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{FIXED_COST_CATEGORIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Valor</Label><Input type="number" step="0.01" value={costAmount} onChange={(e) => setCostAmount(e.target.value)} /></div>
                  <div><Label className="text-xs">Dia do vencimento</Label><Input type="number" min="1" max="31" value={costDueDay} onChange={(e) => setCostDueDay(e.target.value)} /></div>
                  <div className="md:col-span-2"><Label className="text-xs">Observações</Label><Input value={costNotes} onChange={(e) => setCostNotes(e.target.value)} /></div>
                  <div className="md:col-span-2 flex gap-2">
                    <Button size="sm" onClick={() => {
                      if (!costName || !costAmount) {
                        toast.error("Preencha nome e valor.");
                        return;
                      }
                      const data = { name: costName, category: costCategory, amount: costAmount, dueDay: parseInt(costDueDay, 10), notes: costNotes || null };
                      if (editingCostId) updateCostMutation.mutate({ id: editingCostId, ...data });
                      else createCostMutation.mutate(data);
                    }}><Check className="mr-1 h-4 w-4" /> {editingCostId ? "Atualizar" : "Salvar"}</Button>
                    <Button variant="outline" size="sm" onClick={resetCostForm}><X className="mr-1 h-4 w-4" /> Cancelar</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              {fixedCosts.map((cost: any) => {
                const payment = getPaymentForCost(cost.id);
                const isPaid = payment?.status === "paid";
                return (
                  <Card key={cost.id} className={isPaid ? "border-emerald-200 bg-emerald-50/40" : ""}>
                    <CardContent className="pt-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{cost.name}</span>
                            <Badge variant="outline">{FIXED_COST_CATEGORIES.find((item) => item.value === cost.category)?.label || cost.category}</Badge>
                            {isPaid && <Badge className="bg-emerald-100 text-emerald-700">Pago no mês</Badge>}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">R$ {fmt(cost.amount)} • Vence dia {cost.dueDay} {cost.notes ? `• ${cost.notes}` : ""}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => upsertPaymentMutation.mutate({ fixedCostId: cost.id, periodYear: selectedYear, periodMonth: selectedMonth, amountPaid: String(cost.amount), status: isPaid ? "pending" : "paid", paidAt: isPaid ? null : new Date(), notes: null })}>
                            <Check className="mr-1 h-3 w-3" /> {isPaid ? "Desfazer" : "Marcar pago"}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            setShowCostForm(true);
                            setEditingCostId(cost.id);
                            setCostName(cost.name);
                            setCostCategory(cost.category);
                            setCostAmount(String(cost.amount));
                            setCostDueDay(String(cost.dueDay));
                            setCostNotes(cost.notes || "");
                          }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                            if (confirm("Remover este custo fixo?")) deleteCostMutation.mutate({ id: cost.id });
                          }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {fixedCosts.length === 0 && <div className="py-10 text-center text-muted-foreground">Nenhum custo fixo cadastrado.</div>}
            </div>
          </div>
        )}

        {activeTab === "cartoes" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Cartões de crédito</h2>
                <p className="text-sm text-muted-foreground">Controle cadastro, limite e fatura mensal para refletir no DRE.</p>
              </div>
              <Button size="sm" onClick={() => { resetCardForm(); setShowCardForm(true); }}>
                <Plus className="mr-1 h-4 w-4" /> Novo cartão
              </Button>
            </div>

            {showCardForm && (
              <Card className="border-primary/30">
                <CardContent className="grid gap-3 pt-4 md:grid-cols-2 lg:grid-cols-3">
                  <div><Label className="text-xs">Nome</Label><Input value={cardName} onChange={(e) => setCardName(e.target.value)} /></div>
                  <div>
                    <Label className="text-xs">Bandeira</Label>
                    <Select value={cardBrand} onValueChange={setCardBrand}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CARD_BRANDS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Últimos 4 dígitos</Label><Input maxLength={4} value={cardLastFour} onChange={(e) => setCardLastFour(e.target.value)} /></div>
                  <div><Label className="text-xs">Limite</Label><Input type="number" step="0.01" value={cardLimit} onChange={(e) => setCardLimit(e.target.value)} /></div>
                  <div><Label className="text-xs">Fechamento</Label><Input type="number" min="1" max="31" value={cardClosingDay} onChange={(e) => setCardClosingDay(e.target.value)} /></div>
                  <div><Label className="text-xs">Vencimento</Label><Input type="number" min="1" max="31" value={cardDueDay} onChange={(e) => setCardDueDay(e.target.value)} /></div>
                  <div className="md:col-span-2 lg:col-span-3"><Label className="text-xs">Observações</Label><Input value={cardNotes} onChange={(e) => setCardNotes(e.target.value)} /></div>
                  <div className="md:col-span-2 lg:col-span-3 flex gap-2">
                    <Button size="sm" onClick={() => {
                      if (!cardName) {
                        toast.error("Informe o nome do cartão.");
                        return;
                      }
                      const data = { name: cardName, brand: cardBrand, lastFourDigits: cardLastFour || null, closingDay: parseInt(cardClosingDay, 10), dueDay: parseInt(cardDueDay, 10), creditLimit: cardLimit || null, notes: cardNotes || null };
                      if (editingCardId) updateCardMutation.mutate({ id: editingCardId, ...data });
                      else createCardMutation.mutate(data);
                    }}><Check className="mr-1 h-4 w-4" /> {editingCardId ? "Atualizar" : "Salvar"}</Button>
                    <Button variant="outline" size="sm" onClick={resetCardForm}><X className="mr-1 h-4 w-4" /> Cancelar</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              {creditCards.map((card: any) => {
                const invoice = getInvoiceForCard(card.id);
                const editingInvoice = editingInvoiceCardId === card.id;
                return (
                  <Card key={card.id}>
                    <CardContent className="pt-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <CreditCard className="h-4 w-4 text-primary" />
                            <span className="font-semibold">{card.name}</span>
                            <Badge variant="outline">{CARD_BRANDS.find((item) => item.value === card.brand)?.label || card.brand}</Badge>
                            {card.lastFourDigits && <span className="text-xs text-muted-foreground">****{card.lastFourDigits}</span>}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">Fecha dia {card.closingDay} • Vence dia {card.dueDay} {card.creditLimit ? `• Limite: R$ ${fmt(card.creditLimit)}` : ""}</p>
                          {invoice && !editingInvoice && (
                            <div className="mt-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">Fatura do mês: R$ {fmt(invoice.totalAmount)}</span>
                                <Badge variant="outline" className={statusBadgeClass(invoice.status)}>{invoice.status === "paid" ? "Pago" : invoice.status === "partial" ? "Parcial" : "Pendente"}</Badge>
                                {invoice.amountPaid && <span className="text-muted-foreground">Pago: R$ {fmt(invoice.amountPaid)}</span>}
                              </div>
                            </div>
                          )}
                          {editingInvoice && (
                            <div className="mt-3 grid gap-3 rounded-lg border bg-muted/40 p-3 md:grid-cols-3">
                              <div><Label className="text-xs">Valor da fatura</Label><Input type="number" step="0.01" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} /></div>
                              <div><Label className="text-xs">Valor pago</Label><Input type="number" step="0.01" value={invoiceAmountPaid} onChange={(e) => setInvoiceAmountPaid(e.target.value)} /></div>
                              <div>
                                <Label className="text-xs">Status</Label>
                                <Select value={invoiceStatus} onValueChange={(value: any) => setInvoiceStatus(value)}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="paid">Pago</SelectItem>
                                    <SelectItem value="pending">Pendente</SelectItem>
                                    <SelectItem value="partial">Parcial</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="md:col-span-3 flex gap-2">
                                <Button size="sm" onClick={() => {
                                  if (!invoiceAmount) {
                                    toast.error("Informe o valor da fatura.");
                                    return;
                                  }
                                  upsertInvoiceMutation.mutate({ cardId: card.id, periodYear: selectedYear, periodMonth: selectedMonth, totalAmount: invoiceAmount, minimumAmount: null, amountPaid: invoiceAmountPaid || null, status: invoiceStatus, paidAt: invoiceStatus === "paid" ? new Date() : null, notes: null });
                                }}><Check className="mr-1 h-3 w-3" /> Salvar fatura</Button>
                                <Button variant="outline" size="sm" onClick={() => setEditingInvoiceCardId(null)}><X className="mr-1 h-3 w-3" /> Cancelar</Button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => {
                            setEditingInvoiceCardId(card.id);
                            setInvoiceAmount(invoice ? String(invoice.totalAmount) : "");
                            setInvoiceAmountPaid(invoice?.amountPaid ? String(invoice.amountPaid) : "");
                            setInvoiceStatus(invoice?.status || "pending");
                          }}><Receipt className="mr-1 h-3 w-3" /> Fatura</Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            setShowCardForm(true);
                            setEditingCardId(card.id);
                            setCardName(card.name);
                            setCardBrand(card.brand);
                            setCardLastFour(card.lastFourDigits || "");
                            setCardClosingDay(String(card.closingDay));
                            setCardDueDay(String(card.dueDay));
                            setCardLimit(card.creditLimit ? String(card.creditLimit) : "");
                            setCardNotes(card.notes || "");
                          }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                            if (confirm("Remover este cartão?")) deleteCardMutation.mutate({ id: card.id });
                          }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {creditCards.length === 0 && <div className="py-10 text-center text-muted-foreground">Nenhum cartão cadastrado.</div>}
            </div>
          </div>
        )}

        {activeTab === "emprestimos" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Empréstimos e retenções</h2>
                <p className="text-sm text-muted-foreground">Cadastre empréstimos parcelados e contratos com retenção sobre vendas do Mercado Livre.</p>
              </div>
              <Button size="sm" onClick={() => { resetLoanForm(); setShowLoanForm(true); }}>
                <Plus className="mr-1 h-4 w-4" /> Novo empréstimo
              </Button>
            </div>

            {showLoanForm && (
              <Card className="border-primary/30">
                <CardContent className="grid gap-3 pt-4 md:grid-cols-2 lg:grid-cols-3">
                  <div><Label className="text-xs">Nome</Label><Input value={loanName} onChange={(e) => setLoanName(e.target.value)} /></div>
                  <div><Label className="text-xs">Instituição</Label><Input value={loanInstitution} onChange={(e) => setLoanInstitution(e.target.value)} /></div>
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={loanType} onValueChange={(value: LoanType) => setLoanType(value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="installment">Parcelado</SelectItem>
                        <SelectItem value="sales_retention">Retenção sobre vendas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Valor total</Label><Input type="number" step="0.01" value={loanTotalAmount} onChange={(e) => setLoanTotalAmount(e.target.value)} /></div>
                  <div><Label className="text-xs">Data de início</Label><Input type="date" value={loanStartDate} onChange={(e) => setLoanStartDate(e.target.value)} /></div>
                  <div><Label className="text-xs">Juros mensal (%)</Label><Input type="number" step="0.01" value={loanInterestRate} onChange={(e) => setLoanInterestRate(e.target.value)} /></div>
                  {loanType === "installment" ? (
                    <>
                      <div><Label className="text-xs">Número de parcelas</Label><Input type="number" value={loanTotalInstallments} onChange={(e) => setLoanTotalInstallments(e.target.value)} /></div>
                      <div><Label className="text-xs">Valor da parcela</Label><Input type="number" step="0.01" value={loanInstallmentAmount} onChange={(e) => setLoanInstallmentAmount(e.target.value)} /></div>
                      <div><Label className="text-xs">Dia do vencimento</Label><Input type="number" min="1" max="31" value={loanDueDay} onChange={(e) => setLoanDueDay(e.target.value)} /></div>
                    </>
                  ) : (
                    <>
                      <div><Label className="text-xs">Percentual de retenção (%)</Label><Input type="number" step="0.01" value={loanRetentionPercent} onChange={(e) => setLoanRetentionPercent(e.target.value)} /></div>
                      <div><Label className="text-xs">Fonte da retenção</Label><Input value={loanRetentionSource} onChange={(e) => setLoanRetentionSource(e.target.value)} placeholder="mercado_livre" /></div>
                      <div className="hidden lg:block" />
                    </>
                  )}
                  <div className="md:col-span-2 lg:col-span-3"><Label className="text-xs">Observações</Label><Input value={loanNotes} onChange={(e) => setLoanNotes(e.target.value)} /></div>
                  <div className="md:col-span-2 lg:col-span-3 flex gap-2">
                    <Button size="sm" onClick={() => {
                      if (!loanName || !loanInstitution || !loanTotalAmount || !loanStartDate) {
                        toast.error("Preencha os campos obrigatórios do empréstimo.");
                        return;
                      }
                      const data = {
                        name: loanName,
                        institution: loanInstitution,
                        loanType,
                        totalAmount: loanTotalAmount,
                        totalInstallments: loanType === "installment" ? parseInt(loanTotalInstallments || "0", 10) : null,
                        installmentAmount: loanType === "installment" ? loanInstallmentAmount || null : null,
                        interestRate: loanInterestRate || null,
                        startDate: loanStartDate,
                        dueDay: loanType === "installment" ? parseInt(loanDueDay || "1", 10) : null,
                        retentionPercent: loanType === "sales_retention" ? loanRetentionPercent || null : null,
                        retentionSource: loanType === "sales_retention" ? loanRetentionSource || null : null,
                        notes: loanNotes || null,
                      };
                      if (editingLoanId) updateLoanMutation.mutate({ id: editingLoanId, ...data });
                      else createLoanMutation.mutate(data);
                    }}><Check className="mr-1 h-4 w-4" /> {editingLoanId ? "Atualizar" : "Salvar"}</Button>
                    <Button variant="outline" size="sm" onClick={resetLoanForm}><X className="mr-1 h-4 w-4" /> Cancelar</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              {loans.map((loan: any) => {
                const installment = getInstallmentForLoan(loan.id);
                const loanRetentions = retentionByLoan[loan.id] ?? [];
                return (
                  <Card key={loan.id}>
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Landmark className="h-4 w-4 text-primary" />
                            <span className="font-semibold">{loan.name}</span>
                            <Badge variant="outline">{loan.institution}</Badge>
                            <Badge className={loan.loanType === "sales_retention" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700"}>
                              {loan.loanType === "sales_retention" ? "Retenção" : "Parcelado"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Total: R$ {fmt(loan.totalAmount)} • Pago/abatido: R$ {fmt(loan.totalPaid)} • Saldo: R$ {fmt(parseFloat(String(loan.totalAmount || 0)) - parseFloat(String(loan.totalPaid || 0)))}
                          </p>
                          {loan.loanType === "installment" ? (
                            <p className="text-sm text-muted-foreground">{loan.totalInstallments || 0}x de R$ {fmt(loan.installmentAmount)} • Vencimento dia {loan.dueDay || "-"}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">Fonte: {loan.retentionSource || "mercado_livre"} • Retenção: {loan.retentionPercent ? `${loan.retentionPercent}%` : "-"}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {loan.loanType === "installment" && (
                            <Button variant="outline" size="sm" onClick={() => upsertInstallmentMutation.mutate({ loanId: loan.id, installmentNumber: selectedMonth, periodYear: selectedYear, periodMonth: selectedMonth, amount: String(loan.installmentAmount || 0), status: installment?.status === "paid" ? "pending" : "paid", paidAt: installment?.status === "paid" ? null : new Date(), notes: null })}>
                              <Check className="mr-1 h-3 w-3" /> {installment?.status === "paid" ? "Desfazer parcela" : "Marcar parcela paga"}
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            setShowLoanForm(true);
                            setEditingLoanId(loan.id);
                            setLoanName(loan.name);
                            setLoanInstitution(loan.institution);
                            setLoanType(loan.loanType);
                            setLoanTotalAmount(String(loan.totalAmount));
                            setLoanTotalInstallments(loan.totalInstallments ? String(loan.totalInstallments) : "");
                            setLoanInstallmentAmount(loan.installmentAmount ? String(loan.installmentAmount) : "");
                            setLoanInterestRate(loan.interestRate ? String(loan.interestRate) : "");
                            setLoanStartDate(loan.startDate);
                            setLoanDueDay(loan.dueDay ? String(loan.dueDay) : "1");
                            setLoanRetentionPercent(loan.retentionPercent ? String(loan.retentionPercent) : "20");
                            setLoanRetentionSource(loan.retentionSource || "mercado_livre");
                            setLoanNotes(loan.notes || "");
                          }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                            if (confirm("Remover este empréstimo?")) deleteLoanMutation.mutate({ id: loan.id });
                          }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>

                      {loan.loanType === "installment" && installment && (
                        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                          Parcela do mês: R$ {fmt(installment.amount)} • <span className="font-medium">{installment.status === "paid" ? "Paga" : "Pendente"}</span>
                        </div>
                      )}

                      {loan.loanType === "sales_retention" && (
                        <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/50 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-medium text-sky-900">Lançar retenção / movimento do marketplace</p>
                              <p className="text-xs text-sky-700">Use para registrar vendas, taxas, devoluções, antecipações e abatimentos do empréstimo.</p>
                            </div>
                            <Button size="sm" variant={editingRetentionLoanId === loan.id ? "secondary" : "outline"} onClick={() => {
                              setEditingRetentionLoanId(editingRetentionLoanId === loan.id ? null : loan.id);
                              setRetentionPercentApplied(loan.retentionPercent ? String(loan.retentionPercent) : "");
                            }}>
                              <Plus className="mr-1 h-3 w-3" /> {editingRetentionLoanId === loan.id ? "Fechar" : "Novo movimento"}
                            </Button>
                          </div>

                          {editingRetentionLoanId === loan.id && (
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                              <div><Label className="text-xs">Data</Label><Input type="date" value={retentionDate} onChange={(e) => setRetentionDate(e.target.value)} /></div>
                              <div>
                                <Label className="text-xs">Categoria</Label>
                                <Select value={retentionCategory} onValueChange={setRetentionCategory}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>{RETENTION_CATEGORIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <div><Label className="text-xs">Valor bruto</Label><Input type="number" step="0.01" value={retentionGross} onChange={(e) => setRetentionGross(e.target.value)} /></div>
                              <div><Label className="text-xs">Valor líquido</Label><Input type="number" step="0.01" value={retentionNet} onChange={(e) => setRetentionNet(e.target.value)} /></div>
                              <div><Label className="text-xs">Retido/abatido</Label><Input type="number" step="0.01" value={retentionAmount} onChange={(e) => setRetentionAmount(e.target.value)} /></div>
                              <div><Label className="text-xs">% aplicado</Label><Input type="number" step="0.01" value={retentionPercentApplied} onChange={(e) => setRetentionPercentApplied(e.target.value)} /></div>
                              <div><Label className="text-xs">Referência</Label><Input value={retentionReference} onChange={(e) => setRetentionReference(e.target.value)} placeholder="Pedido, repasse, lote" /></div>
                              <div><Label className="text-xs">Observações</Label><Input value={retentionNotes} onChange={(e) => setRetentionNotes(e.target.value)} /></div>
                              <div className="lg:col-span-4 flex gap-2">
                                <Button size="sm" onClick={() => {
                                  if (!retentionDate || !retentionAmount) {
                                    toast.error("Informe data e valor retido.");
                                    return;
                                  }
                                  createRetentionMutation.mutate({
                                    loanId: loan.id,
                                    entryDate: retentionDate,
                                    periodYear: Number(retentionDate.slice(0, 4)),
                                    periodMonth: Number(retentionDate.slice(5, 7)),
                                    entryType: "manual",
                                    eventCategory: retentionCategory as any,
                                    grossAmount: retentionGross || null,
                                    netAmount: retentionNet || null,
                                    retentionPercentApplied: retentionPercentApplied || null,
                                    retainedAmount: retentionAmount,
                                    sourceReference: retentionReference || null,
                                    notes: retentionNotes || null,
                                  });
                                }}><Check className="mr-1 h-4 w-4" /> Lançar movimento</Button>
                                <Button variant="outline" size="sm" onClick={resetRetentionForm}><X className="mr-1 h-4 w-4" /> Limpar</Button>
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            {loanRetentions.length > 0 ? loanRetentions.map((entry: any) => (
                              <div key={entry.id} className="rounded-lg border bg-white/80 px-3 py-2 text-sm">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className="font-medium">{RETENTION_CATEGORIES.find((item) => item.value === entry.eventCategory)?.label || entry.eventCategory}</p>
                                    <p className="text-xs text-muted-foreground">{entry.entryDate} {entry.sourceReference ? `• ${entry.sourceReference}` : ""}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-sky-700">R$ {fmt(entry.retainedAmount)}</p>
                                    <p className="text-xs text-muted-foreground">Bruto: R$ {fmt(entry.grossAmount)} • Líquido: R$ {fmt(entry.netAmount)}</p>
                                  </div>
                                </div>
                              </div>
                            )) : <p className="text-sm text-sky-800">Nenhum movimento de retenção registrado neste período.</p>}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {loans.length === 0 && <div className="py-10 text-center text-muted-foreground">Nenhum empréstimo cadastrado.</div>}
            </div>

            {salesRetentionLoans.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Resumo de empréstimos por retenção</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {salesRetentionLoans.map((loan: any) => {
                    const saldo = parseFloat(String(loan.totalAmount || 0)) - parseFloat(String(loan.totalPaid || 0));
                    return (
                      <div key={loan.id} className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-sky-900">{loan.name}</p>
                            <p className="text-xs text-sky-700">{loan.institution}</p>
                          </div>
                          <Building2 className="h-5 w-5 text-sky-600" />
                        </div>
                        <div className="mt-4 space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-sky-800/80">Contratado</span><span>R$ {fmt(loan.totalAmount)}</span></div>
                          <div className="flex justify-between"><span className="text-sky-800/80">Abatido</span><span>R$ {fmt(loan.totalPaid)}</span></div>
                          <div className="flex justify-between font-semibold"><span>Saldo</span><span>R$ {fmt(saldo)}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
