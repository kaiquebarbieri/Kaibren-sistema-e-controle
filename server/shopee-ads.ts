/**
 * Shopee Ads — API de Anúncios
 *
 * Endpoints usados:
 *  - GET  /api/v2/ads/get_total_balance
 *  - GET  /api/v2/ads/get_product_level_campaign_id_list
 *  - GET  /api/v2/ads/get_product_level_campaign_setting_info
 *  - GET  /api/v2/ads/get_all_cpc_ads_daily_performance
 *  - GET  /api/v2/ads/get_product_campaign_daily_performance
 *  - GET  /api/v2/ads/get_recommended_keyword_list
 *  - GET  /api/v2/ads/get_recommended_item_list
 */

import crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { getConnectedShops, shopeeApiFetch, type ShopeeShop } from "./shopee";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { products } from "../drizzle/schema";
import { sql } from "drizzle-orm";

const PARTNER_ID = process.env.SHOPEE_PARTNER_ID || "2031848";
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY || "";
const HOST = process.env.SHOPEE_HOST || "https://partner.shopeemobile.com";

// ---------- Signing ----------

function signShop(path: string, timestamp: number, accessToken: string, shopId: string): string {
  const base = `${PARTNER_ID}${path}${timestamp}${accessToken}${shopId}`;
  return crypto.createHmac("sha256", PARTNER_KEY).update(base).digest("hex");
}

// ---------- API Fetch ----------

async function shopeeAdsGet(path: string, shop: ShopeeShop, extraParams?: Record<string, string>): Promise<any> {
  const fullPath = `/api/v2${path}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signShop(fullPath, timestamp, shop.accessToken, shop.shopId);
  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: String(timestamp),
    access_token: shop.accessToken,
    shop_id: shop.shopId,
    sign,
    ...extraParams,
  });
  const url = `${HOST}${fullPath}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Shopee Ads API ${path}: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Shopee Ads ${path}: ${data.error} - ${data.message || ""}`);
  return data;
}

async function shopeeAdsPost(path: string, shop: ShopeeShop, body: any): Promise<any> {
  const fullPath = `/api/v2${path}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signShop(fullPath, timestamp, shop.accessToken, shop.shopId);
  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: String(timestamp),
    access_token: shop.accessToken,
    shop_id: shop.shopId,
    sign,
  });
  const url = `${HOST}${fullPath}?${params.toString()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Shopee Ads API ${path}: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Shopee Ads ${path}: ${data.error} - ${data.message || ""}`);
  return data;
}

// ---------- Helpers ----------

function formatDateDD(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

// ---------- Knowledge Base ----------

function loadShopeeKnowledge(): string {
  try {
    const filePath = path.join(__dirname, "..", "server", "data", "shopee-knowledge.json");
    // Try multiple paths (dev vs prod)
    const paths = [
      path.join(process.cwd(), "server", "data", "shopee-knowledge.json"),
      path.join(__dirname, "data", "shopee-knowledge.json"),
      path.join(__dirname, "..", "server", "data", "shopee-knowledge.json"),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
        const sections = raw.sections;
        let knowledge = `\n\n## KNOWLEDGE BASE SHOPEE (atualizado em ${raw.lastUpdated})\n`;

        // Taxas — nova estrutura por faixas (março 2026)
        if (sections.taxasComissoes2026) {
          const t = sections.taxasComissoes2026.data;
          knowledge += `\n### TAXAS E COMISSÕES 2026 (ATUALIZADO MARÇO/2026)\n`;
          knowledge += `- ⚠️ ${t.mudancaMar2026 || ''}\n`;
          if (Array.isArray(t.tabelaFaixas)) {
            knowledge += `\nTABELA DE COMISSÃO POR FAIXA DE PREÇO:\n`;
            for (const f of t.tabelaFaixas) {
              knowledge += `  - ${f.faixa}: comissão ${f.comissao} + taxa fixa ${f.taxaFixa}\n`;
            }
          }
          knowledge += `- Frete Grátis: ${t.freteGratis || ''}\n`;
          knowledge += `- Campanhas Destaque: ${t.campanhasDestaque || ''}\n`;
          knowledge += `- Subsídio PIX: ${t.subsidioPix || ''}\n`;
          knowledge += `- CÁLCULO LUCRO: ${t.resumo || ''}\n`;
          knowledge += `- ⚠️ ALERTA: ${t.alerta || ''}\n`;
        }

        // GMV Max
        if (sections.gmvMax) {
          const g = sections.gmvMax.data;
          knowledge += `\n### GMV MAX (novo sistema de ads)\n`;
          knowledge += `- ${g.oQueE}\n`;
          knowledge += `- Migração: ${g.migracaoManual}\n`;
          knowledge += `- Regra: ${g.regra1Produto}\n`;
          knowledge += `- IMPORTANTE: ${g.faseAprendizado}\n`;
          knowledge += `- ROAS target novos: ${g.roasTarget.produtosNovos}\n`;
          knowledge += `- ROAS target populares: ${g.roasTarget.produtosPopulares}\n`;
          knowledge += `- CUIDADO: ${g.roasTarget.cuidado}\n`;
          knowledge += `- Budget recomendado: ${g.budgetRecomendado}\n`;
        }

        // Otimização
        if (sections.otimizacaoAds) {
          const o = sections.otimizacaoAds.data;
          knowledge += `\n### OTIMIZAÇÃO DE ADS\n`;
          knowledge += `- ROAS saudável: ${o.roasMinimo}\n`;
          knowledge += `- Ajustes: ${o.ajustes}\n`;
          knowledge += `- Tempo mínimo: ${o.tempoMinimo}\n`;
          knowledge += `- Keywords ROAS alto: ${o.keywords.roasAlto}\n`;
          knowledge += `- CTR baixo: ${o.keywords.ctrBaixo}\n`;
          knowledge += `- Pausar ads: ${o.keywords.pausa}\n`;
          knowledge += `- Fotos: fundo branco, produto 80% da área, boa iluminação\n`;
          knowledge += `- Títulos: ${o.titulos.formato}\n`;
          knowledge += `- Teste A/B: ${o.testeAB}\n`;
        }

        // Novidades
        if (sections.novidadesPlataforma2026) {
          knowledge += `\n### NOVIDADES 2026\n`;
          for (const n of sections.novidadesPlataforma2026.data) {
            knowledge += `- ${n}\n`;
          }
        }

        return knowledge;
      }
    }
    return "";
  } catch { return ""; }
}

