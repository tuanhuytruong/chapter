import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Quote, FileText } from 'lucide-react';
import type { LogRow } from '../types';

const DaySummary: React.FC<{ log: LogRow }> = ({ log }) => {
  const [open, setOpen] = useState(false);
  // log.date is already a 'YYYY-MM-DD' string (Asia/Bangkok / UTC+7 app tz).
  // Format it for display in the same timezone so it never appears off-by-one.
  const rawStr = log.date instanceof Date ? log.date.toISOString().slice(0, 10) : String(log.date);
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
          <pre className="text-[10px] text-natural-muted font-sans whitespace-pre-wrap max-h-48 overflow-y-auto bg-natural-cream rounded-xl p-3">{log.raw_text}</pre>
        </div>
      )}
    </div>
  );
};

export default DaySummary;
