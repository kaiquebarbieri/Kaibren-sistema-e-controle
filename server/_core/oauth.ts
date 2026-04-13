import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import bcrypt from "bcryptjs";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

export function registerOAuthRoutes(app: Express) {
  // POST /api/auth/login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email e senha são obrigatórios" });
      return;
    }

    try {
      const user = await db.getUserByEmail(email);

      if (!user || !user.passwordHash) {
        res.status(401).json({ error: "Email ou senha inválidos" });
        return;
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ error: "Email ou senha inválidos" });
        return;
      }

      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(user.id, {
        email: user.email || "",
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "Erro interno no login" });
    }
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, cookieOptions);
    res.json({ success: true });
  });

  // GET /api/auth/me
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } catch {
      res.status(401).json({ error: "Não autenticado" });
    }
  });
}

// Seed admin user
export async function seedAdminUser() {
  try {
    const existing = await db.getUserByEmail("kaique@kaibren.com.br");
    if (existing) {
      console.log("[Seed] Admin user already exists");
      return;
    }

    const passwordHash = await bcrypt.hash("kaibren2024", 10);

    await db.upsertUser({
      openId: "admin-kaibren",
      name: "Kaique",
      email: "kaique@kaibren.com.br",
      loginMethod: "email",
      role: "admin",
      lastSignedIn: new Date(),
    });

    // Update passwordHash directly since upsertUser doesn't handle it
    const { getDb } = await import("../db");
    const drizzleDb = await getDb();
    if (drizzleDb) {
      const { users } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await drizzleDb
        .update(users)
        .set({ passwordHash })
        .where(eq(users.openId, "admin-kaibren"));
    }

    console.log("[Seed] Admin user created: kaique@kaibren.com.br");
  } catch (error) {
    console.error("[Seed] Failed to create admin user:", error);
  }
}
