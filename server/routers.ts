import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { notifyOwner } from "./_core/notification";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { getMLOrders, getMLSalesSummary, getMLDailySales, refreshAllMLTokens } from "./mercadolivre";
import { getShopeeSalesSummary, refreshAllShopeeTokens } from "./shopee";
import { getShopeeHealthData, generateShopeeAnalysis } from "./shopee-intelligence";
import { getShopeeAdsDashboard, generateAdsAnalysis, askSamAds, getAdsCampaigns, getCampaignDailyPerformance, getRecommendedItems, getRecommendedKeywords, getStrategies, saveStrategy, updateStrategy, deleteStrategy, evaluateStrategy } from "./shopee-ads";
import { runShopeeResearch } from "./shopee-research";
import { getOperationsSnapshot, generateNoahBriefing, askNoah } from "./noah-command";
import { sql as drizzleSql, eq, desc, and, lte, gte, between, count as drizzleCount, sum } from "drizzle-orm";
import {
  inventory, inventoryEntries, inventoryCounts, inventoryCountItems,
  skuAliases, products, integrations, teamCharges, auditLog,
  orders, customers, marketplaceOrders, revenueSnapshots, mlMessages as mlMessagesTable,
} from "../drizzle/schema";
import { getMetaAdsSummary, getInstagramInsights, getFacebookAdsSummary, getInstagramMultiAccount } from "./marketing-meta";
import { getRecentOrders, getFilteredOrders, getAvailableAccounts } from "./orders-marketplace";
import { listIntegrations, upsertIntegration, deleteIntegration, testIntegration, decrypt } from "./integrations";
import { syncMLMessages, replyMLMessage, getMLConversation, listMLConversations, syncMLClaims, replyMLClaim, listMLClaims, getClaimMessages, mlSyncStatus } from "./ml-messages";
import { generateCreative, publishInstagramPost, contentStrategy } from "./studio";
import * as fs from "fs";

// ── Cache server-side para queries lentas (APIs externas ML/Shopee) ──
const _queryCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL: Record<string, number> = {
  mlSummary: 3 * 60_000,       // 3 min
  shopeeSummary: 3 * 60_000,   // 3 min
  insights: 10 * 60_000,       // 10 min
};
async function cachedQuery<T>(key: string, fn: () => Promise<T>, ttlKey?: string): Promise<T> {
  const ttl = CACHE_TTL[ttlKey || key] || 3 * 60_000;
  const cached = _queryCache.get(key);
  if (cached && Date.now() - cached.ts < ttl) return cached.data as T;
  const data = await fn();
  _queryCache.set(key, { data, ts: Date.now() });
  return data;
}
import {
  addCampaignProducts,
  createCampaign,
  createCampaignMessages,
  createCustomer,
  deleteCustomer,
  updateCustomer,
  createOrder,
  createProductUpload,
  getCampaignById,
  getCampaignMessageByTrackingCode,
  getCampaignProducts,
  getCampaignStats,
  getCustomerById,
  getCustomersWithPhone,
  getLatestProductUpload,
  getMonthlySummary,
  getOrderWithItems,
  insertOrderItems,
  listCampaignMessages,
  listCampaigns,
  listCustomers,
  listMarketingStrategies,
  listOrders,
  listProductUploads,
  listProducts,
  removeCampaignProducts,
  replaceProducts,
  searchCustomers,
  searchProducts,
  updateCampaign,
  updateCampaignMessageStatus,
  updateOrderStatus,
  updateProductPricingById,
  upsertMonthlySnapshot,
  getCustomerRanking,
  countCustomers,
  updateOrder,
  deleteOrderItems,
  deleteOrder,
  createMyCnpj,
  listMyCnpjs,
  getMyCnpjById,
  updateMyCnpj,
  deleteMyCnpj,
  getCnpjRanking,
  getCnpjEvolution,
  listBankStatements,
  getBankStatementById,
  updateBankStatement,
  deleteBankStatement,
  listBankTransactions,
  updateBankTransaction,
  updateBankTransactionsBatch,
  recalcStatementCounts,
  listFixedCosts,
  createFixedCost,
  updateFixedCost,
  deleteFixedCost,
  listFixedCostPayments,
  upsertFixedCostPayment,
  listCreditCards,
  createCreditCard,
  updateCreditCard,
  deleteCreditCard,
  listCreditCardInvoices,
  upsertCreditCardInvoice,
  listLoans,
  createLoan,
  updateLoan,
  deleteLoan,
  listLoanInstallments,
  upsertLoanInstallment,
  listLoanRetentionEntries,
  createLoanRetentionEntry,
  updateLoanRetentionEntry,
  deleteLoanRetentionEntry,
  listPayableAccounts,
  createPayableAccount,
  updatePayableAccount,
  deletePayableAccount,
  getPayablesDashboard,
  getDREData,
  listTeamMembers,
  createTeamMember,
  getTeamMemberById,
  listTeamTasks,
  upsertTeamRecord,
  getTeamRecords,
  getTeamDashboard,
  createTeamCharge,
  listMLCatalogProducts,
  upsertMLCatalogProduct,
  updateMLCatalogProductCosts,
  deleteMLCatalogProduct,
  getDb,
  rawQuery,
} from "./db";
import { storageGet, storagePut } from "./storage";
import * as XLSX from "xlsx";
import crypto from "crypto";

const decimalString = z.union([z.string(), z.number()]).transform(value => String(value ?? "0"));

const importedProductSchema = z.object({
  SKU: z.string(),
  Título: z.string(),
  "Tabela Nova CK": decimalString,
  Imposto: decimalString,
  Comissão: decimalString,
  "Valor Produto": decimalString,
  "Preço Desejado": decimalString,
  "Margem Desejada": z.union([z.string(), z.number(), z.null(), z.undefined()]).transform(value => value == null ? null : String(value)),
  "Preço Final": decimalString,
  "Margem Final": decimalString,
  Lucro: decimalString,
});

const customerInputSchema = z.object({
  name: z.string().min(1),
  reference: z.string().optional().nullable(),
  document: z.string().optional().nullable(),
  inscricaoEstadual: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const orderItemInputSchema = z.object({
  productId: z.number().nullable().optional(),
  sku: z.string(),
  titulo: z.string(),
  quantidade: z.number().int().min(1),
  tabelaNovaCk: decimalString,
  imposto: decimalString,
  comissao: decimalString,
  valorProduto: decimalString,
  precoDesejado: decimalString,
  precoFinal: decimalString,
  margemFinal: decimalString,
  lucroUnitario: decimalString,
});

const orderInputSchema = z.object({
  customerId: z.number().int().positive().optional().nullable(),
  customerName: z.string().min(1),
  customerReference: z.string().optional().nullable(),
  orderType: z.enum(["customer", "personal"]).default("customer"),
  periodYear: z.number().int(),
  periodMonth: z.number().int().min(1).max(12),
  notes: z.string().optional().nullable(),
  status: z.enum(["draft", "created", "finalized"]).default("created"),
  campaignId: z.number().int().positive().optional().nullable(),
  cnpjId: z.number().int().positive().optional().nullable(),
  items: z.array(orderItemInputSchema).min(1),
});

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function formatMoney(value: number) {
  return value.toFixed(4);
}

function formatMargin(value: number) {
  return value.toFixed(6);
}

function computeOrderTotals(items: z.infer<typeof orderItemInputSchema>[], orderType: "customer" | "personal") {
  const EVERTON_POR_ITEM = 0.75;

  const totals = items.reduce(
    (acc, item) => {
      const quantidade = toNumber(item.quantidade);
      const valorMondialUnit = toNumber(item.valorProduto);
      const valorRevendaUnit = toNumber(item.precoFinal || item.precoDesejado);
      const impostoUnit = toNumber(item.imposto);
      const totalMondial = valorMondialUnit * quantidade;
      const totalEverton = EVERTON_POR_ITEM * quantidade;

      acc.totalMondial += totalMondial;
      acc.totalComissaoEvertonMondial += totalEverton;
      acc.totalItens += quantidade;

      if (orderType === "customer") {
        // Venda para cliente: lucro = venda - custo Mondial - impostos - 0,75/item
        const totalVenda = valorRevendaUnit * quantidade;
        const totalImposto = impostoUnit * quantidade;
        const lucro = totalVenda - totalMondial - totalImposto - totalEverton;
        acc.totalCliente += totalVenda;
        acc.totalImposto += totalImposto;
        acc.totalLucro += lucro;
      }
      // Compra pessoal: sem imposto, sem lucro, sem valor cliente

      return acc;
    },
    {
      totalCliente: 0,
      totalMondial: 0,
      totalComissaoEvertonMondial: 0,
      totalImposto: 0,
      totalLucro: 0,
      totalItens: 0,
    }
  );

  const margemPedido = totals.totalCliente === 0 ? 0 : totals.totalLucro / totals.totalCliente;

  return {
    ...totals,
    margemPedido,
  };
}

/* ── Marketing Router ── */

const campaignInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  campaignType: z.enum(["promotional", "launch", "seasonal", "flash_sale", "loyalty"]).default("promotional"),
  discountLabel: z.string().optional().nullable(),
  discountPercent: z.union([z.string(), z.number()]).optional().nullable().transform(v => v == null ? null : String(v)),
  messageTemplate: z.string().optional().nullable(),
  productIds: z.array(z.number().int().positive()).optional().default([]),
  promoPrices: z.record(z.string(), z.string()).optional().default({}),
});

