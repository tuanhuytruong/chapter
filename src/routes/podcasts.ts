import { Router, type Request, type Response } from "express";
import fs from "fs/promises";
import { query, withTransaction } from "../db.js";
import { userFrom } from "../auth.js";
import { buildEpubReadingUnits } from "../extractor.js";
import { createPodcast, podcastPublic, prunePodcastCache, regeneratePodcast, retryPendingPodcastArchives } from "../podcast/generate.js";
import { downloadArchivedPodcast } from "../podcast/telegram.js";
import { observeEntitledGeneration } from "../requireEntitlement.js";

export const podcastsRouter = Router();

type CatalogBook = { id: string; title: string; author: string | null; cover_url: string | null; summary_lang: string | null; reading_round: number };

async function ensureChapterUnits(book: CatalogBook): Promise<void> {
  const count = await query<{ count: number }>("SELECT count(*)::int AS count FROM book_reading_units WHERE book_id=$1", [book.id]);
  const needsIndex = !count.rows[0]?.count || !(await query("SELECT 1 FROM book_reading_units WHERE book_id=$1 AND chapter_key IS NOT NULL LIMIT 1", [book.id])).rows.length;
  if (!needsIndex) return;
  const units = await buildEpubReadingUnits(book.id ? (await query<{ file_path: string }>("SELECT file_path FROM books WHERE id=$1", [book.id])).rows[0].file_path : "");
  if (!units.length) throw new Error(`Could not index ${book.title}`);
  await withTransaction(async (client) => {
    await client.query("DELETE FROM book_reading_units WHERE book_id=$1", [book.id]);
    for (const unit of units) await client.query(
      `INSERT INTO book_reading_units (book_id,unit_index,title,spine_index,chapter_key,raw_text,char_count) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [book.id, unit.unitIndex, unit.title, unit.spineIndex, unit.chapterKey, unit.rawText, unit.rawText.length]
    );
    await client.query("UPDATE books SET total_pages=$1 WHERE id=$2", [units.length, book.id]);
  });
}

async function owned(id: string, userId: string) { return (await query<any>("SELECT p.* FROM podcasts p WHERE p.id=$1 AND p.user_id=$2", [id, userId])).rows[0]; }

// Chapter-first catalog: no reading_log is consulted or returned.
podcastsRouter.get("/catalog", async (req: Request, res: Response) => {
  try {
    const ownerId = userFrom(req).id;
    const { rows: books } = await query<CatalogBook>("SELECT id,title,author,cover_url,summary_lang,reading_round FROM books WHERE owner_id=$1 AND file_type='epub' ORDER BY created_at DESC", [ownerId]);
    for (const book of books) await ensureChapterUnits(book);
    const result = [] as any[];
    for (const book of books) {
      const [units, episodes, narrator] = await Promise.all([
        query<any>(`SELECT chapter_key, min(title) AS chapter_title, min(unit_index)::int AS start_unit, max(unit_index)::int AS end_unit, min(page_label) AS start_page, max(page_label) AS end_page, sum(char_count)::int AS char_count
          FROM book_reading_units WHERE book_id=$1 AND chapter_key IS NOT NULL GROUP BY chapter_key ORDER BY min(unit_index)`, [book.id]),
        query<any>("SELECT * FROM podcasts WHERE user_id=$1 AND book_id=$2 AND reading_round=$3", [ownerId, book.id, book.reading_round || 1]),
        query<any>("SELECT voice_gender FROM podcast_narrators WHERE book_id=$1 AND reading_round=$2", [book.id, book.reading_round || 1]),
      ]);
      const byChapter = new Map(episodes.rows.map((episode) => [episode.chapter_key, podcastPublic(episode)]));
      result.push({ ...book, narrator_gender: narrator.rows[0]?.voice_gender || null, chapters: units.rows.map((unit) => ({ ...unit, episode: byChapter.get(unit.chapter_key) || null })) });
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
        FROM book_reading_units WHERE book_id=$1 AND chapter_key IS NOT NULL GROUP BY chapter_key ORDER BY min(unit_index)`, [book.id]),
      query<any>("SELECT * FROM podcasts WHERE book_id=$1 AND reading_round=$2", [book.id, book.reading_round || 1]),
      query<any>("SELECT voice_gender FROM podcast_narrators WHERE book_id=$1 AND reading_round=$2", [book.id, book.reading_round || 1]),
    ]);
    const byChapter = new Map(episodes.rows.map((episode) => [episode.chapter_key, podcastPublic(episode)]));
    res.json({ ...book, narrator_gender: narrator.rows[0]?.voice_gender || null, chapters: units.rows.map((unit) => ({ ...unit, episode: byChapter.get(unit.chapter_key) || null })) });
  } catch (error: any) { console.warn("[podcast] book read failed:", error.message); res.status(500).json({ error: "Podcast episodes unavailable" }); }
});

