import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [routes, renderer, worker, schema, ui] = await Promise.all([
  readFile("src/routes/books.ts", "utf8"), readFile("src/pdfIllustrationRenderer.ts", "utf8"),
  readFile("src/pdfExtractorWorker.mjs", "utf8"), readFile("src/db/schema.sql", "utf8"), readFile("src/components/DaySummary.tsx", "utf8"),
]);
assert.match(worker, /paintImageMaskXObject:\s*83.*paintImageXObject:\s*85.*paintInlineImageXObject:\s*86/s);
assert.match(schema, /illustration_pages INT\[\] NOT NULL DEFAULT '\{\}'/);
assert.match(schema, /reading_log_illustrations/);
assert.match(renderer, /pdftoppm/);
assert.match(renderer, /timeoutMs:\s*12_000/);
assert.match(renderer, /maxPixels:\s*2_400_000/);
assert.match(renderer, /maxBytes:\s*4_000_000/);
assert.match(renderer, /finally|catch \(error\).*cleanup/s);
assert.match(routes, /illustration-page\/:page/);
assert.match(routes, /illustrations\/:page\/analyze/);
assert.match(routes, /b\.status='active'/);
assert.doesNotMatch(routes.slice(routes.indexOf("illustration-page"), routes.indexOf("// GET /api\/books\/:id\/reading-lens")), /requireEntitlement/);
assert.match(routes, /activeIllustrationAnalyses/);
assert.match(ui, /Analyze illustration/);
assert.match(ui, /canEdit && fileType === "pdf"/);
console.log("PDF_ILLUSTRATION_CONTRACT_OK");
