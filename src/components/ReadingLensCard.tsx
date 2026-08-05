import { useState, type ReactNode } from "react";
import { ChevronDown, ScanSearch } from "lucide-react";
import type { ReadingLensRow } from "../readingLensRepository";
import { GlossaryLabel, type GlossaryLanguage } from "./ContextualGlossary";

export default function ReadingLensCard({ lens, canEdit, isPreparing = false, onRetry, language = "en" }: { lens?: ReadingLensRow; canEdit: boolean; isPreparing?: boolean; onRetry: () => Promise<void>; language?: GlossaryLanguage }) {
  const [open, setOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  if (!lens) {
    const message = isPreparing
      ? "Reading Lens is preparing quietly in the background."
      : "Reading Lens couldn't be prepared for this session.";
    return <div className="mt-3 rounded-xl border border-dashed border-natural-border px-3 py-2 text-[11px] text-natural-stone">{message}{canEdit && !isPreparing && <button className="ml-2 min-h-11 text-natural-sage underline" disabled={retrying} onClick={async () => { setRetrying(true); try { await onRetry(); } finally { setRetrying(false); } }}>{retrying ? "Trying…" : "Try again"}</button>}</div>;
  }
  const a = lens.analysis;
  return <section className="mt-3 rounded-2xl border border-natural-border bg-natural-cream/50 p-3 sm:p-4">
    <button type="button" onClick={() => setOpen(!open)} className="flex min-h-11 w-full items-center gap-2 text-left">
      <ScanSearch className="h-4 w-4 shrink-0 text-natural-sage" /><span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-natural-sage"><GlossaryLabel term="ReadingLens" language={language} /></span><ChevronDown className={`h-4 w-4 text-natural-stone transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    <p className="mt-1 text-xs leading-relaxed text-natural-dark">{lens.analyst_summary}</p>
    {a.durableInsights.length > 0 && <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-natural-stone">{a.durableInsights.slice(0, 3).map((item, i) => <li key={i}>• {item}</li>)}</ul>}
    {open && <div className="mt-4 space-y-4 border-t border-natural-border pt-3 text-xs leading-relaxed text-natural-dark">
      {a.argumentMap.length > 0 && <LensList title={<GlossaryLabel term="ArgumentMap" language={language} />} items={a.argumentMap.map((x, i) => <div key={i} className="space-y-1"><p><GlossaryLabel term="Claim" language={language} />: {x.claim}</p><p><GlossaryLabel term="Support" language={language} />: {x.support}</p><p><GlossaryLabel term="Implication" language={language} />: {x.implication}</p></div>)} />}
      <LensList title={<GlossaryLabel term="AssumptionsLimits" language={language} />} items={a.assumptionsAndLimits} />
      {a.keyConcepts.length > 0 && <LensList title={<GlossaryLabel term="KeyConcepts" language={language} />} items={a.keyConcepts.map((x, i) => <span key={i}><b>{x.term}:</b> {x.definition}</span>)} />}
      <LensList title={<GlossaryLabel term="QuestionsForward" language={language} />} items={a.questionsToCarryForward} />
      {a.quote && <blockquote className="border-l-2 border-natural-sage/50 pl-3 italic text-natural-stone">“{a.quote}”</blockquote>}
      {a.confidenceNotes.length > 0 && <LensList title={<GlossaryLabel term="ReadingNotes" language={language} />} items={a.confidenceNotes} muted />}
    </div>}
  </section>;
}
function LensList({ title, items, muted }: { title: ReactNode; items: ReactNode[]; muted?: boolean }) { if (!items.length) return null; return <div><h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-natural-sage">{title}</h4><ul className={`space-y-1 ${muted ? "text-natural-stone" : ""}`}>{items.map((item, i) => <li key={i}>• {item}</li>)}</ul></div>; }
