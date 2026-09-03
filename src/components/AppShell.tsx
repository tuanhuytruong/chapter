import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { presetFromAvatarValue } from '../avatar-presets';
import AnimalAvatar from './AnimalAvatar';
import JourneyDrawer from './JourneyDrawer';
import { BookMarked, Brain, Map, Moon, Sparkles, Sun, LogOut, Settings2, MoreHorizontal, X } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { api, type MembershipTier, type QuietStreakTier } from '../api';
import QuietStreakBadge from './QuietStreakBadge';
import MembershipTierBadge from './MembershipTierBadge';
import useSwipeNav from '../hooks/useSwipeNav';
import { REVIEWS_CHANGED_EVENT } from '../reviewEvents';
import { getCachedEntitlements } from '../membershipCache';

const primaryLink = (active: boolean) => active
  ? 'flex min-h-10 items-center justify-center gap-1.5 border-b-2 border-natural-dark pb-0.5 font-bold text-natural-dark md:min-h-0 no-underline'
  : 'flex min-h-10 items-center justify-center gap-1.5 text-natural-stone hover:text-natural-dark md:min-h-0 no-underline';

function Avatar({ user, tier }: { user: ReturnType<typeof useAuth>["user"]; tier: QuietStreakTier | null }) {
  const preset = presetFromAvatarValue(user?.avatarUrl);
  return <QuietStreakBadge tier={tier}><div className={`flex h-8 w-8 overflow-hidden rounded-full ${preset?.tone || 'bg-natural-sage/20'}`}>{preset ? <AnimalAvatar id={preset.id} className="h-full w-full" /> : <span className="flex h-full w-full items-center justify-center font-sans text-[10px] font-bold text-natural-sage">{user?.displayName?.[0]?.toUpperCase()}</span>}</div></QuietStreakBadge>;
}

