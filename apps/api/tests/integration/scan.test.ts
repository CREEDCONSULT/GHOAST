/**
 * Phase 3 — Scan Routes Integration Tests
 * Tests POST /:id/scan and GET /:id/scan/progress via Fastify inject.
 *
 * Strategy:
 * - Mock scan.service.js (service layer)
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
      publish: jest.fn().mockResolvedValue(0),
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

// ── Scan service mock ─────────────────────────────────────────────────────────
jest.mock('../../src/services/scan.service.js', () => {
  class ScanNotFoundError extends Error {
    constructor() { super('Not found'); this.name = 'ScanNotFoundError'; }
  }
  class ScanAlreadyInProgressError extends Error {
    constructor() { super('Already in progress'); this.name = 'ScanAlreadyInProgressError'; }
  }
  return {
    startScan: jest.fn(),
    getScanProgress: jest.fn(),
    ScanNotFoundError,
    ScanAlreadyInProgressError,
    scanProgressKey: (id: string) => `scan:progress:${id}`,
    scanLockKey: (id: string) => `scan:lock:${id}`,
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
  startScan,
  getScanProgress,
  ScanNotFoundError,
  ScanAlreadyInProgressError,
} from '../../src/services/scan.service.js';
import { prisma } from '@ghoast/db';

// ── Fake data ─────────────────────────────────────────────────────────────────
const TEST_USER_ID = 'test-user-id';
const ACCOUNT_ID = 'account-cuid-001';
const AUTH_HEADERS = { authorization: 'Bearer valid-test-token' };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Scan routes — /api/v1/accounts/:id/scan', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
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
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: TEST_USER_ID,
      email: 'test@example.com',
      tier: 'FREE',
      creditBalance: 0,
    });
  });

  // ── Auth guard ──────────────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('returns 401 on POST /:id/scan without Bearer token', async () => {
      const res = await app.inject({ method: 'POST', url: `/api/v1/accounts/${ACCOUNT_ID}/scan` });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 on GET /:id/scan/progress without Bearer token', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/accounts/${ACCOUNT_ID}/scan/progress` });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── POST /:id/scan ──────────────────────────────────────────────────────────

  describe('POST /api/v1/accounts/:id/scan', () => {
    it('returns 202 and starts scan asynchronously', async () => {
      (startScan as jest.Mock).mockResolvedValue(undefined);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/scan`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(202);
      expect(startScan).toHaveBeenCalledWith(TEST_USER_ID, ACCOUNT_ID);
    });

    it('returns 409 if scan is already in progress', async () => {
      (startScan as jest.Mock).mockRejectedValue(new ScanAlreadyInProgressError());

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/scan`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(409);
    });

    it('returns 403 if account belongs to different user', async () => {
      (startScan as jest.Mock).mockRejectedValue(new ScanNotFoundError());

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/scan`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns 500 on unexpected error', async () => {
      (startScan as jest.Mock).mockRejectedValue(new Error('DB failure'));

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/scan`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(500);
    });
  });

  // ── GET /:id/scan/progress ──────────────────────────────────────────────────

  describe('GET /api/v1/accounts/:id/scan/progress', () => {
    it('returns 200 with not_started when no scan has run', async () => {
      (getScanProgress as jest.Mock).mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/scan/progress`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ status: string }>();
      expect(body.status).toBe('not_started');
    });

    it('returns 200 with current progress when scan is in progress', async () => {
      const progress = { status: 'in_progress', followingScanned: 150, followersScanned: 80, ghostCount: 12 };
      (getScanProgress as jest.Mock).mockResolvedValue(progress);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/scan/progress`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(progress);
    });

    it('returns 200 with complete status when scan is done', async () => {
      const progress = { status: 'complete', followingScanned: 500, followersScanned: 450, ghostCount: 87 };
      (getScanProgress as jest.Mock).mockResolvedValue(progress);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/scan/progress`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json<{ status: string }>().status).toBe('complete');
    });

    it('returns 403 if account belongs to different user', async () => {
      (getScanProgress as jest.Mock).mockRejectedValue(new ScanNotFoundError());

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/scan/progress`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns 500 on unexpected error', async () => {
      (getScanProgress as jest.Mock).mockRejectedValue(new Error('Redis failure'));

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/scan/progress`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(500);
    });
  });
});
