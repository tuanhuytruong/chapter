import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleGauge,
  ClipboardCheck,
  Loader2,
  Play,
  Sparkles,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, progressPct, type TodayDashboard, type TodayInsights } from "../api";
import type { BookRow } from "../types";

function stripInsightOrdinal(text: string) {
  return text.replace(/^\s*\d+[.)]\s+/, "");
}

function InlineMarkdown({ text }: { text: string }) {
  // Defensive: LLMs sometimes emit "**Label:*** text" (bold close + stray list
  // asterisk). Collapse any run of 3+ asterisks to a plain bold close so no
  // literal "*" leaks into the rendered text.
  const clean = text.replace(/\*{3,}/g, "**");
  const hasExplicitBold = /\*\*[^*]+\*\*/.test(clean);
  if (!hasExplicitBold) {
    const lead = clean.match(/^(.+?:)(?:\s+|$)/)?.[1]
      ?? clean.match(/^(.+?[.!?])(?:\s+|$)/)?.[1]
      ?? clean;
    return <><strong className="font-bold text-natural-dark">{lead}</strong>{clean.slice(lead.length)}</>;
  }
  const parts = clean.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((part, index) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={index} className="font-bold text-natural-dark">{part.slice(2, -2)}</strong>
    : <React.Fragment key={index}>{part}</React.Fragment>)}</>;
}


