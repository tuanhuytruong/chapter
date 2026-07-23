import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, BookOpen, X } from "lucide-react";
import { api } from "../api";
import type { BookRow } from "../types";
import type { CalendarLogRow } from "../calendar";
import { calendarDate, daysInMonth, monthLabel, monthStringInAppTz, shiftMonth, weekdayOffset } from "../calendar";

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

export default function ReadingCalendar() {
  const [month, setMonth] = useState(() => monthStringInAppTz());
  const [bookId, setBookId] = useState("");
  const [books, setBooks] = useState<BookRow[]>([]);
  const [logs, setLogs] = useState<CalendarLogRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true); setError(null); setSelected(null);
    Promise.all([api.getCalendar(month, bookId), api.listBooks("mine")])
      .then(([nextLogs, nextBooks]) => { if (live) { setLogs(nextLogs); setBooks(nextBooks); } })
      .catch((e: any) => { if (live) setError(e.message || "Could not load calendar."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [month, bookId]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarLogRow[]>();
    logs.forEach((log) => map.set(log.date, [...(map.get(log.date) || []), log]));
    return map;
  }, [logs]);
  const selectedLogs = selected ? byDay.get(selected) || [] : [];
  const cells = Array.from({ length: weekdayOffset(month) }, () => null).concat(
    Array.from({ length: daysInMonth(month) }, (_, index) => calendarDate(month, index + 1))
  );

  return <main className="mx-auto max-w-5xl space-y-5 font-sans">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-natural-sage">Reading history</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-natural-dark"><CalendarDays className="h-6 w-6" /> Calendar</h1></div>
      <label className="sr-only" htmlFor="calendar-book">Filter by book</label>
      <select id="calendar-book" value={bookId} onChange={(e) => setBookId(e.target.value)} className="min-h-11 max-w-full rounded-xl border border-natural-border bg-natural-cream px-3 text-sm text-natural-dark">
        <option value="">All my books</option>{books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
      </select>
    </header>

    <section className="rounded-[28px] border border-natural-border bg-natural-cream p-3 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2"><button aria-label="Previous month" onClick={() => setMonth((value) => shiftMonth(value, -1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-natural-border hover:bg-white"><ChevronLeft className="h-5 w-5" /></button><h2 className="text-base font-bold text-natural-dark sm:text-lg">{monthLabel(month)}</h2><button aria-label="Next month" onClick={() => setMonth((value) => shiftMonth(value, 1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-natural-border hover:bg-white"><ChevronRight className="h-5 w-5" /></button></div>
      {loading ? <div className="flex h-72 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-natural-sage" /></div> : error ? <div className="p-10 text-center text-sm text-red-700" role="alert">{error}</div> : <>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-natural-stone sm:gap-2"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
        <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">{cells.map((date, index) => {
          if (!date) return <div key={`blank-${index}`} className="min-h-16 rounded-xl bg-transparent sm:min-h-24" />;
          const entries = byDay.get(date) || []; const units = entries.reduce((sum, entry) => sum + Number(entry.units_read), 0); const active = entries.length > 0;
          return <button key={date} aria-label={`${date}: ${entries.length} session${entries.length === 1 ? "" : "s"}`} onClick={() => active && setSelected(date)} disabled={!active} className={`min-h-16 rounded-xl border p-1 text-left transition sm:min-h-24 sm:p-2 ${active ? "border-natural-sage/35 bg-natural-sage/10 hover:bg-natural-sage/20" : "border-transparent bg-white/35"} ${selected === date ? "ring-2 ring-natural-sage" : ""}`}><span className="text-xs font-bold text-natural-dark">{date.slice(-2).replace(/^0/, "")}</span>{active && <div className="mt-1 space-y-0.5"><span className="block text-[10px] font-bold text-natural-sage">{entries.length}s</span><span className="hidden text-[10px] text-natural-stone sm:block">{units} read</span></div>}</button>;
        })}</div>
        <p className="mt-4 text-center text-xs text-natural-stone">{logs.length} session{logs.length === 1 ? "" : "s"} · {logs.reduce((sum, log) => sum + Number(log.units_read), 0)} pages/chunks read</p>
      </>}
    </section>

    {selected && <section className="rounded-[28px] border border-natural-border bg-natural-cream p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-natural-sage">Selected day</p><h2 className="mt-1 text-lg font-bold text-natural-dark">{dayLabel(selected)}</h2></div><button onClick={() => setSelected(null)} aria-label="Close day details" className="flex h-11 w-11 items-center justify-center rounded-full border border-natural-border"><X className="h-4 w-4" /></button></div><div className="mt-5 space-y-3">{selectedLogs.map((log) => <article key={log.id} className="rounded-2xl border border-natural-border bg-white/60 p-4"><div className="flex items-start gap-3"><BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-natural-sage" /><div className="min-w-0"><p className="font-bold text-natural-dark">{log.title}</p><p className="text-xs text-natural-stone">{log.chapter_title || `Session ${log.session}`} · {log.page_start}–{log.page_end} · {log.units_read} read</p>{log.summary && <p className="mt-2 text-sm leading-relaxed text-natural-dark">{log.summary}</p>}</div></div></article>)}</div></section>}
  </main>;
}