// ---------- Dados de Ads ----------

/** Saldo total de créditos de ads */
export async function getAdsBalance(): Promise<{ balance: number; timestamp: number } | null> {
  const shops = await getConnectedShops();
  if (shops.length === 0) return null;
  try {
    const data = await shopeeAdsGet("/ads/get_total_balance", shops[0]);
    return {
      balance: data.response?.total_balance ?? 0,
      timestamp: data.response?.data_timestamp ?? 0,
    };
  } catch (err: any) {
    console.error("[Shopee Ads] Balance error:", err.message);
    return null;
  }
}

/** Lista de campanhas com settings e detalhes dos produtos */
export async function getAdsCampaigns(): Promise<any[]> {
  const shops = await getConnectedShops();
  if (shops.length === 0) return [];
  const shop = shops[0];

  try {
    // 1. Buscar IDs de campanhas
    const listData = await shopeeAdsGet("/ads/get_product_level_campaign_id_list", shop, {
      ad_type: "all",
      offset: "0",
      limit: "100",
    });

    const campaigns = listData.response?.campaign_list || [];
    if (campaigns.length === 0) return [];

    // 2. Buscar settings (info_type 1=common, 2=manual, 3=auto)
    const campaignIds = campaigns.map((c: any) => c.campaign_id).join(",");
    const settingsData = await shopeeAdsGet("/ads/get_product_level_campaign_setting_info", shop, {
      info_type_list: "1,2,3",
      campaign_id_list: campaignIds,
    });

    const campaignList = settingsData.response?.campaign_list || [];

    // 3. Coletar todos os item_ids de todas as campanhas para buscar detalhes
    const allItemIds = new Set<number>();
    for (const c of campaignList) {
      const items = c.common_info?.item_id_list || [];
      for (const id of items) allItemIds.add(id);
    }

    // 4. Buscar detalhes dos produtos (nome, imagem, preco, estoque)
    const itemsMap = await getItemsDetails(Array.from(allItemIds), shop);

    // 5. Enriquecer campanhas com dados dos produtos
    for (const c of campaignList) {
      c._itemDetails = (c.common_info?.item_id_list || []).map((id: number) => {
        const detail = itemsMap.get(id);
        return detail ? { itemId: id, ...detail } : { itemId: id, name: `Item ${id}`, image: "", price: 0, stock: 0, status: "unknown" };
      });
    }

    return campaignList;
  } catch (err: any) {
    console.error("[Shopee Ads] Campaigns error:", err.message);
    return [];
  }
}

