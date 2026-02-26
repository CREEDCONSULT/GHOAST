/**
 * Ghost Priority Scoring Algorithm
 * 5 dimensions × 20 points each = 100 max
 * Spec: REQUIREMENTS.md F003 and CLAUDE.md Ghost Tier Reference
 *
 * SECURITY: scores are server-derived — never accept priority_score or tier as user input.
 */

import type { AccountType } from '@ghoast/db';

export interface GhostData {
  followersCount: number;
  followingCount: number;
  isVerified: boolean;
  accountType: AccountType;
  lastPostDate: Date | null;
  // Ghoast user's engagement with this ghost's posts in last 90 days
  userEngagedRecently: boolean | null; // null = unknown (data unavailable)
}

export interface GhostScore {
  priorityScore: number; // 0–100
  tier: number; // 1–5
  scoreAccountType: number; // 0–20
  scoreRatio: number; // 0–20
  scoreEngagement: number; // 0–20
  scoreSizeBand: number; // 0–20
  scorePostRecency: number; // 0–20
  engagementUnknown: boolean;
}

/**
 * Dimension 1 — Account Type Classification (0–20)
 * Personal: 0–5 | Creator: 5–12 | Brand/Local: 15–18 | Celebrity/Verified: 18–20
 */
function scoreAccountType(data: GhostData): number {
  if (data.isVerified || data.followersCount > 1_000_000) return 19;

  switch (data.accountType) {
    case 'CELEBRITY':
      return 18;
    case 'BRAND':
      return 16;
    case 'CREATOR':
      return 8;
    case 'PERSONAL':
    default:
      return 2;
  }
}

/**
 * Dimension 2 — Follower-to-Following Ratio (0–20)
 * Formula: min(20, floor(their_followers / their_following * 4))
 * Accounts with ratio < 1.0 score 0–3
 */
function scoreFollowerRatio(data: GhostData): number {
  if (data.followingCount === 0) return 20; // follows nobody — clearly not going to follow back
  const ratio = data.followersCount / data.followingCount;
  if (ratio < 1.0) return Math.floor(ratio * 3); // 0–2
  return Math.min(20, Math.floor(ratio * 4));
}

/**
 * Dimension 3 — Engagement Proxy (0–20)
 * Has the Ghoast user liked/commented on this account's posts in the last 90 days?
 * Yes: 17 | No: 0 | Unknown: 0 (with engagementUnknown = true — do NOT fabricate)
 */
function scoreEngagement(data: GhostData): { score: number; unknown: boolean } {
  if (data.userEngagedRecently === null) return { score: 0, unknown: true };
  return { score: data.userEngagedRecently ? 17 : 0, unknown: false };
}

/**
 * Dimension 4 — Account Size Band (0–20)
 * Nano (<1K): 0–3 | Micro (1K–10K): 4–8 | Mid (10K–100K): 9–13
 * Macro (100K–1M): 14–17 | Mega (>1M): 18–20
 */
function scoreSizeBand(data: GhostData): number {
  const f = data.followersCount;
  if (f < 1_000) return 2;
  if (f < 10_000) return 6;
  if (f < 100_000) return 11;
  if (f < 1_000_000) return 15;
  return 19;
}

/**
 * Dimension 5 — Post Recency (0–20)
 * Within 30 days: 0–3 | 30–90 days: 5–10 | 90+ days (dormant): 15–20
 * No posts / private account: 15 (treated as dormant)
 */
function scorePostRecency(data: GhostData): number {
  if (!data.lastPostDate) return 15; // no posts / private = dormant

  const now = new Date();
  const daysSincePost = (now.getTime() - data.lastPostDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSincePost <= 30) return 2;
  if (daysSincePost <= 90) return 7;
  return 17; // dormant
}

/**
 * Maps a priority score (0–100) to a tier (1–5).
 * Tiers per CLAUDE.md Ghost Tier Reference.
 */
export function scoreToTier(score: number): number {
  if (score <= 20) return 1; // Safe to Cut
  if (score <= 40) return 2; // Probably Cut
  if (score <= 60) return 3; // Your Call
  if (score <= 80) return 4; // Might Keep
  return 5; // Keep Following
}

/**
 * Compute the full ghost score from raw account data.
 */
export function scoreGhost(data: GhostData): GhostScore {
  const s1 = scoreAccountType(data);
  const s2 = scoreFollowerRatio(data);
  const { score: s3, unknown: engagementUnknown } = scoreEngagement(data);
  const s4 = scoreSizeBand(data);
  const s5 = scorePostRecency(data);

  const priorityScore = s1 + s2 + s3 + s4 + s5;
  const tier = scoreToTier(priorityScore);

  return {
    priorityScore,
    tier,
    scoreAccountType: s1,
    scoreRatio: s2,
    scoreEngagement: s3,
    scoreSizeBand: s4,
    scorePostRecency: s5,
    engagementUnknown,
  };
}
