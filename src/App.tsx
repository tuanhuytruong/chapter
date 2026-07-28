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
import Podcasts from './pages/Podcasts';
import Profile from './pages/Profile';
import { presetFromAvatarValue } from './avatar-presets';
import AnimalAvatar from './components/AnimalAvatar';
import JourneyDrawer from './components/JourneyDrawer';
import { BookMarked, Brain, Map, Moon, Sparkles, Sun, LogOut, Settings2, MoreHorizontal, X, Headphones } from 'lucide-react';
import Login from './components/Login';
import { AuthProvider, useAuth } from './AuthContext';
import { OnboardingProvider } from './onboarding';
import useSwipeNav from './hooks/useSwipeNav';

const primaryLink = (active: boolean) => active
  ? 'flex min-h-10 items-center justify-center gap-1.5 border-b-2 border-natural-dark pb-0.5 font-bold text-natural-dark sm:min-h-0'
  : 'flex min-h-10 items-center justify-center gap-1.5 text-natural-stone hover:text-natural-dark sm:min-h-0';

function Avatar({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const preset = presetFromAvatarValue(user?.avatarUrl);
  return <div className={`flex h-8 w-8 overflow-hidden rounded-full ${preset?.tone || 'bg-natural-sage/20'}`}>{preset ? <AnimalAvatar id={preset.id} className="h-full w-full" /> : <span className="flex h-full w-full items-center justify-center font-sans text-[10px] font-bold text-natural-sage">{user?.displayName?.[0]?.toUpperCase()}</span>}</div>;
}

function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-3 sm:h-20">
            <NavLink to="/" className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-natural-sage text-white"><BookMarked className="h-4 w-4" /></div>
              <div className="min-w-0"><span className="font-sans text-lg font-bold tracking-tight text-natural-dark sm:text-xl">Chapter</span><span className="hidden font-mono text-[9px] uppercase leading-none tracking-widest text-natural-stone sm:block">AI Reading Companion</span></div>
            </NavLink>

            <nav className="hidden shrink-0 items-center gap-6 font-sans text-xs font-semibold uppercase tracking-widest sm:flex" aria-label="Primary navigation">
              <NavLink to="/today" aria-label="Today" className={({ isActive }) => primaryLink(isActive)}><Sparkles className="h-3.5 w-3.5" /><span>Today</span></NavLink>
              <NavLink to="/" end aria-label="Library" className={({ isActive }) => primaryLink(isActive)}><BookMarked className="h-3.5 w-3.5" /><span>Library</span></NavLink>
              <NavLink to="/review" aria-label="Review" className={({ isActive }) => primaryLink(isActive)}><Brain className="h-3.5 w-3.5" /><span>Review</span></NavLink>
              <NavLink to="/podcasts" aria-label="Podcasts" className={({ isActive }) => primaryLink(isActive)}><Headphones className="h-3.5 w-3.5" /><span>Podcasts</span></NavLink>
            </nav>

            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <button onClick={() => setJourneyOpen(true)} aria-label="Open reading journey" title="Your Journey" aria-expanded={journeyOpen} aria-controls="journey-menu" className="flex h-7 w-7 items-center justify-center rounded-full border border-natural-border bg-natural-cream text-natural-stone outline-none hover:text-natural-dark focus-visible:ring-2 focus-visible:ring-natural-sage/50"><Map className="h-3.5 w-3.5" /></button>
              <button onClick={toggleDark} aria-label={isDark ? 'Use light theme' : 'Use dark theme'} className="flex h-7 w-7 items-center justify-center rounded-full border border-natural-border bg-natural-cream outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-natural-sage/50">{isDark ? <Sun className="h-3.5 w-3.5 text-natural-clay" /> : <Moon className="h-3.5 w-3.5 text-natural-stone" />}</button>
              <NavLink to="/profile" aria-label="Your profile" title="Your profile" className="flex min-h-10 items-center gap-1.5 rounded-full outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-natural-sage/50"><Avatar user={user} /><span className="hidden max-w-[100px] truncate font-sans text-xs font-medium text-natural-dark lg:inline">{user?.displayName}</span></NavLink>
              <NavLink to="/account" aria-label="Telegram settings" title="Telegram settings" className="flex h-7 w-7 items-center justify-center rounded-full border border-natural-border bg-natural-cream text-natural-stone outline-none hover:text-natural-dark focus-visible:ring-2 focus-visible:ring-natural-sage/50"><Settings2 className="h-3.5 w-3.5" /></NavLink>
              <button onClick={() => void logout()} className="flex h-7 w-7 items-center justify-center rounded-full border border-natural-border bg-natural-cream text-natural-stone outline-none hover:text-natural-dark focus-visible:ring-2 focus-visible:ring-natural-sage/50" title="Sign out" aria-label="Sign out"><LogOut className="h-3.5 w-3.5" /></button>
            </div>

            <button onClick={() => setMobileMenuOpen((open) => !open)} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} className="flex h-10 w-10 items-center justify-center rounded-full border border-natural-border bg-natural-cream text-natural-stone outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/50 sm:hidden">{mobileMenuOpen ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}</button>
          </div>
          <nav className="flex h-11 items-stretch justify-around border-t border-natural-border font-sans text-[10px] font-bold uppercase tracking-[0.12em] sm:hidden" aria-label="Primary navigation">
            <NavLink to="/today" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex flex-1 items-center justify-center gap-1.5 ${isActive ? 'border-b-2 border-natural-dark text-natural-dark' : 'text-natural-stone'}`}><Sparkles className="h-3.5 w-3.5" />Today</NavLink>
            <NavLink to="/" end onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex flex-1 items-center justify-center gap-1.5 ${isActive ? 'border-b-2 border-natural-dark text-natural-dark' : 'text-natural-stone'}`}><BookMarked className="h-3.5 w-3.5" />Library</NavLink>
            <NavLink to="/review" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex flex-1 items-center justify-center gap-1.5 ${isActive ? 'border-b-2 border-natural-dark text-natural-dark' : 'text-natural-stone'}`}><Brain className="h-3.5 w-3.5" />Review</NavLink>
            <NavLink to="/podcasts" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex flex-1 items-center justify-center gap-1.5 ${isActive ? 'border-b-2 border-natural-dark text-natural-dark' : 'text-natural-stone'}`}><Headphones className="h-3.5 w-3.5" />Listen</NavLink>
          </nav>
          {mobileMenuOpen && <div className="border-t border-natural-border py-2 sm:hidden">
            <NavLink to="/profile" onClick={() => setMobileMenuOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-2 font-sans text-sm font-medium text-natural-dark"><Avatar user={user} /><span>Profile</span></NavLink>
            <button onClick={() => { setMobileMenuOpen(false); setJourneyOpen(true); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 font-sans text-sm font-medium text-natural-dark"><Map className="h-4 w-4 text-natural-stone" />Your Journey</button>
            <NavLink to="/account" onClick={() => setMobileMenuOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-2 font-sans text-sm font-medium text-natural-dark"><Settings2 className="h-4 w-4 text-natural-stone" />Telegram settings</NavLink>
            <button onClick={toggleDark} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 font-sans text-sm font-medium text-natural-dark">{isDark ? <Sun className="h-4 w-4 text-natural-clay" /> : <Moon className="h-4 w-4 text-natural-stone" />}{isDark ? 'Use light theme' : 'Use dark theme'}</button>
            <button onClick={() => void logout()} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 font-sans text-sm font-medium text-natural-clay"><LogOut className="h-4 w-4" />Sign out</button>
          </div>}
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
    <Route path="/podcasts" element={<Podcasts />} />
    <Route path="/calendar" element={<ReadingCalendar />} />
    <Route path="/momentum" element={<Momentum />} />
    <Route path="/achievements" element={<Achievements />} />
    <Route path="/profile" element={<Profile />} />
    <Route path="/account" element={<Account />} />
    <Route path="*" element={<Library />} />
  </Route></Routes></BrowserRouter></OnboardingProvider>;
}

export default function App() { return <AuthProvider><AppRoutes /></AuthProvider>; }
