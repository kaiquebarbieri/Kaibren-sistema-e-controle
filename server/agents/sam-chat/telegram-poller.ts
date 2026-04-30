/**
 * Telegram Poller — captura respostas do Kaique no chat privado do Noah.
 *
 * Quando Kaique responde uma mensagem do bot que tem o marker `_conv:CONV_ID_`,
 * detectamos o conversationId, refinamos o texto e enviamos pro cliente Shopee.
 */

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import {
  shopeeChatKnowledge,
  shopeeConversations,
  shopeeMessages,
} from "../../../drizzle/schema";
import { getConnectedShops } from "../../shopee";
import { logChatEvent, recordOutgoingMessage, sendTextMessage } from "../../shopee-chat";
import { sendTelegram } from "../noah/telegram";
import { invalidateKbCache, refineKaiqueMessage } from "./responder";

let lastUpdateId = 0;

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string };
    chat: { id: number };
    text?: string;
    reply_to_message?: { text?: string; message_id?: number };
    date: number;
  };
}

const CONV_TAG = /_conv:([0-9]+)_/;

async function getUpdates(token: string, offset: number): Promise<TelegramUpdate[]> {
  const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=0&allowed_updates=${encodeURIComponent(
    JSON.stringify(["message"]),
  )}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`getUpdates HTTP ${res.status}`);
  }
  const data: any = await res.json();
  if (!data.ok) throw new Error(`getUpdates: ${data.description}`);
  return data.result || [];
}

async function handleReply(
  conversationId: string,
  rawText: string,
  kaiqueMessageId?: number,
): Promise<{ ok: boolean; info: string }> {
  const db = await getDb();
  if (!db) return { ok: false, info: "db indisponível" };

  const convs = await db
    .select()
    .from(shopeeConversations)
    .where(eq(shopeeConversations.conversationId, conversationId))
    .limit(1);
  if (convs.length === 0) return { ok: false, info: "conversa não encontrada" };
  const conv = convs[0];

  const shops = await getConnectedShops();
  const shop = shops.find((s) => s.shopId === conv.shopId);
  if (!shop) return { ok: false, info: "shop não conectada" };

  const recent = await db
    .select()
    .from(shopeeMessages)
    .where(
      and(
        eq(shopeeMessages.shopId, conv.shopId),
        eq(shopeeMessages.conversationId, conversationId),
      ),
    )
    .orderBy(desc(shopeeMessages.sentAt))
    .limit(6);
  const contextHistory = recent
    .reverse()
    .map((r) => `[${r.fromRole}] ${r.content}`)
    .join("\n");

  const refined = await refineKaiqueMessage(rawText, contextHistory);

  try {
    const sent = await sendTextMessage(shop, Number(conv.buyerId), refined);
    await recordOutgoingMessage(
      shop,
      conversationId,
      sent.messageId,
      refined,
      "kaique_refined",
    );
    await db
      .update(shopeeConversations)
      .set({ status: "answered", agentLastAction: "kaique_replied" })
      .where(eq(shopeeConversations.id, conv.id));

    // Salva aprendizado: a versão refinada vira referência futura
    await db.insert(shopeeChatKnowledge).values({
      type: "aprendizado",
      scope: `conv:${conversationId}`,
      title: `Resposta Kaique → ${conv.buyerName || conv.buyerId}`,
      body: `**Pergunta cliente:** ${conv.latestMessageText || ""}\n\n**Resposta Kaibren:** ${refined}`,
      source: "learned",
    });
    invalidateKbCache();

    await logChatEvent(
      "kaique_replied",
      { raw: rawText.slice(0, 300), refined: refined.slice(0, 300), kaiqueMessageId },
      conversationId,
    );

    return { ok: true, info: refined };
  } catch (err: any) {
    await logChatEvent(
      "error",
      { stage: "kaique_send", message: err?.message },
      conversationId,
    );
    return { ok: false, info: `erro envio Shopee: ${err?.message}` };
  }
}

export async function pollKaiqueReplies(): Promise<{ updates: number; handled: number }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { updates: 0, handled: 0 };

  let updates: TelegramUpdate[] = [];
  try {
    updates = await getUpdates(token, lastUpdateId + 1);
  } catch (err: any) {
    console.error("[Sam Telegram] getUpdates erro:", err.message);
    return { updates: 0, handled: 0 };
  }

  const allowedChat = process.env.TELEGRAM_CHAT_KAIQUE;
  let handled = 0;

  for (const u of updates) {
    if (u.update_id > lastUpdateId) lastUpdateId = u.update_id;
    const msg = u.message;
    if (!msg || !msg.text) continue;
    if (allowedChat && String(msg.chat.id) !== allowedChat) continue;

    // Reply ao bot com tag _conv:XXX_
    const repliedText = msg.reply_to_message?.text || "";
    const match = repliedText.match(CONV_TAG);
    if (!match) {
      // Não é uma resposta a um pedido nosso
      continue;
    }

    const conversationId = match[1];
    const userText = msg.text.trim();
    if (!userText) continue;

    const result = await handleReply(conversationId, userText, msg.message_id);
    handled++;

    await sendTelegram(
      result.ok
        ? `✅ Enviado pro cliente:\n_${result.info.slice(0, 400)}_`
        : `❌ Falhou: ${result.info}`,
    );
  }

  return { updates: updates.length, handled };
}
