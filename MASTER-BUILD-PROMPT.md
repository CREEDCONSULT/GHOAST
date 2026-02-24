# MASTER BUILD PROMPT — Ghoast Full Application

**Version:** 1.0
**Purpose:** Feed this entire file as the opening message of a new Claude session to build the complete Ghoast application from zero to production-ready, with testing, logging, and git commits at every step.

---

## SECTION 0 — HOW TO USE THIS PROMPT

### What This File Does
This is a complete, sequenced build prompt for the Ghoast SaaS application. It tells you (the AI) exactly what to build, in what order, how to test it, how to log it, and when to commit it. Every phase ends with a green test suite and a git commit. No phase is considered complete until all three are done.

### Before You Start
Have the following files open and readable in your context:
- `CLAUDE.md` — AI behaviour rules, vocabulary, architecture constraints
- `REQUIREMENTS.md` — All feature acceptance criteria (F001–F012)
- `TECH-STACK.md` — Technology decisions and configuration code
- `DESIGN-NOTES.md` — Design system (colors, typography, components)
- `GHOAST-PRD.md` — Full product requirements document

Read all five files completely before writing a single line of code.

### How to Proceed
1. Confirm you have read all 5 documents
2. Ask for any missing environment values (Stripe keys, etc.) before Phase 5
3. Work through phases **sequentially** — do not jump ahead
4. After each phase: tests must pass → log entry written → git commit made
5. If a test fails: fix it, re-run, then commit. Never commit red tests.
6. Report progress after each phase with: what was built, test results, commit hash

---

## SECTION 1 — YOUR ROLE & OUTPUT STANDARD

You are a **senior full-stack engineer** with production experience shipping Node.js + React SaaS applications. You write clean, secure, tested code. You do not cut corners on tests, security, or git hygiene.

**Output standard — every feature you build must meet this bar:**
- A developer who has never seen this codebase can understand what it does by reading the code
- Every route handler has error handling — no unhandled promise rejections
- Every sensitive operation is logged at the appropriate level (info/warn/error) — never logging secrets
- Every database write is inside a transaction where atomicity matters
- Every user-facing error message is specific and actionable — never "Something went wrong"

**You will never:**
- Skip writing tests for a feature
- Commit without running the test suite
- Hardcode secrets, API keys, or credentials
- Use `console.log` in production code (use the logger instead)
- Use `--no-verify` to bypass git hooks
- Leave `TODO` or `FIXME` comments in committed code without a linked issue
- Use raw SQL string concatenation (parameterised queries only)

---

## SECTION 2 — PROJECT CONTEXT

**Product:** Ghoast (`ghoast.app`) — Instagram follower intelligence tool
**Stack:** Next.js 14 (frontend) + Node.js/Fastify (API) + PostgreSQL + Redis + BullMQ
**Repo structure:** Monorepo with `apps/web`, `apps/api`, `packages/db`
**Brand vocabulary:** ghosts (not non-followers), ghost list, ghosting — enforced everywhere
**Full spec:** See GHOAST-PRD.md, REQUIREMENTS.md, TECH-STACK.md

---

## SECTION 3 — GIT WORKFLOW RULES

### Repository Setup (Phase 0)
```bash
git init ghoast
cd ghoast
git checkout -b main
```

### Branch Strategy
```
main          Production-ready code only. Protected.
dev           Integration branch. All feature branches merge here first.
feature/*     One branch per phase or major feature.
hotfix/*      Emergency fixes to main only.
```

**Working branch for each phase:**
```bash
git checkout dev
git checkout -b feature/phase-N-description
# ... build, test ...
git checkout dev
git merge --no-ff feature/phase-N-description
git push origin dev
```

**Merge to main only after Phase 10 final sign-off.**

### Commit Message Format
Follow Conventional Commits exactly:

```
type(scope): short description (max 72 chars)

[optional body — what changed and why, wrapped at 72 chars]

[optional footer — BREAKING CHANGE, closes #issue]
```

**Types:**
| Type | When to use |
|------|------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `test` | Adding or fixing tests |
| `chore` | Setup, config, tooling, deps |
| `refactor` | Code restructure without behaviour change |
| `docs` | Documentation only |
| `perf` | Performance improvement |
| `security` | Security fix |

**Scopes:** `auth`, `instagram`, `scan`, `scoring`, `dashboard`, `queue`, `payments`, `snapshots`, `export`, `whitelist`, `multiacccount`, `landing`, `infra`, `db`, `api`, `web`

**Examples:**
```
feat(auth): add JWT refresh token rotation
feat(scan): implement paginated following list fetch
feat(scoring): add post recency dimension to ghost scoring algorithm
feat(queue): implement BullMQ unfollow worker with rate limit pause
fix(queue): prevent Tier 5 accounts from entering queue
test(scoring): add edge cases for accounts with no posts
chore(infra): add Prisma migrations for initial schema
security(auth): encrypt Instagram session tokens with AES-256-CBC
```

### When to Commit
- After each sub-feature is built AND its tests pass
- After fixing a failing test
- Never mid-feature with partial, broken code
- At minimum: one commit per phase

### When to Push
```bash
# After every commit on feature branches:
git push origin feature/phase-N-description

# After merging to dev:
git push origin dev

# After Phase 10 final sign-off only:
git push origin main
git tag -a v1.0.0 -m "Ghoast v1.0.0 — MVP release"
git push origin v1.0.0
```

---

## SECTION 4 — LOGGING CONVENTION

### Application Logger
Use `pino` for structured JSON logging in the API. Never `console.log` in production code.

```javascript
// apps/api/lib/logger.js
const pino = require('pino');
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['session_token', 'session_token_encrypted', 'password', 'authorization'],
});
module.exports = logger;
```

**Log levels:**
| Level | When to use |
|-------|------------|
| `info` | Normal operation events (scan started, queue job completed) |
| `warn` | Recoverable issues (Instagram rate limit hit, retry attempted) |
| `error` | Errors requiring attention (scan failed, payment webhook failed) |
| `debug` | Detailed data for debugging (only in development, never production) |

**Required log events:**
```javascript
// Instagram API calls
logger.info({ account_id, endpoint }, 'instagram_api_call');

// Scan lifecycle
logger.info({ account_id, following_count }, 'scan_started');
logger.info({ account_id, ghost_count, duration_ms }, 'scan_completed');
logger.error({ account_id, error: err.message }, 'scan_failed');

// Queue lifecycle
logger.info({ account_id, job_count, tier_breakdown }, 'queue_started');
logger.info({ account_id, ghost_id }, 'unfollow_completed');
logger.warn({ account_id }, 'instagram_rate_limit_hit');
logger.error({ account_id, error: err.message }, 'queue_job_failed');

// Auth events
logger.info({ user_id }, 'user_registered');
logger.info({ user_id }, 'instagram_account_connected');
logger.warn({ account_id }, 'session_token_expired');

// Payments
logger.info({ user_id, tier }, 'subscription_created');
logger.info({ user_id, pack_type, credits }, 'credits_purchased');
logger.error({ event_type, error: err.message }, 'stripe_webhook_failed');
```

### Build Log (BUILD-LOG.md)
After every phase, append an entry to `BUILD-LOG.md` in the repo root.

**Entry format:**
```markdown
## Phase N — [Phase Name]
**Date:** YYYY-MM-DD HH:MM UTC
**Branch:** feature/phase-N-description
**Commit:** [short hash] [commit message]

### Built
- [List of files created or modified]
- [Key functions/classes implemented]

### Features Completed
- [F0XX]: [Feature name] — [AC count] acceptance criteria met

### Tests
| Suite | Tests | Passed | Failed | Skipped |
|-------|-------|--------|--------|---------|
| Unit  | N     | N      | 0      | 0       |
| Integration | N | N   | 0      | 0       |
| Total | N     | N      | 0      | 0       |

### Issues Encountered
- [Any problems hit during build and how they were resolved]

### Next Phase
- [What Phase N+1 will build]
```

**Error log entry format (when a test fails during build):**
```markdown
### ERROR LOG — [timestamp]
**Phase:** N
**Feature:** F0XX
**Test:** [test name]
**Error:** [exact error message]
**Root cause:** [what caused it]
**Fix:** [what was changed to resolve it]
**Resolution time:** [minutes to resolve]
```

