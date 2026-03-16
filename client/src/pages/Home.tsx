import { useEffect, useMemo, useRef, useState } from "react";
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
  BarChart3,
  CreditCard,
  Download,
  Loader2,
  PackageSearch,
  Search,
  ShoppingCart,
  Upload,
  UserPlus,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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

type SimulationResult = ReturnType<typeof buildSimulation>;

const KAIBREN_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/95597689/XxwarzmhDMwJNs5J3puu6o/kaibren-logo_40d0a45a.png";
const KAIBREN_COLORS = {
  gold: "#D4AF37",
  black: "#1C1C1C",
  ivory: "#F5F2E9",
  gray: "#8E8E8E",
};

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

function readWorkbookAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createEmptyCustomerForm(): CustomerForm {
  return {
    name: "",
    reference: "",
    document: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    notes: "",
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

function autosizeColumns(rows: Record<string, unknown>[]) {
  const keys = rows.length > 0 ? Object.keys(rows[0]) : [];
  return keys.map(key => {
    const maxLength = Math.max(
      key.length,
      ...rows.map(row => String(row[key] ?? "").length)
    );
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
    [brandLine],
    [listTitle],
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

export default function Home() {
  const { user, loading } = useAuth();
  const [query, setQuery] = useState("");
  const [skuQuickEntry, setSkuQuickEntry] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("new");
  const [customerForm, setCustomerForm] = useState<CustomerForm>(() => createEmptyCustomerForm());
  const [orderType, setOrderType] = useState<"customer" | "personal">("customer");
  const [notes, setNotes] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeTab, setActiveTab] = useState("resumo");
  const [menuSection, setMenuSection] = useState("visao-geral");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const skuQuickEntryRef = useRef<HTMLInputElement | null>(null);
  const overviewRef = useRef<HTMLElement | null>(null);
  const customerRef = useRef<HTMLElement | null>(null);
  const productsRef = useRef<HTMLElement | null>(null);
  const simulationRef = useRef<HTMLElement | null>(null);
  const dashboardRef = useRef<HTMLElement | null>(null);
  const ordersRef = useRef<HTMLElement | null>(null);

  const productsQuery = trpc.products.search.useQuery({ query, limit: 30 });
  const allProductsQuery = trpc.products.list.useQuery({ limit: 500 });
  const latestUploadQuery = trpc.products.latestUpload.useQuery();
  const ordersQuery = trpc.orders.list.useQuery();
  const dashboardQuery = trpc.dashboard.monthly.useQuery({
    periodMonth: Number(selectedMonth),
    periodYear: Number(selectedYear),
  });
  const customersQuery = trpc.customers.search.useQuery({
    query: customerSearch,
    limit: 50,
  });

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
      await dashboardQuery.refetch();
      setTimeout(() => {
        ordersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    },
    onError: error => toast.error(error.message),
  });

  const importMutation = trpc.products.importSpreadsheet.useMutation({
    onSuccess: async data => {
      toast.success(`Planilha importada com ${data.replaced.inserted} produtos.`);
      await productsQuery.refetch();
      await allProductsQuery.refetch();
      await latestUploadQuery.refetch();
      setTimeout(() => {
        productsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    },
    onError: error => toast.error(error.message),
  });

  const selectedCustomer = useMemo(() => {
    return (customersQuery.data ?? []).find(customer => String(customer.id) === selectedCustomerId) ?? null;
  }, [customersQuery.data, selectedCustomerId]);

  const localSimulation = useMemo(() => buildSimulation(cart, orderType), [cart, orderType]);

  const quickSkuMatches = useMemo(() => {
    const normalized = skuQuickEntry.trim().toLowerCase();
    if (!normalized) return [] as ProductRow[];
    return ((allProductsQuery.data ?? []) as ProductRow[])
      .filter(product => product.sku.toLowerCase().includes(normalized))
      .slice(0, 8);
  }, [allProductsQuery.data, skuQuickEntry]);

  const selectedQuickProduct = useMemo(() => {
    const normalized = skuQuickEntry.trim().toLowerCase();
    if (!normalized) return null;
    return ((allProductsQuery.data ?? []) as ProductRow[]).find(product => product.sku.toLowerCase() === normalized) ?? null;
  }, [allProductsQuery.data, skuQuickEntry]);

  function navigateToSection(section: string) {
    setMenuSection(section);
    const map: Record<string, React.RefObject<HTMLElement | null>> = {
      "visao-geral": overviewRef,
      importacao: overviewRef,
      clientes: customerRef,
      produtos: productsRef,
      simulacao: simulationRef,
      pedidos: ordersRef,
      "dashboard-mensal": dashboardRef,
    };

    const target = map[section]?.current;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function handleImportChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const workbook = await import("xlsx");
    const sheet = workbook.read(buffer, { type: "array" });
    const worksheet = sheet.Sheets["Tabela"];

    if (!worksheet) {
      toast.error("A aba 'Tabela' não foi encontrada na planilha enviada.");
      event.target.value = "";
      return;
    }

    const rows = workbook.utils.sheet_to_json<Record<string, string | number | null>>(worksheet, { defval: null });
    const fileContentBase64 = await readWorkbookAsBase64(file);

    await importMutation.mutateAsync({
      fileName: file.name,
      fileContentBase64,
      sourceSheetName: "Tabela",
      products: rows
        .filter(row => String(row["SKU"] ?? "").trim().length > 0)
        .map(row => ({
          SKU: String(row["SKU"] ?? ""),
          Título: String(row["Título"] ?? ""),
          "Tabela Nova CK": row["Tabela Nova CK"] ?? 0,
          Imposto: row["Imposto"] ?? 0,
          Comissão: row["Comissão"] ?? 0.75,
          "Valor Produto": row["Valor Produto"] ?? 0,
          "Preço Desejado": row["Preço Desejado"] ?? 0,
          "Margem Desejada": row["Margem Desejada"] ?? null,
          "Preço Final": row["Preço Final"] ?? row["Preço Desejado"] ?? 0,
          "Margem Final": row["Margem Final"] ?? 0,
          Lucro: row["Lucro"] ?? 0,
        })),
    });

    event.target.value = "";
  }

  function addToCart(product: ProductRow) {
    setCart(current => {
      const existing = current.find(item => item.sku === product.sku);
      if (existing) {
        toast.success(`Quantidade de ${product.sku} atualizada no pedido.`);
        return current.map(item =>
          item.sku === product.sku ? { ...item, quantidade: item.quantidade + 1 } : item
        );
      }

      toast.success(`${product.sku} adicionado à compra.`);
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
    const exactProduct = ((allProductsQuery.data ?? []) as ProductRow[]).find(product => product.sku.toLowerCase() === normalized);
    const product = exactProduct ?? quickSkuMatches[0] ?? null;

    if (!product) {
      toast.error("Nenhum produto encontrado para esse SKU.");
      return;
    }

    addToCart(product);
    setActiveTab("mondial");
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
    toast.success(`Item ${sku} removido da compra.`);
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

  useEffect(() => {
    if (skuQuickEntryRef.current) {
      skuQuickEntryRef.current.focus();
    }
  }, []);

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
            <CardDescription>Faça login para acessar a gestão de pedidos, margens, clientes e produtos.</CardDescription>
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

  const monthly = dashboardQuery.data;

  return (
    <DashboardLayout onNavigate={navigateToSection} activeSection={menuSection}>
      <div className="flex flex-col gap-6 bg-background">
        <section ref={overviewRef} className="overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-sm">
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-8">
            <div className="space-y-4">
              <Badge variant="secondary" className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
                Operação comercial CK Distribuidora
              </Badge>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight">Dashboard com compras pessoais, pedidos de clientes e lucro salvo</h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-200">
                  Agora o painel foi reorganizado para destacar o total comprado no mês, o total vendido para clientes da distribuidora e o lucro gerado nas operações de revenda, mantendo a separação entre cliente e Mondial.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportChange} />
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending}>
                  {importMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Importar planilha Excel
                </Button>
                <Button className="bg-emerald-500 text-white hover:bg-emerald-400" onClick={() => navigateToSection("clientes")}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Cadastrar cliente
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-white/10 bg-white/5 text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardDescription className="text-slate-300">Total comprado no mês</CardDescription>
                  <CardTitle className="text-base text-white">Compras pessoais + pedidos</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {formatCurrency(Number(monthly?.totalMondial ?? 0))}
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-white/5 text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardDescription className="text-slate-300">Total vendido para clientes</CardDescription>
                  <CardTitle className="text-base text-white">Receita da distribuidora</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {formatCurrency(Number(monthly?.totalVendasClientes ?? 0))}
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-white/5 text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardDescription className="text-slate-300">Lucro salvo no mês</CardDescription>
                  <CardTitle className="text-base text-white">Pedidos de cliente</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {formatCurrency(Number(monthly?.totalLucro ?? 0))}
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-white/5 text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardDescription className="text-slate-300">Última planilha importada</CardDescription>
                  <CardTitle className="text-base text-white">Backup e auditoria</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-slate-100">
                  {latestUploadQuery.data ? latestUploadQuery.data.fileName : "Nenhuma planilha importada ainda."}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Pedidos de clientes</CardDescription>
              <CardTitle className="text-base">Quantidade no período</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{Number(monthly?.totalPedidosCliente ?? 0)}</CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Compras pessoais</CardDescription>
              <CardTitle className="text-base">Valor pago à Mondial</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatCurrency(Number(monthly?.totalComprasPessoais ?? 0))}</CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Comissão Everton Mondial</CardDescription>
              <CardTitle className="text-base">Total no período</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatCurrency(Number(monthly?.totalComissaoEvertonMondial ?? 0))}</CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Margem média</CardDescription>
              <CardTitle className="text-base">Pedidos de cliente</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatPercent(Number(monthly?.margemMedia ?? 0))}</CardContent>
          </Card>
        </section>

        <section ref={customerRef} className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><UserPlus className="h-5 w-5" /> Cadastro e busca de clientes</CardTitle>
              <CardDescription>Cadastre todos os seus clientes e localize pelo nome quando for montar a lista de compra.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
                <Input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Buscar cliente por nome, telefone ou referência" />
                <Button variant="outline" onClick={startNewCustomer}>Novo cliente</Button>
              </div>
              <ScrollArea className="h-[240px] rounded-2xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Referência</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(customersQuery.data ?? []).map(customer => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.reference ?? "-"}</TableCell>
                        <TableCell>{customer.phone ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => applyCustomer(customer as CustomerRow)}>
                            Usar no pedido
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Dados do cliente selecionado</CardTitle>
              <CardDescription>Esses dados ficam salvos e podem ser reaproveitados em novos pedidos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={customerForm.name} onChange={e => setCustomerForm(current => ({ ...current, name: e.target.value }))} placeholder="Nome do cliente" />
                </div>
                <div className="space-y-2">
                  <Label>Referência</Label>
                  <Input value={customerForm.reference} onChange={e => setCustomerForm(current => ({ ...current, reference: e.target.value }))} placeholder="Como você identifica esse cliente" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Documento</Label>
                  <Input value={customerForm.document} onChange={e => setCustomerForm(current => ({ ...current, document: e.target.value }))} placeholder="CPF ou CNPJ" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={customerForm.phone} onChange={e => setCustomerForm(current => ({ ...current, phone: e.target.value }))} placeholder="Telefone" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={customerForm.email} onChange={e => setCustomerForm(current => ({ ...current, email: e.target.value }))} placeholder="E-mail" />
                </div>
                <div className="space-y-2">
                  <Label>Cidade / Estado</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={customerForm.city} onChange={e => setCustomerForm(current => ({ ...current, city: e.target.value }))} placeholder="Cidade" />
                    <Input value={customerForm.state} onChange={e => setCustomerForm(current => ({ ...current, state: e.target.value }))} placeholder="UF" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações do cliente</Label>
                <Textarea value={customerForm.notes} onChange={e => setCustomerForm(current => ({ ...current, notes: e.target.value }))} rows={4} placeholder="Informações úteis sobre o cliente" />
              </div>
              <Button onClick={saveCustomer} disabled={createCustomerMutation.isPending}>
                {createCustomerMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar cliente
              </Button>
              {selectedCustomer ? (
                <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
                  Cliente atual no pedido: <strong className="text-foreground">{selectedCustomer.name}</strong>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section ref={productsRef} className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><PackageSearch className="h-5 w-5" /> Produtos e lista de compra</CardTitle>
              <CardDescription>Pesquise por nome ou SKU, adicione os itens e mantenha os valores de cliente e Mondial separados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por SKU ou Título" />
                </div>
                <div className="flex items-center rounded-xl border border-dashed border-border px-4 text-sm text-muted-foreground">
                  {productsQuery.data?.length ?? 0} produtos encontrados
                </div>
              </div>
              <ScrollArea className="h-[420px] rounded-2xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Valor Produto</TableHead>
                      <TableHead>Preço Desejado</TableHead>
                      <TableHead>Lucro</TableHead>
                      <TableHead>Everton Mondial</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(productsQuery.data ?? []).map(product => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.sku}</TableCell>
                        <TableCell className="max-w-[320px] truncate">{product.titulo}</TableCell>
                        <TableCell>{formatCurrency(product.valorProduto)}</TableCell>
                        <TableCell>{formatCurrency(product.precoFinal || product.precoDesejado)}</TableCell>
                        <TableCell>{formatCurrency(product.lucro)}</TableCell>
                        <TableCell>{formatCurrency(product.comissao)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => addToCart(product as ProductRow)}>
                            Adicionar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><ShoppingCart className="h-5 w-5" /> Configuração da compra</CardTitle>
              <CardDescription>Agora você pode digitar o SKU direto, puxar o produto, montar a lista e já baixar as duas planilhas estruturadas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4">
                <div className="space-y-2">
                  <Label>Adicionar produto pelo número SKU</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={skuQuickEntryRef}
                      value={skuQuickEntry}
                      onChange={e => setSkuQuickEntry(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addBySku();
                        }
                      }}
                      placeholder="Digite o SKU e pressione Enter"
                    />
                    <Button type="button" variant="outline" onClick={addBySku}>
                      <Search className="mr-2 h-4 w-4" />
                      Buscar SKU
                    </Button>
                  </div>
                  {selectedQuickProduct ? (
                    <div className="rounded-xl bg-background p-3 text-sm shadow-sm">
                      <div className="font-medium text-foreground">{selectedQuickProduct.sku} — {selectedQuickProduct.titulo}</div>
                      <div className="mt-1 text-muted-foreground">
                        Mondial: {formatCurrency(selectedQuickProduct.valorProduto)} · Cliente: {formatCurrency(selectedQuickProduct.precoFinal || selectedQuickProduct.precoDesejado)}
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
                            {item.sku}
                          </Button>
                        )) : <span className="text-muted-foreground">Nenhum SKU encontrado</span>}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de pedido</Label>
                <Select value={orderType} onValueChange={value => setOrderType(value as "customer" | "personal") }>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Pedido de cliente</SelectItem>
                    <SelectItem value="personal">Compra pessoal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                <Label>Observações da compra</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações do pedido" rows={4} />
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
                  Finalizar pedido
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Button variant="outline" onClick={exportCustomerSheet} disabled={orderType === "personal" || cart.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar planilha Cliente
                </Button>
                <Button variant="outline" onClick={exportMondialSheet} disabled={cart.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar planilha Mondial
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section ref={simulationRef} className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Itens da compra em montagem</CardTitle>
              <CardDescription>Cada item mostra o valor de compra, o valor de venda e a comissão Everton Mondial por unidade ou quantidade.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 rounded-2xl border border-dashed border-border/60 bg-muted/30 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Itens já adicionados na lista atual</span>
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
                  <p className="mt-2 text-muted-foreground">Digite um SKU acima e pressione Enter para começar a montar a lista.</p>
                )}
              </div>
              <ScrollArea className="h-[340px] rounded-2xl border border-border/60">
                <Table>
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
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => removeItem(item.sku)}>
                            Remover
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Listas geradas automaticamente</CardTitle>
              <CardDescription>Ao salvar o pedido, o sistema mantém separadas a lista do cliente e a lista da Mondial, e você também pode baixar as duas manualmente.</CardDescription>
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
                      Compras pessoais não geram lista de cliente. O sistema salva apenas o custo Mondial dessa operação.
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
        </section>

        <section ref={dashboardRef} className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><BarChart3 className="h-5 w-5" /> Dashboard mensal</CardTitle>
              <CardDescription>Veja o total do mês separado entre compras pessoais, pedidos de cliente, lucro salvo e consolidado geral.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Input value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Input value={selectedYear} onChange={e => setSelectedYear(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="text-sm text-muted-foreground">Total comprado no mês</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(Number(monthly?.totalMondial ?? 0))}</p>
                </div>
                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="text-sm text-muted-foreground">Vendas para clientes</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(Number(monthly?.totalVendasClientes ?? 0))}</p>
                </div>
                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="text-sm text-muted-foreground">Compras pessoais</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(Number(monthly?.totalComprasPessoais ?? 0))}</p>
                </div>
                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="text-sm text-muted-foreground">Lucro salvo</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(Number(monthly?.totalLucro ?? 0))}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><Wallet className="h-5 w-5" /> Resumo operacional</CardTitle>
              <CardDescription>Os totais ficam registrados no dashboard sempre que um pedido ou compra pessoal é salvo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3"><span>Total de pedidos no período</span><strong>{Number(monthly?.totalPedidos ?? 0)}</strong></div>
              <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3"><span>Pedidos de clientes</span><strong>{Number(monthly?.totalPedidosCliente ?? 0)}</strong></div>
              <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3"><span>Pedidos pessoais</span><strong>{Number(monthly?.totalPedidosPessoais ?? 0)}</strong></div>
              <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3"><span>Total para cliente</span><strong>{formatCurrency(Number(monthly?.totalCliente ?? 0))}</strong></div>
              <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3"><span>Total Mondial</span><strong>{formatCurrency(Number(monthly?.totalMondial ?? 0))}</strong></div>
              <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3"><span>Margem média</span><strong>{formatPercent(Number(monthly?.margemMedia ?? 0))}</strong></div>
            </CardContent>
          </Card>
        </section>

        <section ref={ordersRef}>
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Histórico de pedidos e compras</CardTitle>
              <CardDescription>Cada pedido salvo registra se foi compra pessoal ou venda para cliente, com custo, venda e lucro persistidos no painel.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[320px] rounded-2xl border border-border/60">
                <Table>
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
              </ScrollArea>
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
