import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const STORAGE_KEY = "dashboard-period";
const STORAGE_KEY_DATE = STORAGE_KEY + "-date";
const STORAGE_KEY_DATE_END = STORAGE_KEY + "-date-end";

// ── Opcoes do dropdown ────────────────────────────────────────────

type PresetOption = { label: string; value: string; days: number };

const presets: PresetOption[] = [
  { label: "Hoje",            value: "today",     days: 0 },
  { label: "Ontem",           value: "yesterday", days: -1 },
  { label: "Últimos 7 dias",  value: "7d",        days: 7 },
  { label: "Últimos 15 dias", value: "15d",       days: 15 },
  { label: "Últimos 30 dias", value: "30d",       days: 30 },
];

const MONTHS_SHORT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const MONTHS_FULL  = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const WEEK_DAYS    = ["DOM","SEG","TER","QUA","QUI","SEX","SÁB"];

// ── Helpers ───────────────────────────────────────────────────────

function todayISO(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isoToDate(iso: string): Date {
  return new Date(iso + "T12:00:00");
}

function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDayMonth(iso: string): string {
  const d = isoToDate(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getMonth()]}`;
}

function fmtFullDate(iso: string): string {
  const d = isoToDate(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function formatRangeLabel(start: string, end: string): string {
  if (start === end) return fmtFullDate(start);
  return `${fmtDayMonth(start)} - ${fmtFullDate(end)}`;
}

// ── Calendario com selecao de range ───────────────────────────────

type CalendarProps = {
  initialStart: string;
  initialEnd: string;
  onApply: (start: string, end: string) => void;
  onCancel: () => void;
};

type QuickPreset = { label: string; getRange: () => { start: string; end: string } };

function RangeCalendar({ initialStart, initialEnd, onApply, onCancel }: CalendarProps) {
  const todayStr = todayISO();
  const init = initialStart || todayStr;
  const [viewYear, setViewYear]   = useState(parseInt(todayStr.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(parseInt(todayStr.slice(5, 7)) - 1);

  // Estado do range em construcao
  const [rangeStart, setRangeStart] = useState<string>(initialStart || todayStr);
  const [rangeEnd, setRangeEnd]     = useState<string>(initialEnd || initialStart || todayStr);
  const [picking, setPicking]       = useState<"start" | "end">("start");
  const [hoverDate, setHoverDate]   = useState<string | null>(null);

  // Atalhos rapidos
  const quickPresets: QuickPreset[] = [
    { label: "Hoje", getRange: () => ({ start: todayStr, end: todayStr }) },
    { label: "7d", getRange: () => {
      const from = new Date(Date.now() - 3 * 60 * 60 * 1000);
      from.setDate(from.getDate() - 6);
      return { start: dateToISO(from), end: todayStr };
    }},
    { label: "15d", getRange: () => {
      const from = new Date(Date.now() - 3 * 60 * 60 * 1000);
      from.setDate(from.getDate() - 14);
      return { start: dateToISO(from), end: todayStr };
    }},
    { label: "30d", getRange: () => {
      const from = new Date(Date.now() - 3 * 60 * 60 * 1000);
      from.setDate(from.getDate() - 29);
      return { start: dateToISO(from), end: todayStr };
    }},
    { label: "90d", getRange: () => {
      const from = new Date(Date.now() - 3 * 60 * 60 * 1000);
      from.setDate(from.getDate() - 89);
      return { start: dateToISO(from), end: todayStr };
    }},
  ];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Monta as celulas do mes (incluindo dias do mes anterior/proximo em cinza)
  const firstDayWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev   = new Date(viewYear, viewMonth, 0).getDate();

  type Cell = { iso: string; day: number; inMonth: boolean };
  const cells: Cell[] = [];

  // Tail do mes anterior
  for (let i = firstDayWeek - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    const pm = viewMonth === 0 ? 11 : viewMonth - 1;
    const py = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ iso: `${py}-${String(pm + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`, day, inMonth: false });
  }
  // Mes corrente
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, inMonth: true });
  }
  // Head do proximo mes — preenche ate completar 6 semanas (42 celulas)
  let nd = 1;
  while (cells.length < 42) {
    const nm = viewMonth === 11 ? 0 : viewMonth + 1;
    const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ iso: `${ny}-${String(nm + 1).padStart(2, "0")}-${String(nd).padStart(2, "0")}`, day: nd, inMonth: false });
    nd++;
  }

  // Range visual com preview do hover quando picking === "end"
  const previewEnd = picking === "end" && hoverDate ? hoverDate : rangeEnd;
  let displayStart = rangeStart;
  let displayEnd   = previewEnd || rangeStart;
  if (displayStart && displayEnd && displayStart > displayEnd) {
    [displayStart, displayEnd] = [displayEnd, displayStart];
  }

  const handleClick = (iso: string, isFuture: boolean) => {
    if (isFuture) return;
    if (picking === "start") {
      setRangeStart(iso);
      setRangeEnd(iso);
      setPicking("end");
      setHoverDate(null);
    } else {
      // segundo clique → fixa o end (com swap se necessario)
      let s = rangeStart;
      let e = iso;
      if (s > e) { [s, e] = [e, s]; }
      setRangeStart(s);
      setRangeEnd(e);
      setPicking("start");
      setHoverDate(null);
    }
  };

  const canApply = !!rangeStart && !!rangeEnd;

  const handleQuickPreset = (preset: QuickPreset) => {
    const { start, end } = preset.getRange();
    setRangeStart(start);
    setRangeEnd(end);
    setPicking("start");
    setHoverDate(null);
    // Navega o calendario pro mes do start
    const d = isoToDate(start);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const goToToday = () => {
    const d = isoToDate(todayStr);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  return (
    <div className="w-[320px] rounded-xl border border-border/50 bg-card p-4 shadow-2xl">
      {/* Atalhos rapidos */}
      <div className="flex gap-1.5 mb-3">
        {quickPresets.map((preset) => {
          const { start, end } = preset.getRange();
          const isActive = rangeStart === start && rangeEnd === end;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleQuickPreset(preset)}
              className={`flex-1 text-[11px] font-medium rounded-md py-1.5 transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Header — navegacao de meses */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={goToToday}
          className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
          title="Ir para hoje"
        >
          {MONTHS_FULL[viewMonth]} {viewYear}
        </button>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Instrucao + indicador de hoje */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {picking === "start" ? "Selecione o dia inicial" : "Selecione o dia final"}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-primary">
          <span className="h-2 w-2 rounded-full bg-primary inline-block" />
          Hoje
        </div>
      </div>

      {/* Cabecalho dos dias da semana */}
      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] text-muted-foreground py-1 font-semibold tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Grade de dias */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const isFuture = cell.iso > todayStr;
          const isToday  = cell.iso === todayStr;
          const isStart  = cell.iso === displayStart;
          const isEnd    = cell.iso === displayEnd;
          const inRange  = !!displayStart && !!displayEnd && cell.iso >= displayStart && cell.iso <= displayEnd;
          const isSingle = isStart && isEnd;

          let cellClass = "h-9 w-full text-sm font-medium transition-colors flex items-center justify-center ";

          if (!cell.inMonth) {
            cellClass += "text-muted-foreground/30 ";
          } else if (isFuture) {
            cellClass += "text-muted-foreground/20 cursor-not-allowed ";
          } else {
            cellClass += "text-foreground ";
          }

          // Background do range
          if (inRange && !isSingle && !isStart && !isEnd) {
            cellClass += "bg-primary/25 ";
          }
          if (isStart && !isSingle) cellClass += "bg-primary/25 ";
          if (isEnd && !isSingle)   cellClass += "bg-primary/25 ";

          // Botao redondo nos extremos
          let innerClass = "h-8 w-8 flex items-center justify-center transition-colors ";
          if (isSingle) innerClass += "bg-primary text-primary-foreground rounded-full font-semibold";
          else if (isStart) innerClass += "bg-primary text-primary-foreground rounded-full font-semibold";
          else if (isEnd)   innerClass += "bg-primary text-primary-foreground rounded-full font-semibold";
          else if (isToday && cell.inMonth) innerClass += "border-2 border-primary text-primary rounded-full font-semibold";
          else if (cell.inMonth && !isFuture) innerClass += "hover:bg-white/10 rounded-full";
          else innerClass += "rounded-full";

          return (
            <button
              key={i}
              type="button"
              disabled={isFuture}
              onClick={() => handleClick(cell.iso, isFuture)}
              onMouseEnter={() => setHoverDate(cell.iso)}
              className={cellClass}
            >
              <span className={innerClass}>{cell.day}</span>
            </button>
          );
        })}
      </div>

      {/* Range selecionado + acoes */}
      <div className="mt-3 pt-3 border-t border-border/30">
        {rangeStart && (
          <div className="text-center text-xs text-muted-foreground mb-2">
            {formatRangeLabel(
              rangeStart <= (rangeEnd || rangeStart) ? rangeStart : (rangeEnd || rangeStart),
              rangeStart <= (rangeEnd || rangeStart) ? (rangeEnd || rangeStart) : rangeStart,
            )}
          </div>
        )}
        <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 text-xs rounded-md border border-border/50 py-2 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => canApply && onApply(rangeStart, rangeEnd)}
          disabled={!canApply}
          className={`flex-1 text-xs rounded-md py-2 font-semibold transition-colors ${
            canApply
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-primary/30 text-primary-foreground/60 cursor-not-allowed"
          }`}
        >
          Aplicar
        </button>
        </div>
      </div>
    </div>
  );
}

