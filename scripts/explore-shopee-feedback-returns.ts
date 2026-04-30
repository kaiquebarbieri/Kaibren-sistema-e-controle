/**
 * Explora endpoints de feedback (comments) e returns da Shopee.
 * Output: shape do JSON pra desenhar schema do banco.
 */
import "dotenv/config";
import crypto from "crypto";
import { getConnectedShops, PARTNER_ID, PARTNER_KEY, HOST } from "../server/shopee";

function signShop(path: string, ts: number, token: string, shopId: string) {
  const base = `${PARTNER_ID}${path}${ts}${token}${shopId}`;
  return crypto.createHmac("sha256", PARTNER_KEY).update(base).digest("hex");
}

async function call(path: string, shop: any, params: Record<string, string> = {}) {
  const ts = Math.floor(Date.now() / 1000);
  const sign = signShop(path, ts, shop.accessToken, shop.shopId);
  const u = new URL(`${HOST}${path}`);
  u.searchParams.set("partner_id", PARTNER_ID);
  u.searchParams.set("timestamp", String(ts));
  u.searchParams.set("access_token", shop.accessToken);
  u.searchParams.set("shop_id", shop.shopId);
  u.searchParams.set("sign", sign);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await (await fetch(u.toString())).json();
  return r;
}

async function main() {
  const shops = await getConnectedShops();
  const pecas = shops.find((s: any) => s.shopId === "843928049");
  if (!pecas) throw new Error("PecasMax não conectada");

  console.log("=== TESTE 1: get_comment (reviews dos produtos) ===");
  const comments = await call("/api/v2/product/get_comment", pecas, {
    cursor: "0",
    page_size: "5",
  });
  console.log(JSON.stringify(comments, null, 2).slice(0, 2500));

  console.log("\n\n=== TESTE 2: get_return_list (devoluções últimos 15d) ===");
  const fifteenDaysAgo = Math.floor(Date.now() / 1000) - 14 * 24 * 3600;
  const now = Math.floor(Date.now() / 1000);
  const returns = await call("/api/v2/returns/get_return_list", pecas, {
    page_no: "1",
    page_size: "5",
    create_time_from: String(fifteenDaysAgo),
    create_time_to: String(now),
  });
  console.log(JSON.stringify(returns, null, 2).slice(0, 3500));

  process.exit(0);
}

main().catch((e) => {
  console.error("ERRO:", e?.message || e);
  process.exit(1);
});
