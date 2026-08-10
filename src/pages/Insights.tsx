import React, { useState, useEffect } from 'react';
import { BarChart3, BookOpen, Calendar, Flame, Hash, Headphones, Loader2, TrendingUp, BookMarked, Zap } from 'lucide-react';
import { api, computeStreak, type MonthlyReviewResponse, type CrossBookConnectionsResponse, type PodcastRecapResponse, type RhythmResponse } from '../api';
import MonthlyReviewCard from '../components/MonthlyReviewCard';
import AskMyReadingCard from '../components/AskMyReadingCard';
import CrossBookConnectionsCard from '../components/CrossBookConnectionsCard';
import PodcastRecapCard from '../components/PodcastRecapCard';
import type { AskReadingResponse } from '../api';
import { useNavigate } from 'react-router-dom';
import type { BookRow } from '../types';

const APP_TZ = 'Asia/Bangkok';

function stripInsightOrdinal(text: string) {
  return text.replace(/^\s*\d+[.)]\s+/, "");
}

function InlineMarkdown({ text }: { text: string }) {
  const clean = text.replace(/\*{3,}/g, "**");
  const hasExplicitBold = /\*\*[^*]+\*\*/.test(clean);
  if (!hasExplicitBold) {
    const lead = clean.match(/^(.+?:)(?:\s+|$)/)?.[1]
      ?? clean.match(/^(.+?[.!?])(?:\s+|$)/)?.[1]
      ?? clean;
    return <><strong className="font-bold text-natural-dark">{lead}</strong>{clean.slice(lead.length)}</>;
  }
  const parts = clean.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((part, index) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={index} className="font-bold text-natural-dark">{part.slice(2, -2)}</strong>
    : <React.Fragment key={index}>{part}</React.Fragment>)}</>;
}


function formatLastRead(raw: string | null | undefined): string {
  if (!raw) return '—';
  const s = String(raw);
  // ISO timestamp or plain date — convert to Bangkok TZ
  const d = s.includes('T') ? new Date(s) : new Date(s + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    timeZone: APP_TZ,
  });
}

/** Format YYYY-MM-DD for chart label */
function shortDate(raw: string): string {
  const s = String(raw);
  const d = s.includes('T') ? new Date(s) : new Date(s + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Shift a YYYY-MM-DD date string by whole days (UTC-based, DST-proof). */
function shiftDateStr(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

/** Format seconds as a calm "Xh Ym" / "Ym" / "Xs" listening total. */
function formatListenDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 1) return `${Math.max(1, Math.round(totalSeconds))}s`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0) return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  return `${minutes}m`;
}

