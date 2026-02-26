/**
 * Phase 6 — Unfollow Worker Unit Tests
 *
 * Tests the core job processor logic inside createUnfollowWorker:
 * - Tier 5 hard block (belt-and-suspenders — already blocked at service layer)
 * - Already-removed ghost returns success without calling Instagram API
 * - Successful unfollow marks ghost.removedAt
 * - Credit consumed only on success and only when consumeCredit=true
 * - Rate limit hit → moveToDelayed (15-min pause)
 * - 3 consecutive rate limits → moveToDelayed (24h pause) + rate_limit_24h event
 * - SessionExpiredError → publishes session_expired event and rethrows
 * - Account not found → throws with accountId in message
 *
 * Strategy:
 * - Mock BullMQ Worker constructor to capture the processor function
 * - Mock config/queue with 0ms delays so tests don't sleep
 * - Mock prisma, redis, encryption, instagram, billing.service
 * - Call capturedProcessor(job) directly to test the job handler
 */

// ── Environment ───────────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-chars-long!!';
process.env.SESSION_TOKEN_ENCRYPTION_KEY = '0'.repeat(64);
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder_for_tests';

// ── Queue config mock (0ms delays for fast tests) ─────────────────────────────
jest.mock('../../src/config/queue.js', () => ({
  QUEUE_CONFIG: {
    UNFOLLOW_DELAY_MIN_MS: 0,
    UNFOLLOW_DELAY_MAX_MS: 0,
    SESSION_PAUSE_MIN_MS: 0,
    SESSION_PAUSE_MAX_MS: 0,
    RATE_LIMIT_PAUSE_MS: 0,
    RATE_LIMIT_DAILY_THRESHOLD: 3,
    RATE_LIMIT_24H_PAUSE_MS: 0,
    DAILY_CAP_PRO: 150,
    DAILY_CAP_FREE: 10,
    QUEUE_NAME_UNFOLLOW: 'unfollow',
    QUEUE_NAME_SCAN: 'scan',
    QUEUE_NAME_SNAPSHOT: 'snapshot',
  },
  randomDelay: jest.fn().mockReturnValue(0),
  randomSessionPauseTrigger: jest.fn().mockReturnValue(10),
}));

