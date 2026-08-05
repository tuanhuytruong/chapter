/**
 * Text extraction for reading chunks.
 *  - PDF: pdf-parse, with a per-page map so we can slice by page range.
 *  - EPUB: `epub` package, chapters flattened to a reading order; we slice
 *    by chapter index range (a "page" in our model maps to a chapter unit).
 *
 * Both functions return concatenated plain text for the requested range.
 */

import fs from "fs";
import { createRequire } from "module";
import { resolve as pathResolve } from "path";

// pdf-parse v1.1.1 blocks ALL subpath imports via its "exports" map. Load the
// lib entry by absolute filesystem path. In ESM/tsx use createRequire(import.meta.url);
// in the CJS build (dist/server.cjs) import.meta is empty so fall back to the
// global require and a cwd-relative path.
const req: NodeRequire =
  typeof import.meta !== "undefined" && import.meta.url
    ? createRequire(import.meta.url)
    : (require as NodeRequire);
const pdfParseLibPath = pathResolve(process.cwd(), "node_modules/pdf-parse/lib/pdf-parse.js");
// @ts-ignore - no types for the internal entry
const pdfParse = req(pdfParseLibPath);

export interface ExtractResult {
  text: string;
  /** Total units available (pages for PDF, reading chunks for EPUB). */
  totalUnits: number;
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
  const buffer = fs.readFileSync(filePath);
  const pageTexts: string[] = [];

  // pdf-parse (via pdfjs/fontkit) emits a harmless "Required 'glyf' table is
  // not found -- trying to recover" warning for PDFs whose fonts lack a TrueType
  // glyph table (scanned/bitmap/Type3 fonts). Text extraction still works fine,
  // so we suppress just that noisy warning to keep logs clean.
  const origWarn = console.warn;
  console.warn = (...args: any[]) => {
    const msg = String(args[0] ?? "");
    if (/glyf.+table.+not found|trying to recover/i.test(msg)) return;
    origWarn.apply(console, args as any);
  };
  try {
    await pdfParse(buffer, {
      // Called once per rendered page with that page's text.
      pagerender: (pageData: any) => {
        return pageData.getTextContent().then((content: any) => {
          const strings = content.items.map((it: any) => it.str).join(" ");
          const pNum = pageData.pageIndex + 1;
          pageTexts[pNum] = strings;
          return strings;
        });
      },
    });
  } finally {
    console.warn = origWarn;
  }

  const totalUnits = pageTexts.length - 1; // index 0 unused
  const lo = Math.max(1, startPage);
  const hi = Math.min(totalUnits, endPage);
  const slice = pageTexts.slice(lo, hi + 1).filter(Boolean);
  return { text: slice.join("\n\n"), totalUnits };
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
