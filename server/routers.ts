import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { notifyOwner } from "./_core/notification";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import {
  createCustomer,
  createOrder,
  createProductUpload,
  getCustomerById,
  getLatestProductUpload,
  getMonthlySummary,
  getOrderWithItems,
  insertOrderItems,
  listCustomers,
  listOrders,
  listProductUploads,
  listProducts,
  replaceProducts,
  searchCustomers,
  searchProducts,
  updateOrderStatus,
  updateProductPricingById,
  upsertMonthlySnapshot,
} from "./db";
import { storageGet, storagePut } from "./storage";
import * as XLSX from "xlsx";

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
  }),
  dashboard: router({
    monthly: protectedProcedure
      .input(z.object({ periodYear: z.number().int().optional(), periodMonth: z.number().int().min(1).max(12).optional() }).optional())
      .query(async ({ input }) => {
        return getMonthlySummary(input?.periodYear, input?.periodMonth);
      }),
    yearlyEvolution: protectedProcedure.query(async () => {
      const now = new Date();
      const months: { year: number; month: number; label: string; vendas: string; lucro: string; compras: string }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const summary = await getMonthlySummary(year, month);
        const label = `${String(month).padStart(2, "0")}/${year}`;
        months.push({
          year,
          month,
          label,
          vendas: String(summary.totalVendasClientes),
          lucro: String(summary.totalLucro),
          compras: String(summary.totalComprasPessoais),
        });
      }
      return months;
    }),
  }),
});

export type AppRouter = typeof appRouter;
