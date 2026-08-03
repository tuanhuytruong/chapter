import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleGauge, Loader2, Save, Target, TrendingUp } from "lucide-react";
import { api } from "../api";
import type { WeeklyGoalMetric, WeeklyGoalProgress } from "../weekly-goal";
import ChapterDropdown from "../components/ChapterDropdown";

const labels: Record<WeeklyGoalMetric, string> = { sessions: "reading sessions", units: "pages / chunks" };

export default function Momentum() {
  const [progress, setProgress] = useState<WeeklyGoalProgress | null>(null);
  const [metric, setMetric] = useState<WeeklyGoalMetric>("sessions");
  const [target, setTarget] = useState("5");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const next = await api.getWeeklyGoal(); setProgress(next); if (next.goal) { setMetric(next.goal.metric); setTarget(String(next.goal.target)); } }
    catch (e: any) { setError(e.message || "Could not load weekly momentum."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); const numeric = Number(target);
    if (!Number.isInteger(numeric) || numeric < 1) { setError("Enter a whole-number target of at least 1."); return; }
    setSaving(true); setError(null);
    try { await api.saveWeeklyGoal(metric, numeric); await load(); }
    catch (e: any) { setError(e.message || "Could not save weekly goal."); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-natural-sage" /></div>;
  const goal = progress?.goal;
  const ratio = goal ? Math.min(100, Math.round((progress!.completed / goal.target) * 100)) : 0;
  const tone = progress?.status === "met" ? "text-emerald-700" : progress?.status === "behind" ? "text-natural-clay" : "text-natural-sage";

  return <main className="mx-auto max-w-3xl space-y-5 font-sans">
    <header><p className="text-xs font-bold uppercase tracking-[0.18em] text-natural-sage">Personal target</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-natural-dark"><CircleGauge className="h-6 w-6" /> Weekly Momentum</h1><p className="mt-2 text-sm text-natural-stone">Monday {progress?.week_start} — Sunday {progress?.week_end} · Asia/Bangkok</p></header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section className="rounded-[28px] border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6">
      {goal ? <><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-natural-stone">This week</p><p className="mt-1 text-3xl font-bold text-natural-dark">{progress!.completed} <span className="text-lg font-medium text-natural-stone">/ {goal.target}</span></p><p className="mt-1 text-sm text-natural-stone">{labels[goal.metric]}</p></div><div className={`rounded-full bg-white px-3 py-2 text-sm font-bold ${tone}`}>{progress!.status === "met" ? "Goal met" : progress!.status === "on_track" ? "On track" : "Behind pace"}</div></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-natural-sage transition-all duration-300" style={{ width: `${ratio}%` }} /></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"><div><p className="text-natural-stone">Remaining</p><p className="font-bold text-natural-dark">{progress!.remaining}</p></div><div><p className="text-natural-stone">Days left</p><p className="font-bold text-natural-dark">{progress!.days_left}</p></div><div className="col-span-2 sm:col-span-1"><p className="text-natural-stone">Suggested pace</p><p className="font-bold text-natural-dark">{progress!.remaining === 0 ? "You did it" : `${progress!.recommended_per_day} / day`}</p></div></div>{progress!.status === "behind" && progress!.remaining > 0 && <p className="mt-5 flex items-start gap-2 rounded-xl bg-natural-clay/10 p-3 text-sm text-natural-dark"><TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-natural-clay" />A small session today helps you catch up without cramming at week end.</p>}</> : <div className="flex items-start gap-3"><Target className="mt-0.5 h-6 w-6 text-natural-sage" /><div><h2 className="font-bold text-natural-dark">Set a gentle weekly target</h2><p className="mt-1 text-sm leading-relaxed text-natural-stone">Choose sessions for consistency, or pages/chunks for reading volume. Progress comes straight from your reading history.</p></div></div>}</section>
    <form onSubmit={save} className="rounded-[28px] border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6"><h2 className="font-bold text-natural-dark">{goal ? "Adjust weekly goal" : "Your weekly goal"}</h2><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_auto]"><ChapterDropdown
        label="Measure"
        value={metric}
        onChange={setMetric}
        options={[{ value: "sessions", label: "Reading sessions" }, { value: "units", label: "Pages / chunks" }]}
      /><label className="text-sm font-medium text-natural-dark">Target<input value={target} onChange={(event) => setTarget(event.target.value)} inputMode="numeric" type="number" min="1" max="10000" className="mt-1 min-h-11 w-full rounded-xl border border-natural-border bg-white px-3 text-sm" /></label><button disabled={saving} className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-natural-sage px-4 text-sm font-bold text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving ? "Saving…" : goal ? "Save changes" : "Set goal"}</button></div></form>
    {progress?.status === "met" && <p className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-5 w-5" />Your weekly goal is complete.</p>}
  </main>;
}
