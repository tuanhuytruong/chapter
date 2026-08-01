import { Check, Minus } from "lucide-react";

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

export default function PricingComparison() {
  return <section id="comparison" className="scroll-mt-28 rounded-3xl border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-7" aria-labelledby="comparison-heading">
    <div className="max-w-2xl"><p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">Compare with clarity</p><h2 id="comparison-heading" className="mt-1 text-2xl font-bold text-natural-dark">Choose the depth that fits this season of reading.</h2><p className="mt-2 text-sm leading-relaxed text-natural-stone">Free stays generous. Deep Reader adds a grounded companion when you want to return, question and connect what you have read.</p></div>
    <div className="mt-6 overflow-x-auto"><table className="min-w-[640px] w-full border-separate border-spacing-0 text-left font-sans text-sm"><thead><tr className="text-xs font-bold text-natural-dark"><th scope="col" className="w-[46%] border-b border-natural-border pb-3 pr-4">What changes</th><th scope="col" className="border-b border-natural-border px-3 pb-3 text-center">Free</th><th scope="col" className="border-b border-natural-border px-3 pb-3 text-center">Reader Plus</th><th scope="col" className="border-b border-natural-border bg-natural-sage/5 px-3 pb-3 text-center text-natural-sage">Deep Reader</th></tr></thead><tbody>{rows.map(([label, free, plus, deep]) => <tr key={label}><th scope="row" className="border-b border-natural-border/70 py-3 pr-4 font-medium leading-relaxed text-natural-dark">{label}</th><td className="border-b border-natural-border/70 px-3 py-3 text-center"><Cell value={free} /></td><td className="border-b border-natural-border/70 px-3 py-3 text-center"><Cell value={plus} /></td><td className="border-b border-natural-border/70 bg-natural-sage/5 px-3 py-3 text-center"><Cell value={deep} /></td></tr>)}</tbody></table></div>
    <p className="mt-4 text-xs leading-relaxed text-natural-stone">Reader Plus is a lighter membership tier in preparation. Its future capabilities are not included in purchase access today.</p>
  </section>;
}
