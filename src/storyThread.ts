import { query } from "./db.js";

export type StoryThread = { id: string; label: string; status: "open" | "escalating" | "resolved" | "uncertain"; detail: string };
export type StoryCharacter = { name: string; pulse: string };
export type StoryCharacterArc = { name: string; development: string };
export type StoryRelationship = { people: string[]; detail: string };
export type StoryIdentityStatus = "hypothesis" | "confirmed" | "rejected";
export type StoryInnerMovement = { characterName: string; emotionalShift: string; innerConflict: string; desireVsAction: string; subtext: string; unresolved: string };
export type StoryCharacterObservation = { localId: string; name: string; aliases: string[]; role: string; evidence: "current" };
export type StoryIdentitySignal = { leftLocalId: string; rightLocalId: string; claim: string; status: StoryIdentityStatus; evidence: "current" };
export type StoryCitation = { logId: string; session: number; pageStart: number; pageEnd: number };
export type StoryMilestone = { text: string; citation: StoryCitation };
export function normalizeContinuityCitations(milestones: StoryMilestone[] | undefined, current: StoryCitation, priorByLogId: Map<string, StoryCitation>): StoryMilestone[] | undefined {
  return milestones?.slice(0, 4).map((milestone) => ({ ...milestone, citation: priorByLogId.get(milestone.citation.logId) || current }));
}
export type StoryAnalysis = {
  storyRecap: string;
  storySoFar?: string;
  continuityPath?: StoryMilestone[];
  changedEvents: string[];
  threads: StoryThread[];
  characterPulse: StoryCharacter[];
  // Optional so analyses created before Character Storylines remain readable.
  characterArcs?: StoryCharacterArc[];
  characterRelationships?: StoryRelationship[];
  innerMovements?: StoryInnerMovement[];
  characterObservations?: StoryCharacterObservation[];
  identitySignals?: StoryIdentitySignal[];
  readerMemory: string[];
  confidenceNotes: string[];
};
export type StoryState = Pick<StoryAnalysis, "storySoFar" | "threads" | "characterPulse" | "readerMemory" | "continuityPath">;
export type StoryJobStatus = "generating" | "ready" | "failed";
export class StoryThreadIncompleteOutputError extends Error {
  constructor(reason: "length" | "invalid_json") {
    super(reason === "length" ? "Story Thread response stopped before completion." : "Story Thread response was incomplete JSON.");
    this.name = "StoryThreadIncompleteOutputError";
  }
}

export function assertStoryThreadCompletion(value: { text: string; finishReason: string | null }): string {
  if (value.finishReason === "length") throw new StoryThreadIncompleteOutputError("length");
  return value.text;
}
export type StoryThreadSession = { log_id: string; session: number; reading_round: number; page_start: number; page_end: number; date: string; analysis: StoryAnalysis | null; storyStatus: StoryJobStatus; attemptCount: number; errorMessage: string | null; startedAt: string | null; completedAt: string | null; };
export type StoryEvidence = { logId: string; session: number; pageStart: number; pageEnd: number };
export type StoryMemoryCharacter = { id: string; displayName: string; aliases: Array<{ name: string; status: StoryIdentityStatus; evidence: StoryEvidence }>; roles: string[]; interior: Array<{ shift: string; conflict: string; desireVsAction: string; subtext: string; unresolved: string; evidence: StoryEvidence }>; unresolved: string[] };
export type StoryMemoryEvent = { eventType: "identity_hypothesis" | "identity_confirmed" | "identity_rejected" | "assumption_revised"; subjectKey: string; priorClaim?: string; currentClaim: string; confidence: StoryIdentityStatus; evidence: StoryEvidence };
export type StoryMemoryCandidate = { storySoFar: string; characters: StoryMemoryCharacter[]; identityHypotheses: Array<{ id: string; leftCharacterId: string; rightCharacterId: string; claim: string; status: StoryIdentityStatus; evidence: StoryEvidence[] }>; revealEvents: StoryMemoryEvent[]; openQuestions: string[]; coveredThrough: StoryEvidence | null };

const normalizedEntityKey = (value: string) => value.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/(^-|-$)/g, "");

/** Deterministic, no-LLM boundary from immutable session observations to a
 * reconciliation candidate. Identities stay separate until a cited confirmed
 * signal explicitly joins them. */
