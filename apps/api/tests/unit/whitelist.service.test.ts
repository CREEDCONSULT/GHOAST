/**
 * Phase 8 — Whitelist Service Unit Tests
 *
 * Tests:
 * - addToWhitelist: success, ghost not found, account not found, limit reached, idempotent
 * - removeFromWhitelist: success, ghost not found, account not found
 * - listWhitelist: returns whitelisted ghosts, account not found
 *
 * Strategy:
 * - Mock @ghoast/db (prisma)
 * - Mock logger to silence output
 */

// ── DB mock ───────────────────────────────────────────────────────────────────
jest.mock('@ghoast/db', () => ({
  prisma: {
    instagramAccount: {
      findFirst: jest.fn(),
    },
    ghost: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
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
  addToWhitelist,
  removeFromWhitelist,
  listWhitelist,
  WhitelistAccountNotFoundError,
  WhitelistGhostNotFoundError,
  WhitelistLimitReachedError,
} from '../../src/services/whitelist.service.js';
import { prisma } from '@ghoast/db';

// ── Fake data ─────────────────────────────────────────────────────────────────
const ACCOUNT_ID = 'account-cuid-001';
const USER_ID = 'user-cuid-001';
const GHOST_ID = 'ghost-cuid-001';

const MOCK_ACCOUNT = { id: ACCOUNT_ID };

const MOCK_GHOST = {
  id: GHOST_ID,
  instagramUserId: '987654321',
  handle: 'ghostuser',
  displayName: 'Ghost User',
  profilePicUrl: null,
  tier: 2,
  priorityScore: 30,
  isWhitelisted: false,
};

const MOCK_WHITELISTED_GHOST = {
  id: GHOST_ID,
  instagramUserId: '987654321',
  handle: 'ghostuser',
  displayName: 'Ghost User',
  profilePicUrl: null,
  tier: 2,
  priorityScore: 30,
  isWhitelisted: true,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Whitelist service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── addToWhitelist ──────────────────────────────────────────────────────────

  describe('addToWhitelist', () => {
    it('adds a ghost to the whitelist and returns ghost data', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(MOCK_ACCOUNT);
      (prisma.ghost.findFirst as jest.Mock).mockResolvedValue(MOCK_GHOST);
      (prisma.ghost.count as jest.Mock).mockResolvedValue(0);
      (prisma.ghost.update as jest.Mock).mockResolvedValue({ ...MOCK_GHOST, isWhitelisted: true });

      const result = await addToWhitelist(USER_ID, ACCOUNT_ID, GHOST_ID);

      expect(result.id).toBe(GHOST_ID);
      expect(result.handle).toBe('ghostuser');
      expect(prisma.ghost.update).toHaveBeenCalledWith({
        where: { id: GHOST_ID },
        data: { isWhitelisted: true },
      });
    });

    it('is idempotent — does not check limit if ghost is already whitelisted', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(MOCK_ACCOUNT);
      (prisma.ghost.findFirst as jest.Mock).mockResolvedValue(MOCK_WHITELISTED_GHOST);
      (prisma.ghost.update as jest.Mock).mockResolvedValue(MOCK_WHITELISTED_GHOST);

      await addToWhitelist(USER_ID, ACCOUNT_ID, GHOST_ID);

      // count should NOT be called for already-whitelisted ghosts
      expect(prisma.ghost.count).not.toHaveBeenCalled();
      expect(prisma.ghost.update).toHaveBeenCalledWith({
        where: { id: GHOST_ID },
        data: { isWhitelisted: true },
      });
    });

    it('throws WhitelistAccountNotFoundError when account does not belong to user', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(addToWhitelist(USER_ID, ACCOUNT_ID, GHOST_ID)).rejects.toThrow(
        WhitelistAccountNotFoundError,
      );
      expect(prisma.ghost.findFirst).not.toHaveBeenCalled();
    });

    it('throws WhitelistGhostNotFoundError when ghost does not exist', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(MOCK_ACCOUNT);
      (prisma.ghost.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(addToWhitelist(USER_ID, ACCOUNT_ID, GHOST_ID)).rejects.toThrow(
        WhitelistGhostNotFoundError,
      );
    });

    it('throws WhitelistLimitReachedError when 500 ghosts are already whitelisted', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(MOCK_ACCOUNT);
      (prisma.ghost.findFirst as jest.Mock).mockResolvedValue(MOCK_GHOST);
      (prisma.ghost.count as jest.Mock).mockResolvedValue(500);

      await expect(addToWhitelist(USER_ID, ACCOUNT_ID, GHOST_ID)).rejects.toThrow(
        WhitelistLimitReachedError,
      );
      expect(prisma.ghost.update).not.toHaveBeenCalled();
    });

    it('WhitelistLimitReachedError has correct limit property', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(MOCK_ACCOUNT);
      (prisma.ghost.findFirst as jest.Mock).mockResolvedValue(MOCK_GHOST);
      (prisma.ghost.count as jest.Mock).mockResolvedValue(500);

      const err = await addToWhitelist(USER_ID, ACCOUNT_ID, GHOST_ID).catch((e) => e);
      expect(err).toBeInstanceOf(WhitelistLimitReachedError);
      expect((err as WhitelistLimitReachedError).limit).toBe(500);
    });
  });

  // ── removeFromWhitelist ─────────────────────────────────────────────────────

  describe('removeFromWhitelist', () => {
    it('removes a ghost from the whitelist', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(MOCK_ACCOUNT);
      (prisma.ghost.findFirst as jest.Mock).mockResolvedValue(MOCK_WHITELISTED_GHOST);
      (prisma.ghost.update as jest.Mock).mockResolvedValue({ ...MOCK_WHITELISTED_GHOST, isWhitelisted: false });

      await removeFromWhitelist(USER_ID, ACCOUNT_ID, GHOST_ID);

      expect(prisma.ghost.update).toHaveBeenCalledWith({
        where: { id: GHOST_ID },
        data: { isWhitelisted: false },
      });
    });

    it('is idempotent — removing a non-whitelisted ghost still calls update', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(MOCK_ACCOUNT);
      (prisma.ghost.findFirst as jest.Mock).mockResolvedValue(MOCK_GHOST); // not whitelisted
      (prisma.ghost.update as jest.Mock).mockResolvedValue(MOCK_GHOST);

      await removeFromWhitelist(USER_ID, ACCOUNT_ID, GHOST_ID);

      expect(prisma.ghost.update).toHaveBeenCalledWith({
        where: { id: GHOST_ID },
        data: { isWhitelisted: false },
      });
    });

    it('throws WhitelistAccountNotFoundError when account does not belong to user', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(removeFromWhitelist(USER_ID, ACCOUNT_ID, GHOST_ID)).rejects.toThrow(
        WhitelistAccountNotFoundError,
      );
    });

    it('throws WhitelistGhostNotFoundError when ghost does not exist', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(MOCK_ACCOUNT);
      (prisma.ghost.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(removeFromWhitelist(USER_ID, ACCOUNT_ID, GHOST_ID)).rejects.toThrow(
        WhitelistGhostNotFoundError,
      );
    });
  });

  // ── listWhitelist ───────────────────────────────────────────────────────────

  describe('listWhitelist', () => {
    it('returns whitelisted ghosts sorted by priority score descending', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(MOCK_ACCOUNT);

      const ghosts = [
        { ...MOCK_WHITELISTED_GHOST, id: 'ghost-1', priorityScore: 80 },
        { ...MOCK_WHITELISTED_GHOST, id: 'ghost-2', priorityScore: 20 },
        { ...MOCK_WHITELISTED_GHOST, id: 'ghost-3', priorityScore: 50 },
      ];
      (prisma.ghost.findMany as jest.Mock).mockResolvedValue(ghosts);

      const result = await listWhitelist(USER_ID, ACCOUNT_ID);

      expect(result.ghosts).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(prisma.ghost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accountId: ACCOUNT_ID, isWhitelisted: true },
          orderBy: { priorityScore: 'desc' },
        }),
      );
    });

    it('returns empty list when no ghosts are whitelisted', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(MOCK_ACCOUNT);
      (prisma.ghost.findMany as jest.Mock).mockResolvedValue([]);

      const result = await listWhitelist(USER_ID, ACCOUNT_ID);

      expect(result.ghosts).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('throws WhitelistAccountNotFoundError when account does not belong to user', async () => {
      (prisma.instagramAccount.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(listWhitelist(USER_ID, ACCOUNT_ID)).rejects.toThrow(
        WhitelistAccountNotFoundError,
      );
      expect(prisma.ghost.findMany).not.toHaveBeenCalled();
    });
  });
});
