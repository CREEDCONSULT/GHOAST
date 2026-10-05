# Ghoast Autonomous Build Orchestration Plan

Version: 1.0  
Date: 2026-06-17  
Status: Execution plan for build, deployment, and final review  
Primary objective: turn the current Ghoast repository into a production-ready, web-first product with a durable backend, reliable queueing, secure account handling, working billing, operational deployment, and final launch review.

## 1. Purpose

This plan is the operating guide for autonomous implementation. It converts the repository's product docs, existing code, current project health, and launch blockers into a sequenced build plan that a coding agent or engineering team can follow from the current state to production deployment.

Use this file as the build control document. When implementation begins, update it with progress notes or link to phase-specific pull requests. Do not treat older phase logs as proof that the product is shippable; treat the current code and verification gates in this plan as the source of truth.

## 2. Current Repository Health

### 2.1 Repository Structure

Current repo shape:

- `apps/web`: Next.js app with landing page, auth pages, connect flow, dashboard, ghost list, queue UI components, Playwright tests, and Jest setup.
- `apps/api`: Fastify API with auth, accounts, scan, ghosts, queue, billing, snapshots, whitelist, worker/cron code, Jest tests, and security tests.
- `packages/db`: Prisma schema, seed file, DB client singleton.
- `packages/design-tokens`: shared token package.
- `load-tests`: Artillery queue load test.
- Product and strategy docs: `PROJECT-PRD.md`, `BRAND-POSITIONING.md`, `GHOAST-PRD.md`, `REQUIREMENTS.md`, `TECH-STACK.md`, `MASTER-BUILD-PROMPT.md`, `GHOAST-TECHNICAL-REFERENCE.md`, `PLATFORM-COMPLIANCE.md`, `DESIGN-NOTES.md`.
- UX prototype: `ghoast-platform-userflow.html`.

### 2.2 Positive Signals

- Strong product definition and brand positioning now exist.
- Monorepo structure is clear.
- Core API domains are represented: auth, accounts, scan, ghosts, queue, billing, snapshots, whitelist.
- Web app has a real landing page and initial authenticated dashboard structure.
- Tests exist across unit, integration, E2E, infra, and security categories.
- Product requirements and technical reference docs are unusually thorough.
- Redis, Postgres, BullMQ, Stripe, Prisma, and Fastify are reasonable choices for the product shape.

### 2.3 Critical Health Gaps

These are launch blockers:

1. No CI/CD exists in `.github`.
2. No production deployment manifests or Dockerfiles exist.
3. `apps/api/package.json` references missing scripts/files:
   - `src/workers/index.ts`
   - `src/scripts/queue-inspect.ts`
   - `src/scripts/queue-clear.ts`
4. `packages/db` has no checked-in Prisma migrations and uses `prisma db push` for dev.
5. Prisma schema has a typo: `QueueSession.unfolloweCount`.
6. Instagram `unfollowUser()` uses a GET-only helper for a destructive action, so the core unfollow path is likely incorrect.
7. Scan execution is in-process and not durable.
8. Queue worker startup is coupled to API requests and tracked in process memory.
9. Queue pause is global, not account-scoped.
10. Queue completion events are not reliably emitted even though the web UI expects them.
11. API and web response contracts are inconsistent:
    - ghost list pagination shape differs.
    - stats shape differs.
    - queue start response shape differs.
    - scan start response shape differs.
12. Daily cap accounting is inconsistent between manual unfollow and queue worker paths.
13. Credits are consumed after successful unfollow; a credit failure after action can produce unpaid work.
14. Instagram session encryption uses AES-CBC without authentication.
15. Refresh tokens are stateless, not rotated, and not revocable.
16. Account deletion is not implemented.
17. Legal/compliance gate for Instagram private/session method is not resolved.
18. README references `apps/mobile`, but no mobile app exists.
19. Tests rely heavily on mocks and do not prove real end-to-end infrastructure behavior.
20. Web connect flow asks users to paste a session cookie manually; this is high-friction and high-trust-risk.

### 2.4 Current Build Risk Rating

- Product clarity: High.
- Code completeness: Medium-low.
- Production readiness: Low.
- Security readiness: Low.
- Deployment readiness: Low.
- Compliance readiness: Low.
- UX polish: Medium.

Conclusion: current repo is an advanced prototype, not a shippable product.

## 3. Build Principles

Follow these rules throughout implementation:

