import React, { useMemo } from 'react';
import type { LogRow } from '../types';

interface ArcLog {
  pct: number;       // position in book as 0-100
  pages: number;     // pages read in this session
  label: string;     // short date label
  id: string;
}

/** Compute a bezier arc path through N points, returning SVG path d string */
function smoothArc(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const { x, y } = points[0];
    return `M${x},${y} L${x},${y}`;
  }

  // Catmull-Rom to cubic bezier
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const tension = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export default function ChapterArc({
  logs,
  totalPages,
}: {
  logs: LogRow[];
  totalPages: number;
}) {
  const arcData = useMemo(() => {
    if (totalPages <= 0 || logs.length === 0) return null;

    // Build ordered points
    const sorted = [...logs]
      .filter(l => l.page_end > 0)
      .sort((a, b) => {
        const da = String(a.date) + String(a.session ?? '0').padStart(3, '0');
        const db = String(b.date) + String(b.session ?? '0').padStart(3, '0');
        return da.localeCompare(db);
      });

    const points: ArcLog[] = sorted.map((l, i, arr) => {
      // Position within book: average page as percentage
      const midPage = (l.page_start + l.page_end) / 2;
      const pct = Math.min(100, Math.max(0, (midPage / totalPages) * 100));
      const pages = Math.max(1, l.page_end - l.page_start);
      return { pct, pages, label: String(l.date).slice(0, 10), id: l.id };
    });

    if (points.length < 2) return null;

    // Map to SVG coords: x = pct, y = arc intensity (higher=more intense, peaks mid-book)
    const w = 100;
    const h = 40;
    const midX = 50;

    const svgPoints = points.map(p => {
      // Arc shape: peaks around 40-60% of book, lower at edges
      // Use sin curve to create the arc: sin(x * PI) where x is 0-1
      const normalized = p.pct / 100;
      const arcHeight = Math.sin(normalized * Math.PI); // 0 → 1 → 0
      // Scale: arcHeight gives y position (0 = bottom, 1 = top-ish)
      const y = h - 4 - (arcHeight * (h - 10));
      const x = (p.pct / 100) * w;
      return { x, y, size: Math.max(3, Math.min(10, 3 + (p.pages / 30) * 7)), ...p };
    });

    // Mid-book reference
    const midBook = svgPoints.reduce((best, p) =>
      Math.abs(p.pct - 50) < Math.abs(best.pct - 50) ? p : best, svgPoints[0]);

    return { svgPoints, w, h, midBook, path: smoothArc(svgPoints) };
  }, [logs, totalPages]);

  if (!arcData) return null;

  const { svgPoints, w, h, midBook, path } = arcData;

  return (
    <div className="space-y-1.5">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto overflow-visible"
        preserveAspectRatio="none"
      >
        {/* Gradient fill under curve */}
        <defs>
          <linearGradient id="arc-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7A9E7E" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#7A9E7E" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Baseline */}
        <line x1={0} y1={h - 2} x2={w} y2={h - 2} stroke="#e5e0d8" strokeWidth="0.5" />

        {/* Area under curve */}
        <path
          d={`${path} L${w},${h - 2} L0,${h - 2} Z`}
          fill="url(#arc-gradient)"
        />

        {/* Smooth arc line */}
        <path
          d={path}
          fill="none"
          stroke="#7A9E7E"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-sm"
        />

        {/* Dots */}
        {svgPoints.map((p) => (
          <g key={p.id}>
            <circle
              cx={p.x} cy={p.y} r={p.size / 2}
              fill={p.pct >= 45 && p.pct <= 55 ? '#C4785A' : '#7A9E7E'}
              opacity={0.85}
              className="transition-all duration-300"
            />
            <circle
              cx={p.x} cy={p.y} r={p.size / 2 + 1.5}
              fill="none"
              stroke={p.pct >= 45 && p.pct <= 55 ? '#C4785A' : '#7A9E7E'}
              strokeWidth="0.5"
              opacity={0.4}
            />
          </g>
        ))}
      </svg>

      {/* Labels */}
      <div className="flex justify-between text-[8px] text-natural-stone font-sans">
        <span>Start</span>
        <span className="text-natural-clay font-semibold">Midway</span>
        <span>End</span>
      </div>
      <p className="text-[9px] text-natural-muted font-sans text-center italic">
        {svgPoints.length} session{svgPoints.length > 1 ? 's' : ''} · dots sized by pages read
      </p>
    </div>
  );
}
