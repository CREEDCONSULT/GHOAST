# Ghoast

Instagram follower intelligence tool. Scans your following list, identifies every account that doesn't follow you back ("ghosts"), scores and ranks them across five dimensions, and bulk-unfollows them via a background queue engine with built-in rate-limit protection.

**Web:** `ghoast.app` | **Stack:** Next.js + Fastify + PostgreSQL + Redis + BullMQ + React Native

---

## Documentation

| File | Purpose |
|------|---------|
| [CLAUDE.md](CLAUDE.md) | AI assistant rules, vocabulary enforcement, architecture constraints |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Feature specs F001–F013 with testable acceptance criteria |
| [TECH-STACK.md](TECH-STACK.md) | All technology decisions, config code, environment variables |
| [DESIGN-NOTES.md](DESIGN-NOTES.md) | Brand system, CSS variables, component design |
| [GHOAST-PRD.md](GHOAST-PRD.md) | Full 9-section product requirements document |
| [MASTER-BUILD-PROMPT.md](MASTER-BUILD-PROMPT.md) | 12-phase build prompt (Phases 0–10 web, 11–12 mobile + store) |
| [MOBILE-ARCHITECTURE.md](MOBILE-ARCHITECTURE.md) | React Native + Expo screen map, auth strategy, EAS build config |
| [PLATFORM-COMPLIANCE.md](PLATFORM-COMPLIANCE.md) | App Store + Play Store submission guide, privacy labels, compliance |

---

## Project Structure

```
ghoast/
├── apps/
│   ├── web/              Next.js 14 (App Router) — frontend dashboard + landing page
│   ├── api/              Node.js + Fastify — REST API (/api/v1/), BullMQ workers
│   └── mobile/           React Native + Expo — iOS + Android app
├── packages/
│   ├── db/               Prisma schema + migrations (shared)
│   └── design-tokens/    Shared color/tier/spacing tokens (web + mobile)
├── CLAUDE.md
├── REQUIREMENTS.md
├── TECH-STACK.md
├── DESIGN-NOTES.md
├── GHOAST-PRD.md
├── MASTER-BUILD-PROMPT.md
├── MOBILE-ARCHITECTURE.md
├── PLATFORM-COMPLIANCE.md
├── .env.example
└── .gitignore
```

---

## Prerequisites

| Dependency | Minimum Version | Notes |
|-----------|----------------|-------|
| Node.js | 20.x LTS | Required for all apps |
| PostgreSQL | 15+ | Primary database |
| Redis | 7+ | Queue + rate limiting |
| npm | 10+ | Package management (workspaces) |

For mobile development:
| Dependency | Notes |
|-----------|-------|
| Expo CLI | `npm install -g expo-cli` |
| EAS CLI | `npm install -g eas-cli` |
| Expo Go app | Install on your iOS/Android device for dev testing |

---

## Environment Setup

Copy the template and fill in your values:

```bash
cp .env.example .env
```

Required variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ghoast

# Redis
REDIS_URL=redis://localhost:6379

# Encryption — generate with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_TOKEN_ENCRYPTION_KEY=

# Auth
JWT_SECRET=
JWT_REFRESH_SECRET=

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PROPLUS_MONTHLY=price_...
STRIPE_PRICE_CREDITS_100=price_...
STRIPE_PRICE_CREDITS_500=price_...
STRIPE_PRICE_CREDITS_1500=price_...

# Email
RESEND_API_KEY=re_...

# Analytics
POSTHOG_API_KEY=phc_...

# Error tracking
SENTRY_DSN=https://...@sentry.io/...

# Push notifications
ONESIGNAL_APP_ID=
ONESIGNAL_API_KEY=
```

For mobile only (`apps/mobile/.env`):
```env
EXPO_PUBLIC_API_URL=https://api.ghoast.app
EXPO_PUBLIC_ONESIGNAL_APP_ID=
```

**Never commit `.env` files.** They are excluded in `.gitignore`.

---

## Installation

```bash
# Install all workspace dependencies
npm install

# Run database migrations
npm run db:migrate

# (Optional) Seed development data
npm run db:seed
```

---

## Running in Development

```bash
# Start everything (web + api + queue worker)
npm run dev

