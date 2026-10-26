import { spawn } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { query } from "./db.js";
import { config } from "./config.js";
import { downloadArchivedPodcast } from "./podcast/telegram.js";

type HlsSession = { ownerId: string; bookId: string; readingRound: number; root: string; expiresAt: number; playlist: string; segments: Set<string> };
const sessions = new Map<string, HlsSession>();
const SESSION_MS = 2 * 60 * 60_000;
const rootDir = () => path.join(config.podcastCacheDir, "hls-poc");

async function audioFor(episode: any): Promise<Buffer> {
  const local = episode.local_cache_path && episode.local_cache_until && new Date(episode.local_cache_until) > new Date();
  if (local) return fs.readFile(episode.local_cache_path);
  if (episode.tg_file_id) return downloadArchivedPodcast(episode.tg_file_id);
  throw new Error("Podcast audio is temporarily unavailable");
}
async function runFfmpeg(input: string, out: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(process.env.FFMPEG_PATH || "ffmpeg", ["-y", "-i", input, "-vn", "-c:a", "aac", "-b:a", "128k", "-f", "hls", "-hls_time", "5", "-hls_playlist_type", "vod", "-hls_segment_filename", path.join(out, "segment-%03d.ts"), path.join(out, "index.m3u8")], { stdio: "ignore" });
    proc.once("error", () => reject(new Error("FFmpeg is unavailable for HLS packaging")));
    proc.once("close", (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg HLS packaging exited ${code}`)));
  });
}
export async function createPodcastHlsSession(ownerId: string, bookId: string, episodeId: string) {
  const { rows } = await query<any>(`SELECT p.*,b.reading_round FROM podcasts p JOIN books b ON b.id=p.book_id WHERE p.id=$1 AND p.book_id=$2 AND p.user_id=$3 AND b.owner_id=$3 AND p.reading_round=b.reading_round AND p.status IN ('ready','archive_pending')`, [episodeId, bookId, ownerId]);
  const first = rows[0]; if (!first) throw new Error("Podcast episode unavailable");
  const { rows: nextRows } = await query<any>(`SELECT p.* FROM podcasts p JOIN book_reading_units u ON u.book_id=p.book_id AND u.chapter_key=p.chapter_key WHERE p.user_id=$1 AND p.book_id=$2 AND p.reading_round=$3 AND p.status IN ('ready','archive_pending') GROUP BY p.id ORDER BY min(u.unit_index)`, [ownerId, bookId, first.reading_round]);
  const episodes = nextRows.slice(Math.max(0, nextRows.findIndex((row) => row.id === episodeId)), Math.max(0, nextRows.findIndex((row) => row.id === episodeId)) + 2);
  const id = randomUUID(); const root = path.join(rootDir(), id); await fs.mkdir(root, { recursive: true });
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-TARGETDURATION:6", "#EXT-X-MEDIA-SEQUENCE:0", "#EXT-X-PLAYLIST-TYPE:EVENT"];
  const segments = new Set<string>();
  for (const [index, episode] of episodes.entries()) {
    const dir = path.join(root, String(index)); await fs.mkdir(dir, { recursive: true });
    const input = path.join(dir, "input.mp3"); await fs.writeFile(input, await audioFor(episode)); await runFfmpeg(input, dir); await fs.unlink(input);
    const manifest = await fs.readFile(path.join(dir, "index.m3u8"), "utf8");
    if (index) lines.push("#EXT-X-DISCONTINUITY");
    for (const line of manifest.split(/\r?\n/)) {
      if (!line || line.startsWith("#EXTM3U") || line.startsWith("#EXT-X-VERSION") || line.startsWith("#EXT-X-TARGETDURATION") || line.startsWith("#EXT-X-MEDIA-SEQUENCE") || line === "#EXT-X-ENDLIST") continue;
      if (line.startsWith("#")) lines.push(line); else { const name = `${index}/${path.basename(line)}`; segments.add(name); lines.push(`segments/${name}`); }
    }
  }
  const playlist = `${lines.join("\n")}\n`;
  sessions.set(id, { ownerId, bookId, readingRound: first.reading_round, root, expiresAt: Date.now() + SESSION_MS, playlist, segments });
  return { id, playlistUrl: `/api/podcasts/listening-sessions/${id}/index.m3u8`, expiresAt: new Date(Date.now() + SESSION_MS).toISOString(), episodeCount: episodes.length };
}
export function readPodcastHlsSession(ownerId: string, id: string) { const session = sessions.get(id); if (!session || session.ownerId !== ownerId || session.expiresAt < Date.now()) return null; return session; }
export async function prunePodcastHlsSessions() { for (const [id, session] of sessions) if (session.expiresAt < Date.now()) { sessions.delete(id); await fs.rm(session.root, { recursive: true, force: true }); } }
