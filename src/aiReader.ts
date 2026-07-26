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

export interface BookWiki {
  pages_covered: number;
  overview: string;
  concepts: WikiConcept[];
  themes: WikiTheme[];
  people: WikiPerson[];
  chapter_map: WikiChapterEntry[];
  notable_quotes: WikiQuote[];
  open_questions: string[];
}

export interface ChunkAnalysis {
  concepts: WikiConcept[];
  themes: WikiTheme[];
  people: WikiPerson[];
  notable_quotes: WikiQuote[];
  chunk_summary: string;
}

export interface ChunkForSynthesis {
  pageStart: number;
  pageEnd: number;
  analysis: ChunkAnalysis;
}

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

function langInstruction(lang: "auto" | "vi" | "en"): string {
  if (lang === "vi") return "Write all text fields entirely in Vietnamese.";
  if (lang === "en") return "Write all text fields entirely in English.";
  return "Match the language of the source text for all text fields.";
}

// ─── Chunk analysis ───────────────────────────────────────────────────────────

const CHUNK_SYSTEM = `You are an analytical AI reader. Given a passage from a book, extract structured knowledge.
Respond ONLY with a valid JSON object — no markdown, no preamble, no trailing text.`;

export function buildChunkPrompt(opts: {
  title: string;
  author: string;
  pageStart: number;
  pageEnd: number;
  totalPages: number;
  lang: "auto" | "vi" | "en";
  text: string;
}): string {
  const { title, author, pageStart, pageEnd, totalPages, lang, text } = opts;
  const bounded = text.slice(0, 12_000); // ~3000 tokens, safe for most context windows
  return `${langInstruction(lang)}

Book: "${title}" by ${author} (pages ${pageStart}–${pageEnd} of ${totalPages})

Analyse this passage and return a JSON object with exactly these keys:
{
  "chunk_summary": "2–3 sentence summary of what this passage covers",
  "concepts": [{"name": "...", "definition": "..."}, ...],      // up to 6 key ideas/frameworks introduced
  "themes": [{"name": "...", "description": "..."}, ...],       // up to 4 recurring threads
  "people": [{"name": "...", "pulse": "..."}, ...],             // up to 5 people/characters (name + one-line role or status)
  "notable_quotes": [{"text": "...", "page_start": ${pageStart}}, ...]  // up to 3 verbatim quotes from the passage
}

Rules:
- notable_quotes must be verbatim text found in the passage — never invented
- If a field has nothing relevant, return an empty array []
- Keep definitions and descriptions concise (under 120 characters)

Passage:
${bounded}`;
}

export function parseChunkAnalysis(raw: string): ChunkAnalysis {
  const data = extractJson(raw);
  return {
    chunk_summary: clean(data.chunk_summary, "No summary available."),
    concepts: arr(data.concepts, 6, (item) => {
      const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const name = clean(r.name);
      const definition = clean(r.definition);
      return name ? { name, definition } : null;
    }),
    themes: arr(data.themes, 4, (item) => {
      const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const name = clean(r.name);
      const description = clean(r.description);
      return name ? { name, description } : null;
    }),
    people: arr(data.people, 5, (item) => {
      const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const name = clean(r.name);
      const pulse = clean(r.pulse);
      return name ? { name, pulse } : null;
    }),
    notable_quotes: arr(data.notable_quotes, 3, (item) => {
      const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const text = clean(r.text);
      const page_start = typeof r.page_start === "number" ? r.page_start : 0;
      return text ? { text, page_start } : null;
    }),
  };
}

export async function analyseChunk(opts: {
  title: string;
  author: string;
  pageStart: number;
  pageEnd: number;
  totalPages: number;
  lang: "auto" | "vi" | "en";
  text: string;
}): Promise<ChunkAnalysis> {
  const prompt = buildChunkPrompt(opts);
  const raw = await callLLM(CHUNK_SYSTEM, prompt, 0.3, true, true);
  return parseChunkAnalysis(raw);
}

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
    .map((c) => `Pages ${c.pageStart}–${c.pageEnd}: ${c.analysis.chunk_summary}`)
    .join("\n");

  const allConcepts = chunks.flatMap((c) => c.analysis.concepts.map((x) => x.name)).join(", ");
  const allThemes = chunks.flatMap((c) => c.analysis.themes.map((x) => x.name)).join(", ");
  const allPeople = chunks.flatMap((c) => c.analysis.people.map((x) => x.name)).join(", ");

  return `${langInstruction(lang)}

Book: "${title}" by ${author}
Reader has read pages 1–${pagesCovered} of ${totalPages} total pages.

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
  "open_questions": ["...", ...]                                 // up to 5 questions the book has raised but not yet answered
}

Rules:
- Deduplicate: if the same concept or theme appears in multiple sessions, merge into one entry
- chapter_map must have one entry per reading session chunk (${chunks.length} entries)
- open_questions should reflect genuine tensions or unresolved ideas so far
- Keep all text concise`;
}

