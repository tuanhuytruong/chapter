import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, ChevronDown, ChevronRight, Loader2, RefreshCw, Sparkles } from "lucide-react";

type Language = "auto" | "vi" | "en";
interface WikiConcept { name: string; definition: string; }
interface WikiTheme { name: string; description: string; }
interface WikiPerson { name: string; pulse: string; }
interface WikiQuote { text: string; page_start: number; }
interface MapThread { id: string; label: string; status?: string; evolution?: Array<{ log_id: string; page_start: number; note: string }>; }
interface MapEntity { id: string; name: string; kind?: string; current_state?: string; appearances?: Array<{ log_id: string; page_start: number; note: string }>; }
interface MapPath { log_id: string; page_start: number; page_end: number; title: string; summary: string; turning_point?: string; connected_from?: string | null; }
interface BookWikiData {
  pages_covered: number; overview: string; concepts: WikiConcept[]; themes: WikiTheme[]; people: WikiPerson[];
  notable_quotes: WikiQuote[]; open_questions: string[]; generated_at: string; output_language?: Language;
  book_so_far?: string; current_position?: { label?: string }; narrative_arc?: { label: string; detail: string }[];
  carry_forward_insights?: string[]; reading_path?: MapPath[]; thread_map?: MapThread[]; entity_map?: MapEntity[];
  current_reading_state?: { summary?: string; active_threads?: string[]; active_entities?: string[] }; next_session_context?: string;
}
interface WikiStatus {
  hasFile: boolean; totalSessions: number; chunksProcessed: number; wikiExists: boolean; pagesCovered: number;
  outputLanguage?: Language; jobStatus?: "idle" | "running" | "failed"; jobError?: string | null;
}
type ReaderSession = {
  id?: string; title?: string; label?: string; summary?: string; page_start?: number; page_end?: number;
  entities?: ReaderEntity[]; threads?: ReaderThread[]; [key: string]: unknown;
};
type ReaderEntity = { id?: string; name?: string; label?: string; description?: string; detail?: string; [key: string]: unknown };
type ReaderThread = { id?: string; title?: string; label?: string; summary?: string; detail?: string; [key: string]: unknown };

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
  const text = await res.text(); return (text ? JSON.parse(text) : {}) as T;
}
const text = (value: unknown) => typeof value === "string" ? value : "";
const nameOf = (item: Record<string, unknown>) => text(item.name) || text(item.title) || text(item.label) || "";
const sessionName = (item: ReaderSession) => {
  const title = nameOf(item);
  if (title && title !== "Reading session" && title !== "Untitled") return title;
  if (item.page_start != null) return `Session · Pages ${item.page_start}–${item.page_end ?? item.page_start}`;
  return "Session";
};
const pageLabel = (start: number, end: number) => `Pages ${start}–${end}`;

