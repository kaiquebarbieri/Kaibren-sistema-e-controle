/**
 * Mercado Livre API Integration
 * Handles token refresh, order fetching, and sales summaries for 3 accounts.
 * Persists orders + revenue snapshots to DB for offline resilience.
 */

import { getDb } from "./db";
import { marketplaceOrders, revenueSnapshots, mlCatalogProducts } from "../drizzle/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export type MLAccount = {
  name: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
};

type MLOrder = {
  id: number;
  status: string;
  totalAmount: number;
  dateCreated: string;
  buyer: { nickname: string };
  items: Array<{ title: string; quantity: number; unitPrice: number }>;
};

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function getAccounts(): MLAccount[] {
  const accounts: MLAccount[] = [];
  const appId = process.env.ML_APP_ID;
  if (!appId) return accounts;

  const configs = [
    { name: "CLICKMULTII", prefix: "ML_CLICKMULTII" },
    { name: "DUOULTILIDADE", prefix: "ML_DUOULTILIDADE" },
    { name: "KAIBRENLTDA", prefix: "ML_KAIBRENLTDA" },
  ];

  for (const cfg of configs) {
    const userId = process.env[`${cfg.prefix}_USER_ID`];
    const accessToken = process.env[`${cfg.prefix}_ACCESS_TOKEN`];
    const refreshToken = process.env[`${cfg.prefix}_REFRESH_TOKEN`];
    if (userId && accessToken && refreshToken) {
      accounts.push({ name: cfg.name, userId, accessToken, refreshToken });
    }
  }

  return accounts;
}

async function refreshToken(account: MLAccount): Promise<MLAccount> {
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

  if (!res.ok) {
    throw new Error(`Token refresh failed for ${account.name}: ${res.status}`);
  }

  const data = await res.json();
  account.accessToken = data.access_token;
  account.refreshToken = data.refresh_token;

  // Persistir os novos tokens no .env em memória (process.env)
  const prefix = account.name === "CLICKMULTII" ? "ML_CLICKMULTII"
    : account.name === "DUOULTILIDADE" ? "ML_DUOULTILIDADE"
    : "ML_KAIBRENLTDA";
  process.env[`${prefix}_ACCESS_TOKEN`] = data.access_token;
  process.env[`${prefix}_REFRESH_TOKEN`] = data.refresh_token;

  console.log(`[ML] Token renovado para ${account.name}`);
  return account;
}

// Renovação proativa de todos os tokens — chamar a cada 5h
export async function refreshAllMLTokens(): Promise<{ name: string; ok: boolean; error?: string }[]> {
  const accounts = getAccounts();
  const results = [];
  for (const account of accounts) {
    try {
      await refreshToken(account);
      results.push({ name: account.name, ok: true });
    } catch (err: any) {
      console.error(`[ML] Falha ao renovar token de ${account.name}:`, err.message);
      results.push({ name: account.name, ok: false, error: err.message });
    }
  }
  // Limpar cache após renovação
  cache.clear();
  return results;
}

// Cron interno: renovar tokens a cada 5h
let mlTokenCronStarted = false;
export function startMLTokenCron() {
  if (mlTokenCronStarted) return;
  mlTokenCronStarted = true;
  const FIVE_HOURS = 5 * 60 * 60 * 1000;

  // Primeira renovação após 1 minuto do boot
  setTimeout(async () => {
    console.log("[ML Cron] Renovação inicial de tokens...");
    await refreshAllMLTokens();
  }, 60 * 1000);

  // Renovações subsequentes a cada 5h
  setInterval(async () => {
    console.log("[ML Cron] Renovação periódica de tokens (5h)...");
    await refreshAllMLTokens();
  }, FIVE_HOURS);

  console.log("[ML Cron] Token auto-renewal iniciado (intervalo: 5h)");
}

