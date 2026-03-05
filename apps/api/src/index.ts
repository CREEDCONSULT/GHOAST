/**
 * Entry point — starts the Fastify server and background cron workers.
 * Separated from server.ts so that server.ts can be imported in tests
 * without triggering startup side effects.
 */
import { buildServer } from './server.js';
import { logger } from './lib/logger.js';
import { startSnapshotCron, stopSnapshotCron } from './workers/snapshot.cron.js';
import { startDisconnectCron, stopDisconnectCron } from './workers/disconnect.cron.js';

const app = await buildServer();
const port = parseInt(process.env.PORT ?? '3001', 10);

// Start background cron workers (after server is built, before listening)
// Non-fatal: BullMQ requires Redis Functions (FUNCTION LOAD) which may not be
// supported by the Redis provider in dev. Crons failing here does not affect
// auth, ghost listing, or manual unfollow.
try {
  await startSnapshotCron();
  await startDisconnectCron();
} catch (err) {
  logger.warn({ err }, 'Cron workers could not start — queue features unavailable');
}

// Graceful shutdown — stop crons before server closes
const shutdown = async () => {
  logger.info('Shutdown signal received');
  await app.close();
  await stopSnapshotCron();
  await stopDisconnectCron();
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

try {
  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, 'API server started');
} catch (err) {
  logger.error(err, 'Failed to start server');
  process.exit(1);
}
