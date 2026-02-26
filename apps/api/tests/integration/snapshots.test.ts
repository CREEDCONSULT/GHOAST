/**
 * Phase 7 — Snapshot Routes Integration Tests
 *
 * Tests:
 * - GET /api/v1/accounts/:id/snapshots
 * - GET /api/v1/accounts/:id/ghosts/export (CSV)
 *
 * Strategy:
 * - Mock snapshot.service.js (service layer)
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

// ── Snapshot service mock ─────────────────────────────────────────────────────
jest.mock('../../src/services/snapshot.service.js', () => {
  class SnapshotAccountNotFoundError extends Error {
    constructor() {
      super('Account not found or does not belong to you.');
      this.name = 'SnapshotAccountNotFoundError';
    }
  }
  return {
    getSnapshots: jest.fn(),
    takeSnapshot: jest.fn(),
    runDailySnapshots: jest.fn(),
    SnapshotAccountNotFoundError,
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
    instagramAccount: { findFirst: jest.fn() },
    ghost: { findMany: jest.fn() },
    $disconnect: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import { buildServer } from '../../src/server.js';
import {
  getSnapshots,
  SnapshotAccountNotFoundError,
} from '../../src/services/snapshot.service.js';
import { prisma } from '@ghoast/db';

// ── Fake data ─────────────────────────────────────────────────────────────────
const TEST_USER_ID = 'test-user-id';
const ACCOUNT_ID = 'account-cuid-001';
const AUTH_HEADERS = { authorization: 'Bearer valid-test-token' };

const MOCK_SNAPSHOTS = [
  {
    id: 'snap-001',
    accountId: ACCOUNT_ID,
    followersCount: 1200,
    followingCount: 900,
    ghostCount: 55,
    ratio: 0.75,
    takenAt: new Date('2024-01-15T00:00:00Z'),
  },
  {
    id: 'snap-002',
    accountId: ACCOUNT_ID,
    followersCount: 1100,
    followingCount: 880,
    ghostCount: 60,
    ratio: 0.8,
    takenAt: new Date('2024-01-14T00:00:00Z'),
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Snapshot routes — /api/v1/accounts', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: TEST_USER_ID,
      email: 'test@example.com',
      tier: 'PRO',
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
      tier: 'PRO',
      creditBalance: 0,
    });
  });

  // ── GET /:id/snapshots ────────────────────────────────────────────────────

  describe('GET /api/v1/accounts/:id/snapshots', () => {
    it('returns 401 when no auth token is provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/snapshots`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 403 when user is on FREE tier (tier gate)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: TEST_USER_ID,
        tier: 'FREE',
        creditBalance: 0,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/snapshots`,
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 200 with snapshot array for PRO user', async () => {
      (getSnapshots as jest.Mock).mockResolvedValue(MOCK_SNAPSHOTS);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/snapshots`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as unknown[];
      expect(body).toHaveLength(2);
    });

    it('returns 200 with snapshot array for PRO_PLUS user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: TEST_USER_ID,
        tier: 'PRO_PLUS',
        creditBalance: 0,
      });
      (getSnapshots as jest.Mock).mockResolvedValue(MOCK_SNAPSHOTS);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/snapshots`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(200);
    });

    it('returns 403 when account does not belong to user', async () => {
      (getSnapshots as jest.Mock).mockRejectedValue(new SnapshotAccountNotFoundError());

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/snapshots`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body)).toEqual({ error: 'Forbidden' });
    });

    it('returns 500 on unexpected service error', async () => {
      (getSnapshots as jest.Mock).mockRejectedValue(new Error('Database exploded'));

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/snapshots`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.body)).toEqual({ error: 'Internal Server Error' });
    });

    it('passes correct userId, accountId, and tier to getSnapshots', async () => {
      (getSnapshots as jest.Mock).mockResolvedValue([]);

      await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/snapshots`,
        headers: AUTH_HEADERS,
      });

      expect(getSnapshots).toHaveBeenCalledWith(TEST_USER_ID, ACCOUNT_ID, 'PRO');
    });
  });

  // ── GET /:id/ghosts/export ────────────────────────────────────────────────

  describe('GET /api/v1/accounts/:id/ghosts/export', () => {
    it('returns 401 when no auth token is provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/export`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 403 when user is on FREE tier (tier gate)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: TEST_USER_ID,
        tier: 'FREE',
        creditBalance: 0,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/export`,
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 403 when account does not belong to user', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/export`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body)).toEqual({ error: 'Forbidden' });
    });

    it('returns CSV content-type for valid request', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue({
        id: ACCOUNT_ID,
        handle: 'testuser',
      });
      // Return empty batch so the stream ends immediately
      (prisma.ghost.findMany as jest.Mock).mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/export`,
        headers: AUTH_HEADERS,
      });

      expect(res.headers['content-type']).toMatch(/text\/csv/);
    });

    it('returns Content-Disposition attachment header with filename', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue({
        id: ACCOUNT_ID,
        handle: 'testuser',
      });
      (prisma.ghost.findMany as jest.Mock).mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/export`,
        headers: AUTH_HEADERS,
      });

      expect(res.headers['content-disposition']).toMatch(
        /attachment; filename="ghoast-export-testuser-\d{4}-\d{2}-\d{2}\.csv"/,
      );
    });

    it('includes CSV header row in response body', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue({
        id: ACCOUNT_ID,
        handle: 'testuser',
      });
      (prisma.ghost.findMany as jest.Mock).mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/export`,
        headers: AUTH_HEADERS,
      });

      expect(res.body).toContain(
        'display_name,handle,followers,following,ratio,tier,priority_score,last_post_date,account_type',
      );
    });

    it('includes ghost rows in CSV body', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue({
        id: ACCOUNT_ID,
        handle: 'testuser',
      });

      const ghost = {
        id: 'ghost-001',
        displayName: 'Ghost User',
        handle: 'ghostuser',
        followersCount: 200,
        followingCount: 5000,
        tier: 1,
        priorityScore: 10,
        lastPostDate: null,
        accountType: 'PERSONAL',
      };

      // Batch of 1 is less than BATCH_SIZE (500) → cursor stays undefined → only one findMany call
      (prisma.ghost.findMany as jest.Mock).mockResolvedValueOnce([ghost]);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/export`,
        headers: AUTH_HEADERS,
      });

      expect(res.body).toContain('ghostuser');
      expect(res.body).toContain('Ghost User');
    });

    it('escapes CSV fields that contain commas', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue({
        id: ACCOUNT_ID,
        handle: 'testuser',
      });

      const ghostWithComma = {
        id: 'ghost-002',
        displayName: 'Name, With Comma',
        handle: 'commauser',
        followersCount: 100,
        followingCount: 200,
        tier: 2,
        priorityScore: 30,
        lastPostDate: null,
        accountType: 'PERSONAL',
      };

      // Batch of 1 < BATCH_SIZE → cursor stays undefined → only one findMany call
      (prisma.ghost.findMany as jest.Mock).mockResolvedValueOnce([ghostWithComma]);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/export`,
        headers: AUTH_HEADERS,
      });

      // Display name with comma should be wrapped in quotes
      expect(res.body).toContain('"Name, With Comma"');
    });

    it('verifies account ownership using userId in query', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue({
        id: ACCOUNT_ID,
        handle: 'testuser',
      });
      (prisma.ghost.findMany as jest.Mock).mockResolvedValue([]);

      await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/export`,
        headers: AUTH_HEADERS,
      });

      expect(prisma.instagramAccount.findFirst).toHaveBeenCalledWith({
        where: { id: ACCOUNT_ID, userId: TEST_USER_ID },
        select: { id: true, handle: true },
      });
    });
  });
});
