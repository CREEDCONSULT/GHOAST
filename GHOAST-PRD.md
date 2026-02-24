# GHOAST — Product Requirements Document

**Version:** 1.0
**Date:** February 2026
**Status:** Draft — Ready for Engineering Handoff
**Tagline:** See who ghosted your count.
**Handle:** @ghoastapp
**Domain:** ghoast.app
**Month 1 Revenue Target:** $5,000

---

## Table of Contents

1. [Product Overview & Vision](#1-product-overview--vision)
2. [User Personas](#2-user-personas)
3. [Feature Specifications](#3-feature-specifications)
4. [API & Data Architecture](#4-api--data-architecture)
5. [Freemium & Monetisation Logic](#5-freemium--monetisation-logic)
6. [Release Phasing](#6-release-phasing)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Analytics & Success Metrics](#8-analytics--success-metrics)
9. [Open Questions Log](#9-open-questions-log)

---

## 1. Product Overview & Vision

### 1.1 What Ghoast Is

Ghoast is an Instagram follower intelligence tool. It analyses a user's full following list, identifies every account that does not follow them back, scores each non-follower across five dimensions, ranks them into five priority tiers, and enables bulk unfollowing via a background queue engine with built-in rate-limit safeguards.

The tool solves a specific, recurring, unresolved problem: Instagram users accumulate non-reciprocal follows over time through follow-back behaviour, brand follows, and forgotten accounts. They know the problem exists but lack the tools to resolve it efficiently. Manual unfollowing is too slow. Existing tools are either too risky (bulk-fire API calls), too generic (no ranking), or too complex (built for power users). Ghoast does the work, adds the intelligence, and ships the results as an actionable ranked list with one-tap bulk execution.

### 1.2 Core Emotional Promise

> "See who ghosted your count."

Not productivity. Not wellness. Intelligence with a dark sense of humour. The brand knows exactly what it does and says it without flinching.

### 1.3 Product Vision

In 12 months, Ghoast is the default account hygiene tool for Instagram-native creators, personal brand builders, and ratio-aware users. Every Instagram power user who cares about their following count and engagement rate knows about Ghoast. The product runs in the background, needs no babysitting, and delivers clean results. Users think of unfollowing ghosts the way they think of clearing their inbox: a regular maintenance task, handled by the tool that does it best.

### 1.4 What Ghoast Is Not

- Not a follower growth tool (does not help users gain followers)
- Not a bot or automation tool for engagement (no likes, comments, DMs)
- Not a scheduler or content tool
- Not built on the official Meta Graph API (uses Instagram private API / session cookie method)
- Not a cross-platform tool (Instagram only in V1, V2)
- Not designed for enterprise or agency use (individual account focus in V1)

### 1.5 Success Definition — Month 1

| Metric | Target |
|--------|--------|
| Total revenue | $5,000 |
| Sign-ups | 500+ |
| Ghost scans run | 400+ |
| Free → Pro conversion | 8-12% |
| Avg ghosts found per account | 131 |
| Support tickets re: account flags | < 3 |

---

## 2. User Personas

### 2.1 Primary Persona — The Ratio Builder

**Name:** Alex, 26
**Occupation:** Freelance content creator / part-time social media manager
**Location:** Urban, US or UK
**Income:** $35K-$60K
**Instagram following count:** 800-3,000
**Follower count:** 600-2,500
**Ratio:** Currently below 1.0 (following more than following back)

**Psychographics:**
- Treats Instagram as a professional and creative tool, not just a social network
- Aware of what a follower ratio signals to the algorithm and to potential brand partners
- Accumulated ghosts through aggressive follow-back behaviour 18-24 months ago
- Has thought about cleaning the list manually but never committed — too slow, too many accounts
- Does not like tools that feel "spammy" or that put their account at risk
- Wants results they can trust, not guesswork

**Current behaviour:** Occasionally goes through the following list manually and unfollows accounts one at a time. Does this for 10-15 minutes, unfollows 20-30 accounts, gives up. The problem is not resolved.

**Device:** Mobile-first. Will use the web tool on desktop for initial setup, returns on mobile to check queue.

**Quote:** *"I know I'm following like 400 accounts that don't follow me back. I just can't be bothered to go through them one by one."*

**Job to be done:** When I realise my ratio is making me look less credible, I want a tool that shows me exactly who isn't following me back and removes them without me having to sit there and do it manually, so I can improve my ratio and focus on content.

**Aha moment:** The moment Alex sees 131 red accounts in Tier 1 — all pre-selected, all safe to cut — and realises they can clear the entire list in one click.

---

### 2.2 Secondary Persona — The Micro-Influencer

**Name:** Jamie, 31
**Occupation:** Fitness coach with personal brand, ~12,000 Instagram followers
**Following count:** 1,800
**Ratio:** 6.7x (good, but wants to protect it)

**Psychographics:**
- Ratio is a credibility signal they actively manage — mentions it to brand partners
- Runs account hygiene quarterly as part of their content strategy
- Has tried competitors (Mass Unfollow, Cleaner for IG) but found them either risky or dumb — no ranking
- Willing to pay for a tool that protects the account while doing the work

**Job to be done:** When I do my quarterly account audit, I want a tool that ranks my non-followers intelligently so I can cut the obvious ones and keep the industry accounts worth having, without risking my account with a ban.

**Key feature needs:** Tier ranking (to make smart decisions), whitelist (to protect specific accounts), CSV export (for their own records), multi-account (manages a second brand account).

---

### 2.3 Anti-Persona

**Who Ghoast is NOT for:**

- Users who follow < 200 accounts (no meaningful ghost problem to solve)
- Users who do not care about follower ratio (casual Instagram users, people using it only for private browsing)
- Social media agencies managing multiple client accounts (V1 is not built for agency workflows, volume, or permissions structures)
- Users seeking Instagram growth hacks or follower buying tools (Ghoast removes follows, not adds them)
- Users looking for engagement automation (likes, comments, DM automation — out of scope, different risk profile)

---

## 3. Feature Specifications

### 3.1 Feature Priority Key

| Priority | Definition |
|----------|-----------|
| P0 | Launch blocker. Product cannot ship without this. |
| P1 | High value. Must ship in MVP or shortly after. |
| P2 | Nice to have. Deferred to V1.1 or V2. |

---

### 3.2 F001 — Instagram Account Connection

**Priority:** P0
**Complexity:** High
**Tier:** All tiers (required for any use)

**User Story:**
As a new user, I want to connect my Instagram account securely so that Ghoast can analyse my following list.

**Acceptance Criteria:**
- AC1: User is presented with an embedded Instagram login flow (web view / iframe) — not a redirect to Instagram's own app
- AC2: Ghoast captures the session cookie/token upon successful authentication — no password is stored at any point
- AC3: Session token is encrypted with AES-256 before being written to the database — plaintext token never persists to disk or logs
- AC4: User must accept a ToS disclosure before initiating the login — disclosure states (a) Ghoast uses a private API method, (b) this technically violates Instagram ToS, (c) Ghoast applies rate limiting to protect the account, (d) Ghoast does not store passwords
- AC5: If the session token is invalid or expired, the user is prompted to reconnect — the expired token is immediately deleted from the database
- AC6: Authentication completes and the user reaches the dashboard within 10 seconds of successful login
- AC7: Failed login attempts show a specific error message ("Login failed — please try again. Do not use a previously banned account.")
- AC8: The connection flow works on both desktop Chrome/Firefox/Safari and mobile Chrome/Safari

**Notes for Engineering:**
Session token capture must be done in the embedded web view by intercepting the cookie after the Instagram login form submits successfully. Do not build a credential-capture form. Do not store passwords. Token must be the `sessionid` cookie value from Instagram's response.

---

### 3.3 F002 — Ghost Scan Engine

**Priority:** P0
**Complexity:** High
**Tier:** All tiers

**User Story:**
As a connected user, I want Ghoast to scan my full following list and identify everyone who doesn't follow me back, so I can see my complete ghost list.

**Acceptance Criteria:**
- AC1: Scan initiates automatically upon first account connection and can be re-triggered manually from the dashboard
- AC2: Scan fetches the full following list using the Instagram private API — paginating until all accounts are retrieved
- AC3: Scan fetches the full followers list using the Instagram private API — paginating until all accounts are retrieved
- AC4: Ghost set is calculated as: `following_list - followers_list` (set difference). An account is a ghost if the user follows them but they do not follow back
- AC5: Scan for an account with 5,000 following completes in under 60 seconds under normal network conditions
- AC6: Scan progress is displayed to the user in real time (percentage complete, accounts scanned/total)
- AC7: If the scan fails mid-way (network error, session expiry), the system saves progress and attempts to resume — if resume fails, user is notified and prompted to rescan
- AC8: Scan results persist in the database — the user does not need to rescan every session
- AC9: A "last scanned" timestamp is displayed on the dashboard
- AC10: Rescan is available at any time and overwrites the previous result

**Notes for Engineering:**
The Instagram private API paginates following/followers in batches of ~200. A following count of 5,000 requires ~25 API calls per list (50 total). Space these calls with randomised 500ms-2s delays to avoid triggering Instagram's rate limiter at the scan stage. Log all API calls for debugging but do not log response bodies containing user data in production.

---

### 3.4 F003 — Ghost Scoring Algorithm

**Priority:** P0
**Complexity:** High
**Tier:** All tiers

**User Story:**
As a user viewing my ghost list, I want every ghost to be scored and ranked so I can prioritise which ones to remove first.

**Scoring System — 5 Dimensions (each scored 0-20, summed to Priority Score 0-100):**

**Dimension 1: Account Type Classification (0-20)**
- Determined by: username patterns, bio keywords, follower ratio, verified badge
- Personal account: 0-5 points (higher score = lower priority to remove)
- Creator account: 5-12 points
- Brand/Restaurant/Local Business: 15-18 points
- Celebrity/Verified: 18-20 points
- **Implementation note:** Use keyword matching on bio text (e.g. "official", "store", "shop", brand category indicators) + follower/following ratio heuristics. Celebrity = verified badge OR follower count > 1M.

**Dimension 2: Follower-to-Following Ratio (0-20)**
- Score = min(20, floor(their_followers / their_following * 4))
- High ratio accounts (follow far fewer than follow them) receive high scores — reciprocity not expected from these
- Accounts with ratio < 1.0 receive score of 0-3

**Dimension 3: Engagement Proxy (0-20)**
- Has the user liked or commented on this account's posts in the last 90 days?
- Yes: 15-20 points
- No: 0 points
- **Implementation note:** This data may not be available via private API for all accounts. If engagement data is unavailable, default to 0 and flag as `engagement_unknown = true`. Do not fake this score.

**Dimension 4: Account Size Band (0-20)**
- Nano (<1K followers): 0-3
- Micro (1K-10K): 4-8
- Mid (10K-100K): 9-13
- Macro (100K-1M): 14-17
- Mega (>1M): 18-20
- Larger accounts receive higher scores — removal is expected to have less social impact, but these are often worth keeping

**Dimension 5: Post Recency (0-20)**
- Last post within 30 days: 0-3
- Last post 30-90 days: 5-10
- Last post 90+ days: 15-20 (dormant — strong ghost candidate)
- No posts ever / private account: 15 (treat as dormant)

**Priority Score → Tier Mapping:**

| Tier | Score Range | Label | Color |
|------|------------|-------|-------|
| 1 | 0-20 | Safe to Cut | #FF3E3E |
| 2 | 21-40 | Probably Cut | #FF7A3E |
| 3 | 41-60 | Your Call | #FFD166 |
| 4 | 61-80 | Might Keep | #7B4FFF |
| 5 | 81-100 | Keep Following | #00E676 |

**Acceptance Criteria:**
- AC1: Every ghost in the ghost list has a Priority Score between 0-100
- AC2: Every ghost is assigned to exactly one of the five tiers based on their score
- AC3: Tier 5 accounts are automatically excluded from any bulk unfollow selection — they cannot be added to the queue
- AC4: The ghost list is sorted by Priority Score ascending (Tier 1 first) by default
- AC5: Users can sort by: Priority Score, Follower Count, Account Type, Last Post Date
- AC6: Each ghost's tier, score, account type classification, and post recency are displayed in the ghost list UI
- AC7: Scoring runs server-side immediately after the scan completes — scores are available within 30 seconds of scan completion for lists up to 5,000 ghosts

---

### 3.5 F004 — Ghost List Dashboard

**Priority:** P0
**Complexity:** Medium
**Tier:** All tiers

**User Story:**
As a user, I want to see my full ghost list ranked by tier so I can understand my account's ghost problem and decide which accounts to remove.

**Acceptance Criteria:**
- AC1: Dashboard displays: total followers, total following, ghost count, follower ratio (following/followers, rounded to 2 decimal places)
- AC2: Ghost list shows all non-followers, grouped by tier, sorted by Priority Score ascending
- AC3: Each ghost list row shows: profile photo (if available), display name, @handle, follower count, tier badge, Priority Score
- AC4: Tier filter tabs allow viewing one tier at a time or all tiers together
- AC5: Search bar filters the ghost list by display name or @handle in real time
- AC6: Free tier users see the complete ranked list — no data is hidden behind the paywall
- AC7: "Last scanned" timestamp displayed in the header
- AC8: "Rescan" button triggers F002, replaces current results when complete

---

### 3.6 F005 — Manual Unfollow (Free Tier)

**Priority:** P0
**Complexity:** Low
**Tier:** Free

**User Story:**
As a free tier user, I want to manually unfollow individual ghosts from the dashboard so I can act on my ghost list without upgrading.

**Acceptance Criteria:**
- AC1: Each ghost list row has an "Unfollow" button
- AC2: Clicking Unfollow triggers an immediate unfollow via the Instagram private API
- AC3: The unfollowed account is removed from the ghost list within 3 seconds of the action completing
- AC4: Free tier users are limited to 10 manual unfollows per 24-hour rolling window
- AC5: A counter displays remaining manual unfollows for the day ("7 of 10 remaining")
- AC6: When the daily limit is reached, the Unfollow button is replaced with an upgrade prompt: "Upgrade to Pro for bulk removal — 150/day"
- AC7: The 24-hour window resets at midnight UTC
- AC8: If the unfollow API call fails (rate limited by Instagram, session expired), the user sees a specific error message and the unfollow count is NOT decremented

---

### 3.7 F006 — Bulk Unfollow Queue (Pro / Pro+)

**Priority:** P0 for Pro tier launch
**Complexity:** High
**Tier:** Pro, Pro+, Credit Packs

**User Story:**
As a Pro user, I want to select multiple ghosts and add them to a background queue that unfollows them automatically, so I can clean my list without sitting at my phone.

**Bulk Queue Engine Spec:**

| Parameter | Value |
|-----------|-------|
| Queue technology | BullMQ + Redis |
| Delay between actions | Randomised 8-45 seconds |
| Session pause trigger | Every 10-15 unfollows |
| Session pause duration | 3-7 minutes (randomised) |
| Daily cap (Pro) | 150 unfollows |
| Daily cap (Pro+) | 150 unfollows (priority speed — shorter delays) |
| Credit pack cap | 100 unfollows per pack consumed |
| Queue persistence | Queue survives browser close and server restart |

**Acceptance Criteria:**
- AC1: From the ghost list, users can select individual accounts or select all accounts in a tier using a "Select Tier 1" button
- AC2: Tier 1 accounts are pre-selected by default when the bulk queue screen is opened — user can deselect any account before starting
- AC3: Tier 5 accounts cannot be added to the queue — the checkbox is disabled and greyed out with tooltip "Auto-protected"
- AC4: A queue summary shows: selected count, estimated completion time based on delay parameters, tier breakdown of selected accounts
- AC5: User clicks "Start Queue" — queue begins processing in the background immediately
- AC6: The dashboard shows a live queue status bar: current position, next unfollow countdown (live seconds), percentage complete
- AC7: The queue continues processing if the user closes the browser — it is server-side, not client-side
- AC8: The queue pauses automatically if Instagram returns a rate-limit or challenge response — user is notified and queue resumes after 15 minutes
- AC9: The queue stops and notifies the user if the session token expires — user is prompted to reconnect
- AC10: Completed unfollows are removed from the ghost list in real time
- AC11: The daily cap (150) resets at midnight UTC — a counter shows remaining queue capacity
- AC12: Queue history shows the last 30 days of completed queue runs with counts and dates

---

### 3.8 F007 — Account Snapshots & Growth Tracking (Pro / Pro+)

**Priority:** P1
**Complexity:** Medium
**Tier:** Pro, Pro+

**User Story:**
As a Pro user, I want daily snapshots of my follower/following/ghost counts so I can track my ratio improvement over time.

**Acceptance Criteria:**
- AC1: A snapshot is automatically taken once per day for every connected Pro/Pro+ account at 00:00 UTC
- AC2: Snapshot captures: followers count, following count, ghost count, ratio, date
- AC3: Growth chart on the dashboard shows followers, following, and ratio over the last 30 days (line chart)
- AC4: "Ratio improvement" stat shows the delta since the user's first snapshot
- AC5: Snapshots are retained for 90 days for Pro, indefinitely for Pro+

---

### 3.9 F008 — CSV Export (Pro / Pro+)

**Priority:** P1
**Complexity:** Low
**Tier:** Pro, Pro+

**User Story:**
As a Pro user, I want to export my ghost list to CSV so I can keep my own records.

**Acceptance Criteria:**
- AC1: "Export CSV" button available on the ghost list page for Pro/Pro+ users
- AC2: CSV includes columns: display_name, handle, followers, following, ratio, tier, priority_score, last_post_date, account_type
- AC3: CSV filename format: `ghoast-export-[handle]-[YYYY-MM-DD].csv`
- AC4: Export generates within 5 seconds for lists up to 5,000 accounts
- AC5: File downloads directly — no email link, no delay

---

### 3.10 F009 — Multi-Account Support (Pro+)

**Priority:** P1
**Complexity:** Medium
**Tier:** Pro+

**User Story:**
As a Pro+ user, I want to connect up to 3 Instagram accounts so I can manage my personal and brand accounts from one Ghoast login.

**Acceptance Criteria:**
- AC1: Pro+ users can connect up to 3 Instagram accounts via separate OAuth flows
- AC2: Account switcher in the nav allows switching between connected accounts without logging out
- AC3: Ghost list, queue, and dashboard data are scoped to the currently selected account — data does not mix between accounts
- AC4: Each connected account has its own independent queue, daily cap, and snapshot history
- AC5: If a user downgrades from Pro+ to Pro, additional accounts beyond 1 are disconnected after a 7-day grace period — user is warned in advance

---

### 3.11 F010 — Whitelist Rules (Pro+)

**Priority:** P1
**Complexity:** Low
**Tier:** Pro+

**User Story:**
As a Pro+ user, I want to whitelist specific accounts so they can never be added to a bulk queue — even if they are in Tier 1.

**Acceptance Criteria:**
- AC1: Any account in the ghost list can be whitelisted by clicking a "Whitelist" button in the row
- AC2: Whitelisted accounts appear with a lock icon in the ghost list and cannot be selected for the queue
- AC3: Whitelist is stored per Instagram account (not per Ghoast user), so whitelists carry across sessions
- AC4: Whitelist page shows all whitelisted accounts with the option to remove any
- AC5: Maximum whitelist size: 500 accounts per Instagram account

---

### 3.12 F011 — Ghost Follower Detector (Pro+)

**Priority:** P2
**Complexity:** High
**Tier:** Pro+

**User Story:**
As a Pro+ user, I want to identify followers who follow me but never engage with my content, so I can understand my real engaged audience.

**Acceptance Criteria:**
- AC1: Ghost Follower report shows followers who have not liked or commented on any of the user's posts in the last 90 days
- AC2: Report is available as a separate tab from the main ghost list
- AC3: Ghost followers are NOT included in the bulk unfollow queue by default — this is a view-only report in V2 (bulk action for ghost followers is V2.1)
- AC4: Report includes: handle, follower count, last engagement date (if ever), engagement count in last 90 days
- AC5: Report is refreshed weekly automatically

---

### 3.13 F012 — Credit Packs

**Priority:** P0 for monetisation
**Complexity:** Medium
**Tier:** Free users purchasing one-time credits

**User Story:**
As a free user who doesn't want a subscription, I want to buy a credit pack so I can run the bulk queue for a one-time cleanup.

**Credit Pack Options:**

| Pack | Credits | Price |
|------|---------|-------|
| Starter | 100 unfollows | $2.99 |
| Standard | 500 unfollows | $9.99 |
| Power | 1,500 unfollows | $19.99 |

**Acceptance Criteria:**
- AC1: Credits are purchased via Stripe — standard card checkout, no account required beyond Ghoast login
- AC2: Credits never expire
- AC3: 1 credit = 1 unfollow action executed by the queue
- AC4: Credits are consumed only when a queue action completes successfully — failed unfollows do not consume credits
- AC5: Credit balance is displayed in the dashboard header and on the ghost list
- AC6: When credits reach 0, the queue stops and the user is shown a prompt to buy more or upgrade to Pro
- AC7: Credit purchases are stackable — buying two Starter packs = 200 credits
- AC8: Credit transactions are logged with timestamp, pack purchased, price, and credits added

---

## 4. API & Data Architecture

### 4.1 Instagram Private API Method

Ghoast uses Instagram's internal (unofficial) API — the same endpoints used by Instagram's own mobile app. This is not the official Meta Graph API.

**Why private API:** The official Meta Graph API does not provide access to the following/followers endpoints for third-party apps without Meta partnership approval. All direct competitors in this category use the same private API method.

**Risk:** Technically violates Instagram's ToS. Mitigation:
- Rate limiting built into every API call sequence
- No password storage — session cookie only
- User explicitly acknowledges the risk in onboarding ToS disclosure
- Ghoast applies conservative daily action limits well below what triggers Instagram's automated detection systems

**Key Endpoints Used:**

| Action | Instagram Private API Endpoint |
|--------|-------------------------------|
| Get following list | `GET /api/v1/friendships/{user_id}/following/` |
| Get followers list | `GET /api/v1/friendships/{user_id}/followers/` |
| Unfollow account | `POST /api/v1/friendships/destroy/{target_id}/` |
| Get user info | `GET /api/v1/users/{user_id}/info/` |

All requests must include the `sessionid` cookie in the request header. Requests must also include a valid `User-Agent` matching a real Instagram app version to avoid immediate rejection.

---

### 4.2 Data Model

**Primary Database:** PostgreSQL

```
users
├── id (UUID, PK)
├── email (string, unique)
├── password_hash (bcrypt)
├── created_at (timestamp)
├── stripe_customer_id (string, nullable)
└── subscription_tier (enum: free | pro | pro_plus)

instagram_accounts
├── id (UUID, PK)
├── user_id (FK → users.id)
├── instagram_user_id (string, unique per user)
├── handle (string)
├── display_name (string)
├── session_token_encrypted (text) -- AES-256 encrypted
├── session_token_iv (string) -- IV for AES decryption
├── connected_at (timestamp)
├── last_scan_at (timestamp, nullable)
├── followers_count (integer)
├── following_count (integer)
└── is_active (boolean)

ghosts
├── id (UUID, PK)
├── instagram_account_id (FK → instagram_accounts.id)
├── target_instagram_id (string) -- the ghost's Instagram user ID
├── target_handle (string)
├── target_display_name (string)
├── target_followers_count (integer)
├── target_following_count (integer)
├── target_last_post_at (timestamp, nullable)
├── account_type (enum: personal | creator | brand | celebrity)
├── priority_score (integer 0-100)
├── tier (integer 1-5)
├── is_whitelisted (boolean, default false)
├── engagement_proxy_score (integer 0-20)
├── engagement_unknown (boolean)
├── discovered_at (timestamp)
└── removed_at (timestamp, nullable) -- set when unfollowed

unfollow_queue_jobs
├── id (UUID, PK)
├── instagram_account_id (FK → instagram_accounts.id)
├── ghost_id (FK → ghosts.id)
├── status (enum: pending | processing | completed | failed | skipped)
├── queued_at (timestamp)
├── started_at (timestamp, nullable)
├── completed_at (timestamp, nullable)
├── error_message (string, nullable)
├── credit_consumed (boolean, default false)
└── retry_count (integer, default 0)

queue_sessions
├── id (UUID, PK)
├── instagram_account_id (FK → instagram_accounts.id)
├── started_at (timestamp)
├── completed_at (timestamp, nullable)
├── jobs_total (integer)
├── jobs_completed (integer)
├── jobs_failed (integer)
└── status (enum: active | completed | paused | cancelled)

account_snapshots
├── id (UUID, PK)
├── instagram_account_id (FK → instagram_accounts.id)
├── taken_at (timestamp)
├── followers_count (integer)
├── following_count (integer)
├── ghost_count (integer)
└── ratio (decimal 4,2)

credit_transactions
├── id (UUID, PK)
├── user_id (FK → users.id)
├── type (enum: purchase | consumed | refunded)
├── credits_delta (integer) -- positive for purchase, negative for consumed
├── stripe_payment_intent_id (string, nullable)
├── pack_type (enum: starter | standard | power, nullable)
├── created_at (timestamp)
└── balance_after (integer)

subscriptions
├── id (UUID, PK)
├── user_id (FK → users.id)
├── stripe_subscription_id (string)
├── tier (enum: pro | pro_plus)
├── status (enum: active | cancelled | past_due)
├── current_period_start (timestamp)
├── current_period_end (timestamp)
└── cancelled_at (timestamp, nullable)
```

---

### 4.3 Queue Architecture

**Technology:** BullMQ + Redis

**Queue Design:**

```
unfollow-queue (BullMQ queue)
  ├── Workers: 1 worker per instagram_account (not global — account-scoped)
  ├── Concurrency: 1 (sequential, never parallel unfollows for same account)
  ├── Job delay: randomised 8,000ms - 45,000ms between jobs
  ├── Session pause: after every 10-15 jobs, add a 180,000ms - 420,000ms delay
  ├── On rate-limit response from Instagram: pause worker for 15 minutes
  ├── On session-expiry response: pause worker, notify user, await token refresh
  └── On job failure: retry up to 3 times with exponential backoff, then mark failed
```

**Redis usage:**
- BullMQ job storage
- Daily unfollow counter per account (TTL: resets at midnight UTC via cron)
- Real-time queue status broadcast (Redis pub/sub → SSE to client)

**Real-time status delivery:**
- Server-Sent Events (SSE) endpoint at `/api/queue/status/:account_id`
- Client subscribes on dashboard load and receives live job completion events
- No WebSocket required for this use case

---

### 4.4 Session Token Security

- Session token is captured as a string value from the Instagram `sessionid` cookie
- Before writing to the database: encrypt with AES-256-CBC using a server-side key from environment variables
- The encryption key is stored in `.env` and never in the database or version control
- IV (initialisation vector) is generated fresh per encryption and stored alongside the ciphertext in `session_token_iv`
- When decrypting for API use: read ciphertext + IV from database, decrypt in memory, use token for the API call, discard from memory
- Token is never logged, never transmitted to the client, never included in API responses

---

## 5. Freemium & Monetisation Logic

### 5.1 Free Tier Design

The free tier intentionally gives users the full intelligence layer — scan, score, rank, view — but gates the execution layer (bulk unfollow). This split maximises the aha moment for free users (seeing all their ghosts ranked) while creating a clear, logical reason to upgrade (acting on that list efficiently).

**What is free:**
- Full ghost scan (unlimited rescans)
- Full ghost list with tier ranking and priority scores
- Follower/following/ratio stats dashboard
- 10 manual unfollows per day

**Rationale for free scan:** Users will not pay to see a number. They need to see the number first, feel the impact, and then pay to fix it. The free tier creates the problem awareness that drives the upgrade.

**Rationale for 10 manual unfollows:** Enough to validate that Ghoast works. Not enough to solve the problem (average user has 131 ghosts). Creates friction that motivates upgrade.

---

### 5.2 Upgrade Prompt Triggers

Upgrade prompts are shown at these specific moments — not randomly:

| Trigger Event | Prompt Shown |
|---------------|-------------|
| User reaches 10 manual unfollows for the day | "You've used your daily 10 unfollows. Upgrade to Pro for 150/day, automated queue." |
| User clicks "Select All Tier 1" for the first time | "You have 47 Tier 1 ghosts. The bulk queue removes them all automatically — Pro users run 150/day while they sleep." |
| User opens the ghost list and has >50 Tier 1 ghosts | Banner at top of Tier 1 tab: "47 accounts you could cut right now. Pro does it for you." |
| Day 3 email (via F002 flow) | Email: "Your 131 ghosts are still there." → CTA to bulk queue |
| User has been free for 7 days and has not upgraded | In-app banner on dashboard: credit pack promotion |

**Upgrade prompts never appear:** During onboarding, during scan, during queue status view.

---

### 5.3 Pricing & Revenue Model

| Tier | Price | Billing | Stripe Product |
|------|-------|---------|----------------|
| Free | $0 | N/A | N/A |
| Pro | $9.99 | Monthly recurring | `price_pro_monthly` |
| Pro+ | $24.99 | Monthly recurring | `price_proplus_monthly` |
| Credit Starter | $2.99 | One-time | `price_credits_100` |
| Credit Standard | $9.99 | One-time | `price_credits_500` |
| Credit Power | $19.99 | One-time | `price_credits_1500` |

**Stripe integration points:**
- Subscription creation: Stripe Checkout (hosted page) or embedded Elements
- Subscription management: Stripe Customer Portal (cancel, update card)
- Credit purchase: Stripe Payment Intents (one-time charge)
- Webhooks: `invoice.payment_succeeded`, `customer.subscription.deleted`, `payment_intent.succeeded`

**Cancellation policy:**
- Pro/Pro+ cancellation takes effect at end of current billing period
- No prorate refunds in V1 (standard for SaaS at this price point)
- On cancellation: user retains Pro access until period end, then downgrades to Free automatically
- Credits are never refunded or expired on cancellation

---

### 5.4 Revenue Target Decomposition — Month 1

**Target: $5,000**

Achievable mix:
- 50 Pro subscribers × $9.99 = $499/month recurring
- 10 Pro+ subscribers × $24.99 = $250/month recurring
- ~150 credit pack purchases (avg $8 each) = $1,200 one-time
- Total month 1 with one-time credit packs: ~$1,949

**Reality check:** $5,000 in month 1 requires aggressive acquisition — approximately 500+ free sign-ups with 12% conversion. This is achievable with the Instagram carousel content strategy in the marketing playbook running 3-5x per week from launch. The Month 1 target is aspirational; $2,000-$3,000 is the realistic floor.

---

## 6. Release Phasing

### Phase 1 — MVP (Weeks 1-4)

**Goal:** Get to $1,000 in revenue. Validate that users scan, see their ghost list, upgrade, and run the queue without account flags.

**Scope:**
- F001: Instagram Account Connection
- F002: Ghost Scan Engine
- F003: Ghost Scoring Algorithm
- F004: Ghost List Dashboard
- F005: Manual Unfollow (Free Tier)
- F006: Bulk Unfollow Queue (Pro only — single account)
- F012: Credit Packs (Starter and Standard only)
- User authentication (email + password — no social login in V1)
- Stripe integration for Pro subscription and credit packs
- Email onboarding sequence (Emails 1-2 from marketing playbook)
- Basic account page (manage subscription, disconnect account)

**Not in Phase 1:**
- Pro+ tier
- Multi-account
- CSV export
- Snapshots / growth tracking
- Whitelist
- Ghost follower detector

**Success criteria for Phase 1:**
- 200+ scan completions
- 0 account bans attributed to Ghoast queue behaviour
- 8%+ free-to-paid conversion
- Queue processes 1,000+ unfollows total without Instagram rate limit incidents

---

### Phase 2 — V1.1 (Weeks 5-8)

**Goal:** Hit $3,000 MRR. Activate Pro features that drive retention. Launch Pro+.

**Scope:**
- F007: Account Snapshots & Growth Tracking
- F008: CSV Export
- F009: Multi-Account Support (Pro+ launch)
- F010: Whitelist Rules (Pro+ launch)
- Pro+ tier activation in Stripe
- Credit Power pack ($19.99)
- Email 3 (queue reveal email) in drip sequence
- Referral tracking (UTM-based, no referral rewards program yet)
- Rescan scheduling (option for weekly auto-rescan)

**Success criteria for Phase 2:**
- 20+ Pro+ subscribers
- Pro churn < 10%/month
- Snapshot data being viewed by >60% of Pro users (validates feature value)

---

### Phase 3 — V2 (Months 3-6)

**Goal:** $10,000 MRR. Product becomes self-sustaining. Expand feature depth for power users.

**Scope:**
- F011: Ghost Follower Detector (Pro+)
- Scheduled weekly auto-cleanup (Pro / Pro+)
- Push notifications (queue complete, new ghost count, ratio milestone)
- Public API for agency/developer access (optional, deprioritise if no demand signal)
- Annual pricing option (20% discount — improves retention and cash flow)
- Instagram Stories integration for sharing ratio stats (organic growth flywheel)
- Referral programme (credits for referrals — 50 free credits per referred sign-up)

---

## 7. Non-Functional Requirements

### 7.1 Instagram ToS Risk Mitigation

Ghoast uses the Instagram private API. This is a known, accepted risk. The following mitigations are non-negotiable:

- **Disclosure:** Users must acknowledge the ToS risk before connecting their account. The disclosure must be written in plain language, not legal boilerplate.
- **No credential storage:** Passwords are never captured, stored, or transmitted. Only the session cookie is stored, encrypted.
- **Rate limiting:** All API interactions are rate-limited at the application level, well within safe thresholds. The queue engine (F006) enforces delays and daily caps.
- **Account protection:** Tier 5 accounts are auto-excluded from bulk actions. The system will never unfollow celebrities, verified accounts, or accounts with a follower count > 1M.
- **Error handling:** Any rate-limit response from Instagram pauses all queue activity for that account for 15 minutes minimum. Three consecutive rate-limit responses in one day pause the account for 24 hours.
- **Monitoring:** Alert engineering if any user reports an Instagram account restriction that appears linked to Ghoast queue activity.

---

### 7.2 Security

| Requirement | Implementation |
|-------------|---------------|
| Session token storage | AES-256-CBC encrypted at rest |
| Password storage | Bcrypt, minimum cost factor 12 |
| Data in transit | HTTPS only, TLS 1.2+ |
| User session (Ghoast app) | JWT, 24-hour expiry, refresh token |
| Stripe webhook verification | Signature validation on every webhook |
| SQL injection prevention | Parameterised queries via ORM (no raw SQL with user input) |
| Rate limiting (Ghoast API) | 100 requests/minute per IP, 500 requests/hour per user |
| Admin access | IP-allowlist protected — no public admin panel |

---

### 7.3 Performance

| Scenario | Requirement |
|----------|------------|
| Ghost scan (5,000 following) | Completes in < 60 seconds |
| Ghost list load (2,000 ghosts) | Dashboard renders in < 2 seconds |
| CSV export (5,000 rows) | Generates in < 5 seconds |
| Queue job processing | No more than 45-second delay between jobs |
| Real-time queue status update | SSE event delivered within 1 second of job completion |

---

### 7.4 Error Handling

| Error Scenario | Behaviour |
|----------------|-----------|
| Instagram session expired mid-scan | Scan pauses, user notified, prompted to reconnect |
| Instagram session expired mid-queue | Queue pauses, user notified via in-app banner and email |
| Instagram rate limit during scan | Scan pauses for 60 seconds, resumes automatically |
| Instagram rate limit during queue | Queue pauses for 15 minutes, user notified |
| Stripe payment failure | User notified by email, 3-day grace period before downgrade |
| Stripe webhook delivery failure | Stripe retries — Ghoast must be idempotent on duplicate webhook events |
| Database write failure during queue | Job marked as failed, not retried automatically — logged for engineering review |

---

### 7.5 Scalability

Phase 1 capacity target: support 500 concurrent connected accounts and 50 simultaneous active queues without degradation.

Infrastructure for Phase 1:
- Application: Single Node.js server (horizontal scale when needed)
- Database: PostgreSQL (single instance with read replica if needed at 1,000+ users)
- Queue: Redis (single instance, upgrade to Redis Cluster at scale)
- File storage: None required in V1 (no file uploads)

---

## 8. Analytics & Success Metrics

### 8.1 North Star Metric

**Ghost Removals Per Day** — the number of successful unfollow actions executed across all active queues in a 24-hour period. This metric captures both user activation and product health simultaneously.

---

### 8.2 Metric Framework

**Acquisition:**
- Daily sign-ups (target: 20+/day in Month 1 launch window)
- Sign-up source breakdown (Instagram, referral, direct, email)
- CAC by channel

**Activation:**
- % of sign-ups who complete a ghost scan within 24 hours (target: 85%)
- % of sign-ups who view their full ghost list within 24 hours (target: 70%)
- Time from sign-up to first ghost scan

**Conversion:**
- Free → Pro conversion rate (target: 8-12%)
- Free → Credit Pack purchase rate (target: 5-8%)
- Upgrade trigger source (which prompt drove the conversion)

**Engagement:**
- Average ghost count at time of scan
- % of free users who use all 10 daily manual unfollows
- Queue jobs started per Pro user per week

**Retention:**
- Day 7 retention (target: 40%)
- Day 30 retention (target: 25%)
- Monthly churn (Pro + Pro+, target: < 8%)

**Revenue:**
- MRR
- Credit pack revenue (one-time)
- Total revenue
- ARPU (average revenue per paying user)

**Health:**
- Instagram rate limit events per day (target: < 5)
- Account restriction reports per week (target: 0)
- Queue completion rate (jobs completed / jobs attempted, target: > 97%)

---

### 8.3 Analytics Implementation

- **Product analytics:** PostHog (self-hosted or cloud) — event-level tracking for all user actions
- **Revenue:** Stripe Dashboard + custom webhook events to PostHog
- **Error tracking:** Sentry
- **Uptime monitoring:** BetterUptime or similar — alert if uptime < 99.5%

**Key events to track (PostHog):**
- `account_connected`
- `scan_started`
- `scan_completed` (with ghost_count, tier_breakdown)
- `manual_unfollow_clicked`
- `daily_limit_reached`
- `upgrade_prompt_shown` (with trigger_type)
- `queue_started` (with job_count, tier_breakdown)
- `queue_completed` (with jobs_completed, jobs_failed)
- `subscription_started` (with tier, source)
- `credit_pack_purchased` (with pack_type)

---

## 9. Open Questions Log

| # | Question | Owner | Priority |
|---|----------|-------|----------|
| OQ-01 | **Legal entity:** Does Ghoast need a separate LLC before accepting payments via Stripe? What jurisdiction? | Founder / Legal | P0 |
| OQ-02 | **Instagram private API stability:** What is the monitoring strategy if Instagram changes the following/followers API endpoint? How quickly can we patch? | Engineering | P0 |
| OQ-03 | **ToS disclosure wording:** Has the onboarding disclosure been reviewed by a lawyer? Specifically: does the disclosure adequately limit liability if a user's account is restricted? | Founder / Legal | P0 |
| OQ-04 | **AES-256 key management:** Where is the encryption key stored in production? AWS Secrets Manager, environment variable on the server, or KMS? What is the rotation policy? | Engineering | P0 |
| OQ-05 | **Engagement Proxy data availability:** Testing needed to confirm whether the Instagram private API returns the user's like/comment history on non-followed accounts. If not available, Dimension 3 of the scoring algorithm defaults to 0 for all ghosts — which significantly reduces the score spread. Is this acceptable? | Engineering | P1 |
| OQ-06 | **Scan frequency for free users:** Should free users be limited to 1 rescan per 24 hours, or unlimited rescans? Unlimited rescans could drive significant API load at scale. | Product | P1 |
| OQ-07 | **Mobile experience:** Is the V1 dashboard mobile-responsive, or desktop-only? The primary persona (Alex) is mobile-first. A degraded mobile experience will hurt activation. | Design / Engineering | P1 |
| OQ-08 | **Queue pausing UX:** When the queue auto-pauses due to a rate limit, what is the exact in-app notification? Push notification, email, or in-app banner only? | Design | P1 |
| OQ-09 | **App store:** Is Ghoast V1 web-only, or is a native iOS/Android app planned for Phase 2? A native app changes the auth flow significantly (embedded web view approach differs on native). | Founder | P2 |
| OQ-10 | **Refund policy:** The PRD states no prorate refunds. This should be explicitly stated in the Terms of Service and tested against consumer protection laws in key markets (UK, EU, US). | Founder / Legal | P2 |
| OQ-11 | **Ghost follower detector accuracy:** The ghost follower detector (F011) requires access to engagement data on the user's own posts. Confirm this data is available via the private API before committing to the feature in Pro+. | Engineering | P2 |
| OQ-12 | **Data retention:** How long are ghost records retained after a user deletes their account? Is there a GDPR/CCPA compliant data deletion flow? | Engineering / Legal | P2 |

---

*End of Ghoast PRD v1.0*

---

**Document prepared using context from:**
- `ghoast-brand.jsx` — brand system, UI components, pricing data
- `ghoast-marketing.docx` — brand voice, taglines, email drip, content strategy
- `ghoast-prd-prompt.docx` — product architecture, algorithm spec, tech stack decisions
- `MASTER BUILD PRODUCT PROMPTS .docx` — PRD structure framework

**Next step:** Engineering kickoff. Start with F001 (Instagram account connection) and F002 (ghost scan engine) in parallel. Schedule design review for F004 (ghost list dashboard) in Week 1.