1. Stabilize foundations before adding features.
2. Do not ship an action automation flow until Instagram action behavior is validated and risk language is explicit.
3. Durable jobs beat in-process promises for scans and queues.
4. Server-side tier and ownership checks are mandatory; client checks are only UX.
5. API and web contracts must be shared or tested before UI expansion.
6. Billing and credits must be idempotent and transactional.
7. Security and compliance gates are phase blockers, not final polish.
8. Every phase must end with commands that pass locally and in CI.
9. Do not implement mobile until web MVP passes final review.
10. Keep public copy honest: no "guaranteed safe", no official Instagram affiliation, no unlimited automation claims.

## 4. Source of Truth Documents

Use these documents in this order:

1. `PLAN.md`: execution order and gates.
2. `TRIAL-READINESS-PLAN.md`: current execution gate for a controlled Instagram trial.
3. `PROJECT-PRD.md`: product requirements and launch blockers.
4. `BRAND-POSITIONING.md`: positioning, trust language, messaging.
5. `REQUIREMENTS.md`: feature acceptance criteria.
6. `GHOAST-TECHNICAL-REFERENCE.md`: deeper technical details.
7. `TECH-STACK.md`: architecture and deployment choices.
8. `DESIGN-NOTES.md`: visual system.
9. `PLATFORM-COMPLIANCE.md`: mobile/store compliance guidance.
10. `BUILD-LOG.md`: historical build log only, not current truth.

## 5. Operating Workflow

### 5.1 Branching

- Use branch prefix `codex/`.
- One phase or tightly scoped epic per branch.
- Keep branches small enough to review.
- Do not merge phase branches until validation gates pass.

Recommended branch sequence:

- `codex/foundation-ci-migrations`
- `codex/api-contracts-health`
- `codex/security-auth-encryption`
- `codex/instagram-adapter`
- `codex/durable-scan-worker`
- `codex/durable-queue-worker`
- `codex/billing-credits-hardening`
- `codex/web-core-journey`
- `codex/settings-compliance`
- `codex/pro-features`
- `codex/observability-deployment`
- `codex/final-review-hardening`

### 5.2 Commit Format

Use Conventional Commits:

- `docs:`
- `chore:`
- `fix:`
- `feat:`
- `test:`
- `refactor:`
- `build:`
- `ci:`

### 5.3 Required Local Checks Before Every Merge

Minimum:

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run build
```

When DB/Redis behavior changed:

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
npm run test --workspace=apps/api
```

When web UX changed:

```bash
npm run test --workspace=apps/web
npm run test:e2e --workspace=apps/web
```

When billing changed:

```bash
npm run test:unit --workspace=apps/api -- billing
npm run test:integration --workspace=apps/api -- billing
```

If a command cannot run because environment variables or external services are missing, document the exact blocker in the PR or phase log.

## 6. Target Production Architecture

### 6.1 Services

Production should run separate services:

- Web: Next.js app.
- API: Fastify REST API and SSE endpoints.
- Worker: BullMQ scan, unfollow, snapshot, disconnect, and maintenance workers.
- Database: managed PostgreSQL.
- Redis: BullMQ-compatible managed Redis.
- Billing: Stripe Checkout, Portal, webhooks.
- Email: transactional email provider.
- Observability: Sentry plus structured logs and uptime checks.
- Analytics: PostHog or equivalent.

### 6.2 Recommended Hosting

Preferred:

- Web: Vercel.
- API and worker: Render, Fly.io, Railway, or another long-running Node host.
- Postgres: Neon, Supabase, Railway Postgres, Render Postgres, or equivalent.
- Redis: Redis Cloud, Railway Redis, Upstash only if BullMQ compatibility is verified for the chosen plan.

Do not deploy queue workers to a platform that sleeps, lacks long-running process support, or lacks Redis commands required by BullMQ.

## 7. Phase 0: Compliance and Launch Scope Gate

### Objective

Decide what the product is allowed to ship, especially around Instagram private/session access. This must happen before investing heavily in production queue automation.

### Tasks

1. Review `PROJECT-PRD.md`, `BRAND-POSITIONING.md`, and `PLATFORM-COMPLIANCE.md`.
2. Decide whether V1 is web-only. Recommendation: yes.
3. Defer `apps/mobile` despite docs referencing it.
4. Obtain legal review for:
   - Instagram session-cookie/private API access.
   - user disclosure language.
   - data retention.
   - account deletion.
   - billing and refund terms.
5. Draft or finalize:
   - Terms of Service.
   - Privacy Policy.
   - Cookie Policy if needed.
   - Data deletion policy.
   - Support policy.
6. Add compliance requirements to backlog.

