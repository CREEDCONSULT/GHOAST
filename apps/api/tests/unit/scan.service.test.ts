/**
 * Phase 3 — Scan Service Unit Tests
 *
 * Tests the ghost scan orchestration logic:
 * - Ghost set computation (following MINUS followers)
 * - Correct scoring and tier assignment
 * - DB upsert calls per ghost
 * - Lock acquisition / ScanAlreadyInProgressError
 * - Error propagation (SessionExpiredError, RateLimitError)
 *
 * Strategy:
 * - Mock @ghoast/db (prisma)
 * - Mock lib/redis
 * - Mock lib/instagram (getFollowing, getFollowers, getUserInfo)
 * - Mock lib/encryption (decrypt returns plaintext)
 * - Mock lib/scoring (scoreGhost) — optional; use real scoring to verify integration
 */

// ── Environment ───────────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-chars-long!!';
process.env.SESSION_TOKEN_ENCRYPTION_KEY = '0'.repeat(64);

// ── Redis mock ────────────────────────────────────────────────────────────────
const mockRedisSubscriber = {
  subscribe: jest.fn().mockResolvedValue(undefined),
  unsubscribe: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
};

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
      del: jest.fn().mockResolvedValue(1),
      publish: jest.fn().mockResolvedValue(0),
      subscribe: jest.fn().mockResolvedValue(undefined),
      duplicate: jest.fn().mockReturnValue(mockRedisSubscriber),
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

