/**
 * Shopee API v2 — Pedidos, Produtos e Token Refresh
 *
 * Endpoints usados:
 *  - /api/v2/order/get_order_list        (listar pedidos)
 *  - /api/v2/order/get_order_detail      (detalhe do pedido)
 *  - /api/v2/product/get_item_list       (listar produtos)
 *  - /api/v2/product/get_item_base_info  (detalhe do produto)
 *  - /api/v2/shop/get_shop_info          (info da loja)
 *  - /api/v2/auth/access_token/get       (refresh token)
 *
 * Assinatura: HMAC-SHA256
 *  - Shop endpoints: partner_id + path + timestamp + access_token + shop_id
 */

import crypto from "crypto";
import { eq, like, and, sql } from "drizzle-orm";
import { getDb } from "./db";
import { integrations, marketplaceOrders } from "../drizzle/schema";
import { decrypt, upsertIntegration } from "./integrations";

const PARTNER_ID = process.env.SHOPEE_PARTNER_ID || "2031848";
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY || "";
const HOST = process.env.SHOPEE_HOST || "https://partner.shopeemobile.com";

// ---------- Signing ----------

function signPublic(path: string, timestamp: number): string {
  const base = `${PARTNER_ID}${path}${timestamp}`;
  return crypto.createHmac("sha256", PARTNER_KEY).update(base).digest("hex");
}

function signShop(path: string, timestamp: number, accessToken: string, shopId: string): string {
  const base = `${PARTNER_ID}${path}${timestamp}${accessToken}${shopId}`;
  return crypto.createHmac("sha256", PARTNER_KEY).update(base).digest("hex");
}

// ---------- Helpers ----------

interface ShopeeShop {
  shopId: string;
  shopName: string;
  accessToken: string;
  refreshToken: string;
  slug: string;
}

async function getConnectedShops(): Promise<ShopeeShop[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(integrations).where(like(integrations.slug, "shopee-%"));
  const shops: ShopeeShop[] = [];
  for (const row of rows) {
    if (row.status !== "connected" || !row.accessToken) continue;
    const token = decrypt(row.accessToken);
    const extra = row.extraConfig ? JSON.parse(row.extraConfig) : {};
    if (!token || !extra.shopId) continue;
    shops.push({
      shopId: extra.shopId,
      shopName: extra.shopName || `Shop ${extra.shopId}`,
      accessToken: token,
      refreshToken: extra.refreshToken || "",
      slug: row.slug,
    });
  }
  return shops;
}

async function shopeeApiFetch(path: string, shop: ShopeeShop, extraParams?: Record<string, string>): Promise<any> {
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signShop(path, timestamp, shop.accessToken, shop.shopId);
  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: String(timestamp),
    access_token: shop.accessToken,
    shop_id: shop.shopId,
    sign,
    ...extraParams,
  });
  const url = `${HOST}${path}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Shopee API ${path}: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Shopee API ${path}: ${data.error} - ${data.message || ""}`);
  return data;
}

// ---------- Token Refresh ----------

