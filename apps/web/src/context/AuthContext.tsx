'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { getToken, getStoredUser, setStoredUser, tryRefresh, type User } from '../lib/api';
import { login as doLogin, register as doRegister, logout as doLogout } from '../lib/auth';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Fast path: an access token already exists in this tab.
      if (getToken()) {
        if (!cancelled) {
          setUserState(getStoredUser());
          setIsLoading(false);
        }
        return;
      }

      // No access token (e.g. the tab was closed and sessionStorage cleared), but the
      // httpOnly refresh cookie may still be valid — try to restore the session with it.
      let restored = false;
      try {
        restored = await tryRefresh();
      } catch {
        restored = false;
      }
      if (cancelled) return;

      if (restored) {
        setUserState(getStoredUser());
      } else {
        // Refresh failed: proactively clear any stale refresh cookie so the middleware
        // stops redirecting /login -> /app and we don't get stuck in a redirect loop.
        try {
          await doLogout();
        } catch {
          /* ignore */
        }
        if (!cancelled) setUserState(null);
      }
      if (!cancelled) setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await doLogin(email, password);
    setUserState(u);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const u = await doRegister(email, password);
    setUserState(u);
  }, []);

  const logout = useCallback(async () => {
    await doLogout();
    setUserState(null);
  }, []);

  const setUser = useCallback((u: User) => {
    setUserState(u);
    setStoredUser(u);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
