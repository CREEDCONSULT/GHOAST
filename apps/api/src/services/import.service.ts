/**
 * Data-Export Import Service (compliant ingestion)
 *
 * Replaces the old private-API "scan". The user uploads their official Instagram
 * data export; we parse it, compute the ghost set (accounts they follow that don't
 * follow back), score each ghost from export-derived signals, and persist.
 *
 * There is NO Instagram API access here — everything comes from the uploaded file.
 */

import { prisma } from '@ghoast/db';
import { logger } from '../lib/logger.js';
import {
  parseExportZip,
  parseExportFiles,
  computeGhosts,
  ExportParseError,
  type ParsedExport,
  type GhostCandidate,
} from '../lib/instagram-export.js';
import { scoreGhost } from '../lib/scoring.js';
import { takeSnapshot } from './snapshot.service.js';
import { accountLimitForTier, AccountLimitReachedError } from './accounts.service.js';

export { ExportParseError, AccountLimitReachedError };

export class InvalidHandleError extends Error {
  constructor() {
    super('Enter the Instagram username this export belongs to.');
    this.name = 'InvalidHandleError';
  }
}

export interface ImportSummary {
  accountId: string;
  handle: string;
  followingCount: number;
  followersCount: number;
  ghostCount: number;
  newGhostCount: number;
  engagementIncluded: boolean;
  /** True when Instagram's export appears to have truncated the follower list (see below). */
  followersLikelyIncomplete: boolean;
  tierBreakdown: { tier1: number; tier2: number; tier3: number; tier4: number; tier5: number };
}

/**
 * Instagram's data export sometimes returns only a recent slice of a user's followers while
 * the following list is complete. When that happens, "who doesn't follow you back" over-reports
 * badly. Heuristic: the oldest follower is far newer than the oldest followed account.
 */
function detectTruncatedFollowers(parsed: ParsedExport): boolean {
  const oldest = (arr: { followedAt: Date | null }[]): number | null => {
    let min: number | null = null;
    for (const x of arr) {
      if (x.followedAt) {
        const t = x.followedAt.getTime();
        if (min === null || t < min) min = t;
      }
    }
    return min;
  };
  const followingOldest = oldest(parsed.following);
  const followersOldest = oldest(parsed.followers);
  if (followingOldest === null || followersOldest === null) return false;
  const TWO_YEARS_MS = 730 * 24 * 60 * 60 * 1000;
  return (
    parsed.following.length > 100 &&
    parsed.followers.length < parsed.following.length &&
    followersOldest - followingOldest > TWO_YEARS_MS
  );
}

/** Scored, export-derived fields written to a Ghost row (shared by create + update paths). */
type GhostScoreData = {
  handle: string;
  profilePicUrl: string | null;
  followedAt: Date | null;
  lastEngagedAt: Date | null;
  isCloseFriend: boolean;
  likesGiven: number;
  commentsGiven: number;
  priorityScore: number;
  tier: number;
  scoreEngagement: number;
  scoreEngagementRecency: number;
  scoreCloseFriend: number;
  scoreFollowRecency: number;
  scoreReciprocity: number;
  engagementUnknown: boolean;
};

/** Normalize a handle: strip a leading @, trim, lowercase for the stable id. */
function normalizeHandle(raw: string): { display: string; id: string } {
  const display = raw.trim().replace(/^@/, '');
  return { display, id: display.toLowerCase() };
}

/**
 * Parse an uploaded export buffer. Accepts a full export .zip or a single JSON file.
 */
export function parseUpload(filename: string, buffer: Buffer): ParsedExport {
  const isZip = filename.toLowerCase().endsWith('.zip') || looksLikeZip(buffer);
  if (isZip) return parseExportZip(buffer);
  // single JSON file — key it by its own name so the parser's matchers apply
  return parseExportFiles({ [filename]: buffer.toString('utf8') });
}

