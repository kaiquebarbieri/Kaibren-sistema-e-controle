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
  InsertTeamMember,
  mlCatalogProducts,
  MLCatalogProduct,
  InsertMLCatalogProduct,
  marketplaceFees,
  MarketplaceFee,
  InsertMarketplaceFee,
  InsertTeamTask,
  InsertTeamRecord,
  InsertTeamCharge,
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
  marketplaceOrders,
  productUploads,
  products,
  productBrands,
  productCategories,
  productWarehouses,
  productCostHistory,
  productSaleHistory,
  productFixedCosts,
  productStocks,
  productKitItems,
  InsertProductBrand,
  InsertProductCategory,
  InsertProductWarehouse,
  InsertProductCostHistory,
  InsertProductSaleHistory,
  InsertProductFixedCost,
  InsertProductStock,
  InsertProductKitItem,
  users,
  teamMembers,
  teamTasks,
  teamRecords,
  teamCharges,
  systemSettings,
  SystemSetting,
  InsertSystemSetting,
  companyTaxRates,
  CompanyTaxRate,
  InsertCompanyTaxRate,
  companyTaxExceptions,
  CompanyTaxException,
  InsertCompanyTaxException,
  integrations,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { calcEverton, calcEmbalagem, calcMlFeesPerUnit, IMPOSTO_PERCENT_FALLBACK, aliquotaEfetivaSimples } from "./_core/costing";

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

// Pool dedicado para rawQuery (independente do drizzle)
let _rawPool: mysql.Pool | null = null;
function getRawPool() {
  if (!_rawPool && process.env.DATABASE_URL) {
    _rawPool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 5,
    });
  }
  return _rawPool;
}

// Raw SQL query usando o pool diretamente (retorna rows como objetos)
export async function rawQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const pool = getRawPool();
  if (!pool) return [];
  try {
    const [rows] = await pool.execute(sql, params);
    return rows as T[];
  } catch (err: any) {
    console.warn("[DB rawQuery] erro:", err.message, "| SQL:", sql.slice(0, 80));
    return [];
  }
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

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
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

