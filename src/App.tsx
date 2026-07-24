import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Outlet, useLocation } from 'react-router-dom';
import Library from './pages/Library';
import BookDetail from './pages/BookDetail';
import Insights from './pages/Insights';
import Review from './pages/Review';
import ReadingCalendar from './pages/Calendar';
import Momentum from './pages/Momentum';
import Today from './pages/Today';
import Achievements from './pages/Achievements';
import Account from './pages/Account';
import Profile from './pages/Profile';
import { avatarSrcForPreset, presetFromAvatarValue } from './avatar-presets';
import JourneyDrawer from './components/JourneyDrawer';
import { BookMarked, Brain, Map, Moon, Sparkles, Sun, LogOut, Settings2 } from 'lucide-react';
import Login from './components/Login';
import { AuthProvider, useAuth } from './AuthContext';
import { OnboardingProvider } from './onboarding';
import useSwipeNav from './hooks/useSwipeNav';

const primaryLink = (active: boolean) => active
  ? 'flex min-h-10 items-center justify-center gap-1.5 border-b-2 border-natural-dark pb-0.5 font-bold text-natural-dark sm:min-h-0'
  : 'flex min-h-10 items-center justify-center gap-1.5 text-natural-stone hover:text-natural-dark sm:min-h-0';

function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [journeyOpen, setJourneyOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const swipeNav = useSwipeNav(contentRef);

  const toggleDark = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setIsDark(next);
  };

  useEffect(() => { swipeNav.attach(); return swipeNav.detach; }, [swipeNav]);
  useEffect(() => { setJourneyOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen bg-natural-bg text-natural-dark flex flex-col font-serif">
      <header className="sticky top-0 z-40 border-b border-natural-border bg-natural-bg">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-2 px-3 sm:h-20 sm:px-6 lg:px-8">
          <NavLink to="/" className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-natural-sage text-white"><BookMarked className="h-4 w-4" /></div>
            <div className="min-w-0"><span className="font-sans text-lg font-bold tracking-tight text-natural-dark sm:text-xl">Chapter</span><span className="hidden font-mono text-[9px] uppercase leading-none tracking-widest text-natural-stone sm:block">AI Reading Companion</span></div>
          </NavLink>

          <nav className="flex shrink-0 items-center gap-3 font-sans text-xs font-semibold uppercase tracking-widest sm:gap-6" aria-label="Primary navigation">
            <NavLink to="/today" aria-label="Today" className={({ isActive }) => primaryLink(isActive)}><Sparkles className="h-3.5 w-3.5" /><span className="hidden sm:inline">Today</span></NavLink>
            <NavLink to="/" end aria-label="Library" className={({ isActive }) => primaryLink(isActive)}><BookMarked className="h-3.5 w-3.5" /><span className="hidden sm:inline">Library</span></NavLink>
            <NavLink to="/review" aria-label="Review" className={({ isActive }) => primaryLink(isActive)}><Brain className="h-3.5 w-3.5" /><span className="hidden sm:inline">Review</span></NavLink>
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button onClick={() => setJourneyOpen(true)} aria-label="Open reading journey" title="Your Journey" aria-expanded={journeyOpen} aria-controls="journey-menu" className="flex h-8 w-8 items-center justify-center rounded-full border border-natural-border bg-natural-cream text-natural-stone outline-none hover:text-natural-dark focus-visible:ring-2 focus-visible:ring-natural-sage/50 focus-visible:ring-offset-2 focus-visible:ring-offset-natural-bg sm:h-7 sm:w-7"><Map className="h-3.5 w-3.5" /></button>
            <button onClick={toggleDark} aria-label={isDark ? 'Use light theme' : 'Use dark theme'} className="flex h-8 w-8 items-center justify-center rounded-full border border-natural-border bg-natural-cream outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-natural-sage/50 focus-visible:ring-offset-2 focus-visible:ring-offset-natural-bg sm:h-7 sm:w-7">{isDark ? <Sun className="h-3.5 w-3.5 text-natural-clay" /> : <Moon className="h-3.5 w-3.5 text-natural-stone" />}</button>
            <NavLink to="/profile" aria-label="Your profile" title="Your profile" className="flex min-h-10 items-center gap-1.5 rounded-full outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-natural-sage/50 focus-visible:ring-offset-2 focus-visible:ring-offset-natural-bg"><div className={`flex h-8 w-8 overflow-hidden rounded-full ${presetFromAvatarValue(user?.avatarUrl)?.tone || 'bg-natural-sage/20'}`}>{presetFromAvatarValue(user?.avatarUrl) ? <img src={avatarSrcForPreset(presetFromAvatarValue(user?.avatarUrl)!.id, 64)} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center font-sans text-[10px] font-bold text-natural-sage">{user?.displayName?.[0]?.toUpperCase()}</span>}</div><span className="hidden max-w-[100px] truncate font-sans text-xs font-medium text-natural-dark lg:inline">{user?.displayName}</span></NavLink>
            <NavLink to="/account" aria-label="Telegram settings" title="Telegram settings" className="flex h-8 w-8 items-center justify-center rounded-full border border-natural-border bg-natural-cream text-natural-stone outline-none hover:text-natural-dark focus-visible:ring-2 focus-visible:ring-natural-sage/50 focus-visible:ring-offset-2 focus-visible:ring-offset-natural-bg"><Settings2 className="h-3.5 w-3.5" /></NavLink>
            <button onClick={() => void logout()} className="flex h-8 w-8 items-center justify-center rounded-full border border-natural-border bg-natural-cream text-natural-stone outline-none hover:text-natural-dark focus-visible:ring-2 focus-visible:ring-natural-sage/50 focus-visible:ring-offset-2 focus-visible:ring-offset-natural-bg" title="Sign out" aria-label="Sign out"><LogOut className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </header>

      <JourneyDrawer open={journeyOpen} onClose={() => setJourneyOpen(false)} />
      <div ref={contentRef} className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-6 sm:py-8 lg:px-8"><div key={location.pathname} className="route-content"><Outlet /></div></div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Login />;
  return <OnboardingProvider><BrowserRouter><Routes><Route element={<Layout />}>
    <Route path="/" element={<Library />} />
    <Route path="/today" element={<Today />} />
    <Route path="/books/:id" element={<BookDetail />} />
    <Route path="/insights" element={<Insights />} />
    <Route path="/review" element={<Review />} />
    <Route path="/calendar" element={<ReadingCalendar />} />
    <Route path="/momentum" element={<Momentum />} />
    <Route path="/achievements" element={<Achievements />} />
    <Route path="/profile" element={<Profile />} />
    <Route path="/account" element={<Account />} />
    <Route path="*" element={<Library />} />
  </Route></Routes></BrowserRouter></OnboardingProvider>;
}

export default function App() { return <AuthProvider><AppRoutes /></AuthProvider>; }
