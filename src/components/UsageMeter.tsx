import React from "react";

type Usage = {
  used: number;
  reserved: number;
  limit: number | "unlimited" | "unavailable";
  remaining: number | null;
};

function finiteNonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

export default function UsageMeter({ label, usage }: { label: string; usage: Usage }) {
  if (usage.limit === "unavailable") {
    return <p className="text-xs leading-relaxed text-natural-stone">{label} is part of a later membership chapter.</p>;
  }
  if (usage.limit === "unlimited") {
    return <p className="text-xs leading-relaxed text-natural-stone">{label} is available without a monthly meter.</p>;
  }

  const limit = finiteNonNegative(usage.limit);
  const used = finiteNonNegative(usage.used);
  const reserved = finiteNonNegative(usage.reserved);
  if (limit === null || limit <= 0 || used === null || reserved === null) {
    return <p className="text-xs leading-relaxed text-natural-stone">{label} usage is temporarily unavailable.</p>;
  }

  const total = Math.min(limit, used + reserved);
  const percentage = Math.min(100, Math.max(0, Math.round((total / limit) * 100)));
  const atLimit = used + reserved >= limit;
  const almostAtLimit = !atLimit && percentage >= 80;
  const status = atLimit
    ? "Monthly limit reached."
    : almostAtLimit
      ? "Almost at your monthly limit."
      : null;
  const meterClass = atLimit
    ? "bg-red-700"
    : almostAtLimit
      ? "bg-amber-700"
      : "bg-natural-sage";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-3 font-sans text-xs text-natural-stone">
        <span>{label}</span>
        <span className="shrink-0">{Math.min(used + reserved, limit)} of {limit} used</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-natural-border" role="progressbar" aria-label={`${label} monthly usage`} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(used + reserved, limit)}>
        <div className={`h-full rounded-full ${meterClass}`} style={{ width: `${percentage}%` }} />
      </div>
      {status && <p className={`text-xs font-medium ${atLimit ? "text-red-800" : "text-amber-800"}`}>{status}</p>}
    </div>
  );
}