export default function Today() {
  const [dashboard, setDashboard] = useState<TodayDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<TodayInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDashboard(await api.getTodayDashboard());
    } catch (e: any) {
      setError(e.message || "Could not load your reading plan.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const active = useMemo<BookRow | null>(() => {
    if (!dashboard) return null;
    const requested = searchParams.get("activeBook");
    return dashboard.active_books.find((book) => book.id === requested) || dashboard.active_books[0] || null;
  }, [dashboard, searchParams]);

  useEffect(() => {
    if (!active) {
      setInsights(null);
      setInsightsLoading(false);
      return;
    }
    let mounted = true;
    setInsightsLoading(true);
    setInsightsError(null);
    void api.getTodayInsights({ bookId: active.id })
      .then((data) => { if (mounted) setInsights(data); })
      .catch(() => { if (mounted) setInsightsError("Could not load key insights."); })
      .finally(() => { if (mounted) setInsightsLoading(false); });
    return () => { mounted = false; };
  }, [active?.id]);

  const chooseActiveBook = (bookId: string) => {
    const next = new URLSearchParams(searchParams);
    if (bookId) next.set("activeBook", bookId); else next.delete("activeBook");
    setSearchParams(next, { replace: true });
  };
  const startNext = async () => {
    if (!dashboard?.next_queued_book) return;
    setStarting(true);
    setError(null);
    try {
      const book = await api.updateBook(dashboard.next_queued_book.id, { status: "active" });
      navigate(`/books/${book.id}`);
    } catch (e: any) {
      setError(e.message || "Could not start this book.");
      setStarting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-natural-sage" /></div>;
  if (!dashboard) return <main className="mx-auto max-w-4xl"><p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error || "Could not load your reading plan."}</p></main>;

  const { next_queued_book: next, today_progress: today, weekly_goal: weekly } = dashboard;
  const goalPct = weekly.goal ? Math.min(100, Math.round((weekly.completed / weekly.goal.target) * 100)) : 0;
  const activeBooks = dashboard.active_books;

  return <main className="mx-auto max-w-5xl space-y-5 px-4 font-sans sm:px-0">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-natural-sage">Your reading rhythm</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-natural-dark"><Sparkles className="h-6 w-6 text-natural-clay" /> Today</h1>
        <p className="mt-2 text-sm text-natural-stone">A calm next step for {dashboard.today} · Asia/Bangkok</p>
      </div>
      <Link to="/calendar" className="flex min-h-11 items-center gap-2 rounded-xl border border-natural-border bg-natural-cream px-4 text-sm font-bold text-natural-dark hover:bg-white"><CircleGauge className="h-4 w-4" /> See calendar</Link>
    </header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

    <section aria-label="Review" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-natural-border bg-white px-4 py-3">
      <div className="flex items-center gap-3"><ClipboardCheck className="h-5 w-5 shrink-0 text-natural-clay" /><div><p className="text-xs font-bold uppercase tracking-wider text-natural-sage">Review</p><p className="text-sm font-semibold text-natural-dark">{dashboard.due_reviews > 0 ? `${dashboard.due_reviews} idea${dashboard.due_reviews === 1 ? "" : "s"} ready to revisit` : "Reviews are clear"}</p></div></div>
      <Link to="/review" className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-natural-sage">Open review <ArrowRight className="h-4 w-4" /></Link>
    </section>

    {active ? <section aria-labelledby="current-reads-heading" className="rounded-[28px] border border-natural-border bg-natural-cream p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wider text-natural-sage">Current reads</p><h2 id="current-reads-heading" className="mt-1 text-lg font-bold text-natural-dark">Continue, then keep what matters</h2></div>{activeBooks.length > 1 && <p className="text-xs text-natural-stone">Choose a book to keep this view in context.</p>}</div>
      {activeBooks.length > 1 && <div role="list" aria-label="Active books" className="mb-4 flex flex-wrap gap-2">{activeBooks.map((book) => <button key={book.id} type="button" onClick={() => chooseActiveBook(book.id)} aria-pressed={book.id === active.id} className={`flex min-h-11 max-w-full items-center gap-2 rounded-xl border px-2 py-1 text-left text-xs font-bold focus:outline-none focus:ring-2 focus:ring-natural-sage ${book.id === active.id ? "border-natural-sage bg-white text-natural-dark" : "border-natural-border bg-natural-cream/60 text-natural-stone hover:bg-white"}`}><span className="flex h-8 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-natural-sage/15 text-natural-sage">{book.cover_url ? <img src={book.cover_url} alt="" className="h-full w-full object-cover" /> : <BookOpen className="h-3.5 w-3.5" />}</span><span className="max-w-40 truncate">{book.title}</span><span className="shrink-0 font-normal">{progressPct(book)}%</span></button>)}</div>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <article className="rounded-2xl border border-natural-border bg-white p-4 sm:p-5"><p className="text-xs font-bold uppercase tracking-wider text-natural-sage">Continue reading</p><div className="mt-4 flex gap-4"><div className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-natural-sage/15 text-natural-sage">{active.cover_url ? <img src={active.cover_url} alt="" className="h-full w-full object-cover" /> : <BookOpen className="h-6 w-6" />}</div><div className="min-w-0 flex-1"><h3 className="truncate text-lg font-bold text-natural-dark">{active.title}</h3><p className="truncate text-sm text-natural-stone">{active.author}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-natural-cream"><div className="h-full rounded-full bg-natural-sage" style={{ width: `${progressPct(active)}%` }} /></div><p className="mt-1 text-xs text-natural-stone">{active.current_page} / {active.total_pages} {active.file_type === "epub" ? "chunks" : "pages"}</p></div></div><Link to={`/books/${active.id}`} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-natural-sage px-4 text-sm font-bold text-white hover:opacity-90"><Play className="h-4 w-4" /> Read next session</Link></article>
        <article aria-labelledby="today-insights-heading" className="rounded-2xl border border-natural-border bg-white p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-natural-sage">Key insights so far</p><h3 id="today-insights-heading" className="mt-1 truncate font-bold text-natural-dark">{active.title}</h3><p className="mt-1 text-xs text-natural-stone">From your current read</p></div><div className="flex shrink-0 flex-col items-end text-sm font-bold text-natural-sage"><Link to="/insights" className="inline-flex min-h-8 items-center gap-1">More insights <ArrowRight className="h-4 w-4" /></Link><Link to={`/books/${active.id}`} className="inline-flex min-h-8 items-center gap-1">Open book <ArrowRight className="h-4 w-4" /></Link></div></div>{insightsLoading ? <p className="mt-5 flex items-center gap-2 text-sm text-natural-stone"><Loader2 className="h-4 w-4 animate-spin" /> Gathering your ideas…</p> : insightsError ? <p role="alert" className="mt-5 text-sm text-natural-stone">{insightsError}</p> : insights?.insights.length ? <ul className="mt-4 space-y-2">{insights.insights.slice(0, 3).map((insight, index) => <li key={insight.text} className="flex items-start gap-2 rounded-xl bg-natural-cream px-3 py-2 text-sm text-natural-dark"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-natural-border text-[9px] font-bold text-natural-stone">{index + 1}</span><p className="min-w-0 flex-1 leading-relaxed"><InlineMarkdown text={stripInsightOrdinal(insight.text)} />{insight.occurrences > 1 && <span className="ml-1 whitespace-nowrap text-xs text-natural-stone">{insight.occurrences} times</span>}</p></li>)}</ul> : <p className="mt-5 text-sm text-natural-stone">Your insights will gather here after a reading session.</p>}</article>
      </div>
    </section> : next ? <section className="rounded-[28px] border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-wider text-natural-sage">Your next chapter</p><h2 className="mt-2 text-lg font-bold text-natural-dark">{next.title}</h2><p className="text-sm text-natural-stone">{next.author} · first in your queue</p><button onClick={startNext} disabled={starting} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-natural-sage px-4 text-sm font-bold text-white disabled:opacity-60"><Play className="h-4 w-4" />{starting ? "Starting…" : "Start this book"}</button></section> : <section className="rounded-[28px] border border-dashed border-natural-border bg-natural-cream p-6 text-center"><BookOpen className="mx-auto h-7 w-7 text-natural-sage" /><h2 className="mt-3 font-bold text-natural-dark">Your shelf is ready for a new story</h2><p className="mt-1 text-sm text-natural-stone">Add a book, or place one in your queue for later.</p><Link to="/" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-natural-sage px-4 text-sm font-bold text-white"><ArrowRight className="h-4 w-4" /> Open Library</Link></section>}

    <section className="grid gap-3 sm:grid-cols-2"><Link to="/momentum" className="rounded-2xl border border-natural-border bg-natural-cream p-4 hover:bg-white"><div className="flex items-center justify-between"><CircleGauge className="h-5 w-5 text-natural-sage" /><ArrowRight className="h-4 w-4 text-natural-stone" /></div><p className="mt-3 font-bold text-natural-dark">{weekly.goal ? `${weekly.completed} / ${weekly.goal.target} this week` : "Set a weekly goal"}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-natural-sage" style={{ width: `${goalPct}%` }} /></div><p className="mt-2 text-sm text-natural-stone">{weekly.goal ? weekly.status === "met" ? "Goal met — lovely work." : `${weekly.remaining} remaining · ${weekly.recommended_per_day} / day` : "A small target makes momentum visible."}</p></Link></section>
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-natural-border bg-white p-4 text-sm"><CheckCircle2 className="h-5 w-5 text-natural-sage" /><p className="text-natural-dark"><span className="font-bold">Today:</span> {today.sessions} reading session{today.sessions === 1 ? "" : "s"} · {today.units} pages / chunks</p></section>
  </main>;
}
