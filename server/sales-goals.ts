import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  salesGoals,
  marketplaceOrders,
  products,
  integrations,
  myCnpjs,
} from "../drizzle/schema";

type GoalRow = {
  year: number;
  month: number;
  cnpjId: number;
  faturamentoMeta: string;
  margemMetaPct: string;
};

type MonthAchieved = {
  month: number;
  faturamento: number;
  margemPct: number;
};

type DailyAchieved = {
  day: number;
  date: string;
  faturamento: number;
  margemPct: number;
};

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

/**
 * Mapa accountName uppercase -> cnpjId a partir das integrations.
 * Usado quando cnpjId > 0 para filtrar pedidos da empresa especifica.
 */
async function getAccountToCnpjMap(db: any): Promise<Map<string, number>> {
  const rows = await db
    .select({
      accountId: integrations.accountId,
      cnpjId: integrations.cnpjId,
      slug: integrations.slug,
    })
    .from(integrations);

  const map = new Map<string, number>();
  for (const r of rows as Array<{ accountId: string | null; cnpjId: number | null; slug: string }>) {
    if (!r.cnpjId) continue;
    if (r.slug?.startsWith("ml-") && r.accountId) {
      map.set(r.accountId.toUpperCase(), r.cnpjId);
    }
  }
  return map;
}

/**
 * Constroi a condicao SQL de filtro por cnpjId.
 * cnpjId=0: consolidada (sem filtro extra)
 * cnpjId>0: filtra por accountName que mapeia para esse cnpj
 */
async function buildCnpjFilter(db: any, cnpjId: number): Promise<string[]> {
  if (cnpjId <= 0) return [];
  const map = await getAccountToCnpjMap(db);
  const accountNames = [...map.entries()]
    .filter(([_, id]) => id === cnpjId)
    .map(([name]) => name);
  if (accountNames.length === 0) return ["__NONE__"];
  return accountNames;
}

export async function getYearGoals(year: number, cnpjId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const goals = (await db
    .select()
    .from(salesGoals)
    .where(and(eq(salesGoals.year, year), eq(salesGoals.cnpjId, cnpjId)))) as GoalRow[];

  const goalByMonth = new Map<number, GoalRow>();
  for (const g of goals) goalByMonth.set(Number(g.month), g);

  const accountNames = await buildCnpjFilter(db, cnpjId);
  const hasCnpjFilter = cnpjId > 0;
  const noMatchingAccounts = hasCnpjFilter && accountNames[0] === "__NONE__";

  let achievedByMonth = new Map<number, MonthAchieved>();
  if (!noMatchingAccounts) {
    const conditions: any[] = [
      sql`YEAR(${marketplaceOrders.platformCreatedAt}) = ${year}`,
      sql`${marketplaceOrders.status} NOT IN ('cancelled','to_return')`,
    ];
    if (hasCnpjFilter) {
      conditions.push(sql`${marketplaceOrders.accountName} IN (${sql.join(accountNames.map((n) => sql`${n}`), sql`, `)})`);
    }

    const rows = await db
      .select({
        month: sql<number>`MONTH(${marketplaceOrders.platformCreatedAt})`,
        faturamento: sql<string>`coalesce(sum(${marketplaceOrders.totalAmount}), 0)`,
        custo: sql<string>`coalesce(sum(${marketplaceOrders.quantity} * coalesce(${products.valorProduto}, 0)), 0)`,
      })
      .from(marketplaceOrders)
      .leftJoin(products, eq(marketplaceOrders.productSku, products.sku))
      .where(and(...conditions))
      .groupBy(sql`MONTH(${marketplaceOrders.platformCreatedAt})`);

    for (const r of rows as Array<{ month: number; faturamento: string; custo: string }>) {
      const fat = Number(r.faturamento ?? 0);
      const custo = Number(r.custo ?? 0);
      const margemPct = fat > 0 && custo > 0 ? (fat - custo) / fat : 0;
      achievedByMonth.set(Number(r.month), {
        month: Number(r.month),
        faturamento: fat,
        margemPct,
      });
    }
  }

  const months = Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
    const goal = goalByMonth.get(m);
    const achieved = achievedByMonth.get(m) ?? { month: m, faturamento: 0, margemPct: 0 };
    const metaFat = Number(goal?.faturamentoMeta ?? 0);
    const metaMargem = Number(goal?.margemMetaPct ?? 0);
    return {
      month: m,
      metaFaturamento: metaFat,
      metaMargemPct: metaMargem,
      atingidoFaturamento: achieved.faturamento,
      atingidoMargemPct: achieved.margemPct,
      variacaoFaturamento: achieved.faturamento - metaFat,
      variacaoMargemPct: achieved.margemPct - metaMargem,
    };
  });

  return { year, cnpjId, months };
}

