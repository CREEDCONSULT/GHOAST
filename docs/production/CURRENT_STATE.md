# GHOAST — Current State (Production Hardening Baseline)

**Date:** 2026-10-05
**Source of truth:** `ENGINEERING-LOG.md` (sessions 1), this audit, live verification runs.

## Repository status

- Not a git repository (working copy snapshot). `.github/workflows/ci.yml` exists and targets `npm run verify`.
- Single-app npm workspace: `apps/web` only. Root scripts delegate to it: `dev`, `build`, `start`, `test`, `test:unit`, `test:e2e`, `test:coverage`, `typecheck`, `lint`, `lint:fix`, `verify`.
- `docs/legacy/` contains the retired credential-based product's docs (non-authoritative).
- `GHOAST-UX-UI-Master-Spec.md` is the design authority; `ENGINEERING-LOG.md` the implementation log.

## Architecture (as verified)

| Layer | Implementation | Notes |
|---|---|---|
| App | Next.js 16 (App Router) + React 19 PWA-style SPA, client-rendered app routes | 22 routes; mostly static-prerendered |
| Parsing | `src/lib/parser/instagram-dyi.ts` v`dyi-2024-json` (fflate) | client-side only |
| Analysis | `src/lib/analysis.ts` (set classification + age bands) | pure functions |
| Comparison | `src/lib/comparison.ts` (6 delta groups) | pure functions |
| Persistence | Dexie/IndexedDB v1 (`src/lib/db.ts`, `src/lib/store.ts`) | only persistence layer |
| Copy | `src/lib/copy.ts` registry | no hard-coded UI strings in components (aspirational — mostly true) |
| Security | `next.config.ts` CSP `connect-src 'self'`, no-store, nosniff, frame-ancestors none | enforced at HTTP header level |
| Billing | Not wired — `plan` setting + gates only; dev-only simulate path | blocker, see ENGINEERING-LOG §5.3 |
| Analytics | None | spec §14 default |

## Verified test state (baseline)

- `npm run typecheck` ✓
- `npm run lint` ✓ (eslint-config-next, flat config)
- `npm run test:unit` — 19/19 ✓ (parser, analysis, comparison, store/reconciliation; jsdom + fake-indexeddb)
- `npm run test:e2e` — 12/12 ✓ (Desktop Chrome + Mobile Chrome/Pixel 5; includes zero-external-request privacy assertion during archive processing)
- `npm run build` ✓

## Environment notes (this machine)

- Node v24.15.0; npm workspaces; Playwright browsers installed.
- Port 3000 occupied by a stale pre-existing process (not ours) — dev/validation runs use other ports; CI unaffected.
- Low RAM observed (1.8 GB free) — run Playwright with `--workers=2` on this machine.
- pnpm shim missing (irrelevant; repo uses npm).

## Known functional gaps at baseline

1. No real billing (gates implemented, checkout not).
2. No analytics.
3. No PWA manifest/service worker (offline works by construction *after load*, but the app is not installable and has no offline-first guarantee on cold start).
4. No real-world export regression corpus — parser validated against synthetic fixtures modeled on documented DYI structures only.
5. Virtualization is progressive-render ("Show more"), not windowed rows.
6. Review-session resume exists in settings model but the deck does not yet restore mid-deck position across reloads.
7. SH-4 interruption resume implemented via `pendingJobFileName`, not yet browser-tested.
8. Mutuals full screen exists (route `/results/mutuals`) though spec MVP collapsed it — harmless superset.
