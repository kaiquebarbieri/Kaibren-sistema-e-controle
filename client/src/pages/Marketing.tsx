import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  Check,
  ChevronLeft,
  Copy,
  ExternalLink,
  ImagePlus,
  Loader2,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  Package,
  Plus,
  Send,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

type ViewMode = "list" | "create" | "detail" | "send";

const campaignTypeLabels: Record<string, string> = {
  promotional: "Promoção",
  launch: "Lançamento",
  seasonal: "Sazonal",
  flash_sale: "Oferta Relâmpago",
  loyalty: "Fidelidade",
};

const campaignTypeColors: Record<string, string> = {
  promotional: "bg-orange-500/10 text-orange-600 border-orange-200",
  launch: "bg-blue-500/10 text-blue-600 border-blue-200",
  seasonal: "bg-green-500/10 text-green-600 border-green-200",
  flash_sale: "bg-red-500/10 text-red-600 border-red-200",
  loyalty: "bg-purple-500/10 text-purple-600 border-purple-200",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  active: "Ativa",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/10 text-blue-600",
  active: "bg-green-500/10 text-green-600",
  completed: "bg-gray-500/10 text-gray-600",
  cancelled: "bg-red-500/10 text-red-600",
};

function formatCurrency(value: string | number | null | undefined) {
  const num = Number(value ?? 0);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function Marketing() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <DashboardLayout activeSection="marketing">
      <div className="space-y-4 sm:space-y-6">
        {viewMode === "list" && (
          <CampaignList
            onCreateNew={() => setShowCreateDialog(true)}
            onViewDetail={(id) => {
              setSelectedCampaignId(id);
              setViewMode("detail");
            }}
          />
        )}

        {viewMode === "detail" && selectedCampaignId && (
          <CampaignDetail
            campaignId={selectedCampaignId}
            onBack={() => {
              setViewMode("list");
              setSelectedCampaignId(null);
            }}
            onSend={() => setViewMode("send")}
          />
        )}

        {viewMode === "send" && selectedCampaignId && (
          <SendCampaign
            campaignId={selectedCampaignId}
            onBack={() => setViewMode("detail")}
            onSent={() => setViewMode("detail")}
          />
        )}

        <CreateCampaignDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreated={(id) => {
            setSelectedCampaignId(id);
            setViewMode("detail");
            setShowCreateDialog(false);
          }}
        />
      </div>
    </DashboardLayout>
  );
}

/* ── Campaign List ── */

