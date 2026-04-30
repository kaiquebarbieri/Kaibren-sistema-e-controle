import { rawQuery } from "../db";

export type VitalStatus = "green" | "yellow" | "red" | "unknown";

export type VitalSign = {
  key: string;
  title: string;
  status: VitalStatus;
  value: string;
  detail: string;
  recommendation?: string;
  weight: number;
};

export type FinanceHealthResult = {
  score: number;
  overallStatus: VitalStatus;
  asOf: string;
  vitals: VitalSign[];
  topActions: { priority: VitalStatus; action: string }[];
};

const FIXED_COSTS_MONTHLY_FALLBACK = 20100;

function statusScore(s: VitalStatus): number {
  if (s === "green") return 100;
  if (s === "yellow") return 60;
  if (s === "red") return 20;
  return 50;
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/* ───── Vital 1: Saldo bancário operacional ───── */
async function vitalCash(monthlyFixedCosts: number): Promise<VitalSign> {
  try {
    const rows = await rawQuery(`
      SELECT saldoFinal, periodMonth, periodYear, bankName, updatedAt
      FROM bank_statements
      WHERE saldoFinal IS NOT NULL
      ORDER BY periodYear DESC, periodMonth DESC, updatedAt DESC
      LIMIT 5
    `);
    if (!rows || rows.length === 0) {
      return {
        key: "cash",
        title: "Saldo bancário operacional",
        status: "unknown",
        value: "—",
        detail: "Nenhum extrato bancário cadastrado",
        recommendation: "Importe o último extrato em Financeiro › Extratos pra eu monitorar o caixa",
        weight: 25,
      };
    }
    const totalSaldo = rows.reduce((sum: number, r: any) => sum + Number(r.saldoFinal || 0), 0);
    const dailyBurn = monthlyFixedCosts / 30;
    const daysCovered = dailyBurn > 0 ? Math.floor(totalSaldo / dailyBurn) : 0;
    let status: VitalStatus = "green";
    let recommendation: string | undefined;
    if (daysCovered < 15) {
      status = "red";
      recommendation = "Saldo crítico. Avalie antecipação pontual ou linha de crédito antes que vire problema";
    } else if (daysCovered < 30) {
      status = "yellow";
      recommendation = "Caixa apertado. Acompanhe vendas e adie compras não-críticas";
    }
    const lastUpdate = rows[0]?.updatedAt ? new Date(rows[0].updatedAt) : null;
    const daysSinceLastExtrato = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 86400000) : null;
    let detail = `${brl(totalSaldo)} cobre ~${daysCovered} dias de custos fixos`;
    if (daysSinceLastExtrato !== null && daysSinceLastExtrato > 7) {
      detail += ` (último extrato há ${daysSinceLastExtrato}d — pode estar desatualizado)`;
    }
    return { key: "cash", title: "Saldo bancário operacional", status, value: brl(totalSaldo), detail, recommendation, weight: 25 };
  } catch (e: any) {
    return { key: "cash", title: "Saldo bancário operacional", status: "unknown", value: "—", detail: `erro: ${e.message}`, weight: 25 };
  }
}

/* ───── Vital 2: Margem bruta (DRE mês corrente) ───── */
async function vitalMargin(): Promise<VitalSign> {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const { getDreGerencial } = await import("../db");
    const dre = await getDreGerencial(year, month);
    const receita = Number(dre?.current?.receitaBruta?.total || 0);
    const lucro = Number(dre?.current?.lucroBruto || 0);
    if (receita <= 0) {
      return {
        key: "margin",
        title: "Margem bruta do mês",
        status: "unknown",
        value: "—",
        detail: "Sem receita registrada neste mês ainda",
        weight: 20,
      };
    }
    const margemPct = (lucro / receita) * 100;
    let status: VitalStatus = "green";
    let recommendation: string | undefined;
    if (margemPct < 13) {
      status = "red";
      recommendation = "Margem crítica pra eletrodomésticos. Investigar custo (fornecedor) e mix por canal urgente";
    } else if (margemPct < 17) {
      status = "yellow";
      recommendation = "Margem abaixo do esperado. Avaliar SKUs com prejuízo e renegociar com Mondial";
    } else if (margemPct > 22) {
      status = "green";
    }
    return {
      key: "margin",
      title: "Margem bruta do mês",
      status,
      value: `${margemPct.toFixed(1)}%`,
      detail: `${brl(lucro)} de ${brl(receita)} (benchmark eletrodomésticos: 15-25%)`,
      recommendation,
      weight: 20,
    };
  } catch (e: any) {
    return { key: "margin", title: "Margem bruta do mês", status: "unknown", value: "—", detail: `erro: ${e.message}`, weight: 20 };
  }
}

