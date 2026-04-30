/**
 * Marketplace Orders Integration
 * Busca pedidos reais do Mercado Livre (3 contas) via API.
 * Salva cada pedido no banco MySQL para histórico.
 * Busca thumbnail real de cada produto via API do ML.
 */

import { eq, desc, and, gte, lte, like, or, sql } from "drizzle-orm";
import { getDb } from "./db";
import { marketplaceOrders } from "../drizzle/schema";
import { fetchAndSaveShopeeOrders, getConnectedShops } from "./shopee";

// ---------- Types ----------

export type MarketplaceOrder = {
  id: string;
  platform: "ml" | "shopee";
  accountName: string;
  accountColor: string;
  status: string;
  statusLabel: string;
  buyerName: string;
  buyerCity?: string;
  buyerState?: string;
  productName: string;
  productImage: string;
  productSku?: string;
  quantity: number;
  totalAmount: number;
  createdAt: string;
  trackingCode?: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; image: string; sku?: string }>;
};

// ---------- Cache ----------

type CacheEntry<T> = { data: T; timestamp: number };
const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 3 * 60 * 1000; // 3 min

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.timestamp > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data as T;
}
function setCache<T>(key: string, data: T) { cache.set(key, { data, timestamp: Date.now() }); }

// ---------- ML Account helpers ----------

type MLAccount = {
  name: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  color: string;
};

const ML_ACCOUNT_CONFIGS = [
  { name: "CLICKMULTII", prefix: "ML_CLICKMULTII", color: "#3B82F6" },
  { name: "DUOULTILIDADE", prefix: "ML_DUOULTILIDADE", color: "#1D4ED8" },
  { name: "KAIBRENLTDA", prefix: "ML_KAIBRENLTDA", color: "#60A5FA" },
] as const;

function getMLAccounts(): MLAccount[] {
  const appId = process.env.ML_APP_ID;
  if (!appId) return [];
  const accounts: MLAccount[] = [];
  for (const cfg of ML_ACCOUNT_CONFIGS) {
    const userId = process.env[`${cfg.prefix}_USER_ID`];
    const accessToken = process.env[`${cfg.prefix}_ACCESS_TOKEN`];
    const refreshToken = process.env[`${cfg.prefix}_REFRESH_TOKEN`];
    if (userId && accessToken && refreshToken) {
      accounts.push({ name: cfg.name, userId, accessToken, refreshToken, color: cfg.color });
    }
  }
  return accounts;
}

async function refreshMLToken(account: MLAccount): Promise<MLAccount> {
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
  return account;
}

async function mlFetch(account: MLAccount, url: string, retried = false): Promise<any> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${account.accessToken}` },
  });
  if (res.status === 401 && !retried) {
    await refreshMLToken(account);
    return mlFetch(account, url, true);
  }
  if (!res.ok) throw new Error(`ML API error for ${account.name}: ${res.status}`);
  return res.json();
}

// ---------- Buscar thumbnail real do item ML ----------

const thumbnailCache = new Map<string, string>();

async function getMLItemThumbnail(account: MLAccount, itemId: string): Promise<{ thumbnail: string; sku: string }> {
  const cached = thumbnailCache.get(itemId);
  if (cached) return { thumbnail: cached, sku: "" };
  try {
    // Buscar dados completos do item para pegar a imagem real
    const data = await mlFetch(account, `https://api.mercadolibre.com/items/${itemId}`);
    // secure_thumbnail é HTTPS, melhor para exibir no site
    let thumb = data.secure_thumbnail ?? data.thumbnail ?? "";
    // Se vier com -I no final (ícone pequeno), trocar por -O (imagem normal) ou -F (full)
    if (thumb.includes("-I.jpg")) thumb = thumb.replace("-I.jpg", "-O.jpg");
    if (thumb.includes("-I.webp")) thumb = thumb.replace("-I.webp", "-O.webp");
    const sku = data.seller_custom_field ?? data.seller_sku ?? "";
    if (thumb) thumbnailCache.set(itemId, thumb);
    return { thumbnail: thumb, sku };
  } catch {
    // Fallback: construir URL padrão do ML static
    const fallback = `https://http2.mlstatic.com/D_NQ_NP_${itemId}-O.webp`;
    return { thumbnail: fallback, sku: "" };
  }
}

// ---------- Buscar endereço do shipment ML ----------

const shipmentAddressCache = new Map<string, { city: string | null; state: string | null }>();

