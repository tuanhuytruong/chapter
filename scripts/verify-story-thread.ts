import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boundStoryThreadSource, buildStoryThreadPrompt, mergeStoryState, parseStoryThreadAnalysis, STORY_THREAD_MAX_SOURCE_CHARS, storyCompatSummary } from "../src/storyThread.js";

const raw = JSON.stringify({
  storyRecap: "Mara accepts the sealed letter and leaves before dawn.",
  changedEvents: ["Mara accepts the sealed letter."],
  threads: [{ id: "sealed-letter", label: "The sealed letter", status: "escalating", detail: "Mara now carries it." }],
  characterPulse: [{ name: "Mara", pulse: "She acts despite uncertainty." }],
  readerMemory: ["Mara is carrying a sealed letter."],
  confidenceNotes: [],
});
const analysis = parseStoryThreadAnalysis(`\`\`\`json\n${raw}\n\`\`\``);
assert.equal(analysis.threads[0].status, "escalating");
assert.equal(storyCompatSummary(analysis).quote, null);
assert.throws(() => parseStoryThreadAnalysis('{"storyRecap":"missing required fields"}'));
const firstState = mergeStoryState({ threads: [{ id: "sealed-letter", label: "Old", status: "open", detail: "Old detail" }], characterPulse: [], readerMemory: [] }, analysis);
assert.equal(firstState.threads[0].status, "escalating");

// A later session must carry the existing thread and merge new continuity data.
const followUp = parseStoryThreadAnalysis(JSON.stringify({
  storyRecap: "Mara hides the letter while a new watchman begins following her.",
  changedEvents: ["A watchman begins following Mara."],
  threads: [
    { id: "sealed-letter", label: "The sealed letter", status: "escalating", detail: "Mara hides it from the watchman." },
    { id: "watchman", label: "The watchman", status: "open", detail: "His purpose is not yet clear." },
  ],
  characterPulse: [{ name: "MARA", pulse: "She becomes more guarded." }],
  readerMemory: ["The watchman has noticed Mara."],
  confidenceNotes: ["The watchman’s motive is not established."],
}));
const secondState = mergeStoryState(firstState, followUp);
assert.equal(secondState.threads.length, 2);
assert.equal(secondState.threads.find((thread) => thread.id === "sealed-letter")?.detail, "Mara hides it from the watchman.");
assert.equal(secondState.characterPulse.find((character) => character.name.toLowerCase() === "mara")?.pulse, "She becomes more guarded.");
assert.deepEqual(secondState.readerMemory, ["Mara is carrying a sealed letter.", "The watchman has noticed Mara."]);
const prompt = buildStoryThreadPrompt({ title: "Test", author: "Author", start: 1, end: 2, total: 10, lang: "en", sourceText: "Mara accepts the sealed letter.", priorState: secondState });
assert.match(prompt.system, /JSON only/);
assert.match(prompt.system, /warm reading-companion recap/);
assert.match(prompt.system, /2–3 connected paragraphs/);
assert.match(prompt.system, /Đoạn này/);
assert.match(prompt.user, /Current reading text/);
const overlongSource = "A".repeat(STORY_THREAD_MAX_SOURCE_CHARS + 5000);
const boundedSource = boundStoryThreadSource(overlongSource);
assert.ok(boundedSource.length < overlongSource.length && boundedSource.includes("Middle of this reading range omitted"));

// Boundary fixtures: Story must remain isolated from analytical enrichment.
const routeSource = readFileSync(new URL("../src/routes/books.ts", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
assert.match(routeSource, /if \(book\.reading_experience !== "story"\)[\s\S]*INSERT INTO review_cards/);
assert.match(routeSource, /result\.readingExperience === "story"\)[\s\S]*generateStoryThreadForLog[\s\S]*else[\s\S]*generateReadingLensForLog/);
assert.match(routeSource, /boundStoryThreadSource\(log\.raw_text\)/);
assert.match(routeSource, /NINE_ROUTER_STORY_THREAD_TIMEOUT_MS \|\| 180_000/);
assert.match(routeSource, /reading_experience='analytical'/);
assert.match(routeSource, /Story Thread books do not use Reading Lens/);
assert.match(serverSource, /Story Thread books do not use Knowledge Maps/);

console.log("STORY_THREAD_FIXTURES_OK");
