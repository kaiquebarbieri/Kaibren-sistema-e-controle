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

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

export default function MetaAds() {
  const { data, isLoading } = trpc.marketing.metaAds.useQuery();

  return (
    <DashboardLayout activeSection="meta-ads">
      <div className="flex flex-col gap-4 sm:gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Meta Ads</h1>
          <p className="text-sm text-muted-foreground">Performance das campanhas Facebook e Instagram Ads</p>
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
                    <p className="text-sm text-amber-400 font-medium">Meta Ads não configurado</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configure <code className="text-primary">META_ACCESS_TOKEN</code> e <code className="text-primary">META_AD_ACCOUNT_ID</code> no arquivo .env para ver dados reais.
                    Acesse <span className="text-foreground">developers.facebook.com</span> para gerar o token.
                    Exibindo dados de exemplo abaixo.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { icon: DollarSign, label: "Gasto Total", value: fmt(data.totalSpend), color: "text-red-400" },
                { icon: Eye, label: "Impressões", value: (data.totalImpressions ?? 0).toLocaleString("pt-BR"), color: "text-blue-400" },
                { icon: MousePointer, label: "Cliques", value: (data.totalClicks ?? 0).toLocaleString("pt-BR"), color: "text-emerald-400" },
                { icon: Target, label: "CTR Médio", value: `${(data.avgCtr ?? 0).toFixed(2)}%`, color: "text-primary" },
                { icon: DollarSign, label: "CPC Médio", value: fmt(data.avgCpc ?? 0), color: "text-amber-400" },
                { icon: TrendingUp, label: "ROAS Médio", value: `${(data.avgRoas ?? 0).toFixed(1)}x`, color: "text-purple-400" },
              ].map((kpi, i) => (
                <motion.div key={kpi.label} custom={i} variants={cardVariants} initial="hidden" animate="visible">
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
                          <th className="text-left py-2.5 pr-4 font-medium">Status</th>
                          <th className="text-right py-2.5 pr-4 font-medium">Orçamento/dia</th>
                          <th className="text-right py-2.5 pr-4 font-medium">Gasto (7d)</th>
                          <th className="text-right py-2.5 pr-4 font-medium">Impressões</th>
                          <th className="text-right py-2.5 pr-4 font-medium">Cliques</th>
                          <th className="text-right py-2.5 pr-4 font-medium">CTR</th>
                          <th className="text-right py-2.5 pr-4 font-medium">Resultados</th>
                          <th className="text-right py-2.5 pr-4 font-medium">Custo/Resultado</th>
                          <th className="text-right py-2.5 font-medium">ROAS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.campaigns ?? []).map((c: any) => (
                          <tr key={c.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                            <td className="py-3 pr-4 font-medium text-foreground">{c.name}</td>
                            <td className="py-3 pr-4">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                c.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"
                              }`}>
                                {c.status === "ACTIVE" ? "Ativo" : "Pausado"}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-right text-muted-foreground">{fmt(c.dailyBudget)}</td>
                            <td className="py-3 pr-4 text-right">{fmt(c.spendToday)}</td>
                            <td className="py-3 pr-4 text-right text-muted-foreground">{c.impressions.toLocaleString("pt-BR")}</td>
                            <td className="py-3 pr-4 text-right">{c.clicks.toLocaleString("pt-BR")}</td>
                            <td className="py-3 pr-4 text-right text-muted-foreground">{c.ctr.toFixed(2)}%</td>
                            <td className="py-3 pr-4 text-right font-medium">{c.results}</td>
                            <td className="py-3 pr-4 text-right text-muted-foreground">{c.results > 0 ? fmt(c.costPerResult) : "—"}</td>
                            <td className={`py-3 text-right font-bold ${
                              c.roas > 0 && c.roas < 1 ? "text-red-400" : c.roas >= 2 ? "text-emerald-400" : "text-foreground"
                            }`}>
                              {c.roas > 0 ? `${c.roas.toFixed(1)}x` : "—"}
                              {c.roas > 0 && c.roas < 1 && (
                                <span className="ml-1.5 inline-flex items-center rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">
                                  ROAS baixo
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
