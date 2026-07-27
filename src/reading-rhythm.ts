export const APP_TZ = "Asia/Bangkok";

export const RHYTHM_MILESTONES = [
  { days: 3, title: "Finding a rhythm" },
  { days: 7, title: "A week with the book" },
  { days: 14, title: "The thread holds" },
  { days: 30, title: "A reading season" },
  { days: 100, title: "A lasting practice" },
] as const;

export type RhythmMilestone = (typeof RHYTHM_MILESTONES)[number];

export type RhythmDay = {
  date: string;
  sessionCount: number;
  level: 0 | 1 | 2 | 3 | 4;
  isCurrentStreakDay: boolean;
  isToday: boolean;
};

export type ReadingRhythm = {
  days: RhythmDay[];
  currentStreak: number;
  longestStreak: number;
  totalReadDays: number;
  nextMilestone: (RhythmMilestone & { remaining: number }) | null;
  reachedMilestone: RhythmMilestone | null;
};

function shiftDateStr(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function consecutiveDaysEndingAt(readingDays: Set<string>, endingAt: string): number {
  let length = 0;
  let cursor = endingAt;
  while (readingDays.has(cursor)) {
    length++;
    cursor = shiftDateStr(cursor, -1);
  }
  return length;
}

function longestConsecutiveDays(readingDays: Set<string>): number {
  let longest = 0;
  for (const date of readingDays) {
    longest = Math.max(longest, consecutiveDaysEndingAt(readingDays, date));
  }
  return longest;
}

export function dateInAppTz(raw: string | Date): string {
  if (raw instanceof Date) return raw.toLocaleDateString("en-CA", { timeZone: APP_TZ });
  if (!raw.includes("T")) return raw.slice(0, 10);
  return new Date(raw).toLocaleDateString("en-CA", { timeZone: APP_TZ });
}

export function todayInAppTz(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: APP_TZ });
}

export function buildReadingRhythm({ today, logDates, windowDays = 14 }: { today: string; logDates: string[]; windowDays?: number }): ReadingRhythm {
  const sessionsByDay = new Map<string, number>();
  for (const rawDate of logDates) {
    const date = dateInAppTz(rawDate);
    sessionsByDay.set(date, (sessionsByDay.get(date) || 0) + 1);
  }

  const readingDays = new Set(sessionsByDay.keys());
  const currentStreak = consecutiveDaysEndingAt(readingDays, today);
  const longestStreak = longestConsecutiveDays(readingDays);
  const currentStreakStart = shiftDateStr(today, -(currentStreak - 1));
  const days = Array.from({ length: windowDays }, (_, index) => {
    const date = shiftDateStr(today, index - (windowDays - 1));
    const sessionCount = sessionsByDay.get(date) || 0;
    return {
      date,
      sessionCount,
      level: Math.min(4, sessionCount) as RhythmDay["level"],
      isCurrentStreakDay: currentStreak > 0 && date >= currentStreakStart && date <= today,
      isToday: date === today,
    };
  });

  const reachedMilestone = RHYTHM_MILESTONES.find((milestone) => milestone.days === currentStreak) || null;
  const next = RHYTHM_MILESTONES.find((milestone) => milestone.days > currentStreak) || null;

  return {
    days,
    currentStreak,
    longestStreak,
    totalReadDays: readingDays.size,
    reachedMilestone,
    nextMilestone: next ? { ...next, remaining: next.days - currentStreak } : null,
  };
}

export function formatRhythmDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  const monthName = new Date(Date.UTC(2000, Number(month) - 1, 1)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${monthName} ${Number(day)}`;
}