export async function mlFetch(account: MLAccount, url: string, retried = false): Promise<any> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${account.accessToken}` },
  });

  if (res.status === 401 && !retried) {
    await refreshToken(account);
    return mlFetch(account, url, true);
  }

  if (!res.ok) {
    throw new Error(`ML API error for ${account.name}: ${res.status}`);
  }

  return res.json();
}

// ── Persistência no banco ──────────────────────────────────────────

async function persistOrders(accountName: string, orders: MLOrder[]): Promise<void> {
  if (!orders.length) return;
  try {
    for (const o of orders) {
      const externalId = `ML-${o.id}`;
      const item = o.items?.[0];
      await (await getDb())!.insert(marketplaceOrders).values({
        externalId,
        platform: "ml",
        accountName,
        status: o.status,
        statusLabel: o.status === "paid" ? "Pago" : o.status === "shipped" ? "Enviado" : o.status === "delivered" ? "Entregue" : o.status === "cancelled" ? "Cancelado" : o.status,
        buyerName: o.buyer?.nickname ?? "?",
        productName: item?.title ?? "Produto",
        quantity: item?.quantity ?? 1,
        totalAmount: String(o.totalAmount),
        itemsJson: JSON.stringify(o.items),
        platformCreatedAt: new Date(o.dateCreated),
      }).onDuplicateKeyUpdate({
        set: {
          status: sql`VALUES(status)`,
          statusLabel: sql`VALUES(statusLabel)`,
          updatedAt: sql`NOW()`,
        },
      });
    }
  } catch (err) {
    console.error("[ML] Error persisting orders:", err);
  }
}

async function persistRevenueSnapshot(date: string, channel: string, amount: number, ordersCount: number): Promise<void> {
  try {
    await (await getDb())!.insert(revenueSnapshots).values({
      date,
      channel,
      amount: String(amount),
      orders: ordersCount,
    }).onDuplicateKeyUpdate({
      set: {
        amount: sql`VALUES(amount)`,
        orders: sql`VALUES(orders)`,
      },
    });
  } catch (_) {
    // silencioso
  }
}

async function getOrdersFromDB(accountName?: string, dateFrom?: string, dateTo?: string): Promise<{ account: string; orders: MLOrder[]; total: number }[]> {
  try {
    const conditions = [eq(marketplaceOrders.platform, "ml")];
    if (accountName) conditions.push(eq(marketplaceOrders.accountName, accountName));
    if (dateFrom) conditions.push(gte(marketplaceOrders.platformCreatedAt, new Date(`${dateFrom}T00:00:00`)));
    if (dateTo) conditions.push(lte(marketplaceOrders.platformCreatedAt, new Date(`${dateTo}T23:59:59`)));

    const rows = await (await getDb())!.select().from(marketplaceOrders).where(and(...conditions)).limit(100);

    const grouped = new Map<string, MLOrder[]>();
    for (const row of rows) {
      const acc = row.accountName;
      if (!grouped.has(acc)) grouped.set(acc, []);
      grouped.get(acc)!.push({
        id: parseInt(row.externalId.replace("ML-", "")) || 0,
        status: row.status,
        totalAmount: Number(row.totalAmount),
        dateCreated: row.platformCreatedAt.toISOString(),
        buyer: { nickname: row.buyerName },
        items: row.itemsJson ? JSON.parse(row.itemsJson) : [{ title: row.productName, quantity: row.quantity, unitPrice: Number(row.totalAmount) }],
      });
    }

    if (grouped.size === 0) return [];

    return Array.from(grouped.entries()).map(([account, orders]) => ({
      account,
      orders,
      total: orders.length,
    }));
  } catch (err) {
    console.error("[ML] Error reading from DB:", err);
    return [];
  }
}

// ── Busca pedidos (API → persiste → fallback DB) ──────────────────

export async function getMLOrdersPaginated(
  accountName?: string,
  dateFrom?: string,
  dateTo?: string,
  status?: string,
): Promise<{ account: string; orders: MLOrder[]; total: number }[]> {
  const accounts = getAccounts();
  const filtered = accountName ? accounts.filter(a => a.name === accountName) : accounts;
  if (filtered.length === 0) return getOrdersFromDB(accountName, dateFrom, dateTo);

  const results = await Promise.all(filtered.map(async (account) => {
    const allOrders: MLOrder[] = [];
    let offset = 0;
    let totalApi = 0;

    try {
      do {
        const params = new URLSearchParams({
          seller: account.userId, sort: "date_asc", limit: "50", offset: offset.toString(),
        });
        if (dateFrom) params.set("order.date_created.from", `${dateFrom}T00:00:00.000-03:00`);
        if (dateTo) params.set("order.date_created.to", `${dateTo}T23:59:59.999-03:00`);
        if (status) params.set("order.status", status);

        const data = await mlFetch(account, `https://api.mercadolibre.com/orders/search?${params}`);
        totalApi = data.paging?.total ?? 0;

        const batch: MLOrder[] = (data.results ?? []).map((o: any) => ({
          id: o.id, status: o.status, totalAmount: o.total_amount, dateCreated: o.date_created,
          buyer: { nickname: o.buyer?.nickname ?? "?" },
          items: (o.order_items ?? []).map((i: any) => ({ title: i.item?.title ?? "", quantity: i.quantity, unitPrice: i.unit_price })),
        }));

        allOrders.push(...batch);
        offset += 50;
      } while (allOrders.length < totalApi && allOrders.length < 500);

      persistOrders(account.name, allOrders).catch(() => {});
      return { account: account.name, orders: allOrders, total: totalApi };
    } catch (err) {
      console.error(`[ML] Paginated error for ${account.name}:`, err);
      const dbFallback = await getOrdersFromDB(account.name, dateFrom, dateTo);
      return dbFallback.find(d => d.account === account.name) ?? { account: account.name, orders: [], total: 0 };
    }
  }));

  return results;
}

