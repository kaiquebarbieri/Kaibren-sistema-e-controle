import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Instagram,
  Loader2,
  MessageCircle,
  Phone,
  Plug,
  PlugZap,
  Settings as SettingsIcon,
  ShoppingBag,
  ShoppingCart,
  Target,
  Trash2,
  Wifi,
  WifiOff,
  XCircle,
  Clock,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

/* ── Integration definitions ── */

type FieldDef = { key: string; label: string; type?: string; placeholder?: string };

type IntegrationDef = {
  slug: string;
  name: string;
  icon: any;
  category: string;
  fields: FieldDef[];
  extraFields?: FieldDef[];
};

const INTEGRATIONS: IntegrationDef[] = [
  // Marketplaces
  {
    slug: "mercado-livre",
    name: "Mercado Livre",
    icon: ShoppingCart,
    category: "Marketplaces",
    fields: [
      { key: "accessToken", label: "CLIENT_ID", placeholder: "Seu Client ID" },
    ],
    extraFields: [
      { key: "clientSecret", label: "CLIENT_SECRET", placeholder: "Seu Client Secret", type: "password" },
    ],
  },
  {
    slug: "shopee",
    name: "Shopee",
    icon: ShoppingBag,
    category: "Marketplaces",
    fields: [
      { key: "accessToken", label: "PARTNER_ID", placeholder: "Partner ID" },
    ],
    extraFields: [
      { key: "partnerKey", label: "PARTNER_KEY", placeholder: "Partner Key", type: "password" },
      { key: "shopId", label: "SHOP_ID", placeholder: "Shop ID" },
    ],
  },
  {
    slug: "amazon",
    name: "Amazon",
    icon: ShoppingBag,
    category: "Marketplaces",
    fields: [
      { key: "accessToken", label: "ACCESS_KEY", placeholder: "Access Key" },
    ],
    extraFields: [
      { key: "secretKey", label: "SECRET_KEY", placeholder: "Secret Key", type: "password" },
      { key: "marketplaceId", label: "MARKETPLACE_ID", placeholder: "Marketplace ID" },
      { key: "sellerId", label: "SELLER_ID", placeholder: "Seller ID" },
    ],
  },
  // Marketing
  {
    slug: "meta-ads",
    name: "Meta Ads",
    icon: Target,
    category: "Marketing",
    fields: [
      { key: "accessToken", label: "ACCESS_TOKEN", placeholder: "Token de acesso Meta", type: "password" },
      { key: "accountId", label: "AD_ACCOUNT_ID", placeholder: "ID da conta de anúncios (sem act_)" },
    ],
  },
  {
    slug: "instagram-1",
    name: "@kaibren_",
    icon: Instagram,
    category: "Marketing",
    fields: [
      { key: "accessToken", label: "ACCESS_TOKEN", placeholder: "Token de acesso", type: "password" },
      { key: "accountId", label: "USER_ID", placeholder: "ID do usuário" },
    ],
    extraFields: [
      { key: "username", label: "USERNAME", placeholder: "@usuario" },
    ],
  },
  {
    slug: "instagram-2",
    name: "@mundodasofertas.home",
    icon: Instagram,
    category: "Marketing",
    fields: [
      { key: "accessToken", label: "ACCESS_TOKEN", placeholder: "Token de acesso", type: "password" },
      { key: "accountId", label: "USER_ID", placeholder: "ID do usuário" },
    ],
    extraFields: [
      { key: "username", label: "USERNAME", placeholder: "@usuario" },
    ],
  },
  {
    slug: "instagram-3",
    name: "@noah.digital.ia",
    icon: Instagram,
    category: "Marketing",
    fields: [
      { key: "accessToken", label: "ACCESS_TOKEN", placeholder: "Token de acesso", type: "password" },
      { key: "accountId", label: "USER_ID", placeholder: "ID do usuário" },
    ],
    extraFields: [
      { key: "username", label: "USERNAME", placeholder: "@usuario" },
    ],
  },
  // Comunicacao
  {
    slug: "whatsapp",
    name: "WhatsApp Evolution",
    icon: MessageCircle,
    category: "Comunicacao",
    fields: [
      { key: "accessToken", label: "API_KEY", placeholder: "API Key da Evolution", type: "password" },
    ],
    extraFields: [
      { key: "apiUrl", label: "API_URL", placeholder: "https://api.evolution.com" },
      { key: "instance", label: "INSTANCE", placeholder: "Nome da instância" },
    ],
  },
  {
    slug: "whatsapp-kaique",
    name: "WhatsApp Kaique",
    icon: Phone,
    category: "Comunicacao",
    fields: [],
    extraFields: [
      { key: "numero", label: "NUMERO", placeholder: "5511999999999" },
    ],
  },
];

