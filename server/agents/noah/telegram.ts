/**
 * Telegram sender pro Noah CEO.
 * Configura via env: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_KAIQUE
 */

const KAIQUE_CHAT_ID_FALLBACK = "5936886703";

export type SendResult = { ok: boolean; error?: string };

export async function sendTelegram(text: string, chatId?: string): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN não configurado" };
  }
  const target = chatId || process.env.TELEGRAM_CHAT_KAIQUE || KAIQUE_CHAT_ID_FALLBACK;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: target,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: `Telegram API ${response.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
