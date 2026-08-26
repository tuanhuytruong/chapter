import { Router, type Request, type Response } from "express";
import { bestEffortTouchLastActive } from "../userLifecycleTracking.js";
import { createReadStream } from "fs";
import { mkdir, rename, stat, unlink, writeFile } from "fs/promises";
import { query, withClient, withTransaction } from "../db.js";
import { userFrom } from "../auth.js";
import { buildEpubReadingUnits } from "../extractor.js";
import { createPodcast, podcastPublic, prunePodcastCache, recoverQueuedPodcastJobs, regeneratePodcast, retryPendingPodcastArchives } from "../podcast/generate.js";
import { downloadArchivedPodcast } from "../podcast/telegram.js";
import { observeEntitledGeneration } from "../requireEntitlement.js";
import { config } from "../config.js";

export const podcastsRouter = Router();
podcastsRouter.use((req, res, next) => {
  const meaningful = (req.method === "POST" && (req.path === "/" || /\/regenerate$/.test(req.path))) ||
    (req.method === "PUT" && /\/playlist\/progress$/.test(req.path));
  if (meaningful) {
    const ownerId = userFrom(req).id;
    res.once("finish", () => { if (res.statusCode >= 200 && res.statusCode < 300) bestEffortTouchLastActive(ownerId); });
  }
  next();
});

type CatalogBook = { id: string; title: string; author: string | null; cover_url: string | null; summary_lang: string | null; reading_round: number };

async function ensureChapterUnits(book: CatalogBook): Promise<void> {
  const count = await query<{ count: number }>("SELECT count(*)::int AS count FROM book_reading_units WHERE book_id=$1", [book.id]);
  const needsIndex = !count.rows[0]?.count || !(await query("SELECT 1 FROM book_reading_units WHERE book_id=$1 AND chapter_key IS NOT NULL LIMIT 1", [book.id])).rows.length;
  if (!needsIndex) return;
  const units = await buildEpubReadingUnits(book.id ? (await query<{ file_path: string }>("SELECT file_path FROM books WHERE id=$1", [book.id])).rows[0].file_path : "");
  if (!units.length) throw new Error(`Could not index ${book.title}`);
  await withTransaction(async (client) => {
    await client.query("DELETE FROM book_reading_units WHERE book_id=$1", [book.id]);
    const batchSize = 250;
    for (let offset = 0; offset < units.length; offset += batchSize) {
      const batch = units.slice(offset, offset + batchSize);
      const values: unknown[] = [];
      const placeholders = batch.map((unit, index) => {
        const base = index * 8;
        values.push(book.id, unit.unitIndex, unit.title, unit.spineIndex, unit.chapterKey, unit.rawText, unit.rawText.length, unit.pageLabel ?? null);
        return `(${Array.from({ length: 8 }, (_, field) => `$${base + field + 1}`).join(",")})`;
      });
      await client.query(
        `INSERT INTO book_reading_units (book_id,unit_index,title,spine_index,chapter_key,raw_text,char_count,page_label) VALUES ${placeholders.join(",")}`,
        values,
      );
    }
    await client.query("UPDATE books SET total_pages=$1 WHERE id=$2", [units.length, book.id]);
  });
}

async function owned(id: string, userId: string) { return (await query<any>("SELECT p.* FROM podcasts p WHERE p.id=$1 AND p.user_id=$2", [id, userId])).rows[0]; }

async function requireActivePodcastBook(bookId: string, userId: string): Promise<void> {
  const book = (await query<{ status: string }>("SELECT status FROM books WHERE id=$1 AND owner_id=$2", [bookId, userId])).rows[0];
  if (!book) { const error: any = new Error("Podcast book not found"); error.code = "BOOK_NOT_FOUND"; throw error; }
  if (book.status !== "active") { const error: any = new Error("Resume this book before creating podcast episodes"); error.code = "BOOK_NOT_ACTIVE"; throw error; }
}