### Deliverables

- Written V1 scope decision.
- Legal/compliance decision on Instagram access.
- Final risk disclosure copy.
- Public policy page requirements.

### Validation Gate

Do not proceed to public launch without this gate. Development may continue, but production release must remain blocked if legal/compliance is unresolved.

## 8. Phase 1: Foundation, Tooling, and CI

### Objective

Make the repo buildable, testable, migratable, and deployable from a clean clone.

### Tasks

1. Add `.github/workflows/ci.yml`.
2. CI must run:
   - checkout.
   - Node setup.
   - `npm ci`.
   - Prisma generate.
   - typecheck.
   - lint.
   - unit tests.
   - build.
3. Add `.github/workflows/e2e.yml` or extend CI with Postgres/Redis services.
4. Add Dockerfiles:
   - `apps/api/Dockerfile`
   - `apps/web/Dockerfile` only if not deploying web to Vercel.
   - `apps/api/Dockerfile.worker` or one Dockerfile with different command.
5. Add production start commands:
   - API: `node dist/index.js`
   - worker: `node dist/workers/index.js`
6. Create `apps/api/src/workers/index.ts`.
7. Create missing queue scripts:
   - `apps/api/src/scripts/queue-inspect.ts`
   - `apps/api/src/scripts/queue-clear.ts`
8. Align package versions:
   - resolve Next 16 vs docs saying Next 14.
   - resolve ESLint 8 root vs ESLint 9 web.
   - ensure TypeScript config works in CI.
9. Add `.env.production.example`.
10. Add `README` section for local full-stack startup.
11. Add `npm run verify` root script that runs typecheck, lint, tests, and build.

### DB Foundation Tasks

1. Create initial Prisma migration from current schema.
2. Replace production assumptions around `prisma db push`.
3. Update package scripts:
   - dev migration can stay as `prisma migrate dev`.
   - prod migration must use `prisma migrate deploy`.
4. Decide whether to fix `unfolloweCount` immediately:
   - If no production DB exists, rename to `unfollowCount`.
   - If production DB exists, create a safe migration that preserves column mapping.

### Validation Gate

