/**
 * Curator — alimenta a knowledge base do Sam Chat (Shopee).
 *
 * Roda 1x/dia. Monta:
 *  - tom_voz: amostra de respostas reais do vendedor (até 20 mais recentes, ≥ 30 chars)
 *  - regra_geral: regras de loja (frete, prazo, garantia, troca) — seed editável
 *  - produto: catálogo Shopee + cruzamento CRM (custo, estoque, kit)
 */

import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  products as productsTable,
  shopeeChatKnowledge,
  shopeeMessages,
} from "../../../drizzle/schema";
import { fetchShopeeProducts, getConnectedShops } from "../../shopee";

const REGRA_SEED: { title: string; body: string }[] = [
  {
    title: "Prazo de entrega",
    body: "Após o pagamento confirmado, o pedido é separado e postado em até 1 dia útil. O prazo de entrega depende da região: capitais 3-7 dias úteis, interior 5-12 dias úteis. O Shopee Express é mais rápido (2-5 dias para a maioria das regiões).",
  },
  {
    title: "Frete",
    body: "Frete grátis em pedidos acima de R$ 79 (regra Shopee). Abaixo disso, o valor é calculado automaticamente pela Shopee no checkout, conforme CEP do cliente.",
  },
  {
    title: "Garantia",
    body: "Todos os produtos têm garantia de 90 dias por defeito de fabricação. Em caso de defeito, o cliente abre disputa pela Shopee enviando foto/vídeo do problema.",
  },
  {
    title: "Troca e devolução",
    body: "Troca e devolução pela política da Shopee: o cliente abre solicitação no app em até 7 dias após o recebimento. Aceitamos troca por defeito ou produto errado. Não trocamos por arrependimento após o uso.",
  },
  {
    title: "Compatibilidade",
    body: "Para confirmar compatibilidade da peça, peça ao cliente o modelo do aparelho (escrito embaixo do produto, em uma etiqueta) ou foto da etiqueta. A maior parte das peças Mondial atende air fryer AFN-30, AFN-40, AFN-50 e similares.",
  },
  {
    title: "Pedido errado / item faltando",
    body: "Se o cliente recebeu produto errado ou faltando, peça foto do que foi recebido + foto da nota fiscal/embalagem. A reposição é enviada após análise (geralmente 24h úteis).",
  },
  {
    title: "Nota fiscal",
    body: "Toda venda emite nota fiscal eletrônica (NF-e). O PDF fica disponível no app da Shopee em 'Meus pedidos' ou pode ser solicitado pelo chat. Razão social: CK Atacados / Kaibren.",
  },
];

