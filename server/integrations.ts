import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { integrations } from "../drizzle/schema";
import crypto from "crypto";
import { getShopInfo } from "./shopee-oauth";

const ALGO = "aes-256-cbc";
const SECRET = process.env.JWT_SECRET || "kaibren-secret-2024";

function getKey() {
  return crypto.createHash("sha256").update(SECRET).digest();
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(text: string): string {
  const [ivHex, encrypted] = text.split(":");
  if (!ivHex || !encrypted) return "";
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function mask(token: string | null): string {
  if (!token) return "";
  const decrypted = token.includes(":") ? decrypt(token) : token;
  if (decrypted.length <= 8) return "****";
  return decrypted.slice(0, 4) + "****" + decrypted.slice(-4);
}

export async function listIntegrations() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(integrations);
  return rows.map(r => ({
    ...r,
    accessToken: mask(r.accessToken),
    extraConfig: r.extraConfig ? JSON.parse(r.extraConfig) : null,
    lastSyncAt: r.lastSyncAt ?? null,
    lastError: r.lastError ?? null,
    lastErrorAt: r.lastErrorAt ?? null,
  }));
}

export async function upsertIntegration(slug: string, data: { name?: string; accessToken?: string; accountId?: string; extraConfig?: any; status?: "pending" | "connected" | "error" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(integrations).where(eq(integrations.slug, slug)).limit(1);
  const encrypted = data.accessToken ? encrypt(data.accessToken) : undefined;

  if (existing.length > 0) {
    await db.update(integrations).set({
      ...(data.name && { name: data.name }),
      ...(encrypted && { accessToken: encrypted }),
      ...(data.accountId !== undefined && { accountId: data.accountId }),
      ...(data.extraConfig !== undefined && { extraConfig: JSON.stringify(data.extraConfig) }),
      ...(data.status && { status: data.status }),
    }).where(eq(integrations.slug, slug));
    return existing[0].id;
  } else {
    const [result] = await db.insert(integrations).values({
      name: data.name || slug,
      slug,
      accessToken: encrypted || null,
      accountId: data.accountId || null,
      extraConfig: data.extraConfig ? JSON.stringify(data.extraConfig) : null,
      status: data.status || "pending",
    });
    return result.insertId;
  }
}

export async function deleteIntegration(slug: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(integrations).where(eq(integrations.slug, slug));
}

export async function testIntegration(slug: string): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: "Database not available" };
  const rows = await db.select().from(integrations).where(eq(integrations.slug, slug)).limit(1);
  if (rows.length === 0) return { success: false, message: "Integração não encontrada" };

  const row = rows[0];
  const token = row.accessToken ? decrypt(row.accessToken) : "";

  try {
    switch (slug) {
      case "mercado-livre": {
        if (!token) return { success: false, message: "Token não configurado" };
        const userId = row.accountId;
        if (!userId) return { success: false, message: "User ID não configurado" };
        const res = await fetch(`https://api.mercadolibre.com/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { success: false, message: `Erro API ML: ${res.status}` };
        const json: any = await res.json();
        await db.update(integrations).set({ status: "connected", lastTestedAt: new Date(), lastSyncAt: new Date(), lastError: null, lastErrorAt: null }).where(eq(integrations.slug, slug));
        return { success: true, message: `Conta: ${json.nickname} (${json.seller_reputation?.level_id || "N/A"})` };
      }
      case "meta-ads": {
        const accountId = row.accountId;
        if (!token || !accountId) return { success: false, message: "Token ou Account ID não configurado" };
        const res = await fetch(`https://graph.facebook.com/v19.0/act_${accountId}?fields=name&access_token=${token}`);
        if (!res.ok) return { success: false, message: `Erro API Meta: ${res.status}` };
        const json = await res.json();
        await db.update(integrations).set({ status: "connected", lastTestedAt: new Date(), lastSyncAt: new Date(), lastError: null, lastErrorAt: null }).where(eq(integrations.slug, slug));
        return { success: true, message: `Conta: ${json.name}` };
      }
      case "instagram-1":
      case "instagram-2":
      case "instagram-3": {
        const userId = row.accountId;
        if (!token || !userId) return { success: false, message: "Token ou User ID não configurado" };
        const res = await fetch(`https://graph.facebook.com/v19.0/${userId}?fields=followers_count,username&access_token=${token}`);
        if (!res.ok) return { success: false, message: `Erro API Instagram: ${res.status}` };
        const json = await res.json();
        await db.update(integrations).set({ status: "connected", lastTestedAt: new Date(), lastSyncAt: new Date(), lastError: null, lastErrorAt: null }).where(eq(integrations.slug, slug));
        return { success: true, message: `@${json.username} — ${json.followers_count} seguidores` };
      }
      case "whatsapp": {
        const extra = row.extraConfig ? JSON.parse(row.extraConfig) : {};
        const apiUrl = extra.apiUrl;
        if (!apiUrl || !token) return { success: false, message: "URL ou API Key não configurado" };
        const res = await fetch(`${apiUrl}/instance/connectionState/${extra.instance}`, { headers: { apikey: token } });
        if (!res.ok) return { success: false, message: `Erro WhatsApp API: ${res.status}` };
        await db.update(integrations).set({ status: "connected", lastTestedAt: new Date(), lastSyncAt: new Date(), lastError: null, lastErrorAt: null }).where(eq(integrations.slug, slug));
        return { success: true, message: "Instância conectada" };
      }
      default: {
        // Shopee shops: slug = shopee-{shopId}
        if (slug.startsWith("shopee-")) {
          const shopId = row.accountId;
          if (!token || !shopId) return { success: false, message: "Token ou Shop ID não configurado" };
          try {
            const info = await getShopInfo(token, shopId);
            const shopName = info?.response?.shop_name || info?.shop_name || "Loja";
            await db.update(integrations).set({ status: "connected", lastTestedAt: new Date(), lastSyncAt: new Date(), lastError: null, lastErrorAt: null }).where(eq(integrations.slug, slug));
            return { success: true, message: `Loja: ${shopName}` };
          } catch (shopErr: any) {
            return { success: false, message: `Erro Shopee API: ${shopErr.message}` };
          }
        }
        return { success: false, message: "Teste não implementado para esta integração" };
      }
    }
  } catch (err: any) {
    const errorMsg = err.message || "Erro ao testar conexão";
    await db.update(integrations).set({ status: "error", lastTestedAt: new Date(), lastError: errorMsg, lastErrorAt: new Date() }).where(eq(integrations.slug, slug));
    return { success: false, message: errorMsg };
  }
}
