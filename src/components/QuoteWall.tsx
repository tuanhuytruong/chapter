import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Clipboard, Loader2, Quote, RefreshCw } from 'lucide-react';
import { api, type QuoteCard } from '../api';
import Toast from './Toast';

export function quoteDate(date: string) {
  if (!date) return '';
  const value = String(date);
  return value.includes('T')
    ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Bangkok' })
    : (() => { const [year, month, day] = value.slice(0, 10).split('-').map(Number); return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); })();
}

export const QuoteLine: React.FC<{ quote: QuoteCard; compact?: boolean }> = ({ quote, compact = false }) => {
  const navigate = useNavigate();
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const copyQuote = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try { await navigator.clipboard.writeText(`"${quote.quote}" — ${quote.title} (${quote.author})`); setToast({ type: 'ok', msg: 'Line copied!' }); }
    catch { setToast({ type: 'err', msg: 'Could not copy this line.' }); }
  };

  return <article role="link" tabIndex={0} onClick={() => navigate(`/books/${quote.book_id}`)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/books/${quote.book_id}`); } }} className={`group cursor-pointer rounded-2xl border border-natural-border bg-natural-cream/70 px-4 py-4 text-left transition hover:border-natural-clay/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage ${compact ? '' : 'sm:px-5 sm:py-5'}`}>
    <div className="flex items-start gap-3"><Quote className="mt-0.5 h-4 w-4 shrink-0 text-natural-clay/55" /><div className="min-w-0 flex-1"><p className={`font-serif italic leading-relaxed text-natural-dark ${compact ? 'line-clamp-3 text-[1.02rem]' : 'text-lg'}`}>&ldquo;{quote.quote}&rdquo;</p><div className="mt-3 flex items-center gap-1.5 font-sans text-xs text-natural-stone"><BookOpen className="h-3.5 w-3.5 shrink-0" /><span className="truncate font-bold text-natural-dark">{quote.title}</span><span className="truncate">— {quote.author}</span><span className="ml-auto shrink-0 text-[10px] text-natural-stone/70">{quoteDate(quote.date)}</span></div></div><button onClick={copyQuote} aria-label={`Copy line from ${quote.title}`} title="Copy line" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-natural-stone opacity-100 transition hover:bg-white hover:text-natural-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage sm:opacity-0 sm:group-hover:opacity-100"><Clipboard className="h-3.5 w-3.5" /></button></div>{toast && <Toast toast={toast} onClose={() => setToast(null)} />}</article>;
};

export default function QuoteWall() {
  const [quotes, setQuotes] = useState<QuoteCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try { setQuotes((await api.getQuotes({ limit: 3, sort: refresh ? 'mixed' : 'newest' })).items); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-natural-sage" /></div>;
  if (!quotes.length) return null;

  return <section aria-labelledby="lines-to-return"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-natural-sage">Saved lines</p><h2 id="lines-to-return" className="mt-1 font-serif text-xl italic text-natural-dark">Lines to return to</h2></div><div className="flex items-center gap-3"><button onClick={() => void load(true)} disabled={refreshing} className="flex min-h-10 items-center gap-1.5 font-sans text-xs font-bold text-natural-stone hover:text-natural-dark disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh selection</button><Link to="/quotes" className="flex min-h-10 items-center gap-1 font-sans text-xs font-bold text-natural-dark hover:text-natural-sage">View all quotes <ArrowRight className="h-3.5 w-3.5" /></Link></div></div><div className="space-y-2">{quotes.map((quote, index) => <QuoteLine key={`${quote.book_id}-${quote.date}-${index}`} quote={quote} compact />)}</div></section>;
}