export function buildStoryMemoryCandidate(rows: StoryThreadSession[]): StoryMemoryCandidate {
  const ordered = rows.filter((row) => row.analysis && row.storyStatus === "ready").slice().sort((a, b) => a.date.localeCompare(b.date) || a.session - b.session);
  const parent = new Map<string, string>();
  const find = (id: string): string => { const root = parent.get(id) || id; if (root !== id) parent.set(id, find(root)); return parent.get(id) || id; };
  const join = (a: string, b: string) => { const left = find(a), right = find(b); if (left !== right) parent.set(right, left); };
  // Same exact observed name is the same candidate across sessions; distinct
  // names remain separate until a current cited confirmation joins them.
  const localToGlobal = new Map<string, string>();
  const nameToGlobal = new Map<string, string>();
  for (const row of ordered) for (const item of row.analysis!.characterObservations || []) {
    const key = normalizedEntityKey(item.name) || `${row.log_id}:${item.localId}`;
    const global = nameToGlobal.get(key) || `${row.log_id}:${item.localId}`;
    nameToGlobal.set(key, global);
    localToGlobal.set(`${row.log_id}:${item.localId}`, global);
  }
  for (const row of ordered) for (const signal of row.analysis!.identitySignals || []) if (signal.status === "confirmed") join(localToGlobal.get(`${row.log_id}:${signal.leftLocalId}`) || `${row.log_id}:${signal.leftLocalId}`, localToGlobal.get(`${row.log_id}:${signal.rightLocalId}`) || `${row.log_id}:${signal.rightLocalId}`);
  const characters = new Map<string, StoryMemoryCharacter>();
  const identityHypotheses: StoryMemoryCandidate["identityHypotheses"] = [];
  const revealEvents: StoryMemoryEvent[] = [];
  const openQuestions = new Set<string>();
  let storySoFar = "";
  let coveredThrough: StoryEvidence | null = null;
  for (const row of ordered) {
    const analysis = row.analysis!;
    storySoFar = analysis.storySoFar || storySoFar;
    const evidence = { logId: row.log_id, session: row.session, pageStart: row.page_start, pageEnd: row.page_end };
    coveredThrough = evidence;
    const observations = new Map((analysis.characterObservations || []).map((item) => [item.localId, item]));
    for (const item of observations.values()) {
      const id = find(localToGlobal.get(`${row.log_id}:${item.localId}`) || `${row.log_id}:${item.localId}`);
      const current = characters.get(id) || { id, displayName: item.name, aliases: [], roles: [], interior: [], unresolved: [] };
      if (item.role && !current.roles.includes(item.role)) current.roles.push(item.role);
      for (const alias of item.aliases) if (alias && alias !== current.displayName && !current.aliases.some((entry) => entry.name === alias)) current.aliases.push({ name: alias, status: "hypothesis", evidence });
      characters.set(id, current);
    }
    for (const movement of analysis.innerMovements || []) {
      const target = [...observations.values()].find((item) => normalizedEntityKey(item.name) === normalizedEntityKey(movement.characterName));
      if (!target) continue;
      const id = find(localToGlobal.get(`${row.log_id}:${target.localId}`) || `${row.log_id}:${target.localId}`), current = characters.get(id);
      if (!current) continue;
      current.interior.push({ shift: movement.emotionalShift, conflict: movement.innerConflict, desireVsAction: movement.desireVsAction, subtext: movement.subtext, unresolved: movement.unresolved, evidence });
      if (movement.unresolved) openQuestions.add(movement.unresolved);
    }
    for (const signal of analysis.identitySignals || []) {
      const left = find(localToGlobal.get(`${row.log_id}:${signal.leftLocalId}`) || `${row.log_id}:${signal.leftLocalId}`), right = find(localToGlobal.get(`${row.log_id}:${signal.rightLocalId}`) || `${row.log_id}:${signal.rightLocalId}`);
      const subjectKey = [left, right].sort().join("::");
      identityHypotheses.push({ id: `${row.log_id}:${signal.leftLocalId}:${signal.rightLocalId}`, leftCharacterId: left, rightCharacterId: right, claim: signal.claim, status: signal.status, evidence: [evidence] });
      if (signal.status !== "hypothesis") revealEvents.push({ eventType: signal.status === "confirmed" ? "identity_confirmed" : "identity_rejected", subjectKey, currentClaim: signal.claim, confidence: signal.status, evidence });
      else revealEvents.push({ eventType: "identity_hypothesis", subjectKey, currentClaim: signal.claim, confidence: signal.status, evidence });
    }
  }
  // The union-find pass may have joined an earlier entity after it was stored.
  const canonical = new Map<string, StoryMemoryCharacter>();
  for (const character of characters.values()) {
    const id = find(character.id), target = canonical.get(id) || { ...character, id, aliases: [...character.aliases], roles: [...character.roles], interior: [...character.interior], unresolved: [...character.unresolved] };
    if (!canonical.has(id)) canonical.set(id, target); else {
      for (const alias of [character.displayName, ...character.aliases.map((item) => item.name)]) if (alias !== target.displayName && !target.aliases.some((item) => item.name === alias)) target.aliases.push({ name: alias, status: "confirmed", evidence: character.aliases[0]?.evidence || coveredThrough! });
      target.roles.push(...character.roles.filter((role) => !target.roles.includes(role)));
      target.interior.push(...character.interior);
    }
  }
  return { storySoFar, characters: [...canonical.values()].slice(0, 20), identityHypotheses: identityHypotheses.slice(-24), revealEvents: revealEvents.slice(-24), openQuestions: [...openQuestions].slice(-16), coveredThrough };
}

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
const validLogId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const noConfidenceNote = (value: string) => /^(không có|không có sự không chắc chắn nào trong (?:văn bản hiện tại|đoạn văn này)|no uncertainty(?: is present in the current text)?|grounded strictly in current text)\.?$/iu.test(value.trim());
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
  const continuityPath = objects(data.continuityPath, 4).map((row) => {
    const citation = row.citation && typeof row.citation === "object" && !Array.isArray(row.citation) ? row.citation as Record<string, unknown> : {};
    return { text: clean(row.text), citation: { logId: validLogId(citation.logId) ? citation.logId : "", session: Number(citation.session) || 0, pageStart: Number(citation.pageStart) || 0, pageEnd: Number(citation.pageEnd) || 0 } };
  }).filter((milestone) => milestone.text);
  const innerMovements = objects(data.innerMovements, 6).map((row) => ({ characterName: clean(row.characterName), emotionalShift: clean(row.emotionalShift), innerConflict: clean(row.innerConflict), desireVsAction: clean(row.desireVsAction), subtext: clean(row.subtext), unresolved: clean(row.unresolved) })).filter((row) => row.characterName && (row.emotionalShift || row.innerConflict || row.desireVsAction || row.subtext || row.unresolved));
  const characterObservations = objects(data.characterObservations, 8).map((row) => ({ localId: clean(row.localId).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/(^-|-$)/g, ""), name: clean(row.name), aliases: [...new Set(strings(row.aliases, 6).map((alias) => alias.toLocaleLowerCase() === clean(row.name).toLocaleLowerCase() ? "" : alias).filter(Boolean))], role: clean(row.role), evidence: row.evidence === "current" ? "current" as const : null })).filter((row): row is StoryCharacterObservation => Boolean(row.localId && row.name && row.evidence));
  const observationIds = new Set(characterObservations.map((row) => row.localId));
  const localId = (value: unknown) => clean(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/(^-|-$)/g, "");
  const identitySignals = objects(data.identitySignals, 4).map((row) => ({ leftLocalId: localId(row.leftLocalId), rightLocalId: localId(row.rightLocalId), claim: clean(row.claim), status: ["hypothesis", "confirmed", "rejected"].includes(String(row.status)) ? row.status as StoryIdentityStatus : null, evidence: row.evidence === "current" ? "current" as const : null })).filter((row): row is StoryIdentitySignal => Boolean(row.leftLocalId && row.rightLocalId && row.leftLocalId !== row.rightLocalId && row.claim && row.status && row.evidence && observationIds.has(row.leftLocalId) && observationIds.has(row.rightLocalId)));
  return { storyRecap: clean(data.storyRecap, "No grounded recap was established."), storySoFar: clean(data.storySoFar), continuityPath, changedEvents: strings(data.changedEvents, 8), threads, characterPulse, characterArcs, characterRelationships, innerMovements, characterObservations, identitySignals, readerMemory: strings(data.readerMemory, 6), confidenceNotes: strings(data.confidenceNotes, 6).filter((note) => !noConfidenceNote(note)) };
}

