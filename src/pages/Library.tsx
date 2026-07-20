import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Flame, Loader2, BookOpen, Zap } from 'lucide-react';
import { api, computeStreak } from '../api';
import type { BookRow, LogRow } from '../types';
import BookCard from '../components/BookCard';
import AddBookModal from '../components/AddBookModal';
import Toast from '../components/Toast';

type Filter = 'all' | 'active' | 'paused' | 'finished';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'finished', label: 'Finished' },
  { id: 'paused', label: 'Paused' },
];

export default function Library() {
  const [books, setBooks] = useState<BookRow[]>([]);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listBooks();
      setBooks(list);
      // fetch each book's log to compute streak
      const s: Record<string, number> = {};
      await Promise.all(list.map(async (b) => {
        try {
          const log = await api.getLog(b.id);
          s[b.id] = computeStreak(log.map((l: LogRow) => l.date));
        } catch { s[b.id] = 0; }
      }));
      setStreaks(s);
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const readAll = async () => {
    setAdvancing(true);
    try {
      const r = await api.advanceAll();
      setToast({ type: 'ok', msg: `Read All: ${r.advanced} advanced, ${r.skipped} skipped` });
      await load();
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message });
    } finally {
      setAdvancing(false);
    }
  };

  const filtered = books.filter(b => filter === 'all' || b.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-bold text-2xl text-natural-dark font-sans">Your Library</h1>
          <p className="text-xs text-natural-stone font-sans">Track daily reading and AI summaries</p>
        </div>
        <div className="flex gap-2">
          <button onClick={readAll} disabled={advancing}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-natural-clay hover:opacity-90 disabled:opacity-50 text-white rounded-full text-xs font-bold font-sans uppercase tracking-wider shadow-sm cursor-pointer">
            {advancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Read All Today
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-natural-sage hover:bg-natural-sage-dark text-white rounded-full text-xs font-bold font-sans uppercase tracking-wider shadow-sm cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Add Book
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-natural-border">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest font-sans border-b-2 -mb-px transition ${
              filter === f.id ? 'border-natural-dark text-natural-dark' : 'border-transparent text-natural-stone hover:text-natural-dark'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => <div key={i} className="h-36 bg-white border border-natural-border rounded-[24px] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-[32px] border border-natural-border text-center space-y-3">
          <BookOpen className="w-10 h-10 text-natural-stone" />
          <p className="text-sm font-bold text-natural-dark font-sans">No books yet</p>
          <p className="text-xs text-natural-stone font-sans">Add your first book to start the daily reading companion.</p>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2.5 bg-natural-sage text-white rounded-full text-xs font-bold font-sans uppercase tracking-wider cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Add Book
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(b => <BookCard key={b.id} book={b} streak={streaks[b.id]} />)}
        </div>
      )}

      {showAdd && <AddBookModal onClose={() => setShowAdd(false)} onAdded={load} onToast={setToast} />}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
