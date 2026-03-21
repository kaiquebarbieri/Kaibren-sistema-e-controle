import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
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

type Tab = "visao" | "pagar" | "custos" | "cartoes" | "emprestimos";

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

  const cnpjsQuery = trpc.myCnpjs.list.useQuery();
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
  const statementsQuery = trpc.bankStatements.list.useQuery();

  const cnpjs = cnpjsQuery.data ?? [];
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
  const statements = statementsQuery.data ?? [];

  const tabs = [
    { key: "visao", label: "DRE + caixa", icon: Wallet },
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

  const topCredits = useMemo(() => {
    return allTransactions.filter((item: any) => item.transactionType === "credit").slice(0, 5);
  }, [allTransactions]);

  const topDebits = useMemo(() => {
    return allTransactions.filter((item: any) => item.transactionType === "debit").slice(0, 8);
  }, [allTransactions]);

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

  return (
    <DashboardLayout activeSection="financeiro" onNavigate={(section) => navigate(`/${section}`)}>
      <div className="space-y-6">
        <div className="rounded-3xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Badge variant="outline" className="w-fit">Financeiro profissional</Badge>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">DRE de caixa e controle de obrigações</h1>
                <p className="text-sm text-muted-foreground">
                  Esta visão separa o que já aconteceu no banco do que ainda precisa ser controlado. O resultado principal usa o extrato classificado; cartões, contas a pagar, custos fixos e empréstimos aparecem como apoio gerencial para evitar duplicidade.
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

        <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => navigate(`/financeiro/${tab.key}`)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "visao" && (
          <div className="space-y-6">
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
                  <CardTitle>Controle de obrigações</CardTitle>
                  <CardDescription>
                    Estas informações não entram de novo no saldo principal. Elas servem para você enxergar compromissos, dívidas e pressão futura no caixa.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Contas a pagar registradas</span><span className="font-medium">R$ {fmt(obligations.totalContas)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Custos fixos pagos</span><span className="font-medium">R$ {fmt(obligations.totalCustos)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Cartões controlados</span><span className="font-medium">R$ {fmt(obligations.totalCartoes)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Empréstimos e retenções</span><span className="font-medium">R$ {fmt(obligations.totalEmprestimos)}</span></div>
                  <div className="flex items-center justify-between border-t pt-3"><span className="text-muted-foreground">Volume gerencial monitorado</span><span className="font-semibold">R$ {fmt(obligations.total)}</span></div>
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
                    <p className="text-sm text-muted-foreground">Ainda não há saídas classificadas o suficiente para mostrar o ranking de gastos.</p>
                  )}
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

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Entradas recentes do extrato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topCredits.length > 0 ? topCredits.map((item: any) => (
                    <div key={item.id} className="rounded-xl border bg-emerald-50/40 px-3 py-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{item.userDescription || item.originalDescription}</span>
                        <span className="font-medium text-emerald-700">R$ {fmt(item.amount)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.transactionDate} • {item.category || "Sem categoria"}</p>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">Nenhuma entrada disponível no período.</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Saídas recentes do extrato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topDebits.length > 0 ? topDebits.map((item: any) => (
                    <div key={item.id} className="rounded-xl border bg-rose-50/40 px-3 py-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{item.userDescription || item.originalDescription}</span>
                        <span className="font-medium text-rose-700">R$ {fmt(item.amount)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.transactionDate} • {item.category || "Sem categoria"}</p>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">Nenhuma saída disponível no período.</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "pagar" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Contas a pagar</h2>
                <p className="text-sm text-muted-foreground">Use esta área para controlar obrigações, sem duplicar o efeito no DRE de caixa quando o pagamento já saiu do banco.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total pendente</p><p className="text-xl font-bold text-amber-600">R$ {fmt(payablesDashboard?.totalPending)}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total atrasado</p><p className="text-xl font-bold text-red-600">R$ {fmt(payablesDashboard?.totalOverdue)}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Contas pendentes</p><p className="text-xl font-bold">{payablesDashboard?.pendingCount || 0}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Registros do mês</p><p className="text-xl font-bold">{payables.length}</p></CardContent></Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Resumo operacional</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {payables.length > 0 ? payables.slice(0, 10).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-3">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.supplier || "Sem fornecedor"} • {item.dueDate}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">R$ {fmt(item.amount)}</p>
                      <Badge variant="outline">{item.status}</Badge>
                    </div>
                  </div>
                )) : <p className="text-sm text-muted-foreground">Nenhuma conta a pagar cadastrada para este período.</p>}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "custos" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Custos fixos</h2>
              <p className="text-sm text-muted-foreground">Cadastre custos recorrentes para prever pressão no caixa e acompanhar onde a estrutura da empresa pesa mais.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Custos cadastrados</p><p className="text-xl font-bold">{fixedCosts.length}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Pagamentos do mês</p><p className="text-xl font-bold">{fixedCostPayments.length}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total pago</p><p className="text-xl font-bold text-rose-600">R$ {fmt(dre?.totalCustosFixos)}</p></CardContent></Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Lista de custos</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {fixedCosts.length > 0 ? fixedCosts.map((cost: any) => (
                  <div key={cost.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-3">
                    <div>
                      <p className="font-medium">{cost.name}</p>
                      <p className="text-xs text-muted-foreground">Categoria: {cost.category || "outros"} • Vence dia {cost.dueDay}</p>
                    </div>
                    <span className="font-medium">R$ {fmt(cost.amount)}</span>
                  </div>
                )) : <p className="text-sm text-muted-foreground">Nenhum custo fixo cadastrado.</p>}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "cartoes" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Cartões</h2>
              <p className="text-sm text-muted-foreground">Acompanhe o que você deve e o que já pagou, sem somar novamente no caixa se o pagamento já saiu do banco.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Cartões cadastrados</p><p className="text-xl font-bold">{creditCards.length}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Faturas do mês</p><p className="text-xl font-bold">{creditCardInvoices.length}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Volume monitorado</p><p className="text-xl font-bold text-amber-600">R$ {fmt(dre?.totalCartoes)}</p></CardContent></Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Seus cartões</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {creditCards.length > 0 ? creditCards.map((card: any) => (
                  <div key={card.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-3">
                    <div>
                      <p className="font-medium">{card.name}</p>
                      <p className="text-xs text-muted-foreground">{card.brand || "outros"} • final {card.lastFourDigits || "----"}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium">Limite R$ {fmt(card.creditLimit)}</p>
                      <p className="text-muted-foreground">Fecha dia {card.closingDay} • vence dia {card.dueDay}</p>
                    </div>
                  </div>
                )) : <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "emprestimos" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Empréstimos</h2>
              <p className="text-sm text-muted-foreground">Controle parcelas, saldos e retenções para entender compromissos futuros sem distorcer o resultado de caixa do mês.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Empréstimos cadastrados</p><p className="text-xl font-bold">{loans.length}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Parcelas do mês</p><p className="text-xl font-bold">{loanInstallments.length}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Retenções lançadas</p><p className="text-xl font-bold">{retentionEntries.length}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Volume monitorado</p><p className="text-xl font-bold text-sky-600">R$ {fmt(dre?.totalEmprestimos)}</p></CardContent></Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Carteira de empréstimos</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {loans.length > 0 ? loans.map((loan: any) => (
                  <div key={loan.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-3">
                    <div>
                      <p className="font-medium">{loan.name}</p>
                      <p className="text-xs text-muted-foreground">{loan.institution || "Instituição não informada"} • {loan.loanType === "sales_retention" ? "Retenção sobre vendas" : "Parcelado"}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium">R$ {fmt(loan.totalAmount)}</p>
                      <p className="text-muted-foreground">Parcela R$ {fmt(loan.installmentAmount)}</p>
                    </div>
                  </div>
                )) : <p className="text-sm text-muted-foreground">Nenhum empréstimo cadastrado.</p>}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
