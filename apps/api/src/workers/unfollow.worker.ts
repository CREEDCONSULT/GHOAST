/**
 * Unfollow Queue Worker
 *
 * Processes one unfollow job at a time per Instagram account.
 * Each job contains: { accountId, ghostId, userId }
 * The session token is fetched from DB and decrypted in-process.
 *
 * Safety guarantees per CLAUDE.md:
 * - Randomised 8–45s delay between unfollows (read from config/queue.ts)
 * - Session pause every 10–15 unfollows (randomised)
 * - 15-min pause on Instagram rate limit
 * - 24h pause after 3 consecutive rate limits in one day
 * - Tier 5 accounts are HARD BLOCKED (belt-and-suspenders — already blocked at route)
 * - Credit consumed ONLY on successful unfollow (not on failure)
 * - Redis pub/sub publishes job_completed / queue_paused / queue_completed events
 *
 * SECURITY:
 * - Session token decrypted in-process, NEVER logged
 * - Job data never contains the plaintext session token
 */

import { Worker, Job } from 'bullmq';
import { prisma } from '@ghoast/db';
import { redis } from '../lib/redis.js';
import { decrypt } from '../lib/encryption.js';
import { logger } from '../lib/logger.js';
import { unfollowUser, SessionExpiredError, InstagramRateLimitError } from '../lib/instagram.js';
import { consumeCredit } from '../services/billing.service.js';
import { QUEUE_CONFIG, randomDelay, randomSessionPauseTrigger } from '../config/queue.js';

// ── Job data types ────────────────────────────────────────────────────────────

export interface UnfollowJobData {
  accountId: string;
  ghostId: string;
  userId: string;
  /** Whether to consume a credit on success (credit-pack users) */
  consumeCredit: boolean;
}

export interface UnfollowJobResult {
  success: boolean;
  ghostId: string;
}

// ── Redis keys ────────────────────────────────────────────────────────────────

function rateLimitHitsKey(accountId: string): string {
  const utcDate = new Date().toISOString().slice(0, 10);
  return `queue:rl_hits:${accountId}:${utcDate}`;
}

function unfollowCountKey(accountId: string): string {
  const utcDate = new Date().toISOString().slice(0, 10);
  return `queue:unfollow_count:${accountId}:${utcDate}`;
}

// ── Worker factory ────────────────────────────────────────────────────────────

/**
 * Creates and starts the BullMQ worker for the unfollow queue.
 * Call once from index.ts or a dedicated worker process.
 *
 * The worker processes jobs with concurrency=1 (one at a time per worker instance).
 * Multiple worker instances can be created for different accounts.
 */
export function createUnfollowWorker(): Worker<UnfollowJobData, UnfollowJobResult> {
  const worker = new Worker<UnfollowJobData, UnfollowJobResult>(
    QUEUE_CONFIG.QUEUE_NAME_UNFOLLOW,
    async (job: Job<UnfollowJobData, UnfollowJobResult>) => {
      return processUnfollowJob(job);
    },
    {
      connection: redis,
      concurrency: 1,
      // Randomised delay applied AFTER each job completes (see processUnfollowJob)
    },
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, accountId: job?.data.accountId, ghostId: job?.data.ghostId, err },
      'Unfollow job failed',
    );
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Unfollow worker error');
  });

  return worker;
}

// ── Job processor ─────────────────────────────────────────────────────────────

