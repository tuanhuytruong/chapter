import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Headphones, Loader2, Play, RefreshCw, RotateCcw, X } from "lucide-react";
import { api, type PodcastCatalogBook, type PodcastChapter, type PodcastEpisode, type RhythmResponse } from "../api";
import PodcastPlaylistPlayer from "./PodcastPlaylistPlayer";

type PodcastApi = typeof api & {
  getBookPodcast: (bookId: string) => Promise<PodcastCatalogBook>;
  regeneratePodcast: (episodeId: string) => Promise<PodcastEpisode>;
  setBookNarrator: (
    bookId: string,
    voiceGender: "female" | "male",
    force?: boolean,
  ) => Promise<{ ok: boolean; episodes_deleted: number }>;
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
  const [narratorModal, setNarratorModal] = useState(false);
  const [confirmChange, setConfirmChange] = useState(false);
  const [pendingGender, setPendingGender] = useState<"female" | "male" | null>(null);
  const [changingNarrator, setChangingNarrator] = useState(false);
  const [playRequest, setPlayRequest] = useState<{ bookId: string; episodeId: string } | null>(null);
  const [podcastRefreshKey, setPodcastRefreshKey] = useState(0);
  const [rhythm, setRhythm] = useState<RhythmResponse | null>(null);

  const refresh = useCallback(async () => {
    // The playlist catalog is the critical payload; the rhythm feed (used for
    // the "Đã nghe X/Y" counters) is auxiliary. Fetch independently so a rhythm
    // failure cannot blank the whole panel.
    try {
      setBook(await podcastApi.getBookPodcast(bookId));
    } catch {
      setBook(null);
    } finally {
      setLoading(false);
    }
    try {
      setRhythm(await podcastApi.getRhythm());
    } catch {
      setRhythm(null);
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
      setPodcastRefreshKey((key) => key + 1);
    } catch (error: any) {
      // Restore the chapter state and give the reader a concrete response.
      await refresh();
      window.alert(error?.message || "Podcast could not be started. Please try again.");
    } finally {
      setWorkingKey(null);
    }
  };

  // The playlist player asks for a narrator when its "Generate & play next" CTA
  // fires on a round that has not picked a voice yet — reuse the panel picker.
  const handleNeedVoice = (chapterKey: string) => {
    const chapter = book?.chapters.find((item) => item.chapter_key === chapterKey);
    if (chapter) setVoiceTarget(chapter);
  };

  const regenerate = async () => {
    if (!regenerateTarget) return;
    setWorkingKey(regenerateTarget.id);
    try {
      await podcastApi.regeneratePodcast(regenerateTarget.id);
      setRegenerateTarget(null);
      await refresh();
    } catch (error: any) {
      await refresh();
      window.alert(error?.message || "Podcast could not be regenerated. Please try again.");
    } finally {
      setWorkingKey(null);
    }
  };

  const closeNarratorModal = () => {
    setNarratorModal(false);
    setConfirmChange(false);
    setPendingGender(null);
  };

  // Switch the round's narrator voice. If the round already has episodes the
  // modal first asks for explicit confirmation (force=true on the API), which
  // deletes them so everything is re-generated with the new voice.
  const changeNarrator = async (gender: "female" | "male", force: boolean) => {
    setChangingNarrator(true);
    try {
      await podcastApi.setBookNarrator(bookId, gender, force);
      closeNarratorModal();
      await refresh();
      setPodcastRefreshKey((key) => key + 1);
    } catch (error: any) {
      window.alert(error?.message || "Narrator could not be changed. Please try again.");
    } finally {
      setChangingNarrator(false);
    }
  };

  if (!isEpub) return null;

  const bookRhythm = rhythm?.books.find((item) => item.book_id === bookId) ?? null;
  const readyEpisodeCount = book?.chapters.filter(({ episode }) => isReady(episode)).length ?? 0;

  return <>
    <section className="rounded-[24px] border border-natural-border bg-natural-cream p-4 shadow-sm sm:p-5" aria-label="Chapter podcasts">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">Listen</p>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-bold text-natural-dark"><Headphones className="h-5 w-5" /> Chapter podcasts</h2>
        <p className="mt-1 text-sm leading-5 text-natural-stone">Listen to complete chapters at your own pace.</p>
        {book?.narrator_gender ? (
          <button
            type="button"
            onClick={() => setNarratorModal(true)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-natural-border bg-white px-3 py-1 text-xs font-bold text-natural-dark transition hover:border-natural-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/40"
            title="Change narrator voice for this round"
          >
            <Headphones className="h-3.5 w-3.5 text-natural-sage" />
            Narrator · Round {book.reading_round}: {book.narrator_gender === "female" ? "Female" : "Male"}
          </button>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-1">
        <button type="button" onClick={() => void refresh()} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-natural-stone transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/40" aria-label="Refresh episodes"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
        {onClose && <button type="button" onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-natural-stone transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/40" aria-label="Close podcasts"><X className="h-4 w-4" /></button>}
      </div>
    </div>

    {bookRhythm ? (
      <div className="mt-3">
        <div className="flex items-center justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold text-natural-dark"><Headphones className="h-3.5 w-3.5 text-natural-sage" /> Đã nghe {bookRhythm.episodes_listened}/{bookRhythm.episodes_total || bookRhythm.episodes_listened} episodes</p>
          {bookRhythm.episodes_total > 0 && bookRhythm.episodes_listened >= bookRhythm.episodes_total && (<span className="rounded-full bg-natural-sage/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-natural-sage">Trọn sách</span>)}
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-natural-border/60">
          <div className="h-full rounded-full bg-natural-sage transition-all duration-500" style={{ width: `${Math.min(100, Math.round((bookRhythm.episodes_total ? bookRhythm.episodes_listened / bookRhythm.episodes_total : bookRhythm.episodes_listened > 0 ? 1 : 0) * 100))}%` }} />
        </div>
      </div>
    ) : null}

    <PodcastPlaylistPlayer bookId={bookId} playRequest={playRequest} onPlayed={() => setPlayRequest(null)} onNeedVoice={handleNeedVoice} refreshKey={podcastRefreshKey} onEpisodeCreated={() => { void refresh(); setPodcastRefreshKey((key) => key + 1); }} onListened={() => { window.setTimeout(() => void refresh(), 500); }} />
    <div className="mt-4 divide-y divide-natural-border/80">
      {loading && !book ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-natural-sage" /></div> : book?.chapters.map((chapter, index) => <div key={chapter.chapter_key}><ChapterRow chapter={chapter} number={index + 1} canEdit={canEdit} working={workingKey === chapter.chapter_key || workingKey === chapter.episode?.id} onPlay={() => chapter.episode && isReady(chapter.episode) && setPlayRequest({ bookId, episodeId: chapter.episode.id })} onCreate={() => chapter.episode ? setRegenerateTarget(chapter.episode) : (book?.narrator_gender ? void create(chapter) : setVoiceTarget(chapter))} onRegenerate={() => chapter.episode && setRegenerateTarget(chapter.episode)} /></div>) || <p className="py-6 text-center text-sm text-natural-stone">Episodes are not available for this book yet.</p>}
    </div>
    </section>
    {(voiceTarget || regenerateTarget || narratorModal) && createPortal(
      <div data-swipe-nav-ignore className="fixed inset-0 z-[100] flex items-end justify-center bg-natural-dark/35 p-4 backdrop-blur-[1px] sm:items-center" role="presentation" onClick={() => { setVoiceTarget(null); setRegenerateTarget(null); closeNarratorModal(); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="podcast-action-title" className="w-full max-w-md rounded-[24px] border border-natural-border bg-natural-cream p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
          {narratorModal ? <>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">Podcast narrator · Round {book?.reading_round ?? 1}</p>
            <h2 id="podcast-action-title" className="mt-1 text-base font-bold text-natural-dark">Change narrator voice</h2>
            <p className="mt-2 text-sm leading-6 text-natural-stone">Current voice: {book?.narrator_gender === "female" ? "Female" : "Male"}. Your choice applies to every episode of reading round {book?.reading_round ?? 1}.</p>
            {confirmChange ? (
              <div className="mt-5 rounded-2xl border border-natural-clay/30 bg-natural-clay/10 p-4">
                <p className="text-sm font-bold leading-6 text-natural-clay">Delete {readyEpisodeCount} {readyEpisodeCount === 1 ? "episode" : "episodes"} &amp; switch to {pendingGender === "female" ? "Female" : "Male"}?</p>
                <p className="mt-1 text-xs leading-5 text-natural-stone">All podcasts of this round will be removed and you will generate again from chapter 1 with the new voice. Your listening streak days are kept.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void changeNarrator(pendingGender ?? "female", true)} disabled={changingNarrator} className="min-h-11 rounded-full bg-natural-clay px-4 text-xs font-bold text-white transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-clay/45 disabled:opacity-60">{changingNarrator ? "Changing…" : "Confirm — delete &amp; recreate"}</button>
                  <button type="button" onClick={() => setConfirmChange(false)} disabled={changingNarrator} className="min-h-11 px-3 text-xs font-bold text-natural-stone">Keep current voice</button>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => readyEpisodeCount > 0 ? (setPendingGender("female"), setConfirmChange(true)) : void changeNarrator("female", false)} disabled={changingNarrator} className="flex min-h-24 flex-col items-start justify-between rounded-2xl border border-teal-700/25 bg-teal-50 p-4 text-left text-teal-950 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:bg-teal-100 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/45 disabled:opacity-60"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-teal-700/30 bg-white text-teal-700"><Check className="h-3.5 w-3.5" /></span><span><span className="block text-sm font-bold">Female</span><span className="text-xs text-teal-800/75">Warm sage tone</span></span></button>
                <button type="button" onClick={() => readyEpisodeCount > 0 ? (setPendingGender("male"), setConfirmChange(true)) : void changeNarrator("male", false)} disabled={changingNarrator} className="flex min-h-24 flex-col items-start justify-between rounded-2xl border border-slate-600/25 bg-slate-100 p-4 text-left text-slate-900 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:bg-slate-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600/45 disabled:opacity-60"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-600/30 bg-white text-slate-700"><Check className="h-3.5 w-3.5" /></span><span><span className="block text-sm font-bold">Male</span><span className="text-xs text-slate-600">Clear neutral tone</span></span></button>
              </div>
            )}
          </> : voiceTarget ? <>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">Podcast narrator · Round {book?.reading_round ?? 1}</p>
            <h2 id="podcast-action-title" className="mt-1 text-base font-bold text-natural-dark">Choose this round&apos;s narrator</h2>
            <p className="mt-2 text-sm leading-6 text-natural-stone">Your choice applies to every episode of this book in reading round {book?.reading_round ?? 1}. A future re-read round can pick a different narrator.</p>
            <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={() => void create(voiceTarget, "female")} disabled={workingKey === voiceTarget.chapter_key} className="flex min-h-24 flex-col items-start justify-between rounded-2xl border border-teal-700/25 bg-teal-50 p-4 text-left text-teal-950 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:bg-teal-100 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/45 disabled:opacity-60"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-teal-700/30 bg-white text-teal-700"><Check className="h-3.5 w-3.5" /></span><span><span className="block text-sm font-bold">Female</span><span className="text-xs text-teal-800/75">Warm sage tone</span></span></button><button type="button" onClick={() => void create(voiceTarget, "male")} disabled={workingKey === voiceTarget.chapter_key} className="flex min-h-24 flex-col items-start justify-between rounded-2xl border border-slate-600/25 bg-slate-100 p-4 text-left text-slate-900 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:bg-slate-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600/45 disabled:opacity-60"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-600/30 bg-white text-slate-700"><Check className="h-3.5 w-3.5" /></span><span><span className="block text-sm font-bold">Male</span><span className="text-xs text-slate-600">Clear neutral tone</span></span></button></div>
          </> : <>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">Podcast episode</p>
            <h2 id="podcast-action-title" className="mt-1 text-base font-bold text-natural-dark">Regenerate this episode?</h2>
            <p className="mt-2 text-sm leading-6 text-natural-stone">The current recording will be replaced when the new one is ready.</p>
            <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => void regenerate()} disabled={workingKey === regenerateTarget?.id} className="min-h-11 rounded-full bg-natural-sage px-4 text-xs font-bold text-white transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/45 disabled:opacity-60">{workingKey === regenerateTarget?.id ? "Starting…" : "Regenerate"}</button><button type="button" onClick={() => setRegenerateTarget(null)} className="min-h-11 px-3 text-xs font-bold text-natural-stone">Keep current</button></div>
          </>}
        </div>
      </div>, document.body
    )}
  </>;
}

function ChapterRow({ chapter, number, canEdit, working, onPlay, onCreate, onRegenerate }: { chapter: PodcastChapter; number: number; canEdit: boolean; working: boolean; onPlay: () => void; onCreate: () => void; onRegenerate: () => void }) {
  const episode = chapter.episode;
  const running = !!episode && pendingStatuses.has(episode.status);
  const ready = isReady(episode);
  const label = chapter.chapter_title || `Chapter ${number}`;

  return <article className="py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h3 className="text-sm font-bold text-natural-dark">{label}</h3><p className="mt-0.5 text-[11px] text-natural-stone">{chapter.start_page != null ? `Pages ${chapter.start_page}${chapter.end_page != null && chapter.end_page !== chapter.start_page ? `–${chapter.end_page}` : ""}` : `Sections ${chapter.start_unit}–${chapter.end_unit}`}{ready && duration(episode?.duration_s || null) ? ` · ${duration(episode?.duration_s || null)}` : ""}</p></div><div className="flex shrink-0 items-center gap-1">{ready && <button type="button" onClick={onPlay} aria-label={`Play ${label}`} title="Play this episode" className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-natural-sage text-white transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/45"><Play className="h-4 w-4" /></button>}{canEdit && !ready && <button type="button" onClick={onCreate} disabled={working || running} className="min-h-11 shrink-0 rounded-full border border-natural-border bg-white px-4 text-xs font-bold text-natural-dark transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/45 disabled:opacity-60">{working || running ? "Preparing…" : episode?.status === "failed" ? "Try again" : "Create"}</button>}{canEdit && ready && <button type="button" onClick={onRegenerate} aria-label={`Regenerate ${label}`} title="Regenerate episode" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-natural-stone transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/40"><RotateCcw className="h-3.5 w-3.5" /></button>}</div></div>{running && <p className="mt-2 text-xs text-natural-stone">Preparing this chapter episode…</p>}{ready && <div className="mt-3"><details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-natural-stone">Read transcript</summary><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-natural-dark">{episode?.script_text}</p></details></div>}{!canEdit && !ready && <p className="mt-2 text-xs text-natural-stone">This episode is not available yet.</p>}</article>;
}