const marketingRouter = router({
  campaigns: router({
    list: protectedProcedure.query(async () => {
      return listCampaigns();
    }),
    detail: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const campaign = await getCampaignById(input.id);
        if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });
        const prods = await getCampaignProducts(input.id);
        const messages = await listCampaignMessages(input.id);
        const stats = await getCampaignStats(input.id);
        return { campaign, products: prods, messages, stats };
      }),
    create: adminProcedure
      .input(campaignInputSchema)
      .mutation(async ({ ctx, input }) => {
        const campaignId = await createCampaign({
          title: input.title,
          description: input.description ?? null,
          campaignType: input.campaignType,
          discountLabel: input.discountLabel ?? null,
          discountPercent: input.discountPercent ?? null,
          messageTemplate: input.messageTemplate ?? null,
          status: "draft",
          createdByUserId: ctx.user.id,
        });

        if (input.productIds.length > 0) {
          const allProducts = await listProducts(500);
          const productMap = new Map(allProducts.map(p => [p.id, p]));
          const campaignProds = input.productIds.map(pid => {
            const product = productMap.get(pid);
            return {
              campaignId,
              productId: pid,
              originalPrice: product?.precoFinal ?? "0.0000",
              promoPrice: input.promoPrices[String(pid)] ?? product?.precoFinal ?? "0.0000",
            };
          });
          await addCampaignProducts(campaignProds);
        }

        await notifyOwner({
          title: "Campanha criada",
          content: `Nova campanha "${input.title}" criada com ${input.productIds.length} produto(s).`,
        });

        return getCampaignById(campaignId);
      }),
    update: adminProcedure
      .input(z.object({ id: z.number().int().positive() }).merge(campaignInputSchema.partial()))
      .mutation(async ({ input }) => {
        const { id, productIds, promoPrices, ...data } = input;
        await updateCampaign(id, data as any);

        if (productIds && productIds.length > 0) {
          await removeCampaignProducts(id);
          const allProducts = await listProducts(500);
          const productMap = new Map(allProducts.map(p => [p.id, p]));
          const campaignProds = productIds.map(pid => {
            const product = productMap.get(pid);
            return {
              campaignId: id,
              productId: pid,
              originalPrice: product?.precoFinal ?? "0.0000",
              promoPrice: promoPrices?.[String(pid)] ?? product?.precoFinal ?? "0.0000",
            };
          });
          await addCampaignProducts(campaignProds);
        }

        return getCampaignById(id);
      }),
    uploadBanner: adminProcedure
      .input(z.object({
        campaignId: z.number().int().positive(),
        fileBase64: z.string().min(1),
        fileName: z.string().min(1),
        mimeType: z.string().default("image/png"),
      }))
      .mutation(async ({ ctx, input }) => {
        const campaign = await getCampaignById(input.campaignId);
        if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });

        const buffer = Buffer.from(input.fileBase64, "base64");
        const suffix = crypto.randomBytes(8).toString("hex");
        const key = `${ctx.user.id}-banners/${Date.now()}-${suffix}-${input.fileName}`;
        const { url, key: fileKey } = await storagePut(key, buffer, input.mimeType);

        await updateCampaign(input.campaignId, {
          bannerUrl: url,
          bannerFileKey: fileKey,
        });

        return { bannerUrl: url };
      }),
    generateMessage: adminProcedure
      .input(z.object({
        campaignId: z.number().int().positive(),
        strategyId: z.number().int().positive().optional(),
        customPrompt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const campaign = await getCampaignById(input.campaignId);
        if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });

        const prods = await getCampaignProducts(input.campaignId);
        const allProducts = await listProducts(500);
        const productMap = new Map(allProducts.map(p => [p.id, p]));

        const productList = prods.map(cp => {
          const product = productMap.get(cp.productId);
          const name = product?.titulo ?? `Produto #${cp.productId}`;
          const originalPrice = Number(cp.originalPrice ?? 0);
          const promoPrice = Number(cp.promoPrice ?? originalPrice);
          const hasDiscount = promoPrice < originalPrice;
          return hasDiscount
            ? `\u2022 ${name} - De R$ ${originalPrice.toFixed(2)} por R$ ${promoPrice.toFixed(2)}`
            : `\u2022 ${name} - R$ ${promoPrice.toFixed(2)}`;
        }).join("\n");

        let strategyContext = "";
        if (input.strategyId) {
          const strategies = await listMarketingStrategies();
          const strategy = strategies.find(s => s.id === input.strategyId);
          if (strategy) {
            strategyContext = `Use a estrat\u00e9gia de gatilho mental "${strategy.name}": ${strategy.description}. Exemplo de refer\u00eancia: ${strategy.exampleMessage}`;
          }
        }

        const systemPrompt = `Voc\u00ea \u00e9 um copywriter profissional especializado em marketing via WhatsApp para distribuidoras atacadistas brasileiras. Gere mensagens persuasivas, curtas e diretas, usando emojis de forma estrat\u00e9gica. A mensagem deve conter {nome} como placeholder para o nome do cliente e {produtos} como placeholder para a lista de produtos. A mensagem deve ser pronta para enviar no WhatsApp.`;

        const userPrompt = `Gere uma mensagem de WhatsApp para a campanha "${campaign.title}".
${campaign.description ? `Descri\u00e7\u00e3o: ${campaign.description}` : ""}
${campaign.discountLabel ? `Promo\u00e7\u00e3o: ${campaign.discountLabel}` : ""}
Tipo: ${campaign.campaignType}
Produtos em destaque:\n${productList || "(nenhum produto selecionado)"}
${strategyContext}
${input.customPrompt ? `Instru\u00e7\u00f5es adicionais: ${input.customPrompt}` : ""}

Gere APENAS a mensagem, sem explica\u00e7\u00f5es. Use {nome} e {produtos} como placeholders.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });

        const rawContent = response.choices?.[0]?.message?.content ?? "";
        const generatedMessage = typeof rawContent === "string" ? rawContent : "";
        return { message: generatedMessage.trim() };
      }),
    strategies: protectedProcedure.query(async () => {
      return listMarketingStrategies();
    }),
    sendToCustomers: adminProcedure
      .input(z.object({
        campaignId: z.number().int().positive(),
        customerIds: z.array(z.number().int().positive()).min(1),
      }))
      .mutation(async ({ input }) => {
        const campaign = await getCampaignById(input.campaignId);
        if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });

        const allCustomers = await listCustomers(500);
        const customerMap = new Map(allCustomers.map(c => [c.id, c]));

        const messages = input.customerIds.map(cid => {
          const customer = customerMap.get(cid);
          if (!customer) return null;
          const trackingCode = crypto.randomBytes(16).toString("hex");
          return {
            campaignId: input.campaignId,
            customerId: cid,
            customerName: customer.name,
            customerPhone: customer.phone ?? null,
            trackingCode,
            status: "sent" as const,
            sentAt: Date.now(),
          };
        }).filter(Boolean) as any[];

        await createCampaignMessages(messages);

        await updateCampaign(input.campaignId, {
          status: "active",
          sentAt: Date.now(),
          totalSent: messages.length,
        });

        await notifyOwner({
          title: "Campanha enviada",
          content: `Campanha "${campaign.title}" disparada para ${messages.length} cliente(s).`,
        });

        return { sent: messages.length, messages };
      }),
    trackClick: publicProcedure
      .input(z.object({ trackingCode: z.string() }))
      .mutation(async ({ input }) => {
        const msg = await getCampaignMessageByTrackingCode(input.trackingCode);
        if (!msg) throw new TRPCError({ code: "NOT_FOUND", message: "Código de rastreamento inválido" });

        if (msg.status === "sent" || msg.status === "delivered") {
          await updateCampaignMessageStatus(input.trackingCode, "clicked", { clickedAt: Date.now() });
          const stats = await getCampaignStats(msg.campaignId);
          await updateCampaign(msg.campaignId, {
            totalClicked: stats.totalClicked,
          });
        }

        return { success: true };
      }),
    markConversion: adminProcedure
      .input(z.object({
        trackingCode: z.string(),
        orderId: z.number().int().positive(),
        revenue: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const msg = await getCampaignMessageByTrackingCode(input.trackingCode);
        if (!msg) throw new TRPCError({ code: "NOT_FOUND", message: "Código de rastreamento inválido" });

        await updateCampaignMessageStatus(input.trackingCode, "converted", {
          convertedOrderId: input.orderId,
          convertedAt: Date.now(),
        });

        const stats = await getCampaignStats(msg.campaignId);
        await updateCampaign(msg.campaignId, {
          totalConverted: stats.totalConverted,
        });

        return { success: true };
      }),
    customersWithPhone: protectedProcedure.query(async () => {
      return getCustomersWithPhone();
    }),
    stats: protectedProcedure
      .input(z.object({ campaignId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getCampaignStats(input.campaignId);
      }),
  }),
  metaAds: protectedProcedure.query(async () => {
    return getMetaAdsSummary();
  }),
  instagram: protectedProcedure.query(async () => {
    return getInstagramInsights();
  }),
  facebookAds: protectedProcedure.query(async () => {
    return getFacebookAdsSummary();
  }),
  instagramMulti: protectedProcedure.query(async () => {
    return getInstagramMultiAccount();
  }),
});

const agentMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1),
});

const buildNoahLocalReply = (userName: string, message: string) => {
  const text = message.toLowerCase();

  if (text.includes("finance") || text.includes("gasto") || text.includes("lucro") || text.includes("dinheiro") || text.includes("cpf") || text.includes("cnpj")) {
    return `Kaique, no financeiro meu foco imediato é este:\n\n1. separar compras PJ de PF\n2. mapear cartões e contas usados hoje\n3. levantar custos fixos e variáveis\n4. descobrir onde a operação está sangrando\n\nHoje o maior risco que você mesmo já apontou é mistura de gastos no CPF e CNPJ. Assim que o módulo financeiro estiver 100% conectado, eu consigo te mostrar isso no painel com mais precisão.`;
  }

  if (text.includes("ads") || text.includes("facebook") || text.includes("meta") || text.includes("instagram") || text.includes("campanha")) {
    return `No marketing, o ponto principal vai ser ROAS e desperdício de verba.\n\nO que eu vou te mostrar aqui no CRM:\n- quanto investiu\n- quanto retornou\n- quais campanhas estão no prejuízo\n- qual conta performou melhor\n- quais horários trazem mais resultado\n\nA prioridade é conectar Meta Ads e Instagram Insights para parar de decidir no escuro.`;
  }

  if (text.includes("estoque") || text.includes("produto") || text.includes("ruptura") || text.includes("shopee") || text.includes("mercado livre") || text.includes("pedido")) {
    return `Na operação, eu vou acompanhar pedidos, produtos e ruptura por canal.\n\nO painel vai te mostrar:\n- últimos pedidos do ML e Shopee\n- conta de origem de cada venda\n- produto comprado\n- picos de horário\n- itens com estoque crítico\n\nSe quiser, o próximo passo operacional é conectar primeiro ML e Shopee para eu começar a te entregar isso com dado real.`;
  }

  if (text.includes("jur") || text.includes("advog") || text.includes("contrato") || text.includes("disputa") || text.includes("reclama")) {
    return `No jurídico, o Bruno vai cuidar de disputas, contratos e prazos.\n\nO objetivo é evitar perda por prazo vencido em reclamação, contrato mal feito ou fornecedor sem proteção formal.\n\nTambém quero colocar alerta de contrato vencendo e disputas abertas no ML/Shopee direto no painel.`;
  }

  if (text.includes("agente") || text.includes("time") || text.includes("equipe")) {
    return `Seu time de agentes está definido assim:\n\n🦾 Noah — CEO\n💰 Léo — Financeiro\n📊 Maya — Ads\n📦 Bia — Estoque\n⚖️ Rex — Fiscal\n🛒 Sam — Vendas\n🧑‍⚖️ Bruno — Jurídico\n\nMinha função é coordenar todos, cobrar entrega, redistribuir tarefa e te mostrar resultado no painel.`;
  }

  return `Olá, ${userName}. Estou online no CRM e consigo responder aqui dentro do painel.\n\nNeste momento meu modo está operacional/local: eu já consigo conversar com você sobre financeiro, vendas, estoque, ads, equipe, fiscal e jurídico.\n\nSe quiser, me peça algo objetivo agora, por exemplo:\n- "qual é sua prioridade no financeiro?"\n- "como vai funcionar o time de agentes?"\n- "o que você vai mostrar no dashboard?"`;
};

const agentRouter = router({
  status: protectedProcedure.query(({ ctx }) => ({
    enabled: true,
    provider: ENV.forgeApiKey ? "llm" : "local",
    mode: ENV.forgeApiKey ? "live" : "operational",
    authenticatedUserId: ctx.user.id,
    message: ENV.forgeApiKey
      ? "Noah está online e pronto para ajudar. Pergunte sobre vendas, estoque, financeiro ou qualquer área do negócio."
      : "Noah está online no modo operacional local. Você já pode conversar pelo painel sobre financeiro, vendas, estoque, ads, fiscal e jurídico.",
  })),
  chat: protectedProcedure
    .input(z.object({
      messages: z.array(agentMessageSchema).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const userName = ctx.user.name || "Kaique";
      const lastUserMessage = [...input.messages].reverse().find(m => m.role === "user")?.content || "";

      if (!ENV.forgeApiKey) {
        return {
          reply: buildNoahLocalReply(userName, lastUserMessage),
          metadata: {
            provider: "local",
            mode: "operational",
            userId: ctx.user.id,
            receivedMessages: input.messages.length,
          },
        };
      }

      const systemPrompt = `Você é o Noah 🦾 — CEO virtual e braço direito de ${userName} na Kaibren / CK Distribuidora.

CONTEXTO DO NEGÓCIO:
- Kaibren: e-commerce de peças de reposição para eletrodomésticos Mondial (botões, cestos, acoplamentos, motores, etc)
- Canais: Mercado Livre (3 contas: CLICKMULTII, DUOULTILIDADE, KAIBRENLTDA), Shopee, Amazon, TikTok Shop
- Equipe: Kaique + Brenda (financeiro/compras) + 2 funcionários
- Desafios reais: estoque escasso da Mondial, controle financeiro, ruptura frequente, 5 contas dividindo estoque pequeno
- ERP: Bling (R$1.100/mês) integrado com Shopee; Olist para notas fiscais
- Parceria Mondial: R$0,75/peça para garantir melhor tabela — estratégica, preservar

SEU ESTILO:
- Fala português brasileiro formal mas direto
- Vai ao ponto primeiro, detalha se necessário
- Tem opinião — se algo é arriscado, diz
- Proativo: aponta riscos, oportunidades, pendências
- Nunca elogios vazios
- Sempre termina com próximos passos concretos quando relevante

ÁREAS QUE DOMINA: vendas/marketplaces, estoque, financeiro, marketing (Meta Ads/Instagram), equipe, fiscal/tributário, jurídico/disputas.

Responda de forma concisa e útil. Use emojis com moderação.`;

      try {
        const llmMessages = [
          { role: "system" as const, content: systemPrompt },
          ...input.messages
            .filter(m => m.role !== "system")
            .map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        const result = await invokeLLM({ messages: llmMessages });
        const content = result.choices?.[0]?.message?.content;
        const reply = typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n")
            : buildNoahLocalReply(userName, lastUserMessage);

        return {
          reply,
          metadata: {
            provider: "llm",
            mode: "live",
            userId: ctx.user.id,
            receivedMessages: input.messages.length,
          },
        };
      } catch (err: any) {
        console.error("[Noah Chat] LLM error:", err.message);
        return {
          reply: buildNoahLocalReply(userName, lastUserMessage),
          metadata: {
            provider: "local",
            mode: "fallback",
            userId: ctx.user.id,
            error: err.message,
          },
        };
      }
    }),
});

// --- Equipe Router ---
const equipeRouter = router({
  dashboard: protectedProcedure.query(async () => {
    return getTeamDashboard();
  }),
  list: protectedProcedure.query(async () => {
    return listTeamMembers();
  }),
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      whatsapp: z.string().min(1),
      usesWhatsappOnly: z.number().int().min(0).max(1).default(0),
      tasks: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      const id = await createTeamMember(input);
      return getTeamMemberById(id);
    }),
  detail: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const member = await getTeamMemberById(input.id);
      if (!member) return null;
      const tasks = await listTeamTasks(input.id);
      const records = await getTeamRecords(input.id, 30);
      return { ...member, tasks, records };
    }),
  confirmTask: protectedProcedure
    .input(z.object({
      memberId: z.number().int().positive(),
      taskId: z.number().int().positive().optional(),
      status: z.enum(["cumprido", "nao_cumprido"]),
      photoPath: z.string().optional(),
      observation: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const today = new Date().toISOString().slice(0, 10);
      return upsertTeamRecord({
        memberId: input.memberId,
        taskId: input.taskId,
        date: today,
        status: input.status,
        photoPath: input.photoPath,
        observation: input.observation,
      });
    }),
  history: protectedProcedure
    .input(z.object({ memberId: z.number().int().positive(), limit: z.number().int().default(30) }))
    .query(async ({ input }) => {
      return getTeamRecords(input.memberId, input.limit);
    }),

  // Cobrança real via WhatsApp (Evolution API)
  charge: adminProcedure
    .input(z.object({ memberId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const member = await getTeamMemberById(input.memberId);
      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Funcionário não encontrado" });
      const tasks = await listTeamTasks(input.memberId);
      const today = new Date().toISOString().slice(0, 10);
      const listaTarefas = tasks.map((t: any, i: number) => `${i + 1}. ${t.description}`).join("\n");
      const mensagem = `⚠️ Olá ${member.name}!\n\nAs tarefas de hoje ainda não foram confirmadas:\n\n${listaTarefas}\n\nEnvie a foto comprovando. 📸`;

      // Tentar enviar via Evolution API
      const db = await getDb();
      let sent = false;
      let channel = "console";
      if (db) {
        const intRows = await db.select().from(integrations).where(eq(integrations.slug, "whatsapp")).limit(1);
        if (intRows.length > 0 && intRows[0].status === "connected" && intRows[0].accessToken) {
          try {
            const apiKey = decrypt(intRows[0].accessToken);
            const extra = intRows[0].extraConfig ? JSON.parse(intRows[0].extraConfig) : {};
            const apiUrl = extra.apiUrl;
            const instance = extra.instance;
            if (apiUrl && instance) {
              const numero = member.whatsapp.replace(/\D/g, "");
              const res = await fetch(`${apiUrl}/message/sendText/${instance}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: apiKey },
                body: JSON.stringify({ number: numero, text: mensagem }),
              });
              sent = res.ok;
              channel = "whatsapp";
            }
          } catch (e: any) { console.error("[CHARGE] Erro WhatsApp:", e.message); }
        }
      }

      // Registrar cobrança
      await createTeamCharge({ memberId: input.memberId, date: today, messageSent: mensagem });
      return { sent, channel, message: sent ? `Cobrança enviada para ${member.name} via WhatsApp` : `Cobrança registrada (WhatsApp não configurado — enviada no console)` };
    }),

  chargeAll: adminProcedure.mutation(async () => {
    const members = await listTeamMembers();
    const today = new Date().toISOString().slice(0, 10);
    const results: { name: string; sent: boolean }[] = [];

    for (const member of members.filter((m: any) => m.active === 1)) {
      const tasks = await listTeamTasks(member.id);
      const records = await getTeamRecords(member.id, 1);
      const todayRecord = records.find((r: any) => r.date === today);

      // Só cobrar se pendente ou não cumpriu
      if (!todayRecord || todayRecord.status === "pendente" || todayRecord.status === "nao_cumprido") {
        const listaTarefas = tasks.map((t: any, i: number) => `${i + 1}. ${t.description}`).join("\n");
        const mensagem = `⚠️ Olá ${member.name}!\n\nTarefas pendentes:\n\n${listaTarefas}\n\nEnvie a foto comprovando. 📸`;

        let sent = false;
        const db = await getDb();
        if (db) {
          const intRows = await db.select().from(integrations).where(eq(integrations.slug, "whatsapp")).limit(1);
          if (intRows.length > 0 && intRows[0].status === "connected" && intRows[0].accessToken) {
            try {
              const apiKey = decrypt(intRows[0].accessToken);
              const extra = intRows[0].extraConfig ? JSON.parse(intRows[0].extraConfig) : {};
              if (extra.apiUrl && extra.instance) {
                const numero = member.whatsapp.replace(/\D/g, "");
                const res = await fetch(`${extra.apiUrl}/message/sendText/${extra.instance}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", apikey: apiKey },
                  body: JSON.stringify({ number: numero, text: mensagem }),
                });
                sent = res.ok;
              }
            } catch (e: any) { console.error("[CHARGE-ALL] Erro:", e.message); }
          }
        }

        await createTeamCharge({ memberId: member.id, date: today, messageSent: mensagem });
        results.push({ name: member.name, sent });
      }
    }
    return { charged: results.length, results };
  }),

  // Desempenho / Performance do funcionário
  performance: protectedProcedure
    .input(z.object({ memberId: z.number().int().positive(), days: z.number().int().default(30) }))
    .query(async ({ input }) => {
      const records = await getTeamRecords(input.memberId, input.days);
      const cumpridos = records.filter((r: any) => r.status === "cumprido").length;
      const naoCumpridos = records.filter((r: any) => r.status === "nao_cumprido").length;
      const pendentes = records.filter((r: any) => r.status === "pendente").length;
      const total = records.length;
      const taxa = total > 0 ? Math.round((cumpridos / total) * 100) : 0;

      // Streak (dias consecutivos cumprindo)
      let streak = 0;
      const sorted = [...records].sort((a: any, b: any) => b.date.localeCompare(a.date));
      for (const r of sorted) {
        if ((r as any).status === "cumprido") streak++;
        else break;
      }

      // Charges
      const db = await getDb();
      let chargesCount = 0;
      if (db) {
        const [row] = await db.select({ count: drizzleSql`COUNT(*)` })
          .from(teamCharges)
          .where(eq(teamCharges.memberId, input.memberId));
        chargesCount = Number((row as any)?.count ?? 0);
      }

      return { cumpridos, naoCumpridos, pendentes, total, taxa, streak, chargesCount, records };
    }),
});

// --- Estoque Router ---
const estoqueRouter = router({
  // Dashboard de estoque
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, items: [], lowStock: [], recentEntries: [] };

    const items = await db.select({
      id: inventory.id,
      sku: inventory.sku,
      quantity: inventory.quantity,
      minStock: inventory.minStock,
      lastCountDate: inventory.lastCountDate,
      lastCountBy: inventory.lastCountBy,
      location: inventory.location,
      titulo: products.titulo,
      precoFinal: products.precoFinal,
      valorProduto: products.valorProduto,
    }).from(inventory)
      .leftJoin(products, eq(inventory.sku, products.sku))
      .orderBy(inventory.sku);

    const lowStock = items.filter((i: any) => i.quantity <= i.minStock);

    const recentEntries = await db.select().from(inventoryEntries)
      .orderBy(desc(inventoryEntries.createdAt)).limit(20);

    const totalQty = items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
    const totalValue = items.reduce((sum: number, i: any) => sum + ((i.quantity || 0) * Number(i.valorProduto || 0)), 0);

    return { total: items.length, totalQty, totalValue, items, lowStock, recentEntries };
  }),

  // Dar entrada de nota fiscal (batch)
  entradaNF: adminProcedure
    .input(z.object({
      nfNumber: z.string().min(1),
      nfSupplier: z.string().default("Mondial"),
      items: z.array(z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      let processed = 0;
      for (const item of input.items) {
        // Verificar se produto existe
        const [prod] = await db.select().from(products).where(eq(products.sku, item.sku)).limit(1);
        if (!prod) continue;

        // Buscar ou criar registro de estoque
        const [inv] = await db.select().from(inventory).where(eq(inventory.sku, item.sku)).limit(1);
        const prevQty = inv?.quantity ?? 0;
        const newQty = prevQty + item.quantity;

        if (inv) {
          await db.update(inventory).set({ quantity: newQty }).where(eq(inventory.sku, item.sku));
        } else {
          await db.insert(inventory).values({ productId: prod.id, sku: item.sku, quantity: newQty, minStock: 5 });
        }

        // Registrar movimentação
        await db.insert(inventoryEntries).values({
          sku: item.sku,
          type: "entrada_nf",
          quantity: item.quantity,
          previousQty: prevQty,
          newQty,
          nfNumber: input.nfNumber,
          nfSupplier: input.nfSupplier,
          createdByUserId: ctx.user.id,
        });
        processed++;
      }
      await logAudit(ctx.user.id, ctx.user.name || ctx.user.email, "create", "inventory", input.nfNumber, `Entrada NF ${input.nfNumber} — ${processed} itens (${input.nfSupplier})`);
      return { processed, nfNumber: input.nfNumber };
    }),

  // Atualizar contagem (João manda planilha / contagem manual)
  contagem: adminProcedure
    .input(z.object({
      countedBy: z.string().default("João"),
      items: z.array(z.object({
        sku: z.string().min(1),
        quantity: z.number().int().min(0),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });
      const today = new Date().toISOString().slice(0, 10);

      let adjusted = 0;
      for (const item of input.items) {
        // Pular itens com quantidade 0 que não existem no inventário
        const [inv] = await db.select().from(inventory).where(eq(inventory.sku, item.sku)).limit(1);
        const prevQty = inv?.quantity ?? 0;

        // Se não mudou e já existe (ou ambos 0), pular
        if (prevQty === item.quantity && (inv || item.quantity === 0)) continue;

        const [prod] = await db.select().from(products).where(eq(products.sku, item.sku)).limit(1);
        if (!prod) continue;

        if (inv) {
          await db.update(inventory).set({
            quantity: item.quantity,
            lastCountDate: today,
            lastCountBy: input.countedBy,
          }).where(eq(inventory.sku, item.sku));
        } else if (item.quantity > 0) {
          await db.insert(inventory).values({
            productId: prod.id, sku: item.sku, quantity: item.quantity,
            minStock: 5, lastCountDate: today, lastCountBy: input.countedBy,
          });
        }

        if (prevQty !== item.quantity) {
          await db.insert(inventoryEntries).values({
            sku: item.sku,
            type: "ajuste_contagem",
            quantity: item.quantity - prevQty,
            previousQty: prevQty,
            newQty: item.quantity,
            reason: `Contagem por ${input.countedBy}`,
            createdByUserId: ctx.user.id,
          });
        }
        adjusted++;
      }
      await logAudit(ctx.user.id, ctx.user.name || ctx.user.email, "count", "inventory", today, `Contagem por ${input.countedBy} — ${adjusted} itens ajustados`);
      return { adjusted, date: today };
    }),

  // João envia contagem (qualquer usuário logado)
  contagemFuncionario: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        sku: z.string().min(1),
        countedQty: z.number().int().min(0),
      })),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      // Criar contagem
      const [result] = await db.insert(inventoryCounts).values({
        countedBy: ctx.user.name || ctx.user.email,
        countedByUserId: ctx.user.id,
        status: "pendente",
        notes: input.notes || null,
      });
      const countId = result.insertId;

      // Inserir itens com diferença calculada
      let itemCount = 0;
      for (const item of input.items) {
        const [inv] = await db.select().from(inventory).where(eq(inventory.sku, item.sku)).limit(1);
        const systemQty = inv?.quantity ?? 0;
        const diff = item.countedQty - systemQty;

        await db.insert(inventoryCountItems).values({
          countId: Number(countId),
          sku: item.sku,
          countedQty: item.countedQty,
          systemQty,
          diff,
        });
        itemCount++;
      }

      return { countId: Number(countId), items: itemCount };
    }),

  // Listar contagens pendentes (admin)
  contagensPendentes: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const counts = await db.select().from(inventoryCounts).orderBy(desc(inventoryCounts.createdAt)).limit(20);

    const result = [];
    for (const count of counts) {
      const items = await db.select().from(inventoryCountItems).where(eq(inventoryCountItems.countId, count.id));
      result.push({ ...count, items });
    }
    return result;
  }),

  // Aprovar contagem (admin aplica os valores no estoque)
  aprovarContagem: adminProcedure
    .input(z.object({ countId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      const [count] = await db.select().from(inventoryCounts).where(eq(inventoryCounts.id, input.countId)).limit(1);
      if (!count) throw new TRPCError({ code: "NOT_FOUND", message: "Contagem não encontrada" });
      if (count.status !== "pendente") throw new TRPCError({ code: "BAD_REQUEST", message: "Contagem já processada" });

      const items = await db.select().from(inventoryCountItems).where(eq(inventoryCountItems.countId, input.countId));
      const today = new Date().toISOString().slice(0, 10);
      let adjusted = 0;

      for (const item of items) {
        if (item.diff === 0) continue;

        const [inv] = await db.select().from(inventory).where(eq(inventory.sku, item.sku)).limit(1);
        if (inv) {
          await db.update(inventory).set({
            quantity: item.countedQty,
            lastCountDate: today,
            lastCountBy: count.countedBy,
          }).where(eq(inventory.sku, item.sku));
        } else {
          const [prod] = await db.select().from(products).where(eq(products.sku, item.sku)).limit(1);
          if (prod) {
            await db.insert(inventory).values({
              productId: prod.id, sku: item.sku, quantity: item.countedQty,
              minStock: 5, lastCountDate: today, lastCountBy: count.countedBy,
            });
          }
        }

        await db.insert(inventoryEntries).values({
          sku: item.sku,
          type: "ajuste_contagem",
          quantity: item.diff,
          previousQty: item.systemQty,
          newQty: item.countedQty,
          reason: `Contagem #${input.countId} por ${count.countedBy} (aprovada)`,
          createdByUserId: ctx.user.id,
        });
        adjusted++;
      }

      await db.update(inventoryCounts).set({
        status: "aprovada",
        approvedByUserId: ctx.user.id,
        approvedAt: new Date(),
      }).where(eq(inventoryCounts.id, input.countId));

      await logAudit(ctx.user.id, ctx.user.name || ctx.user.email, "approve", "count", String(input.countId), `Contagem #${input.countId} aprovada — ${adjusted} itens atualizados`);
      return { adjusted, countId: input.countId };
    }),

  // Rejeitar contagem (admin)
  rejeitarContagem: adminProcedure
    .input(z.object({ countId: z.number(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      await db.update(inventoryCounts).set({
        status: "rejeitada",
        approvedByUserId: ctx.user.id,
        approvedAt: new Date(),
        notes: input.notes || null,
      }).where(eq(inventoryCounts.id, input.countId));

      return { countId: input.countId };
    }),

  // Itens do estoque (para contagem do funcionário - protectedProcedure)
  itensParaContagem: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    return db.select({
      sku: inventory.sku,
      quantity: inventory.quantity,
      titulo: products.titulo,
    }).from(inventory)
      .leftJoin(products, eq(inventory.sku, products.sku))
      .orderBy(inventory.sku);
  }),

  // Registrar saída de venda
  saidaVenda: adminProcedure
    .input(z.object({
      sku: z.string().min(1),
      quantity: z.number().int().positive(),
      platform: z.string().optional(),
      orderId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      const [inv] = await db.select().from(inventory).where(eq(inventory.sku, input.sku)).limit(1);
      const prevQty = inv?.quantity ?? 0;
      const newQty = Math.max(0, prevQty - input.quantity);

      if (inv) {
        await db.update(inventory).set({ quantity: newQty }).where(eq(inventory.sku, input.sku));
      }

      await db.insert(inventoryEntries).values({
        sku: input.sku, type: "saida_venda", quantity: -input.quantity,
        previousQty: prevQty, newQty,
        platform: input.platform, orderId: input.orderId,
        createdByUserId: ctx.user.id,
      });
      return { sku: input.sku, prevQty, newQty };
    }),

  // Aliases de SKU (mapear nomes diferentes nos marketplaces)
  aliases: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(skuAliases).orderBy(skuAliases.masterSku);
    }),
    upsert: adminProcedure
      .input(z.object({
        masterSku: z.string().min(1),
        platform: z.enum(["mercadolivre", "shopee", "amazon", "tiktok", "loja_fisica", "outro"]),
        externalSku: z.string().min(1),
        externalTitle: z.string().optional(),
        listingUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const existing = await db.select().from(skuAliases)
          .where(and(
            eq(skuAliases.masterSku, input.masterSku),
            eq(skuAliases.platform, input.platform),
            eq(skuAliases.externalSku, input.externalSku),
          )).limit(1);

        if (existing.length > 0) {
          await db.update(skuAliases).set({
            externalTitle: input.externalTitle || null,
            listingUrl: input.listingUrl || null,
          }).where(eq(skuAliases.id, existing[0].id));
          return { id: existing[0].id, action: "updated" };
        }

        const [result] = await db.insert(skuAliases).values({
          masterSku: input.masterSku,
          platform: input.platform,
          externalSku: input.externalSku,
          externalTitle: input.externalTitle || null,
          listingUrl: input.listingUrl || null,
        });
        return { id: result.insertId, action: "created" };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(skuAliases).where(eq(skuAliases.id, input.id));
        return { ok: true };
      }),
  }),

  // Movimentações
  entries: protectedProcedure
    .input(z.object({ sku: z.string().optional(), limit: z.number().int().default(50) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      let q = db.select().from(inventoryEntries).orderBy(desc(inventoryEntries.createdAt)).limit(input?.limit ?? 50);
      if (input?.sku) q = q.where(eq(inventoryEntries.sku, input.sku));
      return q;
    }),

  // Atualizar estoque mínimo
  updateMinStock: adminProcedure
    .input(z.object({ sku: z.string().min(1), minStock: z.number().int().min(0) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(inventory).set({ minStock: input.minStock }).where(eq(inventory.sku, input.sku));
      return { ok: true };
    }),

  deleteItem: adminProcedure
    .input(z.object({ sku: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(inventoryEntries).where(eq(inventoryEntries.sku, input.sku));
      await db.delete(inventory).where(eq(inventory.sku, input.sku));
      await logAudit(ctx.user.id, ctx.user.name || ctx.user.email, "delete", "inventory", input.sku, `Item ${input.sku} removido do estoque`);
      return { ok: true };
    }),

  // Visão por anúncio: produto físico → onde está anunciado
  visaoAnuncios: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const invItems = await db.select({
      sku: inventory.sku,
      quantity: inventory.quantity,
      minStock: inventory.minStock,
      titulo: products.titulo,
    }).from(inventory)
      .leftJoin(products, eq(inventory.sku, products.sku))
      .orderBy(inventory.sku);

    const aliases = await db.select().from(skuAliases).where(eq(skuAliases.active, 1));

    return invItems.map((item: any) => ({
      sku: item.sku,
      titulo: item.titulo || "—",
      quantity: item.quantity,
      minStock: item.minStock,
      anuncios: aliases
        .filter((a: any) => a.masterSku === item.sku)
        .map((a: any) => ({
          platform: a.platform,
          externalSku: a.externalSku,
          title: a.externalTitle || "—",
        })),
    }));
  }),
});

// --- Vendas ML Router ---
const vendasRouter = router({
  mlSummary: protectedProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const cacheKey = `mlSummary:${input?.dateFrom || ""}:${input?.dateTo || ""}`;
      return cachedQuery(cacheKey, () => getMLSalesSummary(input?.dateFrom, input?.dateTo), "mlSummary");
    }),
  mlOrders: protectedProcedure
    .input(z.object({
      account: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      return getMLOrders(
        input?.account,
        input?.dateFrom,
        input?.dateTo,
        input?.status,
        input?.limit ?? 50,
        input?.offset ?? 0,
      );
    }),
  mlDailySales: protectedProcedure
    .input(z.object({ days: z.number().int().min(1).max(90).default(7) }).optional())
    .query(async ({ input }) => {
      return getMLDailySales(input?.days ?? 7);
    }),
  mlRefreshTokens: adminProcedure.mutation(async () => {
    const results = await refreshAllMLTokens();
    return { ok: true, results };
  }),

  shopeeSummary: protectedProcedure.query(async () => {
    return cachedQuery("shopeeSummary", () => getShopeeSalesSummary());
  }),

  shopeeRefreshTokens: adminProcedure.mutation(async () => {
    const results = await refreshAllShopeeTokens();
    return { ok: true, results };
  }),

  dashboardInsights: protectedProcedure.query(async () => {
    return cachedQuery("insights", async () => {
    const DIAS_PT: Record<string, string> = {
      Monday: "Segunda-feira", Tuesday: "Terça-feira", Wednesday: "Quarta-feira",
      Thursday: "Quinta-feira", Friday: "Sexta-feira", Saturday: "Sábado", Sunday: "Domingo",
    };

    const [peakHours, topProduct, bestDay] = await Promise.all([
      rawQuery(`SELECT HOUR(platformCreatedAt) as hora, COUNT(*) as pedidos, ROUND(SUM(totalAmount),2) as total FROM marketplace_orders WHERE status='paid' GROUP BY hora ORDER BY pedidos DESC LIMIT 1`),
      rawQuery(`SELECT productName, productSku, SUM(quantity) as qty, ROUND(SUM(totalAmount),2) as total FROM marketplace_orders WHERE status='paid' GROUP BY productName, productSku ORDER BY qty DESC LIMIT 1`),
      rawQuery(`SELECT DAYNAME(platformCreatedAt) as dia, COUNT(*) as pedidos FROM marketplace_orders WHERE status='paid' GROUP BY dia ORDER BY pedidos DESC LIMIT 1`),
    ]);

    const peak = peakHours[0] as any;
    const product = topProduct[0] as any;
    const day = bestDay[0] as any;

    const peakHora = peak?.hora ?? 14;
    const peakFim = (peakHora + 2) % 24;

    return {
      peakHour: {
        range: `${peakHora}h — ${peakFim}h`,
        avgValue: Number(peak?.total ?? 0),
        bestDay: DIAS_PT[day?.dia ?? ""] ?? (day?.dia ?? "—"),
      },
      topProduct: {
        name: (product?.productName ?? "—").slice(0, 50),
        sku: product?.productSku ?? "—",
        qty: Number(product?.qty ?? 0),
        revenue: Number(product?.total ?? 0),
      },
    };
    });
  }),
});

