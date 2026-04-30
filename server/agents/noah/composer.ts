/**
 * Compositor de mensagens do Noah CEO via Claude.
 * Lê health + DRE + payables e gera mensagem em voz executiva pro Kaique.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getFinanceHealth, type FinanceHealthResult } from "../../finance/health";
import { rawQuery } from "../../db";

const PERSONA = `Você é o **Noah, CEO virtual da Kaibren**. Fala com o **Kaique** (dono) via Telegram.

## REGRA DE OURO: Mensagens curtas, visuais, fáceis de escanear no celular.

Kaique odeia parágrafos longos. Ele lê em pé, andando, no celular. Toda mensagem precisa caber em uma tela sem rolar muito.

## Estilo OBRIGATÓRIO

✅ FAÇA:
- Linha de cabeçalho com data + score + emoji de status
- Linhas curtas (máx 60 caracteres cada)
- Use emojis como ícones de seção: 💰 caixa, 📦 vendas, ⚠️ alerta, 🎯 ação, 📈 alta, 📉 queda, 🔴🟡🟢 status
- *Negrito* só em valores e nomes-chave
- Bullets curtos com • ou números
- Quebra de linha generosa entre seções
- Termina com 1 ação clara OU pergunta direta
- Link curto pra tela do CRM quando pertinente (ex: /financeiro/saude-empresa)

❌ NÃO FAÇA:
- Texto corrido em parágrafo
- Frases compostas longas
- Explicação técnica detalhada
- Múltiplas decisões na mesma mensagem
- Cumprimento ("olá", "bom dia, Kaique")
- Saudação no fim ("abraço", "qualquer dúvida me chame")
- Aspas duplas, parênteses aninhados

## Limite de caracteres por tipo

- DIÁRIO: máx 500 caracteres
- SEMANAL: máx 700 caracteres
- MENSAL: máx 1000 caracteres
- URGENTE: máx 300 caracteres

NUNCA exceda. Se faltar espaço, corte detalhe e mantenha decisão.

## Markdown Telegram

- *negrito* (asterisco simples)
- _itálico_ (underscore)
- [link](url) quando pertinente
- NÃO use \`\`\`code\`\`\` ou tabelas markdown — use bullets simples`;

export async function composeDailyRecap(): Promise<string> {
  const health = await getFinanceHealth();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const ystr = yesterday.toISOString().slice(0, 10);

  // sales yesterday (best-effort: ML orders)
  let salesYesterday = 0;
  let ordersYesterday = 0;
  try {
    const rows = await rawQuery(`
      SELECT COUNT(*) as orders, SUM(totalAmount) as total
      FROM ml_orders
      WHERE DATE(dateClosed) = ?
    `, [ystr]);
    if (rows?.[0]) {
      ordersYesterday = Number(rows[0].orders || 0);
      salesYesterday = Number(rows[0].total || 0);
    }
  } catch (e) { /* table may not exist */ }

  // payables vencendo hoje
  const today = new Date().toISOString().slice(0, 10);
  let dueToday: any[] = [];
  try {
    dueToday = await rawQuery(`
      SELECT title, supplier, amount, dueDate
      FROM payable_accounts
      WHERE status != 'paid' AND dueDate = ?
      ORDER BY amount DESC
    `, [today]) ?? [];
  } catch (e) { /* */ }

  const ctx = {
    date: today,
    yesterday: ystr,
    sales: { orders: ordersYesterday, total: salesYesterday },
    health: {
      score: health.score,
      status: health.overallStatus,
      vitals: health.vitals.map(v => ({ key: v.key, title: v.title, status: v.status, value: v.value, detail: v.detail })),
      topActions: health.topActions,
    },
    dueToday: dueToday.map((d: any) => ({ title: d.title, supplier: d.supplier, amount: Number(d.amount), dueDate: d.dueDate })),
  };

  return callClaude(`Monte RECAP DIÁRIO pra Kaique. Data hoje: ${today}.

ESTRUTURA EXATA (copie o conteúdo, NÃO inclua code blocks de markdown):

\`\`\`
🌅 *DD/mmm* · Score X 🟢/🟡/🔴

💰 Saldo: R$ X (Y dias cobertos)
📦 Ontem: N pedidos · R$ X
⚠️ Vence hoje: R$ X (lista 2 mais)

🔴 Crítico: [1 linha]
🔴 Crítico: [1 linha]

🎯 *Hoje:* [ação concreta em UMA frase]
\`\`\`

REGRAS:
- Máx 500 caracteres TOTAL
- Sem cumprimento, sem "Kaique"
- Se "Vence hoje" for vazio, omita a linha
- Se houver 0 ou 1 crítico, ajuste — não force 3
- A "decisão de hoje" precisa caber numa frase

Dados:\n${JSON.stringify(ctx, null, 2)}`);
}