Must pass:

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
docker compose up -d
npm run db:migrate
```

CI must pass on GitHub.

## 9. Phase 2: API Contract Stabilization

### Objective

Make web and API agree before deeper feature work.

### Current Contract Mismatches

1. Web expects ghost list:

```ts
{
  ghosts,
  pagination: { page, limit, total, pages },
  dailyUnfollowCount,
  dailyUnfollowCap
}
```

API currently returns `ghosts`, `total`, `page`, `limit`, `pages` from service and route spreads it.

2. Web expects stats:

```ts
{
  totalGhosts,
  removedGhosts,
  averagePriorityScore,
  tierBreakdown,
  accountType
}
```

API currently returns:

```ts
{
  followersCount,
  followingCount,
  ghostCount,
  ratio,
  tierBreakdown
}
```

3. Web expects queue start:

```ts
{ jobId, status, totalJobs, estimatedDuration }
```

API returns:

```ts
{ sessionId, jobCount, estimatedCompletionMinutes }
```

4. Web expects scan start:

```ts
{ scanId }
```

API returns:

```ts
{ message: "Scan started" }
```

5. Queue SSE events expected by web do not match worker events.

### Tasks

1. Create shared DTO package or file:
   - Option A: `packages/contracts`.
   - Option B: OpenAPI schemas from Fastify/Zod.
2. Normalize response shapes.
3. Add contract tests for endpoints consumed by web:
   - auth login/register/refresh/logout.
   - accounts list/connect/delete.
   - scan start/progress/stream.
   - ghosts list/stats/unfollow.
   - queue start/pause/cancel/status.
   - billing subscribe/credits/portal/balance.
4. Update web API types to import shared DTOs.
5. Update dashboard and components to use final names.
6. Add typed error codes for user-facing states.

### Recommended Contract Shapes

Ghost list:

```ts
{
  ghosts: GhostDto[],
  pagination: { page: number, limit: number, total: number, pages: number },
  dailyUnfollowCount: number,
  dailyUnfollowCap: number
}
```

Stats:

```ts
{
  followersCount: number,
  followingCount: number,
  ghostCount: number,
  removedGhostCount: number,
  ratio: number,
  averagePriorityScore: number | null,
  tierBreakdown: Record<"tier1" | "tier2" | "tier3" | "tier4" | "tier5", number>,
  accountTypeBreakdown: Record<string, number>
}
```

Queue start:

```ts
{
  sessionId: string,
  status: "queued" | "running",
  totalJobs: number,
  estimatedCompletionMinutes: number,
  skippedWhitelisted: number
}
```

Scan start:

```ts
{
  scanId: string,
  status: "queued" | "running"
}
```

### Validation Gate

Must pass:

```bash
npm run typecheck
npm run test --workspace=apps/api
npm run test --workspace=apps/web
```

Add at least one Playwright smoke test proving dashboard can parse mocked or seeded API responses.

## 10. Phase 3: Security Hardening

### Objective

Make user auth, Instagram session storage, and sensitive data handling production-grade.

### Tasks

1. Replace AES-CBC with authenticated encryption:
   - AES-256-GCM minimum.
   - Prefer envelope encryption/KMS if hosting provider supports it.
2. Add versioned encryption envelope:

```ts
{
  version: "v2",
  algorithm: "aes-256-gcm",
  ciphertext,
  iv,
  tag
}
```

3. Write migration path for existing encrypted tokens:
   - If no production data exists, update schema and seed.
   - If data exists, support read old/write new until migration completes.
4. Add refresh token table:
   - hashed token identifier.
   - user ID.
   - device/session metadata.
   - expires at.
   - revoked at.
   - rotated from.
5. Implement refresh token rotation and reuse detection.
6. Add logout current session and logout all sessions.
7. Strengthen cookie settings:
   - httpOnly.
   - secure in production.
   - sameSite strategy aligned with web/API domain.
8. Add CSRF protection strategy for cookie-authenticated routes.
9. Add stricter CORS allowlist.
10. Add account deletion endpoint:
    - `DELETE /api/v1/users/me`
11. Add data export endpoint:
    - `GET /api/v1/users/me/export`
12. Add audit log table for security-relevant events.
13. Add tests for:
    - no sensitive field exposure.
    - refresh token rotation.
    - revoked token rejection.
    - account deletion.
    - encryption/decryption and tamper detection.

### Validation Gate

Must pass:

```bash
npm run test --workspace=apps/api -- security
npm run test:unit --workspace=apps/api
npm run test:integration --workspace=apps/api
```

Manual verification:

- API responses never expose `sessionTokenEncrypted`, `sessionTokenIv`, encryption tags, password hashes, or refresh token hashes.
- Deleted account cannot log in.
- Deleted account's Instagram sessions are removed.

## 11. Phase 4: Instagram Adapter Correctness

### Objective

Make Instagram interaction explicit, testable, swappable, and safe enough for beta.

### Current Gap

`unfollowUser()` calls an endpoint through a helper that always performs GET. This is likely incorrect for a destructive action. This must be fixed before any manual or queued unfollow feature is considered real.

### Tasks

1. Refactor `apps/api/src/lib/instagram.ts` into an adapter:
   - interface.
   - real private API implementation.
   - mock/fake implementation for tests.
2. Add method-aware request helper:
   - GET for reads.
   - POST for mutations.
   - request body support.
   - headers support.
   - response parsing.
3. Validate current endpoints and required headers for:
   - current user info.
   - following pages.
   - followers pages.
   - user detail.
   - unfollow action.
4. Add typed errors:
   - session expired.
   - checkpoint required.
   - challenge required.
   - 2FA required.
   - action blocked.
   - rate limited.
   - soft ban.
   - network timeout.
   - unexpected response.
5. Add adapter-level retries only where safe.
6. Add circuit breaker per account when repeated Instagram errors occur.
7. Add logging that never includes plaintext session token or sensitive response bodies.
8. Add tests with mocked fetch for all known error classes.
9. Add a manual test protocol using a controlled Instagram test account.

### Validation Gate

Must pass:

```bash
npm run test:unit --workspace=apps/api -- instagram
npm run test:unit --workspace=apps/api -- ghosts
npm run test:unit --workspace=apps/api -- queue.worker
```

Manual validation before beta:

- Connect test account.
- Fetch profile.
- Fetch following.
- Fetch followers.
- Run scan.
- Unfollow a known safe test account.
- Confirm Instagram state changed.
- Confirm DB `removedAt` only changes after confirmed success.

## 12. Phase 5: Durable Scan Engine

### Objective

Move ghost scans from in-process fire-and-forget work into durable background jobs.

### Current Gap

`startScan()` acquires a Redis lock and starts `void runScan(...)` inside the API process. Server restart kills the scan. Progress is Redis-only and not durable enough.

### Tasks

1. Add Prisma models:
   - `ScanJob`.
   - optional `ScanCursor` or scan state JSON.
2. Add BullMQ scan queue.
3. Add scan worker in `apps/api/src/workers/index.ts`.
4. API `POST /accounts/:id/scan` should enqueue or return existing active scan.
5. Track scan state:
   - queued.
   - running.
   - fetching_following.
   - fetching_followers.
   - scoring.
   - complete.
   - failed.
   - needs_reconnect.
6. Persist progress to DB and mirror to Redis/SSE.
7. Store enough cursor/checkpoint data to resume or safely restart.
8. Prevent concurrent scans per account via durable DB state, not only Redis.
9. Bound memory usage:
   - For MVP, sets in memory may be acceptable for 5,000 following.
   - For larger accounts, persist pages or use temp tables/batched comparison.
10. Add scan cancellation.
11. Add stale scan recovery.
12. Update web scan UI to use progress endpoint/stream.

### Validation Gate

Must pass:

```bash
npm run test:unit --workspace=apps/api -- scan
npm run test:integration --workspace=apps/api -- scan
```

Operational test:

1. Start scan.
2. Kill worker.
3. Restart worker.
4. Confirm scan resumes or safely fails with recoverable state.

## 13. Phase 6: Durable Queue Engine

### Objective

Make the bulk unfollow queue reliable, account-scoped, resumable, observable, and safe.

### Current Gaps

- Worker starts from API request.
- Active workers are tracked in memory.
- Pause is global.
- Queue session DB state is incomplete.
- Events expected by web are missing or inconsistent.
- Daily cap keys differ across paths.
- Credit consumption timing is unsafe.

### Tasks

1. Create dedicated worker process entry:
   - `apps/api/src/workers/index.ts`
2. Worker process starts:
   - unfollow worker.
   - scan worker.
   - snapshot cron.
   - disconnect cron.
   - maintenance worker if needed.
3. API should enqueue jobs only; it should not create workers.
4. Add robust `QueueSession` model fields:
   - status.
   - startedAt.
   - pausedAt.
   - pausedUntil.
   - cancelledAt.
   - completedAt.
   - totalJobs.
   - completedJobs.
   - failedJobs.
   - skippedJobs.
   - dailyDate.
   - unfollowCount.
5. Rename `unfolloweCount` to `unfollowCount`.
6. Add idempotent queue start behavior:
   - reject if active queue exists.
   - or append only if product explicitly supports append.
7. Use DB job rows as source of truth for status.
8. Store BullMQ job IDs in `UnfollowQueueJob`.
9. Account-scoped pause:
   - set account/session paused state.
   - worker checks before processing next job.
   - do not pause global queue for all accounts.
10. Account-scoped cancel:
    - remove waiting/delayed jobs for account.
    - mark DB rows skipped/cancelled.
    - leave completed rows intact.
11. Emit consistent events:
    - `queue_started`
    - `job_started`
    - `job_completed`
    - `job_failed`
    - `job_skipped`
    - `queue_paused`
    - `queue_resumed`
    - `rate_limit_hit`
    - `session_expired`
    - `queue_completed`
    - `queue_cancelled`
12. Implement daily cap in one service used by manual and queue actions.
13. Implement credit reservation:
    - reserve credits before queue starts or before each job.
    - commit on success.
    - release/refund on skip/failure/cancel.
14. Tier 5 and whitelist protection must exist in:
    - API validation.
    - worker validation.
    - DB query constraints where possible.
15. Add queue recovery:
    - on worker startup, reconcile BullMQ and DB.
    - mark stale processing jobs as retryable/failed.
16. Add queue dashboard endpoints:
    - current session.
    - history.
    - event stream.

### Validation Gate

Must pass:

```bash
npm run test:unit --workspace=apps/api -- queue
npm run test:integration --workspace=apps/api -- queue
```

Operational tests:

1. Start queue and close browser; queue continues.
2. Restart API; queue continues.
3. Restart worker; queue resumes safely.
4. Pause one account; other account queues continue.
5. Cancel queue; waiting jobs are removed and completed jobs stay completed.
6. Force rate limit; queue pauses and emits event.
7. Expire session; queue stops and account requires reconnect.

## 14. Phase 7: Billing and Credit Hardening

### Objective

Make Stripe subscription state, credit packs, and paid access reliable and auditable.

### Current Gaps

- Stripe event idempotency relies partly on unique payment intent IDs, but no webhook event table exists.
- Subscription metadata assumptions must be verified.
- Credits can be consumed after a successful external action, causing inconsistent value transfer if credit write fails.

### Tasks

1. Add `StripeWebhookEvent` table:
   - event ID.
   - type.
   - receivedAt.
   - processedAt.
   - status.
   - error.
2. Make webhook processing idempotent by event ID.
3. Handle subscription lifecycle:
   - checkout complete.
   - invoice paid.
   - invoice failed.
   - subscription updated.
   - subscription deleted.
   - customer deleted.
   - payment intent succeeded.
   - charge refunded.
   - dispute created.
4. Add billing portal route and UI.
5. Add credit reservation ledger:
   - purchase.
   - reserve.
   - consume.
   - release.
   - refund.
   - admin adjustment.
6. Add transaction boundaries for credit updates.
7. Add tier enforcement service used consistently across routes.
8. Add downgrade state:
   - current tier.
   - effective tier.
   - grace period.
   - excess account pending disconnect.
9. Add billing settings page in web.
10. Add tests for duplicate webhooks, failed payments, refunds, credit race conditions.

### Validation Gate

Must pass:

```bash
npm run test:unit --workspace=apps/api -- billing
npm run test:integration --workspace=apps/api -- billing
```

Stripe test matrix:

- Pro checkout success.
- Pro+ checkout success.
- subscription downgrade.
- subscription cancellation.
- failed payment.
- duplicate webhook.
- credit pack purchase.
- refund.

## 15. Phase 8: Web Core Journey Completion

### Objective

Make the web app deliver the full user journey from landing to account cleanup with robust states.

### Current Gaps

- Dashboard depends on mismatched API DTOs.
- Connect flow is manually pasting session token; high-friction.
- Scan progress is not deeply integrated.
- Queue events do not match UI expectations.
- Billing/settings/account deletion pages are incomplete or absent.

### Tasks

1. Update web API client to use shared contracts.
2. Build or fix pages:
   - landing.
   - register.
   - login.
   - app layout.
   - connect.
   - dashboard.
   - ghost list.
   - scan progress.
   - queue progress.
   - billing.
   - settings.
   - delete account.
   - privacy.
   - terms.
3. Update connect flow copy using `BRAND-POSITIONING.md` trust language.
4. Consider two connection modes:
   - action mode: authenticated session.
   - analyze-only mode: future Instagram export ZIP upload.
5. Add status states:
   - no account.
   - needs reconnect.
   - scan queued.
   - scan running.
   - scan failed.
   - no ghosts found.
   - queue running.
   - queue paused.
   - queue cancelled.
   - queue complete.
6. Add account switcher for Pro+.
7. Add Keep List/whitelist UI.
8. Add CSV export UI.
9. Add snapshots/ratio history UI.
10. Add Stripe checkout redirects and portal actions.
11. Add accessible labels, keyboard navigation, and responsive QA.
12. Update landing copy to match brand strategy.

### Validation Gate

Must pass:

```bash
npm run test --workspace=apps/web
npm run build --workspace=apps/web
npm run test:e2e --workspace=apps/web
```

Manual UX walkthrough:

1. Landing to register.
2. Register to connect.
3. Connect to scan.
4. Scan to dashboard.
5. Ghost list filter/search.
6. Manual unfollow.
7. Upgrade to Pro.
8. Start queue.
9. Pause/cancel/complete queue.
10. Settings deletion flow.

## 16. Phase 9: Pro and Pro+ Features

### Objective

Finish the paid feature set after the core product works.

### Features

1. CSV export.
2. Daily snapshots.
3. Ratio history.
4. Multi-account support.
5. Keep List/whitelist.
6. Queue history.
7. Credit packs if retained for V1.

### Tasks

1. Validate existing snapshot service and cron behavior.
2. Move snapshot cron into worker process.
3. Add CSV export route that streams CSV safely.
4. Ensure CSV escaping is correct.
5. Build CSV export UI.
6. Build snapshots chart UI.
7. Build account switcher.
8. Enforce Pro+ account limit server-side.
9. Build whitelist UI.
10. Add downgrade handling UI.

### Validation Gate

Must pass:

```bash
npm run test:unit --workspace=apps/api -- snapshot
npm run test:integration --workspace=apps/api -- snapshots
npm run test:unit --workspace=apps/api -- whitelist
npm run test:integration --workspace=apps/api -- whitelist
npm run test:e2e --workspace=apps/web
```

## 17. Phase 10: Observability and Operations

### Objective

Make production supportable.

### Tasks

1. Add Sentry to API.
2. Add Sentry to web.
3. Add structured request IDs.
4. Add queue metrics:
   - waiting.
   - active.
   - delayed.
   - failed.
   - completed.
5. Add health endpoints:
   - API live.
   - API ready.
   - DB connectivity.
   - Redis connectivity.
   - worker heartbeat.
6. Add worker heartbeat table/key.
7. Add admin-safe queue inspection endpoint or CLI.
8. Add audit logs for:
   - login.
   - connect.
   - disconnect.
   - scan.
   - manual unfollow.
   - queue start/pause/cancel/complete.
   - billing changes.
   - data export.
   - account deletion.
9. Add uptime monitor configuration.
10. Add runbooks:
    - Redis outage.
    - DB migration failure.
    - Stripe webhook failure.
    - Instagram API change.
    - queue backlog.
    - account safety incident.

### Validation Gate

Operational checks:

- Health endpoint detects DB down.
- Health endpoint detects Redis down.
- Worker heartbeat visible.
- Errors show in Sentry.
- Queue backlog can be inspected without direct DB access.

## 18. Phase 11: Deployment

### Objective

Deploy staging and production environments.

### Staging Tasks

1. Create staging Postgres.
2. Create staging Redis.
3. Configure staging env vars.
4. Deploy web to Vercel or chosen host.
5. Deploy API as long-running service.
6. Deploy worker as long-running service.
7. Run migrations:

```bash
npm run db:migrate:prod
```

8. Configure Stripe test webhooks.
9. Configure staging domain:
   - `staging.ghoast.app`
   - `api-staging.ghoast.app`
10. Run smoke tests.

### Production Tasks

1. Create production Postgres.
2. Create production Redis.
3. Configure backups.
4. Configure production env vars.
5. Configure production Stripe.
6. Configure production domains:
   - `ghoast.app`
   - `api.ghoast.app`
7. Run migrations.
8. Deploy API.
9. Deploy worker.
10. Deploy web.
11. Verify health checks.
12. Verify Stripe webhooks.
13. Run production smoke tests with a controlled account.

### Required Environment Variables

Core:

- `NODE_ENV`
- `APP_URL`
- `API_URL`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `SESSION_TOKEN_ENCRYPTION_KEY`

Stripe:

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PROPLUS_MONTHLY`
- `STRIPE_PRICE_CREDITS_100`
- `STRIPE_PRICE_CREDITS_500`
- `STRIPE_PRICE_CREDITS_1500`

