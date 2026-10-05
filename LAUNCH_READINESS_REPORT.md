# GHOAST — Launch Readiness Report

**Date:** 2026-10-05 · **Verdict: READY WITH CONDITIONS** (2 founder-credential conditions; zero code blockers)

---

## 1. Architecture status ✅

Single Next.js 16 PWA (`apps/web`), 100% client-side export processing, Dexie/IndexedDB persistence, first-party API routes only for billing (Stripe) and opt-in analytics relay. Legacy credential/scraping/automation backend fully removed (see ENGINEERING-LOG §1.2, §3). Hard invariants hold — verified by test, not by promise.

## 2. Parser compatibility ✅ (with one fixed landmine)

Three genuine 2026 Instagram DYI exports (incl. a 911 MB full export and a 3,104-following account) parse correctly. **Found & fixed:** real `following.json` carries the username in `title`, not `string_list_data[].value` — the original adapter would have failed every real upload. Matrix: `docs/production/REAL_EXPORT_COMPATIBILITY.md`. Automated regression suite (+6 tests) guards both shapes.

## 3. Real-export confidence: **HIGH**

Real samples: supported, timed, verified end-to-end in unit tests (runs on dev machines where exports are present; CI uses structure-identical synthetic fixtures). Quarterly re-verification advised (Meta drift risk is the product's main operational exposure).

## 4. Security / privacy status ✅

`docs/production/SECURITY_PRIVACY_AUDIT.md`. Highlights:
- Zero-exfiltration proven in e2e (canary scan across the whole journey).
- CSP `connect-src 'self'` enforced and asserted per-route; no third-party scripts; no service worker (deliberate).
- XSS attempted through malicious usernames/hrefs — neutralized (tested).
- Delete-everything leaves zero IndexedDB rows (tested).
- `npm audit --omit=dev`: **0 vulnerabilities**. 33 dev-only advisories (jest toolchain) documented, no runtime exposure.
- **Fixed during audit:** white-on-spectral buttons failed WCAG AA (4.23:1) → now spectral-700 (~6.9:1); `--text-3` on ink-1 failed → brightened; `<dl>` semantics repaired; progressbar named.

## 5. Billing state ⚠️ CONDITION 1

Integration boundary complete and honest: `/api/billing/{checkout,verify,status,webhook}`, entitlement granted only on verified Stripe payment, restore/recheck implemented, no fake paid state anywhere (dev-only simulator compiled out in production). **Blocked on founder Stripe account + keys + webhook setup** — exact steps in `docs/production/BILLING_ENTITLEMENT.md` (~30 min of founder time, test-mode first). Until then the paywall truthfully says checkout isn't available.

## 6. Deployment state ⚠️ CONDITION 2

Production build passes; prod-server smoke (CSP headers, manifest, billing status) verified locally. Runbook: `docs/production/DEPLOYMENT_RUNBOOK.md` (Vercel path, env matrix, smoke checklist, rollback). **Needs founder hosting account + domain + `vercel link`/env entry.** No deployment was performed or attempted without authorization.

## 7. Analytics state ✅ (opt-in, dormant)

`docs/production/ANALYTICS_SCHEMA.md`: 13 whitelisted funnel events, server-side whitelist enforcement, off by default, inert without PostHog keys. Privacy policy copy updated to describe it accurately.

## 8. Accessibility status ✅

axe-core WCAG 2.1 A/AA across all 17 routes (public + authenticated app), zero critical/serious violations post-fix. Keyboard-operable deck (arrows + K/Q/L/S/U/G), 44px touch targets verified on mobile viewport, focus management in sheets, live-region toasts, reduced-motion honored, light/dark themes AA-checked.

## 9. Test results (this phase, all green)

| Suite | Result |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npm run test:unit` | ✅ 25/25 (incl. 3 real exports, XSS sanitization, reconciliation, zero-export validity) |
| `npm run test:e2e` | ✅ 66/66 (33 tests × desktop+mobile): journeys, duplicate/HTML-refusal, privacy exfiltration, CSP headers, XSS, deletion, analytics relay, axe a11y, keyboard deck, touch targets |
| `npm run build` + prod start smoke | ✅ |

## 10. Unresolved blockers (founder actions)

1. **Stripe account keys + products + webhook** (test then live) — BILLING_ENTITLEMENT.md.
2. **Host + domain deploy** — DEPLOYMENT_RUNBOOK.md.
3. Optional: PostHog keys if analytics wanted on day 1 (product works fully without).

## 11. Top 5 risks

1. **Meta export-format drift** — mitigated by adapter versioning + real-export regression harness; largest ongoing operational exposure.
2. **Billing unconfigured at first-user test** — either founder completes Condition 1 first, or validation runs with paywall in "coming soon" truth state (acceptable for gate-6 measurement at reduced signal).
3. **Device-local-only data loss** (user clears storage / loses device → lose history & kept lists) — inherent to the no-account privacy architecture; v1.1 sync is the roadmap answer.
4. **Instagram action friction** — users must unfollow manually in-app; session completion depends on pacing education. Watch gate 5.
5. **Single 44→40px `btn-sm` target floor** on dense rows meets WCAG 2.2 AA (≥24px) but not spec's 44px aspiration everywhere — cosmetic-hardness tradeoff, listed honestly.

## 12. Top 5 next actions

1. Founder: Stripe test-mode setup → verify one end-to-end purchase (4242 card) → go live keys.
2. Founder: deploy preview per runbook → run the 6-step smoke checklist → promote.
3. Recruit 20–50 users → run FIRST_USER_VALIDATION_PLAN.md → gate review.
4. Build the "weird export" opt-in sampling (allowed-event extension) so format drift is detected in production, not by complaint.
5. After gate review: v1.1 sync/accounts decision (only decisions/aggregates, never archives).

## Launch recommendation

**READY WITH CONDITIONS.** The product is coherent, privacy-true, tested at unit/integration/e2e/a11y/security levels, and validated against real exports. The two conditions are founder credential/deploy actions (≈1 hour combined), not engineering. With those done and the first-user plan executed, no technical reason blocks a soft launch.
