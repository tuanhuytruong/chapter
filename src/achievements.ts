export type AchievementIcon = "book" | "books" | "flame" | "calendar" | "sparkles" | "brain" | "heart" | "repeat";

export type AchievementProgress = {
  id: string;
  title: string;
  description: string;
  icon: AchievementIcon;
  earned: boolean;
  current: number;
  target: number;
  unit_label: string;
};

export type AchievementInput = {
  books_added: number;
  books_finished: number;
  units_read: number;
  reading_days: string[];
  insights_saved: number;
  reflections_created: number;
  reviews_completed: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(value: string): string {
  const raw = String(value);
  if (!raw.includes("T")) return raw.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(raw));
}

function utcDay(value: string): number {
  return Date.parse(`${value}T00:00:00Z`);
}

export function longestReadingStreak(readingDays: string[]): number {
  const days = [...new Set(readingDays.map(dateKey).filter(Boolean))].sort();
  let longest = 0;
  let run = 0;
  let previous = "";
  for (const day of days) {
    run = previous && utcDay(day) - utcDay(previous) === DAY_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return longest;
}

function milestone(id: string, title: string, description: string, icon: AchievementIcon, current: number, target: number, unitLabel: string): AchievementProgress {
  return { id, title, description, icon, current: Math.min(current, target), target, unit_label: unitLabel, earned: current >= target };
}

/** Derive personal milestones from existing owner-scoped book, log, and review facts. */
export function evaluateAchievements(input: AchievementInput): AchievementProgress[] {
  const streak = longestReadingStreak(input.reading_days);
  const distinctDays = new Set(input.reading_days.map(dateKey)).size;
  return [
    milestone("first-chapter", "First Chapter", "Finish your first book in Chapter.", "book", input.books_finished, 1, "book finished"),
    milestone("growing-shelf", "Growing Shelf", "Build a small library of books you chose intentionally.", "books", input.books_added, 5, "books added"),
    milestone("week-in-rhythm", "Week in Rhythm", "Read on seven consecutive days.", "flame", streak, 7, "day streak"),
    milestone("two-week-flow", "Two-Week Flow", "Keep the reading rhythm alive for fourteen days.", "flame", streak, 14, "day streak"),
    milestone("century-reader", "Century Reader", "Read one hundred pages or reading chunks.", "sparkles", input.units_read, 100, "reading units"),
    milestone("deep-dive", "Deep Dive", "Read five hundred pages or reading chunks.", "sparkles", input.units_read, 500, "reading units"),
    milestone("thirty-day-practice", "Thirty-Day Practice", "Make room for reading on thirty distinct days.", "calendar", distinctDays, 30, "reading days"),
    milestone("insight-collector", "Insight Collector", "Save twenty-five ideas worth returning to.", "brain", input.insights_saved, 25, "insights"),
    milestone("reflective-reader", "Reflective Reader", "Create an end-of-book reflection in your own reading journey.", "heart", input.reflections_created, 1, "reflection"),
    milestone("memory-gardener", "Memory Gardener", "Complete ten spaced-repetition reviews.", "repeat", input.reviews_completed, 10, "reviews"),
  ];
}

export type AchievementsResponse = {
  achievements: AchievementProgress[];
  summary: { earned_count: number; total_count: number; next: AchievementProgress | null };
};

export function achievementResponse(input: AchievementInput): AchievementsResponse {
  const achievements = evaluateAchievements(input);
  const earnedCount = achievements.filter((achievement) => achievement.earned).length;
  const next = achievements.filter((achievement) => !achievement.earned)
    .sort((a, b) => (b.current / b.target) - (a.current / a.target))[0] || null;
  return { achievements, summary: { earned_count: earnedCount, total_count: achievements.length, next } };
}

export function achievementFixtureCheck(): void {
  const result = achievementResponse({
    books_added: 5, books_finished: 1, units_read: 100,
    reading_days: ["2026-07-29", "2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-04"],
    insights_saved: 25, reflections_created: 1, reviews_completed: 10,
  });
  const byId = Object.fromEntries(result.achievements.map((achievement) => [achievement.id, achievement]));
  if (!byId["week-in-rhythm"].earned || byId["two-week-flow"].earned || byId["century-reader"].current !== 100 || byId["thirty-day-practice"].current !== 7) {
    throw new Error("achievement fixture failed");
  }
}
