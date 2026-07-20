import React from 'react';
import type { LogRow } from '../types';

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// GitHub-style contribution heatmap from reading_log dates.
// Uses LOCAL date strings so cells align with the user's calendar day (not UTC).
export default function StreakHeatmap({ logs }: { logs: LogRow[] }) {
  const byDay = new Map<string, number>();
  for (const l of logs) {
    const k = l.date.slice(0, 10);
    byDay.set(k, (byDay.get(k) || 0) + 1);
  }

  const weeks: Date[][] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // start 18 weeks ago, aligned to Sunday
  const start = new Date(today);
  start.setDate(start.getDate() - (18 * 7 + today.getDay()));

  for (let w = 0; w < 19; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      week.push(day);
    }
    weeks.push(week);
  }

  const level = (dt: Date) => {
    const key = localDateStr(dt);
    const count = byDay.get(key) || 0;
    return Math.min(4, count);
  };
  const color = (lv: number) =>
    ["bg-natural-cream", "bg-natural-sage/30", "bg-natural-sage/60", "bg-natural-sage/80", "bg-natural-sage"][lv];

  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((day, di) => {
            const future = day > today;
            return (
              <div
                key={di}
                title={localDateStr(day)}
                className={`w-3 h-3 rounded-sm ${future ? "bg-transparent" : color(level(day))} border border-natural-border/40`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
