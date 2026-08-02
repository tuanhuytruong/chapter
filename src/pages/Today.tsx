import React, { useCallback, useEffect, useState } from "react";
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
import {
  api,
  progressPct,
  type TodayDashboard,
  type TodayInsights,
} from "../api";
import ChapterDropdown from "../components/ChapterDropdown";
import type { ReviewCardRow } from "../review";

export default function Today() {
  const [dashboard, setDashboard] = useState<TodayDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewCards, setReviewCards] = useState<ReviewCardRow[]>([]);
  const [insights, setInsights] = useState<TodayInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
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
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    let active = true;
    const selected = searchParams.get("insightsBook");
    const allBooks = selected === "all";
    const roundText = searchParams.get("insightsRound");
    const round =
      roundText && /^\d+$/.test(roundText) ? Number(roundText) : undefined;
    setInsightsLoading(true);
    setInsightsError(null);
    void api
      .getTodayInsights({
        bookId: allBooks ? undefined : selected || undefined,
        round,
        allBooks,
      })
      .then((data) => {
        if (active) setInsights(data);
      })
      .catch(() => {
        if (active) setInsightsError("Could not load key insights.");
      })
      .finally(() => {
        if (active) setInsightsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [searchParams]);
  const chooseInsightsBook = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("insightsBook", value);
    next.delete("insightsRound");
    setSearchParams(next, { replace: true });
  };
  const chooseInsightsRound = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("insightsRound", value);
    setSearchParams(next, { replace: true });
  };
  useEffect(() => {
    let active = true;
    void api
      .getDueReviews()
      .then((cards) => {
        if (active) setReviewCards(cards.slice(0, 3));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const startNext = async () => {
    if (!dashboard?.next_queued_book) return;
    setStarting(true);
    setError(null);
    try {
      const book = await api.updateBook(dashboard.next_queued_book.id, {
        status: "active",
      });
      navigate(`/books/${book.id}`);
    } catch (e: any) {
      setError(e.message || "Could not start this book.");
      setStarting(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-natural-sage" />
      </div>
    );
  if (!dashboard)
    return (
      <main className="mx-auto max-w-3xl">
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error || "Could not load your reading plan."}
        </p>
      </main>
    );
  const {
    active_book: active,
    next_queued_book: next,
    today_progress: today,
    weekly_goal: weekly,
  } = dashboard;
  const goalPct = weekly.goal
    ? Math.min(100, Math.round((weekly.completed / weekly.goal.target) * 100))
    : 0;

  return (
    <main className="mx-auto max-w-3xl space-y-5 font-sans">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-natural-sage">
            Your reading rhythm
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-natural-dark">
            <Sparkles className="h-6 w-6 text-natural-clay" /> Today
          </h1>
          <p className="mt-2 text-sm text-natural-stone">
            A calm next step for {dashboard.today} · Asia/Bangkok
          </p>
        </div>
        <Link
          to="/calendar"
          className="flex min-h-11 items-center gap-2 rounded-xl border border-natural-border bg-natural-cream px-4 text-sm font-bold text-natural-dark hover:bg-white"
        >
          <CircleGauge className="h-4 w-4" /> See calendar
        </Link>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <section
        aria-label="Review preview"
        className="rounded-2xl border border-natural-border bg-white p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-natural-sage">
              Review
            </p>
            <h2 className="mt-1 font-bold text-natural-dark">
              Ideas waiting for you
            </h2>
          </div>
          <Link
            to="/review"
            className="flex min-h-10 items-center gap-1 text-sm font-bold text-natural-sage"
          >
            Open review <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {dashboard.due_reviews > 0 && reviewCards.length ? (
          <div className="mt-4">
            <div className="flex items-center">
              <div className="flex -space-x-3" aria-hidden="true">
                {reviewCards.slice(0, 3).map((card) => (
                  <div
                    key={card.id}
                    className="flex h-16 w-12 items-center justify-center overflow-hidden rounded-lg border-2 border-white bg-natural-sage/15 text-natural-sage shadow-sm"
                  >
                    {card.cover_url ? (
                      <img
                        src={card.cover_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <BookOpen className="h-5 w-5" />
                    )}
                  </div>
                ))}
              </div>
              <p className="ml-4 text-sm font-semibold text-natural-dark">
                From {reviewCards[0].title} — keep it close.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-natural-cream p-3">
            <ClipboardCheck className="h-5 w-5 shrink-0 text-natural-clay" />
            <p className="text-sm text-natural-stone">
              {dashboard.due_reviews > 0
                ? `${dashboard.due_reviews} insight${dashboard.due_reviews === 1 ? "" : "s"} ready to review.`
                : "Reviews are clear"}
            </p>
          </div>
        )}
      </section>

      {active ? (
        <section className="rounded-[28px] border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-natural-sage">
            Continue reading
          </p>
          <div className="mt-3 flex gap-4">
            <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-natural-sage/15 text-natural-sage">
              {active.cover_url ? (
                <img
                  src={active.cover_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <BookOpen className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold text-natural-dark">
                {active.title}
              </h2>
              <p className="truncate text-sm text-natural-stone">
                {active.author}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-natural-sage"
                  style={{ width: `${progressPct(active)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-natural-stone">
                {active.current_page} / {active.total_pages}{" "}
                {active.file_type === "epub" ? "chunks" : "pages"}
              </p>
            </div>
          </div>
          <Link
            to={`/books/${active.id}`}
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-natural-sage px-4 text-sm font-bold text-white hover:opacity-90"
          >
            <Play className="h-4 w-4" /> Read next session
          </Link>
        </section>
      ) : next ? (
        <section className="rounded-[28px] border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-natural-sage">
            Your next chapter
          </p>
          <h2 className="mt-2 text-lg font-bold text-natural-dark">
            {next.title}
          </h2>
          <p className="text-sm text-natural-stone">
            {next.author} · first in your queue
          </p>
          <button
            onClick={startNext}
            disabled={starting}
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-natural-sage px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            <Play className="h-4 w-4" />
            {starting ? "Starting…" : "Start this book"}
          </button>
        </section>
      ) : (
        <section className="rounded-[28px] border border-dashed border-natural-border bg-natural-cream p-6 text-center">
          <BookOpen className="mx-auto h-7 w-7 text-natural-sage" />
          <h2 className="mt-3 font-bold text-natural-dark">
            Your shelf is ready for a new story
          </h2>
          <p className="mt-1 text-sm text-natural-stone">
            Add a book, or place one in your queue for later.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-natural-sage px-4 text-sm font-bold text-white"
          >
            <ArrowRight className="h-4 w-4" /> Open Library
          </Link>
        </section>
      )}

      <section
        aria-labelledby="today-insights-heading"
        className="rounded-2xl border border-natural-border bg-white p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-natural-sage">
              Key insights
            </p>
            <h2
              id="today-insights-heading"
              className="mt-1 font-bold text-natural-dark"
            >
              Ideas worth carrying forward
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-natural-sage">
            {insights?.selection.book_id && (
              <Link
                to={`/books/${insights.selection.book_id}`}
                className="inline-flex min-h-10 items-center gap-1"
              >
                Open book <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            )}
            <Link to="/insights" className="inline-flex min-h-10 items-center gap-1">
              More insights <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
        {insights && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ChapterDropdown
              label="Book"
              searchable
              value={
                searchParams.get("insightsBook") ||
                insights.selection.book_id ||
                "all"
              }
              onChange={chooseInsightsBook}
              options={[
                { value: "all", label: "All my books" },
                ...insights.books.map((book) => ({
                  value: book.id,
                  label: `${book.title} · ${book.author}`,
                })),
              ]}
            />
            {insights.selection.book_id && insights.rounds.length > 1 && (
              <label className="text-[11px] font-bold uppercase tracking-wider text-natural-stone">
                Reading round
                <select
                  value={String(insights.selection.reading_round)}
                  onChange={(event) => chooseInsightsRound(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-natural-border bg-natural-cream/50 px-3 text-xs text-natural-dark focus:outline-none focus:ring-2 focus:ring-natural-sage"
                >
                  {insights.rounds.map((round) => (
                    <option
                      key={round.reading_round}
                      value={round.reading_round}
                    >
                      Round {round.reading_round} · {round.status}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
        {insightsLoading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-natural-stone">
            <Loader2 className="h-4 w-4 animate-spin" /> Gathering your ideas…
          </p>
        ) : insightsError ? (
          <p role="alert" className="mt-4 text-sm text-natural-stone">
            {insightsError}
          </p>
        ) : insights?.insights.length ? (
          <ul className="mt-4 space-y-2">
            {insights.insights.map((insight, index) => (
              <li
                key={insight.text}
                className="flex items-start gap-3 rounded-xl bg-natural-cream px-3 py-2 text-sm text-natural-dark"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-natural-border bg-natural-cream text-[9px] font-bold text-natural-stone">
                  {index + 1}
                </span>
                <p className="min-w-0 flex-1 leading-relaxed">
                  {insight.text}
                  {insight.occurrences > 1 && (
                    <span className="ml-2 whitespace-nowrap text-xs text-natural-stone">
                      {insight.occurrences} times
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-natural-stone">
            Your insights will gather here after a reading session.
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/review"
          className="rounded-2xl border border-natural-border bg-natural-cream p-4 hover:bg-white"
        >
          <div className="flex items-center justify-between">
            <ClipboardCheck className="h-5 w-5 text-natural-clay" />
            <ArrowRight className="h-4 w-4 text-natural-stone" />
          </div>
          <p className="mt-3 font-bold text-natural-dark">
            {dashboard.due_reviews
              ? `${dashboard.due_reviews} insight${dashboard.due_reviews === 1 ? "" : "s"} to review`
              : "Reviews are clear"}
          </p>
          <p className="mt-1 text-sm text-natural-stone">
            {dashboard.due_reviews
              ? "Keep your best ideas close."
              : "New insights will appear here."}
          </p>
        </Link>
        <Link
          to="/momentum"
          className="rounded-2xl border border-natural-border bg-natural-cream p-4 hover:bg-white"
        >
          <div className="flex items-center justify-between">
            <CircleGauge className="h-5 w-5 text-natural-sage" />
            <ArrowRight className="h-4 w-4 text-natural-stone" />
          </div>
          <p className="mt-3 font-bold text-natural-dark">
            {weekly.goal
              ? `${weekly.completed} / ${weekly.goal.target} this week`
              : "Set a weekly goal"}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-natural-sage"
              style={{ width: `${goalPct}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-natural-stone">
            {weekly.goal
              ? weekly.status === "met"
                ? "Goal met — lovely work."
                : `${weekly.remaining} remaining · ${weekly.recommended_per_day} / day`
              : "A small target makes momentum visible."}
          </p>
        </Link>
      </section>

      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-natural-border bg-white p-4 text-sm">
        <CheckCircle2 className="h-5 w-5 text-natural-sage" />
        <p className="text-natural-dark">
          <span className="font-bold">Today:</span> {today.sessions} reading
          session{today.sessions === 1 ? "" : "s"} · {today.units} pages /
          chunks
        </p>
      </section>
    </main>
  );
}
