import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Quote, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, type QuoteBookOption, type QuoteCard, type QuoteQuery } from '../api';
import { QuoteLine } from '../components/QuoteWall';

const PAGE_SIZE = 12;
type Sort = NonNullable<QuoteQuery['sort']>;

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
    <div className="grid gap-2 rounded-2xl border border-natural-border bg-natural-cream p-3 sm:grid-cols-[1fr_auto_auto]"><label className="flex min-h-11 items-center gap-2 rounded-xl bg-white/70 px-3"><Search className="h-3.5 w-3.5 text-natural-stone" /><span className="sr-only">Search saved lines</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lines, books, authors" className="min-w-0 flex-1 bg-transparent font-sans text-xs outline-none" /></label><label className="sr-only" htmlFor="quote-book">Book</label><select id="quote-book" value={bookId} onChange={(event) => setBookId(event.target.value)} className="min-h-11 rounded-xl border border-natural-border bg-white/70 px-3 font-sans text-xs text-natural-dark"><option value="">All books</option>{books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select><label className="sr-only" htmlFor="quote-sort">Sort saved lines</label><select id="quote-sort" value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="min-h-11 rounded-xl border border-natural-border bg-white/70 px-3 font-sans text-xs text-natural-dark"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="mixed">A quiet mix</option></select></div>
    {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-natural-sage" /></div> : items.length ? <div className="space-y-3">{items.map((quote, index) => <QuoteLine key={`${quote.book_id}-${quote.date}-${index}`} quote={quote} />)}</div> : <div className="flex flex-col items-center rounded-[28px] border border-natural-border bg-natural-cream p-14 text-center"><Quote className="h-8 w-8 text-natural-stone" /><p className="mt-3 font-sans text-sm font-bold text-natural-dark">No saved lines match this view</p><p className="mt-1 font-sans text-xs text-natural-stone">Try another book or a shorter search.</p></div>}
    {!loading && items.length < total && <div className="flex justify-center"><button onClick={() => void fetchPage(items.length, true)} disabled={loadingMore} className="flex min-h-11 items-center gap-2 rounded-full border border-natural-border bg-natural-cream px-5 font-sans text-xs font-bold text-natural-dark hover:border-natural-sage disabled:opacity-50">{loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Load more</button></div>}
  </main>;
}
