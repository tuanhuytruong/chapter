import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, ImageIcon } from 'lucide-react';
import { api, fetchCover, uploadBook, deleteUpload } from '../api';
import type { ReadingExperience, SummaryMode } from '../types';

export default function AddBookModal({ onClose, onAdded, onToast }: {
  onClose: () => void;
  onAdded: () => void;
  onToast: (t: { type: 'ok' | 'err'; msg: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [filePath, setFilePath] = useState('');
  const [fileType, setFileType] = useState<'pdf' | 'epub'>('pdf');
  const [dailyPages, setDailyPages] = useState(3);
  const [coverUrl, setCoverUrl] = useState('');
  const [summaryLang, setSummaryLang] = useState<'auto' | 'vi' | 'en'>('auto');
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('casual');
  const [readingExperience, setReadingExperience] = useState<ReadingExperience>('analytical');
  const [addToQueue, setAddToQueue] = useState(false);
  const [autoCover, setAutoCover] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const debounce = useRef<ReturnType<typeof setTimeout>>();
  // Path of a file we uploaded but haven't saved yet — delete it if the user
  // closes the modal without saving.
  const uploadedPathRef = useRef<string | null>(null);
  const submittedRef = useRef(false);

  // Auto-fetch cover from Open Library when title changes (debounced)
  useEffect(() => {
    if (!autoCover || !title.trim()) return;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      const url = await fetchCover(title);
      if (url) setCoverUrl(url);
      setSearching(false);
    }, 600);
    return () => clearTimeout(debounce.current);
  }, [title, autoCover]);

  // On unmount, if a file was uploaded but never saved, clean it up.
  useEffect(() => {
    return () => {
      if (!submittedRef.current && uploadedPathRef.current) {
        deleteUpload(uploadedPathRef.current).catch(() => {});
        uploadedPathRef.current = null;
      }
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !filePath.trim()) {
      onToast({ type: 'err', msg: 'Title and file path are required' });
      return;
    }
    setSubmitting(true);
    try {
      await api.createBook({
        title: title.trim(),
        author: author.trim() || 'Unknown',
        file_path: filePath.trim(),
        file_type: fileType,
        daily_pages: dailyPages,
        cover_url: coverUrl || undefined,
        summary_lang: summaryLang,
        summary_mode: summaryMode,
        reading_experience: readingExperience,
        status: addToQueue ? 'queued' : 'active',
      } as any);
      submittedRef.current = true; // keep the uploaded file
      uploadedPathRef.current = null;
      onToast({ type: 'ok', msg: `Added "${title}"` });
      onAdded();
      onClose();
    } catch (err: any) {
      onToast({ type: 'err', msg: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-swipe-nav-ignore className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-natural-cream rounded-[28px] border border-natural-border shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg text-natural-dark font-sans">Add a Book</h2>
          <button onClick={onClose} className="text-natural-stone hover:text-natural-dark"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="space-y-3 font-sans">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-natural-stone">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required
              className="w-full px-3 py-2 mt-1 bg-natural-cream/50 border border-natural-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage" placeholder="Atomic Habits" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-natural-stone">Author</label>
            <input value={author} onChange={e => setAuthor(e.target.value)}
              className="w-full px-3 py-2 mt-1 bg-natural-cream/50 border border-natural-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage" placeholder="James Clear" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-natural-stone">File *</label>
            <input type="file" accept=".pdf,.epub" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploading(true);
              setUploadPct(0);
              try {
                const r = await uploadBook(f, setUploadPct);
                setFilePath(r.file_path);
                setFileType(r.file_type);
                uploadedPathRef.current = r.file_path; // mark for cleanup if not saved
                onToast({ type: 'ok', msg: `Uploaded ${r.filename}` });
              } catch (err: any) {
                onToast({ type: 'err', msg: err.message });
              } finally {
                setUploading(false);
              }
            }} disabled={uploading}
              className="w-full px-3 py-2 mt-1 bg-natural-cream/50 border border-natural-border rounded-xl text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-natural-sage file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-natural-sage file:text-white file:text-xs" />
            {uploading && (
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-natural-border rounded-full overflow-hidden">
                  <div className="h-full bg-natural-sage transition-all" style={{ width: `${uploadPct}%` }} />
                </div>
                <span className="text-[10px] text-natural-stone">{uploadPct}%</span>
              </div>
            )}
            <p className="text-[10px] text-natural-stone mt-1">Max 100MB · PDF or EPUB</p>
            <input value={filePath} onChange={e => setFilePath(e.target.value)} placeholder="atomic-habits.pdf (if already in books dir)"
              className="w-full px-3 py-2 mt-1 bg-natural-cream/50 border border-natural-border rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-natural-sage" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-natural-stone">Type</label>
              <select value={fileType} onChange={e => setFileType(e.target.value as 'pdf' | 'epub')}
                className="w-full px-3 py-2 mt-1 bg-natural-cream/50 border border-natural-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage">
                <option value="pdf">PDF</option>
                <option value="epub">EPUB</option>
              </select>
            </div>
            <div className="w-28">
              <label className="text-[11px] font-bold uppercase tracking-wider text-natural-stone">{fileType === 'epub' ? 'Chunks/day' : 'Pages/day'}</label>
              <input type="number" min={1} value={dailyPages} onChange={e => setDailyPages(Number(e.target.value))}
                className="w-full px-3 py-2 mt-1 bg-natural-cream/50 border border-natural-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage" />
            </div>
          </div>
          {fileType === 'epub' && <p className="-mt-2 text-[10px] text-natural-stone">EPUB is split into stable reading chunks, not fixed printed pages.</p>}
          <div className="flex items-center gap-2 py-1">
            <input id="addToQueue" type="checkbox" checked={addToQueue} onChange={e => setAddToQueue(e.target.checked)}
              className="accent-natural-sage cursor-pointer" />
            <label htmlFor="addToQueue" className="text-[11px] text-natural-stone font-sans cursor-pointer">
              Add to reading queue instead of starting now
            </label>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-natural-stone">Summary language</label>
            <select value={summaryLang} onChange={e => setSummaryLang(e.target.value as 'auto' | 'vi' | 'en')}
              className="w-full px-3 py-2 mt-1 bg-natural-cream/50 border border-natural-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage">
              <option value="auto">Auto (book's language)</option>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
            <p className="text-[10px] text-natural-stone mt-1">Language used for the AI daily summary. Can be changed later in book settings.</p>
          </div>
          <fieldset>
            <legend className="text-[11px] font-bold uppercase tracking-wider text-natural-stone">Reading experience</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {([['analytical', 'Reading companion', 'Choose Casual or Deep Reading. You can switch between them later.'], ['story', 'Story Thread', 'For fiction and narrative books. Keeps characters, events, and unresolved threads connected. This cannot be changed later.']] as const).map(([value, label, copy]) => (
                <label key={value} className={`min-h-11 cursor-pointer rounded-xl border p-3 text-xs ${readingExperience === value ? 'border-natural-sage bg-natural-sage/10 text-natural-dark' : 'border-natural-border text-natural-stone'}`}>
                  <input className="sr-only" type="radio" name="reading-experience" value={value} checked={readingExperience === value} onChange={() => setReadingExperience(value)} />
                  <span className="block font-bold">{label}</span>
                  <span className="mt-0.5 block text-[10px] leading-relaxed">{copy}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {readingExperience === 'analytical' && <fieldset>
            <legend className="text-[11px] font-bold uppercase tracking-wider text-natural-stone">Summary style</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {([['casual', 'Casual', 'Warm, clear highlights for everyday reading.'], ['deep_reading', 'Deep Reading', 'Argument maps, support, assumptions, and concepts for academic or research books.']] as const).map(([value, label, copy]) => (
                <label key={value} className={`min-h-11 cursor-pointer rounded-xl border p-3 text-xs ${summaryMode === value ? 'border-natural-sage bg-natural-sage/10 text-natural-dark' : 'border-natural-border text-natural-stone'}`}>
                  <input className="sr-only" type="radio" name="summary-mode" value={value} checked={summaryMode === value} onChange={() => setSummaryMode(value)} />
                  <span className="block font-bold">{label}</span>
                  <span className="mt-0.5 block text-[10px] leading-relaxed">{copy}</span>
                </label>
              ))}
            </div>
          </fieldset>}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-natural-stone flex items-center gap-1.5">
              <ImageIcon className="w-3 h-3" /> Cover URL
              <label className="ml-auto flex items-center gap-1 text-[10px] normal-case font-normal cursor-pointer">
                <input type="checkbox" checked={autoCover} onChange={e => setAutoCover(e.target.checked)} className="accent-natural-sage" />
                Auto from Open Library
              </label>
            </label>
            <div className="flex gap-2 mt-1">
              <input value={coverUrl} onChange={e => setCoverUrl(e.target.value)}
                disabled={searching}
                className="flex-1 px-3 py-2 bg-natural-cream/50 border border-natural-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage disabled:opacity-50" placeholder="https://..." />
              {searching && <Loader2 className="w-4 h-4 self-center animate-spin text-natural-sage" />}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-natural-border rounded-full text-xs font-bold font-sans uppercase tracking-wider text-natural-stone hover:text-natural-dark cursor-pointer">Cancel</button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2.5 bg-natural-sage hover:bg-natural-sage-dark disabled:opacity-50 text-white rounded-full text-xs font-bold font-sans uppercase tracking-wider cursor-pointer">
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Add Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
