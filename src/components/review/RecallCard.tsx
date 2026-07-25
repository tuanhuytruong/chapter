import { Check, Eye, RotateCcw } from 'lucide-react';
import { Fragment, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import type { ReviewCardRow } from '../../review';

function sourceLabel(card: ReviewCardRow): string | null {
  const parts: string[] = [];
  if (card.source_date) {
    const raw = String(card.source_date);
    const date = raw.includes('T') ? new Date(raw) : new Date(`${raw}T12:00:00`);
    if (!Number.isNaN(date.getTime())) parts.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' }));
  }
  if (card.source_page_start != null && card.source_page_end != null) parts.push(`pp. ${card.source_page_start}–${card.source_page_end}`);
  return parts.length ? parts.join(' · ') : null;
}

/** Render the limited emphasis syntax produced in review-card insights. */
function InsightText({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  })}</>;
}

export default function RecallCard({ card, revealed, saving, onReveal, onSubmit, revealRef, responseRef }: {
  card: ReviewCardRow;
  revealed: boolean;
  saving: boolean;
  onReveal: () => void;
  onSubmit: (remembered: boolean) => void;
  revealRef: RefObject<HTMLButtonElement | null>;
  responseRef: RefObject<HTMLButtonElement | null>;
}) {
  const source = sourceLabel(card);
  return (
    <section className="rounded-[24px] border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-7">
      <div className="border-b border-natural-border pb-4">
        <p className="truncate text-sm font-bold text-natural-dark">{card.title}</p>
        <p className="mt-0.5 truncate text-xs text-natural-stone">{card.author}</p>
        {source && <p className="mt-2 text-[11px] text-natural-stone">From {source}</p>}
      </div>
      {!revealed ? (
        <div className="py-9 text-center sm:py-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-natural-sage">Take a moment</p>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-natural-stone">What idea from this reading still stays with you?</p>
          <button ref={revealRef} onClick={onReveal} className="mx-auto mt-7 flex min-h-11 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-natural-sage px-5 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage focus-visible:ring-offset-2"><Eye className="h-4 w-4" /> Reveal insight</button>
        </div>
      ) : (
        <div className="py-7 sm:py-9">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-natural-sage">The insight</p>
          <p className="mt-3 text-base leading-relaxed text-natural-dark sm:text-lg"><InsightText text={card.insight} /></p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-natural-border pt-4 text-xs text-natural-stone">
            <span>{source ? `From your ${source} session` : 'From your reading'}</span>
            <Link to={`/books/${card.book_id}`} className="font-semibold text-natural-sage hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage">Open book →</Link>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button ref={responseRef} disabled={saving} onClick={() => onSubmit(false)} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-natural-clay/40 bg-natural-clay/10 px-4 text-xs font-bold text-natural-dark hover:bg-natural-clay/15 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-clay"><RotateCcw className="h-4 w-4" /> Need another pass</button>
            <button disabled={saving} onClick={() => onSubmit(true)} className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-natural-sage px-4 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage focus-visible:ring-offset-2"><Check className="h-4 w-4" /> This stays with me</button>
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-natural-stone">Need another pass returns tomorrow. This stays with me moves it forward.</p>
        </div>
      )}
    </section>
  );
}