/** Performance diária dos ads (shop-level) — últimos N dias */
export async function getAdsDailyPerformance(days: number = 14): Promise<any[]> {
  const shops = await getConnectedShops();
  if (shops.length === 0) return [];

  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - 1); // ontem (API não aceita hoje em alguns cenários)
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  try {
    const data = await shopeeAdsGet("/ads/get_all_cpc_ads_daily_performance", shops[0], {
      start_date: formatDateDD(startDate),
      end_date: formatDateDD(endDate),
    });
    return data.response || [];
  } catch (err: any) {
    console.error("[Shopee Ads] Daily perf error:", err.message);
    return [];
  }
}

/** Performance diária por campanha */
export async function getCampaignDailyPerformance(campaignIds: string, days: number = 14): Promise<any[]> {
  const shops = await getConnectedShops();
  if (shops.length === 0) return [];

  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  try {
    const data = await shopeeAdsGet("/ads/get_product_campaign_daily_performance", shops[0], {
      start_date: formatDateDD(startDate),
      end_date: formatDateDD(endDate),
      campaign_id_list: campaignIds,
    });
    return data.response || [];
  } catch (err: any) {
    console.error("[Shopee Ads] Campaign perf error:", err.message);
    return [];
  }
}

/** Buscar detalhes de itens (nome, imagem, preco, estoque) */
async function getItemsDetails(itemIds: number[], shop: ShopeeShop): Promise<Map<number, { name: string; image: string; price: number; stock: number; status: string }>> {
  const map = new Map<number, { name: string; image: string; price: number; stock: number; status: string }>();
  if (itemIds.length === 0) return map;

  // API aceita max 50 por request
  const batches: number[][] = [];
  for (let i = 0; i < itemIds.length; i += 50) {
    batches.push(itemIds.slice(i, i + 50));
  }

  for (const batch of batches) {
    try {
      const data = await shopeeApiFetch("/api/v2/product/get_item_base_info", shop, {
        item_id_list: batch.join(","),
      });
      const items = data.response?.item_list || [];
      for (const item of items) {
        map.set(item.item_id, {
          name: item.item_name || `Item ${item.item_id}`,
          image: item.image?.image_url_list?.[0] || "",
          price: (item.price_info?.[0]?.current_price || item.price_info?.[0]?.original_price || 0),
          stock: item.stock_info_v2?.summary_info?.total_available_stock ?? item.stock_info?.current_stock ?? 0,
          status: item.item_status || "NORMAL",
        });
      }
    } catch (err: any) {
      console.error("[Shopee Ads] Item details batch error:", err.message);
    }
  }

  return map;
}

/** Itens recomendados para anunciar */
export async function getRecommendedItems(): Promise<any[]> {
  const shops = await getConnectedShops();
  if (shops.length === 0) return [];
  try {
    const data = await shopeeAdsGet("/ads/get_recommended_item_list", shops[0]);
    return data.response || [];
  } catch (err: any) {
    console.error("[Shopee Ads] Recommended items error:", err.message);
    return [];
  }
}

/** Keywords recomendadas para um item */
export async function getRecommendedKeywords(itemId: number): Promise<any[]> {
  const shops = await getConnectedShops();
  if (shops.length === 0) return [];
  try {
    const data = await shopeeAdsGet("/ads/get_recommended_keyword_list", shops[0], {
      item_id: String(itemId),
    });
    return data.response?.suggested_keywords || [];
  } catch (err: any) {
    console.error("[Shopee Ads] Keywords error:", err.message);
    return [];
  }
}

// ---------- Dashboard completo ----------