export async function getProductMarginAnalysis(
  periodYear?: number,
  periodMonth?: number,
  periodStart?: Date,
  periodEnd?: Date,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [
    sql`${marketplaceOrders.status} NOT IN ('cancelled', 'to_return')`,
  ];
  if (periodStart && periodEnd) {
    conditions.push(sql`${marketplaceOrders.platformCreatedAt} >= ${periodStart}`);
    conditions.push(sql`${marketplaceOrders.platformCreatedAt} < ${periodEnd}`);
  } else {
    if (periodYear) conditions.push(sql`YEAR(${marketplaceOrders.platformCreatedAt}) = ${periodYear}`);
    if (periodMonth) conditions.push(sql`MONTH(${marketplaceOrders.platformCreatedAt}) = ${periodMonth}`);
  }

  // Agrupa por (productSku se existe, senão productName) — agrega vendas que vieram sem SKU mas mesmo título
  const rows = await db
    .select({
      sku: marketplaceOrders.productSku,
      productName: marketplaceOrders.productName,
      titulo: sql<string>`MAX(${marketplaceOrders.productName})`,
      tituloProduto: sql<string>`MAX(${products.titulo})`,
      vendas: sql<number>`coalesce(sum(${marketplaceOrders.quantity}), 0)`,
      faturamento: sql<string>`coalesce(sum(${marketplaceOrders.totalAmount}), 0)`,
      custoUnit: sql<string>`coalesce(max(${products.valorProduto}), 0)`,
      // Fallback: custo do ml_catalog_products via título exato
      custoMlCatalog: sql<string>`coalesce(max(${mlCatalogProducts.costPrice}), 0)`,
      packagingMlCatalog: sql<string>`coalesce(max(${mlCatalogProducts.packagingCost}), 0)`,
    })
    .from(marketplaceOrders)
    .leftJoin(products, eq(marketplaceOrders.productSku, products.sku))
    .leftJoin(mlCatalogProducts, eq(marketplaceOrders.productName, mlCatalogProducts.title))
    .where(and(...conditions))
    .groupBy(marketplaceOrders.productSku, marketplaceOrders.productName);

  const parsed = rows.map((r) => {
    const faturamento = Number(r.faturamento ?? 0);
    const vendas = Number(r.vendas ?? 0);
    // Resolve custo: primeiro products (SKU bate), depois ml_catalog_products (título bate)
    const custoProducts = Number(r.custoUnit ?? 0);
    const custoMlCat = Number(r.custoMlCatalog ?? 0);
    const custoUnit = custoProducts > 0 ? custoProducts : custoMlCat;
    const temCusto = custoUnit > 0;
    const ticketMedio = vendas > 0 ? faturamento / vendas : 0;
    const tituloRef = String(r.tituloProduto ?? r.titulo ?? "");

    // === Margem REAL (todos os custos descontados) ===
    // 1. Custo direto: Mondial + Everton + Embalagem
    const evertonUnit = calcEverton(custoUnit);
    // Embalagem: usa packagingCost cadastrado se vier do ml_catalog (mais confiável); senão calcula pelo título
    const packagingMl = Number(r.packagingMlCatalog ?? 0);
    const embalagemUnit = (custoProducts === 0 && packagingMl > 0) ? packagingMl : calcEmbalagem(tituloRef);
    const custoTotalUnit = custoUnit + evertonUnit + embalagemUnit;
    const custoTotalAgg = custoTotalUnit * vendas;
    const evertonTotal = evertonUnit * vendas;
    const embalagemTotal = embalagemUnit * vendas;

    // 2. Taxas marketplace (ML como base — produtos vendem majoritariamente em ML)
    //    Aplica por unidade pra refletir taxa fixa por faixa de preço.
    const fees = calcMlFeesPerUnit(ticketMedio);
    const taxasMarketplaceTotal = fees.total * vendas;

    // 3. Imposto: 9.3% Simples (fallback global — sem cnpjId aqui)
    const impostoTotal = faturamento * (IMPOSTO_PERCENT_FALLBACK / 100);

    // Margem real = receita - custo total - taxas - imposto
    const margemRs = temCusto
      ? faturamento - custoTotalAgg - taxasMarketplaceTotal - impostoTotal
      : 0;
    const margemPct = temCusto && faturamento > 0 ? margemRs / faturamento : 0;

    // Chave estável: SKU se existe, senão usa o título do pedido (cobre pedidos ML sem SKU)
    const key = (r.sku && r.sku.length > 0) ? r.sku : `t:${String(r.productName ?? r.titulo ?? "")}`;

    return {
      key,
      sku: r.sku ?? "",
      titulo: r.titulo ?? "",
      vendas,
      faturamento,
      margemRs,
      ticketMedio,
      margemPct,
      temCusto,
      // Detalhamento (debug/tooltip)
      custoBaseUnit: custoUnit,
      evertonUnit,
      embalagemUnit,
      custoTotalAgg,
      evertonTotal,
      embalagemTotal,
      taxasMarketplaceTotal,
      impostoTotal,
    };
  });

  const totalFaturamento = parsed.reduce((s, p) => s + p.faturamento, 0);
  const totalMargem = parsed.reduce((s, p) => s + p.margemRs, 0);
  const totalVendas = parsed.reduce((s, p) => s + p.vendas, 0);

  const byFat = [...parsed].sort((a, b) => b.faturamento - a.faturamento);
  let acumFat = 0;
  const abcFatMap = new Map<string, "A" | "B" | "C">();
  for (const p of byFat) {
    acumFat += p.faturamento;
    const pctAcum = totalFaturamento > 0 ? acumFat / totalFaturamento : 0;
    abcFatMap.set(p.key, pctAcum <= 0.8 ? "A" : pctAcum <= 0.95 ? "B" : "C");
  }

  const comCusto = parsed.filter((p) => p.temCusto);
  const totalMargemComCusto = comCusto.reduce((s, p) => s + p.margemRs, 0);
  const byMargem = [...comCusto].sort((a, b) => b.margemRs - a.margemRs);
  let acumMargem = 0;
  const abcMargemMap = new Map<string, "A" | "B" | "C">();
  for (const p of byMargem) {
    acumMargem += p.margemRs;
    const pctAcum = totalMargemComCusto > 0 ? acumMargem / totalMargemComCusto : 0;
    abcMargemMap.set(p.key, pctAcum <= 0.8 ? "A" : pctAcum <= 0.95 ? "B" : "C");
  }

  const items = byFat.map((p) => ({
    sku: p.sku,
    titulo: p.titulo,
    vendas: p.vendas,
    faturamento: p.faturamento.toFixed(2),
    ticketMedio: p.ticketMedio.toFixed(2),
    margemRs: p.margemRs.toFixed(2),
    margemPct: p.margemPct,
    temCusto: p.temCusto,
    share: totalFaturamento > 0 ? p.faturamento / totalFaturamento : 0,
    abcFaturamento: abcFatMap.get(p.key) ?? "C",
    abcMargem: p.temCusto ? (abcMargemMap.get(p.key) ?? "C") : null,
    // Detalhamento de custos (UI pode mostrar em tooltip/expansão)
    custoBaseUnit: p.custoBaseUnit.toFixed(2),
    evertonUnit: p.evertonUnit.toFixed(2),
    embalagemUnit: p.embalagemUnit.toFixed(2),
    custoTotalAgg: p.custoTotalAgg.toFixed(2),
    taxasMarketplaceTotal: p.taxasMarketplaceTotal.toFixed(2),
    impostoTotal: p.impostoTotal.toFixed(2),
  }));

  const produtosSemCusto = parsed.length - comCusto.length;
  const faturamentoComCusto = comCusto.reduce((s, p) => s + p.faturamento, 0);
  const totalEverton = comCusto.reduce((s, p) => s + p.evertonTotal, 0);
  const totalEmbalagem = comCusto.reduce((s, p) => s + p.embalagemTotal, 0);
  const totalCustoMondial = comCusto.reduce((s, p) => s + p.custoBaseUnit * p.vendas, 0);
  const totalTaxasMarketplace = comCusto.reduce((s, p) => s + p.taxasMarketplaceTotal, 0);
  const totalImposto = comCusto.reduce((s, p) => s + p.impostoTotal, 0);

  return {
    items,
    totals: {
      vendas: totalVendas,
      faturamento: totalFaturamento.toFixed(2),
      margemRs: totalMargem.toFixed(2),
      margemPct: faturamentoComCusto > 0 ? totalMargem / faturamentoComCusto : 0,
      produtos: items.length,
      produtosSemCusto,
      coberturaCustoPct: parsed.length > 0 ? comCusto.length / parsed.length : 0,
      // Breakdown agregado dos custos (transparência total)
      custoMondial: totalCustoMondial.toFixed(2),
      everton: totalEverton.toFixed(2),
      embalagem: totalEmbalagem.toFixed(2),
      taxasMarketplace: totalTaxasMarketplace.toFixed(2),
      imposto: totalImposto.toFixed(2),
    },
  };
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

export async function updateProductFullById(id: number, patch: {
  sku?: string;
  titulo?: string;
  brandId?: number | null;
  categoryId?: number | null;
  internalCode?: string | null;
  ncm?: string | null;
  gtin?: string | null;
  cest?: string | null;
  taxOriginCode?: string | null;
  unitOfMeasure?: string;
  weightKg?: string | null;
  notes?: string | null;
  isKit?: number;
  isActive?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const toSet: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) toSet[k] = v;
  }
  if (Object.keys(toSet).length === 0) {
    const existing = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return existing[0] ?? null;
  }

  await db.update(products).set(toSet).where(eq(products.id, id));
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
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

// ── Team / Equipe ───────────────────────────────────────

export async function listTeamMembers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(teamMembers).where(eq(teamMembers.active, 1)).orderBy(teamMembers.name);
}

