export default function ReviewHeader({ completed, total, hasActiveCard }: { completed: number; total: number; hasActiveCard: boolean }) {
  const progress = total > 0 ? Math.min(100, (completed / total) * 100) : 0;
  return (
    <header className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-natural-sage">Review · Quiet recall</p>
          <h1 className="mt-1 text-xl font-bold text-natural-dark">Review</h1>
        </div>
        {total > 0 && <p className="text-xs font-semibold tabular-nums text-natural-stone">{hasActiveCard ? completed + 1 : completed} / {total}</p>}
      </div>
      {total > 0 && <div className="h-1 overflow-hidden rounded-full bg-natural-border/70" aria-label={`${completed} of ${total} cards completed`}><div className="h-full rounded-full bg-natural-sage transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div>}
    </header>
  );
}
