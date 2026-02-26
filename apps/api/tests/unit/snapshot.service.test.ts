/**
 * Phase 7 — Snapshot Service Unit Tests
 *
 * Tests:
 * - takeSnapshot: ratio calculation, zero-followers edge case, account not found
 * - getSnapshots: PRO gets max 30, PRO_PLUS gets all, ownership enforced
 * - runDailySnapshots: snapshots all Pro/Pro+ accounts, per-account errors don't stop run
 *
 * Strategy:
 * - Mock @ghoast/db (prisma)
 * - Mock logger to silence output
 */

// ── DB mock ───────────────────────────────────────────────────────────────────
jest.mock('@ghoast/db', () => ({
  prisma: {
    instagramAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    ghost: {
      count: jest.fn(),
    },
    accountSnapshot: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $disconnect: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── Logger mock ───────────────────────────────────────────────────────────────
jest.mock('../../src/lib/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import {
  takeSnapshot,
  getSnapshots,
  runDailySnapshots,
  SnapshotAccountNotFoundError,
} from '../../src/services/snapshot.service.js';
import { prisma } from '@ghoast/db';

// ── Fake data ─────────────────────────────────────────────────────────────────
const ACCOUNT_ID = 'account-cuid-001';
const USER_ID = 'user-cuid-001';

const MOCK_SNAPSHOT = {
  id: 'snap-cuid-001',
  accountId: ACCOUNT_ID,
  followersCount: 1000,
  followingCount: 800,
  ghostCount: 42,
  ratio: 0.8,
  takenAt: new Date('2024-01-15T00:00:00Z'),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('takeSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a snapshot with correct ratio (2 decimal places)', async () => {
    (prisma.instagramAccount.findUnique as jest.Mock).mockResolvedValue({
      followersCount: 1000,
      followingCount: 800,
    });
    (prisma.ghost.count as jest.Mock).mockResolvedValue(42);
    (prisma.accountSnapshot.create as jest.Mock).mockResolvedValue(MOCK_SNAPSHOT);

    const result = await takeSnapshot(ACCOUNT_ID);

    expect(prisma.accountSnapshot.create).toHaveBeenCalledWith({
      data: {
        accountId: ACCOUNT_ID,
        followersCount: 1000,
        followingCount: 800,
        ghostCount: 42,
        ratio: 0.8, // 800 / 1000 = 0.8
      },
    });
    expect(result).toEqual(MOCK_SNAPSHOT);
  });

  it('rounds ratio to 2 decimal places (1/3 → 0.33)', async () => {
    (prisma.instagramAccount.findUnique as jest.Mock).mockResolvedValue({
      followersCount: 300,
      followingCount: 100,
    });
    (prisma.ghost.count as jest.Mock).mockResolvedValue(0);
    (prisma.accountSnapshot.create as jest.Mock).mockResolvedValue({
      ...MOCK_SNAPSHOT,
      followersCount: 300,
      followingCount: 100,
      ratio: 0.33,
    });

    await takeSnapshot(ACCOUNT_ID);

    expect(prisma.accountSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ratio: 0.33 }) }),
    );
  });

  it('sets ratio to 0 when followersCount is 0 (no division by zero)', async () => {
    (prisma.instagramAccount.findUnique as jest.Mock).mockResolvedValue({
      followersCount: 0,
      followingCount: 500,
    });
    (prisma.ghost.count as jest.Mock).mockResolvedValue(0);
    (prisma.accountSnapshot.create as jest.Mock).mockResolvedValue({
      ...MOCK_SNAPSHOT,
      followersCount: 0,
      followingCount: 500,
      ghostCount: 0,
      ratio: 0,
    });

    await takeSnapshot(ACCOUNT_ID);

    expect(prisma.accountSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ratio: 0 }) }),
    );
  });

  it('counts only active (non-removed) ghosts', async () => {
    (prisma.instagramAccount.findUnique as jest.Mock).mockResolvedValue({
      followersCount: 1000,
      followingCount: 800,
    });
    (prisma.ghost.count as jest.Mock).mockResolvedValue(10);
    (prisma.accountSnapshot.create as jest.Mock).mockResolvedValue(MOCK_SNAPSHOT);

    await takeSnapshot(ACCOUNT_ID);

    expect(prisma.ghost.count).toHaveBeenCalledWith({
      where: { accountId: ACCOUNT_ID, removedAt: null },
    });
  });

  it('throws SnapshotAccountNotFoundError when account does not exist', async () => {
    (prisma.instagramAccount.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(takeSnapshot('non-existent-id')).rejects.toBeInstanceOf(
      SnapshotAccountNotFoundError,
    );
  });
});

// ── getSnapshots ──────────────────────────────────────────────────────────────

