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

  // Always render the same recent two-week window, so the activity view stays
  // compact and fits narrow screens regardless of the book's age.
  const { days, streakLen, totalReadDays } = useMemo(() => {
    const logSet = new Set<string>(byDay.keys());
    const totalReadDays = logSet.size;
    const streakLen = computeStreakLen(logSet, todayStr);
    const days = Array.from({ length: 14 }, (_, index) => shiftDateStr(todayStr, index - 13));
    return { days, streakLen, totalReadDays };
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
      <div className="flex flex-wrap items-center gap-2 text-xs text-natural-stone">
        {milestoneLabel && (
          <span className="font-bold text-natural-dark">{milestoneLabel}</span>
        )}
        <span>· {totalReadDays} days read total</span>
      </div>

      {/* Fixed 14-day grid: no horizontal scrolling at 390px. */}
      <div className="mt-5 grid grid-cols-7 gap-1.5 sm:grid-cols-14" role="grid" aria-label="Reading activity for the last 14 days">
        {days.map((dayStr) => {
          const lv = level(dayStr);
          const streak = isStreakDay(dayStr);
          const count = byDay.get(dayStr) || 0;
          const dayLabel = new Date(`${dayStr}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
          return (
            <div key={dayStr} className="min-w-0" role="gridcell" aria-label={`${dayLabel}: ${count === 0 ? 'no reading' : `${count} ${count === 1 ? 'session' : 'sessions'}`}${streak ? ', current streak' : ''}`}>
              <div className={[
                'aspect-square w-full rounded-sm',
                COLORS[lv],
                streak ? 'ring-1 ring-natural-clay ring-offset-1 ring-offset-natural-cream' : '',
              ].join(' ')} />
              <span aria-hidden="true" className="mt-1 block truncate text-center text-[9px] leading-none text-natural-stone">{dayLabel.slice(0, -1)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
