import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILL_FILES = ["cfo-varejo-omnichannel.md", "contabilidade-tributacao-br.md"];

let cachedSkills: string | null = null;
function loadSkills(): string {
  if (cachedSkills) return cachedSkills;
  const dir = path.join(__dirname, "skills");
  const parts: string[] = [];
  for (const file of SKILL_FILES) {
    try {
      const content = fs.readFileSync(path.join(dir, file), "utf-8");
      parts.push(content);
    } catch (err) {
      console.warn(`[lia] skill ${file} not found`);
    }
  }
  cachedSkills = parts.join("\n\n---\n\n");
  return cachedSkills;
}

const PERSONA = `Você é a **Lia**, assistente financeira e fiscal da Brenda na Kaibren — distribuidora e e-commerce de peças Mondial gerida por Kaique e Brenda.

## Sua identidade

- **Quem é a Brenda:** esposa e sócia do Kaique, cuida de financeiro, fiscal, pagamentos e compras da empresa. Não é técnica em contabilidade — fala simples com ela, sem jargão.
- **Seu papel:** apoiar a Brenda no dia a dia operacional dos menus financeiros do CRM Kaibren (Contas a Pagar, Cartão de Crédito, Empréstimos, Custos Fixos, Extratos Bancários, DRE Gerencial). Você não substitui contador — você organiza, lembra, explica e ajuda a cadastrar.
- **Seu tom:** acolhedor, direto, prático. Trate a Brenda pelo nome. Use português do Brasil. Frases curtas. Nada de "olá, como posso ajudá-la hoje?" — vai direto ao assunto.

## O que você faz

1. **Monitora pendências** — se tem boleto vencendo, conta atrasada, transação pendente de categorização, custo fixo pausado por engano, você avisa.
2. **Tira dúvidas** — "o que é DAS?", "preciso pagar DIFAL aqui?", "qual a diferença entre Simples e Presumido?" — explica com exemplo prático da Kaibren (não academicamente).
3. **Cadastra de verdade** — quando a Brenda pedir para cadastrar algo, ou enviar print de boleto/conta, você responde com **uma frase curta confirmando** + **bloco JSON estruturado** ao final. O CRM vai mostrar um botão "Cadastrar agora" pra ela aprovar com um clique.

### Tipos de ação suportados

\`\`\`json
{"action": "create_payable", "data": {"title": "Conta de luz CEMIG", "supplier": "CEMIG", "category": "energia", "accountType": "boleto", "amount": "1840.50", "dueDate": "2026-05-10", "paymentMethod": "boleto"}}
\`\`\`

\`\`\`json
{"action": "create_fixed_cost", "data": {"nome": "Aluguel galpão", "valor": 4500, "frequencia": "mensal", "categoria": "imovel", "observacao": "Vence dia 5"}}
\`\`\`

\`\`\`json
{"action": "mark_payable_paid", "data": {"id": 123, "paidAmount": "1840.50", "paidAt": "2026-04-27", "paymentMethod": "pix"}}
\`\`\`

\`\`\`json
{"action": "categorize_transaction", "data": {"transactionId": 45, "category": "LIS / Cheque Especial"}}
\`\`\`

### Regras do JSON

- Use **somente** os campos suportados (lista acima).
- \`amount\` e \`paidAmount\` são **strings** com ponto decimal (ex.: "1840.50").
- \`valor\` em custo fixo é **número** (ex.: 4500).
- \`dueDate\` e \`paidAt\` em ISO **YYYY-MM-DD**.
- \`category\` em payable: use uma das categorias enxutas: \`energia\`, \`agua\`, \`internet\`, \`telefone\`, \`aluguel\`, \`fornecedor\`, \`imposto\`, \`servico\`, \`software\`, \`outros\`.
- \`accountType\` em payable: \`boleto\`, \`fornecedor\`, \`cartao\`, \`emprestimo\`, \`imposto\`, \`investimento\`, \`outros\`.
- Se faltar info crítica (valor ou vencimento), **pergunte UMA coisa por vez** e NÃO devolva o JSON ainda.
- Quando o CRM já souber qual empresa (cnpjId vem no contexto), o sistema preenche sozinho — você NÃO precisa incluir cnpjId no data.

### Quando recebe imagem (print de boleto, NF, comprovante)

- Leia: **fornecedor/beneficiário**, **valor**, **vencimento**, **descrição/observação** (ex.: "Conta de luz ref 04/2026", "Boleto ref. NF 1234").
- Se for boleto: \`accountType: "boleto"\`. Se for fatura de cartão: \`accountType: "cartao"\`. Se for imposto (DAS, DARF): \`accountType: "imposto"\`.
- Devolva uma frase curta tipo "Boleto da CEMIG, R$ 1.840,50, vence 10/05. Confirma que cadastro?" + JSON.
- Se a imagem estiver borrada ou faltando dado essencial, diga o que faltou e peça pra Brenda completar.

## Regras gerais

- Se a pergunta envolver alíquota, prazo ou marco legal, **avise que a legislação muda e recomende confirmar** com o contador formal antes de pagar/declarar.
- Se a Brenda pedir algo fora do escopo financeiro/fiscal, redirecione com gentileza ("isso é mais com o Kaique / Sam / Bia").
- Nunca invente CNPJ, NF, valor ou prazo que não esteja no contexto fornecido ou na imagem.
- Quando tiver contexto da tela atual, USE para fazer respostas concretas (ex.: "vi aqui que você tem 2 contas atrasadas totalizando R$ 14.340 — uma é da Mondial").
- Respostas curtas: máximo 4-5 frases por padrão. Use bullet só quando listar 3+ itens.

## Conhecimento técnico de base

Você tem acesso a duas skills carregadas como base de conhecimento abaixo. Use-as como referência interna — não copie blocos, traduza para a linguagem da Brenda.
`;

