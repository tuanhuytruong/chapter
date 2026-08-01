import React, { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api, type BillingCatalogResponse, type EntitlementsResponse, type MembershipPlansResponse } from "../api";
import PricingCard from "../components/PricingCard";
import VietQrCheckoutSheet from "../components/VietQrCheckoutSheet";

export default function Pricing() {
  const [catalog, setCatalog] = useState<MembershipPlansResponse | null>(null);
  const [billing, setBilling] = useState<BillingCatalogResponse | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementsResponse | null>(null);
  const [sku, setSku] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void api.getMembershipPlans().then(setCatalog).catch(() => setError("Membership details are unavailable right now.")); void api.getEntitlements().then(setEntitlement).catch(() => undefined); void api.getBillingCatalog().then(setBilling).catch(() => undefined); }, []);
  if (!catalog && !error) return <div className="flex min-h-48 items-center justify-center text-natural-stone"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  return <main className="mx-auto max-w-6xl space-y-6"><Link to="/account" className="inline-flex min-h-11 items-center gap-1.5 font-sans text-xs font-bold text-natural-stone hover:text-natural-dark"><ArrowLeft className="h-4 w-4" /> Account</Link><section className="max-w-2xl"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">Membership</p><h1 className="mt-1 text-3xl font-bold text-natural-dark sm:text-4xl">Keep the reading habit. Go deeper when it helps.</h1><p className="mt-3 text-sm leading-relaxed text-natural-stone">Reading, progress, notes and milestones remain free. Membership supports deeper companionship—not a scoreboard.</p></section>{error ? <p className="rounded-2xl border border-natural-border bg-natural-cream p-4 text-sm text-natural-stone">{error}</p> : <section className="grid gap-4 md:grid-cols-3">{catalog?.plans.map((plan) => <PricingCard key={plan.tier} plan={plan} currentTier={entitlement?.subscription.tier || "free"} />)}</section>}{billing?.enabled ? <section className="rounded-3xl border border-natural-border bg-natural-cream p-5 sm:p-6"><h2 className="text-lg font-bold text-natural-dark">Pay by MB bank transfer</h2><p className="mt-1 text-sm text-natural-stone">Choose a reading plan, then use the unique transfer content shown with your QR.</p><div className="mt-4 flex flex-wrap gap-2">{billing.catalog.filter(x=>x.available).map(x=><button key={x.id} onClick={()=>setSku(x.id)} className="min-h-11 rounded-full bg-natural-sage px-4 text-xs font-bold text-white">{x.id.replace(/_/g," ")} · {new Intl.NumberFormat("vi-VN").format(x.amountVnd)}đ</button>)}</div></section> : <p className="text-center font-sans text-xs text-natural-stone">Bank-transfer checkout is being prepared. Nothing changes to your current reading experience.</p>}{sku && <VietQrCheckoutSheet sku={sku} onClose={()=>setSku(null)} />}</main>;
}
