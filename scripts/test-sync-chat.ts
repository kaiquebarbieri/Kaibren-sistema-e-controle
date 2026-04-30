import "dotenv/config";
import { syncAllShops } from "../server/shopee-chat";

async function main() {
  const r = await syncAllShops();
  console.log("Sync:", r);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
