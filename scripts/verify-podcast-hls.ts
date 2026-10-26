import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const ffmpeg = process.env.FFMPEG_PATH;
assert.ok(ffmpeg, "FFMPEG_PATH must point to the DEV-owned ffmpeg executable");
const root = await mkdtemp(path.join(tmpdir(), "chapter-hls-"));
const run = (args: string[]) => new Promise<void>((resolve, reject) => { const p = spawn(ffmpeg, args, { stdio: "ignore" }); p.once("error", reject); p.once("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))); });
try {
  const input = path.join(root, "control.mp3"); const out = path.join(root, "hls"); await mkdir(out);
  await run(["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=12", "-c:a", "libmp3lame", input]);
  await run(["-y", "-i", input, "-vn", "-c:a", "aac", "-b:a", "128k", "-f", "hls", "-hls_time", "5", "-hls_playlist_type", "vod", "-hls_segment_filename", path.join(out, "segment-%03d.ts"), path.join(out, "index.m3u8")]);
  const manifest = await readFile(path.join(out, "index.m3u8"), "utf8"); const files = await readdir(out);
  assert.match(manifest, /#EXTM3U/); assert.match(manifest, /#EXTINF/); assert.ok(files.some((file) => file.endsWith(".ts")), "HLS has media segments");
  console.log("PODCAST_HLS_FIXTURE_OK");
} finally { await rm(root, { recursive: true, force: true }); }
