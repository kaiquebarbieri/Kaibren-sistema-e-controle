/**
 * Shopee OAuth v2 Flow (Open Platform - Brasil)
 *
 * Fluxo:
 *  1. generateShopeeAuthUrl() gera URL assinada do /api/v2/shop/auth_partner
 *  2. Usuário autoriza a loja na Shopee
 *  3. Shopee redireciona de volta com code + shop_id
 *  4. handleShopeeCallback() troca code por access_token + refresh_token
 *     (POST /api/v2/auth/token/get — sem access_token/shop_id no sign base)
 *  5. Salva na tabela integrations e atualiza process.env pra uso imediato
 *
 * Refresh:
 *  - Access token dura 4h, refresh token dura 30 dias
 *  - refreshShopeeToken() chama /api/v2/auth/access_token/get
 */

import crypto from "crypto";
import { upsertIntegration } from "./integrations";

const PARTNER_ID = process.env.SHOPEE_PARTNER_ID || "2031848";
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY || "";
const REDIRECT_URI =
  process.env.SHOPEE_REDIRECT_URI ||
  "https://crm.noahagente.com.br/api/shopee/oauth/callback";

// Host de produção Brasil (sandbox seria openplatform.sandbox.test-stable.shopee.sg)
const HOST = process.env.SHOPEE_HOST || "https://partner.shopeemobile.com";

/**
 * Assinatura HMAC-SHA256 para endpoints "public" (auth).
 * Base string: partner_id + api_path + timestamp
 */
function signPublic(path: string, timestamp: number): string {
  const base = `${PARTNER_ID}${path}${timestamp}`;
  return crypto
    .createHmac("sha256", PARTNER_KEY)
    .update(base)
    .digest("hex");
}

/**
 * Assinatura HMAC-SHA256 para endpoints "shop" (após autorização).
 * Base string: partner_id + api_path + timestamp + access_token + shop_id
 */
function signShop(
  path: string,
  timestamp: number,
  accessToken: string,
  shopId: string
): string {
  const base = `${PARTNER_ID}${path}${timestamp}${accessToken}${shopId}`;
  return crypto
    .createHmac("sha256", PARTNER_KEY)
    .update(base)
    .digest("hex");
}

/**
 * Gera URL de autorização pra o lojista abrir no navegador.
 */
export function generateShopeeAuthUrl(): string {
  const path = "/api/v2/shop/auth_partner";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signPublic(path, timestamp);
  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: String(timestamp),
    sign,
    redirect: REDIRECT_URI,
  });
  return `${HOST}${path}?${params.toString()}`;
}

/**
 * Troca o `code` recebido no callback por access_token e refresh_token.
 */
export async function handleShopeeCallback(
  code: string,
  shopId: string
): Promise<{
  success: boolean;
  shopId?: string;
  shopName?: string;
  error?: string;
}> {
  if (!code || !shopId) {
    return { success: false, error: "missing_code_or_shop_id" };
  }
  if (!PARTNER_KEY) {
    return { success: false, error: "partner_key_not_configured" };
  }

  const path = "/api/v2/auth/token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signPublic(path, timestamp);
  const url = `${HOST}${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        shop_id: Number(shopId),
        partner_id: Number(PARTNER_ID),
      }),
    });
    const data = (await res.json()) as any;

    if (data.error || !data.access_token) {
      return {
        success: false,
        error: data.message || data.error || "token_exchange_failed",
      };
    }

    const accessToken: string = data.access_token;
    const refreshToken: string = data.refresh_token;
    const expireIn: number = Number(data.expire_in || 14400);

    // Tenta identificar a loja (nome bonito pro CRM)
    let shopName = `Shop ${shopId}`;
    try {
      const info = await getShopInfo(accessToken, shopId);
      if (info?.shop_name) shopName = info.shop_name;
    } catch (e) {
      // non-fatal — segue com nome genérico
    }

    const slug = `shopee-${shopId}`;
    await upsertIntegration(slug, {
      name: `Shopee (${shopName})`,
      accessToken,
      accountId: shopId,
      extraConfig: {
        refreshToken,
        shopId,
        shopName,
        expiresAt: new Date(Date.now() + expireIn * 1000).toISOString(),
        connectedAt: new Date().toISOString(),
      },
      status: "connected",
    });

    // Exposição imediata via process.env (primeiros 3 slots)
    const slots = ["SHOPEE_SHOP_1", "SHOPEE_SHOP_2", "SHOPEE_SHOP_3"];
    let assigned = false;
    for (const slot of slots) {
      if (process.env[`${slot}_ID`] === shopId) {
        process.env[`${slot}_ACCESS_TOKEN`] = accessToken;
        process.env[`${slot}_REFRESH_TOKEN`] = refreshToken;
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      for (const slot of slots) {
        if (!process.env[`${slot}_ID`]) {
          process.env[`${slot}_ID`] = shopId;
          process.env[`${slot}_ACCESS_TOKEN`] = accessToken;
          process.env[`${slot}_REFRESH_TOKEN`] = refreshToken;
          break;
        }
      }
    }

    console.log(
      `[Shopee OAuth] Loja conectada: ${shopName} (shop_id: ${shopId})`
    );

    return { success: true, shopId, shopName };
  } catch (err: any) {
    console.error("[Shopee OAuth] Erro no callback:", err);
    return { success: false, error: err.message || "unknown_error" };
  }
}

/**
 * Renova o access_token usando o refresh_token.
 */
export async function refreshShopeeToken(
  shopId: string,
  refreshToken: string
): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}> {
  const path = "/api/v2/auth/access_token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signPublic(path, timestamp);
  const url = `${HOST}${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: refreshToken,
        shop_id: Number(shopId),
        partner_id: Number(PARTNER_ID),
      }),
    });
    const data = (await res.json()) as any;
    if (data.error || !data.access_token) {
      return {
        success: false,
        error: data.message || data.error || "refresh_failed",
      };
    }
    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Busca informações da loja. Requer endpoint "shop" (sign com access_token + shop_id).
 */
export async function getShopInfo(
  accessToken: string,
  shopId: string
): Promise<any> {
  const path = "/api/v2/shop/get_shop_info";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signShop(path, timestamp, accessToken, shopId);
  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: String(timestamp),
    access_token: accessToken,
    shop_id: shopId,
    sign,
  });
  const res = await fetch(`${HOST}${path}?${params.toString()}`);
  if (!res.ok) throw new Error(`shop_info_failed: ${res.status}`);
  return (await res.json()) as any;
}
