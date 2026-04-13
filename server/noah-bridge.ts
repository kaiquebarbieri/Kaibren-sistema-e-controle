/**
 * Noah Bridge API — porta de entrada REST para o OpenClaw se conectar ao CRM.
 * Auth via header X-Noah-Token.
 */

import { Router, Request, Response, NextFunction } from "express";
import { getDb } from "./db";
import { agentLogs, agentAlerts, agentTasks, agents } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const BRIDGE_TOKEN = process.env.NOAH_BRIDGE_TOKEN || "noah-kaibren-2024-secure";

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-noah-token"];
  if (token !== BRIDGE_TOKEN) {
    res.status(401).json({ error: "Token inválido ou ausente. Envie header X-Noah-Token." });
    return;
  }
  next();
}

// Resolve agentId a partir do slug (fallback para IDs fixos se banco não disponível)
const SLUG_TO_ID: Record<string, number> = {
  noah: 1, leo: 2, maya: 3, bia: 4, rex: 5, sam: 6, bruno: 7,
};

async function resolveAgentId(slug: string): Promise<number> {
  try {
    const db = await getDb();
    if (db) {
      const rows = await db.select({ id: agents.id }).from(agents).where(eq(agents.slug, slug)).limit(1);
      if (rows.length > 0) return rows[0].id;
    }
  } catch {}
  return SLUG_TO_ID[slug] ?? 1;
}

export function registerNoahBridgeRoutes(app: Router) {
  const router = Router();
  router.use(authMiddleware);

  // GET /api/noah/ping
  router.get("/ping", (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // POST /api/noah/log
  router.post("/log", async (req: Request, res: Response) => {
    const { agent_slug, type, content, metadata } = req.body;
    if (!agent_slug || !content) {
      res.status(400).json({ error: "Campos obrigatórios: agent_slug, content" });
      return;
    }
    const validTypes = ["analysis", "alert", "task", "message"];
    const logType = validTypes.includes(type) ? type : "message";

    try {
      const db = await getDb();
      if (!db) { res.status(503).json({ error: "Banco de dados indisponível" }); return; }

      const agentId = await resolveAgentId(agent_slug);
      const [result] = await db.insert(agentLogs).values({
        agentId,
        type: logType,
        content,
        metadata: metadata ? JSON.stringify(metadata) : null,
      });

      res.json({ ok: true, id: result.insertId, agentId, type: logType });
    } catch (err: any) {
      console.error("[Noah Bridge] Log error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/noah/alert
  router.post("/alert", async (req: Request, res: Response) => {
    const { agent_slug, level, title, message } = req.body;
    if (!agent_slug || !title) {
      res.status(400).json({ error: "Campos obrigatórios: agent_slug, title" });
      return;
    }
    const validLevels = ["info", "warning", "critical"];
    const alertLevel = validLevels.includes(level) ? level : "info";

    try {
      const db = await getDb();
      if (!db) { res.status(503).json({ error: "Banco de dados indisponível" }); return; }

      const agentId = await resolveAgentId(agent_slug);
      const [result] = await db.insert(agentAlerts).values({
        agentId,
        level: alertLevel,
        title,
        message: message || null,
      });

      res.json({ ok: true, id: result.insertId, agentId, level: alertLevel });
    } catch (err: any) {
      console.error("[Noah Bridge] Alert error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/noah/task
  router.post("/task", async (req: Request, res: Response) => {
    const { agent_slug, title, description, status, result } = req.body;
    if (!agent_slug || !title) {
      res.status(400).json({ error: "Campos obrigatórios: agent_slug, title" });
      return;
    }
    const validStatuses = ["pending", "running", "done", "failed"];
    const taskStatus = validStatuses.includes(status) ? status : "pending";

    try {
      const db = await getDb();
      if (!db) { res.status(503).json({ error: "Banco de dados indisponível" }); return; }

      const agentId = await resolveAgentId(agent_slug);
      const [insertResult] = await db.insert(agentTasks).values({
        agentId,
        title,
        description: description || null,
        status: taskStatus,
        result: result || null,
        executedAt: taskStatus === "done" ? new Date() : null,
      });

      res.json({ ok: true, id: insertResult.insertId, agentId, status: taskStatus });
    } catch (err: any) {
      console.error("[Noah Bridge] Task error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.use("/api/noah", router);
}
