import { z } from 'zod';

export const userTierSchema = z.enum(['FREE', 'PRO', 'PRO_PLUS']);
export const accountTypeSchema = z.enum(['PERSONAL', 'CREATOR', 'BRAND', 'CELEBRITY']);

export const ghostSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  instagramUserId: z.string(),
  handle: z.string(),
  displayName: z.string().nullable(),
  profilePicUrl: z.string().nullable().optional(),
  followersCount: z.number(),
  followingCount: z.number(),
  isVerified: z.boolean(),
  accountType: accountTypeSchema,
  lastPostDate: z.string().nullable(),
  priorityScore: z.number(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  scoreAccountType: z.number(),
  scoreRatio: z.number(),
  scoreEngagement: z.number(),
  scoreSizeBand: z.number(),
  scorePostRecency: z.number(),
  engagementUnknown: z.boolean(),
  isWhitelisted: z.boolean(),
  removedAt: z.string().nullable(),
  firstSeenAt: z.string(),
});

export const ghostListResponseSchema = z.object({
  ghosts: z.array(ghostSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    pages: z.number(),
  }),
  dailyUnfollowCount: z.number(),
  dailyUnfollowCap: z.number(),
});

export const accountStatsResponseSchema = z.object({
  totalGhosts: z.number(),
  removedGhosts: z.number(),
  averagePriorityScore: z.number(),
  tierBreakdown: z.object({
    tier1: z.number(),
    tier2: z.number(),
    tier3: z.number(),
    tier4: z.number(),
    tier5: z.number(),
  }),
  accountType: z.record(accountTypeSchema, z.number()),
});

export const scanStartResponseSchema = z.object({
  scanId: z.string(),
  status: z.literal('started'),
});

export const scanProgressResponseSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'complete', 'error']),
  followingScanned: z.number(),
  followersScanned: z.number(),
  ghostCount: z.number(),
  errorMessage: z.string().optional(),
});

export const queueStartResponseSchema = z.object({
  sessionId: z.string(),
  jobCount: z.number(),
  estimatedCompletionMinutes: z.number(),
});

export type UserTier = z.infer<typeof userTierSchema>;
export type AccountType = z.infer<typeof accountTypeSchema>;
export type GhostResponse = z.infer<typeof ghostSchema>;
export type GhostListResponse = z.infer<typeof ghostListResponseSchema>;
export type AccountStatsResponse = z.infer<typeof accountStatsResponseSchema>;
export type ScanStartResponse = z.infer<typeof scanStartResponseSchema>;
export type ScanProgressResponse = z.infer<typeof scanProgressResponseSchema>;
export type QueueStartResponse = z.infer<typeof queueStartResponseSchema>;
