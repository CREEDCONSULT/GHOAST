/**
 * Phase 8 — Whitelist Routes Integration Tests
 *
 * Tests:
 * - POST   /api/v1/accounts/:id/ghosts/:ghostId/whitelist  Add to whitelist
 * - DELETE /api/v1/accounts/:id/ghosts/:ghostId/whitelist  Remove from whitelist
 * - GET    /api/v1/accounts/:id/whitelist                  List whitelist
 *
 * Strategy:
 * - Mock whitelist.service.js (service layer)
 * - Mock requireAuth via auth.service mock + prisma.user.findUnique
 * - Mock redis (rate-limit store)
 * - Mock @ghoast/db
 */

// ── Environment ───────────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-chars-long!!';
process.env.SESSION_TOKEN_ENCRYPTION_KEY = '0'.repeat(64);

// ── Redis mock ────────────────────────────────────────────────────────────────
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
      defineCommand: jest.fn(),
      rateLimit: jest.fn().mockImplementation((_k, _t, _m, _b, _c, cb) => {
        cb(null, [1, 60_000, false]);
      }),
      pipeline: jest.fn().mockReturnValue(pipeline),
      multi: jest.fn().mockReturnValue(pipeline),
      sendCommand: jest.fn().mockResolvedValue([1, 60_000]),
    },
    verifyRedisConnection: jest.fn().mockResolvedValue(undefined),
  };
});

// ── Whitelist service mock ─────────────────────────────────────────────────────
jest.mock('../../src/services/whitelist.service.js', () => {
  class WhitelistAccountNotFoundError extends Error {
    constructor() {
      super('Instagram account not found or does not belong to you.');
      this.name = 'WhitelistAccountNotFoundError';
    }
  }
  class WhitelistGhostNotFoundError extends Error {
    constructor() {
      super('Ghost not found or does not belong to this account.');
      this.name = 'WhitelistGhostNotFoundError';
    }
  }
  class WhitelistLimitReachedError extends Error {
    readonly limit: number;
    constructor() {
      super('Whitelist limit of 500 ghosts reached.');
      this.name = 'WhitelistLimitReachedError';
      this.limit = 500;
    }
  }
  return {
    addToWhitelist: jest.fn(),
    removeFromWhitelist: jest.fn(),
    listWhitelist: jest.fn(),
    WhitelistAccountNotFoundError,
    WhitelistGhostNotFoundError,
    WhitelistLimitReachedError,
  };
});

// ── Auth service mock ─────────────────────────────────────────────────────────
jest.mock('../../src/services/auth.service.js', () => ({
  register: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  issueTokens: jest.fn(),
  verifyAccessToken: jest.fn().mockReturnValue({ sub: 'test-user-id' }),
  verifyRefreshToken: jest.fn(),
  EmailAlreadyExistsError: class EmailAlreadyExistsError extends Error {},
  InvalidCredentialsError: class InvalidCredentialsError extends Error {},
}));

