import { useCallback, useEffect, useState } from "react";
import { Headphones, Loader2, RefreshCw, X } from "lucide-react";
import { api, type PodcastCatalogBook, type PodcastChapter, type PodcastEpisode } from "../api";

type PodcastApi = typeof api & {
  getBookPodcast: (bookId: string) => Promise<PodcastCatalogBook>;
  regeneratePodcast: (episodeId: string) => Promise<PodcastEpisode>;
};

type PodcastPanelProps = {
  bookId: string;
  canEdit: boolean;
  isEpub: boolean;
  onClose?: () => void;
};

const podcastApi = api as PodcastApi;
const pendingStatuses = new Set(["queued", "scripting", "synthesizing", "archiving"]);
const isReady = (episode: PodcastEpisode | null) =>
  episode?.status === "ready" || episode?.status === "archive_pending";
const duration = (seconds: number | null) =>
  seconds ? `${Math.max(1, Math.round(seconds / 60))} min` : null;

export default function PodcastPanel({ bookId, canEdit, isEpub, onClose }: PodcastPanelProps) {
  const [book, setBook] = useState<PodcastCatalogBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [voiceTarget, setVoiceTarget] = useState<PodcastChapter | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<PodcastEpisode | null>(null);

  const refresh = useCallback(async () => {
    try {
      setBook(await podcastApi.getBookPodcast(bookId));
    } catch {
      setBook(null);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!book?.chapters.some(({ episode }) => episode && pendingStatuses.has(episode.status))) return;
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [book, refresh]);

  const create = async (chapter: PodcastChapter, gender?: "female" | "male") => {
    setWorkingKey(chapter.chapter_key);
    try {
      await podcastApi.createPodcast(bookId, chapter.chapter_key, gender);
      setVoiceTarget(null);
      await refresh();
    } catch {
      // Keep the panel calm: a later refresh will reflect any accepted request.
      await refresh();
    } finally {
      setWorkingKey(null);
    }
  };

  const regenerate = async () => {
    if (!regenerateTarget) return;
    setWorkingKey(regenerateTarget.id);
    try {
      await podcastApi.regeneratePodcast(regenerateTarget.id);
      setRegenerateTarget(null);
      await refresh();
    } catch {
      await refresh();
    } finally {
      setWorkingKey(null);
    }
  };

  if (!isEpub) return null;

  return <section className="rounded-[24px] border border-natural-border bg-natural-cream p-4 shadow-sm sm:p-5" aria-label="Chapter podcasts">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">Listen</p>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-bold text-natural-dark"><Headphones className="h-5 w-5" /> Chapter podcasts</h2>
        <p className="mt-1 text-sm leading-5 text-natural-stone">Listen to complete chapters at your own pace.</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button type="button" onClick={() => void refresh()} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-natural-stone transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/40" aria-label="Refresh episodes"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
        {onClose && <button type="button" onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-natural-stone transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/40" aria-label="Close podcasts"><X className="h-4 w-4" /></button>}
      </div>
    </div>

    {voiceTarget && <div className="mt-4 rounded-2xl border border-natural-sage/25 bg-natural-sage/10 p-4">
      <p className="text-sm font-bold text-natural-dark">Choose your narrator once</p>
      <p className="mt-1 text-xs leading-5 text-natural-stone">Your choice will be used for future chapter episodes.</p>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void create(voiceTarget, "female")} className="min-h-11 rounded-full bg-natural-sage px-4 text-xs font-bold text-white">Female voice</button><button type="button" onClick={() => void create(voiceTarget, "male")} className="min-h-11 rounded-full border border-natural-border bg-white px-4 text-xs font-bold text-natural-dark">Male voice</button></div>
    </div>}

    {regenerateTarget && <div className="mt-4 rounded-2xl border border-natural-border bg-white/70 p-4">
      <p className="text-sm font-bold text-natural-dark">Regenerate this episode?</p>
      <p className="mt-1 text-xs leading-5 text-natural-stone">The current recording will be replaced when the new one is ready.</p>
      <div className="mt-3 flex gap-2"><button type="button" onClick={() => void regenerate()} disabled={workingKey === regenerateTarget.id} className="min-h-11 rounded-full bg-natural-sage px-4 text-xs font-bold text-white disabled:opacity-60">{workingKey === regenerateTarget.id ? "Starting…" : "Regenerate"}</button><button type="button" onClick={() => setRegenerateTarget(null)} className="min-h-11 rounded-full px-4 text-xs font-bold text-natural-stone">Keep current</button></div>
    </div>}

    <div className="mt-4 divide-y divide-natural-border/80">
      {loading && !book ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-natural-sage" /></div> : book?.chapters.map((chapter, index) => <div key={chapter.chapter_key}><ChapterRow chapter={chapter} number={index + 1} canEdit={canEdit} working={workingKey === chapter.chapter_key || workingKey === chapter.episode?.id} onCreate={() => chapter.episode ? setRegenerateTarget(chapter.episode) : setVoiceTarget(chapter)} onRegenerate={() => chapter.episode && setRegenerateTarget(chapter.episode)} /></div>) || <p className="py-6 text-center text-sm text-natural-stone">Episodes are not available for this book yet.</p>}
    </div>
  </section>;
}

function ChapterRow({ chapter, number, canEdit, working, onCreate, onRegenerate }: { chapter: PodcastChapter; number: number; canEdit: boolean; working: boolean; onCreate: () => void; onRegenerate: () => void }) {
  const episode = chapter.episode;
  const running = !!episode && pendingStatuses.has(episode.status);
  const ready = isReady(episode);
  const label = chapter.chapter_title || `Chapter ${number}`;

  return <article className="py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h3 className="text-sm font-bold text-natural-dark">{label}</h3><p className="mt-0.5 text-[11px] text-natural-stone">Sections {chapter.start_unit}–{chapter.end_unit}{ready && duration(episode?.duration_s || null) ? ` · ${duration(episode?.duration_s || null)}` : ""}</p></div>{canEdit && !ready && <button type="button" onClick={onCreate} disabled={working || running} className="min-h-11 shrink-0 rounded-full border border-natural-border bg-white px-4 text-xs font-bold text-natural-dark disabled:opacity-60">{working || running ? "Preparing…" : episode?.status === "failed" ? "Try again" : "Create"}</button>}{canEdit && ready && <button type="button" onClick={onRegenerate} className="min-h-11 shrink-0 rounded-full px-4 text-xs font-bold text-natural-stone transition hover:bg-white">Regenerate</button>}</div>{running && <p className="mt-2 text-xs text-natural-stone">Preparing this chapter episode…</p>}{ready && <div className="mt-3"><audio className="w-full" controls preload="metadata" src={`/api/podcasts/${episode?.id}/audio`} /><details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-natural-stone">Read transcript</summary><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-natural-dark">{episode?.script_text}</p></details></div>}{!canEdit && !ready && <p className="mt-2 text-xs text-natural-stone">This episode is not available yet.</p>}</article>;
}
