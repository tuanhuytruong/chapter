import React, { useMemo } from "react";
import type { LogRow } from "../types";
import { buildReadingRhythm, dateInAppTz, formatRhythmDate, todayInAppTz } from "../reading-rhythm";

type ListenDayInfo = { episodes: number; seconds: number };

// Twin-track palette (shared with Insights): read = sage, listen = amber,
// both = dark. No intensity shading — a day is read, listened, both, or none.
const CELL_COLOR = {
  none: "bg-heatmap-empty",
  read: "bg-natural-sage",
  listen: "bg-amber-300",
  both: "bg-natural-dark",
} as const;

type CellState = keyof typeof CELL_COLOR;

function pagesForDay(logs: LogRow[]): Map<string, number> {
  const pages = new Map<string, number>();
  for (const log of logs) {
    const day = dateInAppTz(log.date);
    const count = Math.max(0, (log.page_end ?? 0) - (log.page_start ?? 0) + 1);
    pages.set(day, (pages.get(day) || 0) + count);
  }
  return pages;
}

function formatMinutes(totalSeconds: number): string {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  return `${minutes} min`;
}

function dayState(
  sessionCount: number,
  listen: ListenDayInfo | undefined,
): CellState {
  const hasRead = sessionCount > 0;
  const hasListen = !!listen && (listen.episodes > 0 || listen.seconds > 0);
  return hasRead && hasListen ? "both" : hasRead ? "read" : hasListen ? "listen" : "none";
}

export default function StreakHeatmap({
  logs,
  windowDays = 14,
  listenByDay,
}: {
  logs: LogRow[];
  windowDays?: number;
  listenByDay?: Record<string, ListenDayInfo>;
}) {
  const rhythm = useMemo(() => buildReadingRhythm({
    today: todayInAppTz(),
    logDates: logs.map((log) => dateInAppTz(log.date)),
    windowDays,
  }), [logs, windowDays]);

  const pagesByDay = useMemo(() => pagesForDay(logs), [logs]);

  const rewardLine = rhythm.reachedMilestone
    ? `${rhythm.reachedMilestone.title} · reached today`
    : rhythm.nextMilestone && rhythm.currentStreak > 0
      ? `${rhythm.nextMilestone.remaining} more reading ${rhythm.nextMilestone.remaining === 1 ? "day" : "days"} → ${rhythm.nextMilestone.title}`
      : rhythm.nextMilestone
        ? "Your next rhythm begins with one page today."
        : "A lasting practice · 100-day rhythm";

  const oldestDay = rhythm.days[0];
  const newestDay = rhythm.days.at(-1)!;

  return (
    <section className="w-full space-y-2.5" aria-label="Reading rhythm">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-natural-stone">
        <span className="font-semibold text-natural-dark">
          {rhythm.currentStreak > 0 ? `${rhythm.currentStreak}-day rhythm` : "Start a reading rhythm"}
        </span>
        <span aria-hidden="true" className="text-natural-border">·</span>
        <span>Best {rhythm.longestStreak} {rhythm.longestStreak === 1 ? "day" : "days"}</span>
      </div>

      <div className="w-fit">
        <div className="flex items-center gap-1" role="grid" aria-label="Reading activity for the last 14 days">
          {rhythm.days.map((day) => {
            const listen = listenByDay?.[day.date];
            const state = dayState(day.sessionCount, listen);
            const pages = pagesByDay.get(day.date) || 0;
            const parts: string[] = [];
            if (day.sessionCount > 0)
              parts.push(`${day.sessionCount} ${day.sessionCount === 1 ? "session" : "sessions"} · ${pages} ${pages === 1 ? "page" : "pages"}`);
            else parts.push("No reading");
            if (listen && (listen.episodes > 0 || listen.seconds > 0))
              parts.push(`${listen.episodes} ${listen.episodes === 1 ? "episode" : "episodes"} · ${formatMinutes(listen.seconds)}`);
            const ariaLabel = `${formatRhythmDate(day.date)}${day.isToday ? ", today" : ""}: ${parts.join(", ")}${day.isCurrentStreakDay ? ", part of your current rhythm" : ""}`;
            return (
              <span
                key={day.date}
                className="group relative inline-block"
              >
                <div
                  role="gridcell"
                  aria-label={ariaLabel}
                  className={[
                    "h-4 w-4 shrink-0 rounded-[3px] lg:h-[18px] lg:w-[18px]",
                    CELL_COLOR[state],
                    day.isCurrentStreakDay ? "ring-1 ring-natural-clay ring-offset-1 ring-offset-natural-cream" : "",
                    day.isToday ? "outline outline-1 outline-natural-stone/40" : "",
                  ].join(" ")}
                />
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-max max-w-52 -translate-x-1/2 rounded-lg border border-natural-border bg-natural-dark px-2.5 py-1.5 text-left shadow-lg group-hover:block"
                >
                  <strong className="block text-[10px] font-bold text-white">
                    {formatRhythmDate(day.date)}{day.isToday ? " · Today" : ""}
                  </strong>
                  <span className="mt-0.5 flex items-center gap-1 text-[10px] leading-snug text-white/90">
                    <span className={`inline-block h-2 w-2 shrink-0 rounded-[2px] ${state === "none" ? "bg-white/30" : CELL_COLOR[state]}`} />
                    {parts.join(" · ")}
                  </span>
                  {day.isCurrentStreakDay && (
                    <span className="mt-1 block text-[10px] font-bold text-natural-clay">🔥 part of your current rhythm</span>
                  )}
                </span>
              </span>
            );
          })}
        </div>

        <div aria-hidden="true" className="mt-1 flex justify-between text-[10px] leading-none text-natural-stone">
          <span>{formatRhythmDate(oldestDay.date)}</span>
          <span>{newestDay.isToday ? "Today" : formatRhythmDate(newestDay.date)}</span>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-natural-stone">{rewardLine}</p>
    </section>
  );
}
