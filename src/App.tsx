import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { captureRoutePerformance } from './analytics';
import Library from './pages/Library';
import Today from './pages/Today';
import AppShell from './components/AppShell';
import Login from './components/Login';
import Signup from './components/Signup';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import { AuthProvider, useAuth } from './AuthContext';
import { OnboardingProvider } from './onboarding';
import { RouteContentSkeleton } from './components/ContentSkeleton';

const BookDetail = lazy(() => import('./pages/BookDetail'));
const Insights = lazy(() => import('./pages/Insights'));
const Review = lazy(() => import('./pages/Review'));
const ReadingCalendar = lazy(() => import('./pages/Calendar'));
const Momentum = lazy(() => import('./pages/Momentum'));
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
  if (!user) return <BrowserRouter><RoutePerformanceObserver /><Routes><Route path="/login" element={<Login />} /><Route path="/signup" element={<Signup />} /><Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/reset-password" element={<ResetPassword />} /><Route path="*" element={<Login />} /></Routes></BrowserRouter>;
  return <OnboardingProvider><BrowserRouter><RoutePerformanceObserver /><Routes><Route element={<AppShell />}>
    <Route path="/" element={<Library />} />
    <Route path="/today" element={<Today />} />
    <Route path="/books/:id" element={<SecondaryRoute><BookDetail /></SecondaryRoute>} />
    <Route path="/insights" element={<SecondaryRoute><Insights /></SecondaryRoute>} />
    <Route path="/review" element={<SecondaryRoute><Review /></SecondaryRoute>} />
    <Route path="/calendar" element={<SecondaryRoute><ReadingCalendar /></SecondaryRoute>} />
    <Route path="/momentum" element={<SecondaryRoute><Momentum /></SecondaryRoute>} />
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
