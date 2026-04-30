/**
 * Sam Proactive Messages — mensagem automática pós-compra (Shopee).
 *
 * Pra cada pedido novo (READY_TO_SHIP / PROCESSED) das últimas 24h:
 *  1. Verifica se já enviamos mensagem (UNIQUE shopee_proactive_messages.orderSn)
 *  2. Mapeia o item do pedido pro anúncio em shopee_chat_knowledge
 *  3. Se anúncio tem alertas ou modelos_compativeis, monta template
 *  4. Envia (autosend) ou notifica Telegram (shadow)
 *  5. Registra no tracking
 *
 * Flag: SHOPEE_PROACTIVE_AUTOSEND=true|false (default false = shadow)
 */

import { and, desc, eq, gte, isNull, ne, or, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  marketplaceOrders,
  shopeeChatKnowledge,
  shopeeProactiveMessages,
} from "../../../drizzle/schema";
import {
  fetchAndSaveShopeeOrders,
  getConnectedShops,
  type ShopeeShop,
} from "../../shopee";
import {
  logChatEvent,
  recordOutgoingMessage,
  sendProactiveMessage,
  sendTextMessage,
} from "../../shopee-chat";
import { sendTelegram } from "../noah/telegram";

const AUTOSEND = process.env.SHOPEE_PROACTIVE_AUTOSEND === "true";
const LOOKBACK_HOURS = Number(process.env.SHOPEE_PROACTIVE_LOOKBACK_HOURS || 24);

// Template base — mensagem literal aprovada pelo Kaique, adaptada pelo tipo de aparelho
const TEMPLATES: Record<string, string> = {
  airfryer: `Para garantir que você receba a peça correta, preciso confirmar o modelo exato da sua Air Fryer.

Por favor, verifique a etiqueta que fica na parte de baixo do aparelho e me envie:

O modelo por escrito
ou
Uma foto da etiqueta

Com essa informação, eu faço a confirmação do modelo e separo a peça certa para o seu envio.

Fico no aguardo.`,

  liquidificador: `Para garantir que você receba a peça correta, preciso confirmar o modelo exato do seu liquidificador.

Por favor, verifique a etiqueta que fica na parte de baixo do aparelho e me envie:

O modelo por escrito
ou
Uma foto da etiqueta

Com essa informação, eu faço a confirmação do modelo e separo a peça certa para o seu envio.

Fico no aguardo.`,

  ventilador: `Para garantir que você receba a peça correta, preciso confirmar o modelo exato do seu ventilador.

Por favor, verifique a etiqueta de identificação do aparelho e me envie:

O modelo por escrito
ou
Uma foto da etiqueta

Com essa informação, eu faço a confirmação do modelo e separo a peça certa para o seu envio.

Fico no aguardo.`,

  batedeira: `Para garantir que você receba a peça correta, preciso confirmar o modelo exato da sua batedeira.

Por favor, verifique a etiqueta que fica na parte de baixo do aparelho e me envie:

O modelo por escrito
ou
Uma foto da etiqueta

Com essa informação, eu faço a confirmação do modelo e separo a peça certa para o seu envio.

Fico no aguardo.`,

  generico: `Para garantir que você receba a peça correta, preciso confirmar o modelo exato do seu aparelho.

Por favor, verifique a etiqueta de identificação do aparelho e me envie:

O modelo por escrito
ou
Uma foto da etiqueta

Com essa informação, eu faço a confirmação do modelo e separo a peça certa para o seu envio.

Fico no aguardo.`,
};

function templateKeyForAparelho(tipoAparelho: string | null | undefined): string {
  const t = (tipoAparelho || "").toLowerCase();
  if (t.includes("air") || t.includes("fritadeira")) return "airfryer";
  if (t.includes("liquidif")) return "liquidificador";
  if (t.includes("ventila")) return "ventilador";
  if (t.includes("batedeira")) return "batedeira";
  return "generico";
}

function buildMessage(
  tipoAparelho: string | null | undefined,
  alertas: string[],
): { text: string; templateKey: string } {
  const key = templateKeyForAparelho(tipoAparelho);
  let text = TEMPLATES[key];

  if (alertas && alertas.length > 0) {
    const alertasFormatadas = alertas.map((a) => `- ${a}`).join("\n");
    text += `\n\nImportante:\n${alertasFormatadas}`;
  }

  return { text, templateKey: key };
}

interface OrderItem {
  itemId?: string;
  name: string;
  quantity?: number;
  unitPrice?: number;
  image?: string;
  sku?: string;
}