export async function createTeamMember(data: { name: string; whatsapp: string; usesWhatsappOnly?: number; tasks: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(teamMembers).values({
    name: data.name,
    whatsapp: data.whatsapp,
    usesWhatsappOnly: data.usesWhatsappOnly ?? 0,
  }).$returningId();
  const memberId = result[0]?.id ?? 0;

  if (data.tasks.length > 0) {
    await db.insert(teamTasks).values(
      data.tasks.map(desc => ({ memberId, description: desc })),
    );
  }

  return memberId;
}

export async function getTeamMemberById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(teamMembers).where(eq(teamMembers.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listTeamTasks(memberId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(teamTasks).where(and(eq(teamTasks.memberId, memberId), eq(teamTasks.active, 1)));
}

export async function upsertTeamRecord(data: { memberId: number; taskId?: number; date: string; status: "pendente" | "cumprido" | "nao_cumprido"; photoPath?: string; observation?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if record exists for member + date
  const existing = await db.select().from(teamRecords).where(
    and(eq(teamRecords.memberId, data.memberId), eq(teamRecords.date, data.date)),
  ).limit(1);

  if (existing.length > 0) {
    await db.update(teamRecords).set({
      status: data.status,
      photoPath: data.photoPath ?? existing[0].photoPath,
      observation: data.observation ?? existing[0].observation,
      taskId: data.taskId ?? existing[0].taskId,
    }).where(eq(teamRecords.id, existing[0].id));
    return existing[0].id;
  }

  const result = await db.insert(teamRecords).values({
    memberId: data.memberId,
    taskId: data.taskId,
    date: data.date,
    status: data.status,
    photoPath: data.photoPath,
    observation: data.observation,
  }).$returningId();
  return result[0]?.id ?? 0;
}

export async function getTeamRecords(memberId: number, limit = 30) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(teamRecords)
    .where(eq(teamRecords.memberId, memberId))
    .orderBy(desc(teamRecords.date))
    .limit(limit);
}

export async function getTeamDashboard() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const today = new Date().toISOString().slice(0, 10);

  const members = await db.select().from(teamMembers).where(eq(teamMembers.active, 1));
  const allTasks = await db.select().from(teamTasks).where(eq(teamTasks.active, 1));
  const todayRecords = await db.select().from(teamRecords).where(eq(teamRecords.date, today));

  // Week records (last 7 days)
  const weekDates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    weekDates.push(d.toISOString().slice(0, 10));
  }
  const weekRecords = await db.select().from(teamRecords).where(
    sql`${teamRecords.date} >= ${weekDates[0]} AND ${teamRecords.date} <= ${weekDates[6]}`,
  );

  return members.map(member => {
    const memberTasks = allTasks.filter(t => t.memberId === member.id);
    const todayRecord = todayRecords.find(r => r.memberId === member.id);
    const memberWeek = weekDates.map(date => {
      const rec = weekRecords.find(r => r.memberId === member.id && r.date === date);
      return { date, status: rec?.status ?? "pendente" };
    });

    return {
      ...member,
      tasks: memberTasks,
      today: todayRecord ?? null,
      week: memberWeek,
    };
  });
}

export async function createTeamCharge(data: InsertTeamCharge) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(teamCharges).values(data);
}

// ── Catálogo ML ───────────────────────────────────────────────────────────────────────────
export async function listMLCatalogProducts(accountName?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (accountName) conditions.push(eq(mlCatalogProducts.accountName, accountName));
  const rows = conditions.length
    ? await db.select().from(mlCatalogProducts).where(and(...conditions)).orderBy(desc(mlCatalogProducts.updatedAt))
    : await db.select().from(mlCatalogProducts).orderBy(desc(mlCatalogProducts.updatedAt));
  return rows;
}

export async function upsertMLCatalogProduct(data: InsertMLCatalogProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(mlCatalogProducts).values(data).onDuplicateKeyUpdate({
    set: {
      title: sql`VALUES(title)`,
      accountName: sql`VALUES(accountName)`,
      imageUrl: sql`VALUES(imageUrl)`,
      salePrice: sql`VALUES(salePrice)`,
      status: sql`VALUES(status)`,
      lastSyncAt: sql`VALUES(lastSyncAt)`,
      updatedAt: sql`NOW()`,
    },
  });
}

export async function updateMLCatalogProductCosts(id: number, costPrice: string, packagingCost: string, platformFeePercent: string = "0", taxPercent: string = "0") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mlCatalogProducts).set({ costPrice, packagingCost, platformFeePercent, taxPercent }).where(eq(mlCatalogProducts.id, id));
}

export async function deleteMLCatalogProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(mlCatalogProducts).where(eq(mlCatalogProducts.id, id));
}

// ── Taxas de Marketplaces ─────────────────────────────────────────────────────
export async function listMarketplaceFees(marketplace?: "mercado_livre" | "shopee") {
  const db = await getDb();
  if (!db) return [];
  const rows = marketplace
    ? await db.select().from(marketplaceFees).where(eq(marketplaceFees.marketplace, marketplace)).orderBy(marketplaceFees.feeType, marketplaceFees.priceMin)
    : await db.select().from(marketplaceFees).orderBy(marketplaceFees.marketplace, marketplaceFees.feeType, marketplaceFees.priceMin);
  return rows;
}

export async function updateMarketplaceFee(id: number, patch: Partial<InsertMarketplaceFee>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(marketplaceFees).set(patch).where(eq(marketplaceFees.id, id));
}

export async function createMarketplaceFee(data: InsertMarketplaceFee) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [res] = await db.insert(marketplaceFees).values(data);
  return (res as any).insertId as number;
}

export async function deleteMarketplaceFee(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(marketplaceFees).where(eq(marketplaceFees.id, id));
}

// ── DRE Gerencial ─────────────────────────────────────────────────────────────
type FeeRow = typeof marketplaceFees.$inferSelect;