export function buildStoryThreadPrompt(input: { title: string; author: string; start: number; end: number; total: number; lang: "auto" | "vi" | "en"; sourceText: string; priorState: StoryState | null }): { system: string; user: string } {
  const language = input.lang === "vi" ? "Respond entirely in Vietnamese." : input.lang === "en" ? "Respond entirely in English." : /[ăâđêôơưĂÂĐÊÔƠƯ]/.test(input.sourceText) ? "The current reading is Vietnamese: respond entirely in Vietnamese." : "Match the predominant language of the current reading.";
  return {
    system: `You are Story Thread, a continuity companion for fiction. Ground every current event, character change, and quote-like detail in CURRENT READING TEXT. Prior state is only reader memory: preserve it only when compatible, never treat it as new evidence. Do not invent names, motives, events, chronology, or spoilers. Mark uncertainty in confidenceNotes. For storyRecap, write a warm reading-companion recap, not an event ledger: normally use 2–3 connected paragraphs when the source has enough material; enter through a concrete scene, movement, tension, gesture, or grounded emotional shift from the current reading; then carry cause → response → consequence with natural transitions. Never begin with meta labels such as “This section”, “This passage”, “In this part”, “Đoạn này”, “Phần này”, or “Tóm lại”. Do not pad a genuinely short source, invent interiority, or repeat the whole book. characterArcs records only an observed development for a named character in this reading. Reuse the exact established name from Prior persisted story state for the same person. Add an age/role qualifier only for a genuinely distinct representation established by the reading. Do not emit generic unnamed roles as character arcs; omit the arc rather than guessing an identity. characterRelationships records only an observed state or change between 2–4 named characters. innerMovements records only a named character’s observed emotional shift, conflict, desire versus action, subtext, or unresolved tension shown by the current text; use uncertain language for subtext and never diagnose. characterObservations uses stable localId values and exact current names; aliases are names/labels seen in current text. If two identities may be connected, include identitySignals with status "hypothesis" and keep records separate. Use "confirmed" only when CURRENT READING explicitly confirms it; use "rejected" only when CURRENT READING explicitly rules it out. Every optional V2 entry must set evidence:"current". Never merge aliases merely because they seem plausible. confidenceNotes are optional exception data, never a status message. When there is no concrete limitation in supplied text, return exactly "confidenceNotes": []. Never write an absence statement in any language, including “no uncertainty”, “no limitations”, “không có sự không chắc chắn”, or equivalent. Example: normal supported reading => []; only use a note for a concrete truncated, omitted, or genuinely ambiguous source condition. storySoFar is a richer cumulative narrative through this session, not a duplicate of storyRecap: when evidence permits, connect the starting situation through the most important already-saved turning points to the current situation. Do not list every session or invent causal links. continuityPath is a max-4 chronological list of brief turning points from the reader memory/current reading only. Each item is {"text":"", "citation":{"logId":"","session":0,"pageStart":0,"pageEnd":0}}. For an earlier turning point, use only an exact citation ID from Prior persisted story state; never invent a citation. Citation IDs are selection tokens only: the server verifies all session/chunk/page metadata. For the current reading, leave citation values empty/0 and the server will attach its verified session range. Return [] if no meaningful path can be grounded. ${language} Return JSON only with exactly these keys: {"storyRecap":"","storySoFar":"","continuityPath":[{"text":"","citation":{"logId":"","session":0,"pageStart":0,"pageEnd":0}}],"changedEvents":[""],"threads":[{"id":"stable-short-id","label":"","status":"open|escalating|resolved|uncertain","detail":""}],"characterPulse":[{"name":"","pulse":""}],"characterArcs":[{"name":"","development":""}],"characterRelationships":[{"people":["",""],"detail":""}],"innerMovements":[{"characterName":"","emotionalShift":"","innerConflict":"","desireVsAction":"","subtext":"","unresolved":""}],"characterObservations":[{"localId":"","name":"","aliases":[""],"role":"","evidence":"current"}],"identitySignals":[{"leftLocalId":"","rightLocalId":"","claim":"","status":"hypothesis|confirmed|rejected","evidence":"current"}],"readerMemory":[""],"confidenceNotes":[""]}. Lists must be concise; threads/characters/arcs/relationships max 8, events max 8, memory max 6.`,
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
  return { storySoFar: analysis.storySoFar || previous?.storySoFar || "", continuityPath: [...(previous?.continuityPath || []), ...(analysis.continuityPath || [])].filter((item) => item.citation.logId).slice(-4), threads: [...byId.values()].slice(-16), characterPulse: [...byName.values()].slice(-16), readerMemory: [...new Set([...(previous?.readerMemory || []), ...analysis.readerMemory])].slice(-16) };
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
export type StoryMemorySnapshotRow = { book_id: string; reading_round: number; state: StoryMemoryCandidate; covered_log_id: string | null; covered_session: number; status: "ready" | "generating" | "failed"; error_message: string | null; updated_at: string };

export async function rebuildStoryMemorySnapshot(bookId: string, readingRound: number): Promise<StoryMemoryCandidate> {
  const sessions = await listStoryThreadAnalyses(bookId, readingRound);
  const state = buildStoryMemoryCandidate(sessions);
  const covered = state.coveredThrough;
  await query(`INSERT INTO story_memory_snapshots (book_id,reading_round,schema_version,state,covered_log_id,covered_session,status,error_message,generated_at,updated_at)
    VALUES ($1,$2,2,$3::jsonb,$4,$5,'ready',NULL,now(),now())
    ON CONFLICT (book_id,reading_round,schema_version) DO UPDATE SET state=EXCLUDED.state,covered_log_id=EXCLUDED.covered_log_id,covered_session=EXCLUDED.covered_session,status='ready',error_message=NULL,generated_at=now(),updated_at=now()`,
    [bookId, readingRound, JSON.stringify(state), covered?.logId || null, covered?.session || 0]);
  for (const event of state.revealEvents) await query(`INSERT INTO story_memory_events (book_id,reading_round,event_type,subject_key,prior_claim,current_claim,confidence,source_log_id,source_session,page_start,page_end)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (book_id,reading_round,event_type,subject_key,source_log_id,current_claim) DO NOTHING`,
    [bookId, readingRound, event.eventType, event.subjectKey, event.priorClaim || null, event.currentClaim, event.confidence, event.evidence.logId, event.evidence.session, event.evidence.pageStart, event.evidence.pageEnd]);
  return state;
}

export async function getStoryMemorySnapshot(bookId: string, readingRound: number): Promise<StoryMemorySnapshotRow | null> {
  const { rows } = await query<StoryMemorySnapshotRow>(`SELECT book_id,reading_round,state,covered_log_id,covered_session,status,error_message,updated_at FROM story_memory_snapshots WHERE book_id=$1 AND reading_round=$2 AND schema_version=2`, [bookId, readingRound]);
  return rows[0] || null;
}
export async function listStoryMemoryEvents(bookId: string, readingRound: number): Promise<StoryMemoryEvent[]> {
  const { rows } = await query<any>(`SELECT event_type,subject_key,prior_claim,current_claim,confidence,source_log_id,source_session,page_start,page_end FROM story_memory_events WHERE book_id=$1 AND reading_round=$2 ORDER BY source_session ASC, created_at ASC`, [bookId, readingRound]);
  return rows.map((row) => ({ eventType: row.event_type, subjectKey: row.subject_key, priorClaim: row.prior_claim || undefined, currentClaim: row.current_claim, confidence: row.confidence, evidence: { logId: row.source_log_id, session: row.source_session, pageStart: row.page_start, pageEnd: row.page_end } }));
}

export async function getStoryThreadAnalysis(bookId: string, logId: string): Promise<any | null> { const { rows } = await query("SELECT * FROM story_thread_analyses WHERE book_id=$1 AND log_id=$2 AND schema_version=1", [bookId, logId]); return rows[0] || null; }
export async function listStoryThreadAnalyses(bookId: string, readingRound?: number): Promise<StoryThreadSession[]> {
  const scoped = Number.isInteger(readingRound) && (readingRound as number) > 0;
  return (await query<StoryThreadSession>(`SELECT rl.id AS log_id, rl.session, rl.reading_round, rl.page_start, rl.page_end, rl.date, sta.analysis, COALESCE(stj.status, CASE WHEN sta.log_id IS NULL THEN 'failed' ELSE 'ready' END) AS "storyStatus", COALESCE(stj.attempt_count,0) AS "attemptCount", stj.error_message AS "errorMessage", stj.started_at AS "startedAt", stj.completed_at AS "completedAt" FROM reading_log rl LEFT JOIN story_thread_analyses sta ON sta.log_id=rl.id AND sta.schema_version=1 LEFT JOIN story_thread_jobs stj ON stj.log_id=rl.id WHERE rl.book_id=$1 AND rl.raw_text IS NOT NULL${scoped ? " AND rl.reading_round=$2" : ""} ORDER BY rl.date ASC, rl.session ASC`, scoped ? [bookId, readingRound] : [bookId])).rows;
}
export function storyCompatSummary(analysis: StoryAnalysis): { summary: string; key_insights: string[]; quote: null } { return { summary: analysis.storyRecap, key_insights: analysis.readerMemory.slice(0, 3), quote: null }; }
export const storyFallback = (): StoryAnalysis => ({ storyRecap: "Story Thread is waiting for a configured language model.", changedEvents: [], threads: [], characterPulse: [], readerMemory: [], confidenceNotes: ["No Story Thread analysis was generated because NineRouter is unavailable."] });

export type StoryRepairMode = "single_session" | "continuity";
export type StoryRepairStatus = "running" | "completed" | "failed" | "awaiting_confirmation";
export type StoryThreadRepairJob = { id: string; bookId: string; readingRound: number; firstLogId: string; mode: StoryRepairMode; status: StoryRepairStatus; firstSession: number; currentSession: number | null; targetSession: number; rebuiltSessions: number; maxSessions: number; errorMessage: string | null; };
const repairShape = (row: any): StoryThreadRepairJob => ({ id: row.id, bookId: row.book_id, readingRound: row.reading_round, firstLogId: row.first_log_id, mode: row.mode, status: row.status, firstSession: row.first_session, currentSession: row.current_session, targetSession: row.target_session, rebuiltSessions: row.rebuilt_sessions, maxSessions: row.max_sessions, errorMessage: row.error_message });
export async function getStoryThreadRepairJob(bookId: string, readingRound: number): Promise<StoryThreadRepairJob | null> { const { rows } = await query(`SELECT * FROM story_thread_repair_jobs WHERE book_id=$1 AND reading_round=$2 ORDER BY created_at DESC LIMIT 1`, [bookId, readingRound]); return rows[0] ? repairShape(rows[0]) : null; }
export async function createStoryThreadRepairJob(input: { bookId: string; readingRound: number; firstLogId: string; mode: StoryRepairMode; firstSession: number; targetSession: number; maxSessions?: number }): Promise<StoryThreadRepairJob> { const active = await getStoryThreadRepairJob(input.bookId, input.readingRound); if (active?.status === "running") return active; const { rows } = await query(`INSERT INTO story_thread_repair_jobs (book_id,reading_round,first_log_id,mode,status,first_session,target_session,max_sessions) VALUES ($1,$2,$3,$4,'running',$5,$6,$7) RETURNING *`, [input.bookId,input.readingRound,input.firstLogId,input.mode,input.firstSession,input.targetSession,input.maxSessions || 15]); return repairShape(rows[0]); }
export async function updateStoryThreadRepairJob(id: string, patch: { currentSession?: number; targetSession?: number; rebuiltSessions?: number; status?: StoryRepairStatus; errorMessage?: string | null }): Promise<StoryThreadRepairJob> { const { rows } = await query(`UPDATE story_thread_repair_jobs SET current_session=COALESCE($2,current_session), target_session=COALESCE($3,target_session), rebuilt_sessions=COALESCE($4,rebuilt_sessions), status=COALESCE($5,status), error_message=$6, completed_at=CASE WHEN $5 IN ('completed','failed','awaiting_confirmation') THEN now() ELSE completed_at END, updated_at=now() WHERE id=$1 RETURNING *`, [id,patch.currentSession ?? null,patch.targetSession ?? null,patch.rebuiltSessions ?? null,patch.status ?? null,patch.errorMessage ?? null]); if (!rows[0]) throw new Error("Story repair job not found"); return repairShape(rows[0]); }
