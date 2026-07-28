import { ArrowUpDown, Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Sort = "recent" | "title" | "progress" | "streak";

const options: { id: Sort; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "title", label: "Title A–Z" },
  { id: "progress", label: "Progress ↑" },
  { id: "streak", label: "Streak ↓" },
];

export default function SortMenu({ value, onChange }: { value: Sort; onChange(value: Sort): void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.id === value) ?? options[0];

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, []);

  return <div ref={rootRef} className="relative min-w-0 sm:w-auto">
    <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}
      className="flex min-h-11 w-full items-center gap-2 rounded-2xl border border-natural-border bg-natural-cream px-3 py-2 text-left font-sans text-xs font-medium text-natural-dark shadow-sm transition hover:border-natural-sage/45 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/45 sm:w-auto">
      <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-natural-sage" />
      <span className="min-w-0 flex-1 truncate">{selected.label}</span>
      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-natural-stone transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div role="menu" aria-label="Sort books" className="absolute right-0 z-30 mt-2 w-full min-w-44 overflow-hidden rounded-2xl border border-natural-border bg-natural-bg p-1.5 shadow-[0_12px_30px_rgba(61,48,40,0.14)] sm:w-48">
      {options.map((option) => {
        const active = option.id === value;
        return <button key={option.id} type="button" role="menuitemradio" aria-checked={active} onClick={() => { onChange(option.id); setOpen(false); }}
          className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/45 ${active ? "bg-natural-sage/15 font-bold text-natural-dark" : "text-natural-muted hover:bg-natural-cream"}`}>
          {option.label}{active && <Check className="h-4 w-4 text-natural-sage" />}
        </button>;
      })}
    </div>}
  </div>;
}
