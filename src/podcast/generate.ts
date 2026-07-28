import fs from "fs/promises";
import path from "path";
import { query } from "../db.js";
import { callLLM } from "../llm.js";
import { config } from "../config.js";
import { podcastPrompt, validatePodcastScript } from "./prompt.js";
import { synthesizePodcast } from "./tts.js";
import { archivePodcast } from "./telegram.js";

export type PodcastRow = { id: string; book_id: string; log_id: string | null; chapter_key: string; chapter_title: string | null; status: string; language: "vi" | "en"; voice_model: string; script_text: string | null };
const voices = { vi: { female: "edge-tts/vi-VN-HoaiMyNeural", male: "edge-tts/vi-VN-NamMinhNeural" }, en: { female: "edge-tts/en-US-JennyNeural", male: "edge-tts/en-US-ChristopherNeural" } } as const;

function resolvedLanguage(value: string | null): "vi" | "en" { return value === "vi" ? "vi" : "en"; }
export function podcastPublic(row: any) { const { tg_file_id, tg_file_unique_id, tg_chat_id, tg_message_id, local_cache_path, local_cache_until, user_id, book_id, chapter_key, ...safe } = row; return safe; }

export async function createPodcast(ownerId: string, bookId: string, chapterKey: string, gender?: "female" | "male"): Promise<any> {
  const { rows } = await query<any>(`SELECT b.id,b.title,b.author,b.file_type,b.summary_lang,b.reading_round,u.podcast_voice_gender
    FROM books b JOIN users u ON u.id=b.owner_id WHERE b.id=$1 AND b.owner_id=$2`, [bookId, ownerId]);
  const source = rows[0]; if (!source) throw new Error("Book chapter was not found"); if (source.file_type !== "epub") throw new Error("Podcast is available for EPUB books only");
  let voiceGender = source.podcast_voice_gender as "female" | "male" | null;
  if (!voiceGender && gender) {
    await query("UPDATE users SET podcast_voice_gender=$1 WHERE id=$2 AND podcast_voice_gender IS NULL", [gender, ownerId]);
    voiceGender = (await query<{ podcast_voice_gender: "female" | "male" | null }>("SELECT podcast_voice_gender FROM users WHERE id=$1", [ownerId])).rows[0]?.podcast_voice_gender || null;
  }
  if (!voiceGender) { const error: any = new Error("Choose a narrator voice before creating your first episode"); error.code = "VOICE_REQUIRED"; throw error; }
  const unit = (await query<any>(`SELECT chapter_key, title FROM book_reading_units WHERE book_id=$1 AND chapter_key=$2 ORDER BY unit_index LIMIT 1`, [bookId, chapterKey])).rows[0];
  if (!unit) throw new Error("This EPUB chapter needs to be indexed before Podcast can use it");
  const language = resolvedLanguage(source.summary_lang); const voice = voices[language][voiceGender];
  const inserted = await query<any>(`INSERT INTO podcasts (user_id,book_id,log_id,reading_round,chapter_key,chapter_title,language,voice_model,status)
    VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,'queued') ON CONFLICT (book_id,chapter_key,reading_round) DO UPDATE SET status='queued',error_message=NULL,updated_at=now() RETURNING *`, [ownerId, bookId, source.reading_round || 1, unit.chapter_key, unit.title, language, voice]);
  void generatePodcast(inserted.rows[0].id).catch((error) => console.warn("[podcast] background generation failed:", error.message));
  return podcastPublic(inserted.rows[0]);
}

export async function generatePodcast(id: string): Promise<void> {
  const current = (await query<any>(`SELECT p.*,b.title AS book_title,b.author,b.summary_lang FROM podcasts p JOIN books b ON b.id=p.book_id WHERE p.id=$1`, [id])).rows[0] as PodcastRow & any;
  if (!current || current.status === "ready") return;
  let audioPath: string | undefined;
  try {
    await query("UPDATE podcasts SET status='scripting',error_message=NULL,updated_at=now() WHERE id=$1", [id]);
    const units = await query<any>("SELECT raw_text FROM book_reading_units WHERE book_id=$1 AND chapter_key=$2 ORDER BY unit_index", [current.book_id, current.chapter_key]);
    const chapterText = units.rows.map((row) => row.raw_text).join("\n\n"); if (!chapterText) throw new Error("No raw EPUB text exists for this chapter");
    const prompt = podcastPrompt({ title: current.book_title, author: current.author, chapterTitle: current.chapter_title, language: current.language, chapterText });
    let script = await callLLM(prompt.system, prompt.user, 0.75, true, false, 300000, { priority: "background", traceLabel: "podcast-script", model: config.podcastLlmModel || undefined });
    if (validatePodcastScript(script)) script = await callLLM(prompt.system, `${prompt.user}\n\nReturn plain spoken prose only. No Markdown, headings, or lists.`, 0.65, true, false, 300000, { priority: "background", traceLabel: "podcast-script-retry", model: config.podcastLlmModel || undefined });
    const invalid = validatePodcastScript(script); if (invalid) throw new Error(`Podcast script invalid: ${invalid}`);
    await query("UPDATE podcasts SET status='synthesizing',script_text=$2,word_count=$3,updated_at=now() WHERE id=$1", [id, script, script.split(/\s+/).length]);
    const audio = await synthesizePodcast(script, current.voice_model); audioPath = audio.filePath;
    await query("UPDATE podcasts SET status='archiving',duration_s=$2,updated_at=now() WHERE id=$1", [id, audio.durationS]);
    if (!config.podcastTelegramArchiveChatId) throw new Error("Podcast Telegram archive chat is not configured");
    const archived = await archivePodcast(audio.filePath, config.podcastTelegramArchiveChatId, current.book_title, current.chapter_title, audio.durationS);
    const expires = new Date(Date.now() + Math.max(1, config.podcastCacheTtlHours) * 3600000);
    const cachePath = path.join(config.podcastCacheDir, `${id}.mp3`); await fs.rename(audio.filePath, cachePath); audioPath = undefined;
    await query(`UPDATE podcasts SET status='ready',tg_file_id=$2,tg_file_unique_id=$3,tg_chat_id=$4,tg_message_id=$5,local_cache_path=$6,local_cache_until=$7,updated_at=now() WHERE id=$1`, [id, archived.fileId, archived.fileUniqueId, config.podcastTelegramArchiveChatId, archived.messageId, cachePath, expires]);
  } catch (error: any) { await query("UPDATE podcasts SET status='failed',error_message=$2,updated_at=now() WHERE id=$1", [id, String(error.message || error).slice(0, 1000)]).catch(() => undefined); throw error; }
  finally { if (audioPath) await fs.unlink(audioPath).catch(() => undefined); }
}

export async function prunePodcastCache(): Promise<void> { const expired = await query<any>("SELECT id,local_cache_path FROM podcasts WHERE local_cache_until < now() AND local_cache_path IS NOT NULL"); for (const row of expired.rows) { await fs.unlink(row.local_cache_path).catch(() => undefined); await query("UPDATE podcasts SET local_cache_path=NULL,local_cache_until=NULL WHERE id=$1", [row.id]); } }