/** Twin-track rhythm: read streak, listen streak, active streak + 14-day map. */
function RhythmSection({ rhythm }: { rhythm: RhythmResponse | null }) {
  if (!rhythm) return null;

  const readDays = rhythm.reading_days || [];
  const listenDays = rhythm.listening_days || [];
  const readStreak = computeStreak(readDays);
  const listenStreak = computeStreak(listenDays);
  const activeStreak = computeStreak([...new Set([...readDays, ...listenDays])]);

  const readSet = new Set(readDays);
  const listenSet = new Set(listenDays);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: APP_TZ });
  const dayStates: { date: string; state: 'none' | 'read' | 'listen' | 'both' }[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = shiftDateStr(today, -i);
    const isRead = readSet.has(date);
    const isListen = listenSet.has(date);
    dayStates.push({
      date,
      state: isRead && isListen ? 'both' : isRead ? 'read' : isListen ? 'listen' : 'none',
    });
  }
  const stateClass: Record<string, string> = {
    none: 'bg-natural-border/50',
    read: 'bg-natural-sage',
    listen: 'bg-amber-300',
    both: 'bg-natural-dark',
  };
  const stateLabel: Record<string, string> = {
    none: 'Nothing',
    read: 'Read',
    listen: 'Listened',
    both: 'Read & listened',
  };

  const topBook = [...(rhythm.books || [])].sort((a, b) => b.episodes_listened - a.episodes_listened)[0];
  const hasListen = listenDays.length > 0 || (rhythm.books || []).some((b) => b.episodes_listened > 0);

  return (
    <div className="space-y-3">
      {/* Your Rhythm — three streak chips */}
      <div className="bg-natural-cream border border-natural-border rounded-2xl p-5 shadow-sm">
        <h3 className="flex items-center gap-1.5 font-bold text-sm text-natural-dark mb-4"><Flame className="w-4 h-4 text-natural-clay" /> Your Rhythm</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-natural-border bg-white/70 px-3 py-3 text-center">
            <div className="flex items-center justify-center gap-1 text-natural-clay"><Flame className="w-4 h-4 fill-natural-clay" /></div>
            <p className="mt-1 text-xl font-bold text-natural-dark">{readStreak}<span className="text-xs font-bold text-natural-stone"> ngày</span></p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Read streak</p>
          </div>
          <div className="rounded-2xl border border-natural-border bg-white/70 px-3 py-3 text-center">
            <div className="flex items-center justify-center gap-1 text-amber-600"><Headphones className="w-4 h-4" /></div>
            <p className="mt-1 text-xl font-bold text-natural-dark">{listenStreak}<span className="text-xs font-bold text-natural-stone"> ngày</span></p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Listen streak</p>
          </div>
          <div className="rounded-2xl border border-natural-border bg-white/70 px-3 py-3 text-center">
            <div className="flex items-center justify-center gap-1 text-natural-dark"><Zap className="w-4 h-4" /></div>
            <p className="mt-1 text-xl font-bold text-natural-dark">{activeStreak}<span className="text-xs font-bold text-natural-stone"> ngày</span></p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Active streak</p>
          </div>
        </div>

        {/* 14-day map */}
        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-natural-stone mb-1.5">
            <span>Last 14 days</span>
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-natural-sage" /> Read</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-amber-300" /> Listen</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-natural-dark" /> Both</span>
            </span>
          </div>
          <div className="flex gap-1.5">
            {dayStates.map((day) => (
              <div key={day.date} title={`${day.date} — ${stateLabel[day.state]}`} className={`h-7 flex-1 rounded-[6px] ${stateClass[day.state]}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Nghe này — listening summary */}
      <div className="bg-natural-cream border border-natural-border rounded-2xl p-5 shadow-sm">
        <h3 className="flex items-center gap-1.5 font-bold text-sm text-natural-dark mb-4"><Headphones className="w-4 h-4 text-amber-600" /> Nghe này</h3>
        {!hasListen ? (
          <p className="text-xs text-natural-stone">Chưa nghe podcast nào — thử một chapter bằng tai nhé 🎧</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-natural-border bg-white/70 px-4 py-2.5">
                <p className="text-lg font-bold text-natural-dark">{formatListenDuration(rhythm.total_listen_seconds || 0)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Total listening</p>
              </div>
              <div className="rounded-2xl border border-natural-border bg-white/70 px-4 py-2.5">
                <p className="text-lg font-bold text-natural-dark">{rhythm.listening_episodes_total || 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Episodes heard</p>
              </div>
              {topBook && (
                <div className="rounded-2xl border border-natural-border bg-white/70 px-4 py-2.5 min-w-0">
                  <p className="text-sm font-bold text-natural-dark truncate max-w-[220px]">{topBook.title}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Most listened</p>
                </div>
              )}
            </div>
            {rhythm.books.length > 0 && (
              <div className="space-y-1.5">
                {rhythm.books.map((b) => (
                  <div key={`${b.book_id}:${b.reading_round}`} className="flex items-center justify-between gap-2 py-1">
                    <p className="text-xs text-natural-dark truncate">{b.title}{b.reading_round > 1 ? ` · round ${b.reading_round}` : ''}</p>
                    <p className="shrink-0 text-[11px] font-bold text-natural-stone">{b.episodes_listened}/{b.episodes_total || b.episodes_listened} episodes</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Insights() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Awaited<ReturnType<typeof api.getStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<BookRow[]>([]);
  const [monthlyReview, setMonthlyReview] = useState<MonthlyReviewResponse | null>(null);
  const [askReading, setAskReading] = useState<AskReadingResponse | null>(null);
  const [crossBook, setCrossBook] = useState<CrossBookConnectionsResponse | null>(null);
  const [podcastRecap, setPodcastRecap] = useState<PodcastRecapResponse | null>(null);
  const [rhythm, setRhythm] = useState<RhythmResponse | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [data, allBooks, review, asks, connections, recap, rhythmData] = await Promise.all([api.getStats(), api.listBooks("mine"), api.getMonthlyReview(), api.getAskReading(), api.getCrossBookConnections(), api.getPodcastRecap(), api.getRhythm()]);
        setAskReading(asks);
        setCrossBook(connections);
        setPodcastRecap(recap);
        setMonthlyReview(review);
        setRhythm(rhythmData);
        setStats(data);
        setBooks(allBooks);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="w-8 h-8 text-natural-sage animate-spin" /></div>;
  if (!stats) return <div className="text-center p-16 text-natural-stone font-sans">Could not load stats.</div>;

  const { globalStats, bookCounts, velocity, insights } = stats;

  // Empty state — no books yet
  const totalBooks = bookCounts.active + bookCounts.finished + bookCounts.paused + bookCounts.queued;
  if (totalBooks === 0) {
    return (
      <div className="space-y-6 font-sans">
        <h2 className="flex items-center gap-2 font-bold text-lg text-natural-dark"><BarChart3 className="w-5 h-5" /> Insights</h2>
        <div className="flex flex-col items-center justify-center p-16 bg-natural-cream rounded-[32px] border border-natural-border text-center space-y-3">
          <BarChart3 className="w-10 h-10 text-natural-stone" />
          <p className="font-bold text-natural-dark text-sm">No insights yet</p>
          <p className="text-xs text-natural-stone max-w-xs">
            Add your first book and start reading — your stats, streaks, and key themes will appear here.
          </p>
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-4 py-2 bg-natural-sage text-white rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer">
            <BookOpen className="w-3.5 h-3.5" /> Go to Library
          </button>
        </div>
      </div>
    );
  }

  const maxPages = velocity.length > 0 ? Math.max(...velocity.map(v => Number(v.pages_read))) : 0;

  return (
    <div className="space-y-6 font-sans">
      <h2 className="flex items-center gap-2 font-bold text-lg text-natural-dark"><BarChart3 className="w-5 h-5" /> Insights</h2>

      {monthlyReview && <MonthlyReviewCard data={monthlyReview} onRefresh={async () => setMonthlyReview(await api.getMonthlyReview())} />}
      {askReading && <AskMyReadingCard data={askReading} onRefresh={async () => setAskReading(await api.getAskReading())} />}
      {crossBook && <CrossBookConnectionsCard data={crossBook} onRefresh={async () => setCrossBook(await api.getCrossBookConnections())} />}
      {podcastRecap && <PodcastRecapCard data={podcastRecap} onRefresh={async () => setPodcastRecap(await api.getPodcastRecap())} />}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-natural-cream border border-natural-border rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-natural-sage"><Calendar className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">Days Read</span></div>
          <p className="text-2xl font-bold text-natural-dark mt-1">{globalStats.total_days_read}</p>
        </div>
        <div className="bg-natural-cream border border-natural-border rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-natural-clay"><Flame className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">Last Read</span></div>
          <p className="text-2xl font-bold text-natural-dark mt-1">{formatLastRead(globalStats.last_read)}</p>
        </div>
        <div className="bg-natural-cream border border-natural-border rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-natural-sage"><BookOpen className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">Active</span></div>
          <p className="text-2xl font-bold text-natural-dark mt-1">{bookCounts.active}</p>
        </div>
        <div className="bg-natural-cream border border-natural-border rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-natural-sage"><BookMarked className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">Finished</span></div>
          <p className="text-2xl font-bold text-natural-dark mt-1">{bookCounts.finished}</p>
        </div>
      </div>

      {/* Rhythm (read + listen twin-track) */}
      <RhythmSection rhythm={rhythm} />

      {/* Velocity chart */}
      <div className="bg-natural-cream border border-natural-border rounded-2xl p-5 shadow-sm">
        <h3 className="flex items-center gap-1.5 font-bold text-sm text-natural-dark mb-4">
          <TrendingUp className="w-4 h-4" /> Reading Velocity (last 30 days)
        </h3>
        {velocity.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-28 gap-2">
            <TrendingUp className="w-6 h-6 text-natural-stone/30" />
            <p className="text-xs text-natural-stone">No reading sessions in the last 30 days.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Bar chart */}
            <div className="flex items-end gap-[3px] h-28">
              {velocity.map((v, i) => {
                const pct = maxPages > 0 ? Math.max(6, (Number(v.pages_read) / maxPages) * 100) : 6;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-natural-dark text-natural-cream text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                      {shortDate(v.date)}: {v.pages_read}p
                    </div>
                    <div
                      className="w-full bg-natural-sage/60 hover:bg-natural-sage rounded-t transition-all duration-150"
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                );
              })}
            </div>
            {/* X-axis labels — show first, middle, last */}
            <div className="flex justify-between text-[9px] text-natural-stone/60 font-sans px-0.5">
              <span>{shortDate(velocity[0].date)}</span>
              {velocity.length > 4 && (
                <span>{shortDate(velocity[Math.floor(velocity.length / 2)].date)}</span>
              )}
              <span>{shortDate(velocity[velocity.length - 1].date)}</span>
            </div>
            {/* Summary line */}
            <p className="text-[10px] text-natural-stone font-sans pt-1">
              {velocity.length} active day{velocity.length !== 1 ? 's' : ''} ·{' '}
              <b className="text-natural-dark">{velocity.reduce((s, v) => s + Number(v.pages_read), 0)}</b> pages total
            </p>
          </div>
        )}
      </div>

      {/* Top insights */}
      <div className="bg-natural-cream border border-natural-border rounded-2xl p-5 shadow-sm">
        <h3 className="flex items-center gap-1.5 font-bold text-sm text-natural-dark mb-4"><Hash className="w-4 h-4" /> Top Key Insights</h3>
        {insights.length === 0 ? (
          <p className="text-xs text-natural-stone">No insights recorded yet.</p>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-natural-border/50 last:border-0">
                <span className="shrink-0 w-5 h-5 rounded-full bg-natural-cream border border-natural-border flex items-center justify-center text-[9px] font-bold text-natural-stone mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-natural-dark leading-relaxed flex-1"><InlineMarkdown text={stripInsightOrdinal(ins.insight)} /></p>
                {Number(ins.freq) > 1 && (
                  <span className="shrink-0 text-[9px] font-bold text-natural-sage bg-natural-sage/10 px-1.5 py-0.5 rounded-full mt-0.5">
                    {ins.freq}×
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
