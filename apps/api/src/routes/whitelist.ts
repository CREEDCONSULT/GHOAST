/**
 * Whitelist Routes — /api/v1/accounts/:id/...
 *
 * POST   /api/v1/accounts/:id/ghosts/:ghostId/whitelist  Add ghost to whitelist
 * DELETE /api/v1/accounts/:id/ghosts/:ghostId/whitelist  Remove ghost from whitelist
 * GET    /api/v1/accounts/:id/whitelist                  List whitelisted ghosts
 *
 * All routes require Pro+ subscription (checkTier('PRO_PLUS')).
 */

import type { FastifyInstance } from 'fastify';
import {
  addToWhitelist,
  removeFromWhitelist,
  listWhitelist,
  WhitelistAccountNotFoundError,
  WhitelistGhostNotFoundError,
  WhitelistLimitReachedError,
} from '../services/whitelist.service.js';
import { requireAuth, checkTier } from '../middleware/requireAuth.js';
import { logger } from '../lib/logger.js';

export async function whitelistRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /:id/ghosts/:ghostId/whitelist ────────────────────────────────────
  app.post(
    '/:id/ghosts/:ghostId/whitelist',
    { preHandler: [requireAuth, checkTier('PRO_PLUS')] },
    async (request, reply) => {
      const { id: accountId, ghostId } = request.params as { id: string; ghostId: string };
      const userId = request.user!.id;

      try {
        const ghost = await addToWhitelist(userId, accountId, ghostId);
        return reply.status(201).send({ ghost });
      } catch (err) {
        if (err instanceof WhitelistAccountNotFoundError || err instanceof WhitelistGhostNotFoundError) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: err.message,
          });
        }
        if (err instanceof WhitelistLimitReachedError) {
          return reply.status(422).send({
            statusCode: 422,
            error: 'Unprocessable Entity',
            message: err.message,
            limit: err.limit,
          });
        }
        logger.error({ err, userId, accountId, ghostId }, 'Add to whitelist error');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to add ghost to whitelist.',
        });
      }
    },
  );

  // ── DELETE /:id/ghosts/:ghostId/whitelist ─────────────────────────────────
  app.delete(
    '/:id/ghosts/:ghostId/whitelist',
    { preHandler: [requireAuth, checkTier('PRO_PLUS')] },
    async (request, reply) => {
      const { id: accountId, ghostId } = request.params as { id: string; ghostId: string };
      const userId = request.user!.id;

      try {
        await removeFromWhitelist(userId, accountId, ghostId);
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof WhitelistAccountNotFoundError || err instanceof WhitelistGhostNotFoundError) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: err.message,
          });
        }
        logger.error({ err, userId, accountId, ghostId }, 'Remove from whitelist error');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to remove ghost from whitelist.',
        });
      }
    },
  );

  // ── GET /:id/whitelist ─────────────────────────────────────────────────────
  app.get(
    '/:id/whitelist',
    { preHandler: [requireAuth, checkTier('PRO_PLUS')] },
    async (request, reply) => {
      const { id: accountId } = request.params as { id: string };
      const userId = request.user!.id;

      try {
        const { ghosts, total } = await listWhitelist(userId, accountId);
        return reply.send({ ghosts, total });
      } catch (err) {
        if (err instanceof WhitelistAccountNotFoundError) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: err.message,
          });
        }
        logger.error({ err, userId, accountId }, 'List whitelist error');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to retrieve whitelist.',
        });
      }
    },
  );
}
