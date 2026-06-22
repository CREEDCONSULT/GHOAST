# Ghoast Controlled Trial Readiness Plan

## Execution Status - June 22, 2026

- Complete: deny-by-default actions, account allowlist, emergency stop, and trial caps.
- Complete: corrected Instagram requests and typed challenge/block/error handling.
- Complete: dedicated-worker queue ownership and API-side worker removal.
- Complete: versioned connection disclosure and persisted consent.
- Complete: self-service deletion with queued-job and subscription cleanup.
- Complete: privacy, terms, cookie, and deletion-information pages.
- Complete: dependency-aware health reporting and an operator release gate.
- Complete: Fastify, Next.js, and BullMQ upgraded to patched release lines.
- Verified: 170 unit tests, 149 integration tests, lint, typecheck, build, runtime smoke.
- Verified: production dependency audit has no high or critical advisories.
- Residual: Next.js pins a PostCSS version with a moderate upstream advisory.
- Pending external verification: controlled live run with a disposable Instagram account.
- Pending external configuration: production error-monitoring and alert credentials.
- Pending review: legal counsel approval of policy drafts before public launch.

Version: 1.0  
Date: 2026-06-19  
Status: Ready for execution  
Scope: Move the deployed Railway environment from UI/auth review readiness to a safe, controlled Instagram trial.

## 1. Objective

Prepare Ghoast for a tightly controlled trial using a disposable Instagram test account. The trial must prove the complete path:

1. Register and authenticate.
2. Connect a valid Instagram session.
3. Run a read-only follower/following scan.
4. Review ghost scoring and protection rules.
5. Perform one explicitly approved manual unfollow.
6. Run a queue containing no more than three approved targets.
7. Confirm audit logs, rate-limit handling, cancellation, and recovery.

This plan does not authorize a public launch or use with a primary Instagram account.

## 2. Current Baseline

### Passed

- Railway web, API, worker, Postgres, and Redis services are healthy.
- Production database migration is applied.
- Web and API health checks return HTTP 200.
- Web-to-API proxy is working.
- Live registration, login, JWT authentication, and account listing are working.
- Session tokens use authenticated AES-256-GCM encryption.
- API and worker share the same session encryption key.
- Local verification and API integration tests pass.

### Trial Blockers

1. Instagram mutation requests use a GET-only helper.
2. Instagram API errors are not mapped cleanly for account connection.
3. The API can create an in-process unfollow worker while a dedicated worker service is also running.
4. There is no remotely controlled queue kill switch.
5. The real Instagram connect, scan, and unfollow paths are not proven.
6. Privacy, terms, and account deletion pages return 404.
7. There is no user account deletion API.
8. Stripe is not configured.
9. Monitoring, alerting, email, and password recovery are not configured.
10. There is no production-grade test account or reusable trial dataset.

## 3. Trial Safety Rules

These rules apply until the final gate is approved:

- Use only a disposable Instagram test account.
- Do not connect a founder, employee, customer, brand, or primary account.
- Keep queue execution disabled by default.
- Do not perform an unfollow until a read-only scan has passed.
- Manually approve every account included in the first action trial.
- First manual action limit: one unfollow.
- First queue action limit: three unfollows.
- Stop immediately on checkpoint, challenge, login alert, rate limit, session invalidation, unexpected follow-state change, or HTTP response outside the tested contract.
- Never log session tokens, cookies, authorization headers, or full Instagram responses.
- Preserve before/after evidence for each trial step.

## 4. Execution Branches

Use this branch order:

1. `codex/trial-instagram-adapter`
2. `codex/trial-worker-safety`
3. `codex/trial-compliance-controls`
4. `codex/trial-observability`
5. `codex/trial-e2e-validation`

Each branch must pass its phase gate before merge.

## 5. Phase 0: Freeze Destructive Actions

### Objective

Prevent any unfollow job from executing while the action path is being corrected.

### Implementation