export async function getMLOrders(
  accountName?: string,
  dateFrom?: string,
  dateTo?: string,
  status?: string,
  limit = 50,
  offset = 0,
): Promise<{ account: string; orders: MLOrder[]; total: number }[]> {
  const accounts = getAccounts();
  const filtered = accountName
    ? accounts.filter(a => a.name === accountName)
    : accounts;

  // Se não há contas configuradas, ler direto do banco
  if (filtered.length === 0) {
    const dbOrders = await getOrdersFromDB(accountName, dateFrom, dateTo);
    if (dbOrders.length > 0) return dbOrders;
    return [];
  }

  const results = await Promise.all(
    filtered.map(async (account) => {
      const cacheKey = `orders:${account.name}:${dateFrom}:${dateTo}:${status}:${limit}:${offset}`;
      const cached = getCached<{ orders: MLOrder[]; total: number }>(cacheKey);
      if (cached) return { account: account.name, ...cached };

      const params = new URLSearchParams({
        seller: account.userId,
        sort: "date_desc",
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (dateFrom) params.set("order.date_created.from", `${dateFrom}T00:00:00.000-03:00`);
      if (dateTo) params.set("order.date_created.to", `${dateTo}T23:59:59.999-03:00`);
      if (status) params.set("order.status", status);

      try {
        const data = await mlFetch(
          account,
          `https://api.mercadolibre.com/orders/search?${params}`,
        );

        const orders: MLOrder[] = (data.results ?? []).map((o: any) => ({
          id: o.id,
          status: o.status,
          totalAmount: o.total_amount,
          dateCreated: o.date_created,
          buyer: { nickname: o.buyer?.nickname ?? "?" },
          items: (o.order_items ?? []).map((i: any) => ({
            title: i.item?.title ?? "",
            quantity: i.quantity,
            unitPrice: i.unit_price,
          })),
        }));

        const result = { orders, total: data.paging?.total ?? 0 };
        setCache(cacheKey, result);

        // Persistir no banco em background
        persistOrders(account.name, orders).catch(() => {});

        return { account: account.name, ...result };
      } catch (err) {
        console.error(`[ML] Error fetching orders for ${account.name}:`, err);
        // Fallback: ler do banco
        const dbFallback = await getOrdersFromDB(account.name, dateFrom, dateTo);
        const accData = dbFallback.find(d => d.account === account.name);
        if (accData) {
          console.log(`[ML] Using DB fallback for ${account.name}: ${accData.orders.length} orders`);
          return accData;
        }
        return { account: account.name, orders: [], total: 0 };
      }
    }),
  );

  return results;
}

async function getSummaryFromDB(): Promise<{
  accounts: Array<{ name: string; today: { total: number; count: number }; week: { total: number; count: number }; month: { total: number; count: number } }>;
  totals: { today: { total: number; count: number }; week: { total: number; count: number }; month: { total: number; count: number } };
} | null> {
  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now); monthStart.setDate(1);

    const [todayRows, weekRows, monthRows] = await Promise.all([
      getOrdersFromDB(undefined, todayStr, todayStr),
      getOrdersFromDB(undefined, weekStart.toISOString().slice(0, 10), todayStr),
      getOrdersFromDB(undefined, monthStart.toISOString().slice(0, 10), todayStr),
    ]);

    if (todayRows.length === 0 && weekRows.length === 0 && monthRows.length === 0) return null;

    const accountNames = [...new Set([...todayRows, ...weekRows, ...monthRows].map(r => r.account))];
    const accounts = accountNames.map(name => {
      const todayAcc = todayRows.find(r => r.account === name);
      const weekAcc = weekRows.find(r => r.account === name);
      const monthAcc = monthRows.find(r => r.account === name);
      return {
        name,
        today: { total: (todayAcc?.orders ?? []).reduce((s, o) => s + o.totalAmount, 0), count: todayAcc?.orders?.length ?? 0 },
        week: { total: (weekAcc?.orders ?? []).reduce((s, o) => s + o.totalAmount, 0), count: weekAcc?.orders?.length ?? 0 },
        month: { total: (monthAcc?.orders ?? []).reduce((s, o) => s + o.totalAmount, 0), count: monthAcc?.orders?.length ?? 0 },
      };
    });

    return {
      accounts,
      totals: {
        today: { total: accounts.reduce((s, a) => s + a.today.total, 0), count: accounts.reduce((s, a) => s + a.today.count, 0) },
        week: { total: accounts.reduce((s, a) => s + a.week.total, 0), count: accounts.reduce((s, a) => s + a.week.count, 0) },
        month: { total: accounts.reduce((s, a) => s + a.month.total, 0), count: accounts.reduce((s, a) => s + a.month.count, 0) },
      },
    };
  } catch {
    return null;
  }
}

