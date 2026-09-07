import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newDb } from "pg-mem";
import {
  RETURN_TODAY_LIMIT,
  RETURNS_PAGE_LIMIT,
  isReturnOutcome,
  normalizeReturnReflection,
  returnOutcome,
} from "../src/review.js";

const migration = readFileSync(new URL("../migrations/2026-09-07_returns_response_history.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf8");
const db = readFileSync(new URL("../src/db.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/routes/reviews.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");
const reviewPage = readFileSync(new URL("../src/pages/Review.tsx", import.meta.url), "utf8");
const reviewHeader = readFileSync(new URL("../src/components/review/ReviewHeader.tsx", import.meta.url), "utf8");
const returnCard = readFileSync(new URL("../src/components/review/ReturnCard.tsx", import.meta.url), "utf8");
const emptyState = readFileSync(new URL("../src/components/review/ReviewEmptyState.tsx", import.meta.url), "utf8");
const appShell = readFileSync(new URL("../src/components/AppShell.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const todayPage = readFileSync(new URL("../src/pages/Today.tsx", import.meta.url), "utf8");
const analytics = readFileSync(new URL("../src/analytics.ts", import.meta.url), "utf8");

// Domain fixtures: outcomes, reflection normalization, quiet scheduling, and fixed server limits.
for (const outcome of ["still_true", "changed", "revisit", "dismissed"]) assert.equal(isReturnOutcome(outcome), true);
for (const invalid of [undefined, null, "remembered", true, {}]) assert.equal(isReturnOutcome(invalid), false);
assert.equal(normalizeReturnReflection(undefined), null);
assert.equal(normalizeReturnReflection("   "), null);
assert.equal(normalizeReturnReflection("  Still useful.  "), "Still useful.");
assert.equal(normalizeReturnReflection("x".repeat(500)), "x".repeat(500));
assert.throws(() => normalizeReturnReflection("x".repeat(501)), /500/);
assert.throws(() => normalizeReturnReflection(4), /string/);
assert.deepEqual(returnOutcome(3, "still_true", "2026-09-07"), { intervalDays: 7, dueDate: "2026-09-14", repetitions: "advance" });
assert.deepEqual(returnOutcome(3, "changed", "2026-09-07"), { intervalDays: 7, dueDate: "2026-09-14", repetitions: "advance" });
assert.deepEqual(returnOutcome(30, "revisit", "2026-09-07"), { intervalDays: 1, dueDate: "2026-09-08", repetitions: "reset" });
assert.deepEqual(returnOutcome(7, "dismissed", "2026-09-07"), { intervalDays: 7, dueDate: "2026-09-14", repetitions: "preserve" });
assert.equal(RETURN_TODAY_LIMIT, 1);
assert.equal(RETURNS_PAGE_LIMIT, 3);

// Migration is intentionally exact, safe to run manually before deployment, and does not mutate review_cards.
const approvedMigration = `BEGIN;

CREATE TABLE IF NOT EXISTS chapter.return_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_card_id UUID NOT NULL REFERENCES chapter.review_cards(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('still_true', 'changed', 'revisit', 'dismissed')),
  reflection TEXT,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT return_responses_reflection_limit
    CHECK (reflection IS NULL OR char_length(reflection) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_return_responses_owner_card_time
  ON chapter.return_responses (owner_id, review_card_id, responded_at DESC);

COMMIT;
`;
assert.equal(migration, approvedMigration, "manual migration remains the approved safe SQL");
assert.match(schema, /CREATE TABLE IF NOT EXISTS chapter\.return_responses/);
assert.match(schema, /idx_return_responses_owner_card_time/);
assert.match(db, /"return_responses"/);

// Route/API fixtures: exact endpoint ordering, owner isolation, active-only reads, server-only limits,
// latest owner-only response metadata, row lock, paused guard, append-only insert, and atomic schedule update.
const returnsRoute = route.indexOf('reviewsRouter.get("/returns"');
const dueCountRoute = route.indexOf('reviewsRouter.get("/due/count"');
const returnPostRoute = route.indexOf('reviewsRouter.post("/:id/return"');
const oldPostRoute = route.indexOf('reviewsRouter.post("/:id"');
assert.ok(returnsRoute >= 0 && dueCountRoute >= 0 && returnPostRoute >= 0 && oldPostRoute >= 0);
assert.ok(returnsRoute < dueCountRoute && returnPostRoute < oldPostRoute, "literal Returns routes precede legacy parameterized route");
const readBlock = route.slice(returnsRoute, dueCountRoute);
assert.match(readBlock, /surface must be today or page/);
assert.match(readBlock, /returnSurfaceLimits\[surface as ReturnSurface\]/);
assert.match(readBlock, /JOIN books b ON b\.id=rc\.book_id/);
assert.match(readBlock, /JOIN reading_log rl ON rl\.id=rc\.log_id/);
assert.match(readBlock, /b\.owner_id=\$1 AND b\.status='active' AND rc\.due_date <= \$2/);
assert.match(readBlock, /WHERE rr\.review_card_id=rc\.id AND rr\.owner_id=\$1/);
assert.match(readBlock, /ORDER BY rr\.responded_at DESC, rr\.id DESC/);
assert.match(readBlock, /ORDER BY rc\.due_date ASC, rc\.last_reviewed_at NULLS FIRST, rc\.created_at ASC/);
assert.match(readBlock, /LIMIT \$\{limit\}/);
assert.doesNotMatch(readBlock, /req\.query\.limit/);
const writeBlock = route.slice(returnPostRoute, oldPostRoute);
assert.match(writeBlock, /withTransaction/);
assert.match(writeBlock, /WHERE rc\.id=\$1 AND b\.owner_id=\$2 AND rc\.due_date <= \$3\s+FOR UPDATE OF rc, b/);
assert.match(writeBlock, /\[req\.params\.id, userFrom\(req\)\.id, today\(\)\]/);
assert.match(writeBlock, /card\.book_status !== "active"/);
assert.match(writeBlock, /return res\.status\(409\)/);
assert.match(writeBlock, /INSERT INTO return_responses \(review_card_id, owner_id, outcome, reflection\)/);
assert.match(writeBlock, /UPDATE review_cards/);
assert.match(writeBlock, /interval_days=\$1, repetitions=\$2, due_date=\$3, last_reviewed_at=now\(\)/);
assert.match(writeBlock, /return res\.status\(404\)/);
assert.match(api, /export interface ReturnCard/);
assert.match(api, /export interface ReturnResponse/);
assert.match(api, /getReturns: \(surface: "today" \| "page"\)/);
assert.match(api, /respondToReturn: \(id: string, payload: \{ outcome: ReturnOutcome; reflection\?: string \}\)/);

// Returns UI fixture: keep /review as the compatible route while presenting a calm reflection flow.
assert.match(app, /<Route path="\/review"/);
assert.match(appShell, /aria-label="Returns"/);
assert.match(appShell, />Returns<\/span>/);
assert.doesNotMatch(appShell, /dueReviewCount|getDueReviewCount|REVIEWS_CHANGED_EVENT|Review, \$\{/);
assert.match(reviewHeader, />Returns</);
assert.match(reviewHeader, /You do not need to remember everything\. Just return to what is worth keeping\./);
assert.match(reviewPage, /api\.getReturns\("page"\)/);
assert.match(reviewPage, /api\.respondToReturn\(card\.id/);
assert.match(reviewPage, /navigate\(`\/books\/\$\{card\.book_id\}`\)/);
assert.doesNotMatch(reviewPage, /getDueReviews|getDueReviewBooks|submitReview|revealed|onKeyDown|focused|flow|GuideCard/);
assert.match(reviewPage, /captureAnalyticsEvent\("return_shown", \{ surface: "page" \}\)/);
assert.match(reviewPage, /captureAnalyticsEvent\("return_responded", \{ surface: "page", outcome \}\)/);
assert.match(reviewPage, /captureAnalyticsEvent\("return_source_opened", \{ surface: "page" \}\)/);
assert.match(returnCard, /A source insight/);
assert.match(returnCard, /Source session/);
assert.match(returnCard, /Open source book/);
assert.match(returnCard, /Still true/);
assert.match(returnCard, />Changed</);
assert.match(returnCard, />Revisit</);
assert.match(returnCard, /maxLength=\{500\}/);
assert.match(returnCard, /Optional, up to 500 characters\./);
assert.match(returnCard, /Save thought/);
assert.doesNotMatch(returnCard, /Reveal insight|Need another pass|This stays with me|onKeyDown/);
assert.match(emptyState, /Nothing asking for your attention today/);
assert.match(emptyState, /When an idea has had time to settle, it may return here\./);
assert.doesNotMatch(emptyState, /due|revisited today|View all/);

// Today is a single, quiet continuation-adjacent surface: it has no review summary or empty placeholder.
assert.match(todayPage, /api\.getReturns\("today"\)/);
assert.match(todayPage, /const card = cards\[0\] \|\| null/);
assert.match(todayPage, /setReturnCard\(null\)/);
assert.match(todayPage, /api\.respondToReturn\(returnCard\.id/);
assert.match(todayPage, /if \(outcome === "revisit"\) navigate\(`\/books\/\$\{bookId\}`\)/);
assert.doesNotMatch(todayPage, /aria-label="Review"|Open review|Reviews are clear|due_reviews/);
const primaryTodayCta = todayPage.indexOf("Read next session");
const todayReturnSurface = todayPage.indexOf("{returnCard && <section aria-label=\"Return\"");
assert.ok(primaryTodayCta >= 0 && todayReturnSurface > primaryTodayCta, "Today Return is rendered after the primary Continue reading CTA");

// Returns events use only an anonymous surface/outcome vocabulary; never send reader or source data.
for (const event of ["return_shown", "return_responded", "return_source_opened"]) assert.match(analytics, new RegExp(`\\| "${event}"`));
for (const source of [todayPage, reviewPage]) {
  const returnCalls = source.match(/captureAnalyticsEvent\("return_[^"]+", \{[^}]*\}\)/g) || [];
  assert.ok(returnCalls.length > 0, "Returns surfaces emit explicit analytics events");
  for (const call of returnCalls) {
    assert.doesNotMatch(call, /\b(id|book_id|bookId|log_id|logId|title|author|insight|text|note|reflection|url|URL|page|source)\s*:/);
    assert.match(call, /surface: "(today|page)"/);
  }
}
assert.match(todayPage, /captureAnalyticsEvent\("return_shown", \{ surface: "today" \}\)/);
assert.match(todayPage, /captureAnalyticsEvent\("return_responded", \{ surface: "today", outcome \}\)/);
assert.match(todayPage, /captureAnalyticsEvent\("return_source_opened", \{ surface: "today" \}\)/);

// pg-mem integration fixture: the persistence shape keeps response history owner-scoped,
// excludes paused books, and supports one append-only response per action.
const mem = newDb();
const pg = mem.adapters.createPg();
const client = new pg.Client();
await client.connect();
await client.query(`
  CREATE TABLE books (id text PRIMARY KEY, owner_id text NOT NULL, status text NOT NULL);
  CREATE TABLE review_cards (id text PRIMARY KEY, book_id text NOT NULL, due_date date NOT NULL, interval_days int NOT NULL, repetitions int NOT NULL DEFAULT 0);
  CREATE TABLE return_responses (id text PRIMARY KEY, review_card_id text NOT NULL, owner_id text NOT NULL, outcome text NOT NULL, reflection text, responded_at timestamptz NOT NULL DEFAULT now());
  INSERT INTO books VALUES ('active-mine', 'reader-a', 'active'), ('paused-mine', 'reader-a', 'paused'), ('active-other', 'reader-b', 'active');
  INSERT INTO review_cards VALUES ('mine-card', 'active-mine', '2026-09-07', 3, 1), ('paused-card', 'paused-mine', '2026-09-07', 3, 1), ('other-card', 'active-other', '2026-09-07', 3, 1);
`);
const eligible = await client.query(`
  SELECT rc.id FROM review_cards rc JOIN books b ON b.id=rc.book_id
  WHERE b.owner_id=$1 AND b.status='active' AND rc.due_date <= $2 ORDER BY rc.id
`, ["reader-a", "2026-09-07"]);
assert.deepEqual(eligible.rows.map((row: { id: string }) => row.id), ["mine-card"]);
await client.query("INSERT INTO return_responses (id, review_card_id, owner_id, outcome, reflection) VALUES ($1, $2, $3, $4, $5)", ["response-1", "mine-card", "reader-a", "changed", "one line"]);
await client.query("INSERT INTO return_responses (id, review_card_id, owner_id, outcome) VALUES ($1, $2, $3, $4)", ["response-2", "mine-card", "reader-a", "still_true"]);
const history = await client.query("SELECT outcome FROM return_responses WHERE review_card_id=$1 AND owner_id=$2 ORDER BY id", ["mine-card", "reader-a"]);
assert.deepEqual(history.rows.map((row: { outcome: string }) => row.outcome), ["changed", "still_true"]);
const crossOwnerHistory = await client.query("SELECT id FROM return_responses WHERE review_card_id=$1 AND owner_id=$2", ["mine-card", "reader-b"]);
assert.equal(crossOwnerHistory.rowCount, 0);
// A consumed occurrence is no longer eligible, so a retry cannot create a
// second response or advance its schedule again.
await client.query("UPDATE review_cards SET due_date=$1 WHERE id=$2", ["2026-09-14", "mine-card"]);
const retryEligible = await client.query(`
  SELECT rc.id FROM review_cards rc JOIN books b ON b.id=rc.book_id
  WHERE rc.id=$1 AND b.owner_id=$2 AND rc.due_date <= $3
`, ["mine-card", "reader-a", "2026-09-07"]);
assert.equal(retryEligible.rowCount, 0, "a rescheduled Return occurrence cannot be consumed twice");
await client.end();

console.log("RETURNS_FIXTURES_OK");
