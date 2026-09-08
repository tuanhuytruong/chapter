import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const view = readFileSync(new URL("../src/components/story/StoryThreadView.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../src/pages/BookDetail.tsx", import.meta.url), "utf8");
assert.match(view, /Character memory/); assert.match(view, /Also known as/); assert.match(view, /aliases\.filter/); assert.match(view, /Inner movement/); assert.match(view, /<details/); assert.match(view, /What we understand now/); assert.match(view, /Possible connection; not confirmed yet/); assert.match(detail, /api\.getStoryMemory/); assert.match(detail, /storyMemory=\{storyMemory\}/); console.log("STORY_MEMORY_UI_FIXTURES_OK");
