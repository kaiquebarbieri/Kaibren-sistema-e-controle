/**
 * Meta/Facebook Ads + Instagram Insights Integration
 * Uses Graph API to fetch ad performance and Instagram metrics.
 */
import { getDb } from "./db";
import { integrations } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "./integrations";

type CacheEntry<T> = { data: T; timestamp: number };
const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.timestamp > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data as T;
}
function setCache<T>(key: string, data: T) { cache.set(key, { data, timestamp: Date.now() }); }

// Carrega credencial do banco (descriptografada)
async function getIntegrationCreds(slug: string): Promise<{ token: string; accountId: string; extra: any } | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(integrations).where(eq(integrations.slug, slug)).limit(1);
    if (!rows.length || !rows[0].accessToken) return null;
    const token = decrypt(rows[0].accessToken);
    const accountId = rows[0].accountId || "";
    const extra = rows[0].extraConfig ? JSON.parse(rows[0].extraConfig) : {};
    if (!token) return null;
    return { token, accountId, extra };
  } catch { return null; }
}

function isConfigured(type: "meta" | "instagram"): boolean {
  if (type === "meta") return !!(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
  return !!(process.env.INSTAGRAM_ACCOUNT_1_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN);
}

// ── Meta Ads ────────────────────────────────────────

export type AdCampaignData = {
  id: string;
  name: string;
  status: string;
  dailyBudget: number;
  spendToday: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  roas: number;
  results: number;
  costPerResult: number;
};

export type DailyAdData = {
  date: string;
  spend: number;
  revenue: number;
};

export type FacebookAdsSummary = {
  configured: boolean;
  totalSpend: number;
  totalRevenue: number;
  totalImpressions: number;
  totalClicks: number;
  avgCtr: number;
  avgCpc: number;
  avgRoas: number;
  campaigns: AdCampaignData[];
  dailyData: DailyAdData[];
};

export type MetaAdsSummary = {
  configured: boolean;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  avgCtr: number;
  avgCpc: number;
  avgRoas: number;
  campaigns: AdCampaignData[];
};

export async function getFacebookAdsSummary(): Promise<FacebookAdsSummary> {
  // Try DB-stored integration first, fallback to env vars
  // Prioritize env vars (long-lived token already configured), fallback to DB OAuth token
  const token = process.env.META_ACCESS_TOKEN || (await getIntegrationCreds("meta-ads"))?.token;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!token || !adAccountId) {
    return getMockFacebookAds();
  }

  const cacheKey = "fb:ads:summary";
  const cached = getCached<FacebookAdsSummary>(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://graph.facebook.com/v19.0/act_${adAccountId}/campaigns?fields=id,name,status,daily_budget&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Meta API error: ${res.status}`);
    const campaignsData = await res.json();

    const insightsUrl = `https://graph.facebook.com/v19.0/act_${adAccountId}/insights?fields=spend,impressions,clicks,ctr,cpc,actions&date_preset=last_30d&level=campaign&access_token=${token}`;
    const insightsRes = await fetch(insightsUrl);
    const insightsData = insightsRes.ok ? await insightsRes.json() : { data: [] };

    const insightsMap = new Map<string, any>();
    for (const insight of insightsData.data ?? []) {
      insightsMap.set(insight.campaign_id, insight);
    }

    const campaigns: AdCampaignData[] = (campaignsData.data ?? []).map((c: any) => {
      const insight = insightsMap.get(c.id) ?? {};
      const actions = insight.actions ?? [];
      const purchaseAction = actions.find((a: any) => a.action_type === "purchase");
      const results = purchaseAction ? Number(purchaseAction.value ?? 0) : 0;
      const spend = Number(insight.spend ?? 0);

      return {
        id: c.id, name: c.name, status: c.status,
        dailyBudget: Number(c.daily_budget ?? 0) / 100,
        spendToday: spend,
        impressions: Number(insight.impressions ?? 0),
        clicks: Number(insight.clicks ?? 0),
        ctr: Number(insight.ctr ?? 0),
        cpc: Number(insight.cpc ?? 0),
        roas: insight.purchase_roas?.[0]?.value ? Number(insight.purchase_roas[0].value) : 0,
        results, costPerResult: results > 0 ? spend / results : 0,
      };
    });

    // Daily data
    const dailyUrl = `https://graph.facebook.com/v19.0/act_${adAccountId}/insights?fields=spend,actions,action_values&date_preset=last_30d&time_increment=1&access_token=${token}`;
    const dailyRes = await fetch(dailyUrl);
    const dailyJson = dailyRes.ok ? await dailyRes.json() : { data: [] };
    const dailyData: DailyAdData[] = (dailyJson.data ?? []).map((d: any) => {
      const purchaseValue = (d.action_values ?? []).find((a: any) => a.action_type === "purchase");
      return {
        date: d.date_start?.slice(5) ?? "",
        spend: Number(d.spend ?? 0),
        revenue: purchaseValue ? Number(purchaseValue.value ?? 0) : 0,
      };
    });

    const totalSpend = campaigns.reduce((s, c) => s + c.spendToday, 0);
    const totalRevenue = dailyData.reduce((s, d) => s + d.revenue, 0);
    const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
    const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);

    const result: FacebookAdsSummary = {
      configured: true, totalSpend, totalRevenue, totalImpressions, totalClicks,
      avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      avgRoas: campaigns.length > 0 ? campaigns.reduce((s, c) => s + c.roas, 0) / campaigns.length : 0,
      campaigns, dailyData,
    };

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error("[Facebook Ads] Error:", err);
    return { configured: true, totalSpend: 0, totalRevenue: 0, totalImpressions: 0, totalClicks: 0, avgCtr: 0, avgCpc: 0, avgRoas: 0, campaigns: [], dailyData: [] };
  }
}

