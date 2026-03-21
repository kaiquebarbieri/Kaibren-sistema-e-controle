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
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
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

const SIMULATED_FIXED_COSTS = [
  { name: "Aluguel", amount: 5000 },
  { name: "Funcionário", amount: 5000 },
  { name: "Carro alugado", amount: 3000 },
  { name: "Água e luz", amount: 500 },
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
  const [selectedCnpjId, setSelectedCnpjId] = useState<string>("all");

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

  const cnpjsQuery = trpc.myCnpjs.list.useQuery();
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
  const statementsQuery = trpc.bankStatements.list.useQuery();

  const utils = trpc.useUtils();
  const cnpjs = cnpjsQuery.data ?? [];
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
  const statements = statementsQuery.data ?? [];

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
      utils.bankStatements.list.invalidate(),
    ]);
  };

  const createCostMutation = trpc.finance.fixedCosts.create.useMutation({ onSuccess: async () => { await invalidateFinance(); resetCostForm(); toast.success("Custo fixo cadastrado."); } });
  const updateCostMutation = trpc.finance.fixedCosts.update.useMutation({ onSuccess: async () => { await invalidateFinance(); resetCostForm(); toast.success("Custo fixo atualizado."); } });
  const deleteCostMutation = trpc.finance.fixedCosts.delete.useMutation({ onSuccess: async () => { await invalidateFinance(); toast.success("Custo fixo removido."); } });
  const upsertPaymentMutation = trpc.finance.fixedCosts.upsertPayment.useMutation({ onSuccess: async () => { await invalidateFinance(); toast.success("Pagamento de custo fixo atualizado."); } });
  const createCardMutation = trpc.finance.creditCards.create.useMutation({ onSuccess: async () => { await invalidateFinance(); resetCardForm(); toast.success("Cartão cadastrado."); } });
  const updateCardMutation = trpc.finance.creditCards.update.useMutation({ onSuccess: async () => { await invalidateFinance(); resetCardForm(); toast.success("Cartão atualizado."); } });
  const deleteCardMutation = trpc.finance.creditCards.delete.useMutation({ onSuccess: async () => { await invalidateFinance(); toast.success("Cartão removido."); } });
  const upsertInvoiceMutation = trpc.finance.creditCards.upsertInvoice.useMutation({ onSuccess: async () => { await invalidateFinance(); setEditingInvoiceCardId(null); setInvoiceAmount(""); setInvoiceAmountPaid(""); setInvoiceStatus("pending"); toast.success("Fatura atualizada."); } });
  const createLoanMutation = trpc.finance.loans.create.useMutation({ onSuccess: async () => { await invalidateFinance(); resetLoanForm(); toast.success("Empréstimo cadastrado."); } });
  const updateLoanMutation = trpc.finance.loans.update.useMutation({ onSuccess: async () => { await invalidateFinance(); resetLoanForm(); toast.success("Empréstimo atualizado."); } });
  const deleteLoanMutation = trpc.finance.loans.delete.useMutation({ onSuccess: async () => { await invalidateFinance(); toast.success("Empréstimo removido."); } });
  const createPayableMutation = trpc.finance.payables.create.useMutation({ onSuccess: async () => { await invalidateFinance(); resetPayableForm(); toast.success("Conta a pagar cadastrada."); } });
  const updatePayableMutation = trpc.finance.payables.update.useMutation({ onSuccess: async () => { await invalidateFinance(); resetPayableForm(); toast.success("Conta a pagar atualizada."); } });
  const deletePayableMutation = trpc.finance.payables.delete.useMutation({ onSuccess: async () => { await invalidateFinance(); toast.success("Conta removida."); } });

  const tabs = [
    { key: "visao", label: "Saúde + fechamento", icon: Wallet },
    { key: "pagar", label: "Contas a pagar", icon: Receipt },
    { key: "custos", label: "Custos fixos", icon: Building2 },
    { key: "cartoes", label: "Cartões", icon: CreditCard },
    { key: "emprestimos", label: "Empréstimos", icon: Landmark },
  ] as const;

  const selectedCnpj = useMemo(() => cnpjs.find((item: any) => String(item.id) === selectedCnpjId) ?? null, [cnpjs, selectedCnpjId]);
  const cnpjLabel = selectedCnpj ? `${selectedCnpj.nomeFantasia || selectedCnpj.razaoSocial} • ${selectedCnpj.cnpj}` : "Todos os CNPJs cadastrados";

  const currentMonthStatements = useMemo(() => {
    return statements.filter((statement: any) => {
      const matchesPeriod = Number(statement.periodYear) === selectedYear && Number(statement.periodMonth) === selectedMonth;
      const matchesCnpj = selectedCnpjId === "all" ? true : String(statement.cnpjId) === selectedCnpjId;
      return matchesPeriod && matchesCnpj;
    });
  }, [statements, selectedYear, selectedMonth, selectedCnpjId]);

  const allBankNames = useMemo(() => Array.from(new Set(currentMonthStatements.map((statement: any) => statement.bankName).filter(Boolean))), [currentMonthStatements]);
  const mercadoPagoStatements = useMemo(() => currentMonthStatements.filter((statement: any) => String(statement.bankName || "").toLowerCase().includes("mercado pago")), [currentMonthStatements]);
  const nonMercadoPagoStatements = useMemo(() => currentMonthStatements.filter((statement: any) => !String(statement.bankName || "").toLowerCase().includes("mercado pago")), [currentMonthStatements]);

  const bankSummary = useMemo(() => {
    const entradas = Number(dre?.entradasTotais || 0);
    const saidas = Number(dre?.saidasTotais || 0);
    const identificadas = currentMonthStatements.reduce((sum: number, statement: any) => {
      const isMercadoPago = String(statement.bankName || "").toLowerCase().includes("mercado pago");
      return sum + (isMercadoPago ? Number(statement.totalIdentified || 0) : 0);
    }, 0);
    const totalTransactions = currentMonthStatements.reduce((sum: number, statement: any) => {
      const isMercadoPago = String(statement.bankName || "").toLowerCase().includes("mercado pago");
      return sum + (isMercadoPago ? Number(statement.totalTransactions || 0) : 0);
    }, 0);

    return {
      entradas,
      saidas,
      saldo: entradas - saidas,
      identificadas,
      pendentes: Math.max(totalTransactions - identificadas, 0),
    };
  }, [dre?.entradasTotais, dre?.saidasTotais, currentMonthStatements]);

  const categoryTotals = useMemo(() => {
    const entries = [
      { category: "Contas a pagar", amount: Number(dre?.totalContasPagas || 0) },
      { category: "Custos fixos", amount: Number(dre?.totalCustosFixos || 0) },
      { category: "Cartões", amount: Number(dre?.totalCartoes || 0) },
      { category: "Parcelas de empréstimos", amount: Number(dre?.totalEmprestimosMensais || 0) },
      { category: "Retenções do marketplace", amount: Number(dre?.totalRetencaoEmprestimos || 0) },
      { category: "LIS / Cheque especial", amount: Number(dre?.totalLIS || 0) },
    ];
    return entries.filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 6);
  }, [dre?.totalContasPagas, dre?.totalCustosFixos, dre?.totalCartoes, dre?.totalEmprestimosMensais, dre?.totalRetencaoEmprestimos, dre?.totalLIS]);

  const identifiedCredits = useMemo(() => {
    return currentMonthStatements
      .flatMap((statement: any) => Array.isArray(statement.transactions) ? statement.transactions : [])
      .filter((item: any) => item.transactionType === "credit")
      .slice(0, 5);
  }, [currentMonthStatements]);

  const identifiedDebits = useMemo(() => {
    return currentMonthStatements
      .flatMap((statement: any) => Array.isArray(statement.transactions) ? statement.transactions : [])
      .filter((item: any) => item.transactionType === "debit")
      .slice(0, 5);
  }, [currentMonthStatements]);

  const mercadoPagoSummary = useMemo(() => {
    const totalMercadoPago = mercadoPagoStatements.reduce((sum: number, statement: any) => sum + Number(statement.totalTransactions || 0), 0);
    const identifiedMercadoPago = mercadoPagoStatements.reduce((sum: number, statement: any) => sum + Number(statement.totalIdentified || 0), 0);
    const repassesParaC6 = mercadoPagoStatements.reduce((sum: number, statement: any) => {
      const transactions = Array.isArray(statement.transactions) ? statement.transactions : [];
      return sum + transactions.filter((item: any) => String(item.category || "").toLowerCase().includes("repasse para c6 bank")).length;
    }, 0);
    const estimatedTransfers = mercadoPagoStatements.reduce((sum: number, statement: any) => {
      const transactions = Array.isArray(statement.transactions) ? statement.transactions : [];
      return sum + transactions
        .filter((item: any) => String(item.category || "").toLowerCase().includes("repasse para c6 bank"))
        .reduce((inner: number, item: any) => inner + Number(item.amount || 0), 0);
    }, 0);
    return {
      statementCount: mercadoPagoStatements.length,
      totalMercadoPago,
      identifiedMercadoPago,
      repassesParaC6,
      estimatedTransfers,
      estimatedPending: Math.max(totalMercadoPago - identifiedMercadoPago, 0),
    };
  }, [mercadoPagoStatements]);

  const simulatedFixedCostTotal = SIMULATED_FIXED_COSTS.reduce((sum, item) => sum + item.amount, 0);
  const manualOutflows = Number(dre?.totalCartoes || 0) + Number(dre?.totalEmprestimosMensais || 0) + Number(dre?.totalRetencaoEmprestimos || 0) + Number(dre?.totalContasPagas || 0) + Number(dre?.totalLIS || 0);
  const simulatedClosing = useMemo(() => {
    const entradas = bankSummary.entradas;
    const saidasBancarias = bankSummary.saidas;
    const saldoBancario = entradas - saidasBancarias;
    const projectedResult = saldoBancario - simulatedFixedCostTotal - manualOutflows;
    return {
      bankCount: allBankNames.length,
      banks: allBankNames,
      entradas,
      saidasBancarias,
      saldoBancario,
      simulatedFixedCostTotal,
      manualOutflows,
      projectedResult,
    };
  }, [bankSummary, allBankNames, simulatedFixedCostTotal, manualOutflows]);

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

  function submitCost() { toast.info("Use os cadastros para alimentar os valores reais depois da simulação inicial."); }
  function submitCard() { toast.info("A simulação atual usa apenas os dados já cadastrados no Financeiro."); }
  function submitInvoice(cardId: number) { void cardId; toast.info("Mantenha as faturas reais cadastradas para compor o fechamento."); }
  function submitLoan() { toast.info("Cadastre os empréstimos reais para refletir no fechamento consolidado."); }
  function submitRetention(loanId: number) { void loanId; toast.info("Os movimentos do marketplace continuam entrando pelo módulo de empréstimos/retenções."); }
  function submitPayable() { toast.info("Cadastre as contas reais para substituir a simulação quando desejar."); }

  return (
    <DashboardLayout activeSection="financeiro" onNavigate={(section) => navigate(`/${section}`)}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Badge variant="outline" className="w-fit">Financeiro operacional</Badge>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Fechamento financeiro por extrato</h1>
                <p className="text-sm text-muted-foreground">
                  O fechamento considera os extratos bancários enviados e os lançamentos manuais do Financeiro. A identificação automática fica restrita ao Mercado Pago; os demais bancos permanecem para classificação manual.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-[260px] rounded-xl border bg-card px-3 py-2 shadow-sm">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">CNPJ / subconta</Label>
                <Select value={selectedCnpjId} onValueChange={setSelectedCnpjId}>
                  <SelectTrigger className="mt-1 border-0 px-0 shadow-none focus:ring-0">
                    <SelectValue placeholder="Selecione o CNPJ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os CNPJs</SelectItem>
                    {cnpjs.map((item: any) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {(item.nomeFantasia || item.razaoSocial)} • {item.cnpj}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-sm">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="min-w-[150px] text-center text-sm font-semibold">{MONTHS[selectedMonth - 1]} {selectedYear}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-emerald-200 bg-emerald-50/70"><CardContent className="pt-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Entradas bancárias</p><p className="mt-2 text-2xl font-bold text-emerald-700">R$ {fmt(bankSummary.entradas)}</p><p className="mt-1 text-xs text-emerald-700/80">{cnpjLabel}</p></div><TrendingUp className="h-8 w-8 text-emerald-500" /></div></CardContent></Card>
          <Card className="border-rose-200 bg-rose-50/70"><CardContent className="pt-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Saídas bancárias</p><p className="mt-2 text-2xl font-bold text-rose-700">R$ {fmt(bankSummary.saidas)}</p><p className="mt-1 text-xs text-rose-700/80">Débitos lidos dos extratos</p></div><TrendingDown className="h-8 w-8 text-rose-500" /></div></CardContent></Card>
          <Card className="border-sky-200 bg-sky-50/70"><CardContent className="pt-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Repasses Mercado Pago → C6</p><p className="mt-2 text-2xl font-bold text-sky-700">{mercadoPagoSummary.repassesParaC6}</p><p className="mt-1 text-xs text-sky-700/80">Só o Mercado Pago é identificado automaticamente</p></div><Target className="h-8 w-8 text-sky-500" /></div></CardContent></Card>
          <Card className="border-violet-200 bg-violet-50/70"><CardContent className="pt-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Bancos na simulação</p><p className="mt-2 text-2xl font-bold text-violet-700">{simulatedClosing.bankCount}</p><p className="mt-1 text-xs text-violet-700/80">{simulatedClosing.banks.length > 0 ? simulatedClosing.banks.join(" • ") : "Nenhum extrato no período"}</p></div><Building2 className="h-8 w-8 text-violet-500" /></div></CardContent></Card>
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => navigate(`/financeiro/${tab.key}`)} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "visao" && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card><CardContent className="pt-5"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saldo do período</p><p className={`mt-2 text-2xl font-bold ${bankSummary.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>R$ {fmt(bankSummary.saldo)}</p><p className="mt-1 text-xs text-muted-foreground">Entradas menos saídas dos extratos do mês</p></CardContent></Card>
              <Card><CardContent className="pt-5"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contas pendentes</p><p className="mt-2 text-2xl font-bold text-amber-600">R$ {fmt(payablesDashboard?.totalPending)}</p><p className="mt-1 text-xs text-muted-foreground">Compromissos manuais ainda em aberto</p></CardContent></Card>
              <Card><CardContent className="pt-5"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Extratos do mês</p><p className="mt-2 text-2xl font-bold text-slate-900">{currentMonthStatements.length}</p><p className="mt-1 text-xs text-muted-foreground">{nonMercadoPagoStatements.length} bancos manuais + {mercadoPagoStatements.length} Mercado Pago</p></CardContent></Card>
              <Card><CardContent className="pt-5"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Identificação automática</p><p className="mt-2 text-2xl font-bold text-blue-600">{mercadoPagoSummary.identifiedMercadoPago}</p><p className="mt-1 text-xs text-muted-foreground">Somente movimentos do Mercado Pago</p></CardContent></Card>
            </div>

            {(bankSummary.pendentes > 0 || (payablesDashboard?.overdue?.length ?? 0) > 0) && (
              <div className="space-y-2">
                {bankSummary.pendentes > 0 && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span className="text-sm">O sistema só identifica automaticamente o Mercado Pago. Ainda existem {bankSummary.pendentes} movimentos desse extrato sem classificação automática concluída.</span>
                  </div>
                )}
                {(payablesDashboard?.overdue?.length ?? 0) > 0 && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span className="text-sm">Existem {(payablesDashboard?.overdue?.length ?? 0)} contas atrasadas registradas para o período analisado.</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <Card>
                <CardHeader><CardTitle>Fechamento financeiro com simulação atual</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="border-b pb-2 font-semibold">Movimento bancário considerado</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Entradas confirmadas nos extratos</span><span className="font-medium text-emerald-600">R$ {fmt(simulatedClosing.entradas)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Saídas confirmadas nos extratos</span><span className="font-medium text-red-500">- R$ {fmt(simulatedClosing.saidasBancarias)}</span></div>
                  <div className="flex justify-between border-t py-2 font-semibold"><span>Saldo apurado pelos bancos</span><span className={simulatedClosing.saldoBancario >= 0 ? "text-emerald-600" : "text-red-600"}>R$ {fmt(simulatedClosing.saldoBancario)}</span></div>

                  <div className="border-b pb-2 pt-4 font-semibold">Custos fixos simulados desta fase</div>
                  {SIMULATED_FIXED_COSTS.map((item) => (
                    <div key={item.name} className="flex justify-between"><span className="text-muted-foreground">{item.name}</span><span>- R$ {fmt(item.amount)}</span></div>
                  ))}
                  <div className="flex justify-between border-t py-2 font-semibold"><span>Total fixo simulado</span><span>- R$ {fmt(simulatedClosing.simulatedFixedCostTotal)}</span></div>

                  <div className="border-b pb-2 pt-4 font-semibold">Lançamentos manuais já cadastrados</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Faturas de cartão</span><span>- R$ {fmt(dre?.totalCartoes)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Parcelas de empréstimos</span><span>- R$ {fmt(dre?.totalEmprestimosMensais)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Retenção sobre vendas</span><span>- R$ {fmt(dre?.totalRetencaoEmprestimos)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Contas operacionais pagas</span><span>- R$ {fmt(dre?.totalContasPagas)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">LIS / cheque especial</span><span>- R$ {fmt(dre?.totalLIS)}</span></div>
                  <div className="flex justify-between border-t py-2 font-semibold"><span>Saídas manuais acumuladas</span><span>- R$ {fmt(simulatedClosing.manualOutflows)}</span></div>

                  <div className="flex justify-between rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 text-base font-semibold"><span>Resultado simulado do fechamento</span><span className={simulatedClosing.projectedResult >= 0 ? "text-emerald-600" : "text-red-600"}>R$ {fmt(simulatedClosing.projectedResult)}</span></div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>Saúde financeira</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Entradas bancárias</span><span className="font-medium text-emerald-600">R$ {fmt(bankSummary.entradas)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Saídas bancárias</span><span className="font-medium text-red-500">R$ {fmt(bankSummary.saidas)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Pendências cadastradas</span><span className="font-medium text-amber-600">R$ {fmt(payablesDashboard?.totalPending)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Atrasados</span><span className="font-medium text-red-600">R$ {fmt(payablesDashboard?.totalOverdue)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Capital investido</span><span className="font-medium text-sky-600">R$ {fmt(dre?.dinheiroParado)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Retido no marketplace</span><span className="font-medium text-sky-600">R$ {fmt(dre?.totalRetencaoEmprestimos)}</span></div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Resumo automático do Mercado Pago</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Extratos Mercado Pago no mês</span><span className="font-medium text-violet-700">{mercadoPagoSummary.statementCount}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Movimentos autoidentificados</span><span className="font-medium text-emerald-600">{mercadoPagoSummary.identifiedMercadoPago}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Movimentos pendentes</span><span className="font-medium text-amber-600">{mercadoPagoSummary.estimatedPending}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Repasses estimados para C6</span><span className="font-medium text-sky-600">R$ {fmt(mercadoPagoSummary.estimatedTransfers)}</span></div>
                    <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
                      Apenas o extrato do Mercado Pago recebe identificação automática. Os demais bancos continuam disponíveis para conferência e classificação manual por você.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Extratos usados na simulação</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {currentMonthStatements.length > 0 ? currentMonthStatements.map((statement: any) => {
                      const isMercadoPago = String(statement.bankName || "").toLowerCase().includes("mercado pago");
                      return (
                        <div key={statement.id} className="rounded-lg border bg-muted/30 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium">{statement.bankName}</p>
                              <p className="text-xs text-muted-foreground">{statement.fileName}</p>
                            </div>
                            <Badge variant="outline">{isMercadoPago ? `${statement.totalIdentified}/${statement.totalTransactions}` : "manual"}</Badge>
                          </div>
                        </div>
                      );
                    }) : <p className="text-sm text-muted-foreground">Nenhum extrato vinculado ao CNPJ selecionado neste mês.</p>}
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Maiores categorias de saída no fechamento</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {categoryTotals.length > 0 ? categoryTotals.map((item) => (
                    <div key={item.category} className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{item.category}</span><span className="font-medium">R$ {fmt(item.amount)}</span></div>
                  )) : <p className="text-sm text-muted-foreground">Ainda não há saídas classificadas neste período.</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Movimentos recentes do banco</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-medium text-foreground">Entradas</p>
                    <div className="space-y-2">
                      {identifiedCredits.length > 0 ? identifiedCredits.map((item: any) => (
                        <div key={item.id} className="rounded-lg border bg-emerald-50/40 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2"><span className="font-medium">{item.userDescription || item.originalDescription}</span><span className="text-emerald-700">R$ {fmt(item.amount)}</span></div>
                          <p className="text-xs text-muted-foreground">{item.transactionDate} • {item.category || "Sem categoria"}</p>
                        </div>
                      )) : <p className="text-sm text-muted-foreground">Nenhuma entrada disponível.</p>}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-foreground">Saídas</p>
                    <div className="space-y-2">
                      {identifiedDebits.length > 0 ? identifiedDebits.map((item: any) => (
                        <div key={item.id} className="rounded-lg border bg-rose-50/40 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2"><span className="font-medium">{item.userDescription || item.originalDescription}</span><span className="text-rose-700">R$ {fmt(item.amount)}</span></div>
                          <p className="text-xs text-muted-foreground">{item.transactionDate} • {item.category || "Sem categoria"}</p>
                        </div>
                      )) : <p className="text-sm text-muted-foreground">Nenhuma saída disponível.</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "pagar" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Contas a pagar operacionais</h2>
                <p className="text-sm text-muted-foreground">Registre boletos, fornecedores, impostos, parcelas e investimentos que precisam entrar no fechamento manual.</p>
              </div>
              <Button size="sm" onClick={() => { resetPayableForm(); setShowPayableForm(true); }}><Plus className="mr-1 h-4 w-4" /> Nova conta</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total pendente</p><p className="text-xl font-bold text-amber-600">R$ {fmt(payablesDashboard?.totalPending)}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total atrasado</p><p className="text-xl font-bold text-red-600">R$ {fmt(payablesDashboard?.totalOverdue)}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Pendências</p><p className="text-xl font-bold">{payablesDashboard?.pendingCount || 0}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Capital classificado</p><p className="text-xl font-bold text-sky-600">R$ {fmt(dre?.dinheiroParado)}</p></CardContent></Card>
            </div>
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Os formulários completos de contas a pagar permanecem disponíveis e seguem refletindo no fechamento manual do período.</div>
          </div>
        )}

        {activeTab === "custos" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Custos fixos</h2>
                <p className="text-sm text-muted-foreground">Cadastre despesas recorrentes que impactam o fechamento manual do mês.</p>
              </div>
              <Button size="sm" onClick={() => { resetCostForm(); setShowCostForm(true); }}><Plus className="mr-1 h-4 w-4" /> Novo custo</Button>
            </div>
            <Card>
              <CardHeader><CardTitle>Simulação inicial informada por você</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {SIMULATED_FIXED_COSTS.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{item.name}</span><span className="font-medium">R$ {fmt(item.amount)}</span></div>
                ))}
                <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold"><span>Total fixo simulado</span><span>R$ {fmt(simulatedFixedCostTotal)}</span></div>
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Esta é uma base de simulação. Depois você pode substituir pelos valores corretos nos cadastros reais do Financeiro.</p>
              </CardContent>
            </Card>
            <div className="space-y-3">
              {fixedCosts.map((cost: any) => (
                <div key={cost.id} className="rounded-xl border bg-card px-4 py-3 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{cost.name}</p><p className="text-xs text-muted-foreground">Categoria: {cost.category || "outros"} • Vence dia {cost.dueDay}</p></div><div className="text-right"><p className="font-semibold">R$ {fmt(cost.amount)}</p><p className="text-xs text-muted-foreground">Cadastro real</p></div></div></div>
              ))}
              {fixedCosts.length === 0 && <div className="py-10 text-center text-muted-foreground">Nenhum custo fixo real cadastrado ainda.</div>}
            </div>
          </div>
        )}

        {activeTab === "cartoes" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Cartões de crédito</h2>
                <p className="text-sm text-muted-foreground">Controle cadastro, limite e fatura mensal para refletir nas saídas manuais do fechamento.</p>
              </div>
              <Button size="sm" onClick={() => { resetCardForm(); setShowCardForm(true); }}><Plus className="mr-1 h-4 w-4" /> Novo cartão</Button>
            </div>
            <div className="space-y-3">
              {creditCards.map((card: any) => (
                <div key={card.id} className="rounded-xl border bg-card px-4 py-3 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{card.name}</p><p className="text-xs text-muted-foreground">{card.brand || "outros"} • final {card.lastFourDigits || "----"}</p></div><div className="text-right"><p className="font-semibold">Limite R$ {fmt(card.creditLimit)}</p><p className="text-xs text-muted-foreground">Fecha dia {card.closingDay} • vence dia {card.dueDay}</p></div></div></div>
              ))}
              {creditCards.length === 0 && <div className="py-10 text-center text-muted-foreground">Nenhum cartão cadastrado.</div>}
            </div>
          </div>
        )}

        {activeTab === "emprestimos" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Empréstimos e retenções</h2>
                <p className="text-sm text-muted-foreground">Acompanhe parcelas, retenções sobre vendas e outros compromissos financeiros manuais.</p>
              </div>
              <Button size="sm" onClick={() => { resetLoanForm(); setShowLoanForm(true); }}><Plus className="mr-1 h-4 w-4" /> Novo empréstimo</Button>
            </div>
            <div className="space-y-3">
              {loans.map((loan: any) => (
                <div key={loan.id} className="rounded-xl border bg-card px-4 py-3 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{loan.name}</p><p className="text-xs text-muted-foreground">{loan.institution || "Instituição não informada"} • {loan.loanType === "sales_retention" ? "Retenção sobre vendas" : "Parcelado"}</p></div><div className="text-right"><p className="font-semibold">R$ {fmt(loan.totalAmount)}</p><p className="text-xs text-muted-foreground">Parcela R$ {fmt(loan.installmentAmount)}</p></div></div></div>
              ))}
              {loans.length === 0 && <div className="py-10 text-center text-muted-foreground">Nenhum empréstimo cadastrado.</div>}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
