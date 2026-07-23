import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Quote, FileText, StickyNote, Share2 } from 'lucide-react';
import type { LogRow } from '../types';
import { api } from '../api';
import ShareSummaryModal from './ShareSummaryModal';

// Light cleanup of raw PDF/EPUB-extracted text for display: collapse runs of
// whitespace, drop blank lines, and keep paragraph breaks so the preview is
// readable. We don't alter wording — this only normalizes spacing.
function formatRawText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, i, arr) => !(line === "" && (i === 0 || arr[i - 1] === "")))
    .join("\n")
    .trim();
}

interface DaySummaryProps {
  log: LogRow;
  bookTitle?: string;
  bookAuthor?: string;
  bookId?: string;
  canEdit?: boolean;
  highlight?: string;
}

/** Highlight search matches in text */
function HighlightText({ text, query }: { text: string; query: string }) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return <>{text}</>;
  const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === normalizedQuery.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 text-natural-dark rounded">{part}</mark>
          : part
      )}
    </>
  );
}

const DaySummary: React.FC<DaySummaryProps> = ({ log, bookTitle, bookAuthor, bookId, canEdit = false, highlight }) => {
  const [open, setOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notesText, setNotesText] = useState(() => log.notes || '');
  const [saving, setSaving] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Auto-save on blur
  const saveNotes = useCallback(async (text: string) => {
    setSaving(true);
    try {
      await api.updateLogNotes(log.book_id, log.id, text);
    } catch {
      // silent — the toast system could show this but we keep it subtle
    } finally {
      setSaving(false);
    }
  }, [log.book_id, log.id]);

  // log.date is a YYYY-MM-DD string or ISO datetime (e.g. "2026-07-20T17:00:00.000Z"
  // when pg serializes a DATE as a UTC timestamp). Pass the raw string to Date()
  // directly — toLocaleDateString with timeZone: "Asia/Bangkok" then correctly
  // converts to the app's calendar day regardless of the wire format.
  const date = new Date(String(log.date)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });

  return (
    <div className="bg-natural-cream border border-natural-border rounded-2xl p-4 shadow-sm space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-natural-dark font-sans">{date}</span>
          <span className="text-[10px] text-natural-stone font-sans bg-natural-cream px-2 py-0.5 rounded-full">Session {log.session}</span>
          {log.chapter_title ? (
            <span className="text-[10px] text-natural-sage font-sans bg-natural-cream px-2 py-0.5 rounded-full max-w-[200px] truncate" title={log.chapter_title}>
              📑 {log.chapter_title}
            </span>
          ) : (
            <span className="text-[10px] text-natural-stone font-sans bg-natural-cream px-2 py-0.5 rounded-full">Pages {log.page_start}–{log.page_end}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {canEdit && bookTitle && bookId && log.summary && (
            <button onClick={() => setShowShare(true)} className="text-natural-stone hover:text-natural-sage cursor-pointer" title="Share to community">
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}
          {log.raw_text && (
            <button onClick={() => setOpen(o => !o)} className="text-natural-stone hover:text-natural-dark">
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {log.summary && <p className="text-xs text-natural-dark font-sans leading-relaxed">{highlight ? <HighlightText text={log.summary} query={highlight} /> : log.summary}</p>}

      {log.key_insights && log.key_insights.length > 0 && (
        <ul className="space-y-1">
          {log.key_insights.map((ins, i) => (
            <li key={i} className="flex gap-1.5 text-[11px] text-natural-muted font-sans">
              <span className="text-natural-sage mt-0.5">•</span>{highlight ? <HighlightText text={ins} query={highlight} /> : ins}
            </li>
          ))}
        </ul>
      )}

      {log.quote && (
        <p className="flex gap-1.5 text-[11px] italic text-natural-stone font-sans border-l-2 border-natural-clay pl-2">
          <Quote className="w-3 h-3 shrink-0 mt-0.5" />{highlight ? <HighlightText text={log.quote} query={highlight} /> : log.quote}
        </p>
      )}

      {/* Personal notes are editable only by the book owner. */}
      {canEdit && <div>
        <button
          onClick={() => setShowNotes(s => !s)}
          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-natural-stone hover:text-natural-dark font-sans"
        >
          <StickyNote className="w-3 h-3" /> Notes{log.notes ? ' *' : ''}{saving ? ' …' : ''}
        </button>
        {showNotes && (
          <textarea
            value={notesText}
            onChange={e => setNotesText(e.target.value)}
            onBlur={e => saveNotes(e.target.value)}
            rows={3}
            className="w-full mt-1 px-3 py-2 text-xs font-sans leading-relaxed bg-natural-cream/50 border border-natural-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-natural-sage placeholder:text-natural-stone/50"
            placeholder="Write your own notes about today's reading…"
          />
        )}
      </div>}

      {open && log.raw_text && (
        <div className="pt-2 border-t border-natural-border">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-natural-stone font-sans mb-1"><FileText className="w-3 h-3" /> Raw extracted text</p>
          <pre className="text-[11px] leading-relaxed text-natural-muted font-sans whitespace-pre-wrap break-words max-h-56 overflow-y-auto bg-natural-cream rounded-xl p-3">{formatRawText(log.raw_text)}</pre>
        </div>
      )}

      {showShare && bookTitle && bookAuthor && bookId && (
        <ShareSummaryModal
          log={log}
          bookTitle={bookTitle}
          bookAuthor={bookAuthor}
          bookId={bookId}
          onClose={() => setShowShare(false)}
          onShared={() => {}}
        />
      )}
    </div>
  );
};

export default DaySummary;
