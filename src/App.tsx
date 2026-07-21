import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Outlet, useLocation } from 'react-router-dom';
import Library from './pages/Library';
import BookDetail from './pages/BookDetail';
import Community from './pages/Community';
import { BookMarked, Users, Pencil } from 'lucide-react';
import NicknamePrompt from './components/NicknamePrompt';

const NICKNAME_KEY = 'chapter_nickname';
function getNickname() { return localStorage.getItem(NICKNAME_KEY) || ''; }

// ── Layout (nav + outlet) ──────────────────────────────────────
function Layout() {
  const location = useLocation();
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [nickname, setNickname] = useState(getNickname);

  useEffect(() => {
    setNickname(getNickname());
  }, [nicknameOpen]);

  return (
    <div className="min-h-screen bg-natural-bg text-natural-dark flex flex-col font-serif">
      <header className="bg-white border-b border-natural-border sticky top-0 z-40 h-20 flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex justify-between items-center h-full">
            <NavLink to="/" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-natural-sage rounded-full flex items-center justify-center text-white">
                <BookMarked className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-natural-dark tracking-tight text-xl font-sans">Chapter</span>
                <span className="text-[9px] text-natural-stone font-mono block leading-none tracking-widest uppercase">AI Reading Companion</span>
              </div>
            </NavLink>

            <nav className="flex space-x-1 sm:space-x-6 font-sans text-xs font-semibold uppercase tracking-widest text-natural-stone">
              <NavLink to="/" end className={({isActive}) => isActive ? 'text-natural-dark border-b-2 border-natural-dark pb-0.5 font-bold flex items-center gap-1.5' : 'hover:text-natural-dark flex items-center gap-1.5'}>
                <BookMarked className="w-3.5 h-3.5" /><span className="hidden sm:inline">Library</span>
              </NavLink>
              <NavLink to="/community" className={({isActive}) => isActive ? 'text-natural-dark border-b-2 border-natural-dark pb-0.5 font-bold flex items-center gap-1.5' : 'hover:text-natural-dark flex items-center gap-1.5'}>
                <Users className="w-3.5 h-3.5" /><span className="hidden sm:inline">Community</span>
              </NavLink>
            </nav>

            <button onClick={() => setNicknameOpen(true)} className="flex items-center gap-1.5 hover:opacity-70 cursor-pointer">
              <div className="w-7 h-7 rounded-full bg-natural-sage/20 flex items-center justify-center">
                <span className="text-[10px] font-bold text-natural-sage font-sans">{nickname ? nickname[0].toUpperCase() : '?'}</span>
              </div>
              <span className="text-xs font-medium text-natural-dark font-sans max-w-[100px] truncate">{nickname || 'Set nickname'}</span>
              <Pencil className="w-3 h-3 text-natural-stone" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <Outlet />
      </div>
      <NicknamePrompt open={nicknameOpen} onDone={() => setNicknameOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Library />} />
          <Route path="/books/:id" element={<BookDetail />} />
          <Route path="/community" element={<Community />} />
          <Route path="*" element={<Library />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
