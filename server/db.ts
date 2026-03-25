import { and, desc, eq, isNotNull, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  campaignMessages,
  campaignProducts,
  campaigns,
  customers,
  InsertCampaign,
  InsertCampaignMessage,
  InsertCampaignProduct,
  InsertCustomer,
  InsertMonthlySnapshot,
  InsertOrder,
  InsertOrderItem,
  InsertProduct,
  InsertProductUpload,
  InsertUser,
  InsertMyCnpj,
  InsertBankStatement,
  InsertBankTransaction,
  InsertFixedCost,
  InsertFixedCostPayment,
  InsertCreditCard,
  InsertCreditCardInvoice,
  InsertLoan,
  InsertLoanInstallment,
  InsertLoanRetentionEntry,
  InsertPayableAccount,
  bankStatements,
  bankTransactions,
  fixedCosts,
  fixedCostPayments,
  creditCards,
  creditCardInvoices,
  loans,
  loanInstallments,
  loanRetentionEntries,
  payableAccounts,
  marketingStrategies,
  monthlySnapshots,
  myCnpjs,
  orderItems,
  orders,
  productUploads,
  products,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;

function createDatabasePool() {
  if (!process.env.DATABASE_URL) return null;

  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    ssl: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
    },
  });

  pool.on("connection", connection => {
    connection.on("error", error => {
      console.warn("[Database] Pool connection error:", error);
    });
  });

  return pool;
}

async function resetDbConnection(reason: string) {
  console.warn(`[Database] Resetting database connection: ${reason}`);
  if (_pool) {
    try {
      await _pool.end();
    } catch (error) {
      console.warn("[Database] Failed to close pool cleanly:", error);
    }
  }
  _pool = null;
  _db = null;
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = createDatabasePool();
      _db = _pool ? (drizzle(process.env.DATABASE_URL!) as ReturnType<typeof drizzle>) : null;
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _pool = null;
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
    const message = error instanceof Error ? error.message : String(error);
    const isConnectionReset = code === "ECONNRESET" || message.includes("ECONNRESET");

    if (isConnectionReset) {
      await resetDbConnection("upsertUser ECONNRESET");
    }

    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createProductUpload(input: InsertProductUpload) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productUploads).values(input).$returningId();
  return result[0]?.id ?? 0;
}

