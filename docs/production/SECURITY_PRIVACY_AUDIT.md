# GHOAST — Security & Privacy Audit

**Date:** 2026-10-05 · **Scope:** entire `apps/web` product (client PWA + 4 first-party API routes: billing ×3, analytics ×1). **Result: PASS** (findings fixed in-line; residue documented).

## What is technically verified by automated tests (CI-gated)

| Claim | Verification | Where |
|---|---|---|
| No archive bytes leave the device | During a full upload→analysis→review→activity journey, a network listener asserts **zero** requests whose URL or body contains canary usernames; zero requests to non-self origins | `tests/e2e/journey.spec.ts` (privacy assertion), `tests/e2e/security.spec.ts` |
| CSP enforces it | `connect-src 'self'`, `default-src 'self'`, `img-src 'self' data:`, `frame-ancestors 'none'`, no-store of secrets n/a (no cookies set), `Referrer-Policy: no-referrer` — asserted per-route in prod & dev | `security.spec.ts` headers test; verified against `next start` prod server 2026-10-05 |
| No third-party scripts | All script requests in the journey are same-origin | `security.spec.ts` |
| No XSS via archive content | Malicious username `<img onerror>` renders as inert text; `javascript:`/cross-origin hrefs fall back to derived `https://instagram.com/<u>` | `security.spec.ts` + `analysis.ts profileUrl()` unit tests |
| IndexedDB fully deleted | `Delete everything` (double-confirm) leaves `indexedDB.databases()` with zero rows across all tables and clears localStorage keys | `security.spec.ts` deletion test |
| Deep links are safe | All Instagram links/buttons use `target="_blank" rel="noopener noreferrer nofollow"` or `window.open(..., 'noopener,noreferrer')` | `security.spec.ts` deep-link test |
| Sensitive data in logs | Parser, store, ReturnConfirm and components were hand-reviewed: no usernames/tokens/hrefs are ever logged; analytics whitelist enforced server-side (400 on unknown event names; unknown props stripped) | `billing.spec.ts` analytics-relay tests + code review |
| No service-worker cache risk | **No service worker is registered at all** in this phase — nothing can be cached across users/devices beyond normal HTTP caching of static assets (which are non-sensitive; privacy data lives only in IndexedDB) | runbook §SW decision |

## Dependency posture

- `npm audit --omit=dev`: **0 vulnerabilities** in production dependencies (next, react, dexie, fflate, stripe).
- 33 `high` advisories exist **only in dev-dependency chains** (jest 29 → braces/micromatch stack-exhaustion ReDoS-class; `@types/jest` chain). These run only on developer machines / CI, never ship. Upgrading to jest 30 is a breaking change — deferred and recorded; blast radius: none at runtime.

## Browser storage inventory (everything we persist)

| Store | Contents | Cleared by Delete-everything |
|---|---|---|
| IndexedDB `ghoast.snapshots` | file name, sha-256, counts, dates | ✔ (whole DB cleared) |
| IndexedDB `ghoast.relations` | username, href, direction, since | ✔ |
| IndexedDB `ghoast.decisions` / `events` / `comparisons` / `settings` | decisions, ledger, diffs, prefs | ✔ |
| `localStorage[ghoast-ui]` | theme/reduced-motion only | cleared on delete (settings cleared; key is cosmetic) |
| `sessionStorage[ghoast-pending-open]` | pending confirm username ≤30 min | session-scoped; expires with tab |

## Privacy invariants re-confirmed

No Instagram credentials, session cookies, private-API calls, scraping, automated unfollowing, or fabricated profile metadata exist anywhere in the codebase (grep-verified: no `sessionid`, `i.instagram.com`, `sessionToken` remains in `apps/web`). Cleanup is user-directed (deep link + self-report, verified on next scan).

## Residual risks

1. **Device-local data is readable by anything with local access** (shared computers, XSS in a hypothetical future dependency, browser extensions). Mitigation today: zero third-party scripts + strict CSP; document to users that device access = data access.
2. **Stripe Checkout / PostHog relays** are first-party API routes; their server-side env must stay secret — standard platform secret hygiene (`.env*` gitignored).
3. **`File.lastModified`-based staleness** can false-positive; it is advisory only, never blocking.