- Add `INSTAGRAM_ACTIONS_ENABLED=false` to API and worker configuration.
- Add a central action-policy helper, for example:
  - `apps/api/src/config/action-policy.ts`
- Require the helper in:
  - manual unfollow service
  - queue start service
  - unfollow worker
- Return HTTP 503 with code `INSTAGRAM_ACTIONS_DISABLED` when actions are disabled.
- Keep account connection and read-only scans available.
- Add a worker startup log showing whether actions are enabled, without printing secrets.

### Tests

- Manual unfollow is blocked when the flag is false.
- Queue creation is blocked when the flag is false.
- A previously queued job cannot bypass the worker-level check.
- Scan endpoints remain available.

### Acceptance Gate

- No destructive Instagram request can occur with the flag disabled.
- The flag can be changed in Railway without a code change.

## 6. Phase 1: Correct the Instagram Adapter

### Objective

Make request methods, headers, error handling, and test seams explicit.

### Implementation

- Replace the GET-only `fetchWithTimeout` signature with a request-options interface:
  - method
  - headers
  - body
  - timeout
- Keep profile, following, followers, and user-info requests as GET.
- Change `friendships/destroy/:id/` to POST.
- Confirm Instagram's current required mutation headers using a disposable account:
  - session cookie
  - CSRF token if required
  - Instagram app ID
  - origin/referer if required
  - form body fields if required
- Do not guess missing headers in production code. Capture and document the validated request contract.
- Normalize Instagram responses into typed errors:
  - invalid/expired session
  - checkpoint/challenge required
  - rate limited
  - temporarily blocked
  - upstream unavailable
  - unexpected upstream response
- Map those errors to stable API status codes and machine-readable error codes.
- Ensure response bodies and logs never include sensitive upstream content.

### Required Tests

- Unit tests assert GET for read operations.
- Unit tests assert POST and expected body/headers for unfollow.
- Timeout and network failures map to 502/504.
- Session failures map to 401.
- Rate limits map to 429.
- Checkpoint/challenge maps to 423 or another documented status.
- Unexpected Instagram 400 responses do not become opaque generic 500 responses.

### Acceptance Gate

- Adapter tests pass with recorded, sanitized fixtures.
- A valid disposable session can connect successfully.
- An invalid session produces a clear and safe user-facing error.
- Actions remain disabled after this phase.

## 7. Phase 2: Make Worker Ownership Unambiguous

### Objective

Ensure exactly one deployment role processes unfollow jobs.

### Implementation

- Remove dynamic worker creation from `queue.service.ts`.
- Make the dedicated Railway worker the only unfollow consumer.
- Keep API responsibilities limited to validation, persistence, and job enqueueing.
- Add stable BullMQ job IDs and idempotency checks.
- Ensure retry behavior cannot repeat a successful Instagram mutation.
- Introduce explicit job states:
  - pending
  - processing
  - succeeded
  - failed
  - cancelled
  - blocked
- Make queue pause/cancel account-scoped.
- Ensure completed and failed events reach the dashboard.
- Reconcile daily caps across manual and queued actions using one authoritative counter.
- Resolve credit accounting so a completed action cannot leave an inconsistent credit state.

### Required Tests

- API never starts a worker.
- Two worker instances cannot process the same job successfully.
- Retry after a confirmed success does not send another unfollow.
- Cancellation removes waiting jobs but does not corrupt active jobs.
- Daily limits apply across manual and queued actions.
- Tier 5 and whitelisted accounts remain blocked at the service and worker layers.

### Acceptance Gate

- One queued job results in no more than one Instagram mutation attempt.
- Restarting the worker preserves job state.
- Actions remain disabled.

## 8. Phase 3: Add Operational Safety Controls

### Objective

Provide operators with immediate control and useful evidence during a trial.

### Implementation

- Add environment-controlled limits:
  - `INSTAGRAM_ACTIONS_ENABLED`
  - `TRIAL_MAX_MANUAL_ACTIONS`
  - `TRIAL_MAX_QUEUE_SIZE`
  - `TRIAL_ALLOWED_ACCOUNT_IDS`