Observability:

- `SENTRY_DSN`
- `POSTHOG_API_KEY`
- `POSTHOG_HOST`

Email:

- `RESEND_API_KEY`
- sender domain variables.

### Deployment Validation Gate

Staging must pass:

- API health.
- worker heartbeat.
- DB migration.
- auth register/login.
- connect test account.
- scan test account.
- manual unfollow test.
- queue test with fake or controlled account.
- Stripe test checkout.
- account deletion.

Production must pass the same smoke tests, using production-safe controlled accounts.

## 19. Phase 12: Beta

### Objective

Validate product behavior with a small, controlled user group before public launch.

### Tasks

1. Recruit 10 to 25 users.
2. Use explicit risk disclosure.
3. Start with low-risk or test Instagram accounts.
4. Monitor:
   - scan success rate.
   - queue success rate.
   - session expiry rate.
   - rate limit frequency.
   - support tickets.
   - billing conversion.
   - account safety incidents.
5. Add feedback form.
6. Fix top blockers.
7. Re-run security and E2E tests.

### Beta Exit Criteria

- 90%+ scan completion.
- 95%+ queue state accuracy.
- No sensitive data exposure.
- No unresolved critical account safety issue.
- Account deletion verified by at least one beta tester.
- Billing tested end to end.

## 20. Phase 13: Final Review and Public Launch