export async function getMetaAdsSummary(): Promise<MetaAdsSummary> {
  const fb = await getFacebookAdsSummary();
  return {
    configured: fb.configured,
    totalSpend: fb.totalSpend,
    totalImpressions: fb.totalImpressions,
    totalClicks: fb.totalClicks,
    avgCtr: fb.avgCtr,
    avgCpc: fb.avgCpc,
    avgRoas: fb.avgRoas,
    campaigns: fb.campaigns,
  };
}

// ── Instagram Insights (multi-account) ─────────────────────────────

export type InstagramAccountInsights = {
  handle: string;
  followers: number;
  followersGrowth: number;
  reach: number;
  impressions: number;
  engagement: number;
  topPosts: Array<{ id: string; caption: string; likes: number; comments: number; mediaUrl: string }>;
  weeklyGrowth: Array<{ date: string; followers: number }>;
};

export type InstagramInsights = {
  configured: boolean;
  followers: number;
  followersGrowth: number;
  reach: number;
  impressions: number;
  engagement: number;
  topPosts: Array<{ id: string; caption: string; likes: number; comments: number; mediaUrl: string }>;
  weeklyGrowth: Array<{ date: string; followers: number }>;
};

export type InstagramMultiAccountInsights = {
  configured: boolean;
  accounts: InstagramAccountInsights[];
};

async function fetchInstagramAccount(token: string, userId: string, handle: string): Promise<InstagramAccountInsights> {
  try {
    const userRes = await fetch(`https://graph.facebook.com/v19.0/${userId}?fields=followers_count,media_count&access_token=${token}`);
    const userData = userRes.ok ? await userRes.json() : {};

    const mediaRes = await fetch(`https://graph.facebook.com/v19.0/${userId}/media?fields=id,caption,like_count,comments_count,media_url,timestamp&limit=10&access_token=${token}`);
    const mediaData = mediaRes.ok ? await mediaRes.json() : { data: [] };

    const topPosts = (mediaData.data ?? [])
      .sort((a: any, b: any) => (Number(b.like_count ?? 0) + Number(b.comments_count ?? 0)) - (Number(a.like_count ?? 0) + Number(a.comments_count ?? 0)))
      .slice(0, 3)
      .map((p: any) => ({
        id: p.id,
        caption: (p.caption ?? "").slice(0, 100),
        likes: Number(p.like_count ?? 0),
        comments: Number(p.comments_count ?? 0),
        mediaUrl: p.media_url ?? "",
      }));

    return {
      handle, followers: Number(userData.followers_count ?? 0),
      followersGrowth: 0, reach: 0, impressions: 0, engagement: 0,
      topPosts, weeklyGrowth: [],
    };
  } catch (err) {
    console.error(`[Instagram] Error fetching ${handle}:`, err);
    return { handle, followers: 0, followersGrowth: 0, reach: 0, impressions: 0, engagement: 0, topPosts: [], weeklyGrowth: [] };
  }
}

