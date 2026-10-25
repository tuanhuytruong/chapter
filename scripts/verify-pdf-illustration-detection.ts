import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { extractPdfRange, meaningfulPdfPagesForRange } from "../src/extractor.ts";

const bundled = await readFile(resolve("node_modules/pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js"), "utf8");
for (const [name, value] of Object.entries({
  save: 10,
  restore: 11,
  transform: 12,
  paintImageMaskXObject: 83,
  paintImageXObject: 85,
  paintInlineImageXObject: 86,
})) {
  assert.match(bundled, new RegExp(`${name}:\\s*${value}\\b`), `${name} must be verified against bundled PDF.js, not guessed`);
}

const fixtures = resolve("scripts/fixtures/pdf-illustrations");
const cases = [
  ["text-only.pdf", false, 0],
  ["large-raster.pdf", true, 1],
  ["tiny-logo.pdf", false, 1],
] as const;
const results: Array<{ fixture: string; meaningful: boolean; imageCount: number }> = [];
for (const [fixture, expectedMeaningful, expectedImageCount] of cases) {
  const extracted = await extractPdfRange(resolve(fixtures, fixture), 1, 1);
  assert.equal(extracted.totalUnits, 1, `${fixture} must have one page`);
  assert.equal(extracted.pageVisuals?.length, 1, `${fixture} must return visual metadata`);
  const visual = extracted.pageVisuals![0];
  assert.equal(visual.meaningful, expectedMeaningful, `${fixture} meaningful result`);
  assert.equal(visual.imageCount, expectedImageCount, `${fixture} image count`);
  results.push({ fixture, meaningful: visual.meaningful, imageCount: visual.imageCount });
}

assert.deepEqual(
  meaningfulPdfPagesForRange([
    { page: 4, meaningful: true, imageCount: 1 },
    { page: 2, meaningful: true, imageCount: 1 },
    { page: 2, meaningful: true, imageCount: 1 },
    { page: 3, meaningful: false, imageCount: 1 },
  ], 2, 3),
  [2],
);
console.log("PDF_ILLUSTRATION_AREA_DETECTOR_VERIFIED", JSON.stringify({
  policy: { singleImageAreaRatio: 0.10, cumulativeImageAreaRatio: 0.15 },
  ops: [10, 11, 12, 83, 85, 86],
  results,
}));