async function getMLShipmentAddress(account: MLAccount, shippingId: string): Promise<{ city: string | null; state: string | null }> {
  const cached = shipmentAddressCache.get(shippingId);
  if (cached) return cached;
  try {
    const data = await mlFetch(account, `https://api.mercadolibre.com/shipments/${shippingId}`);
    const ra = data?.receiver_address ?? {};
    const result = {
      city: ra?.city?.name ?? null,
      state: ra?.state?.name ?? null,
    };
    shipmentAddressCache.set(shippingId, result);
    return result;
  } catch {
    return { city: null, state: null };
  }
}

// ---------- Status mapping ----------

const ML_STATUS_MAP: Record<string, string> = {
  paid: "Pago",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  confirmed: "Confirmado",
  payment_required: "Aguardando pagamento",
  payment_in_process: "Processando",
};

// ---------- Buscar e salvar pedidos ML ----------

async function fetchAndSaveMLOrders(account: MLAccount, limit: number, statusFilter?: string): Promise<MarketplaceOrder[]> {
  try {
    const params = new URLSearchParams({
      seller: account.userId,
      sort: "date_desc",
      limit: limit.toString(),
    });
    // Filtrar só pedidos pagos por padrão
    if (statusFilter) params.set("order.status", statusFilter);

    const data = await mlFetch(account, `https://api.mercadolibre.com/orders/search?${params}`);
    const orders: MarketplaceOrder[] = [];

    for (const o of data.results ?? []) {
      const orderItems: MarketplaceOrder["items"] = [];

      for (const oi of o.order_items ?? []) {
        const itemId = oi.item?.id ?? "";
        const { thumbnail, sku } = itemId ? await getMLItemThumbnail(account, itemId) : { thumbnail: "", sku: "" };

        orderItems.push({
          name: oi.item?.title ?? "Produto",
          quantity: oi.quantity ?? 1,
          unitPrice: oi.unit_price ?? 0,
          image: thumbnail,
          sku: sku || itemId,
        });
      }

      const firstItem = orderItems[0];
      const totalQty = orderItems.reduce((s, it) => s + it.quantity, 0);
      const externalId = `ML-${o.id}`;

      // /orders/search só retorna shipping.id — cidade/estado vem do /shipments/{id}
      const shippingId = o.shipping?.id ? String(o.shipping.id) : null;
      const address = shippingId
        ? await getMLShipmentAddress(account, shippingId)
        : { city: null, state: null };

      const order: MarketplaceOrder = {
        id: externalId,
        platform: "ml",
        accountName: account.name,
        accountColor: account.color,
        status: o.status ?? "unknown",
        statusLabel: ML_STATUS_MAP[o.status] ?? o.status ?? "?",
        buyerName: o.buyer?.nickname ?? "Comprador",
        buyerCity: address.city ?? undefined,
        buyerState: address.state ?? undefined,
        productName: firstItem?.name ?? "Produto",
        productImage: firstItem?.image ?? "",
        productSku: firstItem?.sku ?? "",
        quantity: totalQty,
        totalAmount: o.total_amount ?? 0,
        createdAt: o.date_created ?? new Date().toISOString(),
        trackingCode: o.shipping?.id ? String(o.shipping.id) : undefined,
        items: orderItems,
      };

      orders.push(order);

      // Salvar no banco
      try {
        const db = await getDb();
        if (db) {
          const existing = await db.select({ id: marketplaceOrders.id }).from(marketplaceOrders).where(eq(marketplaceOrders.externalId, externalId)).limit(1);
          if (existing.length === 0) {
            await db.insert(marketplaceOrders).values({
              externalId,
              platform: "ml",
              accountName: account.name,
              status: order.status,
              statusLabel: order.statusLabel,
              buyerName: order.buyerName,
              buyerCity: order.buyerCity || null,
              buyerState: order.buyerState || null,
              productName: order.productName,
              productImage: order.productImage || null,
              productSku: order.productSku || null,
              quantity: order.quantity,
              totalAmount: String(order.totalAmount),
              trackingCode: order.trackingCode || null,
              itemsJson: JSON.stringify(order.items),
              platformCreatedAt: new Date(order.createdAt),
            });
          } else {
            // Atualizar status se mudou + backfill cidade/estado
            await db.update(marketplaceOrders).set({
              status: order.status,
              statusLabel: order.statusLabel,
              trackingCode: order.trackingCode || null,
              buyerCity: order.buyerCity || null,
              buyerState: order.buyerState || null,
            }).where(eq(marketplaceOrders.externalId, externalId));
          }
        }
      } catch (dbErr) {
        // Não quebrar se banco falhar
        console.error("[Marketplace] DB save error:", dbErr);
      }
    }

    return orders;
  } catch (err) {
    console.error(`[Marketplace] Error fetching ML orders for ${account.name}:`, err);
    return [];
  }
}

