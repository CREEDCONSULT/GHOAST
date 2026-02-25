/**
 * Phase 2 — Account Routes Integration Tests
 * Tests all three account endpoints via Fastify inject (no real network).
 *
 * Strategy:
 * - Mock accounts.service.js (service layer) — keeps tests focused on HTTP semantics
 * - Mock requireAuth middleware to inject a test user without a real JWT
 * - Mock redis (rate-limit store) — reuse pattern from auth.test.ts
 * - Mock @ghoast/db — only needed for server onClose hook
 */

// ── Environment ──────────────────────────────────────────────────────────────
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

// ── Accounts service mock ─────────────────────────────────────────────────────
jest.mock('../../src/services/accounts.service.js', () => {
  class AccountNotFoundError extends Error {
    constructor() {
      super('Instagram account not found or does not belong to you.');
      this.name = 'AccountNotFoundError';
    }
  }
  class AccountAlreadyConnectedError extends Error {
    readonly handle: string;
    constructor(handle: string) {
      super(`@${handle} is already connected to your Ghoast account.`);
      this.name = 'AccountAlreadyConnectedError';
      this.handle = handle;
    }
  }
  class SessionExpiredError extends Error {
    constructor() {
      super('Instagram session has expired. Please reconnect your account.');
      this.name = 'SessionExpiredError';
    }
  }
  class InstagramRateLimitError extends Error {
    constructor() {
      super('Instagram rate limit reached. Please try again later.');
      this.name = 'InstagramRateLimitError';
    }
  }
  return {
    connectAccount: jest.fn(),
    disconnectAccount: jest.fn(),
    listAccounts: jest.fn(),
    AccountNotFoundError,
    AccountAlreadyConnectedError,
    SessionExpiredError,
    InstagramRateLimitError,
  };
});

// ── Auth middleware mock ──────────────────────────────────────────────────────
// Injects a test user so routes don't need real JWTs
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

