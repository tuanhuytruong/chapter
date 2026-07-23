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
  const [scope, setScope] = useState<"mine" | "all">("mine");
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
      const list = await api.listBooks(scope);
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
  }, [scope]);

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

  const readerGroups = useMemo(() => {
    const groups = new Map<string, { name: string; books: BookRow[] }>();
    for (const book of visible) {
      const key = book.owner_id || 'unassigned';
      const group = groups.get(key) || { name: book.owner_name || 'Unassigned reader', books: [] };
      group.books.push(book);
      groups.set(key, group);
    }
    return [...groups.values()];
  }, [visible]);

  const startQueuedBook = async (book: BookRow) => {
    try {
      await api.updateBook(book.id, { status: 'active' } as any);
      setToast({ type: 'ok', msg: `Started "${book.title}"!` });
      // reload books list
      const list = await api.listBooks(scope);
      setBooks(list);
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-bold text-2xl text-natural-dark font-sans">Your Library</h1>
          <p className="text-xs text-natural-stone font-sans">Track daily reading and AI summaries</p>
        </div>
        <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex">
          {scope === "mine" && <button onClick={readAll} disabled={advancing}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-natural-clay px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:opacity-90 disabled:opacity-50 cursor-pointer">
            {advancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Read All Today
          </button>}
          {scope === "mine" && <button onClick={() => setShowAdd(true)}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-natural-sage px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-natural-sage-dark cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Add Book
          </button>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-natural-border">
        {([['mine', 'My Shelf'], ['all', 'All Readers']] as const).map(([id, label]) => <button key={id} onClick={() => setScope(id)} className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest font-sans border-b-2 -mb-px ${scope === id ? 'border-natural-dark text-natural-dark' : 'border-transparent text-natural-stone'}`}>{label}</button>)}
      </div>
      {scope === 'all' && <p className="text-xs text-natural-stone font-sans">Browsing shared shelves — books are read-only.</p>}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 border-b border-natural-border">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest font-sans border-b-2 -mb-px transition ${
                filter === f.id ? 'border-natural-dark text-natural-dark' : 'border-transparent text-natural-stone hover:text-natural-dark'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
          <div className="flex min-h-11 items-center gap-1.5 rounded-full border border-natural-border bg-natural-cream px-3 py-2 sm:w-auto">
            <Search className="w-3.5 h-3.5 shrink-0 text-natural-stone" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title/author"
              className="min-w-0 flex-1 bg-transparent text-xs font-sans outline-none sm:w-32 sm:flex-none" />
          </div>
          <div className="flex min-h-11 items-center gap-1.5 rounded-full border border-natural-border bg-natural-cream px-3 py-2 sm:w-auto">
            <ArrowUpDown className="w-3.5 h-3.5 shrink-0 text-natural-stone" />
            <select value={sort} onChange={e => setSort(e.target.value as Sort)}
              className="min-w-0 flex-1 cursor-pointer bg-transparent text-xs font-sans outline-none sm:flex-none">
              {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => <div key={i} className="h-36 bg-natural-cream border border-natural-border rounded-[24px] animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-natural-cream rounded-[32px] border border-natural-border text-center space-y-3">
          <BookOpen className="w-10 h-10 text-natural-stone" />
          <p className="text-sm font-bold text-natural-dark font-sans">No books yet</p>
          <p className="text-xs text-natural-stone font-sans">{scope === 'all' ? 'No readers have books matching these filters.' : 'Add your first book to start the daily reading companion.'}</p>
          {scope === 'mine' && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2.5 bg-natural-sage text-white rounded-full text-xs font-bold font-sans uppercase tracking-wider cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Add Book
          </button>}
        </div>
      ) : scope === 'all' ? (
        <div className="space-y-6">
          {readerGroups.map(group => <section key={group.name} className="space-y-3">
            <h2 className="text-sm font-bold text-natural-dark font-sans">{group.name}'s shelf <span className="text-natural-stone font-normal">({group.books.length})</span></h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.books.map(b => <BookCard key={b.id} book={b} streak={streaks[b.id]} readOnly />)}
            </div>
          </section>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(b => <BookCard key={b.id} book={b} streak={streaks[b.id]} />)}
        </div>
      )}

      {/* ── Up Next (queue) ── */}
      {scope === 'mine' && queued.length > 0 && (
        <div className="bg-natural-cream rounded-[32px] border border-natural-border shadow-xs p-6">
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
