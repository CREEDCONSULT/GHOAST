/**
 * Instagram Private API Client
 *
 * Uses the Instagram internal mobile API to validate session tokens,
 * fetch basic account information, and paginate following/followers lists.
 * The session token (sessionid cookie) is captured by the frontend WebView.
 *
 * SECURITY:
 * - Session tokens are NEVER logged (redacted in pino config via logger.ts)
 * - All network errors are caught and re-thrown as typed errors
 * - A 10-second timeout prevents hanging requests
 * - Randomised 500ms–2s delay between pagination calls reduces detection risk
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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InstagramFollowEntry {
  instagramUserId: string;
  handle: string;
  displayName: string | null;
  profilePicUrl: string | null;
  isVerified: boolean;
}

export interface InstagramAccountDetails extends InstagramFollowEntry {
  followersCount: number;
  followingCount: number;
  lastPostDate: Date | null;
  isPrivate: boolean;
  mediaCount: number;
  accountType: 'PERSONAL' | 'CREATOR' | 'BRAND' | 'CELEBRITY';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INSTAGRAM_API_BASE = 'https://i.instagram.com/api/v1';

// Realistic Android Instagram app user agent — reduces bot detection risk
const IG_USER_AGENT =
  'Instagram 219.0.0.12.117 Android (28/9; 420dpi; 1080x1920; samsung; SM-G960F; starlte; samsungexynos9810; en_US; 340141790)';

const REQUEST_TIMEOUT_MS = 10_000;
// Randomised delay between pagination calls: 500ms–2s
const PAGINATION_DELAY_MIN_MS = 500;
const PAGINATION_DELAY_MAX_MS = 2_000;

// ── Internal helpers ──────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(): Promise<void> {
  const ms =
    PAGINATION_DELAY_MIN_MS +
    Math.floor(Math.random() * (PAGINATION_DELAY_MAX_MS - PAGINATION_DELAY_MIN_MS));
  return sleep(ms);
}

async function fetchWithTimeout(url: string, headers: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: 'GET', headers, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function handleErrorResponse(response: Response): never {
  if (response.status === 401) throw new SessionExpiredError();
  if (response.status === 429) {
    logger.warn('Instagram API rate limit hit');
    throw new InstagramRateLimitError();
  }
  logger.warn({ status: response.status }, 'Unexpected Instagram API response');
  throw new InstagramApiError(response.status, `Instagram API returned ${response.status}`);
}

function wrapNetworkError(err: unknown): never {
  if (
    err instanceof SessionExpiredError ||
    err instanceof InstagramRateLimitError ||
    err instanceof InstagramApiError
  ) {
    throw err;
  }
  if (err instanceof Error && err.name === 'AbortError') {
    logger.warn('Instagram API request timed out');
    throw new InstagramApiError(504, 'Instagram API request timed out');
  }
  logger.error({ errName: (err as Error).name }, 'Instagram API network error');
  throw new InstagramApiError(502, 'Failed to reach Instagram API');
}

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
  try {
    const response = await fetchWithTimeout(
      `${INSTAGRAM_API_BASE}/accounts/current_user/?edit=true`,
      buildHeaders(sessionToken),
    );

    if (!response.ok) handleErrorResponse(response);

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
    wrapNetworkError(err);
  }
}

// ── Paginated list helpers ─────────────────────────────────────────────────────

type RawUserEdge = {
  pk?: string | number;
  username?: string;
  full_name?: string;
  profile_pic_url?: string;
  is_verified?: boolean;
};

function parseEdge(u: RawUserEdge): InstagramFollowEntry | null {
  if (!u.pk || !u.username) return null;
  return {
    instagramUserId: String(u.pk),
    handle: u.username,
    displayName: u.full_name ?? null,
    profilePicUrl: u.profile_pic_url ?? null,
    isVerified: u.is_verified ?? false,
  };
}

/**
 * Fetches one page of the "following" list for the given Instagram user.
 * Returns the list + next cursor (null when no more pages).
 *
 * SECURITY: never pass sessionToken to logger calls.
 */
async function fetchFollowingPage(
  instagramUserId: string,
  sessionToken: string,
  maxId?: string,
): Promise<{ users: InstagramFollowEntry[]; nextMaxId: string | null }> {
  const url = new URL(`${INSTAGRAM_API_BASE}/friendships/${instagramUserId}/following/`);
  url.searchParams.set('count', '200');
  if (maxId) url.searchParams.set('max_id', maxId);

  const response = await fetchWithTimeout(url.toString(), buildHeaders(sessionToken));
  if (!response.ok) handleErrorResponse(response);

  const data = await response.json() as {
    users?: RawUserEdge[];
    next_max_id?: string;
    status?: string;
  };

  const users = (data.users ?? []).map(parseEdge).filter((u): u is InstagramFollowEntry => u !== null);
  return { users, nextMaxId: data.next_max_id ?? null };
}

/**
 * Fetches one page of the "followers" list for the given Instagram user.
 */
async function fetchFollowersPage(
  instagramUserId: string,
  sessionToken: string,
  maxId?: string,
): Promise<{ users: InstagramFollowEntry[]; nextMaxId: string | null }> {
  const url = new URL(`${INSTAGRAM_API_BASE}/friendships/${instagramUserId}/followers/`);
  url.searchParams.set('count', '200');
  if (maxId) url.searchParams.set('max_id', maxId);

  const response = await fetchWithTimeout(url.toString(), buildHeaders(sessionToken));
  if (!response.ok) handleErrorResponse(response);

  const data = await response.json() as {
    users?: RawUserEdge[];
    next_max_id?: string;
    status?: string;
  };

  const users = (data.users ?? []).map(parseEdge).filter((u): u is InstagramFollowEntry => u !== null);
  return { users, nextMaxId: data.next_max_id ?? null };
}

