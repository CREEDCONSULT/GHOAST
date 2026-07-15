/**
 * Ghost List Service (compliant)
 *
 * Handles:
 * - listGhosts: paginated, filtered, sorted ghost list
 * - markGhostUnfollowed: records that the user manually unfollowed a ghost on Instagram
 * - getAccountStats: stats overview + tier breakdown
 *
 * Ghoast NEVER unfollows on Instagram's behalf. "Marking" a ghost only updates Ghoast's own
 * bookkeeping (removedAt) so the guided-cleanup checklist can track the user's progress.
 *
 * SECURITY:
 * - Account ownership verified on every operation
 * - Tier 5 ghosts are HARD BLOCKED from the cleanup list at the service layer
 */

import { prisma } from '@ghoast/db';
import type { Prisma } from '@ghoast/db';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';

// ── Constants ─────────────────────────────────────────────────────────────────

// Free tier can mark this many ghosts as cleaned up per day; Pro is unlimited.
export const FREE_DAILY_CLEANUP_CAP = 10;

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
    super('Ghost has already been marked as unfollowed.');
    this.name = 'GhostAlreadyRemovedError';
  }
}

export class Tier5ProtectedError extends Error {
  constructor() {
    super('Tier 5 accounts are protected and cannot be added to your cleanup list.');
    this.name = 'Tier5ProtectedError';
  }
}