function findFee(
  fees: FeeRow[],
  marketplace: "mercado_livre" | "shopee",
  feeType: string,
  unitPrice: number,
): FeeRow | null {
  const candidates = fees.filter(f =>
    f.marketplace === marketplace && f.feeType === feeType && f.active === 1
  );
  for (const f of candidates) {
    const min = f.priceMin != null ? Number(f.priceMin) : -Infinity;
    const max = f.priceMax != null ? Number(f.priceMax) : Infinity;
    if (unitPrice >= min && unitPrice < max) return f;
  }
  if (candidates.length === 1 && candidates[0].priceMin == null && candidates[0].priceMax == null) {
    return candidates[0];
  }
  return null;
}

/**
 * Build a map (platform, accountName) → cnpjId using integrations table.
 * Slug conventions: "ml-<accountname-lower>", "shopee-<shopid>".
 * For Shopee, since multiple accountNames in orders may share one shopId,
 * we also register a wildcard `shopee::*` fallback.
 */
async function buildAccountCnpjMap(db: any): Promise<Map<string, number>> {
  const rows = await db
    .select({ slug: integrations.slug, cnpjId: integrations.cnpjId, accountId: integrations.accountId })
    .from(integrations)
    .where(isNotNull(integrations.cnpjId));
  const map = new Map<string, number>();
  for (const r of rows as any[]) {
    if (!r.cnpjId) continue;
    if (typeof r.slug === "string" && r.slug.startsWith("ml-") && r.accountId) {
      map.set(`ml::${String(r.accountId).toUpperCase()}`, r.cnpjId);
    } else if (typeof r.slug === "string" && r.slug.startsWith("shopee-")) {
      map.set("shopee::*", r.cnpjId);
    }
  }
  return map;
}

function cnpjIdForOrder(map: Map<string, number>, platform: string, accountName: string): number | null {
  if (platform === "ml") return map.get(`ml::${accountName.toUpperCase()}`) ?? null;
  if (platform === "shopee") {
    return map.get(`shopee::${accountName}`) ?? map.get("shopee::*") ?? null;
  }
  return null;
}

type CompanyAgg = {
  cnpjId: number | null;
  pedidos: number;
  unidades: number;
  receitaBruta: number;
  comissoes: number;
  taxasFixas: number;
  taxaTransacao: number;
  freteSeller: number;
  cmv: number;
  everton: number; // Comissão Everton (R$0,40 ou R$0,90 por peça)
  embalagem: number; // Custo de embalagem por peça (R$0,30 / 0,95 / 1,00 / 3,45)
  impostosFallback: number; // imposto calculado via products.imposto (fallback)
  impostosConfigurado: number; // imposto via company_tax_rates (quando cadastrado)
  difalTotal: number;
  rateUsada: number | null; // % efetivo aplicado
  rateFonte: "config" | "fallback";
};

