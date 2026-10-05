# GHOAST — Engineering Log

**Log owner:** Principal implementation owner (AI)
**Session start:** 2026-09-30
**Authority documents:** `GHOAST-UX-UI-Master-Spec.md` (product/UX design authority); this repository (implementation evidence).

---

## 1. Current-State Assessment (Phase 1 audit)

### 1.1 Repository shape (as found)

Turborepo monorepo, npm workspaces:

- `apps/api` — Fastify 5 API server (TypeScript, ESM), JWT auth (bcrypt password hashing, access token + httpOnly refresh cookie), Stripe billing (subscriptions + one-time credit packs), BullMQ queue on Redis (ioredis), Pino logging. Routes: `/api/v1/auth`, `/accounts` (connect/disconnect/scan/ghosts/snapshots/whitelist), `/billing`, `/queue`, `/users`. Separate worker process (`workers/unfollow.worker.ts`, `snapshot.cron.ts`, `disconnect.cron.ts`). Ops scripts: queue inspect/clear, Instagram actions stop/resume/status ("emergency stop").
- `apps/web` — Next.js 16 (App Router) + React 19, Tailwind v4 present but barely used (dominant styling is hand-rolled CSS + inline styles). No state library; hand-rolled `fetch` client holding JWT in sessionStorage. Routes: `/`, `/login`, `/register`, `/app/connect`, `/app/dashboard`, `/app/settings`, `/privacy`, `/terms`, `/cookies`, `/account/delete`.
- `packages/db` — Prisma + PostgreSQL, 8 models: User, InstagramAccount (stores **AES-encrypted Instagram `sessionid` cookie**), Ghost (displayName, profilePicUrl, followersCount, isVerified, accountType, 5-dimension priority score + tier 1–5), UnfollowQueueJob, QueueSession (daily caps), AccountSnapshot, CreditTransaction, Subscription. 2 migrations present.
- `packages/contracts` — zod schemas shared between API and web.
- `packages/design-tokens` — tier colors/fonts/pricing constants; **not actually consumed by apps/web** (palette duplicated by hand in `globals.css`).
- `load-tests/` (Artillery queue-load.yml), `scripts/runtime-smoke.mjs`, `Dockerfile`, `docker-compose.yml`, `.github` workflows, ~15 legacy planning/marketing docs.

### 1.2 The decisive finding

The existing product is **not an export-parsing product at all**. It is a **credential-capture automation tool**:

- `apps/web/src/app/app/connect/page.tsx` instructs the user to open browser DevTools and paste their Instagram **`sessionid` cookie** (rendered as a password field), which is uploaded to the server (`POST /accounts/connect`) and stored AES-encrypted in Postgres.
- `apps/api/src/lib/instagram.ts` is an **Instagram private-API client**: spoofed Android user-agent, `https://i.instagram.com/api/v1` endpoints, paginated scraping of following/followers lists, per-user info enrichment (follower counts, avatars, verification, privacy state, post recency, derived "account type").
- `apps/api/src/workers/unfollow.worker.ts` + `queue.service.ts` + `unfollowUser()` in `instagram.ts` implement **server-side automated unfollowing** with rate-limit pacing and daily caps.

This architecture directly violates the master spec's non-negotiable constraints:

1. "GHOAST must not require Instagram credentials" — a session cookie is a credential; it is arguably *more* sensitive than a password (bypasses 2FA).
2. "Do not implement automated mass-unfollowing" — the BullMQ unfollow worker is exactly that.
3. "Do not fabricate avatars, display names, follower counts, verification, account type… unless there is a legitimate, authorized, technically verifiable source" — the only source here is unauthorized private-API scraping.
4. "If the UI says data never leaves the device, the architecture must make that technically true" — the current architecture moves the user's live Instagram session to a third-party server.

It also carries existential platform risk (account locks/bans for users; ToS violations), which the spec's research section documents as the category's core trust failure.

### 1.3 Spec-requirement mapping (as-found repo vs master spec)

