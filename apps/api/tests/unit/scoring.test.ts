/**
 * Phase 0 — Ghost Scoring Algorithm Unit Tests
 * Verifies all 5 scoring dimensions and tier mapping per REQUIREMENTS.md F003.
 */
import { scoreGhost, scoreToTier } from '../../src/lib/scoring.js';
import type { GhostData } from '../../src/lib/scoring.js';

const baseGhost: GhostData = {
  followersCount: 500,
  followingCount: 500,
  isVerified: false,
  accountType: 'PERSONAL',
  lastPostDate: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000), // 200 days ago
  userEngagedRecently: false,
};

describe('scoreToTier', () => {
  it('maps 0–20 to Tier 1 (Safe to Cut)', () => {
    expect(scoreToTier(0)).toBe(1);
    expect(scoreToTier(10)).toBe(1);
    expect(scoreToTier(20)).toBe(1);
  });

  it('maps 21–40 to Tier 2 (Probably Cut)', () => {
    expect(scoreToTier(21)).toBe(2);
    expect(scoreToTier(40)).toBe(2);
  });

  it('maps 41–60 to Tier 3 (Your Call)', () => {
    expect(scoreToTier(41)).toBe(3);
    expect(scoreToTier(60)).toBe(3);
  });

  it('maps 61–80 to Tier 4 (Might Keep)', () => {
    expect(scoreToTier(61)).toBe(4);
    expect(scoreToTier(80)).toBe(4);
  });

  it('maps 81–100 to Tier 5 (Keep Following)', () => {
    expect(scoreToTier(81)).toBe(5);
    expect(scoreToTier(100)).toBe(5);
  });
});

describe('scoreGhost — priority score range', () => {
  it('returns priorityScore between 0 and 100', () => {
    const result = scoreGhost(baseGhost);
    expect(result.priorityScore).toBeGreaterThanOrEqual(0);
    expect(result.priorityScore).toBeLessThanOrEqual(100);
  });

  it('each dimension score is between 0 and 20', () => {
    const result = scoreGhost(baseGhost);
    expect(result.scoreAccountType).toBeGreaterThanOrEqual(0);
    expect(result.scoreAccountType).toBeLessThanOrEqual(20);
    expect(result.scoreRatio).toBeGreaterThanOrEqual(0);
    expect(result.scoreRatio).toBeLessThanOrEqual(20);
    expect(result.scoreEngagement).toBeGreaterThanOrEqual(0);
    expect(result.scoreEngagement).toBeLessThanOrEqual(20);
    expect(result.scoreSizeBand).toBeGreaterThanOrEqual(0);
    expect(result.scoreSizeBand).toBeLessThanOrEqual(20);
    expect(result.scorePostRecency).toBeGreaterThanOrEqual(0);
    expect(result.scorePostRecency).toBeLessThanOrEqual(20);
  });

  it('priorityScore equals sum of 5 dimension scores', () => {
    const result = scoreGhost(baseGhost);
    const sum =
      result.scoreAccountType +
      result.scoreRatio +
      result.scoreEngagement +
      result.scoreSizeBand +
      result.scorePostRecency;
    expect(result.priorityScore).toBe(sum);
  });
});

describe('Dimension 1 — Account Type', () => {
  it('personal account scores low', () => {
    const result = scoreGhost({ ...baseGhost, accountType: 'PERSONAL', isVerified: false });
    expect(result.scoreAccountType).toBeLessThanOrEqual(5);
  });

  it('brand account scores higher than personal', () => {
    const brand = scoreGhost({ ...baseGhost, accountType: 'BRAND' });
    const personal = scoreGhost({ ...baseGhost, accountType: 'PERSONAL' });
    expect(brand.scoreAccountType).toBeGreaterThan(personal.scoreAccountType);
  });

  it('verified account scores 18+', () => {
    const result = scoreGhost({ ...baseGhost, isVerified: true });
    expect(result.scoreAccountType).toBeGreaterThanOrEqual(18);
  });

  it('mega account (>1M followers) scores 18+', () => {
    const result = scoreGhost({ ...baseGhost, followersCount: 2_000_000 });
    expect(result.scoreAccountType).toBeGreaterThanOrEqual(18);
  });
});

