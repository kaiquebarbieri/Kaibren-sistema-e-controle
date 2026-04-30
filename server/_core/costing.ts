/**
 * Centro de cálculo de custo Kaibren — fonte única de verdade.
 * Substitui lógica duplicada em Dashboard.tsx, Products.tsx, CatalogoML.tsx, CatalogoAtacado.tsx.
 *
 * Regras validadas em 2026-04-26 com Kaique. Ver memory/projects/crm-kaibren-custos.md.
 */

// Fallback usado SÓ quando não dá pra calcular pelo Simples (RBT12 desconhecido).
// 9,3% é a referência histórica do Kaique — mas a fórmula real é a abaixo.
export const IMPOSTO_PERCENT_FALLBACK = 9.3;

/**
 * Tabela do Simples Nacional Anexo I (comércio) — vigente 2018+ (LC 155/2016).
 * Alíquota efetiva = (RBT12 × aliquotaNominal − deducao) / RBT12.
 */
const SIMPLES_ANEXO_I_FAIXAS = [
  { ate: 180_000,    nominal: 0.0400, deducao: 0,        nome: "Faixa 1" },
  { ate: 360_000,    nominal: 0.0730, deducao: 5_940,    nome: "Faixa 2" },
  { ate: 720_000,    nominal: 0.0950, deducao: 13_860,   nome: "Faixa 3" },
  { ate: 1_800_000,  nominal: 0.1070, deducao: 22_500,   nome: "Faixa 4" },
  { ate: 3_600_000,  nominal: 0.1430, deducao: 87_300,   nome: "Faixa 5" },
  { ate: 4_800_000,  nominal: 0.1900, deducao: 378_000,  nome: "Faixa 6" },
];

/**
 * Calcula alíquota efetiva do Simples Anexo I a partir do RBT12 (Receita Bruta últimos 12 meses).
 * Retorna percentual em base 100 (ex: 5.34 significa 5,34%).
 */
export function aliquotaEfetivaSimples(rbt12: number): {
  rbt12: number;
  faixa: string;
  nominalPct: number;
  deducao: number;
  efetivaPct: number;
} {
  if (!Number.isFinite(rbt12) || rbt12 <= 0) {
    return { rbt12: 0, faixa: "Sem RBT12", nominalPct: 0, deducao: 0, efetivaPct: IMPOSTO_PERCENT_FALLBACK };
  }
  const faixa = SIMPLES_ANEXO_I_FAIXAS.find((f) => rbt12 <= f.ate) ?? SIMPLES_ANEXO_I_FAIXAS[SIMPLES_ANEXO_I_FAIXAS.length - 1];
  const efetiva = (rbt12 * faixa.nominal - faixa.deducao) / rbt12;
  return {
    rbt12,
    faixa: faixa.nome,
    nominalPct: faixa.nominal * 100,
    deducao: faixa.deducao,
    efetivaPct: Math.max(0, efetiva * 100),
  };
}
export const ML_COMMISSION_DEFAULT_PCT = 0.13;
export const FRETE_MEDIO_ML_UNIT = 16;

/**
 * Comissão Everton (gerente Mondial) por peça vendida.
 * < R$5 → R$ 0,40 / ≥ R$5 → R$ 0,90.
 */
export function calcEverton(custo: number): number {
  if (!Number.isFinite(custo) || custo <= 0) return 0;
  return custo < 5 ? 0.40 : 0.90;
}

/**
 * Embalagem por categoria detectada no título.
 * Retorna 0 (não null) pra simplificar agregações.
 */
export function calcEmbalagem(titulo: string): number {
  const t = (titulo || "").toLowerCase();
  if (!t) return 0;
  if (t.includes("plug")) return 0.30;
  if (t.includes("botão") || t.includes("botões") || t.includes("botao") || t.includes("botoes") || t.includes("anel")) return 0.30;
  if (t.includes("puxador") || t.includes("acoplamento") || t.includes("acoplador") || t.includes("cabo") || t.includes("alça") || t.includes("alca") || t.includes("kit")) return 0.95;
  if (t.includes("hélice") || t.includes("helice") || t.includes("base") || t.includes("resistência") || t.includes("resistencia") || t.includes("caixa")) return 1.00;
  if (t.includes("cuba") || t.includes("cesto") || t.includes("copo") || t.includes("motor") || t.includes("comedouro")) return 3.45;
  return 0;
}

