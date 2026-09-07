export const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const;

export type ReturnOutcome = "still_true" | "changed" | "revisit" | "dismissed";
export const RETURN_TODAY_LIMIT = 1;
export const RETURNS_PAGE_LIMIT = 3;

export function nextIntervalDays(current: number, remembered: boolean): number {
  if (!remembered) return REVIEW_INTERVALS[0];
  return REVIEW_INTERVALS.find((days) => days > current) ?? REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1];
}

/** Date-only arithmetic avoids UTC conversion and follows the app's Bangkok calendar. */
export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

export function reviewOutcome(currentInterval: number, remembered: boolean, today: string) {
  const intervalDays = nextIntervalDays(currentInterval, remembered);
  return { intervalDays, dueDate: shiftDate(today, intervalDays) };
}

/** Return null for omitted/blank reflections and reject invalid or oversized input. */
export function normalizeReturnReflection(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error("reflection must be a string");
  const reflection = value.trim();
  if (!reflection) return null;
  if (reflection.length > 500) throw new Error("reflection must be at most 500 characters");
  return reflection;
}

export function isReturnOutcome(value: unknown): value is ReturnOutcome {
  return value === "still_true" || value === "changed" || value === "revisit" || value === "dismissed";
}

export function returnOutcome(currentInterval: number, outcome: ReturnOutcome, today: string) {
  const intervalDays = outcome === "revisit"
    ? REVIEW_INTERVALS[0]
    : outcome === "dismissed"
      ? Math.max(REVIEW_INTERVALS[0], currentInterval)
      : nextIntervalDays(currentInterval, true);
  return {
    intervalDays,
    dueDate: shiftDate(today, intervalDays),
    repetitions: outcome === "revisit" ? "reset" as const : outcome === "dismissed" ? "preserve" as const : "advance" as const,
  };
}

export interface ReviewCardRow {
  id: string;
  book_id: string;
  log_id: string;
  insight_index: number;
  insight: string;
  interval_days: number;
  repetitions: number;
  due_date: string;
  last_reviewed_at: string | null;
  title: string;
  author: string;
  cover_url: string | null;
  source_date?: string | null;
  source_page_start?: number | null;
  source_page_end?: number | null;
}