export class DailyCapReachedError extends Error {
  constructor() {
    super('Daily cleanup limit reached. Upgrade to Pro to track unlimited cleanups.');
    this.name = 'DailyCapReachedError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type GhostSortField = 'score' | 'follow_date' | 'engagement';

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
  scoreEngagement: number;
  scoreEngagementRecency: number;
  scoreCloseFriend: number;
  scoreFollowRecency: number;
  scoreReciprocity: number;
  engagementUnknown: boolean;
  isCloseFriend: boolean;
  likesGiven: number;
  commentsGiven: number;
  followedAt: Date | null;
  lastEngagedAt: Date | null;
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
  totalGhosts: number;
  removedGhosts: number;
  averagePriorityScore: number;
  tierBreakdown: {
    tier1: number;
    tier2: number;
    tier3: number;
    tier4: number;
    tier5: number;
  };
  accountType: Record<string, number>;
}

// ── Redis key helpers ─────────────────────────────────────────────────────────

export function dailyCapKey(accountId: string): string {
  // Key includes the UTC date so it naturally resets at midnight UTC
  const utcDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `daily_cleanup:${accountId}:${utcDate}`;
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
  scoreEngagement: true,
  scoreEngagementRecency: true,
  scoreCloseFriend: true,
  scoreFollowRecency: true,
  scoreReciprocity: true,
  engagementUnknown: true,
  isCloseFriend: true,
  likesGiven: true,
  commentsGiven: true,
  followedAt: true,
  lastEngagedAt: true,
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
    isWhitelisted: false, // "kept" accounts are protected and hidden from the cleanup list
    ...(tier !== undefined && { tier }),
    ...(search && {
      OR: [
        { handle: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const orderBy: Prisma.GhostOrderByWithRelationInput =
    sort === 'follow_date'
      ? { followedAt: { sort: 'asc', nulls: 'last' } } // longest-followed first
      : sort === 'engagement'
        ? { likesGiven: 'desc' }
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
 * Records that the user has manually unfollowed a ghost on Instagram.
 *
 * This performs NO action on Instagram — the user does the unfollow themselves in the
 * Instagram app/site (we deep-link them there). This only updates Ghoast's cleanup tracking.
 *
 * Enforces: account ownership, ghost ownership, Tier 5 hard block, free-tier daily cap.
 */
export async function markGhostUnfollowed(
  userId: string,
  accountId: string,
  ghostId: string,
): Promise<void> {
  // 1. Verify account ownership + get the owner's plan for the cap
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true, user: { select: { tier: true } } },
  });
  if (!account) throw new GhostAccountNotFoundError();

  // 2. Verify ghost exists and belongs to this account
  const ghost = await prisma.ghost.findFirst({
    where: { id: ghostId, accountId },
    select: { id: true, removedAt: true, tier: true },
  });
  if (!ghost) throw new GhostNotFoundError();
  if (ghost.removedAt !== null) throw new GhostAlreadyRemovedError();

  // 3. Tier 5 hard block — protected accounts are never on the cleanup list
  if (ghost.tier === 5) throw new Tier5ProtectedError();

  // 4. Free-tier daily cap (product limit, not a rate-limit safety mechanism)
  if (account.user.tier === 'FREE') {
    const capKey = dailyCapKey(accountId);
    const currentCount = parseInt((await redis.get(capKey)) ?? '0', 10);
    if (currentCount >= FREE_DAILY_CLEANUP_CAP) throw new DailyCapReachedError();
    const ttl = secondsUntilMidnightUtc();
    await redis.set(capKey, String(currentCount + 1), 'EX', ttl);
  }

  await prisma.ghost.update({
    where: { id: ghostId },
    data: { removedAt: new Date() },
  });

  logger.info({ accountId, ghostId }, 'Ghost marked as unfollowed (manual cleanup)');
}

/**
 * Undo a manual "unfollowed" mark (user re-added them or made a mistake).
 */
export async function unmarkGhostUnfollowed(
  userId: string,
  accountId: string,
  ghostId: string,
): Promise<void> {
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });
  if (!account) throw new GhostAccountNotFoundError();

  const ghost = await prisma.ghost.findFirst({
    where: { id: ghostId, accountId },
    select: { id: true },
  });
  if (!ghost) throw new GhostNotFoundError();

  await prisma.ghost.update({ where: { id: ghostId }, data: { removedAt: null } });
  logger.info({ accountId, ghostId }, 'Ghost cleanup mark removed');
}

/**
 * Returns stats for the given account: ghost count, tier breakdown, average score.
 */
export async function getAccountStats(
  userId: string,
  accountId: string,
): Promise<AccountStats> {
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });
  if (!account) throw new GhostAccountNotFoundError();

  const activeWhere = { accountId, removedAt: null, isWhitelisted: false };

  const [totalGhosts, removedGhosts, tierCounts, accountTypeCounts, scoreAggregate] =
    await Promise.all([
      prisma.ghost.count({ where: { accountId } }),
      prisma.ghost.count({ where: { accountId, removedAt: { not: null } } }),
      prisma.ghost.groupBy({
        by: ['tier'],
        where: activeWhere,
        _count: { tier: true },
      }),
      prisma.ghost.groupBy({
        by: ['accountType'],
        where: activeWhere,
        _count: { accountType: true },
      }),
      prisma.ghost.aggregate({
        where: activeWhere,
        _avg: { priorityScore: true },
      }),
    ]);

  const breakdown = { tier1: 0, tier2: 0, tier3: 0, tier4: 0, tier5: 0 };
  for (const row of tierCounts) {
    const key = `tier${row.tier}` as keyof typeof breakdown;
    if (key in breakdown) breakdown[key] = row._count.tier;
  }

  const accountType = { PERSONAL: 0, CREATOR: 0, BRAND: 0, CELEBRITY: 0 };
  for (const row of accountTypeCounts) {
    accountType[row.accountType] = row._count.accountType;
  }

  return {
    totalGhosts,
    removedGhosts,
    averagePriorityScore: Math.round(scoreAggregate._avg.priorityScore ?? 0),
    tierBreakdown: breakdown,
    accountType,
  };
}

/**
 * Returns how many ghosts the user marked cleaned up today (for free-tier UI).
 */
export async function getDailyUnfollowCount(accountId: string): Promise<number> {
  const raw = await redis.get(dailyCapKey(accountId));
  return raw ? parseInt(raw, 10) : 0;
}