export async function curateToneOfVoice(): Promise<{ samples: number }> {
  const db = await getDb();
  if (!db) return { samples: 0 };

  const sellerMsgs = await db
    .select({ content: shopeeMessages.content, sentAt: shopeeMessages.sentAt })
    .from(shopeeMessages)
    .where(eq(shopeeMessages.fromRole, "seller"))
    .orderBy(desc(shopeeMessages.sentAt))
    .limit(50);

  const samples = sellerMsgs
    .map((m) => (m.content || "").trim())
    .filter((t) => t.length >= 30 && t.length <= 600)
    .slice(0, 20);

  const body =
    samples.length > 0
      ? `Amostras de respostas reais do vendedor (Kaique/Brenda) nos últimos 90 dias. Use como referência de tom, vocabulário e estrutura:\n\n${samples
          .map((s, i) => `${i + 1}. ${s}`)
          .join("\n\n")}`
      : "Sem amostras suficientes ainda. Use tom cordial, direto, profissional, com 'você', sem gírias, sem cumprimento prolongado.";

  const existing = await db
    .select()
    .from(shopeeChatKnowledge)
    .where(
      and(
        eq(shopeeChatKnowledge.type, "tom_voz"),
        eq(shopeeChatKnowledge.scope, "kaibren"),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(shopeeChatKnowledge).values({
      type: "tom_voz",
      scope: "kaibren",
      title: "Tom de voz Kaibren (amostras)",
      body,
      source: "curator",
    });
  } else {
    await db
      .update(shopeeChatKnowledge)
      .set({ body, source: "curator" })
      .where(eq(shopeeChatKnowledge.id, existing[0].id));
  }

  return { samples: samples.length };
}

export async function seedRegrasGerais(): Promise<{ inserted: number }> {
  const db = await getDb();
  if (!db) return { inserted: 0 };

  let inserted = 0;
  for (const r of REGRA_SEED) {
    const existing = await db
      .select({ id: shopeeChatKnowledge.id })
      .from(shopeeChatKnowledge)
      .where(
        and(
          eq(shopeeChatKnowledge.type, "regra_geral"),
          eq(shopeeChatKnowledge.title, r.title),
        ),
      )
      .limit(1);
    if (existing.length === 0) {
      await db.insert(shopeeChatKnowledge).values({
        type: "regra_geral",
        scope: null,
        title: r.title,
        body: r.body,
        source: "curator",
      });
      inserted++;
    }
  }
  return { inserted };
}

interface CrmMatch {
  productId: number;
  nome: string;
  custo: number;
  precoFinal: number;
  estoqueAtual: number;
}

async function buildCrmIndex(): Promise<Map<string, CrmMatch>> {
  const db = await getDb();
  const index = new Map<string, CrmMatch>();
  if (!db) return index;

  const rows = await db
    .select({
      id: productsTable.id,
      titulo: productsTable.titulo,
      sku: productsTable.sku,
      tabelaNovaCk: productsTable.tabelaNovaCk,
      precoFinal: productsTable.precoFinal,
    })
    .from(productsTable);

  for (const r of rows) {
    const tokens = `${r.titulo || ""} ${r.sku || ""}`.toLowerCase();
    const norm = tokens.replace(/\s+/g, " ").trim();
    if (norm.length > 0) {
      index.set(norm, {
        productId: r.id,
        nome: r.titulo || "",
        custo: Number(r.tabelaNovaCk || 0),
        precoFinal: Number(r.precoFinal || 0),
        estoqueAtual: 0,
      });
    }
  }
  return index;
}

export async function curateProducts(): Promise<{ items: number }> {
  const db = await getDb();
  if (!db) return { items: 0 };

  const shops = await getConnectedShops();
  if (shops.length === 0) return { items: 0 };

  const crmIndex = await buildCrmIndex();
  let total = 0;

  for (const shop of shops) {
    let shopItems: any[] = [];
    try {
      shopItems = await fetchShopeeProducts(shop);
    } catch (err: any) {
      console.error(`[Sam Curator] fetchShopeeProducts ${shop.shopName}:`, err.message);
      continue;
    }

    for (const item of shopItems) {
      const itemId = String(item.item_id || item.itemId || "");
      if (!itemId) continue;

      const title: string = item.item_name || item.title || "";
      const description: string = item.description || "";
      const price = item.price_info?.[0]?.current_price ?? item.priceInfo?.[0]?.currentPrice ?? null;
      const stock = item.stock_info?.[0]?.current_stock ?? item.stockInfo?.[0]?.currentStock ?? null;

      const tokensTitle = title.toLowerCase().replace(/\s+/g, " ").trim();
      let crmMatch: CrmMatch | undefined;
      const entries = Array.from(crmIndex.entries());
      for (const [norm, m] of entries) {
        if (tokensTitle && norm.includes(tokensTitle.slice(0, 20))) {
          crmMatch = m;
          break;
        }
        if (norm && tokensTitle.includes(norm.slice(0, 20))) {
          crmMatch = m;
          break;
        }
      }

      const body = [
        `**Anúncio Shopee:** ${title}`,
        `**Item ID:** ${itemId}`,
        price !== null ? `**Preço Shopee:** R$ ${price}` : null,
        stock !== null ? `**Estoque Shopee:** ${stock} unidades` : null,
        description ? `\n**Descrição:**\n${description.slice(0, 1500)}` : null,
        crmMatch
          ? `\n**Cruzamento CRM:** ${crmMatch.nome} (id ${crmMatch.productId}) — custo R$ ${crmMatch.custo.toFixed(2)} / venda B2B R$ ${crmMatch.precoFinal.toFixed(2)}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      const scope = `shopee:${itemId}`;
      const existing = await db
        .select({ id: shopeeChatKnowledge.id })
        .from(shopeeChatKnowledge)
        .where(
          and(
            eq(shopeeChatKnowledge.type, "produto"),
            eq(shopeeChatKnowledge.scope, scope),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(shopeeChatKnowledge).values({
          type: "produto",
          scope,
          title: title.slice(0, 250),
          body,
          source: "curator",
        });
      } else {
        await db
          .update(shopeeChatKnowledge)
          .set({ title: title.slice(0, 250), body, source: "curator" })
          .where(eq(shopeeChatKnowledge.id, existing[0].id));
      }
      total++;
    }
  }
  return { items: total };
}

export async function runCurator(): Promise<{
  toneSamples: number;
  rulesInserted: number;
  productsIndexed: number;
}> {
  const tone = await curateToneOfVoice();
  const rules = await seedRegrasGerais();
  const products = await curateProducts();
  return {
    toneSamples: tone.samples,
    rulesInserted: rules.inserted,
    productsIndexed: products.items,
  };
}
