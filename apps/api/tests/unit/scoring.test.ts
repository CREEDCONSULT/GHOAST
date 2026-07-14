/**
 * Compliant Ghost Scoring — Unit Tests
 * Scores are derived from the user's own Instagram data export (no Instagram API).
 */
import { scoreGhost, scoreToTier } from '../../src/lib/scoring.js';
import type { GhostScoreInput } from '../../src/lib/scoring.js';

const NOW = new Date('2026-07-01T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

function input(overrides: Partial<GhostScoreInput> = {}): GhostScoreInput {
  return {
    likesGiven: 0,
    commentsGiven: 0,
    lastEngagedAt: null,
    isCloseFriend: false,
    followedAt: daysAgo(400), // long-ago follow by default
    engagementDataMissing: false,
    now: NOW,
    ...overrides,
  };
}

describe('scoreToTier', () => {
  it('maps score bands to tiers 1–5', () => {
    expect(scoreToTier(0)).toBe(1);
    expect(scoreToTier(20)).toBe(1);
    expect(scoreToTier(21)).toBe(2);
    expect(scoreToTier(40)).toBe(2);
    expect(scoreToTier(41)).toBe(3);
    expect(scoreToTier(60)).toBe(3);
    expect(scoreToTier(61)).toBe(4);
    expect(scoreToTier(80)).toBe(4);
    expect(scoreToTier(81)).toBe(5);
    expect(scoreToTier(100)).toBe(5);
  });
});

describe('scoreGhost — ranges', () => {
  it('keeps priorityScore within 0–100', () => {
    const maxed = scoreGhost(
      input({ likesGiven: 50, commentsGiven: 50, lastEngagedAt: NOW, isCloseFriend: true, followedAt: NOW }),
    );
    expect(maxed.priorityScore).toBeGreaterThanOrEqual(0);
    expect(maxed.priorityScore).toBeLessThanOrEqual(100);
  });

  it('each dimension stays within its band', () => {
    const s = scoreGhost(input({ likesGiven: 100, commentsGiven: 100, isCloseFriend: true, lastEngagedAt: NOW }));
    expect(s.scoreEngagement).toBeLessThanOrEqual(35);
    expect(s.scoreEngagementRecency).toBeLessThanOrEqual(10);
    expect(s.scoreCloseFriend).toBeLessThanOrEqual(25);
    expect(s.scoreFollowRecency).toBeLessThanOrEqual(20);
    expect(s.scoreReciprocity).toBeLessThanOrEqual(10);
  });
});

describe('scoreGhost — behavior', () => {
  it('a long-ago follow with zero engagement is Tier 1 (Safe to Cut)', () => {
    const s = scoreGhost(input());
    expect(s.tier).toBe(1);
    expect(s.priorityScore).toBeLessThanOrEqual(20);
  });

  it('a close friend is protected into a high tier', () => {
    const s = scoreGhost(input({ isCloseFriend: true }));
    expect(s.scoreCloseFriend).toBe(25);
    expect(s.tier).toBeGreaterThanOrEqual(2);
  });

  it('heavy recent engagement pushes toward Keep', () => {
    const s = scoreGhost(
      input({ likesGiven: 8, commentsGiven: 3, lastEngagedAt: daysAgo(5), followedAt: daysAgo(10) }),
    );
    expect(s.scoreEngagement).toBe(35);
    expect(s.scoreEngagementRecency).toBe(10);
    expect(s.tier).toBeGreaterThanOrEqual(4);
  });

  it('a recent follow gets benefit of the doubt vs an old one', () => {
    const recent = scoreGhost(input({ followedAt: daysAgo(7) }));
    const old = scoreGhost(input({ followedAt: daysAgo(500) }));
    expect(recent.scoreFollowRecency).toBeGreaterThan(old.scoreFollowRecency);
    expect(recent.priorityScore).toBeGreaterThan(old.priorityScore);
  });

  it('flags engagementUnknown only when data was missing AND no engagement recorded', () => {
    expect(scoreGhost(input({ engagementDataMissing: true })).engagementUnknown).toBe(true);
    expect(scoreGhost(input({ engagementDataMissing: false })).engagementUnknown).toBe(false);
    // engagement present → not unknown even if the flag says data was partial
    expect(
      scoreGhost(input({ engagementDataMissing: true, likesGiven: 2 })).engagementUnknown,
    ).toBe(false);
  });

  it('does not fabricate engagement — zero likes/comments scores 0 on that dimension', () => {
    const s = scoreGhost(input({ likesGiven: 0, commentsGiven: 0 }));
    expect(s.scoreEngagement).toBe(0);
    expect(s.scoreEngagementRecency).toBe(0);
  });
});
