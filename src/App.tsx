import React, { useState, useEffect } from 'react';
import Bookshelf from './components/Bookshelf';
import CommunityFeed from './components/CommunityFeed';
import AIAnalyzer from './components/AIAnalyzer';
import DiscussionRoom from './components/DiscussionRoom';
import { CommunityPost, Comment } from './types';
import { BookOpen, Users, Sparkles, MessageSquare, Flame, BookMarked, Award, Search, Loader2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'bookshelf' | 'feed' | 'critique' | 'discussions'>('bookshelf');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [streak, setStreak] = useState(4);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // AI Sidebar Recommendations State
  const [recommendationQuery, setRecommendationQuery] = useState('');
  const [recommendationGenre, setRecommendationGenre] = useState('');
  const [recommendedBooks, setRecommendedBooks] = useState<any[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);

  // Initialize and Fetch Community Posts
  useEffect(() => {
    fetchPosts();
    // Track daily reading streak
    const savedStreak = localStorage.getItem('book_reader_streak');
    if (savedStreak) {
      setStreak(Number(savedStreak));
    } else {
      localStorage.setItem('book_reader_streak', '4');
    }
  }, []);

  const fetchPosts = async () => {
    setLoadingPosts(true);
    try {
      const response = await fetch('/api/community/posts');
      const data = await response.json();
      if (response.ok) {
        setPosts(data);
      }
    } catch (e) {
      console.error("Failed to load community posts:", e);
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleShareSummary = async (bookTitle: string, bookAuthor: string, summary: string, content: string): Promise<CommunityPost | null> => {
    try {
      const response = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: "tuanhuytruong13",
          authorAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
          bookTitle,
          bookAuthor,
          summary,
          content
        })
      });
      const data = await response.json();
      if (response.ok) {
        setPosts(prev => [data, ...prev]);
        // Increment streak by 1 if logged reading
        const updatedStreak = streak + 1;
        setStreak(updatedStreak);
        localStorage.setItem('book_reader_streak', String(updatedStreak));
        return data;
      }
    } catch (e) {
      console.error("Error sharing summary:", e);
    }
    return null;
  };

  const handleLikePost = async (postId: string) => {
    try {
      const response = await fetch(`/api/community/posts/${postId}/like`, { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setPosts(prev => prev.map(p => p.id === postId ? data : p));
      }
    } catch (e) {
      console.error("Error liking post:", e);
    }
  };

  const handleAddComment = async (postId: string, content: string) => {
    try {
      const response = await fetch(`/api/community/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: "tuanhuytruong13",
          authorAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
          authorBio: "Book Enthusiast",
          content
        })
      });
      const data = await response.json();
      if (response.ok) {
        setPosts(prev => prev.map(p => p.id === postId ? data : p));
      }
    } catch (e) {
      console.error("Error commenting on post:", e);
    }
  };

  const handleTriggerAIComment = async (postId: string, personaId: string): Promise<Comment | null> => {
    try {
      const response = await fetch(`/api/community/posts/${postId}/trigger-ai-reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId })
      });
      const data = await response.json();
      if (response.ok) {
        setPosts(prev => prev.map(p => p.id === postId ? data.post : p));
        return data.comment;
      }
    } catch (e) {
      console.error("Error triggering AI comment:", e);
    }
    return null;
  };

  const handleFetchRecommendations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recommendationQuery.trim()) return;

    setLoadingRecommendations(true);
    setRecommendedBooks([]);
    setRecommendationError(null);

    try {
      const response = await fetch('/api/gemini/suggest-books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: recommendationQuery,
          genre: recommendationGenre
        })
      });

      const data = await response.json();
      if (response.ok) {
        setRecommendedBooks(data);
      } else {
        setRecommendationError(data.error || "Verify your GEMINI_API_KEY.");
      }
    } catch (err) {
      setRecommendationError("Failed to fetch suggestions.");
    } finally {
      setLoadingRecommendations(false);
    }
  };

  return (
    <div className="min-h-screen bg-natural-bg text-natural-dark flex flex-col font-serif">
      {/* Top Banner Navigation bar */}
      <header className="bg-white border-b border-natural-border sticky top-0 z-40 h-20 flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex justify-between items-center h-full">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-natural-sage rounded-full flex items-center justify-center text-white">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-natural-dark tracking-tight text-xl font-sans">Lumina</span>
                <span className="text-[9px] text-natural-stone font-mono block leading-none tracking-widest uppercase">AI Club</span>
              </div>
            </div>

            {/* Navigation tabs */}
            <nav className="flex space-x-1 sm:space-x-6 self-center font-sans text-xs font-semibold uppercase tracking-widest text-natural-stone">
              {[
                { id: 'bookshelf', label: 'Library', icon: BookMarked },
                { id: 'feed', label: 'Community', icon: Users },
                { id: 'critique', label: 'AI Critique', icon: Sparkles },
                { id: 'discussions', label: 'Journal Club', icon: MessageSquare }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    id={`btn-nav-tab-${tab.id}`}
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 transition duration-150 cursor-pointer ${
                      isActive
                        ? 'text-natural-dark border-b-2 border-natural-dark pb-0.5 font-bold'
                        : 'hover:text-natural-dark'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-4">
              <div className="text-right font-sans hidden md:block">
                <p className="text-[10px] text-natural-stone uppercase tracking-wider font-bold">Current Streak</p>
                <p className="text-sm font-bold text-natural-dark">{streak} Days</p>
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-natural-clay p-0.5 shrink-0">
                <div className="w-full h-full bg-natural-cream rounded-full overflow-hidden flex items-center justify-center text-sm">
                  📖
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Column (Main App Views) */}
        <main className="lg:col-span-3 space-y-6">
          {activeTab === 'bookshelf' && (
            <Bookshelf onShareSummary={handleShareSummary} activeTab={activeTab} />
          )}

          {activeTab === 'feed' && (
            <div className="space-y-4">
              {loadingPosts ? (
                <div id="loading-posts-view" className="flex flex-col items-center justify-center p-12 bg-white rounded-[32px] border border-natural-border text-center space-y-3 shadow-sm">
                  <Loader2 className="w-8 h-8 text-natural-sage animate-spin" />
                  <p className="text-xs text-natural-stone font-sans">Assembling community logs...</p>
                </div>
              ) : (
                <CommunityFeed
                  posts={posts}
                  onLikePost={handleLikePost}
                  onAddComment={handleAddComment}
                  onTriggerAIComment={handleTriggerAIComment}
                />
              )}
            </div>
          )}

          {activeTab === 'critique' && (
            <AIAnalyzer />
          )}

          {activeTab === 'discussions' && (
            <DiscussionRoom />
          )}
        </main>

        {/* Right Column (Community Side Panel & AI Book Search Recommendations) */}
        <aside className="lg:col-span-1 space-y-6">
          
          {/* User Profile / Streaks */}
          <div className="bg-white border border-natural-border rounded-[32px] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <img
                referrerPolicy="no-referrer"
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"
                alt="Profile"
                className="w-11 h-11 rounded-full object-cover border-2 border-natural-cream shadow-sm"
              />
              <div className="min-w-0">
                <span className="text-[10px] text-natural-stone font-bold uppercase tracking-wider block font-sans">Logged In</span>
                <span className="block text-xs font-bold text-natural-dark truncate font-sans" title="tuanhuytruong13@gmail.com">
                  tuanhuytruong13@gmail.com
                </span>
              </div>
            </div>

            {/* Streak Counter */}
            <div className="bg-natural-cream border border-natural-border/60 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Flame className="w-5 h-5 text-natural-clay fill-natural-clay animate-pulse" />
                <div>
                  <span className="block text-xs font-bold text-natural-dark leading-none font-sans">{streak} Days Streak</span>
                  <span className="text-[10px] text-natural-stone font-sans">You're on a reading roll!</span>
                </div>
              </div>
              <div className="p-1.5 bg-white border border-natural-border rounded-lg shadow-xs">
                <Award className="w-4 h-4 text-natural-clay" />
              </div>
            </div>
          </div>

          {/* AI Book Recommendations Widget */}
          <div className="bg-white border border-natural-border rounded-[32px] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-1.5 text-natural-sage">
              <Sparkles className="w-4 h-4 text-natural-clay" />
              <h3 className="font-bold text-xs text-natural-dark uppercase tracking-widest font-sans">Find Your Next Book</h3>
            </div>
            <p className="text-[11px] text-natural-stone font-sans leading-relaxed">
              Describe your current reading mood or topic (e.g. "Space exploration like Interstellar" or "Time management secrets"). Our AI Book Advisor will recommend books instantly.
            </p>

            <form onSubmit={handleFetchRecommendations} className="space-y-3">
              <div>
                <input
                  id="sidebar-recommendation-input"
                  type="text"
                  required
                  placeholder="e.g., Mindfulness or Sci-Fi dystopia..."
                  value={recommendationQuery}
                  onChange={(e) => setRecommendationQuery(e.target.value)}
                  className="w-full px-4 py-2.5 bg-natural-cream/50 border border-natural-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage focus:bg-white font-sans text-natural-dark"
                />
              </div>
              <button
                id="btn-sidebar-recommend"
                type="submit"
                disabled={loadingRecommendations}
                className="w-full py-3 bg-natural-sage hover:bg-natural-sage-dark disabled:bg-natural-stone text-white rounded-full text-xs font-bold font-sans uppercase tracking-wider transition duration-150 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                {loadingRecommendations ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Finding...
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    Get Recommendations
                  </>
                )}
              </button>
            </form>

            {recommendationError && (
              <p className="text-[10px] text-red-600 font-sans leading-normal">{recommendationError}</p>
            )}

            {/* Recommendations List */}
            {recommendedBooks.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-natural-border">
                <span className="text-[10px] font-bold text-natural-stone uppercase tracking-wider block font-sans">Recommended reads</span>
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {recommendedBooks.map((book: any, idx: number) => (
                    <div id={`rec-book-item-${idx}`} key={idx} className="bg-natural-cream border border-natural-border/50 rounded-2xl p-3.5 space-y-1 text-xs">
                      <span className="font-bold text-natural-dark block leading-tight font-sans">{book.title}</span>
                      <span className="text-[10px] text-natural-stone italic block">by {book.author}</span>
                      <p className="text-natural-muted leading-relaxed text-[11px] mt-1 line-clamp-3">{book.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

      </div>
    </div>
  );
}
