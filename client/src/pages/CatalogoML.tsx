import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { RefreshCw, Search, TrendingUp, TrendingDown, Minus, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";

type Product = {
  id: number;
  mlItemId: string;
  accountName: string;
  title: string;
  sku: string | null;
  imageUrl: string | null;
  salePrice: string;
  costPrice: string;
  packagingCost: string;
  platformFeePercent: string;
  taxPercent: string;
  status: string;
  lastSyncAt: Date | null;
};

const ACCOUNTS = ["Todas", "CLICKMULTII", "DUOULTILIDADE", "KAIBRENLTDA"];

const ACCOUNT_COLORS: Record<string, string> = {
  CLICKMULTII: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DUOULTILIDADE: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  KAIBRENLTDA: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

function fmt(v: string | number | null | undefined) {
  const n = Number(String(v ?? "0").replace(",", "."));
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const IMPOSTO_PERCENT = 9.3;

// Comissão Everton (gerente Mondial): custo < R$5 → R$0,40 / ≥ R$5 → R$0,90
function calcEverton(custo: number): number {
  if (custo <= 0) return 0;
  return custo < 5 ? 0.40 : 0.90;
}

// Taxas reais ML (Clássico Eletrônicos): comissão 13% + taxa fixa por faixa + frete grátis acima R$79
function calcMlFees(sale: number): number {
  if (sale <= 0) return 0;
  const commission = sale * 0.13;
  let fixedFee = 0;
  if (sale >= 12.50 && sale < 29) fixedFee = 6.25;
  else if (sale >= 29 && sale < 50) fixedFee = 6.50;
  else if (sale >= 50 && sale < 79) fixedFee = 6.75;
  const frete = sale >= 79 ? 16 : 0;
  return commission + fixedFee + frete;
}

function calcMargin(salePrice: string, costPrice: string, packagingCost: string, platformFeePercent?: string, taxPercent?: string) {
  const sale = Number(salePrice);
  const custoBase = Number(costPrice);
  const everton = calcEverton(custoBase);
  const cost = custoBase + Number(packagingCost) + everton;
  // Comissão: usa platformFeePercent se > 0, senão calcula pelas faixas reais ML
  const platformFee = Number(platformFeePercent ?? "0") > 0
    ? sale * (Number(platformFeePercent) / 100)
    : calcMlFees(sale);
  // Imposto: usa taxPercent do anúncio se > 0, senão usa Simples Nacional global
  const taxPctEff = Number(taxPercent ?? "0") > 0 ? Number(taxPercent) : IMPOSTO_PERCENT;
  const tax = sale * (taxPctEff / 100);
  if (sale <= 0) return null;
  const lucroReal = sale - platformFee - tax - cost;
  return (lucroReal / sale) * 100;
}

function MarginBadge({ margin }: { margin: number | null }) {
  if (margin === null) return <span className="text-zinc-500 text-xs">—</span>;
  if (margin >= 30) return (
    <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
      <TrendingUp size={12} />{margin.toFixed(1)}%
    </span>
  );
  if (margin >= 10) return (
    <span className="flex items-center gap-1 text-yellow-400 text-xs font-medium">
      <Minus size={12} />{margin.toFixed(1)}%
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-red-400 text-xs font-medium">
      <TrendingDown size={12} />{margin.toFixed(1)}%
    </span>
  );
}

function EditCostsRow({ product, onSave, onCancel }: {
  product: Product;
  onSave: (costPrice: string, packagingCost: string, platformFeePercent: string, taxPercent: string) => void;
  onCancel: () => void;
}) {
  const [cost, setCost] = useState(product.costPrice ?? "0");
  const [pkg, setPkg] = useState(product.packagingCost ?? "0");
  const [fee, setFee] = useState(product.platformFeePercent ?? "0");
  const [tax, setTax] = useState(product.taxPercent ?? "0");
  return (
    <TableRow className="bg-zinc-800/60">
      <TableCell colSpan={2} className="py-2 px-3">
        <span className="text-xs text-zinc-400 truncate max-w-[200px] block">{product.title}</span>
      </TableCell>
      <TableCell className="py-2">
        <Input value={cost} onChange={e => setCost(e.target.value)} className="h-7 w-24 text-xs" placeholder="Custo" />
      </TableCell>
      <TableCell className="py-2 text-right text-xs text-purple-400/60">
        {calcEverton(Number(cost) || 0) > 0 ? fmt(calcEverton(Number(cost) || 0)) : "—"}
      </TableCell>
      <TableCell className="py-2">
        <Input value={pkg} onChange={e => setPkg(e.target.value)} className="h-7 w-24 text-xs" placeholder="Embalagem" />
      </TableCell>
      <TableCell className="py-2">
        <Input value={fee} onChange={e => setFee(e.target.value)} className="h-7 w-20 text-xs" placeholder="Taxa %" />
      </TableCell>
      <TableCell className="py-2">
        <Input value={tax} onChange={e => setTax(e.target.value)} className="h-7 w-20 text-xs" placeholder="Imposto %" />
      </TableCell>
      <TableCell className="py-2" colSpan={2}>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-green-400" onClick={() => onSave(cost, pkg, fee, tax)}>
            <Check size={14} />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-zinc-400" onClick={onCancel}>
            <X size={14} />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function CatalogoML() {
  const [accountFilter, setAccountFilter] = useState("Todas");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: products = [], isLoading, refetch } = trpc.listMLCatalog.useQuery(
    accountFilter !== "Todas" ? { accountName: accountFilter } : {}
  );

  const syncMutation = trpc.syncMLCatalog.useMutation({
    onSuccess: (r) => {
      toast.success(`Sincronizados ${r.synced} produtos de ${r.accounts.join(", ")}`);
      refetch();
    },
    onError: (e) => toast.error(`Erro ao sincronizar: ${e.message}`),
  });

  const updateCostsMutation = trpc.updateMLProductCosts.useMutation({
    onSuccess: () => { toast.success("Custos salvos"); setEditingId(null); refetch(); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const filtered = products.filter((p: Product) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku ?? "").toLowerCase().includes(search.toLowerCase()) ||
    p.mlItemId.toLowerCase().includes(search.toLowerCase())
  );

  // Resumo por conta
  const summary = ACCOUNTS.slice(1).map(acc => {
    const accProducts = products.filter((p: Product) => p.accountName === acc);
    const margins = accProducts.map((p: Product) => calcMargin(p.salePrice, p.costPrice, p.packagingCost, p.platformFeePercent, p.taxPercent)).filter(m => m !== null) as number[];
    const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : null;
    return { acc, count: accProducts.length, avgMargin };
  });

  return (
    <DashboardLayout activeSection="catalogo-ml">
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Catálogo ML</h1>
            <p className="text-sm text-zinc-400">Produtos das 3 contas com margem de lucro real</p>
          </div>
          <Button
            onClick={() => syncMutation.mutate(accountFilter !== "Todas" ? { accountName: accountFilter } : {})}
            disabled={syncMutation.isPending}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw size={15} className={syncMutation.isPending ? "animate-spin" : ""} />
            {syncMutation.isPending ? "Sincronizando..." : "Sincronizar ML"}
          </Button>
        </div>

        {/* Cards por conta */}
        <div className="grid grid-cols-3 gap-3">
          {summary.map(({ acc, count, avgMargin }) => (
            <Card key={acc} className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-3">
                <div className="text-xs text-zinc-400 mb-1">{acc}</div>
                <div className="text-lg font-bold text-white">{count}</div>
                <div className="text-xs text-zinc-500">produtos</div>
                {avgMargin !== null && (
                  <div className="mt-1"><MarginBadge margin={avgMargin} /></div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Buscar por título, SKU ou ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 bg-zinc-900 border-zinc-700 text-sm"
            />
          </div>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-44 bg-zinc-900 border-zinc-700 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNTS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-zinc-400 text-sm">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 text-sm">
                {products.length === 0
                  ? "Nenhum produto. Clique em \"Sincronizar ML\" para importar."
                  : "Nenhum produto encontrado."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400 text-xs w-12">Img</TableHead>
                    <TableHead className="text-zinc-400 text-xs">Produto</TableHead>
                    <TableHead className="text-zinc-400 text-xs">Conta</TableHead>
                    <TableHead className="text-zinc-400 text-xs text-right">Custo</TableHead>
                    <TableHead className="text-zinc-400 text-xs text-right" title="Comissão Everton: <R$5=R$0,40 / ≥R$5=R$0,90">Everton</TableHead>
                    <TableHead className="text-zinc-400 text-xs text-right">Embalagem</TableHead>
                    <TableHead className="text-zinc-400 text-xs text-right">Taxa %</TableHead>
                    <TableHead className="text-zinc-400 text-xs text-right">Imposto %</TableHead>
                    <TableHead className="text-zinc-400 text-xs text-right">Venda</TableHead>
                    <TableHead className="text-zinc-400 text-xs text-right">Margem</TableHead>
                    <TableHead className="text-zinc-400 text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p: Product) =>
                    editingId === p.id ? (
                      <EditCostsRow
                        key={p.id}
                        product={p}
                        onSave={(costPrice, packagingCost, platformFeePercent, taxPercent) =>
                          updateCostsMutation.mutate({ id: p.id, costPrice, packagingCost, platformFeePercent, taxPercent })
                        }
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <TableRow key={p.id} className="border-zinc-800 hover:bg-zinc-800/40">
                        <TableCell className="py-2 px-3">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center text-zinc-500 text-xs">?</div>
                          )}
                        </TableCell>
                        <TableCell className="py-2 px-3 max-w-[220px]">
                          <div className="text-xs text-white truncate font-medium">{p.title}</div>
                          {p.sku && <div className="text-xs text-zinc-500 mt-0.5">SKU: {p.sku}</div>}
                          <div className="text-xs text-zinc-600 mt-0.5">{p.mlItemId}</div>
                        </TableCell>
                        <TableCell className="py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ACCOUNT_COLORS[p.accountName] ?? "bg-zinc-700/20 text-zinc-400 border-zinc-600"}`}>
                            {p.accountName}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right text-xs text-zinc-300">{fmt(p.costPrice)}</TableCell>
                        <TableCell className="py-2 text-right text-xs text-purple-400">{calcEverton(Number(p.costPrice)) > 0 ? fmt(calcEverton(Number(p.costPrice))) : "—"}</TableCell>
                        <TableCell className="py-2 text-right text-xs text-cyan-400">{fmt(p.packagingCost)}</TableCell>
                        <TableCell className="py-2 text-right text-xs text-zinc-400">{Number(p.platformFeePercent ?? 0).toFixed(1)}%</TableCell>
                        <TableCell className="py-2 text-right text-xs text-zinc-400">{Number(p.taxPercent ?? 0).toFixed(1)}%</TableCell>
                        <TableCell className="py-2 text-right text-xs text-white font-medium">{fmt(p.salePrice)}</TableCell>
                        <TableCell className="py-2 text-right">
                          <MarginBadge margin={calcMargin(p.salePrice, p.costPrice, p.packagingCost, p.platformFeePercent, p.taxPercent)} />
                        </TableCell>
                        <TableCell className="py-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-zinc-400 hover:text-white"
                            onClick={() => setEditingId(p.id)}
                          >
                            <Edit2 size={13} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
