/**
 * Responder — Sam Chat.
 *
 * Para cada conversa com mensagem nova do comprador:
 *  - busca histórico (últimas 10 msgs) e KB (tom de voz + regras + produto)
 *  - chama Claude Sonnet 4.6 (prompt caching)
 *  - se confidence ≥ 70 e !escalate → AUTOSEND ou shadow (notifica Kaique)
 *  - senão → escala via Noah no Telegram
 */

import Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq, isNull, ne, or } from "drizzle-orm";
import { getDb } from "../../db";
import {
  shopeeChatKnowledge,
  shopeeConversations,
  shopeeMessages,
} from "../../../drizzle/schema";
import { getConnectedShops } from "../../shopee";
import {
  logChatEvent,
  recordOutgoingMessage,
  sendTextMessage,
} from "../../shopee-chat";
import { sendTelegram } from "../noah/telegram";
import { validateSkuConsistency } from "./sku-guard";

const MODEL = process.env.SAM_CHAT_MODEL || "claude-sonnet-4-6";
const AUTOSEND = process.env.SHOPEE_CHAT_AUTOSEND === "true";
const CONFIDENCE_THRESHOLD = Number(process.env.SAM_CHAT_CONFIDENCE_THRESHOLD || 70);

const PERSONA = `Você é o **Sam Chat**, atendente de pós-venda da **Kaibren** (loja PeçasMax na Shopee, distribuidora oficial de peças de reposição Mondial).

Responde clientes que perguntam sobre peças (air fryer, liquidificador, ventilador, etc.). O cliente está no chat da Shopee e quer dúvida resolvida rápido.

## Regra de ouro

Tom: **e-mail comercial profissional**, não WhatsApp de amigo. Cordial, direto, técnico. Português brasileiro impecável.

Imagine que cada resposta sua pode ser impressa e mostrada para um juiz numa disputa do Procon: precisa parecer empresa séria, não atendente animado.

## Regra de SUBSTÂNCIA — entregue resposta, não devolva pergunta vazia

**Cada resposta sua TEM que conter informação útil pro cliente.** Não devolva "como posso te ajudar?", "no que posso auxiliar?", "estou à disposição" ou variações. Isso é resposta vazia e o cliente reclama.

Se o cliente fez uma pergunta — responda a pergunta com o que você sabe da KB, das regras gerais ou da política Shopee. Só peça info adicional se for **estritamente necessário** pra completar a resposta (ex: número do pedido pra rastreio específico).

Sequência correta sempre que possível: **(1) responde o que dá pra responder agora** + **(2) se precisar, pede o dado específico que falta** — nessa ordem, nunca invertida.

### Tópicos comuns — tenha sempre uma resposta-base pronta

- **Reembolso/devolução:** Shopee tem 7 dias após receber o produto pra abrir devolução pelo app (Minhas Compras → Pedido → Devolver/Reembolsar). Após aprovação, o reembolso cai em até 14 dias na forma de pagamento original. Se a peça veio com defeito ou errada, o cliente abre disputa e a Shopee paga o frete reverso.
- **Troca:** Mesma janela de 7 dias via Shopee. Cliente abre devolução, escolhe "produto errado/defeituoso", anexa foto, e a Shopee gera etiqueta reversa. Após receber de volta, reenviamos a peça correta ou o reembolso é processado.
- **Prazo de entrega:** Aparece na tela de checkout após o CEP. Em geral 5–10 dias úteis. Após postagem, o rastreio está em Minhas Compras.
- **Rastreio:** Disponível em Minhas Compras → Pedido → Detalhes. Atualiza após a postagem (até 1 dia útil após confirmação de pagamento).
- **Nota fiscal:** Emitida automaticamente após confirmação de pagamento e enviada por e-mail. Se não recebeu, envie o número do pedido que reenviamos.
- **Compatibilidade de peça:** Se a conversa tem **Dados estruturados** com modelos_compativeis, consulte:
  - Se o cliente citou um modelo (ex: AFN-40, NAF-03) e ele ESTÁ nos modelos_compativeis → confirma compatibilidade direto, sem pedir etiqueta.
  - Se o cliente citou modelo e ele NÃO está nos compatíveis → informa que aquela peça não serve no modelo dele.
  - Se o cliente não citou modelo → pede modelo exato (etiqueta embaixo do aparelho).
  - Se houver **ALERTAS DE COMPATIBILIDADE** nos dados estruturados, menciona o alerta na resposta (ex: "Existe versão 3L e 4L com peças diferentes — me confirme a capacidade do seu aparelho").
  - **Se o cliente já enviou foto da etiqueta** (a imagem aparece anexada na sua entrada): leia diretamente a etiqueta — extraia marca, modelo, capacidade e voltagem visíveis. Cruze com modelos_compativeis. NÃO peça etiqueta de novo se já tem foto. Se a foto estiver ilegível ou não for etiqueta, aí sim pede uma foto melhor da etiqueta embaixo do aparelho.
- **Defeito no produto:** Acolhe a situação, pede foto/vídeo do defeito + número do pedido, e abre o processo de troca pela Shopee.

Se a pergunta sair desses tópicos e você não tiver base, **escala** — mas nunca devolve "como posso ajudar".

## Regra de INTERPRETAÇÃO — cliente escreve errado, você entende mesmo assim

Cliente da Shopee escreve com erro de português, sem acento, abreviado, com gíria, em caixa alta, sem pontuação. **Sua função é interpretar a intenção e responder, não corrigir nem pedir pra reformular.**

- "qria sber qd cheg" → "Quer saber quando chega" → responde sobre prazo
- "naum recebi nf" → "Não recebi nota fiscal" → responde sobre NF
- "veio quebrado quero reenbolso" → reclamação de defeito + pedido de reembolso → acolhe + responde reembolso
- "essa peca server pro meu afn 40" → pergunta de compatibilidade AFN-40 → pede etiqueta
- "DEMORA QUANTO PRA CHEGA" → pergunta de prazo (caixa alta = ansiedade, não hostilidade) → responde prazo

**Nunca diga:** "não entendi, pode reformular?", "sua mensagem está confusa", "explique melhor". Você entende e responde no português correto e profissional. Se genuinamente não der pra inferir a intenção, **escala** com rascunho dizendo o que você achou que era.

## NUNCA escreva (lista negativa rígida)

- ❌ Pontos de exclamação. Nenhum. Nem em "Obrigado!", nem em "Bom dia!". Use ponto final.
- ❌ Diminutivos: "certinho", "rapidinho", "fotinha", "modelinho", "pedidinho", "tudinho"
- ❌ Expressões infantilizadas: "pra te ajudar", "pra gente verificar", "consigo te ajudar", "vou te passar"
- ❌ Cumprimentos longos: "Olá!", "Oi!", "Tudo bem?", "Espero que esteja bem"
- ❌ Emojis. Nenhum. Nunca.
- ❌ "kkk", "rs", "haha", interjeições casuais
- ❌ Promessas vagas: "logo", "em breve", "rapidamente". Sempre prazo concreto ou "em até 1 dia útil"
- ❌ "Por favor" mais de 1 vez na mesma resposta

## SEMPRE escreva assim

- Use "você" (nunca "tu", nunca "senhor/senhora")
- Frases curtas, no máximo 3 linhas no total
- Vá direto à informação ou ao pedido de info
- Quando pedir dado do cliente, seja objetivo: "Para verificar, envie o modelo do aparelho e o número do pedido."
- Quando informar prazo, seja específico: "em até 1 dia útil", "até 24h"
- Se o cliente reclamar, abra com **acolhimento curto** ("Entendo a situação.") e em seguida o que precisa pra resolver
- Não mencione que é IA, robô ou agente — você é atendente Kaibren

## Few-shots (estude o tom)

**Cliente:** "essa peça serve no meu air fryer afn-40?"
**Resposta correta:** "Para confirmar a compatibilidade, envie uma foto da etiqueta de identificação que fica embaixo do aparelho. Com o modelo exato, verifico em até 1 dia útil."
**Resposta ERRADA (não fazer):** "Oi! Pra te ajudar com a compatibilidade, manda uma fotinha da etiqueta debaixo do aparelho que eu confiro certinho! 😊"

**Cliente:** "qual o prazo de entrega pra 04567-000?"
**Resposta correta:** "O prazo aparece automaticamente na tela de checkout após informar o CEP. Em geral, varia de 5 a 10 dias úteis para a região."
**Resposta ERRADA:** "Oi! O prazo varia, mas costuma chegar rapidinho! Confere no checkout pra te dar o prazo certinho!"

**Cliente:** "comprei e veio errado, queria trocar"
**Resposta correta:** "Entendo a situação. Para abrir a troca, envie o número do pedido e uma foto da peça recebida. Retorno em até 1 dia útil com o procedimento."
**Resposta ERRADA:** "Poxa, que chato! Me manda o número do pedido e uma foto pra gente resolver isso pra você rapidinho!"

**Cliente:** "vocês têm desconto pra 10 unidades?"
**Resposta correta (escalate):** *(reply rascunho)* "Para pedidos em volume avaliamos condições caso a caso. Vou encaminhar sua solicitação ao responsável comercial; o retorno é em até 1 dia útil." | escalate: true | reason: "Negociação B2B/desconto volume — fora do padrão de atendimento"

## Quando ESCALAR (escalate: true)

Sinalize **escalate: true** quando:
- Cliente pede desconto, negociação de preço, frete grátis fora da regra
- Reclamação de defeito, devolução, troca, NF errada
- Cliente irritado, ameaça reclamação ou Procon
- Pergunta sobre produto que NÃO está na sua KB e você não tem certeza
- Caso fora do padrão (atacado/B2B, parceria, dúvida jurídica, fiscal)
- Qualquer dúvida real sua sobre o que responder

Quando escalar, ainda assim **proponha um rascunho** de resposta no campo \`reply\` no mesmo tom profissional acima — o Kaique pode usar como base.

## Confidence — como calibrar

- **90-100:** info trivial, está literalmente na KB ou histórico, resposta é factual
- **70-89:** resposta segura mas envolve julgamento (pedir info, orientar próximo passo)
- **50-69:** dúvida real — provavelmente escalar
- **0-49:** sem base pra responder — escalar com rascunho

Se confidence < 70, marque escalate: true.

## Formato de resposta OBRIGATÓRIO

Devolva **somente** um JSON válido, sem texto fora dele:

\`\`\`json
{
  "confidence": 0-100,
  "escalate": true|false,
  "reply": "texto que iria pro cliente",
  "reason": "porque essa resposta (ou porque escalou) — 1 frase curta"
}
\`\`\`

Não inclua markdown fora do JSON. Apenas o objeto.`;