| Spec requirement | As-found status | Classification |
|---|---|---|
| Privacy-first Instagram export ingestion | Absent. No file input, no ZIP parsing anywhere (grep: zero). "Analyze-only export mode" mentioned only as a future bullet in legacy docs. | **Missing** |
| Client-side / privacy-preserving processing | Inverse: all processing server-side, credential-based. | **Incompatible with existing architecture** |
| Robust export parsing (multi-file splits, JSON vs HTML, malformed) | n/a | **Missing** |
| Followers/following relationship analysis, mutuals, ghosts, fans | Present in spirit (non-mutual detection) but via scraping; no fans/mutuals surfaces. | **Missing (must rebuild on export data)** |
| Relationship age/staleness | Absent (export timestamps never ingested; scoring uses follower counts/post recency instead). | **Missing** |
| Snapshot persistence (export-derived) | `AccountSnapshot` exists but stores scraped count telemetry, not export snapshots. | **Incompatible → replace** |
| Multiple-scan comparison / deltas | Absent. | **Missing** |
| Decisions: Keep / Queue / Later / Skip | Partial concept (`isWhitelisted`, queue jobs) but Queue here = *server executes unfollow*, not user intent. | **Incompatible → replace semantics** |
| Activity ledger / undo | Absent. | **Missing** |
| Protected accounts | `isWhitelisted` field + route exist; no UI; semantics differ (per-Ghost row, not scan-independent). | **Partially implemented → rebuild** |
| Cleanup workflow w/ deep links + self-report vs verified | Absent (system unfollows for you). | **Missing** |
| Future-scan reconciliation (verified gone) | Absent (`removedAt` set when the *worker* acted). | **Missing** |
| History / comparison UI | Absent. | **Missing** |
| Responsive mobile+desktop UX, bottom tabs, desktop rail | Top-nav only; crowded mobile nav; no tab/rail system. | **Needs rebuild** |
| Accessibility | Minimal (some aria on landing; toasts without live regions; keyboard gaps). | **Needs improvement** |
| Provenance/evidence surfaces | Absent. | **Missing** |
| Privacy controls / deletion | Account deletion works (server-side). Per-scan deletion n/a. | **Replace with local data controls** |
| Paid history/comparison gating | Stripe billing exists (subscriptions + credit packs) but for the wrong product, and paywall links point to a non-existent `/pricing` route. | **Incompatible → replace entitlement model** |
| Auth (email/password + JWT) | Exists, works, tested. But spec mandates **anonymous-first, no account for MVP**; account exists only later for paid sync. | **Obsolete for MVP → remove** |
| Billing (Stripe) | Server-side Stripe integration appears complete and tested. | **Blocked without backend for client-only MVP → defer, keep paywall+gating client-side** |
| Landing/trust/onboarding/guide copy | Landing exists and is polished, but markets the scraping product ("Connect Instagram", fake stat strips, tier teaser). No export guide. | **Rebuild around export story** |

### 1.4 Quality notes on the as-found code

Strong work worth acknowledging: the API layer was disciplined (typed contracts, rate limiting, encryption-at-rest for tokens, emergency-stop policy, honest test coverage incl. security tests). None of it is reusable for the target product because its *purpose* is disallowed. Per my mandate ("do not preserve weak code simply because it exists; do not rebuild functionality merely because the specification describes it differently"), the backend is not weak code — it is **prohibited architecture** and is removed for that reason, documented here explicitly.

### 1.5 Decision record

**D1 — Architecture reset to a 100% client-side PWA.** The master spec's privacy promises ("read on this device, never uploaded") are only technically satisfiable with on-device processing. The spec (§14, §26.2) makes this a copy-backed architectural requirement. Therefore: remove `apps/api`, `packages/db`, `packages/contracts`, BullMQ/Redis/Prisma/Stripe server code, Docker/compose, load-tests, credential flows, and the automated unfollow engine. `apps/web` becomes the entire product.

**D2 — Data acquisition = official Instagram "Download Your Information" ZIP only**, parsed in-browser with `fflate`; defensive, versioned adapter (`lib/parser/instagram-dyi.ts`); JSON required; HTML exports refused with repair guidance; multi-file `followers_1.json…` splits merged.

**D3 — Knowledge model = topology + time only.** Relationship store keeps exclusively: username, profile URL (`href` from the export), directionality, relationship-start timestamps. No avatars (deterministic monogram tiles per spec C-08), no names, no counts, no verification, no account types, no scoring. Ranking = staleness sort, disclosed as such.

**D4 — Persistence = IndexedDB (Dexie)**, stores per spec §26.3: `snapshots`, `relations`, `decisions` (username-keyed, scan-independent), `comparisons`, `settings`. No network persistence. "Delete everything" wipes the database.

**D5 — Monetization in this build:** comparisons/history are feature-gated behind a `plan` setting exactly as the spec requires, but **real payment collection is a documented blocker** (no backend exists by design in this phase; PCI/Stripe require server components). The paywall sheet UI is implemented and dismissible; dev builds include an explicit "simulate entitlement" affordance marked as such. See Deferred Work §5.3.