export async function getShopeeAdsDashboard() {
  const [balance, campaigns, dailyPerf] = await Promise.all([
    getAdsBalance(),
    getAdsCampaigns(),
    getAdsDailyPerformance(14),
  ]);

  // Calcular totais dos últimos 7 e 30 dias a partir de dailyPerf
  const totalExpense7d = dailyPerf.slice(-7).reduce((s: number, d: any) => s + (d.expense || 0), 0);
  const totalExpense14d = dailyPerf.reduce((s: number, d: any) => s + (d.expense || 0), 0);
  const totalClicks7d = dailyPerf.slice(-7).reduce((s: number, d: any) => s + (d.clicks || 0), 0);
  const totalImpressions7d = dailyPerf.slice(-7).reduce((s: number, d: any) => s + (d.impression || 0), 0);
  const totalDirectGmv7d = dailyPerf.slice(-7).reduce((s: number, d: any) => s + (d.direct_gmv || 0), 0);
  const totalBroadGmv7d = dailyPerf.slice(-7).reduce((s: number, d: any) => s + (d.broad_gmv || 0), 0);
  const totalDirectOrders7d = dailyPerf.slice(-7).reduce((s: number, d: any) => s + (d.direct_order || 0), 0);

  const avgRoas7d = totalExpense7d > 0 ? totalDirectGmv7d / totalExpense7d : 0;
  const avgCtr7d = totalImpressions7d > 0 ? (totalClicks7d / totalImpressions7d) * 100 : 0;
  const avgCpc7d = totalClicks7d > 0 ? totalExpense7d / totalClicks7d : 0;

  // Campanhas ativas vs pausadas
  // GMV Max campaigns show as "closed" in product-level API but are still active
  const activeCampaigns = campaigns.filter((c: any) => {
    const status = c.common_info?.campaign_status;
    return status === "ongoing" || (status === "closed" && (c.common_info?.item_id_list?.length || 0) > 0);
  });
  const pausedCampaigns = campaigns.filter((c: any) => c.common_info?.campaign_status === "paused");

  // Alertas
  const alerts: Array<{ level: "red" | "yellow" | "green"; message: string }> = [];

  if (avgRoas7d < 2 && totalExpense7d > 0) {
    alerts.push({ level: "red", message: `ROAS direto ${avgRoas7d.toFixed(1)}x — abaixo de 2x, prejuízo nos ads` });
  } else if (avgRoas7d < 4 && totalExpense7d > 0) {
    alerts.push({ level: "yellow", message: `ROAS direto ${avgRoas7d.toFixed(1)}x — margem apertada` });
  } else if (totalExpense7d > 0) {
    alerts.push({ level: "green", message: `ROAS direto ${avgRoas7d.toFixed(1)}x — saudável` });
  }

  if (balance && balance.balance < 10) {
    alerts.push({ level: "red", message: `Saldo ads R$${balance.balance.toFixed(2)} — quase acabando` });
  } else if (balance && balance.balance < 50) {
    alerts.push({ level: "yellow", message: `Saldo ads R$${balance.balance.toFixed(2)} — recarregar em breve` });
  }

  if (avgCtr7d < 1 && totalImpressions7d > 100) {
    alerts.push({ level: "yellow", message: `CTR ${avgCtr7d.toFixed(2)}% — anúncios com baixa atratividade` });
  }

  if (activeCampaigns.length === 0 && campaigns.length > 0) {
    alerts.push({ level: "yellow", message: "Nenhuma campanha ativa — todos os ads pausados" });
  }

  return {
    balance: balance?.balance ?? null,
    kpis: {
      expense7d: Math.round(totalExpense7d * 100) / 100,
      expense14d: Math.round(totalExpense14d * 100) / 100,
      directGmv7d: Math.round(totalDirectGmv7d * 100) / 100,
      broadGmv7d: Math.round(totalBroadGmv7d * 100) / 100,
      roas7d: Math.round(avgRoas7d * 10) / 10,
      ctr7d: Math.round(avgCtr7d * 100) / 100,
      cpc7d: Math.round(avgCpc7d * 100) / 100,
      clicks7d: totalClicks7d,
      impressions7d: totalImpressions7d,
      directOrders7d: totalDirectOrders7d,
    },
    campaigns: campaigns.map((c: any) => ({
      id: c.campaign_id,
      name: c.common_info?.ad_name || `Campanha ${c.campaign_id}`,
      status: c.common_info?.campaign_status || "unknown",
      type: c.common_info?.ad_type || "unknown",
      placement: c.common_info?.campaign_placement || "all",
      budget: c.common_info?.campaign_budget || 0,
      biddingMethod: c.common_info?.bidding_method || "auto",
      roasTarget: c.auto_bidding_info?.roas_target || null,
      itemCount: c.common_info?.item_id_list?.length || 0,
      items: c.common_info?.item_id_list || [],
      itemDetails: (c._itemDetails || []).map((d: any) => ({
        itemId: d.itemId,
        name: d.name,
        image: d.image,
        price: d.price,
        stock: d.stock,
        status: d.status,
      })),
    })),
    dailyPerformance: dailyPerf.map((d: any) => ({
      date: d.date,
      expense: Math.round((d.expense || 0) * 100) / 100,
      clicks: d.clicks || 0,
      impressions: d.impression || 0,
      ctr: Math.round((d.ctr || 0) * 100) / 100,
      directGmv: Math.round((d.direct_gmv || 0) * 100) / 100,
      broadGmv: Math.round((d.broad_gmv || 0) * 100) / 100,
      directOrders: d.direct_order || 0,
      broadOrders: d.broad_order || 0,
      directRoas: Math.round((d.direct_roas || 0) * 10) / 10,
      broadRoas: Math.round((d.broad_roas || 0) * 10) / 10,
      cpc: d.clicks > 0 ? Math.round((d.expense / d.clicks) * 100) / 100 : 0,
    })),
    alerts,
    totalCampaigns: campaigns.length,
    activeCampaigns: activeCampaigns.length,
    pausedCampaigns: pausedCampaigns.length,
  };
}

