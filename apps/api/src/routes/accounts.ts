/**
 * Account Routes — /api/v1/accounts
 *
 * POST   /api/v1/accounts/connect     Connect an Instagram account
 * GET    /api/v1/accounts             List connected accounts
 * DELETE /api/v1/accounts/:id         Disconnect an account
 *
 * All routes require authentication (Bearer JWT).
 * Session token fields are NEVER returned in any response.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  connectAccount,
  disconnectAccount,
  listAccounts,
  AccountNotFoundError,
  AccountAlreadyConnectedError,
  AccountLimitReachedError,
} from '../services/accounts.service.js';
import { SessionExpiredError, InstagramRateLimitError } from '../lib/instagram.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { logger } from '../lib/logger.js';

// ── Validation ────────────────────────────────────────────────────────────────

const connectSchema = z.object({
  // Instagram sessionid cookies are typically 40+ alphanumeric chars
  sessionToken: z
    .string()
    .min(20, 'Session token is too short')
    .max(512, 'Session token is too long')
    .regex(/^[\w%.-]+$/, 'Session token contains invalid characters'),
});

// ── Routes ────────────────────────────────────────────────────────────────────

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /connect ──────────────────────────────────────────────────────────
  app.post(
    '/connect',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parse = connectSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parse.error.issues[0]?.message ?? 'Invalid session token',
        });
      }

      const { sessionToken } = parse.data;
      const userId = request.user!.id;

      try {
        const account = await connectAccount(userId, sessionToken);
        return reply.status(201).send({ account });
      } catch (err) {
        if (err instanceof SessionExpiredError) {
          return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: err.message,
            code: 'SESSION_EXPIRED',
          });
        }

        if (err instanceof InstagramRateLimitError) {
          return reply.status(429).send({
            statusCode: 429,
            error: 'Too Many Requests',
            message: err.message,
            code: 'INSTAGRAM_RATE_LIMIT',
          });
        }

        if (err instanceof AccountAlreadyConnectedError) {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: err.message,
          });
        }

        if (err instanceof AccountLimitReachedError) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: err.message,
            limit: err.limit,
            upgrade_required: true,
            upgrade_url: '/pricing',
          });
        }

        logger.error({ err, userId }, 'Account connect error');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to connect Instagram account. Please try again.',
        });
      }
    },
  );

  // ── GET / ──────────────────────────────────────────────────────────────────
  app.get(
    '/',
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.user!.id;

      try {
        const accounts = await listAccounts(userId);
        return reply.send({ accounts });
      } catch (err) {
        logger.error({ err, userId }, 'Account list error');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to retrieve accounts. Please try again.',
        });
      }
    },
  );

  // ── DELETE /:id ────────────────────────────────────────────────────────────
  app.delete(
    '/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.user!.id;

      try {
        await disconnectAccount(userId, id);
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof AccountNotFoundError) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: err.message,
          });
        }

        logger.error({ err, userId, accountId: id }, 'Account disconnect error');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to disconnect account. Please try again.',
        });
      }
    },
  );
}
