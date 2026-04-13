import crypto from "crypto";
import { upsertIntegration } from "./integrations";

const APP_ID = "4596097000617751"; // NoahSocial (Live)
const APP_SECRET = "d20afb9c23e8240b192fc9ed01254164";
const REDIRECT_URI = process.env.META_REDIRECT_URI || "https://crm.noahagente.com.br/api/meta/oauth/callback";
const SCOPES = "public_profile,pages_show_list,pages_read_engagement,ads_management,ads_read,business_management";

const stateStore = new Map<string, number>();

export function generateOAuthUrl(): string {
  const state = crypto.randomBytes(16).toString("hex");
  stateStore.set(state, Date.now() + 10 * 60 * 1000);
  return `https://www.facebook.com/dialog/oauth?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${SCOPES}&state=${state}&response_type=code`;
}

export async function handleOAuthCallback(
  code: string,
  state: string
): Promise<{ success: boolean; accountsFound: number; error?: string }> {
  const expiry = stateStore.get(state);
  if (!expiry || Date.now() > expiry)
    return { success: false, accountsFound: 0, error: "invalid_state" };
  stateStore.delete(state);

  try {
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${APP_SECRET}&code=${code}`
    );
    const tokenData = (await tokenRes.json()) as any;
    if (tokenData.error || !tokenData.access_token)
      return {
        success: false,
        accountsFound: 0,
        error: tokenData.error?.message || "token_exchange_failed",
      };

    const longRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
    );
    const longData = (await longRes.json()) as any;
    const longToken = longData.access_token || tokenData.access_token;

    await upsertIntegration("meta-ads", {
      accessToken: longToken,
      accountId: "255763337908305",
      status: "connected",
    });

    // Also update kaibren-ads .env and CRM .env for direct API access
    try {
      const adsEnvPath = "/root/kaibren-ads/.env";
      const adsEnv = `FACEBOOK_ACCESS_TOKEN=${longToken}\nFACEBOOK_AD_ACCOUNT_ID=act_255763337908305\nFACEBOOK_APP_ID=${APP_ID}\nFACEBOOK_APP_SECRET=${APP_SECRET}\n`;
      require("fs").writeFileSync(adsEnvPath, adsEnv);
      // Set runtime env vars for CRM marketing-meta.ts
      process.env.META_ACCESS_TOKEN = longToken;
      process.env.META_AD_ACCOUNT_ID = "255763337908305";
    } catch {}


    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${longToken}`
    );
    const pagesData = (await pagesRes.json()) as any;
    const pages: any[] = pagesData.data || [];

    let igCount = 0;
    const slugs = ["instagram-1", "instagram-2", "instagram-3"];

    for (const page of pages) {
      if (igCount >= 3) break;
      const igRes = await fetch(
        `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account{id,username,followers_count}&access_token=${longToken}`
      );
      const igData = (await igRes.json()) as any;
      const igAccount = igData.instagram_business_account;
      if (!igAccount) continue;

      const pageTokenRes = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${page.access_token}`
      );
      const pageTokenData = (await pageTokenRes.json()) as any;
      const pageToken = pageTokenData.access_token || page.access_token;

      await upsertIntegration(slugs[igCount], {
        name: igAccount.username
          ? `@${igAccount.username}`
          : `Instagram ${igCount + 1}`,
        accessToken: pageToken,
        accountId: igAccount.id,
        extraConfig: {
          username: igAccount.username ? `@${igAccount.username}` : "",
          pageId: page.id,
          pageName: page.name,
        },
        status: "connected",
      });
      igCount++;
    }

    if (igCount === 0)
      return { success: false, accountsFound: 0, error: "no_instagram" };
    return { success: true, accountsFound: igCount };
  } catch (err: any) {
    return { success: false, accountsFound: 0, error: err.message };
  }
}