---

## SECTION 5 — TESTING PROTOCOL

### Testing Stack
```
Unit tests:        Jest + ts-jest
API integration:   Supertest (against Fastify app)
Frontend:          React Testing Library + Jest
E2E:               Playwright
Test DB:           Separate PostgreSQL database (ghoast_test)
Test Redis:        Separate Redis DB index (DB 1)
```

### Test File Conventions
```
apps/api/src/
  services/scan.service.ts
  services/scan.service.test.ts     ← unit test alongside source

apps/api/src/
  routes/auth.routes.ts
  routes/auth.routes.test.ts        ← integration test alongside source

tests/e2e/
  auth.spec.ts
  ghost-list.spec.ts
  queue.spec.ts
```

### Test Coverage Requirements
Before any commit is allowed:
- **Unit tests:** minimum 80% line coverage on service files
- **Integration tests:** every API route has at least one happy-path and one error-path test
- **E2E tests:** every P0 user flow covered (Phase 10 only)

### Running Tests
```bash
# All tests
npm test

# Unit only
npm run test:unit

# Integration only
npm run test:integration

# E2E (requires running dev server)
npm run test:e2e

# With coverage report
npm run test:coverage

# Watch mode (development)
npm run test:watch
```

### Definition of "Passing"
A phase is complete and ready to commit when:
1. `npm test` exits with code 0
2. No test is `.skip`ped or `.todo`d without a comment explaining why
3. Coverage report shows ≥80% on modified service files
4. No TypeScript compilation errors (`npm run typecheck` exits 0)
5. No linting errors (`npm run lint` exits 0)

### Test Failure Protocol
If any test fails:
1. Read the full error output — do not guess the cause
2. Identify the root cause (logic error, missing mock, wrong assertion)
3. Fix the source code or test (whichever is wrong)
4. Re-run the full suite — not just the failing test
5. Only commit when the full suite is green
6. Add an error log entry to BUILD-LOG.md describing what failed and the fix

**Never do this:**
- Comment out a failing test
- Change an assertion to match wrong output
- Add `.skip` to make a test "pass"
- Commit with `--no-verify`

---

## SECTION 6 — BUILD PHASES

---

### PHASE 0 — Repository & Infrastructure Setup

**Goal:** Clean monorepo with working DB, Redis, and tooling configured. Nothing functional yet.

**Build tasks:**
```
1. Initialise git repo with main + dev branches
2. Create monorepo structure:
   ghoast/
   ├── apps/
   │   ├── web/         (Next.js 14, App Router)
   │   └── api/         (Node.js + Fastify)
   ├── packages/
   │   └── db/          (Prisma schema + migrations)
   ├── BUILD-LOG.md
   ├── .env.example
   ├── .gitignore
   ├── package.json     (workspaces)
   └── turbo.json       (Turborepo config — optional but recommended)

3. Configure tooling:
   - TypeScript (tsconfig.json per app)
   - ESLint + Prettier (shared config)
   - Jest (unit + integration)
   - Playwright (E2E, configured but no tests yet)

4. Write Prisma schema (all 8 tables from TECH-STACK.md / PRD Section 4.2)
5. Run `prisma migrate dev --name init`
6. Verify PostgreSQL connection
7. Verify Redis connection
8. Write .env.example with all required keys (see TECH-STACK.md)
9. Write .gitignore (node_modules, .env, dist, .next, coverage)
```

**Tests for Phase 0:**
```typescript
// tests/infra/db.test.ts
describe('Database connection', () => {
  it('connects to PostgreSQL successfully', async () => {
    await expect(prisma.$queryRaw`SELECT 1`).resolves.toBeDefined();
  });
  it('all 8 tables exist', async () => {
    // Query information_schema to confirm each table
  });
});

// tests/infra/redis.test.ts
describe('Redis connection', () => {
  it('connects to Redis successfully', async () => {
    const pong = await redis.ping();
    expect(pong).toBe('PONG');
  });
});
```

**Git commit:**
```
chore(infra): initialise monorepo with PostgreSQL, Redis, and Prisma schema

- Next.js 14 (App Router) frontend scaffold
- Fastify API scaffold with pino logging
- Prisma schema with all 8 tables (users, instagram_accounts, ghosts,
  unfollow_queue_jobs, queue_sessions, account_snapshots,
  credit_transactions, subscriptions)
- ESLint, Prettier, Jest, Playwright configured
- .env.example with all required environment variables
```

**Build log entry:** Write Phase 0 entry to BUILD-LOG.md before committing.

---

### PHASE 1 — Ghoast User Authentication

**Goal:** Users can register, log in, receive JWT tokens, and log out. No Instagram connection yet.

**Build tasks:**
```
1. POST /api/auth/register
   - Validate email + password (min 8 chars, email format)
   - Hash password with bcrypt (cost factor 12)
   - Create user record
   - Return access token + set refresh token as httpOnly cookie

2. POST /api/auth/login
   - Validate credentials
   - Return access token + set refresh token cookie
   - Log: user_id, 'user_logged_in'

3. POST /api/auth/refresh
   - Validate refresh token from httpOnly cookie
   - Issue new access token
   - Rotate refresh token (new token, old token invalidated)

4. DELETE /api/auth/logout
   - Clear refresh token cookie
   - Invalidate refresh token in DB (store refresh token hash in users table)

5. Auth middleware
   - Verify JWT on all protected routes
   - Attach user to request context

6. Input validation schema (Zod or Fastify JSON Schema)
   - Email: valid format, max 255 chars
   - Password: min 8 chars, max 128 chars
```

**Tests:**
```typescript
describe('POST /api/auth/register', () => {
  it('creates a new user and returns access token', async () => {});
  it('rejects duplicate email with 409', async () => {});
  it('rejects invalid email format with 400', async () => {});
  it('rejects password shorter than 8 chars with 400', async () => {});
  it('never returns password hash in response', async () => {});
  it('sets httpOnly refresh token cookie', async () => {});
});

describe('POST /api/auth/login', () => {
  it('returns access token for valid credentials', async () => {});
  it('rejects wrong password with 401', async () => {});
  it('rejects unknown email with 401', async () => {});
});

describe('POST /api/auth/refresh', () => {
  it('issues new access token from valid refresh token', async () => {});
  it('rotates refresh token on each use', async () => {});
  it('rejects expired refresh token with 401', async () => {});
});

describe('Auth middleware', () => {
  it('allows requests with valid Bearer token', async () => {});
  it('rejects requests with missing token with 401', async () => {});
  it('rejects requests with expired token with 401', async () => {});
  it('rejects requests with tampered token with 401', async () => {});
});
```

**Git commit:**
```
feat(auth): implement JWT authentication with refresh token rotation

- Register, login, logout, refresh endpoints
- bcrypt password hashing (cost factor 12)
- JWT access tokens (24h) + httpOnly refresh token cookies (30d)
- Refresh token rotation on every use
- Zod input validation on all auth routes
- Auth middleware for protected routes
```

---

### PHASE 2 — Instagram Account Connection

**Goal:** Authenticated users can connect their Instagram account via session cookie capture. Token is encrypted at rest.

**Build tasks:**
```
1. AES-256-CBC encryption module
   - encrypt(plaintext) → { ciphertext, iv }
   - decrypt(ciphertext, iv) → plaintext
   - Key sourced exclusively from SESSION_TOKEN_ENCRYPTION_KEY env var
   - Never log plaintext token or ciphertext

2. POST /api/accounts/connect
   - Receive session token from the frontend web view intercept
   - Validate token is a non-empty string (40+ chars, alphanumeric)
   - Encrypt token before storing
   - Fetch Instagram user info (handle, display_name, user_id) using the token
   - Create instagram_accounts record
   - Return: { id, handle, display_name, connected_at }
   - NEVER return session_token_encrypted or session_token_iv

3. DELETE /api/accounts/:id/disconnect
   - Verify account belongs to requesting user
   - Delete encrypted token from DB (or null it)
   - Cancel any pending queue jobs for this account
   - Return 204

4. GET /api/accounts
   - List connected accounts for the user
   - Never return session token fields

5. Session validity check utility
   - Try a lightweight Instagram API call to verify token is still valid
   - Return { valid: true } or throw SessionExpiredError

6. SessionExpiredError and RateLimitError custom error classes
```