export async function getInstagramMultiAccount(): Promise<InstagramMultiAccountInsights> {
  const accounts: InstagramAccountInsights[] = [];

  // Tentar banco primeiro (prioridade), depois env vars como fallback
  const [db1, db2, db3] = await Promise.all([
    getIntegrationCreds("instagram-1"),
    getIntegrationCreds("instagram-2"),
    getIntegrationCreds("instagram-3"),
  ]);

  const configs = [
    {
      token: db1?.token || process.env.INSTAGRAM_ACCOUNT_1_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN || "",
      userId: db1?.accountId || process.env.INSTAGRAM_ACCOUNT_1_ID || process.env.INSTAGRAM_USER_ID || "",
      handle: db1?.extra?.username || process.env.INSTAGRAM_ACCOUNT_1 || "@kaibren.oficial",
    },
    {
      token: db2?.token || process.env.INSTAGRAM_ACCOUNT_2_TOKEN || "",
      userId: db2?.accountId || process.env.INSTAGRAM_ACCOUNT_2_ID || "",
      handle: db2?.extra?.username || process.env.INSTAGRAM_ACCOUNT_2 || "@ck.distribuidora",
    },
    {
      token: db3?.token || process.env.INSTAGRAM_ACCOUNT_3_TOKEN || "",
      userId: db3?.accountId || process.env.INSTAGRAM_ACCOUNT_3_ID || "",
      handle: db3?.extra?.username || process.env.INSTAGRAM_ACCOUNT_3 || "@clickmulti.store",
    },
  ];

  const hasAny = configs.some(c => c.token && c.userId);
  if (!hasAny) return getMockInstagramMulti();

  const cacheKey = "instagram:multi";
  const cached = getCached<InstagramMultiAccountInsights>(cacheKey);
  if (cached) return cached;

  for (const cfg of configs) {
    if (cfg.token && cfg.userId) {
      accounts.push(await fetchInstagramAccount(cfg.token, cfg.userId, cfg.handle));
    }
  }

  const result = { configured: true, accounts };
  setCache(cacheKey, result);
  return result;
}

export async function getInstagramInsights(): Promise<InstagramInsights> {
  const multi = await getInstagramMultiAccount();
  if (!multi.configured || multi.accounts.length === 0) {
    return getMockInstagram();
  }
  const first = multi.accounts[0];
  return {
    configured: true,
    followers: first.followers,
    followersGrowth: first.followersGrowth,
    reach: first.reach,
    impressions: first.impressions,
    engagement: first.engagement,
    topPosts: first.topPosts,
    weeklyGrowth: first.weeklyGrowth,
  };
}

// ── Mock data ────────────────────────────────────────

function getMockCampaigns(): AdCampaignData[] {
  return [
    { id: "mock-1", name: "Peças Mondial - Conversão", status: "ACTIVE", dailyBudget: 50, spendToday: 38.50, impressions: 12400, clicks: 342, ctr: 2.76, cpc: 0.11, roas: 3.2, results: 18, costPerResult: 2.14 },
    { id: "mock-2", name: "Distribuidora CK - Remarketing", status: "ACTIVE", dailyBudget: 30, spendToday: 22.80, impressions: 8200, clicks: 196, ctr: 2.39, cpc: 0.12, roas: 2.1, results: 8, costPerResult: 2.85 },
    { id: "mock-3", name: "Kaibren Brand - Alcance", status: "PAUSED", dailyBudget: 20, spendToday: 15.40, impressions: 5600, clicks: 89, ctr: 1.59, cpc: 0.17, roas: 0.6, results: 2, costPerResult: 7.70 },
    { id: "mock-4", name: "Liquidação Verão", status: "ACTIVE", dailyBudget: 40, spendToday: 31.20, impressions: 9800, clicks: 278, ctr: 2.84, cpc: 0.11, roas: 4.1, results: 22, costPerResult: 1.42 },
  ];
}

