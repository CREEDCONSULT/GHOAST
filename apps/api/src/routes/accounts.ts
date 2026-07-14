/**
 * Account Routes — /api/v1/accounts
 *
 * GET    /api/v1/accounts             List connected accounts
 * DELETE /api/v1/accounts/:id         Disconnect an account
 *
 * Accounts are created/updated by the data-export import flow (see routes/import.ts).
 * All routes require authentication (Bearer JWT).
 */

import type { FastifyInstance } from 'fastify';
import {
  disconnectAccount,
  listAccounts,
  AccountNotFoundError,
} from '../services/accounts.service.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { logger } from '../lib/logger.js';

// ── Routes ────────────────────────────────────────────────────────────────────

export async function accountRoutes(app: FastifyInstance): Promise<void> {
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
