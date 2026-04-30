import "dotenv/config";
import { respondNewMessages, refineKaiqueMessage } from "../server/agents/sam-chat/responder";
import { getDb } from "../server/db";
import { shopeeConversations } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  // Força 1 conversa antiga pra status=open pra testar o pipeline
  const db = await getDb();
  if (db) {
    await db
      .update(shopeeConversations)
      .set({ status: "open", latestMessageFrom: "buyer" })
      .where(eq(shopeeConversations.conversationId, "1503963532038592111"));
  }

  console.log("Rodando responder...");
  const r = await respondNewMessages();
  console.log("Resultado:", r);

  console.log("\nTestando refine...");
  const refined = await refineKaiqueMessage(
    "manda foto da etiqueta embaixo do produto pra ver o modelo",
  );
  console.log("Refinado:", refined);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
