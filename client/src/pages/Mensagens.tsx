import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowLeft,
  Circle,
  Clock,
  Filter,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ACCOUNT_COLORS: Record<string, string> = {
  CLICKMULTII: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  DUOULTILIDADE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  KAIBRENLTDA: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

// Fallback para contas novas que ainda nao tem cor mapeada
const DEFAULT_ACCOUNT_COLOR = "bg-zinc-700/40 text-zinc-300 border-zinc-600/40";

export default function Mensagens() {
  const [mainTab, setMainTab] = useState<"mensagens" | "reclamacoes">("mensagens");
  const [filter, setFilter] = useState<"all" | "open" | "answered">("all");
  const [claimFilter, setClaimFilter] = useState<"all" | "opened" | "closed">("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [replyText, setReplyText] = useState("");

  // Mensagens state
  const [selectedPack, setSelectedPack] = useState<{ packId: string; accountName: string; buyerName: string } | null>(null);

  // Reclamações state
  const [selectedClaim, setSelectedClaim] = useState<{ claimId: string; accountName: string; buyerName: string } | null>(null);

  // Status do sync automático
  const syncStatusQuery = trpc.mlMessages.syncStatus.useQuery(undefined, { refetchInterval: 60000 });

  // Contas ML conectadas via API — alimenta o filtro dinamicamente
  const accountsQuery = trpc.marketplaceOrders.accounts.useQuery();
  const accountNames: string[] = (accountsQuery.data ?? []).map((a: any) => a.name);

  // Queries mensagens
  const listQuery = trpc.mlMessages.list.useQuery({ filter }, { refetchInterval: 30000 });
  const syncMutation = trpc.mlMessages.sync.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.synced} conversas sincronizadas`);
      if (data.errors.length > 0) toast.warning(data.errors.join(", "));
      listQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const conversationQuery = trpc.mlMessages.conversation.useQuery(
    { packId: selectedPack?.packId || "", accountName: selectedPack?.accountName || "" },
    { enabled: !!selectedPack, refetchInterval: 15000 }
  );
  const replyMutation = trpc.mlMessages.reply.useMutation({
    onSuccess: () => { toast.success("Resposta enviada!"); setReplyText(""); conversationQuery.refetch(); listQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const markReadMutation = trpc.mlMessages.markRead.useMutation({ onSuccess: () => listQuery.refetch() });

  // Queries reclamações
  const claimsQuery = trpc.mlMessages.claims.useQuery({ filter: claimFilter }, { refetchInterval: 30000 });
  const syncClaimsMutation = trpc.mlMessages.syncClaims.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.synced} reclamações sincronizadas`);
      if (data.errors.length > 0) toast.warning(data.errors.join(", "));
      claimsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const claimMsgsQuery = trpc.mlMessages.claimMessages.useQuery(
    { claimId: selectedClaim?.claimId || "", accountName: selectedClaim?.accountName || "" },
    { enabled: !!selectedClaim, refetchInterval: 15000 }
  );
  const replyClaimMutation = trpc.mlMessages.replyClaim.useMutation({
    onSuccess: () => { toast.success("Resposta enviada!"); setReplyText(""); claimMsgsQuery.refetch(); claimsQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const allConversations = listQuery.data || [];
  const allClaims = claimsQuery.data || [];
  const conversations = accountFilter === "all" ? allConversations : allConversations.filter((c: any) => c.accountName === accountFilter);
  const claims = accountFilter === "all" ? allClaims : allClaims.filter((c: any) => c.accountName === accountFilter);
  const unreadMsgs = allConversations.filter((c: any) => c.unread).length;
  const unreadClaims = allClaims.filter((c: any) => c.unread).length;
  const syncStatus = syncStatusQuery.data;

  // ═══ Conversa aberta (mensagem) ═══
  if (selectedPack) {
    const messages = conversationQuery.data || [];
    return (
      <DashboardLayout activeSection="mensagens">
        <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto">
          <div className="flex items-center gap-3 pb-4 border-b border-border/30">
            <Button size="sm" variant="ghost" onClick={() => { setSelectedPack(null); setReplyText(""); }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <User className="h-8 w-8 p-1.5 rounded-full bg-zinc-800 text-zinc-300" />
            <div>
              <div className="text-sm font-semibold text-foreground">{selectedPack.buyerName}</div>
              <Badge className={`${ACCOUNT_COLORS[selectedPack.accountName] || "bg-zinc-800 text-zinc-300"} text-[10px]`}>
                {selectedPack.accountName}
              </Badge>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {conversationQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">Nenhuma mensagem encontrada</div>
            ) : (
              messages.map((msg: any) => {
                const isSeller = msg.senderRole === "seller";
                return (
                  <div key={msg.id} className={`flex ${isSeller ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isSeller ? "bg-primary/20 text-foreground rounded-br-md" : "bg-zinc-800 text-foreground rounded-bl-md"}`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      <div className={`text-[10px] mt-1 ${isSeller ? "text-primary/60" : "text-muted-foreground/60"}`}>
                        {new Date(msg.createdAt).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="pt-3 border-t border-border/30 flex gap-2">
            <Input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Digite sua resposta..."
              className="flex-1" onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && selectedPack && replyMutation.mutate({ packId: selectedPack.packId, accountName: selectedPack.accountName, text: replyText.trim() })} />
            <Button onClick={() => replyMutation.mutate({ packId: selectedPack.packId, accountName: selectedPack.accountName, text: replyText.trim() })}
              disabled={replyMutation.isPending || !replyText.trim()} className="bg-primary text-primary-foreground hover:bg-[#B8941F]">
              {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ═══ Conversa aberta (reclamação) ═══
  if (selectedClaim) {
    const claimData = claimMsgsQuery.data as any;
    const msgs = claimData?.messages || claimData || [];
    const canReply = claimData?.canReply ?? true;
    const replyTarget = claimData?.replyTarget || "";
    return (
      <DashboardLayout activeSection="mensagens">
        <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto">
          <div className="flex items-center gap-3 pb-4 border-b border-border/30">
            <Button size="sm" variant="ghost" onClick={() => { setSelectedClaim(null); setReplyText(""); }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <ShieldAlert className="h-8 w-8 p-1.5 rounded-full bg-red-500/20 text-red-400" />
            <div>
              <div className="text-sm font-semibold text-foreground">{selectedClaim.buyerName}</div>
              <div className="flex gap-1">
                <Badge className={`${ACCOUNT_COLORS[selectedClaim.accountName] || "bg-zinc-800 text-zinc-300"} text-[10px]`}>
                  {selectedClaim.accountName}
                </Badge>
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Reclamação</Badge>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {claimMsgsQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : msgs.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">Nenhuma mensagem na reclamação</div>
            ) : (
              msgs.map((msg: any, i: number) => {
                const isSeller = msg.senderRole === "seller";
                const isMediator = msg.senderRole === "mediator";
                return (
                  <div key={i} className={`flex ${isSeller ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      isSeller ? "bg-primary/20 text-foreground rounded-br-md"
                      : isMediator ? "bg-amber-500/10 text-foreground rounded-bl-md border border-amber-500/30"
                      : "bg-zinc-800 text-foreground rounded-bl-md"
                    }`}>
                      {isMediator && <div className="text-[10px] text-amber-400 font-semibold mb-1">Mediador ML</div>}
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      <div className="text-[10px] mt-1 text-muted-foreground/60">
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleString("pt-BR") : "—"}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {canReply ? (
            <div className="pt-3 border-t border-border/30">
              {replyTarget && <div className="text-[10px] text-muted-foreground/60 mb-1">Enviando para: {replyTarget}</div>}
              <div className="flex gap-2">
                <Input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={`Responder ao ${replyTarget || "reclamação"}...`}
                  className="flex-1" onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && selectedClaim && replyClaimMutation.mutate({ claimId: selectedClaim.claimId, accountName: selectedClaim.accountName, text: replyText.trim() })} />
                <Button onClick={() => replyClaimMutation.mutate({ claimId: selectedClaim.claimId, accountName: selectedClaim.accountName, text: replyText.trim() })}
                  disabled={replyClaimMutation.isPending || !replyText.trim()} className="bg-red-600 hover:bg-red-700 text-white">
                  {replyClaimMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="pt-3 border-t border-border/30 text-center text-muted-foreground/60 text-xs py-2">
              Não é possível responder esta reclamação no momento
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ═══ Lista principal ═══
  return (
    <DashboardLayout activeSection="mensagens">
      <div className="flex flex-col gap-4 sm:gap-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              Mensagens ML
            </h1>
            <p className="text-sm text-muted-foreground">Mensagens e reclamações do Mercado Livre</p>
            {syncStatus?.messages.lastSync && (
              <div className="flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3 text-muted-foreground/60" />
                <span className="text-[10px] text-muted-foreground/60">
                  Último sync: {new Date(syncStatus.messages.lastSync).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  {(syncStatus.messages.errors.length > 0 || syncStatus.claims.errors.length > 0) && (
                    <span className="text-red-400 ml-2">
                      ⚠ {[...syncStatus.messages.errors, ...syncStatus.claims.errors].join(", ")}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
          <Button size="sm"
            onClick={() => { syncMutation.mutate(); syncClaimsMutation.mutate(); }}
            disabled={syncMutation.isPending || syncClaimsMutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-[#B8941F]">
            {(syncMutation.isPending || syncClaimsMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Sincronizar
          </Button>
        </div>

        {/* Filtro por conta — dinamico, vindo das contas ML conectadas via API */}
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setAccountFilter("all")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${accountFilter === "all" ? "bg-zinc-700 text-foreground" : "text-muted-foreground hover:text-foreground bg-zinc-900/60"}`}>
            Todas as contas
          </button>
          {accountNames.map(name => (
            <button key={name} onClick={() => setAccountFilter(name)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${accountFilter === name ? (ACCOUNT_COLORS[name] || DEFAULT_ACCOUNT_COLOR) : "text-muted-foreground hover:text-foreground bg-zinc-900/60"}`}>
              {name}
            </button>
          ))}
        </div>

        {/* Tabs principais */}
        <div className="flex gap-1 bg-zinc-900/60 rounded-lg p-1">
          <button onClick={() => setMainTab("mensagens")}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors relative ${mainTab === "mensagens" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            Mensagens
            {unreadMsgs > 0 && <span className="absolute -top-1 -right-1 bg-primary text-black text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">{unreadMsgs}</span>}
          </button>
          <button onClick={() => setMainTab("reclamacoes")}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors relative ${mainTab === "reclamacoes" ? "bg-red-500/10 text-red-400" : "text-muted-foreground hover:text-foreground"}`}>
            Reclamações
            {unreadClaims > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">{unreadClaims}</span>}
          </button>
        </div>

        {/* ═══ Tab: Mensagens ═══ */}
        {mainTab === "mensagens" && (
          <>
            <div className="flex gap-2">
              {([{ value: "all", label: "Todas" }, { value: "open", label: "Abertas" }, { value: "answered", label: "Respondidas" }] as const).map(f => (
                <button key={f.value} onClick={() => setFilter(f.value)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground bg-zinc-900/60"}`}>
                  {f.label}
                </button>
              ))}
            </div>

            {listQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : conversations.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p>Nenhuma mensagem.</p>
                  <p className="text-xs mt-1">Clique em "Sincronizar" para buscar do Mercado Livre.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv: any) => (
                  <div key={conv.id} onClick={() => { setSelectedPack({ packId: conv.packId, accountName: conv.accountName, buyerName: conv.buyerName || "Comprador" }); if (conv.unread) markReadMutation.mutate({ id: conv.id }); }}
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors hover:bg-zinc-900/40 ${conv.unread ? "border-primary/30 bg-primary/5" : "border-border/30"}`}>
                    <div className="relative">
                      <User className="h-10 w-10 p-2 rounded-full bg-zinc-800 text-zinc-300" />
                      {conv.unread ? <Circle className="h-3 w-3 absolute -top-0.5 -right-0.5 fill-primary text-primary" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${conv.unread ? "text-foreground" : "text-foreground/70"}`}>{conv.buyerName || "Comprador"}</span>
                        <Badge className={`${ACCOUNT_COLORS[conv.accountName] || "bg-zinc-800 text-zinc-300"} text-[10px]`}>{conv.accountName}</Badge>
                        <Badge className={`text-[10px] ${conv.status === "open" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"}`}>
                          {conv.status === "open" ? "Aberta" : "Respondida"}
                        </Badge>
                      </div>
                      {conv.productTitle && <div className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{conv.productTitle}</div>}
                      <p className={`text-xs mt-1 truncate ${conv.unread ? "text-foreground/80" : "text-muted-foreground"}`}>
                        {conv.lastMessageFrom === "seller" ? "Você: " : ""}{conv.lastMessageText || "—"}
                      </p>
                    </div>
                    <div className="text-[10px] text-muted-foreground shrink-0">
                      {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══ Tab: Reclamações ═══ */}
        {mainTab === "reclamacoes" && (
          <>
            <div className="flex gap-2">
              {([{ value: "all", label: "Todas" }, { value: "opened", label: "Abertas" }, { value: "closed", label: "Fechadas" }] as const).map(f => (
                <button key={f.value} onClick={() => setClaimFilter(f.value)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${claimFilter === f.value ? "bg-red-500/10 text-red-400" : "text-muted-foreground hover:text-foreground bg-zinc-900/60"}`}>
                  {f.label}
                </button>
              ))}
            </div>

            {claimsQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : claims.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p>Nenhuma reclamação.</p>
                  <p className="text-xs mt-1">Clique em "Sincronizar" para buscar do Mercado Livre.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {claims.map((claim: any) => (
                  <div key={claim.id}
                    onClick={() => setSelectedClaim({ claimId: claim.claimId, accountName: claim.accountName, buyerName: claim.buyerName || "Comprador" })}
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors hover:bg-zinc-900/40 ${claim.unread ? "border-red-500/30 bg-red-500/5" : "border-border/30"}`}>
                    <div className="relative">
                      <ShieldAlert className="h-10 w-10 p-2 rounded-full bg-red-500/20 text-red-400" />
                      {claim.unread ? <Circle className="h-3 w-3 absolute -top-0.5 -right-0.5 fill-red-500 text-red-500" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${claim.unread ? "text-foreground" : "text-foreground/70"}`}>{claim.buyerName || "Comprador"}</span>
                        <Badge className={`${ACCOUNT_COLORS[claim.accountName] || "bg-zinc-800 text-zinc-300"} text-[10px]`}>{claim.accountName}</Badge>
                        <Badge className={`text-[10px] ${claim.status === "opened" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"}`}>
                          {claim.status === "opened" ? "Aberta" : claim.status}
                        </Badge>
                        {claim.reason && <Badge className="bg-zinc-800 text-zinc-400 text-[10px]">{claim.reason}</Badge>}
                      </div>
                      {claim.productTitle && <div className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{claim.productTitle}</div>}
                      <p className={`text-xs mt-1 truncate ${claim.unread ? "text-foreground/80" : "text-muted-foreground"}`}>
                        {claim.lastMessageFrom === "seller" ? "Você: " : claim.lastMessageFrom === "mediator" ? "Mediador: " : ""}
                        {claim.lastMessage || "—"}
                      </p>
                    </div>
                    <div className="text-[10px] text-muted-foreground shrink-0">
                      {claim.lastMessageAt ? new Date(claim.lastMessageAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
