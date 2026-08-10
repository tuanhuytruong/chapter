import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const today = readFileSync(new URL("../src/pages/Today.tsx", import.meta.url), "utf8");
const insights = readFileSync(new URL("../src/pages/Insights.tsx", import.meta.url), "utf8");

for (const [name, source, render] of [
  ["Today", today, /stripInsightOrdinal\(insight\.text\)/],
  ["Insights", insights, /stripInsightOrdinal\(ins\.insight\)/],
] as const) {
  assert.match(source, /function stripInsightOrdinal/, `${name} strips display-only ordinals`);
  assert.match(source, /function InlineMarkdown/, `${name} renders inline markdown`);
  assert.match(source, render, `${name} normalizes insights before rendering`);
  assert.match(source, /const hasExplicitBold/, `${name} preserves explicit bold`);
  assert.match(source, /const lead = clean\.match/, `${name} applies plain-text lead fallback`);
}

const stripInsightOrdinal = (text: string) => text.replace(/^\s*\d+[.)]\s+/, "");
const leadOf = (text: string) => {
  const clean = text.replace(/\*{3,}/g, "**");
  if (/\*\*[^*]+\*\*/.test(clean)) return null;
  return clean.match(/^(.+?:)(?:\s+|$)/)?.[1]
    ?? clean.match(/^(.+?[.!?])(?:\s+|$)/)?.[1]
    ?? clean;
};

assert.equal(stripInsightOrdinal("3. **Mô hình TSMC:** nội dung"), "**Mô hình TSMC:** nội dung");
assert.equal(stripInsightOrdinal("2) Mô hình fabless: nội dung"), "Mô hình fabless: nội dung");
assert.equal(stripInsightOrdinal("2008–2009 là bối cảnh"), "2008–2009 là bối cảnh");
assert.equal(leadOf("**Mô hình TSMC:** nội dung"), null, "explicit markdown owns bolding");
assert.equal(leadOf("Mô hình fabless giúp giảm rào cản: phần giải thích."), "Mô hình fabless giúp giảm rào cản:");
assert.equal(leadOf("Intel đánh mất thị trường di động. Phần sau."), "Intel đánh mất thị trường di động.");

console.log("Today and Insights key-insights formatting contract passed");
