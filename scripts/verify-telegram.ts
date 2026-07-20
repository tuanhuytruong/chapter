/**
 * Telegram module verification (no network / no real send).
 * Tests: MarkdownV2 escaping, message formatting shape.
 */
import { formatDailyMessage } from "../src/telegram.ts";

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { console.log(`✅ ${name}`); pass++; }
  else { console.log(`❌ ${name}`); fail++; }
}

// Format with special chars that need escaping in MarkdownV2
const msg = formatDailyMessage("Atomic Habits", "James Clear", {
  date: "2026-07-20",
  page_start: 1,
  page_end: 20,
  summary: "Habit stacking: _after_ X, do Y. Use 1% better daily.",
  key_insights: ["Systems > goals", "Identity change", "Tiny gains compound"],
  quote: "You do not rise to the level of your goals.",
});

check("contains title", msg.includes("Atomic Habits"));
check("contains author", msg.includes("James Clear"));
check("contains page range", msg.includes("1") && msg.includes("20"));
check("escapes underscore in summary", msg.includes("_after_") === false && msg.includes("\\_after\\_"));
check("insights bullets present", msg.includes("Systems") && msg.includes("goals"));
check("quote present and escaped", msg.includes("your goals") && msg.includes("._"));

console.log("\n" + (fail === 0 ? `🎉 Telegram module verification PASSED (${pass})` : `⚠️ ${fail} failed`));
process.exit(fail === 0 ? 0 : 1);