// ── PeriodFilter (dropdown principal) ─────────────────────────────

type Props = {
  value: string;
  onChange: (value: string) => void;
  customDate?: string;
  customDateEnd?: string;
  onCustomDate?: (date: string) => void;
  onCustomDateEnd?: (date: string) => void;
  /** Callback opcional chamado com {startDate, endDate} ISO sempre que o periodo muda */
  onPeriodChange?: (range: { startDate: string; endDate: string }) => void;
};

export default function PeriodFilter({
  value,
  onChange,
  customDate,
  customDateEnd,
  onCustomDate,
  onCustomDateEnd,
  onPeriodChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Texto exibido no botao
  const triggerLabel = (() => {
    if (value === "custom" && customDate) {
      return formatRangeLabel(customDate, customDateEnd || customDate);
    }
    const opt = presets.find((o) => o.value === value);
    return opt?.label ?? "Hoje";
  })();

  const handleSelectPreset = (preset: PresetOption) => {
    onChange(preset.value);
    try { localStorage.setItem(STORAGE_KEY, preset.value); } catch {}
    if (onPeriodChange) {
      const { dateFrom, dateTo } = periodToDates(preset.value);
      onPeriodChange({ startDate: dateFrom, endDate: dateTo });
    }
    setOpen(false);
  };

  const handleApplyRange = (start: string, end: string) => {
    onChange("custom");
    onCustomDate?.(start);
    onCustomDateEnd?.(end);
    try {
      localStorage.setItem(STORAGE_KEY, "custom");
      localStorage.setItem(STORAGE_KEY_DATE, start);
      localStorage.setItem(STORAGE_KEY_DATE_END, end);
    } catch {}
    onPeriodChange?.({ startDate: start, endDate: end });
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      {/* Botao trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors min-w-[180px] justify-between ${
          open
            ? "border border-primary bg-primary/10 text-foreground"
            : "border border-border/50 bg-card text-foreground hover:border-primary/40"
        }`}
      >
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          {triggerLabel}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Popover — abre direto no calendario */}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-2">
          <RangeCalendar
            initialStart={customDate || todayISO()}
            initialEnd={customDateEnd || customDate || todayISO()}
            onApply={handleApplyRange}
            onCancel={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

// ── Hooks e utilitarios ──────────────────────────────────────────

export function usePeriod() {
  const [period, setPeriod] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || "7d"; } catch { return "7d"; }
  });
  const [customDate, setCustomDate] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_DATE) || ""; } catch { return ""; }
  });
  const [customDateEnd, setCustomDateEnd] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_DATE_END) || ""; } catch { return ""; }
  });
  return [period, setPeriod, customDate, setCustomDate, customDateEnd, setCustomDateEnd] as const;
}