**Tests:**
```typescript
describe('Encryption module', () => {
  it('encrypts and decrypts correctly', () => {
    const original = 'test_session_token_12345';
    const { ciphertext, iv } = encrypt(original);
    expect(decrypt(ciphertext, iv)).toBe(original);
  });
  it('produces different ciphertext for same input (random IV)', () => {
    const a = encrypt('same_input');
    const b = encrypt('same_input');
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
  });
  it('throws on decryption with wrong key', () => {
    // Tamper with ciphertext
  });
});

describe('POST /api/accounts/connect', () => {
  it('stores encrypted token and returns account info', async () => {});
  it('never returns session_token_encrypted in response', async () => {});
  it('rejects empty token with 400', async () => {});
  it('rejects if Instagram API call fails (invalid token)', async () => {});
  it('does not create duplicate accounts for same Instagram account', async () => {});
});

describe('DELETE /api/accounts/:id/disconnect', () => {
  it('removes account and nulls the token', async () => {});
  it('returns 403 if account belongs to different user', async () => {});
  it('cancels pending queue jobs for disconnected account', async () => {});
});

describe('GET /api/accounts', () => {
  it('returns connected accounts without token fields', async () => {
    const res = await request(app).get('/api/accounts').set(authHeader);
    expect(res.body[0]).not.toHaveProperty('session_token_encrypted');
    expect(res.body[0]).not.toHaveProperty('session_token_iv');
  });
});
```

**Git commit:**
```
security(instagram): implement Instagram session token capture and AES-256 encryption

- AES-256-CBC encryption/decryption module for session tokens
- POST /api/accounts/connect with token validation and encryption
- DELETE /api/accounts/:id/disconnect with queue cancellation
- Session token never returned in API responses (explicit field stripping)
- Custom SessionExpiredError and RateLimitError classes
```

---

### PHASE 3 — Ghost Scan Engine & Scoring Algorithm

**Goal:** Ghoast fetches the full following and followers lists, computes the ghost set, scores every ghost across 5 dimensions, and assigns tiers. This is the core intelligence feature.

**Build tasks:**
```
1. Instagram API client (lib/instagram.js)
   - getFollowing(userId, sessionToken, maxId?) → paginated list
   - getFollowers(userId, sessionToken, maxId?) → paginated list
   - getUserInfo(targetId, sessionToken) → account metadata
   - All methods: handle rate limit (throw RateLimitError), session expiry (throw SessionExpiredError)
   - Add randomised 500ms–2s delay between pagination calls
   - NEVER log sessionToken

2. Scan service (services/scan.service.ts)
   - startScan(accountId) → void (kicks off async scan)
   - Fetch all following pages (paginate until complete)
   - Fetch all followers pages (paginate until complete)
   - Compute ghost set = following MINUS followers
   - For each ghost: fetch getUserInfo for scoring dimensions
   - Save progress to DB on each page (resume-safe)
   - Update instagram_accounts.last_scan_at on completion
   - Emit progress events via Redis pub/sub

3. Ghost scoring algorithm (services/scoring.service.ts)
   - scoreGhost(ghostInfo: InstagramAccountInfo) → { score: number, tier: number }
   - Dimension 1: Account Type Classification (0–20)
   - Dimension 2: Follower-to-Following Ratio (0–20)
   - Dimension 3: Engagement Proxy (0–20, default 0 if unknown)
   - Dimension 4: Account Size Band (0–20)
   - Dimension 5: Post Recency (0–20)
   - Total = sum of 5 dimensions (0–100)
   - Tier = lookup from score range (see REQUIREMENTS.md)
   - Set engagement_unknown = true if engagement data unavailable

4. POST /api/accounts/:id/scan
   - Trigger scan (async — returns 202 immediately)
   - Reject if scan already in progress (409)

5. GET /api/accounts/:id/scan/progress
   - Return: { status, following_scanned, following_total, ghost_count_so_far }

6. Scan SSE endpoint
   - GET /api/accounts/:id/scan/stream
   - Push progress events until scan completes
```

**Tests:**
```typescript
describe('Ghost scoring algorithm', () => {
  // Dimension 1 — Account type
  it('scores personal accounts 0-5', () => {});
  it('scores celebrity/verified accounts 18-20', () => {});
  it('scores brand accounts 15-18', () => {});

  // Dimension 2 — Ratio
  it('scores high-ratio accounts (1000:1) as 20', () => {});
  it('scores low-ratio accounts (<1.0) as 0-3', () => {});

  // Dimension 3 — Engagement
  it('scores accounts with recent engagement 15-20', () => {});
  it('scores accounts with no engagement as 0', () => {});
  it('sets engagement_unknown=true when data unavailable', () => {});

  // Dimension 4 — Account size
  it('scores nano accounts (< 1K) as 0-3', () => {});
  it('scores mega accounts (> 1M) as 18-20', () => {});

  // Dimension 5 — Post recency
  it('scores accounts last active 90+ days ago as 15-20', () => {});
  it('scores accounts active within 30 days as 0-3', () => {});
  it('scores accounts with no posts as 15', () => {});

  // Tier mapping
  it('assigns Tier 1 for score 0-20', () => {});
  it('assigns Tier 5 for score 81-100', () => {});
  it('total score is always 0-100', () => {});
});

describe('Scan service', () => {
  it('correctly computes ghost set as following MINUS followers', async () => {});
  it('saves ghosts to DB with correct scores and tiers', async () => {});
  it('handles paginated following list (>200 accounts)', async () => {});
  it('resumes from saved progress if scan is interrupted', async () => {});
  it('updates last_scan_at on completion', async () => {});
  it('throws SessionExpiredError when Instagram returns 401', async () => {});
  it('throws RateLimitError when Instagram returns 429', async () => {});
});

describe('POST /api/accounts/:id/scan', () => {
  it('returns 202 immediately and starts scan asynchronously', async () => {});
  it('returns 409 if scan is already in progress', async () => {});
  it('returns 403 if account belongs to different user', async () => {});
});
```

**Git commits (2):**
```
feat(instagram): implement paginated following/followers API client

feat(scan): implement ghost scan engine and 5-dimension scoring algorithm

- Full following + followers list pagination with resume-on-failure
- Ghost set computation (following MINUS followers)
- Scoring: account type, ratio, engagement proxy, size band, post recency
- Tier assignment (1-5) based on score range 0-100
- Progress tracking via Redis pub/sub
- POST /api/accounts/:id/scan (202 async response)
- GET /api/accounts/:id/scan/stream SSE progress endpoint
```

---

### PHASE 4 — Ghost List Dashboard

**Goal:** Users can view their ranked ghost list, filter by tier, search, and manually unfollow up to 10 per day.

**Build tasks:**
```
1. GET /api/accounts/:id/ghosts
   - Paginated (default 50 per page)
   - Query params: tier (1-5), sort (score|followers|last_post), search (handle/name)
   - Returns: ghosts array + pagination meta + account stats
   - Strips any Instagram session fields

2. POST /api/accounts/:id/ghosts/:ghostId/unfollow
   - Check user owns account
   - Check ghost exists and is not yet removed
   - Check free tier daily cap: 10/day rolling window (Redis counter)
   - Execute unfollow via Instagram API
   - Mark ghost.removed_at
   - Return 200 { success: true }
   - On cap reached: 429 with { error: 'daily_limit_reached', upgrade_url: '/pricing' }

3. GET /api/accounts/:id/stats
   - Returns: followers_count, following_count, ghost_count, ratio, tier_breakdown
   - tier_breakdown: { tier_1: N, tier_2: N, tier_3: N, tier_4: N, tier_5: N }

4. Daily cap enforcement
   - Redis key: daily_unfollow:{account_id} with TTL to midnight UTC
   - Increment on each successful manual unfollow
   - Check before executing unfollow

5. Next.js dashboard pages
   - /dashboard — stats overview + tier summary cards
   - /dashboard/ghost-list — full ranked ghost list with filters
   - Client-side: tier filter tabs, search input, sort dropdown
   - Unfollow button per row with optimistic UI (remove row immediately, rollback on error)
   - "X of 10 remaining" counter for free users
   - Upgrade prompt when cap reached (see REQUIREMENTS.md upgrade triggers)
```

