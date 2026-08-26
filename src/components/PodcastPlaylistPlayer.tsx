import { useCallback, useEffect, useRef, useState } from "react";
import { ListMusic, Loader2, Play, RotateCcw, Sparkles } from "lucide-react";
import { api, type PodcastEpisode, type PodcastPlaylist } from "../api";

function episodeName(episode: PodcastEpisode) {
  return episode.chapter_title || "Untitled chapter";
}

const pendingStatuses = new Set(["queued", "scripting", "synthesizing", "archiving"]);

export default function PodcastPlaylistPlayer({ bookId, canGenerate = true, compact = false, playRequest = null, onPlayed, onNeedVoice, refreshKey = 0, onEpisodeCreated, onListened }: { bookId: string; canGenerate?: boolean; compact?: boolean; playRequest?: { bookId: string; episodeId: string } | null; onPlayed?: () => void; onNeedVoice?: (chapterKey: string) => void; refreshKey?: number; onEpisodeCreated?: () => void; onListened?: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastSavedAt = useRef(0);
  const playbackIntent = useRef<{ episodeId: string; reset: boolean } | null>(null);
  const pendingRequest = useRef(false);
  // One prefetch per currently playing episode. Tracking the active episode (not
  // the next chapter key) prevents a fast generation from cascading several
  // chapters ahead while the listener remains past the 30% mark.
  const autoTriggeredForEpisode = useRef<string | null>(null);
  const queueRef = useRef<HTMLDivElement | null>(null);
  const nowItemRef = useRef<HTMLLIElement | null>(null);
  const [playlist, setPlaylist] = useState<PodcastPlaylist | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [preparedNote, setPreparedNote] = useState<string | null>(null);

  useEffect(() => {
    if (!playRequest || playRequest.bookId !== bookId || pendingRequest.current) return;
    pendingRequest.current = true;
    setActiveIndex(null);
    void api.getPodcastPlaylist(bookId).then((next) => {
      const index = next.episodes.findIndex((episode) => episode.id === playRequest.episodeId);
      setPlaylist(next);
      const targetIndex = index >= 0 ? index : 0;
      const episode = next.episodes[targetIndex];
      playbackIntent.current = episode ? { episodeId: episode.id, reset: false } : null;
      setActiveIndex(targetIndex);
      onPlayed?.();
    }).finally(() => { pendingRequest.current = false; setLoading(false); });
  }, [bookId, playRequest, onPlayed]);

  const refresh = useCallback(async () => {
    try {
      const next = await api.getPodcastPlaylist(bookId);
      setPlaylist(next);
      setActiveIndex((current) => {
        if (current !== null && next.episodes[current]) return current;
        const resume = next.progress?.podcast_id ? next.episodes.findIndex((episode) => episode.id === next.progress?.podcast_id) : -1;
        return resume >= 0 ? resume : next.episodes.length ? 0 : null;
      });
    } finally { setLoading(false); }
  }, [bookId]);

  useEffect(() => { setPlaylist(null); setActiveIndex(null); setLoading(true); void refresh(); }, [bookId, refresh]);
  // Parent signals (e.g. a fresh episode created from the voice picker) trigger a
  // silent playlist refresh so the queue and next-chapter CTA stay in sync.
  useEffect(() => { if (refreshKey > 0) void refresh(); }, [refreshKey, refresh]);
  // While the next chapter is being generated, poll so the queue and CTA flip to
  // ready without requiring a manual refresh or a per-episode play click.
  const pendingNext = playlist?.next_chapter?.episode_status != null && pendingStatuses.has(playlist.next_chapter.episode_status);
  useEffect(() => {
    if (!pendingNext) return;
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [pendingNext, refresh]);
  const episodes = playlist?.episodes || [];
  const active = activeIndex === null ? null : episodes[activeIndex] || null;
  const resumeAt = active && playlist?.progress?.podcast_id === active.id && !playlist.progress.completed_at ? playlist.progress.current_time_seconds : 0;
  const persist = useCallback((episode: PodcastEpisode, seconds: number, completed: boolean) =>
    api.savePodcastPlaylistProgress(bookId, episode.id, Math.max(0, seconds), completed).catch(() => undefined), [bookId]);
  const save = useCallback((completed: boolean, seconds?: number) => {
    const audio = audioRef.current;
    if (active && audio) {
      void persist(active, seconds ?? audio.currentTime ?? 0, completed);
      // A finished episode changes the "Đã nghe X/Y" counters on the parent
      // panel — nudge it so the UI updates without a manual refresh.
      if (completed) onListened?.();
    }
  }, [active, persist, onListened]);

  const handleAudioReady = useCallback((audio: HTMLAudioElement) => {
    if (!active) return;
    const intent = playbackIntent.current;
    if (!intent || intent.episodeId !== active.id) return;
    // Android may settle a replacement media source before a post-render effect
    // attaches. This handler is installed with the element itself and each
    // episode remounts the element, so the requested play cannot be lost.
    if (intent.reset) audio.currentTime = 0;
    else if (resumeAt > 1 && Math.abs(audio.currentTime - resumeAt) > 1) audio.currentTime = resumeAt;
    playbackIntent.current = null;
    void audio.play().catch(() => {
      setPlaying(false);
      setPreparedNote("Chương mới đã sẵn sàng — chạm Play để tiếp tục nghe.");
    });
  }, [active, resumeAt]);

  const selectAndPlay = (index: number, fromStart = false) => {
    const episode = episodes[index];
    if (!episode) return;
    if (index === activeIndex && audioRef.current) {
      if (fromStart) audioRef.current.currentTime = 0;
      void persist(episode, 0, false);
      void audioRef.current.play().catch(() => setPlaying(false));
      return;
    }
    playbackIntent.current = { episodeId: episode.id, reset: fromStart };
    void persist(episode, 0, false);
    setActiveIndex(index);
  };

  const playBook = (fromStart = false) => selectAndPlay(fromStart ? 0 : (activeIndex ?? 0), fromStart);

  // Generate the next chapter. Manual mode auto-plays the fresh episode only
  // when it is the listener's turn (nothing is playing, or the latest ready
  // chapter is playing); otherwise it just prepares it into the queue so the
  // current chapter is never cut off. "auto" (30% listener trigger) always
  // only prepares it — the user keeps listening uninterrupted.
  const generateNext = useCallback(async (mode: "manual" | "auto" = "manual") => {
    const next = playlist?.next_chapter;
    if (!next || generating || !canGenerate) return;
    if (!next.has_narrator) { onNeedVoice?.(next.chapter_key); return; }
    const auto = mode === "auto";
    setGenerating(true);
    if (auto) setAutoGenerating(true);
    const target = next.chapter_key;
    try {
      const created = await api.createPodcast(bookId, target);
      onEpisodeCreated?.();
      if (created.status === "unavailable") {
        setPreparedNote("This brief chapter is being skipped; preparing the next eligible chapter…");
        await refresh();
        setGenerating(false);
        if (auto) setAutoGenerating(false);
        return;
      }
    } catch (error: any) {
      if (String(error?.message || "").startsWith("409:")) { setGenerating(false); if (auto) setAutoGenerating(false); onNeedVoice?.(target); return; }
      setGenerating(false);
      if (auto) setAutoGenerating(false);
      return;
    }
    let ticks = 0;
    const poll = async () => {
      try {
        const nextList = await api.getPodcastPlaylist(bookId);
        setPlaylist(nextList);
        const index = nextList.episodes.findIndex((episode) => episode.chapter_key === target);
        if (index >= 0) {
          window.clearInterval(timer);
          setGenerating(false);
          if (auto) { setAutoGenerating(false); return; }
          const fresh = nextList.episodes[index];
          const atLatest = activeIndex === null || activeIndex === episodes.length - 1;
          if (atLatest) {
            // The new keyed audio element consumes this intent from its native
            // readiness event, avoiding Android's post-render listener race.
            playbackIntent.current = { episodeId: fresh.id, reset: true };
            setActiveIndex(index);
            void persist(fresh, 0, false);
          } else {
            // Still listening to an earlier chapter: prepare quietly and let
            // playback advance to the new episode naturally.
            const label = episodeName(fresh);
            setPreparedNote(`${label} đã sẵn sàng — sẽ tự phát khi đến lượt nghe của bạn.`);
            window.setTimeout(() => setPreparedNote(null), 6000);
          }
          return;
        }
        // Generation can fail mid-flight (e.g. TTS 502). Stop polling and hand
        // the manual "Generate & play next" CTA back so the user can retry.
        const targetStatus = nextList.next_chapter?.chapter_key === target ? nextList.next_chapter.episode_status : null;
        if (targetStatus === "failed") {
          window.clearInterval(timer);
          setGenerating(false);
          if (auto) setAutoGenerating(false);
          return;
        }
      } catch { /* transient; keep polling */ }
      ticks += 1;
      if (ticks >= 180) { window.clearInterval(timer); setGenerating(false); if (auto) setAutoGenerating(false); }
    };
    const timer = window.setInterval(() => void poll(), 5000);
    void poll();
  }, [bookId, playlist, generating, activeIndex, canGenerate, onNeedVoice, persist, onEpisodeCreated, refresh]);

  // Put the current row at the top of the queue whenever playback changes, so
  // the first visible list item always confirms what is playing.
  useEffect(() => {
    const queue = queueRef.current;
    const current = nowItemRef.current;
    if (!queue || !current) return;
    const top = current.getBoundingClientRect().top - queue.getBoundingClientRect().top + queue.scrollTop;
    queue.scrollTo({ top, behavior: "smooth" });
  }, [activeIndex]);

  if (loading) return <div className="mt-4 flex items-center gap-2 text-xs text-natural-stone"><Loader2 className="h-4 w-4 animate-spin" /> Loading playlist…</div>;
  if (!episodes.length && !playlist?.next_chapter) return null;

  const next = playlist?.next_chapter || null;
  const nextPending = next?.episode_status ? pendingStatuses.has(next.episode_status) : false;

  return <section className={`mt-4 rounded-2xl border border-natural-sage/25 bg-natural-sage/5 p-3 ${compact ? "" : "sm:p-4"}`} aria-label="Book podcast playlist">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-natural-sage"><ListMusic className="h-3.5 w-3.5" /> Listen through this book</p><p className="mt-1 text-[11px] text-natural-stone">{episodes.length ? `${episodes.length} ready episode${episodes.length === 1 ? "" : "s"} · Round ${playlist?.reading_round}` : `Round ${playlist?.reading_round} · no episodes yet`}</p></div>
      {episodes.length > 0 && <div className="flex gap-1"><button type="button" onClick={() => playBook(false)} className="min-h-10 rounded-full bg-natural-sage px-3 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/45"><Play className="mr-1 inline h-3.5 w-3.5" />{playlist?.progress && !playlist.progress.completed_at ? "Continue" : "Play book"}</button><button type="button" onClick={() => playBook(true)} className="min-h-10 rounded-full px-3 text-xs font-bold text-natural-stone hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/45" aria-label="Play book from beginning"><RotateCcw className="h-3.5 w-3.5" /></button></div>}
    </div>
    {active && <div className="mt-3 rounded-xl bg-white/75 p-3"><p className="text-xs font-bold text-natural-dark">Now playing · {episodeName(active)}</p><audio key={active.id} ref={audioRef} className="mt-2 w-full" controls preload="metadata" src={`/api/podcasts/${active.id}/audio`} onLoadedMetadata={(event) => handleAudioReady(event.currentTarget)} onCanPlay={(event) => handleAudioReady(event.currentTarget)} onPlay={() => setPlaying(true)} onPause={() => { setPlaying(false); save(false); }} onTimeUpdate={(event) => { const audio = event.currentTarget; const now = Date.now(); if (now - lastSavedAt.current > 15000) { lastSavedAt.current = now; save(false, audio.currentTime); } const nextChapter = playlist?.next_chapter; const playingLatestReady = activeIndex !== null && activeIndex === episodes.length - 1; if (canGenerate && nextChapter && playingLatestReady && !generating && !autoGenerating && audio.duration > 0) { const isPending = nextChapter.episode_status != null && pendingStatuses.has(nextChapter.episode_status); if (!isPending && audio.currentTime / audio.duration >= 0.3 && autoTriggeredForEpisode.current !== active?.id) { autoTriggeredForEpisode.current = active?.id || null; void generateNext("auto"); } } }} onEnded={() => { setPlaying(false); save(true); if (activeIndex !== null && activeIndex + 1 < episodes.length) { const nextEpisode = episodes[activeIndex + 1]; void persist(nextEpisode, 0, false); playbackIntent.current = { episodeId: nextEpisode.id, reset: true }; setActiveIndex(activeIndex + 1); } }} onError={() => setPlaying(false)} />
      {playing && <p className="mt-1 text-[10px] text-natural-stone">The next ready chapter will continue automatically.</p>}</div>}
    {!compact && episodes.length > 0 && <div ref={queueRef} className="mt-3 max-h-64 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(121,134,102,0.45) transparent" }}><ol className="space-y-1 pb-64" aria-label="Playlist queue">{episodes.map((episode, index) => { const activeNow = index === activeIndex; return <li key={episode.id} ref={activeNow ? nowItemRef : undefined}><button type="button" onClick={() => selectAndPlay(index)} className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs ${activeNow ? "bg-white text-natural-dark font-bold" : "text-natural-stone hover:bg-white/70"}`}><span className="w-5 shrink-0 text-[10px] font-bold text-natural-sage">{activeNow ? "NOW" : String(episode.chapter_number ?? "?").padStart(2, "0")}</span><span className="truncate">{episodeName(episode)}</span></button></li>; })}</ol></div>}
    {next && <div className="mt-3 rounded-xl border border-dashed border-natural-sage/40 bg-white/60 p-3">
      <p className="text-[11px] font-semibold text-natural-stone">Next chapter not recorded yet: <span className="font-bold text-natural-dark">{next.chapter_title || "Untitled chapter"}</span>{next.start_page != null ? ` · p. ${next.start_page}` : ""}</p>
      {autoGenerating ? <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-natural-dark"><Loader2 className="h-3.5 w-3.5 animate-spin text-natural-sage" /> Auto-preparing the next chapter: <span className="font-bold">{next.chapter_title || "Untitled chapter"}</span>…</p> : nextPending ? <p className="mt-2 flex items-center gap-2 text-xs text-natural-stone"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing this chapter…</p> : <><button type="button" onClick={() => void generateNext("manual")} disabled={generating || !canGenerate} className="mt-2 flex min-h-10 items-center gap-1.5 rounded-full bg-natural-sage px-3 text-xs font-bold text-white transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/45 disabled:opacity-60">{generating ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</> : <><Sparkles className="h-3.5 w-3.5" /> {episodes.length ? "Generate & play next" : "Generate & play first chapter"}</>}</button><p className={`mt-2 text-[10px] leading-relaxed ${preparedNote ? "text-natural-sage" : "text-natural-stone"}`}>{preparedNote || "Follow your listening rhythm — the next chapter will be prepared as you keep listening."}</p></>}
    </div>}
  </section>;
}
