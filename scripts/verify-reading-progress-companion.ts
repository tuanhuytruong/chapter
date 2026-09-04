import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildReadingProgressFactsPrompt,
  buildReadingProgressPrompt,
  parseReadingProgressCompanion,
  parseReadingProgressFacts,
  resolveReadingProgressLanguage,
  validateReadingProgressLanguage,
  type ProgressSource,
} from "../src/readingProgressCompanion.js";

const source: ProgressSource = {
  logId: "11111111-1111-4111-8111-111111111111",
  session: 1,
  pageStart: 1,
  pageEnd: 8,
  text: "Only saved session text.",
};
const item = {
  text: "Grounded thread with enough English words for stable validation today.",
  refs: [{ logId: source.logId, session: 1, pageStart: 1, pageEnd: 8 }],
};
const en = {
  mainThread: item,
  converging: [item],
  openThreads: [],
  carryForward: [],
  outputLanguage: "en" as const,
};
assert.equal(
  parseReadingProgressCompanion(JSON.stringify(en), [source], "en").mainThread.text,
  item.text,
);
assert.throws(() => parseReadingProgressCompanion("{", [source], "en"));
assert.throws(() => parseReadingProgressCompanion(
  JSON.stringify({ ...en, outputLanguage: "vi" }), [source], "en",
));
assert.throws(() => parseReadingProgressCompanion(
  JSON.stringify({ ...en, mainThread: { ...item, refs: [{ ...item.refs[0], pageEnd: 9 }] } }),
  [source], "en",
));

const facts = { facts: [item], outputLanguage: "en" as const };
assert.equal(parseReadingProgressFacts(JSON.stringify(facts), source, "en").facts.length, 1);
assert.throws(() => parseReadingProgressFacts(JSON.stringify({ ...facts, facts: [{ ...item, refs: [] }] }), source, "en"));
assert.match(buildReadingProgressFactsPrompt({ source, language: "en" }), /single SAVED READING TEXT/);
const synthesisPrompt = buildReadingProgressPrompt({
  facts: [item], language: "en", progressPct: 86, sessionCount: 45,
});
assert.match(synthesisPrompt, /FACT LEDGER/);
assert.match(synthesisPrompt, /well into the book/);
assert.doesNotMatch(synthesisPrompt, /Only saved session text/);

const vietnameseSource: ProgressSource = {
  ...source,
  text: "Đây là phần đọc tiếng Việt với những ý chính và lập luận rõ ràng trong cuốn sách này.",
};
assert.equal(resolveReadingProgressLanguage("auto", [vietnameseSource]), "vi");
assert.equal(resolveReadingProgressLanguage("auto", [source]), "en");
assert.equal(resolveReadingProgressLanguage("en", [vietnameseSource]), "en");
const vi = {
  ...en,
  mainThread: {
    ...item,
    text: "Đây là mạch chính của phần đọc với những ý quan trọng và lập luận rõ ràng trong cuốn sách này.",
  },
  outputLanguage: "vi" as const,
};
assert.equal(validateReadingProgressLanguage(JSON.stringify(vi), "vi").valid, true);
assert.equal(validateReadingProgressLanguage(JSON.stringify(en), "vi").valid, false);

const route = readFileSync(new URL("../src/routes/books.ts", import.meta.url), "utf8");
assert.match(route, /readingProgressCompanionFactsRepository/);
assert.match(route, /buildReadingProgressFactsPrompt/);
assert.match(route, /pendingSources/);
assert.match(route, /prior\?\.output_language/);
const card = readFileSync(new URL("../src/components/ReadingProgressCard.tsx", import.meta.url), "utf8");
assert.match(card, /ChevronRight/);
assert.match(card, /ChevronDown/);
assert.match(card, /Your reading so far/);
assert.match(card, /aria-expanded/);
assert.doesNotMatch(card, /Expand" : "Collapse"\} reading thread/);
const detail = readFileSync(new URL("../src/pages/BookDetail.tsx", import.meta.url), "utf8");
assert.match(detail, /pct >= 95/);
assert.match(detail, /book\.can_edit && pct >= 95/);
assert.doesNotMatch(detail, /pct >= 85/);
console.log("READING_PROGRESS_COMPANION_FIXTURES_OK");