describe('getSnapshots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws SnapshotAccountNotFoundError when account does not belong to user', async () => {
    (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(getSnapshots(USER_ID, ACCOUNT_ID, 'PRO')).rejects.toBeInstanceOf(
      SnapshotAccountNotFoundError,
    );
  });

  it('limits to 30 snapshots for PRO tier', async () => {
    (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue({ id: ACCOUNT_ID });
    (prisma.accountSnapshot.findMany as jest.Mock).mockResolvedValue([MOCK_SNAPSHOT]);

    await getSnapshots(USER_ID, ACCOUNT_ID, 'PRO');

    expect(prisma.accountSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: ACCOUNT_ID },
        orderBy: { takenAt: 'desc' },
        take: 30,
      }),
    );
  });

  it('returns all snapshots (no limit) for PRO_PLUS tier', async () => {
    (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue({ id: ACCOUNT_ID });
    (prisma.accountSnapshot.findMany as jest.Mock).mockResolvedValue([MOCK_SNAPSHOT]);

    await getSnapshots(USER_ID, ACCOUNT_ID, 'PRO_PLUS');

    const call = (prisma.accountSnapshot.findMany as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(call).not.toHaveProperty('take');
    expect(call.orderBy).toEqual({ takenAt: 'desc' });
  });

  it('verifies account ownership using userId in query', async () => {
    (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue({ id: ACCOUNT_ID });
    (prisma.accountSnapshot.findMany as jest.Mock).mockResolvedValue([]);

    await getSnapshots(USER_ID, ACCOUNT_ID, 'PRO');

    expect(prisma.instagramAccount.findFirst).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID, userId: USER_ID },
      select: { id: true },
    });
  });

  it('returns the snapshot array from the service', async () => {
    (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue({ id: ACCOUNT_ID });
    (prisma.accountSnapshot.findMany as jest.Mock).mockResolvedValue([MOCK_SNAPSHOT]);

    const result = await getSnapshots(USER_ID, ACCOUNT_ID, 'PRO');

    expect(result).toEqual([MOCK_SNAPSHOT]);
  });
});

// ── runDailySnapshots ─────────────────────────────────────────────────────────

describe('runDailySnapshots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns { succeeded: 0, failed: 0, total: 0 } when no Pro accounts exist', async () => {
    (prisma.instagramAccount.findMany as jest.Mock).mockResolvedValue([]);

    const result = await runDailySnapshots();

    expect(result).toEqual({ succeeded: 0, failed: 0, total: 0 });
  });

  it('queries only Pro/Pro+ accounts with pendingDisconnect: false', async () => {
    (prisma.instagramAccount.findMany as jest.Mock).mockResolvedValue([]);

    await runDailySnapshots();

    expect(prisma.instagramAccount.findMany).toHaveBeenCalledWith({
      where: {
        user: { tier: { in: ['PRO', 'PRO_PLUS'] } },
        pendingDisconnect: false,
      },
      select: { id: true },
    });
  });

  it('increments succeeded for each successful snapshot', async () => {
    (prisma.instagramAccount.findMany as jest.Mock).mockResolvedValue([
      { id: 'acc-1' },
      { id: 'acc-2' },
    ]);
    // takeSnapshot internally calls findUnique, ghost.count, accountSnapshot.create
    (prisma.instagramAccount.findUnique as jest.Mock).mockResolvedValue({
      followersCount: 1000,
      followingCount: 800,
    });
    (prisma.ghost.count as jest.Mock).mockResolvedValue(0);
    (prisma.accountSnapshot.create as jest.Mock).mockResolvedValue(MOCK_SNAPSHOT);

    const result = await runDailySnapshots();

    expect(result).toEqual({ succeeded: 2, failed: 0, total: 2 });
  });

  it('increments failed for accounts that throw and continues remaining accounts', async () => {
    (prisma.instagramAccount.findMany as jest.Mock).mockResolvedValue([
      { id: 'acc-fail' },
      { id: 'acc-ok' },
    ]);
    // First account: findUnique returns null → SnapshotAccountNotFoundError
    // Second account: succeeds
    (prisma.instagramAccount.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ followersCount: 500, followingCount: 400 });
    (prisma.ghost.count as jest.Mock).mockResolvedValue(5);
    (prisma.accountSnapshot.create as jest.Mock).mockResolvedValue(MOCK_SNAPSHOT);

    const result = await runDailySnapshots();

    expect(result).toEqual({ succeeded: 1, failed: 1, total: 2 });
  });

  it('takes snapshots for all accounts even when some fail', async () => {
    const accountIds = ['acc-1', 'acc-2', 'acc-3'];
    (prisma.instagramAccount.findMany as jest.Mock).mockResolvedValue(
      accountIds.map((id) => ({ id })),
    );
    // All fail (findUnique returns null)
    (prisma.instagramAccount.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await runDailySnapshots();

    expect(result).toEqual({ succeeded: 0, failed: 3, total: 3 });
    // Should have attempted findUnique for each account
    expect(prisma.instagramAccount.findUnique).toHaveBeenCalledTimes(3);
  });
});
