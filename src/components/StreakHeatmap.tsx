import React, { useMemo } from 'react';
import type { LogRow } from '../types';

const APP_TZ = 'Asia/Bangkok';

function todayInAppTz(): Date {
  const parts = new Date().toLocaleDateString('en-CA', { timeZone: APP_TZ }).split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Walk backwards from today to find the length of the current streak. */
function computeStreakLen(logDates: Set<string>, today: Date): number {
  let streak = 0;
  const cursor = new Date(today);
  while (logDates.has(localDateStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
    // safety — cap at 365 to avoid infinite loops on dense data
    if (streak > 365) break;
  }
  return streak;
}

// Hardcoded color ramp (not opacity variants) so levels are clearly distinct.
// Empty cells use the CSS variable --color-heatmap-empty (light and dark aware).
const COLORS = [
  'bg-heatmap-empty',  // 0 — empty (faint border-like bg)
  'bg-[#A8BF8A]',    // 1 — light sage
  'bg-[#7A9E6A]',    // 2 — medium sage
  'bg-[#4E7A52]',    // 3 — deep sage
  'bg-[#2E5C38]',    // 4 — forest green (power reader)
] as const;

export default function StreakHeatmap({ logs }: { logs: LogRow[] }) {
  const today = todayInAppTz();

  // Build day → session-count map
  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of logs) {
      const k = String(l.date).includes('T')
        ? new Date(l.date).toLocaleDateString('en-CA', { timeZone: APP_TZ })
        : l.date.slice(0, 10);
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [logs]);

  // Compute grid weeks anchored to first reading day
  const { weeks, streakLen, totalReadDays } = useMemo(() => {
    const logSet = new Set(byDay.keys());
    const totalReadDays = logSet.size;

    const firstLog = logs.length
      ? new Date(Math.min(...logs.map(l => {
          const raw = String(l.date).includes('T')
            ? new Date(l.date).toLocaleDateString('en-CA', { timeZone: APP_TZ })
            : l.date.slice(0, 10);
          return new Date(raw).getTime();
        })))
      : today;

    // Align to the Sunday of that week
    const gridStart = new Date(firstLog);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());

    // Weeks from gridStart to today + 1 future week for context
    const diffMs = today.getTime() - gridStart.getTime();
    const weeksNeeded = Math.ceil(diffMs / (7 * 86400000)) + 1;
    const totalWeeks = Math.max(weeksNeeded, 4);

    const w: Date[][] = [];
    for (let wi = 0; wi < totalWeeks; wi++) {
      const week: Date[] = [];
      for (let di = 0; di < 7; di++) {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + wi * 7 + di);
        week.push(d);
      }
      w.push(week);
    }

    const streakLen = computeStreakLen(logSet, today);

    return { weeks: w, streakLen, totalReadDays };
  }, [logs, byDay, today]);

  const level = (dt: Date): number => {
    const key = localDateStr(dt);
    const count = byDay.get(key) || 0;
    return Math.min(4, count);
  };

  /** Detect if a day is part of the current active streak. */
  const isStreakDay = (dt: Date): boolean => {
    const cursor = new Date(today);
    for (let i = 0; i < streakLen; i++) {
      if (localDateStr(cursor) === localDateStr(dt)) return true;
      cursor.setDate(cursor.getDate() - 1);
    }
    return false;
  };

  // Milestone labels
  const milestoneLabel =
    streakLen >= 30 ? '🔥 30-day streak — On fire!' :
    streakLen >= 14 ? '🔥 14-day streak — Unstoppable!' :
    streakLen >= 7  ? '🔥 7-day streak — Keep it up!' :
    streakLen >= 3  ? '🔥 3-day streak — Nice!' :
    streakLen > 0   ? `🔥 ${streakLen}-day streak`  : '';

  return (
    <div className="space-y-3">
      {/* Streak + stats bar */}
      <div className="flex items-center gap-2 text-xs text-natural-stone flex-wrap">
        {milestoneLabel && (
          <span className="font-bold text-natural-dark">{milestoneLabel}</span>
        )}
        <span>· {totalReadDays} days read total</span>
      </div>

      {/* Grid */}
      <div className="flex gap-1 overflow-x-auto pb-1 px-0.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => {
              const future = day > today;
              const lv = future ? 0 : level(day);
              const streak = isStreakDay(day);
              return (
                <div
                  key={di}
                  title={localDateStr(day)}
                  className={`w-3 h-3 rounded-sm ${future ? 'bg-transparent' : COLORS[lv]} ${streak ? 'ring-1 ring-natural-clay' : ''}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