export async function composeWeeklyRecap(): Promise<string> {
  const health = await getFinanceHealth();
  const now = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(now.getDate() - 7);

  let weekSales = 0, weekOrders = 0;
  let prevWeekSales = 0, prevWeekOrders = 0;
  try {
    const cur = await rawQuery(`SELECT COUNT(*) as orders, SUM(totalAmount) as total FROM ml_orders WHERE dateClosed >= ?`, [weekAgo.toISOString().slice(0, 10)]);
    if (cur?.[0]) { weekOrders = Number(cur[0].orders || 0); weekSales = Number(cur[0].total || 0); }
    const twoWeeks = new Date(); twoWeeks.setDate(now.getDate() - 14);
    const prev = await rawQuery(`SELECT COUNT(*) as orders, SUM(totalAmount) as total FROM ml_orders WHERE dateClosed >= ? AND dateClosed < ?`, [twoWeeks.toISOString().slice(0, 10), weekAgo.toISOString().slice(0, 10)]);
    if (prev?.[0]) { prevWeekOrders = Number(prev[0].orders || 0); prevWeekSales = Number(prev[0].total || 0); }
  } catch (e) { /* */ }

  const salesDelta = prevWeekSales > 0 ? ((weekSales - prevWeekSales) / prevWeekSales) * 100 : 0;

  const ctx = {
    period: { from: weekAgo.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) },
    sales: { current: { orders: weekOrders, total: weekSales }, previous: { orders: prevWeekOrders, total: prevWeekSales }, deltaPct: salesDelta },
    health,
  };

  return callClaude(`Monte RECAP SEMANAL pra Kaique. Hoje é segunda de manhã.

ESTRUTURA EXATA (copie o conteúdo, NÃO inclua code blocks de markdown):

\`\`\`
📅 *Semana DD/mmm a DD/mmm* · Score X 🟢/🟡/🔴

📦 Vendas: R$ X (📈 +Y% / 📉 -Y%)
🛒 Pedidos: N (vs anterior)

✅ Melhorou: [1 ponto]
⚠️ Piorou: [1 ponto]

🎯 *Esta semana:* [decisão em UMA frase]
\`\`\`

REGRAS:
- Máx 700 caracteres TOTAL
- Mostre delta% com sinal e seta de tendência
- Sem "Kaique", sem cumprimento
- Se não houver dado de "Melhorou" ou "Piorou", omita a seção

Dados:\n${JSON.stringify(ctx, null, 2)}`);
}

export async function composeMonthlyRecap(): Promise<string> {
  const now = new Date();
  const lastMonth = new Date();
  lastMonth.setMonth(now.getMonth() - 1);
  const { getDreGerencial } = await import("../../db");

  let dreCurrent: any = null;
  let drePrev: any = null;
  try {
    dreCurrent = await getDreGerencial(lastMonth.getFullYear(), lastMonth.getMonth() + 1);
    const monthBefore = new Date(); monthBefore.setMonth(now.getMonth() - 2);
    drePrev = await getDreGerencial(monthBefore.getFullYear(), monthBefore.getMonth() + 1);
  } catch (e) { /* */ }

  const health = await getFinanceHealth();
  const ctx = {
    monthClosed: `${lastMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}`,
    dre: { current: dreCurrent, previous: drePrev },
    health,
  };

  return callClaude(`Monte RECAP MENSAL pra Kaique. Mês fechou: ${ctx.monthClosed}.

ESTRUTURA EXATA (copie o conteúdo, NÃO inclua code blocks de markdown):

\`\`\`
📊 *FECHAMENTO MMM/AAAA* · Score X

💰 Receita líq: R$ X
💎 Lucro bruto: R$ X (margem Y%)
📊 vs mês ant: 📈/📉 Z%

✅ [destaque positivo curto]
⚠️ [ponto de atenção curto]

🎯 *Próximo movimento:*
[1 frase com ação estratégica]
\`\`\`

REGRAS:
- Máx 1000 caracteres TOTAL
- Foco no número, não na narrativa
- 1 destaque positivo + 1 atenção (não 3 de cada)
- Próximo movimento: 1 ação concreta com prazo

Dados:\n${JSON.stringify(ctx, null, 2)}`);
}

export async function composeUrgentAlert(redVitals: any[]): Promise<string> {
  const ctx = { vitals: redVitals.map(v => ({ key: v.key, title: v.title, value: v.value, detail: v.detail, recommendation: v.recommendation })) };
  const isMulti = redVitals.length > 1;
  return callClaude(`Sinal(is) URGENTE(s) detectado(s) AGORA. Total: ${redVitals.length}.

ESTRUTURA EXATA (copie o conteúdo, NÃO inclua code blocks de markdown):

${isMulti ? `\`\`\`
🚨 *${redVitals.length} sinais críticos*

🔴 [Título 1]: [valor + ação 1 linha]
🔴 [Título 2]: [valor + ação 1 linha]
🔴 [Título 3]: [valor + ação 1 linha]

🎯 [decisão prioritária em 1 frase]
\`\`\`` : `\`\`\`
🚨 *URGENTE — [Título]*

[O que aconteceu em 1 linha]

🎯 *Ação:* [verbo + valor/prazo]
\`\`\``}

REGRAS:
- Máx 300 caracteres TOTAL (sim, BEM curto)
- Sem narrativa, só fatos + ação
- Cada sinal em uma linha quando múltiplos
- Foque no que requer decisão AGORA

Dados:\n${JSON.stringify(ctx, null, 2)}`);
}

async function callClaude(userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return "[Noah] Configure ANTHROPIC_API_KEY pra eu compor a mensagem.";
  }
  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: [{ type: "text", text: PERSONA, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
    });
    let text = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();
    // Strip code fences if Claude wrapped the message in ```...```
    text = text.replace(/^```\w*\n?/gm, "").replace(/\n?```$/gm, "").trim();
    return text || "[Noah] (sem resposta)";
  } catch (err: any) {
    console.error("[noah composer] erro Claude:", err?.message);
    return `[Noah] Erro compor mensagem: ${err?.message ?? "desconhecido"}`;
  }
}