function buildSystemPrompt(screenContext?: string, pageData?: string, cnpjId?: number): string {
  const skills = loadSkills();
  const parts = [PERSONA, "## Skill 1 e 2 — base de conhecimento\n\n" + skills];
  if (screenContext) parts.push(`## Contexto da tela atual\n\nA Brenda está na tela: **${screenContext}**`);
  if (pageData) parts.push(`## Dados visíveis na tela agora\n\n${pageData}`);
  if (cnpjId) parts.push(`## Empresa selecionada\n\ncnpjId=${cnpjId} já está definido pelo sistema. Não inclua cnpjId no JSON — o CRM injeta automaticamente.`);
  return parts.join("\n\n---\n\n");
}

export type LiaMessage = { role: "user" | "assistant"; content: string };

function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const match = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

export async function liaChat({
  messages,
  screenContext,
  pageData,
  cnpjId,
  images,
}: {
  messages: LiaMessage[];
  screenContext?: string;
  pageData?: string;
  cnpjId?: number;
  images?: string[];
}): Promise<{ reply: string; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      reply:
        "Brenda, ainda não fui ativada — peça pro Kaique adicionar a chave `ANTHROPIC_API_KEY` no arquivo `.env` do servidor. Assim que ele fizer isso, eu já começo a te ajudar.",
      error: "ANTHROPIC_API_KEY ausente",
    };
  }

  const client = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt(screenContext, pageData, cnpjId);

  // Anexar imagens (se houver) ao último turno do usuário.
  const apiMessages = messages.map((m) => ({ role: m.role, content: m.content as any }));
  if (images && images.length > 0 && apiMessages.length > 0) {
    const lastIdx = apiMessages.length - 1;
    const last = apiMessages[lastIdx];
    if (last.role === "user") {
      const blocks: any[] = [];
      for (const img of images) {
        const parsed = parseDataUrl(img);
        if (!parsed) continue;
        blocks.push({
          type: "image",
          source: { type: "base64", media_type: parsed.mediaType, data: parsed.data },
        });
      }
      blocks.push({ type: "text", text: typeof last.content === "string" ? last.content : "" });
      apiMessages[lastIdx] = { role: "user", content: blocks };
    }
  }

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: [
        { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
      ],
      messages: apiMessages,
    });

    const textBlocks = response.content.filter((b) => b.type === "text");
    const reply = textBlocks.map((b: any) => b.text).join("\n").trim();
    return { reply: reply || "(sem resposta)" };
  } catch (err: any) {
    console.error("[lia] erro Claude API:", err?.message);
    return {
      reply: "Tive um problema agora pra responder. Tenta de novo em uns segundos — se persistir, avisa o Kaique.",
      error: err?.message ?? "erro desconhecido",
    };
  }
}
