/**
 * Phase 6 — Queue Routes Integration Tests
 *
 * Tests:
 * - POST /api/v1/queue/start   (202, 400, 429, 403 variants)
 * - POST /api/v1/queue/pause   (200, 403)
 * - POST /api/v1/queue/cancel  (200, 403)
 * - GET  /api/v1/queue/status/:accountId (401, 403)
 * - Auth guard: 401 on all endpoints without Bearer token
 *
 * Strategy:
 * - Mock queue.service.js (service layer)
 * - Mock requireAuth via auth.service mock + prisma.user.findUnique
 * - Mock redis, @ghoast/db, billing.service (required by server.ts imports)
 */

// ── Environment ───────────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-chars-long!!';
process.env.SESSION_TOKEN_ENCRYPTION_KEY = '0'.repeat(64);
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder_for_tests';

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
      subscribe: jest.fn().mockResolvedValue(undefined),
      duplicate: jest.fn().mockReturnValue({
        subscribe: jest.fn().mockResolvedValue(undefined),
        unsubscribe: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        quit: jest.fn().mockResolvedValue('OK'),
      }),
      quit: jest.fn().mockResolvedValue('OK'),
      defineCommand: jest.fn(),
      rateLimit: jest.fn().mockImplementation((_k: string, _t: number, _m: number, _b: number, _c: unknown, cb: (err: null, result: [number, number, boolean]) => void) => {
        cb(null, [1, 60_000, false]);
      }),
      pipeline: jest.fn().mockReturnValue(pipeline),
      multi: jest.fn().mockReturnValue(pipeline),
      sendCommand: jest.fn().mockResolvedValue([1, 60_000]),
    },
    verifyRedisConnection: jest.fn().mockResolvedValue(undefined),
  };
});

