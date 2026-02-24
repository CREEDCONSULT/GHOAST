# TECH-STACK.md — Ghoast Technology Decisions

**Version:** 1.0 | Aligned with GHOAST-PRD.md Section 4
**Purpose:** Complete technology decisions for every layer of the Ghoast stack. New developers should be able to understand what is used, why it was chosen, and how to set up their environment.

---

## Stack Overview

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Next.js / React)                             │
│  ghoast.app — dashboard, landing page, checkout         │
├─────────────────────────────────────────────────────────┤
│  Backend (Node.js — Express or Fastify)                 │
│  REST API + SSE endpoint + Stripe webhook handler        │
├───────────────────┬─────────────────────────────────────┤
│  PostgreSQL       │  Redis                              │
│  Primary DB       │  Queue store + rate limit counters  │
├───────────────────┴─────────────────────────────────────┤
│  BullMQ (Queue Workers)                                 │
│  Unfollow queue engine — runs independently of web app  │
├─────────────────────────────────────────────────────────┤
│  Instagram Private API                                  │
│  Session cookie method — no official Meta API           │
└─────────────────────────────────────────────────────────┘
```

---

## Frontend

### Framework: Next.js (App Router)
**Why:** React is already established (see `ghoast-brand.jsx`). Next.js adds file-based routing, server-side rendering for the landing page (SEO matters for organic growth), and API routes if needed. App Router is the current standard.

**Version:** Next.js 14+ (App Router)

**Key pages:**
```
app/
├── page.tsx                    ← Landing page (server-rendered for SEO)
├── login/page.tsx              ← Ghoast login / sign-up
├── connect/page.tsx            ← Instagram OAuth embedded web view
├── dashboard/
│   ├── page.tsx                ← Overview stats + queue status
│   ├── ghost-list/page.tsx     ← Full ranked ghost list
│   ├── bulk-unfollow/page.tsx  ← Queue selection and start
│   ├── growth/page.tsx         ← Snapshot charts (Pro/Pro+)
│   └── settings/
│       ├── account/page.tsx    ← Instagram account management
│       ├── billing/page.tsx    ← Subscription + credit packs
│       └── whitelist/page.tsx  ← Whitelist management (Pro+)
├── pricing/page.tsx            ← Pricing page
└── api/
    └── webhooks/stripe/route.ts ← Stripe webhook handler (or in backend)
