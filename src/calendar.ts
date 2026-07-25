export interface CalendarLogRow {
  id: string;
  book_id: string;
  date: string;
  session: number;
  page_start: number;
  page_end: number;
  units_read: number;
  summary: string | null;
  chapter_title: string | null;
  title: string;
  author: string;
}

export const APP_TZ = "Asia/Bangkok";

export function monthStringInAppTz(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: APP_TZ, year: "numeric", month: "2-digit" }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Could not derive app-timezone month");
  return `${year}-${month}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(month: string): number {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value, 0)).getUTCDate();
}

export function weekdayOffset(month: string): number {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value - 1, 1)).getUTCDay();
}

export function calendarDate(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, value - 1, 1)));
}