// --- Agentes Router ---
const SEED_AGENTS = [
  { slug: "noah",  name: "Noah",  role: "CEO Virtual — Braço Direito do Kaique",               avatarEmoji: "🦾" },
  { slug: "leo",   name: "Léo",   role: "CFO — Controle Financeiro & Fluxo de Caixa",           avatarEmoji: "💰" },
  { slug: "maya",  name: "Maya",  role: "Especialista em Meta Ads — Facebook & Instagram",       avatarEmoji: "📊" },
  { slug: "bia",   name: "Bia",   role: "Gestora de Estoque — Peças Mondial & SKUs Kaibren",     avatarEmoji: "📦" },
  { slug: "rex",   name: "Rex",   role: "Fiscal Tributário — Notas Fiscais & Impostos",          avatarEmoji: "⚖️" },
  { slug: "sam",   name: "Sam",   role: "Analista de Vendas — Shopee, ML, Amazon & TikTok",      avatarEmoji: "🛒" },
  { slug: "bruno", name: "Bruno", role: "Jurídico — Disputas, Contratos & Compliance",           avatarEmoji: "🧑‍⚖️" },
  { slug: "luna",   name: "Luna",   role: "Agente de Conteúdo — Instagram & Redes Sociais",           avatarEmoji: "📸" },
  { slug: "vera",   name: "Vera",   role: "Agente da Loja Física — Tráfego Local Taboão da Serra",   avatarEmoji: "🏪" },
  { slug: "clara",  name: "Clara",  role: "B2B & Prospecção de Fornecedores — Mideia, Britânia",      avatarEmoji: "🤝" },
  { slug: "kaique", name: "Kaique", role: "Fundador — Ads, Etiquetas & Gestão Estratégica",           avatarEmoji: "👑" },
];

const MOCK_LOGS: Record<string, Array<{ type: string; content: string; time: string }>> = {
  noah: [
    { type: "analysis", content: "Score da empresa calculado: 78/100", time: "09:01" },
    { type: "task", content: "Delegou relatório financeiro para Léo", time: "09:05" },
    { type: "message", content: "Briefing matinal enviado para todos os agentes", time: "09:10" },
    { type: "alert", content: "Detectada queda de 12% nas vendas da conta DUOULTILIDADE", time: "09:22" },
    { type: "analysis", content: "Análise de performance semanal concluída", time: "09:30" },
  ],
  leo: [
    { type: "analysis", content: "DRE mensal atualizado — lucro bruto R$ 12.480", time: "09:02" },
    { type: "alert", content: "Gasto PF detectado: compra R$ 340 na conta PJ", time: "09:15" },
    { type: "task", content: "Relatório de custos fixos gerado", time: "09:25" },
  ],
  maya: [
    { type: "analysis", content: "ROAS médio hoje: 2.8x — campanha 'Conversão' liderando", time: "09:03" },
    { type: "alert", content: "Campanha 'Alcance' com ROAS 0.6 — abaixo do mínimo", time: "09:18" },
    { type: "task", content: "Otimização de budget sugerida para o período da tarde", time: "09:28" },
  ],
  bia: [
    { type: "alert", content: "3 produtos com estoque ≤ 5 unidades", time: "09:04" },
    { type: "analysis", content: "Previsão de ruptura: SKU-1247 em 3 dias", time: "09:20" },
    { type: "task", content: "Pedido de reposição sugerido para 8 SKUs", time: "09:35" },
  ],
  rex: [
    { type: "analysis", content: "Impostos estimados do mês: R$ 2.340", time: "09:06" },
    { type: "alert", content: "2 NFs pendentes de conferência", time: "09:16" },
    { type: "message", content: "Dica: separe compras PJ de PF para evitar problemas fiscais", time: "09:40" },
  ],
  sam: [
    { type: "analysis", content: "Faturamento hoje: R$ 1.840 (18 pedidos)", time: "09:08" },
    { type: "task", content: "Ranking de produtos atualizado", time: "09:22" },
    { type: "analysis", content: "Ticket médio: R$ 102 (+8% vs ontem)", time: "09:32" },
  ],
  bruno: [
    { type: "alert", content: "1 disputa ML vencendo amanhã — prazo de resposta 18h", time: "09:07" },
    { type: "task", content: "Contrato com fornecedor ABC vence em 28 dias", time: "09:25" },
    { type: "analysis", content: "Total disputas abertas: 3 (ML: 2, Shopee: 1)", time: "09:38" },
  ],
};

const MOCK_TASKS: Record<string, Array<{ title: string; status: string }>> = {
  noah: [
    { title: "Briefing matinal", status: "done" },
    { title: "Revisar alertas críticos", status: "running" },
    { title: "Gerar relatório semanal", status: "pending" },
  ],
  leo: [
    { title: "Atualizar DRE", status: "done" },
    { title: "Verificar gasto PF vs PJ", status: "running" },
  ],
  maya: [
    { title: "Otimizar campanhas ROAS < 1", status: "pending" },
    { title: "Gerar relatório de ads", status: "done" },
  ],
  bia: [
    { title: "Verificar estoque crítico", status: "done" },
    { title: "Sugerir reposição", status: "running" },
  ],
  rex: [
    { title: "Conferir NFs pendentes", status: "pending" },
    { title: "Calcular impostos estimados", status: "done" },
  ],
  sam: [
    { title: "Atualizar ranking de vendas", status: "done" },
    { title: "Análise de ticket médio", status: "done" },
    { title: "Comparação com dia anterior", status: "pending" },
  ],
  bruno: [
    { title: "Responder disputa ML #4821", status: "running" },
    { title: "Revisar contrato fornecedor ABC", status: "pending" },
  ],
};

const MOCK_ALERTS: Record<string, Array<{ level: string; title: string; message: string }>> = {
  noah: [{ level: "warning", title: "Queda nas vendas", message: "DUOULTILIDADE com -12% hoje" }],
  leo: [{ level: "critical", title: "Gasto PF na conta PJ", message: "Compra de R$ 340 identificada como PF" }],
  maya: [{ level: "warning", title: "ROAS abaixo de 1", message: "Campanha 'Alcance' com ROAS 0.6x" }],
  bia: [{ level: "critical", title: "Estoque crítico", message: "3 produtos com ≤ 5 unidades" }],
  rex: [{ level: "info", title: "NFs pendentes", message: "2 notas fiscais aguardando conferência" }],
  sam: [],
  bruno: [{ level: "critical", title: "Disputa vencendo", message: "Prazo de resposta em 18h — disputa ML #4821" }],
};