**Tests:**
```typescript
describe('GET /api/accounts/:id/ghosts', () => {
  it('returns ghosts sorted by priority_score ascending by default', async () => {});
  it('filters by tier correctly', async () => {});
  it('searches by handle substring', async () => {});
  it('paginates with correct total count', async () => {});
  it('does not return session token fields', async () => {});
});

describe('POST /api/accounts/:id/ghosts/:ghostId/unfollow', () => {
  it('unfollows and marks ghost.removed_at', async () => {});
  it('returns 429 when daily cap of 10 is reached', async () => {});
  it('does not decrement cap counter when Instagram API call fails', async () => {});
  it('returns 404 if ghost does not belong to this account', async () => {});
  it('returns 409 if ghost is already removed', async () => {});
  it('daily cap resets at midnight UTC', async () => {
    // Mock time to next day, verify counter resets
  });
});

describe('Daily cap counter', () => {
  it('starts at 0 for a new day', async () => {});
  it('increments correctly on each unfollow', async () => {});
  it('blocks at exactly 10', async () => {});
});
```

**Git commit:**
```
feat(dashboard): implement ghost list dashboard with manual unfollow and daily cap

- GET /api/accounts/:id/ghosts with tier filter, search, sort, pagination
- POST /api/accounts/:id/ghosts/:id/unfollow with 10/day cap (Redis counter)
- GET /api/accounts/:id/stats with tier breakdown
- Daily cap counter with midnight UTC TTL reset
- Next.js dashboard: /dashboard, /dashboard/ghost-list
- Upgrade prompt shown on cap hit (trigger type: daily_limit_reached)
```

---

### PHASE 5 — Payments & Subscriptions

**Goal:** Stripe integration for Pro subscriptions and credit pack purchases. Freemium gate enforced on all gated features.

**Build tasks:**
```
1. Stripe setup
   - Install stripe SDK
   - Create Stripe products in dashboard (Pro monthly, Pro+ monthly, 3 credit packs)
   - Copy price IDs to .env

2. POST /api/billing/subscribe
   - Create Stripe Checkout session for Pro or Pro+ tier
   - Redirect user to Stripe Checkout
   - On success: Stripe webhook updates subscription status

3. POST /api/billing/credits
   - Create Stripe Payment Intent for selected credit pack
   - Return client_secret for frontend to complete payment
   - On success: webhook credits the account

4. GET /api/billing/portal
   - Create Stripe Customer Portal session
   - Return URL for user to manage subscription (cancel, update card)

5. POST /api/webhooks/stripe (CRITICAL — must be idempotent)
   - Verify Stripe signature on every request (raw body)
   - Handle:
     - invoice.payment_succeeded → activate/confirm subscription
     - customer.subscription.deleted → downgrade to Free, notify user
     - customer.subscription.updated → update tier in DB
     - payment_intent.succeeded → credit pack: add credits to user
       (guard with stripe_payment_intent_id uniqueness)
   - Log every webhook event (type, result)
   - Return 200 immediately even if processing fails (retry logic is Stripe's job)

6. Freemium gate middleware
   - checkTier(requiredTier: 'pro' | 'pro_plus') middleware
   - Returns 403 with { error: 'upgrade_required', tier_needed: '...', upgrade_url: '/pricing' }
   - Applied to: bulk queue routes, snapshot routes, export route, whitelist routes

7. Credit balance management
   - getBalance(userId) → number
   - consumeCredit(userId) → new balance (inside transaction)
   - Guard: consumeCredit is atomic — no race conditions under concurrent jobs
```

**Tests:**
```typescript
describe('Stripe webhook handler', () => {
  it('rejects webhooks with invalid signature with 400', async () => {});

  it('activates Pro subscription on invoice.payment_succeeded', async () => {});
  it('downgrades user to Free on customer.subscription.deleted', async () => {});

  it('adds 100 credits on payment_intent.succeeded for starter pack', async () => {});
  it('adds 500 credits for standard pack', async () => {});
  it('adds 1500 credits for power pack', async () => {});

  it('is idempotent — duplicate webhook does not add credits twice', async () => {
    const paymentIntentId = 'pi_test_123';
    await processWebhook({ paymentIntentId, pack: 'starter' });
    await processWebhook({ paymentIntentId, pack: 'starter' }); // duplicate
    const balance = await getBalance(userId);
    expect(balance).toBe(100); // not 200
  });
});

describe('Freemium gate middleware', () => {
  it('allows Pro route access for Pro users', async () => {});
  it('blocks Pro route access for Free users with 403', async () => {});
  it('allows Pro+ route access for Pro+ users', async () => {});
  it('blocks Pro+ route access for Pro users with 403', async () => {});
});

describe('Credit management', () => {
  it('getBalance returns correct credit count', async () => {});
  it('consumeCredit decrements by exactly 1', async () => {});
  it('consumeCredit is atomic under concurrent calls', async () => {
    // Run 10 concurrent consumeCredit calls with balance of 5
    // Expect exactly 5 to succeed and 5 to fail
  });
  it('consumeCredit fails gracefully when balance is 0', async () => {});
});
```

**Git commits (2):**
```
feat(payments): integrate Stripe subscriptions and credit pack purchases

feat(payments): implement idempotent Stripe webhook handler and freemium gate

- invoice.payment_succeeded → subscription activation
- customer.subscription.deleted → downgrade to Free
- payment_intent.succeeded → credit addition (idempotent on payment_intent_id)
- checkTier middleware applied to all Pro/Pro+ routes
- Atomic credit consumption with transaction guard
```

---

### PHASE 6 — Bulk Unfollow Queue

**Goal:** Pro users and credit pack users can queue multiple unfollows. Queue runs in the background with Instagram-safe delays. Real-time status via SSE.

**Build tasks:**
```
1. Queue configuration (config/queue.js)
   - All timing constants from REQUIREMENTS.md (copy exactly)
   - Never hardcode in worker files — always import from config

2. BullMQ queue setup
   - Queue: 'unfollow-queue'
   - One worker per instagram_account_id
   - Concurrency: 1 per worker

3. Queue worker (workers/unfollow.worker.ts)
   - Process one job at a time (one unfollow action)
   - Read job data: { ghost_id, account_id, session_token_encrypted, session_token_iv }
   - Decrypt session token in memory (use encryption lib)
   - Call Instagram unfollow API
   - On success: mark ghost.removed_at, mark job completed, consume credit if applicable
   - Add randomised delay BEFORE next job (read from Redis job count for session pause logic)
   - On RateLimitError: pause worker for RATE_LIMIT_PAUSE_MS, log warn event
   - On SessionExpiredError: pause worker, emit 'session_expired' event to user
   - On 3 consecutive rate limits: pause for 24h
   - Increment unfollow counter (shared with daily cap from Phase 4)
   - Publish job completion to Redis pub/sub channel

4. POST /api/queue/start
   - Requires Pro tier or credit balance > 0
   - Body: { ghost_ids: string[] }
   - Validate: no Tier 5 ghosts (hard reject — not a soft warning)
   - Validate: ghost_ids.length <= daily_cap_remaining
   - Create queue_session record
   - Enqueue all jobs with calculated delays
   - Start worker for this account
   - Return: { session_id, job_count, estimated_completion_minutes }

5. POST /api/queue/pause and /api/queue/cancel
   - Pause: pause the BullMQ worker for this account
   - Cancel: remove all waiting jobs, mark session as cancelled

6. SSE endpoint: GET /api/queue/status/:account_id
   - Subscribe to Redis pub/sub channel for this account
   - Push events: { type: 'job_completed', ghost_id, remaining, countdown_seconds }
   - Push: { type: 'queue_paused', reason, resume_at }
   - Push: { type: 'queue_completed', total_removed, duration_ms }
   - Push: { type: 'session_expired' }
   - Client must reconnect after server restart (SSE handles this)

7. Tier 5 protection (hard block — must be in 3 places):
   - POST /api/queue/start rejects ghost_ids containing Tier 5 ghosts
   - Worker checks tier before executing (belt-and-suspenders)
   - Frontend disables Tier 5 checkboxes (UI layer only — not sole protection)
```

