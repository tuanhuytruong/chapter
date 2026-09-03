import React, { useEffect, useState } from "react";
import type { QuietStreakTier } from "../quietStreak";

const STORAGE_KEY = "chapter:quiet-streak-seen:v1";

function seenTiers(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as string[]; } catch { return []; }
}

export default function QuietStreakUnlock({ tier, onVisible }: { tier: QuietStreakTier | null | undefined; onVisible?: (tier: QuietStreakTier) => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!tier || seenTiers().includes(tier.id)) return;
    const next = [...seenTiers(), tier.id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setVisible(true);
    onVisible?.(tier);
  }, [tier?.id]);
  if (!visible || !tier) return null;
  return <p role="status" className="rounded-xl border border-natural-sage/30 bg-natural-sage/10 px-3 py-2 text-sm text-natural-dark transition motion-reduce:transition-none">{tier.title} is part of your reading rhythm.</p>;
}
