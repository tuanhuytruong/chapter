import React, { useMemo } from "react";
import type { LogRow } from "../types";
import { buildReadingRhythm, dateInAppTz, formatRhythmDate, todayInAppTz } from "../reading-rhythm";

const COLORS = [
  "bg-heatmap-empty",
  "bg-[#A8BF8A]",
  "bg-[#7A9E6A]",
  "bg-[#4E7A52]",
  "bg-[#2E5C38]",
] as const;

function dayAriaLabel(day: ReturnType<typeof buildReadingRhythm>["days"][number]): string {
  const activity = day.sessionCount === 0
    ? "no reading"
    : `${day.sessionCount} ${day.sessionCount === 1 ? "reading session" : "reading sessions"}`;
  return `${formatRhythmDate(day.date)}${day.isToday ? ", today" : ""}: ${activity}${day.isCurrentStreakDay ? ", part of your current rhythm" : ""}`;
}

export default function StreakHeatmap({ logs, windowDays = 14 }: { logs: LogRow[]; windowDays?: number }) {
  const rhythm = useMemo(() => buildReadingRhythm({
    today: todayInAppTz(),
    logDates: logs.map((log) => dateInAppTz(log.date)),
    windowDays,
  }), [logs, windowDays]);

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
          {rhythm.days.map((day) => (
            <div
              key={day.date}
              role="gridcell"
              aria-label={dayAriaLabel(day)}
              title={dayAriaLabel(day)}
              className={[
                "h-4 w-4 shrink-0 rounded-[3px]",
                COLORS[day.level],
                day.isCurrentStreakDay ? "ring-1 ring-natural-clay ring-offset-1 ring-offset-natural-cream" : "",
                day.isToday ? "outline outline-1 outline-natural-stone/40" : "",
              ].join(" ")}
            />
          ))}
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