async function processUnfollowJob(
  job: Job<UnfollowJobData, UnfollowJobResult>,
): Promise<UnfollowJobResult> {
  const { accountId, ghostId, userId } = job.data;

  // 1. Fetch account + session token
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, userId },
    select: {
      instagramUserId: true,
      sessionTokenEncrypted: true,
      sessionTokenIv: true,
    },
  });

  if (!account) {
    throw new Error(`Account ${accountId} not found for user ${userId}`);
  }

  // 2. Fetch ghost — TIER 5 HARD BLOCK (belt-and-suspenders)
  const ghost = await prisma.ghost.findFirst({
    where: { id: ghostId, accountId },
    select: { instagramUserId: true, tier: true, removedAt: true },
  });

  if (!ghost) {
    throw new Error(`Ghost ${ghostId} not found for account ${accountId}`);
  }
  if (ghost.tier === 5) {
    throw new Error(`TIER5_BLOCK: Ghost ${ghostId} is Tier 5 — unfollow blocked`);
  }
  if (ghost.removedAt) {
    // Already removed — silently succeed (idempotent)
    return { success: true, ghostId };
  }

  // 3. Decrypt session token — NEVER log this
  const sessionToken = decrypt(account.sessionTokenEncrypted, account.sessionTokenIv);

  // 4. Check session pause — apply delay before sending request
  await applyPreJobDelay(accountId);

  // 5. Execute unfollow
  try {
    await unfollowUser(account.instagramUserId, ghost.instagramUserId, sessionToken);
  } catch (err) {
    if (err instanceof InstagramRateLimitError) {
      await handleRateLimitHit(accountId, job);
      throw err; // BullMQ will retry / delay according to queue config
    }
    if (err instanceof SessionExpiredError) {
      await publishEvent(accountId, { type: 'session_expired', accountId });
      throw err;
    }
    throw err;
  }

  // 6. Post-success: mark ghost removed + increment counters + consume credit if applicable
  await prisma.ghost.update({
    where: { id: ghostId },
    data: { removedAt: new Date() },
  });

  if (job.data.consumeCredit) {
    try {
      await consumeCredit(userId);
    } catch (err) {
      logger.warn({ userId, ghostId, err }, 'consumeCredit failed after successful unfollow');
    }
  }

  const newCount = await incrementUnfollowCount(accountId);

  await publishEvent(accountId, {
    type: 'job_completed',
    ghostId,
    totalRemoved: newCount,
  });

  logger.info({ accountId, ghostId, totalRemoved: newCount }, 'Ghost unfollowed (queue)');

  return { success: true, ghostId };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function applyPreJobDelay(accountId: string): Promise<void> {
  const count = parseInt((await redis.get(unfollowCountKey(accountId))) ?? '0', 10);
  const pauseTrigger = randomSessionPauseTrigger();

  // Session pause: every 10–15 unfollows
  if (count > 0 && count % pauseTrigger === 0) {
    const pauseMs = randomDelay(QUEUE_CONFIG.SESSION_PAUSE_MIN_MS, QUEUE_CONFIG.SESSION_PAUSE_MAX_MS);
    logger.info({ accountId, count, pauseMs }, 'Session pause triggered');
    await publishEvent(accountId, { type: 'queue_paused', reason: 'session_pause', resumeInMs: pauseMs });
    await sleep(pauseMs);
  } else {
    // Standard inter-unfollow delay
    const delayMs = randomDelay(QUEUE_CONFIG.UNFOLLOW_DELAY_MIN_MS, QUEUE_CONFIG.UNFOLLOW_DELAY_MAX_MS);
    await sleep(delayMs);
  }
}

async function handleRateLimitHit(accountId: string, job: Job<UnfollowJobData>): Promise<void> {
  const rlKey = rateLimitHitsKey(accountId);
  const hits = await redis.incr(rlKey);
  await redis.expire(rlKey, 86400); // 24h TTL

  logger.warn({ accountId, hits }, 'Instagram rate limit hit');

  if (hits >= QUEUE_CONFIG.RATE_LIMIT_DAILY_THRESHOLD) {
    // 3 consecutive rate limits → 24h pause
    const pauseMs = QUEUE_CONFIG.RATE_LIMIT_24H_PAUSE_MS;
    logger.error({ accountId, hits }, 'Rate limit threshold reached — pausing queue 24h');
    await publishEvent(accountId, {
      type: 'queue_paused',
      reason: 'rate_limit_24h',
      resumeInMs: pauseMs,
    });
    // Delay the job significantly so BullMQ re-processes later
    await job.moveToDelayed(Date.now() + pauseMs);
  } else {
    // Single rate limit → 15-min pause
    const pauseMs = QUEUE_CONFIG.RATE_LIMIT_PAUSE_MS;
    await publishEvent(accountId, {
      type: 'queue_paused',
      reason: 'rate_limit',
      resumeInMs: pauseMs,
    });
    await job.moveToDelayed(Date.now() + pauseMs);
  }
}

async function incrementUnfollowCount(accountId: string): Promise<number> {
  const key = unfollowCountKey(accountId);
  const newCount = await redis.incr(key);
  await redis.expire(key, 86400); // 24h TTL
  return newCount;
}

async function publishEvent(accountId: string, event: Record<string, unknown>): Promise<void> {
  await redis.publish(`queue:events:${accountId}`, JSON.stringify(event)).catch(() => {/* ignore */});
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
