# Ghoast Product Requirements Document

Version: 1.0  
Date: 2026-06-16  
Status: Draft for product, engineering, compliance, and launch planning  
Product: Ghoast  
Domain: ghoast.app  
Primary Platform: Web app first  
Secondary Platform: Native mobile app after web product stability  

## 1. Executive Summary

Ghoast is an Instagram follower intelligence product that helps users identify accounts they follow that do not follow them back, rank those accounts by priority, and safely clean their following list through manual actions or a protected background unfollow queue.

The product is aimed at Instagram-native users who care about follower ratio, profile credibility, audience quality, and account hygiene. Ghoast is not a growth bot, engagement automation tool, follower marketplace, scheduler, or agency platform. It focuses on one narrow job: show users who is not following them back, explain which accounts are safest to remove, and help them remove those accounts without reckless automation.

The initial product should ship as a web-first MVP with a production-ready backend, durable scan jobs, durable queue jobs, Stripe billing, privacy/compliance controls, and a polished dashboard. Mobile apps should be treated as a later phase unless a store-compliance review approves the private Instagram API approach.

## 2. Product Vision

Ghoast should become the trusted account-cleanup utility for Instagram users who want better follower hygiene without spending hours manually checking profiles. The experience should feel sharp, fast, and confident: connect account, run scan, see ranked ghosts, remove obvious cuts, protect important accounts, and return later to monitor the ratio.

In 12 months, Ghoast should be known as the focused tool for Instagram ghost cleanup. It should own a narrow, memorable category rather than compete with broad social media management platforms.

## 3. Problem Statement

Instagram users often accumulate a bloated following list over time. This happens through follow-back behavior, old networking attempts, brand follows, inactive accounts, and accounts that never reciprocated. Users who care about follower ratio or public credibility know this hurts the signal their profile sends, but cleaning the list manually is slow and annoying.

Existing alternatives are weak in three ways:

- They show raw non-follower lists without enough intelligence.
- They encourage risky bulk actions without durable rate-limit protection.
- They lack a polished, trustworthy product experience around privacy, billing, and account safety.

Ghoast solves this by combining non-follower detection, scoring, ranking, protected queueing, and a clean user workflow.

## 4. Goals

### 4.1 Business Goals

- Reach a web MVP that can accept paying users.
- Validate free-to-paid conversion for bulk queue and account hygiene features.
- Build a repeatable acquisition funnel through a strong landing page and shareable product premise.
- Reach a stable subscription and credit-pack billing model.
- Reduce support risk through clear warnings, durable queue state, and transparent scan/queue progress.

### 4.2 User Goals

- Know exactly which followed accounts do not follow back.
- Understand which accounts are safest to unfollow.
- Improve follower ratio without spending hours manually checking accounts.
- Avoid removing valuable accounts accidentally.
- Avoid unsafe bulk behavior that may trigger Instagram rate limits or account issues.
- Keep a history of progress over time.

### 4.3 Product Goals

- Deliver a complete web workflow from registration to scan to cleanup.
- Make ghost ranking useful enough that users trust the order of results.
- Make the queue durable, resumable, observable, and conservative.
- Provide monetization without hiding core scan value behind a paywall.
- Build a compliance posture that is explicit about Instagram private API/session risk.

## 5. Non-Goals

Ghoast V1 will not:

- Help users gain followers.
- Sell followers, likes, comments, or engagement.
- Automate likes, comments, DMs, follows, or mass engagement.
- Support non-Instagram platforms.
- Provide agency/team/client management.
- Provide social scheduling or content analytics.
- Promise that Instagram will never restrict or challenge a user's account.
- Ship native mobile before the web product and compliance foundation are stable.

## 6. Target Users

### 6.1 Primary Persona: The Ratio Builder

The Ratio Builder is a creator, freelancer, student, public-facing professional, or personal brand builder who follows 500 to 5,000 accounts and knows many do not follow back. They care about how their follower/following ratio looks and want a faster way to clean up their list.

Needs:

- Clear non-follower list.
- Simple ranking.
- Quick manual unfollow for free users.
- Strong reason to upgrade for background queueing.
- Clear reassurance that Ghoast does not store Instagram passwords.

Success moment:

- User sees a ranked ghost list and realizes they can remove the obvious low-value accounts quickly.

### 6.2 Secondary Persona: The Micro-Influencer

