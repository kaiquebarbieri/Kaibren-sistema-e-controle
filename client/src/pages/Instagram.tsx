import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Eye,
  Heart,
  Instagram as InstagramIcon,
  Loader2,
  MessageCircle,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

function AccountTab({ account }: { account: any }) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const buildChart = useCallback(() => {
    if (!chartRef.current || !account?.weeklyGrowth || account.weeklyGrowth.length === 0) return;
    if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
    const container = chartRef.current;
    container.innerHTML = "";
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: account.weeklyGrowth.map((d: any) => d.date),
        datasets: [{
          label: "Seguidores",
          data: account.weeklyGrowth.map((d: any) => d.followers),
          borderColor: "#D4AF37",
          backgroundColor: "rgba(212, 175, 55, 0.1)",
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointBackgroundColor: "#D4AF37",
          pointRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0E1223",
            borderColor: "#334155",
            borderWidth: 1,
            titleColor: "#F8FAFC",
            bodyColor: "#CBD5E1",
          },
        },
        scales: {
          x: { grid: { color: "rgba(51,65,85,0.3)" }, ticks: { color: "#94A3B8", font: { size: 11 } } },
          y: { grid: { color: "rgba(51,65,85,0.3)" }, ticks: { color: "#94A3B8", font: { size: 11 } } },
        },
      },
    });
  }, [account]);

  useEffect(() => { buildChart(); return () => { chartInstance.current?.destroy(); }; }, [buildChart]);

  return (
    <div className="flex flex-col gap-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { icon: Users, label: "Seguidores", value: (account.followers ?? 0).toLocaleString("pt-BR"), sub: account.followersGrowth > 0 ? `+${account.followersGrowth} esta semana` : "", color: "text-primary", subColor: "text-emerald-400" },
          { icon: Eye, label: "Alcance", value: (account.reach ?? 0).toLocaleString("pt-BR"), sub: "Últimos 7 dias", color: "text-blue-400", subColor: "text-muted-foreground" },
          { icon: InstagramIcon, label: "Impressões", value: (account.impressions ?? 0).toLocaleString("pt-BR"), sub: "Últimos 7 dias", color: "text-purple-400", subColor: "text-muted-foreground" },
          { icon: TrendingUp, label: "Engajamento", value: `${(account.engagement ?? 0).toFixed(1)}%`, sub: "Taxa média", color: "text-emerald-400", subColor: "text-muted-foreground" },
          { icon: Heart, label: "Crescimento", value: account.followersGrowth > 0 ? `+${account.followersGrowth}` : "0", sub: "Novos seguidores", color: "text-red-400", subColor: "text-muted-foreground" },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} custom={i} variants={cardVariants} initial="hidden" animate="visible">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                </div>
                <div className={`mt-2 text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                {kpi.sub && <div className={`mt-1 text-xs ${kpi.subColor}`}>{kpi.sub}</div>}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Growth chart */}
      {account.weeklyGrowth && account.weeklyGrowth.length > 0 && (
        <motion.div custom={5} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Crescimento Semanal — {account.handle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={chartRef} className="relative w-full h-[240px] sm:h-[280px]" />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Top posts */}
      <motion.div custom={6} variants={cardVariants} initial="hidden" animate="visible">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <InstagramIcon className="h-4 w-4 text-purple-400" /> Top 3 Posts — {account.handle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(account.topPosts ?? []).map((post: any, idx: number) => (
                <div key={post.id || idx} className="rounded-xl border border-border/30 bg-muted/20 p-4 transition-colors hover:bg-muted/40">
                  <div className="flex items-start gap-2 mb-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-sm text-foreground line-clamp-3 leading-relaxed">{post.caption || "Sem legenda"}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border/20 pt-2.5">
                    <span className="flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5 text-red-400" />
                      {post.likes.toLocaleString("pt-BR")}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5 text-blue-400" />
                      {post.comments.toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function InstagramPage() {
  const { data, isLoading } = trpc.marketing.instagramMulti.useQuery();
  const [activeTab, setActiveTab] = useState(0);

  const accounts = data?.accounts ?? [];

  return (
    <DashboardLayout activeSection="instagram">
      <div className="flex flex-col gap-4 sm:gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Instagram</h1>
          <p className="text-sm text-muted-foreground">Métricas e insights por conta</p>
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
                    <p className="text-sm text-amber-400 font-medium">Instagram não configurado</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configure as variáveis <code className="text-primary">INSTAGRAM_ACCOUNT_1</code>, <code className="text-primary">INSTAGRAM_ACCOUNT_1_TOKEN</code> e <code className="text-primary">INSTAGRAM_ACCOUNT_1_ID</code> no .env para cada conta.
                    Exibindo dados de exemplo.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Tabs de contas */}
            {accounts.length > 0 && (
              <div className="flex gap-2 border-b border-border/30 pb-0">
                {accounts.map((acc, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTab(i)}
                    className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                      activeTab === i
                        ? "bg-primary/10 text-primary border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                  >
                    <InstagramIcon className="inline h-3.5 w-3.5 mr-1.5" />
                    {acc.handle}
                    <span className="ml-2 text-xs opacity-70">{acc.followers.toLocaleString("pt-BR")} seg.</span>
                  </button>
                ))}
              </div>
            )}

            {/* Conteúdo da aba ativa */}
            {accounts[activeTab] && (
              <AccountTab key={activeTab} account={accounts[activeTab]} />
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
