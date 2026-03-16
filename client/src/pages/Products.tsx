import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { PackageSearch, Plus, Save } from "lucide-react";
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

  function getEditingValues(product: ProductRow): ProductEditValues {
    return editingValues[product.id] ?? {
      valorProduto: String(product.valorProduto ?? "0"),
      precoFinal: String(product.precoFinal ?? product.precoDesejado ?? "0"),
    };
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
                  Aqui fica o menu próprio de produtos. Você pode cadastrar novos SKUs e ajustar separadamente o valor pago à Mondial e o valor de venda para o cliente, sem misturar os dois preços.
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
                  <div className="text-xs uppercase tracking-wide text-[#F5F2E9]/70">Busca atual</div>
                  <div className="mt-2 text-sm font-medium text-white">{query.trim() ? query : "Todos os produtos"}</div>
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
                  <Label>Valor de venda ao cliente</Label>
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
              <CardDescription>Edite separadamente o valor pago à Mondial e o valor vendido ao cliente. Os dois preços continuam disponíveis em cada produto.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por SKU ou nome do produto" />
              <div className="overflow-x-auto rounded-2xl border border-border/60">
                <ScrollArea className="h-[620px] w-full">
                  <Table className="min-w-[1180px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead className="min-w-[420px]">Título do produto</TableHead>
                        <TableHead className="min-w-[190px]">Valor Mondial</TableHead>
                        <TableHead className="min-w-[220px]">Valor de venda ao cliente</TableHead>
                        <TableHead>Lucro Atual</TableHead>
                        <TableHead>Margem Atual</TableHead>
                        <TableHead className="text-right">Salvar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleProducts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                            Nenhum produto encontrado para essa busca.
                          </TableCell>
                        </TableRow>
                      ) : (
                        visibleProducts.map(product => {
                          const editing = getEditingValues(product);
                          return (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium whitespace-nowrap">{product.sku}</TableCell>
                              <TableCell className="min-w-[420px] max-w-[420px] whitespace-normal break-words leading-5">{product.titulo}</TableCell>
                              <TableCell>
                                <div className="flex min-w-[190px] items-center rounded-md border border-input bg-background px-3">
                                  <span className="mr-2 text-sm text-muted-foreground">R$</span>
                                  <Input
                                    className="border-0 px-0 shadow-none focus-visible:ring-0"
                                    value={editing.valorProduto}
                                    onChange={event =>
                                      setEditingValues(current => ({
                                        ...current,
                                        [product.id]: { ...editing, valorProduto: normalizeMoneyInput(event.target.value) },
                                      }))
                                    }
                                    placeholder="0,00"
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="min-w-[220px] space-y-1">
                                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Venda ao cliente</div>
                                  <div className="flex items-center rounded-md border border-input bg-background px-3">
                                    <span className="mr-2 text-sm text-muted-foreground">R$</span>
                                    <Input
                                      className="border-0 px-0 shadow-none focus-visible:ring-0"
                                      value={editing.precoFinal}
                                      onChange={event =>
                                        setEditingValues(current => ({
                                          ...current,
                                          [product.id]: { ...editing, precoFinal: normalizeMoneyInput(event.target.value) },
                                        }))
                                      }
                                      placeholder="0,00"
                                    />
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
                        })
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
