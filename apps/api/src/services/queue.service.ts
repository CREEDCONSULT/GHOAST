/**
 * Queue Service
 *
 * Manages the BullMQ unfollow queue:
 * - startQueue: validates ghosts, enqueues jobs, starts worker
 * - pauseQueue: pauses the BullMQ queue for this account
 * - cancelQueue: removes all waiting jobs, marks session cancelled
 *
 * SECURITY:
 * - Tier 5 ghosts are hard-rejected at this layer (also rejected in the worker)
 * - Ghost ownership verified before enqueuing
 * - Daily cap checked against current count + requested count
 */

import { Queue, Worker } from 'bullmq';
import { prisma } from '@ghoast/db';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { QUEUE_CONFIG } from '../config/queue.js';
import { consumeCredit, getBalance, InsufficientCreditsError } from './billing.service.js';
import type { UnfollowJobData } from '../workers/unfollow.worker.js';

// ── Error types ───────────────────────────────────────────────────────────────

export class QueueAccountNotFoundError extends Error {
  constructor() {
    super('Account not found or does not belong to you.');
    this.name = 'QueueAccountNotFoundError';
  }
}

export class QueueTier5RejectedError extends Error {
  constructor() {
    super('One or more selected ghosts are Tier 5 (auto-protected). Remove them and try again.');
    this.name = 'QueueTier5RejectedError';
  }
}

export class QueueDailyCapExceededError extends Error {
  constructor() {
    super('The number of ghosts selected exceeds your remaining daily cap.');
    this.name = 'QueueDailyCapExceededError';
  }
}

export class QueueAccessDeniedError extends Error {
  constructor() {
    super('A Pro subscription or credit balance is required to use the bulk queue.');
    this.name = 'QueueAccessDeniedError';
  }
}

export class QueueNotFoundError extends Error {
  constructor() {
    super('No active queue session for this account.');
    this.name = 'QueueNotFoundError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StartQueueResult {
  sessionId: string;
  jobCount: number;
  estimatedCompletionMinutes: number;
}

// ── BullMQ queue instance (shared) ────────────────────────────────────────────

let _unfollowQueue: Queue<UnfollowJobData> | null = null;

export function getUnfollowQueue(): Queue<UnfollowJobData> {
  if (!_unfollowQueue) {
    _unfollowQueue = new Queue<UnfollowJobData>(QUEUE_CONFIG.QUEUE_NAME_UNFOLLOW, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return _unfollowQueue;
}

// Track active workers per account (in-process; reset on server restart)
const activeWorkers = new Map<string, Worker<UnfollowJobData>>();

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Validates and enqueues unfollow jobs for the given ghosts.
 * Requires: Pro tier OR credit balance > 0
 * Rejects: Tier 5 ghosts, daily cap exceeded, non-owned ghosts
 */
export async function startQueue(
  userId: string,
  accountId: string,
  ghostIds: string[],
): Promise<StartQueueResult> {
  // 1. Verify account ownership
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });
  if (!account) throw new QueueAccountNotFoundError();

  // 2. Verify Pro tier or credit balance
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true, creditBalance: true },
  });
  if (!user) throw new QueueAccountNotFoundError();

  const hasPro = user.tier === 'PRO' || user.tier === 'PRO_PLUS';
  const hasCredits = user.creditBalance > 0;
  if (!hasPro && !hasCredits) throw new QueueAccessDeniedError();

  // 3. Validate ghosts exist, belong to account, and check Tier 5
  const ghosts = await prisma.ghost.findMany({
    where: { id: { in: ghostIds }, accountId, removedAt: null },
    select: { id: true, tier: true },
  });

  const foundIds = new Set(ghosts.map((g) => g.id));
  const missingIds = ghostIds.filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    throw new QueueAccountNotFoundError();
  }

  const tier5Ghosts = ghosts.filter((g) => g.tier === 5);
  if (tier5Ghosts.length > 0) throw new QueueTier5RejectedError();

  // 4. Daily cap check
  const dailyCap = hasPro ? QUEUE_CONFIG.DAILY_CAP_PRO : user.creditBalance;
  const capKey = `daily_unfollow:${accountId}:${new Date().toISOString().slice(0, 10)}`;
  const currentCount = parseInt((await redis.get(capKey)) ?? '0', 10);
  const remaining = dailyCap - currentCount;

  if (ghostIds.length > remaining) throw new QueueDailyCapExceededError();

  // 5. Create queue_session record
  const today = new Date().toISOString().slice(0, 10);
  const session = await prisma.queueSession.upsert({
    where: { accountId_date: { accountId, date: today } },
    create: { accountId, date: today },
    update: {},
  });

  // 6. Enqueue jobs
  const queue = getUnfollowQueue();
  const jobs = ghostIds.map((ghostId, index) => ({
    name: 'unfollow',
    data: {
      accountId,
      ghostId,
      userId,
      consumeCredit: !hasPro && hasCredits,
    } satisfies UnfollowJobData,
    opts: {
      jobId: `${accountId}:${ghostId}`,
      // Stagger initial jobs to avoid burst detection
      delay: index > 0 ? QUEUE_CONFIG.UNFOLLOW_DELAY_MIN_MS * index : 0,
    },
  }));

  await queue.addBulk(jobs);

  // 7. Start worker for this account if not already running
  if (!activeWorkers.has(accountId)) {
    // Dynamically import to avoid circular dependency
    const { createUnfollowWorker } = await import('../workers/unfollow.worker.js');
    const worker = createUnfollowWorker();
    activeWorkers.set(accountId, worker);
    logger.info({ accountId, jobCount: ghostIds.length }, 'Unfollow worker started');
  }

  // Estimate completion: avg delay per job
  const avgDelayMs =
    (QUEUE_CONFIG.UNFOLLOW_DELAY_MIN_MS + QUEUE_CONFIG.UNFOLLOW_DELAY_MAX_MS) / 2;
  const estimatedMs = ghostIds.length * avgDelayMs;
  const estimatedCompletionMinutes = Math.ceil(estimatedMs / 60_000);

  logger.info({ accountId, userId, jobCount: ghostIds.length }, 'Queue started');

  return {
    sessionId: session.id,
    jobCount: ghostIds.length,
    estimatedCompletionMinutes,
  };
}