// Chapter-first catalog: no reading_log is consulted or returned.
podcastsRouter.get("/catalog", async (req: Request, res: Response) => {
  try {
    const ownerId = userFrom(req).id;
    const { rows: books } = await query<CatalogBook>("SELECT id,title,author,cover_url,summary_lang,reading_round FROM books WHERE owner_id=$1 AND file_type='epub' ORDER BY created_at DESC", [ownerId]);
    for (const book of books) await ensureChapterUnits(book);
    const result = [] as any[];
    const bookIds = books.map((book) => book.id);
    const [units, episodes, narrators] = bookIds.length ? await Promise.all([
      query<any>(`SELECT book_id, chapter_key, min(title) AS chapter_title, min(unit_index)::int AS start_unit, max(unit_index)::int AS end_unit, min(page_label) AS start_page, max(page_label) AS end_page, sum(char_count)::int AS char_count
        FROM book_reading_units WHERE book_id = ANY($1) AND chapter_key IS NOT NULL AND title IS NOT NULL AND title <> '' GROUP BY book_id, chapter_key ORDER BY book_id, min(unit_index)`, [bookIds]),
      query<any>("SELECT * FROM podcasts WHERE user_id=$1 AND book_id = ANY($2)", [ownerId, bookIds]),
      query<any>("SELECT book_id,reading_round,voice_gender FROM podcast_narrators WHERE book_id = ANY($1)", [bookIds]),
    ]) : [{ rows: [] }, { rows: [] }, { rows: [] }];
    const unitsByBook = new Map<string, any[]>();
    for (const unit of units.rows) {
      const rows = unitsByBook.get(unit.book_id) || [];
      rows.push(unit);
      unitsByBook.set(unit.book_id, rows);
    }
    const episodesByBookChapter = new Map(episodes.rows.map((episode) => [`${episode.book_id}\0${episode.reading_round}\0${episode.chapter_key}`, podcastPublic(episode)]));
    const narratorByBookRound = new Map(narrators.rows.map((narrator) => [`${narrator.book_id}\0${narrator.reading_round}`, narrator.voice_gender]));
    for (const book of books) {
      const round = book.reading_round || 1;
      const chapters = (unitsByBook.get(book.id) || []).map(({ book_id: _bookId, ...unit }, index) => ({
        ...unit,
        chapter_number: index + 1,
        episode: episodesByBookChapter.get(`${book.id}\0${round}\0${unit.chapter_key}`) || null,
      }));
      result.push({ ...book, narrator_gender: narratorByBookRound.get(`${book.id}\0${round}`) || null, chapters });
    }
    res.json(result);
  } catch (error: any) { console.warn("[podcast] catalog failed:", error.message); res.status(500).json({ error: "Podcast catalog unavailable" }); }
});

// Shared Book Detail read: only safe, persisted episode metadata is exposed.
podcastsRouter.get("/books/:bookId", async (req: Request, res: Response) => {
  try {
    const { rows } = await query<CatalogBook>("SELECT id,title,author,cover_url,summary_lang,reading_round FROM books WHERE id=$1 AND file_type='epub'", [req.params.bookId]);
    const book = rows[0];
    if (!book) return res.status(404).json({ error: "Podcast book not found" });
    await ensureChapterUnits(book);
    const [units, episodes, narrator] = await Promise.all([
      query<any>(`SELECT chapter_key, min(title) AS chapter_title, min(unit_index)::int AS start_unit, max(unit_index)::int AS end_unit, min(page_label) AS start_page, max(page_label) AS end_page, sum(char_count)::int AS char_count
        FROM book_reading_units WHERE book_id=$1 AND chapter_key IS NOT NULL AND title IS NOT NULL AND title <> '' GROUP BY chapter_key ORDER BY min(unit_index)`, [book.id]),
      query<any>("SELECT * FROM podcasts WHERE book_id=$1 AND reading_round=$2", [book.id, book.reading_round || 1]),
      query<any>("SELECT voice_gender FROM podcast_narrators WHERE book_id=$1 AND reading_round=$2", [book.id, book.reading_round || 1]),
    ]);
    const byChapter = new Map(episodes.rows.map((episode) => [episode.chapter_key, podcastPublic(episode)]));
    res.json({ ...book, narrator_gender: narrator.rows[0]?.voice_gender || null, chapters: units.rows.map((unit, index) => ({ ...unit, chapter_number: index + 1, episode: byChapter.get(unit.chapter_key) || null })) });
  } catch (error: any) { console.warn("[podcast] book read failed:", error.message); res.status(500).json({ error: "Podcast episodes unavailable" }); }
});