The Micro-Influencer has a larger audience and treats account hygiene as part of brand maintenance. They are willing to pay for queueing, whitelist rules, exports, snapshots, and multi-account support.

Needs:

- Safer queue with daily caps.
- Whitelist for accounts they want to keep.
- CSV export.
- Growth and ratio history.
- Multiple connected Instagram accounts.

Success moment:

- User runs a safe queue, improves ratio, and sees progress tracked over time.

### 6.3 Anti-Personas

Ghoast should not optimize for:

- Casual users who do not care about follower ratio.
- Users with tiny follow lists where manual cleanup is trivial.
- Growth hackers seeking engagement automation.
- Agencies managing many client accounts.
- Users who want to bypass Instagram limits aggressively.

## 7. Product Positioning

### 7.1 One-Line Description

Ghoast shows who does not follow you back on Instagram, ranks who is safest to remove, and helps you clean your list safely.

### 7.2 Value Proposition

- See every non-follower.
- Know who is safe to cut.
- Clean up manually or with a protected queue.
- Keep important accounts safe with whitelists.
- Track ratio improvement over time.

### 7.3 Brand Voice

The voice is sharp, direct, slightly dark, and confident. It should avoid moralizing or wellness framing. The product should say what it does plainly: scan, rank, clean, protect.

Avoid:

- Claims that the product improves mental health.
- Shame-based copy.
- Overpromising safety.
- Language implying official Instagram partnership.

## 8. Platform Scope

### 8.1 V1 Platform

V1 should be web-first:

- Landing page.
- Authentication.
- Instagram account connection.
- Dashboard.
- Scan progress.
- Ghost list.
- Manual unfollow.
- Queue.
- Billing.
- Account settings.
- Deletion/export/privacy controls.

### 8.2 Mobile Scope

Native mobile should be deferred until:

- Web product is stable.
- Legal/compliance review is complete.
- App Store and Play Store risks are accepted.
- Core API supports mobile versioning and token handling.

Mobile V1, if approved later, should be consumption and monitoring oriented:

- Login.
- View accounts.
- View ghost list.
- Monitor scan and queue progress.
- Receive push notifications.
- No in-app purchase flow unless store policy strategy changes.

## 9. Core User Journeys

### 9.1 First-Time Free User

1. User lands on homepage.
2. User signs up with email/password.
3. User reviews Instagram connection disclosure.
4. User connects Instagram account.
5. Ghoast validates session and creates encrypted account record.
6. Ghoast starts first scan automatically.
7. User watches scan progress.
8. User lands on dashboard with ghost count, ratio, and ranked list.
9. User manually unfollows up to 10 ghosts per day.
10. User sees upgrade prompt for queue and higher daily limits.

### 9.2 Pro User Queue Cleanup

1. User logs in.
2. User opens dashboard.
3. User filters to Tier 1 or Tier 2 ghosts.
4. User selects accounts or accepts default preselection.
5. User reviews queue summary and estimated duration.
6. User starts queue.
7. Queue runs server-side with delays, pauses, caps, and retry handling.
8. User sees live progress via SSE or polling.
9. Completed ghosts disappear from active list.
10. User receives queue completion notification.

### 9.3 Pro+ User Account Hygiene

1. User connects up to three Instagram accounts.
2. User switches between accounts.
3. User whitelists important accounts.
4. User exports CSV reports.
5. User views snapshots and ratio trend.
6. User keeps cleaning each account independently.

### 9.4 Expired Instagram Session

1. User starts scan or queue.
2. Instagram returns session expired/challenge/checkpoint.
3. Ghoast stops affected operation.
4. Ghoast marks account as needing reconnect.
5. User sees clear reconnect prompt.
6. No queued jobs continue until reconnection.

### 9.5 Account Deletion

1. User opens settings.
2. User chooses delete account.
3. User confirms destructive action.
4. Ghoast cancels active queues.
5. Ghoast deletes Instagram tokens, ghosts, queue jobs, snapshots, local user data, and eligible billing metadata.
6. Ghoast cancels active Stripe subscription or sends user to billing portal depending on policy.
7. User receives confirmation.

## 10. Functional Requirements

### F001: Ghoast User Authentication

Priority: P0  
Users: All  

Requirements:

