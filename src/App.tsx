import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { captureRoutePerformance } from './analytics';

import { AuthProvider, useAuth } from './AuthContext';
import { OnboardingProvider } from './onboarding';
import { RouteContentSkeleton } from './components/ContentSkeleton';

const AppShell = lazy(() => import('./components/AppShell'));
const Library = lazy(() => import('./pages/Library'));
const Today = lazy(() => import('./pages/Today'));
const Login = lazy(() => import('./components/Login'));
const Signup = lazy(() => import('./components/Signup'));
const ForgotPassword = lazy(() => import('./components/ForgotPassword'));
const ResetPassword = lazy(() => import('./components/ResetPassword'));
const BookDetail = lazy(() => import('./pages/BookDetail'));
const Insights = lazy(() => import('./pages/Insights'));
const Review = lazy(() => import('./pages/Review'));
const ReadingCalendar = lazy(() => import('./pages/Calendar'));
const Momentum = lazy(() => import('./pages/Momentum'));
const Streaks = lazy(() => import('./pages/Streaks'));
const Achievements = lazy(() => import('./pages/Achievements'));
const Account = lazy(() => import('./pages/Account'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Profile = lazy(() => import('./pages/Profile'));
const Quotes = lazy(() => import('./pages/Quotes'));
const Help = lazy(() => import('./pages/Help'));

function RoutePerformanceObserver() {
  const location = useLocation();
  useEffect(() => {
    const startedAt = performance.now();
    const frame = window.requestAnimationFrame(() => captureRoutePerformance(location.pathname, startedAt));
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);
  return null;
}

function SecondaryRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteContentSkeleton />}>{children}</Suspense>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <BrowserRouter><RoutePerformanceObserver /><Suspense fallback={<RouteContentSkeleton />}><Routes><Route path="/login" element={<Login />} /><Route path="/signup" element={<Signup />} /><Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/reset-password" element={<ResetPassword />} /><Route path="*" element={<Login />} /></Routes></Suspense></BrowserRouter>;
  return <OnboardingProvider><BrowserRouter><RoutePerformanceObserver /><Routes><Route element={<Suspense fallback={<RouteContentSkeleton />}><AppShell /></Suspense>}>
    <Route path="/" element={<SecondaryRoute><Library /></SecondaryRoute>} />
    <Route path="/today" element={<SecondaryRoute><Today /></SecondaryRoute>} />
    <Route path="/books/:id" element={<SecondaryRoute><BookDetail /></SecondaryRoute>} />
    <Route path="/insights" element={<SecondaryRoute><Insights /></SecondaryRoute>} />
    <Route path="/review" element={<SecondaryRoute><Review /></SecondaryRoute>} />
    <Route path="/calendar" element={<SecondaryRoute><ReadingCalendar /></SecondaryRoute>} />
    <Route path="/momentum" element={<SecondaryRoute><Momentum /></SecondaryRoute>} />
    <Route path="/streaks" element={<SecondaryRoute><Streaks /></SecondaryRoute>} />
    <Route path="/achievements" element={<SecondaryRoute><Achievements /></SecondaryRoute>} />
    <Route path="/profile" element={<SecondaryRoute><Profile /></SecondaryRoute>} />
    <Route path="/account" element={<SecondaryRoute><Account /></SecondaryRoute>} />
    <Route path="/pricing" element={<SecondaryRoute><Pricing /></SecondaryRoute>} />
    <Route path="/quotes" element={<SecondaryRoute><Quotes /></SecondaryRoute>} />
    <Route path="/help" element={<SecondaryRoute><Help /></SecondaryRoute>} />
    <Route path="*" element={<Library />} />
  </Route></Routes></BrowserRouter></OnboardingProvider>;
}

export default function App() { return <AuthProvider><AppRoutes /></AuthProvider>; }
