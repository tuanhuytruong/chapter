import React, { useEffect, useRef, useState } from "react";
import { Award, BarChart3, CalendarDays, ChevronRight, CircleGauge, Settings2, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { GuideCard } from "../onboarding";

type JourneyDrawerProps = { open: boolean; onClose: () => void };

const items = [
  { to: "/insights", label: "Insights", description: "Patterns in your reading", icon: BarChart3 },
  { to: "/calendar", label: "Calendar", description: "Your reading days", icon: CalendarDays },
  { to: "/momentum", label: "Goals & Momentum", description: "Your weekly reading rhythm", icon: CircleGauge },
  { to: "/achievements", label: "Milestones", description: "Quiet progress worth keeping", icon: Award },
];

export default function JourneyDrawer({ open, onClose }: JourneyDrawerProps) {
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(open);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(open);

  useEffect(() => {
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (open) {
      setRendered(true);
      frame = requestAnimationFrame(() => setVisible(true));
      timer = setTimeout(() => closeButtonRef.current?.focus(), 180);
    } else {
      const shouldRestoreTriggerFocus = wasOpenRef.current;
      setVisible(false);
      timer = setTimeout(() => {
        setRendered(false);
        if (shouldRestoreTriggerFocus) {
          document.querySelector<HTMLButtonElement>('[aria-label="Open reading journey"]')?.focus();
        }
      }, 200);
    }
    wasOpenRef.current = open;
    return () => {
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!rendered) return null;
  const state = visible ? "open" : "closed";
  return (
    <div className="journey-drawer fixed inset-0 z-50" data-state={state} aria-hidden={!visible} aria-modal="true" role="dialog" aria-label="Your Journey">
      <button tabIndex={visible ? 0 : -1} aria-label="Close journey menu" onClick={onClose} className="journey-backdrop absolute inset-0 bg-natural-dark/20 backdrop-blur-[1px]" />
      <aside id="journey-menu" className="journey-panel relative flex h-full w-[min(22rem,calc(100vw-2rem))] flex-col overflow-y-auto border-r border-natural-border bg-natural-bg px-5 pb-6 pt-5 shadow-2xl sm:px-6 sm:pt-7">
        <div className="journey-entry flex items-start justify-between gap-4" style={{ animationDelay: "35ms" }}>
          <div><p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-natural-sage">Your Journey</p><h2 className="mt-1 font-sans text-2xl font-bold text-natural-dark">A quieter view of progress</h2></div>
          <button ref={closeButtonRef} onClick={onClose} aria-label="Close journey menu" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-natural-border bg-natural-cream text-natural-stone transition-colors hover:text-natural-dark"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5"><GuideCard step="journey" eyebrow="Your Journey" title="Look back without turning reading into a scoreboard"><p>Use these views when reflection helps: patterns, reading days, momentum, and quiet milestones all stay optional.</p></GuideCard></div>
        <nav className="mt-5 space-y-2" aria-label="Journey navigation">
          {items.map(({ to, label, description, icon: Icon }, index) => (
            <NavLink key={to} to={to} onClick={onClose} style={{ animationDelay: `${80 + index * 35}ms` }} className={({ isActive }) => `journey-entry group flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${isActive ? "border-natural-sage/30 bg-natural-sage/10 text-natural-dark" : "border-transparent text-natural-stone hover:border-natural-border hover:bg-natural-cream hover:text-natural-dark"}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-natural-cream text-natural-sage transition-colors group-hover:bg-natural-sage/10"><Icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className="block font-sans text-sm font-bold">{label}</span><span className="mt-0.5 block truncate font-sans text-xs font-normal text-natural-stone">{description}</span></span>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
            </NavLink>
          ))}
        </nav>
        <NavLink to="/account" onClick={onClose} style={{ animationDelay: "235ms" }} className="journey-entry mt-6 flex min-h-11 items-center gap-2 rounded-xl px-3 font-sans text-sm font-semibold text-natural-stone transition-colors hover:bg-natural-cream hover:text-natural-dark"><Settings2 className="h-4 w-4" /> Telegram & settings</NavLink>
        <p className="journey-entry mt-auto border-t border-natural-border pt-5 font-sans text-xs leading-relaxed text-natural-stone" style={{ animationDelay: "270ms" }}>Your reading data stays personal. Journey is for reflection, not another daily to-do list.</p>
      </aside>
    </div>
  );
}
