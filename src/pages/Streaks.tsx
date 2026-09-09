import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Award, CalendarDays, CheckCircle2, CircleGauge, Loader2 } from "lucide-react";
import { api, type RhythmResponse } from "../api";
import { QUIET_STREAK_TIERS, type QuietStreakTier } from "../quietStreak";
import QuietStreakStrip from "../components/QuietStreakStrip";

function dayWord(days: number) { return `${days} reading day${days === 1 ? "" : "s"}`; }

import { getQuietStreakTierPresentation } from "../quietStreakPresentation";

function BadgeCard({ tier, earned }: { tier: QuietStreakTier; earned: boolean }) {
  const tone = getQuietStreakTierPresentation(tier.id).card;
  return <article className={`rounded-2xl border p-4 ${earned ? tone.earned : tone.ahead}`}>
    <div className="flex items-start gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${earned ? tone.icon : `border ${tone.ahead} bg-transparent ${tone.label}`}`}><Award className="h-5 w-5" /></div><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="font-bold text-natural-dark">{tier.title}</h2>{earned && <CheckCircle2 aria-label="Earned" className="h-4 w-4 text-natural-sage" />}</div><p className="mt-1 text-xs leading-relaxed text-natural-stone">{tier.description}</p><p className={`mt-3 text-xs font-bold uppercase tracking-wider ${tone.label}`}>{tier.days} days · {earned ? "Earned" : "Ahead"}</p></div></div>
  </article>;
}

export default function Streaks() {
  const [data, setData] = useState<RhythmResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setData(await api.getRhythm()); } catch (cause: any) { setError(cause.message || "Could not load your reading rhythm."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const earned = useMemo(() => new Set(QUIET_STREAK_TIERS.filter((tier) => (data?.quiet_streak.longest_streak || 0) >= tier.days).map((tier) => tier.id)), [data]);
  if (loading) return <div className="flex justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-natural-sage" /></div>;
  if (!data) return <main className="mx-auto max-w-4xl"><div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p>{error || "Could not load your reading rhythm."}</p><button type="button" onClick={() => void load()} className="mt-2 font-bold underline">Try again</button></div></main>;
  const rhythm = data.quiet_streak;
  const next = rhythm.next_tier;
  const progress = next ? Math.min(next.days, rhythm.current_streak) : rhythm.current_streak;
  const remaining = next ? Math.max(0, next.days - progress) : 0;
  const earnedTiers = QUIET_STREAK_TIERS.filter((tier) => earned.has(tier.id));
  const aheadTiers = QUIET_STREAK_TIERS.filter((tier) => !earned.has(tier.id));
  return <main className="mx-auto max-w-5xl space-y-5 font-sans">
    <header><p className="text-xs font-bold uppercase tracking-[0.18em] text-natural-sage">Personal reading practice</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-natural-dark"><CircleGauge className="h-6 w-6" /> Reading rhythm</h1><p className="mt-2 text-sm text-natural-stone">A quiet record of the days you returned to a story.</p></header>
    <section className="rounded-[28px] border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-natural-sage">Current rhythm</p><p className="mt-1 text-3xl font-bold text-natural-dark">{rhythm.current_streak ? `${rhythm.current_streak}-day rhythm` : "Begin your rhythm"}</p><p className="mt-2 text-sm text-natural-stone">{rhythm.active_today ? "Today is part of your rhythm." : "A page or a minute of listening starts today’s rhythm."}</p></div><div className="rounded-2xl bg-natural-bg px-4 py-3"><p className="text-xs font-bold uppercase tracking-wider text-natural-stone">Longest rhythm</p><p className="mt-1 text-lg font-bold text-natural-dark">{dayWord(rhythm.longest_streak)}</p></div></div><QuietStreakStrip readingDays={data.reading_days} listeningDays={data.listening_days} /></section>
    <section className="rounded-[28px] border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-wider text-natural-sage">Next milestone</p>{next ? <><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold text-natural-dark">{next.title}</h2><p className="mt-1 text-sm text-natural-stone">{next.description}</p></div><span className="text-sm font-bold text-natural-sage">{progress} / {next.days} days</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-natural-bg" role="progressbar" aria-label={`${next.title} progress`} aria-valuemin={0} aria-valuemax={next.days} aria-valuenow={progress}><div className="h-full rounded-full bg-natural-sage" style={{ width: `${Math.round((progress / next.days) * 100)}%` }} /></div><p className="mt-3 text-sm text-natural-stone">{remaining ? `${dayWord(remaining)} in this rhythm to reach this milestone.` : "This milestone is ready for your next return."}</p></> : <p className="mt-2 text-sm text-natural-stone">Your rhythm has reached every current milestone.</p>}</section>
    <section><div className="mb-3"><p className="text-xs font-bold uppercase tracking-[0.18em] text-natural-sage">Your badges</p><h2 className="mt-1 text-lg font-bold text-natural-dark">Recognition you have kept</h2><p className="mt-1 text-sm text-natural-stone">Badges stay with your reading history, even as each new rhythm begins.</p></div>{earnedTiers.length ? <div className="grid gap-3 sm:grid-cols-2">{earnedTiers.map((tier) => <BadgeCard key={tier.id} tier={tier} earned />)}</div> : <div className="rounded-2xl border border-natural-border bg-natural-cream p-5 text-sm text-natural-stone"><CalendarDays className="mb-2 h-5 w-5 text-natural-sage" />Your first badge begins with a few quiet returns.</div>}</section>
    {aheadTiers.length > 0 && <section><div className="mb-3"><p className="text-xs font-bold uppercase tracking-[0.18em] text-natural-sage">Milestones ahead</p><h2 className="mt-1 text-lg font-bold text-natural-dark">A practice can grow at its own pace</h2></div><div className="grid gap-3 sm:grid-cols-2">{aheadTiers.map((tier) => <BadgeCard key={tier.id} tier={tier} earned={false} />)}</div></section>}
  </main>;
}
