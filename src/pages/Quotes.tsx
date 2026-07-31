import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpDown, BookOpen, Check, ChevronDown, Loader2, Quote, Search, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, type QuoteBookOption, type QuoteCard, type QuoteQuery } from '../api';
import { QuoteLine } from '../components/QuoteWall';

const PAGE_SIZE = 12;
type Sort = NonNullable<QuoteQuery['sort']>;
type FilterOption = { value: string; label: string };

function QuoteFilterMenu({ label, icon: Icon, value, options, onChange }: { label: string; icon: LucideIcon; value: string; options: FilterOption[]; onChange(value: string): void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, []);

  return <div ref={rootRef} className="relative min-w-0">
    <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((current) => !current)} className="grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-natural-border bg-white/70 px-3 py-2 text-left font-sans text-xs text-natural-dark shadow-sm transition hover:border-natural-sage/45 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/45">
      <Icon className="h-3.5 w-3.5 shrink-0 text-natural-sage" />
      <span className="min-w-0 truncate">{selected.label}</span>
      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-natural-stone transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div role="menu" aria-label={label} className="absolute right-0 z-30 mt-2 w-full min-w-56 overflow-hidden rounded-2xl border border-natural-border bg-natural-bg p-1.5 shadow-[0_12px_30px_rgba(61,48,40,0.14)]">
      {options.map((option) => {
        const active = option.value === value;
        return <button key={option.value || 'all'} type="button" role="menuitemradio" aria-checked={active} onClick={() => { onChange(option.value); setOpen(false); }} className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/45 ${active ? 'bg-natural-sage/15 font-bold text-natural-dark' : 'text-natural-stone hover:bg-natural-cream hover:text-natural-dark'}`}>
          <span className="min-w-0 text-pretty">{option.label}</span>{active && <Check className="h-4 w-4 shrink-0 text-natural-sage" />}
        </button>;
      })}
    </div>}
  </div>;
}

export default function Quotes() {
  const [items, setItems] = useState<QuoteCard[]>([]);
  const [books, setBooks] = useState<QuoteBookOption[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [bookId, setBookId] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sequence = useRef(0);

  const fetchPage = async (offset: number, append: boolean) => {
    const request = ++sequence.current;
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const page = await api.getQuotes({ limit: PAGE_SIZE, offset, q: query, bookId, sort });
      if (request !== sequence.current) return;
      setItems((current) => append ? [...current, ...page.items] : page.items);
      setTotal(page.total);
      setBooks(page.books);
    } finally {
      if (request === sequence.current) { setLoading(false); setLoadingMore(false); }
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchPage(0, false); }, 180);
    return () => window.clearTimeout(timer);
  }, [query, bookId, sort]);

  return <main className="mx-auto max-w-3xl space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><Link to="/" className="flex min-h-10 items-center gap-1.5 font-sans text-xs font-bold text-natural-stone hover:text-natural-dark"><ArrowLeft className="h-3.5 w-3.5" /> Back to my shelf</Link><p className="mt-4 font-sans text-xs font-bold uppercase tracking-[0.16em] text-natural-sage">Your reading archive</p><h1 className="mt-1 font-serif text-3xl italic text-natural-dark">All saved lines</h1><p className="mt-1 font-sans text-xs text-natural-stone">{total ? `${total} line${total === 1 ? '' : 's'} worth keeping` : 'A quiet place for what stayed with you'}</p></div></div>
    <div className="grid gap-2 rounded-2xl border border-natural-border bg-natural-cream p-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,13rem)_minmax(9.5rem,10.5rem)]"><label className="flex min-h-11 items-center gap-2 rounded-xl bg-white/70 px-3"><Search className="h-3.5 w-3.5 text-natural-stone" /><span className="sr-only">Search saved lines</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lines, books, authors" className="min-w-0 flex-1 bg-transparent font-sans text-xs outline-none" /></label><QuoteFilterMenu label="Filter saved lines by book" icon={BookOpen} value={bookId} options={[{ value: '', label: 'All books' }, ...books.map((book) => ({ value: book.id, label: book.title }))]} onChange={setBookId} /><QuoteFilterMenu label="Sort saved lines" icon={ArrowUpDown} value={sort} options={[{ value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }, { value: 'mixed', label: 'A quiet mix' }]} onChange={(value) => setSort(value as Sort)} /></div>
    {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-natural-sage" /></div> : items.length ? <div className="space-y-3">{items.map((quote, index) => <QuoteLine key={`${quote.book_id}-${quote.date}-${index}`} quote={quote} />)}</div> : <div className="flex flex-col items-center rounded-[28px] border border-natural-border bg-natural-cream p-14 text-center"><Quote className="h-8 w-8 text-natural-stone" /><p className="mt-3 font-sans text-sm font-bold text-natural-dark">No saved lines match this view</p><p className="mt-1 font-sans text-xs text-natural-stone">Try another book or a shorter search.</p></div>}
    {!loading && items.length < total && <div className="flex justify-center"><button onClick={() => void fetchPage(items.length, true)} disabled={loadingMore} className="flex min-h-11 items-center gap-2 rounded-full border border-natural-border bg-natural-cream px-5 font-sans text-xs font-bold text-natural-dark hover:border-natural-sage disabled:opacity-50">{loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Load more</button></div>}
  </main>;
}
