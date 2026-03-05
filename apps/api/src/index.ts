/**
 * Entry point — starts the Fastify server and background cron workers.
 * Separated from server.ts so that server.ts can be imported in tests
 * without triggering startup side effects.
 */
import { buildServer } from './server.js';
import { logger } from './lib/logger.js';
import { startSnapshotCron, stopSnapshotCron } from './workers/snapshot.cron.js';
import { startDisconnectCron, stopDisconnectCron } from './workers/disconnect.cron.js';
import { redis } from './lib/redis.js';

// Guard against unhandled promise rejections from BullMQ/ioredis when the
// Redis provider doesn't support BullMQ (e.g. Upstash free tier in dev).
// These are non-fatal — queue features degrade gracefully.
process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  if (
    msg.includes('Connection is closed') ||
    msg.includes('FUNCTION') ||
    msg.includes('ERR unknown command')
  ) {
    logger.warn({ reason: msg }, 'BullMQ/Redis rejection — queue features unavailable in this environment');
    return;
  }
  logger.error({ reason: msg }, 'Unhandled promise rejection');
});

const app = await buildServer();
const port = parseInt(process.env.PORT ?? '3001', 10);

// Start background cron workers only if Redis supports BullMQ.
// Upstash free tier does not support Redis Functions required by BullMQ 5.x.
let cronsStarted = false;
try {
  // Quick liveness check — if this fails, Redis is unreachable entirely
  await redis.ping();
  await startSnapshotCron();
  await startDisconnectCron();
  cronsStarted = true;
} catch (err) {
  logger.warn({ err }, 'Cron workers could not start — queue features unavailable');
}

// Graceful shutdown — stop crons before server closes
const shutdown = async () => {
  logger.info('Shutdown signal received');
  await app.close();
  if (cronsStarted) {
    await stopSnapshotCron();
    await stopDisconnectCron();
  }
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
