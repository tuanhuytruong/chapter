import React from 'react';
import type { BookRow, LogRow } from '../types';
import { readingUnit } from '../readingUnits';

export default function ChapterMarkers({
  book,
  logs,
}: {
  book: BookRow;
  logs: LogRow[];
}) {
  const { total_pages, current_page } = book;
  const unit = readingUnit(book.file_type, 1);
  if (total_pages <= 0) return null;

  // Merge overlapping/sorted ranges
  const ranges: { start: number; end: number }[] = [];
  const sorted = [...logs]
    .map(l => ({ start: Math.max(1, l.page_start), end: Math.min(total_pages, l.page_end) }))
    .filter(r => r.start <= r.end)
    .sort((a, b) => a.start - b.start);

  for (const r of sorted) {
    if (ranges.length > 0 && r.start <= ranges[ranges.length - 1].end + 1) {
      ranges[ranges.length - 1].end = Math.max(ranges[ranges.length - 1].end, r.end);
    } else {
      ranges.push({ ...r });
    }
  }

  const readPct = Math.round((current_page / total_pages) * 100);

  // Generate ruler segments: small fixed-size marks for visual density
  const SEGMENTS = 80; // number of ruler ticks
  const pagesPerSegment = total_pages / SEGMENTS;

  const segments = Array.from({ length: SEGMENTS }, (_, i) => {
    const segStart = Math.floor(i * pagesPerSegment) + 1;
    const segEnd = Math.floor((i + 1) * pagesPerSegment);
    const isRead = ranges.some(r => r.start <= segEnd && r.end >= segStart);
    return isRead;
  });

  const currentSeg = Math.floor((current_page / total_pages) * SEGMENTS);

  return (
    <div className="space-y-1.5">
      {/* Ruler */}
      <div className="relative h-6 flex items-center">
        <div className="flex-1 h-4 rounded-full overflow-hidden flex bg-natural-cream border border-natural-border/50">
          {segments.map((filled, i) => (
            <div
              key={i}
              className={`h-full flex-1 transition-colors ${
                filled
                  ? 'bg-natural-sage/50'
                  : 'bg-transparent'
              } ${i > 0 ? 'border-l border-natural-border/20' : ''}`}
            />
          ))}
        </div>
        {/* Current position marker */}
        <div
          className="absolute top-0 bottom-0 flex items-center justify-center transition-all"
          style={{ left: `${Math.min(100, Math.max(0, (current_page / total_pages) * 100))}%` }}
        >
          <div className="w-0.5 h-6 bg-natural-clay rounded-full shadow-sm" />
          <div className="absolute -bottom-3.5 w-2 h-2 bg-natural-clay rotate-45" />
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[9px] text-natural-stone font-sans">
        <span>{unit} 1</span>
        <span className="text-natural-clay font-semibold">{readPct}% · {unit} {current_page}</span>
        <span>{unit} {total_pages}</span>
      </div>

    </div>
  );
}
