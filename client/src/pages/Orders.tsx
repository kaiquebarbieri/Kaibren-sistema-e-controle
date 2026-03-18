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
  Building2,
  CreditCard,
  Download,
  Edit3,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useMemo, useRef, useState, useCallback } from "react";
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

/**
 * Regra de negócio:
 * - Compra pessoal: exibe valor pago à Mondial (valorProduto). Dashboard calcula total + 0,75 por item para Everton. SEM imposto.
 * - Venda para cliente: exibe valor de revenda (precoFinal). Dashboard calcula total vendido - impostos - 0,75 por item = lucro líquido.
 * - O 0,75 do Everton NÃO aparece como coluna na tabela do pedido, só entra no cálculo do Dashboard.
 */

function buildSimulation(cart: CartItem[], orderType: "customer" | "personal") {
  const EVERTON_POR_ITEM = 0.75;

  const totals = cart.reduce(
    (acc, item) => {
      const quantidade = Number(item.quantidade);
      const valorMondialUnit = Number(item.valorProduto);
      const valorRevendaUnit = Number(item.precoFinal || item.precoDesejado);
      const impostoUnit = Number(item.imposto);

      if (orderType === "customer") {
        const totalVenda = valorRevendaUnit * quantidade;
        const totalMondial = valorMondialUnit * quantidade;
        const totalImposto = impostoUnit * quantidade;
        const totalEverton = EVERTON_POR_ITEM * quantidade;
        const lucro = totalVenda - totalMondial - totalImposto - totalEverton;

        acc.totalCliente += totalVenda;
        acc.totalMondial += totalMondial;
        acc.totalImposto += totalImposto;
        acc.totalEverton += totalEverton;
        acc.totalLucro += lucro;
      } else {
        const totalMondial = valorMondialUnit * quantidade;
        const totalEverton = EVERTON_POR_ITEM * quantidade;

        acc.totalMondial += totalMondial;
        acc.totalEverton += totalEverton;
      }

      acc.totalItens += quantidade;
      return acc;
    },
    { totalCliente: 0, totalMondial: 0, totalLucro: 0, totalImposto: 0, totalEverton: 0, totalItens: 0 }
  );

  const margemPedido = totals.totalMondial === 0 ? 0 : totals.totalLucro / totals.totalMondial;

  return {
    totals: {
      totalCliente: totals.totalCliente.toFixed(4),
      totalMondial: totals.totalMondial.toFixed(4),
      totalComissaoEvertonMondial: totals.totalEverton.toFixed(4),
      totalImposto: totals.totalImposto.toFixed(4),
      totalLucro: totals.totalLucro.toFixed(4),
      margemPedido: margemPedido.toFixed(6),
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
  const [orderType, setOrderType] = useState<"customer" | "personal">("customer");
  const [selectedCnpjId, setSelectedCnpjId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeTab, setActiveTab] = useState("resumo");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const skuQuickEntryRef = useRef<HTMLInputElement | null>(null);

  const trpcUtils = trpc.useUtils();
  const allProductsQuery = trpc.products.list.useQuery({ limit: 500 });
  const ordersQuery = trpc.orders.list.useQuery();
  const customersQuery = trpc.customers.search.useQuery({ query: customerSearch, limit: 50 });
  const campaignsQuery = trpc.marketing.campaigns.list.useQuery();
  const cnpjsQuery = trpc.myCnpjs.list.useQuery();

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
      setSelectedCampaignId("");
      setSelectedCnpjId("");
      setEditingOrderId(null);
      if (variables.orderType === "personal") {
        setSelectedCustomerId("new");
        setCustomerForm(createEmptyCustomerForm());
        setCustomerSearch("");
      }
      await ordersQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const updateOrderMutation = trpc.orders.update.useMutation({
    onSuccess: async () => {
      toast.success("Pedido atualizado com sucesso.");
      setCart([]);
      setNotes("");
      setSkuQuickEntry("");
      setSelectedCampaignId("");
      setSelectedCnpjId("");
      setEditingOrderId(null);
      setSelectedCustomerId("new");
      setCustomerForm(createEmptyCustomerForm());
      setCustomerSearch("");
      await ordersQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const changeTypeMutation = trpc.orders.changeType.useMutation({
    onSuccess: () => {
      trpcUtils.orders.list.invalidate();
      trpcUtils.dashboard.invalidate();
      toast.success("Tipo do pedido alterado com sucesso!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteOrderMutation = trpc.orders.delete.useMutation({
    onSuccess: async () => {
      toast.success("Pedido exclu\u00eddo com sucesso.");
      setShowDeleteConfirm(null);
      await ordersQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const allProducts = useMemo(() => {
    return (allProductsQuery.data ?? []) as ProductRow[];
  }, [allProductsQuery.data]);

  const quickSkuMatches = useMemo(() => {
    const normalized = skuQuickEntry.trim().toLowerCase();
    if (!normalized) return [] as ProductRow[];
    return allProducts.filter(product => product.sku.toLowerCase().includes(normalized) || product.titulo.toLowerCase().includes(normalized)).slice(0, 8);
  }, [allProducts, skuQuickEntry]);

  const selectedQuickProduct = useMemo(() => {
    const normalized = skuQuickEntry.trim().toLowerCase();
    if (!normalized) return null;
    return allProducts.find(product => product.sku.toLowerCase() === normalized) ?? null;
  }, [allProducts, skuQuickEntry]);

  const localSimulation = useMemo(() => buildSimulation(cart, orderType), [cart, orderType]);

  /* ── Cart actions ──────────────────────────────── */

  function addToCart(product: ProductRow) {
    setCart(current => {
      const existing = current.find(item => item.sku === product.sku);
      if (existing) {
        toast.success(`Quantidade de ${product.sku} atualizada.`);
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
    const exactProduct = allProducts.find(product => product.sku.toLowerCase() === normalized);
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

  function updatePrice(sku: string, newPrice: string) {
    setCart(current => current.map(item => {
      if (item.sku !== sku) return item;
      const preco = Number(newPrice) || 0;
      const valorProduto = Number(item.valorProduto) || 0;
      const imposto = Number(item.imposto) || 0;
      const comissao = Number(item.comissao) || 0;
      const lucroUnit = preco - valorProduto - imposto - comissao;
      const margem = preco > 0 ? (lucroUnit / preco) * 100 : 0;
      return {
        ...item,
        precoFinal: newPrice,
        precoDesejado: newPrice,
        lucroUnitario: lucroUnit.toFixed(4),
        margemFinal: margem.toFixed(6),
      };
    }));
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

  const loadOrderForEditing = useCallback(async (orderId: number) => {
    const orderData = (ordersQuery.data ?? []).find((o: any) => o.id === orderId);
    if (!orderData) {
      toast.error("Pedido n\u00e3o encontrado.");
      return;
    }

    // Fetch order details with items
    try {
      const detail = await trpcUtils.orders.detail.fetch({ orderId });
      if (!detail?.order) {
        toast.error("N\u00e3o foi poss\u00edvel carregar os detalhes do pedido.");
        return;
      }

      setEditingOrderId(orderId);
      setOrderType(detail.order.orderType as "customer" | "personal");
      setSelectedMonth(String(detail.order.periodMonth).padStart(2, "0"));
      setSelectedYear(String(detail.order.periodYear));
      setNotes(detail.order.notes ?? "");
      setSelectedCampaignId(detail.order.campaignId ? String(detail.order.campaignId) : "");
      setSelectedCnpjId((detail.order as any).cnpjId ? String((detail.order as any).cnpjId) : "");

      if (detail.order.orderType === "customer") {
        setSelectedCustomerId(detail.order.customerId ? String(detail.order.customerId) : "new");
        setCustomerForm({
          name: detail.order.customerName ?? "",
          reference: detail.order.customerReference ?? "",
          document: "",
          phone: "",
          email: "",
          city: "",
          state: "",
          notes: "",
        });
        setCustomerSearch(detail.order.customerName ?? "");
      } else {
        setSelectedCustomerId("new");
        setCustomerForm(createEmptyCustomerForm());
      }

      // Load items into cart
      const cartItems: CartItem[] = detail.items.map((item: any) => ({
        productId: item.productId ?? null,
        sku: item.sku,
        titulo: item.titulo,
        quantidade: Number(item.quantidade),
        tabelaNovaCk: item.tabelaNovaCk ?? "0",
        imposto: item.imposto ?? "0",
        comissao: item.comissao ?? "0",
        valorProduto: item.valorProduto ?? "0",
        precoDesejado: item.precoDesejado ?? "0",
        precoFinal: item.precoFinal ?? "0",
        margemFinal: item.margemFinal ?? "0",
        lucroUnitario: item.lucroUnitario ?? "0",
      }));
      setCart(cartItems);

      toast.success(`Pedido #${orderId} carregado para edi\u00e7\u00e3o.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      toast.error("Erro ao carregar pedido para edi\u00e7\u00e3o.");
    }
  }, [ordersQuery.data]);

  function cancelEditing() {
    setEditingOrderId(null);
    setCart([]);
    setNotes("");
    setSkuQuickEntry("");
    setSelectedCampaignId("");
    setSelectedCnpjId("");
    setSelectedCustomerId("new");
    setCustomerForm(createEmptyCustomerForm());
    setCustomerSearch("");
    setOrderType("customer");
    toast.success("Edi\u00e7\u00e3o cancelada.");
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
    const customerReference = orderType === "personal" ? "Uso pr\u00f3prio" : customerForm.reference;

    if (editingOrderId) {
      // Update existing order
      await updateOrderMutation.mutateAsync({
        orderId: editingOrderId,
        customerId: selectedCustomerId !== "new" && orderType === "customer" ? Number(selectedCustomerId) : null,
        customerName,
        customerReference: customerReference || null,
        orderType,
        notes,
        campaignId: selectedCampaignId && selectedCampaignId !== "none" ? Number(selectedCampaignId) : null,
        cnpjId: orderType === "personal" && selectedCnpjId && selectedCnpjId !== "none" ? Number(selectedCnpjId) : null,
        items: cart,
      });
    } else {
      // Create new order
      await createOrderMutation.mutateAsync({
        customerId: selectedCustomerId !== "new" && orderType === "customer" ? Number(selectedCustomerId) : null,
        customerName,
        customerReference: customerReference || null,
        orderType,
        periodMonth: Number(selectedMonth),
        periodYear: Number(selectedYear),
        notes,
        status,
        campaignId: selectedCampaignId && selectedCampaignId !== "none" ? Number(selectedCampaignId) : null,
        cnpjId: orderType === "personal" && selectedCnpjId && selectedCnpjId !== "none" ? Number(selectedCnpjId) : null,
        items: cart,
      });

      if (orderType === "customer") {
        exportCustomerSheet();
      }
      exportMondialSheet();
    }
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
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
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
      <div className="flex flex-col gap-4 sm:gap-6 bg-background">
        {/* Header */}
        {editingOrderId && (
          <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Edit3 className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">Editando pedido #{editingOrderId}</span>
            </div>
            <Button size="sm" variant="outline" onClick={cancelEditing} className="h-8 text-xs border-amber-500/50 text-amber-600 hover:bg-amber-500/10">
              <X className="mr-1 h-3 w-3" /> Cancelar
            </Button>
          </div>
        )}
        <div className="overflow-hidden rounded-2xl sm:rounded-[28px] border border-border/60 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 px-4 py-4 sm:px-6 sm:py-6 text-white shadow-sm lg:px-8 lg:py-8">
          <div className="space-y-2 sm:space-y-3">
            <Badge variant="secondary" className="w-fit rounded-full bg-white/10 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-medium text-white">
              <ShoppingCart className="mr-1 h-3 w-3 sm:mr-1.5 sm:h-3.5 sm:w-3.5" /> Pedidos e Compras
            </Badge>
            <h1 className="text-xl sm:text-3xl font-semibold tracking-tight">{editingOrderId ? `Editando pedido #${editingOrderId}` : "Montar pedido"}</h1>
            <p className="text-xs sm:text-sm leading-5 sm:leading-6 text-emerald-100">
              {editingOrderId ? "Altere os itens, quantidades ou informa\u00e7\u00f5es e salve." : "Adicione produtos pelo SKU, escolha o tipo de pedido e finalize."}
            </p>
          </div>
        </div>

        {/* \u2500\u2500 Busca de SKU + Tipo de pedido \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
        <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" /> Adicionar produtos
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Digite o SKU ou nome para buscar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
              <div className="rounded-xl sm:rounded-2xl border border-dashed border-border bg-muted/30 p-3 sm:p-4">
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Buscar produto</Label>
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
                      placeholder="SKU ou nome"
                      className="h-10 text-sm"
                      autoFocus
                    />
                    <Button type="submit" variant="outline" className="shrink-0 h-10 px-3">
                      <Search className="h-4 w-4" />
                    </Button>
                  </form>
                  {selectedQuickProduct ? (
                    <div className="rounded-lg bg-background p-2.5 sm:p-3 text-sm shadow-sm">
                      <div className="text-xs sm:text-sm font-medium text-foreground">{selectedQuickProduct.sku} — {selectedQuickProduct.titulo}</div>
                      <div className="mt-2 grid gap-2 grid-cols-2">
                        <div className="rounded-lg border border-border/60 p-2">
                          <div className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground">Mondial</div>
                          <div className="text-sm font-semibold text-foreground">{formatCurrency(selectedQuickProduct.valorProduto)}</div>
                        </div>
                        <div className="rounded-lg border border-border/60 p-2">
                          <div className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground">Revenda</div>
                          <div className="text-sm font-semibold text-foreground">{formatCurrency(selectedQuickProduct.precoFinal || selectedQuickProduct.precoDesejado)}</div>
                        </div>
                      </div>
                    </div>
                  ) : skuQuickEntry.trim() ? (
                    <div className="space-y-2 rounded-lg bg-background p-2.5 sm:p-3 text-sm shadow-sm">
                      <div className="text-xs font-medium text-foreground">Sugestões</div>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {quickSkuMatches.length > 0 ? quickSkuMatches.map(item => (
                          <Button
                            key={item.sku}
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs px-2"
                            onClick={() => {
                              addToCart(item);
                              setSkuQuickEntry("");
                              setTimeout(() => skuQuickEntryRef.current?.focus(), 0);
                            }}
                          >
                            {item.sku}
                          </Button>
                        )) : <span className="text-xs text-muted-foreground">Nenhum SKU encontrado</span>}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Cart items badge summary */}
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">Itens no pedido</span>
                  <strong className="text-xs sm:text-sm">{cart.length} produto(s)</strong>
                </div>
                {cart.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {cart.map(item => (
                      <Badge key={`badge-${item.sku}`} variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] sm:text-xs">
                        {item.sku} x{item.quantidade}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Cart items - mobile cards / desktop table */}
              {cart.length > 0 && (
                <>
                  {/* Mobile cart cards */}
                  <div className="space-y-2 lg:hidden">
                    {cart.map(item => {
                      const quantidade = Number(item.quantidade);
                      const valorUnit = orderType === "customer"
                        ? Number(item.precoFinal || item.precoDesejado)
                        : Number(item.valorProduto);
                      const total = valorUnit * quantidade;

                      return (
                        <div key={item.sku} className="rounded-xl border border-border/60 bg-card p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">SKU {item.sku}</div>
                              <div className="text-xs font-medium text-foreground mt-0.5 line-clamp-2">{item.titulo}</div>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => removeItem(item.sku)} className="shrink-0 h-7 w-7 p-0 text-destructive">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQuantity(item.sku, quantidade - 1)}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                type="number"
                                min={1}
                                value={item.quantidade}
                                onChange={e => updateQuantity(item.sku, Number(e.target.value))}
                                className="h-7 w-12 text-center text-xs px-1"
                              />
                              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQuantity(item.sku, quantidade + 1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <span className="text-[10px] text-muted-foreground">R$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={orderType === "customer" ? (item.precoFinal || item.precoDesejado) : item.valorProduto}
                                  onChange={e => {
                                    if (orderType === "customer") {
                                      updatePrice(item.sku, e.target.value);
                                    } else {
                                      setCart(current => current.map(ci => ci.sku === item.sku ? { ...ci, valorProduto: e.target.value } : ci));
                                    }
                                  }}
                                  className="h-6 w-20 text-right text-xs px-1"
                                />
                                <span className="text-[10px] text-muted-foreground">un.</span>
                              </div>
                              <div className="text-sm font-semibold text-foreground">{formatCurrency(total)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop cart table */}
                  <div className="hidden lg:block" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                    <Table style={{ minWidth: 600 }}>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Título</TableHead>
                          <TableHead>Qtd</TableHead>
                          <TableHead>{orderType === "customer" ? "Valor revenda" : "Valor Mondial"}</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cart.map(item => {
                          const quantidade = Number(item.quantidade);
                          const valorUnit = orderType === "customer"
                            ? Number(item.precoFinal || item.precoDesejado)
                            : Number(item.valorProduto);
                          const total = valorUnit * quantidade;

                          return (
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
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={orderType === "customer" ? (item.precoFinal || item.precoDesejado) : item.valorProduto}
                                  onChange={e => {
                                    if (orderType === "customer") {
                                      updatePrice(item.sku, e.target.value);
                                    } else {
                                      setCart(current => current.map(ci => ci.sku === item.sku ? { ...ci, valorProduto: e.target.value } : ci));
                                    }
                                  }}
                                  className="h-9 w-28"
                                />
                              </TableCell>
                              <TableCell>{formatCurrency(total)}</TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                <Button size="sm" variant="ghost" onClick={() => removeItem(item.sku)}>
                                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remover
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Configuração do pedido ──────────── */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-lg sm:text-xl">Configuração</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Tipo, cliente, período e finalização.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Tipo de pedido</Label>
                <Select value={orderType} onValueChange={value => setOrderType(value as "customer" | "personal")}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Venda para cliente</SelectItem>
                    <SelectItem value="personal">Compra pessoal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {orderType === "personal" && (
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-blue-500" />
                    CNPJ da compra
                  </Label>
                  <Select value={selectedCnpjId} onValueChange={setSelectedCnpjId}>
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="Selecione o CNPJ (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem CNPJ vinculado</SelectItem>
                      {(cnpjsQuery.data ?? []).map((cnpj: any) => (
                        <SelectItem key={cnpj.id} value={String(cnpj.id)}>
                          {cnpj.nomeFantasia || cnpj.razaoSocial} - {cnpj.cnpj}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(cnpjsQuery.data ?? []).length === 0 && (
                    <p className="text-[10px] text-muted-foreground">Nenhum CNPJ cadastrado. Cadastre na p\u00e1gina de Clientes.</p>
                  )}
                </div>
              )}

              {orderType === "customer" && (
                <div className="space-y-2 sm:space-y-3">
                  <Label className="text-xs sm:text-sm">Buscar cliente</Label>
                  <div className="flex gap-2">
                    <Input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Nome do cliente" className="h-10 text-sm" />
                    <Button variant="outline" size="sm" onClick={startNewCustomer} className="shrink-0 h-10 text-xs px-3">Novo</Button>
                  </div>
                  {(customersQuery.data ?? []).length > 0 && (
                    <ScrollArea className="h-[120px] rounded-lg border border-border/60">
                      <div className="space-y-1 p-1">
                        {(customersQuery.data ?? []).map(customer => (
                          <button
                            key={customer.id}
                            onClick={() => applyCustomer(customer as CustomerRow)}
                            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent/50 active:bg-accent transition-colors"
                          >
                            <span className="font-medium text-foreground truncate">{customer.name}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0 ml-2">Selecionar</span>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                  {selectedCustomerId === "new" && (
                    <div className="space-y-2 rounded-lg border border-dashed border-border p-2.5 sm:p-3">
                      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                        <Input value={customerForm.name} onChange={e => setCustomerForm(c => ({ ...c, name: e.target.value }))} placeholder="Nome" className="h-10 text-sm" />
                        <Input value={customerForm.phone} onChange={e => setCustomerForm(c => ({ ...c, phone: e.target.value }))} placeholder="Telefone" className="h-10 text-sm" />
                      </div>
                      <Input value={customerForm.reference} onChange={e => setCustomerForm(c => ({ ...c, reference: e.target.value }))} placeholder="Referência" className="h-10 text-sm" />
                      <Button size="sm" onClick={saveCustomer} disabled={createCustomerMutation.isPending} className="w-full h-9 text-xs">
                        {createCustomerMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                        Salvar cliente
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-2 sm:gap-4 grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Mês</Label>
                  <Input value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} placeholder="Mês" className="h-10 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Ano</Label>
                  <Input value={selectedYear} onChange={e => setSelectedYear(e.target.value)} placeholder="Ano" className="h-10 text-sm" />
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 p-3 text-xs sm:text-sm space-y-1.5">
                <div className="flex items-center justify-between"><span>Cliente</span><strong className="text-right truncate ml-2">{orderType === "personal" ? "Compra pessoal" : customerForm.name || "Não selecionado"}</strong></div>
                <div className="flex items-center justify-between"><span>Referência</span><strong className="text-right truncate ml-2">{orderType === "personal" ? "Uso próprio" : customerForm.reference || "-"}</strong></div>
              </div>

              {/* Vincular a campanha de marketing */}
              {orderType === "customer" && (campaignsQuery.data ?? []).length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Veio de alguma campanha?</Label>
                  <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                    <SelectTrigger className="h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Nenhuma campanha (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma campanha</SelectItem>
                      {(campaignsQuery.data ?? []).map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">Observações</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações do pedido" rows={2} className="text-sm" />
              </div>

              <Separator />

              {/* Resumo do pedido */}
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex items-center justify-between"><span>Total de itens</span><strong>{localSimulation.totals.totalItens}</strong></div>
                <div className="flex items-center justify-between"><span>Total Mondial</span><strong>{formatCurrency(localSimulation.totals.totalMondial)}</strong></div>
                {orderType === "customer" ? (
                  <>
                    <div className="flex items-center justify-between"><span>Total venda</span><strong>{formatCurrency(localSimulation.totals.totalCliente)}</strong></div>
                    <div className="flex items-center justify-between"><span>Lucro previsto</span><strong className="text-emerald-600">{formatCurrency(localSimulation.totals.totalLucro)}</strong></div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between"><span>Everton (R$ 0,75/item)</span><strong>{formatCurrency(localSimulation.totals.totalComissaoEvertonMondial)}</strong></div>
                    <div className="flex items-center justify-between"><span>Total a pagar</span><strong className="text-orange-600">{formatCurrency(Number(localSimulation.totals.totalMondial) + Number(localSimulation.totals.totalComissaoEvertonMondial))}</strong></div>
                  </>
                )}
              </div>

              {editingOrderId ? (
                <div className="grid gap-2 grid-cols-2">
                  <Button variant="outline" onClick={cancelEditing} className="h-10 text-xs sm:text-sm">
                    <X className="mr-1.5 h-3.5 w-3.5" /> Cancelar
                  </Button>
                  <Button onClick={() => saveOrder("finalized")} disabled={updateOrderMutation.isPending} className="h-10 text-xs sm:text-sm bg-amber-600 hover:bg-amber-700">
                    {updateOrderMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit3 className="mr-1.5 h-3.5 w-3.5" />}
                    Salvar altera\u00e7\u00f5es
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2 grid-cols-2">
                  <Button variant="outline" onClick={() => saveOrder("created")} disabled={createOrderMutation.isPending} className="h-10 text-xs sm:text-sm">
                    Salvar
                  </Button>
                  <Button onClick={() => saveOrder("finalized")} disabled={createOrderMutation.isPending} className="h-10 text-xs sm:text-sm">
                    {createOrderMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Finalizar
                  </Button>
                </div>
              )}
              <div className="grid gap-2 grid-cols-2">
                <Button variant="outline" onClick={exportCustomerSheet} disabled={orderType === "personal" || cart.length === 0} className="h-9 text-xs">
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Cliente
                </Button>
                <Button variant="outline" onClick={exportMondialSheet} disabled={cart.length === 0} className="h-9 text-xs">
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Mondial
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Listas geradas ─────────────────────── */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
              <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" /> Listas geradas
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Resumo e lista da Mondial para o pedido.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 sm:space-y-4">
              <TabsList className="grid w-full grid-cols-3 h-9">
                <TabsTrigger value="resumo" className="text-xs sm:text-sm">Resumo</TabsTrigger>
                <TabsTrigger value="cliente" disabled={orderType === "personal"} className="text-xs sm:text-sm">Cliente</TabsTrigger>
                <TabsTrigger value="mondial" className="text-xs sm:text-sm">Mondial</TabsTrigger>
              </TabsList>
              <TabsContent value="resumo" className="space-y-2 text-xs sm:text-sm">
                {orderType === "customer" ? (
                  <>
                    <div className="flex items-center justify-between"><span>Total venda</span><strong>{formatCurrency(localSimulation.totals.totalCliente)}</strong></div>
                    <div className="flex items-center justify-between"><span>Total Mondial</span><strong>{formatCurrency(localSimulation.totals.totalMondial)}</strong></div>
                    <div className="flex items-center justify-between"><span>Impostos</span><strong>{formatCurrency(localSimulation.totals.totalImposto)}</strong></div>
                    <div className="flex items-center justify-between"><span>Lucro líquido</span><strong className="text-emerald-600">{formatCurrency(localSimulation.totals.totalLucro)}</strong></div>
                    <div className="flex items-center justify-between"><span>Margem</span><strong>{formatPercent(localSimulation.totals.margemPedido)}</strong></div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between"><span>Total Mondial</span><strong>{formatCurrency(localSimulation.totals.totalMondial)}</strong></div>
                    <div className="flex items-center justify-between"><span>Everton (R$ 0,75/item)</span><strong>{formatCurrency(localSimulation.totals.totalComissaoEvertonMondial)}</strong></div>
                    <div className="flex items-center justify-between"><span>Total a pagar</span><strong className="text-orange-600">{formatCurrency(Number(localSimulation.totals.totalMondial) + Number(localSimulation.totals.totalComissaoEvertonMondial))}</strong></div>
                  </>
                )}
              </TabsContent>
              <TabsContent value="cliente" className="space-y-2">
                {orderType === "personal" ? (
                  <div className="rounded-xl bg-muted/60 p-3 text-xs sm:text-sm text-muted-foreground">
                    Compras pessoais não geram lista de cliente.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                    <ScrollArea className="h-[200px] sm:h-[220px]">
                      <Table style={{ minWidth: 400 }}>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">SKU</TableHead>
                            <TableHead className="text-xs">Título</TableHead>
                            <TableHead className="text-xs">Qtd</TableHead>
                            <TableHead className="text-xs">Preço</TableHead>
                            <TableHead className="text-xs">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {localSimulation.customerList.map(item => (
                            <TableRow key={`${item.sku}-cliente`}>
                              <TableCell className="text-xs">{item.sku}</TableCell>
                              <TableCell className="text-xs max-w-[120px] sm:max-w-[180px] truncate">{item.titulo}</TableCell>
                              <TableCell className="text-xs">{item.quantidade}</TableCell>
                              <TableCell className="text-xs">{formatCurrency(item.precoVendaUnitario)}</TableCell>
                              <TableCell className="text-xs">{formatCurrency(item.totalCliente)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="mondial" className="space-y-2">
                <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                  <ScrollArea className="h-[200px] sm:h-[220px]">
                    <Table style={{ minWidth: 400 }}>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">SKU</TableHead>
                          <TableHead className="text-xs">Título</TableHead>
                          <TableHead className="text-xs">Qtd</TableHead>
                          <TableHead className="text-xs">Valor</TableHead>
                          <TableHead className="text-xs">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {localSimulation.mondialList.map(item => (
                          <TableRow key={`${item.sku}-mondial`}>
                            <TableCell className="text-xs">{item.sku}</TableCell>
                            <TableCell className="text-xs max-w-[120px] sm:max-w-[180px] truncate">{item.titulo}</TableCell>
                            <TableCell className="text-xs">{item.quantidade}</TableCell>
                            <TableCell className="text-xs">{formatCurrency(item.valorCompraUnitario)}</TableCell>
                            <TableCell className="text-xs">{formatCurrency(item.totalMondial)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ── Histórico de pedidos ───────────────── */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-xl">Histórico de pedidos</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Pedidos salvos e finalizados.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {/* Mobile: card list */}
            <div className="space-y-2 lg:hidden">
              {(ordersQuery.data ?? []).map(order => (
                <div key={order.id} className="rounded-xl border border-border/60 bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={order.orderType === "personal" ? "outline" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {order.orderType === "personal" ? "Pessoal" : "Cliente"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">#{order.id}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{order.status}</Badge>
                  </div>
                  <div className="mt-1.5 text-sm font-medium text-foreground">{order.customerName}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{order.orderType === "personal" ? "Mondial" : "Venda"}: {order.orderType === "personal" ? formatCurrency(order.totalMondial) : formatCurrency(order.totalCliente)}</span>
                    <span>Mondial: {formatCurrency(order.totalMondial)}</span>
                  </div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => changeTypeMutation.mutate({ orderId: order.id, orderType: order.orderType === "personal" ? "customer" : "personal" })}
                      disabled={changeTypeMutation.isPending}
                      className="h-7 text-[10px] flex-1 border-blue-500/50 text-blue-500 hover:bg-blue-500/10"
                    >
                      <RefreshCw className={`mr-1 h-3 w-3 ${changeTypeMutation.isPending ? "animate-spin" : ""}`} />
                      {order.orderType === "personal" ? "Mudar p/ Cliente" : "Mudar p/ Pessoal"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => loadOrderForEditing(order.id)} className="h-7 text-[10px] flex-1">
                      <Edit3 className="mr-1 h-3 w-3" /> Editar
                    </Button>
                    {showDeleteConfirm === order.id ? (
                      <div className="flex gap-1 flex-1">
                        <Button size="sm" variant="destructive" onClick={() => deleteOrderMutation.mutate({ orderId: order.id })} disabled={deleteOrderMutation.isPending} className="h-7 text-[10px] flex-1">
                          Confirmar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(null)} className="h-7 text-[10px]">
                          N\u00e3o
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(order.id)} className="h-7 text-[10px] text-destructive">
                        <Trash2 className="mr-1 h-3 w-3" /> Excluir
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {(ordersQuery.data ?? []).length === 0 && (
                <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                  Nenhum pedido registrado ainda.
                </div>
              )}
            </div>

            {/* Desktop: table */}
            <div className="hidden lg:block" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <Table style={{ minWidth: 600 }}>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Total venda / Mondial</TableHead>
                    <TableHead>Total Mondial</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">A\u00e7\u00f5es</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ordersQuery.data ?? []).map(order => (
                    <TableRow key={order.id}>
                      <TableCell>#{order.id}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => changeTypeMutation.mutate({ orderId: order.id, orderType: order.orderType === "personal" ? "customer" : "personal" })}
                          disabled={changeTypeMutation.isPending}
                          className="h-7 text-[11px] border-blue-500/50 text-blue-500 hover:bg-blue-500/10"
                        >
                          <RefreshCw className={`mr-1 h-3 w-3 ${changeTypeMutation.isPending ? "animate-spin" : ""}`} />
                          {order.orderType === "personal" ? "Pessoal" : "Cliente"}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{order.customerName}</TableCell>
                      <TableCell>{order.orderType === "personal" ? formatCurrency(order.totalMondial) : formatCurrency(order.totalCliente)}</TableCell>
                      <TableCell>{formatCurrency(order.totalMondial)}</TableCell>
                      <TableCell>{order.status}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => loadOrderForEditing(order.id)} className="h-8 text-xs mr-1">
                          <Edit3 className="mr-1 h-3.5 w-3.5" /> Editar
                        </Button>
                        {showDeleteConfirm === order.id ? (
                          <>
                            <Button size="sm" variant="destructive" onClick={() => deleteOrderMutation.mutate({ orderId: order.id })} disabled={deleteOrderMutation.isPending} className="h-8 text-xs mr-1">
                              Confirmar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(null)} className="h-8 text-xs">
                              N\u00e3o
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(order.id)} className="h-8 text-xs text-destructive">
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
                          </Button>
                        )}
                      </TableCell>
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
