import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const list = readFileSync(new URL("../src/components/DaySummary.tsx", import.meta.url), "utf8");
assert.match(list, /const captureScroll = \(button: HTMLButtonElement\) =>/);
assert.match(list, /const preserveScroll = \(button: HTMLButtonElement, update: \(\) => void\) =>/);
assert.match(list, /button\.dataset\.chapterScrollY = String\(window\.scrollY\)/);
assert.match(list, /onPointerDown=\{\(event\) => captureScroll\(event\.currentTarget\)\}/);
assert.match(list, /onClick=\{\(event\) => preserveScroll\(event\.currentTarget, \(\) => setOpen/);
assert.match(list, /onClick=\{\(event\) => preserveScroll\(event\.currentTarget, \(\) => setShowNotes/);
assert.doesNotMatch(list, /<button(?![^>]*type="button")/s);

const journey = readFileSync(new URL("../src/components/JourneyView.tsx", import.meta.url), "utf8");
assert.match(journey, /const captureScroll = \(button: HTMLButtonElement\) =>/);
assert.match(journey, /const preserveScroll = \(button: HTMLButtonElement, update: \(\) => void\) =>/);
assert.match(journey, /onPointerDown=\{\(event\) => captureScroll\(event\.currentTarget\)\}/);
assert.match(journey, /onClick=\{\(event\) => preserveScroll\(event\.currentTarget, \(\) => setExpanded/);
assert.match(journey, /onClick=\{\(event\) => preserveScroll\(event\.currentTarget, \(\) => toggleInsights/);
assert.doesNotMatch(journey, /scrollIntoView/);
assert.doesNotMatch(journey, /<button(?![^>]*type="button")/s);

const detail = readFileSync(new URL("../src/pages/BookDetail.tsx", import.meta.url), "utf8");
assert.match(detail, /<button\s+type="button"\s+onClick=\{\(\) => setLogView\("list"\)\}/);
assert.match(detail, /<button\s+type="button"\s+onClick=\{\(\) => setLogView\("journey"\)\}/);
assert.match(detail, /<button\s+type="button"\s+onClick=\{\(\) => \{\s+setHasOpenedAiReader/);
console.log("BOOK_DETAIL_SCROLL_FIXTURES_OK");
