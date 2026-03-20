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
  inscricaoEstadual: varchar("inscricaoEstadual", { length: 64 }),
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
  campaignId: int("campaignId"),
  cnpjId: int("cnpjId"),
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

/* ── Marketing Campaigns ── */

export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  /** promotional | launch | seasonal | flash_sale | loyalty */
  campaignType: mysqlEnum("campaignType", ["promotional", "launch", "seasonal", "flash_sale", "loyalty"]).default("promotional").notNull(),
  /** draft | scheduled | active | completed | cancelled */
  status: mysqlEnum("status", ["draft", "scheduled", "active", "completed", "cancelled"]).default("draft").notNull(),
  /** Discount text e.g. "20% OFF", "Compre 2 leve 3" */
  discountLabel: varchar("discountLabel", { length: 255 }),
  /** Discount percentage if applicable */
  discountPercent: decimal("discountPercent", { precision: 5, scale: 2 }),
  /** Banner/creative image URL (stored in S3) */
  bannerUrl: text("bannerUrl"),
  bannerFileKey: varchar("bannerFileKey", { length: 512 }),
  /** WhatsApp message template */
  messageTemplate: text("messageTemplate"),
  /** Scheduled send date (UTC timestamp ms) */
  scheduledAt: bigint("scheduledAt", { mode: "number", unsigned: true }),
  /** When the campaign was actually sent */
  sentAt: bigint("sentAt", { mode: "number", unsigned: true }),
  /** Stats */
  totalSent: int("totalSent").notNull().default(0),
  totalDelivered: int("totalDelivered").notNull().default(0),
  totalClicked: int("totalClicked").notNull().default(0),
  totalConverted: int("totalConverted").notNull().default(0),
  totalRevenue: decimal("totalRevenue", { precision: 14, scale: 4 }).notNull().default("0.0000"),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Products featured in a campaign */
