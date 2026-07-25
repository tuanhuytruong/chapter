import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { api } from "./api";

export type OnboardingStep = "welcome" | "add_book" | "first_session" | "review" | "journey" | "story_thread";

type OnboardingValue = {
  dismissed: Set<OnboardingStep>;
  ready: boolean;
  dismiss(step: OnboardingStep): Promise<void>;
  reset(): Promise<void>;
};

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [dismissed, setDismissed] = useState<Set<OnboardingStep>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    api.getOnboarding()
      .then(({ dismissed_steps }) => { if (active) setDismissed(new Set(dismissed_steps as OnboardingStep[])); })
      .catch(() => { if (active) setDismissed(new Set()); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const persist = useCallback(async (next: Set<OnboardingStep>) => {
    setDismissed(next);
    try {
      const saved = await api.saveOnboarding([...next]);
      setDismissed(new Set(saved.dismissed_steps as OnboardingStep[]));
    } catch {
      // Keep the local choice for this visit; a later guide action will retry persistence.
    }
  }, []);

  const dismiss = useCallback(async (step: OnboardingStep) => {
    const next = new Set(dismissed);
    next.add(step);
    await persist(next);
  }, [dismissed, persist]);

  const reset = useCallback(async () => { await persist(new Set()); }, [persist]);
  const value = useMemo(() => ({ dismissed, ready, dismiss, reset }), [dismiss, dismissed, ready, reset]);
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error("useOnboarding must be used within OnboardingProvider");
  return value;
}

export function GuideCard({ step, eyebrow = "Chapter guide", title, children, action }: {
  step: OnboardingStep;
  eyebrow?: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const { dismissed, ready, dismiss } = useOnboarding();
  if (!ready || dismissed.has(step)) return null;
  return <section className="rounded-[28px] border border-natural-sage/25 bg-natural-sage/5 p-5 font-sans shadow-sm sm:p-6">
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">{eyebrow}</p><h2 className="mt-1 text-lg font-bold text-natural-dark">{title}</h2><div className="mt-2 text-sm leading-relaxed text-natural-stone">{children}</div></div>
      <button type="button" onClick={() => void dismiss(step)} aria-label={`Dismiss ${title} guide`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-natural-stone hover:bg-natural-cream hover:text-natural-dark"><X className="h-4 w-4" /></button>
    </div>
    {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
  </section>;
}

export function OnboardingHelp() {
  const { reset } = useOnboarding();
  return <section className="rounded-3xl border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">Chapter guide</p><h2 className="mt-1 text-lg font-bold text-natural-dark">How Chapter works</h2><ul className="mt-3 space-y-2 text-xs leading-relaxed text-natural-stone"><li><strong className="text-natural-dark">Add a book:</strong> choose Reading Companion for Casual or Deep Reading, or Story Thread for fiction.</li><li><strong className="text-natural-dark">Read in sessions:</strong> Chapter saves your progress first, then prepares the companion notes in the background.</li><li><strong className="text-natural-dark">Return when it helps:</strong> Review brings back key ideas; Journey reflects patterns across your reading.</li></ul><button type="button" onClick={() => void reset()} className="mt-4 min-h-11 rounded-full border border-natural-border px-4 text-xs font-bold text-natural-dark hover:bg-white">Show helpful tips again</button></section>;
}
