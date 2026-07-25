export const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const;

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
  source_date?: string | null;
  source_page_start?: number | null;
  source_page_end?: number | null;
}
