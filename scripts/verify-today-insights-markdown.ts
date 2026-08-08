import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const today = readFileSync(new URL("../src/pages/Today.tsx", import.meta.url), "utf8");

// 1. Insights render qua InlineMarkdown (không còn plain text)
assert.match(today, /<InlineMarkdown text=\{insight\.text\} \/>/);

// 2. Không còn chỗ nào render {insight.text} plain trong insights map
//    (key={insight.text} vẫn còn — chỉ là React key, không phải render text)
const insightsMap = today.slice(today.indexOf("insights.insights.slice"));
assert.doesNotMatch(insightsMap, /leading-relaxed">\{insight\.text\}/);

// 3. Component InlineMarkdown local tồn tại
assert.match(today, /function InlineMarkdown\(\{ text \}: \{ text: string \}\)/);

// 4. Defensive collapse *** -> ** trước khi split
assert.match(today, /replace\(/);
assert.ok(today.includes('\\*{3,}'), "defensive 3+ asterisk collapse present");

// 5. Bold render qua <strong>
assert.match(today, /<strong key=\{index\} className="font-bold text-natural-dark">/);

// 6. Logic thực tế: split/bold parsing hoạt động đúng
const renderParts = (text: string): string[] =>
  text.replace(/\*{3,}/g, "**").split(/(\*\*[^*]+\*\*)/g);

const sample = "**Chip quyết định sức mạnh quân sự:** Gulf War ... ";
const parts = renderParts(sample);
assert.ok(parts.some((p) => p.startsWith("**") && p.endsWith("**")), "bold segment detected");
assert.equal(parts[0], "", "opening separator before bold");
assert.ok(parts.includes("**Chip quyết định sức mạnh quân sự:**"), "label kept intact");

// 7. Edge case "**Label:***" (bold close + stray asterisk) -> collapse, không lộ *
const edge = renderParts("**Label:*** text");
assert.ok(!edge.some((p) => p.includes("***")), "no literal *** leaks");
assert.ok(edge.some((p) => p === "**Label:**"), "collapsed to clean bold close");

// 8. Plain text không bold -> giữ nguyên, không crash
assert.deepEqual(renderParts("Intel lost the mobile market"), ["Intel lost the mobile market"]);

console.log("Today key-insights markdown rendering contract passed");
