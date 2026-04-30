import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import PeriodFilter, { periodLabel, periodToDays, periodToDates, usePeriod } from "@/components/PeriodFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  Clock,
  DollarSign,
  Loader2,
  Megaphone,
  Package,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Trophy,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart,
} from "recharts";

function fmt(value: string | number | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(value: string | number | null | undefined) {
  return `${(Number(value ?? 0) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

const CHANNEL_COLORS: Record<string, string> = {
  total: "#D4AF37",
  ml: "#3B82F6",
  shopee: "#F97316",
  amazon: "#A855F7",
  distribuidora: "#22C55E",
};

const CHANNEL_LABELS: Record<string, string> = {
  total: "Total",
  ml: "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon",
  distribuidora: "Distribuidora",
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-[#0E1223] p-3 shadow-lg">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{CHANNEL_LABELS[entry.dataKey] || entry.dataKey}:</span>
          <span className="font-medium text-foreground">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user, loading } = useAuth();

  // Redirect user role to operational view
  useEffect(() => {
    if (!loading && user && user.role === "user") {
      window.location.href = "/operacional";
    }
  }, [user, loading]);

  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [period, setPeriod, customDate, setCustomDate, customDateEnd, setCustomDateEnd] = usePeriod();
  // Auto-migra valores antigos (4d, yesterday) para "today"
  useEffect(() => {
    if (!["today", "yesterday", "7d", "15d", "30d", "custom"].includes(period)) {
      setPeriod("today");
    }
  }, [period, setPeriod]);
  const { dateFrom, dateTo } = periodToDates(period, customDate, customDateEnd);

  const dashboardQuery = trpc.dashboard.monthly.useQuery({
    periodMonth: Number(selectedMonth),
    periodYear: Number(selectedYear),
  });
  const evolutionQuery = trpc.dashboard.yearlyEvolution.useQuery();
  const mlSummary = trpc.vendas.mlSummary.useQuery(
    { dateFrom, dateTo },
    { refetchInterval: period === "today" ? 120000 : false }
  );
  const mlDaily = trpc.vendas.mlDailySales.useQuery({ days: periodToDays(period) || 7 });
  const revenueQuery = trpc.dashboard.revenueEvolution.useQuery({ days: periodToDays(period) || 7 });
  const recentOrdersQuery = trpc.marketplaceOrders.recent.useQuery({ limit: 10 }, { refetchInterval: 120000 });
  const shopeeSummary = trpc.vendas.shopeeSummary.useQuery(
    { dateFrom, dateTo },
    { refetchInterval: period === "today" ? 120000 : false }
  );
  const mlRefreshMutation = trpc.vendas.mlRefreshTokens.useMutation();
  const insightsQuery = trpc.vendas.dashboardInsights.useQuery(undefined, { refetchInterval: 300000 });
  const insights = insightsQuery.data;
  // Catálogo ML — margem real dos anúncios ativos (custo + Everton + embalagem + taxas + impostos)
  const mlCatalogQuery = trpc.listMLCatalog.useQuery();
  // Investimento em ads — Meta (Facebook/Instagram) + ML Ads + Shopee Ads
  const metaAdsQuery = trpc.marketing.metaAds.useQuery(undefined, { staleTime: 600_000 });
  const mlAdsQuery = trpc.mlAds.dashboard.useQuery(undefined, { staleTime: 600_000 });
  const shopeeAdsQuery = trpc.shopeeAds.dashboard.useQuery(undefined, { staleTime: 600_000 });
  const [, setLocation] = useLocation();
  const [refreshStatus, setRefreshStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  const handleRefreshTokens = async () => {
    setRefreshStatus("loading");
    try {
      const result = await mlRefreshMutation.mutateAsync();
      const allOk = result.results.every((r: any) => r.ok);
      setRefreshStatus(allOk ? "ok" : "error");
      mlSummary.refetch();
      setTimeout(() => setRefreshStatus("idle"), 4000);
    } catch {
      setRefreshStatus("error");
      setTimeout(() => setRefreshStatus("idle"), 4000);
    }
  };

  const monthly = dashboardQuery.data;
  const ml = mlSummary.data;
  const mlDays = mlDaily.data;
  const revenueData = revenueQuery.data;

  const vendasDoMes = Number(monthly?.totalVendasClientes ?? 0);
  const lucroLiquido = Number(monthly?.totalLucro ?? 0);
  // Imposto Simples Nacional efetivo — abr/2026: 9,3% (TODO: ler de company_tax_rates quando preenchido)
  const IMPOSTO_PERCENT = 9.3;

  // Taxas reais Mercado Livre (Clássico Eletrônicos) — fonte: marketplace_fees
  // - Comissão 13% sobre venda
  // - Taxa fixa por faixa: R$6,25 (12,50-29), R$6,50 (29-50), R$6,75 (50-79), zero acima
  // - Frete grátis obrigatório acima de R$79 → vendedor paga ~R$16 (estimativa peso médio)
  const mlFeesFor = (sale: number): number => {
    if (sale <= 0) return 0;
    const commission = sale * 0.13;
    let fixedFee = 0;
    if (sale >= 12.50 && sale < 29) fixedFee = 6.25;
    else if (sale >= 29 && sale < 50) fixedFee = 6.50;
    else if (sale >= 50 && sale < 79) fixedFee = 6.75;
    const frete = sale >= 79 ? 16 : 0;
    return commission + fixedFee + frete;
  };

  // Margem real dos marketplaces — (sale - taxas_ml - imposto - custo - everton - embalagem) / sale
  // dos anúncios ML ativos com costPrice > 0
  const mlMargemReal = (() => {
    const list = mlCatalogQuery.data ?? [];
    const ativos = list.filter((p: any) => p.status === "active" && Number(p.salePrice) > 0 && Number(p.costPrice) > 0);
    if (!ativos.length) return { pct: 0, count: 0 };
    const calcEverton = (custo: number) => custo <= 0 ? 0 : (custo < 5 ? 0.40 : 0.90);
    let totalPct = 0;
    for (const p of ativos) {
      const sale = Number(p.salePrice);
      const custo = Number(p.costPrice);
      const cost = custo + Number(p.packagingCost) + calcEverton(custo);
      // Usa platformFeePercent do anúncio quando > 0, senão calcula pelas faixas reais ML
      const fee = Number(p.platformFeePercent) > 0
        ? sale * (Number(p.platformFeePercent) / 100)
        : mlFeesFor(sale);
      const taxPctEff = Number(p.taxPercent) > 0 ? Number(p.taxPercent) : IMPOSTO_PERCENT;
      const tax = sale * (taxPctEff / 100);
      const margin = ((sale - fee - tax - cost) / sale) * 100;
      totalPct += margin;
    }
    return { pct: totalPct / ativos.length, count: ativos.length };
  })();
  const margemMedia = mlMargemReal.pct;
  const margemAnunciosCount = mlMargemReal.count;

  const pedidosCliente = Number(monthly?.totalPedidosCliente ?? 0);
  const comprasDoMesMondial = Number(monthly?.totalComprasPessoais ?? 0);
  const pedidosPessoais = Number(monthly?.totalPedidosPessoais ?? 0);
  const comissaoEverton = Number(monthly?.totalComissaoEvertonMondial ?? 0);
  const impostoVendas = vendasDoMes > 0 ? vendasDoMes * 0.0392 : 0;

  // Shopee totais
  const shopeeTodayTotal = Number(shopeeSummary.data?.today ?? 0);
  const shopeeTodayCount = Number(shopeeSummary.data?.todayCount ?? 0);
  const shopeeMonthTotal = Number(shopeeSummary.data?.thisMonth ?? 0);
  const shopeeMonthCount = Number(shopeeSummary.data?.orderCount ?? 0);

  // Filtro de conta — ML ou Shopee
  const selectedMlAccount = accountFilter !== "all"
    ? (ml?.accounts ?? []).find((a: any) => a.name === accountFilter)
    : null;
  const selectedShopeeAccount = accountFilter !== "all"
    ? (shopeeSummary.data?.accounts ?? []).find((a: any) => a.name === accountFilter)
    : null;
  const selectedAccount = selectedMlAccount || selectedShopeeAccount || (accountFilter !== "all" ? { name: accountFilter } : null);

  const mlPeriodTotal = selectedMlAccount
    ? Number(selectedMlAccount.today?.total ?? 0)
    : Number(ml?.totals?.today?.total ?? 0);
  const mlPeriodCount = selectedMlAccount
    ? Number(selectedMlAccount.today?.count ?? 0)
    : Number(ml?.totals?.today?.count ?? 0);
  const mlMonthTotalFiltered = selectedMlAccount
    ? Number(selectedMlAccount.month?.total ?? 0)
    : Number(ml?.totals?.month?.total ?? 0);

  // Imposto a pagar — todas as vendas do mês selecionado (ML + Shopee) × IMPOSTO_PERCENT
  // (imposto é sempre mensal — Simples Nacional)
  const faturamentoMesMarketplaces = mlMonthTotalFiltered + shopeeMonthTotal;
  const impostoAPagar = faturamentoMesMarketplaces * (IMPOSTO_PERCENT / 100);

  // Total marketplace = ML + Shopee (respeitando filtro de conta e período)
  const marketplacePeriodTotal = selectedShopeeAccount
    ? Number(selectedShopeeAccount.today ?? 0)
    : selectedMlAccount
    ? mlPeriodTotal
    : mlPeriodTotal + shopeeTodayTotal;
  const marketplacePeriodCount = selectedShopeeAccount
    ? Number(selectedShopeeAccount.todayCount ?? 0)
    : selectedMlAccount
    ? mlPeriodCount
    : mlPeriodCount + shopeeTodayCount;

  // Label do período para exibir nos KPIs
  const isSingleDay =
    period === "today" ||
    (period === "custom" && !!customDate && (customDate === customDateEnd || !customDateEnd));
  const periodLabelText = periodLabel(period, customDate, customDateEnd);

  // Lucro estimado do PERÍODO selecionado = faturamento_periodo × margem_media (margem já desconta tudo MENOS ads)
  const lucroEstimadoPeriodoAntesAds = marketplacePeriodTotal * (margemMedia / 100);

  // Investimento em Ads — Meta (lifetime no summary) + ML (29 dias) + Shopee (7 ou 14 dias)
  // Como cada API retorna janela diferente, fazemos rateio por dia pra alinhar com o período do filtro.
  const periodDays = periodToDays(period) || 7;

  const metaSpend30d = Number(metaAdsQuery.data?.totalSpend ?? 0); // Meta retorna lifetime; tratamos como mensal aproximado
  const mlAdsAccounts: any[] = (mlAdsQuery.data as any)?.accounts ?? (Array.isArray(mlAdsQuery.data) ? (mlAdsQuery.data as any) : []);
  const mlSpend29d = mlAdsAccounts.reduce((acc, a: any) => acc + Number(a?.adsData?.totalCost ?? 0), 0);
  const shopeeSpend14d = Number((shopeeAdsQuery.data as any)?.kpis?.expense14d ?? 0);
  const shopeeSpend7d = Number((shopeeAdsQuery.data as any)?.kpis?.expense7d ?? 0);

  // Estima gasto no período selecionado (rateio diário)
  const adsMetaPeriodo = metaSpend30d * Math.min(periodDays, 30) / 30;
  const adsMLPeriodo = mlSpend29d * Math.min(periodDays, 29) / 29;
  const adsShopeePeriodo = periodDays <= 7
    ? shopeeSpend7d * periodDays / 7
    : (shopeeSpend14d * Math.min(periodDays, 14) / 14);

  // Filtro por conta ML/Shopee — se selecionou Shopee, esconde ML/Meta etc
  let adsTotalPeriodo = adsMetaPeriodo + adsMLPeriodo + adsShopeePeriodo;
  let adsLabel = "Meta + ML + Shopee";
  if (selectedShopeeAccount) {
    adsTotalPeriodo = adsShopeePeriodo;
    adsLabel = "Shopee";
  } else if (selectedMlAccount) {
    adsTotalPeriodo = adsMLPeriodo;
    adsLabel = "Mercado Livre";
  }

  const lucroEstimadoPeriodo = lucroEstimadoPeriodoAntesAds - adsTotalPeriodo;

  // Faturamento total = marketplace (ML + Shopee) + distribuidora
  const faturamentoTotal = isSingleDay
    ? marketplacePeriodTotal
    : (selectedShopeeAccount ? Number(selectedShopeeAccount.total ?? 0) : mlMonthTotalFiltered + shopeeMonthTotal) + (selectedAccount ? 0 : vendasDoMes);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  const months = [
    { value: "01", label: "Janeiro" }, { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" }, { value: "04", label: "Abril" },
    { value: "05", label: "Maio" }, { value: "06", label: "Junho" },
    { value: "07", label: "Julho" }, { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" }, { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
  ];

  const kpis = [
    { icon: DollarSign, label: `Faturamento Marketplaces — ${periodLabelText}`, value: fmt(marketplacePeriodTotal), sub: `${marketplacePeriodCount} pedidos (ML + Shopee)`, color: "text-emerald-400", bg: "border-emerald-500/20 bg-emerald-500/5" },
    { icon: ShoppingCart, label: `Pedidos Marketplaces — ${periodLabelText}`, value: String(marketplacePeriodCount), sub: `ML: ${mlPeriodCount} | Shopee: ${shopeeTodayCount}`, color: "text-primary", bg: "border-primary/20 bg-primary/5" },
    { icon: TrendingUp, label: "Margem Média", value: fmtPct(margemMedia / 100), sub: margemAnunciosCount > 0 ? `Marketplaces — ${margemAnunciosCount} anúncios` : "Sem dados ainda", color: margemMedia >= 30 ? "text-emerald-400" : margemMedia >= 15 ? "text-amber-400" : "text-blue-400", bg: margemMedia >= 30 ? "border-emerald-500/20 bg-emerald-500/5" : "border-blue-500/20 bg-blue-500/5" },
    { icon: AlertTriangle, label: "Vendas Mês (Dist.)", value: fmt(vendasDoMes), sub: `${pedidosCliente} pedidos`, color: "text-amber-400", bg: "border-amber-500/20 bg-amber-500/5" },
    { icon: AlertTriangle, label: `Imposto a Pagar — ${IMPOSTO_PERCENT}%`, value: fmt(impostoAPagar), sub: `Marketplaces ${months.find(m => m.value === selectedMonth)?.label ?? ""} (${fmt(faturamentoMesMarketplaces)})`, color: "text-red-400", bg: "border-red-500/20 bg-red-500/5" },
    { icon: Megaphone, label: `Investimento em Ads — ${periodLabelText}`, value: fmt(adsTotalPeriodo), sub: adsLabel, color: "text-purple-400", bg: "border-purple-500/20 bg-purple-500/5" },
    { icon: TrendingUp, label: `Lucro Líquido — ${periodLabelText}`, value: fmt(lucroEstimadoPeriodo), sub: `Margem ${margemMedia.toFixed(1)}% − Ads ${fmt(adsTotalPeriodo)}`, color: lucroEstimadoPeriodo > 0 ? "text-emerald-400" : "text-red-400", bg: lucroEstimadoPeriodo > 0 ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5" },
  ];

  const allMlAccounts = ml?.accounts ?? [];
  const allShopeeAccounts = shopeeSummary.data?.accounts ?? [];
  const mlAccounts = selectedMlAccount ? [selectedMlAccount] : (selectedShopeeAccount ? [] : allMlAccounts);
  const shopeeAccounts = selectedShopeeAccount ? [selectedShopeeAccount] : (selectedMlAccount ? [] : allShopeeAccounts);

  // Build chart data from revenue snapshots or ML daily data
  // Quando o filtro de conta estiver ativo, ignoramos revenueData (que é agregado)
  // e montamos a série apenas com a conta selecionada a partir de mlDays.
  const chartData = (!selectedAccount && (revenueData ?? []).length > 0)
    ? revenueData
    : (mlDays ?? []).map((d: any) => {
        const [, m, day] = d.date.split("-");
        const accountsForDay = selectedAccount
          ? [d.accounts?.[selectedAccount.name]].filter(Boolean)
          : Object.values(d.accounts as Record<string, any>);
        const total = accountsForDay.reduce((s: number, a: any) => s + (a?.total ?? 0), 0);
        return {
          date: `${day}/${m}`,
          total,
          ml: total,
          shopee: 0,
          amazon: 0,
          distribuidora: 0,
        };
      });

  return (
    <DashboardLayout activeSection="dashboard">
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Visão geral do seu negócio</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <PeriodFilter
              value={period}
              onChange={setPeriod}
              customDate={customDate}
              customDateEnd={customDateEnd}
              onCustomDate={setCustomDate}
              onCustomDateEnd={setCustomDateEnd}
            />
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger
                className="w-[180px] border-border/50 bg-card text-sm h-9"
                title="Filtrar por conta"
              >
                <SelectValue placeholder="Todas as contas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {(ml?.accounts ?? []).map((a: any) => (
                  <SelectItem key={a.name} value={a.name}>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      {a.name}
                    </span>
                  </SelectItem>
                ))}
                {(shopeeSummary.data?.accounts ?? []).map((a: any) => (
                  <SelectItem key={a.name} value={a.name}>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                      {a.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={handleRefreshTokens}
              disabled={refreshStatus === "loading"}
              title="Renovar tokens do Mercado Livre"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                refreshStatus === "ok" ? "border-emerald-500/50 text-emerald-400" :
                refreshStatus === "error" ? "border-red-500/50 text-red-400" :
                "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshStatus === "loading" ? "animate-spin" : ""}`} />
              {refreshStatus === "ok" ? "Renovado" : refreshStatus === "error" ? "Erro" : "ML Token"}
            </button>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[130px] border-border/50 bg-card text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[90px] border-border/50 bg-card text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["2024", "2025", "2026"].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((kpi, i) => (
            <motion.div key={kpi.label} custom={i} variants={cardVariants} initial="hidden" animate="visible">
              <Card className={`border ${kpi.bg}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                    <span className="text-xs text-muted-foreground truncate">{kpi.label}</span>
                  </div>
                  <div className="mt-2 text-xl sm:text-2xl font-bold text-foreground">{kpi.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{kpi.sub}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* ML por canal */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {mlAccounts.map((acc, i) => {
            const colors = ["text-primary border-primary/20 bg-primary/5", "text-blue-400 border-blue-500/20 bg-blue-500/5", "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"];
            return (
              <motion.div key={acc.name} custom={i + 4} variants={cardVariants} initial="hidden" animate="visible">
                <Card className={`border ${colors[i]?.split(" ").slice(1).join(" ") ?? ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{acc.name}</span>
                      <ShoppingBag className={`h-4 w-4 ${colors[i]?.split(" ")[0] ?? "text-muted-foreground"}`} />
                    </div>
                    <div className="mt-2 text-lg font-bold">{fmt(acc.today?.total ?? 0)}</div>
                    <div className="text-xs text-muted-foreground">{acc.today?.count ?? 0} vendas — {periodLabelText}</div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Shopee */}
        {shopeeAccounts.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {shopeeAccounts.map((acc: any, i: number) => (
              <motion.div key={acc.name} custom={i + 7} variants={cardVariants} initial="hidden" animate="visible">
                <Card className="border border-orange-500/20 bg-orange-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{acc.name}</span>
                      <ShoppingBag className="h-4 w-4 text-orange-400" />
                    </div>
                    <div className="mt-2 text-lg font-bold">{fmt(acc.today ?? 0)}</div>
                    <div className="text-xs text-muted-foreground">{acc.todayCount ?? 0} vendas — {periodLabelText}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* ══════ ÚLTIMAS VENDAS ══════ */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" /> Últimas Vendas
                {accountFilter !== "all" && <span className="text-xs text-muted-foreground font-normal">— {accountFilter}</span>}
                {recentOrdersQuery.data && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {(recentOrdersQuery.data ?? []).filter((o: any) => accountFilter === "all" ? true : o.accountName === accountFilter).length} pedidos
                  </span>
                )}
              </CardTitle>
              <button
                onClick={() => setLocation("/pedidos")}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Ver todos <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrdersQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {(recentOrdersQuery.data ?? []).filter((order: any) =>
                  accountFilter === "all" ? true : order.accountName === accountFilter
                ).map((order: any) => (
                  <div key={order.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors">
                    {/* Imagem do produto */}
                    <div className="h-12 w-12 rounded-lg bg-muted/20 overflow-hidden shrink-0">
                      {order.productImage ? (
                        <img
                          src={order.productImage}
                          alt={order.productName}
                          className="h-full w-full object-cover"
                          onError={(e: any) => { e.target.style.display = "none"; }}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Produto info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate" title={order.productName}>
                        {order.productName.length > 40 ? order.productName.slice(0, 40) + "…" : order.productName}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {order.productSku && (
                          <span className="text-[10px] text-muted-foreground font-mono">SKU: {order.productSku}</span>
                        )}
                        <span className="text-xs text-muted-foreground">{order.buyerName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {(() => {
                            const diff = Date.now() - new Date(order.createdAt).getTime();
                            const mins = Math.floor(diff / 60000);
                            if (mins < 1) return "agora";
                            if (mins < 60) return `há ${mins}min`;
                            const hrs = Math.floor(mins / 60);
                            if (hrs < 24) return `há ${hrs}h`;
                            return `há ${Math.floor(hrs / 24)}d`;
                          })()}
                        </span>
                      </div>
                    </div>

                    {/* Conta badge */}
                    <span
                      className="hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0"
                      style={{ backgroundColor: `${order.accountColor}15`, color: order.accountColor }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: order.accountColor }} />
                      {order.accountName}
                    </span>

                    {/* Status */}
                    <span className={`hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${
                      order.status === "paid" ? "bg-emerald-500/10 text-emerald-400" :
                      order.status === "shipped" ? "bg-blue-500/10 text-blue-400" :
                      order.status === "delivered" ? "bg-primary/10 text-primary" :
                      "bg-red-500/10 text-red-400"
                    }`}>
                      {order.statusLabel}
                    </span>

                    {/* Valor */}
                    <div className="text-sm font-bold text-foreground shrink-0">
                      {fmt(order.totalAmount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico principal — Performance de Vendas (recharts) */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" /> Performance de Vendas — {periodLabel(period)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mlDaily.isLoading ? (
              <div className="flex items-center justify-center h-[320px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={chartData}>
                  <defs>
                    {Object.entries(CHANNEL_COLORS).map(([key, color]) => (
                      <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.1} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.3} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={{ stroke: "#334155" }} />
                  <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={{ stroke: "#334155" }} tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: 8 }} formatter={(value: string) => <span style={{ color: "#94A3B8", fontSize: 12 }}>{CHANNEL_LABELS[value] || value}</span>} />
                  <Area type="monotone" dataKey="total" stroke="#D4AF37" strokeWidth={3} fill="url(#grad-total)" dot={{ r: 4, fill: "#D4AF37" }} activeDot={{ r: 6 }} />
                  <Area type="monotone" dataKey="ml" stroke="#3B82F6" strokeWidth={1.5} fill="url(#grad-ml)" dot={{ r: 3, fill: "#3B82F6" }} activeDot={{ r: 5 }} />
                  <Area type="monotone" dataKey="shopee" stroke="#F97316" strokeWidth={1.5} fill="url(#grad-shopee)" dot={{ r: 3, fill: "#F97316" }} activeDot={{ r: 5 }} />
                  <Area type="monotone" dataKey="amazon" stroke="#A855F7" strokeWidth={1.5} fill="url(#grad-amazon)" dot={{ r: 3, fill: "#A855F7" }} activeDot={{ r: 5 }} />
                  <Area type="monotone" dataKey="distribuidora" stroke="#22C55E" strokeWidth={1.5} fill="url(#grad-distribuidora)" dot={{ r: 3, fill: "#22C55E" }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ══════ RANKING + PICOS ══════ */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* Top Contas */}
          <motion.div custom={20} variants={cardVariants} initial="hidden" animate="visible">
            <Card className="border-border/50 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" /> Top Contas do Período
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const allAccounts = [
                    { name: "CLICKMULTII", total: allMlAccounts.find(a => a.name === "CLICKMULTII")?.month?.total ?? 0, color: "#3B82F6" },
                    { name: "DUOULTILIDADE", total: allMlAccounts.find(a => a.name === "DUOULTILIDADE")?.month?.total ?? 0, color: "#1D4ED8" },
                    { name: "KAIBRENLTDA", total: allMlAccounts.find(a => a.name === "KAIBRENLTDA")?.month?.total ?? 0, color: "#60A5FA" },
                    ...(allShopeeAccounts ?? []).map((a: any) => ({
                      name: a.name, total: a.total ?? 0, color: "#F97316",
                    })),
                  ];
                  const accounts = (accountFilter !== "all"
                    ? allAccounts.filter(a => a.name === accountFilter)
                    : allAccounts
                  ).sort((a, b) => b.total - a.total);
                  const maxTotal = accounts[0]?.total || 1;
                  return accounts.map((acc, i) => (
                    <div key={acc.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <span className="font-bold text-foreground">{i + 1}.</span> {acc.name}
                        </span>
                        <span className="text-sm font-bold text-foreground">{fmt(acc.total)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(acc.total / maxTotal) * 100}%`, backgroundColor: acc.color }} />
                      </div>
                    </div>
                  ));
                })()}
              </CardContent>
            </Card>
          </motion.div>

          {/* Horário de Pico */}
          <motion.div custom={21} variants={cardVariants} initial="hidden" animate="visible">
            <Card className="border-border/50 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" /> Horário de Pico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Melhor faixa horária</span>
                    <div className="text-xl font-bold text-foreground mt-0.5">{insights?.peakHour.range ?? "—"}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Receita nesse horário</span>
                    <div className="text-lg font-bold text-primary mt-0.5">{fmt(insights?.peakHour.avgValue ?? 0)}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Dia da semana com mais vendas</span>
                    <div className="text-sm font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" /> {insights?.peakHour.bestDay ?? "—"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Produto Mais Vendido */}
          <motion.div custom={22} variants={cardVariants} initial="hidden" animate="visible">
            <Card className="border-border/50 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-400" /> Produto Mais Vendido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-muted/30 flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground line-clamp-2">{insights?.topProduct.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{insights?.topProduct.sku ?? "—"}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-muted-foreground">Quantidade vendida</span>
                      <div className="text-lg font-bold text-foreground mt-0.5">{insights?.topProduct.qty ?? 0} un.</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Receita gerada</span>
                      <div className="text-lg font-bold text-emerald-400 mt-0.5">{fmt(insights?.topProduct.revenue ?? 0)}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ══════ DISTRIBUIDORA ══════ */}
        <div className="mt-2">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
            <Building2 className="h-5 w-5 text-primary" /> Distribuidora
          </h2>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { icon: DollarSign, label: "Vendas Dist.", value: fmt(vendasDoMes), sub: `${pedidosCliente} pedidos`, color: "text-emerald-400" },
              { icon: TrendingUp, label: "Lucro Líquido", value: fmt(lucroLiquido), sub: "Após impostos", color: "text-blue-400" },
              { icon: Wallet, label: "Everton Mondial", value: fmt(comissaoEverton), sub: "R$ 0,75/item", color: "text-amber-400" },
              { icon: ArrowDownRight, label: "Imposto Vendas", value: fmt(impostoVendas), sub: "3,92%", color: "text-red-400" },
            ].map((c, i) => (
              <motion.div key={c.label} custom={i + 7} variants={cardVariants} initial="hidden" animate="visible">
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <c.icon className={`h-4 w-4 ${c.color}`} />
                      <span className="text-xs text-muted-foreground">{c.label}</span>
                    </div>
                    <div className="mt-2 text-lg font-bold">{c.value}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{c.sub}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Card: Distribuidora — Vendas do mês */}
        <motion.div custom={11} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="h-5 w-5 text-primary" />
                    <span className="text-sm font-semibold text-primary">Distribuidora — Vendas do mês</span>
                  </div>
                  <div className="text-3xl font-bold text-foreground">{fmt(vendasDoMes)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{pedidosCliente} pedidos finalizados</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">Compras pessoais</div>
                  <div className="text-lg font-bold text-foreground">{fmt(comprasDoMesMondial)}</div>
                  <div className="text-xs text-muted-foreground">{pedidosPessoais} pedidos</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Subtotal geral: Marketplace + Distribuidora */}
        <motion.div custom={12} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">Faturamento Total do Mês</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Marketplace (ML{selectedAccount ? ` · ${selectedAccount.name}` : ""}) — {periodLabelText}
                  </div>
                  <div className="text-xl font-bold text-blue-400">{fmt(mlPeriodTotal)}</div>
                </div>
                {!isSingleDay && !selectedAccount && (
                  <div>
                    <div className="text-xs text-muted-foreground">Distribuidora</div>
                    <div className="text-xl font-bold text-emerald-400">{fmt(vendasDoMes)}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground">Total {isSingleDay ? periodLabelText : "Geral"}</div>
                  <div className="text-2xl font-bold text-primary">{fmt(faturamentoTotal)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Noah diz */}
        <motion.div custom={13} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold text-primary">Noah diz:</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse-dot" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {mlPeriodCount > 0
                  ? selectedAccount
                    ? `${periodLabelText} — conta ${selectedAccount.name}: ${mlPeriodCount} vendas totalizando ${fmt(mlPeriodTotal)}.`
                    : `${periodLabelText}: ${mlPeriodCount} vendas no ML totalizando ${fmt(mlPeriodTotal)}. A conta ${allMlAccounts.length > 0 ? [...allMlAccounts].sort((a: any, b: any) => (b.today?.total ?? 0) - (a.today?.total ?? 0))[0]?.name : "—"} está liderando.`
                  : `Nenhuma venda encontrada no Mercado Livre para ${periodLabelText}${selectedAccount ? ` na conta ${selectedAccount.name}` : ""}.`
                }
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