// ---------- Custos de produtos ----------

async function getProductCosts(): Promise<Array<{ name: string; sku: string; cost: number; price: number; margin: number }>> {
  try {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select({
      nome: products.nome,
      sku: products.sku,
      custo: products.tabelaNovaCk,
      preco: products.precoFinal,
      margem: products.margemFinal,
    }).from(products).limit(50);
    return rows
      .filter(r => r.custo && r.preco && Number(r.preco) > 0)
      .map(r => ({
        name: r.nome || r.sku || "?",
        sku: r.sku || "",
        cost: Number(r.custo || 0),
        price: Number(r.preco || 0),
        margin: Math.round(Number(r.margem || 0) * 100),
      }));
  } catch { return []; }
}

// ---------- System prompt completo (nivel CEO) ----------

const SAM_SYSTEM_PROMPT = `Você é **Sam 🛒**, o Diretor de Performance de Ads da Kaibren. Você opera com inteligência de nível CEO — não é um chatbot genérico, é um estrategista que entende profundamente o negócio.

## SOBRE A KAIBREN
- **O que vende:** Peças de reposição para eletrodomésticos Mondial (air fryer, liquidificador, ventilador, batedeira)
- **Dono:** Kaique Barbieri Affonso — hands-on, quer resultados com números, odeia respostas genéricas
- **Equipe:** Kaique + Brenda (esposa/sócia) + 2 funcionários
- **Fornecedor:** Mondial — parceria com comissão R$0,75/peça
- **Canais:** Shopee, Mercado Livre (3 contas), Amazon, TikTok Shop, loja física (Taboão da Serra)
- **Situação:** As vendas caíram significativamente. Precisa escalar com LUCRO, não faturamento vazio

## SEU PAPEL
Você tem **controle total e autoridade** sobre a estratégia de Ads da Shopee. Isso significa:
- Analisar cada campanha e dizer SE está dando lucro real considerando as NOVAS TAXAS DE MARÇO/2026
- A comissão agora é POR FAIXA DE PREÇO:
  * Até R$7,99 → 50% do valor (PROIBIDO anunciar)
  * R$8 a R$79,99 → 20% + R$4 fixo/item (margem APERTADÍSSIMA)
  * R$80 a R$99,99 → 14% + R$16 fixo/item
  * R$100 a R$199,99 → 14% + R$20 fixo/item
  * Acima de R$200 → 14% + R$26 fixo/item
- Frete grátis é OBRIGATÓRIO desde março/2026 (custo já embutido na comissão)
- Calcular lucro REAL: Venda - Comissão (20% ou 14%) - Taxa Fixa (R$4 a R$26) - Custo Produto - Custo Ad = Lucro
- Nunca recomendar "aumentar budget" sem provar que o ROAS sustenta
- Ser brutalmente honesto: se está jogando dinheiro fora, falar claramente

## REGRAS DE OURO
1. **Produtos < R$80 = ROAS mínimo 6x** (comissão 20% + R$4 come quase tudo)
2. **Produtos >= R$80 = ROAS mínimo 4x** (comissão 14% + taxa fixa alta)
3. **NUNCA anunciar produto < R$8** (50% de comissão = prejuízo certo)
4. **CPC alto = problema de relevância** — as fotos/títulos não atraem, ou keywords erradas
5. **CTR < 1% = anúncio invisível** — precisa melhorar creative (foto principal, título, preço)
6. **Nunca gastar mais do que pode perder** — se o saldo está baixo, focar nos melhores produtos
7. **Produto bom pra ads = preço > R$80 + margem > 40%** — não anunciar produto barato com margem apertada

## COMO RESPONDER
- Português brasileiro, direto, sem enrolação
- Use **negrito** para números importantes e ações
- Quando der diagnóstico, SEMPRE mostre a conta COM A FAIXA CORRETA:
  "Produto R$X (faixa Y%) → Vendeu R$Z → Comissão R$A + Taxa fixa R$B + Custo produto R$C + Ad R$D = Lucro R$E"
- Quando recomendar ação, diga EXATAMENTE: "Pausar campanha X", "Subir budget de Y para R$Z", "Criar campanha manual para produto W com ROAS target 5x"
- SEMPRE alertar quando produtos abaixo de R$80 estiverem com ROAS < 6x
- Use markdown para formatar` + loadShopeeKnowledge();

