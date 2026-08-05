import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brain, ChevronDown, ChevronRight, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { GlossaryLabel, resolveGlossaryLanguage, type GlossaryKey, type GlossaryLanguage } from "./ContextualGlossary";

type Language = "auto" | "vi" | "en";
interface WikiConcept { name: string; definition: string; }
interface WikiTheme { name: string; description: string; }
interface WikiPerson { name: string; pulse: string; }
interface WikiQuote { text: string; page_start: number; }
interface MapThread { id: string; label: string; status?: string; evolution?: Array<{ log_id: string; page_start: number; note: string }>; }
interface MapEntity { id: string; name: string; kind?: string; current_state?: string; appearances?: Array<{ log_id: string; page_start: number; note: string }>; }
interface MapPath { log_id: string; page_start: number; page_end: number; title: string; summary: string; turning_point?: string; connected_from?: string | null; }
interface MapConnection { from_type: "thread" | "entity" | "session"; from_id: string; to_type: "thread" | "entity" | "session"; to_id: string; label: string; explanation: string; page_start: number; }
interface BookWikiData {
  pages_covered: number; overview: string; concepts: WikiConcept[]; themes: WikiTheme[]; people: WikiPerson[];
  notable_quotes: WikiQuote[]; open_questions: string[]; generated_at: string; output_language?: Language;
  book_so_far?: string; current_position?: { label?: string }; narrative_arc?: { label: string; detail: string }[];
  carry_forward_insights?: string[]; reading_path?: MapPath[]; thread_map?: MapThread[]; entity_map?: MapEntity[]; connections?: MapConnection[];
  current_reading_state?: { summary?: string; active_threads?: string[]; active_entities?: string[] }; next_session_context?: string;
  file_type?: "pdf" | "epub"; has_page_labels?: boolean; page_labels?: Record<string, number | null>;
}
interface WikiStatus {
  hasFile: boolean; totalSessions: number; chunksProcessed: number; wikiExists: boolean; pagesCovered: number;
  outputLanguage?: Language; jobStatus?: "idle" | "running" | "failed" | "finished"; status?: string; jobError?: string | null;
}
type ReaderSession = {
  id?: string; title?: string; label?: string; summary?: string; page_start?: number; page_end?: number;
  page_label_start?: number | null; page_label_end?: number | null;
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
// Page rendering modes: PDF numbers are real pages; EPUBs that encode page
// numbers in their spine filenames expose real printed pages via page_label;
// ordinary EPUBs have no page info at all and must never show fabricated ones.
type PageMode = "pdf" | "epub_page" | "epub_chunk";
const resolvePageMode = (wiki: BookWikiData | null): PageMode =>
  !wiki ? "epub_chunk"
  : wiki.file_type === "pdf" ? "pdf"
  : wiki.has_page_labels ? "epub_page"
  : "epub_chunk";
// Range label. For epub_page use the real printed min–max across the units in
// range; pdf shows its own unit numbers; epub_chunk returns "" (omit).
const pageLabel = (start: number, end: number, language: GlossaryLanguage, mode: PageMode, labels?: Record<string, number | null>): string => {
  if (mode === "epub_chunk") return "";
  if (mode === "epub_page" && labels) {
    const nums = Object.entries(labels)
      .filter(([k, v]) => v != null && Number(k) >= start && Number(k) <= end)
      .map(([, v]) => v as number);
    if (!nums.length) return "";
    const s = Math.min(...nums); const e = Math.max(...nums);
    return `${language === "vi" ? "Trang" : "Pages"} ${s}${e !== s ? `–${e}` : ""}`;
  }
  const s = start; const e = end;
  return `${language === "vi" ? "Trang" : "Pages"} ${s}${e !== s ? `–${e}` : ""}`;
};
// Single-session range, preferring the server-computed real printed label.
const sessionPageLabel = (item: ReaderSession, language: GlossaryLanguage, mode: PageMode, labels?: Record<string, number | null>): string => {
  if (mode === "epub_chunk") return "";
  if (mode === "epub_page" && item.page_label_start != null) {
    const e = item.page_label_end ?? item.page_label_start;
    return `${language === "vi" ? "Trang" : "Pages"} ${item.page_label_start}${e !== item.page_label_start ? `–${e}` : ""}`;
  }
  if (item.page_start == null) return "";
  return pageLabel(item.page_start, item.page_end ?? item.page_start, language, mode, labels);
};
const sessionName = (item: ReaderSession, language: GlossaryLanguage, mode: PageMode, labels?: Record<string, number | null>) => {
  const title = nameOf(item);
  if (title && title !== "Reading session" && title !== "Untitled") return title;
  const range = sessionPageLabel(item, language, mode, labels);
  if (range) return `Session · ${range}`;
  return "Session";
};
const glossaryStatus = (value: string): GlossaryKey | null => {
  const normalized = properStatus(value);
  return (["Deepened", "Shifted", "Introduced", "Resolved", "Uncertain", "Implied"] as GlossaryKey[]).includes(normalized as GlossaryKey) ? normalized as GlossaryKey : null;
};

export default function BookWiki({ bookId, totalPages, canEdit, onOpenReadingSession }: { bookId: string; totalPages: number; canEdit: boolean; onOpenReadingSession: (logId: string) => void }) {
  const [wiki, setWiki] = useState<BookWikiData | null>(null);
  const [status, setStatus] = useState<WikiStatus | null>(null);
  const [sessions, setSessions] = useState<ReaderSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [openSession, setOpenSession] = useState<string | null>(null);
  const pointerScrollY = useRef<number | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  // Each local disclosure owns its own offset. A shared mutable ref lets an
  // earlier queued interaction clear a later interaction's saved position,
  // which can leave the browser's post-layout focus scroll uncorrected.

  const fetchReader = useCallback(async () => {
    try {
      const [nextStatus, wikiResult, nextSessions] = await Promise.all([
        req<WikiStatus>(`/api/books/${bookId}/wiki/status`),
        req<BookWikiData>(`/api/books/${bookId}/wiki`).catch((error: Error) => { if (error.message.startsWith("404:")) return null; throw error; }),
        req<ReaderSession[] | { sessions?: ReaderSession[] }>(`/api/books/${bookId}/wiki/sessions`).catch(() => null),
      ]);
      setRequestError(null); setWiki(wikiResult); setStatus(nextStatus);
      const rawSessions = Array.isArray(nextSessions) ? nextSessions : nextSessions?.sessions ?? null;
      setSessions(rawSessions?.map((row: any) => {
        const analysis = row?.chunk_analysis && typeof row.chunk_analysis === "object" ? row.chunk_analysis : row;
        return { ...analysis, id: row?.log_id || analysis?.id, page_start: row?.page_start ?? analysis?.page_start, page_end: row?.page_end ?? analysis?.page_end, page_label_start: row?.page_label_start ?? null, page_label_end: row?.page_label_end ?? null, title: analysis?.session_title || analysis?.title, summary: analysis?.close_reading || analysis?.session_summary || analysis?.chunk_summary || analysis?.summary } as ReaderSession;
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
  const languageMismatch = canEdit && status?.outputLanguage && status.outputLanguage !== "auto" && status.outputLanguage !== wiki?.output_language;
  const glossaryLanguage: GlossaryLanguage = resolveGlossaryLanguage(
    wiki?.output_language === "vi" || wiki?.output_language === "en" ? wiki.output_language : "auto",
    [wiki?.book_so_far, wiki?.overview, wiki?.current_reading_state?.summary].filter(Boolean).join(" "),
  );
  const pageMode = resolvePageMode(wiki);
  const pageLabels = wiki?.page_labels;
  const preserveScroll = (update: () => void) => {
    // Capture in this interaction's closure rather than a component-wide ref.
    // This is intentionally scoped to local disclosure state; Reading Map
    // session links still choose their own in-panel target via openSession.
    const saved = pointerScrollY.current ?? window.scrollY;
    pointerScrollY.current = null;
    update();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - saved) > 1) window.scrollTo({ top: saved, behavior: "auto" });
    }));
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-natural-sage" /></div>;
  if (requestError) return <div className="rounded-2xl border border-natural-clay/30 bg-natural-clay/10 p-5 text-center"><p className="text-xs font-semibold text-natural-dark">AI Reader is unavailable</p><p className="mt-1 text-[11px] text-natural-stone">{requestError}</p><button type="button" onClick={() => { setRequestError(null); setLoading(true); void fetchReader(); }} className="mt-4 min-h-11 rounded-full border border-natural-sage/40 px-4 text-xs font-bold text-natural-sage">Try again</button></div>;
  if (!status?.hasFile || status.totalSessions === 0) return <Empty message={!status?.hasFile ? "Upload a PDF or EPUB to enable the AI Reader." : "The AI Reader will begin after your first reading session."} />;
  if (!wiki) {
    const message = status?.jobError || (running ? "The owner is preparing this reading map. It will appear here when processing finishes." : canEdit ? "Your saved sessions will appear here when processing finishes." : "The owner has not generated a shared AI Reader map for this book yet.");
    return <div className="rounded-2xl border border-natural-border bg-natural-cream/40 p-5 text-center"><p className="text-xs font-semibold text-natural-dark">{running ? "AI Reader is reading" : canEdit ? "AI Reader is preparing" : "AI Reader is not available yet"}</p><p className="mt-1 text-[11px] text-natural-stone">{message}</p>{canEdit && <button type="button" onClick={refresh} disabled={running || regenerating} className="mt-4 min-h-11 rounded-full border border-natural-sage/40 px-4 text-xs font-bold text-natural-sage disabled:opacity-50">{running || regenerating ? "Running…" : "Run AI Reader now"}</button>}</div>;
  }

  return <div className="space-y-4" onPointerDownCapture={() => { pointerScrollY.current = window.scrollY; }}>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-natural-sage"><Brain className="h-4 w-4" />AI Reader</p><p className="mt-1 text-xs text-natural-stone">A grounded editorial map from saved reading sessions—not raw source text.</p></div>{canEdit && <button type="button" onClick={refresh} disabled={running || regenerating} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-natural-border px-3 text-[11px] font-bold text-natural-stone disabled:opacity-50">{running || regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}{running ? "Reading…" : "Refresh"}</button>}</header>
    {languageMismatch && <p className="rounded-xl bg-natural-clay/10 p-3 text-[11px] text-natural-clay">Vietnamese/source output settings changed. This map shows the last generated language; refresh to regenerate it.</p>}
    <section className="rounded-2xl border border-natural-border bg-natural-cream/45 p-4"><p className="text-xs leading-relaxed text-natural-dark">{wiki.book_so_far || wiki.overview}</p>{wiki.current_position?.label && <p className="mt-3 flex gap-1.5 text-[11px] text-natural-stone"><Sparkles className="h-3 w-3 shrink-0 text-natural-sage" />{wiki.current_position.label}</p>}</section>
    {wiki.current_reading_state?.summary && <section className="rounded-2xl border border-natural-sage/25 bg-natural-sage/5 p-4"><h2 className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">At this point</h2><p className="mt-2 text-xs leading-relaxed text-natural-dark">{wiki.current_reading_state.summary}</p>{wiki.next_session_context && <p className="mt-3 border-t border-natural-sage/15 pt-3 text-[11px] leading-relaxed text-natural-stone">Next session: {wiki.next_session_context}</p>}</section>}
    {(wiki.reading_path?.length || wiki.thread_map?.length || wiki.entity_map?.length || wiki.connections?.length) ? <ReadingMap wiki={wiki} totalPages={totalPages} status={status?.status || status?.jobStatus} language={glossaryLanguage} mode={pageMode} labels={pageLabels} onSession={onOpenReadingSession} openItem={openItem} setOpenItem={(value) => preserveScroll(() => setOpenItem(value))} /> : null}
    <section><h2 className="mb-2 text-xs font-bold text-natural-dark">Reading sessions</h2>{readerSessions.length ? <div className="space-y-2">{readerSessions.map((session, index) => { const key = session.id || `session-${index}`; const open = openSession === key; const entities = Array.isArray(session.entities) ? session.entities : []; const threads = Array.isArray(session.threads) ? session.threads : []; return <article key={key} className="overflow-hidden rounded-2xl border border-natural-border bg-white/55"><button type="button" onClick={() => preserveScroll(() => setOpenSession(open ? null : key))} aria-expanded={open} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left"><span><b className="text-xs text-natural-dark">{sessionName(session, glossaryLanguage, pageMode, pageLabels)}</b>{sessionPageLabel(session, glossaryLanguage, pageMode, pageLabels) && <small className="ml-2 text-[10px] text-natural-stone">{sessionPageLabel(session, glossaryLanguage, pageMode, pageLabels)}</small>}</span>{open ? <ChevronDown className="h-4 w-4 text-natural-sage" /> : <ChevronRight className="h-4 w-4 text-natural-stone" />}</button>{open && <div className="space-y-3 border-t border-natural-border px-4 py-3"><p className="text-[11px] leading-relaxed text-natural-stone">{text(session.summary) || "Session detail is not available yet."}</p><DrillGroup title="People & concepts" items={entities} itemKey={`${key}-entity`} language={glossaryLanguage} openItem={openItem} setOpenItem={(value) => preserveScroll(() => setOpenItem(value))} /><DrillGroup title="Threads to follow" items={threads} itemKey={`${key}-thread`} language={glossaryLanguage} openItem={openItem} setOpenItem={(value) => preserveScroll(() => setOpenItem(value))} /></div>}</article>; })}</div> : <p className="rounded-2xl border border-dashed border-natural-border p-4 text-center text-xs text-natural-stone">Session details are being prepared.</p>}</section>
    {!sessions && <V1References wiki={wiki} language={glossaryLanguage} preserveScroll={preserveScroll} />}
  </div>;
}
function ReadingMap({ wiki, totalPages, status, language, mode, labels, onSession, openItem, setOpenItem }: { wiki: BookWikiData; totalPages: number; status?: string; language: GlossaryLanguage; mode: PageMode; labels?: Record<string, number | null>; onSession: (id: string) => void; openItem: string | null; setOpenItem: (value: string | null) => void }) {
  const path = (wiki.reading_path || []).filter((entry) => entry.title || entry.summary).sort((a, b) => a.page_start - b.page_start);
  const pathIds = new Set(path.map((entry) => entry.log_id).filter(Boolean));
  const threads = (wiki.thread_map || []).filter((item) => item.label);
  const entities = (wiki.entity_map || []).filter((item) => item.name);
  const threadIds = new Set(threads.map((item) => item.id).filter(Boolean));
  const entityIds = new Set(entities.map((item) => item.id).filter(Boolean));
  const validRef = (type: MapConnection["from_type"], id: string) => Boolean(id) && (type === "session" ? pathIds.has(id) : type === "thread" ? threadIds.has(id) : entityIds.has(id));
  const connections = (wiki.connections || []).filter((item) => item.label && item.explanation && item.page_start > 0 && validRef(item.from_type, item.from_id) && validRef(item.to_type, item.to_id));
  const resolveName = (type: MapConnection["from_type"], id: string) => type === "session" ? path.find((item) => item.log_id === id)?.title : type === "thread" ? threads.find((item) => item.id === id)?.label : entities.find((item) => item.id === id)?.name;
  const covered = Math.max(0, wiki.pages_covered || 0);
  const complete = (totalPages > 0 && covered >= totalPages) || status === "finished";
  const unitWord = mode === "epub_chunk" ? (language === "vi" ? "chương" : "sections") : (language === "vi" ? "trang" : "pages");
  const coverageText = complete ? `Complete · all ${totalPages || covered} ${unitWord} covered` : totalPages > 0 ? `${covered} of ${totalPages} ${unitWord} covered` : `${covered} ${unitWord} covered`;
  const progress = totalPages > 0 ? Math.min(100, Math.round((covered / totalPages) * 100)) : 0;
  return <section className="space-y-5 rounded-2xl border border-natural-border bg-white/45 p-4 sm:p-5" aria-labelledby="reading-map-heading">
    <div className="rounded-2xl border border-natural-sage/20 bg-natural-sage/5 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">Reading Map</p><h2 id="reading-map-heading" className="mt-1 text-sm font-bold text-natural-dark">The book’s path, held in context</h2><p className="mt-1 text-[11px] leading-relaxed text-natural-stone">{complete ? "The map has reached the book’s ending; threads below show their recorded resolution." : (mode === "epub_chunk" ? `This is a partial map. It reflects only the ${language === "vi" ? "chương và phiên đọc" : "sections and sessions"} processed so far.` : `This is a partial map. It reflects only the ${language === "vi" ? "trang và phiên đọc" : "pages and sessions"} processed so far.`)}</p></div><span className="rounded-full bg-white/75 px-3 py-1 text-[10px] font-bold text-natural-sage">{complete ? "Resolved reading" : "In progress"}</span></div><div className="mt-4"><div className="mb-1 flex justify-between gap-3 text-[10px] text-natural-stone"><span>{coverageText}</span>{totalPages > 0 && <span>{progress}%</span>}</div>{totalPages > 0 && <div className="h-1.5 rounded-full bg-natural-border"><div className="h-full rounded-full bg-natural-sage" style={{ width: `${progress}%` }} /></div>}</div></div>
    {path.length > 0 && <div><div className="mb-2"><h3 className="text-xs font-bold text-natural-dark">Chronological path</h3><p className="mt-1 text-[11px] text-natural-stone">Open a card to return to its saved reading session.</p></div><ol className="grid gap-2 md:grid-cols-2">{path.map((entry, index) => <li key={entry.log_id || `${entry.page_start}-${index}`}><button type="button" onClick={() => entry.log_id && onSession(entry.log_id)} disabled={!entry.log_id} className="h-full min-h-28 w-full rounded-2xl border border-natural-border bg-natural-cream/55 p-3 text-left transition hover:border-natural-sage/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/50 disabled:cursor-default"><div className="flex items-start justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">{String(index + 1).padStart(2, "0")}</span><span className="text-[10px] font-semibold text-natural-stone">{pageLabel(entry.page_start, entry.page_end, language, mode, labels)}</span></div><h4 className="mt-2 text-xs font-bold text-natural-dark">{entry.title}</h4><p className="mt-1 text-[11px] leading-relaxed text-natural-stone">{entry.turning_point || entry.summary}</p></button></li>)}</ol></div>}
    {(threads.length > 0 || entities.length > 0) && <div className="grid gap-4 md:grid-cols-2"><MapEvidenceGroup title="Threads in motion" description="Each note is anchored to a point on the path." items={threads} itemKey="thread-map" language={language} mode={mode} labels={labels} openItem={openItem} setOpenItem={setOpenItem} onSession={onSession} evidenceKey="evolution" /><MapEvidenceGroup title="People, ideas & forces" description="States and appearances remain tied to recorded sessions." items={entities} itemKey="entity-map" language={language} mode={mode} labels={labels} openItem={openItem} setOpenItem={setOpenItem} onSession={onSession} evidenceKey="appearances" /></div>}
    {connections.length > 0 && <div className="border-t border-natural-border pt-4"><h3 className="text-xs font-bold text-natural-dark">Connections</h3><p className="mt-1 text-[11px] text-natural-stone">Relationships supported by the recorded map.</p><div className="mt-3 grid gap-2 md:grid-cols-2">{connections.map((connection, index) => { const from = resolveName(connection.from_type, connection.from_id); const to = resolveName(connection.to_type, connection.to_id); return <article key={`${connection.from_type}-${connection.from_id}-${connection.to_type}-${connection.to_id}-${index}`} className="rounded-2xl bg-natural-cream/60 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">{connection.label}</p><p className="mt-1 text-xs font-semibold text-natural-dark">{from} <span className="font-normal text-natural-stone">↔</span> {to}</p><p className="mt-2 text-[11px] leading-relaxed text-natural-stone">{connection.explanation}</p><p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-natural-sage"><GlossaryLabel term="Evidence" language={language} /> {pageLabel(connection.page_start, connection.page_start, language, mode, labels) && <span>· {pageLabel(connection.page_start, connection.page_start, language, mode, labels)}</span>}</p></article>; })}</div></div>}
  </section>;
}
function MapEvidenceGroup({ title, description, items, itemKey, language, mode, labels, openItem, setOpenItem, onSession, evidenceKey }: { title: string; description: string; items: Array<MapThread | MapEntity>; itemKey: string; language: GlossaryLanguage; mode: PageMode; labels?: Record<string, number | null>; openItem: string | null; setOpenItem: (value: string | null) => void; onSession: (id: string) => void; evidenceKey: "evolution" | "appearances" }) {
  return <div><h3 className="text-xs font-bold text-natural-dark">{title}</h3><p className="mt-1 text-[11px] text-natural-stone">{description}</p><div className="mt-2 space-y-2">{items.map((item, index) => {
    const key = `${itemKey}-${item.id || index}`;
    const open = openItem === key;
    const label = "label" in item ? item.label : item.name;
    const state = "status" in item ? properStatus(item.status || "") : (item as MapEntity).current_state;
    const stateTerm = glossaryStatus(state || "");
    const evidence = evidenceKey === "evolution" ? (item as MapThread).evolution || [] : (item as MapEntity).appearances || [];
    return <article key={key} className="overflow-hidden rounded-2xl bg-natural-cream/60">
      <button type="button" onClick={() => setOpenItem(open ? null : key)} aria-expanded={open} className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left"><span className="block text-xs font-semibold text-natural-dark">{label}</span>{open ? <ChevronDown className="h-4 w-4 shrink-0 text-natural-sage" /> : <ChevronRight className="h-4 w-4 shrink-0 text-natural-stone" />}</button>
      {state && <p className="px-3 pb-2 text-[10px] text-natural-sage">{stateTerm ? <GlossaryLabel term={stateTerm} language={language} /> : state}</p>}
      {open && <div className="space-y-2 border-t border-natural-border px-3 py-3">{evidence.length ? evidence.map((entry, evidenceIndex) => <button type="button" key={`${entry.log_id}-${evidenceIndex}`} onClick={() => entry.log_id && onSession(entry.log_id)} disabled={!entry.log_id} className="block w-full border-l-2 border-natural-sage/35 py-1 pl-2 text-left disabled:cursor-default">{pageLabel(entry.page_start, entry.page_start, language, mode, labels) ? <span className="text-[10px] font-bold text-natural-sage">{pageLabel(entry.page_start, entry.page_start, language, mode, labels)}</span> : null}<span className="ml-2 text-[11px] leading-relaxed text-natural-stone">{entry.note}</span></button>) : <p className="text-[11px] text-natural-stone">No path evidence is available yet.</p>}</div>}
    </article>;
  })}</div></div>;
}
function DetailText({ value }: { value: string }) { const parts = value.split(/((?:Trang|Pages) \d+(?:–\d+)?)/g); return <>{parts.map((part, index) => /^(?:Trang|Pages) \d+(?:–\d+)?$/.test(part) ? <strong key={index} className="font-bold text-natural-dark">{part}</strong> : part)}</>; }
function properStatus(value: string) { return value ? value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : ""; }
function DrillGroup({ title, items, itemKey, language, openItem, setOpenItem }: { title: string; items: Record<string, unknown>[]; itemKey: string; language: GlossaryLanguage; openItem: string | null; setOpenItem: (value: string | null) => void }) {
  if (!items.length) return null;
  return <div><h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-natural-sage">{title}</h3><div className="space-y-1">{items.map((item, index) => {
    const key = `${itemKey}-${item.id || index}`;
    const detail = text(item.description) || text(item.detail) || text(item.summary);
    const status = properStatus(text(item.status));
    const statusTerm = glossaryStatus(status);
    const open = openItem === key;
    return <div key={key} className="rounded-xl bg-natural-cream/60"><button type="button" onClick={() => setOpenItem(open ? null : key)} aria-expanded={open} className="w-full px-3 py-2 text-left"><span className="text-xs font-semibold text-natural-dark">{nameOf(item)}</span></button>{open && (detail || status) && <p className="px-3 pb-2 text-[11px] leading-relaxed text-natural-stone">{status && (statusTerm ? <GlossaryLabel term={statusTerm} language={language} /> : <strong className="font-bold text-natural-dark">{status}</strong>)}{status && detail ? " · " : null}{detail && <span className="whitespace-pre-line"><DetailText value={detail} /></span>}</p>}</div>;
  })}</div></div>;
}
function V1References({ wiki, language, preserveScroll }: { wiki: BookWikiData; language: GlossaryLanguage; preserveScroll: (update: () => void) => void }) { const [openItem, setOpenItem] = useState<string | null>(null); const items: ReaderEntity[] = [...wiki.concepts.map(x => ({ name: x.name, description: x.definition })), ...wiki.people.map(x => ({ name: x.name, description: x.pulse })), ...wiki.themes.map(x => ({ name: x.name, description: x.description }))]; return <section><h2 className="mb-2 text-xs font-bold text-natural-dark">Book references</h2><DrillGroup title="Concepts, people & themes" items={items} itemKey="v1" language={language} openItem={openItem} setOpenItem={(value) => preserveScroll(() => setOpenItem(value))} /></section>; }
function Empty({ message }: { message: string }) { return <div className="rounded-2xl border border-dashed border-natural-border p-5 text-center text-xs text-natural-stone">{message}</div>; }
