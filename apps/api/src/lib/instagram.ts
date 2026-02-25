/**
 * Instagram Private API Client
 *
 * Uses the Instagram internal mobile API to validate session tokens and
 * fetch basic account information. The session token (sessionid cookie) is
 * captured by the frontend WebView after the user logs in.
 *
 * SECURITY:
 * - Session tokens are NEVER logged (redacted in pino config via logger.ts)
 * - All network errors are caught and re-thrown as typed errors
 * - A 10-second timeout prevents hanging requests
 */

import { logger } from './logger.js';

// ── Error types ───────────────────────────────────────────────────────────────

export class SessionExpiredError extends Error {
  constructor() {
    super('Instagram session has expired. Please reconnect your account.');
    this.name = 'SessionExpiredError';
  }
}

export class InstagramRateLimitError extends Error {
  constructor() {
    super('Instagram rate limit reached. Please try again later.');
    this.name = 'InstagramRateLimitError';
  }
}

export class InstagramApiError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'InstagramApiError';
    this.statusCode = statusCode;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InstagramUserInfo {
  instagramUserId: string;
  handle: string;
  displayName: string | null;
  profilePicUrl: string | null;
  followersCount: number;
  followingCount: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INSTAGRAM_API_BASE = 'https://i.instagram.com/api/v1';

// Realistic Android Instagram app user agent — reduces bot detection risk
const IG_USER_AGENT =
  'Instagram 219.0.0.12.117 Android (28/9; 420dpi; 1080x1920; samsung; SM-G960F; starlte; samsungexynos9810; en_US; 340141790)';

const REQUEST_TIMEOUT_MS = 10_000;

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildHeaders(sessionToken: string): Record<string, string> {
  return {
    'Cookie': `sessionid=${sessionToken}`,
    'User-Agent': IG_USER_AGENT,
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'x-ig-app-id': '936619743392459',
    'x-ig-bandwidth-speed-kbps': '-1.000',
    'x-ig-bandwidth-total-bytes-b': '0',
    'x-ig-bandwidth-total-time-ms': '0',
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches the basic profile info for the Instagram account identified by the
 * given session token. Throws typed errors on auth failure, rate limits, etc.
 *
 * SECURITY: never pass sessionToken to logger calls.
 */
export async function fetchInstagramUserInfo(sessionToken: string): Promise<InstagramUserInfo> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${INSTAGRAM_API_BASE}/accounts/current_user/?edit=true`,
      {
        method: 'GET',
        headers: buildHeaders(sessionToken),
        signal: controller.signal,
      },
    );

    // 401 = session expired / invalid
    if (response.status === 401) {
      throw new SessionExpiredError();
    }

    // 429 = rate limited by Instagram
    if (response.status === 429) {
      logger.warn('Instagram API rate limit hit on session validation');
      throw new InstagramRateLimitError();
    }

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Unexpected Instagram API response');
      throw new InstagramApiError(response.status, `Instagram API returned ${response.status}`);
    }

    const data = await response.json() as {
      user?: {
        pk?: string | number;
        username?: string;
        full_name?: string;
        profile_pic_url?: string;
        follower_count?: number;
        following_count?: number;
      };
      status?: string;
    };

    if (data.status !== 'ok' || !data.user?.pk || !data.user?.username) {
      throw new SessionExpiredError();
    }

    const user = data.user;

    return {
      instagramUserId: String(user.pk),
      handle: user.username!, // validated non-null in the guard check above
      displayName: user.full_name ?? null,
      profilePicUrl: user.profile_pic_url ?? null,
      followersCount: user.follower_count ?? 0,
      followingCount: user.following_count ?? 0,
    };
  } catch (err) {
    // Re-throw typed errors as-is
    if (
      err instanceof SessionExpiredError ||
      err instanceof InstagramRateLimitError ||
      err instanceof InstagramApiError
    ) {
      throw err;
    }

    // Timeout
    if (err instanceof Error && err.name === 'AbortError') {
      logger.warn('Instagram API request timed out');
      throw new InstagramApiError(504, 'Instagram API request timed out');
    }

    // Network error
    logger.error({ errName: (err as Error).name }, 'Instagram API network error');
    throw new InstagramApiError(502, 'Failed to reach Instagram API');
  } finally {
    clearTimeout(timeout);
  }
}
