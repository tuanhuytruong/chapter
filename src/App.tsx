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
import Pricing from './pages/Pricing';
import Profile from './pages/Profile';
import Quotes from './pages/Quotes';
import { presetFromAvatarValue } from './avatar-presets';
import AnimalAvatar from './components/AnimalAvatar';
import JourneyDrawer from './components/JourneyDrawer';
import { BookMarked, Brain, Map, Moon, Sparkles, Sun, LogOut, Settings2, MoreHorizontal, X } from 'lucide-react';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import { AuthProvider, useAuth } from './AuthContext';
import { api, type MembershipTier } from './api';
import MembershipTierBadge from './components/MembershipTierBadge';
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
  const [membershipTier, setMembershipTier] = useState<MembershipTier | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const swipeNav = useSwipeNav(contentRef);

  const toggleDark = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setIsDark(next);
  };

  useEffect(() => { swipeNav.attach(); return swipeNav.detach; }, [swipeNav]);
  useEffect(() => {
    let active = true;
    void api.getEntitlements().then((data) => {
      if (active) setMembershipTier(data.subscription.tier);
    }).catch(() => {
      if (active) setMembershipTier(null);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => { setJourneyOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen bg-natural-bg text-natural-dark flex flex-col font-serif">
      <header className="sticky top-0 z-40 border-b border-natural-border bg-natural-bg">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-3 sm:h-20">
            <NavLink to="/" aria-label="Chapter — Read less. Learn more." className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
              <img src="/chapter-book-mark.svg" alt="" className="h-9 w-9 shrink-0 sm:h-11 sm:w-11" />
              <div className="min-w-0 leading-none">
                <span className="block font-serif text-[1.35rem] font-bold tracking-tight text-natural-dark sm:text-[1.65rem]">chapter</span>
                <span className="hidden pt-1 font-sans text-[9px] font-medium tracking-[0.08em] text-natural-stone sm:block">Read less. Learn more.</span>
              </div>
            </NavLink>

            <nav className="hidden shrink-0 items-center gap-6 font-sans text-xs font-semibold uppercase tracking-widest sm:flex" aria-label="Primary navigation">
              <NavLink to="/today" aria-label="Today" className={({ isActive }) => primaryLink(isActive)}><Sparkles className="h-3.5 w-3.5" /><span>Today</span></NavLink>
              <NavLink to="/" end aria-label="Library" className={({ isActive }) => primaryLink(isActive)}><BookMarked className="h-3.5 w-3.5" /><span>Library</span></NavLink>
              <NavLink to="/review" aria-label="Review" className={({ isActive }) => primaryLink(isActive)}><Brain className="h-3.5 w-3.5" /><span>Review</span></NavLink>
            </nav>

            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <button onClick={() => setJourneyOpen(true)} aria-label="Open reading journey" title="Your Journey" aria-expanded={journeyOpen} aria-controls="journey-menu" className="flex h-7 w-7 items-center justify-center rounded-full border border-natural-border bg-natural-cream text-natural-stone outline-none hover:text-natural-dark focus-visible:ring-2 focus-visible:ring-natural-sage/50"><Map className="h-3.5 w-3.5" /></button>
              <button onClick={toggleDark} aria-label={isDark ? 'Use light theme' : 'Use dark theme'} className="flex h-7 w-7 items-center justify-center rounded-full border border-natural-border bg-natural-cream outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-natural-sage/50">{isDark ? <Sun className="h-3.5 w-3.5 text-natural-clay" /> : <Moon className="h-3.5 w-3.5 text-natural-stone" />}</button>
              {membershipTier && <MembershipTierBadge tier={membershipTier} />}
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
          </nav>
          {mobileMenuOpen && <div className="border-t border-natural-border py-2 sm:hidden">
            <NavLink to="/profile" onClick={() => setMobileMenuOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-2 font-sans text-sm font-medium text-natural-dark"><Avatar user={user} /><span>Profile</span></NavLink>
            {membershipTier && <MembershipTierBadge tier={membershipTier} mobile onNavigate={() => setMobileMenuOpen(false)} />}
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
  if (!user) return <BrowserRouter><Routes><Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/reset-password" element={<ResetPassword />} /><Route path="*" element={<Login />} /></Routes></BrowserRouter>;
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
    <Route path="/pricing" element={<Pricing />} />
    <Route path="/quotes" element={<Quotes />} />
    <Route path="*" element={<Library />} />
  </Route></Routes></BrowserRouter></OnboardingProvider>;
}

export default function App() { return <AuthProvider><AppRoutes /></AuthProvider>; }