- Users can register with email and password.
- Users can log in and log out.
- Passwords are hashed with bcrypt or stronger equivalent.
- Auth supports access and refresh tokens.
- Refresh tokens must be revocable and rotated.
- Web sessions must use secure cookie practices.
- Auth errors must not expose stack traces or internal details.
- Users can reset password by email before public launch.

Acceptance criteria:

- Registration returns a safe user object and no password hash.
- Login returns an access token or session without exposing sensitive fields.
- Logout invalidates the active refresh token.
- Reusing a rotated refresh token is detected and invalidates the session family.
- Protected routes return 401 when unauthenticated.

### F002: Instagram Account Connection

Priority: P0  
Users: All  

Requirements:

- User can connect one Instagram account on Free/Pro.
- Pro+ can connect up to three accounts.
- Ghoast must not collect or store Instagram passwords.
- The connection flow must capture or receive only the required session token/cookie.
- User must accept a disclosure before connecting Instagram.
- Session token must be encrypted with authenticated encryption before storage.
- Expired/invalid sessions must be detected.
- Reconnection must replace the encrypted token.

Acceptance criteria:

- Connection creates an account record with no plaintext token persisted.
- API responses never include encrypted token fields or IVs.
- Invalid session returns a clear user-facing error.
- Reconnect updates the stored token and preserves account history.

### F003: Ghost Scan Engine

Priority: P0  
Users: All  

Requirements:

- Scan collects full following list.
- Scan collects full followers list.
- Ghost set is calculated as following minus followers.
- Scan runs as a durable background job.
- Scan supports progress updates.
- Scan can resume or safely restart after worker failure.
- Scan writes results to persistent database tables.
- Scan records `lastScannedAt`.
- Scan must not run concurrently for the same account.

Acceptance criteria:

- Scan can complete for an account following 5,000 profiles.
- User can see progress state: not started, queued, running, complete, failed.
- A worker restart does not leave scan lock permanently stuck.
- Duplicate scan request returns existing active scan state or 409.

### F004: Ghost Scoring

Priority: P0  
Users: All  

Each ghost receives a 0 to 100 priority score and exactly one tier.

Dimensions:

- Account type: personal, creator, brand, celebrity.
- Follower/following ratio.
- Engagement proxy when available.
- Account size band.
- Post recency or inactivity.

Tier mapping:

| Tier | Score | Label | Behavior |
| --- | --- | --- | --- |
| 1 | 0-20 | Safe to Cut | Preselect for Pro queue |
| 2 | 21-40 | Probably Cut | Queue eligible |
| 3 | 41-60 | Your Call | Queue eligible with user selection |
| 4 | 61-80 | Might Keep | Queue eligible with caution |
| 5 | 81-100 | Keep Following | Auto-protected, never queue eligible |

Acceptance criteria:

- Score is calculated server-side only.
- Tier 5 cannot be manually or automatically queued.
- Score components are stored for explainability.
- Default sort shows lowest score first.

### F005: Dashboard

Priority: P0  
Users: All  

Requirements:

- Show connected account summary.
- Show followers, following, ghost count, and ratio.
- Show last scanned timestamp.
- Show scan status and queue status.
- Show ranked ghost list with pagination.
- Support tier filters.
- Support search by handle and display name.
- Support sort by score, followers, last post, and account type.
- Show empty states for no account, no scan, no ghosts, and scan failed.

Acceptance criteria:

- Dashboard works on desktop and mobile browser widths.
- Empty states guide users to the next action.
- API response contracts are covered by tests.

### F006: Manual Unfollow

Priority: P0  
Users: Free and paid  

Requirements:

- User can manually unfollow eligible ghosts.
- Tier 5 ghosts are blocked.
- Whitelisted ghosts are blocked.
- Free users have a daily manual unfollow cap.
- Paid users may have higher manual limits depending on tier policy.
- Failed Instagram calls do not decrement counters.
- Successful unfollow marks `removedAt`.

Acceptance criteria:

- Manual unfollow uses the correct Instagram mutation request.
- Daily counter is incremented only after success.
- User receives clear errors for expired session, rate limit, already removed, protected, and failed action.

### F007: Bulk Unfollow Queue

Priority: P0 for paid launch  
Users: Pro, Pro+, credit-pack users  

Requirements:

