/**
 * Backfill de aprendizados Sam Chat.
 * Percorre todas msgs seller sem agent_source e gera par {pergunta buyer → resposta seller}
 * em shopee_chat_knowledge type=aprendizado source=learned.
 * Pula duplicatas via scope+title match.
 */
import "dotenv/config";
import { and, asc, desc, eq, isNull, lt } from "drizzle-orm";
import { getDb } from "../server/db";
import {
  shopeeChatKnowledge,
  shopeeConversations,
  shopeeMessages,
} from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DB indisponível");
    process.exit(1);
  }

  // Todas msgs seller sem agentSource (= não enviadas via API do Sam) e que sejam texto
  const sellerMsgs = await db
    .select()
    .from(shopeeMessages)
    .where(
      and(
        eq(shopeeMessages.fromRole, "seller"),
        isNull(shopeeMessages.agentSource),
        eq(shopeeMessages.messageType, "text"),
      ),
    )
    .orderBy(asc(shopeeMessages.sentAt));

  console.log(`Total msgs seller candidatas: ${sellerMsgs.length}`);

  let captured = 0;
  let skipped = 0;
  let dup = 0;

  for (const sm of sellerMsgs) {
    const text = (sm.content || "").trim();
    if (text.length < 5) {
      skipped++;
      continue;
    }

    // Última msg buyer anterior na mesma conversa
    const buyer = await db
      .select({ content: shopeeMessages.content })
      .from(shopeeMessages)
      .where(
        and(
          eq(shopeeMessages.shopId, sm.shopId),
          eq(shopeeMessages.conversationId, sm.conversationId),
          eq(shopeeMessages.fromRole, "buyer"),
          lt(shopeeMessages.sentAt, sm.sentAt),
        ),
      )
      .orderBy(desc(shopeeMessages.sentAt))
      .limit(1);

    if (buyer.length === 0) {
      skipped++;
      continue;
    }
    const buyerText = (buyer[0].content || "").trim();
    if (buyerText.length < 3) {
      skipped++;
      continue;
    }

    // Conversa pra pegar nome do buyer
    const conv = await db
      .select({ buyerName: shopeeConversations.buyerName, buyerId: shopeeConversations.buyerId })
      .from(shopeeConversations)
      .where(
        and(
          eq(shopeeConversations.shopId, sm.shopId),
          eq(shopeeConversations.conversationId, sm.conversationId),
        ),
      )
      .limit(1);
    const buyerName = conv[0]?.buyerName || conv[0]?.buyerId || "cliente";

    const title = `Resposta humana → ${buyerName}`;
    const body = `**Pergunta cliente:** ${buyerText.slice(0, 1000)}\n\n**Resposta Kaibren (app):** ${text.slice(0, 1500)}`;
    const scope = `conv:${sm.conversationId}:msg:${sm.messageId}`;

    // Dedup via scope (único por mensagem seller)
    const existing = await db
      .select({ id: shopeeChatKnowledge.id })
      .from(shopeeChatKnowledge)
      .where(
        and(
          eq(shopeeChatKnowledge.type, "aprendizado"),
          eq(shopeeChatKnowledge.scope, scope),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      dup++;
      continue;
    }

    await db.insert(shopeeChatKnowledge).values({
      type: "aprendizado",
      scope,
      title,
      body,
      source: "learned",
    });
    captured++;
  }

  console.log(`\nResultado:`);
  console.log(`  Capturados: ${captured}`);
  console.log(`  Já existiam: ${dup}`);
  console.log(`  Pulados (sem pergunta/curtos): ${skipped}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
