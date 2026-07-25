import React, { useCallback, useEffect, useState } from "react";
import { Award, BookOpen, Library, Brain, CalendarDays, CheckCircle2, ChevronRight, Flame, Heart, Loader2, Repeat2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { AchievementIcon, AchievementProgress, AchievementsResponse } from "../achievements";
import Toast from "../components/Toast";

const SEEN_KEY = "chapter:achievement-toast-seen:v1";
const icons: Record<AchievementIcon, React.ComponentType<{ className?: string }>> = {
  book: BookOpen, books: Library, flame: Flame, calendar: CalendarDays, sparkles: Sparkles, brain: Brain, heart: Heart, repeat: Repeat2,
};

function readSeen(): string[] {
  try { const stored = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : []; }
  catch { return []; }
}

export default function Achievements() {
  const [data, setData] = useState<AchievementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await api.getAchievements();
      setData(result);
      const seen = new Set(readSeen());
      const fresh = result.achievements.find((achievement) => achievement.earned && !seen.has(achievement.id));
      localStorage.setItem(SEEN_KEY, JSON.stringify(result.achievements.filter((achievement) => achievement.earned).map((achievement) => achievement.id)));
      if (fresh) setToast({ type: "ok", msg: `Milestone unlocked: ${fresh.title}` });
    } catch (e: any) { setError(e.message || "Could not load your milestones."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-natural-sage" /></div>;
  const next = data?.summary.next;

  return <main className="mx-auto max-w-5xl space-y-5 font-sans">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-natural-sage">Personal reading journey</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-natural-dark"><Award className="h-6 w-6" /> Your milestones</h1><p className="mt-2 text-sm text-natural-stone">Small proof that your reading practice is taking root.</p></div>
      {data && <div className="rounded-full border border-natural-border bg-natural-cream px-3 py-2 text-xs font-bold text-natural-dark">{data.summary.earned_count} of {data.summary.total_count} unlocked</div>}
    </header>
    {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p>{error}</p><button onClick={load} className="mt-2 font-bold underline">Try again</button></div>}
    {next && <section className="rounded-[28px] border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-wider text-natural-sage">Your next milestone</p><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-natural-dark">{next.title}</h2><p className="mt-1 text-sm text-natural-stone">{next.description}</p></div><span className="rounded-full bg-natural-sage/15 px-3 py-1.5 text-sm font-bold text-natural-sage">{next.current} / {next.target}</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-label={`${next.title} progress`} aria-valuemin={0} aria-valuemax={next.target} aria-valuenow={next.current}><div className="h-full rounded-full bg-natural-sage" style={{ width: `${Math.min(100, Math.round((next.current / next.target) * 100))}%` }} /></div></section>}
    {!error && data?.summary.earned_count === 0 && <section className="rounded-[28px] border border-natural-border bg-natural-cream p-5 text-center shadow-sm"><Sparkles className="mx-auto h-7 w-7 text-natural-clay" /><h2 className="mt-3 font-bold text-natural-dark">Your first milestone is waiting.</h2><p className="mt-1 text-sm text-natural-stone">A small reading session is enough to start the journey.</p><Link to="/today" className="mt-4 inline-flex min-h-11 items-center gap-1 rounded-full bg-natural-sage px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">Read today <ChevronRight className="h-3.5 w-3.5" /></Link></section>}
    <section className="grid gap-3 sm:grid-cols-2">
      {data?.achievements.map((achievement) => <div key={achievement.id}><AchievementCard achievement={achievement} /></div>)}
    </section>
    {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
  </main>;
}

function AchievementCard({ achievement }: { achievement: AchievementProgress }) {
  const Icon = icons[achievement.icon];
  const percent = Math.min(100, Math.round((achievement.current / achievement.target) * 100));
  return <article className={`rounded-[24px] border p-4 shadow-sm sm:p-5 ${achievement.earned ? "border-natural-sage/30 bg-natural-sage/10" : "border-natural-border bg-natural-cream"}`}>
    <div className="flex items-start gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${achievement.earned ? "bg-natural-sage text-white" : "bg-natural-bg text-natural-stone"}`}><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h2 className="font-bold text-natural-dark">{achievement.title}</h2>{achievement.earned && <CheckCircle2 className="h-4 w-4 shrink-0 text-natural-sage" aria-label="Unlocked" />}</div><p className="mt-1 text-xs leading-relaxed text-natural-stone">{achievement.description}</p></div></div>
    <div className="mt-4 flex items-center justify-between gap-3 text-xs"><span className="font-bold text-natural-dark">{achievement.earned ? "Unlocked" : `${achievement.current} / ${achievement.target}`}</span><span className="text-natural-stone">{achievement.unit_label}</span></div>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white" role="progressbar" aria-label={`${achievement.title} progress`} aria-valuemin={0} aria-valuemax={achievement.target} aria-valuenow={achievement.current}><div className={`h-full rounded-full ${achievement.earned ? "bg-natural-sage" : "bg-natural-clay"}`} style={{ width: `${percent}%` }} /></div>
  </article>;
}
