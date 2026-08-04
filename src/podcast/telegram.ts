import fs from "fs/promises";
import { getTelegramConfig } from "../telegram.js";

const api = "https://api.telegram.org";

export type TelegramArchiveResult = { fileId: string; fileUniqueId: string | null; messageId: number };

function archiveSuffix(chatId: string) {
  return chatId.length >= 4 ? `…${chatId.slice(-4)}` : "configured";
}

async function telegramJson(url: string, init: RequestInit, retrySafe = false) {
  // DNS/TLS occasionally flakes on the host. Only retry read-only Telegram calls:
  // repeating sendAudio could create duplicate archive messages.
  const attempts = retrySafe ? 3 : 1;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
      const body: any = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.description || `Telegram request failed (${response.status})`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError;
}

/** Server-only archive diagnostic. Never return this result to the browser. */
export async function verifyPodcastArchive(chatId: string): Promise<void> {
  const cfg = getTelegramConfig();
  if (!cfg) throw new Error("Podcast archive bot is not configured");
  if (!chatId) throw new Error("Podcast archive destination is not configured");
  try {
    await telegramJson(`${api}/bot${cfg.botToken}/getChat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId }),
    }, true);
  } catch (error: any) {
    throw new Error(`Podcast archive preflight failed for ${archiveSuffix(chatId)}: ${String(error.message || error)}`);
  }
}

export function logPodcastArchiveConfig(chatId: string) {
  const raw = process.env.PODCAST_TELEGRAM_ARCHIVE_CHAT_ID ?? "";
  const normalized = raw.trim();
  const quoteWrapped = /^['\"].*['\"]$/.test(raw);
  const hiddenChars = raw !== normalized || /[\r\n\t]/.test(raw);
  console.info(`[podcast] archive configuration: configured=${Boolean(chatId)} rawLength=${raw.length} normalizedLength=${normalized.length} idSuffix=${chatId ? archiveSuffix(chatId) : "none"} quoteWrapped=${quoteWrapped} hiddenChars=${hiddenChars}`);
}

function cleanPart(value: string | null | undefined, fallback: string, max = 72): string {
  return String(value || fallback)
    .replace(/[\/\\:*?"<>|\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trim() || fallback;
}

export function archiveFilename(userName: string | null, bookTitle: string, chapterTitle: string | null): string {
  // Trackable archive filename: "<user> – <first 15 chars of book> – <first 15 chars of chapter>.mp3"
  return `${cleanPart(userName, "User", 20)} – ${cleanPart(bookTitle, "Book", 15)} – ${cleanPart(chapterTitle, "Chapter", 15)}.mp3`;
}

export async function archivePodcast(filePath: string, chatId: string, userName: string | null, title: string, chapterTitle: string | null, durationS: number): Promise<TelegramArchiveResult> {
  const cfg = getTelegramConfig();
  if (!cfg) throw new Error("Podcast archive bot is not configured");
  if (!chatId) throw new Error("Podcast archive destination is not configured");
  const bytes = await fs.readFile(filePath);
  const makeForm = () => {
    const form = new FormData();
    form.set("chat_id", chatId);
    form.set("audio", new Blob([bytes], { type: "audio/mpeg" }), archiveFilename(userName, title, chapterTitle));
    form.set("title", `${cleanPart(title, "Book", 72)} – ${cleanPart(chapterTitle, "Chapter", 72)}`);
    form.set("performer", cleanPart(userName, "Chapter", 20));
    form.set("duration", String(Math.max(1, durationS)));
    return form;
  };
  // A network reset can happen after the request has left the host. One retry is
  // acceptable for this private archive: at worst it creates a duplicate archive
  // message, while preserving the audio that the reader explicitly requested.
  let body: any;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      body = await telegramJson(`${api}/bot${cfg.botToken}/sendAudio`, { method: "POST", body: makeForm() });
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }
  if (!body) throw lastError;
  if (!body.result?.audio?.file_id) throw new Error("Telegram archive did not return an audio file identifier");
  return { fileId: body.result.audio.file_id as string, fileUniqueId: body.result.audio.file_unique_id as string | null, messageId: Number(body.result.message_id) };
}

/** Best-effort cleanup for an app-managed archive message. Callers must never expose failures. */
export async function deleteArchivedPodcast(chatId: string | null, messageId: number | null): Promise<boolean> {
  if (!chatId || !messageId) return false;
  const cfg = getTelegramConfig();
  if (!cfg) return false;
  try {
    await telegramJson(`${api}/bot${cfg.botToken}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
    return true;
  } catch (error: any) {
    console.info(`[podcast] archive delete skipped: ${String(error.message || error).slice(0, 160)}`);
    return false;
  }
}

export async function downloadArchivedPodcast(fileId: string): Promise<Buffer> {
  const cfg = getTelegramConfig();
  if (!cfg) throw new Error("Podcast archive bot is not configured");
  const found = await telegramJson(`${api}/bot${cfg.botToken}/getFile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_id: fileId }) });
  if (!found.result?.file_path) throw new Error("Telegram archive file is unavailable");
  const audio = await fetch(`${api}/file/bot${cfg.botToken}/${found.result.file_path}`);
  if (!audio.ok) throw new Error(`Telegram archive download failed (${audio.status})`);
  return Buffer.from(await audio.arrayBuffer());
}