**Tests:**
```typescript
describe('Queue worker', () => {
  it('unfollows an account and marks ghost.removed_at', async () => {});
  it('adds correct randomised delay between jobs (8s–45s range)', async () => {});
  it('inserts session pause after every 10-15 jobs', async () => {});
  it('pauses for 15 min on Instagram rate limit response', async () => {});
  it('pauses for 24h after 3 consecutive rate limits', async () => {});
  it('does NOT consume a credit when unfollow API call fails', async () => {});
  it('publishes job_completed event to Redis pub/sub', async () => {});
  it('refuses to unfollow Tier 5 accounts even if directly enqueued', async () => {});
});

describe('POST /api/queue/start', () => {
  it('enqueues jobs and returns 202 with session_id', async () => {});
  it('rejects ghost_ids containing Tier 5 accounts with 400', async () => {
    const tier5Id = await createGhost({ tier: 5 });
    const res = await request(app).post('/api/queue/start').send({ ghost_ids: [tier5Id] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/auto-protected/i);
  });
  it('rejects if job count exceeds daily cap remaining', async () => {});
  it('returns 403 for Free users without credits', async () => {});
  it('allows credit pack users to start queue', async () => {});
});

describe('Queue session management', () => {
  it('creates queue_session record on start', async () => {});
  it('updates jobs_completed count as jobs finish', async () => {});
  it('marks session completed when all jobs done', async () => {});
  it('marks session cancelled on /api/queue/cancel', async () => {});
});

describe('SSE endpoint', () => {
  it('delivers job_completed event within 1s of job completion', async () => {});
  it('delivers queue_completed event when all jobs finish', async () => {});
  it('delivers session_expired event when token expires mid-queue', async () => {});
});
```

**Git commits (2):**
```
feat(queue): implement BullMQ unfollow queue worker with Instagram-safe rate limiting

- Queue config centralised in config/queue.js
- Worker: 8-45s randomised delays, session pauses every 10-15 jobs
- 15-min pause on rate limit, 24h pause after 3 consecutive rate limits
- Tier 5 hard block in worker (belt-and-suspenders)
- Credit consumption on job completion (not on failure)

feat(queue): implement queue management API and SSE real-time status

- POST /api/queue/start with Tier 5 validation and daily cap check
- POST /api/queue/pause and /api/queue/cancel
- GET /api/queue/status/:account_id SSE stream
- Redis pub/sub for real-time event delivery
```

---

### PHASE 7 — Pro Features (Snapshots + CSV Export)

**Goal:** Pro users get daily ratio tracking and can export their ghost list as a CSV.

**Build tasks:**
```
1. Snapshot service (services/snapshot.service.ts)
   - takeSnapshot(accountId) → snapshot record
   - Reads current followers_count, following_count, ghost_count from account
   - Calculates ratio
   - Inserts into account_snapshots table

2. Cron job: daily snapshots at 00:00 UTC
   - Use node-cron or BullMQ repeatable job
   - For every Pro/Pro+ instagram_account: call takeSnapshot
   - Log: accounts_snapshotted, errors

3. GET /api/accounts/:id/snapshots
   - Returns last 30 snapshots for Pro, all for Pro+
   - Ordered by taken_at desc
   - Used by frontend growth chart

4. GET /api/accounts/:id/ghosts/export
   - Requires Pro tier
   - Streams CSV response
   - Headers: Content-Type: text/csv, Content-Disposition: attachment; filename="ghoast-export-{handle}-{date}.csv"
   - Columns: display_name, handle, followers, following, ratio, tier, priority_score, last_post_date, account_type
   - Generates in < 5 seconds for 5,000 rows
   - Never write CSV to disk — stream directly to response
```

**Tests:**
```typescript
describe('Snapshot service', () => {
  it('takes snapshot with correct follower/following/ghost counts', async () => {});
  it('calculates ratio correctly (following / followers, 2 decimal places)', async () => {});
  it('saves snapshot to account_snapshots table', async () => {});
});

describe('GET /api/accounts/:id/snapshots', () => {
  it('returns correct number of snapshots (30 for Pro)', async () => {});
  it('returns 403 for Free users', async () => {});
});

describe('GET /api/accounts/:id/ghosts/export', () => {
  it('returns CSV with correct column headers', async () => {
    const res = await request(app).get(`/api/accounts/${id}/ghosts/export`).set(proAuthHeader);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const firstLine = res.text.split('\n')[0];
    expect(firstLine).toBe('display_name,handle,followers,following,ratio,tier,priority_score,last_post_date,account_type');
  });
  it('filename contains handle and date', async () => {});
  it('returns one row per ghost (correct count)', async () => {});
  it('returns 403 for Free users', async () => {});
  it('completes within 5 seconds for 5000 rows', async () => {}, 6000);
});
```

**Git commit:**
```
feat(snapshots): add daily account snapshots and growth tracking

feat(export): implement CSV ghost list export for Pro users

- Daily cron: takeSnapshot for all Pro/Pro+ accounts at 00:00 UTC
- GET /api/accounts/:id/snapshots (30d Pro, unlimited Pro+)
- GET /api/accounts/:id/ghosts/export — streamed CSV, no disk write
- Correct column set, filename format, Content-Disposition header
```

---

### PHASE 8 — Pro+ Features (Multi-Account + Whitelist)

**Goal:** Pro+ users can connect up to 3 accounts and whitelist accounts that should never be queued.

**Build tasks:**
```
1. Multi-account enforcement
   - On POST /api/accounts/connect: check current account count for user
   - Free/Pro: max 1 account (reject with 403 if already connected)
   - Pro+: max 3 accounts
   - 7-day grace period on downgrade: flag accounts as pending_disconnect, cron removes after 7 days

2. Whitelist API
   - POST /api/accounts/:id/ghosts/:ghostId/whitelist — add to whitelist
   - DELETE /api/accounts/:id/ghosts/:ghostId/whitelist — remove from whitelist
   - GET /api/accounts/:id/whitelist — list all whitelisted ghosts
   - Enforce: max 500 per account

3. Whitelist enforcement in queue worker
   - Before executing any unfollow job: check ghost.is_whitelisted
   - If whitelisted: skip job, mark as 'skipped', do NOT consume credit
   - Log: { account_id, ghost_id }, 'unfollow_skipped_whitelisted'

4. Whitelist enforcement in POST /api/queue/start
   - Filter out whitelisted ghosts before enqueueing (server-side, not only UI)
```

**Tests:**
```typescript
describe('Multi-account enforcement', () => {
  it('allows Free user to connect 1 account', async () => {});
  it('rejects Free user connecting a second account with 403', async () => {});
  it('allows Pro+ user to connect up to 3 accounts', async () => {});
  it('rejects Pro+ user connecting a 4th account with 403', async () => {});
});

describe('Whitelist', () => {
  it('adds ghost to whitelist', async () => {});
  it('removes ghost from whitelist', async () => {});
  it('returns full whitelist for the account', async () => {});
  it('rejects whitelist addition when limit of 500 is reached', async () => {});
  it('requires Pro+ tier (403 for Free and Pro)', async () => {});
});

describe('Whitelist enforcement in queue', () => {
  it('skips whitelisted ghost during queue processing', async () => {
    await whitelistGhost(accountId, ghostId);
    await startQueue(accountId, [ghostId]);
    // Wait for processing
    const ghost = await getGhost(ghostId);
    expect(ghost.removed_at).toBeNull(); // NOT unfollowed
  });
  it('does not consume a credit for a skipped whitelisted ghost', async () => {});
  it('POST /api/queue/start silently removes whitelisted ghosts from job list', async () => {});
});
```

