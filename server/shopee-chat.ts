/**
 * Shopee API v2 — Sellerchat
 *
 * Endpoints:
 *  - /api/v2/sellerchat/get_conversation_list
 *  - /api/v2/sellerchat/get_message
 *  - /api/v2/sellerchat/send_message
 */

import crypto from "crypto";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "./db";
import { shopeeConversations, shopeeMessages, shopeeChatEvents, shopeeChatKnowledge, type ShopeeMessage } from "../drizzle/schema";
import { getConnectedShops, PARTNER_ID, PARTNER_KEY, HOST, type ShopeeShop } from "./shopee";

function signShop(path: string, ts: number, token: string, shopId: string) {
  const base = `${PARTNER_ID}${path}${ts}${token}${shopId}`;
  return crypto.createHmac("sha256", PARTNER_KEY).update(base).digest("hex");
}

async function shopeeChatGet(path: string, shop: ShopeeShop, params: Record<string, string>): Promise<any> {
  const ts = Math.floor(Date.now() / 1000);
  const sign = signShop(path, ts, shop.accessToken, shop.shopId);
  const qs = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: String(ts),
    access_token: shop.accessToken,
    shop_id: shop.shopId,
    sign,
    ...params,
  });
  const res = await fetch(`${HOST}${path}?${qs.toString()}`);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Shopee ${path}: ${data.error || res.status} - ${data.message || ""}`);
  }
  return data.response;
}

async function shopeeChatPost(path: string, shop: ShopeeShop, body: any): Promise<any> {
  const ts = Math.floor(Date.now() / 1000);
  const sign = signShop(path, ts, shop.accessToken, shop.shopId);
  const qs = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: String(ts),
    access_token: shop.accessToken,
    shop_id: shop.shopId,
    sign,
  });
  const res = await fetch(`${HOST}${path}?${qs.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Shopee ${path}: ${data.error || res.status} - ${data.message || ""}`);
  }
  return data.response;
}

// ---------- API wrappers ----------

export interface ShopeeConversationApi {
  conversation_id: string;
  to_id: number;
  to_name: string;
  to_avatar?: string;
  shop_id: number;
  unread_count: number;
  last_read_message_id?: string;
  latest_message_id?: string;
  latest_message_type?: string;
  latest_message_content?: { text?: string };
  latest_message_from_id?: number;
  last_message_timestamp: number;
}

export async function listConversations(shop: ShopeeShop, pageSize = 25): Promise<ShopeeConversationApi[]> {
  // Shopee Open Platform: pra trazer as conversas mais recentes, precisa direction=older + next_timestamp_nano=now.
  // Com direction=latest sem timestamp, fica preso nas conversas mais antigas (bug detectado 2026-04-28).
  const data = await shopeeChatGet("/api/v2/sellerchat/get_conversation_list", shop, {
    direction: "older",
    type: "all",
    page_size: String(pageSize),
    next_timestamp_nano: String(Date.now() * 1_000_000),
  });
  return data?.conversations || [];
}

export interface ShopeeMessageApi {
  message_id: string;
  message_type: string;
  from_id: number;
  from_shop_id: number;
  to_id: number;
  to_shop_id: number;
  conversation_id: string;
  created_timestamp: number;
  region: string;
  status: string;
  content: any;
}

export async function getMessages(shop: ShopeeShop, conversationId: string, pageSize = 25): Promise<ShopeeMessageApi[]> {
  const data = await shopeeChatGet("/api/v2/sellerchat/get_message", shop, {
    conversation_id: conversationId,
    page_size: String(pageSize),
  });
  return data?.messages || [];
}

export async function sendTextMessage(shop: ShopeeShop, toId: number, text: string): Promise<{ messageId: string }> {
  const data = await shopeeChatPost("/api/v2/sellerchat/send_message", shop, {
    to_id: toId,
    message_type: "text",
    content: { text },
  });
  return { messageId: data?.message_id ? String(data.message_id) : "" };
}

/**
 * Envia mensagem proativa pra cliente que nunca conversou antes.
 * Shopee exige primeira mensagem com referência ao pedido (anti-spam).
 * Manda order card primeiro, depois o texto.
 */
export async function sendProactiveMessage(
  shop: ShopeeShop,
  toId: number,
  orderSn: string,
  text: string,
): Promise<{ messageId: string }> {
  // 1. Card do pedido (estabelece a conversa)
  await shopeeChatPost("/api/v2/sellerchat/send_message", shop, {
    to_id: toId,
    message_type: "order",
    content: { order_sn: orderSn },
  });

  // 2. Texto da mensagem
  const data = await shopeeChatPost("/api/v2/sellerchat/send_message", shop, {
    to_id: toId,
    message_type: "text",
    content: { text },
  });

  return { messageId: data?.message_id ? String(data.message_id) : "" };
}

// ---------- Sync e persistência ----------

function shopeeTsToDate(ts: number | string | undefined): Date | null {
  if (!ts) return null;
  const n = typeof ts === "string" ? Number(ts) : ts;
  if (!Number.isFinite(n) || n <= 0) return null;
  // Shopee chat usa formatos distintos:
  //  - get_conversation_list.last_message_timestamp → nanossegundos (19 dígitos)
  //  - get_message.created_timestamp → segundos (10 dígitos)
  //  - alguns campos → milissegundos (13 dígitos)
  if (n >= 1e17) return new Date(Math.floor(n / 1_000_000));
  if (n >= 1e12) return new Date(n);
  if (n >= 1e9) return new Date(n * 1000);
  return null;
}

function extractText(content: any): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (typeof content.text === "string") return content.text;
  if (typeof content.message === "string") return content.message;
  return JSON.stringify(content).slice(0, 500);
}

/**
 * Quando o sync detecta uma resposta do seller que NÃO foi enviada pelo Sam (via API),
 * ela veio do app/Seller Center (Kaique ou Brenda respondendo manualmente).
 * Capturamos como aprendizado: par {pergunta cliente → resposta humana} vira referência
 * pra futuras decisões do responder.
 *
 * Discriminador: msgs do Sam são gravadas antes do sync via recordOutgoingMessage com
 * messageId real da API; o sync pula essas (already exists). O que sobra como nova msg
 * seller no get_message é genuinamente humano.
 */
async function captureManualSellerReply(
  shop: ShopeeShop,
  conversationId: string,
  sellerText: string,
  sellerSentAt: Date,
  buyerName: string | null,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const trimmed = (sellerText || "").trim();
  if (trimmed.length < 5) return; // ignora respostas vazias / "ok"

  // Última msg do buyer ANTES desta resposta — é a pergunta que motivou
  const buyerRows = await db
    .select({ content: shopeeMessages.content, sentAt: shopeeMessages.sentAt })
    .from(shopeeMessages)
    .where(
      and(
        eq(shopeeMessages.shopId, shop.shopId),
        eq(shopeeMessages.conversationId, conversationId),
        eq(shopeeMessages.fromRole, "buyer"),
        lt(shopeeMessages.sentAt, sellerSentAt),
      ),
    )
    .orderBy(desc(shopeeMessages.sentAt))
    .limit(1);

  if (buyerRows.length === 0) return; // sem pergunta correspondente — pode ser msg proativa
  const buyerText = (buyerRows[0].content || "").trim();
  if (buyerText.length < 3) return;

  await db.insert(shopeeChatKnowledge).values({
    type: "aprendizado",
    scope: `conv:${conversationId}`,
    title: `Resposta humana → ${buyerName || "cliente"}`,
    body: `**Pergunta cliente:** ${buyerText.slice(0, 1000)}\n\n**Resposta Kaibren (app):** ${trimmed.slice(0, 1500)}`,
    source: "learned",
  });

  await logChatEvent(
    "manual_reply_captured",
    {
      buyerPreview: buyerText.slice(0, 200),
      sellerPreview: trimmed.slice(0, 200),
      origin: "app_or_seller_center",
    },
    conversationId,
  );
}

export async function syncConversations(shop: ShopeeShop): Promise<{ conversations: number; newMessages: number }> {
  const db = await getDb();
  if (!db) return { conversations: 0, newMessages: 0 };

  const apiConversations = await listConversations(shop, 50);
  let newMessages = 0;

  for (const c of apiConversations) {
    const latestAt = shopeeTsToDate(c.last_message_timestamp);
    const latestText = extractText(c.latest_message_content);
    // latest_message_from_id é user_id, não shop_id. Compara com to_id (= cliente do ponto de vista da loja).
    // Se quem mandou por último é o "to_id", é buyer. Se é qualquer user_id da loja (master ou subconta), é seller.
    const fromBuyer = c.latest_message_from_id === c.to_id;

    // upsert conversa
    const existing = await db
      .select()
      .from(shopeeConversations)
      .where(
        and(
          eq(shopeeConversations.shopId, shop.shopId),
          eq(shopeeConversations.conversationId, c.conversation_id),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(shopeeConversations).values({
        shopId: shop.shopId,
        conversationId: c.conversation_id,
        buyerId: String(c.to_id),
        buyerName: c.to_name || null,
        buyerAvatar: c.to_avatar || null,
        unreadCount: c.unread_count || 0,
        latestMessageId: c.latest_message_id || null,
        latestMessageText: latestText.slice(0, 1000),
        latestMessageFrom: fromBuyer ? "buyer" : "seller",
        latestMessageAt: latestAt,
        status: c.unread_count > 0 ? "open" : "answered",
        agentLastAction: "none",
      });
    } else {
      await db
        .update(shopeeConversations)
        .set({
          buyerName: c.to_name || existing[0].buyerName,
          buyerAvatar: c.to_avatar || existing[0].buyerAvatar,
          unreadCount: c.unread_count || 0,
          latestMessageId: c.latest_message_id || existing[0].latestMessageId,
          latestMessageText: latestText.slice(0, 1000),
          latestMessageFrom: fromBuyer ? "buyer" : "seller",
          latestMessageAt: latestAt || existing[0].latestMessageAt,
          status: c.unread_count > 0 && fromBuyer ? "open" : existing[0].status,
        })
        .where(eq(shopeeConversations.id, existing[0].id));
    }

    // sincronizar mensagens se: (a) tem unread, (b) conversa nova, ou (c) latest_message_id
    // mudou desde último sync — caso de seller respondendo pelo app (não incrementa unread).
    const latestIdChanged =
      existing.length > 0 &&
      c.latest_message_id &&
      c.latest_message_id !== existing[0].latestMessageId;
    if (c.unread_count > 0 || existing.length === 0 || latestIdChanged) {
      const rawMessages = await getMessages(shop, c.conversation_id, 25);
      // Ordena cronologicamente — captura de aprendizado precisa que a msg buyer
      // anterior já esteja no banco quando a seller for processada.
      const apiMessages = [...rawMessages].sort((a, b) => {
        const ta = Number(a.created_timestamp) || 0;
        const tb = Number(b.created_timestamp) || 0;
        return ta - tb;
      });
      for (const m of apiMessages) {
        const exists = await db
          .select({ id: shopeeMessages.id })
          .from(shopeeMessages)
          .where(
            and(
              eq(shopeeMessages.shopId, shop.shopId),
              eq(shopeeMessages.messageId, m.message_id),
            ),
          )
          .limit(1);
        if (exists.length > 0) continue;

        const isShop = m.from_shop_id === Number(shop.shopId);
        const sentAt = shopeeTsToDate(m.created_timestamp) || new Date();
        const msgText = extractText(m.content).slice(0, 4000);
        await db.insert(shopeeMessages).values({
          shopId: shop.shopId,
          conversationId: c.conversation_id,
          messageId: m.message_id,
          fromId: String(m.from_id),
          fromRole: isShop ? "seller" : "buyer",
          messageType: m.message_type || "text",
          content: msgText,
          sentAt,
        });
        newMessages++;

        // Resposta da loja que apareceu no sync (não veio da nossa API) = humana via app/Seller Center.
        // Captura par pergunta→resposta como aprendizado. Só pra mensagens de texto.
        if (isShop && (m.message_type || "text") === "text") {
          try {
            await captureManualSellerReply(
              shop,
              c.conversation_id,
              msgText,
              sentAt,
              c.to_name || null,
            );
          } catch (err: any) {
            console.error("[Sam capture] falhou:", err?.message);
          }
        }
      }
    }
  }

  await db.insert(shopeeChatEvents).values({
    eventType: "sync",
    payload: JSON.stringify({ shopId: shop.shopId, conversations: apiConversations.length, newMessages }),
  });

  return { conversations: apiConversations.length, newMessages };
}

export async function syncAllShops(): Promise<{ shops: number; conversations: number; newMessages: number }> {
  const shops = await getConnectedShops();
  let totalConv = 0;
  let totalNew = 0;
  for (const shop of shops) {
    try {
      const r = await syncConversations(shop);
      totalConv += r.conversations;
      totalNew += r.newMessages;
    } catch (err: any) {
      console.error(`[Shopee Chat] Sync falhou ${shop.shopName}:`, err.message);
    }
  }
  return { shops: shops.length, conversations: totalConv, newMessages: totalNew };
}

export async function logChatEvent(eventType: string, payload: any, conversationId?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(shopeeChatEvents).values({
    conversationId: conversationId || null,
    eventType,
    payload: JSON.stringify(payload).slice(0, 4000),
  });
}

export async function recordOutgoingMessage(
  shop: ShopeeShop,
  conversationId: string,
  messageId: string,
  text: string,
  source: "ai_auto" | "ai_shadow" | "kaique_refined" | "kaique_raw",
  confidence?: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(shopeeMessages).values({
    shopId: shop.shopId,
    conversationId,
    messageId: messageId || `local-${Date.now()}`,
    fromId: shop.shopId,
    fromRole: "agent",
    messageType: "text",
    content: text.slice(0, 4000),
    agentSource: source,
    agentConfidence: confidence ?? null,
    sentAt: new Date(),
  });
}

export { signShop as signShopChat };
