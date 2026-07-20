import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Quote, FileText } from 'lucide-react';
import type { LogRow } from '../types';

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

const DaySummary: React.FC<{ log: LogRow }> = ({ log }) => {
  const [open, setOpen] = useState(false);
  // log.date is a 'YYYY-MM-DD' string (Asia/Bangkok / UTC+7 app tz). Normalize
  // defensively: some server builds serialize DATE as an ISO datetime string or
  // a JS Date, so always take the first 10 chars. Format in Asia/Bangkok so it
  // never shows off-by-one or "Invalid Date".
  const rawStr = String(log.date).slice(0, 10);
  const date = new Date(rawStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });

  return (
    <div className="bg-white border border-natural-border rounded-2xl p-4 shadow-sm space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-natural-dark font-sans">{date}</span>
          <span className="text-[10px] text-natural-stone font-sans bg-natural-cream px-2 py-0.5 rounded-full">Pages {log.page_start}–{log.page_end}</span>
          {log.telegram_sent && <span className="text-[10px] text-blue-600 font-sans">📨 Sent</span>}
        </div>
        {log.raw_text && (
          <button onClick={() => setOpen(o => !o)} className="text-natural-stone hover:text-natural-dark">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {log.summary && <p className="text-xs text-natural-dark font-sans leading-relaxed">{log.summary}</p>}

      {log.key_insights && log.key_insights.length > 0 && (
        <ul className="space-y-1">
          {log.key_insights.map((ins, i) => (
            <li key={i} className="flex gap-1.5 text-[11px] text-natural-muted font-sans">
              <span className="text-natural-sage mt-0.5">•</span>{ins}
            </li>
          ))}
        </ul>
      )}

      {log.quote && (
        <p className="flex gap-1.5 text-[11px] italic text-natural-stone font-sans border-l-2 border-natural-clay pl-2">
          <Quote className="w-3 h-3 shrink-0 mt-0.5" />{log.quote}
        </p>
      )}

      {open && log.raw_text && (
        <div className="pt-2 border-t border-natural-border">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-natural-stone font-sans mb-1"><FileText className="w-3 h-3" /> Raw extracted text</p>
          <pre className="text-[11px] leading-relaxed text-natural-muted font-sans whitespace-pre-wrap break-words max-h-56 overflow-y-auto bg-natural-cream rounded-xl p-3">{formatRawText(log.raw_text)}</pre>
        </div>
      )}
    </div>
  );
};

export default DaySummary;
