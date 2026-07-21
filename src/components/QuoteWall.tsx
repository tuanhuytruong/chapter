import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, QuoteCard } from '../api';
import { Quote, BookOpen, Loader2, Clipboard } from 'lucide-react';
import Toast from './Toast';

export default function QuoteWall() {
  const [quotes, setQuotes] = useState<QuoteCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getAllQuotes();
        setQuotes(data);
      } catch (e: any) {
        setToast({ type: 'err', msg: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const copyQuote = async (q: QuoteCard) => {
    const text = `"${q.quote}" — ${q.title} (${q.author})`;
    try {
      await navigator.clipboard.writeText(text);
      setToast({ type: 'ok', msg: 'Quote copied!' });
    } catch {
      setToast({ type: 'err', msg: 'Failed to copy' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 text-natural-sage animate-spin" />
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="text-center py-12 bg-natural-cream rounded-[32px] border border-natural-border shadow-xs p-8">
        <Quote className="w-10 h-10 text-natural-stone mx-auto mb-3" />
        <p className="text-sm font-bold text-natural-dark font-sans mb-1">No quotes yet</p>
        <p className="text-xs text-natural-stone font-sans">Your quotes will appear here as you read.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-serif italic text-natural-dark mb-4">Quotes Wall</h3>
      <div className="columns-1 sm:columns-2 gap-4 space-y-4">
        {quotes.map((q, i) => (
          <div
            key={`${q.book_id}-${i}`}
            className="break-inside-avoid bg-natural-cream border border-natural-border rounded-[24px] p-5 shadow-sm hover:border-natural-clay/30 transition duration-150 cursor-pointer group"
            onClick={() => navigate(`/books/${q.book_id}`)}
          >
            <div className="flex items-start justify-between gap-2">
              <Quote className="w-5 h-5 text-natural-clay/40 shrink-0 mt-0.5" />
              <button
                onClick={(e) => { e.stopPropagation(); copyQuote(q); }}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition p-1.5 rounded-full hover:bg-natural-cream cursor-pointer"
                title="Copy quote"
              >
                <Clipboard className="w-3.5 h-3.5 text-natural-stone" />
              </button>
            </div>
            <p className="text-base font-serif italic leading-relaxed text-natural-dark my-3">
              &ldquo;{q.quote}&rdquo;
            </p>
            <div className="flex items-center gap-2 text-xs text-natural-stone font-sans">
              <BookOpen className="w-3 h-3" />
              <span className="font-bold">{q.title}</span>
              <span>— {q.author}</span>
            </div>
            <p className="text-[10px] text-natural-stone/60 font-sans mt-1.5">{q.date?.slice(0, 10)}</p>
          </div>
        ))}
      </div>
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