// ── DB mock ───────────────────────────────────────────────────────────────────
jest.mock('@ghoast/db', () => ({
  prisma: {
    instagramAccount: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    ghost: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    $disconnect: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── Encryption mock ───────────────────────────────────────────────────────────
jest.mock('../../src/lib/encryption.js', () => ({
  encrypt: jest.fn().mockReturnValue({ encrypted: 'enc', iv: 'iv' }),
  decrypt: jest.fn().mockReturnValue('decrypted-session-token'),
}));

// ── Instagram mock ────────────────────────────────────────────────────────────
jest.mock('../../src/lib/instagram.js', () => ({
  getFollowing: jest.fn(),
  getFollowers: jest.fn(),
  getUserInfo: jest.fn(),
  SessionExpiredError: class SessionExpiredError extends Error {
    constructor() { super('Session expired'); this.name = 'SessionExpiredError'; }
  },
  InstagramRateLimitError: class InstagramRateLimitError extends Error {
    constructor() { super('Rate limit'); this.name = 'InstagramRateLimitError'; }
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import { prisma } from '@ghoast/db';
import { redis } from '../../src/lib/redis.js';
import {
  startScan,
  getScanProgress,
  ScanNotFoundError,
  ScanAlreadyInProgressError,
} from '../../src/services/scan.service.js';
import { getFollowing, getFollowers, getUserInfo, SessionExpiredError } from '../../src/lib/instagram.js';

// ── Fake data ─────────────────────────────────────────────────────────────────
const TEST_USER_ID = 'user-001';
const ACCOUNT_ID = 'account-001';
const IG_USER_ID = 'ig-001';

const MOCK_ACCOUNT = {
  id: ACCOUNT_ID,
  instagramUserId: IG_USER_ID,
  sessionTokenEncrypted: 'encrypted',
  sessionTokenIv: 'iv',
};

const MOCK_GHOST_DETAILS = {
  instagramUserId: 'ghost-ig-001',
  handle: 'ghost_account',
  displayName: 'Ghost',
  profilePicUrl: null,
  isVerified: false,
  isPrivate: false,
  followersCount: 500,
  followingCount: 1000,
  mediaCount: 10,
  lastPostDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
  accountType: 'PERSONAL' as const,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Make getFollowing call onPage with the given users then return.
 */
function mockFollowing(users: { instagramUserId: string; handle: string; displayName: string | null; profilePicUrl: string | null; isVerified: boolean }[]) {
  (getFollowing as jest.Mock).mockImplementation(async (_id, _tok, onPage) => {
    await onPage(users, 0);
  });
}

function mockFollowers(users: { instagramUserId: string; handle: string; displayName: string | null; profilePicUrl: string | null; isVerified: boolean }[]) {
  (getFollowers as jest.Mock).mockImplementation(async (_id, _tok, onPage) => {
    await onPage(users, 0);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('startScan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(MOCK_ACCOUNT);
    (redis.set as jest.Mock).mockResolvedValue('OK'); // lock acquired
    (getUserInfo as jest.Mock).mockResolvedValue(MOCK_GHOST_DETAILS);
  });

  it('throws ScanNotFoundError when account does not exist', async () => {
    (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(startScan(TEST_USER_ID, ACCOUNT_ID)).rejects.toThrow(ScanNotFoundError);
  });

  it('throws ScanAlreadyInProgressError when lock is already held', async () => {
    (redis.set as jest.Mock).mockResolvedValue(null); // NX set returns null when key exists
    await expect(startScan(TEST_USER_ID, ACCOUNT_ID)).rejects.toThrow(ScanAlreadyInProgressError);
  });

  it('returns immediately (202 semantics) without awaiting scan completion', async () => {
    mockFollowing([]);
    mockFollowers([]);
    const start = Date.now();
    await startScan(TEST_USER_ID, ACCOUNT_ID);
    // Should return very quickly — not waiting for pagination
    expect(Date.now() - start).toBeLessThan(200);
  });

  describe('ghost set computation', () => {
    it('correctly computes ghost set as following MINUS followers', async () => {
      // User follows A, B, C. Followers are B, C. Ghost = A.
      mockFollowing([
        { instagramUserId: 'A', handle: 'userA', displayName: null, profilePicUrl: null, isVerified: false },
        { instagramUserId: 'B', handle: 'userB', displayName: null, profilePicUrl: null, isVerified: false },
        { instagramUserId: 'C', handle: 'userC', displayName: null, profilePicUrl: null, isVerified: false },
      ]);
      mockFollowers([
        { instagramUserId: 'B', handle: 'userB', displayName: null, profilePicUrl: null, isVerified: false },
        { instagramUserId: 'C', handle: 'userC', displayName: null, profilePicUrl: null, isVerified: false },
      ]);
      (getUserInfo as jest.Mock).mockResolvedValue({ ...MOCK_GHOST_DETAILS, instagramUserId: 'A', handle: 'userA' });

      await startScan(TEST_USER_ID, ACCOUNT_ID);
      // Allow async scan to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(getUserInfo).toHaveBeenCalledTimes(1);
      expect((getUserInfo as jest.Mock).mock.calls[0]?.[0]).toBe('A');
    });

    it('produces zero ghosts when all following accounts follow back', async () => {
      const mutual = [
        { instagramUserId: 'X', handle: 'x', displayName: null, profilePicUrl: null, isVerified: false },
      ];
      mockFollowing(mutual);
      mockFollowers(mutual);

      await startScan(TEST_USER_ID, ACCOUNT_ID);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(getUserInfo).not.toHaveBeenCalled();
      expect(prisma.ghost.upsert).not.toHaveBeenCalled();
    });

    it('saves ghosts to DB with correct scores and tiers', async () => {
      mockFollowing([{ instagramUserId: 'ghost1', handle: 'ghosty', displayName: null, profilePicUrl: null, isVerified: false }]);
      mockFollowers([]);
      (getUserInfo as jest.Mock).mockResolvedValue({
        ...MOCK_GHOST_DETAILS,
        instagramUserId: 'ghost1',
        handle: 'ghosty',
        followersCount: 50,
        followingCount: 5000,
      });

      await startScan(TEST_USER_ID, ACCOUNT_ID);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(prisma.ghost.upsert).toHaveBeenCalledTimes(1);
      const upsertCall = (prisma.ghost.upsert as jest.Mock).mock.calls[0]?.[0];
      expect(upsertCall.create.accountId).toBe(ACCOUNT_ID);
      expect(upsertCall.create.instagramUserId).toBe('ghost1');
      expect(upsertCall.create.priorityScore).toBeGreaterThanOrEqual(0);
      expect(upsertCall.create.priorityScore).toBeLessThanOrEqual(100);
      expect(upsertCall.create.tier).toBeGreaterThanOrEqual(1);
      expect(upsertCall.create.tier).toBeLessThanOrEqual(5);
    });

    it('updates last_scanned_at on completion', async () => {
      mockFollowing([]);
      mockFollowers([]);

      await startScan(TEST_USER_ID, ACCOUNT_ID);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(prisma.instagramAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ACCOUNT_ID },
          data: expect.objectContaining({ lastScannedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('sets status=error and releases lock when Instagram session expires mid-scan', async () => {
      (getFollowing as jest.Mock).mockRejectedValue(new SessionExpiredError());

      await startScan(TEST_USER_ID, ACCOUNT_ID);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Lock must be released even on error
      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining(ACCOUNT_ID));

      // Progress should reflect error state
      const progressSetCall = (redis.set as jest.Mock).mock.calls.find(
        (call) => call[0].includes('scan:progress') && typeof call[1] === 'string' && call[1].includes('error'),
      );
      expect(progressSetCall).toBeDefined();
    });
  });
});

describe('getScanProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws ScanNotFoundError when account does not belong to user', async () => {
    (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(getScanProgress(TEST_USER_ID, ACCOUNT_ID)).rejects.toThrow(ScanNotFoundError);
  });

  it('returns null when no scan has run', async () => {
    (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue({ id: ACCOUNT_ID });
    (redis.get as jest.Mock).mockResolvedValue(null);
    const result = await getScanProgress(TEST_USER_ID, ACCOUNT_ID);
    expect(result).toBeNull();
  });

  it('returns parsed progress when scan is in progress', async () => {
    (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue({ id: ACCOUNT_ID });
    const stored = { status: 'in_progress', followingScanned: 50, followersScanned: 30, ghostCount: 5 };
    (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(stored));
    const result = await getScanProgress(TEST_USER_ID, ACCOUNT_ID);
    expect(result).toEqual(stored);
  });
});
