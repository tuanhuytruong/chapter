import { query } from "./db.js";

export type StoryThread = { id: string; label: string; status: "open" | "escalating" | "resolved" | "uncertain"; detail: string };
export type StoryCharacter = { name: string; pulse: string };
export type StoryCharacterArc = { name: string; development: string };
export type StoryRelationship = { people: string[]; detail: string };
export type StoryAnalysis = {
  storyRecap: string;
  storySoFar?: string;
  changedEvents: string[];
  threads: StoryThread[];
  characterPulse: StoryCharacter[];
  // Optional so analyses created before Character Storylines remain readable.
  characterArcs?: StoryCharacterArc[];
  characterRelationships?: StoryRelationship[];
  readerMemory: string[];
  confidenceNotes: string[];
};
export type StoryState = Pick<StoryAnalysis, "storySoFar" | "threads" | "characterPulse" | "readerMemory">;
export type StoryJobStatus = "generating" | "ready" | "failed";
export type StoryThreadSession = { log_id: string; session: number; reading_round: number; page_start: number; page_end: number; date: string; analysis: StoryAnalysis | null; storyStatus: StoryJobStatus; attemptCount: number; errorMessage: string | null; startedAt: string | null; completedAt: string | null; };

const MAX_TEXT = 900;
/** A single reading range can contain enough PDF text to overwhelm the provider.
 * Keep the complete start/end context while bounding request size deterministically. */
export const STORY_THREAD_MAX_SOURCE_CHARS = 24_000;
const clean = (value: unknown, fallback = ""): string => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT) || fallback : fallback;

export function boundStoryThreadSource(sourceText: string): string {
  const text = sourceText.trim();
  if (text.length <= STORY_THREAD_MAX_SOURCE_CHARS) return text;
  const first = Math.floor(STORY_THREAD_MAX_SOURCE_CHARS * 0.55);
  const last = STORY_THREAD_MAX_SOURCE_CHARS - first;
  return `${text.slice(0, first)}\n\n[Middle of this reading range omitted for provider length; do not infer events from it.]\n\n${text.slice(-last)}`;
}
const strings = (value: unknown, max: number): string[] => Array.isArray(value) ? value.map((item) => clean(item)).filter(Boolean).slice(0, max) : [];
const objects = (value: unknown, max: number): Record<string, unknown>[] => Array.isArray(value) ? value.slice(0, max).map((item) => item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {}) : [];
const status = (value: unknown): StoryThread["status"] => ["open", "escalating", "resolved", "uncertain"].includes(String(value)) ? value as StoryThread["status"] : "uncertain";
const noConfidenceNote = (value: string) => /^(không có|không có sự không chắc chắn nào trong văn bản hiện tại|no uncertainty(?: is present in the current text)?|grounded strictly in current text)\.?$/iu.test(value.trim());
const safeError = (error: unknown) => error instanceof Error && /timeout/i.test(error.message) ? "Story Thread timed out. Please retry." : "Story Thread could not be generated. Please retry.";
export async function markStoryThreadGenerating(log: { id: string; book_id: string; reading_round: number }): Promise<void> { await query(`INSERT INTO story_thread_jobs (log_id,book_id,reading_round,status,attempt_count,error_message,started_at,completed_at,updated_at) VALUES ($1,$2,$3,'generating',1,NULL,now(),NULL,now()) ON CONFLICT (log_id) DO UPDATE SET status='generating',attempt_count=story_thread_jobs.attempt_count+1,error_message=NULL,started_at=now(),completed_at=NULL,updated_at=now()`, [log.id, log.book_id, log.reading_round]); }
export async function markStoryThreadReady(logId: string): Promise<void> { await query("UPDATE story_thread_jobs SET status='ready', completed_at=now(), updated_at=now() WHERE log_id=$1", [logId]); }
export async function markStoryThreadFailed(logId: string, error: unknown): Promise<void> { await query("UPDATE story_thread_jobs SET status='failed', error_message=$2, updated_at=now() WHERE log_id=$1", [logId, safeError(error)]); }

function objectJson(raw: string): Record<string, unknown> {
  const body = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] || raw.trim();
  const start = body.indexOf("{"); const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Story Thread response did not contain JSON");
  const parsed: unknown = JSON.parse(body.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Story Thread response must be a JSON object");
  return parsed as Record<string, unknown>;
}

