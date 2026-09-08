import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const summary = readFileSync(new URL("../src/components/DaySummary.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../src/pages/BookDetail.tsx", import.meta.url), "utf8");
const dropdown = readFileSync(new URL("../src/components/ChapterDropdown.tsx", import.meta.url), "utf8");

assert.match(summary, /const preserveScroll = \(button: HTMLButtonElement, update: \(\) => void\)/);
assert.match(summary, /const toggleSource = useCallback\(async/);
assert.match(summary, /aria-expanded=\{open\}/);
assert.match(summary, /aria-controls=\{sourceTextId\}/);
assert.match(summary, /aria-expanded=\{showNotes\}/);
assert.match(summary, /aria-controls=\{notesId\}/);
assert.doesNotMatch(summary, /<button(?![^>]*type="button")/s);

assert.match(dropdown, /aria-expanded=\{open\}/);
assert.match(dropdown, /event\.key === "Escape"/);
assert.match(dropdown, /rootRef\.current && !rootRef\.current\.contains/);

assert.match(detail, /role="tablist" aria-label="Reading views"/);
assert.match(detail, /aria-selected=\{logView === "list"\}/);
assert.match(detail, /aria-selected=\{logView === "journey"\}/);
assert.match(detail, /aria-selected=\{logView === "ai-reader"\}/);
assert.match(detail, /onKeyDown=\{\(event\) => handleTabKeyDown/);
assert.match(detail, /aria-label="Clear search"/);
assert.match(detail, /id="podcast-panel" role="tabpanel" aria-label="Podcast"/);
console.log("BOOK_DETAIL_A11Y_SCROLL_FIXTURES_OK");