export default function AppShell() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [membershipTier, setMembershipTier] = useState<MembershipTier | null>(null);
  const [dueReviewCount, setDueReviewCount] = useState<number | null>(null);
  const [quietTier, setQuietTier] = useState<QuietStreakTier | null>(null);
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
    if (!user) return;
    void getCachedEntitlements(user.id, api.getEntitlements).then((data) => {
      if (active) setMembershipTier(data.subscription.tier);
    }).catch(() => {
      if (active) setMembershipTier(null);
    });
    return () => { active = false; };
  }, [user?.id]);
  useEffect(() => {
    let active = true;
    if (!user) { setQuietTier(null); return; }
    void api.getRhythm().then(({ quiet_streak }) => { if (active) setQuietTier(quiet_streak.highest_tier); }).catch(() => { if (active) setQuietTier(null); });
    return () => { active = false; };
  }, [user?.id]);
  useEffect(() => { setJourneyOpen(false); }, [location.pathname]);
  useEffect(() => {
    let active = true;
    const loadReviewCount = () => {
      void api.getDueReviewCount().then(({ count }) => { if (active) setDueReviewCount(count); }).catch(() => {});
    };
    loadReviewCount();
    window.addEventListener(REVIEWS_CHANGED_EVENT, loadReviewCount);
    return () => { active = false; window.removeEventListener(REVIEWS_CHANGED_EVENT, loadReviewCount); };
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-natural-bg text-natural-dark flex flex-col font-sans">
      <header className="sticky top-0 z-40 border-b border-natural-border bg-natural-bg">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-3 md:h-20">
            <NavLink to="/" aria-label="Chapter — Read less. Learn more." className="flex min-w-0 shrink items-center gap-2 md:gap-3">
              <img src="/chapter-book-mark.svg" alt="" className="h-9 w-9 shrink-0 md:h-11 md:w-11" />
              <div className="min-w-0 leading-none">
                <span className="block font-sans text-[1.35rem] font-bold tracking-tight text-natural-dark md:text-[1.65rem]">chapter</span>
                <span className="hidden pt-1 font-sans text-[9px] font-medium tracking-[0.08em] text-natural-stone md:block">Read less. Learn more.</span>
              </div>
            </NavLink>

            <nav className="hidden shrink-0 items-center gap-6 font-sans text-xs font-semibold uppercase tracking-widest md:flex" aria-label="Primary navigation">
              <NavLink to="/today" aria-label="Today" className={({ isActive }) => primaryLink(isActive)}><Sparkles className="h-3.5 w-3.5" /><span>Today</span></NavLink>
              <NavLink to="/" end aria-label="Library" className={({ isActive }) => primaryLink(isActive)}><BookMarked className="h-3.5 w-3.5" /><span>Library</span></NavLink>
              <NavLink to="/review" aria-label={dueReviewCount === null ? "Review" : `Review, ${dueReviewCount} due`} className={({ isActive }) => primaryLink(isActive)}><Brain className="h-3.5 w-3.5" /><span>Review</span>{dueReviewCount !== null && dueReviewCount > 0 && <span aria-hidden="true" className="ml-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-natural-clay px-1 text-[9px] leading-4 text-white">{dueReviewCount > 9 ? "9+" : dueReviewCount}</span>}</NavLink>
            </nav>

            <div className="hidden shrink-0 items-center gap-2 md:flex">
              <button onClick={() => setJourneyOpen(true)} aria-label="Open reading journey" title="Your Journey" aria-expanded={journeyOpen} aria-controls="journey-menu" className="flex h-7 w-7 items-center justify-center rounded-full border border-natural-border bg-natural-cream text-natural-stone outline-none hover:text-natural-dark focus-visible:ring-2 focus-visible:ring-natural-sage/50"><Map className="h-3.5 w-3.5" /></button>
              <button onClick={toggleDark} aria-label={isDark ? 'Use light theme' : 'Use dark theme'} className="flex h-7 w-7 items-center justify-center rounded-full border border-natural-border bg-natural-cream outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-natural-sage/50">{isDark ? <Sun className="h-3.5 w-3.5 text-natural-clay" /> : <Moon className="h-3.5 w-3.5 text-natural-stone" />}</button>
              {membershipTier && <MembershipTierBadge tier={membershipTier} />}
              <NavLink to="/profile" aria-label="Your profile" title="Your profile" className="flex min-h-10 items-center gap-1.5 rounded-full outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-natural-sage/50"><Avatar user={user} tier={quietTier} /><span className="hidden max-w-[100px] truncate font-sans text-xs font-medium text-natural-dark lg:inline">{user?.displayName}</span></NavLink>
              <NavLink to="/account" aria-label="Telegram settings" title="Telegram settings" className="flex h-7 w-7 items-center justify-center rounded-full border border-natural-border bg-natural-cream text-natural-stone outline-none hover:text-natural-dark focus-visible:ring-2 focus-visible:ring-natural-sage/50"><Settings2 className="h-3.5 w-3.5" /></NavLink>
              <button onClick={() => void logout()} className="flex h-7 w-7 items-center justify-center rounded-full border border-natural-border bg-natural-cream text-natural-stone outline-none hover:text-natural-dark focus-visible:ring-2 focus-visible:ring-natural-sage/50" title="Sign out" aria-label="Sign out"><LogOut className="h-3.5 w-3.5" /></button>
            </div>

            <button onClick={() => setMobileMenuOpen((open) => !open)} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} className="flex h-10 w-10 items-center justify-center rounded-full border border-natural-border bg-natural-cream text-natural-stone outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/50 md:hidden">{mobileMenuOpen ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}</button>
          </div>
          <nav className="flex h-11 items-stretch justify-around border-t border-natural-border font-sans text-[10px] font-bold uppercase tracking-[0.12em] md:hidden" aria-label="Primary navigation">
            <NavLink to="/today" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex flex-1 items-center justify-center gap-1.5 ${isActive ? 'border-b-2 border-natural-dark text-natural-dark' : 'text-natural-stone'}`}><Sparkles className="h-3.5 w-3.5" />Today</NavLink>
            <NavLink to="/" end onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex flex-1 items-center justify-center gap-1.5 ${isActive ? 'border-b-2 border-natural-dark text-natural-dark' : 'text-natural-stone'}`}><BookMarked className="h-3.5 w-3.5" />Library</NavLink>
            <NavLink to="/review" onClick={() => setMobileMenuOpen(false)} aria-label={dueReviewCount === null ? "Review" : `Review, ${dueReviewCount} due`} className={({ isActive }) => `flex flex-1 items-center justify-center gap-1.5 ${isActive ? 'border-b-2 border-natural-dark text-natural-dark' : 'text-natural-stone'}`}><Brain className="h-3.5 w-3.5" />Review{dueReviewCount !== null && dueReviewCount > 0 && <span aria-hidden="true" className="inline-flex min-w-4 items-center justify-center rounded-full bg-natural-clay px-1 text-[9px] leading-4 text-white">{dueReviewCount > 9 ? "9+" : dueReviewCount}</span>}</NavLink>
          </nav>
          {mobileMenuOpen && <div className="border-t border-natural-border py-2 md:hidden">
            <NavLink to="/profile" onClick={() => setMobileMenuOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-2 font-sans text-sm font-medium text-natural-dark"><Avatar user={user} tier={quietTier} /><span>Profile</span></NavLink>
            {membershipTier && <MembershipTierBadge tier={membershipTier} mobile onNavigate={() => setMobileMenuOpen(false)} />}
            <button onClick={() => { setMobileMenuOpen(false); setJourneyOpen(true); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 font-sans text-sm font-medium text-natural-dark"><Map className="h-4 w-4 text-natural-stone" />Your Journey</button>
            <NavLink to="/account" onClick={() => setMobileMenuOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-2 font-sans text-sm font-medium text-natural-dark"><Settings2 className="h-4 w-4 text-natural-stone" />Telegram settings</NavLink>
            <button onClick={toggleDark} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 font-sans text-sm font-medium text-natural-dark">{isDark ? <Sun className="h-4 w-4 text-natural-clay" /> : <Moon className="h-4 w-4 text-natural-stone" />}{isDark ? 'Use light theme' : 'Use dark theme'}</button>
            <button onClick={() => void logout()} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 font-sans text-sm font-medium text-natural-clay"><LogOut className="h-4 w-4" />Sign out</button>
          </div>}
        </div>
      </header>

      <JourneyDrawer open={journeyOpen} onClose={() => setJourneyOpen(false)} />
      <main ref={contentRef} className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-6 sm:py-8 lg:px-8"><div key={location.pathname} className="route-content"><Outlet /></div></main>
    </div>
  );
}

