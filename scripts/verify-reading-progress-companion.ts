import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildReadingProgressPrompt,
  parseReadingProgressCompanion,
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
  parseReadingProgressCompanion(JSON.stringify(en), [source], "en").mainThread
    .text,
  item.text,
);
assert.throws(() => parseReadingProgressCompanion("{", [source], "en"));
assert.throws(() =>
  parseReadingProgressCompanion(
    JSON.stringify({ ...en, outputLanguage: "vi" }),
    [source],
    "en",
  ),
);
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
assert.equal(
  validateReadingProgressLanguage(JSON.stringify(vi), "vi").valid,
  true,
);
assert.equal(
  validateReadingProgressLanguage(JSON.stringify(en), "vi").valid,
  false,
);
assert.match(
  buildReadingProgressPrompt({ sources: [source], language: "en" }),
  /Only saved session text/,
);
const route = readFileSync(
  new URL("../src/routes/books.ts", import.meta.url),
  "utf8",
);
assert.match(route, /resolveReadingProgressLanguage/);
assert.match(route, /validateReadingProgressLanguage/);
const card = readFileSync(
  new URL("../src/components/ReadingProgressCard.tsx", import.meta.url),
  "utf8",
);
assert.match(card, /aria-expanded/);
assert.match(card, /expanded \?/);
assert.match(card, /reading thread/);
console.log("READING_PROGRESS_COMPANION_FIXTURES_OK");