// ---------- Buscar do banco (histórico) ----------

async function getOrdersFromDB(opts: {
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  accounts?: string[];
  search?: string;
}): Promise<{ orders: MarketplaceOrder[]; total: number; totalAmount: number } | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const conditions = [];
    if (opts.dateFrom) conditions.push(gte(marketplaceOrders.platformCreatedAt, new Date(opts.dateFrom)));
    if (opts.dateTo) conditions.push(lte(marketplaceOrders.platformCreatedAt, new Date(`${opts.dateTo}T23:59:59.999Z`)));
    if (opts.status) conditions.push(eq(marketplaceOrders.status, opts.status));
    if (opts.accounts && opts.accounts.length > 0) {
      conditions.push(sql`${marketplaceOrders.accountName} IN (${sql.join(opts.accounts.map(a => sql`${a}`), sql`, `)})`);
    }
    if (opts.search) {
      const q = `%${opts.search}%`;
      conditions.push(or(
        like(marketplaceOrders.productName, q),
        like(marketplaceOrders.buyerName, q),
        like(marketplaceOrders.externalId, q),
      )!);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db.select().from(marketplaceOrders)
        .where(where)
        .orderBy(desc(marketplaceOrders.platformCreatedAt))
        .limit(opts.limit ?? 20)
        .offset(opts.offset ?? 0),
      db.select({ count: sql<number>`count(*)`, total: sql<number>`COALESCE(SUM(${marketplaceOrders.totalAmount}), 0)` })
        .from(marketplaceOrders)
        .where(where),
    ]);

    const accountColorMap: Record<string, string> = {};
    for (const cfg of ML_ACCOUNT_CONFIGS) accountColorMap[cfg.name] = cfg.color;
    // Shopee: cor laranja padrão para qualquer conta
    for (const r of rows) {
      if (r.platform === "shopee" && !accountColorMap[r.accountName]) {
        accountColorMap[r.accountName] = "#F97316";
      }
    }

    const orders: MarketplaceOrder[] = rows.map(r => ({
      id: r.externalId,
      platform: r.platform as "ml" | "shopee",
      accountName: r.accountName,
      accountColor: accountColorMap[r.accountName] ?? "#3B82F6",
      status: r.status,
      statusLabel: r.statusLabel,
      buyerName: r.buyerName,
      buyerCity: r.buyerCity ?? undefined,
      buyerState: r.buyerState ?? undefined,
      productName: r.productName,
      productImage: r.productImage ?? "",
      productSku: r.productSku ?? undefined,
      quantity: r.quantity,
      totalAmount: Number(r.totalAmount),
      createdAt: r.platformCreatedAt.toISOString(),
      trackingCode: r.trackingCode ?? undefined,
      items: r.itemsJson ? JSON.parse(r.itemsJson) : [],
    }));

    return {
      orders,
      total: Number(countResult[0]?.count ?? 0),
      totalAmount: Number(countResult[0]?.total ?? 0),
    };
  } catch (err) {
    console.error("[Marketplace] DB read error:", err);
    return null;
  }
}

// ---------- API pública ----------

// Flag para evitar syncs concorrentes
let _syncInProgress = false;

/** Sync background: busca da API ML + Shopee e salva no banco. Nunca bloqueia response. */
async function syncOrdersBackground(limit: number) {
  if (_syncInProgress) return;
  _syncInProgress = true;
  try {
    const accounts = getMLAccounts();
    await Promise.allSettled([
      // Shopee
      fetchAndSaveShopeeOrders(7).catch(() => null),
      // ML — todas as contas em paralelo
      ...accounts.map(acc =>
        fetchAndSaveMLOrders(acc, Math.ceil(limit / accounts.length) + 3, "paid").catch(() => [])
      ),
    ]);
    // Invalidar cache para que próximo hit pegue dados frescos do DB
    cache.delete(`marketplace:recent:${limit}`);
  } catch {
    // non-fatal
  } finally {
    _syncInProgress = false;
  }
}

