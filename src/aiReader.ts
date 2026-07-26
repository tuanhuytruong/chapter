/**
 * AI Reader — chunk analysis and wiki synthesis.
 *
 * The AI Reader processes each reading session's raw text independently
 * (chunk analysis), then synthesises all chunks into a single book wiki.
 * Both steps use callLLM() with jsonMode so output is always structured.
 */

import { callLLM } from "./llm.js";
import { query } from "./db.js";
import { extractRange } from "./extractor.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WikiConcept {
  name: string;
  definition: string;
}

export interface WikiTheme {
  name: string;
  description: string;
}

export interface WikiPerson {
  name: string;
  pulse: string;
}

export interface WikiChapterEntry {
  page_start: number;
  page_end: number;
  title: string;
  summary: string;
}

export interface WikiQuote {
  text: string;
  page_start: number;
}

export type SummaryLanguage = "auto" | "vi" | "en";
export type ResolvedLanguage = "vi" | "en";
export const AI_READER_SCHEMA_VERSION = 2;
export interface NarrativePosition { page_start: number; page_end: number; label: string; }
export interface NarrativeArcEntry { label: string; status: "introduced" | "developing" | "resolved" | "uncertain"; detail: string; }
export type ReaderThreadStatus = "introduced" | "deepened" | "shifted" | "resolved" | "uncertain";
export interface ReaderChange { label: string; detail: string; significance: string; }
export interface ReaderThread { id: string; label: string; status: ReaderThreadStatus; detail: string; prior_connection: string | null; }
export interface ReaderEntity { id: string; name: string; kind: "person" | "organisation" | "idea" | "force"; role_now: string; change_from_prior: string | null; }
export interface ReaderEvidence { text: string; page_start: number; why_it_matters: string; }
export interface ReaderPathEntry { log_id: string; page_start: number; page_end: number; title: string; summary: string; turning_point: string; connected_from: string | null; }
export interface ReaderMapThread { id: string; label: string; status: "active" | "resolved" | "uncertain"; evolution: Array<{ log_id: string; page_start: number; note: string }>; }
export interface ReaderMapEntity { id: string; name: string; kind: string; current_state: string; appearances: Array<{ log_id: string; page_start: number; note: string }>; }
export interface ReaderConnection { from_type: "thread" | "entity" | "session"; from_id: string; to_type: "thread" | "entity" | "session"; to_id: string; label: string; explanation: string; page_start: number; }

export interface BookWiki {
  schema_version: number;
  output_language: ResolvedLanguage;
  pages_covered: number;
  overview: string;
  concepts: WikiConcept[];
  themes: WikiTheme[];
  people: WikiPerson[];
  chapter_map: WikiChapterEntry[];
  notable_quotes: WikiQuote[];
  open_questions: string[];
  book_so_far: string;
  current_position: NarrativePosition;
  narrative_arc: NarrativeArcEntry[];
  carry_forward_insights: string[];
  reading_path: ReaderPathEntry[];
  thread_map: ReaderMapThread[];
  entity_map: ReaderMapEntity[];
  connections: ReaderConnection[];
  current_reading_state: { summary: string; active_threads: string[]; active_entities: string[] };
  next_session_context: string;
}

export interface ChunkAnalysis {
  schema_version: number;
  session_title: string;
  close_reading: string;
  starting_context: string;
  what_changes: ReaderChange[];
  threads: ReaderThread[];
  entities: ReaderEntity[];
  evidence: ReaderEvidence[];
  handoff: string;
  session_summary: string;
  // V1-compatible fields remain for existing reference rendering.
  concepts: WikiConcept[];
  themes: WikiTheme[];
  people: WikiPerson[];
  notable_quotes: WikiQuote[];
  chunk_summary: string;
}

export interface ChunkForSynthesis {
  logId?: string;
  pageStart: number;
  pageEnd: number;
  analysis: ChunkAnalysis;
}

