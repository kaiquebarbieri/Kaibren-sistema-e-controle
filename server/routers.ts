import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { notifyOwner } from "./_core/notification";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import {
  createOrder,
  createProductUpload,
  getLatestProductUpload,
  getMonthlySummary,
  getOrderWithItems,
  insertOrderItems,
  listOrders,
  listProducts,
  replaceProducts,
  searchProducts,
  updateOrderStatus,
  upsertMonthlySnapshot,
} from "./db";
import { storagePut } from "./storage";

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
  customerName: z.string().min(1),
  customerReference: z.string().optional().nullable(),
  periodYear: z.number().int(),
  periodMonth: z.number().int().min(1).max(12),
  notes: z.string().optional().nullable(),
  status: z.enum(["draft", "created", "finalized"]).default("created"),
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

function computeOrderTotals(items: z.infer<typeof orderItemInputSchema>[]) {
  const totals = items.reduce(
    (acc, item) => {
      const quantidade = toNumber(item.quantidade);
      const totalCliente = toNumber(item.precoFinal || item.precoDesejado) * quantidade;
      const totalMondial = toNumber(item.valorProduto) * quantidade;
      const totalComissaoEvertonMondial = toNumber(item.comissao) * quantidade;
      const totalLucro = toNumber(item.lucroUnitario) * quantidade;

      acc.totalCliente += totalCliente;
      acc.totalMondial += totalMondial;
      acc.totalComissaoEvertonMondial += totalComissaoEvertonMondial;
      acc.totalLucro += totalLucro;
      acc.totalItens += quantidade;
      return acc;
    },
    {
      totalCliente: 0,
      totalMondial: 0,
      totalComissaoEvertonMondial: 0,
      totalLucro: 0,
      totalItens: 0,
    }
  );

  const margemPedido = totals.totalMondial === 0 ? 0 : totals.totalLucro / totals.totalMondial;

  return {
    ...totals,
    margemPedido,
  };
}

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
    search: protectedProcedure
      .input(z.object({ query: z.string().optional(), limit: z.number().int().min(1).max(100).default(25) }).optional())
      .query(async ({ input }) => {
        return searchProducts(input?.query, input?.limit ?? 25);
      }),
    latestUpload: protectedProcedure.query(async () => {
      return getLatestProductUpload();
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
  orders: router({
    simulate: protectedProcedure
      .input(z.object({ items: z.array(orderItemInputSchema).min(1) }))
      .mutation(async ({ input }) => {
        const totals = computeOrderTotals(input.items);

        const customerList = input.items.map(item => ({
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
        const totals = computeOrderTotals(input.items);
        const orderId = await createOrder({
          customerName: input.customerName,
          customerReference: input.customerReference ?? null,
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
            lucroUnitario: item.lucroUnitario,
            totalCliente: formatMoney(toNumber(item.precoFinal || item.precoDesejado) * toNumber(item.quantidade)),
            totalMondial: formatMoney(toNumber(item.valorProduto) * toNumber(item.quantidade)),
            totalComissaoEvertonMondial: formatMoney(toNumber(item.comissao) * toNumber(item.quantidade)),
            totalLucro: formatMoney(toNumber(item.lucroUnitario) * toNumber(item.quantidade)),
          }))
        );

        const monthly = await getMonthlySummary(input.periodYear, input.periodMonth);
        await upsertMonthlySnapshot({
          periodYear: input.periodYear,
          periodMonth: input.periodMonth,
          totalPedidos: Number(monthly.totalPedidos ?? 0),
          totalCliente: String(monthly.totalCliente ?? "0.0000"),
          totalMondial: String(monthly.totalMondial ?? "0.0000"),
          totalComissaoEvertonMondial: String(monthly.totalComissaoEvertonMondial ?? "0.0000"),
          totalLucro: String(monthly.totalLucro ?? "0.0000"),
          margemMedia: String(monthly.margemMedia ?? "0.000000"),
          atualizadoEm: Date.now(),
        });

        const actionLabel = input.status === "finalized" ? "finalizado" : "criado";
        await notifyOwner({
          title: `Pedido ${actionLabel}`,
          content: `Pedido #${orderId} do cliente ${input.customerName} com total cliente de ${formatMoney(totals.totalCliente)} e lucro de ${formatMoney(totals.totalLucro)}.`,
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
          content: `Pedido #${input.orderId} do cliente ${result.order.customerName} foi finalizado.`,
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
  }),
  dashboard: router({
    monthly: protectedProcedure
      .input(z.object({ periodYear: z.number().int().optional(), periodMonth: z.number().int().min(1).max(12).optional() }).optional())
      .query(async ({ input }) => {
        return getMonthlySummary(input?.periodYear, input?.periodMonth);
      }),
  }),
});

export type AppRouter = typeof appRouter;
