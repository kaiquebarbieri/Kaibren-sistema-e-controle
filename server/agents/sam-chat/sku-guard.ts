/**
 * SKU Guard — bloqueio pré-envio de respostas da Sam que mencionam
 * códigos de modelo/SKU não respaldados pelo histórico ou pelos pedidos
 * do cliente.
 *
 * Motivação: 2026-04-28, conversa ni4v3a1ats — Sam alucinou "AFN-40"
 * num pedido cujo produto era "NAF-03I 4L" e disse ao cliente que era
 * incompatível (com confidence 95). Cliente recebeu mensagem errada.
 *
 * Regra: se a `reply` cita modelo no padrão LETRAS-NUMEROS que não
 * aparece (a) no histórico da conversa, (b) nos pedidos do buyer
 * dentro da Kaibren, ou (c) na lista de allowlist conhecida — bloqueia.
 */
import { desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { marketplaceOrders } from "../../../drizzle/schema";

const MODEL_REGEX = /\b([a-z]{2,5})\s*[-_]?\s*(\d{2,4}[a-z]?)\b/gi;

function normalize(letters: string, digits: string): string {
  return `${letters.toUpperCase()}-${digits.toUpperCase()}`;
}

export function extractModels(text: string): string[] {
  if (!text) return [];
  const set = new Set<string>();
  const re = new RegExp(MODEL_REGEX.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) set.add(normalize(m[1], m[2]));
  return Array.from(set);
}

export interface SkuGuardResult {
  ok: boolean;
  reason?: string;
  mentionedInReply: string[];
  validModels: string[];
  unauthorized: string[];
}

interface GuardConv {
  conversationId: string;
  buyerId: string;
}

export async function validateSkuConsistency(
  reply: string,
  conv: GuardConv,
  history: { text: string }[],
): Promise<SkuGuardResult> {
  const mentionedInReply = extractModels(reply);
  if (mentionedInReply.length === 0) {
    return { ok: true, mentionedInReply: [], validModels: [], unauthorized: [] };
  }

  const valid = new Set<string>();
  const histText = history.map((h) => h.text || "").join(" ");
  for (const m of extractModels(histText)) valid.add(m);

  const db = await getDb();
  if (db) {
    const orders = await db
      .select({
        productName: marketplaceOrders.productName,
        productSku: marketplaceOrders.productSku,
      })
      .from(marketplaceOrders)
      .where(eq(marketplaceOrders.buyerExternalId, conv.buyerId))
      .orderBy(desc(marketplaceOrders.platformCreatedAt))
      .limit(20);
    for (const o of orders) {
      for (const m of extractModels(`${o.productName ?? ""} ${o.productSku ?? ""}`)) {
        valid.add(m);
      }
    }
  }

  const unauthorized = mentionedInReply.filter((m) => !valid.has(m));
  if (unauthorized.length === 0) {
    return { ok: true, mentionedInReply, validModels: Array.from(valid), unauthorized: [] };
  }

  return {
    ok: false,
    reason: `Resposta cita modelo(s) ${unauthorized.join(", ")} que não aparecem no histórico da conversa nem nos pedidos do cliente.`,
    mentionedInReply,
    validModels: Array.from(valid),
    unauthorized,
  };
}
