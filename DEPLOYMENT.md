# Ghoast Deployment Runbook

This runbook describes the current deployable shape of the repository after the foundation, API contract, security, and runtime packaging slices.

## Services

- Web: Next.js app in `apps/web`, default port `3000`.
- API: Fastify app in `apps/api`, default port `3001`.
- Worker: BullMQ unfollow worker in `apps/api/src/workers/index.ts`.
- Database: PostgreSQL.
- Redis: Redis compatible with BullMQ. Avoid Redis providers that do not support the commands BullMQ requires.

## Required Production Environment

Use `.env.example` as the source list. Required for launch:

- `NODE_ENV=production`
- `APP_URL`
- `API_URL`
- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_TOKEN_ENCRYPTION_KEY`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PROPLUS_MONTHLY`
- `STRIPE_PRICE_CREDITS_100`
- `STRIPE_PRICE_CREDITS_500`
- `STRIPE_PRICE_CREDITS_1500`

Generate `SESSION_TOKEN_ENCRYPTION_KEY` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Build And Verify

Run before every deploy:

```bash
npm ci
npm run db:generate --workspace=packages/db
npm run verify
```

`npm run verify` runs typecheck, lint, unit tests, production builds, and a runtime import smoke test that verifies compiled workspace packages can be loaded by Node.

Run API integration tests before release candidates:

```bash
npm run test:integration --workspace=apps/api
```

## Database

For first deploy and every schema change:

```bash
npm run db:migrate:prod
```

The current migration baseline is:

```text
packages/db/prisma/migrations/20260617154500_init/migration.sql
```

## Start Commands

API:

```bash
npm run start --workspace=apps/api
```

Web:

```bash
npm run start --workspace=apps/web
```

Worker:

```bash
npm run start:worker --workspace=apps/api
```

## Railway

Railway project: `GHOAST`

The root `Dockerfile` builds the full monorepo once. Each application service
selects its process with `SERVICE_ROLE`:

- `web`: `SERVICE_ROLE=web`, routed to container port `3000`
- `api`: `SERVICE_ROLE=api`, routed to Railway's injected `PORT`
- `worker`: `SERVICE_ROLE=worker`, no public domain

The API role runs `npm run db:migrate:prod` before starting the server.

Review URLs:

- Web: `https://web-production-4b55f8.up.railway.app`
- API: `https://api-production-945c0.up.railway.app`
- Health: `https://api-production-945c0.up.railway.app/api/v1/health`

Postgres and Redis are managed Railway services. The API and worker must share
the same `SESSION_TOKEN_ENCRYPTION_KEY`.

## Health Checks

API:

```text
GET /api/v1/health
```

Expected response:

```json
{ "status": "ok", "timestamp": "..." }
```

Web:

```text
GET /
```

## Current Release Gate Status

Passed locally:

- `npm run verify`
- `npm run test:integration --workspace=apps/api`
- Runtime import smoke check

Remaining before production launch:

- Run a real database migration against staging.
- Validate Redis provider compatibility with BullMQ.
- Configure Stripe webhook endpoints and price IDs.
- Complete legal/compliance launch review for Instagram automation risk.
- Run browser E2E against a deployed staging URL.
