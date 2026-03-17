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
  DollarSign,
  Loader2,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";

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
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const dashboardQuery = trpc.dashboard.monthly.useQuery({
    periodMonth: Number(selectedMonth),
    periodYear: Number(selectedYear),
  });

  const evolutionQuery = trpc.dashboard.yearlyEvolution.useQuery();

  const monthly = dashboardQuery.data;
  const evolution = evolutionQuery.data;

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

  // Total Mondial geral (vendas + compras pessoais)
  const totalMondialGeral = Number(monthly?.totalMondial ?? 0);

  /* ── Chart ─────────────────────────────────────── */

  useEffect(() => {
    if (!chartRef.current || !evolution || evolution.length === 0) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: evolution.map(m => m.label),
        datasets: [
          {
            label: "Vendas",
            data: evolution.map(m => Number(m.vendas)),
            backgroundColor: "rgba(16, 185, 129, 0.7)",
            borderColor: "rgb(16, 185, 129)",
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: "Lucro líquido",
            data: evolution.map(m => Number(m.lucro)),
            backgroundColor: "rgba(59, 130, 246, 0.7)",
            borderColor: "rgb(59, 130, 246)",
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: "Compras pessoais",
            data: evolution.map(m => Number(m.compras)),
            backgroundColor: "rgba(249, 115, 22, 0.7)",
            borderColor: "rgb(249, 115, 22)",
            borderWidth: 1,
            borderRadius: 6,
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
            position: "top",
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              padding: 16,
              font: { size: 13, weight: "bold" as const },
            },
          },
          tooltip: {
            backgroundColor: "rgba(0,0,0,0.85)",
            titleFont: { size: 13 },
            bodyFont: { size: 12 },
            padding: 12,
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
            ticks: { font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(0,0,0,0.06)" },
            ticks: {
              font: { size: 11 },
              callback: (value: any) => {
                return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
              },
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [evolution]);

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
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
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
      <div className="flex flex-col gap-6 bg-background">
        {/* ── Header ─────────────────────────────── */}
        <div className="overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-sm lg:px-8 lg:py-8">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">Dashboard de Performance</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Resultados e evolução mensal</h1>
              <p className="max-w-xl text-sm leading-6 text-slate-300">
                Acompanhe suas vendas, lucro líquido, compras do mês e a evolução mês a mês.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <Label className="text-slate-300 text-sm">Mês</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[140px] border-white/10 bg-white/10 text-white">
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
                  <Label className="text-slate-300 text-sm">Ano</Label>
                  <Input
                    value={selectedYear}
                    onChange={e => setSelectedYear(e.target.value)}
                    className="w-[90px] border-white/10 bg-white/10 text-white placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* ── Cards principais no header ──────── */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Vendas do mês */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-300">
                  <DollarSign className="h-4 w-4 text-emerald-400" /> Vendas do mês
                </div>
                <div className="mt-2 text-2xl font-bold text-white">{formatCurrency(vendasDoMes)}</div>
                <div className="mt-1 text-xs text-slate-400">{pedidosCliente} pedido(s) para clientes</div>
              </div>

              {/* Lucro líquido: vendas - custo Mondial - impostos - 0,75/item */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-300">
                  <TrendingUp className="h-4 w-4 text-blue-400" /> Lucro líquido
                </div>
                <div className="mt-2 text-2xl font-bold text-white">{formatCurrency(lucroLiquido)}</div>
                <div className="mt-1 text-xs text-slate-400">Após impostos e R$ 0,75/item</div>
              </div>

              {/* Compras pessoais: total pago à Mondial */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-300">
                  <ShoppingBag className="h-4 w-4 text-orange-400" /> Compras pessoais
                </div>
                <div className="mt-2 text-2xl font-bold text-white">{formatCurrency(comprasDoMesMondial)}</div>
                <div className="mt-1 text-xs text-slate-400">{pedidosPessoais} compra(s) no mês</div>
              </div>

              {/* Everton: R$ 0,75 por item em todas as compras */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-300">
                  <Wallet className="h-4 w-4 text-yellow-400" /> Pagar ao Everton
                </div>
                <div className="mt-2 text-2xl font-bold text-white">{formatCurrency(comissaoEverton)}</div>
                <div className="mt-1 text-xs text-slate-400">R$ 0,75 por item comprado</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Cards de detalhamento ──────────────── */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> Vendas para clientes
              </CardDescription>
              <CardTitle className="text-base">Receita da distribuidora</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatCurrency(vendasDoMes)}</CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-blue-500" /> Lucro líquido
              </CardDescription>
              <CardTitle className="text-base">Vendas - custo - impostos - 0,75</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatCurrency(lucroLiquido)}</CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <ArrowDownRight className="h-3.5 w-3.5 text-orange-500" /> Compras pessoais
              </CardDescription>
              <CardTitle className="text-base">Total pago à Mondial</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatCurrency(comprasDoMesMondial)}</CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Margem média</CardDescription>
              <CardTitle className="text-base">Pedidos de cliente</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatPercent(margemMedia)}</CardContent>
          </Card>
        </div>

        {/* ── Gráfico de evolução ────────────────── */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BarChart3 className="h-5 w-5" /> Evolução mês a mês
            </CardTitle>
            <CardDescription>Vendas, lucro líquido e compras pessoais dos últimos 12 meses.</CardDescription>
          </CardHeader>
          <CardContent>
            {evolutionQuery.isLoading ? (
              <div className="flex h-[340px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="relative h-[340px] w-full">
                <canvas ref={chartRef} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
