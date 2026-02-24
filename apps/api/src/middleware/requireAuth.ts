/**
 * requireAuth middleware
 * Verifies the JWT access token from the Authorization header.
 * Attaches the Ghoast user to request.user on success.
 * Returns 401 on missing, expired, or tampered tokens.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@ghoast/db';
import { verifyAccessToken } from '../services/auth.service.js';
import { logger } from '../lib/logger.js';

// Extend Fastify request type
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      tier: string;
      creditBalance: number;
    };
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required. Include a Bearer token in the Authorization header.',
    });
  }

  const token = authHeader.slice(7);

  try {
    const { sub: userId } = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, tier: true, creditBalance: true },
    });

    if (!user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'User not found.',
      });
    }

    request.user = user;
  } catch (err) {
    logger.warn({ err }, 'Auth token verification failed');
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid or expired token. Please log in again.',
    });
  }
}

/**
 * checkTier middleware factory
 * Returns a middleware that enforces subscription tier requirements.
 * Returns 403 with upgrade prompt if the user's tier is insufficient.
 */
export function checkTier(required: 'PRO' | 'PRO_PLUS') {
  return async function tierMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const tier = request.user?.tier;

    const tierRank: Record<string, number> = { FREE: 0, PRO: 1, PRO_PLUS: 2 };
    const requiredRank = tierRank[required] ?? 99;
    const userRank = tierRank[tier ?? 'FREE'] ?? 0;

    if (userRank < requiredRank) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: `This feature requires ${required === 'PRO' ? 'Pro' : 'Pro+'} subscription.`,
        upgrade_required: true,
        tier_needed: required,
        upgrade_url: '/pricing',
      });
    }
  };
}
