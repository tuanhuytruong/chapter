import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { identifyAnalyticsUser, resetAnalyticsUser } from "./analytics";
import { clearMembershipCache } from "./membershipCache";

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface AuthValue {
  user: CurrentUser | null;
  loading: boolean;
  login(username: string, password: string): Promise<void>;
  signup(email: string, displayName: string, password: string, confirmPassword: string): Promise<void>;
  completePasswordReset(token: string, newPassword: string, confirmPassword: string): Promise<void>;
  updateUser(user: CurrentUser): void;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function isStandalonePwa(): boolean {
  return typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

async function authRequest(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  const body = await response.text();
  if (!response.ok) {
    let message = body || response.statusText;
    try { message = JSON.parse(body).error || message; } catch { /* non-JSON error */ }
    throw new Error(message);
  }
  return body ? JSON.parse(body) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authRequest("/api/auth/session")
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) identifyAnalyticsUser(user.id);
  }, [user]);

  const value: AuthValue = {
    user,
    loading,
    async login(username, password) {
      const data = await authRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password, isPwa: isStandalonePwa() }),
      });
      clearMembershipCache();
      setUser(data.user);
    },
    async signup(email, displayName, password, confirmPassword) {
      const data = await authRequest("/api/auth/signup", {
        method: "POST", body: JSON.stringify({ email, displayName, password, confirmPassword, isPwa: isStandalonePwa() }),
      });
      clearMembershipCache();
      setUser(data.user);
    },
    async completePasswordReset(token, newPassword, confirmPassword) {
      const data = await authRequest("/api/auth/reset-password", {
        method: "POST", body: JSON.stringify({ token, newPassword, confirmPassword, isPwa: isStandalonePwa() }),
      });
      clearMembershipCache();
      setUser(data.user);
    },
    updateUser(nextUser) { setUser(nextUser); },
    async logout() {
      clearMembershipCache();
      await authRequest("/api/auth/logout", { method: "POST" });
      resetAnalyticsUser();
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
