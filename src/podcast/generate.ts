import fs from "fs/promises";
import path from "path";
import { query } from "../db.js";
import { callLLM } from "../llm.js";
import { config } from "../config.js";
import { podcastPrompt, validatePodcastScript } from "./prompt.js";
import { synthesizePodcast } from "./tts.js";
import { archivePodcast, deleteArchivedPodcast, logPodcastArchiveConfig, verifyPodcastArchive } from "./telegram.js";

export type PodcastRow = { id: string; book_id: string; log_id: string | null; chapter_key: string; chapter_title: string | null; status: string; language: "vi" | "en"; voice_model: string; script_text: string | null; local_cache_path: string | null; local_cache_until: string | null };
const voices = { vi: { female: "edge-tts/vi-VN-HoaiMyNeural", male: "edge-tts/vi-VN-NamMinhNeural" }, en: { female: "edge-tts/en-US-JennyNeural", male: "edge-tts/en-US-ChristopherNeural" } } as const;
const cacheExpiresAt = () => new Date(Date.now() + Math.max(1, config.podcastCacheTtlHours) * 3600000);

/** Resolve Auto from the actual chapter source so Vietnamese EPUBs never fall through to English. */
export function resolvePodcastLanguage(requested: string | null, chapterText: string): "vi" | "en" {
  if (requested === "vi" || requested === "en") return requested;
  const vietnameseSignals = (chapterText.match(/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/gi) || []).length;
  const words = chapterText.match(/[A-Za-zÀ-ỹ]+/g)?.length || 1;
  return vietnameseSignals / words >= 0.08 ? "vi" : "en";
}
function safeArchiveMessage(error: unknown) { return `Archive pending: ${String(error instanceof Error ? error.message : error).slice(0, 700)}`; }
export function podcastPublic(row: any) { const { tg_file_id, tg_file_unique_id, tg_chat_id, tg_message_id, local_cache_path, local_cache_until, user_id, book_id, chapter_key, error_message, ...safe } = row; return safe; }

export async function createPodcast(ownerId: string, bookId: string, chapterKey: string, gender?: "female" | "male"): Promise<any> {
  const { rows } = await query<any>(`SELECT b.id,b.title,b.author,b.file_type,b.summary_lang,b.reading_round,b.status
    FROM books b WHERE b.id=$1 AND b.owner_id=$2`, [bookId, ownerId]);
  const source = rows[0]; if (!source) throw new Error("Book chapter was not found"); if (source.file_type !== "epub") throw new Error("Podcast is available for EPUB books only");
  if (source.status !== "active") { const error: any = new Error("Resume this book before creating podcast episodes"); error.code = "BOOK_NOT_ACTIVE"; throw error; }
  // The narrator is per Book + per reading round: persist the picker choice only
  // when this Book/Round has none yet; a re-read round is a fresh session that
  // must choose again. users.podcast_voice_gender is never consulted.
  const narrator = (await query<any>("SELECT voice_gender FROM podcast_narrators WHERE book_id=$1 AND reading_round=$2", [bookId, source.reading_round || 1])).rows[0];
  const voiceGender = (narrator?.voice_gender as "female" | "male" | undefined) || gender;
  if (!voiceGender) { const error: any = new Error("Choose a narrator voice before creating your first episode"); error.code = "VOICE_REQUIRED"; throw error; }
  if (!narrator) {
    await query("INSERT INTO podcast_narrators (book_id, reading_round, voice_gender) VALUES ($1,$2,$3) ON CONFLICT (book_id, reading_round) DO NOTHING", [bookId, source.reading_round || 1, voiceGender]);
    const after = (await query<any>("SELECT voice_gender FROM podcast_narrators WHERE book_id=$1 AND reading_round=$2", [bookId, source.reading_round || 1])).rows[0];
    if (after?.voice_gender && after.voice_gender !== voiceGender) throw new Error("This reading round already picked its narrator voice.");
  }
  const units = await query<any>(`SELECT chapter_key, title, raw_text FROM book_reading_units WHERE book_id=$1 AND chapter_key=$2 ORDER BY unit_index`, [bookId, chapterKey]);
  const unit = units.rows[0];
  if (!unit) throw new Error("This EPUB chapter needs to be indexed before Podcast can use it");
  const chapterText = units.rows.map((row) => row.raw_text || "").join("\n\n");
  if (!chapterText.trim()) throw new Error("No raw EPUB text exists for this chapter");
  const language = resolvePodcastLanguage(source.summary_lang, chapterText); const voice = voices[language][voiceGender];
  const existing = (await query<any>("SELECT * FROM podcasts WHERE book_id=$1 AND chapter_key=$2 AND reading_round=$3", [bookId, unit.chapter_key, source.reading_round || 1])).rows[0];
  if (existing) {
    // An ordinary Create/Try again must never replace a listenable episode or race
    // an already-queued worker. Explicit regeneration is the only destructive path.
    if (["ready", "archive_pending", "queued", "scripting", "synthesizing", "archiving"].includes(existing.status)) return podcastPublic(existing);
    const retried = (await query<any>("UPDATE podcasts SET status='queued',language=$2,voice_model=$3,error_message=NULL,updated_at=now() WHERE id=$1 RETURNING *", [existing.id, language, voice])).rows[0];
    void generatePodcast(existing.id).catch((error) => console.warn("[podcast] background generation failed:", error.message));
    return podcastPublic(retried);
  }
  const inserted = await query<any>(`INSERT INTO podcasts (user_id,book_id,log_id,reading_round,chapter_key,chapter_title,language,voice_model,status)
    VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,'queued') RETURNING *`, [ownerId, bookId, source.reading_round || 1, unit.chapter_key, unit.title, language, voice]);
  void generatePodcast(inserted.rows[0].id).catch((error) => console.warn("[podcast] background generation failed:", error.message));
  return podcastPublic(inserted.rows[0]);
}

