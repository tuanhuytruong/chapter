import React, { useState, useEffect } from 'react';
import { BarChart3, BookOpen, Calendar, Flame, Hash, Loader2, TrendingUp, BookMarked } from 'lucide-react';
import { api } from '../api';

export default function Insights() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof api.getStats>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getStats();
        setStats(data);
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

  return (
    <div className="space-y-6 font-sans">
      <h2 className="flex items-center gap-2 font-bold text-lg text-natural-dark"><BarChart3 className="w-5 h-5" /> Insights</h2>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-natural-border rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-natural-sage"><Calendar className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">Days Read</span></div>
          <p className="text-2xl font-bold text-natural-dark mt-1">{globalStats.total_days_read}</p>
        </div>
        <div className="bg-white border border-natural-border rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-natural-clay"><Flame className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">Last Read</span></div>
          <p className="text-2xl font-bold text-natural-dark mt-1">{globalStats.last_read ? new Date(globalStats.last_read).toLocaleDateString() : '—'}</p>
        </div>
        <div className="bg-white border border-natural-border rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-natural-sage"><BookOpen className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">Active</span></div>
          <p className="text-2xl font-bold text-natural-dark mt-1">{bookCounts.active}</p>
        </div>
        <div className="bg-white border border-natural-border rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-natural-sage"><BookMarked className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">Finished</span></div>
          <p className="text-2xl font-bold text-natural-dark mt-1">{bookCounts.finished}</p>
        </div>
      </div>

      {/* Velocity chart */}
      <div className="bg-white border border-natural-border rounded-2xl p-4 shadow-sm">
        <h3 className="flex items-center gap-1.5 font-bold text-sm text-natural-dark mb-3"><TrendingUp className="w-4 h-4" /> Reading Velocity (last 30 days)</h3>
        {velocity.length === 0 ? (
          <p className="text-xs text-natural-stone">No data yet.</p>
        ) : (
          <div className="flex items-end gap-[3px] h-24">
            {velocity.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-natural-sage/70 hover:bg-natural-sage rounded-t"
                  style={{ height: `${Math.max(3, (v.pages_read / Math.max(...velocity.map(x => x.pages_read))) * 100)}%` }}
                  title={`${v.date}: ${v.pages_read}p`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top insights */}
      <div className="bg-white border border-natural-border rounded-2xl p-4 shadow-sm">
        <h3 className="flex items-center gap-1.5 font-bold text-sm text-natural-dark mb-3"><Hash className="w-4 h-4" /> Top Key Insights</h3>
        {insights.length === 0 ? (
          <p className="text-xs text-natural-stone">No insights recorded yet.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {insights.map((ins, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-natural-cream last:border-0">
                <span className="text-xs text-natural-dark truncate pr-2">{ins.insight}</span>
                <span className="shrink-0 text-[10px] font-bold text-natural-stone bg-natural-cream px-2 py-0.5 rounded-full">{ins.freq}x</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
