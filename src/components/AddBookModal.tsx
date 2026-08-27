import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, ImageIcon } from 'lucide-react';
import { api, fetchCover, uploadBook, deleteUpload } from '../api';
import type { ReadingExperience, SummaryMode } from '../types';
import { GuideCard } from '../onboarding';
import ChapterDropdown from './ChapterDropdown';
import { captureAnalyticsEvent } from "../analytics";

export default function AddBookModal({ onClose, onAdded, onToast }: {
  onClose: () => void;
  onAdded: () => void;
  onToast: (t: { type: 'ok' | 'err'; msg: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [readingIntention, setReadingIntention] = useState('');
  const [upload, setUpload] = useState<{ filePath: string; filename: string; fileType: 'pdf' | 'epub' } | null>(null);
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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Path of a file we uploaded but haven't saved yet — delete it if the user
  // closes the modal without saving.
  const uploadedPathRef = useRef<string | null>(null);
  const submittedRef = useRef(false);
  const uploadAttemptRef = useRef(0);
  const filePath = upload?.filePath ?? '';
  const uploadedFilename = upload?.filename ?? '';
  // The server-detected type is canonical: do not submit a mismatched manual selection.
  const uploadReady = !uploading && Boolean(upload?.filePath.trim()) && fileType === upload?.fileType;

  const clearUpload = () => {
    setUpload(null);
    setUploadPct(0);
    setFileType('pdf');
  };

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
    if (!title.trim()) {
      onToast({ type: 'err', msg: 'A title is required' });
      return;
    }
    if (!uploadReady) {
      onToast({ type: 'err', msg: uploading ? 'Please wait for the file upload to finish' : 'Choose a PDF or EPUB and wait for it to finish uploading' });
      return;
    }
    setSubmitting(true);
    try {
      const book = await api.createBook({
        title: title.trim(),
        author: author.trim() || 'Unknown',
        reading_intention: readingIntention.trim() || null,
        file_path: filePath.trim(),
        file_type: fileType,
        daily_pages: dailyPages,
        cover_url: coverUrl || undefined,
        summary_lang: summaryLang,
        summary_mode: summaryMode,
        reading_experience: readingExperience,
        status: addToQueue ? 'queued' : 'active',
      } as any);
      captureAnalyticsEvent("book_added", {
        book_id: book.id,
        file_type: book.file_type,
        reading_experience: book.reading_experience,
        initial_status: book.status,
        has_reading_intention: Boolean(readingIntention.trim()),
      });
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

  return createPortal(
    <div data-swipe-nav-ignore className="fixed inset-0 z-[100] flex justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="add-book-title" className="my-auto w-full max-w-4xl rounded-[28px] border border-natural-border bg-natural-cream p-5 shadow-xl sm:p-6" onClick={e => e.stopPropagation()}>
        <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto pr-1">
        <div className="flex items-center justify-between">
          <h2 id="add-book-title" className="font-bold text-lg text-natural-dark font-sans">Add a Book</h2>
          <button onClick={onClose} className="text-natural-stone hover:text-natural-dark"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="space-y-3 font-sans md:grid md:grid-cols-2 md:gap-x-5 md:gap-y-3 md:space-y-0">
          <div className="md:col-span-2"><GuideCard step="add_book" eyebrow="Choose your companion" title="Pick the reading experience that fits this book"><p><strong className="text-natural-dark">Reading Companion</strong> is for ideas and reflection: choose Casual or Deep Reading, and switch between them later. <strong className="text-natural-dark">Story Thread</strong> is for fiction: it follows people and open threads across sessions, and stays locked to protect that continuity.</p></GuideCard></div>
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
            <label htmlFor="reading-intention" className="text-[11px] font-bold uppercase tracking-wider text-natural-stone">Reading intention <span className="normal-case font-normal">(optional)</span></label>
            <textarea id="reading-intention" value={readingIntention} onChange={e => setReadingIntention(e.target.value)} maxLength={500} rows={3}
              className="mt-1 w-full resize-y rounded-xl border border-natural-border bg-natural-cream/50 px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-natural-sage" placeholder="What do you hope to get from this book?" />
            <p className="mt-1 text-[10px] text-natural-stone">A private note for your end-of-book reflection.</p>
          </div>
          <div className="md:row-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-natural-stone">File *</label>
            <input type="file" accept=".pdf,.epub" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              captureAnalyticsEvent("book_upload_started", {
                selected_file_type: f.name.toLowerCase().endsWith(".epub") ? "epub" : f.name.toLowerCase().endsWith(".pdf") ? "pdf" : "other",
                size_bytes: f.size,
              });
              const attempt = ++uploadAttemptRef.current;
              setUploadError(null);
              const oldPath = uploadedPathRef.current;
              uploadedPathRef.current = null;
              clearUpload();
              if (oldPath) deleteUpload(oldPath).catch(() => {});
              setUploading(true);
              try {
                const r = await uploadBook(f, setUploadPct);
                if (attempt !== uploadAttemptRef.current) {
                  deleteUpload(r.file_path).catch(() => {});
                  return;
                }
                setUpload({ filePath: r.file_path, filename: r.filename, fileType: r.file_type });
                setFileType(r.file_type);
                captureAnalyticsEvent("book_upload_completed", {
                  file_type: r.file_type,
                  size_bytes: r.size,
                });
                setUploadError(null);
                uploadedPathRef.current = r.file_path; // mark for cleanup if not saved
                onToast({ type: 'ok', msg: `Uploaded ${r.filename}` });
              } catch (err: any) {
                if (attempt === uploadAttemptRef.current) {
                  clearUpload();
                  captureAnalyticsEvent("book_upload_failed", {
                    error_kind: String(err?.message || "").includes("network") ? "network" : "upload_rejected",
                  });
                  setUploadError(err.message || 'Could not upload this file. Please choose another PDF or EPUB.');
                }
              } finally {
                if (attempt === uploadAttemptRef.current) setUploading(false);
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
            {!uploading && upload && !uploadReady && <p className="text-[10px] text-natural-stone mt-1">Use the server-detected {upload.fileType.toUpperCase()} type to add this file.</p>}
            {!uploading && !upload && <p className="text-[10px] text-natural-stone mt-1">Choose a file to enable Add Book.</p>}
            {uploadError && <p role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800">{uploadError}</p>}
            {uploadedFilename && (
              <div aria-label="Uploaded file" title={uploadedFilename}
                className="mt-1 w-full truncate rounded-xl border border-natural-border bg-natural-cream/30 px-3 py-2 text-xs font-mono text-natural-stone/70 cursor-default">
                {uploadedFilename}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <ChapterDropdown label="Type" value={fileType} onChange={setFileType} options={[{ value: 'pdf', label: 'PDF' }, { value: 'epub', label: 'EPUB' }]} />
            </div>
            <div className="w-28">
              <label className="text-[11px] font-bold uppercase tracking-wider text-natural-stone">{fileType === 'epub' ? 'Chunks/day' : 'Pages/day'}</label>
              <input type="number" min={1} max={20} step={1} inputMode="numeric" value={dailyPages} onFocus={e => e.currentTarget.select()} onChange={e => {
                const next = e.currentTarget.valueAsNumber;
                if (Number.isFinite(next)) setDailyPages(Math.min(20, Math.max(1, Math.trunc(next))));
              }}
                className="w-full px-3 py-2 mt-1 bg-natural-cream/50 border border-natural-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage" />
            </div>
          </div>
          {fileType === 'epub' && <p className="-mt-2 text-[10px] text-natural-stone">EPUB is split into stable reading chunks, not fixed printed pages.</p>}
          <div className="md:col-start-2">
            <ChapterDropdown id="summaryLang" label="Summary language" value={summaryLang} onChange={setSummaryLang} options={[{ value: 'auto', label: "Auto (book's language)" }, { value: 'vi', label: 'Tiếng Việt' }, { value: 'en', label: 'English' }]} />
            <p className="text-[10px] text-natural-stone mt-1">Language used for the AI daily summary. Can be changed later in book settings.</p>
          </div>
          <div className="md:col-span-2 flex items-center gap-2 py-1">
            <input id="addToQueue" type="checkbox" checked={addToQueue} onChange={e => setAddToQueue(e.target.checked)}
              className="accent-natural-sage cursor-pointer" />
            <label htmlFor="addToQueue" className="text-[11px] text-natural-stone font-sans cursor-pointer">
              Add to reading queue instead of starting now
            </label>
          </div>
          <fieldset className="md:col-span-2">
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

          <div className="flex gap-2 pt-2 md:col-span-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-natural-border rounded-full text-xs font-bold font-sans uppercase tracking-wider text-natural-stone hover:text-natural-dark cursor-pointer">Cancel</button>
            <button type="submit" disabled={submitting || uploading || !uploadReady}
              className="flex-1 py-2.5 bg-natural-sage hover:bg-natural-sage-dark disabled:opacity-50 text-white rounded-full text-xs font-bold font-sans uppercase tracking-wider cursor-pointer">
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Add Book'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
