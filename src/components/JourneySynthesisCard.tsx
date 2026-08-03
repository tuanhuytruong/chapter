import { Loader2, RefreshCw, ScanSearch } from "lucide-react";
import type { JourneySynthesisRow } from "../types";

function ItemList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-natural-dark">{items.map((item, index) => <li key={index} className="flex gap-2"><span className="text-natural-sage">•</span><span>{item}</span></li>)}</ul>;
}

export default function JourneySynthesisCard({
  synthesis,
  sessionCount,
  canEdit,
  loading = false,
  onSynthesize,
}: {
  synthesis: JourneySynthesisRow | null;
  sessionCount: number;
  canEdit: boolean;
  loading?: boolean;
  onSynthesize: () => Promise<void>;
}) {
  const eligible = sessionCount >= 3;
  if (!eligible) return null;
  const actionLabel = synthesis ? (synthesis.stale ? "Refresh synthesis" : "Refresh again") : "Synthesize this journey";
  return <section id="reading-lens-synthesis" className="mb-5 scroll-mt-5 rounded-[24px] border border-natural-sage/30 bg-natural-sage/5 p-4 shadow-sm sm:p-5" aria-live="polite">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-natural-sage"><ScanSearch className="h-3.5 w-3.5" /> Reading Lens · {sessionCount} sessions</p>
        <h2 className="mt-1 text-base font-bold text-natural-dark">Your evolving reading journey</h2>
        {!synthesis && <p className="mt-1 text-xs leading-relaxed text-natural-stone">Bring your saved session analyses into one grounded through-line.</p>}
        {synthesis?.stale && <p className="mt-1 text-xs leading-relaxed text-natural-clay">New session analyses are ready. Refresh to include them.</p>}
        {synthesis && !synthesis.stale && <p className="mt-1 text-xs leading-relaxed text-natural-stone">Current through session {synthesis.sessions_covered}.</p>}
      </div>
      {canEdit && <button type="button" onClick={() => void onSynthesize()} disabled={loading} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-natural-sage px-4 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{loading ? "Synthesizing…" : actionLabel}
      </button>}
    </div>
    {!synthesis && !canEdit && <p className="mt-3 text-xs text-natural-stone">A synthesis will appear here once the book owner creates it.</p>}
    {synthesis && <div className="mt-4 space-y-4 rounded-2xl border border-natural-border bg-natural-cream/70 p-4 text-xs leading-relaxed">
      <div><h3 className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">Through-line</h3><p className="mt-1 text-sm text-natural-dark">{synthesis.through_line}</p></div>
      {synthesis.evolving_concepts.length > 0 && <div><h3 className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">Evolving concepts</h3><div className="mt-2 space-y-2">{synthesis.evolving_concepts.map((concept, index) => <div key={`${concept.term}-${index}`}><b className="text-natural-dark">{concept.term}</b><p className="text-natural-stone">{concept.trajectory}</p></div>)}</div></div>}
      {synthesis.resolved_questions.length > 0 && <div><h3 className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">Questions resolved</h3><div className="mt-2 space-y-2">{synthesis.resolved_questions.map((item, index) => <div key={`${item.question}-${index}`}><b className="text-natural-dark">{item.question}</b><p className="text-natural-stone">{item.resolution}</p></div>)}</div></div>}
      <div className="grid gap-4 sm:grid-cols-2"><div><h3 className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">Open questions</h3><ItemList items={synthesis.open_questions} /></div><div><h3 className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">Reading notes</h3><ItemList items={synthesis.confidence_notes} /></div></div>
      {synthesis.tensions.length > 0 && <div><h3 className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">Tensions to hold</h3><ItemList items={synthesis.tensions.map(item => item.description)} /></div>}
    </div>}
  </section>;
}
