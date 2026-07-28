import fs from "fs/promises";
import { getTelegramConfig } from "../telegram.js";

const api = "https://api.telegram.org";

export async function archivePodcast(filePath: string, chatId: string, title: string, chapterTitle: string | null, durationS: number) {
  const cfg = getTelegramConfig();
  if (!cfg) throw new Error("Telegram archive is not configured");
  const bytes = await fs.readFile(filePath);
  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("audio", new Blob([bytes], { type: "audio/mpeg" }), "chapter-podcast.mp3");
  form.set("title", chapterTitle || title);
  form.set("performer", "Chapter");
  form.set("duration", String(Math.max(1, durationS)));
  const response = await fetch(`${api}/bot${cfg.botToken}/sendAudio`, { method: "POST", body: form });
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok || !body.result?.audio?.file_id) throw new Error(body.description || `Telegram archive failed (${response.status})`);
  return { fileId: body.result.audio.file_id as string, fileUniqueId: body.result.audio.file_unique_id as string | null, messageId: Number(body.result.message_id) };
}

export async function downloadArchivedPodcast(fileId: string): Promise<Buffer> {
  const cfg = getTelegramConfig();
  if (!cfg) throw new Error("Telegram archive is not configured");
  const lookup = await fetch(`${api}/bot${cfg.botToken}/getFile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_id: fileId }) });
  const found: any = await lookup.json().catch(() => ({}));
  if (!lookup.ok || !found.ok || !found.result?.file_path) throw new Error(found.description || "Telegram archive file is unavailable");
  const audio = await fetch(`${api}/file/bot${cfg.botToken}/${found.result.file_path}`);
  if (!audio.ok) throw new Error(`Telegram archive download failed (${audio.status})`);
  return Buffer.from(await audio.arrayBuffer());
}