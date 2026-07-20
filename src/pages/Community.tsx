import React, { useState, useEffect } from 'react';
import CommunityFeed from '../components/CommunityFeed';
import { CommunityPost, Comment } from '../types';
import { Loader2 } from 'lucide-react';

// Community page — keeps the base community feed only.
// (AI Critique / Journal Club removed per project scope.)
export default function Community() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const fetchPosts = async () => {
    setLoadingPosts(true);
    try {
      const response = await fetch('/api/community/posts');
      const data = await response.json();
      if (response.ok) setPosts(data);
    } catch (e) {
      console.error('Failed to load community posts:', e);
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleShareSummary = async (bookTitle: string, bookAuthor: string, summary: string, content: string): Promise<CommunityPost | null> => {
    try {
      const response = await fetch('/api/community/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorName: 'tuanhuytruong13', authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', bookTitle, bookAuthor, summary, content })
      });
      const data = await response.json();
      if (response.ok) { setPosts(prev => [data, ...prev]); return data; }
    } catch (e) { console.error('Error sharing summary:', e); }
    return null;
  };
  const handleLikePost = async (postId: string) => {
    try {
      const r = await fetch(`/api/community/posts/${postId}/like`, { method: 'POST' });
      const data = await r.json();
      if (r.ok) setPosts(prev => prev.map(p => p.id === postId ? data : p));
    } catch (e) { console.error(e); }
  };
  const handleAddComment = async (postId: string, content: string) => {
    try {
      const r = await fetch(`/api/community/posts/${postId}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorName: 'tuanhuytruong13', authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', authorBio: 'Book Enthusiast', content })
      });
      const data = await r.json();
      if (r.ok) setPosts(prev => prev.map(p => p.id === postId ? data : p));
    } catch (e) { console.error(e); }
  };
  const handleTriggerAIComment = async (postId: string, personaId: string): Promise<Comment | null> => {
    try {
      const r = await fetch(`/api/community/posts/${postId}/trigger-ai-reaction`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personaId })
      });
      const data = await r.json();
      if (r.ok) { setPosts(prev => prev.map(p => p.id === postId ? data.post : p)); return data.comment; }
    } catch (e) { console.error(e); }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-natural-dark font-sans">Community</h1>
        <p className="text-xs text-natural-stone font-sans">Shared reading logs from the club</p>
      </div>

      {loadingPosts
        ? <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[32px] border border-natural-border"><Loader2 className="w-8 h-8 text-natural-sage animate-spin" /><p className="text-xs text-natural-stone font-sans mt-3">Assembling community logs...</p></div>
        : <CommunityFeed posts={posts} onLikePost={handleLikePost} onAddComment={handleAddComment} onTriggerAIComment={handleTriggerAIComment} />
      }
    </div>
  );
}
