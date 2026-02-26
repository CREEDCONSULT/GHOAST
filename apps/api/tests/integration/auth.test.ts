/**
 * Phase 1 — Auth Integration Tests
 * Tests all four auth route handlers via Fastify inject (no real network).
 *
 * Strategy: mock the auth SERVICE (not its internals) — route tests should
 * only verify HTTP semantics: status codes, validation, response shape, and
 * platform-aware token delivery. Service behaviour is covered in unit tests.
 *
 * Mocks: auth.service.js (service layer), redis (rate-limit store)
 */

// ── Environment ──────────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-chars-long!!';
process.env.SESSION_TOKEN_ENCRYPTION_KEY = '0'.repeat(64);

// ── Redis mock (self-contained — no external variable references) ─────────────
jest.mock('../../src/lib/redis.js', () => {
  const pipeline = {
    incr: jest.fn().mockReturnThis(),
    pexpire: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([[null, 1], [null, 60_000]]),
  };
  return {
    redis: {
      status: 'ready',
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      setex: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(1),
      pexpire: jest.fn().mockResolvedValue(1),
      pttl: jest.fn().mockResolvedValue(60_000),
      del: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
      // @fastify/rate-limit registers this Lua command via defineCommand.
      // The command uses callback style: cb(err, [current, ttl, banFlag])
      defineCommand: jest.fn(),
      rateLimit: jest.fn().mockImplementation((_key, _tw, _max, _ban, _cont, cb) => {
        cb(null, [1, 60_000, false]); // count=1 (well under limit), ttl=60s, ban=false
      }),
      pipeline: jest.fn().mockReturnValue(pipeline),
      multi: jest.fn().mockReturnValue(pipeline),
      sendCommand: jest.fn().mockResolvedValue([1, 60_000]),
    },
    verifyRedisConnection: jest.fn().mockResolvedValue(undefined),
  };
});

// ── Auth service mock ─────────────────────────────────────────────────────────
// Classes defined inside factory so instanceof checks work correctly
jest.mock('../../src/services/auth.service.js', () => {
  class EmailAlreadyExistsError extends Error {
    constructor() {
      super('An account with this email address already exists');
      this.name = 'EmailAlreadyExistsError';
    }
  }
  class InvalidCredentialsError extends Error {
    constructor() {
      super('Invalid email or password');
      this.name = 'InvalidCredentialsError';
    }
  }
  return {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    issueTokens: jest.fn(),
    verifyAccessToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
    EmailAlreadyExistsError,
    InvalidCredentialsError,
  };
});