function getMockFacebookAds(): FacebookAdsSummary {
  const campaigns = getMockCampaigns();
  const totalSpend = campaigns.reduce((s, c) => s + c.spendToday, 0);

  const dailyData: DailyAdData[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const spend = 20 + Math.random() * 80;
    const revenue = spend * (0.5 + Math.random() * 4);
    dailyData.push({
      date: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      spend: Math.round(spend * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
    });
  }

  const totalRevenue = dailyData.reduce((s, d) => s + d.revenue, 0);

  return {
    configured: false, totalSpend, totalRevenue,
    totalImpressions: campaigns.reduce((s, c) => s + c.impressions, 0),
    totalClicks: campaigns.reduce((s, c) => s + c.clicks, 0),
    avgCtr: 2.40, avgCpc: 0.13, avgRoas: 2.5,
    campaigns, dailyData,
  };
}

function getMockInstagram(): InstagramInsights {
  return {
    configured: false,
    followers: 1247, followersGrowth: 23, reach: 4580, impressions: 12300, engagement: 3.4,
    topPosts: [
      { id: "1", caption: "Nova linha de peças chegou!", likes: 87, comments: 12, mediaUrl: "" },
      { id: "2", caption: "Promoção relâmpago", likes: 65, comments: 8, mediaUrl: "" },
      { id: "3", caption: "Dica de manutenção", likes: 54, comments: 15, mediaUrl: "" },
    ],
    weeklyGrowth: [
      { date: "Seg", followers: 1224 }, { date: "Ter", followers: 1228 },
      { date: "Qua", followers: 1231 }, { date: "Qui", followers: 1238 },
      { date: "Sex", followers: 1240 }, { date: "Sáb", followers: 1244 },
      { date: "Dom", followers: 1247 },
    ],
  };
}

function getMockInstagramMulti(): InstagramMultiAccountInsights {
  return {
    configured: false,
    accounts: [
      {
        handle: process.env.INSTAGRAM_ACCOUNT_1 || "@kaibren.oficial",
        followers: 1247, followersGrowth: 23, reach: 4580, impressions: 12300, engagement: 3.4,
        topPosts: [
          { id: "1", caption: "Nova linha de peças chegou!", likes: 87, comments: 12, mediaUrl: "" },
          { id: "2", caption: "Promoção relâmpago", likes: 65, comments: 8, mediaUrl: "" },
          { id: "3", caption: "Dica de manutenção", likes: 54, comments: 15, mediaUrl: "" },
        ],
        weeklyGrowth: [
          { date: "Seg", followers: 1224 }, { date: "Ter", followers: 1228 },
          { date: "Qua", followers: 1231 }, { date: "Qui", followers: 1238 },
          { date: "Sex", followers: 1240 }, { date: "Sáb", followers: 1244 },
          { date: "Dom", followers: 1247 },
        ],
      },
      {
        handle: process.env.INSTAGRAM_ACCOUNT_2 || "@ck.distribuidora",
        followers: 892, followersGrowth: 15, reach: 3200, impressions: 8700, engagement: 2.8,
        topPosts: [
          { id: "4", caption: "Entrega rápida pra todo Brasil!", likes: 52, comments: 7, mediaUrl: "" },
          { id: "5", caption: "Atacado com preço de fábrica", likes: 48, comments: 5, mediaUrl: "" },
          { id: "6", caption: "Novidades da semana", likes: 39, comments: 11, mediaUrl: "" },
        ],
        weeklyGrowth: [
          { date: "Seg", followers: 877 }, { date: "Ter", followers: 880 },
          { date: "Qua", followers: 882 }, { date: "Qui", followers: 885 },
          { date: "Sex", followers: 888 }, { date: "Sáb", followers: 890 },
          { date: "Dom", followers: 892 },
        ],
      },
      {
        handle: process.env.INSTAGRAM_ACCOUNT_3 || "@clickmulti.store",
        followers: 534, followersGrowth: 8, reach: 1840, impressions: 4900, engagement: 4.1,
        topPosts: [
          { id: "7", caption: "Ofertas imperdíveis!", likes: 34, comments: 6, mediaUrl: "" },
          { id: "8", caption: "Frete grátis essa semana", likes: 29, comments: 3, mediaUrl: "" },
          { id: "9", caption: "Produto mais vendido do mês", likes: 41, comments: 9, mediaUrl: "" },
        ],
        weeklyGrowth: [
          { date: "Seg", followers: 526 }, { date: "Ter", followers: 527 },
          { date: "Qua", followers: 528 }, { date: "Qui", followers: 530 },
          { date: "Sex", followers: 531 }, { date: "Sáb", followers: 533 },
          { date: "Dom", followers: 534 },
        ],
      },
    ],
  };
}