/** Strictly parse untrusted Story Thread JSON into bounded V1 data. */
export function parseStoryThreadAnalysis(raw: string): StoryAnalysis {
  const data = objectJson(raw);
  for (const key of ["storyRecap", "changedEvents", "threads", "characterPulse", "readerMemory", "confidenceNotes"]) if (!(key in data)) throw new Error(`Story Thread response missing ${key}`);
  const threads = Array.isArray(data.threads) ? data.threads.slice(0, 8).map((item) => {
    const row = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
    return { id: clean(row.id, "unnamed-thread"), label: clean(row.label, "Unnamed thread"), status: status(row.status), detail: clean(row.detail, "Not established in this reading.") };
  }) : [];
  const characterPulse = Array.isArray(data.characterPulse) ? data.characterPulse.slice(0, 8).map((item) => {
    const row = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
    return { name: clean(row.name, "Unnamed character"), pulse: clean(row.pulse, "Not established in this reading.") };
  }) : [];
  const characterArcs = objects(data.characterArcs, 8).map((row) => ({ name: clean(row.name), development: clean(row.development) })).filter((row) => row.name && row.development);
  const characterRelationships = objects(data.characterRelationships, 8).map((row) => ({ people: strings(row.people, 4), detail: clean(row.detail) })).filter((row) => row.people.length >= 2 && row.detail);
  return { storyRecap: clean(data.storyRecap, "No grounded recap was established."), storySoFar: clean(data.storySoFar), changedEvents: strings(data.changedEvents, 8), threads, characterPulse, characterArcs, characterRelationships, readerMemory: strings(data.readerMemory, 6), confidenceNotes: strings(data.confidenceNotes, 6).filter((note) => !noConfidenceNote(note)) };
}

export function buildStoryThreadPrompt(input: { title: string; author: string; start: number; end: number; total: number; lang: "auto" | "vi" | "en"; sourceText: string; priorState: StoryState | null }): { system: string; user: string } {
  const language = input.lang === "vi" ? "Respond entirely in Vietnamese." : input.lang === "en" ? "Respond entirely in English." : /[ăâđêôơưĂÂĐÊÔƠƯ]/.test(input.sourceText) ? "The current reading is Vietnamese: respond entirely in Vietnamese." : "Match the predominant language of the current reading.";
  return {
    system: `You are Story Thread, a continuity companion for fiction. Ground every current event, character change, and quote-like detail in CURRENT READING TEXT. Prior state is only reader memory: preserve it only when compatible, never treat it as new evidence. Do not invent names, motives, events, chronology, or spoilers. Mark uncertainty in confidenceNotes. For storyRecap, write a warm reading-companion recap, not an event ledger: normally use 2–3 connected paragraphs when the source has enough material; enter through a concrete scene, movement, tension, gesture, or grounded emotional shift from the current reading; then carry cause → response → consequence with natural transitions. Never begin with meta labels such as “This section”, “This passage”, “In this part”, “Đoạn này”, “Phần này”, or “Tóm lại”. Do not pad a genuinely short source, invent interiority, or repeat the whole book. characterArcs records only an observed development for a named character in this reading. characterRelationships records only an observed state or change between 2–4 named characters. confidenceNotes are only for a real uncertainty, omission, or source limitation; use [] when there is none. Never state that there is no uncertainty. storySoFar is a concise cumulative narrative through this session; it must not duplicate storyRecap. ${language} Return JSON only with exactly these keys: {"storyRecap":"","storySoFar":"","changedEvents":[""],"threads":[{"id":"stable-short-id","label":"","status":"open|escalating|resolved|uncertain","detail":""}],"characterPulse":[{"name":"","pulse":""}],"characterArcs":[{"name":"","development":""}],"characterRelationships":[{"people":["",""],"detail":""}],"readerMemory":[""],"confidenceNotes":[""]}. Lists must be concise; threads/characters/arcs/relationships max 8, events max 8, memory max 6.`,
    user: `Book: ${input.title} by ${input.author}\nReading range: ${input.start}–${input.end} of ${input.total}\n\nPrior persisted story state (may be empty):\n${JSON.stringify(input.priorState || { storySoFar: "", threads: [], characterPulse: [], readerMemory: [] })}\n\nCurrent reading text:\n${input.sourceText}`,
  };
}

export function mergeStoryState(previous: StoryState | null, analysis: StoryAnalysis): StoryState {
  const byId = new Map<string, StoryThread>();
  for (const thread of previous?.threads || []) byId.set(thread.id, thread);
  for (const thread of analysis.threads) byId.set(thread.id, thread);
  const byName = new Map<string, StoryCharacter>();
  for (const character of previous?.characterPulse || []) byName.set(character.name.toLocaleLowerCase(), character);
  for (const character of analysis.characterPulse) byName.set(character.name.toLocaleLowerCase(), character);
  return { storySoFar: analysis.storySoFar || previous?.storySoFar || "", threads: [...byId.values()].slice(-16), characterPulse: [...byName.values()].slice(-16), readerMemory: [...new Set([...(previous?.readerMemory || []), ...analysis.readerMemory])].slice(-16) };
}

