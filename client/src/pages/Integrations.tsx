import DashboardLayout from "@/components/DashboardLayout";
import { BrandIcon } from "@/components/BrandIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  Plug,
  Trash2,
  Wifi,
  XCircle,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

/* ── Tipos e catálogo ── */

type IntegrationStatus = "active" | "available" | "beta" | "coming-soon";
type IntegrationCategory =
  | "marketplace"
  | "erp"
  | "marketing"
  | "comunicacao"
  | "ecommerce";

type FieldDef = {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
};

type IntegrationDef = {
  slug: string;
  name: string;
  category: IntegrationCategory;
  categoryLabel: string;
  status: IntegrationStatus;
  oauthStartUrl?: string;
  fields?: FieldDef[];
  extraFields?: FieldDef[];
};

const CATALOG: IntegrationDef[] = [
  // Marketplaces
  {
    slug: "mercado-livre",
    name: "Mercado Livre",
    category: "marketplace",
    categoryLabel: "Marketplace",
    status: "available",
    oauthStartUrl: "/api/ml/oauth/start",
    fields: [{ key: "accessToken", label: "CLIENT_ID", placeholder: "Seu Client ID" }],
    extraFields: [
      { key: "clientSecret", label: "CLIENT_SECRET", placeholder: "Client Secret", type: "password" },
    ],
  },
  {
    slug: "shopee",
    name: "Shopee",
    category: "marketplace",
    categoryLabel: "Marketplace",
    status: "available",
    oauthStartUrl: "/api/shopee/oauth/start",
    fields: [{ key: "accessToken", label: "PARTNER_ID", placeholder: "Partner ID" }],
    extraFields: [
      { key: "partnerKey", label: "PARTNER_KEY", placeholder: "Partner Key", type: "password" },
      { key: "shopId", label: "SHOP_ID", placeholder: "Shop ID" },
    ],
  },
  {
    slug: "amazon",
    name: "Amazon",
    category: "marketplace",
    categoryLabel: "Marketplace",
    status: "available",
    fields: [{ key: "accessToken", label: "ACCESS_KEY", placeholder: "Access Key" }],
    extraFields: [
      { key: "secretKey", label: "SECRET_KEY", placeholder: "Secret Key", type: "password" },
      { key: "marketplaceId", label: "MARKETPLACE_ID", placeholder: "Marketplace ID" },
      { key: "sellerId", label: "SELLER_ID", placeholder: "Seller ID" },
    ],
  },
  {
    slug: "tiktok-shop",
    name: "TikTok Shop",
    category: "marketplace",
    categoryLabel: "Marketplace",
    status: "coming-soon",
  },
  {
    slug: "magalu",
    name: "Magalu",
    category: "marketplace",
    categoryLabel: "Marketplace",
    status: "coming-soon",
  },
  {
    slug: "americanas",
    name: "Americanas",
    category: "marketplace",
    categoryLabel: "Marketplace",
    status: "coming-soon",
  },

  // ERPs
  {
    slug: "bling",
    name: "Bling",
    category: "erp",
    categoryLabel: "ERP",
    status: "available",
    fields: [{ key: "accessToken", label: "API_KEY", placeholder: "API Key do Bling", type: "password" }],
  },
  {
    slug: "tiny",
    name: "Tiny",
    category: "erp",
    categoryLabel: "ERP",
    status: "beta",
    fields: [{ key: "accessToken", label: "API_TOKEN", placeholder: "Token do Tiny", type: "password" }],
  },
  {
    slug: "omie",
    name: "Omie",
    category: "erp",
    categoryLabel: "ERP",
    status: "coming-soon",
  },

  // Marketing
  {
    slug: "meta-ads",
    name: "Meta Ads",
    category: "marketing",
    categoryLabel: "Marketing",
    status: "available",
    oauthStartUrl: "/api/meta/oauth/start",
    fields: [
      { key: "accessToken", label: "ACCESS_TOKEN", placeholder: "Token Meta", type: "password" },
      { key: "accountId", label: "AD_ACCOUNT_ID", placeholder: "ID da conta (sem act_)" },
    ],
  },
  {
    slug: "instagram-1",
    name: "@kaibren_",
    category: "marketing",
    categoryLabel: "Instagram",
    status: "available",
    oauthStartUrl: "/api/meta/oauth/start",
    fields: [
      { key: "accessToken", label: "ACCESS_TOKEN", placeholder: "Token", type: "password" },
      { key: "accountId", label: "USER_ID", placeholder: "ID do usuário" },
    ],
    extraFields: [{ key: "username", label: "USERNAME", placeholder: "@usuario" }],
  },
  {
    slug: "instagram-2",
    name: "@mundodasofertas.home",
    category: "marketing",
    categoryLabel: "Instagram",
    status: "available",
    oauthStartUrl: "/api/meta/oauth/start",
    fields: [
      { key: "accessToken", label: "ACCESS_TOKEN", placeholder: "Token", type: "password" },
      { key: "accountId", label: "USER_ID", placeholder: "ID do usuário" },
    ],
    extraFields: [{ key: "username", label: "USERNAME", placeholder: "@usuario" }],
  },
  {
    slug: "instagram-3",
    name: "@noah.digital.ia",
    category: "marketing",
    categoryLabel: "Instagram",
    status: "available",
    oauthStartUrl: "/api/meta/oauth/start",
    fields: [
      { key: "accessToken", label: "ACCESS_TOKEN", placeholder: "Token", type: "password" },
      { key: "accountId", label: "USER_ID", placeholder: "ID do usuário" },
    ],
    extraFields: [{ key: "username", label: "USERNAME", placeholder: "@usuario" }],
  },

  // Comunicação
  {
    slug: "whatsapp",
    name: "WhatsApp Evolution",
    category: "comunicacao",
    categoryLabel: "Comunicação",
    status: "available",
    fields: [
      { key: "accessToken", label: "API_KEY", placeholder: "API Key Evolution", type: "password" },
    ],
    extraFields: [
      { key: "apiUrl", label: "API_URL", placeholder: "https://api.evolution.com" },
      { key: "instance", label: "INSTANCE", placeholder: "Nome da instância" },
    ],
  },
  {
    slug: "telegram",
    name: "Telegram",
    category: "comunicacao",
    categoryLabel: "Comunicação",
    status: "beta",
    fields: [{ key: "accessToken", label: "BOT_TOKEN", placeholder: "Token do bot", type: "password" }],
    extraFields: [{ key: "chatId", label: "CHAT_ID", placeholder: "-1003709407203" }],
  },

  // E-commerce (roadmap futuro)
  {
    slug: "shopify",
    name: "Shopify",
    category: "ecommerce",
    categoryLabel: "E-commerce",
    status: "coming-soon",
  },
  {
    slug: "nuvemshop",
    name: "NuvemShop",
    category: "ecommerce",
    categoryLabel: "E-commerce",
    status: "coming-soon",
  },
];

