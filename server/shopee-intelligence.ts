/**
 * Shopee Intelligence — Dados + Análise IA
 *
 * Coleta métricas operacionais da conta Shopee e gera análise
 * estratégica via IA para recuperar/escalar vendas.
 */

import { eq, and, gte, desc, sql } from "drizzle-orm";
import { getDb } from "./db";
import { marketplaceOrders } from "../drizzle/schema";
import { getConnectedShops, fetchShopeeOrders, fetchShopeeProducts, type ShopeeShop } from "./shopee";
import { invokeLLM } from "./_core/llm";

// ---------- Coleta de dados ----------

export async function getShopeeHealthData() {
  const db = await getDb();
  if (!db) return null;

  const shops = await getConnectedShops();
  if (shops.length === 0) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Pedidos do banco (já sincronizados)
  const allOrders = await db.select().from(marketplaceOrders)
    .where(eq(marketplaceOrders.platform, "shopee"))
    .orderBy(desc(marketplaceOrders.platformCreatedAt));

  // Separar por período
  const ordersToday = allOrders.filter(o => o.platformCreatedAt >= today);
  const ordersWeek = allOrders.filter(o => o.platformCreatedAt >= weekAgo);
  const ordersMonth = allOrders.filter(o => o.platformCreatedAt >= monthAgo);
  const ordersPrevMonth = allOrders.filter(o => o.platformCreatedAt >= twoMonthsAgo && o.platformCreatedAt < monthAgo);

  // Excluir cancelados para totais de vendas
  const activeOrders = (orders: typeof allOrders) => orders.filter(o => !['cancelled', 'in_cancel'].includes(o.status));
  const sumAmount = (orders: typeof allOrders) => orders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);

  // Pedidos aguardando envio
  const pendingShipment = allOrders.filter(o => o.status === 'ready_to_ship');
  const pendingWithHours = pendingShipment.map(o => ({
    id: o.externalId,
    product: o.productName,
    hours: Math.round((now.getTime() - o.platformCreatedAt.getTime()) / 3600000),
    amount: Number(o.totalAmount),
  }));

  // Taxa de cancelamento (últimos 30 dias)
  const cancelledMonth = ordersMonth.filter(o => ['cancelled', 'in_cancel'].includes(o.status));
  const cancelRate = ordersMonth.length > 0 ? (cancelledMonth.length / ordersMonth.length) * 100 : 0;

  // Top produtos (últimos 30 dias, sem cancelados)
  const productMap = new Map<string, { name: string; revenue: number; qty: number; orders: number }>();
  for (const o of activeOrders(ordersMonth)) {
    const key = o.productName;
    const existing = productMap.get(key) || { name: key, revenue: 0, qty: 0, orders: 0 };
    existing.revenue += Number(o.totalAmount || 0);
    existing.qty += o.quantity;
    existing.orders++;
    productMap.set(key, existing);
  }
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Vendas por dia (últimos 14 dias)
  const dailySales: Array<{ date: string; total: number; orders: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const dayOrders = activeOrders(allOrders.filter(o => o.platformCreatedAt >= dayStart && o.platformCreatedAt < dayEnd));
    dailySales.push({
      date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      total: Math.round(sumAmount(dayOrders) * 100) / 100,
      orders: dayOrders.length,
    });
  }

  // Buscar produtos ativos da API
  let activeProducts: any[] = [];
  let outOfStock: any[] = [];
  try {
    for (const shop of shops) {
      const products = await fetchShopeeProducts(shop);
      activeProducts = products;
      outOfStock = products.filter((p: any) => {
        const stock = p.stock_info_v2?.summary_info?.total_available_stock ?? p.stock ?? 999;
        return stock <= 0;
      });
    }
  } catch (e) { /* non-fatal */ }

  // Semáforos
  const alerts: Array<{ level: 'red' | 'yellow' | 'green'; message: string }> = [];

  // Pedidos para enviar
  const urgentShipments = pendingWithHours.filter(p => p.hours >= 12);
  if (urgentShipments.length > 0) {
    alerts.push({ level: 'red', message: `${urgentShipments.length} pedido(s) aguardando envio há mais de 12h` });
  } else if (pendingShipment.length > 0) {
    alerts.push({ level: 'yellow', message: `${pendingShipment.length} pedido(s) aguardando envio` });
  } else {
    alerts.push({ level: 'green', message: 'Todos os pedidos enviados' });
  }

  // Cancelamentos
  if (cancelRate > 5) {
    alerts.push({ level: 'red', message: `Taxa de cancelamento: ${cancelRate.toFixed(1)}% (acima de 5%)` });
  } else if (cancelRate > 2) {
    alerts.push({ level: 'yellow', message: `Taxa de cancelamento: ${cancelRate.toFixed(1)}%` });
  } else {
    alerts.push({ level: 'green', message: `Taxa de cancelamento: ${cancelRate.toFixed(1)}%` });
  }

  // Estoque
  if (outOfStock.length > 0) {
    alerts.push({ level: 'red', message: `${outOfStock.length} produto(s) sem estoque` });
  } else {
    alerts.push({ level: 'green', message: 'Todos os produtos com estoque' });
  }

  // Tendência de vendas
  const thisMonthTotal = sumAmount(activeOrders(ordersMonth));
  const prevMonthTotal = sumAmount(activeOrders(ordersPrevMonth));
  if (prevMonthTotal > 0) {
    const change = ((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100;
    if (change < -20) {
      alerts.push({ level: 'red', message: `Vendas caíram ${Math.abs(change).toFixed(0)}% vs mês anterior` });
    } else if (change < 0) {
      alerts.push({ level: 'yellow', message: `Vendas caíram ${Math.abs(change).toFixed(0)}% vs mês anterior` });
    } else {
      alerts.push({ level: 'green', message: `Vendas subiram ${change.toFixed(0)}% vs mês anterior` });
    }
  }

  return {
    shop: shops[0] ? { id: shops[0].shopId, name: shops[0].shopName } : null,
    today: {
      revenue: Math.round(sumAmount(activeOrders(ordersToday)) * 100) / 100,
      orders: activeOrders(ordersToday).length,
    },
    week: {
      revenue: Math.round(sumAmount(activeOrders(ordersWeek)) * 100) / 100,
      orders: activeOrders(ordersWeek).length,
    },
    month: {
      revenue: Math.round(thisMonthTotal * 100) / 100,
      orders: activeOrders(ordersMonth).length,
    },
    prevMonth: {
      revenue: Math.round(prevMonthTotal * 100) / 100,
      orders: activeOrders(ordersPrevMonth).length,
    },
    alerts,
    pendingShipment: pendingWithHours,
    cancelRate: Math.round(cancelRate * 10) / 10,
    topProducts,
    dailySales,
    outOfStock: outOfStock.map((p: any) => ({
      id: p.item_id,
      name: p.item_name || 'Produto',
    })),
    totalProducts: activeProducts.length,
  };
}

// ---------- Análise IA ----------

export async function generateShopeeAnalysis(healthData: any): Promise<string> {
  const prompt = `Você é Sam 🛒, analista de vendas da Kaibren. Analise os dados da loja Shopee "${healthData.shop?.name}" e dê uma análise estratégica ACIONÁVEL.

DADOS DA CONTA:
- Hoje: R$${healthData.today.revenue} (${healthData.today.orders} pedidos)
- Semana: R$${healthData.week.revenue} (${healthData.week.orders} pedidos)
- Mês atual: R$${healthData.month.revenue} (${healthData.month.orders} pedidos)
- Mês anterior: R$${healthData.prevMonth.revenue} (${healthData.prevMonth.orders} pedidos)
- Taxa de cancelamento: ${healthData.cancelRate}%
- Pedidos aguardando envio: ${healthData.pendingShipment.length}
${healthData.pendingShipment.filter((p: any) => p.hours >= 12).length > 0 ? `- ⚠️ ${healthData.pendingShipment.filter((p: any) => p.hours >= 12).length} pedido(s) com mais de 12h aguardando envio!` : ''}
- Produtos sem estoque: ${healthData.outOfStock.length}
- Total produtos ativos: ${healthData.totalProducts}

TOP PRODUTOS (mês):
${healthData.topProducts.map((p: any, i: number) => `${i + 1}. ${p.name} — R$${p.revenue.toFixed(2)} (${p.qty}un, ${p.orders} pedidos)`).join('\n')}

VENDAS DIÁRIAS (14 dias):
${healthData.dailySales.map((d: any) => `${d.date}: R$${d.total} (${d.orders} pedidos)`).join('\n')}

ALERTAS:
${healthData.alerts.map((a: any) => `${a.level === 'red' ? '🔴' : a.level === 'yellow' ? '🟡' : '🟢'} ${a.message}`).join('\n')}

CONTEXTO: A loja vendia bem mas as vendas caíram. O dono quer entender POR QUE caiu e O QUE FAZER para recuperar.

Responda em português brasileiro com:
1. **DIAGNÓSTICO** — O que os dados mostram sobre a queda (seja específico com números)
2. **AÇÕES IMEDIATAS** — O que fazer HOJE (máximo 3 ações)
3. **ESTRATÉGIA 7 DIAS** — Plano da semana para recuperar vendas
4. **PRODUTOS** — Quais produtos focar e por quê

Seja direto, prático e use os números. Nada genérico.`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "Você é Sam 🛒, analista de vendas especialista em Shopee. Responda sempre em português brasileiro, de forma direta e estratégica. Use markdown para formatar." },
        { role: "user", content: prompt },
      ],
      maxTokens: 2048,
    });

    const content = result.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    }
    return "Não foi possível gerar a análise no momento.";
  } catch (err: any) {
    console.error("[Shopee IA] Erro:", err.message);
    return `Erro ao gerar análise: ${err.message}`;
  }
}
