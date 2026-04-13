import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  Loader2,
  Crown,
  TrendingUp,
  Package,
  DollarSign,
  Scale,
  ShoppingCart,
  Megaphone,
  Camera,
  Store,
  Handshake,
  Mail,
  User,
  Zap,
  Activity,
  ChevronRight,
} from "lucide-react";
import { useLocation } from "wouter";

/* ─── Constants ─────────────────────────────────────────────── */

const GOLD = "#D4AF37";
const BG   = "#020617";
const CARD = "#0A0F1E";
const CARD2 = "#0E1525";
const BORDER = "#1E2A3A";

const DEPT_MAP: Record<string, { label: string; color: string; bg: string }> = {
  noah:   { label: "CEO",            color: GOLD,      bg: "#1a1200" },
  kaique: { label: "Fundador",       color: "#a78bfa",  bg: "#120d1f" },
  leo:    { label: "Financeiro",     color: "#34d399",  bg: "#061a12" },
  maya:   { label: "Marketing",      color: "#60a5fa",  bg: "#060f1a" },
  bia:    { label: "Operações",      color: "#f97316",  bg: "#1a0c06" },
  rex:    { label: "Fiscal",         color: "#facc15",  bg: "#1a1500" },
  sam:    { label: "Comercial",      color: "#4ade80",  bg: "#061a0a" },
  bruno:  { label: "Jurídico",       color: "#f472b6",  bg: "#1a0613" },
  luna:   { label: "Conteúdo",       color: "#e879f9",  bg: "#180620" },
  vera:   { label: "Loja Física",    color: "#38bdf8",  bg: "#06131a" },
  clara:  { label: "B2B",           color: "#a3e635",  bg: "#0f1a06" },
  eva:    { label: "Comunicação",    color: "#fb923c",  bg: "#1a0f06" },
};

const ICON_MAP: Record<string, React.ElementType> = {
  noah:   Crown,
  kaique: User,
  leo:    DollarSign,
  maya:   Megaphone,
  bia:    Package,
  rex:    Scale,
  sam:    ShoppingCart,
  bruno:  Scale,
  luna:   Camera,
  vera:   Store,
  clara:  Handshake,
  eva:    Mail,
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.055, duration: 0.4, ease: "easeOut" },
  }),
};

/* ─── Helpers ────────────────────────────────────────────────── */

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m atrás`;
  return `${Math.floor(mins / 60)}h atrás`;
}

function StatusDot({ critical }: { critical: boolean }) {
  return (
    <motion.span
      className="inline-block rounded-full"
      style={{
        width: 8, height: 8,
        background: critical ? "#ef4444" : "#22c55e",
        boxShadow: critical ? "0 0 6px #ef4444" : "0 0 6px #22c55e",
      }}
      animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
      transition={{ repeat: Infinity, duration: 2 }}
    />
  );
}

/* ─── Agent Card ─────────────────────────────────────────────── */

function AgentCard({ agent, i, onClick }: { agent: any; i: number; onClick: () => void }) {
  const isNoah   = agent.slug === "noah";
  const isKaique = agent.slug === "kaique";
  const dept     = DEPT_MAP[agent.slug] ?? { label: "Agente", color: "#94a3b8", bg: "#0f172a" };
  const Icon     = ICON_MAP[agent.slug] ?? Bot;
  const hasCrit  = agent.criticalAlerts > 0;

  return (
    <motion.div
      custom={i}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      onClick={onClick}
      className="group relative cursor-pointer"
      style={{
        borderRadius: 16,
        border: `1px solid ${isNoah ? GOLD + "55" : hasCrit ? "#ef444440" : BORDER}`,
        background: CARD,
        overflow: "hidden",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
      whileHover={{
        scale: 1.015,
        boxShadow: isNoah
          ? `0 0 28px ${GOLD}22, 0 4px 20px #00000055`
          : "0 4px 20px #00000055",
      }}
    >
      {/* Noah glow bar */}
      {isNoah && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
        }} />
      )}

      {/* Dept color accent strip */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 3,
        background: dept.color,
        opacity: 0.7,
        borderRadius: "16px 0 0 16px",
      }} />

      <div style={{ padding: "18px 18px 16px 22px" }}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          {/* Avatar + name */}
          <div className="flex items-center gap-3">
            {/* Icon circle */}
            <div style={{
              width: 46, height: 46,
              borderRadius: 12,
              background: dept.bg,
              border: `1px solid ${dept.color}33`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 22 }}>{agent.avatarEmoji}</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>
                  {agent.name}
                </span>
                {isNoah && <Crown style={{ width: 13, height: 13, color: GOLD }} />}
                {isKaique && <User style={{ width: 13, height: 13, color: "#a78bfa" }} />}
              </div>
              <span style={{ color: "#64748b", fontSize: 11, lineHeight: 1.3 }}>
                {agent.role}
              </span>
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <StatusDot critical={hasCrit} />
              <span style={{ fontSize: 11, color: hasCrit ? "#fca5a5" : "#4ade80" }}>
                {hasCrit ? "Alerta" : "Ativo"}
              </span>
            </div>
            {/* Dept badge */}
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: dept.color,
              background: dept.bg,
              border: `1px solid ${dept.color}33`,
              borderRadius: 20,
              padding: "2px 8px",
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}>
              {dept.label}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: BORDER, margin: "14px 0 12px" }} />

        {/* Metrics row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Tasks */}
            <div className="flex items-center gap-1.5">
              <Activity style={{ width: 12, height: 12, color: "#475569" }} />
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{agent.tasksToday}</span> tarefas
              </span>
            </div>

            {/* Alerts */}
            {hasCrit ? (
              <div className="flex items-center gap-1">
                <AlertTriangle style={{ width: 11, height: 11, color: "#ef4444" }} />
                <span style={{ fontSize: 11, color: "#fca5a5" }}>{agent.criticalAlerts} crítico(s)</span>
              </div>
            ) : agent.alertsCount > 0 ? (
              <div className="flex items-center gap-1">
                <AlertTriangle style={{ width: 11, height: 11, color: "#f59e0b" }} />
                <span style={{ fontSize: 11, color: "#fde68a" }}>{agent.alertsCount} aviso(s)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Zap style={{ width: 11, height: 11, color: "#22c55e" }} />
                <span style={{ fontSize: 11, color: "#4ade80" }}>Normal</span>
              </div>
            )}
          </div>

          {/* Last activity + chevron */}
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 11, color: "#475569" }}>{timeAgo(agent.lastActivity)}</span>
            <ChevronRight
              style={{ width: 14, height: 14, color: "#334155" }}
              className="group-hover:text-slate-400 transition-colors"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Summary Bar ────────────────────────────────────────────── */

