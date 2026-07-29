/**
 * Phase 1 integration verification (no external Postgres needed).
 * Uses pg-mem to provide a `pg`-compatible Pool, mounts the real schema.sql,
 * then exercises the REAL extractor + llm parser + advanceBook logic via the
 * actual router code path.
 *
 * Run:  npx tsx scripts/verify-phase1.mjs
 */
import { newDb } from "pg-mem";
import { readFileSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

// 1) Spin up an in-memory Postgres compatible with `pg`
const db = newDb({ autoCreateForeignKeyIndices: true });
db.public.registerFunction({
  name: "gen_random_uuid",
  implementation: () => crypto.randomUUID(),
  impure: true,
});
// pg-mem lacks some math funcs used by our progress query
db.public.registerFunction({ name: "round", implementation: (n) => Math.round(n), impure: true });
db.public.registerFunction({ name: "least", implementation: (...args) => Math.min(...args), impure: true });
db.public.registerFunction({ name: "now", implementation: () => new Date(), impure: true });

// 2) Mount the real schema.sql (test uses default `public` schema for pg-mem;
//    the `chapter.` prefix + CREATE SCHEMA are stripped so searches work without
//    a persistent search_path across pg-mem's per-query connections).
let schema = readFileSync(resolve(process.cwd(), "src/db/schema.sql"), "utf8");
schema = schema
  .replace(/CREATE SCHEMA IF NOT EXISTS chapter;/g, "")
  .replace(/chapter\./g, "")
  // pg-mem does not implement PostgreSQL's ALTER TABLE constraint lifecycle.
  // Strip each ALTER statement independently; a non-greedy multi-statement
  // expression can accidentally swallow later CREATE TABLE declarations.
  .replace(/ALTER TABLE[^;]+;/g, "")
  .replace(/DROP INDEX IF EXISTS[^;]+;/g, "")
  .replace(/CREATE INDEX IF NOT EXISTS[^;]+;/g, "")
  .replace(/UPDATE book_wiki[^;]+;/g, "")
  // The Podcast table is covered by its dedicated verifier; omit it here so
  // pg-mem's simplified ALTER handling cannot disturb its reading_log FK.
  .replace(/CREATE TABLE IF NOT EXISTS podcasts \([\s\S]*?\);/g, "")
  .replace(/,?\s*UNIQUE \(book_id, date\)\s*(?:--[^\n]*)?/g, "");
for (const statement of schema.replace(/--[^\n]*/g, "").replace(/COLLATE "default"/g, "").split(";").map((value) => value.trim()).filter(Boolean)) {
  // pg-mem intentionally does not cover Postgres's idempotent constraint and
  // index DDL; the fresh-table CREATE statements above cover this verifier.
  if (/^ALTER TABLE/i.test(statement) || /^CREATE INDEX/i.test(statement) || /^DROP INDEX/i.test(statement)) continue;
  db.public.query(statement);
}
// Columns normally added by idempotent production migrations.
db.public.query("ALTER TABLE books ADD COLUMN owner_id UUID REFERENCES users(id); ALTER TABLE books ADD COLUMN queue_order INT; ALTER TABLE reading_log ADD COLUMN notes TEXT; ALTER TABLE reading_log ADD COLUMN chapter_title TEXT; ALTER TABLE reading_log ADD COLUMN session INT NOT NULL DEFAULT 1;");
db.public.query("ALTER TABLE book_wiki ADD COLUMN schema_version SMALLINT NOT NULL DEFAULT 1; ALTER TABLE book_wiki ADD COLUMN output_language TEXT NOT NULL DEFAULT 'en'; ALTER TABLE book_wiki ADD COLUMN book_so_far TEXT NOT NULL DEFAULT ''; ALTER TABLE book_wiki ADD COLUMN current_position JSONB NOT NULL DEFAULT '{}'; ALTER TABLE book_wiki ADD COLUMN narrative_arc JSONB NOT NULL DEFAULT '[]'; ALTER TABLE book_wiki ADD COLUMN carry_forward_insights JSONB NOT NULL DEFAULT '[]'; ALTER TABLE book_wiki ADD COLUMN reading_path JSONB NOT NULL DEFAULT '[]'; ALTER TABLE book_wiki ADD COLUMN thread_map JSONB NOT NULL DEFAULT '[]'; ALTER TABLE book_wiki ADD COLUMN entity_map JSONB NOT NULL DEFAULT '[]'; ALTER TABLE book_wiki ADD COLUMN connections JSONB NOT NULL DEFAULT '[]'; ALTER TABLE book_wiki ADD COLUMN current_reading_state JSONB NOT NULL DEFAULT '{}'; ALTER TABLE book_wiki ADD COLUMN next_session_context TEXT NOT NULL DEFAULT '';");

// 4) Expose a pg-compatible Pool to our db layer
const PgPool = db.adapters.createPg().Pool;
const pool = new PgPool();

// 4) Inject into our db module BEFORE importing routes
import { setPool } from "../src/db.ts";
setPool(pool);

// 5) Import the REAL router + extractor + llm
import { booksRouter } from "../src/routes/books.ts";
import express from "express";

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const id = req.header("x-verifier-user") || "00000000-0000-4000-8000-000000000001";
  req.session = { user: { id, username: id.endsWith("2") ? "other" : "verifier", displayName: "Verifier" } };
  next();
});
app.use("/api/books", booksRouter);

