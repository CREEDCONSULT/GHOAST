/**
 * Ghost List Service
 *
 * Handles:
 * - listGhosts: paginated, filtered, sorted ghost list
 * - unfollowGhost: manual unfollow with daily cap enforcement
 * - getAccountStats: stats overview + tier breakdown
 *
 * SECURITY:
 * - Account ownership verified on every operation
 * - session_token_encrypted / session_token_iv never returned in any response
 * - Tier 5 ghosts are HARD BLOCKED from unfollow at the service layer
 * - Daily cap enforced server-side via Redis (never trusted from client)
 */

import { prisma } from '@ghoast/db';
import type { Prisma } from '@ghoast/db';
import { decrypt } from '../lib/encryption.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import { unfollowUser, SessionExpiredError, InstagramRateLimitError } from '../lib/instagram.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const FREE_DAILY_UNFOLLOW_CAP = 10;

// ── Error types ───────────────────────────────────────────────────────────────

export class GhostAccountNotFoundError extends Error {
  constructor() {
    super('Account not found or does not belong to you.');
    this.name = 'GhostAccountNotFoundError';
  }
}

export class GhostNotFoundError extends Error {
  constructor() {
    super('Ghost not found.');
    this.name = 'GhostNotFoundError';
  }
}

export class GhostAlreadyRemovedError extends Error {
  constructor() {
    super('Ghost has already been unfollowed.');
    this.name = 'GhostAlreadyRemovedError';
  }
}

export class Tier5ProtectedError extends Error {
  constructor() {
    super('Tier 5 accounts are protected and cannot be unfollowed.');
    this.name = 'Tier5ProtectedError';
  }
}

export class DailyCapReachedError extends Error {
  constructor() {
    super('Daily unfollow limit reached. Upgrade to Pro for unlimited ghosting.');
    this.name = 'DailyCapReachedError';
  }
}

// Re-export Instagram errors so routes can instanceof-check them
export { SessionExpiredError, InstagramRateLimitError };

// ── Types ─────────────────────────────────────────────────────────────────────

export type GhostSortField = 'score' | 'followers' | 'last_post';