### Objective

Perform final product, engineering, security, compliance, and operational review.

### Final Review Checklist

Product:

- Full user journey works.
- Free tier value is visible.
- Paid upgrade is clear.
- Queue behavior is transparent.
- Settings and deletion are easy to find.
- Copy matches brand and risk positioning.

Engineering:

- CI green.
- Typecheck green.
- Lint green.
- Unit tests green.
- Integration tests green.
- E2E tests green.
- Build green.
- DB migrations tested.
- Rollback plan written.

Security:

- Instagram tokens use authenticated encryption.
- Refresh tokens are rotated and revocable.
- Sensitive fields are not exposed.
- CORS is strict.
- CSRF strategy is implemented.
- Account deletion works.
- Data export works.
- Audit logs exist.

Billing:

- Stripe live mode configured.
- Webhook signature verification works.
- Webhook idempotency table works.
- Duplicate events are safe.
- Subscription lifecycle works.
- Credit lifecycle works.

Operations:

- API health checks work.
- Worker heartbeat works.
- Alerts configured.
- Sentry configured.
- Logs are searchable.
- Backups enabled.
- Runbooks exist.

Compliance:

- Terms live.
- Privacy Policy live.
- Risk disclosure live.
- Not affiliated with Instagram/Meta language live.
- Data deletion live.
- Support contact live.

