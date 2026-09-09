import { CircleGauge } from "lucide-react";
import { Link } from "react-router-dom";
import type { QuietStreakSummary } from "../api";
import { getQuietStreakTierPresentation } from "../quietStreakPresentation";

export function readingRhythmPresentation(rhythm: QuietStreakSummary | null | undefined) {
  if (!rhythm) return { label: "Reading rhythm", accessibleLabel: "Reading rhythm. Open Reading rhythm.", tone: "border-natural-border bg-natural-cream text-natural-stone" };
  const tier = rhythm.highest_tier;
  const tierTone = getQuietStreakTierPresentation(tier?.id).chip;
  if (rhythm.current_streak > 0) return { label: `${rhythm.current_streak}-day rhythm`, accessibleLabel: `${rhythm.current_streak}-day reading rhythm${tier ? `. ${tier.title} achieved.` : ""} Open Reading rhythm.`, tone: tier ? tierTone : "border-natural-border bg-natural-cream text-natural-dark" };
  if (tier) return { label: "Your rhythm", accessibleLabel: `${tier.title} remains part of your rhythm. Open Reading rhythm.`, tone: tierTone };
  return { label: "Begin your rhythm", accessibleLabel: "Begin your reading rhythm. Open Reading rhythm.", tone: "border-natural-border bg-natural-cream text-natural-stone" };
}

export default function ReadingRhythmChip({ rhythm, mobile = false, onNavigate }: { rhythm: QuietStreakSummary | null | undefined; mobile?: boolean; onNavigate?: () => void }) {
  const item = readingRhythmPresentation(rhythm);
  return <Link to="/streaks" onClick={onNavigate} title={item.accessibleLabel} aria-label={item.accessibleLabel} className={`${mobile ? "flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm font-medium" : "inline-flex min-h-11 max-w-[172px] items-center gap-1.5 rounded-full border px-3 text-xs font-bold"} ${item.tone} outline-none transition hover:border-natural-sage/60 focus-visible:ring-2 focus-visible:ring-natural-sage/50`}><CircleGauge className={mobile ? "h-4 w-4 shrink-0" : "h-3.5 w-3.5 shrink-0"} /><span className="truncate">{item.label}</span></Link>;
}
