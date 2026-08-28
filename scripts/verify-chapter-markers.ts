import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../src/routes/books.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf8");
const detail = readFileSync(new URL("../src/pages/BookDetail.tsx", import.meta.url), "utf8");
const day = readFileSync(new URL("../src/components/DaySummary.tsx", import.meta.url), "utf8");

for (const token of ["CREATE TABLE IF NOT EXISTS chapter.reading_markers", "owner_id UUID NOT NULL", "reading_round INT NOT NULL", "log_id UUID NOT NULL", "kind IN ('idea', 'question', 'quote', 'return_to')", "idx_reading_markers_book_owner_round_created"]) assert.match(schema, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
for (const token of ["booksRouter.get(\"/:id/markers\"", "booksRouter.post(\"/:id/markers\"", "booksRouter.delete(\"/:id/markers/:markerId\"", "m.owner_id=$2", "book.status !== \"active\"", "log.reading_round !== book.current_reading_round", "page_position < log.page_start"]) assert.ok(route.includes(token), `route contract missing: ${token}`);
assert.match(route, /ON CONFLICT \(book_id, owner_id, log_id, page_position, kind, note\)/);
assert.match(detail, /<ReadingMarkers markers=\{markers\}/);
assert.match(detail, /onMarkerCreated=\{refreshMarkers\}/);
assert.match(day, /aria-label="Mark this session"/);
assert.match(day, /Optional private note/);
console.log("CHAPTER_MARKER_CONTRACT_FIXTURES_OK");
