import { createUnfollowWorker } from './unfollow.worker.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import { areInstagramActionsConfigured } from '../config/action-policy.js';

const worker = createUnfollowWorker();

logger.info(
  { instagramActionsConfigured: areInstagramActionsConfigured() },
  'Unfollow worker process started',
);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Stopping unfollow worker process');
  await worker.close();
  await redis.quit();
}

process.once('SIGINT', () => {
  shutdown('SIGINT').then(() => process.exit(0)).catch((err) => {
    logger.error({ err }, 'Unfollow worker shutdown failed');
    process.exit(1);
  });
});

process.once('SIGTERM', () => {
  shutdown('SIGTERM').then(() => process.exit(0)).catch((err) => {
    logger.error({ err }, 'Unfollow worker shutdown failed');
    process.exit(1);
  });
});