interface ConversationRow {
  id: number;
  shopId: string;
  conversationId: string;
  buyerId: string;
  buyerName: string | null;
  latestMessageId: string | null;
  latestMessageText: string | null;
  latestMessageFrom: string | null;
  latestMessageAt: Date | null;
  status: string | null;
}

interface KbCache {
  tomVoz: string;
  regras: string;
  aprendizados: string;
}

let kbCacheMemo: KbCache | null = null;
let kbCacheLoadedAt = 0;

async function loadKbCache(): Promise<KbCache> {
  const now = Date.now();
  if (kbCacheMemo && now - kbCacheLoadedAt < 5 * 60 * 1000) return kbCacheMemo;

  const db = await getDb();
  if (!db) return { tomVoz: "", regras: "", aprendizados: "" };

  const tomRows = await db
    .select()
    .from(shopeeChatKnowledge)
    .where(
      and(
        eq(shopeeChatKnowledge.type, "tom_voz"),
        eq(shopeeChatKnowledge.isActive, 1),
      ),
    )
    .limit(1);

  const regraRows = await db
    .select()
    .from(shopeeChatKnowledge)
    .where(
      and(
        eq(shopeeChatKnowledge.type, "regra_geral"),
        eq(shopeeChatKnowledge.isActive, 1),
      ),
    );

  // Aprendizados capturados de respostas reais do Kaique/Brenda (via Telegram ou app Shopee).
  // Top 30 mais recentes — Sam usa pra detectar padrões de resposta humana.
  const aprendizadoRows = await db
    .select()
    .from(shopeeChatKnowledge)
    .where(
      and(
        eq(shopeeChatKnowledge.type, "aprendizado"),
        eq(shopeeChatKnowledge.isActive, 1),
      ),
    )
    .orderBy(desc(shopeeChatKnowledge.createdAt))
    .limit(30);

  const tomVoz = tomRows[0]?.body || "";
  const regras = regraRows
    .map((r) => `### ${r.title}\n${r.body}`)
    .join("\n\n");
  const aprendizados = aprendizadoRows
    .map((r, i) => `### Caso ${i + 1}\n${r.body}`)
    .join("\n\n");

  kbCacheMemo = { tomVoz, regras, aprendizados };
  kbCacheLoadedAt = now;
  return kbCacheMemo;
}