**D6 — Cleanup = user-executed.** Queue means "I intend to unfollow". Actions happen in Instagram via deep link (`href` from the export, which is exactly `instagram.com/<username>`). Return-confirm captures self-report; only a later scan can verify. Pacing: break sheet after N opens (default 25, configurable).

---

## 2. Target Implementation Plan (Phase 2)

Dependency-ordered sequence (value-first, coherent product over surface breadth):

1. **Workspace surgery** — remove prohibited/obsolete architecture; simplify to a single-app repo; fix root tooling (turbo/scripts/env/docs).
2. **Design tokens + copy registry** — spec §18 tokens as CSS vars + TS constants (dark + light); §24 strings registry; fonts (Inter + Space Grotesk).
3. **Trust core** — IndexedDB schema + export adapter + validation/error taxonomy + upload screen incl. every error state (wrong file / HTML / corrupt / duplicate via SHA-256 / stale / interrupted-resume) + processing checklist.
4. **Analysis engine + Ghost Board** — classify mutuals/ghosts/fans; bands (recent/settling/long-standing); S-06.
5. **List engine** (`AccountRow`, `FilterBar`, search/sort/filters, virtualized-friendly) reused by Ghosts/Fans/Mutuals/Saved/Kept/History detail.
6. **Triage deck** — 4 verbs, gestures+keyboard, undo toast, session persistence, pacing integration.
7. **Ledger + decisions store + reconciliation** — kept persists across scans; queued/handled_self/handled_verified lifecycle; Activity page; completion sheet.
8. **Execution loop** — cleanup queue view, "Open in Instagram" deep links, return-confirm sheet, break sheet.
9. **Comparison engine + History + paywall gating** — diff engine (new ghosts / became mutual / verified-unfollowed / new+lost followers / vanished).
10. **Settings/Data** — appearance, pacing prefs, per-snapshot delete, delete-everything, export-decisions CSV is deferred (post-MVP per spec §25).
11. **Tests** — parser fixtures (synthetic ZIPs incl. split files, HTML, corrupt, missing sections), analysis/comparison/decision-reconciliation unit tests; Playwright smoke (landing → upload synthetic export → board → review verbs → queue confirm → second scan → comparison).
12. **Docs** — rewrite README; archive legacy docs under `docs/legacy/`; update this log continuously.

Deferred (documented, not silently dropped): real billing/checkout, cross-device sync/account, CSV export, localization, email capture/reminders, mutuals full screen (collapsed lane per spec MVP).

---

## 3. Running record

(Entries appended as work completes: files changed, tests, validation, failures/fixes.)

### 2026-09-30 — Session 1: audit + reset
- Completed Phase 1 audit (§1 above) and Phase 2 plan (§2 above).
- Decisions D1–D6 recorded.

### 2026-09-30 — Session 1 (cont.): workspace surgery + full rebuild

