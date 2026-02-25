/**
 * Accounts Service
 * Manages Instagram account connections for a Ghoast user.
 *
 * SECURITY:
 * - Session tokens encrypted with AES-256-CBC before storage
 * - session_token_encrypted and session_token_iv NEVER returned in any response
 * - Ownership verified on all account operations
 */

import { prisma } from '@ghoast/db';
import { encrypt } from '../lib/encryption.js';
import { fetchInstagramUserInfo } from '../lib/instagram.js';
import { logger } from '../lib/logger.js';
import type { InstagramUserInfo } from '../lib/instagram.js';

export { SessionExpiredError, InstagramRateLimitError } from '../lib/instagram.js';

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

// ── Connect ───────────────────────────────────────────────────────────────────

/**
 * Connects an Instagram account to the given Ghoast user.
 * - Validates the session token by calling Instagram's API
 * - Encrypts the token before storing
 * - Upserts the account record (reconnect updates the token)
 */
export async function connectAccount(
  userId: string,
  sessionToken: string,
): Promise<SafeAccount> {
  // Step 1: Validate token with Instagram API and get user info
  // SECURITY: sessionToken is never passed to logger
  const userInfo: InstagramUserInfo = await fetchInstagramUserInfo(sessionToken);

  // Step 2: Encrypt session token before storage
  const { encrypted, iv } = encrypt(sessionToken);

  // Step 3: Upsert account (supports reconnection with fresh token)
  const account = await prisma.instagramAccount.upsert({
    where: {
      userId_instagramUserId: {
        userId,
        instagramUserId: userInfo.instagramUserId,
      },
    },
    update: {
      sessionTokenEncrypted: encrypted,
      sessionTokenIv: iv,
      handle: userInfo.handle,
      displayName: userInfo.displayName,
      profilePicUrl: userInfo.profilePicUrl,
      followersCount: userInfo.followersCount,
      followingCount: userInfo.followingCount,
    },
    create: {
      userId,
      instagramUserId: userInfo.instagramUserId,
      sessionTokenEncrypted: encrypted,
      sessionTokenIv: iv,
      handle: userInfo.handle,
      displayName: userInfo.displayName,
      profilePicUrl: userInfo.profilePicUrl,
      followersCount: userInfo.followersCount,
      followingCount: userInfo.followingCount,
    },
    select: safeAccountSelect,
  });

  logger.info({ userId, accountId: account.id, handle: userInfo.handle }, 'Instagram account connected');

  return account;
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
