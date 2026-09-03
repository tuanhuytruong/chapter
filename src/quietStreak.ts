export type QuietStreakTierId = "first-thread" | "steady-reader" | "quiet-practice" | "deep-current" | "reading-life";
export type QuietStreakTier = { id: QuietStreakTierId; title: string; days: number; ringClass: string; description: string };
export const QUIET_STREAK_TIERS: readonly QuietStreakTier[] = [
  { id: "first-thread", title: "First Thread", days: 3, ringClass: "ring-natural-sage/70", description: "Three days of making room for a story." },
  { id: "steady-reader", title: "Steady Reader", days: 7, ringClass: "ring-natural-sage", description: "A week held gently in rhythm." },
  { id: "quiet-practice", title: "Quiet Practice", days: 21, ringClass: "ring-orange-700/65", description: "A practice taking a quieter, deeper shape." },
  { id: "deep-current", title: "Deep Current", days: 60, ringClass: "ring-indigo-500/70", description: "A current you have kept returning to." },
  { id: "reading-life", title: "A Reading Life", days: 180, ringClass: "ring-amber-400", description: "Reading has become part of how you live." },
];
export type QuietStreakSummary = { active_days: string[]; current_streak: number; longest_streak: number; highest_tier: QuietStreakTier | null; next_tier: QuietStreakTier | null; active_today: boolean };
const DAY_MS = 86400000; const APP_TZ = "Asia/Bangkok";
export function quietStreakDateKey(value: string | Date): string { if (value instanceof Date) return value.toLocaleDateString("en-CA", { timeZone: APP_TZ }); const raw = String(value); return raw.includes("T") ? new Date(raw).toLocaleDateString("en-CA", { timeZone: APP_TZ }) : raw.slice(0, 10); }
export function activeDays(readingDays: string[], listeningDays: string[]): string[] { return [...new Set([...readingDays, ...listeningDays].map(quietStreakDateKey).filter(Boolean))].sort(); }
function dayNumber(day: string): number { return Date.parse(`${day}T00:00:00Z`); }
function shiftDay(day: string, amount: number): string { return new Date(dayNumber(day) + amount * DAY_MS).toISOString().slice(0, 10); }
export function longestQuietStreak(days: string[]): number { let longest = 0, run = 0, previous = ""; for (const day of days) { run = previous && dayNumber(day) - dayNumber(previous) === DAY_MS ? run + 1 : 1; longest = Math.max(longest, run); previous = day; } return longest; }
export function quietStreakSummary(readingDays: string[], listeningDays: string[], now = new Date()): QuietStreakSummary { const days = activeDays(readingDays, listeningDays); const daySet = new Set(days); const today = quietStreakDateKey(now); let cursor = daySet.has(today) ? today : shiftDay(today, -1); let current = 0; while (daySet.has(cursor)) { current++; cursor = shiftDay(cursor, -1); } const longest = longestQuietStreak(days); const highest = [...QUIET_STREAK_TIERS].reverse().find((tier) => longest >= tier.days) || null; const next = QUIET_STREAK_TIERS.find((tier) => longest < tier.days) || null; return { active_days: days, current_streak: current, longest_streak: longest, highest_tier: highest, next_tier: next, active_today: daySet.has(today) }; }