export async function getMLSalesSummary(customDateFrom?: string, customDateTo?: string): Promise<{
  accounts: Array<{
    name: string;
    today: { total: number; count: number };
    week: { total: number; count: number };
    month: { total: number; count: number };
  }>;
  totals: {
    today: { total: number; count: number };
    week: { total: number; count: number };
    month: { total: number; count: number };
  };
}> {
  const cacheKey = customDateFrom ? `ml:summary:${customDateFrom}:${customDateTo}` : "ml:summary";
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  // Usar horário de Brasília (UTC-3)
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);

  // Períodos padrão (quando sem filtro customizado)
  const todayStr = now.toISOString().slice(0, 10);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStr = weekStart.toISOString().slice(0, 10);
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // Se período customizado, usar como range único para today/week/month
  const periodFrom = customDateFrom || todayStr;
  const periodTo = customDateTo || todayStr;

  const db = await getDb();
  if (!db) return { accounts: [], totals: { today: { total: 0, count: 0 }, week: { total: 0, count: 0 }, month: { total: 0, count: 0 } } };

  try {
    // ── Fonte primária: banco de dados (tem TODOS os pedidos, sem limite de 500) ──
    const rows = await db.select({
      accountName: marketplaceOrders.accountName,
      periodTotal: sql<number>`COALESCE(SUM(CASE WHEN ${marketplaceOrders.platformCreatedAt} >= ${periodFrom + " 00:00:00"} AND ${marketplaceOrders.platformCreatedAt} <= ${periodTo + " 23:59:59"} THEN ${marketplaceOrders.totalAmount} ELSE 0 END), 0)`,
      periodCount: sql<number>`SUM(CASE WHEN ${marketplaceOrders.platformCreatedAt} >= ${periodFrom + " 00:00:00"} AND ${marketplaceOrders.platformCreatedAt} <= ${periodTo + " 23:59:59"} THEN 1 ELSE 0 END)`,
      todayTotal: sql<number>`COALESCE(SUM(CASE WHEN DATE(${marketplaceOrders.platformCreatedAt}) = ${todayStr} THEN ${marketplaceOrders.totalAmount} ELSE 0 END), 0)`,
      todayCount: sql<number>`SUM(CASE WHEN DATE(${marketplaceOrders.platformCreatedAt}) = ${todayStr} THEN 1 ELSE 0 END)`,
      weekTotal: sql<number>`COALESCE(SUM(CASE WHEN ${marketplaceOrders.platformCreatedAt} >= ${weekStr + " 00:00:00"} THEN ${marketplaceOrders.totalAmount} ELSE 0 END), 0)`,
      weekCount: sql<number>`SUM(CASE WHEN ${marketplaceOrders.platformCreatedAt} >= ${weekStr + " 00:00:00"} THEN 1 ELSE 0 END)`,
      monthTotal: sql<number>`COALESCE(SUM(CASE WHEN ${marketplaceOrders.platformCreatedAt} >= ${monthStr + " 00:00:00"} THEN ${marketplaceOrders.totalAmount} ELSE 0 END), 0)`,
      monthCount: sql<number>`SUM(CASE WHEN ${marketplaceOrders.platformCreatedAt} >= ${monthStr + " 00:00:00"} THEN 1 ELSE 0 END)`,
    })
      .from(marketplaceOrders)
      .where(and(
        eq(marketplaceOrders.platform, "ml"),
        eq(marketplaceOrders.status, "paid"),
      ))
      .groupBy(marketplaceOrders.accountName);

    // Quando customDateFrom é passado, today/week/month = período customizado
    const useCustom = !!customDateFrom;

    const accounts = rows.map((r: any) => ({
      name: r.accountName as string,
      today: { total: Number(useCustom ? r.periodTotal : r.todayTotal), count: Number(useCustom ? r.periodCount : r.todayCount) },
      week: { total: Number(useCustom ? r.periodTotal : r.weekTotal), count: Number(useCustom ? r.periodCount : r.weekCount) },
      month: { total: Number(useCustom ? r.periodTotal : r.monthTotal), count: Number(useCustom ? r.periodCount : r.monthCount) },
    }));

    const totals = {
      today: { total: accounts.reduce((s, a) => s + a.today.total, 0), count: accounts.reduce((s, a) => s + a.today.count, 0) },
      week: { total: accounts.reduce((s, a) => s + a.week.total, 0), count: accounts.reduce((s, a) => s + a.week.count, 0) },
      month: { total: accounts.reduce((s, a) => s + a.month.total, 0), count: accounts.reduce((s, a) => s + a.month.count, 0) },
    };

    const result = { accounts, totals };
    setCache(cacheKey, result);

    // Persistir snapshot de receita de hoje
    if (totals.today.total > 0 && !customDateFrom) {
      persistRevenueSnapshot(todayStr, "ml", totals.today.total, totals.today.count).catch(() => {});
      for (const acc of accounts) {
        if (acc.today.total > 0) {
          persistRevenueSnapshot(todayStr, `ml_${acc.name.toLowerCase()}`, acc.today.total, acc.today.count).catch(() => {});
        }
      }
    }

    return result;
  } catch (err) {
    console.error("[ML] Summary DB error, falling back to API:", err);
    // Fallback: usar API paginada (limitada a 500 por conta)
    try {
      const [todayData, weekData, monthData] = await Promise.all([
        getMLOrdersPaginated(undefined, periodFrom, periodTo, "paid"),
        getMLOrdersPaginated(undefined, customDateFrom || weekStr, periodTo, "paid"),
        getMLOrdersPaginated(undefined, customDateFrom || monthStr, periodTo, "paid"),
      ]);

      const accounts = getAccounts().map((acc) => {
        const todayAcc = (todayData ?? []).find((d: any) => d.account === acc.name);
        const weekAcc = (weekData ?? []).find((d: any) => d.account === acc.name);
        const monthAcc = (monthData ?? []).find((d: any) => d.account === acc.name);
        return {
          name: acc.name,
          today: { total: (todayAcc?.orders ?? []).reduce((s: number, o: any) => s + o.totalAmount, 0), count: todayAcc?.orders?.length ?? 0 },
          week: { total: (weekAcc?.orders ?? []).reduce((s: number, o: any) => s + o.totalAmount, 0), count: weekAcc?.orders?.length ?? 0 },
          month: { total: (monthAcc?.orders ?? []).reduce((s: number, o: any) => s + o.totalAmount, 0), count: monthAcc?.orders?.length ?? 0 },
        };
      });

      const totals = {
        today: { total: accounts.reduce((s, a) => s + a.today.total, 0), count: accounts.reduce((s, a) => s + a.today.count, 0) },
        week: { total: accounts.reduce((s, a) => s + a.week.total, 0), count: accounts.reduce((s, a) => s + a.week.count, 0) },
        month: { total: accounts.reduce((s, a) => s + a.month.total, 0), count: accounts.reduce((s, a) => s + a.month.count, 0) },
      };

      const result = { accounts, totals };
      setCache(cacheKey, result);
      return result;
    } catch {
      return { accounts: [], totals: { today: { total: 0, count: 0 }, week: { total: 0, count: 0 }, month: { total: 0, count: 0 } } };
    }
  }
}

