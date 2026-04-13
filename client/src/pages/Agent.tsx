import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Bot,
  Terminal,
  Activity,
  Zap,
  Send,
  ShieldCheck,
  Cpu,
  Users,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Message = { role: "system" | "user" | "assistant"; content: string };

type LogEntry = {
  id: number;
  timestamp: string;
  type: "data" | "warning" | "success" | "message";
  text: string;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ICON_MAP: Record<LogEntry["type"], string> = {
  data: "📊",
  warning: "⚠️",
  success: "✅",
  message: "💬",
};

const PLACEHOLDER_LOGS: LogEntry[] = [
  { id: 1, timestamp: "09:01:12", type: "success", text: "Conexão com banco de dados estabelecida." },
  { id: 2, timestamp: "09:01:14", type: "data", text: "Sincronização de catálogo — 1.247 produtos indexados." },
  { id: 3, timestamp: "09:01:18", type: "message", text: "Agente Noah inicializado com sucesso." },
  { id: 4, timestamp: "09:02:05", type: "data", text: "Pipeline de pedidos ativo — 38 novos desde última verificação." },
  { id: 5, timestamp: "09:03:42", type: "warning", text: "Token Shopee expira em 2 dias — renovação pendente." },
  { id: 6, timestamp: "09:04:10", type: "success", text: "Relatório financeiro diário gerado e armazenado." },
  { id: 7, timestamp: "09:05:33", type: "data", text: "Análise de clientes concluída — 12 leads prioritários identificados." },
  { id: 8, timestamp: "09:06:01", type: "message", text: "Aguardando comandos do operador..." },
];

const INITIAL_MESSAGES: Message[] = [
  {
    role: "system",
    content:
      "Você é o agente interno da CK Distribuidora. Responda com foco operacional, financeiro e comercial.",
  },
];

/* ------------------------------------------------------------------ */
/*  Animations                                                         */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: "easeOut" },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function Agent() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [commandInput, setCommandInput] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);

  /* tRPC queries --------------------------------------------------- */
  const statusQuery = trpc.agent.status.useQuery();
  const agentesQuery = trpc.agentes.list.useQuery();
  const chatMutation = trpc.agent.chat.useMutation({
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.reply },
      ]);
    },
    onError: () => {
      toast.error("Não foi possível falar com o agente agora.");
    },
  });

  useEffect(() => {
    if (!statusQuery.data) return;
    setMessages((prev) => {
      const alreadyInitialized = prev.some(
        (m) =>
          m.role === "assistant" &&
          m.content.includes("estrutura segura do agente"),
      );
      if (alreadyInitialized) return prev;
      return [...prev, { role: "assistant", content: statusQuery.data.message }];
    });
  }, [statusQuery.data]);

  /* Handlers ------------------------------------------------------- */
  function handleSend() {
    const text = commandInput.trim();
    if (!text) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    chatMutation.mutate({ messages: next });
    setCommandInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* Derived data --------------------------------------------------- */
  const activeAgents = agentesQuery.data?.length ?? 9;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <DashboardLayout activeSection="agente">
      {/* Inject pulse-dot keyframe once */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .55; transform: scale(1.35); }
        }
        .animate-pulse-dot {
          animation: pulse-dot 1.6s ease-in-out infinite;
        }
      `}</style>

      <div
        className="flex min-h-screen flex-col gap-5 p-4 sm:p-6"
        style={{ background: "#020617", fontFamily: "'Inter', sans-serif" }}
      >
        {/* ============ HEADER ============ */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <div className="flex items-center gap-2">
            <Bot className="h-7 w-7" style={{ color: "#D4AF37" }} />
            <h1
              className="text-xl font-semibold tracking-tight sm:text-2xl"
              style={{ color: "#f1f5f9" }}
            >
              Noah — Command Center IA
            </h1>
            <span
              className="animate-pulse-dot ml-1 inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: "#22c55e" }}
            />
          </div>
        </motion.header>

        {/* ============ MAIN GRID ============ */}
        <div className="grid flex-1 gap-5 lg:grid-cols-[1fr_320px]">
          {/* ---------- TERMINAL LOG ---------- */}
          <motion.section
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
            className="flex flex-col overflow-hidden rounded-2xl border"
            style={{
              background: "#070B1A",
              borderColor: "#334155",
            }}
          >
            {/* Terminal bar */}
            <div
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium"
              style={{
                background: "#0E1223",
                color: "#94a3b8",
                borderBottom: "1px solid #334155",
              }}
            >
              <Terminal className="h-4 w-4" style={{ color: "#D4AF37" }} />
              Registro de atividades — Noah
            </div>

            {/* Log entries */}
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="flex-1 overflow-y-auto p-4"
              style={{ maxHeight: "calc(100vh - 340px)" }}
            >
              {PLACEHOLDER_LOGS.map((log, i) => (
                <motion.div
                  key={log.id}
                  variants={fadeUp}
                  custom={i}
                  className="mb-2 flex items-start gap-2 text-sm"
                  style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
                >
                  <span style={{ color: "#475569" }}>[{log.timestamp}]</span>
                  <span>{ICON_MAP[log.type]}</span>
                  <span style={{ color: "#cbd5e1" }}>{log.text}</span>
                </motion.div>
              ))}

              {/* Chat messages rendered as log lines */}
              {messages
                .filter((m) => m.role !== "system")
                .map((m, i) => (
                  <motion.div
                    key={`msg-${i}`}
                    variants={fadeUp}
                    custom={PLACEHOLDER_LOGS.length + i}
                    className="mb-2 flex items-start gap-2 text-sm"
                    style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
                  >
                    <span style={{ color: "#475569" }}>
                      [{new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}]
                    </span>
                    <span>{m.role === "user" ? "💬" : "✅"}</span>
                    <span
                      style={{
                        color: m.role === "user" ? "#D4AF37" : "#a5f3fc",
                      }}
                    >
                      {m.role === "user" ? `Operador: ${m.content}` : `Noah: ${m.content}`}
                    </span>
                  </motion.div>
                ))}

              {chatMutation.isPending && (
                <div
                  className="mb-2 flex items-start gap-2 text-sm"
                  style={{
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    color: "#64748b",
                  }}
                >
                  <span>[...]</span>
                  <span>⏳</span>
                  <span>Noah está processando...</span>
                </div>
              )}

              <div ref={logEndRef} />
            </motion.div>
          </motion.section>

          {/* ---------- SIDE PANEL — METRICS ---------- */}
          <motion.aside
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="flex flex-col gap-4"
          >
            {/* Agents card */}
            <div
              className="rounded-2xl border p-5"
              style={{ background: "#0E1223", borderColor: "#334155" }}
            >
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#D4AF37" }}>
                <Users className="h-4 w-4" />
                Agentes ativos
              </div>
              <p className="text-4xl font-bold" style={{ color: "#f1f5f9" }}>
                {activeAgents}
              </p>
              <p className="mt-1 text-xs" style={{ color: "#64748b" }}>
                Operando em tempo real
              </p>
            </div>

            {/* Token status card */}
            <div
              className="rounded-2xl border p-5"
              style={{ background: "#0E1223", borderColor: "#334155" }}
            >
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#D4AF37" }}>
                <ShieldCheck className="h-4 w-4" />
                Status de tokens
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between">
                  <span style={{ color: "#cbd5e1" }}>Mercado Livre</span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ background: "#166534", color: "#86efac" }}
                  >
                    válido
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span style={{ color: "#cbd5e1" }}>Shopee</span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ background: "#713f12", color: "#fde68a" }}
                  >
                    pendente
                  </span>
                </li>
              </ul>
            </div>

            {/* System health card */}
            <div
              className="rounded-2xl border p-5"
              style={{ background: "#0E1223", borderColor: "#334155" }}
            >
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#D4AF37" }}>
                <Activity className="h-4 w-4" />
                Saúde do sistema
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: "#22c55e" }}
                />
                <span className="text-lg font-semibold" style={{ color: "#f1f5f9" }}>
                  OK
                </span>
              </div>
              <p className="mt-1 text-xs" style={{ color: "#64748b" }}>
                Todos os serviços operacionais
              </p>
            </div>

            {/* Provider info */}
            <div
              className="rounded-2xl border p-5"
              style={{ background: "#1A1E2F", borderColor: "#334155" }}
            >
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#D4AF37" }}>
                <Cpu className="h-4 w-4" />
                Provedor IA
              </div>
              <ul className="space-y-1 text-xs" style={{ color: "#94a3b8" }}>
                <li>
                  Provider:{" "}
                  <span style={{ color: "#f1f5f9" }}>
                    {statusQuery.data?.provider ?? "openai"}
                  </span>
                </li>
                <li>
                  Modo:{" "}
                  <span style={{ color: "#f1f5f9" }}>
                    {statusQuery.data?.mode ?? "backend_stub"}
                  </span>
                </li>
                <li>
                  Status:{" "}
                  <span style={{ color: "#f1f5f9" }}>
                    {statusQuery.data?.enabled ? "ativo" : "preparado"}
                  </span>
                </li>
              </ul>
            </div>
          </motion.aside>
        </div>

        {/* ============ COMMAND INPUT ============ */}
        <motion.footer
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.45 }}
          className="flex items-center gap-3 rounded-2xl border px-4 py-3"
          style={{ background: "#0E1223", borderColor: "#334155" }}
        >
          <Zap className="h-5 w-5 flex-shrink-0" style={{ color: "#D4AF37" }} />
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enviar comando para Noah..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
            style={{ color: "#f1f5f9", fontFamily: "'Inter', sans-serif" }}
            disabled={chatMutation.isPending}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={chatMutation.isPending || !commandInput.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors disabled:opacity-40"
            style={{ background: "#D4AF37", color: "#020617" }}
          >
            <Send className="h-4 w-4" />
          </button>
        </motion.footer>
      </div>
    </DashboardLayout>
  );
}
