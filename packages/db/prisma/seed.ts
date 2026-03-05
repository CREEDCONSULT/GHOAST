/**
 * Ghoast — Dev Database Seed
 *
 * Creates 3 users (Free, Pro, Pro+) each with a linked Instagram account
 * and ghost records spread across all 5 tiers. Designed for local testing
 * without real Instagram or Stripe integrations.
 *
 * Usage:
 *   npm run db:seed          (from monorepo root)
 *   ts-node prisma/seed.ts   (from packages/db directly)
 *
 * Login credentials for all seed users: Password123!
 *
 * SECURITY: Seed data only — never run against production database.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createCipheriv, randomBytes } from 'crypto';

const prisma = new PrismaClient();

// ── Encryption helper (mirrors apps/api/src/lib/encryption.ts) ───────────────
// Uses the SESSION_TOKEN_ENCRYPTION_KEY from .env
function encryptSessionToken(plaintext: string): { encrypted: string; iv: string } {
  const keyHex = process.env.SESSION_TOKEN_ENCRYPTION_KEY;
  if (!keyHex) throw new Error('SESSION_TOKEN_ENCRYPTION_KEY not set in environment');
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { encrypted: encrypted.toString('hex'), iv: iv.toString('hex') };
}

// ── Ghost definitions spread across all 5 tiers ───────────────────────────────
// Scores are manually calibrated to land in the correct tier range.
// All score dimensions are 0-20; priorityScore is the sum (0-100).
// Tier thresholds: 1=0-20, 2=21-40, 3=41-60, 4=61-80, 5=81-100
const GHOST_TEMPLATES = [
  // ── Tier 1: Safe to Cut (0–20) ─────────────────────────────────────────────
  {
    handle: 'brand_never_followback',
    displayName: 'Brand Corp',
    tier: 1,
    priorityScore: 8,
    accountType: 'BRAND' as const,
    followersCount: 50_000,
    followingCount: 200,
    isVerified: false,
    scoreAccountType: 0,
    scoreRatio: 0,
    scoreEngagement: 0,
    scoreSizeBand: 5,
    scorePostRecency: 3,
    daysInactive: 365,
  },
  {
    handle: 'celeb_no_return',
    displayName: 'Famous Nobody',
    tier: 1,
    priorityScore: 15,
    accountType: 'CELEBRITY' as const,
    followersCount: 500_000,
    followingCount: 100,
    isVerified: true,
    scoreAccountType: 0,
    scoreRatio: 0,
    scoreEngagement: 5,
    scoreSizeBand: 7,
    scorePostRecency: 3,
    daysInactive: 180,
  },
  {
    handle: 'inactive_brand_page',
    displayName: 'Dead Brand',
    tier: 1,
    priorityScore: 4,
    accountType: 'BRAND' as const,
    followersCount: 10_000,
    followingCount: 50,
    isVerified: false,
    scoreAccountType: 0,
    scoreRatio: 0,
    scoreEngagement: 0,
    scoreSizeBand: 2,
    scorePostRecency: 2,
    daysInactive: 400,
  },
  // ── Tier 2: Probably Cut (21–40) ────────────────────────────────────────────
  {
    handle: 'followspam_personal',
    displayName: 'Follow Spammer',
    tier: 2,
    priorityScore: 25,
    accountType: 'PERSONAL' as const,
    followersCount: 100,
    followingCount: 3_000,
    isVerified: false,
    scoreAccountType: 10,
    scoreRatio: 5,
    scoreEngagement: 5,
    scoreSizeBand: 0,
    scorePostRecency: 5,
    daysInactive: 120,
  },
  {
    handle: 'creator_low_engage',
    displayName: 'Low Engagement Creator',
    tier: 2,
    priorityScore: 35,
    accountType: 'CREATOR' as const,
    followersCount: 2_000,
    followingCount: 1_800,
    isVerified: false,
    scoreAccountType: 5,
    scoreRatio: 10,
    scoreEngagement: 5,
    scoreSizeBand: 8,
    scorePostRecency: 7,
    daysInactive: 90,
  },
  // ── Tier 3: Your Call (41–60) ───────────────────────────────────────────────
  {
    handle: 'average_personal_acc',
    displayName: 'Average Joe',
    tier: 3,
    priorityScore: 50,
    accountType: 'PERSONAL' as const,
    followersCount: 800,
    followingCount: 900,
    isVerified: false,
    scoreAccountType: 10,
    scoreRatio: 12,
    scoreEngagement: 10,
    scoreSizeBand: 10,
    scorePostRecency: 8,
    daysInactive: 30,
  },
  {
    handle: 'mutual_connection',
    displayName: 'Mutual Connect',
    tier: 3,
    priorityScore: 55,
    accountType: 'PERSONAL' as const,
    followersCount: 500,
    followingCount: 480,
    isVerified: false,
    scoreAccountType: 10,
    scoreRatio: 14,
    scoreEngagement: 11,
    scoreSizeBand: 10,
    scorePostRecency: 10,
    daysInactive: 14,
  },
  // ── Tier 4: Might Keep (61–80) ──────────────────────────────────────────────
  {
    handle: 'close_personal_friend',
    displayName: 'Close Friend',
    tier: 4,
    priorityScore: 70,
    accountType: 'PERSONAL' as const,
    followersCount: 300,
    followingCount: 310,
    isVerified: false,
    scoreAccountType: 15,
    scoreRatio: 16,
    scoreEngagement: 15,
    scoreSizeBand: 12,
    scorePostRecency: 12,
    daysInactive: 7,
  },
  {
    handle: 'active_niche_creator',
    displayName: 'Active Creator',
    tier: 4,
    priorityScore: 75,
    accountType: 'CREATOR' as const,
    followersCount: 1_500,
    followingCount: 1_200,
    isVerified: false,
    scoreAccountType: 12,
    scoreRatio: 16,
    scoreEngagement: 18,
    scoreSizeBand: 14,
    scorePostRecency: 15,
    daysInactive: 3,
  },
  // ── Tier 5: Keep Following (81–100) — AUTO-PROTECTED, never queued ──────────
  {
    handle: 'best_friend_personal',
    displayName: 'Best Friend',
    tier: 5,
    priorityScore: 90,
    accountType: 'PERSONAL' as const,
    followersCount: 200,
    followingCount: 205,
    isVerified: false,
    scoreAccountType: 20,
    scoreRatio: 18,
    scoreEngagement: 18,
    scoreSizeBand: 14,
    scorePostRecency: 20,
    daysInactive: 1,
  },
  {
    handle: 'family_close_account',
    displayName: 'Family Member',
    tier: 5,
    priorityScore: 95,
    accountType: 'PERSONAL' as const,
    followersCount: 150,
    followingCount: 160,
    isVerified: false,
    scoreAccountType: 20,
    scoreRatio: 20,
    scoreEngagement: 20,
    scoreSizeBand: 18,
    scorePostRecency: 17,
    daysInactive: 0,
  },
] as const;

// ── Seed ghost records for an account ────────────────────────────────────────
async function seedGhosts(
  accountId: string,
  handlePrefix: string,
  igUserIdPrefix: string,
  whitelistTier4: boolean = false,
) {
  const ghosts = [];
  for (let i = 0; i < GHOST_TEMPLATES.length; i++) {
    const t = GHOST_TEMPLATES[i];
    const lastPostDate =
      t.daysInactive > 0
        ? new Date(Date.now() - t.daysInactive * 24 * 60 * 60 * 1000)
        : null;

    const ghost = await prisma.ghost.create({
      data: {
        accountId,
        instagramUserId: `${igUserIdPrefix}-${i + 1}`,
        handle: `${handlePrefix}_${t.handle}`,
        displayName: t.displayName,
        followersCount: t.followersCount,
        followingCount: t.followingCount,
        isVerified: t.isVerified,
        accountType: t.accountType,
        priorityScore: t.priorityScore,
        tier: t.tier,
        scoreAccountType: t.scoreAccountType,
        scoreRatio: t.scoreRatio,
        scoreEngagement: t.scoreEngagement,
        scoreSizeBand: t.scoreSizeBand,
        scorePostRecency: t.scorePostRecency,
        isWhitelisted: whitelistTier4 && t.tier === 4,
        lastPostDate,
      },
    });
    ghosts.push({ ghost, tier: t.tier });
  }
  return ghosts;
}

// ── Main seed ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seeding Ghoast dev database...\n');

  // ── Wipe existing seed data (clean slate) ──────────────────────────────────
  await prisma.unfollowQueueJob.deleteMany();
  await prisma.accountSnapshot.deleteMany();
  await prisma.queueSession.deleteMany();
  await prisma.ghost.deleteMany();
  await prisma.creditTransaction.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.instagramAccount.deleteMany();
  await prisma.user.deleteMany();

  console.log('  Cleared existing data.');

  const PASSWORD_HASH = await bcrypt.hash('Password123!', 12);

  // ── User 1: Free tier ──────────────────────────────────────────────────────
  const freeUser = await prisma.user.create({
    data: {
      email: 'free@ghoast.dev',
      passwordHash: PASSWORD_HASH,
      tier: 'FREE',
      creditBalance: 0,
    },
  });

  const { encrypted: freeEnc, iv: freeIv } = encryptSessionToken('seed-session-token-free-user');
  const freeAccount = await prisma.instagramAccount.create({
    data: {
      userId: freeUser.id,
      instagramUserId: 'ig-free-001',
      handle: 'free_user_ig',
      displayName: 'Free User (Seed)',
      followersCount: 450,
      followingCount: 600,
      sessionTokenEncrypted: freeEnc,
      sessionTokenIv: freeIv,
      lastScannedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  await seedGhosts(freeAccount.id, 'free', 'ig-ghost-free');
  console.log(`  Created Free user: free@ghoast.dev (${GHOST_TEMPLATES.length} ghosts)`);

  // ── User 2: Pro tier ───────────────────────────────────────────────────────
  const proUser = await prisma.user.create({
    data: {
      email: 'pro@ghoast.dev',
      passwordHash: PASSWORD_HASH,
      tier: 'PRO',
      creditBalance: 50,
      stripeCustomerId: 'cus_test_pro_seed',
    },
  });

  const { encrypted: proEnc, iv: proIv } = encryptSessionToken('seed-session-token-pro-user');
  const proAccount = await prisma.instagramAccount.create({
    data: {
      userId: proUser.id,
      instagramUserId: 'ig-pro-001',
      handle: 'pro_user_ig',
      displayName: 'Pro User (Seed)',
      followersCount: 1_200,
      followingCount: 1_800,
      sessionTokenEncrypted: proEnc,
      sessionTokenIv: proIv,
      lastScannedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });

  await prisma.subscription.create({
    data: {
      userId: proUser.id,
      stripeSubscriptionId: 'sub_test_pro_seed',
      stripePriceId: process.env.STRIPE_PRICE_PRO_MONTHLY ?? 'price_pro_seed',
      tier: 'PRO',
      status: 'ACTIVE',
      currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    },
  });

  const proGhosts = await seedGhosts(proAccount.id, 'pro', 'ig-ghost-pro');

  // Queue jobs for Tier 1 and 2 ghosts only (Tier 5 is always protected)
  const proQueueableGhosts = proGhosts.filter((g) => g.tier <= 2);
  for (let i = 0; i < Math.min(3, proQueueableGhosts.length); i++) {
    await prisma.unfollowQueueJob.create({
      data: {
        accountId: proAccount.id,
        ghostId: proQueueableGhosts[i]!.ghost.id,
        bullmqJobId: `seed-bullmq-job-${i + 1}`,
        status: i < 2 ? 'COMPLETED' : 'PENDING',
        creditUsed: i < 2,
        processedAt: i < 2 ? new Date(Date.now() - 60 * 60 * 1000) : null,
      },
    });
  }

  // Today's queue session for the Pro user
  const todayDate = new Date().toISOString().slice(0, 10);
  await prisma.queueSession.create({
    data: {
      accountId: proAccount.id,
      date: todayDate,
      unfolloweCount: 2, // matches schema field name (note: intentional typo in schema)
      rateLimitHits: 0,
    },
  });

  // 7-day snapshots for the Pro account
  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const takenAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const followers = 1_200 + Math.floor(Math.random() * 20 - 5);
    const following = 1_800 - daysAgo * 5;
    await prisma.accountSnapshot.create({
      data: {
        accountId: proAccount.id,
        followersCount: followers,
        followingCount: following,
        ghostCount: GHOST_TEMPLATES.length,
        ratio: parseFloat((followers / following).toFixed(4)),
        takenAt,
      },
    });
  }

  console.log(`  Created Pro user: pro@ghoast.dev (${GHOST_TEMPLATES.length} ghosts, 3 queue jobs, 7 snapshots)`);

  // ── User 3: Pro+ tier ──────────────────────────────────────────────────────
  const proPlusUser = await prisma.user.create({
    data: {
      email: 'proplus@ghoast.dev',
      passwordHash: PASSWORD_HASH,
      tier: 'PRO_PLUS',
      creditBalance: 200,
      stripeCustomerId: 'cus_test_proplus_seed',
    },
  });

  const { encrypted: ppEnc, iv: ppIv } = encryptSessionToken('seed-session-token-proplus-user');
  const proPlusAccount = await prisma.instagramAccount.create({
    data: {
      userId: proPlusUser.id,
      instagramUserId: 'ig-proplus-001',
      handle: 'proplus_user_ig',
      displayName: 'Pro+ User (Seed)',
      followersCount: 5_800,
      followingCount: 3_200,
      sessionTokenEncrypted: ppEnc,
      sessionTokenIv: ppIv,
      lastScannedAt: new Date(),
    },
  });

  await prisma.subscription.create({
    data: {
      userId: proPlusUser.id,
      stripeSubscriptionId: 'sub_test_proplus_seed',
      stripePriceId: process.env.STRIPE_PRICE_PROPLUS_MONTHLY ?? 'price_proplus_seed',
      tier: 'PRO_PLUS',
      status: 'ACTIVE',
      currentPeriodStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
    },
  });

  // Whitelist Tier 4 ghosts (Pro+ feature) to demonstrate whitelist protection
  await seedGhosts(proPlusAccount.id, 'proplus', 'ig-ghost-proplus', true);

  // 14-day snapshots for the Pro+ account (showing growth trend)
  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const takenAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const followers = 5_800 + (13 - daysAgo) * 15 + Math.floor(Math.random() * 30 - 10);
    const following = 3_200 - (13 - daysAgo) * 3;
    await prisma.accountSnapshot.create({
      data: {
        accountId: proPlusAccount.id,
        followersCount: followers,
        followingCount: following,
        ghostCount: GHOST_TEMPLATES.length,
        ratio: parseFloat((followers / following).toFixed(4)),
        takenAt,
      },
    });
  }

  console.log(`  Created Pro+ user: proplus@ghoast.dev (${GHOST_TEMPLATES.length} ghosts, Tier 4 whitelisted, 14 snapshots)`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('  Login credentials (all users):');
  console.log('  ┌─────────────────────────────────────────────────────┐');
  console.log('  │  Email                 │ Tier     │ Password        │');
  console.log('  ├─────────────────────────────────────────────────────┤');
  console.log('  │  free@ghoast.dev       │ FREE     │ Password123!    │');
  console.log('  │  pro@ghoast.dev        │ PRO      │ Password123!    │');
  console.log('  │  proplus@ghoast.dev    │ PRO_PLUS │ Password123!    │');
  console.log('  └─────────────────────────────────────────────────────┘\n');
  console.log('  Ghost tiers seeded per account:');
  console.log('  • Tier 1 (Safe to Cut)     — 3 ghosts  [#FF3E3E]');
  console.log('  • Tier 2 (Probably Cut)    — 2 ghosts  [#FF7A3E]');
  console.log('  • Tier 3 (Your Call)       — 2 ghosts  [#FFD166]');
  console.log('  • Tier 4 (Might Keep)      — 2 ghosts  [#7B4FFF] (whitelisted on Pro+)');
  console.log('  • Tier 5 (Keep Following)  — 2 ghosts  [#00E676] (auto-protected, never queued)');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
