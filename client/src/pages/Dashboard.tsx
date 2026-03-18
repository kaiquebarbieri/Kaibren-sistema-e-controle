import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  DollarSign,
  Loader2,
  ShoppingBag,
  Trophy,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";

const CNPJ_COLORS = [
  { bg: "rgba(16, 185, 129, 0.7)", border: "rgb(16, 185, 129)" },
  { bg: "rgba(59, 130, 246, 0.7)", border: "rgb(59, 130, 246)" },
  { bg: "rgba(249, 115, 22, 0.7)", border: "rgb(249, 115, 22)" },
  { bg: "rgba(168, 85, 247, 0.7)", border: "rgb(168, 85, 247)" },
  { bg: "rgba(236, 72, 153, 0.7)", border: "rgb(236, 72, 153)" },
];

/* ── Helpers ───────────────────────────────────────── */

function formatCurrency(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(value: string | number | null | undefined) {
  const amount = Number(value ?? 0) * 100;
  return `${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/* ── Page Component ────────────────────────────────── */

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const dashboardQuery = trpc.dashboard.monthly.useQuery({
    periodMonth: Number(selectedMonth),
    periodYear: Number(selectedYear),
  });

  const evolutionQuery = trpc.dashboard.yearlyEvolution.useQuery();
  const cnpjRankingQuery = trpc.myCnpjs.ranking.useQuery({
    periodYear: Number(selectedYear),
    periodMonth: Number(selectedMonth),
  });
  const cnpjEvolutionQuery = trpc.myCnpjs.evolution.useQuery({ periodYear: Number(selectedYear) });

  const monthly = dashboardQuery.data;
  const evolution = evolutionQuery.data;
  const cnpjRanking = cnpjRankingQuery.data;
  const cnpjEvolution = cnpjEvolutionQuery.data;

  const cnpjChartContainerRef = useRef<HTMLDivElement | null>(null);
  const cnpjChartInstanceRef = useRef<Chart | null>(null);

  /* ── Métricas calculadas ─────────────────────────── */

  // Vendas para clientes
  const vendasDoMes = Number(monthly?.totalVendasClientes ?? 0);
  const lucroLiquido = Number(monthly?.totalLucro ?? 0);
  const margemMedia = Number(monthly?.margemMedia ?? 0);
  const pedidosCliente = Number(monthly?.totalPedidosCliente ?? 0);

  // Compras pessoais
  const comprasDoMesMondial = Number(monthly?.totalComprasPessoais ?? 0);
  const pedidosPessoais = Number(monthly?.totalPedidosPessoais ?? 0);

  // Everton: R$ 0,75 por item em TODAS as compras (pessoais e vendas)
  const comissaoEverton = Number(monthly?.totalComissaoEvertonMondial ?? 0);

  // Imposto gerado nas vendas da distribuidora (apenas vendas para clientes)
  const impostoVendas = vendasDoMes > 0 ? vendasDoMes * 0.0392 : 0;

  /* ── Chart ─────────────────────────────────────── */

  const buildChart = useCallback(() => {
    if (!chartContainerRef.current || !evolution || evolution.length === 0) return;

    // Destroy previous chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    // Remove any existing canvas and create a fresh one
    const container = chartContainerRef.current;
    container.innerHTML = "";
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobileView = window.innerWidth < 768;

    chartInstanceRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: evolution.map(m => {
          const parts = m.label.split("/");
          return isMobileView ? parts[0] : m.label;
        }),
        datasets: [
          {
            label: "Vendas",
            data: evolution.map(m => Number(m.vendas)),
            backgroundColor: "rgba(16, 185, 129, 0.7)",
            borderColor: "rgb(16, 185, 129)",
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: "Lucro",
            data: evolution.map(m => Number(m.lucro)),
            backgroundColor: "rgba(59, 130, 246, 0.7)",
            borderColor: "rgb(59, 130, 246)",
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: "Compras",
            data: evolution.map(m => Number(m.compras)),
            backgroundColor: "rgba(249, 115, 22, 0.7)",
            borderColor: "rgb(249, 115, 22)",
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            position: isMobileView ? "bottom" : "top",
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              padding: isMobileView ? 8 : 16,
              font: { size: isMobileView ? 10 : 13, weight: "bold" as const },
            },
          },
          tooltip: {
            backgroundColor: "rgba(0,0,0,0.85)",
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (context: any) => {
                const value = Number(context.raw ?? 0);
                return `${context.dataset.label}: ${value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: isMobileView ? 9 : 11 },
              maxRotation: isMobileView ? 45 : 0,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(0,0,0,0.06)" },
            ticks: {
              font: { size: isMobileView ? 9 : 11 },
              callback: (value: any) => {
                const num = Number(value);
                if (num >= 1000) return `R$ ${(num / 1000).toFixed(0)}k`;
                return `R$ ${num}`;
              },
            },
          },
        },
      },
    });
  }, [evolution]);

  useEffect(() => {
    buildChart();
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [buildChart]);

  // Rebuild chart on window resize for mobile/desktop switch
  useEffect(() => {
    const handleResize = () => {
      buildChart();
      buildCnpjChart();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [buildChart]);

  /* ── CNPJ Evolution Chart ─────────────────────── */

  const buildCnpjChart = useCallback(() => {
    if (!cnpjChartContainerRef.current || !cnpjEvolution || cnpjEvolution.length === 0) return;

    if (cnpjChartInstanceRef.current) {
      cnpjChartInstanceRef.current.destroy();
      cnpjChartInstanceRef.current = null;
    }

    const container = cnpjChartContainerRef.current;
    container.innerHTML = "";
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobileView = window.innerWidth < 768;
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const labels = Array.from({ length: currentMonth }, (_, i) => monthNames[i]);

    // Group data by CNPJ
    const cnpjMap = new Map<number, { name: string; data: number[] }>();
    cnpjEvolution.forEach((row: any) => {
      const id = row.cnpjId as number;
      if (!cnpjMap.has(id)) {
        cnpjMap.set(id, {
          name: (row.nomeFantasia || row.razaoSocial || "CNPJ") as string,
          data: new Array(currentMonth).fill(0),
        });
      }
      const entry = cnpjMap.get(id)!;
      const monthIdx = (row.periodMonth as number) - 1;
      if (monthIdx >= 0 && monthIdx < currentMonth) {
        entry.data[monthIdx] = Number(row.totalCompras);
      }
    });

    const datasets = Array.from(cnpjMap.entries()).map(([_, entry], idx) => ({
      label: entry.name,
      data: entry.data,
      backgroundColor: CNPJ_COLORS[idx % CNPJ_COLORS.length].bg,
      borderColor: CNPJ_COLORS[idx % CNPJ_COLORS.length].border,
      borderWidth: 2,
      borderRadius: 4,
      tension: 0.3,
      fill: false,
    }));

    cnpjChartInstanceRef.current = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: isMobileView ? "bottom" : "top",
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              padding: isMobileView ? 8 : 16,
              font: { size: isMobileView ? 10 : 13, weight: "bold" as const },
            },
          },
          tooltip: {
            backgroundColor: "rgba(0,0,0,0.85)",
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (context: any) => {
                const value = Number(context.raw ?? 0);
                return `${context.dataset.label}: ${value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: isMobileView ? 9 : 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(0,0,0,0.06)" },
            ticks: {
              font: { size: isMobileView ? 9 : 11 },
              callback: (value: any) => {
                const num = Number(value);
                if (num >= 1000) return `R$ ${(num / 1000).toFixed(0)}k`;
                return `R$ ${num}`;
              },
            },
          },
        },
      },
    });
  }, [cnpjEvolution]);

  useEffect(() => {
    buildCnpjChart();
    return () => {
      if (cnpjChartInstanceRef.current) {
        cnpjChartInstanceRef.current.destroy();
        cnpjChartInstanceRef.current = null;
      }
    };
  }, [buildCnpjChart]);

  /* ── Render ────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader>
            <CardTitle>Sistema CK Distribuidora</CardTitle>
            <CardDescription>Faça login para acessar o dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => (window.location.href = getLoginUrl())}>
              Entrar no sistema
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const months = [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  return (
    <DashboardLayout activeSection="dashboard">
      <div className="flex flex-col gap-4 sm:gap-6 bg-background">
        {/* ── Header ─────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl sm:rounded-[28px] border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4 py-5 sm:px-6 sm:py-6 text-white shadow-sm lg:px-8 lg:py-8">
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
                  <span className="text-xs sm:text-sm font-medium text-emerald-400">Dashboard de Performance</span>
                </div>
                <h1 className="text-xl sm:text-3xl font-semibold tracking-tight">Resultados e evolução mensal</h1>
                <p className="max-w-xl text-xs sm:text-sm leading-5 sm:leading-6 text-slate-300">
                  Acompanhe suas vendas, lucro líquido, compras do mês e a evolução mês a mês.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-slate-300 text-xs sm:text-sm">Mês</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[120px] sm:w-[140px] border-white/10 bg-white/10 text-white text-sm h-9 sm:h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-slate-300 text-xs sm:text-sm">Ano</Label>
                  <Input
                    value={selectedYear}
                    onChange={e => setSelectedYear(e.target.value)}
                    className="w-[70px] sm:w-[90px] border-white/10 bg-white/10 text-white placeholder:text-slate-400 text-sm h-9 sm:h-10"
                  />
                </div>
              </div>
            </div>

            {/* ── Cards principais ──────── */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
              {/* Vendas do mês */}
              <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs uppercase tracking-wide text-slate-300">
                  <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" />
                  <span className="truncate">Vendas do mês</span>
                </div>
                <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-white">{formatCurrency(vendasDoMes)}</div>
                <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-400">{pedidosCliente} pedido(s)</div>
              </div>

              {/* Lucro líquido */}
              <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs uppercase tracking-wide text-slate-300">
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-400" />
                  <span className="truncate">Lucro líquido</span>
                </div>
                <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-white">{formatCurrency(lucroLiquido)}</div>
                <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-400">Após impostos e Everton</div>
              </div>

              {/* Compras pessoais */}
              <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs uppercase tracking-wide text-slate-300">
                  <ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-400" />
                  <span className="truncate">Compras pessoais</span>
                </div>
                <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-white">{formatCurrency(comprasDoMesMondial)}</div>
                <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-400">{pedidosPessoais} compra(s)</div>
              </div>

              {/* Everton Mondial - card independente com nome dele */}
              <div className="rounded-xl sm:rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 sm:p-4">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs uppercase tracking-wide text-amber-300">
                  <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400" />
                  <span className="truncate">Everton Mondial</span>
                </div>
                <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-white">{formatCurrency(comissaoEverton)}</div>
                <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-400">R$ 0,75 por item</div>
              </div>

              {/* Imposto das vendas - card independente separado */}
              <div className="rounded-xl sm:rounded-2xl border border-red-500/30 bg-red-500/10 p-3 sm:p-4">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs uppercase tracking-wide text-red-300">
                  <ArrowDownRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-400" />
                  <span className="truncate">Imposto vendas</span>
                </div>
                <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-white">{formatCurrency(impostoVendas)}</div>
                <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-400">Apenas vendas clientes</div>
              </div>

              {/* Margem média */}
              <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs uppercase tracking-wide text-slate-300">
                  <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-400" />
                  <span className="truncate">Margem média</span>
                </div>
                <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-white">{formatPercent(margemMedia)}</div>
                <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-400">Pedidos de cliente</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Gráfico de evolução ────────────────── */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="px-4 sm:px-6 pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" /> Evolução mês a mês
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Vendas, lucro e compras de {selectedYear}.</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {evolutionQuery.isLoading ? (
              <div className="flex items-center justify-center" style={{ height: 280 }}>
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div
                ref={chartContainerRef}
                className="relative w-full h-[260px] sm:h-[340px]"
              />
            )}
          </CardContent>
        </Card>

        {/* ── Ranking de CNPJs ────────────────── */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="px-4 sm:px-6 pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
              <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" /> Ranking dos meus CNPJs
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Compras pessoais por CNPJ em {months.find(m => m.value === selectedMonth)?.label}/{selectedYear}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {cnpjRankingQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !cnpjRanking || cnpjRanking.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Nenhuma compra pessoal com CNPJ vinculado neste período.</p>
                <p className="text-xs mt-1">Cadastre seus CNPJs e vincule nas compras pessoais.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const totalGeral = cnpjRanking.reduce((sum: number, r: any) => sum + Number(r.totalCompras), 0);
                  return cnpjRanking.map((r: any, idx: number) => {
                    const total = Number(r.totalCompras);
                    const pct = totalGeral > 0 ? (total / totalGeral) * 100 : 0;
                    const color = CNPJ_COLORS[idx % CNPJ_COLORS.length];
                    return (
                      <div key={r.cnpjId} className="flex items-center gap-3 sm:gap-4 p-3 rounded-xl bg-muted/50">
                        <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full font-bold text-sm sm:text-base text-white" style={{ backgroundColor: color.border }}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm sm:text-base truncate">{r.nomeFantasia || r.razaoSocial}</div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground">{r.cnpj} &middot; {r.totalPedidos} pedido(s)</div>
                          <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color.border }} />
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm sm:text-lg">{formatCurrency(total)}</div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground">{pct.toFixed(1)}%</div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Gráfico de evolução por CNPJ ────────────────── */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="px-4 sm:px-6 pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
              <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" /> Evolução de compras por CNPJ
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Performance de compras pessoais de cada CNPJ em {selectedYear}.</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {cnpjEvolutionQuery.isLoading ? (
              <div className="flex items-center justify-center" style={{ height: 280 }}>
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !cnpjEvolution || cnpjEvolution.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Nenhuma compra pessoal com CNPJ vinculado em {selectedYear}.</p>
              </div>
            ) : (
              <div
                ref={cnpjChartContainerRef}
                className="relative w-full h-[260px] sm:h-[340px]"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
