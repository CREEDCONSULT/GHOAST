/**
 * Disconnect Cron Worker
 *
 * Schedules and executes a daily BullMQ repeatable job at 01:00 UTC.
 * Permanently deletes any Instagram accounts whose 7-day grace period
 * after a tier downgrade has expired (pendingDisconnect=true, disconnectAt <= now).
 *
 * Initialise by calling startDisconnectCron() once on server startup.
 * The repeatable job is idempotent — calling this multiple times is safe.
 */

import { Queue, Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { disconnectExpiredAccounts } from '../services/accounts.service.js';
import { QUEUE_CONFIG } from '../config/queue.js';

let _disconnectQueue: Queue | null = null;
let _disconnectWorker: Worker | null = null;

function getDisconnectQueue(): Queue {
  if (!_disconnectQueue) {
    _disconnectQueue = new Queue(QUEUE_CONFIG.QUEUE_NAME_DISCONNECT, {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 10 },
      },
    });
  }
  return _disconnectQueue;
}

/**
 * Starts the disconnect cron worker and schedules the daily job at 01:00 UTC.
 * Safe to call on server restart — BullMQ deduplicates repeatable jobs.
 */
export async function startDisconnectCron(): Promise<void> {
  const queue = getDisconnectQueue();

  // Schedule daily job — runs at 01:00 UTC (1 hour after snapshot cron)
  await queue.add(
    'daily-disconnect',
    {},
    {
      repeat: { pattern: '0 1 * * *' },
    },
  );

  _disconnectWorker = new Worker(
    QUEUE_CONFIG.QUEUE_NAME_DISCONNECT,
    async () => {
      logger.info('Daily disconnect cron triggered');
      const result = await disconnectExpiredAccounts();
      logger.info(result, 'Daily disconnect cron complete');
    },
    {
      connection: redis,
      concurrency: 1,
    },
  );

  _disconnectWorker.on('error', (err) => {
    logger.error({ err }, 'Disconnect cron worker error');
  });

  _disconnectWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Disconnect cron job failed');
  });

  logger.info('Disconnect cron started — daily job scheduled at 01:00 UTC');
}

/**
 * Shuts down the disconnect cron worker gracefully.
 * Called on server close.
 */
export async function stopDisconnectCron(): Promise<void> {
  if (_disconnectWorker) {
    await _disconnectWorker.close();
    _disconnectWorker = null;
  }
  if (_disconnectQueue) {
    await _disconnectQueue.close();
    _disconnectQueue = null;
  }
}