interface HistoryEntry {
  from: string;
  text: string;
  at: Date;
  messageType: string;
  imageUrl?: string;
}

function extractImageUrl(rawContent: string): string | undefined {
  if (!rawContent) return undefined;
  try {
    const parsed = JSON.parse(rawContent);
    const url = parsed?.url || parsed?.image_url || parsed?.thumb_url;
    if (typeof url === "string" && url.startsWith("http")) return url;
  } catch {
    // não é JSON — pode ser texto puro
  }
  return undefined;
}

async function loadConversationHistory(
  shopId: string,
  conversationId: string,
  limit = 10,
): Promise<HistoryEntry[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(shopeeMessages)
    .where(
      and(
        eq(shopeeMessages.shopId, shopId),
        eq(shopeeMessages.conversationId, conversationId),
      ),
    )
    .orderBy(desc(shopeeMessages.sentAt))
    .limit(limit);
  return rows.reverse().map((r) => {
    const messageType = r.messageType || "text";
    const content = r.content || "";
    const imageUrl = messageType === "image" ? extractImageUrl(content) : undefined;
    return {
      from: r.fromRole,
      text: imageUrl ? `[imagem enviada pelo cliente: ${imageUrl}]` : content,
      at: r.sentAt,
      messageType,
      imageUrl,
    };
  });
}

