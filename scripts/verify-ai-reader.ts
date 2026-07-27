import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AI_READER_BATCH_SIZE, AI_READER_CONCURRENCY, buildChunkBatchPrompt, buildSynthesisPrompt, companionVoice, parseChunkAnalysis, parseChunkBatchAnalysis, parseSynthesis } from "../src/aiReader.js";

const chunk = parseChunkAnalysis(JSON.stringify({
  schema_version: 2, session_title: "Before dawn", close_reading: "Mara accepts a sealed letter before dawn.", starting_context: "No prior session.",
  what_changes: [{ label: "Letter", detail: "Mara accepts it.", significance: "It commits her." }],
  threads: [{ id: "sealed-letter", label: "The sealed letter", status: "introduced", detail: "Mara receives it.", prior_connection: null }],
  entities: [{ id: "mara", name: "Mara", kind: "person", role_now: "Courier", change_from_prior: null }],
  evidence: [{ text: "sealed letter", page_start: 1, why_it_matters: "It starts the obligation." }],
  handoff: "Remember the letter.", session_summary: "Mara accepts a sealed letter before dawn.",
  chunk_summary: "Mara accepts a sealed letter before dawn.",
  concepts: [{ name: "Duty", definition: "An obligation Mara accepts." }],
  themes: [{ name: "Uncertainty", description: "The letter's purpose is not known." }],
  people: [{ name: "Mara", pulse: "She accepts the letter." }],
  notable_quotes: [{ text: "sealed letter", page_start: 1 }],
}));
assert.equal(chunk.people[0].name, "Mara");
const recoveredControls = parseChunkAnalysis(`{"chunk_summary":"Mara walks
into the dark.","concepts":[]}`);
assert.equal(recoveredControls.chunk_summary, "Mara walks into the dark.");
assert.equal(companionVoice("Đoạn văn giới thiệu Ove và sự bướng bỉnh của ông."), "Ove và sự bướng bỉnh của ông.");
assert.equal(companionVoice("The excerpt discusses Mara's fear."), "Mara's fear.");
const longCloseReading = `${"Ove follows his ordinary route through the early morning, holding fast to each ritual while the world around him changes. ".repeat(6)}He pauses when the tailless cat refuses to move.`;
const parsedLongCloseReading = parseChunkAnalysis(JSON.stringify({ close_reading: longCloseReading, chunk_summary: "Fallback." }));
assert.equal(parsedLongCloseReading.close_reading, longCloseReading);
const veryLongCloseReading = `${"A complete sentence about Ove and the cat. ".repeat(60)}Final sentence.`;
const safelyTrimmedCloseReading = parseChunkAnalysis(JSON.stringify({ close_reading: veryLongCloseReading, chunk_summary: "Fallback." })).close_reading;
assert.ok(safelyTrimmedCloseReading.length <= 2_000);
assert.match(safelyTrimmedCloseReading, /\.$/);

const chunks = [{ pageStart: 1, pageEnd: 10, analysis: chunk }];
const wiki = parseSynthesis(JSON.stringify({
  overview: "Mara accepts a sealed letter.", concepts: [], themes: [], people: [], chapter_map: [], notable_quotes: [], open_questions: [],
  book_so_far: "Mara has accepted a sealed letter, but its purpose remains unknown.",
  current_position: { page_start: 1, page_end: 10, label: "Mara leaves before dawn." },
  narrative_arc: [{ label: "The sealed letter", status: "developing", detail: "Mara now carries it." }],
  carry_forward_insights: ["The letter's purpose is not established."],
  reading_path: [{ log_id: "log-1", page_start: 1, page_end: 10, title: "Before dawn", summary: "Mara takes the letter.", turning_point: "She accepts it.", connected_from: null }],
  thread_map: [{ id: "sealed-letter", label: "The sealed letter", status: "active", evolution: [{ log_id: "log-1", page_start: 1, note: "Introduced." }] }],
  entity_map: [{ id: "mara", name: "Mara", kind: "person", current_state: "Carries the letter.", appearances: [{ log_id: "log-1", page_start: 1, note: "Accepts it." }] }],
  connections: [], current_reading_state: { summary: "Mara carries the letter.", active_threads: ["sealed-letter"], active_entities: ["mara"] }, next_session_context: "Follow the letter without predicting its purpose.",
}), chunks, { pagesCovered: 10, lang: "vi" });
assert.equal(wiki.output_language, "vi");
assert.equal(wiki.chapter_map.length, 1);
assert.equal(wiki.narrative_arc[0].status, "developing");
assert.equal(wiki.current_position.page_end, 10);
assert.equal(wiki.schema_version, 2);
assert.equal(wiki.reading_path[0].log_id, "log-1");
assert.equal(chunk.threads[0].id, "sealed-letter");

