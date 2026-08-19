import { parentPort, workerData } from "node:worker_threads";
import { readFile } from "node:fs/promises";
import { stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { maxFileBytes: MAX_FILE_BYTES, maxPages: MAX_PAGES, maxCharsPerPage: MAX_CHARS_PER_PAGE, maxTotalChars: MAX_TOTAL_CHARS } = workerData.limits;

function fail(message) { throw new Error(message); }

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
        const content = await pageData.getTextContent();
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
    return { text: hi >= lo ? pages.slice(lo - 1, hi).join("\n\n") : "", totalUnits, pages };
  } finally {
    console.warn = originalWarn;
  }
}

extract().then(
  (result) => parentPort.postMessage({ ok: true, result }),
  (error) => parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }),
);