- Enforce an allowlist of Ghoast account IDs during the trial.
- Add a Redis-backed emergency stop checked before every mutation.
- Add an operator command or script to:
  - enable actions
  - disable actions
  - pause an account queue
  - cancel waiting jobs
  - inspect queue state
- Default all action controls to deny.
- Add structured audit events:
  - action requested
  - action blocked
  - action sent
  - action confirmed
  - action failed
  - queue paused
  - emergency stop activated
- Store only internal IDs and safe metadata.

### Required Tests

- Non-allowlisted accounts cannot run actions.
- Queue size above the trial limit is rejected.
- Emergency stop blocks active workers before the next request.
- Operator controls work after API and worker restarts.

### Acceptance Gate

- A reviewer can stop all destructive behavior without deploying code.
- Trial limits cannot be bypassed through direct API calls.

## 9. Phase 4: Complete Trust and Compliance Controls

### Objective

Remove broken legal links and provide minimum user control before handling a real session cookie.

### Implementation

- Build and publish:
  - `/privacy`
  - `/terms`
  - `/account/delete`
- Add explicit pre-connect disclosure describing:
  - use of an Instagram session cookie
  - use of private/unofficial Instagram interfaces
  - account restriction and session invalidation risk
  - encrypted storage
  - revocation/disconnection behavior
- Require affirmative consent before account connection.
- Persist disclosure version and acceptance timestamp.
- Implement `DELETE /api/v1/users/me`.
- Account deletion must:
  - stop and remove queue jobs
  - delete connected Instagram accounts and encrypted tokens
  - delete ghosts, snapshots, sessions, credits, and subscriptions
  - delete or anonymize audit records according to policy
  - cancel Stripe subscriptions when billing is enabled
  - revoke auth sessions
- Add a Settings UI for disconnecting Instagram and deleting the Ghoast account.
- Add retention periods and contact information to the privacy policy.

### Required Tests

- Legal pages return 200.
- Registration links resolve.
- Connection is impossible without accepted disclosure.
- Account deletion removes the encrypted session token and dependent data.
- Deleted users cannot refresh or reuse tokens.

### Acceptance Gate

- No broken legal/account-control links.
- A trial user can disconnect Instagram and delete their Ghoast account.

## 10. Phase 5: Add Minimum Observability

### Objective

Make failures discoverable during the controlled trial.

### Implementation

- Configure Sentry or equivalent for web, API, and worker.
- Add uptime checks for:
  - web root
  - API health
- Add alerts for:
  - API or worker restart loops
  - queue failures
  - Instagram 401, 400, 429, challenge, or checkpoint responses
  - Redis or Postgres connectivity errors
  - migration failures
- Add correlation IDs from API request to BullMQ job.
- Add a redaction test for:
  - session token
  - cookie headers
  - JWT
  - database and Redis URLs
- Document log retention and incident response.

### Acceptance Gate

- A deliberately injected failed job creates an alert with no secrets.
- Operators can trace one trial action across API, queue, worker, and database.

## 11. Phase 6: Billing and Email Scope Decision

### Objective

Keep the trial scope honest.

### Option A: Free Controlled Trial

Recommended for the first Instagram trial:

- Hide or disable paid checkout actions.
- Label paid plans as unavailable during the trial.
- Do not configure Stripe until the core Instagram flow is proven.
- Keep the trial account on a controlled feature entitlement.

### Option B: Paid Beta

Required before accepting payments:

- Configure Stripe test-mode products, prices, secret key, and webhook secret.
- Add the Railway webhook endpoint.
- Verify subscription creation, upgrade, downgrade, cancellation, and idempotency.
- Verify credits are granted once.
- Add transactional email for receipts and account events.
- Add password reset and email verification.

### Acceptance Gate

- The deployed UI never presents a payment action that ends in an unexplained 500.

## 12. Phase 7: Read-Only Instagram Trial

### Preconditions

