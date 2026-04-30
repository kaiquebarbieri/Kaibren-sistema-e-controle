import "dotenv/config";
import { fetchAndSaveShopeeOrders } from "../server/shopee";
import { runProactiveMessages } from "../server/agents/sam-chat/proactive-messages";

async function main() {
  console.log("[1/2] Re-sincronizando pedidos Shopee últimos 2 dias (pra capturar buyer_user_id)...");
  const saved = await fetchAndSaveShopeeOrders(2);
  console.log(`  → ${saved} pedidos novos salvos`);

  console.log("\n[2/2] Rodando runProactiveMessages...");
  const result = await runProactiveMessages({ limit: 30 });
  console.log("\nResultado:");
  console.log(JSON.stringify(result, null, 2));

  process.exit(0);
}

main().catch((err) => {
  console.error("ERRO:", err);
  process.exit(1);
});
