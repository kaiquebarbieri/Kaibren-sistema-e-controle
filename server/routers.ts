import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { notifyOwner } from "./_core/notification";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
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
} from "./db";
import { storageGet, storagePut } from "./storage";
import * as XLSX from "xlsx";
import { invokeLLM } from "./_core/llm";
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
    create: protectedProcedure
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
    update: protectedProcedure
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
    uploadBanner: protectedProcedure
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
    generateMessage: protectedProcedure
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
    sendToCustomers: protectedProcedure
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
    markConversion: protectedProcedure
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
});

export const appRouter = router({
  system: systemRouter,
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
    updatePricing: protectedProcedure
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
    restoreLatestUpload: protectedProcedure.mutation(async () => {
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
    importSpreadsheet: protectedProcedure
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
    create: protectedProcedure
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
    update: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }).merge(customerInputSchema.partial()))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const existing = await getCustomerById(id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
        return updateCustomer(id, data as any);
      }),
    delete: protectedProcedure
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
    create: protectedProcedure
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
    finalize: protectedProcedure
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
    update: protectedProcedure
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
    changeType: protectedProcedure
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
    changeCustomer: protectedProcedure
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
    delete: protectedProcedure
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
  }),
  marketing: marketingRouter,

  myCnpjs: router({
    list: protectedProcedure.query(async () => {
      return listMyCnpjs();
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getMyCnpjById(input.id);
      }),
    create: protectedProcedure
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
    update: protectedProcedure
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
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteMyCnpj(input.id);
        return { success: true };
      }),
    ranking: protectedProcedure
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
    evolution: protectedProcedure
      .input(z.object({ periodYear: z.number().int().optional() }).optional())
      .query(async ({ input }) => {
        const year = input?.periodYear ?? new Date().getFullYear();
        return getCnpjEvolution(year);
      }),
  }),
  bankStatements: router({
    list: protectedProcedure.query(async () => {
      return listBankStatements();
    }),
    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const statement = await getBankStatementById(input.id);
        if (!statement) throw new TRPCError({ code: "NOT_FOUND", message: "Extrato n\u00e3o encontrado." });
        const transactions = await listBankTransactions(input.id);
        return { statement, transactions };
      }),
    update: protectedProcedure
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
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteBankStatement(input.id);
        return { success: true };
      }),
    updateTransaction: protectedProcedure
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
    updateTransactionsBatch: protectedProcedure
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
    exportExcel: protectedProcedure
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
      list: protectedProcedure.query(async () => listFixedCosts()),
      create: protectedProcedure
        .input(z.object({
          name: z.string().min(1),
          category: z.string().default("outros"),
          amount: z.string(),
          dueDay: z.number().int().min(1).max(31).default(1),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input, ctx }) => ({ id: await createFixedCost({ ...input, createdByUserId: ctx.user.id }) })),
      update: protectedProcedure
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
      delete: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteFixedCost(input.id);
          return { success: true };
        }),
      payments: protectedProcedure
        .input(z.object({ year: z.number(), month: z.number() }))
        .query(async ({ input }) => listFixedCostPayments(input.year, input.month)),
      upsertPayment: protectedProcedure
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
      list: protectedProcedure.query(async () => listCreditCards()),
      create: protectedProcedure
        .input(z.object({
          name: z.string().min(1),
          brand: z.string().default("outros"),
          lastFourDigits: z.string().max(4).optional().nullable(),
          closingDay: z.number().int().min(1).max(31).default(1),
          dueDay: z.number().int().min(1).max(31).default(10),
          creditLimit: z.string().optional().nullable(),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input, ctx }) => ({ id: await createCreditCard({ ...input, createdByUserId: ctx.user.id }) })),
      update: protectedProcedure
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
      delete: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteCreditCard(input.id);
          return { success: true };
        }),
      invoices: protectedProcedure
        .input(z.object({ cardId: z.number().optional(), year: z.number().optional(), month: z.number().optional() }))
        .query(async ({ input }) => listCreditCardInvoices(input.cardId, input.year, input.month)),
      upsertInvoice: protectedProcedure
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
      list: protectedProcedure.query(async () => listLoans()),
      create: protectedProcedure
        .input(z.object({
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
      update: protectedProcedure
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
      delete: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteLoan(input.id);
          return { success: true };
        }),
      installments: protectedProcedure
        .input(z.object({ loanId: z.number().optional(), year: z.number().optional(), month: z.number().optional() }))
        .query(async ({ input }) => listLoanInstallments(input.loanId, input.year, input.month)),
      upsertInstallment: protectedProcedure
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
      retentionEntries: protectedProcedure
        .input(z.object({ loanId: z.number().optional(), year: z.number().optional(), month: z.number().optional() }))
        .query(async ({ input }) => listLoanRetentionEntries(input.loanId, input.year, input.month)),
      createRetentionEntry: protectedProcedure
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
      updateRetentionEntry: protectedProcedure
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
      deleteRetentionEntry: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteLoanRetentionEntry(input.id);
          return { success: true };
        }),
    }),
    payables: router({
      list: protectedProcedure
        .input(z.object({ year: z.number().optional(), month: z.number().optional(), status: z.string().optional() }).optional())
        .query(async ({ input }) => listPayableAccounts(input?.year, input?.month, input?.status)),
      dashboard: protectedProcedure
        .input(z.object({ referenceDate: z.string(), year: z.number().optional(), month: z.number().optional() }))
        .query(async ({ input }) => getPayablesDashboard(input.referenceDate, input.year, input.month)),
      create: protectedProcedure
        .input(z.object({
          title: z.string().min(1),
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
      update: protectedProcedure
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
      delete: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deletePayableAccount(input.id);
          return { success: true };
        }),
      registerPayment: protectedProcedure
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
    dre: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number() }))
      .query(async ({ input }) => {
        const data = await getDREData(input.year, input.month);

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
});

export type AppRouter = typeof appRouter;
