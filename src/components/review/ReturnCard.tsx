import { Check, RotateCcw } from "lucide-react";
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import type { ReturnCard as ReturnCardData } from "../../api";
import type { ReturnOutcome } from "../../review";

function sourceLabel(card: ReturnCardData): string | null {
  const parts: string[] = [];
  if (card.source_date) {
    const raw = String(card.source_date);
    const date = raw.includes("T") ? new Date(raw) : new Date(`${raw}T12:00:00`);
    if (!Number.isNaN(date.getTime())) {
      parts.push(date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Bangkok" }));
    }
  }
  if (card.source_page_start != null && card.source_page_end != null) {
    parts.push(`pp. ${card.source_page_start}–${card.source_page_end}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

function InsightText({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  })}</>;
}

const actionClass = "flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2";

export default function ReturnCard({ card, saving, onRespond, onSourceOpen }: {
  card: ReturnCardData;
  saving: boolean;
  onRespond: (outcome: ReturnOutcome, reflection?: string) => void;
  onSourceOpen?: () => void;
}) {
  const [changing, setChanging] = useState(false);
  const [reflection, setReflection] = useState("");
  const source = sourceLabel(card);

  return <section aria-label={`Return from ${card.title}`} className="rounded-[24px] border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-7">
    <div className="border-b border-natural-border pb-4">
      <p className="truncate text-sm font-bold text-natural-dark">{card.title}</p>
      <p className="mt-0.5 truncate text-xs text-natural-stone">{card.author}</p>
      <p className="mt-2 text-[11px] text-natural-stone">{source ? `Source session · ${source}` : "Source session from your reading"}</p>
    </div>

    <div className="py-7 sm:py-9">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-natural-sage">A source insight</p>
      <p className="mt-3 text-base leading-relaxed text-natural-dark sm:text-lg"><InsightText text={card.insight} /></p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-natural-border pt-4 text-xs text-natural-stone">
        <span>{source ? `From ${source}` : "From your reading"}</span>
        <Link to={`/books/${card.book_id}`} onClick={onSourceOpen} className="min-h-11 inline-flex items-center font-semibold text-natural-sage hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage">Open source book →</Link>
      </div>

      <h2 className="mt-7 text-base font-bold text-natural-dark">Does this still feel true for you?</h2>
      {!changing ? <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <button type="button" disabled={saving} onClick={() => onRespond("still_true")} className={`${actionClass} bg-natural-sage text-white hover:opacity-90 focus-visible:ring-natural-sage focus-visible:ring-offset-2`}><Check className="h-4 w-4" />Still true</button>
        <button type="button" disabled={saving} onClick={() => setChanging(true)} className={`${actionClass} border border-natural-border text-natural-dark hover:bg-white focus-visible:ring-natural-sage`}>Changed</button>
        <button type="button" disabled={saving} onClick={() => onRespond("revisit")} className={`${actionClass} border border-natural-clay/40 bg-natural-clay/10 text-natural-dark hover:bg-natural-clay/15 focus-visible:ring-natural-clay`}><RotateCcw className="h-4 w-4" />Revisit</button>
      </div> : <div className="mt-4 rounded-2xl border border-natural-border bg-white/50 p-4">
        <label htmlFor={`return-reflection-${card.id}`} className="block text-xs font-bold text-natural-dark">What changed? <span className="font-normal text-natural-stone">Optional, up to 500 characters.</span></label>
        <textarea id={`return-reflection-${card.id}`} value={reflection} maxLength={500} onChange={(event) => setReflection(event.target.value)} disabled={saving} rows={3} className="mt-2 w-full rounded-xl border border-natural-border bg-natural-cream px-3 py-2 text-sm text-natural-dark focus:outline-none focus:ring-2 focus:ring-natural-sage disabled:opacity-60" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-natural-stone" aria-live="polite">{reflection.length}/500</span>
          <div className="flex gap-2">
            <button type="button" disabled={saving} onClick={() => setChanging(false)} className={`${actionClass} border border-natural-border text-natural-dark hover:bg-natural-cream focus-visible:ring-natural-sage`}>Cancel</button>
            <button type="button" disabled={saving} onClick={() => onRespond("changed", reflection)} className={`${actionClass} bg-natural-sage text-white hover:opacity-90 focus-visible:ring-natural-sage focus-visible:ring-offset-2`}>Save thought</button>
          </div>
        </div>
      </div>}
    </div>
  </section>;
}
