import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Loader2, BookOpen, Zap, Search, ArrowUpDown } from 'lucide-react';
import { api, computeStreak, progressPct } from '../api';
import type { BookRow, LogRow } from '../types';
import BookCard from '../components/BookCard';
import AddBookModal from '../components/AddBookModal';
import Toast from '../components/Toast';
import QuoteWall from '../components/QuoteWall';

type Filter = 'all' | 'active' | 'paused' | 'finished';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'finished', label: 'Finished' },
  { id: 'paused', label: 'Paused' },
];

type Sort = 'recent' | 'title' | 'progress' | 'streak';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'recent', label: 'Recent' },
  { id: 'title', label: 'Title A-Z' },
  { id: 'progress', label: 'Progress ↑' },
  { id: 'streak', label: 'Streak ↓' },
];

export default function Library() {
  const [books, setBooks] = useState<BookRow[]>([]);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listBooks();
      setBooks(list);
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

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = books.filter(b => (filter === 'all' || b.status === filter) && b.status !== 'queued');
    if (q) list = list.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
    const sorted = [...list];
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'progress') sorted.sort((a, b) => progressPct(a) - progressPct(b));
    else if (sort === 'streak') sorted.sort((a, b) => (streaks[b.id] || 0) - (streaks[a.id] || 0));
    // 'recent' keeps server order (created_at desc assumed)
    return sorted;
  }, [books, filter, search, sort, streaks]);

  const queued = useMemo(() => {
    return books.filter(b => b.status === 'queued').sort((a, b) => (a.queue_order ?? 999) - (b.queue_order ?? 999));
  }, [books]);

  const startQueuedBook = async (book: BookRow) => {
    try {
      await api.updateBook(book.id, { status: 'active' } as any);
      setToast({ type: 'ok', msg: `Started "${book.title}"!` });
      // reload books list
      const list = await api.listBooks();
      setBooks(list);
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message });
    }
  };

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

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-2 border-b border-natural-border">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest font-sans border-b-2 -mb-px transition ${
                filter === f.id ? 'border-natural-dark text-natural-dark' : 'border-transparent text-natural-stone hover:text-natural-dark'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-natural-border rounded-full">
            <Search className="w-3.5 h-3.5 text-natural-stone" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title/author"
              className="text-xs bg-transparent outline-none w-32 font-sans" />
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-natural-border rounded-full">
            <ArrowUpDown className="w-3.5 h-3.5 text-natural-stone" />
            <select value={sort} onChange={e => setSort(e.target.value as Sort)}
              className="text-xs bg-transparent outline-none font-sans cursor-pointer">
              {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => <div key={i} className="h-36 bg-white border border-natural-border rounded-[24px] animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
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
          {visible.map(b => <BookCard key={b.id} book={b} streak={streaks[b.id]} />)}
        </div>
      )}

      {/* ── Up Next (queue) ── */}
      {[...queued].length > 0 && (
        <div className="bg-white rounded-[32px] border border-natural-border shadow-xs p-6">
          <h3 className="text-sm font-bold text-natural-dark font-sans uppercase tracking-wider mb-4">
            Up Next ({queued.length})
          </h3>
          <div className="space-y-3">
            {queued.map(b => (
              <div key={b.id} className="flex items-center justify-between py-3 px-4 border border-natural-border rounded-2xl hover:bg-natural-cream/30 transition">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-natural-dark font-sans truncate">{b.title}</p>
                  <p className="text-xs text-natural-stone font-sans truncate">{b.author}</p>
                </div>
                <button
                  onClick={() => startQueuedBook(b)}
                  className="shrink-0 ml-3 px-4 py-2 bg-natural-sage hover:bg-natural-sage-dark text-white rounded-full text-xs font-bold font-sans uppercase tracking-wider shadow-sm cursor-pointer"
                >
                  Start Reading
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-10 border-t border-natural-border">
        <QuoteWall />
      </div>

      {showAdd && <AddBookModal onClose={() => setShowAdd(false)} onAdded={load} onToast={setToast} />}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
