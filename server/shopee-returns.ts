/**
 * Shopee Returns — coleta devoluções (get_return_list).
 *
 * Limitações da API:
 *  - Janela máxima por chamada: 15 dias (forçar paginação por períodos)
 *  - page_size máx: 40
 *  - paginação: page_no
 */
import crypto from "crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { shopeeReturns } from "../drizzle/schema";
import { getConnectedShops, PARTNER_ID, PARTNER_KEY, HOST, type ShopeeShop } from "./shopee";

function signShop(path: string, ts: number, token: string, shopId: string) {
  const base = `${PARTNER_ID}${path}${ts}${token}${shopId}`;
  return crypto.createHmac("sha256", PARTNER_KEY).update(base).digest("hex");
}

async function shopeeGet(path: string, shop: ShopeeShop, params: Record<string, string>): Promise<any> {
  const ts = Math.floor(Date.now() / 1000);
  const sign = signShop(path, ts, shop.accessToken, shop.shopId);
  const u = new URL(`${HOST}${path}`);
  u.searchParams.set("partner_id", PARTNER_ID);
  u.searchParams.set("timestamp", String(ts));
  u.searchParams.set("access_token", shop.accessToken);
  u.searchParams.set("shop_id", shop.shopId);
  u.searchParams.set("sign", sign);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await (await fetch(u.toString())).json();
  if (r.error) throw new Error(`Shopee ${path}: ${r.error} - ${r.message || ""}`);
  return r.response;
}

interface ShopeeReturnApi {
  return_sn: string;
  order_sn: string;
  reason: string;
  text_reason: string;
  status: string;
  refund_amount: number;
  currency: string;
  create_time: number;
  update_time: number;
  user: { username: string; email?: string };
  image: string[];
  buyer_videos: Array<{ video_url: string; thumbnail_url?: string }>;
  item: Array<{
    item_id: number;
    name: string;
    item_sku?: string;
    amount: number;
    item_price: number;
  }>;
}

const FIFTEEN_DAYS = 15 * 24 * 3600;

/**
 * Pagina dentro de uma janela de até 15 dias.
 */
async function fetchReturnsInWindow(
  shop: ShopeeShop,
  fromTs: number,
  toTs: number,
): Promise<ShopeeReturnApi[]> {
  const all: ShopeeReturnApi[] = [];
  let pageNo = 1;
  let safety = 50;

  while (safety-- > 0) {
    const data = await shopeeGet("/api/v2/returns/get_return_list", shop, {
      page_no: String(pageNo),
      page_size: "40",
      create_time_from: String(fromTs),
      create_time_to: String(toTs),
    });
    const list: ShopeeReturnApi[] = data?.return || [];
    if (list.length === 0) break;
    all.push(...list);
    if (!data?.more || list.length < 40) break;
    pageNo++;
    await new Promise((r) => setTimeout(r, 250));
  }
  return all;
}

/**
 * Sincroniza retornos de uma loja. Pagina em janelas de 15 dias retroativas.
 * @param shop loja
 * @param monthsBack quantos meses pra trás (default 3)
 */
export async function syncReturns(
  shop: ShopeeShop,
  monthsBack = 3,
): Promise<{ fetched: number; inserted: number; updated: number }> {
  const db = await getDb();
  if (!db) return { fetched: 0, inserted: 0, updated: 0 };

  const now = Math.floor(Date.now() / 1000);
  const oldestTs = now - monthsBack * 30 * 24 * 3600;

  let totalFetched = 0;
  let inserted = 0;
  let updated = 0;

  // Itera em janelas de 15 dias do mais recente pro mais antigo
  let windowEnd = now;
  while (windowEnd > oldestTs) {
    const windowStart = Math.max(windowEnd - FIFTEEN_DAYS + 1, oldestTs);
    const list = await fetchReturnsInWindow(shop, windowStart, windowEnd);
    totalFetched += list.length;

    for (const r of list) {
      const returnSn = r.return_sn;
      const firstItem = r.item?.[0];

      const existing = await db
        .select({ id: shopeeReturns.id, status: shopeeReturns.status })
        .from(shopeeReturns)
        .where(eq(shopeeReturns.returnSn, returnSn))
        .limit(1);

      const data = {
        shopId: shop.shopId,
        returnSn,
        orderSn: r.order_sn || null,
        buyerName: r.user?.username || null,
        reason: r.reason || null,
        textReason: r.text_reason || null,
        imageUrls: r.image && r.image.length > 0 ? JSON.stringify(r.image) : null,
        videoUrls:
          r.buyer_videos && r.buyer_videos.length > 0
            ? JSON.stringify(r.buyer_videos.map((v) => v.video_url))
            : null,
        status: r.status || null,
        refundAmount: r.refund_amount != null ? String(r.refund_amount) : null,
        itemId: firstItem ? String(firstItem.item_id) : null,
        itemName: firstItem?.name?.slice(0, 500) || null,
        itemSku: firstItem?.item_sku?.slice(0, 100) || null,
        itemPrice: firstItem?.item_price != null ? String(firstItem.item_price) : null,
        amount: firstItem?.amount || null,
        createdAt: new Date(r.create_time * 1000),
        updatedAt: new Date(r.update_time * 1000),
      };

      if (existing.length === 0) {
        await db.insert(shopeeReturns).values(data);
        inserted++;
      } else if (existing[0].status !== data.status) {
        // Status mudou — atualiza
        await db.update(shopeeReturns).set(data).where(eq(shopeeReturns.id, existing[0].id));
        updated++;
      }
    }

    windowEnd = windowStart - 1;
    await new Promise((r) => setTimeout(r, 300));
  }

  return { fetched: totalFetched, inserted, updated };
}

export async function syncAllShopsReturns(monthsBack = 3): Promise<{
  shops: number;
  fetched: number;
  inserted: number;
  updated: number;
}> {
  const shops = await getConnectedShops();
  let totalFetched = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  for (const shop of shops) {
    try {
      const r = await syncReturns(shop, monthsBack);
      totalFetched += r.fetched;
      totalInserted += r.inserted;
      totalUpdated += r.updated;
      console.log(
        `[Shopee Returns] ${shop.shopName}: fetched=${r.fetched} inserted=${r.inserted} updated=${r.updated}`,
      );
    } catch (err: any) {
      console.error(`[Shopee Returns] ${shop.shopName} erro:`, err.message);
    }
  }
  return { shops: shops.length, fetched: totalFetched, inserted: totalInserted, updated: totalUpdated };
}
