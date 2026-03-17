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
import { PackageSearch, Plus, RotateCcw, Save } from "lucide-react";
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
      ? "Você está vendo a tabela que paga à Mondial."
      : "Você está vendo a tabela de revenda para o cliente.";

  function getEditingValues(product: ProductRow): ProductEditValues {
    return editingValues[product.id] ?? {
      valorProduto: String(product.valorProduto ?? "0"),
      precoFinal: String(product.precoFinal ?? product.precoDesejado ?? "0"),
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
      <div className="flex flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-[#1C1C1C] via-[#2A2A2A] to-[#3B3B3B] text-white shadow-sm">
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-8">
            <div className="space-y-4">
              <Badge variant="secondary" className="w-fit rounded-full border-0 bg-[#D4AF37]/20 px-3 py-1 text-xs font-medium text-[#F5F2E9]">
                Catálogo KaiBren
              </Badge>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight">Produtos</h1>
                <p className="max-w-2xl text-sm leading-6 text-[#F5F2E9]/85">
                  A tela mostra por padrão a tabela que você paga à Mondial. Quando quiser consultar a outra base, basta trocar o filtro para a tabela de revenda e os valores exibidos mudam na hora.
                </p>
              </div>
            </div>
            <Card className="border-white/10 bg-white/5 text-white shadow-none">
              <CardHeader>
                <CardTitle className="text-base text-white">Resumo do catálogo</CardTitle>
                <CardDescription className="text-[#F5F2E9]/75">Visão rápida da base de produtos disponível para pedidos.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-wide text-[#F5F2E9]/70">Produtos visíveis</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{visibleProducts.length}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-wide text-[#F5F2E9]/70">Tabela exibida</div>
                  <div className="mt-2 text-sm font-medium text-white">{selectedTableLabel}</div>
                  <div className="mt-1 text-xs text-[#F5F2E9]/75">{selectedValueDescription}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><Plus className="h-5 w-5" /> Cadastrar novo SKU</CardTitle>
              <CardDescription>Adicione manualmente novos produtos para usar nos pedidos e no catálogo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={draft.sku} onChange={event => setDraft(current => ({ ...current, sku: event.target.value }))} placeholder="Ex.: 1193-99" />
              </div>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={draft.titulo} onChange={event => setDraft(current => ({ ...current, titulo: event.target.value }))} placeholder="Nome do produto" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Valor Mondial</Label>
                  <Input value={draft.valorProduto} onChange={event => setDraft(current => ({ ...current, valorProduto: normalizeMoneyInput(event.target.value) }))} placeholder="R$ 0,00" />
                </div>
                <div className="space-y-2">
                  <Label>Valor de revenda</Label>
                  <Input value={draft.precoFinal} onChange={event => setDraft(current => ({ ...current, precoFinal: normalizeMoneyInput(event.target.value) }))} placeholder="R$ 0,00" />
                </div>
              </div>
              <Button className="w-full" onClick={handleCreateProduct} disabled={importSpreadsheetMutation.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar produto
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><PackageSearch className="h-5 w-5" /> Produtos cadastrados</CardTitle>
              <CardDescription>Em telas pequenas, cada produto aparece em cartão para facilitar a leitura. O filtro alterna entre a tabela de custo Mondial e a tabela de revenda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
                <div className="space-y-2">
                  <Label>Buscar produto</Label>
                  <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por SKU ou nome do produto" />
                </div>
                <div className="space-y-2">
                  <Label>Tabela exibida</Label>
                  <Select value={priceView} onValueChange={value => setPriceView(value as "cost" | "resale")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha a tabela" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cost">Tabela de custo Mondial</SelectItem>
                      <SelectItem value="resale">Tabela de revenda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="lg:self-end"
                  onClick={() => restoreLatestUploadMutation.mutate()}
                  disabled={restoreLatestUploadMutation.isPending}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {restoreLatestUploadMutation.isPending ? "Restaurando catálogo..." : "Restaurar último upload"}
                </Button>
              </div>

              {hasQueryError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900">
                  <p className="font-medium">Não consegui carregar os SKUs neste momento.</p>
                  <p className="mt-2 text-amber-800/90">{queryErrorMessage}</p>
                  <p className="mt-2 text-amber-800/90">Atualize a página. Se continuar vazio, entre novamente no sistema para restaurar a sessão e recarregar o catálogo.</p>
                </div>
              ) : visibleProducts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
                  <p>Nenhum produto encontrado para essa busca.</p>
                  <p className="mt-2">Se seus SKUs sumiram, use o botão <strong>Restaurar último upload</strong> para recuperar o catálogo salvo.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 lg:hidden">
                    {visibleProducts.map(product => {
                      const editing = getEditingValues(product);
                      return (
                        <div key={product.id} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SKU {product.sku}</div>
                              <h3 className="text-sm font-semibold leading-5 text-foreground">{product.titulo}</h3>
                            </div>
                            <Button size="sm" onClick={() => handleSaveProduct(product)} disabled={updatePricingMutation.isPending}>
                              <Save className="mr-2 h-4 w-4" />
                              Salvar
                            </Button>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-wide text-muted-foreground">{priceView === "cost" ? "Valor Mondial" : "Valor de revenda"}</Label>
                              <div className="flex items-center rounded-md border border-input bg-background px-3">
                                <span className="mr-2 text-sm text-muted-foreground">R$</span>
                                <Input
                                  className="border-0 px-0 shadow-none focus-visible:ring-0"
                                  value={getPrimaryValue(product, editing)}
                                  onChange={event => setPrimaryValue(product.id, editing, event.target.value)}
                                  placeholder="0,00"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-wide text-muted-foreground">{priceView === "cost" ? "Valor de revenda" : "Valor Mondial"}</Label>
                              <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm font-medium text-foreground">
                                {priceView === "cost" ? formatCurrency(editing.precoFinal) : formatCurrency(editing.valorProduto)}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 rounded-xl bg-muted/40 p-3 sm:grid-cols-2">
                            <div>
                              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Lucro atual</div>
                              <div className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(product.lucro)}</div>
                            </div>
                            <div>
                              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Margem atual</div>
                              <div className="mt-1 text-sm font-semibold text-foreground">{formatPercent(product.margemFinal)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden rounded-2xl border border-border/60 lg:block">
                    <div className="border-b border-border/60 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                      Arraste a barra horizontal inferior para o lado e veja todas as colunas da tabela.
                    </div>
                    <div className="max-w-full overflow-x-scroll overflow-y-hidden border-t border-border/40 pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                      <div className="min-w-[1180px]">
                        <div className="max-h-[620px] overflow-y-auto">
                          <Table className="min-w-[1180px]">
                            <TableHeader>
                              <TableRow>
                                <TableHead>SKU</TableHead>
                                <TableHead className="min-w-[420px]">Título do produto</TableHead>
                                <TableHead className="min-w-[220px]">{selectedValueLabel}</TableHead>
                                <TableHead className="min-w-[220px]">{priceView === "cost" ? "Valor de revenda" : "Valor Mondial"}</TableHead>
                                <TableHead>Lucro Atual</TableHead>
                                <TableHead>Margem Atual</TableHead>
                                <TableHead className="text-right">Salvar</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {visibleProducts.map(product => {
                                const editing = getEditingValues(product);
                                return (
                                  <TableRow key={product.id}>
                                    <TableCell className="font-medium whitespace-nowrap">{product.sku}</TableCell>
                                    <TableCell className="min-w-[420px] max-w-[420px] whitespace-normal break-words leading-5">{product.titulo}</TableCell>
                                    <TableCell>
                                      <div className="min-w-[220px] space-y-1">
                                        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{selectedValueLabel}</div>
                                        <div className="flex items-center rounded-md border border-input bg-background px-3">
                                          <span className="mr-2 text-sm text-muted-foreground">R$</span>
                                          <Input
                                            className="border-0 px-0 shadow-none focus-visible:ring-0"
                                            value={getPrimaryValue(product, editing)}
                                            onChange={event => setPrimaryValue(product.id, editing, event.target.value)}
                                            placeholder="0,00"
                                          />
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="min-w-[220px] space-y-1">
                                        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                          {priceView === "cost" ? "Valor de revenda" : "Valor Mondial"}
                                        </div>
                                        <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm font-medium text-foreground">
                                          {priceView === "cost" ? formatCurrency(editing.precoFinal) : formatCurrency(editing.valorProduto)}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell>{formatCurrency(product.lucro)}</TableCell>
                                    <TableCell>{formatPercent(product.margemFinal)}</TableCell>
                                    <TableCell className="text-right whitespace-nowrap">
                                      <Button size="sm" onClick={() => handleSaveProduct(product)} disabled={updatePricingMutation.isPending}>
                                        <Save className="mr-2 h-4 w-4" />
                                        Salvar
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
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