export default function BookWiki({ bookId, totalPages, canEdit, onOpenReadingSession }: { bookId: string; totalPages: number; canEdit: boolean; onOpenReadingSession: (logId: string) => void }) {
  const [wiki, setWiki] = useState<BookWikiData | null>(null);
  const [status, setStatus] = useState<WikiStatus | null>(null);
  const [sessions, setSessions] = useState<ReaderSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const fetchReader = useCallback(async () => {
    try {
      // Status is the durable baseline. A book without a generated wiki is a normal,
      // shared read-only state—not a failed AI Reader tab for another reader.
      const [nextStatus, wikiResult, nextSessions] = await Promise.all([
        req<WikiStatus>(`/api/books/${bookId}/wiki/status`),
        req<BookWikiData>(`/api/books/${bookId}/wiki`).catch((error: Error) => {
          if (error.message.startsWith("404:")) return null;
          throw error;
        }),
        // V2 is optional while rolling out. A missing endpoint deliberately falls back to V1.
        req<ReaderSession[] | { sessions?: ReaderSession[] }>(`/api/books/${bookId}/wiki/sessions`).catch(() => null),
      ]);
      setRequestError(null); setWiki(wikiResult); setStatus(nextStatus);
      const rawSessions = Array.isArray(nextSessions) ? nextSessions : nextSessions?.sessions ?? null;
      setSessions(rawSessions?.map((row: any) => {
        const analysis = row?.chunk_analysis && typeof row.chunk_analysis === "object" ? row.chunk_analysis : row;
        return {
          ...analysis,
          id: row?.log_id || analysis?.id,
          page_start: row?.page_start ?? analysis?.page_start,
          page_end: row?.page_end ?? analysis?.page_end,
          title: analysis?.session_title || analysis?.title,
          summary: analysis?.close_reading || analysis?.session_summary || analysis?.chunk_summary || analysis?.summary,
        } as ReaderSession;
      }) ?? null);
    } catch (error: any) { setRequestError(error.message || "AI Reader could not be loaded."); }
    finally { setLoading(false); }
  }, [bookId]);
  useEffect(() => { void fetchReader(); }, [fetchReader]);
  const running = status?.jobStatus === "running";
  const catchingUp = !!status && status.chunksProcessed < status.totalSessions;
  useEffect(() => { if (!running && !catchingUp) return; const timer = window.setInterval(() => void fetchReader(), 7000); return () => clearInterval(timer); }, [fetchReader, running, catchingUp]);
  const refresh = async () => { if (!canEdit || running) return; setRegenerating(true); try { await req(`/api/books/${bookId}/wiki/regenerate`, { method: "POST" }); await fetchReader(); } finally { setRegenerating(false); } };

  const v1Sessions = useMemo<ReaderSession[]>(() => wiki?.narrative_arc?.map((arc, index) => ({ id: `arc-${index}`, title: arc.label, summary: arc.detail })) ?? [], [wiki]);
  const readerSessions = sessions?.length ? sessions : v1Sessions;
  const progress = wiki && totalPages ? Math.min(100, Math.round((wiki.pages_covered / totalPages) * 100)) : 0;
  const languageMismatch = canEdit && status?.outputLanguage && status.outputLanguage !== "auto" && status.outputLanguage !== wiki?.output_language;
  const isVietnamese = wiki?.output_language === "vi";

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-natural-sage" /></div>;
  if (requestError) return <div className="rounded-2xl border border-natural-clay/30 bg-natural-clay/10 p-5 text-center"><p className="text-xs font-semibold text-natural-dark">AI Reader is unavailable</p><p className="mt-1 text-[11px] text-natural-stone">{requestError}</p><button onClick={() => { setRequestError(null); setLoading(true); void fetchReader(); }} className="mt-4 min-h-11 rounded-full border border-natural-sage/40 px-4 text-xs font-bold text-natural-sage">Try again</button></div>;
  if (!status?.hasFile || status.totalSessions === 0) return <Empty message={!status?.hasFile ? "Upload a PDF or EPUB to enable the AI Reader." : "The AI Reader will begin after your first reading session."} />;
  if (!wiki) {
    const message = status?.jobError
      || (running ? "The owner is preparing this reading map. It will appear here when processing finishes." : canEdit
        ? "Your saved sessions will appear here when processing finishes."
        : "The owner has not generated a shared AI Reader map for this book yet.");
    return <div className="rounded-2xl border border-natural-border bg-natural-cream/40 p-5 text-center"><p className="text-xs font-semibold text-natural-dark">{running ? "AI Reader is reading" : canEdit ? "AI Reader is preparing" : "AI Reader is not available yet"}</p><p className="mt-1 text-[11px] text-natural-stone">{message}</p>{canEdit && <button onClick={refresh} disabled={running || regenerating} className="mt-4 min-h-11 rounded-full border border-natural-sage/40 px-4 text-xs font-bold text-natural-sage disabled:opacity-50">{running || regenerating ? "Running…" : "Run AI Reader now"}</button>}</div>;
  }

  return <div className="space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-natural-sage"><Brain className="h-4 w-4" />AI Reader</p><p className="mt-1 text-xs text-natural-stone">A drillable reading map built from saved sessions—not raw source text.</p></div>{canEdit && <button onClick={refresh} disabled={running || regenerating} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-natural-border px-3 text-[11px] font-bold text-natural-stone disabled:opacity-50">{running || regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}{running ? "Reading…" : "Refresh"}</button>}</header>
    <div><div className="mb-1 flex justify-between text-[10px] text-natural-stone"><span>AI has read 1–{wiki.pages_covered}</span><span>{progress}% of book</span></div><div className="h-1.5 rounded-full bg-natural-border"><div className="h-full rounded-full bg-natural-sage" style={{ width: `${progress}%` }} /></div></div>
    {languageMismatch && <p className="rounded-xl bg-natural-clay/10 p-3 text-[11px] text-natural-clay">Vietnamese/source output settings changed. This map shows the last generated language; refresh to regenerate it.</p>}
    <section className="rounded-2xl border border-natural-border bg-natural-cream/45 p-4"><p className="text-xs leading-relaxed text-natural-dark">{wiki.book_so_far || wiki.overview}</p>{wiki.current_position?.label && <p className="mt-3 flex gap-1.5 text-[11px] text-natural-stone"><Sparkles className="h-3 w-3 shrink-0 text-natural-sage" />{wiki.current_position.label}</p>}</section>
    {wiki.current_reading_state?.summary && <section className="rounded-2xl border border-natural-sage/25 bg-natural-sage/5 p-4"><h2 className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">At this point</h2><p className="mt-2 text-xs leading-relaxed text-natural-dark">{wiki.current_reading_state.summary}</p>{wiki.next_session_context && <p className="mt-3 border-t border-natural-sage/15 pt-3 text-[11px] leading-relaxed text-natural-stone">Next session: {wiki.next_session_context}</p>}</section>}
    {(wiki.reading_path?.length || wiki.thread_map?.length || wiki.entity_map?.length) ? <ReadingMap wiki={wiki} onSession={onOpenReadingSession} openItem={openItem} setOpenItem={setOpenItem} /> : null}
    <section><h2 className="mb-2 text-xs font-bold text-natural-dark">Reading sessions</h2>{readerSessions.length ? <div className="space-y-2">{readerSessions.map((session, index) => { const key = session.id || `session-${index}`; const open = openSession === key; const entities = Array.isArray(session.entities) ? session.entities : []; const threads = Array.isArray(session.threads) ? session.threads : []; return <article key={key} className="overflow-hidden rounded-2xl border border-natural-border bg-white/55"><button onClick={() => setOpenSession(open ? null : key)} aria-expanded={open} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left"><span><b className="text-xs text-natural-dark">{sessionName(session)}</b>{session.page_start != null && <small className="ml-2 text-[10px] text-natural-stone">{pageLabel(session.page_start, session.page_end ?? session.page_start)}</small>}</span>{open ? <ChevronDown className="h-4 w-4 text-natural-sage" /> : <ChevronRight className="h-4 w-4 text-natural-stone" />}</button>{open && <div className="space-y-3 border-t border-natural-border px-4 py-3"><p className="text-[11px] leading-relaxed text-natural-stone">{text(session.summary) || "Session detail is not available yet."}</p><DrillGroup title="People & concepts" items={entities} itemKey={`${key}-entity`} openItem={openItem} setOpenItem={setOpenItem} /><DrillGroup title="Threads to follow" items={threads} itemKey={`${key}-thread`} openItem={openItem} setOpenItem={setOpenItem} /></div>}</article>; })}</div> : <p className="rounded-2xl border border-dashed border-natural-border p-4 text-center text-xs text-natural-stone">Session details are being prepared.</p>}</section>
    {!sessions && <V1References wiki={wiki} />}
  </div>;
}
function ReadingMap({ wiki, onSession, openItem, setOpenItem }: { wiki: BookWikiData; onSession: (id: string) => void; openItem: string | null; setOpenItem: (value: string | null) => void }) {
  const threads = (wiki.thread_map || []).map((item) => ({ ...item, detail: item.evolution?.map((e) => `${pageLabel(e.page_start, e.page_start)}: ${e.note}`).join("\n") }));
  // Preserve each page appearance as its own editorial line rather than
  // compressing a person's history into one dense run-on paragraph.
  const entities = (wiki.entity_map || []).map((item) => ({ ...item, detail: [item.current_state, item.appearances?.map((e) => `${pageLabel(e.page_start, e.page_start)}: ${e.note}`).join("\n")].filter(Boolean).join("\n") }));
  return <section className="space-y-3 rounded-2xl border border-natural-border bg-white/45 p-4">
    <div><h2 className="text-xs font-bold text-natural-dark">Reading map</h2><p className="mt-1 text-[11px] text-natural-stone">Follow the path, then open each thread or force where it changes.</p></div>
    {wiki.reading_path?.length ? <ol className="space-y-2">{wiki.reading_path.map((entry, index) => <li key={entry.log_id || `${entry.page_start}-${index}`}><button type="button" disabled={!entry.log_id} onClick={() => entry.log_id && onSession(entry.log_id)} className="w-full border-l-2 border-natural-sage/40 py-1 pl-3 text-left"><span className="text-xs font-semibold text-natural-dark">{entry.title} <small className="ml-1 text-[10px] font-bold text-natural-stone">{pageLabel(entry.page_start, entry.page_end)}</small></span><p className="mt-0.5 text-[11px] leading-relaxed text-natural-stone">{entry.turning_point || entry.summary}</p></button></li>)}</ol> : null}
    <DrillGroup title="Threads in motion" items={threads} itemKey="thread-map" openItem={openItem} setOpenItem={setOpenItem} />
    <DrillGroup title="People, ideas & forces" items={entities} itemKey="entity-map" openItem={openItem} setOpenItem={setOpenItem} />
  </section>;
}
function DetailText({ value }: { value: string }) { const parts = value.split(/((?:Trang|Pages) \d+(?:–\d+)?)/g); return <>{parts.map((part, index) => /^(?:Trang|Pages) \d+(?:–\d+)?$/.test(part) ? <strong key={index} className="font-bold text-natural-dark">{part}</strong> : part)}</>; }
function properStatus(value: string) { return value ? value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : ""; }
function DrillGroup({ title, items, itemKey, openItem, setOpenItem }: { title: string; items: Record<string, unknown>[]; itemKey: string; openItem: string | null; setOpenItem: (value: string | null) => void }) { if (!items.length) return null; return <div><h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-natural-sage">{title}</h3><div className="space-y-1">{items.map((item, index) => { const key = `${itemKey}-${item.id || index}`; const detail = text(item.description) || text(item.detail) || text(item.summary); const status = properStatus(text(item.status)); return <button key={key} onClick={() => setOpenItem(openItem === key ? null : key)} className="w-full rounded-xl bg-natural-cream/60 px-3 py-2 text-left"><span className="text-xs font-semibold text-natural-dark">{nameOf(item)}</span>{openItem === key && (detail || status) && <p className="mt-1 text-[11px] leading-relaxed text-natural-stone">{status && <strong className="font-bold text-natural-dark">{status}</strong>}{status && detail ? " · " : null}{detail && <span className="whitespace-pre-line"><DetailText value={detail} /></span>}</p>}</button>; })}</div></div>; }
function V1References({ wiki }: { wiki: BookWikiData }) { const [openItem, setOpenItem] = useState<string | null>(null); const items: ReaderEntity[] = [...wiki.concepts.map(x => ({ name: x.name, description: x.definition })), ...wiki.people.map(x => ({ name: x.name, description: x.pulse })), ...wiki.themes.map(x => ({ name: x.name, description: x.description }))]; return <section><h2 className="mb-2 text-xs font-bold text-natural-dark">Book references</h2><DrillGroup title="Concepts, people & themes" items={items} itemKey="v1" openItem={openItem} setOpenItem={setOpenItem} /></section>; }
function Empty({ message }: { message: string }) { return <div className="rounded-2xl border border-dashed border-natural-border p-5 text-center text-xs text-natural-stone">{message}</div>; }
