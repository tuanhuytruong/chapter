import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Outlet, useLocation } from 'react-router-dom';
import Library from './pages/Library';
import BookDetail from './pages/BookDetail';
import Community from './pages/Community';
import Insights from './pages/Insights';
import Review from './pages/Review';
import ReadingCalendar from './pages/Calendar';
import Momentum from './pages/Momentum';
import Today from './pages/Today';
import { BookMarked, Users, BarChart3, Brain, CalendarDays, CircleGauge, Sparkles, Moon, Sun, LogOut } from 'lucide-react';
import Login from './components/Login';
import { AuthProvider, useAuth } from './AuthContext';
import useSwipeNav from './hooks/useSwipeNav';

const NICKNAME_KEY = 'chapter_nickname';
function getNickname() { return localStorage.getItem(NICKNAME_KEY) || ''; }

// ── Layout (nav + outlet) ──────────────────────────────────────
function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const contentRef = useRef<HTMLDivElement>(null);
  const swipeNav = useSwipeNav(contentRef);

  const toggleDark = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setIsDark(next);
  };

  useEffect(() => { swipeNav.attach(); return swipeNav.detach; }, [swipeNav]);

  return (
    <div className="min-h-screen bg-natural-bg text-natural-dark flex flex-col font-serif">
      <header className="sticky top-0 z-40 flex min-h-16 items-center border-b border-natural-border bg-natural-bg sm:h-20">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <NavLink to="/" className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-natural-sage text-white">
                <BookMarked className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-sans text-lg font-bold tracking-tight text-natural-dark sm:text-xl">Chapter</span>
                <span className="block font-mono text-[8px] uppercase leading-none tracking-[0.14em] text-natural-stone sm:text-[9px] sm:tracking-widest">AI Reading Companion</span>
              </div>
            </NavLink>

            <nav className="flex shrink-0 items-center gap-1 font-sans text-xs font-semibold uppercase tracking-widest text-natural-stone sm:gap-6" aria-label="Primary navigation">
              <NavLink to="/today" aria-label="Today" className={({isActive}) => isActive ? 'flex min-h-10 min-w-8 items-center justify-center gap-1.5 border-b-2 border-natural-dark pb-0.5 font-bold text-natural-dark sm:min-h-0 sm:min-w-0' : 'flex min-h-10 min-w-8 items-center justify-center gap-1.5 hover:text-natural-dark sm:min-h-0 sm:min-w-0'}>
                <Sparkles className="w-3.5 h-3.5" /><span className="hidden sm:inline">Today</span>
              </NavLink>
              <NavLink to="/" end aria-label="Library" className={({isActive}) => isActive ? 'flex min-h-10 min-w-8 items-center justify-center gap-1.5 border-b-2 border-natural-dark pb-0.5 font-bold text-natural-dark sm:min-h-0 sm:min-w-0' : 'flex min-h-10 min-w-8 items-center justify-center gap-1.5 hover:text-natural-dark sm:min-h-0 sm:min-w-0'}>
                <BookMarked className="w-3.5 h-3.5" /><span className="hidden sm:inline">Library</span>
              </NavLink>
              <NavLink to="/community" aria-label="Community" className={({isActive}) => isActive ? 'flex min-h-10 min-w-8 items-center justify-center gap-1.5 border-b-2 border-natural-dark pb-0.5 font-bold text-natural-dark sm:min-h-0 sm:min-w-0' : 'flex min-h-10 min-w-8 items-center justify-center gap-1.5 hover:text-natural-dark sm:min-h-0 sm:min-w-0'}>
                <Users className="w-3.5 h-3.5" /><span className="hidden sm:inline">Community</span>
              </NavLink>
              <NavLink to="/insights" aria-label="Insights" className={({isActive}) => isActive ? 'flex min-h-10 min-w-8 items-center justify-center gap-1.5 border-b-2 border-natural-dark pb-0.5 font-bold text-natural-dark sm:min-h-0 sm:min-w-0' : 'flex min-h-10 min-w-8 items-center justify-center gap-1.5 hover:text-natural-dark sm:min-h-0 sm:min-w-0'}>
                <BarChart3 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Insights</span>
              </NavLink>
              <NavLink to="/review" aria-label="Review" className={({isActive}) => isActive ? 'flex min-h-10 min-w-8 items-center justify-center gap-1.5 border-b-2 border-natural-dark pb-0.5 font-bold text-natural-dark sm:min-h-0 sm:min-w-0' : 'flex min-h-10 min-w-8 items-center justify-center gap-1.5 hover:text-natural-dark sm:min-h-0 sm:min-w-0'}>
                <Brain className="w-3.5 h-3.5" /><span className="hidden sm:inline">Review</span>
              </NavLink>
              <NavLink to="/calendar" aria-label="Reading calendar" className={({isActive}) => isActive ? 'flex min-h-10 min-w-8 items-center justify-center gap-1.5 border-b-2 border-natural-dark pb-0.5 font-bold text-natural-dark sm:min-h-0 sm:min-w-0' : 'flex min-h-10 min-w-8 items-center justify-center gap-1.5 hover:text-natural-dark sm:min-h-0 sm:min-w-0'}>
                <CalendarDays className="w-3.5 h-3.5" /><span className="hidden sm:inline">Calendar</span>
              </NavLink>
              <NavLink to="/momentum" aria-label="Weekly momentum" className={({isActive}) => isActive ? 'flex min-h-10 min-w-8 items-center justify-center gap-1.5 border-b-2 border-natural-dark pb-0.5 font-bold text-natural-dark sm:min-h-0 sm:min-w-0' : 'flex min-h-10 min-w-8 items-center justify-center gap-1.5 hover:text-natural-dark sm:min-h-0 sm:min-w-0'}>
                <CircleGauge className="w-3.5 h-3.5" /><span className="hidden sm:inline">Momentum</span>
              </NavLink>
            </nav>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <button onClick={toggleDark} aria-label={isDark ? 'Use light theme' : 'Use dark theme'}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-natural-border bg-natural-cream hover:opacity-70 sm:h-7 sm:w-7">
                {isDark ? <Sun className="w-3.5 h-3.5 text-natural-clay" /> : <Moon className="w-3.5 h-3.5 text-natural-stone" />}
              </button>
              <button onClick={() => logout()} className="flex min-h-10 items-center gap-1.5 hover:opacity-70" title="Sign out" aria-label="Sign out">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-natural-sage/20"><span className="font-sans text-[10px] font-bold text-natural-sage">{user?.displayName?.[0]?.toUpperCase()}</span></div>
                <span className="hidden max-w-[100px] truncate font-sans text-xs font-medium text-natural-dark sm:inline">{user?.displayName}</span><LogOut className="hidden w-3 h-3 text-natural-stone sm:block" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div ref={contentRef} className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
        <Outlet />
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Login />;
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Library />} />
          <Route path="/today" element={<Today />} />
          <Route path="/books/:id" element={<BookDetail />} />
          <Route path="/community" element={<Community />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/review" element={<Review />} />
          <Route path="/calendar" element={<ReadingCalendar />} />
          <Route path="/momentum" element={<Momentum />} />
          <Route path="*" element={<Library />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}
