import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Landmark,
  PieChart,
  Receipt,
  ShieldAlert,
  Wallet,
} from "lucide-react";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

type ObligationsTab = "contas" | "cartoes" | "emprestimos";

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

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="w-fit">{badge}</Badge>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
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
  );
}

export default function Finance() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const [, financeParams] = useRoute("/financeiro/:tab");
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
  const [selectedCnpjId, setSelectedCnpjId] = useState<string>("all");

  const cnpjsQuery = trpc.myCnpjs.list.useQuery();
  const statementsQuery = trpc.bankStatements.list.useQuery();
  const payablesQuery = trpc.finance.payables.list.useQuery({ year: selectedYear, month: selectedMonth });
  const payablesDashboardQuery = trpc.finance.payables.dashboard.useQuery({ referenceDate: today, year: selectedYear, month: selectedMonth });
  const fixedCostsQuery = trpc.finance.fixedCosts.list.useQuery();
  const fixedCostPaymentsQuery = trpc.finance.fixedCosts.payments.useQuery({ year: selectedYear, month: selectedMonth });
  const creditCardsQuery = trpc.finance.creditCards.list.useQuery();
  const creditCardInvoicesQuery = trpc.finance.creditCards.invoices.useQuery({ year: selectedYear, month: selectedMonth });
  const loansQuery = trpc.finance.loans.list.useQuery();
  const loanInstallmentsQuery = trpc.finance.loans.installments.useQuery({ year: selectedYear, month: selectedMonth });
  const retentionEntriesQuery = trpc.finance.loans.retentionEntries.useQuery({ year: selectedYear, month: selectedMonth });
  const dreQuery = trpc.finance.dre.useQuery({ year: selectedYear, month: selectedMonth });

  const cnpjs = cnpjsQuery.data ?? [];
  const statements = statementsQuery.data ?? [];
  const payables = payablesQuery.data ?? [];
  const payablesDashboard = payablesDashboardQuery.data;
  const fixedCosts = fixedCostsQuery.data ?? [];
  const fixedCostPayments = fixedCostPaymentsQuery.data ?? [];
  const creditCards = creditCardsQuery.data ?? [];
  const creditCardInvoices = creditCardInvoicesQuery.data ?? [];
  const loans = loansQuery.data ?? [];
  const loanInstallments = loanInstallmentsQuery.data ?? [];
  const retentionEntries = retentionEntriesQuery.data ?? [];
  const dre = dreQuery.data;

  useEffect(() => {
    if (statements.length === 0) return;
    const sorted = [...statements].sort((a: any, b: any) => {
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
  }, [statements, selectedMonth, selectedYear]);

  const selectedCnpj = useMemo(() => cnpjs.find((item: any) => String(item.id) === selectedCnpjId) ?? null, [cnpjs, selectedCnpjId]);
  const cnpjLabel = selectedCnpj ? `${selectedCnpj.nomeFantasia || selectedCnpj.razaoSocial} • ${selectedCnpj.cnpj}` : "Todos os CNPJs cadastrados";

  const currentMonthStatements = useMemo(() => {
    return statements.filter((statement: any) => {
      const matchesPeriod = Number(statement.periodYear) === selectedYear && Number(statement.periodMonth) === selectedMonth;
      const matchesCnpj = selectedCnpjId === "all" ? true : String(statement.cnpjId) === selectedCnpjId;
      return matchesPeriod && matchesCnpj;
    });
  }, [statements, selectedYear, selectedMonth, selectedCnpjId]);

  const allTransactions = useMemo(() => {
    return currentMonthStatements.flatMap((statement: any) => Array.isArray(statement.transactions) ? statement.transactions : []);
  }, [currentMonthStatements]);

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
    const totalTransactions = mercadoPagoStatements.reduce((sum: number, statement: any) => sum + Number(statement.totalTransactions || 0), 0);
    const identified = mercadoPagoStatements.reduce((sum: number, statement: any) => sum + Number(statement.totalIdentified || 0), 0);
    const transfers = mercadoPagoStatements.reduce((sum: number, statement: any) => {
      const txns = Array.isArray(statement.transactions) ? statement.transactions : [];
      return sum + txns
        .filter((txn: any) => String(txn.category || "").toLowerCase().includes("repasse para c6 bank"))
        .reduce((inner: number, txn: any) => inner + Math.abs(Number(txn.amount || 0)), 0);
    }, 0);
    return {
      statementCount: mercadoPagoStatements.length,
      totalTransactions,
      identified,
      pending: Math.max(totalTransactions - identified, 0),
      transfers,
    };
  }, [currentMonthStatements]);

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

  if (!user) return null;

  if (isObligationsRoute) {
    const obligationTabs = [
      { key: "contas", label: "Contas a pagar", icon: Receipt },
      { key: "cartoes", label: "Cartões de crédito", icon: CreditCard },
      { key: "emprestimos", label: "Empréstimos", icon: Landmark },
    ] as const;

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
            title="Contas, cartões e empréstimos"
            description="Esta área é separada do menu Financeiro principal. Aqui ficam apenas os controles operacionais e obrigações da empresa."
          />

          <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
            {obligationTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => navigate(`/obrigacoes/${tab.key}`)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-all ${activeObligationTab === tab.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {activeObligationTab === "contas" && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contas do mês</p>
                    <p className="mt-2 text-2xl font-bold">{payables.length}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{cnpjLabel}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total previsto</p>
                    <p className="mt-2 text-2xl font-bold">R$ {fmt(payablesDashboard?.totalPending || 0)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Aberto no período</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vencendo hoje</p>
                    <p className="mt-2 text-2xl font-bold text-amber-600">{payables.filter((item: any) => item.dueDate === today && item.status !== "paid").length}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Contas vencendo em {today}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Em atraso</p>
                    <p className="mt-2 text-2xl font-bold text-red-600">R$ {fmt(payablesDashboard?.totalOverdue || 0)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Exige ação imediata</p>
                  </CardContent>
                </Card>
              </div>

              {payables.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Lista de contas a pagar</CardTitle>
                    <CardDescription>Controle de boletos, fornecedores e demais saídas previstas sem misturar com o DRE de caixa.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {payables.slice(0, 12).map((item: any) => (
                      <div key={item.id} className="flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium">{item.description}</p>
                          <p className="text-sm text-muted-foreground">{item.category || "Sem categoria"} • vencimento {item.dueDate}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">R$ {fmt(item.amount)}</p>
                          <p className="text-xs text-muted-foreground">{item.status}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <EmptyState title="Nenhuma conta a pagar cadastrada" description="Cadastre boletos, fornecedores e obrigações futuras nesta área separada do Financeiro principal." />
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Custos fixos pagos no mês</CardTitle>
                  <CardDescription>Os custos fixos ficam vinculados ao controle operacional para acompanhamento sem duplicar o caixa realizado.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fixedCostPayments.length > 0 ? fixedCostPayments.slice(0, 10).map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between rounded-2xl border p-4">
                      <div>
                        <p className="font-medium">{payment.name || payment.description || "Custo fixo"}</p>
                        <p className="text-sm text-muted-foreground">Pagamento registrado em {payment.referenceMonth}/{payment.referenceYear}</p>
                      </div>
                      <span className="font-semibold">R$ {fmt(payment.amount)}</span>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">Nenhum pagamento de custo fixo registrado para o período.</p>}
                </CardContent>
              </Card>
            </div>
          )}

          {activeObligationTab === "cartoes" && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cartões cadastrados</p>
                    <p className="mt-2 text-2xl font-bold">{creditCards.length}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Controle gerencial</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Faturas do mês</p>
                    <p className="mt-2 text-2xl font-bold">{creditCardInvoices.length}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Acompanhe o que já foi pago</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valor em faturas</p>
                    <p className="mt-2 text-2xl font-bold">R$ {fmt(obligations.totalCartoes)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Sem duplicar no DRE</p>
                  </CardContent>
                </Card>
              </div>

              {creditCardInvoices.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Faturas registradas</CardTitle>
                    <CardDescription>Use esta área para controlar o que você deve e o que já liquidou nos cartões.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {creditCardInvoices.slice(0, 12).map((invoice: any) => (
                      <div key={invoice.id} className="flex items-center justify-between rounded-2xl border p-4">
                        <div>
                          <p className="font-medium">{invoice.cardName || invoice.description || "Fatura de cartão"}</p>
                          <p className="text-sm text-muted-foreground">Fechamento {invoice.closingDate || "não informado"} • vencimento {invoice.dueDate || "não informado"}</p>
                        </div>
                        <span className="font-semibold">R$ {fmt(invoice.amount)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <EmptyState title="Nenhuma fatura cadastrada" description="Cadastre aqui seus cartões e faturas para acompanhar saldos devidos e pagamentos realizados." />
              )}
            </div>
          )}

          {activeObligationTab === "emprestimos" && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empréstimos ativos</p>
                    <p className="mt-2 text-2xl font-bold">{loans.length}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Controle fora do DRE principal</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parcelas no mês</p>
                    <p className="mt-2 text-2xl font-bold">{loanInstallments.length}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Acompanhamento gerencial</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Retenções Mercado Pago</p>
                    <p className="mt-2 text-2xl font-bold">R$ {fmt(retentionEntries.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0))}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Apenas fluxo Mercado Pago</p>
                  </CardContent>
                </Card>
              </div>

              {loans.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Controle de empréstimos</CardTitle>
                    <CardDescription>Registre saldos, retenções e parcelas sem misturar o controle gerencial com o caixa do extrato.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {loans.slice(0, 12).map((loan: any) => (
                      <div key={loan.id} className="flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium">{loan.name || loan.description || "Empréstimo"}</p>
                          <p className="text-sm text-muted-foreground">Saldo atual R$ {fmt(loan.outstandingBalance || loan.currentBalance || 0)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">R$ {fmt(loan.originalAmount || loan.amount || 0)}</p>
                          <p className="text-xs text-muted-foreground">Valor contratado</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <EmptyState title="Nenhum empréstimo cadastrado" description="Cadastre retenções e empréstimos nesta área para controle do passivo e pagamentos." />
              )}
            </div>
          )}
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
          title="DRE e caixa realizado por extrato"
          description="Aqui fica apenas o painel principal de caixa e análise do extrato. Contas a pagar, cartões e empréstimos foram movidos para o menu separado de Obrigações."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-emerald-200 bg-emerald-50/70">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Entradas do caixa</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-700">R$ {fmt(bankSummary.entradas)}</p>
                  <p className="mt-1 text-xs text-emerald-700/80">{cnpjLabel}</p>
                </div>
                <ArrowUpCircle className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-rose-200 bg-rose-50/70">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Saídas do caixa</p>
                  <p className="mt-2 text-2xl font-bold text-rose-700">R$ {fmt(bankSummary.saidas)}</p>
                  <p className="mt-1 text-xs text-rose-700/80">Somente débitos do extrato</p>
                </div>
                <ArrowDownCircle className="h-8 w-8 text-rose-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-sky-200 bg-sky-50/70">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Resultado de caixa</p>
                  <p className={`mt-2 text-2xl font-bold ${bankSummary.saldo >= 0 ? "text-sky-700" : "text-red-600"}`}>R$ {fmt(bankSummary.saldo)}</p>
                  <p className="mt-1 text-xs text-sky-700/80">Entrou menos saiu no período</p>
                </div>
                <Wallet className="h-8 w-8 text-sky-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-violet-200 bg-violet-50/70">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Saídas classificadas</p>
                  <p className="mt-2 text-2xl font-bold text-violet-700">{toPercent(Number(dre?.percentualSaidasClassificadas || 0))}</p>
                  <p className="mt-1 text-xs text-violet-700/80">Quanto do extrato já está explicado</p>
                </div>
                <PieChart className="h-8 w-8 text-violet-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {alerts.length > 0 && (
          <div className="space-y-3">
            {alerts.map((alert: any, index: number) => (
              <div
                key={`${alert.type}-${index}`}
                className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${alert.type === "danger" ? "border-red-200 bg-red-50 text-red-800" : alert.type === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-sky-200 bg-sky-50 text-sky-800"}`}
              >
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>DRE de caixa realizado</CardTitle>
              <CardDescription>
                Este quadro usa apenas as movimentações do extrato do mês. Não há mistura com vendas do dashboard comercial.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Entradas confirmadas</span><span className="font-medium text-emerald-600">R$ {fmt(bankSummary.entradas)}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Saídas confirmadas</span><span className="font-medium text-rose-600">R$ {fmt(bankSummary.saidas)}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Resultado do mês</span><span className={`font-semibold ${bankSummary.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>R$ {fmt(bankSummary.saldo)}</span></div>
              <div className="rounded-2xl border bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leitura estratégica</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Se este número ficar negativo, seu caixa consumiu mais do que recebeu no período. O próximo passo é olhar as categorias de saída para descobrir exatamente onde o dinheiro foi embora.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Saídas classificadas</p>
                  <p className="mt-2 text-xl font-semibold">R$ {fmt(bankSummary.classified)}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Sem classificação</p>
                  <p className="mt-2 text-xl font-semibold text-amber-600">R$ {fmt(bankSummary.unclassified)}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Extratos usados</p>
                  <p className="mt-2 text-xl font-semibold">{currentMonthStatements.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Painel Mercado Pago</CardTitle>
              <CardDescription>
                A automação continua restrita ao layout do Mercado Pago/Mercado Livre para facilitar repasses e ajustes desse fluxo.
              </CardDescription>
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
              <CardDescription>
                Estas categorias vêm das saídas do extrato já classificadas. Aqui está a sua leitura principal para descobrir vazamentos de caixa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {topExpenseCategories.length > 0 ? topExpenseCategories.map((item: any, index: number) => (
                <BarRow key={`${item.category}-${index}`} label={item.category} amount={Number(item.amount || 0)} total={bankSummary.saidas} tone={index === 0 ? "rose" : index === 1 ? "amber" : "sky"} />
              )) : (
                <p className="text-sm text-muted-foreground">Classifique as saídas do extrato para descobrir onde o caixa mais sangra.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Maiores movimentos recentes</CardTitle>
              <CardDescription>
                Créditos e débitos lidos diretamente dos extratos usados neste fechamento.
              </CardDescription>
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
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contas em controle</p>
              <p className="mt-2 text-2xl font-bold">R$ {fmt(obligations.totalContas)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Veja no menu Obrigações → Contas a pagar</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cartões em controle</p>
              <p className="mt-2 text-2xl font-bold">R$ {fmt(obligations.totalCartoes)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Veja no menu Obrigações → Cartões</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empréstimos em controle</p>
              <p className="mt-2 text-2xl font-bold">R$ {fmt(obligations.totalEmprestimos)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Veja no menu Obrigações → Empréstimos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custos fixos em controle</p>
              <p className="mt-2 text-2xl font-bold">R$ {fmt(obligations.totalCustos)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Acompanhados em Obrigações → Contas a pagar</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Próximo passo recomendado</CardTitle>
            <CardDescription>
              Para o DRE ficar mais preciso, classifique especialmente as saídas do C6 Bank por categoria. Isso melhora os gráficos e a leitura de onde o caixa está sendo consumido.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => navigate("/extratos")}>Abrir Extratos para classificar</Button>
            <Button variant="outline" onClick={() => navigate("/obrigacoes")}>Abrir menu Obrigações</Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