interface StructuredData {
  marca?: string | null;
  tipo_aparelho?: string | null;
  tipo_peca?: string | null;
  modelos_compativeis?: string[];
  capacidades?: string[];
  voltagens?: string[];
  alertas?: string[];
  extraction_status?: string;
}

async function findStructuredForItem(itemId: string): Promise<StructuredData | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ structuredData: shopeeChatKnowledge.structuredData })
    .from(shopeeChatKnowledge)
    .where(
      and(
        eq(shopeeChatKnowledge.type, "produto"),
        eq(shopeeChatKnowledge.scope, `shopee:${itemId}`),
      ),
    )
    .limit(1);
  if (rows.length === 0 || !rows[0].structuredData) return null;
  try {
    return JSON.parse(rows[0].structuredData);
  } catch {
    return null;
  }
}

async function alreadyNotified(orderSn: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: shopeeProactiveMessages.id })
    .from(shopeeProactiveMessages)
    .where(eq(shopeeProactiveMessages.orderSn, orderSn))
    .limit(1);
  return rows.length > 0;
}

async function notifyTelegramShadow(args: {
  orderSn: string;
  buyerName: string;
  productName: string;
  message: string;
  alertasCount: number;
}) {
  const lines = [
    `🛒 *Sam — Mensagem proativa pendente (shadow)*`,
    "",
    `*Pedido:* ${args.orderSn}`,
    `*Cliente:* ${args.buyerName}`,
    `*Produto:* ${args.productName}`,
    `*Alertas detectados:* ${args.alertasCount}`,
    "",
    `*Mensagem composta:*`,
    `_${args.message.slice(0, 1500)}_`,
    "",
    `Modo shadow: NÃO foi enviada. Aprove ativando \`SHOPEE_PROACTIVE_AUTOSEND=true\` no .env e reiniciando.`,
  ];
  await sendTelegram(lines.join("\n"));
}