/**
 * Paginates through ALL accounts the user is following.
 * Emits pages via the onPage callback so the caller can save progress
 * incrementally (resume-safe).
 *
 * SECURITY: never pass sessionToken to logger calls.
 */
export async function getFollowing(
  instagramUserId: string,
  sessionToken: string,
  onPage: (users: InstagramFollowEntry[], pageIndex: number) => Promise<void>,
  resumeMaxId?: string,
): Promise<void> {
  try {
    let maxId: string | undefined = resumeMaxId;
    let pageIndex = 0;

    do {
      const { users, nextMaxId } = await fetchFollowingPage(instagramUserId, sessionToken, maxId);
      if (users.length > 0) await onPage(users, pageIndex);
      maxId = nextMaxId ?? undefined;
      pageIndex++;
      if (maxId) await randomDelay();
    } while (maxId);
  } catch (err) {
    wrapNetworkError(err);
  }
}

/**
 * Paginates through ALL accounts that follow the user.
 * Emits pages via the onPage callback for incremental DB saves.
 *
 * SECURITY: never pass sessionToken to logger calls.
 */
export async function getFollowers(
  instagramUserId: string,
  sessionToken: string,
  onPage: (users: InstagramFollowEntry[], pageIndex: number) => Promise<void>,
  resumeMaxId?: string,
): Promise<void> {
  try {
    let maxId: string | undefined = resumeMaxId;
    let pageIndex = 0;

    do {
      const { users, nextMaxId } = await fetchFollowersPage(instagramUserId, sessionToken, maxId);
      if (users.length > 0) await onPage(users, pageIndex);
      maxId = nextMaxId ?? undefined;
      pageIndex++;
      if (maxId) await randomDelay();
    } while (maxId);
  } catch (err) {
    wrapNetworkError(err);
  }
}

/**
 * Sends an unfollow request for the given target Instagram user ID.
 * Used by the manual unfollow flow and the queue worker.
 *
 * SECURITY: never pass sessionToken to logger calls.
 */
export async function unfollowUser(
  ownerInstagramUserId: string,
  targetInstagramUserId: string,
  sessionToken: string,
): Promise<void> {
  try {
    const response = await fetchWithTimeout(
      `${INSTAGRAM_API_BASE}/friendships/destroy/${targetInstagramUserId}/`,
      {
        ...buildHeaders(sessionToken),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    );

    if (!response.ok) handleErrorResponse(response);
    logger.info({ ownerInstagramUserId, targetInstagramUserId }, 'Unfollow request sent');
  } catch (err) {
    wrapNetworkError(err);
  }
}

/**
 * Fetches detailed account info for a specific Instagram user ID.
 * Used to get scoring dimensions (followerCount, followingCount, lastPostDate, etc.)
 *
 * SECURITY: never pass sessionToken to logger calls.
 */
export async function getUserInfo(
  targetInstagramUserId: string,
  sessionToken: string,
): Promise<InstagramAccountDetails> {
  try {
    const response = await fetchWithTimeout(
      `${INSTAGRAM_API_BASE}/users/${targetInstagramUserId}/info/`,
      buildHeaders(sessionToken),
    );

    if (!response.ok) handleErrorResponse(response);

    const data = await response.json() as {
      user?: {
        pk?: string | number;
        username?: string;
        full_name?: string;
        profile_pic_url?: string;
        is_verified?: boolean;
        is_private?: boolean;
        follower_count?: number;
        following_count?: number;
        media_count?: number;
        // category_name is used to detect brands/creators
        category_name?: string | null;
        // latest_reel_media is a Unix timestamp of most recent post
        latest_reel_media?: number;
      };
      status?: string;
    };

    if (data.status !== 'ok' || !data.user?.pk || !data.user?.username) {
      throw new SessionExpiredError();
    }

    const u = data.user;

    // Derive accountType from Instagram metadata
    let accountType: InstagramAccountDetails['accountType'] = 'PERSONAL';
    if (u.is_verified ?? false) {
      accountType = 'CELEBRITY';
    } else if (u.category_name) {
      const cat = u.category_name.toLowerCase();
      if (cat.includes('creator') || cat.includes('artist') || cat.includes('musician')) {
        accountType = 'CREATOR';
      } else {
        accountType = 'BRAND';
      }
    }

    // latest_reel_media = Unix epoch seconds of most recent post (0 = no posts)
    const lastPostDate =
      u.latest_reel_media && u.latest_reel_media > 0
        ? new Date(u.latest_reel_media * 1000)
        : null;

    return {
      instagramUserId: String(u.pk),
      handle: u.username!,
      displayName: u.full_name ?? null,
      profilePicUrl: u.profile_pic_url ?? null,
      isVerified: u.is_verified ?? false,
      isPrivate: u.is_private ?? false,
      followersCount: u.follower_count ?? 0,
      followingCount: u.following_count ?? 0,
      mediaCount: u.media_count ?? 0,
      lastPostDate,
      accountType,
    };
  } catch (err) {
    wrapNetworkError(err);
  }
}