**Git commit:**
```
feat(multiacccount): enforce per-tier account connection limits with grace period downgrade

feat(whitelist): implement whitelist rules for Pro+ users with queue enforcement

- POST/DELETE /api/accounts/:id/ghosts/:id/whitelist
- 500 account maximum per instagram_account
- Worker: skips whitelisted ghosts, no credit consumed, logged
- POST /api/queue/start: server-side whitelist filtering before enqueue
```

---

### PHASE 9 — Landing Page

**Goal:** Port `ghoast-brand.jsx` into a production Next.js landing page with SEO, mobile responsiveness, and working CTAs.

**Build tasks:**
```
1. Port ghoast-brand.jsx into /app/page.tsx (server component)
   - Extract CSS variables into app/globals.css
   - Break into component files:
     - components/landing/Nav.tsx
     - components/landing/Hero.tsx
     - components/landing/HeroWidget.tsx
     - components/landing/Marquee.tsx
     - components/landing/HowItWorks.tsx
     - components/landing/TierSection.tsx
     - components/landing/StatStrip.tsx
     - components/landing/DashboardPreview.tsx
     - components/landing/Pricing.tsx
     - components/landing/Footer.tsx

2. SEO
   - metadata export in /app/layout.tsx
   - Title: "Ghoast — See Who Ghosted Your Count"
   - Description: "Instagram follower intelligence tool. Find your ghosts, rank them, bulk-unfollow automatically."
   - OG tags (og:image, og:title, og:description)
   - Twitter card meta tags
   - Canonical URL

3. CTA wiring
   - "Scan My Account Free →" → /login?intent=connect (or /register)
   - "See how it works" → smooth scroll to #how-it-works section
   - Pricing CTA buttons → /register?plan=free|pro|pro_plus

4. Mobile responsive
   - Apply responsive styles from DESIGN-NOTES.md
   - Grid collapse: 3-col → 1-col below 768px
   - Nav links hidden on mobile (hamburger menu or simplified)
   - Touch targets min 44px

5. Performance
   - Google Fonts loaded with `display=swap`
   - Images optimised with next/image if any
   - No client-side JS on landing page (Server Component by default)
   - Interactive elements (countdown, animated bars) isolated to 'use client' components
```

**Tests:**
```typescript
describe('Landing page', () => {
  it('renders without JavaScript errors', async () => {});
  it('hero section contains correct primary CTA text', async () => {
    render(<HomePage />);
    expect(screen.getByText('Scan My Account Free →')).toBeInTheDocument();
  });
  it('pricing section shows correct prices ($0, $9.99, $24.99)', async () => {});
  it('contains correct SEO meta title', async () => {});
});

// Playwright E2E
test('landing page loads and CTA navigates to register', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Scan My Account Free');
  await expect(page).toHaveURL(/register/);
});

test('Lighthouse performance score > 80', async ({ page }) => {
  // Use playwright-lighthouse integration
});

test('responsive: nav links hidden on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const navLinks = page.locator('.nav-links');
  await expect(navLinks).not.toBeVisible();
});
```

**Git commit:**
```
feat(landing): port brand JSX to production Next.js landing page

- Componentised into 10 landing components
- SEO: meta title, description, OG tags, Twitter card
- Mobile responsive (768px breakpoint, grid collapse)
- CTAs wired to /register and /login
- Server Components by default, 'use client' only for animations
```

---

### PHASE 10 — End-to-End Testing, Security Audit & Release

**Goal:** Full E2E test suite passes. Security audit clean. Tag v1.0.0.

**Build tasks:**
```
1. Full Playwright E2E suite
   - Complete user journey: register → connect Instagram → scan → view ghost list → start queue → see completion
   - Free user journey: hit daily cap → see upgrade prompt → pricing page
   - Pro user journey: bulk queue → live counter → completion
   - Checkout flow: Free → Pro (mock Stripe in E2E)

2. Load test (artillery or k6)
   - 50 concurrent queue workers processing simultaneously
   - Verify: no deadlocks, no credit double-deductions, no queue job cross-contamination
   - Target: p95 job processing time < 50s (including max delay)

3. Security audit checklist:
   ✓ session_token_encrypted never appears in any API response (automated check)
   ✓ password/password_hash never appears in any API response
   ✓ All Stripe webhooks verify signature before processing
   ✓ All SQL uses parameterised queries (grep for raw SQL patterns)
   ✓ No secrets in git history (git-secrets or trufflehog scan)
   ✓ JWT tokens reject tampered payloads
   ✓ Tier 5 accounts cannot be enqueued via API (not just UI)
   ✓ Rate limiting active on all public endpoints
   ✓ Error messages never expose stack traces to clients in production

4. BUILD-LOG.md — Phase 10 entry:
   - Full test results summary
   - Load test results
   - Security audit results
   - Known issues (link to any open issues in tracker)

5. Final release:
   git checkout main
   git merge --no-ff dev
   git tag -a v1.0.0 -m "Ghoast v1.0.0 — MVP release"
   git push origin main
   git push origin v1.0.0
```

**E2E Tests:**
```typescript
// tests/e2e/full-journey.spec.ts
test.describe('Full user journey', () => {
  test('Free user: register → connect → scan → view ghost list → hit daily cap → upgrade prompt', async ({ page }) => {});
  test('Pro user: register → subscribe → connect → scan → start queue → see live countdown → completion', async ({ page }) => {});
});

// tests/e2e/security.spec.ts
test.describe('Security checks', () => {
  test('session token never appears in any API response', async ({ request }) => {
    // Fetch all API endpoints, check no response body contains session_token
  });
  test('Tier 5 ghost cannot be enqueued via direct API call', async ({ request }) => {
    const res = await request.post('/api/queue/start', { data: { ghost_ids: [tier5GhostId] } });
    expect(res.status()).toBe(400);
  });
  test('tampered JWT is rejected', async ({ request }) => {});
});
```

**Final git commit:**
```
release: tag v1.0.0 — Ghoast MVP

All P0 features complete:
- F001: Instagram account connection (AES-256 session token encryption)
- F002: Ghost scan engine (paginated, resume-safe)
- F003: Ghost scoring algorithm (5 dimensions, 5 tiers)
- F004: Ghost list dashboard (filter, sort, search)
- F005: Manual unfollow with 10/day cap
- F006: Bulk unfollow queue (BullMQ, Instagram-safe delays)
- F012: Credit packs (Stripe, idempotent webhooks)

P1 features complete:
- F007: Daily snapshots + growth chart
- F008: CSV export
- F009: Multi-account (Pro+)
- F010: Whitelist rules (Pro+)
- Landing page (Next.js, SEO, mobile responsive)

Test coverage: >80% unit, 100% API route integration, full E2E
Security audit: clean
```

---

### PHASE 11 — Mobile App (React Native + Expo)

**Goal:** Production-ready iOS and Android app with full feature parity to the web dashboard for all P0 and P1 features. Read `MOBILE-ARCHITECTURE.md` before starting this phase.

**Prerequisites:** Phase 10 web release complete. All `/api/v1/` routes verified. OneSignal account set up. EAS project created.

