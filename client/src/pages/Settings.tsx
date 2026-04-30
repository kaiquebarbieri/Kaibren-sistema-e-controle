import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Building2,
  Calculator,
  Loader2,
  Percent,
  Pencil,
  Plus,
  Save,
  Search,
  Settings as SettingsIcon,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Warehouse,
  Star,
  StarOff,
  XCircle,
} from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";

const CATEGORIES = [
  { key: "Empresas", label: "Empresas", icon: Building2, description: "CNPJs, regime tributário e UF de origem" },
  { key: "Taxas", label: "Taxas", icon: Percent, description: "Comissões ML e Shopee — base do DRE" },
  { key: "Depositos", label: "Depósitos", icon: Warehouse, description: "Armazéns, estoque mínimo e multi-warehouse" },
  { key: "Sistema", label: "Sistema", icon: SettingsIcon, description: "Horários e preferências" },
];

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const REGIMES = [
  { value: "mei", label: "MEI", tooltip: "Microempreendedor Individual" },
  { value: "simples", label: "Simples Nacional", tooltip: "Anexo I (comércio) — 6 faixas" },
  { value: "presumido", label: "Lucro Presumido", tooltip: "Presunção 8% (comércio)" },
  { value: "real", label: "Lucro Real", tooltip: "Apuração efetiva + créditos PIS/COFINS" },
] as const;

type RegimeValue = typeof REGIMES[number]["value"];

type CompanyForm = {
  razaoSocial: string;
  cnpj: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  regime: RegimeValue | "";
  ufOrigem: string;
  cnaePrincipal: string;
  dataInicioRegime: string;
  notes: string;
};

function emptyCompanyForm(): CompanyForm {
  return {
    razaoSocial: "",
    cnpj: "",
    nomeFantasia: "",
    inscricaoEstadual: "",
    inscricaoMunicipal: "",
    regime: "",
    ufOrigem: "",
    cnaePrincipal: "",
    dataInicioRegime: "",
    notes: "",
  };
}

function formatCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function regimeBadgeColor(regime: string | null | undefined) {
  switch (regime) {
    case "mei": return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    case "simples": return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "presumido": return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "real": return "bg-purple-500/15 text-purple-300 border-purple-500/30";
    default: return "bg-zinc-700/40 text-zinc-400 border-zinc-600/40";
  }
}

const EXCEPTION_TYPES = [
  { value: "icms_interestadual", label: "ICMS interestadual" },
  { value: "difal", label: "DIFAL (consumidor final)" },
  { value: "st", label: "Substituição Tributária" },
  { value: "produto", label: "Produto específico (NCM/SKU)" },
  { value: "outro", label: "Outro" },
] as const;

type ExceptionType = typeof EXCEPTION_TYPES[number]["value"];

