import React from 'react';
import type { LogRow } from '../types';

// GitHub-style contribution heatmap from reading_log dates.
export default function StreakHeatmap({ logs }: { logs: LogRow[] }) {
  const days = new Set(logs.map(l => l.date.slice(0, 10)));
  const weeks: Date[][] = [];
  const today = new Date();
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
    const key = dt.toISOString().slice(0, 10);
    if (!days.has(key)) return 0;
    const count = logs.filter(l => l.date.slice(0, 10) === key).length;
    return Math.min(4, count);
  };
  const color = (lv: number) => ['bg-natural-cream', 'bg-natural-sage/30', 'bg-natural-sage/60', 'bg-natural-sage/80', 'bg-natural-sage'][lv];

  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((day, di) => {
            const future = day > today;
            return (
              <div key={di} title={day.toISOString().slice(0, 10)}
                className={`w-3 h-3 rounded-sm ${future ? 'bg-transparent' : color(level(day))} border border-natural-border/40`} />
            );
          })}
        </div>
      ))}
    </div>
  );
}
