import React, { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Flame, BookOpen, Loader2, Zap, Settings2, ArrowLeft, Trash2, ImageIcon, Search, X, CheckCircle, RotateCcw, RefreshCw } from 'lucide-react';
import { api, computeStreak, progressPct, daysToFinish, fetchCover } from '../api';
import type { BookRow, LogRow, ReadingLensRow, StoryThreadRow, SummaryMode } from '../types';
import { dailyTargetLabel } from '../readingUnits';
import DaySummary from '../components/DaySummary';
import ReadingLensCard from '../components/ReadingLensCard';
import StreakHeatmap from '../components/StreakHeatmap';
import MomentumScore from '../components/MomentumScore';
import Toast from '../components/Toast';
import JourneyView from '../components/JourneyView';
import MindMap from '../components/MindMap';
import type { MindMapData } from '../components/MindMap';
import StoryThreadView from '../components/story/StoryThreadView';
import BookWiki from '../components/BookWiki';
import { GuideCard } from '../onboarding';

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return <>{parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="font-bold text-natural-dark">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    return <React.Fragment key={index}>{part}</React.Fragment>;
  })}</>;
}

function ReadingLensSynthesis({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(<ul key={`list-${blocks.length}`} className="ml-4 list-disc space-y-1.5 pl-3">{bullets.map((item, index) => <li key={index}><InlineMarkdown text={item} /></li>)}</ul>);
    bullets = [];
  };
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line) { flushBullets(); continue; }
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) { flushBullets(); blocks.push(<h3 key={`heading-${index}`} className="pt-2 text-sm font-bold text-natural-dark"><InlineMarkdown text={heading[1]} /></h3>); continue; }
    const bullet = line.match(/^[-•]\s+(.+)$/);
    if (bullet) { bullets.push(bullet[1]); continue; }
    flushBullets();
    blocks.push(<p key={`paragraph-${index}`}><InlineMarkdown text={line} /></p>);
  }
  flushBullets();
  return <article className="mt-4 space-y-3 rounded-2xl border border-natural-border bg-natural-cream/60 p-4 text-xs leading-relaxed text-natural-dark">{blocks}</article>;
}

