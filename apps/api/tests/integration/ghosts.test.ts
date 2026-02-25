/**
 * Phase 4 — Ghost List Routes Integration Tests
 *
 * Tests:
 * - GET /api/v1/accounts/:id/ghosts (list, filter, sort, paginate)
 * - POST /api/v1/accounts/:id/ghosts/:ghostId/unfollow (daily cap, errors)
 * - GET /api/v1/accounts/:id/stats
 *
 * Strategy:
 * - Mock ghosts.service.js (service layer)
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

// ── Ghosts service mock ───────────────────────────────────────────────────────
jest.mock('../../src/services/ghosts.service.js', () => {
  class GhostAccountNotFoundError extends Error {
    constructor() { super('Account not found'); this.name = 'GhostAccountNotFoundError'; }
  }
  class GhostNotFoundError extends Error {
    constructor() { super('Ghost not found'); this.name = 'GhostNotFoundError'; }
  }
  class GhostAlreadyRemovedError extends Error {
    constructor() { super('Already removed'); this.name = 'GhostAlreadyRemovedError'; }
  }
  class Tier5ProtectedError extends Error {
    constructor() { super('Tier 5 protected'); this.name = 'Tier5ProtectedError'; }
  }
  class DailyCapReachedError extends Error {
    constructor() { super('Daily cap reached'); this.name = 'DailyCapReachedError'; }
  }
  class SessionExpiredError extends Error {
    constructor() { super('Session expired'); this.name = 'SessionExpiredError'; }
  }
  class InstagramRateLimitError extends Error {
    constructor() { super('Rate limit'); this.name = 'InstagramRateLimitError'; }
  }
  return {
    listGhosts: jest.fn(),
    unfollowGhost: jest.fn(),
    getAccountStats: jest.fn(),
    getDailyUnfollowCount: jest.fn().mockResolvedValue(0),
    GhostAccountNotFoundError,
    GhostNotFoundError,
    GhostAlreadyRemovedError,
    Tier5ProtectedError,
    DailyCapReachedError,
    SessionExpiredError,
    InstagramRateLimitError,
    dailyCapKey: (id: string) => `daily_unfollow:${id}:2024-01-01`,
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
  listGhosts,
  unfollowGhost,
  getAccountStats,
  getDailyUnfollowCount,
  GhostAccountNotFoundError,
  GhostNotFoundError,
  GhostAlreadyRemovedError,
  Tier5ProtectedError,
  DailyCapReachedError,
  SessionExpiredError,
  InstagramRateLimitError,
} from '../../src/services/ghosts.service.js';
import { prisma } from '@ghoast/db';

// ── Fake data ─────────────────────────────────────────────────────────────────
const TEST_USER_ID = 'test-user-id';
const ACCOUNT_ID = 'account-cuid-001';
const GHOST_ID = 'ghost-cuid-001';
const AUTH_HEADERS = { authorization: 'Bearer valid-test-token' };

const MOCK_GHOST = {
  id: GHOST_ID,
  accountId: ACCOUNT_ID,
  instagramUserId: '987654321',
  handle: 'ghostaccount',
  displayName: 'Ghost Account',
  profilePicUrl: null,
  followersCount: 200,
  followingCount: 5000,
  isVerified: false,
  accountType: 'PERSONAL',
  lastPostDate: null,
  priorityScore: 15,
  tier: 1,
  scoreAccountType: 2,
  scoreRatio: 0,
  scoreEngagement: 0,
  scoreSizeBand: 2,
  scorePostRecency: 15,
  engagementUnknown: true,
  isWhitelisted: false,
  removedAt: null,
  firstSeenAt: new Date('2024-01-10T00:00:00Z'),
};

const MOCK_LIST_RESULT = {
  ghosts: [MOCK_GHOST],
  total: 1,
  page: 1,
  limit: 50,
  pages: 1,
};

const MOCK_STATS = {
  followersCount: 1000,
  followingCount: 1200,
  ghostCount: 87,
  ratio: 0.83,
  tierBreakdown: { tier1: 45, tier2: 22, tier3: 12, tier4: 7, tier5: 1 },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Ghost routes — /api/v1/accounts', () => {
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
    (getDailyUnfollowCount as jest.Mock).mockResolvedValue(0);
  });

  // ── Auth guard ──────────────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('returns 401 on GET /:id/ghosts without token', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts` });
      expect(res.statusCode).toBe(401);
    });
    it('returns 401 on POST /:id/ghosts/:ghostId/unfollow without token', async () => {
      const res = await app.inject({ method: 'POST', url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/unfollow` });
      expect(res.statusCode).toBe(401);
    });
    it('returns 401 on GET /:id/stats without token', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/accounts/${ACCOUNT_ID}/stats` });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /accounts/:id/ghosts ────────────────────────────────────────────────

  describe('GET /api/v1/accounts/:id/ghosts', () => {
    it('returns 200 with ghost list and pagination meta', async () => {
      (listGhosts as jest.Mock).mockResolvedValue(MOCK_LIST_RESULT);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<typeof MOCK_LIST_RESULT & { dailyUnfollowCount: number }>();
      expect(body.ghosts).toHaveLength(1);
      expect(body.total).toBe(1);
      expect(body.ghosts[0]?.handle).toBe('ghostaccount');
      expect(body.dailyUnfollowCount).toBe(0);
      expect(listGhosts).toHaveBeenCalledWith(TEST_USER_ID, ACCOUNT_ID, expect.any(Object));
    });

    it('passes tier filter to service', async () => {
      (listGhosts as jest.Mock).mockResolvedValue({ ...MOCK_LIST_RESULT, ghosts: [] });

      await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts?tier=1`,
        headers: AUTH_HEADERS,
      });

      expect(listGhosts).toHaveBeenCalledWith(
        TEST_USER_ID,
        ACCOUNT_ID,
        expect.objectContaining({ tier: 1 }),
      );
    });

    it('passes sort param to service', async () => {
      (listGhosts as jest.Mock).mockResolvedValue({ ...MOCK_LIST_RESULT, ghosts: [] });

      await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts?sort=followers`,
        headers: AUTH_HEADERS,
      });

      expect(listGhosts).toHaveBeenCalledWith(
        TEST_USER_ID,
        ACCOUNT_ID,
        expect.objectContaining({ sort: 'followers' }),
      );
    });

    it('returns 400 for invalid tier value', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts?tier=99`,
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for invalid sort value', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts?sort=invalid`,
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 403 when account belongs to different user', async () => {
      (listGhosts as jest.Mock).mockRejectedValue(new GhostAccountNotFoundError());

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts`,
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(403);
    });

    it('does not return session token fields (service contract)', async () => {
      // The real service uses an explicit Prisma select that excludes token fields.
      // The mock mimics this by only returning safe fields — this verifies the
      // response contract at the HTTP layer.
      (listGhosts as jest.Mock).mockResolvedValue(MOCK_LIST_RESULT);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts`,
        headers: AUTH_HEADERS,
      });

      const body = res.json<{ ghosts: Record<string, unknown>[] }>();
      expect(body.ghosts[0]).not.toHaveProperty('sessionTokenEncrypted');
      expect(body.ghosts[0]).not.toHaveProperty('sessionTokenIv');
    });

    it('returns 500 on unexpected error', async () => {
      (listGhosts as jest.Mock).mockRejectedValue(new Error('DB failure'));
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts`,
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(500);
    });
  });

  // ── POST /accounts/:id/ghosts/:ghostId/unfollow ────────────────────────────

  describe('POST /api/v1/accounts/:id/ghosts/:ghostId/unfollow', () => {
    it('returns 200 with success:true on successful unfollow', async () => {
      (unfollowGhost as jest.Mock).mockResolvedValue(undefined);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/unfollow`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json<{ success: boolean }>().success).toBe(true);
      expect(unfollowGhost).toHaveBeenCalledWith(TEST_USER_ID, ACCOUNT_ID, GHOST_ID);
    });

    it('returns 429 when daily cap of 10 is reached', async () => {
      (unfollowGhost as jest.Mock).mockRejectedValue(new DailyCapReachedError());

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/unfollow`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(429);
      const body = res.json<{ code: string; upgrade_url: string }>();
      expect(body.code).toBe('daily_limit_reached');
      expect(body.upgrade_url).toBe('/pricing');
    });

    it('returns 404 if ghost does not exist', async () => {
      (unfollowGhost as jest.Mock).mockRejectedValue(new GhostNotFoundError());

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/unfollow`,
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 409 if ghost is already removed', async () => {
      (unfollowGhost as jest.Mock).mockRejectedValue(new GhostAlreadyRemovedError());

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/unfollow`,
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(409);
    });

    it('returns 403 with TIER5_PROTECTED for Tier 5 ghosts', async () => {
      (unfollowGhost as jest.Mock).mockRejectedValue(new Tier5ProtectedError());

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/unfollow`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(403);
      expect(res.json<{ code: string }>().code).toBe('TIER5_PROTECTED');
    });

    it('returns 401 when Instagram session is expired', async () => {
      (unfollowGhost as jest.Mock).mockRejectedValue(new SessionExpiredError());

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/unfollow`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(401);
      expect(res.json<{ code: string }>().code).toBe('SESSION_EXPIRED');
    });

    it('returns 429 when Instagram rate limits the unfollow', async () => {
      (unfollowGhost as jest.Mock).mockRejectedValue(new InstagramRateLimitError());

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/unfollow`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(429);
      expect(res.json<{ code: string }>().code).toBe('INSTAGRAM_RATE_LIMIT');
    });

    it('returns 403 when account belongs to different user', async () => {
      (unfollowGhost as jest.Mock).mockRejectedValue(new GhostAccountNotFoundError());

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/unfollow`,
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 500 on unexpected error', async () => {
      (unfollowGhost as jest.Mock).mockRejectedValue(new Error('DB failure'));

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/accounts/${ACCOUNT_ID}/ghosts/${GHOST_ID}/unfollow`,
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(500);
    });
  });

  // ── GET /accounts/:id/stats ─────────────────────────────────────────────────

  describe('GET /api/v1/accounts/:id/stats', () => {
    it('returns 200 with stats and tier breakdown', async () => {
      (getAccountStats as jest.Mock).mockResolvedValue(MOCK_STATS);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/stats`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<typeof MOCK_STATS>();
      expect(body.followersCount).toBe(1000);
      expect(body.ghostCount).toBe(87);
      expect(body.tierBreakdown.tier1).toBe(45);
    });

    it('returns 403 when account belongs to different user', async () => {
      (getAccountStats as jest.Mock).mockRejectedValue(new GhostAccountNotFoundError());

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/stats`,
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 500 on unexpected error', async () => {
      (getAccountStats as jest.Mock).mockRejectedValue(new Error('DB failure'));

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/accounts/${ACCOUNT_ID}/stats`,
        headers: AUTH_HEADERS,
      });
      expect(res.statusCode).toBe(500);
    });
  });
});
