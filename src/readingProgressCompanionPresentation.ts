import type { LogRow, ReadingProgressCompanionRow } from "./types";

export type ReadingProgressActionState =
  | { kind: "action"; label: "Create reading thread" | "Refresh reading thread" }
  | { kind: "disabled"; label: "Create reading thread" | "Refresh reading thread"; reason: string }
  | { kind: "shared"; message: string };

export function formatCompanionCoverage(
  lastLogDate: string | null,
  lastLogSession: number | null,
  sessionsCovered: number,
): string {
  if (!lastLogDate || !lastLogSession) {
    return `Updated from ${sessionsCovered} saved ${sessionsCovered === 1 ? "session" : "sessions"}`;
  }
  // API serialization can supply either a PostgreSQL date (YYYY-MM-DD) or a
  // full ISO timestamp. Normalize both without appending a second time suffix.
  const parsed = new Date(lastLogDate);
  if (Number.isNaN(parsed.getTime())) {
    return `Updated from ${sessionsCovered} saved ${sessionsCovered === 1 ? "session" : "sessions"}`;
  }
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(parsed);
  return `Updated through ${date} · Session ${lastLogSession}`;
}

export function newerSavedSessionCount(logs: LogRow[], coveredLogId: string | null): number {
  if (!coveredLogId) return 0;
  const covered = logs.find((log) => log.id === coveredLogId);
  if (!covered) return 0;
  const coveredAt = Date.parse(covered.created_at);
  return logs.filter((log) => log.id !== coveredLogId && Date.parse(log.created_at) > coveredAt).length;
}

export function readingProgressActionState(input: {
  canEdit: boolean;
  hasRawText: boolean;
  bookStatus: string;
  companion: ReadingProgressCompanionRow | null;
}): ReadingProgressActionState {
  if (!input.canEdit) return { kind: "shared", message: "The book owner can refresh this reading thread." };
  const label = input.companion ? "Refresh reading thread" : "Create reading thread";
  if (input.bookStatus !== "active") return { kind: "disabled", label, reason: "Resume this book to update its reading thread." };
  if (!input.hasRawText) return { kind: "disabled", label, reason: "Available after a saved session includes selectable source text." };
  return { kind: "action", label };
}
