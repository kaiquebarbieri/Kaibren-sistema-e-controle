/**
 * Cron jobs do Noah CEO.
 * - Diário 8h BRT (11h UTC): recap de ontem + ações de hoje
 * - Semanal segunda 8h BRT: resumo da semana
 * - Mensal dia 1 9h BRT (12h UTC): DRE fechado + recomendação
 * - Urgente: cada 30 min checa se algo virou 🔴 e dispara
 */

import { getFinanceHealth } from "../../finance/health";
import { composeDailyRecap, composeWeeklyRecap, composeMonthlyRecap, composeUrgentAlert } from "./composer";
import { sendTelegram } from "./telegram";
import {
  shouldRunDaily, markDailyDone,
  shouldRunWeekly, markWeeklyDone,
  shouldRunMonthly, markMonthlyDone,
  shouldFireUrgent, markUrgentFired,
} from "./state";

/** Hora local Brasília (UTC-3, sem horário de verão desde 2019) */
function nowBR(): { date: Date; hour: number; minute: number; weekday: number; day: number; ymd: string } {
  const utc = new Date();
  const br = new Date(utc.getTime() - 3 * 60 * 60 * 1000);
  return {
    date: br,
    hour: br.getUTCHours(),
    minute: br.getUTCMinutes(),
    weekday: br.getUTCDay(), // 0=domingo, 1=segunda
    day: br.getUTCDate(),
    ymd: `${br.getUTCFullYear()}-${String(br.getUTCMonth() + 1).padStart(2, "0")}-${String(br.getUTCDate()).padStart(2, "0")}`,
  };
}

async function tick() {
  const t = nowBR();

  // Recap mensal — dia 1, entre 9h00 e 9h59 BRT
  if (t.day === 1 && t.hour === 9 && shouldRunMonthly(t.ymd)) {
    try {
      console.log("[Noah Cron] Disparando recap mensal");
      const text = await composeMonthlyRecap();
      const r = await sendTelegram(text);
      if (r.ok) {
        markMonthlyDone(t.ymd);
        console.log("[Noah Cron] Mensal enviado.");
      } else {
        console.warn("[Noah Cron] Falha mensal:", r.error);
      }
    } catch (e: any) {
      console.error("[Noah Cron] Erro mensal:", e?.message);
    }
  }

  // Recap semanal — segunda-feira, entre 8h00 e 8h59 BRT
  if (t.weekday === 1 && t.hour === 8 && shouldRunWeekly(t.ymd)) {
    try {
      console.log("[Noah Cron] Disparando recap semanal");
      const text = await composeWeeklyRecap();
      const r = await sendTelegram(text);
      if (r.ok) {
        markWeeklyDone(t.ymd);
        console.log("[Noah Cron] Semanal enviado.");
      } else {
        console.warn("[Noah Cron] Falha semanal:", r.error);
      }
    } catch (e: any) {
      console.error("[Noah Cron] Erro semanal:", e?.message);
    }
  }

  // Recap diário — entre 8h00 e 8h59 BRT (todos os dias, INCLUSIVE segunda)
  if (t.hour === 8 && shouldRunDaily(t.ymd)) {
    try {
      console.log("[Noah Cron] Disparando recap diário");
      const text = await composeDailyRecap();
      const r = await sendTelegram(text);
      if (r.ok) {
        markDailyDone(t.ymd);
        console.log("[Noah Cron] Diário enviado.");
      } else {
        console.warn("[Noah Cron] Falha diário:", r.error);
      }
    } catch (e: any) {
      console.error("[Noah Cron] Erro diário:", e?.message);
    }
  }

  // Watch urgente — qualquer hora, com cooldown de 6h por sinal
  try {
    const health = await getFinanceHealth();
    const reds = health.vitals.filter(v => v.status === "red");
    const newReds = reds.filter(v => shouldFireUrgent(v.key));
    if (newReds.length > 0) {
      console.log(`[Noah Cron] ${newReds.length} sinal(is) urgente(s) novo(s):`, newReds.map(v => v.key));
      const text = await composeUrgentAlert(newReds);
      const r = await sendTelegram(text);
      if (r.ok) {
        for (const v of newReds) markUrgentFired(v.key);
        console.log("[Noah Cron] Urgente enviado.");
      } else {
        console.warn("[Noah Cron] Falha urgente:", r.error);
      }
    }
  } catch (e: any) {
    console.error("[Noah Cron] Erro watch urgente:", e?.message);
  }
}

let intervalHandle: NodeJS.Timeout | null = null;

export function startNoahCronJobs() {
  if (intervalHandle) return;
  console.log("[Noah Cron] Iniciado — checks a cada 5 min");
  // Primeira execução em 30s (depois do startup)
  setTimeout(() => tick(), 30_000);
  // Loop a cada 5 minutos
  intervalHandle = setInterval(() => tick(), 5 * 60 * 1000);
}

export function stopNoahCronJobs() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

/** Endpoint manual pra disparar agora (debug/teste) — retorna sempre o texto composto */
export async function runNoahManual(kind: "daily" | "weekly" | "monthly" | "urgent"): Promise<{ ok: boolean; composed: string; sent: boolean; error?: string }> {
  try {
    let text: string;
    if (kind === "daily") text = await composeDailyRecap();
    else if (kind === "weekly") text = await composeWeeklyRecap();
    else if (kind === "monthly") text = await composeMonthlyRecap();
    else {
      const health = await getFinanceHealth();
      const reds = health.vitals.filter(v => v.status === "red");
      if (reds.length === 0) return { ok: true, composed: "Nenhum sinal urgente — nada a alertar.", sent: false };
      text = await composeUrgentAlert(reds);
    }
    const r = await sendTelegram(text);
    return { ok: true, composed: text, sent: r.ok, error: r.error };
  } catch (e: any) {
    return { ok: false, composed: "", sent: false, error: e.message };
  }
}
