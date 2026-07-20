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
const db = newDb();
db.public.registerFunction({
  name: "gen_random_uuid",
  implementation: () => crypto.randomUUID(),
  impure: true,
});
// pg-mem lacks some math funcs used by our progress query
db.public.registerFunction({ name: "round", implementation: (n) => Math.round(n), impure: true });
db.public.registerFunction({ name: "least", implementation: (...args) => Math.min(...args), impure: true });
db.public.registerFunction({ name: "now", implementation: () => new Date(), impure: true });

// 2) Mount the real schema.sql
const schema = readFileSync(resolve(process.cwd(), "src/db/schema.sql"), "utf8");
db.public.query(schema);

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
  assert(book.id, "B7 POST /api/books returns id");
  const bookId = book.id;

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

  // ── B6 idempotency: second advance same day skipped ──
  const adv2 = await fetch(`${base}/api/books/${bookId}/advance`, { method: "POST" });
  const adv2Res = await adv2.json();
  assert(adv2Res.skipped === true, "B6 idempotent: repeat advance skipped");

  // ── B6: all/advance over active books ──
  const all = await fetch(`${base}/api/books/all/advance`, { method: "POST" });
  const allRes = await all.json();
  assert(allRes.advanced === 1, "B6 /all/advance advanced 1 (idempotent, no dup)");

  // ── log history ──
  const log = await (await fetch(`${base}/api/books/${bookId}/log`)).json();
  assert(log.length === 1, "B7 GET /:id/log returns 1 entry");

  // ── today's entry (Phase 3 prep) ──
  const today = await (await fetch(`${base}/api/books/${bookId}/log/today`)).json();
  assert(today.id, "Phase3 GET /:id/log/today returns entry");

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
