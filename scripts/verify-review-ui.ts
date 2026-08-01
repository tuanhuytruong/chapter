import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reviewOutcome } from "../src/review.js";

const reviewPage = readFileSync(new URL("../src/pages/Review.tsx", import.meta.url), "utf8");
const recallCard = readFileSync(new URL("../src/components/review/RecallCard.tsx", import.meta.url), "utf8");

assert.deepEqual(reviewOutcome(1, false, "2026-07-24"), { intervalDays: 1, dueDate: "2026-07-25" });
assert.deepEqual(reviewOutcome(1, true, "2026-07-24"), { intervalDays: 3, dueDate: "2026-07-27" });
assert.deepEqual(reviewOutcome(30, true, "2026-07-24"), { intervalDays: 30, dueDate: "2026-08-23" });

const submitSuccess = reviewPage.slice(reviewPage.indexOf("await api.submitReview"), reviewPage.indexOf("} catch", reviewPage.indexOf("await api.submitReview")));
assert.ok(submitSuccess.includes("notifyReviewsChanged()"), "notifies the shell after a successful review submission");
assert.ok(submitSuccess.indexOf("notifyReviewsChanged()") > submitSuccess.indexOf("await api.submitReview"), "notification follows API success");
assert.match(reviewPage, /cards\[2\] && <div aria-hidden="true"/);
assert.match(reviewPage, /cards\[1\] && <div aria-hidden="true"/);
assert.match(reviewPage, /<div className="relative isolate">/);
assert.match(recallCard, /<section className="relative z-10 /);
assert.match(recallCard, /aria-hidden="true" className="pointer-events-none [^"]*line-clamp-3 max-h-16 select-none overflow-hidden/);
assert.match(recallCard, /<InsightText text=\{card\.insight\} \/>/);
assert.match(recallCard, /<div className="relative overflow-hidden py-9 text-center sm:py-12">/);
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
assert.match(app, /dueReviewCount !== null && dueReviewCount > 0 && <span aria-hidden="true"/);
assert.match(app, /aria-label=\{dueReviewCount === null \? "Review" : `Review, \$\{dueReviewCount\} due`\}/);
const today = readFileSync(new URL("../src/pages/Today.tsx", import.meta.url), "utf8");
assert.match(today, /dashboard\.due_reviews > 0 && reviewCards\.length/);
assert.match(today, /reviewCards\.slice\(0, 3\)/);
assert.match(today, /From \{reviewCards\[0\]\.title\} — keep it close\./);
assert.match(today, /dashboard\.due_reviews > 0 \? `\$\{dashboard\.due_reviews\} insight/);
assert.doesNotMatch(today, /Your next ideas will appear here/);

console.log("review UI scheduling and accessibility contracts passed");
