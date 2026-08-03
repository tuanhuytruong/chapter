import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const list = readFileSync(new URL("../src/components/DaySummary.tsx", import.meta.url), "utf8");
assert.match(list, /const preserveScroll = \(update: \(\) => void\) => \{/);
assert.match(list, /const saved = window\.scrollY/);
assert.match(list, /onClick=\{\(\) => preserveScroll\(\(\) => setOpen/);
assert.match(list, /onClick=\{\(\) => preserveScroll\(\(\) => setShowNotes/);
assert.doesNotMatch(list, /<button(?![^>]*type="button")/s);

const journey = readFileSync(new URL("../src/components/JourneyView.tsx", import.meta.url), "utf8");
assert.match(journey, /const preserveScroll = \(update: \(\) => void\) => \{/);
assert.match(journey, /onClick=\{\(\) => preserveScroll\(\(\) => setExpanded/);
assert.match(journey, /onClick=\{\(\) => preserveScroll\(\(\) => toggleInsights/);
assert.doesNotMatch(journey, /scrollIntoView/);
assert.doesNotMatch(journey, /<button(?![^>]*type="button")/s);

const detail = readFileSync(new URL("../src/pages/BookDetail.tsx", import.meta.url), "utf8");
assert.match(detail, /<button\s+type="button"\s+onClick=\{\(\) => setLogView\("list"\)\}/);
assert.match(detail, /<button\s+type="button"\s+onClick=\{\(\) => setLogView\("journey"\)\}/);
assert.match(detail, /<button\s+type="button"\s+onClick=\{\(\) => \{\s+setHasOpenedAiReader/);
console.log("BOOK_DETAIL_SCROLL_FIXTURES_OK");
