/**
 * Queue Routes
 *
 * POST /api/v1/queue/start        — Start bulk unfollow queue (Pro or credit-pack)
 * POST /api/v1/queue/pause        — Pause the active queue for an account
 * POST /api/v1/queue/cancel       — Cancel all waiting jobs for an account
 * GET  /api/v1/queue/status/:id   — SSE stream of queue events for an account
 *
 * All routes require authentication (requireAuth middleware).
 * /start also requires Pro tier or credit balance > 0.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  startQueue,
  pauseQueue,
  cancelQueue,
  QueueAccountNotFoundError,
  QueueTier5RejectedError,
  QueueDailyCapExceededError,
  QueueAccessDeniedError,
} from '../services/queue.service.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

// ── Validation schemas ─────────────────────────────────────────────────────────

const startBody = z.object({
  accountId: z.string().min(1),
  ghostIds: z.array(z.string().min(1)).min(1).max(150),
});

const accountBody = z.object({
  accountId: z.string().min(1),
});

// ── Routes ────────────────────────────────────────────────────────────────────

export async function queueRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /queue/start ──────────────────────────────────────────────────────

  app.post<{ Body: z.infer<typeof startBody> }>(
    '/start',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = startBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Bad Request', details: parsed.error.flatten() });
      }

      const { accountId, ghostIds } = parsed.data;
      const userId = request.user!.id;

      try {
        const result = await startQueue(userId, accountId, ghostIds);
        return reply.status(202).send(result);
      } catch (err) {
        if (err instanceof QueueAccountNotFoundError) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
        if (err instanceof QueueTier5RejectedError) {
          return reply.status(400).send({ error: 'Bad Request', code: 'TIER5_REJECTED', message: err.message });
        }
        if (err instanceof QueueDailyCapExceededError) {
          return reply.status(429).send({ error: 'Too Many Requests', code: 'DAILY_CAP_EXCEEDED', message: err.message });
        }
        if (err instanceof QueueAccessDeniedError) {
          return reply.status(403).send({ error: 'Forbidden', code: 'UPGRADE_REQUIRED', upgrade_url: '/pricing', message: err.message });
        }
        logger.error({ accountId, userId, err }, 'Failed to start queue');
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  // ── POST /queue/pause ──────────────────────────────────────────────────────

  app.post<{ Body: z.infer<typeof accountBody> }>(
    '/pause',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = accountBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Bad Request', details: parsed.error.flatten() });
      }

      try {
        await pauseQueue(request.user!.id, parsed.data.accountId);
        return reply.status(200).send({ success: true });
      } catch (err) {
        if (err instanceof QueueAccountNotFoundError) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
        logger.error({ accountId: parsed.data.accountId, err }, 'Failed to pause queue');
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  // ── POST /queue/cancel ─────────────────────────────────────────────────────

  app.post<{ Body: z.infer<typeof accountBody> }>(
    '/cancel',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = accountBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Bad Request', details: parsed.error.flatten() });
      }

      try {
        await cancelQueue(request.user!.id, parsed.data.accountId);
        return reply.status(200).send({ success: true });
      } catch (err) {
        if (err instanceof QueueAccountNotFoundError) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
        logger.error({ accountId: parsed.data.accountId, err }, 'Failed to cancel queue');
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  // ── GET /queue/status/:accountId (SSE) ─────────────────────────────────────

  app.get<{ Params: { accountId: string } }>(
    '/status/:accountId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { accountId } = request.params;
      const userId = request.user!.id;

      // Verify ownership
      const { prisma } = await import('@ghoast/db');
      const account = await prisma.instagramAccount.findFirst({
        where: { id: accountId, userId },
        select: { id: true },
      });
      if (!account) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      // Set SSE headers
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');

      const sendEvent = (data: unknown): void => {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Subscribe to Redis pub/sub for this account's queue events
      const subscriber = redis.duplicate();
      const channel = `queue:events:${accountId}`;

      await subscriber.subscribe(channel);

      subscriber.on('message', (_ch: string, message: string) => {
        try {
          const event = JSON.parse(message) as { type: string };
          sendEvent(event);

          if (event.type === 'queue_completed' || event.type === 'queue_cancelled') {
            subscriber.unsubscribe(channel).catch(() => {/* ignore */});
            subscriber.quit().catch(() => {/* ignore */});
            reply.raw.end();
          }
        } catch {
          // ignore parse errors
        }
      });

      request.raw.on('close', () => {
        subscriber.unsubscribe(channel).catch(() => {/* ignore */});
        subscriber.quit().catch(() => {/* ignore */});
      });

      // Heartbeat every 25s
      const heartbeat = setInterval(() => {
        reply.raw.write(': keep-alive\n\n');
      }, 25_000);

      request.raw.on('close', () => clearInterval(heartbeat));

      await new Promise<void>((resolve) => {
        reply.raw.on('close', resolve);
        reply.raw.on('finish', resolve);
      });
    },
  );
}
