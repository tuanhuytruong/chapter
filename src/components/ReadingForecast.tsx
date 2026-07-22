import React from 'react';
import { Calendar, Target, TrendingDown } from 'lucide-react';
import type { BookRow, LogRow } from '../types';

const APP_TZ = 'Asia/Bangkok';

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: APP_TZ });
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function formatLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const diff = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(diff / 86400000);
}

export default function ReadingForecast({
  book,
  logs,
}: {
  book: BookRow;
  logs: LogRow[];
}) {
  const remaining = Math.max(0, book.total_pages - book.current_page);
  if (remaining <= 0 || book.status === 'finished') return null;

  const now = todayStr();

  // Target pace: daily_pages setting
  const targetNeeded = Math.ceil(remaining / Math.max(book.daily_pages, 1));
  const targetFinish = addDays(now, targetNeeded);

  // Actual pace: first aggregate every session into its calendar day. A reader
  // may finish several 20-page sessions on the same date; that date must count
  // as 40/60/etc. pages, not only the configured single-session target.
  const sevenAgo = addDays(now, -6);
  const pagesByDate = new Map<string, number>();
  for (const l of logs) {
    const raw = String(l.date);
    const d = raw.includes('T')
      ? new Date(raw).toLocaleDateString('en-CA', { timeZone: APP_TZ })
      : raw.slice(0, 10);
    if (d >= sevenAgo && d <= now) {
      const pagesInSession = Math.max(0, l.page_end - l.page_start + 1);
      pagesByDate.set(d, (pagesByDate.get(d) || 0) + pagesInSession);
    }
  }

  const totalRecentPages = [...pagesByDate.values()].reduce((sum, pages) => sum + pages, 0);
  const readingDays = pagesByDate.size;
  // Forecast reflects the user's pace on days they actually read. This keeps
  // multi-session days accurate rather than diluting a 40-page day to 20 or
  // spreading it over inactive calendar days.
  const avgPerDay = readingDays > 0 ? Math.round((totalRecentPages / readingDays) * 10) / 10 : 0;
  const hasRecentData = readingDays > 0;
  const actualNeeded = avgPerDay > 0 ? Math.ceil(remaining / avgPerDay) : null;
  const actualFinish = actualNeeded ? addDays(now, actualNeeded) : null;

  // Catch-up suggestion
  const behind = avgPerDay > 0 && avgPerDay < book.daily_pages;
  const extraNeeded = behind ? Math.ceil(book.daily_pages - avgPerDay) : 0;

  // Progress bar: min of the two estimates for visual
  const maxDays = Math.max(targetNeeded, actualNeeded || targetNeeded);
  const targetPct = Math.min(100, Math.round((targetNeeded / maxDays) * 100));
  const actualPct = actualNeeded ? Math.min(100, Math.round((actualNeeded / maxDays) * 100)) : null;

  return (
    <div className="space-y-3 mt-4 pt-4 border-t border-natural-border/60">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-natural-stone font-sans flex items-center gap-1.5">
        <Calendar className="w-3 h-3" /> Reading Forecast
      </h4>

      <div className="text-xs text-natural-muted font-sans space-y-1">
        <span className="text-natural-dark font-medium">{remaining}</span> pages remaining
      </div>

      {/* Target pace row */}
      <div className="flex items-start gap-3">
        <Target className="w-4 h-4 text-natural-sage shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-sans">
            <span className="text-natural-dark font-semibold">Target pace:</span>{' '}
            <span className="text-natural-dark">{formatLabel(targetFinish)}</span>
          </p>
          <p className="text-[10px] text-natural-stone">
            {book.daily_pages} pages/day → ~{targetNeeded} day{targetNeeded > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Actual pace row */}
      <div className="flex items-start gap-3">
        {behind
          ? <TrendingDown className="w-4 h-4 text-natural-clay shrink-0 mt-0.5" />
          : <TrendingDown className="w-4 h-4 text-natural-sage shrink-0 mt-0.5" />
        }
        <div className="flex-1 min-w-0">
          {hasRecentData ? (
            <>
              <p className="text-xs font-sans">
                <span className="text-natural-dark font-semibold">Actual pace:</span>{' '}
                <span className={behind ? 'text-natural-clay' : 'text-natural-dark'}>
                  {actualFinish ? formatLabel(actualFinish) : '—'}
                </span>
              </p>
              <p className="text-[10px] text-natural-stone">
                {avgPerDay} pages/day avg across {readingDays} reading day{readingDays > 1 ? 's' : ''} (last 7d) → ~{actualNeeded} day{actualNeeded! > 1 ? 's' : ''}
              </p>
              {behind && (
                <p className="text-[10px] text-natural-clay mt-1 flex items-start gap-1">
                  <span>↓</span>
                  <span>
                    Reading <b>{extraNeeded}</b> more page{extraNeeded > 1 ? 's' : ''}/
                    day would catch up to target
                  </span>
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-natural-stone italic font-sans">
              No reading data in the last 7 days — keep reading to see your actual pace
            </p>
          )}
        </div>
      </div>

      {/* Visual bar */}
      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1 h-2 bg-natural-border rounded-full overflow-hidden flex">
          <div
            className="h-full bg-natural-sage/60 rounded-l-full transition-all"
            style={{ width: `${targetPct}%` }}
            title="Target pace"
          />
          {actualPct !== null && (
            <div
              className={`h-full rounded-r-full transition-all ${behind ? 'bg-natural-clay/50' : 'bg-natural-sage'}`}
              style={{ width: `${Math.max(0, actualPct - targetPct)}%` }}
              title="Actual pace"
            />
          )}
        </div>
        <span className="text-[9px] text-natural-stone font-sans whitespace-nowrap">
          {targetNeeded}d
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[9px] text-natural-stone font-sans">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-natural-sage/60" /> Target</span>
        {actualPct !== null && (
          <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-sm ${behind ? 'bg-natural-clay/50' : 'bg-natural-sage'}`} /> Actual</span>
        )}
      </div>
    </div>
  );
}
