import { ArrowUpRight, Crown, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import type { MembershipTier } from "../api";

type Props = { tier: MembershipTier; mobile?: boolean; onNavigate?: () => void };

const presentation: Record<MembershipTier, { label: string; hint: string; className: string; icon: typeof Sparkles }> = {
  free: { label: "Free · Upgrade", hint: "Explore membership options", className: "border-natural-border bg-natural-cream text-natural-stone hover:border-natural-sage/40 hover:text-natural-dark", icon: ArrowUpRight },
  plus: { label: "Plus", hint: "View membership options", className: "border-natural-sage/20 bg-natural-sage/10 text-natural-sage hover:bg-natural-sage/15", icon: Sparkles },
  deep_reader: { label: "Deep Reader", hint: "View membership options", className: "border-natural-clay/20 bg-natural-clay/10 text-natural-clay hover:bg-natural-clay/15", icon: Crown },
};

export default function MembershipTierBadge({ tier, mobile = false, onNavigate }: Props) {
  const item = presentation[tier];
  const Icon = item.icon;
  const compact = !mobile;
  return <Link to="/pricing" onClick={onNavigate} title={item.hint} aria-label={`${item.label}. ${item.hint}.`} className={`outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/50 ${mobile ? "flex min-h-11 items-center gap-3 rounded-xl px-2 font-sans text-sm font-medium" : "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 font-sans text-[10px] font-bold"} ${item.className}`}>
    <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
    <span>{item.label}</span>
  </Link>;
}
