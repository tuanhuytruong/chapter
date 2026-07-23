export const APP_TZ = "Asia/Bangkok";
export type WeeklyGoalMetric = "sessions" | "units";

export interface WeeklyGoalRow {
  id: string;
  owner_id: string;
  metric: WeeklyGoalMetric;
  target: number;
  updated_at: string;
}

export interface WeeklyGoalProgress {
  goal: WeeklyGoalRow | null;
  week_start: string;
  week_end: string;
  today: string;
  completed: number;
  remaining: number;
  days_left: number;
  recommended_per_day: number;
  status: "no_goal" | "met" | "on_track" | "behind";
}

export function dateInAppTz(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (name: string) => parts.find((item) => item.type === name)?.value;
  const year = part("year"); const month = part("month"); const day = part("day");
  if (!year || !month || !day) throw new Error("Could not derive app-timezone date");
  return `${year}-${month}-${day}`;
}

export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

export function weekBounds(today: string): { weekStart: string; weekEnd: string; daysElapsed: number; daysLeft: number } {
  const [year, month, day] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysElapsed = weekday === 0 ? 7 : weekday;
  return { weekStart: shiftDate(today, -(daysElapsed - 1)), weekEnd: shiftDate(today, 7 - daysElapsed), daysElapsed, daysLeft: 7 - daysElapsed };
}

export function goalStatus(target: number, completed: number, daysElapsed: number): "met" | "on_track" | "behind" {
  if (completed >= target) return "met";
  return completed >= Math.ceil((target * daysElapsed) / 7) ? "on_track" : "behind";
}

export function progressFor(goal: WeeklyGoalRow | null, completed: number, today = dateInAppTz()): WeeklyGoalProgress {
  const bounds = weekBounds(today);
  if (!goal) return { goal: null, week_start: bounds.weekStart, week_end: bounds.weekEnd, today, completed, remaining: 0, days_left: bounds.daysLeft, recommended_per_day: 0, status: "no_goal" };
  const remaining = Math.max(0, goal.target - completed);
  return { goal, week_start: bounds.weekStart, week_end: bounds.weekEnd, today, completed, remaining, days_left: bounds.daysLeft, recommended_per_day: remaining === 0 ? 0 : Math.ceil(remaining / Math.max(1, bounds.daysLeft)), status: goalStatus(goal.target, completed, bounds.daysElapsed) };
}
