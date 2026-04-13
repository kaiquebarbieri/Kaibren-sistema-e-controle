/**
 * Noah Command Center — Cerebro da Operacao
 *
 * Noah monitora todos os agentes, cobra resultados,
 * gera briefings diarios e toma decisoes estrategicas.
 */

import { getDb } from "./db";
import { agents, agentLogs, agentAlerts, agentTasks, marketplaceOrders, products } from "../drizzle/schema";
import { eq, desc, gte, and, sql, count as drizzleCount } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { getShopeeAdsDashboard } from "./shopee-ads";
import { getShopeeSalesSummary } from "./shopee";
import { getMLSalesSummary } from "./mercadolivre";

// ---------- Coleta de dados de toda a operacao ----------

export async function getOperationsSnapshot() {
  const db = await getDb();

  // Vendas ML
  let mlSummary = { total: 0, today: 0, todayCount: 0, thisWeek: 0, thisMonth: 0, orderCount: 0, accounts: [] as any[] };
  try { mlSummary = await getMLSalesSummary(); } catch {}

  // Vendas Shopee
  let shopeeSummary = { total: 0, today: 0, todayCount: 0, thisWeek: 0, thisMonth: 0, orderCount: 0, accounts: [] as any[] };
  try { shopeeSummary = await getShopeeSalesSummary(); } catch {}

  // Ads Shopee
  let adsDash: any = null;
  try { adsDash = await getShopeeAdsDashboard(); } catch {}

  // Agentes
  let agentList: any[] = [];
  let recentLogs: any[] = [];
  let openAlerts: any[] = [];
  let pendingTasks: any[] = [];

  if (db) {
    try {
      agentList = await db.select().from(agents).orderBy(agents.name);
      recentLogs = await db.select().from(agentLogs).orderBy(desc(agentLogs.createdAt)).limit(20);
      openAlerts = await db.select().from(agentAlerts).where(eq(agentAlerts.isRead, 0)).orderBy(desc(agentAlerts.createdAt)).limit(10);
      pendingTasks = await db.select().from(agentTasks).where(eq(agentTasks.status, "pending")).orderBy(agentTasks.scheduledAt).limit(10);
    } catch {}
  }

  // Produtos com baixo estoque ou sem estoque (top preocupacoes)
  let lowStockProducts: any[] = [];
  if (db) {
    try {
      const rows = await db.select({
        nome: products.nome,
        sku: products.sku,
        preco: products.precoFinal,
      }).from(products).limit(5);
      lowStockProducts = rows;
    } catch {}
  }

  return {
    vendas: {
      mlHoje: mlSummary.today,
      mlMes: mlSummary.thisMonth,
      mlContas: mlSummary.accounts?.length || 0,
      shopeeHoje: shopeeSummary.today,
      shopeeMes: shopeeSummary.thisMonth,
      totalHoje: (mlSummary.today || 0) + (shopeeSummary.today || 0),
      totalMes: (mlSummary.thisMonth || 0) + (shopeeSummary.thisMonth || 0),
      pedidosHoje: (mlSummary.todayCount || 0) + (shopeeSummary.todayCount || 0),
    },
    ads: adsDash ? {
      saldo: adsDash.balance,
      gasto7d: adsDash.kpis.expense7d,
      vendas7d: adsDash.kpis.directGmv7d,
      roas: adsDash.kpis.roas7d,
      ctr: adsDash.kpis.ctr7d,
      campanhasAtivas: adsDash.activeCampaigns,
      alertas: adsDash.alerts,
    } : null,
    agentes: {
      total: agentList.length,
      ativos: agentList.filter((a: any) => a.status === "active").length,
      lista: agentList.map((a: any) => ({
        slug: a.slug,
        name: a.name,
        role: a.role,
        emoji: a.avatarEmoji,
        status: a.status,
        lastActivity: a.lastActivity,
      })),
    },
    alertasAbertos: openAlerts.map((a: any) => ({
      level: a.level,
      title: a.title,
      message: a.message,
      createdAt: a.createdAt,
    })),
    tarefasPendentes: pendingTasks.map((t: any) => ({
      title: t.title,
      description: t.description,
      scheduledAt: t.scheduledAt,
    })),
    logsRecentes: recentLogs.slice(0, 10).map((l: any) => ({
      type: l.type,
      content: l.content?.substring(0, 200),
      createdAt: l.createdAt,
    })),
  };
}

// ---------- Briefing diario do Noah ----------

