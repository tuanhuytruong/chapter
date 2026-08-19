/**
 * Text extraction for reading chunks.
 *  - PDF: pdf-parse, with a per-page map so we can slice by page range.
 *  - EPUB: `epub` package, chapters flattened to a reading order; we slice
 *    by chapter index range (a "page" in our model maps to a chapter unit).
 *
 * Both functions return concatenated plain text for the requested range.
 */

import { Worker } from "worker_threads";

const PDF_MAX_FILE_BYTES = 100 * 1024 * 1024;
const PDF_MAX_PAGES = 5_000;
const PDF_MAX_CHARS_PER_PAGE = 250_000;
const PDF_MAX_TOTAL_CHARS = 50_000_000;
const PDF_TIMEOUT_MS = 120_000;
const PDF_WORKER_OLD_GENERATION_MB = 128;

export interface ExtractResult {
  text: string;
  /** Total units available (pages for PDF, reading chunks for EPUB). */
  totalUnits: number;
  /** Validated text for every PDF page; absent for EPUB. */
  pages?: string[];
}

export type PdfTextLayerProbe = {
  classification: "text" | "image_only";
  totalPages: number;
  meaningfulPages: number;
};

// A blank cover or illustration page is normal. A PDF is only treated as a scan
// when no page contains enough native/selectable text to read at all.
const PDF_MEANINGFUL_TEXT_CHARS = 20;

/**
 * Lightweight native-text check for upload validation. This uses the existing
 * bounded PDF worker only; it never rasterizes pages or invokes OCR.
 */
export async function probePdfTextLayer(filePath: string): Promise<PdfTextLayerProbe> {
  const extracted = await extractPdfRange(filePath, 1, Number.MAX_SAFE_INTEGER);
  const pages = extracted.pages;
  if (!pages || pages.length !== extracted.totalUnits) {
    throw new Error("PDF text-layer probe was incomplete");
  }
  const meaningfulPages = pages.reduce(
    (count, page) => count + (page.replace(/\s+/g, "").length >= PDF_MEANINGFUL_TEXT_CHARS ? 1 : 0),
    0,
  );
  return {
    classification: meaningfulPages > 0 ? "text" : "image_only",
    totalPages: extracted.totalUnits,
    meaningfulPages,
  };
}

export interface EpubReadingUnit {
  unitIndex: number;
  title: string | null;
  /** Stable identity of the EPUB spine item that owns this chunk. */
  spineIndex: number;
  chapterKey: string;
  rawText: string;
  /**
   * Printed page number when the EPUB encodes it in the spine filename
   * (e.g. `page0042.xhtml` -> 42). Some EPUBs are converted from a paginated
   * source and carry this in the file name. Null when the book has no usable
   * page info (reflowable/SectionNNNN/etc).
   */
  pageLabel: number | null;
}

// ~4,500 Vietnamese characters is typically 700–900 words: a practical
// 2–3 printed-page reading session without making AI summaries too long.
const EPUB_TARGET_CHARS = 4_500;
const EPUB_MIN_CHARS = 1_800;