const server = app.listen(0);
await new Promise((r) => server.on("listening", r));
const port = server.address().port;
const base = `http://localhost:${port}`;

const PDF = "/opt/hermes/docs/hermes-kanban-v1-spec.pdf";

function assert(cond, msg) {
  if (!cond) {
    console.error("❌ FAIL:", msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log("✅", msg);
}

async function main() {
  await pool.query("INSERT INTO users (id, username, password_hash, display_name) VALUES ($1,$2,$3,$4)", ["00000000-0000-4000-8000-000000000001", "verifier", "x", "Verifier"]);
  await pool.query("INSERT INTO uploaded_files (file_path, owner_id) VALUES ($1,$2)", [PDF, "00000000-0000-4000-8000-000000000001"]);
  // ── B7: register a book ──
  const reg = await fetch(`${base}/api/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Hermes Kanban Spec",
      author: "Hermes",
      file_path: PDF,
      file_type: "pdf",
      total_pages: 12,
      daily_pages: 3,
    }),
  });
  const book = await reg.json();
  if (!book.id) console.error("registration response:", reg.status, book);
  assert(book.id, "B7 POST /api/books returns id");
  const bookId = book.id;
  await pool.query("INSERT INTO users (id, username, password_hash, display_name) VALUES ($1,$2,$3,$4)", ["00000000-0000-4000-8000-000000000002", "other", "x", "Other"]);

  // Cross-user contract: a known non-owner upload cannot be claimed, while
  // All Readers can see the saved reading history in read-only mode.
  const foreignCreate = await fetch(`${base}/api/books`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-verifier-user": "00000000-0000-4000-8000-000000000002" },
    body: JSON.stringify({ title: "Stolen", file_path: PDF, file_type: "pdf" }),
  });
  assert(foreignCreate.status === 403, "upload path cannot be claimed by another user");

  // ── B7: GET list ──
  const list = await (await fetch(`${base}/api/books`)).json();
  assert(Array.isArray(list) && list.length === 1, "B7 GET /api/books lists 1 book");

  // ── B3 + B5 + B8 + B9: advance ──
  const adv = await fetch(`${base}/api/books/${bookId}/advance`, { method: "POST" });
  const advRes = await adv.json();
  assert(advRes.log && advRes.log.summary, "B5/B9 advance wrote a summary");
  assert(Array.isArray(advRes.log.key_insights) && advRes.log.key_insights.length > 0,
    "B8 parser produced key_insights: " + JSON.stringify(advRes.log.key_insights));
  assert(advRes.pageStart === 1 && advRes.pageEnd === 3, "B3 extract range pages 1-3");
  console.log("   summary:", advRes.log.summary.slice(0, 90) + "...");
  console.log("   insights:", advRes.log.key_insights);

  // ── Multi-session: a second intentional advance continues after the first ──
  const adv2 = await fetch(`${base}/api/books/${bookId}/advance`, { method: "POST" });
  const adv2Res = await adv2.json();
  assert(adv2Res.pageStart === 4 && adv2Res.session === 2, "multi-session advance continues at page 4");

  // ── B6: all/advance remains scoped to the authenticated owner ──
  const all = await fetch(`${base}/api/books/all/advance`, { method: "POST" });
  const allRes = await all.json();
  assert(allRes.advanced === 1, "B6 /all/advance processes the owner's active book");

  // ── log history ──
  const log = await (await fetch(`${base}/api/books/${bookId}/log`)).json();
  assert(log.length === 3, "B7 GET /:id/log returns all saved sessions");
  const foreignLogResponse = await fetch(`${base}/api/books/${bookId}/log`, { headers: { "x-verifier-user": "00000000-0000-4000-8000-000000000002" } });
  const foreignLog = await foreignLogResponse.json();
  assert(foreignLogResponse.status === 200 && foreignLog.length === 3 && foreignLog[0].summary, "All Readers can view another user's saved sessions read-only");

  // ── today's entry (Phase 3 prep) ──
  const today = await (await fetch(`${base}/api/books/${bookId}/log/today`)).json();
  assert(Array.isArray(today) && today.length === 3, "Phase3 GET /:id/log/today returns sessions");

  // ── PATCH status ──
  const patch = await fetch(`${base}/api/books/${bookId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "paused" }),
  });
  const patched = await patch.json();
  assert(patched.status === "paused", "B7 PATCH status works");

  console.log("\n🎉 Phase 1 integration verification PASSED");
  server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