export interface ChunkInput {
  title: string;
  author: string;
  pageStart: number;
  pageEnd: number;
  totalPages: number;
  lang: SummaryLanguage;
  text: string;
}

// NineRouter can process four requests concurrently. Each request contains at
// most five independent saved sessions to avoid paying one round-trip per log.
export const AI_READER_BATCH_SIZE = 5;
export const AI_READER_CONCURRENCY = 4;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MAX_STR = 600;
const clean = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, MAX_STR) || fallback : fallback;

const arr = <T>(v: unknown, max: number, mapper: (item: unknown) => T | null): T[] => {
  if (!Array.isArray(v)) return [];
  return v.slice(0, max).map(mapper).filter((x): x is T => x !== null);
};

function extractJson(raw: string): Record<string, unknown> {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] || raw.trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI Reader: response did not contain JSON");
  const parsed = JSON.parse(fenced.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("AI Reader: response must be a JSON object");
  return parsed as Record<string, unknown>;
}

function langInstruction(lang: SummaryLanguage): string {
  if (lang === "vi") return "Write all text fields entirely in Vietnamese.";
  if (lang === "en") return "Write all text fields entirely in English.";
  return "Match the language of the source text for all text fields.";
}

const language = (value: unknown): SummaryLanguage => value === "vi" || value === "en" ? value : "auto";
/** Resolve Auto from the saved source text so persisted output never claims "auto". */
export function resolveLanguage(requested: SummaryLanguage, sourceText: string): ResolvedLanguage {
  if (requested === "vi" || requested === "en") return requested;
  const vietnameseSignals = (sourceText.match(/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/gi) || []).length;
  const words = sourceText.match(/[A-Za-zÀ-ỹ]+/g)?.length || 1;
  return vietnameseSignals / words >= 0.08 ? "vi" : "en";
}
const wholeNumber = (value: unknown, fallback = 0): number => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
const narrativeStatus = (value: unknown): NarrativeArcEntry["status"] => value === "introduced" || value === "developing" || value === "resolved" ? value : "uncertain";

// ─── Chunk analysis ───────────────────────────────────────────────────────────

const CHUNK_SYSTEM = `You are a close, thoughtful reading companion. Given a saved passage from a book, create grounded structured notes that feel natural and alive rather than like a report.
Respond ONLY with a valid JSON object — no markdown, no preamble, no trailing text.`;

export function buildChunkPrompt(opts: ChunkInput): string {
  return buildChunkBatchPrompt([opts]);
}

function sessionShape(): string {
  return `{"session":1,"schema_version":2,"session_title":"...","close_reading":"...","starting_context":"...","what_changes":[{"label":"...","detail":"...","significance":"..."}],"threads":[{"id":"stable-kebab-id","label":"...","status":"introduced|deepened|shifted|resolved|uncertain","detail":"...","prior_connection":null}],"entities":[{"id":"stable-kebab-id","name":"...","kind":"person|organisation|idea|force","role_now":"...","change_from_prior":null}],"evidence":[{"text":"verbatim quote","page_start":1,"why_it_matters":"..."}],"handoff":"...","session_summary":"...","chunk_summary":"...","concepts":[{"name":"...","definition":"..."}],"themes":[{"name":"...","description":"..."}],"people":[{"name":"...","pulse":"..."}],"notable_quotes":[{"text":"verbatim quote","page_start":1}]}`;
}

