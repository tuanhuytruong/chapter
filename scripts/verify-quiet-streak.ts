import assert from "node:assert/strict";
import { activeDays, quietStreakDateKey, quietStreakSummary, QUIET_STREAK_TIERS } from "../src/quietStreak.ts";
const now = new Date("2026-09-03T05:00:00.000Z");
assert.deepEqual(quietStreakSummary([], [], now), { active_days: [], current_streak: 0, longest_streak: 0, highest_tier: null, next_tier: QUIET_STREAK_TIERS[0], active_today: false });
assert.deepEqual(activeDays(["2026-09-01", "2026-09-02"], ["2026-09-02", "2026-09-03"]), ["2026-09-01", "2026-09-02", "2026-09-03"]);
assert.equal(quietStreakSummary(["2026-09-01", "2026-09-02"], [], now).current_streak, 2);
assert.equal(quietStreakSummary(["2026-08-30"], [], now).current_streak, 0);
for (const [count, id] of [[3,"first-thread"],[7,"steady-reader"],[21,"quiet-practice"],[60,"deep-current"],[180,"reading-life"]] as const) { const start = new Date("2026-03-08T00:00:00Z"); const days = Array.from({length: count}, (_, i) => new Date(start.getTime()+i*86400000).toISOString().slice(0,10)); assert.equal(quietStreakSummary(days, [], now).highest_tier?.id, id); }
const retained = quietStreakSummary(Array.from({length:21},(_,i)=>`2026-07-${String(i+1).padStart(2,"0")}`), [], now); assert.equal(retained.current_streak, 0); assert.equal(retained.highest_tier?.id, "quiet-practice");
assert.equal(quietStreakDateKey("2026-09-02T17:30:00.000Z"), "2026-09-03"); console.log("QUIET_STREAK_FIXTURES_OK");
