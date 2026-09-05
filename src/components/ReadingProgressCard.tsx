import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Route,
  Info,
} from "lucide-react";
import type {
  ReadingProgressCompanionRow,
  ReadingProgressItem,
} from "../types";

function Refs({
  item,
  onOpen,
}: {
  item: ReadingProgressItem;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {item.refs.map((ref, index) => (
        <button
          key={`${ref.logId}-${index}`}
          type="button"
          onClick={() => onOpen(ref.logId)}
          className="min-h-11 rounded-full border border-natural-border bg-white px-3 text-xs font-semibold text-natural-sage hover:bg-natural-sage/10"
        >
          Session {ref.session} · p. {ref.pageStart}–{ref.pageEnd}
        </button>
      ))}
    </div>
  );
}
const GLOSSARY = {
  "Story so far": { en: "The main story and where it stands in the pages you have read.", vi: "Mạch chính và trạng thái của câu chuyện trong những trang bạn đã đọc." },
  "Narrative arcs": { en: "How a character, relationship, place, or theme has developed so far.", vi: "Cách một nhân vật, mối quan hệ, bối cảnh hoặc chủ đề đã phát triển đến đây." },
  "Threads at this point": { en: "Questions or tensions that are open, changing, or resolved in the pages you have read.", vi: "Những câu hỏi hoặc căng thẳng đang mở, thay đổi hay đã khép lại trong phần bạn đã đọc." },
  "Turning points": { en: "Events that changed the stakes, direction, or relationships.", vi: "Những sự kiện đã thay đổi cục diện, hướng đi hoặc các mối quan hệ." },
} as const;
type GlossaryTitle = keyof typeof GLOSSARY;
function Section({ title, items, onOpen, language }: { title: GlossaryTitle; items: ReadingProgressItem[]; onOpen: (id: string) => void; language: "vi" | "en" }) {
  if (!items.length) return null;
  const tooltipId = `companion-help-${title.replace(/\s/g, "-")}`;
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">{title}</h3>
        {GLOSSARY[title] && (
          <span className="group relative inline-flex">
            <button type="button" aria-label={`${language === "vi" ? "Thông tin về" : "About"} ${title}`} aria-describedby={tooltipId} className="rounded p-1 text-natural-stone hover:text-natural-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/45">
              <Info className="h-3.5 w-3.5" />
            </button>
            <span id={tooltipId} role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-lg border border-natural-border bg-white px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed text-natural-stone opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              {GLOSSARY[title][language]}
            </span>
          </span>
        )}
      </div>
      <div className="mt-2 space-y-3">
        {items.map((item, index) => (
          <div key={index}>
            <div className="flex items-start gap-2">
              <p className="flex-1 text-sm leading-relaxed text-natural-dark">{item.text}</p>
              {item.status && <span className="mt-0.5 rounded-full border border-natural-border bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-natural-sage">{item.status}</span>}
            </div>
            <Refs item={item} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </div>
  );
}
export default function ReadingProgressCard({
  companion,
  readingRound,
  logCount,
  hasRawText,
  canEdit,
  bookStatus,
  loading,
  onRefresh,
  onOpenReadingSession,
}: {
  companion: ReadingProgressCompanionRow | null;
  readingRound: number;
  logCount: number;
  hasRawText: boolean;
  canEdit: boolean;
  bookStatus: string;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onOpenReadingSession: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!logCount) return null;
  const paused = bookStatus !== "active";
  const action = companion ? "Refresh reading thread" : "Create reading thread";
  const refresh = async () => {
    try {
      await onRefresh();
      setExpanded(true);
    } catch {
      // The page owns the toast. Keep the prior disclosure state/content intact.
    }
  };
  return (
    <section
      id="reading-progress-companion"
      className="mb-5 scroll-mt-5 rounded-[24px] border border-natural-sage/30 bg-natural-sage/5 p-4 shadow-sm sm:p-5"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-natural-sage">
            <Route className="h-3.5 w-3.5" /> Reading companion · Round{" "}
            {readingRound}
          </p>
          <h2 className="mt-1 text-base font-bold text-natural-dark">
            {companion ? (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls="reading-progress-content"
                aria-label={`${expanded ? "Collapse" : "Expand"} your reading so far`}
                onClick={() => setExpanded((value) => !value)}
                className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-left hover:text-natural-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/45"
              >
                {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                <span>Your reading so far</span>
              </button>
            ) : "Your reading so far"}
          </h2>
          {companion && <p className="mt-1 text-xs leading-relaxed text-natural-stone">{companion.stale ? `Updated through Session ${companion.last_log_session ?? "?"}; new saved sessions are not yet included.` : `Updated through Session ${companion.last_log_session ?? "?"} · ${companion.sessions_covered} saved sessions included.`}</p>}
          {!companion && canEdit && (
            <p className="mt-1 text-xs leading-relaxed text-natural-stone">
              Create a grounded thread from your saved reading text.
            </p>
          )}
        </div>
        {canEdit && hasRawText && (
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || paused}
            title={
              paused
                ? "Resume this book to refresh its reading thread."
                : undefined
            }
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-natural-sage px-4 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {loading ? "Creating…" : action}
          </button>
        )}
      </div>
      {!companion && canEdit && !hasRawText && (
        <p className="mt-3 text-xs text-natural-stone">
          This companion becomes available after a saved session includes source
          text.
        </p>
      )}
      {!companion && !canEdit && hasRawText && (
        <p className="mt-3 text-xs text-natural-stone">
          A reading thread will appear once the book owner creates it.
        </p>
      )}
      {companion && expanded && (
        <div
          id="reading-progress-content"
          className="mt-2 space-y-4 rounded-2xl border border-natural-border bg-natural-cream/70 p-4"
        >
          <Section title="Story so far" items={[companion.main_thread]} onOpen={onOpenReadingSession} language={companion.output_language} />
          <Section title="Narrative arcs" items={companion.converging} onOpen={onOpenReadingSession} language={companion.output_language} />
          <Section title="Threads at this point" items={companion.open_threads} onOpen={onOpenReadingSession} language={companion.output_language} />
          <Section title="Turning points" items={companion.carry_forward} onOpen={onOpenReadingSession} language={companion.output_language} />
        </div>
      )}
    </section>
  );
}