export async function getRecentOrders(limit = 10): Promise<MarketplaceOrder[]> {
  const cacheKey = `marketplace:recent:${limit}`;
  const cached = getCached<MarketplaceOrder[]>(cacheKey);
  if (cached) return cached;

  // DB-first: retornar do banco imediatamente (rápido, ~10ms)
  const dbResult = await getOrdersFromDB({ limit });
  if (dbResult && dbResult.orders.length > 0) {
    setCache(cacheKey, dbResult.orders);
    // Disparar sync em background para atualizar dados — não bloqueia o response
    syncOrdersBackground(limit);
    return dbResult.orders;
  }

  // Banco vazio (primeira vez): sync síncrono necessário
  const accounts = getMLAccounts();
  if (accounts.length > 0) {
    const allOrders: MarketplaceOrder[] = [];
    await Promise.allSettled([
      fetchAndSaveShopeeOrders(7).catch(() => null),
      ...accounts.map(async (acc) => {
        const orders = await fetchAndSaveMLOrders(acc, Math.ceil(limit / accounts.length) + 3, "paid");
        allOrders.push(...orders);
      }),
    ]);
    const dbResult2 = await getOrdersFromDB({ limit });
    if (dbResult2 && dbResult2.orders.length > 0) {
      setCache(cacheKey, dbResult2.orders);
      return dbResult2.orders;
    }
    const sorted = allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
    setCache(cacheKey, sorted);
    return sorted;
  }

  return getMockOrders().slice(0, limit);
}

