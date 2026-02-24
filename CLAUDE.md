# CLAUDE.md — Ghoast Project Instructions

This file tells AI assistants (Claude, Cursor, Copilot, etc.) how to work correctly on the Ghoast codebase. Read this before writing or modifying any code.

---

## What This Project Is

**Ghoast** (`ghoast.app`) is an Instagram follower intelligence tool. It scans a user's following list, identifies every account that doesn't follow them back, scores and ranks those accounts across five dimensions into five priority tiers, and bulk-unfollows them via a background queue engine with built-in rate-limit protection.

This is a **freemium SaaS product** targeting Instagram users 18-34 who care about their follower ratio. Month 1 revenue target: $5,000.

---

## Vocabulary — Enforce These at All Times

The brand owns specific vocabulary. These rules apply in **UI copy, variable names, comments, database column names, and API responses**. Never use the wrong word.

| Always Say | Never Say |
|-----------|-----------|
| ghosts | non-followers / unfollowers |
| ghost list | non-follower list / unfollow list |
| ghosting (the action) | unfollowing (as a verb in UI) |
| ghost analysis / ghost scan | follower audit |
| tier | category / rank / level |
| queue | batch / job / task list |
| ratio | follower ratio (first mention only — then just "ratio") |

In code (variables, functions, schema columns): use `ghost`, `ghostList`, `ghostScan`, `ghostTier`, `ghostScore` etc. consistently.

---

## Architecture — Decisions Already Made, Do Not Revisit

These are resolved. Do not suggest alternatives or re-litigate them.

| Decision | Resolved As |
|----------|------------|
| Instagram connection method | Private API / session cookie (NOT official Meta Graph API) |
| Session token storage | AES-256-CBC encrypted at rest (PostgreSQL). IV stored alongside ciphertext. |
| Queue technology | BullMQ + Redis |
| Primary database | PostgreSQL |
| Backend runtime | Node.js |
| Frontend framework | React (Next.js strongly preferred for routing + SSR) |
| Payment processor | Stripe (subscriptions + one-time payments) |
| Email provider | Resend or Loops |
| Analytics | PostHog |
| Error tracking | Sentry |

---

## What Is Out of Scope — Never Build These

- Official Meta Graph API integration
- DM (direct message) functionality
- Post scheduling or content tools
- Like / comment automation
- Platforms other than Instagram (Twitter/X, TikTok, etc. — not in V1 or V2)
- Agency/multi-client dashboard
- Desktop app or browser extension

If a request touches any of the above, flag it and ask for clarification before writing code.

---

## Security Rules — Non-Negotiable

1. **Never log session tokens.** The Instagram `sessionid` cookie value must never appear in logs, console output, Sentry events, or error messages. Redact before logging.
2. **Never store passwords.** Ghoast authenticates Instagram via session cookie only. No password is ever captured or stored. User passwords for Ghoast accounts use bcrypt (cost factor 12 minimum).
3. **Never use raw SQL with user input.** Use parameterised queries via the ORM at all times. No string concatenation into SQL.
4. **Never hardcode secrets.** API keys, encryption keys, Stripe keys, database credentials — all must come from environment variables. Never commit secrets to version control.
5. **Always validate Stripe webhooks.** Every webhook handler must verify the Stripe signature before processing. Fail hard on invalid signatures.
6. **HTTPS only.** No HTTP endpoints in production. Redirect HTTP to HTTPS at the infrastructure level.

---

## Queue Rules — Instagram Rate Limiting Is Critical

The bulk unfollow queue is the core paid feature and the biggest risk surface. Get this wrong and users get their accounts flagged by Instagram.

```
Delay between unfollow actions:  randomised 8,000ms – 45,000ms
Session pause trigger:           every 10–15 unfollows
Session pause duration:          randomised 180,000ms – 420,000ms (3–7 min)
On Instagram rate-limit response: pause worker for 900,000ms (15 min), notify user
On 3 consecutive rate-limit responses in one day: pause worker for 24h
Daily cap (Pro):                 150 unfollow actions
Daily cap (Pro+):                150 unfollow actions (shorter base delay for priority)
Daily cap reset:                 midnight UTC
Tier 5 accounts:                 NEVER add to queue — hard block at queue entry point
```

These values must be stored in a central config file (e.g. `config/queue.js`), not hardcoded in worker files.

---

## Data Rules

