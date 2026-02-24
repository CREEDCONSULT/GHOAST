import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { logger } from './lib/logger.js';
import { redis } from './lib/redis.js';
import { prisma } from '@ghoast/db';

export async function buildServer() {
  const app = Fastify({
    loggerInstance: logger,
    disableRequestLogging: false,
    trustProxy: true,
  });

  // ── Security ───────────────────────────────────────────────────────────────
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // Configured separately if needed
  });

  await app.register(fastifyCors, {
    origin: process.env.APP_URL ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(fastifyCookie, {
    secret: process.env.JWT_SECRET ?? 'dev-secret',
  });

  // ── Rate limiting ──────────────────────────────────────────────────────────
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
    keyGenerator: (request) =>
      request.user?.id ?? request.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please slow down.',
    }),
  });

  // ── Routes ─────────────────────────────────────────────────────────────────
  // All routes versioned under /api/v1/ — required for mobile compatibility
  await app.register(async (v1) => {
    // Auth routes registered in Phase 1
    // Account routes registered in Phase 2
    // Scan routes registered in Phase 3
    // Queue routes registered in Phase 6
    // Billing routes registered in Phase 5
    v1.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  }, { prefix: '/api/v1' });

  // ── Shutdown ───────────────────────────────────────────────────────────────
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    await redis.quit();
    logger.info('Server shutdown complete');
  });

  return app;
}

// Start server if this is the entry point
const isDirect =
  process.argv[1] != null && new URL(import.meta.url).pathname.endsWith('server.ts');

if (isDirect) {
  const app = await buildServer();
  const port = parseInt(process.env.PORT ?? '3001', 10);

  try {
    await app.listen({ port, host: '0.0.0.0' });
    logger.info({ port }, 'API server started');
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}
