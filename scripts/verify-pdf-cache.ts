import assert from "node:assert/strict";
import { ensurePdfReadingUnits, isCompletePdfCache, type PdfCacheDependencies } from "../src/routes/books.ts";

assert.equal(isCompletePdfCache({ count: 3, min_index: 1, max_index: 3 }, 3), true);
assert.equal(isCompletePdfCache({ count: 2, min_index: 1, max_index: 3 }, 3), false);
assert.equal(isCompletePdfCache({ count: 2, min_index: 1, max_index: 2 }, 3), false);
assert.equal(isCompletePdfCache({ count: 3, min_index: 2, max_index: 4 }, 3), false);
assert.equal(isCompletePdfCache({ count: 0, min_index: null, max_index: null }, 0), false);

type Row = { unit_index: number; raw_text: string };
let rows: Row[] = [];
let totalPages = 4;
let extracts = 0;
let lockTail = Promise.resolve();
const makeClient = (failInsert = false) => {
  let snapshot: Row[] = [];
  let release: (() => void) | undefined;
  return { query: async (sql: string, params: any[] = []) => {
    if (sql.includes("pg_advisory_lock")) {
      const previous = lockTail;
      lockTail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
    } else if (sql.includes("pg_advisory_unlock")) release?.();
    else if (sql.startsWith("SELECT count")) return { rows: [{ count: rows.length, min_index: rows.length ? Math.min(...rows.map(r => r.unit_index)) : null, max_index: rows.length ? Math.max(...rows.map(r => r.unit_index)) : null }] };
    else if (sql === "BEGIN") snapshot = rows.map(r => ({ ...r }));
    else if (sql.startsWith("DELETE")) rows = [];
    else if (sql.startsWith("INSERT")) {
      if (failInsert) throw new Error("forced insert failure");
      for (let i = 0; i < params.length; i += 8) rows.push({ unit_index: params[i + 1], raw_text: params[i + 5] });
    } else if (sql.startsWith("UPDATE books")) totalPages = params[0];
    else if (sql === "ROLLBACK") rows = snapshot;
    return { rows: [] };
  }};
};
const deps = (failInsert = false): PdfCacheDependencies => ({
  query: async () => ({ rows: [{ count: rows.length, min_index: rows.length ? Math.min(...rows.map(r => r.unit_index)) : null, max_index: rows.length ? Math.max(...rows.map(r => r.unit_index)) : null }] } as any),
  withClient: async (fn: any) => fn(makeClient(failInsert)),
  extractRange: async () => { extracts++; await new Promise(r => setTimeout(r, 10)); return { text: "first\n\n\n\nthird", totalUnits: 4, pages: ["first", "", "before\u0000after", "third"] }; },
});
const book = { id: "book-1", file_path: "/tmp/book.pdf", total_pages: 4 };
rows = [{ unit_index: 1, raw_text: "stale" }, { unit_index: 3, raw_text: "stale" }];
await Promise.all([ensurePdfReadingUnits(book, deps()), ensurePdfReadingUnits(book, deps())]);
assert.equal(extracts, 1, "advisory-lock recheck prevents duplicate parsing");
assert.deepEqual(rows, [{ unit_index: 1, raw_text: "first" }, { unit_index: 2, raw_text: "" }, { unit_index: 3, raw_text: "beforeafter" }, { unit_index: 4, raw_text: "third" }], "empty pages remain ordered and NUL bytes are removed before caching");
assert.equal(rows.some((row) => row.raw_text.includes("\u0000")), false, "cached text contains no PostgreSQL-invalid NUL bytes");
assert.equal(totalPages, 4);
await ensurePdfReadingUnits(book, deps());
assert.equal(extracts, 1, "complete cache is a cache hit");
rows = [{ unit_index: 1, raw_text: "old" }, { unit_index: 2, raw_text: "old" }];
await assert.rejects(ensurePdfReadingUnits(book, deps(true)), /forced insert failure/);
assert.deepEqual(rows, [{ unit_index: 1, raw_text: "old" }, { unit_index: 2, raw_text: "old" }], "failed replacement rolls back old partial cache");
console.log("PDF_CACHE_FIXTURES_OK", JSON.stringify({ extracts, rowsAfterRollback: rows.length, emptyPagePreserved: true, ordered: true }));