// ---------- Análise IA de Ads ----------

export async function generateAdsAnalysis(dashData: any): Promise<string> {
  const productCosts = await getProductCosts();

  const costSection = productCosts.length > 0
    ? `\n\nCUSTOS DOS PRODUTOS (o que Kaibren paga na Mondial):\n${productCosts.slice(0, 20).map(p => `- ${p.name} (${p.sku}): custo R$${p.cost.toFixed(2)} → venda R$${p.price.toFixed(2)} → margem ${p.margin}%`).join('\n')}\n\nUSE ESSES CUSTOS para calcular se os ads estão dando LUCRO REAL. Fórmula: Venda - Custo - Taxa Shopee (20%) - Custo Ad = Lucro.`
    : '\n\nATENÇÃO: Não consegui carregar os custos dos produtos. Analise com base nos dados de ROAS disponíveis.';

  const prompt = `Analise COMPLETA dos Ads da Shopee da Kaibren. Dê um diagnóstico de CEO — sem amenizar, sem enrolação.

SALDO DE CRÉDITOS ADS: R$${dashData.balance ?? 'N/A'}

KPIs (ÚLTIMOS 7 DIAS):
- Gasto total em ads: R$${dashData.kpis.expense7d}
- Faturamento DIRETO (produto clicado no ad): R$${dashData.kpis.directGmv7d}
- Faturamento AMPLO (qualquer produto da loja após clique): R$${dashData.kpis.broadGmv7d}
- ROAS direto: ${dashData.kpis.roas7d}x
- CTR: ${dashData.kpis.ctr7d}%
- CPC médio: R$${dashData.kpis.cpc7d}
- Total de cliques: ${dashData.kpis.clicks7d}
- Total de impressões: ${dashData.kpis.impressions7d}
- Pedidos gerados pelos ads: ${dashData.kpis.directOrders7d}

CAMPANHAS (${dashData.totalCampaigns} total | ${dashData.activeCampaigns} ativas | ${dashData.pausedCampaigns} pausadas):
${dashData.campaigns.length > 0 ? dashData.campaigns.map((c: any) => `- "${c.name}" [${c.status}] tipo=${c.type} placement=${c.placement} budget=R$${c.budget} bidding=${c.biddingMethod} ROAS_target=${c.roasTarget ?? 'auto'} produtos=${c.itemCount}`).join('\n') : '(nenhuma campanha)'}

PERFORMANCE DIÁRIA (14 dias — padrão de tendência):
${dashData.dailyPerformance.length > 0 ? dashData.dailyPerformance.map((d: any) => `${d.date}: gasto=R$${d.expense} vendas_diretas=R$${d.directGmv} ROAS=${d.directRoas}x cliques=${d.clicks} impr=${d.impressions} CTR=${d.ctr}%`).join('\n') : '(sem dados de performance)'}

ALERTAS DO SISTEMA:
${dashData.alerts.map((a: any) => `${a.level === 'red' ? '🔴' : a.level === 'yellow' ? '🟡' : '🟢'} ${a.message}`).join('\n')}
${costSection}

Responda com:
1. **DIAGNÓSTICO** — O que está acontecendo com os ads (bom, ruim, tendência). Mostre contas.
2. **AÇÕES IMEDIATAS (HOJE)** — Máximo 3 ações concretas com valores específicos
3. **PLANO 7 DIAS** — Estratégia de otimização semanal
4. **DECISÃO POR CAMPANHA** — Para cada campanha: manter/pausar/ajustar e por quê
5. **OPORTUNIDADES** — Produtos que deveriam estar sendo anunciados e não estão`;

  try {
    const result = await invokeLLM({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SAM_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      maxTokens: 4096,
    });

    const content = result.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    }
    return "Não foi possível gerar a análise no momento.";
  } catch (err: any) {
    console.error("[Shopee Ads IA] Erro:", err.message);
    return `Erro ao gerar análise: ${err.message}`;
  }
}

// ---------- Estrategias ----------

const STRATEGIES_PATH = path.join(process.cwd(), "server", "data", "shopee-strategies.json");

