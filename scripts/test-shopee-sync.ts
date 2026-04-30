import "dotenv/config";
import { syncAllShops } from "../server/shopee-chat";

async function main() {
  console.log("Iniciando sync de chats Shopee...");
  const result = await syncAllShops();
  console.log("Resultado:", result);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
