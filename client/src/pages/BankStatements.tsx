import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  Filter,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useRoute, useLocation } from "wouter";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CATEGORIES = [
  "Fornecedor",
  "Imposto / Tributo",
  "LIS / Cheque Especial",
  "Aluguel",
  "Salário / Funcionário",
  "Frete / Transporte",
  "Material / Insumo",
  "Embalagem",
  "Serviço / Terceiro",
  "Venda / Recebimento",
  "Pix Recebido",
  "Pix Enviado",
  "Transferência",
  "Tarifa Bancária",
  "Energia / Água / Internet",
  "Investimento",
  "Retirada / Pró-labore",
  "Empréstimo",
  "Outros",
];

function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function BankStatements() {
  const [, setLocation] = useLocation();
  const [matchDetail, paramsDetail] = useRoute("/extratos/:id");
  const detailId = matchDetail ? parseInt(paramsDetail?.id || "0") : null;

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadBankName, setUploadBankName] = useState("");
  const [uploadMonth, setUploadMonth] = useState(String(new Date().getMonth() + 1));
  const [uploadYear, setUploadYear] = useState(String(new Date().getFullYear()));
  const [uploadPassword, setUploadPassword] = useState("");
  const [uploadCnpjId, setUploadCnpjId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [filterBank, setFilterBank] = useState("");
  const [filterYear, setFilterYear] = useState("");

  // Transaction editing
  const [editingTxnId, setEditingTxnId] = useState<number | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Search in transactions
  const [txnSearch, setTxnSearch] = useState("");
  const [txnFilter, setTxnFilter] = useState<"all" | "identified" | "pending">("all");
  const [txnCategoryFilter, setTxnCategoryFilter] = useState<string>("all");

  // Queries
  const cnpjsQuery = trpc.myCnpjs.list.useQuery();
  const statementsQuery = trpc.bankStatements.list.useQuery();
  const detailQuery = trpc.bankStatements.get.useQuery(
    { id: detailId! },
    { enabled: !!detailId }
  );

  const utils = trpc.useUtils();

  const deleteMutation = trpc.bankStatements.delete.useMutation({
    onSuccess: () => {
      toast.success("Extrato excluído com sucesso!");
      utils.bankStatements.list.invalidate();
      setLocation("/extratos");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateTxnMutation = trpc.bankStatements.updateTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transação atualizada!");
      utils.bankStatements.get.invalidate({ id: detailId! });
      utils.bankStatements.list.invalidate();
      setEditingTxnId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleUpload = useCallback(async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecione um arquivo PDF.");
      return;
    }
    if (!uploadBankName.trim()) {
      toast.error("Informe o nome do banco.");
      return;
    }
    if (!uploadCnpjId) {
      toast.error("Selecione o CNPJ deste extrato.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bankName", uploadBankName.trim());
      formData.append("periodMonth", uploadMonth);
      formData.append("periodYear", uploadYear);
      formData.append("cnpjId", uploadCnpjId);
      if (uploadPassword.trim()) {
        formData.append("pdfPassword", uploadPassword.trim());
      }

      const response = await fetch("/api/bank-statement/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao enviar extrato.");

      toast.success(`Extrato enviado! ${result.totalTransactions} transações extraídas.`);
      utils.bankStatements.list.invalidate();
      setShowUpload(false);
      setUploadBankName("");
      setUploadPassword("");
      setUploadCnpjId("");
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Navigate to the new statement
      if (result.statementId) {
        setLocation(`/extratos/${result.statementId}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar extrato.");
    } finally {
      setUploading(false);
    }
  }, [uploadBankName, uploadCnpjId, uploadMonth, uploadPassword, uploadYear, utils, setLocation]);

  const handleSaveTxn = useCallback((txnId: number) => {
    if (!detailId) return;
    updateTxnMutation.mutate({
      id: txnId,
      statementId: detailId,
      category: editCategory || null,
      userDescription: editDescription || null,
      isIdentified: (editCategory || editDescription) ? 1 : 0,
      notes: editNotes || null,
    });
  }, [detailId, editCategory, editDescription, editNotes, updateTxnMutation]);

  const startEditTxn = useCallback((txn: any) => {
    setEditingTxnId(txn.id);
    setEditCategory(txn.category || "");
    setEditDescription(txn.userDescription || "");
    setEditNotes(txn.notes || "");
  }, []);

  // Filtered statements
  const filteredStatements = useMemo(() => {
    if (!statementsQuery.data) return [];
    let list = statementsQuery.data;
    if (filterBank) {
      list = list.filter(s => s.bankName.toLowerCase().includes(filterBank.toLowerCase()));
    }
    if (filterYear) {
      list = list.filter(s => s.periodYear === parseInt(filterYear));
    }
    return list;
  }, [statementsQuery.data, filterBank, filterYear]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    if (!detailQuery.data?.transactions) return [];
    let list = detailQuery.data.transactions;
    if (txnSearch) {
      const q = txnSearch.toLowerCase();
      list = list.filter(t =>
        t.originalDescription.toLowerCase().includes(q) ||
        (t.userDescription && t.userDescription.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q))
      );
    }
    if (txnFilter === "identified") {
      list = list.filter(t => t.isIdentified === 1);
    } else if (txnFilter === "pending") {
      list = list.filter(t => t.isIdentified === 0);
    }
    if (txnCategoryFilter && txnCategoryFilter !== "all") {
      list = list.filter(t => t.category === txnCategoryFilter);
    }
    return list;
  }, [detailQuery.data?.transactions, txnSearch, txnFilter, txnCategoryFilter]);

  // Category breakdown stats
  const categoryStats = useMemo(() => {
    if (!detailQuery.data?.transactions) return [];
    const txns = detailQuery.data.transactions;
    const catMap = new Map<string, { count: number; total: number; type: "credit" | "debit" | "mixed" }>();
    for (const t of txns) {
      const cat = t.category || "Sem categoria";
      const existing = catMap.get(cat) || { count: 0, total: 0, type: t.transactionType as "credit" | "debit" | "mixed" };
      existing.count++;
      existing.total += parseFloat(String(t.amount));
      if (existing.type !== t.transactionType && existing.count > 1) existing.type = "mixed";
      catMap.set(cat, existing);
    }
    return Array.from(catMap.entries())
      .map(([category, stats]) => ({ category, ...stats }))
      .sort((a, b) => b.total - a.total);
  }, [detailQuery.data?.transactions]);

  // LIS stats (Cheque Especial - juros e IOF)
  const lisStats = useMemo(() => {
    if (!detailQuery.data?.transactions) return { total: 0, count: 0, items: [] as any[] };
    const txns = detailQuery.data.transactions;
    // Auto-detect LIS transactions by description keywords or category
    const lisItems = txns.filter(t => {
      const desc = t.originalDescription.toLowerCase();
      const cat = (t.category || "").toLowerCase();
      return cat.includes("lis") || cat.includes("cheque especial") ||
        desc.includes("cheque esp") || desc.includes("cheque especial") ||
        desc.includes("iof cheque") || desc.includes("juros cheque") ||
        desc.includes("lis ") || desc.includes("limite de credito");
    });
    const total = lisItems.reduce((s, t) => s + parseFloat(String(t.amount)), 0);
    return { total, count: lisItems.length, items: lisItems };
  }, [detailQuery.data?.transactions]);

  // Summary stats
  const txnStats = useMemo(() => {
    if (!detailQuery.data?.transactions) return { totalEntradas: 0, totalSaidas: 0, saldo: 0 };
    const txns = detailQuery.data.transactions;
    const totalEntradas = txns.filter(t => t.transactionType === "credit").reduce((s, t) => s + parseFloat(String(t.amount)), 0);
    const totalSaidas = txns.filter(t => t.transactionType === "debit").reduce((s, t) => s + parseFloat(String(t.amount)), 0);
    return { totalEntradas, totalSaidas, saldo: totalEntradas - totalSaidas };
  }, [detailQuery.data?.transactions]);

  // Export to Excel - colunas iguais ao PDF do banco
  const handleExportExcel = useCallback(async () => {
    if (!detailQuery.data) return;
    const { statement, transactions } = detailQuery.data;

    const XLSX = await import("xlsx");

    const fmtVal = (t: typeof transactions[0]) => {
      const v = parseFloat(String(t.amount));
      const formatted = v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return t.transactionType === "debit" ? `-R$ ${formatted}` : `R$ ${formatted}`;
    };

    // Colunas no mesmo formato do extrato do banco + identificação
    const rows = transactions.map(t => ({
      "Data Lançamento": t.transactionDate || "",
      "Data Contábil": (t as any).accountingDate || t.transactionDate || "",
      "Tipo": (t as any).bankType || (t.transactionType === "credit" ? "Entrada" : "Saída"),
      "Descrição": t.originalDescription || "",
      "Valor": fmtVal(t),
      "Categoria": t.category || "",
      "Identificação": t.userDescription || "",
      "Observações": t.notes || "",
      "Status": t.isIdentified ? "Identificado" : "Pendente",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 50 },
      { wch: 18 }, { wch: 20 }, { wch: 40 }, { wch: 30 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transações");

    // Aba de resumo
    const totalEntradas = txnStats.totalEntradas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalSaidas = txnStats.totalSaidas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const saldo = txnStats.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const summary = [
      { "Informação": "Banco", "Valor": statement.bankName },
      { "Informação": "Período", "Valor": `${MONTHS[statement.periodMonth - 1]}/${statement.periodYear}` },
      { "Informação": "Total de Transações", "Valor": String(transactions.length) },
      { "Informação": "Transações Identificadas", "Valor": `${transactions.filter(t => t.isIdentified === 1).length} de ${transactions.length}` },
      { "Informação": "Pendentes", "Valor": String(transactions.filter(t => t.isIdentified === 0).length) },
      { "Informação": "Total Entradas", "Valor": `R$ ${totalEntradas}` },
      { "Informação": "Total Saídas", "Valor": `R$ ${totalSaidas}` },
      { "Informação": "Saldo", "Valor": `R$ ${saldo}` },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summary);
    wsSummary["!cols"] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

    const fileName = `Extrato_${statement.bankName}_${MONTHS[statement.periodMonth - 1]}_${statement.periodYear}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("Planilha exportada com sucesso!");
  }, [detailQuery.data, txnStats]);

  /* ── DETAIL VIEW ── */
  if (detailId) {
    const { data, isLoading } = detailQuery;

    return (
      <DashboardLayout activeSection="extratos">
        <div className="p-4 md:p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/extratos")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-bold text-foreground">
                {isLoading ? "Carregando..." : data?.statement.bankName}
              </h1>
              {data && (
                <p className="text-sm text-muted-foreground">
                  {MONTHS[data.statement.periodMonth - 1]} / {data.statement.periodYear} — {data.statement.fileName}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!data}>
                <Download className="h-4 w-4 mr-1" /> Excel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Excluir este extrato e todas as transações?")) {
                    deleteMutation.mutate({ id: detailId });
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : data ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">ENTRADAS</span>
                    </div>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(txnStats.totalEntradas)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowDownCircle className="h-4 w-4 text-red-600" />
                      <span className="text-xs font-medium text-red-700 dark:text-red-400">SAÍDAS</span>
                    </div>
                    <p className="text-lg font-bold text-red-700 dark:text-red-300">{formatCurrency(txnStats.totalSaidas)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-400">IDENTIFICADAS</span>
                    </div>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                      {data.statement.totalIdentified} / {data.statement.totalTransactions}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-400">PENDENTES</span>
                    </div>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                      {data.statement.totalTransactions - data.statement.totalIdentified}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* LIS / Cheque Especial Card */}
              {lisStats.count > 0 && (
                <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="h-5 w-5 text-purple-600" />
                          <span className="text-sm font-semibold text-purple-700 dark:text-purple-400">LIS / Cheque Especial</span>
                        </div>
                        <p className="text-xs text-purple-600/70 dark:text-purple-400/70">
                          {lisStats.count} transações detectadas (juros + IOF)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{formatCurrency(lisStats.total)}</p>
                        <p className="text-xs text-purple-600/70 dark:text-purple-400/70">gasto neste mês</p>
                      </div>
                    </div>
                    {lisStats.items.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-800 space-y-1">
                        {lisStats.items.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-purple-500">{item.transactionDate}</span>
                              <span className="text-purple-700 dark:text-purple-300">{item.originalDescription}</span>
                            </div>
                            <span className="font-medium text-purple-700 dark:text-purple-300">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Category Breakdown */}
              {categoryStats.length > 0 && categoryStats.some(c => c.category !== "Sem categoria") && (
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Filter className="h-4 w-4" /> Gastos por Categoria
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="space-y-2">
                      {categoryStats.filter(c => c.category !== "Sem categoria").map(cat => {
                        const maxTotal = categoryStats[0]?.total || 1;
                        const pct = (cat.total / maxTotal) * 100;
                        const isActive = txnCategoryFilter === cat.category;
                        return (
                          <div
                            key={cat.category}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                              isActive ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/50"
                            }`}
                            onClick={() => setTxnCategoryFilter(isActive ? "all" : cat.category)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium truncate">{cat.category}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-xs text-muted-foreground">{cat.count}x</span>
                                  <span className="text-sm font-bold">{formatCurrency(cat.total)}</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary/60 transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Search & Filter */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar transação..."
                    value={txnSearch}
                    onChange={e => setTxnSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Select value={txnCategoryFilter} onValueChange={setTxnCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas categorias</SelectItem>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={txnFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTxnFilter("all")}
                  >
                    Todas
                  </Button>
                  <Button
                    variant={txnFilter === "pending" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTxnFilter("pending")}
                  >
                    <AlertCircle className="h-3 w-3 mr-1" /> Pendentes
                  </Button>
                  <Button
                    variant={txnFilter === "identified" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTxnFilter("identified")}
                  >
                    <Check className="h-3 w-3 mr-1" /> Identificadas
                  </Button>
                </div>
              </div>

              {/* Active category filter indicator */}
              {txnCategoryFilter !== "all" && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="default" className="gap-1">
                    <Filter className="h-3 w-3" /> {txnCategoryFilter}
                    <button onClick={() => setTxnCategoryFilter("all")} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                  <span className="text-muted-foreground">
                    {filteredTransactions.length} transações — Total: {formatCurrency(filteredTransactions.reduce((s, t) => s + parseFloat(String(t.amount)), 0))}
                  </span>
                </div>
              )}

              {/* Transactions List */}
              <div className="space-y-2">
                {filteredTransactions.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                      <p className="font-medium">Nenhuma transação encontrada</p>
                      <p className="text-sm">
                        {data.transactions.length === 0
                          ? "O PDF não conteve transações reconhecíveis. Você pode tentar outro formato de extrato."
                          : "Ajuste os filtros de busca."}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredTransactions.map(txn => (
                    <Card
                      key={txn.id}
                      className={`transition-all ${
                        txn.isIdentified
                          ? "border-l-4 border-l-emerald-500"
                          : "border-l-4 border-l-amber-400"
                      } ${editingTxnId === txn.id ? "ring-2 ring-primary" : ""}`}
                    >
                      <CardContent className="p-3">
                        {editingTxnId === txn.id ? (
                          /* ── Editing Mode ── */
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-muted-foreground">{txn.transactionDate}</span>
                                  {(txn as any).accountingDate && (txn as any).accountingDate !== txn.transactionDate && (
                                    <span className="text-xs text-muted-foreground">(contábil: {(txn as any).accountingDate})</span>
                                  )}
                                  {(txn as any).bankType && (
                                    <Badge variant="outline" className="text-[10px] h-4">{(txn as any).bankType}</Badge>
                                  )}
                                </div>
                                <p className="text-sm font-medium">{txn.originalDescription}</p>
                              </div>
                              <span className={`text-lg font-bold ${txn.transactionType === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                                {txn.transactionType === "credit" ? "+" : "-"}{formatCurrency(txn.amount)}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Categoria</Label>
                                <Select value={editCategory} onValueChange={setEditCategory}>
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Selecione..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {CATEGORIES.map(cat => (
                                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Identificação (do que se trata)</Label>
                                <Input
                                  value={editDescription}
                                  onChange={e => setEditDescription(e.target.value)}
                                  placeholder="Ex: Pagamento fornecedor X"
                                  className="h-9"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">Observações</Label>
                              <Input
                                value={editNotes}
                                onChange={e => setEditNotes(e.target.value)}
                                placeholder="Observações adicionais..."
                                className="h-9"
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => setEditingTxnId(null)}>
                                <X className="h-4 w-4 mr-1" /> Cancelar
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSaveTxn(txn.id)}
                                disabled={updateTxnMutation.isPending}
                              >
                                {updateTxnMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4 mr-1" />
                                )}
                                Salvar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* ── View Mode ── */
                          <div
                            className="flex items-start gap-3 cursor-pointer"
                            onClick={() => startEditTxn(txn)}
                          >
                            <div className={`mt-1 p-1.5 rounded-full ${txn.transactionType === "credit" ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-red-100 dark:bg-red-900/40"}`}>
                              {txn.transactionType === "credit" ? (
                                <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <ArrowDownCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="text-xs text-muted-foreground">{txn.transactionDate}</span>
                                {(txn as any).bankType && (
                                  <Badge variant="outline" className="text-[10px] h-4 bg-slate-50 text-slate-600 border-slate-300 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-700">
                                    {(txn as any).bankType}
                                  </Badge>
                                )}
                                {txn.isIdentified ? (
                                  <Badge variant="outline" className="text-[10px] h-4 bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700">
                                    <Check className="h-2.5 w-2.5 mr-0.5" /> Identificado
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] h-4 bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700">
                                    <Clock className="h-2.5 w-2.5 mr-0.5" /> Pendente
                                  </Badge>
                                )}
                                {txn.category && (
                                  <Badge variant="secondary" className="text-[10px] h-4">{txn.category}</Badge>
                                )}
                              </div>
                              <p className="text-sm font-medium truncate">{txn.originalDescription}</p>
                              {txn.userDescription && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  <span className="font-medium text-foreground/70">→</span> {txn.userDescription}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-bold ${txn.transactionType === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                                {txn.transactionType === "credit" ? "+" : "-"}{formatCurrency(txn.amount)}
                              </p>
                              <Pencil className="h-3 w-3 text-muted-foreground ml-auto mt-1" />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </>
          ) : null}
        </div>
      </DashboardLayout>
    );
  }

  /* ── LIST VIEW ── */
  return (
    <DashboardLayout activeSection="extratos">
      <div className="p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Extratos Bancários</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Organize seus extratos e identifique cada transação para a contabilidade.
            </p>
          </div>
          <Button onClick={() => setShowUpload(true)} className="shrink-0">
            <Upload className="h-4 w-4 mr-2" /> Enviar Extrato PDF
          </Button>
        </div>

        {/* Upload Form */}
        {showUpload && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Enviar novo extrato
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setShowUpload(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                <div>
                  <Label className="text-xs">Banco</Label>
                  <Input
                    value={uploadBankName}
                    onChange={e => setUploadBankName(e.target.value)}
                    placeholder="Ex: Nubank, Itaú..."
                  />
                </div>
                <div>
                  <Label className="text-xs">CNPJ</Label>
                  <Select value={uploadCnpjId} onValueChange={setUploadCnpjId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar CNPJ" />
                    </SelectTrigger>
                    <SelectContent>
                      {(cnpjsQuery.data ?? []).map((cnpj: any) => (
                        <SelectItem key={cnpj.id} value={String(cnpj.id)}>{cnpj.nomeFantasia || cnpj.razaoSocial} - {cnpj.cnpj}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(cnpjsQuery.data ?? []).length === 0 && (
                    <p className="mt-1 text-[10px] text-muted-foreground">Cadastre um CNPJ na página de Clientes antes de enviar extratos.</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Mês</Label>
                  <Select value={uploadMonth} onValueChange={setUploadMonth}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Ano</Label>
                  <Input
                    type="number"
                    value={uploadYear}
                    onChange={e => setUploadYear(e.target.value)}
                    min={2020}
                    max={2030}
                  />
                </div>
                <div>
                  <Label className="text-xs">Senha do PDF</Label>
                  <Input
                    type="password"
                    value={uploadPassword}
                    onChange={e => setUploadPassword(e.target.value)}
                    placeholder="Se protegido..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Arquivo PDF</Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="cursor-pointer"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {uploading ? "Processando..." : "Enviar e Processar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por banco..."
              value={filterBank}
              onChange={e => setFilterBank(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-full sm:w-32">
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger>
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_years">Todos</SelectItem>
                {[2024, 2025, 2026].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Statements List */}
        {statementsQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredStatements.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold mb-2">Nenhum extrato cadastrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Envie o PDF do extrato bancário para começar a organizar suas transações.
              </p>
              <Button onClick={() => setShowUpload(true)}>
                <Upload className="h-4 w-4 mr-2" /> Enviar primeiro extrato
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredStatements.map(stmt => {
              const progress = stmt.totalTransactions > 0
                ? Math.round((stmt.totalIdentified / stmt.totalTransactions) * 100)
                : 0;

              return (
                <Card
                  key={stmt.id}
                  className="cursor-pointer hover:border-primary/40 transition-all"
                  onClick={() => setLocation(`/extratos/${stmt.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${
                        stmt.status === "completed"
                          ? "bg-emerald-100 dark:bg-emerald-900/40"
                          : stmt.status === "partial"
                          ? "bg-amber-100 dark:bg-amber-900/40"
                          : "bg-slate-100 dark:bg-slate-800"
                      }`}>
                        <Building2 className={`h-5 w-5 ${
                          stmt.status === "completed"
                            ? "text-emerald-600"
                            : stmt.status === "partial"
                            ? "text-amber-600"
                            : "text-slate-500"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{stmt.bankName}</h3>
                          <Badge variant={
                            stmt.status === "completed" ? "default" :
                            stmt.status === "partial" ? "secondary" : "outline"
                          } className="text-[10px]">
                            {stmt.status === "completed" ? "Completo" :
                             stmt.status === "partial" ? "Parcial" : "Pendente"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {MONTHS[stmt.periodMonth - 1]} / {stmt.periodYear}
                        </p>
                        {/* Progress bar */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                progress === 100 ? "bg-emerald-500" : progress > 0 ? "bg-amber-500" : "bg-slate-300"
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {stmt.totalIdentified}/{stmt.totalTransactions}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