- Queue runs in a dedicated worker process.
- Queue jobs are durable in BullMQ and mirrored in database job records.
- Queue supports start, pause, resume, cancel, and completion states.
- Queue is scoped per Instagram account.
- Queue concurrency is one action at a time per Instagram account.
- Queue applies randomized delay between unfollows.
- Queue applies randomized session pauses.
- Queue pauses on Instagram rate limits.
- Queue stops on expired session.
- Queue enforces daily caps.
- Queue emits real-time progress events.
- Queue survives API restart.
- Queue survives worker restart without losing job state.

Queue timing defaults:

| Setting | Value |
| --- | --- |
| Delay between unfollows | Random 8-45 seconds |
| Session pause trigger | Every 10-15 successful unfollows |
| Session pause duration | Random 3-7 minutes |
| Single rate-limit pause | 15 minutes |
| Repeated rate-limit pause | 24 hours after threshold |
| Pro daily cap | 150 successful unfollows |
| Pro+ daily cap | 150 successful unfollows, optional shorter delay |
| Cap reset | Midnight UTC |

Acceptance criteria:

- Closing the browser does not stop queue.
- Restarting the API does not stop queue.
- Queue completion event is emitted exactly once.
- Cancel removes waiting/delayed jobs and leaves completed jobs intact.
- Pause affects only the selected account's queue.
- Queue cannot process Tier 5 or whitelisted ghosts.

### F008: Credit Packs

Priority: P1  
Users: Free users who do not subscribe  

Requirements:

- Users can purchase credits.
- One credit equals one successful unfollow.
- Credits are reserved before queue execution or safely authorized.
- Failed, skipped, protected, or canceled actions do not consume credits.
- Credit ledger records purchase, consume, refund, and adjustment events.
- Credit balance cannot go negative.

Acceptance criteria:

- Duplicate Stripe webhook cannot double-credit a user.
- Concurrent queue jobs cannot overdraw credits.
- User sees credit balance before starting credit-backed queue.

### F009: Subscriptions and Billing

Priority: P0 for monetized launch  
Users: Paid users  

Plans:

| Plan | Price | Core Value |
| --- | --- | --- |
| Free | $0 | Full scan, ranked ghost list, limited manual unfollows |
| Pro | $9.99/month | Queue, higher daily cap, snapshots, CSV export |
| Pro+ | $24.99/month | Multi-account, whitelist, advanced tracking |

Requirements:

- Stripe Checkout handles subscription purchase.
- Stripe Customer Portal handles cancellation and billing updates.
- Stripe webhooks update local user tier and subscription records.
- Downgrades enforce account limits with grace period.
- Failed payment and past-due states are reflected in product access.

Acceptance criteria:

- Checkout success updates user tier through webhook.
- Canceled subscription downgrades user after policy-defined period.
- Pro+ to Pro/Free downgrade flags extra connected accounts.

### F010: Multi-Account

Priority: P1  
Users: Pro+  

Requirements:

- Pro+ users can connect up to three Instagram accounts.
- User can switch active account in dashboard.
- Ghosts, scans, queues, snapshots, whitelist, and caps are account-scoped.
- Downgrade starts a grace period for excess accounts.

Acceptance criteria:

- No data from one Instagram account appears under another.
- Account switcher updates all dashboard data.
- Excess accounts are clearly marked during downgrade grace period.

### F011: Whitelist

Priority: P1  
Users: Pro+  

Requirements:

- User can whitelist any ghost.
- Whitelisted accounts cannot be manually unfollowed or queued.
- Whitelist is account-scoped.
- User can manage whitelist from settings or dashboard.
- Maximum whitelist size is 500 accounts per Instagram account.

Acceptance criteria:

- Queue silently excludes whitelisted ghosts and reports skipped count.
- Manual unfollow returns protected/whitelisted error.
- Removing from whitelist makes account eligible again unless Tier 5.

### F012: Snapshots and Growth Tracking

Priority: P1  
Users: Pro and Pro+  

Requirements:

- Daily snapshot captures followers, following, ghost count, and ratio.
- User can view 30-day trend.
- Pro retention: 90 days.
- Pro+ retention: indefinite or policy-defined extended retention.

Acceptance criteria:

- Snapshot job runs daily.
- Chart handles missing days.
- Snapshot data is account-scoped.

### F013: CSV Export

Priority: P1  
Users: Pro and Pro+  

Requirements:

- User can export ghost list to CSV.
- Export includes handle, display name, followers, following, ratio, tier, score, account type, last post date, whitelisted, removed status.
- File name format: `ghoast-export-{handle}-{YYYY-MM-DD}.csv`.

