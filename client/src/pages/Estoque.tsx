import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Box,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  Package,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  Upload,
  Warehouse,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const ENTRY_TYPE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  entrada_nf: { label: "Entrada NF", color: "text-emerald-400 bg-emerald-500/10", icon: ArrowUpRight },
  saida_venda: { label: "Saída Venda", color: "text-red-400 bg-red-500/10", icon: ArrowDownRight },
  ajuste_contagem: { label: "Contagem", color: "text-blue-400 bg-blue-500/10", icon: ClipboardList },
  ajuste_manual: { label: "Ajuste", color: "text-amber-400 bg-amber-500/10", icon: RefreshCw },
  devolucao: { label: "Devolução", color: "text-purple-400 bg-purple-500/10", icon: Package },
};

type NFItem = { sku: string; quantity: number; titulo?: string };

export default function Estoque() {
  const dashboardQuery = trpc.estoque.dashboard.useQuery(undefined, { refetchInterval: 60000 });
  const aliasesQuery = trpc.estoque.aliases.list.useQuery();
  const productsQuery = trpc.products.list.useQuery({ limit: 500 });
  const anunciosQuery = trpc.estoque.visaoAnuncios.useQuery();

  const entradaNFMutation = trpc.estoque.entradaNF.useMutation({
    onSuccess: (data) => { toast.success(`NF ${data.nfNumber}: ${data.processed} itens processados`); dashboardQuery.refetch(); setShowNF(false); setNfItems([]); },
    onError: (err) => toast.error(err.message),
  });
  const contagemMutation = trpc.estoque.contagem.useMutation({
    onSuccess: (data) => { toast.success(`${data.adjusted} itens ajustados`); dashboardQuery.refetch(); setShowContagem(false); },
    onError: (err) => toast.error(err.message),
  });
  const aliasUpsertMutation = trpc.estoque.aliases.upsert.useMutation({
    onSuccess: () => { toast.success("Alias salvo!"); aliasesQuery.refetch(); setShowAlias(false); },
    onError: (err) => toast.error(err.message),
  });
  const aliasDeleteMutation = trpc.estoque.aliases.delete.useMutation({
    onSuccess: () => { toast.success("Alias removido"); aliasesQuery.refetch(); },
  });

  const deleteItemMutation = trpc.estoque.deleteItem.useMutation({
    onSuccess: () => { toast.success("Item removido do estoque"); dashboardQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const contagensQuery = trpc.estoque.contagensPendentes.useQuery(undefined, { refetchInterval: 30000 });
  const aprovarMutation = trpc.estoque.aprovarContagem.useMutation({
    onSuccess: (data) => { toast.success(`Contagem #${data.countId} aprovada! ${data.adjusted} itens atualizados`); contagensQuery.refetch(); dashboardQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const rejeitarMutation = trpc.estoque.rejeitarContagem.useMutation({
    onSuccess: (data) => { toast.success(`Contagem #${data.countId} rejeitada`); contagensQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const [search, setSearch] = useState("");
  const [showNF, setShowNF] = useState(false);
  const [showContagem, setShowContagem] = useState(false);
  const [showAlias, setShowAlias] = useState(false);
  const [activeTab, setActiveTab] = useState<"estoque" | "movimentacoes" | "contagens" | "anuncios" | "aliases">("estoque");
  const [expandedCount, setExpandedCount] = useState<number | null>(null);

  const pendingCount = (contagensQuery.data || []).filter((c: any) => c.status === "pendente").length;

  // NF State
  const [nfNumber, setNfNumber] = useState("");
  const [nfSupplier, setNfSupplier] = useState("Mondial");
  const [nfItems, setNfItems] = useState<NFItem[]>([]);
  const [nfSku, setNfSku] = useState("");
  const [nfQty, setNfQty] = useState("");

  // Contagem State
  const [contagemItems, setContagemItems] = useState<{ sku: string; quantity: string; titulo?: string }[]>([]);
  const [contagemBy, setContagemBy] = useState("Kaique");
  const [contagemSearch, setContagemSearch] = useState("");

  // Alias State
  const [aliasMasterSku, setAliasMasterSku] = useState("");
  const [aliasPlatform, setAliasPlatform] = useState<string>("mercadolivre");
  const [aliasExternalSku, setAliasExternalSku] = useState("");
  const [aliasTitle, setAliasTitle] = useState("");

  const data = dashboardQuery.data;
  const allProducts = productsQuery.data ?? [];

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!search.trim()) return data.items;
    const q = search.toLowerCase();
    return data.items.filter((i: any) =>
      i.sku.toLowerCase().includes(q) || (i.titulo || "").toLowerCase().includes(q)
    );
  }, [data?.items, search]);

  const addNFItem = () => {
    if (!nfSku.trim() || !nfQty.trim()) return;
    const product = allProducts.find((p: any) => p.sku === nfSku.trim());
    setNfItems(prev => [...prev, { sku: nfSku.trim(), quantity: parseInt(nfQty), titulo: product?.titulo }]);
    setNfSku(""); setNfQty("");
  };

  const submitNF = () => {
    if (!nfNumber.trim() || nfItems.length === 0) { toast.error("Preencha número da NF e adicione itens"); return; }
    entradaNFMutation.mutate({ nfNumber: nfNumber.trim(), nfSupplier, items: nfItems });
  };

  const initContagem = () => {
    // Puxa TODOS os produtos cadastrados, não só os que já estão no inventário
    const inventoryMap = new Map((data?.items || []).map((i: any) => [i.sku, i.quantity ?? 0]));
    const items = allProducts
      .filter((p: any) => p.sku)
      .map((p: any) => ({
        sku: p.sku,
        quantity: String(inventoryMap.get(p.sku) ?? 0),
        titulo: p.titulo || "",
      }));
    setContagemItems(items);
    setContagemSearch("");
    setShowContagem(true);
  };

  const submitContagem = () => {
    // Enviar todos os itens (com e sem estoque) pra registrar contagem completa
    // Mas incluir os que tinham estoque antes (pra zerar se preciso) + os que têm agora
    const inventoryMap = new Map((data?.items || []).map((i: any) => [i.sku, true]));
    const items = contagemItems
      .filter(i => (parseInt(i.quantity) || 0) > 0 || inventoryMap.has(i.sku))
      .map(i => ({ sku: i.sku, quantity: parseInt(i.quantity) || 0 }));

    if (items.length === 0) {
      toast.error("Nenhum produto com estoque para salvar");
      return;
    }
    contagemMutation.mutate({ countedBy: contagemBy, items });
  };


  return (
    <DashboardLayout activeSection="estoque">
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Warehouse className="h-6 w-6 text-primary" />
              Estoque
            </h1>
            <p className="text-sm text-muted-foreground">Controle de entrada, saída e contagem</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setShowNF(true)}>
              <PackagePlus className="h-4 w-4 mr-1" /> Entrada NF
            </Button>
            <Button size="sm" variant="outline" className="border-border/50" onClick={initContagem}>
              <ClipboardList className="h-4 w-4 mr-1" /> Nova Contagem
            </Button>
            <Button size="sm" variant="outline" className="border-border/50" onClick={() => setShowAlias(true)}>
              <Plus className="h-4 w-4 mr-1" /> Alias SKU
            </Button>
          </div>
        </div>

        {/* Stats */}
        {data && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{data.total}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">SKUs no estoque</div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{data.totalQty}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Peças total</div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-bold ${(data.lowStock?.length || 0) > 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {data.lowStock?.length || 0}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Estoque baixo</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Low stock alerts */}
        {data?.lowStock && data.lowStock.length > 0 && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-400 text-sm font-semibold mb-2">
                <AlertTriangle className="h-4 w-4" />
                Produtos com estoque baixo ({data.lowStock.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.lowStock.slice(0, 8).map((item: any) => (
                  <div key={item.sku} className="flex items-center justify-between text-xs bg-red-500/5 rounded-lg p-2">
                    <div>
                      <span className="text-zinc-300 font-mono">{item.sku}</span>
                      <span className="text-zinc-500 ml-2">{(item.titulo || "").slice(0, 40)}</span>
                    </div>
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                      {item.quantity} un (min: {item.minStock})
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900/60 rounded-lg p-1">
          {(["estoque", "movimentacoes", "contagens", "anuncios", "aliases"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors relative ${
                activeTab === tab ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "estoque" ? "Estoque" : tab === "movimentacoes" ? "Movimentações" : tab === "contagens" ? "Contagens" : tab === "anuncios" ? "Anúncios" : "Aliases SKU"}
              {tab === "contagens" && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: Estoque */}
        {activeTab === "estoque" && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por SKU ou nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-zinc-900/60 border-zinc-800"
              />
            </div>
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 bg-zinc-900/40">
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase">SKU</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase">Produto</th>
                    <th className="text-center p-3 text-xs text-muted-foreground uppercase">Qtd</th>
                    <th className="text-center p-3 text-xs text-muted-foreground uppercase">Mín</th>
                    <th className="text-center p-3 text-xs text-muted-foreground uppercase">Status</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase">Última Contagem</th>
                    <th className="text-center p-3 text-xs text-muted-foreground uppercase w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">
                      {data?.total === 0 ? "Nenhum produto no estoque. Use 'Entrada NF' ou 'Nova Contagem' para começar." : "Nenhum resultado"}
                    </td></tr>
                  ) : (
                    filteredItems.map((item: any) => {
                      const isLow = item.quantity <= item.minStock;
                      return (
                        <tr key={item.sku} className="border-b border-border/20 hover:bg-zinc-900/30">
                          <td className="p-3 font-mono text-xs text-primary">{item.sku}</td>
                          <td className="p-3 text-foreground/80 max-w-[300px] truncate">{item.titulo || "—"}</td>
                          <td className={`p-3 text-center font-bold ${isLow ? "text-red-400" : "text-foreground"}`}>{item.quantity}</td>
                          <td className="p-3 text-center text-muted-foreground">{item.minStock}</td>
                          <td className="p-3 text-center">
                            {isLow ? (
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Baixo</Badge>
                            ) : (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">OK</Badge>
                            )}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {item.lastCountDate ? `${item.lastCountDate} por ${item.lastCountBy || "—"}` : "Nunca contado"}
                          </td>
                          <td className="p-3 text-center">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              onClick={() => deleteItemMutation.mutate({ sku: item.sku })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Tab: Movimentações */}
        {activeTab === "movimentacoes" && (
          <div className="overflow-x-auto rounded-xl border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-zinc-900/40">
                  <th className="text-left p-3 text-xs text-muted-foreground uppercase">Data</th>
                  <th className="text-left p-3 text-xs text-muted-foreground uppercase">Tipo</th>
                  <th className="text-left p-3 text-xs text-muted-foreground uppercase">SKU</th>
                  <th className="text-center p-3 text-xs text-muted-foreground uppercase">Qtd</th>
                  <th className="text-center p-3 text-xs text-muted-foreground uppercase">Antes → Depois</th>
                  <th className="text-left p-3 text-xs text-muted-foreground uppercase">Ref</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentEntries || []).length === 0 ? (
                  <tr><td colSpan={6} className="text-center p-8 text-muted-foreground">Nenhuma movimentação registrada</td></tr>
                ) : (
                  (data?.recentEntries || []).map((e: any) => {
                    const cfg = ENTRY_TYPE_LABELS[e.type] || ENTRY_TYPE_LABELS.ajuste_manual;
                    const Icon = cfg.icon;
                    return (
                      <tr key={e.id} className="border-b border-border/20 hover:bg-zinc-900/30">
                        <td className="p-3 text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString("pt-BR")}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.color}`}>
                            <Icon className="h-3 w-3" /> {cfg.label}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs text-primary">{e.sku}</td>
                        <td className={`p-3 text-center font-bold ${e.quantity > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {e.quantity > 0 ? `+${e.quantity}` : e.quantity}
                        </td>
                        <td className="p-3 text-center text-xs text-muted-foreground">{e.previousQty} → {e.newQty}</td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {e.nfNumber ? `NF ${e.nfNumber}` : e.platform || e.reason || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab: Contagens */}
        {activeTab === "contagens" && (
          <div className="space-y-4">
            {(contagensQuery.data || []).length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="p-8 text-center text-muted-foreground">
                  Nenhuma contagem enviada ainda.
                </CardContent>
              </Card>
            ) : (
              (contagensQuery.data || []).map((count: any) => {
                const isExpanded = expandedCount === count.id;
                const statusCfg = {
                  pendente: { color: "text-amber-400 bg-amber-500/10 border-amber-500/30", label: "Pendente" },
                  aprovada: { color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", label: "Aprovada" },
                  rejeitada: { color: "text-red-400 bg-red-500/10 border-red-500/30", label: "Rejeitada" },
                }[count.status] || { color: "text-zinc-400", label: count.status };
                const itemsWithDiff = (count.items || []).filter((i: any) => i.diff !== 0);
                return (
                  <Card key={count.id} className={`border-border/50 ${count.status === "pendente" ? "border-amber-500/30" : ""}`}>
                    <CardContent className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              Contagem #{count.id} — {count.countedBy}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(count.createdAt).toLocaleString("pt-BR")}
                              {" · "}{count.items?.length || 0} itens
                              {itemsWithDiff.length > 0 && <span className="text-amber-400"> · {itemsWithDiff.length} com diferença</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${statusCfg.color} text-[10px]`}>{statusCfg.label}</Badge>
                          <Button size="sm" variant="ghost" onClick={() => setExpandedCount(isExpanded ? null : count.id)}>
                            {isExpanded ? "Fechar" : "Ver itens"}
                          </Button>
                        </div>
                      </div>

                      {/* Items detail */}
                      {isExpanded && (
                        <div className="space-y-2">
                          <div className="overflow-x-auto rounded-lg border border-border/30">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-zinc-900/40 border-b border-border/30">
                                  <th className="text-left p-2 text-muted-foreground">SKU</th>
                                  <th className="text-center p-2 text-muted-foreground">Sistema</th>
                                  <th className="text-center p-2 text-muted-foreground">Contado</th>
                                  <th className="text-center p-2 text-muted-foreground">Diferença</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(count.items || []).map((item: any) => (
                                  <tr key={item.id} className={`border-b border-border/20 ${item.diff !== 0 ? "bg-amber-500/5" : ""}`}>
                                    <td className="p-2 font-mono text-primary">{item.sku}</td>
                                    <td className="p-2 text-center text-muted-foreground">{item.systemQty}</td>
                                    <td className="p-2 text-center font-semibold text-foreground">{item.countedQty}</td>
                                    <td className={`p-2 text-center font-bold ${item.diff > 0 ? "text-emerald-400" : item.diff < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                                      {item.diff > 0 ? `+${item.diff}` : item.diff === 0 ? "—" : item.diff}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Actions */}
                          {count.status === "pendente" && (
                            <div className="flex gap-2 pt-1">
                              <Button
                                size="sm"
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={aprovarMutation.isPending}
                                onClick={() => aprovarMutation.mutate({ countId: count.id })}
                              >
                                {aprovarMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                                Aprovar e Aplicar no Estoque
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-800 text-red-400 hover:bg-red-500/10"
                                disabled={rejeitarMutation.isPending}
                                onClick={() => rejeitarMutation.mutate({ countId: count.id })}
                              >
                                Rejeitar
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* Tab: Anúncios */}
        {activeTab === "anuncios" && (
          <div className="space-y-3">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 text-sm text-muted-foreground">
                <strong className="text-foreground">Visão por Anúncio</strong> — Cada produto físico mostra onde está anunciado.
                Para mapear anúncios, use a aba "Aliases SKU".
              </CardContent>
            </Card>
            {(anunciosQuery.data || []).length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="p-8 text-center text-muted-foreground">
                  Nenhum produto no estoque. Faça uma contagem primeiro.
                </CardContent>
              </Card>
            ) : (
              (anunciosQuery.data || []).map((item: any) => (
                <Card key={item.sku} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                      <div>
                        <span className="font-mono text-sm text-primary mr-2">{item.sku}</span>
                        <span className="text-sm text-foreground/80">{item.titulo}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[10px] ${item.quantity <= item.minStock ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"}`}>
                          {item.quantity} un
                        </Badge>
                        {item.anuncios.length > 0 && (
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">
                            {item.anuncios.length} anúncio(s)
                          </Badge>
                        )}
                      </div>
                    </div>
                    {item.anuncios.length > 0 ? (
                      <div className="space-y-1 mt-2">
                        {item.anuncios.map((a: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 bg-zinc-900/60 rounded-lg px-3 py-2 text-xs">
                            <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px] shrink-0">
                              {a.platform}
                            </Badge>
                            <span className="text-muted-foreground truncate">{a.title}</span>
                            <span className="text-muted-foreground/50 font-mono text-[10px] shrink-0">{a.externalSku}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground/50 mt-1">
                        Sem anúncios mapeados — adicione via "Aliases SKU"
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Tab: Aliases */}
        {activeTab === "aliases" && (
          <>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 text-sm text-muted-foreground">
                <strong className="text-foreground">O que são Aliases?</strong> — Quando você tem o mesmo produto com nomes ou SKUs diferentes
                nos marketplaces (ex: 4 anúncios do mesmo item no ML), registre aqui o SKU mestre (Mondial) e o SKU/título de cada anúncio.
                Assim o sistema sabe que tudo aponta para o mesmo produto físico.
              </CardContent>
            </Card>
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 bg-zinc-900/40">
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase">SKU Mestre</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase">Plataforma</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase">SKU/ID Externo</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase">Título Externo</th>
                    <th className="text-center p-3 text-xs text-muted-foreground uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {(aliasesQuery.data || []).length === 0 ? (
                    <tr><td colSpan={5} className="text-center p-8 text-muted-foreground">
                      Nenhum alias cadastrado. Clique em "Alias SKU" para mapear seus anúncios.
                    </td></tr>
                  ) : (
                    (aliasesQuery.data || []).map((a: any) => (
                      <tr key={a.id} className="border-b border-border/20 hover:bg-zinc-900/30">
                        <td className="p-3 font-mono text-xs text-primary">{a.masterSku}</td>
                        <td className="p-3"><Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px]">{a.platform}</Badge></td>
                        <td className="p-3 text-xs text-foreground/80">{a.externalSku}</td>
                        <td className="p-3 text-xs text-muted-foreground max-w-[250px] truncate">{a.externalTitle || "—"}</td>
                        <td className="p-3 text-center">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                            onClick={() => aliasDeleteMutation.mutate({ id: a.id })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ═══ Modal: Entrada NF ═══ */}
      <Dialog open={showNF} onOpenChange={setShowNF}>
        <DialogContent className="bg-card border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-emerald-400" /> Entrada de Nota Fiscal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Número da NF</label>
                <Input value={nfNumber} onChange={e => setNfNumber(e.target.value)} placeholder="Ex: 12345" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fornecedor</label>
                <Input value={nfSupplier} onChange={e => setNfSupplier(e.target.value)} className="mt-1" />
              </div>
            </div>

            <div className="border border-border/30 rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Adicionar item</div>
              <div className="flex gap-2">
                <Input value={nfSku} onChange={e => setNfSku(e.target.value)} placeholder="SKU (ex: 0005-23)"
                  className="flex-1" list="sku-list" onKeyDown={e => e.key === "Enter" && addNFItem()} />
                <Input value={nfQty} onChange={e => setNfQty(e.target.value)} placeholder="Qtd" type="number"
                  className="w-20" onKeyDown={e => e.key === "Enter" && addNFItem()} />
                <Button size="sm" onClick={addNFItem} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <datalist id="sku-list">
                {allProducts.map((p: any) => <option key={p.sku} value={p.sku}>{p.titulo}</option>)}
              </datalist>
            </div>

            {nfItems.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">{nfItems.length} itens na NF</div>
                {nfItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-zinc-900/60 rounded-lg px-3 py-2 text-xs">
                    <div>
                      <span className="font-mono text-primary">{item.sku}</span>
                      {item.titulo && <span className="text-muted-foreground ml-2">{item.titulo.slice(0, 40)}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-400">+{item.quantity}</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400"
                        onClick={() => setNfItems(prev => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button onClick={submitNF} disabled={entradaNFMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
              {entradaNFMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PackagePlus className="h-4 w-4 mr-2" />}
              Dar Entrada ({nfItems.reduce((s, i) => s + i.quantity, 0)} peças)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Modal: Contagem ═══ */}
      <Dialog open={showContagem} onOpenChange={setShowContagem}>
        <DialogContent className="bg-card border-border/50 max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-400" /> Contagem de Estoque
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Contado por</label>
                <Input value={contagemBy} onChange={e => setContagemBy(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Buscar produto</label>
                <Input
                  placeholder="SKU ou nome..."
                  value={contagemSearch}
                  onChange={e => setContagemSearch(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {contagemItems.length} produtos. Ajuste as quantidades conforme a contagem física.
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
              {(() => {
                const filtered = contagemSearch.trim()
                  ? contagemItems.filter(i => {
                      const q = contagemSearch.toLowerCase();
                      return i.sku.toLowerCase().includes(q) || (i.titulo || "").toLowerCase().includes(q);
                    })
                  : contagemItems;
                return filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {contagemItems.length === 0 ? "Nenhum produto cadastrado. Cadastre produtos primeiro." : "Nenhum resultado para a busca."}
                  </p>
                ) : (
                  filtered.map((item) => {
                    const realIdx = contagemItems.findIndex(i => i.sku === item.sku);
                    return (
                      <div key={item.sku} className="flex items-center gap-3 bg-zinc-900/60 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs text-primary">{item.sku}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{item.titulo || "Sem nome"}</div>
                        </div>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={e => {
                            const updated = [...contagemItems];
                            updated[realIdx] = { ...updated[realIdx], quantity: e.target.value };
                            setContagemItems(updated);
                          }}
                          className="w-20 text-center text-sm"
                        />
                      </div>
                    );
                  })
                );
              })()}
            </div>
            <Button onClick={submitContagem} disabled={contagemMutation.isPending || contagemItems.length === 0} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              {contagemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ClipboardList className="h-4 w-4 mr-2" />}
              Salvar Contagem ({contagemItems.filter(i => parseInt(i.quantity) > 0).length} itens com estoque)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Modal: Alias SKU ═══ */}
      <Dialog open={showAlias} onOpenChange={setShowAlias}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Mapear Alias de SKU</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Conecte um anúncio de marketplace ao SKU mestre da Mondial. Isso permite rastrear vendas de múltiplos anúncios do mesmo produto.
            </p>
            <div>
              <label className="text-xs font-medium text-muted-foreground">SKU Mestre (Mondial)</label>
              <Input value={aliasMasterSku} onChange={e => setAliasMasterSku(e.target.value)}
                placeholder="Ex: 0005-23" className="mt-1" list="sku-list" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Plataforma</label>
              <select
                value={aliasPlatform}
                onChange={e => setAliasPlatform(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
              >
                <option value="mercadolivre">Mercado Livre</option>
                <option value="shopee">Shopee</option>
                <option value="amazon">Amazon</option>
                <option value="tiktok">TikTok Shop</option>
                <option value="loja_fisica">Loja Física</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">SKU/ID no Marketplace</label>
              <Input value={aliasExternalSku} onChange={e => setAliasExternalSku(e.target.value)}
                placeholder="Ex: MLB-123456 ou SKU do anúncio" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Título do Anúncio (opcional)</label>
              <Input value={aliasTitle} onChange={e => setAliasTitle(e.target.value)}
                placeholder="Nome como aparece no marketplace" className="mt-1" />
            </div>
            <Button
              onClick={() => aliasUpsertMutation.mutate({
                masterSku: aliasMasterSku, platform: aliasPlatform as any,
                externalSku: aliasExternalSku, externalTitle: aliasTitle,
              })}
              disabled={aliasUpsertMutation.isPending}
              className="w-full bg-primary text-primary-foreground hover:bg-[#B8941F]"
            >
              {aliasUpsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Alias
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
