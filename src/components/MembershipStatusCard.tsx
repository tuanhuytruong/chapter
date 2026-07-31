import React from "react";
import type { EntitlementsResponse } from "../api";
import UsageMeter from "./UsageMeter";

const tierName: Record<EntitlementsResponse["subscription"]["tier"], string> = { free: "Free", plus: "Reader Plus", deep_reader: "Deep Reader" };

export default function MembershipStatusCard({ data }: { data: EntitlementsResponse }) {
  const { subscription } = data;
  const date = subscription.periodEnd ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(subscription.periodEnd)) : null;
  const featured = Object.entries(data.features).find(([, value]) => typeof value.usage.limit === "number");
  return <section className="rounded-3xl border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">Membership</p><div className="mt-2 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl font-bold text-natural-dark">{tierName[subscription.tier]}</h2><span className="rounded-full bg-natural-sage/10 px-2.5 py-1 font-sans text-[10px] font-bold text-natural-sage">{subscription.active ? subscription.status : "Free reading"}</span></div><p className="mt-2 text-sm leading-relaxed text-natural-stone">Core reading, progress, notes and milestones always stay yours.</p>{date && <p className="mt-3 font-sans text-xs text-natural-stone">Current access through {date}</p>}{featured && <div className="mt-4 border-t border-natural-border pt-4"><UsageMeter label="Deep reading capacity" usage={featured[1].usage} /></div>}</section>;
}
