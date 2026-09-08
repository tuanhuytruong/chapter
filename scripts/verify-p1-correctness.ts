import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const books = readFileSync(new URL("../src/routes/books.ts", import.meta.url), "utf8");
const reviews = readFileSync(new URL("../src/routes/reviews.ts", import.meta.url), "utf8");

// Mutation ownership must reject malformed IDs and absorb the lookup failure so
// Express 4 never receives a rejected handler promise before a route's try/catch.
assert.match(books, /function isUuid\(value: unknown\)/);
assert.match(books, /if \(!isUuid\(bookId\)\) \{\s*res\.status\(400\)/);
assert.match(books, /try \{\s*const found = await query\("SELECT owner_id FROM books WHERE id=\$1", \[bookId\]\);/);
assert.match(books, /res\.status\(503\)\.json\(\{ error: "DB unavailable", detail: e\.message \}\)/);

// Repair must use the route's book id, not the log id carried by rl.*.
const repairRoute = books.slice(books.indexOf('"/:id/logs/:logId/story-thread/repair"'), books.indexOf('// PATCH /api/books/:id/logs/:logId'));
assert.match(repairRoute, /repairStoryThreadFromLog\(\{ \.\.\.entry, id \},\s*entry\)/);
assert.doesNotMatch(repairRoute, /repairStoryThreadFromLog\(entry,entry\)/);

// A pending reservation is current-round scoped rather than today-scoped, keeps
// its own date/session, and treats a prior empty extraction as recoverable.
const reserve = books.slice(books.indexOf('async function reserveAdvance'), books.indexOf('const activeAdvances'));
assert.match(reserve, /reading_round=\$2 AND \(raw_text IS NULL OR btrim\(raw_text\)=''\)/);
assert.doesNotMatch(reserve, /AND date=\$2 AND raw_text IS NULL/);
assert.match(reserve, /dateStr: pending\[0\]\.date/);

// A stale running AI Reader job may be atomically reclaimed, and old workers
// cannot overwrite a newer lease's terminal state.
const regenerate = books.slice(books.indexOf('// POST /api/books/:id/wiki/regenerate'), books.indexOf('// GET /api/books/:id — single book'));
assert.match(regenerate, /ai_reader_jobs\.status != 'running'\s+OR ai_reader_jobs\.started_at < now\(\) - interval '15 minutes'/);
assert.match(regenerate, /WHERE book_id=\$1 AND status='running' AND started_at=\$3/);
assert.match(regenerate, /\[id, updated \? null : "No readable sessions could be processed\.", claim\.startedAt\]/);

// Retrying an analytical summary replaces only unreturned cards; cards with a
// return response remain historical evidence.
const retry = books.slice(books.indexOf('"/:id/logs/:logId/retry"'), books.indexOf('"/:id/logs/:logId/story-thread/repair"'));
assert.match(retry, /DELETE FROM review_cards rc[\s\S]*NOT EXISTS \(SELECT 1 FROM return_responses rr WHERE rr\.review_card_id=rc\.id\)/);
assert.match(retry, /INSERT INTO review_cards \(book_id,log_id,insight_index,insight,due_date\)/);

// The legacy endpoint now has the same transactional due-occurrence guard as a
// Return, while preserving its response body (the updated card).
const legacy = reviews.slice(reviews.indexOf('reviewsRouter.post("/:id", async'));
assert.match(legacy, /if \(!uuid\(req\.params\.id\)\) return res\.status\(400\)/);
assert.match(legacy, /withTransaction/);
assert.match(legacy, /WHERE rc\.id=\$1 AND b\.owner_id=\$2 AND rc\.due_date <= \$3\s+FOR UPDATE OF rc, b/);
assert.match(legacy, /res\.json\(result\)/);

console.log("P1_CORRECTNESS_FIXTURES_OK");
