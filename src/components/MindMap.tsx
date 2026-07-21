import React, { useState } from 'react';

export interface MindMapData {
  root: string;
  branches: { theme: string; color: string; nodes: string[] }[];
}

export default function MindMap({ data, bookTitle }: { data: MindMapData; bookTitle: string }) {
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const cx = 400, cy = 300, r1 = 130, r2 = 240;
  const angleStep = (2 * Math.PI) / data.branches.length;

  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 800 600" className="w-full max-w-2xl mx-auto">
        {/* Connection lines */}
        {data.branches.map((branch, i) => {
          const angle = angleStep * i - Math.PI / 2;
          const x1 = cx + r1 * 0.3 * Math.cos(angle);
          const y1 = cy + r1 * 0.3 * Math.sin(angle);
          const x2 = cx + r1 * Math.cos(angle);
          const y2 = cy + r1 * Math.sin(angle);
          return (
            <line key={`l1-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={branch.color} strokeWidth="2" opacity={highlighted === null || highlighted === i ? 1 : 0.2} />
          );
        })}
        {/* Branch to leaves */}
        {data.branches.map((branch, i) => {
          const angle = angleStep * i - Math.PI / 2;
          const cx1 = cx + r1 * Math.cos(angle);
          const cy1 = cy + r1 * Math.sin(angle);
          const dx = (r2 - r1) * Math.cos(angle);
          const dy = (r2 - r1) * Math.sin(angle);
          return branch.nodes.map((_, ni) => {
            const t = (ni + 1) / (branch.nodes.length + 1);
            return (
              <line key={`l2-${i}-${ni}`}
                x1={cx1 + dx * t * 0.3} y1={cy1 + dy * t * 0.3}
                x2={cx1 + dx * t} y2={cy1 + dy * t}
                stroke={branch.color} strokeWidth="1" strokeDasharray="3 3"
                opacity={highlighted === null || highlighted === i ? 0.6 : 0.1} />
            );
          });
        })}
        {/* Centre node */}
        <circle cx={cx} cy={cy} r="50" fill="var(--color-natural-cream)" stroke="var(--color-natural-sage)" strokeWidth="2" />
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="11" fill="var(--color-natural-dark)" className="font-bold">{bookTitle}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="var(--color-natural-muted)">Thesis</text>

        {/* Branch nodes */}
        {data.branches.map((branch, i) => {
          const angle = angleStep * i - Math.PI / 2;
          const x = cx + r1 * Math.cos(angle);
          const y = cy + r1 * Math.sin(angle);
          return (
            <g key={`b-${i}`} onClick={() => setHighlighted(highlighted === i ? null : i)} className="cursor-pointer">
              <circle cx={x} cy={y} r="24" fill={branch.color} opacity="0.9" stroke="white" strokeWidth="1.5" />
              <text x={x} y={y + 2} textAnchor="middle" fontSize="7" fill="white" className="font-bold">{branch.theme}</text>
            </g>
          );
        })}

        {/* Leaf nodes */}
        {data.branches.map((branch, i) => {
          const angle = angleStep * i - Math.PI / 2;
          const cx1 = cx + r1 * Math.cos(angle);
          const cy1 = cy + r1 * Math.sin(angle);
          const dx = (r2 - r1) * Math.cos(angle);
          const dy = (r2 - r1) * Math.sin(angle);
          return branch.nodes.map((node, ni) => {
            const t = (ni + 1) / (branch.nodes.length + 1);
            const x = cx1 + dx * t;
            const y = cy1 + dy * t;
            const maxW = 100;
            const words = node.split(' ');
            const lines: string[] = [];
            let line = '';
            for (const w of words) {
              if ((line + ' ' + w).length > 18) { lines.push(line); line = w; }
              else line = line ? line + ' ' + w : w;
            }
            if (line) lines.push(line);
            return (
              <g key={`n-${i}-${ni}`}>
                <foreignObject x={x - maxW / 2} y={y - 12} width={maxW} height={40}>
                  <div className="text-[8px] text-natural-dark font-sans text-center leading-tight">{node}</div>
                </foreignObject>
              </g>
            );
          });
        })}
      </svg>
    </div>
  );
}
