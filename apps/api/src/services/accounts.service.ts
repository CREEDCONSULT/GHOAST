/**
 * Accounts Service
 * Manages Instagram account connections for a Ghoast user.
 *
 * SECURITY:
 * - Session tokens encrypted with authenticated AES-256-GCM before storage
 * - session_token_encrypted and session_token_iv NEVER returned in any response
 * - Ownership verified on all account operations
 */

import { prisma } from '@ghoast/db';
import { logger } from '../lib/logger.js';

// ── Account limits by tier ────────────────────────────────────────────────────

const ACCOUNT_LIMITS: Record<string, number> = {
  FREE: 1,
  PRO: 1,
  PRO_PLUS: 3,
};

// ── Error types ───────────────────────────────────────────────────────────────

export class AccountNotFoundError extends Error {
  constructor() {
    super('Instagram account not found or does not belong to you.');
    this.name = 'AccountNotFoundError';
  }
}

export class AccountAlreadyConnectedError extends Error {
  readonly handle: string;
  constructor(handle: string) {
    super(`@${handle} is already connected to your Ghoast account.`);
    this.name = 'AccountAlreadyConnectedError';
    this.handle = handle;
  }
}

export class AccountLimitReachedError extends Error {
  readonly limit: number;
  constructor(limit: number) {
    super(
      `Your plan supports a maximum of ${limit} connected Instagram account${limit === 1 ? '' : 's'}. Disconnect an existing account or upgrade to Pro+.`,
    );
    this.name = 'AccountLimitReachedError';
    this.limit = limit;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SafeAccount {
  id: string;
  userId: string;
  instagramUserId: string;
  handle: string;
  displayName: string | null;
  profilePicUrl: string | null;
  followersCount: number;
  followingCount: number;
  queuePaused: boolean;
  lastScannedAt: Date | null;
  createdAt: Date;
}

// Prisma select that explicitly excludes session token fields
const safeAccountSelect = {
  id: true,
  userId: true,
  instagramUserId: true,
  handle: true,
  displayName: true,
  profilePicUrl: true,
  followersCount: true,
  followingCount: true,
  queuePaused: true,
  lastScannedAt: true,
  createdAt: true,
} as const;

/** Per-tier connected-account limit, enforced by the import flow. */
export function accountLimitForTier(tier: string | undefined): number {
  return ACCOUNT_LIMITS[tier ?? 'FREE'] ?? 1;
}

// ── Disconnect ────────────────────────────────────────────────────────────────

/**
 * Disconnects an Instagram account from a Ghoast user.
 * - Verifies ownership before deletion
 * - Marks pending queue jobs as SKIPPED (BullMQ cancellation added in Phase 6)
 * - Deletes the account record (cascades to ghosts, queue jobs, snapshots)
 */
export async function disconnectAccount(userId: string, accountId: string): Promise<void> {
  const account = await prisma.instagramAccount.findUnique({
    where: { id: accountId },
    select: { id: true, userId: true, handle: true },
  });

  if (!account || account.userId !== userId) {
    throw new AccountNotFoundError();
  }

  // Mark pending queue jobs as SKIPPED before deleting account
  // Note: BullMQ job cancellation is added in Phase 6
  await prisma.unfollowQueueJob.updateMany({
    where: {
      accountId,
      status: 'PENDING',
    },
    data: { status: 'SKIPPED' },
  });

  // Delete account — cascades to ghosts, queue jobs, sessions, snapshots
  await prisma.instagramAccount.delete({ where: { id: accountId } });

  logger.info({ userId, accountId, handle: account.handle }, 'Instagram account disconnected');
}

// ── List ──────────────────────────────────────────────────────────────────────

/**
 * Returns all Instagram accounts connected to the given Ghoast user.
 * Session token fields are excluded at the Prisma select level.
 */
export async function listAccounts(userId: string): Promise<SafeAccount[]> {
  return prisma.instagramAccount.findMany({
    where: { userId },
    select: safeAccountSelect,
    orderBy: { createdAt: 'asc' },
  });
}

// ── Tier downgrade enforcement ────────────────────────────────────────────────

/**
 * Called after a user's tier is downgraded (subscription cancelled or changed).
 * Flags excess accounts with a 7-day grace period — they will be auto-deleted
 * by the disconnect cron job at 01:00 UTC once the grace period expires.
 *
 * Account selection: oldest accounts are kept (ordered by createdAt asc),
 * newest excess accounts receive the pendingDisconnect flag.
 */
export async function handleTierDowngrade(userId: string, newTier: string): Promise<void> {
  const limit = ACCOUNT_LIMITS[newTier] ?? 1;

  const accounts = await prisma.instagramAccount.findMany({
    where: { userId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (accounts.length <= limit) return; // Within new limit — no action needed

  const excessAccounts = accounts.slice(limit);
  const disconnectAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.instagramAccount.updateMany({
    where: { id: { in: excessAccounts.map((a) => a.id) } },
    data: { pendingDisconnect: true, disconnectAt },
  });

  logger.info(
    { userId, newTier, excessCount: excessAccounts.length, disconnectAt },
    'Excess accounts flagged for disconnect after tier downgrade — 7-day grace period started',
  );
}

/**
 * Deletes all Instagram accounts whose grace period has expired
 * (pendingDisconnect=true and disconnectAt <= now).
 * Called by the daily disconnect cron at 01:00 UTC.
 */
export async function disconnectExpiredAccounts(): Promise<{
  succeeded: number;
  failed: number;
  total: number;
}> {
  const expiredAccounts = await prisma.instagramAccount.findMany({
    where: {
      pendingDisconnect: true,
      disconnectAt: { lte: new Date() },
    },
    select: { id: true, userId: true, handle: true },
  });

  let succeeded = 0;
  let failed = 0;

  for (const account of expiredAccounts) {
    try {
      // Mark pending queue jobs as SKIPPED before deletion
      await prisma.unfollowQueueJob.updateMany({
        where: { accountId: account.id, status: 'PENDING' },
        data: { status: 'SKIPPED' },
      });

      // Delete account — cascades to ghosts, queue jobs, sessions, snapshots
      await prisma.instagramAccount.delete({ where: { id: account.id } });

      logger.info(
        { accountId: account.id, userId: account.userId, handle: account.handle },
        'Expired account disconnected by cron',
      );
      succeeded++;
    } catch (err) {
      logger.error({ accountId: account.id, err }, 'Failed to disconnect expired account');
      failed++;
    }
  }

  return { succeeded, failed, total: expiredAccounts.length };
}