async function computeRangeAggregate(
  db: any,
  start: Date,
  end: Date,
  fees: FeeRow[],
  products149: Record<string, any>,
  accountMap: Map<string, number>,
  taxRatesByCnpj: Map<number, any>,
  exceptionsByCnpj: Map<number, any[]>,
  mlCatalogByTitle: Map<string, any>,
  aliquotaEfetivaPctFallback: number,
) {
  const orders = await db
    .select({
      externalId: marketplaceOrders.externalId,
      platform: marketplaceOrders.platform,
      accountName: marketplaceOrders.accountName,
      quantity: marketplaceOrders.quantity,
      totalAmount: marketplaceOrders.totalAmount,
      productSku: marketplaceOrders.productSku,
      productName: marketplaceOrders.productName,
      buyerState: marketplaceOrders.buyerState,
      status: marketplaceOrders.status,
    })
    .from(marketplaceOrders)
    .where(
      and(
        sql`${marketplaceOrders.platformCreatedAt} >= ${start}`,
        sql`${marketplaceOrders.platformCreatedAt} < ${end}`,
        sql`${marketplaceOrders.status} NOT IN ('cancelled','to_return')`,
      ),
    );

  const mlOrderIds = (orders as any[])
    .filter((o) => o.platform === "ml")
    .map((o) => Number(String(o.externalId).replace(/^ML-/, "")))
    .filter((n) => Number.isFinite(n));

  let realFees = new Map<number, any>();
  if (mlOrderIds.length > 0) {
    const { getRealFeesByOrderIds } = await import("./mercadopago");
    realFees = await getRealFeesByOrderIds(mlOrderIds);
  }

  const agg = {
    pedidos: 0,
    unidades: 0,
    receitaBruta: { ml: 0, shopee: 0, total: 0 },
    comissoes: { ml: 0, shopee: 0, total: 0 },
    taxasFixas: { ml: 0, shopee: 0, total: 0 },
    taxaTransacao: { shopee: 0, total: 0 },
    freteSeller: { ml: 0, shopee: 0, total: 0 },
    cmv: { total: 0, matched: 0, missing: 0 },
    everton: { total: 0 },     // Comissão Everton (R$0,40 ou R$0,90 por peça vendida)
    embalagem: { total: 0 },   // Custo embalagem por categoria do título
    impostos: { total: 0, configurado: 0, fallback: 0, difal: 0 },
    frete: { total: 0 },
    feesSource: { mlReal: 0, mlEstimated: 0 },
    byCompany: new Map<string, CompanyAgg>(), // key = cnpjId ou "sem-empresa"
  };

  const getOrCreateCompany = (cnpjId: number | null): CompanyAgg => {
    const key = cnpjId == null ? "sem-empresa" : String(cnpjId);
    let entry = agg.byCompany.get(key);
    if (!entry) {
      entry = {
        cnpjId,
        pedidos: 0,
        unidades: 0,
        receitaBruta: 0,
        comissoes: 0,
        taxasFixas: 0,
        taxaTransacao: 0,
        freteSeller: 0,
        cmv: 0,
        everton: 0,
        embalagem: 0,
        impostosFallback: 0,
        impostosConfigurado: 0,
        difalTotal: 0,
        rateUsada: null,
        rateFonte: "fallback",
      };
      agg.byCompany.set(key, entry);
    }
    return entry;
  };

  const FRETE_COPART_SHOPEE_PCT = 0.25;
  const FRETE_MEDIO_ML_UNIT = 15.35;
  // Alíquota efetiva (calculada via Simples Anexo I + RBT12, ou override por empresa)
  const IMPOSTO_PCT_FALLBACK = aliquotaEfetivaPctFallback / 100;

  for (const o of orders as any[]) {
    agg.pedidos += 1;
    const qty = Number(o.quantity) || 1;
    agg.unidades += qty;
    const total = Number(o.totalAmount) || 0;
    const unit = total / qty;
    const plat = o.platform === "shopee" ? "shopee" : o.platform === "ml" ? "mercado_livre" : null;

    const cnpjId = cnpjIdForOrder(accountMap, String(o.platform), String(o.accountName ?? ""));
    const company = getOrCreateCompany(cnpjId);
    company.pedidos += 1;
    company.unidades += qty;

    let orderComissoes = 0;
    let orderTaxasFixas = 0;
    let orderTaxaTransacao = 0;
    let orderFreteSeller = 0;

    if (plat === "mercado_livre") {
      agg.receitaBruta.ml += total;
      company.receitaBruta += total;
      const orderIdNum = Number(String(o.externalId).replace(/^ML-/, ""));
      const real = realFees.get(orderIdNum);
      if (real) {
        orderComissoes = real.mlSaleFee;
        orderTaxasFixas = real.mpProcessingFee + real.mpFinancingFee + real.otherFees;
        orderFreteSeller = real.shippingAmount;
        agg.comissoes.ml += orderComissoes;
        agg.taxasFixas.ml += orderTaxasFixas;
        agg.freteSeller.ml += orderFreteSeller;
        agg.feesSource.mlReal += 1;
      } else {
        const commission = findFee(fees, "mercado_livre", "commission", unit);
        const comPct = commission ? Number(commission.percentage) / 100 : 0.13;
        orderComissoes = total * comPct;
        agg.comissoes.ml += orderComissoes;

        const fixed = findFee(fees, "mercado_livre", "fixed", unit);
        if (fixed) {
          orderTaxasFixas = Number(fixed.fixedAmount) * qty;
          agg.taxasFixas.ml += orderTaxasFixas;
        }

        if (unit >= 79) {
          orderFreteSeller = FRETE_MEDIO_ML_UNIT * qty;
          agg.freteSeller.ml += orderFreteSeller;
        }
        agg.feesSource.mlEstimated += 1;
      }
    } else if (plat === "shopee") {
      agg.receitaBruta.shopee += total;
      company.receitaBruta += total;
      const commission = findFee(fees, "shopee", "commission", unit);
      if (commission) {
        orderComissoes = total * (Number(commission.percentage) / 100);
        orderTaxasFixas = Number(commission.fixedAmount) * qty;
      } else {
        orderComissoes = total * 0.14;
        orderTaxasFixas = 20 * qty;
      }
      agg.comissoes.shopee += orderComissoes;
      agg.taxasFixas.shopee += orderTaxasFixas;
      orderTaxaTransacao = total * 0.02;
      agg.taxaTransacao.shopee += orderTaxaTransacao;
      orderFreteSeller = total * FRETE_COPART_SHOPEE_PCT * 0.2;
      agg.freteSeller.shopee += orderFreteSeller;
    }

    company.comissoes += orderComissoes;
    company.taxasFixas += orderTaxasFixas;
    company.taxaTransacao += orderTaxaTransacao;
    company.freteSeller += orderFreteSeller;

    const prod = o.productSku ? products149[o.productSku] : null;
    let orderCmv = 0;
    let orderImpostoFallback = 0;
    let orderEverton = 0;
    let orderEmbalagem = 0;
    let custoUnitResolvido = 0;
    let tituloRef = String(prod?.titulo ?? o.productName ?? "");

    if (prod && Number(prod.valorProduto) > 0) {
      // Caminho A: SKU bate em products
      custoUnitResolvido = Number(prod.valorProduto);
      orderEmbalagem = calcEmbalagem(tituloRef) * qty;
    } else if (o.productName) {
      // Caminho B: fallback via título exato em ml_catalog_products (cobre pedidos ML sem SKU)
      const mlc = mlCatalogByTitle.get(String(o.productName));
      if (mlc && Number(mlc.costPrice) > 0) {
        custoUnitResolvido = Number(mlc.costPrice);
        // Usa packagingCost cadastrado (já calculado pela regra de embalagem)
        const pkg = Number(mlc.packagingCost) || calcEmbalagem(String(o.productName));
        orderEmbalagem = pkg * qty;
        tituloRef = String(mlc.title || o.productName);
      }
    }

    if (custoUnitResolvido > 0) {
      orderCmv = custoUnitResolvido * qty;
      orderEverton = calcEverton(custoUnitResolvido) * qty;
      agg.cmv.total += orderCmv;
      agg.cmv.matched += 1;
    } else {
      agg.cmv.missing += 1;
      // Sem custo: ainda detecta embalagem pelo título do pedido
      orderEmbalagem = calcEmbalagem(tituloRef) * qty;
    }

    // Imposto: sempre alíquota efetiva sobre receita (Simples Anexo I padronizado)
    orderImpostoFallback = total * IMPOSTO_PCT_FALLBACK;

    agg.everton.total += orderEverton;
    agg.embalagem.total += orderEmbalagem;
    company.cmv += orderCmv;
    company.everton += orderEverton;
    company.embalagem += orderEmbalagem;
    company.impostosFallback += orderImpostoFallback;

    // Aplicar exceções DIFAL/ST por UF destino (se empresa vinculada tem UF origem diferente)
    if (cnpjId != null && o.buyerState) {
      const excs = exceptionsByCnpj.get(cnpjId) ?? [];
      for (const exc of excs) {
        if (exc.exceptionType === "difal" && exc.ufDestino && String(exc.ufDestino).toUpperCase() === String(o.buyerState).toUpperCase().substring(0, 2)) {
          company.difalTotal += total * (Number(exc.rate) / 100);
          agg.impostos.difal += total * (Number(exc.rate) / 100);
          break;
        }
      }
    }
  }

  // Aplicar alíquota configurada por empresa (substitui fallback quando existe)
  for (const company of Array.from(agg.byCompany.values())) {
    if (company.cnpjId != null) {
      const rate = taxRatesByCnpj.get(company.cnpjId);
      if (rate && Number(rate.effectiveRate) > 0) {
        company.rateUsada = Number(rate.effectiveRate);
        company.rateFonte = "config";
        company.impostosConfigurado = company.receitaBruta * (Number(rate.effectiveRate) / 100);
        agg.impostos.configurado += company.impostosConfigurado;
        agg.impostos.total += company.impostosConfigurado;
        continue;
      }
    }
    company.rateFonte = "fallback";
    agg.impostos.fallback += company.impostosFallback;
    agg.impostos.total += company.impostosFallback;
  }
  agg.impostos.total += agg.impostos.difal;

  agg.receitaBruta.total = agg.receitaBruta.ml + agg.receitaBruta.shopee;
  agg.comissoes.total = agg.comissoes.ml + agg.comissoes.shopee;
  agg.taxasFixas.total = agg.taxasFixas.ml + agg.taxasFixas.shopee;
  agg.taxaTransacao.total = agg.taxaTransacao.shopee;
  agg.freteSeller.total = agg.freteSeller.ml + agg.freteSeller.shopee;
  return agg;
}

