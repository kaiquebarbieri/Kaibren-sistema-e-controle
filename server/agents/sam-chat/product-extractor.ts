/**
 * Product Extractor — extrai informação estruturada dos anúncios Shopee.
 *
 * Lê título + descrição de cada produto indexado pelo curator e extrai via Claude:
 *  - marca, tipo_aparelho, tipo_peca
 *  - modelos_compativeis (lista — ex: ["NAF-03", "NAF-05"])
 *  - capacidades (ex: ["3L", "4L"])
 *  - voltagens (ex: ["110V", "220V", "bivolt"])
 *  - alertas (lista de avisos importantes — ex: "Não compatível com multiprocessador")
 *
 * Resultado salvo em shopee_chat_knowledge.structuredData (JSON).
 * Re-extrai apenas se descriptionHash mudou.
 */

import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { shopeeChatKnowledge } from "../../../drizzle/schema";

const MODEL = process.env.SAM_EXTRACTOR_MODEL || "claude-sonnet-4-6";

const EXTRACTOR_SYSTEM = `Você é um extrator de dados de anúncios de peças de reposição de eletrodomésticos.

Recebe título + descrição de um anúncio Shopee e devolve JSON estruturado com:
- marca do aparelho compatível (Mondial, Britânia, Philco, Arno, Cadence, Electrolux, Black+Decker, Oster, etc.)
- tipo_aparelho (air fryer, liquidificador, ventilador, batedeira, processador, sanduicheira, etc.)
- tipo_peca (puxador, cesto, botão, copo, resistência, termostato, hélice, jarra, etc.)
- modelos_compativeis: array dos códigos de modelo que o anúncio cita como compatíveis (ex: NAF-03, AFN-40, L-99, B-92). Inclua TODAS as variações listadas. Se NAF-03 e NAF-03I são citados, inclua os dois.
- capacidades: array das capacidades em litros (ex: ["3L", "4L"]) — só se o anúncio mencionar
- voltagens: array (ex: ["110V"], ["220V"], ["bivolt"]) — só se mencionado
- alertas: array de avisos importantes que ajudam o cliente a não comprar errado. Exemplos:
  - "Existe versão 3L e 4L com peças diferentes — confirmar capacidade do aparelho"
  - "Não é compatível com multiprocessador, apenas liquidificador"
  - "Apenas para versão bivolt automática"
  Se o anúncio não tiver alertas claros, devolve array vazio.
- extraction_status: "complete" se conseguiu extrair marca + tipo_aparelho + tipo_peca + ao menos 1 modelo. "incomplete" caso contrário.
- missing_info: array com o que falta — só preenche se incomplete. Exemplos: "modelos compatíveis não listados", "capacidade não especificada"

Regras:
- Se o anúncio é genérico (ex: "cesto universal air fryer"), modelos_compativeis pode ficar vazio mas marca/tipo devem vir.
- NÃO invente modelos. Só extraia o que está literal no texto.
- Modelos vêm como códigos curtos: letras + números + traços. Normalize maiúsculo (NAF-03, não naf-03).
- Se o título diz "Mondial NAF-03 4L" e a descrição lista também NAF-05, NAF-03I → modelos_compativeis: ["NAF-03", "NAF-03I", "NAF-05"], capacidades: ["4L"].
- alertas é o campo mais importante pra atendimento. Pense: "o que o cliente pode comprar achando que serve mas não serve?" Se a descrição menciona qualquer pegadinha, vira alerta.

Devolva SOMENTE JSON válido, sem markdown, sem texto extra.`;