// ── Queue service mock ────────────────────────────────────────────────────────
jest.mock('../../src/services/queue.service.js', () => {
  class QueueAccountNotFoundError extends Error {
    constructor() { super('Account not found or does not belong to you.'); this.name = 'QueueAccountNotFoundError'; }
  }
  class QueueTier5RejectedError extends Error {
    constructor() { super('Tier 5 rejected'); this.name = 'QueueTier5RejectedError'; }
  }
  class QueueDailyCapExceededError extends Error {
    constructor() { super('Daily cap exceeded'); this.name = 'QueueDailyCapExceededError'; }
  }
  class QueueAccessDeniedError extends Error {
    constructor() { super('Upgrade required'); this.name = 'QueueAccessDeniedError'; }
  }
  class QueueNotFoundError extends Error {
    constructor() { super('Queue not found'); this.name = 'QueueNotFoundError'; }
  }
  class InsufficientCreditsError extends Error {
    constructor() { super('Insufficient credits'); this.name = 'InsufficientCreditsError'; }
  }
  return {
    startQueue: jest.fn(),
    pauseQueue: jest.fn(),
    cancelQueue: jest.fn(),
    getUnfollowQueue: jest.fn().mockReturnValue({
      addBulk: jest.fn().mockResolvedValue([]),
      pause: jest.fn().mockResolvedValue(undefined),
      getJobs: jest.fn().mockResolvedValue([]),
    }),
    QueueAccountNotFoundError,
    QueueTier5RejectedError,
    QueueDailyCapExceededError,
    QueueAccessDeniedError,
    QueueNotFoundError,
    InsufficientCreditsError,
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
    $disconnect: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── Billing service mock (required because billing routes are registered in server.ts) ──
jest.mock('../../src/services/billing.service.js', () => ({
  createSubscribeCheckout: jest.fn(),
  createCreditPaymentIntent: jest.fn(),
  createPortalSession: jest.fn(),
  handleStripeWebhook: jest.fn(),
  getBalance: jest.fn(),
  consumeCredit: jest.fn(),
  InvalidWebhookSignatureError: class InvalidWebhookSignatureError extends Error {
    constructor() { super('Invalid signature'); this.name = 'InvalidWebhookSignatureError'; }
  },
  UserNotFoundError: class UserNotFoundError extends Error {
    constructor() { super('User not found'); this.name = 'UserNotFoundError'; }
  },
  InsufficientCreditsError: class InsufficientCreditsError extends Error {
    constructor() { super('Insufficient credits'); this.name = 'InsufficientCreditsError'; }
  },
}));

// ── Imports (must come after all jest.mock calls) ─────────────────────────────
import { buildServer } from '../../src/server.js';
import {
  startQueue,
  pauseQueue,
  cancelQueue,
  QueueAccountNotFoundError,
  QueueTier5RejectedError,
  QueueDailyCapExceededError,
  QueueAccessDeniedError,
} from '../../src/services/queue.service.js';
import { prisma } from '@ghoast/db';

// ── Fake data ─────────────────────────────────────────────────────────────────
const TEST_USER_ID = 'test-user-id';
const AUTH_HEADERS = { authorization: 'Bearer valid-test-token' };
const ACCOUNT_ID = 'account-001';
const GHOST_IDS = ['ghost-001', 'ghost-002', 'ghost-003'];

function makeUser(tier: 'FREE' | 'PRO' | 'PRO_PLUS' = 'PRO') {
  return { id: TEST_USER_ID, email: 'test@example.com', tier, creditBalance: 0 };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Queue routes', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(makeUser());
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(makeUser());
  });

  // ── Auth guard (all endpoints) ────────────────────────────────────────────

  describe('Auth guard', () => {
    it('POST /queue/start returns 401 without Bearer token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/start',
        payload: { accountId: ACCOUNT_ID, ghostIds: GHOST_IDS },
      });
      expect(res.statusCode).toBe(401);
    });

    it('POST /queue/pause returns 401 without Bearer token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/pause',
        payload: { accountId: ACCOUNT_ID },
      });
      expect(res.statusCode).toBe(401);
    });

    it('POST /queue/cancel returns 401 without Bearer token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/cancel',
        payload: { accountId: ACCOUNT_ID },
      });
      expect(res.statusCode).toBe(401);
    });

    it('GET /queue/status/:accountId returns 401 without Bearer token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/queue/status/${ACCOUNT_ID}`,
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── POST /queue/start ─────────────────────────────────────────────────────

  describe('POST /api/v1/queue/start', () => {
    it('returns 400 when body is missing required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/start',
        headers: AUTH_HEADERS,
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when ghostIds is empty array', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/start',
        headers: AUTH_HEADERS,
        payload: { accountId: ACCOUNT_ID, ghostIds: [] },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 202 with sessionId, jobCount, and estimatedCompletionMinutes on success', async () => {
      (startQueue as jest.Mock).mockResolvedValue({
        sessionId: 'session-abc',
        jobCount: 3,
        estimatedCompletionMinutes: 5,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/start',
        headers: AUTH_HEADERS,
        payload: { accountId: ACCOUNT_ID, ghostIds: GHOST_IDS },
      });

      expect(res.statusCode).toBe(202);
      const body = res.json<{ sessionId: string; jobCount: number; estimatedCompletionMinutes: number }>();
      expect(body.sessionId).toBe('session-abc');
      expect(body.jobCount).toBe(3);
      expect(body.estimatedCompletionMinutes).toBe(5);
    });

    it('calls startQueue with userId, accountId, and ghostIds', async () => {
      (startQueue as jest.Mock).mockResolvedValue({
        sessionId: 'session-xyz',
        jobCount: 3,
        estimatedCompletionMinutes: 4,
      });

      await app.inject({
        method: 'POST',
        url: '/api/v1/queue/start',
        headers: AUTH_HEADERS,
        payload: { accountId: ACCOUNT_ID, ghostIds: GHOST_IDS },
      });

      expect(startQueue).toHaveBeenCalledWith(TEST_USER_ID, ACCOUNT_ID, GHOST_IDS);
    });

    it('returns 403 when account does not belong to user (QueueAccountNotFoundError)', async () => {
      (startQueue as jest.Mock).mockRejectedValue(new QueueAccountNotFoundError());

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/start',
        headers: AUTH_HEADERS,
        payload: { accountId: 'wrong-account', ghostIds: GHOST_IDS },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json<{ error: string }>().error).toBe('Forbidden');
    });

    it('returns 400 with TIER5_REJECTED code when Tier 5 ghost included', async () => {
      (startQueue as jest.Mock).mockRejectedValue(new QueueTier5RejectedError());

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/start',
        headers: AUTH_HEADERS,
        payload: { accountId: ACCOUNT_ID, ghostIds: GHOST_IDS },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<{ error: string; code: string }>();
      expect(body.error).toBe('Bad Request');
      expect(body.code).toBe('TIER5_REJECTED');
    });

    it('returns 429 with DAILY_CAP_EXCEEDED code when daily cap exceeded', async () => {
      (startQueue as jest.Mock).mockRejectedValue(new QueueDailyCapExceededError());

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/start',
        headers: AUTH_HEADERS,
        payload: { accountId: ACCOUNT_ID, ghostIds: GHOST_IDS },
      });

      expect(res.statusCode).toBe(429);
      const body = res.json<{ error: string; code: string }>();
      expect(body.error).toBe('Too Many Requests');
      expect(body.code).toBe('DAILY_CAP_EXCEEDED');
    });

    it('returns 403 with UPGRADE_REQUIRED code and upgrade_url when no Pro/credits', async () => {
      (startQueue as jest.Mock).mockRejectedValue(new QueueAccessDeniedError());

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/start',
        headers: AUTH_HEADERS,
        payload: { accountId: ACCOUNT_ID, ghostIds: GHOST_IDS },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<{ error: string; code: string; upgrade_url: string }>();
      expect(body.error).toBe('Forbidden');
      expect(body.code).toBe('UPGRADE_REQUIRED');
      expect(body.upgrade_url).toBe('/pricing');
    });

    it('returns 500 on unexpected service error', async () => {
      (startQueue as jest.Mock).mockRejectedValue(new Error('Database connection lost'));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/start',
        headers: AUTH_HEADERS,
        payload: { accountId: ACCOUNT_ID, ghostIds: GHOST_IDS },
      });

      expect(res.statusCode).toBe(500);
    });
  });

  // ── POST /queue/pause ─────────────────────────────────────────────────────

  describe('POST /api/v1/queue/pause', () => {
    it('returns 400 when body is missing accountId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/pause',
        headers: AUTH_HEADERS,
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 200 with success:true on success', async () => {
      (pauseQueue as jest.Mock).mockResolvedValue(undefined);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/pause',
        headers: AUTH_HEADERS,
        payload: { accountId: ACCOUNT_ID },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json<{ success: boolean }>().success).toBe(true);
      expect(pauseQueue).toHaveBeenCalledWith(TEST_USER_ID, ACCOUNT_ID);
    });

    it('returns 403 when account not found', async () => {
      (pauseQueue as jest.Mock).mockRejectedValue(new QueueAccountNotFoundError());

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/pause',
        headers: AUTH_HEADERS,
        payload: { accountId: 'wrong-account' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns 500 on unexpected error', async () => {
      (pauseQueue as jest.Mock).mockRejectedValue(new Error('Redis connection error'));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/pause',
        headers: AUTH_HEADERS,
        payload: { accountId: ACCOUNT_ID },
      });

      expect(res.statusCode).toBe(500);
    });
  });

  // ── POST /queue/cancel ────────────────────────────────────────────────────

  describe('POST /api/v1/queue/cancel', () => {
    it('returns 400 when body is missing accountId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/cancel',
        headers: AUTH_HEADERS,
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 200 with success:true on success', async () => {
      (cancelQueue as jest.Mock).mockResolvedValue(undefined);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/cancel',
        headers: AUTH_HEADERS,
        payload: { accountId: ACCOUNT_ID },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json<{ success: boolean }>().success).toBe(true);
      expect(cancelQueue).toHaveBeenCalledWith(TEST_USER_ID, ACCOUNT_ID);
    });

    it('returns 403 when account not found', async () => {
      (cancelQueue as jest.Mock).mockRejectedValue(new QueueAccountNotFoundError());

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/cancel',
        headers: AUTH_HEADERS,
        payload: { accountId: 'wrong-account' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns 500 on unexpected error', async () => {
      (cancelQueue as jest.Mock).mockRejectedValue(new Error('Redis connection error'));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/queue/cancel',
        headers: AUTH_HEADERS,
        payload: { accountId: ACCOUNT_ID },
      });

      expect(res.statusCode).toBe(500);
    });
  });

  // ── GET /queue/status/:accountId (SSE ownership check) ───────────────────

  describe('GET /api/v1/queue/status/:accountId', () => {
    it('returns 403 when account does not belong to user', async () => {
      // The SSE handler checks ownership before setting up the stream
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/queue/status/other-account-id`,
        headers: AUTH_HEADERS,
      });

      expect(res.statusCode).toBe(403);
      expect(res.json<{ error: string }>().error).toBe('Forbidden');
    });
  });
});