/**
 * Taxas reais Mercado Livre (Clássico Eletrônicos).
 * Retorna comissão + taxa fixa + frete (se acima R$79) por peça.
 */
export function calcMlFeesPerUnit(sale: number): {
  commission: number;
  fixedFee: number;
  freteSeller: number;
  total: number;
} {
  if (!Number.isFinite(sale) || sale <= 0) {
    return { commission: 0, fixedFee: 0, freteSeller: 0, total: 0 };
  }
  const commission = sale * ML_COMMISSION_DEFAULT_PCT;
  let fixedFee = 0;
  if (sale >= 12.50 && sale < 29) fixedFee = 6.25;
  else if (sale >= 29 && sale < 50) fixedFee = 6.50;
  else if (sale >= 50 && sale < 79) fixedFee = 6.75;
  const freteSeller = sale >= 79 ? FRETE_MEDIO_ML_UNIT : 0;
  return { commission, fixedFee, freteSeller, total: commission + fixedFee + freteSeller };
}

/**
 * Custo total real por peça (Mondial + Everton + Embalagem).
 * NÃO inclui taxas de marketplace, imposto ou frete — esses são abatidos da receita, não do custo.
 */
export function calcCustoTotalUnit(custoBase: number, titulo: string): {
  custoBase: number;
  everton: number;
  embalagem: number;
  total: number;
} {
  const base = Number.isFinite(custoBase) && custoBase > 0 ? custoBase : 0;
  const everton = calcEverton(base);
  const embalagem = calcEmbalagem(titulo || "");
  return { custoBase: base, everton, embalagem, total: base + everton + embalagem };
}

/**
 * Margem real de uma venda ML — (preço - taxas - imposto - custo total) / preço.
 * Use platformFeePct se vier explícito do anúncio (> 0); senão calcula pelas faixas reais.
 */
export function calcMargemMlReal(input: {
  salePrice: number;
  custoBase: number;
  titulo: string;
  qty?: number;
  platformFeePct?: number; // 0-100
  taxPct?: number; // 0-100
}): {
  sale: number;
  custo: { custoBase: number; everton: number; embalagem: number; total: number };
  fees: { commission: number; fixedFee: number; freteSeller: number; total: number };
  imposto: number;
  lucroUnit: number;
  margemPct: number;
} {
  const sale = Number(input.salePrice) || 0;
  const qty = input.qty ?? 1;
  const custo = calcCustoTotalUnit(input.custoBase, input.titulo);

  let fees: ReturnType<typeof calcMlFeesPerUnit>;
  if (input.platformFeePct && input.platformFeePct > 0) {
    const commission = sale * (input.platformFeePct / 100);
    let fixedFee = 0;
    if (sale >= 12.50 && sale < 29) fixedFee = 6.25;
    else if (sale >= 29 && sale < 50) fixedFee = 6.50;
    else if (sale >= 50 && sale < 79) fixedFee = 6.75;
    const freteSeller = sale >= 79 ? FRETE_MEDIO_ML_UNIT : 0;
    fees = { commission, fixedFee, freteSeller, total: commission + fixedFee + freteSeller };
  } else {
    fees = calcMlFeesPerUnit(sale);
  }

  const taxPctEff = input.taxPct && input.taxPct > 0 ? input.taxPct : IMPOSTO_PERCENT_FALLBACK;
  const imposto = sale * (taxPctEff / 100);
  const lucroUnit = sale - fees.total - imposto - custo.total;
  const margemPct = sale > 0 ? (lucroUnit / sale) * 100 : 0;
  void qty;
  return { sale, custo, fees, imposto, lucroUnit, margemPct };
}