// ── Helpers para dados reais dos agentes ──────────────────────────

async function getAgentRealData() {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000); // Brasília
  const todayStr = now.toISOString().slice(0, 10);
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [ordersToday, ordersMonth, ordersByAccount, lowStock, lowStockItems, fixedCosts, loans] = await Promise.all([
    rawQuery(`SELECT COUNT(*) as count, SUM(totalAmount) as total FROM marketplace_orders WHERE DATE(platformCreatedAt) = ? AND status='paid'`, [todayStr]),
    rawQuery(`SELECT COUNT(*) as count, SUM(totalAmount) as total FROM marketplace_orders WHERE DATE(platformCreatedAt) >= ? AND status='paid'`, [monthStr]),
    rawQuery(`SELECT accountName, COUNT(*) as count, SUM(totalAmount) as total FROM marketplace_orders WHERE DATE(platformCreatedAt) = ? AND status='paid' GROUP BY accountName ORDER BY total DESC`, [todayStr]),
    rawQuery(`SELECT COUNT(*) as count FROM products WHERE estoque IS NOT NULL AND CAST(estoque AS SIGNED) <= 5`),
    rawQuery(`SELECT nome, sku, estoque FROM products WHERE estoque IS NOT NULL AND CAST(estoque AS SIGNED) <= 5 ORDER BY CAST(estoque AS SIGNED) ASC LIMIT 5`),
    rawQuery(`SELECT SUM(valor) as total FROM fixed_costs WHERE active=1`),
    rawQuery(`SELECT COUNT(*) as count, SUM(saldo) as total FROM loans WHERE status='active'`),
  ]);

  return {
    todayOrders: ordersToday[0] ?? { count: 0, total: 0 },
    monthOrders: ordersMonth[0] ?? { count: 0, total: 0 },
    ordersByAccount: ordersByAccount ?? [],
    lowStockCount: Number(lowStock[0]?.count ?? 0),
    lowStockItems: lowStockItems ?? [],
    fixedCostsTotal: Number(fixedCosts[0]?.total ?? 0),
    activeLoans: loans[0] ?? { count: 0, total: 0 },
  };
}

const agentesRouter = router({
  list: protectedProcedure.query(async () => {
    const rows = await rawQuery(`
      SELECT a.slug, a.name, a.role, a.avatarEmoji, a.status, a.lastActivity,
        (SELECT COUNT(*) FROM agent_tasks t WHERE t.agentId=a.id AND DATE(t.createdAt)=CURDATE()) as tasksToday,
        (SELECT COUNT(*) FROM agent_alerts al WHERE al.agentId=a.id AND al.isRead=0) as alertsCount,
        (SELECT COUNT(*) FROM agent_alerts al WHERE al.agentId=a.id AND al.isRead=0 AND al.level='critical') as criticalAlerts
      FROM agents a ORDER BY a.id`);
    if (!rows.length) return SEED_AGENTS.map(a => ({ ...a, status: "active" as const, lastActivity: new Date().toISOString(), tasksToday: 0, alertsCount: 0, criticalAlerts: 0 }));
    return rows.map((a: any) => ({
      slug: a.slug, name: a.name, role: a.role, avatarEmoji: a.avatarEmoji || "🤖",
      status: a.status || "active",
      lastActivity: a.lastActivity ? new Date(a.lastActivity).toISOString() : new Date().toISOString(),
      tasksToday: Number(a.tasksToday ?? 0), alertsCount: Number(a.alertsCount ?? 0), criticalAlerts: Number(a.criticalAlerts ?? 0),
    }));
  }),

  detail: protectedProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ input }) => {
      const agent = SEED_AGENTS.find(a => a.slug === input.slug);
      if (!agent) return null;
      const db = await getDb();
      if (!db) return { ...agent, status: "active" as const, lastActivity: new Date().toISOString(), logs: [], tasks: [], alerts: [] };

      const slug = input.slug;
      const [logRows, taskRows, alertRows] = await Promise.all([
        rawQuery(`SELECT l.id, l.type, l.content, l.createdAt FROM agent_logs l JOIN agents a ON l.agentId=a.id WHERE a.slug=? ORDER BY l.createdAt DESC LIMIT 20`, [slug]),
        rawQuery(`SELECT t.id, t.title, t.status, t.result, t.createdAt FROM agent_tasks t JOIN agents a ON t.agentId=a.id WHERE a.slug=? ORDER BY t.createdAt DESC LIMIT 20`, [slug]),
        rawQuery(`SELECT al.id, al.level, al.title, al.message, al.isRead, al.createdAt FROM agent_alerts al JOIN agents a ON al.agentId=a.id WHERE a.slug=? ORDER BY al.createdAt DESC LIMIT 20`, [slug]),
      ]);

      return {
        ...agent,
        status: "active" as const,
        lastActivity: new Date().toISOString(),
        logs: (logRows as any[]).map((l: any) => ({ id: l.id, type: l.type, content: l.content, createdAt: new Date(l.createdAt).toISOString() })),
        tasks: (taskRows as any[]).map((t: any) => ({ id: t.id, title: t.title, status: t.status, result: t.result, createdAt: new Date(t.createdAt).toISOString() })),
        alerts: (alertRows as any[]).map((a: any) => ({ id: a.id, level: a.level, title: a.title, message: a.message, isRead: !!a.isRead, createdAt: new Date(a.createdAt).toISOString() })),
      };
    }),

  allAlerts: protectedProcedure.query(async () => {
    const rows = await rawQuery(`SELECT COUNT(*) as count FROM agent_alerts WHERE level='critical' AND isRead=0`);
    return { criticalCount: Number(rows[0]?.count ?? 0) };
  }),

  teamStatus: protectedProcedure.query(async () => {
    const rows = await rawQuery(`
      SELECT a.slug, a.name, a.avatarEmoji,
        MAX(CASE WHEN al.level='critical' AND al.isRead=0 THEN 1 ELSE 0 END) as hasCritical,
        MAX(CASE WHEN al.level='warning' AND al.isRead=0 THEN 1 ELSE 0 END) as hasWarning
      FROM agents a LEFT JOIN agent_alerts al ON al.agentId=a.id GROUP BY a.id ORDER BY a.id`);
    if (!rows.length) return SEED_AGENTS.map(a => ({ slug: a.slug, name: a.name, emoji: a.avatarEmoji, status: "ok" }));
    return rows.map((r: any) => ({ slug: r.slug, name: r.name, emoji: r.avatarEmoji, status: r.hasCritical ? "critical" : r.hasWarning ? "warning" : "ok" }));
  }),

  // ── Painel CEO Noah — dados reais ──

  allTasks: protectedProcedure
    .input(z.object({ agentSlug: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const rows = await rawQuery(`SELECT t.id, t.title, t.status, t.result, t.createdAt, a.slug as agentSlug, a.name as agentName, a.avatarEmoji as agentEmoji FROM agent_tasks t JOIN agents a ON t.agentId=a.id ORDER BY t.createdAt DESC LIMIT 100`);
      let filtered = rows.map((t: any) => ({
        id: t.id, agentSlug: t.agentSlug, agentName: t.agentName, agentEmoji: t.agentEmoji,
        title: t.title, status: t.status, requestedAt: new Date(t.createdAt).toISOString(), result: t.result,
      }));
      if (input?.agentSlug) filtered = filtered.filter(t => t.agentSlug === input.agentSlug);
      if (input?.status) filtered = filtered.filter(t => t.status === input.status);
      return filtered;
    }),

  timeline: protectedProcedure.query(async () => {
    const rows = await rawQuery(`SELECT l.id, l.type, l.content, l.createdAt, a.slug as agentSlug, a.name as agentName, a.avatarEmoji as agentEmoji FROM agent_logs l JOIN agents a ON l.agentId=a.id ORDER BY l.createdAt DESC LIMIT 50`);
    return rows.map((l: any) => ({
      id: l.id, agentSlug: l.agentSlug, agentEmoji: l.agentEmoji, agentName: l.agentName,
      type: l.type, content: l.content, timestamp: new Date(l.createdAt).toISOString(),
      highlight: l.type === "alert" ? "critical" : l.type === "task" ? "gold" : undefined,
    }));
  }),

  reports: protectedProcedure.query(async () => {
    // Relatórios gerados a partir dos dados reais
    const real = await getAgentRealData();
    if (!real) return [];

    const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const todayStr = now.toLocaleDateString("pt-BR");
    const reports = [];

    // Sam — Vendas reais
    const todayTotal = Number(real.todayOrders.total ?? 0);
    const todayCount = Number(real.todayOrders.count ?? 0);
    const monthTotal = Number(real.monthOrders.total ?? 0);
    const monthCount = Number(real.monthOrders.count ?? 0);
    const topAccount = real.ordersByAccount[0];
    const ticketMedio = todayCount > 0 ? todayTotal / todayCount : 0;

    reports.push({
      id: 3, agentSlug: "sam", agentEmoji: "🛒", agentName: "Sam",
      title: `Vendas ML — ${todayStr}`,
      content: `Total hoje: ${todayTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${todayCount} pedidos)\nTicket médio: ${ticketMedio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}\nConta líder: ${topAccount?.accountName ?? "—"} (${topAccount?.count ?? 0} pedidos)\n\nMês atual: ${monthTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${monthCount} pedidos)\n\n${real.ordersByAccount.map((a: any) => `• ${a.accountName}: ${Number(a.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${a.count} pedidos)`).join("\n")}`,
      createdAt: new Date().toISOString(), isRead: false,
    });

    // Bia — Estoque real
    const lowItems = real.lowStockItems.map((p: any) => `• ${p.nome ?? p.sku}: ${p.estoque} un.`).join("\n");
    reports.push({
      id: 4, agentSlug: "bia", agentEmoji: "📦", agentName: "Bia",
      title: `Estoque Crítico — ${real.lowStockCount} produto(s) abaixo de 5 un.`,
      content: real.lowStockCount > 0
        ? `${real.lowStockCount} produto(s) com estoque crítico:\n${lowItems}\n\nAção recomendada: solicitar reposição imediata.`
        : `Nenhum produto em estoque crítico no momento. Todos acima de 5 unidades.`,
      createdAt: new Date().toISOString(), isRead: real.lowStockCount === 0,
    });

    // Léo — Financeiro real
    reports.push({
      id: 1, agentSlug: "leo", agentEmoji: "💰", agentName: "Léo",
      title: "Financeiro — Visão Atual",
      content: `Custos fixos ativos: ${real.fixedCostsTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês\nEmpréstimos ativos: ${real.activeLoans.count} (saldo: ${Number(real.activeLoans.total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})\n\nFaturamento ML hoje: ${todayTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}\nFaturamento ML no mês: ${monthTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}\n\nPróxima ação: verificar DRE do mês atual nas configurações.`,
      createdAt: new Date().toISOString(), isRead: false,
    });

    // Luna — Criativos
    reports.push({
      id: 5, agentSlug: "luna", agentEmoji: "🎨", agentName: "Luna",
      title: "Criativos Gerados — Fotos Reais ML",
      content: `11 criativos entregues com fotos reais puxadas da API do Mercado Livre (CLICKMULTII).\n\nFormatos:\n• Carrossel 3 mais vendidos (1080x1080)\n• 5× Card Instagram (1080x1080)\n• 5× Card ML/Shopee (1200x1200 fundo branco)\n\nProdutos cobertos:\n• Cabo Puxador AFN-40/50 Preto — R$56,98\n• Puxador AF-33/AF-34 Vermelho — R$67,98\n• Cuba AF-29/AF-30/AF-31 — R$109,98\n• Botão AF-33/AF-34 3,2L — R$23,98\n• Base Ventilador 30cm — R$27,98\n\nArquivos em: /workspace/agents/luna/output_reais/\n\nPendente: aprovação de Kaique por peça.\nPróximo: Stories 9:16 + variações com ângulos de dor e prova social.`,
      createdAt: new Date().toISOString(), isRead: false,
    });

    return reports;
  }),

  performanceScores: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return SEED_AGENTS.map((a, i) => ({ slug: a.slug, name: a.name, emoji: a.avatarEmoji, tasksCompleted: 0, tasksTotal: 0, completionRate: 0, avgTime: "—", alertsGenerated: 0, score: 50, rank: i + 1, variation: 0 }));

    const rows = await rawQuery(`
      SELECT a.slug, a.name, a.avatarEmoji,
        COUNT(t.id) as tasksTotal,
        SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) as tasksDone,
        COUNT(al.id) as alertsGenerated
      FROM agents a
      LEFT JOIN agent_tasks t ON t.agentId=a.id
      LEFT JOIN agent_alerts al ON al.agentId=a.id
      GROUP BY a.id ORDER BY a.id`);

    return rows.map((a: any, i: number) => {
      const total = Number(a.tasksTotal ?? 0);
      const done = Number(a.tasksDone ?? 0);
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const score = Math.min(100, pct + 60); // base 60 para agentes ativos
      return {
        slug: a.slug, name: a.name, emoji: a.avatarEmoji,
        tasksCompleted: done, tasksTotal: total, completionRate: pct,
        avgTime: "—", alertsGenerated: Number(a.alertsGenerated ?? 0),
        score, rank: i + 1, variation: 0,
      };
    }).sort((a: any, b: any) => b.score - a.score).map((a: any, i: number) => ({ ...a, rank: i + 1 }));
  }),
});

const studioRouter = router({
  generateCreative: adminProcedure
    .input(z.object({
      produto: z.string().min(1),
      detalhe: z.string().min(1),
      tipo: z.enum(["feed_produto", "feed_promo", "stories_urgencia", "reel_dica"]),
      publicar: z.boolean().optional().default(false),
    }))
    .mutation(async ({ input }) => {
      return generateCreative(input);
    }),
  publishPost: adminProcedure
    .input(z.object({
      imageUrl: z.string().url(),
      caption: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      return publishInstagramPost(input);
    }),
  contentTypes: protectedProcedure.query(() => {
    return Object.entries(contentStrategy).map(([key, val]) => ({
      value: key,
      label: val.label,
    }));
  }),
});

// --- Audit Router ---
const auditRouter = router({
  log: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(200).default(50),
      entity: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = input.entity ? eq(auditLog.entity, input.entity) : undefined;
      return db.select().from(auditLog)
        .where(conditions)
        .orderBy(desc(auditLog.createdAt))
        .limit(input.limit);
    }),
});

// Helper para registrar auditoria
async function logAudit(userId: number | null, userName: string, action: string, entity: string, entityId: string, description: string, previousValue?: string, newValue?: string) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(auditLog).values({ userId, userName, action, entity, entityId, description, previousValue, newValue });
  } catch (_) {}
}

// --- Relatórios Router ---
const relatoriosRouter = router({
  executivo: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    // Pedidos internos (safe query)
    let allOrders: any[] = [];
    let ordersMonth: any[] = [];
    try {
      allOrders = await db.select().from(orders);
      ordersMonth = allOrders.filter((o: any) => o.createdAt && o.createdAt.toISOString().slice(0, 10) >= startOfMonth);
    } catch (_) {}

    // Estoque resumo
    let invItems: any[] = [];
    try { invItems = await db.select().from(inventory); } catch (_) {}
    const totalPecas = invItems.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
    const lowStock = invItems.filter((i: any) => i.quantity <= i.minStock);

    // Clientes
    let allCustomers: any[] = [];
    try { allCustomers = await db.select().from(customers); } catch (_) {}

    // ML vendas (do cache/API)
    let mlSummary = null;
    try { mlSummary = await getMLSalesSummary(); } catch (_) {}

    // Shopee vendas
    let shopeeSummary = null;
    try { shopeeSummary = await getShopeeSalesSummary(); } catch (_) {}

    // Movimentações estoque recentes
    let recentMoves: any[] = [];
    try { recentMoves = await db.select().from(inventoryEntries).orderBy(desc(inventoryEntries.createdAt)).limit(5); } catch (_) {}

    return {
      pedidos: {
        total: allOrders.length,
        mes: ordersMonth.length,
        faturamentoMes: ordersMonth.reduce((s: number, o: any) => s + Number(o.totalCliente || 0), 0),
      },
      estoque: {
        totalSkus: invItems.length,
        totalPecas,
        lowStockCount: lowStock.length,
        lowStockItems: lowStock.slice(0, 5).map((i: any) => ({ sku: i.sku, qty: i.quantity, min: i.minStock })),
      },
      clientes: {
        total: allCustomers.length,
        ativos: allCustomers.filter((c: any) => c.isActive).length,
      },
      ml: mlSummary ? {
        today: mlSummary.totals?.today || 0,
        week: mlSummary.totals?.week || 0,
        month: mlSummary.totals?.month || 0,
        accounts: (mlSummary.accounts || []).map((a: any) => ({
          name: a.account,
          today: a.today || 0,
          month: a.month || 0,
        })),
      } : null,
      shopee: shopeeSummary ? {
        total: shopeeSummary.total || 0,
        week: shopeeSummary.thisWeek || 0,
        month: shopeeSummary.thisMonth || 0,
        orderCount: shopeeSummary.orderCount || 0,
        accounts: shopeeSummary.accounts || [],
      } : null,
      ultimasMovimentacoes: recentMoves,
    };
    } catch (err) {
      console.error("[RelatoriosExec] Erro:", err);
      return null;
    }
  }),

  lucroML: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    // Buscar produtos com custo
    const allProducts = await db.select({
      id: products.id,
      sku: products.sku,
      titulo: products.titulo,
      valorProduto: products.valorProduto,
      precoFinal: products.precoFinal,
      margemFinal: products.margemFinal,
    }).from(products);

    // Buscar vendas ML do banco
    const mlOrders = await db.select().from(marketplaceOrders)
      .where(eq(marketplaceOrders.platform, "mercadolivre"));

    // Cruzar vendas com custo
    const productSales: Record<string, { titulo: string; sku: string; custo: number; vendas: number; qtd: number; receita: number; lucro: number }> = {};

    for (const order of mlOrders) {
      try {
        const items = typeof order.itemsJson === "string" ? JSON.parse(order.itemsJson) : order.itemsJson;
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          const title = item.title || order.productName || "—";
          const key = title.toLowerCase().slice(0, 50);
          if (!productSales[key]) {
            // Tentar achar o produto pelo título
            const match = allProducts.find((p: any) => p.titulo && title.toLowerCase().includes(p.titulo.toLowerCase().slice(0, 20)));
            productSales[key] = {
              titulo: title,
              sku: match?.sku || "—",
              custo: Number(match?.valorProduto || 0),
              vendas: 0, qtd: 0, receita: 0, lucro: 0,
            };
          }
          const qty = item.quantity || 1;
          const price = item.unit_price || item.unitPrice || Number(order.totalAmount) || 0;
          productSales[key].vendas++;
          productSales[key].qtd += qty;
          productSales[key].receita += price * qty;
          productSales[key].lucro += (price - productSales[key].custo) * qty;
        }
      } catch (_) {}
    }

    return Object.values(productSales)
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 50);
  }),
});

