import React, { useCallback, useEffect, useState } from "react";
import { BookOpenCheck, Brain, Check, Eye, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { api } from "../api";
import type { ReviewCardRow } from "../review";

export default function Review() {
  const [cards, setCards] = useState<ReviewCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCards(await api.getDueReviews());
    } catch (e: any) {
      setError(e.message || "Could not load your reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async (remembered: boolean) => {
    const card = cards[0];
    if (!card || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.submitReview(card.id, remembered);
      setCards((current) => current.slice(1));
      setDone((value) => value + 1);
      setRevealed(false);
    } catch (e: any) {
      setError(e.message || "Could not save this review. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-natural-sage" /></div>;

  const card = cards[0];
  if (!card) {
    return (
      <main className="mx-auto max-w-xl space-y-5 font-sans">
        <header><p className="text-xs font-bold uppercase tracking-[0.18em] text-natural-sage">Spaced repetition</p><h1 className="mt-1 text-2xl font-bold text-natural-dark">Review</h1></header>
        <section className="rounded-[28px] border border-natural-border bg-natural-cream p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-natural-sage/10 text-natural-sage"><Sparkles className="h-7 w-7" /></div>
          <h2 className="mt-5 text-lg font-bold text-natural-dark">Nothing due right now</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-natural-stone">Your new reading insights will return here at the right time. Keep reading, then let a little spacing do the remembering.</p>
          {done > 0 && <p className="mt-5 text-xs font-semibold text-natural-sage">{done} card{done === 1 ? "" : "s"} reviewed today.</p>}
          {error && <p role="alert" className="mt-4 text-xs text-red-700">{error}</p>}
          <button onClick={() => void load()} className="mt-6 min-h-11 rounded-full border border-natural-border px-5 text-xs font-bold uppercase tracking-wider text-natural-dark hover:bg-white">Refresh</button>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl space-y-5 font-sans">
      <header className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-natural-sage">Spaced repetition</p><h1 className="mt-1 text-2xl font-bold text-natural-dark">Review</h1></div><p className="rounded-full bg-natural-sage/10 px-3 py-1 text-xs font-bold text-natural-sage">{cards.length} due</p></header>
      <section className="rounded-[28px] border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3 border-b border-natural-border pb-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-natural-sage/10 text-natural-sage"><BookOpenCheck className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-sm font-bold text-natural-dark">{card.title}</p><p className="truncate text-xs text-natural-stone">{card.author}</p></div></div>
        <div className="py-8 text-center sm:py-12"><p className="text-xs font-bold uppercase tracking-[0.16em] text-natural-stone">Key insight</p>{revealed ? <p className="mx-auto mt-5 max-w-md text-xl leading-relaxed text-natural-dark sm:text-2xl">{card.insight}</p> : <><div className="mx-auto mt-5 flex h-24 max-w-md items-center justify-center rounded-2xl border border-dashed border-natural-border bg-white/50 text-natural-stone"><Brain className="h-8 w-8" /></div><p className="mt-4 text-sm text-natural-stone">Can you recall the idea before revealing it?</p></>}</div>
        {error && <p role="alert" className="mb-3 text-center text-xs text-red-700">{error}</p>}
        {!revealed ? <button onClick={() => setRevealed(true)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-natural-sage px-5 text-sm font-bold text-white hover:opacity-90"><Eye className="h-4 w-4" /> Reveal insight</button> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><button disabled={saving} onClick={() => void submit(false)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-natural-clay/40 bg-natural-clay/10 px-5 text-sm font-bold text-natural-dark disabled:opacity-60"><RotateCcw className="h-4 w-4" /> I forgot</button><button disabled={saving} onClick={() => void submit(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-natural-sage px-5 text-sm font-bold text-white disabled:opacity-60"><Check className="h-4 w-4" /> I remembered</button></div>}
        <p className="mt-4 text-center text-[11px] text-natural-stone">Remembered moves forward; forgot returns tomorrow.</p>
      </section>
    </main>
  );
}
