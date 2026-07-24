import assert from "node:assert/strict";
import { buildStoryThreadPrompt, mergeStoryState, parseStoryThreadAnalysis, storyCompatSummary } from "../src/storyThread.js";

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
const state = mergeStoryState({ threads: [{ id: "sealed-letter", label: "Old", status: "open", detail: "Old detail" }], characterPulse: [], readerMemory: [] }, analysis);
assert.equal(state.threads[0].status, "escalating");
const prompt = buildStoryThreadPrompt({ title: "Test", author: "Author", start: 1, end: 2, total: 10, lang: "en", sourceText: "Mara accepts the sealed letter.", priorState: state });
assert.match(prompt.system, /JSON only/);
assert.match(prompt.user, /Current reading text/);
console.log("STORY_THREAD_FIXTURES_OK");
