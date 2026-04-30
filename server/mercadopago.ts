/**
 * Mercado Pago API — puxa taxas REAIS por pagamento.
 * Usa o mesmo access_token OAuth do ML (descoberto 2026-04-19: o token ML
 * autentica no endpoint api.mercadopago.com/v1/payments quando o vendedor
 * é o collector).
 */

import { getDb } from "./db";
import { mlPaymentFees } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { getAccounts, mlFetch, type MLAccount } from "./mercadolivre";

type MPChargeDetail = {
  name: string;
  amounts: { original: number; refunded: number };
  type: string;
};

type MPPayment = {
  id: number;
  transaction_amount: number;
  shipping_amount: number;
  taxes_amount: number;
  status: string;
  date_approved: string | null;
  charges_details: MPChargeDetail[];
  transaction_details: {
    net_received_amount: number | null;
    total_paid_amount: number;
  };
  order: { id: string | number; type: string };
  collector_id: number;
};

export type PaymentFeeBreakdown = {
  paymentId: number;
  orderId: number;
  account: string;
  transactionAmount: number;
  mlSaleFee: number;
  mpProcessingFee: number;
  mpFinancingFee: number;
  otherFees: number;
  netReceivedAmount: number;
  shippingAmount: number;
  dateApproved: Date | null;
};

async function fetchPaymentFromMP(paymentId: number | string, account: MLAccount): Promise<MPPayment> {
  const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${account.accessToken}` },
  });
  if (res.status === 401) {
    throw new Error(`MP 401 para payment ${paymentId} (conta ${account.name}) — token expirado ou sem escopo`);
  }
  if (!res.ok) {
    throw new Error(`MP API error ${res.status} para payment ${paymentId}`);
  }
  return res.json();
}

function parseBreakdown(mp: MPPayment, account: MLAccount): PaymentFeeBreakdown {
  let mlSaleFee = 0;
  let mpProcessingFee = 0;
  let mpFinancingFee = 0;
  let otherFees = 0;

  for (const ch of mp.charges_details ?? []) {
    if (ch.type !== "fee") continue;
    const amt = ch.amounts?.original ?? 0;
    if (ch.name === "ml_sale_fee") mlSaleFee += amt;
    else if (ch.name === "mp_processing_fee") mpProcessingFee += amt;
    else if (ch.name === "mp_financing_fee") mpFinancingFee += amt;
    else otherFees += amt;
  }

  const orderIdRaw = mp.order?.id;
  const orderId = typeof orderIdRaw === "string" ? parseInt(orderIdRaw, 10) : Number(orderIdRaw ?? 0);

  return {
    paymentId: mp.id,
    orderId,
    account: account.name,
    transactionAmount: mp.transaction_amount ?? 0,
    mlSaleFee,
    mpProcessingFee,
    mpFinancingFee,
    otherFees,
    netReceivedAmount: mp.transaction_details?.net_received_amount ?? 0,
    shippingAmount: mp.shipping_amount ?? 0,
    dateApproved: mp.date_approved ? new Date(mp.date_approved) : null,
  };
}

export async function syncPaymentFees(paymentId: number | string, account: MLAccount): Promise<PaymentFeeBreakdown> {
  const mp = await fetchPaymentFromMP(paymentId, account);
  const breakdown = parseBreakdown(mp, account);
  const db = (await getDb())!;
  await db.insert(mlPaymentFees).values({
    paymentId: breakdown.paymentId,
    orderId: breakdown.orderId,
    account: breakdown.account,
    transactionAmount: String(breakdown.transactionAmount),
    mlSaleFee: String(breakdown.mlSaleFee),
    mpProcessingFee: String(breakdown.mpProcessingFee),
    mpFinancingFee: String(breakdown.mpFinancingFee),
    otherFees: String(breakdown.otherFees),
    netReceivedAmount: String(breakdown.netReceivedAmount),
    shippingAmount: String(breakdown.shippingAmount),
    dateApproved: breakdown.dateApproved ?? undefined,
    rawJson: JSON.stringify(mp),
  }).onDuplicateKeyUpdate({
    set: {
      transactionAmount: String(breakdown.transactionAmount),
      mlSaleFee: String(breakdown.mlSaleFee),
      mpProcessingFee: String(breakdown.mpProcessingFee),
      mpFinancingFee: String(breakdown.mpFinancingFee),
      otherFees: String(breakdown.otherFees),
      netReceivedAmount: String(breakdown.netReceivedAmount),
      shippingAmount: String(breakdown.shippingAmount),
      dateApproved: breakdown.dateApproved ?? undefined,
      rawJson: JSON.stringify(mp),
      syncedAt: new Date(),
    },
  });
  return breakdown;
}

/**
 * Dado um orderId ML, descobre em qual conta o pedido está, pega o payment_id
 * do order e sincroniza. Retorna breakdown ou null se não encontrado.
 */
export async function syncFeesForOrder(orderId: number | string): Promise<PaymentFeeBreakdown | null> {
  const accounts = getAccounts();
  for (const account of accounts) {
    try {
      const order = await mlFetch(account, `https://api.mercadolibre.com/orders/${orderId}`);
      const paymentId = order?.payments?.[0]?.id;
      if (!paymentId) continue;
      return await syncPaymentFees(paymentId, account);
    } catch {
      // tenta próxima conta
    }
  }
  return null;
}

