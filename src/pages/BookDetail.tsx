import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Flame, BookOpen, Loader2, Zap, Settings2, ArrowLeft, Trash2, ImageIcon, Search, X, CheckCircle, RotateCcw, RefreshCw } from 'lucide-react';
import { api, computeStreak, progressPct, daysToFinish, fetchCover } from '../api';
import type { BookRow, LogRow } from '../types';
import DaySummary from '../components/DaySummary';
import StreakHeatmap from '../components/StreakHeatmap';
import ReadingForecast from '../components/ReadingForecast';
import ChapterMarkers from '../components/ChapterMarkers';
import Toast from '../components/Toast';
import JourneyView from '../components/JourneyView';
import MindMap from '../components/MindMap';
import type { MindMapData } from '../components/MindMap';

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
  const [searchingCover, setSearchingCover] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [finishModal, setFinishModal] = useState<BookRow | null>(null);
  const [search, setSearch] = useState('');
  const [insightIdx, setInsightIdx] = useState(0);
  const [logView, setLogView] = useState<'list' | 'journey'>('list');
  const [journeyExpanded, setJourneyExpanded] = useState<string | null>(null);
  const [mindmapData, setMindmapData] = useState<MindMapData | null>(null);
  const [mindmapLoading, setMindmapLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [b, l] = await Promise.all([api.getBook(id), api.getLog(id)]);
      setBook(b);
      setDailyPages(b.daily_pages);
      setStatus(b.status);
      setTitle(b.title);
      setAuthor(b.author);
      setCoverUrl(b.cover_url || '');
      setSummaryLang(b.summary_lang || 'auto');
      setLogs(l);
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Hooks must run before loading/not-found early returns; otherwise React crashes
  // after the first load with a different hook count.
  useEffect(() => {
    const insights = logs.slice(0, 3).flatMap(l => l.key_insights || []).slice(0, 3);
    if (insights.length < 2) return;
    const iv = setInterval(() => setInsightIdx(i => (i + 1) % insights.length), 4000);
    return () => clearInterval(iv);
  }, [logs]);

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
      setToast({
        type: 'ok',
        msg: hasReadToday
          ? `Session ${sessionCount + 1} done — another summary generated`
          : 'Read today — summary generated'
      });
      await load();
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
    if (!confirm(`Delete "${book?.title}"? Reading log is kept.`)) return;
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

  // Feature 5: Highlight reel — 3 most recent insights
  const recentInsights = logs.slice(0, 3).flatMap(l => l.key_insights || []).slice(0, 3);

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
        <button onClick={deleteBook} disabled={deleting}
          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
      </div>

      {/* Header */}
      <div className="flex gap-5 bg-natural-cream border border-natural-border rounded-[28px] p-5 shadow-sm">
        <div className="w-24 h-32 shrink-0 rounded-xl overflow-hidden bg-natural-cream border border-natural-border flex items-center justify-center">
          {book.cover_url ? <img src={book.cover_url} alt={book.title} referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} className="w-full h-full object-cover" /> : <BookOpen className="w-8 h-8 text-natural-stone" />}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-xl text-natural-dark leading-tight">{book.title}</h1>
          <p className="text-xs text-natural-stone italic mb-2">by {book.author}</p>
          <div className="flex items-center gap-3 mb-3">
            <span className="flex items-center gap-1 text-natural-clay font-bold text-sm"><Flame className="w-4 h-4 fill-natural-clay" />{streak}d streak</span>
            {daysToFinish(book) !== null && (
              <span className="text-[11px] text-natural-stone/70">~{daysToFinish(book)} days left</span>
            )}
            <span className="text-[11px] text-natural-stone">{logs.length} days read</span>
          </div>
          <div className="h-2 bg-natural-cream rounded-full overflow-hidden mb-1">
            <div className="h-full bg-natural-sage rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <ChapterMarkers book={book} logs={logs} />
          <p className="text-[10px] text-natural-stone">{pct}% · {book.current_page}/{book.total_pages} pages</p>
          {recentInsights.length > 0 && (
            <p key={insightIdx} className="text-[11px] text-natural-muted italic mt-1 line-clamp-1 animate-[fadeIn_0.4s_ease]">
              💡 {recentInsights[insightIdx]}
            </p>
          )}
        </div>
        <div className="self-start flex flex-col items-end gap-2">
          {book.status === 'finished' ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-4 py-2.5 bg-natural-border text-natural-stone rounded-full text-xs font-bold uppercase tracking-wider">
                <CheckCircle className="w-3.5 h-3.5" /> Finished
              </span>
              <button onClick={startReread}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-natural-border hover:border-natural-sage text-natural-stone hover:text-natural-dark rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5" /> Re-read
              </button>
            </div>
          ) : (
            <>
              <button onClick={readToday} disabled={advancing || book.status === 'finished'}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-natural-clay hover:opacity-90 disabled:opacity-50 text-white rounded-full text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer">
                {advancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} {hasReadToday ? `Read More · Session ${sessionCount + 1}` : 'Read Today'}
              </button>
              {pct >= 85 && book.status === 'active' && (
                <button onClick={markFinished}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-natural-sage hover:bg-natural-sage-dark text-white rounded-full text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer">
                  <CheckCircle className="w-3.5 h-3.5" /> Mark Finished
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Settings + Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 bg-natural-cream border border-natural-border rounded-[24px] p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-natural-dark flex items-center gap-1.5"><Settings2 className="w-4 h-4" /> Settings</h3>
            {!editing && <button onClick={() => setEditing(true)} className="text-[11px] text-natural-sage font-bold">Edit</button>}
          </div>
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-1.5 mt-1 bg-natural-cream/50 border border-natural-border rounded-xl text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Author</label>
                <input value={author} onChange={e => setAuthor(e.target.value)} className="w-full px-3 py-1.5 mt-1 bg-natural-cream/50 border border-natural-border rounded-xl text-xs" />
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
                <input type="number" min={1} value={dailyPages} onChange={e => setDailyPages(Number(e.target.value))} className="w-full px-3 py-1.5 mt-1 bg-natural-cream/50 border border-natural-border rounded-xl text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Language</label>
                <select value={summaryLang} onChange={e => setSummaryLang(e.target.value as 'auto' | 'vi' | 'en')}
                  className="w-full px-3 py-1.5 mt-1 bg-natural-cream/50 border border-natural-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage">
                  <option value="auto">Auto (book's language)</option>
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as any)}
                  className="w-full px-3 py-1.5 mt-1 bg-natural-cream/50 border border-natural-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage">
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
              <p>Pages/day: <b className="text-natural-dark">{book.daily_pages}</b></p>
              <p>Status: <b className="text-natural-dark capitalize">{book.status}</b></p>
              <p>File: <span className="font-mono text-[10px]">{book.file_type.toUpperCase()}</span></p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-natural-cream border border-natural-border rounded-[24px] p-4 shadow-sm">
          <h3 className="font-bold text-sm text-natural-dark mb-3">Reading activity</h3>
          <StreakHeatmap logs={logs} />
          <ReadingForecast book={book} logs={logs} />
        </div>
      </div>

      {/* Timeline */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-bold text-sm text-natural-dark font-sans flex-1">Daily Summaries</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-natural-stone" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search summaries..."
              className="pl-7 pr-3 py-1.5 text-xs bg-natural-cream border border-natural-border rounded-full focus:outline-none focus:ring-2 focus:ring-natural-sage w-44" />
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
        </div>
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-natural-cream rounded-[28px] border border-natural-border text-center space-y-2">
            <BookOpen className="w-8 h-8 text-natural-stone" />
            <p className="text-sm font-bold text-natural-dark">No days read yet</p>
            <p className="text-xs text-natural-stone">Tap "Read Today" to generate your first AI summary.</p>
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
              <JourneyView logs={filteredLogs} expanded={journeyExpanded} setExpanded={setJourneyExpanded} />
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
                        <DaySummary log={log} bookTitle={book.title} bookAuthor={book.author} bookId={book.id} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Knowledge Map */}
      {book.status === 'finished' && logs.length > 0 && (
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

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {/* Finish queue modal */}
      {finishModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setFinishModal(null)}>
          <div className="bg-natural-cream rounded-[28px] border border-natural-border shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
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
