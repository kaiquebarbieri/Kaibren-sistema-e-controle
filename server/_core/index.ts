import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes, seedAdminUser } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerBankStatementUploadRoute } from "../bankStatementUpload";
import { registerNoahBridgeRoutes } from "../noah-bridge";
import { startMLTokenCron, refreshAllMLTokens } from "../mercadolivre";
import { syncMLMessages, syncMLClaims } from "../ml-messages";
import { generateOAuthUrl, handleOAuthCallback } from "../meta-oauth";
import { generateMLOAuthUrl, handleMLOAuthCallback } from "../ml-oauth";
import { generateShopeeAuthUrl, handleShopeeCallback } from "../shopee-oauth";
import { startShopeeTokenCron } from "../shopee";
import { startShopeeResearchCron, runShopeeResearch } from "../shopee-research";
import { getShopeeAdsDashboard, generateAdsAnalysis } from "../shopee-ads";
import { generateAdsPdf } from "../shopee-ads-pdf";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Bank statement PDF upload
  registerBankStatementUploadRoute(app);
  // Noah TTS — OpenAI Text-to-Speech (voz JARVIS) — antes do bridge pra nao cair no auth
  app.post("/api/tts", async (req: any, res: any) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "text is required" });
      }
      const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "OpenAI API key not configured" });
      }
      // Limitar texto a 4096 chars (limite OpenAI TTS)
      const trimmed = text.slice(0, 4096);
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: trimmed,
          voice: "onyx",
          response_format: "mp3",
          speed: 1.05,
        }),
      });
      if (!response.ok) {
        const err = await response.text();
        console.error("[Noah TTS] OpenAI error:", err);
        return res.status(500).json({ error: "TTS failed" });
      }
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-cache");
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error("[Noah TTS] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Noah Bridge API (REST)
  registerNoahBridgeRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Páginas legais (necessárias para Meta App Review)
  app.get("/privacy", (_req: any, res: any) => {
    res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Política de Privacidade — NoahAPI</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#333;line-height:1.6}h1{color:#111}</style></head><body><h1>Política de Privacidade</h1><p><strong>Última atualização:</strong> 03/04/2026</p><p>O aplicativo NoahAPI é uma ferramenta de integração interna utilizada exclusivamente pela empresa Kaibren / CK Atacados para gerenciamento de campanhas publicitárias no Meta Ads.</p><h2>Dados coletados</h2><p>Este aplicativo acessa dados de campanhas, anúncios e métricas de desempenho do Meta Ads via API oficial do Facebook. Nenhum dado pessoal de terceiros é coletado, armazenado ou compartilhado.</p><h2>Uso dos dados</h2><p>Os dados são utilizados exclusivamente para monitoramento e otimização de campanhas publicitárias da Kaibren.</p><h2>Contato</h2><p>Em caso de dúvidas: noah@kaibren.com.br</p></body></html>`);
  });

  app.get("/data-deletion", (_req: any, res: any) => {
    res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Exclusão de Dados — NoahAPI</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#333;line-height:1.6}h1{color:#111}</style></head><body><h1>Exclusão de Dados</h1><p>Para solicitar a exclusão de seus dados associados ao aplicativo NoahAPI, envie um e-mail para <strong>noah@kaibren.com.br</strong> com o assunto "Exclusão de Dados".</p><p>Processaremos sua solicitação em até 30 dias.</p></body></html>`);
  });

  // Meta OAuth
  app.get("/api/meta/oauth/start", (_req: any, res: any) => {
    const url = generateOAuthUrl();
    res.redirect(url);
  });

  app.get("/api/meta/oauth/callback", async (req: any, res: any) => {
    const { code, state, error } = req.query as any;
    if (error || !code || !state) {
      return res.redirect(`/configuracoes?tab=Marketing&oauth=error&reason=${error || "cancelled"}`);
    }
    try {
      const result = await handleOAuthCallback(code as string, state as string);
      if (!result.success) {
        return res.redirect(`/configuracoes?tab=Marketing&oauth=error&reason=${result.error || "unknown"}`);
      }
      return res.redirect(`/configuracoes?tab=Marketing&oauth=success&accounts=${result.accountsFound}`);
    } catch (e: any) {
      return res.redirect(`/configuracoes?tab=Marketing&oauth=error&reason=${e.message}`);
    }
  });

  // Mercado Livre OAuth
  app.get("/api/ml/oauth/start", (_req: any, res: any) => {
    const url = generateMLOAuthUrl();
    res.redirect(url);
  });

  app.get("/api/ml/oauth/callback", async (req: any, res: any) => {
    const { code, state, error } = req.query as any;
    if (error || !code || !state) {
      return res.redirect(`/configuracoes?tab=Marketplaces&oauth=error&reason=${error || "cancelled"}&provider=ml`);
    }
    try {
      const result = await handleMLOAuthCallback(code as string, state as string);
      if (!result.success) {
        return res.redirect(`/configuracoes?tab=Marketplaces&oauth=error&reason=${result.error || "unknown"}&provider=ml`);
      }
      return res.redirect(`/configuracoes?tab=Marketplaces&oauth=success&provider=ml&account=${encodeURIComponent(result.accountName || "")}`);
    } catch (e: any) {
      return res.redirect(`/configuracoes?tab=Marketplaces&oauth=error&reason=${e.message}&provider=ml`);
    }
  });

  // Shopee OAuth v2
  app.get("/api/shopee/oauth/start", (_req: any, res: any) => {
    const url = generateShopeeAuthUrl();
    res.redirect(url);
  });

  app.get("/api/shopee/oauth/callback", async (req: any, res: any) => {
    const { code, shop_id, error } = req.query as any;
    if (error || !code || !shop_id) {
      return res.redirect(
        `/configuracoes?tab=Marketplaces&oauth=error&reason=${error || "cancelled"}&provider=shopee`
      );
    }
    try {
      const result = await handleShopeeCallback(code as string, shop_id as string);
      if (!result.success) {
        return res.redirect(
          `/configuracoes?tab=Marketplaces&oauth=error&reason=${result.error || "unknown"}&provider=shopee`
        );
      }
      return res.redirect(
        `/configuracoes?tab=Marketplaces&oauth=success&provider=shopee&account=${encodeURIComponent(result.shopName || "")}`
      );
    } catch (e: any) {
      return res.redirect(
        `/configuracoes?tab=Marketplaces&oauth=error&reason=${e.message}&provider=shopee`
      );
    }
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Endpoint para renovação manual dos tokens ML (usado pelo painel)
  app.post("/api/ml/refresh-tokens", async (req, res) => {
    const token = req.headers["x-noah-token"];
    if (token !== (process.env.NOAH_BRIDGE_TOKEN || "noah-kaibren-2024-secure")) {
      res.status(401).json({ error: "Não autorizado" });
      return;
    }
    const results = await refreshAllMLTokens();
    res.json({ ok: true, results });
  });

  // Shopee Ads — Download PDF
  app.get("/api/shopee-ads/pdf", async (_req, res) => {
    try {
      const dash = await getShopeeAdsDashboard();
      if (!dash) { res.status(500).json({ error: "Nenhuma loja Shopee conectada" }); return; }
      const analysis = await generateAdsAnalysis(dash);
      const pdfBuffer = generateAdsPdf(dash as any, analysis);
      const now = new Date();
      const filename = `shopee-ads-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("[Shopee Ads PDF] Erro:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Shopee Ads — Enviar PDF pro Telegram
  app.post("/api/shopee-ads/send-telegram", async (_req, res) => {
    try {
      const dash = await getShopeeAdsDashboard();
      if (!dash) { res.status(500).json({ error: "Nenhuma loja Shopee conectada" }); return; }
      const analysis = await generateAdsAnalysis(dash);
      const pdfBuffer = generateAdsPdf(dash as any, analysis);
      const now = new Date();
      const filename = `shopee-ads-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}.pdf`;

      // Enviar via Telegram Bot API
      const TELEGRAM_BOT_TOKEN = "8654220100:AAE5DGE1KeV5Ap2kVccYcsnGdnUSJNyXHnI";
      const TELEGRAM_CHAT_ID = "5936886703"; // Kaique pessoal

      const formData = new FormData();
      formData.append("chat_id", TELEGRAM_CHAT_ID);
      formData.append("document", new Blob([pdfBuffer], { type: "application/pdf" }), filename);
      formData.append("caption", `📊 *Relatorio Shopee Ads*\n${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}\n\nSaldo: R$${dash.balance?.toFixed(2) ?? "N/A"}\nGasto 7d: R$${dash.kpis.expense7d}\nROAS: ${dash.kpis.roas7d}x\nCampanhas ativas: ${dash.activeCampaigns}`);
      formData.append("parse_mode", "Markdown");

      const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
        method: "POST",
        body: formData,
      });
      const tgData = await tgRes.json() as any;

      if (!tgData.ok) {
        console.error("[Telegram] Erro:", tgData.description);
        res.status(500).json({ error: tgData.description });
        return;
      }

      res.json({ ok: true, message: "PDF enviado pro Telegram" });
    } catch (err: any) {
      console.error("[Shopee Ads Telegram] Erro:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  server.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}/`);
    await seedAdminUser();
    // Iniciar renovação automática de tokens ML e Shopee
    startMLTokenCron();
    startShopeeTokenCron();
    startShopeeResearchCron();
    // Sync automático de mensagens e reclamações ML a cada 10 minutos
    const ML_SYNC_INTERVAL = 10 * 60 * 1000; // 10 min
    // Primeiro sync 2min após boot (após renovação de tokens que roda em 1min)
    setTimeout(async () => {
      console.log("[ML Sync] Primeiro sync de mensagens e reclamações...");
      try { const r = await syncMLMessages(); console.log(`[ML Sync] Mensagens: ${r.synced} sincronizadas`, r.errors.length ? r.errors : ""); } catch (e: any) { console.error("[ML Sync] Erro mensagens:", e.message); }
      try { const r = await syncMLClaims(); console.log(`[ML Sync] Reclamações: ${r.synced} sincronizadas`, r.errors.length ? r.errors : ""); } catch (e: any) { console.error("[ML Sync] Erro reclamações:", e.message); }
    }, 120_000); // 2min após boot (tokens renovam em ~1min)
    setInterval(async () => {
      console.log("[ML Sync] Sincronizando mensagens e reclamações...");
      try { const r = await syncMLMessages(); console.log(`[ML Sync] Mensagens: ${r.synced} sincronizadas`, r.errors.length ? r.errors : ""); } catch (e: any) { console.error("[ML Sync] Erro mensagens:", e.message); }
      try { const r = await syncMLClaims(); console.log(`[ML Sync] Reclamações: ${r.synced} sincronizadas`, r.errors.length ? r.errors : ""); } catch (e: any) { console.error("[ML Sync] Erro reclamações:", e.message); }
    }, ML_SYNC_INTERVAL);
  });
}

startServer().catch(console.error);
