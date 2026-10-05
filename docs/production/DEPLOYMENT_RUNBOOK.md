# GHOAST — Deployment Runbook

**Date:** 2026-10-05 · **Target:** any Next.js-compatible host (Vercel recommended — zero-config for Next 16 App Router + API routes).

## Prerequisites (founder)

- Hosting account + domain (e.g. ghoast.app) pointed at the host.
- Stripe keys if billing is to be active (see BILLING_ENTITLEMENT.md §founder actions).
- Optional PostHog keys (analytics remain inert without them).

## Build & verify locally

```bash
npm install
npm run verify      # typecheck + lint + unit tests + production build
npm run test:e2e    # full journey, privacy, security, a11y (starts prod-ish dev server or set APP_URL)
```

## Deploy (Vercel path)

```bash
npx vercel link        # founder's account
npx vercel env add STRIPE_SECRET_KEY            # skim/secret entry per env (Preview/Production)
npx vercel env add STRIPE_PRICE_PLUS_MONTHLY
npx vercel env add STRIPE_PRICE_PLUS_ANNUAL
npx vercel env add STRIPE_WEBHOOK_SECRET
npx vercel env add NEXT_PUBLIC_APP_URL          # https://ghoast.app
# optional: npx vercel env add POSTHOG_API_KEY
npx vercel deploy --preprod    # preview first
npx vercel promote <url>       # promote after smoke checks
```

No build settings needed beyond defaults (root: repo root; the app lives in `apps/web` — set **Root Directory = `apps/web`** in the Vercel project, or deploy from that directory).

## Post-deploy smoke checklist (run against the preview URL, ~5 min)

1. `curl -sI https://<host>/` → expect `content-security-policy` with `connect-src 'self'`, `frame-ancestors 'none'`, `referrer-policy: no-referrer`, `x-content-type-options: nosniff`.
2. `GET /manifest.webmanifest` → 200, JSON.
3. `GET /api/billing/status` → `{"configured":false}` without Stripe env, `true` with.
4. DevTools network tab: upload a real `instagram-*.zip`; assert **zero third-party requests** occur during processing.
5. Full journey on mobile viewport (360×640) and desktop (1440×900): onboarding → guide → upload → board → review → queue → history gate.
6. Settings → Data → Delete everything → returns to /start; IndexedDB empty.

## Environment separation

| Env | Stripe | PostHog | Notes |
|---|---|---|---|
| Local dev | `sk_test_*` (optional) | unset (no-op relay) | dev-only "Simulate GHOAST+" compiled in |
| Preview | `sk_test_*` | optional | full billing flow testable with 4242 card |
| Production | `sk_live_*` | live key | simulate path compiled out (`NODE_ENV=production`) |

## PWA note (deliberate decision)

A manifest + icon ship (`/manifest.webmanifest`, installable). **No service worker is registered**: processing is local so runtime works offline after first load, and a caching worker adds a cross-user persistence surface for a privacy product. If true cold-start offline becomes a requirement, add a minimal SW that caches ONLY static assets (never `no-store` pages, never IndexedDB-adjacent requests) — revisit in v1.1.

## Rollback

- Vercel: `Deployments → <previous> → Promote`. Stateless service; IndexedDB is user-side (no migration risk on rollback).
- Data compatibility: IndexedDB schema is versioned via Dexie (`db.version(1)`); bump + upgrade function on any future change. Rollback to an older schema version is safe (Dexie ignores newer stores it doesn't know; user data keyed by username survives).

## Repeatability

CI (`.github/workflows/ci.yml`) runs typecheck → lint → unit → build on every push. Add `npx playwright test --project=chromium` to CI once a runner budget exists (15 workers available on GH runners).