export interface Strategy {
  id: string;
  name: string;
  description: string;
  status: "testing" | "active" | "paused" | "rejected";
  samVerdict: string;
  successRate: number; // 0-100
  testsRun: number;
  testsWon: number;
  testStartDate: string; // inicio do periodo de teste (7 dias)
  testEndDate: string; // fim do periodo de teste
  createdAt: string;
  updatedAt: string;
  metrics?: { roas?: number; ctr?: number; cpc?: number; conversions?: number };
}

function loadStrategies(): Strategy[] {
  try {
    if (fs.existsSync(STRATEGIES_PATH)) {
      const raw = JSON.parse(fs.readFileSync(STRATEGIES_PATH, "utf-8"));
      return raw.strategies || [];
    }
  } catch {}
  return [];
}

function saveStrategies(strategies: Strategy[]) {
  const data = { strategies, version: 1, lastUpdated: new Date().toISOString().slice(0, 10) };
  fs.writeFileSync(STRATEGIES_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function getStrategies(): Strategy[] {
  return loadStrategies();
}

export function saveStrategy(strategy: Omit<Strategy, "id" | "createdAt" | "updatedAt" | "testStartDate" | "testEndDate"> & { testStartDate?: string; testEndDate?: string }): Strategy {
  const strategies = loadStrategies();
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 7);
  const newStrategy: Strategy = {
    ...strategy,
    id: `strat_${Date.now()}`,
    testStartDate: strategy.testStartDate || now.toISOString().slice(0, 10),
    testEndDate: strategy.testEndDate || endDate.toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  strategies.push(newStrategy);
  saveStrategies(strategies);
  return newStrategy;
}

export function updateStrategy(id: string, updates: Partial<Strategy>): Strategy | null {
  const strategies = loadStrategies();
  const idx = strategies.findIndex(s => s.id === id);
  if (idx === -1) return null;
  strategies[idx] = { ...strategies[idx], ...updates, updatedAt: new Date().toISOString() };
  saveStrategies(strategies);
  return strategies[idx];
}

export function deleteStrategy(id: string): boolean {
  const strategies = loadStrategies();
  const filtered = strategies.filter(s => s.id !== id);
  if (filtered.length === strategies.length) return false;
  saveStrategies(filtered);
  return true;
}

function strategiesContext(): string {
  const strategies = loadStrategies();
  if (strategies.length === 0) return "";
  let ctx = "\n\n## ESTRATÉGIAS ATIVAS/EM TESTE\n";
  for (const s of strategies) {
    ctx += `- **${s.name}** [${s.status}] — taxa de acerto: ${s.successRate}% (${s.testsWon}/${s.testsRun} testes)\n`;
    ctx += `  Descrição: ${s.description}\n`;
    if (s.samVerdict) ctx += `  Veredito Sam: ${s.samVerdict}\n`;
    if (s.metrics) {
      const m = s.metrics;
      ctx += `  Métricas: ${m.roas ? `ROAS ${m.roas}x` : ''} ${m.ctr ? `CTR ${m.ctr}%` : ''} ${m.cpc ? `CPC R$${m.cpc}` : ''}\n`;
    }
  }
  ctx += "\n### COMO FUNCIONA O SISTEMA DE ESTRATÉGIAS\n";
  ctx += "- Você é o CÉREBRO estratégico. Você CRIA estratégias, dá nome, define, testa e acompanha.\n";
  ctx += "- Cada estratégia tem um período de teste de **7 dias**. Só muda se parar de funcionar.\n";
  ctx += "- Quando Kaique propor uma ideia, AVALIE com dados reais, melhore a ideia e transforme em estratégia formal.\n";
  ctx += "- Quando VOCÊ identificar uma oportunidade nos dados, PROPONHA a estratégia proativamente.\n";
  ctx += "- Dê um nome criativo e memorável para cada estratégia (ex: 'Operação Margem Alta', 'Blitz Horário Nobre').\n";
  ctx += "- Para CRIAR ou ATUALIZAR uma estratégia, inclua no FINAL da resposta:\n";
  ctx += "```strategy\n{\"name\": \"Nome criativo\", \"description\": \"Descrição detalhada com regras e gatilhos\", \"status\": \"testing\", \"samVerdict\": \"Seu veredito com números\", \"successRate\": 0}\n```\n";
  ctx += "- Se Kaique reportar resultado (funcionou/não funcionou), atualize a taxa de acerto.\n";
  ctx += "- Se uma estratégia completou 7 dias com sucesso (ROAS dentro da meta), promova para 'active'.\n";
  ctx += "- Se falhou após 7 dias, mude para 'rejected' e proponha uma substituta.\n";
  return ctx;
}

export async function evaluateStrategy(question: string, dashData: any): Promise<{ answer: string; strategy?: any }> {
  const productCosts = await getProductCosts();
  const strategies = loadStrategies();

  const context = `DADOS ATUAIS DOS ADS SHOPEE:
Saldo: R$${dashData.balance ?? 'N/A'}
Gasto 7d: R$${dashData.kpis.expense7d} | Vendas diretas 7d: R$${dashData.kpis.directGmv7d}
ROAS: ${dashData.kpis.roas7d}x | CTR: ${dashData.kpis.ctr7d}% | CPC: R$${dashData.kpis.cpc7d}
Campanhas: ${dashData.totalCampaigns} total (${dashData.activeCampaigns} ativas)

${dashData.campaigns.length > 0 ? 'CAMPANHAS:\n' + dashData.campaigns.map((c: any) => `- "${c.name}" [${c.status}] budget=R$${c.budget} ROAS=${c.roasTarget ?? 'auto'} items=${c.itemCount}`).join('\n') : ''}

TENDÊNCIA 14d:
${dashData.dailyPerformance.slice(-7).map((d: any) => `${d.date}: R$${d.expense}→R$${d.directGmv} ROAS=${d.directRoas}x`).join('\n')}

${productCosts.length > 0 ? 'CUSTOS (top 10):\n' + productCosts.slice(0, 10).map(p => `- ${p.name}: custo R$${p.cost} venda R$${p.price} margem ${p.margin}%`).join('\n') : ''}`;

  try {
    const result = await invokeLLM({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SAM_SYSTEM_PROMPT + strategiesContext() + `\n\nDADOS ATUAIS:\n${context}` },
        { role: "user", content: question },
      ],
      maxTokens: 3000,
    });

    let content = result.choices?.[0]?.message?.content;
    if (Array.isArray(content)) {
      content = content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    }
    if (typeof content !== "string") return { answer: "Erro ao processar." };

    // Extrair bloco de estrategia se Sam incluiu
    const strategyMatch = content.match(/```strategy\n([\s\S]*?)\n```/);
    let strategyData: any = null;
    let cleanAnswer = content;

    if (strategyMatch) {
      try {
        strategyData = JSON.parse(strategyMatch[1]);
        cleanAnswer = content.replace(/```strategy\n[\s\S]*?\n```/, "").trim();
      } catch {}
    }

    return { answer: cleanAnswer, strategy: strategyData };
  } catch (err: any) {
    return { answer: `Erro: ${err.message}` };
  }
}

