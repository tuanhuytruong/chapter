import React from "react";
import { Bookmark, Lightbulb, MessageCircleQuestion, Quote, RotateCcw, Trash2 } from "lucide-react";
import type { ReadingMarkerRow } from "../types";

const KIND = {
  idea: { label: "Idea", Icon: Lightbulb },
  question: { label: "Question", Icon: MessageCircleQuestion },
  quote: { label: "Quote", Icon: Quote },
  return_to: { label: "Return to", Icon: RotateCcw },
} as const;

export default function ReadingMarkers({ markers, canEdit, onDelete, onGoToSession }: {
  markers: ReadingMarkerRow[];
  canEdit: boolean;
  onDelete: (id: string) => void;
  onGoToSession: (logId: string) => void;
}) {
  if (!canEdit || !markers.length) return null;
  return <section className="rounded-2xl border border-natural-border bg-natural-cream p-4 shadow-sm" aria-label="Private markers">
    <div className="flex items-center gap-2"><Bookmark className="h-4 w-4 text-natural-clay" /><h2 className="text-sm font-bold text-natural-dark">Markers</h2><span className="text-xs text-natural-stone">Private · {markers.length}</span></div>
    <div className="mt-3 space-y-2">
      {markers.map((marker) => {
        const item = KIND[marker.kind]; const Icon = item.Icon;
        return <div key={marker.id} className="flex items-start gap-2 rounded-xl bg-natural-bg/50 p-2.5 text-xs">
          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-natural-clay" aria-hidden="true" />
          <div className="min-w-0 flex-1"><p className="font-bold text-natural-dark">{item.label} <span className="font-normal text-natural-stone">· Session {marker.session} · {marker.position_label}</span></p>{marker.note && <p className="mt-0.5 whitespace-pre-wrap text-natural-stone">{marker.note}</p>}</div>
          <button type="button" onClick={() => onGoToSession(marker.log_id)} className="text-natural-sage underline">Go</button>
          <button type="button" onClick={() => onDelete(marker.id)} aria-label={`Delete ${item.label} marker`} className="text-natural-stone hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>;
      })}
    </div>
  </section>;
}
