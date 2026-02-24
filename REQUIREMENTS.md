# REQUIREMENTS.md — Ghoast Feature & System Requirements

**Version:** 1.0 | Derived from GHOAST-PRD.md Section 3 & 7
**Purpose:** Developer-facing requirements reference. All acceptance criteria are specific and testable.

---

## Priority Key

| Symbol | Meaning |
|--------|---------|
| P0 | Launch blocker — product cannot ship without this |
| P1 | Ships in MVP or V1.1 — high value |
| P2 | V2 scope — deferred |
| Free | Available on free tier |
| Pro | Requires Pro subscription ($9.99/mo) or credit pack |
| Pro+ | Requires Pro+ subscription ($24.99/mo) |

---

## Feature Requirements

### F001 — Instagram Account Connection
**Priority:** P0 | **Tiers:** All

- User is shown an embedded Instagram login web view — no redirect to the Instagram app
- Session cookie (`sessionid`) is captured on successful auth — no password ever captured or stored
- Session token is AES-256-CBC encrypted before being written to the database — plaintext never persists to disk or logs
- User must accept ToS disclosure before initiating login — disclosure must state: (a) private API method used, (b) technically violates Instagram ToS, (c) Ghoast applies rate limiting, (d) no passwords stored
- Expired or invalid session tokens are immediately deleted from the database
- Auth flow completes and user reaches the dashboard within 10 seconds of successful login
- Failed login shows specific error message — must not expose internal errors to the user
- Works on desktop (Chrome, Firefox, Safari) and mobile (Chrome, Safari)

---

### F002 — Ghost Scan Engine
**Priority:** P0 | **Tiers:** All

- Scan starts automatically on first account connection; can be manually re-triggered any time
- Fetches the full following list via Instagram private API with pagination until all accounts are retrieved
- Fetches the full followers list via Instagram private API with pagination until all accounts are retrieved
- Ghost set = `following_list MINUS followers_list` (set difference)
- Scan for an account with 5,000 following completes in under 60 seconds under normal network conditions
- Scan progress displayed to the user in real time (percentage + accounts scanned / total)
- If scan fails mid-way: system saves progress and attempts to resume; if resume fails, user is notified and prompted to rescan
- Scan results are persisted in the database — user does not need to rescan on each session
- "Last scanned" timestamp is displayed on the dashboard at all times
- Rescan overwrites the previous result, triggered manually by user

---

### F003 — Ghost Scoring Algorithm
**Priority:** P0 | **Tiers:** All

Every ghost receives a **Priority Score (0–100)** across five dimensions, each scored 0–20:

**Dimension 1 — Account Type Classification (0–20)**
- Personal account: 0–5 points
- Creator account: 5–12 points
- Brand / Restaurant / Local Business: 15–18 points
- Celebrity / Verified (verified badge OR follower count > 1M): 18–20 points
- Classification method: bio keyword matching + follower/following ratio heuristics + verified badge presence

**Dimension 2 — Follower-to-Following Ratio (0–20)**
- Formula: `min(20, floor(their_followers / their_following * 4))`
- High-ratio accounts (follow far fewer than follow them) score high — reciprocity not expected
- Accounts with ratio < 1.0 score 0–3

**Dimension 3 — Engagement Proxy (0–20)**
- Has the Ghoast user liked or commented on this account's posts in the last 90 days?
- Yes: 15–20 points | No: 0 points
- If engagement data unavailable via API: default to 0, set `engagement_unknown = true` — do NOT fabricate a score

**Dimension 4 — Account Size Band (0–20)**
- Nano (<1K followers): 0–3 | Micro (1K–10K): 4–8 | Mid (10K–100K): 9–13
- Macro (100K–1M): 14–17 | Mega (>1M): 18–20

**Dimension 5 — Post Recency (0–20)**
- Last post within 30 days: 0–3
- Last post 30–90 days ago: 5–10
- Last post 90+ days ago (dormant): 15–20
- No posts / private account: 15 (treated as dormant)

**Tier Mapping:**

