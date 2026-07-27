import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const apiSource = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");
const detailSource = readFileSync(new URL("../src/pages/BookDetail.tsx", import.meta.url), "utf8");
const booksSource = readFileSync(new URL("../src/routes/books.ts", import.meta.url), "utf8");
const llmSource = readFileSync(new URL("../src/llm.ts", import.meta.url), "utf8");
const aiReaderSource = readFileSync(new URL("../src/aiReader.ts", import.meta.url), "utf8");

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

assert.match(detailSource, /import \{ createPortal \} from 'react-dom';/);
assert.match(detailSource, /book\.can_edit && book\.status === 'active' && createPortal\(/);
assert.match(detailSource, /document\.body/);
assert.match(detailSource, /fixed bottom-\[calc\(env\(safe-area-inset-bottom\)\+1rem\)\] right-4/);
assert.match(detailSource, /h-12 w-12 items-center justify-center rounded-full bg-natural-clay/);
assert.match(detailSource, /\{advancing \? 'Reading…' : 'Read next session'\}/);
assert.match(detailSource, /aria-label=\{advancing \? 'Reading next session' : 'Read next session'\}/);
assert.doesNotMatch(detailSource, /Saving(?:…| next session)/, "Read Today must use reader-facing wording while saving");

assert.match(llmSource, /const NINE_ROUTER_BACKGROUND_CONCURRENCY = 3/);
assert.match(llmSource, /await acquireNineRouterSlot\("interactive"\)/);
assert.match(llmSource, /NINE_ROUTER_INTERACTIVE_TIMEOUT_MS \|\| 25_000/);
assert.match(llmSource, /signal: controller\.signal/);
assert.match(llmSource, /releaseNineRouterSlot\("interactive"\)/);
assert.match(booksSource, /SELECT \* FROM books WHERE id=\$1 FOR UPDATE/);
assert.match(booksSource, /const activeAdvances = new Map/);
assert.match(booksSource, /EPUB has a persisted unit cursor[\s\S]*ensureEpubReadingUnits\(client, preflightBooks\[0\]\)/);
const reservationStart = booksSource.indexOf("async function reserveAdvance");
const advanceNowStart = booksSource.indexOf("async function advanceBookNow");
assert.ok(reservationStart >= 0 && advanceNowStart > reservationStart);
assert.doesNotMatch(booksSource.slice(reservationStart, advanceNowStart), /callNineRouter\(/, "reservation transaction must not wait for the LLM");
assert.match(aiReaderSource, /export const AI_READER_CONCURRENCY = 2/);
assert.match(aiReaderSource, /for \(const input of inputs\)/);
assert.doesNotMatch(aiReaderSource.slice(aiReaderSource.indexOf("async function analyseBatchResilient"), aiReaderSource.indexOf("function parseChunk")), /Promise\.all\(inputs\.map/, "AI Reader fallback must not fan out retries");
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