export async function getDreGerencial(input: {
  year?: number;
  month?: number;
  start?: Date;
  end?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Resolver range. Prioriza start/end; senão usa year/month como mês inteiro.
  let start: Date;
  let end: Date;
  if (input.start && input.end) {
    start = input.start;
    end = input.end;
  } else if (input.year && input.month) {
    start = new Date(input.year, input.month - 1, 1);
    end = new Date(input.year, input.month, 1);
  } else {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  // Período anterior = mesmo tamanho deslocado pra trás
  const rangeMs = end.getTime() - start.getTime();
  const prevEnd = start;
  const prevStart = new Date(start.getTime() - rangeMs);

  // Para taxas/alíquotas usamos o mês do meio do range (heurística simples)
  const midPoint = new Date(start.getTime() + rangeMs / 2);
  const year = midPoint.getFullYear();
  const month = midPoint.getMonth() + 1;
  const prevMid = new Date(prevStart.getTime() + rangeMs / 2);
  const prevYear = prevMid.getFullYear();
  const prevMonth = prevMid.getMonth() + 1;

  const fees = (await db.select().from(marketplaceFees)) as FeeRow[];
  const allProducts = await db
    .select({
      sku: products.sku,
      titulo: products.titulo,
      valorProduto: products.valorProduto,
      imposto: products.imposto,
      comissao: products.comissao,
    })
    .from(products)
    .where(eq(products.isActive, 1));
  const productsBySku: Record<string, any> = {};
  for (const p of allProducts as any[]) productsBySku[p.sku] = p;

  // Mapa de fallback: título → ml_catalog_products (cobre pedidos ML sem productSku populado)
  const mlCatalogRows = await db
    .select({
      title: mlCatalogProducts.title,
      costPrice: mlCatalogProducts.costPrice,
      packagingCost: mlCatalogProducts.packagingCost,
    })
    .from(mlCatalogProducts);
  const mlCatalogByTitle = new Map<string, any>();
  for (const m of mlCatalogRows as any[]) {
    if (m.title && Number(m.costPrice) > 0) {
      // Se há duplicidade de título, mantém a primeira (todas devem ter o mesmo costPrice por matching tipo+modelo)
      if (!mlCatalogByTitle.has(m.title)) mlCatalogByTitle.set(m.title, m);
    }
  }

  const accountMap = await buildAccountCnpjMap(db);

  // ===== RBT12 + alíquota efetiva Simples Anexo I =====
  // Calcula receita bruta dos últimos 12 meses contados a partir do FIM do período corrente.
  const rbt12RowsCurrent = await db
    .select({
      rbt12: sql<string>`coalesce(sum(${marketplaceOrders.totalAmount}), 0)`,
    })
    .from(marketplaceOrders)
    .where(
      and(
        sql`${marketplaceOrders.platformCreatedAt} >= ${new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000)}`,
        sql`${marketplaceOrders.platformCreatedAt} < ${end}`,
        sql`${marketplaceOrders.status} NOT IN ('cancelled','to_return')`,
      ),
    );
  const rbt12Current = Number(rbt12RowsCurrent[0]?.rbt12 ?? 0);
  const aliqCurrent = aliquotaEfetivaSimples(rbt12Current);

  const rbt12RowsPrev = await db
    .select({
      rbt12: sql<string>`coalesce(sum(${marketplaceOrders.totalAmount}), 0)`,
    })
    .from(marketplaceOrders)
    .where(
      and(
        sql`${marketplaceOrders.platformCreatedAt} >= ${new Date(prevEnd.getTime() - 365 * 24 * 60 * 60 * 1000)}`,
        sql`${marketplaceOrders.platformCreatedAt} < ${prevEnd}`,
        sql`${marketplaceOrders.status} NOT IN ('cancelled','to_return')`,
      ),
    );
  const rbt12Previous = Number(rbt12RowsPrev[0]?.rbt12 ?? 0);
  const aliqPrevious = aliquotaEfetivaSimples(rbt12Previous);

  const ratesRows = await db
    .select()
    .from(companyTaxRates)
    .where(
      or(
        and(eq(companyTaxRates.year, year), eq(companyTaxRates.month, month)),
        and(eq(companyTaxRates.year, prevYear), eq(companyTaxRates.month, prevMonth)),
      ),
    );
  const ratesCurrent = new Map<number, any>();
  const ratesPrevious = new Map<number, any>();
  for (const r of ratesRows as any[]) {
    if (r.year === year && r.month === month) ratesCurrent.set(r.cnpjId, r);
    else if (r.year === prevYear && r.month === prevMonth) ratesPrevious.set(r.cnpjId, r);
  }

  const exceptionsRows = await db.select().from(companyTaxExceptions);
  const exceptionsByCnpj = new Map<number, any[]>();
  for (const e of exceptionsRows as any[]) {
    const list = exceptionsByCnpj.get(e.cnpjId) ?? [];
    list.push(e);
    exceptionsByCnpj.set(e.cnpjId, list);
  }

  // dateSource toggle (atualmente usa platformCreatedAt em ambos os casos;
  // quando a integração fiscal expuser invoiceDate, o modo 'invoice' passa a usá-lo)
  const dateSourceRow = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "dateSource"))
    .limit(1);
  const dateSource = (dateSourceRow[0]?.value ?? "sale") as "sale" | "invoice";

  const [current, previous] = await Promise.all([
    computeRangeAggregate(db, start, end, fees, productsBySku, accountMap, ratesCurrent, exceptionsByCnpj, mlCatalogByTitle, aliqCurrent.efetivaPct),
    computeRangeAggregate(db, prevStart, prevEnd, fees, productsBySku, accountMap, ratesPrevious, exceptionsByCnpj, mlCatalogByTitle, aliqPrevious.efetivaPct),
  ]);

  const fixedCostsRows = await db
    .select({ amount: fixedCosts.amount })
    .from(fixedCosts)
    .where(eq(fixedCosts.isActive, 1));
  const despesasOperacionais = fixedCostsRows.reduce(
    (s: number, r: any) => s + Number(r.amount),
    0,
  );

  // Carregar dados das empresas (para labels no UI)
  const cnpjRows = await db.select().from(myCnpjs).where(eq(myCnpjs.isActive, 1));
  const cnpjsById = new Map<number, any>();
  for (const c of cnpjRows as any[]) cnpjsById.set(c.id, c);

  const build = (agg: Awaited<ReturnType<typeof computeRangeAggregate>>) => {
    const totalDeducoes =
      agg.comissoes.total +
      agg.taxasFixas.total +
      agg.taxaTransacao.total +
      agg.freteSeller.total;
    const receitaLiquida = agg.receitaBruta.total - totalDeducoes - agg.impostos.total;
    const lucroBruto = receitaLiquida - agg.cmv.total;
    // Margem de contribuição = lucro bruto - custos variáveis diretos (Everton + Embalagem)
    const custosVariaveisDiretos = agg.everton.total + agg.embalagem.total;
    const margemContribuicao = lucroBruto - custosVariaveisDiretos;
    const lucroOperacional = margemContribuicao - despesasOperacionais;

    // Serializar breakdown por empresa
    const byCompany = Array.from(agg.byCompany.values()).map(c => {
      const cnpj = c.cnpjId != null ? cnpjsById.get(c.cnpjId) : null;
      const impostoAplicado = c.rateFonte === "config" ? c.impostosConfigurado : c.impostosFallback;
      const totalDeducoesEmpresa = c.comissoes + c.taxasFixas + c.taxaTransacao + c.freteSeller;
      const receitaLiquidaEmpresa = c.receitaBruta - totalDeducoesEmpresa - impostoAplicado - c.difalTotal;
      const lucroBrutoEmpresa = receitaLiquidaEmpresa - c.cmv;
      const margemContribuicaoEmpresa = lucroBrutoEmpresa - c.everton - c.embalagem;
      return {
        cnpjId: c.cnpjId,
        razaoSocial: cnpj?.razaoSocial ?? null,
        nomeFantasia: cnpj?.nomeFantasia ?? null,
        regime: cnpj?.regime ?? null,
        ufOrigem: cnpj?.ufOrigem ?? null,
        pedidos: c.pedidos,
        unidades: c.unidades,
        receitaBruta: c.receitaBruta,
        comissoes: c.comissoes,
        taxasFixas: c.taxasFixas,
        taxaTransacao: c.taxaTransacao,
        freteSeller: c.freteSeller,
        cmv: c.cmv,
        everton: c.everton,
        embalagem: c.embalagem,
        impostoAplicado,
        difalTotal: c.difalTotal,
        rateUsada: c.rateUsada,
        rateFonte: c.rateFonte,
        receitaLiquida: receitaLiquidaEmpresa,
        lucroBruto: lucroBrutoEmpresa,
        margemContribuicao: margemContribuicaoEmpresa,
      };
    }).sort((a, b) => b.receitaBruta - a.receitaBruta);

    const byCompanyObj = {
      items: byCompany,
      empresasVinculadas: byCompany.filter(c => c.cnpjId != null).length,
      pedidosSemEmpresa: byCompany.find(c => c.cnpjId == null)?.pedidos ?? 0,
    };

    const { byCompany: _omitBC, ...rest } = agg;
    return {
      ...rest,
      totalDeducoes,
      receitaLiquida,
      lucroBruto,
      custosVariaveisDiretos,
      margemContribuicao,
      lucroOperacional,
      despesasOperacionais,
      byCompany: byCompanyObj,
    };
  };

  return {
    year,
    month,
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
      prevStart: prevStart.toISOString(),
      prevEnd: prevEnd.toISOString(),
      days: Math.round(rangeMs / (1000 * 60 * 60 * 24)),
    },
    dateSource,
    current: build(current),
    previous: build(previous),
    despesasOperacionaisCadastradas: fixedCostsRows.length,
    aliquotaSimples: {
      current: aliqCurrent,
      previous: aliqPrevious,
      fonte: "calculo_simples_anexo_I",
    },
  };
}

