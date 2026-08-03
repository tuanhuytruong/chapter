import { readFileSync } from "node:fs";

const dropdown = readFileSync("src/components/ChapterDropdown.tsx", "utf8");
const calendar = readFileSync("src/pages/Calendar.tsx", "utf8");
const api = readFileSync("src/api.ts", "utf8");
const route = readFileSync("src/routes/books.ts", "utf8");
const checks: Array<[string, boolean]> = [
  [
    "dropdown opts into searchable mode",
    /searchable\??:\s*boolean/.test(dropdown),
  ],
  [
    "search normalizes case and diacritics",
    /normalizeSearch/.test(dropdown) &&
      /normalize\(['"]NFD['"]\)/.test(dropdown),
  ],
  [
    "search input and no-results state exist",
    /Search my books/.test(dropdown) && /No books found/.test(dropdown),
  ],
  [
    "listbox options remain accessible",
    /role="listbox"/.test(dropdown) &&
      /role="option"/.test(dropdown) &&
      /aria-selected/.test(dropdown),
  ],
  [
    "results are internally bounded and scrollable",
    /max-h-48 overflow-y-auto/.test(dropdown),
  ],
  ["Calendar enables searchable book filter", /searchable/.test(calendar)],
  [
    "Calendar keeps all-books selection",
    /value:\s*"",\s*label:\s*"All my books"/.test(calendar),
  ],
  [
    "Calendar fetch carries selected round",
    /getCalendar\(month,\s*bookId,\s*round\)/.test(calendar) &&
      /\[month,\s*bookId,\s*round\]/.test(calendar),
  ],
  [
    "Calendar API passes round parameter",
    /getCalendar: \(month: string, bookId = "", round = ""\)/.test(api),
  ],
  [
    "Calendar backend scopes round query",
    /rl\.reading_round = \$4::int/.test(route) &&
      /\[userFrom\(req\)\.id, month, bookId, round\]/.test(route),
  ],
];
for (const [name, passed] of checks)
  if (!passed) throw new Error(`Calendar filter verifier failed: ${name}`);
console.log(`Calendar filter verifier passed (${checks.length} checks)`);
