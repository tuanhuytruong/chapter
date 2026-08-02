import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { ReviewCardRow } from "../review";
import ReviewHeader from "../components/review/ReviewHeader";
import RecallCard from "../components/review/RecallCard";
import ReviewEmptyState from "../components/review/ReviewEmptyState";
import { GuideCard } from "../onboarding";
import { notifyReviewsChanged } from "../reviewEvents";

type DueBook = { id: string; title: string; author: string; cover_url: string | null; due_count: number };
type ReviewMode = "focused" | "flow";
const MODE_KEY = "chapter.review.mode";

export default function Review() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedBookId = searchParams.get("bookId") || undefined;
  const [books, setBooks] = useState<DueBook[]>([]);
  const [cards, setCards] = useState<ReviewCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  const [mode, setMode] = useState<ReviewMode>(() => localStorage.getItem(MODE_KEY) === "flow" ? "flow" : "focused");
  const revealRef = useRef<HTMLButtonElement>(null);
  const responseRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [due, dueBooks] = await Promise.all([api.getDueReviews(selectedBookId), api.getDueReviewBooks()]);
      setCards(due);
      setBooks(dueBooks);
      setTotalDue(due.length);
      setDone(0);
      setRevealed(mode === "flow");
    } catch (e: any) {
      setError(e.message || "Could not load your reviews.");
    } finally {
      setLoading(false);
    }
  }, [mode, selectedBookId]);

  useEffect(() => { void load(); }, [load]);

  const chooseBook = (bookId: string) => {
    const next = new URLSearchParams(searchParams);
    if (bookId) next.set("bookId", bookId); else next.delete("bookId");
    setSearchParams(next);
  };
  const chooseMode = (next: ReviewMode) => {
    localStorage.setItem(MODE_KEY, next);
    setMode(next);
    if (next === "flow") setRevealed(true);
  };
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
      setRevealed(mode === "flow");
      notifyReviewsChanged();
      requestAnimationFrame(() => (mode === "flow" ? responseRef : revealRef).current?.focus());
    } catch (e: any) {
      setError(e.message || "Could not save this review. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [cards, mode, saving]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (saving || event.repeat || !cards[0]) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a, input, textarea, select, [contenteditable='true']")) return;
      if (!revealed && (event.key === " " || event.key === "Enter")) { event.preventDefault(); reveal(); }
      else if (revealed && event.key === "1") { event.preventDefault(); void submit(false); }
      else if (revealed && event.key === "2") { event.preventDefault(); void submit(true); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [cards, revealed, reveal, saving, submit]);

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="h-7 w-7 animate-spin text-natural-sage" /></div>;
  const card = cards[0];
  const selectedBook = books.find((book) => book.id === selectedBookId);
  return <main className="mx-auto max-w-2xl space-y-5 px-4 font-sans sm:px-0">
    <ReviewHeader completed={done} total={totalDue} hasActiveCard={!!card} mode={mode} onModeChange={chooseMode} />
    <label className="block text-[11px] font-bold uppercase tracking-wider text-natural-stone">Book
      <select value={selectedBookId || ""} onChange={(event) => chooseBook(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-natural-border bg-natural-cream/50 px-3 text-sm text-natural-dark focus:outline-none focus:ring-2 focus:ring-natural-sage">
        <option value="">All due reviews · {books.reduce((sum, book) => sum + Number(book.due_count), 0)}</option>
        {books.map((book) => <option key={book.id} value={book.id}>{book.title} · {book.author} · {book.due_count}</option>)}
      </select>
    </label>
    <GuideCard step="review" eyebrow="Review" title={mode === "flow" ? "A quicker return to your ideas" : "A gentle return to ideas worth keeping"}><p>{mode === "flow" ? "Insights stay visible as you move through the queue. Use 1 for another pass or 2 when it stays with you." : "Reveal the first idea, then simply choose whether it came back to you — there is no score to chase."}</p></GuideCard>
    {card ? <><div className="relative isolate">{cards[2] && <div aria-hidden="true" className="absolute inset-x-4 -top-3 h-6 rounded-t-[20px] border border-natural-border bg-natural-cream/60" />}{cards[1] && <div aria-hidden="true" className="absolute inset-x-2 -top-1.5 h-4 rounded-t-[22px] border border-natural-border bg-natural-cream/80" />}<RecallCard card={card} revealed={revealed} saving={saving} onReveal={reveal} onSubmit={(remembered) => void submit(remembered)} revealRef={revealRef} responseRef={responseRef} /></div>{error && <p role="alert" className="text-center text-xs text-red-700">{error}</p>}</> : <><ReviewEmptyState done={done} bookTitle={selectedBook?.title} onViewAll={() => chooseBook("")} />{error && <p role="alert" className="text-center text-xs text-red-700">{error}</p>}</>}
  </main>;
}