export async function getStoryStateBeforeLog(bookId: string, readingRound: number, date: string, session: number): Promise<StoryState | null> {
  const { rows } = await query<{ analysis: StoryAnalysis }>(
    `SELECT sta.analysis FROM story_thread_analyses sta
     JOIN reading_log rl ON rl.id=sta.log_id
     WHERE sta.book_id=$1 AND sta.schema_version=1 AND rl.reading_round=$2
       AND (rl.date < $3::date OR (rl.date = $3::date AND rl.session < $4))
     ORDER BY rl.date ASC, rl.session ASC`,
    [bookId, readingRound, date, session]
  );
  let state: StoryState | null = null;
  for (const item of rows) state = mergeStoryState(state, item.analysis);
  return state;
}
export async function upsertStoryThreadAnalysis(bookId: string, logId: string, analysis: StoryAnalysis): Promise<void> {
  await query(`INSERT INTO story_thread_analyses (book_id, log_id, schema_version, analysis, story_recap) VALUES ($1,$2,1,$3::jsonb,$4) ON CONFLICT (log_id, schema_version) DO UPDATE SET analysis=EXCLUDED.analysis, story_recap=EXCLUDED.story_recap, generated_at=now()`, [bookId, logId, JSON.stringify(analysis), analysis.storyRecap]);

  await markStoryThreadReady(logId);

  // Rebuild from every persisted session in chronological order. This prevents a
  // retry of an earlier log from replacing the newest Story State with stale data.
  const { rows: logRows } = await query<{ reading_round: number }>("SELECT reading_round FROM reading_log WHERE id=$1 AND book_id=$2", [logId, bookId]);
  const readingRound = logRows[0]?.reading_round;
  if (!readingRound) throw new Error("Story Thread log reading round was not found");
  const analyses = await listStoryThreadAnalyses(bookId, readingRound);
  let state: StoryState | null = null;
  for (const item of analyses) state = mergeStoryState(state, item.analysis as StoryAnalysis);
  const latest = analyses.at(-1);
  await query(`INSERT INTO story_state_snapshots (book_id, reading_round, last_log_id, state) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (book_id) DO UPDATE SET reading_round=EXCLUDED.reading_round, last_log_id=EXCLUDED.last_log_id, state=EXCLUDED.state, updated_at=now()`, [bookId, readingRound, latest?.log_id || logId, JSON.stringify(state || { threads: [], characterPulse: [], readerMemory: [] })]);
}
export async function getStoryThreadAnalysis(bookId: string, logId: string): Promise<any | null> { const { rows } = await query("SELECT * FROM story_thread_analyses WHERE book_id=$1 AND log_id=$2 AND schema_version=1", [bookId, logId]); return rows[0] || null; }
export async function listStoryThreadAnalyses(bookId: string, readingRound?: number): Promise<StoryThreadSession[]> {
  const scoped = Number.isInteger(readingRound) && (readingRound as number) > 0;
  return (await query<StoryThreadSession>(`SELECT rl.id AS log_id, rl.session, rl.reading_round, rl.page_start, rl.page_end, rl.date, sta.analysis, COALESCE(stj.status, CASE WHEN sta.log_id IS NULL THEN 'failed' ELSE 'ready' END) AS "storyStatus", COALESCE(stj.attempt_count,0) AS "attemptCount", stj.error_message AS "errorMessage", stj.started_at AS "startedAt", stj.completed_at AS "completedAt" FROM reading_log rl LEFT JOIN story_thread_analyses sta ON sta.log_id=rl.id AND sta.schema_version=1 LEFT JOIN story_thread_jobs stj ON stj.log_id=rl.id WHERE rl.book_id=$1 AND rl.raw_text IS NOT NULL${scoped ? " AND rl.reading_round=$2" : ""} ORDER BY rl.date ASC, rl.session ASC`, scoped ? [bookId, readingRound] : [bookId])).rows;
}
export function storyCompatSummary(analysis: StoryAnalysis): { summary: string; key_insights: string[]; quote: null } { return { summary: analysis.storyRecap, key_insights: analysis.readerMemory.slice(0, 3), quote: null }; }
export const storyFallback = (): StoryAnalysis => ({ storyRecap: "Story Thread is waiting for a configured language model.", changedEvents: [], threads: [], characterPulse: [], readerMemory: [], confidenceNotes: ["No Story Thread analysis was generated because NineRouter is unavailable."] });
