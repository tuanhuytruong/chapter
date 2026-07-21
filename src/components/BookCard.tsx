import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, BookOpen } from 'lucide-react';
import type { BookRow } from '../types';
import { progressPct, daysToFinish } from '../api';

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  finished: 'Finished',
};
const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  finished: 'bg-blue-100 text-blue-700',
};

const BookCard: React.FC<{ book: BookRow; streak?: number }> = ({ book, streak }) => {
  const navigate = useNavigate();
  const pct = progressPct(book);

  return (
    <button
      onClick={() => navigate(`/books/${book.id}`)}
      className="group bg-white border border-natural-border rounded-[24px] p-4 shadow-sm hover:shadow-md transition text-left flex flex-col gap-3 cursor-pointer"
    >
      <div className="flex gap-4">
        <div className="w-16 h-22 shrink-0 rounded-xl overflow-hidden bg-natural-cream border border-natural-border flex items-center justify-center">
          {book.cover_url ? (
            <img src={book.cover_url} alt={book.title} referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} className="w-full h-full object-cover" />
          ) : (
            <BookOpen className="w-6 h-6 text-natural-stone" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-natural-dark font-sans text-sm leading-tight line-clamp-2">{book.title}</h3>
          <p className="text-[11px] text-natural-stone font-sans italic truncate">by {book.author}</p>
          <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full font-sans ${STATUS_COLOR[book.status]}`}>
            {STATUS_LABEL[book.status]}
          </span>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-natural-stone font-sans mb-1">
          <span>{pct}% · {book.current_page}/{book.total_pages} pg</span>
          {streak ? <span className="flex items-center gap-0.5 text-natural-clay font-bold"><Flame className="w-3 h-3 fill-natural-clay" />{streak}d</span> : null}
        </div>
        <div className="h-1.5 bg-natural-cream rounded-full overflow-hidden">
          <div className="h-full bg-natural-sage rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        {daysToFinish(book) !== null && (
          <p className="text-[10px] text-natural-stone/70 font-sans">~{daysToFinish(book)} days to finish</p>
        )}
      </div>
    </button>
  );
};

export default BookCard;
