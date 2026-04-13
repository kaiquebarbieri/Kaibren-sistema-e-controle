/**
 * Shopee Research — Pesquisa semanal automatica
 *
 * Roda 1x por semana (segunda-feira 8h) e atualiza o knowledge base
 * do Sam com as ultimas novidades da plataforma Shopee.
 *
 * Usa GPT-4o para sintetizar o conhecimento em formato estruturado.
 */

import * as fs from "fs";
import * as path from "path";
import { invokeLLM } from "./_core/llm";

const KNOWLEDGE_PATH = path.join(process.cwd(), "server", "data", "shopee-knowledge.json");
const RESEARCH_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 dias

async function runShopeeResearch(): Promise<string> {
  console.log("[Shopee Research] Iniciando pesquisa semanal...");

  const topics = [
    "Quais são as taxas e comissões atuais da Shopee Brasil para vendedores CNPJ em 2026? Inclua comissão padrão, frete grátis, taxa fixa por item, e campanhas de destaque.",
    "Como funciona o GMV Max da Shopee Ads em 2026? Quais as regras de ROAS target, fase de aprendizado, e migração de ads manuais?",
    "Quais as melhores práticas de otimização de Shopee Ads em 2026? CTR ideal, CPC, keywords, fotos, títulos, teste A/B.",
    "Quais novidades e mudanças a Shopee fez na plataforma em 2026? Novas features, mudanças de política, ferramentas para vendedores.",
    "Quais os melhores horários para anunciar na Shopee Brasil? Picos de tráfego, dias da semana com mais conversão, sazonalidade.",
    "Como funciona o algoritmo de ranking da Shopee em 2026? O que influencia posição orgânica e paga dos produtos?"
  ];

  try {
    const result = await invokeLLM({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Você é um pesquisador especialista em e-commerce e Shopee Brasil. Com base no seu conhecimento atualizado, responda todas as perguntas abaixo de forma estruturada e detalhada. Inclua números, percentuais e datas sempre que possível. Responda em português brasileiro."
        },
        {
          role: "user",
          content: `Preciso de uma pesquisa completa e atualizada sobre a plataforma Shopee Brasil para alimentar nosso sistema de IA. Responda cada tópico:\n\n${topics.map((t, i) => `${i + 1}. ${t}`).join("\n\n")}\n\nFormate como um relatório estruturado com seções claras.`
        },
      ],
      maxTokens: 4096,
    });

    const content = result.choices?.[0]?.message?.content;
    const research = typeof content === "string" ? content : Array.isArray(content)
      ? content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n")
      : "Pesquisa não disponível";

    // Atualizar knowledge base
    try {
      const existing = fs.existsSync(KNOWLEDGE_PATH)
        ? JSON.parse(fs.readFileSync(KNOWLEDGE_PATH, "utf-8"))
        : { sections: {} };

      existing.lastUpdated = new Date().toISOString().slice(0, 10);
      existing.lastResearch = research;
      existing.lastResearchDate = new Date().toISOString();
      existing.version = (existing.version || 0) + 1;

      fs.writeFileSync(KNOWLEDGE_PATH, JSON.stringify(existing, null, 2), "utf-8");
      console.log(`[Shopee Research] Knowledge base atualizado (v${existing.version})`);
    } catch (err: any) {
      console.error("[Shopee Research] Erro ao salvar:", err.message);
    }

    return research;
  } catch (err: any) {
    console.error("[Shopee Research] Erro na pesquisa:", err.message);
    return `Erro: ${err.message}`;
  }
}

export function startShopeeResearchCron() {
  // Calcular próxima segunda-feira às 8h
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=dom, 1=seg...
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek;
  const nextMonday = new Date(now);
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  nextMonday.setHours(8, 0, 0, 0);

  const msUntilFirst = nextMonday.getTime() - now.getTime();

  console.log(`[Shopee Research] Cron semanal configurado. Próxima pesquisa: ${nextMonday.toLocaleDateString("pt-BR")} 08:00`);

  // Primeira execução na próxima segunda
  setTimeout(() => {
    runShopeeResearch();
    // Depois roda a cada 7 dias
    setInterval(() => runShopeeResearch(), RESEARCH_INTERVAL);
  }, msUntilFirst);
}

// Exportar para uso manual (via endpoint ou teste)
export { runShopeeResearch };