// ── Sincroniza anúncios ativos das contas ML no catálogo ────────────────────
export async function getMLAccountItems(accountName?: string): Promise<{ synced: number; accounts: string[] }> {
  const accounts = getAccounts();
  const filtered = accountName ? accounts.filter(a => a.name === accountName) : accounts;
  let totalSynced = 0;
  const syncedAccounts: string[] = [];

  for (const account of filtered) {
    try {
      // Buscar todos os IDs de anúncios do vendedor
      let offset = 0;
      const allItemIds: string[] = [];

      while (true) {
        const data = await mlFetch(account, `https://api.mercadolibre.com/users/${account.userId}/items/search?limit=100&offset=${offset}`);
        const ids: string[] = data.results ?? [];
        allItemIds.push(...ids);
        const total = data.paging?.total ?? 0;
        if (allItemIds.length >= total || ids.length === 0) break;
        offset += 100;
      }

      // Buscar detalhes em lotes de 20
      const BATCH = 20;
      for (let i = 0; i < allItemIds.length; i += BATCH) {
        const batch = allItemIds.slice(i, i + BATCH);
        const ids = batch.join(",");
        const data = await mlFetch(account, `https://api.mercadolibre.com/items?ids=${ids}&attributes=id,title,price,status,pictures,attributes`);

        for (const raw of data) {
          // A API de batch retorna [{code, body}] — normaliza
          const item = raw?.body ?? raw;
          if (!item || item.error || !item.id) continue;
          const skuAttr = item.attributes?.find((a: any) => a.id === "SELLER_SKU");
          const db = await getDb();
          if (!db) continue;
          await db.insert(mlCatalogProducts).values({
            mlItemId: item.id,
            accountName: account.name,
            title: item.title ?? "",
            sku: skuAttr?.value_name ?? null,
            imageUrl: item.pictures?.[0]?.url ?? null,
            salePrice: String(item.price ?? 0),
            status: item.status ?? "active",
            lastSyncAt: new Date(),
          }).onDuplicateKeyUpdate({
            set: {
              title: sql`VALUES(title)`,
              imageUrl: sql`VALUES(imageUrl)`,
              salePrice: sql`VALUES(salePrice)`,
              status: sql`VALUES(status)`,
              lastSyncAt: sql`VALUES(lastSyncAt)`,
              updatedAt: sql`NOW()`,
            },
          });
          totalSynced++;
        }
      }

      syncedAccounts.push(account.name);
      console.log(`[ML Catalog] ${account.name}: ${allItemIds.length} anúncios sincronizados`);
    } catch (err) {
      console.error(`[ML Catalog] Erro ao sincronizar ${account.name}:`, err);
    }
  }

  return { synced: totalSynced, accounts: syncedAccounts };
}

