import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, BookOpen, Search, ChevronDown, ChevronUp, ListOrdered, Play, ArrowRight, ArrowLeft } from 'lucide-react';
import { api, computeStreak, progressPct } from '../api';
import type { BookRow } from '../types';
import BookCard from '../components/BookCard';
import AddBookModal from '../components/AddBookModal';
import Toast from '../components/Toast';
import QuoteWall from '../components/QuoteWall';
import SortMenu from '../components/SortMenu';
import { GuideCard, useOnboarding } from '../onboarding';

type Filter = 'all' | 'active' | 'queued' | 'paused' | 'finished';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'queued', label: 'Queue' },
  { id: 'finished', label: 'Finished' },
  { id: 'paused', label: 'Paused' },
  { id: 'all', label: 'All' },
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
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('active');
  const [sort, setSort] = useState<Sort>('recent');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const { dismiss } = useOnboarding();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, datesByBook] = await Promise.all([api.listBooks(scope), api.getBookStreakDates(scope)]);
      setBooks(list);
      setStreaks(Object.fromEntries(list.map((book) => [book.id, computeStreak(datesByBook[book.id] || [])])));
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message });
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { void load(); }, [load]);

  const statusCounts = useMemo(() => books.reduce<Record<Filter, number>>((counts, book) => {
    counts[book.status as Filter] = (counts[book.status as Filter] || 0) + 1;
    if (book.status !== 'queued') counts.all += 1;
    return counts;
  }, { all: 0, active: 0, queued: 0, paused: 0, finished: 0 }), [books]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = books.filter((book) => filter === 'all' ? book.status !== 'queued' : book.status === filter);
    if (q) list = list.filter((book) => book.title.toLowerCase().includes(q) || book.author.toLowerCase().includes(q));
    const sorted = [...list];
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'progress') sorted.sort((a, b) => progressPct(a) - progressPct(b));
    else if (sort === 'streak') sorted.sort((a, b) => (streaks[b.id] || 0) - (streaks[a.id] || 0));
    return sorted;
  }, [books, filter, search, sort, streaks]);

  const queued = useMemo(() => books.filter((book) => book.status === 'queued')
    .sort((a, b) => (a.queue_order ?? 999) - (b.queue_order ?? 999)), [books]);

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

  const changeScope = (nextScope: 'mine' | 'all') => {
    setScope(nextScope);
    setFilter('active');
    setSearch('');
  };

  const startQueuedBook = async (book: BookRow) => {
    try {
      await api.updateBook(book.id, { status: 'active' } as any);
      setToast({ type: 'ok', msg: `Started "${book.title}"!` });
      await load();
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message });
    }
  };

  const moveQueuedBook = async (index: number, direction: -1 | 1) => {
    const next = [...queued];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      const updated = await api.reorderQueue(next.map((book) => book.id));
      setBooks((current) => [...current.filter((book) => book.status !== 'queued'), ...updated]);
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message });
    }
  };

  const emptyCopy = scope === 'all'
    ? 'No readers have books matching these filters.'
    : filter === 'active' ? 'No active books yet. Start with a book when you are ready.'
      : filter === 'queued' ? 'Your queue is clear. Add a book to keep a gentle next read in view.'
        : filter === 'finished' ? 'No finished books yet.'
          : filter === 'paused' ? 'No paused books right now.'
            : 'Add your first book to start the daily reading companion.';
  const showQueue = scope === 'mine' && filter === 'queued';

  return (
    <div className="space-y-6">
      {scope === 'mine' && !loading && books.length === 0 && <GuideCard step="welcome" title="Begin with one book, one small session"><p>Chapter keeps the reading surface quiet: add a book, read at your pace, and let the companion notes arrive after your progress is safely saved.</p><button onClick={() => { void dismiss('welcome'); setShowAdd(true); }} className="min-h-11 rounded-full bg-natural-sage px-4 text-xs font-bold text-white hover:bg-natural-sage-dark">Add your first book</button></GuideCard>}

      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-sans text-2xl font-bold text-natural-dark">{scope === 'mine' ? 'My Shelf' : 'All Readers'}</h1>
          <p className="font-sans text-xs text-natural-stone">{scope === 'mine' ? 'Your reading, at your pace' : 'Browse shared shelves — books are read-only.'}</p>
        </div>
        {scope === 'mine' && <button onClick={() => setShowAdd(true)} className="flex min-h-11 items-center justify-center gap-1.5 self-start rounded-full bg-natural-sage px-4 py-2.5 font-sans text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-natural-sage-dark sm:self-auto"><Plus className="h-3.5 w-3.5" /> Add Book</button>}
      </div>

      <div className="border-b border-natural-border">
        <div className="-mb-px flex w-full flex-wrap items-center gap-x-0" role="group" aria-label="Shelf filters">
          {FILTERS.filter((item) => scope === 'mine' || item.id !== 'queued').map((item) => {
            const count = statusCounts[item.id];
            return <button key={item.id} type="button" onClick={() => setFilter(item.id)} aria-pressed={filter === item.id}
              className={`min-h-11 border-b-2 px-2.5 py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.11em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage focus-visible:ring-inset sm:px-3 sm:text-xs sm:tracking-widest ${filter === item.id ? 'border-natural-dark text-natural-dark' : 'border-transparent text-natural-stone hover:text-natural-dark'}`}>
              {item.label}{count > 0 && <span className="ml-1 tabular-nums text-[10px] text-natural-stone sm:ml-1.5">{count}</span>}
            </button>;
          })}
          <button type="button" onClick={() => changeScope(scope === 'mine' ? 'all' : 'mine')} className="flex min-h-11 basis-full items-center gap-1.5 border-b-2 border-transparent px-2.5 py-3 font-sans text-[11px] font-bold text-natural-stone transition hover:text-natural-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage focus-visible:ring-inset sm:ml-auto sm:basis-auto sm:px-3 sm:text-xs">
            {scope === 'mine' ? <>Explore readers <ArrowRight className="h-3.5 w-3.5" /></> : <><ArrowLeft className="h-3.5 w-3.5" /> Back to my shelf</>}
          </button>
        </div>
      </div>

      {!showQueue && <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
        <div className="flex min-h-11 items-center gap-1.5 rounded-full border border-natural-border bg-natural-cream px-3 py-2 sm:w-auto">
          <Search className="h-3.5 w-3.5 shrink-0 text-natural-stone" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title/author" className="min-w-0 flex-1 bg-transparent font-sans text-xs outline-none sm:w-32 sm:flex-none" />
        </div>
        <SortMenu value={sort} onChange={setSort} />
      </div>}

      {loading ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((index) => <div key={index} className="h-36 animate-pulse rounded-[24px] border border-natural-border bg-natural-cream" />)}</div>
        : showQueue && queued.length > 0 ? <section className="rounded-[28px] border border-natural-border bg-natural-cream p-4 shadow-xs sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-natural-sage">Personal queue</p><h2 className="mt-1 flex items-center gap-2 font-sans text-lg font-bold text-natural-dark"><ListOrdered className="h-5 w-5" /> Up next</h2></div><span className="rounded-full bg-white px-3 py-1 font-sans text-xs font-bold text-natural-stone">{queued.length} book{queued.length === 1 ? '' : 's'}</span></div>
          <div className="space-y-2">{queued.map((book, index) => <article key={book.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-natural-border bg-white/65 p-3 sm:flex-nowrap"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-natural-sage/15 text-sm font-bold text-natural-sage">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate font-sans text-sm font-bold text-natural-dark">{book.title}</p><p className="truncate font-sans text-xs text-natural-stone">{book.author}</p></div><div className="flex shrink-0 gap-1"><button aria-label={`Move ${book.title} earlier`} onClick={() => moveQueuedBook(index, -1)} disabled={index === 0} className="flex h-11 w-11 items-center justify-center rounded-xl border border-natural-border disabled:opacity-35"><ChevronUp className="h-4 w-4" /></button><button aria-label={`Move ${book.title} later`} onClick={() => moveQueuedBook(index, 1)} disabled={index === queued.length - 1} className="flex h-11 w-11 items-center justify-center rounded-xl border border-natural-border disabled:opacity-35"><ChevronDown className="h-4 w-4" /></button><button onClick={() => startQueuedBook(book)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-natural-sage px-3 font-sans text-xs font-bold text-white hover:bg-natural-sage-dark"><Play className="h-3.5 w-3.5" /> Start</button></div></article>)}</div>
        </section>
          : visible.length === 0 ? <div className="flex flex-col items-center justify-center space-y-3 rounded-[32px] border border-natural-border bg-natural-cream p-16 text-center"><BookOpen className="h-10 w-10 text-natural-stone" /><p className="font-sans text-sm font-bold text-natural-dark">{showQueue ? 'Your queue is clear' : 'No books here yet'}</p><p className="font-sans text-xs text-natural-stone">{emptyCopy}</p>{scope === 'mine' && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-full bg-natural-sage px-4 py-2.5 font-sans text-xs font-bold uppercase tracking-wider text-white"><Plus className="h-3.5 w-3.5" /> Add Book</button>}</div>
            : scope === 'all' ? <div className="space-y-6">{readerGroups.map((group) => <section key={group.name} className="space-y-3"><h2 className="font-sans text-sm font-bold text-natural-dark">{group.name}'s shelf <span className="font-normal text-natural-stone">({group.books.length})</span></h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{group.books.map((book) => <BookCard key={book.id} book={book} streak={streaks[book.id]} readOnly />)}</div></section>)}</div>
              : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((book) => <BookCard key={book.id} book={book} streak={streaks[book.id]} />)}</div>}

      {scope === 'mine' && <div className="border-t border-natural-border pt-8"><QuoteWall /></div>}
      {showAdd && <AddBookModal onClose={() => setShowAdd(false)} onAdded={load} onToast={setToast} />}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