async function refreshShopToken(shop: ShopeeShop): Promise<{ accessToken: string; refreshToken: string } | null> {
  const path = "/api/v2/auth/access_token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signPublic(path, timestamp);
  const url = `${HOST}${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: shop.refreshToken,
        shop_id: Number(shop.shopId),
        partner_id: Number(PARTNER_ID),
      }),
    });
    const data = await res.json() as any;
    if (data.error || !data.access_token) {
      console.error(`[Shopee] Refresh falhou para ${shop.shopName}: ${data.error} - ${data.message}`);
      return null;
    }
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  } catch (err: any) {
    console.error(`[Shopee] Erro refresh ${shop.shopName}:`, err.message);
    return null;
  }
}

export async function refreshAllShopeeTokens(): Promise<{ refreshed: number; errors: string[] }> {
  const shops = await getConnectedShops();
  let refreshed = 0;
  const errors: string[] = [];

  for (const shop of shops) {
    const result = await refreshShopToken(shop);
    if (result) {
      // Atualizar no banco
      await upsertIntegration(shop.slug, {
        accessToken: result.accessToken,
        extraConfig: {
          refreshToken: result.refreshToken,
          shopId: shop.shopId,
          shopName: shop.shopName,
          expiresAt: new Date(Date.now() + 14400 * 1000).toISOString(),
          connectedAt: undefined, // manter o original
        },
        status: "connected",
      });
      // Atualizar process.env
      const slots = ["SHOPEE_SHOP_1", "SHOPEE_SHOP_2", "SHOPEE_SHOP_3"];
      for (const slot of slots) {
        if (process.env[`${slot}_ID`] === shop.shopId) {
          process.env[`${slot}_ACCESS_TOKEN`] = result.accessToken;
          process.env[`${slot}_REFRESH_TOKEN`] = result.refreshToken;
          break;
        }
      }
      shop.accessToken = result.accessToken;
      shop.refreshToken = result.refreshToken;
      refreshed++;
      console.log(`[Shopee] Token renovado: ${shop.shopName}`);
    } else {
      errors.push(shop.shopName);
    }
  }
  return { refreshed, errors };
}

export function startShopeeTokenCron() {
  // Shopee access token dura 4h — renovar a cada 3h30
  const INTERVAL = 3.5 * 60 * 60 * 1000; // 3h30

  // Primeiro refresh 2min após boot
  setTimeout(async () => {
    console.log("[Shopee Cron] Primeiro refresh de tokens...");
    const r = await refreshAllShopeeTokens();
    console.log(`[Shopee Cron] Tokens renovados: ${r.refreshed}`, r.errors.length ? `Erros: ${r.errors.join(", ")}` : "");
  }, 120_000);

  setInterval(async () => {
    console.log("[Shopee Cron] Renovando tokens...");
    const r = await refreshAllShopeeTokens();
    console.log(`[Shopee Cron] Tokens renovados: ${r.refreshed}`, r.errors.length ? `Erros: ${r.errors.join(", ")}` : "");
  }, INTERVAL);

  console.log("[Shopee Cron] Token auto-renewal iniciado (intervalo: 3h30)");
}

// ---------- Pedidos ----------

const SHOPEE_STATUS_MAP: Record<string, string> = {
  UNPAID: "Aguardando pagamento",
  READY_TO_SHIP: "Pronto p/ envio",
  PROCESSED: "Processado",
  SHIPPED: "Enviado",
  COMPLETED: "Entregue",
  IN_CANCEL: "Cancelamento pendente",
  CANCELLED: "Cancelado",
  INVOICE_PENDING: "Aguardando NF",
};

const SHOPEE_ORDER_STATUSES = ["READY_TO_SHIP", "PROCESSED", "SHIPPED", "COMPLETED", "IN_CANCEL", "CANCELLED", "INVOICE_PENDING"];

export async function fetchShopeeOrders(shop: ShopeeShop, daysBack: number = 7): Promise<any[]> {
  const now = Math.floor(Date.now() / 1000);
  const timeFrom = now - daysBack * 24 * 60 * 60;
  const allOrders: any[] = [];

  try {
    // Shopee exige order_status — buscar por cada status relevante
    for (const status of SHOPEE_ORDER_STATUSES) {
      try {
        const listData = await shopeeApiFetch("/api/v2/order/get_order_list", shop, {
          time_range_field: "create_time",
          time_from: String(timeFrom),
          time_to: String(now),
          page_size: "50",
          cursor: "0",
          order_status: status,
        });

        const response = listData.response || listData;
        const orderList = response?.order_list || [];
        if (orderList.length === 0) continue;

        // Buscar detalhes
        const orderIds = orderList.map((o: any) => o.order_sn).join(",");
        const detailData = await shopeeApiFetch("/api/v2/order/get_order_detail", shop, {
          order_sn_list: orderIds,
          response_optional_fields: "buyer_username,item_list,total_amount,order_status,shipping_carrier,tracking_number",
        });

        const detailResponse = detailData.response || detailData;
        const orders = detailResponse?.order_list || [];
        allOrders.push(...orders);
      } catch (statusErr: any) {
        // Alguns status podem não ter pedidos — ok
        if (!statusErr.message?.includes("error_param")) {
          console.error(`[Shopee] Erro status ${status} para ${shop.shopName}:`, statusErr.message);
        }
      }
    }

    return allOrders;
  } catch (err: any) {
    console.error(`[Shopee] Erro buscando pedidos ${shop.shopName}:`, err.message);
    return [];
  }
}

export async function fetchAndSaveShopeeOrders(daysBack: number = 7): Promise<number> {
  const shops = await getConnectedShops();
  let saved = 0;

  for (const shop of shops) {
    const orders = await fetchShopeeOrders(shop, daysBack);

    for (const order of orders) {
      const externalId = `SHOPEE-${order.order_sn}`;
      const items = (order.item_list || []).map((item: any) => ({
        name: item.item_name || "Produto",
        quantity: item.model_quantity_purchased || item.quantity || 1,
        unitPrice: Number(item.model_discounted_price || item.model_original_price || 0),
        image: item.image_info?.image_url || "",
        sku: item.item_sku || item.model_sku || "",
      }));

      const firstItem = items[0];
      const totalQty = items.reduce((s: number, it: any) => s + it.quantity, 0);
      const status = order.order_status || "UNKNOWN";

      try {
        const db = await getDb();
        if (!db) continue;

        const existing = await db.select({ id: marketplaceOrders.id })
          .from(marketplaceOrders)
          .where(eq(marketplaceOrders.externalId, externalId))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(marketplaceOrders).values({
            externalId,
            platform: "shopee",
            accountName: shop.shopName,
            status: status.toLowerCase(),
            statusLabel: SHOPEE_STATUS_MAP[status] || status,
            buyerName: order.buyer_username || "Comprador",
            buyerCity: null,
            buyerState: null,
            productName: firstItem?.name || "Produto",
            productImage: firstItem?.image || null,
            productSku: firstItem?.sku || null,
            quantity: totalQty,
            totalAmount: String(Number(order.total_amount || 0)),
            trackingCode: order.tracking_number || null,
            itemsJson: JSON.stringify(items),
            platformCreatedAt: order.create_time ? new Date(order.create_time * 1000) : new Date(),
          });
          saved++;
        } else {
          await db.update(marketplaceOrders).set({
            status: status.toLowerCase(),
            statusLabel: SHOPEE_STATUS_MAP[status] || status,
            trackingCode: order.tracking_number || null,
          }).where(eq(marketplaceOrders.externalId, externalId));
        }
      } catch (dbErr) {
        console.error("[Shopee] DB save error:", dbErr);
      }
    }
  }

  return saved;
}

// ---------- Produtos ----------

export async function fetchShopeeProducts(shop: ShopeeShop): Promise<any[]> {
  try {
    const listData = await shopeeApiFetch("/api/v2/product/get_item_list", shop, {
      offset: "0",
      page_size: "50",
      item_status: "NORMAL",
    });

    const response = listData.response || listData;
    const itemList = response?.item || [];
    if (itemList.length === 0) return [];

    // Buscar detalhes em batch
    const itemIds = itemList.map((i: any) => i.item_id).join(",");
    const detailData = await shopeeApiFetch("/api/v2/product/get_item_base_info", shop, {
      item_id_list: itemIds,
    });

    const detailResponse = detailData.response || detailData;
    return detailResponse?.item_list || [];
  } catch (err: any) {
    console.error(`[Shopee] Erro buscando produtos ${shop.shopName}:`, err.message);
    return [];
  }
}

// ---------- Info da Loja ----------

export async function getShopeeShopInfo(): Promise<any[]> {
  const shops = await getConnectedShops();
  const results = [];

  for (const shop of shops) {
    try {
      const data = await shopeeApiFetch("/api/v2/shop/get_shop_info", shop);
      const info = data.response || data;
      results.push({
        shopId: shop.shopId,
        shopName: info.shop_name || shop.shopName,
        status: info.status,
        isCB: info.is_cb,
        description: info.description,
      });
    } catch (err: any) {
      results.push({ shopId: shop.shopId, shopName: shop.shopName, error: err.message });
    }
  }

  return results;
}

// ---------- Resumo de vendas (para Dashboard) ----------

export async function getShopeeSalesSummary(): Promise<{
  total: number;
  today: number;
  todayCount: number;
  thisWeek: number;
  thisMonth: number;
  orderCount: number;
  accounts: Array<{ name: string; total: number; today: number; todayCount: number; orders: number }>;
}> {
  const db = await getDb();
  if (!db) return { total: 0, today: 0, todayCount: 0, thisWeek: 0, thisMonth: 0, orderCount: 0, accounts: [] };

  // Sincronizar pedidos recentes
  try {
    await fetchAndSaveShopeeOrders(15);
  } catch (e) {
    // non-fatal
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const allOrders = await db.select()
      .from(marketplaceOrders)
      .where(and(
        eq(marketplaceOrders.platform, "shopee"),
        sql`${marketplaceOrders.status} NOT IN ('cancelled', 'in_cancel')`,
      ));

    let total = 0, today = 0, todayCount = 0, thisWeek = 0, thisMonth = 0;
    const accountMap = new Map<string, { total: number; today: number; todayCount: number; orders: number }>();

    for (const order of allOrders) {
      const amount = Number(order.totalAmount || 0);
      const date = order.platformCreatedAt;
      total += amount;

      if (date >= startOfDay) { today += amount; todayCount++; }
      if (date >= startOfWeek) thisWeek += amount;
      if (date >= startOfMonth) thisMonth += amount;

      const acc = accountMap.get(order.accountName) || { total: 0, today: 0, todayCount: 0, orders: 0 };
      acc.total += amount;
      acc.orders++;
      if (date >= startOfDay) { acc.today += amount; acc.todayCount++; }
      accountMap.set(order.accountName, acc);
    }

    const accounts = Array.from(accountMap.entries()).map(([name, data]) => ({
      name,
      total: Math.round(data.total * 100) / 100,
      today: Math.round(data.today * 100) / 100,
      todayCount: data.todayCount,
      orders: data.orders,
    }));

    return {
      total: Math.round(total * 100) / 100,
      today: Math.round(today * 100) / 100,
      todayCount,
      thisWeek: Math.round(thisWeek * 100) / 100,
      thisMonth: Math.round(thisMonth * 100) / 100,
      orderCount: allOrders.length,
      accounts,
    };
  } catch (err) {
    console.error("[Shopee] Erro summary:", err);
    return { total: 0, today: 0, todayCount: 0, thisWeek: 0, thisMonth: 0, orderCount: 0, accounts: [] };
  }
}

export { getConnectedShops, shopeeApiFetch, signShop, PARTNER_ID, PARTNER_KEY, HOST, type ShopeeShop };
