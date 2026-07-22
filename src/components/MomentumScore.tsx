import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { LogRow, BookRow } from '../types';

const APP_TZ = 'Asia/Bangkok';

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: APP_TZ });
}

function logDateToAppStr(raw: string): string {
  const s = String(raw);
  return s.includes('T')
    ? new Date(s).toLocaleDateString('en-CA', { timeZone: APP_TZ })
    : s.slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** Compute momentum score (0–100) */
function computeMomentum(book: BookRow, logs: LogRow[]): {
  score: number;
  consistency: number;   // 0–100
  velocity: number;      // 0–100
  intensity: number;     // 0–100 bonus
  trend: 'up' | 'down' | 'stable';
} {
  const now = todayStr();

  // ── 1. Consistency: pages read vs target over last 7 days ──
  const sevenAgo = now; // will compute properly below
  const dailyPages = Math.max(book.daily_pages, 1);

  // Pages per day for last 7 calendar days
  let totalPages7d = 0;
  let totalPages14d = 0;
  let multiSessionDays7d = 0;
  const uniqueDays7d = new Set<string>();
  const uniqueDays14d = new Set<string>();

  for (const l of logs) {
    const d = logDateToAppStr(String(l.date));
    const dist7 = daysBetween(d, now);
    const pages = Math.max(0, l.page_end - l.page_start + 1);

    if (dist7 >= 0 && dist7 < 7) {
      totalPages7d += pages;
      uniqueDays7d.add(d);
    }
    if (dist7 >= 0 && dist7 < 14) {
      totalPages14d += pages;
      uniqueDays14d.add(d);
    }
  }

  // Count multi-session days in the last 7 days
  const sessionCountByDay = new Map<string, number>();
  for (const l of logs) {
    const d = logDateToAppStr(String(l.date));
    const dist7 = daysBetween(d, now);
    if (dist7 >= 0 && dist7 < 7) {
      sessionCountByDay.set(d, (sessionCountByDay.get(d) || 0) + 1);
    }
  }
  multiSessionDays7d = [...sessionCountByDay.values()].filter(c => c > 1).length;

  const target7d = dailyPages * Math.max(uniqueDays7d.size, 1);
  const consistency = Math.min(100, Math.round((totalPages7d / target7d) * 100));

  // ── 2. Velocity: days read in last 7 vs. last 14 ──
  const days7 = uniqueDays7d.size;
  const days14 = uniqueDays14d.size;
  // Velocity ratio: recent engagement vs. broader window
  const recentRate = days7 / 7;
  const broaderRate = days14 / 14;
  const velocity = Math.min(100, Math.round((recentRate / Math.max(broaderRate, 0.01)) * 100));

  // ── 3. Intensity bonus: multi-session days ──
  const intensity = Math.min(20, multiSessionDays7d * 8); // 8 pts per multi-session day, max +20

  // ── Composite ──
  const rawScore = consistency * 0.55 + velocity * 0.3 + intensity;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Trend: compare recent 3 days vs 3 before that
  let recent3 = 0, prior3 = 0;
  for (const l of logs) {
    const d = logDateToAppStr(String(l.date));
    const dist = daysBetween(d, now);
    const pages = Math.max(0, l.page_end - l.page_start + 1);
    if (dist >= 0 && dist < 3) recent3 += pages;
    else if (dist >= 3 && dist < 6) prior3 += pages;
  }
  const trend: 'up' | 'down' | 'stable' =
    recent3 > prior3 * 1.2 ? 'up' :
    recent3 < prior3 * 0.8 ? 'down' : 'stable';

  return { score, consistency, velocity, intensity, trend };
}

/* ── SVG Arc ── */
function Arc({ score, size = 72 }: { score: number; size?: number }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;

  const color =
    score >= 80 ? '#7A9E7E' :   // natural-sage
    score >= 60 ? '#B8A45A' :   // gold
    score >= 40 ? '#C4785A' :   // natural-clay
                   '#C45A5A';   // red

  const bgColor = score >= 60 ? '#e8efe8' : '#f5ece8';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background ring */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={bgColor} strokeWidth={stroke}
      />
      {/* Filled arc */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
      {/* Score number */}
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        fontSize={size * 0.32} fontWeight={700}
        fill={color}
        fontFamily="ui-sans-serif,system-ui"
      >
        {score}
      </text>
    </svg>
  );
}

export default function MomentumScore({
  book,
  logs,
}: {
  book: BookRow;
  logs: LogRow[];
}) {
  const m = useMemo(() => computeMomentum(book, logs), [book, logs]);

  const TrendIcon = m.trend === 'up' ? TrendingUp :
                   m.trend === 'down' ? TrendingDown : Minus;
  const trendColor = m.trend === 'up' ? 'text-natural-sage' :
                     m.trend === 'down' ? 'text-natural-clay' : 'text-natural-stone';
  const trendLabel = m.trend === 'up' ? 'On fire! 🔥' :
                     m.trend === 'down' ? 'Slipping' : 'Steady';

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-natural-cream/60 border border-natural-border rounded-2xl">
      <Arc score={m.score} size={64} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-natural-dark font-sans">Momentum</span>
          <TrendIcon className={`w-3 h-3 ${trendColor}`} />
          <span className={`text-[9px] font-sans ${trendColor}`}>{trendLabel}</span>
        </div>
        <div className="flex gap-3 text-[9px] text-natural-stone font-sans mt-0.5">
          <span>Consistency <b className="text-natural-dark">{m.consistency}%</b></span>
          <span>Velocity <b className="text-natural-dark">{m.velocity}%</b></span>
        </div>
      </div>
    </div>
  );
}
