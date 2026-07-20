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

// pdf-parse v1.1.1 blocks ALL subpath imports (even package.json) via its
// "exports" map. Load the lib entry by absolute filesystem path, constructed
// from process.cwd() so it works regardless of the resolving package.
const require = createRequire(import.meta.url);
const pdfParseLibPath = pathResolve(process.cwd(), "node_modules/pdf-parse/lib/pdf-parse.js");
// @ts-ignore - no types for the internal entry
const pdfParse = require(pdfParseLibPath);

export interface ExtractResult {
  text: string;
  /** Total units available (pages for PDF, chapters for EPUB). */
  totalUnits: number;
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
  // dynamic import so the dep is only loaded when needed
  const Epub = (await import("epub")).default;
  const epub: any = new Epub(filePath) as any;

  await new Promise<void>((resolve, reject) => {
    epub.on("end", () => resolve());
    epub.on("error", (e: any) => reject(e));
  });

  // spine is the linear reading order
  const flow: any[] = epub.flow; // array of { id, href, ... }
  const totalUnits = flow.length;

  const chapterTexts: string[] = new Array(totalUnits);
  const lo = Math.max(0, startUnit);
  const hi = Math.min(totalUnits - 1, endUnit);

  await Promise.all(
    flow.map(
      (item: any, idx: number) =>
        new Promise<void>((res) => {
          if (idx < lo || idx > hi) return res();
          epub.getChapter(item.id, (err: any, txt: string) => {
            if (err || !txt) return res();
            // strip HTML tags
            const plain = txt
              .replace(/<[^>]+>/g, " ")
              .replace(/&nbsp;/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            chapterTexts[idx] = plain;
            res();
          });
        })
    )
  );

  const slice = chapterTexts.slice(lo, hi + 1).filter(Boolean);
  return { text: slice.join("\n\n"), totalUnits };
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