Acceptance criteria:

- Export completes within 5 seconds for 5,000 rows.
- CSV escapes commas, quotes, and line breaks.
- Free users receive upgrade prompt.

### F014: Notifications

Priority: P2  
Users: Paid users  

Requirements:

- Notify when scan completes.
- Notify when queue completes.
- Notify when queue pauses due to rate limit.
- Notify when session expires.
- Email notifications for web V1.
- Push notifications only after native mobile app exists.

Acceptance criteria:

- User can opt out of non-critical emails.
- Security and billing emails remain transactional.

### F015: Account Deletion and Data Export

Priority: P0 before public launch  
Users: All  

Requirements:

- User can delete Ghoast account from settings.
- User can request/export personal data.
- Deletion removes Instagram tokens immediately.
- Active queues are canceled.
- Stripe subscription is canceled or user is routed through portal according to billing policy.
- Deletion confirmation is sent.

Acceptance criteria:

- Deleted account cannot log in.
- Deleted user's Instagram tokens are removed.
- Deletion endpoint is idempotent.

## 11. Data Model Requirements

Core entities:

- User.
- Auth session or refresh token.
- Instagram account.
- Ghost.
- Scan job.
- Queue session.
- Queue job.
- Account snapshot.
- Credit transaction.
- Subscription.
- Stripe webhook event.
- Audit log.

Key requirements:

- Instagram session fields must never be returned from API.
- All user-owned records must include ownership checks.
- All mutable billing/credit operations must be transactional.
- Queue state must be reconstructable from durable data.
- Database migrations must be checked into source control.

## 12. API Requirements

API style:

- REST API under `/api/v1`.
- Versioned from first production release.
- JSON responses with stable DTOs.
- Typed error codes.
- Auth via bearer token and/or secure web session.
- SSE or polling for scan/queue progress.

Required endpoint groups:

- `/auth`.
- `/accounts`.
- `/accounts/:id/scan`.
- `/accounts/:id/ghosts`.
- `/queue`.
- `/billing`.
- `/credits`.
- `/snapshots`.
- `/whitelist`.
- `/users/me`.
- `/webhooks/stripe`.
- `/health`.

Contract requirements:

- Frontend and backend must share DTO definitions or generated API types.
- Any breaking API change requires versioning or migration.
- Contract tests must cover every endpoint consumed by the web app.

## 13. Security Requirements

### 13.1 Sensitive Data

Sensitive data includes:

- Instagram session tokens/cookies.
- Refresh tokens.
- Password hashes.
- Stripe customer and subscription identifiers.
- User email.
- Instagram profile metadata.

Requirements:

- Use authenticated encryption for Instagram sessions, preferably AES-256-GCM or managed KMS envelope encryption.
- Never log plaintext session tokens.
- Never return session token fields.
- Redact secrets from logs.
- Use TLS everywhere.
- Rotate secrets through managed environment variables.

### 13.2 Authentication

Requirements:

- Hash passwords with bcrypt cost 12 or stronger.
- Enforce password length and common-password checks.
- Implement refresh token rotation and revocation.
- Support logout from current device and all devices.
- Rate-limit auth endpoints.

### 13.3 Authorization

Requirements:

- Every account, ghost, queue, snapshot, whitelist, and billing read must verify ownership.
- Tier gates must be enforced server-side.
- Client-side gates are only UX, never security.

### 13.4 App Security

Requirements:

- Strict CORS allowlist.
- CSP for web.
- Helmet or equivalent security headers.
- CSRF strategy for cookie-authenticated routes.
- Input validation with schemas.
- No raw SQL with user input.
- Dependency and secret scanning in CI.

## 14. Compliance and Legal Requirements

Ghoast's Instagram integration uses private/session-based access rather than the official Meta API. This creates material Terms of Service, account safety, platform, and app store risk.

Requirements before public launch:

- Legal review of Instagram access method.
- User disclosure before connecting Instagram.
- Privacy Policy.
- Terms of Service.
- Cookie Policy if applicable.
- Data deletion flow.
- Data export flow.
- Support contact.
- Incident response process.
- Store policy review before native mobile.

Disclosure must say:

