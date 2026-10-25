import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export const PDF_ILLUSTRATION_RENDER_LIMITS = Object.freeze({ timeoutMs: 12_000, maxPixels: 2_400_000, maxBytes: 4_000_000 });
export type TempPdfImage = { path: string; mimeType: "image/png"; cleanup: () => Promise<void> };

/** Render exactly one PDF page to a private temporary PNG. No durable cache. */
export async function renderPdfPageToTempImage(filePath: string, page: number): Promise<TempPdfImage> {
  if (!Number.isInteger(page) || page < 1) throw new Error("invalid illustration page");
  const input = await stat(filePath);
  if (!input.isFile()) throw new Error("PDF source unavailable");
  const dir = await mkdtemp(path.join(tmpdir(), "chapter-illustration-"));
  const prefix = path.join(dir, "page");
  const cleanup = async () => { await rm(dir, { recursive: true, force: true }); };
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("pdftoppm", ["-f", String(page), "-l", String(page), "-png", "-scale-to", "1500", "-singlefile", filePath, prefix], { stdio: "ignore" });
      const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("illustration render timed out")); }, PDF_ILLUSTRATION_RENDER_LIMITS.timeoutMs);
      child.once("error", (error: NodeJS.ErrnoException) => { clearTimeout(timer); reject(new Error(error.code === "ENOENT" ? "PDF renderer unavailable" : "illustration render failed")); });
      child.once("exit", (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error("illustration render failed")); });
    });
    const output = `${prefix}.png`;
    const data = await readFile(output);
    if (data.byteLength > PDF_ILLUSTRATION_RENDER_LIMITS.maxBytes) throw new Error("rendered illustration exceeds byte limit");
    // PNG IHDR width/height avoids image-library decoding and bounds decompression work.
    if (data.subarray(1, 4).toString() !== "PNG") throw new Error("renderer returned invalid image");
    const width = data.readUInt32BE(16), height = data.readUInt32BE(20);
    if (!width || !height || width * height > PDF_ILLUSTRATION_RENDER_LIMITS.maxPixels) throw new Error("rendered illustration exceeds pixel limit");
    return { path: output, mimeType: "image/png", cleanup };
  } catch (error) { await cleanup(); throw error; }
}
