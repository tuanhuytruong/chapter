import assert from "node:assert/strict"; import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8"); const today = readFileSync(new URL("../src/pages/Today.tsx", import.meta.url), "utf8");
for (const name of ["today-card-surface", "today-tab-active", "today-tab-idle", "today-insight-row", "today-status-surface", "today-progress-track"]) assert.match(css, new RegExp(`\\.dark\\s+\\.${name}`));
for (const name of ["today-card-surface", "today-tab-active", "today-tab-idle", "today-insight-row", "today-status-surface", "today-progress-track"]) assert.match(today, new RegExp(name));
const currentReads = today.slice(today.indexOf('aria-labelledby="current-reads-heading"')); assert.doesNotMatch(currentReads, /hover:bg-white/); console.log("DARK_THEME_TODAY_FIXTURES_OK");