/* ── System Settings helpers ───────────────────────────────────────────── */

export async function getSystemSetting(key: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  return rows[0] ?? null;
}

export async function getAllSystemSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemSettings).orderBy(systemSettings.key);
}

export async function setSystemSetting(key: string, value: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  if (existing[0]) {
    await db.update(systemSettings).set({ value, description: description ?? existing[0].description }).where(eq(systemSettings.key, key));
  } else {
    await db.insert(systemSettings).values({ key, value, description: description ?? null });
  }
  return getSystemSetting(key);
}

/* ── Integrations linkCompany helper ───────────────────────────────────── */

export async function setIntegrationCnpj(slug: string, cnpjId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(integrations).set({ cnpjId }).where(eq(integrations.slug, slug));
}

/* ── Company Tax Rates helpers ─────────────────────────────────────────── */

export async function listCompanyTaxRates(cnpjId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(companyTaxRates)
    .where(eq(companyTaxRates.cnpjId, cnpjId))
    .orderBy(desc(companyTaxRates.year), desc(companyTaxRates.month));
}

export async function upsertCompanyTaxRate(input: InsertCompanyTaxRate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select()
    .from(companyTaxRates)
    .where(
      and(
        eq(companyTaxRates.cnpjId, input.cnpjId),
        eq(companyTaxRates.year, input.year),
        eq(companyTaxRates.month, input.month),
      ),
    )
    .limit(1);
  if (existing[0]) {
    await db.update(companyTaxRates).set(input).where(eq(companyTaxRates.id, existing[0].id));
    return { ...existing[0], ...input };
  }
  const result = await db.insert(companyTaxRates).values(input).$returningId();
  const id = result[0]?.id ?? 0;
  const rows = await db.select().from(companyTaxRates).where(eq(companyTaxRates.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteCompanyTaxRate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(companyTaxRates).where(eq(companyTaxRates.id, id));
}

/* ── Company Tax Exceptions helpers ────────────────────────────────────── */

export async function listCompanyTaxExceptions(cnpjId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(companyTaxExceptions)
    .where(eq(companyTaxExceptions.cnpjId, cnpjId))
    .orderBy(desc(companyTaxExceptions.validFrom));
}

export async function createCompanyTaxException(input: InsertCompanyTaxException) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(companyTaxExceptions).values(input).$returningId();
  const id = result[0]?.id ?? 0;
  const rows = await db.select().from(companyTaxExceptions).where(eq(companyTaxExceptions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateCompanyTaxException(id: number, data: Partial<InsertCompanyTaxException>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(companyTaxExceptions).set(data).where(eq(companyTaxExceptions.id, id));
  const rows = await db.select().from(companyTaxExceptions).where(eq(companyTaxExceptions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteCompanyTaxException(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(companyTaxExceptions).where(eq(companyTaxExceptions.id, id));
}

// ── Product Brands ────────────────────────────────────────────────────────
export async function listProductBrands() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productBrands).orderBy(productBrands.name);
}

export async function createProductBrand(data: InsertProductBrand) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [res] = await db.insert(productBrands).values(data);
  return (res as any).insertId as number;
}

export async function updateProductBrand(id: number, patch: Partial<InsertProductBrand>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productBrands).set(patch).where(eq(productBrands.id, id));
}

export async function deleteProductBrand(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(productBrands).where(eq(productBrands.id, id));
}

// ── Product Categories ───────────────────────────────────────────────────
export async function listProductCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productCategories).orderBy(productCategories.name);
}

export async function createProductCategory(data: InsertProductCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [res] = await db.insert(productCategories).values(data);
  return (res as any).insertId as number;
}

export async function updateProductCategory(id: number, patch: Partial<InsertProductCategory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productCategories).set(patch).where(eq(productCategories.id, id));
}

