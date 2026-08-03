export interface CalendarLogRow {
  id: string;
  book_id: string;
  reading_round: number;
  date: string;
  session: number;
  page_start: number;
  page_end: number;
  units_read: number;
  summary: string | null;
  chapter_title: string | null;
  title: string;
  author: string;
  file_type: "pdf" | "epub";
}

export const APP_TZ = "Asia/Bangkok";

export function monthStringInAppTz(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
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
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, value - 1, 1)));
}

export function readingUnit(
  fileType: CalendarLogRow["file_type"],
  count: number,
): string {
  const singular = fileType === "epub" ? "chunk" : "page";
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function daySummary(entries: CalendarLogRow[], compact = false): string {
  const sessions = entries.length;
  const total = entries.reduce(
    (sum, entry) => sum + Number(entry.units_read),
    0,
  );
  const kinds = new Set(entries.map((entry) => entry.file_type));
  const unit =
    kinds.size === 1
      ? readingUnit(entries[0].file_type, total)
      : `${total} reading units`;
  return compact
    ? `${sessions} session${sessions === 1 ? "" : "s"} · ${kinds.size === 1 ? `${total}${entries[0].file_type === "epub" ? "c" : "p"}` : `${total} units`}`
    : `${sessions} session${sessions === 1 ? "" : "s"} · ${unit} read`;
}

export function monthSummary(entries: CalendarLogRow[]): string {
  const days = new Set(entries.map((entry) => String(entry.date).slice(0, 10)))
    .size;
  const sessions = entries.length;
  const books = new Set(entries.map((entry) => entry.book_id)).size;
  const kinds = new Set(entries.map((entry) => entry.file_type));
  if (!entries.length) return "No reading sessions this month";
  if (kinds.size !== 1)
    return `This month: ${days} reading day${days === 1 ? "" : "s"} · ${sessions} session${sessions === 1 ? "" : "s"} across ${books} book${books === 1 ? "" : "s"}`;
  const total = entries.reduce(
    (sum, entry) => sum + Number(entry.units_read),
    0,
  );
  return `This month: ${days} reading day${days === 1 ? "" : "s"} · ${sessions} session${sessions === 1 ? "" : "s"} · ${readingUnit(entries[0].file_type, total)} read`;
}

export function calendarDayAriaLabel(
  date: string,
  entries: CalendarLogRow[],
): string {
  const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  if (!entries.length) return label;
  const titles = [...new Set(entries.map((entry) => entry.title))];
  return `${label}: ${titles.join(", ")}. ${daySummary(entries)}.`;
}
