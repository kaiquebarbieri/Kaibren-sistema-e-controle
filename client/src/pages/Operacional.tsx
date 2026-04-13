import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import {
  Camera,
  CheckCircle2,
  Clock,
  ClipboardList,
  Loader2,
  Package,
  Send,
  Trophy,
  Warehouse,
  XCircle,
  Flame,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const statusConfig = {
  cumprido: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500", label: "Cumpriu" },
  pendente: { icon: Clock, color: "text-amber-400", bg: "bg-amber-500", label: "Pendente" },
  nao_cumprido: { icon: XCircle, color: "text-red-400", bg: "bg-red-500", label: "Não cumpriu" },
};

export default function Operacional() {
  const { user } = useAuth();
  const dashboardQuery = trpc.equipe.dashboard.useQuery(undefined, { refetchInterval: 30000 });
  const confirmMutation = trpc.equipe.confirmTask.useMutation({
    onSuccess: () => {
      toast.success("Dia confirmado!");
      dashboardQuery.refetch();
      setShowConfirm(false);
    },
    onError: (err) => toast.error(err.message),
  });

  // Contagem de estoque
  const itensQuery = trpc.estoque.itensParaContagem.useQuery();
  const contagemMutation = trpc.estoque.contagemFuncionario.useMutation({
    onSuccess: (data) => {
      toast.success(`Contagem #${data.countId} enviada! ${data.items} itens. Aguardando aprovação do Kaique.`);
      setShowContagem(false);
      setContagemItems([]);
    },
    onError: (err) => toast.error(err.message),
  });

  const [showContagem, setShowContagem] = useState(false);
  const [contagemItems, setContagemItems] = useState<{ sku: string; titulo: string; systemQty: number; countedQty: string }[]>([]);
  const [contagemSearch, setContagemSearch] = useState("");

  const initContagem = () => {
    const items = (itensQuery.data || []).map((i: any) => ({
      sku: i.sku,
      titulo: i.titulo || "",
      systemQty: i.quantity ?? 0,
      countedQty: String(i.quantity ?? 0),
    }));
    setContagemItems(items);
    setContagemSearch("");
    setShowContagem(true);
  };

  const submitContagem = () => {
    const items = contagemItems.map(i => ({ sku: i.sku, countedQty: parseInt(i.countedQty) || 0 }));
    contagemMutation.mutate({ items });
  };

  const filteredContagem = contagemItems.filter(i => {
    if (!contagemSearch.trim()) return true;
    const q = contagemSearch.toLowerCase();
    return i.sku.toLowerCase().includes(q) || i.titulo.toLowerCase().includes(q);
  });

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMemberId, setConfirmMemberId] = useState<number | null>(null);
  const [observation, setObservation] = useState("");

  const team = dashboardQuery.data ?? [];

  // Find the member that matches the logged user (by name match or first member for user role)
  const myMember = team.find((m: any) =>
    user?.name?.toLowerCase().includes(m.name.toLowerCase()) ||
    m.name.toLowerCase().includes(user?.name?.toLowerCase() ?? "")
  ) || (user?.role === "user" ? team[0] : null);

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const handleConfirm = (memberId: number) => {
    setConfirmMemberId(memberId);
    setObservation("");
    setShowConfirm(true);
  };

  const submitConfirm = (status: "cumprido" | "nao_cumprido") => {
    if (!confirmMemberId) return;
    confirmMutation.mutate({ memberId: confirmMemberId, status, observation: observation || undefined });
  };

  if (dashboardQuery.isLoading) {
    return (
      <DashboardLayout activeSection="operacional">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activeSection={user?.role === "user" ? "operacional" : "equipe"}>
      <div className="flex flex-col gap-4 sm:gap-6 max-w-3xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              Bom dia{myMember ? `, ${myMember.name.split(" ")[0]}` : ""} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{today}</p>
          </div>
        </motion.div>

        {/* Status do Dia */}
        {myMember && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                {/* Status header */}
                {(() => {
                  const todayStatus = myMember.today?.status ?? "pendente";
                  const cfg = statusConfig[todayStatus as keyof typeof statusConfig] ?? statusConfig.pendente;
                  const StatusIcon = cfg.icon;
                  return (
                    <div className={`flex items-center gap-3 p-4 ${cfg.bg}/10 border-b border-border/30`}>
                      <StatusIcon className={`h-6 w-6 ${cfg.color}`} />
                      <div>
                        <div className={`text-sm font-semibold ${cfg.color}`}>
                          {todayStatus === "cumprido" ? "Dia confirmado!" : todayStatus === "nao_cumprido" ? "Dia marcado como não cumprido" : "Dia pendente — confirme suas tarefas"}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Tarefas */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <ClipboardList className="h-4 w-4" />
                    Checklist do dia
                  </div>
                  {myMember.tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground/60">Sem tarefas definidas para hoje.</p>
                  ) : (
                    <ul className="space-y-2">
                      {myMember.tasks.map((task: any) => (
                        <li key={task.id} className="flex items-start gap-3 rounded-lg border border-border/30 p-3 bg-card/50">
                          <div className="mt-0.5 h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center shrink-0">
                            {myMember.today?.status === "cumprido" && (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            )}
                          </div>
                          <span className="text-sm text-foreground/80">{task.description}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Botão confirmar */}
                  {myMember.today?.status === "pendente" && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleConfirm(myMember.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Confirmar Dia
                      </Button>
                    </div>
                  )}
                </div>

                {/* Semana */}
                <div className="border-t border-border/30 p-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Últimos 7 dias</div>
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    {myMember.week.map((day: any, idx: number) => {
                      const dayCfg = statusConfig[day.status as keyof typeof statusConfig] ?? statusConfig.pendente;
                      const dayLabel = new Date(day.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3);
                      return (
                        <div key={idx} className="flex flex-col items-center gap-1.5">
                          <div className={`h-8 w-8 rounded-full ${dayCfg.bg}/20 flex items-center justify-center`}>
                            <div className={`h-3 w-3 rounded-full ${dayCfg.bg}`} />
                          </div>
                          <span className="text-[10px] text-muted-foreground font-medium">{dayLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Photo */}
                {myMember.today?.photoPath && (
                  <div className="border-t border-border/30 p-4">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Comprovante de hoje</div>
                    <img
                      src={`/uploads/equipe/${myMember.today.photoPath}`}
                      alt="Comprovante"
                      className="h-40 w-full rounded-lg object-cover border border-border/30"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Quick Stats */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-emerald-400">
                  {myMember?.week.filter((d: any) => d.status === "cumprido").length ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Cumpridos</div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-400">
                  {myMember?.week.filter((d: any) => d.status === "nao_cumprido").length ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Faltas</div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-amber-400">
                  {myMember?.week.filter((d: any) => d.status === "pendente").length ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Pendentes</div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Contagem de Estoque */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Warehouse className="h-5 w-5 text-blue-400" />
                  <div className="text-sm font-semibold text-foreground">Contagem de Estoque</div>
                </div>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={initContagem}
                  disabled={itensQuery.isLoading}>
                  {itensQuery.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ClipboardList className="h-4 w-4 mr-1" />}
                  Iniciar Contagem
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Conte os produtos e envie para o Kaique aprovar. A contagem não altera o estoque até ser aprovada.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Dica operacional */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-start gap-3">
              <Flame className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-foreground">Dica do dia</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Confirme suas tarefas o mais cedo possível. Quanto antes confirmar, melhor sua taxa de desempenho.
                  As cobranças automáticas são enviadas às 17h para quem não confirmou.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Modal de Contagem de Estoque */}
      {showContagem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowContagem(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border/50 rounded-xl p-6 w-[500px] max-w-[95vw] max-h-[85vh] flex flex-col space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-blue-400" />
              <h3 className="text-lg font-bold text-foreground">Contagem de Estoque</h3>
            </div>

            <p className="text-xs text-muted-foreground">
              Conte cada produto e ajuste a quantidade. Depois de enviar, o Kaique vai revisar e aprovar.
            </p>

            <Input
              placeholder="Buscar SKU ou nome..."
              value={contagemSearch}
              onChange={(e) => setContagemSearch(e.target.value)}
              className="bg-zinc-900/60 border-zinc-800"
            />

            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-[400px]">
              {filteredContagem.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {contagemItems.length === 0 ? "Nenhum produto no estoque ainda." : "Nenhum resultado para a busca."}
                </p>
              ) : (
                filteredContagem.map((item) => {
                  const realIdx = contagemItems.findIndex(i => i.sku === item.sku);
                  const diff = (parseInt(item.countedQty) || 0) - item.systemQty;
                  return (
                    <div key={item.sku} className="flex items-center gap-3 bg-zinc-900/60 rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs text-primary">{item.sku}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{item.titulo || "Sem nome"}</div>
                      </div>
                      <div className="text-[10px] text-muted-foreground text-right w-12">
                        Sist: {item.systemQty}
                      </div>
                      <Input
                        type="number"
                        value={item.countedQty}
                        onChange={(e) => {
                          const updated = [...contagemItems];
                          updated[realIdx] = { ...updated[realIdx], countedQty: e.target.value };
                          setContagemItems(updated);
                        }}
                        className="w-20 text-center text-sm"
                      />
                      {diff !== 0 && (
                        <span className={`text-xs font-bold min-w-[40px] text-right ${diff > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={contagemMutation.isPending || contagemItems.length === 0}
                onClick={submitContagem}
              >
                {contagemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar Contagem
              </Button>
              <Button variant="ghost" className="text-muted-foreground" onClick={() => setShowContagem(false)}>
                Cancelar
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de confirmação */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowConfirm(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border/50 rounded-xl p-6 w-[400px] max-w-[95vw] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-foreground">Confirmar dia</h3>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Observação (opcional)</label>
              <textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                rows={3}
                className="mt-1 flex w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
                placeholder="Alguma observação sobre o dia..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={confirmMutation.isPending}
                onClick={() => submitConfirm("cumprido")}
              >
                {confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Cumpri tudo
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-red-800 text-red-400 hover:bg-red-500/10"
                disabled={confirmMutation.isPending}
                onClick={() => submitConfirm("nao_cumprido")}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Não cumpri
              </Button>
            </div>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setShowConfirm(false)}>
              Cancelar
            </Button>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  );
}
