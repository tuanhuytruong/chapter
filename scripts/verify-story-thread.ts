import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boundStoryThreadSource, buildStoryThreadPrompt, mergeStoryState, parseStoryThreadAnalysis, STORY_THREAD_MAX_SOURCE_CHARS, storyCompatSummary } from "../src/storyThread.js";

const raw = JSON.stringify({
  storyRecap: "Mara accepts the sealed letter and leaves before dawn.",
  storySoFar: "Mara has taken responsibility for a sealed letter and now leaves before dawn.",
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
  storySoFar: "After taking the letter, Mara hides it as a watchman begins following her.",
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
const vietnameseAutoPrompt = buildStoryThreadPrompt({ title: "Kiểm thử", author: "Tác giả", start: 1, end: 2, total: 10, lang: "auto", sourceText: "Ove đứng trước cửa và nhớ về công việc cũ.", priorState: null });
assert.match(vietnameseAutoPrompt.system, /respond entirely in Vietnamese/);
assert.match(prompt.system, /storySoFar is a richer cumulative narrative/);
assert.match(prompt.system, /return exactly "confidenceNotes": \[\]/);
assert.equal(secondState.storySoFar, followUp.storySoFar);
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
const storyThreadSource = readFileSync(new URL("../src/storyThread.ts", import.meta.url), "utf8");
assert.match(storyThreadSource, /rl\.reading_round=\$2/);
assert.match(routeSource, /reading_round=\$4/);
assert.match(routeSource, /listStoryThreadAnalyses\(id, readingRound\)/);
assert.match(routeSource, /reading_experience='analytical'/);
assert.match(routeSource, /Story Thread books do not use Reading Lens/);
assert.match(serverSource, /Story Thread books do not use Knowledge Maps/);
const storyViewSource = readFileSync(new URL("../src/components/story/StoryThreadView.tsx", import.meta.url), "utf8");
assert.match(storyViewSource, /fileType === "epub" \? "Chunks" : "Pages"/);
assert.match(storyViewSource, /aria-label=\{`Retry Story recap for session \$\{log\.session\}`\}/);
assert.match(storyViewSource, /RefreshCw/);
const glossarySource = readFileSync(new URL("../src/components/ContextualGlossary.tsx", import.meta.url), "utf8");
assert.match(glossarySource, /onPointerEnter=\{\(\) => setHoverOpen\(true\)\}/);
assert.match(glossarySource, /onPointerLeave=\{\(\) => setHoverOpen\(false\)\}/);
assert.match(glossarySource, /<button[\s\S]*?<Info aria-hidden="true"/);
assert.match(glossarySource, /onClick=\{\(\) => setPinnedOpen\(\(value\) => !value\)\}/);
assert.match(glossarySource, /role="tooltip"/);
assert.match(glossarySource, /normal-case[\s\S]*?tracking-normal/);
assert.match(glossarySource, /w-56[\s\S]*?text-\[10px\]/);
assert.match(glossarySource, /export function resolveGlossaryLanguage/);
assert.match(glossarySource, /event\.key === "Escape"/);
assert.match(storyViewSource, /summaryLang: GlossaryLanguageSetting/);
assert.match(storyViewSource, /resolveGlossaryLanguage\(summaryLang, latest\?\.analysis\.storyRecap \|\| ""\)/);
assert.match(storyViewSource, /<GlossaryLabel term=\{glossaryStatus\[thread\.status\]\} language=\{glossaryLanguage\}\s*\/>/);
assert.match(storyViewSource, /Character Storylines/);
assert.match(storyViewSource, /aggregateCharacterStorylines/);
assert.match(storyViewSource, /Relationship timeline/);
const characterSource = readFileSync(new URL("../src/storyCharacterStorylines.ts", import.meta.url), "utf8");
assert.doesNotMatch(characterSource, /from "\.\/db/);
assert.match(characterSource, /characterRelationships/);
const detailSource = readFileSync(new URL("../src/pages/BookDetail.tsx", import.meta.url), "utf8");
assert.match(detailSource, /<StoryThreadView[\s\S]*?summaryLang=\{book\.summary_lang\}/);
assert.match(detailSource, /setStoryRetryingLogId\(\(current\) => current === logId \? null : current\)/);
assert.match(storyThreadSource, /markStoryThreadGenerating/);
assert.match(storyThreadSource, /markStoryThreadReady/);
assert.match(storyThreadSource, /markStoryThreadFailed/);
assert.match(routeSource, /await markStoryThreadGenerating\(result.log\)/);
assert.match(routeSource, /markStoryThreadFailed\(result.log.id/);
assert.match(storyViewSource, /Generating Story Thread…/);
assert.match(storyViewSource, /Story Thread needs retry/);
assert.match(storyViewSource, /storyStatus === "generating"/);
assert.match(storyViewSource, /storySoFar \|\| "Cumulative story continuity/);
const boilerplate = parseStoryThreadAnalysis(JSON.stringify({ storyRecap: "x", storySoFar: "y", changedEvents: [], threads: [], characterPulse: [], readerMemory: [], confidenceNotes: ["Không có", "No uncertainty", "Grounded strictly in current text", "A page is truncated."] }));
assert.deepEqual(boilerplate.confidenceNotes, ["A page is truncated."]);
const continuityCitation = parseStoryThreadAnalysis(JSON.stringify({ storyRecap: "x", storySoFar: "y", continuityPath: [{ text: "A turning point", citation: { logId: "log-1", session: 2, pageStart: 5, pageEnd: 5 } }], changedEvents: [], threads: [], characterPulse: [], readerMemory: [], confidenceNotes: [] }));
assert.deepEqual(continuityCitation.continuityPath, [{ text: "A turning point", citation: { logId: "log-1", session: 2, pageStart: 5, pageEnd: 5 } }]);
const vietnameseBoilerplate = parseStoryThreadAnalysis(JSON.stringify({ storyRecap: "x", storySoFar: "y", changedEvents: [], threads: [], characterPulse: [], readerMemory: [], confidenceNotes: ["Không có sự không chắc chắn nào trong đoạn văn này.", "A page is truncated."] }));
assert.deepEqual(vietnameseBoilerplate.confidenceNotes, ["A page is truncated."]);
assert.match(prompt.system, /return exactly "confidenceNotes": \[\]/);
assert.match(prompt.system, /không có sự không chắc chắn/);
assert.match(prompt.system, /reuse its exact citation from Prior persisted story state/);
assert.match(storyViewSource, /state\.continuityPath/);

const detailSourceX = readFileSync(new URL("../src/pages/BookDetail.tsx", import.meta.url), "utf8");
assert.match(detailSourceX, /repairStoryThread/);
assert.match(detailSourceX, /onRepair=\{repairStoryThread\}/);
assert.match(routeSource, /story-thread\/repair/);
assert.match(routeSource, /LIMIT 5/);
const storyThreadSourceX = readFileSync(new URL("../src/storyThread.ts", import.meta.url), "utf8");
assert.match(storyThreadSourceX, /story_thread_repair_jobs/);
assert.match(storyThreadSourceX, /createStoryThreadRepairJob/);
assert.match(storyViewSource, /Retry this session/);
assert.doesNotMatch(storyViewSource, />Repair later continuity</);
assert.match(storyViewSource, /failed\.map\(\(item\) => <PendingCard[\s\S]*?onRepair=\{onRepair\}/);
assert.match(storyViewSource, /ready\.slice\(\)\.reverse\(\)\.map\(\(item\) => <SessionStory[\s\S]*?onRepair=\{onRepair\}/);
assert.match(routeSource, /b\.status AS book_status/);
assert.match(routeSource, /entry\.book_status === "paused"/);
assert.match(storyViewSource, /Wrench/);
assert.match(storyViewSource, /Repair Story Thread continuity from session/);
assert.match(storyViewSource, /Repair continuity: rebuild this session and up to the next 4 sessions/);
assert.doesNotMatch(storyViewSource, />Repair later continuity</);
assert.match(storyViewSource, /character\.developments\.length/);
assert.doesNotMatch(storyViewSource, /sticky top-0/);
assert.match(storyViewSource, /Back to Story Thread/);
assert.match(storyViewSource, /className="space-y-4"/);
assert.match(storyViewSource, /aria-controls="story-thread-panel"/);
assert.match(storyViewSource, /aria-controls="character-storylines-panel"/);

console.log("STORY_THREAD_FIXTURES_OK");
