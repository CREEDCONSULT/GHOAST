# GHOAST — SENIOR ENGINEER TECHNICAL REFERENCE MANUAL
**Version 1.0.0 | Build Date: 2026-02-26 | Author: Engineering Lead**

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & User Story](#2-product-vision--user-story)
3. [System Architecture](#3-system-architecture)
4. [Monorepo Structure](#4-monorepo-structure)
5. [Infrastructure & Deployment](#5-infrastructure--deployment)
6. [Database Schema & Data Model](#6-database-schema--data-model)
7. [Authentication & Session Management](#7-authentication--session-management)
8. [Instagram Integration Layer](#8-instagram-integration-layer)
9. [Ghost Scoring Engine](#9-ghost-scoring-engine)
10. [Bulk Unfollow Queue System](#10-bulk-unfollow-queue-system)
11. [API Reference — All Routes](#11-api-reference--all-routes)
12. [Billing & Payment Architecture](#12-billing--payment-architecture)
13. [Frontend Architecture](#13-frontend-architecture)
14. [Design System](#14-design-system)
15. [Security Architecture](#15-security-architecture)
16. [Business Logic Rules](#16-business-logic-rules)
17. [Testing Strategy](#17-testing-strategy)
18. [Feature Requirements Reference](#18-feature-requirements-reference)
19. [Environment Variables Reference](#19-environment-variables-reference)
20. [Known Issues & Open Questions](#20-known-issues--open-questions)
21. [Vocabulary Enforcement](#21-vocabulary-enforcement)
22. [Cross-Platform Architecture Assessment](#22-cross-platform-architecture-assessment)

---

## 1. EXECUTIVE SUMMARY

**Ghoast** (`ghoast.app`) is a freemium Instagram follower intelligence SaaS product. Its singular mission is to identify every Instagram account a user follows that does not follow them back, score and rank those accounts using a five-dimensional algorithm, and provide a controlled, rate-limit-safe bulk unfollow queue engine to remove them in a manner that protects the user's Instagram account from detection or flagging.

The product targets Instagram users aged 18-34 who actively manage their follower ratio — influencers, personal brands, creators, and casual users who care about the symmetry of their social graph. The initial revenue target is $5,000 in Month 1.

### Core Value Proposition

1. **Intelligence:** Ghost scans analyse the full following list and score every non-follower across five dimensions, producing a prioritised ranked list (ghost list) — not a raw dump.
2. **Safety:** All Instagram interactions go through a server-side rate-limit engine that mimics human behaviour precisely — random delays, session pauses, daily caps, and hard stops on rate-limit signals from Instagram.
3. **Control:** Users choose which ghosts to remove. The queue is transparent, pauseable, and cancellable. Tier 5 accounts (high-value, mutual relationships worth keeping) are permanently protected and can never be added to a queue.

### Technical Identity

| Dimension | Decision |
|-----------|----------|
| Backend runtime | Node.js 20 LTS |
| Backend framework | Fastify 5 (TypeScript) |
| Frontend framework | Next.js 16.1.6 (App Router, React 19) |
| Primary database | PostgreSQL 16 |
| Cache/Queue broker | Redis 7 |
| Queue engine | BullMQ |
| ORM | Prisma |
| Payment processor | Stripe |
| Instagram connection | Private API via session cookie |
| Token encryption | AES-256-CBC |
| Auth | JWT (access 24h + refresh 30d) |
| Monorepo tooling | Turborepo + npm workspaces |

---

## 2. PRODUCT VISION & USER STORY

### Primary User Persona

**Jordan, 27, lifestyle creator, 4,200 Instagram followers**

Jordan follows 3,900 accounts. Of those, roughly 1,100 do not follow back. Jordan's follower ratio (following divided by followers) is 0.93 — nearly at parity. Embedded in those 1,100 are 300 brand accounts Jordan followed during campaigns that never followed back, 200 inactive personal accounts with no posts in 12 months, and 50 verified celebrities who are following nobody.

Jordan wants to clean the list but does not want to manually scroll 3,900 accounts. Jordan definitely does not want to get the account flagged by unfollowing 1,100 accounts in an hour.

### The Journey

**Step 1 — Discovery:**
Jordan arrives at ghoast.app via social media or a recommendation. The landing page explains the concept (ghosts = people who do not follow you back), shows the ghost tiers, and has a single hero CTA: "Scan My Account Free."

**Step 2 — Registration:**
Jordan creates a Ghoast account with email and password. After registration, Jordan lands on the dashboard.

**Step 3 — Instagram Connection (F001):**
Jordan taps "Connect Instagram Account." A modal opens containing an embedded web view that loads the real Instagram login page. Jordan logs in normally — Ghoast captures the `sessionid` cookie from the authenticated Instagram session. This cookie is immediately encrypted with AES-256-CBC (32-byte key, random IV per encryption) and stored in PostgreSQL. The plaintext cookie never touches a log, a response body, or any persistent storage.

**Step 4 — Ghost Scan (F002):**
With the account connected, Jordan triggers a ghost scan. The Ghoast server simultaneously fetches Jordan's full following list and full followers list from the Instagram private API, using cursor-based pagination to handle accounts with thousands of entries. The diff algorithm identifies every account in following that is not in followers — these are the ghosts. Each ghost is run through the scoring engine (5 dimensions, 0-100 score, 1-5 tier). Results stream back to the UI in real-time via Server-Sent Events. The scan completes in under 30 seconds for a typical account.

**Step 5 — Ghost List Review (F003):**
The ghost list presents all 1,100 ghosts in Jordan's prioritised order. Tier 1 ("Safe to Cut", red, score 0-20) are at the top — dormant accounts, brands, and celebrities with no reciprocal value. Tier 5 ("Keep Following", green, score 81-100) is at the bottom and is marked auto-protected — Jordan cannot select them for queue. Each row shows: profile avatar, handle, follower count, following count, score, tier badge, and account type tag.

**Step 6 — Queue Execution (F004 / F005):**
Jordan is on the Free tier. The ghost list is visible but the "Start Ghost Queue" button requires a Pro or Pro+ upgrade (or credit pack). Jordan upgrades to Pro ($9.99/mo). Jordan selects 80 Tier 1 and Tier 2 ghosts and starts the queue. The server validates: no Tier 5 in selection, no whitelisted ghosts, daily cap check (150 for Pro). The queue begins. Real-time SSE events update the UI: "Removed @some_brand_account — 79 remaining." The worker uses randomised 8-45 second delays between each unfollow, pausing for 3-7 minutes every 10-15 unfollows to mimic human session behaviour. Jordan can close the browser — the queue runs entirely server-side.

**Step 7 — Completion:**
Two hours later, all 80 unfollows are complete. Jordan's ratio has improved from 0.93 to 0.71. The ghost list shows 1,020 remaining ghosts, each with `removedAt = null`. The 80 removed ghosts have `removedAt` set but remain in the database — the history is preserved.

---

## 3. SYSTEM ARCHITECTURE

### High-Level Architecture Diagram

```
+---------------------------------------------------------------------------+
|                           CLIENT LAYER                                    |
|                                                                           |
|   Browser (Next.js 16 SSR)              Mobile (React Native + Expo)     |
|   -- App Router (React 19)              -- Expo Router                   |
|   -- Tailwind v4 CSS                    -- React Native StyleSheet       |
|   -- SSE EventSource                    -- Push Notifications            |
+-------------------------------+-------------------------------------------+
                                | HTTPS / REST / SSE
+-------------------------------v-------------------------------------------+
|                        API LAYER (Fastify 5)                              |
|                     apps/api -- Port 4000                                 |
|                                                                           |
|  +---------------+  +---------------+  +---------------+                 |
|  | Auth Routes   |  | Account Routes|  | Ghost Routes  |                 |
|  | /api/v1/auth  |  | /api/v1/accts |  | /api/v1/ghsts |                 |
|  +---------------+  +---------------+  +---------------+                 |
|  +---------------+  +---------------+  +---------------+                 |
|  | Queue Routes  |  |Billing Routes |  |Snapshot Routes|                 |
|  | /api/v1/queue |  | /api/v1/bill  |  | /api/v1/snaps |                 |
|  +---------------+  +---------------+  +---------------+                 |
|  +---------------+  +---------------+                                    |
|  |Whitelist Rts  |  | Scan Routes   |                                    |
|  | /api/v1/wl    |  | /api/v1/scan  |                                    |
|  +---------------+  +---------------+                                    |
|                                                                           |
|  Middleware: @fastify/helmet, @fastify/cors, @fastify/rate-limit         |
|  Middleware: @fastify/cookie, requireAuth, requireTier                   |
+----------+----------------------------------------------------------------+
           |
  +--------v---------+        +------------------------+
  |  PostgreSQL 16   |        |       Redis 7           |
  |  (Prisma ORM)    |        |  BullMQ Queue Broker   |
  |                  |        |  Rate-Limit Store      |
  |  8 tables        |        |  SSE Pub/Sub           |
  |  UUID primary    |        |  Daily Cap Counters    |
  +------------------+        +----------+-------------+
                                         |
                              +----------v-------------+
                              |   BullMQ Workers       |
                              |                        |
                              |  unfollow.worker.ts    |
                              |  snapshot.cron.ts      |
                              |  disconnect.cron.ts    |
                              +----------+-------------+
                                         | Instagram Private API
                              +----------v-------------+
                              |  Instagram Servers     |
                              |  (private endpoints)   |
                              +------------------------+
```

### Request Lifecycle (Typical Authenticated Request)

1. Browser or mobile sends HTTPS request with `Authorization: Bearer <access_token>` header
2. Fastify receives request; `@fastify/helmet` sets security headers (HSTS, X-Frame-Options, CSP, etc.)
3. `requireAuth` plugin verifies JWT signature using `JWT_SECRET`; extracts `sub` (userId) and `tier`
4. If route requires a specific tier, `requireTier` plugin validates user tier against required minimum
5. Route handler calls the appropriate service module
6. Service module executes Prisma queries against PostgreSQL (parameterised; never raw SQL with user input)
7. If a queue operation, service enqueues jobs to Redis/BullMQ
8. Response is serialised (session tokens stripped), returned to client
9. Pino logger records request with level, method, path, status, duration — no sensitive data logged

---

## 4. MONOREPO STRUCTURE

```
GHOAST/
+-- CLAUDE.md                          <- AI assistant rules
+-- REQUIREMENTS.md                    <- F001-F013 feature specs
+-- TECH-STACK.md                      <- Technology decisions
+-- DESIGN-NOTES.md                    <- Brand system, CSS, components
+-- GHOAST-PRD.md                      <- Full Product Requirements Document
+-- MASTER-BUILD-PROMPT.md             <- 12-phase build guide
+-- BUILD-LOG.md                       <- Phase completion log
+-- docker-compose.yml                 <- PostgreSQL 16 + Redis 7
+-- package.json                       <- Root: workspaces, Turborepo scripts
+-- turbo.json                         <- Turborepo pipeline
+-- .env.example                       <- All env variables (no values)
|
+-- apps/
|   +-- web/                           <- Next.js 16 frontend
|   |   +-- src/
|   |   |   +-- app/
|   |   |   |   +-- layout.tsx         <- Root layout: fonts, metadata
|   |   |   |   +-- page.tsx           <- Landing page composition
|   |   |   |   +-- globals.css        <- Full CSS design system (40+ vars)
|   |   |   +-- components/
|   |   |   |   +-- landing/
|   |   |   |       +-- Nav.tsx        <- Navigation + mobile hamburger
|   |   |   |       +-- MobileNav.tsx  <- 'use client' hamburger state
|   |   |   |       +-- Hero.tsx       <- Hero section + HeroWidget
|   |   |   |       +-- Marquee.tsx    <- Animated feature strip
|   |   |   |       +-- HowItWorks.tsx <- 3-step explainer cards
|   |   |   |       +-- TierSection.tsx<- 5 ghost tier cards
|   |   |   |       +-- StatStrip.tsx  <- 4 social proof stats
|   |   |   |       +-- DashboardPreview.tsx <- Mock ghost list
|   |   |   |       +-- Pricing.tsx    <- 3 plans + credit packs
|   |   |   |       +-- Footer.tsx     <- 4-col footer + legal
|   |   |   +-- __tests__/
|   |   |       +-- landing.test.tsx   <- 40 Jest/RTL unit tests
|   |   +-- tests/e2e/
|   |   |   +-- landing.spec.ts        <- 12 Playwright landing tests
|   |   |   +-- full-journey.spec.ts   <- 8 Playwright journey tests
|   |   |   +-- security.spec.ts       <- 9 Playwright security tests
|   |   +-- jest.config.ts
|   |   +-- playwright.config.ts
|   |   +-- next.config.ts
|   |   +-- tailwind.config.ts
|   |   +-- package.json
|   |
|   +-- api/                           <- Fastify backend
|       +-- src/
|       |   +-- server.ts              <- Bootstrap, plugins, graceful shutdown
|       |   +-- routes/
|       |   |   +-- auth.ts            <- /api/v1/auth/*
|       |   |   +-- accounts.ts        <- /api/v1/accounts/*
|       |   |   +-- ghosts.ts          <- /api/v1/accounts/:id/ghosts/*
|       |   |   +-- scan.ts            <- /api/v1/accounts/:id/scan/*
|       |   |   +-- queue.ts           <- /api/v1/queue/*
|       |   |   +-- billing.ts         <- /api/v1/billing/*, /webhooks/stripe
|       |   |   +-- snapshots.ts       <- /api/v1/accounts/:id/snapshots
|       |   |   +-- whitelist.ts       <- /api/v1/accounts/:id/ghosts/:gid/whitelist
|       |   +-- services/
|       |   |   +-- auth.service.ts
|       |   |   +-- accounts.service.ts
|       |   |   +-- scan.service.ts
|       |   |   +-- ghosts.service.ts
|       |   |   +-- queue.service.ts
|       |   |   +-- billing.service.ts
|       |   |   +-- whitelist.service.ts
|       |   |   +-- snapshot.service.ts
|       |   +-- workers/
|       |   |   +-- unfollow.worker.ts <- BullMQ worker: unfollow jobs
|       |   |   +-- snapshot.cron.ts   <- BullMQ cron: 00:00 UTC daily
|       |   |   +-- disconnect.cron.ts <- BullMQ cron: 01:00 UTC daily
|       |   +-- lib/
|       |   |   +-- instagram.ts       <- Private API client
|       |   |   +-- encryption.ts      <- AES-256-CBC encrypt/decrypt
|       |   |   +-- scoring.ts         <- Ghost scoring algorithm
|       |   +-- plugins/
|       |   |   +-- requireAuth.ts     <- JWT verification middleware
|       |   |   +-- requireTier.ts     <- Tier gate middleware
|       |   +-- config/
|       |       +-- queue.ts           <- All queue timing constants
|       +-- tests/
|           +-- unit/
|           +-- integration/
|           +-- security/
|               +-- security-audit.test.ts <- 23 security audit tests
|
+-- packages/
|   +-- db/
|   |   +-- prisma/
|   |       +-- schema.prisma          <- Canonical database schema (8 tables)
|   +-- design-tokens/
|       +-- src/
|           +-- index.ts               <- Shared colors, tiers, fonts, spacing
|
+-- load-tests/
    +-- queue-load.yml                 <- Artillery load test
```

---

## 5. INFRASTRUCTURE & DEPLOYMENT

### Docker Compose (Local Development)

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: ghoast
      POSTGRES_USER: ghoast
      POSTGRES_PASSWORD: ghoast
    ports: ["5432:5432"]
    healthcheck: pg_isready -U ghoast

  postgres-test:
    image: postgres:16
    environment:
      POSTGRES_DB: ghoast_test
      POSTGRES_USER: ghoast
      POSTGRES_PASSWORD: ghoast
    ports: ["5433:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck: redis-cli ping
```

The test database (`ghoast_test` on port 5433) is completely isolated. Integration tests point `DATABASE_URL` at it and run Prisma migrations before each test suite.

### Common Commands

```bash
# Development
npm run dev             # Start all services (web + api + workers)
npm run dev:web         # Next.js frontend only (port 3000)
npm run dev:api         # Fastify API only (port 4000)

# Database
npm run db:migrate      # Apply pending Prisma migrations
npm run db:seed         # Seed development data
npm run db:studio       # Open Prisma Studio GUI

# Queue inspection
npm run queue:inspect   # Show active/waiting/failed BullMQ jobs
npm run queue:clear     # Clear all jobs (dev only)

# Tests
npm test               # Run all tests across all workspaces
npm run test:unit      # Unit tests (API)
npm run test:e2e       # Playwright E2E tests
npm run test:security  # Security audit tests

# Load testing
artillery run load-tests/queue-load.yml --output load-tests/results.json
artillery report load-tests/results.json

# Build
npm run build          # Production build (all packages, Turborepo optimised)
```

### Production Architecture

- **Web:** Next.js on Vercel (recommended) or any Node.js host with Edge support
- **API:** Fastify containerised (Docker) on Railway, Render, or equivalent
- **Database:** Managed PostgreSQL (Supabase, Railway, AWS RDS)
- **Redis:** Managed Redis (Upstash or Redis Cloud) — required for BullMQ and rate limiting
- **CDN:** Vercel Edge for static assets and image optimisation

---

## 6. DATABASE SCHEMA & DATA MODEL

### Schema Overview

All primary keys are UUIDs. All timestamps are `DateTime` with default `now()`. Cascade deletes are applied on all foreign keys so that deleting a user removes all their data automatically.

---

### Table 1: `users`

Central user identity and subscription state.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, default uuid() | |
| email | String | Unique | Validated: proper email format |
| passwordHash | String | Required | bcrypt cost factor 12 minimum |
| tier | Enum | FREE, PRO, PRO_PLUS | Default: FREE |
| stripeCustomerId | String | Nullable, unique | Set on first Stripe checkout |
| creditBalance | Int | Default 0 | Incremented by credit purchases |
| createdAt | DateTime | Default now() | |
| updatedAt | DateTime | Auto-updated | |

Relations: instagramAccounts, subscriptions, creditTransactions

Tier Limits:
- FREE: 0 Instagram accounts connected (can view scans but cannot queue)
- PRO: 1 Instagram account connected, 150 unfollows/day
- PRO_PLUS: Up to 3 Instagram accounts connected, 150 unfollows/day, whitelist (500 entries), snapshots, CSV export

---

### Table 2: `instagram_accounts`

Encrypted Instagram sessions and account metadata.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| userId | UUID | FK users.id | |
| instagramUserId | String | Unique per user | Instagram numeric user ID |
| handle | String | Required | Username without @ |
| displayName | String | Nullable | |
| profilePicUrl | String | Nullable | CDN URL |
| followersCount | Int | Default 0 | Refreshed on each scan |
| followingCount | Int | Default 0 | Refreshed on each scan |
| sessionTokenEncrypted | String | Required | AES-256-CBC ciphertext |
| sessionTokenIv | String | Required | Hex-encoded 16-byte IV |
| lastScannedAt | DateTime | Nullable | Updated after completed scan |
| queuePaused | Boolean | Default false | Set during rate-limit pauses |
| pendingDisconnect | Boolean | Default false | Set on tier downgrade |
| disconnectAt | DateTime | Nullable | now + 7 days on downgrade |
| createdAt | DateTime | Default now() | |
| updatedAt | DateTime | Auto-updated | |

CRITICAL SECURITY RULE: `sessionTokenEncrypted` and `sessionTokenIv` are NEVER returned in any API response. They must be stripped before serialisation. This rule is enforced by the security audit test suite.

---

### Table 3: `ghosts`

All non-followers identified by ghost scans.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| accountId | UUID | FK instagram_accounts.id | |
| instagramUserId | String | Unique per account | Compound with accountId |
| handle | String | Required | |
| displayName | String | Nullable | |
| profilePicUrl | String | Nullable | |
| followersCount | Int | Default 0 | |
| followingCount | Int | Default 0 | |
| isVerified | Boolean | Default false | Blue checkmark |
| accountType | Enum | PERSONAL, CREATOR, BRAND, CELEBRITY | |
| lastPostDate | DateTime | Nullable | Used in scoring dimension 5 |
| priorityScore | Int | 0-100 | NEVER accept as user input |
| tier | Int | 1-5 | NEVER accept as user input |
| scoreAccountType | Int | 0-20 | Scoring sub-dimension |
| scoreRatio | Int | 0-20 | Scoring sub-dimension |
| scoreEngagement | Int | 0-20 | Scoring sub-dimension |
| scoreSizeBand | Int | 0-20 | Scoring sub-dimension |
| scorePostRecency | Int | 0-20 | Scoring sub-dimension |
| engagementUnknown | Boolean | Default false | True when ER data unavailable |
| isWhitelisted | Boolean | Default false | Pro+ feature |
| removedAt | DateTime | Nullable | Set when unfollowed; null = active |
| firstSeenAt | DateTime | Default now() | First scan to identify this ghost |

CRITICAL DATA RULE: Ghost records are NEVER deleted on rescan. When a ghost is unfollowed, `removedAt` is set. On subsequent scans, if the account now follows back, it disappears from the diff — the record remains for history.

Indexes:
- (accountId, tier, priorityScore) — sorted ghost list queries
- (accountId, removedAt) — active ghost count queries
- (accountId, isWhitelisted) — whitelist queries

---

### Table 4: `unfollow_queue_jobs`

Individual job tracking for the unfollow queue.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| accountId | UUID | FK instagram_accounts.id | |
| ghostId | UUID | FK ghosts.id | |
| bullmqJobId | String | Nullable | BullMQ internal job ID |
| status | Enum | PENDING, PROCESSING, COMPLETED, FAILED, SKIPPED | |
| creditUsed | Boolean | Default false | True when credit consumed on success |
| errorMsg | String | Nullable | Failure reason |
| createdAt | DateTime | Default now() | |
| processedAt | DateTime | Nullable | Set on completion |

Indexes:
- (accountId, status)
- (accountId, createdAt)

---

### Table 5: `queue_sessions`

Per-account, per-day rate-limit and cap tracking.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| accountId | UUID | FK instagram_accounts.id | |
| date | String | YYYY-MM-DD UTC | |
| unfollowCount | Int | Default 0 | Daily unfollows completed |
| rateLimitHits | Int | Default 0 | Instagram rate-limit responses |
| pausedUntil | DateTime | Nullable | Queue resumes at this time |
| completedAt | DateTime | Nullable | Queue finished for the day |
| createdAt | DateTime | Default now() | |

Unique constraint: (accountId, date) — one session record per account per day.

---

### Table 6: `account_snapshots`

Daily follower metrics history for growth charts.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| accountId | UUID | FK instagram_accounts.id | |
| followersCount | Int | Required | At snapshot time |
| followingCount | Int | Required | At snapshot time |
| ghostCount | Int | Required | Active ghosts (removedAt = null) |
| ratio | Decimal(5,2) | Required | following / followers, 2dp |
| takenAt | DateTime | Default now() | |

Index: (accountId, takenAt)

Retention: Pro users see last 30 snapshots. Pro+ users see unlimited history.

---

### Table 7: `credit_transactions`

Immutable audit log for all credit activity.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| userId | UUID | FK users.id | |
| type | Enum | PURCHASE, CONSUME, REFUND | |
| creditsAdded | Int | Default 0 | |
| creditsConsumed | Int | Default 0 | |
| balanceAfter | Int | Required | Balance after this transaction |
| packType | String | Nullable | 'starter', 'standard', 'power' |
| pricePaidCents | Int | Nullable | Actual payment in cents |
| stripePaymentIntentId | String | Unique, nullable | Idempotency key |
| createdAt | DateTime | Default now() | |

CRITICAL BILLING RULE: The `stripePaymentIntentId` unique constraint is the idempotency guard. Stripe `payment_intent.succeeded` webhooks can fire more than once. The second attempt to insert with the same ID throws a unique constraint violation, which the billing service catches silently — credits are never double-awarded.

Index: (userId, createdAt)

---

### Table 8: `subscriptions`

Stripe subscription lifecycle tracking.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| userId | UUID | FK users.id | |
| stripeSubscriptionId | String | Unique | |
| stripePriceId | String | Required | |
| tier | Enum | PRO, PRO_PLUS | |
| status | Enum | ACTIVE, PAST_DUE, CANCELED, UNPAID | |
| currentPeriodStart | DateTime | Required | |
| currentPeriodEnd | DateTime | Required | |
| cancelAtPeriodEnd | Boolean | Default false | |
| createdAt | DateTime | Default now() | |
| updatedAt | DateTime | Auto-updated | |

---

## 7. AUTHENTICATION & SESSION MANAGEMENT

### Architecture Overview

Ghoast uses a dual-token JWT strategy: short-lived access tokens for API calls and long-lived refresh tokens for session continuity. The strategy is platform-aware: web clients receive refresh tokens in `httpOnly` cookies (XSS-proof); mobile clients receive refresh tokens in the response body for storage in the device secure hardware enclave (iOS Keychain / Android Keystore via `expo-secure-store`).

### Access Token (JWT)

- Algorithm: HS256
- Payload: `{ sub: userId, tier: 'FREE'|'PRO'|'PRO_PLUS', iat, exp }`
- Expiry: 24 hours
- Secret: `JWT_SECRET` environment variable
- Transport: `Authorization: Bearer <token>` header on every authenticated request

### Refresh Token (JWT)

- Algorithm: HS256
- Payload: `{ sub: userId, iat, exp }`
- Expiry: 30 days
- Secret: `JWT_REFRESH_SECRET` environment variable
- Transport (Web): `httpOnly; Secure; SameSite=Strict` cookie named `refreshToken`
- Transport (Mobile): JSON response body field `refreshToken` — stored in `expo-secure-store`

### Platform Detection

The auth routes check the `X-Platform: mobile` header. If present, the refresh token is sent in the response body instead of as a cookie. Access tokens are always sent in the response body.

### Auth Routes

#### POST /api/v1/auth/register

Creates a new Ghoast user.

Request body:
```json
{ "email": "user@example.com", "password": "StrongP@ss2024!" }
```

Validation:
- Email: valid RFC 5321 format (Zod `z.string().email()`)
- Password: minimum 8 characters

Process:
1. Hash password with bcrypt (cost factor 12)
2. Create user record (tier: FREE, creditBalance: 0)
3. Issue access token + refresh token
4. Return 201 with user object (no passwordHash) + tokens

Response (201):
```json
{
  "user": { "id": "uuid", "email": "user@example.com", "tier": "FREE" },
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9..."
}
```

`passwordHash` is NEVER in the response. The security audit tests explicitly assert this.

---

#### POST /api/v1/auth/login

Authenticates an existing user.

Request body: `{ "email": "...", "password": "..." }`

Process:
1. Find user by email
2. Compare password with bcrypt
3. On mismatch: return 401 with generic message (no "user not found" vs "wrong password" distinction — prevents user enumeration)
4. Issue new access token + refresh token

Stack traces and `sessionTokenEncrypted` NEVER appear in error responses.

---

#### POST /api/v1/auth/refresh

Exchanges a refresh token for a new access token.

Request: `refreshToken` from cookie (web) or request body (mobile)

Process:
1. Verify refresh token signature with `JWT_REFRESH_SECRET`
2. Extract userId
3. Look up user to get current tier (tier may have changed since last token)
4. Issue new access token with fresh tier claim

Response (200): `{ "accessToken": "eyJhbGciOiJIUzI1NiJ9..." }`

---

#### POST /api/v1/auth/logout

Web: Clears the `refreshToken` httpOnly cookie.
Mobile: Returns 200; client is responsible for deleting the stored token from secure storage.

---

### requireAuth Plugin

Location: `apps/api/src/plugins/requireAuth.ts`

Applied as a Fastify preHandler on all protected routes.

Logic:
1. Extract `Authorization` header
2. Validate format: `Bearer <token>` — reject if malformed (401)
3. Call `verifyAccessToken(token)` using `JWT_SECRET`
4. On `JsonWebTokenError` or `TokenExpiredError`: return 401
5. Attach `request.user = { id, tier }` for downstream handlers

Public endpoints (no requireAuth): `/health`, `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/webhooks/stripe`

---

### requireTier Plugin

Location: `apps/api/src/plugins/requireTier.ts`

Factory: `requireTier('PRO_PLUS')` returns a Fastify preHandler.

Tier hierarchy: PRO_PLUS > PRO > FREE

Returns 403 with body:
```json
{
  "error": "TIER_REQUIRED",
  "required": "PRO_PLUS",
  "current": "FREE",
  "upgrade_required": true
}
```

---

### Rate Limiting

All API routes are covered by `@fastify/rate-limit` backed by Redis.

- Limit: 100 requests per minute per user (keyed by JWT `sub`)
- Public routes: keyed by IP address
- Auth-specific limit: Login endpoint limited to 5 attempts per minute per IP
- Exceeded response: 429 with `Retry-After` header

---

## 8. INSTAGRAM INTEGRATION LAYER

### Architecture Philosophy

Ghoast uses Instagram's private API — the same undocumented endpoints Instagram's own mobile apps call. This approach is used because the official Meta Graph API does not expose follower/following lists to third-party apps.

Risk acknowledgment: This violates Instagram's Terms of Service (Section 3.2). Instagram aggressively detects and blocks automated access. Ghoast's entire queue safety architecture exists to mitigate this risk at the per-user-account level.

### Session Token Capture

When a user connects an Instagram account:
1. Frontend presents an embedded WebView loading `https://www.instagram.com`
2. User logs in with their Instagram credentials directly — Ghoast never sees the password
3. Post-login, the WebView's cookie storage contains the `sessionid` cookie
4. The frontend extracts this cookie value and sends it to `POST /api/v1/accounts/connect`
5. The API immediately encrypts it with AES-256-CBC and stores only the ciphertext and IV

The plaintext `sessionid` value:
- Never touches a database column (only encrypted form stored)
- Never appears in logs (Pino logger redacts it before writing)
- Never appears in error messages (Sentry scrubs it)
- Is only decrypted in-process inside the BullMQ worker, used immediately, then released from memory

### Instagram Library Functions

Location: `apps/api/src/lib/instagram.ts`

---

`getFollowing(sessionToken, userId, cursor?)`: Fetches one page (50 accounts) of accounts the authenticated user follows. Returns `{ accounts, nextCursor, hasMore }`.

`getFollowers(sessionToken, userId, cursor?)`: Same for the followers list.

`fetchAllFollowing(sessionToken, userId)`: Loops `getFollowing` until `hasMore === false`, collecting all pages. Accepts optional `onProgress(fetched, total)` callback for SSE progress events.

`fetchAllFollowers(sessionToken, userId)`: Same for followers.

`unfollowUser(sessionToken, targetUserId)`:
- Sends unfollow action to Instagram private endpoint
- On success: returns void
- On 400 feedback_required: throws `InstagramRateLimitError`
- On 401: throws `SessionExpiredError`
- On network timeout: throws `InstagramNetworkError`

`getAccountInfo(sessionToken, username)`: Fetches profile metadata for one account (follower count, following count, post count, account type, verification status, last post date). Used during ghost scan to enrich each ghost's data for scoring.

### Error Types

| Error Class | Meaning | Queue Response |
|-------------|---------|----------------|
| InstagramRateLimitError | Instagram 429 or feedback_required | Pause 15 min; retry job |
| SessionExpiredError | Instagram 401 | Publish session_expired event; stop worker |
| InstagramNetworkError | Timeout / network failure | Retry with exponential backoff (3 attempts) |
| AccountNotFoundError | Target account deleted | Mark job SKIPPED; continue |
| AlreadyUnfollowedError | Already unfollowed (idempotent) | Mark COMPLETED; no credit consumed |

---

## 9. GHOST SCORING ENGINE

### Architecture

Location: `apps/api/src/lib/scoring.ts`

The scoring engine is a pure function:

```typescript
function scoreGhost(account: InstagramAccountData): GhostScore {
  return {
    priorityScore: number,      // 0-100 composite
    tier: number,               // 1-5
    scoreAccountType: number,   // 0-20
    scoreRatio: number,         // 0-20
    scoreEngagement: number,    // 0-20
    scoreSizeBand: number,      // 0-20
    scorePostRecency: number,   // 0-20
    engagementUnknown: boolean
  }
}
```

Lower score = higher priority to remove. Score 0-20 = Tier 1 = "Safe to Cut." Score 81-100 = Tier 5 = "Keep Following" (auto-protected).

### Dimension 1: Account Type (0-20 points)

Measures the type of account — human personal accounts get more protection than brand or celebrity accounts.

| Account Type | Points | Rationale |
|-------------|--------|-----------|
| PERSONAL | 20 | Real person — worth keeping |
| CREATOR | 14 | Content creator — moderate value |
| BRAND | 6 | Brand account — low reciprocal value |
| CELEBRITY | 2 | Celebrity — essentially a broadcast channel |

Account type is determined by heuristics: verification status, follower-to-following ratio (celebrities have massive follower counts with near-zero following), and profile category field from `getAccountInfo`.

### Dimension 2: Follower Ratio (0-20 points)

Measures the ghost account's own following behaviour. An account that follows nobody (ratio approaching infinity) gets 0 points; an account that follows back most of its followers gets 20.

```
ratio = ghost.followingCount / ghost.followersCount

ratio >= 1.0:  20 points (follows back liberally)
ratio >= 0.5:  16 points
ratio >= 0.2:  12 points
ratio >= 0.1:   8 points
ratio >= 0.05:  4 points
ratio < 0.05:   0 points (selective non-follower)
```

### Dimension 3: Engagement Rate (0-20 points)

Estimates how actively the ghost engages with content. High engagement means a more genuine community member worth following.

```
ER estimated from: (likes + comments) / followers / recent posts

ER >= 5%:    20 points (highly engaged)
ER >= 2%:    16 points
ER >= 1%:    12 points
ER >= 0.5%:   8 points
ER >= 0.1%:   4 points
ER unavailable: 10 points (neutral; engagementUnknown = true)
```

When `engagementUnknown` is true, the UI shows a tilde (~) modifier next to the score to indicate estimation.

### Dimension 4: Size Band (0-20 points)

Measures the ghost's follower count. Large accounts are broadcast channels, not relationships.

```
followers < 500:     18 points (micro — personal)
followers < 2,000:   16 points (small — emerging)
followers < 10,000:  12 points (mid-size)
followers < 50,000:   8 points (large creator)
followers < 500,000:  4 points (major)
followers >= 500,000: 0 points (celebrity/brand tier)
```

### Dimension 5: Post Recency (0-20 points)

Measures how recently the ghost posted. Dormant accounts provide no engagement value.

```
lastPostDate is null: 0 points (no posts ever)
Days since last post:
< 7 days:    20 points (active this week)
< 30 days:   16 points (active this month)
< 90 days:   12 points (active this quarter)
< 180 days:   8 points (semi-active)
< 365 days:   4 points (barely active)
>= 365 days:  0 points (dormant — safe to cut)
```

### Score Composition and Tier Mapping

```
priorityScore = scoreAccountType + scoreRatio + scoreEngagement + scoreSizeBand + scorePostRecency

Tier mapping:
Score 0-20:   Tier 1 — "Safe to Cut"    (#FF3E3E, red)
Score 21-40:  Tier 2 — "Probably Cut"   (#FF7A3E, orange)
Score 41-60:  Tier 3 — "Your Call"      (#FFD166, yellow)
Score 61-80:  Tier 4 — "Might Keep"     (#7B4FFF, violet)
Score 81-100: Tier 5 — "Keep Following" (#00E676, green) -- AUTO-PROTECTED
```

### Tier 5 Protection Rules

Tier 5 ghosts are auto-protected at every layer of the system:
1. Queue route: `startQueue()` throws `QueueTier5RejectedError` if any Tier 5 ID is submitted
2. Worker: `processUnfollowJob()` double-checks tier and throws if Tier 5 (belt-and-suspenders)
3. UI: Tier 5 rows have disabled checkboxes and cannot be selected
4. Whitelist: Tier 5 accounts are always conceptually protected (never need explicit whitelist entry)

---

## 10. BULK UNFOLLOW QUEUE SYSTEM

### Overview

The queue is a server-side BullMQ queue backed by Redis. This architecture means:
- Jobs survive browser close, phone lock, and app termination
- Concurrency is controlled at the server (1 worker per account)
- Rate-limit protection is enforced server-side regardless of client state
- All Instagram actions run on Ghoast's servers — the user's device is not involved

### Queue Configuration (Single Source of Truth)

Location: `apps/api/src/config/queue.ts`

NEVER hardcode these values in worker files. Always import from this module.

```typescript
export const QUEUE_CONFIG = {
  // Timing (milliseconds)
  MIN_DELAY_MS:               8_000,  // Minimum delay between unfollows
  MAX_DELAY_MS:              45_000,  // Maximum delay between unfollows
  SESSION_PAUSE_MIN_MS:     180_000,  // Minimum session pause (3 min)
  SESSION_PAUSE_MAX_MS:     420_000,  // Maximum session pause (7 min)
  RATE_LIMIT_PAUSE_MS:      900_000,  // Rate-limit pause (15 min)
  RATE_LIMIT_24H_PAUSE:  86_400_000,  // 3 rate-limit hits = 24h pause

  // Triggers
  SESSION_PAUSE_EVERY_MIN:       10,  // Pause every N unfollows (min)
  SESSION_PAUSE_EVERY_MAX:       15,  // Pause every N unfollows (max)
  RATE_LIMIT_DAILY_THRESHOLD:     3,  // Hits before 24h pause

  // Daily caps
  DAILY_CAP_PRO:                150,
  DAILY_CAP_PROPLUS:            150,

  // SSE
  HEARTBEAT_INTERVAL_MS:     25_000,

  // Queue names
  QUEUE_NAME_UNFOLLOW:  'ghoast:unfollow',
  QUEUE_NAME_SNAPSHOT:  'ghoast:snapshot',
  QUEUE_NAME_DISCONNECT: 'ghoast:disconnect',

  // BullMQ job options
  JOB_ATTEMPTS:               3,
  BACKOFF_TYPE:      'exponential',
  BACKOFF_DELAY_MS:       5_000,
  REMOVE_ON_COMPLETE:       100,
  REMOVE_ON_FAIL:            50,
}
```

### Queue Service: startQueue(userId, accountId, ghostIds[])

The primary queue initiation function. Location: `apps/api/src/services/queue.service.ts`

Step 1 — Account verification:
- Verify account belongs to userId
- Throw `QueueAccountNotFoundError` if not found or not owned

Step 2 — Tier/credit check:
- If FREE tier with 0 credit balance: throw `QueueAccessDeniedError`
- If PRO or PRO_PLUS: proceed with subscription flag
- If credit balance > 0: proceed with credit-consume flag

Step 3 — Ghost validation:
- Fetch all specified ghost IDs from DB
- Verify each belongs to the specified account
- Filter out whitelisted ghosts silently (excluded, no error thrown)
- Hard reject if any Tier 5 ghost included: throw `QueueTier5RejectedError`

Step 4 — Daily cap check:
- Query Redis key `queue:unfollow_count:{accountId}:{YYYY-MM-DD-UTC}`
- Determine effective cap: PRO/PRO_PLUS = 150; Credit users = min(creditBalance, 150)
- Calculate remaining: cap minus todayCount
- If 0 remaining: throw `QueueDailyCapExceededError`
- Trim requested ghost list to remaining if it exceeds cap

Step 5 — Session record:
- Upsert QueueSession for (accountId, todayUTC)

Step 6 — Job enqueue:
- Create UnfollowQueueJob records in DB (status: PENDING)
- Enqueue to BullMQ with jobId: `{accountId}:{ghostId}` (deduplication), staggered initial delays, 3 attempts with exponential backoff

Step 7 — Worker start:
- Check `activeWorkers` Map for accountId
- If no worker: `activeWorkers.set(accountId, createUnfollowWorker(accountId))`
- Worker runs with concurrency = 1 per account

Step 8 — Response:
```json
{ "sessionId": "uuid", "jobCount": 80, "estimatedCompletionMinutes": 47 }
```

### Unfollow Worker: processUnfollowJob(job)

Location: `apps/api/src/workers/unfollow.worker.ts`

Step 1 — Data fetch: Fetch account + encrypted session token from DB

Step 2 — Ghost validation (belt-and-suspenders):
```
if ghost.tier === 5: throw TIER5_BLOCKED
if ghost.isWhitelisted: return { success: true, skipped: true }
if ghost.removedAt !== null: return { success: true, skipped: true }
```

Step 3 — Session decrypt:
```
sessionToken = decrypt(account.sessionTokenEncrypted, account.sessionTokenIv)
// Token is a plain string in memory — NEVER logged
```

Step 4 — Pre-job delay (applyPreJobDelay):
- Get current unfollow count for this cycle from Redis
- If count mod randomBetween(10, 15) === 0: session pause (randomBetween(180_000, 420_000) ms)
- Otherwise: base delay (randomBetween(8_000, 45_000) ms)

Step 5 — Unfollow execution:
```
await unfollowUser(sessionToken, ghost.instagramUserId)
```

Step 6 — Success path:
- Set ghost.removedAt = new Date()
- If consumeCredit: billingService.consumeCredit(userId)
- Increment Redis daily counter (24h TTL)
- Publish to `queue:events:{accountId}`:
  ```json
  { "type": "job_completed", "ghostId": "uuid", "totalRemoved": 23 }
  ```

Step 7 — Rate limit path (InstagramRateLimitError):
- Increment Redis `queue:rl_hits:{accountId}:{date}` (24h TTL)
- If hits >= 3: pause 24 hours, publish queue_paused (reason: rate_limit_24h)
- Otherwise: pause 15 minutes, publish queue_paused (reason: rate_limit_15m)
- Move job to delayed BullMQ queue

Step 8 — Session expired path (SessionExpiredError):
- Publish `{ type: 'session_expired', accountId }`
- Rethrow error — BullMQ marks job as failed; worker stops gracefully

### Queue SSE Stream

GET /api/v1/queue/status/:accountId establishes a Server-Sent Events connection.

Headers set:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

The endpoint subscribes to Redis pub/sub channel `queue:events:{accountId}`. Every message published by the worker is forwarded to the SSE stream:

```
data: {"type":"job_completed","ghostId":"uuid","totalRemoved":23}

data: {"type":"queue_paused","reason":"rate_limit_15m","resumeInMs":900000}

data: {"type":"queue_cancelled"}

data: {"type":"session_expired","accountId":"uuid"}
```

Heartbeat: `: heartbeat` comment every 25 seconds to keep connection alive through proxies.

Cleanup: On request close, the Redis subscriber is unsubscribed and closed.

### Snapshot Cron

Schedule: 00:00 UTC daily (BullMQ repeatable, cron: `'0 0 * * *'`)

Process:
1. Queries all Pro and Pro+ accounts where pendingDisconnect = false
2. For each account: creates AccountSnapshot with followersCount, followingCount, active ghost count, ratio
3. Logs per-account success/failure (never stops for individual errors)

### Disconnect Cron

Schedule: 01:00 UTC daily (cron: `'0 1 * * *'`)

Process:
1. Queries accounts where pendingDisconnect = true AND disconnectAt <= now()
2. Permanently deletes those accounts (Prisma cascade deletes all related ghosts, queue jobs, snapshots)

Trigger: When a user downgrades, excess accounts are flagged with pendingDisconnect=true and disconnectAt=now+7 days. Users have 7 days to re-upgrade and reclaim their data.

---

## 11. API REFERENCE — ALL ROUTES

All routes prefixed `/api/v1/`. All authenticated routes require `Authorization: Bearer <access_token>`.

### Auth Routes

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | /auth/register | Public | {email, password} | 201 {user, accessToken, refreshToken} |
| POST | /auth/login | Public | {email, password} | 200 {user, accessToken, refreshToken} |
| POST | /auth/refresh | Public* | refreshToken | 200 {accessToken} |
| POST | /auth/logout | Public* | — | 200 |

Errors: 400 (validation), 401 (invalid credentials), 422 (Zod schema mismatch)

### Account Routes

| Method | Path | Auth | Tier | Body/Params | Response |
|--------|------|------|------|-------------|----------|
| POST | /accounts/connect | Yes | PRO+ | {sessionToken, instagramUserId} | 201 {account} |
| GET | /accounts | Yes | Any | — | 200 {accounts[]} |
| DELETE | /accounts/:id | Yes | Any | — | 204 |

POST /accounts/connect process:
1. Verify user does not exceed account limit for tier (FREE: 0, PRO: 1, PRO_PLUS: 3)
2. Fetch basic account info from Instagram using session token
3. Encrypt session token (AES-256-CBC, random IV)
4. Create InstagramAccount record
5. Return account metadata (no encrypted fields)

GET /accounts returns: id, instagramUserId, handle, displayName, profilePicUrl, followersCount, followingCount, lastScannedAt, queuePaused. NEVER includes sessionTokenEncrypted or sessionTokenIv.

### Ghost Routes

| Method | Path | Auth | Tier | Params/Body | Response |
|--------|------|------|------|-------------|----------|
| GET | /accounts/:id/ghosts | Yes | Any | ?page, limit, tier, sort, search, removed | 200 {ghosts[], total, page, pages} |
| POST | /accounts/:id/ghosts/:ghostId/unfollow | Yes | Any | — | 200 {success, ghostId} |
| GET | /accounts/:id/ghosts/stats | Yes | Any | — | 200 {total, byTier, removed} |

GET /accounts/:id/ghosts query parameters:
- page (default 1), limit (default 50, max 200)
- tier (1-5 or omit for all)
- sort: 'score_asc' (default), 'score_desc', 'handle', 'followers'
- search: searches handle and displayName, minimum 2 characters
- removed: 'false' (default, active only), 'true' (removed only), 'all'

Free tier users see the full ghost list — intelligence is available on all tiers. Queue execution is gated behind Pro.

POST /accounts/:id/ghosts/:ghostId/unfollow (Manual Unfollow):
- Free tier: limited to 10 manual unfollows per day (Redis counter)
- Tier 5 ghosts cannot be manually unfollowed
- On success: sets ghost.removedAt

### Scan Routes

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | /accounts/:id/scan/start | Yes | — | 200 {scanId} |
| GET | /accounts/:id/scan/progress | Yes | — | SSE stream |

POST /accounts/:id/scan/start:
1. Verify account ownership
2. Acquire Redis distributed lock: `scan:lock:{accountId}` (TTL 600s)
3. If lock exists: return 409 (scan already in progress)
4. Decrypt session token in-process
5. Begin async background scan (does not await):
   - fetchAllFollowing with progress events
   - fetchAllFollowers with progress events
   - Diff to identify ghosts
   - Score each ghost with scoreGhost()
   - Upsert ghosts in DB
   - Update account metadata, release lock
6. Return 200 immediately with { scanId }

SSE scan events:
```
data: {"type":"following_progress","fetched":250,"estimated":1200}
data: {"type":"followers_progress","fetched":250,"estimated":800}
data: {"type":"diff_complete","ghostCount":847}
data: {"type":"scoring_progress","scored":500,"total":847}
data: {"type":"scan_complete","ghostCount":847,"newGhosts":23,"removedGhosts":5}
data: {"type":"scan_error","message":"Session expired"}
```

### Queue Routes

| Method | Path | Auth | Tier | Body | Response |
|--------|------|------|------|------|----------|
| POST | /queue/start | Yes | PRO or Credits | {accountId, ghostIds[]} | 202 {sessionId, jobCount, estimatedCompletionMinutes} |
| POST | /queue/pause | Yes | PRO+ | {accountId} | 200 {success} |
| POST | /queue/cancel | Yes | PRO+ | {accountId} | 200 {success} |
| GET | /queue/status/:accountId | Yes | Any | — | SSE stream |

Errors:
- 400: Tier 5 ghost in selection, validation failure
- 403: Account not found or access denied
- 429: Daily cap exceeded (includes remainingToday, resetAt in body)

### Billing Routes

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | /billing/subscribe | Yes | {tier, successUrl, cancelUrl} | 200 {url} |
| POST | /billing/credits | Yes | {priceId} | 200 {clientSecret, packType, credits} |
| POST | /billing/portal | Yes | {returnUrl} | 200 {url} |
| GET | /billing/balance | Yes | — | 200 {balance} |
| POST | /webhooks/stripe | Public | Stripe event | 200 {received: true} |

### Snapshot Routes

| Method | Path | Auth | Tier | Response |
|--------|------|------|------|----------|
| GET | /accounts/:id/snapshots | Yes | PRO+ | 200 SnapshotRecord[] (most-recent first) |
| GET | /accounts/:id/ghosts/export | Yes | PRO+ | CSV stream (attachment) |

CSV export headers: `display_name,handle,followers,following,ratio,tier,priority_score,last_post_date,account_type`

Cursor-based pagination (500 records per batch) for memory-efficient streaming of large exports.

Fields with commas, quotes, or newlines are wrapped in double-quotes with internal quotes escaped as `""`.

### Whitelist Routes (Pro+ Only)

| Method | Path | Auth | Tier | Response |
|--------|------|------|------|----------|
| POST | /accounts/:id/ghosts/:ghostId/whitelist | Yes | PRO_PLUS | 201 {ghost} |
| DELETE | /accounts/:id/ghosts/:ghostId/whitelist | Yes | PRO_PLUS | 204 |
| GET | /accounts/:id/whitelist | Yes | PRO_PLUS | 200 {ghosts[], total} |

Whitelist limit: 500 ghosts per account. Returns 422 with WhitelistLimitReachedError when exceeded.

Whitelisted ghosts are silently filtered from queue jobs — never enqueued, never consume credits. Checked at service level (startQueue) and again at worker level.

### Health Route

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | /health | Public | 200 {status: "ok", timestamp} |

Used by load balancers, Docker health checks, and the Artillery load test warm-up scenario.

---

## 12. BILLING & PAYMENT ARCHITECTURE

### Pricing Reference

| Plan | Price | Stripe Price Env | Includes |
|------|-------|-----------------|---------|
| Free | $0 | — | Ghost scan, view ghost list, 10 manual unfollows/day |
| Pro | $9.99/month | STRIPE_PRICE_PRO_MONTHLY | 1 IG account, 150 unfollows/day via queue |
| Pro+ | $24.99/month | STRIPE_PRICE_PROPLUS_MONTHLY | 3 IG accounts, whitelist (500), snapshots, CSV export |
| Credits 100 | $2.99 one-time | STRIPE_PRICE_CREDITS_100 | 100 unfollow actions (never expire) |
| Credits 500 | $9.99 one-time | STRIPE_PRICE_CREDITS_500 | 500 unfollow actions ("Save 33%") |
| Credits 1,500 | $19.99 one-time | STRIPE_PRICE_CREDITS_1500 | 1,500 unfollow actions ("Save 55%") |

Credits never expire. Credits are an alternative to subscription for users who prefer one-time purchases.

### Subscription Flow

```
1. User clicks "Start Pro"
   -> POST /billing/subscribe { tier: 'PRO' }

2. API calls stripe.checkout.sessions.create (mode: 'subscription')
   - metadata: { ghoast_user_id: userId }
   - success_url: ghoast.app/dashboard?upgraded=true
   - cancel_url: ghoast.app/pricing

3. API returns { url: 'https://checkout.stripe.com/...' }

4. Frontend redirects to Stripe Checkout

5. User completes payment on Stripe's hosted page

6. Stripe sends webhook: invoice.payment_succeeded

7. handleInvoicePaymentSucceeded:
   - Extract ghoast_user_id from subscription metadata
   - Map stripePriceId to tier (PRO or PRO_PLUS)
   - Transaction: User.tier = tier, upsert Subscription record

8. User's next API call uses refreshed JWT (tier updated via /auth/refresh)
```

### Credit Purchase Flow

```
1. User clicks "Buy 100 Credits"
   -> POST /billing/credits { priceId: STRIPE_PRICE_CREDITS_100 }

2. API validates priceId is in allowed set (prevents arbitrary price manipulation)

3. API calls stripe.paymentIntents.create
   - metadata: { ghoast_user_id, pack_type: 'starter', credits: 100 }
   - amount: 299 (cents)

4. API returns { clientSecret }

5. Frontend uses Stripe.js / Elements to complete payment (client-side)

6. Stripe sends webhook: payment_intent.succeeded

7. handlePaymentIntentSucceeded:
   - Extract userId, packType, credits from metadata
   - Try to insert CreditTransaction with stripePaymentIntentId
   - Unique constraint violation = duplicate webhook -> silently return (idempotent)
   - On success: User.creditBalance += 100
```

### Subscription Cancellation / Downgrade

```
Stripe event: customer.subscription.deleted
-> handleSubscriptionDeleted:
   1. User.tier = FREE
   2. Subscription.status = CANCELED
   3. handleTierDowngrade(userId, 'FREE'):
      - Count user's instagram_accounts
      - If count > 0:
        - Mark all: pendingDisconnect=true, disconnectAt=now+7d
      - User has 7 days to re-upgrade before data deletion
```

### Stripe Webhook Security

The Stripe webhook endpoint does NOT use Fastify's JSON body parser. It receives the raw body buffer for signature verification:

```typescript
const event = stripe.webhooks.constructEvent(
  rawBody,
  request.headers['stripe-signature'],
  process.env.STRIPE_WEBHOOK_SECRET
)
```

If signature verification fails: return 400 immediately. Tested in the security audit.

The endpoint always returns 200 even on business logic errors — prevents Stripe from endlessly retrying.

---

## 13. FRONTEND ARCHITECTURE

### Technology Stack

| Package | Version | Role |
|---------|---------|------|
| Next.js | 16.1.6 | React framework, App Router, SSR |
| React | 19 | UI runtime |
| Tailwind CSS | 4 | Utility CSS |
| TypeScript | 5.x | Type safety |
| Playwright | Latest | E2E testing |
| Jest + RTL | Latest | Component unit testing |

### App Router Pages

```
apps/web/src/app/
+-- layout.tsx        <- Root layout: fonts, metadata, noise layers, orbs
+-- page.tsx          <- Landing page (server component)
+-- globals.css       <- CSS custom properties (design system)
+-- register/page.tsx <- Registration form
+-- login/page.tsx    <- Login form
+-- dashboard/page.tsx<- Post-auth dashboard
+-- pricing/page.tsx  <- Pricing page
+-- privacy/page.tsx  <- Privacy policy
+-- terms/page.tsx    <- Terms of service
```

### Component Philosophy

- Server components by default: All landing page components are server components (no 'use client'). They render on the server, produce pure HTML, ship zero JS for display logic.
- Client islands for interactivity only: `MobileNav.tsx` uses 'use client' for hamburger state. Future dashboard SSE components will also be client islands.
- No prop drilling for theming: CSS custom properties handle all theme values.

### Landing Page Components

**Nav** (`Nav.tsx`):
- Logo link with aria-label="Ghoast home" (wordmark is split across styled spans — the test targets the aria-label, not the text content)
- Anchor links to #how-it-works, #ghost-tiers, #pricing (smooth scroll via CSS scroll-behavior: smooth)
- "Log in" links to /login; "Get started free" links to /register

**Hero** (`Hero.tsx`):
- H1 with gradient "oa" in "Ghoast" via background-clip: text
- Primary CTA: "Scan My Account Free" -> /register
- Secondary CTA: "See how it works" -> #how-it-works
- HeroWidget: animated mock ghost list preview with 3 rows, tier dots, animated queue progress bar, "Scan Complete" badge

**Marquee** (`Marquee.tsx`):
- Infinite horizontal scroll of feature tags
- CSS @keyframes marquee animation

**HowItWorks** (`HowItWorks.tsx`):
- ID: #how-it-works
- 3 step cards (H3 each): "Connect your account", "Scan for ghosts", "Ghost them back"
- Icon numbers 01/02/03 in violet circle badges

**TierSection** (`TierSection.tsx`):
- ID: #ghost-tiers
- 5 tier cards, each with tier colour background/border, label, score range, description
- Tier 5 has auto-protected badge
- Bottom strip: 5 scoring dimensions with descriptions

**StatStrip** (`StatStrip.tsx`):
- 4 stats: "2.4M+ Ghosts removed", "186K Accounts cleaned", "99.1% Accounts kept safe", "< 30s Avg scan time"
- DM Mono font on values, gradient colouring

**DashboardPreview** (`DashboardPreview.tsx`):
- ID: #dashboard-preview
- Mock ghost list table: 7 sample ghosts across all tiers
- Responsive: hides followers/following columns below 640px
- CTA: "Try it free" -> /register

**Pricing** (`Pricing.tsx`):
- ID: #pricing
- 3 plan cards: Free (grey), Pro (violet border), Pro+ (gradient background, "Most popular" badge)
- Feature comparison lists: check for included, dash for excluded
- Credit packs section: 3 cards with savings badges
- CTAs: /register, /register?plan=pro, /register?plan=proplus

**Footer** (`Footer.tsx`):
- 4-column grid: brand + Product links + Account links + Legal links
- Copyright: current year via new Date().getFullYear()
- Meta disclaimer: "not affiliated with, endorsed by, or sponsored by Instagram or Meta Platforms, Inc."

### Root page.tsx Composition

```tsx
export default function LandingPage() {
  return (
    <>
      <div className="noise-layer" aria-hidden="true" />
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />
      <div className="orb orb-3" aria-hidden="true" />
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <StatStrip />
        <HowItWorks />
        <TierSection />
        <DashboardPreview />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
```

---

## 14. DESIGN SYSTEM

### Color Tokens

Defined in `apps/web/src/app/globals.css` as CSS custom properties and in `packages/design-tokens/src/index.ts` as JS constants.

```
Brand colours:
--black:        #080810   Page background
--slate:        #111120   Card / surface background
--slate-light:  #1A1A35   Elevated surface, input background
--violet:       #7B4FFF   Primary brand, CTAs, accents
--violet-light: #9B6FFF   Hover state, lighter accents
--cyan:         #00E5FF   Secondary accent, highlights

Text colours:
--ghost:   #E8E8FF   Primary text (near-white with blue tint)
--muted:   #7070A0   Secondary text, disabled states
--white:   #FFFFFF   Pure white (used sparingly)

Tier colours:
--tier-1:  #FF3E3E   Tier 1: Safe to Cut (red)
--tier-2:  #FF7A3E   Tier 2: Probably Cut (orange)
--tier-3:  #FFD166   Tier 3: Your Call (yellow)
--tier-4:  #7B4FFF   Tier 4: Might Keep (violet)
--tier-5:  #00E676   Tier 5: Keep Following (green)
```

### Typography

| Role | Font | Variable |
|------|------|---------|
| UI / Headings | Outfit (Google Fonts) | --font-sans |
| Numbers / Monospace | DM Mono (Google Fonts) | --font-mono |

Font size scale:
```
--text-xs:   12px
--text-sm:   14px
--text-base: 16px
--text-lg:   18px
--text-xl:   20px
--text-2xl:  24px
--text-3xl:  30px
--text-4xl:  36px
```

### Layout

- Container: max-width 1200px, centred, horizontal padding 24px (mobile) / 48px (desktop)
- Grid system: CSS Grid with named classes (.steps-grid, .tiers-grid, .pricing-grid, .stat-strip-grid)
- Responsive breakpoints: 640px (sm), 768px (md), 1024px (lg) — handled via media queries in component style blocks

### Visual Effects

- Noise layer: Semi-transparent SVG noise texture at position: fixed, z-index: 0, pointer-events: none — adds film grain feel
- Ambient orbs: 3 blurred radial gradient circles (.orb-1, .orb-2, .orb-3) at position: fixed — create soft purple/cyan depth glow
- Gradient text: background: linear-gradient; -webkit-background-clip: text; color: transparent
- Gradient borders: transparent border with linear-gradient background-image using border-box background-clip

### Button Variants

| Variant | Background | Use |
|---------|-----------|-----|
| Primary | --violet solid | Main CTA |
| Primary Gradient | violet to cyan gradient | Highlighted CTA (Pro+) |
| Outline | Transparent, violet border | Secondary action |
| Ghost | Transparent, no border | Tertiary / nav links |

### Animations

```css
@keyframes marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### Design Tokens Package

Location: `packages/design-tokens/src/index.ts`

Exports: colors, tiers (tier 1-5 definitions with label, color, scoreMin, scoreMax), fonts, fontSizes, spacing (4px base unit), radius, pricing (all plan prices)

This package is consumed by both the Next.js web app (via CSS variables) and by the future React Native mobile app (via StyleSheet objects). It is the single source of truth for all visual values.

---

## 15. SECURITY ARCHITECTURE

### Threat Model

Ghoast's security model protects against:
1. Data theft: Encrypted session tokens prevent mass credential extraction if DB is compromised
2. Account takeover: Short-lived JWTs + httpOnly refresh cookies prevent XSS token theft
3. Payment manipulation: Stripe webhook signature verification + idempotency guards
4. Instagram detection: Rate-limit safe queue prevents account flags
5. Privilege escalation: Tier checks on every protected route
6. Injection attacks: Parameterised queries exclusively (Prisma ORM — no raw SQL with user input)
7. Brute force: Rate limiting on auth endpoints

### Session Token Security (AES-256-CBC)

Location: `apps/api/src/lib/encryption.ts`

```typescript
function encrypt(plaintext: string): { ciphertext: string; iv: string } {
  const key = Buffer.from(process.env.SESSION_TOKEN_ENCRYPTION_KEY, 'hex') // 32 bytes
  const iv = crypto.randomBytes(16)                                           // 128-bit random IV per encryption
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('hex')
  }
}

function decrypt(ciphertext: string, ivHex: string): string {
  const key = Buffer.from(process.env.SESSION_TOKEN_ENCRYPTION_KEY, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final()
  ])
  return decrypted.toString('utf8')
}
```

Key properties:
- 256-bit symmetric key (32 bytes) stored only in SESSION_TOKEN_ENCRYPTION_KEY env var
- Fresh random 128-bit IV for each encryption (prevents ciphertext correlation across accounts)
- CBC mode — industry standard for this use case
- Ciphertext stored as base64; IV stored as hex alongside it
- Decryption only happens inside worker processes for the duration of one job

### Security Response Headers (Fastify Helmet)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
Referrer-Policy: no-referrer-when-downgrade
```

### CORS Policy

Allowed origins: ghoast.app and www.ghoast.app in production, localhost:3000 in development.
Methods: GET, POST, PUT, DELETE, OPTIONS.
Credentials: true (required for httpOnly cookie exchange).

### Input Validation (Zod)

All route bodies are validated with Zod schemas. Examples:

```typescript
// Auth register
z.object({ email: z.string().email(), password: z.string().min(8) })

// Queue start
z.object({
  accountId: z.string().uuid(),
  ghostIds: z.array(z.string().uuid()).min(1).max(150)
})
```

Invalid input returns 400 or 422 with a structured error body. No input is ever used in raw SQL.

### Security Audit Tests

Location: `apps/api/tests/security/security-audit.test.ts`

23 automated tests covering:

Section 1 — Sensitive Field Exposure:
- Login response does not contain sessionTokenEncrypted or sessionTokenIv
- Registration response does not contain passwordHash or password
- Error responses do not contain stack traces or /node_modules/ paths

Section 2 — Auth Enforcement:
- 7 protected routes return 401 without Authorization header
- Tampered JWT (flipped signature character) returns 401
- Malformed Bearer token returns 401

Section 3 — Tier Enforcement:
- FREE user attempting whitelist endpoint gets 403 with upgrade_required: true
- PRO user attempting Pro+-only endpoint gets 403

Section 4 — Static Code Audit (File Analysis):
- Source files do not contain raw SQL string concatenation
- instagram.ts never logs the session token value
- billing.ts contains constructEvent (Stripe webhook signature verification)
- encryption.ts uses aes-256-cbc
- No hardcoded secrets in source files

Section 5 — Input Validation:
- Invalid email format returns 400 or 422
- Missing password returns 400 or 422
- Empty request body returns 400 or 422

Section 6 — CORS:
- OPTIONS preflight returns 200 or 204 with CORS headers

---

## 16. BUSINESS LOGIC RULES

### Tier Limits

| Feature | FREE | PRO | PRO_PLUS |
|---------|------|-----|---------|
| Instagram accounts | 0 | 1 | 3 |
| Ghost list (view) | Yes | Yes | Yes |
| Manual unfollows | 10/day | Yes | Yes |
| Bulk queue | No | Yes | Yes |
| Daily unfollow cap | — | 150 | 150 |
| Whitelist | No | No | Yes (500 max) |
| Snapshots | No | Last 30 | Unlimited |
| CSV export | No | No | Yes |

### Credit System Rules

1. Credits are purchased independently of subscriptions
2. FREE users can use credits to access the queue (credits give access without subscription)
3. Credits are consumed 1 per successful unfollow
4. Credits are NOT consumed for: skipped jobs, whitelisted ghosts, already-removed ghosts, failed jobs
5. Credits never expire
6. Credit balance is an integer; no fractional credits exist
7. Credit purchase is idempotent (Stripe webhook deduplication via stripePaymentIntentId unique constraint)
8. consumeCredit() runs in a Prisma transaction with a balance check before decrement to prevent over-consumption under concurrent queue jobs

### Daily Cap Logic

- Redis key: `queue:unfollow_count:{accountId}:{YYYY-MM-DD-UTC}`
- TTL: 24 hours (auto-expires at midnight UTC)
- Incremented: by the worker on each successful unfollow
- Read: by startQueue() to calculate remaining capacity before enqueueing
- Reset: naturally via TTL expiry at midnight UTC

### Downgrade Grace Period

When a user cancels their subscription:
- Stripe sends customer.subscription.deleted
- handleTierDowngrade(userId, newTier) is called
- Excess accounts are flagged: pendingDisconnect=true, disconnectAt=now+7d
- UI shows warning with disconnection date
- Upgrade before disconnectAt to prevent deletion
- Disconnect cron at 01:00 UTC permanently deletes expired accounts

### Ghost Persistence Policy

- Ghost records are NEVER deleted on rescan
- On rescan: new ghosts are inserted; existing ghosts have scores updated
- When an unfollow succeeds: ghost.removedAt = new Date()
- When re-scanned and user now follows back: ghost record remains but filtered out of active list (filtered by removedAt = null)
- This design enables: "you removed X ghosts this month" stats, history charts, and future analytics

### Queue Ordering

Jobs are enqueued with staggered delay values (initial offset per job) to prevent all jobs becoming ready simultaneously. The worker processes one job at a time (concurrency=1) to maintain timing control.

### Freemium Upgrade Triggers

- Queue start attempt on Free: modal "Upgrade to Pro to start the ghost queue"
- Connection attempt on Free: modal "Upgrade to Pro to connect an Instagram account"
- Whitelist attempt on Pro: modal "Upgrade to Pro+ to protect accounts with whitelist"
- Daily cap hit: toast "Daily limit reached. Queue resumes at midnight UTC."
- Session expiry: banner "Instagram session expired. Reconnect your account."

---

## 17. TESTING STRATEGY

### Test Layers

```
Layer 4: Load Testing (Artillery)
  queue-load.yml -- 50 concurrent RPS, p95 < 50s threshold

Layer 3: E2E Testing (Playwright)
  landing.spec.ts (12 tests)     -- UI rendering, navigation, SEO
  full-journey.spec.ts (8 tests) -- Register, login, pricing CTAs
  security.spec.ts (9 tests)     -- Token leaks, JWT, rate limits

Layer 2: Integration Testing (Jest + Fastify inject)
  security-audit.test.ts (23 tests) -- Routes + static code audit
  Route integration tests           -- All API routes

Layer 1: Unit Testing (Jest)
  landing.test.tsx (40 tests)  -- React component rendering
  scoring.test.ts              -- Algorithm correctness, edge cases
  encryption.test.ts           -- Encrypt/decrypt roundtrips
  billing.test.ts              -- Stripe webhook idempotency
```

### Unit Tests — Landing Components

Location: `apps/web/src/__tests__/landing.test.tsx`

40 tests covering all 9 landing components and the full page composition.

Key patterns:
```typescript
// Test CTA hrefs
const cta = screen.getByRole('link', { name: /scan my account free/i });
expect(cta.getAttribute('href')).toBe('/register');

// Handle elements split across DOM nodes (gradient spans)
// Do not use getByText('Ghoast') -- the letters are in separate spans
// Use the aria-label instead:
expect(screen.getByRole('link', { name: /ghoast home/i })).toBeTruthy();

// Handle text appearing multiple times (e.g., $9.99 on Pro plan AND credits pack)
const matches = screen.getAllByText('$9.99');
expect(matches.length).toBeGreaterThanOrEqual(1);
```

Mock: `jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => '/' }))`

### Security Audit Tests

Uses Fastify's inject() for HTTP simulation — no real network, isolated test server.

Redis mock includes the rateLimit method required by @fastify/rate-limit's Redis store:
```typescript
rateLimit: jest.fn().mockImplementation((_k, _t, _m, _b, _c, cb) => {
  cb(null, [1, 60_000, false])  // [hits, ttlMs, isBlocked]
})
```

JWT tampering test uses mockImplementationOnce to override the auth module for a single call:
```typescript
vi.spyOn(authLib, 'verifyAccessToken').mockImplementationOnce(() => {
  throw new Error('jwt malformed')
})
```

### E2E Tests (Playwright)

Config: `apps/web/playwright.config.ts`
- Base URL: APP_URL env var (default http://localhost:3000)
- API URL: API_URL env var (default http://localhost:4000)
- Browsers: Chromium (primary), Firefox, WebKit

CI: .github/workflows/e2e.yml uses Docker Compose to spin up the full stack before running Playwright.

Key patterns:
```typescript
// Scroll to section before asserting visibility
await page.locator('#pricing').scrollIntoViewIfNeeded();
await expect(page.locator('#pricing')).toBeInViewport({ ratio: 0.1 });

// Mobile viewport test
await page.setViewportSize({ width: 375, height: 812 });
await page.goto('/');
```

### Load Tests (Artillery)

Location: `load-tests/queue-load.yml`

Phases:
- Warm-up: 5 RPS for 10 seconds
- Ramp-up: 5 to 50 RPS over 30 seconds
- Sustained: 50 RPS for 60 seconds

HTTP pool: 50 concurrent connections. Timeout: 60 seconds.

4 Scenarios (with weights):
- Auth health check (10): GET /health -> 200
- Fetch ghost list (40): GET /api/v1/accounts/:id/ghosts -> 200
- Start queue (30): POST /api/v1/queue/start -> 200, 400, or 409
- Poll queue status (20): GET /api/v1/queue/status/:id -> 200 or 404

Success thresholds:
- p95 response time < 50,000ms
- 500 error rate < 1%

---

## 18. FEATURE REQUIREMENTS REFERENCE

### Feature Inventory

| ID | Feature | Tier Gate | Build Status |
|----|---------|----------|--------|
| F001 | Instagram account connection (session cookie) | PRO | Complete |
| F002 | Ghost scan (following/followers diff) | Any (Free can scan) | Complete |
| F003 | Ghost list with filtering, sorting, search | Any | Complete |
| F004 | Tier 1-5 ghost scoring algorithm | Any | Complete |
| F005 | Bulk unfollow queue with rate-limit safety | PRO or Credits | Complete |
| F006 | Queue SSE real-time progress | Any | Complete |
| F007 | Daily cap enforcement (150/day) | PRO | Complete |
| F008 | Credit pack purchasing (Stripe) | Any | Complete |
| F009 | Subscription management (Stripe) | Any | Complete |
| F010 | Whitelist (protect up to 500 ghosts) | PRO_PLUS | Complete |
| F011 | Account snapshots (growth chart) | PRO_PLUS | Complete |
| F012 | CSV export of ghost list | PRO_PLUS | Complete |
| F013 | Manual unfollow (10/day free, unlimited Pro) | Any | Complete |

---

## 19. ENVIRONMENT VARIABLES REFERENCE

All variables defined in `.env.example`. Never committed to version control.

```bash
# Database
DATABASE_URL=postgresql://ghoast:ghoast@localhost:5432/ghoast

# Redis
REDIS_URL=redis://localhost:6379

# Session token encryption
# Generate: openssl rand -hex 32
SESSION_TOKEN_ENCRYPTION_KEY=

# JWT
# Generate: openssl rand -base64 64
JWT_SECRET=
JWT_REFRESH_SECRET=

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PROPLUS_MONTHLY=price_...
STRIPE_PRICE_CREDITS_100=price_...
STRIPE_PRICE_CREDITS_500=price_...
STRIPE_PRICE_CREDITS_1500=price_...

# Email
RESEND_API_KEY=re_...

# Analytics
POSTHOG_API_KEY=phc_...

# Error tracking
SENTRY_DSN=https://...@sentry.io/...

# App
NODE_ENV=production
PORT=4000
APP_URL=https://ghoast.app

# Mobile (future)
ONESIGNAL_APP_ID=
ONESIGNAL_API_KEY=
```

---

## 20. KNOWN ISSUES & OPEN QUESTIONS

Documented in BUILD-LOG.md. Unresolved at v1.0.0.

| ID | Category | Issue | Impact | Resolution Path |
|----|---------|-------|--------|-----------------|
| OQ-12 | Compliance | No account data deletion endpoint | Blocks GDPR compliance and App Store submission | Implement DELETE /api/v1/users/me — cascade delete all user data, cancel Stripe subscription |
| OQ-15 | Mobile | WebView Instagram login may be blocked on iOS native | Blocks iOS App Store submission | Accurate browser UA in WebView; submit under "Utilities" category |
| OQ-20 | Mobile | SSE connections killed when iOS app is backgrounded | Queue progress lost when phone locks | Implement OneSignal push notifications |
| OQ-22 | Instagram | Private API endpoints may change without notice | Queue failures for all users | Monitor endpoint responses; implement InstagramAPIChangedError with admin alert |
| OQ-25 | Scale | BullMQ worker per account scales linearly in memory | Memory pressure at 10,000+ concurrent users | Implement shared worker pool with account-level concurrency control |
| OQ-30 | Security | No refresh token rotation implemented | Stolen refresh token valid for 30 days | Implement refresh token family pattern (invalidate on reuse) |

---

## 21. VOCABULARY ENFORCEMENT

These terms apply in UI copy, variable names, function names, database column names, comments, API responses, and all documentation. Non-negotiable.

| Always Say | Never Say |
|-----------|-----------|
| ghosts | non-followers, unfollowers, people who do not follow back |
| ghost list | non-follower list, unfollow list |
| ghosting (the action) | unfollowing (in UI copy) |
| ghost analysis / ghost scan | follower audit |
| tier | category, rank, level, group |
| queue | batch, job list, task list |
| ratio | follower ratio (first mention only, then just "ratio") |

In code:
```typescript
// Correct
const ghostList = await getGhosts(accountId)
const ghostScore = scoreGhost(account)
const ghostTier = mapScoreToTier(priorityScore)

// Wrong
const nonFollowers = await getUnfollowers(accountId)
const followerAudit = scanFollowers(account)
```

---

## 22. CROSS-PLATFORM ARCHITECTURE ASSESSMENT

### Current Status (Web App)

The web application is complete and production-ready at v1.0.0. The backend architecture (BullMQ, PostgreSQL, REST API) is inherently platform-agnostic and requires no changes for mobile.

### Mobile Architecture (React Native + Expo)

Recommended framework: React Native + Expo (Managed Workflow)

Why Expo:
- Shares React component patterns with existing Next.js codebase
- Team already knows React — no new language (not Flutter/Dart)
- EAS Build builds .ipa and .aab in the cloud without local Xcode/Android Studio
- expo-secure-store handles iOS Keychain / Android Keystore natively
- OTA updates (Expo Updates) push JS changes without App Store review

Mobile project structure:
```
apps/
+-- web/       <- Next.js (existing)
+-- api/       <- Fastify (existing)
+-- mobile/    <- React Native + Expo (new)
    +-- app/   <- Expo Router (file-based, same pattern as Next.js App Router)
    +-- components/
    +-- lib/
```

### Mobile-Specific Architecture Changes Required

1. Auth token storage (REQUIRED): Never use AsyncStorage for tokens. Always use expo-secure-store:
   ```typescript
   await SecureStore.setItemAsync('refreshToken', token)
   const token = await SecureStore.getItemAsync('refreshToken')
   ```

2. Refresh token delivery: Mobile clients send X-Platform: mobile header. Auth routes return refresh token in body (not cookie). Mobile app stores in expo-secure-store.

3. Push notifications (OQ-20): Implement OneSignal:
   - Register device token on login
   - Server sends push via OneSignal API on: queue complete, session expired, rate limit pause, ratio milestone
   - New env vars: ONESIGNAL_APP_ID, ONESIGNAL_API_KEY

4. In-App Purchases — DO NOT IMPLEMENT INSIDE NATIVE APP:
   All purchases must happen at ghoast.app/pricing (web). The native app must contain NO purchase flow. This is the Netflix/Spotify model — legally sound, avoids Apple 30% cut.
   Display in app: "Manage your subscription at ghoast.app"
   Why: Apple App Store Rule 3.1.1 requires any digital goods purchases inside an iOS app to use Apple IAP. Violation = app rejection or removal.

5. Deep Linking:
   - Universal Links (iOS): .well-known/apple-app-site-association on ghoast.app
   - App Links (Android): .well-known/assetlinks.json on ghoast.app
   - Required for: auth redirects, email link -> app, marketing links

6. Data deletion (OQ-12): Required for both App Store and Play Store before mobile submission.

### App Store Risk Assessment

| Risk | Severity | Mitigation |
|------|---------|------------|
| Instagram ToS violation (private API) | High | Submit under "Utilities" not "Social Networking"; all API calls server-side |
| Apple Guideline 5.2 (IP/brand) | Medium | "Not affiliated with Instagram or Meta" in app description and footer |
| Stripe inside native app | Critical | Use web-only checkout (Netflix model) — never implement IAP |
| Data deletion missing | Critical | Implement OQ-12 before submission |
| Privacy nutrition labels | Required | Declare: email, account identifiers, usage data, Instagram session token |
| Google Data Safety section | Required | Same declarations for Play Store |

### Documentation Gaps for Mobile

Files that need new sections or creation before mobile build:

1. TECH-STACK.md: Add mobile framework (React Native + Expo), payment strategy (web-only), push notifications (OneSignal), mobile auth (expo-secure-store), deep linking
2. REQUIREMENTS.md: Add push notification requirements for mobile events
3. CLAUDE.md: Add mobile platform rules (never IAP inside native app, never AsyncStorage for tokens, always /api/v1/ prefix)
4. Create MOBILE-ARCHITECTURE.md: React Native + Expo setup, screen map, native APIs used, auth strategy
5. Create PLATFORM-COMPLIANCE.md: App Store submission guide, Play Store guide, Apple Privacy Labels, Google Data Safety, data deletion flow
6. Create README.md: Project setup, environment variables, how to run each service

---

*End of Technical Reference Manual — Ghoast v1.0.0*

*Document generated: 2026-02-26*

*This document was compiled from full codebase analysis including: apps/api/src/ (all services, workers, routes, plugins, lib), apps/web/src/ (all components, tests), packages/db/prisma/schema.prisma, packages/design-tokens/src/index.ts, and all project documentation files (CLAUDE.md, REQUIREMENTS.md, TECH-STACK.md, DESIGN-NOTES.md, GHOAST-PRD.md, MASTER-BUILD-PROMPT.md, BUILD-LOG.md).*