// Owner-scoped queue and resume marker. The queue deliberately contains only
// ready episodes, sorted by chapter order; no chapter is generated implicitly.
// `next_chapter` exposes the first chapter (by unit order) that has no playable
// episode yet, so the player can offer an explicit "Generate & play next" CTA.
podcastsRouter.get("/books/:bookId/playlist", async (req: Request, res: Response) => {
  try {
    const userId = userFrom(req).id;
    const { rows: books } = await query<CatalogBook>(
      "SELECT id,title,author,cover_url,summary_lang,reading_round FROM books WHERE id=$1 AND owner_id=$2 AND file_type='epub'",
      [req.params.bookId, userId],
    );
    const book = books[0];
    if (!book) return res.status(404).json({ error: "Podcast playlist unavailable" });
    await ensureChapterUnits(book);
    const round = book.reading_round || 1;
    const [episodes, progress, chapters, narrator] = await Promise.all([
      query<any>(`SELECT p.id, p.book_id, p.reading_round, p.chapter_key, p.chapter_title, p.language, p.status, p.word_count, p.duration_s, p.created_at, min(u.unit_index)::int AS chapter_order
        FROM podcasts p JOIN book_reading_units u ON u.book_id=p.book_id AND u.chapter_key=p.chapter_key AND u.title IS NOT NULL AND u.title <> ''
        WHERE p.user_id=$1 AND p.book_id=$2 AND p.reading_round=$3 AND p.status IN ('ready','archive_pending')
        GROUP BY p.id, p.book_id, p.reading_round, p.chapter_key, p.chapter_title, p.language, p.status, p.word_count, p.duration_s, p.created_at ORDER BY min(u.unit_index), p.created_at`, [userId, book.id, round]),
      query<any>("SELECT podcast_id,current_time_seconds,completed_at,updated_at FROM podcast_playback_progress WHERE user_id=$1 AND book_id=$2 AND reading_round=$3", [userId, book.id, round]),
      query<any>(`SELECT chapter_key, min(title) AS chapter_title, min(unit_index)::int AS start_unit, max(unit_index)::int AS end_unit, min(page_label) AS start_page, max(page_label) AS end_page
        FROM book_reading_units WHERE book_id=$1 AND chapter_key IS NOT NULL AND title IS NOT NULL AND title <> '' GROUP BY chapter_key ORDER BY min(unit_index)`, [book.id]),
      query<any>("SELECT voice_gender FROM podcast_narrators WHERE book_id=$1 AND reading_round=$2 LIMIT 1", [book.id, round]),
    ]);
    const readyByChapter = new Set(episodes.rows.map((episode) => episode.chapter_key));
    const allStatus = await query<any>("SELECT chapter_key, status FROM podcasts WHERE user_id=$1 AND book_id=$2 AND reading_round=$3", [userId, book.id, round]);
    const statusByChapter = new Map(allStatus.rows.map((episode) => [episode.chapter_key, episode.status]));
    const chapterRows = chapters.rows.map((chapter, index) => ({ ...chapter, chapter_number: index + 1 }));
    const chapterByKey = new Map(chapterRows.map((chapter) => [chapter.chapter_key, chapter]));
    const next = chapterRows.find((chapter) => !readyByChapter.has(chapter.chapter_key) && statusByChapter.get(chapter.chapter_key) !== "unavailable") || null;
    res.json({
      book_id: book.id,
      reading_round: round,
      episodes: episodes.rows.map((episode) => {
        const chapter = chapterByKey.get(episode.chapter_key);
        return { ...podcastPublic(episode), chapter_key: episode.chapter_key, chapter_number: chapter?.chapter_number ?? null, chapter_title: chapter?.chapter_title || episode.chapter_title || null };
      }),
      progress: progress.rows[0] || null,
      next_chapter: next ? { ...next, has_narrator: !!narrator.rows[0], episode_status: statusByChapter.get(next.chapter_key) || null } : null,
    });
  } catch (error: any) { console.warn("[podcast] playlist read failed:", error.message); res.status(500).json({ error: "Podcast playlist unavailable" }); }
});

