import DashboardLayout from "@/components/DashboardLayout";
import LiaChat from "@/components/LiaChat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  CircleDashed,
  Coins,
  Crosshair,
  Loader2,
  RotateCcw,
  Send,
  Star,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const KAIBREN_GOLD = "#D4AF37";

type VitalStatus = "green" | "yellow" | "red" | "unknown";

const STATUS_META: Record<VitalStatus, {
  label: string;
  color: string;
  bg: string;
  ring: string;
  icon: any;
}> = {
  green: { label: "OK", color: "text-emerald-300", bg: "bg-emerald-500/10", ring: "border-emerald-500/40", icon: CheckCircle2 },
  yellow: { label: "Atenção", color: "text-amber-300", bg: "bg-amber-500/10", ring: "border-amber-500/40", icon: AlertTriangle },
  red: { label: "Urgente", color: "text-red-300", bg: "bg-red-500/15", ring: "border-red-500/50", icon: AlertCircle },
  unknown: { label: "—", color: "text-muted-foreground", bg: "bg-muted/40", ring: "border-border/50", icon: CircleDashed },
};

const VITAL_ICONS: Record<string, any> = {
  cash: Banknote,
  margin: TrendingUp,
  "critical-supplier": Building2,
  taxes: Crosshair,
  advance: Coins,
  reputation: Star,
  concentration: Activity,
};

function ScoreCircle({ score, status }: { score: number; status: VitalStatus }) {
  const color = status === "green" ? "#10b981" : status === "yellow" ? "#fbbf24" : status === "red" ? "#f87171" : "#9ca3af";
  const circumference = 2 * Math.PI * 56;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  return (
    <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r="56" stroke="rgba(255,255,255,0.07)" strokeWidth="10" fill="none" />
        <circle
          cx="64" cy="64" r="56"
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <p className="text-3xl font-bold tracking-tight" style={{ color }}>{score}</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">de 100</p>
      </div>
    </div>
  );
}