- Phases 0 through 5 passed.
- Actions disabled.
- Disposable Instagram test account prepared.
- Test account contains known following/follower relationships.
- Operator and rollback owner are present.

### Procedure

1. Record the Instagram account's current follower and following counts.
2. Register a new Ghoast trial user.
3. Accept the connection disclosure.
4. Connect the disposable Instagram session.
5. Verify encrypted token storage without reading the plaintext value.
6. Run one scan.
7. Verify pagination completes.
8. Compare a sample of ghost results against Instagram manually.
9. Verify scoring and tier assignment.
10. Verify Tier 5 protection and whitelist behavior.
11. Disconnect and reconnect the account.
12. Verify an expired or altered session produces the expected error.

### Pass Criteria

- No Instagram checkpoint, restriction, or unexpected login alert.
- Counts and sampled ghost results are materially correct.
- No secrets appear in logs.
- Scan can be retried safely.
- No unfollow request occurs.

## 13. Phase 8: Limited Action Trial

### Preconditions

- Read-only trial passed.
- Written approval to enable actions.
- Allowlist contains only the disposable account.
- Limits set to one manual action and three queued actions.
- Emergency stop tested immediately before trial.

### Procedure

1. Enable actions.
2. Select one known, low-risk test target.
3. Perform one manual unfollow.
4. Verify Instagram state manually.
5. Verify Ghoast DB state and audit event.
6. Wait and inspect for account warnings or rate limits.
7. Select at most three additional test targets.
8. Start the queue.
9. Observe delay, progress, and completion events.
10. Test pause or cancel with at least one waiting job.
11. Disable actions immediately after completion.

### Pass Criteria

- Each approved target is acted on at most once.
- No unapproved target is changed.
- UI, DB, BullMQ, and Instagram state agree.
- Pause/cancel and emergency stop work.
- No challenge, checkpoint, restriction, or session invalidation occurs.

### Automatic Failure Conditions

- Duplicate action.
- Wrong account action.
- Tier 5 or whitelisted action.
- Queue continues after emergency stop.
- Unhandled Instagram response.
- Secret leakage.
- Instagram warning, checkpoint, or restriction.

## 14. Final Trial Go/No-Go Checklist

All items must be checked:

- [ ] Instagram mutation uses validated POST contract.
- [ ] Invalid sessions produce clear errors.
- [ ] Dedicated worker is the only queue consumer.
- [ ] Kill switch is live and tested.
- [ ] Trial allowlist and action limits are live.
- [ ] Privacy and terms pages return 200.
- [ ] Connection disclosure is accepted and recorded.
- [ ] Account disconnect and deletion work.
- [ ] Monitoring and alerts are active.
- [ ] Disposable Instagram account is prepared.
- [ ] Read-only scan trial passed.
- [ ] One-action trial passed.
- [ ] Three-item queue trial passed.
- [ ] Actions were disabled after the trial.
- [ ] Findings and evidence were reviewed.

## 15. Verification Commands

Run before every trial-readiness merge:

```bash
npm run verify
npm run test:integration --workspace=apps/api
docker build -t ghoast:trial .
```

Run after deployment:

```text
GET https://web-production-4b55f8.up.railway.app/
GET https://web-production-4b55f8.up.railway.app/api/v1/health
GET https://api-production-945c0.up.railway.app/api/v1/health
```

Additional required suites:

- Instagram adapter unit tests with sanitized fixtures.
- Worker idempotency and duplicate-consumer tests.
- Kill-switch and allowlist integration tests.
- Account deletion integration tests.
- Deployed Playwright journey through registration, disclosure, and read-only scan.

## 16. Definition of Trial Ready

Ghoast is trial ready only when:

- the read-only Instagram path has been proven with a disposable account;
- destructive actions are deny-by-default and remotely controllable;
- the mutation request is validated;
- exactly one worker owns queue execution;
- legal disclosure and account deletion are operational;
- monitoring is active; and
- the limited action trial procedure can be stopped immediately without a deploy.

Until then, the deployment remains suitable for product review, registration/login testing, and non-destructive UI review only.