podcastsRouter.put("/books/:bookId/playlist/progress", async (req: Request, res: Response) => {
  const { podcast_id, current_time_seconds, completed } = req.body || {};
  if (typeof podcast_id !== "string" || !Number.isFinite(current_time_seconds) || current_time_seconds < 0 || typeof completed !== "boolean") {
    return res.status(400).json({ error: "podcast_id, current_time_seconds, and completed are required" });
  }
  try {
    const userId = userFrom(req).id;
    const { rows } = await query<{ reading_round: number; status: string }>("SELECT reading_round FROM books WHERE id=$1 AND owner_id=$2 AND file_type='epub'", [req.params.bookId, userId]);
    const book = rows[0];
    if (!book) return res.status(404).json({ error: "Podcast playlist unavailable" });
    const episode = await owned(podcast_id, userId);
    if (!episode || episode.book_id !== req.params.bookId || episode.reading_round !== book.reading_round) return res.status(404).json({ error: "Podcast episode unavailable" });
    if (episode.status !== "ready" && episode.status !== "archive_pending") {
      return res.status(409).json({ error: "Only a playable podcast episode can be saved to the playlist" });
    }
    const { rows: saved } = await query<any>(`INSERT INTO podcast_playback_progress (user_id,book_id,reading_round,podcast_id,current_time_seconds,completed_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,CASE WHEN $6 THEN now() ELSE NULL END,now())
      ON CONFLICT (user_id,book_id,reading_round) DO UPDATE SET podcast_id=EXCLUDED.podcast_id,current_time_seconds=EXCLUDED.current_time_seconds,completed_at=EXCLUDED.completed_at,updated_at=now()
      RETURNING podcast_id,current_time_seconds,completed_at,updated_at`, [userId, req.params.bookId, book.reading_round, podcast_id, current_time_seconds, completed]);
    // Listening-rhythm event: one row per (user, episode, day) so listen days
    // and streaks are derivable without chunk alignment. Recorded only once an
    // episode counts as "listened" (completed, or at least 60s heard).
    if (completed === true || current_time_seconds >= 60) {
      // Asia/Bangkok day (no DST) so listen days align with reading logs.
      const listenedOn = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
      await query<any>(
        `INSERT INTO podcast_listen_events
           (user_id, book_id, podcast_id, chapter_key, reading_round, listened_on, seconds_heard, completed, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
         ON CONFLICT (user_id, podcast_id, listened_on) DO UPDATE SET
           seconds_heard = GREATEST(podcast_listen_events.seconds_heard, EXCLUDED.seconds_heard),
           completed     = podcast_listen_events.completed OR EXCLUDED.completed,
           updated_at    = now()`,
        [userId, req.params.bookId, episode.id, episode.chapter_key, episode.reading_round, listenedOn, current_time_seconds, completed],
      );
    }
    res.json(saved[0]);
  } catch (error: any) { console.warn("[podcast] playlist progress failed:", error.message); res.status(500).json({ error: "Podcast progress unavailable" }); }
});

podcastsRouter.post("/", async (req: Request, res: Response) => {
  const { book_id, chapter_key, voice_gender } = req.body || {};
  if (typeof book_id !== "string" || typeof chapter_key !== "string" || (voice_gender && voice_gender !== "female" && voice_gender !== "male")) {
    return res.status(400).json({ error: "book_id, chapter_key, and an optional valid voice_gender are required" });
  }
  try {
    const ownerId = userFrom(req).id;
    await requireActivePodcastBook(book_id, ownerId);
    await observeEntitledGeneration(ownerId, "podcast_chapter_generation");
    res.status(202).json(await createPodcast(ownerId, book_id, chapter_key, voice_gender));
  }
  catch (error: any) { res.status(error.code === "VOICE_REQUIRED" || error.code === "BOOK_NOT_ACTIVE" ? 409 : 400).json({ error: error.message }); }
});