export async function getMonthDailyBreakdown(year: number, month: number, cnpjId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const goalRow = (await db
    .select()
    .from(salesGoals)
    .where(and(eq(salesGoals.year, year), eq(salesGoals.month, month), eq(salesGoals.cnpjId, cnpjId)))
    .limit(1)) as GoalRow[];
  const metaFat = Number(goalRow[0]?.faturamentoMeta ?? 0);
  const metaMargem = Number(goalRow[0]?.margemMetaPct ?? 0);
  const totalDays = daysInMonth(year, month);
  const dailyFatTarget = totalDays > 0 ? metaFat / totalDays : 0;

  const accountNames = await buildCnpjFilter(db, cnpjId);
  const hasCnpjFilter = cnpjId > 0;
  const noMatchingAccounts = hasCnpjFilter && accountNames[0] === "__NONE__";

  let achievedByDay = new Map<number, DailyAchieved>();
  if (!noMatchingAccounts) {
    const conditions: any[] = [
      sql`YEAR(${marketplaceOrders.platformCreatedAt}) = ${year}`,
      sql`MONTH(${marketplaceOrders.platformCreatedAt}) = ${month}`,
      sql`${marketplaceOrders.status} NOT IN ('cancelled','to_return')`,
    ];
    if (hasCnpjFilter) {
      conditions.push(sql`${marketplaceOrders.accountName} IN (${sql.join(accountNames.map((n) => sql`${n}`), sql`, `)})`);
    }

    const rows = await db
      .select({
        day: sql<number>`DAY(${marketplaceOrders.platformCreatedAt})`,
        faturamento: sql<string>`coalesce(sum(${marketplaceOrders.totalAmount}), 0)`,
        custo: sql<string>`coalesce(sum(${marketplaceOrders.quantity} * coalesce(${products.valorProduto}, 0)), 0)`,
      })
      .from(marketplaceOrders)
      .leftJoin(products, eq(marketplaceOrders.productSku, products.sku))
      .where(and(...conditions))
      .groupBy(sql`DAY(${marketplaceOrders.platformCreatedAt})`);

    for (const r of rows as Array<{ day: number; faturamento: string; custo: string }>) {
      const fat = Number(r.faturamento ?? 0);
      const custo = Number(r.custo ?? 0);
      const margemPct = fat > 0 && custo > 0 ? (fat - custo) / fat : 0;
      const d = Number(r.day);
      achievedByDay.set(d, {
        day: d,
        date: `${String(d).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
        faturamento: fat,
        margemPct,
      });
    }
  }

  const days = Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => {
    const achieved = achievedByDay.get(d) ?? {
      day: d,
      date: `${String(d).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
      faturamento: 0,
      margemPct: 0,
    };
    return {
      day: d,
      date: achieved.date,
      metaFaturamento: dailyFatTarget,
      metaMargemPct: metaMargem,
      atingidoFaturamento: achieved.faturamento,
      atingidoMargemPct: achieved.margemPct,
      variacaoFaturamento: achieved.faturamento - dailyFatTarget,
      variacaoMargemPct: achieved.margemPct - metaMargem,
    };
  });

  return { year, month, cnpjId, days };
}

export async function upsertSalesGoal(opts: {
  year: number;
  month: number;
  cnpjId: number;
  faturamentoMeta: number;
  margemMetaPct: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = (await db
    .select()
    .from(salesGoals)
    .where(
      and(
        eq(salesGoals.year, opts.year),
        eq(salesGoals.month, opts.month),
        eq(salesGoals.cnpjId, opts.cnpjId),
      ),
    )
    .limit(1)) as GoalRow[];

  if (existing.length > 0) {
    await db
      .update(salesGoals)
      .set({
        faturamentoMeta: String(opts.faturamentoMeta),
        margemMetaPct: String(opts.margemMetaPct),
      })
      .where(
        and(
          eq(salesGoals.year, opts.year),
          eq(salesGoals.month, opts.month),
          eq(salesGoals.cnpjId, opts.cnpjId),
        ),
      );
  } else {
    await db.insert(salesGoals).values({
      year: opts.year,
      month: opts.month,
      cnpjId: opts.cnpjId,
      faturamentoMeta: String(opts.faturamentoMeta),
      margemMetaPct: String(opts.margemMetaPct),
    });
  }

  return { ok: true as const };
}

export async function deleteYearGoals(year: number, cnpjId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(salesGoals)
    .where(and(eq(salesGoals.year, year), eq(salesGoals.cnpjId, cnpjId)));
  return { ok: true as const };
}

export async function listCompaniesForGoals() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = (await db
    .select({
      id: myCnpjs.id,
      razaoSocial: myCnpjs.razaoSocial,
      nomeFantasia: myCnpjs.nomeFantasia,
    })
    .from(myCnpjs)
    .where(eq(myCnpjs.isActive, 1))) as Array<{
    id: number;
    razaoSocial: string;
    nomeFantasia: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    label: r.nomeFantasia || r.razaoSocial,
  }));
}
