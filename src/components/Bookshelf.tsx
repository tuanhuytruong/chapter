import React, { useState, useEffect } from 'react';
import { Book, CommunityPost } from '../types';
import { BookOpen, CheckCircle, PlusCircle, Trash2, Calendar, Target, Award, ListPlus, Send, Sparkles } from 'lucide-react';

interface BookshelfProps {
  onShareSummary: (title: string, author: string, summary: string, content: string) => Promise<CommunityPost | null>;
  activeTab: string;
}

const DEFAULT_BOOKS: Book[] = [
  {
    id: "b-1",
    title: "Atomic Habits",
    author: "James Clear",
    totalPages: 320,
    currentPage: 120,
    status: 'reading',
    coverUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400",
    dailyTargetPages: 15,
    startDate: "2026-07-01",
    notes: "Tiny changes compound over time."
  },
  {
    id: "b-2",
    title: "Dune",
    author: "Frank Herbert",
    totalPages: 600,
    currentPage: 0,
    status: 'to_read',
    coverUrl: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400",
    dailyTargetPages: 25,
    notes: "Elena and Marcus keep telling me to read this!"
  },
  {
    id: "b-3",
    title: "Jane Eyre",
    author: "Charlotte Brontë",
    totalPages: 400,
    currentPage: 400,
    status: 'completed',
    coverUrl: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400",
    dailyTargetPages: 20,
    startDate: "2026-06-10",
    endDate: "2026-06-28",
    rating: 5,
    notes: "Masterful study of independence and female autonomy in the Victorian era."
  }
];

