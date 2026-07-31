import React from "react";
import { BookHeart, CircleDot, UsersRound } from "lucide-react";
import type { LogRow, StoryThreadRow } from "../../types";

const statusTone: Record<StoryThreadRow["analysis"]["threads"][number]["status"], string> = {
  open: "bg-sky-100 text-sky-800",
  escalating: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
  uncertain: "bg-stone-100 text-stone-700",
};

function SessionStory({ item, log, canEdit, onRetry, retryingLogId }: { item: StoryThreadRow; log?: LogRow; canEdit: boolean; onRetry?: (logId: string) => Promise<void>; retryingLogId?: string | null }) {
  const analysis = item.analysis;
  return <article className="rounded-2xl border border-natural-border bg-natural-cream p-4 shadow-sm">
    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-natural-stone">
      <span>Reading session {log?.session ?? ""}</span>
      {log && <span>{log.page_start}–{log.page_end}</span>}
    </div>
    <p className="mt-2 text-sm leading-relaxed text-natural-dark">{analysis.storyRecap}</p>
    {analysis.changedEvents.length > 0 && <div className="mt-3 border-t border-natural-border pt-3">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">What changed</h4>
      <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-natural-dark">{analysis.changedEvents.map((event, index) => <li key={index}>• {event}</li>)}</ul>
    </div>}
    {analysis.readerMemory.length > 0 && <div className="mt-3 rounded-xl bg-natural-sage/10 p-3">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">What to remember</h4>
      <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-natural-dark">{analysis.readerMemory.map((memory, index) => <li key={index}>• {memory}</li>)}</ul>
    </div>}
    {analysis.confidenceNotes.length > 0 && <p className="mt-3 text-[10px] leading-relaxed text-natural-stone">{analysis.confidenceNotes.join(" · ")}</p>}
    {canEdit && onRetry && log && <button type="button" onClick={() => onRetry(log.id)} disabled={retryingLogId === log.id} className="mt-3 min-h-9 rounded-full px-3 text-[10px] font-bold uppercase tracking-wider text-natural-stone transition hover:bg-white disabled:opacity-50">{retryingLogId === log.id ? 'Refreshing…' : 'Retry recap'}</button>}
  </article>;
}

export default function StoryThreadView({ analyses, logs, onRetry, retryingLogId, canEdit = false }: { analyses: StoryThreadRow[]; logs: LogRow[]; onRetry?: (logId: string) => Promise<void>; retryingLogId?: string | null; canEdit?: boolean }) {
  const latest = analyses.at(-1);
  const analyzedLogIds = new Set(analyses.map((item) => item.log_id));
  // Book Detail keeps newest sessions first for browsing; repairs must always
  // begin with the earliest gap so later continuity is never built on a skip.
  const pendingLogs = logs.filter((log) => !analyzedLogIds.has(log.id)).sort((a, b) => `${a.date}-${a.session}`.localeCompare(`${b.date}-${b.session}`));
  if (!latest) return <section className="rounded-[24px] border border-dashed border-natural-border bg-natural-cream p-6 text-center">
    <BookHeart className="mx-auto h-7 w-7 text-natural-sage" />
    <h2 className="mt-3 text-base font-bold text-natural-dark">Your story companion is preparing</h2>
    <p className="mt-1 text-xs leading-relaxed text-natural-stone">After a reading session, this space will keep track of the story, its people, and the details worth carrying forward.</p>
    {canEdit && pendingLogs[0] && onRetry && <button onClick={() => onRetry(pendingLogs[0].id)} disabled={retryingLogId === pendingLogs[0].id} className="mt-4 min-h-11 rounded-full border border-natural-sage px-4 py-2 text-xs font-bold text-natural-sage disabled:opacity-50">{retryingLogId === pendingLogs[0].id ? 'Preparing…' : 'Try Story Thread again'}</button>}
  </section>;

  const state = latest.analysis;
  const logById = new Map(logs.map((log) => [log.id, log]));
  return <section className="space-y-4">
    <div className="rounded-[24px] border border-natural-sage/30 bg-natural-sage/5 p-4 shadow-sm sm:p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">Story so far</p>
      <p className="mt-2 text-sm leading-relaxed text-natural-dark">{state.storyRecap}</p>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-natural-border bg-natural-cream p-4 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-bold text-natural-dark"><CircleDot className="h-4 w-4 text-natural-sage" /> Threads in motion</h3>
        {state.threads.length ? <div className="mt-3 space-y-3">{state.threads.map((thread) => <div key={thread.id}><div className="flex flex-wrap items-center gap-2"><b className="text-xs text-natural-dark">{thread.label}</b><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusTone[thread.status]}`}>{thread.status}</span></div><p className="mt-1 text-xs leading-relaxed text-natural-stone">{thread.detail}</p></div>)}</div> : <p className="mt-2 text-xs text-natural-stone">No continuing threads have been identified yet.</p>}
      </section>
      <section className="rounded-2xl border border-natural-border bg-natural-cream p-4 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-bold text-natural-dark"><UsersRound className="h-4 w-4 text-natural-sage" /> Character pulse</h3>
        {state.characterPulse.length ? <div className="mt-3 space-y-3">{state.characterPulse.map((character) => <div key={character.name}><b className="text-xs text-natural-dark">{character.name}</b><p className="mt-1 text-xs leading-relaxed text-natural-stone">{character.pulse}</p></div>)}</div> : <p className="mt-2 text-xs text-natural-stone">Characters will appear here as their roles become clear.</p>}
      </section>
    </div>

    <section className="rounded-2xl border border-natural-border bg-natural-cream p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-bold text-natural-dark"><BookHeart className="h-4 w-4 text-natural-sage" /> What to remember</h3>
      {state.readerMemory.length ? <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-natural-dark">{state.readerMemory.map((memory, index) => <li key={index}>• {memory}</li>)}</ul> : <p className="mt-2 text-xs text-natural-stone">Your reader memory will gather the details that help you return to the story.</p>}
    </section>

    {canEdit && pendingLogs.length > 0 && onRetry && <section className="rounded-2xl border border-dashed border-natural-border p-4"><p className="text-xs text-natural-stone">Some saved sessions still need Story Thread analysis.</p><button onClick={() => onRetry(pendingLogs[0].id)} disabled={retryingLogId === pendingLogs[0].id} className="mt-3 min-h-11 rounded-full border border-natural-sage px-4 py-2 text-xs font-bold text-natural-sage disabled:opacity-50">{retryingLogId === pendingLogs[0].id ? 'Preparing…' : 'Prepare next session'}</button></section>}
    <section>
      <h3 className="mb-3 text-sm font-bold text-natural-dark">Reading sessions</h3>
      <div className="space-y-3">{[...analyses].reverse().map((item) => <div key={item.id}><SessionStory item={item} log={logById.get(item.log_id)} canEdit={canEdit} onRetry={onRetry} retryingLogId={retryingLogId} /></div>)}</div>
    </section>
  </section>;
}
