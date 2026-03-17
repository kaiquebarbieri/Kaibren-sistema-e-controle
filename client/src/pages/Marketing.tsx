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
  Check,
  ChevronLeft,
  Copy,
  Edit3,
  ExternalLink,
  ImagePlus,
  Loader2,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  Package,
  Pencil,
  Plus,
  Send,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type ViewMode = "list" | "detail";

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
  pending: "Pendente",
  sent: "Enviada",
  delivered: "Entregue",
  clicked: "Clicou",
  converted: "Converteu",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/10 text-blue-600",
  active: "bg-green-500/10 text-green-600",
  completed: "bg-gray-500/10 text-gray-600",
  cancelled: "bg-red-500/10 text-red-600",
  pending: "bg-yellow-500/10 text-yellow-600",
  sent: "bg-blue-500/10 text-blue-600",
  delivered: "bg-green-500/10 text-green-600",
  clicked: "bg-purple-500/10 text-purple-600",
  converted: "bg-emerald-500/10 text-emerald-600",
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
            Crie campanhas, suba seus banners e dispare promoções via WhatsApp.
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
                        <p className="mt-0.5 text-xs font-medium text-green-600">{campaign.discountLabel}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
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
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const { data: allProducts } = trpc.products.search.useQuery(
    { query: productSearch, limit: 50 },
    { enabled: open }
  );

  const createMutation = trpc.marketing.campaigns.create.useMutation({
    onSuccess: (data) => {
      if (data) {
        toast.success("Campanha criada! Agora configure a mensagem e o banner.");
        onCreated(data.id);
        resetForm();
      }
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  function resetForm() {
    setTitle("");
    setDescription("");
    setCampaignType("promotional");
    setDiscountLabel("");
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
      campaignType: campaignType as "promotional" | "launch" | "seasonal" | "flash_sale" | "loyalty",
      discountLabel: discountLabel.trim() || null,
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
            Configure os dados básicos da campanha para seu controle. Depois você monta a mensagem e sobe o banner.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da campanha *</Label>
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
            <Label>Descrição (para seu controle)</Label>
            <Textarea
              placeholder="Descreva a campanha..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Promoção / Desconto</Label>
            <Input
              placeholder="Ex: 20% OFF em toda linha, Compre 2 leve 3"
              value={discountLabel}
              onChange={e => setDiscountLabel(e.target.value)}
            />
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

/* ── Campaign Detail (Banner + Message + Send - all in one) ── */

function CampaignDetail({
  campaignId,
  onBack,
}: {
  campaignId: number;
  onBack: () => void;
}) {
  const { data, isLoading, refetch } = trpc.marketing.campaigns.detail.useQuery({ id: campaignId });
  const { data: strategies } = trpc.marketing.campaigns.strategies.useQuery();
  const { data: allProducts } = trpc.products.list.useQuery();
  const { data: allCustomers, isLoading: loadingCustomers } = trpc.customers.list.useQuery();

  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [editingMessage, setEditingMessage] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [showStrategyPicker, setShowStrategyPicker] = useState(false);

  // Send state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [sendingIndex, setSendingIndex] = useState(-1);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const [showSendSection, setShowSendSection] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadBannerMutation = trpc.marketing.campaigns.uploadBanner.useMutation({
    onSuccess: () => {
      toast.success("Banner enviado com sucesso!");
      refetch();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const generateMessageMutation = trpc.marketing.campaigns.generateMessage.useMutation({
    onSuccess: (result) => {
      setMessageText(result.message);
      setEditingMessage(true);
      toast.success("Mensagem gerada! Edite como quiser antes de salvar.");
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const updateMutation = trpc.marketing.campaigns.update.useMutation({
    onSuccess: () => {
      toast.success("Mensagem salva!");
      setEditingMessage(false);
      refetch();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const sendMutation = trpc.marketing.campaigns.sendToCustomers.useMutation({
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const productMap = useMemo(() => {
    if (!allProducts) return new Map<number, any>();
    return new Map(allProducts.map(p => [p.id, p] as [number, any]));
  }, [allProducts]);

  const filteredCustomers = useMemo(() => {
    const available = allCustomers ?? [];
    const searchLower = customerSearch.toLowerCase();
    return available.filter(c =>
      !customerSearch || c.name.toLowerCase().includes(searchLower) || c.phone?.includes(customerSearch)
    );
  }, [allCustomers, customerSearch]);

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

  // Get the final message text to send - use saved template from campaign
  const currentMessage = campaign.messageTemplate || "";

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione apenas arquivos de imagem (PNG, JPG, etc.)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadBannerMutation.mutate({
        campaignId,
        fileBase64: base64,
        fileName: file.name,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleGenerateMessage(strategyId?: number) {
    generateMessageMutation.mutate({
      campaignId,
      strategyId: strategyId ?? selectedStrategyId ?? undefined,
      customPrompt: customPrompt.trim() || undefined,
    });
    setShowStrategyPicker(false);
  }

  function handleSaveMessage() {
    updateMutation.mutate({
      id: campaignId,
      messageTemplate: messageText.trim(),
    });
  }

  // Build WhatsApp Web URL with the EXACT message text saved in the campaign
  function buildWhatsAppUrl(customerName: string, phone: string) {
    // Start with the saved message template
    let msg = currentMessage;

    // If no message saved, use a simple default
    if (!msg.trim()) {
      msg = `Olá ${customerName}! Confira nossa promoção!`;
    }

    // Replace {nome} with the actual customer name
    msg = msg.replace(/\{nome\}/g, customerName);

    // Replace {produtos} with the product list if available
    if (campaignProds.length > 0 && msg.includes("{produtos}")) {
      const productList = campaignProds.map(cp => {
        const product = productMap.get(cp.productId);
        const name = product?.titulo ?? `Produto #${cp.productId}`;
        const price = formatCurrency(cp.promoPrice ?? cp.originalPrice);
        return `• ${name} - ${price}`;
      }).join("\n");
      msg = msg.replace(/\{produtos\}/g, productList);
    }

    // Add banner link at the end of the message if available
    if (campaign.bannerUrl) {
      msg += `\n\n📸 Veja a promoção: ${campaign.bannerUrl}`;
    }

    // Build the WhatsApp Web URL
    const encoded = encodeURIComponent(msg);
    const cleanPhone = phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    return `https://web.whatsapp.com/send?phone=${fullPhone}&text=${encoded}`;
  }

  function handleSelectAll() {
    if (selectAll) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCustomers.map(c => c.id));
    }
    setSelectAll(!selectAll);
  }

  function toggleCustomer(id: number) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  async function handleStartSending() {
    if (selectedIds.length === 0) {
      toast.error("Selecione pelo menos um cliente");
      return;
    }

    if (!currentMessage.trim()) {
      toast.error("Escreva ou gere uma mensagem antes de disparar");
      return;
    }

    const customersWithPhone = filteredCustomers.filter(
      c => selectedIds.includes(c.id) && c.phone
    );

    if (customersWithPhone.length === 0) {
      toast.error("Nenhum cliente selecionado tem telefone cadastrado");
      return;
    }

    // Register in the database
    await sendMutation.mutateAsync({ campaignId, customerIds: selectedIds });

    toast.success(`Campanha registrada! Abrindo WhatsApp Web para ${customersWithPhone.length} cliente(s)...`);

    // Open first customer immediately
    if (customersWithPhone[0]) {
      const url = buildWhatsAppUrl(customersWithPhone[0].name, customersWithPhone[0].phone!);
      window.open(url, "_blank");
      setSentIds(prev => { const s = new Set(prev); s.add(customersWithPhone[0].id); return s; });
      setSendingIndex(0);
    }
  }

  function handleSendNext() {
    const customersWithPhone = filteredCustomers.filter(
      c => selectedIds.includes(c.id) && c.phone
    );

    const nextIndex = sendingIndex + 1;

    if (nextIndex >= customersWithPhone.length) {
      toast.success("Todos os clientes foram enviados!");
      setSendingIndex(-1);
      refetch();
      return;
    }

    const customer = customersWithPhone[nextIndex];
    const url = buildWhatsAppUrl(customer.name, customer.phone!);
    window.open(url, "_blank");
    setSentIds(prev => { const s = new Set(prev); s.add(customer.id); return s; });
    setSendingIndex(nextIndex);
  }

  const customersWithPhone = filteredCustomers.filter(
    c => selectedIds.includes(c.id) && c.phone
  );
  const isSending = sendingIndex >= 0;

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
          {campaign.discountLabel && (
            <p className="mt-0.5 text-xs font-medium text-green-600">{campaign.discountLabel}</p>
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

      {/* STEP 1: Banner Upload */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ImagePlus className="h-4 w-4 text-primary" />
            <span className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</span>
              Banner / Criativo
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

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
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadBannerMutation.isPending}
                >
                  {uploadBannerMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Trocar banner
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent/30"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadBannerMutation.isPending ? (
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              ) : (
                <Upload className="h-10 w-10 text-muted-foreground/40" />
              )}
              <p className="mt-3 text-sm font-medium text-foreground">
                {uploadBannerMutation.isPending ? "Enviando..." : "Clique para enviar seu banner"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">PNG, JPG ou WebP (máx. 5MB)</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* STEP 2: Message */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4 text-green-600" />
              <span className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[10px] font-bold text-white">2</span>
                Mensagem WhatsApp
              </span>
            </CardTitle>
            <div className="flex gap-2">
              {!editingMessage && campaign.messageTemplate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-8"
                  onClick={() => {
                    setMessageText(campaign.messageTemplate ?? "");
                    setEditingMessage(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Strategy Picker for AI generation */}
          {!editingMessage && (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="gap-2 flex-1"
                  onClick={() => setShowStrategyPicker(!showStrategyPicker)}
                >
                  <Wand2 className="h-4 w-4 text-primary" />
                  Gerar mensagem com IA
                </Button>
                {!campaign.messageTemplate && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      setMessageText("");
                      setEditingMessage(true);
                    }}
                  >
                    <Edit3 className="h-4 w-4" />
                    Escrever manualmente
                  </Button>
                )}
              </div>

              {showStrategyPicker && strategies && (
                <div className="space-y-3 rounded-lg border bg-muted/20 p-3 sm:p-4">
                  <div>
                    <Label className="text-sm font-semibold">Escolha um gatilho mental</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Estratégias usadas por grandes empresas para converter mais vendas
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {strategies.map(strategy => (
                      <button
                        key={strategy.id}
                        onClick={() => {
                          setSelectedStrategyId(strategy.id);
                          handleGenerateMessage(strategy.id);
                        }}
                        disabled={generateMessageMutation.isPending}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all hover:border-primary/50 hover:bg-accent/50 ${
                          generateMessageMutation.isPending && selectedStrategyId === strategy.id
                            ? "border-primary bg-primary/5"
                            : ""
                        }`}
                      >
                        <span className="text-xl shrink-0">{strategy.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{strategy.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{strategy.description}</p>
                        </div>
                        {generateMessageMutation.isPending && selectedStrategyId === strategy.id && (
                          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0 mt-0.5" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs">Instruções extras (opcional)</Label>
                    <Input
                      placeholder="Ex: Mencionar que é só para esta semana, falar do frete grátis..."
                      value={customPrompt}
                      onChange={e => setCustomPrompt(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Message Editor */}
          {editingMessage ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-sm flex items-center gap-2">
                  <Edit3 className="h-3.5 w-3.5" />
                  Edite a mensagem como quiser
                </Label>
                <p className="text-xs text-muted-foreground">
                  Use {"{nome}"} para o nome do cliente e {"{produtos}"} para a lista de produtos. O texto será enviado exatamente como você escrever.
                </p>
              </div>
              <Textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                rows={8}
                className="font-mono text-sm"
                placeholder="Escreva aqui a mensagem que será enviada no WhatsApp..."
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveMessage}
                  disabled={updateMutation.isPending || !messageText.trim()}
                  className="gap-2"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Salvar mensagem
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditingMessage(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : campaign.messageTemplate ? (
            <div className="space-y-2">
              <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-3 sm:p-4 border border-green-200 dark:border-green-800">
                <p className="whitespace-pre-wrap text-sm text-foreground">{campaign.messageTemplate}</p>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Check className="h-3 w-3 text-green-600" />
                Esta é a mensagem que será enviada no WhatsApp (com o nome do cliente substituído automaticamente)
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed py-6 text-center">
              <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhuma mensagem configurada. Use a IA para gerar ou escreva manualmente.
              </p>
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

      {/* STEP 3: Send to Customers */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-blue-600" />
              <span className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">3</span>
                Disparar para Clientes
              </span>
            </CardTitle>
            {!showSendSection && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSendSection(true)}
                className="gap-2"
                disabled={!currentMessage.trim()}
              >
                <Users className="h-3.5 w-3.5" />
                Selecionar clientes
              </Button>
            )}
          </div>
          {!currentMessage.trim() && (
            <p className="text-xs text-amber-600 mt-1">
              Configure a mensagem no passo 2 antes de disparar.
            </p>
          )}
        </CardHeader>

        {showSendSection && (
          <CardContent className="space-y-3">
            {/* Sending Progress */}
            {isSending && (
              <div className="rounded-lg border-green-200 bg-green-50 dark:bg-green-950/20 p-4 border">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                    <Send className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      Enviando... {sendingIndex + 1} de {customersWithPhone.length}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Envie a mensagem no WhatsApp Web e clique em "Próximo cliente"
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {sendingIndex + 1 < customersWithPhone.length ? (
                    <Button onClick={handleSendNext} className="gap-2">
                      <Send className="h-4 w-4" />
                      Próximo cliente ({sendingIndex + 2}/{customersWithPhone.length})
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        toast.success(`${sendingIndex + 1} mensagem(ns) enviada(s)!`);
                        setSendingIndex(-1);
                        refetch();
                      }}
                      className="gap-2"
                    >
                      <Check className="h-4 w-4" />
                      Concluir envio
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      toast.success(`${sendingIndex + 1} mensagem(ns) enviada(s)!`);
                      setSendingIndex(-1);
                      refetch();
                    }}
                  >
                    Finalizar
                  </Button>
                </div>
              </div>
            )}

            {/* Preview of message that will be sent */}
            {currentMessage.trim() && !isSending && (
              <div className="rounded-lg bg-muted/30 p-3 border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Mensagem que será enviada:</p>
                <p className="whitespace-pre-wrap text-xs text-foreground line-clamp-3">{currentMessage}</p>
              </div>
            )}

            {/* Customer selection */}
            {!isSending && (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {selectedIds.length} de {filteredCustomers.length} selecionados
                  </p>
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    {selectAll ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                </div>

                <Input
                  placeholder="Buscar cliente por nome ou telefone..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
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
                  <div className="max-h-60 overflow-y-auto rounded-md border">
                    {filteredCustomers.map(customer => {
                      const isSelected = selectedIds.includes(customer.id);
                      const hasPhone = !!customer.phone;
                      const wasSent = sentIds.has(customer.id);
                      return (
                        <button
                          key={customer.id}
                          onClick={() => toggleCustomer(customer.id)}
                          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 border-b last:border-b-0 ${
                            isSelected ? "bg-primary/5" : ""
                          } ${wasSent ? "bg-green-50 dark:bg-green-950/10" : ""}`}
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
                          {wasSent ? (
                            <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 shrink-0">Enviado</Badge>
                          ) : hasPhone ? (
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
                    {filteredCustomers.filter(c => c.phone).length} cliente(s) com telefone cadastrado
                  </p>
                  <Button
                    onClick={handleStartSending}
                    disabled={sendMutation.isPending || selectedIds.length === 0 || isSending || !currentMessage.trim()}
                    className="gap-2 w-full sm:w-auto"
                    size="lg"
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Disparar via WhatsApp Web ({selectedIds.length})
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Messages Sent History */}
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
                        const url = buildWhatsAppUrl(msg.customerName, msg.customerPhone!);
                        window.open(url, "_blank");
                      }}
                      title="Reenviar no WhatsApp Web"
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
