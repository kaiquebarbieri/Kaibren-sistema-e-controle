import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  customers,
  InsertCustomer,
  InsertMonthlySnapshot,
  InsertOrder,
  InsertOrderItem,
  InsertProduct,
  InsertProductUpload,
  InsertUser,
  monthlySnapshots,
  orderItems,
  orders,
  productUploads,
  products,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
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

  await db.delete(products);
  await db.insert(products).values(items);
  return { inserted: items.length };
}

export async function getLatestProductUpload() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(productUploads).orderBy(desc(productUploads.createdAt)).limit(1);
  return rows[0] ?? null;
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
