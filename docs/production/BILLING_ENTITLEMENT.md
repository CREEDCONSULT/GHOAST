# GHOAST+ Billing & Entitlement — Integration Doc

**Date:** 2026-10-05 · **Status:** integration boundary complete, code-tested; awaiting founder Stripe credentials.

## What is paid (and only this)

- Scan **comparisons** and **history** (`/history`, `/history/[runId]` gating is implemented and live).
- Everything else is free forever: full scan, all lists, triage, cleanup queue, protected/saved, deletion controls. Nothing already received is ever revoked.

## How it works (no fake paid state)

| Piece | Where | Behavior |
|---|---|---|
| Checkout creation | `POST /api/billing/checkout` (Next.js route, server) | Creates a Stripe Checkout Session for `STRIPE_PRICE_PLUS_MONTHLY` (default) or `STRIPE_PRICE_PLUS_ANNUAL`; success → `/settings/plus?session_id=cs_…`, cancel → `/pricing?canceled=1` |
| Entitlement grant | `GET /api/billing/verify?session_id=cs_…` → client `verifyAndGrant()` | Grants `plan: 'plus'` **only** when Stripe reports `status=complete` + `payment_status=paid` + subscription active/trialing. Stores the session id locally for rechecks. |
| Restore / recheck | Settings → Plan → "Recheck membership" → `recheckEntitlement()` | Re-verifies the stored session id with Stripe; revokes local entitlement on negative verify. |
| Webhook | `POST /api/billing/webhook` | Signature-verified; logs lifecycle events for observability (127.0.0.1 Stripe CLI forwarding supported). Cancellation enforcement is recheck-based (device-local entitlement by design — no user accounts exist to revoke server-side). |
| Unconfigured Stripe env | all routes → `503 {configured:false}` | UI shows "Checkout isn't available in this build yet — we don't unlock for free." |

**Privacy boundary:** the only values that ever travel to GHOAST's own server are a Stripe session id and `{configured, entitled}` booleans. Archive bytes, usernames, and the relationship graph never leave the device — enforced additionally by `connect-src 'self'` CSP (analytics, if ever enabled, goes through the same first-party boundary; see ANALYTICS_SCHEMA.md).

## Founder actions required (exact)

1. Create/choose a Stripe account (test mode first).
2. Create product **GHOAST+** with two prices: **$4.99/month** and **$29.99/year** (USD). Copy both `price_…` ids.
3. Set environment variables on the deployment (Vercel → Project → Environment Variables):
   - `STRIPE_SECRET_KEY=sk_test_…`
   - `STRIPE_PRICE_PLUS_MONTHLY=price_…`
   - `STRIPE_PRICE_PLUS_ANNUAL=price_…`
   - `STRIPE_WEBHOOK_SECRET=whsec_…` (after step 5)
   - `NEXT_PUBLIC_APP_URL=https://<your-domain>`
4. Create `.env.local` for local test-mode development with the same keys (never commit; `.gitignore` excludes it).
5. Stripe Dashboard → Developers → Webhooks → add endpoint `https://<your-domain>/api/billing/webhook`, events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
6. Verify in **test mode**: run e2e/manual checkout with card `4242 4242 4242 4242` → confirm `/settings/plus` grants plus → confirm `/history` unlocks → Settings "Recheck membership" returns active.
7. Go live: repeat with live keys + prices; re-run step 6 with a real charge then refund.

## Failure/cancel handling (implemented)

- Cancel on Stripe checkout → returns to `/pricing?canceled=1` (no state change).
- Failed/unpaid verify → `/settings/plus` shows "Payment not confirmed", nothing granted.
- Dev-only "Simulate GHOAST+" button exists **only** in `NODE_ENV=development` and is labeled as such — it is compiled out of production builds.

## Not implemented (deliberately)

- Stripe Customer Portal link (needs no backend changes — founder can add the portal URL in Stripe dashboard and we can link it later; deferred, low value at 20–50 users).
- Cross-device restore requires accounts/sync (post-MVP per spec §25).
