/**
 * Snapshot Service
 *
 * Takes point-in-time snapshots of an Instagram account's follower metrics.
 * Used for the Pro/Pro+ growth chart feature.
 *
 * - takeSnapshot(accountId)     — create one snapshot record now
 * - getSnapshots(userId, accountId, tier) — paginated history (30 for Pro, all for Pro+)
 * - runDailySnapshots()         — called by the cron worker to snapshot all Pro accounts
 *
 * SECURITY:
 * - No session tokens involved — only aggregated counts
 * - Account ownership verified on getSnapshots
 */

import { prisma } from '@ghoast/db';
import { logger } from '../lib/logger.js';

// ── Error types ───────────────────────────────────────────────────────────────

export class SnapshotAccountNotFoundError extends Error {
  constructor() {
    super('Account not found or does not belong to you.');
    this.name = 'SnapshotAccountNotFoundError';
  }
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface SnapshotRecord {
  id: string;
  accountId: string;
  followersCount: number;
  followingCount: number;
  ghostCount: number;
  ratio: number;
  takenAt: Date;
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Takes a point-in-time snapshot of an Instagram account's follower metrics.
 *
 * Reads current followersCount and followingCount from the account record,
 * counts active (non-removed) ghosts, and calculates the following/followers ratio.
 * Ratio is 0 when followersCount is 0 (no followers yet).
 */
export async function takeSnapshot(accountId: string): Promise<SnapshotRecord> {
  const account = await prisma.instagramAccount.findUnique({
    where: { id: accountId },
    select: { followersCount: true, followingCount: true },
  });

  if (!account) throw new SnapshotAccountNotFoundError();

  const ghostCount = await prisma.ghost.count({
    where: { accountId, removedAt: null },
  });

  // Ratio = following / followers, rounded to 2 decimal places
  // Set to 0 when followers = 0 to avoid division-by-zero
  const ratio =
    account.followersCount > 0
      ? Math.round((account.followingCount / account.followersCount) * 100) / 100
      : 0;

  const snapshot = await prisma.accountSnapshot.create({
    data: {
      accountId,
      followersCount: account.followersCount,
      followingCount: account.followingCount,
      ghostCount,
      ratio,
    },
  });

  logger.info(
    { accountId, ratio, ghostCount, followersCount: account.followersCount },
    'Account snapshot taken',
  );

  return snapshot as SnapshotRecord;
}

/**
 * Returns snapshots for an account, ordered most-recent first.
 *
 * Pro tier:    last 30 snapshots (sufficient for 30-day growth chart)
 * Pro+ tier:   unlimited — all historical snapshots
 *
 * Throws SnapshotAccountNotFoundError if the account does not belong to userId.
 */
export async function getSnapshots(
  userId: string,
  accountId: string,
  tier: string,
): Promise<SnapshotRecord[]> {
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });

  if (!account) throw new SnapshotAccountNotFoundError();

  const isPROPlus = tier === 'PRO_PLUS';

  const snapshots = await prisma.accountSnapshot.findMany({
    where: { accountId },
    orderBy: { takenAt: 'desc' },
    ...(isPROPlus ? {} : { take: 30 }),
  });

  return snapshots as SnapshotRecord[];
}

/**
 * Runs daily snapshots for all Pro and Pro+ Instagram accounts.
 * Called by the BullMQ snapshot cron worker at 00:00 UTC.
 *
 * Errors for individual accounts are logged and do not stop processing.
 * Returns a summary { succeeded, failed, total }.
 */
export async function runDailySnapshots(): Promise<{
  succeeded: number;
  failed: number;
  total: number;
}> {
  const accounts = await prisma.instagramAccount.findMany({
    where: {
      user: { tier: { in: ['PRO', 'PRO_PLUS'] } },
      pendingDisconnect: false,
    },
    select: { id: true },
  });

  let succeeded = 0;
  let failed = 0;

  for (const account of accounts) {
    try {
      await takeSnapshot(account.id);
      succeeded++;
    } catch (err) {
      logger.error({ accountId: account.id, err }, 'Daily snapshot failed for account');
      failed++;
    }
  }

  logger.info(
    { succeeded, failed, total: accounts.length },
    'Daily snapshot run complete',
  );

  return { succeeded, failed, total: accounts.length };
}
