import assert from "node:assert/strict";
import { reviewOutcome } from "../src/review.js";

assert.deepEqual(reviewOutcome(1, false, "2026-07-24"), { intervalDays: 1, dueDate: "2026-07-25" });
assert.deepEqual(reviewOutcome(1, true, "2026-07-24"), { intervalDays: 3, dueDate: "2026-07-27" });
assert.deepEqual(reviewOutcome(30, true, "2026-07-24"), { intervalDays: 30, dueDate: "2026-08-23" });

console.log("review UI scheduling fixtures passed");
