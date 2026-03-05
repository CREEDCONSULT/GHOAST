import { api, setToken, setStoredUser, clearTokens, type User } from './api';

export async function login(email: string, password: string): Promise<User> {
  const data = await api.login(email, password);
  setToken(data.accessToken);
  setStoredUser(data.user);
  return data.user;
}

export async function register(email: string, password: string): Promise<User> {
  const data = await api.register(email, password);
  setToken(data.accessToken);
  setStoredUser(data.user);
  return data.user;
}

export async function logout(): Promise<void> {
  try { await api.logout(); } catch { /* ignore network errors on logout */ }
  clearTokens();
}