/** Explicit destructive regeneration. The persisted narrator choice stays unchanged. */
export async function regeneratePodcast(ownerId: string, episodeId: string): Promise<any> {
  const episode = (await query<any>(`SELECT p.*,b.summary_lang,b.status AS book_status FROM podcasts p JOIN books b ON b.id=p.book_id WHERE p.id=$1 AND p.user_id=$2 AND b.owner_id=$2`, [episodeId, ownerId])).rows[0];
  if (!episode) throw new Error("Podcast episode was not found");
  if (episode.book_status !== "active") { const error: any = new Error("Resume this book before regenerating podcast episodes"); error.code = "BOOK_NOT_ACTIVE"; throw error; }
  if (["queued", "scripting", "synthesizing", "archiving"].includes(episode.status)) return podcastPublic(episode);
  const units = await query<any>("SELECT raw_text FROM book_reading_units WHERE book_id=$1 AND chapter_key=$2 ORDER BY unit_index", [episode.book_id, episode.chapter_key]);
  const chapterText = units.rows.map((row) => row.raw_text || "").join("\n\n");
  if (!chapterText.trim()) throw new Error("No raw EPUB text exists for this chapter");
  const language = resolvePodcastLanguage(episode.summary_lang, chapterText);
  // Regeneration keeps the narrator of the episode's own Book + Round.
  const narrator = (await query<any>("SELECT voice_gender FROM podcast_narrators WHERE book_id=$1 AND reading_round=$2", [episode.book_id, episode.reading_round])).rows[0];
  const voiceGender = narrator?.voice_gender as "female" | "male" | undefined;
  if (!voiceGender) { const error: any = new Error("Choose a narrator voice before regenerating this episode"); error.code = "VOICE_REQUIRED"; throw error; }
  const voice = voices[language][voiceGender];
  if (episode.local_cache_path) await fs.unlink(episode.local_cache_path).catch(() => undefined);
  await deleteArchivedPodcast(episode.tg_chat_id, episode.tg_message_id);
  const reset = (await query<any>(`UPDATE podcasts SET status='queued', language=$2, voice_model=$3, script_text=NULL, word_count=NULL, duration_s=NULL,
    tg_file_id=NULL, tg_file_unique_id=NULL, tg_chat_id=NULL, tg_message_id=NULL,
    local_cache_path=NULL, local_cache_until=NULL, error_message=NULL, updated_at=now()
    WHERE id=$1 RETURNING *`, [episodeId, language, voice])).rows[0];
  void generatePodcast(episodeId).catch((error) => console.warn("[podcast] background regeneration failed:", error.message));
  return podcastPublic(reset);
}

async function retainPendingArchive(id: string, audioPath: string, durationS: number, error: unknown): Promise<void> {
  await fs.mkdir(config.podcastCacheDir, { recursive: true });
  const cachePath = path.join(config.podcastCacheDir, `${id}.mp3`);
  await fs.rename(audioPath, cachePath);
  await query("UPDATE podcasts SET status='archive_pending',duration_s=$2,local_cache_path=$3,local_cache_until=$4,error_message=$5,updated_at=now() WHERE id=$1", [id, durationS, cachePath, cacheExpiresAt(), safeArchiveMessage(error)]);
}