function CampaignList({
  onCreateNew,
  onViewDetail,
}: {
  onCreateNew: () => void;
  onViewDetail: (id: number) => void;
}) {
  const { data: campaigns, isLoading } = trpc.marketing.campaigns.list.useQuery();

  const activeCampaigns = campaigns?.filter(c => c.status === "active") ?? [];
  const totalSent = campaigns?.reduce((sum, c) => sum + (c.totalSent ?? 0), 0) ?? 0;
  const totalConverted = campaigns?.reduce((sum, c) => sum + (c.totalConverted ?? 0), 0) ?? 0;
  const conversionRate = totalSent > 0 ? totalConverted / totalSent : 0;

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Megaphone className="h-4 w-4" />
            <span>Marketing & Campanhas</span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Central de Marketing
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie campanhas, gere banners e dispare promoções para seus clientes via WhatsApp.
          </p>
        </div>
        <Button onClick={onCreateNew} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Card className="bg-gradient-to-br from-blue-950 to-blue-900 text-white border-0">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-blue-300">
              <Megaphone className="h-3.5 w-3.5" />
              Campanhas
            </div>
            <p className="mt-1 text-lg sm:text-2xl font-bold">{campaigns?.length ?? 0}</p>
            <p className="text-xs text-blue-300">{activeCampaigns.length} ativa(s)</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-950 to-green-900 text-white border-0">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-green-300">
              <Send className="h-3.5 w-3.5" />
              Enviadas
            </div>
            <p className="mt-1 text-lg sm:text-2xl font-bold">{totalSent}</p>
            <p className="text-xs text-green-300">mensagens</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-950 to-purple-900 text-white border-0">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-purple-300">
              <ShoppingCart className="h-3.5 w-3.5" />
              Conversões
            </div>
            <p className="mt-1 text-lg sm:text-2xl font-bold">{totalConverted}</p>
            <p className="text-xs text-purple-300">pedidos gerados</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-950 to-amber-900 text-white border-0">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-300">
              <TrendingUp className="h-3.5 w-3.5" />
              Taxa Conversão
            </div>
            <p className="mt-1 text-lg sm:text-2xl font-bold">{formatPercent(conversionRate)}</p>
            <p className="text-xs text-amber-300">geral</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">Suas Campanhas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !campaigns || campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Megaphone className="h-12 w-12 text-muted-foreground/30" />
              <h3 className="mt-4 text-base font-semibold text-foreground">Nenhuma campanha ainda</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                Crie sua primeira campanha de marketing para começar a enviar promoções para seus clientes.
              </p>
              <Button onClick={onCreateNew} className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Criar primeira campanha
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map(campaign => (
                <button
                  key={campaign.id}
                  onClick={() => onViewDetail(campaign.id)}
                  className="w-full rounded-lg border p-3 sm:p-4 text-left transition-colors hover:bg-accent/50"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground truncate">{campaign.title}</h3>
                        <Badge variant="outline" className={`text-[10px] ${campaignTypeColors[campaign.campaignType]}`}>
                          {campaignTypeLabels[campaign.campaignType]}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${statusColors[campaign.status]}`}>
                          {statusLabels[campaign.status]}
                        </Badge>
                      </div>
                      {campaign.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{campaign.description}</p>
                      )}
                      {campaign.discountLabel && (
                        <p className="mt-1 text-xs font-medium text-orange-600">{campaign.discountLabel}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                      <div className="flex items-center gap-1">
                        <Send className="h-3 w-3" />
                        <span>{campaign.totalSent}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MousePointerClick className="h-3 w-3" />
                        <span>{campaign.totalClicked}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ShoppingCart className="h-3 w-3" />
                        <span>{campaign.totalConverted}</span>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/* ── Create Campaign Dialog ── */

function CreateCampaignDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [campaignType, setCampaignType] = useState("promotional");
  const [discountLabel, setDiscountLabel] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const { data: allProducts } = trpc.products.search.useQuery(
    { query: productSearch, limit: 50 },
    { enabled: open }
  );

  const createMutation = trpc.marketing.campaigns.create.useMutation({
    onSuccess: (data) => {
      if (data) {
        toast.success("Campanha criada com sucesso!");
        onCreated(data.id);
        resetForm();
      }
    },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setTitle("");
    setDescription("");
    setCampaignType("promotional");
    setDiscountLabel("");
    setMessageTemplate("");
    setSelectedProductIds([]);
    setProductSearch("");
  }

  function handleCreate() {
    if (!title.trim()) {
      toast.error("Informe o título da campanha");
      return;
    }
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      campaignType: campaignType as any,
      discountLabel: discountLabel.trim() || null,
      messageTemplate: messageTemplate.trim() || null,
      productIds: selectedProductIds,
    });
  }

  function toggleProduct(id: number) {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Nova Campanha
          </DialogTitle>
          <DialogDescription>
            Configure sua campanha de marketing para enviar aos clientes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título da campanha *</Label>
            <Input
              placeholder="Ex: Promoção de Março - 20% OFF"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={campaignType} onValueChange={setCampaignType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="promotional">Promoção</SelectItem>
                <SelectItem value="launch">Lançamento</SelectItem>
                <SelectItem value="seasonal">Sazonal</SelectItem>
                <SelectItem value="flash_sale">Oferta Relâmpago</SelectItem>
                <SelectItem value="loyalty">Fidelidade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              placeholder="Descreva a campanha..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Texto da promoção</Label>
            <Input
              placeholder="Ex: 20% OFF em toda linha, Compre 2 leve 3"
              value={discountLabel}
              onChange={e => setDiscountLabel(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Mensagem para WhatsApp</Label>
            <Textarea
              placeholder={`Ex: Olá {nome}! 🔥 Promoção especial CK Distribuidora!\n\n{produtos}\n\n📲 Faça seu pedido agora!`}
              value={messageTemplate}
              onChange={e => setMessageTemplate(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Use {"{nome}"} para o nome do cliente e {"{produtos}"} para a lista de produtos.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produtos em destaque ({selectedProductIds.length})
            </Label>
            <Input
              placeholder="Buscar produto por nome ou SKU..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
            />
            {allProducts && allProducts.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border">
                {allProducts.map(product => {
                  const isSelected = selectedProductIds.includes(product.id);
                  return (
                    <button
                      key={product.id}
                      onClick={() => toggleProduct(product.id)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50 ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                      }`}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
                      <span className="truncate">{product.titulo}</span>
                      <span className="ml-auto shrink-0 text-xs font-medium text-foreground">
                        {formatCurrency(product.precoFinal)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={createMutation.isPending} className="gap-2">
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Criar Campanha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Campaign Detail ── */

function CampaignDetail({
  campaignId,
  onBack,
  onSend,
}: {
  campaignId: number;
  onBack: () => void;
  onSend: () => void;
}) {
  const { data, isLoading, refetch } = trpc.marketing.campaigns.detail.useQuery({ id: campaignId });
  const [bannerPrompt, setBannerPrompt] = useState("");
  const [showBannerGen, setShowBannerGen] = useState(false);

  const generateBannerMutation = trpc.marketing.campaigns.generateBanner.useMutation({
    onSuccess: () => {
      toast.success("Banner gerado com sucesso!");
      refetch();
      setShowBannerGen(false);
      setBannerPrompt("");
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: allProducts } = trpc.products.list.useQuery();

  const productMap = useMemo(() => {
    if (!allProducts) return new Map();
    return new Map(allProducts.map(p => [p.id, p]));
  }, [allProducts]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const { campaign, products: campaignProds, messages, stats } = data;
  const conversionRate = stats.totalSent > 0 ? stats.totalConverted / stats.totalSent : 0;
  const clickRate = stats.totalSent > 0 ? stats.totalClicked / stats.totalSent : 0;

  function buildWhatsAppMessage(customerName: string, phone: string) {
    let msg = campaign.messageTemplate || `Olá ${customerName}! 🔥 Promoção CK Distribuidora!\n\n`;

    msg = msg.replace("{nome}", customerName);

    if (campaignProds.length > 0) {
      const productList = campaignProds.map(cp => {
        const product = productMap.get(cp.productId);
        const name = product?.titulo ?? `Produto #${cp.productId}`;
        const price = formatCurrency(cp.promoPrice ?? cp.originalPrice);
        return `• ${name} - ${price}`;
      }).join("\n");
      msg = msg.replace("{produtos}", productList);
    }

    if (campaign.bannerUrl) {
      msg += `\n\n📸 Veja o banner: ${campaign.bannerUrl}`;
    }

    const encoded = encodeURIComponent(msg);
    const cleanPhone = phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    return `https://wa.me/${fullPhone}?text=${encoded}`;
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">{campaign.title}</h1>
            <Badge variant="outline" className={`text-[10px] ${statusColors[campaign.status]}`}>
              {statusLabels[campaign.status]}
            </Badge>
          </div>
          {campaign.description && (
            <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{campaign.description}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Send className="h-3.5 w-3.5" />
              Enviadas
            </div>
            <p className="mt-1 text-lg sm:text-xl font-bold text-foreground">{stats.totalSent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <MousePointerClick className="h-3.5 w-3.5" />
              Cliques
            </div>
            <p className="mt-1 text-lg sm:text-xl font-bold text-foreground">{stats.totalClicked}</p>
            <p className="text-xs text-muted-foreground">{formatPercent(clickRate)} taxa</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <ShoppingCart className="h-3.5 w-3.5" />
              Conversões
            </div>
            <p className="mt-1 text-lg sm:text-xl font-bold text-foreground">{stats.totalConverted}</p>
            <p className="text-xs text-muted-foreground">{formatPercent(conversionRate)} taxa</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Target className="h-3.5 w-3.5" />
              Receita
            </div>
            <p className="mt-1 text-lg sm:text-xl font-bold text-foreground">{formatCurrency(campaign.totalRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Banner Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ImagePlus className="h-4 w-4 text-primary" />
            Banner / Criativo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {campaign.bannerUrl ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-lg border">
                <img
                  src={campaign.bannerUrl}
                  alt="Banner da campanha"
                  className="w-full object-cover"
                  style={{ maxHeight: 300 }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    navigator.clipboard.writeText(campaign.bannerUrl!);
                    toast.success("Link do banner copiado!");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowBannerGen(true)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Gerar novo banner
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
              <ImagePlus className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-2 text-sm font-medium text-foreground">Nenhum banner ainda</p>
              <p className="mt-1 text-xs text-muted-foreground">Gere um banner profissional com IA</p>
              <Button
                className="mt-3 gap-2"
                size="sm"
                onClick={() => setShowBannerGen(true)}
              >
                <Sparkles className="h-4 w-4" />
                Gerar Banner com IA
              </Button>
            </div>
          )}

          {showBannerGen && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <Label className="text-sm">Descreva o banner que deseja</Label>
              <Textarea
                placeholder="Ex: Banner com fundo vermelho, produtos de limpeza em destaque, texto '20% OFF em toda linha', estilo moderno"
                value={bannerPrompt}
                onChange={e => setBannerPrompt(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    if (!bannerPrompt.trim()) {
                      toast.error("Descreva o banner que deseja gerar");
                      return;
                    }
                    generateBannerMutation.mutate({
                      campaignId,
                      prompt: bannerPrompt.trim(),
                    });
                  }}
                  disabled={generateBannerMutation.isPending}
                  className="gap-2"
                >
                  {generateBannerMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {generateBannerMutation.isPending ? "Gerando..." : "Gerar"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowBannerGen(false);
                    setBannerPrompt("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products */}
      {campaignProds.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-primary" />
              Produtos da Campanha ({campaignProds.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {campaignProds.map(cp => {
                const product = productMap.get(cp.productId);
                return (
                  <div key={cp.id} className="flex items-center gap-3 rounded-lg border p-2 sm:p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {product?.titulo ?? `Produto #${cp.productId}`}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {product?.sku ?? "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {cp.promoPrice && Number(cp.promoPrice) !== Number(cp.originalPrice) ? (
                        <>
                          <p className="text-xs text-muted-foreground line-through">{formatCurrency(cp.originalPrice)}</p>
                          <p className="text-sm font-bold text-green-600">{formatCurrency(cp.promoPrice)}</p>
                        </>
                      ) : (
                        <p className="text-sm font-medium text-foreground">{formatCurrency(cp.originalPrice)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* WhatsApp Message Template */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-green-600" />
            Mensagem WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaign.messageTemplate ? (
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-3 sm:p-4">
              <p className="whitespace-pre-wrap text-sm text-foreground">{campaign.messageTemplate}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma mensagem configurada. Será usada uma mensagem padrão.</p>
          )}
        </CardContent>
      </Card>

      {/* Send Button */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onSend} className="gap-2 w-full sm:w-auto" size="lg">
          <Send className="h-4 w-4" />
          Disparar para Clientes
        </Button>
      </div>

      {/* Messages Sent */}
      {messages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Mensagens Enviadas ({messages.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {messages.map(msg => (
                <div key={msg.id} className="flex items-center gap-3 rounded-lg border p-2 sm:p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{msg.customerName}</p>
                    <p className="text-xs text-muted-foreground">{msg.customerPhone ?? "Sem telefone"}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${statusColors[msg.status] ?? ""}`}>
                    {statusLabels[msg.status] ?? msg.status}
                  </Badge>
                  {msg.customerPhone && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        const url = buildWhatsAppMessage(msg.customerName, msg.customerPhone!);
                        window.open(url, "_blank");
                      }}
                    >
                      <MessageCircle className="h-4 w-4 text-green-600" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/* ── Send Campaign ── */

function SendCampaign({
  campaignId,
  onBack,
  onSent,
}: {
  campaignId: number;
  onBack: () => void;
  onSent: () => void;
}) {
  const { data: customersWithPhone, isLoading: loadingCustomers } = trpc.marketing.campaigns.customersWithPhone.useQuery();
  const { data: allCustomers } = trpc.customers.list.useQuery();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [search, setSearch] = useState("");

  const sendMutation = trpc.marketing.campaigns.sendToCustomers.useMutation({
    onSuccess: (data) => {
      toast.success(`Campanha preparada para ${data.sent} cliente(s)! Abra o WhatsApp para enviar.`);
      onSent();
    },
    onError: (err) => toast.error(err.message),
  });

  const allAvailable = allCustomers ?? [];
  const withPhone = customersWithPhone ?? [];

  const filteredCustomers = useMemo(() => {
    const searchLower = search.toLowerCase();
    return allAvailable.filter(c =>
      !search || c.name.toLowerCase().includes(searchLower) || c.phone?.includes(search)
    );
  }, [allAvailable, search]);

  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCustomers.map(c => c.id));
    }
    setSelectAll(!selectAll);
  }, [selectAll, filteredCustomers]);

  function toggleCustomer(id: number) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  function handleSend() {
    if (selectedIds.length === 0) {
      toast.error("Selecione pelo menos um cliente");
      return;
    }
    sendMutation.mutate({ campaignId, customerIds: selectedIds });
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            Disparar Campanha
          </h1>
          <p className="text-sm text-muted-foreground">
            Selecione os clientes que receberão a campanha via WhatsApp.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Clientes ({selectedIds.length} de {filteredCustomers.length} selecionados)
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectAll ? "Desmarcar todos" : "Selecionar todos"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Buscar cliente por nome ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {loadingCustomers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhum cliente encontrado. Cadastre clientes primeiro.
              </p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-md border">
              {filteredCustomers.map(customer => {
                const isSelected = selectedIds.includes(customer.id);
                const hasPhone = !!customer.phone;
                return (
                  <button
                    key={customer.id}
                    onClick={() => toggleCustomer(customer.id)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 border-b last:border-b-0 ${
                      isSelected ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                    }`}>
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {customer.phone ?? "Sem telefone"}
                        {customer.city ? ` • ${customer.city}` : ""}
                      </p>
                    </div>
                    {hasPhone ? (
                      <MessageCircle className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <Badge variant="outline" className="text-[10px] shrink-0">Sem WhatsApp</Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center pt-2">
            <p className="text-xs text-muted-foreground">
              {withPhone.length} cliente(s) com telefone cadastrado
            </p>
            <Button
              onClick={handleSend}
              disabled={sendMutation.isPending || selectedIds.length === 0}
              className="gap-2 w-full sm:w-auto"
              size="lg"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Disparar para {selectedIds.length} cliente(s)
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
