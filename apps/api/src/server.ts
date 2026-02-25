import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { logger } from './lib/logger.js';
import { redis } from './lib/redis.js';
import { prisma } from '@ghoast/db';
import { authRoutes } from './routes/auth.js';
import { accountRoutes } from './routes/accounts.js';

export async function buildServer() {
  const app = Fastify({
    logger,
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
    await v1.register(authRoutes, { prefix: '/auth' });
    await v1.register(accountRoutes, { prefix: '/accounts' });
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