export async function replaceProducts(items: InsertProduct[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (items.length === 0) {
    return { inserted: 0 };
  }

  await db.transaction(async tx => {
    await tx.delete(products);
    await tx.insert(products).values(items);
  });

  return { inserted: items.length };
}

export async function getLatestProductUpload() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(productUploads).orderBy(desc(productUploads.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function listProductUploads(limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(productUploads).orderBy(desc(productUploads.createdAt)).limit(limit);
}

export async function searchProducts(query?: string, limit = 25) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const normalizedQuery = (query ?? "").trim();
  const filters = normalizedQuery
    ? or(like(products.sku, `%${normalizedQuery}%`), like(products.titulo, `%${normalizedQuery}%`))
    : undefined;

  return db.select().from(products).where(filters).orderBy(products.sku).limit(limit);
}

export async function listProducts(limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(products).orderBy(products.titulo).limit(limit);
}

export async function updateProductPricingById(input: {
  id: number;
  valorProduto: string;
  precoDesejado?: string | null;
  precoFinal: string;
  lucro: string;
  margemFinal: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(products)
    .set({
      valorProduto: input.valorProduto,
      precoDesejado: input.precoDesejado ?? input.precoFinal,
      precoFinal: input.precoFinal,
      lucro: input.lucro,
      margemFinal: input.margemFinal,
    })
    .where(eq(products.id, input.id));

  const rows = await db.select().from(products).where(eq(products.id, input.id)).limit(1);
  return rows[0] ?? null;
}

export async function createCustomer(input: InsertCustomer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(customers).values(input).$returningId();
  return result[0]?.id ?? 0;
}

export async function listCustomers(limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(customers).orderBy(customers.name).limit(limit);
}

export async function searchCustomers(query?: string, limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const normalizedQuery = (query ?? "").trim();
  const filters = normalizedQuery
    ? or(
        like(customers.name, `%${normalizedQuery}%`),
        like(customers.reference, `%${normalizedQuery}%`),
        like(customers.document, `%${normalizedQuery}%`),
        like(customers.phone, `%${normalizedQuery}%`)
      )
    : undefined;

  return db.select().from(customers).where(filters).orderBy(customers.name).limit(limit);
}

export async function getCustomerById(customerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  return rows[0] ?? null;
}

export async function deleteCustomer(customerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(customers).where(eq(customers.id, customerId));
}

export async function updateCustomer(customerId: number, data: Partial<InsertCustomer>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(customers).set(data).where(eq(customers.id, customerId));
  return getCustomerById(customerId);
}

export async function createOrder(input: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orders).values(input).$returningId();
  return result[0]?.id ?? 0;
}

export async function insertOrderItems(items: InsertOrderItem[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (items.length === 0) return;
  await db.insert(orderItems).values(items);
}

export async function updateOrderStatus(orderId: number, status: "draft" | "created" | "finalized" | "cancelled") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(orders)
    .set({
      status,
      finalizedAt: status === "finalized" ? new Date() : null,
    })
    .where(eq(orders.id, orderId));
}

export async function listOrders() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function getOrderWithItems(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const orderRows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const itemRows = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(orderItems.id);

  return {
    order: orderRows[0] ?? null,
    items: itemRows,
  };
}

export async function upsertMonthlySnapshot(input: InsertMonthlySnapshot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(monthlySnapshots)
    .where(and(eq(monthlySnapshots.periodYear, input.periodYear!), eq(monthlySnapshots.periodMonth, input.periodMonth!)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(monthlySnapshots)
      .set({
        totalPedidos: input.totalPedidos,
        totalPedidosCliente: input.totalPedidosCliente,
        totalPedidosPessoais: input.totalPedidosPessoais,
        totalCliente: input.totalCliente,
        totalMondial: input.totalMondial,
        totalComprasPessoais: input.totalComprasPessoais,
        totalVendasClientes: input.totalVendasClientes,
        totalComissaoEvertonMondial: input.totalComissaoEvertonMondial,
        totalLucro: input.totalLucro,
        margemMedia: input.margemMedia,
        atualizadoEm: input.atualizadoEm,
      })
      .where(eq(monthlySnapshots.id, existing[0].id));

    return existing[0].id;
  }

  const result = await db.insert(monthlySnapshots).values(input).$returningId();
  return result[0]?.id ?? 0;
}

/* ── Marketing Campaign helpers ── */

export async function createCampaign(input: InsertCampaign) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(campaigns).values(input).$returningId();
  return result[0]?.id ?? 0;
}

export async function updateCampaign(id: number, data: Partial<InsertCampaign>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(campaigns).set(data).where(eq(campaigns.id, id));
  const rows = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getCampaignById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listCampaigns(limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(limit);
}

export async function addCampaignProducts(items: InsertCampaignProduct[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (items.length === 0) return;
  await db.insert(campaignProducts).values(items);
}

export async function getCampaignProducts(campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(campaignProducts).where(eq(campaignProducts.campaignId, campaignId));
}

export async function removeCampaignProducts(campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(campaignProducts).where(eq(campaignProducts.campaignId, campaignId));
}

export async function createCampaignMessages(items: InsertCampaignMessage[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (items.length === 0) return;
  await db.insert(campaignMessages).values(items);
}

export async function listCampaignMessages(campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(campaignMessages).where(eq(campaignMessages.campaignId, campaignId)).orderBy(campaignMessages.customerName);
}

export async function updateCampaignMessageStatus(trackingCode: string, status: "sent" | "delivered" | "clicked" | "converted", extra?: { clickedAt?: number; convertedOrderId?: number; convertedAt?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(campaignMessages).set({ status, ...extra }).where(eq(campaignMessages.trackingCode, trackingCode));
}

export async function getCampaignMessageByTrackingCode(trackingCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(campaignMessages).where(eq(campaignMessages.trackingCode, trackingCode)).limit(1);
  return rows[0] ?? null;
}

export async function getCampaignStats(campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      totalSent: sql<number>`count(case when ${campaignMessages.status} != 'pending' then 1 end)`,
      totalClicked: sql<number>`count(case when ${campaignMessages.status} in ('clicked', 'converted') then 1 end)`,
      totalConverted: sql<number>`count(case when ${campaignMessages.status} = 'converted' then 1 end)`,
      totalMessages: sql<number>`count(*)`,
    })
    .from(campaignMessages)
    .where(eq(campaignMessages.campaignId, campaignId));

  return rows[0] ?? { totalSent: 0, totalClicked: 0, totalConverted: 0, totalMessages: 0 };
}

export async function listMarketingStrategies() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(marketingStrategies).where(eq(marketingStrategies.isActive, 1)).orderBy(marketingStrategies.sortOrder);
}

export async function getCustomersWithPhone() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(customers).where(and(eq(customers.isActive, 1), sql`${customers.phone} IS NOT NULL AND ${customers.phone} != ''`)).orderBy(customers.name);
}

export async function getMonthlySummary(periodYear?: number, periodMonth?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];
  if (periodYear) conditions.push(eq(orders.periodYear, periodYear));
  if (periodMonth) conditions.push(eq(orders.periodMonth, periodMonth));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      totalPedidos: sql<number>`count(*)`,
      totalPedidosCliente: sql<number>`coalesce(sum(case when ${orders.orderType} = 'customer' then 1 else 0 end), 0)`,
      totalPedidosPessoais: sql<number>`coalesce(sum(case when ${orders.orderType} = 'personal' then 1 else 0 end), 0)`,
      totalCliente: sql<string>`coalesce(sum(${orders.totalCliente}), 0)`,
      totalMondial: sql<string>`coalesce(sum(${orders.totalMondial}), 0)`,
      totalComprasPessoais: sql<string>`coalesce(sum(case when ${orders.orderType} = 'personal' then ${orders.totalMondial} else 0 end), 0)`,
      totalVendasClientes: sql<string>`coalesce(sum(case when ${orders.orderType} = 'customer' then ${orders.totalCliente} else 0 end), 0)`,
      totalComissaoEvertonMondial: sql<string>`coalesce(sum(${orders.totalComissaoEvertonMondial}), 0)`,
      totalLucro: sql<string>`coalesce(sum(case when ${orders.orderType} = 'customer' then ${orders.totalLucro} else 0 end), 0)`,
      margemMedia: sql<string>`coalesce(avg(case when ${orders.orderType} = 'customer' then ${orders.margemPedido} else null end), 0)`,
    })
    .from(orders)
    .where(whereClause);

  return rows[0] ?? {
    totalPedidos: 0,
    totalPedidosCliente: 0,
    totalPedidosPessoais: 0,
    totalCliente: "0.0000",
    totalMondial: "0.0000",
    totalComprasPessoais: "0.0000",
    totalVendasClientes: "0.0000",
    totalComissaoEvertonMondial: "0.0000",
    totalLucro: "0.0000",
    margemMedia: "0.000000",
  };
}

