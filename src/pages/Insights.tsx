import React, { useState, useEffect } from 'react';
import { BarChart3, BookOpen, Calendar, Flame, Hash, Loader2, TrendingUp, BookMarked, Sparkles } from 'lucide-react';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';
import type { BookRow, LogRow } from '../types';

const APP_TZ = 'Asia/Bangkok';

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

export default function Insights() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Awaited<ReturnType<typeof api.getStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"personal" | "community">("personal");
  const [books, setBooks] = useState<BookRow[]>([]);
  const [logsByBook, setLogsByBook] = useState<Record<string, LogRow[]>>({});

  useEffect(() => {
    (async () => {
      try {
        const [data, allBooks] = await Promise.all([scope === "personal" ? api.getStats() : api.getCommunityStats(), api.listBooks(scope === "personal" ? "mine" : "all")]);
        setStats(data);
        setBooks(allBooks);
        // Fetch logs for all books in parallel
        const logEntries = await Promise.all(
          allBooks.map(b => api.getLog(b.id).then(logs => [b.id, logs] as const))
        );
        setLogsByBook(Object.fromEntries(logEntries));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [scope]);

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="w-8 h-8 text-natural-sage animate-spin" /></div>;
  if (!stats) return <div className="text-center p-16 text-natural-stone font-sans">Could not load stats.</div>;

  const { globalStats, bookCounts, velocity, insights } = stats;

  // Empty state — no books yet
  const totalBooks = bookCounts.active + bookCounts.finished + bookCounts.paused + bookCounts.queued;
  if (totalBooks === 0) {
    return (
      <div className="space-y-6 font-sans">
        <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-bold text-lg text-natural-dark"><BarChart3 className="w-5 h-5" /> Insights</h2><div className="flex gap-1"><button onClick={() => setScope("personal")} className={`px-3 py-1.5 text-xs rounded-full ${scope === "personal" ? "bg-natural-sage text-white" : "text-natural-stone"}`}>My Insights</button><button onClick={() => setScope("community")} className={`px-3 py-1.5 text-xs rounded-full ${scope === "community" ? "bg-natural-sage text-white" : "text-natural-stone"}`}>Community</button></div></div>
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
      <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-bold text-lg text-natural-dark"><BarChart3 className="w-5 h-5" /> Insights</h2><div className="flex gap-1"><button onClick={() => setScope("personal")} className={`px-3 py-1.5 text-xs rounded-full ${scope === "personal" ? "bg-natural-sage text-white" : "text-natural-stone"}`}>My Insights</button><button onClick={() => setScope("community")} className={`px-3 py-1.5 text-xs rounded-full ${scope === "community" ? "bg-natural-sage text-white" : "text-natural-stone"}`}>Community</button></div></div>

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
                <p className="text-sm text-natural-dark leading-relaxed flex-1">{ins.insight}</p>
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