/**
 * Baixa imagem da CDN da Shopee e converte para base64.
 * Limita 5MB pra evitar abuso. Retorna null se falhar.
 */
async function fetchImageAsBase64(
  url: string,
): Promise<{ media_type: string; data: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) return null;
    // Claude aceita: image/jpeg, image/png, image/gif, image/webp
    let media_type = contentType.split(";")[0].trim().toLowerCase();
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(media_type)) {
      media_type = "image/jpeg";
    }
    return { media_type, data: buf.toString("base64") };
  } catch (err: any) {
    console.error("[Sam Vision] download falhou:", err?.message);
    return null;
  }
}

function formatStructuredData(raw: string | null): string {
  if (!raw) return "";
  try {
    const d = JSON.parse(raw);
    const lines: string[] = [];
    if (d.marca) lines.push(`- **Marca:** ${d.marca}`);
    if (d.tipo_aparelho) lines.push(`- **Aparelho:** ${d.tipo_aparelho}`);
    if (d.tipo_peca) lines.push(`- **Peça:** ${d.tipo_peca}`);
    if (Array.isArray(d.modelos_compativeis) && d.modelos_compativeis.length > 0) {
      lines.push(`- **Modelos compatíveis:** ${d.modelos_compativeis.join(", ")}`);
    }
    if (Array.isArray(d.capacidades) && d.capacidades.length > 0) {
      lines.push(`- **Capacidades:** ${d.capacidades.join(", ")}`);
    }
    if (Array.isArray(d.voltagens) && d.voltagens.length > 0) {
      lines.push(`- **Voltagens:** ${d.voltagens.join(", ")}`);
    }
    if (Array.isArray(d.alertas) && d.alertas.length > 0) {
      lines.push(`- **⚠️ ALERTAS DE COMPATIBILIDADE:**`);
      for (const a of d.alertas) lines.push(`  - ${a}`);
    }
    return lines.length > 0 ? `**Dados estruturados:**\n${lines.join("\n")}\n` : "";
  } catch {
    return "";
  }
}

