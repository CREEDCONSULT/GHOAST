/**
 * Ghost Scan Routes
 *
 * POST /api/v1/accounts/:id/scan
 *   — Kicks off an async scan. Returns 202 immediately.
 *   — 409 if scan already in progress.
 *
 * GET /api/v1/accounts/:id/scan/progress
 *   — Returns current scan progress from Redis.
 *
 * GET /api/v1/accounts/:id/scan/stream
 *   — Server-Sent Events endpoint. Streams progress until scan completes.
 *
 * All routes require authentication (requireAuth middleware).
 */

import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  startScan,
  getScanProgress,
  ScanNotFoundError,
  ScanAlreadyInProgressError,
  scanProgressKey,
} from '../services/scan.service.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

export async function scanRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /accounts/:id/scan ─────────────────────────────────────────────────

  app.post<{ Params: { id: string } }>(
    '/:id/scan',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id: accountId } = request.params;
      const userId = request.user!.id;

      try {
        await startScan(userId, accountId);
        return reply.status(202).send({ message: 'Scan started' });
      } catch (err) {
        if (err instanceof ScanNotFoundError) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
        if (err instanceof ScanAlreadyInProgressError) {
          return reply.status(409).send({ error: 'Conflict', message: 'Scan already in progress' });
        }
        logger.error({ accountId, userId, err }, 'Failed to start scan');
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  // ── GET /accounts/:id/scan/progress ────────────────────────────────────────

  app.get<{ Params: { id: string } }>(
    '/:id/scan/progress',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id: accountId } = request.params;
      const userId = request.user!.id;

      try {
        const progress = await getScanProgress(userId, accountId);
        if (!progress) {
          return reply.status(200).send({ status: 'not_started', followingScanned: 0, followersScanned: 0, ghostCount: 0 });
        }
        return reply.status(200).send(progress);
      } catch (err) {
        if (err instanceof ScanNotFoundError) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
        logger.error({ accountId, userId, err }, 'Failed to get scan progress');
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  // ── GET /accounts/:id/scan/stream (SSE) ─────────────────────────────────────

  app.get<{ Params: { id: string } }>(
    '/:id/scan/stream',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id: accountId } = request.params;
      const userId = request.user!.id;

      // Verify ownership first
      try {
        const progress = await getScanProgress(userId, accountId);
        // If getScanProgress doesn't throw, user owns the account

        // Set SSE headers
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.setHeader('X-Accel-Buffering', 'no');

        const sendEvent = (data: unknown): void => {
          reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        // Send current state immediately
        if (progress) sendEvent(progress);

        // Subscribe to Redis pub/sub for live updates
        const subscriber = redis.duplicate();
        const channel = `scan:events:${accountId}`;

        await subscriber.subscribe(channel);

        subscriber.on('message', (_ch: string, message: string) => {
          try {
            const event = JSON.parse(message) as { status: string };
            sendEvent(event);

            // Close stream when scan completes or errors
            if (event.status === 'complete' || event.status === 'error') {
              subscriber.unsubscribe(channel).catch(() => {/* ignore */});
              subscriber.quit().catch(() => {/* ignore */});
              reply.raw.end();
            }
          } catch {
            // ignore parse errors
          }
        });

        // Clean up on client disconnect
        request.raw.on('close', () => {
          subscriber.unsubscribe(channel).catch(() => {/* ignore */});
          subscriber.quit().catch(() => {/* ignore */});
        });

        // Heartbeat every 25s to prevent proxy timeouts
        const heartbeat = setInterval(() => {
          reply.raw.write(': keep-alive\n\n');
        }, 25_000);

        request.raw.on('close', () => clearInterval(heartbeat));

        // Hold the connection open — Fastify won't auto-close it
        await new Promise<void>((resolve) => {
          reply.raw.on('close', resolve);
          reply.raw.on('finish', resolve);
        });
      } catch (err) {
        if (err instanceof ScanNotFoundError) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
        logger.error({ accountId, userId, err }, 'SSE stream error');
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );
}

// Re-export for use in scan service tests
export { scanProgressKey };
