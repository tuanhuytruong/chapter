import React, { useState } from 'react';
import { Send, X, Quote } from 'lucide-react';
import type { LogRow } from '../types';

interface ShareSummaryModalProps {
  log: LogRow;
  bookTitle: string;
  bookAuthor: string;
  bookId: string;
  onClose: () => void;
  onShared: () => void;
}

const ShareSummaryModal: React.FC<ShareSummaryModalProps> = ({ log, bookTitle, bookAuthor, bookId, onClose, onShared }) => {
  const [thoughts, setThoughts] = useState('');
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build content body: key insights as bullets + quote if present
  const buildContent = (): string => {
    const lines: string[] = [];
    if (log.key_insights && log.key_insights.length > 0) {
      lines.push('Key insights:');
      log.key_insights.forEach(ins => lines.push(`• ${ins}`));
    }
    if (log.quote) {
      if (lines.length) lines.push('');
      lines.push(`"${log.quote}"`);
    }
    if (thoughts.trim()) {
      if (lines.length) lines.push('');
      lines.push(thoughts.trim());
    }
    return lines.join('\n');
  };

  const handleShare = async () => {
    setSharing(true);
    setError(null);
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: localStorage.getItem('chapter_nickname') || 'Book Lover',
          authorAvatar: localStorage.getItem('chapter_nickname')
            ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(localStorage.getItem('chapter_nickname')!)}`
            : undefined,
          bookTitle,
          bookAuthor,
          book_id: bookId,
          summary: log.summary || '',
          content: buildContent(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onShared();
        onClose();
      } else {
        setError(data.error || 'Failed to share');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-[28px] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-natural-border">
          <h2 className="text-sm font-bold text-natural-dark font-sans">Share summary</h2>
          <button onClick={onClose} className="text-natural-stone hover:text-natural-dark cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview */}
        <div className="p-5 space-y-3">
          <div className="bg-natural-cream rounded-2xl px-4 py-3">
            <p className="text-[10px] font-bold text-natural-clay uppercase tracking-wider font-sans">Book</p>
            <p className="text-sm font-bold text-natural-dark font-serif">{bookTitle}</p>
            <p className="text-xs text-natural-stone italic font-sans">by {bookAuthor}</p>
          </div>

          {log.summary && (
            <div>
              <p className="text-[10px] font-bold text-natural-stone uppercase tracking-wider font-sans mb-1">Summary</p>
              <p className="text-xs text-natural-muted leading-relaxed font-sans bg-natural-cream/50 rounded-xl px-3 py-2">{log.summary}</p>
            </div>
          )}

          {log.key_insights && log.key_insights.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-natural-stone uppercase tracking-wider font-sans mb-1">Key insights</p>
              <ul className="space-y-1">
                {log.key_insights.map((ins, i) => (
                  <li key={i} className="flex gap-1.5 text-[11px] text-natural-muted font-sans">
                    <span className="text-natural-sage mt-0.5">•</span>{ins}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {log.quote && (
            <p className="flex gap-1.5 text-[11px] italic text-natural-stone font-sans border-l-2 border-natural-clay pl-2">
              <Quote className="w-3 h-3 shrink-0 mt-0.5" />{log.quote}
            </p>
          )}

          {/* User's own thoughts */}
          <div>
            <p className="text-[10px] font-bold text-natural-stone uppercase tracking-wider font-sans mb-1">Your thoughts (optional)</p>
            <textarea
              value={thoughts}
              onChange={e => setThoughts(e.target.value)}
              rows={3}
              placeholder="What did you think about today's reading?"
              className="w-full px-3 py-2 text-xs font-sans leading-relaxed bg-natural-cream/50 border border-natural-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-natural-sage"
            />
          </div>

          {error && <p className="text-xs text-red-600 font-sans">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 pb-5 pt-3 border-t border-natural-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[11px] font-bold uppercase text-natural-stone hover:text-natural-dark font-sans cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={sharing}
            className="flex items-center gap-1.5 px-5 py-2 bg-natural-sage hover:opacity-90 disabled:opacity-50 text-white rounded-full text-[11px] font-bold uppercase font-sans cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" /> {sharing ? 'Sharing…' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareSummaryModal;
