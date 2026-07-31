import React from "react";

type Usage = { used: number; reserved: number; limit: number | "unlimited" | "unavailable"; remaining: number | null };

export default function UsageMeter({ label, usage }: { label: string; usage: Usage }) {
  if (usage.limit === "unavailable") return <p className="text-xs leading-relaxed text-natural-stone">{label} is part of a later membership chapter.</p>;
  if (usage.limit === "unlimited") return <p className="text-xs leading-relaxed text-natural-stone">{label} is available without a monthly meter.</p>;
  const total = usage.used + usage.reserved;
  const percentage = Math.min(100, Math.round((total / usage.limit) * 100));
  return <div className="space-y-1.5"><div className="flex justify-between gap-3 font-sans text-xs text-natural-stone"><span>{label}</span><span className="shrink-0">{total} of {usage.limit} used</span></div><div className="h-1.5 overflow-hidden rounded-full bg-natural-border"><div className="h-full rounded-full bg-natural-sage" style={{ width: `${percentage}%` }} /></div></div>;
}
