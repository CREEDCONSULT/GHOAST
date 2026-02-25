/**
 * Ghost Scan Service
 *
 * Orchestrates a full Instagram ghost scan:
 * 1. Fetches all accounts the user is following (paginated)
 * 2. Fetches all accounts following the user (paginated)
 * 3. Computes ghost set = following MINUS followers
 * 4. For each ghost: fetches detailed info, scores, upserts into DB
 * 5. Updates instagram_accounts.last_scanned_at on completion
 * 6. Emits Redis pub/sub progress events throughout
 *
 * SECURITY:
 * - Session tokens are decrypted in-process, never logged
 * - All scoring is server-derived; score/tier fields never accepted from user input
 */

import { prisma } from '@ghoast/db';
import type { AccountType } from '@ghoast/db';
import { decrypt } from '../lib/encryption.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import {
  getFollowing,
  getFollowers,
  getUserInfo,
  SessionExpiredError,
  InstagramRateLimitError,
} from '../lib/instagram.js';
import { scoreGhost } from '../lib/scoring.js';
import type { GhostData } from '../lib/scoring.js';

// ── Error types ───────────────────────────────────────────────────────────────

export class ScanNotFoundError extends Error {
  constructor() {
    super('Instagram account not found or does not belong to you.');
    this.name = 'ScanNotFoundError';
  }
}

export class ScanAlreadyInProgressError extends Error {
  constructor() {
    super('A scan is already in progress for this account.');
    this.name = 'ScanAlreadyInProgressError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScanProgress {
  status: 'in_progress' | 'complete' | 'error';
  followingScanned: number;
  followersScanned: number;
  ghostCount: number;
  errorMessage?: string;
}

// ── Redis keys ────────────────────────────────────────────────────────────────

export function scanProgressKey(accountId: string): string {
  return `scan:progress:${accountId}`;
}

export function scanLockKey(accountId: string): string {
  return `scan:lock:${accountId}`;
}

// ── Progress persistence ──────────────────────────────────────────────────────

async function setProgress(accountId: string, progress: ScanProgress): Promise<void> {
  await redis.set(scanProgressKey(accountId), JSON.stringify(progress), 'EX', 3600);
  // Publish for SSE consumers
  await redis.publish(`scan:events:${accountId}`, JSON.stringify(progress));
}

async function getProgress(accountId: string): Promise<ScanProgress | null> {
  const raw = await redis.get(scanProgressKey(accountId));
  if (!raw) return null;
  return JSON.parse(raw) as ScanProgress;
}

// ── Core scan logic ───────────────────────────────────────────────────────────

/**
 * Kicks off an async scan. Returns immediately — the actual work runs in the
 * background. Use getScanProgress() to poll status.
 *
 * Throws ScanNotFoundError if the account doesn't exist / doesn't belong to user.
 * Throws ScanAlreadyInProgressError if a lock is already held.
 */
export async function startScan(userId: string, accountId: string): Promise<void> {
  // Verify ownership
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, userId },
    select: {
      id: true,
      instagramUserId: true,
      sessionTokenEncrypted: true,
      sessionTokenIv: true,
    },
  });

  if (!account) throw new ScanNotFoundError();

  // Acquire lock (60 min TTL — scans must complete or expire)
  const lockSet = await redis.set(scanLockKey(accountId), '1', 'EX', 3600, 'NX');
  if (!lockSet) throw new ScanAlreadyInProgressError();

  // Kick off async — do NOT await
  void runScan(accountId, account.instagramUserId, account.sessionTokenEncrypted, account.sessionTokenIv);
}

/**
 * Returns the current scan progress from Redis, or null if no scan has run.
 */
export async function getScanProgress(
  userId: string,
  accountId: string,
): Promise<ScanProgress | null> {
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });
  if (!account) throw new ScanNotFoundError();
  return getProgress(accountId);
}

// ── Internal scan runner ──────────────────────────────────────────────────────

