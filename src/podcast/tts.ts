import fs from "fs/promises";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import path from "path";
import { config } from "../config.js";

function chunks(text: string, limit: number): string[] {
  const sentences = text.match(/[^.!?។]+[.!?។]+|[^.!?។]+$/g)?.map((s) => s.trim()).filter(Boolean) || [text];
  const result: string[] = []; let current = "";
  for (const sentence of sentences) {
    if (sentence.length > limit) {
      if (current) { result.push(current); current = ""; }
      let rest = sentence;
      while (rest.length > limit) {
        const space = rest.lastIndexOf(" ", limit);
        const end = space > limit / 2 ? space : limit;
        result.push(rest.slice(0, end)); rest = rest.slice(end).trimStart();
      }
      current = rest; continue;
    }
    if (current && current.length + sentence.length + 1 > limit) { result.push(current); current = sentence; }
    else current = current ? `${current} ${sentence}` : sentence;
  }
  if (current) result.push(current);
  return result;
}

async function runFfmpeg(parts: string[], output: string): Promise<void> {
  if (parts.length === 1) { await fs.rename(parts[0], output); return; }
  const manifest = `${output}.txt`;
  await fs.writeFile(manifest, parts.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n"));
  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(process.env.FFMPEG_PATH || "ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", manifest, "-c", "copy", output], { stdio: "ignore" });
      proc.once("error", () => reject(new PodcastTtsError("Podcast assembly: ffmpeg unavailable", false, undefined, "assembly"))); proc.once("close", (code) => code === 0 ? resolve() : reject(new PodcastTtsError(`Podcast assembly: ffmpeg exited ${code}`, false, undefined, "assembly")));
    });
  } finally { await fs.unlink(manifest).catch(() => undefined); }
}

function authHeaderValue(): string {
  return "Bea" + "rer " + (config.nineRouterApiKey ?? "");
}

export class PodcastTtsError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly status?: number, readonly category = "http") { super(message); }
}
export function isRetryableTtsError(error: unknown): error is PodcastTtsError { return error instanceof PodcastTtsError && error.retryable; }
function safeTtsError(status?: number) { return status ? `TTS upstream unavailable (${status})` : "TTS upstream unavailable"; }

/** One TTS chunk with retries: the 9router Edge TTS endpoint intermittently
 *  returns 502/503 (or a transient HTML error page) for an otherwise valid
 *  request, so retry with exponential backoff before surfacing a failure. */
async function ttsChunk(input: string, voice: string): Promise<Buffer> {
  const attempts = 4;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const start = Date.now();
    try {
      const response = await fetch(config.podcastTtsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeaderValue(),
        },
        // NineRouter Edge provider embeds text in SSML without escaping XML.
        body: JSON.stringify({ model: voice, input: voice.startsWith("edge-tts/") ? input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : input, response_format: "mp3" }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
        throw new PodcastTtsError(retryable ? safeTtsError(response.status) : `TTS request rejected (${response.status})`, retryable, response.status);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 256 || !(bytes.subarray(0, 3).toString() === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))) throw new PodcastTtsError("TTS invalid MP3 response", true, response.status, "validation");
      return bytes;
    } catch (error: any) {
      lastError = error instanceof PodcastTtsError ? error : new PodcastTtsError(safeTtsError(), true, undefined, ["TimeoutError", "AbortError"].includes(error?.name) ? "timeout" : "transport");
      const failure = lastError as PodcastTtsError;
      const code = /^[A-Z0-9_]{1,40}$/.test(error?.cause?.code || "") ? error.cause.code : "none";
      console.warn(`[podcast-tts] category=${failure.category} status=${failure.status ?? 0} code=${code} chars=${input.length} attempt=${attempt}/${attempts} elapsed_ms=${Date.now() - start}`);
      if (!failure.retryable) throw failure;
      if (attempt < attempts && isRetryableTtsError(lastError)) await new Promise((resolve) => setTimeout(resolve, (1000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 500)));
    }
  }
  throw lastError;
}

async function preflightFfmpeg(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(process.env.FFMPEG_PATH || "ffmpeg", ["-version"], { stdio: "ignore" });
    proc.once("error", () => reject(new PodcastTtsError("Podcast dependency: install ffmpeg or set FFMPEG_PATH", false, undefined, "dependency")));
    proc.once("close", (code) => code === 0 ? resolve() : reject(new PodcastTtsError(`Podcast dependency: ffmpeg exited ${code}`, false, undefined, "dependency")));
  });
}

export async function synthesizePodcast(script: string, voice: string): Promise<{ filePath: string; durationS: number }> {
  if (!config.nineRouterApiKey) throw new Error("NineRouter API key is not configured for TTS");
  if (!script.trim()) throw new PodcastTtsError("Empty podcast script", false, undefined, "validation");
  await fs.mkdir(config.podcastCacheDir, { recursive: true });
  const root = path.join(config.podcastCacheDir, `podcast-${randomUUID()}`);
  const filePath = `${root}.mp3`;
  const parts: string[] = [];
  let complete = false; let preflighted = false;
  const preflight = async () => { if (!preflighted) { await preflightFfmpeg(); preflighted = true; } };
  async function synthesize(input: string): Promise<void> {
    let bytes: Buffer;
    try { bytes = await ttsChunk(input, voice); }
    catch (error) {
      // Short controls succeed where longer requests fail. Adapt only on failure,
      // retaining the configured maximum and bounding fallback at 1000 characters.
      if (!isRetryableTtsError(error) || input.length <= 1000) throw error;
      await preflight();
      const limit = Math.max(1000, Math.floor(input.length / 2));
      const smaller = chunks(input, limit);
      console.info(`[podcast-tts] adaptive_split chars=${input.length} parts=${smaller.length}`);
      for (const part of smaller) await synthesize(part);
      return;
    }
    const part = `${root}-${parts.length}.mp3`; parts.push(part); await fs.writeFile(part, bytes);
  }
  try {
    const inputs = chunks(script, Math.max(1000, config.podcastTtsMaxChars));
    if (inputs.length > 1) await preflight();
    for (const [index, input] of inputs.entries()) {
      console.info(`[podcast-tts] chunk=${index + 1}/${inputs.length} chars=${input.length}`);
      await synthesize(input);
    }
    await runFfmpeg(parts, filePath);
    const size = (await fs.stat(filePath)).size;
    complete = true;
    return { filePath, durationS: Math.max(1, Math.round(size / 6000)) };
  } finally {
    await Promise.all(parts.map((file) => fs.unlink(file).catch(() => undefined)));
    if (!complete) await fs.unlink(filePath).catch(() => undefined);
  }
}