- Ghoast is not affiliated with Instagram or Meta.
- Ghoast does not store Instagram passwords.
- Ghoast uses a session-based/private API approach.
- Instagram may rate limit, challenge, or restrict accounts.
- Ghoast uses conservative queue limits but cannot guarantee account outcomes.

## 15. Pricing and Packaging

### 15.1 Free

Includes:

- Account connection.
- Full ghost scan.
- Full ranked ghost list.
- Limited manual unfollows per day.

Limits:

- One Instagram account.
- No queue.
- No CSV export.
- No snapshots.
- No whitelist.

### 15.2 Pro

Includes:

- Everything in Free.
- Bulk unfollow queue.
- 150 successful unfollows per day.
- CSV export.
- Snapshots.
- Billing portal.

Limits:

- One Instagram account.

### 15.3 Pro+

Includes:

- Everything in Pro.
- Up to three Instagram accounts.
- Whitelist.
- Extended snapshot history.
- Advanced account hygiene features.

### 15.4 Credits

Includes:

- One-time credit packs for users who do not want subscription.
- Credits apply only to successful queue unfollows.

## 16. Analytics Requirements

### 16.1 Funnel Metrics

Track:

- Landing page visit.
- Sign-up started.
- Sign-up completed.
- Instagram disclosure accepted.
- Instagram account connected.
- First scan started.
- First scan completed.
- Ghost list viewed.
- First manual unfollow.
- Upgrade CTA clicked.
- Checkout started.
- Checkout completed.
- Queue started.
- Queue completed.

### 16.2 Product Metrics

Track:

- Average ghosts found per account.
- Scan success rate.
- Scan failure reason distribution.
- Queue success rate.
- Queue pause/rate-limit rate.
- Average queue completion time.
- Manual unfollows per free user.
- Credit consumption.
- Whitelist usage.
- CSV export usage.

### 16.3 Business Metrics

Track:

- Free-to-paid conversion.
- Trial-to-paid conversion if trials are introduced.
- MRR.
- ARPU.
- Churn.
- Refund rate.
- Support tickets per 100 users.

## 17. Non-Functional Requirements

### 17.1 Performance

- Landing page LCP under 2.5 seconds on median mobile connection.
- Dashboard initial data load under 2 seconds after auth for existing scanned account.
- Ghost list pagination under 500 ms server response for 5,000 ghosts.
- Scan for 5,000 following completes within practical safety limits. Speed must not override account safety.
- CSV export for 5,000 ghosts completes within 5 seconds.

### 17.2 Reliability

- API uptime target: 99.5% for MVP, 99.9% after product-market fit.
- Queue jobs must be durable.
- Worker restart must not corrupt queue state.
- Stripe webhook handling must be idempotent.
- Redis outage must degrade queue/scan features clearly.

### 17.3 Scalability

MVP capacity target:

- 500 registered users.
- 100 concurrent active users.
- 50 simultaneous active queues.
- 500 connected Instagram accounts.

V1 capacity target:

- 10,000 registered users.
- 1,000 connected Instagram accounts.
- 200 simultaneous queues.

### 17.4 Accessibility

- Keyboard accessible controls.
- Sufficient color contrast.
- Form labels for all fields.
- Screen-reader-friendly status updates for scan and queue progress.
- No text-only reliance on color for tier meaning.

## 18. Technical Architecture

Recommended V1 architecture:

- Web: Next.js app.
- API: Node.js Fastify API.
- Worker: dedicated Node.js BullMQ worker service.
- Database: PostgreSQL with Prisma migrations.
- Queue/cache: Redis compatible with BullMQ.
- Billing: Stripe Checkout, Billing Portal, webhooks.
- Email: Resend or similar transactional provider.
- Observability: Sentry, structured logs, uptime checks.
- Analytics: PostHog or similar.

Deployment recommendation:

- Web on Vercel.
- API and worker on Render, Fly.io, Railway, or similar.
- Managed Postgres.
- Managed Redis that supports BullMQ commands.
- Separate staging and production environments.

## 19. Release Plan

### Phase 0: Compliance and Scope Freeze

Deliverables:

- Legal review.
- V1 scope decision.
- Privacy/Terms drafts.
- Instagram risk disclosure.
- Mobile deferral or approval decision.

Exit criteria:

- Stakeholders accept or adjust Instagram integration risk.

### Phase 1: Engineering Foundation

Deliverables:

- CI/CD.
- Real Prisma migrations.
- Version alignment.
- Dockerfiles.
- Staging environment.
- Shared API contracts.

