import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { PackageSearch, Plus, RotateCcw, Save, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

type ProductRow = {
  id: number;
  sku: string;
  titulo: string;
  tabelaNovaCk: string;
  imposto: string;
  comissao: string;
  valorProduto: string;
  precoDesejado: string;
  margemDesejada: string | null;
  precoFinal: string;
  margemFinal: string;
  lucro: string;
};

type ProductDraft = {
  sku: string;
  titulo: string;
  valorProduto: string;
  precoFinal: string;
};

type ProductEditValues = {
  valorProduto: string;
  precoFinal: string;
};

const emptyDraft: ProductDraft = {
  sku: "",
  titulo: "",
  valorProduto: "",
  precoFinal: "",
};

function formatCurrency(value: string | number | null | undefined) {
  const amount = Number(String(value ?? 0).replace(",", "."));
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalizeMoneyInput(raw: string) {
  return raw.replace(/[^\d,.-]/g, "");
}

function formatPercent(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("pt-BR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Products() {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [editingValues, setEditingValues] = useState<Record<number, ProductEditValues>>({});
  const [priceView, setPriceView] = useState<"cost" | "resale">("cost");
  const [showNewProduct, setShowNewProduct] = useState(false);

  const utils = trpc.useUtils();
  const productsQuery = trpc.products.list.useQuery({ limit: 500 });

  const updatePricingMutation = trpc.products.updatePricing.useMutation({
    onSuccess: async updated => {
      toast.success(`Produto ${updated.sku} atualizado com sucesso.`);
      await utils.products.list.invalidate();
      await utils.products.search.invalidate();
      setEditingValues(current => {
        const next = { ...current };
        delete next[updated.id];
        return next;
      });
    },
    onError: error => toast.error(error.message),
  });

  const importSpreadsheetMutation = trpc.products.importSpreadsheet.useMutation({
    onSuccess: async () => {
      toast.success(`Produto ${draft.sku} cadastrado com sucesso.`);
      setDraft(emptyDraft);
      setShowNewProduct(false);
      await utils.products.list.invalidate();
      await utils.products.search.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const restoreLatestUploadMutation = trpc.products.restoreLatestUpload.useMutation({
    onSuccess: async data => {
      toast.success(`${data.replaced.inserted} SKUs restaurados do arquivo ${data.fileName}.`);
      await utils.products.list.invalidate();
      await utils.products.search.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const visibleProducts = useMemo(() => {
    const items = (productsQuery.data ?? []) as ProductRow[];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;

    return items.filter(product => {
      const sku = product.sku.toLowerCase();
      const titulo = product.titulo.toLowerCase();
      return sku.includes(normalized) || titulo.includes(normalized);
    });
  }, [productsQuery.data, query]);

  const hasQueryError = productsQuery.isError;
  const queryErrorMessage = productsQuery.error?.message ?? "Não foi possível carregar os produtos agora.";
  const selectedTableLabel = priceView === "cost" ? "Tabela de custo Mondial" : "Tabela de revenda";
  const selectedValueLabel = priceView === "cost" ? "Valor Mondial" : "Valor de revenda";
  const selectedValueDescription =
    priceView === "cost"
      ? "Tabela que paga à Mondial."
      : "Tabela de revenda para o cliente.";

  function formatMoneyDisplay(value: string | number | null | undefined): string {
    const num = Number(String(value ?? "0").replace(",", "."));
    if (isNaN(num) || num === 0) return "0,00";
    return num.toFixed(2).replace(".", ",");
  }

  function getEditingValues(product: ProductRow): ProductEditValues {
    return editingValues[product.id] ?? {
      valorProduto: formatMoneyDisplay(product.valorProduto),
      precoFinal: formatMoneyDisplay(product.precoFinal ?? product.precoDesejado),
    };
  }

  function getPrimaryValue(product: ProductRow, editing: ProductEditValues) {
    return priceView === "cost" ? editing.valorProduto : editing.precoFinal;
  }

  function setPrimaryValue(productId: number, editing: ProductEditValues, value: string) {
    setEditingValues(current => ({
      ...current,
      [productId]: priceView === "cost"
        ? { ...editing, valorProduto: normalizeMoneyInput(value) }
        : { ...editing, precoFinal: normalizeMoneyInput(value) },
    }));
  }

  async function handleCreateProduct() {
    if (!draft.sku.trim() || !draft.titulo.trim()) {
      toast.error("Preencha SKU e título para cadastrar o produto.");
      return;
    }

    await importSpreadsheetMutation.mutateAsync({
      fileName: `cadastro-manual-${draft.sku.trim()}.xlsx`,
      fileContentBase64: "",
      sourceSheetName: "Cadastro manual",
      products: [
        {
          SKU: draft.sku.trim(),
          Título: draft.titulo.trim(),
          "Tabela Nova CK": draft.precoFinal || 0,
          Imposto: 0,
          Comissão: 0.75,
          "Valor Produto": draft.valorProduto || 0,
          "Preço Desejado": draft.precoFinal || 0,
          "Margem Desejada": 0,
          "Preço Final": draft.precoFinal || 0,
          "Margem Final": 0,
          Lucro: 0,
        },
      ],
    });
  }

  async function handleSaveProduct(product: ProductRow) {
    const editing = getEditingValues(product);
    await updatePricingMutation.mutateAsync({
      id: product.id,
      valorProduto: editing.valorProduto || "0",
      precoFinal: editing.precoFinal || "0",
      imposto: product.imposto || "0",
      comissao: product.comissao || "0.75",
    });
  }

  return (
    <DashboardLayout activeSection="produtos">
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* ── Header ── */}
        <div className="overflow-hidden rounded-2xl sm:rounded-[28px] border border-border/60 bg-gradient-to-br from-[#1C1C1C] via-[#2A2A2A] to-[#3B3B3B] text-white shadow-sm">
          <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <div className="space-y-3 sm:space-y-4">
              <Badge variant="secondary" className="w-fit rounded-full border-0 bg-[#D4AF37]/20 px-3 py-1 text-[10px] sm:text-xs font-medium text-[#F5F2E9]">
                Catálogo KaiBren
              </Badge>
              <h1 className="text-xl sm:text-3xl font-semibold tracking-tight">Produtos</h1>
              <p className="text-xs sm:text-sm leading-5 sm:leading-6 text-[#F5F2E9]/85">
                {selectedValueDescription}
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-[10px] sm:text-xs text-[#F5F2E9]/70 uppercase tracking-wide">Produtos</span>
                  <div className="text-base sm:text-lg font-semibold">{visibleProducts.length}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-[10px] sm:text-xs text-[#F5F2E9]/70 uppercase tracking-wide">Tabela</span>
                  <div className="text-xs sm:text-sm font-medium mt-0.5">{selectedTableLabel}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── New product toggle (mobile-friendly) ── */}
        <div className="lg:hidden">
          <Button
            variant="outline"
            className="w-full h-11 justify-between"
            onClick={() => setShowNewProduct(!showNewProduct)}
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Cadastrar novo SKU
            </span>
            {showNewProduct ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        <section className="grid gap-4 sm:gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          {/* New product form */}
          <Card className={`border-border/60 shadow-sm ${!showNewProduct ? "hidden xl:block" : ""}`}>
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" /> Cadastrar novo SKU
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Adicione manualmente novos produtos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">SKU</Label>
                <Input value={draft.sku} onChange={event => setDraft(current => ({ ...current, sku: event.target.value }))} placeholder="Ex.: 1193-99" className="h-10 text-sm" />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Título</Label>
                <Input value={draft.titulo} onChange={event => setDraft(current => ({ ...current, titulo: event.target.value }))} placeholder="Nome do produto" className="h-10 text-sm" />
              </div>
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Valor Mondial</Label>
                  <Input value={draft.valorProduto} onChange={event => setDraft(current => ({ ...current, valorProduto: normalizeMoneyInput(event.target.value) }))} placeholder="R$ 0,00" className="h-10 text-sm" />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Valor revenda</Label>
                  <Input value={draft.precoFinal} onChange={event => setDraft(current => ({ ...current, precoFinal: normalizeMoneyInput(event.target.value) }))} placeholder="R$ 0,00" className="h-10 text-sm" />
                </div>
              </div>
              <Button className="w-full h-11 text-sm" onClick={handleCreateProduct} disabled={importSpreadsheetMutation.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar produto
              </Button>
            </CardContent>
          </Card>

          {/* Product list */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <PackageSearch className="h-4 w-4 sm:h-5 sm:w-5" /> Produtos cadastrados
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Busque e edite os preços dos produtos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
              {/* Filters */}
              <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-[1fr_180px] lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Buscar produto</Label>
                  <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="SKU ou nome do produto" className="h-10 text-sm" />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Tabela exibida</Label>
                  <Select value={priceView} onValueChange={value => setPriceView(value as "cost" | "resale")}>
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="Escolha a tabela" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cost">Custo Mondial</SelectItem>
                      <SelectItem value="resale">Revenda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 text-sm lg:self-end"
                  onClick={() => restoreLatestUploadMutation.mutate()}
                  disabled={restoreLatestUploadMutation.isPending}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {restoreLatestUploadMutation.isPending ? "Restaurando..." : "Restaurar"}
                </Button>
              </div>

              {hasQueryError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-center text-xs sm:text-sm text-amber-900">
                  <p className="font-medium">Não consegui carregar os SKUs.</p>
                  <p className="mt-1 text-amber-800/90">{queryErrorMessage}</p>
                </div>
              ) : visibleProducts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-xs sm:text-sm text-muted-foreground">
                  <p>Nenhum produto encontrado.</p>
                  <p className="mt-1">Use <strong>Restaurar</strong> para recuperar o catálogo.</p>
                </div>
              ) : (
                <>
                  {/* Mobile: card list */}
                  <div className="space-y-2 lg:hidden">
                    {visibleProducts.map(product => {
                      const editing = getEditingValues(product);
                      const valor = priceView === "cost"
                        ? formatCurrency(product.tabelaNovaCk)
                        : formatCurrency(product.precoFinal);
                      return (
                        <div key={product.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-mono text-muted-foreground">{product.sku}</div>
                            <div className="text-sm font-medium text-foreground leading-5 mt-0.5">{product.titulo}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{priceView === "cost" ? "Custo" : "Venda"}</div>
                            <div className="text-base font-bold text-foreground">{valor}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop: table limpa — SKU | Nome | Valor */}
                  <div className="hidden rounded-2xl border border-border/60 lg:block overflow-hidden">
                    <div className="max-h-[680px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="w-28 text-xs font-semibold uppercase tracking-wide">SKU</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wide">Produto</TableHead>
                            <TableHead className="w-44 text-right text-xs font-semibold uppercase tracking-wide">
                              {priceView === "cost" ? "Custo Mondial" : "Preço de Venda"}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleProducts.map((product, idx) => {
                            const valor = priceView === "cost"
                              ? formatCurrency(product.tabelaNovaCk)
                              : formatCurrency(product.precoFinal);
                            return (
                              <TableRow key={product.id} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                                <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{product.sku}</TableCell>
                                <TableCell className="text-sm font-medium text-foreground leading-5">{product.titulo}</TableCell>
                                <TableCell className="text-right">
                                  <span className={`text-sm font-bold ${priceView === "cost" ? "text-blue-400" : "text-emerald-400"}`}>
                                    {valor}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
