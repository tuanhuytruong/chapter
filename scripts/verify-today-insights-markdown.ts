import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const today = readFileSync(new URL("../src/pages/Today.tsx", import.meta.url), "utf8");

assert.match(today, /function stripInsightOrdinal/);
assert.match(today, /function InlineMarkdown/);
assert.match(today, /stripInsightOrdinal\(insight\.text\)/);
assert.match(today, /const hasExplicitBold/);
assert.match(today, /const lead = clean\.match/);

const stripInsightOrdinal = (text: string) => text.replace(/^\s*\d+[.)]\s+/, "");
const leadOf = (text: string) => {
  const clean = text.replace(/\*{3,}/g, "**");
  const hasExplicitBold = /\*\*[^*]+\*\*/.test(clean);
  if (hasExplicitBold) return null;
  return clean.match(/^(.+?:)(?:\s+|$)/)?.[1]
    ?? clean.match(/^(.+?[.!?])(?:\s+|$)/)?.[1]
    ?? clean;
};

assert.equal(stripInsightOrdinal("1. Chip quyết định sức mạnh quân sự: Vũ khí thông minh"), "Chip quyết định sức mạnh quân sự: Vũ khí thông minh");
assert.equal(stripInsightOrdinal("2) Cuộc khủng hoảng: Đầu tư ngược chiều"), "Cuộc khủng hoảng: Đầu tư ngược chiều");
assert.equal(stripInsightOrdinal("2008–2009 là bối cảnh"), "2008–2009 là bối cảnh");
assert.equal(leadOf("**Chip quyết định sức mạnh quân sự:** Vũ khí thông minh"), null, "explicit markdown owns bolding");
assert.equal(leadOf("Cuộc khủng hoảng tài chính 2008–2009 là chất xúc tác: Morris Chang đầu tư ngược chiều."), "Cuộc khủng hoảng tài chính 2008–2009 là chất xúc tác:");
assert.equal(leadOf("Intel đánh mất thị trường di động vì quá ưu tiên lợi nhuận từ PC. Minh họa cho innovator’s dilemma."), "Intel đánh mất thị trường di động vì quá ưu tiên lợi nhuận từ PC.");
assert.equal(leadOf("Một insight không có dấu câu"), "Một insight không có dấu câu");

console.log("Today key-insights formatting contract passed");
