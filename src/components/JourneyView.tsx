import React, { useState } from 'react';
import { BookOpen, Quote, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import type { LogRow } from '../types';

const APP_TZ = 'Asia/Bangkok';

function logDateToAppStr(raw: string): string {
  const s = String(raw);
  return s.includes('T')
    ? new Date(s).toLocaleDateString('en-CA', { timeZone: APP_TZ })
    : s.slice(0, 10);
}

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function groupByDate(logs: LogRow[]): Map<string, LogRow[]> {
  const map = new Map<string, LogRow[]>();
  for (const l of logs) {
    const k = logDateToAppStr(String(l.date));
    map.set(k, [...(map.get(k) || []), l]);
  }
  return new Map([...map.entries()].sort(([a], [b]) => b.localeCompare(a)));
}

export default function JourneyView({
  logs,
  expanded,
  setExpanded,
}: {
  logs: LogRow[];
  expanded: string | null;
  setExpanded: (id: string | null) => void;
}) {
  // Track which day entries have their insights panel open
  const [insightsOpen, setInsightsOpen] = useState<Set<string>>(new Set());

  const toggleInsights = (date: string) => {
    setInsightsOpen(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  const byDate = groupByDate(logs);
  const entries = [...byDate.entries()];
  const totalPages = logs.reduce((sum, l) => sum + (l.page_end - l.page_start + 1), 0);

  return (
    <div className="space-y-0">
      {/* Journey stats ribbon */}
      <div className="flex items-center gap-6 px-4 py-3 mb-6 bg-natural-cream border border-natural-border rounded-2xl text-xs text-natural-stone font-sans">
        <span><b className="text-natural-dark font-bold">{entries.length}</b> reading days</span>
        <span><b className="text-natural-dark font-bold">{logs.length}</b> sessions</span>
        <span><b className="text-natural-dark font-bold">{totalPages}</b> pages</span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical spine */}
        <div className="absolute left-[22px] top-2 bottom-2 w-px bg-gradient-to-b from-natural-sage/60 via-natural-border to-transparent" />

        <div className="space-y-8">
          {entries.map(([date, dayLogs], entryIdx) => {
            const isLatest = entryIdx === 0;
            const dayPages = dayLogs.reduce((sum, l) => sum + (l.page_end - l.page_start + 1), 0);
            const allQuotes = dayLogs.flatMap(l => l.quote ? [l.quote] : []);
            const allInsights = dayLogs.flatMap(l => l.key_insights || []);
            const insightsExpanded = insightsOpen.has(date);

            return (
              <div key={date} className="relative pl-14">
                {/* Timeline node */}
                <div className={`absolute left-[14px] top-1.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shadow-sm
                  ${isLatest
                    ? 'bg-natural-clay border-natural-clay'
                    : 'bg-natural-cream border-natural-sage'
                  }`}
                >
                  <BookOpen className={`w-2.5 h-2.5 ${isLatest ? 'text-white' : 'text-natural-sage'}`} />
                </div>

                {/* Date header */}
                <div className="mb-3">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={`text-sm font-bold font-serif ${isLatest ? 'text-natural-clay' : 'text-natural-dark'}`}>
                      {formatDateShort(date)}
                    </span>
                    {isLatest && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-natural-clay bg-natural-clay/10 px-2 py-0.5 rounded-full">
                        Latest
                      </span>
                    )}
                    <span className="text-[10px] text-natural-stone font-sans">
                      {dayPages} pages · {dayLogs.length} {dayLogs.length === 1 ? 'session' : 'sessions'}
                    </span>
                  </div>
                </div>

                {/* Chapter card */}
                <div className={`rounded-2xl border overflow-hidden shadow-sm
                  ${isLatest ? 'border-natural-clay/30 bg-gradient-to-br from-natural-cream to-natural-cream/60' : 'border-natural-border bg-natural-cream'}`}
                >
                  {/* Sessions */}
                  {dayLogs.map((log, si) => {
                    const isOpen = expanded === log.id;
                    return (
                      <div key={log.id} className={si > 0 ? 'border-t border-natural-border/60' : ''}>
                        <button
                          onClick={() => setExpanded(isOpen ? null : log.id)}
                          className="w-full text-left px-4 py-4 hover:bg-natural-cream/80 transition group"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-natural-stone/50 font-sans mb-1.5 block">
                                {dayLogs.length > 1
                                  ? `Session ${si + 1} · `
                                  : ''}pp. {log.page_start}–{log.page_end}
                              </span>
                              <p className="text-sm text-natural-dark font-sans leading-relaxed">
                                {log.summary || 'Session summary…'}
                              </p>
                            </div>
                            <span className="shrink-0 mt-1 text-natural-stone group-hover:text-natural-dark transition">
                              {isOpen
                                ? <ChevronUp className="w-3.5 h-3.5" />
                                : <ChevronDown className="w-3.5 h-3.5" />
                              }
                            </span>
                          </div>
                        </button>

                        {/* Expanded detail — full insights + quote */}
                        {isOpen && (
                          <div className="px-4 pb-4 space-y-3 border-t border-natural-border/40 pt-3 bg-natural-cream/40">
                            {log.key_insights && log.key_insights.length > 0 && (
                              <div className="space-y-2">
                                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-natural-stone font-sans">
                                  <Lightbulb className="w-3 h-3 text-natural-clay" /> Key Insights
                                </p>
                                {log.key_insights.map((ins, i) => (
                                  <p key={i} className="text-xs text-natural-dark font-sans leading-relaxed pl-3 border-l-2 border-natural-sage/40">
                                    {ins}
                                  </p>
                                ))}
                              </div>
                            )}
                            {log.quote && (
                              <div className="flex gap-2 p-3 rounded-xl bg-natural-clay/5 border border-natural-clay/20">
                                <Quote className="w-3.5 h-3.5 text-natural-clay shrink-0 mt-0.5" />
                                <p className="text-xs italic text-natural-clay font-serif leading-relaxed">
                                  {log.quote}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Quote preview strip — only when sessions are collapsed */}
                  {allQuotes.length > 0 && !dayLogs.some(l => expanded === l.id) && (
                    <div className="px-4 py-2.5 border-t border-natural-border/40 flex items-start gap-2">
                      <Quote className="w-3 h-3 text-natural-clay/50 shrink-0 mt-0.5" />
                      <p className="text-xs italic text-natural-stone/70 font-serif line-clamp-2">
                        {allQuotes[0]}
                      </p>
                    </div>
                  )}

                  {/* Insights panel — collapsible, scrollable, fully readable */}
                  {allInsights.length > 0 && (
                    <div className="border-t border-natural-border/40">
                      {/* Toggle bar */}
                      <button
                        onClick={() => toggleInsights(date)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-natural-cream/60 transition group"
                      >
                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-natural-stone font-sans">
                          <Lightbulb className="w-3 h-3 text-natural-clay" />
                          {allInsights.length} insight{allInsights.length !== 1 ? 's' : ''}
                        </span>
                        {insightsExpanded
                          ? <ChevronUp className="w-3 h-3 text-natural-stone/50" />
                          : <ChevronDown className="w-3 h-3 text-natural-stone/50" />
                        }
                      </button>

                      {/* Insights list — fully readable, no truncation */}
                      {insightsExpanded && (
                        <div className="px-4 pb-4 space-y-2.5">
                          {allInsights.map((ins, i) => (
                            <div key={i} className="flex gap-2.5">
                              <span className="shrink-0 w-4 h-4 rounded-full bg-natural-sage/15 flex items-center justify-center text-[8px] font-bold text-natural-sage mt-0.5">
                                {i + 1}
                              </span>
                              <p className="text-xs text-natural-dark font-sans leading-relaxed flex-1">
                                {ins}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
