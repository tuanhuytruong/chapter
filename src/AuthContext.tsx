import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
  updateUser(user: CurrentUser): void;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

async function authRequest(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  const body = await response.text();
  if (!response.ok) throw new Error(body || response.statusText);
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

  const value: AuthValue = {
    user,
    loading,
    async login(username, password) {
      const data = await authRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setUser(data.user);
    },
    updateUser(nextUser) { setUser(nextUser); },
    async logout() {
      await authRequest("/api/auth/logout", { method: "POST" });
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