# Or start individual services:
npm run dev:web       # Next.js on http://localhost:3000
npm run dev:api       # Fastify API on http://localhost:3001
npm run dev:worker    # BullMQ queue worker
npm run dev:mobile    # Expo dev server (scan QR with Expo Go)
```

---

## Running Tests

```bash
npm test                # All tests
npm run test:unit       # Unit tests only
npm run test:e2e        # Playwright end-to-end
npm run test:coverage   # With coverage report (target: ≥80% on service files)
```

Tests must be green before any commit. Never use `--no-verify`.

---

## Database Commands

```bash
npm run db:migrate      # Run pending migrations (dev)
npm run db:seed         # Seed development data
npm run db:studio       # Open Prisma Studio (GUI)
```

---

## Queue Commands

```bash
npm run queue:inspect   # Show active/waiting/failed BullMQ jobs
npm run queue:clear     # Clear all jobs (dev only — never in production)
```

---

## Mobile Build Commands

```bash
# Development builds
eas build --platform ios --profile preview      # TestFlight build
eas build --platform android --profile preview  # APK for testing

# Production builds (for store submission)
eas build --platform all --profile production

# Store submission
eas submit --platform ios       # Submit to App Store Connect
eas submit --platform android   # Submit to Google Play

# OTA update (JS-only — no store review needed)
eas update --branch production --message "fix: ..."
```

---

## Build

```bash
npm run build          # Build all packages for production
npm run typecheck      # TypeScript check (must exit 0 before release)
npm run lint           # ESLint (must exit 0 before release)
```

---

## Key Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Instagram auth | Private API / session cookie | Official API unavailable for this use case |
| Session token storage | AES-256-CBC encrypted in PostgreSQL | Security — plaintext never persists |
| Queue | BullMQ + Redis | Server-side background processing, survives browser close |
| Mobile framework | React Native + Expo | Shares React patterns with Next.js, fastest path to store |
| Mobile token storage | expo-secure-store | iOS Keychain / Android Keystore — never AsyncStorage |
| Mobile payments | Web-only (Netflix model) | Avoids Apple 30% / Google 15% IAP commission |
| Push notifications | OneSignal | Unified FCM (Android) + APNs (iOS) in one SDK |
| API versioning | /api/v1/ prefix on all routes | Mobile apps can't be force-updated — required from day one |

---

## Pricing

| Tier | Price | Key Features |
|------|-------|-------------|
| Free | $0 | Full ghost scan, 10 manual unfollows/day |
| Pro | $9.99/month | 150 unfollows/day, background queue, snapshots, CSV export |
| Pro+ | $24.99/month | 3 Instagram accounts, whitelist rules, ghost follower detector |
| Credits 100 | $2.99 one-time | 100 unfollow actions (for Free users) |
| Credits 500 | $9.99 one-time | 500 unfollow actions |
| Credits 1,500 | $19.99 one-time | 1,500 unfollow actions |

All purchases are made at `ghoast.app/billing`. There are no in-app purchases inside the native mobile apps.

---

## Ghost Tier System

| Tier | Score | Label | Color |
|------|-------|-------|-------|
| 1 | 0–20 | Safe to Cut | `#FF3E3E` |
| 2 | 21–40 | Probably Cut | `#FF7A3E` |
| 3 | 41–60 | Your Call | `#FFD166` |
| 4 | 61–80 | Might Keep | `#7B4FFF` |
| 5 | 81–100 | Keep Following | `#00E676` |

Tier 5 is auto-protected — never added to queue, never pre-selected, checkbox disabled in UI.

---

## Security

- Instagram session tokens: AES-256-CBC encrypted at rest, never logged
- User passwords: bcrypt cost factor ≥ 12
- All traffic: HTTPS / TLS 1.2+
- Auth: JWT (24h) + refresh token (httpOnly cookie on web, SecureStore on mobile)
- SQL: parameterised queries only — no raw SQL with user input
- Stripe webhooks: signature verified on every request
- API rate limiting: 100 req/min per IP, 500 req/hr per authenticated user

---

## Contributing

1. Branch from `dev`: `git checkout -b feature/your-feature dev`
2. Write tests before or alongside the feature
3. Ensure `npm test` passes before committing
4. Use Conventional Commits: `feat(scope): description`
5. Never commit to `main` directly — PRs only

---

## Support

- Issues: GitHub Issues on this repository
- App support: `ghoast.app/support`
