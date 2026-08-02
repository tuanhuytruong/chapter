import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const today = readFileSync(new URL("../src/pages/Today.tsx", import.meta.url), "utf8");
const review = readFileSync(new URL("../src/pages/Review.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("../src/components/review/ReviewHeader.tsx", import.meta.url), "utf8");
const recall = readFileSync(new URL("../src/components/review/RecallCard.tsx", import.meta.url), "utf8");
assert.doesNotMatch(today, /reviewCards|setReviewCards|getDueReviews/);
assert.match(today, /\$\{dashboard\.due_reviews\} idea/);
assert.match(review, /useSearchParams/);
assert.match(review, /getDueReviewBooks\(\)/);
assert.match(review, /getDueReviews\(selectedBookId\)/);
assert.match(review, /MODE_KEY/);
assert.match(review, /event\.key === "1"/);
assert.match(review, /event\.key === "2"/);
assert.match(header, /Quick flow/);
assert.match(recall, /Need another pass returns tomorrow/);
console.log("today/review UX contract verifier passed");