// --- Alertas Router ---
const alertasRouter = router({
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const alerts: { type: string; level: string; title: string; message: string; entity?: string }[] = [];

    // 1. Estoque baixo
    const invItems = await db.select({
      sku: inventory.sku,
      quantity: inventory.quantity,
      minStock: inventory.minStock,
      titulo: products.titulo,
    }).from(inventory).leftJoin(products, eq(inventory.sku, products.sku));

    for (const item of invItems) {
      if (item.quantity <= item.minStock) {
        const isZero = item.quantity === 0;
        alerts.push({
          type: "estoque",
          level: isZero ? "critical" : "warning",
          title: isZero ? "Estoque zerado" : "Estoque baixo",
          message: `${item.sku} (${(item.titulo || "").slice(0, 40)}) — ${item.quantity} un (mín: ${item.minStock})`,
          entity: item.sku,
        });
      }
    }

    // 2. Contagens pendentes
    const pendingCounts = await db.select().from(inventoryCounts).where(eq(inventoryCounts.status, "pendente"));
    if (pendingCounts.length > 0) {
      alerts.push({
        type: "estoque",
        level: "info",
        title: "Contagens pendentes",
        message: `${pendingCounts.length} contagem(ns) aguardando sua aprovação`,
      });
    }

    // 3. Integrações com erro
    const allIntegrations = await listIntegrations();
    for (const integ of allIntegrations) {
      if (integ.lastError) {
        alerts.push({
          type: "integracao",
          level: "warning",
          title: `Erro em ${integ.name}`,
          message: integ.lastError.slice(0, 100),
          entity: integ.slug,
        });
      }
    }

    return alerts.sort((a, b) => {
      const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      return (order[a.level] ?? 3) - (order[b.level] ?? 3);
    });
  }),
});