const MONTH_LABELS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function CompanyTaxDialog({
  cnpj,
  open,
  onOpenChange,
}: {
  cnpj: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const ratesQuery = trpc.companyTaxes.listRates.useQuery({ cnpjId: cnpj.id }, { enabled: open });
  const exceptionsQuery = trpc.companyTaxes.listExceptions.useQuery({ cnpjId: cnpj.id }, { enabled: open });

  const [rateForm, setRateForm] = useState({
    month: new Date().getMonth() + 1,
    effectiveRate: "",
    icmsRate: "",
    rbt12: "",
    notes: "",
  });

  const [excForm, setExcForm] = useState({
    exceptionType: "icms_interestadual" as ExceptionType,
    ufDestino: "",
    productRef: "",
    rate: "",
    validFrom: new Date().toISOString().slice(0, 10),
    validUntil: "",
    notes: "",
  });

  const upsertRate = trpc.companyTaxes.upsertRate.useMutation({
    onSuccess: () => {
      toast.success("Alíquota salva");
      setRateForm({ month: new Date().getMonth() + 1, effectiveRate: "", icmsRate: "", rbt12: "", notes: "" });
      utils.companyTaxes.listRates.invalidate({ cnpjId: cnpj.id });
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteRate = trpc.companyTaxes.deleteRate.useMutation({
    onSuccess: () => {
      toast.success("Alíquota removida");
      utils.companyTaxes.listRates.invalidate({ cnpjId: cnpj.id });
    },
    onError: (err) => toast.error(err.message),
  });
  const createException = trpc.companyTaxes.createException.useMutation({
    onSuccess: () => {
      toast.success("Exceção cadastrada");
      setExcForm({ exceptionType: "icms_interestadual", ufDestino: "", productRef: "", rate: "", validFrom: new Date().toISOString().slice(0, 10), validUntil: "", notes: "" });
      utils.companyTaxes.listExceptions.invalidate({ cnpjId: cnpj.id });
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteException = trpc.companyTaxes.deleteException.useMutation({
    onSuccess: () => {
      toast.success("Exceção removida");
      utils.companyTaxes.listExceptions.invalidate({ cnpjId: cnpj.id });
    },
    onError: (err) => toast.error(err.message),
  });

  const ratesByYear = (ratesQuery.data ?? []).filter((r: any) => r.year === year);
  const rateByMonth = new Map<number, any>();
  for (const r of ratesByYear) rateByMonth.set(r.month, r);

  const handleSaveRate = () => {
    if (!rateForm.effectiveRate) {
      toast.error("Informe a alíquota efetiva.");
      return;
    }
    upsertRate.mutate({
      cnpjId: cnpj.id,
      year,
      month: rateForm.month,
      effectiveRate: rateForm.effectiveRate,
      icmsRate: rateForm.icmsRate || null,
      rbt12: rateForm.rbt12 || null,
      notes: rateForm.notes || null,
    });
  };

  const handleCreateException = () => {
    if (!excForm.rate) {
      toast.error("Informe a alíquota.");
      return;
    }
    createException.mutate({
      cnpjId: cnpj.id,
      exceptionType: excForm.exceptionType,
      ufDestino: excForm.ufDestino || null,
      productRef: excForm.productRef || null,
      rate: excForm.rate,
      validFrom: excForm.validFrom,
      validUntil: excForm.validUntil || null,
      notes: excForm.notes || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-[#D4AF37]" />
            Alíquotas — {cnpj.nomeFantasia || cnpj.razaoSocial}
          </DialogTitle>
        </DialogHeader>

        {/* Bloco alíquotas mensais */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">Alíquotas por mês</h3>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-zinc-400">Ano</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
                className="bg-zinc-800/60 border-zinc-700 text-zinc-200 w-24 h-8 text-sm"
              />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-zinc-900/60">
                <tr className="text-left text-zinc-400 uppercase tracking-wider">
                  <th className="p-2">Mês</th>
                  <th className="p-2 text-right">Efetiva %</th>
                  <th className="p-2 text-right">ICMS %</th>
                  <th className="p-2 text-right">RBT12</th>
                  <th className="p-2">Obs.</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {MONTH_LABELS.map((label, idx) => {
                  const m = idx + 1;
                  const row = rateByMonth.get(m);
                  return (
                    <tr key={m} className="border-t border-zinc-800/60">
                      <td className="p-2 text-zinc-300">{label}</td>
                      <td className="p-2 text-right font-mono text-zinc-200">
                        {row ? `${Number(row.effectiveRate).toFixed(2)}%` : "—"}
                      </td>
                      <td className="p-2 text-right font-mono text-zinc-400">
                        {row?.icmsRate ? `${Number(row.icmsRate).toFixed(2)}%` : "—"}
                      </td>
                      <td className="p-2 text-right font-mono text-zinc-400">
                        {row?.rbt12 ? `R$ ${Number(row.rbt12).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className="p-2 text-zinc-500 max-w-[200px] truncate">{row?.notes || "—"}</td>
                      <td className="p-2 text-right">
                        {row && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-red-400 hover:bg-red-500/10"
                            onClick={() => deleteRate.mutate({ id: row.id })}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardContent className="p-3 space-y-3">
              <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Lançar / atualizar mês</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <Label className="text-[10px] text-zinc-400">Mês</Label>
                  <Select
                    value={String(rateForm.month)}
                    onValueChange={(v) => setRateForm(p => ({ ...p, month: parseInt(v, 10) }))}
                  >
                    <SelectTrigger className="bg-zinc-800/60 border-zinc-700 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-200">
                      {MONTH_LABELS.map((l, i) => (
                        <SelectItem key={i} value={String(i + 1)}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-zinc-400">Efetiva %</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={rateForm.effectiveRate}
                    onChange={(e) => setRateForm(p => ({ ...p, effectiveRate: e.target.value }))}
                    className="bg-zinc-800/60 border-zinc-700 text-zinc-200 h-8 text-xs"
                    placeholder="8.500"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-zinc-400">ICMS %</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={rateForm.icmsRate}
                    onChange={(e) => setRateForm(p => ({ ...p, icmsRate: e.target.value }))}
                    className="bg-zinc-800/60 border-zinc-700 text-zinc-200 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-zinc-400">RBT12</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={rateForm.rbt12}
                    onChange={(e) => setRateForm(p => ({ ...p, rbt12: e.target.value }))}
                    className="bg-zinc-800/60 border-zinc-700 text-zinc-200 h-8 text-xs"
                    placeholder="receita 12m"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    size="sm"
                    className="gap-1.5 h-8 w-full bg-[#D4AF37] text-zinc-950 hover:bg-[#D4AF37]/90"
                    onClick={handleSaveRate}
                    disabled={upsertRate.isPending}
                  >
                    {upsertRate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Salvar
                  </Button>
                </div>
              </div>
              <Input
                value={rateForm.notes}
                onChange={(e) => setRateForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Observação (opcional)"
                className="bg-zinc-800/60 border-zinc-700 text-zinc-200 h-8 text-xs"
              />
            </CardContent>
          </Card>
        </section>

        {/* Bloco exceções */}
        <section className="space-y-3 pt-4 border-t border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-100">Exceções (ICMS/DIFAL/ST/Produto)</h3>

          {(exceptionsQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-zinc-500 italic">Nenhuma exceção cadastrada.</p>
          ) : (
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-zinc-900/60">
                  <tr className="text-left text-zinc-400 uppercase tracking-wider">
                    <th className="p-2">Tipo</th>
                    <th className="p-2">UF</th>
                    <th className="p-2">NCM/SKU</th>
                    <th className="p-2 text-right">Alíquota</th>
                    <th className="p-2">Vigência</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {(exceptionsQuery.data ?? []).map((e: any) => (
                    <tr key={e.id} className="border-t border-zinc-800/60">
                      <td className="p-2 text-zinc-300">
                        {EXCEPTION_TYPES.find(t => t.value === e.exceptionType)?.label ?? e.exceptionType}
                      </td>
                      <td className="p-2 text-zinc-400">{e.ufDestino || "—"}</td>
                      <td className="p-2 font-mono text-zinc-400">{e.productRef || "—"}</td>
                      <td className="p-2 text-right font-mono text-zinc-200">{Number(e.rate).toFixed(3)}%</td>
                      <td className="p-2 text-zinc-500">
                        {e.validFrom}{e.validUntil ? ` → ${e.validUntil}` : " → vigente"}
                      </td>
                      <td className="p-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-red-400 hover:bg-red-500/10"
                          onClick={() => deleteException.mutate({ id: e.id })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardContent className="p-3 space-y-3">
              <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Nova exceção</p>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <div className="col-span-2">
                  <Label className="text-[10px] text-zinc-400">Tipo</Label>
                  <Select
                    value={excForm.exceptionType}
                    onValueChange={(v) => setExcForm(p => ({ ...p, exceptionType: v as ExceptionType }))}
                  >
                    <SelectTrigger className="bg-zinc-800/60 border-zinc-700 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-200">
                      {EXCEPTION_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-zinc-400">UF</Label>
                  <Select
                    value={excForm.ufDestino || "none"}
                    onValueChange={(v) => setExcForm(p => ({ ...p, ufDestino: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger className="bg-zinc-800/60 border-zinc-700 h-8 text-xs">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-200 max-h-64">
                      <SelectItem value="none">—</SelectItem>
                      {UFS.map(u => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-zinc-400">NCM/SKU</Label>
                  <Input
                    value={excForm.productRef}
                    onChange={(e) => setExcForm(p => ({ ...p, productRef: e.target.value }))}
                    className="bg-zinc-800/60 border-zinc-700 text-zinc-200 h-8 text-xs"
                    placeholder="opcional"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-zinc-400">Alíquota %</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={excForm.rate}
                    onChange={(e) => setExcForm(p => ({ ...p, rate: e.target.value }))}
                    className="bg-zinc-800/60 border-zinc-700 text-zinc-200 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-zinc-400">Início</Label>
                  <Input
                    type="date"
                    value={excForm.validFrom}
                    onChange={(e) => setExcForm(p => ({ ...p, validFrom: e.target.value }))}
                    className="bg-zinc-800/60 border-zinc-700 text-zinc-200 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-zinc-400">Fim (opc.)</Label>
                  <Input
                    type="date"
                    value={excForm.validUntil}
                    onChange={(e) => setExcForm(p => ({ ...p, validUntil: e.target.value }))}
                    className="bg-zinc-800/60 border-zinc-700 text-zinc-200 h-8 text-xs"
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    value={excForm.notes}
                    onChange={(e) => setExcForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Observação (ex: DIFAL RJ 18%, ST aparelho X)"
                    className="bg-zinc-800/60 border-zinc-700 text-zinc-200 h-8 text-xs"
                  />
                </div>
                <div className="col-span-3 flex items-end justify-end">
                  <Button
                    size="sm"
                    className="gap-1.5 h-8 bg-[#D4AF37] text-zinc-950 hover:bg-[#D4AF37]/90"
                    onClick={handleCreateException}
                    disabled={createException.isPending}
                  >
                    {createException.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Adicionar exceção
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </DialogContent>
    </Dialog>
  );
}

function MarketplaceAccountLinks({ companies }: { companies: any[] }) {
  const utils = trpc.useUtils();
  const integrationsQuery = trpc.integrations.list.useQuery();
  const linkMutation = trpc.integrations.linkCompany.useMutation({
    onSuccess: () => {
      toast.success("Vínculo atualizado");
      utils.integrations.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const emitters = (integrationsQuery.data ?? []).filter((i: any) =>
    typeof i.slug === "string" && (i.slug.startsWith("ml-") || i.slug.startsWith("shopee-")),
  );

  if (emitters.length === 0) return null;

  return (
    <Card className="bg-zinc-900/60 border-zinc-800">
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-[#D4AF37]" />
            Contas marketplace → Empresa emissora
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Define qual CNPJ emite a NF das vendas de cada conta. Usado pelo DRE para aplicar a alíquota correta.
          </p>
        </div>
        <div className="space-y-2">
          {emitters.map((i: any) => (
            <div key={i.id} className="flex items-center gap-2 rounded-lg bg-zinc-800/40 border border-zinc-800 p-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-200 truncate">{i.name}</p>
                <p className="text-[10px] text-zinc-500 font-mono truncate">{i.slug}</p>
              </div>
              <Select
                value={i.cnpjId ? String(i.cnpjId) : "none"}
                onValueChange={(v) => {
                  linkMutation.mutate({
                    slug: i.slug,
                    cnpjId: v === "none" ? null : parseInt(v, 10),
                  });
                }}
                disabled={linkMutation.isPending}
              >
                <SelectTrigger className="bg-zinc-900/60 border-zinc-700 h-8 text-xs w-48">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-200">
                  <SelectItem value="none">— Sem empresa —</SelectItem>
                  {companies.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nomeFantasia || c.razaoSocial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function regimeLabel(regime: string | null | undefined) {
  return REGIMES.find(r => r.value === regime)?.label ?? "—";
}

/* ── System Settings ── */

function SystemSettings() {
  const [chargeHour, setChargeHour] = useState("08:00");
  const [alertHour, setAlertHour] = useState("09:00");

  const utils = trpc.useUtils();
  const dateSourceQuery = trpc.systemSettings.get.useQuery({ key: "dateSource" });
  const setSettingMutation = trpc.systemSettings.set.useMutation({
    onSuccess: () => {
      toast.success("Preferência salva");
      utils.systemSettings.get.invalidate({ key: "dateSource" });
    },
    onError: (err) => toast.error(err.message),
  });

  const currentDateSource = dateSourceQuery.data?.value ?? "sale";

  const handleDateSourceChange = (value: string) => {
    setSettingMutation.mutate({
      key: "dateSource",
      value,
      description: "Fonte de data do DRE: sale (data da venda) ou invoice (data da NF)",
    });
  };

  return (
    <div className="space-y-4">
      <Card className="bg-zinc-900/60 border-zinc-800">
        <CardContent className="p-4">
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Fonte de data do DRE
          </label>
          <p className="text-xs text-zinc-500 mb-3">
            Define se o DRE competencia usa a data da <b>venda</b> (aproximacao) ou a data da <b>nota fiscal</b> (oficial).
            Alterar esta opcao recalcula todos os relatorios.
          </p>
          <Select
            value={currentDateSource}
            onValueChange={handleDateSourceChange}
            disabled={setSettingMutation.isPending || dateSourceQuery.isLoading}
          >
            <SelectTrigger className="bg-zinc-800/60 border-zinc-700 text-zinc-200 w-64 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-200">
              <SelectItem value="sale">Data da venda (padrao)</SelectItem>
              <SelectItem value="invoice">Data da nota fiscal (competencia)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-4">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Horário cobrança equipe
            </label>
            <p className="text-xs text-zinc-500 mb-3">
              Horário diário para enviar cobrança automática via WhatsApp
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
              Horário alerta boletos
            </label>
            <p className="text-xs text-zinc-500 mb-3">
              Horário diário para alertas de boletos e contas a vencer
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

/* ── Marketplace Fees ── */

function formatRange(priceMin: string | null, priceMax: string | null) {
  const min = priceMin != null ? `R$ ${Number(priceMin).toFixed(2)}` : null;
  const max = priceMax != null ? `R$ ${Number(priceMax).toFixed(2)}` : null;
  if (min && max) return `${min} – ${max}`;
  if (min && !max) return `A partir de ${min}`;
  if (!min && max) return `Até ${max}`;
  return "—";
}

function FeeRow({ row, onRefetch }: { row: any; onRefetch: () => void }) {
  const [editing, setEditing] = useState(false);
  const [percentage, setPercentage] = useState(String(row.percentage));
  const [fixedAmount, setFixedAmount] = useState(String(row.fixedAmount));
  const [notes, setNotes] = useState(row.notes ?? "");

  const updateMutation = trpc.updateMarketplaceFee.useMutation({
    onSuccess: () => {
      toast.success("Taxa atualizada");
      setEditing(false);
      onRefetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.deleteMarketplaceFee.useMutation({
    onSuccess: () => {
      toast.success("Linha removida");
      onRefetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    updateMutation.mutate({
      id: row.id,
      percentage,
      fixedAmount,
      notes: notes || null,
    });
  };

  const handleCancel = () => {
    setPercentage(String(row.percentage));
    setFixedAmount(String(row.fixedAmount));
    setNotes(row.notes ?? "");
    setEditing(false);
  };

  return (
    <tr className="border-b border-zinc-800 hover:bg-zinc-900/40">
      <td className="p-3 text-xs text-zinc-300">{row.label}</td>
      <td className="p-3 text-xs text-zinc-400">{formatRange(row.priceMin, row.priceMax)}</td>
      <td className="p-3 text-right">
        {editing ? (
          <Input
            type="number"
            step="0.01"
            value={percentage}
            onChange={(e) => setPercentage(e.target.value)}
            className="h-8 w-20 text-right text-xs"
          />
        ) : (
          <span className="text-xs text-zinc-100 font-mono">{Number(row.percentage).toFixed(2)}%</span>
        )}
      </td>
      <td className="p-3 text-right">
        {editing ? (
          <Input
            type="number"
            step="0.01"
            value={fixedAmount}
            onChange={(e) => setFixedAmount(e.target.value)}
            className="h-8 w-20 text-right text-xs"
          />
        ) : (
          <span className="text-xs text-zinc-100 font-mono">R$ {Number(row.fixedAmount).toFixed(2)}</span>
        )}
      </td>
      <td className="p-3 text-xs text-zinc-500 max-w-[240px]">
        {editing ? (
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-8 text-xs"
            placeholder="observação"
          />
        ) : (
          <span className="line-clamp-2">{row.notes || "—"}</span>
        )}
      </td>
      <td className="p-3 text-right whitespace-nowrap">
        {editing ? (
          <div className="flex gap-1 justify-end">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-zinc-500" onClick={handleCancel}>
              <XCircle className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-1 justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[#D4AF37] hover:bg-[#D4AF37]/10"
              onClick={() => setEditing(true)}
            >
              Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-red-400 hover:bg-red-500/10"
              onClick={() => {
                if (confirm(`Remover "${row.label}"?`)) deleteMutation.mutate({ id: row.id });
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

function FeeTable({ title, rows, onRefetch }: { title: string; rows: any[]; onRefetch: () => void }) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-4">
      <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-2 px-1">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/30">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/60">
              <th className="p-3 text-left text-[10px] uppercase tracking-wider text-zinc-500">Descrição</th>
              <th className="p-3 text-left text-[10px] uppercase tracking-wider text-zinc-500">Faixa de preço</th>
              <th className="p-3 text-right text-[10px] uppercase tracking-wider text-zinc-500">%</th>
              <th className="p-3 text-right text-[10px] uppercase tracking-wider text-zinc-500">Fixo</th>
              <th className="p-3 text-left text-[10px] uppercase tracking-wider text-zinc-500">Obs.</th>
              <th className="p-3 text-right text-[10px] uppercase tracking-wider text-zinc-500">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => <FeeRow key={row.id} row={row} onRefetch={onRefetch} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MarketplaceFeesSection({ marketplace, icon: Icon, label }: { marketplace: "mercado_livre" | "shopee"; icon: any; label: string }) {
  const query = trpc.listMarketplaceFees.useQuery({ marketplace });
  const rows = (query.data ?? []) as any[];

  const byType = (type: string) => rows.filter(r => r.feeType === type);

  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="h-5 w-5 text-[#D4AF37]" />
          <h2 className="text-base font-bold text-zinc-100">{label}</h2>
          {query.isLoading && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
        </div>

        <FeeTable title="Comissões" rows={byType("commission")} onRefetch={query.refetch} />
        <FeeTable title="Taxas fixas" rows={byType("fixed")} onRefetch={query.refetch} />
        <FeeTable title="Taxa de transação" rows={byType("transaction")} onRefetch={query.refetch} />
        <FeeTable title="Frete" rows={byType("shipping")} onRefetch={query.refetch} />
        <FeeTable title="Armazenagem" rows={byType("storage")} onRefetch={query.refetch} />

        {rows.length === 0 && !query.isLoading && (
          <p className="text-sm text-zinc-500 text-center py-6">Nenhuma taxa cadastrada</p>
        )}
      </CardContent>
    </Card>
  );
}

function MarketplaceFeesSettings() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-4">
        <p className="text-sm text-zinc-200">
          Taxas vigentes desde <strong>01-02/03/2026</strong>. Editáveis — altere quando os marketplaces mudarem.
          Usado para calcular margem e DRE Gerencial.
        </p>
        <p className="text-xs text-zinc-400 mt-1">
          Fonte inicial: pesquisa Perplexity 2026-04-19.
        </p>
      </div>
      <MarketplaceFeesSection marketplace="mercado_livre" icon={ShoppingCart} label="Mercado Livre" />
      <MarketplaceFeesSection marketplace="shopee" icon={ShoppingBag} label="Shopee" />
    </div>
  );
}

/* ── Empresas / CNPJs ── */

function CompaniesSettings() {
  const listQuery = trpc.myCnpjs.list.useQuery();
  const utils = trpc.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyCompanyForm());
  const [isLooking, setIsLooking] = useState(false);

  const createMutation = trpc.myCnpjs.create.useMutation({
    onSuccess: async () => {
      toast.success("Empresa cadastrada!");
      setShowForm(false);
      setForm(emptyCompanyForm());
      await utils.myCnpjs.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.myCnpjs.update.useMutation({
    onSuccess: async () => {
      toast.success("Empresa atualizada!");
      setEditingId(null);
      setShowForm(false);
      setForm(emptyCompanyForm());
      await utils.myCnpjs.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.myCnpjs.delete.useMutation({
    onSuccess: async () => {
      toast.success("Empresa removida.");
      await utils.myCnpjs.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleLookup = useCallback(async () => {
    const clean = form.cnpj.replace(/\D/g, "");
    if (clean.length !== 14) {
      toast.error("Informe um CNPJ com 14 dígitos.");
      return;
    }
    setIsLooking(true);
    try {
      const data = await utils.myCnpjs.lookupCnpj.fetch({ cnpj: clean });
      setForm(prev => ({
        ...prev,
        razaoSocial: data.razaoSocial || prev.razaoSocial,
        nomeFantasia: data.nomeFantasia || prev.nomeFantasia,
        ufOrigem: data.ufOrigem || prev.ufOrigem,
        cnaePrincipal: data.cnaePrincipal || prev.cnaePrincipal,
        regime: (data.regimeSugerido as RegimeValue | null) ?? prev.regime,
        dataInicioRegime: data.dataInicioSugerida || prev.dataInicioRegime,
      }));
      toast.success(`Dados preenchidos${data.cnaeDescricao ? ` — CNAE: ${data.cnaeDescricao}` : ""}.`);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao consultar BrasilAPI.");
    } finally {
      setIsLooking(false);
    }
  }, [form.cnpj, utils]);

  const handleSave = useCallback(async () => {
    if (!form.razaoSocial.trim() || !form.cnpj.trim()) {
      toast.error("Razão Social e CNPJ são obrigatórios.");
      return;
    }
    const payload = {
      razaoSocial: form.razaoSocial.trim(),
      cnpj: form.cnpj.trim(),
      nomeFantasia: form.nomeFantasia.trim() || null,
      inscricaoEstadual: form.inscricaoEstadual.trim() || null,
      inscricaoMunicipal: form.inscricaoMunicipal.trim() || null,
      regime: (form.regime || null) as RegimeValue | null,
      ufOrigem: form.ufOrigem || null,
      cnaePrincipal: form.cnaePrincipal.trim() || null,
      dataInicioRegime: form.dataInicioRegime || null,
      notes: form.notes.trim() || null,
    };
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  }, [form, editingId, createMutation, updateMutation]);

  const startEdit = (row: any) => {
    setEditingId(row.id);
    setForm({
      razaoSocial: row.razaoSocial ?? "",
      cnpj: row.cnpj ?? "",
      nomeFantasia: row.nomeFantasia ?? "",
      inscricaoEstadual: row.inscricaoEstadual ?? "",
      inscricaoMunicipal: row.inscricaoMunicipal ?? "",
      regime: (row.regime ?? "") as RegimeValue | "",
      ufOrigem: row.ufOrigem ?? "",
      cnaePrincipal: row.cnaePrincipal ?? "",
      dataInicioRegime: row.dataInicioRegime ?? "",
      notes: row.notes ?? "",
    });
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowForm(false);
    setForm(emptyCompanyForm());
  };

  const companies = listQuery.data ?? [];
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const [taxDialogFor, setTaxDialogFor] = useState<any | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-4">
        <p className="text-sm text-zinc-200">
          Cadastre os CNPJs operacionais da Kaibren. O regime tributário define o cálculo de PIS/COFINS,
          ICMS e vincula pedidos à empresa correta no DRE.
        </p>
        <p className="text-xs text-zinc-400 mt-1">
          Autopreenchimento via <strong>BrasilAPI</strong> (Receita Federal) — clique "Buscar" depois de digitar o CNPJ.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-400">
          {companies.length} empresa{companies.length !== 1 ? "s" : ""} cadastrada{companies.length !== 1 ? "s" : ""}
        </div>
        {!showForm && (
          <Button
            size="sm"
            className="gap-1.5 bg-[#D4AF37] text-zinc-950 hover:bg-[#D4AF37]/90"
            onClick={() => { setEditingId(null); setForm(emptyCompanyForm()); setShowForm(true); }}
          >
            <Plus className="h-4 w-4" /> Nova empresa
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-[#D4AF37]/40 bg-zinc-900/60">
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">
                {editingId ? "Editar empresa" : "Nova empresa"}
              </h3>
              <Button variant="ghost" size="sm" onClick={cancelEdit} className="text-zinc-400 h-8 px-2">
                <XCircle className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 md:items-end">
              <div>
                <Label className="text-xs text-zinc-400">CNPJ *</Label>
                <Input
                  value={formatCnpj(form.cnpj)}
                  onChange={(e) => setForm(p => ({ ...p, cnpj: e.target.value.replace(/\D/g, "") }))}
                  placeholder="00.000.000/0000-00"
                  className="bg-zinc-800/60 border-zinc-700 text-zinc-200"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                onClick={handleLookup}
                disabled={isLooking}
              >
                {isLooking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar na Receita
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-zinc-400">Razão Social *</Label>
                <Input
                  value={form.razaoSocial}
                  onChange={(e) => setForm(p => ({ ...p, razaoSocial: e.target.value }))}
                  className="bg-zinc-800/60 border-zinc-700 text-zinc-200"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Nome Fantasia</Label>
                <Input
                  value={form.nomeFantasia}
                  onChange={(e) => setForm(p => ({ ...p, nomeFantasia: e.target.value }))}
                  className="bg-zinc-800/60 border-zinc-700 text-zinc-200"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Inscrição Estadual</Label>
                <Input
                  value={form.inscricaoEstadual}
                  onChange={(e) => setForm(p => ({ ...p, inscricaoEstadual: e.target.value }))}
                  className="bg-zinc-800/60 border-zinc-700 text-zinc-200"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Inscrição Municipal</Label>
                <Input
                  value={form.inscricaoMunicipal}
                  onChange={(e) => setForm(p => ({ ...p, inscricaoMunicipal: e.target.value }))}
                  className="bg-zinc-800/60 border-zinc-700 text-zinc-200"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Regime tributário</Label>
                <Select
                  value={form.regime || undefined}
                  onValueChange={(v) => setForm(p => ({ ...p, regime: v as RegimeValue }))}
                >
                  <SelectTrigger className="bg-zinc-800/60 border-zinc-700 text-zinc-200">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIMES.map(r => (
                      <SelectItem key={r.value} value={r.value}>
                        <div className="flex flex-col">
                          <span>{r.label}</span>
                          <span className="text-[10px] text-zinc-500">{r.tooltip}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-zinc-400">UF origem</Label>
                <Select
                  value={form.ufOrigem || undefined}
                  onValueChange={(v) => setForm(p => ({ ...p, ufOrigem: v }))}
                >
                  <SelectTrigger className="bg-zinc-800/60 border-zinc-700 text-zinc-200">
                    <SelectValue placeholder="Selecione UF..." />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-zinc-400">CNAE principal</Label>
                <Input
                  value={form.cnaePrincipal}
                  onChange={(e) => setForm(p => ({ ...p, cnaePrincipal: e.target.value }))}
                  placeholder="Ex: 4649499"
                  className="bg-zinc-800/60 border-zinc-700 text-zinc-200"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Data início regime</Label>
                <Input
                  type="date"
                  value={form.dataInicioRegime}
                  onChange={(e) => setForm(p => ({ ...p, dataInicioRegime: e.target.value }))}
                  className="bg-zinc-800/60 border-zinc-700 text-zinc-200"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-zinc-400">Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
                className="bg-zinc-800/60 border-zinc-700 text-zinc-200 min-h-[72px]"
                placeholder="Notas sobre contador, parcelamento, observações internas..."
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="gap-1.5 bg-[#D4AF37] text-zinc-950 hover:bg-[#D4AF37]/90"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingId ? "Salvar alterações" : "Cadastrar empresa"}
              </Button>
              <Button variant="ghost" onClick={cancelEdit} className="text-zinc-400">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {listQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      ) : companies.length === 0 ? (
        <Card className="border-dashed border-zinc-800 bg-zinc-900/30">
          <CardContent className="p-8 text-center">
            <Building2 className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">Nenhuma empresa cadastrada</p>
            <p className="text-xs text-zinc-500 mt-1">Comece adicionando o CNPJ principal da Kaibren.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {companies.map((c: any) => (
            <Card key={c.id} className="border-zinc-800 bg-zinc-900/40">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-zinc-100 truncate">{c.razaoSocial}</h4>
                    {c.nomeFantasia && (
                      <p className="text-xs text-zinc-500 truncate">{c.nomeFantasia}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                      onClick={() => startEdit(c)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10"
                      onClick={() => {
                        if (confirm(`Remover "${c.razaoSocial}"?`)) deleteMutation.mutate({ id: c.id });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <p className="text-xs font-mono text-zinc-300 mb-3">{formatCnpj(c.cnpj)}</p>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className={`text-[10px] px-2 py-0 ${regimeBadgeColor(c.regime)}`}>
                    {regimeLabel(c.regime)}
                  </Badge>
                  {c.ufOrigem && (
                    <Badge variant="outline" className="text-[10px] px-2 py-0 bg-zinc-800/40 text-zinc-300 border-zinc-700">
                      {c.ufOrigem}
                    </Badge>
                  )}
                  {c.cnaePrincipal && (
                    <Badge variant="outline" className="text-[10px] px-2 py-0 bg-zinc-800/40 text-zinc-400 border-zinc-700 font-mono">
                      CNAE {c.cnaePrincipal}
                    </Badge>
                  )}
                </div>

                {(c.inscricaoEstadual || c.inscricaoMunicipal) && (
                  <div className="mt-3 pt-3 border-t border-zinc-800 space-y-0.5">
                    {c.inscricaoEstadual && (
                      <p className="text-[11px] text-zinc-500">IE: <span className="text-zinc-300 font-mono">{c.inscricaoEstadual}</span></p>
                    )}
                    {c.inscricaoMunicipal && (
                      <p className="text-[11px] text-zinc-500">IM: <span className="text-zinc-300 font-mono">{c.inscricaoMunicipal}</span></p>
                    )}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-zinc-800">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 w-full h-8 border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                    onClick={() => setTaxDialogFor(c)}
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    Alíquotas & exceções
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {companies.length > 0 && <MarketplaceAccountLinks companies={companies} />}

      {taxDialogFor && (
        <CompanyTaxDialog
          cnpj={taxDialogFor}
          open={!!taxDialogFor}
          onOpenChange={(o) => !o && setTaxDialogFor(null)}
        />
      )}
    </div>
  );
}

/* ──────────────────────── Depósitos / Multi-warehouse ──────────────────────── */

type WarehouseForm = {
  name: string;
  address: string;
  isDefault: boolean;
};

function emptyWarehouseForm(): WarehouseForm {
  return { name: "", address: "", isDefault: false };
}

function DepositosSettings() {
  const utils = trpc.useUtils();
  const warehousesQuery = trpc.productCatalog.warehouseList.useQuery();
  const productsQuery = trpc.products.list.useQuery({ limit: 500 });

  const [form, setForm] = useState<WarehouseForm>(emptyWarehouseForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);

  const createMut = trpc.productCatalog.warehouseCreate.useMutation({
    onSuccess: () => {
      toast.success("Depósito cadastrado.");
      setForm(emptyWarehouseForm());
      utils.productCatalog.warehouseList.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMut = trpc.productCatalog.warehouseUpdate.useMutation({
    onSuccess: () => {
      toast.success("Depósito atualizado.");
      setEditingId(null);
      setForm(emptyWarehouseForm());
      utils.productCatalog.warehouseList.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMut = trpc.productCatalog.warehouseDelete.useMutation({
    onSuccess: () => {
      toast.success("Depósito removido.");
      utils.productCatalog.warehouseList.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const warehouses = (warehousesQuery.data ?? []) as any[];
  const products = (productsQuery.data ?? []) as any[];

  const startEdit = (w: any) => {
    setEditingId(w.id);
    setForm({ name: w.name, address: w.address ?? "", isDefault: w.isDefault === 1 });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyWarehouseForm());
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome do depósito.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || undefined,
      isDefault: form.isDefault ? 1 : 0,
      isActive: 1,
    };
    if (editingId) {
      updateMut.mutate({ id: editingId, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  return (
    <div className="space-y-4">
      {/* Formulário */}
      <Card className="bg-zinc-900/40 border-zinc-800">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Warehouse className="h-4 w-4 text-[#D4AF37]" />
            <h3 className="text-sm font-semibold text-zinc-100">
              {editingId ? "Editando depósito" : "Novo depósito"}
            </h3>
          </div>
          <div className="grid sm:grid-cols-[1fr_1.5fr_auto_auto] gap-2 items-end">
            <div>
              <Label className="text-[11px] text-zinc-400">Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex.: Loja Taboão"
                className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-[11px] text-zinc-400">Endereço / localização</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Endereço ou descrição interna"
                className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none h-9 px-3 rounded-lg bg-zinc-800/40 border border-zinc-700">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm(p => ({ ...p, isDefault: e.target.checked }))}
                className="rounded border-zinc-600 bg-zinc-800 text-[#D4AF37] focus:ring-[#D4AF37]/40"
              />
              Padrão
            </label>
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={createMut.isPending || updateMut.isPending}
                className="h-9 bg-[#D4AF37] hover:bg-[#BE9F30] text-black"
              >
                {editingId ? <><Save className="h-4 w-4 mr-1.5" />Salvar</> : <><Plus className="h-4 w-4 mr-1.5" />Cadastrar</>}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={cancelEdit} className="h-9 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-zinc-900/60 text-zinc-400 uppercase tracking-wider">
            <tr>
              <th className="text-left p-2">Nome</th>
              <th className="text-left p-2">Endereço</th>
              <th className="text-center p-2">Padrão</th>
              <th className="text-center p-2">Status</th>
              <th className="p-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {warehouses.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-zinc-500">Nenhum depósito cadastrado ainda.</td></tr>
            ) : warehouses.map((w) => (
              <tr key={w.id} className={`border-t border-zinc-800/60 ${editingId === w.id ? "bg-[#D4AF37]/5" : ""}`}>
                <td className="p-2 text-zinc-100 font-medium">{w.name}</td>
                <td className="p-2 text-zinc-400">{w.address || "—"}</td>
                <td className="p-2 text-center">
                  {w.isDefault === 1
                    ? <Star className="h-4 w-4 text-[#D4AF37] inline" />
                    : <StarOff className="h-4 w-4 text-zinc-600 inline" />}
                </td>
                <td className="p-2 text-center">
                  {w.isActive === 1
                    ? <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">Ativo</Badge>
                    : <Badge className="bg-zinc-700/40 text-zinc-400 border-zinc-600/40 text-[10px]">Inativo</Badge>}
                </td>
                <td className="p-2 text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-400 hover:text-[#D4AF37]" onClick={() => startEdit(w)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10"
                    onClick={() => {
                      if (confirm(`Remover o depósito "${w.name}"? Estoques vinculados também serão apagados.`)) {
                        deleteMut.mutate({ id: w.id });
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Atalho para ajuste por produto */}
      <Card className="bg-zinc-900/40 border-zinc-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-100">Ajustar estoque por produto</div>
              <p className="text-xs text-zinc-400 mt-1">
                Para lançar quantidades por depósito, abra o produto em <a href="/produtos" className="text-[#D4AF37] hover:underline">Produtos</a> e vá na aba <strong>Estoque</strong>.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowMatrix(!showMatrix)} className="h-8 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              {showMatrix ? "Ocultar matriz" : "Ver matriz geral"}
            </Button>
          </div>
          {showMatrix && warehouses.length > 0 && (
            <WarehouseStockMatrix products={products} warehouses={warehouses} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WarehouseStockMatrix({ products, warehouses }: { products: any[]; warehouses: any[] }) {
  const [productQuery, setProductQuery] = useState("");

  const filtered = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products.filter(p => p.sku.toLowerCase().includes(q) || p.titulo.toLowerCase().includes(q)).slice(0, 30);
  }, [products, productQuery]);

  return (
    <div className="mt-3 space-y-2">
      <Input
        value={productQuery}
        onChange={(e) => setProductQuery(e.target.value)}
        placeholder="Filtrar por SKU ou nome"
        className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm"
      />
      <div className="rounded-lg border border-zinc-800 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-zinc-900/60 text-zinc-400 uppercase tracking-wider">
            <tr>
              <th className="text-left p-2 sticky left-0 bg-zinc-900/60">SKU / Produto</th>
              {warehouses.map(w => (
                <th key={w.id} className="text-center p-2 min-w-[80px]">{w.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={warehouses.length + 1} className="p-4 text-center text-zinc-500">Sem produtos para exibir.</td></tr>
            ) : filtered.map(p => (
              <ProductStockRow key={p.id} product={p} warehouses={warehouses} />
            ))}
          </tbody>
        </table>
      </div>
      {products.length > filtered.length && (
        <div className="text-[11px] text-zinc-500 text-center">
          Mostrando {filtered.length} de {products.length} produtos. Use o filtro para refinar.
        </div>
      )}
    </div>
  );
}

function ProductStockRow({ product, warehouses }: { product: any; warehouses: any[] }) {
  const stockQuery = trpc.productCatalog.stockList.useQuery({ productId: product.id });
  const rows = stockQuery.data ?? [];
  const byWh = new Map<number, any>();
  for (const r of rows as any[]) byWh.set(r.warehouseId, r);

  return (
    <tr className="border-t border-zinc-800/60">
      <td className="p-2 sticky left-0 bg-zinc-950/95 min-w-[220px]">
        <div className="font-mono text-[10px] text-zinc-500">{product.sku}</div>
        <div className="text-zinc-300 truncate max-w-[300px]">{product.titulo}</div>
      </td>
      {warehouses.map(w => {
        const s = byWh.get(w.id);
        const qty = s ? s.quantity : 0;
        const belowMin = s && s.minStock > 0 && qty < s.minStock;
        return (
          <td key={w.id} className="p-2 text-center">
            <span className={`font-mono font-semibold ${belowMin ? "text-rose-300" : qty > 0 ? "text-zinc-100" : "text-zinc-600"}`}>
              {qty}
            </span>
          </td>
        );
      })}
    </tr>
  );
}

/* ── Main ── */

export default function Settings() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab && CATEGORIES.some(c => c.key === tab)) return tab;
    }
    return "Taxas";
  });

  const activeCat = CATEGORIES.find(c => c.key === activeTab) ?? CATEGORIES[0];

  return (
    <DashboardLayout activeSection="configuracoes">
      <div className="flex flex-col gap-4 sm:gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-[#D4AF37]" />
            Configurações
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Taxas de marketplace, horários e preferências do sistema.
            Para conectar marketplaces, ERPs e canais, use <a href="/integracoes" className="text-[#D4AF37] hover:underline">Integrações</a>.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl">
          {CATEGORIES.map(cat => {
            const CatIcon = cat.icon;
            const isActive = activeTab === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveTab(cat.key)}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-all ${
                  isActive
                    ? "border-[#D4AF37]/50 bg-[#D4AF37]/5 shadow-lg shadow-[#D4AF37]/5"
                    : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60"
                }`}
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${isActive ? "bg-[#D4AF37]/20" : "bg-zinc-800"}`}>
                  <CatIcon className={`h-4 w-4 ${isActive ? "text-[#D4AF37]" : "text-zinc-400"}`} />
                </div>
                <div>
                  <div className={`text-sm font-semibold ${isActive ? "text-[#D4AF37]" : "text-zinc-200"}`}>
                    {cat.label}
                  </div>
                  <div className="text-[11px] text-zinc-500">{cat.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <activeCat.icon className="h-5 w-5 text-[#D4AF37]" />
            <h2 className="text-lg font-bold text-zinc-100">{activeCat.label}</h2>
          </div>

          {activeTab === "Empresas" && <CompaniesSettings />}
          {activeTab === "Taxas" && <MarketplaceFeesSettings />}
          {activeTab === "Depositos" && <DepositosSettings />}
          {activeTab === "Sistema" && <SystemSettings />}
        </div>
      </div>
    </DashboardLayout>
  );
}
