import fs from "fs/promises";
import path from "path";
import { query } from "../db.js";
import { callLLM } from "../llm.js";
import { config } from "../config.js";
import { isPodcastSourceTooBrief, podcastMinimumWords, podcastPrompt, podcastWordCount, validatePodcastScript } from "./prompt.js";
import { resolvePodcastChapter, resolvePodcastChapters } from "./chapters.js";
import { isRetryableTtsError, synthesizePodcast } from "./tts.js";
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

const TOO_BRIEF_PREFIX = "SOURCE_TOO_BRIEF:";
const MAX_AUTO_SKIP_CHAIN = 5;

async function markPodcastUnavailable(ownerId: string, bookId: string, round: number, chapterKey: string, title: string | null, language: "vi" | "en", voice: string, sourceWords: number): Promise<any> {
  const row = (await query<any>(`INSERT INTO podcasts (user_id,book_id,log_id,reading_round,chapter_key,chapter_title,language,voice_model,status,word_count,error_message)
    VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,'unavailable',$8,$9)
    ON CONFLICT (book_id,chapter_key,reading_round) DO UPDATE SET
      status='unavailable', language=EXCLUDED.language, voice_model=EXCLUDED.voice_model, word_count=EXCLUDED.word_count, error_message=EXCLUDED.error_message, updated_at=now()
    RETURNING *`, [ownerId, bookId, round, chapterKey, title, language, voice, sourceWords, `${TOO_BRIEF_PREFIX}${sourceWords}`])).rows[0];
  return podcastPublic(row);
}

async function autoQueueNextEligiblePodcast(ownerId: string, bookId: string, round: number, afterChapterKey: string, gender: "female" | "male", remaining = MAX_AUTO_SKIP_CHAIN): Promise<void> {
  if (remaining <= 0) return;
  const resolved = await resolvePodcastChapters(bookId);
  const index = resolved.chapters.findIndex((chapter) => chapter.chapter_key === afterChapterKey);
  const next = index >= 0 ? resolved.chapters[index + 1] : null;
  if (!next) return;
  const result = await createPodcast(ownerId, bookId, next.chapter_key, gender, remaining - 1);
  if (result.status === "unavailable") return;
}