// Owner-scoped queue and resume marker. The queue deliberately contains only
// ready episodes, sorted by chapter order; no chapter is generated implicitly.
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
    const [episodes, progress] = await Promise.all([
      query<any>(`SELECT p.*, min(u.unit_index)::int AS chapter_order
        FROM podcasts p JOIN book_reading_units u ON u.book_id=p.book_id AND u.chapter_key=p.chapter_key
        WHERE p.user_id=$1 AND p.book_id=$2 AND p.reading_round=$3 AND p.status IN ('ready','archive_pending')
        GROUP BY p.id ORDER BY min(u.unit_index), p.created_at`, [userId, book.id, round]),
      query<any>("SELECT podcast_id,current_time_seconds,completed_at,updated_at FROM podcast_playback_progress WHERE user_id=$1 AND book_id=$2 AND reading_round=$3", [userId, book.id, round]),
    ]);
    res.json({ book_id: book.id, reading_round: round, episodes: episodes.rows.map(podcastPublic), progress: progress.rows[0] || null });
  } catch (error: any) { console.warn("[podcast] playlist read failed:", error.message); res.status(500).json({ error: "Podcast playlist unavailable" }); }
});

podcastsRouter.put("/books/:bookId/playlist/progress", async (req: Request, res: Response) => {
  const { podcast_id, current_time_seconds, completed } = req.body || {};
  if (typeof podcast_id !== "string" || !Number.isFinite(current_time_seconds) || current_time_seconds < 0 || typeof completed !== "boolean") {
    return res.status(400).json({ error: "podcast_id, current_time_seconds, and completed are required" });
  }
  try {
    const userId = userFrom(req).id;
    const { rows } = await query<{ reading_round: number }>("SELECT reading_round FROM books WHERE id=$1 AND owner_id=$2 AND file_type='epub'", [req.params.bookId, userId]);
    const book = rows[0];
    if (!book) return res.status(404).json({ error: "Podcast playlist unavailable" });
    const episode = await owned(podcast_id, userId);
    if (!episode || episode.book_id !== req.params.bookId || episode.reading_round !== book.reading_round) return res.status(404).json({ error: "Podcast episode unavailable" });
    const { rows: saved } = await query<any>(`INSERT INTO podcast_playback_progress (user_id,book_id,reading_round,podcast_id,current_time_seconds,completed_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,CASE WHEN $6 THEN now() ELSE NULL END,now())
      ON CONFLICT (user_id,book_id,reading_round) DO UPDATE SET podcast_id=EXCLUDED.podcast_id,current_time_seconds=EXCLUDED.current_time_seconds,completed_at=EXCLUDED.completed_at,updated_at=now()
      RETURNING podcast_id,current_time_seconds,completed_at,updated_at`, [userId, req.params.bookId, book.reading_round, podcast_id, current_time_seconds, completed]);
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
    await observeEntitledGeneration(ownerId, "podcast_chapter_generation");
    res.status(202).json(await createPodcast(ownerId, book_id, chapter_key, voice_gender));
  }
  catch (error: any) { res.status(error.code === "VOICE_REQUIRED" ? 409 : 400).json({ error: error.message }); }
});

podcastsRouter.post("/:id/regenerate", async (req: Request, res: Response) => {
  try {
    const ownerId = userFrom(req).id;
    await observeEntitledGeneration(ownerId, "podcast_chapter_generation");
    res.status(202).json(await regeneratePodcast(ownerId, req.params.id));
  } catch (error: any) { res.status(404).json({ error: "Podcast episode unavailable" }); }
});

podcastsRouter.get("/:id/audio", async (req: Request, res: Response) => {
  try {
    const episode = (await query<any>(
      "SELECT p.* FROM podcasts p JOIN books b ON b.id=p.book_id WHERE p.id=$1",
      [req.params.id]
    )).rows[0];
    const locallyPlayable = episode?.local_cache_path && episode?.local_cache_until && new Date(episode.local_cache_until) > new Date();
    if (!episode || (episode.status !== "ready" && episode.status !== "archive_pending") || (!locallyPlayable && !episode.tg_file_id)) return res.status(404).end();
    let data: Buffer;
    try { data = locallyPlayable ? await fs.readFile(episode.local_cache_path) : await downloadArchivedPodcast(episode.tg_file_id); }
    catch {
      if (!episode.tg_file_id) return res.status(503).json({ error: "Podcast audio is temporarily unavailable" });
      data = await downloadArchivedPodcast(episode.tg_file_id);
    }
    const range = req.header("range"); res.setHeader("Accept-Ranges", "bytes"); res.setHeader("Content-Type", "audio/mpeg"); res.setHeader("Cache-Control", "private, no-store");
    if (!range) { res.setHeader("Content-Length", data.length); return res.status(200).end(data); }
    const match = /^bytes=(\d*)-(\d*)$/.exec(range); if (!match) return res.status(416).end();
    const start = match[1] ? Number(match[1]) : 0; const end = match[2] ? Math.min(Number(match[2]), data.length - 1) : data.length - 1;
    if (start > end || start >= data.length) return res.status(416).setHeader("Content-Range", `bytes */${data.length}`).end();
    res.status(206).setHeader("Content-Range", `bytes ${start}-${end}/${data.length}`).setHeader("Content-Length", end - start + 1).end(data.subarray(start, end + 1));
  } catch { res.status(502).json({ error: "Podcast audio is temporarily unavailable" }); }
});

let timer: ReturnType<typeof setInterval> | undefined;
export function startPodcastMaintenance() {
  if (timer) return;
  const maintain = async () => { await prunePodcastCache(); await retryPendingPodcastArchives(); };
  void maintain().catch((error) => console.warn("[podcast] maintenance failed:", error.message));
  timer = setInterval(() => void maintain().catch((error) => console.warn("[podcast] maintenance failed:", error.message)), 60 * 60 * 1000);
  timer.unref();
}
