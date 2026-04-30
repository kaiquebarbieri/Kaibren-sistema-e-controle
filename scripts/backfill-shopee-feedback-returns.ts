/**
 * Backfill de feedback (reviews) e returns (devoluções) Shopee.
 * Roda 1x manual após criar coletores. Depois cron incremental cuida.
 */
import "dotenv/config";
import { syncAllShopsFeedback } from "../server/shopee-feedback";
import { syncAllShopsReturns } from "../server/shopee-returns";

async function main() {
  console.log("=== BACKFILL FEEDBACK ===");
  const fb = await syncAllShopsFeedback({ fullBackfill: true });
  console.log("Resultado:", fb);

  console.log("\n=== BACKFILL RETURNS (12 meses) ===");
  const rt = await syncAllShopsReturns(12);
  console.log("Resultado:", rt);

  process.exit(0);
}

main().catch((e) => {
  console.error("ERRO BACKFILL:", e?.message || e);
  process.exit(1);
});
