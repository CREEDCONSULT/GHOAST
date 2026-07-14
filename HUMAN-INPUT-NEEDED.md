# Human Input Needed — Ghoast Go-Live Checklist

## ✅ Build status (2026-07-13)

The compliant rebuild is **code-complete and verified locally**. All CI gates pass:
typecheck ✅ · lint ✅ · unit tests (api 80, web 39) ✅ · production build ✅ · runtime smoke ✅.

What works end-to-end in code: register/login → upload Instagram data export → parse →
compute + score ghosts → dashboard with tiers → guided manual cleanup (deep links + mark done)
→ follower/ratio snapshots. No Instagram credentials touched anywhere.

**Known follow-up (not blocking deploy):** the `apps/api/tests/integration/*` suite still targets
the old `/connect` and auto-unfollow endpoints and needs rewriting for the import + mark-cleanup
flow. These require a live Postgres + Redis and are **not** in the CI gate (`test:unit` only), so
they don't block the build or deployment — but they should be refreshed before relying on them.

Everything below is what only **you** can provide to run this in production.

---



This is the running log of things **only you (Dante)** can provide. I build everything else
and stop for these. Nothing here blocks the code being complete and testable locally — these
are required to run it in production with real payments/email.

Legend: 🔴 required to go live · 🟡 recommended · 🟢 optional / later

---

## 1. Hosting & infrastructure
- 🔴 **PostgreSQL database** (production). Railway/Neon/Supabase all fine. → provides `DATABASE_URL`
- 🔴 **Redis** instance (used for background jobs / rate limiting). Railway/Upstash. → `REDIS_URL`
- 🔴 **Where to host** the web (Next.js) + api (Fastify). Existing repo has Railway config.
  Confirm you want Railway, or say Vercel (web) + Railway/Fly (api).
- 🔴 **Domain**: confirm `ghoast.app` is registered and you can set DNS records.

## 2. Secrets to generate (I can generate these for you on request; you store them)
- 🔴 `JWT_SECRET`, `JWT_REFRESH_SECRET` — random 32+ byte strings
- 🟡 `SESSION_TOKEN_ENCRYPTION_KEY` — no longer used for Instagram sessions after the rebuild;
  keep only if we encrypt anything else at rest. Will mark N/A if unused.

## 3. Payments — Stripe (needed for revenue)
- 🔴 Stripe account + `STRIPE_SECRET_KEY`
- 🔴 `STRIPE_WEBHOOK_SECRET` (from the webhook endpoint you create)
- 🔴 Create products/prices in Stripe and give me the price IDs:
  - `STRIPE_PRICE_PRO_MONTHLY` ($9.99/mo)
  - `STRIPE_PRICE_PROPLUS_MONTHLY` ($24.99/mo)
  - `STRIPE_PRICE_CREDITS_100` ($2.99), `STRIPE_PRICE_CREDITS_500` ($9.99), `STRIPE_PRICE_CREDITS_1500` ($19.99)
  - NOTE: pricing/packaging may be revisited for the compliant product — see Q at bottom.

## 4. Email (transactional — signup, receipts)
- 🟡 Resend **or** Loops account → `RESEND_API_KEY` or `LOOPS_API_KEY`
- 🟡 Verify sending domain (DNS records) for deliverability

## 5. Analytics & error tracking
- 🟢 PostHog project → `POSTHOG_API_KEY` (a CREED CONSULT PostHog project already exists in this session)
- 🟢 Sentry project → `SENTRY_DSN`

## 6. Push notifications (mobile, later)
- 🟢 OneSignal → `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY` (only when the mobile app ships)

## 7. Legal (compliant product needs accurate copy)
- 🟡 Confirm business entity name + support email for Terms/Privacy pages.
- 🟡 Confirm we can state: "Ghoast analyzes your own Instagram data export. We do not access,
  automate, or store your Instagram login." (This is now true and is a selling point.)

---

## Open product questions for you (non-blocking; I'll pick sensible defaults if you don't answer)

1. **Pricing model fit.** The compliant product's value is analysis + tracking + guided
   cleanup rather than one-shot bulk auto-unfollow. A subscription (ongoing tracking, monthly
   re-scan reminders, trend history) fits better than one-time "credits per unfollow." My
   default: keep Free / Pro $9.99 / Pro+ $24.99 as subscriptions; drop or repurpose credit
   packs. Tell me if you disagree.
2. **Free tier limit.** Default: Free shows your ghost count + tier breakdown but blurs the
   full list; Pro unlocks the full list, guided cleanup, and tracking history.