async function runScan(
  accountId: string,
  instagramUserId: string,
  sessionTokenEncrypted: string,
  sessionTokenIv: string,
): Promise<void> {
  const sessionToken = decrypt(sessionTokenEncrypted, sessionTokenIv);

  const progress: ScanProgress = {
    status: 'in_progress',
    followingScanned: 0,
    followersScanned: 0,
    ghostCount: 0,
  };

  // Sets to compute ghost set
  const followingSet = new Set<string>(); // instagram user IDs the user follows
  const followersSet = new Set<string>(); // instagram user IDs that follow the user

  // Map: instagramUserId → basic follow entry (for building ghost records)
  const followingMap = new Map<string, { handle: string; displayName: string | null; profilePicUrl: string | null; isVerified: boolean }>();

  try {
    await setProgress(accountId, progress);

    // ── Step 1: Collect following ────────────────────────────────────────────
    await getFollowing(
      instagramUserId,
      sessionToken,
      async (users) => {
        for (const u of users) {
          followingSet.add(u.instagramUserId);
          followingMap.set(u.instagramUserId, {
            handle: u.handle,
            displayName: u.displayName,
            profilePicUrl: u.profilePicUrl,
            isVerified: u.isVerified,
          });
        }
        progress.followingScanned += users.length;
        await setProgress(accountId, progress);
      },
    );

    // ── Step 2: Collect followers ────────────────────────────────────────────
    await getFollowers(
      instagramUserId,
      sessionToken,
      async (users) => {
        for (const u of users) {
          followersSet.add(u.instagramUserId);
        }
        progress.followersScanned += users.length;
        await setProgress(accountId, progress);
      },
    );

    // ── Step 3: Compute ghost set ────────────────────────────────────────────
    const ghostIds = [...followingSet].filter((id) => !followersSet.has(id));

    // ── Step 4: Score and upsert each ghost ──────────────────────────────────
    for (const ghostInstagramUserId of ghostIds) {
      try {
        const details = await getUserInfo(ghostInstagramUserId, sessionToken);

        const ghostData: GhostData = {
          followersCount: details.followersCount,
          followingCount: details.followingCount,
          isVerified: details.isVerified,
          accountType: details.accountType as AccountType,
          lastPostDate: details.lastPostDate,
          userEngagedRecently: null, // engagement tracking is Phase 4+
        };

        const scored = scoreGhost(ghostData);
        const entry = followingMap.get(ghostInstagramUserId);

        await prisma.ghost.upsert({
          where: {
            accountId_instagramUserId: {
              accountId,
              instagramUserId: ghostInstagramUserId,
            },
          },
          create: {
            accountId,
            instagramUserId: ghostInstagramUserId,
            handle: details.handle,
            displayName: details.displayName,
            profilePicUrl: entry?.profilePicUrl ?? details.profilePicUrl,
            followersCount: details.followersCount,
            followingCount: details.followingCount,
            isVerified: details.isVerified,
            accountType: details.accountType as AccountType,
            lastPostDate: details.lastPostDate,
            priorityScore: scored.priorityScore,
            tier: scored.tier,
            scoreAccountType: scored.scoreAccountType,
            scoreRatio: scored.scoreRatio,
            scoreEngagement: scored.scoreEngagement,
            scoreSizeBand: scored.scoreSizeBand,
            scorePostRecency: scored.scorePostRecency,
            engagementUnknown: scored.engagementUnknown,
          },
          update: {
            handle: details.handle,
            displayName: details.displayName,
            followersCount: details.followersCount,
            followingCount: details.followingCount,
            isVerified: details.isVerified,
            accountType: details.accountType as AccountType,
            lastPostDate: details.lastPostDate,
            priorityScore: scored.priorityScore,
            tier: scored.tier,
            scoreAccountType: scored.scoreAccountType,
            scoreRatio: scored.scoreRatio,
            scoreEngagement: scored.scoreEngagement,
            scoreSizeBand: scored.scoreSizeBand,
            scorePostRecency: scored.scorePostRecency,
            engagementUnknown: scored.engagementUnknown,
            // Do NOT reset removedAt — keep historical unfollow records
          },
        });

        progress.ghostCount++;
        await setProgress(accountId, progress);
      } catch (ghostErr) {
        // Log per-ghost errors but don't abort the whole scan
        if (ghostErr instanceof SessionExpiredError || ghostErr instanceof InstagramRateLimitError) {
          throw ghostErr; // propagate fatal errors
        }
        logger.warn(
          { ghostInstagramUserId, errName: (ghostErr as Error).name },
          'Failed to fetch ghost info — skipping',
        );
      }
    }

    // ── Step 5: Update last_scanned_at ───────────────────────────────────────
    await prisma.instagramAccount.update({
      where: { id: accountId },
      data: { lastScannedAt: new Date() },
    });

    progress.status = 'complete';
    await setProgress(accountId, progress);
    logger.info({ accountId, ghostCount: progress.ghostCount }, 'Ghost scan complete');
  } catch (err) {
    progress.status = 'error';
    progress.errorMessage =
      err instanceof SessionExpiredError
        ? 'Instagram session expired'
        : err instanceof InstagramRateLimitError
          ? 'Instagram rate limit reached'
          : 'Scan failed unexpectedly';

    await setProgress(accountId, progress).catch(() => {/* ignore */});
    logger.error({ accountId, errName: (err as Error).name }, 'Ghost scan failed');
  } finally {
    // Always release the lock
    await redis.del(scanLockKey(accountId)).catch(() => {/* ignore */});
  }
}