export async function generatePodcast(id: string): Promise<void> {
  const current = (await query<any>(`SELECT p.*,b.title AS book_title,b.author,b.summary_lang,COALESCE(u.display_name, u.username) AS user_name FROM podcasts p JOIN books b ON b.id=p.book_id JOIN users u ON u.id=p.user_id WHERE p.id=$1`, [id])).rows[0] as PodcastRow & any;
  if (!current || current.status === "ready" || current.status === "archive_pending") return;
  let audioPath: string | undefined;
  try {
    logPodcastArchiveConfig(config.podcastTelegramArchiveChatId);
    await verifyPodcastArchive(config.podcastTelegramArchiveChatId);
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
    try {
      const archived = await archivePodcast(audio.filePath, config.podcastTelegramArchiveChatId, current.user_name, current.book_title, current.chapter_title, audio.durationS);
      await fs.mkdir(config.podcastCacheDir, { recursive: true });
      const cachePath = path.join(config.podcastCacheDir, `${id}.mp3`); await fs.rename(audio.filePath, cachePath); audioPath = undefined;
      await query(`UPDATE podcasts SET status='ready',tg_file_id=$2,tg_file_unique_id=$3,tg_chat_id=$4,tg_message_id=$5,local_cache_path=$6,local_cache_until=$7,error_message=NULL,updated_at=now() WHERE id=$1`, [id, archived.fileId, archived.fileUniqueId, config.podcastTelegramArchiveChatId, archived.messageId, cachePath, cacheExpiresAt()]);
    } catch (error) {
      await retainPendingArchive(id, audio.filePath, audio.durationS, error); audioPath = undefined;
      console.warn(`[podcast] archive pending for ${id}; protected local playback remains available:`, safeArchiveMessage(error));
    }
  } catch (error: any) { await query("UPDATE podcasts SET status='failed',error_message=$2,updated_at=now() WHERE id=$1", [id, String(error.message || error).slice(0, 1000)]).catch(() => undefined); throw error; }
  finally { if (audioPath) await fs.unlink(audioPath).catch(() => undefined); }
}

export async function retryPendingPodcastArchives(): Promise<void> {
  const { rows } = await query<any>("SELECT p.*,b.title AS book_title,COALESCE(u.display_name, u.username) AS user_name FROM podcasts p JOIN books b ON b.id=p.book_id JOIN users u ON u.id=p.user_id WHERE p.status='archive_pending' AND p.local_cache_path IS NOT NULL AND p.local_cache_until > now()");
  if (!rows.length) return;
  logPodcastArchiveConfig(config.podcastTelegramArchiveChatId);
  try { await verifyPodcastArchive(config.podcastTelegramArchiveChatId); } catch (error: any) { console.warn("[podcast] archive retry preflight failed:", error.message); return; }
  for (const episode of rows) {
    try {
      const archived = await archivePodcast(episode.local_cache_path, config.podcastTelegramArchiveChatId, episode.user_name, episode.book_title, episode.chapter_title, episode.duration_s || 1);
      await query("UPDATE podcasts SET status='ready',tg_file_id=$2,tg_file_unique_id=$3,tg_chat_id=$4,tg_message_id=$5,error_message=NULL,updated_at=now() WHERE id=$1", [episode.id, archived.fileId, archived.fileUniqueId, config.podcastTelegramArchiveChatId, archived.messageId]);
      console.info(`[podcast] archived cached episode ${episode.id}`);
    } catch (error: any) { console.warn(`[podcast] archive retry failed for ${episode.id}:`, error.message); }
  }
}

export async function prunePodcastCache(): Promise<void> {
  const expired = await query<any>("SELECT id,local_cache_path,status FROM podcasts WHERE local_cache_until < now() AND local_cache_path IS NOT NULL");
  for (const row of expired.rows) {
    await fs.unlink(row.local_cache_path).catch(() => undefined);
    await query("UPDATE podcasts SET local_cache_path=NULL,local_cache_until=NULL,status=CASE WHEN status='archive_pending' THEN 'failed' ELSE status END,error_message=CASE WHEN status='archive_pending' THEN 'Archive was unavailable before the protected local copy expired. Try again.' ELSE error_message END,updated_at=now() WHERE id=$1", [row.id]);
  }
}
