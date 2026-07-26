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

assert.match(detailSource, /book\.can_edit && book\.status === 'active' && \(/);
assert.match(detailSource, /fixed bottom-\[calc\(env\(safe-area-inset-bottom\)\+1rem\)\] right-4/);
assert.match(detailSource, /h-12 w-12 items-center justify-center rounded-full bg-natural-clay/);
assert.match(detailSource, /aria-label=\{advancing \? 'Saving next session' : 'Read next session'\}/);
assert.match(detailSource, /advancing \? <Loader2 className="h-5 w-5 animate-spin" \/> : <Zap className="h-5 w-5" \/>/);
assert.doesNotMatch(detailSource, /IntersectionObserver/, "the circular shortcut must not depend on header visibility");
assert.doesNotMatch(detailSource, /headerReadActionVisible/, "the circular shortcut must stay available while scrolling");
assert.doesNotMatch(detailSource, /newestLogId/, "the newest-card action must not remain");
assert.doesNotMatch(detailSource, /Read Today/, "reading actions should use one continuation label");
assert.doesNotMatch(detailSource, /Daily target[\s\S]*Forecast/, "header must not repeat reading-plan metrics");
const advanceCalls = [...detailSource.matchAll(/api\.advance\(/g)];
assert.equal(advanceCalls.length, 1, "all CTAs must reuse readToday instead of making another advance call");

assert.match(detailSource, /const \[hasOpenedAiReader, setHasOpenedAiReader\] = useState\(false\)/);
assert.match(detailSource, /setHasOpenedAiReader\(true\); setLogView\('ai-reader'\)/);
assert.match(detailSource, /hasOpenedAiReader && \(/);
assert.match(detailSource, /hidden=\{logView !== 'ai-reader'\}/);
assert.doesNotMatch(detailSource, /\{logView === 'ai-reader' \? \(/, "AI Reader must stay mounted after its first visit");

console.log("READ_TODAY_IN_PLACE_FIXTURES_OK");
