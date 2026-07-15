import React, { useState } from 'react';
import { CommunityPost, Comment } from '../types';
import { MessageSquare, Heart, Sparkles, Send, RefreshCw, UserCheck, ChevronDown, ChevronUp } from 'lucide-react';

interface CommunityFeedProps {
  posts: CommunityPost[];
  onLikePost: (postId: string) => Promise<void>;
  onAddComment: (postId: string, content: string) => Promise<void>;
  onTriggerAIComment: (postId: string, personaId: string) => Promise<Comment | null>;
}

export default function CommunityFeed({
  posts,
  onLikePost,
  onAddComment,
  onTriggerAIComment
}: CommunityFeedProps) {
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [expandedComments, setExpandedComments] = useState<{ [postId: string]: boolean }>({});
  const [typingState, setTypingState] = useState<{ [postId: string]: string | null }>({}); // Store personaName that is 'typing'
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLike = (postId: string) => {
    onLikePost(postId);
  };

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  const handlePostCommentSubmit = async (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    const content = commentInputs[postId]?.trim();
    if (!content) return;

    await onAddComment(postId, content);
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    setExpandedComments(prev => ({ ...prev, [postId]: true })); // auto-expand on new comment
  };

  const handleTriggerAIReaction = async (postId: string, personaId: string, personaName: string) => {
    setTypingState(prev => ({ ...prev, [postId]: personaName }));
    setErrorMessage(null);
    try {
      const success = await onTriggerAIComment(postId, personaId);
      if (!success) {
        setErrorMessage("Could not generate AI comment. Verify your GEMINI_API_KEY.");
      }
    } catch (err) {
      setErrorMessage("Something went wrong triggering the AI response.");
    } finally {
      setTypingState(prev => ({ ...prev, [postId]: null }));
      setExpandedComments(prev => ({ ...prev, [postId]: true })); // auto-expand to show new AI comment
    }
  };

  return (
    <div className="space-y-6">
      {/* Feed Header */}
      <div className="border-b border-natural-border pb-5">
        <h2 id="community-feed-heading" className="text-2xl font-serif italic text-natural-dark">Community Journal</h2>
        <p className="text-sm text-natural-stone font-sans">Read daily updates, learn from summaries, and discuss with fellow book lovers and AI experts.</p>
      </div>

      {errorMessage && (
        <div id="feed-error-banner" className="p-4 bg-white border border-natural-clay/30 rounded-2xl text-xs text-natural-clay flex items-center justify-between font-sans">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold text-natural-clay underline cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* Posts List */}
      <div id="posts-list" className="space-y-6">
        {posts.length === 0 ? (
          <div id="empty-feed-view" className="text-center py-12 bg-white rounded-[32px] border border-natural-border shadow-xs p-8">
            <p className="text-sm text-natural-stone font-sans">No community posts yet. Share your daily reading log to post here!</p>
          </div>
        ) : (
          posts.map((post) => {
            const commentsExpanded = !!expandedComments[post.id];
            const currentTyping = typingState[post.id];

            return (
              <div
                id={`post-card-${post.id}`}
                key={post.id}
                className="bg-white border border-natural-border rounded-[32px] p-6 shadow-sm space-y-4 hover:border-natural-clay/30 transition duration-150"
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
                    <span className="font-bold text-natural-dark font-serif">{post.bookTitle}</span>
                    <span className="text-natural-stone ml-1.5 font-sans italic">by {post.bookAuthor}</span>
                  </div>
                  <div className="bg-white border border-natural-border px-3 py-1 rounded-full text-[10px] font-bold text-natural-stone font-sans text-center max-w-[150px] truncate shadow-2xs">
                    {post.summary}
                  </div>
                </div>

                {/* Post thoughts */}
                <p className="text-sm text-natural-muted leading-relaxed font-serif whitespace-pre-wrap">
                  {post.content}
                </p>

                {/* Interactive Options for user-submitted posts (Generate AI Fellow Reactions) */}
                {post.isUserPost && (
                  <div className="bg-natural-cream border border-natural-border/60 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-natural-dark font-sans">
                        <Sparkles className="w-4 h-4 text-natural-clay animate-pulse" />
                        <span>Get AI Book Club Reactions</span>
                      </div>
                      <span className="text-[10px] text-natural-stone font-sans">Click on any companion to review your summary</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        id={`btn-ai-react-elena-${post.id}`}
                        onClick={() => handleTriggerAIReaction(post.id, 'elena', 'Elena Vance')}
                        className="flex flex-col items-center justify-center p-2.5 bg-white hover:bg-natural-cream border border-natural-border hover:border-natural-clay/60 rounded-2xl transition duration-150 group cursor-pointer shadow-2xs"
                        disabled={!!currentTyping}
                      >
                        <img referrerPolicy="no-referrer" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" className="w-8 h-8 rounded-full border border-natural-border object-cover mb-1 group-hover:scale-105 transition" alt="Elena" />
                        <span className="text-[10px] font-bold text-natural-dark font-sans">Elena</span>
                        <span className="text-[8px] text-natural-stone font-sans">Classical Critique</span>
                      </button>
                      <button
                        id={`btn-ai-react-marcus-${post.id}`}
                        onClick={() => handleTriggerAIReaction(post.id, 'marcus', 'Marcus Chen')}
                        className="flex flex-col items-center justify-center p-2.5 bg-white hover:bg-natural-cream border border-natural-border hover:border-natural-clay/60 rounded-2xl transition duration-150 group cursor-pointer shadow-2xs"
                        disabled={!!currentTyping}
                      >
                        <img referrerPolicy="no-referrer" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100" className="w-8 h-8 rounded-full border border-natural-border object-cover mb-1 group-hover:scale-105 transition" alt="Marcus" />
                        <span className="text-[10px] font-bold text-natural-dark font-sans">Marcus</span>
                        <span className="text-[8px] text-natural-stone font-sans">Speculative Concept</span>
                      </button>
                      <button
                        id={`btn-ai-react-sophie-${post.id}`}
                        onClick={() => handleTriggerAIReaction(post.id, 'sophie', 'Sophie Dubois')}
                        className="flex flex-col items-center justify-center p-2.5 bg-white hover:bg-natural-cream border border-natural-border hover:border-natural-clay/60 rounded-2xl transition duration-150 group cursor-pointer shadow-2xs"
                        disabled={!!currentTyping}
                      >
                        <img referrerPolicy="no-referrer" src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100" className="w-8 h-8 rounded-full border border-natural-border object-cover mb-1 group-hover:scale-105 transition" alt="Sophie" />
                        <span className="text-[10px] font-bold text-natural-dark font-sans">Sophie</span>
                        <span className="text-[8px] text-natural-stone font-sans">Mindful Growth</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Engagement counts */}
                <div className="flex items-center justify-between border-t border-natural-cream pt-3.5">
                  <div className="flex items-center gap-4 text-xs text-natural-stone font-sans">
                    <button
                      id={`btn-like-post-${post.id}`}
                      onClick={() => handleLike(post.id)}
                      className="flex items-center gap-1.5 hover:text-natural-clay font-bold transition cursor-pointer"
                    >
                      <Heart className="w-4 h-4 text-natural-stone/40 hover:text-natural-clay fill-current" />
                      <span>{post.likes} Likes</span>
                    </button>
                    <button
                      id={`btn-comments-toggle-${post.id}`}
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-1.5 hover:text-natural-sage font-bold transition cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4 text-natural-stone/40" />
                      <span>{post.comments.length} Comments</span>
                    </button>
                  </div>
                  
                  <button
                    id={`btn-show-hide-comments-${post.id}`}
                    onClick={() => toggleComments(post.id)}
                    className="flex items-center gap-1 text-xs text-natural-stone hover:text-natural-dark transition font-sans cursor-pointer"
                  >
                    {commentsExpanded ? (
                      <>
                        <span>Hide Discussion</span>
                        <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        <span>Open Discussion</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>

                {/* Typing status indicator */}
                {currentTyping && (
                  <div className="flex items-center gap-2 text-xs text-natural-clay pt-1 font-sans">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{currentTyping} is carefully reading your thoughts and writing...</span>
                  </div>
                )}

                {/* Collapsible Comments Section */}
                {commentsExpanded && (
                  <div className="border-t border-natural-cream pt-4 space-y-4">
                    {/* Add Comment Form */}
                    <form onSubmit={(e) => handlePostCommentSubmit(e, post.id)} className="flex gap-2">
                      <input
                        id={`input-comment-${post.id}`}
                        type="text"
                        placeholder="Join the discussion..."
                        value={commentInputs[post.id] || ''}
                        onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                        className="flex-1 px-4 py-2 bg-natural-cream border border-natural-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-sage focus:bg-white text-natural-dark font-sans"
                      />
                      <button
                        id={`btn-submit-comment-${post.id}`}
                        type="submit"
                        className="p-2 text-white bg-natural-sage hover:bg-natural-sage-dark rounded-xl transition duration-150 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>

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
                            <div className="space-y-1 bg-white border border-natural-border rounded-2xl p-4 shadow-2xs flex-1">
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
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