**Removed (prohibited/obsolete architecture — see §1.2):**
- `apps/api/` (Fastify server, Instagram private-API client `lib/instagram.ts`, AES session-cookie encryption, BullMQ unfollow worker, Stripe billing routes, auth routes)
- `packages/db/` (Prisma/Postgres schema incl. `sessionTokenEncrypted` storage), `packages/contracts/`, `packages/design-tokens/` (was not actually consumed by web)
- `load-tests/`, `scripts/runtime-smoke.mjs`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.env.example`, `turbo.json` (single-app repo no longer needs turbo orchestration)
- Web: `login`, `register`, `app/connect` (session-cookie paste), `app/dashboard` (tier/score ghost list), `app/settings` (server account deletion), `middleware.ts` (cookie gating), `context/AuthContext`, `lib/api.ts`, `lib/auth.ts`, all old e2e specs, boilerplate SVGs
- Legacy docs moved to `docs/legacy/` (marked non-authoritative in README)

**Root tooling:** package.json simplified to single-app workspace scripts; CI workflow rewritten (no Prisma/smoke steps); `verify` = typecheck + lint + unit + build.

**Built (all new, `apps/web`):**
- `src/lib/types.ts` — data model per spec §26.3 (Snapshot/Relation/Decision/Comparison/LedgerEvent/Settings) + `ExportParseError` taxonomy
- `src/lib/parser/instagram-dyi.ts` — DYI adapter v`dyi-2024-json` (fflate): multi-file `followers_N.json` merge, defensive schema walk, HTML-refusal, case-insensitive dedupe preferring timestamped entries, 2GB guard, corrupt/wrong-file/empty/incomplete error codes
- `src/lib/analysis.ts` — mutuals/ghosts/fans set classification, age bands (recent <30d / settling / long-standing >1y / unknown), honest formatting helpers
- `src/lib/comparison.ts` — snapshot diff engine (newGhosts / becameMutual / youUnfollowed / newFollowers / lostFollowers / vanished)
- `src/lib/db.ts` — Dexie/IndexedDB v1 schema
- `src/lib/store.ts` — settings, sha-256 duplicate detection, `setDecision` + ledger events, ingest pipeline with reconciliation (queued/handled_self → handled_verified on absence; still-present empathy flag), per-snapshot delete, delete-everything
- `src/lib/copy.ts` — full copy registry (spec §24)
- `src/lib/hooks.ts` — settings live-query + theme/reduced-motion sync, latest-snapshot hook
- Components: Toast (aria-live, undo), Monogram (deterministic hash-hue tiles — no fake avatars), Sheet (focus-trap, Escape), AccountList (list engine: search/sort/filters/counts/selection-mode bulk Keep+Save/progressive rendering), ListPage, AppShell (bottom tabs mobile / left rail desktop, unreviewed badge), ReturnConfirm (SH-6 return-confirm + SH-7 break sheet + pacing), GuideContent, Paywall (honest deferred-checkout copy + dev-only simulate), PublicFooter
- Pages: `/` landing, `/privacy`, `/how-it-works`, `/pricing`, `/help`, `/start` (3-step onboarding), `/get-my-file` (guide), `/upload` (all error states + duplicate + stale + interrupted-resume + paced processing checklist), `(app)` group: `/results` (Ghost Board), `/results/ghosts|fans|mutuals`, `/review` (deck: 4 verbs, gestures, keyboard, undo, session counters), `/saved`, `/kept`, `/activity` (ledger + cleanup queue), `/account/[username]` (facts + provenance + honesty block + decision history), `/history` + `/history/[runId]` (GHOAST+ gated), `/settings`, `/settings/data` (per-snapshot delete + delete-everything double confirm)
- `next.config.ts` — CSP incl. `connect-src 'self'` (architecture-as-policy: app JS cannot send the archive anywhere), no-store privacy headers
- Tests: 19 unit (parser incl. HTML/corrupt/wrong/empty/2GB/split/dedupe + 10k-row perf <8s, analysis, comparison incl. case-insensitivity, store reconciliation/duplicate/delete) + 6 Playwright e2e (landing/privacy/help, full journey upload→board→review→queue→second-scan→delete **asserting zero external network requests**, HTML-export repair, duplicate detection) on Desktop Chrome + Mobile Chrome (Pixel 5)

**Failures found & fixed during verification:** file-vs-jest-suite glob (helpers.ts), jsdom missing `structuredClone`/`Blob.arrayBuffer`/`crypto.subtle` (jest.setup polyfills), two wrong test expectations (fan-row counting; became-mutual also counts as new-follower — semantics kept, tests corrected), eslint react-hooks violations in effects (refactored to derived state/refs/useSyncExternalStore), strict-mode Playwright selectors (2 fixes).

**Verification (all green):** `npm run typecheck` ✓ · `npm run lint` ✓ · `npm run test:unit` 19/19 ✓ · `npm run build` ✓ (22 routes, static where possible) · e2e 6/6 desktop + 6/6 mobile ✓ (run against dev server on :3100; port 3000 was occupied by a stale pre-session node process, left untouched).

## 4. Spec conflicts & revisions (decided)

- **§22 "partial mode"** claimed ghosts could be shown with only `following.json` — logically impossible (ghosts = following ∖ followers needs both lists). Revised to a blocking "incomplete export" repair error. Copy added to registry (`upload.errors.incomplete`).
- **§S-01 "Sign in"** on landing conflicts with anonymous-first; removed — sign-in exists nowhere in this build.
- **Per-snapshot $9.99 one-time tier** (prototype) killed per spec's own §S-16 decision; Monthly $4.99 / Annual $29.99 shown.
- **Bulk Queue** intentionally absent everywhere (design decision preserved per spec §12; rationale in `review/page.tsx` comment).

## 5. Deferred work & blockers

- **5.3 Real billing (BLOCKER):** Payments require a server-side provider integration (Stripe webhooks cannot be verified purely client-side). The `plan` entitlement, gating of `/history*`, and the paywall sheet are fully implemented and honest (`copy.paywall.purchaseUnavailable`); a clearly-labeled dev-only "Simulate GHOAST+" toggle exists for flow testing. Next phase: minimal entitlement-api backend + Stripe, then remove the simulate path.
- Cross-device sync / optional account (spec §25 Post-MVP v1.1) — depends on the same backend decision; sync must carry decisions/aggregates only, never the archive.
- CSV export of decisions (spec §25 v1.2), localization, reminders/email (v1.3), advanced sort facets (v1.4).
- Coach marks limited to the ghost-definition one-time mark (spec MVP allows ≤3).
- Desktop rail polish "functional, not final" per spec §25 MVP note.
- E2E: refresh-mid-processing resume (SH-4) is implemented via `pendingJobFileName` but not browser-tested (timing-dependent); covered indirectly by unit-level state handling.

## 6. Unresolved risks

- Meta DYI format drift — mitigated by defensive adapter + version marker + real-export regression suite; quarterly re-verification against fresh real exports recommended.
- First-paint `ghoast-ui` localStorage boot script assumes that key; users who clear storage fall back to dark — harmless.

---

## 7. Session 2 (2026-10-05) — Production launch hardening + real-user validation

### Re-audit
`docs/production/CURRENT_STATE.md` written before any changes. Env: not a git repo; port 3000 occupied by stale pre-session process (untouched; validation ran on :3100/:3101); low RAM observed → Playwright `--workers=2`.

### Critical real-export catch (parser)
Three real Instagram DYI exports on the dev machine were validated (structure-only; no usernames recorded/transmitted):
- **Real exports nest lists under `connections/followers_and_following/`** and — critically — **`following.json` entries carry the username in the item's `title`, with NO `value`** in `string_list_data`. Followers files use `value`. Both shapes coexist per export.
- The Session-1 adapter required `value` and would have parsed 0 following entries → "incomplete" error for 100% of real users. **Fixed** (`collectEntries` title fallback); regression tests + `src/__tests__/real-exports.test.ts` (env/path-gated) added. New `scripts/validate-real-export.mjs` = repeatable structure validator.
- Also fixed: valid-but-empty exports (0 relationships) now accepted as a zero-scan instead of an error, while all-corrupt-JSON still errors distinctly.

### Security/privacy hardening (phase 3)
- New `tests/e2e/security.spec.ts`: per-route CSP/header assertions (dev+prod), no-third-party-scripts, canary exfiltration scan, malicious username/href neutralization, deep-link noopener assertions, IndexedDB+localStorage full-deletion proof.
- **`profileUrl` href sanitization** added (https + instagram.com-only, else derived) — closes a javascript: URL injection vector through crafted exports.
- Fixed a11y/security-adjacent defects baptised by axe: btn contrast 4.23→~6.9 (spectral-700), `--text-3` brightened (4.37→>4.5), `<dl>` child validity, dropzone UA-background leak, progressbar naming.
- `npm audit --omit=dev`: 0 vulnerabilities. 33 high advisories exist only in jest dev chains (documented; not shipped).

### Billing (phase 4) — real boundary, no fakes
Stripe boundary implemented and env-gated: `/api/billing/checkout` (monthly/annual), `/verify` (grants plus only on confirmed payment), `/status` (truth for UI), `/webhook` (signature-verified). `/settings/plus` return page, Settings "Recheck membership", paywall shows checkout buttons when configured, honest "not available" otherwise. Founder action list: `docs/production/BILLING_ENTITLEMENT.md`. Dev-only simulate toggle remains compiled out of production.

### Deployment (phase 5)
PWA manifest + authored ghost icon; prod `next build`+`next start` smoke-verified (CSP, manifest, billing 503-honesty). NO service worker on purpose (offline-after-load by construction; no cross-user cache surface). Runbook: `docs/production/DEPLOYMENT_RUNBOOK.md`. No deployment performed — awaiting founder hosting authorization.

### Analytics (phase 6)
Opt-in (default OFF) event-only funnel: `src/lib/analytics.ts` + `/api/analytics` first-party relay with **server-side event/prop whitelist**; PostHog only if keyed, else accept-and-drop 204. Settings toggle; privacy page disclosure; `analyticsOptIn`/`analyticsId` settings keys; `getSettings` now forward-merges defaults (old IndexedDB records upgrade cleanly). Schema: `docs/production/ANALYTICS_SCHEMA.md`.

### UX/trust (phase 7)
No redesign. Added landing honesty line (password risk framing), privacy-page payments+analytics sections, honest paywall/purchase copy. Upload trust line, guide expectations, provenance panels already conformant.

### Accessibility/performance (phase 8)
`tests/e2e/accessibility.spec.ts`: axe-core WCAG 2.1 A/AA on all 17 routes (0 critical/serious after fixes), keyboard-only deck completion test, ≥40px(AA-floor) target assertions incl. bottom tabs. Large-list handling: progressive render (200+500 batches) — kept from session 1; 10k-relationship parse benchmarked <8s in unit tests.

### Final gates (phase 9)
- `npm run verify` ✅ (typecheck + lint + 25/25 unit + build)
- `npm run test:e2e` ✅ 66/66 (chromium + Mobile Chrome; journey/security/billing/a11y)
- `next start` prod smoke ✅ (CSP headers, manifest, billing status honesty)

### Post-gate fixes (caught from dev-server console output, 2026-10-05)
- **React setState-in-render defect:** `router.replace('/upload')` was called during render in `/results`, ListPage, `/saved`, `/review`, `/history`, `/history/[runId]`. All moved to `useEffect` guards (React lint rule surfaced the pattern in dev logs; not user-visible but a correctness bug under concurrent rendering).
- **Axe false-negative fix round 2:** stat cards used `<dl>` with `<a>`/`<div>` children (invalid HTML: dl may only contain dt/dd/div-of-dtdd). Restructured to link-cards containing their own `<dl>`.
- Re-verified after fixes: `npm run verify` ✅ · e2e **66/66** ✅ (chromium + Mobile Chrome).

### Environment note
Port 3000 = stale pre-session process (untouched). Validation servers used :3100/:3101/:3110 (stopped at session end).

---

## 8. Session 3 (2026-10-05) — Batch Cleanup Assistant v1 (`feat/batch-cleanup-assistant-v1`, base 911704a)

**Scope honored:** invariants preserved (no credentials/cookies/private-API/scraping/server-side export storage/autonomous operation); extension is a user-started execution adapter; `handled_verified` remains export-only.

**Web:** `lib/cleanup.ts` batch library (dedupe, kept-exclusion, cursor lifecycle, receipts), Dexie v2 `cleanupBatches` store, AccountList first-N batch toolbar (5/10/25/50/100/200/custom over the filtered+sorted set), `/cleanup` page (progress/ETA/current card/Start-Pause-Resume-Skip-Stop/failures/receipts/pacing), manual driver wired through ReturnConfirm receipts, optional extension driver via `lib/extension.ts` bridge (origin+protocol validated), Cleanup nav entry.
**Extension:** `apps/extension` MV3 — `tabs`+`storage` only, no cookies/webRequest/scripting; conservative visible-text DOM control detection; halt taxonomy (challenge/rate-limit/login/modal/ambiguity); jittered ≥20s pacing; 100% user-started sessions; structured receipts.
**Fixed under test:** `deleteEverything()` now clears `cleanupBatches` (privacy completeness).
**Tests:** unit 38 web + 20 extension (origin rejection, dup rejection, pacing floor, DOM fixtures, kept-exclusion, self-vs-verified, halt-keeps-cursor, pause/resume, persistence, manifest audit); e2e 70/70 incl. full manual batch flow on desktop+mobile.
**Docs:** `BATCH_CLEANUP_ASSISTANT_V1_REPORT.md` + `apps/extension/README.md`.
**Not done (by instruction):** no deployment, no real-account batches; extension needs `NEXT_PUBLIC_GHOAST_EXTENSION_ID` + production-domain manifest substitution before the assistant button activates in prod.

### Deliverables this session
`docs/production/{CURRENT_STATE,REAL_EXPORT_COMPATIBILITY,SECURITY_PRIVACY_AUDIT,BILLING_ENTITLEMENT,DEPLOYMENT_RUNBOOK,ANALYTICS_SCHEMA,FIRST_USER_VALIDATION_PLAN}.md`, `LAUNCH_READINESS_REPORT.md` (verdict: **READY WITH CONDITIONS** — conditions are founder Stripe/hosting actions, not code).

### Carry-over deferred (unchanged from §5 unless noted)
- 5.3 billing blocker → **integration-complete; now founder-credentials-only**.
- Sync/accounts, CSV export, localization, reminders, mid-deck position restore, SH-4 browser-level test, waitlist of "weird export" telemetry opt-in event.

