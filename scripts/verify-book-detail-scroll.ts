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

const dropdown = readFileSync(new URL("../src/components/ChapterDropdown.tsx", import.meta.url), "utf8");
assert.match(dropdown, /const close = \(\) => \{\s+setOpen\(false\);\s+setQuery\(\"\"\);\s+\};/);
assert.doesNotMatch(dropdown, /buttonRef\.current\?\.focus/);
assert.match(dropdown, /if \(rootRef\.current && !rootRef\.current\.contains\(event\.target as Node\)\)\s+close\(\);/);

const detail = readFileSync(new URL("../src/pages/BookDetail.tsx", import.meta.url), "utf8");
assert.doesNotMatch(detail, /pointerScrollY|captureDetailScroll|restoreDetailScroll|onPointerDownCapture=\{captureDetailScroll\}/);
assert.match(detail, /<button\s+type="button"\s+onClick=\{\(\) => setLogView\("list"\)\}/);
assert.match(detail, /<button\s+type="button"\s+onClick=\{\(\) => setLogView\("journey"\)\}/);
assert.match(detail, /<button\s+type="button"\s+onClick=\{\(\) => \{\s+setHasOpenedAiReader/);
console.log("BOOK_DETAIL_SCROLL_FIXTURES_OK");
