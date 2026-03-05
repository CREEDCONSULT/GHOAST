// ── Token storage ─────────────────────────────────────────────────────────────
// Access token lives in sessionStorage (cleared on tab close).
// Refresh token is in an httpOnly cookie set by the server — never touched in JS.

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('ghoast_token');
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('ghoast_token', token);
}

export function setStoredUser(user: User): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('ghoast_user', JSON.stringify(user));
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem('ghoast_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('ghoast_token');
  sessionStorage.removeItem('ghoast_user');
}

// ── Refresh ───────────────────────────────────────────────────────────────────

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.accessToken) {
      setToken(data.accessToken);
      if (data.user) setStoredUser(data.user);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ── Error class ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function apiFetch<T = unknown>(
  path: string,
  options: {
    method?: HttpMethod;
    body?: unknown;
    headers?: Record<string, string>;
    skipAuth?: boolean;
  } = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token && !options.skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  let res = await fetch(`/api/v1${path}`, init);

  // Token expired — try refresh once, then retry
  if (res.status === 401 && !options.skipAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getToken()}`;
      res = await fetch(`/api/v1${path}`, { ...init, headers });
    }
    if (res.status === 401) {
      clearTokens();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new ApiError('Session expired', 401, 'SESSION_EXPIRED');
    }
  }

  if (res.status === 204) return undefined as T;

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      json.error || json.message || 'Request failed',
      res.status,
      json.code,
    );
  }

  return json as T;
}

// ── Typed API methods ─────────────────────────────────────────────────────────

export const api = {
  // Auth
  login: (email: string, password: string) =>
    apiFetch<{ user: User; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    }),

  register: (email: string, password: string) =>
    apiFetch<{ user: User; accessToken: string }>('/auth/register', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    }),

  logout: () =>
    apiFetch<void>('/auth/logout', { method: 'DELETE' }),

  // Accounts
  getAccounts: () =>
    apiFetch<{ accounts: Account[] }>('/accounts'),

  connectAccount: (sessionToken: string) =>
    apiFetch<{ account: Account }>('/accounts/connect', {
      method: 'POST',
      body: { sessionToken },
    }),

  disconnectAccount: (id: string) =>
    apiFetch<void>(`/accounts/${id}`, { method: 'DELETE' }),

  // Ghosts
  getGhosts: (accountId: string, params?: GhostListParams) => {
    const qs = new URLSearchParams();
    if (params?.tier) qs.set('tier', String(params.tier));
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return apiFetch<GhostListResponse>(
      `/accounts/${accountId}/ghosts${query ? `?${query}` : ''}`,
    );
  },

  getStats: (accountId: string) =>
    apiFetch<AccountStats>(`/accounts/${accountId}/stats`),

  unfollowGhost: (accountId: string, ghostId: string) =>
    apiFetch<{ success: boolean }>(
      `/accounts/${accountId}/ghosts/${ghostId}/unfollow`,
      { method: 'POST' },
    ),

  startScan: (accountId: string) =>
    apiFetch<{ scanId: string }>(`/accounts/${accountId}/scan`, { method: 'POST' }),

  // Queue
  startQueue: (accountId: string, ghostIds: string[]) =>
    apiFetch<{ jobId: string; status: string; totalJobs: number; estimatedDuration: number }>(
      '/queue/start',
      { method: 'POST', body: { accountId, ghostIds } },
    ),

  pauseQueue: (accountId: string) =>
    apiFetch<{ success: boolean }>('/queue/pause', { method: 'POST', body: { accountId } }),

  cancelQueue: (accountId: string) =>
    apiFetch<{ success: boolean }>('/queue/cancel', { method: 'POST', body: { accountId } }),

  // Billing
  subscribe: (tier: 'PRO' | 'PRO_PLUS', successUrl: string, cancelUrl: string) =>
    apiFetch<{ url: string }>('/billing/subscribe', {
      method: 'POST',
      body: { tier, successUrl, cancelUrl },
    }),

  getBalance: () =>
    apiFetch<{ balance: number }>('/billing/balance'),
};

// ── SSE helper ────────────────────────────────────────────────────────────────
// EventSource doesn't support auth headers — use fetch + ReadableStream instead.

export type QueueEvent =
  | { type: 'job_started'; jobId: string; ghostHandle: string }
  | { type: 'job_completed'; jobId: string; success: boolean }
  | { type: 'rate_limit_hit'; pauseUntil: string }
  | { type: 'queue_completed'; totalUnfollowed: number }
  | { type: 'queue_cancelled' }
  | { type: 'keep_alive' };

export async function* streamQueueStatus(
  accountId: string,
): AsyncGenerator<QueueEvent> {
  const token = getToken();
  const res = await fetch(`/api/v1/queue/status/${accountId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });

  if (!res.ok || !res.body) throw new ApiError('SSE stream failed', res.status);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split('\n\n');
      buffer = messages.pop() ?? '';
      for (const message of messages) {
        const line = message.trim();
        if (line.startsWith('data: ')) {
          try {
            yield JSON.parse(line.slice(6)) as QueueEvent;
          } catch { /* skip malformed */ }
        }
      }
    }
  } finally {
    reader.cancel();
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserTier = 'FREE' | 'PRO' | 'PRO_PLUS';

export interface User {
  id: string;
  email: string;
  tier: UserTier;
  creditBalance: number;
  createdAt: string;
}

export interface Account {
  id: string;
  userId: string;
  instagramUserId: string;
  handle: string;
  displayName: string;
  followersCount: number;
  followingCount: number;
  lastScannedAt: string | null;
  createdAt: string;
}

export type AccountType = 'PERSONAL' | 'CREATOR' | 'BRAND' | 'CELEBRITY';

export interface Ghost {
  id: string;
  accountId: string;
  instagramUserId: string;
  handle: string;
  displayName: string;
  followersCount: number;
  followingCount: number;
  isVerified: boolean;
  accountType: AccountType;
  priorityScore: number;
  tier: 1 | 2 | 3 | 4 | 5;
  scoreAccountType: number;
  scoreRatio: number;
  scoreEngagement: number;
  scoreSizeBand: number;
  scorePostRecency: number;
  lastPostDate: string | null;
  removedAt: string | null;
  isWhitelisted: boolean;
}

export interface GhostListParams {
  tier?: 1 | 2 | 3 | 4 | 5;
  sort?: 'score' | 'followers' | 'last_post';
  search?: string;
  page?: number;
  limit?: number;
}

export interface GhostListResponse {
  ghosts: Ghost[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  dailyUnfollowCount: number;
  dailyUnfollowCap: number;
}

export interface AccountStats {
  totalGhosts: number;
  removedGhosts: number;
  averagePriorityScore: number;
  tierBreakdown: Record<string, number>;
  accountType: Record<string, number>;
}
