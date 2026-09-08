import assert from "node:assert/strict";
import { buildStoryMemoryCandidate, type StoryThreadSession } from "../src/storyThread.js";
const row = (log_id: string, session: number, analysis: any): StoryThreadSession => ({ log_id, session, reading_round: 1, page_start: session, page_end: session, date: `2026-09-${String(session).padStart(2, "0")}`, analysis, storyStatus: "ready", attemptCount: 1, errorMessage: null, startedAt: null, completedAt: null });
const base = { storyRecap: "x", changedEvents: [], threads: [], characterPulse: [], readerMemory: [], confidenceNotes: [] };
const candidate = buildStoryMemoryCandidate([
 row("11111111-1111-4111-8111-111111111111", 1, { ...base, storySoFar: "The woman is unnamed.", characterObservations: [{ localId: "woman", name: "người đàn bà", aliases: [], role: "figure", evidence: "current" }], innerMovements: [] }),
 row("22222222-2222-4222-8222-222222222222", 2, { ...base, storySoFar: "Cô Sương arrives.", characterObservations: [{ localId: "suong", name: "Cô Sương", aliases: [], role: "visitor", evidence: "current" }], identitySignals: [{ leftLocalId: "woman", rightLocalId: "suong", claim: "Possible connection.", status: "hypothesis", evidence: "current" }], innerMovements: [] }),
]);
assert.equal(candidate.characters.length, 2, "hypothesis does not merge identities");
assert.equal(candidate.identityHypotheses[0].status, "hypothesis");
assert.equal(candidate.revealEvents[0].eventType, "identity_hypothesis");
assert.equal(candidate.coveredThrough?.session, 2);
console.log("STORY_MEMORY_CANDIDATE_FIXTURES_OK");
