import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../src/routes/reviews.ts", import.meta.url), "utf8");
const review = readFileSync(new URL("../src/review.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");

const countRoute = route.indexOf('reviewsRouter.get("/due/count"');
const dueBooksRoute = route.indexOf('reviewsRouter.get("/due/books"');
const dueRoute = route.indexOf('reviewsRouter.get("/due",');
const parameterRoute = route.indexOf('reviewsRouter.post("/:id"');
assert.ok(countRoute >= 0 && dueBooksRoute >= 0, "exact due routes are registered");
assert.ok(countRoute < dueBooksRoute && dueBooksRoute < dueRoute && dueRoute < parameterRoute, "due routes precede the parameterized route");

const countBlock = route.slice(countRoute, dueBooksRoute);
assert.match(countBlock, /SELECT COUNT\(\*\)::int AS count/);
assert.match(countBlock, /JOIN books b ON b\.id=rc\.book_id/);
assert.match(countBlock, /b\.owner_id=\$1 AND rc\.due_date <= \$2/);
assert.doesNotMatch(countBlock, /LIMIT\s+\d+/);
assert.match(countBlock, /\[userFrom\(req\)\.id, today\(\)\]/);

const dueBooksBlock = route.slice(dueBooksRoute, dueRoute);
assert.match(dueBooksBlock, /GROUP BY b\.id, b\.title, b\.author, b\.cover_url/);
assert.match(dueBooksBlock, /b\.owner_id=\$1 AND rc\.due_date <= \$2/);
const dueBlock = route.slice(dueRoute, parameterRoute);
assert.match(dueBlock, /b\.cover_url AS cover_url/);
assert.match(dueBlock, /bookId must be a UUID/);
assert.match(dueBlock, /AND rc\.book_id=\$3/);
assert.match(dueBlock, /LIMIT 50/);
assert.match(review, /cover_url: string \| null;/);
assert.ok(api.includes('getDueReviewBooks'));
assert.ok(api.includes('getDueReviews: (bookId?: string)'));

console.log("review API contract verifier passed");