// ── BullMQ mock — captures the processor function ─────────────────────────────
let capturedProcessor: ((job: Record<string, unknown>) => Promise<unknown>) | null = null;

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation((_name: string, processor: (job: Record<string, unknown>) => Promise<unknown>) => {
    capturedProcessor = processor;
    return { on: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };
  }),
  Queue: jest.fn().mockImplementation(() => ({
    addBulk: jest.fn().mockResolvedValue([]),
    pause: jest.fn().mockResolvedValue(undefined),
    getJobs: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ── Redis mock ────────────────────────────────────────────────────────────────
jest.mock('../../src/lib/redis.js', () => ({
  redis: {
    get: jest.fn().mockResolvedValue('0'),
    set: jest.fn().mockResolvedValue('OK'),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    publish: jest.fn().mockResolvedValue(0),
    defineCommand: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
  },
  verifyRedisConnection: jest.fn().mockResolvedValue(undefined),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────
jest.mock('@ghoast/db', () => ({
  prisma: {
    instagramAccount: {
      findFirst: jest.fn(),
    },
    ghost: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    $disconnect: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── Encryption mock ───────────────────────────────────────────────────────────
jest.mock('../../src/lib/encryption.js', () => ({
  decrypt: jest.fn().mockReturnValue('plaintext-session-token'),
  encrypt: jest.fn().mockReturnValue({ encrypted: 'enc', iv: 'iv' }),
}));

// ── Instagram mock ────────────────────────────────────────────────────────────
jest.mock('../../src/lib/instagram.js', () => ({
  unfollowUser: jest.fn().mockResolvedValue(undefined),
  SessionExpiredError: class SessionExpiredError extends Error {
    constructor() { super('Session expired'); this.name = 'SessionExpiredError'; }
  },
  InstagramRateLimitError: class InstagramRateLimitError extends Error {
    constructor() { super('Rate limit'); this.name = 'InstagramRateLimitError'; }
  },
  getFollowing: jest.fn(),
  getFollowers: jest.fn(),
  getUserInfo: jest.fn(),
}));

// ── Billing service mock ──────────────────────────────────────────────────────
jest.mock('../../src/services/billing.service.js', () => ({
  consumeCredit: jest.fn().mockResolvedValue(4),
  getBalance: jest.fn().mockResolvedValue(5),
  createSubscribeCheckout: jest.fn(),
  createCreditPaymentIntent: jest.fn(),
  createPortalSession: jest.fn(),
  handleStripeWebhook: jest.fn(),
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
import { prisma } from '@ghoast/db';
import { redis } from '../../src/lib/redis.js';
import { unfollowUser, SessionExpiredError, InstagramRateLimitError } from '../../src/lib/instagram.js';
import { consumeCredit } from '../../src/services/billing.service.js';
import { createUnfollowWorker } from '../../src/workers/unfollow.worker.js';
import type { UnfollowJobData, UnfollowJobResult } from '../../src/workers/unfollow.worker.js';

// ── Fake data ─────────────────────────────────────────────────────────────────
const ACCOUNT_ID = 'account-001';
const GHOST_ID = 'ghost-001';
const USER_ID = 'user-001';

const MOCK_ACCOUNT = {
  instagramUserId: 'ig-owner-001',
  sessionTokenEncrypted: 'encrypted',
  sessionTokenIv: 'iv',
};

function makeGhost(tier: number = 1, removedAt: Date | null = null) {
  return { instagramUserId: 'ig-ghost-001', tier, removedAt };
}

function makeJobData(overrides: Partial<UnfollowJobData> = {}): UnfollowJobData {
  return {
    accountId: ACCOUNT_ID,
    ghostId: GHOST_ID,
    userId: USER_ID,
    consumeCredit: false,
    ...overrides,
  };
}

function makeJob(data: UnfollowJobData) {
  return {
    id: 'job-001',
    data,
    moveToDelayed: jest.fn().mockResolvedValue(undefined),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Unfollow Worker — processUnfollowJob', () => {
  beforeAll(() => {
    // Calling createUnfollowWorker triggers the BullMQ Worker constructor,
    // which captures the processor function via the mock above.
    createUnfollowWorker();
    expect(capturedProcessor).not.toBeNull();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(MOCK_ACCOUNT);
    (prisma.ghost.findFirst as jest.Mock).mockResolvedValue(makeGhost(1));
    (redis.get as jest.Mock).mockResolvedValue('0');
    (redis.incr as jest.Mock).mockResolvedValue(1);
    (redis.expire as jest.Mock).mockResolvedValue(1);
    (redis.publish as jest.Mock).mockResolvedValue(0);
    (unfollowUser as jest.Mock).mockResolvedValue(undefined);
    (consumeCredit as jest.Mock).mockResolvedValue(4);
  });

  // ── Account not found ────────────────────────────────────────────────────

  describe('Account not found', () => {
    it('throws when account does not exist or does not belong to user', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(null);

      const job = makeJob(makeJobData());
      await expect(capturedProcessor!(job)).rejects.toThrow(`Account ${ACCOUNT_ID}`);
    });

    it('throws when ghost does not exist for the account', async () => {
      (prisma.ghost.findFirst as jest.Mock).mockResolvedValue(null);

      const job = makeJob(makeJobData());
      await expect(capturedProcessor!(job)).rejects.toThrow(`Ghost ${GHOST_ID}`);
    });
  });

  // ── Tier 5 hard block ────────────────────────────────────────────────────

  describe('Tier 5 hard block (belt-and-suspenders)', () => {
    it('throws TIER5_BLOCK when ghost is Tier 5', async () => {
      (prisma.ghost.findFirst as jest.Mock).mockResolvedValue(makeGhost(5));

      const job = makeJob(makeJobData());
      await expect(capturedProcessor!(job)).rejects.toThrow('TIER5_BLOCK');
    });

    it('does NOT block Tier 1 ghosts', async () => {
      (prisma.ghost.findFirst as jest.Mock).mockResolvedValue(makeGhost(1));

      const job = makeJob(makeJobData());
      const result = await capturedProcessor!(job) as UnfollowJobResult;
      expect(result.success).toBe(true);
    });

    it('does NOT block Tier 4 ghosts', async () => {
      (prisma.ghost.findFirst as jest.Mock).mockResolvedValue(makeGhost(4));

      const job = makeJob(makeJobData());
      const result = await capturedProcessor!(job) as UnfollowJobResult;
      expect(result.success).toBe(true);
    });
  });

  // ── Idempotency ──────────────────────────────────────────────────────────

  describe('Idempotency — already-removed ghost', () => {
    it('returns success without calling unfollowUser when ghost.removedAt is set', async () => {
      (prisma.ghost.findFirst as jest.Mock).mockResolvedValue(makeGhost(1, new Date()));

      const job = makeJob(makeJobData());
      const result = await capturedProcessor!(job) as UnfollowJobResult;

      expect(result).toEqual({ success: true, ghostId: GHOST_ID });
      expect(unfollowUser).not.toHaveBeenCalled();
      expect(prisma.ghost.update).not.toHaveBeenCalled();
    });
  });

  // ── Successful unfollow ──────────────────────────────────────────────────

  describe('Successful unfollow', () => {
    it('returns { success: true, ghostId } on success', async () => {
      const job = makeJob(makeJobData());
      const result = await capturedProcessor!(job) as UnfollowJobResult;

      expect(result).toEqual({ success: true, ghostId: GHOST_ID });
    });

    it('marks ghost.removedAt with current timestamp', async () => {
      const before = new Date();
      const job = makeJob(makeJobData());
      await capturedProcessor!(job);

      expect(prisma.ghost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: GHOST_ID },
          data: expect.objectContaining({ removedAt: expect.any(Date) }),
        }),
      );

      const updatedAt: Date = (prisma.ghost.update as jest.Mock).mock.calls[0]![0].data.removedAt;
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('does NOT consume a credit when consumeCredit=false', async () => {
      const job = makeJob(makeJobData({ consumeCredit: false }));
      await capturedProcessor!(job);

      expect(consumeCredit).not.toHaveBeenCalled();
    });

    it('consumes exactly one credit when consumeCredit=true', async () => {
      const job = makeJob(makeJobData({ consumeCredit: true }));
      await capturedProcessor!(job);

      expect(consumeCredit).toHaveBeenCalledWith(USER_ID);
      expect(consumeCredit).toHaveBeenCalledTimes(1);
    });

    it('publishes job_completed event with ghostId and totalRemoved', async () => {
      (redis.incr as jest.Mock).mockResolvedValue(7);

      const job = makeJob(makeJobData());
      await capturedProcessor!(job);

      const publishCalls = (redis.publish as jest.Mock).mock.calls;
      const completedCall = publishCalls.find(
        (c: unknown[]) => typeof c[1] === 'string' && (c[1] as string).includes('job_completed'),
      );
      expect(completedCall).toBeDefined();

      const payload = JSON.parse(completedCall![1] as string);
      expect(payload.type).toBe('job_completed');
      expect(payload.ghostId).toBe(GHOST_ID);
      expect(payload.totalRemoved).toBe(7);
    });

    it('publishes to the correct account-scoped channel', async () => {
      const job = makeJob(makeJobData());
      await capturedProcessor!(job);

      const publishCalls = (redis.publish as jest.Mock).mock.calls;
      const completedCall = publishCalls.find(
        (c: unknown[]) => typeof c[1] === 'string' && (c[1] as string).includes('job_completed'),
      );
      expect(completedCall![0]).toBe(`queue:events:${ACCOUNT_ID}`);
    });
  });

  // ── Rate limit handling ───────────────────────────────────────────────────

  describe('Rate limit handling', () => {
    it('calls job.moveToDelayed on first rate limit hit (15-min pause)', async () => {
      (redis.incr as jest.Mock).mockResolvedValue(1); // 1 hit — below threshold
      (unfollowUser as jest.Mock).mockRejectedValue(new InstagramRateLimitError());

      const job = makeJob(makeJobData());
      await expect(capturedProcessor!(job)).rejects.toBeInstanceOf(InstagramRateLimitError);

      expect(job.moveToDelayed).toHaveBeenCalledTimes(1);
    });

    it('publishes queue_paused with reason=rate_limit on first hit', async () => {
      (redis.incr as jest.Mock).mockResolvedValue(1);
      (unfollowUser as jest.Mock).mockRejectedValue(new InstagramRateLimitError());

      const job = makeJob(makeJobData());
      await expect(capturedProcessor!(job)).rejects.toBeInstanceOf(InstagramRateLimitError);

      const publishedEvents = (redis.publish as jest.Mock).mock.calls
        .filter((c: unknown[]) => typeof c[1] === 'string')
        .map((c: unknown[]) => JSON.parse(c[1] as string));
      const pauseEvent = publishedEvents.find((e: Record<string, unknown>) => e.type === 'queue_paused');

      expect(pauseEvent).toBeDefined();
      expect(pauseEvent.reason).toBe('rate_limit');
    });

    it('calls job.moveToDelayed with 24h pause after 3 consecutive rate limit hits', async () => {
      (redis.incr as jest.Mock).mockResolvedValue(3); // 3 hits — at threshold
      (unfollowUser as jest.Mock).mockRejectedValue(new InstagramRateLimitError());

      const job = makeJob(makeJobData());
      await expect(capturedProcessor!(job)).rejects.toBeInstanceOf(InstagramRateLimitError);

      expect(job.moveToDelayed).toHaveBeenCalledTimes(1);
    });

    it('publishes queue_paused with reason=rate_limit_24h after threshold', async () => {
      (redis.incr as jest.Mock).mockResolvedValue(3);
      (unfollowUser as jest.Mock).mockRejectedValue(new InstagramRateLimitError());

      const job = makeJob(makeJobData());
      await expect(capturedProcessor!(job)).rejects.toBeInstanceOf(InstagramRateLimitError);

      const publishedEvents = (redis.publish as jest.Mock).mock.calls
        .filter((c: unknown[]) => typeof c[1] === 'string')
        .map((c: unknown[]) => JSON.parse(c[1] as string));
      const pauseEvent = publishedEvents.find((e: Record<string, unknown>) => e.reason === 'rate_limit_24h');

      expect(pauseEvent).toBeDefined();
      expect(pauseEvent.type).toBe('queue_paused');
    });

    it('does NOT mark ghost removed or consume credit on rate limit', async () => {
      (redis.incr as jest.Mock).mockResolvedValue(1);
      (unfollowUser as jest.Mock).mockRejectedValue(new InstagramRateLimitError());

      const job = makeJob(makeJobData({ consumeCredit: true }));
      await expect(capturedProcessor!(job)).rejects.toBeInstanceOf(InstagramRateLimitError);

      expect(prisma.ghost.update).not.toHaveBeenCalled();
      expect(consumeCredit).not.toHaveBeenCalled();
    });
  });

  // ── Session expired handling ──────────────────────────────────────────────

  describe('Session expired handling', () => {
    it('publishes session_expired event and rethrows', async () => {
      (unfollowUser as jest.Mock).mockRejectedValue(new SessionExpiredError());

      const job = makeJob(makeJobData());
      await expect(capturedProcessor!(job)).rejects.toBeInstanceOf(SessionExpiredError);

      const publishedEvents = (redis.publish as jest.Mock).mock.calls
        .filter((c: unknown[]) => typeof c[1] === 'string')
        .map((c: unknown[]) => JSON.parse(c[1] as string));
      const expiredEvent = publishedEvents.find((e: Record<string, unknown>) => e.type === 'session_expired');

      expect(expiredEvent).toBeDefined();
      expect(expiredEvent.accountId).toBe(ACCOUNT_ID);
    });

    it('does NOT consume credit when session expires', async () => {
      (unfollowUser as jest.Mock).mockRejectedValue(new SessionExpiredError());

      const job = makeJob(makeJobData({ consumeCredit: true }));
      await expect(capturedProcessor!(job)).rejects.toBeInstanceOf(SessionExpiredError);

      expect(consumeCredit).not.toHaveBeenCalled();
    });

    it('does NOT mark ghost removed when session expires', async () => {
      (unfollowUser as jest.Mock).mockRejectedValue(new SessionExpiredError());

      const job = makeJob(makeJobData());
      await expect(capturedProcessor!(job)).rejects.toBeInstanceOf(SessionExpiredError);

      expect(prisma.ghost.update).not.toHaveBeenCalled();
    });
  });
});