// --- ML Messages Router ---
const mlMessagesRouter = router({
  syncStatus: protectedProcedure.query(() => {
    return {
      messages: {
        lastSync: mlSyncStatus.messages.lastSync?.toISOString() || null,
        synced: mlSyncStatus.messages.synced,
        errors: mlSyncStatus.messages.errors,
      },
      claims: {
        lastSync: mlSyncStatus.claims.lastSync?.toISOString() || null,
        synced: mlSyncStatus.claims.synced,
        errors: mlSyncStatus.claims.errors,
      },
    };
  }),

  sync: adminProcedure.mutation(async () => {
    return syncMLMessages();
  }),

  list: protectedProcedure
    .input(z.object({ filter: z.enum(["open", "answered", "all"]).default("all") }).optional())
    .query(async ({ input }) => {
      return listMLConversations(input?.filter || "all");
    }),

  conversation: protectedProcedure
    .input(z.object({ packId: z.string(), accountName: z.string() }))
    .query(async ({ input }) => {
      return getMLConversation(input.packId, input.accountName);
    }),

  reply: protectedProcedure
    .input(z.object({
      packId: z.string().min(1),
      accountName: z.string().min(1),
      text: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await replyMLMessage(input.packId, input.accountName, input.text);
      await logAudit(ctx.user.id, ctx.user.name || ctx.user.email, "create", "ml_message", input.packId, `Respondeu mensagem ML (${input.accountName})`);
      return result;
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return;
      await db.update(mlMessagesTable).set({ unread: 0 }).where(eq(mlMessagesTable.id, input.id));
      return { ok: true };
    }),

  // Reclamações
  syncClaims: adminProcedure.mutation(async () => {
    return syncMLClaims();
  }),

  claims: protectedProcedure
    .input(z.object({ filter: z.enum(["opened", "closed", "all"]).default("all") }).optional())
    .query(async ({ input }) => {
      return listMLClaims(input?.filter || "all");
    }),

  claimMessages: protectedProcedure
    .input(z.object({ claimId: z.string(), accountName: z.string() }))
    .query(async ({ input }) => {
      return getClaimMessages(input.claimId, input.accountName);
    }),

  replyClaim: protectedProcedure
    .input(z.object({
      claimId: z.string().min(1),
      accountName: z.string().min(1),
      text: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await replyMLClaim(input.claimId, input.accountName, input.text);
      await logAudit(ctx.user.id, ctx.user.name || ctx.user.email, "create", "ml_claim", input.claimId, `Respondeu reclamação ML #${input.claimId}`);
      return result;
    }),
});

const noahRouter = router({
  chat: adminProcedure
    .input(z.object({ message: z.string().min(1) }))
    .mutation(async ({ input }) => {
      console.log("[Noah Chat] Pergunta:", input.message.slice(0, 80));
      const t0 = Date.now();
      try {
        const answer = await askNoah(input.message);
        console.log("[Noah Chat] Resposta em", Date.now() - t0, "ms:", answer.slice(0, 80));
        return { answer };
      } catch (err: any) {
        console.error("[Noah Chat] ERRO:", err.message);
        return { answer: "Desculpe chefe, tive um problema técnico. Tenta de novo." };
      }
    }),
});

export const appRouter = router({
  system: systemRouter,
  agent: agentRouter,
  noah: noahRouter,
  vendas: vendasRouter,
  agentes: agentesRouter,
  equipe: equipeRouter,
  estoque: estoqueRouter,
  audit: auditRouter,
  relatoriosExec: relatoriosRouter,
  alertas: alertasRouter,
  mlMessages: mlMessagesRouter,
  studio: studioRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  products: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(500).default(100) }).optional())
      .query(async ({ input }) => {
        return listProducts(input?.limit ?? 100);
      }),
    updatePricing: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        valorProduto: decimalString,
        precoFinal: decimalString,
        imposto: decimalString.optional(),
        comissao: decimalString.optional(),
      }))
      .mutation(async ({ input }) => {
        const valorProduto = toNumber(input.valorProduto);
        const precoFinal = toNumber(input.precoFinal);
        const imposto = toNumber(input.imposto ?? 0);
        const comissao = toNumber(input.comissao ?? 0);
        const lucro = precoFinal - valorProduto - imposto - comissao;
        const margemFinal = valorProduto === 0 ? 0 : lucro / valorProduto;

        const updated = await updateProductPricingById({
          id: input.id,
          valorProduto: formatMoney(valorProduto),
          precoDesejado: formatMoney(precoFinal),
          precoFinal: formatMoney(precoFinal),
          lucro: formatMoney(lucro),
          margemFinal: formatMargin(margemFinal),
        });

        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
        }

        return updated;
      }),
    search: protectedProcedure
      .input(z.object({ query: z.string().optional(), limit: z.number().int().min(1).max(100).default(25) }).optional())
      .query(async ({ input }) => {
        return searchProducts(input?.query, input?.limit ?? 25);
      }),
    latestUpload: protectedProcedure.query(async () => {
      return getLatestProductUpload();
    }),
    restoreLatestUpload: adminProcedure.mutation(async () => {
      const uploads = await listProductUploads();
      const uploadToRestore = uploads.find((upload: Awaited<ReturnType<typeof listProductUploads>>[number]) => upload.importedRows > 0);

      if (!uploadToRestore) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Nenhuma planilha anterior com produtos foi encontrada para restaurar os SKUs." });
      }

      const download = await storageGet(uploadToRestore.originalFileKey);
      const response = await fetch(download.url);
      if (!response.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Não foi possível baixar a planilha usada na restauração do catálogo." });
      }

      const fileBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(fileBuffer, { type: "array" });
      const sheetName = workbook.SheetNames.includes(uploadToRestore.sourceSheetName)
        ? uploadToRestore.sourceSheetName
        : workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A planilha salva não contém uma aba válida para restauração." });
      }

      const parsedRows = XLSX.utils.sheet_to_json<Record<string, string | number | null>>(worksheet, {
        defval: "",
        raw: false,
      });

      const parsedProducts = parsedRows.map(row => importedProductSchema.parse(row));
      if (parsedProducts.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A planilha selecionada para restauração está vazia." });
      }

      const mapped = parsedProducts.map(item => ({
        uploadId: uploadToRestore.id,
        sku: item.SKU,
        titulo: item.Título,
        tabelaNovaCk: item["Tabela Nova CK"],
        imposto: item.Imposto,
        comissao: item.Comissão,
        valorProduto: item["Valor Produto"],
        precoDesejado: item["Preço Desejado"],
        margemDesejada: item["Margem Desejada"],
        precoFinal: item["Preço Final"],
        margemFinal: item["Margem Final"],
        lucro: item.Lucro,
      }));

      const replaced = await replaceProducts(mapped);

      await notifyOwner({
        title: "Catálogo restaurado",
        content: `Foram restaurados ${replaced.inserted} produtos a partir do upload ${uploadToRestore.fileName}.`,
      });

      return {
        uploadId: uploadToRestore.id,
        fileName: uploadToRestore.fileName,
        replaced,
      };
    }),
    importSpreadsheet: adminProcedure
      .input(z.object({
        fileName: z.string(),
        fileContentBase64: z.string(),
        fileHash: z.string().optional(),
        sourceSheetName: z.string().default("Tabela"),
        products: z.array(importedProductSchema),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileContentBase64, "base64");
        const key = `${ctx.user.id}-uploads/${Date.now()}-${input.fileName}`;
        const uploaded = await storagePut(key, buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        const uploadId = await createProductUpload({
          fileName: input.fileName,
          originalFileKey: uploaded.key,
          originalFileUrl: uploaded.url,
          fileHash: input.fileHash ?? null,
          sourceSheetName: input.sourceSheetName,
          importedRows: input.products.length,
          uploadedByUserId: ctx.user.id,
        });

        const mapped = input.products.map(item => ({
          uploadId,
          sku: item.SKU,
          titulo: item.Título,
          tabelaNovaCk: item["Tabela Nova CK"],
          imposto: item.Imposto,
          comissao: item.Comissão,
          valorProduto: item["Valor Produto"],
          precoDesejado: item["Preço Desejado"],
          margemDesejada: item["Margem Desejada"],
          precoFinal: item["Preço Final"],
          margemFinal: item["Margem Final"],
          lucro: item.Lucro,
        }));

        const replaced = await replaceProducts(mapped);

        await notifyOwner({
          title: "Planilha de produtos importada",
          content: `Foram importados ${replaced.inserted} produtos do arquivo ${input.fileName}.`,
        });

        return {
          uploadId,
          uploaded,
          replaced,
        };
      }),
  }),
  customers: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(500).default(100) }).optional())
      .query(async ({ input }) => {
        return listCustomers(input?.limit ?? 100);
      }),
    search: protectedProcedure
      .input(z.object({ query: z.string().optional(), limit: z.number().int().min(1).max(100).default(20) }).optional())
      .query(async ({ input }) => {
        return searchCustomers(input?.query, input?.limit ?? 20);
      }),
    create: adminProcedure
      .input(customerInputSchema)
      .mutation(async ({ ctx, input }) => {
        const customerId = await createCustomer({
          name: input.name,
          reference: input.reference ?? null,
          document: input.document ?? null,
          inscricaoEstadual: input.inscricaoEstadual ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          notes: input.notes ?? null,
          createdByUserId: ctx.user.id,
        });

        const created = await getCustomerById(customerId);
        await notifyOwner({
          title: "Cliente cadastrado",
          content: `O cliente ${input.name} foi cadastrado na base da CK Distribuidora.`,
        });

        return created;
      }),
    update: adminProcedure
      .input(z.object({ id: z.number().int().positive() }).merge(customerInputSchema.partial()))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const existing = await getCustomerById(id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
        return updateCustomer(id, data as any);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const existing = await getCustomerById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
        await deleteCustomer(input.id);
        return { success: true };
      }),
    ranking: protectedProcedure
      .input(z.object({ periodYear: z.number().int(), periodMonth: z.number().int().min(1).max(12), limit: z.number().int().min(1).max(50).default(10) }))
      .query(async ({ input }) => {
        return getCustomerRanking(input.periodYear, input.periodMonth, input.limit);
      }),
    count: protectedProcedure.query(async () => {
      return countCustomers();
    }),
  }),
  orders: router({
    simulate: protectedProcedure
      .input(z.object({ orderType: z.enum(["customer", "personal"]).default("customer"), items: z.array(orderItemInputSchema).min(1) }))
      .mutation(async ({ input }) => {
        const totals = computeOrderTotals(input.items, input.orderType);

        const customerList = input.orderType === "personal"
          ? []
          : input.items.map(item => ({
              sku: item.sku,
              titulo: item.titulo,
              quantidade: item.quantidade,
              precoVendaUnitario: formatMoney(toNumber(item.precoFinal || item.precoDesejado)),
              totalCliente: formatMoney(toNumber(item.precoFinal || item.precoDesejado) * toNumber(item.quantidade)),
            }));

        const mondialList = input.items.map(item => ({
          sku: item.sku,
          titulo: item.titulo,
          quantidade: item.quantidade,
          valorCompraUnitario: formatMoney(toNumber(item.valorProduto)),
          totalMondial: formatMoney(toNumber(item.valorProduto) * toNumber(item.quantidade)),
          evertonMondial: formatMoney(toNumber(item.comissao) * toNumber(item.quantidade)),
        }));

        return {
          totals: {
            totalCliente: formatMoney(totals.totalCliente),
            totalMondial: formatMoney(totals.totalMondial),
            totalComissaoEvertonMondial: formatMoney(totals.totalComissaoEvertonMondial),
            totalImposto: formatMoney(totals.totalImposto),
            totalLucro: formatMoney(totals.totalLucro),
            margemPedido: formatMargin(totals.margemPedido),
            totalItens: totals.totalItens,
          },
          customerList,
          mondialList,
        };
      }),
    create: adminProcedure
      .input(orderInputSchema)
      .mutation(async ({ ctx, input }) => {
        const totals = computeOrderTotals(input.items, input.orderType);
        const orderId = await createOrder({
          customerId: input.customerId ?? null,
          customerName: input.customerName,
          customerReference: input.customerReference ?? null,
          orderType: input.orderType,
          status: input.status,
          periodYear: input.periodYear,
          periodMonth: input.periodMonth,
          notes: input.notes ?? null,
          totalCliente: formatMoney(totals.totalCliente),
          totalMondial: formatMoney(totals.totalMondial),
          totalComissaoEvertonMondial: formatMoney(totals.totalComissaoEvertonMondial),
          totalLucro: formatMoney(totals.totalLucro),
          margemPedido: formatMargin(totals.margemPedido),
          totalItens: totals.totalItens,
          createdByUserId: ctx.user.id,
          finalizedAt: input.status === "finalized" ? new Date() : null,
          campaignId: input.campaignId ?? null,
          cnpjId: input.cnpjId ?? null,
        });

        await insertOrderItems(
          input.items.map(item => ({
            orderId,
            productId: item.productId ?? null,
            sku: item.sku,
            titulo: item.titulo,
            quantidade: item.quantidade,
            tabelaNovaCk: item.tabelaNovaCk,
            imposto: item.imposto,
            comissao: item.comissao,
            valorProduto: item.valorProduto,
            precoDesejado: item.precoDesejado,
            precoFinal: item.precoFinal,
            margemFinal: item.margemFinal,
            lucroUnitario: input.orderType === "personal" ? "0.0000" : item.lucroUnitario,
            totalCliente: input.orderType === "personal" ? "0.0000" : formatMoney(toNumber(item.precoFinal || item.precoDesejado) * toNumber(item.quantidade)),
            totalMondial: formatMoney(toNumber(item.valorProduto) * toNumber(item.quantidade)),
            totalComissaoEvertonMondial: formatMoney(toNumber(item.comissao) * toNumber(item.quantidade)),
            totalLucro: input.orderType === "personal" ? "0.0000" : formatMoney(toNumber(item.lucroUnitario) * toNumber(item.quantidade)),
          }))
        );

        const monthly = await getMonthlySummary(input.periodYear, input.periodMonth);
        await upsertMonthlySnapshot({
          periodYear: input.periodYear,
          periodMonth: input.periodMonth,
          totalPedidos: Number(monthly.totalPedidos ?? 0),
          totalPedidosCliente: Number(monthly.totalPedidosCliente ?? 0),
          totalPedidosPessoais: Number(monthly.totalPedidosPessoais ?? 0),
          totalCliente: String(monthly.totalCliente ?? "0.0000"),
          totalMondial: String(monthly.totalMondial ?? "0.0000"),
          totalComprasPessoais: String(monthly.totalComprasPessoais ?? "0.0000"),
          totalVendasClientes: String(monthly.totalVendasClientes ?? "0.0000"),
          totalComissaoEvertonMondial: String(monthly.totalComissaoEvertonMondial ?? "0.0000"),
          totalLucro: String(monthly.totalLucro ?? "0.0000"),
          margemMedia: String(monthly.margemMedia ?? "0.000000"),
          atualizadoEm: Date.now(),
        });

        // Update campaign conversion metrics if linked to a campaign
        if (input.campaignId) {
          const campaign = await getCampaignById(input.campaignId);
          if (campaign) {
            const revenueToAdd = toNumber(totals.totalCliente);
            await updateCampaign(input.campaignId, {
              totalConverted: (campaign.totalConverted ?? 0) + 1,
              totalRevenue: formatMoney(toNumber(campaign.totalRevenue) + revenueToAdd),
            });
          }
        }

        const actionLabel = input.status === "finalized" ? "finalizado" : "criado";
        const orderKind = input.orderType === "personal" ? "pessoal" : "de cliente";
        await notifyOwner({
          title: `Pedido ${actionLabel}`,
          content: `Pedido #${orderId} ${orderKind} salvo para ${input.customerName} com compra Mondial de ${formatMoney(totals.totalMondial)} e lucro de ${formatMoney(totals.totalLucro)}.`,
        });

        return getOrderWithItems(orderId);
      }),
    finalize: adminProcedure
      .input(z.object({ orderId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await updateOrderStatus(input.orderId, "finalized");
        const result = await getOrderWithItems(input.orderId);
        if (!result.order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
        }

        await notifyOwner({
          title: "Pedido finalizado",
          content: `Pedido #${input.orderId} de ${result.order.customerName} foi finalizado.`,
        });

        return result;
      }),
    list: protectedProcedure.query(async () => {
      return listOrders();
    }),
    detail: protectedProcedure
      .input(z.object({ orderId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const result = await getOrderWithItems(input.orderId);
        if (!result.order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
        }
        return result;
      }),
    update: adminProcedure
      .input(z.object({
        orderId: z.number().int().positive(),
        customerName: z.string().min(1).optional(),
        customerReference: z.string().nullish(),
        customerId: z.number().int().positive().nullish(),
        orderType: z.enum(["customer", "personal"]).optional(),
        notes: z.string().nullish(),
        campaignId: z.number().int().positive().nullish(),
        cnpjId: z.number().int().positive().nullish(),
        items: z.array(orderItemInputSchema).min(1),
      }))
      .mutation(async ({ input }) => {
        const existing = await getOrderWithItems(input.orderId);
        if (!existing.order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
        }

        const orderType = input.orderType ?? existing.order.orderType;
        const totals = computeOrderTotals(input.items, orderType);

        // Update order header
        await updateOrder(input.orderId, {
          customerName: input.customerName ?? existing.order.customerName,
          customerReference: input.customerReference !== undefined ? input.customerReference ?? null : existing.order.customerReference,
          customerId: input.customerId !== undefined ? input.customerId ?? null : existing.order.customerId,
          orderType,
          notes: input.notes !== undefined ? input.notes ?? null : existing.order.notes,
          campaignId: input.campaignId !== undefined ? input.campaignId ?? null : existing.order.campaignId,
          cnpjId: input.cnpjId !== undefined ? input.cnpjId ?? null : (existing.order as any).cnpjId,
          totalCliente: formatMoney(totals.totalCliente),
          totalMondial: formatMoney(totals.totalMondial),
          totalComissaoEvertonMondial: formatMoney(totals.totalComissaoEvertonMondial),
          totalLucro: formatMoney(totals.totalLucro),
          margemPedido: formatMargin(totals.margemPedido),
          totalItens: totals.totalItens,
        });

        // Replace order items
        await deleteOrderItems(input.orderId);
        await insertOrderItems(
          input.items.map(item => ({
            orderId: input.orderId,
            productId: item.productId ?? null,
            sku: item.sku,
            titulo: item.titulo,
            quantidade: item.quantidade,
            tabelaNovaCk: item.tabelaNovaCk,
            imposto: item.imposto,
            comissao: item.comissao,
            valorProduto: item.valorProduto,
            precoDesejado: item.precoDesejado,
            precoFinal: item.precoFinal,
            margemFinal: item.margemFinal,
            lucroUnitario: orderType === "personal" ? "0.0000" : item.lucroUnitario,
            totalCliente: orderType === "personal" ? "0.0000" : formatMoney(toNumber(item.precoFinal || item.precoDesejado) * toNumber(item.quantidade)),
            totalMondial: formatMoney(toNumber(item.valorProduto) * toNumber(item.quantidade)),
            totalComissaoEvertonMondial: formatMoney(toNumber(item.comissao) * toNumber(item.quantidade)),
            totalLucro: orderType === "personal" ? "0.0000" : formatMoney(toNumber(item.lucroUnitario) * toNumber(item.quantidade)),
          }))
        );

        // Recalculate monthly snapshot
        const periodYear = existing.order.periodYear;
        const periodMonth = existing.order.periodMonth;
        const monthly = await getMonthlySummary(periodYear, periodMonth);
        await upsertMonthlySnapshot({
          periodYear,
          periodMonth,
          totalPedidos: Number(monthly.totalPedidos ?? 0),
          totalPedidosCliente: Number(monthly.totalPedidosCliente ?? 0),
          totalPedidosPessoais: Number(monthly.totalPedidosPessoais ?? 0),
          totalCliente: String(monthly.totalCliente ?? "0.0000"),
          totalMondial: String(monthly.totalMondial ?? "0.0000"),
          totalComprasPessoais: String(monthly.totalComprasPessoais ?? "0.0000"),
          totalVendasClientes: String(monthly.totalVendasClientes ?? "0.0000"),
          totalComissaoEvertonMondial: String(monthly.totalComissaoEvertonMondial ?? "0.0000"),
          totalLucro: String(monthly.totalLucro ?? "0.0000"),
          margemMedia: String(monthly.margemMedia ?? "0.000000"),
          atualizadoEm: Date.now(),
        });

        return getOrderWithItems(input.orderId);
      }),
    changeType: adminProcedure
      .input(z.object({
        orderId: z.number().int().positive(),
        orderType: z.enum(["customer", "personal"]),
      }))
      .mutation(async ({ input }) => {
        const existing = await getOrderWithItems(input.orderId);
        if (!existing.order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Pedido n\u00e3o encontrado." });
        }

        // Recalculate totals with new type
        const totals = computeOrderTotals(
          existing.items.map(item => ({
            sku: item.sku,
            titulo: item.titulo,
            quantidade: Number(item.quantidade),
            tabelaNovaCk: String(item.tabelaNovaCk),
            imposto: String(item.imposto),
            comissao: String(item.comissao),
            valorProduto: String(item.valorProduto),
            precoDesejado: String(item.precoDesejado),
            precoFinal: String(item.precoFinal),
            margemFinal: String(item.margemFinal),
            lucroUnitario: String(item.lucroUnitario),
          })),
          input.orderType
        );

        // Update order type and recalculated totals
        await updateOrder(input.orderId, {
          orderType: input.orderType,
          totalCliente: formatMoney(totals.totalCliente),
          totalMondial: formatMoney(totals.totalMondial),
          totalComissaoEvertonMondial: formatMoney(totals.totalComissaoEvertonMondial),
          totalLucro: formatMoney(totals.totalLucro),
          margemPedido: formatMargin(totals.margemPedido),
        });

        // Update order items with new type calculations
        await deleteOrderItems(input.orderId);
        await insertOrderItems(
          existing.items.map(item => ({
            orderId: input.orderId,
            productId: item.productId ?? null,
            sku: item.sku,
            titulo: item.titulo,
            quantidade: item.quantidade,
            tabelaNovaCk: item.tabelaNovaCk,
            imposto: item.imposto,
            comissao: item.comissao,
            valorProduto: item.valorProduto,
            precoDesejado: item.precoDesejado,
            precoFinal: item.precoFinal,
            margemFinal: item.margemFinal,
            lucroUnitario: input.orderType === "personal" ? "0.0000" : String(item.lucroUnitario),
            totalCliente: input.orderType === "personal" ? "0.0000" : formatMoney(toNumber(String(item.precoFinal || item.precoDesejado)) * toNumber(String(item.quantidade))),
            totalMondial: formatMoney(toNumber(String(item.valorProduto)) * toNumber(String(item.quantidade))),
            totalComissaoEvertonMondial: formatMoney(toNumber(String(item.comissao)) * toNumber(String(item.quantidade))),
            totalLucro: input.orderType === "personal" ? "0.0000" : formatMoney(toNumber(String(item.lucroUnitario)) * toNumber(String(item.quantidade))),
          }))
        );

        // Recalculate monthly snapshot
        const { periodYear, periodMonth } = existing.order;
        const monthly = await getMonthlySummary(periodYear, periodMonth);
        await upsertMonthlySnapshot({
          periodYear,
          periodMonth,
          totalPedidos: Number(monthly.totalPedidos ?? 0),
          totalPedidosCliente: Number(monthly.totalPedidosCliente ?? 0),
          totalPedidosPessoais: Number(monthly.totalPedidosPessoais ?? 0),
          totalCliente: String(monthly.totalCliente ?? "0.0000"),
          totalMondial: String(monthly.totalMondial ?? "0.0000"),
          totalComprasPessoais: String(monthly.totalComprasPessoais ?? "0.0000"),
          totalVendasClientes: String(monthly.totalVendasClientes ?? "0.0000"),
          totalComissaoEvertonMondial: String(monthly.totalComissaoEvertonMondial ?? "0.0000"),
          totalLucro: String(monthly.totalLucro ?? "0.0000"),
          margemMedia: String(monthly.margemMedia ?? "0.000000"),
          atualizadoEm: Date.now(),
        });

        return { success: true };
      }),
    changeCustomer: adminProcedure
      .input(z.object({
        orderId: z.number().int().positive(),
        orderType: z.enum(["customer", "personal"]),
        customerId: z.number().int().positive().nullish(),
        customerName: z.string().min(1),
        customerReference: z.string().nullish(),
        cnpjId: z.number().int().positive().nullish(),
      }))
      .mutation(async ({ input }) => {
        const existing = await getOrderWithItems(input.orderId);
        if (!existing.order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Pedido n\u00e3o encontrado." });
        }

        const orderType = input.orderType;
        const items = existing.items;
        const totals = computeOrderTotals(items.map(item => ({
          sku: item.sku,
          titulo: item.titulo,
          quantidade: Number(item.quantidade),
          tabelaNovaCk: String(item.tabelaNovaCk),
          imposto: String(item.imposto),
          comissao: String(item.comissao),
          valorProduto: String(item.valorProduto),
          precoDesejado: String(item.precoDesejado),
          precoFinal: String(item.precoFinal),
          margemFinal: String(item.margemFinal),
          lucroUnitario: String(item.lucroUnitario),
          productId: item.productId,
        })), orderType);

        await updateOrder(input.orderId, {
          orderType,
          customerId: orderType === "customer" ? (input.customerId ?? null) : null,
          customerName: input.customerName,
          customerReference: input.customerReference ?? null,
          cnpjId: orderType === "personal" ? (input.cnpjId ?? null) : null,
          totalCliente: formatMoney(totals.totalCliente),
          totalMondial: formatMoney(totals.totalMondial),
          totalComissaoEvertonMondial: formatMoney(totals.totalComissaoEvertonMondial),
          totalLucro: formatMoney(totals.totalLucro),
          margemPedido: formatMargin(totals.margemPedido),
          totalItens: totals.totalItens,
        });

        // Recalculate monthly snapshot
        const { periodYear, periodMonth } = existing.order;
        const monthly = await getMonthlySummary(periodYear, periodMonth);
        await upsertMonthlySnapshot({
          periodYear,
          periodMonth,
          totalPedidos: Number(monthly.totalPedidos ?? 0),
          totalPedidosCliente: Number(monthly.totalPedidosCliente ?? 0),
          totalPedidosPessoais: Number(monthly.totalPedidosPessoais ?? 0),
          totalCliente: String(monthly.totalCliente ?? "0.0000"),
          totalMondial: String(monthly.totalMondial ?? "0.0000"),
          totalComprasPessoais: String(monthly.totalComprasPessoais ?? "0.0000"),
          totalVendasClientes: String(monthly.totalVendasClientes ?? "0.0000"),
          totalComissaoEvertonMondial: String(monthly.totalComissaoEvertonMondial ?? "0.0000"),
          totalLucro: String(monthly.totalLucro ?? "0.0000"),
          margemMedia: String(monthly.margemMedia ?? "0.000000"),
          atualizadoEm: Date.now(),
        });

        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ orderId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const existing = await getOrderWithItems(input.orderId);
        if (!existing.order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Pedido n\u00e3o encontrado." });
        }

        const { periodYear, periodMonth } = existing.order;

        await deleteOrder(input.orderId);

        // Recalculate monthly snapshot after deletion
        const monthly = await getMonthlySummary(periodYear, periodMonth);
        await upsertMonthlySnapshot({
          periodYear,
          periodMonth,
          totalPedidos: Number(monthly.totalPedidos ?? 0),
          totalPedidosCliente: Number(monthly.totalPedidosCliente ?? 0),
          totalPedidosPessoais: Number(monthly.totalPedidosPessoais ?? 0),
          totalCliente: String(monthly.totalCliente ?? "0.0000"),
          totalMondial: String(monthly.totalMondial ?? "0.0000"),
          totalComprasPessoais: String(monthly.totalComprasPessoais ?? "0.0000"),
          totalVendasClientes: String(monthly.totalVendasClientes ?? "0.0000"),
          totalComissaoEvertonMondial: String(monthly.totalComissaoEvertonMondial ?? "0.0000"),
          totalLucro: String(monthly.totalLucro ?? "0.0000"),
          margemMedia: String(monthly.margemMedia ?? "0.000000"),
          atualizadoEm: Date.now(),
        });

        await notifyOwner({
          title: "Pedido exclu\u00eddo",
          content: `Pedido #${input.orderId} de ${existing.order.customerName} foi exclu\u00eddo.`,
        });

        return { success: true };
      }),
  }),
  dashboard: router({
    monthly: protectedProcedure
      .input(z.object({ periodYear: z.number().int().optional(), periodMonth: z.number().int().min(1).max(12).optional() }).optional())
      .query(async ({ input }) => {
        return getMonthlySummary(input?.periodYear, input?.periodMonth);
      }),
    yearlyEvolution: protectedProcedure.query(async () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const months: { year: number; month: number; label: string; vendas: string; lucro: string; compras: string }[] = [];
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      // Start from January of current year (2026) up to current month
      for (let m = 1; m <= currentMonth; m++) {
        const summary = await getMonthlySummary(currentYear, m);
        months.push({
          year: currentYear,
          month: m,
          label: `${monthNames[m - 1]}/${currentYear}`,
          vendas: String(summary.totalVendasClientes),
          lucro: String(summary.totalLucro),
          compras: String(summary.totalComprasPessoais),
        });
      }
      return months;
    }),
    revenueEvolution: protectedProcedure
      .input(z.object({ days: z.number().int().min(1).max(90).default(7) }).optional())
      .query(async ({ input }) => {
        const days = input?.days ?? 7;
        const result: Array<{ date: string; total: number; ml: number; shopee: number; amazon: number; distribuidora: number }> = [];

        // Buscar pedidos reais do banco por dia
        const db = await getDb();
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
          const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

          let mlVal = 0, shopeeVal = 0, amazonVal = 0, distVal = 0;

          if (db) {
            try {
              const dayOrders = await db.select().from(marketplaceOrders)
                .where(and(
                  gte(marketplaceOrders.platformCreatedAt, dayStart),
                  lte(marketplaceOrders.platformCreatedAt, dayEnd),
                ));
              for (const o of dayOrders) {
                const amount = Number(o.totalAmount || 0);
                if (o.platform === "ml") mlVal += amount;
                else if (o.platform === "shopee") shopeeVal += amount;
              }
            } catch (_) {}
          }

          result.push({
            date: dateStr,
            total: Math.round((mlVal + shopeeVal + amazonVal + distVal) * 100) / 100,
            ml: Math.round(mlVal * 100) / 100,
            shopee: Math.round(shopeeVal * 100) / 100,
            amazon: Math.round(amazonVal * 100) / 100,
            distribuidora: Math.round(distVal * 100) / 100,
          });
        }
        return result;
      }),
  }),
  marketing: marketingRouter,
  marketplaceOrders: router({
    recent: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }).optional())
      .query(async ({ input }) => {
        return getRecentOrders(input?.limit ?? 10);
      }),
    list: protectedProcedure
      .input(z.object({
        accounts: z.array(z.string()).optional(),
        status: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }).optional())
      .query(async ({ input }) => {
        return getFilteredOrders(input ?? {});
      }),
    accounts: protectedProcedure.query(async () => {
      return getAvailableAccounts();
    }),
  }),

  integrations: router({
    list: adminProcedure.query(async () => {
      return listIntegrations();
    }),
    upsert: adminProcedure
      .input(z.object({
        slug: z.string().min(1),
        name: z.string().optional(),
        accessToken: z.string().optional(),
        accountId: z.string().optional(),
        extraConfig: z.any().optional(),
        status: z.enum(["pending", "connected", "error"]).optional(),
      }))
      .mutation(async ({ input }) => {
        return upsertIntegration(input.slug, input);
      }),
    test: adminProcedure
      .input(z.object({ slug: z.string().min(1) }))
      .mutation(async ({ input }) => {
        return testIntegration(input.slug);
      }),
    delete: adminProcedure
      .input(z.object({ slug: z.string().min(1) }))
      .mutation(async ({ input }) => {
        await deleteIntegration(input.slug);
        return { success: true };
      }),
  }),

  myCnpjs: router({
    list: adminProcedure.query(async () => {
      return listMyCnpjs();
    }),
    getById: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getMyCnpjById(input.id);
      }),
    create: adminProcedure
      .input(z.object({
        razaoSocial: z.string().min(1),
        cnpj: z.string().min(1),
        nomeFantasia: z.string().optional().nullable(),
        inscricaoEstadual: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await createMyCnpj({
          razaoSocial: input.razaoSocial,
          cnpj: input.cnpj,
          nomeFantasia: input.nomeFantasia ?? null,
          inscricaoEstadual: input.inscricaoEstadual ?? null,
          notes: input.notes ?? null,
          createdByUserId: ctx.user.id,
        });
        return getMyCnpjById(id);
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        razaoSocial: z.string().min(1).optional(),
        cnpj: z.string().min(1).optional(),
        nomeFantasia: z.string().optional().nullable(),
        inscricaoEstadual: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateMyCnpj(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteMyCnpj(input.id);
        return { success: true };
      }),
    ranking: adminProcedure
      .input(z.object({
        periodYear: z.number().int().optional(),
        periodMonth: z.number().int().min(1).max(12).optional(),
      }).optional())
      .query(async ({ input }) => {
        const now = new Date();
        const year = input?.periodYear ?? now.getFullYear();
        const month = input?.periodMonth ?? (now.getMonth() + 1);
        return getCnpjRanking(year, month);
      }),
    evolution: adminProcedure
      .input(z.object({ periodYear: z.number().int().optional() }).optional())
      .query(async ({ input }) => {
        const year = input?.periodYear ?? new Date().getFullYear();
        return getCnpjEvolution(year);
      }),
  }),
  bankStatements: router({
    list: adminProcedure.query(async () => {
      return listBankStatements();
    }),
    get: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const statement = await getBankStatementById(input.id);
        if (!statement) throw new TRPCError({ code: "NOT_FOUND", message: "Extrato n\u00e3o encontrado." });
        const transactions = await listBankTransactions(input.id);
        return { statement, transactions };
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        bankName: z.string().optional(),
        periodMonth: z.number().int().min(1).max(12).optional(),
        periodYear: z.number().int().optional(),
        notes: z.string().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateBankStatement(id, data);
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteBankStatement(input.id);
        return { success: true };
      }),
    updateTransaction: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        statementId: z.number().int().positive(),
        category: z.string().optional().nullable(),
        userDescription: z.string().optional().nullable(),
        isIdentified: z.number().int().min(0).max(1).optional(),
        notes: z.string().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const { id, statementId, ...data } = input;
        await updateBankTransaction(id, data);
        await recalcStatementCounts(statementId);
        return { success: true };
      }),
    updateTransactionsBatch: adminProcedure
      .input(z.object({
        statementId: z.number().int().positive(),
        updates: z.array(z.object({
          id: z.number().int().positive(),
          category: z.string().optional().nullable(),
          userDescription: z.string().optional().nullable(),
          isIdentified: z.number().int().min(0).max(1).optional(),
          notes: z.string().optional().nullable(),
        })),
      }))
      .mutation(async ({ input }) => {
        await updateBankTransactionsBatch(input.updates);
        await recalcStatementCounts(input.statementId);
        return { success: true };
      }),
    exportExcel: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const statement = await getBankStatementById(input.id);
        if (!statement) throw new TRPCError({ code: "NOT_FOUND", message: "Extrato não encontrado." });
        const transactions = await listBankTransactions(input.id);

        // Build Excel workbook with columns matching bank PDF format
        const wb = XLSX.utils.book_new();

        // Main transactions sheet
        const rows = transactions.map(t => ({
          "Data Lançamento": t.transactionDate || "",
          "Data Contábil": t.accountingDate || t.transactionDate || "",
          "Tipo": t.bankType || (t.transactionType === "credit" ? "Entrada" : "Saída"),
          "Descrição": t.originalDescription || "",
          "Valor": t.transactionType === "debit" ? `-R$ ${parseFloat(String(t.amount)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${parseFloat(String(t.amount)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          "Categoria": t.category || "",
          "Identificação": t.userDescription || "",
          "Observações": t.notes || "",
          "Status": t.isIdentified ? "Identificado" : "Pendente",
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        // Set column widths
        ws["!cols"] = [
          { wch: 16 }, // Data Lançamento
          { wch: 16 }, // Data Contábil
          { wch: 18 }, // Tipo
          { wch: 50 }, // Descrição
          { wch: 18 }, // Valor
          { wch: 20 }, // Categoria
          { wch: 40 }, // Identificação
          { wch: 30 }, // Observações
          { wch: 14 }, // Status
        ];
        XLSX.utils.book_append_sheet(wb, ws, "Transações");

        // Summary sheet
        const totalEntradas = transactions.filter(t => t.transactionType === "credit").reduce((s, t) => s + parseFloat(String(t.amount)), 0);
        const totalSaidas = transactions.filter(t => t.transactionType === "debit").reduce((s, t) => s + parseFloat(String(t.amount)), 0);
        const identified = transactions.filter(t => t.isIdentified).length;

        const summaryRows = [
          { "Informação": "Banco", "Valor": statement.bankName },
          { "Informação": "Período", "Valor": `${String(statement.periodMonth).padStart(2, "0")}/${statement.periodYear}` },
          { "Informação": "Total de Transações", "Valor": String(transactions.length) },
          { "Informação": "Transações Identificadas", "Valor": `${identified} de ${transactions.length}` },
          { "Informação": "Total Entradas", "Valor": `R$ ${totalEntradas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { "Informação": "Total Saídas", "Valor": `R$ ${totalSaidas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { "Informação": "Saldo", "Valor": `R$ ${(totalEntradas - totalSaidas).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
        wsSummary["!cols"] = [{ wch: 30 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

        // Generate file and upload to S3
        const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        const suffix = crypto.randomBytes(4).toString("hex");
        const xlsxKey = `bank-statements/exports/${statement.periodYear}-${String(statement.periodMonth).padStart(2, "0")}/${statement.bankName.replace(/\s+/g, "_")}-${suffix}.xlsx`;
        const { url } = await storagePut(xlsxKey, xlsxBuffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        return { url, fileName: `Extrato_${statement.bankName}_${String(statement.periodMonth).padStart(2, "0")}_${statement.periodYear}.xlsx` };
      }),
  }),
  finance: router({
    fixedCosts: router({
      list: adminProcedure
        .input(z.object({ cnpjId: z.number().int().positive() }))
        .query(async ({ input }) => listFixedCosts(input.cnpjId)),
      create: adminProcedure
        .input(z.object({
          cnpjId: z.number().int().positive(),
          name: z.string().min(1),
          category: z.string().default("outros"),
          amount: z.string(),
          dueDay: z.number().int().min(1).max(31).default(1),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input, ctx }) => ({ id: await createFixedCost({ ...input, createdByUserId: ctx.user.id }) })),
      update: adminProcedure
        .input(z.object({
          id: z.number().int().positive(),
          name: z.string().min(1).optional(),
          category: z.string().optional(),
          amount: z.string().optional(),
          dueDay: z.number().int().min(1).max(31).optional(),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...data } = input;
          await updateFixedCost(id, data);
          return { success: true };
        }),
      delete: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteFixedCost(input.id);
          return { success: true };
        }),
      payments: adminProcedure
        .input(z.object({ year: z.number(), month: z.number(), cnpjId: z.number().int().positive() }))
        .query(async ({ input }) => listFixedCostPayments(input.year, input.month, input.cnpjId)),
      upsertPayment: adminProcedure
        .input(z.object({
          fixedCostId: z.number().int().positive(),
          periodYear: z.number(),
          periodMonth: z.number(),
          amountPaid: z.string(),
          status: z.enum(["paid", "pending", "overdue"]).default("pending"),
          paidAt: z.date().optional().nullable(),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input }) => ({ id: await upsertFixedCostPayment(input) })),
    }),
    creditCards: router({
      list: adminProcedure
        .input(z.object({ cnpjId: z.number().int().positive() }))
        .query(async ({ input }) => listCreditCards(input.cnpjId)),
      create: adminProcedure
        .input(z.object({
          cnpjId: z.number().int().positive(),
          name: z.string().min(1),
          brand: z.string().default("outros"),
          lastFourDigits: z.string().max(4).optional().nullable(),
          closingDay: z.number().int().min(1).max(31).default(1),
          dueDay: z.number().int().min(1).max(31).default(10),
          creditLimit: z.string().optional().nullable(),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input, ctx }) => ({ id: await createCreditCard({ ...input, createdByUserId: ctx.user.id }) })),
      update: adminProcedure
        .input(z.object({
          id: z.number().int().positive(),
          name: z.string().min(1).optional(),
          brand: z.string().optional(),
          lastFourDigits: z.string().max(4).optional().nullable(),
          closingDay: z.number().int().min(1).max(31).optional(),
          dueDay: z.number().int().min(1).max(31).optional(),
          creditLimit: z.string().optional().nullable(),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...data } = input;
          await updateCreditCard(id, data);
          return { success: true };
        }),
      delete: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteCreditCard(input.id);
          return { success: true };
        }),
      invoices: adminProcedure
        .input(z.object({ cardId: z.number().optional(), year: z.number().optional(), month: z.number().optional(), cnpjId: z.number().int().positive().optional() }))
        .query(async ({ input }) => listCreditCardInvoices(input.cardId, input.year, input.month, input.cnpjId)),
      upsertInvoice: adminProcedure
        .input(z.object({
          cardId: z.number().int().positive(),
          periodYear: z.number(),
          periodMonth: z.number(),
          totalAmount: z.string(),
          minimumAmount: z.string().optional().nullable(),
          amountPaid: z.string().optional().nullable(),
          status: z.enum(["paid", "pending", "partial"]).default("pending"),
          paidAt: z.date().optional().nullable(),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input }) => ({ id: await upsertCreditCardInvoice(input) })),
    }),
    loans: router({
      list: adminProcedure
        .input(z.object({ cnpjId: z.number().int().positive() }))
        .query(async ({ input }) => listLoans(input.cnpjId)),
      create: adminProcedure
        .input(z.object({
          cnpjId: z.number().int().positive(),
          name: z.string().min(1),
          institution: z.string().min(1),
          loanType: z.enum(["installment", "sales_retention"]).default("installment"),
          totalAmount: z.string(),
          totalInstallments: z.number().int().positive().optional().nullable(),
          installmentAmount: z.string().optional().nullable(),
          interestRate: z.string().optional().nullable(),
          startDate: z.string(),
          dueDay: z.number().int().min(1).max(31).optional().nullable(),
          retentionPercent: z.string().optional().nullable(),
          retentionSource: z.string().optional().nullable(),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input, ctx }) => ({
          id: await createLoan({
            ...input,
            totalInstallments: input.loanType === "installment" ? input.totalInstallments ?? 1 : null,
            installmentAmount: input.loanType === "installment" ? input.installmentAmount ?? "0" : null,
            dueDay: input.loanType === "installment" ? input.dueDay ?? 1 : null,
            retentionPercent: input.loanType === "sales_retention" ? input.retentionPercent ?? "20" : null,
            retentionSource: input.loanType === "sales_retention" ? input.retentionSource ?? "mercado_livre" : null,
            createdByUserId: ctx.user.id,
          })
        })),
      update: adminProcedure
        .input(z.object({
          id: z.number().int().positive(),
          name: z.string().min(1).optional(),
          institution: z.string().min(1).optional(),
          loanType: z.enum(["installment", "sales_retention"]).optional(),
          totalAmount: z.string().optional(),
          totalInstallments: z.number().int().positive().optional().nullable(),
          installmentAmount: z.string().optional().nullable(),
          interestRate: z.string().optional().nullable(),
          startDate: z.string().optional(),
          dueDay: z.number().int().min(1).max(31).optional().nullable(),
          retentionPercent: z.string().optional().nullable(),
          retentionSource: z.string().optional().nullable(),
          totalPaid: z.string().optional(),
          status: z.enum(["active", "paid_off"]).optional(),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...data } = input;
          await updateLoan(id, data);
          return { success: true };
        }),
      delete: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteLoan(input.id);
          return { success: true };
        }),
      installments: adminProcedure
        .input(z.object({ loanId: z.number().optional(), year: z.number().optional(), month: z.number().optional(), cnpjId: z.number().int().positive().optional() }))
        .query(async ({ input }) => listLoanInstallments(input.loanId, input.year, input.month, input.cnpjId)),
      upsertInstallment: adminProcedure
        .input(z.object({
          loanId: z.number().int().positive(),
          installmentNumber: z.number().int().positive(),
          periodYear: z.number(),
          periodMonth: z.number(),
          amount: z.string(),
          status: z.enum(["paid", "pending", "overdue"]).default("pending"),
          paidAt: z.date().optional().nullable(),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input }) => ({ id: await upsertLoanInstallment(input) })),
      retentionEntries: adminProcedure
        .input(z.object({ loanId: z.number().optional(), year: z.number().optional(), month: z.number().optional(), cnpjId: z.number().int().positive().optional() }))
        .query(async ({ input }) => listLoanRetentionEntries(input.loanId, input.year, input.month, input.cnpjId)),
      createRetentionEntry: adminProcedure
        .input(z.object({
          loanId: z.number().int().positive(),
          entryDate: z.string(),
          periodYear: z.number(),
          periodMonth: z.number(),
          entryType: z.enum(["daily", "monthly", "manual"]).default("daily"),
          eventCategory: z.enum(["venda", "taxa", "antecipacao", "devolucao", "abatimento_emprestimo", "ajuste"]).default("abatimento_emprestimo"),
          grossAmount: z.string().optional().nullable(),
          netAmount: z.string().optional().nullable(),
          retentionPercentApplied: z.string().optional().nullable(),
          retainedAmount: z.string(),
          sourceReference: z.string().optional().nullable(),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input, ctx }) => ({ id: await createLoanRetentionEntry({ ...input, createdByUserId: ctx.user.id }) })),
      updateRetentionEntry: adminProcedure
        .input(z.object({
          id: z.number().int().positive(),
          entryDate: z.string().optional(),
          periodYear: z.number().optional(),
          periodMonth: z.number().optional(),
          entryType: z.enum(["daily", "monthly", "manual"]).optional(),
          eventCategory: z.enum(["venda", "taxa", "antecipacao", "devolucao", "abatimento_emprestimo", "ajuste"]).optional(),
          grossAmount: z.string().optional().nullable(),
          netAmount: z.string().optional().nullable(),
          retentionPercentApplied: z.string().optional().nullable(),
          retainedAmount: z.string().optional(),
          sourceReference: z.string().optional().nullable(),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...data } = input;
          await updateLoanRetentionEntry(id, data);
          return { success: true };
        }),
      deleteRetentionEntry: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteLoanRetentionEntry(input.id);
          return { success: true };
        }),
    }),
    payables: router({
      list: adminProcedure
        .input(z.object({ year: z.number().optional(), month: z.number().optional(), status: z.string().optional(), cnpjId: z.number().int().positive().optional().nullable() }).optional())
        .query(async ({ input }) => listPayableAccounts(input?.year, input?.month, input?.status, input?.cnpjId ?? undefined)),
      dashboard: adminProcedure
        .input(z.object({ referenceDate: z.string(), year: z.number().optional(), month: z.number().optional(), cnpjId: z.number().int().positive().optional().nullable() }))
        .query(async ({ input }) => getPayablesDashboard(input.referenceDate, input.year, input.month, input.cnpjId ?? undefined)),
      create: adminProcedure
        .input(z.object({
          title: z.string().min(1),
          cnpjId: z.number().int().positive().optional().nullable(),
          supplier: z.string().optional().nullable(),
          category: z.string().default("outros"),
          accountType: z.enum(["boleto", "fornecedor", "cartao", "emprestimo", "imposto", "investimento", "outros"]).default("boleto"),
          amount: z.string(),
          dueDate: z.string(),
          status: z.enum(["pending", "paid", "overdue", "partial"]).default("pending"),
          paidAmount: z.string().optional().nullable(),
          paidAt: z.date().optional().nullable(),
          installmentLabel: z.string().optional().nullable(),
          reminderDaysBefore: z.number().int().min(0).max(30).default(1),
          description: z.string().optional().nullable(),
          notes: z.string().optional().nullable(),
          receiptUrl: z.string().optional().nullable(),
          receiptFileKey: z.string().optional().nullable(),
          paymentMethod: z.string().optional().nullable(),
          isInvestment: z.number().int().min(0).max(1).default(0),
        }))
        .mutation(async ({ input, ctx }) => ({ id: await createPayableAccount({ ...input, createdByUserId: ctx.user.id }) })),
      update: adminProcedure
        .input(z.object({
          id: z.number().int().positive(),
          title: z.string().min(1).optional(),
          supplier: z.string().optional().nullable(),
          category: z.string().optional(),
          accountType: z.enum(["boleto", "fornecedor", "cartao", "emprestimo", "imposto", "investimento", "outros"]).optional(),
          amount: z.string().optional(),
          dueDate: z.string().optional(),
          status: z.enum(["pending", "paid", "overdue", "partial"]).optional(),
          paidAmount: z.string().optional().nullable(),
          paidAt: z.date().optional().nullable(),
          installmentLabel: z.string().optional().nullable(),
          reminderDaysBefore: z.number().int().min(0).max(30).optional(),
          description: z.string().optional().nullable(),
          notes: z.string().optional().nullable(),
          receiptUrl: z.string().optional().nullable(),
          receiptFileKey: z.string().optional().nullable(),
          paymentMethod: z.string().optional().nullable(),
          isInvestment: z.number().int().min(0).max(1).optional(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...data } = input;
          await updatePayableAccount(id, data);
          return { success: true };
        }),
      delete: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deletePayableAccount(input.id);
          return { success: true };
        }),
      registerPayment: adminProcedure
        .input(z.object({
          id: z.number().int().positive(),
          paidAmount: z.string(),
          paidAt: z.date(),
          receiptUrl: z.string().optional().nullable(),
          receiptFileKey: z.string().optional().nullable(),
          paymentMethod: z.string().optional().nullable(),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input }) => {
          await updatePayableAccount(input.id, {
            status: "paid",
            paidAmount: input.paidAmount,
            paidAt: input.paidAt,
            receiptUrl: input.receiptUrl ?? null,
            receiptFileKey: input.receiptFileKey ?? null,
            paymentMethod: input.paymentMethod ?? null,
            notes: input.notes ?? null,
          });
          return { success: true };
        }),
    }),
    dre: adminProcedure
      .input(z.object({ year: z.number(), month: z.number(), cnpjId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const data = await getDREData(input.year, input.month, input.cnpjId);

        const totalCustosFixos = data.fixedCostPayments.reduce((sum, p) => sum + parseFloat(String(p.payment.amountPaid || "0")), 0);
        const totalCartoes = data.cardInvoices.reduce((sum, i) => sum + parseFloat(String(i.invoice.totalAmount || "0")), 0);
        const totalEmprestimosMensais = data.loanInstallments.reduce((sum, i) => sum + parseFloat(String(i.installment.amount || "0")), 0);
        const totalRetencaoEmprestimos = data.loanRetentionEntries.reduce((sum, i) => sum + parseFloat(String(i.entry.retainedAmount || "0")), 0);
        const totalContasPagas = data.payableAccounts.filter((a: any) => a.status === "paid" || a.status === "partial").reduce((sum: number, a: any) => sum + parseFloat(String(a.paidAmount || a.amount || "0")), 0);
        const totalInvestimentos = data.payableAccounts.filter((a: any) => a.isInvestment === 1 || a.accountType === "investimento").reduce((sum: number, a: any) => sum + parseFloat(String(a.amount || "0")), 0);

        const lisTransactions = data.bankTransactions.filter((t: any) => {
          const desc = (t.originalDescription || "").toLowerCase();
          const cat = (t.category || "").toLowerCase();
          return cat.includes("lis") || cat.includes("cheque especial") || desc.includes("juros cheque") || desc.includes("iof cheque") || desc.includes("juros lis") || desc.includes("iof lis");
        });
        const totalLIS = lisTransactions.reduce((sum: number, t: any) => sum + Math.abs(parseFloat(String(t.amount || "0"))), 0);

        const creditTransactions = data.bankTransactions.filter((t: any) => t.transactionType === "credit");
        const debitTransactions = data.bankTransactions.filter((t: any) => t.transactionType === "debit");
        const entradasTotais = creditTransactions.reduce((sum: number, t: any) => sum + Math.abs(parseFloat(String(t.amount || "0"))), 0);
        const saidasTotais = debitTransactions.reduce((sum: number, t: any) => sum + Math.abs(parseFloat(String(t.amount || "0"))), 0);
        const saldoOperacional = entradasTotais - saidasTotais;
        const dinheiroParado = data.healthBase.investedCapital;

        const categoryMap = new Map<string, number>();
        for (const txn of debitTransactions) {
          const key = String(txn.category || txn.userDescription || "Sem categoria").trim() || "Sem categoria";
          const amount = Math.abs(parseFloat(String(txn.amount || "0")));
          categoryMap.set(key, (categoryMap.get(key) || 0) + amount);
        }

        const topExpenseCategories = Array.from(categoryMap.entries())
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 8);

        const totalSaidasClassificadas = debitTransactions
          .filter((t: any) => (String(t.category || "").trim().length > 0) || t.isIdentified === 1)
          .reduce((sum: number, t: any) => sum + Math.abs(parseFloat(String(t.amount || "0"))), 0);
        const totalSaidasNaoClassificadas = Math.max(saidasTotais - totalSaidasClassificadas, 0);
        const percentualSaidasClassificadas = saidasTotais > 0 ? (totalSaidasClassificadas / saidasTotais) * 100 : 0;

        const totalTaxasMarketplace = data.marketplaceSummary.totalTaxas + data.marketplaceSummary.totalAntecipacoes + data.marketplaceSummary.totalDevolucoes;
        const totalEmprestimos = totalEmprestimosMensais + totalRetencaoEmprestimos;
        const obrigacoesGerenciais = totalCustosFixos + totalCartoes + totalEmprestimos + totalContasPagas + totalLIS;
        const resultadoLiquido = saldoOperacional;
        const resultadoOperacional = saldoOperacional;
        const receitaBruta = entradasTotais;
        const custoMercadoriaVendida = 0;
        const lucroBruto = entradasTotais;
        const margemLiquida = entradasTotais > 0 ? (resultadoLiquido / entradasTotais) * 100 : 0;

        const alerts: { type: "danger" | "warning" | "info"; message: string }[] = [];
        if (saldoOperacional < 0) alerts.push({ type: "danger", message: `No caixa realizado, as saídas superaram as entradas em R$ ${Math.abs(saldoOperacional).toFixed(2)}.` });
        if (data.healthBase.overduePayables > 0) alerts.push({ type: "warning", message: `Há R$ ${data.healthBase.overduePayables.toFixed(2)} em contas atrasadas no controle gerencial.` });
        if (totalLIS > 0) alerts.push({ type: "warning", message: `Foram identificados R$ ${totalLIS.toFixed(2)} em custos de LIS/Cheque Especial.` });
        if (totalRetencaoEmprestimos > 0) alerts.push({ type: "info", message: `O Mercado Pago/Mercado Livre reteve R$ ${totalRetencaoEmprestimos.toFixed(2)} para abatimento de empréstimos no período.` });
        if (totalSaidasNaoClassificadas > 0) alerts.push({ type: "warning", message: `Ainda existem R$ ${totalSaidasNaoClassificadas.toFixed(2)} em saídas sem classificação financeira concluída.` });
        if (topExpenseCategories.length > 0) alerts.push({ type: "info", message: `A maior categoria de saída do período foi ${topExpenseCategories[0].category}, com R$ ${topExpenseCategories[0].amount.toFixed(2)}.` });

        const dailyAverageRevenue = entradasTotais / 30;
        const dailyAverageExpenses = saidasTotais / 30;

        return {
          receitaBruta,
          custoMercadoriaVendida,
          lucroBruto,
          impostoVendas: 0,
          totalVendasClientes: 0,
          totalCustoMondialVendas: 0,
          totalComissaoEverton: 0,
          totalLucroVendas: 0,
          qtdPedidosClientes: 0,
          totalComprasPessoais: 0,
          qtdPedidosPessoais: 0,
          totalCustosFixos,
          totalCartoes,
          totalEmprestimos,
          totalEmprestimosMensais,
          totalRetencaoEmprestimos,
          totalContasPagas,
          totalLIS,
          totalTaxasMarketplace,
          despesasOperacionais: saidasTotais,
          resultadoOperacional,
          resultadoLiquido,
          margemLiquida,
          entradasTotais,
          saidasTotais,
          saldoOperacional,
          dinheiroParado,
          totalSaidasClassificadas,
          totalSaidasNaoClassificadas,
          percentualSaidasClassificadas,
          topExpenseCategories,
          obrigacoesGerenciais,
          dailyDre: {
            entradas: dailyAverageRevenue,
            saidas: dailyAverageExpenses,
            resultado: dailyAverageRevenue - dailyAverageExpenses,
          },
          monthlyDre: {
            entradas: entradasTotais,
            saidas: saidasTotais,
            resultado: saldoOperacional,
          },
          fixedCostPayments: data.fixedCostPayments,
          cardInvoices: data.cardInvoices,
          loanInstallments: data.loanInstallments,
          loanRetentionEntries: data.loanRetentionEntries,
          payableAccounts: data.payableAccounts,
          bankStatements: data.bankStatements,
          bankTransactions: data.bankTransactions,
          marketplaceBreakdown: data.marketplaceBreakdown,
          marketplaceSummary: data.marketplaceSummary,
          lisTransactions,
          health: {
            entradas: entradasTotais,
            saidas: saidasTotais,
            retidoMercadoLivre: totalRetencaoEmprestimos,
            capitalParado: dinheiroParado,
            pendencias: data.healthBase.pendingPayables,
            atrasados: data.healthBase.overduePayables,
            saidasClassificadas: totalSaidasClassificadas,
            saidasNaoClassificadas: totalSaidasNaoClassificadas,
            percentualSaidasClassificadas,
            status: saldoOperacional >= 0 ? "saudavel" : percentualSaidasClassificadas >= 70 ? "atencao" : "critico",
          },
          alerts,
          snapshot: data.snapshot,
        };
      }),
  }),

  // ===== CUSTOS FIXOS =====
  listCustosFixos: adminProcedure.query(async () => {
    return rawQuery(`SELECT * FROM custos_fixos ORDER BY ativo DESC, nome ASC`);
  }),
  createCustoFixo: adminProcedure
    .input(z.object({ nome: z.string(), valor: z.number(), frequencia: z.string().default("mensal"), categoria: z.string().nullable().default(null), observacao: z.string().nullable().default(null) }))
    .mutation(async ({ input }) => {
      await rawQuery(`INSERT INTO custos_fixos (nome, valor, frequencia, categoria, observacao) VALUES (?, ?, ?, ?, ?)`, [input.nome, input.valor, input.frequencia, input.categoria, input.observacao]);
      return { ok: true };
    }),
  updateCustoFixo: adminProcedure
    .input(z.object({ id: z.number(), nome: z.string(), valor: z.number(), frequencia: z.string(), categoria: z.string().nullable(), observacao: z.string().nullable() }))
    .mutation(async ({ input }) => {
      await rawQuery(`UPDATE custos_fixos SET nome=?, valor=?, frequencia=?, categoria=?, observacao=? WHERE id=?`, [input.nome, input.valor, input.frequencia, input.categoria, input.observacao, input.id]);
      return { ok: true };
    }),
  deleteCustoFixo: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await rawQuery(`DELETE FROM custos_fixos WHERE id=?`, [input.id]);
      return { ok: true };
    }),
  toggleCustoFixo: adminProcedure
    .input(z.object({ id: z.number(), ativo: z.boolean() }))
    .mutation(async ({ input }) => {
      await rawQuery(`UPDATE custos_fixos SET ativo=? WHERE id=?`, [input.ativo ? 1 : 0, input.id]);
      return { ok: true };
    }),

  // ===== CATÁLOGO ML =====
  listMLCatalog: adminProcedure
    .input(z.object({ accountName: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return listMLCatalogProducts(input?.accountName);
    }),

  syncMLCatalog: adminProcedure
    .input(z.object({ accountName: z.string().optional() }).optional())
    .mutation(async ({ input }) => {
      const { getMLAccountItems } = await import("./mercadolivre");
      const results = await getMLAccountItems(input?.accountName);
      return results;
    }),

  updateMLProductCosts: adminProcedure
    .input(z.object({ id: z.number(), costPrice: z.string(), packagingCost: z.string(), platformFeePercent: z.string().optional(), taxPercent: z.string().optional() }))
    .mutation(async ({ input }) => {
      await updateMLCatalogProductCosts(input.id, input.costPrice, input.packagingCost, input.platformFeePercent ?? "0", input.taxPercent ?? "0");
      return { ok: true };
    }),

  deleteMLCatalogProduct: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteMLCatalogProduct(input.id);
      return { ok: true };
    }),

  // ═══════════════ SHOPEE ADS ═══════════════
  shopeeAds: router({
    dashboard: protectedProcedure.query(async () => {
      return getShopeeAdsDashboard();
    }),
    analyze: adminProcedure.mutation(async () => {
      const dash = await getShopeeAdsDashboard();
      if (!dash) return { analysis: "Nenhuma loja Shopee conectada.", dashboard: null };
      const analysis = await generateAdsAnalysis(dash);
      return { analysis, dashboard: dash };
    }),
    // Rotina diaria automatica — Sam analisa e gera plano de acao
    dailyRoutine: adminProcedure.mutation(async () => {
      const dash = await getShopeeAdsDashboard();
      if (!dash) return { report: "Nenhuma loja Shopee conectada." };
      const analysis = await generateAdsAnalysis(dash);
      return { report: analysis, dashboard: dash, generatedAt: new Date().toISOString() };
    }),
    campaignPerformance: adminProcedure
      .input(z.object({ campaignIds: z.string(), days: z.number().optional() }))
      .query(async ({ input }) => {
        return getCampaignDailyPerformance(input.campaignIds, input.days || 14);
      }),
    recommendedItems: adminProcedure.query(async () => {
      return getRecommendedItems();
    }),
    recommendedKeywords: adminProcedure
      .input(z.object({ itemId: z.number() }))
      .query(async ({ input }) => {
        return getRecommendedKeywords(input.itemId);
      }),
    askAi: adminProcedure
      .input(z.object({ question: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const dash = await getShopeeAdsDashboard();
        if (!dash) return { answer: "Nenhuma loja Shopee conectada." };
        const answer = await askSamAds(input.question, dash);
        return { answer };
      }),
    // Pesquisa semanal manual
    runResearch: adminProcedure.mutation(async () => {
      const result = await runShopeeResearch();
      return { research: result };
    }),
    // Gerar estrategia com analise de brechas e oportunidades
    generateStrategy: adminProcedure.mutation(async () => {
      const dash = await getShopeeAdsDashboard();
      if (!dash) return { strategy: "Nenhuma loja Shopee conectada." };
      const { invokeLLM } = await import("./_core/llm");
      const fs = await import("fs");
      const path = await import("path");

      // Carregar knowledge
      let knowledge = "";
      try {
        const kPath = path.join(process.cwd(), "server", "data", "shopee-knowledge.json");
        if (fs.existsSync(kPath)) {
          const raw = JSON.parse(fs.readFileSync(kPath, "utf-8"));
          knowledge = raw.lastResearch || "";
        }
      } catch {}

      const prompt = `Você é Sam 🛒, Diretor de Performance de Ads da Kaibren. Faça uma análise ESTRATÉGICA COMPLETA com foco em encontrar BRECHAS e OPORTUNIDADES que ninguém está vendo.

DADOS ATUAIS:
Saldo: R$${dash.balance ?? 'N/A'}
Gasto 7d: R$${dash.kpis.expense7d} | Vendas 7d: R$${dash.kpis.directGmv7d}
ROAS: ${dash.kpis.roas7d}x | CTR: ${dash.kpis.ctr7d}% | CPC: R$${dash.kpis.cpc7d}
Campanhas: ${dash.totalCampaigns} total (${dash.activeCampaigns} ativas)

${dash.campaigns.map((c: any) => `- "${c.name}" [${c.status}] budget=R$${c.budget} ROAS=${c.roasTarget ?? 'auto'}`).join('\n')}

TENDÊNCIA 14d:
${dash.dailyPerformance.map((d: any) => `${d.date}: gasto=R$${d.expense} vendas=R$${d.directGmv} ROAS=${d.directRoas}x cliques=${d.clicks} CTR=${d.ctr}%`).join('\n')}

${knowledge ? `\nCONHECIMENTO ATUALIZADO DA PLATAFORMA:\n${knowledge.substring(0, 2000)}` : ''}

Analise e responda:

## 1. BRECHAS ESTRATÉGICAS
Identifique gaps e oportunidades que a Kaibren está perdendo. Ex: horários de pico não explorados, keywords sem concorrência, produtos com alta margem sem ads, etc.

## 2. MELHORES HORÁRIOS
Com base nos dados de performance por hora/dia, identifique os melhores momentos para investir mais em ads e os piores para reduzir.

## 3. ESTRATÉGIA ATUAL — AVALIAÇÃO
Dê uma nota de 1 a 10 para a estratégia atual e explique o porquê. O que funciona e o que não funciona.

## 4. NOVA ESTRATÉGIA PROPOSTA
Crie um plano completo com:
- Ações diárias automáticas (o que monitorar todo dia)
- Ações semanais (ajustes de budget, ROAS, keywords)
- Regras de decisão (se ROAS < X, fazer Y; se CTR < Z, fazer W)
- Produtos foco vs produtos para pausar
- Budget ideal por período

## 5. AUTOMAÇÕES SUGERIDAS
Quais processos podem ser automatizados para que o Sam (IA) execute sem intervenção humana.

Seja ESPECÍFICO com números. Nada genérico.`;

      const result = await invokeLLM({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Você é Sam 🛒, o melhor analista de Ads de marketplace do Brasil. Pense como um growth hacker que encontra brechas que ninguém vê. Use dados, não achismo. Responda em português brasileiro com markdown." },
          { role: "user", content: prompt },
        ],
        maxTokens: 4096,
      });

      const content = result.choices?.[0]?.message?.content;
      const strategy = typeof content === "string" ? content : Array.isArray(content)
        ? content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n")
        : "Erro ao gerar estratégia.";

      return { strategy, generatedAt: new Date().toISOString() };
    }),

    // ═══════ ESTRATÉGIAS ═══════
    listStrategies: protectedProcedure.query(async () => {
      return getStrategies();
    }),
    saveStrategy: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        status: z.enum(["testing", "active", "paused", "rejected"]),
        samVerdict: z.string(),
        successRate: z.number().min(0).max(100),
        testsRun: z.number().optional(),
        testsWon: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return saveStrategy({
          name: input.name,
          description: input.description,
          status: input.status,
          samVerdict: input.samVerdict,
          successRate: input.successRate,
          testsRun: input.testsRun || 0,
          testsWon: input.testsWon || 0,
        });
      }),
    updateStrategy: adminProcedure
      .input(z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["testing", "active", "paused", "rejected"]).optional(),
        samVerdict: z.string().optional(),
        successRate: z.number().min(0).max(100).optional(),
        testsRun: z.number().optional(),
        testsWon: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        return updateStrategy(id, updates);
      }),
    deleteStrategy: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        return deleteStrategy(input.id);
      }),
    // Sam avalia nova estrategia proposta pelo usuario
    evaluateStrategy: adminProcedure
      .input(z.object({ question: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const dash = await getShopeeAdsDashboard();
        if (!dash) return { answer: "Nenhuma loja Shopee conectada.", strategy: null };
        return evaluateStrategy(input.question, dash);
      }),
  }),
});

export type AppRouter = typeof appRouter;

