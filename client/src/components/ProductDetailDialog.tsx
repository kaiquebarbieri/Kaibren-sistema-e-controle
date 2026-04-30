import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Package,
  FileText,
  TrendingUp,
  TrendingDown,
  Wallet,
  Warehouse,
  Puzzle,
  Save,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

type ProductSummary = {
  id: number;
  sku: string;
  titulo: string;
  valorProduto?: string | null;
  precoFinal?: string | null;
};

type Props = {
  product: ProductSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const UNIT_OPTIONS = ["UN", "KG", "L", "CX", "PC", "PAR", "M", "M2", "M3"];
const ORIGIN_OPTIONS = [
  { value: "0", label: "0 — Nacional" },
  { value: "1", label: "1 — Estrangeira (importação direta)" },
  { value: "2", label: "2 — Estrangeira (mercado interno)" },
  { value: "3", label: "3 — Nacional c/ conteúdo ≥40% estrangeiro" },
  { value: "4", label: "4 — Nacional (processo básico Lei 11.484/07)" },
  { value: "5", label: "5 — Nacional c/ conteúdo <40% estrangeiro" },
  { value: "6", label: "6 — Estrangeira (importação direta, sem similar)" },
  { value: "7", label: "7 — Estrangeira (mercado interno, sem similar)" },
  { value: "8", label: "8 — Nacional c/ conteúdo >70% estrangeiro" },
];
const PERIOD_OPTIONS = [
  { value: "por_unidade", label: "Por unidade" },
  { value: "mensal", label: "Mensal" },
  { value: "anual", label: "Anual" },
];

function fmtCurrency(v: string | number | null | undefined) {
  const n = Number(String(v ?? 0).replace(",", "."));
  if (isNaN(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const NONE = "__none";

export function ProductDetailDialog({ product, open, onOpenChange }: Props) {
  if (!product) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-[#D4AF37]" />
            <span className="font-mono text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300">{product.sku}</span>
            <span className="truncate">{product.titulo}</span>
          </DialogTitle>
        </DialogHeader>
        <ProductDetailTabs product={product} />
      </DialogContent>
    </Dialog>
  );
}

function ProductDetailTabs({ product }: { product: ProductSummary }) {
  const fullQuery = trpc.products.get.useQuery({ id: product.id });
  const full = fullQuery.data as any;
  const isKit = full?.isKit === 1;

  return (
    <Tabs defaultValue="geral" className="w-full">
      <div className="px-6 sticky top-0 bg-zinc-950 z-10 border-b border-zinc-800 pb-3">
        <TabsList className="bg-zinc-900 border border-zinc-800 h-9">
          <TabsTrigger value="geral" className="text-xs"><FileText className="h-3.5 w-3.5 mr-1.5" />Geral</TabsTrigger>
          <TabsTrigger value="custos" className="text-xs"><TrendingDown className="h-3.5 w-3.5 mr-1.5" />Custos</TabsTrigger>
          <TabsTrigger value="vendas" className="text-xs"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Vendas</TabsTrigger>
          <TabsTrigger value="fixos" className="text-xs"><Wallet className="h-3.5 w-3.5 mr-1.5" />Fixos</TabsTrigger>
          <TabsTrigger value="estoque" className="text-xs"><Warehouse className="h-3.5 w-3.5 mr-1.5" />Estoque</TabsTrigger>
          {isKit && (
            <TabsTrigger value="kit" className="text-xs"><Puzzle className="h-3.5 w-3.5 mr-1.5" />Kit</TabsTrigger>
          )}
        </TabsList>
      </div>

      <div className="px-6 py-4 space-y-4">
        <TabsContent value="geral" className="m-0">
          <GeneralTab product={product} full={full} isLoading={fullQuery.isLoading} onRefetch={() => fullQuery.refetch()} />
        </TabsContent>
        <TabsContent value="custos" className="m-0">
          <CostHistoryTab productId={product.id} />
        </TabsContent>
        <TabsContent value="vendas" className="m-0">
          <SaleHistoryTab productId={product.id} />
        </TabsContent>
        <TabsContent value="fixos" className="m-0">
          <FixedCostsTab productId={product.id} />
        </TabsContent>
        <TabsContent value="estoque" className="m-0">
          <StockTab productId={product.id} />
        </TabsContent>
        {isKit && (
          <TabsContent value="kit" className="m-0">
            <KitTab productId={product.id} />
          </TabsContent>
        )}
      </div>
    </Tabs>
  );
}

/* ──────────────────────── TAB: Geral ──────────────────────── */

function GeneralTab({
  product,
  full,
  isLoading,
  onRefetch,
}: {
  product: ProductSummary;
  full: any;
  isLoading: boolean;
  onRefetch: () => void;
}) {
  const utils = trpc.useUtils();
  const brandsQuery = trpc.productCatalog.brandList.useQuery();
  const categoriesQuery = trpc.productCatalog.categoryList.useQuery();

  const [form, setForm] = useState({
    sku: "",
    titulo: "",
    brandId: "" as string,
    categoryId: "" as string,
    internalCode: "",
    ncm: "",
    gtin: "",
    cest: "",
    taxOriginCode: "",
    unitOfMeasure: "UN",
    weightKg: "",
    notes: "",
    isKit: 0,
  });

  useEffect(() => {
    if (!full) return;
    setForm({
      sku: full.sku ?? "",
      titulo: full.titulo ?? "",
      brandId: full.brandId != null ? String(full.brandId) : "",
      categoryId: full.categoryId != null ? String(full.categoryId) : "",
      internalCode: full.internalCode ?? "",
      ncm: full.ncm ?? "",
      gtin: full.gtin ?? "",
      cest: full.cest ?? "",
      taxOriginCode: full.taxOriginCode ?? "",
      unitOfMeasure: full.unitOfMeasure ?? "UN",
      weightKg: full.weightKg ?? "",
      notes: full.notes ?? "",
      isKit: full.isKit ?? 0,
    });
  }, [full]);

  const updateMutation = trpc.products.update.useMutation({
    onSuccess: async () => {
      toast.success("Produto atualizado.");
      onRefetch();
      await utils.products.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading || !full) {
    return <div className="text-sm text-zinc-400 py-8 text-center">Carregando dados do produto…</div>;
  }

  const handleSave = () => {
    if (!form.sku.trim() || !form.titulo.trim()) {
      toast.error("SKU e título são obrigatórios.");
      return;
    }
    updateMutation.mutate({
      id: product.id,
      sku: form.sku.trim(),
      titulo: form.titulo.trim(),
      brandId: form.brandId ? parseInt(form.brandId, 10) : null,
      categoryId: form.categoryId ? parseInt(form.categoryId, 10) : null,
      internalCode: form.internalCode || null,
      ncm: form.ncm || null,
      gtin: form.gtin || null,
      cest: form.cest || null,
      taxOriginCode: form.taxOriginCode || null,
      unitOfMeasure: form.unitOfMeasure || "UN",
      weightKg: form.weightKg || null,
      notes: form.notes || null,
      isKit: form.isKit ? 1 : 0,
    });
  };

  return (
    <div className="space-y-4">
      {/* Identificação */}
      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Identificação</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] text-zinc-400">SKU</Label>
            <Input
              value={form.sku}
              onChange={(e) => setForm(p => ({ ...p, sku: e.target.value }))}
              className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm font-mono"
            />
          </div>
          <div>
            <Label className="text-[11px] text-zinc-400">Código interno</Label>
            <Input
              value={form.internalCode}
              onChange={(e) => setForm(p => ({ ...p, internalCode: e.target.value }))}
              className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm"
            />
          </div>
        </div>
        <div>
          <Label className="text-[11px] text-zinc-400">Título</Label>
          <Input
            value={form.titulo}
            onChange={(e) => setForm(p => ({ ...p, titulo: e.target.value }))}
            className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] text-zinc-400">Marca</Label>
            <Select
              value={form.brandId || NONE}
              onValueChange={(v) => setForm(p => ({ ...p, brandId: v === NONE ? "" : v }))}
            >
              <SelectTrigger className="bg-zinc-800/60 border-zinc-700 h-9 text-sm">
                <SelectValue placeholder="Selecionar marca" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                <SelectItem value={NONE}>— Nenhuma —</SelectItem>
                {(brandsQuery.data ?? []).map((b: any) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-zinc-400">Categoria</Label>
            <Select
              value={form.categoryId || NONE}
              onValueChange={(v) => setForm(p => ({ ...p, categoryId: v === NONE ? "" : v }))}
            >
              <SelectTrigger className="bg-zinc-800/60 border-zinc-700 h-9 text-sm">
                <SelectValue placeholder="Selecionar categoria" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                <SelectItem value={NONE}>— Nenhuma —</SelectItem>
                {(categoriesQuery.data ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!form.isKit}
            onChange={(e) => setForm(p => ({ ...p, isKit: e.target.checked ? 1 : 0 }))}
            className="rounded border-zinc-600 bg-zinc-800 text-[#D4AF37] focus:ring-[#D4AF37]/40"
          />
          Este SKU é um <strong className="text-[#D4AF37]">Kit</strong> (composto por outros produtos)
        </label>
      </section>

      {/* Fiscal */}
      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Fiscal</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-[11px] text-zinc-400">NCM</Label>
            <Input
              value={form.ncm}
              onChange={(e) => setForm(p => ({ ...p, ncm: e.target.value.replace(/\D/g, "").slice(0, 8) }))}
              placeholder="8 dígitos"
              className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm font-mono"
            />
          </div>
          <div>
            <Label className="text-[11px] text-zinc-400">GTIN / EAN</Label>
            <Input
              value={form.gtin}
              onChange={(e) => setForm(p => ({ ...p, gtin: e.target.value.replace(/\D/g, "").slice(0, 14) }))}
              className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm font-mono"
            />
          </div>
          <div>
            <Label className="text-[11px] text-zinc-400">CEST</Label>
            <Input
              value={form.cest}
              onChange={(e) => setForm(p => ({ ...p, cest: e.target.value.replace(/\D/g, "").slice(0, 7) }))}
              className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm font-mono"
            />
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-[11px] text-zinc-400">Origem</Label>
            <Select
              value={form.taxOriginCode || NONE}
              onValueChange={(v) => setForm(p => ({ ...p, taxOriginCode: v === NONE ? "" : v }))}
            >
              <SelectTrigger className="bg-zinc-800/60 border-zinc-700 h-9 text-sm">
                <SelectValue placeholder="Código de origem" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                <SelectItem value={NONE}>— Não informado —</SelectItem>
                {ORIGIN_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-zinc-400">Unidade</Label>
            <Select
              value={form.unitOfMeasure}
              onValueChange={(v) => setForm(p => ({ ...p, unitOfMeasure: v }))}
            >
              <SelectTrigger className="bg-zinc-800/60 border-zinc-700 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                {UNIT_OPTIONS.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-zinc-400">Peso (kg)</Label>
            <Input
              type="number"
              step="0.001"
              value={form.weightKg}
              onChange={(e) => setForm(p => ({ ...p, weightKg: e.target.value }))}
              className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm"
            />
          </div>
        </div>
      </section>

      {/* Notas */}
      <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Notas internas</h3>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
          rows={3}
          placeholder="Observações internas, avisos, substituições etc."
          className="bg-zinc-800/60 border-zinc-700 text-zinc-100 text-sm"
        />
      </section>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="bg-[#D4AF37] hover:bg-[#BE9F30] text-black h-9"
        >
          <Save className="h-4 w-4 mr-2" />
          {updateMutation.isPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}

/* ──────────────────────── TAB: Custos ──────────────────────── */

function CostHistoryTab({ productId }: { productId: number }) {
  const utils = trpc.useUtils();
  const listQuery = trpc.productCatalog.costHistoryList.useQuery({ productId });
  const [form, setForm] = useState({ cost: "", validFrom: todayISO(), supplier: "", sourceDoc: "", notes: "" });

  const createMut = trpc.productCatalog.costHistoryCreate.useMutation({
    onSuccess: () => {
      toast.success("Custo registrado.");
      setForm({ cost: "", validFrom: todayISO(), supplier: "", sourceDoc: "", notes: "" });
      utils.productCatalog.costHistoryList.invalidate({ productId });
    },
    onError: (err) => toast.error(err.message),
  });

  const rows = listQuery.data ?? [];

  const handleAdd = () => {
    if (!form.cost || !form.validFrom) {
      toast.error("Informe o custo e a data.");
      return;
    }
    createMut.mutate({
      productId,
      cost: form.cost,
      validFrom: form.validFrom,
      supplier: form.supplier || undefined,
      sourceDoc: form.sourceDoc || undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Novo registro de custo</h3>
        <div className="grid sm:grid-cols-5 gap-2">
          <div>
            <Label className="text-[11px] text-zinc-400">Vigência</Label>
            <Input type="date" value={form.validFrom} onChange={(e) => setForm(p => ({ ...p, validFrom: e.target.value }))} className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm" />
          </div>
          <div>
            <Label className="text-[11px] text-zinc-400">Custo</Label>
            <Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm(p => ({ ...p, cost: e.target.value }))} className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm" />
          </div>
          <div>
            <Label className="text-[11px] text-zinc-400">Fornecedor</Label>
            <Input value={form.supplier} onChange={(e) => setForm(p => ({ ...p, supplier: e.target.value }))} className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm" />
          </div>
          <div>
            <Label className="text-[11px] text-zinc-400">NF / doc</Label>
            <Input value={form.sourceDoc} onChange={(e) => setForm(p => ({ ...p, sourceDoc: e.target.value }))} className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm" />
          </div>
          <div className="flex items-end">
            <Button onClick={handleAdd} disabled={createMut.isPending} className="h-9 w-full bg-[#D4AF37] hover:bg-[#BE9F30] text-black">
              <Plus className="h-4 w-4 mr-1.5" />Registrar
            </Button>
          </div>
        </div>
        <Input value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notas (opcional)" className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm" />
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-zinc-900/60 text-zinc-400 uppercase tracking-wider">
            <tr>
              <th className="text-left p-2">Data</th>
              <th className="text-right p-2">Custo</th>
              <th className="text-left p-2">Fornecedor</th>
              <th className="text-left p-2">Doc.</th>
              <th className="text-left p-2">Notas</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-zinc-500">Sem registros de custo.</td></tr>
            ) : rows.map((r: any) => (
              <tr key={r.id} className="border-t border-zinc-800/60">
                <td className="p-2 text-zinc-300">{r.validFrom}</td>
                <td className="p-2 text-right font-mono text-emerald-300">{fmtCurrency(r.cost)}</td>
                <td className="p-2 text-zinc-400">{r.supplier || "—"}</td>
                <td className="p-2 text-zinc-500">{r.sourceDoc || "—"}</td>
                <td className="p-2 text-zinc-500 max-w-[260px] truncate">{r.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ──────────────────────── TAB: Vendas ──────────────────────── */

function SaleHistoryTab({ productId }: { productId: number }) {
  const utils = trpc.useUtils();
  const listQuery = trpc.productCatalog.saleHistoryList.useQuery({ productId });
  const [form, setForm] = useState({ price: "", validFrom: todayISO(), channel: "", notes: "" });

  const createMut = trpc.productCatalog.saleHistoryCreate.useMutation({
    onSuccess: () => {
      toast.success("Preço registrado.");
      setForm({ price: "", validFrom: todayISO(), channel: "", notes: "" });
      utils.productCatalog.saleHistoryList.invalidate({ productId });
    },
    onError: (err) => toast.error(err.message),
  });

  const rows = listQuery.data ?? [];

  const handleAdd = () => {
    if (!form.price || !form.validFrom) {
      toast.error("Informe o preço e a data.");
      return;
    }
    createMut.mutate({
      productId,
      price: form.price,
      validFrom: form.validFrom,
      channel: form.channel || undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Novo preço de venda</h3>
        <div className="grid sm:grid-cols-5 gap-2">
          <div>
            <Label className="text-[11px] text-zinc-400">Vigência</Label>
            <Input type="date" value={form.validFrom} onChange={(e) => setForm(p => ({ ...p, validFrom: e.target.value }))} className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm" />
          </div>
          <div>
            <Label className="text-[11px] text-zinc-400">Preço</Label>
            <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm(p => ({ ...p, price: e.target.value }))} className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-[11px] text-zinc-400">Canal</Label>
            <Input value={form.channel} onChange={(e) => setForm(p => ({ ...p, channel: e.target.value }))} placeholder="ML / Shopee / Loja física…" className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm" />
          </div>
          <div className="flex items-end">
            <Button onClick={handleAdd} disabled={createMut.isPending} className="h-9 w-full bg-[#D4AF37] hover:bg-[#BE9F30] text-black">
              <Plus className="h-4 w-4 mr-1.5" />Registrar
            </Button>
          </div>
        </div>
        <Input value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notas (opcional)" className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm" />
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-zinc-900/60 text-zinc-400 uppercase tracking-wider">
            <tr>
              <th className="text-left p-2">Data</th>
              <th className="text-right p-2">Preço</th>
              <th className="text-left p-2">Canal</th>
              <th className="text-left p-2">Notas</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="p-4 text-center text-zinc-500">Sem registros de venda.</td></tr>
            ) : rows.map((r: any) => (
              <tr key={r.id} className="border-t border-zinc-800/60">
                <td className="p-2 text-zinc-300">{r.validFrom}</td>
                <td className="p-2 text-right font-mono text-[#D4AF37]">{fmtCurrency(r.price)}</td>
                <td className="p-2 text-zinc-400">{r.channel || "—"}</td>
                <td className="p-2 text-zinc-500 max-w-[260px] truncate">{r.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ──────────────────────── TAB: Custos fixos ──────────────────────── */

function FixedCostsTab({ productId }: { productId: number }) {
  const utils = trpc.useUtils();
  const listQuery = trpc.productCatalog.fixedCostList.useQuery({ productId });
  const [form, setForm] = useState({ label: "", amount: "", period: "por_unidade" as "por_unidade" | "mensal" | "anual", notes: "" });

  const createMut = trpc.productCatalog.fixedCostCreate.useMutation({
    onSuccess: () => {
      toast.success("Custo fixo adicionado.");
      setForm({ label: "", amount: "", period: "por_unidade", notes: "" });
      utils.productCatalog.fixedCostList.invalidate({ productId });
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMut = trpc.productCatalog.fixedCostDelete.useMutation({
    onSuccess: () => {
      toast.success("Custo fixo removido.");
      utils.productCatalog.fixedCostList.invalidate({ productId });
    },
    onError: (err) => toast.error(err.message),
  });

  const rows = listQuery.data ?? [];

  const handleAdd = () => {
    if (!form.label || !form.amount) {
      toast.error("Informe label e valor.");
      return;
    }
    createMut.mutate({
      productId,
      label: form.label,
      amount: form.amount,
      period: form.period,
      notes: form.notes || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Novo custo fixo rateado</h3>
        <div className="grid sm:grid-cols-5 gap-2">
          <div className="sm:col-span-2">
            <Label className="text-[11px] text-zinc-400">Descrição</Label>
            <Input value={form.label} onChange={(e) => setForm(p => ({ ...p, label: e.target.value }))} placeholder="Ex.: comissão Mondial R$0,75" className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm" />
          </div>
          <div>
            <Label className="text-[11px] text-zinc-400">Valor</Label>
            <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))} className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm" />
          </div>
          <div>
            <Label className="text-[11px] text-zinc-400">Período</Label>
            <Select value={form.period} onValueChange={(v) => setForm(p => ({ ...p, period: v as any }))}>
              <SelectTrigger className="bg-zinc-800/60 border-zinc-700 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                {PERIOD_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleAdd} disabled={createMut.isPending} className="h-9 w-full bg-[#D4AF37] hover:bg-[#BE9F30] text-black">
              <Plus className="h-4 w-4 mr-1.5" />Adicionar
            </Button>
          </div>
        </div>
        <Input value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notas (opcional)" className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm" />
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-zinc-900/60 text-zinc-400 uppercase tracking-wider">
            <tr>
              <th className="text-left p-2">Descrição</th>
              <th className="text-right p-2">Valor</th>
              <th className="text-left p-2">Período</th>
              <th className="text-left p-2">Notas</th>
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-zinc-500">Sem custos fixos lançados.</td></tr>
            ) : rows.map((r: any) => (
              <tr key={r.id} className="border-t border-zinc-800/60">
                <td className="p-2 text-zinc-200">{r.label}</td>
                <td className="p-2 text-right font-mono text-rose-300">{fmtCurrency(r.amount)}</td>
                <td className="p-2 text-zinc-400 capitalize">{r.period.replace("_", " ")}</td>
                <td className="p-2 text-zinc-500 max-w-[200px] truncate">{r.notes || "—"}</td>
                <td className="p-2 text-right">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:bg-red-500/10" onClick={() => deleteMut.mutate({ id: r.id })}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ──────────────────────── TAB: Estoque multi-depósito ──────────────────────── */

function StockTab({ productId }: { productId: number }) {
  const utils = trpc.useUtils();
  const warehousesQuery = trpc.productCatalog.warehouseList.useQuery();
  const stocksQuery = trpc.productCatalog.stockList.useQuery({ productId });
  const [drafts, setDrafts] = useState<Record<number, { quantity: string; minStock: string; maxStock: string }>>({});

  const warehouses = warehousesQuery.data ?? [];
  const stocks = stocksQuery.data ?? [];

  const stockByWh = useMemo(() => {
    const m = new Map<number, any>();
    for (const s of stocks as any[]) m.set(s.warehouseId, s);
    return m;
  }, [stocks]);

  const upsertMut = trpc.productCatalog.stockUpsert.useMutation({
    onSuccess: () => {
      toast.success("Estoque atualizado.");
      utils.productCatalog.stockList.invalidate({ productId });
    },
    onError: (err) => toast.error(err.message),
  });

  const getDraft = (warehouseId: number) => {
    const current = drafts[warehouseId];
    if (current) return current;
    const row = stockByWh.get(warehouseId);
    return {
      quantity: row ? String(row.quantity) : "0",
      minStock: row ? String(row.minStock) : "0",
      maxStock: row?.maxStock != null ? String(row.maxStock) : "",
    };
  };

  const handleSave = (warehouseId: number) => {
    const d = getDraft(warehouseId);
    upsertMut.mutate({
      productId,
      warehouseId,
      quantity: parseInt(d.quantity || "0", 10),
      minStock: parseInt(d.minStock || "0", 10),
      maxStock: d.maxStock ? parseInt(d.maxStock, 10) : undefined,
    });
  };

  const totalQty = stocks.reduce((s: number, r: any) => s + (Number(r.quantity) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-400">Total geral</div>
          <div className="text-2xl font-bold text-[#D4AF37]">{totalQty} <span className="text-sm text-zinc-500 font-normal">un.</span></div>
        </div>
        <Badge variant="outline" className="border-zinc-700 text-zinc-400">
          {warehouses.length} depósito{warehouses.length !== 1 ? "s" : ""} cadastrado{warehouses.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {warehouses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-400">
          Nenhum depósito cadastrado. Vá em <a href="/configuracoes?tab=Depositos" className="text-[#D4AF37] hover:underline">Configurações › Depósitos</a>.
        </div>
      ) : (
        <div className="space-y-2">
          {warehouses.map((w: any) => {
            const draft = getDraft(w.id);
            const row = stockByWh.get(w.id);
            return (
              <div key={w.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Warehouse className="h-4 w-4 text-[#D4AF37]" />
                    <span className="text-sm font-semibold text-zinc-100">{w.name}</span>
                    {w.isDefault === 1 && <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30 text-[10px]">Padrão</Badge>}
                  </div>
                  {row && row.minStock > 0 && row.quantity < row.minStock && (
                    <Badge className="bg-rose-500/15 text-rose-300 border-rose-500/30 text-[10px]">Abaixo do mínimo</Badge>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 items-end">
                  <div>
                    <Label className="text-[10px] text-zinc-400">Qtd atual</Label>
                    <Input type="number" value={draft.quantity} onChange={(e) => setDrafts(p => ({ ...p, [w.id]: { ...draft, quantity: e.target.value } }))} className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-zinc-400">Mínimo</Label>
                    <Input type="number" value={draft.minStock} onChange={(e) => setDrafts(p => ({ ...p, [w.id]: { ...draft, minStock: e.target.value } }))} className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-zinc-400">Máximo</Label>
                    <Input type="number" value={draft.maxStock} onChange={(e) => setDrafts(p => ({ ...p, [w.id]: { ...draft, maxStock: e.target.value } }))} placeholder="(opcional)" className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm" />
                  </div>
                  <Button onClick={() => handleSave(w.id)} disabled={upsertMut.isPending} className="h-9 bg-[#D4AF37] hover:bg-[#BE9F30] text-black">
                    <Save className="h-3.5 w-3.5 mr-1.5" />Salvar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────── TAB: Kit ──────────────────────── */

function KitTab({ productId }: { productId: number }) {
  const utils = trpc.useUtils();
  const itemsQuery = trpc.productCatalog.kitItemList.useQuery({ kitProductId: productId });
  const productsQuery = trpc.products.list.useQuery({ limit: 500 });

  const [componentId, setComponentId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");

  const addMut = trpc.productCatalog.kitItemAdd.useMutation({
    onSuccess: () => {
      toast.success("Componente adicionado.");
      setComponentId("");
      setQuantity("1");
      utils.productCatalog.kitItemList.invalidate({ kitProductId: productId });
    },
    onError: (err) => toast.error(err.message),
  });
  const removeMut = trpc.productCatalog.kitItemRemove.useMutation({
    onSuccess: () => {
      toast.success("Componente removido.");
      utils.productCatalog.kitItemList.invalidate({ kitProductId: productId });
    },
    onError: (err) => toast.error(err.message),
  });

  const items = itemsQuery.data ?? [];
  const allProducts = productsQuery.data ?? [];
  const productMap = useMemo(() => {
    const m = new Map<number, any>();
    for (const p of allProducts as any[]) m.set(p.id, p);
    return m;
  }, [allProducts]);

  const usedIds = new Set(items.map((i: any) => i.componentProductId));
  const candidates = (allProducts as any[]).filter(p => p.id !== productId && !usedIds.has(p.id));

  const handleAdd = () => {
    if (!componentId) {
      toast.error("Selecione um produto.");
      return;
    }
    const q = parseInt(quantity, 10);
    if (!q || q < 1) {
      toast.error("Quantidade inválida.");
      return;
    }
    addMut.mutate({
      kitProductId: productId,
      componentProductId: parseInt(componentId, 10),
      quantity: q,
    });
  };

  // custo estimado do kit = soma dos componentes × qtd
  const kitCost = items.reduce((sum: number, it: any) => {
    const comp = productMap.get(it.componentProductId);
    const unit = Number(comp?.valorProduto ?? 0);
    return sum + unit * Number(it.quantity);
  }, 0);
  const kitPrice = items.reduce((sum: number, it: any) => {
    const comp = productMap.get(it.componentProductId);
    const unit = Number(comp?.precoFinal ?? 0);
    return sum + unit * Number(it.quantity);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-xs uppercase tracking-wider text-zinc-400">Custo estimado do kit</div>
          <div className="text-2xl font-bold text-rose-300 mt-1">{fmtCurrency(kitCost)}</div>
          <div className="text-[10px] text-zinc-500 mt-1">Soma do valor Mondial dos componentes</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-xs uppercase tracking-wider text-zinc-400">Venda estimada</div>
          <div className="text-2xl font-bold text-emerald-300 mt-1">{fmtCurrency(kitPrice)}</div>
          <div className="text-[10px] text-zinc-500 mt-1">Soma do preço final dos componentes</div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Adicionar componente</h3>
        <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-end">
          <div>
            <Label className="text-[11px] text-zinc-400">Produto</Label>
            <Select value={componentId} onValueChange={setComponentId}>
              <SelectTrigger className="bg-zinc-800/60 border-zinc-700 h-9 text-sm">
                <SelectValue placeholder="Selecionar produto" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-h-80">
                {candidates.length === 0 ? (
                  <div className="p-2 text-xs text-zinc-500">Nenhum produto disponível.</div>
                ) : candidates.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    <span className="font-mono text-xs text-zinc-400 mr-2">{p.sku}</span>
                    {p.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-zinc-400">Qtd</Label>
            <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="bg-zinc-800/60 border-zinc-700 text-zinc-100 h-9 text-sm" />
          </div>
          <Button onClick={handleAdd} disabled={addMut.isPending} className="h-9 bg-[#D4AF37] hover:bg-[#BE9F30] text-black">
            <Plus className="h-4 w-4 mr-1.5" />Adicionar
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-zinc-900/60 text-zinc-400 uppercase tracking-wider">
            <tr>
              <th className="text-left p-2">SKU</th>
              <th className="text-left p-2">Produto</th>
              <th className="text-center p-2">Qtd</th>
              <th className="text-right p-2">Custo unit.</th>
              <th className="text-right p-2">Subtotal</th>
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-zinc-500">Kit sem componentes. Adicione acima.</td></tr>
            ) : items.map((it: any) => {
              const comp = productMap.get(it.componentProductId);
              const unit = Number(comp?.valorProduto ?? 0);
              const sub = unit * Number(it.quantity);
              return (
                <tr key={it.id} className="border-t border-zinc-800/60">
                  <td className="p-2 font-mono text-zinc-400">{comp?.sku ?? `#${it.componentProductId}`}</td>
                  <td className="p-2 text-zinc-200">{comp?.titulo ?? "—"}</td>
                  <td className="p-2 text-center text-zinc-300">×{it.quantity}</td>
                  <td className="p-2 text-right font-mono text-zinc-400">{fmtCurrency(unit)}</td>
                  <td className="p-2 text-right font-mono text-zinc-200">{fmtCurrency(sub)}</td>
                  <td className="p-2 text-right">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:bg-red-500/10" onClick={() => removeMut.mutate({ id: it.id })}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