Exit criteria:

- Clean clone can build, test, and run.

### Phase 2: Core Web Journey

Deliverables:

- Auth.
- Account connection.
- Durable scan.
- Dashboard.
- Ghost list.
- Manual unfollow.
- Settings.

Exit criteria:

- Free user can complete full first-run flow.

### Phase 3: Paid Queue and Billing

Deliverables:

- Stripe subscriptions.
- Credit packs.
- Dedicated queue worker.
- Queue UI.
- Queue event stream.
- Queue persistence.

Exit criteria:

- Paid user can start, pause, cancel, and complete queue safely.

### Phase 4: Pro+ Features

Deliverables:

- Multi-account.
- Whitelist.
- Snapshots.
- CSV export.

Exit criteria:

- Pro+ workflow is account-scoped and tested.

### Phase 5: Beta

Deliverables:

- Controlled beta.
- Support process.
- Monitoring dashboards.
- Incident runbooks.

Exit criteria:

- Scan and queue success rates meet launch thresholds.

### Phase 6: Public Launch

Deliverables:

- Production domain.
- Production billing.
- Final landing page.
- Public docs.
- Launch monitoring.

Exit criteria:

- Product is publicly available and monitored.

## 20. Launch Readiness Checklist

Product:

- Full first-run flow works.
- Dashboard has all empty/error/loading states.
- Billing works in Stripe live mode.
- Account deletion works.
- Privacy and Terms are published.

Engineering:

- CI is green.
- E2E smoke suite passes.
- API contracts are tested.
- DB migrations are production-ready.
- Worker process is deployed separately.
- Rollback path is documented.

Security:

- Secrets are managed outside source.
- Session token encryption is authenticated.
- Refresh tokens are revocable.
- Sensitive fields are tested for non-exposure.
- Rate limits are active.

Operations:

- Monitoring is active.
- Alerts are configured.
- Logs are searchable.
- Backups are enabled.
- Support inbox is ready.

## 21. Success Metrics

### MVP Success

- 500 sign-ups.
- 300 connected Instagram accounts.
- 250 completed scans.
- 8% free-to-paid conversion.
- 90% scan completion rate.
- 95% queue job state accuracy.
- Fewer than 3 serious account safety support incidents.

### V1 Success

- $5,000 MRR.
- 2,000 sign-ups.
- 1,000 connected accounts.
- 75% activation from sign-up to first scan.
- 20% of scanned users perform at least one cleanup action.
- Support volume below 5 tickets per 100 active users.

## 22. Risks and Mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Instagram private API changes | Critical | Adapter layer, monitoring, fallback messaging, rapid patch process |
| Instagram account challenges/rate limits | Critical | Conservative queue, caps, pauses, user disclosure |
| App store rejection | High | Web-first launch, legal review, defer mobile |
| Queue state corruption | High | Durable DB state, idempotency, worker restart tests |
| Token exposure | High | Authenticated encryption, redaction, sensitive field tests |
| Billing inconsistency | High | Stripe event table, idempotent webhooks, test matrix |
| Frontend/API drift | Medium | Shared DTOs, contract tests |
| High support burden | Medium | Clear status messages, reconnect flows, runbooks |

## 23. Open Questions

- Is the Instagram private/session API approach acceptable for public launch after legal review?
- Should V1 include credits, or should monetization start subscription-only?
- Should mobile be deferred entirely until V1 web reaches stable revenue?
- What is the exact daily cap for Free manual unfollows: fixed midnight UTC or rolling 24 hours?
- Should Pro+ receive shorter queue delay than Pro?
- How much scan detail should be shown to users while protecting implementation risk?
- Should account deletion cancel Stripe directly or route user to Stripe portal?
- What support SLA will paid users receive?
- What data retention policy applies after subscription cancellation?

## 24. Appendix: P0 Ship Blockers

The product should not launch publicly until these are complete:

- Correct Instagram unfollow mutation implementation.
- Durable scan worker.
- Dedicated durable queue worker.
- Fixed frontend/API contract mismatches.
- Real Prisma migrations.
- CI/CD with test gates.
- Stripe billing test matrix.
- Account deletion.
- Privacy Policy and Terms.
- Authenticated encryption for Instagram sessions.
- Refresh token rotation/revocation.
- Production monitoring and alerts.