jest.mock('@ghoast/db', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    $disconnect: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import { buildServer } from '../../src/server.js';
import {
  connectAccount,
  disconnectAccount,
  listAccounts,
  AccountNotFoundError,
  AccountAlreadyConnectedError,
} from '../../src/services/accounts.service.js';
// Use the REAL error classes from instagram.ts (not mocked) so that
// instanceof checks in the route handler work correctly
import { SessionExpiredError, InstagramRateLimitError } from '../../src/lib/instagram.js';
import { prisma } from '@ghoast/db';

// ── Fake data ─────────────────────────────────────────────────────────────────
const TEST_USER_ID = 'test-user-id';

const MOCK_ACCOUNT = {
  id: 'account-cuid-001',
  userId: TEST_USER_ID,
  instagramUserId: '123456789',
  handle: 'testuser',
  displayName: 'Test User',
  profilePicUrl: 'https://example.com/pic.jpg',
  followersCount: 1000,
  followingCount: 500,
  queuePaused: false,
  lastScannedAt: null,
  createdAt: new Date('2024-01-15T00:00:00Z'),
};

const VALID_TOKEN = 'a'.repeat(40); // 40+ char alphanumeric token

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Account routes — /api/v1/accounts', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    // Make requireAuth pass: prisma.user.findUnique returns a test user
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: TEST_USER_ID,
      email: 'test@example.com',
      tier: 'FREE',
      creditBalance: 0,
    });

    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply requireAuth user mock after clearAllMocks
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: TEST_USER_ID,
      email: 'test@example.com',
      tier: 'FREE',
      creditBalance: 0,
    });
  });

  // ── Auth guard ─────────────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('returns 401 when no Bearer token provided on POST /connect', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts/connect',
        payload: { sessionToken: VALID_TOKEN },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 when no Bearer token provided on GET /', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/accounts' });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 when no Bearer token provided on DELETE /:id', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/accounts/some-id',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── POST /connect ──────────────────────────────────────────────────────────

  describe('POST /api/v1/accounts/connect', () => {
    const authHeaders = { authorization: 'Bearer valid-test-token' };

    it('returns 400 when sessionToken is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts/connect',
        headers: authHeaders,
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(connectAccount).not.toHaveBeenCalled();
    });

    it('returns 400 when sessionToken is too short (< 20 chars)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts/connect',
        headers: authHeaders,
        payload: { sessionToken: 'short' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when sessionToken contains invalid characters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts/connect',
        headers: authHeaders,
        payload: { sessionToken: '<script>alert(1)</script>xxxxxxxxxxxxxxxxxxxxxxx' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 201 with account on success', async () => {
      (connectAccount as jest.Mock).mockResolvedValue(MOCK_ACCOUNT);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts/connect',
        headers: authHeaders,
        payload: { sessionToken: VALID_TOKEN },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ account: typeof MOCK_ACCOUNT }>();
      expect(body.account.handle).toBe('testuser');
      expect(body.account.id).toBe(MOCK_ACCOUNT.id);
      // SECURITY: session token fields must NOT be in response
      expect(body.account).not.toHaveProperty('sessionTokenEncrypted');
      expect(body.account).not.toHaveProperty('sessionTokenIv');
      expect(connectAccount).toHaveBeenCalledWith(TEST_USER_ID, VALID_TOKEN);
    });

    it('returns 401 when Instagram session is expired/invalid', async () => {
      (connectAccount as jest.Mock).mockRejectedValue(new SessionExpiredError());

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts/connect',
        headers: authHeaders,
        payload: { sessionToken: VALID_TOKEN },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json<{ code: string }>();
      expect(body.code).toBe('SESSION_EXPIRED');
    });

    it('returns 429 when Instagram rate limits the validation request', async () => {
      (connectAccount as jest.Mock).mockRejectedValue(new InstagramRateLimitError());

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts/connect',
        headers: authHeaders,
        payload: { sessionToken: VALID_TOKEN },
      });

      expect(res.statusCode).toBe(429);
      const body = res.json<{ code: string }>();
      expect(body.code).toBe('INSTAGRAM_RATE_LIMIT');
    });

    it('returns 409 when account is already connected', async () => {
      (connectAccount as jest.Mock).mockRejectedValue(new AccountAlreadyConnectedError('testuser'));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts/connect',
        headers: authHeaders,
        payload: { sessionToken: VALID_TOKEN },
      });

      expect(res.statusCode).toBe(409);
    });

    it('returns 500 on unexpected service error', async () => {
      (connectAccount as jest.Mock).mockRejectedValue(new Error('DB failure'));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accounts/connect',
        headers: authHeaders,
        payload: { sessionToken: VALID_TOKEN },
      });

      expect(res.statusCode).toBe(500);
    });
  });

  // ── GET / ──────────────────────────────────────────────────────────────────

  describe('GET /api/v1/accounts', () => {
    const authHeaders = { authorization: 'Bearer valid-test-token' };

    it('returns 200 with empty array when no accounts connected', async () => {
      (listAccounts as jest.Mock).mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/accounts',
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json<{ accounts: unknown[] }>().accounts).toEqual([]);
      expect(listAccounts).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('returns 200 with account list — no session token fields', async () => {
      (listAccounts as jest.Mock).mockResolvedValue([MOCK_ACCOUNT]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/accounts',
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ accounts: typeof MOCK_ACCOUNT[] }>();
      expect(body.accounts).toHaveLength(1);
      expect(body.accounts[0]?.handle).toBe('testuser');
      // SECURITY: session token fields must NOT appear
      expect(body.accounts[0]).not.toHaveProperty('sessionTokenEncrypted');
      expect(body.accounts[0]).not.toHaveProperty('sessionTokenIv');
    });

    it('returns 500 on unexpected error', async () => {
      (listAccounts as jest.Mock).mockRejectedValue(new Error('DB failure'));

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/accounts',
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(500);
    });
  });

  // ── DELETE /:id ────────────────────────────────────────────────────────────

  describe('DELETE /api/v1/accounts/:id', () => {
    const authHeaders = { authorization: 'Bearer valid-test-token' };

    it('returns 204 on successful disconnect', async () => {
      (disconnectAccount as jest.Mock).mockResolvedValue(undefined);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/accounts/${MOCK_ACCOUNT.id}`,
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(204);
      expect(disconnectAccount).toHaveBeenCalledWith(TEST_USER_ID, MOCK_ACCOUNT.id);
    });

    it('returns 404 when account not found or belongs to another user', async () => {
      (disconnectAccount as jest.Mock).mockRejectedValue(new AccountNotFoundError());

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/accounts/nonexistent-id',
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(404);
      const body = res.json<{ error: string }>();
      expect(body.error).toBe('Not Found');
    });

    it('returns 500 on unexpected error', async () => {
      (disconnectAccount as jest.Mock).mockRejectedValue(new Error('DB failure'));

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/accounts/${MOCK_ACCOUNT.id}`,
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(500);
    });
  });
});
