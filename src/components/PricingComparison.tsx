import { Check, Minus } from "lucide-react";
import { Link } from "react-router-dom";

const rows = [
  ["Your library, progress, notes & saved lines", true, true, true],
  ["Reading logs, goals & quiet milestones", true, true, true],
  ["Book Wiki, Reading Lens & Reading Map", false, "Soon", true],
  ["Ask across your saved reading sessions", false, "Soon", true],
  ["Connections between books", false, "Soon", true],
  ["Recap podcast & monthly reading review", false, "Soon", true],
] as const;

function Cell({ value }: { value: boolean | "Soon" }) {
  if (value === true) return <span className="inline-flex items-center gap-1 text-natural-sage"><Check className="h-4 w-4" /><span className="sr-only">Included</span></span>;
  if (value === "Soon") return <span className="font-sans text-[10px] font-bold uppercase tracking-wide text-natural-stone">Soon</span>;
  return <span className="inline-flex text-natural-stone/50"><Minus className="h-4 w-4" /><span className="sr-only">Not included</span></span>;
}

type Props = {
  billingEnabled: boolean;
  activeTier: "free" | "plus" | "deep_reader";
  onChoose: (sku: string) => void;
};

export default function PricingComparison({ billingEnabled, activeTier, onChoose }: Props) {
  const planAction = (tier: "free" | "plus" | "deep_reader") => {
    if (tier === "free") return <Link to="/" className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-full border border-natural-border bg-natural-cream px-3 font-sans text-xs font-bold text-natural-dark hover:border-natural-sage">Keep Free</Link>;
    const sku = tier === "plus" ? "plus_monthly" : "deep_reader_monthly";
    const label = activeTier === tier ? "Current plan" : tier === "plus" ? "Choose Reader Plus" : "Choose Deep Reader";
    return <button type="button" disabled={!billingEnabled || activeTier === tier} onClick={() => onChoose(sku)} className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-natural-sage px-3 font-sans text-xs font-bold text-white hover:opacity-90 disabled:cursor-default disabled:opacity-55">{billingEnabled ? label : "Coming soon"}</button>;
  };
  const planHeader = (name: string, tagline: string, tier: "free" | "plus" | "deep_reader") => <div className="flex min-h-[190px] flex-col items-center justify-center text-center"><span className="text-base font-bold text-natural-dark">{name}</span><span className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-natural-stone">{tagline}</span>{tier !== "free" && <span className="mt-2 text-[10px] font-medium text-natural-stone">Everything in {tier === "plus" ? "Free" : "Reader Plus"}</span>}{tier === "plus" && <span className="mt-3 rounded-full bg-natural-stone/10 px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-wide text-natural-stone">A lighter step</span>}{tier === "deep_reader" && <span className="mt-3 rounded-full bg-natural-sage/15 px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-wide text-natural-sage">Most complete</span>}{planAction(tier)}</div>;
  return <section id="comparison" className="scroll-mt-28 rounded-3xl border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-7" aria-labelledby="comparison-heading">
    <div className="max-w-2xl"><p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">Compare with clarity</p><h2 id="comparison-heading" className="mt-1 text-2xl font-bold text-natural-dark">Choose the depth that fits this season of reading.</h2><p className="mt-2 text-sm leading-relaxed text-natural-stone">Free stays generous. Deep Reader adds a grounded companion when you want to return, question and connect what you have read.</p></div>
    <div className="mt-6 overflow-x-auto"><table className="min-w-[640px] w-full border-separate border-spacing-0 text-left font-sans text-sm"><thead><tr className="text-xs font-bold text-natural-dark"><th scope="col" className="w-[34%] border-b border-natural-border pb-3 pr-4 align-middle">What changes</th><th scope="col" className="border-b border-natural-border px-3 pb-3 text-center align-middle">{planHeader("Free", "Start reading", "free")}</th><th scope="col" className="border-b border-natural-border px-3 pb-3 text-center align-middle">{planHeader("Reader Plus", "Read consistently", "plus")}</th><th scope="col" className="border-b border-natural-border bg-natural-sage/5 px-3 pb-3 text-center align-middle text-natural-sage">{planHeader("Deep Reader", "Understand what you read", "deep_reader")}</th></tr></thead><tbody>{rows.map(([label, free, plus, deep]) => <tr key={label}><th scope="row" className="border-b border-natural-border/70 py-3 pr-4 font-medium leading-relaxed text-natural-dark">{label}</th><td className="border-b border-natural-border/70 px-3 py-3 text-center"><Cell value={free} /></td><td className="border-b border-natural-border/70 px-3 py-3 text-center"><Cell value={plus} /></td><td className="border-b border-natural-border/70 bg-natural-sage/5 px-3 py-3 text-center"><Cell value={deep} /></td></tr>)}</tbody></table></div>
    <p className="mt-4 text-xs leading-relaxed text-natural-stone">Each paid tier includes the reading foundation above. Reader Plus is currently a lighter membership step; its additional capabilities will be introduced separately and are not represented as available today.</p>
  </section>;
}
