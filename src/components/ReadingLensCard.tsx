import { useState, type ReactNode } from "react";
import { ChevronDown, ScanSearch } from "lucide-react";
import type { ReadingLensRow } from "../readingLensRepository";

export default function ReadingLensCard({ lens, canEdit, isPreparing = false, onRetry }: { lens?: ReadingLensRow; canEdit: boolean; isPreparing?: boolean; onRetry: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  if (!lens) {
    const message = isPreparing
      ? "Reading Lens is preparing quietly in the background."
      : "Reading Lens couldn't be prepared for this session.";
    return <div className="mt-3 rounded-xl border border-dashed border-natural-border px-3 py-2 text-[11px] text-natural-stone">{message}{canEdit && !isPreparing && <button className="ml-2 min-h-11 text-natural-sage underline" disabled={retrying} onClick={async () => { setRetrying(true); await onRetry(); setRetrying(false); }}>{retrying ? "Trying…" : "Try again"}</button>}</div>;
  }
  const a = lens.analysis;
  return <section className="mt-3 rounded-2xl border border-natural-border bg-natural-cream/50 p-3 sm:p-4">
    <button type="button" onClick={() => setOpen(!open)} className="flex min-h-11 w-full items-center gap-2 text-left">
      <ScanSearch className="h-4 w-4 shrink-0 text-natural-sage" /><span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-natural-sage">Reading Lens</span><ChevronDown className={`h-4 w-4 text-natural-stone transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    <p className="mt-1 text-xs leading-relaxed text-natural-dark">{lens.analyst_summary}</p>
    {a.durableInsights.length > 0 && <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-natural-stone">{a.durableInsights.slice(0, 3).map((item, i) => <li key={i}>• {item}</li>)}</ul>}
    {open && <div className="mt-4 space-y-4 border-t border-natural-border pt-3 text-xs leading-relaxed text-natural-dark">
      {a.argumentMap.length > 0 && <LensList title="Argument map" items={a.argumentMap.map(x => <><b>Claim:</b> {x.claim}<br/><b>Support:</b> {x.support}<br/><b>Implication:</b> {x.implication}</>)} />}
      <LensList title="Assumptions & limits" items={a.assumptionsAndLimits} />
      {a.keyConcepts.length > 0 && <LensList title="Key concepts" items={a.keyConcepts.map(x => <><b>{x.term}:</b> {x.definition}</>)} />}
      <LensList title="Questions to carry forward" items={a.questionsToCarryForward} />
      {a.quote && <blockquote className="border-l-2 border-natural-sage/50 pl-3 italic text-natural-stone">“{a.quote}”</blockquote>}
      {a.confidenceNotes.length > 0 && <LensList title="Reading notes" items={a.confidenceNotes} muted />}
    </div>}
  </section>;
}
function LensList({ title, items, muted }: { title: string; items: ReactNode[]; muted?: boolean }) { if (!items.length) return null; return <div><h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-natural-sage">{title}</h4><ul className={`space-y-1 ${muted ? "text-natural-stone" : ""}`}>{items.map((item, i) => <li key={i}>• {item}</li>)}</ul></div>; }
