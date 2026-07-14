/**
 * Ghost Priority Scoring — Compliant Edition
 *
 * Scores are derived ENTIRELY from the user's own Instagram data export
 * (see instagram-export.ts). We never call Instagram and never see the target
 * account's follower counts, post recency, or verification, so scoring is built
 * on signals the export actually provides:
 *
 *   1. Engagement volume     (0–35) — how many of their posts you liked/commented on
 *   2. Engagement recency    (0–10) — how recently you last engaged with them
 *   3. Close friend          (0–25) — are they on your Close Friends list
 *   4. Follow recency        (0–20) — recently followed = give them time; long ago = safe to cut
 *   5. Reciprocity context   (0–10) — reserved contextual signal
 *
 * priorityScore = sum (0–100). HIGHER = stronger reason to KEEP, matching the tier
 * colors (Tier 1 "Safe to Cut" … Tier 5 "Keep Following").
 *
 * SECURITY: scores are server-derived — never accept priorityScore or tier as user input.
 */

export interface GhostScoreInput {
  /** number of this account's posts the user liked (from liked_posts.json) */
  likesGiven: number;
  /** number of comments the user left on this account (from post_comments) */
  commentsGiven: number;
  /** most recent like/comment the user gave them, if known */
  lastEngagedAt: Date | null;
  /** true if the account is on the user's Close Friends list */
  isCloseFriend: boolean;
  /** when the user followed this account (from following.json timestamp) */
  followedAt: Date | null;
  /**
   * true when the upload did not include likes/comments data, so engagement is
   * genuinely unknown rather than zero. Drives an honest "engagement unknown" UI badge.
   */
  engagementDataMissing: boolean;
  /** reference time for recency math; defaults to now(). Injectable for tests. */
  now?: Date;
}

export interface GhostScore {
  priorityScore: number; // 0–100
  tier: number; // 1–5
  scoreEngagement: number; // 0–35
  scoreEngagementRecency: number; // 0–10
  scoreCloseFriend: number; // 0–25
  scoreFollowRecency: number; // 0–20
  scoreReciprocity: number; // 0–10
  engagementUnknown: boolean;
}

const DAY_MS = 1000 * 60 * 60 * 24;

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / DAY_MS;
}

/**
 * Dimension 1 — Engagement volume (0–35).
 * Every like/comment is a signal you value this account. Comments weigh more than likes.
 * Saturates so a handful of interactions already marks them a keeper.
 */
function scoreEngagementVolume(input: GhostScoreInput): number {
  const weighted = input.likesGiven + input.commentsGiven * 3;
  if (weighted <= 0) return 0;
  // 1 interaction ≈ 12, 2 ≈ 20, 4 ≈ 30, 6+ ≈ 35
  return Math.min(35, Math.round(35 * (1 - Math.exp(-weighted / 3))));
}

/**
 * Dimension 2 — Engagement recency (0–10).
 * Recent engagement is a stronger keep signal than old engagement.
 */
function scoreEngagementRecency(input: GhostScoreInput, now: Date): number {
  if (!input.lastEngagedAt) return 0;
  const days = daysBetween(now, input.lastEngagedAt);
  if (days <= 30) return 10;
  if (days <= 90) return 7;
  if (days <= 180) return 4;
  if (days <= 365) return 2;
  return 0;
}

/**
 * Dimension 3 — Close friend (0–25).
 * On the Close Friends list = you deliberately curated them. Strong keep.
 */
function scoreCloseFriend(input: GhostScoreInput): number {
  return input.isCloseFriend ? 25 : 0;
}

/**
 * Dimension 4 — Follow recency (0–20).
 * If you just followed them, they haven't had a fair chance to follow back — give benefit of
 * the doubt (high = keep). If you followed long ago and they never reciprocated, it's safe to cut (low).
 */
function scoreFollowRecency(input: GhostScoreInput, now: Date): number {
  if (!input.followedAt) return 8; // unknown follow date — neutral-ish
  const days = daysBetween(now, input.followedAt);
  if (days <= 14) return 20; // just followed
  if (days <= 45) return 15;
  if (days <= 120) return 9;
  if (days <= 365) return 4;
  return 0; // followed over a year ago, still no follow-back
}

/**
 * Dimension 5 — Reciprocity context (0–10).
 * Reserved for cross-referenced reciprocity signals. Currently a small floor so a ghost you
 * clearly engage with never drops to an absolute zero by rounding alone. Kept explicit so the
 * dimension is visible and easy to enrich later (e.g. mutual-list overlap).
 */
function scoreReciprocity(input: GhostScoreInput): number {
  if (input.isCloseFriend || input.likesGiven + input.commentsGiven > 0) return 5;
  return 0;
}

/**
 * Maps a priority score (0–100) to a tier (1–5). Tiers per CLAUDE.md Ghost Tier Reference.
 */
export function scoreToTier(score: number): number {
  if (score <= 20) return 1; // Safe to Cut
  if (score <= 40) return 2; // Probably Cut
  if (score <= 60) return 3; // Your Call
  if (score <= 80) return 4; // Might Keep
  return 5; // Keep Following
}

/**
 * Compute the full compliant ghost score from export-derived signals.
 */
export function scoreGhost(input: GhostScoreInput): GhostScore {
  const now = input.now ?? new Date();

  const scoreEngagement = scoreEngagementVolume(input);
  const scoreEngagementRecency_ = scoreEngagementRecency(input, now);
  const scoreCloseFriend_ = scoreCloseFriend(input);
  const scoreFollowRecency_ = scoreFollowRecency(input, now);
  const scoreReciprocity_ = scoreReciprocity(input);

  const priorityScore = Math.min(
    100,
    scoreEngagement +
      scoreEngagementRecency_ +
      scoreCloseFriend_ +
      scoreFollowRecency_ +
      scoreReciprocity_,
  );

  return {
    priorityScore,
    tier: scoreToTier(priorityScore),
    scoreEngagement,
    scoreEngagementRecency: scoreEngagementRecency_,
    scoreCloseFriend: scoreCloseFriend_,
    scoreFollowRecency: scoreFollowRecency_,
    scoreReciprocity: scoreReciprocity_,
    // Engagement is only "unknown" when the user didn't upload likes/comments AND there is no
    // engagement recorded — otherwise a zero is a real, informative zero.
    engagementUnknown: input.engagementDataMissing && input.likesGiven + input.commentsGiven === 0,
  };
}