/**
 * Sincroniza em lote os pedidos de um mês. Só busca pedidos que ainda não
 * têm entrada em ml_payment_fees. Retorna progresso.
 */
export async function syncFeesForMonth(year: number, month: number): Promise<{
  total: number;
  synced: number;
  failed: number;
  skipped: number;
  errors: Array<{ orderId: string; error: string }>;
}> {
  const db = (await getDb())!;
  const { marketplaceOrders } = await import("../drizzle/schema");
  const { and, gte, lt, eq, sql } = await import("drizzle-orm");

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const orders = await db
    .select({ externalId: marketplaceOrders.externalId, accountName: marketplaceOrders.accountName })
    .from(marketplaceOrders)
    .where(
      and(
        eq(marketplaceOrders.platform, "ml"),
        gte(marketplaceOrders.platformCreatedAt, start),
        lt(marketplaceOrders.platformCreatedAt, end),
      ),
    );

  const total = orders.length;
  let synced = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ orderId: string; error: string }> = [];

  const accountsByName = new Map(getAccounts().map((a) => [a.name, a]));

  const existingRows = await db
    .select({ orderId: mlPaymentFees.orderId })
    .from(mlPaymentFees);
  const existingOrderIds = new Set(existingRows.map((r) => Number(r.orderId)));

  for (const row of orders) {
    const idStr = row.externalId.replace(/^ML-/, "");
    const orderIdNum = Number(idStr);
    if (existingOrderIds.has(orderIdNum)) {
      skipped++;
      continue;
    }
    const account = accountsByName.get(row.accountName);
    if (!account) {
      failed++;
      errors.push({ orderId: row.externalId, error: "conta não encontrada" });
      continue;
    }
    try {
      const order = await mlFetch(account, `https://api.mercadolibre.com/orders/${idStr}`);
      const paymentId = order?.payments?.[0]?.id;
      if (!paymentId) {
        skipped++;
        continue;
      }
      await syncPaymentFees(paymentId, account);
      synced++;
    } catch (err: any) {
      failed++;
      errors.push({ orderId: row.externalId, error: err?.message ?? String(err) });
    }
  }

  return { total, synced, failed, skipped, errors };
}

/**
 * Retorna o mapa orderId → breakdown para uma lista de orderIds (usado no DRE).
 */
export async function getRealFeesByOrderIds(orderIds: number[]): Promise<Map<number, PaymentFeeBreakdown>> {
  if (orderIds.length === 0) return new Map();
  const db = (await getDb())!;
  const rows = await db
    .select()
    .from(mlPaymentFees)
    .where(inArray(mlPaymentFees.orderId, orderIds));
  const map = new Map<number, PaymentFeeBreakdown>();
  for (const r of rows) {
    map.set(Number(r.orderId), {
      paymentId: Number(r.paymentId),
      orderId: Number(r.orderId),
      account: r.account,
      transactionAmount: parseFloat(r.transactionAmount),
      mlSaleFee: parseFloat(r.mlSaleFee),
      mpProcessingFee: parseFloat(r.mpProcessingFee),
      mpFinancingFee: parseFloat(r.mpFinancingFee),
      otherFees: parseFloat(r.otherFees),
      netReceivedAmount: parseFloat(r.netReceivedAmount),
      shippingAmount: parseFloat(r.shippingAmount),
      dateApproved: r.dateApproved ?? null,
    });
  }
  return map;
}