export async function generateNoahBriefing(): Promise<string> {
  const ops = await getOperationsSnapshot();

  const prompt = `Você é Noah 🦾, o CEO Virtual da Kaibren. Gere o BRIEFING DIÁRIO da operação.

DATA: ${new Date().toLocaleDateString("pt-BR")}

## VENDAS HOJE
- ML: R$${ops.vendas.mlHoje} | Shopee: R$${ops.vendas.shopeeHoje}
- Total hoje: R$${ops.vendas.totalHoje} (${ops.vendas.pedidosHoje} pedidos)
- Mês ML: R$${ops.vendas.mlMes} | Mês Shopee: R$${ops.vendas.shopeeMes}
- Total mês: R$${ops.vendas.totalMes}

## ADS SHOPEE
${ops.ads ? `- Saldo: R$${ops.ads.saldo ?? 'N/A'}
- Gasto 7d: R$${ops.ads.gasto7d} → Vendas 7d: R$${ops.ads.vendas7d}
- ROAS: ${ops.ads.roas}x | CTR: ${ops.ads.ctr}%
- Campanhas ativas: ${ops.ads.campanhasAtivas}
${ops.ads.alertas?.map((a: any) => `  ${a.level === 'red' ? '🔴' : a.level === 'yellow' ? '🟡' : '🟢'} ${a.message}`).join('\n') || ''}` : '- Sem dados de Ads'}

## EQUIPE IA
- ${ops.agentes.total} agentes (${ops.agentes.ativos} ativos)
${ops.agentes.lista.map((a: any) => `- ${a.emoji} ${a.name} [${a.status}] — ${a.role}`).join('\n')}

## ALERTAS ABERTOS: ${ops.alertasAbertos.length}
${ops.alertasAbertos.map((a: any) => `- [${a.level}] ${a.title}: ${a.message}`).join('\n') || 'Nenhum alerta'}

## TAREFAS PENDENTES: ${ops.tarefasPendentes.length}
${ops.tarefasPendentes.map((t: any) => `- ${t.title}`).join('\n') || 'Nenhuma tarefa'}

Gere o briefing em formato:

1. **RESUMO EXECUTIVO** — 3 linhas sobre o estado da operação
2. **COBRANCAS** — O que cada agente deveria ter feito e não fez? Sam está entregando ROAS? Vendas estão na meta?
3. **RISCOS** — O que pode dar errado hoje/esta semana
4. **PRIORIDADES DO DIA** — Top 3 ações que o Kaique precisa ver/aprovar
5. **DECISOES PENDENTES** — O que precisa de decisão humana

Seja duro na cobrança. Sem rodeios. Isso é um briefing de CEO, não relatório bonito.`;

  try {
    const result = await invokeLLM({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Você é Noah 🦾, CEO Virtual da Kaibren. Opera como um CEO exigente que cobra resultados. Vende peças Mondial. Equipe pequena (Kaique + Brenda + 2 func). Canais: Shopee, ML, Amazon, loja física. As vendas caíram e você está cobrando recuperação. Responda em português brasileiro, direto, com markdown." },
        { role: "user", content: prompt },
      ],
      maxTokens: 3000,
    });

    const content = result.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    }
    return "Briefing não disponível.";
  } catch (err: any) {
    console.error("[Noah] Briefing erro:", err.message);
    return `Erro: ${err.message}`;
  }
}

// ---------- Chat com Noah ----------

// Cache do snapshot pra nao buscar tudo a cada mensagem
let _snapshotCache: { data: any; ts: number } | null = null;
const SNAPSHOT_TTL = 2 * 60 * 1000; // 2 minutos

async function getCachedSnapshot() {
  if (_snapshotCache && Date.now() - _snapshotCache.ts < SNAPSHOT_TTL) {
    return _snapshotCache.data;
  }
  const data = await getOperationsSnapshot();
  _snapshotCache = { data, ts: Date.now() };
  return data;
}

export async function askNoah(question: string): Promise<string> {
  const ops = await getCachedSnapshot();

  const context = `ESTADO ATUAL DA OPERAÇÃO KAIBREN (${new Date().toLocaleDateString("pt-BR")}):
Vendas hoje: R$${ops.vendas.totalHoje} (${ops.vendas.pedidosHoje} pedidos) | ML: R$${ops.vendas.mlHoje} | Shopee: R$${ops.vendas.shopeeHoje}
Mês: R$${ops.vendas.totalMes} (ML: R$${ops.vendas.mlMes} | Shopee: R$${ops.vendas.shopeeMes})
${ops.ads ? `Ads Shopee: gasto 7d R$${ops.ads.gasto7d} → vendas R$${ops.ads.vendas7d} | ROAS ${ops.ads.roas}x | ${ops.ads.campanhasAtivas} campanhas ativas` : 'Ads: sem dados'}
Agentes: ${ops.agentes.ativos}/${ops.agentes.total} ativos
Alertas: ${ops.alertasAbertos.length} abertos
Tarefas pendentes: ${ops.tarefasPendentes.length}`;

  try {
    const result = await invokeLLM({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `Você é Noah, CEO Virtual da Kaibren — estilo JARVIS do Homem de Ferro. Fale em português, seja direto, confiante e conciso. Máximo 3 frases por resposta. Sem bullet points, sem markdown — você está FALANDO, não escrevendo. Use tom calmo e profissional, como um assessor de confiança. Chame o Kaique de "chefe" ocasionalmente. Você tem dados reais da operação abaixo.\n\n${context}` },
        { role: "user", content: question },
      ],
      maxTokens: 300,
    });

    const content = result.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) return content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    return "Desculpe chefe, tive um problema ao processar.";
  } catch (err: any) {
    return `Erro na conexão: ${err.message}`;
  }
}
