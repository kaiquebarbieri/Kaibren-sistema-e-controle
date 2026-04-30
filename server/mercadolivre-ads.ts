/**
 * Mercado Livre Ads — Dashboard de Performance
 *
 * A API de Product Ads v2 (/marketplace/advertising/MLB/...) requer
 * autorização especial do app no Developer Portal do ML.
 *
 * Por enquanto, usamos dados do banco (pedidos ML) + visitas de itens
 * para montar o dashboard. Quando o endpoint `/marketplace/advertising/`
 * estiver autorizado, os dados de ads (custo, cliques, ROAS real) serão integrados.
 */

import { getAccounts, type MLAccount } from "./mercadolivre";
import { rawQuery } from "./db";

const ML_API = "https://api.mercadolibre.com";

// ── Token Refresh ──

async function refreshToken(account: MLAccount): Promise<void> {
  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ML_APP_ID!,
      client_secret: process.env.ML_CLIENT_SECRET!,
      refresh_token: account.refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed for ${account.name}: ${res.status}`);
  const data = await res.json();
  account.accessToken = data.access_token;
  account.refreshToken = data.refresh_token;
  const prefix = account.name === "CLICKMULTII" ? "ML_CLICKMULTII"
    : account.name === "DUOULTILIDADE" ? "ML_DUOULTILIDADE" : "ML_KAIBRENLTDA";
  process.env[`${prefix}_ACCESS_TOKEN`] = data.access_token;
  process.env[`${prefix}_REFRESH_TOKEN`] = data.refresh_token;
}

async function mlApiFetch(account: MLAccount, url: string, retried = false): Promise<any> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${account.accessToken}` },
  });
  if (res.status === 401 && !retried) {
    await refreshToken(account);
    return mlApiFetch(account, url, true);
  }
  if (!res.ok) return null;
  const text = await res.text();
  if (!text || text.trim() === "") return null;
  try { return JSON.parse(text); } catch { return null; }
}

// ── Ads API (novo endpoint /marketplace/) — tenta, mas pode falhar ──

async function tryGetAdsCampaigns(account: MLAccount, dateFrom: string, dateTo: string): Promise<any[] | null> {
  try {
    const url = `${ML_API}/marketplace/advertising/MLB/advertisers/${account.userId}/product_ads/campaigns/search?limit=50&date_from=${dateFrom}&date_to=${dateTo}&metrics=clicks,prints,cost,cpc,ctr,acos,roas,direct_amount,indirect_amount,direct_units_quantity,indirect_units_quantity,total_amount,units_quantity`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "api-version": "2",
      },
    });
    if (res.status === 401) {
      // Try token refresh once
      await refreshToken(account);
      const res2 = await fetch(url, {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          "api-version": "2",
        },
      });
      if (!res2.ok) return null;
      const text = await res2.text();
      if (!text || text.trim() === "") return null;
      const data = JSON.parse(text);
      return data.results || data || [];
    }
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim() === "") return null;
    const data = JSON.parse(text);
    return data.results || data || [];
  } catch {
    return null;
  }
}

// ── DB Queries ──

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Vendas diarias ML do DB */
async function getDailyMLSalesFromDb(accountName: string, days: number): Promise<Array<{ date: string; gmv: number; orders: number }>> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startStr = startDate.toISOString().slice(0, 10);

    const rows = await rawQuery<{ date: string; gmv: number; orders: number }>(
      `SELECT DATE(platformCreatedAt) as date,
              ROUND(COALESCE(SUM(totalAmount), 0), 2) as gmv,
              COUNT(*) as orders
       FROM marketplace_orders
       WHERE platform = 'ml' AND status = 'paid' AND accountName = ? AND platformCreatedAt >= ?
       GROUP BY DATE(platformCreatedAt)
       ORDER BY DATE(platformCreatedAt)`,
      [accountName, startStr],
    );

    return rows.map(r => ({ date: String(r.date).slice(0, 10), gmv: Number(r.gmv), orders: Number(r.orders) }));
  } catch {
    return [];
  }
}

/** Resumo de vendas por periodo do DB */
async function getMLSalesSummaryFromDb(accountName: string, dateFrom: string, dateTo: string) {
  try {
    const rows = await rawQuery<{ gmv: number; orders: number; avgTicket: number }>(
      `SELECT ROUND(COALESCE(SUM(totalAmount), 0), 2) as gmv,
              COUNT(*) as orders,
              ROUND(COALESCE(AVG(totalAmount), 0), 2) as avgTicket
       FROM marketplace_orders
       WHERE platform = 'ml' AND status = 'paid' AND accountName = ?
             AND platformCreatedAt >= ? AND platformCreatedAt < DATE_ADD(?, INTERVAL 1 DAY)`,
      [accountName, dateFrom, dateTo],
    );
    return rows[0] || { gmv: 0, orders: 0, avgTicket: 0 };
  } catch {
    return { gmv: 0, orders: 0, avgTicket: 0 };
  }
}

