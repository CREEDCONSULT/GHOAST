import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  deleteUserAccount,
  UserDeletionNotFoundError,
} from '../services/users.service.js';
import { logger } from '../lib/logger.js';

const deletionSchema = z.object({
  confirmation: z.literal('DELETE'),
});

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.delete('/me', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = deletionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Type DELETE to confirm permanent account deletion.',
      });
    }

    const userId = request.user!.id;

    try {
      await deleteUserAccount(userId);
      void reply.clearCookie('ghoast_refresh', { path: '/' });
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof UserDeletionNotFoundError) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: err.message,
        });
      }

      logger.error({ err, userId }, 'Account deletion failed');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Account deletion failed. No further Instagram actions will be submitted.',
      });
    }
  });
}