export default function Bookshelf({ onShareSummary }: BookshelfProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [filter, setFilter] = useState<'all' | 'reading' | 'to_read' | 'completed'>('reading');
  
  // Form state for adding book
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newTotalPages, setNewTotalPages] = useState(250);
  const [newDailyTarget, setNewDailyTarget] = useState(15);
  const [newNotes, setNewNotes] = useState('');

  // Logging reading state
  const [selectedBookForLog, setSelectedBookForLog] = useState<Book | null>(null);
  const [pagesReadToday, setPagesReadToday] = useState(10);
  const [summaryText, setSummaryText] = useState('');
  const [reflectionText, setReflectionText] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  // Initialize books from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('book_reader_books');
    if (saved) {
      try {
        setBooks(JSON.parse(saved));
      } catch (e) {
        setBooks(DEFAULT_BOOKS);
      }
    } else {
      setBooks(DEFAULT_BOOKS);
      localStorage.setItem('book_reader_books', JSON.stringify(DEFAULT_BOOKS));
    }
  }, []);

  const saveBooks = (updatedBooks: Book[]) => {
    setBooks(updatedBooks);
    localStorage.setItem('book_reader_books', JSON.stringify(updatedBooks));
  };

  const handleAddBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newAuthor) return;

    const newBook: Book = {
      id: `b-${Date.now()}`,
      title: newTitle,
      author: newAuthor,
      totalPages: Number(newTotalPages),
      currentPage: 0,
      status: 'to_read',
      dailyTargetPages: Number(newDailyTarget),
      notes: newNotes,
      coverUrl: `https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400` // generic warm book cover
    };

    const updated = [...books, newBook];
    saveBooks(updated);
    
    // Reset
    setNewTitle('');
    setNewAuthor('');
    setNewTotalPages(250);
    setNewDailyTarget(15);
    setNewNotes('');
    setShowAddForm(false);
  };

  const handleDeleteBook = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to remove this book from your shelf?")) {
      const updated = books.filter(b => b.id !== id);
      saveBooks(updated);
    }
  };

  const handleUpdateProgress = (bookId: string, newPage: number) => {
    const updated = books.map(book => {
      if (book.id === bookId) {
        const pages = Math.min(book.totalPages, Math.max(0, newPage));
        let status = book.status;
        let endDate = book.endDate;
        let startDate = book.startDate;

        if (pages === book.totalPages) {
          status = 'completed';
          endDate = new Date().toISOString().split('T')[0];
        } else if (pages > 0 && book.currentPage === 0) {
          status = 'reading';
          startDate = new Date().toISOString().split('T')[0];
        } else if (pages === 0) {
          status = 'to_read';
        }

        return {
          ...book,
          currentPage: pages,
          status,
          startDate,
          endDate
        };
      }
      return book;
    });
    saveBooks(updated);
  };

  const handleOpenLogModal = (book: Book) => {
    setSelectedBookForLog(book);
    setPagesReadToday(Math.min(book.totalPages - book.currentPage, book.dailyTargetPages || 15));
    setSummaryText('');
    setReflectionText('');
    setShareSuccess(false);
  };

  const handleCloseLogModal = () => {
    setSelectedBookForLog(null);
  };

  const handleSubmitReadingLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookForLog) return;

    setIsSharing(true);
    
    // Update book pages
    const newPage = selectedBookForLog.currentPage + Number(pagesReadToday);
    handleUpdateProgress(selectedBookForLog.id, newPage);

    // If user provided a summary & reflection, share to community!
    if (summaryText.trim() && reflectionText.trim()) {
      await onShareSummary(
        selectedBookForLog.title,
        selectedBookForLog.author,
        summaryText.trim(),
        reflectionText.trim()
      );
      setShareSuccess(true);
    }

    setIsSharing(false);
    setTimeout(() => {
      handleCloseLogModal();
    }, 1500);
  };

  const filteredBooks = books.filter(b => {
    if (filter === 'all') return true;
    return b.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Shelf Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-natural-border pb-5">
        <div>
          <h2 id="bookshelf-heading" className="text-2xl font-serif italic text-natural-dark">My Library</h2>
          <p className="text-sm text-natural-stone font-sans">Track targets, log progress, and write summaries to share with friends.</p>
        </div>
        <button
          id="btn-add-book-trigger"
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold font-sans uppercase tracking-wider text-white bg-natural-sage hover:bg-natural-sage-dark rounded-full transition duration-150 shadow-sm self-start sm:self-center cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          Add New Book
        </button>
      </div>

      {/* Add Book Form */}
      {showAddForm && (
        <form id="form-add-book" onSubmit={handleAddBook} className="p-6 bg-natural-cream border border-natural-border rounded-[32px] shadow-sm space-y-4">
          <h3 className="font-serif italic text-lg text-natural-dark">Add a Book to your Shelf</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="input-book-title" className="block text-xs font-bold text-natural-stone uppercase mb-1 font-sans">Book Title</label>
              <input
                id="input-book-title"
                type="text"
                required
                placeholder="e.g., Dune or Atomic Habits"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-natural-cream/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-sage focus:bg-natural-bg text-natural-dark font-sans"
              />
            </div>
            <div>
              <label htmlFor="input-book-author" className="block text-xs font-bold text-natural-stone uppercase mb-1 font-sans">Author</label>
              <input
                id="input-book-author"
                type="text"
                required
                placeholder="e.g., Frank Herbert"
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                className="w-full px-4 py-2.5 bg-natural-cream/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-sage focus:bg-natural-bg text-natural-dark font-sans"
              />
            </div>
            <div>
              <label htmlFor="input-book-pages" className="block text-xs font-bold text-natural-stone uppercase mb-1 font-sans">Total Pages</label>
              <input
                id="input-book-pages"
                type="number"
                min="1"
                required
                value={newTotalPages}
                onChange={(e) => setNewTotalPages(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-natural-cream/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-sage focus:bg-natural-bg text-natural-dark font-sans"
              />
            </div>
            <div>
              <label htmlFor="input-book-target" className="block text-xs font-bold text-natural-stone uppercase mb-1 font-sans">Daily Reading Target (Pages)</label>
              <input
                id="input-book-target"
                type="number"
                min="1"
                required
                value={newDailyTarget}
                onChange={(e) => setNewDailyTarget(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-natural-cream/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-sage focus:bg-natural-bg text-natural-dark font-sans"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="input-book-notes" className="block text-xs font-bold text-natural-stone uppercase mb-1 font-sans">Personal Notes / Why you want to read it</label>
              <textarea
                id="input-book-notes"
                placeholder="Write an inspirational note or reminder..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 bg-natural-cream/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-sage focus:bg-natural-bg resize-none text-natural-dark font-sans"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              id="btn-cancel-add-book"
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-5 py-2 text-xs font-bold font-sans uppercase tracking-wider text-natural-stone hover:bg-natural-cream rounded-full transition duration-150 cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-submit-add-book"
              type="submit"
              className="px-5 py-2 text-xs font-bold font-sans uppercase tracking-wider text-white bg-natural-sage hover:bg-natural-sage-dark rounded-full transition duration-150 shadow-sm cursor-pointer"
            >
              Save to Shelf
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1.5 p-1.5 bg-natural-cream rounded-full w-fit">
        {(['reading', 'to_read', 'completed', 'all'] as const).map((tab) => (
          <button
            id={`tab-filter-${tab}`}
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-1.5 text-xs font-bold font-sans uppercase tracking-wider rounded-full transition duration-150 cursor-pointer ${
              filter === tab
                ? 'bg-natural-cream text-natural-dark shadow-sm'
                : 'text-natural-stone hover:text-natural-dark'
            }`}
          >
            {tab === 'to_read' ? 'To Read' : tab}
          </button>
        ))}
      </div>

      {/* Book Grid */}
      {filteredBooks.length === 0 ? (
        <div id="empty-shelf-view" className="flex flex-col items-center justify-center p-12 bg-natural-cream border border-dashed border-natural-border rounded-[32px] text-center shadow-sm">
          <BookOpen className="w-12 h-12 text-natural-stone/40 mb-3" />
          <h3 className="font-serif italic text-lg text-natural-dark">No books found</h3>
          <p className="text-xs text-natural-stone font-sans mt-1 mb-4 max-w-xs">You don't have any books listed under '{filter}'. Add a new book to start tracking your reading logs.</p>
          <button
            id="btn-empty-add-book"
            onClick={() => setShowAddForm(true)}
            className="px-5 py-2 text-xs font-bold font-sans uppercase tracking-wider text-natural-sage bg-natural-cream hover:bg-natural-border rounded-full transition duration-150 cursor-pointer"
          >
            Add your first book
          </button>
        </div>
      ) : (
        <div id="bookshelf-grid" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredBooks.map((book) => {
            const progressPercent = Math.round((book.currentPage / book.totalPages) * 100);
            return (
              <div
                id={`book-card-${book.id}`}
                key={book.id}
                className="group relative flex gap-5 p-6 bg-natural-cream border border-natural-border rounded-[32px] shadow-sm hover:shadow-md transition duration-200 overflow-hidden"
              >
                {/* Book Cover */}
                <div className="w-20 sm:w-24 h-28 sm:h-32 rounded-xl bg-natural-cream border border-natural-border overflow-hidden flex-shrink-0 shadow-sm relative">
                  <img
                    referrerPolicy="no-referrer"
                    src={book.coverUrl}
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-black/5" />
                </div>

                {/* Book Details */}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div className="relative">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-bold text-natural-dark leading-snug truncate pr-6 font-serif group-hover:text-natural-clay transition duration-150 text-base">
                        {book.title}
                      </h3>
                      <button
                        id={`btn-delete-book-${book.id}`}
                        onClick={(e) => handleDeleteBook(book.id, e)}
                        className="absolute right-0 top-0 p-1 text-natural-stone/40 hover:text-natural-clay rounded-lg hover:bg-natural-cream transition duration-150 cursor-pointer"
                        title="Remove Book"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-natural-stone font-sans italic">by {book.author}</p>
                    
                    {book.notes && (
                      <p className="text-[11px] text-natural-muted mt-1 line-clamp-1 italic font-serif leading-normal">
                        "{book.notes}"
                      </p>
                    )}
                  </div>

                  {/* Progress info */}
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between items-end text-[11px] font-sans">
                      <span className="text-natural-stone font-medium">Progress</span>
                      <span className="font-bold text-natural-dark font-mono">
                        {book.currentPage}/{book.totalPages} pgs ({progressPercent}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-natural-cream rounded-full overflow-hidden">
                      <div
                        className="h-full bg-natural-sage rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="flex items-center justify-between gap-2 mt-4 pt-2 border-t border-natural-cream">
                    <div className="flex items-center gap-1.5 text-[10px] text-natural-stone font-bold font-sans uppercase tracking-wider">
                      <Target className="w-3.5 h-3.5 text-natural-clay" />
                      <span>Goal: {book.dailyTargetPages} pgs/day</span>
                    </div>

                    {book.status !== 'completed' ? (
                      <button
                        id={`btn-log-progress-${book.id}`}
                        onClick={() => handleOpenLogModal(book)}
                        className="px-3.5 py-1.5 text-[11px] font-bold font-sans uppercase tracking-wider text-natural-sage bg-natural-cream hover:bg-natural-border rounded-full transition duration-150 flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Award className="w-3.5 h-3.5 text-natural-clay" />
                        Log Reading
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold font-sans uppercase tracking-tighter text-natural-sage bg-natural-cream px-3 py-1.5 rounded-full border border-natural-border">
                        <CheckCircle className="w-3.5 h-3.5 text-natural-clay" />
                        Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reading Log and Share Modal */}
      {selectedBookForLog && (
        <div id="modal-log-reading" className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-natural-cream rounded-[32px] border border-natural-border w-full max-w-lg p-6 sm:p-8 shadow-2xl relative max-h-[90vh] flex flex-col">
            <h3 className="text-xl font-bold text-natural-dark border-b border-natural-border pb-3 font-serif italic flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-natural-clay" />
              Log Reading - {selectedBookForLog.title}
            </h3>

            {shareSuccess ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                <div className="w-16 h-16 bg-natural-cream rounded-full flex items-center justify-center text-natural-clay">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h4 className="font-serif italic text-lg text-natural-dark">Reading Log Shared!</h4>
                <p className="text-sm text-natural-stone font-sans max-w-xs">
                  Your reading progress has been updated, and your summary has been posted to the community feed. Get ready for responses!
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReadingLog} className="space-y-4 pt-4 overflow-y-auto flex-1 pr-1">
                {/* Pages logged */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="input-pages-read" className="block text-xs font-bold text-natural-stone uppercase font-sans">Pages Read Today</label>
                    <span className="text-xs text-natural-stone font-sans italic">Current page: {selectedBookForLog.currentPage} / {selectedBookForLog.totalPages}</span>
                  </div>
                  <input
                    id="input-pages-read"
                    type="number"
                    min="1"
                    max={selectedBookForLog.totalPages - selectedBookForLog.currentPage}
                    required
                    value={pagesReadToday}
                    onChange={(e) => setPagesReadToday(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-natural-cream/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-sage focus:bg-natural-bg text-natural-dark font-sans"
                  />
                </div>

                {/* Community Share option section */}
                <div className="bg-natural-cream rounded-2xl p-5 border border-natural-border/60 space-y-3">
                  <div className="flex items-center gap-2">
                    <ListPlus className="w-4 h-4 text-natural-sage" />
                    <span className="text-xs font-bold text-natural-dark uppercase font-sans tracking-wide">Share with the Community</span>
                  </div>
                  <p className="text-xs text-natural-stone font-sans leading-relaxed">
                    Write a brief summary of what happened and your personal thoughts. Sharing posts logs your entry onto the <strong>Community Feed</strong> where fellow readers (and our clever AI critics) will react!
                  </p>

                  <div className="space-y-3 pt-1">
                    <div>
                      <label htmlFor="input-share-summary" className="block text-[10px] font-bold text-natural-stone uppercase mb-1 font-sans">One-sentence Summary Hook</label>
                      <input
                        id="input-share-summary"
                        type="text"
                        placeholder="e.g., A deep dive into the 4 laws of habit building."
                        value={summaryText}
                        onChange={(e) => setSummaryText(e.target.value)}
                        className="w-full px-3.5 py-2 bg-natural-cream border border-natural-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage text-natural-dark font-sans"
                      />
                    </div>
                    <div>
                      <label htmlFor="input-share-reflection" className="block text-[10px] font-bold text-natural-stone uppercase mb-1 font-sans">Your detailed thoughts / reflection</label>
                      <textarea
                        id="input-share-reflection"
                        placeholder="What stood out to you? Did you learn anything new? Critiques?"
                        rows={3}
                        value={reflectionText}
                        onChange={(e) => setReflectionText(e.target.value)}
                        className="w-full px-3.5 py-2 bg-natural-cream border border-natural-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage resize-none text-natural-dark font-sans"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="flex justify-end gap-3 pt-3 border-t border-natural-cream">
                  <button
                    id="btn-close-log-modal"
                    type="button"
                    onClick={handleCloseLogModal}
                    className="px-5 py-2 text-xs font-bold font-sans uppercase tracking-wider text-natural-stone hover:bg-natural-cream rounded-full transition cursor-pointer"
                    disabled={isSharing}
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-submit-log-reading"
                    type="submit"
                    className="flex items-center gap-1.5 px-6 py-2.5 text-xs font-bold font-sans uppercase tracking-wider text-white bg-natural-sage hover:bg-natural-sage-dark rounded-full transition shadow-sm cursor-pointer"
                    disabled={isSharing}
                  >
                    {isSharing ? (
                      "Saving..."
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Save Reading Log
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
