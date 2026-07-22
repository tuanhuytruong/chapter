import React, { useMemo, useState, useCallback } from 'react';
import { Download, Share2, Sparkles, Loader2 } from 'lucide-react';
import type { BookRow, LogRow } from '../types';

const APP_TZ = 'Asia/Bangkok';

function logDateToAppStr(raw: string): string {
  const s = String(raw);
  return s.includes('T')
    ? new Date(s).toLocaleDateString('en-CA', { timeZone: APP_TZ })
    : s.slice(0, 10);
}

/** Extract top recurring phrases from key_insights */
function topInsights(logs: LogRow[], topN = 5): { text: string; count: number }[] {
  const freq = new Map<string, number>();
  for (const l of logs) {
    for (const ins of l.key_insights || []) {
      const key = ins.charAt(0).toUpperCase() + ins.slice(1);
      freq.set(key, (freq.get(key) || 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([text, count]) => ({ text, count }));
}

export default function ReadingDNA({
  books,
  logsByBook,
}: {
  books: BookRow[];
  logsByBook: Record<string, LogRow[]>;
}) {
  const [generating, setGenerating] = useState(false);
  const [svgUrl, setSvgUrl] = useState<string | null>(null);

  const dna = useMemo(() => {
    const allLogs = Object.values(logsByBook).flat();
    const finished = books.filter(b => b.status === 'finished');
    const totalPages = allLogs.reduce((s, l) => s + Math.max(0, l.page_end - l.page_start), 0);
    const totalSessions = allLogs.length;

    // All quotes across all books
    const quotes = allLogs.filter(l => l.quote).map(l => l.quote!);
    const topQuote = quotes.length > 0
      ? quotes.sort((a, b) => b.length - a.length)[0]
      : null;

    // Top insights
    const top = topInsights(allLogs, 5);

    // Days read
    const uniqueDays = new Set(allLogs.map(l => logDateToAppStr(String(l.date))));
    const daysRead = uniqueDays.size;

    // Year range
    const dates = [...uniqueDays].sort();
    const yearRange = dates.length >= 2
      ? `${dates[0].slice(0, 4)}–${dates[dates.length - 1].slice(0, 4)}`
      : new Date().getFullYear().toString();

    // Monthly heatmap data (simple)
    const monthCount = new Map<string, number>();
    for (const d of dates) {
      const m = d.slice(0, 7); // YYYY-MM
      monthCount.set(m, (monthCount.get(m) || 0) + 1);
    }

    return {
      finished,
      totalPages,
      totalSessions,
      topQuote,
      topInsights: top,
      daysRead,
      yearRange,
      monthCount: [...monthCount.entries()].sort(([a], [b]) => a.localeCompare(b)),
      totalBooks: books.length,
    };
  }, [books, logsByBook]);

  const generateCard = useCallback(async () => {
    setGenerating(true);
    try {
      // Build SVG entirely inline
      const svg = buildDNASvg(dna);
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      setSvgUrl(url);
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }, [dna]);

  const download = useCallback(() => {
    if (!svgUrl) return;
    const a = document.createElement('a');
    a.href = svgUrl;
    a.download = `reading-dna-${dna.yearRange}.svg`;
    a.click();
  }, [svgUrl, dna]);

  return (
    <div className="bg-natural-cream border border-natural-border rounded-[24px] p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-natural-dark font-sans flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-natural-sage" /> Reading DNA
        </h3>
        <button
          onClick={generateCard}
          disabled={generating || dna.daysRead === 0}
          className="px-4 py-2 bg-natural-sage hover:bg-natural-sage-dark disabled:opacity-50 text-white rounded-full text-xs font-bold font-sans uppercase tracking-wider shadow-sm cursor-pointer"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Generate Card'}
        </button>
      </div>

      {/* Preview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Books" value={dna.finished.length} subtitle={`of ${dna.totalBooks}`} />
        <StatBox label="Pages" value={dna.totalPages.toLocaleString()} />
        <StatBox label="Sessions" value={dna.totalSessions} />
        <StatBox label="Days Read" value={dna.daysRead} />
      </div>

      {dna.topInsights.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dna.topInsights.map((ins, i) => (
            <span key={i}
              className="text-[10px] px-2.5 py-1 rounded-full bg-natural-sage/15 text-natural-sage font-sans font-medium"
            >
              {ins.text} ×{ins.count}
            </span>
          ))}
        </div>
      )}

      {dna.topQuote && (
        <div className="text-xs italic text-natural-clay font-serif leading-relaxed border-l-2 border-natural-clay/30 pl-3">
          &ldquo;{dna.topQuote.slice(0, 120)}{dna.topQuote.length > 120 ? '…' : ''}&rdquo;
        </div>
      )}

      {/* Annual heatmap mini */}
      {dna.monthCount.length > 0 && (
        <div className="flex gap-1">
          {dna.monthCount.map(([month, count]) => {
            const intensity = Math.min(1, count / 10);
            return (
              <div key={month} className="flex-1 text-center">
                <div
                  className="h-8 rounded-md mb-1"
                  style={{
                    backgroundColor: `rgba(122, 158, 126, ${0.15 + intensity * 0.7})`,
                  }}
                  title={`${month}: ${count} day${count > 1 ? 's' : ''}`}
                />
                <span className="text-[7px] text-natural-stone font-sans">{month.slice(5, 7)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Generated card */}
      {svgUrl && (
        <div className="space-y-3 pt-2">
          <img src={svgUrl} alt="Reading DNA Card" className="w-full rounded-2xl border border-natural-border" />
          <button
            onClick={download}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-natural-dark text-natural-cream rounded-full text-xs font-bold font-sans uppercase tracking-wider hover:opacity-90 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Download SVG
          </button>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, subtitle }: { label: string; value: string | number; subtitle?: string }) {
  return (
    <div className="bg-natural-cream/60 border border-natural-border rounded-xl px-3 py-2.5 text-center">
      <p className="text-lg font-bold text-natural-dark font-sans leading-none">{value}</p>
      <p className="text-[9px] text-natural-stone font-sans uppercase tracking-wider mt-1">{label}</p>
      {subtitle && <p className="text-[8px] text-natural-stone/60 font-sans">{subtitle}</p>}
    </div>
  );
}

/** Build a rich SVG card string */
function buildDNASvg(dna: any): string {
  const booksLabel = dna.finished.length > 0
    ? `${dna.finished.length} books finished · ${dna.totalBooks} in library`
    : `${dna.totalBooks} books in library`;

  const themeColors = [
    '#7A9E7E', // sage
    '#C4785A', // clay
    '#B8A45A', // gold
    '#8B9DAF', // slate
    '#A8A07A', // olive
  ];

  const insBlock = dna.topInsights.length > 0
    ? `<text x="400" y="320" text-anchor="middle" font-family="Georgia,serif" font-size="22" font-weight="bold" fill="#3D3028">Top Insights</text>
       ${dna.topInsights.slice(0, 5).map((ins: any, i: number) =>
         `<text x="400" y="${350 + i * 28}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${16 - i * 0.5}" fill="${themeColors[i % themeColors.length]}">${ins.text}  ×${ins.count}</text>`
       ).join('')}`
    : '';

  const quoteBlock = dna.topQuote
    ? `<text x="400" y="510" text-anchor="middle" font-family="Georgia,serif" font-size="18" font-style="italic" fill="#C4785A">
  <tspan>“${dna.topQuote.slice(0, 80)}”</tspan>
</text>`
    : '';

  const monthBars = dna.monthCount.map(([month, count]: [string, number]) => {
    const intensity = Math.min(1, count / 10);
    const alpha = 0.15 + intensity * 0.7;
    const barH = 30 + count * 5;
    return `<rect x="${0}" y="${0}" width="36" height="${Math.min(80, barH)}" rx="4" fill="rgba(122,158,126,${alpha})" />`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F8F6F1"/>
      <stop offset="100%" stop-color="#EDE8DC"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7A9E7E"/>
      <stop offset="100%" stop-color="#C4785A"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="800" height="600" rx="20" fill="url(#bg)"/>

  <!-- Decorative top line -->
  <rect x="0" y="0" width="800" height="4" fill="url(#accent)"/>

  <!-- Title -->
  <text x="400" y="70" text-anchor="middle" font-family="Georgia,serif" font-size="36" font-weight="bold" fill="#3D3028">My Reading DNA</text>
  <text x="400" y="100" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" fill="#a09890">${dna.yearRange} · ${booksLabel}</text>

  <!-- Stats row -->
  <g transform="translate(160, 150)">
    <rect x="0" y="0" width="100" height="60" rx="10" fill="white" opacity="0.6"/>
    <text x="50" y="25" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="bold" fill="#3D3028">${dna.totalPages}</text>
    <text x="50" y="45" text-anchor="middle" font-family="system-ui" font-size="10" fill="#a09890">PAGES</text>
  </g>
  <g transform="translate(300, 150)">
    <rect x="0" y="0" width="100" height="60" rx="10" fill="white" opacity="0.6"/>
    <text x="50" y="25" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="bold" fill="#3D3028">${dna.totalSessions}</text>
    <text x="50" y="45" text-anchor="middle" font-family="system-ui" font-size="10" fill="#a09890">SESSIONS</text>
  </g>
  <g transform="translate(440, 150)">
    <rect x="0" y="0" width="100" height="60" rx="10" fill="white" opacity="0.6"/>
    <text x="50" y="25" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="bold" fill="#3D3028">${dna.daysRead}</text>
    <text x="50" y="45" text-anchor="middle" font-family="system-ui" font-size="10" fill="#a09890">DAYS READ</text>
  </g>
  <g transform="translate(580, 150)">
    <rect x="0" y="0" width="100" height="60" rx="10" fill="white" opacity="0.6"/>
    <text x="50" y="25" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="bold" fill="#3D3028">${dna.finished.length}</text>
    <text x="50" y="45" text-anchor="middle" font-family="system-ui" font-size="10" fill="#a09890">FINISHED</text>
  </g>

  <!-- Monthly activity -->
  <text x="400" y="260" text-anchor="middle" font-family="Georgia,serif" font-size="18" font-weight="bold" fill="#3D3028">Reading Rhythm</text>
  <g transform="translate(${120}, 280)">
    ${monthBars}
  </g>

  <!-- Insights -->
  ${insBlock}

  <!-- Quote -->
  ${quoteBlock}

  <!-- Footer -->
  <text x="400" y="570" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#c8c2ba">Generated by Chapter — AI Reading Companion</text>
</svg>`;
}