export default function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<BookRow | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dailyPages, setDailyPages] = useState(20);
  const [status, setStatus] = useState<'active' | 'paused' | 'finished'>('active');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [summaryLang, setSummaryLang] = useState<'auto' | 'vi' | 'en'>('auto');
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('casual');
  const [searchingCover, setSearchingCover] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [finishModal, setFinishModal] = useState<BookRow | null>(null);
  const [search, setSearch] = useState('');
  const [logView, setLogView] = useState<'list' | 'journey' | 'ai-reader'>('list');
  const [hasOpenedAiReader, setHasOpenedAiReader] = useState(false);
  const [journeyExpanded, setJourneyExpanded] = useState<string | null>(null);
  const [mindmapData, setMindmapData] = useState<MindMapData | null>(null);
  const [mindmapLoading, setMindmapLoading] = useState(false);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const [lenses, setLenses] = useState<ReadingLensRow[]>([]);
  const [storyThread, setStoryThread] = useState<StoryThreadRow[]>([]);
  const [storyRetryingLogId, setStoryRetryingLogId] = useState<string | null>(null);
  const [lensSynthesis, setLensSynthesis] = useState<string | null>(null);
  const [lensSynthesizing, setLensSynthesizing] = useState(false);
  const [enrichmentPending, setEnrichmentPending] = useState(false);
  const [pendingEnrichmentLogId, setPendingEnrichmentLogId] = useState<string | null>(null);
  const headerReadActionRef = useRef<HTMLDivElement | null>(null);
  const [headerReadActionVisible, setHeaderReadActionVisible] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [b, l] = await Promise.all([api.getBook(id), api.getLog(id)]);
      const analysisRows = b.can_edit
        ? b.reading_experience === 'story' ? await api.getStoryThread(id) : await api.getReadingLens(id)
        : [];
      setBook(b);
      setDailyPages(b.daily_pages);
      setStatus(b.status);
      setTitle(b.title);
      setAuthor(b.author);
      setCoverUrl(b.cover_url || '');
      setSummaryLang(b.summary_lang || 'auto');
      setSummaryMode(b.summary_mode || 'casual');
      setLogs(l);
      setLenses(b.reading_experience === 'analytical' ? analysisRows as ReadingLensRow[] : []);
      setStoryThread(b.reading_experience === 'story' ? analysisRows as StoryThreadRow[] : []);
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const target = headerReadActionRef.current;
    if (!target || !book?.can_edit || book.status === 'finished') {
      setHeaderReadActionVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setHeaderReadActionVisible(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [book?.can_edit, book?.status]);

  // A reading session is saved immediately; its companion analysis finishes in
  // the background. Revalidate quietly for a bounded window rather than making
  // the reader refresh the full page.
  useEffect(() => {
    if (!enrichmentPending || !pendingEnrichmentLogId || !id) return;
    let cancelled = false;
    const startedAt = Date.now();
    const tick = async () => {
      try {
        const [updatedBook, updatedLogs] = await Promise.all([api.getBook(id), api.getLog(id)]);
        if (cancelled) return;
        // Quietly reconcile only changed data. Keeping existing state in place
        // avoids a route-level loading flash after the reader saves a session.
        setBook(previous => previous ? { ...previous, ...updatedBook } : updatedBook);
        setLogs(previous => {
          const byId = new Map<string, LogRow>(previous.map(log => [log.id, log]));
          updatedLogs.forEach(log => byId.set(log.id, log));
          return [...byId.values()].sort((a, b) => `${b.date}-${b.session}`.localeCompare(`${a.date}-${a.session}`));
        });
        const analyses = updatedBook.can_edit && updatedBook.reading_experience === 'analytical'
          ? await api.getReadingLens(id)
          : [];
        if (updatedBook.can_edit) {
          if (updatedBook.reading_experience === 'story') setStoryThread(await api.getStoryThread(id));
          else setLenses(analyses);
        }
        const pendingLog = updatedLogs.find(log => log.id === pendingEnrichmentLogId);
        const lensReady = updatedBook.reading_experience === 'story'
          ? true
          : analyses.some(item => item.log_id === pendingEnrichmentLogId);
        const wiki = await api.getWikiStatus(id);
        if (lensReady && wiki.wikiExists && wiki.pagesCovered >= (pendingLog?.page_end || 0)) {
          setEnrichmentPending(false);
          setPendingEnrichmentLogId(null);
        }
      } catch { /* keep the saved reading session usable; retry until timeout */ }
      if (!cancelled && Date.now() - startedAt >= 180000) {
        setEnrichmentPending(false);
        setPendingEnrichmentLogId(null);
      }
    };
    void tick();
    const interval = window.setInterval(() => { void tick(); }, 7000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [enrichmentPending, id, pendingEnrichmentLogId]);

  useEffect(() => {
    if (!id || logs.length === 0) return;
    const cached = localStorage.getItem(`mindmap_${id}`);
    if (cached) try { setMindmapData(JSON.parse(cached)); } catch {}
  }, [id, logs.length]);

  const readToday = async () => {
    if (!id) return;
    setAdvancing(true);
    try {
      const result = await api.advance(id);
      if (result.finished) {
        // Fetch next queued book
        const books = await api.listBooks();
        const nextQueued = books.filter(b => b.status === 'queued').sort((a, b) => (a.queue_order ?? 999) - (b.queue_order ?? 999))[0];
        if (nextQueued) setFinishModal(nextQueued);
      }
      // The API returns the persisted log and updated cursor. Merge those into
      // the live detail view instead of reloading the route and losing context.
      setLogs(previous => [result.log, ...previous.filter(log => log.id !== result.log.id)]);
      setBook(previous => previous ? {
        ...previous,
        current_page: result.pageEnd,
        total_pages: result.totalUnits,
        status: result.finished ? 'finished' : previous.status,
      } : previous);
      setToast({
        type: 'ok',
        msg: hasReadToday
          ? `Session ${result.session} saved — companion notes are preparing`
          : 'Read today saved — companion notes are preparing'
      });
      setPendingEnrichmentLogId(result.log.id);
      setEnrichmentPending(true);
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message });
    } finally {
      setAdvancing(false);
    }
  };

  const startFromModal = async () => {
    if (!finishModal) return;
    try {
      await api.updateBook(finishModal.id, { status: 'active' } as any);
      setToast({ type: 'ok', msg: `Started "${finishModal.title}"!` });
      setFinishModal(null);
      navigate(`/books/${finishModal.id}`);
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message });
      setFinishModal(null);
    }
  };

  const saveSettings = async () => {
    if (!id) return;
    try {
      await api.updateBook(id, {
        daily_pages: dailyPages,
        status,
        title: title.trim(),
        author: author.trim(),
        cover_url: coverUrl || undefined,
        summary_lang: summaryLang,
        ...(book?.reading_experience === 'analytical' ? { summary_mode: summaryMode } : {}),
      });
      setToast({ type: 'ok', msg: 'Saved' });
      setEditing(false);
      await load();
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message });
    }
  };

  const reFetchCover = async () => {
    if (!title.trim()) return;
    setSearchingCover(true);
    const url = await fetchCover(title);
    if (url) setCoverUrl(url);
    setSearchingCover(false);
  };

  const deleteBook = async () => {
    if (!id) return;
    if (!confirm(`Delete "${book?.title}"? All reading data (${logs.length} sessions, summaries, insights, raw text) will be permanently removed. This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteBook(id);
      setToast({ type: 'ok', msg: 'Book deleted' });
      navigate('/');
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message });
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-16"><Loader2 className="w-8 h-8 text-natural-sage animate-spin" /></div>;
  }
  if (!book) {
    return <div className="text-center p-16 text-natural-stone font-sans">Book not found. <button onClick={() => navigate('/')} className="text-natural-sage underline">Back to library</button></div>;
  }

  const pct = progressPct(book);
  const streak = computeStreak(logs.map(l => l.date));
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const todaySessions = logs.filter(l => String(l.date).slice(0, 10) === todayStr);
  const sessionCount = todaySessions.length;
  const hasReadToday = sessionCount > 0;

  // Feature 1: Search within book
  const filteredLogs = (() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(l =>
      l.summary?.toLowerCase().includes(q) ||
      l.key_insights?.some(i => i.toLowerCase().includes(q)) ||
      l.quote?.toLowerCase().includes(q) ||
      l.chapter_title?.toLowerCase().includes(q)
    );
  })();

  // Feature 6: Group logs by date for session separation — use Bangkok TZ so
  // dates match what the user sees in Journey view and the heatmap.
  const logsByDate = (() => {
    const map = new Map<string, typeof logs>();
    for (const l of filteredLogs) {
      const raw = String(l.date);
      const k = raw.includes('T')
        ? new Date(raw).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
        : raw.slice(0, 10);
      map.set(k, [...(map.get(k) || []), l]);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  })();

  // Feature 2: Mark as Finished handler
  const markFinished = async () => {
    if (!id) return;
    try {
      await api.updateBook(id, { status: 'finished' } as any);
      await load();
      const books = await api.listBooks();
      const nextQueued = books.filter(b => b.status === 'queued').sort((a, b) => (a.queue_order ?? 999) - (b.queue_order ?? 999))[0];
      if (nextQueued) setFinishModal(nextQueued);
      else setToast({ type: 'ok', msg: `🎉 Finished "${book?.title}"!` });
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message });
    }
  };

  const generateReflection = async () => {
    if (!id) return;
    setReflectionLoading(true);
    try {
      await api.generateReflection(id);
      await load();
      setToast({ type: 'ok', msg: 'Your book reflection is ready' });
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message });
    } finally {
      setReflectionLoading(false);
    }
  };

  const retryReadingLens = async (logId: string) => {
    if (!id) return;
    try {
      await api.retryReadingLens(id, logId);
      await load();
      setToast({ type: 'ok', msg: 'Reading Lens is ready' });
    } catch (e: any) { setToast({ type: 'err', msg: e.message }); throw e; }
  };

  const retryStoryThread = async (logId: string) => {
    if (!id) return;
    setStoryRetryingLogId(logId);
    try {
      await api.retryStoryThread(id, logId);
      await load();
      setToast({ type: 'ok', msg: 'Story Thread is ready' });
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message });
      throw e;
    } finally {
      setStoryRetryingLogId(null);
    }
  };

  const synthesizeReadingLens = async () => {
    if (!id) return;
    setLensSynthesizing(true);
    try {
      const result = await api.synthesizeReadingLens(id);
      setLensSynthesis(result.synthesis);
    } catch (e: any) { setToast({ type: 'err', msg: e.message }); }
    finally { setLensSynthesizing(false); }
  };

  const generateMindmap = async () => {
    if (!id) return;
    setMindmapLoading(true);
    try {
      const res = await fetch(`/api/books/${id}/mindmap`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setMindmapData(data);
        localStorage.setItem(`mindmap_${id}`, JSON.stringify(data));
      }
    } catch (e) { console.error(e); }
    finally { setMindmapLoading(false); }
  };


  const startReread = async () => {
    if (!id) return;
    try {
      await fetch(`/api/books/${id}/reread`, { method: 'POST' });
      setToast({ type: 'ok', msg: `📖 Re-reading "${book?.title}"!` });
      await load();
    } catch (e: any) { setToast({ type: 'err', msg: e.message }); }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-xs text-natural-stone hover:text-natural-dark"><ArrowLeft className="w-4 h-4" /> Library</button>
        {book.can_edit && <button onClick={deleteBook} disabled={deleting}
          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
      </div>

      {/* Header */}
      <div className="grid gap-3 rounded-[24px] border border-natural-border bg-natural-cream p-4 shadow-sm sm:grid-cols-[104px_minmax(0,1fr)] sm:gap-4 sm:p-5 lg:grid-cols-[144px_minmax(0,1fr)_minmax(300px,360px)] lg:items-start">
        <div className="flex h-36 w-[104px] shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-natural-stone/25 bg-[#e8e6de] p-1.5 shadow-md shadow-natural-dark/10 sm:h-52 sm:w-36 sm:p-2 lg:row-span-2">
          {book.cover_url ? <img src={book.cover_url} alt={book.title} referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} className="h-full w-full rounded-[1px] object-contain" /> : <BookOpen className="w-8 h-8 text-natural-stone" />}
        </div>
        <div className="order-2 min-w-0 sm:order-none">
          <h1 className="line-clamp-2 text-lg font-bold leading-snug text-natural-dark sm:text-xl sm:leading-tight">{book.title}</h1>
          <p className="mb-2 text-xs italic text-natural-stone">by {book.author}</p>
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="flex items-center gap-1 text-sm font-bold text-natural-clay"><Flame className="h-4 w-4 fill-natural-clay" />{streak}d streak</span>
            {daysToFinish(book) !== null && (
              <span className="text-[11px] text-natural-stone">Pace: about {daysToFinish(book)} days left</span>
            )}
            <MomentumScore book={book} logs={logs} />
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-natural-border" aria-label={`${pct}% complete`}>
            <div className="h-full bg-natural-sage rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-natural-stone">{pct}% complete · {logs.length} reading days</p>
        </div>
        <aside className="contents" aria-label="Book utilities">
          <div ref={headerReadActionRef} className="order-3 col-span-full flex flex-col gap-3 border-t border-natural-border/70 pt-3 sm:col-span-2 lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:border-t-0 lg:pt-0">
          {!book.can_edit ? <span className="text-xs text-natural-stone">Read-only · {book.owner_name || 'another reader'}</span> : book.status === 'finished' ? (
            <div className="flex flex-wrap gap-2">
              <span className="flex min-h-11 items-center gap-1.5 rounded-full bg-natural-border px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-natural-stone sm:min-h-0">
                <CheckCircle className="w-3.5 h-3.5" /> Finished
              </span>
              <button onClick={startReread}
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-natural-border px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-natural-stone hover:border-natural-sage hover:text-natural-dark sm:min-h-0 cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5" /> Re-read
              </button>
            </div>
          ) : (
            <>
              <button onClick={readToday} disabled={advancing || book.status === 'finished'}
                className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-natural-clay px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:opacity-90 disabled:opacity-50 cursor-pointer lg:w-auto">
                {advancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} {advancing ? 'Saving…' : 'Read next session'}
              </button>
              {pct >= 85 && book.status === 'active' && (
                <button onClick={markFinished}
                  className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-natural-sage px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-natural-sage-dark cursor-pointer">
                  <CheckCircle className="w-3.5 h-3.5" /> Mark Finished
                </button>
              )}
            </>
          )}
          </div>

          {book.can_edit && book.status === 'active' && (
            <section className="order-4 col-span-full grid grid-cols-2 gap-x-4 gap-y-2 border-t border-natural-border/70 pt-3 text-xs sm:grid-cols-4 lg:col-span-1 lg:col-start-3 lg:row-start-2">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Current</p><p className="mt-0.5 font-semibold text-natural-dark">{book.current_page} / {book.total_pages}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Daily target</p><p className="mt-0.5 font-semibold text-natural-dark">{book.daily_pages} {dailyTargetLabel(book.file_type).toLowerCase()}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Sessions</p><p className="mt-0.5 font-semibold text-natural-dark">{logs.length} saved</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Forecast</p><p className="mt-0.5 font-semibold text-natural-dark">{daysToFinish(book) === null ? '—' : `~${daysToFinish(book)} days`}</p></div>
            </section>
          )}

          <section className="order-5 col-span-full border-t border-natural-border/70 pt-3 sm:col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-2">
            <h3 className="mb-2 text-xs font-bold text-natural-dark">Reading Rhythm</h3>
            <div className="lg:hidden"><StreakHeatmap logs={logs} /></div>
            <div className="hidden lg:block"><StreakHeatmap logs={logs} windowDays={21} /></div>
          </section>

          {book.can_edit && (
          <section className="order-6 col-span-full border-t border-natural-border/70 pt-3 sm:col-span-2 lg:col-span-1 lg:col-start-3 lg:row-start-3">
            <div className="flex items-center gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-natural-dark"><Settings2 className="h-4 w-4" /> Settings</h3>
              {!editing && <button onClick={() => setEditing(true)} className="rounded-full border border-natural-border px-2.5 py-1 text-[11px] font-bold text-natural-sage hover:border-natural-sage">Edit</button>}
            </div>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Title</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-natural-border bg-natural-cream/50 px-3 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Author</label>
                  <input value={author} onChange={e => setAuthor(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-natural-border bg-natural-cream/50 px-3 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-natural-stone flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Cover URL</label>
                  <div className="flex gap-2 mt-1">
                    <input value={coverUrl} onChange={e => setCoverUrl(e.target.value)} disabled={searchingCover} className="flex-1 px-3 py-1.5 bg-natural-cream/50 border border-natural-border rounded-xl text-xs disabled:opacity-50" />
                    <button onClick={reFetchCover} disabled={searchingCover} className="px-2 py-1.5 bg-natural-cream border border-natural-border rounded-xl text-[10px] font-bold">Auto</button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Pages / day</label>
                  <input type="number" min={1} max={20} step={1} inputMode="numeric" value={dailyPages} onFocus={e => e.currentTarget.select()} onChange={e => {
                    const next = e.currentTarget.valueAsNumber;
                    if (Number.isFinite(next)) setDailyPages(Math.min(20, Math.max(1, Math.trunc(next))));
                  }} className="mt-1 min-h-11 w-full rounded-xl border border-natural-border bg-natural-cream/50 px-3 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Language</label>
                  <select value={summaryLang} onChange={e => setSummaryLang(e.target.value as 'auto' | 'vi' | 'en')}
                    className="mt-1 min-h-11 w-full rounded-xl border border-natural-border bg-natural-cream/50 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage">
                    <option value="auto">Auto (book's language)</option>
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                </div>
                {book.reading_experience === 'analytical' && <fieldset>
                  <legend className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Summary style</legend>
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">{([['casual', 'Casual', 'Warm highlights for everyday reading.'], ['deep_reading', 'Deep Reading', 'Arguments, support, assumptions, and concepts.']] as const).map(([value, label, copy]) => <label key={value} className={`min-h-11 cursor-pointer rounded-xl border p-3 text-xs ${summaryMode === value ? 'border-natural-sage bg-natural-sage/10' : 'border-natural-border'}`}><input className="sr-only" type="radio" checked={summaryMode === value} onChange={() => setSummaryMode(value)} /><b>{label}</b><span className="mt-0.5 block text-[10px] text-natural-stone">{copy}</span></label>)}</div>
                  <p className="mt-1 text-[10px] text-natural-stone">Applies to new summaries and summaries you retry. Earlier summaries stay unchanged.</p>
                </fieldset>}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as any)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-natural-border bg-natural-cream/50 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage">
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="finished">Finished</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="flex-1 py-2 border border-natural-border rounded-full text-[11px] font-bold uppercase">Cancel</button>
                  <button onClick={saveSettings} className="flex-1 py-2 bg-natural-sage text-white rounded-full text-[11px] font-bold uppercase">Save</button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-natural-muted space-y-1">
                <p>{dailyTargetLabel(book.file_type)}: <b className="text-natural-dark">{book.daily_pages}</b></p>
                <p>Status: <b className="text-natural-dark capitalize">{book.status}</b></p>
                {book.reading_experience === 'analytical' && <p>Summary: <b className="text-natural-dark">{book.summary_mode === 'deep_reading' ? 'Deep Reading' : 'Casual'}</b></p>}
                <p>File: <span className="font-mono text-[10px]">{book.file_type.toUpperCase()}</span></p>
              </div>
            )}
          </section>
          )}
        </aside>
      </div>

      {book.can_edit && logs.length === 0 && <GuideCard step="first_session" eyebrow="Your first session" title="Read when you are ready"><p>Tap <strong className="text-natural-dark">Read next session</strong> when you finish a small section. Chapter saves the session first, then prepares its companion notes in the background—there is nothing else to set up.</p></GuideCard>}

      {book.status === 'finished' && (
        <section className="rounded-[24px] border border-natural-border bg-natural-cream p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">End-of-book reflection</p>
              <h2 className="mt-1 text-base font-bold text-natural-dark">What will stay with you?</h2>
              {!book.reflection_text && <p className="mt-1 text-xs leading-relaxed text-natural-stone">Turn your reading journal into a personal takeaway you can revisit later.</p>}
            </div>
            {book.can_edit && (
              <button onClick={generateReflection} disabled={reflectionLoading} className="min-h-11 shrink-0 rounded-full bg-natural-sage px-4 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50">
                {reflectionLoading ? 'Reflecting…' : book.reflection_text ? 'Generate again' : 'Create reflection'}
              </button>
            )}
          </div>
          {book.reflection_text && <article className="mt-4 whitespace-pre-wrap rounded-2xl border border-natural-border bg-natural-cream/60 p-4 text-xs leading-relaxed text-natural-dark">{book.reflection_text}</article>}
        </section>
      )}



      {book.reading_experience === 'story' ? <><GuideCard step="story_thread" eyebrow="Story Thread" title="Continuity grows with each session"><p>After you read, Chapter quietly follows the events, people, and unresolved threads from only the story you have reached so far. Your Story choice stays fixed so that continuity remains trustworthy.</p></GuideCard><StoryThreadView analyses={storyThread} logs={logs} onRetry={retryStoryThread} retryingLogId={storyRetryingLogId} /></> : <>
      {/* Timeline */}
      <div>
        <div className="mb-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <h3 className="flex-1 font-sans text-sm font-bold text-natural-dark">Daily Summaries</h3>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-natural-stone" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search summaries..."
              className="min-h-11 w-full rounded-full border border-natural-border bg-natural-cream py-1.5 pl-7 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage sm:w-44" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-natural-stone hover:text-natural-dark">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        {search && (
          <p className="text-[10px] text-natural-stone font-sans mb-2">
            {filteredLogs.length} result{filteredLogs.length !== 1 ? 's' : ''} for "{search}"
          </p>
        )}
        {/* Toggle: List / Journey */}
        <div className="flex items-center gap-1 mb-3">
          <button onClick={() => setLogView('list')}
            className={`px-3 py-1 text-xs font-bold rounded-full transition ${logView === 'list' ? 'bg-natural-sage text-white' : 'bg-natural-cream text-natural-stone border border-natural-border'}`}>
            List
          </button>
          <button onClick={() => setLogView('journey')}
            className={`px-3 py-1 text-xs font-bold rounded-full transition ${logView === 'journey' ? 'bg-natural-sage text-white' : 'bg-natural-cream text-natural-stone border border-natural-border'}`}>
            Journey
          </button>
          <button onClick={() => { setHasOpenedAiReader(true); setLogView('ai-reader'); }}
            aria-selected={logView === 'ai-reader'} aria-controls="ai-reader-panel"
            className={`px-3 py-1 text-xs font-bold rounded-full transition ${logView === 'ai-reader' ? 'bg-natural-sage text-white' : 'bg-natural-cream text-natural-stone border border-natural-border'}`}>
            AI Reader
          </button>
        </div>

        {hasOpenedAiReader && (
          <div id="ai-reader-panel" role="tabpanel" aria-hidden={logView !== 'ai-reader'} hidden={logView !== 'ai-reader'} className="rounded-[24px] border border-natural-border bg-natural-cream p-4 shadow-sm sm:p-5">
            <BookWiki bookId={id} totalPages={book.total_pages} canEdit={!!book.can_edit} />
          </div>
        )}
        {logView !== 'ai-reader' && <>
        {book.can_edit && lenses.length >= 3 && (
          <section className="mb-5 rounded-[24px] border border-natural-sage/30 bg-natural-sage/5 p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">Reading Lens · {lenses.length} sessions</p><h2 className="mt-1 text-base font-bold text-natural-dark">Synthesize this journey</h2><p className="mt-1 text-xs text-natural-stone">Find the thread across your saved session analyses.</p></div>
              <button onClick={synthesizeReadingLens} disabled={lensSynthesizing} className="min-h-11 shrink-0 rounded-full bg-natural-sage px-4 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50">{lensSynthesizing ? 'Synthesizing…' : 'Synthesize this journey'}</button>
            </div>
            {lensSynthesis && <ReadingLensSynthesis text={lensSynthesis} />}
          </section>
        )}
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-natural-cream rounded-[28px] border border-natural-border text-center space-y-2">
            <BookOpen className="w-8 h-8 text-natural-stone" />
            <p className="text-sm font-bold text-natural-dark">No days read yet</p>
            <p className="text-xs text-natural-stone">Tap "Read next session" to generate your first AI summary.</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-natural-cream rounded-[28px] border border-natural-border text-center space-y-2">
            <Search className="w-8 h-8 text-natural-stone" />
            <p className="text-sm font-bold text-natural-dark">No matches for "{search}"</p>
            <p className="text-xs text-natural-stone">Try a different keyword.</p>
          </div>
        ) : (
          <>
            {logView === 'journey' ? (
              <JourneyView logs={filteredLogs} fileType={book.file_type} expanded={journeyExpanded} setExpanded={setJourneyExpanded} />
            ) : (
              <div className="space-y-3">
                {logsByDate.map(([date, dayLogs]) => (
                  <div key={date} className="space-y-1">
                    {dayLogs.map((log, si) => (
                      <div key={log.id} className="relative">
                        {si > 0 && (
                          <div className="flex items-center gap-2 px-4 py-0.5">
                            <div className="flex-1 h-px bg-natural-border" />
                            <span className="text-[9px] text-natural-stone font-sans shrink-0">Session {si + 1} · same day</span>
                            <div className="flex-1 h-px bg-natural-border" />
                          </div>
                        )}
                        <DaySummary summaryMode={book.summary_mode} log={log} bookTitle={book.title} bookAuthor={book.author} bookId={book.id} canEdit={!!book.can_edit} highlight={search} fileType={book.file_type} onRetryComplete={load} />
                        <ReadingLensCard lens={lenses.find((lens) => lens.log_id === log.id)} canEdit={!!book.can_edit} isPreparing={enrichmentPending && pendingEnrichmentLogId === log.id} onRetry={() => retryReadingLens(log.id)} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        </>}
      </div>

      {/* Knowledge Map */}
      {book.can_edit && book.status === 'finished' && logs.length > 0 && (
        <div className="bg-natural-cream border border-natural-border rounded-[24px] p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-natural-dark">Knowledge Map</h3>
            <button onClick={generateMindmap} disabled={mindmapLoading} className="text-[10px] text-natural-stone hover:text-natural-dark flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Regenerate
            </button>
          </div>
          {mindmapLoading
            ? <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-natural-sage" /></div>
            : mindmapData && <MindMap data={mindmapData} bookTitle={book.title} />
          }
        </div>
      )}
      </>}

      {book.can_edit && book.status === 'active' && !headerReadActionVisible && (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-40 sm:inset-x-auto sm:bottom-24 sm:right-6">
          <button onClick={readToday} disabled={advancing}
            aria-label="Read next session"
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-natural-clay px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-natural-dark/20 hover:opacity-90 disabled:opacity-50 cursor-pointer sm:w-auto">
            {advancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} {advancing ? 'Saving…' : 'Read next session'}
          </button>
        </div>
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {/* Finish queue modal */}
      {finishModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setFinishModal(null)}>
          <div className="safe-bottom max-h-[calc(100dvh-2rem)] w-full max-w-sm space-y-4 overflow-y-auto rounded-[28px] border border-natural-border bg-natural-cream p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <p className="text-2xl">🎉</p>
              <h3 className="font-bold text-lg text-natural-dark font-sans">You finished &ldquo;{book?.title}&rdquo;!</h3>
              <p className="text-xs text-natural-stone font-sans">
                Next in your queue: <b className="text-natural-dark">{finishModal.title}</b> by {finishModal.author}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setFinishModal(null)}
                className="flex-1 py-2.5 border border-natural-border rounded-full text-xs font-bold font-sans uppercase tracking-wider text-natural-stone hover:text-natural-dark cursor-pointer">
                Not yet
              </button>
              <button onClick={startFromModal}
                className="flex-1 py-2.5 bg-natural-sage text-white rounded-full text-xs font-bold font-sans uppercase tracking-wider shadow-sm cursor-pointer">
                Start Reading
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