**Build tasks:**
```
1. Scaffold apps/mobile/
   - Initialize Expo managed workflow: npx create-expo-app apps/mobile --template blank-typescript
   - Install all packages from MOBILE-ARCHITECTURE.md key packages section
   - Configure app.json (bundleIdentifier, scheme: 'ghoast', splash, plugins)
   - Configure eas.json (development, preview, production profiles)
   - Set up Expo Router v3 file-based routing

2. Shared design tokens
   - Create packages/design-tokens/src/index.ts
   - Export: colors, tiers, spacing, fontSizes
   - Verify import works from both apps/web and apps/mobile

3. Auth screens
   - app/(auth)/login.tsx — email/password form, calls POST /api/v1/auth/login
   - app/(auth)/register.tsx — name/email/password, calls POST /api/v1/auth/register
   - lib/auth.ts — SecureStore token storage (getAccessToken, saveTokens, clearTokens)
   - lib/api.ts — Base API client with X-Platform: mobile header + auto-refresh logic
   - Root _layout.tsx — auth gate: check SecureStore → redirect to login if no token

4. Instagram connect screen
   - app/(auth)/connect.tsx — ToS disclosure view + react-native-webview Instagram login
   - Use realistic iOS Safari user agent (see MOBILE-ARCHITECTURE.md)
   - On login success: call POST /api/v1/accounts/connect-mobile
   - Deep link: ghoast://connect → handled by Expo Router

5. Dashboard screen
   - app/(app)/dashboard.tsx
   - Stats cards: followers, following, ghost count, ratio
   - 30-day ratio line chart (react-native-gifted-charts)
   - Last scanned timestamp
   - Rescan button → POST /api/v1/accounts/:id/scan

6. Ghost list screen
   - app/(app)/ghosts/index.tsx
   - FlatList (NOT ScrollView) — handles 5,000 items with virtualization
   - GhostRow component: avatar, handle, tier badge, score, Unfollow button
   - TierFilterTabs — horizontal scroll, filters FlatList data
   - Search input — filters by handle/display name (client-side on loaded data)
   - Manual unfollow: POST /api/v1/accounts/:id/ghosts/:id/unfollow
   - Daily cap counter: "X of 10 remaining" badge
   - On cap reached: show UpgradePrompt modal with browser link to ghoast.app/billing

7. Queue screen
   - app/(app)/queue.tsx
   - Tier selection checkboxes (Tier 5 disabled — "Auto-protected" tooltip)
   - "Start Queue" button → POST /api/v1/queue/start
   - Active queue status card: current position, % complete, estimated time
   - Queue polls GET /api/v1/queue/status/:account_id every 10 seconds (no SSE on mobile)
   - Queue history: last 30 completed runs

8. Settings screen
   - app/(app)/settings.tsx
   - Connected Instagram account display
   - Notification preferences (toggles stored server-side)
   - "Manage Billing" → opens browser to ghoast.app/billing (Linking.openURL)
   - "Delete Account" → confirmation dialog → DELETE /api/v1/users/me
   - "Sign Out" → clearTokens() + OneSignal.logout() + redirect to login

9. Push notifications
   - lib/notifications.ts — OneSignal.initialize + login + addTag('user_id')
   - Permission prompt shown after first successful scan (not on app launch)
   - Foreground handler: custom in-app banner
   - Background tap handler: navigate to correct screen using data.screen payload
   - Settings screen: notification preference toggles

10. Deep linking
    - Verify apple-app-site-association is served at ghoast.app/.well-known/
    - Verify assetlinks.json is served at ghoast.app/.well-known/
    - Test: email link → ghoast://queue opens queue screen
    - Test: ghoast://connect → opens connect screen
```

**Tests:**
```typescript
describe('Auth token storage', () => {
  it('saves tokens to SecureStore on login', async () => {});
  it('clears tokens from SecureStore on logout', async () => {});
  it('refreshes access token automatically when 401 received', async () => {});
  it('redirects to login when refresh fails', async () => {});
  it('never writes tokens to AsyncStorage', async () => {
    // Spy on AsyncStorage.setItem — should never be called
    const spy = jest.spyOn(AsyncStorage, 'setItem');
    await login(testCredentials);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('API client — X-Platform header', () => {
  it('always sends X-Platform: mobile header', async () => {
    const requests: string[] = [];
    // Intercept fetch and verify header present on every call
  });
});

describe('Ghost list FlatList', () => {
  it('renders 5000 items without crashing', async () => {});
  it('filters correctly by tier', async () => {});
  it('Tier 5 unfollow button is disabled', async () => {});
  it('shows upgrade prompt when daily cap is reached', async () => {});
});

describe('Queue screen', () => {
  it('Tier 5 checkbox is disabled', async () => {});
  it('polls queue status every 10 seconds', async () => {});
  it('shows correct progress percentage', async () => {});
});

describe('Deep linking', () => {
  it('ghoast://queue navigates to queue screen', async () => {});
  it('ghoast://connect navigates to connect screen', async () => {});
});
```

**Git commit:**
```
feat(mobile): implement React Native + Expo mobile app

- Expo Router v3 file-based navigation (auth + app tabs)
- SecureStore token management with auto-refresh
- Instagram WebView connect with iOS Safari UA
- Dashboard, ghost list (FlatList, 5k items), queue, settings screens
- OneSignal push notifications with permission-after-scan flow
- Deep linking (ghoast:// scheme + Universal Links)
- Shared design-tokens package consumed by both web and mobile
- All purchases via ghoast.app/billing — no IAP in native app
```

---

### PHASE 12 — Store Submission & Release

**Goal:** App live on iOS App Store and Google Play Store. Read `PLATFORM-COMPLIANCE.md` completely before starting this phase.

**Prerequisites:**
- Apple Developer account ($99/year) active
- Google Play Developer account ($25 one-time) active
- All Phase 11 tests green
- TestFlight/internal track build tested by at least one real device
- Privacy policy live at `ghoast.app/privacy`
- Terms of service live at `ghoast.app/terms`
- Account deletion flow tested end-to-end
- Test account pre-loaded with ghost data for App Review team

**Build tasks:**
```
1. App assets
   - App icon: 1024×1024 PNG, no alpha, no rounded corners (both stores)
   - Splash screen: dark background (#080810), Ghoast wordmark centred
   - Screenshots:
     iOS: 6.7" (iPhone 15 Pro Max), 6.1" (iPhone 15), 12.9" (iPad — optional)
     Android: Phone (1080×1920 min), 7" tablet (optional)
   - Minimum 3 screenshots per size — show: dashboard, ghost list, queue

2. EAS production builds
   eas build --platform ios --profile production
   eas build --platform android --profile production
   — Wait for both builds to complete before submitting —

3. iOS submission
   - Upload IPA to App Store Connect via eas submit --platform ios
   - Complete app metadata in App Store Connect:
     - App name, subtitle, description (see PLATFORM-COMPLIANCE.md)
     - Keywords (100 chars)
     - Support URL: ghoast.app/support
     - Privacy Policy URL: ghoast.app/privacy
     - Category: Utilities
     - Age Rating: 4+
   - Complete Privacy Nutrition Labels (all data types per PLATFORM-COMPLIANCE.md)
   - Add App Review notes (see template in PLATFORM-COMPLIANCE.md)
   - Submit for review

4. Android submission
   - Upload AAB to Google Play Console via eas submit --platform android
   - Start on Internal Testing track
   - Complete store listing:
     - Short description (80 chars), full description
     - Screenshots (phone required)
     - Feature graphic (1024×500)
   - Complete Data Safety section (all fields per PLATFORM-COMPLIANCE.md)
   - Complete Content Rating questionnaire
   - Promote to: Internal → Closed testing → Open testing → Production (staged rollout 10%)

5. Post-submission monitoring
   - Monitor App Store Connect for review status — check daily
   - If rejected: read the rejection reason fully, address it, resubmit
   - Once both stores approved: announce on social, update landing page with store badges
   - Add store download links to ghoast.app (App Store badge, Google Play badge)

6. OTA update infrastructure
   - Verify eas update --branch production deploys without native rebuild
   - Test OTA update cycle: deploy a text change, verify it reaches device within 5 min
   - Document OTA update runbook in BUILD-LOG.md

7. Release tag
   git tag -a v1.1.0 -m "Ghoast v1.1.0 — iOS + Android release"
   git push origin v1.1.0
```

**Pre-submission checklist (run before every store submission):**
```
✓ app.json version number incremented
✓ eas.json production profile verified
✓ All tests pass (npm test, Expo Go smoke test on physical device)
✓ No EXPO_PUBLIC_ variables contain secrets
✓ Deep links tested on physical iOS + Android device
✓ Account deletion tested end-to-end
✓ Push notifications tested (queue complete, session expired)
✓ "Upgrade" button opens browser to ghoast.app/billing (no in-app purchase)
✓ No pricing displayed inside the native app
✓ Instagram connect ToS disclosure shown before WebView
✓ Staging build tested on TestFlight + Play internal track
```

**Git commit:**
```
release: tag v1.1.0 — iOS App Store + Google Play release

- EAS production builds for iOS (IPA) and Android (AAB)
- App Store Connect listing complete (Utilities, 4+, Privacy Labels)
- Google Play Console listing complete (Data Safety, Content Rating)
- OTA update infrastructure verified
- Store badges added to landing page
- App review test account documented in PLATFORM-COMPLIANCE.md
```