export async function runProactiveMessages(
  options: { force?: boolean; limit?: number } = {},
): Promise<{
  scanned: number;
  sent: number;
  shadowed: number;
  skipped: number;
  failed: number;
  reasons: Record<string, number>;
}> {
  const db = await getDb();
  const reasons: Record<string, number> = {};
  if (!db) return { scanned: 0, sent: 0, shadowed: 0, skipped: 0, failed: 0, reasons };

  // Garante pedidos recentes sincronizados (não-blocking pra não atrasar)
  fetchAndSaveShopeeOrders(2).catch(() => null);

  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const orders = await db
    .select()
    .from(marketplaceOrders)
    .where(
      and(
        eq(marketplaceOrders.platform, "shopee"),
        gte(marketplaceOrders.platformCreatedAt, since),
        // status pago e não cancelado
        sql`${marketplaceOrders.status} IN ('ready_to_ship','processed','paid','invoice_pending')`,
      ),
    )
    .orderBy(desc(marketplaceOrders.platformCreatedAt))
    .limit(options.limit ?? 50);

  const shops = await getConnectedShops();
  const shopByName = new Map<string, ShopeeShop>(shops.map((s) => [s.shopName, s]));

  let sent = 0;
  let shadowed = 0;
  let skipped = 0;
  let failed = 0;

  const bumpReason = (r: string) => {
    reasons[r] = (reasons[r] || 0) + 1;
  };

  for (const order of orders) {
    const orderSn = order.externalId.replace(/^SHOPEE-/, "");

    // 1. Já processado?
    if (await alreadyNotified(orderSn)) {
      skipped++;
      bumpReason("already_processed");
      continue;
    }

    // 2. Tem buyerExternalId?
    if (!order.buyerExternalId) {
      await db.insert(shopeeProactiveMessages).values({
        shopId: shops.find((s) => s.shopName === order.accountName)?.shopId || "unknown",
        orderSn,
        buyerId: "missing",
        buyerName: order.buyerName,
        status: "skipped",
        errorMsg: "buyer_user_id ausente — pedido antigo, próximo sync vai backfillar",
      });
      skipped++;
      bumpReason("no_buyer_id");
      continue;
    }

    // 3. Tem itens com itemId?
    let items: OrderItem[] = [];
    try {
      items = JSON.parse(order.itemsJson || "[]");
    } catch {
      items = [];
    }
    const firstItem = items.find((i) => i.itemId) || items[0];
    if (!firstItem || !firstItem.itemId) {
      await db.insert(shopeeProactiveMessages).values({
        shopId: shops.find((s) => s.shopName === order.accountName)?.shopId || "unknown",
        orderSn,
        buyerId: order.buyerExternalId,
        buyerName: order.buyerName,
        productName: order.productName,
        status: "skipped",
        errorMsg: "item_id ausente — pedido antigo (precisa re-sync)",
      });
      skipped++;
      bumpReason("no_item_id");
      continue;
    }

    // 4. Anúncio está catalogado e tem alertas/modelos?
    const structured = await findStructuredForItem(firstItem.itemId);
    if (!structured) {
      await db.insert(shopeeProactiveMessages).values({
        shopId: shops.find((s) => s.shopName === order.accountName)?.shopId || "unknown",
        orderSn,
        buyerId: order.buyerExternalId,
        buyerName: order.buyerName,
        itemId: firstItem.itemId,
        productName: firstItem.name,
        status: "skipped",
        errorMsg: "anúncio ainda não extraído pelo Sam (aguardar curator/extractor)",
      });
      skipped++;
      bumpReason("not_extracted");
      continue;
    }

    const hasAlertas = (structured.alertas?.length || 0) > 0;
    const hasModelos = (structured.modelos_compativeis?.length || 0) > 0;
    if (!hasAlertas && !hasModelos) {
      // Produto genérico (sem compatibilidade específica) — não precisa msg
      await db.insert(shopeeProactiveMessages).values({
        shopId: shops.find((s) => s.shopName === order.accountName)?.shopId || "unknown",
        orderSn,
        buyerId: order.buyerExternalId,
        buyerName: order.buyerName,
        itemId: firstItem.itemId,
        productName: firstItem.name,
        status: "skipped",
        errorMsg: "produto genérico (sem alertas nem modelos específicos)",
      });
      skipped++;
      bumpReason("generic_product");
      continue;
    }

    // 5. Monta mensagem
    const { text, templateKey } = buildMessage(
      structured.tipo_aparelho,
      structured.alertas || [],
    );

    const shop = shopByName.get(order.accountName);
    if (!shop) {
      await db.insert(shopeeProactiveMessages).values({
        shopId: "unknown",
        orderSn,
        buyerId: order.buyerExternalId,
        buyerName: order.buyerName,
        itemId: firstItem.itemId,
        productName: firstItem.name,
        templateUsed: templateKey,
        messageSent: text,
        status: "failed",
        errorMsg: `loja '${order.accountName}' não conectada`,
      });
      failed++;
      bumpReason("shop_not_connected");
      continue;
    }

    // 6. Envia ou shadow
    const baseRecord = {
      shopId: shop.shopId,
      orderSn,
      buyerId: order.buyerExternalId,
      buyerName: order.buyerName,
      itemId: firstItem.itemId,
      productName: firstItem.name,
      templateUsed: templateKey,
      messageSent: text,
    };

    if (AUTOSEND || options.force) {
      try {
        const result = await sendProactiveMessage(
          shop,
          Number(order.buyerExternalId),
          orderSn,
          text,
        );
        await db.insert(shopeeProactiveMessages).values({
          ...baseRecord,
          messageId: result.messageId || null,
          status: "sent",
        });
        // Loga como mensagem outgoing pro chat ficar com histórico
        try {
          // Conversation pode não existir ainda — tudo bem, recordOutgoingMessage usa string
          // Se quiser, syncConversations vai pegar essa mensagem no próximo tick
        } catch {}
        await logChatEvent(
          "proactive_sent",
          {
            orderSn,
            buyerId: order.buyerExternalId,
            templateKey,
            alertasCount: structured.alertas?.length || 0,
          },
          undefined,
        );
        sent++;
        bumpReason("sent");
      } catch (err: any) {
        await db.insert(shopeeProactiveMessages).values({
          ...baseRecord,
          status: "failed",
          errorMsg: `envio Shopee falhou: ${err?.message || "erro desconhecido"}`,
        });
        failed++;
        bumpReason("send_error");
      }
    } else {
      // Shadow: notifica Telegram, registra mas não envia
      try {
        await notifyTelegramShadow({
          orderSn,
          buyerName: order.buyerName,
          productName: firstItem.name,
          message: text,
          alertasCount: structured.alertas?.length || 0,
        });
      } catch (err: any) {
        console.error("[Sam Proactive] erro Telegram shadow:", err?.message);
      }
      await db.insert(shopeeProactiveMessages).values({
        ...baseRecord,
        status: "shadow",
      });
      shadowed++;
      bumpReason("shadow");
    }
  }

  return { scanned: orders.length, sent, shadowed, skipped, failed, reasons };
}
