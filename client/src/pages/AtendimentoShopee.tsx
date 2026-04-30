import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  TriangleAlert,
  User,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type FilterTab = "all" | "open" | "escalated" | "shadow" | "answered";

const FILTER_LABELS: Record<FilterTab, string> = {
  all: "Todas",
  open: "Aguardando",
  escalated: "Escalada / Shadow",
  shadow: "Sugestão IA",
  answered: "Respondidas",
};

const AGENT_SOURCE_LABEL: Record<string, { label: string; color: string }> = {
  ai_auto: { label: "IA · auto", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  ai_shadow: { label: "IA · shadow", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  kaique_refined: { label: "Kaique · refinado", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  kaique_raw: { label: "Kaique · cru", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
};

function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function AtendimentoShopee() {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [refineEnabled, setRefineEnabled] = useState(true);
  const [kbDialogOpen, setKbDialogOpen] = useState(false);
  const [kbType, setKbType] = useState<"regra_geral" | "tom_voz" | "produto" | "aprendizado">("regra_geral");
  const [kbEditing, setKbEditing] = useState<{ id?: number; title: string; body: string; scope?: string } | null>(null);

  const kpisQuery = trpc.shopeeChat.kpis.useQuery(undefined, { refetchInterval: 30000 });
  const listQuery = trpc.shopeeChat.list.useQuery({ filter, search, limit: 80 }, { refetchInterval: 30000 });
  const detailQuery = trpc.shopeeChat.detail.useQuery({ conversationId: selected || "" }, { enabled: !!selected, refetchInterval: 15000 });
  const kbListQuery = trpc.shopeeChat.kb.list.useQuery({ type: kbType });

  const runMutation = trpc.shopeeChat.runSyncAndRespond.useMutation({
    onSuccess: (r) => {
      toast.success(`Sync OK · ${r.sync.newMessages} novas · auto ${r.resp.autoReplied} · shadow ${r.resp.shadowed} · esc ${r.resp.escalated}`);
      kpisQuery.refetch();
      listQuery.refetch();
      detailQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const curatorMutation = trpc.shopeeChat.runCurator.useMutation({
    onSuccess: (r) => {
      toast.success(`Curator: ${r.toneSamples} amostras · ${r.productsIndexed} produtos · ${r.rulesInserted} novas regras`);
      kbListQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const replyMutation = trpc.shopeeChat.reply.useMutation({
    onSuccess: (r) => {
      toast.success("Enviado: " + r.sent.slice(0, 80));
      setReplyText("");
      detailQuery.refetch();
      listQuery.refetch();
      kpisQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const kbUpsert = trpc.shopeeChat.kb.upsert.useMutation({
    onSuccess: () => { toast.success("KB atualizada"); kbListQuery.refetch(); setKbEditing(null); },
    onError: (e) => toast.error(e.message),
  });

  const kbDelete = trpc.shopeeChat.kb.delete.useMutation({
    onSuccess: () => { toast.success("Removido"); kbListQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const conversations = listQuery.data || [];
  const detail = detailQuery.data;

  const handleSend = () => {
    if (!selected || !replyText.trim()) return;
    replyMutation.mutate({ conversationId: selected, text: replyText, refine: refineEnabled });
  };

  const k = kpisQuery.data;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Atendimento Shopee · Sam Chat</h1>
              <p className="text-sm text-muted-foreground">Agente IA responde perguntas de clientes na Shopee — escala via Telegram quando tem dúvida.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setKbDialogOpen(true)}>
              <Brain className="w-4 h-4 mr-2" /> Editar KB
            </Button>
            <Button variant="outline" onClick={() => curatorMutation.mutate()} disabled={curatorMutation.isPending}>
              {curatorMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Rodar Curator
            </Button>
            <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
              {runMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Sync agora
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Msgs hoje</div>
                <div className="text-2xl font-semibold text-foreground mt-1">{k?.today.total ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-1">auto {k?.today.auto ?? 0} · kaique {k?.today.kaique ?? 0} · shadow {k?.today.shadow ?? 0}</div>
              </div>
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Tempo médio</div>
                <div className="text-2xl font-semibold text-foreground mt-1">{k?.avgResponseMinutes ?? 0} min</div>
                <div className="text-xs text-muted-foreground mt-1">resposta nos últimos 7d</div>
              </div>
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Escaladas abertas</div>
                <div className="text-2xl font-semibold text-foreground mt-1">{k?.escalationsOpen ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-1">aguardando você no Telegram</div>
              </div>
              <TriangleAlert className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Modo</div>
                <div className="text-2xl font-semibold text-foreground mt-1">{k?.autoSendEnabled ? "Auto-reply" : "Shadow"}</div>
                <div className="text-xs text-muted-foreground mt-1">{k?.autoSendEnabled ? "envia direto pro cliente" : "rascunho via Telegram"}</div>
              </div>
              {k?.autoSendEnabled ? <Zap className="w-8 h-8 text-emerald-400" /> : <Bot className="w-8 h-8 text-blue-400" />}
            </div>
          </CardContent></Card>
        </div>

        {/* Filtros + busca */}
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)}>
            <TabsList>
              {(Object.keys(FILTER_LABELS) as FilterTab[]).map((f) => (
                <TabsTrigger key={f} value={f}>{FILTER_LABELS[f]}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Input
            placeholder="Buscar cliente ou texto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
        </div>

        {/* Lista + Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4">
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[70vh] overflow-y-auto divide-y divide-border">
                {listQuery.isLoading ? (
                  <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
                ) : conversations.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Nenhuma conversa.</div>
                ) : (
                  conversations.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelected(c.conversationId); setReplyText(""); }}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/40 transition ${selected === c.conversationId ? "bg-muted/60" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium text-foreground truncate">{c.buyerName || c.buyerId}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {c.status === "open" && <Badge variant="outline" className="bg-blue-500/15 text-blue-300 border-blue-500/30">Aguardando</Badge>}
                          {c.status === "escalated" && c.agentLastAction === "shadow_drafted" && <Badge variant="outline" className="bg-blue-500/15 text-blue-300 border-blue-500/30">Sugestão IA</Badge>}
                          {c.status === "escalated" && c.agentLastAction === "escalated" && <Badge variant="outline" className="bg-amber-500/15 text-amber-300 border-amber-500/30">Escalada</Badge>}
                          {c.status === "answered" && <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Respondida</Badge>}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 truncate">{c.latestMessageText}</div>
                      <div className="text-[10px] text-muted-foreground/70 mt-1">{fmtDateTime(c.latestMessageAt)}</div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {!selected ? (
                <div className="p-12 text-center text-muted-foreground">Selecione uma conversa.</div>
              ) : detailQuery.isLoading ? (
                <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
              ) : !detail?.conversation ? (
                <div className="p-8 text-center text-muted-foreground">Conversa não encontrada.</div>
              ) : (
                <div className="flex flex-col h-[70vh]">
                  <div className="border-b border-border px-4 py-3">
                    <div className="text-sm font-semibold text-foreground">{detail.conversation.buyerName || detail.conversation.buyerId}</div>
                    <div className="text-xs text-muted-foreground">conv {detail.conversation.conversationId}</div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {detail.messages.map((m: any) => {
                      const isAgent = m.fromRole === "agent" || m.fromRole === "seller";
                      const sourceLabel = m.agentSource ? AGENT_SOURCE_LABEL[m.agentSource] : null;
                      return (
                        <div key={m.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${isAgent ? "bg-primary/20 border border-primary/30" : "bg-muted"}`}>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-2">
                              <span>{m.fromRole}</span>
                              {sourceLabel && <Badge variant="outline" className={`text-[9px] px-1 py-0 ${sourceLabel.color}`}>{sourceLabel.label}{m.agentConfidence != null ? ` · ${m.agentConfidence}%` : ""}</Badge>}
                              <span className="ml-auto text-muted-foreground/70">{fmtDateTime(m.sentAt)}</span>
                            </div>
                            <div className="text-foreground whitespace-pre-wrap">{m.content}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-border p-3 space-y-2">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Sua resposta (será refinada antes de enviar)..."
                      rows={3}
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" checked={refineEnabled} onChange={(e) => setRefineEnabled(e.target.checked)} />
                        Refinar com IA antes de enviar
                      </label>
                      <Button onClick={handleSend} disabled={!replyText.trim() || replyMutation.isPending}>
                        {replyMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                        Enviar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog KB */}
      <Dialog open={kbDialogOpen} onOpenChange={setKbDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Knowledge base — Sam Chat</DialogTitle>
          </DialogHeader>
          <Tabs value={kbType} onValueChange={(v) => setKbType(v as any)}>
            <TabsList>
              <TabsTrigger value="regra_geral">Regras gerais</TabsTrigger>
              <TabsTrigger value="tom_voz">Tom de voz</TabsTrigger>
              <TabsTrigger value="produto">Produtos</TabsTrigger>
              <TabsTrigger value="aprendizado">Aprendizados</TabsTrigger>
            </TabsList>
            <TabsContent value={kbType} className="mt-3">
              <div className="space-y-2">
                <Button size="sm" onClick={() => setKbEditing({ title: "", body: "" })}>Nova entrada</Button>
                <div className="max-h-[50vh] overflow-y-auto space-y-2">
                  {(kbListQuery.data || []).map((kb: any) => (
                    <Card key={kb.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm text-foreground">{kb.title}</div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{kb.source}</Badge>
                            <Button size="sm" variant="outline" onClick={() => setKbEditing({ id: kb.id, title: kb.title, body: kb.body, scope: kb.scope || undefined })}>Editar</Button>
                            <Button size="sm" variant="outline" onClick={() => kbDelete.mutate({ id: kb.id })}>Remover</Button>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap line-clamp-4">{kb.body}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
          {kbEditing && (
            <div className="space-y-2 border-t border-border pt-3 mt-3">
              <Input value={kbEditing.title} onChange={(e) => setKbEditing({ ...kbEditing, title: e.target.value })} placeholder="Título" />
              {kbType === "produto" && (
                <Input value={kbEditing.scope || ""} onChange={(e) => setKbEditing({ ...kbEditing, scope: e.target.value })} placeholder="Scope (ex: shopee:ITEM_ID)" />
              )}
              <Textarea rows={6} value={kbEditing.body} onChange={(e) => setKbEditing({ ...kbEditing, body: e.target.value })} placeholder="Conteúdo" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setKbEditing(null)}>Cancelar</Button>
                <Button onClick={() => kbUpsert.mutate({
                  id: kbEditing.id,
                  type: kbType,
                  scope: kbEditing.scope,
                  title: kbEditing.title,
                  body: kbEditing.body,
                  isActive: 1,
                })} disabled={!kbEditing.title || !kbEditing.body}>
                  {kbUpsert.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