const prompt = buildSynthesisPrompt({ title: "Test", author: "Author", totalPages: 100, pagesCovered: 10, lang: "en", chunks });
assert.match(prompt, /Never reveal, predict, or hint at events beyond page 10/);
assert.match(prompt, /entirely in English/);

assert.equal(AI_READER_BATCH_SIZE, 5);
assert.equal(AI_READER_CONCURRENCY, 2, "AI Reader yields provider capacity to interactive Read Today");
const batchInputs = Array.from({ length: 5 }, (_, index) => ({ title: "Test", author: "Author", pageStart: index * 10 + 1, pageEnd: index * 10 + 10, totalPages: 100, lang: "en" as const, text: `Session ${index + 1} source text.` }));
const batchPrompt = buildChunkBatchPrompt(batchInputs);
assert.match(batchPrompt, /SESSION 1/);
assert.match(batchPrompt, /SESSION 5/);
assert.throws(() => buildChunkBatchPrompt([...batchInputs, batchInputs[0]]), /1–5 sessions/);
const batchAnalyses = parseChunkBatchAnalysis(JSON.stringify({ analyses: batchInputs.map((_, index) => ({ session: index + 1, chunk_summary: `Session ${index + 1}`, concepts: [], themes: [], people: [], notable_quotes: [] })) }), 5);
assert.equal(batchAnalyses.length, 5);
assert.equal(batchAnalyses[4].chunk_summary, "Session 5");
assert.throws(() => parseChunkBatchAnalysis(JSON.stringify({ analyses: [{ session: 2 }] }), 1), /preserve session order/);

// Consecutive one-page sessions must contribute all the way through page 3,
// rather than allowing a stale page-1 synthesis to be displayed.
const onePageChunks = [1, 2, 3].map((page) => ({ pageStart: page, pageEnd: page, analysis: chunk }));
const threeSessionPrompt = buildSynthesisPrompt({ title: "Test", author: "Author", totalPages: 100, pagesCovered: 3, lang: "en", chunks: onePageChunks });
assert.match(threeSessionPrompt, /Reader has read pages 1–3/);
assert.match(threeSessionPrompt, /3 entries/);
const aiReaderSource = readFileSync(new URL("../src/aiReader.ts", import.meta.url), "utf8");
assert.match(aiReaderSource, /const activeBookProcesses = new Map/);
assert.match(aiReaderSource, /WHERE book_wiki\.pages_covered <= EXCLUDED\.pages_covered/);
assert.match(aiReaderSource, /const AI_READER_TIMEOUT_MS = 150_000/);
assert.match(aiReaderSource, /Batch retrying as \$\{inputs\.length\} single sessions/);
const bookRoutes = readFileSync(new URL("../src/routes/books.ts", import.meta.url), "utf8");
const sharedReaderRoutes = bookRoutes.slice(bookRoutes.indexOf('// ── AI Reader / Book Wiki routes'), bookRoutes.indexOf('// POST /api/books/:id/wiki/regenerate'));
assert.doesNotMatch(sharedReaderRoutes, /owner_id=\$2/);
assert.match(bookRoutes, /booksRouter\.post\("\/:id\/wiki\/regenerate"[\s\S]*?ownerCanMutate/);
const bookWikiComponent = readFileSync(new URL("../src/components/BookWiki.tsx", import.meta.url), "utf8");
assert.match(bookWikiComponent, /req<BookWikiData>\(`\/api\/books\/\$\{bookId\}\/wiki`\)\.catch/);
assert.match(bookWikiComponent, /if \(error\.message\.startsWith\("404:"\)\) return null/);
assert.match(bookWikiComponent, /The owner has not generated a shared AI Reader map for this book yet\./);
assert.match(bookWikiComponent, /\{canEdit && <button onClick=\{refresh\}/);

const migration = readFileSync(new URL("../migrations/20260726_expand_ai_reader_narrative.sql", import.meta.url), "utf8");
const v2Migration = readFileSync(new URL("../migrations/20260726_ai_reader_continuity_map_v2.sql", import.meta.url), "utf8");
for (const column of ["schema_version", "output_language", "book_so_far", "current_position", "narrative_arc", "carry_forward_insights"]) {
  assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`));
}
assert.match(migration, /output_language IN \('auto', 'vi', 'en'\)/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS chapter\.ai_reader_jobs/);
assert.match(migration, /status TEXT NOT NULL DEFAULT 'idle' CHECK \(status IN \('idle', 'running', 'failed'\)\)/);
for (const column of ["reading_path", "thread_map", "entity_map", "connections", "current_reading_state", "next_session_context"]) assert.match(v2Migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`));
assert.match(v2Migration, /output_language IN \('vi', 'en'\)/);
console.log("AI_READER_NARRATIVE_FIXTURES_OK");
