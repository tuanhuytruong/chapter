import { ChevronDown } from "lucide-react";
import { useState } from "react";

const questions = [
  ["What stays free?", "Your library, reading progress, notes, saved lines, reading logs, goals, quiet milestones and basic reading summaries stay with you without a membership."],
  ["What does Deep Reader add today?", "Deep Reader adds Book Wiki, Reading Lens and Reading Map capacity, Ask My Reading, cross-book connections, recap podcasts and a monthly reading review, within the current monthly capacity."],
  ["How do monthly capacities work?", "Capacity renews by calendar month in the app time zone. Your Account shows membership status and payment history; feature surfaces show availability when you use them."],
  ["How does bank transfer work?", "When checkout is open, choose a plan to receive a unique payment QR and transfer reference. Use the exact amount and reference shown for that order. No card details are stored by Chapter."],
  ["When will access appear after I transfer?", "Each transfer is reviewed through the internal payment process before access is applied to its order. Keep the transfer reference unchanged so the order can be matched accurately."],
  ["What happens if I do not renew?", "Your membership features return to the Free plan when access ends. Your books, progress, notes, saved lines and reading history remain yours."],
  ["How is my reading material used?", "Reader companion features use your saved reading material to ground their output. Raw session text remains private to you and is not shared with other readers."],
] as const;

export default function PricingFaq() {
  const [open, setOpen] = useState<number | null>(0);
  return <section className="rounded-3xl border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-7" aria-labelledby="faq-heading"><div className="max-w-2xl"><p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">Before you decide</p><h2 id="faq-heading" className="mt-1 text-2xl font-bold text-natural-dark">A few clear answers.</h2></div><div className="mt-5 divide-y divide-natural-border">{questions.map(([question, answer], index) => { const expanded = open === index; const id = `pricing-faq-${index}`; return <div key={question}><button type="button" onClick={() => setOpen(expanded ? null : index)} aria-expanded={expanded} aria-controls={id} className="flex min-h-14 w-full items-center justify-between gap-4 py-3 text-left font-sans text-sm font-bold text-natural-dark outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-natural-sage/50"><span>{question}</span><ChevronDown className={`h-4 w-4 shrink-0 text-natural-stone transition-transform ${expanded ? "rotate-180" : ""}`} /></button>{expanded && <div id={id} className="pb-4 pr-8 font-sans text-sm leading-relaxed text-natural-stone">{answer}</div>}</div>; })}</div></section>;
}
