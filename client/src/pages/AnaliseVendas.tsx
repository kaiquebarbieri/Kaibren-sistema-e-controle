import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Columns3,
  Download,
  Filter,
  Info,
  MessageCircle,
  MoreVertical,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Store,
  XCircle,
} from "lucide-react";

// Identidade Kaibren — dourado sobre fundo dark premium
const GOLD = "#D4AF37";
const GOLD_DARK = "#B8941F";
const GOLD_SOFT = "#FBF5DF";
const GREEN = "#10B981";

type PeriodValue =
  | "hoje"
  | "ontem"
  | "semana"
  | "semana-passada"
  | "mes"
  | "mes-passado"
  | "30d"
  | "60d"
  | "90d"
  | "custom";

const PERIOD_PRESETS: { value: PeriodValue; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "semana", label: "Essa semana" },
  { value: "semana-passada", label: "Última semana" },
  { value: "mes", label: "Esse mês" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "mes-passado", label: "Mês passado" },
];

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function endOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

function periodToRange(value: PeriodValue, custom?: { from: string; to: string }): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (value) {
    case "hoje":
      return { from: isoDay(today), to: isoDay(endOfDay(today)) };
    case "ontem": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: isoDay(y), to: isoDay(endOfDay(y)) };
    }
    case "semana": {
      const start = new Date(today);
      start.setDate(start.getDate() - start.getDay());
      return { from: isoDay(start), to: isoDay(endOfDay(today)) };
    }
    case "semana-passada": {
      const end = new Date(today);
      end.setDate(end.getDate() - end.getDay() - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return { from: isoDay(start), to: isoDay(endOfDay(end)) };
    }
    case "mes": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: isoDay(start), to: isoDay(endOfDay(today)) };
    }
    case "mes-passado": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: isoDay(start), to: isoDay(endOfDay(end)) };
    }
    case "30d":
    case "60d":
    case "90d": {
      const days = value === "30d" ? 30 : value === "60d" ? 60 : 90;
      const start = new Date(today);
      start.setDate(start.getDate() - days);
      return { from: isoDay(start), to: isoDay(endOfDay(today)) };
    }
    case "custom": {
      return custom ?? { from: isoDay(today), to: isoDay(endOfDay(today)) };
    }
  }
}

function periodLabel(value: PeriodValue, custom?: { from: string; to: string }) {
  if (value === "custom" && custom) {
    return `${fmtDate(custom.from)} – ${fmtDate(custom.to)}`;
  }
  return PERIOD_PRESETS.find((p) => p.value === value)?.label ?? "Período";
}

const PAGE_SIZES = [10, 25, 50, 100];

const SEARCH_MODES = [
  { value: "pedidos", label: "Buscar nos pedidos" },
  { value: "sku", label: "Buscar por SKU" },
  { value: "nome", label: "Buscar por nome do produto" },
] as const;
type SearchMode = typeof SEARCH_MODES[number]["value"];