```

---

### Styling: CSS Variables + Scoped CSS Modules
**Why:** The brand system is already defined in `ghoast-brand.jsx` as CSS custom properties. Preserve the exact variable names. For component styles, use CSS Modules (`.module.css`) to scope them.

**No Tailwind in V1** unless the team prefers it — the existing design system uses CSS variables that map cleanly without a utility class layer.

**Design token import (global CSS):**
```css
:root {
  --black: #080810;
  --slate: #111120;
  --slate2: #181830;
  --specter: #1A1A3A;
  --violet: #7B4FFF;
  --violet-lo: rgba(123,79,255,.14);
  --violet-mid: rgba(123,79,255,.35);
  --cyan: #00E5FF;
  --cyan-lo: rgba(0,229,255,.1);
  --red: #FF3E3E;
  --green: #00E676;
  --ghost: #E8E8FF;
  --muted: #7070A0;
  --grad: linear-gradient(135deg,#7B4FFF 0%,#00E5FF 100%);
  --grad-r: linear-gradient(135deg,#00E5FF 0%,#7B4FFF 100%);
  --grad-soft: linear-gradient(135deg,rgba(123,79,255,.25) 0%,rgba(0,229,255,.25) 100%);
}
```

---

### Real-time Updates: Server-Sent Events (SSE)
**Why:** The queue dashboard needs live updates (countdown, jobs completed, ratio improving). SSE is simpler than WebSockets for unidirectional server → client streaming. No external dependency.

**SSE endpoint:** `GET /api/queue/status/:account_id`
- Client subscribes on dashboard mount
- Server pushes events on each queue job completion
- Client updates ghost list and stats in real time

---

## Backend

### Runtime: Node.js
**Version:** Node.js 20 LTS (or later LTS)
**Why:** BullMQ and most Instagram scraping tooling is Node-native. Keeps the stack homogeneous with the frontend.

### Framework: Fastify (preferred) or Express
**Why Fastify:** Faster than Express, built-in schema validation, TypeScript-first. Either works — pick based on team familiarity.

**Key routes:**
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
DELETE /api/auth/logout

POST   /api/accounts/connect            ← Initiate Instagram session capture
DELETE /api/accounts/:id/disconnect
GET    /api/accounts/:id/scan           ← Trigger ghost scan
GET    /api/accounts/:id/ghosts         ← Paginated ghost list
GET    /api/accounts/:id/stats          ← Follower/following/ratio stats

POST   /api/queue/start                 ← Start bulk unfollow queue
GET    /api/queue/status/:account_id    ← SSE stream
POST   /api/queue/pause
POST   /api/queue/cancel

GET    /api/credits/balance
POST   /api/credits/purchase

GET    /api/billing/subscription
POST   /api/billing/portal              ← Stripe Customer Portal session

POST   /api/webhooks/stripe             ← Stripe webhook (verify signature)
```

---

## Database

### Primary: PostgreSQL
**Version:** PostgreSQL 15+
**ORM:** Prisma (preferred) or Drizzle ORM
**Why:** Relational data model, strong typing with Prisma schema, mature migration tooling. Ghost scoring and tier queries benefit from relational structure.

**Schema (8 tables — see GHOAST-PRD.md Section 4.2 for full column definitions):**

```sql
users                   -- Ghoast user accounts
instagram_accounts      -- Connected Instagram accounts + encrypted session token
ghosts                  -- Non-followers discovered per Instagram account
unfollow_queue_jobs     -- Individual queue jobs (one per ghost to unfollow)
queue_sessions          -- A user-initiated queue run (groups N jobs)
account_snapshots       -- Daily ratio/follower/ghost snapshots (Pro/Pro+)
credit_transactions     -- Credit pack purchases + consumption events
subscriptions           -- Stripe subscription records
```

**Critical indexing:**
```sql
-- Most frequent query: get ghost list for an account, sorted by priority score
CREATE INDEX idx_ghosts_account_tier ON ghosts(instagram_account_id, tier, priority_score);

-- Queue worker: get pending jobs for an account
CREATE INDEX idx_queue_jobs_account_status ON unfollow_queue_jobs(instagram_account_id, status);

-- Daily cap check: count today's completed jobs
CREATE INDEX idx_queue_jobs_completed_at ON unfollow_queue_jobs(instagram_account_id, completed_at);
```

**Connection pooling:** PgBouncer or Prisma connection pool, max 20 connections in Phase 1.

---

## Queue

### Technology: BullMQ + Redis
**BullMQ version:** 4.x+
**Why BullMQ:** Built for Node.js, persistent (survives server restart), supports delayed jobs, concurrency control, retry with backoff, and job lifecycle events. The standard choice for this architecture.

**Queue configuration:**
```javascript
// config/queue.js — single source of truth for all timing values
module.exports = {
  DELAY_MIN_MS: 8_000,
  DELAY_MAX_MS: 45_000,
  SESSION_PAUSE_EVERY_N_JOBS: { min: 10, max: 15 },
  SESSION_PAUSE_DURATION_MS: { min: 180_000, max: 420_000 },
  RATE_LIMIT_PAUSE_MS: 900_000,       // 15 minutes
  REPEATED_RATE_LIMIT_PAUSE_MS: 86_400_000, // 24 hours
  RATE_LIMIT_THRESHOLD: 3,             // consecutive rate limits = 24h pause
  DAILY_CAP_PRO: 150,
  DAILY_CAP_PRO_PLUS: 150,
  DAILY_CAP_RESET: 'midnight UTC',
  MAX_RETRIES: 3,
};
```

**Worker architecture:**
```
unfollow-queue (BullMQ Queue)
  ├── 1 worker per instagram_account_id (not global)
  ├── concurrency: 1 (sequential, never parallel)
  ├── Each job = one unfollow action for one ghost
  └── Worker reads timing config from config/queue.js
```

**Redis usage:**
- BullMQ job storage and state
- Daily unfollow counter per account: key `daily_cap:{account_id}` with TTL to midnight UTC
- Real-time status pub/sub: Redis channel `queue_events:{account_id}` → SSE broadcast

---

## Authentication

### Ghoast User Auth: JWT
- Access token: 24-hour expiry — short-lived
- Refresh token: 30-day expiry — stored in httpOnly cookie (not localStorage)
- Token secret: `JWT_SECRET` and `JWT_REFRESH_SECRET` from environment variables
- On access token expiry: client uses refresh token to get a new access token silently
- On refresh token expiry: redirect to login

### Instagram Auth: Session Cookie Capture
- Embedded web view shows the Instagram login form
- On successful login, the web view intercepts the response cookies
- `sessionid` cookie value is extracted
- Passed to the backend, encrypted with AES-256-CBC, stored in `instagram_accounts.session_token_encrypted`
- No password is ever seen or stored by Ghoast

---

## Encryption

### Session Token: AES-256-CBC
```javascript
// lib/encryption.js
const crypto = require('crypto');
const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(process.env.SESSION_TOKEN_ENCRYPTION_KEY, 'hex'); // 32 bytes

function encrypt(plaintext) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
  };
}

function decrypt(ciphertext, iv) {
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
```

**Key generation (one-time, at setup):**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Store result in `SESSION_TOKEN_ENCRYPTION_KEY` environment variable. Never commit.

### User Passwords: bcrypt
```javascript
const bcrypt = require('bcrypt');
const COST_FACTOR = 12;
const hash = await bcrypt.hash(password, COST_FACTOR);
const valid = await bcrypt.compare(password, hash);
```

---

## Payments: Stripe

**SDK:** `stripe` npm package (official)
**Integration mode:** Stripe Checkout (hosted page) for subscriptions in Phase 1 — simplest to implement. Stripe Elements (embedded) as an upgrade in Phase 2 if needed.

**Products to create in Stripe Dashboard:**
```
Products:
├── Ghoast Pro         → price_pro_monthly ($9.99/month recurring)
├── Ghoast Pro+        → price_proplus_monthly ($24.99/month recurring)
├── Credits 100        → price_credits_100 ($2.99 one-time)
├── Credits 500        → price_credits_500 ($9.99 one-time)
└── Credits 1500       → price_credits_1500 ($19.99 one-time)
```

**Webhooks to handle:**
```
invoice.payment_succeeded       → Confirm Pro/Pro+ subscription is active
customer.subscription.deleted   → Downgrade user to Free tier
customer.subscription.updated   → Handle tier changes
payment_intent.succeeded        → Credit pack purchased → add credits to user
payment_intent.payment_failed   → Log failure, notify user
```

**Signature verification (every webhook):**
```javascript
const event = stripe.webhooks.constructEvent(
  rawBody,        // Must be raw buffer — not parsed JSON
  req.headers['stripe-signature'],
  process.env.STRIPE_WEBHOOK_SECRET
);
```

**Subscription management:** Stripe Customer Portal (hosted by Stripe — no custom billing UI needed in Phase 1)

---

## Email: Resend

**SDK:** `resend` npm package
**Why Resend:** Simple API, good deliverability, native React Email support for templating.

**Emails to build:**

| Email | Trigger | Template |
|-------|---------|---------|
| Email 1 — Ghost count reveal | Immediately after first scan | Dynamic: ghost count, tier breakdown, ratio |
| Email 2 — Activation nudge | 3 days after sign-up if no queue run | Ghost count reminder → upgrade CTA |
| Email 3 — Queue reveal | 7-10 days after sign-up | Feature showcase → Pro CTA |
| Queue pause notification | Queue pauses due to rate limit | Account safety message |
| Session expired | Instagram session token expires | Reconnect CTA |
| Payment failed | Stripe webhook | Billing update link |
| Subscription cancelled | Stripe webhook | Winback + data retention info |

**Alternative:** Loops.so — better for drip sequences and event-based automations. Either works.

---

## Analytics: PostHog

**SDK:** `posthog-node` (backend) + `posthog-js` (frontend)
**Self-hosted or cloud:** Cloud in Phase 1 for speed.

**Key events to capture:**

```javascript
// All events use this structure:
posthog.capture({
  distinctId: user.id,
  event: 'event_name',
  properties: { /* relevant properties */ }
});
```

| Event | Key Properties |
|-------|---------------|
| `account_connected` | `handle`, `following_count` |
| `scan_started` | `account_id` |
| `scan_completed` | `ghost_count`, `tier_1_count`, `tier_2_count`, `ratio` |
| `manual_unfollow_clicked` | `ghost_tier`, `ghost_score` |
| `daily_limit_reached` | `tier`, `ghosts_remaining` |
| `upgrade_prompt_shown` | `trigger_type`, `tier_1_count` |
| `upgrade_prompt_clicked` | `trigger_type`, `destination` |
| `queue_started` | `job_count`, `tier_breakdown` |
| `queue_completed` | `jobs_completed`, `jobs_failed`, `duration_ms` |
| `subscription_started` | `tier`, `source` (prompt trigger) |
| `credit_pack_purchased` | `pack_type`, `credits` |

---

## Error Tracking: Sentry

**SDK:** `@sentry/node` (backend) + `@sentry/nextjs` (frontend)

**Configuration:**
- Source maps uploaded on each build for readable stack traces
- Session token and user passwords must be scrubbed from Sentry events before they are sent — configure `beforeSend` to redact these fields
- Alert on: unhandled promise rejections, queue worker crashes, Instagram rate limit spikes

```javascript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  beforeSend(event) {
    // Scrub session tokens from any breadcrumb or extra data
    if (event.extra?.session_token_encrypted) delete event.extra.session_token_encrypted;
    return event;
  },
});
```

---

## Instagram Private API Client

**No official library exists for the private API.** Build a thin client in `lib/instagram.js`:

```javascript
// lib/instagram.js
const INSTAGRAM_BASE = 'https://i.instagram.com/api/v1';
const USER_AGENT = 'Instagram 269.0.0.18.75 Android'; // Match a real app version

async function instagramRequest(endpoint, sessionToken, options = {}) {
  const response = await fetch(`${INSTAGRAM_BASE}${endpoint}`, {
    headers: {
      'Cookie': `sessionid=${sessionToken}`,
      'User-Agent': USER_AGENT,
      'X-IG-App-ID': '936619743392459', // Instagram app ID
      ...options.headers,
    },
    ...options,
  });

  if (response.status === 429) throw new RateLimitError();
  if (response.status === 401) throw new SessionExpiredError();

  return response.json();
}

// Key methods:
// getFollowing(userId, sessionToken, maxId?)  → paginated following list
// getFollowers(userId, sessionToken, maxId?)  → paginated followers list
// unfollowUser(targetId, sessionToken)        → unfollow action
// getUserInfo(userId, sessionToken)           → account metadata for scoring
```

**Never log `sessionToken` in any error path.**

---

## Deployment (Phase 1 Recommendation)

| Service | Recommended Platform | Notes |
|---------|---------------------|-------|
| Next.js frontend | Vercel | Zero config, perfect Next.js integration |
| Node.js API | Railway or Render | Simple container deploy, managed PostgreSQL available |
| PostgreSQL | Railway managed DB or Supabase | Managed, backups included |
| Redis | Railway managed Redis or Upstash | Upstash works well for BullMQ |
| BullMQ workers | Same server as API (Phase 1) | Separate worker dyno in Phase 2 |
| File storage | Not needed in Phase 1 | CSV generated on-demand, not stored |

**Domain:** `ghoast.app` — SSL via Vercel/Railway automatically.

---

## Phase 1 Infrastructure Sizing

| Resource | Spec |
|----------|------|
| API server | 1 instance, 512MB-1GB RAM |
| PostgreSQL | Single instance, 10GB storage |
| Redis | 25MB (sufficient for queue + counters at 500 users) |
| Concurrent queues | Up to 50 simultaneous without degradation |
| Concurrent connected accounts | Up to 500 |

**Scale trigger:** Add horizontal API instances and a Redis Cluster when reaching 1,000+ active users.

---

## Environment Variables Reference

```env
# ── Application ──────────────────────────────────────────
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:3001

# ── Database ─────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/ghoast

# ── Redis ────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── Security ─────────────────────────────────────────────
SESSION_TOKEN_ENCRYPTION_KEY=   # 64-char hex (32 bytes) — generate with crypto.randomBytes(32).toString('hex')
JWT_SECRET=                     # 64+ random chars
JWT_REFRESH_SECRET=             # 64+ random chars (different from JWT_SECRET)

# ── Stripe ───────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PROPLUS_MONTHLY=price_...
STRIPE_PRICE_CREDITS_100=price_...
STRIPE_PRICE_CREDITS_500=price_...
STRIPE_PRICE_CREDITS_1500=price_...

# ── Email ────────────────────────────────────────────────
RESEND_API_KEY=re_...

# ── Analytics ────────────────────────────────────────────
POSTHOG_API_KEY=phc_...
POSTHOG_HOST=https://app.posthog.com

# ── Error Tracking ───────────────────────────────────────
SENTRY_DSN=https://...@sentry.io/...
```

---

## Mobile App

### Framework: React Native + Expo (Managed Workflow)

**Why React Native:** Shares React component patterns with the existing Next.js frontend. No new language. Full access to native APIs (Keychain, WebView, push notifications). Large ecosystem.

**Why Expo specifically:**
- Managed workflow — no raw Xcode or Android Studio required
- EAS Build (Expo Application Services) compiles `.ipa` (iOS) and `.aab` (Android) in the cloud
- `expo-secure-store` handles iOS Keychain and Android Keystore for JWT refresh tokens
- Expo Updates (OTA) pushes JS-only changes without App Store review cycle
- Expo Router — file-based routing, same pattern as Next.js App Router

**Version:** Expo SDK 51+ (latest stable)

**Mobile app structure:**
```
apps/mobile/
├── app/                     ← Expo Router (file-based)
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (app)/
│   │   ├── _layout.tsx      ← Bottom tab navigator
│   │   ├── index.tsx        ← Dashboard / Overview
│   │   ├── ghost-list.tsx   ← Ranked ghost list
│   │   ├── queue.tsx        ← Queue status + start
│   │   └── settings.tsx     ← Account + billing
│   └── connect.tsx          ← Instagram WebView login
├── components/
├── lib/
│   ├── api.ts               ← Typed API client (fetch wrapper)
│   ├── auth.ts              ← Token management (SecureStore)
│   └── notifications.ts     ← OneSignal push setup
└── app.config.ts            ← Expo config (bundle ID, permissions)
```

**Navigation pattern:** Bottom tab bar (not sidebar) — standard mobile UX.

**Key Expo packages:**
```json
{
  "expo": "~51.0.0",
  "expo-router": "~3.0.0",
  "expo-secure-store": "~13.0.0",
  "expo-web-browser": "~13.0.0",
  "expo-notifications": "~0.28.0",
  "react-native-webview": "^13.0.0",
  "onesignal-expo-plugin": "^2.0.0"
}
```

---

## Mobile Authentication

### The Problem with httpOnly Cookies on Native
The web app stores the JWT refresh token in an httpOnly cookie. Native mobile apps do not automatically handle cookie jars — React Native's `fetch` does not persist cookies between requests.

### Solution: Platform-Aware Token Storage

**Web (unchanged):** Refresh token in httpOnly cookie. Access token in memory.

**Native mobile:** Both tokens returned in response body. Stored in device secure storage.
```typescript
// Web → cookie (handled by browser)
// Mobile → SecureStore
import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'ghoast_refresh_token';
await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
const token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
```

**API change required:** Auth endpoints must accept a `platform` header:
```
platform: web   → set httpOnly cookie, omit token from response body
platform: mobile → return { accessToken, refreshToken } in body, set no cookie
```

**Never use `AsyncStorage` for tokens** — it is unencrypted and readable by other apps. SecureStore only.

---

## Push Notifications

### Service: OneSignal
**Why OneSignal:** Single SDK handles both Apple APNs (iOS) and Firebase FCM (Android). Simple REST API for server-side sends. Free tier is sufficient for Phase 1.

**Alternatives:** Firebase Notifications (more config), AWS SNS (overkill for Phase 1).

**Setup:**
1. Create OneSignal app → get `ONESIGNAL_APP_ID`
2. Configure APNs certificate (Apple Developer account required)
3. Configure FCM server key (Firebase project required)
4. Install `onesignal-expo-plugin` in mobile app

**Server-side send (from BullMQ worker events):**
```typescript
// lib/notifications.ts (server-side)
import OneSignal from '@onesignal/node-onesignal';

const client = new OneSignal.DefaultApi(
  OneSignal.createConfiguration({ appKey: process.env.ONESIGNAL_API_KEY })
);

async function sendPush(userId: string, notification: {
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  await client.createNotification({
    app_id: process.env.ONESIGNAL_APP_ID!,
    filters: [{ field: 'tag', key: 'user_id', relation: '=', value: userId }],
    headings: { en: notification.title },
    contents: { en: notification.body },
    data: notification.data,
  });
}
```

**Notification events to send:**

| Event | Title | Body |
|-------|-------|------|
| Queue completed | "All done. 👻" | "Removed {N} ghosts. Your ratio is now {R}." |
| Queue paused (rate limit) | "Queue paused" | "Instagram rate limit hit. Resuming in 15 min." |
| Session expired | "Reconnect needed" | "Your Instagram session expired. Tap to reconnect." |
| Ratio milestone | "Ratio milestone! 🎉" | "Your ratio just passed {milestone}." |

**New environment variables:**
```env
ONESIGNAL_APP_ID=
ONESIGNAL_API_KEY=
```

---

## API Versioning

**All routes must be versioned from day one.** Prefix: `/api/v1/`

**Why this is non-negotiable for mobile:**
Mobile apps cannot be force-updated. App Store review takes 24-72 hours. If you ship an API change that breaks a response shape, a user on an old app version is broken for days. Versioning lets you run v1 and v2 simultaneously.

**Updated routes (all existing routes + /v1/):**
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
DELETE /api/v1/auth/logout

POST   /api/v1/accounts/connect
DELETE /api/v1/accounts/:id/disconnect
POST   /api/v1/accounts/:id/scan
GET    /api/v1/accounts/:id/scan/stream
GET    /api/v1/accounts/:id/ghosts
GET    /api/v1/accounts/:id/stats
GET    /api/v1/accounts/:id/snapshots
GET    /api/v1/accounts/:id/ghosts/export

POST   /api/v1/ghosts/:id/unfollow
POST   /api/v1/ghosts/:id/whitelist
DELETE /api/v1/ghosts/:id/whitelist

POST   /api/v1/queue/start
GET    /api/v1/queue/status/:account_id
POST   /api/v1/queue/pause
POST   /api/v1/queue/cancel

GET    /api/v1/credits/balance
POST   /api/v1/credits/purchase

GET    /api/v1/billing/subscription
POST   /api/v1/billing/portal

POST   /api/v1/webhooks/stripe
POST   /api/v1/notifications/register   ← New: register device push token
```

**Versioning strategy:** When breaking changes are required for v2:
- Deploy `/api/v2/` routes alongside `/api/v1/`
- Keep v1 routes running for minimum 6 months (mobile users on old app versions)
- Add `Deprecation` response header to v1 routes to signal clients to upgrade

---

## Payment Strategy for Mobile (Web-Only Checkout)

**This is a firm architectural decision. Do not revisit without explicit approval.**

### The Rule
All purchases (Pro subscription, Pro+ subscription, credit packs) happen exclusively at **ghoast.app** (web). The native mobile app (iOS and Android) has **no payment flow whatsoever**.

### Why
Apple App Store and Google Play require that all digital goods purchased inside a native app go through their respective billing systems (Apple IAP / Google Play Billing), taking 15-30% of revenue. This rule applies only to purchases made **inside** the native app. Purchases made on a website (even on mobile browser) are exempt.

**Precedent:** Spotify, Netflix, Kindle, Patreon — all direct users to the web for payment.

### How it works in the app
```
User wants to upgrade:
  ↓
App shows upgrade prompt (no price, no checkout)
  ↓
Button: "Manage Subscription at ghoast.app"
  ↓
Opens ghoast.app/billing in external browser (expo-web-browser)
  ↓
User purchases on web (Stripe Checkout)
  ↓
Webhook activates Pro tier on their account
  ↓
App polls GET /api/v1/billing/subscription → sees Pro tier
  ↓
UI unlocks Pro features
```

### UI Rules for Store Compliance
- Do NOT show prices inside the native app
- Do NOT show a "Buy" or "Upgrade" button that initiates a payment inside the app
- Show: "To unlock Pro, visit ghoast.app" or use `expo-web-browser` to open billing page
- Do NOT mention Stripe inside the app

---

## Deep Linking

Required for post-auth redirects, email links, and marketing links that open the native app.

### iOS — Universal Links
```json
// ghoast.app/.well-known/apple-app-site-association
{
  "applinks": {
    "apps": [],
    "details": [{
      "appID": "TEAMID.app.ghoast",
      "paths": ["/connect/*", "/dashboard/*", "/auth/*"]
    }]
  }
}
```

### Android — App Links
```json
// ghoast.app/.well-known/assetlinks.json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "app.ghoast",
    "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
  }
}]
```

### Deep link scheme for development (before Universal Links configured)
```
ghoast://connect          ← Post Instagram auth redirect
ghoast://dashboard        ← Queue complete notification
ghoast://settings/billing ← Session expired notification
```

Expo Router handles all deep linking natively — no manual setup needed in JS code.

---

## Shared Design Tokens

The design system (colors, typography, spacing) must work across both web (CSS) and native (React Native StyleSheet). Shared via `packages/design-tokens/`.

```typescript
// packages/design-tokens/src/index.ts
export const colors = {
  black:    '#080810',
  slate:    '#111120',
  slate2:   '#181830',
  specter:  '#1A1A3A',
  violet:   '#7B4FFF',
  violetLo: 'rgba(123,79,255,0.14)',
  violetMid:'rgba(123,79,255,0.35)',
  cyan:     '#00E5FF',
  cyanLo:   'rgba(0,229,255,0.1)',
  red:      '#FF3E3E',
  green:    '#00E676',
  ghost:    '#E8E8FF',
  muted:    '#7070A0',
} as const;

export const tiers = {
  1: { label: 'Safe to Cut',    color: '#FF3E3E' },
  2: { label: 'Probably Cut',   color: '#FF7A3E' },
  3: { label: 'Your Call',      color: '#FFD166' },
  4: { label: 'Might Keep',     color: '#7B4FFF' },
  5: { label: 'Keep Following', color: '#00E676' },
} as const;

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48
} as const;
```

**Web usage:** Import tokens into CSS custom properties via a build step.
**Native usage:** Import directly into `StyleSheet.create({ ... })`.

---

## Package Dependencies (Key Packages)

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "fastify": "^4.0.0",
    "bullmq": "^4.0.0",
    "ioredis": "^5.0.0",
    "@prisma/client": "^5.0.0",
    "bcrypt": "^5.0.0",
    "jsonwebtoken": "^9.0.0",
    "stripe": "^14.0.0",
    "resend": "^2.0.0",
    "posthog-node": "^3.0.0",
    "@sentry/node": "^7.0.0",
    "@sentry/nextjs": "^7.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/bcrypt": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.0"
  }
}
```
