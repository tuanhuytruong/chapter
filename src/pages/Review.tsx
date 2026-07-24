import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../api";
import type { ReviewCardRow } from "../review";
import ReviewHeader from "../components/review/ReviewHeader";
import RecallCard from "../components/review/RecallCard";
import ReviewEmptyState from "../components/review/ReviewEmptyState";

export default function Review() {
  const [cards, setCards] = useState<ReviewCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  const revealRef = useRef<HTMLButtonElement>(null);
  const responseRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const due = await api.getDueReviews();
      setCards(due);
      setTotalDue(due.length);
      setDone(0);
      setRevealed(false);
    } catch (e: any) {
      setError(e.message || "Could not load your reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const reveal = useCallback(() => {
    setRevealed(true);
    requestAnimationFrame(() => responseRef.current?.focus());
  }, []);

  const submit = useCallback(async (remembered: boolean) => {
    const card = cards[0];
    if (!card || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.submitReview(card.id, remembered);
      setCards((current) => current.slice(1));
      setDone((value) => value + 1);
      setRevealed(false);
      requestAnimationFrame(() => revealRef.current?.focus());
    } catch (e: any) {
      setError(e.message || "Could not save this review. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [cards, saving]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (saving || event.repeat || !cards[0]) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.closest("button, a, input, textarea, select, [contenteditable='true']"))) return;
      if (!revealed && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        reveal();
      } else if (revealed && event.key === "1") {
        event.preventDefault();
        void submit(false);
      } else if (revealed && event.key === "2") {
        event.preventDefault();
        void submit(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [cards, revealed, reveal, saving, submit]);

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="h-7 w-7 animate-spin text-natural-sage" /></div>;

  const card = cards[0];
  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 font-sans sm:px-0">
      <ReviewHeader completed={done} total={totalDue} hasActiveCard={!!card} />
      {card ? <>
        <RecallCard card={card} revealed={revealed} saving={saving} onReveal={reveal} onSubmit={(remembered) => void submit(remembered)} revealRef={revealRef} responseRef={responseRef} />
        {error && <p role="alert" className="text-center text-xs text-red-700">{error}</p>}
      </> : <>
        <ReviewEmptyState done={done} />
        {error && <p role="alert" className="text-center text-xs text-red-700">{error}</p>}
      </>}
    </main>
  );
}