describe('Dimension 2 — Follower/Following Ratio', () => {
  it('accounts with high ratio score higher', () => {
    const highRatio = scoreGhost({ ...baseGhost, followersCount: 10_000, followingCount: 100 });
    const lowRatio = scoreGhost({ ...baseGhost, followersCount: 100, followingCount: 10_000 });
    expect(highRatio.scoreRatio).toBeGreaterThan(lowRatio.scoreRatio);
  });

  it('accounts with ratio < 1.0 score 0–3', () => {
    const result = scoreGhost({ ...baseGhost, followersCount: 100, followingCount: 5000 });
    expect(result.scoreRatio).toBeLessThanOrEqual(3);
  });

  it('maxes out at 20', () => {
    const result = scoreGhost({ ...baseGhost, followersCount: 1_000_000, followingCount: 100 });
    expect(result.scoreRatio).toBeLessThanOrEqual(20);
  });

  it('accounts that follow nobody score 20', () => {
    const result = scoreGhost({ ...baseGhost, followingCount: 0 });
    expect(result.scoreRatio).toBe(20);
  });
});

describe('Dimension 3 — Engagement Proxy', () => {
  it('engaged accounts score 15+', () => {
    const result = scoreGhost({ ...baseGhost, userEngagedRecently: true });
    expect(result.scoreEngagement).toBeGreaterThanOrEqual(15);
  });

  it('non-engaged accounts score 0', () => {
    const result = scoreGhost({ ...baseGhost, userEngagedRecently: false });
    expect(result.scoreEngagement).toBe(0);
  });

  it('unknown engagement scores 0 and sets engagementUnknown=true', () => {
    const result = scoreGhost({ ...baseGhost, userEngagedRecently: null });
    expect(result.scoreEngagement).toBe(0);
    expect(result.engagementUnknown).toBe(true);
  });

  it('does not fabricate engagement score when unknown', () => {
    const result = scoreGhost({ ...baseGhost, userEngagedRecently: null });
    // Must be exactly 0, not any arbitrary value
    expect(result.scoreEngagement).toBe(0);
  });
});

describe('Dimension 4 — Account Size Band', () => {
  it('nano accounts (<1K) score 0–3', () => {
    const result = scoreGhost({ ...baseGhost, followersCount: 500 });
    expect(result.scoreSizeBand).toBeLessThanOrEqual(3);
  });

  it('mega accounts (>1M) score 18+', () => {
    const result = scoreGhost({ ...baseGhost, followersCount: 5_000_000 });
    expect(result.scoreSizeBand).toBeGreaterThanOrEqual(18);
  });
});

describe('Dimension 5 — Post Recency', () => {
  it('recent posts (< 30 days) score 0–3', () => {
    const result = scoreGhost({
      ...baseGhost,
      lastPostDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    });
    expect(result.scorePostRecency).toBeLessThanOrEqual(3);
  });

  it('dormant accounts (90+ days) score 15+', () => {
    const result = scoreGhost({
      ...baseGhost,
      lastPostDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
    });
    expect(result.scorePostRecency).toBeGreaterThanOrEqual(15);
  });

  it('accounts with no posts score 15 (treated as dormant)', () => {
    const result = scoreGhost({ ...baseGhost, lastPostDate: null });
    expect(result.scorePostRecency).toBe(15);
  });
});

describe('Tier 5 — Keep Following (auto-protected)', () => {
  it('a high-value account scores into Tier 5 (81–100)', () => {
    const tier5Ghost: GhostData = {
      followersCount: 2_000_000,      // mega size → high scoreSizeBand
      followingCount: 100,             // high ratio
      isVerified: true,                // verified
      accountType: 'CELEBRITY',
      lastPostDate: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000), // dormant = high recency score
      userEngagedRecently: true,       // engaged
    };
    const result = scoreGhost(tier5Ghost);
    expect(result.tier).toBe(5);
    expect(result.priorityScore).toBeGreaterThanOrEqual(81);
  });
});
