// ── Token storage ─────────────────────────────────────────────────────────────
// Access token lives in sessionStorage (cleared on tab close).
// Refresh token is in an httpOnly cookie set by the server — never touched in JS.

import type {
  AccountStatsResponse,
  GhostListResponse,
  GhostResponse,
} from '@ghoast/contracts';

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

  // Compliant ingestion: upload the user's official Instagram data export.
  importExport: (handle: string, file: File, onProgress?: (pct: number) => void) =>
    uploadImport(handle, file, onProgress),

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

  // Mark a ghost as unfollowed after the user unfollows them on Instagram themselves.
  markGhostUnfollowed: (accountId: string, ghostId: string) =>
    apiFetch<{ success: boolean }>(
      `/accounts/${accountId}/ghosts/${ghostId}/unfollow`,
      { method: 'POST' },
    ),

  // Undo a cleanup mark.
  unmarkGhostUnfollowed: (accountId: string, ghostId: string) =>
    apiFetch<{ success: boolean }>(
      `/accounts/${accountId}/ghosts/${ghostId}/unfollow`,
      { method: 'DELETE' },
    ),

  // Billing
  subscribe: (tier: 'PRO' | 'PRO_PLUS', successUrl: string, cancelUrl: string) =>
    apiFetch<{ url: string }>('/billing/subscribe', {
      method: 'POST',
      body: { tier, successUrl, cancelUrl },
    }),

  getBalance: () =>
    apiFetch<{ balance: number }>('/billing/balance'),

  deleteAccount: () =>
    apiFetch<void>('/users/me', {
      method: 'DELETE',
      body: { confirmation: 'DELETE' },
    }),
};

// ── Import upload helper ──────────────────────────────────────────────────────
// Multipart upload with progress via XHR (fetch has no upload-progress events).

export interface ImportSummary {
  accountId: string;
  handle: string;
  followingCount: number;
  followersCount: number;
  ghostCount: number;
  newGhostCount: number;
  engagementIncluded: boolean;
  tierBreakdown: { tier1: number; tier2: number; tier3: number; tier4: number; tier5: number };
}

function uploadImport(
  handle: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<ImportSummary> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('handle', handle);
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/v1/accounts/import');
    xhr.withCredentials = true;
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      let json: Record<string, unknown> = {};
      try { json = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json as unknown as ImportSummary);
      } else {
        reject(
          new ApiError(
            (json.message as string) || (json.error as string) || 'Import failed',
            xhr.status,
            json.code as string | undefined,
          ),
        );
      }
    };
    xhr.onerror = () => reject(new ApiError('Network error during upload', 0));
    xhr.send(form);
  });
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

export type Ghost = GhostResponse;

export interface GhostListParams {
  tier?: 1 | 2 | 3 | 4 | 5;
  sort?: 'score' | 'follow_date' | 'engagement';
  search?: string;
  page?: number;
  limit?: number;
}

export type { GhostListResponse };
export type AccountStats = AccountStatsResponse;
