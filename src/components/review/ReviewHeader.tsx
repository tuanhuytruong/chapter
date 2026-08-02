type ReviewMode = "focused" | "flow";

export default function ReviewHeader({ completed, total, hasActiveCard, mode, onModeChange }: { completed: number; total: number; hasActiveCard: boolean; mode: ReviewMode; onModeChange: (mode: ReviewMode) => void }) {
  const progress = total > 0 ? Math.min(100, (completed / total) * 100) : 0;
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-natural-sage">Review · Quiet recall</p>
          <h1 className="mt-1 text-xl font-bold text-natural-dark">Review</h1>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && <p className="text-xs font-semibold tabular-nums text-natural-stone">{hasActiveCard ? completed + 1 : completed} of {total}</p>}
          <div className="flex rounded-full border border-natural-border bg-natural-cream p-0.5 text-[11px] font-bold">
            <button type="button" onClick={() => onModeChange("focused")} aria-pressed={mode === "focused"} className={`min-h-8 rounded-full px-3 ${mode === "focused" ? "bg-white text-natural-dark shadow-sm" : "text-natural-stone"}`}>Focused</button>
            <button type="button" onClick={() => onModeChange("flow")} aria-pressed={mode === "flow"} className={`min-h-8 rounded-full px-3 ${mode === "flow" ? "bg-white text-natural-dark shadow-sm" : "text-natural-stone"}`}>Quick flow</button>
          </div>
        </div>
      </div>
      {total > 0 && <div className="h-1 overflow-hidden rounded-full bg-natural-border/70" aria-label={`${completed} of ${total} cards completed`}><div className="h-full rounded-full bg-natural-sage transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div>}
    </header>
  );
}
