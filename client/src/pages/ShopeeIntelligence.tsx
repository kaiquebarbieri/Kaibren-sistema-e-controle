import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import PeriodFilter, { usePeriod, periodToDates } from "@/components/PeriodFilter";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  DollarSign,
  Download,
  Eye,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Send,
  ShoppingCart,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  BarChart3,
  Wallet,
  Flame,
  Store,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtK(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toLocaleString("pt-BR");
}

/* ── Custom Tooltip ── */
function ChartTooltip({ active, payload, label, fmtFn }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1a2e]/95 backdrop-blur-lg px-4 py-3 shadow-2xl">
      <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2">{label}</p>
      {payload.map((e: any, i: number) => (
        <div key={i} className="flex items-center gap-2.5 text-sm mb-0.5">
          <span className="w-2.5 h-2.5 rounded-full shadow-lg" style={{ backgroundColor: e.color, boxShadow: `0 0 8px ${e.color}50` }} />
          <span className="text-white/50">{e.name}:</span>
          <span className="font-bold text-white">{fmtFn ? fmtFn(e.value, e.dataKey) : e.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function ShopeeIntelligence() {
  const { data: shops = [] } = trpc.shopeeAds.shops.useQuery();
  const [selectedShopId, setSelectedShopId] = useState<string | undefined>(undefined);

  // Quando shops carregar pela primeira vez, fixa a primeira como selecionada
  useEffect(() => {
    if (!selectedShopId && shops.length > 0) {
      setSelectedShopId(shops[0].shopId);
    }
  }, [shops, selectedShopId]);

  const { data: dash, isLoading, refetch } = trpc.shopeeAds.dashboard.useQuery(
    { shopId: selectedShopId },
    { refetchInterval: 5 * 60 * 1000, enabled: shops.length === 0 || !!selectedShopId },
  );

  const analyzeMutation = trpc.shopeeAds.analyze.useMutation();
  const askMutation = trpc.shopeeAds.askAi.useMutation();
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; text: string }>>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [samOpen, setSamOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [period, setPeriod, customDate, setCustomDate, customDateEnd, setCustomDateEnd] = usePeriod();

  function handleDownloadPdf() {
    setPdfLoading(true);
    fetch("/api/shopee-ads/pdf")
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `shopee-ads-${new Date().toISOString().slice(0,10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(err => console.error("PDF error:", err))
      .finally(() => setPdfLoading(false));
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  function handleAsk() {
    if (!question.trim()) return;
    const q = question.trim();
    setChatHistory(prev => [...prev, { role: "user", text: q }]);
    setQuestion("");
    askMutation.mutate({ question: q, shopId: selectedShopId }, {
      onSuccess: (res) => {
        setChatHistory(prev => [...prev, { role: "assistant", text: res.answer }]);
      },
    });
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-[3px] border-orange-500/20 border-t-orange-500 animate-spin" />
            <div className="absolute inset-2 rounded-full border-[3px] border-transparent border-b-orange-400/40 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
            <Target className="absolute inset-0 m-auto h-5 w-5 text-orange-500/50" />
          </div>
          <span className="text-sm text-white/30 tracking-wide">Carregando Shopee Ads...</span>
        </div>
      </DashboardLayout>
    );
  }

  const dailyPerf = dash?.dailyPerformance || [];
  const alerts = dash?.alerts || [];

  function toISO(d: string) {
    if (!d) return "";
    const parts = d.split("-");
    if (parts[0].length === 4) return d;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  const { dateFrom, dateTo } = periodToDates(period, customDate, customDateEnd);
  const filtered = dailyPerf.filter((d: any) => {
    const iso = toISO(d.date);
    return iso >= dateFrom && iso <= dateTo;
  });
  const totalExpense = filtered.reduce((s: number, d: any) => s + (d.expense || 0), 0);
  const totalDirectGmv = filtered.reduce((s: number, d: any) => s + (d.directGmv || 0), 0);
  const totalClicks = filtered.reduce((s: number, d: any) => s + (d.clicks || 0), 0);
  const totalImpressions = filtered.reduce((s: number, d: any) => s + (d.impressions || 0), 0);
  const totalOrders = filtered.reduce((s: number, d: any) => s + (d.directOrders || 0), 0);
  const roas = totalExpense > 0 ? +(totalDirectGmv / totalExpense).toFixed(1) : 0;
  const ctr = totalImpressions > 0 ? +((totalClicks / totalImpressions) * 100).toFixed(2) : 0;
  const cpc = totalClicks > 0 ? +(totalExpense / totalClicks).toFixed(2) : 0;
  const lucroAds = totalDirectGmv - totalExpense;

  const roasColor = roas >= 4 ? "#22c55e" : roas >= 2 ? "#eab308" : "#ef4444";
  const roasLabel = roas >= 4 ? "Excelente" : roas >= 2 ? "Moderado" : "Critico";

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-20">

        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Shopee Ads
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> LIVE
                </span>
              </h1>
              <p className="text-xs text-white/30">Performance e retorno dos anuncios</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {shops.length > 1 && (
              <div className="relative flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8">
                <Store className="h-4 w-4 text-orange-400" />
                <select
                  value={selectedShopId || ""}
                  onChange={(e) => setSelectedShopId(e.target.value)}
                  className="bg-transparent text-xs text-white/80 font-medium pr-1 outline-none cursor-pointer"
                >
                  {shops.map((s: any) => (
                    <option key={s.shopId} value={s.shopId} className="bg-[#1a1a2e] text-white">
                      {s.shopName}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <PeriodFilter value={period} onChange={setPeriod} customDate={customDate} customDateEnd={customDateEnd} onCustomDate={setCustomDate} onCustomDateEnd={setCustomDateEnd} />
            <button onClick={() => refetch()} className="p-2.5 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 transition-all"><RefreshCw className="h-4 w-4 text-white/50" /></button>
            <button onClick={handleDownloadPdf} disabled={pdfLoading} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 text-xs text-white/50 transition-all disabled:opacity-50">
              {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
            </button>
          </div>
        </div>

        {/* ═══ HERO — ROAS + Resumo ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">

          {/* ROAS Card grande */}
          <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/[0.06]">
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-[80px] pointer-events-none" style={{ background: `${roasColor}15` }} />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="h-5 w-5" style={{ color: roasColor }} />
                <span className="text-sm font-medium text-white/50">Retorno sobre Ads</span>
                <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: `${roasColor}20`, color: roasColor, border: `1px solid ${roasColor}30` }}>
                  {roasLabel}
                </span>
              </div>
              <div className="flex items-end gap-3 mb-4">
                <span className="text-6xl font-black tracking-tighter" style={{ color: roasColor }}>{roas}</span>
                <span className="text-2xl font-bold text-white/30 mb-2">x</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {lucroAds >= 0 ? (
                  <span className="flex items-center gap-1 text-green-400"><ArrowUpRight className="h-4 w-4" /> {fmt(lucroAds)} lucro</span>
                ) : (
                  <span className="flex items-center gap-1 text-red-400"><ArrowDownRight className="h-4 w-4" /> {fmt(Math.abs(lucroAds))} prejuizo</span>
                )}
                <span className="text-white/20">|</span>
                <span className="text-white/40">Cada R$1 investido retorna R${roas > 0 ? roas.toFixed(2) : "0"}</span>
              </div>
            </div>
          </div>

          {/* Grid 2x2 resumo financeiro */}
          <div className="grid grid-cols-2 gap-3">
            {/* Saldo */}
            <div className="rounded-2xl p-5 bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/15">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="h-4 w-4 text-orange-400" />
                <span className="text-[11px] text-orange-300/60 uppercase tracking-wider font-medium">Saldo</span>
              </div>
              <p className="text-2xl font-bold text-orange-400">{dash?.balance != null ? fmt(dash.balance) : "—"}</p>
              <p className="text-[10px] text-orange-300/30 mt-1">Creditos disponiveis</p>
            </div>
            {/* Gasto */}
            <div className="rounded-2xl p-5 bg-gradient-to-br from-red-500/8 to-red-600/3 border border-red-500/12">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-4 w-4 text-red-400" />
                <span className="text-[11px] text-red-300/60 uppercase tracking-wider font-medium">Investido</span>
              </div>
              <p className="text-2xl font-bold text-red-400">{fmt(totalExpense)}</p>
              <p className="text-[10px] text-red-300/30 mt-1">Total gasto no periodo</p>
            </div>
            {/* Vendas */}
            <div className="rounded-2xl p-5 bg-gradient-to-br from-green-500/8 to-emerald-600/3 border border-green-500/12">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span className="text-[11px] text-green-300/60 uppercase tracking-wider font-medium">Vendas</span>
              </div>
              <p className="text-2xl font-bold text-green-400">{fmt(totalDirectGmv)}</p>
              <p className="text-[10px] text-green-300/30 mt-1">Receita via Ads</p>
            </div>
            {/* Pedidos */}
            <div className="rounded-2xl p-5 bg-gradient-to-br from-blue-500/8 to-indigo-600/3 border border-blue-500/12">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingCart className="h-4 w-4 text-blue-400" />
                <span className="text-[11px] text-blue-300/60 uppercase tracking-wider font-medium">Pedidos</span>
              </div>
              <p className="text-2xl font-bold text-blue-400">{totalOrders}</p>
              <p className="text-[10px] text-blue-300/30 mt-1">Conversoes no periodo</p>
            </div>
          </div>
        </div>

        {/* ═══ METRICAS DE TRAFEGO ═══ */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-4 bg-[#1a1a2e]/60 border border-white/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-white/30 uppercase tracking-wider">CPC</span>
              <MousePointerClick className="h-3.5 w-3.5 text-purple-400/60" />
            </div>
            <p className="text-xl font-bold text-purple-400">{fmt(cpc)}</p>
          </div>
          <div className="rounded-xl p-4 bg-[#1a1a2e]/60 border border-white/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-white/30 uppercase tracking-wider">CTR</span>
              <Eye className="h-3.5 w-3.5 text-cyan-400/60" />
            </div>
            <p className="text-xl font-bold text-cyan-400">{ctr}%</p>
          </div>
          <div className="rounded-xl p-4 bg-[#1a1a2e]/60 border border-white/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Cliques</span>
              <BarChart3 className="h-3.5 w-3.5 text-white/20" />
            </div>
            <p className="text-xl font-bold text-white/80">{fmtK(totalClicks)}</p>
            <p className="text-[10px] text-white/20 mt-0.5">{fmtK(totalImpressions)} impressoes</p>
          </div>
        </div>

        {/* ═══ ALERTAS ═══ */}
        {alerts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {alerts.map((a: any, i: number) => {
              const c = a.level === "red" ? { bg: "bg-red-500/8", border: "border-red-500/15", text: "text-red-400" } :
                a.level === "yellow" ? { bg: "bg-yellow-500/8", border: "border-yellow-500/15", text: "text-yellow-400" } :
                { bg: "bg-green-500/8", border: "border-green-500/15", text: "text-green-400" };
              return (
                <div key={i} className={`flex items-center gap-2 text-xs px-3.5 py-2 rounded-xl border ${c.bg} ${c.border} ${c.text}`}>
                  {a.level === "red" ? <XCircle className="h-3.5 w-3.5" /> : a.level === "yellow" ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {a.message}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ ADS vs ORGANICO ═══ */}
        {(() => {
          const salesDb = dash?.dailySalesDb || [];
          const salesMap = new Map<string, { gmv: number; orders: number }>();
          for (const s of salesDb) salesMap.set(s.date, { gmv: s.gmv, orders: s.orders });

          const adsData = filtered.length > 0 ? filtered : dailyPerf;

          // Calcular organico dia-a-dia (evita distorcao de dias com sync incompleto)
          let totalDbGmv = 0, totalOrgGmv = 0, totalOrgOrders = 0;
          let totalAdsGmvShow = 0, totalAdsOrdersShow = 0, totalDbOrders = 0;

          const combined = adsData.map((d: any) => {
            const db = salesMap.get(d.date) || { gmv: 0, orders: 0 };
            const adsOrd = Math.min(d.directOrders || 0, db.orders); // cap ads <= DB
            const orgOrd = Math.max(0, db.orders - adsOrd);
            const orgGmv = db.orders > 0 ? Math.round((orgOrd / db.orders) * db.gmv * 100) / 100 : 0;
            const adsGmv = db.gmv - orgGmv;

            totalDbGmv += db.gmv;
            totalDbOrders += db.orders;
            totalOrgGmv += orgGmv;
            totalOrgOrders += orgOrd;
            totalAdsGmvShow += adsGmv;
            totalAdsOrdersShow += adsOrd;

            return { date: d.date, ads: Math.round(adsGmv * 100) / 100, organic: orgGmv, total: db.gmv };
          });

          const pctAds = totalDbOrders > 0 ? Math.round((totalAdsOrdersShow / totalDbOrders) * 100) : 0;
          const pctOrg = totalDbOrders > 0 ? 100 - pctAds : 0;

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Total vendido */}
                <div className="rounded-2xl p-5 bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-3">
                    <ShoppingCart className="h-4 w-4 text-white/40" />
                    <span className="text-[11px] text-white/30 uppercase tracking-wider font-medium">Total Vendido</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{fmt(totalDbGmv)}</p>
                  <p className="text-[10px] text-white/20 mt-1">{totalDbOrders} pedidos no periodo</p>
                </div>
                {/* Via Ads */}
                <div className="rounded-2xl p-5 bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/15">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-orange-400" />
                    <span className="text-[11px] text-orange-300/60 uppercase tracking-wider font-medium">Via Ads</span>
                    {pctAds > 0 && <span className="ml-auto text-xs font-bold text-orange-400 bg-orange-500/15 px-2 py-0.5 rounded-lg">{pctAds}%</span>}
                  </div>
                  <p className="text-2xl font-bold text-orange-400">{fmt(totalAdsGmvShow)}</p>
                  <p className="text-[10px] text-orange-300/30 mt-1">{totalAdsOrdersShow} pedidos via anuncios</p>
                </div>
                {/* Organico */}
                <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/15">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    <span className="text-[11px] text-emerald-300/60 uppercase tracking-wider font-medium">Organico</span>
                    {pctOrg > 0 && <span className="ml-auto text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-lg">{pctOrg}%</span>}
                  </div>
                  <p className="text-2xl font-bold text-emerald-400">{fmt(totalOrgGmv)}</p>
                  <p className="text-[10px] text-emerald-300/30 mt-1">{totalOrgOrders} pedidos organicos</p>
                </div>
              </div>

              {/* Barra de proporcao */}
              {totalDbOrders > 0 && (
                <div className="rounded-xl p-4 bg-[#1a1a2e]/40 border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-white/30 uppercase tracking-wider">Proporcao Ads vs Organico (por pedidos)</span>
                  </div>
                  <div className="flex h-4 rounded-full overflow-hidden bg-white/5">
                    {pctAds > 0 && <div className="bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500" style={{ width: `${pctAds}%` }} />}
                    {pctOrg > 0 && <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500" style={{ width: `${pctOrg}%` }} />}
                  </div>
                  <div className="flex justify-between mt-2 text-[10px]">
                    <span className="text-orange-400">Ads {pctAds}% ({totalAdsOrdersShow} ped)</span>
                    <span className="text-emerald-400">Organico {pctOrg}% ({totalOrgOrders} ped)</span>
                  </div>
                </div>
              )}

              {/* Grafico Ads vs Organico diario */}
              {combined.some(c => c.total > 0) && (
                <div className="rounded-2xl p-5 bg-[#1a1a2e]/40 border border-white/[0.04]">
                  <h3 className="text-sm font-semibold text-white/60 mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-orange-500 to-emerald-500" />
                    Ads vs Organico — Diario
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={combined.filter(c => c.total > 0)}>
                      <defs>
                        <linearGradient id="gAds" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
                          <stop offset="100%" stopColor="#f97316" stopOpacity={0.3} />
                        </linearGradient>
                        <linearGradient id="gOrg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.3} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip fmtFn={(v: number) => fmt(v)} />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />
                      <Bar dataKey="ads" name="Via Ads" fill="url(#gAds)" stackId="a" radius={[0, 0, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="organic" name="Organico" fill="url(#gOrg)" stackId="a" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══ GRAFICOS ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gasto vs Vendas */}
          <div className="rounded-2xl p-5 bg-[#1a1a2e]/40 border border-white/[0.04]">
            <h3 className="text-sm font-semibold text-white/60 mb-4 flex items-center gap-2">
              <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-red-500 to-green-500" />
              Gasto vs Vendas
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={filtered.length > 0 ? filtered : dailyPerf}>
                <defs>
                  <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip fmtFn={(v: number) => fmt(v)} />} />
                <Area type="monotone" dataKey="expense" name="Gasto" stroke="#ef4444" fill="url(#gE)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#ef4444", stroke: "#ef444440", strokeWidth: 4 }} />
                <Area type="monotone" dataKey="directGmv" name="Vendas" stroke="#22c55e" fill="url(#gV)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#22c55e", stroke: "#22c55e40", strokeWidth: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ROAS Diario */}
          <div className="rounded-2xl p-5 bg-[#1a1a2e]/40 border border-white/[0.04]">
            <h3 className="text-sm font-semibold text-white/60 mb-4 flex items-center gap-2">
              <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-orange-500 to-amber-500" />
              ROAS Diario
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={filtered.length > 0 ? filtered : dailyPerf}>
                <defs>
                  <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip fmtFn={(v: number) => `${v}x`} />} />
                <Bar dataKey="directRoas" name="ROAS" fill="url(#gR)" radius={[8, 8, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cliques + Impressoes — full width */}
        <div className="rounded-2xl p-5 bg-[#1a1a2e]/40 border border-white/[0.04]">
          <h3 className="text-sm font-semibold text-white/60 mb-4 flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-cyan-500 to-purple-500" />
            Cliques e Impressoes
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={filtered.length > 0 ? filtered : dailyPerf}>
              <defs>
                <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="r" orientation="right" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, opacity: 0.5 }} />
              <Area yAxisId="r" type="monotone" dataKey="impressions" name="Impressoes" stroke="#8b5cf6" fill="url(#gI)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#8b5cf6", stroke: "#8b5cf640", strokeWidth: 4 }} />
              <Area yAxisId="l" type="monotone" dataKey="clicks" name="Cliques" stroke="#06b6d4" fill="url(#gC)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#06b6d4", stroke: "#06b6d440", strokeWidth: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ═══ SAM — Chat flutuante ═══ */}
        <div className="fixed bottom-4 right-4 z-50">
          {samOpen ? (
            <div className="w-[380px] rounded-2xl border border-white/[0.08] bg-[#12121f]/98 backdrop-blur-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden" style={{ maxHeight: "min(520px, 70vh)" }}>
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.05] cursor-pointer bg-gradient-to-r from-orange-600/10 to-transparent" onClick={() => setSamOpen(false)}>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <Bot className="h-4.5 w-4.5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">Sam</p>
                  <p className="text-[10px] text-white/25">Analista de Performance</p>
                </div>
                <span className="text-[10px] text-white/20 hover:text-white/60 transition-colors">fechar</span>
              </div>
              <div className="flex flex-col flex-1 min-h-0 p-4 space-y-3">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ minHeight: 150, maxHeight: 280 }}>
                  {chatHistory.length === 0 && !analyzeMutation.isPending && (
                    <div className="text-center py-10">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/15 to-red-500/10 flex items-center justify-center mx-auto mb-3">
                        <Sparkles className="h-6 w-6 text-orange-400/50" />
                      </div>
                      <p className="text-sm text-white/25">Pergunte sobre seus ads</p>
                      <p className="text-[10px] text-white/15 mt-1">Sam analisa seus dados em tempo real</p>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`text-sm ${msg.role === "user" ? "text-right" : ""}`}>
                      {msg.role === "user" ? (
                        <div className="inline-block bg-orange-500/12 border border-orange-500/10 rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[90%] text-left">{msg.text}</div>
                      ) : (
                        <div className="bg-white/[0.03] border border-white/[0.04] rounded-2xl rounded-bl-sm px-4 py-2.5 whitespace-pre-wrap leading-relaxed text-white/70">{msg.text}</div>
                      )}
                    </div>
                  ))}
                  {(askMutation.isPending || analyzeMutation.isPending) && (
                    <div className="flex items-center gap-2 text-sm text-orange-400/60"><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {["Melhorar ROAS", "Budget ideal?", "Resumo"].map((s) => (
                    <button key={s} onClick={() => { setChatHistory(prev => [...prev, { role: "user", text: s }]); askMutation.mutate({ question: s }, { onSuccess: (res) => setChatHistory(prev => [...prev, { role: "assistant", text: res.answer }]) }); }} disabled={askMutation.isPending} className="text-[11px] px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] hover:bg-orange-500/10 hover:border-orange-500/15 text-white/30 hover:text-orange-400 transition-all disabled:opacity-40">{s}</button>
                  ))}
                </div>
                <div className="flex gap-2 shrink-0">
                  <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAsk()} placeholder="Pergunte ao Sam..." className="flex-1 bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/25 transition-all placeholder:text-white/15" />
                  <button onClick={handleAsk} disabled={askMutation.isPending || !question.trim()} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white disabled:opacity-40 transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30"><Send className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={() => setSamOpen(true)} className="group flex items-center gap-2.5 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-2xl shadow-orange-500/30 transition-all hover:shadow-orange-500/50 hover:scale-105 hover:-translate-y-1">
              <Bot className="h-5 w-5" />
              <span className="text-sm font-bold">Sam</span>
              <span className="w-2 h-2 rounded-full bg-white/80 animate-pulse" />
            </button>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
