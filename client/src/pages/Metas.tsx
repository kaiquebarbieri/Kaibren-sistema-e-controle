import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ChevronDown, ChevronRight, Pencil, Target, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(value: number, digits = 2) {
  return (value * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }) + "%";
}

function variacaoColor(value: number) {
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-rose-600 dark:text-rose-400";
  return "text-muted-foreground";
}

function ProgressBar({ atingido, meta, size = "md" }: { atingido: number; meta: number; size?: "sm" | "md" | "lg" }) {
  if (meta <= 0) return <span className="text-muted-foreground text-xs">—</span>;
  const pct = Math.min((atingido / meta) * 100, 100);
  const h = size === "sm" ? "h-1.5" : size === "lg" ? "h-2.5" : "h-2";
  const barColor = pct >= 100
    ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
    : pct >= 70
      ? "bg-gradient-to-r from-amber-500 to-amber-400"
      : "bg-gradient-to-r from-rose-500 to-rose-400";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className={`flex-1 ${h} rounded-full bg-black/10 dark:bg-black/10 dark:bg-white/5 overflow-hidden shadow-inner`}>
        <div className={`h-full ${barColor} shadow-[0_0_8px_rgba(0,0,0,0.2)]`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold w-12 text-right tabular-nums ${
        pct >= 100 ? "text-emerald-600 dark:text-emerald-400" : pct >= 70 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"
      }`}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

export default function Metas() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [cnpjId, setCnpjId] = useState(0);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [openMonth, setOpenMonth] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ month: number; fat: string; margem: string } | null>(null);
  const fatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (openMonth !== null && fatInputRef.current) {
      const t = setTimeout(() => {
        fatInputRef.current?.focus();
        fatInputRef.current?.select();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [openMonth]);

  function handleEditKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") { e.preventDefault(); closePopover(); }
  }

  function closePopover() {
    setOpenMonth(null);
    setEditing(null);
  }

  const yearsList = useMemo(() => [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1], [now]);

  const companiesQuery = trpc.metas.companies.useQuery();
  const yearQuery = trpc.metas.year.useQuery({ year, cnpjId });
  const dailyQuery = trpc.metas.monthDaily.useQuery(
    { year, month: expandedMonth ?? 1, cnpjId },
    { enabled: expandedMonth !== null },
  );

  const utils = trpc.useUtils();
  const upsertMutation = trpc.metas.upsert.useMutation({
    onSuccess: () => {
      utils.metas.year.invalidate();
      utils.metas.monthDaily.invalidate();
      toast.success("Meta salva");
      closePopover();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.metas.deleteYear.useMutation({
    onSuccess: () => {
      utils.metas.year.invalidate();
      toast.success("Metas do ano removidas");
    },
    onError: (err) => toast.error(err.message),
  });

  const data = yearQuery.data;
  const totals = useMemo(() => {
    if (!data) return null;
    const meta = data.months.reduce((s, m) => s + m.metaFaturamento, 0);
    const atingido = data.months.reduce((s, m) => s + m.atingidoFaturamento, 0);
    return { meta, atingido, variacao: atingido - meta };
  }, [data]);

  function openEdit(month: number) {
    const current = data?.months.find((m) => m.month === month);
    setEditing({
      month,
      fat: current && current.metaFaturamento > 0 ? String(current.metaFaturamento) : "",
      margem: current && current.metaMargemPct > 0 ? String((current.metaMargemPct * 100).toFixed(2)) : "",
    });
    setOpenMonth(month);
  }

  function handleSave() {
    if (!editing) return;
    const fat = Number(editing.fat.replace(",", "."));
    const margem = Number(editing.margem.replace(",", "."));
    if (isNaN(fat) || fat < 0) { toast.error("Faturamento inválido"); return; }
    if (isNaN(margem) || margem < 0 || margem > 100) { toast.error("Margem deve ser entre 0 e 100"); return; }
    upsertMutation.mutate({
      year,
      month: editing.month,
      cnpjId,
      faturamentoMeta: fat,
      margemMetaPct: margem / 100,
    });
  }

  function handleDeleteYear() {
    if (!confirm(`Remover todas as metas de ${year}?`)) return;
    deleteMutation.mutate({ year, cnpjId });
  }

  // Classes tailwind por grupo de colunas — suportam light + dark
  const metaGroupBg = "bg-sky-500/[0.12] dark:bg-sky-500/[0.08]";
  const metaGroupBorder = "border-l border-sky-500/30 dark:border-sky-500/20";
  const atingidoGroupBg = "bg-emerald-500/[0.12] dark:bg-emerald-500/[0.08]";
  const atingidoGroupBorder = "border-l border-emerald-500/30 dark:border-emerald-500/20";
  const variacaoGroupBg = "bg-amber-500/[0.10] dark:bg-amber-500/[0.05]";
  const variacaoGroupBorder = "border-l border-amber-500/30 dark:border-amber-500/20";

  return (
    <DashboardLayout activeSection="metas">
      <div className="space-y-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/20 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Metas</h1>
              <p className="text-sm text-muted-foreground">
                Defina metas mensais e acompanhe o atingido em tempo real a partir dos marketplaces.
              </p>
            </div>
          </div>
        </header>

        <Card className="border-border/50">
          <CardContent className="flex flex-wrap items-end gap-3 py-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Ano</label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearsList.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Empresa</label>
              <Select value={String(cnpjId)} onValueChange={(v) => setCnpjId(Number(v))}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Consolidada (todas)</SelectItem>
                  {companiesQuery.data?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteYear}
              disabled={deleteMutation.isPending}
              className="border-rose-500/20 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Limpar ano
            </Button>
          </CardContent>
        </Card>

        {totals && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-700 dark:text-sky-300/80">
                  Meta do ano
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground tabular-nums">
                  {formatCurrency(totals.meta)}
                </div>
                <p className="text-xs text-sky-600 dark:text-sky-400/60 mt-1">Soma das 12 metas mensais</p>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-700 dark:text-emerald-300/80">
                  Atingido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground tabular-nums">
                  {formatCurrency(totals.atingido)}
                </div>
                <div className="mt-2">
                  <ProgressBar atingido={totals.atingido} meta={totals.meta} size="lg" />
                </div>
              </CardContent>
            </Card>

            <Card className={`border-border/40 bg-gradient-to-br ${
              totals.variacao >= 0 ? "from-emerald-500/5" : "from-rose-500/5"
            } to-transparent`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Variação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold tabular-nums flex items-center gap-2 ${variacaoColor(totals.variacao)}`}>
                  {totals.variacao >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  {totals.variacao >= 0 ? "+" : ""}{formatCurrency(totals.variacao)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totals.meta > 0
                    ? `${((totals.atingido / totals.meta - 1) * 100).toFixed(1)}% vs meta`
                    : "Defina a meta para comparar"}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="border-border/50 overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Metas mensais — {year}</CardTitle>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-sky-500/70" /> Meta
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500/70" /> Atingido
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-amber-500/70" /> Variação
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                {/* Linha 1 — Grupos */}
                <tr className="border-b border-border/40">
                  <th className="w-10 bg-card/50"></th>
                  <th className="bg-card/50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mês</th>
                  <th colSpan={2} className={`${metaGroupBg} ${metaGroupBorder} px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300`}>
                    Meta
                  </th>
                  <th colSpan={2} className={`${atingidoGroupBg} ${atingidoGroupBorder} px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300`}>
                    Atingido
                  </th>
                  <th colSpan={2} className={`${variacaoGroupBg} ${variacaoGroupBorder} px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300`}>
                    Variação
                  </th>
                </tr>
                {/* Linha 2 — sub-headers */}
                <tr className="border-b border-border/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="bg-card/50"></th>
                  <th className="bg-card/50"></th>
                  <th className={`${metaGroupBg} ${metaGroupBorder} px-3 py-1.5 text-right font-medium`}>Faturamento</th>
                  <th className={`${metaGroupBg} px-3 py-1.5 text-right font-medium`}>Margem</th>
                  <th className={`${atingidoGroupBg} ${atingidoGroupBorder} px-3 py-1.5 text-right font-medium`}>Faturamento</th>
                  <th className={`${atingidoGroupBg} px-3 py-1.5 text-right font-medium`}>Margem</th>
                  <th className={`${variacaoGroupBg} ${variacaoGroupBorder} px-3 py-1.5 text-right font-medium`}>Faturamento</th>
                  <th className={`${variacaoGroupBg} px-3 py-1.5 text-right font-medium`}>Margem</th>
                </tr>
              </thead>
              <tbody>
                {yearQuery.isLoading ? (
                  <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">Carregando...</td></tr>
                ) : data?.months.map((m) => {
                  const isExpanded = expandedMonth === m.month;
                  const hasMeta = m.metaFaturamento > 0;
                  const currentMonth = now.getFullYear() === year && now.getMonth() + 1 === m.month;
                  return (
                    <Fragment key={m.month}>
                      <tr className={`border-b border-border/30 transition-colors hover:bg-accent/30 ${
                        currentMonth ? "bg-primary/[0.04]" : ""
                      }`}>
                        <td className="px-2 py-2.5">
                          <button
                            onClick={() => setExpandedMonth(isExpanded ? null : m.month)}
                            className="p-1 rounded-md hover:bg-accent/60 text-muted-foreground"
                            title={isExpanded ? "Recolher" : "Ver dia a dia"}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${currentMonth ? "text-primary" : "text-foreground"}`}>
                              {MONTHS[m.month - 1]}
                            </span>
                            {currentMonth && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                                Atual
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Meta Faturamento — clique também abre mini painel */}
                        <td
                          onClick={() => openEdit(m.month)}
                          className={`${metaGroupBg} ${metaGroupBorder} px-3 py-2.5 text-right font-mono tabular-nums cursor-pointer hover:bg-sky-500/20 dark:hover:bg-sky-500/15 transition-colors`}
                          title="Clique para definir meta"
                        >
                          {hasMeta
                            ? <span className="text-foreground">{formatCurrency(m.metaFaturamento)}</span>
                            : <span className="text-sky-700/70 dark:text-sky-300/60 font-sans">—</span>}
                        </td>

                        {/* Meta Margem — ícone Pencil abre mini painel popover */}
                        <td className={`${metaGroupBg} px-3 py-2.5 text-right font-mono tabular-nums`}>
                          <div className="flex items-center justify-end gap-2">
                            {m.metaMargemPct > 0
                              ? <span className="text-foreground">{formatPercent(m.metaMargemPct)}</span>
                              : <span className="text-sky-700/70 dark:text-sky-300/60 font-sans">—</span>}
                            <Popover
                              open={openMonth === m.month}
                              onOpenChange={(o) => { if (o) openEdit(m.month); else closePopover(); }}
                            >
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="p-1 rounded hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 transition-colors"
                                  title="Definir meta"
                                  aria-label={`Definir meta de ${MONTHS[m.month - 1]}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-72 p-4">
                                {editing?.month === m.month && (
                                  <div className="space-y-3">
                                    <div>
                                      <h4 className="text-sm font-semibold text-foreground">
                                        Meta — {MONTHS[m.month - 1]}/{year}
                                      </h4>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        Defina faturamento e margem do mês.
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Faturamento (R$)
                                      </label>
                                      <Input
                                        ref={fatInputRef}
                                        type="number"
                                        step="0.01"
                                        value={editing.fat}
                                        onChange={(e) => setEditing({ ...editing, fat: e.target.value })}
                                        onKeyDown={handleEditKey}
                                        placeholder="0,00"
                                        className="h-9 font-mono"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Margem (%)
                                      </label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={editing.margem}
                                        onChange={(e) => setEditing({ ...editing, margem: e.target.value })}
                                        onKeyDown={handleEditKey}
                                        placeholder="0,00"
                                        className="h-9 font-mono"
                                      />
                                    </div>
                                    <div className="flex items-center justify-end gap-2 pt-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={closePopover}
                                        disabled={upsertMutation.isPending}
                                      >
                                        Cancelar
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={handleSave}
                                        disabled={upsertMutation.isPending}
                                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                                      >
                                        {upsertMutation.isPending ? "Salvando..." : "Salvar"}
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </td>

                        {/* Atingido */}
                        <td className={`${atingidoGroupBg} ${atingidoGroupBorder} px-3 py-2.5 text-right`}>
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-mono tabular-nums text-foreground">{formatCurrency(m.atingidoFaturamento)}</span>
                            {hasMeta && <ProgressBar atingido={m.atingidoFaturamento} meta={m.metaFaturamento} size="sm" />}
                          </div>
                        </td>
                        <td className={`${atingidoGroupBg} px-3 py-2.5 text-right font-mono tabular-nums`}>
                          {m.atingidoMargemPct > 0 ? <span className="text-foreground">{formatPercent(m.atingidoMargemPct)}</span> : <span className="text-muted-foreground">—</span>}
                        </td>

                        {/* Variação */}
                        <td className={`${variacaoGroupBg} ${variacaoGroupBorder} px-3 py-2.5 text-right font-mono tabular-nums ${variacaoColor(m.variacaoFaturamento)}`}>
                          {hasMeta
                            ? <span className="font-semibold">{m.variacaoFaturamento >= 0 ? "+" : ""}{formatCurrency(m.variacaoFaturamento)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className={`${variacaoGroupBg} px-3 py-2.5 text-right font-mono tabular-nums ${variacaoColor(m.variacaoMargemPct)}`}>
                          {m.metaMargemPct > 0
                            ? <span className="font-semibold">{m.variacaoMargemPct >= 0 ? "+" : ""}{formatPercent(m.variacaoMargemPct)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>

                      {isExpanded && dailyQuery.isLoading && (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-sm text-muted-foreground bg-background/40">
                            Carregando breakdown diário...
                          </td>
                        </tr>
                      )}
                      {isExpanded && !dailyQuery.isLoading && dailyQuery.data?.days.map((d) => {
                        const hasDayMeta = d.metaFaturamento > 0;
                        const hasDayFat = d.atingidoFaturamento > 0;
                        return (
                          <tr key={`${m.month}-d${d.day}`} className="border-b border-border/15 bg-background/50 text-xs">
                            <td className="bg-background/50"></td>
                            <td className="px-3 py-1.5 pl-10 font-mono tabular-nums text-muted-foreground">
                              {d.date}
                            </td>
                            <td className={`${metaGroupBg} ${metaGroupBorder} px-3 py-1.5 text-right font-mono tabular-nums`}>
                              {hasDayMeta ? <span className="text-foreground/80">{formatCurrency(d.metaFaturamento)}</span> : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className={`${metaGroupBg} px-3 py-1.5 text-right font-mono tabular-nums`}>
                              {d.metaMargemPct > 0 ? <span className="text-foreground/80">{formatPercent(d.metaMargemPct)}</span> : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className={`${atingidoGroupBg} ${atingidoGroupBorder} px-3 py-1.5 text-right`}>
                              <div className="flex flex-col items-end gap-0.5">
                                <span className={`font-mono tabular-nums ${hasDayFat ? "text-foreground" : "text-muted-foreground"}`}>
                                  {formatCurrency(d.atingidoFaturamento)}
                                </span>
                                {hasDayMeta && hasDayFat && <ProgressBar atingido={d.atingidoFaturamento} meta={d.metaFaturamento} size="sm" />}
                              </div>
                            </td>
                            <td className={`${atingidoGroupBg} px-3 py-1.5 text-right font-mono tabular-nums`}>
                              {d.atingidoMargemPct > 0 ? <span className="text-foreground">{formatPercent(d.atingidoMargemPct)}</span> : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className={`${variacaoGroupBg} ${variacaoGroupBorder} px-3 py-1.5 text-right font-mono tabular-nums ${variacaoColor(d.variacaoFaturamento)}`}>
                              {hasDayMeta
                                ? <span className="font-semibold">{d.variacaoFaturamento >= 0 ? "+" : ""}{formatCurrency(d.variacaoFaturamento)}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className={`${variacaoGroupBg} px-3 py-1.5 text-right font-mono tabular-nums ${variacaoColor(d.variacaoMargemPct)}`}>
                              {d.metaMargemPct > 0
                                ? <span className="font-semibold">{d.variacaoMargemPct >= 0 ? "+" : ""}{formatPercent(d.variacaoMargemPct)}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}

                {/* Total footer */}
                {totals && (
                  <tr className="border-t-2 border-border/60 bg-card/60 font-semibold">
                    <td></td>
                    <td className="px-3 py-3 uppercase tracking-wider text-xs text-muted-foreground">Total {year}</td>
                    <td className={`${metaGroupBg} ${metaGroupBorder} px-3 py-3 text-right font-mono tabular-nums text-foreground`}>
                      {formatCurrency(totals.meta)}
                    </td>
                    <td className={`${metaGroupBg} px-3 py-3`}></td>
                    <td className={`${atingidoGroupBg} ${atingidoGroupBorder} px-3 py-3 text-right font-mono tabular-nums text-foreground`}>
                      {formatCurrency(totals.atingido)}
                    </td>
                    <td className={`${atingidoGroupBg} px-3 py-3`}></td>
                    <td className={`${variacaoGroupBg} ${variacaoGroupBorder} px-3 py-3 text-right font-mono tabular-nums ${variacaoColor(totals.variacao)}`}>
                      {totals.variacao >= 0 ? "+" : ""}{formatCurrency(totals.variacao)}
                    </td>
                    <td className={`${variacaoGroupBg} px-3 py-3`}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
