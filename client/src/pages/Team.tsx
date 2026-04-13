import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Flame,
  Loader2,
  MessageCircle,
  Phone,
  Send,
  Smartphone,
  TrendingUp,
  Trophy,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const statusConfig = {
  cumprido: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500", label: "Cumpriu" },
  pendente: { icon: Clock, color: "text-amber-400", bg: "bg-amber-500", label: "Pendente" },
  nao_cumprido: { icon: XCircle, color: "text-red-400", bg: "bg-red-500", label: "Não cumpriu" },
};

function PerformancePanel({ memberId }: { memberId: number }) {
  const perfQuery = trpc.equipe.performance.useQuery({ memberId, days: 30 }, { enabled: memberId > 0 });
  const perf = perfQuery.data;

  if (!perf) return null;

  const taxaColor = perf.taxa >= 80 ? "text-emerald-400" : perf.taxa >= 50 ? "text-amber-400" : "text-red-400";

  return (
    <div className="border-t border-border/30 p-4 space-y-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5" />
        Desempenho (30 dias)
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div className="text-center">
          <div className={`text-lg font-bold ${taxaColor}`}>{perf.taxa}%</div>
          <div className="text-[9px] text-muted-foreground uppercase">Taxa</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-emerald-400">{perf.cumpridos}</div>
          <div className="text-[9px] text-muted-foreground uppercase">OK</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-red-400">{perf.naoCumpridos}</div>
          <div className="text-[9px] text-muted-foreground uppercase">Faltas</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-amber-400">{perf.streak}</div>
          <div className="text-[9px] text-muted-foreground uppercase flex items-center justify-center gap-0.5">
            <Flame className="h-3 w-3" /> Streak
          </div>
        </div>
      </div>
      {perf.chargesCount > 0 && (
        <div className="text-[10px] text-muted-foreground/60">
          {perf.chargesCount} cobranças enviadas no período
        </div>
      )}
    </div>
  );
}

