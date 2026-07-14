/**
 * Background worker process.
 *
 * The compliant build has no Instagram automation, so there is no unfollow worker.
 * This process runs the legitimate scheduled jobs only:
 *   - daily account snapshots (follower/ratio history for Pro accounts)
 *   - the tier-downgrade disconnect grace-period sweep
 */

import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import { startSnapshotCron, stopSnapshotCron } from './snapshot.cron.js';
import { startDisconnectCron, stopDisconnectCron } from './disconnect.cron.js';

async function main(): Promise<void> {
  await startSnapshotCron();
  await startDisconnectCron();
  logger.info('Background worker process started (snapshots + disconnect crons)');
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Stopping background worker process');
  await stopSnapshotCron().catch(() => { /* ignore */ });
  await stopDisconnectCron().catch(() => { /* ignore */ });
  await redis.quit().catch(() => { /* ignore */ });
}

process.once('SIGINT', () => {
  shutdown('SIGINT').then(() => process.exit(0)).catch((err) => {
    logger.error({ err }, 'Worker shutdown failed');
    process.exit(1);
  });
});

process.once('SIGTERM', () => {
  shutdown('SIGTERM').then(() => process.exit(0)).catch((err) => {
    logger.error({ err }, 'Worker shutdown failed');
    process.exit(1);
  });
});

main().catch((err) => {
  logger.error({ err }, 'Worker process failed to start');
  process.exit(1);
});