---

## SECTION 7 — ITERATION RULES

### When a Test Fails
```
1. Read the full error output — do not guess
2. Identify: is it a logic bug in source, a wrong test assertion, or a missing mock?
3. Fix the correct thing (never change an assertion to match wrong output)
4. Run the FULL test suite (npm test) — not just the one test
5. Commit only when ALL tests pass
6. Write an error log entry in BUILD-LOG.md before committing
```

### When Instagram API Behaviour Changes
```
1. Update lib/instagram.js to handle the new response format
2. Update mock responses in test fixtures
3. Re-run Phase 3 and Phase 6 test suites fully
4. Commit with: fix(instagram): update API client for changed endpoint response
```

### When a Stripe Webhook Fails
```
1. Use Stripe CLI to replay the webhook locally: stripe events resend <event_id>
2. Verify signature verification logic is using raw request body (not parsed JSON)
3. Verify webhook secret matches the listening endpoint secret (not the API key secret)
4. Re-run Phase 5 webhook tests
```

### When the Queue Causes Account Flags (Instagram)
```
STOP all queue processing immediately for the affected account
1. Set account.queue_paused = true
2. Log: error level, account_id, 'account_flag_suspected'
3. Notify user via email
4. Review: are timing constants still correct? Did a session pause fire correctly?
5. Do not resume the queue without engineering sign-off
```

### When a Migration Fails
```
1. Do not manually edit the database
2. Roll back with: prisma migrate reset (dev only)
3. Fix the migration file
4. Re-run: prisma migrate dev
5. Verify all test DB tables are correct
```

### When an App Store Build is Rejected
```
1. Read the full rejection reason in App Store Connect / Play Console
2. Identify the specific guideline violated
3. Address the exact issue — do not make unrelated changes
4. If the issue is ambiguous: respond to Apple/Google review team with clarification
5. Resubmit with updated App Review notes documenting what was changed
6. Update PLATFORM-COMPLIANCE.md with the rejection reason and resolution
```

### What Never to Do
- `git commit --no-verify` (bypasses hooks)
- Commenting out failing tests
- Adding `.skip` to a test without a comment and a linked issue
- Deleting a test instead of fixing it
- Committing with `process.env.NODE_ENV === 'test' && return;` to bypass logic in production
- Using AsyncStorage for JWT tokens (use SecureStore only)
- Adding in-app purchase UI without a separate architecture review

---

## SECTION 8 — DEFINITION OF DONE

The build is complete and v1.1.0 is ready when ALL of the following are true:

### Code
- [ ] All P0 features (F001–F006, F012) built and meeting acceptance criteria in REQUIREMENTS.md
- [ ] All P1 features (F007–F010, F013, landing page) built and meeting acceptance criteria
- [ ] Mobile app (Phase 11) built and all mobile tests green
- [ ] No TypeScript compilation errors (`npm run typecheck` exits 0)
- [ ] No linting errors (`npm run lint` exits 0)
- [ ] No `console.log` in production code (only `logger.*`)
- [ ] No `TODO`/`FIXME` in committed code without linked issues

### Tests
- [ ] `npm test` exits 0 (all tests green)
- [ ] Unit test coverage ≥ 80% on all service files
- [ ] Every API route has integration test (happy path + at least one error path)
- [ ] Full E2E test suite passes (Playwright)
- [ ] Mobile: SecureStore token storage tests pass
- [ ] Mobile: AsyncStorage is never called with sensitive data (spy test)
- [ ] Load test: 50 concurrent queues, no deadlocks, no credit double-deductions

### Security
- [ ] `session_token_encrypted` never appears in any API response
- [ ] No secrets in git history (trufflehog scan clean)
- [ ] All Stripe webhooks verify signature
- [ ] Tier 5 hard block confirmed via API-level test (not just UI)
- [ ] JWT tamper rejection confirmed
- [ ] No secrets in `EXPO_PUBLIC_*` mobile env variables

### Git
- [ ] BUILD-LOG.md has an entry for every phase (Phase 0–12)
- [ ] Commit history is clean and meaningful (no "fix", "wip", "test" messages on main)
- [ ] `.env.example` is up to date with all required variables (including ONESIGNAL)
- [ ] `.gitignore` excludes: `.env`, `node_modules`, `dist`, `.next`, `coverage`
- [ ] `v1.1.0` tag exists on `main`

### Store Compliance
- [ ] Privacy policy live at `ghoast.app/privacy`
- [ ] Terms of service live at `ghoast.app/terms`
- [ ] Account deletion flow implemented and tested
- [ ] Apple Privacy Nutrition Labels completed
- [ ] Google Data Safety section completed
- [ ] App live on iOS App Store (or TestFlight for initial release)
- [ ] App live on Google Play (Internal or Open Testing track minimum)

### Documentation
- [ ] CLAUDE.md, REQUIREMENTS.md, TECH-STACK.md, DESIGN-NOTES.md are all current
- [ ] MOBILE-ARCHITECTURE.md is current
- [ ] PLATFORM-COMPLIANCE.md is current
- [ ] BUILD-LOG.md is complete through Phase 12
- [ ] README.md exists with: project description, setup instructions, environment variables, how to run

---

## APPENDIX A — BUILD-LOG.md Template

Create this file in the repo root on Phase 0 and append to it after every phase.

```markdown
# Ghoast Build Log

This log records every phase of the Ghoast application build.
Updated after every phase. Never edited retroactively.

---

## Phase 0 — Repository & Infrastructure Setup
**Date:** [timestamp]
**Branch:** feature/phase-0-infra
**Commit:** [hash] chore(infra): initialise monorepo

### Built
- [files]

### Tests
| Suite | Tests | Passed | Failed |
|-------|-------|--------|--------|
| Infra | 4     | 4      | 0      |

### Issues Encountered
- None

---
[Append Phase 1, 2, ... 12 entries here]
```

---

## APPENDIX B — .env.example Template

```env
# ── Application ───────────────────────────────────
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:3001
LOG_LEVEL=info

# ── Database ──────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/ghoast
DATABASE_URL_TEST=postgresql://user:password@localhost:5432/ghoast_test

# ── Redis ─────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── Encryption ────────────────────────────────────
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_TOKEN_ENCRYPTION_KEY=

# ── Auth ──────────────────────────────────────────
JWT_SECRET=
JWT_REFRESH_SECRET=

# ── Stripe ────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PROPLUS_MONTHLY=price_...
STRIPE_PRICE_CREDITS_100=price_...
STRIPE_PRICE_CREDITS_500=price_...
STRIPE_PRICE_CREDITS_1500=price_...

# ── Email ─────────────────────────────────────────
RESEND_API_KEY=re_...

# ── Analytics ─────────────────────────────────────
POSTHOG_API_KEY=phc_...
POSTHOG_HOST=https://app.posthog.com

# ── Monitoring ────────────────────────────────────
SENTRY_DSN=https://...@sentry.io/...

# ── Push Notifications ────────────────────────────
ONESIGNAL_APP_ID=
ONESIGNAL_API_KEY=
```

---

## APPENDIX C — Required npm Scripts

Every app must expose these in `package.json`:

```json
{
  "scripts": {
    "dev": "...",
    "build": "...",
    "start": "...",
    "test": "jest --runInBand",
    "test:unit": "jest --testPathPattern=\\.test\\.ts$ --runInBand",
    "test:e2e": "playwright test",
    "test:coverage": "jest --coverage --runInBand",
    "test:watch": "jest --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "db:migrate": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:seed": "ts-node prisma/seed.ts",
    "db:studio": "prisma studio",
    "queue:inspect": "ts-node scripts/queue-inspect.ts",
    "queue:clear": "ts-node scripts/queue-clear.ts"
  }
}
```

---

*End of MASTER BUILD PROMPT — Ghoast v1.1*

*Reference documents: CLAUDE.md · REQUIREMENTS.md · TECH-STACK.md · DESIGN-NOTES.md · GHOAST-PRD.md · MOBILE-ARCHITECTURE.md · PLATFORM-COMPLIANCE.md*
