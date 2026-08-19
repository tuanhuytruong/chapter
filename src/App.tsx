import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import AppShell from './components/AppShell';
import Login from './components/Login';
import Signup from './components/Signup';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import { AuthProvider, useAuth } from './AuthContext';
import { OnboardingProvider } from './onboarding';

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <BrowserRouter><Routes><Route path="/login" element={<Login />} /><Route path="/signup" element={<Signup />} /><Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/reset-password" element={<ResetPassword />} /><Route path="*" element={<Login />} /></Routes></BrowserRouter>;
  return <OnboardingProvider><BrowserRouter><Routes><Route element={<AppShell />}>
    <Route path="/" element={<Library />} /><Route path="/today" element={<Today />} /><Route path="/books/:id" element={<BookDetail />} /><Route path="/insights" element={<Insights />} /><Route path="/review" element={<Review />} /><Route path="/calendar" element={<ReadingCalendar />} /><Route path="/momentum" element={<Momentum />} /><Route path="/achievements" element={<Achievements />} /><Route path="/profile" element={<Profile />} /><Route path="/account" element={<Account />} /><Route path="/pricing" element={<Pricing />} /><Route path="/quotes" element={<Quotes />} /><Route path="*" element={<Library />} />
  </Route></Routes></BrowserRouter></OnboardingProvider>;
}

export default function App() { return <AuthProvider><AppRoutes /></AuthProvider>; }