/* ───── Vital 3: Fornecedor crítico em atraso ───── */
async function vitalCriticalSupplier(): Promise<VitalSign> {
  try {
    const today = todayISO();
    const rows = await rawQuery(`
      SELECT id, title, supplier, amount, dueDate
      FROM payable_accounts
      WHERE status != 'paid' AND dueDate < ?
      ORDER BY dueDate ASC
    `, [today]);
    const overdue = rows ?? [];
    const mondialOverdue = overdue.filter((r: any) =>
      String(r.supplier || r.title || "").toLowerCase().includes("mondial"));
    const bigOverdue = overdue.filter((r: any) => Number(r.amount || 0) > 5000);
    const flagged = [...mondialOverdue, ...bigOverdue.filter((b: any) => !mondialOverdue.find((m: any) => m.id === b.id))];

    if (flagged.length === 0) {
      return {
        key: "critical-supplier",
        title: "Fornecedor crítico",
        status: overdue.length > 0 ? "yellow" : "green",
        value: overdue.length === 0 ? "Nenhuma" : `${overdue.length} pequena(s)`,
        detail: overdue.length === 0 ? "Nenhuma conta em atraso" : `${overdue.length} contas pequenas atrasadas`,
        weight: 15,
      };
    }
    const total = flagged.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    return {
      key: "critical-supplier",
      title: "Fornecedor crítico",
      status: "red",
      value: `${flagged.length} conta(s) — ${brl(total)}`,
      detail: flagged.slice(0, 3).map((r: any) => `${r.supplier || r.title} ${brl(Number(r.amount))}`).join(" · "),
      recommendation: "Pagar ou renegociar HOJE. Atraso com Mondial ou conta grande quebra confiança",
      weight: 15,
    };
  } catch (e: any) {
    return { key: "critical-supplier", title: "Fornecedor crítico", status: "unknown", value: "—", detail: `erro: ${e.message}`, weight: 15 };
  }
}

/* ───── Vital 4: Impostos vencendo ou atrasados ───── */
async function vitalTaxes(): Promise<VitalSign> {
  try {
    const today = new Date();
    const todayStr = todayISO();
    const in3days = new Date();
    in3days.setDate(today.getDate() + 3);
    const in3Str = in3days.toISOString().slice(0, 10);

    const rows = await rawQuery(`
      SELECT id, title, supplier, amount, dueDate, status
      FROM payable_accounts
      WHERE status != 'paid'
        AND (LOWER(category) IN ('imposto', 'tributo', 'tributos') OR accountType = 'imposto')
      ORDER BY dueDate ASC
    `);
    const taxes = rows ?? [];
    if (taxes.length === 0) {
      return {
        key: "taxes",
        title: "Impostos do mês",
        status: "green",
        value: "Em dia",
        detail: "Nenhum imposto cadastrado pendente. Confira se está tudo em Contas a Pagar",
        weight: 15,
      };
    }
    const overdue = taxes.filter((t: any) => t.dueDate < todayStr);
    const dueSoon = taxes.filter((t: any) => t.dueDate >= todayStr && t.dueDate <= in3Str);
    if (overdue.length > 0) {
      const total = overdue.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      return {
        key: "taxes",
        title: "Impostos do mês",
        status: "red",
        value: `${overdue.length} atrasado(s) · ${brl(total)}`,
        detail: overdue.slice(0, 3).map((t: any) => `${t.title} venceu ${t.dueDate}`).join(" · "),
        recommendation: "Imposto atrasado gera multa pesada. DAS atrasado pode desenquadrar do Simples — pague hoje",
        weight: 15,
      };
    }
    if (dueSoon.length > 0) {
      const total = dueSoon.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      return {
        key: "taxes",
        title: "Impostos do mês",
        status: "yellow",
        value: `${dueSoon.length} vence(m) em ≤3d · ${brl(total)}`,
        detail: dueSoon.slice(0, 3).map((t: any) => `${t.title} ${t.dueDate}`).join(" · "),
        recommendation: "Garantir saldo pra pagar nos próximos 3 dias",
        weight: 15,
      };
    }
    const total = taxes.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    return {
      key: "taxes",
      title: "Impostos do mês",
      status: "green",
      value: `${taxes.length} agendado(s) · ${brl(total)}`,
      detail: "Todos com prazo confortável",
      weight: 15,
    };
  } catch (e: any) {
    return { key: "taxes", title: "Impostos do mês", status: "unknown", value: "—", detail: `erro: ${e.message}`, weight: 15 };
  }
}