// ── DB mock ───────────────────────────────────────────────────────────────────
jest.mock('@ghoast/db', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    $disconnect: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import { buildServer } from '../../src/server.js';
import {
  addToWhitelist,
  removeFromWhitelist,
  listWhitelist,
  WhitelistAccountNotFoundError,
  WhitelistGhostNotFoundError,
  WhitelistLimitReachedError,
} from '../../src/services/whitelist.service.js';
import { prisma } from '@ghoast/db';

// ── Fake data ─────────────────────────────────────────────────────────────────
const TEST_USER_ID = 'test-user-id';
const ACCOUNT_ID = 'account-cuid-001';
const GHOST_ID = 'ghost-cuid-001';

const AUTH_HEADERS = { authorization: 'Bearer valid-test-token' };

const MOCK_GHOST = {
  id: GHOST_ID,
  instagramUserId: '987654321',
  handle: 'ghostuser',
  displayName: 'Ghost User',
  profilePicUrl: null,
  tier: 2,
  priorityScore: 30,
};

// ── Helper: set user tier ─────────────────────────────────────────────────────

function setUserTier(tier: string) {
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({
    id: TEST_USER_ID,
    email: 'test@example.com',
    tier,
    creditBalance: 0,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Whitelist routes — /api/v1/accounts/:id/...', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    setUserTier('PRO_PLUS');
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setUserTier('PRO_PLUS');
  });

  // ── Auth guard ─────────────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('returns 401 when no Bearer token on POST', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/whitelist`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 when no Bearer token on DELETE', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/whitelist`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 when no Bearer token on GET', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/whitelist`,
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── Tier guard ─────────────────────────────────────────────────────────────

  describe('Tier guard (Pro+ only)', () => {
    it('returns 403 for FREE user on POST', async () => {
      setUserTier('FREE');
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/whitelist`,
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(403);
      const body = res.json<{ upgrade_required: boolean }>();
      expect(body.upgrade_required).toBe(true);
    });

    it('returns 403 for PRO user on GET whitelist', async () => {
      setUserTier('PRO');
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/whitelist`,
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ── POST /:id/ghosts/:ghostId/whitelist ────────────────────────────────────

  describe('POST /api/v1/accounts/:id/ghosts/:ghostId/whitelist', () => {
    it('returns 201 with ghost on success', async () => {
      (addToWhitelist as jest.Mock).mockResolvedValue(MOCK_GHOST);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/whitelist`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ ghost: typeof MOCK_GHOST }>();
      expect(body.ghost.id).toBe(GHOST_ID);
      expect(body.ghost.handle).toBe('ghostuser');
      expect(addToWhitelist).toHaveBeenCalledWith(TEST_USER_ID, ACCOUNT_ID, GHOST_ID);
    });

    it('returns 404 when account not found', async () => {
      (addToWhitelist as jest.Mock).mockRejectedValue(new WhitelistAccountNotFoundError());

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/whitelist`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when ghost not found', async () => {
      (addToWhitelist as jest.Mock).mockRejectedValue(new WhitelistGhostNotFoundError());

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/whitelist`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 422 when whitelist limit reached', async () => {
      (addToWhitelist as jest.Mock).mockRejectedValue(new WhitelistLimitReachedError());

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/whitelist`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(422);
      const body = res.json<{ limit: number }>();
      expect(body.limit).toBe(500);
    });

    it('returns 500 on unexpected error', async () => {
      (addToWhitelist as jest.Mock).mockRejectedValue(new Error('DB failure'));

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/whitelist`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(500);
    });
  });

  // ── DELETE /:id/ghosts/:ghostId/whitelist ─────────────────────────────────

  describe('DELETE /api/v1/accounts/:id/ghosts/:ghostId/whitelist', () => {
    it('returns 204 on successful removal', async () => {
      (removeFromWhitelist as jest.Mock).mockResolvedValue(undefined);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/whitelist`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(204);
      expect(removeFromWhitelist).toHaveBeenCalledWith(TEST_USER_ID, ACCOUNT_ID, GHOST_ID);
    });

    it('returns 404 when ghost not found', async () => {
      (removeFromWhitelist as jest.Mock).mockRejectedValue(new WhitelistGhostNotFoundError());

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/whitelist`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 500 on unexpected error', async () => {
      (removeFromWhitelist as jest.Mock).mockRejectedValue(new Error('DB failure'));

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/whitelist`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(500);
    });
  });

  // ── GET /:id/whitelist ─────────────────────────────────────────────────────

  describe('GET /api/v1/accounts/:id/whitelist', () => {
    it('returns 200 with ghosts and total count', async () => {
      (listWhitelist as jest.Mock).mockResolvedValue({ ghosts: [MOCK_GHOST], total: 1 });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/whitelist`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ ghosts: unknown[]; total: number }>();
      expect(body.ghosts).toHaveLength(1);
      expect(body.total).toBe(1);
      expect(listWhitelist).toHaveBeenCalledWith(TEST_USER_ID, ACCOUNT_ID);
    });

    it('returns 200 with empty list when whitelist is empty', async () => {
      (listWhitelist as jest.Mock).mockResolvedValue({ ghosts: [], total: 0 });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/whitelist`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ ghosts: unknown[]; total: number }>();
      expect(body.ghosts).toHaveLength(0);
      expect(body.total).toBe(0);
    });

    it('returns 404 when account not found', async () => {
      (listWhitelist as jest.Mock).mockRejectedValue(new WhitelistAccountNotFoundError());

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/whitelist`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 500 on unexpected error', async () => {
      (listWhitelist as jest.Mock).mockRejectedValue(new Error('DB failure'));

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/whitelist`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(500);
    });
  });
});
