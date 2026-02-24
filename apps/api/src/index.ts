/**
 * Entry point — starts the Fastify server.
 * Separated from server.ts so that server.ts can be imported in tests
 * without triggering startup side effects.
 */
import { buildServer } from './server.js';
import { logger } from './lib/logger.js';

const app = await buildServer();
const port = parseInt(process.env.PORT ?? '3001', 10);

try {
  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, 'API server started');
} catch (err) {
  logger.error(err, 'Failed to start server');
  process.exit(1);
}