export interface ListGhostsOptions {
  tier?: number | undefined;
  sort?: GhostSortField | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface GhostRecord {
  id: string;
  accountId: string;
  instagramUserId: string;
  handle: string;
  displayName: string | null;
  profilePicUrl: string | null;
  followersCount: number;
  followingCount: number;
  isVerified: boolean;
  accountType: string;
  lastPostDate: Date | null;
  priorityScore: number;
  tier: number;
  scoreAccountType: number;
  scoreRatio: number;
  scoreEngagement: number;
  scoreSizeBand: number;
  scorePostRecency: number;
  engagementUnknown: boolean;
  isWhitelisted: boolean;
  removedAt: Date | null;
  firstSeenAt: Date;
}

export interface ListGhostsResult {
  ghosts: GhostRecord[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AccountStats {
  followersCount: number;
  followingCount: number;
  ghostCount: number;
  ratio: number;
  tierBreakdown: {
    tier1: number;
    tier2: number;
    tier3: number;
    tier4: number;
    tier5: number;
  };
}

// ── Redis key helpers ─────────────────────────────────────────────────────────

export function dailyCapKey(accountId: string): string {
  // Key includes the UTC date so it naturally resets at midnight UTC
  const utcDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `daily_unfollow:${accountId}:${utcDate}`;
}

/** Seconds remaining until midnight UTC */
function secondsUntilMidnightUtc(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

// ── Ghost select (no session token fields) ────────────────────────────────────

const ghostSelect = {
  id: true,
  accountId: true,
  instagramUserId: true,
  handle: true,
  displayName: true,
  profilePicUrl: true,
  followersCount: true,
  followingCount: true,
  isVerified: true,
  accountType: true,
  lastPostDate: true,
  priorityScore: true,
  tier: true,
  scoreAccountType: true,
  scoreRatio: true,
  scoreEngagement: true,
  scoreSizeBand: true,
  scorePostRecency: true,
  engagementUnknown: true,
  isWhitelisted: true,
  removedAt: true,
  firstSeenAt: true,
} as const;

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Returns a paginated, filtered, sorted ghost list for the given account.
 * Only returns ghosts that have not been removed (removedAt is null).
 */
export async function listGhosts(
  userId: string,
  accountId: string,
  options: ListGhostsOptions = {},
): Promise<ListGhostsResult> {
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });
  if (!account) throw new GhostAccountNotFoundError();

  const { tier, sort = 'score', search, page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  const where: Prisma.GhostWhereInput = {
    accountId,
    removedAt: null,
    ...(tier !== undefined && { tier }),
    ...(search && {
      OR: [
        { handle: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const orderBy: Prisma.GhostOrderByWithRelationInput =
    sort === 'followers'
      ? { followersCount: 'desc' }
      : sort === 'last_post'
        ? { lastPostDate: { sort: 'desc', nulls: 'last' } }
        : { priorityScore: 'asc' }; // default: lowest score first (easiest to cut)

  const [ghosts, total] = await Promise.all([
    prisma.ghost.findMany({ where, orderBy, skip, take: limit, select: ghostSelect }),
    prisma.ghost.count({ where }),
  ]);

  return {
    ghosts: ghosts as GhostRecord[],
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

/**
 * Manually unfollows a single ghost.
 * Enforces:
 * - Account ownership
 * - Ghost existence and ownership
 * - Tier 5 hard block
 * - Daily cap (10/day for FREE tier)
 * - Instagram unfollow via private API
 *
 * SECURITY: session token decrypted in-process, never logged.
 */
export async function unfollowGhost(
  userId: string,
  accountId: string,
  ghostId: string,
): Promise<void> {
  // 1. Verify account ownership + get session token
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, userId },
    select: {
      id: true,
      instagramUserId: true,
      sessionTokenEncrypted: true,
      sessionTokenIv: true,
    },
  });
  if (!account) throw new GhostAccountNotFoundError();

  // 2. Verify ghost exists and belongs to this account
  const ghost = await prisma.ghost.findFirst({
    where: { id: ghostId, accountId },
    select: { id: true, instagramUserId: true, removedAt: true, tier: true },
  });
  if (!ghost) throw new GhostNotFoundError();
  if (ghost.removedAt !== null) throw new GhostAlreadyRemovedError();

  // 3. Tier 5 hard block — NEVER allow unfollowing Tier 5 accounts
  if (ghost.tier === 5) throw new Tier5ProtectedError();

  // 4. Daily cap check
  const capKey = dailyCapKey(accountId);
  const currentCount = parseInt((await redis.get(capKey)) ?? '0', 10);
  if (currentCount >= FREE_DAILY_UNFOLLOW_CAP) throw new DailyCapReachedError();

  // 5. Execute unfollow via Instagram private API
  const sessionToken = decrypt(account.sessionTokenEncrypted, account.sessionTokenIv);
  await unfollowUser(account.instagramUserId, ghost.instagramUserId, sessionToken);

  // 6. Only increment cap + mark removed_at AFTER successful Instagram call
  const ttl = secondsUntilMidnightUtc();
  await redis.set(capKey, String(currentCount + 1), 'EX', ttl);

  await prisma.ghost.update({
    where: { id: ghostId },
    data: { removedAt: new Date() },
  });

  logger.info({ accountId, ghostId }, 'Ghost unfollowed (manual)');
}

/**
 * Returns stats for the given account: follower counts, ghost count, ratio, tier breakdown.
 */
export async function getAccountStats(
  userId: string,
  accountId: string,
): Promise<AccountStats> {
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, userId },
    select: {
      followersCount: true,
      followingCount: true,
    },
  });
  if (!account) throw new GhostAccountNotFoundError();

  // Count active (not removed) ghosts per tier
  const tierCounts = await prisma.ghost.groupBy({
    by: ['tier'],
    where: { accountId, removedAt: null },
    _count: { tier: true },
  });

  const breakdown = { tier1: 0, tier2: 0, tier3: 0, tier4: 0, tier5: 0 };
  for (const row of tierCounts) {
    const key = `tier${row.tier}` as keyof typeof breakdown;
    if (key in breakdown) breakdown[key] = row._count.tier;
  }

  const ghostCount = Object.values(breakdown).reduce((sum, n) => sum + n, 0);
  const ratio =
    account.followingCount > 0
      ? parseFloat((account.followersCount / account.followingCount).toFixed(2))
      : 0;

  return {
    followersCount: account.followersCount,
    followingCount: account.followingCount,
    ghostCount,
    ratio,
    tierBreakdown: breakdown,
  };
}

/**
 * Returns how many manual unfollows the user has performed today (for free tier UI).
 */
export async function getDailyUnfollowCount(accountId: string): Promise<number> {
  const raw = await redis.get(dailyCapKey(accountId));
  return raw ? parseInt(raw, 10) : 0;
}
