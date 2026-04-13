import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileText,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Send,
  Skull,
  Terminal,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const TASK_STATUS_MAP: Record<string, { label: string; icon: string; color: string }> = {
  pending: { label: "Pendente", icon: "🟡", color: "text-amber-400" },
  running: { label: "Executando", icon: "🔄", color: "text-blue-400" },
  done: { label: "Entregue", icon: "✅", color: "text-emerald-400" },
  failed: { label: "Falhou", icon: "❌", color: "text-red-400" },
  cancelled: { label: "Cancelado", icon: "💀", color: "text-muted-foreground" },
  overdue: { label: "Atrasado", icon: "🔴", color: "text-red-500" },
};

const ALERT_LEVEL: Record<string, { label: string; color: string; bg: string }> = {
  info: { label: "Info", color: "text-blue-400", bg: "bg-blue-500/10" },
  warning: { label: "Aviso", color: "text-amber-400", bg: "bg-amber-500/10" },
  critical: { label: "Crítico", color: "text-red-400", bg: "bg-red-500/10" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)}d`;
}

export default function AgentDetail({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const { data: agent, isLoading } = trpc.agentes.detail.useQuery({ slug });
  const teamStatusQuery = trpc.agentes.teamStatus.useQuery();
  const [, setLocation] = useLocation();
  const [commandInput, setCommandInput] = useState("");
  const [generalOrder, setGeneralOrder] = useState("");
  const [noahTab, setNoahTab] = useState<"timeline" | "tasks" | "reports" | "scores">("timeline");
  const [taskFilter, setTaskFilter] = useState("");
  const [reportModal, setReportModal] = useState<any>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const isNoah = slug === "noah";

  // Queries Noah-only
  const allTasksQuery = trpc.agentes.allTasks.useQuery(
    { status: taskFilter || undefined },
    { enabled: isNoah }
  );
  const timelineQuery = trpc.agentes.timeline.useQuery(undefined, {
    enabled: isNoah,
    refetchInterval: 15000,
  });
  const reportsQuery = trpc.agentes.reports.useQuery(undefined, { enabled: isNoah });
  const scoresQuery = trpc.agentes.performanceScores.useQuery(undefined, { enabled: isNoah });

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "system", content: `Você é o agente ${slug} da CK Distribuidora. Responda com foco operacional.` },
  ]);
  const chatMutation = trpc.agent.chat.useMutation({
    onSuccess: (response) => {
      setChatMessages(prev => [...prev, { role: "assistant", content: response.reply }]);
    },
    onError: () => toast.error("Não foi possível enviar a mensagem."),
  });

  function handleSend() {
    const text = commandInput.trim();
    if (!text || chatMutation.isPending) return;
    const next: ChatMessage[] = [...chatMessages, { role: "user", content: text }];
    setChatMessages(next);
    chatMutation.mutate({ messages: next });
    setCommandInput("");
  }

  function handleGeneralOrder() {
    const text = generalOrder.trim();
    if (!text) return;
    toast.success("Ordem distribuída para os agentes relevantes");
    setGeneralOrder("");
  }

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const activeSection = `agente-${slug}` as string;
  const teamStatus = teamStatusQuery.data ?? [];
  const visibleChat = chatMessages.filter(m => m.role !== "system");

  if (isLoading) {
    return (
      <DashboardLayout activeSection={activeSection}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!agent) {
    return (
      <DashboardLayout activeSection="agentes">
        <div className="text-center py-20 text-muted-foreground">Agente não encontrado.</div>
      </DashboardLayout>
    );
  }

  // ────── Agente normal (não-Noah) ──────
  if (!isNoah) {
    return (
      <DashboardLayout activeSection={activeSection}>
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setLocation("/agentes")} className="rounded-lg p-2 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-4xl">{agent.avatarEmoji}</span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">{agent.name}</h1>
              <p className="text-sm text-muted-foreground">{agent.role}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <motion.span className="h-3 w-3 rounded-full bg-emerald-500" animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 2 }} />
              <span className="text-sm text-emerald-400 font-medium">Ativo</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4">
              <Card className="border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Resumo</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div><span className="text-xs text-muted-foreground">Tarefas hoje</span><div className="text-lg font-bold text-foreground">{agent.tasks.length}</div></div>
                  <div><span className="text-xs text-muted-foreground">Alertas ativos</span><div className="text-lg font-bold text-foreground">{agent.alerts.length}</div></div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /> Alertas</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {agent.alerts.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum alerta.</p> : agent.alerts.map((a: any) => {
                    const lv = ALERT_LEVEL[a.level] ?? ALERT_LEVEL.info;
                    return <div key={a.id} className={`rounded-lg ${lv.bg} p-3`}><span className={`text-xs font-medium ${lv.color} uppercase`}>{lv.label}</span> <span className={`text-sm ${lv.color}`}>{a.title}</span>{a.message && <p className="text-xs text-muted-foreground mt-1">{a.message}</p>}</div>;
                  })}
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Tarefas</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {agent.tasks.map((t: any) => { const st = TASK_STATUS_MAP[t.status] ?? TASK_STATUS_MAP.pending; return <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border/20 p-2.5"><span>{st.icon}</span><span className="flex-1 text-sm text-foreground">{t.title}</span><span className={`text-xs ${st.color}`}>{st.label}</span></div>; })}
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <Card className="border-border/50 h-full flex flex-col" style={{ background: "#070B1A" }}>
                <CardHeader className="pb-2 border-b border-border/30"><CardTitle className="text-sm flex items-center gap-2"><Terminal className="h-4 w-4 text-primary" /> Chat — {agent.name}</CardTitle></CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4" style={{ maxHeight: "500px", fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
                  {(agent.logs ?? []).map((log: any) => <div key={log.id} className="mb-2 flex items-start gap-2 text-sm"><span className="text-muted-foreground/50">[{log.time}]</span><span>{log.type === "alert" ? "⚠️" : log.type === "task" ? "✅" : "📊"}</span><span style={{ color: "#cbd5e1" }}>{log.content}</span></div>)}
                  {visibleChat.map((msg, i) => <div key={`c-${i}`} className="mb-2 flex items-start gap-2 text-sm"><span className="text-muted-foreground/50">[{new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}]</span><span>{msg.role === "user" ? "💬" : agent.avatarEmoji}</span><span style={{ color: msg.role === "user" ? "#D4AF37" : "#a5f3fc" }}>{msg.role === "user" ? `Você: ${msg.content}` : `${agent.name}: ${msg.content}`}</span></div>)}
                  {chatMutation.isPending && <div className="mb-2 flex items-start gap-2 text-sm text-muted-foreground"><span>[...]</span><span>⏳</span><span>{agent.name} está pensando...</span></div>}
                  <div ref={logEndRef} />
                </CardContent>
                <div className="flex items-center gap-3 border-t border-border/30 px-4 py-3" style={{ background: "#0E1223" }}>
                  <Zap className="h-4 w-4 text-primary shrink-0" />
                  <input type="text" value={commandInput} onChange={e => setCommandInput(e.target.value)} placeholder={`Mensagem para ${agent.name}...`} className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500" style={{ color: "#f1f5f9" }} disabled={chatMutation.isPending} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
                  <button onClick={handleSend} disabled={chatMutation.isPending || !commandInput.trim()} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-40" style={{ background: "#D4AF37", color: "#020617" }}><Send className="h-3.5 w-3.5" /></button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ────── PAINEL CEO NOAH ──────
  return (
    <DashboardLayout activeSection={activeSection}>
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => setLocation("/agentes")} className="rounded-lg p-2 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"><ArrowLeft className="h-5 w-5" /></button>
          <span className="text-4xl">🦾</span>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Noah — Painel CEO</h1>
            <p className="text-sm text-muted-foreground">Controle total sobre todos os agentes</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <motion.span className="h-3 w-3 rounded-full bg-emerald-500" animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 2 }} />
            <span className="text-sm text-emerald-400 font-medium">Ativo</span>
          </div>
        </div>

        {/* Dar ordem geral */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Dar ordem geral</span>
            </div>
            <div className="flex gap-2">
              <textarea
                value={generalOrder}
                onChange={e => setGeneralOrder(e.target.value)}
                placeholder="Ex: Quero relatório completo de hoje de todos os agentes..."
                className="flex-1 rounded-lg border border-border/50 bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
                rows={2}
              />
              <button onClick={handleGeneralOrder} disabled={!generalOrder.trim()} className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40" style={{ background: "#D4AF37", color: "#020617" }}>
                <Send className="h-4 w-4" />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Visão do Time + Score */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> Status do Time</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {teamStatus.map((ts: any) => (
                  <div key={ts.slug} className="rounded-lg border border-border/30 bg-card/50 p-2.5 text-center group relative">
                    <span className="text-xl">{ts.emoji}</span>
                    <div className="text-xs font-medium text-foreground mt-1">{ts.name}</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <span className={`h-2 w-2 rounded-full ${ts.status === "ok" ? "bg-emerald-500" : ts.status === "warning" ? "bg-amber-500" : "bg-red-500"}`} />
                      <span className={`text-[10px] ${ts.status === "ok" ? "text-emerald-400" : ts.status === "warning" ? "text-amber-400" : "text-red-400"}`}>
                        {ts.status === "ok" ? "OK" : ts.status === "warning" ? "Aviso" : "Crítico"}
                      </span>
                    </div>
                    {/* Controles */}
                    <div className="flex gap-0.5 mt-2 justify-center">
                      <button className="rounded p-0.5 text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 transition-colors" title="Pausar"><Pause className="h-3 w-3" /></button>
                      <button className="rounded p-0.5 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Reativar"><Play className="h-3 w-3" /></button>
                      <button className="rounded p-0.5 text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Reiniciar"><RefreshCw className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/20 bg-emerald-500/5 flex items-center justify-center min-w-[140px]">
            <CardContent className="p-6 text-center">
              <div className="text-5xl font-bold text-emerald-400">78</div>
              <div className="text-xs text-muted-foreground mt-1">Score Geral</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs do Noah */}
        <div className="flex gap-2 border-b border-border/30">
          {([
            { key: "timeline", label: "Timeline", icon: "⚡" },
            { key: "tasks", label: "Trabalhos", icon: "📋" },
            { key: "reports", label: "Relatórios", icon: "📄" },
            { key: "scores", label: "Performance", icon: "🏆" },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setNoahTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                noahTab === tab.key ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB: Timeline ── */}
        {noahTab === "timeline" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
            <Card className="border-border/50" style={{ background: "#070B1A" }}>
              <CardHeader className="pb-2 border-b border-border/30">
                <CardTitle className="text-sm flex items-center gap-2"><Terminal className="h-4 w-4 text-primary" /> Timeline Unificada</CardTitle>
              </CardHeader>
              <CardContent className="overflow-y-auto p-4" style={{ maxHeight: "500px" }}>
                {(timelineQuery.data ?? []).map((ev: any) => (
                  <div key={ev.id} className={`mb-2 rounded-lg p-2.5 border transition-colors ${
                    ev.highlight === "critical" ? "border-red-500/30 bg-red-500/5" :
                    ev.highlight === "success" ? "border-emerald-500/30 bg-emerald-500/5" :
                    ev.highlight === "gold" ? "border-primary/30 bg-primary/5" :
                    "border-transparent"
                  }`}>
                    <div className="flex items-start gap-2 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      <span className="text-muted-foreground/50 text-xs shrink-0">{new Date(ev.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span>{ev.agentEmoji}</span>
                      <span style={{ color: "#cbd5e1" }}><span className="font-medium text-foreground">{ev.agentName}</span>: {ev.content}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            {/* Chat lateral */}
            <Card className="border-border/50 flex flex-col" style={{ background: "#070B1A" }}>
              <CardHeader className="pb-2 border-b border-border/30"><CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4 text-primary" /> Chat com Noah</CardTitle></CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-3" style={{ maxHeight: "380px", fontFamily: "'JetBrains Mono', monospace" }}>
                {visibleChat.map((msg, i) => <div key={i} className="mb-2 text-sm"><span style={{ color: msg.role === "user" ? "#D4AF37" : "#a5f3fc" }}>{msg.role === "user" ? "Você" : "Noah"}: {msg.content}</span></div>)}
                {chatMutation.isPending && <div className="text-sm text-muted-foreground">⏳ Noah está pensando...</div>}
                <div ref={logEndRef} />
              </CardContent>
              <div className="flex items-center gap-2 border-t border-border/30 px-3 py-2" style={{ background: "#0E1223" }}>
                <input type="text" value={commandInput} onChange={e => setCommandInput(e.target.value)} placeholder="Mensagem..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500" style={{ color: "#f1f5f9" }} disabled={chatMutation.isPending} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }} />
                <button onClick={handleSend} disabled={chatMutation.isPending || !commandInput.trim()} className="flex h-7 w-7 items-center justify-center rounded-lg disabled:opacity-40" style={{ background: "#D4AF37", color: "#020617" }}><Send className="h-3 w-3" /></button>
              </div>
            </Card>
          </div>
        )}

        {/* ── TAB: Trabalhos em Andamento ── */}
        {noahTab === "tasks" && (
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm">Trabalhos de Todos os Agentes</CardTitle>
                <div className="flex gap-1">
                  {[
                    { value: "", label: "Todos" },
                    { value: "pending", label: "🟡 Pendente" },
                    { value: "running", label: "🔄 Executando" },
                    { value: "done", label: "✅ Entregue" },
                    { value: "overdue", label: "🔴 Atrasado" },
                  ].map(f => (
                    <button key={f.value} onClick={() => setTaskFilter(f.value)} className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${taskFilter === f.value ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>{f.label}</button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="text-left py-2.5 pl-4 pr-2 font-medium">Agente</th>
                      <th className="text-left py-2.5 px-2 font-medium">Tarefa</th>
                      <th className="text-left py-2.5 px-2 font-medium">Status</th>
                      <th className="text-left py-2.5 px-2 font-medium">Prazo</th>
                      <th className="text-right py-2.5 pl-2 pr-4 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(allTasksQuery.data ?? []).map((task: any) => {
                      const st = TASK_STATUS_MAP[task.status] ?? TASK_STATUS_MAP.pending;
                      return (
                        <tr key={task.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                          <td className="py-3 pl-4 pr-2">
                            <span className="text-base mr-1">{task.agentEmoji}</span>
                            <span className="text-sm font-medium text-foreground">{task.agentName}</span>
                          </td>
                          <td className="py-3 px-2 text-foreground">{task.title}</td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${st.color}`}>{st.icon} {st.label}</span>
                          </td>
                          <td className="py-3 px-2 text-xs text-muted-foreground">{timeAgo(task.requestedAt)}</td>
                          <td className="py-3 pl-2 pr-4 text-right">
                            <div className="flex gap-1 justify-end">
                              {task.result && <button className="rounded px-2 py-1 text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors" onClick={() => toast.info(task.result)}>Ver</button>}
                              <button className="rounded px-2 py-1 text-[10px] font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">Reexecutar</button>
                              {task.status !== "done" && task.status !== "cancelled" && <button className="rounded px-2 py-1 text-[10px] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">Cancelar</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── TAB: Relatórios ── */}
        {noahTab === "reports" && (
          <div className="space-y-3">
            {(reportsQuery.data ?? []).map((report: any) => (
              <Card key={report.id} className={`border-border/50 ${!report.isRead ? "ring-1 ring-primary/20" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{report.agentEmoji}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{report.title}</span>
                          {!report.isRead && <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Não lido</span>}
                          {report.isRead && <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Lido</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{report.agentName} &middot; {timeAgo(report.createdAt)}</div>
                      </div>
                    </div>
                    <button onClick={() => setReportModal(report)} className="rounded-lg border border-border/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/30 transition-colors flex items-center gap-1">
                      <Eye className="h-3 w-3" /> Ver completo
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-2 whitespace-pre-line">{report.content.split("\n").slice(0, 2).join("\n")}</p>
                </CardContent>
              </Card>
            ))}

            {/* Modal relatório */}
            {reportModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setReportModal(null)}>
                <div className="w-full max-w-2xl rounded-2xl border border-border/50 bg-card p-6 shadow-xl mx-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{reportModal.agentEmoji}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{reportModal.title}</h3>
                        <p className="text-xs text-muted-foreground">{reportModal.agentName} &middot; {new Date(reportModal.createdAt).toLocaleString("pt-BR")}</p>
                      </div>
                    </div>
                    <button onClick={() => setReportModal(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted/30"><X className="h-5 w-5" /></button>
                  </div>
                  <div className="rounded-lg bg-muted/20 p-4 whitespace-pre-line text-sm text-foreground leading-relaxed">{reportModal.content}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Performance ── */}
        {noahTab === "scores" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {(scoresQuery.data ?? []).map((ag: any) => {
              const scoreColor = ag.score >= 70 ? "text-emerald-400" : ag.score >= 40 ? "text-amber-400" : "text-red-400";
              const barColor = ag.score >= 70 ? "bg-emerald-500" : ag.score >= 40 ? "bg-amber-500" : "bg-red-500";
              return (
                <Card key={ag.slug} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{ag.emoji}</span>
                        <div>
                          <div className="text-sm font-medium text-foreground">{ag.name}</div>
                          <div className="text-[10px] text-muted-foreground">#{ag.rank} no ranking</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${scoreColor}`}>{ag.score}</div>
                        <div className={`text-[10px] ${ag.variation >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {ag.variation >= 0 ? "+" : ""}{ag.variation} pts
                        </div>
                      </div>
                    </div>
                    {/* Barra de score */}
                    <div className="h-1.5 rounded-full bg-muted/30 mb-3">
                      <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${ag.score}%` }} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-xs font-bold text-foreground">{ag.completionRate}%</div>
                        <div className="text-[10px] text-muted-foreground">Conclusão</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">{ag.avgTime}</div>
                        <div className="text-[10px] text-muted-foreground">Tempo médio</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">{ag.alertsGenerated}</div>
                        <div className="text-[10px] text-muted-foreground">Alertas</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