export default function Team() {
  const dashboardQuery = trpc.equipe.dashboard.useQuery(undefined, { refetchInterval: 60000 });
  const createMutation = trpc.equipe.create.useMutation({
    onSuccess: () => { dashboardQuery.refetch(); setShowCreate(false); resetForm(); toast.success("Funcionário adicionado!"); },
    onError: (err) => toast.error(err.message),
  });
  const confirmMutation = trpc.equipe.confirmTask.useMutation({
    onSuccess: () => { dashboardQuery.refetch(); setConfirmingId(null); toast.success("Dia confirmado!"); },
    onError: (err) => toast.error(err.message),
  });
  const chargeMutation = trpc.equipe.charge.useMutation({
    onSuccess: (data) => { toast.success(data.message); },
    onError: (err) => toast.error(err.message),
  });
  const chargeAllMutation = trpc.equipe.chargeAll.useMutation({
    onSuccess: (data) => { toast.success(`${data.charged} cobranças enviadas`); },
    onError: (err) => toast.error(err.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWhatsapp, setNewWhatsapp] = useState("");
  const [newTasks, setNewTasks] = useState("");
  const [newWhatsappOnly, setNewWhatsappOnly] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [confirmObs, setConfirmObs] = useState("");
  const [expandedPerf, setExpandedPerf] = useState<number | null>(null);

  const team = dashboardQuery.data ?? [];

  const resetForm = () => { setNewName(""); setNewWhatsapp(""); setNewTasks(""); setNewWhatsappOnly(false); };

  const handleCreate = () => {
    if (!newName.trim() || !newWhatsapp.trim()) return;
    createMutation.mutate({
      name: newName.trim(),
      whatsapp: newWhatsapp.trim(),
      usesWhatsappOnly: newWhatsappOnly ? 1 : 0,
      tasks: newTasks.split("\n").map(t => t.trim()).filter(Boolean),
    });
  };

  return (
    <DashboardLayout activeSection="equipe">
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Equipe</h1>
            <p className="text-sm text-muted-foreground">Controle diário e desempenho da equipe</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="border-border/50"
              onClick={() => chargeAllMutation.mutate()}
              disabled={chargeAllMutation.isPending}
            >
              {chargeAllMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Cobrar Todos
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-border/50"
              onClick={() => window.location.href = "/operacional"}
            >
              <Eye className="h-4 w-4 mr-1" /> Ver como Funcionário
            </Button>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-[#B8941F]">
                  <UserPlus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border/50">
                <DialogHeader>
                  <DialogTitle>Adicionar Funcionário</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Nome</label>
                    <input
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      className="mt-1 flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
                      placeholder="Nome do funcionário"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">WhatsApp</label>
                    <input
                      value={newWhatsapp}
                      onChange={e => setNewWhatsapp(e.target.value)}
                      className="mt-1 flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
                      placeholder="5511999999999"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newWhatsappOnly}
                      onChange={e => setNewWhatsappOnly(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <label className="text-sm text-muted-foreground">Controle apenas via WhatsApp (não usa computador)</label>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Tarefas diárias (uma por linha)</label>
                    <textarea
                      value={newTasks}
                      onChange={e => setNewTasks(e.target.value)}
                      rows={4}
                      className="mt-1 flex w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
                      placeholder={"Limpeza do estoque\nConferência de mercadorias\nOrganização de pedidos"}
                    />
                  </div>
                  <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full bg-primary text-primary-foreground hover:bg-[#B8941F]">
                    {createMutation.isPending ? "Salvando..." : "Salvar Funcionário"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats overview */}
        {team.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{team.length}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Funcionários</div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-emerald-400">
                  {team.filter((m: any) => m.today?.status === "cumprido").length}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Confirmados hoje</div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-amber-400">
                  {team.filter((m: any) => !m.today?.status || m.today?.status === "pendente").length}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Pendentes hoje</div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-400">
                  {team.filter((m: any) => m.today?.status === "nao_cumprido").length}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Não cumpriram</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Team cards */}
        {dashboardQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : team.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="p-8 text-center">
              <UserPlus className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">Nenhum funcionário cadastrado.</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Clique em "Adicionar" para começar.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((member: any, i: number) => {
              const todayStatus = member.today?.status ?? "pendente";
              const cfg = statusConfig[todayStatus as keyof typeof statusConfig] ?? statusConfig.pendente;
              const StatusIcon = cfg.icon;
              const isExpanded = expandedPerf === member.id;

              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                >
                  <Card className="border-border/50 overflow-hidden">
                    <CardContent className="p-0">
                      {/* Header */}
                      <div className="flex items-center justify-between p-4 border-b border-border/30">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${cfg.bg}/10`}>
                            <StatusIcon className={`h-5 w-5 ${cfg.color}`} />
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{member.name}</div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {member.whatsapp}
                            </div>
                          </div>
                        </div>
                        <div className={`rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg}/10 ${cfg.color}`}>
                          {cfg.label}
                        </div>
                      </div>

                      {/* WhatsApp only badge */}
                      {member.usesWhatsappOnly === 1 && (
                        <div className="mx-4 mt-3 flex items-center gap-1.5 rounded-md bg-blue-500/10 border border-blue-500/20 px-2.5 py-1.5 text-xs text-blue-400">
                          <Smartphone className="h-3.5 w-3.5" />
                          Controle via WhatsApp
                        </div>
                      )}

                      {/* Tasks */}
                      <div className="p-4 space-y-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tarefas</span>
                        {member.tasks.length === 0 ? (
                          <p className="text-xs text-muted-foreground/60">Sem tarefas definidas</p>
                        ) : (
                          <ul className="space-y-1">
                            {member.tasks.map((task: any) => (
                              <li key={task.id} className="flex items-start gap-2 text-sm text-foreground/80">
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                                {task.description}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Photo */}
                      {member.today?.photoPath && (
                        <div className="px-4 pb-3">
                          <img
                            src={`/uploads/equipe/${member.today.photoPath}`}
                            alt="Comprovante"
                            className="h-32 w-full rounded-lg object-cover border border-border/30"
                          />
                        </div>
                      )}

                      {/* Week history */}
                      <div className="border-t border-border/30 p-4">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Últimos 7 dias</span>
                        <div className="mt-2 flex items-center gap-1.5">
                          {member.week.map((day: any, idx: number) => {
                            const dayCfg = statusConfig[day.status as keyof typeof statusConfig] ?? statusConfig.pendente;
                            const dayLabel = new Date(day.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3);
                            return (
                              <div key={idx} className="flex flex-col items-center gap-1">
                                <div className={`h-3 w-3 rounded-full ${dayCfg.bg}`} title={`${dayLabel}: ${dayCfg.label}`} />
                                <span className="text-[9px] text-muted-foreground">{dayLabel}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Performance panel */}
                      {isExpanded && <PerformancePanel memberId={member.id} />}

                      {/* Actions */}
                      <div className="border-t border-border/30 p-3 flex items-center gap-2 flex-wrap">
                        {todayStatus === "pendente" && (
                          <>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                              onClick={() => { setConfirmingId(member.id); setConfirmObs(""); }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirmar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-amber-700 text-amber-400 hover:bg-amber-500/10 text-xs"
                              onClick={() => chargeMutation.mutate({ memberId: member.id })}
                              disabled={chargeMutation.isPending}
                            >
                              {chargeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                              Cobrar
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-muted-foreground ml-auto"
                          onClick={() => setExpandedPerf(isExpanded ? null : member.id)}
                        >
                          <BarChart3 className="h-3.5 w-3.5 mr-1" />
                          {isExpanded ? "Fechar" : "Desempenho"}
                          {isExpanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {confirmingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setConfirmingId(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border/50 rounded-xl p-6 w-[400px] max-w-[95vw] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-foreground">
              Confirmar dia — {team.find((m: any) => m.id === confirmingId)?.name}
            </h3>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Observação (opcional)</label>
              <textarea
                value={confirmObs}
                onChange={(e) => setConfirmObs(e.target.value)}
                rows={3}
                className="mt-1 flex w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
                placeholder="Alguma observação..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate({ memberId: confirmingId, status: "cumprido", observation: confirmObs || undefined })}
              >
                {confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Cumpriu
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-red-800 text-red-400 hover:bg-red-500/10"
                disabled={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate({ memberId: confirmingId, status: "nao_cumprido", observation: confirmObs || undefined })}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Não cumpriu
              </Button>
            </div>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setConfirmingId(null)}>
              Cancelar
            </Button>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  );
}
