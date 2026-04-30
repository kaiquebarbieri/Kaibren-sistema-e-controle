import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ProductDetailDialog } from "@/components/ProductDetailDialog";

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

type SortOption = "sku-asc" | "titulo-asc" | "preco-asc" | "preco-desc";

const emptyDraft: ProductDraft = {
  sku: "",
  titulo: "",
  valorProduto: "",
  precoFinal: "",
};

const DEFAULT_SORT: SortOption = "sku-asc";
const DEFAULT_PAGE_SIZE = 50;

function formatCurrency(value: string | number | null | undefined) {
  const amount = Number(String(value ?? 0).replace(",", "."));
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalizeMoneyInput(raw: string) {
  return raw.replace(/[^\d,.-]/g, "");
}

function toNumber(value: string | number | null | undefined) {
  return Number(String(value ?? "0").replace(",", "."));
}

// Comissão Everton (gerente Mondial): custo < R$5 → R$0,40 / ≥ R$5 → R$0,90
function calcEverton(custo: number): number {
  if (custo <= 0) return 0;
  return custo < 5 ? 0.40 : 0.90;
}

// Embalagem: detector por palavra-chave no título
//   botão (sem bolha)               → R$0,30
//   pequeno c/ bolha (puxador,
//     acoplamento)                  → R$0,95  (etiqueta 0,15 + saco 0,20 + bolha 0,60)
//   grande c/ caixa (cuba, cesto,
//     copo liquidificador, motor)   → R$3,45  (etiqueta 0,15 + caixa 2,65 + bolha 0,65)
//   demais → null (categoria a confirmar com Kaique)
// Imposto Simples Nacional efetivo (TODO: ler de company_tax_rates)
const IMPOSTO_PERCENT = 9.3;

// Taxas reais ML (Clássico Eletrônicos): comissão 13% + taxa fixa por faixa + frete acima R$79
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

// Detecta tipo de peça pelo título (puxador, botão, copo, etc.)
function detectTipo(titulo: string): string | null {
  const t = (titulo || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/^\s*\d+\s*bot/.test(t)) return "botao";
  if (t.includes("anel")) return "anel";
  if (t.includes("comedouro")) return "comedouro";
  if (t.includes("acoplamento") || t.includes("acoplador")) return "acoplamento";
  if (t.includes("puxador") || t.includes("kit ") || t.includes("alca") || t.includes("cabo ")) return "puxador";
  if (t.includes("botao") || t.includes("botoes")) return "botao";
  if (t.includes("copo")) return "copo";
  if (t.includes("cuba")) return "cuba";
  if (t.includes("cesto")) return "cesto";
  if (t.includes("motor")) return "motor";
  if (t.includes("helice")) return "helice";
  if (/\bbase\b/.test(t)) return "base";
  if (t.includes("resistencia")) return "resistencia";
  if (t.includes("caixa")) return "caixa";
  if (t.includes("filtro")) return "filtro";
  if (t.includes("reservatorio")) return "reservatorio";
  if (t.includes("tampa")) return "tampa";
  return null;
}

// Extrai modelos do título (afn-40, naf-03, l-1000, dg-01, 30cm etc)
function extractModelos(titulo: string): Set<string> {
  const t = (titulo || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  const out = new Set<string>();
  const modelRe = /\b([a-z]{1,4}-?\d{2,4}[a-z]{0,3}(?:-?\d+[a-z]*)?)\b/g;
  const sizeRe = /\b(\d{2,3}cm|\d{3}v)\b/g;
  let m;
  while ((m = modelRe.exec(t)) !== null) {
    const v = m[1].toLowerCase();
    out.add(v);
    out.add(v.replace(/-/g, ""));
  }
  while ((m = sizeRe.exec(t)) !== null) {
    out.add(m[1].toLowerCase());
  }
  // só mantém modelos com letra + número
  return new Set([...out].filter((x) => /[a-z]/.test(x) && /\d/.test(x)));
}

function calcEmbalagem(titulo: string): number | null {
  const t = (titulo || "").toLowerCase();
  if (t.includes("botão") || t.includes("botões") || t.includes("botao") || t.includes("botoes") || t.includes("anel") || t.includes("plug")) return 0.30;
  if (t.includes("puxador") || t.includes("acoplamento") || t.includes("acoplador") || t.includes("cabo") || t.includes("alça") || t.includes("alca") || t.includes("kit")) return 0.95;
  if (t.includes("hélice") || t.includes("helice") || t.includes("base") || t.includes("resistência") || t.includes("resistencia") || t.includes("caixa")) return 1.00;
  if (t.includes("cuba") || t.includes("cesto") || t.includes("copo") || t.includes("motor") || t.includes("comedouro")) return 3.45;
  return null;
}

export default function Products() {
  const [query, setQuery] = useState("");
  const [priceView, setPriceView] = useState<"cost" | "resale">("cost");
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [showNewProductDialog, setShowNewProductDialog] = useState(false);
  const [detailProduct, setDetailProduct] = useState<ProductRow | null>(null);

  const utils = trpc.useUtils();
  const productsQuery = trpc.products.list.useQuery({ limit: 500 });
  // Catálogo ML pra cruzar preço de venda real do marketplace por produto (matching tipo+modelo)
  const mlCatalogQuery = trpc.listMLCatalog.useQuery();

  // Pra cada SKU CRM, calcula salePrice médio dos anúncios ML ativos correspondentes (tipo + modelo bate)
  const mlPriceBySku = useMemo(() => {
    const list = mlCatalogQuery.data ?? [];
    const ativos = list.filter((p: any) => p.status === "active" && Number(p.salePrice) > 0);
    const productsList = (productsQuery.data ?? []) as ProductRow[];
    const map = new Map<string, { avgPrice: number; count: number }>();
    for (const prod of productsList) {
      const tipo = detectTipo(prod.titulo);
      const modelos = extractModelos(prod.titulo);
      if (!tipo || modelos.size === 0) { continue; }
      const matched = ativos.filter((a: any) => {
        if (detectTipo(a.title) !== tipo) return false;
        const aModelos = extractModelos(a.title);
        for (const m of modelos) if (aModelos.has(m)) return true;
        return false;
      });
      if (matched.length > 0) {
        const sum = matched.reduce((acc: number, a: any) => acc + Number(a.salePrice), 0);
        map.set(prod.sku, { avgPrice: sum / matched.length, count: matched.length });
      }
    }
    return map;
  }, [productsQuery.data, mlCatalogQuery.data]);

  const importSpreadsheetMutation = trpc.products.importSpreadsheet.useMutation({
    onSuccess: async () => {
      toast.success(`Produto ${draft.sku} cadastrado com sucesso.`);
      setDraft(emptyDraft);
      setShowNewProductDialog(false);
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

  const allProducts = (productsQuery.data ?? []) as ProductRow[];

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const min = minPrice ? toNumber(minPrice) : null;
    const max = maxPrice ? toNumber(maxPrice) : null;

    const filtered = allProducts.filter(product => {
      if (normalized) {
        const sku = product.sku.toLowerCase();
        const titulo = product.titulo.toLowerCase();
        if (!sku.includes(normalized) && !titulo.includes(normalized)) return false;
      }

      if (min !== null || max !== null) {
        const price = priceView === "cost"
          ? toNumber(product.tabelaNovaCk)
          : toNumber(product.precoFinal);
        if (min !== null && price < min) return false;
        if (max !== null && price > max) return false;
      }

      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "titulo-asc":
          return a.titulo.localeCompare(b.titulo, "pt-BR");
        case "preco-asc":
        case "preco-desc": {
          const pa = priceView === "cost" ? toNumber(a.tabelaNovaCk) : toNumber(a.precoFinal);
          const pb = priceView === "cost" ? toNumber(b.tabelaNovaCk) : toNumber(b.precoFinal);
          return sortBy === "preco-asc" ? pa - pb : pb - pa;
        }
        case "sku-asc":
        default:
          return a.sku.localeCompare(b.sku, "pt-BR", { numeric: true });
      }
    });

    return sorted;
  }, [allProducts, query, minPrice, maxPrice, sortBy, priceView]);

  const totalProducts = allProducts.length;
  const resultCount = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(resultCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, resultCount);
  const pageItems = filteredProducts.slice(pageStart, pageEnd);

  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0) +
    (sortBy !== DEFAULT_SORT ? 1 : 0);

  function resetFilters() {
    setQuery("");
    setMinPrice("");
    setMaxPrice("");
    setSortBy(DEFAULT_SORT);
    setPage(1);
  }

  function goToPage(next: number) {
    setPage(Math.min(Math.max(1, next), totalPages));
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

  const hasQueryError = productsQuery.isError;
  const queryErrorMessage = productsQuery.error?.message ?? "Não foi possível carregar os produtos agora.";
  const selectedTableLabel = priceView === "cost" ? "Custo Mondial" : "Revenda";

  return (
    <DashboardLayout activeSection="produtos">
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* ── Header GeFinance-style ── */}
        <div className="overflow-hidden rounded-2xl sm:rounded-[28px] border border-border/60 bg-gradient-to-br from-[#1C1C1C] via-[#2A2A2A] to-[#3B3B3B] text-white shadow-sm">
          <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2 sm:space-y-3">
                <Badge
                  variant="secondary"
                  className="w-fit rounded-full border-0 bg-[#D4AF37]/20 px-3 py-1 text-[10px] sm:text-xs font-medium text-[#F5F2E9]"
                >
                  Catálogo KaiBren
                </Badge>
                <h1 className="text-xl sm:text-3xl font-semibold tracking-tight">Produtos</h1>
                <p className="text-xs sm:text-sm leading-5 sm:leading-6 text-[#F5F2E9]/80">
                  Catálogo Mondial com tabelas de custo e revenda para os marketplaces.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 border-white/20 bg-white/5 text-[#F5F2E9] hover:bg-white/10 hover:text-white"
                  onClick={() => restoreLatestUploadMutation.mutate()}
                  disabled={restoreLatestUploadMutation.isPending}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {restoreLatestUploadMutation.isPending ? "Restaurando..." : "Restaurar"}
                </Button>
                <Button
                  size="sm"
                  className="h-9 bg-[#D4AF37] text-[#1C1C1C] hover:bg-[#C89F2F]"
                  onClick={() => setShowNewProductDialog(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo produto
                </Button>
              </div>
            </div>

            {/* Stats strip */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <span className="block text-[10px] uppercase tracking-wide text-[#F5F2E9]/70">SKUs totais</span>
                <div className="mt-0.5 text-base font-semibold sm:text-lg">{totalProducts}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <span className="block text-[10px] uppercase tracking-wide text-[#F5F2E9]/70">Resultado</span>
                <div className="mt-0.5 text-base font-semibold sm:text-lg">{resultCount}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <span className="block text-[10px] uppercase tracking-wide text-[#F5F2E9]/70">Tabela</span>
                <div className="mt-0.5 text-xs font-medium sm:text-sm">{selectedTableLabel}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <span className="block text-[10px] uppercase tracking-wide text-[#F5F2E9]/70">Página</span>
                <div className="mt-0.5 text-xs font-medium sm:text-sm">{currentPage} de {totalPages}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabela + filtros ── */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="space-y-3 px-4 py-4 sm:space-y-4 sm:px-6 sm:py-5">
            {/* Filter bar — sempre visível */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={event => { setQuery(event.target.value); setPage(1); }}
                  placeholder="Buscar por SKU ou nome do produto"
                  className="h-10 pl-9 text-sm"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Limpar busca"
                    onClick={() => { setQuery(""); setPage(1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5">
                  <button
                    type="button"
                    onClick={() => setPriceView("cost")}
                    className={`h-8 rounded-md px-3 text-xs font-medium transition ${
                      priceView === "cost"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Custo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceView("resale")}
                    className={`h-8 rounded-md px-3 text-xs font-medium transition ${
                      priceView === "resale"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Revenda
                  </button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10"
                  onClick={() => setFiltersOpen(prev => !prev)}
                >
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-2 h-5 min-w-5 rounded-full border-0 bg-[#D4AF37] px-1.5 text-[10px] font-bold text-[#1C1C1C]"
                    >
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>

            {/* Filter panel colapsável */}
            {filtersOpen && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4">
                <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Ordenar por</Label>
                    <Select value={sortBy} onValueChange={value => { setSortBy(value as SortOption); setPage(1); }}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sku-asc">SKU (A-Z)</SelectItem>
                        <SelectItem value="titulo-asc">Nome (A-Z)</SelectItem>
                        <SelectItem value="preco-asc">Preço (menor → maior)</SelectItem>
                        <SelectItem value="preco-desc">Preço (maior → menor)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Preço mínimo</Label>
                    <Input
                      value={minPrice}
                      onChange={event => { setMinPrice(normalizeMoneyInput(event.target.value)); setPage(1); }}
                      placeholder="R$ 0,00"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Preço máximo</Label>
                    <Input
                      value={maxPrice}
                      onChange={event => { setMaxPrice(normalizeMoneyInput(event.target.value)); setPage(1); }}
                      placeholder="R$ 0,00"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {activeFilterCount > 0 && (
                  <div className="mt-3 flex justify-end">
                    <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Limpar filtros
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Conteúdo da tabela */}
            {hasQueryError ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-center text-xs sm:text-sm text-amber-200">
                <p className="font-medium">Não consegui carregar os SKUs.</p>
                <p className="mt-1 text-amber-200/90">{queryErrorMessage}</p>
              </div>
            ) : resultCount === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 px-4 py-10 text-center text-xs sm:text-sm text-muted-foreground">
                <p>Nenhum produto encontrado.</p>
                <p className="mt-1">
                  Ajuste a busca ou use <strong>Restaurar</strong> no header para recuperar o catálogo.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="space-y-2 lg:hidden">
                  {pageItems.map(product => {
                    const valor = priceView === "cost"
                      ? formatCurrency(product.tabelaNovaCk)
                      : formatCurrency(product.precoFinal);
                    return (
                      <button
                        key={product.id}
                        onClick={() => setDetailProduct(product)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 text-left transition hover:border-[#D4AF37]/40 hover:bg-muted/40"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-mono text-muted-foreground">{product.sku}</div>
                          <div className="mt-0.5 text-sm font-medium leading-5 text-foreground">{product.titulo}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {priceView === "cost" ? "Custo" : "Venda"}
                          </div>
                          <div className="text-base font-bold text-foreground">{valor}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Desktop: table enxuta */}
                <div className="hidden overflow-hidden rounded-xl border border-border/60 lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="h-10 w-28 text-xs font-semibold uppercase tracking-wide">SKU</TableHead>
                        <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide">Produto</TableHead>
                        <TableHead className="h-10 w-28 text-right text-xs font-semibold uppercase tracking-wide">Custo</TableHead>
                        <TableHead className="h-10 w-20 text-right text-[10px] font-semibold uppercase tracking-wide text-purple-400/80" title="Comissão Everton: <R$5=R$0,40 / ≥R$5=R$0,90">Everton</TableHead>
                        <TableHead className="h-10 w-20 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-400/80" title="Embalagem: botão R$0,30 / pequeno R$0,95 / grande R$3,45">Embal.</TableHead>
                        <TableHead className="h-10 w-28 text-right text-xs font-semibold uppercase tracking-wide" title="Custo total real (custo + Everton + embalagem)">Custo Total</TableHead>
                        <TableHead className="h-10 w-24 text-right text-[10px] font-semibold uppercase tracking-wide text-blue-400/80" title="Preço de venda no Mercado Livre (média dos anúncios ativos correspondentes)">Venda ML</TableHead>
                        <TableHead className="h-10 w-20 text-right text-[10px] font-semibold uppercase tracking-wide" title="Margem real ML (com custo + Everton + embalagem + comissão 13% + taxa fixa + frete + imposto 9,3%)">Margem ML</TableHead>
                        <TableHead className="h-10 w-24 text-right text-[10px] font-semibold uppercase tracking-wide text-amber-400/70" title="Preço B2B (atacado/distribuidora)">Venda B2B</TableHead>
                        <TableHead className="h-10 w-20 text-right text-[10px] font-semibold uppercase tracking-wide" title="Margem B2B (só desconta imposto)">Margem B2B</TableHead>
                        <TableHead className="h-10 w-16 text-center text-xs font-semibold uppercase tracking-wide">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageItems.map((product, idx) => {
                        const custo = toNumber(product.tabelaNovaCk);
                        const vendaB2B = toNumber(product.precoFinal);
                        const mlInfo = mlPriceBySku.get(product.sku);
                        const vendaML = mlInfo?.avgPrice ?? 0;
                        const everton = calcEverton(custo);
                        const embalagem = calcEmbalagem(product.titulo);
                        const custoTotal = custo > 0 ? custo + everton + (embalagem ?? 0) : 0;
                        // Margem ML: desconta tudo (custo + everton + embal + comissão ML + taxa fixa + frete + imposto)
                        const margemML = custoTotal > 0 && vendaML > 0
                          ? ((vendaML - calcMlFees(vendaML) - vendaML * (IMPOSTO_PERCENT / 100) - custoTotal) / vendaML) * 100
                          : null;
                        // Margem B2B: só desconta imposto (preço de atacado, sem taxa marketplace)
                        const margemB2B = custoTotal > 0 && vendaB2B > 0
                          ? ((vendaB2B - vendaB2B * (IMPOSTO_PERCENT / 100) - custoTotal) / vendaB2B) * 100
                          : null;
                        return (
                          <TableRow
                            key={product.id}
                            className={`${idx % 2 === 0 ? "" : "bg-muted/20"} cursor-pointer hover:bg-muted/40`}
                            onClick={() => setDetailProduct(product)}
                          >
                            <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">
                              {product.sku}
                            </TableCell>
                            <TableCell className="py-2.5 text-sm font-medium text-foreground">
                              {product.titulo}
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <span className={`text-sm font-semibold ${custo > 0 ? "text-blue-400" : "text-muted-foreground/40"}`}>
                                {custo > 0 ? formatCurrency(custo) : "—"}
                              </span>
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <span className={`text-xs ${everton > 0 ? "text-purple-400" : "text-muted-foreground/40"}`}>
                                {everton > 0 ? `R$${everton.toFixed(2)}` : "—"}
                              </span>
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              {embalagem !== null ? (
                                <span className="text-xs text-cyan-400">R${embalagem.toFixed(2)}</span>
                              ) : (
                                <span className="text-xs text-amber-400" title="Categoria não mapeada — me avise qual bucket aplicar">?</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <span className={`text-sm font-bold ${custoTotal > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                                {custoTotal > 0 ? formatCurrency(custoTotal) : "—"}
                              </span>
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              {vendaML > 0 ? (
                                <span className="text-sm font-semibold text-blue-400" title={`média de ${mlInfo?.count ?? 0} anúncio(s) ML`}>
                                  {formatCurrency(vendaML)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/40">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              {margemML !== null ? (
                                <span className={`text-xs font-bold ${
                                  margemML >= 30 ? "text-emerald-400" :
                                  margemML >= 15 ? "text-amber-400" : "text-red-400"
                                }`}>
                                  {margemML.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/40">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <span className={`text-xs ${vendaB2B > 0 ? "text-amber-400/80" : "text-muted-foreground/40"}`}>
                                {vendaB2B > 0 ? formatCurrency(vendaB2B) : "—"}
                              </span>
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              {margemB2B !== null ? (
                                <span className={`text-xs font-bold ${
                                  margemB2B >= 20 ? "text-emerald-400" :
                                  margemB2B >= 10 ? "text-amber-400" : "text-red-400"
                                }`}>
                                  {margemB2B.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/40">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5 text-center">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-[#D4AF37]"
                                onClick={(e) => { e.stopPropagation(); setDetailProduct(product); }}
                              >
                                <Settings2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Paginação */}
                <div className="flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {resultCount === 0 ? 0 : pageStart + 1}–{pageEnd} de {resultCount}
                    </span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={value => { setPageSize(Number(value)); setPage(1); }}
                    >
                      <SelectTrigger className="h-8 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25 por página</SelectItem>
                        <SelectItem value="50">50 por página</SelectItem>
                        <SelectItem value="100">100 por página</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={currentPage === 1}
                      onClick={() => goToPage(1)}
                      aria-label="Primeira página"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={currentPage === 1}
                      onClick={() => goToPage(currentPage - 1)}
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-2 text-xs font-medium">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={currentPage === totalPages}
                      onClick={() => goToPage(currentPage + 1)}
                      aria-label="Próxima página"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={currentPage === totalPages}
                      onClick={() => goToPage(totalPages)}
                      aria-label="Última página"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal Novo produto */}
      <Dialog
        open={showNewProductDialog}
        onOpenChange={next => {
          setShowNewProductDialog(next);
          if (!next) setDraft(emptyDraft);
        }}
      >
        <DialogContent className="border-border/60 bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo produto</DialogTitle>
            <DialogDescription>Cadastre manualmente um SKU no catálogo Kaibren.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">SKU</Label>
              <Input
                value={draft.sku}
                onChange={event => setDraft(current => ({ ...current, sku: event.target.value }))}
                placeholder="Ex.: 1193-99"
                className="h-10 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input
                value={draft.titulo}
                onChange={event => setDraft(current => ({ ...current, titulo: event.target.value }))}
                placeholder="Nome do produto"
                className="h-10 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Valor Mondial</Label>
                <Input
                  value={draft.valorProduto}
                  onChange={event => setDraft(current => ({ ...current, valorProduto: normalizeMoneyInput(event.target.value) }))}
                  placeholder="R$ 0,00"
                  className="h-10 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor revenda</Label>
                <Input
                  value={draft.precoFinal}
                  onChange={event => setDraft(current => ({ ...current, precoFinal: normalizeMoneyInput(event.target.value) }))}
                  placeholder="R$ 0,00"
                  className="h-10 text-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowNewProductDialog(false)}
              disabled={importSpreadsheetMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateProduct}
              disabled={importSpreadsheetMutation.isPending}
              className="bg-[#D4AF37] text-[#1C1C1C] hover:bg-[#C89F2F]"
            >
              <Plus className="mr-2 h-4 w-4" />
              {importSpreadsheetMutation.isPending ? "Salvando..." : "Cadastrar produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductDetailDialog
        product={detailProduct}
        open={!!detailProduct}
        onOpenChange={(next) => { if (!next) setDetailProduct(null); }}
      />
    </DashboardLayout>
  );
}