const CATEGORIES = [
  { key: "Marketplaces", label: "Marketplaces", icon: ShoppingCart, description: "Mercado Livre, Shopee, Amazon" },
  { key: "Marketing", label: "Marketing", icon: Target, description: "Meta Ads, Instagram" },
  { key: "Comunicacao", label: "Comunicação", icon: MessageCircle, description: "WhatsApp, notificações" },
  { key: "Sistema", label: "Sistema", icon: SettingsIcon, description: "Horários, configurações gerais" },
];

/* ── Status badge ── */

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "connected":
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Conectado
        </Badge>
      );
    case "error":
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
          <XCircle className="h-3 w-3" />
          Erro
        </Badge>
      );
    case "pending":
    default:
      return (
        <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30 gap-1">
          <WifiOff className="h-3 w-3" />
          Nao configurado
        </Badge>
      );
  }
}

/* ── Integration Card ── */

function IntegrationCard({
  def,
  data,
  onRefetch,
}: {
  def: IntegrationDef;
  data: any | undefined;
  onRefetch: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);

  const upsertMutation = trpc.integrations.upsert.useMutation({
    onSuccess: () => {
      toast.success("Integracao salva com sucesso!");
      onRefetch();
      setFormValues({});
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.integrations.test.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      onRefetch();
      setTesting(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setTesting(false);
    },
  });

  const deleteMutation = trpc.integrations.delete.useMutation({
    onSuccess: () => {
      toast.success("Integracao removida");
      onRefetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const status = data?.status || "pending";
  const Icon = def.icon;

  const allFields = [...def.fields, ...(def.extraFields || [])];

  const handleSave = useCallback(() => {
    const payload: any = {
      slug: def.slug,
      name: def.name,
    };

    // Map fields to the correct payload structure
    const accessTokenField = def.fields.find(f => f.key === "accessToken");
    if (accessTokenField && formValues.accessToken) {
      payload.accessToken = formValues.accessToken;
    }

    const accountIdField = allFields.find(f => f.key === "accountId");
    if (accountIdField && formValues.accountId) {
      payload.accountId = formValues.accountId;
    }

    // Collect extra config from all other fields
    const extraConfig: Record<string, string> = {};
    let hasExtra = false;
    for (const field of allFields) {
      if (field.key !== "accessToken" && field.key !== "accountId" && formValues[field.key]) {
        extraConfig[field.key] = formValues[field.key];
        hasExtra = true;
      }
    }
    if (hasExtra) {
      // Merge with existing extraConfig
      const existing = data?.extraConfig || {};
      payload.extraConfig = { ...existing, ...extraConfig };
    }

    upsertMutation.mutate(payload);
  }, [formValues, def, data]);

  const handleTest = () => {
    setTesting(true);
    testMutation.mutate({ slug: def.slug });
  };

  const handleDisconnect = () => {
    if (confirm("Tem certeza que deseja desconectar esta integracao?")) {
      deleteMutation.mutate({ slug: def.slug });
    }
  };

  return (
    <Card className="bg-zinc-900/60 border-zinc-800 hover:border-[#D4AF37]/30 transition-colors">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700">
              <Icon className="h-5 w-5 text-[#D4AF37]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">{def.name}</h3>
              {data?.lastTestedAt && (
                <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Testado: {new Date(data.lastTestedAt).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-zinc-400 hover:text-[#D4AF37]"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Masked token display */}
        {data?.accessToken && !expanded && (
          <p className="mt-2 text-xs text-zinc-500 font-mono">Token: {data.accessToken}</p>
        )}

        {/* Expanded form */}
        {expanded && (
          <div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
            {allFields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-zinc-400 mb-1">{field.label}</label>
                <Input
                  type={field.type || "text"}
                  placeholder={field.placeholder}
                  value={formValues[field.key] || ""}
                  onChange={(e) => setFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="bg-zinc-800/60 border-zinc-700 text-zinc-200 placeholder:text-zinc-600 text-sm"
                />
                {/* Show current masked value if exists */}
                {field.key === "accessToken" && data?.accessToken && (
                  <p className="mt-1 text-[10px] text-zinc-500 font-mono">Atual: {data.accessToken}</p>
                )}
                {field.key === "accountId" && data?.accountId && (
                  <p className="mt-1 text-[10px] text-zinc-500 font-mono">Atual: {data.accountId}</p>
                )}
                {field.key !== "accessToken" && field.key !== "accountId" && data?.extraConfig?.[field.key] && (
                  <p className="mt-1 text-[10px] text-zinc-500 font-mono">Atual: {data.extraConfig[field.key]}</p>
                )}
              </div>
            ))}

            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                className="bg-[#D4AF37] hover:bg-[#C4A030] text-black font-semibold text-xs"
                onClick={handleSave}
                disabled={upsertMutation.isPending}
              >
                {upsertMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Plug className="h-3 w-3 mr-1" />
                )}
                Salvar
              </Button>

              {data && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:text-[#D4AF37] hover:border-[#D4AF37]/50 text-xs"
                  onClick={handleTest}
                  disabled={testing}
                >
                  {testing ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Wifi className="h-3 w-3 mr-1" />
                  )}
                  Testar conexao
                </Button>
              )}

              {status === "connected" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-800 text-red-400 hover:bg-red-500/10 hover:text-red-300 text-xs"
                  onClick={handleDisconnect}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="h-3 w-3 mr-1" />
                  )}
                  Desconectar
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Integration Health Dashboard ── */

function IntegrationHealth({ integrations: data }: { integrations: any[] }) {
  const connected = data.filter((i: any) => i.status === "connected").length;
  const errors = data.filter((i: any) => i.status === "error").length;
  const pending = data.filter((i: any) => !i.status || i.status === "pending").length;
  const total = INTEGRATIONS.length;
  const withErrors = data.filter((i: any) => i.status === "error" && i.lastError);

  const healthScore = total > 0 ? Math.round((connected / total) * 100) : 0;
  const healthColor = healthScore >= 80 ? "text-emerald-400" : healthScore >= 50 ? "text-yellow-400" : "text-red-400";
  const healthBg = healthScore >= 80 ? "bg-emerald-500/10 border-emerald-500/30" : healthScore >= 50 ? "bg-yellow-500/10 border-yellow-500/30" : "bg-red-500/10 border-red-500/30";

  return (
    <div className="space-y-3">
      {/* Health Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`rounded-xl border p-4 text-center ${healthBg}`}>
          <div className={`text-2xl font-bold ${healthColor}`}>{healthScore}%</div>
          <div className="text-[11px] text-zinc-400 mt-1 uppercase tracking-wider">Saude Geral</div>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{connected}</div>
          <div className="text-[11px] text-zinc-400 mt-1 uppercase tracking-wider">Conectadas</div>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{errors}</div>
          <div className="text-[11px] text-zinc-400 mt-1 uppercase tracking-wider">Com Erro</div>
        </div>
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4 text-center">
          <div className="text-2xl font-bold text-zinc-400">{pending}</div>
          <div className="text-[11px] text-zinc-400 mt-1 uppercase tracking-wider">Pendentes</div>
        </div>
      </div>

      {/* Error Alerts */}
      {withErrors.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-400 text-sm font-semibold">
            <XCircle className="h-4 w-4" />
            Integrações com erro ({withErrors.length})
          </div>
          {withErrors.map((i: any) => {
            const def = INTEGRATIONS.find(d => d.slug === i.slug);
            return (
              <div key={i.slug} className="flex items-center justify-between text-xs bg-red-500/5 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-300 font-medium">{def?.name || i.name}</span>
                  <span className="text-red-400/70">{i.lastError}</span>
                </div>
                {i.lastErrorAt && (
                  <span className="text-zinc-600 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(i.lastErrorAt).toLocaleString("pt-BR")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Last Sync Summary */}
      {data.filter((i: any) => i.lastSyncAt).length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2 font-semibold">Ultimo Sync</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {data.filter((i: any) => i.lastSyncAt).map((i: any) => {
              const def = INTEGRATIONS.find(d => d.slug === i.slug);
              const Icon = def?.icon || Plug;
              const ago = getTimeAgo(i.lastSyncAt);
              return (
                <div key={i.slug} className="flex items-center gap-2 text-xs">
                  <Icon className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="text-zinc-300">{def?.name || i.name}</span>
                  <span className="text-zinc-600 ml-auto">{ago}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeAgo(dateStr: string | Date) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}m atras`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h atras`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d atras`;
}

/* ── System Settings Section ── */

function SystemSettings() {
  const [chargeHour, setChargeHour] = useState("08:00");
  const [alertHour, setAlertHour] = useState("09:00");

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
        <SettingsIcon className="h-5 w-5 text-[#D4AF37]" />
        Sistema
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-4">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Horario cobranca equipe
            </label>
            <p className="text-xs text-zinc-500 mb-3">
              Horario diario para enviar cobranca automatica da equipe via WhatsApp
            </p>
            <Input
              type="time"
              value={chargeHour}
              onChange={(e) => setChargeHour(e.target.value)}
              className="bg-zinc-800/60 border-zinc-700 text-zinc-200 w-32 text-sm"
            />
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-4">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Horario alerta boletos
            </label>
            <p className="text-xs text-zinc-500 mb-3">
              Horario diario para alertas de boletos e contas a vencer
            </p>
            <Input
              type="time"
              value={alertHour}
              onChange={(e) => setAlertHour(e.target.value)}
              className="bg-zinc-800/60 border-zinc-700 text-zinc-200 w-32 text-sm"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── Main Page ── */

export default function Settings() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab && CATEGORIES.some(c => c.key === tab)) return tab;
    }
    return "Marketplaces";
  });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get("provider");
    if (params.get("oauth") === "success") {
      if (provider === "ml") {
        const account = params.get("account") || "";
        toast.success(`Mercado Livre conectado com sucesso! ${account ? `Conta: ${account}` : ""}`);
      } else if (provider === "shopee") {
        const account = params.get("account") || "";
        toast.success(`Shopee conectada com sucesso! ${account ? `Loja: ${account}` : ""}`);
      } else {
        const n = params.get("accounts") || "1";
        toast.success(`${n} conta(s) do Instagram conectada(s) com sucesso!`);
      }
      integrationsQuery.refetch();
      window.history.replaceState({}, "", `${window.location.pathname}?tab=${params.get("tab") || activeTab}`);
    } else if (params.get("oauth") === "error") {
      const reason = params.get("reason");
      if (provider === "ml") {
        toast.error(reason === "invalid_state"
          ? "Link expirado. Tente conectar novamente."
          : `Erro ao conectar Mercado Livre: ${reason || "Tente novamente."}`
        );
      } else if (provider === "shopee") {
        toast.error(
          reason === "partner_key_not_configured"
            ? "Partner Key da Shopee não configurada no servidor."
            : reason === "missing_code_or_shop_id"
            ? "Autorização cancelada ou incompleta."
            : `Erro ao conectar Shopee: ${reason || "Tente novamente."}`
        );
      } else {
        toast.error(
          reason === "no_instagram"
            ? "Nenhuma conta Instagram Business encontrada. Use um perfil profissional."
            : "Erro ao conectar com Meta. Tente novamente."
        );
      }
      window.history.replaceState({}, "", `${window.location.pathname}?tab=${params.get("tab") || activeTab}`);
    }
  }, []);

  const integrationsQuery = trpc.integrations.list.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const integrationData = integrationsQuery.data ?? [];

  const getDataForSlug = (slug: string) => {
    return integrationData.find((i: any) => i.slug === slug);
  };

  // Contar status por categoria
  const getCatStatus = (catKey: string) => {
    const items = INTEGRATIONS.filter(i => i.category === catKey);
    const connected = items.filter(i => getDataForSlug(i.slug)?.status === "connected").length;
    const errors = items.filter(i => getDataForSlug(i.slug)?.status === "error").length;
    return { total: items.length, connected, errors };
  };

  const activeCat = CATEGORIES.find(c => c.key === activeTab) ?? CATEGORIES[0];
  const activeItems = INTEGRATIONS.filter(i => i.category === activeTab);

  return (
    <DashboardLayout activeSection="configuracoes">
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-[#D4AF37]" />
            Configurações
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Gerencie integrações, APIs e configurações do sistema
          </p>
        </div>

        {/* Integration Health Dashboard */}
        <IntegrationHealth integrations={integrationData} />

        {/* Sub-menu de categorias */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CATEGORIES.map(cat => {
            const CatIcon = cat.icon;
            const isActive = activeTab === cat.key;
            const status = getCatStatus(cat.key);
            return (
              <button
                key={cat.key}
                onClick={() => setActiveTab(cat.key)}
                className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all ${
                  isActive
                    ? "border-[#D4AF37]/50 bg-[#D4AF37]/5 shadow-lg shadow-[#D4AF37]/5"
                    : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${isActive ? "bg-[#D4AF37]/20" : "bg-zinc-800"}`}>
                    <CatIcon className={`h-4 w-4 ${isActive ? "text-[#D4AF37]" : "text-zinc-400"}`} />
                  </div>
                  {status.connected > 0 && (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                      {status.connected}/{status.total}
                    </span>
                  )}
                  {status.errors > 0 && (
                    <span className="inline-flex items-center rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                      {status.errors} erro
                    </span>
                  )}
                </div>
                <div>
                  <div className={`text-sm font-semibold ${isActive ? "text-[#D4AF37]" : "text-zinc-200"}`}>
                    {cat.label}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{cat.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Conteúdo da aba ativa */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <activeCat.icon className="h-5 w-5 text-[#D4AF37]" />
            <h2 className="text-lg font-bold text-zinc-100">{activeCat.label}</h2>
            <span className="text-xs text-zinc-500">{activeCat.description}</span>
          </div>

          {activeTab === "Sistema" ? (
            <SystemSettings />
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {activeTab === "Marketplaces" && (
                <>
                  <div className="mb-1 flex items-center gap-3 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/5 p-4">
                    <ShoppingCart className="h-5 w-5 text-[#D4AF37]" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-100">Conectar conta do Mercado Livre</p>
                      <p className="text-xs text-zinc-400">Faça login na sua conta e a conexão será feita automaticamente</p>
                    </div>
                    <Button
                      variant="outline"
                      className="border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                      onClick={() => { window.location.href = "/api/ml/oauth/start"; }}
                    >
                      <PlugZap className="mr-2 h-4 w-4" /> Conectar Mercado Livre
                    </Button>
                  </div>
                  <div className="mb-1 flex items-center gap-3 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/5 p-4">
                    <ShoppingBag className="h-5 w-5 text-[#D4AF37]" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-100">Conectar loja Shopee</p>
                      <p className="text-xs text-zinc-400">Autorize uma loja por vez. Cada shop_id vira uma conexão independente.</p>
                    </div>
                    <Button
                      variant="outline"
                      className="border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                      onClick={() => { window.location.href = "/api/shopee/oauth/start"; }}
                    >
                      <PlugZap className="mr-2 h-4 w-4" /> Conectar Shopee
                    </Button>
                  </div>
                </>
              )}
              {activeTab === "Marketing" && (
                <div className="mb-1 flex items-center gap-3 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/5 p-4">
                  <Instagram className="h-5 w-5 text-[#D4AF37]" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-100">Conectar Instagram e Facebook via Meta</p>
                    <p className="text-xs text-zinc-400">Autorize uma vez e todas as contas vinculadas serão importadas automaticamente</p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                    onClick={() => { window.location.href = "/api/meta/oauth/start"; }}
                  >
                    <PlugZap className="mr-2 h-4 w-4" /> Conectar com Meta
                  </Button>
                </div>
              )}
              {activeItems.map(def => (
                <IntegrationCard
                  key={def.slug}
                  def={def}
                  data={getDataForSlug(def.slug)}
                  onRefetch={() => integrationsQuery.refetch()}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
