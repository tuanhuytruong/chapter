import React from "react";
import type { QuietStreakTier } from "../quietStreak";

export default function QuietStreakBadge({ tier, children, className = "" }: { tier: QuietStreakTier | null | undefined; children: React.ReactNode; className?: string }) {
  const label = tier ? `${tier.title} — ${tier.days}-day reading rhythm` : "Reading rhythm";
  return <div title={label} aria-label={label} className={`rounded-full ${tier ? `ring-2 ring-offset-2 ring-offset-natural-bg ${tier.ringClass}` : ""} ${className}`}>{children}</div>;
}