function looksLikeZip(buffer: Buffer): boolean {
  // ZIP local file header magic: 0x50 0x4B 0x03 0x04 ("PK\x03\x04")
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

/**
 * Import a parsed export for a user, upserting the account + ghost set and taking a snapshot.
 */
export async function importParsedExport(
  userId: string,
  rawHandle: string,
  parsed: ParsedExport,
): Promise<ImportSummary> {
  const { display: handle, id: instagramUserId } = normalizeHandle(rawHandle);
  if (!handle) throw new InvalidHandleError();

  const followingCount = parsed.following.length;
  const followersCount = parsed.followers.length;

  // Enforce the per-tier connected-account limit for brand-new accounts.
  const priorAccount = await prisma.instagramAccount.findUnique({
    where: { userId_instagramUserId: { userId, instagramUserId } },
    select: { id: true },
  });
  if (!priorAccount) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } });
    const limit = accountLimitForTier(user?.tier);
    const count = await prisma.instagramAccount.count({ where: { userId } });
    if (count >= limit) throw new AccountLimitReachedError(limit);
  }

  // Upsert the account (no session token — compliant build never stores one).
  const account = await prisma.instagramAccount.upsert({
    where: { userId_instagramUserId: { userId, instagramUserId } },
    create: {
      userId,
      instagramUserId,
      handle,
      followersCount,
      followingCount,
      lastScannedAt: new Date(),
    },
    update: { handle, followersCount, followingCount, lastScannedAt: new Date() },
    select: { id: true },
  });
  const accountId = account.id;

  const ghosts = computeGhosts(parsed);
  const now = new Date();

  // Which ghosts already existed (to report how many are new this import)?
  const existing = await prisma.ghost.findMany({
    where: { accountId },
    select: { instagramUserId: true },
  });
  const existingIds = new Set(existing.map((g) => g.instagramUserId));

  const tierBreakdown = { tier1: 0, tier2: 0, tier3: 0, tier4: 0, tier5: 0 };
  let newGhostCount = 0;
  const currentIds: string[] = [];
  const toCreate: Array<{ accountId: string; instagramUserId: string } & GhostScoreData> = [];
  const toUpdate: Array<{ ghostId: string; data: GhostScoreData }> = [];

  for (const ghost of ghosts) {
    const ghostId = ghost.username.toLowerCase();
    currentIds.push(ghostId);

    const scored = scoreGhost({
      likesGiven: ghost.likesGiven,
      commentsGiven: ghost.commentsGiven,
      lastEngagedAt: ghost.lastEngagedAt,
      isCloseFriend: ghost.isCloseFriend,
      followedAt: ghost.followedAt,
      engagementDataMissing: !parsed.engagementFilesPresent,
      now,
    });

    tierBreakdown[`tier${scored.tier}` as keyof typeof tierBreakdown]++;

    const data: GhostScoreData = {
      handle: ghost.username,
      profilePicUrl: profilePicFromHref(ghost.href),
      followedAt: ghost.followedAt,
      lastEngagedAt: ghost.lastEngagedAt,
      isCloseFriend: ghost.isCloseFriend,
      likesGiven: ghost.likesGiven,
      commentsGiven: ghost.commentsGiven,
      priorityScore: scored.priorityScore,
      tier: scored.tier,
      scoreEngagement: scored.scoreEngagement,
      scoreEngagementRecency: scored.scoreEngagementRecency,
      scoreCloseFriend: scored.scoreCloseFriend,
      scoreFollowRecency: scored.scoreFollowRecency,
      scoreReciprocity: scored.scoreReciprocity,
      engagementUnknown: scored.engagementUnknown,
    };

    if (existingIds.has(ghostId)) {
      toUpdate.push({ ghostId, data });
    } else {
      newGhostCount++;
      toCreate.push({ accountId, instagramUserId: ghostId, ...data });
    }
  }

  // Batch writes so a large following list does not fan out into thousands of
  // sequential round-trips (which would slow or time out the import request).
  const CHUNK = 500;
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    await prisma.ghost.createMany({ data: toCreate.slice(i, i + CHUNK), skipDuplicates: true });
  }
  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    // preserve removedAt on update (cleanup history)
    await prisma.$transaction(
      toUpdate.slice(i, i + CHUNK).map((u) =>
        prisma.ghost.update({
          where: { accountId_instagramUserId: { accountId, instagramUserId: u.ghostId } },
          data: u.data,
        }),
      ),
    );
  }

  // Accounts that were ghosts but now follow back are dropped from the active list
  // (user-marked history is kept). Compute the stale set in code and delete in chunks
  // to stay well under Postgres bind-parameter limits on large accounts.
  const currentIdSet = new Set(currentIds);
  const activeGhosts = await prisma.ghost.findMany({
    where: { accountId, removedAt: null },
    select: { instagramUserId: true },
  });
  const staleIds = activeGhosts
    .map((g) => g.instagramUserId)
    .filter((id) => !currentIdSet.has(id));
  for (let i = 0; i < staleIds.length; i += CHUNK) {
    await prisma.ghost.deleteMany({
      where: { accountId, instagramUserId: { in: staleIds.slice(i, i + CHUNK) } },
    });
  }

  await takeSnapshot(accountId).catch((err) => {
    logger.warn({ accountId, err: (err as Error).name }, 'Snapshot after import failed (non-fatal)');
  });

  logger.info(
    { userId, accountId, ghostCount: ghosts.length, newGhostCount },
    'Data export imported',
  );

  return {
    accountId,
    handle,
    followingCount,
    followersCount,
    ghostCount: ghosts.length,
    newGhostCount,
    engagementIncluded: parsed.engagementFilesPresent,
    followersLikelyIncomplete: detectTruncatedFollowers(parsed),
    tierBreakdown,
  };
}

/** Instagram profile-pic URLs aren't in the export; keep the profile href for linking out. */
function profilePicFromHref(_href: string | null): string | null {
  return null;
}

export type { GhostCandidate };
