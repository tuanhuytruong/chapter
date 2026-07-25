import { achievementFixtureCheck, longestReadingStreak } from "../src/achievements.js";

achievementFixtureCheck();
if (longestReadingStreak(["2026-01-31", "2026-02-01", "2026-02-02"]) !== 3) throw new Error("month-boundary streak failed");
if (longestReadingStreak(["2026-02-01", "2026-02-01"]) !== 1) throw new Error("duplicate-date streak failed");
console.log("ACHIEVEMENT_FIXTURES_OK");
