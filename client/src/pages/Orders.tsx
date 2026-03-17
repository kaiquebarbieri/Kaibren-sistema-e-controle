import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  CreditCard,
  Download,
  Loader2,
  Search,
  ShoppingCart,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

/* ── Types ─────────────────────────────────────────── */

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

type CustomerRow = {
  id: number;
  name: string;
  reference: string | null;
  document: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
};

type CartItem = {
  productId: number | null;
  sku: string;
  titulo: string;
  quantidade: number;
  tabelaNovaCk: string;
  imposto: string;
  comissao: string;
  valorProduto: string;
  precoDesejado: string;
  precoFinal: string;
  margemFinal: string;
  lucroUnitario: string;
};

type CustomerForm = {
  name: string;
  reference: string;
  document: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  notes: string;
};

type PricingSettings = {
  impostoPercentual: string;
  valorEverton: string;
};

/* ── Helpers ───────────────────────────────────────── */

function formatCurrency(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(value: string | number | null | undefined) {
  const amount = Number(value ?? 0) * 100;
  return `${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatDateTime(value: Date = new Date()) {
  return value.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sanitizeSheetName(value: string) {
  return value.replace(/[\\/:?*\[\]]/g, " ").slice(0, 31);
}

function createEmptyCustomerForm(): CustomerForm {
  return { name: "", reference: "", document: "", phone: "", email: "", city: "", state: "", notes: "" };
}

function createDefaultPricingSettings(): PricingSettings {
  return { impostoPercentual: "0", valorEverton: "0.75" };
}

function applyPricingSettings(product: ProductRow, settings: PricingSettings): ProductRow {
  const precoRevenda = Number(product.precoFinal || product.precoDesejado || 0);
  const impostoPercentual = Number(settings.impostoPercentual || 0);
  const valorEverton = Number(settings.valorEverton || 0);
  const valorImposto = precoRevenda * (impostoPercentual / 100);
  const valorMondialAjustado = Math.max(precoRevenda - valorImposto - valorEverton, 0);
  const lucroAjustado = precoRevenda - valorMondialAjustado - valorEverton - valorImposto;
  const margemAjustada = valorMondialAjustado > 0 ? lucroAjustado / valorMondialAjustado : 0;

  return {
    ...product,
    imposto: valorImposto.toString(),
    comissao: valorEverton.toString(),
    valorProduto: valorMondialAjustado.toString(),
    lucro: lucroAjustado.toString(),
    margemFinal: margemAjustada.toString(),
  };
}

function buildSimulation(cart: CartItem[], orderType: "customer" | "personal") {
  const totals = cart.reduce(
    (acc, item) => {
      const quantidade = Number(item.quantidade);
      const totalMondial = Number(item.valorProduto) * quantidade;
      const totalComissao = Number(item.comissao) * quantidade;
      const totalClienteBruto = Number(item.precoFinal || item.precoDesejado) * quantidade;
      const totalLucroBruto = Number(item.lucroUnitario) * quantidade;

      acc.totalMondial += totalMondial;
      acc.totalComissao += totalComissao;
      acc.totalCliente += orderType === "customer" ? totalClienteBruto : 0;
      acc.totalLucro += orderType === "customer" ? totalLucroBruto : 0;
      acc.totalItens += quantidade;
      return acc;
    },
    { totalCliente: 0, totalMondial: 0, totalLucro: 0, totalComissao: 0, totalItens: 0 }
  );

  return {
    totals: {
      totalCliente: totals.totalCliente.toFixed(4),
      totalMondial: totals.totalMondial.toFixed(4),
      totalComissaoEvertonMondial: totals.totalComissao.toFixed(4),
      totalLucro: totals.totalLucro.toFixed(4),
      margemPedido: totals.totalMondial > 0 ? (totals.totalLucro / totals.totalMondial).toFixed(6) : "0.000000",
      totalItens: totals.totalItens,
    },
    customerList:
      orderType === "personal"
        ? []
        : cart.map(item => ({
            sku: item.sku,
            titulo: item.titulo,
            quantidade: item.quantidade,
            precoVendaUnitario: Number(item.precoFinal || item.precoDesejado).toFixed(4),
            totalCliente: (Number(item.precoFinal || item.precoDesejado) * Number(item.quantidade)).toFixed(4),
          })),
    mondialList: cart.map(item => ({
      sku: item.sku,
      titulo: item.titulo,
      quantidade: item.quantidade,
      valorCompraUnitario: Number(item.valorProduto).toFixed(4),
      totalMondial: (Number(item.valorProduto) * Number(item.quantidade)).toFixed(4),
      evertonMondial: (Number(item.comissao) * Number(item.quantidade)).toFixed(4),
    })),
  };
}

type SimulationResult = ReturnType<typeof buildSimulation>;

const KAIBREN_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/95597689/XxwarzmhDMwJNs5J3puu6o/kaibren-logo_40d0a45a.png";
const KAIBREN_COLORS = {
  gold: "#D4AF37",
  black: "#1C1C1C",
  ivory: "#F5F2E9",
  gray: "#8E8E8E",
};

function autosizeColumns(rows: Record<string, unknown>[]) {
  const keys = rows.length > 0 ? Object.keys(rows[0]) : [];
  return keys.map(key => {
    const maxLength = Math.max(key.length, ...rows.map(row => String(row[key] ?? "").length));
    return { wch: Math.min(Math.max(maxLength + 2, 14), 40) };
  });
}

function exportOrderWorkbook(params: {
  orderLabel: string;
  customerName: string;
  orderType: "customer" | "personal";
  simulation: SimulationResult;
  cart: CartItem[];
  kind: "cliente" | "mondial";
}) {
  const { orderLabel, customerName, orderType, simulation, cart, kind } = params;
  const workbook = XLSX.utils.book_new();
  const createdAt = formatDateTime();
  const brandLine = "KaiBren Peças & Utilidades";
  const listTitle = kind === "cliente" ? "Pedido para Cliente" : "Pedido para Mondial";

  const detailRows = [
    [brandLine], [listTitle],
    ["Logo", KAIBREN_LOGO_URL],
    ["Pedido", orderLabel],
    ["Cliente", orderType === "personal" ? "Compra pessoal" : customerName],
    ["Data de geração", createdAt],
    ["Paleta", `Ouro ${KAIBREN_COLORS.gold} | Preto ${KAIBREN_COLORS.black} | Marfim ${KAIBREN_COLORS.ivory} | Cinza ${KAIBREN_COLORS.gray}`],
    [],
  ];

  const itemRows =
    kind === "cliente"
      ? simulation.customerList.map(item => ({
          Pedido: orderLabel,
          SKU: item.sku,
          "Nome do Produto": item.titulo,
          Quantidade: item.quantidade,
          "Valor Unitário Cliente": Number(item.precoVendaUnitario),
          "Valor Total Cliente": Number(item.totalCliente),
        }))
      : cart.map(item => ({
          Pedido: orderLabel,
          SKU: item.sku,
          "Nome do Produto": item.titulo,
          Quantidade: item.quantidade,
          "Valor Unitário Mondial": Number(item.valorProduto),
          "Everton Mondial": Number(item.comissao) * Number(item.quantidade),
          "Valor Total Mondial": Number(item.valorProduto) * Number(item.quantidade),
        }));

  const summaryRows =
    kind === "cliente"
      ? [
          { Indicador: "Total Cliente", Valor: Number(simulation.totals.totalCliente) },
          { Indicador: "Lucro Previsto", Valor: Number(simulation.totals.totalLucro) },
          { Indicador: "Margem Prevista", Valor: Number(simulation.totals.margemPedido) },
        ]
      : [
          { Indicador: "Total Mondial", Valor: Number(simulation.totals.totalMondial) },
          { Indicador: "Everton Mondial", Valor: Number(simulation.totals.totalComissaoEvertonMondial) },
          { Indicador: "Total de Itens", Valor: Number(simulation.totals.totalItens) },
        ];

  const headerSheet = XLSX.utils.aoa_to_sheet(detailRows);
  headerSheet["!cols"] = [{ wch: 22 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, headerSheet, "Capa");

  const itemsSheet = XLSX.utils.json_to_sheet(itemRows);
  itemsSheet["!cols"] = autosizeColumns(itemRows);
  XLSX.utils.book_append_sheet(workbook, itemsSheet, sanitizeSheetName(kind === "cliente" ? "Pedido Cliente" : "Pedido Mondial"));

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet["!cols"] = autosizeColumns(summaryRows);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");

  const safeCustomer = customerName.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase() || "pedido";
  const filename = kind === "cliente"
    ? `pedido-cliente-${safeCustomer}.xlsx`
    : `pedido-mondial-${safeCustomer}.xlsx`;

  XLSX.writeFile(workbook, filename);
}

/* ── Page Component ────────────────────────────────── */

export default function Orders() {
  const { user, loading } = useAuth();
  const [skuQuickEntry, setSkuQuickEntry] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("new");
  const [customerForm, setCustomerForm] = useState<CustomerForm>(() => createEmptyCustomerForm());
  const [pricingSettings] = useState<PricingSettings>(() => createDefaultPricingSettings());
  const [orderType, setOrderType] = useState<"customer" | "personal">("customer");
  const [notes, setNotes] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeTab, setActiveTab] = useState("resumo");
  const skuQuickEntryRef = useRef<HTMLInputElement | null>(null);

  const allProductsQuery = trpc.products.list.useQuery({ limit: 500 });
  const ordersQuery = trpc.orders.list.useQuery();
  const customersQuery = trpc.customers.search.useQuery({ query: customerSearch, limit: 50 });

  const createCustomerMutation = trpc.customers.create.useMutation({
    onSuccess: async customer => {
      if (!customer) return;
      toast.success(`Cliente ${customer.name} cadastrado com sucesso.`);
      setSelectedCustomerId(String(customer.id));
      setCustomerForm({
        name: customer.name,
        reference: customer.reference ?? "",
        document: customer.document ?? "",
        phone: customer.phone ?? "",
        email: customer.email ?? "",
        city: customer.city ?? "",
        state: customer.state ?? "",
        notes: customer.notes ?? "",
      });
      setCustomerSearch(customer.name);
      await customersQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: async (_, variables) => {
      toast.success(variables.status === "finalized" ? "Pedido finalizado com sucesso." : "Pedido salvo com sucesso.");
      setCart([]);
      setNotes("");
      setSkuQuickEntry("");
      if (variables.orderType === "personal") {
        setSelectedCustomerId("new");
        setCustomerForm(createEmptyCustomerForm());
        setCustomerSearch("");
      }
      await ordersQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const adjustedProducts = useMemo(() => {
    return ((allProductsQuery.data ?? []) as ProductRow[]).map(product => applyPricingSettings(product, pricingSettings));
  }, [allProductsQuery.data, pricingSettings]);

  const quickSkuMatches = useMemo(() => {
    const normalized = skuQuickEntry.trim().toLowerCase();
    if (!normalized) return [] as ProductRow[];
    return adjustedProducts.filter(product => product.sku.toLowerCase().includes(normalized) || product.titulo.toLowerCase().includes(normalized)).slice(0, 8);
  }, [adjustedProducts, skuQuickEntry]);

  const selectedQuickProduct = useMemo(() => {
    const normalized = skuQuickEntry.trim().toLowerCase();
    if (!normalized) return null;
    return adjustedProducts.find(product => product.sku.toLowerCase() === normalized) ?? null;
  }, [adjustedProducts, skuQuickEntry]);

  const selectedCustomer = useMemo(() => {
    return (customersQuery.data ?? []).find(customer => String(customer.id) === selectedCustomerId) ?? null;
  }, [customersQuery.data, selectedCustomerId]);

  const localSimulation = useMemo(() => buildSimulation(cart, orderType), [cart, orderType]);

  /* ── Cart actions ──────────────────────────────── */

  function addToCart(product: ProductRow) {
    setCart(current => {
      const existing = current.find(item => item.sku === product.sku);
      if (existing) {
        toast.success(`Quantidade de ${product.sku} atualizada no pedido.`);
        return current.map(item =>
          item.sku === product.sku ? { ...item, quantidade: item.quantidade + 1 } : item
        );
      }
      toast.success(`${product.sku} adicionado ao pedido.`);
      return [
        {
          productId: product.id,
          sku: product.sku,
          titulo: product.titulo,
          quantidade: 1,
          tabelaNovaCk: String(product.tabelaNovaCk),
          imposto: String(product.imposto),
          comissao: String(product.comissao),
          valorProduto: String(product.valorProduto),
          precoDesejado: String(product.precoDesejado),
          precoFinal: String(product.precoFinal),
          margemFinal: String(product.margemFinal),
          lucroUnitario: String(product.lucro),
        },
        ...current,
      ];
    });
  }

  function addBySku() {
    const normalized = skuQuickEntry.trim().toLowerCase();
    const exactProduct = adjustedProducts.find(product => product.sku.toLowerCase() === normalized);
    const product = exactProduct ?? quickSkuMatches[0] ?? null;
    if (!product) {
      toast.error("Nenhum produto encontrado para esse SKU.");
      return;
    }
    addToCart(product);
    setTimeout(() => {
      setSkuQuickEntry("");
      skuQuickEntryRef.current?.focus();
    }, 0);
  }

  function updateQuantity(sku: string, quantidade: number) {
    setCart(current => current.map(item => (item.sku === sku ? { ...item, quantidade: Math.max(1, quantidade || 1) } : item)));
  }

  function removeItem(sku: string) {
    setCart(current => current.filter(item => item.sku !== sku));
    toast.success(`Item ${sku} removido do pedido.`);
  }

  function applyCustomer(customer: CustomerRow) {
    setSelectedCustomerId(String(customer.id));
    setCustomerForm({
      name: customer.name,
      reference: customer.reference ?? "",
      document: customer.document ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
      notes: customer.notes ?? "",
    });
    setCustomerSearch(customer.name);
    toast.success(`Cliente ${customer.name} selecionado.`);
  }

  function startNewCustomer() {
    setSelectedCustomerId("new");
    setCustomerForm(createEmptyCustomerForm());
    toast.success("Cadastro manual de cliente liberado.");
  }

  async function saveCustomer() {
    if (!customerForm.name.trim()) {
      toast.error("Informe o nome do cliente para cadastrar.");
      return;
    }
    await createCustomerMutation.mutateAsync({
      name: customerForm.name,
      reference: customerForm.reference || null,
      document: customerForm.document || null,
      phone: customerForm.phone || null,
      email: customerForm.email || null,
      city: customerForm.city || null,
      state: customerForm.state || null,
      notes: customerForm.notes || null,
    });
  }

  function exportCustomerSheet() {
    if (orderType === "personal") {
      toast.error("Compras pessoais não geram planilha para cliente.");
      return;
    }
    if (cart.length === 0) {
      toast.error("Adicione itens antes de gerar a planilha do cliente.");
      return;
    }
    exportOrderWorkbook({
      orderLabel: `PED-${selectedMonth}${selectedYear}`,
      customerName: customerForm.name || "cliente",
      orderType,
      simulation: localSimulation,
      cart,
      kind: "cliente",
    });
    toast.success("Planilha do cliente gerada com sucesso.");
  }

  function exportMondialSheet() {
    if (cart.length === 0) {
      toast.error("Adicione itens antes de gerar a planilha da Mondial.");
      return;
    }
    exportOrderWorkbook({
      orderLabel: `PED-${selectedMonth}${selectedYear}`,
      customerName: customerForm.name || "pedido",
      orderType,
      simulation: localSimulation,
      cart,
      kind: "mondial",
    });
    toast.success("Planilha da Mondial gerada com sucesso.");
  }

  async function saveOrder(status: "created" | "finalized") {
    if (cart.length === 0) {
      toast.error("Adicione itens ao pedido antes de salvar.");
      return;
    }
    if (orderType === "customer" && !customerForm.name.trim()) {
      toast.error("Selecione ou cadastre o cliente antes de salvar.");
      return;
    }
    const customerName = orderType === "personal" ? "Compra pessoal" : customerForm.name;
    const customerReference = orderType === "personal" ? "Uso próprio" : customerForm.reference;

    await createOrderMutation.mutateAsync({
      customerId: selectedCustomerId !== "new" && orderType === "customer" ? Number(selectedCustomerId) : null,
      customerName,
      customerReference: customerReference || null,
      orderType,
      periodMonth: Number(selectedMonth),
      periodYear: Number(selectedYear),
      notes,
      status,
      items: cart,
    });

    if (orderType === "customer") {
      exportCustomerSheet();
    }
    exportMondialSheet();
  }

  /* ── Render ────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader>
            <CardTitle>Sistema CK Distribuidora</CardTitle>
            <CardDescription>Faça login para acessar o menu de pedidos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => (window.location.href = getLoginUrl())}>
              Entrar no sistema
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <DashboardLayout activeSection="pedidos">
      <div className="flex flex-col gap-6 bg-background">
        {/* ── Header ─────────────────────────────── */}
        <div className="overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 px-6 py-6 text-white shadow-sm lg:px-8 lg:py-8">
          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
              <ShoppingCart className="mr-1.5 h-3.5 w-3.5" /> Pedidos e Compras
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">Montar pedido de venda ou compra pessoal</h1>
            <p className="max-w-2xl text-sm leading-6 text-emerald-100">
              Adicione produtos pelo SKU, escolha o tipo de pedido, vincule o cliente e finalize. Os totais são calculados automaticamente e refletidos no Dashboard.
            </p>
          </div>
        </div>

        {/* ── Busca de SKU + Tipo de pedido ──────── */}
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><ShoppingCart className="h-5 w-5" /> Adicionar produtos ao pedido</CardTitle>
              <CardDescription>Os SKUs são puxados automaticamente do menu Produtos. Digite o código ou nome para buscar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4">
                <div className="space-y-2">
                  <Label>Buscar produto por SKU ou nome</Label>
                  <form
                    className="flex gap-2"
                    onSubmit={event => {
                      event.preventDefault();
                      addBySku();
                    }}
                  >
                    <Input
                      ref={skuQuickEntryRef}
                      value={skuQuickEntry}
                      onChange={e => setSkuQuickEntry(e.target.value)}
                      placeholder="Digite o SKU ou nome do produto"
                      autoFocus
                    />
                    <Button type="submit" variant="outline">
                      <Search className="mr-2 h-4 w-4" />
                      Adicionar
                    </Button>
                  </form>
                  {selectedQuickProduct ? (
                    <div className="rounded-xl bg-background p-3 text-sm shadow-sm">
                      <div className="font-medium text-foreground">{selectedQuickProduct.sku} — {selectedQuickProduct.titulo}</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <div className="rounded-lg border border-border/60 p-2">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Valor pago à Mondial</div>
                          <div className="font-semibold text-foreground">{formatCurrency(selectedQuickProduct.valorProduto)}</div>
                        </div>
                        <div className="rounded-lg border border-border/60 p-2">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Valor de revenda</div>
                          <div className="font-semibold text-foreground">{formatCurrency(selectedQuickProduct.precoFinal || selectedQuickProduct.precoDesejado)}</div>
                        </div>
                      </div>
                    </div>
                  ) : skuQuickEntry.trim() ? (
                    <div className="space-y-2 rounded-xl bg-background p-3 text-sm shadow-sm">
                      <div className="font-medium text-foreground">Sugestões encontradas</div>
                      <div className="flex flex-wrap gap-2">
                        {quickSkuMatches.length > 0 ? quickSkuMatches.map(item => (
                          <Button
                            key={item.sku}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              addToCart(item);
                              setSkuQuickEntry("");
                              setTimeout(() => skuQuickEntryRef.current?.focus(), 0);
                            }}
                          >
                            {item.sku} — {item.titulo.slice(0, 30)}
                          </Button>
                        )) : <span className="text-muted-foreground">Nenhum SKU encontrado</span>}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Itens no carrinho */}
              <div className="mb-2 rounded-2xl border border-dashed border-border/60 bg-muted/30 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Itens no pedido atual</span>
                  <strong>{cart.length} produto(s)</strong>
                </div>
                {cart.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cart.map(item => (
                      <Badge key={`badge-${item.sku}`} variant="secondary" className="rounded-full px-3 py-1">
                        {item.sku} · qtd {item.quantidade}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-muted-foreground">Digite um SKU acima e pressione Enter para começar a montar o pedido.</p>
                )}
              </div>

              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <Table style={{ minWidth: 700 }}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Mondial</TableHead>
                      <TableHead>Everton</TableHead>
                      <TableHead>Lucro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map(item => (
                      <TableRow key={item.sku}>
                        <TableCell className="font-medium">{item.sku}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{item.titulo}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantidade}
                            onChange={e => updateQuantity(item.sku, Number(e.target.value))}
                            className="h-9 w-20"
                          />
                        </TableCell>
                        <TableCell>{formatCurrency(orderType === "customer" ? Number(item.precoFinal || item.precoDesejado) * item.quantidade : 0)}</TableCell>
                        <TableCell>{formatCurrency(Number(item.valorProduto) * item.quantidade)}</TableCell>
                        <TableCell>{formatCurrency(Number(item.comissao) * item.quantidade)}</TableCell>
                        <TableCell>{formatCurrency(orderType === "customer" ? Number(item.lucroUnitario) * item.quantidade : 0)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" onClick={() => removeItem(item.sku)}>
                            Remover
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ── Configuração do pedido ──────────── */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Configuração do pedido</CardTitle>
              <CardDescription>Defina tipo, cliente, período e salve ou finalize o pedido.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de pedido</Label>
                <Select value={orderType} onValueChange={value => setOrderType(value as "customer" | "personal")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Pedido de cliente (venda)</SelectItem>
                    <SelectItem value="personal">Compra pessoal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {orderType === "customer" && (
                <div className="space-y-3">
                  <Label>Buscar cliente</Label>
                  <div className="flex gap-2">
                    <Input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Nome do cliente" />
                    <Button variant="outline" size="sm" onClick={startNewCustomer}>Novo</Button>
                  </div>
                  {(customersQuery.data ?? []).length > 0 && (
                    <ScrollArea className="h-[140px] rounded-xl border border-border/60">
                      <Table>
                        <TableBody>
                          {(customersQuery.data ?? []).map(customer => (
                            <TableRow key={customer.id}>
                              <TableCell className="font-medium">{customer.name}</TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline" onClick={() => applyCustomer(customer as CustomerRow)}>
                                  Selecionar
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                  {selectedCustomerId === "new" && (
                    <div className="space-y-3 rounded-xl border border-dashed border-border p-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        <Input value={customerForm.name} onChange={e => setCustomerForm(c => ({ ...c, name: e.target.value }))} placeholder="Nome" />
                        <Input value={customerForm.phone} onChange={e => setCustomerForm(c => ({ ...c, phone: e.target.value }))} placeholder="Telefone" />
                      </div>
                      <Input value={customerForm.reference} onChange={e => setCustomerForm(c => ({ ...c, reference: e.target.value }))} placeholder="Referência" />
                      <Button size="sm" onClick={saveCustomer} disabled={createCustomerMutation.isPending}>
                        {createCustomerMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Salvar cliente
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Input value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} placeholder="Mês" />
                </div>
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Input value={selectedYear} onChange={e => setSelectedYear(e.target.value)} placeholder="Ano" />
                </div>
              </div>

              <div className="rounded-2xl bg-muted/50 p-4 text-sm">
                <div className="flex items-center justify-between"><span>Cliente vinculado</span><strong>{orderType === "personal" ? "Compra pessoal" : customerForm.name || "Não selecionado"}</strong></div>
                <div className="mt-2 flex items-center justify-between"><span>Referência</span><strong>{orderType === "personal" ? "Uso próprio" : customerForm.reference || "-"}</strong></div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações do pedido" rows={3} />
              </div>

              <Separator />

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span>Total de itens</span><strong>{localSimulation.totals.totalItens}</strong></div>
                <div className="flex items-center justify-between"><span>Total Mondial</span><strong>{formatCurrency(localSimulation.totals.totalMondial)}</strong></div>
                <div className="flex items-center justify-between"><span>Total cliente</span><strong>{formatCurrency(localSimulation.totals.totalCliente)}</strong></div>
                <div className="flex items-center justify-between"><span>Lucro previsto</span><strong>{formatCurrency(localSimulation.totals.totalLucro)}</strong></div>
                <div className="flex items-center justify-between"><span>Everton Mondial</span><strong>{formatCurrency(localSimulation.totals.totalComissaoEvertonMondial)}</strong></div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Button variant="outline" onClick={() => saveOrder("created")} disabled={createOrderMutation.isPending}>
                  Salvar pedido
                </Button>
                <Button onClick={() => saveOrder("finalized")} disabled={createOrderMutation.isPending}>
                  {createOrderMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Finalizar pedido
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Button variant="outline" onClick={exportCustomerSheet} disabled={orderType === "personal" || cart.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Planilha Cliente
                </Button>
                <Button variant="outline" onClick={exportMondialSheet} disabled={cart.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Planilha Mondial
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Listas geradas ─────────────────────── */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl"><CreditCard className="h-5 w-5" /> Listas geradas automaticamente</CardTitle>
            <CardDescription>Resumo, lista do cliente e lista da Mondial para o pedido em montagem.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="resumo">Resumo</TabsTrigger>
                <TabsTrigger value="cliente">Cliente</TabsTrigger>
                <TabsTrigger value="mondial">Mondial</TabsTrigger>
              </TabsList>
              <TabsContent value="resumo" className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span>Total cliente</span><strong>{formatCurrency(localSimulation.totals.totalCliente)}</strong></div>
                <div className="flex items-center justify-between"><span>Total Mondial</span><strong>{formatCurrency(localSimulation.totals.totalMondial)}</strong></div>
                <div className="flex items-center justify-between"><span>Lucro salvo</span><strong>{formatCurrency(localSimulation.totals.totalLucro)}</strong></div>
                <div className="flex items-center justify-between"><span>Margem prevista</span><strong>{formatPercent(localSimulation.totals.margemPedido)}</strong></div>
                <div className="flex items-center justify-between"><span>Everton Mondial</span><strong>{formatCurrency(localSimulation.totals.totalComissaoEvertonMondial)}</strong></div>
              </TabsContent>
              <TabsContent value="cliente" className="space-y-3">
                {orderType === "personal" ? (
                  <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
                    Compras pessoais não geram lista de cliente.
                  </div>
                ) : (
                  <ScrollArea className="h-[220px] rounded-2xl border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Título</TableHead>
                          <TableHead>Qtd</TableHead>
                          <TableHead>Preço venda</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {localSimulation.customerList.map(item => (
                          <TableRow key={`${item.sku}-cliente`}>
                            <TableCell>{item.sku}</TableCell>
                            <TableCell className="max-w-[180px] truncate">{item.titulo}</TableCell>
                            <TableCell>{item.quantidade}</TableCell>
                            <TableCell>{formatCurrency(item.precoVendaUnitario)}</TableCell>
                            <TableCell>{formatCurrency(item.totalCliente)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </TabsContent>
              <TabsContent value="mondial" className="space-y-3">
                <ScrollArea className="h-[220px] rounded-2xl border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Valor produto</TableHead>
                        <TableHead>Everton</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {localSimulation.mondialList.map(item => (
                        <TableRow key={`${item.sku}-mondial`}>
                          <TableCell>{item.sku}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{item.titulo}</TableCell>
                          <TableCell>{item.quantidade}</TableCell>
                          <TableCell>{formatCurrency(item.valorCompraUnitario)}</TableCell>
                          <TableCell>{formatCurrency(item.evertonMondial)}</TableCell>
                          <TableCell>{formatCurrency(item.totalMondial)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ── Histórico de pedidos ───────────────── */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Histórico de pedidos e compras</CardTitle>
            <CardDescription>Cada pedido salvo registra se foi compra pessoal ou venda para cliente.</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <Table style={{ minWidth: 700 }}>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Total cliente</TableHead>
                    <TableHead>Total Mondial</TableHead>
                    <TableHead>Lucro</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ordersQuery.data ?? []).map(order => (
                    <TableRow key={order.id}>
                      <TableCell>#{order.id}</TableCell>
                      <TableCell>{order.orderType === "personal" ? "Pessoal" : "Cliente"}</TableCell>
                      <TableCell className="font-medium">{order.customerName}</TableCell>
                      <TableCell>{formatCurrency(order.totalCliente)}</TableCell>
                      <TableCell>{formatCurrency(order.totalMondial)}</TableCell>
                      <TableCell>{formatCurrency(order.totalLucro)}</TableCell>
                      <TableCell>{order.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
