import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const today = read("src/pages/Today.tsx");
const insights = read("src/pages/Insights.tsx");
const shell = read("src/components/AppShell.tsx");
const profile = read("src/pages/Profile.tsx");
const unlock = read("src/components/QuietStreakUnlock.tsx");
assert.match(today, /A page or a minute of listening is enough to keep today’s rhythm\./);
assert.match(today, /Today is part of your rhythm\./);
assert.match(today, /QuietStreakStrip/);
assert.match(today, /quiet_streak_milestone_seen/);
assert.match(insights, /QuietStreakStrip/);
assert.match(shell, /QuietStreakBadge/);
assert.match(profile, /QuietStreakBadge/);
assert.match(unlock, /chapter:quiet-streak-seen:v1/);
assert.match(unlock, /motion-reduce:transition-none/);
console.log("QUIET_STREAK_UI_FIXTURES_OK");
