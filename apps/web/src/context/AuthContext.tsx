'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { getToken, getStoredUser, setStoredUser, type User } from '../lib/api';
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
    // Restore auth state from sessionStorage on mount
    if (getToken()) {
      const stored = getStoredUser();
      setUserState(stored);
    }
    setIsLoading(false);
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