function fmtCurrency(v: number) {
  const neg = v < 0;
  const abs = Math.abs(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${neg ? "-" : ""}R$ ${abs}`;
}

function fmtPercent(v: number) {
  return `${(v * 100).toFixed(2)}%`;
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function MoneyCell({ value, bold = false, onColored = false }: { value: number; bold?: boolean; onColored?: boolean }) {
  const cls = value < 0
    ? "text-red-500"
    : value > 0
      ? (onColored ? "text-gray-900" : "text-foreground")
      : (onColored ? "text-gray-500" : "text-muted-foreground");
  return (
    <span className={`${cls} ${bold ? "font-semibold" : ""} tabular-nums whitespace-nowrap`}>
      {fmtCurrency(value)}
    </span>
  );
}

function PercentCell({ value, onColored = false }: { value: number; onColored?: boolean }) {
  const cls = value >= 0.5
    ? (onColored ? "text-emerald-700" : "text-emerald-400")
    : value >= 0.2
      ? (onColored ? "text-gray-900" : "text-foreground")
      : value > 0
        ? (onColored ? "text-amber-700" : "text-amber-400")
        : (onColored ? "text-gray-500" : "text-muted-foreground");
  return <span className={`${cls} tabular-nums font-medium whitespace-nowrap`}>{fmtPercent(value)}</span>;
}

function StatusIcons({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cancelled = s === "cancelled";
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Info className="h-4 w-4" />
      <XCircle className={`h-4 w-4 ${cancelled ? "text-red-500" : "text-red-400"}`} />
      <MessageCircle className="h-4 w-4" />
      <ChevronDown className="h-4 w-4" />
    </div>
  );
}

// Cores exatas do GeFinance — 3 tons por grupo (header / body / footer)
type GroupColor = { head: string; body: string; foot: string };
const COLOR_BLUE: GroupColor = { head: "#53B1FD", body: "#84CAFF", foot: "#2E90FA" };
const COLOR_GRAY: GroupColor = { head: "#D5D9EB", body: "#EAECF5", foot: "#AAB0D4" };
const COLOR_YELLOW: GroupColor = { head: "#FEDF8A", body: "#FEF1C6", foot: "#FDBF4E" };
const COLOR_PURPLE: GroupColor = { head: "#B692F6", body: "#E4D5FF", foot: "#B692F6" };
const COLOR_GREEN: GroupColor = { head: "#ACEFC6", body: "#DBFAE6", foot: "#6DDBA0" };

// Tooltips nas colunas financeiras — mesmos textos do GeFinance
const COLUMN_HINTS: Record<string, string> = {
  valorLiquido: "Valor que sobra após subtrair todos os custos e taxas do total da venda.",
  margem: "Margem bruta = Valor líquido ÷ Total venda. Útil para comparar rentabilidade entre pedidos.",
  percentCusto: "Percentual que o custo do produto representa sobre o valor líquido.",
  percentVenda: "Percentual que o valor líquido representa sobre o total da venda.",
};

const ALL_COLUMNS = [
  { key: "icons", label: "" },
  { key: "data", label: "Data" },
  { key: "pedido", label: "Nº do pedido" },
  { key: "ecommerce", label: "Nº do pedido Ecommerce" },
  { key: "cliente", label: "Nome do cliente" },
  { key: "canal", label: "Canal de venda" },
  { key: "cidade", label: "Cidade" },
  { key: "estado", label: "Estado" },
  { key: "transportadora", label: "Método de envio" },
  { key: "status", label: "Status" },
  { key: "totalCusto", label: "Total Custo", money: true, color: COLOR_BLUE },
  { key: "valorProdVendido", label: "Valor do prod. vendido", money: true, color: COLOR_GRAY },
  { key: "desconto", label: "Desconto", money: true, color: COLOR_GRAY },
  { key: "totalProdVendidos", label: "Total prod. vendidos", money: true, color: COLOR_GRAY },
  { key: "freteRecebido", label: "Frete recebido", money: true, color: COLOR_YELLOW },
  { key: "stVenda", label: "ST da venda", money: true, color: COLOR_GRAY },
  { key: "ipiVenda", label: "IPI da venda", money: true, color: COLOR_GRAY },
  { key: "totalVenda", label: "Total venda", money: true },
  { key: "repasse", label: "Repasse", money: true, color: COLOR_PURPLE },
  { key: "comissao", label: "Comissão", money: true, color: COLOR_PURPLE },
  { key: "rebateComissao", label: "Rebate comissão", money: true, color: COLOR_PURPLE },
  { key: "comissaoFinal", label: "Comissão final", money: true },
  { key: "bonus", label: "Bônus", money: true },
  { key: "fretePago", label: "Frete pago", money: true, color: COLOR_YELLOW },
  { key: "rebateFrete", label: "Rebate do frete", money: true, color: COLOR_YELLOW },
  { key: "difFrete", label: "Diferença do frete", money: true },
  { key: "imposto", label: "Imposto", money: true },
  { key: "brinde", label: "Brinde", money: true },
  { key: "embalagem", label: "Embalagem", money: true },
  { key: "valorLiquido", label: "Valor líquido", money: true, bold: true, color: COLOR_GREEN },
  { key: "margem", label: "Margem", money: true, bold: true, color: COLOR_GREEN },
  { key: "percentCusto", label: "% Custo", percent: true, color: COLOR_GREEN },
  { key: "percentVenda", label: "% Venda", percent: true, color: COLOR_GREEN },
] as const;

type ColumnKey = typeof ALL_COLUMNS[number]["key"];

// Chaves de ordenação suportadas pelo backend (listDetailed)
type DetailedSortKey =
  | "createdAt"
  | "id"
  | "buyerName"
  | "accountName"
  | "buyerCity"
  | "buyerState"
  | "statusLabel"
  | "totalCusto"
  | "valorProdVendido"
  | "desconto"
  | "totalProdVendidos"
  | "freteRecebido"
  | "totalVenda"
  | "repasse"
  | "comissao"
  | "comissaoFinal"
  | "fretePago"
  | "rebateFrete"
  | "difFrete"
  | "imposto"
  | "valorLiquido"
  | "margem"
  | "percentCusto"
  | "percentVenda";

type DetailedCondition =
  | "margem-negativa"
  | "custo-faltante"
  | "tarifa-faltante"
  | "imposto-faltante";

// Mapa coluna → chave de ordenação do backend. `null` = coluna não ordenável.
const COLUMN_SORT_KEY: Partial<Record<ColumnKey, DetailedSortKey>> = {
  data: "createdAt",
  pedido: "id",
  ecommerce: "id",
  cliente: "buyerName",
  canal: "accountName",
  cidade: "buyerCity",
  estado: "buyerState",
  status: "statusLabel",
  totalCusto: "totalCusto",
  valorProdVendido: "valorProdVendido",
  desconto: "desconto",
  totalProdVendidos: "totalProdVendidos",
  freteRecebido: "freteRecebido",
  totalVenda: "totalVenda",
  repasse: "repasse",
  comissao: "comissao",
  comissaoFinal: "comissaoFinal",
  fretePago: "fretePago",
  rebateFrete: "rebateFrete",
  difFrete: "difFrete",
  imposto: "imposto",
  valorLiquido: "valorLiquido",
  margem: "margem",
  percentCusto: "percentCusto",
  percentVenda: "percentVenda",
};

const CONDITION_OPTIONS: { value: "" | DetailedCondition; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "margem-negativa", label: "Com margem negativa" },
  { value: "custo-faltante", label: "Com custo faltante" },
  { value: "tarifa-faltante", label: "Com tarifa faltante" },
  { value: "imposto-faltante", label: "Com imposto faltante" },
];

// ---------- Calendário simples (1 mês, range selection) ----------
function MiniCalendar({
  anchor,
  range,
  onChange,
}: {
  anchor: Date;
  range: { from: string; to: string };
  onChange: (r: { from: string; to: string }) => void;
}) {
  const [cursor, setCursor] = useState<Date>(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const [pickingEnd, setPickingEnd] = useState(false);

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));

  const from = new Date(range.from);
  const to = new Date(range.to);

  function handleClick(d: Date) {
    const iso = isoDay(d);
    if (!pickingEnd) {
      onChange({ from: iso, to: iso });
      setPickingEnd(true);
    } else {
      if (d < from) {
        onChange({ from: iso, to: range.from });
      } else {
        onChange({ from: range.from, to: iso });
      }
      setPickingEnd(false);
    }
  }

  function isInRange(d: Date) {
    return d >= from && d <= to;
  }
  function isEdge(d: Date) {
    return isoDay(d) === isoDay(from) || isoDay(d) === isoDay(to);
  }

  return (
    <div className="w-64">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="rounded p-1 hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold capitalize">{monthLabel}</div>
        <button
          type="button"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="rounded p-1 hover:bg-muted"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] uppercase text-muted-foreground">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <div key={i} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const inRange = isInRange(d);
          const edge = isEdge(d);
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleClick(d)}
              className={`rounded py-1 ${edge ? "font-bold text-white" : inRange ? "text-gray-900" : "hover:bg-muted"}`}
              style={{
                background: edge ? GOLD : inRange ? GOLD_SOFT : undefined,
              }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Página principal ----------
export default function AnaliseVendas() {
  const [tab, setTab] = useState<"pedidos" | "produtos">("pedidos");

  // Período
  const [period, setPeriod] = useState<PeriodValue>("semana");
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>(() => {
    const r = periodToRange("semana");
    return { from: r.from, to: r.to };
  });
  const [periodOpen, setPeriodOpen] = useState(false);
  // draft do modal
  const [draftPeriod, setDraftPeriod] = useState<PeriodValue>(period);
  const [draftRange, setDraftRange] = useState<{ from: string; to: string }>(customRange);

  // Paginação — "Carregar mais" acumula
  const [pageSize, setPageSize] = useState<number>(10);
  const [displayLimit, setDisplayLimit] = useState<number>(10);

  // Busca com 3 modos
  const [searchMode, setSearchMode] = useState<SearchMode>("pedidos");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");

  // Filtros
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);

  // Sort
  const [sortBy, setSortBy] = useState<DetailedSortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Filtro "Condições da venda" (margem negativa, custo faltante, etc) — estilo GeFinance
  const [condition, setCondition] = useState<"" | DetailedCondition>("");

  // Colunas visíveis + colunas fixadas (pin)
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>(
    () => Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, true])) as Record<ColumnKey, boolean>,
  );
  const [pinnedCols, setPinnedCols] = useState<Set<ColumnKey>>(new Set());
  const [openColMenu, setOpenColMenu] = useState<ColumnKey | null>(null);

  const range = useMemo(
    () => (period === "custom" ? customRange : periodToRange(period)),
    [period, customRange],
  );

  // Reset accumulator on filter change
  const filterKey = JSON.stringify({
    accounts: selectedAccounts,
    statusFilter,
    range,
    search,
    searchMode,
    pageSize,
    sortBy,
    sortDir,
    condition,
  });
  const prevKey = useRef(filterKey);
  useEffect(() => {
    if (prevKey.current !== filterKey) {
      setDisplayLimit(pageSize);
      prevKey.current = filterKey;
    }
  }, [filterKey, pageSize]);

  const accountsQuery = trpc.marketplaceOrders.accounts.useQuery();
  const detailedQuery = trpc.marketplaceOrders.listDetailed.useQuery({
    accounts: selectedAccounts.length > 0 ? selectedAccounts : undefined,
    status: statusFilter || undefined,
    dateFrom: range.from,
    dateTo: range.to,
    search: search || undefined,
    condition: condition || undefined,
    sortBy,
    sortDir,
    limit: displayLimit,
    offset: 0,
  });

  const accounts = accountsQuery.data ?? [];
  const data = detailedQuery.data;
  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const totals = data?.totals;
  const hasMore = orders.length < total;

  // Ordem com pinned primeiro
  const cols = useMemo(() => {
    const visible = ALL_COLUMNS.filter((c) => visibleCols[c.key]);
    const pinned = visible.filter((c) => pinnedCols.has(c.key));
    const rest = visible.filter((c) => !pinnedCols.has(c.key));
    return [...pinned, ...rest];
  }, [visibleCols, pinnedCols]);

  function toggleAccount(id: string) {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function applySearch() {
    setSearch(searchDraft.trim());
  }

  function openPeriodModal() {
    setDraftPeriod(period);
    setDraftRange(range);
    setPeriodOpen(true);
  }

  function applyPeriodModal() {
    setPeriod(draftPeriod);
    if (draftPeriod === "custom") {
      setCustomRange(draftRange);
    }
    setPeriodOpen(false);
  }

  function handleSort(key: ColumnKey, dir?: "asc" | "desc") {
    const sortKey = COLUMN_SORT_KEY[key];
    if (!sortKey) return;
    if (dir) {
      setSortBy(sortKey);
      setSortDir(dir);
      return;
    }
    // toggle: se já está nessa coluna, inverte direção; senão, começa desc
    if (sortBy === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(sortKey);
      setSortDir("desc");
    }
  }

  function togglePin(key: ColumnKey) {
    setPinnedCols((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
    setOpenColMenu(null);
  }

  function hideCol(key: ColumnKey) {
    setVisibleCols((prev) => ({ ...prev, [key]: false }));
    setOpenColMenu(null);
  }

  function exportCsv() {
    if (!orders.length) return;
    const headers = cols.filter((c) => c.key !== "icons").map((c) => c.label);
    const rows = orders.map((o) => {
      return cols.filter((c) => c.key !== "icons").map((c) => {
        const v = (o as any)[c.key];
        if ((c as any).money) return String(v ?? 0).replace(".", ",");
        if ((c as any).percent) return `${((v ?? 0) * 100).toFixed(2)}%`;
        if (c.key === "data") return fmtDate(o.createdAt);
        if (c.key === "pedido") return o.id;
        if (c.key === "ecommerce") return o.id.replace(/^ML-|^SH-/, "");
        if (c.key === "cliente") return o.buyerName;
        if (c.key === "canal") return o.accountName;
        if (c.key === "cidade") return o.buyerCity ?? "";
        if (c.key === "estado") return o.buyerState ?? "";
        if (c.key === "transportadora") return o.carrier;
        if (c.key === "status") return o.statusLabel;
        return String(v ?? "");
      });
    });
    const csv = [headers, ...rows]
      .map((r) => r.map((f) => `"${String(f ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analise-vendas-${range.from}_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderCell(o: any, key: ColumnKey) {
    const col = ALL_COLUMNS.find((c) => c.key === key) as any;
    const onColored = !!col?.color;
    const textCls = "text-foreground";
    switch (key) {
      case "icons":
        return <StatusIcons status={o.status} />;
      case "data":
        return <span className={textCls}>{fmtDate(o.createdAt)}</span>;
      case "pedido":
        return <span className={textCls}>{o.id.replace(/^ML-|^SH-/, "")}</span>;
      case "ecommerce":
        return <span className={textCls}>{o.id.replace(/^ML-|^SH-/, "")}</span>;
      case "cliente":
        return <span className={textCls}>{o.buyerName}</span>;
      case "canal":
        return <span className={`${textCls} font-medium`}>{o.accountName}</span>;
      case "cidade":
        return <span className={textCls}>{o.buyerCity || "—"}</span>;
      case "estado":
        return <span className={textCls}>{o.buyerState || "—"}</span>;
      case "transportadora":
        return <span className={textCls}>{o.carrier}</span>;
      case "status":
        return <span className={textCls}>{o.statusLabel}</span>;
      case "percentCusto":
      case "percentVenda":
        return <PercentCell value={Number(o[key] ?? 0)} onColored={onColored} />;
      default:
        return <MoneyCell value={Number(o[key] ?? 0)} bold={col?.bold} onColored={onColored} />;
    }
  }

  return (
    <DashboardLayout activeSection="analise-vendas">
      <div className="min-h-full rounded-xl border border-border bg-card text-foreground shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <button
            onClick={openPeriodModal}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white"
            style={{ background: GOLD }}
          >
            <Calendar className="h-4 w-4" />
            {periodLabel(period, customRange)}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => setAccountsOpen((v) => !v)}
            className="relative inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground"
          >
            <Store className="h-4 w-4" style={{ color: GOLD }} />
            {selectedAccounts.length === 0
              ? "Todas as contas"
              : selectedAccounts.length === 1
                ? selectedAccounts[0]
                : `${selectedAccounts.length} contas`}
            <ChevronDown className="h-3.5 w-3.5" />
            {accountsOpen && (
              <div
                className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-border bg-popover p-2 text-left text-sm font-normal text-popover-foreground shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => { setSelectedAccounts([]); setAccountsOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-muted ${selectedAccounts.length === 0 ? "font-semibold" : ""}`}
                  style={selectedAccounts.length === 0 ? { color: GOLD } : {}}
                >
                  <Store className="h-4 w-4" />
                  Todas as contas
                </button>
                <div className="my-1 border-t border-border" />
                {accounts.map((a) => {
                  const checked = selectedAccounts.includes(a.id);
                  return (
                    <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAccount(a.id)}
                        style={{ accentColor: GOLD }}
                      />
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: (a as any).color || "#999" }} />
                      <span className="flex-1 truncate">{a.name}</span>
                      <span className="text-xs uppercase text-muted-foreground">{(a as any).platform}</span>
                    </label>
                  );
                })}
                {selectedAccounts.length > 0 && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <button
                      onClick={() => { setSelectedAccounts([]); }}
                      className="w-full rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
                    >
                      Limpar seleção
                    </button>
                  </>
                )}
              </div>
            )}
          </button>

          <button
            onClick={() => setColumnsOpen((v) => !v)}
            className="relative inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white"
            style={{ background: GOLD }}
          >
            <Columns3 className="h-4 w-4" />
            Exibição de colunas
            {columnsOpen && (
              <div
                className="absolute left-0 top-full z-20 mt-1 max-h-96 w-64 overflow-auto rounded-md border border-border bg-popover py-1 text-left text-sm font-normal text-popover-foreground shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                {ALL_COLUMNS.filter((c) => c.key !== "icons").map((c) => (
                  <label
                    key={c.key}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={visibleCols[c.key]}
                      onChange={(e) => setVisibleCols((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                      style={{ accentColor: GOLD }}
                    />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            )}
          </button>

          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="relative inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white"
            style={{ background: GOLD }}
          >
            <Filter className="h-4 w-4" />
            Todos os filtros
            {(selectedAccounts.length > 0 || statusFilter || condition) && (
              <span className="ml-1 rounded-full bg-background px-1.5 text-xs font-bold" style={{ color: GOLD }}>
                {selectedAccounts.length + (statusFilter ? 1 : 0) + (condition ? 1 : 0)}
              </span>
            )}
            {filtersOpen && (
              <div
                className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-border bg-popover p-3 text-left text-sm font-normal text-popover-foreground shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Condições da venda</div>
                {CONDITION_OPTIONS.map((o) => (
                  <label key={o.value || "all"} className="flex cursor-pointer items-center gap-2 py-1">
                    <input
                      type="radio"
                      name="cond"
                      checked={condition === o.value}
                      onChange={() => setCondition(o.value)}
                      style={{ accentColor: GOLD }}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
                <div className="my-2 border-t border-border" />
                <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Canais de venda</div>
                {accounts.map((a) => (
                  <label key={a.id} className="flex cursor-pointer items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={selectedAccounts.includes(a.id)}
                      onChange={() => toggleAccount(a.id)}
                      style={{ accentColor: GOLD }}
                    />
                    <span>{a.name}</span>
                  </label>
                ))}
                <div className="my-2 border-t border-border" />
                <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Status</div>
                {[
                  { v: "", l: "Todos" },
                  { v: "paid", l: "Pago" },
                  { v: "shipped", l: "Enviado" },
                  { v: "delivered", l: "Entregue" },
                  { v: "cancelled", l: "Cancelado" },
                ].map((s) => (
                  <label key={s.v || "all"} className="flex cursor-pointer items-center gap-2 py-1">
                    <input
                      type="radio"
                      name="st"
                      checked={statusFilter === s.v}
                      onChange={() => setStatusFilter(s.v)}
                      style={{ accentColor: GOLD }}
                    />
                    <span>{s.l}</span>
                  </label>
                ))}
              </div>
            )}
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: GOLD }} />
              <input
                type="text"
                placeholder="Buscar no Noah Insights"
                className="h-9 w-52 rounded-md border border-border bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex items-center overflow-hidden rounded-md border border-border bg-background">
              <select
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value as SearchMode)}
                className="h-9 border-0 border-r border-border bg-background px-2 text-sm text-foreground focus:outline-none"
              >
                {SEARCH_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applySearch(); }}
                  onBlur={applySearch}
                  placeholder={SEARCH_MODES.find((m) => m.value === searchMode)?.label}
                  className="h-9 w-52 border-0 bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={() => detailedQuery.refetch()}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white"
              style={{ background: GOLD }}
            >
              <RefreshCw className={`h-4 w-4 ${detailedQuery.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 border-b border-border px-4">
          <button
            onClick={() => setTab("pedidos")}
            className="rounded-t-md px-6 py-2.5 text-sm font-semibold"
            style={{ background: tab === "pedidos" ? GOLD : "transparent", color: tab === "pedidos" ? "#111827" : undefined }}
          >
            <span className={tab === "pedidos" ? "" : "text-muted-foreground"}>Pedidos</span>
          </button>
          <button
            onClick={() => setTab("produtos")}
            className="rounded-t-md px-6 py-2.5 text-sm font-semibold"
            style={{ background: tab === "produtos" ? GOLD : "transparent", color: tab === "produtos" ? "#111827" : undefined }}
          >
            <span className={tab === "produtos" ? "" : "text-muted-foreground"}>Produtos</span>
          </button>

          <div className="ml-auto flex items-center gap-2 py-2">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>Exibir {n} pedidos</option>
              ))}
            </select>

            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <Download className="h-4 w-4" style={{ color: GREEN }} />
              Exportar
            </button>
          </div>
        </div>

        {tab === "pedidos" ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky left-0 z-10 bg-card px-3 py-3 text-left">
                    <input type="checkbox" style={{ accentColor: GOLD }} />
                  </th>
                  {cols.map((c) => {
                    const coloredHead = !!(c as any).color;
                    const isMoney = (c as any).money || (c as any).percent;
                    const hint = COLUMN_HINTS[c.key];
                    const isPinned = pinnedCols.has(c.key);
                    const sortKey = COLUMN_SORT_KEY[c.key];
                    const isSortable = !!sortKey;
                    const isActiveSort = sortKey && sortBy === sortKey;
                    return (
                      <th
                        key={c.key}
                        className={`whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide ${
                          isMoney ? "text-right" : ""
                        } ${coloredHead ? "text-gray-900" : "text-muted-foreground"}`}
                        style={{ background: (c as any).color?.head || undefined }}
                      >
                        <div className={`flex items-center gap-1 ${isMoney ? "justify-end" : ""}`}>
                          {isPinned && <Pin className="h-3 w-3" style={{ color: GOLD }} />}
                          {isSortable ? (
                            <button
                              type="button"
                              onClick={() => handleSort(c.key as ColumnKey)}
                              className="flex items-center gap-1 rounded px-0.5 hover:bg-black/10"
                              title={
                                isActiveSort
                                  ? sortDir === "asc"
                                    ? "Ordenado crescente — clique para inverter"
                                    : "Ordenado decrescente — clique para inverter"
                                  : "Clique para ordenar"
                              }
                            >
                              <span>{c.label}</span>
                              <ChevronsUpDown
                                className={`h-3 w-3 ${isActiveSort ? "" : "opacity-40"}`}
                                style={isActiveSort ? { color: GOLD } : undefined}
                              />
                            </button>
                          ) : (
                            <span>{c.label}</span>
                          )}
                          {hint && (
                            <span title={hint} className="cursor-help">
                              <Info className="h-3.5 w-3.5 opacity-60" />
                            </span>
                          )}
                          {c.key !== "icons" && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenColMenu((m) => (m === c.key ? null : c.key))}
                                className="rounded p-0.5 hover:bg-black/10"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>
                              {openColMenu === c.key && (
                                <div
                                  className="absolute right-0 top-full z-30 mt-1 w-44 rounded-md border border-border bg-popover py-1 text-left text-xs font-normal normal-case tracking-normal text-popover-foreground shadow-lg"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {isSortable && (
                                    <>
                                      <button
                                        className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted"
                                        onClick={() => { handleSort(c.key as ColumnKey, "asc"); setOpenColMenu(null); }}
                                      >
                                        <ChevronsUpDown className="h-3.5 w-3.5" /> Ordenar crescente
                                      </button>
                                      <button
                                        className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted"
                                        onClick={() => { handleSort(c.key as ColumnKey, "desc"); setOpenColMenu(null); }}
                                      >
                                        <ChevronsUpDown className="h-3.5 w-3.5" /> Ordenar decrescente
                                      </button>
                                      <div className="my-1 border-t border-border" />
                                    </>
                                  )}
                                  <button
                                    className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted"
                                    onClick={() => togglePin(c.key as ColumnKey)}
                                  >
                                    {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                                    {isPinned ? "Desafixar coluna" : "Fixar coluna"}
                                  </button>
                                  <button
                                    className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted"
                                    onClick={() => hideCol(c.key as ColumnKey)}
                                  >
                                    <XCircle className="h-3.5 w-3.5" /> Ocultar coluna
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {detailedQuery.isLoading ? (
                  <tr>
                    <td colSpan={cols.length + 1} className="py-10 text-center text-muted-foreground">
                      Carregando pedidos...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={cols.length + 1} className="py-10 text-center text-muted-foreground">
                      Nenhum pedido encontrado nesse período.
                    </td>
                  </tr>
                ) : (
                  orders.map((o: any) => (
                    <tr
                      key={o.id}
                      className="border-b border-border/50 hover:bg-muted/40"
                    >
                      <td className="sticky left-0 bg-card px-3 py-3">
                        <input type="checkbox" style={{ accentColor: GOLD }} />
                      </td>
                      {cols.map((c) => (
                        <td
                          key={c.key}
                          className={`whitespace-nowrap px-3 py-3 ${
                            (c as any).money || (c as any).percent ? "text-right" : ""
                          }`}
                          style={{ background: (c as any).color?.body || undefined }}
                        >
                          {renderCell(o, c.key)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
              {totals && orders.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td className="sticky left-0 bg-muted/30 px-3 py-3"></td>
                    <td
                      colSpan={Math.min(10, cols.length)}
                      className="px-3 py-3 text-xs font-semibold uppercase text-muted-foreground"
                    >
                      Exibindo {orders.length} de {total.toLocaleString("pt-BR")} pedidos encontrados
                    </td>
                    {cols.slice(10).map((c) => {
                      const v = (totals as any)[c.key];
                      const onColored = !!(c as any).color;
                      return (
                        <td
                          key={c.key}
                          className="whitespace-nowrap px-3 py-3 text-right"
                          style={{ background: (c as any).color?.foot || undefined }}
                        >
                          {(c as any).percent ? (
                            <PercentCell value={Number(v ?? 0)} onColored={onColored} />
                          ) : (c as any).money ? (
                            <MoneyCell value={Number(v ?? 0)} bold onColored={onColored} />
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          <ProdutosTab
            accounts={selectedAccounts.length > 0 ? selectedAccounts : undefined}
            status={statusFilter || undefined}
            dateFrom={range.from}
            dateTo={range.to}
            search={search || undefined}
          />
        )}

        {/* "Carregar mais" — paginação infinita estilo GeFinance */}
        {tab === "pedidos" && orders.length > 0 && (
          <div className="flex flex-col items-center gap-2 border-t border-border px-4 py-4">
            {hasMore ? (
              <button
                onClick={() => setDisplayLimit((l) => l + pageSize)}
                disabled={detailedQuery.isFetching}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/40 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" style={{ color: GOLD }} />
                {detailedQuery.isFetching ? "Carregando..." : "Carregar mais"}
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Todos os {total.toLocaleString("pt-BR")} pedidos foram carregados
              </span>
            )}
          </div>
        )}
      </div>

      {/* Modal de período */}
      {periodOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPeriodOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 className="text-sm font-semibold">Selecionar período</h3>
              <button onClick={() => setPeriodOpen(false)} className="rounded p-1 hover:bg-muted">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-4 p-5 sm:flex-row">
              <div className="flex w-full flex-col gap-1 sm:w-48">
                {PERIOD_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => {
                      setDraftPeriod(p.value);
                      const r = periodToRange(p.value);
                      setDraftRange(r);
                    }}
                    className="rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                    style={
                      draftPeriod === p.value
                        ? { background: GOLD_SOFT, color: "#111827", fontWeight: 600 }
                        : {}
                    }
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={() => setDraftPeriod("custom")}
                  className="rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                  style={
                    draftPeriod === "custom"
                      ? { background: GOLD_SOFT, color: "#111827", fontWeight: 600 }
                      : {}
                  }
                >
                  Personalizado
                </button>
              </div>
              <div className="flex-1">
                <MiniCalendar
                  anchor={new Date(draftRange.from)}
                  range={draftRange}
                  onChange={(r) => {
                    setDraftRange(r);
                    setDraftPeriod("custom");
                  }}
                />
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>De:</span>
                  <input
                    type="date"
                    value={draftRange.from}
                    onChange={(e) => {
                      setDraftRange((r) => ({ ...r, from: e.target.value }));
                      setDraftPeriod("custom");
                    }}
                    className="rounded border border-border bg-background px-2 py-1 text-foreground"
                  />
                  <span>Até:</span>
                  <input
                    type="date"
                    value={draftRange.to}
                    onChange={(e) => {
                      setDraftRange((r) => ({ ...r, to: e.target.value }));
                      setDraftPeriod("custom");
                    }}
                    className="rounded border border-border bg-background px-2 py-1 text-foreground"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <button
                onClick={() => setPeriodOpen(false)}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={applyPeriodModal}
                className="rounded-md px-4 py-2 text-sm font-semibold text-white"
                style={{ background: GOLD }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ---------- Aba Produtos — Curva ABC dupla (estilo GeFinance) ----------
function ProdutosTab({
  accounts,
  status,
  dateFrom,
  dateTo,
  search,
}: {
  accounts?: string[];
  status?: string;
  dateFrom: string;
  dateTo: string;
  search?: string;
}) {
  const query = (trpc as any).marketplaceOrders.productAnalysis.useQuery({
    accounts,
    status,
    dateFrom,
    dateTo,
    search,
  });
  const data = query.data;
  const products: any[] = data?.products ?? [];
  const totals: any = data?.totals;

  function curvaBadge(c: "A" | "B" | "C") {
    const styles: Record<string, { bg: string; color: string }> = {
      A: { bg: "#10B981", color: "#fff" },
      B: { bg: "#F59E0B", color: "#1F2937" },
      C: { bg: "#EF4444", color: "#fff" },
    };
    const s = styles[c];
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
        style={{ background: s.bg, color: s.color }}
      >
        {c}
      </span>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Produto
            </th>
            <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vendas
            </th>
            <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Faturamento
            </th>
            <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ticket médio
            </th>
            <th className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground" title="Curva ABC por faturamento: A = 80% do faturamento, B = próximos 15%, C = cauda 5%">
              Curva (Faturamento)
            </th>
            <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Margem R$
            </th>
            <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Margem %
            </th>
            <th className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground" title="Curva ABC por margem: produtos que realmente geram lucro (A), medianos (B), menos lucrativos (C)">
              Curva (Margem)
            </th>
            <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {query.isLoading ? (
            <tr>
              <td colSpan={9} className="py-10 text-center text-muted-foreground">
                Carregando análise de produtos...
              </td>
            </tr>
          ) : products.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-10 text-center text-muted-foreground">
                Nenhum produto vendido nesse período.
              </td>
            </tr>
          ) : (
            products.map((p: any, i: number) => (
              <tr key={p.sku + "|" + p.productName + "|" + i} className="border-b border-border/50 hover:bg-muted/40">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    {p.productImage ? (
                      <img src={p.productImage} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate max-w-xs text-foreground">{p.productName}</div>
                      <div className="text-xs text-muted-foreground">SKU: {p.sku || "—"}</div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-foreground">
                  {p.vendas.toLocaleString("pt-BR")}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-foreground">
                  {fmtCurrency(p.faturamento)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted-foreground">
                  {fmtCurrency(p.ticketMedio)}
                </td>
                <td className="px-3 py-3 text-center">{curvaBadge(p.curvaFaturamento)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                  <MoneyCell value={p.margem} />
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                  <PercentCell value={p.margemPct} />
                </td>
                <td className="px-3 py-3 text-center">{curvaBadge(p.curvaMargem)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted-foreground">
                  {fmtPercent(p.share)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {totals && products.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/30">
              <td className="px-3 py-3 text-xs font-semibold uppercase text-muted-foreground">
                {totals.produtos.toLocaleString("pt-BR")} produtos
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-foreground">
                {totals.vendas.toLocaleString("pt-BR")}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-foreground">
                {fmtCurrency(totals.faturamento)}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-foreground">
                {fmtCurrency(totals.ticketMedio)}
              </td>
              <td></td>
              <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">
                <MoneyCell value={totals.margem} bold />
              </td>
              <td></td>
              <td></td>
              <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-muted-foreground">
                100,00%
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
