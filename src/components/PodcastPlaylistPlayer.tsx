import { useCallback, useEffect, useRef, useState } from "react";
import { ListMusic, Loader2, Play, RotateCcw } from "lucide-react";
import { api, type PodcastEpisode, type PodcastPlaylist } from "../api";

function episodeName(episode: PodcastEpisode, index: number) {
  return episode.chapter_title || `Chapter ${index + 1}`;
}

export default function PodcastPlaylistPlayer({ bookId, compact = false, playRequest = null, onPlayed }: { bookId: string; compact?: boolean; playRequest?: { bookId: string; chapterKey: string } | null; onPlayed?: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastSavedAt = useRef(0);
  const autoplayNext = useRef(false);
  const pendingRequest = useRef(false);
  const [playlist, setPlaylist] = useState<PodcastPlaylist | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playRequest || playRequest.bookId !== bookId || pendingRequest.current) return;
    pendingRequest.current = true;
    setActiveIndex(null);
    void api.getPodcastPlaylist(bookId).then((next) => {
      const index = next.episodes.findIndex((episode) => episode.chapter_key === playRequest.chapterKey);
      setPlaylist(next);
      setActiveIndex(index >= 0 ? index : 0);
      setStarted(true);
      autoplayNext.current = false;
      window.setTimeout(() => void audioRef.current?.play().catch(() => setPlaying(false)), 0);
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

  useEffect(() => { setPlaylist(null); setActiveIndex(null); setStarted(false); setLoading(true); void refresh(); }, [bookId, refresh]);
  const episodes = playlist?.episodes || [];
  const active = activeIndex === null ? null : episodes[activeIndex] || null;
  const resumeAt = active && playlist?.progress?.podcast_id === active.id && !playlist.progress.completed_at ? playlist.progress.current_time_seconds : 0;
  const persist = useCallback((episode: PodcastEpisode, seconds: number, completed: boolean) =>
    api.savePodcastPlaylistProgress(bookId, episode.id, Math.max(0, seconds), completed).catch(() => undefined), [bookId]);
  const save = useCallback((completed: boolean, seconds?: number) => {
    const audio = audioRef.current;
    if (active && audio) void persist(active, seconds ?? audio.currentTime ?? 0, completed);
  }, [active, persist]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !active) return;
    const restore = () => {
      if (resumeAt > 1 && Math.abs(audio.currentTime - resumeAt) > 1) audio.currentTime = resumeAt;
      if (autoplayNext.current) { autoplayNext.current = false; void audio.play().catch(() => setPlaying(false)); }
    };
    audio.addEventListener("loadedmetadata", restore);
    return () => audio.removeEventListener("loadedmetadata", restore);
  }, [active?.id, resumeAt]);

  const selectAndPlay = (index: number, fromStart = false) => {
    const episode = episodes[index];
    if (!episode) return;
    autoplayNext.current = false;
    setStarted(true);
    if (fromStart && index === activeIndex && audioRef.current) audioRef.current.currentTime = 0;
    void persist(episode, 0, false);
    setActiveIndex(index);
    window.setTimeout(() => void audioRef.current?.play().catch(() => setPlaying(false)), 0);
  };

  const playBook = (fromStart = false) => selectAndPlay(fromStart ? 0 : (activeIndex ?? 0), fromStart);

  if (loading) return <div className="mt-4 flex items-center gap-2 text-xs text-natural-stone"><Loader2 className="h-4 w-4 animate-spin" /> Loading playlist…</div>;
  if (!episodes.length) return null;

  return <section className={`mt-4 rounded-2xl border border-natural-sage/25 bg-natural-sage/5 p-3 ${compact ? "" : "sm:p-4"}`} aria-label="Book podcast playlist">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-natural-sage"><ListMusic className="h-3.5 w-3.5" /> Listen through this book</p><p className="mt-1 text-[11px] text-natural-stone">{episodes.length} ready episode{episodes.length === 1 ? "" : "s"} · Round {playlist?.reading_round}</p></div>
      <div className="flex gap-1"><button type="button" onClick={() => playBook(false)} className="min-h-10 rounded-full bg-natural-sage px-3 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/45"><Play className="mr-1 inline h-3.5 w-3.5" />{playlist?.progress && !playlist.progress.completed_at ? "Continue" : "Play book"}</button><button type="button" onClick={() => playBook(true)} className="min-h-10 rounded-full px-3 text-xs font-bold text-natural-stone hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/45" aria-label="Play book from beginning"><RotateCcw className="h-3.5 w-3.5" /></button></div>
    </div>
    {active && <div className="mt-3 rounded-xl bg-white/75 p-3"><p className="text-xs font-bold text-natural-dark">Now playing · {episodeName(active, activeIndex || 0)}</p><audio ref={audioRef} className="mt-2 w-full" controls preload="metadata" src={`/api/podcasts/${active.id}/audio`} onPlay={() => setPlaying(true)} onPause={() => { setPlaying(false); save(false); }} onTimeUpdate={(event) => { const now = Date.now(); if (now - lastSavedAt.current > 15000) { lastSavedAt.current = now; save(false, event.currentTarget.currentTime); } }} onEnded={() => { setPlaying(false); if (started && activeIndex !== null && activeIndex + 1 < episodes.length) { const next = episodes[activeIndex + 1]; void persist(next, 0, false); autoplayNext.current = true; setActiveIndex(activeIndex + 1); } else { save(true); } }} onError={() => setPlaying(false)} />
      {playing && <p className="mt-1 text-[10px] text-natural-stone">The next ready chapter will continue automatically.</p>}</div>}
    {!compact && <ol className="mt-3 space-y-1" aria-label="Playlist queue">{episodes.slice(Math.max(0, activeIndex ?? 0), (activeIndex ?? 0) + 4).map((episode, offset) => { const index = (activeIndex ?? 0) + offset; return <li key={episode.id}><button type="button" onClick={() => selectAndPlay(index)} className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs ${index === activeIndex ? "bg-white text-natural-dark font-bold" : "text-natural-stone hover:bg-white/70"}`}><span className="w-5 text-[10px] font-bold text-natural-sage">{index === activeIndex ? "NOW" : String(index + 1).padStart(2, "0")}</span><span className="truncate">{episodeName(episode, index)}</span></button></li>; })}</ol>}
  </section>;
}
