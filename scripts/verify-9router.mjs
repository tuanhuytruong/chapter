/**
 * Live 9router verification (no DB needed).
 * Calls the REAL 9router endpoint with model "n8n" using a sample book passage,
 * then runs the SAME parser used in production (src/llm.ts -> parseSummary).
 *
 * Run:  NINE_ROUTER_API_KEY=*** npx tsx scripts/verify-9router.mjs
 * (key is read from env; never hard-coded here)
 */
import { parseSummary } from "../src/llm.ts";

const URL = process.env.NINE_ROUTER_URL || "https://9router-ubt.mrl.asia/v1/chat/completions";
const MODEL = process.env.NINE_ROUTER_MODEL || "n8n";
const KEY = process.env.NINE_ROUTER_API_KEY;

if (!KEY) {
  console.error("❌ Set NINE_ROUTER_API_KEY env var");
  process.exit(1);
}

const SYSTEM_PROMPT = `You are a reading companion. Given a passage from a book, produce:
1. A concise 3-5 sentence narrative summary
2. Exactly 3 key insights as bullet points
3. One memorable quote from the passage (if any)
Keep language clear and engaging. No spoilers beyond the given text.

Format your response EXACTLY as:

## Summary
<your summary>

## Insights
- <insight 1>
- <insight 2>
- <insight 3>

## Quote
<the quote, or "N/A" if none>`;

const samplePassage = `Habits are the compound interest of self-improvement. The same way that money multiplies through
compound interest, the effects of your habits multiply as you repeat them. They seem to make
no difference until you cross a critical threshold and unlock a new level of performance.`;

const resp = await fetch(URL, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
  body: JSON.stringify({
    model: MODEL,
    stream: false,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Book: Atomic Habits by James Clear\nPages 1-3 of 320:\n\n${samplePassage}` },
    ],
    temperature: 0.7,
  }),
});

if (!resp.ok) {
  const t = await resp.text();
  console.error(`❌ 9router HTTP ${resp.status}: ${t.slice(0, 300)}`);
  process.exit(1);
}
const data = await resp.json();
const raw = data?.choices?.[0]?.message?.content ?? "";
const parsed = parseSummary(raw);

console.log("✅ 9router responded (model:", data.model, ")");
console.log("── raw ──\n", raw.slice(0, 400), "\n");
console.log("── parsed ──");
console.log("summary:", parsed.summary?.slice(0, 120));
console.log("insights:", parsed.key_insights);
console.log("quote:", parsed.quote);

const ok = parsed.summary && parsed.key_insights.length >= 1;
console.log(ok ? "\n🎉 9router live parse verification PASSED" : "\n❌ parse incomplete");
process.exit(ok ? 0 : 1);
