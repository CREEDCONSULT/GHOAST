/**
 * Whitelist Service
 *
 * Manages the ghost whitelist for Pro+ users.
 * Whitelisted ghosts are silently skipped when added to the unfollow queue.
 *
 * Limits:
 * - Max 500 whitelisted ghosts per account
 * - Pro+ only (enforced at route level via checkTier)
 *
 * Implementation:
 * - Uses Ghost.isWhitelisted boolean flag (already in schema)
 * - Ownership verified on all operations
 * - addToWhitelist is idempotent (safe to call on already-whitelisted ghost)
 */

import { prisma } from '@ghoast/db';
import { logger } from '../lib/logger.js';

const WHITELIST_MAX = 500;

// ── Error types ───────────────────────────────────────────────────────────────

export class WhitelistAccountNotFoundError extends Error {
  constructor() {
    super('Instagram account not found or does not belong to you.');
    this.name = 'WhitelistAccountNotFoundError';
  }
}

export class WhitelistGhostNotFoundError extends Error {
  constructor() {
    super('Ghost not found or does not belong to this account.');
    this.name = 'WhitelistGhostNotFoundError';
  }
}

export class WhitelistLimitReachedError extends Error {
  readonly limit: number;
  constructor() {
    super(`Whitelist limit of ${WHITELIST_MAX} ghosts reached. Remove a ghost from the whitelist before adding another.`);
    this.name = 'WhitelistLimitReachedError';
    this.limit = WHITELIST_MAX;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WhitelistedGhost {
  id: string;
  instagramUserId: string;
  handle: string;
  displayName: string | null;
  profilePicUrl: string | null;
  tier: number;
  priorityScore: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function verifyAccountOwnership(userId: string, accountId: string): Promise<void> {
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });
  if (!account) throw new WhitelistAccountNotFoundError();
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Adds a ghost to the whitelist for the given account.
 * - Verifies account ownership
 * - Enforces max 500 whitelist entries per account
 * - Idempotent: adding an already-whitelisted ghost returns it without error
 */
export async function addToWhitelist(
  userId: string,
  accountId: string,
  ghostId: string,
): Promise<WhitelistedGhost> {
  await verifyAccountOwnership(userId, accountId);

  const ghost = await prisma.ghost.findFirst({
    where: { id: ghostId, accountId },
    select: {
      id: true,
      instagramUserId: true,
      handle: true,
      displayName: true,
      profilePicUrl: true,
      tier: true,
      priorityScore: true,
      isWhitelisted: true,
    },
  });

  if (!ghost) throw new WhitelistGhostNotFoundError();

  // Enforce limit only for new additions (idempotent for already-whitelisted)
  if (!ghost.isWhitelisted) {
    const currentCount = await prisma.ghost.count({
      where: { accountId, isWhitelisted: true },
    });
    if (currentCount >= WHITELIST_MAX) throw new WhitelistLimitReachedError();
  }

  await prisma.ghost.update({
    where: { id: ghostId },
    data: { isWhitelisted: true },
  });

  logger.info({ accountId, ghostId }, 'Ghost added to whitelist');

  return {
    id: ghost.id,
    instagramUserId: ghost.instagramUserId,
    handle: ghost.handle,
    displayName: ghost.displayName,
    profilePicUrl: ghost.profilePicUrl,
    tier: ghost.tier,
    priorityScore: ghost.priorityScore,
  };
}

/**
 * Removes a ghost from the whitelist.
 * - Verifies account ownership
 * - Idempotent: removing a non-whitelisted ghost returns without error
 */
export async function removeFromWhitelist(
  userId: string,
  accountId: string,
  ghostId: string,
): Promise<void> {
  await verifyAccountOwnership(userId, accountId);

  const ghost = await prisma.ghost.findFirst({
    where: { id: ghostId, accountId },
    select: { id: true },
  });

  if (!ghost) throw new WhitelistGhostNotFoundError();

  await prisma.ghost.update({
    where: { id: ghostId },
    data: { isWhitelisted: false },
  });

  logger.info({ accountId, ghostId }, 'Ghost removed from whitelist');
}

/**
 * Returns all whitelisted ghosts for the given account.
 * Sorted by priority score descending (highest protection first).
 */
export async function listWhitelist(
  userId: string,
  accountId: string,
): Promise<{ ghosts: WhitelistedGhost[]; total: number }> {
  await verifyAccountOwnership(userId, accountId);

  const ghosts = await prisma.ghost.findMany({
    where: { accountId, isWhitelisted: true },
    select: {
      id: true,
      instagramUserId: true,
      handle: true,
      displayName: true,
      profilePicUrl: true,
      tier: true,
      priorityScore: true,
    },
    orderBy: { priorityScore: 'desc' },
  });

  return { ghosts, total: ghosts.length };
}
