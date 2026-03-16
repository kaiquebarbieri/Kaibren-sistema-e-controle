import { useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Loader2, PackageSearch, ShoppingCart, Upload, Wallet } from "lucide-react";
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

function formatCurrency(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(value: string | number | null | undefined) {
  const amount = Number(value ?? 0) * 100;
  return `${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
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

export default function Home() {
  const { user, loading } = useAuth();
  const [query, setQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [cart, setCart] = useState<CartItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const productsQuery = trpc.products.search.useQuery({ query, limit: 30 });
  const latestUploadQuery = trpc.products.latestUpload.useQuery();
  const ordersQuery = trpc.orders.list.useQuery();
  const dashboardQuery = trpc.dashboard.monthly.useQuery({
    periodMonth: Number(selectedMonth),
    periodYear: Number(selectedYear),
  });

  const simulateMutation = trpc.orders.simulate.useMutation();
  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: async () => {
      toast.success("Pedido salvo com sucesso.");
      setCart([]);
      setCustomerName("");
      setCustomerReference("");
      setNotes("");
      await ordersQuery.refetch();
      await dashboardQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const importMutation = trpc.products.importSpreadsheet.useMutation({
    onSuccess: async data => {
      toast.success(`Planilha importada com ${data.replaced.inserted} produtos.`);
      await productsQuery.refetch();
      await latestUploadQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const totals = useMemo(() => {
    return cart.reduce(
      (acc, item) => {
        const quantidade = Number(item.quantidade);
        acc.totalCliente += Number(item.precoFinal || item.precoDesejado) * quantidade;
        acc.totalMondial += Number(item.valorProduto) * quantidade;
        acc.totalLucro += Number(item.lucroUnitario) * quantidade;
        acc.totalComissao += Number(item.comissao) * quantidade;
        acc.totalItens += quantidade;
        return acc;
      },
      { totalCliente: 0, totalMondial: 0, totalLucro: 0, totalComissao: 0, totalItens: 0 }
    );
  }, [cart]);

  const simulation = simulateMutation.data;

  async function handleImportChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const buffer = await file.arrayBuffer();
    const workbook = await import("xlsx");
    const sheet = workbook.read(buffer, { type: "array" });
    const worksheet = sheet.Sheets["Tabela"];
    const rows = workbook.utils.sheet_to_json<Record<string, string | number | null>>(worksheet, { defval: null });
    const fileContentBase64 = await readWorkbookAsBase64(file);

    await importMutation.mutateAsync({
      fileName: file.name,
      fileContentBase64,
      sourceSheetName: "Tabela",
      products: rows.map(row => ({
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
        return current.map(item =>
          item.sku === product.sku ? { ...item, quantidade: item.quantidade + 1 } : item
        );
      }

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

  function updateQuantity(sku: string, quantidade: number) {
    setCart(current => current.map(item => (item.sku === sku ? { ...item, quantidade: Math.max(1, quantidade) } : item)));
  }

  function removeItem(sku: string) {
    setCart(current => current.filter(item => item.sku !== sku));
  }

  async function runSimulation() {
    if (cart.length === 0) {
      toast.error("Adicione pelo menos um produto para simular.");
      return;
    }

    await simulateMutation.mutateAsync({ items: cart });
  }

  async function saveOrder(status: "created" | "finalized") {
    if (!customerName.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }

    if (cart.length === 0) {
      toast.error("Adicione itens ao pedido antes de salvar.");
      return;
    }

    await createOrderMutation.mutateAsync({
      customerName,
      customerReference,
      periodMonth: Number(selectedMonth),
      periodYear: Number(selectedYear),
      notes,
      status,
      items: cart,
    });
  }

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
            <CardDescription>Faça login para acessar a gestão de pedidos, margens e produtos.</CardDescription>
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
    <DashboardLayout>
      <div className="flex flex-col gap-6 bg-background">
        <section className="rounded-3xl border border-border/60 bg-card px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                Gestão comercial CK Distribuidora
              </Badge>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Pedidos, margens e compras separadas por operação</h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Este painel mantém a separação clara entre os valores cobrados do cliente e os valores pagos para a Mondial, com busca rápida por SKU e Título, histórico completo de pedidos e acompanhamento financeiro mensal.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportChange} />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending}>
                {importMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Importar planilha Excel
              </Button>
              <Button onClick={runSimulation} disabled={simulateMutation.isPending || cart.length === 0}>
                {simulateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                Simular pedido atual
              </Button>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/60 shadow-none">
              <CardHeader className="pb-2">
                <CardDescription>Última planilha importada</CardDescription>
                <CardTitle className="text-base">Backup e auditoria</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {latestUploadQuery.data ? latestUploadQuery.data.fileName : "Nenhuma planilha importada ainda."}
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-none">
              <CardHeader className="pb-2">
                <CardDescription>Total para cliente</CardDescription>
                <CardTitle className="text-base">Pedido atual</CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{formatCurrency(totals.totalCliente)}</CardContent>
            </Card>
            <Card className="border-border/60 shadow-none">
              <CardHeader className="pb-2">
                <CardDescription>Total para Mondial</CardDescription>
                <CardTitle className="text-base">Compra atual</CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{formatCurrency(totals.totalMondial)}</CardContent>
            </Card>
            <Card className="border-border/60 shadow-none">
              <CardHeader className="pb-2">
                <CardDescription>Comissão Everton Mondial</CardDescription>
                <CardTitle className="text-base">0,75 por produto</CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{formatCurrency(totals.totalComissao)}</CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><PackageSearch className="h-5 w-5" /> Produtos e montagem do pedido</CardTitle>
              <CardDescription>Pesquise por nome ou SKU, adicione os itens e mantenha os valores de cliente e Mondial sempre separados.</CardDescription>
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
                        <TableCell className="max-w-[360px] truncate">{product.titulo}</TableCell>
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
              <CardTitle className="text-xl">Dados do pedido</CardTitle>
              <CardDescription>Cadastre o cliente, defina o período mensal e monte a lista final para venda e compra.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nome do cliente" />
                <Input value={customerReference} onChange={e => setCustomerReference(e.target.value)} placeholder="Referência do cliente" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} placeholder="Mês" />
                <Input value={selectedYear} onChange={e => setSelectedYear(e.target.value)} placeholder="Ano" />
              </div>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações do pedido" rows={4} />
              <Separator />
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span>Total de itens</span><strong>{totals.totalItens}</strong></div>
                <div className="flex items-center justify-between"><span>Total cliente</span><strong>{formatCurrency(totals.totalCliente)}</strong></div>
                <div className="flex items-center justify-between"><span>Total Mondial</span><strong>{formatCurrency(totals.totalMondial)}</strong></div>
                <div className="flex items-center justify-between"><span>Lucro estimado</span><strong>{formatCurrency(totals.totalLucro)}</strong></div>
                <div className="flex items-center justify-between"><span>Everton Mondial</span><strong>{formatCurrency(totals.totalComissao)}</strong></div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Button variant="outline" onClick={() => saveOrder("created")} disabled={createOrderMutation.isPending}>
                  Salvar pedido
                </Button>
                <Button onClick={() => saveOrder("finalized")} disabled={createOrderMutation.isPending}>
                  Finalizar pedido
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Itens do pedido em montagem</CardTitle>
              <CardDescription>Cada item exibe separadamente a venda ao cliente, o custo na Mondial, a comissão Everton Mondial e o lucro.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[320px] rounded-2xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Mondial</TableHead>
                      <TableHead>Everton Mondial</TableHead>
                      <TableHead>Lucro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                          Nenhum item adicionado ao pedido.
                        </TableCell>
                      </TableRow>
                    ) : (
                      cart.map(item => (
                        <TableRow key={item.sku}>
                          <TableCell className="font-medium">{item.sku}</TableCell>
                          <TableCell className="max-w-[280px] truncate">{item.titulo}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              value={item.quantidade}
                              onChange={e => updateQuantity(item.sku, Number(e.target.value))}
                              className="h-9 w-20"
                            />
                          </TableCell>
                          <TableCell>{formatCurrency(Number(item.precoFinal || item.precoDesejado) * item.quantidade)}</TableCell>
                          <TableCell>{formatCurrency(Number(item.valorProduto) * item.quantidade)}</TableCell>
                          <TableCell>{formatCurrency(Number(item.comissao) * item.quantidade)}</TableCell>
                          <TableCell>{formatCurrency(Number(item.lucroUnitario) * item.quantidade)}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => removeItem(item.sku)}>
                              Remover
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Simulação e listas operacionais</CardTitle>
              <CardDescription>Ao simular, o sistema gera separadamente a lista do cliente com preços de venda e a lista da Mondial com os valores de compra.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="resumo" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="resumo">Resumo</TabsTrigger>
                  <TabsTrigger value="cliente">Cliente</TabsTrigger>
                  <TabsTrigger value="mondial">Mondial</TabsTrigger>
                </TabsList>
                <TabsContent value="resumo" className="space-y-3 text-sm">
                  <div className="flex items-center justify-between"><span>Total cliente</span><strong>{simulation ? formatCurrency(simulation.totals.totalCliente) : formatCurrency(totals.totalCliente)}</strong></div>
                  <div className="flex items-center justify-between"><span>Total Mondial</span><strong>{simulation ? formatCurrency(simulation.totals.totalMondial) : formatCurrency(totals.totalMondial)}</strong></div>
                  <div className="flex items-center justify-between"><span>Everton Mondial</span><strong>{simulation ? formatCurrency(simulation.totals.totalComissaoEvertonMondial) : formatCurrency(totals.totalComissao)}</strong></div>
                  <div className="flex items-center justify-between"><span>Lucro</span><strong>{simulation ? formatCurrency(simulation.totals.totalLucro) : formatCurrency(totals.totalLucro)}</strong></div>
                  <div className="flex items-center justify-between"><span>Margem final</span><strong>{simulation ? formatPercent(simulation.totals.margemPedido) : formatPercent(totals.totalMondial === 0 ? 0 : totals.totalLucro / totals.totalMondial)}</strong></div>
                </TabsContent>
                <TabsContent value="cliente">
                  <ScrollArea className="h-[220px] rounded-2xl border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Qtd</TableHead>
                          <TableHead>Preço venda</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(simulation?.customerList ?? []).map(item => (
                          <TableRow key={`${item.sku}-cliente`}>
                            <TableCell>{item.sku}</TableCell>
                            <TableCell className="max-w-[220px] truncate">{item.titulo}</TableCell>
                            <TableCell>{item.quantidade}</TableCell>
                            <TableCell>{formatCurrency(item.precoVendaUnitario)}</TableCell>
                            <TableCell>{formatCurrency(item.totalCliente)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="mondial">
                  <ScrollArea className="h-[220px] rounded-2xl border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Qtd</TableHead>
                          <TableHead>Valor compra</TableHead>
                          <TableHead>Everton Mondial</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(simulation?.mondialList ?? []).map(item => (
                          <TableRow key={`${item.sku}-mondial`}>
                            <TableCell>{item.sku}</TableCell>
                            <TableCell className="max-w-[220px] truncate">{item.titulo}</TableCell>
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

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Dashboard mensal</CardTitle>
              <CardDescription>Consolidação por período selecionado com compras, custos, lucros e margem da operação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Input value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} placeholder="Mês" />
                <Input value={selectedYear} onChange={e => setSelectedYear(e.target.value)} placeholder="Ano" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="shadow-none">
                  <CardHeader className="pb-2"><CardDescription>Total de pedidos</CardDescription><CardTitle className="text-lg">{dashboardQuery.data?.totalPedidos ?? 0}</CardTitle></CardHeader>
                </Card>
                <Card className="shadow-none">
                  <CardHeader className="pb-2"><CardDescription>Total de compras Mondial</CardDescription><CardTitle className="text-lg">{formatCurrency(dashboardQuery.data?.totalMondial)}</CardTitle></CardHeader>
                </Card>
                <Card className="shadow-none">
                  <CardHeader className="pb-2"><CardDescription>Total vendido ao cliente</CardDescription><CardTitle className="text-lg">{formatCurrency(dashboardQuery.data?.totalCliente)}</CardTitle></CardHeader>
                </Card>
                <Card className="shadow-none">
                  <CardHeader className="pb-2"><CardDescription>Lucro no período</CardDescription><CardTitle className="text-lg">{formatCurrency(dashboardQuery.data?.totalLucro)}</CardTitle></CardHeader>
                </Card>
              </div>
              <div className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                Margem média do período: <strong className="text-foreground">{formatPercent(dashboardQuery.data?.margemMedia)}</strong>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Histórico de pedidos</CardTitle>
              <CardDescription>Registro completo de pedidos realizados com cliente, totais, status e referência mensal.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[360px] rounded-2xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Mondial</TableHead>
                      <TableHead>Lucro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ordersQuery.data ?? []).map(order => (
                      <TableRow key={order.id}>
                        <TableCell>#{order.id}</TableCell>
                        <TableCell>{order.customerName}</TableCell>
                        <TableCell>
                          <Badge variant={order.status === "finalized" ? "default" : "secondary"}>{order.status}</Badge>
                        </TableCell>
                        <TableCell>{String(order.periodMonth).padStart(2, "0")}/{order.periodYear}</TableCell>
                        <TableCell>{formatCurrency(order.totalCliente)}</TableCell>
                        <TableCell>{formatCurrency(order.totalMondial)}</TableCell>
                        <TableCell>{formatCurrency(order.totalLucro)}</TableCell>
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
