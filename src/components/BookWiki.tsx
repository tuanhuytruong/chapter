import { useState, useEffect, useCallback } from "react";
import { BookOpen, Brain, Lightbulb, Users, Map, Quote, HelpCircle, RefreshCw, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WikiConcept { name: string; definition: string; }
interface WikiTheme { name: string; description: string; }
interface WikiPerson { name: string; pulse: string; }
interface WikiChapterEntry { page_start: number; page_end: number; title: string; summary: string; }
interface WikiQuote { text: string; page_start: number; }

interface BookWikiData {
  book_id: string;
  pages_covered: number;
  overview: string;
  concepts: WikiConcept[];
  themes: WikiTheme[];
  people: WikiPerson[];
  chapter_map: WikiChapterEntry[];
  notable_quotes: WikiQuote[];
  open_questions: string[];
  generated_at: string;
  generation_ms: number | null;
}

interface WikiStatus {
  hasFile: boolean;
  totalSessions: number;
  chunksProcessed: number;
  lastRunAt: string | null;
  wikiExists: boolean;
  pagesCovered: number;
  wikiGeneratedAt: string | null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-natural-border bg-natural-cream/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-natural-sage">{icon}</span>
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ConceptPill({ name, definition }: WikiConcept) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(!open)}
      className="w-full rounded-xl border border-natural-border bg-white/60 px-3 py-2 text-left transition hover:border-natural-sage/40"
    >
      <span className="text-xs font-semibold text-natural-dark">{name}</span>
      {open && <p className="mt-1 text-[11px] leading-relaxed text-natural-stone">{definition}</p>}
    </button>
  );
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${msg.slice(0, 200)}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : {} as T) as T;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BookWiki({ bookId, totalPages, canEdit }: { bookId: string; totalPages: number; canEdit: boolean }) {
  const [wiki, setWiki] = useState<BookWikiData | null>(null);
  const [status, setStatus] = useState<WikiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const BASE = "/api/books";

  const fetchWiki = useCallback(async () => {
    try {
      const [wikiData, statusData] = await Promise.all([
        req<BookWikiData | null>(`${BASE}/${bookId}/wiki`).catch(() => null),
        req<WikiStatus | null>(`${BASE}/${bookId}/wiki/status`).catch(() => null),
      ]);
      setWiki(wikiData);
      setStatus(statusData);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    fetchWiki();
    return () => { if (pollInterval) clearInterval(pollInterval); };
  }, [fetchWiki]);

  // Poll every 15s while regenerating so UI updates when done
  useEffect(() => {
    if (regenerating) {
      const id = setInterval(async () => {
        await fetchWiki();
        // Stop polling once wiki appears or after 3 minutes
      }, 15_000);
      setPollInterval(id);
      const timeout = setTimeout(() => {
        clearInterval(id);
        setRegenerating(false);
      }, 180_000);
      return () => { clearInterval(id); clearTimeout(timeout); };
    } else {
      if (pollInterval) { clearInterval(pollInterval); setPollInterval(null); }
    }
  }, [regenerating]);

  // Stop regenerating spinner once wiki appears
  useEffect(() => {
    if (wiki && regenerating) setRegenerating(false);
  }, [wiki]);

  const handleRegenerate = async () => {
    if (!canEdit) return;
    setRegenerating(true);
    try {
      await req(`${BASE}/${bookId}/wiki/regenerate`, { method: "POST" });
    } catch {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-natural-sage" />
      </div>
    );
  }

  // No file uploaded
  if (status && !status.hasFile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-natural-sage" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">AI Reader</span>
        </div>
        <div className="rounded-2xl border border-dashed border-natural-border p-6 text-center">
          <BookOpen className="mx-auto mb-2 h-6 w-6 text-natural-stone/40" />
          <p className="text-xs text-natural-stone">Upload a PDF or EPUB to enable the AI Reader.</p>
        </div>
      </div>
    );
  }

  // No sessions logged yet
  if (status && status.totalSessions === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-natural-sage" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">AI Reader</span>
        </div>
        <div className="rounded-2xl border border-dashed border-natural-border p-6 text-center">
          <Brain className="mx-auto mb-2 h-6 w-6 text-natural-stone/40" />
          <p className="text-xs text-natural-stone">The AI Reader will start after your first reading session.</p>
        </div>
      </div>
    );
  }

  // Wiki not yet generated (sessions exist but batch hasn't run)
  if (!wiki) {
    const pct = status ? Math.round((status.chunksProcessed / Math.max(status.totalSessions, 1)) * 100) : 0;
    return (
      <div className="space-y-4">
        {/* Header always visible */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-natural-sage" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">AI Reader</span>
          </div>
          {canEdit && (
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-1.5 rounded-full border border-natural-border px-3 py-1 text-[10px] font-bold text-natural-stone transition hover:border-natural-sage/40 hover:text-natural-sage disabled:opacity-50"
            >
              {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {regenerating ? "Running…" : "Run AI Reader now"}
            </button>
          )}
        </div>
        <div className="rounded-2xl border border-natural-border bg-natural-cream/40 p-5 text-center">
          <Brain className="mx-auto mb-2 h-6 w-6 text-natural-sage/60" />
          <p className="text-xs font-semibold text-natural-dark">AI Reader is warming up</p>
          <p className="mt-1 text-[11px] text-natural-stone">
            {status?.chunksProcessed
              ? `Processed ${status.chunksProcessed} of ${status.totalSessions} sessions. Wiki synthesis coming soon.`
              : "The wiki will be ready after the nightly batch job runs."}
          </p>
          {pct > 0 && (
            <div className="mx-auto mt-3 h-1.5 max-w-xs rounded-full bg-natural-border">
              <div className="h-1.5 rounded-full bg-natural-sage transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        {canEdit && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-natural-sage/40 py-2.5 text-xs font-bold text-natural-sage transition hover:bg-natural-sage/10 disabled:opacity-50"
          >
            {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {regenerating ? "AI Reader is running…" : "Run AI Reader now"}
          </button>
        )}
      </div>
    );
  }

  // Wiki exists — render it
  const generatedDate = new Date(wiki.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const progressPct = totalPages > 0 ? Math.min(100, Math.round((wiki.pages_covered / totalPages) * 100)) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-natural-sage" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">AI Reader</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-natural-stone">Updated {generatedDate}</span>
          {canEdit && (
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-1.5 rounded-full border border-natural-border px-3 py-1 text-[10px] font-bold text-natural-stone transition hover:border-natural-sage/40 hover:text-natural-sage disabled:opacity-50"
            >
              {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {regenerating ? "Running…" : "Refresh"}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {totalPages > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-[10px] text-natural-stone">
            <span>AI has read p.1–{wiki.pages_covered}</span>
            <span>{progressPct}% of book</span>
          </div>
          <div className="h-1.5 rounded-full bg-natural-border">
            <div className="h-1.5 rounded-full bg-natural-sage/70 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Overview */}
      {wiki.overview && (
        <Section icon={<BookOpen className="h-4 w-4" />} title="Overview">
          <p className="text-xs leading-relaxed text-natural-dark">{wiki.overview}</p>
        </Section>
      )}

      {/* Concepts + Themes side by side on desktop */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {wiki.concepts.length > 0 && (
          <Section icon={<Lightbulb className="h-4 w-4" />} title={`Key Concepts · ${wiki.concepts.length}`}>
            <div className="space-y-1.5">
              {wiki.concepts.map((c, i) => <ConceptPill key={i} {...c} />)}
            </div>
          </Section>
        )}
        {wiki.themes.length > 0 && (
          <Section icon={<Brain className="h-4 w-4" />} title={`Themes · ${wiki.themes.length}`}>
            <ul className="space-y-2">
              {wiki.themes.map((t, i) => (
                <li key={i}>
                  <p className="text-xs font-semibold text-natural-dark">{t.name}</p>
                  {t.description && <p className="text-[11px] leading-relaxed text-natural-stone">{t.description}</p>}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {/* People */}
      {wiki.people.length > 0 && (
        <Section icon={<Users className="h-4 w-4" />} title={`People · ${wiki.people.length}`}>
          <div className="flex flex-wrap gap-2">
            {wiki.people.map((p, i) => (
              <div key={i} className="rounded-xl border border-natural-border bg-white/60 px-3 py-2">
                <p className="text-xs font-semibold text-natural-dark">{p.name}</p>
                {p.pulse && <p className="text-[11px] text-natural-stone">{p.pulse}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Chapter map */}
      {wiki.chapter_map.length > 0 && (
        <Section icon={<Map className="h-4 w-4" />} title="Chapter Map">
          <ul className="space-y-3">
            {wiki.chapter_map.map((c, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 shrink-0 rounded-md bg-natural-sage/10 px-1.5 py-0.5 text-[10px] font-bold text-natural-sage">
                  {c.page_start}–{c.page_end}
                </span>
                <div>
                  {c.title && <p className="text-xs font-semibold text-natural-dark">{c.title}</p>}
                  <p className="text-[11px] leading-relaxed text-natural-stone">{c.summary}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Notable quotes */}
      {wiki.notable_quotes.length > 0 && (
        <Section icon={<Quote className="h-4 w-4" />} title="Notable Quotes">
          <ul className="space-y-3">
            {wiki.notable_quotes.map((q, i) => (
              <li key={i} className="border-l-2 border-natural-sage/40 pl-3">
                <p className="text-xs italic leading-relaxed text-natural-dark">"{q.text}"</p>
                <p className="mt-0.5 text-[10px] text-natural-stone">p. {q.page_start}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Open questions */}
      {wiki.open_questions.length > 0 && (
        <Section icon={<HelpCircle className="h-4 w-4" />} title="Open Questions">
          <ul className="space-y-2">
            {wiki.open_questions.map((q, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-natural-dark">
                <span className="mt-0.5 text-natural-sage">?</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