| Tier | Score Range | Label | Color |
|------|------------|-------|-------|
| 1 | 0–20 | Safe to Cut | `#FF3E3E` |
| 2 | 21–40 | Probably Cut | `#FF7A3E` |
| 3 | 41–60 | Your Call | `#FFD166` |
| 4 | 61–80 | Might Keep | `#7B4FFF` |
| 5 | 81–100 | Keep Following | `#00E676` |

**Scoring requirements:**
- Every ghost has a Priority Score 0–100 and is assigned to exactly one tier
- Tier 5 accounts are auto-excluded from bulk queue selection — hard block, not soft warning
- Ghost list is sorted by Priority Score ascending (Tier 1 first) by default
- Users can sort by: Priority Score, Follower Count, Account Type, Last Post Date
- Scoring runs server-side, completes within 30 seconds of scan completion for up to 5,000 ghosts

---

### F004 — Ghost List Dashboard
**Priority:** P0 | **Tiers:** All

- Dashboard displays: total followers, total following, ghost count, follower ratio (2 decimal places)
- Ghost list shows all non-followers grouped by tier, sorted by Priority Score ascending
- Each ghost list row shows: profile photo (if available), display name, @handle, follower count, tier badge, Priority Score
- Tier filter tabs: view one tier at a time or all tiers together
- Search bar filters by display name or @handle — real-time, no submit
- Free tier users see the complete ranked ghost list — no data hidden behind paywall
- "Last scanned" timestamp shown in the dashboard header
- "Rescan" button triggers F002 and replaces current results on completion

---

### F005 — Manual Unfollow
**Priority:** P0 | **Tiers:** Free

- Each ghost list row has an "Unfollow" button
- Clicking Unfollow calls the Instagram private API to unfollow that account immediately
- Unfollowed account is removed from the ghost list within 3 seconds of API call completing
- Free users are limited to **10 manual unfollows per 24-hour rolling window** (resets midnight UTC)
- Counter shows remaining manual unfollows: "7 of 10 remaining"
- When daily limit is reached: Unfollow button is replaced with upgrade prompt — "Upgrade to Pro for 150/day, automated queue"
- If API call fails (rate limited or session expired): show specific error message, do NOT decrement the daily counter

---

### F006 — Bulk Unfollow Queue
**Priority:** P0 (for Pro tier launch) | **Tiers:** Pro, Pro+, Credit Packs

**Queue parameters:**

| Parameter | Value |
|-----------|-------|
| Delay between unfollows | Randomised 8,000ms – 45,000ms |
| Session pause trigger | Every 10–15 unfollows |
| Session pause duration | Randomised 180,000ms – 420,000ms |
| Instagram rate-limit response | Pause worker 900,000ms (15 min), notify user |
| 3 consecutive rate-limits in one day | Pause worker 24h |
| Daily cap — Pro | 150 unfollows |
| Daily cap — Pro+ | 150 unfollows (shorter base delay) |
| Daily cap reset | Midnight UTC |

**Functional requirements:**
- Users can select individual accounts or all accounts in a tier via "Select Tier 1" button
- Tier 1 accounts are pre-selected by default when the bulk queue screen opens
- Tier 5 accounts cannot be added to queue — checkbox is disabled with tooltip "Auto-protected"
- Queue summary shows: selected count, estimated completion time, tier breakdown
- Queue starts on "Start Queue" click and runs server-side in the background
- Queue continues if user closes browser — it is NOT client-side
- Dashboard shows live queue status: current position, countdown to next unfollow (live seconds), % complete
- Completed unfollows are removed from ghost list in real time via SSE
- Daily cap counter shows remaining queue capacity
- Queue history shows last 30 days of completed runs with counts and dates

**Credit pack behaviour:**
- 1 credit = 1 successful unfollow action
- Credits are consumed only on successful completion — not on failures
- When credits hit 0: queue stops, prompt to buy more or upgrade to Pro

---

### F007 — Account Snapshots & Growth Tracking
**Priority:** P1 | **Tiers:** Pro, Pro+