export async function getMLDailySales(days = 7): Promise<
  Array<{ date: string; accounts: Record<string, { total: number; count: number }> }>
> {
  const cacheKey = `ml:daily:${days}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  // Usar horário de Brasília (UTC-3)
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - days + 1);

  const dateFrom = startDate.toISOString().slice(0, 10);
  const dateTo = now.toISOString().slice(0, 10);

  const allOrders = await getMLOrders(undefined, dateFrom, dateTo, "paid", 50);

  // Build daily map
  const dailyMap = new Map<string, Record<string, { total: number; count: number }>>();

  for (let d = 0; d < days; d++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + d);
    const dateStr = date.toISOString().slice(0, 10);
    dailyMap.set(dateStr, {});
  }

  for (const accountData of allOrders) {
    for (const order of accountData.orders) {
      const dateStr = order.dateCreated.slice(0, 10);
      if (!dailyMap.has(dateStr)) continue;

      const dayEntry = dailyMap.get(dateStr)!;
      if (!dayEntry[accountData.account]) {
        dayEntry[accountData.account] = { total: 0, count: 0 };
      }
      dayEntry[accountData.account].total += order.totalAmount;
      dayEntry[accountData.account].count += 1;
    }
  }

  const result = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, accounts]) => ({ date, accounts }));

  setCache(cacheKey, result);
  return result;
}
