import React, { useState } from 'react';
import { CommunityPost, Comment } from '../types';
import { MessageSquare, Sparkles, Send, RefreshCw, UserCheck, BookOpen } from 'lucide-react';

interface CommunityFeedProps {
  posts: CommunityPost[];
  library: Set<string>;
  onAddComment: (postId: string, content: string) => Promise<void>;
  onPostShared?: (postId: string) => void;
}

export default function CommunityFeed({
  posts, library, onAddComment, onPostShared
}: CommunityFeedProps) {
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [showReplyBox, setShowReplyBox] = useState<{ [postId: string]: boolean }>({});
  const [typingState, setTypingState] = useState<{ [postId: string]: string | null }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollingActive, setPollingActive] = useState<{ [postId: string]: boolean }>({});

  const toggleReplyBox = (postId: string) => {
    setShowReplyBox(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handlePostCommentSubmit = async (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    const content = commentInputs[postId]?.trim();
    if (!content) return;

    await onAddComment(postId, content);
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    setShowReplyBox(prev => ({ ...prev, [postId]: false }));
  };

  return (
    <div className="space-y-6">
      {/* Feed Header */}
      <div className="border-b border-natural-border pb-5">
        <h2 id="community-feed-heading" className="text-2xl font-serif italic text-natural-dark">Community Journal</h2>
        <p className="text-sm text-natural-stone font-sans">Read daily updates, learn from summaries, and discuss with fellow book lovers and AI experts.</p>
      </div>

      {errorMessage && (
        <div id="feed-error-banner" className="p-4 bg-natural-cream border border-natural-clay/30 rounded-2xl text-xs text-natural-clay flex items-center justify-between font-sans">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold text-natural-clay underline cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* Posts List */}
      <div id="posts-list" className="space-y-6">
        {posts.length === 0 ? (
          <div id="empty-feed-view" className="text-center py-12 bg-natural-cream rounded-[32px] border border-natural-border shadow-xs p-8">
            <p className="text-sm font-bold text-natural-dark font-sans mb-2">No posts yet</p>
            <p className="text-xs text-natural-stone font-sans leading-relaxed">
              Share today's reading summary to start your book club discussion.
            </p>
          </div>
        ) : (
          posts.map((post) => {
            const currentTyping = typingState[post.id];

            return (
              <div
                id={`post-card-${post.id}`}
                key={post.id}
                className="bg-natural-cream border border-natural-border rounded-[32px] p-6 shadow-sm space-y-4 hover:border-natural-clay/30 transition duration-150"
              >
                {/* Author Info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      referrerPolicy="no-referrer"
                      src={post.authorAvatar}
                      alt={post.authorName}
                      className="w-10 h-10 rounded-full border border-natural-border object-cover"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-natural-dark font-sans">{post.authorName}</span>
                        {post.isUserPost && (
                          <span className="flex items-center gap-0.5 text-[10px] bg-natural-cream text-natural-dark font-bold px-2 py-0.5 rounded-full border border-natural-border font-sans">
                            <UserCheck className="w-3 h-3 text-natural-clay" />
                            You
                          </span>
                        )}
                      </div>
                      <span className="block text-[11px] text-natural-stone font-sans line-clamp-1 max-w-[280px]">
                        {post.authorBio}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-natural-stone font-sans">{post.timestamp}</span>
                </div>

                {/* Book Highlight Ribbon */}
                <div className="bg-natural-cream border border-natural-border/50 rounded-2xl px-5 py-3.5 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-natural-clay uppercase tracking-wider block mb-0.5 font-sans">Reading Log</span>
                    {post.book_id && library.has(post.book_id) && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] text-natural-sage font-bold font-sans ml-1">
                        <BookOpen className="w-2.5 h-2.5" /> In your library
                      </span>
                    )}
                    <span className="font-bold text-natural-dark font-serif">{post.bookTitle}</span>
                    <span className="text-natural-stone ml-1.5 font-sans italic">by {post.bookAuthor}</span>
                  </div>
                  <div className="bg-natural-cream border border-natural-border px-3 py-1 rounded-full text-[10px] font-bold text-natural-stone font-sans text-center max-w-[150px] truncate shadow-2xs">
                    {post.summary}
                  </div>
                </div>

                {/* Post thoughts */}
                <p className="text-sm text-natural-muted leading-relaxed font-serif whitespace-pre-wrap">
                  {post.content}
                </p>

                {/* Book club typing indicator */}
                {pollingActive[post.id] && (
                  <div className="bg-natural-cream border border-natural-border/60 rounded-2xl p-5 flex items-center gap-3">
                    <RefreshCw className="w-4 h-4 text-natural-clay animate-spin" />
                    <span className="text-xs text-natural-dark font-sans">Book club is reading your summary...</span>
                  </div>
                )}

                {/* Engagement + comments count */}
                <div className="flex items-center justify-between border-t border-natural-cream pt-3.5">
                  <div className="flex items-center gap-4 text-xs text-natural-stone font-sans">
                    <button
                      id={`btn-comments-toggle-${post.id}`}
                      className="flex items-center gap-1.5 font-bold"
                    >
                      <MessageSquare className="w-4 h-4 text-natural-stone/40" />
                      <span>{post.comments.length} Comments</span>
                    </button>
                  </div>
                </div>

                {/* Typing status indicator */}
                {currentTyping && (
                  <div className="flex items-center gap-2 text-xs text-natural-clay pt-1 font-sans">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{currentTyping} is carefully reading your thoughts and writing...</span>
                  </div>
                )}

                {/* Comments Section — always visible */}
                <div className="border-t border-natural-cream pt-4 space-y-4">
                  {/* Comments List */}
                  {post.comments.length > 0 && (
                    <div className="space-y-3.5 bg-natural-cream border border-natural-border/50 rounded-2xl p-4 sm:p-5">
                      {post.comments.map((comment) => (
                        <div id={`comment-item-${comment.id}`} key={comment.id} className="flex gap-3 text-xs">
                          <img
                            referrerPolicy="no-referrer"
                            src={comment.authorAvatar}
                            className="w-8 h-8 rounded-full object-cover border border-natural-border flex-shrink-0"
                            alt={comment.authorName}
                          />
                          <div className="space-y-1 bg-natural-cream border border-natural-border rounded-2xl p-4 shadow-2xs flex-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-natural-dark font-sans">{comment.authorName}</span>
                                <span className="text-[9px] text-natural-stone font-sans truncate max-w-[200px]" title={comment.authorBio}>
                                  • {comment.authorBio}
                                </span>
                              </div>
                              <span className="text-[10px] text-natural-stone font-sans flex-shrink-0">{comment.timestamp}</span>
                            </div>
                            <p className="text-natural-muted leading-relaxed font-serif mt-1">{comment.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply toggle — only show if there are AI comments */}
                  {post.comments.length > 0 && !showReplyBox[post.id] && (
                    <button onClick={() => toggleReplyBox(post.id)}
                      className="text-xs text-natural-sage hover:text-natural-clay font-bold font-sans cursor-pointer">
                      Reply to the club
                    </button>
                  )}

                  {/* Reply input */}
                  {showReplyBox[post.id] && (
                    <form onSubmit={(e) => handlePostCommentSubmit(e, post.id)} className="flex gap-2">
                      <input
                        id={`input-comment-${post.id}`}
                        type="text"
                        placeholder="Your reply..."
                        value={commentInputs[post.id] || ''}
                        onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                        className="flex-1 px-4 py-2 bg-natural-cream border border-natural-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage focus:bg-natural-bg text-natural-dark font-sans"
                      />
                      <button
                        id={`btn-submit-comment-${post.id}`}
                        type="submit"
                        className="p-2 text-white bg-natural-sage hover:bg-natural-sage-dark rounded-xl transition duration-150 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
