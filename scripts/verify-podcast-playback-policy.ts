import assert from "node:assert/strict";
import { NEXT_CHAPTER_PREPARE_RATIO, shouldPrepareNextChapter } from "../src/podcastPlaybackPolicy.ts";

const base = {
  currentTime: 0,
  duration: 100,
  alreadyTriggered: false,
  isLatestReady: true,
  canGenerate: true,
  isPending: false,
  stopAfterCurrent: false,
};

assert.equal(NEXT_CHAPTER_PREPARE_RATIO, 0.15, "preparation begins at 15%");
assert.equal(shouldPrepareNextChapter({ ...base, currentTime: 14.9 }), false, "14.9% does not prepare");
assert.equal(shouldPrepareNextChapter({ ...base, currentTime: 15 }), true, "15% prepares");
assert.equal(shouldPrepareNextChapter({ ...base, currentTime: 80 }), true, "resuming beyond 15% remains eligible until triggered");
assert.equal(shouldPrepareNextChapter({ ...base, duration: 0, currentTime: 15 }), false, "invalid duration never prepares");
assert.equal(shouldPrepareNextChapter({ ...base, alreadyTriggered: true, currentTime: 15 }), false, "one trigger per active episode");
assert.equal(shouldPrepareNextChapter({ ...base, isLatestReady: false, currentTime: 15 }), false, "only latest ready episode prepares");
assert.equal(shouldPrepareNextChapter({ ...base, canGenerate: false, currentTime: 15 }), false, "paused or non-editable books do not prepare");
assert.equal(shouldPrepareNextChapter({ ...base, isPending: true, currentTime: 15 }), false, "pending generation does not cascade");
assert.equal(shouldPrepareNextChapter({ ...base, stopAfterCurrent: true, currentTime: 15 }), false, "session ending does not prepare another chapter");
console.log("PODCAST_PLAYBACK_POLICY_OK");
