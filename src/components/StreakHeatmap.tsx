import React, { useMemo } from 'react';
import type { LogRow } from '../types';

const APP_TZ = 'Asia/Bangkok';

/** Return today's date string (YYYY-MM-DD) in the app timezone. */
function todayStrInAppTz(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: APP_TZ });
}

/** Add/subtract days from a YYYY-MM-DD string, returning a new YYYY-MM-DD string. */
function shiftDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Parse a log date (ISO or YYYY-MM-DD) to a YYYY-MM-DD string in Bangkok TZ. */
function logDateToAppStr(raw: string): string {
  const s = String(raw);
  return s.includes('T')
    ? new Date(s).toLocaleDateString('en-CA', { timeZone: APP_TZ })
    : s.slice(0, 10);
}

/** Walk backwards from today to find the length of the current streak. */
function computeStreakLen(logDates: Set<string>, todayStr: string): number {
  let streak = 0;
  let cursor = todayStr;
  while (logDates.has(cursor)) {
    streak++;
    cursor = shiftDateStr(cursor, -1);
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
  const todayStr = todayStrInAppTz(); // e.g. "2026-07-22"

  // Build day → session-count map using Bangkok TZ for all dates
  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of logs) {
      const k = logDateToAppStr(String(l.date));
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [logs]);

  // Compute grid weeks anchored to first reading day
  const { weeks, streakLen, totalReadDays } = useMemo(() => {
    const logSet = new Set<string>(byDay.keys());
    const totalReadDays = logSet.size;

    // Find earliest log date string
    const firstLogStr: string = logs.length
      ? [...logSet].sort()[0] ?? todayStr
      : todayStr;

    // Align to the Sunday of that week (work in UTC date arithmetic)
    const [fy, fm, fd] = firstLogStr.split('-').map(Number);
    const firstDate = new Date(Date.UTC(fy, fm - 1, fd));
    const sundayOffset = firstDate.getUTCDay(); // 0=Sun
    const gridStartDate = new Date(Date.UTC(fy, fm - 1, fd - sundayOffset));

    // Count weeks needed from gridStart to today
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const todayDate = new Date(Date.UTC(ty, tm - 1, td));
    const diffDays = (todayDate.getTime() - gridStartDate.getTime()) / 86400000;
    const weeksNeeded = Math.ceil(diffDays / 7) + 1;
    const totalWeeks = Math.max(weeksNeeded, 4);

    // Build weeks as YYYY-MM-DD strings (no Date timezone issues)
    const gridStartStr = (() => {
      const y = gridStartDate.getUTCFullYear();
      const m = String(gridStartDate.getUTCMonth() + 1).padStart(2, '0');
      const d = String(gridStartDate.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    })();

    const w: string[][] = [];
    for (let wi = 0; wi < totalWeeks; wi++) {
      const week: string[] = [];
      for (let di = 0; di < 7; di++) {
        week.push(shiftDateStr(gridStartStr, wi * 7 + di));
      }
      w.push(week);
    }

    const streakLen = computeStreakLen(logSet, todayStr);

    return { weeks: w, streakLen, totalReadDays };
  }, [logs, byDay, todayStr]);

  const level = (dateStr: string): number => {
    const count = byDay.get(dateStr) || 0;
    return Math.min(4, count);
  };

  /** Detect if a day string is part of the current active streak. */
  const isStreakDay = (dateStr: string): boolean => {
    if (streakLen === 0) return false;
    let cursor = todayStr;
    for (let i = 0; i < streakLen; i++) {
      if (cursor === dateStr) return true;
      cursor = shiftDateStr(cursor, -1);
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
            {week.map((dayStr, di) => {
              const future = dayStr > todayStr;
              const lv = future ? 0 : level(dayStr);
              const streak = !future && isStreakDay(dayStr);
              return (
                <div
                  key={di}
                  title={dayStr}
                  className={[
                    'w-3 h-3 rounded-sm',
                    future ? 'bg-transparent' : COLORS[lv],
                    streak && lv === 0 ? 'ring-1 ring-natural-clay bg-natural-clay/20' : '',
                    streak && lv > 0  ? 'ring-1 ring-natural-clay' : '',
                  ].join(' ')}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
