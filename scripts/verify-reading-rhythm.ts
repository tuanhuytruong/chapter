import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildReadingRhythm, dateInAppTz, formatRhythmDate } from "../src/reading-rhythm.js";

const rhythm = buildReadingRhythm({
  today: "2026-07-26",
  logDates: ["2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24", "2026-07-26", "2026-07-26"],
});
assert.equal(rhythm.days.length, 14);
const desktopRhythm = buildReadingRhythm({ today: "2026-07-26", logDates: ["2026-07-26"], windowDays: 21 });
assert.equal(desktopRhythm.days.length, 21);
assert.equal(desktopRhythm.days.at(0)?.date, "2026-07-06");
assert.equal(desktopRhythm.days.at(-1)?.isToday, true);
assert.equal(rhythm.currentStreak, 1);
assert.equal(rhythm.longestStreak, 4);
assert.equal(rhythm.totalReadDays, 5);
assert.equal(rhythm.nextMilestone?.days, 3);
assert.equal(rhythm.days.at(-1)?.sessionCount, 2);
assert.equal(rhythm.days.at(-1)?.isToday, true);
assert.equal(formatRhythmDate("2026-07-26"), "Jul 26");

const empty = buildReadingRhythm({ today: "2026-07-26", logDates: [] });
assert.equal(empty.currentStreak, 0);
assert.equal(empty.longestStreak, 0);
assert.equal(empty.nextMilestone?.remaining, 3);

const threeDayMilestone = buildReadingRhythm({
  today: "2026-08-02",
  logDates: ["2026-07-31", "2026-08-01", "2026-08-02", "2026-08-02"],
});
assert.equal(threeDayMilestone.currentStreak, 3);
assert.equal(threeDayMilestone.longestStreak, 3);
assert.equal(threeDayMilestone.reachedMilestone?.title, "Finding a rhythm");
assert.equal(threeDayMilestone.nextMilestone?.days, 7);

const fourteenDayMilestone = buildReadingRhythm({
  today: "2026-08-14",
  logDates: Array.from({ length: 14 }, (_, index) => `2026-08-${String(index + 1).padStart(2, "0")}`),
});
assert.equal(fourteenDayMilestone.currentStreak, 14);
assert.equal(fourteenDayMilestone.reachedMilestone?.title, "The thread holds");
assert.equal(fourteenDayMilestone.nextMilestone?.remaining, 16);

const listenOnly = buildReadingRhythm({
  today: "2026-08-11",
  logDates: [],
  activityDates: ["2026-08-09", "2026-08-10", "2026-08-11"],
});
assert.equal(listenOnly.currentStreak, 3, "consecutive listen-only days create an activity streak");
assert.equal(listenOnly.longestStreak, 3);
assert.equal(listenOnly.totalReadDays, 0, "listening never inflates reading days");
assert.ok(listenOnly.days.at(-1)?.isCurrentStreakDay, "today's listen-only activity is highlighted");
assert.equal(listenOnly.days.at(-1)?.sessionCount, 0, "listen-only activity has no reading sessions");

assert.equal(dateInAppTz("2026-07-25T18:30:00.000Z"), "2026-07-26");
const heatmapSource = readFileSync(new URL("../src/components/StreakHeatmap.tsx", import.meta.url), "utf8");
assert.match(heatmapSource, /activityDates: Object\.entries\(listenByDay \|\| \{\}\)/, "heatmap passes recorded listen days into streak calculation");
assert.match(heatmapSource, /\[logs, listenByDay, windowDays\]/, "heatmap recomputes when listen activity arrives");

console.log("READING_RHYTHM_FIXTURES_OK");
