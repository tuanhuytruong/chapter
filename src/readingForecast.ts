import type { LogRow } from "./api";
import type { BookRow } from "./types";

export type ReadingForecast =
  | {
      kind: "observed";
      remainingUnits: number;
      readingDaysLeft: number;
      completionDate: string;
      recentReadingDays: number;
    }
  | { kind: "plan"; remainingUnits: number; readingDaysLeft: number }
  | { kind: "unavailable" };

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_READING_DAYS = 2;
const RECENT_DAYS = 28;

function localDay(date: string): string {
  const value = String(date);
  return value.includes("T")
    ? new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })
    : value.slice(0, 10);
}

function addCalendarDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Forecast from the active reading round only. An observed forecast needs two
 * distinct recent reading days; otherwise the configured reading plan remains
 * the explicit, honest fallback.
 */
export function getReadingForecast(
  book: Pick<BookRow, "total_pages" | "current_page" | "daily_pages" | "status">,
  logs: Pick<LogRow, "date" | "page_start" | "page_end">[],
  today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }),
): ReadingForecast {
  const remainingUnits = Math.max(0, book.total_pages - book.current_page);
  if (book.status === "finished" || remainingUnits <= 0 || book.total_pages <= 0) {
    return { kind: "unavailable" };
  }

  const validLogs = logs
    .map((log) => ({
      day: localDay(log.date),
      units: Math.max(0, log.page_end - log.page_start + 1),
    }))
    .filter((log) => log.units > 0)
    .sort((a, b) => a.day.localeCompare(b.day));
  const cutoff = addCalendarDays(today, -RECENT_DAYS);
  const recentLogs = validLogs.filter((log) => log.day >= cutoff && log.day <= today);
  const readingDays = [...new Set(recentLogs.map((log) => log.day))];

  if (readingDays.length >= MIN_READING_DAYS) {
    const unitsRead = recentLogs.reduce((total, log) => total + log.units, 0);
    const firstDay = readingDays[0];
    const lastDay = readingDays.at(-1)!;
    const spanDays = Math.max(
      1,
      Math.round((new Date(`${lastDay}T12:00:00Z`).getTime() - new Date(`${firstDay}T12:00:00Z`).getTime()) / DAY_MS) + 1,
    );
    // Calendar pace includes breaks between reading days, so irregular reading
    // never receives an unrealistically fast "active days only" estimate.
    const unitsPerCalendarDay = unitsRead / spanDays;
    if (unitsPerCalendarDay > 0) {
      const calendarDaysLeft = Math.max(1, Math.ceil(remainingUnits / unitsPerCalendarDay));
      const readingDaysLeft = Math.max(
        1,
        Math.ceil((remainingUnits * readingDays.length) / unitsRead),
      );
      return {
        kind: "observed",
        remainingUnits,
        readingDaysLeft,
        completionDate: addCalendarDays(today, calendarDaysLeft),
        recentReadingDays: readingDays.length,
      };
    }
  }

  if (book.daily_pages > 0) {
    return {
      kind: "plan",
      remainingUnits,
      readingDaysLeft: Math.ceil(remainingUnits / book.daily_pages),
    };
  }
  return { kind: "unavailable" };
}

export function formatForecastDate(date: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${date}T12:00:00Z`));
}
