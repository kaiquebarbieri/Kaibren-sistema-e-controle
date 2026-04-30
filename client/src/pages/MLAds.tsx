import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  DollarSign,
  Loader2,
  Package,
  RefreshCw,
  ShoppingCart,
  Target,
  TrendingUp,
  ArrowUpRight,
  Store,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtK(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toLocaleString("pt-BR");
}

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

export default function MLAds() {
  const { data: dash, isLoading, refetch } = trpc.mlAds.dashboard.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
  });

  const [selectedAccount, setSelectedAccount] = useState<string>("all");

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-[3px] border-yellow-500/20 border-t-yellow-500 animate-spin" />
            <div className="absolute inset-2 rounded-full border-[3px] border-transparent border-b-yellow-400/40 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
            <Target className="absolute inset-0 m-auto h-5 w-5 text-yellow-500/50" />
          </div>
          <span className="text-sm text-white/30 tracking-wide">Carregando ML Ads...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (!dash) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <Target className="h-12 w-12 text-white/10" />
          <p className="text-white/30 text-sm">Nenhuma conta ML conectada</p>
        </div>
      </DashboardLayout>
    );
  }

  const accountsToShow = selectedAccount === "all" ? dash.accounts : dash.accounts.filter((a: any) => a.account === selectedAccount);

  // Merge daily sales de contas selecionadas
  const dailyMap = new Map<string, { gmv: number; orders: number }>();
  for (const acc of accountsToShow) {
    for (const d of (acc.salesDaily || [])) {
      const existing = dailyMap.get(d.date) || { gmv: 0, orders: 0 };
      existing.gmv += d.gmv;
      existing.orders += d.orders;
      dailyMap.set(d.date, existing);
    }
  }
  const dailyData = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date: date.slice(5), // MM-DD
      gmv: Math.round(d.gmv * 100) / 100,
      orders: d.orders,
      avgTicket: d.orders > 0 ? Math.round((d.gmv / d.orders) * 100) / 100 : 0,
    }));

  const totalGmv = accountsToShow.reduce((s: number, a: any) => s + a.salesSummary.gmv, 0);
  const totalOrders = accountsToShow.reduce((s: number, a: any) => s + a.salesSummary.orders, 0);
  const avgTicket = totalOrders > 0 ? Math.round((totalGmv / totalOrders) * 100) / 100 : 0;
  const totalActiveItems = accountsToShow.reduce((s: number, a: any) => s + a.activeItems, 0);

  // Top items merge
  const topItemsMap = new Map<string, { title: string; orders: number; gmv: number }>();
  for (const acc of accountsToShow) {
    for (const item of (acc.topItems || [])) {
      const existing = topItemsMap.get(item.title);
      if (existing) {
        existing.orders += item.orders;
        existing.gmv += item.gmv;
      } else {
        topItemsMap.set(item.title, { ...item });
      }
    }
  }
  const topItems = Array.from(topItemsMap.values())
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10);

  // Calcular tendência (últimos 7 dias vs 7 anteriores)
  const last7 = dailyData.slice(-7);
  const prev7 = dailyData.slice(-14, -7);
  const last7Gmv = last7.reduce((s, d) => s + d.gmv, 0);
  const prev7Gmv = prev7.reduce((s, d) => s + d.gmv, 0);
  const trendPct = prev7Gmv > 0 ? Math.round(((last7Gmv - prev7Gmv) / prev7Gmv) * 100) : 0;

  // Ads API data (se disponível)
  const hasAds = dash.hasAdsApiAccess;
  const adsTotal = accountsToShow.reduce((s: number, a: any) => ({
    cost: s + (a.adsData?.totalCost || 0),
    revenue: s + (a.adsData?.totalRevenue || 0),
    clicks: s + (a.adsData?.totalClicks || 0),
    prints: s + (a.adsData?.totalPrints || 0),
  }), { cost: 0, revenue: 0, clicks: 0, prints: 0 } as any);

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-20">

        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shadow-yellow-500/25">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                ML Ads
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                  Mercado Livre
                </span>
              </h1>
              <p className="text-xs text-white/30">Performance de vendas — ultimos 30 dias</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
              className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70 outline-none"
            >
              <option value="all">Todas as contas</option>
              {dash.accounts.map((a: any) => (
                <option key={a.account} value={a.account}>{a.account}</option>
              ))}
            </select>
            <button onClick={() => refetch()} className="p-2.5 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 transition-all">
              <RefreshCw className="h-4 w-4 text-white/50" />
            </button>
          </div>
        </div>

        {/* ═══ API Notice ═══ */}
        {!hasAds && (
          <div className="rounded-xl p-4 bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">API de Ads pendente</p>
              <p className="text-xs text-amber-300/60 mt-1">
                O app NoahSocial precisa de autorizacao no Developer Portal do ML para acessar metricas de Ads (custo, cliques, ROAS).
                Por enquanto, mostrando dados de vendas do banco de dados.
              </p>
            </div>
          </div>
        )}

        {/* ═══ HERO KPIs ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl p-5 bg-gradient-to-br from-green-500/10 to-emerald-600/5 border border-green-500/15">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 text-green-400" />
              <span className="text-[11px] text-green-300/60 uppercase tracking-wider font-medium">Faturamento</span>
            </div>
            <p className="text-2xl font-bold text-green-400">{fmt(totalGmv)}</p>
            {trendPct !== 0 && (
              <p className={`text-[10px] mt-1 flex items-center gap-1 ${trendPct > 0 ? "text-green-400/60" : "text-red-400/60"}`}>
                <ArrowUpRight className={`h-3 w-3 ${trendPct < 0 ? "rotate-90" : ""}`} />
                {trendPct > 0 ? "+" : ""}{trendPct}% vs semana anterior
              </p>
            )}
          </div>
          <div className="rounded-2xl p-5 bg-gradient-to-br from-blue-500/10 to-indigo-600/5 border border-blue-500/15">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="h-4 w-4 text-blue-400" />
              <span className="text-[11px] text-blue-300/60 uppercase tracking-wider font-medium">Pedidos</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{fmtK(totalOrders)}</p>
            <p className="text-[10px] text-blue-300/30 mt-1">{(totalOrders / 30).toFixed(1)} pedidos/dia</p>
          </div>
          <div className="rounded-2xl p-5 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/15">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-purple-400" />
              <span className="text-[11px] text-purple-300/60 uppercase tracking-wider font-medium">Ticket Medio</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">{fmt(avgTicket)}</p>
            <p className="text-[10px] text-purple-300/30 mt-1">Media por pedido</p>
          </div>
          <div className="rounded-2xl p-5 bg-gradient-to-br from-yellow-500/10 to-amber-600/5 border border-yellow-500/15">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-yellow-400" />
              <span className="text-[11px] text-yellow-300/60 uppercase tracking-wider font-medium">Anuncios Ativos</span>
            </div>
            <p className="text-2xl font-bold text-yellow-400">{totalActiveItems}</p>
            <p className="text-[10px] text-yellow-300/30 mt-1">Itens publicados</p>
          </div>
        </div>

        {/* ═══ GRAFICOS ═══ */}
        {dailyData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Faturamento diário */}
            <div className="rounded-2xl p-5 bg-[#1a1a2e]/40 border border-white/[0.04]">
              <h3 className="text-sm font-semibold text-white/60 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-green-500 to-emerald-500" />
                Faturamento Diario
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="mlGmvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip fmtFn={(v: number, key: string) => key === "orders" ? `${v}` : fmt(v)} />} />
                  <Area type="monotone" dataKey="gmv" name="Faturamento" stroke="#22c55e" fill="url(#mlGmvGrad)" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Pedidos diários */}
            <div className="rounded-2xl p-5 bg-[#1a1a2e]/40 border border-white/[0.04]">
              <h3 className="text-sm font-semibold text-white/60 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-blue-500 to-indigo-500" />
                Pedidos Diarios
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyData}>
                  <defs>
                    <linearGradient id="mlOrdGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip fmtFn={(v: number) => `${v} pedidos`} />} />
                  <Bar dataKey="orders" name="Pedidos" fill="url(#mlOrdGrad)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ═══ POR CONTA ═══ */}
        {selectedAccount === "all" && dash.accounts.length > 1 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white/50 flex items-center gap-2">
              <Store className="h-4 w-4" />
              Performance por Conta
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {dash.accounts.map((acc: any) => {
                const pctOfTotal = totalGmv > 0 ? Math.round((acc.salesSummary.gmv / totalGmv) * 100) : 0;
                return (
                  <div
                    key={acc.account}
                    className="rounded-2xl p-5 bg-[#1a1a2e]/40 border border-white/[0.04] hover:border-yellow-500/20 transition-all cursor-pointer"
                    onClick={() => setSelectedAccount(acc.account)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-bold text-white/80">{acc.account}</span>
                      <span className="text-[10px] text-white/20">{acc.activeItems} itens</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-white/30">Faturamento</span>
                          <span className="text-yellow-400/60">{pctOfTotal}%</span>
                        </div>
                        <p className="text-lg font-bold text-green-400">{fmt(acc.salesSummary.gmv)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-white/30">Pedidos</span>
                          <p className="font-bold text-blue-400">{acc.salesSummary.orders}</p>
                        </div>
                        <div>
                          <span className="text-white/30">Ticket Medio</span>
                          <p className="font-bold text-purple-400">{fmt(acc.salesSummary.avgTicket)}</p>
                        </div>
                      </div>
                      {/* Mini bar showing share */}
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-400 transition-all"
                          style={{ width: `${pctOfTotal}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ TOP ITENS ═══ */}
        {topItems.length > 0 && (
          <div className="rounded-2xl p-5 bg-[#1a1a2e]/40 border border-white/[0.04]">
            <h3 className="text-sm font-semibold text-white/50 mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Top Itens Vendidos
              <span className="text-[10px] text-white/20 ml-auto">ultimos 30 dias</span>
            </h3>
            <div className="space-y-2">
              {topItems.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-white/[0.02] transition-all">
                  <span className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-bold text-white/30">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70 truncate">{item.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-green-400">{fmt(item.gmv)}</p>
                    <p className="text-[10px] text-white/30">{item.orders} vendas</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
