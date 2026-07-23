// Telegram push helper for the daily reading-summary delivery (Phase 3).
// Uses the Bot API directly via fetch — no extra dependency.

const TG_API = "https://api.telegram.org";

function escapeMd(text: string): string {
  // MarkdownV2: escape reserved chars
  return text.replace(/([_*`\[\]()~>#+\-=|{}.!])/g, "\\$1");
}

export interface TelegramConfig {
  botToken: string;
}

/** Bot credentials are server-wide; each recipient chat ID lives on users.telegram_chat_id. */
export function getTelegramConfig(): TelegramConfig | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return null;
  return { botToken };
}

export async function sendTelegramMessage(
  cfg: TelegramConfig,
  chatId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);
    const res = await fetch(`${TG_API}/bot${cfg.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
      signal: ac.signal,
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/** Format one book's daily log into a Telegram MarkdownV2 message. */
export function formatDailyMessage(
  bookTitle: string,
  author: string,
  log: { date: string; page_start: number; page_end: number; summary: string | null; key_insights: string[] | null; quote: string | null }
): string {
  const t = escapeMd(bookTitle);
  const a = escapeMd(author);
  let msg = `📖 *${t}* \\- _${a}_\n`;
  msg += `🗓 ${log.date} \\| Trang ${log.page_start}\\–${log.page_end}\n\n`;
  if (log.summary) msg += `${escapeMd(log.summary)}\n\n`;
  if (log.key_insights && log.key_insights.length) {
    msg += `💡 *Key insights:*\n`;
    for (const ins of log.key_insights) msg += `• ${escapeMd(ins)}\n`;
    msg += `\n`;
  }
  if (log.quote) msg += `✦ _${escapeMd(log.quote)}_\n`;
  return msg.trim();
}
