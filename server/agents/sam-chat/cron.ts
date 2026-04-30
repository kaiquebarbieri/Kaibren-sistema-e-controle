/**
 * Cron Sam Chat (Shopee).
 *  - A cada 3 min: sync de chats + responder + capturar replies do Kaique no Telegram
 *  - 1x/dia 03h BRT: rodar curator (atualizar KB)
 */

import { syncAllShops } from "../../shopee-chat";
import { runCurator } from "./curator";
import { runExtractor } from "./product-extractor";
import { runProactiveMessages } from "./proactive-messages";
import { respondNewMessages } from "./responder";
import { pollKaiqueReplies } from "./telegram-poller";

let cycleHandle: NodeJS.Timeout | null = null;
let lastCuratorYmd: string | null = null;
let lastExtractorTick = 0;
let lastProactiveTick = 0;

function ymdBR(): string {
  const utc = new Date();
  const br = new Date(utc.getTime() - 3 * 60 * 60 * 1000);
  return `${br.getUTCFullYear()}-${String(br.getUTCMonth() + 1).padStart(2, "0")}-${String(br.getUTCDate()).padStart(2, "0")}`;
}

function hourBR(): number {
  const utc = new Date();
  const br = new Date(utc.getTime() - 3 * 60 * 60 * 1000);
  return br.getUTCHours();
}

async function tick() {
  // Curator 1x/dia entre 03h e 04h BRT
  const today = ymdBR();
  if (hourBR() === 3 && lastCuratorYmd !== today) {
    try {
      console.log("[Sam Cron] Rodando curator diário…");
      const r = await runCurator();
      console.log("[Sam Cron] Curator OK:", r);
      lastCuratorYmd = today;
    } catch (err: any) {
      console.error("[Sam Cron] Curator erro:", err?.message);
    }
  }

  // Sync + responder + poll Kaique replies
  try {
    const sync = await syncAllShops();
    if (sync.newMessages > 0) {
      console.log(`[Sam Cron] ${sync.newMessages} msgs novas`);
    }
  } catch (err: any) {
    console.error("[Sam Cron] sync erro:", err?.message);
  }

  try {
    const resp = await respondNewMessages();
    if (resp.processed > 0) {
      console.log(`[Sam Cron] respondidas: auto=${resp.autoReplied} shadow=${resp.shadowed} esc=${resp.escalated}`);
    }
  } catch (err: any) {
    console.error("[Sam Cron] responder erro:", err?.message);
  }

  try {
    const poll = await pollKaiqueReplies();
    if (poll.handled > 0) {
      console.log(`[Sam Cron] ${poll.handled} reply(s) do Kaique processada(s)`);
    }
  } catch (err: any) {
    console.error("[Sam Cron] poller erro:", err?.message);
  }

  // Extractor a cada 30 min — extrai estrutura JSON dos anúncios pendentes (max 20 por tick)
  const now = Date.now();
  if (now - lastExtractorTick > 30 * 60 * 1000) {
    try {
      const r = await runExtractor({ limit: 20 });
      if (r.extracted > 0) {
        console.log(
          `[Sam Cron] Extractor: ${r.extracted} anúncios processados — complete=${r.complete}, incomplete=${r.incomplete}, failed=${r.failed}, skipped=${r.skipped}`,
        );
      }
      lastExtractorTick = now;
    } catch (err: any) {
      console.error("[Sam Cron] extractor erro:", err?.message);
    }
  }

  // Proactive messages a cada 15 min — pedidos novos pagos ganham mensagem de confirmação
  if (now - lastProactiveTick > 15 * 60 * 1000) {
    try {
      const r = await runProactiveMessages({ limit: 30 });
      if (r.scanned > 0) {
        console.log(
          `[Sam Cron] Proactive: ${r.scanned} pedidos — sent=${r.sent}, shadow=${r.shadowed}, skipped=${r.skipped}, failed=${r.failed}`,
        );
      }
      lastProactiveTick = now;
    } catch (err: any) {
      console.error("[Sam Cron] proactive erro:", err?.message);
    }
  }
}

export function startSamChatCron() {
  if (cycleHandle) return;
  console.log("[Sam Cron] Iniciado — ciclo a cada 3 min");
  setTimeout(() => tick(), 60_000); // primeiro tick 1min após boot
  cycleHandle = setInterval(() => tick(), 3 * 60 * 1000);
}

export function stopSamChatCron() {
  if (cycleHandle) {
    clearInterval(cycleHandle);
    cycleHandle = null;
  }
}