### Launch Go/No-Go

Launch is blocked if any of these are true:

- Instagram unfollow mutation is unverified.
- Queue is not durable.
- Scan is not durable.
- Account deletion is missing.
- Billing webhooks are not idempotent.
- Sensitive session tokens use unauthenticated encryption.
- Refresh tokens cannot be revoked.
- CI does not pass.
- No production rollback path exists.
- Legal/compliance has not accepted Instagram integration risk.

## 21. Test Strategy

### Unit Tests

Cover:

- scoring.
- encryption.
- auth token rotation.
- Instagram adapter.
- scan service.
- queue worker.
- billing service.
- credit ledger.
- whitelist service.
- snapshot service.

### Integration Tests

Cover:

- auth routes.
- account routes.
- scan routes.
- ghost routes.
- queue routes.
- billing routes.
- snapshots routes.
- whitelist routes.
- account deletion.
- data export.

### Infra Tests

Cover:

- DB connection.
- Redis connection.
- BullMQ command compatibility.
- migrations.

### E2E Tests

Cover:

- landing and registration.
- login/logout.
- connect account with mocked adapter.
- scan progress.
- dashboard display.
- ghost filtering/searching.
- manual unfollow.
- paid upgrade.
- queue start/pause/cancel/complete.
- settings/delete account.

