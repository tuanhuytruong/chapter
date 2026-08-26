import fs from "fs/promises";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import path from "path";
import { config } from "../config.js";

function chunks(text: string, limit: number): string[] {
  const sentences = text.match(/[^.!?។]+[.!?។]+|[^.!?។]+$/g)?.map((s) => s.trim()).filter(Boolean) || [text];
  const result: string[] = []; let current = "";
  for (const sentence of sentences) {
    if (sentence.length > limit) throw new Error("Podcast sentence exceeds TTS input limit");
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
      const proc = spawn("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", manifest, "-c", "copy", output], { stdio: "ignore" });
      proc.once("error", reject); proc.once("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
    });
  } finally { await fs.unlink(manifest).catch(() => undefined); }
}

function authHeaderValue(): string {
  return "Bea" + "rer " + (config.nineRouterApiKey ?? "");
}

export class PodcastTtsError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly status?: number) { super(message); }
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
    try {
      const response = await fetch(config.podcastTtsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeaderValue(),
        },
        body: JSON.stringify({ model: voice, input, response_format: "mp3" }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 160);
        const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
        throw new PodcastTtsError(retryable ? safeTtsError(response.status) : `TTS request rejected (${response.status}): ${detail}`, retryable, response.status);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 256) throw new Error("TTS returned an empty audio response");
      return bytes;
    } catch (error) {
      lastError = error instanceof PodcastTtsError ? error : new PodcastTtsError(safeTtsError(), true);
      if (attempt < attempts && isRetryableTtsError(lastError)) await new Promise((resolve) => setTimeout(resolve, (1000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 500)));
    }
  }
  throw lastError;
}

export async function synthesizePodcast(script: string, voice: string): Promise<{ filePath: string; durationS: number }> {
  if (!config.nineRouterApiKey) throw new Error("NineRouter API key is not configured for TTS");
  await fs.mkdir(config.podcastCacheDir, { recursive: true });
  const root = path.join(config.podcastCacheDir, `podcast-${randomUUID()}`);
  const parts: string[] = [];
  try {
    for (const [index, input] of chunks(script, Math.max(1000, config.podcastTtsMaxChars)).entries()) {
      const bytes = await ttsChunk(input, voice);
      const part = `${root}-${index}.mp3`; await fs.writeFile(part, bytes); parts.push(part);
    }
    const filePath = `${root}.mp3`; await runFfmpeg(parts, filePath);
    const size = (await fs.stat(filePath)).size;
    return { filePath, durationS: Math.max(1, Math.round(size / 6000)) };
  } finally { await Promise.all(parts.map((file) => fs.unlink(file).catch(() => undefined))); }
}