export async function getFilteredOrders(opts: {
  accounts?: string[];
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ orders: MarketplaceOrder[]; total: number; totalAmount: number }> {
  // Primeiro: sempre tentar buscar do banco (dados já salvos)
  const dbResult = await getOrdersFromDB(opts);
  if (dbResult && dbResult.total > 0) return dbResult;

  // Se banco vazio: buscar da API e salvar
  const accounts = getMLAccounts();
  if (accounts.length > 0) {
    await getRecentOrders(50); // Isso popula o banco
    const dbResult2 = await getOrdersFromDB(opts);
    if (dbResult2) return dbResult2;
  }

  // Fallback mock
  const mock = getMockOrders();
  return { orders: mock.slice(0, opts.limit ?? 20), total: mock.length, totalAmount: mock.reduce((s, o) => s + o.totalAmount, 0) };
}

// ---------- Análise de Vendas detalhada (estilo GeFinance) ----------

export type DetailedOrder = MarketplaceOrder & {
  carrier: string;
  totalCusto: number;
  valorProdVendido: number;
  desconto: number;
  totalProdVendidos: number;
  freteRecebido: number;
  stVenda: number;
  ipiVenda: number;
  totalVenda: number;
  repasse: number;
  comissao: number;
  rebateComissao: number;
  comissaoFinal: number;
  bonus: number;
  fretePago: number;
  rebateFrete: number;
  difFrete: number;
  imposto: number;
  brinde: number;
  embalagem: number;
  valorLiquido: number;
  margem: number;
  percentCusto: number;
  percentVenda: number;
};

export type DetailedTotals = {
  orders: number;
  totalCusto: number;
  valorProdVendido: number;
  desconto: number;
  totalProdVendidos: number;
  freteRecebido: number;
  stVenda: number;
  ipiVenda: number;
  totalVenda: number;
  repasse: number;
  comissao: number;
  rebateComissao: number;
  comissaoFinal: number;
  bonus: number;
  fretePago: number;
  rebateFrete: number;
  difFrete: number;
  imposto: number;
  brinde: number;
  embalagem: number;
  valorLiquido: number;
  margem: number;
  percentCusto: number;
  percentVenda: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function carrierFor(platform: string, status: string): string {
  if (platform === "shopee") return "Shopee Xpress";
  if (platform === "ml") return "MEL Distribution";
  return "—";
}

function mlCommissionRate(totalVenda: number): number {
  return 0.13;
}

function mlShippingCost(totalVenda: number): number {
  if (totalVenda < 19) return 0;
  if (totalVenda < 30) return 6.9;
  if (totalVenda < 50) return 7.8;
  if (totalVenda < 80) return 8.55;
  if (totalVenda < 150) return 14.9;
  return 19.9;
}

function shopeeShippingCost(totalVenda: number): number {
  if (totalVenda < 20) return 7.37;
  if (totalVenda < 40) return 9.62;
  if (totalVenda < 80) return 12.04;
  return 15.5;
}

async function getProductCostMap(): Promise<Record<string, number>> {
  try {
    const db = await getDb();
    if (!db) return {};
    const { products } = await import("../drizzle/schema");
    const rows = await db.select({ sku: products.sku, valorProduto: products.valorProduto }).from(products);
    const map: Record<string, number> = {};
    for (const r of rows) {
      if (r.sku) map[r.sku] = Number(r.valorProduto ?? 0);
    }
    return map;
  } catch {
    return {};
  }
}

function enrichOrder(o: MarketplaceOrder, costMap: Record<string, number>): DetailedOrder {
  const items = o.items ?? [];

  let totalCusto = 0;
  let valorProdVendido = 0;
  for (const it of items) {
    const cost = (it.sku && costMap[it.sku]) ? costMap[it.sku] : 0;
    totalCusto += cost * (it.quantity ?? 0);
    valorProdVendido += (it.unitPrice ?? 0) * (it.quantity ?? 0);
  }
  totalCusto = round2(totalCusto);
  valorProdVendido = round2(valorProdVendido);

  const totalAmount = Number(o.totalAmount ?? 0);

  // Desconto: Shopee mostra desconto do marketplace (bruto → líquido)
  let desconto = 0;
  if (o.platform === "shopee" && valorProdVendido > totalAmount) {
    desconto = round2(totalAmount - valorProdVendido);
  }

  const totalProdVendidos = round2(valorProdVendido + desconto);
  const freteRecebido = 0;
  const stVenda = 0;
  const ipiVenda = 0;
  const totalVenda = round2(totalProdVendidos + freteRecebido + stVenda + ipiVenda);

  // Comissão
  const commissionPct = o.platform === "shopee" ? 0.28 : mlCommissionRate(totalVenda);
  const comissao = round2(-(totalVenda * commissionPct));
  const rebateComissao = 0;
  const comissaoFinal = round2(comissao + rebateComissao);

  const bonus = 0;

  // Frete
  const fretePagoRaw = o.platform === "shopee" ? shopeeShippingCost(totalVenda) : mlShippingCost(totalVenda);
  const fretePago = round2(-fretePagoRaw);
  const rebateFrete = o.platform === "shopee" ? round2(fretePagoRaw) : 0;
  const difFrete = round2(freteRecebido + fretePago + rebateFrete);

  const imposto = 0;
  const brinde = 0;
  const embalagem = 0;

  const repasse = round2(totalVenda + comissaoFinal + difFrete);
  const valorLiquido = round2(repasse + imposto + bonus + brinde + embalagem);
  const margem = round2(valorLiquido - totalCusto);

  const percentCusto = valorProdVendido > 0 ? totalCusto / valorProdVendido : 0;
  const percentVenda = valorProdVendido > 0 ? margem / valorProdVendido : 0;

  return {
    ...o,
    carrier: carrierFor(o.platform, o.status),
    totalCusto,
    valorProdVendido,
    desconto,
    totalProdVendidos,
    freteRecebido,
    stVenda,
    ipiVenda,
    totalVenda,
    repasse,
    comissao,
    rebateComissao,
    comissaoFinal,
    bonus,
    fretePago,
    rebateFrete,
    difFrete,
    imposto,
    brinde,
    embalagem,
    valorLiquido,
    margem,
    percentCusto,
    percentVenda,
  };
}

export type DetailedSortKey =
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

export type DetailedCondition =
  | "margem-negativa"
  | "custo-faltante"
  | "tarifa-faltante"
  | "imposto-faltante";

function matchesCondition(o: DetailedOrder, condition: DetailedCondition): boolean {
  switch (condition) {
    case "margem-negativa":
      return o.margem < 0;
    case "custo-faltante":
      return o.totalCusto === 0 && o.valorProdVendido > 0;
    case "tarifa-faltante":
      return o.comissao === 0 && o.totalVenda > 0;
    case "imposto-faltante":
      return o.imposto === 0 && o.totalVenda > 100;
  }
}

function compareDetailed(a: DetailedOrder, b: DetailedOrder, key: DetailedSortKey, dir: "asc" | "desc"): number {
  const mul = dir === "asc" ? 1 : -1;
  if (key === "createdAt") {
    return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * mul;
  }
  const av = (a as any)[key];
  const bv = (b as any)[key];
  if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
  const as = String(av ?? "").toLowerCase();
  const bs = String(bv ?? "").toLowerCase();
  if (as < bs) return -1 * mul;
  if (as > bs) return 1 * mul;
  return 0;
}

export async function getDetailedOrders(opts: {
  accounts?: string[];
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  condition?: DetailedCondition;
  sortBy?: DetailedSortKey;
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}): Promise<{ orders: DetailedOrder[]; total: number; totals: DetailedTotals }> {
  const limit = opts.limit ?? 10;
  const offset = opts.offset ?? 0;
  const sortBy = opts.sortBy ?? "createdAt";
  const sortDir = opts.sortDir ?? "desc";

  // Puxar TODOS os pedidos do periodo (filtros SQL aplicaveis) e enriquecer
  const allFiltered = await getOrdersFromDB({
    accounts: opts.accounts,
    status: opts.status,
    dateFrom: opts.dateFrom,
    dateTo: opts.dateTo,
    search: opts.search,
    limit: 10000,
    offset: 0,
  });
  const costMap = await getProductCostMap();
  let allEnriched = (allFiltered?.orders ?? []).map((o) => enrichOrder(o, costMap));

  // Filtro por condicao (derivado — pos enrichment)
  if (opts.condition) {
    allEnriched = allEnriched.filter((o) => matchesCondition(o, opts.condition!));
  }

  // Ordenacao (campo derivado ou nao)
  allEnriched.sort((a, b) => compareDetailed(a, b, sortBy, sortDir));

  // Paginacao em memoria apos filtro + sort
  const total = allEnriched.length;
  const enriched = allEnriched.slice(offset, offset + limit);

  const totals: DetailedTotals = {
    orders: allEnriched.length,
    totalCusto: 0,
    valorProdVendido: 0,
    desconto: 0,
    totalProdVendidos: 0,
    freteRecebido: 0,
    stVenda: 0,
    ipiVenda: 0,
    totalVenda: 0,
    repasse: 0,
    comissao: 0,
    rebateComissao: 0,
    comissaoFinal: 0,
    bonus: 0,
    fretePago: 0,
    rebateFrete: 0,
    difFrete: 0,
    imposto: 0,
    brinde: 0,
    embalagem: 0,
    valorLiquido: 0,
    margem: 0,
    percentCusto: 0,
    percentVenda: 0,
  };

  for (const o of allEnriched) {
    totals.totalCusto += o.totalCusto;
    totals.valorProdVendido += o.valorProdVendido;
    totals.desconto += o.desconto;
    totals.totalProdVendidos += o.totalProdVendidos;
    totals.freteRecebido += o.freteRecebido;
    totals.stVenda += o.stVenda;
    totals.ipiVenda += o.ipiVenda;
    totals.totalVenda += o.totalVenda;
    totals.repasse += o.repasse;
    totals.comissao += o.comissao;
    totals.rebateComissao += o.rebateComissao;
    totals.comissaoFinal += o.comissaoFinal;
    totals.bonus += o.bonus;
    totals.fretePago += o.fretePago;
    totals.rebateFrete += o.rebateFrete;
    totals.difFrete += o.difFrete;
    totals.imposto += o.imposto;
    totals.brinde += o.brinde;
    totals.embalagem += o.embalagem;
    totals.valorLiquido += o.valorLiquido;
    totals.margem += o.margem;
  }

  // Percentuais sobre totais agregados
  totals.percentCusto = totals.valorProdVendido > 0 ? totals.totalCusto / totals.valorProdVendido : 0;
  totals.percentVenda = totals.valorProdVendido > 0 ? totals.margem / totals.valorProdVendido : 0;

  // Arredondar
  for (const k of Object.keys(totals) as (keyof DetailedTotals)[]) {
    if (k === "orders" || k === "percentCusto" || k === "percentVenda") continue;
    totals[k] = round2(totals[k] as number) as never;
  }

  return {
    orders: enriched,
    total,
    totals,
  };
}

// ---------- Análise de Produtos (Curva ABC dupla) ----------

export type ProductAnalysisRow = {
  sku: string;
  productName: string;
  productImage: string;
  vendas: number;
  faturamento: number;
  ticketMedio: number;
  curvaFaturamento: "A" | "B" | "C";
  margem: number;
  margemPct: number;
  curvaMargem: "A" | "B" | "C";
  share: number;
};

export type ProductAnalysisTotals = {
  produtos: number;
  vendas: number;
  faturamento: number;
  margem: number;
  ticketMedio: number;
};

export async function getProductAnalysis(opts: {
  accounts?: string[];
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}): Promise<{ products: ProductAnalysisRow[]; totals: ProductAnalysisTotals }> {
  // Buscar TODOS os pedidos do período (sem paginação)
  const allFiltered = await getOrdersFromDB({
    accounts: opts.accounts,
    status: opts.status,
    dateFrom: opts.dateFrom,
    dateTo: opts.dateTo,
    search: opts.search,
    limit: 10000,
    offset: 0,
  });
  const base = allFiltered?.orders ?? [];
  const costMap = await getProductCostMap();
  const enriched = base.map((o) => enrichOrder(o, costMap));

  type Agg = {
    sku: string;
    productName: string;
    productImage: string;
    vendas: number;
    faturamento: number;
    margem: number;
  };
  const bySku = new Map<string, Agg>();

  for (const o of enriched) {
    const items = o.items ?? [];
    const orderGross = items.reduce((s, it) => s + (it.unitPrice ?? 0) * (it.quantity ?? 0), 0) || 1;
    for (const it of items) {
      const revenue = (it.unitPrice ?? 0) * (it.quantity ?? 0);
      const weight = revenue / orderGross;
      const key = (it.sku && it.sku.trim()) || it.name || "—";
      const existing = bySku.get(key);
      const row: Agg = existing ?? {
        sku: it.sku || "—",
        productName: it.name || "Produto",
        productImage: it.image || "",
        vendas: 0,
        faturamento: 0,
        margem: 0,
      };
      row.vendas += it.quantity ?? 0;
      row.faturamento += revenue;
      row.margem += o.margem * weight;
      if (!existing) bySku.set(key, row);
    }
  }

  const list = Array.from(bySku.values()).map((a) => ({
    ...a,
    faturamento: round2(a.faturamento),
    margem: round2(a.margem),
    ticketMedio: a.vendas > 0 ? round2(a.faturamento / a.vendas) : 0,
    margemPct: a.faturamento > 0 ? a.margem / a.faturamento : 0,
  }));

  const totalFaturamento = list.reduce((s, r) => s + r.faturamento, 0);
  const totalMargem = list.reduce((s, r) => s + r.margem, 0);

  // Curva ABC por faturamento (ordena desc)
  const byFat = [...list].sort((a, b) => b.faturamento - a.faturamento);
  let accF = 0;
  const curvaF = new Map<string, "A" | "B" | "C">();
  for (const r of byFat) {
    accF += r.faturamento;
    const pct = totalFaturamento > 0 ? accF / totalFaturamento : 0;
    curvaF.set(r.productName + "|" + r.sku, pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C");
  }

  // Curva ABC por margem
  const byMg = [...list].sort((a, b) => b.margem - a.margem);
  let accM = 0;
  const curvaM = new Map<string, "A" | "B" | "C">();
  for (const r of byMg) {
    accM += r.margem;
    const pct = totalMargem > 0 ? accM / totalMargem : 0;
    curvaM.set(r.productName + "|" + r.sku, pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C");
  }

  const products: ProductAnalysisRow[] = byFat.map((r) => ({
    sku: r.sku,
    productName: r.productName,
    productImage: r.productImage,
    vendas: r.vendas,
    faturamento: r.faturamento,
    ticketMedio: r.ticketMedio,
    curvaFaturamento: curvaF.get(r.productName + "|" + r.sku) ?? "C",
    margem: r.margem,
    margemPct: r.margemPct,
    curvaMargem: curvaM.get(r.productName + "|" + r.sku) ?? "C",
    share: totalFaturamento > 0 ? r.faturamento / totalFaturamento : 0,
  }));

  const totalVendas = list.reduce((s, r) => s + r.vendas, 0);
  const totals: ProductAnalysisTotals = {
    produtos: products.length,
    vendas: totalVendas,
    faturamento: round2(totalFaturamento),
    margem: round2(totalMargem),
    ticketMedio: totalVendas > 0 ? round2(totalFaturamento / totalVendas) : 0,
  };

  return { products, totals };
}

export async function getAvailableAccounts() {
  const mlAccounts = getMLAccounts();
  const accounts = mlAccounts.length > 0
    ? mlAccounts.map(a => ({ id: a.name, name: a.name, platform: "ml", color: a.color }))
    : ML_ACCOUNT_CONFIGS.map(cfg => ({ id: cfg.name, name: cfg.name, platform: "ml", color: cfg.color }));

  // Adicionar contas Shopee conectadas
  try {
    const shops = await getConnectedShops();
    for (const shop of shops) {
      accounts.push({ id: shop.shopName, name: shop.shopName, platform: "shopee", color: "#F97316" });
    }
  } catch (e) { /* non-fatal */ }

  return accounts;
}

// ---------- Mock ----------

function getMockOrders(): MarketplaceOrder[] {
  const now = Date.now();
  const products = [
    { name: "Kit Ferramentas 129 peças Profissional", price: 189.90, image: "https://http2.mlstatic.com/D_NQ_NP_2X_773801-MLU75247024654_032024-F.webp", sku: "FER-129" },
    { name: "Organizador Multiuso Empilhável 3 Andares", price: 59.90, image: "https://http2.mlstatic.com/D_NQ_NP_2X_870890-MLU74637285208_022024-F.webp", sku: "ORG-003" },
    { name: "Fita LED RGB 5m com Controle Remoto WiFi", price: 79.90, image: "https://http2.mlstatic.com/D_NQ_NP_2X_959413-MLU72656637498_112023-F.webp", sku: "LED-5M" },
    { name: "Suporte Notebook Ergonômico Alumínio Ajustável", price: 129.90, image: "https://http2.mlstatic.com/D_NQ_NP_2X_723698-MLU72424547740_102023-F.webp", sku: "SUP-NOT" },
    { name: "Carregador Turbo USB-C 33W Samsung Original", price: 69.90, image: "https://http2.mlstatic.com/D_NQ_NP_2X_665313-MLU75004929710_032024-F.webp", sku: "CAR-33W" },
    { name: "Mini Ventilador Portátil USB Recarregável", price: 39.90, image: "https://http2.mlstatic.com/D_NQ_NP_2X_735139-MLU74637285198_022024-F.webp", sku: "VEN-USB" },
    { name: "Porta Trecos Adesivo Multiuso 4un Preto", price: 22.90, image: "https://http2.mlstatic.com/D_NQ_NP_2X_839403-MLU72656637470_112023-F.webp", sku: "POR-4UN" },
    { name: "Lâmpada Inteligente WiFi RGB Alexa/Google", price: 44.90, image: "https://http2.mlstatic.com/D_NQ_NP_2X_869541-MLU75247024614_032024-F.webp", sku: "LAM-RGB" },
    { name: "Adaptador HDMI para USB-C 4K 60Hz", price: 54.90, image: "https://http2.mlstatic.com/D_NQ_NP_2X_618590-MLU74637285178_022024-F.webp", sku: "ADP-4K" },
    { name: "Hub USB 3.0 4 Portas Compacto com LED", price: 49.90, image: "https://http2.mlstatic.com/D_NQ_NP_2X_670116-MLU72424547738_102023-F.webp", sku: "HUB-4P" },
  ];
  const buyers = ["PEDRO_ALMEIDA", "LUCAS.FERREIRA", "MARIANA_SOUZA", "RAFAEL.COSTA", "BEATRIZ_LIMA", "THIAGO.SANTOS", "CAMILA_ROCHA", "GABRIEL.SILVA", "JULIANA_MARTINS", "DIEGO.OLIVEIRA"];
  const statuses = [
    { s: "paid", l: "Pago" }, { s: "shipped", l: "Enviado" }, { s: "delivered", l: "Entregue" }, { s: "paid", l: "Pago" },
  ];

  return products.map((p, i) => {
    const acc = ML_ACCOUNT_CONFIGS[i % ML_ACCOUNT_CONFIGS.length];
    const st = statuses[i % statuses.length];
    const qty = 1 + (i % 3);
    return {
      id: `ML-${2000000000 + i}`,
      platform: "ml" as const,
      accountName: acc.name,
      accountColor: acc.color,
      status: st.s,
      statusLabel: st.l,
      buyerName: buyers[i],
      productName: p.name,
      productImage: p.image,
      productSku: p.sku,
      quantity: qty,
      totalAmount: Math.round(p.price * qty * 100) / 100,
      createdAt: new Date(now - i * 2400000).toISOString(),
      items: [{ name: p.name, quantity: qty, unitPrice: p.price, image: p.image, sku: p.sku }],
    };
  });
}