// ── Prisma mock (server's onClose hook calls $disconnect) ────────────────────
jest.mock('@ghoast/db', () => ({
  prisma: {
    $disconnect: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── Imports (after all mocks are declared) ───────────────────────────────────
import { buildServer } from '../../src/server.js';
import {
  register,
  login,
  refresh,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
} from '../../src/services/auth.service.js';

// ── Fake data ─────────────────────────────────────────────────────────────────
const MOCK_USER = {
  id: 'user-cuid-001',
  email: 'test@example.com',
  tier: 'FREE',
  creditBalance: 0,
  createdAt: new Date('2024-01-15T00:00:00Z'),
};

const MOCK_TOKENS = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
};

// ── Helper ────────────────────────────────────────────────────────────────────
function getCookieValue(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const raw = headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const match = cookies.find((c) => c.startsWith(`${name}=`));
  return match?.split(';')[0]?.slice(name.length + 1);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Auth routes — /api/v1/auth', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /register ───────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('returns 400 on invalid email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'not-an-email', password: 'password123' },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json<{ statusCode: number; error: string }>();
      expect(body.statusCode).toBe(400);
      expect(body.error).toBe('Bad Request');
      expect(register).not.toHaveBeenCalled();
    });

    it('returns 400 when password is too short (< 8 chars)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'user@example.com', password: 'short' },
      });
      expect(res.statusCode).toBe(400);
      expect(register).not.toHaveBeenCalled();
    });

    it('returns 400 when password exceeds 72 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'user@example.com', password: 'a'.repeat(73) },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 409 when email already exists', async () => {
      (register as jest.Mock).mockRejectedValue(new EmailAlreadyExistsError());

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'test@example.com', password: 'password123' },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json<{ error: string }>();
      expect(body.error).toBe('Conflict');
    });

    it('returns 201 with accessToken and sets cookie for web', async () => {
      (register as jest.Mock).mockResolvedValue({ user: MOCK_USER, tokens: MOCK_TOKENS });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'new@example.com', password: 'securepassword' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ user: typeof MOCK_USER; accessToken: string }>();
      expect(body.user.id).toBe(MOCK_USER.id);
      expect(body.user.email).toBe(MOCK_USER.email);
      expect(body.user).not.toHaveProperty('passwordHash');
      expect(body.accessToken).toBe(MOCK_TOKENS.accessToken);
      // Web: refreshToken in cookie, NOT in response body
      expect(body).not.toHaveProperty('refreshToken');
      expect(getCookieValue(res.headers as Record<string, string | string[]>, 'ghoast_refresh')).toBe(MOCK_TOKENS.refreshToken);
    });

    it('returns 201 with refreshToken in body for mobile (X-Platform: mobile)', async () => {
      (register as jest.Mock).mockResolvedValue({ user: MOCK_USER, tokens: MOCK_TOKENS });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        headers: { 'x-platform': 'mobile' },
        payload: { email: 'mobile@example.com', password: 'securepassword' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ accessToken: string; refreshToken: string }>();
      expect(body.accessToken).toBe(MOCK_TOKENS.accessToken);
      expect(body.refreshToken).toBe(MOCK_TOKENS.refreshToken);
      // No cookie for mobile
      expect(getCookieValue(res.headers as Record<string, string | string[]>, 'ghoast_refresh')).toBeUndefined();
    });

    it('returns 500 on unexpected service error', async () => {
      (register as jest.Mock).mockRejectedValue(new Error('DB connection lost'));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'user@example.com', password: 'password123' },
      });

      expect(res.statusCode).toBe(500);
    });
  });

  // ── POST /login ──────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('returns 400 on invalid email format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'bad-email', password: 'password' },
      });
      expect(res.statusCode).toBe(400);
      expect(login).not.toHaveBeenCalled();
    });

    it('returns 400 on missing password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'user@example.com' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 401 on invalid credentials', async () => {
      (login as jest.Mock).mockRejectedValue(new InvalidCredentialsError());

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'test@example.com', password: 'wrongpassword' },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json<{ error: string }>();
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 200 with accessToken and sets cookie for web', async () => {
      (login as jest.Mock).mockResolvedValue({ user: MOCK_USER, tokens: MOCK_TOKENS });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'test@example.com', password: 'correctpassword' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ user: typeof MOCK_USER; accessToken: string }>();
      expect(body.user.email).toBe(MOCK_USER.email);
      expect(body.accessToken).toBe(MOCK_TOKENS.accessToken);
      expect(body).not.toHaveProperty('refreshToken');
      expect(getCookieValue(res.headers as Record<string, string | string[]>, 'ghoast_refresh')).toBe(MOCK_TOKENS.refreshToken);
    });

    it('returns 200 with refreshToken in body for mobile', async () => {
      (login as jest.Mock).mockResolvedValue({ user: MOCK_USER, tokens: MOCK_TOKENS });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-platform': 'mobile' },
        payload: { email: 'test@example.com', password: 'correctpassword' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ refreshToken: string }>();
      expect(body.refreshToken).toBe(MOCK_TOKENS.refreshToken);
      expect(getCookieValue(res.headers as Record<string, string | string[]>, 'ghoast_refresh')).toBeUndefined();
    });
  });

  // ── POST /refresh ────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/refresh', () => {
    it('returns 401 when no cookie or body token (web)', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh' });
      expect(res.statusCode).toBe(401);
      expect(refresh).not.toHaveBeenCalled();
    });

    it('returns 401 when mobile body token is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { 'x-platform': 'mobile' },
        payload: {},
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 when service throws on invalid token', async () => {
      (refresh as jest.Mock).mockRejectedValue(new Error('jwt malformed'));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { 'x-platform': 'mobile' },
        payload: { refreshToken: 'invalid.token.here' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 200 with new tokens and cookie for web', async () => {
      const newTokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
      (refresh as jest.Mock).mockResolvedValue({ user: MOCK_USER, tokens: newTokens });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { cookie: `ghoast_refresh=${MOCK_TOKENS.refreshToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ accessToken: string }>();
      expect(body.accessToken).toBe(newTokens.accessToken);
      expect(body).not.toHaveProperty('refreshToken');
      expect(getCookieValue(res.headers as Record<string, string | string[]>, 'ghoast_refresh')).toBe(newTokens.refreshToken);
      expect(refresh).toHaveBeenCalledWith(MOCK_TOKENS.refreshToken);
    });

    it('returns 200 with tokens in body for mobile', async () => {
      const newTokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
      (refresh as jest.Mock).mockResolvedValue({ user: MOCK_USER, tokens: newTokens });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { 'x-platform': 'mobile' },
        payload: { refreshToken: MOCK_TOKENS.refreshToken },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ accessToken: string; refreshToken: string }>();
      expect(body.accessToken).toBe(newTokens.accessToken);
      expect(body.refreshToken).toBe(newTokens.refreshToken);
    });

    it('clears cookie on failed web refresh', async () => {
      (refresh as jest.Mock).mockRejectedValue(new Error('expired'));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { cookie: 'ghoast_refresh=badtoken' },
      });

      expect(res.statusCode).toBe(401);
      const rawCookie = res.headers['set-cookie'];
      const cookieStr = Array.isArray(rawCookie) ? rawCookie.join(' ') : (rawCookie ?? '');
      // Fastify clears by setting empty value or Max-Age=0
      expect(cookieStr).toMatch(/ghoast_refresh=;|Max-Age=0/i);
    });
  });

  // ── DELETE /logout ───────────────────────────────────────────────────────────

  describe('DELETE /api/v1/auth/logout', () => {
    it('returns 204 and clears the refresh cookie', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/logout',
        headers: { cookie: 'ghoast_refresh=sometoken' },
      });

      expect(res.statusCode).toBe(204);
      const rawCookie = res.headers['set-cookie'];
      const cookieStr = Array.isArray(rawCookie) ? rawCookie.join(' ') : (rawCookie ?? '');
      expect(cookieStr).toMatch(/ghoast_refresh=;|Max-Age=0/i);
    });

    it('returns 204 even when no cookie present', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/api/v1/auth/logout' });
      expect(res.statusCode).toBe(204);
    });
  });

  // ── GET /health ──────────────────────────────────────────────────────────────

  describe('GET /api/v1/health', () => {
    it('returns 200 with status ok', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ status: string }>().status).toBe('ok');
    });
  });
});
