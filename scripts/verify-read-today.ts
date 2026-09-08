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
assert.match(readToday, /setLogs\(\(previous\) =>\s*sortLogsNewestFirst\(\[\s*result\.log,/);
assert.match(readToday, /current_page: result\.pageEnd/);
assert.match(readToday, /setPendingEnrichmentLogId\(result\.log\.id\)/);
assert.doesNotMatch(readToday, /await load\(\)/, "Read Today must not reload the Book Detail route");

const enrichmentStart = detailSource.indexOf("// A reading session is saved immediately");
const enrichmentEnd = detailSource.indexOf("  useEffect(() => {\n    if (!id || logs.length", enrichmentStart);
assert.ok(enrichmentStart >= 0 && enrichmentEnd > enrichmentStart, "enrichment polling must exist");
const enrichmentSource = detailSource.slice(enrichmentStart, enrichmentEnd);
assert.match(enrichmentSource, /useJobPolling<\{[\s\S]*?\}>\(\{/);
assert.match(enrichmentSource, /enabled: Boolean\(enrichmentPending && pendingEnrichmentLogId && id\)/);
assert.match(enrichmentSource, /pollKey: `\$\{id\}:\$\{selectedRound\}:\$\{pendingEnrichmentLogId\}:enrichment`/);
assert.match(enrichmentSource, /if \(ready\) \{\s*setEnrichmentPending\(false\);/);
assert.doesNotMatch(enrichmentSource, /api\.getWikiStatus\(/, "BookWiki catch-up must not hold the saved-session action in Preparing state");

assert.match(detailSource, /import \{ createPortal \} from ["']react-dom["'];/);
assert.match(detailSource, /book\.can_edit\s*&&\s*book\.status === ["']active["']\s*&&\s*createPortal\(/);
assert.match(detailSource, /fixed bottom-\[calc\(env\(safe-area-inset-bottom\)\+1rem\)\] right-4/);
assert.match(detailSource, /advancing \? "Reading…" : enrichmentPending \? "Preparing…" : "Read now"/);
assert.doesNotMatch(detailSource, /IntersectionObserver/, "the circular shortcut must not depend on header visibility");
assert.doesNotMatch(detailSource, /newestLogId/, "the newest-card action must not remain");
assert.doesNotMatch(detailSource, /Read Today/, "reading actions should use one continuation label");
assert.equal([...detailSource.matchAll(/api\.advance\(/g)].length, 1, "all CTAs must reuse readToday");

console.log("READ_TODAY_IN_PLACE_FIXTURES_OK");