async function loadProductHints(history: { text: string }[]): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  const text = history
    .map((h) => h.text || "")
    .join(" ")
    .toLowerCase();

  const all = await db
    .select()
    .from(shopeeChatKnowledge)
    .where(eq(shopeeChatKnowledge.type, "produto"));

  // 1) Match direto por modelo citado pelo cliente (ex: "AFN-40", "NAF-03")
  // Procura códigos no padrão LETRAS-NUMEROS no texto
  const modelMatches = new Set<string>();
  const modelRegex = /\b([a-z]{2,5}[-_]?\d{2,4}[a-z]?)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = modelRegex.exec(text)) !== null) {
    modelMatches.add(m[1].toUpperCase().replace(/_/g, "-"));
  }

  const hitsByModel = new Set<number>();
  if (modelMatches.size > 0) {
    for (const p of all) {
      if (!p.structuredData) continue;
      try {
        const d = JSON.parse(p.structuredData);
        if (Array.isArray(d.modelos_compativeis)) {
          const has = d.modelos_compativeis.some((mod: string) =>
            modelMatches.has(String(mod).toUpperCase()),
          );
          if (has) hitsByModel.add(p.id);
        }
      } catch {
        // ignora json inválido
      }
    }
  }

  // 2) Match por palavras do título (fallback original)
  const hitsByWord = all.filter((p) => {
    if (hitsByModel.has(p.id)) return false; // já foi pego pelo match estruturado
    const t = (p.title || "").toLowerCase();
    if (!t) return false;
    const words = t.split(/\s+/).filter((w) => w.length >= 4);
    return words.some((w) => text.includes(w));
  });

  // Prioriza matches estruturados (mais precisos)
  const priorityHits = all.filter((p) => hitsByModel.has(p.id));
  const finalHits = [...priorityHits, ...hitsByWord].slice(0, 3);

  return finalHits
    .map((p) => {
      const structured = formatStructuredData(p.structuredData);
      return `### ${p.title}\n${structured}${p.body}`;
    })
    .join("\n\n");
}

interface ResponderDecision {
  confidence: number;
  escalate: boolean;
  reply: string;
  reason: string;
}

function parseDecision(raw: string): ResponderDecision {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "");
  try {
    const obj = JSON.parse(cleaned);
    return {
      confidence: Number(obj.confidence) || 0,
      escalate: !!obj.escalate,
      reply: String(obj.reply || ""),
      reason: String(obj.reason || ""),
    };
  } catch {
    return { confidence: 0, escalate: true, reply: raw.slice(0, 500), reason: "JSON inválido" };
  }
}

async function callClaude(
  kb: KbCache,
  productHints: string,
  history: HistoryEntry[],
  buyerName: string,
): Promise<ResponderDecision> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { confidence: 0, escalate: true, reply: "", reason: "ANTHROPIC_API_KEY ausente" };
  }
  const client = new Anthropic({ apiKey });

  const cachedKb = `## Tom de voz Kaibren\n\n${kb.tomVoz}\n\n## Regras gerais da loja\n\n${kb.regras}`;
  const cachedAprendizados = kb.aprendizados
    ? `## Casos reais aprendidos (respostas humanas anteriores)\n\nUse como referência de padrão. Quando a pergunta atual for parecida com um destes casos, siga a mesma linha de resposta.\n\n${kb.aprendizados}`
    : "";

  // Baixa até 2 imagens mais recentes do buyer (etiquetas, fotos de produto, defeito).
  // Pula imagens antigas do histórico — só as 2 últimas pra não estourar tokens.
  const buyerImages = history
    .filter((h) => h.from === "buyer" && h.imageUrl)
    .slice(-2);

  const imageBlocks: any[] = [];
  for (const h of buyerImages) {
    if (!h.imageUrl) continue;
    const img = await fetchImageAsBase64(h.imageUrl);
    if (!img) continue;
    imageBlocks.push({
      type: "image",
      source: { type: "base64", media_type: img.media_type, data: img.data },
    });
  }

  const userText = [
    `**Cliente:** ${buyerName || "(sem nome)"}`,
    productHints ? `\n## Produtos prováveis nessa conversa\n\n${productHints}\n` : "",
    imageBlocks.length > 0
      ? `\n## Imagens do cliente\n\n${imageBlocks.length} foto(s) anexada(s) abaixo. Se for etiqueta de aparelho, extraia: marca, modelo (ex: AFN-40, NAF-03), capacidade (ex: 4L), voltagem (110/220V). Cruze com modelos_compativeis dos produtos prováveis acima e use isso na decisão.\n`
      : "",
    `\n## Histórico (mais antigo → mais novo)`,
    ...history.map((h) => `[${h.from}] ${h.text}`),
    `\n\nClassifique e responda no formato JSON definido na persona.`,
  ].join("\n");

  try {
    const systemBlocks: any[] = [
      { type: "text", text: PERSONA, cache_control: { type: "ephemeral" } },
      { type: "text", text: cachedKb, cache_control: { type: "ephemeral" } },
    ];
    if (cachedAprendizados) {
      systemBlocks.push({
        type: "text",
        text: cachedAprendizados,
        cache_control: { type: "ephemeral" },
      });
    }
    const userContent: any[] =
      imageBlocks.length > 0
        ? [...imageBlocks, { type: "text", text: userText }]
        : [{ type: "text", text: userText }];
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: systemBlocks,
      messages: [{ role: "user", content: userContent }],
    });
    const text = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
    return parseDecision(text);
  } catch (err: any) {
    return {
      confidence: 0,
      escalate: true,
      reply: "",
      reason: `Erro Claude: ${err?.message || "desconhecido"}`,
    };
  }
}