export async function createPodcast(ownerId: string, bookId: string, chapterKey: string, gender?: "female" | "male", remainingAutoSkips = MAX_AUTO_SKIP_CHAIN): Promise<any> {
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
  const resolvedTarget = await resolvePodcastChapter(bookId, chapterKey);
  const chapterTitle = resolvedTarget.chapter?.chapter_title || null;
  if (!chapterTitle) { const error: any = new Error("This EPUB section is not available as a podcast episode."); error.code = "CHAPTER_HEADING_REQUIRED"; throw error; }
  const chapterText = units.rows.map((row) => row.raw_text || "").join("\n\n");
  if (!chapterText.trim()) throw new Error("No raw EPUB text exists for this chapter");
  const language = resolvePodcastLanguage(source.summary_lang, chapterText); const voice = voices[language][voiceGender];
  const sourceWords = podcastWordCount(chapterText);
  if (isPodcastSourceTooBrief(chapterText)) {
    const unavailable = await markPodcastUnavailable(ownerId, bookId, source.reading_round || 1, unit.chapter_key, chapterTitle, language, voice, sourceWords);
    void autoQueueNextEligiblePodcast(ownerId, bookId, source.reading_round || 1, unit.chapter_key, voiceGender, remainingAutoSkips).catch((error) => console.warn("[podcast] too-brief continuation failed:", error.message));
    return unavailable;
  }
  const existing = (await query<any>("SELECT * FROM podcasts WHERE book_id=$1 AND chapter_key=$2 AND reading_round=$3", [bookId, unit.chapter_key, source.reading_round || 1])).rows[0];
  if (existing) {
    // An ordinary Create/Try again must never replace a listenable episode or race
    // an already-queued worker. Explicit regeneration is the only destructive path.
    if (["ready", "archive_pending", "queued", "scripting", "synthesizing", "archiving", "unavailable"].includes(existing.status)) return podcastPublic(existing);
    const retried = (await query<any>("UPDATE podcasts SET status='queued',language=$2,voice_model=$3,error_message=NULL,updated_at=now() WHERE id=$1 RETURNING *", [existing.id, language, voice])).rows[0];
    void generatePodcast(existing.id).catch((error) => console.warn("[podcast] background generation failed:", error.message));
    return podcastPublic(retried);
  }
  const inserted = await query<any>(`INSERT INTO podcasts (user_id,book_id,log_id,reading_round,chapter_key,chapter_title,language,voice_model,status)
    VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,'queued') RETURNING *`, [ownerId, bookId, source.reading_round || 1, unit.chapter_key, chapterTitle, language, voice]);
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
  if (isPodcastSourceTooBrief(chapterText)) return podcastPublic(await markPodcastUnavailable(ownerId, episode.book_id, episode.reading_round, episode.chapter_key, episode.chapter_title, resolvePodcastLanguage(episode.summary_lang, chapterText), episode.voice_model, podcastWordCount(chapterText)));
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

const MAX_TTS_RECOVERY_ATTEMPTS = 6;
const TTS_RETRY_DELAY_MINUTES = 2;

async function deferRetryableTts(id: string, error: unknown): Promise<boolean> {
  if (!isRetryableTtsError(error)) return false;
  const row = (await query<any>(`UPDATE podcasts SET
    tts_retry_count=tts_retry_count+1,
    tts_next_retry_at=CASE WHEN tts_retry_count+1 < $2 THEN now() + ($3::text || ' minutes')::interval ELSE NULL END,
    status=CASE WHEN tts_retry_count+1 < $2 THEN 'synthesizing' ELSE 'failed' END,
    error_message=CASE WHEN tts_retry_count+1 < $2 THEN 'TTS_RETRYABLE:' || $4 ELSE 'TTS upstream remained unavailable. Try again later.' END,
    updated_at=now() WHERE id=$1 RETURNING tts_retry_count`, [id, MAX_TTS_RECOVERY_ATTEMPTS, TTS_RETRY_DELAY_MINUTES, error.status || 0])).rows[0];
  return Boolean(row && row.tts_retry_count < MAX_TTS_RECOVERY_ATTEMPTS);
}

async function finishSynthesizedPodcast(current: any, audioPath: string, durationS: number): Promise<void> {
  await query("UPDATE podcasts SET status='archiving',duration_s=$2,tts_next_retry_at=NULL,error_message=NULL,updated_at=now() WHERE id=$1", [current.id, durationS]);
  try {
    const archived = await archivePodcast(audioPath, config.podcastTelegramArchiveChatId, current.user_name, current.book_title, current.chapter_title, durationS);
    await fs.mkdir(config.podcastCacheDir, { recursive: true });
    const cachePath = path.join(config.podcastCacheDir, `${current.id}.mp3`); await fs.rename(audioPath, cachePath);
    await query(`UPDATE podcasts SET status='ready',tg_file_id=$2,tg_file_unique_id=$3,tg_chat_id=$4,tg_message_id=$5,local_cache_path=$6,local_cache_until=$7,error_message=NULL,tts_next_retry_at=NULL,updated_at=now() WHERE id=$1`, [current.id, archived.fileId, archived.fileUniqueId, config.podcastTelegramArchiveChatId, archived.messageId, cachePath, cacheExpiresAt()]);
  } catch (error) { await retainPendingArchive(current.id, audioPath, durationS, error); }
}

export async function recoverRetryablePodcastTts(batchSize = 2): Promise<void> {
  const due = await query<any>(`WITH candidate AS (SELECT p.id FROM podcasts p JOIN books b ON b.id=p.book_id
      WHERE p.status='synthesizing' AND p.script_text IS NOT NULL AND p.tts_next_retry_at <= now() AND p.tts_retry_count < $1 AND b.status='active'
      ORDER BY p.tts_next_retry_at LIMIT $2 FOR UPDATE SKIP LOCKED)
    UPDATE podcasts p SET tts_next_retry_at=now() + interval '15 minutes',updated_at=now()
    FROM candidate c WHERE p.id=c.id RETURNING p.*`, [MAX_TTS_RECOVERY_ATTEMPTS, Math.max(1, Math.min(5, batchSize))]);
  for (const episode of due.rows) {
    let audioPath: string | undefined;
    try {
      const book = (await query<any>("SELECT b.title AS book_title,b.author,COALESCE(u.display_name,u.username) AS user_name FROM books b JOIN users u ON u.id=b.owner_id WHERE b.id=$1", [episode.book_id])).rows[0];
      const audio = await synthesizePodcast(episode.script_text, episode.voice_model); audioPath = audio.filePath;
      await finishSynthesizedPodcast({ ...episode, ...book }, audio.filePath, audio.durationS); audioPath = undefined;
    } catch (error: any) {
      const deferred = await deferRetryableTts(episode.id, error);
      if (!deferred) await query("UPDATE podcasts SET status='failed',tts_next_retry_at=NULL,error_message=$2,updated_at=now() WHERE id=$1", [episode.id, isRetryableTtsError(error) ? "TTS upstream remained unavailable. Try again later." : String(error.message || error).slice(0, 1000)]);
      console.warn(`[podcast] TTS-only recovery failed for ${episode.id}:`, error.message);
    } finally { if (audioPath) await fs.unlink(audioPath).catch(() => undefined); }
  }
}

export async function generatePodcast(id: string): Promise<void> {
  // Claim and transition in one statement. A paused book, a duplicate worker, or
  // any episode no longer queued produces no row and therefore no side effects.
  const current = (await query<any>(`UPDATE podcasts p SET status='scripting',error_message=NULL,updated_at=now()
    FROM books b, users u
    WHERE p.id=$1 AND p.status='queued' AND b.id=p.book_id AND b.status='active' AND u.id=p.user_id
    RETURNING p.*,b.title AS book_title,b.author,b.summary_lang,COALESCE(u.display_name, u.username) AS user_name`, [id])).rows[0] as PodcastRow & any;
  if (!current) return;
  let audioPath: string | undefined;
  try {
    logPodcastArchiveConfig(config.podcastTelegramArchiveChatId);
    await verifyPodcastArchive(config.podcastTelegramArchiveChatId);
    const units = await query<any>("SELECT raw_text FROM book_reading_units WHERE book_id=$1 AND chapter_key=$2 ORDER BY unit_index", [current.book_id, current.chapter_key]);
    const chapterText = units.rows.map((row) => row.raw_text).join("\n\n"); if (!chapterText) throw new Error("No raw EPUB text exists for this chapter");
    if (isPodcastSourceTooBrief(chapterText)) {
      await markPodcastUnavailable(current.user_id, current.book_id, current.reading_round, current.chapter_key, current.chapter_title, current.language, current.voice_model, podcastWordCount(chapterText));
      return;
    }
    const minimumWords = podcastMinimumWords(chapterText);
    const prompt = podcastPrompt({ title: current.book_title, author: current.author, chapterTitle: current.chapter_title, language: current.language, chapterText, minimumWords });
    let script = await callLLM(prompt.system, prompt.user, 0.75, true, false, 300000, { priority: "background", traceLabel: "podcast-script", model: config.podcastLlmModel || undefined });
    if (validatePodcastScript(script, minimumWords)) script = await callLLM(prompt.system, `${prompt.user}\n\nReturn plain spoken prose only. No Markdown, headings, or lists.`, 0.65, true, false, 300000, { priority: "background", traceLabel: "podcast-script-retry", model: config.podcastLlmModel || undefined });
    const invalid = validatePodcastScript(script, minimumWords); if (invalid) throw new Error(`Podcast script invalid: ${invalid}`);
    await query("UPDATE podcasts SET status='synthesizing',script_text=$2,word_count=$3,tts_retry_count=0,tts_next_retry_at=NULL,updated_at=now() WHERE id=$1", [id, script, script.split(/\s+/).length]);
    const audio = await synthesizePodcast(script, current.voice_model); audioPath = audio.filePath;
    await finishSynthesizedPodcast(current, audio.filePath, audio.durationS); audioPath = undefined;
  } catch (error: any) {
    const deferred = await deferRetryableTts(id, error).catch(() => false);
    if (!deferred) await query("UPDATE podcasts SET status='failed',tts_next_retry_at=NULL,error_message=$2,updated_at=now() WHERE id=$1", [id, isRetryableTtsError(error) ? "TTS upstream remained unavailable. Try again later." : String(error.message || error).slice(0, 1000)]).catch(() => undefined);
    throw error;
  }
  finally { if (audioPath) await fs.unlink(audioPath).catch(() => undefined); }
}

export async function recoverQueuedPodcastJobs(batchSize = 10): Promise<void> {
  const limit = Math.max(1, Math.min(50, Math.floor(batchSize)));
  // Recover abandoned in-flight work in a bounded batch. Paused books remain
  // untouched; they can be recovered after the book is resumed.
  await query(`WITH stale AS (
      SELECT p.id FROM podcasts p JOIN books b ON b.id=p.book_id
      WHERE b.status='active' AND p.status IN ('scripting','synthesizing','archiving')
        AND p.updated_at < now() - interval '30 minutes'
      ORDER BY p.updated_at LIMIT $1
    )
    UPDATE podcasts p SET status='queued',error_message=NULL,updated_at=now()
    FROM stale WHERE p.id=stale.id`, [limit]);
  const queued = await query<{ id: string }>(`SELECT p.id FROM podcasts p JOIN books b ON b.id=p.book_id
    WHERE p.status='queued' AND b.status='active' ORDER BY p.updated_at LIMIT $1`, [limit]);
  for (const episode of queued.rows) {
    try { await generatePodcast(episode.id); }
    catch (error: any) { console.warn(`[podcast] queued recovery failed for ${episode.id}:`, error.message); }
  }
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
