/**
 * Auth Routes — /api/v1/auth
 *
 * POST /api/v1/auth/register
 * POST /api/v1/auth/login
 * POST /api/v1/auth/refresh
 * DELETE /api/v1/auth/logout
 *
 * Platform-aware token delivery:
 * - Web (no X-Platform header or X-Platform: web): refresh token in httpOnly cookie
 * - Mobile (X-Platform: mobile): refresh token in response body (stored in SecureStore)
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  register,
  login,
  refresh,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
} from '../services/auth.service.js';
import { logger } from '../lib/logger.js';

const REFRESH_COOKIE = 'ghoast_refresh';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth/refresh',
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
};

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

function isMobile(request: { headers: Record<string, string | string[] | undefined> }): boolean {
  return request.headers['x-platform'] === 'mobile';
}

function setRefreshCookie(reply: Parameters<typeof register>[0] extends never ? never : import('fastify').FastifyReply, token: string): void {
  void reply.setCookie(REFRESH_COOKIE, token, COOKIE_OPTIONS);
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /register ──────────────────────────────────────────────────────────
  app.post('/register', async (request, reply) => {
    const parse = registerSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parse.error.issues[0]?.message ?? 'Validation failed',
      });
    }

    const { email, password } = parse.data;

    try {
      const { user, tokens } = await register(email, password);
      const mobile = isMobile(request);

      if (!mobile) setRefreshCookie(reply, tokens.refreshToken);

      return reply.status(201).send({
        user,
        accessToken: tokens.accessToken,
        ...(mobile ? { refreshToken: tokens.refreshToken } : {}),
      });
    } catch (err) {
      if (err instanceof EmailAlreadyExistsError) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: err.message,
        });
      }
      logger.error({ err }, 'Registration error');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Registration failed. Please try again.',
      });
    }
  });

  // ── POST /login ─────────────────────────────────────────────────────────────
  app.post('/login', async (request, reply) => {
    const parse = loginSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Email and password are required.',
      });
    }

    const { email, password } = parse.data;

    try {
      const { user, tokens } = await login(email, password);
      const mobile = isMobile(request);

      if (!mobile) setRefreshCookie(reply, tokens.refreshToken);

      return reply.send({
        user,
        accessToken: tokens.accessToken,
        ...(mobile ? { refreshToken: tokens.refreshToken } : {}),
      });
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: err.message,
        });
      }
      logger.error({ err }, 'Login error');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Login failed. Please try again.',
      });
    }
  });

  // ── POST /refresh ───────────────────────────────────────────────────────────
  app.post('/refresh', async (request, reply) => {
    const mobile = isMobile(request);

    // Web: read from httpOnly cookie | Mobile: read from request body
    let token: string | undefined;
    if (mobile) {
      const body = request.body as Record<string, unknown> | undefined;
      token = typeof body?.refreshToken === 'string' ? body.refreshToken : undefined;
    } else {
      token = request.cookies?.[REFRESH_COOKIE];
    }

    if (!token) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Refresh token missing. Please log in again.',
      });
    }

    try {
      const { user, tokens } = await refresh(token);
      if (!mobile) setRefreshCookie(reply, tokens.refreshToken);

      return reply.send({
        user,
        accessToken: tokens.accessToken,
        ...(mobile ? { refreshToken: tokens.refreshToken } : {}),
      });
    } catch {
      // Clear the cookie on invalid refresh (web)
      if (!mobile) {
        void reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_OPTIONS.path });
      }
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Session expired. Please log in again.',
      });
    }
  });

  // ── DELETE /logout ──────────────────────────────────────────────────────────
  app.delete('/logout', async (request, reply) => {
    void reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_OPTIONS.path });
    return reply.status(204).send();
  });
}