async function escalateOnTelegram(
  conv: ConversationRow,
  history: { from: string; text: string }[],
  decision: ResponderDecision,
  modeShadow: boolean,
  guardReason?: string,
): Promise<void> {
  const lastBuyer = [...history].reverse().find((h) => h.from === "buyer");
  const buyerMsg = lastBuyer?.text || conv.latestMessageText || "(sem texto)";

  const header = guardReason
    ? `🛡️ *Shopee — bloqueado pelo SKU Guard*`
    : modeShadow
      ? `📩 *Shopee — modo shadow (não enviado)*`
      : `📩 *Shopee — preciso da sua ajuda*`;

  const lines: string[] = [
    header,
    "",
    `*Cliente:* ${conv.buyerName || conv.buyerId}`,
    `*Pergunta:* ${buyerMsg.slice(0, 400)}`,
    "",
    `*Sugestão Sam (conf ${decision.confidence}%):*`,
    decision.reply ? `_${decision.reply.slice(0, 600)}_` : "_(sem rascunho)_",
    "",
    `*Motivo:* ${guardReason || decision.reason}`,
    "",
    `Responda esta mensagem com o texto que devo enviar pro cliente.`,
    `_conv:${conv.conversationId}_`,
  ];

  await sendTelegram(lines.join("\n"));
}

async function markConversation(
  conversationId: number,
  status: "answered" | "escalated",
  action: "auto_replied" | "shadow_drafted" | "escalated",
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(shopeeConversations)
    .set({ status, agentLastAction: action })
    .where(eq(shopeeConversations.id, conversationId));
}