// Change the narrator voice for a reading round. When the round already has
// episodes, the client must confirm with force=true; that deletes the round's
// episodes and playback progress so everything is re-generated with the new
// voice. Listen events are kept (podcast_id is set NULL by the FK) so already
// earned listening streak days are not lost.
podcastsRouter.post("/books/:bookId/narrator", async (req: Request, res: Response) => {
  const { voice_gender, force } = req.body || {};
  if (voice_gender !== "female" && voice_gender !== "male") {
    return res.status(400).json({ error: "voice_gender must be 'female' or 'male'" });
  }
  try {
    const userId = userFrom(req).id;
    const { rows: books } = await query<{ reading_round: number; status: string }>(
      "SELECT reading_round, status FROM books WHERE id=$1 AND owner_id=$2 AND file_type='epub'",
      [req.params.bookId, userId],
    );
    const book = books[0];
    if (!book) return res.status(404).json({ error: "Podcast book not found" });
    if (book.status !== "active") return res.status(409).json({ error: "Resume this book before changing its podcast narrator" });
    const round = book.reading_round || 1;
    const { rows: existing } = await query<{ id: string }>(
      `SELECT id FROM podcasts WHERE user_id=$1 AND book_id=$2 AND reading_round=$3
        AND status IN ('ready','archive_pending','queued','scripting','synthesizing')`,
      [userId, req.params.bookId, round],
    );
    const count = existing.length;
    if (count > 0 && force !== true) {
      return res.status(409).json({
        error: `Changing the narrator will delete ${count} podcast${count === 1 ? "" : "s"} of this round`,
        episodes: count,
        force_required: true,
      });
    }
    await withTransaction(async (client) => {
      if (count > 0) {
        await client.query(
          "DELETE FROM podcast_playback_progress WHERE user_id=$1 AND book_id=$2 AND reading_round=$3",
          [userId, req.params.bookId, round],
        );
        await client.query(
          "DELETE FROM podcasts WHERE user_id=$1 AND book_id=$2 AND reading_round=$3",
          [userId, req.params.bookId, round],
        );
      }
      await client.query(
        `INSERT INTO podcast_narrators (book_id, reading_round, voice_gender) VALUES ($1,$2,$3)
         ON CONFLICT (book_id, reading_round) DO UPDATE SET voice_gender=EXCLUDED.voice_gender`,
        [req.params.bookId, round, voice_gender],
      );
    });
    res.json({ ok: true, episodes_deleted: count, reading_round: round, voice_gender });
  } catch (error: any) { console.warn("[podcast] narrator change failed:", error.message); res.status(500).json({ error: "Narrator could not be updated" }); }
});

podcastsRouter.post("/:id/regenerate", async (req: Request, res: Response) => {
  try {
    const ownerId = userFrom(req).id;
    const episode = await owned(req.params.id, ownerId);
    if (!episode) return res.status(404).json({ error: "Podcast episode unavailable" });
    await requireActivePodcastBook(episode.book_id, ownerId);
    await observeEntitledGeneration(ownerId, "podcast_chapter_generation");
    res.status(202).json(await regeneratePodcast(ownerId, req.params.id));
  } catch (error: any) { res.status(error.code === "BOOK_NOT_ACTIVE" ? 409 : 404).json({ error: error.message || "Podcast episode unavailable" }); }
});

function parseAudioRange(range: string | undefined, size: number): { start: number; end: number; partial: boolean } | null {
  if (size <= 0) return range ? null : { start: 0, end: -1, partial: false };
  if (!range) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return null;
  let start: number;
  let end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return null;
  }
  return start >= size || start > end ? null : { start, end, partial: true };
}

const archiveHydrations = new Map<string, Promise<string>>();
const cacheExpiresAt = () => new Date(Date.now() + Math.max(1, config.podcastCacheTtlHours) * 3600000);

