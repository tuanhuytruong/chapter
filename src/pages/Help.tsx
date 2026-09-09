import { useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, CircleHelp, Search, X } from "lucide-react";
import { filterHelpTopics, helpTopics } from "../helpContent";

export default function Help() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const baseId = useId();
  const topics = useMemo(() => filterHelpTopics(helpTopics, query), [query]);
  useEffect(() => {
    const openAnchor = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const topic = helpTopics.find((item) => item.id === id);
      if (!topic) return;
      setOpenId(topic.questions[0]?.id || null);
      window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    };
    openAnchor(); window.addEventListener("hashchange", openAnchor); return () => window.removeEventListener("hashchange", openAnchor);
  }, []);
  return <main className="mx-auto max-w-3xl space-y-5 pb-8 sm:space-y-6">
    <section className="rounded-[28px] border border-natural-sage/20 bg-natural-sage/5 p-5 shadow-sm sm:p-7">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">Chapter guide</p>
      <div className="mt-1 flex items-start gap-3"><CircleHelp className="mt-1 h-6 w-6 shrink-0 text-natural-sage" /><div><h1 className="text-3xl font-bold text-natural-dark">How Chapter works</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-natural-stone">A quiet reference for reading, companions, and returning to what mattered — always here after you dismiss the first tips.</p></div></div>
      <label className="mt-5 flex min-h-11 items-center gap-2 rounded-full border border-natural-border bg-white px-3 focus-within:ring-2 focus-within:ring-natural-sage/45"><Search className="h-4 w-4 shrink-0 text-natural-stone" /><span className="sr-only">Search help</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search help" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear help search" className="flex h-8 w-8 items-center justify-center rounded-full text-natural-stone hover:bg-natural-cream"><X className="h-4 w-4" /></button>}</label>
    </section>
    {topics.length ? topics.map((topic) => <section key={topic.id} id={topic.id} className="scroll-mt-24 rounded-3xl border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6" aria-labelledby={`${baseId}-${topic.id}`}><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">{topic.eyebrow}</p><h2 id={`${baseId}-${topic.id}`} className="mt-1 text-xl font-bold text-natural-dark">{topic.title}</h2><p className="mt-1 text-sm leading-relaxed text-natural-stone">{topic.intro}</p><div className="mt-4 divide-y divide-natural-border">{topic.questions.map((item) => { const expanded = openId === item.id; const panelId = `${baseId}-${item.id}`; return <div key={item.id}><button type="button" onClick={() => setOpenId(expanded ? null : item.id)} aria-expanded={expanded} aria-controls={panelId} className="flex min-h-12 w-full items-center justify-between gap-4 py-3 text-left text-sm font-bold text-natural-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-natural-sage/50"><span>{item.question}</span><ChevronDown className={`h-4 w-4 shrink-0 text-natural-stone transition-transform ${expanded ? "rotate-180" : ""}`} /></button>{expanded && <div id={panelId} className="pb-4 pr-6 text-sm leading-relaxed text-natural-stone">{item.answer}</div>}</div>; })}</div></section>) : <section aria-live="polite" className="rounded-3xl border border-dashed border-natural-border bg-natural-cream p-8 text-center"><p className="text-sm font-bold text-natural-dark">No help topics match “{query}” yet.</p><button type="button" onClick={() => setQuery("")} className="mt-3 min-h-11 rounded-full border border-natural-border px-4 text-xs font-bold text-natural-dark hover:bg-white">Clear search</button></section>}
  </main>;
}
