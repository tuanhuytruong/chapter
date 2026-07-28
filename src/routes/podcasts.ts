import { Router, type Request, type Response } from "express";
import fs from "fs/promises";
import { query } from "../db.js";
import { userFrom } from "../auth.js";
import { createPodcast, podcastPublic, prunePodcastCache } from "../podcast/generate.js";
import { downloadArchivedPodcast } from "../podcast/telegram.js";

export const podcastsRouter = Router();

async function owned(id: string, userId: string) { return (await query<any>("SELECT p.* FROM podcasts p WHERE p.id=$1 AND p.user_id=$2", [id, userId])).rows[0]; }

podcastsRouter.get("/books/:bookId", async (req: Request, res: Response) => {
  try { const rows = await query<any>("SELECT p.* FROM podcasts p JOIN books b ON b.id=p.book_id WHERE p.book_id=$1 AND b.owner_id=$2 ORDER BY p.created_at DESC", [req.params.bookId, userFrom(req).id]); res.json(rows.rows.map(podcastPublic)); }
  catch (error: any) { console.warn("[podcast] history failed:", error.message); res.status(500).json({ error: "Podcast history unavailable" }); }
});

podcastsRouter.post("/", async (req: Request, res: Response) => {
  const { book_id, log_id, voice_gender } = req.body || {};
  if (typeof book_id !== "string" || typeof log_id !== "string" || (voice_gender && voice_gender !== "female" && voice_gender !== "male")) return res.status(400).json({ error: "book_id, log_id, and an optional valid voice_gender are required" });
  try { res.status(202).json(await createPodcast(userFrom(req).id, book_id, log_id, voice_gender)); }
  catch (error: any) { res.status(error.code === "VOICE_REQUIRED" ? 409 : 400).json({ error: error.message }); }
});

podcastsRouter.get("/:id/audio", async (req: Request, res: Response) => {
  try {
    const episode = await owned(req.params.id, userFrom(req).id); if (!episode || episode.status !== "ready") return res.status(404).end();
    let data: Buffer;
    try {
      if (episode.local_cache_path && episode.local_cache_until && new Date(episode.local_cache_until) > new Date()) data = await fs.readFile(episode.local_cache_path);
      else data = await downloadArchivedPodcast(episode.tg_file_id);
    } catch { data = await downloadArchivedPodcast(episode.tg_file_id); }
    const range = req.header("range"); res.setHeader("Accept-Ranges", "bytes"); res.setHeader("Content-Type", "audio/mpeg"); res.setHeader("Cache-Control", "private, no-store");
    if (!range) { res.setHeader("Content-Length", data.length); return res.status(200).end(data); }
    const match = /^bytes=(\d*)-(\d*)$/.exec(range); if (!match) return res.status(416).end();
    const start = match[1] ? Number(match[1]) : 0; const end = match[2] ? Math.min(Number(match[2]), data.length - 1) : data.length - 1;
    if (start > end || start >= data.length) return res.status(416).setHeader("Content-Range", `bytes */${data.length}`).end();
    res.status(206).setHeader("Content-Range", `bytes ${start}-${end}/${data.length}`).setHeader("Content-Length", end - start + 1).end(data.subarray(start, end + 1));
  } catch { res.status(502).json({ error: "Podcast audio is temporarily unavailable" }); }
});

let timer: ReturnType<typeof setInterval> | undefined;
export function startPodcastMaintenance() { if (!timer) { void prunePodcastCache().catch(() => undefined); timer = setInterval(() => void prunePodcastCache().catch(() => undefined), 60 * 60 * 1000); timer.unref(); } }