export async function deleteProductCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(productCategories).where(eq(productCategories.id, id));
}

// ── Product Warehouses ───────────────────────────────────────────────────
export async function listProductWarehouses() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productWarehouses).orderBy(desc(productWarehouses.isDefault), productWarehouses.name);
}

export async function createProductWarehouse(data: InsertProductWarehouse) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [res] = await db.insert(productWarehouses).values(data);
  return (res as any).insertId as number;
}

export async function updateProductWarehouse(id: number, patch: Partial<InsertProductWarehouse>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productWarehouses).set(patch).where(eq(productWarehouses.id, id));
}

export async function deleteProductWarehouse(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(productWarehouses).where(eq(productWarehouses.id, id));
}

// ── Cost / Sale History ──────────────────────────────────────────────────
export async function listProductCostHistory(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productCostHistory)
    .where(eq(productCostHistory.productId, productId))
    .orderBy(desc(productCostHistory.validFrom), desc(productCostHistory.id));
}

export async function createProductCostHistory(data: InsertProductCostHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [res] = await db.insert(productCostHistory).values(data);
  return (res as any).insertId as number;
}

export async function listProductSaleHistory(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productSaleHistory)
    .where(eq(productSaleHistory.productId, productId))
    .orderBy(desc(productSaleHistory.validFrom), desc(productSaleHistory.id));
}

export async function createProductSaleHistory(data: InsertProductSaleHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [res] = await db.insert(productSaleHistory).values(data);
  return (res as any).insertId as number;
}

// ── Fixed Costs por produto ──────────────────────────────────────────────
export async function listProductFixedCosts(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productFixedCosts)
    .where(eq(productFixedCosts.productId, productId))
    .orderBy(productFixedCosts.label);
}

export async function createProductFixedCost(data: InsertProductFixedCost) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [res] = await db.insert(productFixedCosts).values(data);
  return (res as any).insertId as number;
}

export async function updateProductFixedCost(id: number, patch: Partial<InsertProductFixedCost>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productFixedCosts).set(patch).where(eq(productFixedCosts.id, id));
}

export async function deleteProductFixedCost(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(productFixedCosts).where(eq(productFixedCosts.id, id));
}

// ── Multi-warehouse stocks ───────────────────────────────────────────────
export async function listProductStocks(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productStocks).where(eq(productStocks.productId, productId));
}

export async function upsertProductStock(data: InsertProductStock) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(productStocks)
    .where(and(eq(productStocks.productId, data.productId), eq(productStocks.warehouseId, data.warehouseId)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(productStocks).set(data).where(eq(productStocks.id, existing[0].id));
    return existing[0].id;
  }
  const [res] = await db.insert(productStocks).values(data);
  return (res as any).insertId as number;
}

// ── Kit items ────────────────────────────────────────────────────────────
export async function listProductKitItems(kitProductId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productKitItems).where(eq(productKitItems.kitProductId, kitProductId));
}

export async function addProductKitItem(data: InsertProductKitItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [res] = await db.insert(productKitItems).values(data);
  return (res as any).insertId as number;
}

export async function removeProductKitItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(productKitItems).where(eq(productKitItems.id, id));
}
