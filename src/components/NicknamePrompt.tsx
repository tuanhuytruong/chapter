import React, { useState, useEffect } from 'react';
import { User, Sparkles, X } from 'lucide-react';

const NICKNAME_KEY = 'chapter_nickname';

interface Props {
  open?: boolean;
  onDone?: () => void;
}

export default function NicknamePrompt({ open, onDone }: Props) {
  const [showLocal, setShowLocal] = useState(false);
  const [nickname, setNickname] = useState('');

  useEffect(() => {
    if (open === true) {
      setShowLocal(true);
      const existing = localStorage.getItem(NICKNAME_KEY);
      setNickname(existing || '');
    }
  }, [open]);

  useEffect(() => {
    if (open !== undefined) return; // controlled
    const existing = localStorage.getItem(NICKNAME_KEY);
    if (!existing) setShowLocal(true);
  }, [open]);

  const visible = open !== undefined ? open : showLocal;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) return;
    localStorage.setItem(NICKNAME_KEY, trimmed);
    setShowLocal(false);
    onDone?.();
  };

  const handleClose = () => {
    setShowLocal(false);
    onDone?.();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-[28px] shadow-xl w-full max-w-sm p-6 text-center space-y-4">
        <div className="w-12 h-12 bg-natural-sage/20 rounded-full flex items-center justify-center mx-auto">
          <User className="w-6 h-6 text-natural-sage" />
        </div>
        <h2 className="text-lg font-bold text-natural-dark font-sans">{localStorage.getItem(NICKNAME_KEY) ? 'Edit your nickname' : 'Welcome to Chapter'}</h2>
        <p className="text-xs text-natural-stone font-sans">Choose a nickname to use in the community.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="Your nickname…"
            maxLength={30}
            autoFocus
            className="w-full px-4 py-2.5 text-sm font-sans bg-natural-cream/50 border border-natural-border rounded-xl focus:outline-none focus:ring-2 focus:ring-natural-sage"
          />
          <button
            type="submit"
            disabled={!nickname.trim()}
            className="w-full flex items-center justify-center gap-1.5 px-5 py-2.5 bg-natural-sage hover:opacity-90 disabled:opacity-50 text-white rounded-full text-xs font-bold uppercase font-sans cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" /> {localStorage.getItem(NICKNAME_KEY) ? 'Save' : 'Get Started'}
          </button>
        </form>
      </div>
    </div>
  );
}
