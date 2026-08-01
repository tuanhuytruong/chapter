import React, { useEffect, useState } from 'react';
import { BookOpen, Quote, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import type { BookRow, LogRow } from '../types';

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

function InlineMarkdown({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="font-bold text-natural-dark">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    return <React.Fragment key={index}>{part}</React.Fragment>;
  })}</>;
}

function FormattedJourneyText({ text, className = '' }: { text: string; className?: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(<ul key={`list-${blocks.length}`} className="ml-4 list-disc space-y-1.5 pl-3">{bullets.map((item, index) => <li key={index}><InlineMarkdown text={item} /></li>)}</ul>);
    bullets = [];
  };
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line) { flushBullets(); continue; }
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) { flushBullets(); blocks.push(<h4 key={`heading-${index}`} className="pt-1 text-xs font-bold text-natural-dark"><InlineMarkdown text={heading[1]} /></h4>); continue; }
    const bullet = line.match(/^[-•]\s+(.+)$/);
    if (bullet) { bullets.push(bullet[1]); continue; }
    flushBullets();
    blocks.push(<p key={`paragraph-${index}`}><InlineMarkdown text={line} /></p>);
  }
  flushBullets();
  return <div className={`space-y-2 ${className}`}><>{blocks}</></div>;
}

function isDeepReadingSummary(text: string | null | undefined): boolean {
  return !!text?.match(/^##\s+(Core argument|Lập luận cốt lõi)\s*$/im);
}

function DeepReadingJourney({ text, expanded }: { text: string; expanded: boolean }) {
  const sections = [...text.matchAll(/^##\s+(.+)\n([\s\S]*?)(?=\n##\s+|$)/gm)].map((m) => ({ title: m[1].trim(), body: m[2].trim() }));
  if (!sections.length) return <p className="text-sm text-natural-dark font-sans leading-relaxed"><InlineMarkdown text={text} /></p>;
  const core = sections[0];
  const rest = sections.slice(1);
  return <div className="font-sans">
    <p className="text-sm text-natural-dark leading-relaxed"><InlineMarkdown text={core.body} /></p>
    {expanded && <div className="mt-3 space-y-3 border-t border-natural-border/40 pt-3">
      {rest.map((section) => <section key={section.title}>
        <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-natural-sage">{section.title}</h4>
        <div className="whitespace-pre-wrap text-xs leading-relaxed text-natural-dark"><InlineMarkdown text={section.body} /></div>
      </section>)}
    </div>}
  </div>;
}

export default function JourneyView({
  logs,
  fileType,
  expanded,
  setExpanded,
}: {
  logs: LogRow[];
  fileType: BookRow['file_type'];
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

  useEffect(() => {
    if (!expanded) return;
    document.getElementById(`journey-session-${expanded}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [expanded]);

  const byDate = groupByDate(logs);
  const entries = [...byDate.entries()];
  const totalPages = logs.reduce((sum, l) => sum + (l.page_end - l.page_start + 1), 0);

  return (
    <div id="reading-lens-journey" className="space-y-0">
      {/* Journey stats ribbon */}
      <div className="flex items-center gap-6 px-4 py-3 mb-6 bg-natural-cream border border-natural-border rounded-2xl text-xs text-natural-stone font-sans">
        <span><b className="text-natural-dark font-bold">{entries.length}</b> reading days</span>
        <span><b className="text-natural-dark font-bold">{logs.length}</b> sessions</span>
        <span><b className="text-natural-dark font-bold">{totalPages}</b> {fileType === 'epub' ? 'chunks' : 'pages'}</span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical spine */}
        <div className="absolute left-[22px] top-2 bottom-2 w-px bg-gradient-to-b from-natural-sage/60 via-natural-border to-transparent" />

        <div className="space-y-8">
          {entries.map(([date, dayLogs], entryIdx) => {
            const isLatest = entryIdx === 0;
            const dayPages = dayLogs.reduce((sum, l) => sum + (l.page_end - l.page_start + 1), 0);
            const casualLogs = dayLogs.filter((log) => !isDeepReadingSummary(log.summary));
            const allQuotes = casualLogs.flatMap(l => l.quote ? [l.quote] : []);
            const allInsights = casualLogs.flatMap(l => l.key_insights || []);
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
                    <span className={`text-sm font-bold font-sans ${isLatest ? 'text-natural-clay' : 'text-natural-dark'}`}>
                      {formatDateShort(date)}
                    </span>
                    {isLatest && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-natural-clay bg-natural-clay/10 px-2 py-0.5 rounded-full">
                        Latest
                      </span>
                    )}
                    <span className="text-[10px] text-natural-stone font-sans">
                      {dayPages} {fileType === 'epub' ? 'chunks' : 'pages'} · {dayLogs.length} {dayLogs.length === 1 ? 'session' : 'sessions'}
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
                    const isDeepReading = isDeepReadingSummary(log.summary);
                    return (
                      <div id={`journey-session-${log.id}`} key={log.id} className={si > 0 ? 'border-t border-natural-border/60' : ''}>
                        <button
                          onClick={() => setExpanded(isOpen ? null : log.id)}
                          className="w-full text-left px-4 py-4 hover:bg-natural-cream/80 transition group"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-natural-stone/50 font-sans mb-1.5 block">
                                {dayLogs.length > 1
                                  ? `Session ${si + 1} · `
                                  : ''}{fileType === 'epub' ? 'chunks' : 'pp.'} {log.page_start}–{log.page_end}
                              </span>
                              {log.summary
                                ? isDeepReading
                                  ? <DeepReadingJourney text={log.summary} expanded={isOpen} />
                                  : <FormattedJourneyText text={log.summary} className="text-sm text-natural-dark font-sans leading-relaxed" />
                                : <p className="text-sm text-natural-stone font-sans">Session summary…</p>}

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
                        {isOpen && !isDeepReading && (
                          <div className="px-4 pb-4 space-y-3 border-t border-natural-border/40 pt-3 bg-natural-cream/40">
                            {log.key_insights && log.key_insights.length > 0 && (
                              <div className="space-y-2">
                                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-natural-stone font-sans">
                                  <Lightbulb className="w-3 h-3 text-natural-clay" /> Key Insights
                                </p>
                                {log.key_insights.map((ins, i) => (
                                  <p key={i} className="text-xs text-natural-dark font-sans leading-relaxed pl-3 border-l-2 border-natural-sage/40">
                                    <InlineMarkdown text={ins} />
                                  </p>
                                ))}
                              </div>
                            )}
                            {log.quote && (
                              <div className="flex gap-2 p-3 rounded-xl bg-natural-clay/5 border border-natural-clay/20">
                                <Quote className="w-3.5 h-3.5 text-natural-clay shrink-0 mt-0.5" />
                                <p className="text-xs italic text-natural-clay font-sans leading-relaxed">
                                  <InlineMarkdown text={log.quote} />
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
                      <p className="text-xs italic text-natural-stone/70 font-sans line-clamp-2">
                        <InlineMarkdown text={allQuotes[0]} />
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
                                <InlineMarkdown text={ins} />
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
