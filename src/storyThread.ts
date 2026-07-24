import { query } from "./db.js";

export type StoryThread = { id: string; label: string; status: "open" | "escalating" | "resolved" | "uncertain"; detail: string };
export type StoryCharacter = { name: string; pulse: string };
export type StoryAnalysis = {
  storyRecap: string;
  changedEvents: string[];
  threads: StoryThread[];
  characterPulse: StoryCharacter[];
  readerMemory: string[];
  confidenceNotes: string[];
};
export type StoryState = Pick<StoryAnalysis, "threads" | "characterPulse" | "readerMemory">;

const MAX_TEXT = 900;
const clean = (value: unknown, fallback = ""): string => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT) || fallback : fallback;
const strings = (value: unknown, max: number): string[] => Array.isArray(value) ? value.map((item) => clean(item)).filter(Boolean).slice(0, max) : [];
const status = (value: unknown): StoryThread["status"] => ["open", "escalating", "resolved", "uncertain"].includes(String(value)) ? value as StoryThread["status"] : "uncertain";

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
  return { storyRecap: clean(data.storyRecap, "No grounded recap was established."), changedEvents: strings(data.changedEvents, 8), threads, characterPulse, readerMemory: strings(data.readerMemory, 6), confidenceNotes: strings(data.confidenceNotes, 6) };
}

export function buildStoryThreadPrompt(input: { title: string; author: string; start: number; end: number; total: number; lang: "auto" | "vi" | "en"; sourceText: string; priorState: StoryState | null }): { system: string; user: string } {
  const language = input.lang === "vi" ? "Respond entirely in Vietnamese." : input.lang === "en" ? "Respond entirely in English." : "Match the predominant language of the current reading.";
  return {
    system: `You are Story Thread, a continuity companion for fiction. Ground every current event, character change, and quote-like detail in CURRENT READING TEXT. Prior state is only reader memory: preserve it only when compatible, never treat it as new evidence. Do not invent names, motives, events, chronology, or spoilers. Mark uncertainty in confidenceNotes. ${language} Return JSON only with exactly these keys: {"storyRecap":"","changedEvents":[""],"threads":[{"id":"stable-short-id","label":"","status":"open|escalating|resolved|uncertain","detail":""}],"characterPulse":[{"name":"","pulse":""}],"readerMemory":[""],"confidenceNotes":[""]}. Lists must be concise; threads/characters max 8, events max 8, memory max 6.`,
    user: `Book: ${input.title} by ${input.author}\nReading range: ${input.start}–${input.end} of ${input.total}\n\nPrior persisted story state (may be empty):\n${JSON.stringify(input.priorState || { threads: [], characterPulse: [], readerMemory: [] })}\n\nCurrent reading text:\n${input.sourceText}`,
  };
}

export function mergeStoryState(previous: StoryState | null, analysis: StoryAnalysis): StoryState {
  const byId = new Map<string, StoryThread>();
  for (const thread of previous?.threads || []) byId.set(thread.id, thread);
  for (const thread of analysis.threads) byId.set(thread.id, thread);
  const byName = new Map<string, StoryCharacter>();
  for (const character of previous?.characterPulse || []) byName.set(character.name.toLocaleLowerCase(), character);
  for (const character of analysis.characterPulse) byName.set(character.name.toLocaleLowerCase(), character);
  return { threads: [...byId.values()].slice(-16), characterPulse: [...byName.values()].slice(-16), readerMemory: [...new Set([...(previous?.readerMemory || []), ...analysis.readerMemory])].slice(-16) };
}

export async function getStoryStateBeforeLog(bookId: string, date: string, session: number): Promise<StoryState | null> {
  const { rows } = await query<{ analysis: StoryAnalysis }>(
    `SELECT sta.analysis FROM story_thread_analyses sta
     JOIN reading_log rl ON rl.id=sta.log_id
     WHERE sta.book_id=$1 AND sta.schema_version=1
       AND (rl.date < $2::date OR (rl.date = $2::date AND rl.session < $3))
     ORDER BY rl.date ASC, rl.session ASC`,
    [bookId, date, session]
  );
  let state: StoryState | null = null;
  for (const item of rows) state = mergeStoryState(state, item.analysis);
  return state;
}
export async function upsertStoryThreadAnalysis(bookId: string, logId: string, analysis: StoryAnalysis): Promise<void> {
  await query(`INSERT INTO story_thread_analyses (book_id, log_id, schema_version, analysis, story_recap) VALUES ($1,$2,1,$3::jsonb,$4) ON CONFLICT (log_id, schema_version) DO UPDATE SET analysis=EXCLUDED.analysis, story_recap=EXCLUDED.story_recap, generated_at=now()`, [bookId, logId, JSON.stringify(analysis), analysis.storyRecap]);

  // Rebuild from every persisted session in chronological order. This prevents a
  // retry of an earlier log from replacing the newest Story State with stale data.
  const analyses = await listStoryThreadAnalyses(bookId);
  let state: StoryState | null = null;
  for (const item of analyses) state = mergeStoryState(state, item.analysis as StoryAnalysis);
  const latest = analyses.at(-1);
  await query(`INSERT INTO story_state_snapshots (book_id, reading_round, last_log_id, state) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (book_id) DO UPDATE SET reading_round=EXCLUDED.reading_round, last_log_id=EXCLUDED.last_log_id, state=EXCLUDED.state, updated_at=now()`, [bookId, latest?.session || 1, latest?.log_id || logId, JSON.stringify(state || { threads: [], characterPulse: [], readerMemory: [] })]);
}
export async function getStoryThreadAnalysis(bookId: string, logId: string): Promise<any | null> { const { rows } = await query("SELECT * FROM story_thread_analyses WHERE book_id=$1 AND log_id=$2 AND schema_version=1", [bookId, logId]); return rows[0] || null; }
export async function listStoryThreadAnalyses(bookId: string): Promise<any[]> { return (await query("SELECT sta.*, rl.session FROM story_thread_analyses sta JOIN reading_log rl ON rl.id=sta.log_id WHERE sta.book_id=$1 AND sta.schema_version=1 ORDER BY rl.date ASC, rl.session ASC", [bookId])).rows; }
export function storyCompatSummary(analysis: StoryAnalysis): { summary: string; key_insights: string[]; quote: null } { return { summary: analysis.storyRecap, key_insights: analysis.readerMemory.slice(0, 3), quote: null }; }
export const storyFallback = (): StoryAnalysis => ({ storyRecap: "Story Thread is waiting for a configured language model.", changedEvents: [], threads: [], characterPulse: [], readerMemory: [], confidenceNotes: ["No Story Thread analysis was generated because NineRouter is unavailable."] });