export function parseSynthesis(raw: string, chunks: ChunkForSynthesis[]): Omit<BookWiki, "pages_covered"> {
  const data = extractJson(raw);

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

  return {
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
      typeof item === "string" ? item.slice(0, MAX_STR) : null
    ),
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
  return parseSynthesis(raw, opts.chunks);
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
export async function processBookForWiki(bookId: string, force = false): Promise<boolean> {
  // Fetch book metadata
  const { rows: books } = await query(
    `SELECT id, title, author, file_path, file_type, total_pages, summary_lang
     FROM books WHERE id = $1`,
    [bookId]
  );
  const book = books[0];
  if (!book) throw new Error(`Book ${bookId} not found`);

  const lang = (["auto", "vi", "en"].includes(book.summary_lang) ? book.summary_lang : "auto") as "auto" | "vi" | "en";

  // Get all reading sessions ordered chronologically
  const { rows: logs } = await query(
    `SELECT id, page_start, page_end, date, session
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

  // Process each unprocessed session
  for (const log of unprocessed) {
    try {
      const { text } = await extractRange(book.file_path, book.file_type as "pdf" | "epub", log.page_start, log.page_end);

      if (!text.trim()) continue;

      const analysis = await analyseChunk({
        title: book.title,
        author: book.author,
        pageStart: log.page_start,
        pageEnd: log.page_end,
        totalPages: book.total_pages,
        lang,
        text,
      });

      if (force) {
        await query(
          `INSERT INTO ai_reader_chunks (book_id, log_id, page_start, page_end, chunk_analysis)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (log_id) DO UPDATE
             SET chunk_analysis = EXCLUDED.chunk_analysis,
                 processed_at = now()`,
          [bookId, log.id, log.page_start, log.page_end, JSON.stringify(analysis)]
        );
      } else {
        await query(
          `INSERT INTO ai_reader_chunks (book_id, log_id, page_start, page_end, chunk_analysis)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (log_id) DO NOTHING`,
          [bookId, log.id, log.page_start, log.page_end, JSON.stringify(analysis)]
        );
      }

      processedIds.add(log.id);
    } catch (err: any) {
      console.error(`[ai-reader] Session p.${log.page_start}–${log.page_end} failed: ${err.message}`);
    }
  }

  // Synthesise wiki from all chunks for this book
  const { rows: allChunkRows } = await query(
    `SELECT c.page_start, c.page_end, c.chunk_analysis
     FROM ai_reader_chunks c
     WHERE c.book_id = $1
     ORDER BY c.page_start ASC`,
    [bookId]
  );

  if (allChunkRows.length === 0) return false;

  const chunks: ChunkForSynthesis[] = allChunkRows.map((r: any) => ({
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

  const generationMs = Date.now();

  await query(
    `INSERT INTO book_wiki (book_id, pages_covered, overview, concepts, themes, people, chapter_map, notable_quotes, open_questions, generated_at, generation_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10)
     ON CONFLICT (book_id) DO UPDATE SET
       pages_covered  = EXCLUDED.pages_covered,
       overview       = EXCLUDED.overview,
       concepts       = EXCLUDED.concepts,
       themes         = EXCLUDED.themes,
       people         = EXCLUDED.people,
       chapter_map    = EXCLUDED.chapter_map,
       notable_quotes = EXCLUDED.notable_quotes,
       open_questions = EXCLUDED.open_questions,
       generated_at   = now(),
       generation_ms  = EXCLUDED.generation_ms`,
    [
      bookId,
      pagesCovered,
      wiki.overview,
      JSON.stringify(wiki.concepts),
      JSON.stringify(wiki.themes),
      JSON.stringify(wiki.people),
      JSON.stringify(wiki.chapter_map),
      JSON.stringify(wiki.notable_quotes),
      JSON.stringify(wiki.open_questions),
      Date.now() - generationMs,
    ]
  );

  return true;
}
