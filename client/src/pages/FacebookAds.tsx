import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  DollarSign,
  Eye,
  Loader2,
  MousePointer,
  Target,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import Chart from "chart.js/auto";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

export default function FacebookAds() {
  const { data, isLoading } = trpc.marketing.facebookAds.useQuery();
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const buildChart = useCallback(() => {
    if (!chartRef.current || !data?.dailyData || data.dailyData.length === 0) return;
    if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
    const container = chartRef.current;
    container.innerHTML = "";
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.dailyData.map((d: any) => d.date),
        datasets: [
          {
            label: "Investimento",
            data: data.dailyData.map((d: any) => d.spend),
            backgroundColor: "rgba(239, 68, 68, 0.6)",
            borderColor: "#EF4444",
            borderWidth: 1,
            borderRadius: 4,
            order: 2,
          },
          {
            label: "Receita gerada",
            data: data.dailyData.map((d: any) => d.revenue),
            backgroundColor: "rgba(34, 197, 94, 0.6)",
            borderColor: "#22C55E",
            borderWidth: 1,
            borderRadius: 4,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#94A3B8", usePointStyle: true, pointStyle: "circle", font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: "#0E1223",
            borderColor: "#334155",
            borderWidth: 1,
            titleColor: "#F8FAFC",
            bodyColor: "#CBD5E1",
            callbacks: {
              label: (c: any) => `${c.dataset.label}: ${fmt(c.raw)}`,
            },
          },
        },
        scales: {
          x: { grid: { color: "rgba(51,65,85,0.3)" }, ticks: { color: "#94A3B8", font: { size: 10 }, maxRotation: 45 } },
          y: {
            grid: { color: "rgba(51,65,85,0.3)" },
            ticks: {
              color: "#94A3B8",
              font: { size: 11 },
              callback: (v: any) => Number(v) >= 1000 ? `R$${(Number(v) / 1000).toFixed(0)}k` : `R$${v}`,
            },
          },
        },
      },
    });
  }, [data]);

  useEffect(() => { buildChart(); return () => { chartInstance.current?.destroy(); }; }, [buildChart]);

  const totalInvested = data?.totalSpend ?? 0;
  const totalRevenue = data?.totalRevenue ?? 0;
  const roas = totalInvested > 0 ? totalRevenue / totalInvested : 0;
  const lowRoasCampaigns = (data?.campaigns ?? []).filter((c: any) => c.roas > 0 && c.roas < 1);

  return (
    <DashboardLayout activeSection="facebook-ads">
      <div className="flex flex-col gap-4 sm:gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Facebook Ads</h1>
          <p className="text-sm text-muted-foreground">Performance das campanhas Facebook Ads — ROAS e investimento</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? null : (
          <>
            {!data.configured && (
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <p className="text-sm text-amber-400 font-medium">Facebook Ads não configurado</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configure <code className="text-primary">META_ACCESS_TOKEN</code> e <code className="text-primary">META_AD_ACCOUNT_ID</code> no arquivo .env para ver dados reais.
                    Exibindo dados de exemplo abaixo.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* KPI principal: Investido vs Retorno */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { icon: DollarSign, label: "Total Investido", value: fmt(totalInvested), color: "text-red-400", bg: "border-red-500/20 bg-red-500/5" },
                { icon: TrendingUp, label: "Receita Gerada", value: fmt(totalRevenue), color: "text-emerald-400", bg: "border-emerald-500/20 bg-emerald-500/5" },
                { icon: Target, label: "ROAS Geral", value: `${roas.toFixed(2)}x`, color: roas >= 1 ? "text-emerald-400" : "text-red-400", bg: roas >= 1 ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5" },
                { icon: Eye, label: "Impressões", value: (data.totalImpressions ?? 0).toLocaleString("pt-BR"), color: "text-blue-400", bg: "border-blue-500/20 bg-blue-500/5" },
              ].map((kpi, i) => (
                <motion.div key={kpi.label} custom={i} variants={cardVariants} initial="hidden" animate="visible">
                  <Card className={`border ${kpi.bg}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                        <span className="text-xs text-muted-foreground">{kpi.label}</span>
                      </div>
                      <div className={`mt-2 text-xl sm:text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Alerta ROAS < 1 */}
            {lowRoasCampaigns.length > 0 && (
              <motion.div custom={4} variants={cardVariants} initial="hidden" animate="visible">
                <Card className="border-red-500/30 bg-red-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                      <span className="text-sm font-semibold text-red-400">Alerta: ROAS abaixo de 1</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {lowRoasCampaigns.length} campanha(s) com ROAS negativo — você está gastando mais do que retorna:
                    </p>
                    <ul className="mt-2 space-y-1">
                      {lowRoasCampaigns.map((c: any) => (
                        <li key={c.id} className="text-sm text-red-300">
                          &bull; <span className="font-medium">{c.name}</span> — ROAS {c.roas.toFixed(2)}x (investiu {fmt(c.spendToday)}, retornou {fmt(c.spendToday * c.roas)})
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Gráfico investimento diário vs vendas — 30 dias */}
            <motion.div custom={5} variants={cardVariants} initial="hidden" animate="visible">
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Investimento vs Vendas — Últimos 30 dias
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div ref={chartRef} className="relative w-full h-[280px] sm:h-[340px]" />
                </CardContent>
              </Card>
            </motion.div>

            {/* Tabela de campanhas */}
            <motion.div custom={6} variants={cardVariants} initial="hidden" animate="visible">
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" /> Campanhas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/30 text-muted-foreground">
                          <th className="text-left py-2.5 pr-4 font-medium">Nome</th>
                          <th className="text-right py-2.5 pr-4 font-medium">Investimento</th>
                          <th className="text-right py-2.5 pr-4 font-medium">Receita Gerada</th>
                          <th className="text-right py-2.5 pr-4 font-medium">ROAS</th>
                          <th className="text-left py-2.5 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.campaigns ?? []).map((c: any) => (
                          <tr key={c.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                            <td className="py-3 pr-4 font-medium text-foreground">{c.name}</td>
                            <td className="py-3 pr-4 text-right text-red-400">{fmt(c.spendToday)}</td>
                            <td className="py-3 pr-4 text-right text-emerald-400">{fmt(c.spendToday * c.roas)}</td>
                            <td className={`py-3 pr-4 text-right font-bold ${
                              c.roas > 0 && c.roas < 1 ? "text-red-400" : c.roas >= 2 ? "text-emerald-400" : "text-foreground"
                            }`}>
                              {c.roas > 0 ? `${c.roas.toFixed(2)}x` : "—"}
                              {c.roas > 0 && c.roas < 1 && (
                                <span className="ml-1.5 inline-flex items-center rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">
                                  baixo
                                </span>
                              )}
                            </td>
                            <td className="py-3">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                c.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"
                              }`}>
                                {c.status === "ACTIVE" ? "Ativo" : "Pausado"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* KPIs secundários */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: MousePointer, label: "Cliques", value: (data.totalClicks ?? 0).toLocaleString("pt-BR"), color: "text-emerald-400" },
                { icon: Target, label: "CTR Médio", value: `${(data.avgCtr ?? 0).toFixed(2)}%`, color: "text-primary" },
                { icon: DollarSign, label: "CPC Médio", value: fmt(data.avgCpc ?? 0), color: "text-amber-400" },
                { icon: TrendingUp, label: "ROAS Médio", value: `${(data.avgRoas ?? 0).toFixed(1)}x`, color: "text-purple-400" },
              ].map((kpi, i) => (
                <motion.div key={kpi.label} custom={i + 7} variants={cardVariants} initial="hidden" animate="visible">
                  <Card className="border-border/50">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-1.5">
                        <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                        <span className="text-xs text-muted-foreground">{kpi.label}</span>
                      </div>
                      <div className={`mt-1.5 text-lg font-bold ${kpi.color}`}>{kpi.value}</div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