function VitalCard({ vital }: { vital: any }) {
  const meta = STATUS_META[vital.status as VitalStatus];
  const StatusIcon = meta.icon;
  const VitalIcon = VITAL_ICONS[vital.key] ?? Activity;
  return (
    <Card className={`overflow-hidden rounded-2xl border-2 ${meta.ring} bg-card shadow-sm`}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={`rounded-xl p-2 ${meta.bg} ${meta.color}`}>
              <VitalIcon className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold text-foreground">{vital.title}</p>
          </div>
          <Badge variant="outline" className={`${meta.bg} ${meta.color} border-current/30 shrink-0`}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {meta.label}
          </Badge>
        </div>
        <p className={`text-xl font-bold tracking-tight ${meta.color}`}>{vital.value}</p>
        <p className="text-xs leading-5 text-muted-foreground">{vital.detail}</p>
        {vital.recommendation ? (
          <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recomendação Noah</p>
            <p className="mt-1 text-xs leading-5 text-foreground">{vital.recommendation}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ActionPriorityBadge({ priority }: { priority: VitalStatus }) {
  if (priority === "red") return <Badge variant="outline" className="border-red-500/40 bg-red-500/15 text-red-300">🔴 Urgente</Badge>;
  if (priority === "yellow") return <Badge variant="outline" className="border-amber-500/40 bg-amber-500/15 text-amber-300">🟡 Atenção</Badge>;
  return <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">🟢 OK</Badge>;
}

export default function SaudeEmpresa() {
  const [, navigate] = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<string>("");
  const query = trpc.financeHealth.useQuery(undefined, { refetchInterval: 5 * 60 * 1000 });
  const runRecap = trpc.noah.runRecap.useMutation();

  async function refresh() {
    setIsRefreshing(true);
    try { await query.refetch(); } finally { setIsRefreshing(false); }
  }

  async function testRecap(kind: "daily" | "weekly" | "monthly" | "urgent") {
    setPreviewKind(kind);
    setPreviewText("Compondo…");
    try {
      const result = await runRecap.mutateAsync({ kind });
      setPreviewText(result.composed || "(sem conteúdo)");
      if (result.sent) {
        toast.success("Enviado no Telegram");
      } else if (result.error) {
        toast.warning(`Composta — não enviada: ${result.error}`);
      } else if (result.composed) {
        toast.info("Composta (preview)");
      }
    } catch (err: any) {
      setPreviewText(`Erro: ${err.message}`);
      toast.error(err.message);
    }
  }

  const data = query.data;
  const overallMeta = data ? STATUS_META[data.overallStatus as VitalStatus] : STATUS_META.unknown;

  const lastUpdate = useMemo(() => {
    if (!data?.asOf) return "—";
    const d = new Date(data.asOf);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }, [data?.asOf]);

  const summary = data
    ? `Score geral ${data.score}/100 (${overallMeta.label}). ${data.vitals.filter((v: any) => v.status === "red").length} sinal(is) urgente(s), ${data.vitals.filter((v: any) => v.status === "yellow").length} em atenção.`
    : "";

  return (
    <DashboardLayout
      activeSection="saude-empresa"
      onNavigate={(section) => navigate(section === "dashboard" ? "/" : `/${section}`)}
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Financeiro · Saúde da Empresa</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Saúde da empresa</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Monitoramento contínuo dos 7 sinais vitais do negócio. Noah analisa caixa, margem, contas críticas, impostos, antecipação, reputação e concentração de canal — e sinaliza o que precisa de atenção.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-border/60 bg-card text-foreground hover:bg-card/80"
              onClick={refresh}
              disabled={isRefreshing}
            >
              <RotateCcw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {query.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
          </div>
        ) : data ? (
          <>
            {/* Overview card */}
            <Card className={`overflow-hidden rounded-2xl border-2 ${overallMeta.ring} bg-card shadow-sm`}>
              <CardContent className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center">
                <ScoreCircle score={data.score} status={data.overallStatus as VitalStatus} />
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={`${overallMeta.bg} ${overallMeta.color} border-current/30 text-sm`}>
                      <overallMeta.icon className="mr-1.5 h-3.5 w-3.5" />
                      {overallMeta.label === "OK" ? "Tudo bem" : overallMeta.label === "Atenção" ? "Requer atenção" : overallMeta.label === "Urgente" ? "Atenção imediata" : "—"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Atualizado em {lastUpdate} · auto-refresh 5min</span>
                  </div>
                  <p className="text-base font-semibold text-foreground">
                    {data.overallStatus === "green" ? "A empresa está saudável."
                      : data.overallStatus === "yellow" ? "A empresa está saudável, mas alguns sinais pedem atenção."
                      : data.overallStatus === "red" ? "Atenção: há sinais críticos que precisam de ação imediata."
                      : "Carregando análise…"}
                  </p>
                  <div className="flex flex-wrap gap-3 pt-2 text-xs text-muted-foreground">
                    <span><span className="text-emerald-300 font-semibold">{data.vitals.filter((v: any) => v.status === "green").length}</span> OK</span>
                    <span><span className="text-amber-300 font-semibold">{data.vitals.filter((v: any) => v.status === "yellow").length}</span> Atenção</span>
                    <span><span className="text-red-300 font-semibold">{data.vitals.filter((v: any) => v.status === "red").length}</span> Urgente</span>
                    <span><span className="text-muted-foreground font-semibold">{data.vitals.filter((v: any) => v.status === "unknown").length}</span> Sem dado</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top actions */}
            {data.topActions.length > 0 ? (
              <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl bg-[#D4AF37]/15 p-2 text-[#D4AF37]">
                      <Activity className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">Top ações sugeridas pelo Noah</p>
                  </div>
                  <div className="space-y-2">
                    {data.topActions.map((a: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 rounded-xl border border-border/40 bg-muted/10 p-3">
                        <ActionPriorityBadge priority={a.priority as VitalStatus} />
                        <p className="flex-1 text-sm leading-5 text-foreground">{a.action}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* 7 vitals grid */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">7 sinais vitais</h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.vitals.map((v: any) => (
                  <VitalCard key={v.key} vital={v} />
                ))}
              </div>
            </div>

            {/* Noah dispatch test */}
            <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-[#D4AF37]/15 p-2 text-[#D4AF37]">
                    <Send className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Testar Noah Telegram</p>
                    <p className="text-xs text-muted-foreground">Compõe e envia agora pra ver como vai chegar no seu Telegram (precisa TELEGRAM_BOT_TOKEN configurado).</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["daily", "weekly", "monthly", "urgent"] as const).map((kind) => (
                    <Button
                      key={kind}
                      variant="outline"
                      size="sm"
                      className="border-border/60 bg-card hover:bg-card/80"
                      onClick={() => testRecap(kind)}
                      disabled={runRecap.isPending && previewKind === kind}
                    >
                      {runRecap.isPending && previewKind === kind ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : null}
                      {kind === "daily" ? "Diário" : kind === "weekly" ? "Semanal" : kind === "monthly" ? "Mensal" : "Urgente"}
                    </Button>
                  ))}
                </div>
                {previewText !== null ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Preview {previewKind}</p>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewText(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-foreground">{previewText}</pre>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Sources note */}
            <Card className="rounded-2xl border-border/50 bg-card/50 shadow-sm">
              <CardContent className="space-y-1 p-4 text-xs text-muted-foreground">
                <p>• Saldo: extratos importados em <a href="/extratos" className="text-[#D4AF37] hover:underline">Extratos</a>. Importe o último PDF do banco pra dado atualizado.</p>
                <p>• Margem: <a href="/financeiro/dre" className="text-[#D4AF37] hover:underline">DRE Gerencial</a> do mês corrente.</p>
                <p>• Contas a pagar: <a href="/contas/contas-a-pagar" className="text-[#D4AF37] hover:underline">Obrigações</a>.</p>
                <p>• Custos fixos: <a href="/financeiro/custos-fixos" className="text-[#D4AF37] hover:underline">Custos Fixos</a> (base do cálculo "dias cobertos").</p>
                <p>• Reputação ML: valor atual estático (CLICKMULTII 32% — pendência crítica). Próxima fase: sync direto da API ML.</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Erro ao carregar análise: {query.error?.message ?? "desconhecido"}
            </CardContent>
          </Card>
        )}
      </div>

      <LiaChat
        screenContext="Saúde da Empresa"
        pageData={data ? `Score geral ${data.score}/100. ${summary} Vitais: ${data.vitals.map((v: any) => `${v.title}=${v.status}`).join(", ")}.` : ""}
        quickPrompts={[
          "Por que o score caiu?",
          "O que faço primeiro?",
          "Como melhorar a margem?",
        ]}
      />
    </DashboardLayout>
  );
}
