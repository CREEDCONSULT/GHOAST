/**
 * Snapshot Cron Worker
 *
 * Schedules and executes a daily BullMQ repeatable job at 00:00 UTC.
 * For every Pro and Pro+ Instagram account, takes an AccountSnapshot record.
 *
 * Initialise by calling startSnapshotCron() once on server startup.
 * The repeatable job is idempotent — calling this multiple times is safe.
 */

import { Queue, Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { runDailySnapshots } from '../services/snapshot.service.js';
import { QUEUE_CONFIG } from '../config/queue.js';

let _snapshotQueue: Queue | null = null;
let _snapshotWorker: Worker | null = null;

function getSnapshotQueue(): Queue {
  if (!_snapshotQueue) {
    _snapshotQueue = new Queue(QUEUE_CONFIG.QUEUE_NAME_SNAPSHOT, {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 10 },
      },
    });
  }
  return _snapshotQueue;
}

/**
 * Starts the snapshot cron worker and schedules the daily snapshot job at 00:00 UTC.
 * Safe to call on server restart — BullMQ deduplicates repeatable jobs.
 */
export async function startSnapshotCron(): Promise<void> {
  const queue = getSnapshotQueue();

  // Schedule daily job — runs at midnight UTC every day
  // BullMQ deduplicates this by the repeatable job key (pattern + name)
  await queue.add(
    'daily-snapshot',
    {},
    {
      repeat: { pattern: '0 0 * * *' },
    },
  );

  _snapshotWorker = new Worker(
    QUEUE_CONFIG.QUEUE_NAME_SNAPSHOT,
    async () => {
      logger.info('Daily snapshot cron triggered');
      const result = await runDailySnapshots();
      logger.info(result, 'Daily snapshot cron complete');
    },
    {
      connection: redis,
      concurrency: 1,
    },
  );

  _snapshotWorker.on('error', (err) => {
    logger.error({ err }, 'Snapshot cron worker error');
  });

  _snapshotWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Snapshot cron job failed');
  });

  logger.info('Snapshot cron started — daily job scheduled at 00:00 UTC');
}

/**
 * Shuts down the snapshot cron worker gracefully.
 * Called on server close.
 */
export async function stopSnapshotCron(): Promise<void> {
  if (_snapshotWorker) {
    await _snapshotWorker.close();
    _snapshotWorker = null;
  }
  if (_snapshotQueue) {
    await _snapshotQueue.close();
    _snapshotQueue = null;
  }
}
