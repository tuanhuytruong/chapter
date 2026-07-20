import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, ImageIcon } from 'lucide-react';
import { api, fetchCover } from '../api';

export default function AddBookModal({ onClose, onAdded, onToast }: {
  onClose: () => void;
  onAdded: () => void;
  onToast: (t: { type: 'ok' | 'err'; msg: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [filePath, setFilePath] = useState('');
  const [fileType, setFileType] = useState<'pdf' | 'epub'>('pdf');
  const [dailyPages, setDailyPages] = useState(20);
  const [coverUrl, setCoverUrl] = useState('');
  const [autoCover, setAutoCover] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

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
      });
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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[28px] border border-natural-border shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
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
            <label className="text-[11px] font-bold uppercase tracking-wider text-natural-stone">File path *</label>
            <input value={filePath} onChange={e => setFilePath(e.target.value)} required
              className="w-full px-3 py-2 mt-1 bg-natural-cream/50 border border-natural-border rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-natural-sage" placeholder="/opt/chapter/workspace/books/atomic-habits.pdf" />
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
              <label className="text-[11px] font-bold uppercase tracking-wider text-natural-stone">Pages/day</label>
              <input type="number" min={1} value={dailyPages} onChange={e => setDailyPages(Number(e.target.value))}
                className="w-full px-3 py-2 mt-1 bg-natural-cream/50 border border-natural-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage" />
            </div>
          </div>
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