function htmlToParagraphs(html: string): string[] {
  return html
    .replace(/<\/(p|div|h[1-6]|li|blockquote|section|article)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * EPUB has reflowable text rather than fixed printed pages. Build stable,
 * paragraph-aware reading chunks so each daily summary has comparable context.
 */
export async function buildEpubReadingUnits(filePath: string): Promise<EpubReadingUnit[]> {
  const epub = await loadEpub(filePath);
  const units: EpubReadingUnit[] = [];
  let pending: string[] = [];
  let pendingTitle: string | null = null;
  let pendingSpineIndex = 0;
  let pendingChapterKey = "";
  let pendingPageLabel: number | null = null;

  const flush = () => {
    const rawText = pending.join("\n\n").trim();
    if (rawText) units.push({ unitIndex: units.length + 1, title: pendingTitle, spineIndex: pendingSpineIndex, chapterKey: pendingChapterKey, rawText, pageLabel: pendingPageLabel });
    pending = [];
    pendingTitle = null;
    pendingSpineIndex = 0;
    pendingChapterKey = "";
    pendingPageLabel = null;
  };

  for (const [spineIndex, item] of (epub.flow as any[]).entries()) {
    let html = "";
    try { html = await epub.getChapter(item.id) || ""; } catch { continue; }
    const paragraphs = htmlToParagraphs(html);
    if (!paragraphs.length) continue;
    const title = item.title ? String(item.title).trim().slice(0, 70) || null : null;
    // Printed page number from the spine filename when the EPUB carries one
    // (page0042.xhtml -> 42). Falls back to null for reflowable books that have
    // no page info, so callers never show a fabricated "page".
    const pageMatch = String(item.href || item.id || "").match(/page(\d+)/i);
    const pageLabel = pageMatch ? parseInt(pageMatch[1], 10) : null;
    // Never combine chunks across spine items: a title can repeat or be absent,
    // while the EPUB spine gives each chapter/document a durable boundary.
    flush();
    pendingTitle = title;
    pendingSpineIndex = spineIndex;
    pendingChapterKey = `${spineIndex}:${String(item.id || item.href || "untitled")}`;
    pendingPageLabel = pageLabel;

    for (const paragraph of paragraphs) {
      const currentLength = pending.reduce((n, p) => n + p.length, 0);
      if (pending.length && currentLength >= EPUB_MIN_CHARS && currentLength + paragraph.length > EPUB_TARGET_CHARS) flush();
      if (!pendingTitle) pendingTitle = title;
      if (!pendingChapterKey) {
        pendingSpineIndex = spineIndex;
        pendingChapterKey = `${spineIndex}:${String(item.id || item.href || "untitled")}`;
        pendingPageLabel = pageLabel;
      }
      pending.push(paragraph);
    }
    flush();
  }
  return units;
}

/** Load an EPUB using the current promise-based `epub` package API. */
async function loadEpub(filePath: string): Promise<any> {
  const { EPub } = await import("epub");
  const epub = new EPub(filePath) as any;
  await epub.parse();
  return epub;
}

/**
 * Extract text from a PDF between [startPage, endPage] (1-indexed, inclusive).
 * Uses pdf-parse's page-render callback to build a per-page text map, which is
 * far more reliable than splitting the single concatenated string.
 */
export async function extractPdfRange(
  filePath: string,
  startPage: number,
  endPage: number
): Promise<ExtractResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./pdfExtractorWorker.mjs", import.meta.url), {
      workerData: { filePath, startPage, endPage, limits: { maxFileBytes: PDF_MAX_FILE_BYTES, maxPages: PDF_MAX_PAGES, maxCharsPerPage: PDF_MAX_CHARS_PER_PAGE, maxTotalChars: PDF_MAX_TOTAL_CHARS } },
      resourceLimits: { maxOldGenerationSizeMb: PDF_WORKER_OLD_GENERATION_MB },
    });
    let settled = false;
    const finish = (error?: Error, result?: ExtractResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      void worker.terminate();
      if (error) reject(error);
      else resolve(result!);
    };
    const timeout = setTimeout(
      () => finish(new Error(`PDF extraction timed out after ${PDF_TIMEOUT_MS}ms`)),
      PDF_TIMEOUT_MS
    );
    worker.once("message", (message: { ok: boolean; result?: ExtractResult; error?: string }) => {
      if (message.ok && message.result) finish(undefined, message.result);
      else finish(new Error(message.error || "PDF extraction worker failed"));
    });
    worker.once("error", (error) => finish(error));
    worker.once("exit", (code) => {
      if (!settled) finish(new Error(`PDF extraction worker exited with code ${code}`));
    });
  });
}

/**
 * Extract text from an EPUB between chapter indices [startUnit, endUnit]
 * (0-indexed, inclusive). We read each chapter's document body text.
 */
export async function extractEpubRange(
  filePath: string,
  startUnit: number,
  endUnit: number
): Promise<ExtractResult> {
  const epub = await loadEpub(filePath);

  // spine is the linear reading order
  const flow: any[] = epub.flow; // array of { id, href, ... }
  const totalUnits = flow.length;

  const chapterTexts: string[] = new Array(totalUnits);
  const lo = Math.max(0, startUnit);
  const hi = Math.min(totalUnits - 1, endUnit);

  await Promise.all(
    flow.map(async (item: any, idx: number) => {
      if (idx < lo || idx > hi) return;
      try {
        const txt = await epub.getChapter(item.id);
        if (!txt) return;
        // strip HTML tags
        const plain = txt
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        chapterTexts[idx] = plain;
      } catch {
        // A malformed individual chapter should not make the whole book unreadable.
      }
    })
  );

  const slice = chapterTexts.slice(lo, hi + 1).filter(Boolean);
  return { text: slice.join("\n\n"), totalUnits };
}

export async function getChapterTitle(
  filePath: string,
  fileType: "pdf" | "epub",
  start: number,
  end: number,
  rawText?: string
): Promise<string | null> {
  if (fileType === "epub") {
    try {
      const epub = await loadEpub(filePath);
      const flow: any[] = epub.flow;
      for (let i = start - 1; i <= end - 1 && i < flow.length; i++) {
        if (flow[i]?.title) return flow[i].title;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (fileType === "pdf" && rawText) {
    const lines = rawText.split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (/^(Chapter|Part|Section|Lesson|Unit)\s+\w+/i.test(t)) return t;
      if (/^[A-Z][A-Z\s\d]{10,}$/.test(t)) return t;
    }
  }
  return null;
}

/**
 * Generic dispatcher. `start`/`end` are "pages" in the book model; for EPUB
 * we treat each chapter as one page unit.
 */
export async function extractRange(
  filePath: string,
  fileType: "pdf" | "epub",
  start: number,
  end: number
): Promise<ExtractResult> {
  if (fileType === "pdf") return extractPdfRange(filePath, start, end);
  return extractEpubRange(filePath, start - 1, end - 1); // model is 1-indexed
}