### Load Tests

Use `load-tests/queue-load.yml` after queue durability is fixed. Add scenarios for:

- 50 simultaneous queue starts.
- 200 status stream connections.
- queue backlog recovery.
- API rate limit behavior.

## 22. Data Migration Strategy

Before production:

1. Generate initial Prisma migration.
2. Fix schema typo if no production DB exists.
3. Add auth session table.
4. Add scan job tables.
5. Add Stripe webhook event table.
6. Add audit log table.
7. Add queue state fields.
8. Add encryption envelope fields.

After production:

- Never use destructive migration without backup.
- Always test migrations on staging clone.
- Always run `prisma migrate deploy` in release pipeline.
- Add rollback notes for every migration.

## 23. Known Product Decisions to Make

These require founder/product decision before implementation locks in:

1. Is V1 web-only?
   - Recommendation: yes.
2. Are credit packs in V1?
   - Recommendation: optional; subscriptions first if speed matters.
3. Is manual session-token paste acceptable?
   - Recommendation: acceptable only for private beta, not ideal for public launch.
4. Does Ghoast offer analyze-only no-login mode?
   - Recommendation: consider V1.1 or trust-building beta variant.
5. Does Pro+ get faster queue timing?
   - Recommendation: avoid until safety data exists.
6. What is Free manual cap?
   - Recommendation: 10/day midnight UTC for simplicity.
7. What happens on account deletion with active Stripe subscription?
   - Recommendation: cancel in Stripe or route to portal, but clearly define before launch.

## 24. Autonomous Agent Execution Rules

When an autonomous coding agent follows this plan:

1. Start each phase by reading this file and relevant source files.
2. Do not skip validation gates.
3. Prefer fixing contract and infrastructure issues before adding UI.
4. Keep commits scoped.
5. Add or update tests in the same branch as code changes.
6. If external credentials are missing, create mock/fake adapters and document manual validation steps.
7. Do not make production safety claims in UI copy.
8. Do not implement mobile unless explicitly directed after web final review.
9. Do not delete user data or reset git history unless explicitly requested.
10. If code and docs disagree, update docs or create an issue in the plan.

## 25. Immediate Next Action

Start with Phase 1.

Recommended first branch:

```bash
git checkout -b codex/foundation-ci-migrations
```

First implementation tasks:

1. Add CI workflow.
2. Add missing worker entry file.
3. Add missing queue scripts or remove broken package scripts.
4. Add initial Prisma migration.
5. Fix `QueueSession.unfolloweCount` if no production DB exists.
6. Add `verify` root script.
7. Make `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` pass in CI.

Do not begin queue or billing feature work until Phase 1 and Phase 2 gates pass.

