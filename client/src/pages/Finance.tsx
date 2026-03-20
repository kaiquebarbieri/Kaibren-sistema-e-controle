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
import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import {
  Plus, Pencil, Trash2, Check, X, DollarSign, CreditCard, Landmark,
  TrendingUp, TrendingDown, AlertTriangle, AlertCircle, Info,
  ChevronLeft, ChevronRight, Receipt, Wallet, Building2, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

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

function fmt(v: number | string | null | undefined): string {
  const n = parseFloat(String(v || "0"));
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Tab = "custos" | "cartoes" | "emprestimos" | "dre";

export default function Finance() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/financeiro/:tab");
  const activeTab = (params?.tab as Tab) || "dre";

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  // ── Custos Fixos State ──
  const [showCostForm, setShowCostForm] = useState(false);
  const [editingCostId, setEditingCostId] = useState<number | null>(null);
  const [costName, setCostName] = useState("");
  const [costCategory, setCostCategory] = useState("outros");
  const [costAmount, setCostAmount] = useState("");
  const [costDueDay, setCostDueDay] = useState("1");
  const [costNotes, setCostNotes] = useState("");

  // ── Cartões State ──
  const [showCardForm, setShowCardForm] = useState(false);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [cardName, setCardName] = useState("");
  const [cardBrand, setCardBrand] = useState("outros");
  const [cardLastFour, setCardLastFour] = useState("");
  const [cardClosingDay, setCardClosingDay] = useState("1");
  const [cardDueDay, setCardDueDay] = useState("10");
  const [cardLimit, setCardLimit] = useState("");
  const [cardNotes, setCardNotes] = useState("");

  // ── Invoice State ──
  const [editingInvoiceCardId, setEditingInvoiceCardId] = useState<number | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceAmountPaid, setInvoiceAmountPaid] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState<"paid" | "pending" | "partial">("pending");

  // ── Empréstimos State ──
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<number | null>(null);
  const [loanName, setLoanName] = useState("");
  const [loanInstitution, setLoanInstitution] = useState("");
  const [loanTotalAmount, setLoanTotalAmount] = useState("");
  const [loanTotalInstallments, setLoanTotalInstallments] = useState("");
  const [loanInstallmentAmount, setLoanInstallmentAmount] = useState("");
  const [loanInterestRate, setLoanInterestRate] = useState("");
  const [loanStartDate, setLoanStartDate] = useState("");
  const [loanDueDay, setLoanDueDay] = useState("1");
  const [loanNotes, setLoanNotes] = useState("");

  // ── Queries ──
  const fixedCostsQuery = trpc.finance.fixedCosts.list.useQuery();
  const fixedCostPaymentsQuery = trpc.finance.fixedCosts.payments.useQuery({ year: selectedYear, month: selectedMonth });
  const creditCardsQuery = trpc.finance.creditCards.list.useQuery();
  const creditCardInvoicesQuery = trpc.finance.creditCards.invoices.useQuery({ year: selectedYear, month: selectedMonth });
  const loansQuery = trpc.finance.loans.list.useQuery();
  const loanInstallmentsQuery = trpc.finance.loans.installments.useQuery({ year: selectedYear, month: selectedMonth });
  const dreQuery = trpc.finance.dre.useQuery({ year: selectedYear, month: selectedMonth });

  const utils = trpc.useUtils();

  // ── Mutations ──
  const createCostMutation = trpc.finance.fixedCosts.create.useMutation({
    onSuccess: () => { utils.finance.fixedCosts.list.invalidate(); resetCostForm(); toast.success("Custo fixo cadastrado!"); },
  });
  const updateCostMutation = trpc.finance.fixedCosts.update.useMutation({
    onSuccess: () => { utils.finance.fixedCosts.list.invalidate(); resetCostForm(); toast.success("Custo fixo atualizado!"); },
  });
  const deleteCostMutation = trpc.finance.fixedCosts.delete.useMutation({
    onSuccess: () => { utils.finance.fixedCosts.list.invalidate(); toast.success("Custo fixo removido!"); },
  });
  const upsertPaymentMutation = trpc.finance.fixedCosts.upsertPayment.useMutation({
    onSuccess: () => { utils.finance.fixedCosts.payments.invalidate(); utils.finance.dre.invalidate(); toast.success("Pagamento registrado!"); },
  });

  const createCardMutation = trpc.finance.creditCards.create.useMutation({
    onSuccess: () => { utils.finance.creditCards.list.invalidate(); resetCardForm(); toast.success("Cartão cadastrado!"); },
  });
  const updateCardMutation = trpc.finance.creditCards.update.useMutation({
    onSuccess: () => { utils.finance.creditCards.list.invalidate(); resetCardForm(); toast.success("Cartão atualizado!"); },
  });
  const deleteCardMutation = trpc.finance.creditCards.delete.useMutation({
    onSuccess: () => { utils.finance.creditCards.list.invalidate(); toast.success("Cartão removido!"); },
  });
  const upsertInvoiceMutation = trpc.finance.creditCards.upsertInvoice.useMutation({
    onSuccess: () => { utils.finance.creditCards.invoices.invalidate(); utils.finance.dre.invalidate(); setEditingInvoiceCardId(null); toast.success("Fatura registrada!"); },
  });

  const createLoanMutation = trpc.finance.loans.create.useMutation({
    onSuccess: () => { utils.finance.loans.list.invalidate(); resetLoanForm(); toast.success("Empréstimo cadastrado!"); },
  });
  const updateLoanMutation = trpc.finance.loans.update.useMutation({
    onSuccess: () => { utils.finance.loans.list.invalidate(); resetLoanForm(); toast.success("Empréstimo atualizado!"); },
  });
  const deleteLoanMutation = trpc.finance.loans.delete.useMutation({
    onSuccess: () => { utils.finance.loans.list.invalidate(); toast.success("Empréstimo removido!"); },
  });
  const upsertInstallmentMutation = trpc.finance.loans.upsertInstallment.useMutation({
    onSuccess: () => { utils.finance.loans.installments.invalidate(); utils.finance.dre.invalidate(); toast.success("Parcela registrada!"); },
  });

  // ── Reset Forms ──
  function resetCostForm() {
    setShowCostForm(false); setEditingCostId(null);
    setCostName(""); setCostCategory("outros"); setCostAmount(""); setCostDueDay("1"); setCostNotes("");
  }
  function resetCardForm() {
    setShowCardForm(false); setEditingCardId(null);
    setCardName(""); setCardBrand("outros"); setCardLastFour(""); setCardClosingDay("1"); setCardDueDay("10"); setCardLimit(""); setCardNotes("");
  }
  function resetLoanForm() {
    setShowLoanForm(false); setEditingLoanId(null);
    setLoanName(""); setLoanInstitution(""); setLoanTotalAmount(""); setLoanTotalInstallments(""); setLoanInstallmentAmount(""); setLoanInterestRate(""); setLoanStartDate(""); setLoanDueDay("1"); setLoanNotes("");
  }

  // ── Period Navigation ──
  function prevMonth() {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1); }
    else setSelectedMonth(selectedMonth - 1);
  }
  function nextMonth() {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1); }
    else setSelectedMonth(selectedMonth + 1);
  }

  // ── Tab Navigation ──
  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "dre", label: "DRE", icon: TrendingUp },
    { key: "custos", label: "Custos Fixos", icon: Receipt },
    { key: "cartoes", label: "Cartões", icon: CreditCard },
    { key: "emprestimos", label: "Empréstimos", icon: Landmark },
  ];

  // ── Helper: get payment for a fixed cost ──
  function getPaymentForCost(costId: number) {
    return fixedCostPaymentsQuery.data?.find((p: any) => p.fixedCostId === costId);
  }

  // ── Helper: get invoice for a card ──
  function getInvoiceForCard(cardId: number) {
    return creditCardInvoicesQuery.data?.find((i: any) => i.cardId === cardId);
  }

  // ── Helper: get installment for a loan ──
  function getInstallmentForLoan(loanId: number) {
    return loanInstallmentsQuery.data?.find((i: any) => i.loanId === loanId);
  }

  return (
    <DashboardLayout activeSection="financeiro">
      <div className="container max-w-6xl py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Wallet className="h-7 w-7 text-primary" />
              Financeiro
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Controle de custos, cartões, empréstimos e DRE</p>
          </div>
          {/* Period Selector */}
          <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-sm min-w-[140px] text-center">
              {MONTHS[selectedMonth - 1]} {selectedYear}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => navigate(`/financeiro/${tab.key}`)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════
            TAB: DRE
           ════════════════════════════════════════════════════════════ */}
        {activeTab === "dre" && (
          <div className="space-y-6">
            {dreQuery.isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando DRE...</div>
            ) : dreQuery.data ? (
              <>
                {/* Alertas */}
                {dreQuery.data.alerts.length > 0 && (
                  <div className="space-y-2">
                    {dreQuery.data.alerts.map((alert: any, i: number) => (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
                        alert.type === "danger" ? "bg-red-50 border-red-200 text-red-800" :
                        alert.type === "warning" ? "bg-amber-50 border-amber-200 text-amber-800" :
                        "bg-blue-50 border-blue-200 text-blue-800"
                      }`}>
                        {alert.type === "danger" ? <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" /> :
                         alert.type === "warning" ? <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" /> :
                         <Info className="h-5 w-5 mt-0.5 shrink-0" />}
                        <span className="text-sm">{alert.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cards Resumo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-green-600 font-medium">Receita Bruta</p>
                          <p className="text-xl font-bold text-green-700">R$ {fmt(dreQuery.data.receitaBruta)}</p>
                          <p className="text-xs text-green-600">{dreQuery.data.qtdPedidosClientes} pedidos</p>
                        </div>
                        <ArrowUpRight className="h-8 w-8 text-green-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-blue-600 font-medium">Lucro Bruto</p>
                          <p className="text-xl font-bold text-blue-700">R$ {fmt(dreQuery.data.lucroBruto)}</p>
                          <p className="text-xs text-blue-600">Receita - CMV</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-blue-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-orange-200 bg-orange-50">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-orange-600 font-medium">Despesas Operacionais</p>
                          <p className="text-xl font-bold text-orange-700">R$ {fmt(dreQuery.data.despesasOperacionais)}</p>
                          <p className="text-xs text-orange-600">Fixos + Cartões + Emp.</p>
                        </div>
                        <ArrowDownRight className="h-8 w-8 text-orange-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className={`${dreQuery.data.resultadoLiquido >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-xs font-medium ${dreQuery.data.resultadoLiquido >= 0 ? "text-emerald-600" : "text-red-600"}`}>Resultado Líquido</p>
                          <p className={`text-xl font-bold ${dreQuery.data.resultadoLiquido >= 0 ? "text-emerald-700" : "text-red-700"}`}>R$ {fmt(dreQuery.data.resultadoLiquido)}</p>
                          <p className={`text-xs ${dreQuery.data.resultadoLiquido >= 0 ? "text-emerald-600" : "text-red-600"}`}>Margem: {dreQuery.data.margemLiquida.toFixed(1)}%</p>
                        </div>
                        {dreQuery.data.resultadoLiquido >= 0 ?
                          <TrendingUp className="h-8 w-8 text-emerald-400" /> :
                          <TrendingDown className="h-8 w-8 text-red-400" />}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* DRE Detalhado */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">DRE - {MONTHS[selectedMonth - 1]} {selectedYear}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      {/* Receitas */}
                      <div className="font-bold text-base border-b pb-2 mb-2 text-foreground">RECEITAS</div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Receita Bruta (Vendas a Clientes)</span>
                        <span className="font-medium text-green-600">R$ {fmt(dreQuery.data.receitaBruta)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground pl-4">(-) Custo Mercadoria Vendida (Mondial)</span>
                        <span className="font-medium text-red-500">- R$ {fmt(dreQuery.data.custoMercadoriaVendida)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground pl-4">(-) Comissão Everton / Mondial</span>
                        <span className="font-medium text-red-500">- R$ {fmt(dreQuery.data.totalComissaoEverton)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-t font-semibold">
                        <span>= Lucro Bruto</span>
                        <span className="text-blue-600">R$ {fmt(dreQuery.data.lucroBruto)}</span>
                      </div>

                      {/* Despesas Operacionais */}
                      <div className="font-bold text-base border-b pb-2 mb-2 mt-4 text-foreground">DESPESAS OPERACIONAIS</div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Custos Fixos</span>
                        <span className="font-medium text-red-500">- R$ {fmt(dreQuery.data.totalCustosFixos)}</span>
                      </div>
                      {dreQuery.data.fixedCostPayments?.map((p: any, i: number) => (
                        <div key={i} className="flex justify-between py-0.5 pl-4">
                          <span className="text-xs text-muted-foreground">{p.costName} ({p.costCategory})</span>
                          <span className="text-xs text-muted-foreground">R$ {fmt(p.payment.amountPaid)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Faturas Cartão de Crédito</span>
                        <span className="font-medium text-red-500">- R$ {fmt(dreQuery.data.totalCartoes)}</span>
                      </div>
                      {dreQuery.data.cardInvoices?.map((inv: any, i: number) => (
                        <div key={i} className="flex justify-between py-0.5 pl-4">
                          <span className="text-xs text-muted-foreground">{inv.cardName} ({inv.cardBrand})</span>
                          <span className="text-xs text-muted-foreground">R$ {fmt(inv.invoice.totalAmount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Parcelas de Empréstimos</span>
                        <span className="font-medium text-red-500">- R$ {fmt(dreQuery.data.totalEmprestimos)}</span>
                      </div>
                      {dreQuery.data.loanInstallments?.map((inst: any, i: number) => (
                        <div key={i} className="flex justify-between py-0.5 pl-4">
                          <span className="text-xs text-muted-foreground">{inst.loanName} ({inst.institution})</span>
                          <span className="text-xs text-muted-foreground">R$ {fmt(inst.installment.amount)}</span>
                        </div>
                      ))}
                      {dreQuery.data.totalLIS > 0 && (
                        <div className="flex justify-between py-1">
                          <span className="text-muted-foreground">LIS / Cheque Especial (Juros + IOF)</span>
                          <span className="font-medium text-red-500">- R$ {fmt(dreQuery.data.totalLIS)}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 border-t font-semibold">
                        <span>= Total Despesas Operacionais</span>
                        <span className="text-orange-600">- R$ {fmt(dreQuery.data.despesasOperacionais)}</span>
                      </div>

                      {/* Resultado */}
                      <div className="font-bold text-base border-b pb-2 mb-2 mt-4 text-foreground">RESULTADO</div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Resultado Operacional (Lucro Bruto - Despesas)</span>
                        <span className={`font-medium ${dreQuery.data.resultadoOperacional >= 0 ? "text-green-600" : "text-red-600"}`}>
                          R$ {fmt(dreQuery.data.resultadoOperacional)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground pl-4">(-) Compras Pessoais ({dreQuery.data.qtdPedidosPessoais} pedidos)</span>
                        <span className="font-medium text-red-500">- R$ {fmt(dreQuery.data.totalComprasPessoais)}</span>
                      </div>
                      <div className={`flex justify-between py-3 border-t-2 font-bold text-base mt-2 ${dreQuery.data.resultadoLiquido >= 0 ? "border-emerald-300" : "border-red-300"}`}>
                        <span>= RESULTADO LÍQUIDO</span>
                        <span className={dreQuery.data.resultadoLiquido >= 0 ? "text-emerald-600" : "text-red-600"}>
                          R$ {fmt(dreQuery.data.resultadoLiquido)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Margem Líquida</span>
                        <span className={`font-semibold ${dreQuery.data.margemLiquida >= 15 ? "text-green-600" : dreQuery.data.margemLiquida >= 0 ? "text-amber-600" : "text-red-600"}`}>
                          {dreQuery.data.margemLiquida.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">Nenhum dado disponível para este período.</div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB: Custos Fixos
           ════════════════════════════════════════════════════════════ */}
        {activeTab === "custos" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Custos Fixos Mensais</h2>
              <Button size="sm" onClick={() => { resetCostForm(); setShowCostForm(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Novo Custo
              </Button>
            </div>

            {/* Form */}
            {showCostForm && (
              <Card className="border-primary/30">
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Nome</Label>
                      <Input value={costName} onChange={(e) => setCostName(e.target.value)} placeholder="Ex: Aluguel" />
                    </div>
                    <div>
                      <Label className="text-xs">Categoria</Label>
                      <Select value={costCategory} onValueChange={setCostCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FIXED_COST_CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Valor Mensal (R$)</Label>
                      <Input type="number" step="0.01" value={costAmount} onChange={(e) => setCostAmount(e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                      <Label className="text-xs">Dia Vencimento</Label>
                      <Input type="number" min="1" max="31" value={costDueDay} onChange={(e) => setCostDueDay(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Observações</Label>
                    <Input value={costNotes} onChange={(e) => setCostNotes(e.target.value)} placeholder="Opcional" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => {
                      if (!costName || !costAmount) { toast.error("Preencha nome e valor"); return; }
                      const data = { name: costName, category: costCategory, amount: costAmount, dueDay: parseInt(costDueDay), notes: costNotes || null };
                      if (editingCostId) updateCostMutation.mutate({ id: editingCostId, ...data });
                      else createCostMutation.mutate(data);
                    }}>
                      <Check className="h-4 w-4 mr-1" /> {editingCostId ? "Atualizar" : "Salvar"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={resetCostForm}>
                      <X className="h-4 w-4 mr-1" /> Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* List */}
            {fixedCostsQuery.data?.map((cost: any) => {
              const payment = getPaymentForCost(cost.id);
              const isPaid = payment?.status === "paid";
              return (
                <Card key={cost.id} className={isPaid ? "border-green-200 bg-green-50/50" : ""}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{cost.name}</span>
                          <Badge variant="outline" className="text-xs">{FIXED_COST_CATEGORIES.find(c => c.value === cost.category)?.label || cost.category}</Badge>
                          {isPaid && <Badge className="bg-green-100 text-green-700 text-xs">Pago</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          R$ {fmt(cost.amount)} / mês • Venc. dia {cost.dueDay}
                          {cost.notes && <span> • {cost.notes}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!isPaid ? (
                          <Button variant="outline" size="sm" className="text-green-600 border-green-300 hover:bg-green-50" onClick={() => {
                            upsertPaymentMutation.mutate({
                              fixedCostId: cost.id, periodYear: selectedYear, periodMonth: selectedMonth,
                              amountPaid: String(cost.amount), status: "paid", paidAt: new Date(),
                            });
                          }}>
                            <Check className="h-3 w-3 mr-1" /> Pagar
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="text-amber-600" onClick={() => {
                            upsertPaymentMutation.mutate({
                              fixedCostId: cost.id, periodYear: selectedYear, periodMonth: selectedMonth,
                              amountPaid: String(cost.amount), status: "pending",
                            });
                          }}>
                            Desfazer
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                          setEditingCostId(cost.id); setCostName(cost.name); setCostCategory(cost.category);
                          setCostAmount(String(cost.amount)); setCostDueDay(String(cost.dueDay)); setCostNotes(cost.notes || "");
                          setShowCostForm(true);
                        }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                          if (confirm("Remover este custo fixo?")) deleteCostMutation.mutate({ id: cost.id });
                        }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {fixedCostsQuery.data?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">Nenhum custo fixo cadastrado. Clique em "Novo Custo" para começar.</div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB: Cartões de Crédito
           ════════════════════════════════════════════════════════════ */}
        {activeTab === "cartoes" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Cartões de Crédito</h2>
              <Button size="sm" onClick={() => { resetCardForm(); setShowCardForm(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Novo Cartão
              </Button>
            </div>

            {/* Form */}
            {showCardForm && (
              <Card className="border-primary/30">
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Nome/Apelido</Label>
                      <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Ex: Nubank Empresarial" />
                    </div>
                    <div>
                      <Label className="text-xs">Bandeira</Label>
                      <Select value={cardBrand} onValueChange={setCardBrand}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CARD_BRANDS.map((b) => (
                            <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Últimos 4 dígitos</Label>
                      <Input maxLength={4} value={cardLastFour} onChange={(e) => setCardLastFour(e.target.value)} placeholder="1234" />
                    </div>
                    <div>
                      <Label className="text-xs">Limite (R$)</Label>
                      <Input type="number" step="0.01" value={cardLimit} onChange={(e) => setCardLimit(e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                      <Label className="text-xs">Dia Fechamento</Label>
                      <Input type="number" min="1" max="31" value={cardClosingDay} onChange={(e) => setCardClosingDay(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Dia Vencimento</Label>
                      <Input type="number" min="1" max="31" value={cardDueDay} onChange={(e) => setCardDueDay(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Observações</Label>
                    <Input value={cardNotes} onChange={(e) => setCardNotes(e.target.value)} placeholder="Opcional" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => {
                      if (!cardName) { toast.error("Preencha o nome do cartão"); return; }
                      const data = { name: cardName, brand: cardBrand, lastFourDigits: cardLastFour || null, closingDay: parseInt(cardClosingDay), dueDay: parseInt(cardDueDay), creditLimit: cardLimit || null, notes: cardNotes || null };
                      if (editingCardId) updateCardMutation.mutate({ id: editingCardId, ...data });
                      else createCardMutation.mutate(data);
                    }}>
                      <Check className="h-4 w-4 mr-1" /> {editingCardId ? "Atualizar" : "Salvar"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={resetCardForm}>
                      <X className="h-4 w-4 mr-1" /> Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cards List */}
            {creditCardsQuery.data?.map((card: any) => {
              const invoice = getInvoiceForCard(card.id);
              const isEditing = editingInvoiceCardId === card.id;
              return (
                <Card key={card.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{card.name}</span>
                          {card.lastFourDigits && <span className="text-xs text-muted-foreground">****{card.lastFourDigits}</span>}
                          <Badge variant="outline" className="text-xs">{CARD_BRANDS.find(b => b.value === card.brand)?.label || card.brand}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Fecha dia {card.closingDay} • Vence dia {card.dueDay}
                          {card.creditLimit && <span> • Limite: R$ {fmt(card.creditLimit)}</span>}
                        </div>
                        {/* Invoice info */}
                        {invoice && !isEditing && (
                          <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                            <span className="font-medium">Fatura {MONTHS[selectedMonth - 1]}: </span>
                            <span className="font-bold">R$ {fmt(invoice.totalAmount)}</span>
                            <Badge className={`ml-2 text-xs ${invoice.status === "paid" ? "bg-green-100 text-green-700" : invoice.status === "partial" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                              {invoice.status === "paid" ? "Pago" : invoice.status === "partial" ? "Parcial" : "Pendente"}
                            </Badge>
                            {invoice.amountPaid && <span className="text-muted-foreground ml-2">Pago: R$ {fmt(invoice.amountPaid)}</span>}
                          </div>
                        )}
                        {/* Invoice Edit Form */}
                        {isEditing && (
                          <div className="mt-2 p-3 bg-muted/50 rounded space-y-2">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              <div>
                                <Label className="text-xs">Valor Fatura</Label>
                                <Input type="number" step="0.01" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs">Valor Pago</Label>
                                <Input type="number" step="0.01" value={invoiceAmountPaid} onChange={(e) => setInvoiceAmountPaid(e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs">Status</Label>
                                <Select value={invoiceStatus} onValueChange={(v: any) => setInvoiceStatus(v)}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="paid">Pago</SelectItem>
                                    <SelectItem value="pending">Pendente</SelectItem>
                                    <SelectItem value="partial">Parcial</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => {
                                if (!invoiceAmount) { toast.error("Informe o valor da fatura"); return; }
                                upsertInvoiceMutation.mutate({
                                  cardId: card.id, periodYear: selectedYear, periodMonth: selectedMonth,
                                  totalAmount: invoiceAmount, amountPaid: invoiceAmountPaid || null,
                                  status: invoiceStatus, paidAt: invoiceStatus === "paid" ? new Date() : null,
                                });
                              }}>
                                <Check className="h-3 w-3 mr-1" /> Salvar
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setEditingInvoiceCardId(null)}>
                                <X className="h-3 w-3 mr-1" /> Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => {
                          setEditingInvoiceCardId(card.id);
                          setInvoiceAmount(invoice ? String(invoice.totalAmount) : "");
                          setInvoiceAmountPaid(invoice?.amountPaid ? String(invoice.amountPaid) : "");
                          setInvoiceStatus(invoice?.status || "pending");
                        }}>
                          <Receipt className="h-3 w-3 mr-1" /> Fatura
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                          setEditingCardId(card.id); setCardName(card.name); setCardBrand(card.brand);
                          setCardLastFour(card.lastFourDigits || ""); setCardClosingDay(String(card.closingDay));
                          setCardDueDay(String(card.dueDay)); setCardLimit(card.creditLimit ? String(card.creditLimit) : "");
                          setCardNotes(card.notes || ""); setShowCardForm(true);
                        }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                          if (confirm("Remover este cartão?")) deleteCardMutation.mutate({ id: card.id });
                        }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {creditCardsQuery.data?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">Nenhum cartão cadastrado. Clique em "Novo Cartão" para começar.</div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB: Empréstimos
           ════════════════════════════════════════════════════════════ */}
        {activeTab === "emprestimos" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Empréstimos</h2>
              <Button size="sm" onClick={() => { resetLoanForm(); setShowLoanForm(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Novo Empréstimo
              </Button>
            </div>

            {/* Form */}
            {showLoanForm && (
              <Card className="border-primary/30">
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Nome/Descrição</Label>
                      <Input value={loanName} onChange={(e) => setLoanName(e.target.value)} placeholder="Ex: Capital de Giro C6" />
                    </div>
                    <div>
                      <Label className="text-xs">Instituição</Label>
                      <Input value={loanInstitution} onChange={(e) => setLoanInstitution(e.target.value)} placeholder="Ex: C6 Bank" />
                    </div>
                    <div>
                      <Label className="text-xs">Valor Total (R$)</Label>
                      <Input type="number" step="0.01" value={loanTotalAmount} onChange={(e) => setLoanTotalAmount(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Nº Parcelas</Label>
                      <Input type="number" value={loanTotalInstallments} onChange={(e) => setLoanTotalInstallments(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Valor Parcela (R$)</Label>
                      <Input type="number" step="0.01" value={loanInstallmentAmount} onChange={(e) => setLoanInstallmentAmount(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Taxa Juros Mensal (%)</Label>
                      <Input type="number" step="0.01" value={loanInterestRate} onChange={(e) => setLoanInterestRate(e.target.value)} placeholder="Ex: 2.5" />
                    </div>
                    <div>
                      <Label className="text-xs">Data Início (1ª parcela)</Label>
                      <Input type="date" value={loanStartDate} onChange={(e) => setLoanStartDate(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Dia Vencimento</Label>
                      <Input type="number" min="1" max="31" value={loanDueDay} onChange={(e) => setLoanDueDay(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Observações</Label>
                    <Input value={loanNotes} onChange={(e) => setLoanNotes(e.target.value)} placeholder="Opcional" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => {
                      if (!loanName || !loanInstitution || !loanTotalAmount || !loanTotalInstallments || !loanInstallmentAmount || !loanStartDate) {
                        toast.error("Preencha todos os campos obrigatórios"); return;
                      }
                      const data = {
                        name: loanName, institution: loanInstitution, totalAmount: loanTotalAmount,
                        totalInstallments: parseInt(loanTotalInstallments), installmentAmount: loanInstallmentAmount,
                        interestRate: loanInterestRate || null, startDate: loanStartDate, dueDay: parseInt(loanDueDay),
                        notes: loanNotes || null,
                      };
                      if (editingLoanId) updateLoanMutation.mutate({ id: editingLoanId, ...data });
                      else createLoanMutation.mutate(data);
                    }}>
                      <Check className="h-4 w-4 mr-1" /> {editingLoanId ? "Atualizar" : "Salvar"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={resetLoanForm}>
                      <X className="h-4 w-4 mr-1" /> Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loans List */}
            {loansQuery.data?.map((loan: any) => {
              const installment = getInstallmentForLoan(loan.id);
              const isPaid = installment?.status === "paid";
              return (
                <Card key={loan.id} className={isPaid ? "border-green-200 bg-green-50/50" : ""}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Landmark className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{loan.name}</span>
                          <Badge variant="outline" className="text-xs">{loan.institution}</Badge>
                          {isPaid && <Badge className="bg-green-100 text-green-700 text-xs">Pago</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          R$ {fmt(loan.installmentAmount)} / mês • {loan.totalInstallments}x • Total: R$ {fmt(loan.totalAmount)}
                          {loan.interestRate && <span> • Juros: {loan.interestRate}% a.m.</span>}
                        </div>
                        {installment && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Parcela {MONTHS[selectedMonth - 1]}: R$ {fmt(installment.amount)} - {installment.status === "paid" ? "Pago" : "Pendente"}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {!isPaid ? (
                          <Button variant="outline" size="sm" className="text-green-600 border-green-300 hover:bg-green-50" onClick={() => {
                            upsertInstallmentMutation.mutate({
                              loanId: loan.id, installmentNumber: selectedMonth,
                              periodYear: selectedYear, periodMonth: selectedMonth,
                              amount: String(loan.installmentAmount), status: "paid", paidAt: new Date(),
                            });
                          }}>
                            <Check className="h-3 w-3 mr-1" /> Pagar
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="text-amber-600" onClick={() => {
                            upsertInstallmentMutation.mutate({
                              loanId: loan.id, installmentNumber: selectedMonth,
                              periodYear: selectedYear, periodMonth: selectedMonth,
                              amount: String(loan.installmentAmount), status: "pending",
                            });
                          }}>
                            Desfazer
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                          setEditingLoanId(loan.id); setLoanName(loan.name); setLoanInstitution(loan.institution);
                          setLoanTotalAmount(String(loan.totalAmount)); setLoanTotalInstallments(String(loan.totalInstallments));
                          setLoanInstallmentAmount(String(loan.installmentAmount)); setLoanInterestRate(loan.interestRate ? String(loan.interestRate) : "");
                          setLoanStartDate(loan.startDate); setLoanDueDay(String(loan.dueDay)); setLoanNotes(loan.notes || "");
                          setShowLoanForm(true);
                        }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                          if (confirm("Remover este empréstimo?")) deleteLoanMutation.mutate({ id: loan.id });
                        }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {loansQuery.data?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">Nenhum empréstimo cadastrado. Clique em "Novo Empréstimo" para começar.</div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