/* ───── Vital 5: Antecipação (vício) — heurística ───── */
async function vitalAdvance(): Promise<VitalSign> {
  try {
    const rows = await rawQuery(`
      SELECT bt.id, bt.originalDescription, bt.amount
      FROM bank_transactions bt
      JOIN bank_statements bs ON bs.id = bt.statementId
      WHERE bs.periodYear = YEAR(CURDATE()) AND bs.periodMonth = MONTH(CURDATE())
        AND (LOWER(bt.originalDescription) LIKE '%antecipa%'
          OR LOWER(bt.originalDescription) LIKE '%adiantamento%'
          OR LOWER(bt.category) LIKE '%antecipa%')
    `);
    const advances = rows ?? [];
    if (advances.length === 0) {
      return {
        key: "advance",
        title: "Antecipação de recebíveis",
        status: "green",
        value: "Sem antecipação",
        detail: "Nenhuma antecipação detectada nos extratos do mês",
        weight: 10,
      };
    }
    const total = advances.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    return {
      key: "advance",
      title: "Antecipação de recebíveis",
      status: advances.length > 5 ? "red" : "yellow",
      value: `${advances.length}× · ${brl(total)} este mês`,
      detail: "Antecipação recorrente é vício mascarado de fluxo de caixa. Acima de 30% das vendas é alerta",
      recommendation: advances.length > 5
        ? "Antecipação virou rotina. Vamos revisar capital de giro estrutural"
        : "Acompanhar — uso pontual é OK",
      weight: 10,
    };
  } catch (e: any) {
    return { key: "advance", title: "Antecipação de recebíveis", status: "unknown", value: "—", detail: `erro: ${e.message}`, weight: 10 };
  }
}

/* ───── Vital 6: Reputação ML por conta ───── */
async function vitalReputation(): Promise<VitalSign> {
  // ML negative reputation hardcoded for v1 — Kaibren memory: CLICKMULTII 32% negativas
  // TODO: pull from ML API when sync gets reputation field
  const accounts = [
    { name: "CLICKMULTII", negativePct: 32 },
    { name: "DUOULTILIDADE", negativePct: 8 },
    { name: "KAIBRENLTDA", negativePct: 6 },
  ];
  const critical = accounts.filter(a => a.negativePct > 25);
  const attention = accounts.filter(a => a.negativePct >= 15 && a.negativePct <= 25);

  if (critical.length > 0) {
    return {
      key: "reputation",
      title: "Reputação Mercado Livre",
      status: "red",
      value: critical.map(a => `${a.name}: ${a.negativePct}%`).join(" · "),
      detail: "Reputação ruim mata venda orgânica e aumenta CAC. Resolver antes de qualquer outra coisa",
      recommendation: "Pausar campanhas pagas em conta com reputação crítica até resolver causa raiz das negativas",
      weight: 8,
    };
  }
  if (attention.length > 0) {
    return {
      key: "reputation",
      title: "Reputação Mercado Livre",
      status: "yellow",
      value: attention.map(a => `${a.name}: ${a.negativePct}%`).join(" · "),
      detail: "Reputação requer atenção",
      weight: 8,
    };
  }
  return {
    key: "reputation",
    title: "Reputação Mercado Livre",
    status: "green",
    value: accounts.map(a => `${a.name}: ${a.negativePct}%`).join(" · "),
    detail: "Reputação saudável em todas as contas",
    weight: 8,
  };
}

