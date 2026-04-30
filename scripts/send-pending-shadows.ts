import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { shopeeProactiveMessages } from "../drizzle/schema";
import { getConnectedShops } from "../server/shopee";
import { sendProactiveMessage } from "../server/shopee-chat";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DB indisponível");
    process.exit(1);
  }

  const shadows = await db
    .select()
    .from(shopeeProactiveMessages)
    .where(eq(shopeeProactiveMessages.status, "shadow"));

  console.log(`${shadows.length} mensagens shadow encontradas\n`);

  const shops = await getConnectedShops();
  let sent = 0;
  let failed = 0;

  for (const m of shadows) {
    const shop = shops.find((s) => s.shopId === m.shopId);
    if (!shop) {
      console.log(`✗ ${m.orderSn}: shop ${m.shopId} não conectada`);
      failed++;
      continue;
    }
    try {
      const result = await sendProactiveMessage(
        shop,
        Number(m.buyerId),
        m.orderSn,
        m.messageSent || "",
      );
      await db
        .update(shopeeProactiveMessages)
        .set({
          status: "sent",
          messageId: result.messageId || null,
        })
        .where(eq(shopeeProactiveMessages.id, m.id));
      console.log(`✓ ${m.orderSn} → ${m.buyerName} (${m.productName?.slice(0, 50)}...)`);
      sent++;
    } catch (err: any) {
      await db
        .update(shopeeProactiveMessages)
        .set({
          status: "failed",
          errorMsg: `envio manual: ${err?.message}`,
        })
        .where(eq(shopeeProactiveMessages.id, m.id));
      console.log(`✗ ${m.orderSn}: ${err?.message}`);
      failed++;
    }
  }

  console.log(`\n→ ${sent} enviadas, ${failed} falhas`);
  process.exit(0);
}

main().catch((err) => {
  console.error("ERRO:", err);
  process.exit(1);
});