export function periodToDays(period: string): number {
  const opt = presets.find((o) => o.value === period);
  return opt?.days ?? 0;
}

export function periodLabel(period: string, customDate?: string, customDateEnd?: string): string {
  if (period === "custom" && customDate) {
    return formatRangeLabel(customDate, customDateEnd || customDate);
  }
  const opt = presets.find((o) => o.value === period);
  return opt?.label ?? "Hoje";
}

// Retorna [dateFrom, dateTo] para o periodo selecionado (horario Brasilia)
export function periodToDates(
  period: string,
  customDate?: string,
  customDateEnd?: string,
): { dateFrom: string; dateTo: string } {
  const today = todayISO();

  if (period === "today") return { dateFrom: today, dateTo: today };

  if (period === "yesterday") {
    const y = new Date(Date.now() - 3 * 60 * 60 * 1000);
    y.setDate(y.getDate() - 1);
    const yStr = dateToISO(y);
    return { dateFrom: yStr, dateTo: yStr };
  }

  if (period === "custom" && customDate) {
    return { dateFrom: customDate, dateTo: customDateEnd || customDate };
  }

  // 7d / 15d / 30d
  const days = periodToDays(period);
  if (days > 0) {
    const from = new Date(Date.now() - 3 * 60 * 60 * 1000);
    from.setDate(from.getDate() - days + 1);
    return { dateFrom: dateToISO(from), dateTo: today };
  }

  return { dateFrom: today, dateTo: today };
}