export const campaignProducts = mysqlTable("campaign_products", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  productId: int("productId").notNull(),
  /** Optional promotional price override */
  promoPrice: decimal("promoPrice", { precision: 14, scale: 4 }),
  /** Original price at time of campaign creation */
  originalPrice: decimal("originalPrice", { precision: 14, scale: 4 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Individual messages sent to customers */
export const campaignMessages = mysqlTable("campaign_messages", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  customerId: int("customerId").notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 64 }),
  /** sent | delivered | clicked | converted */
  status: mysqlEnum("status", ["pending", "sent", "delivered", "clicked", "converted"]).default("pending").notNull(),
  /** Unique tracking code for this message */
  trackingCode: varchar("trackingCode", { length: 64 }).notNull().unique(),
  /** When the customer clicked the link */
  clickedAt: bigint("clickedAt", { mode: "number", unsigned: true }),
  /** Order ID if converted */
  convertedOrderId: int("convertedOrderId"),
  convertedAt: bigint("convertedAt", { mode: "number", unsigned: true }),
  sentAt: bigint("sentAt", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;
export type CampaignProduct = typeof campaignProducts.$inferSelect;
export type InsertCampaignProduct = typeof campaignProducts.$inferInsert;
export type CampaignMessage = typeof campaignMessages.$inferSelect;
export type InsertCampaignMessage = typeof campaignMessages.$inferInsert;

/* ── Marketing Strategies (mental triggers) ── */

export const marketingStrategies = mysqlTable("marketing_strategies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  triggerType: varchar("triggerType", { length: 128 }).notNull(),
  description: text("description").notNull(),
  exampleMessage: text("exampleMessage").notNull(),
  emoji: varchar("emoji", { length: 16 }).notNull().default(""),
  sortOrder: int("sortOrder").notNull().default(0),
  isActive: int("isActive").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MarketingStrategy = typeof marketingStrategies.$inferSelect;
export type InsertMarketingStrategy = typeof marketingStrategies.$inferInsert;

/* ── Meus CNPJs (compras pessoais) ── */

export const myCnpjs = mysqlTable("my_cnpjs", {
  id: int("id").autoincrement().primaryKey(),
  razaoSocial: varchar("razaoSocial", { length: 255 }).notNull(),
  cnpj: varchar("cnpj", { length: 32 }).notNull().unique(),
  nomeFantasia: varchar("nomeFantasia", { length: 255 }),
  inscricaoEstadual: varchar("inscricaoEstadual", { length: 64 }),
  notes: text("notes"),
  isActive: int("isActive").notNull().default(1),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MyCnpj = typeof myCnpjs.$inferSelect;
export type InsertMyCnpj = typeof myCnpjs.$inferInsert;

/* ── Extratos Bancários ── */

export const bankStatements = mysqlTable("bank_statements", {
  id: int("id").autoincrement().primaryKey(),
  /** Nome do banco (ex: Nubank, Itaú, Bradesco) */
  bankName: varchar("bankName", { length: 128 }).notNull(),
  /** Mês de referência */
  periodMonth: int("periodMonth").notNull(),
  /** Ano de referência */
  periodYear: int("periodYear").notNull(),
  /** Nome original do arquivo PDF */
  fileName: varchar("fileName", { length: 255 }).notNull(),
  /** Chave S3 do arquivo original */
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  /** URL do arquivo no S3 */
  fileUrl: text("fileUrl").notNull(),
  /** Total de transações extraídas */
  totalTransactions: int("totalTransactions").notNull().default(0),
  /** Total de transações já identificadas pelo usuário */
  totalIdentified: int("totalIdentified").notNull().default(0),
  /** Saldo inicial do período (se disponível) */
  saldoInicial: decimal("saldoInicial", { precision: 14, scale: 2 }),
  /** Saldo final do período (se disponível) */
  saldoFinal: decimal("saldoFinal", { precision: 14, scale: 2 }),
  /** Status: pending (aguardando identificação), partial, completed */
  status: mysqlEnum("status", ["pending", "partial", "completed"]).default("pending").notNull(),
  /** Observações */
  notes: text("notes"),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const bankTransactions = mysqlTable("bank_transactions", {
  id: int("id").autoincrement().primaryKey(),
  /** FK para o extrato */
  statementId: int("statementId").notNull(),
  /** Data do lançamento (DD/MM) */
  transactionDate: varchar("transactionDate", { length: 20 }).notNull(),
  /** Data contábil (DD/MM) */
  accountingDate: varchar("accountingDate", { length: 20 }),
  /** Tipo da transação conforme banco (Pagamento, Saída PIX, Entrada PIX, etc.) */
  bankType: varchar("bankType", { length: 128 }),
  /** Descrição original do banco */
  originalDescription: text("originalDescription").notNull(),
  /** Valor (positivo = entrada, negativo = saída) */
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  /** Tipo: credit (entrada) ou debit (saída) */
  transactionType: mysqlEnum("transactionType", ["credit", "debit"]).default("debit").notNull(),
  /** Categoria identificada pelo usuário */
  category: varchar("category", { length: 128 }),
  /** Descrição/identificação do usuário (do que se trata o pagamento) */
  userDescription: text("userDescription"),
  /** Se já foi identificado pelo usuário */
  isIdentified: int("isIdentified").notNull().default(0),
  /** Observações adicionais */
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BankStatement = typeof bankStatements.$inferSelect;
export type InsertBankStatement = typeof bankStatements.$inferInsert;
export type BankTransaction = typeof bankTransactions.$inferSelect;
export type InsertBankTransaction = typeof bankTransactions.$inferInsert;

/* ── Financeiro: Custos Fixos ── */

export const fixedCosts = mysqlTable("fixed_costs", {
  id: int("id").autoincrement().primaryKey(),
  /** Nome do custo fixo (ex: Aluguel, Internet, Contador) */
  name: varchar("name", { length: 255 }).notNull(),
  /** Categoria: aluguel, internet, telefone, contador, energia, agua, software, seguro, outros */
  category: varchar("category", { length: 128 }).notNull().default("outros"),
  /** Valor mensal */
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  /** Dia do vencimento (1-31) */
  dueDay: int("dueDay").notNull().default(1),
  /** Se está ativo (recorrente) */
  isActive: int("isActive").notNull().default(1),
  /** Observações */
  notes: text("notes"),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Registro mensal de pagamento de custo fixo */
export const fixedCostPayments = mysqlTable("fixed_cost_payments", {
  id: int("id").autoincrement().primaryKey(),
  fixedCostId: int("fixedCostId").notNull(),
  periodYear: int("periodYear").notNull(),
  periodMonth: int("periodMonth").notNull(),
  /** Valor efetivamente pago (pode diferir do padrão) */
  amountPaid: decimal("amountPaid", { precision: 14, scale: 2 }).notNull(),
  /** pago | pendente | atrasado */
  status: mysqlEnum("status", ["paid", "pending", "overdue"]).default("pending").notNull(),
  paidAt: timestamp("paidAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* ── Financeiro: Cartões de Crédito ── */

export const creditCards = mysqlTable("credit_cards", {
  id: int("id").autoincrement().primaryKey(),
  /** Nome/apelido do cartão (ex: Nubank, C6 Empresarial) */
  name: varchar("name", { length: 255 }).notNull(),
  /** Bandeira: visa, mastercard, elo, amex, outros */
  brand: varchar("brand", { length: 64 }).notNull().default("outros"),
  /** Últimos 4 dígitos */
  lastFourDigits: varchar("lastFourDigits", { length: 4 }),
  /** Dia de fechamento da fatura */
  closingDay: int("closingDay").notNull().default(1),
  /** Dia de vencimento da fatura */
  dueDay: int("dueDay").notNull().default(10),
  /** Limite do cartão */
  creditLimit: decimal("creditLimit", { precision: 14, scale: 2 }),
  isActive: int("isActive").notNull().default(1),
  notes: text("notes"),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Faturas mensais do cartão de crédito */
export const creditCardInvoices = mysqlTable("credit_card_invoices", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull(),
  periodYear: int("periodYear").notNull(),
  periodMonth: int("periodMonth").notNull(),
  /** Valor total da fatura */
  totalAmount: decimal("totalAmount", { precision: 14, scale: 2 }).notNull(),
  /** Valor mínimo */
  minimumAmount: decimal("minimumAmount", { precision: 14, scale: 2 }),
  /** Valor pago */
  amountPaid: decimal("amountPaid", { precision: 14, scale: 2 }),
  /** pago | pendente | parcial */
  status: mysqlEnum("status", ["paid", "pending", "partial"]).default("pending").notNull(),
  paidAt: timestamp("paidAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/* ── Financeiro: Empréstimos ── */

export const loans = mysqlTable("loans", {
  id: int("id").autoincrement().primaryKey(),
  /** Nome/descrição do empréstimo (ex: Empréstimo C6, Capital de Giro Itaú) */
  name: varchar("name", { length: 255 }).notNull(),
  /** Instituição financeira */
  institution: varchar("institution", { length: 255 }).notNull(),
  /** Valor total do empréstimo */
  totalAmount: decimal("totalAmount", { precision: 14, scale: 2 }).notNull(),
  /** Número total de parcelas */
  totalInstallments: int("totalInstallments").notNull(),
  /** Valor da parcela mensal */
  installmentAmount: decimal("installmentAmount", { precision: 14, scale: 2 }).notNull(),
  /** Taxa de juros mensal (%) */
  interestRate: decimal("interestRate", { precision: 8, scale: 4 }),
  /** Data de início (primeiro pagamento) */
  startDate: varchar("startDate", { length: 10 }).notNull(),
  /** Dia de vencimento da parcela */
  dueDay: int("dueDay").notNull().default(1),
  /** ativo | quitado */
  status: mysqlEnum("status", ["active", "paid_off"]).default("active").notNull(),
  isActive: int("isActive").notNull().default(1),
  notes: text("notes"),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Parcelas do empréstimo */
export const loanInstallments = mysqlTable("loan_installments", {
  id: int("id").autoincrement().primaryKey(),
  loanId: int("loanId").notNull(),
  /** Número da parcela (1, 2, 3...) */
  installmentNumber: int("installmentNumber").notNull(),
  periodYear: int("periodYear").notNull(),
  periodMonth: int("periodMonth").notNull(),
  /** Valor da parcela */
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  /** pago | pendente | atrasado */
  status: mysqlEnum("status", ["paid", "pending", "overdue"]).default("pending").notNull(),
  paidAt: timestamp("paidAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FixedCost = typeof fixedCosts.$inferSelect;
export type InsertFixedCost = typeof fixedCosts.$inferInsert;
export type FixedCostPayment = typeof fixedCostPayments.$inferSelect;
export type InsertFixedCostPayment = typeof fixedCostPayments.$inferInsert;
export type CreditCard = typeof creditCards.$inferSelect;
export type InsertCreditCard = typeof creditCards.$inferInsert;
export type CreditCardInvoice = typeof creditCardInvoices.$inferSelect;
export type InsertCreditCardInvoice = typeof creditCardInvoices.$inferInsert;
export type Loan = typeof loans.$inferSelect;
export type InsertLoan = typeof loans.$inferInsert;
export type LoanInstallment = typeof loanInstallments.$inferSelect;
export type InsertLoanInstallment = typeof loanInstallments.$inferInsert;
