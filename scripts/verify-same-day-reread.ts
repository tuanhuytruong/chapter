import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/routes/books.ts", import.meta.url), "utf8");
const start = source.indexOf("async function reserveAdvance");
const end = source.indexOf("async function advanceBookNow", start);
assert.ok(start >= 0 && end > start, "advance reservation implementation must exist");
const reservation = source.slice(start, end);

// A pending session must resume before any new session number is allocated.
assert.ok(
  reservation.indexOf("const pending =") < reservation.indexOf("MAX(session)"),
  "pending same-round sessions must resume unchanged",
);
// Pages remain local to the selected round; only the durable session ordinal is global per day.
assert.match(
  reservation,
  /WHERE book_id=\$1 AND reading_round=\$3 AND date=\$2/,
  "page ranges must remain scoped to the active reading round",
);
assert.match(
  reservation,
  /SELECT COALESCE\(MAX\(session\), 0\)::int AS last_session\s+FROM reading_log WHERE book_id=\$1 AND date=\$2/,
  "new sessions must use the next ordinal across all same-day rounds",
);
assert.match(
  reservation,
  /const session = Number\(daySessions\[0\]\?\.last_session \|\| 0\) \+ 1;/,
  "same-day ordinal must increment from the durable maximum",
);
assert.match(
  reservation,
  /SELECT \* FROM books WHERE id=\$1 FOR UPDATE/,
  "book lock must serialize competing session allocation",
);
assert.match(
  reservation,
  /INSERT INTO reading_log \(book_id,reading_round,date,session/,
  "new log must preserve both round and session",
);
console.log("SAME_DAY_REREAD_FIXTURES_OK");