/** Build one provider request for up to five independent saved reading sessions. */
export function buildChunkBatchPrompt(inputs: ChunkInput[]): string {
  if (!inputs.length || inputs.length > AI_READER_BATCH_SIZE) throw new Error(`AI Reader batch must contain 1–${AI_READER_BATCH_SIZE} sessions`);
  const sessions = inputs.map((input, index) => `SESSION ${index + 1} (pages ${input.pageStart}–${input.pageEnd} of ${input.totalPages})\n${input.text.slice(0, 12_000)}`).join("\n\n---\n\n");
  return `${langInstruction(inputs[0].lang)}
Book: "${inputs[0].title}" by ${inputs[0].author}
Analyse every saved session independently, preserving continuity only from evidence in that session. Return exactly {"analyses":[${sessionShape()}]}.
Rules: exactly one analysis per SESSION in order; all ids must be stable lower-case kebab ids; use []/null if absent; evidence and notable_quotes are verbatim and page_start is within that session; do not invent events or unseen context; session_summary is concise and handoff tells the next reader what to carry forward. Write close_reading, session_summary, and map text in a warm, direct reader-companion voice: begin with what is happening, shifting, or becoming clear. Never use report-like openings such as "This passage introduces/discusses/presents", "The excerpt", "Đoạn văn giới thiệu", "Đoạn trích trình bày", or "Tác giả nói về". Give every session_title a specific, evocative title grounded in the text; never return "Untitled", "Reading session", or a generic page label.

${sessions}`;
}

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const readerId = (value: unknown, fallback: string): string => clean(value, fallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || fallback;
export function parseChunkAnalysis(raw: string): ChunkAnalysis {
  const data = extractJson(raw);
  const quotes = arr(data.notable_quotes, 3, (v) => { const r=object(v), text=clean(r.text); return text ? { text, page_start: wholeNumber(r.page_start) } : null; });
  return {
    schema_version: AI_READER_SCHEMA_VERSION,
    session_title: clean(data.session_title, "Reading session"), close_reading: clean(data.close_reading, clean(data.chunk_summary, "No close reading available.")),
    starting_context: clean(data.starting_context, "This is the first recorded session or prior context is not established."),
    what_changes: arr(data.what_changes, 6, (v) => { const r=object(v), label=clean(r.label); return label ? {label, detail:clean(r.detail), significance:clean(r.significance)} : null; }),
    threads: arr(data.threads, 8, (v) => { const r=object(v), label=clean(r.label); return label ? {id:readerId(r.id,label), label, status:["introduced","deepened","shifted","resolved"].includes(String(r.status)) ? r.status as ReaderThreadStatus : "uncertain", detail:clean(r.detail), prior_connection:clean(r.prior_connection) || null} : null; }),
    entities: arr(data.entities, 10, (v) => { const r=object(v), name=clean(r.name); const kind=["person","organisation","idea","force"].includes(String(r.kind)) ? r.kind as ReaderEntity["kind"] : "idea"; return name ? {id:readerId(r.id,name),name,kind,role_now:clean(r.role_now),change_from_prior:clean(r.change_from_prior)||null} : null; }),
    evidence: arr(data.evidence, 4, (v) => { const r=object(v), text=clean(r.text); return text ? {text,page_start:wholeNumber(r.page_start),why_it_matters:clean(r.why_it_matters)} : null; }),
    handoff: clean(data.handoff, "No additional handoff recorded."), session_summary: clean(data.session_summary, clean(data.chunk_summary, "No summary available.")),
    chunk_summary: clean(data.chunk_summary, clean(data.session_summary, "No summary available.")),
    concepts: arr(data.concepts,6,(v)=>{const r=object(v),name=clean(r.name);return name?{name,definition:clean(r.definition)}:null;}),
    themes: arr(data.themes,4,(v)=>{const r=object(v),name=clean(r.name);return name?{name,description:clean(r.description)}:null;}),
    people: arr(data.people,5,(v)=>{const r=object(v),name=clean(r.name);return name?{name,pulse:clean(r.pulse)}:null;}), notable_quotes:quotes,
  };
}
export function parseChunkBatchAnalysis(raw: string, expectedCount: number): ChunkAnalysis[] {
 const data=extractJson(raw); if(!Array.isArray(data.analyses)||data.analyses.length!==expectedCount) throw new Error(`AI Reader: expected ${expectedCount} batch analyses`);
 return data.analyses.map((item,index)=>{const row=object(item);if(row.session!==index+1)throw new Error("AI Reader: batch analyses must preserve session order");return parseChunkAnalysis(JSON.stringify(row));});
}
export async function analyseChunk(opts: ChunkInput): Promise<ChunkAnalysis> { return (await analyseChunkBatch([opts]))[0]; }
export async function analyseChunkBatch(inputs: ChunkInput[]): Promise<ChunkAnalysis[]> { const raw=await callLLM(CHUNK_SYSTEM,buildChunkBatchPrompt(inputs),0.3,true,true); return parseChunkBatchAnalysis(raw,inputs.length); }

// ─── Wiki synthesis ───────────────────────────────────────────────────────────

const SYNTHESIS_SYSTEM = `You are an analytical AI reader synthesising knowledge from multiple reading sessions.
Respond ONLY with a valid JSON object — no markdown, no preamble, no trailing text.`;

export function buildSynthesisPrompt(opts: {
  title: string;
  author: string;
  totalPages: number;
  pagesCovered: number;
  lang: "auto" | "vi" | "en";
  chunks: ChunkForSynthesis[];
}): string {
  const { title, author, totalPages, pagesCovered, lang, chunks } = opts;

  const chunkSummaries = chunks
    .map((c) => `Session ${c.logId || ""}, pages ${c.pageStart}–${c.pageEnd}: ${c.analysis.chunk_summary}`)
    .join("\n");

  const allConcepts = chunks.flatMap((c) => c.analysis.concepts.map((x) => x.name)).join(", ");
  const allThemes = chunks.flatMap((c) => c.analysis.themes.map((x) => x.name)).join(", ");
  const allPeople = chunks.flatMap((c) => c.analysis.people.map((x) => x.name)).join(", ");

  return `${langInstruction(lang)}

Book: "${title}" by ${author}
Reader has read pages 1–${pagesCovered} of ${totalPages} total pages. This is a partial reading record, not the complete book.

Chapter-by-chapter summaries:
${chunkSummaries}

Concepts mentioned across sessions: ${allConcepts || "none"}
Themes mentioned across sessions: ${allThemes || "none"}
People/characters mentioned: ${allPeople || "none"}

Synthesise these into a full knowledge wiki. Return a JSON object with exactly these keys:
{
  "overview": "3–5 sentence synthesis of the book so far — core argument, structure, tone",
  "concepts": [{"name": "...", "definition": "..."}, ...],      // up to 10 most important concepts, deduplicated
  "themes": [{"name": "...", "description": "..."}, ...],       // up to 6 themes, deduplicated
  "people": [{"name": "...", "pulse": "..."}, ...],             // up to 8 people/characters, deduplicated
  "chapter_map": [
    {"page_start": N, "page_end": N, "title": "...", "summary": "..."},
    ...
  ],
  "notable_quotes": [{"text": "...", "page_start": N}, ...],    // up to 5 best quotes across all sessions
  "open_questions": ["...", ...],                                // up to 5 questions the book has raised but not yet answered
  "book_so_far": "3–5 sentence spoiler-safe narrative recap through the current reading position",
  "current_position": {"page_start": 1, "page_end": ${pagesCovered}, "label": "where the reader currently is"},
  "narrative_arc": [{"label": "...", "status": "introduced|developing|resolved|uncertain", "detail": "grounded progress so far"}],
  "carry_forward_insights": ["facts, tensions, or concepts worth remembering before the next session"],
  "reading_path": [{"log_id":"session identifier or empty","page_start":N,"page_end":N,"title":"...","summary":"...","turning_point":"...","connected_from":null}],
  "thread_map": [{"id":"...","label":"...","status":"active|resolved|uncertain","evolution":[{"log_id":"...","page_start":N,"note":"..."}]}],
  "entity_map": [{"id":"...","name":"...","kind":"...","current_state":"...","appearances":[{"log_id":"...","page_start":N,"note":"..."}]}],
  "connections": [{"from_type":"thread|entity|session","from_id":"...","to_type":"thread|entity|session","to_id":"...","label":"...","explanation":"...","page_start":N}],
  "current_reading_state":{"summary":"...","active_threads":["..."],"active_entities":["..."]},
  "next_session_context":"spoiler-safe continuation context"
}

Rules:
- Deduplicate: if the same concept or theme appears in multiple sessions, merge into one entry
- chapter_map must have one entry per reading session chunk (${chunks.length} entries)
- open_questions should reflect genuine tensions or unresolved ideas so far
- Ground every statement in the supplied chunk summaries and lists; do not infer unseen events or use outside knowledge
- Never reveal, predict, or hint at events beyond page ${pagesCovered}; if unsure, use "uncertain"
- book_so_far, current_position, narrative_arc, and carry_forward_insights must describe only what the reader has reached
- Write all reader-facing prose as a warm, direct companion. Start with the situation, movement, tension, or consequence—not a report about the text. Never start any prose with "This passage", "The excerpt", "Đoạn văn", "Đoạn trích", or "Tác giả".
- Use concrete, natural titles for reading_path entries; never use "Untitled", "Reading session", or generic page labels.
- Keep all text concise`;
}

export function parseSynthesis(raw: string, chunks: ChunkForSynthesis[], opts?: { pagesCovered?: number; lang?: SummaryLanguage }): Omit<BookWiki, "pages_covered"> {
  const data = extractJson(raw);
  const pagesCovered = Math.max(0, opts?.pagesCovered ?? Math.max(0, ...chunks.map((chunk) => chunk.pageEnd)));

  const chapter_map: WikiChapterEntry[] = arr(data.chapter_map, 50, (item) => {
    const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const title = clean(r.title, "Reading session");
    const summary = clean(r.summary, "");
    const page_start = typeof r.page_start === "number" ? r.page_start : 0;
    const page_end = typeof r.page_end === "number" ? r.page_end : 0;
    return { page_start, page_end, title, summary };
  });

  // Fall back to chunk data if synthesis chapter_map is malformed
  const finalChapterMap =
    chapter_map.length === chunks.length
      ? chapter_map
      : chunks.map((c) => ({
          page_start: c.pageStart,
          page_end: c.pageEnd,
          title: `Pages ${c.pageStart}–${c.pageEnd}`,
          summary: c.analysis.chunk_summary,
        }));

  const position = data.current_position && typeof data.current_position === "object" && !Array.isArray(data.current_position) ? data.current_position as Record<string, unknown> : {};
  const current_position: NarrativePosition = { page_start: Math.min(pagesCovered, wholeNumber(position.page_start, chunks[0]?.pageStart || 0)), page_end: Math.min(pagesCovered, Math.max(wholeNumber(position.page_end, pagesCovered), wholeNumber(position.page_start, 0))), label: clean(position.label, `Pages 1–${pagesCovered}`) };

  return {
    schema_version: AI_READER_SCHEMA_VERSION,
    output_language: resolveLanguage(opts?.lang || "auto", ""),
    overview: clean(data.overview, "Overview not yet available."),
    concepts: arr(data.concepts, 10, (item) => {
      const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const name = clean(r.name);
      return name ? { name, definition: clean(r.definition) } : null;
    }),
    themes: arr(data.themes, 6, (item) => {
      const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const name = clean(r.name);
      return name ? { name, description: clean(r.description) } : null;
    }),
    people: arr(data.people, 8, (item) => {
      const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const name = clean(r.name);
      return name ? { name, pulse: clean(r.pulse) } : null;
    }),
    chapter_map: finalChapterMap,
    notable_quotes: arr(data.notable_quotes, 5, (item) => {
      const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const text = clean(r.text);
      const page_start = typeof r.page_start === "number" ? r.page_start : 0;
      return text ? { text, page_start } : null;
    }),
    open_questions: arr(data.open_questions, 5, (item) =>
      typeof item === "string" ? clean(item) || null : null
    ),
    book_so_far: clean(data.book_so_far, clean(data.overview, "Overview not yet available.")),
    current_position,
    narrative_arc: arr(data.narrative_arc, 8, (item) => {
      const row = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
      const label = clean(row.label);
      return label ? { label, status: narrativeStatus(row.status), detail: clean(row.detail, "Not established in the completed reading.") } : null;
    }),
    carry_forward_insights: arr(data.carry_forward_insights, 8, (item) => typeof item === "string" ? clean(item) || null : null),
    reading_path: arr(data.reading_path, 50, (v) => { const r=object(v); return { log_id:clean(r.log_id), page_start:wholeNumber(r.page_start), page_end:wholeNumber(r.page_end), title:clean(r.title,"Reading session"), summary:clean(r.summary), turning_point:clean(r.turning_point), connected_from:clean(r.connected_from)||null }; }),
    thread_map: arr(data.thread_map, 20, (v) => { const r=object(v), label=clean(r.label); return label ? { id:readerId(r.id,label), label, status:["active","resolved"].includes(String(r.status)) ? r.status as ReaderMapThread["status"] : "uncertain", evolution:arr(r.evolution,50,(e)=>{const x=object(e);return {log_id:clean(x.log_id),page_start:wholeNumber(x.page_start),note:clean(x.note)}}) } : null; }),
    entity_map: arr(data.entity_map, 30, (v) => { const r=object(v), name=clean(r.name); return name ? {id:readerId(r.id,name),name,kind:clean(r.kind,"idea"),current_state:clean(r.current_state),appearances:arr(r.appearances,50,(e)=>{const x=object(e);return {log_id:clean(x.log_id),page_start:wholeNumber(x.page_start),note:clean(x.note)}})} : null; }),
    connections: arr(data.connections, 50, (v) => { const r=object(v), ft=String(r.from_type), tt=String(r.to_type); return ["thread","entity","session"].includes(ft) && ["thread","entity","session"].includes(tt) ? {from_type:ft as ReaderConnection["from_type"],from_id:clean(r.from_id),to_type:tt as ReaderConnection["to_type"],to_id:clean(r.to_id),label:clean(r.label),explanation:clean(r.explanation),page_start:wholeNumber(r.page_start)} : null; }),
    current_reading_state: (() => { const r=object(data.current_reading_state); return {summary:clean(r.summary,clean(data.book_so_far)),active_threads:arr(r.active_threads,12,(v)=>typeof v === "string" ? clean(v)||null:null),active_entities:arr(r.active_entities,12,(v)=>typeof v === "string" ? clean(v)||null:null)}; })(),
    next_session_context: clean(data.next_session_context, clean(data.book_so_far)),
  };
}

export async function synthesiseWiki(opts: {
  title: string;
  author: string;
  totalPages: number;
  pagesCovered: number;
  lang: "auto" | "vi" | "en";
  chunks: ChunkForSynthesis[];
}): Promise<Omit<BookWiki, "pages_covered">> {
  const prompt = buildSynthesisPrompt(opts);
  const raw = await callLLM(SYNTHESIS_SYSTEM, prompt, 0.3, true, true);
  return parseSynthesis(raw, opts.chunks, { pagesCovered: opts.pagesCovered, lang: opts.lang });
}

/**
 * Process a single book for the AI Reader:
 *   1. Find reading_log sessions not yet processed
 *   2. Extract text for each session
 *   3. Run chunk analysis (LLM) and save results
 *   4. Synthesise all chunks into updated book_wiki
 *
 * Returns true if the wiki was updated, false if nothing to do.
 */
const activeBookProcesses = new Map<string, Promise<boolean>>();

/**
 * Queue work per book so consecutive Read Today actions cannot synthesize
 * overlapping snapshots and overwrite newer coverage with an older one.
 */
export async function processBookForWiki(bookId: string, force = false): Promise<boolean> {
  const prior = activeBookProcesses.get(bookId) || Promise.resolve(false);
  const queued = prior.catch(() => false).then(() => processBookForWikiNow(bookId, force));
  activeBookProcesses.set(bookId, queued);
  try {
    return await queued;
  } finally {
    if (activeBookProcesses.get(bookId) === queued) activeBookProcesses.delete(bookId);
  }
}

async function processBookForWikiNow(bookId: string, force = false): Promise<boolean> {
  // Fetch book metadata
  const { rows: books } = await query(
    `SELECT id, title, author, file_path, file_type, total_pages, summary_lang
     FROM books WHERE id = $1`,
    [bookId]
  );
  const book = books[0];
  if (!book) throw new Error(`Book ${bookId} not found`);

  const lang = language(book.summary_lang);

  // Get all reading sessions ordered chronologically
  const { rows: logs } = await query(
    `SELECT id, page_start, page_end, date, session, raw_text
     FROM reading_log
     WHERE book_id = $1 AND raw_text IS NOT NULL AND raw_text != ''
     ORDER BY date ASC, session ASC`,
    [bookId]
  );

  if (logs.length === 0) return false;

  // Find which sessions haven't been chunked yet
  const { rows: processed } = await query(
    "SELECT log_id FROM ai_reader_chunks WHERE book_id = $1",
    [bookId]
  );
  const processedIds = new Set(processed.map((r: any) => r.log_id));

  const unprocessed = force ? logs : logs.filter((l: any) => !processedIds.has(l.id));

  if (unprocessed.length === 0) return false;

  // AI Reader is grounded strictly in text persisted with each reading session.
  // Never re-open the source PDF/EPUB: an older log without raw_text remains
  // unavailable until an owner explicitly rebuilds it through a supported flow.
  const inputs: Array<{ log: any; input: ChunkInput }> = [];
  for (const log of unprocessed) {
    const text = typeof log.raw_text === "string" ? log.raw_text.trim() : "";
    if (!text) {
      console.warn(`[ai-reader] Session p.${log.page_start}–${log.page_end} skipped: no persisted raw_text`);
      continue;
    }
    inputs.push({
      log,
      input: { title: book.title, author: book.author, pageStart: log.page_start, pageEnd: log.page_end, totalPages: book.total_pages, lang, text },
    });
  }

  const batches = Array.from(
    { length: Math.ceil(inputs.length / AI_READER_BATCH_SIZE) },
    (_, index) => inputs.slice(index * AI_READER_BATCH_SIZE, (index + 1) * AI_READER_BATCH_SIZE)
  );
  let nextBatch = 0;
  const worker = async () => {
    while (nextBatch < batches.length) {
      const batch = batches[nextBatch++];
      try {
        const analyses = await analyseChunkBatch(batch.map((item) => item.input));
        await Promise.all(batch.map(async ({ log }, index) => {
          const analysis = analyses[index];
          await query(
            `INSERT INTO ai_reader_chunks (book_id, log_id, page_start, page_end, chunk_analysis)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (log_id) DO UPDATE SET
               chunk_analysis = CASE WHEN $6 THEN EXCLUDED.chunk_analysis ELSE ai_reader_chunks.chunk_analysis END,
               processed_at = CASE WHEN $6 THEN now() ELSE ai_reader_chunks.processed_at END`,
            [bookId, log.id, log.page_start, log.page_end, JSON.stringify(analysis), force]
          );
          processedIds.add(log.id);
        }));
      } catch (err: any) {
        console.error(`[ai-reader] Batch p.${batch[0].log.page_start}–${batch.at(-1)?.log.page_end} failed: ${err.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(AI_READER_CONCURRENCY, batches.length) }, worker));

  // Synthesise wiki from all chunks for this book
  const { rows: allChunkRows } = await query(
    `SELECT c.log_id, c.page_start, c.page_end, c.chunk_analysis
     FROM ai_reader_chunks c
     WHERE c.book_id = $1
     ORDER BY c.page_start ASC`,
    [bookId]
  );

  if (allChunkRows.length === 0) return false;

  const chunks: ChunkForSynthesis[] = allChunkRows.map((r: any) => ({
    logId: r.log_id,
    pageStart: r.page_start,
    pageEnd: r.page_end,
    analysis: r.chunk_analysis as ChunkAnalysis,
  }));

  const pagesCovered = Math.max(...allChunkRows.map((r: any) => r.page_end));

  const wiki = await synthesiseWiki({
    title: book.title,
    author: book.author,
    totalPages: book.total_pages,
    pagesCovered,
    lang,
    chunks,
  });

  wiki.output_language = resolveLanguage(lang, inputs.map(({ input }) => input.text).join("\n"));
  // Preserve a navigable connected map even if a model omits optional V2 maps.
  if (!wiki.reading_path.length) wiki.reading_path = chunks.map((chunk, index) => ({ log_id: chunk.logId || "", page_start: chunk.pageStart, page_end: chunk.pageEnd, title: chunk.analysis.session_title || `Pages ${chunk.pageStart}–${chunk.pageEnd}`, summary: chunk.analysis.session_summary, turning_point: chunk.analysis.what_changes[0]?.significance || "Session recorded.", connected_from: index ? chunks[index - 1].logId || null : null }));
  const generationMs = Date.now();

  await query(
    `INSERT INTO book_wiki (book_id, schema_version, output_language, pages_covered, overview, concepts, themes, people, chapter_map, notable_quotes, open_questions, book_so_far, current_position, narrative_arc, carry_forward_insights, reading_path, thread_map, entity_map, connections, current_reading_state, next_session_context, generated_at, generation_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, now(), $22)
     ON CONFLICT (book_id) DO UPDATE SET
       schema_version = EXCLUDED.schema_version,
       output_language = EXCLUDED.output_language,
       pages_covered = EXCLUDED.pages_covered,
       overview = EXCLUDED.overview,
       concepts = EXCLUDED.concepts,
       themes = EXCLUDED.themes,
       people = EXCLUDED.people,
       chapter_map = EXCLUDED.chapter_map,
       notable_quotes = EXCLUDED.notable_quotes,
       open_questions = EXCLUDED.open_questions,
       book_so_far = EXCLUDED.book_so_far,
       current_position = EXCLUDED.current_position,
       narrative_arc = EXCLUDED.narrative_arc,
       carry_forward_insights = EXCLUDED.carry_forward_insights,
       reading_path = EXCLUDED.reading_path, thread_map = EXCLUDED.thread_map, entity_map = EXCLUDED.entity_map, connections = EXCLUDED.connections, current_reading_state = EXCLUDED.current_reading_state, next_session_context = EXCLUDED.next_session_context,
       generated_at = now(),
       generation_ms = EXCLUDED.generation_ms
     WHERE book_wiki.pages_covered <= EXCLUDED.pages_covered`,
    [
      bookId,
      wiki.schema_version,
      wiki.output_language,
      pagesCovered,
      wiki.overview,
      JSON.stringify(wiki.concepts),
      JSON.stringify(wiki.themes),
      JSON.stringify(wiki.people),
      JSON.stringify(wiki.chapter_map),
      JSON.stringify(wiki.notable_quotes),
      JSON.stringify(wiki.open_questions),
      wiki.book_so_far,
      JSON.stringify(wiki.current_position),
      JSON.stringify(wiki.narrative_arc),
      JSON.stringify(wiki.carry_forward_insights),
      JSON.stringify(wiki.reading_path), JSON.stringify(wiki.thread_map), JSON.stringify(wiki.entity_map), JSON.stringify(wiki.connections), JSON.stringify(wiki.current_reading_state), wiki.next_session_context,
      Date.now() - generationMs,
    ]
  );

  return true;
}