/**
 * Pauses the BullMQ queue for the given account.
 */
export async function pauseQueue(userId: string, accountId: string): Promise<void> {
  await verifyAccountOwnership(userId, accountId);
  const queue = getUnfollowQueue();
  await queue.pause();
  await publishEvent(accountId, { type: 'queue_paused', reason: 'user_requested' });
  logger.info({ accountId, userId }, 'Queue paused by user');
}

/**
 * Cancels all waiting jobs for the given account and marks the queue session cancelled.
 */
export async function cancelQueue(userId: string, accountId: string): Promise<void> {
  await verifyAccountOwnership(userId, accountId);

  // Remove all waiting jobs for this account
  const queue = getUnfollowQueue();
  const waitingJobs = await queue.getJobs(['waiting', 'delayed']);
  const accountJobs = waitingJobs.filter((j) => j.data.accountId === accountId);

  await Promise.all(accountJobs.map((j) => j.remove()));

  // Stop the worker for this account
  const worker = activeWorkers.get(accountId);
  if (worker) {
    await worker.close();
    activeWorkers.delete(accountId);
  }

  // Mark queue session as cancelled
  const today = new Date().toISOString().slice(0, 10);
  await prisma.queueSession.updateMany({
    where: { accountId, date: today, completedAt: null },
    data: { completedAt: new Date() },
  });

  await publishEvent(accountId, { type: 'queue_cancelled' });
  logger.info({ accountId, userId, removedJobs: accountJobs.length }, 'Queue cancelled');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function verifyAccountOwnership(userId: string, accountId: string): Promise<void> {
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });
  if (!account) throw new QueueAccountNotFoundError();
}

async function publishEvent(accountId: string, event: Record<string, unknown>): Promise<void> {
  await redis.publish(`queue:events:${accountId}`, JSON.stringify(event)).catch(() => {/* ignore */});
}

// Re-export for use in tests
export { InsufficientCreditsError };
