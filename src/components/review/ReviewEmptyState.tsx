import { Link } from "react-router-dom";

export default function ReviewEmptyState({ responded }: { responded: boolean }) {
  return <section className="rounded-[24px] border border-natural-border bg-natural-cream px-6 py-10 text-center shadow-sm sm:px-10 sm:py-12">
    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-natural-sage">A quiet return</p>
    <h2 className="mt-2 text-lg font-bold text-natural-dark">{responded ? "A thought has been held" : "Nothing asking for your attention today"}</h2>
    <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-natural-stone">{responded ? "You can return whenever another idea has had time to settle." : "When an idea has had time to settle, it may return here."}</p>
    <Link to="/" className="mt-6 inline-flex min-h-11 items-center rounded-full border border-natural-border px-5 text-xs font-bold uppercase tracking-wider text-natural-dark hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage">Continue reading</Link>
  </section>;
}
