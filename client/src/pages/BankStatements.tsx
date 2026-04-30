import DashboardLayout from "@/components/DashboardLayout";
import LiaChat from "@/components/LiaChat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Download,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const BANK_OPTIONS = ["C6 Bank", "Mercado Pago", "Bradesco", "Santander", "Itaú", "Banco do Brasil", "Caixa", "Nubank", "Inter"];

const DEFAULT_CATEGORIES = [
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

const CATEGORY_STORAGE_KEY = "ck-extratos-categorias";
const KAIBREN_GOLD = "#D4AF37";
const PAGE_SIZES = [25, 50, 100, 200];

function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ─────────────────── HEADER (LIST VIEW) ─────────────────── */

function ListHeader({ onUpload, onRefresh, isRefreshing }: { onUpload: () => void; onRefresh: () => void; isRefreshing: boolean }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Financeiro · Extratos</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Extratos bancários</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Importe extratos em PDF, identifique cada transação por categoria e exporte para o contador. Brenda usa essa tela para conciliar contas e fechar o mês.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="border-border/60 bg-card text-foreground hover:bg-card/80"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RotateCcw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <Button
          onClick={onUpload}
          className="border-0 font-semibold text-black shadow-[0_8px_24px_-12px_rgba(212,175,55,0.6)] hover:opacity-90"
          style={{ backgroundColor: KAIBREN_GOLD }}
        >
          <Upload className="mr-2 h-4 w-4" />
          Enviar extrato PDF
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────── STAT TILE (compartilhado) ─────────────────── */

function StatTile({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper?: string;
  icon: any;
  tone?: "neutral" | "danger" | "warning" | "success" | "gold" | "info";
}) {
  const toneClasses = {
    neutral: "text-foreground",
    danger: "text-red-400",
    warning: "text-amber-300",
    success: "text-emerald-300",
    gold: "text-[#D4AF37]",
    info: "text-sky-300",
  }[tone];
  const ringClasses = {
    neutral: "bg-muted/60 text-muted-foreground",
    danger: "bg-red-500/15 text-red-300",
    warning: "bg-amber-500/15 text-amber-300",
    success: "bg-emerald-500/15 text-emerald-300",
    gold: "bg-[#D4AF37]/15 text-[#D4AF37]",
    info: "bg-sky-500/15 text-sky-300",
  }[tone];
  return (
    <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <p className={`text-2xl font-semibold tracking-tight ${toneClasses}`}>{value}</p>
          {helper ? <p className="text-xs leading-5 text-muted-foreground">{helper}</p> : null}
        </div>
        <div className={`rounded-xl p-2.5 ${ringClasses}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────── EMPTY STATE ─────────────────── */

function EmptyState({ title, description, cta, onCta, icon: Icon = FileText }: { title: string; description: string; cta?: string; onCta?: () => void; icon?: any }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${KAIBREN_GOLD}26` }}>
        <Icon className="h-5 w-5" style={{ color: KAIBREN_GOLD }} />
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      {cta && onCta ? (
        <Button onClick={onCta} className="mt-4 border-0 font-semibold text-black hover:opacity-90" style={{ backgroundColor: KAIBREN_GOLD }}>
          <Upload className="mr-2 h-4 w-4" />
          {cta}
        </Button>
      ) : null}
    </div>
  );
}

/* ─────────────────── PAGINATION ─────────────────── */

function PaginationBar({ page, totalPages, pageSize, total, onPage, onPageSize }: { page: number; totalPages: number; pageSize: number; total: number; onPage: (p: number) => void; onPageSize: (s: number) => void }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-col gap-3 border-t border-border/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Mostrando <span className="font-semibold text-foreground">{from}–{to}</span> de <span className="font-semibold text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Por página</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
            <SelectTrigger className="h-8 w-[78px] border-border/50 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (<SelectItem key={s} value={String(s)}>{s}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8 border-border/50 bg-card" disabled={page <= 1} onClick={() => onPage(1)}><ChevronsLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8 border-border/50 bg-card" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="px-2 text-xs text-muted-foreground">{page} / {totalPages || 1}</span>
          <Button variant="outline" size="icon" className="h-8 w-8 border-border/50 bg-card" disabled={page >= totalPages} onClick={() => onPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8 border-border/50 bg-card" disabled={page >= totalPages} onClick={() => onPage(totalPages)}><ChevronsRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── UPLOAD DIALOG ─────────────────── */

function UploadDialog({
  open,
  onOpenChange,
  cnpjs,
  onUpload,
  uploading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cnpjs: any[];
  onUpload: (data: { file: File; bankName: string; cnpjId: string; month: string; year: string; password: string }) => Promise<void>;
  uploading: boolean;
}) {
  const [bankName, setBankName] = useState("");
  const [cnpjId, setCnpjId] = useState("");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [password, setPassword] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setBankName("");
      setCnpjId("");
      setPassword("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  async function handleSubmit() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return toast.error("Selecione um arquivo PDF.");
    if (!bankName) return toast.error("Selecione o banco.");
    if (!cnpjId) return toast.error("Selecione o CNPJ.");
    await onUpload({ file, bankName, cnpjId, month, year, password });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border/50 bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Enviar extrato PDF</DialogTitle>
          <DialogDescription>
            Suba o PDF do extrato bancário. As transações são extraídas automaticamente — depois você categoriza cada uma para a contabilidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Banco</Label>
              <Select value={bankName} onValueChange={setBankName}>
                <SelectTrigger className="border-border/50 bg-card">
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent>
                  {BANK_OPTIONS.map((b) => (<SelectItem key={b} value={b}>{b}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">CNPJ</Label>
              <Select value={cnpjId} onValueChange={setCnpjId}>
                <SelectTrigger className="border-border/50 bg-card">
                  <SelectValue placeholder="Selecione o CNPJ" />
                </SelectTrigger>
                <SelectContent>
                  {(cnpjs ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nomeFantasia || c.razaoSocial} · {c.cnpj}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(cnpjs ?? []).length === 0 ? (
                <p className="text-[11px] text-amber-300">Cadastre um CNPJ antes de enviar extratos.</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mês</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="border-border/50 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (<SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ano</Label>
              <Input className="border-border/50 bg-card" type="number" min={2020} max={2030} value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Senha (opcional)</Label>
              <Input className="border-border/50 bg-card" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Se PDF protegido" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Arquivo PDF</Label>
            <Input ref={fileInputRef} type="file" accept=".pdf" className="cursor-pointer border-border/50 bg-card file:mr-3 file:rounded-md file:border-0 file:bg-[#D4AF37]/15 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[#D4AF37]" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={uploading}
            className="border-0 font-semibold text-black hover:opacity-90"
            style={{ backgroundColor: KAIBREN_GOLD }}
          >
            {uploading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando…</>) : (<><Upload className="mr-2 h-4 w-4" /> Enviar e processar</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────── EDIT TRANSACTION DIALOG ─────────────────── */

function EditTransactionDialog({
  txn,
  open,
  onOpenChange,
  categories,
  onSave,
  isSaving,
  onAddCategory,
  onRenameCategory,
}: {
  txn: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  onSave: (data: { id: number; category: string; description: string; notes: string }) => Promise<void>;
  isSaving: boolean;
  onAddCategory: (name: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
}) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    if (open && txn) {
      setCategory(txn.category || "");
      setDescription(txn.userDescription || "");
      setNotes(txn.notes || "");
      setShowCategoryManager(false);
      setNewCatName("");
      setRenamingCat(null);
    }
  }, [open, txn]);

  if (!txn) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border/50 bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Identificar transação</DialogTitle>
          <DialogDescription>Categorize a transação para a contabilidade. Quanto mais identificada, mais limpo o relatório do contador.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="rounded-xl border-border/50 bg-muted/10">
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{txn.transactionDate}</span>
                  {(txn as any).bankType ? (
                    <Badge variant="outline" className="border-border/60 bg-card/50 text-[10px] text-muted-foreground">{(txn as any).bankType}</Badge>
                  ) : null}
                </div>
                <p className="text-sm font-medium text-foreground">{txn.originalDescription}</p>
              </div>
              <p className={`whitespace-nowrap text-base font-semibold ${txn.transactionType === "credit" ? "text-emerald-300" : "text-red-300"}`}>
                {txn.transactionType === "credit" ? "+" : "-"}{formatCurrency(txn.amount)}
              </p>
            </CardContent>
          </Card>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Categoria</Label>
              <button
                type="button"
                className="text-xs text-[#D4AF37] hover:underline"
                onClick={() => setShowCategoryManager((v) => !v)}
              >
                {showCategoryManager ? "Fechar" : "Gerenciar categorias"}
              </button>
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="border-border/50 bg-card">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {showCategoryManager ? (
            <Card className="rounded-xl border-border/50 bg-muted/10">
              <CardContent className="space-y-3 p-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Adicionar nova</Label>
                  <div className="flex gap-2">
                    <Input
                      className="border-border/50 bg-card"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Ex.: Combustível"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0 border-border/50"
                      onClick={() => {
                        const name = newCatName.trim();
                        if (!name) return;
                        onAddCategory(name);
                        setCategory(name);
                        setNewCatName("");
                      }}
                      disabled={!newCatName.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Renomear categoria</Label>
                  <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-border/40 bg-card/40 p-2">
                    {categories.map((c) => (
                      <div key={c} className="flex items-center gap-2">
                        {renamingCat === c ? (
                          <>
                            <Input
                              className="h-8 border-border/50 bg-card text-xs"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                            />
                            <Button
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={() => {
                                if (renameValue.trim() && renameValue !== c) {
                                  onRenameCategory(c, renameValue.trim());
                                  if (category === c) setCategory(renameValue.trim());
                                }
                                setRenamingCat(null);
                              }}
                            >Salvar</Button>
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setRenamingCat(null)}>Cancelar</Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-xs text-foreground">{c}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]"
                              onClick={() => { setRenamingCat(c); setRenameValue(c); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Identificação (do que se trata)</Label>
            <Input
              className="border-border/50 bg-card"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Pagamento Mondial pedido 1234"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Observação</Label>
            <Textarea
              className="border-border/50 bg-card"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionais (opcional)"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button
            onClick={() => onSave({ id: txn.id, category, description, notes })}
            disabled={isSaving}
            className="border-0 font-semibold text-black hover:opacity-90"
            style={{ backgroundColor: KAIBREN_GOLD }}
          >
            {isSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…</>) : (<><Save className="mr-2 h-4 w-4" /> Salvar identificação</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────── CATEGORY CHIPS (DETAIL) ───────────────── */

function CategoryQuickFilter({
  categoryStats,
  selected,
  onSelect,
}: {
  categoryStats: { category: string; count: number; total: number }[];
  selected: string;
  onSelect: (category: string) => void;
}) {
  if (categoryStats.length === 0) return null;
  const top = categoryStats.filter((c) => c.category !== "Sem categoria").slice(0, 10);
  if (top.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Categoria:</span>
      <button
        onClick={() => onSelect("all")}
        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
          selected === "all"
            ? "border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#D4AF37]"
            : "border-border/50 bg-card text-muted-foreground hover:bg-card/80 hover:text-foreground"
        }`}
      >
        Todas
      </button>
      {top.map((cat) => {
        const isActive = selected === cat.category;
        return (
          <button
            key={cat.category}
            onClick={() => onSelect(isActive ? "all" : cat.category)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              isActive
                ? "border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#D4AF37]"
                : "border-border/50 bg-card text-muted-foreground hover:bg-card/80 hover:text-foreground"
            }`}
          >
            {cat.category} <span className="ml-1 text-[10px] opacity-70">{formatCurrency(cat.total)}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────── PAGE ───────────────── */

export default function BankStatements() {
  const [, setLocation] = useLocation();
  const [matchDetail, paramsDetail] = useRoute("/extratos/:id");
  const detailId = matchDetail ? parseInt(paramsDetail?.id || "0") : null;

  /* state */
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterBank, setFilterBank] = useState("");
  const [filterYear, setFilterYear] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "partial" | "pending">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /* detail-view state */
  const [editTxn, setEditTxn] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [txnSearch, setTxnSearch] = useState("");
  const [txnFilter, setTxnFilter] = useState<"all" | "identified" | "pending">("all");
  const [txnCategoryFilter, setTxnCategoryFilter] = useState<string>("all");
  const [txnPage, setTxnPage] = useState(1);
  const [txnPageSize, setTxnPageSize] = useState(50);

  /* custom categories (localStorage) */
  const [customCategories, setCustomCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const normalized = parsed.map((i) => String(i || "").trim()).filter(Boolean);
        if (normalized.length > 0) {
          setCustomCategories(Array.from(new Set([...DEFAULT_CATEGORIES, ...normalized])));
        }
      }
    } catch {
      window.localStorage.removeItem(CATEGORY_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(customCategories));
  }, [customCategories]);

  /* queries */
  const cnpjsQuery = trpc.myCnpjs.list.useQuery();
  const statementsQuery = trpc.bankStatements.list.useQuery();
  const detailQuery = trpc.bankStatements.get.useQuery({ id: detailId! }, { enabled: !!detailId });
  const utils = trpc.useUtils();
  const isMercadoPagoDetail = String(detailQuery.data?.statement?.bankName || "").toLowerCase().includes("mercado pago");

  /* mutations */
  const deleteMutation = trpc.bankStatements.delete.useMutation({
    onSuccess: () => {
      toast.success("Extrato excluído.");
      utils.bankStatements.list.invalidate();
      setLocation("/extratos");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateTxnMutation = trpc.bankStatements.updateTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transação identificada.");
      utils.bankStatements.get.invalidate({ id: detailId! });
      utils.bankStatements.list.invalidate();
      setEditOpen(false);
      setEditTxn(null);
    },
    onError: (err) => toast.error(err.message),
  });

  /* upload */
  const handleUpload = useCallback(async ({ file, bankName, cnpjId, month, year, password }: { file: File; bankName: string; cnpjId: string; month: string; year: string; password: string }) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bankName", bankName);
      formData.append("periodMonth", month);
      formData.append("periodYear", year);
      formData.append("cnpjId", cnpjId);
      if (password.trim()) formData.append("pdfPassword", password.trim());
      const response = await fetch("/api/bank-statement/upload", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao enviar extrato.");
      toast.success(`Extrato processado. ${result.totalTransactions} transações extraídas.`);
      await Promise.all([
        utils.bankStatements.list.invalidate(),
        utils.finance.dre.invalidate(),
        utils.finance.payables.list.invalidate(),
        utils.finance.payables.dashboard.invalidate(),
        utils.finance.fixedCosts.payments.invalidate(),
        utils.finance.creditCards.invoices.invalidate(),
        utils.finance.loans.installments.invalidate(),
        utils.finance.loans.retentionEntries.invalidate(),
      ]);
      setUploadOpen(false);
      if (result.statementId) setLocation(`/extratos/${result.statementId}`);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao enviar extrato.");
    } finally {
      setUploading(false);
    }
  }, [utils, setLocation]);

  async function refreshAll() {
    setIsRefreshing(true);
    try {
      if (detailId) await detailQuery.refetch();
      else await statementsQuery.refetch();
    } finally {
      setIsRefreshing(false);
    }
  }

  /* category management */
  const mergeCategoryList = useCallback((incoming: string[]) => {
    const normalized = incoming.map((i) => String(i || "").trim()).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...normalized]));
  }, []);

  const addCustomCategory = useCallback((name: string) => {
    const exists = customCategories.some((c) => c.toLowerCase() === name.toLowerCase());
    if (exists) return toast.error("Categoria já existe.");
    setCustomCategories((cur) => mergeCategoryList([...cur, name]));
    toast.success("Categoria adicionada.");
  }, [customCategories, mergeCategoryList]);

  const renameCustomCategory = useCallback((oldName: string, newName: string) => {
    const dup = customCategories.some((c) => c.trim().toLowerCase() === newName.toLowerCase() && c.trim().toLowerCase() !== oldName.toLowerCase());
    if (dup) return toast.error("Já existe outra categoria com esse nome.");
    setCustomCategories((cur) => mergeCategoryList(cur.map((c) => c.trim().toLowerCase() === oldName.trim().toLowerCase() ? newName : c)));
    toast.success("Categoria renomeada.");
  }, [customCategories, mergeCategoryList]);

  /* save transaction */
  async function handleSaveTxn({ id, category, description, notes }: { id: number; category: string; description: string; notes: string }) {
    if (!detailId) return;
    await updateTxnMutation.mutateAsync({
      id,
      statementId: detailId,
      category: category || null,
      userDescription: description || null,
      isIdentified: (category || description) ? 1 : 0,
      notes: notes || null,
    });
  }

  /* ───────────── LIST: filtros / KPIs / paginação ───────────── */
  const allStatements = statementsQuery.data ?? [];

  const filteredStatements = useMemo(() => {
    let list = allStatements;
    if (filterBank.trim()) list = list.filter((s) => s.bankName.toLowerCase().includes(filterBank.toLowerCase()));
    if (filterYear !== "all") list = list.filter((s) => s.periodYear === Number(filterYear));
    if (filterStatus !== "all") list = list.filter((s) => s.status === filterStatus);
    return list;
  }, [allStatements, filterBank, filterYear, filterStatus]);

  const stmtTotalPages = Math.max(Math.ceil(filteredStatements.length / pageSize), 1);
  const stmtSafePage = Math.min(page, stmtTotalPages);
  const stmtPaged = filteredStatements.slice((stmtSafePage - 1) * pageSize, stmtSafePage * pageSize);

  useEffect(() => { setPage(1); }, [filterBank, filterYear, filterStatus, pageSize]);

  const stmtCount = allStatements.length;
  const completedCount = allStatements.filter((s) => s.status === "completed").length;
  const pendingCount = allStatements.filter((s) => s.status !== "completed").length;
  const totalIdentified = allStatements.reduce((sum, s) => sum + (s.totalIdentified ?? 0), 0);
  const totalAll = allStatements.reduce((sum, s) => sum + (s.totalTransactions ?? 0), 0);
  const idPct = totalAll > 0 ? Math.round((totalIdentified / totalAll) * 100) : 0;

  const activeListFilters = (filterBank.trim() ? 1 : 0) + (filterYear !== "all" ? 1 : 0) + (filterStatus !== "all" ? 1 : 0);

  /* ───────────── DETAIL: stats ───────────── */
  const detailTxns = detailQuery.data?.transactions ?? [];

  const filteredTxns = useMemo(() => {
    let list = detailTxns;
    if (isMercadoPagoDetail) list = list.filter((t) => t.isIdentified === 1);
    if (txnSearch) {
      const q = txnSearch.toLowerCase();
      list = list.filter((t) =>
        t.originalDescription.toLowerCase().includes(q) ||
        (t.userDescription && t.userDescription.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q))
      );
    }
    if (!isMercadoPagoDetail) {
      if (txnFilter === "identified") list = list.filter((t) => t.isIdentified === 1);
      else if (txnFilter === "pending") list = list.filter((t) => t.isIdentified === 0);
    }
    if (txnCategoryFilter !== "all") list = list.filter((t) => t.category === txnCategoryFilter);
    return list;
  }, [detailTxns, isMercadoPagoDetail, txnSearch, txnFilter, txnCategoryFilter]);

  const txnTotalPages = Math.max(Math.ceil(filteredTxns.length / txnPageSize), 1);
  const txnSafePage = Math.min(txnPage, txnTotalPages);
  const txnPaged = filteredTxns.slice((txnSafePage - 1) * txnPageSize, txnSafePage * txnPageSize);

  useEffect(() => { setTxnPage(1); }, [txnSearch, txnFilter, txnCategoryFilter, txnPageSize, detailId]);

  const categoryStats = useMemo(() => {
    if (detailTxns.length === 0) return [] as { category: string; count: number; total: number; type: string }[];
    const map = new Map<string, { count: number; total: number; type: string }>();
    for (const t of detailTxns) {
      const cat = t.category || "Sem categoria";
      const existing = map.get(cat) || { count: 0, total: 0, type: t.transactionType };
      existing.count++;
      existing.total += parseFloat(String(t.amount));
      if (existing.type !== t.transactionType && existing.count > 1) existing.type = "mixed";
      map.set(cat, existing);
    }
    return Array.from(map.entries()).map(([category, s]) => ({ category, ...s })).sort((a, b) => b.total - a.total);
  }, [detailTxns]);

  const lisStats = useMemo(() => {
    if (detailTxns.length === 0) return { total: 0, count: 0, items: [] as any[] };
    const items = detailTxns.filter((t) => {
      const desc = t.originalDescription.toLowerCase();
      const cat = (t.category || "").toLowerCase();
      return cat.includes("lis") || cat.includes("cheque especial") ||
        desc.includes("cheque esp") || desc.includes("cheque especial") ||
        desc.includes("iof cheque") || desc.includes("juros cheque") ||
        desc.includes("lis ") || desc.includes("limite de credito");
    });
    return { total: items.reduce((s, t) => s + parseFloat(String(t.amount)), 0), count: items.length, items };
  }, [detailTxns]);

  const txnStats = useMemo(() => {
    if (detailTxns.length === 0) return { totalEntradas: 0, totalSaidas: 0, saldo: 0 };
    const totalEntradas = detailTxns.filter((t) => t.transactionType === "credit").reduce((s, t) => s + parseFloat(String(t.amount)), 0);
    const totalSaidas = detailTxns.filter((t) => t.transactionType === "debit").reduce((s, t) => s + parseFloat(String(t.amount)), 0);
    return { totalEntradas, totalSaidas, saldo: totalEntradas - totalSaidas };
  }, [detailTxns]);

  /* export Excel */
  const handleExportExcel = useCallback(async () => {
    if (!detailQuery.data) return;
    const { statement, transactions } = detailQuery.data;
    const XLSX = await import("xlsx");
    const fmtVal = (t: typeof transactions[0]) => {
      const v = parseFloat(String(t.amount));
      const formatted = v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return t.transactionType === "debit" ? `-R$ ${formatted}` : `R$ ${formatted}`;
    };
    const rows = transactions.map((t) => ({
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
    ws["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 50 }, { wch: 18 }, { wch: 20 }, { wch: 40 }, { wch: 30 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transações");
    const summary = [
      { "Informação": "Banco", "Valor": statement.bankName },
      { "Informação": "Período", "Valor": `${MONTHS[statement.periodMonth - 1]}/${statement.periodYear}` },
      { "Informação": "Total de Transações", "Valor": String(transactions.length) },
      { "Informação": "Transações Identificadas", "Valor": `${transactions.filter((t) => t.isIdentified === 1).length} de ${transactions.length}` },
      { "Informação": "Pendentes", "Valor": String(transactions.filter((t) => t.isIdentified === 0).length) },
      { "Informação": "Total Entradas", "Valor": `R$ ${txnStats.totalEntradas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
      { "Informação": "Total Saídas", "Valor": `R$ ${txnStats.totalSaidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
      { "Informação": "Saldo", "Valor": `R$ ${txnStats.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summary);
    wsSummary["!cols"] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");
    const fileName = `Extrato_${statement.bankName}_${MONTHS[statement.periodMonth - 1]}_${statement.periodYear}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("Planilha exportada.");
  }, [detailQuery.data, txnStats]);

  /* ──────────── DETAIL VIEW ──────────── */
  if (detailId) {
    const { data, isLoading } = detailQuery;

    return (
      <DashboardLayout activeSection="extratos">
        <div className="space-y-5">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl border border-border/40 bg-card hover:bg-card/80" onClick={() => setLocation("/extratos")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Financeiro · Extratos</p>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {isLoading ? "Carregando…" : data?.statement.bankName}
                </h1>
                {data ? (
                  <p className="text-sm text-muted-foreground">
                    {MONTHS[data.statement.periodMonth - 1]} / {data.statement.periodYear} · {data.statement.fileName}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-border/60 bg-card hover:bg-card/80"
                onClick={refreshAll}
                disabled={isRefreshing}
              >
                <RotateCcw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button variant="outline" className="border-border/60 bg-card hover:bg-card/80" onClick={handleExportExcel} disabled={!data}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
              <Button
                variant="outline"
                className="border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200"
                onClick={() => {
                  if (confirm("Excluir este extrato e todas as transações?")) deleteMutation.mutate({ id: detailId });
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir extrato
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
            </div>
          ) : data ? (
            <>
              {/* Stats */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="Entradas" value={formatCurrency(txnStats.totalEntradas)} helper={`${detailTxns.filter((t) => t.transactionType === "credit").length} crédito(s)`} icon={ArrowUpCircle} tone="success" />
                <StatTile label="Saídas" value={formatCurrency(txnStats.totalSaidas)} helper={`${detailTxns.filter((t) => t.transactionType === "debit").length} débito(s)`} icon={ArrowDownCircle} tone="danger" />
                <StatTile
                  label={isMercadoPagoDetail ? "Autoidentificadas" : "Identificadas"}
                  value={`${isMercadoPagoDetail ? data.statement.totalTransactions : data.statement.totalIdentified} / ${data.statement.totalTransactions}`}
                  helper={isMercadoPagoDetail ? "Mercado Pago: tudo categorizado" : `${Math.round(((data.statement.totalIdentified || 0) / Math.max(data.statement.totalTransactions, 1)) * 100)}% concluído`}
                  icon={CheckCircle2}
                  tone="info"
                />
                <StatTile
                  label={isMercadoPagoDetail ? "Saldo" : "Pendentes"}
                  value={isMercadoPagoDetail ? formatCurrency(txnStats.saldo) : `${data.statement.totalTransactions - data.statement.totalIdentified}`}
                  helper={isMercadoPagoDetail ? "Entradas − saídas" : "Aguardando categorização"}
                  icon={isMercadoPagoDetail ? Wallet : Clock}
                  tone={isMercadoPagoDetail ? "gold" : "warning"}
                />
              </div>

              {/* LIS Card */}
              {lisStats.count > 0 ? (
                <Card className="rounded-2xl border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-purple-500/20 p-2.5 text-purple-300">
                          <AlertCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">LIS / Cheque Especial detectado</p>
                          <p className="text-xs text-muted-foreground">{lisStats.count} transação(ões) com juros + IOF</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold tracking-tight text-purple-300">{formatCurrency(lisStats.total)}</p>
                        <p className="text-xs text-muted-foreground">gasto neste extrato</p>
                      </div>
                    </div>
                    {lisStats.items.length > 0 ? (
                      <div className="mt-4 space-y-1 border-t border-purple-500/20 pt-3">
                        {lisStats.items.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between text-xs">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="text-purple-400/70">{item.transactionDate}</span>
                              <span className="truncate text-foreground">{item.originalDescription}</span>
                            </div>
                            <span className="ml-2 shrink-0 font-medium text-purple-300">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              {/* Mercado Pago info */}
              {isMercadoPagoDetail ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  Este extrato do Mercado Pago já abre com as movimentações autoidentificadas. Para esse banco, a tela prioriza a leitura operacional e oculta pendências visuais.
                </div>
              ) : null}

              {/* Filters */}
              <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={txnSearch}
                        onChange={(e) => setTxnSearch(e.target.value)}
                        placeholder="Buscar por descrição, identificação, categoria…"
                        className="border-border/50 bg-card pl-9"
                      />
                    </div>
                    {!isMercadoPagoDetail ? (
                      <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-card p-1">
                        {(["all", "pending", "identified"] as const).map((opt) => {
                          const active = txnFilter === opt;
                          const label = opt === "all" ? "Todas" : opt === "pending" ? "Pendentes" : "Identificadas";
                          return (
                            <button
                              key={opt}
                              onClick={() => setTxnFilter(opt)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                active ? "bg-[#D4AF37]/15 text-[#D4AF37]" : "text-muted-foreground hover:bg-card/80 hover:text-foreground"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    {txnCategoryFilter !== "all" ? (
                      <Button variant="ghost" size="sm" onClick={() => setTxnCategoryFilter("all")} className="h-9 text-muted-foreground hover:text-foreground">
                        <X className="mr-1.5 h-3.5 w-3.5" />
                        Limpar categoria
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              {/* Category chips */}
              <CategoryQuickFilter categoryStats={categoryStats} selected={txnCategoryFilter} onSelect={setTxnCategoryFilter} />

              {/* Transactions Table */}
              {filteredTxns.length === 0 ? (
                <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
                  <CardContent className="p-6">
                    <EmptyState
                      title="Nenhuma transação encontrada"
                      description={
                        detailTxns.length === 0
                          ? "O PDF não conteve transações reconhecíveis. Tente outro formato de extrato."
                          : "Ajuste os filtros para ver mais resultados."
                      }
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-hidden rounded-2xl border-border/50 bg-card shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/40 bg-card/50 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          <th className="px-4 py-3 text-left">Status</th>
                          <th className="px-4 py-3 text-left">Data</th>
                          <th className="px-4 py-3 text-left">Descrição</th>
                          <th className="hidden px-4 py-3 text-left md:table-cell">Categoria</th>
                          <th className="px-4 py-3 text-right">Valor</th>
                          <th className="px-4 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txnPaged.map((t) => (
                          <tr key={t.id} className="border-b border-border/30 transition-colors hover:bg-card/60">
                            <td className="px-4 py-3.5">
                              {t.isIdentified ? (
                                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                                  <Check className="mr-1 h-3 w-3" /> Identificado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-amber-500/50 bg-amber-500/15 text-amber-300">
                                  <Clock className="mr-1 h-3 w-3" /> Pendente
                                </Badge>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted-foreground">
                              {t.transactionDate}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className={`shrink-0 rounded-lg p-1.5 ${t.transactionType === "credit" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                                  {t.transactionType === "credit" ? <ArrowUpCircle className="h-3.5 w-3.5" /> : <ArrowDownCircle className="h-3.5 w-3.5" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-foreground">{t.originalDescription}</p>
                                  {t.userDescription ? (
                                    <p className="truncate text-xs text-muted-foreground">→ {t.userDescription}</p>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="hidden px-4 py-3.5 md:table-cell">
                              {t.category ? (
                                <Badge variant="outline" className="border-border/60 bg-card/50 text-xs text-muted-foreground">{t.category}</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground/60">—</span>
                              )}
                            </td>
                            <td className={`whitespace-nowrap px-4 py-3.5 text-right font-semibold ${t.transactionType === "credit" ? "text-emerald-300" : "text-red-300"}`}>
                              {t.transactionType === "credit" ? "+" : "-"}{formatCurrency(t.amount)}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]"
                                  onClick={() => { setEditTxn(t); setEditOpen(true); }}
                                  title="Identificar / Editar"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <PaginationBar page={txnSafePage} totalPages={txnTotalPages} pageSize={txnPageSize} total={filteredTxns.length} onPage={setTxnPage} onPageSize={setTxnPageSize} />
                </Card>
              )}
            </>
          ) : null}
        </div>

        <LiaChat
          screenContext={`Extrato ${data?.statement.bankName ?? ""} ${data ? `${MONTHS[data.statement.periodMonth - 1]}/${data.statement.periodYear}` : ""}`}
          pageData={
            data
              ? `Banco: ${data.statement.bankName}. Período: ${MONTHS[data.statement.periodMonth - 1]}/${data.statement.periodYear}. Entradas: ${formatCurrency(txnStats.totalEntradas)}. Saídas: ${formatCurrency(txnStats.totalSaidas)}. Saldo: ${formatCurrency(txnStats.saldo)}. ${data.statement.totalIdentified}/${data.statement.totalTransactions} transações identificadas. ${lisStats.count > 0 ? `LIS detectado: ${lisStats.count} transações somando ${formatCurrency(lisStats.total)}.` : ""}`
              : ""
          }
          quickPrompts={["Categoriza as pendentes pra mim", "Qual transação maior do mês?", "Quanto paguei de juros LIS?"]}
        />

        <EditTransactionDialog
          txn={editTxn}
          open={editOpen}
          onOpenChange={(o) => { setEditOpen(o); if (!o) setEditTxn(null); }}
          categories={customCategories}
          onSave={handleSaveTxn}
          isSaving={updateTxnMutation.isPending}
          onAddCategory={addCustomCategory}
          onRenameCategory={renameCustomCategory}
        />
      </DashboardLayout>
    );
  }

  /* ──────────── LIST VIEW ──────────── */
  return (
    <DashboardLayout activeSection="extratos">
      <div className="space-y-5">
        <ListHeader onUpload={() => setUploadOpen(true)} onRefresh={refreshAll} isRefreshing={isRefreshing} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Extratos cadastrados" value={`${stmtCount}`} helper={`${completedCount} completo(s)`} icon={FileText} tone="gold" />
          <StatTile label="Pendentes" value={`${pendingCount}`} helper={pendingCount > 0 ? "Aguardando categorização" : "Tudo em dia"} icon={AlertTriangle} tone={pendingCount > 0 ? "warning" : "neutral"} />
          <StatTile label="Transações identificadas" value={`${totalIdentified} / ${totalAll}`} helper={`${idPct}% categorizado`} icon={CheckCircle2} tone="success" />
          <StatTile label="Bancos" value={`${new Set(allStatements.map((s) => s.bankName)).size}`} helper="Distintos cadastrados" icon={Building2} tone="info" />
        </div>

        {/* Filters */}
        <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por banco…"
                  value={filterBank}
                  onChange={(e) => setFilterBank(e.target.value)}
                  className="border-border/50 bg-card pl-9"
                />
              </div>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="h-9 w-[120px] border-border/50 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos anos</SelectItem>
                  {[2024, 2025, 2026].map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setShowFilters((v) => !v)} className="relative h-9 border-border/50 bg-card">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filtros
                {activeListFilters > 0 ? (
                  <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-black" style={{ backgroundColor: KAIBREN_GOLD }}>
                    {activeListFilters}
                  </span>
                ) : null}
              </Button>
              {activeListFilters > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => { setFilterBank(""); setFilterYear("all"); setFilterStatus("all"); }} className="h-9 text-muted-foreground hover:text-foreground">
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Limpar
                </Button>
              ) : null}
            </div>

            {showFilters ? (
              <div className="grid gap-3 border-t border-border/40 pt-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</Label>
                  <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                    <SelectTrigger className="h-9 border-border/50 bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="completed">Completo</SelectItem>
                      <SelectItem value="partial">Parcial</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* List Table */}
        {statementsQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
          </div>
        ) : filteredStatements.length === 0 && allStatements.length === 0 ? (
          <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
            <CardContent className="p-6">
              <EmptyState
                title="Nenhum extrato cadastrado"
                description="Envie o PDF do extrato bancário para começar a organizar transações e exportar para o contador."
                cta="Enviar primeiro extrato"
                onCta={() => setUploadOpen(true)}
              />
            </CardContent>
          </Card>
        ) : filteredStatements.length === 0 ? (
          <Card className="rounded-2xl border-border/50 bg-card shadow-sm">
            <CardContent className="p-6">
              <EmptyState title="Nenhum resultado" description="Ajuste os filtros para ver mais extratos." icon={Search} />
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden rounded-2xl border-border/50 bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-card/50 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Banco</th>
                    <th className="px-4 py-3 text-left">Período</th>
                    <th className="px-4 py-3 text-left">Identificação</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {stmtPaged.map((stmt) => {
                    const progress = stmt.totalTransactions > 0 ? Math.round((stmt.totalIdentified / stmt.totalTransactions) * 100) : 0;
                    const status = stmt.status;
                    return (
                      <tr
                        key={stmt.id}
                        className="cursor-pointer border-b border-border/30 transition-colors hover:bg-card/60"
                        onClick={() => setLocation(`/extratos/${stmt.id}`)}
                      >
                        <td className="px-4 py-3.5">
                          {status === "completed" ? (
                            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">Completo</Badge>
                          ) : status === "partial" ? (
                            <Badge variant="outline" className="border-amber-500/50 bg-amber-500/15 text-amber-300">Parcial</Badge>
                          ) : (
                            <Badge variant="outline" className="border-muted-foreground/30 bg-muted/40 text-muted-foreground">Pendente</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-[#D4AF37]/10 p-2 text-[#D4AF37]">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{stmt.bankName}</p>
                              {stmt.fileName ? <p className="line-clamp-1 text-xs text-muted-foreground">{stmt.fileName}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-foreground">
                          {MONTHS_SHORT[stmt.periodMonth - 1]} / {stmt.periodYear}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex w-[200px] items-center gap-3">
                            <Progress value={progress} className="h-1.5 flex-1 bg-muted/50" />
                            <span className="shrink-0 text-xs text-muted-foreground">
                              <span className={progress === 100 ? "text-emerald-300" : "text-foreground"}>{stmt.totalIdentified}</span>/{stmt.totalTransactions}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-sm text-muted-foreground">
                          {stmt.totalTransactions} txn
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex justify-end">
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PaginationBar page={stmtSafePage} totalPages={stmtTotalPages} pageSize={pageSize} total={filteredStatements.length} onPage={setPage} onPageSize={setPageSize} />
          </Card>
        )}
      </div>

      <LiaChat
        screenContext="Extratos Bancários"
        pageData={`${stmtCount} extrato(s) cadastrado(s). ${completedCount} completo(s), ${pendingCount} pendente(s). ${totalIdentified} de ${totalAll} transações identificadas (${idPct}%). Bancos: ${Array.from(new Set(allStatements.map((s) => s.bankName))).join(", ") || "nenhum"}.`}
        quickPrompts={["Tem extrato pendente de identificar?", "Como exportar pro contador?", "O que é LIS / cheque especial?"]}
      />

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        cnpjs={cnpjsQuery.data ?? []}
        onUpload={handleUpload}
        uploading={uploading}
      />
    </DashboardLayout>
  );
}