export async function getCustomerRanking(periodYear: number, periodMonth: number, limit = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      customerId: orders.customerId,
      customerName: orders.customerName,
      totalPedidos: sql<number>`count(*)`,
      totalCompras: sql<string>`coalesce(sum(${orders.totalCliente}), 0)`,
      totalLucro: sql<string>`coalesce(sum(${orders.totalLucro}), 0)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.periodYear, periodYear),
        eq(orders.periodMonth, periodMonth),
        eq(orders.orderType, "customer"),
        isNotNull(orders.customerId),
      )
    )
    .groupBy(orders.customerId, orders.customerName)
    .orderBy(sql`sum(${orders.totalCliente}) desc`)
    .limit(limit);

  return rows;
}

export async function countCustomers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(customers);

  return rows[0]?.count ?? 0;
}

export async function updateOrder(orderId: number, data: Partial<InsertOrder>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set(data).where(eq(orders.id, orderId));
  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return rows[0] ?? null;
}

export async function deleteOrderItems(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
}

export async function deleteOrder(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
  await db.delete(orders).where(eq(orders.id, orderId));
}

/* ── Meus CNPJs helpers ── */

export async function createMyCnpj(input: InsertMyCnpj) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(myCnpjs).values(input).$returningId();
  return result[0]?.id ?? 0;
}

export async function listMyCnpjs() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(myCnpjs).where(eq(myCnpjs.isActive, 1)).orderBy(myCnpjs.razaoSocial);
}

export async function getMyCnpjById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(myCnpjs).where(eq(myCnpjs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateMyCnpj(id: number, data: Partial<InsertMyCnpj>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(myCnpjs).set(data).where(eq(myCnpjs.id, id));
  return getMyCnpjById(id);
}

export async function deleteMyCnpj(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(myCnpjs).where(eq(myCnpjs.id, id));
}

export async function getCnpjRanking(periodYear: number, periodMonth: number, limit = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      cnpjId: orders.cnpjId,
      cnpj: myCnpjs.cnpj,
      razaoSocial: myCnpjs.razaoSocial,
      nomeFantasia: myCnpjs.nomeFantasia,
      totalPedidos: sql<number>`count(*)`,
      totalCompras: sql<string>`coalesce(sum(${orders.totalMondial}), 0)`,
    })
    .from(orders)
    .innerJoin(myCnpjs, eq(orders.cnpjId, myCnpjs.id))
    .where(
      and(
        eq(orders.periodYear, periodYear),
        eq(orders.periodMonth, periodMonth),
        eq(orders.orderType, "personal"),
        isNotNull(orders.cnpjId),
      )
    )
    .groupBy(orders.cnpjId, myCnpjs.cnpj, myCnpjs.razaoSocial, myCnpjs.nomeFantasia)
    .orderBy(sql`sum(${orders.totalMondial}) desc`)
    .limit(limit);

  return rows;
}

export async function getCnpjEvolution(periodYear: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      cnpjId: orders.cnpjId,
      razaoSocial: myCnpjs.razaoSocial,
      nomeFantasia: myCnpjs.nomeFantasia,
      periodMonth: orders.periodMonth,
      totalCompras: sql<string>`coalesce(sum(${orders.totalMondial}), 0)`,
    })
    .from(orders)
    .innerJoin(myCnpjs, eq(orders.cnpjId, myCnpjs.id))
    .where(
      and(
        eq(orders.periodYear, periodYear),
        eq(orders.orderType, "personal"),
        isNotNull(orders.cnpjId),
      )
    )
    .groupBy(orders.cnpjId, myCnpjs.razaoSocial, myCnpjs.nomeFantasia, orders.periodMonth)
    .orderBy(orders.periodMonth);

  return rows;
}


/* ── Bank Statements ── */

export async function createBankStatement(input: InsertBankStatement) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(bankStatements).values(input);
  return { id: result.insertId };
}

export async function listBankStatements() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(bankStatements).orderBy(desc(bankStatements.periodYear), desc(bankStatements.periodMonth), desc(bankStatements.createdAt));
}

export async function getBankStatementById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(bankStatements).where(eq(bankStatements.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateBankStatement(id: number, data: Partial<InsertBankStatement>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bankStatements).set(data).where(eq(bankStatements.id, id));
}

export async function deleteBankStatement(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(bankTransactions).where(eq(bankTransactions.statementId, id));
  await db.delete(bankStatements).where(eq(bankStatements.id, id));
}

/* ── Bank Transactions ── */

export async function createBankTransactions(items: InsertBankTransaction[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (items.length === 0) return;
  await db.insert(bankTransactions).values(items);
}

export async function listBankTransactions(statementId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(bankTransactions).where(eq(bankTransactions.statementId, statementId)).orderBy(bankTransactions.id);
}

export async function updateBankTransaction(id: number, data: { category?: string | null; userDescription?: string | null; isIdentified?: number; notes?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bankTransactions).set(data).where(eq(bankTransactions.id, id));
}

export async function updateBankTransactionsBatch(updates: { id: number; category?: string | null; userDescription?: string | null; isIdentified?: number; notes?: string | null }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (const u of updates) {
    const { id, ...data } = u;
    await db.update(bankTransactions).set(data).where(eq(bankTransactions.id, id));
  }
}

export async function recalcStatementCounts(statementId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const txns = await db.select().from(bankTransactions).where(eq(bankTransactions.statementId, statementId));
  const total = txns.length;
  const identified = txns.filter(t => t.isIdentified === 1).length;
  let status: "pending" | "partial" | "completed" = "pending";
  if (identified > 0 && identified < total) status = "partial";
  if (identified > 0 && identified >= total) status = "completed";
  await db.update(bankStatements).set({ totalTransactions: total, totalIdentified: identified, status }).where(eq(bankStatements.id, statementId));
}

/* ══════════════════════════════════════════════════════════════
   FINANCEIRO: Custos Fixos
   ══════════════════════════════════════════════════════════════ */

export async function listFixedCosts(cnpjId?: number) {
  const db = await getDb();
  return db!
    .select()
    .from(fixedCosts)
    .where(and(eq(fixedCosts.isActive, 1), cnpjId ? eq(fixedCosts.cnpjId, cnpjId) : undefined))
    .orderBy(fixedCosts.name);
}

export async function createFixedCost(data: InsertFixedCost) {
  const db = await getDb();
  const [result] = await db!.insert(fixedCosts).values(data);
  return result.insertId;
}

export async function updateFixedCost(id: number, data: Partial<InsertFixedCost>) {
  const db = await getDb();
  await db!.update(fixedCosts).set(data).where(eq(fixedCosts.id, id));
}

export async function deleteFixedCost(id: number) {
  const db = await getDb();
  await db!.update(fixedCosts).set({ isActive: 0 }).where(eq(fixedCosts.id, id));
}

export async function listFixedCostPayments(year: number, month: number, cnpjId?: number) {
  const db = await getDb();
  return db!.select({
    payment: fixedCostPayments,
    fixedCost: fixedCosts,
  }).from(fixedCostPayments)
    .innerJoin(fixedCosts, eq(fixedCostPayments.fixedCostId, fixedCosts.id))
    .where(and(
      eq(fixedCostPayments.periodYear, year),
      eq(fixedCostPayments.periodMonth, month),
      cnpjId ? eq(fixedCosts.cnpjId, cnpjId) : undefined,
    ));
}

export async function upsertFixedCostPayment(data: InsertFixedCostPayment) {
  const db = await getDb();
  // Check if payment exists for this fixedCostId + period
  const existing = await db!.select().from(fixedCostPayments)
    .where(and(
      eq(fixedCostPayments.fixedCostId, data.fixedCostId),
      eq(fixedCostPayments.periodYear, data.periodYear),
      eq(fixedCostPayments.periodMonth, data.periodMonth),
    ));
  if (existing.length > 0) {
    await db!.update(fixedCostPayments).set({
      amountPaid: data.amountPaid,
      status: data.status,
      paidAt: data.paidAt,
      notes: data.notes,
    }).where(eq(fixedCostPayments.id, existing[0].id));
    return existing[0].id;
  }
  const [result] = await db!.insert(fixedCostPayments).values(data);
  return result.insertId;
}

/* ══════════════════════════════════════════════════════════════
   FINANCEIRO: Cartões de Crédito
   ══════════════════════════════════════════════════════════════ */

export async function listCreditCards(cnpjId?: number) {
  const db = await getDb();
  return db!
    .select()
    .from(creditCards)
    .where(and(eq(creditCards.isActive, 1), cnpjId ? eq(creditCards.cnpjId, cnpjId) : undefined))
    .orderBy(creditCards.name);
}

export async function createCreditCard(data: InsertCreditCard) {
  const db = await getDb();
  const [result] = await db!.insert(creditCards).values(data);
  return result.insertId;
}

export async function updateCreditCard(id: number, data: Partial<InsertCreditCard>) {
  const db = await getDb();
  await db!.update(creditCards).set(data).where(eq(creditCards.id, id));
}

export async function deleteCreditCard(id: number) {
  const db = await getDb();
  await db!.update(creditCards).set({ isActive: 0 }).where(eq(creditCards.id, id));
}

export async function listCreditCardInvoices(cardId?: number, year?: number, month?: number, cnpjId?: number) {
  const conditions = [];
  if (cardId) conditions.push(eq(creditCardInvoices.cardId, cardId));
  if (year) conditions.push(eq(creditCardInvoices.periodYear, year));
  if (month) conditions.push(eq(creditCardInvoices.periodMonth, month));
  if (cnpjId) conditions.push(eq(creditCards.cnpjId, cnpjId));
  const db = await getDb();
  return db!.select({
    invoice: creditCardInvoices,
    card: creditCards,
  }).from(creditCardInvoices)
    .innerJoin(creditCards, eq(creditCardInvoices.cardId, creditCards.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(creditCardInvoices.periodYear), desc(creditCardInvoices.periodMonth));
}

export async function upsertCreditCardInvoice(data: InsertCreditCardInvoice) {
  const db = await getDb();
  const existing = await db!.select().from(creditCardInvoices)
    .where(and(
      eq(creditCardInvoices.cardId, data.cardId),
      eq(creditCardInvoices.periodYear, data.periodYear),
      eq(creditCardInvoices.periodMonth, data.periodMonth),
    ));
  if (existing.length > 0) {
    await db!.update(creditCardInvoices).set({
      totalAmount: data.totalAmount,
      minimumAmount: data.minimumAmount,
      amountPaid: data.amountPaid,
      status: data.status,
      paidAt: data.paidAt,
      notes: data.notes,
    }).where(eq(creditCardInvoices.id, existing[0].id));
    return existing[0].id;
  }
  const [result] = await db!.insert(creditCardInvoices).values(data);
  return result.insertId;
}

/* ══════════════════════════════════════════════════════════════
   FINANCEIRO: Empréstimos
   ══════════════════════════════════════════════════════════════ */

export async function listLoans(cnpjId?: number) {
  const db = await getDb();
  return db!
    .select()
    .from(loans)
    .where(and(eq(loans.isActive, 1), cnpjId ? eq(loans.cnpjId, cnpjId) : undefined))
    .orderBy(loans.name);
}

export async function createLoan(data: InsertLoan) {
  const db = await getDb();
  const [result] = await db!.insert(loans).values(data);
  return result.insertId;
}

export async function updateLoan(id: number, data: Partial<InsertLoan>) {
  const db = await getDb();
  await db!.update(loans).set(data).where(eq(loans.id, id));
}

export async function deleteLoan(id: number) {
  const db = await getDb();
  await db!.update(loans).set({ isActive: 0 }).where(eq(loans.id, id));
}

export async function listLoanInstallments(loanId?: number, year?: number, month?: number, cnpjId?: number) {
  const conditions = [];
  if (loanId) conditions.push(eq(loanInstallments.loanId, loanId));
  if (year) conditions.push(eq(loanInstallments.periodYear, year));
  if (month) conditions.push(eq(loanInstallments.periodMonth, month));
  if (cnpjId) conditions.push(eq(loans.cnpjId, cnpjId));
  const db = await getDb();
  return db!.select({
    installment: loanInstallments,
    loan: loans,
  }).from(loanInstallments)
    .innerJoin(loans, eq(loanInstallments.loanId, loans.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(loanInstallments.installmentNumber);
}

export async function upsertLoanInstallment(data: InsertLoanInstallment) {
  const db = await getDb();
  const existing = await db!.select().from(loanInstallments)
    .where(and(
      eq(loanInstallments.loanId, data.loanId),
      eq(loanInstallments.periodYear, data.periodYear),
      eq(loanInstallments.periodMonth, data.periodMonth),
    ));
  if (existing.length > 0) {
    await db!.update(loanInstallments).set({
      amount: data.amount,
      status: data.status,
      paidAt: data.paidAt,
      notes: data.notes,
    }).where(eq(loanInstallments.id, existing[0].id));
    return existing[0].id;
  }
  const [result] = await db!.insert(loanInstallments).values(data);
  return result.insertId;
}

export async function listLoanRetentionEntries(loanId?: number, year?: number, month?: number, cnpjId?: number) {
  const conditions = [];
  if (loanId) conditions.push(eq(loanRetentionEntries.loanId, loanId));
  if (year) conditions.push(eq(loanRetentionEntries.periodYear, year));
  if (month) conditions.push(eq(loanRetentionEntries.periodMonth, month));
  if (cnpjId) conditions.push(eq(loans.cnpjId, cnpjId));
  const db = await getDb();
  return db!.select({
    entry: loanRetentionEntries,
    loan: loans,
  }).from(loanRetentionEntries)
    .innerJoin(loans, eq(loanRetentionEntries.loanId, loans.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(loanRetentionEntries.entryDate), desc(loanRetentionEntries.id));
}

export async function createLoanRetentionEntry(data: InsertLoanRetentionEntry) {
  const db = await getDb();
  const [result] = await db!.insert(loanRetentionEntries).values(data);
  await syncLoanRetentionTotals(data.loanId);
  return result.insertId;
}

export async function updateLoanRetentionEntry(id: number, data: Partial<InsertLoanRetentionEntry>) {
  const db = await getDb();
  const current = await db!.select().from(loanRetentionEntries).where(eq(loanRetentionEntries.id, id)).limit(1);
  if (!current[0]) return;
  await db!.update(loanRetentionEntries).set(data).where(eq(loanRetentionEntries.id, id));
  await syncLoanRetentionTotals(current[0].loanId);
}

export async function deleteLoanRetentionEntry(id: number) {
  const db = await getDb();
  const current = await db!.select().from(loanRetentionEntries).where(eq(loanRetentionEntries.id, id)).limit(1);
  if (!current[0]) return;
  await db!.delete(loanRetentionEntries).where(eq(loanRetentionEntries.id, id));
  await syncLoanRetentionTotals(current[0].loanId);
}

export async function syncLoanRetentionTotals(loanId: number) {
  const db = await getDb();
  const entries = await db!.select().from(loanRetentionEntries).where(eq(loanRetentionEntries.loanId, loanId));
  const totalPaid = entries.reduce((sum, entry) => sum + parseFloat(String(entry.retainedAmount || "0")), 0);
  const loanRows = await db!.select().from(loans).where(eq(loans.id, loanId)).limit(1);
  const loan = loanRows[0];
  if (!loan) return;
  const totalAmount = parseFloat(String(loan.totalAmount || "0"));
  await db!.update(loans).set({
    totalPaid: String(totalPaid),
    status: totalPaid >= totalAmount && totalAmount > 0 ? "paid_off" : "active",
  }).where(eq(loans.id, loanId));
}

export async function listPayableAccounts(year?: number, month?: number, status?: string, cnpjId?: number) {
  const db = await getDb();
  const conditions = [];
  if (status && status !== "all") conditions.push(eq(payableAccounts.status, status as any));
  if (year && month) {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    conditions.push(like(payableAccounts.dueDate, `${prefix}%`));
  }
  if (cnpjId) conditions.push(eq(payableAccounts.cnpjId, cnpjId));
  return db!.select().from(payableAccounts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(payableAccounts.dueDate, payableAccounts.title);
}

export async function createPayableAccount(data: InsertPayableAccount) {
  const db = await getDb();
  const [result] = await db!.insert(payableAccounts).values(data);
  return result.insertId;
}

export async function updatePayableAccount(id: number, data: Partial<InsertPayableAccount>) {
  const db = await getDb();
  await db!.update(payableAccounts).set(data).where(eq(payableAccounts.id, id));
}

export async function deletePayableAccount(id: number) {
  const db = await getDb();
  await db!.delete(payableAccounts).where(eq(payableAccounts.id, id));
}

export async function getPayablesDashboard(referenceDate: string, year?: number, month?: number, cnpjId?: number) {
  const db = await getDb();
  const allAccounts = await listPayableAccounts(year, month, undefined, cnpjId);
  const pendingCount = allAccounts.filter(a => a.status === "pending").length;
  const overdue = allAccounts.filter(a => a.status !== "paid" && a.dueDate < referenceDate);
  const dueTomorrow = allAccounts.filter(a => a.status !== "paid" && a.dueDate >= referenceDate && a.dueDate <= addDays(referenceDate, 1));
  const totalPending = allAccounts.filter(a => a.status !== "paid").reduce((sum, a) => sum + parseFloat(String(a.amount || "0")), 0);
  const totalOverdue = overdue.reduce((sum, a) => sum + parseFloat(String(a.amount || "0")), 0);
  return {
    allAccounts,
    overdue,
    dueTomorrow,
    pendingCount,
    totalPending,
    totalOverdue,
  };
}

function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function getLoanInstallmentsByPeriod(year: number, month: number, cnpjId?: number) {
  const db = await getDb();
  return db!.select({
    installment: loanInstallments,
    loanName: loans.name,
    institution: loans.institution,
  }).from(loanInstallments)
    .innerJoin(loans, eq(loanInstallments.loanId, loans.id))
    .where(and(
      eq(loanInstallments.periodYear, year),
      eq(loanInstallments.periodMonth, month),
      cnpjId ? eq(loans.cnpjId, cnpjId) : undefined,
    ));
}

export async function getDREData(year: number, month: number, cnpjId?: number) {
  const db = await getDb();

  const salesOrders = await db!.select().from(orders)
    .where(and(
      eq(orders.periodYear, year),
      eq(orders.periodMonth, month),
      eq(orders.orderType, "customer"),
      cnpjId ? eq(orders.cnpjId, cnpjId) : undefined,
    ));

  const personalOrders = await db!.select().from(orders)
    .where(and(
      eq(orders.periodYear, year),
      eq(orders.periodMonth, month),
      eq(orders.orderType, "personal"),
      cnpjId ? eq(orders.cnpjId, cnpjId) : undefined,
    ));

  const fixedCostPaymentsList = await db!.select({
    payment: fixedCostPayments,
    costName: fixedCosts.name,
    costCategory: fixedCosts.category,
  }).from(fixedCostPayments)
    .innerJoin(fixedCosts, eq(fixedCostPayments.fixedCostId, fixedCosts.id))
    .where(and(
      eq(fixedCostPayments.periodYear, year),
      eq(fixedCostPayments.periodMonth, month),
      cnpjId ? eq(fixedCosts.cnpjId, cnpjId) : undefined,
    ));

  const cardInvoicesList = await db!.select({
    invoice: creditCardInvoices,
    cardName: creditCards.name,
    cardBrand: creditCards.brand,
  }).from(creditCardInvoices)
    .innerJoin(creditCards, eq(creditCardInvoices.cardId, creditCards.id))
    .where(and(
      eq(creditCardInvoices.periodYear, year),
      eq(creditCardInvoices.periodMonth, month),
      cnpjId ? eq(creditCards.cnpjId, cnpjId) : undefined,
    ));

  const loanInstallmentsList = await db!.select({
    installment: loanInstallments,
    loanName: loans.name,
    institution: loans.institution,
    loanType: loans.loanType,
  }).from(loanInstallments)
    .innerJoin(loans, eq(loanInstallments.loanId, loans.id))
    .where(and(
      eq(loanInstallments.periodYear, year),
      eq(loanInstallments.periodMonth, month),
      cnpjId ? eq(loans.cnpjId, cnpjId) : undefined,
    ));

  const loanRetentionEntriesList = await db!.select({
    entry: loanRetentionEntries,
    loanName: loans.name,
    institution: loans.institution,
    retentionSource: loans.retentionSource,
    retentionPercent: loans.retentionPercent,
    totalAmount: loans.totalAmount,
    totalPaid: loans.totalPaid,
  }).from(loanRetentionEntries)
    .innerJoin(loans, eq(loanRetentionEntries.loanId, loans.id))
    .where(and(
      eq(loanRetentionEntries.periodYear, year),
      eq(loanRetentionEntries.periodMonth, month),
      cnpjId ? eq(loans.cnpjId, cnpjId) : undefined,
    ));

  const payableAccountsList = await db!.select().from(payableAccounts)
    .where(and(
      like(payableAccounts.dueDate, `${year}-${String(month).padStart(2, "0")}%`),
      cnpjId ? eq(payableAccounts.cnpjId, cnpjId) : undefined,
    ));

  const bankStatementsData = await db!.select().from(bankStatements)
    .where(and(
      eq(bankStatements.periodYear, year),
      eq(bankStatements.periodMonth, month),
      cnpjId ? eq(bankStatements.cnpjId, cnpjId) : undefined,
    ));

  let bankTransactionsData: any[] = [];
  if (bankStatementsData.length > 0) {
    const statementIds = bankStatementsData.map((s: any) => s.id);
    for (const sid of statementIds) {
      const txns = await db!.select().from(bankTransactions).where(eq(bankTransactions.statementId, sid));
      bankTransactionsData.push(...txns);
    }
  }

  const snapshot = await db!.select().from(monthlySnapshots)
    .where(and(
      eq(monthlySnapshots.periodYear, year),
      eq(monthlySnapshots.periodMonth, month),
    ));

  const marketplaceBreakdown = {
    vendas: loanRetentionEntriesList.filter(item => item.entry.eventCategory === "venda"),
    taxas: loanRetentionEntriesList.filter(item => item.entry.eventCategory === "taxa"),
    antecipacoes: loanRetentionEntriesList.filter(item => item.entry.eventCategory === "antecipacao"),
    devolucoes: loanRetentionEntriesList.filter(item => item.entry.eventCategory === "devolucao"),
    abatimentos: loanRetentionEntriesList.filter(item => item.entry.eventCategory === "abatimento_emprestimo"),
    ajustes: loanRetentionEntriesList.filter(item => item.entry.eventCategory === "ajuste"),
  };

  const marketplaceSummary = {
    totalVendas: marketplaceBreakdown.vendas.reduce((sum, item) => sum + parseFloat(String(item.entry.netAmount || item.entry.grossAmount || "0")), 0),
    totalTaxas: marketplaceBreakdown.taxas.reduce((sum, item) => sum + Math.abs(parseFloat(String(item.entry.retainedAmount || item.entry.netAmount || item.entry.grossAmount || "0"))), 0),
    totalAntecipacoes: marketplaceBreakdown.antecipacoes.reduce((sum, item) => sum + Math.abs(parseFloat(String(item.entry.retainedAmount || item.entry.netAmount || item.entry.grossAmount || "0"))), 0),
    totalDevolucoes: marketplaceBreakdown.devolucoes.reduce((sum, item) => sum + Math.abs(parseFloat(String(item.entry.retainedAmount || item.entry.netAmount || item.entry.grossAmount || "0"))), 0),
    totalAbatimentosEmprestimo: marketplaceBreakdown.abatimentos.reduce((sum, item) => sum + parseFloat(String(item.entry.retainedAmount || "0")), 0),
    totalAjustes: marketplaceBreakdown.ajustes.reduce((sum, item) => sum + parseFloat(String(item.entry.retainedAmount || "0")), 0),
  };

  const cashInBank = bankTransactionsData.filter((t: any) => t.transactionType === "credit").reduce((sum: number, t: any) => sum + parseFloat(String(t.amount || "0")), 0);
  const cashOutBank = bankTransactionsData.filter((t: any) => t.transactionType === "debit").reduce((sum: number, t: any) => sum + Math.abs(parseFloat(String(t.amount || "0"))), 0);
  const investedCapital = payableAccountsList.filter(a => a.isInvestment === 1 || a.accountType === "investimento").reduce((sum, a) => sum + parseFloat(String(a.amount || "0")), 0);

  return {
    salesOrders,
    personalOrders,
    fixedCostPayments: fixedCostPaymentsList,
    cardInvoices: cardInvoicesList,
    loanInstallments: loanInstallmentsList,
    loanRetentionEntries: loanRetentionEntriesList,
    payableAccounts: payableAccountsList,
    bankStatements: bankStatementsData,
    bankTransactions: bankTransactionsData,
    marketplaceBreakdown,
    marketplaceSummary,
    healthBase: {
      cashInBank,
      cashOutBank,
      investedCapital,
      pendingPayables: payableAccountsList.filter(a => a.status !== "paid").reduce((sum, a) => sum + parseFloat(String(a.amount || "0")), 0),
      overduePayables: payableAccountsList.filter(a => a.status === "overdue").reduce((sum, a) => sum + parseFloat(String(a.amount || "0")), 0),
    },
    snapshot: snapshot[0] || null,
  };
}