/* ───── Vital 7: Concentração de canal ───── */
async function vitalConcentration(): Promise<VitalSign> {
  try {
    const now = new Date();
    const { getDreGerencial } = await import("../db");
    const dre = await getDreGerencial(now.getFullYear(), now.getMonth() + 1);
    const ml = Number(dre?.current?.receitaBruta?.ml || 0);
    const shopee = Number(dre?.current?.receitaBruta?.shopee || 0);
    const total = ml + shopee;
    if (total === 0) {
      return {
        key: "concentration",
        title: "Concentração de canal",
        status: "unknown",
        value: "—",
        detail: "Sem receita registrada neste mês",
        weight: 7,
      };
    }
    const mlPct = (ml / total) * 100;
    const shopeePct = (shopee / total) * 100;
    const maxPct = Math.max(mlPct, shopeePct);
    const dominantCanal = mlPct >= shopeePct ? "Mercado Livre" : "Shopee";
    let status: VitalStatus = "green";
    let recommendation: string | undefined;
    if (maxPct > 65) {
      status = "red";
      recommendation = `${dominantCanal} concentra mais de 65% — qualquer suspensão de conta vira problema existencial. Diversificar`;
    } else if (maxPct > 50) {
      status = "yellow";
      recommendation = `${dominantCanal} acima de 50% — atenção a mudanças de regras do canal`;
    }
    return {
      key: "concentration",
      title: "Concentração de canal",
      status,
      value: `${dominantCanal}: ${maxPct.toFixed(0)}%`,
      detail: `ML ${mlPct.toFixed(0)}% · Shopee ${shopeePct.toFixed(0)}%`,
      recommendation,
      weight: 7,
    };
  } catch (e: any) {
    return { key: "concentration", title: "Concentração de canal", status: "unknown", value: "—", detail: `erro: ${e.message}`, weight: 7 };
  }
}

/* ───── Top actions ───── */
function buildTopActions(vitals: VitalSign[]): { priority: VitalStatus; action: string }[] {
  return vitals
    .filter(v => v.recommendation && (v.status === "red" || v.status === "yellow"))
    .sort((a, b) => {
      const order: Record<VitalStatus, number> = { red: 0, yellow: 1, green: 2, unknown: 3 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return b.weight - a.weight;
    })
    .slice(0, 3)
    .map(v => ({ priority: v.status, action: v.recommendation! }));
}

export async function getFinanceHealth(): Promise<FinanceHealthResult> {
  // Get monthly fixed costs (fallback if not available)
  let monthlyFixedCosts = FIXED_COSTS_MONTHLY_FALLBACK;
  try {
    const rows = await rawQuery(`
      SELECT SUM(CASE
        WHEN frequencia = 'mensal' THEN valor
        WHEN frequencia = 'anual' THEN valor / 12
        WHEN frequencia = 'semanal' THEN valor * 4.33
        ELSE 0
      END) as total
      FROM custos_fixos WHERE ativo = 1
    `);
    if (rows?.[0]?.total) monthlyFixedCosts = Number(rows[0].total);
  } catch (e) { /* fallback */ }

  const [cash, margin, supplier, taxes, advance, reputation, concentration] = await Promise.all([
    vitalCash(monthlyFixedCosts),
    vitalMargin(),
    vitalCriticalSupplier(),
    vitalTaxes(),
    vitalAdvance(),
    vitalReputation(),
    vitalConcentration(),
  ]);

  const vitals = [cash, margin, supplier, taxes, advance, reputation, concentration];
  const totalWeight = vitals.reduce((s, v) => s + v.weight, 0);
  const weightedScore = vitals.reduce((s, v) => s + statusScore(v.status) * v.weight, 0);
  const score = Math.round(weightedScore / totalWeight);
  let overallStatus: VitalStatus = "green";
  if (score < 50) overallStatus = "red";
  else if (score < 75) overallStatus = "yellow";

  return {
    score,
    overallStatus,
    asOf: new Date().toISOString(),
    vitals,
    topActions: buildTopActions(vitals),
  };
}
