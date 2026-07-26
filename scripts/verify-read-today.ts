import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const apiSource = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");
const detailSource = readFileSync(new URL("../src/pages/BookDetail.tsx", import.meta.url), "utf8");

assert.match(apiSource, /export interface AdvanceResult[\s\S]*log: LogRow;[\s\S]*readingExperience:/);
assert.match(apiSource, /advance: \(id: string\) =>\s*req<AdvanceResult>/);

const readTodayStart = detailSource.indexOf("const readToday = async");
const readTodayEnd = detailSource.indexOf("  const startFromModal", readTodayStart);
assert.ok(readTodayStart >= 0 && readTodayEnd > readTodayStart, "Read Today handler must exist");
const readToday = detailSource.slice(readTodayStart, readTodayEnd);
assert.match(readToday, /setLogs\(previous => \[result\.log, \.\.\.previous\.filter\(log => log\.id !== result\.log\.id\)\]\)/);
assert.match(readToday, /current_page: result\.pageEnd/);
assert.match(readToday, /setPendingEnrichmentLogId\(result\.log\.id\)/);
assert.doesNotMatch(readToday, /await load\(\)/, "Read Today must not reload the Book Detail route");

assert.match(detailSource, /if \(!enrichmentPending \|\| !pendingEnrichmentLogId \|\| !id\) return/);
assert.match(detailSource, /const pendingLog = updatedLogs\.find\(log => log\.id === pendingEnrichmentLogId\)/);
assert.doesNotMatch(detailSource.slice(readTodayStart), /setLoading\(true\)/, "post-save reconciliation must stay quiet");

assert.match(detailSource, /headerReadActionRef = useRef<HTMLDivElement \| null>\(null\)/);
assert.match(detailSource, /new IntersectionObserver\(/);
assert.match(detailSource, /return \(\) => observer\.disconnect\(\)/);
assert.match(detailSource, /book\.can_edit && book\.status === 'active' && !headerReadActionVisible/);
assert.match(detailSource, /Read next session/);
assert.match(detailSource, /log\.id === newestLogId/);
const advanceCalls = [...detailSource.matchAll(/api\.advance\(/g)];
assert.equal(advanceCalls.length, 1, "all CTAs must reuse readToday instead of making another advance call");

console.log("READ_TODAY_IN_PLACE_FIXTURES_OK");
