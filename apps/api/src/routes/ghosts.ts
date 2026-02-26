/**
 * Ghost List Routes
 *
 * GET  /api/v1/accounts/:id/ghosts
 *   — Paginated ghost list with tier filter, search, sort.
 *
 * POST /api/v1/accounts/:id/ghosts/:ghostId/unfollow
 *   — Manual unfollow with daily cap enforcement.
 *
 * GET  /api/v1/accounts/:id/stats
 *   — Account stats + tier breakdown.
 *
 * All routes require authentication (requireAuth middleware).
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  listGhosts,
  unfollowGhost,
  getAccountStats,
  getDailyUnfollowCount,
  GhostAccountNotFoundError,
  GhostNotFoundError,
  GhostAlreadyRemovedError,
  Tier5ProtectedError,
  DailyCapReachedError,
  SessionExpiredError,
  InstagramRateLimitError,
} from '../services/ghosts.service.js';
import { logger } from '../lib/logger.js';

// ── Validation schemas ─────────────────────────────────────────────────────────

const listGhostsQuery = z.object({
  tier: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .refine((v) => v === undefined || (v >= 1 && v <= 5), { message: 'tier must be 1–5' }),
  sort: z.enum(['score', 'followers', 'last_post']).optional(),
  search: z.string().max(100).optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? Math.max(1, parseInt(v, 10)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? parseInt(v, 10) : 50;
      return Math.min(100, Math.max(1, n));
    }),
});

// ── Routes ────────────────────────────────────────────────────────────────────

export async function ghostRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /accounts/:id/ghosts ──────────────────────────────────────────────

  app.get<{ Params: { id: string }; Querystring: Record<string, string> }>(
    '/:id/ghosts',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id: accountId } = request.params;
      const userId = request.user!.id;

      const parsed = listGhostsQuery.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Bad Request', details: parsed.error.flatten() });
      }

      try {
        const result = await listGhosts(userId, accountId, parsed.data);
        const dailyCount = await getDailyUnfollowCount(accountId);
        return reply.status(200).send({
          ...result,
          dailyUnfollowCount: dailyCount,
          dailyUnfollowCap: 10,
        });
      } catch (err) {
        if (err instanceof GhostAccountNotFoundError) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
        logger.error({ accountId, userId, err }, 'Failed to list ghosts');
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  // ── POST /accounts/:id/ghosts/:ghostId/unfollow ────────────────────────────

  app.post<{ Params: { id: string; ghostId: string } }>(
    '/:id/ghosts/:ghostId/unfollow',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id: accountId, ghostId } = request.params;
      const userId = request.user!.id;

      try {
        await unfollowGhost(userId, accountId, ghostId);
        return reply.status(200).send({ success: true });
      } catch (err) {
        if (err instanceof GhostAccountNotFoundError) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
        if (err instanceof GhostNotFoundError) {
          return reply.status(404).send({ error: 'Not Found', message: err.message });
        }
        if (err instanceof GhostAlreadyRemovedError) {
          return reply.status(409).send({ error: 'Conflict', message: err.message });
        }
        if (err instanceof Tier5ProtectedError) {
          return reply.status(403).send({ error: 'Forbidden', code: 'TIER5_PROTECTED', message: err.message });
        }
        if (err instanceof DailyCapReachedError) {
          return reply.status(429).send({
            error: 'Too Many Requests',
            code: 'daily_limit_reached',
            message: err.message,
            upgrade_url: '/pricing',
          });
        }
        if (err instanceof SessionExpiredError) {
          return reply.status(401).send({ error: 'Unauthorized', code: 'SESSION_EXPIRED', message: err.message });
        }
        if (err instanceof InstagramRateLimitError) {
          return reply.status(429).send({ error: 'Too Many Requests', code: 'INSTAGRAM_RATE_LIMIT', message: err.message });
        }
        logger.error({ accountId, ghostId, userId, err }, 'Failed to unfollow ghost');
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  // ── GET /accounts/:id/stats ───────────────────────────────────────────────

  app.get<{ Params: { id: string } }>(
    '/:id/stats',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id: accountId } = request.params;
      const userId = request.user!.id;

      try {
        const stats = await getAccountStats(userId, accountId);
        return reply.status(200).send(stats);
      } catch (err) {
        if (err instanceof GhostAccountNotFoundError) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
        logger.error({ accountId, userId, err }, 'Failed to get account stats');
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );
}
