import type { GenerationProgressSnapshot } from "../api";

export function GenerationProgress({ progress, reconnecting = false }: { progress: GenerationProgressSnapshot | null | undefined; reconnecting?: boolean }) {
  if (!progress) return null;
  const label = reconnecting ? "Reconnecting…" : progress.stage;
  return <div className="mt-2 max-w-xs" aria-live="polite">
    <div className="flex justify-between gap-2 text-[11px] text-natural-stone"><span className="truncate">Estimated progress · {label}</span><span className="shrink-0">{Math.round(progress.percent)}%</span></div>
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-natural-border/70" role="progressbar" aria-label={`Estimated progress: ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.percent)}><div className="h-full rounded-full bg-natural-sage transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }} /></div>
    {progress.status === "retrying" && <p className="mt-1 text-[11px] text-natural-stone">Audio service is busy — retrying automatically.</p>}
    {progress.status === "failed" && <p className="mt-1 text-[11px] text-natural-clay">{progress.errorMessage || "Generation needs retry."}</p>}
  </div>;
}
