import { parentPort, workerData } from "node:worker_threads";
import { readFile } from "node:fs/promises";
import { stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { maxFileBytes: MAX_FILE_BYTES, maxPages: MAX_PAGES, maxCharsPerPage: MAX_CHARS_PER_PAGE, maxTotalChars: MAX_TOTAL_CHARS } = workerData.limits;

function fail(message) { throw new Error(message); }

// PDF.js v1.10.100 operator constants. The detector verifier confirms each
// value against the bundled source, so an upgrade cannot silently guess them.
const PDFJS_OPS = Object.freeze({
  save: 10,
  restore: 11,
  transform: 12,
  paintImageMaskXObject: 83,
  paintImageXObject: 85,
  paintInlineImageXObject: 86,
});
const IMAGE_OPERATORS = new Set([
  PDFJS_OPS.paintImageMaskXObject,
  PDFJS_OPS.paintImageXObject,
  PDFJS_OPS.paintInlineImageXObject,
]);
const SINGLE_IMAGE_AREA_RATIO = 0.10;
const CUMULATIVE_IMAGE_AREA_RATIO = 0.15;

function multiplyTransform(left, right) {
  const [a, b, c, d, e, f] = left;
  const [A, B, C, D, E, F] = right;
  return [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];
}

/**
 * Replays only graphics-state operators needed for image paint bounds.
 * An image is drawn into the unit square, whose transformed area is the
 * absolute CTM determinant. Invalid/missing page or transform data remains
 * unknown and cannot make a page meaningful.
 */
function detectPageVisual(operatorList, pageData) {
  const view = pageData?.view || pageData?.pageInfo?.view;
  const pageWidth = Array.isArray(view) ? Math.abs(Number(view[2]) - Number(view[0])) : NaN;
  const pageHeight = Array.isArray(view) ? Math.abs(Number(view[3]) - Number(view[1])) : NaN;
  const pageArea = pageWidth * pageHeight;
  const hasPageArea = Number.isFinite(pageArea) && pageArea > 0;
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let imageCount = 0;
  let knownImageArea = 0;
  let largestImageArea = 0;
  let unknownBounds = false;
  const fnArray = Array.isArray(operatorList?.fnArray) ? operatorList.fnArray : [];
  const argsArray = Array.isArray(operatorList?.argsArray) ? operatorList.argsArray : [];
  for (let index = 0; index < fnArray.length; index++) {
    const op = fnArray[index];
    if (op === PDFJS_OPS.save) { stack.push(ctm && ctm.slice()); continue; }
    if (op === PDFJS_OPS.restore) { ctm = stack.length ? stack.pop() : [1, 0, 0, 1, 0, 0]; continue; }
    if (op === PDFJS_OPS.transform) {
      const matrix = argsArray[index];
      if (Array.isArray(ctm) && Array.isArray(matrix) && matrix.length === 6 && matrix.every(Number.isFinite)) ctm = multiplyTransform(ctm, matrix);
      else ctm = null;
      continue;
    }
    if (!IMAGE_OPERATORS.has(op)) continue;
    imageCount++;
    if (!hasPageArea || !Array.isArray(ctm) || !ctm.every(Number.isFinite)) { unknownBounds = true; continue; }
    const area = Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2]);
    if (!Number.isFinite(area) || area < 0) { unknownBounds = true; continue; }
    knownImageArea += area;
    largestImageArea = Math.max(largestImageArea, area);
  }
  // Unknown candidates never contribute to either threshold. Known candidates
  // may still qualify; this is preferable to treating all pages with an icon
  // and an uninspectable image as meaningful.
  const meaningful = hasPageArea && (
    largestImageArea / pageArea >= SINGLE_IMAGE_AREA_RATIO ||
    knownImageArea / pageArea >= CUMULATIVE_IMAGE_AREA_RATIO
  );
  return { page: pageData.pageIndex + 1, meaningful, imageCount, unknownBounds };
}

// PostgreSQL TEXT rejects NUL (U+0000), while malformed PDF text runs can
// contain it. Preserve every other Unicode character from the source PDF.
function sanitizePdfText(text) { return text.replace(/\u0000/g, ""); }

async function extract() {
  const { filePath, startPage, endPage } = workerData;
  const info = await stat(filePath);
  if (!info.isFile()) fail("PDF path is not a regular file");
  if (info.size > MAX_FILE_BYTES) fail(`PDF exceeds ${MAX_FILE_BYTES} byte limit`);

  const buffer = await readFile(filePath);
  const require = createRequire(import.meta.url);
  const pdfParse = require(resolve(process.cwd(), "node_modules/pdf-parse/lib/pdf-parse.js"));
  const pageTexts = [];
  const pageVisuals = [];
  let totalChars = 0;
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (/glyf.+table.+not found|trying to recover/i.test(String(args[0] ?? ""))) return;
    originalWarn(...args);
  };
  try {
    const parsed = await pdfParse(buffer, {
      max: MAX_PAGES + 1,
      pagerender: async (pageData) => {
        const pageNumber = pageData.pageIndex + 1;
        if (pageNumber > MAX_PAGES) fail(`PDF exceeds ${MAX_PAGES} page limit`);
        const [content, operatorList] = await Promise.all([pageData.getTextContent(), pageData.getOperatorList()]);
        const visual = detectPageVisual(operatorList, pageData);
        // Keep only the minimal persisted contract; bounds and uncertainty stay
        // inside the worker and never leave the extraction process.
        pageVisuals[pageNumber] = { page: pageNumber, meaningful: visual.meaningful, imageCount: visual.imageCount };
        const text = content.items.map((item) => sanitizePdfText(String(item.str ?? ""))).join(" ");
        if (text.length > MAX_CHARS_PER_PAGE) fail(`PDF page ${pageNumber} exceeds ${MAX_CHARS_PER_PAGE} character limit`);
        totalChars += text.length;
        if (totalChars > MAX_TOTAL_CHARS) fail(`PDF exceeds ${MAX_TOTAL_CHARS} total character limit`);
        pageTexts[pageNumber] = text;
        return text;
      },
    });
    if (parsed.numpages > MAX_PAGES) fail(`PDF exceeds ${MAX_PAGES} page limit`);
    const totalUnits = parsed.numpages;
    const pages = Array.from({ length: totalUnits }, (_, index) => pageTexts[index + 1] ?? "");
    if (pages.length !== totalUnits) fail("PDF page extraction was incomplete");
    const lo = Math.max(1, Math.trunc(startPage));
    const hi = Math.min(totalUnits, Math.trunc(endPage));
    const visuals = Array.from({ length: totalUnits }, (_, index) => pageVisuals[index + 1] || { page: index + 1, meaningful: false, imageCount: 0 });
    return { text: hi >= lo ? pages.slice(lo - 1, hi).join("\n\n") : "", totalUnits, pages, pageVisuals: visuals };
  } finally {
    console.warn = originalWarn;
  }
}

extract().then(
  (result) => parentPort.postMessage({ ok: true, result }),
  (error) => parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }),
);
