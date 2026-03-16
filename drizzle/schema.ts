import {
  bigint,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const productUploads = mysqlTable("product_uploads", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  originalFileKey: varchar("originalFileKey", { length: 512 }).notNull(),
  originalFileUrl: text("originalFileUrl").notNull(),
  fileHash: varchar("fileHash", { length: 128 }),
  sourceSheetName: varchar("sourceSheetName", { length: 128 }).notNull().default("Tabela"),
  importedRows: int("importedRows").notNull().default(0),
  uploadedByUserId: int("uploadedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  uploadId: int("uploadId"),
  sku: varchar("sku", { length: 128 }).notNull().unique(),
  titulo: text("titulo").notNull(),
  tabelaNovaCk: decimal("tabelaNovaCk", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  imposto: decimal("imposto", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  comissao: decimal("comissao", { precision: 14, scale: 4 }).notNull().default("0.7500"),
  valorProduto: decimal("valorProduto", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  precoDesejado: decimal("precoDesejado", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  margemDesejada: decimal("margemDesejada", { precision: 14, scale: 6 }),
  precoFinal: decimal("precoFinal", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  margemFinal: decimal("margemFinal", { precision: 14, scale: 6 }).notNull().default("0.000000"),
  lucro: decimal("lucro", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  isActive: int("isActive").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  reference: varchar("reference", { length: 255 }),
  document: varchar("document", { length: 64 }),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 320 }),
  city: varchar("city", { length: 160 }),
  state: varchar("state", { length: 80 }),
  notes: text("notes"),
  isActive: int("isActive").notNull().default(1),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId"),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerReference: varchar("customerReference", { length: 255 }),
  orderType: mysqlEnum("orderType", ["customer", "personal"]).default("customer").notNull(),
  status: mysqlEnum("status", ["draft", "created", "finalized", "cancelled"]).default("draft").notNull(),
  periodYear: int("periodYear").notNull(),
  periodMonth: int("periodMonth").notNull(),
  notes: text("notes"),
  totalCliente: decimal("totalCliente", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  totalMondial: decimal("totalMondial", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  totalComissaoEvertonMondial: decimal("totalComissaoEvertonMondial", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  totalLucro: decimal("totalLucro", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  margemPedido: decimal("margemPedido", { precision: 14, scale: 6 }).notNull().default("0.000000"),
  totalItens: int("totalItens").notNull().default(0),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  finalizedAt: timestamp("finalizedAt"),
});

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId"),
  sku: varchar("sku", { length: 128 }).notNull(),
  titulo: text("titulo").notNull(),
  quantidade: int("quantidade").notNull().default(1),
  tabelaNovaCk: decimal("tabelaNovaCk", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  imposto: decimal("imposto", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  comissao: decimal("comissao", { precision: 14, scale: 4 }).notNull().default("0.7500"),
  valorProduto: decimal("valorProduto", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  precoDesejado: decimal("precoDesejado", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  precoFinal: decimal("precoFinal", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  margemFinal: decimal("margemFinal", { precision: 14, scale: 6 }).notNull().default("0.000000"),
  lucroUnitario: decimal("lucroUnitario", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  totalCliente: decimal("totalCliente", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  totalMondial: decimal("totalMondial", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  totalComissaoEvertonMondial: decimal("totalComissaoEvertonMondial", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  totalLucro: decimal("totalLucro", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const monthlySnapshots = mysqlTable("monthly_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  periodYear: int("periodYear").notNull(),
  periodMonth: int("periodMonth").notNull(),
  totalPedidos: int("totalPedidos").notNull().default(0),
  totalPedidosCliente: int("totalPedidosCliente").notNull().default(0),
  totalPedidosPessoais: int("totalPedidosPessoais").notNull().default(0),
  totalCliente: decimal("totalCliente", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  totalMondial: decimal("totalMondial", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  totalComprasPessoais: decimal("totalComprasPessoais", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  totalVendasClientes: decimal("totalVendasClientes", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  totalComissaoEvertonMondial: decimal("totalComissaoEvertonMondial", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  totalLucro: decimal("totalLucro", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  margemMedia: decimal("margemMedia", { precision: 14, scale: 6 }).notNull().default("0.000000"),
  atualizadoEm: bigint("atualizadoEm", { mode: "number", unsigned: true }).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ProductUpload = typeof productUploads.$inferSelect;
export type InsertProductUpload = typeof productUploads.$inferInsert;
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;
export type MonthlySnapshot = typeof monthlySnapshots.$inferSelect;
export type InsertMonthlySnapshot = typeof monthlySnapshots.$inferInsert;
