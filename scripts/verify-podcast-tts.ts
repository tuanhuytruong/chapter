import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { config } from "../src/config.js";
import { synthesizePodcast, PodcastTtsError } from "../src/podcast/tts.js";

const cache = await fs.mkdtemp(path.join(os.tmpdir(), "podcast-tts-test-"));
const saved = { key: config.nineRouterApiKey, cache: config.podcastCacheDir, max: config.podcastTtsMaxChars, fetch: globalThis.fetch, ffmpeg: process.env.FFMPEG_PATH, timeout: globalThis.setTimeout };
const realFfmpeg = process.env.FFMPEG_PATH || "ffmpeg";
execFileSync(realFfmpeg, ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.3", "-codec:a", "libmp3lame", path.join(cache, "fixture.mp3")], { stdio: "ignore" });
const audio = await fs.readFile(path.join(cache, "fixture.mp3"));
await fs.unlink(path.join(cache, "fixture.mp3"));
config.nineRouterApiKey = "test"; config.podcastCacheDir = cache; config.podcastTtsMaxChars = 1000;
let calls = 0;
function mock(fn: (call: number, input: string) => Response | Promise<Response>) {
  calls = 0;
  globalThis.fetch = (async (_url: any, init: any) => { calls++; return fn(calls, JSON.parse(init.body).input); }) as typeof fetch;
}
const ok = () => new Response(audio, { headers: { "content-type": "audio/mpeg" } });
const failure = async (category: string) => assert.rejects(synthesizePodcast("Short script.", "test"), (e: unknown) => e instanceof PodcastTtsError && e.category === category);
const clean = async () => assert.deepEqual(await fs.readdir(cache), []);
try {
  // Speed up only retry sleeps; ffmpeg and real filesystem remain exercised.
  globalThis.setTimeout = ((fn: any, _delay: any, ...args: any[]) => saved.timeout(fn, 0, ...args)) as typeof setTimeout;
  process.env.FFMPEG_PATH = "/no-such-ffmpeg";
  mock(ok);
  const single = await synthesizePodcast("Short script.", "test");
  assert.equal(calls, 1); await fs.unlink(single.filePath); await clean();
  const multipart = Array(150).fill("Sentence.").join(" ");
  await assert.rejects(synthesizePodcast(multipart, "test"), (e: any) => e.category === "dependency");
  assert.equal(calls, 1); await clean();
  process.env.FFMPEG_PATH = realFfmpeg;
  mock((_n, input) => { assert.equal(input, "A &amp; B &lt; C &gt; D."); return ok(); });
  const escaped = await synthesizePodcast("A & B < C > D.", "edge-tts/vi-VN-HoaiMyNeural"); await fs.unlink(escaped.filePath);
  mock(ok);
  const combined = await synthesizePodcast(multipart, "test");
  assert(calls > 1); execFileSync(realFfmpeg, ["-v", "error", "-i", combined.filePath, "-f", "null", "-"], { stdio: "pipe" });
  await fs.unlink(combined.filePath); await clean();
  mock(() => new Response("private upstream body", { status: 400 })); await failure("http"); assert.equal(calls, 1); await clean();
  mock((n) => n === 1 ? new Response("unavailable", { status: 502 }) : ok());
  const retried = await synthesizePodcast("Short script.", "test"); assert.equal(calls, 2); await fs.unlink(retried.filePath);
  mock(() => { throw new TypeError("private transport"); }); await failure("transport"); assert.equal(calls, 4); await clean();
  mock(() => { throw new DOMException("timed out", "TimeoutError"); }); await failure("timeout"); assert.equal(calls, 4); await clean();
  mock(() => new Response("<html>".repeat(100))); await failure("validation"); assert.equal(calls, 4); await clean();
  mock(n => n === 1 ? ok() : new Response("bad", { status: 403 }));
  await assert.rejects(synthesizePodcast(multipart, "test")); assert.equal(calls, 2); await clean();
  const fake = path.join(cache, "fake-ffmpeg");
  await fs.writeFile(fake, '#!/bin/sh\nif [ "$1" = "-version" ]; then exit 0; fi\nexit 9\n', { mode: 0o700 });
  process.env.FFMPEG_PATH = fake; mock(ok);
  await assert.rejects(synthesizePodcast(multipart, "test"), (e: any) => e.category === "assembly");
  await fs.unlink(fake); await clean();
  process.env.FFMPEG_PATH = realFfmpeg; config.podcastTtsMaxChars = 12000;
  mock((_n, input) => input.length > 1000 ? new Response("bad", { status: 502 }) : ok());
  const adapted = await synthesizePodcast(multipart, "test"); assert(calls > 4); await fs.unlink(adapted.filePath); await clean();
  console.log("PODCAST_TTS_OK: single, multipart decode, preflight, permanent 4xx, HTTP retry, transport, timeout, invalid audio, mid-chunk cleanup, assembly exit, adaptive split");
} finally {
  config.nineRouterApiKey = saved.key; config.podcastCacheDir = saved.cache; config.podcastTtsMaxChars = saved.max;
  globalThis.fetch = saved.fetch; globalThis.setTimeout = saved.timeout;
  if (saved.ffmpeg === undefined) delete process.env.FFMPEG_PATH; else process.env.FFMPEG_PATH = saved.ffmpeg;
  await fs.rm(cache, { recursive: true, force: true });
}
