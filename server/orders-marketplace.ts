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

      const order: MarketplaceOrder = {
        id: externalId,
        platform: "ml",
        accountName: account.name,
        accountColor: account.color,
        status: o.status ?? "unknown",
        statusLabel: ML_STATUS_MAP[o.status] ?? o.status ?? "?",
        buyerName: o.buyer?.nickname ?? "Comprador",
        buyerCity: undefined,
        buyerState: undefined,
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
            // Atualizar status se mudou
            await db.update(marketplaceOrders).set({
              status: order.status,
              statusLabel: order.statusLabel,
              trackingCode: order.trackingCode || null,
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

export async function getRecentOrders(limit = 10): Promise<MarketplaceOrder[]> {
  const cacheKey = `marketplace:recent:${limit}`;
  const cached = getCached<MarketplaceOrder[]>(cacheKey);
  if (cached) return cached;

  const accounts = getMLAccounts();

  // Sincronizar Shopee em paralelo (non-blocking)
  try { await fetchAndSaveShopeeOrders(7); } catch (e) { /* non-fatal */ }

  if (accounts.length > 0) {
    // Buscar da API do ML (só pedidos pagos) e salvar no banco
    const allOrders: MarketplaceOrder[] = [];
    for (const acc of accounts) {
      const orders = await fetchAndSaveMLOrders(acc, Math.ceil(limit / accounts.length) + 3, "paid");
      allOrders.push(...orders);
    }
    // Agora buscar do banco (inclui ML + Shopee)
    const dbResult = await getOrdersFromDB({ limit });
    if (dbResult && dbResult.orders.length > 0) {
      setCache(cacheKey, dbResult.orders);
      return dbResult.orders;
    }
    const sorted = allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
    setCache(cacheKey, sorted);
    return sorted;
  }

  // Sem ML configurado: tentar banco (pode ter Shopee), senão mock
  const dbResult = await getOrdersFromDB({ limit });
  if (dbResult && dbResult.orders.length > 0) {
    setCache(cacheKey, dbResult.orders);
    return dbResult.orders;
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
