import fs from "fs/promises";
import { getTelegramConfig } from "../telegram.js";

const api = "https://api.telegram.org";

export type TelegramArchiveResult = { fileId: string; fileUniqueId: string | null; messageId: number };

function archiveSuffix(chatId: string) {
  return chatId.length >= 4 ? `…${chatId.slice(-4)}` : "configured";
}

async function telegramJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) throw new Error(body.description || `Telegram request failed (${response.status})`);
  return body;
}

/** Server-only archive diagnostic. Never return this result to the browser. */
export async function verifyPodcastArchive(chatId: string): Promise<void> {
  const cfg = getTelegramConfig();
  if (!cfg) throw new Error("Telegram archive bot is not configured");
  if (!chatId) throw new Error("Podcast archive destination is not configured");
  try {
    await telegramJson(`${api}/bot${cfg.botToken}/getChat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId }),
    });
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

export async function archivePodcast(filePath: string, chatId: string, title: string, chapterTitle: string | null, durationS: number): Promise<TelegramArchiveResult> {
  const cfg = getTelegramConfig();
  if (!cfg) throw new Error("Telegram archive bot is not configured");
  if (!chatId) throw new Error("Podcast archive destination is not configured");
  const bytes = await fs.readFile(filePath);
  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("audio", new Blob([bytes], { type: "audio/mpeg" }), "chapter-podcast.mp3");
  form.set("title", chapterTitle || title);
  form.set("performer", "Chapter");
  form.set("duration", String(Math.max(1, durationS)));
  const body = await telegramJson(`${api}/bot${cfg.botToken}/sendAudio`, { method: "POST", body: form });
  if (!body.result?.audio?.file_id) throw new Error("Telegram archive did not return an audio file identifier");
  return { fileId: body.result.audio.file_id as string, fileUniqueId: body.result.audio.file_unique_id as string | null, messageId: Number(body.result.message_id) };
}

export async function downloadArchivedPodcast(fileId: string): Promise<Buffer> {
  const cfg = getTelegramConfig();
  if (!cfg) throw new Error("Telegram archive bot is not configured");
  const found = await telegramJson(`${api}/bot${cfg.botToken}/getFile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_id: fileId }) });
  if (!found.result?.file_path) throw new Error("Telegram archive file is unavailable");
  const audio = await fetch(`${api}/file/bot${cfg.botToken}/${found.result.file_path}`);
  if (!audio.ok) throw new Error(`Telegram archive download failed (${audio.status})`);
  return Buffer.from(await audio.arrayBuffer());
}
