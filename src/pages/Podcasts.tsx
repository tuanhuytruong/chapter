import { useEffect, useState } from "react";
import { Headphones, Loader2, Play, RefreshCw } from "lucide-react";
import { api, type PodcastCatalogBook, type PodcastChapter, type PodcastEpisode } from "../api";

const pending = new Set(["queued", "scripting", "synthesizing", "archiving"]);
const duration = (seconds: number | null) => seconds ? `${Math.max(1, Math.round(seconds / 60))} min` : "";

export default function Podcasts() {
  const [books, setBooks] = useState<PodcastCatalogBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [voiceTarget, setVoiceTarget] = useState<{ bookId: string; chapterKey: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => { setLoading(true); try { setBooks(await api.getPodcastCatalog()); setError(null); } catch (e: any) { setError(e.message); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { if (!books.some((book) => book.chapters.some((chapter) => chapter.episode && pending.has(chapter.episode.status)))) return; const timer = window.setInterval(() => void refresh(), 5000); return () => window.clearInterval(timer); }, [books]);
  const create = async (bookId: string, chapterKey: string, gender?: "female" | "male") => {
    setCreating(`${bookId}:${chapterKey}`);
    try { await api.createPodcast(bookId, chapterKey, gender); setVoiceTarget(null); await refresh(); }
    catch (e: any) { if (String(e.message).startsWith("409:")) setVoiceTarget({ bookId, chapterKey }); else setError(e.message); }
    finally { setCreating(null); }
  };
  return <div className="mx-auto max-w-4xl space-y-5">
    <section className="rounded-[28px] border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">Podcast library</p><h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-natural-dark"><Headphones className="h-6 w-6" /> Listen by chapter</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-natural-stone">Each episode follows one complete EPUB chapter. Listening stays here in Chapter; archive delivery remains private.</p></div><button onClick={() => void refresh()} className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-natural-border text-natural-stone" aria-label="Refresh podcasts"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
      {voiceTarget && <div className="mt-5 rounded-2xl border border-natural-sage/30 bg-natural-sage/10 p-4"><p className="text-sm font-bold text-natural-dark">Choose your narrator once</p><p className="mt-1 text-xs text-natural-stone">The same voice will be kept for every future episode.</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => void create(voiceTarget.bookId, voiceTarget.chapterKey, "female")} className="min-h-11 rounded-full bg-natural-sage px-4 text-xs font-bold text-white">Female voice</button><button onClick={() => void create(voiceTarget.bookId, voiceTarget.chapterKey, "male")} className="min-h-11 rounded-full border border-natural-border px-4 text-xs font-bold text-natural-dark">Male voice</button></div></div>}
      {error && <p className="mt-4 rounded-xl border border-natural-clay/30 bg-natural-clay/10 p-3 text-xs text-natural-clay">{error}</p>}
    </section>
    {loading && !books.length ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-natural-sage" /></div> : books.length ? books.map((book) => <section key={book.id} className="rounded-[24px] border border-natural-border bg-natural-cream p-4 shadow-sm sm:p-5"><div className="mb-4"><h2 className="text-lg font-bold text-natural-dark">{book.title}</h2>{book.author && <p className="mt-0.5 text-xs text-natural-stone">{book.author}</p>}</div><div className="space-y-2">{book.chapters.map((chapter, index) => <div key={chapter.chapter_key}><ChapterRow number={index + 1} chapter={chapter} creating={creating === `${book.id}:${chapter.chapter_key}`} onCreate={() => { void create(book.id, chapter.chapter_key); }} /></div>)}</div></section>) : <section className="rounded-[24px] border border-dashed border-natural-border p-8 text-center text-sm text-natural-stone">Add an EPUB book to create chapter episodes.</section>}
  </div>;
}

function ChapterRow({ number, chapter, creating, onCreate }: { number: number; chapter: PodcastChapter; creating: boolean; onCreate: () => void }) {
  const episode = chapter.episode as PodcastEpisode | null;
  const running = !!episode && pending.has(episode.status);
  return <article className="rounded-2xl border border-natural-border bg-natural-bg/40 p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm font-bold text-natural-dark">{chapter.chapter_title || `Chapter ${number}`}</p><p className="mt-0.5 font-sans text-[11px] text-natural-stone">Sections {chapter.start_unit}–{chapter.end_unit}{episode?.status === "ready" && duration(episode.duration_s) ? ` · ${duration(episode.duration_s)}` : ""}</p></div>{episode?.status === "ready" ? <button onClick={() => document.getElementById(`podcast-${episode.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} className="min-h-11 shrink-0 rounded-full bg-natural-sage px-4 text-xs font-bold text-white">Play</button> : <button onClick={onCreate} disabled={creating || running} className="min-h-11 shrink-0 rounded-full border border-natural-border px-4 text-xs font-bold text-natural-dark disabled:opacity-60">{creating || running ? "Creating…" : episode?.status === "failed" ? "Try again" : "Create episode"}</button>}</div>{running && <p className="mt-2 text-xs text-natural-stone">Preparing this chapter episode…</p>}{episode?.status === "failed" && <p className="mt-2 text-xs text-natural-clay">This episode could not be prepared. You can try again.</p>}{episode?.status === "ready" && <div id={`podcast-${episode.id}`} className="mt-3"><audio className="w-full" controls preload="metadata" src={`/api/podcasts/${episode.id}/audio`} /><details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-natural-stone">Read transcript</summary><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-natural-dark">{episode.script_text}</p></details></div>}</article>;
}