- Daily snapshot taken automatically at 00:00 UTC for every connected Pro/Pro+ account
- Snapshot captures: followers count, following count, ghost count, ratio, timestamp
- Growth chart on dashboard: followers, following, ratio over last 30 days (line chart)
- "Ratio improvement" stat shows delta since first snapshot
- Data retention: 90 days for Pro, indefinite for Pro+

---

### F008 — CSV Export
**Priority:** P1 | **Tiers:** Pro, Pro+

- "Export CSV" button on ghost list page (visible to Pro/Pro+ only)
- CSV columns: `display_name, handle, followers, following, ratio, tier, priority_score, last_post_date, account_type`
- Filename format: `ghoast-export-[handle]-[YYYY-MM-DD].csv`
- Generates within 5 seconds for lists up to 5,000 accounts
- Direct download — no email link, no delay

---

### F009 — Multi-Account Support
**Priority:** P1 | **Tiers:** Pro+

- Pro+ users can connect up to 3 Instagram accounts
- Account switcher in nav — switches between accounts without logout
- Data (ghost list, queue, snapshots) is scoped to the currently selected account — no data mixing
- Each account has independent queue, daily cap, and snapshot history
- On Pro+ → Pro downgrade: additional accounts disconnected after 7-day grace period with advance warning

---

### F010 — Whitelist Rules
**Priority:** P1 | **Tiers:** Pro+

- Any ghost list account can be whitelisted from its row
- Whitelisted accounts show a lock icon and cannot be selected for the queue (hard block)
- Whitelist persists per Instagram account across sessions
- Whitelist management page shows all whitelisted accounts with option to remove
- Maximum whitelist size: 500 accounts per Instagram account

---

### F011 — Ghost Follower Detector
**Priority:** P2 | **Tiers:** Pro+

- Identifies followers who have not liked or commented on any of the user's posts in the last 90 days
- Shown as a separate tab from the main ghost list
- NOT included in bulk queue by default in V2 — view only (bulk action for ghost followers is V2.1)
- Columns: handle, follower count, last engagement date (if ever), engagement count in last 90 days
- Report refreshes weekly automatically

---

### F012 — Credit Packs
**Priority:** P0 (monetisation) | **Tiers:** Free (purchase only)

| Pack | Credits | Price |
|------|---------|-------|
| Starter | 100 unfollows | $2.99 |
| Standard | 500 unfollows | $9.99 |
| Power | 1,500 unfollows | $19.99 |

- Purchased via Stripe — standard card checkout
- Credits never expire
- 1 credit = 1 successful unfollow; failed unfollows do NOT consume credits
- Credit balance shown in dashboard header and ghost list
- Purchases are stackable (two Starter packs = 200 credits)
- All credit transactions logged with: timestamp, pack type, price, credits added, balance after
- Idempotent on duplicate Stripe webhook delivery — guard with `stripe_payment_intent_id` uniqueness

---

## Freemium Gate — What Is Free vs Paid

| Capability | Free | Pro | Pro+ |
|-----------|------|-----|------|
| Full ghost scan (unlimited rescans) | ✓ | ✓ | ✓ |
| Full ghost list with tier ranking | ✓ | ✓ | ✓ |
| Follower / following / ratio dashboard | ✓ | ✓ | ✓ |
| Manual unfollows per day | 10 | 10 | 10 |
| Bulk unfollow queue | — | 150/day | 150/day |
| Background queue execution | — | ✓ | ✓ |
| Daily account snapshots | — | ✓ | ✓ |
| CSV export | — | ✓ | ✓ |
| Scheduled weekly auto-cleanup | — | ✓ | ✓ |
| Instagram accounts | 1 | 1 | 3 |
| Whitelist rules | — | — | ✓ |
| Ghost follower detector | — | — | ✓ |
| Priority queue speed | — | — | ✓ |

---

## Upgrade Prompt Triggers

Shown at these specific moments — not randomly, not in onboarding:

| Trigger | Prompt Shown |
|---------|-------------|
| User reaches 10 manual unfollows for the day | "You've used your 10 daily unfollows. Upgrade to Pro for 150/day, automated queue." |
| User clicks "Select All Tier 1" for the first time | "You have X Tier 1 ghosts. Pro users run 150/day while they sleep." |
| User opens ghost list with >50 Tier 1 ghosts | Banner on Tier 1 tab: "X accounts you could cut right now. Pro does it for you." |
| Day 3 drip email trigger | "Your [N] ghosts are still there." → CTA to bulk queue |
| Free user, day 7, no upgrade | In-app banner on dashboard: credit pack promotion |

---

## Security Requirements

| Requirement | Specification |
|-------------|--------------|
| Session token storage | AES-256-CBC encrypted, IV stored in separate column |
| User password hashing | bcrypt, cost factor ≥ 12 |
| Data in transit | HTTPS only — TLS 1.2+ |
| Ghoast app session | JWT, 24h expiry + refresh token |
| Stripe webhook verification | Signature validated on every webhook — fail hard on invalid |
| SQL injection prevention | Parameterised queries only — no raw SQL with user input |
| Ghoast API rate limiting | 100 req/min per IP, 500 req/hr per authenticated user |
| Admin access | IP-allowlist protected — no public admin panel |
| Session token logging | Never log — redact before any log output or Sentry event |

---

## Performance Requirements

| Scenario | Requirement |
|----------|------------|
| Ghost scan (up to 5,000 following) | Completes in < 60 seconds |
| Ghost list dashboard load (2,000 ghosts) | Renders in < 2 seconds |
| CSV export (5,000 rows) | Generates in < 5 seconds |
| Queue status SSE event delivery | Within 1 second of job completion |
| Ghost scoring (5,000 ghosts) | Completes within 30 seconds of scan |

---

## Error Handling Requirements

| Error Scenario | Required Behaviour |
|----------------|-------------------|
| Instagram session expires mid-scan | Pause scan, notify user, prompt to reconnect |
| Instagram session expires mid-queue | Pause queue, in-app banner + email notification |
| Instagram rate limit during scan | Auto-pause 60 seconds, resume silently |
| Instagram rate limit during queue | Pause worker 15 minutes, notify user |
| 3 rate limits in one day | Pause worker 24 hours, notify user |
| Stripe payment failure | Email notification, 3-day grace period before downgrade |
| Duplicate Stripe webhook | Idempotent — check `stripe_payment_intent_id` uniqueness |
| Failed unfollow API call | Mark job failed, do NOT consume credit, do NOT decrement daily cap |

---

## Instagram ToS Mitigation Requirements

These are non-negotiable — must be implemented before launch:

1. ToS disclosure shown and accepted before any Instagram account connection
2. Disclosure written in plain language — not legalese
3. No password capture at any point in the auth flow
4. Session token never appears in logs, error messages, or API responses
5. Rate limiting enforced at application level on all Instagram API calls
6. Tier 5 accounts hard-blocked from all bulk actions
7. Daily unfollow cap enforced server-side (not just client-side)
8. Queue uses randomised delays — no constant-interval unfollowing
9. Session pauses built into the queue — not continuous operation
10. Alert engineering on any user-reported Instagram account restriction linked to Ghoast

---

## Phase Delivery Schedule

| Feature | Phase 1 MVP (Wk 1-4) | Phase 2 V1.1 (Wk 5-8) | Phase 3 V2 (Mo 3-6) |
|---------|--------------------|----------------------|---------------------|
| F001 Instagram Connection | ✓ | | |
| F002 Ghost Scan | ✓ | | |
| F003 Scoring Algorithm | ✓ | | |
| F004 Ghost List Dashboard | ✓ | | |
| F005 Manual Unfollow (Free) | ✓ | | |
| F006 Bulk Queue (Pro) | ✓ | | |
| F012 Credit Packs | ✓ (Starter + Standard) | Power pack | |
| F007 Snapshots | | ✓ | |
| F008 CSV Export | | ✓ | |
| F009 Multi-Account (Pro+) | | ✓ | |
| F010 Whitelist (Pro+) | | ✓ | |
| F011 Ghost Follower Detector | | | ✓ |
| Push notifications | | | ✓ |
| Annual pricing | | | ✓ |
| Referral programme | | | ✓ |