/* ── Status badges ── */

function ActiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
      <CheckCircle2 className="h-3 w-3" />
      Ativa
    </span>
  );
}

function ErrorBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-red-500/30 bg-red-500/10 text-red-400">
      <XCircle className="h-3 w-3" />
      Erro
    </span>
  );
}

function BetaBadge() {
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20">
      BETA
    </span>
  );
}

function ComingSoonBadge() {
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
      Em breve
    </span>
  );
}

/* ── Formulário de edição (modal) ── */

function EditDialog({
  def,
  data,
  open,
  onOpenChange,
  onRefetch,
}: {
  def: IntegrationDef;
  data: any | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefetch: () => void;
}) {
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);

  const upsertMutation = trpc.integrations.upsert.useMutation({
    onSuccess: () => {
      toast.success("Integração salva!");
      onRefetch();
      setFormValues({});
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.integrations.test.useMutation({
    onSuccess: (result) => {
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
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
      toast.success("Integração removida");
      onRefetch();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const cnpjsQuery = trpc.myCnpjs.list.useQuery();
  const linkCompanyMutation = trpc.integrations.linkCompany.useMutation({
    onSuccess: () => {
      toast.success("Empresa vinculada!");
      onRefetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const currentCnpjId = data?.cnpjId ?? null;
  const handleLinkCompany = (value: string) => {
    const cnpjId = value === "none" ? null : parseInt(value, 10);
    linkCompanyMutation.mutate({ slug: def.slug, cnpjId });
  };

  const allFields = [...(def.fields || []), ...(def.extraFields || [])];
  const status = data?.status || "pending";

  const handleSave = useCallback(() => {
    const payload: any = { slug: def.slug, name: def.name };
    if (formValues.accessToken) payload.accessToken = formValues.accessToken;
    if (formValues.accountId) payload.accountId = formValues.accountId;
    const extraConfig: Record<string, string> = {};
    let hasExtra = false;
    for (const f of allFields) {
      if (f.key !== "accessToken" && f.key !== "accountId" && formValues[f.key]) {
        extraConfig[f.key] = formValues[f.key];
        hasExtra = true;
      }
    }
    if (hasExtra) {
      const existing = data?.extraConfig || {};
      payload.extraConfig = { ...existing, ...extraConfig };
    }
    upsertMutation.mutate(payload);
  }, [formValues, def, data, allFields, upsertMutation]);

  const handleTest = () => {
    setTesting(true);
    testMutation.mutate({ slug: def.slug });
  };

  const handleDisconnect = () => {
    if (confirm(`Desconectar ${def.name}?`)) deleteMutation.mutate({ slug: def.slug });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <BrandIcon slug={def.slug} className="w-10 h-10" />
            <div>
              <div className="text-base font-semibold">{def.name}</div>
              <div className="text-xs text-zinc-400 font-normal">{def.categoryLabel}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {def.oauthStartUrl && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
            <Plug className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-zinc-100">Conectar via OAuth</p>
              <p className="text-[11px] text-zinc-400">Login seguro, sem copiar tokens manualmente</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => {
                window.location.href = def.oauthStartUrl!;
              }}
            >
              Conectar
            </Button>
          </div>
        )}

        {allFields.length > 0 && (
          <div className="space-y-3 pt-1">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
              Configuração manual
            </p>
            {allFields.map((field) => (
              <div key={field.key}>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  {field.label}
                </label>
                <Input
                  type={field.type || "text"}
                  placeholder={field.placeholder}
                  value={formValues[field.key] || ""}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="bg-zinc-800/60 border-zinc-700 text-zinc-200 placeholder:text-zinc-600 text-sm"
                />
                {field.key === "accessToken" && data?.accessToken && (
                  <p className="mt-1 text-[10px] text-zinc-500 font-mono">Atual: {data.accessToken}</p>
                )}
                {field.key === "accountId" && data?.accountId && (
                  <p className="mt-1 text-[10px] text-zinc-500 font-mono">Atual: {data.accountId}</p>
                )}
                {field.key !== "accessToken" &&
                  field.key !== "accountId" &&
                  data?.extraConfig?.[field.key] && (
                    <p className="mt-1 text-[10px] text-zinc-500 font-mono">
                      Atual: {data.extraConfig[field.key]}
                    </p>
                  )}
              </div>
            ))}
          </div>
        )}

        {data && (
          <div className="pt-3 border-t border-zinc-800/60">
            <label className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
              <Building2 className="h-3 w-3" />
              Empresa emissora (CNPJ)
            </label>
            <Select
              value={currentCnpjId ? String(currentCnpjId) : "none"}
              onValueChange={handleLinkCompany}
              disabled={linkCompanyMutation.isPending}
            >
              <SelectTrigger className="bg-zinc-800/60 border-zinc-700 text-zinc-200 text-sm">
                <SelectValue placeholder="Nenhuma empresa vinculada" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-200">
                <SelectItem value="none">Nenhuma</SelectItem>
                {(cnpjsQuery.data ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nomeFantasia || c.razaoSocial}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-zinc-500 mt-1">
              Define qual empresa emite as vendas desta integração (usado no DRE).
            </p>
          </div>
        )}

        {data?.lastTestedAt && (
          <p className="text-[10px] text-zinc-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Último teste: {new Date(data.lastTestedAt).toLocaleString("pt-BR")}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {status === "connected" && (
            <Button
              size="sm"
              variant="outline"
              className="border-red-800/60 text-red-400 hover:bg-red-500/10"
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
          {data && (
            <Button
              size="sm"
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:text-primary hover:border-primary/50"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Wifi className="h-3 w-3 mr-1" />
              )}
              Testar
            </Button>
          )}
          {allFields.length > 0 && (
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-black font-semibold"
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
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Cards ── */

function ActiveCard({
  def,
  data,
  onEdit,
  onDelete,
}: {
  def: IntegrationDef;
  data: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const hasError = data?.status === "error";
  return (
    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-primary/30 transition-colors flex items-start gap-3 group">
      <BrandIcon slug={def.slug} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-100 mb-1 truncate">{def.name}</p>
        <div className="mb-2">{hasError ? <ErrorBadge /> : <ActiveBadge />}</div>
        <button
          onClick={onEdit}
          className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          Editar
        </button>
      </div>
      <button
        onClick={onDelete}
        className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Desconectar"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function AvailableCard({ def, onAction }: { def: IntegrationDef; onAction: () => void }) {
  return (
    <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 hover:border-primary/30 transition-colors flex items-start gap-3">
      <BrandIcon slug={def.slug} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1 gap-2">
          <p className="text-sm font-medium text-zinc-100 truncate">{def.name}</p>
          {def.status === "beta" && <BetaBadge />}
        </div>
        <p className="text-xs text-zinc-500 mb-2">{def.categoryLabel}</p>
        <button
          onClick={onAction}
          className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          Integrar
        </button>
      </div>
    </div>
  );
}

function ComingSoonCard({ def }: { def: IntegrationDef }) {
  return (
    <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50 flex items-start gap-3 opacity-60">
      <BrandIcon slug={def.slug} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1 gap-2">
          <p className="text-sm font-medium text-zinc-300 truncate">{def.name}</p>
          <ComingSoonBadge />
        </div>
        <p className="text-xs text-zinc-500">{def.categoryLabel}</p>
      </div>
    </div>
  );
}

/* ── Seções ── */

type Section = {
  title: string;
  subtitle?: string;
  defs: IntegrationDef[];
};

function SectionBlock({
  section,
  data,
  onSelect,
  highlight,
}: {
  section: Section;
  data: any[];
  onSelect: (def: IntegrationDef) => void;
  highlight?: boolean;
}) {
  if (section.defs.length === 0) return null;

  const getData = (slug: string) => data.find((i) => i.slug === slug);
  const activeCount = section.defs.filter((d) => getData(d.slug)?.status === "connected").length;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h2
          className={`text-base sm:text-lg font-semibold ${
            highlight ? "text-primary" : "text-zinc-100"
          }`}
        >
          {section.title}
        </h2>
        {activeCount > 0 && (
          <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-[10px] font-medium">
            {activeCount}/{section.defs.length} conectadas
          </span>
        )}
      </div>
      {section.subtitle && <p className="text-sm text-zinc-500 -mt-3 mb-4">{section.subtitle}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {section.defs.map((def) => {
          const d = getData(def.slug);
          const isConnected = d?.status === "connected" || d?.status === "error";

          if (isConnected) {
            return (
              <ActiveCard
                key={def.slug}
                def={def}
                data={d}
                onEdit={() => onSelect(def)}
                onDelete={() => onSelect(def)}
              />
            );
          }
          if (def.status === "coming-soon") {
            return <ComingSoonCard key={def.slug} def={def} />;
          }
          return <AvailableCard key={def.slug} def={def} onAction={() => onSelect(def)} />;
        })}
      </div>
    </div>
  );
}

/* ── Página principal ── */

export default function Integrations() {
  const [selected, setSelected] = useState<IntegrationDef | null>(null);
  const integrationsQuery = trpc.integrations.list.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const data = integrationsQuery.data ?? [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    if (!oauth) return;
    const provider = params.get("provider");
    if (oauth === "success") {
      if (provider === "ml") {
        const account = params.get("account") || "";
        toast.success(`Mercado Livre conectado! ${account ? `Conta: ${account}` : ""}`);
      } else if (provider === "shopee") {
        const account = params.get("account") || "";
        toast.success(`Shopee conectada! ${account ? `Loja: ${account}` : ""}`);
      } else {
        const n = params.get("accounts") || "1";
        toast.success(`${n} conta(s) do Instagram/Meta conectada(s)!`);
      }
      integrationsQuery.refetch();
    } else if (oauth === "error") {
      const reason = params.get("reason");
      const label = provider === "ml" ? "Mercado Livre" : provider === "shopee" ? "Shopee" : "Meta";
      toast.error(`Erro ao conectar ${label}: ${reason || "tente novamente"}`);
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const getData = (slug: string) => data.find((i: any) => i.slug === slug);

  // Classificação dinâmica: uma integração vai para "minhas" se tem status connected/error
  const isMine = (def: IntegrationDef) => {
    const d = getData(def.slug);
    return d?.status === "connected" || d?.status === "error";
  };

  const myMarketplaces = CATALOG.filter((d) => d.category === "marketplace" && isMine(d));
  const myErps = CATALOG.filter((d) => d.category === "erp" && isMine(d));
  const myMarketing = CATALOG.filter(
    (d) => (d.category === "marketing" || d.category === "comunicacao") && isMine(d),
  );

  const availableMarketplaces = CATALOG.filter(
    (d) => d.category === "marketplace" && !isMine(d) && d.status !== "coming-soon",
  );
  const availableErps = CATALOG.filter(
    (d) => d.category === "erp" && !isMine(d) && d.status !== "coming-soon",
  );
  const availableMarketing = CATALOG.filter(
    (d) =>
      (d.category === "marketing" || d.category === "comunicacao") &&
      !isMine(d) &&
      d.status !== "coming-soon",
  );

  const comingSoon = CATALOG.filter((d) => d.status === "coming-soon");

  const totalConnected = data.filter((i: any) => i.status === "connected").length;
  const totalErrors = data.filter((i: any) => i.status === "error").length;

  return (
    <DashboardLayout activeSection="integracoes">
      <div className="flex flex-col gap-6">
        {/* Cabeçalho hero */}
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-6 flex items-start gap-4">
          <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 shrink-0">
            <ArrowRightLeft className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">Integrações</h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Expanda suas possibilidades. Conecte marketplaces, ERPs e canais de marketing para
              centralizar a operação da Kaibren em um só lugar.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {totalConnected} conectadas
              </span>
              {totalErrors > 0 && (
                <span className="px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                  {totalErrors} com erro
                </span>
              )}
              <span className="px-2 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                {CATALOG.length} disponíveis no catálogo
              </span>
            </div>
          </div>
        </div>

        {/* Minhas integrações ativas */}
        <SectionBlock
          section={{ title: "Meus Marketplaces", defs: myMarketplaces }}
          data={data}
          onSelect={setSelected}
        />
        <SectionBlock
          section={{ title: "Meus ERPs", defs: myErps }}
          data={data}
          onSelect={setSelected}
        />
        <SectionBlock
          section={{ title: "Marketing & Comunicação", defs: myMarketing }}
          data={data}
          onSelect={setSelected}
        />

        {/* Catálogo */}
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-primary mb-1">
            Integrações disponíveis
          </p>
          <h2 className="text-xl sm:text-2xl text-zinc-100 font-semibold mb-6">
            Precisando de mais conexões?
          </h2>

          <SectionBlock
            section={{ title: "Marketplaces", defs: availableMarketplaces }}
            data={data}
            onSelect={setSelected}
          />
          <SectionBlock
            section={{ title: "ERPs", defs: availableErps }}
            data={data}
            onSelect={setSelected}
          />
          <SectionBlock
            section={{ title: "Marketing & Comunicação", defs: availableMarketing }}
            data={data}
            onSelect={setSelected}
          />
          <SectionBlock
            section={{ title: "Em breve", defs: comingSoon }}
            data={data}
            onSelect={setSelected}
          />
        </div>

        {selected && (
          <EditDialog
            def={selected}
            data={getData(selected.slug)}
            open={!!selected}
            onOpenChange={(open) => !open && setSelected(null)}
            onRefetch={() => integrationsQuery.refetch()}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
