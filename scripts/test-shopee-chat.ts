import crypto from "crypto";
import mysql from "mysql2/promise";
import "dotenv/config";

const PARTNER_ID = process.env.SHOPEE_PARTNER_ID!;
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY!;
const HOST = process.env.SHOPEE_HOST || "https://partner.shopeemobile.com";

function signShop(path: string, ts: number, token: string, shopId: string) {
  const base = `${PARTNER_ID}${path}${ts}${token}${shopId}`;
  return crypto.createHmac("sha256", PARTNER_KEY).update(base).digest("hex");
}

function decrypt(text: string): string {
  const [ivHex, encrypted] = text.split(":");
  if (!ivHex || !encrypted) return "";
  const key = crypto.createHash("sha256").update(process.env.JWT_SECRET || "kaibren-secret-2024").digest();
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const [rows]: any = await conn.query(
    "SELECT accessToken, extraConfig FROM integrations WHERE slug = 'shopee-843928049'"
  );
  await conn.end();
  const row = rows[0];
  const token = decrypt(row.accessToken);
  const extra = JSON.parse(row.extraConfig);
  const shopId = extra.shopId;

  const path = "/api/v2/sellerchat/get_conversation_list";
  const ts = Math.floor(Date.now() / 1000);
  const sign = signShop(path, ts, token, shopId);
  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: String(ts),
    access_token: token,
    shop_id: shopId,
    sign,
    direction: "latest",
    type: "all",
    page_size: "10",
  });
  const url = `${HOST}${path}?${params.toString()}`;
  console.log(`GET ${path}`);
  const res = await fetch(url);
  const data = await res.json();
  console.log("HTTP", res.status);
  console.log(JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
