/**
 * Mercado Livre OAuth Flow
 * Handles authorization, callback, and automatic token storage.
 */

import crypto from "crypto";
import { upsertIntegration } from "./integrations";

const APP_ID = process.env.ML_APP_ID || "2503490186754653";
const APP_SECRET = process.env.ML_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.ML_REDIRECT_URI || `http://localhost:${process.env.PORT || 3002}/api/ml/oauth/callback`;

const stateStore = new Map<string, number>();

export function generateMLOAuthUrl(): string {
  const state = crypto.randomBytes(16).toString("hex");
  stateStore.set(state, Date.now() + 10 * 60 * 1000);
  return `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}`;
}

export async function handleMLOAuthCallback(
  code: string,
  state: string
): Promise<{ success: boolean; accountName?: string; userId?: string; error?: string }> {
  const expiry = stateStore.get(state);
  if (!expiry || Date.now() > expiry)
    return { success: false, error: "invalid_state" };
  stateStore.delete(state);

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: APP_ID,
        client_secret: APP_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokenData = (await tokenRes.json()) as any;
    if (tokenData.error || !tokenData.access_token) {
      return {
        success: false,
        error: tokenData.message || tokenData.error || "token_exchange_failed",
      };
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const userId = String(tokenData.user_id);

    // Get user info to identify the account
    const userRes = await fetch(`https://api.mercadolibre.com/users/${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = (await userRes.json()) as any;
    const nickname = userData.nickname || userId;

    // Save to integrations table
    await upsertIntegration("mercado-livre", {
      name: `Mercado Livre (${nickname})`,
      accessToken,
      accountId: userId,
      extraConfig: {
        refreshToken,
        nickname,
        userId,
        connectedAt: new Date().toISOString(),
      },
      status: "connected",
    });

    // Also update process.env for the ML module to use
    // Try to match to an existing account slot or use the first available
    const slots = ["ML_CLICKMULTII", "ML_DUOULTILIDADE", "ML_KAIBRENLTDA"];
    let assigned = false;

    for (const slot of slots) {
      const existingUserId = process.env[`${slot}_USER_ID`];
      if (existingUserId === userId) {
        // Update existing slot
        process.env[`${slot}_ACCESS_TOKEN`] = accessToken;
        process.env[`${slot}_REFRESH_TOKEN`] = refreshToken;
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      // Find first empty slot
      for (const slot of slots) {
        if (!process.env[`${slot}_USER_ID`] || !process.env[`${slot}_ACCESS_TOKEN`]) {
          process.env[`${slot}_USER_ID`] = userId;
          process.env[`${slot}_ACCESS_TOKEN`] = accessToken;
          process.env[`${slot}_REFRESH_TOKEN`] = refreshToken;
          assigned = true;
          break;
        }
      }
    }

    console.log(`[ML OAuth] Conta conectada: ${nickname} (user_id: ${userId})`);

    return { success: true, accountName: nickname, userId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
