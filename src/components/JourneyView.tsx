import React, { useState } from 'react';
import type { LogRow } from '../types';

export default function JourneyView({ logs, expanded, setExpanded }: { logs: LogRow[]; expanded: string | null; setExpanded: (id: string | null) => void }) {
  const byDate = groupByDate(logs);
  return (
    <div className="relative pl-8">
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-natural-border" />
      {[...byDate.entries()].map(([date, dayLogs]) => (
        <div key={date} className="relative mb-4">
          <div className="absolute -left-5 top-1.5 w-3 h-3 rounded-full bg-natural-sage border-2 border-natural-cream" />
          <p className="text-[10px] font-bold text-natural-stone uppercase tracking-wider mb-1">
            {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
          {dayLogs.map((log, si) => (
            <button key={log.id} onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              className="w-full text-left bg-natural-cream border border-natural-border rounded-xl p-3 mb-1.5 hover:border-natural-sage/40 transition">
              <div className="flex items-center justify-between">
                <p className="text-xs text-natural-dark line-clamp-1">{log.summary || 'Session summary...'}</p>
                <span className="text-[10px] text-natural-stone ml-2 shrink-0">
                  {log.page_start}–{log.page_end}p {dayLogs.length > 1 && `· S${si + 1}`}
                </span>
              </div>
              {expanded === log.id && (
                <div className="mt-2 pt-2 border-t border-natural-border space-y-1">
                  {log.key_insights?.map((ins, i) => (
                    <p key={i} className="text-[11px] text-natural-muted">• {ins}</p>
                  ))}
                  {log.quote && <p className="text-[11px] text-natural-clay italic mt-1">"{log.quote}"</p>}
                </div>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function groupByDate(logs: LogRow[]): Map<string, LogRow[]> {
  const map = new Map<string, LogRow[]>();
  for (const l of logs) {
    const k = String(l.date).slice(0, 10);
    map.set(k, [...(map.get(k) || []), l]);
  }
  return new Map([...map.entries()].sort(([a], [b]) => b.localeCompare(a)));
}