export interface StructuredProductData {
  marca: string | null;
  tipo_aparelho: string | null;
  tipo_peca: string | null;
  modelos_compativeis: string[];
  capacidades: string[];
  voltagens: string[];
  alertas: string[];
  extraction_status: "complete" | "incomplete";
  missing_info: string[];
}

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function parseJson(raw: string): StructuredProductData | null {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "");
  try {
    const obj = JSON.parse(cleaned);
    return {
      marca: obj.marca || null,
      tipo_aparelho: obj.tipo_aparelho || null,
      tipo_peca: obj.tipo_peca || null,
      modelos_compativeis: Array.isArray(obj.modelos_compativeis) ? obj.modelos_compativeis.map((s: any) => String(s).toUpperCase()) : [],
      capacidades: Array.isArray(obj.capacidades) ? obj.capacidades.map(String) : [],
      voltagens: Array.isArray(obj.voltagens) ? obj.voltagens.map(String) : [],
      alertas: Array.isArray(obj.alertas) ? obj.alertas.map(String) : [],
      extraction_status: obj.extraction_status === "complete" ? "complete" : "incomplete",
      missing_info: Array.isArray(obj.missing_info) ? obj.missing_info.map(String) : [],
    };
  } catch {
    return null;
  }
}

export async function extractStructuredData(
  title: string,
  description: string,
): Promise<StructuredProductData | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[Sam Extractor] ANTHROPIC_API_KEY ausente");
    return null;
  }

  const client = new Anthropic({ apiKey });
  const userText = [
    `**Título:** ${title}`,
    "",
    `**Descrição:**`,
    description || "(sem descrição)",
  ].join("\n");

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system: [
        { type: "text", text: EXTRACTOR_SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userText }],
    });
    const text = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
    return parseJson(text);
  } catch (err: any) {
    console.error("[Sam Extractor] erro Claude:", err?.message);
    return null;
  }
}

interface ProductRow {
  id: number;
  scope: string | null;
  title: string;
  body: string;
  descriptionHash: string | null;
  extractionStatus: string | null;
}

function extractDescriptionFromBody(body: string): string {
  const idx = body.indexOf("**Descrição:**");
  if (idx === -1) return "";
  return body.slice(idx + "**Descrição:**".length).trim();
}

export async function runExtractor(
  options: { force?: boolean; limit?: number } = {},
): Promise<{
  scanned: number;
  extracted: number;
  complete: number;
  incomplete: number;
  failed: number;
  skipped: number;
}> {
  const db = await getDb();
  if (!db) return { scanned: 0, extracted: 0, complete: 0, incomplete: 0, failed: 0, skipped: 0 };

  const limit = options.limit ?? 50;
  const force = options.force ?? false;

  const rows = await db
    .select({
      id: shopeeChatKnowledge.id,
      scope: shopeeChatKnowledge.scope,
      title: shopeeChatKnowledge.title,
      body: shopeeChatKnowledge.body,
      descriptionHash: shopeeChatKnowledge.descriptionHash,
      extractionStatus: shopeeChatKnowledge.extractionStatus,
    })
    .from(shopeeChatKnowledge)
    .where(eq(shopeeChatKnowledge.type, "produto"))
    .limit(limit);

  let extracted = 0;
  let complete = 0;
  let incomplete = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows as ProductRow[]) {
    const description = extractDescriptionFromBody(row.body);
    const hashInput = `${row.title}\n${description}`;
    const currentHash = sha256(hashInput);

    if (!force && row.descriptionHash === currentHash && row.extractionStatus === "complete") {
      skipped++;
      continue;
    }

    const result = await extractStructuredData(row.title, description);

    if (!result) {
      await db
        .update(shopeeChatKnowledge)
        .set({
          extractionStatus: "failed",
          descriptionHash: currentHash,
          extractedAt: new Date(),
        })
        .where(eq(shopeeChatKnowledge.id, row.id));
      failed++;
      continue;
    }

    await db
      .update(shopeeChatKnowledge)
      .set({
        structuredData: JSON.stringify(result),
        extractionStatus: result.extraction_status,
        descriptionHash: currentHash,
        extractedAt: new Date(),
      })
      .where(eq(shopeeChatKnowledge.id, row.id));

    extracted++;
    if (result.extraction_status === "complete") complete++;
    else incomplete++;
  }

  return { scanned: rows.length, extracted, complete, incomplete, failed, skipped };
}