export async function respondNewMessages(): Promise<{
  processed: number;
  autoReplied: number;
  shadowed: number;
  escalated: number;
}> {
  const db = await getDb();
  if (!db) return { processed: 0, autoReplied: 0, shadowed: 0, escalated: 0 };

  const shops = await getConnectedShops();
  const shopMap = new Map(shops.map((s) => [s.shopId, s]));

  const open = await db
    .select()
    .from(shopeeConversations)
    .where(
      and(
        eq(shopeeConversations.status, "open"),
        eq(shopeeConversations.latestMessageFrom, "buyer"),
      ),
    )
    .orderBy(desc(shopeeConversations.latestMessageAt))
    .limit(20);

  const kb = await loadKbCache();
  let autoReplied = 0;
  let shadowed = 0;
  let escalated = 0;

  for (const conv of open) {
    const shop = shopMap.get(conv.shopId);
    if (!shop) continue;

    const history = await loadConversationHistory(conv.shopId, conv.conversationId, 10);
    if (history.length === 0) continue;

    const productHints = await loadProductHints(history);
    const decision = await callClaude(kb, productHints, history, conv.buyerName || "");

    await logChatEvent(
      "ai_decision",
      { confidence: decision.confidence, escalate: decision.escalate, reason: decision.reason, replyPreview: decision.reply.slice(0, 200) },
      conv.conversationId,
    );

    const shouldAutoSend = !decision.escalate && decision.confidence >= CONFIDENCE_THRESHOLD;

    if (shouldAutoSend && AUTOSEND && decision.reply) {
      const guard = await validateSkuConsistency(
        decision.reply,
        { conversationId: conv.conversationId, buyerId: conv.buyerId },
        history.map((h) => ({ text: h.text || "" })),
      );
      if (!guard.ok) {
        await logChatEvent(
          "sku_guard_blocked",
          {
            confidence: decision.confidence,
            reason: guard.reason,
            unauthorized: guard.unauthorized,
            mentionedInReply: guard.mentionedInReply,
            validModels: guard.validModels,
            replyPreview: decision.reply.slice(0, 300),
          },
          conv.conversationId,
        );
        await recordOutgoingMessage(
          shop,
          conv.conversationId,
          "",
          decision.reply,
          "ai_shadow",
          decision.confidence,
        );
        await escalateOnTelegram(conv, history, decision, true, guard.reason);
        await markConversation(conv.id, "escalated", "shadow_drafted");
        shadowed++;
        continue;
      }
      try {
        const sent = await sendTextMessage(shop, Number(conv.buyerId), decision.reply);
        await recordOutgoingMessage(
          shop,
          conv.conversationId,
          sent.messageId,
          decision.reply,
          "ai_auto",
          decision.confidence,
        );
        await markConversation(conv.id, "answered", "auto_replied");
        autoReplied++;
      } catch (err: any) {
        await logChatEvent("error", { stage: "send", message: err?.message }, conv.conversationId);
        await escalateOnTelegram(conv, history, decision, false);
        await markConversation(conv.id, "escalated", "escalated");
        escalated++;
      }
    } else if (shouldAutoSend && !AUTOSEND && decision.reply) {
      // Shadow: registra mas não envia, notifica Kaique pra revisar
      await recordOutgoingMessage(
        shop,
        conv.conversationId,
        "",
        decision.reply,
        "ai_shadow",
        decision.confidence,
      );
      await escalateOnTelegram(conv, history, decision, true);
      await markConversation(conv.id, "escalated", "shadow_drafted");
      shadowed++;
    } else {
      // Confidence baixa ou flag escalate
      await escalateOnTelegram(conv, history, decision, false);
      await markConversation(conv.id, "escalated", "escalated");
      escalated++;
    }
  }

  return { processed: open.length, autoReplied, shadowed, escalated };
}

/**
 * Refina mensagem crua do Kaique (vinda do Telegram) em tom profissional.
 * Usa Sonnet com a mesma KB cacheada.
 */
export async function refineKaiqueMessage(rawText: string, contextHistory?: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return rawText;
  const client = new Anthropic({ apiKey });
  const kb = await loadKbCache();

  const cachedKb = `## Tom de voz Kaibren\n\n${kb.tomVoz}\n\n## Regras gerais da loja\n\n${kb.regras}`;

  const userText = [
    `Texto cru do dono da loja (Kaique) que precisa ser enviado pro cliente Shopee:`,
    `"""`,
    rawText,
    `"""`,
    contextHistory ? `\n\nContexto da conversa:\n${contextHistory}` : "",
    `\n\nReescreva esse texto preservando o sentido e a informação, mas no tom Kaibren profissional definido nas regras. Devolva SOMENTE o texto reescrito — sem aspas, sem prefixo, sem markdown, sem comentário.`,
  ].join("\n");

  const refineSystem = `Você reescreve mensagens curtas em tom **e-mail comercial profissional brasileiro** para atendimento Shopee da Kaibren.

## NUNCA escreva
- Pontos de exclamação (use ponto final)
- Diminutivos: "certinho", "rapidinho", "fotinha", "modelinho", "pedidinho"
- Expressões infantilizadas: "pra te ajudar", "consigo te ajudar", "pra gente verificar"
- Cumprimentos: "Olá!", "Oi!", "Tudo bem?"
- Emojis, "kkk", "rs"
- Promessas vagas ("logo", "em breve") — use prazo concreto ou "em até 1 dia útil"

## SEMPRE escreva
- "você" (nunca "tu", "senhor", "senhora")
- Frases curtas, máximo 3 linhas
- Direto ao ponto: informação ou pedido de info objetivo
- Acolhimento curto antes de resolver reclamação ("Entendo a situação.")

Mantenha o sentido do texto cru. Não invente informação que não está no original.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: [
        {
          type: "text",
          text: refineSystem,
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: cachedKb, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userText }],
    });
    const text = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();
    return text || rawText;
  } catch (err: any) {
    console.error("[Sam refine] erro:", err?.message);
    return rawText;
  }
}

export function invalidateKbCache(): void {
  kbCacheMemo = null;
  kbCacheLoadedAt = 0;
}
