/**
 * Shopee Feedback (reviews) — coleta e responde avaliações.
 *
 * Endpoints usados:
 *  - /api/v2/product/get_comment           — lista comentários (paginação por cursor)
 *  - /api/v2/product/reply_comment         — responde um comentário
 */
import crypto from "crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "./db";
import { shopeeFeedback } from "../drizzle/schema";
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
  if (r.error) {
    throw new Error(`Shopee ${path}: ${r.error} - ${r.message || ""}`);
  }
  return r.response;
}

async function shopeePost(path: string, shop: ShopeeShop, body: any): Promise<any> {
  const ts = Math.floor(Date.now() / 1000);
  const sign = signShop(path, ts, shop.accessToken, shop.shopId);
  const u = new URL(`${HOST}${path}`);
  u.searchParams.set("partner_id", PARTNER_ID);
  u.searchParams.set("timestamp", String(ts));
  u.searchParams.set("access_token", shop.accessToken);
  u.searchParams.set("shop_id", shop.shopId);
  u.searchParams.set("sign", sign);
  const r = await (await fetch(u.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })).json();
  if (r.error) {
    throw new Error(`Shopee ${path}: ${r.error} - ${r.message || ""}`);
  }
  return r.response;
}

interface ShopeeCommentApi {
  comment_id: number;
  comment: string;
  buyer_username: string;
  order_sn: string;
  item_id: number;
  rating_star: number;
  create_time: number;
  hidden: boolean;
  editable: string;
  media?: { image_url_list?: string[]; video_url_list?: string[] };
  // Resposta do vendedor pode estar em campo separado dependendo da versão
  seller_reply?: string;
}

/**
 * Pagina via cursor até esgotar OU até passar do `untilTimestamp` (early-stop em sync incremental).
 * pageSize máx Shopee = 100.
 */
export async function fetchAllComments(
  shop: ShopeeShop,
  untilTimestamp?: number,
): Promise<ShopeeCommentApi[]> {
  const all: ShopeeCommentApi[] = [];
  let cursor = "0";
  let safety = 200; // proteção contra loop infinito (200 páginas × 100 = 20k reviews)

  while (safety-- > 0) {
    const data = await shopeeGet("/api/v2/product/get_comment", shop, {
      cursor,
      page_size: "100",
    });
    const list: ShopeeCommentApi[] = data?.item_comment_list || [];
    if (list.length === 0) break;

    // Early stop: se já passamos do timestamp limite, para
    if (untilTimestamp) {
      const oldestInPage = list[list.length - 1].create_time;
      const newRecords = list.filter((c) => c.create_time >= untilTimestamp);
      all.push(...newRecords);
      if (oldestInPage < untilTimestamp) break;
    } else {
      all.push(...list);
    }

    if (!data?.more) break;
    cursor = String(data.next_cursor || data.next_offset || "");
    if (!cursor || cursor === "0") break;

    // Anti rate-limit
    await new Promise((r) => setTimeout(r, 250));
  }

  return all;
}

/**
 * Sincroniza comentários de uma loja para o banco.
 * Se forçar `fullBackfill=true`, pega todos. Senão, só os mais recentes que o último sync.
 */
export async function syncFeedback(
  shop: ShopeeShop,
  options: { fullBackfill?: boolean } = {},
): Promise<{ fetched: number; inserted: number; updated: number }> {
  const db = await getDb();
  if (!db) return { fetched: 0, inserted: 0, updated: 0 };

  let untilTimestamp: number | undefined;
  if (!options.fullBackfill) {
    // Pega o mais recente já no banco e usa como cutoff
    const latest = await db
      .select({ commentedAt: shopeeFeedback.commentedAt })
      .from(shopeeFeedback)
      .where(eq(shopeeFeedback.shopId, shop.shopId))
      .orderBy(desc(shopeeFeedback.commentedAt))
      .limit(1);
    if (latest.length > 0) {
      untilTimestamp = Math.floor(latest[0].commentedAt.getTime() / 1000);
    }
  }

  const comments = await fetchAllComments(shop, untilTimestamp);

  let inserted = 0;
  let updated = 0;
  for (const c of comments) {
    const commentId = String(c.comment_id);
    const mediaImages = c.media?.image_url_list || [];
    const mediaVideos = c.media?.video_url_list || [];
    const allMedia = [...mediaImages, ...mediaVideos];
    const sellerReply = (c as any).seller_reply || "";

    const existing = await db
      .select({ id: shopeeFeedback.id, replySource: shopeeFeedback.replySource })
      .from(shopeeFeedback)
      .where(eq(shopeeFeedback.commentId, commentId))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(shopeeFeedback).values({
        shopId: shop.shopId,
        commentId,
        itemId: String(c.item_id || ""),
        orderSn: c.order_sn || null,
        buyerName: c.buyer_username || null,
        rating: c.rating_star || 0,
        commentText: c.comment || "",
        mediaUrls: allMedia.length > 0 ? JSON.stringify(allMedia) : null,
        hasVideo: mediaVideos.length > 0 ? 1 : 0,
        hidden: c.hidden ? 1 : 0,
        sellerReplyText: sellerReply || null,
        sellerRepliedAt: sellerReply ? new Date() : null,
        replySource: sellerReply ? "kaique" : "none",
        commentedAt: new Date(c.create_time * 1000),
      });
      inserted++;
    } else if (sellerReply && existing[0].replySource === "none") {
      // Reply chegou via app/painel — atualiza
      await db
        .update(shopeeFeedback)
        .set({
          sellerReplyText: sellerReply,
          sellerRepliedAt: new Date(),
          replySource: "kaique",
        })
        .where(eq(shopeeFeedback.id, existing[0].id));
      updated++;
    }
  }

  return { fetched: comments.length, inserted, updated };
}

export async function syncAllShopsFeedback(options: { fullBackfill?: boolean } = {}): Promise<{
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
      const r = await syncFeedback(shop, options);
      totalFetched += r.fetched;
      totalInserted += r.inserted;
      totalUpdated += r.updated;
      console.log(
        `[Shopee Feedback] ${shop.shopName}: fetched=${r.fetched} inserted=${r.inserted} updated=${r.updated}`,
      );
    } catch (err: any) {
      console.error(`[Shopee Feedback] ${shop.shopName} erro:`, err.message);
    }
  }
  return { shops: shops.length, fetched: totalFetched, inserted: totalInserted, updated: totalUpdated };
}

/**
 * Responde um comentário via API. Caller decide o texto (manual ou IA-gerado).
 */
export async function replyComment(
  shop: ShopeeShop,
  commentId: string,
  replyText: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await shopeePost("/api/v2/product/reply_comment", shop, {
      comment_list: [{ comment_id: Number(commentId), comment: replyText }],
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