async function hydrateArchivedPodcast(episode: any): Promise<string> {
  const existing = archiveHydrations.get(episode.id);
  if (existing) return existing;
  const task = (async () => {
    await mkdir(config.podcastCacheDir, { recursive: true });
    const finalPath = `${config.podcastCacheDir}/${episode.id}.mp3`;
    const temporaryPath = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
    try {
      const data = await downloadArchivedPodcast(episode.tg_file_id);
      await writeFile(temporaryPath, data, { flag: "wx" });
      await rename(temporaryPath, finalPath);
      await query("UPDATE podcasts SET local_cache_path=$2,local_cache_until=$3,updated_at=now() WHERE id=$1", [episode.id, finalPath, cacheExpiresAt()]);
      return finalPath;
    } finally { await unlink(temporaryPath).catch(() => undefined); }
  })();
  archiveHydrations.set(episode.id, task);
  try { return await task; } finally { archiveHydrations.delete(episode.id); }
}

async function streamLocalAudio(res: Response, filePath: string, rangeHeader: string | undefined): Promise<void> {
  const size = (await stat(filePath)).size;
  const parsed = parseAudioRange(rangeHeader, size);
  if (!parsed) { res.status(416).setHeader("Content-Range", `bytes */${size}`).end(); return; }
  const { start, end, partial } = parsed;
  res.status(partial ? 206 : 200).setHeader("Content-Length", end - start + 1);
  if (partial) res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
  if (size === 0) { res.end(); return; }
  createReadStream(filePath, { start, end }).on("error", () => res.destroy()).pipe(res);
}

podcastsRouter.get("/:id/audio", async (req: Request, res: Response) => {
  try {
    const episode = (await query<any>(
      "SELECT p.* FROM podcasts p JOIN books b ON b.id=p.book_id WHERE p.id=$1",
      [req.params.id]
    )).rows[0];
    const locallyPlayable = episode?.local_cache_path && episode?.local_cache_until && new Date(episode.local_cache_until) > new Date();
    if (!episode || (episode.status !== "ready" && episode.status !== "archive_pending") || (!locallyPlayable && !episode.tg_file_id)) return res.status(404).end();
    const rangeHeader = req.header("range");
    res.setHeader("Accept-Ranges", "bytes"); res.setHeader("Content-Type", "audio/mpeg"); res.setHeader("Cache-Control", "private, no-store");
    if (locallyPlayable) {
      try { await streamLocalAudio(res, episode.local_cache_path, rangeHeader); return; }
      catch { if (!episode.tg_file_id) return res.status(503).json({ error: "Podcast audio is temporarily unavailable" }); }
    }
    // Telegram fallback is hydrated once into the protected local cache. Every
    // later request (including Android's Range probes) gets the fast streamed
    // local path instead of repeatedly buffering a remote archive download.
    const cachePath = await hydrateArchivedPodcast(episode);
    await streamLocalAudio(res, cachePath, rangeHeader);
  } catch { res.status(502).json({ error: "Podcast audio is temporarily unavailable" }); }
});

let timer: ReturnType<typeof setInterval> | undefined;
let maintenanceRunning = false;
const PODCAST_MAINTENANCE_LOCK = 0x504f4443;

export async function runPodcastMaintenance(): Promise<void> {
  if (maintenanceRunning) return;
  maintenanceRunning = true;
  try {
    await withClient(async (client) => {
      const locked = (await client.query(
        "SELECT pg_try_advisory_lock($1) AS locked",
        [PODCAST_MAINTENANCE_LOCK],
      )).rows[0]?.locked === true;
      if (!locked) return;
      try {
        await recoverQueuedPodcastJobs();
        await prunePodcastCache();
        await retryPendingPodcastArchives();
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [PODCAST_MAINTENANCE_LOCK]);
      }
    });
  } finally {
    maintenanceRunning = false;
  }
}

export function startPodcastMaintenance() {
  if (timer) return;
  void runPodcastMaintenance().catch((error) => console.warn("[podcast] maintenance failed:", error.message));
  timer = setInterval(() => void runPodcastMaintenance().catch((error) => console.warn("[podcast] maintenance failed:", error.message)), 60 * 60 * 1000);
  timer.unref();
}