/** Top itens vendidos do DB */
async function getTopItemsFromDb(accountName: string, dateFrom: string, dateTo: string, limit = 10) {
  try {
    const rows = await rawQuery<{ title: string; orders: number; gmv: number }>(
      `SELECT productName as title,
              COUNT(*) as orders,
              ROUND(SUM(totalAmount), 2) as gmv
       FROM marketplace_orders
       WHERE platform = 'ml' AND status = 'paid' AND accountName = ?
             AND platformCreatedAt >= ? AND platformCreatedAt < DATE_ADD(?, INTERVAL 1 DAY)
             AND productName IS NOT NULL AND productName != ''
       GROUP BY productName
       ORDER BY orders DESC
       LIMIT 10`,
      [accountName, dateFrom, dateTo],
    );
    return rows.map(r => ({
      title: String(r.title).slice(0, 80),
      orders: Number(r.orders),
      gmv: Number(r.gmv),
    }));
  } catch {
    return [];
  }
}

/** Contagem de itens ativos via API */
async function getActiveItemsCount(account: MLAccount): Promise<number> {
  try {
    const data = await mlApiFetch(account, `${ML_API}/users/${account.userId}/items/search?status=active&limit=1`);
    return data?.paging?.total || 0;
  } catch {
    return 0;
  }
}

/** Visitas totais dos itens nos últimos N dias */
async function getItemVisits(account: MLAccount, days: number): Promise<number> {
  try {
    const data = await mlApiFetch(account, `${ML_API}/users/${account.userId}/items_visits?last=${days}&unit=day`);
    if (!data || !Array.isArray(data)) return 0;
    return data.reduce((sum: number, d: any) => sum + (d.total || 0), 0);
  } catch {
    return 0;
  }
}

// ── Dashboard Completo ──

export async function getMLAdsDashboard() {
  const accounts = getAccounts();
  if (accounts.length === 0) return null;

  const now = new Date();
  const dateTo = fmtDate(now);
  const dateFrom = fmtDate(new Date(now.getTime() - 29 * 86400000));

  const accountResults = await Promise.allSettled(
    accounts.map(async (acc) => {
      const [salesDaily, salesSummary, topItems, activeItems, adsCampaigns] = await Promise.all([
        getDailyMLSalesFromDb(acc.name, 29),
        getMLSalesSummaryFromDb(acc.name, dateFrom, dateTo),
        getTopItemsFromDb(acc.name, dateFrom, dateTo, 10),
        getActiveItemsCount(acc),
        tryGetAdsCampaigns(acc, dateFrom, dateTo),
      ]);

      // Se a API de ads retornou dados, extrair métricas
      let adsData: {
        hasCampaigns: boolean;
        totalCost: number;
        totalRevenue: number;
        totalClicks: number;
        totalPrints: number;
        totalOrders: number;
        campaigns: any[];
      } = { hasCampaigns: false, totalCost: 0, totalRevenue: 0, totalClicks: 0, totalPrints: 0, totalOrders: 0, campaigns: [] };

      if (adsCampaigns && adsCampaigns.length > 0) {
        adsData.hasCampaigns = true;
        for (const c of adsCampaigns) {
          const m = c.metrics || {};
          adsData.totalCost += (m.cost || 0) / 100;
          adsData.totalRevenue += ((m.direct_amount || 0) + (m.indirect_amount || 0)) / 100;
          adsData.totalClicks += m.clicks || 0;
          adsData.totalPrints += m.prints || 0;
          adsData.totalOrders += (m.direct_units_quantity || 0) + (m.indirect_units_quantity || 0);
        }
        adsData.campaigns = adsCampaigns.slice(0, 15).map((c: any) => ({
          id: c.id || c.campaign_id,
          name: c.name || `Campanha ${c.id}`,
          status: c.status,
          cost: Math.round(((c.metrics?.cost || 0) / 100) * 100) / 100,
          revenue: Math.round((((c.metrics?.direct_amount || 0) + (c.metrics?.indirect_amount || 0)) / 100) * 100) / 100,
          clicks: c.metrics?.clicks || 0,
          roas: c.metrics?.roas || 0,
        }));
      }

      return {
        account: acc.name,
        activeItems,
        salesDaily,
        salesSummary: {
          gmv: Number(salesSummary.gmv),
          orders: Number(salesSummary.orders),
          avgTicket: Number(salesSummary.avgTicket),
        },
        topItems,
        adsData,
      };
    }),
  );

  const accountData = accountResults
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
    .map(r => r.value);

  // Consolidado
  const totalGmv = accountData.reduce((s, a) => s + a.salesSummary.gmv, 0);
  const totalOrders = accountData.reduce((s, a) => s + a.salesSummary.orders, 0);
  const totalActiveItems = accountData.reduce((s, a) => s + a.activeItems, 0);
  const hasAnyAdsData = accountData.some(a => a.adsData.hasCampaigns);

  // Consolidar daily sales
  const dailyMap = new Map<string, { gmv: number; orders: number }>();
  for (const acc of accountData) {
    for (const d of acc.salesDaily) {
      const existing = dailyMap.get(d.date) || { gmv: 0, orders: 0 };
      existing.gmv += d.gmv;
      existing.orders += d.orders;
      dailyMap.set(d.date, existing);
    }
  }
  const dailySales = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, gmv: Math.round(d.gmv * 100) / 100, orders: d.orders }));

  return {
    accounts: accountData,
    hasAdsApiAccess: hasAnyAdsData,
    consolidated: {
      gmv: Math.round(totalGmv * 100) / 100,
      orders: totalOrders,
      avgTicket: totalOrders > 0 ? Math.round((totalGmv / totalOrders) * 100) / 100 : 0,
      activeItems: totalActiveItems,
    },
    dailySales,
    dateRange: { from: dateFrom, to: dateTo },
  };
}