function SummaryBar({ agents }: { agents: any[] }) {
  const total    = agents.length;
  const criticals = agents.filter(a => a.criticalAlerts > 0).length;
  const tasks    = agents.reduce((s, a) => s + (a.tasksToday ?? 0), 0);
  const alerts   = agents.reduce((s, a) => s + (a.alertsCount ?? 0), 0);

  const stats = [
    { label: "Agentes",   value: total,    icon: Bot,           color: GOLD },
    { label: "Tarefas",   value: tasks,    icon: Activity,      color: "#34d399" },
    { label: "Alertas",   value: alerts,   icon: AlertTriangle, color: "#f59e0b" },
    { label: "Críticos",  value: criticals, icon: AlertTriangle, color: "#ef4444" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      {stats.map(({ label, value, icon: Icon, color }) => (
        <div key={label} style={{
          background: CARD2,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: "14px 16px",
        }}>
          <div className="flex items-center gap-2 mb-1">
            <Icon style={{ width: 13, height: 13, color }} />
            <span style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              {label}
            </span>
          </div>
          <span style={{ fontSize: 26, fontWeight: 700, color: "#f1f5f9" }}>{value}</span>
        </div>
      ))}
    </motion.div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function Agentes() {
  const { data: agents, isLoading } = trpc.agentes.list.useQuery();
  const [, setLocation] = useLocation();

  // Sort: Noah first, then Kaique, then rest
  const sorted = [...(agents ?? [])].sort((a, b) => {
    if (a.slug === "noah") return -1;
    if (b.slug === "noah") return 1;
    if (a.slug === "kaique") return -1;
    if (b.slug === "kaique") return 1;
    return 0;
  });

  return (
    <DashboardLayout activeSection="agentes">
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .gold-shimmer {
          background: linear-gradient(90deg, ${GOLD}, #ffe98a, ${GOLD});
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 3s linear infinite;
        }
      `}</style>

      <div className="flex flex-col gap-5 sm:gap-6" style={{ fontFamily: "'Inter', sans-serif" }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: "#1a1200",
              border: `1px solid ${GOLD}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Bot style={{ width: 22, height: 22, color: GOLD }} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold gold-shimmer">
                Time Kaibren
              </h1>
              <p style={{ fontSize: 13, color: "#475569" }}>
                {agents?.length ?? "–"} agentes · Operação em tempo real
              </p>
            </div>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 hidden sm:flex">
            <motion.span
              className="inline-block rounded-full"
              style={{ width: 8, height: 8, background: "#22c55e", boxShadow: "0 0 8px #22c55e" }}
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
            <span style={{ fontSize: 12, color: "#4ade80" }}>Live</span>
          </div>
        </motion.div>

        {/* Summary */}
        {!isLoading && agents && <SummaryBar agents={agents} />}

        {/* Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 style={{ width: 24, height: 24, color: "#334155" }} className="animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((agent: any, i: number) => (
              <AgentCard
                key={agent.slug}
                agent={agent}
                i={i}
                onClick={() => setLocation(`/agentes/${agent.slug}`)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
