import assert from "node:assert/strict";
import { resolve } from "node:path";
import { extractPdfRange } from "../src/extractor.ts";

const fixture = resolve("node_modules/pdf-parse/test/data/01-valid.pdf");
const all = await extractPdfRange(fixture, 1, 999);
assert.ok(all.totalUnits > 0);
assert.ok(all.text.length > 0);
const first = await extractPdfRange(fixture, 1, 1);
assert.equal(first.totalUnits, all.totalUnits);
assert.ok(first.text.length > 0);
console.log("pdf extractor verifier: ok", JSON.stringify({ totalUnits: all.totalUnits, allChars: all.text.length, firstPageChars: first.text.length }));
