import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../src/routes/reviews.ts", import.meta.url), "utf8");
const review = readFileSync(new URL("../src/review.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");

const countRoute = route.indexOf('reviewsRouter.get("/due/count"');
const dueRoute = route.indexOf('reviewsRouter.get("/due"');
const parameterRoute = route.indexOf('reviewsRouter.post("/:id"');
assert.ok(countRoute >= 0, "exact due-count route is registered");
assert.ok(countRoute < dueRoute && dueRoute < parameterRoute, "due routes precede the parameterized route");

const countBlock = route.slice(countRoute, dueRoute);
assert.match(countBlock, /SELECT COUNT\(\*\)::int AS count/);
assert.match(countBlock, /JOIN books b ON b\.id=rc\.book_id/);
assert.match(countBlock, /b\.owner_id=\$1 AND rc\.due_date <= \$2/);
assert.doesNotMatch(countBlock, /LIMIT\s+\d+/);
assert.match(countBlock, /\[userFrom\(req\)\.id, today\(\)\]/);

const dueBlock = route.slice(dueRoute, parameterRoute);
assert.match(dueBlock, /b\.cover_url AS cover_url/);
assert.match(dueBlock, /LIMIT 50/);
assert.match(review, /cover_url: string \| null;/);
assert.ok(api.includes('getDueReviewCount: () => req<{ count: number }>("/api/reviews/due/count")'));

console.log("review API contract verifier passed");
