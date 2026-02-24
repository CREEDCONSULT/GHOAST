# Ghoast Build Log

This log records every phase of the Ghoast application build.
Updated after every phase. Never edited retroactively.

---

## Phase 0 — Repository & Infrastructure Setup
**Date:** 2026-02-24
**Branch:** feature/phase-0-infra
**Commit:** (see git log)

### Built
- Monorepo root: `package.json` (npm workspaces), `turbo.json`, `tsconfig.base.json`
- Shared tooling: `.eslintrc.base.json`, `.prettierrc`, `.gitignore`, `.env.example`
- `packages/db/`: Prisma schema (8 tables), `src/index.ts` Prisma client singleton
- `packages/design-tokens/`: Shared colour/tier/spacing/pricing tokens
- `apps/api/`: Fastify server scaffold, pino logger, AES-256 encryption, BullMQ queue config, ghost scoring algorithm, Redis client
- `apps/web/`: Next.js 16 (App Router) scaffold with Tailwind v4, Jest, Playwright
- `docker-compose.yml`: PostgreSQL 16 + Redis 7 + PostgreSQL test DB
- `BUILD-LOG.md`: this file
- `.env`: dev environment variables (not committed — added to .gitignore)

### Prisma Schema — Tables Created
| Table | Purpose |
|-------|---------|
| users | Ghoast user accounts (email, bcrypt hash, tier, credit balance) |
| instagram_accounts | Connected IG accounts (AES-256 encrypted session token) |
| ghosts | Non-followers with 5-dimension priority scores (0–100) |
| unfollow_queue_jobs | Individual BullMQ job records |
| queue_sessions | Daily cap + rate-limit state per account |
| account_snapshots | Daily follower/ratio snapshots (Pro/Pro+) |
| credit_transactions | Credit pack purchase + consume ledger (idempotent via stripe_payment_intent_id UNIQUE) |
| subscriptions | Stripe subscription records |

### Tests
| Suite | Tests | Passed | Failed | Notes |
|-------|-------|--------|--------|-------|
| Unit: queue-config | 9 | 9 | 0 | All timing constants verified |
| Unit: encryption | 7 | 7 | 0 | AES-256-CBC encrypt/decrypt |
| Unit: scoring | 25 | 25 | 0 | All 5 dimensions + tier mapping |
| **Total** | **41** | **41** | **0** | |
| Infra: db | 5 | — | — | ⚠️ Requires Docker (`docker compose up -d`) |
| Infra: redis | 3 | — | — | ⚠️ Requires Docker (`docker compose up -d`) |

### Infrastructure Setup Required
To run infra tests (DB + Redis):
```bash
# 1. Start Docker Desktop
# 2. Run dev services
docker compose up -d

# 3. Run Prisma migration (first time only)
npm run db:migrate

# 4. Run infra tests
cd apps/api && npx jest tests/infra/
```

### Issues Encountered
- `testPathPattern` is a CLI flag, not a jest.config property → fixed to `testMatch`
- Duplicate `moduleNameMapper` keys in jest.config.ts → rewritten cleanly
- `AccountType` not exported from `@ghoast/db` until `prisma generate` is run → fixed by running `prisma generate` before tests
- ts-jest warning `TS151002` (NodeNext in isolatedModules) → non-blocking warning, suppressed with diagnostics config

---

[Phase 1 entry will be appended here after Phase 1 is complete]