// ---------- Chat IA (perguntas livres) ----------

export async function askSamAds(question: string, dashData: any): Promise<string> {
  const productCosts = await getProductCosts();

  const context = `DADOS ATUAIS DOS ADS SHOPEE:
Saldo: R$${dashData.balance ?? 'N/A'}
Gasto 7d: R$${dashData.kpis.expense7d} | Vendas diretas 7d: R$${dashData.kpis.directGmv7d}
ROAS: ${dashData.kpis.roas7d}x | CTR: ${dashData.kpis.ctr7d}% | CPC: R$${dashData.kpis.cpc7d}
Cliques: ${dashData.kpis.clicks7d} | Impressões: ${dashData.kpis.impressions7d} | Pedidos ads: ${dashData.kpis.directOrders7d}
Campanhas: ${dashData.totalCampaigns} total (${dashData.activeCampaigns} ativas)

${dashData.campaigns.length > 0 ? 'CAMPANHAS:\n' + dashData.campaigns.map((c: any) => `- "${c.name}" [${c.status}] budget=R$${c.budget} ROAS=${c.roasTarget ?? 'auto'} items=${c.itemCount}`).join('\n') : ''}

TENDÊNCIA 14d:
${dashData.dailyPerformance.slice(-7).map((d: any) => `${d.date}: R$${d.expense}→R$${d.directGmv} ROAS=${d.directRoas}x`).join('\n')}

${productCosts.length > 0 ? 'CUSTOS (top 10):\n' + productCosts.slice(0, 10).map(p => `- ${p.name}: custo R$${p.cost} venda R$${p.price} margem ${p.margin}%`).join('\n') : ''}`;

  try {
    const result = await invokeLLM({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SAM_SYSTEM_PROMPT + strategiesContext() + `\n\nDADOS ATUAIS:\n${context}` },
        { role: "user", content: question },
      ],
      maxTokens: 2048,
    });

    const content = result.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    }
    return "Erro ao processar.";
  } catch (err: any) {
    console.error("[Sam Ads] Erro:", err.message);
    return `Erro: ${err.message}`;
  }
}