- Ghost records persist in the database after a scan — do not delete them on rescan, mark `removed_at` when unfollowed
- A ghost's `priority_score` (0-100) and `tier` (1-5) are derived from the scoring algorithm — never accept these as user input
- `session_token_encrypted` and `session_token_iv` are never returned in any API response — strip them before serialising `instagram_accounts`
- Credit transactions must be idempotent — the Stripe webhook for `payment_intent.succeeded` may fire more than once; guard with `stripe_payment_intent_id` uniqueness check

---

## File Structure (Expected)

```
ghoast/
├── CLAUDE.md                  ← this file
├── REQUIREMENTS.md
├── TECH-STACK.md
├── DESIGN-NOTES.md
├── GHOAST-PRD.md
├── apps/
│   ├── web/                   ← Next.js frontend
│   │   ├── app/               ← App router pages
│   │   ├── components/        ← React components
│   │   └── lib/               ← Client-side utilities
│   └── api/                   ← Node.js backend (Express or Fastify)
│       ├── routes/            ← Route handlers
│       ├── services/          ← Business logic (scan, scoring, queue)
│       ├── workers/           ← BullMQ worker definitions
│       ├── db/                ← Database models and migrations
│       ├── lib/               ← Shared utilities
│       │   ├── instagram.js   ← Instagram private API client
│       │   ├── encryption.js  ← AES-256 encrypt/decrypt for session tokens
│       │   └── scoring.js     ← Ghost scoring algorithm
│       └── config/
│           └── queue.js       ← All queue timing constants
├── packages/
│   └── db/                    ← Shared DB schema / migrations (if monorepo)
└── .env.example               ← Template for required environment variables
```

---

## Environment Variables Required

```
# Database
DATABASE_URL=

# Redis
REDIS_URL=

# Session token encryption
SESSION_TOKEN_ENCRYPTION_KEY=    # 32-byte hex string for AES-256

# JWT
JWT_SECRET=
JWT_REFRESH_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PROPLUS_MONTHLY=
STRIPE_PRICE_CREDITS_100=
STRIPE_PRICE_CREDITS_500=
STRIPE_PRICE_CREDITS_1500=

# Email
RESEND_API_KEY=                  # or LOOPS_API_KEY

# Analytics
POSTHOG_API_KEY=

# Error tracking
SENTRY_DSN=
```

---

## Common Commands (once project is scaffolded)

```bash
# Development
npm run dev             # Start all services (web + api + workers)
npm run dev:web         # Frontend only
npm run dev:api         # Backend only
npm run dev:worker      # Queue worker only

# Database
npm run db:migrate      # Run pending migrations
npm run db:seed         # Seed dev data
npm run db:studio       # Open Prisma Studio (or equivalent)

# Queue
npm run queue:inspect   # Show active/waiting/failed jobs in BullMQ
npm run queue:clear     # Clear all jobs (dev only)

# Tests
npm test               # Run all tests
npm run test:unit      # Unit tests only
npm run test:e2e       # End-to-end tests

# Build
npm run build          # Build all packages for production
```

---

## Pricing Reference (use these exact values everywhere)

| Tier | Price | Stripe Product Key |
|------|-------|--------------------|
| Free | $0 | — |
| Pro | $9.99/month | `STRIPE_PRICE_PRO_MONTHLY` |
| Pro+ | $24.99/month | `STRIPE_PRICE_PROPLUS_MONTHLY` |
| Credits 100 | $2.99 one-time | `STRIPE_PRICE_CREDITS_100` |
| Credits 500 | $9.99 one-time | `STRIPE_PRICE_CREDITS_500` |
| Credits 1,500 | $19.99 one-time | `STRIPE_PRICE_CREDITS_1500` |

---

## Ghost Tier Reference (use these exact values everywhere)

| Tier | Score Range | Label | Hex Color |
|------|------------|-------|-----------|
| 1 | 0–20 | Safe to Cut | `#FF3E3E` |
| 2 | 21–40 | Probably Cut | `#FF7A3E` |
| 3 | 41–60 | Your Call | `#FFD166` |
| 4 | 61–80 | Might Keep | `#7B4FFF` |
| 5 | 81–100 | Keep Following | `#00E676` |

Tier 5 is **auto-protected** — never add to queue, never pre-select, disable checkbox in UI.

---

## PRD Reference

Full product requirements: `GHOAST-PRD.md`
Full tech stack decisions: `TECH-STACK.md`
Full design system: `DESIGN-NOTES.md`
Full feature requirements: `REQUIREMENTS.md`
