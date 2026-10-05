# GHOAST 👻

**Your Instagram has ghosts.** GHOAST shows you exactly who doesn't follow you back — from your own Instagram data export, read entirely on your device. Never your password.

## What it is

A privacy-first relationship-intelligence PWA:

1. You request your official **"Download Your Information"** export from Instagram (followers & following, JSON format — we walk you through the exact taps).
2. You drop the ZIP into GHOAST. **It is opened and read in your browser. It is never uploaded.** (This is enforced by the Content-Security-Policy, not just promised in copy.)
3. You get the complete picture — mutuals, ghosts, fans — sorted by *how long each one-way relationship has existed*, with every row explainable from your own file.
4. You triage calmly: **Keep · Queue · Later · Skip**. You do the actual unfollowing inside Instagram, at a pace GHOAST helps keep safe.
5. Your next scan shows **what changed** — verified unfollows, new ghosts, who became mutual (GHOAST+ feature).

## Architecture

**There is no backend in this phase — by design.** The privacy promise ("your file never leaves your device") is only technically satisfiable with on-device processing, so the product is a single client-side Next.js PWA.

- `apps/web` — the entire product (Next.js 16, React 19).
  - `src/lib/parser/instagram-dyi.ts` — defensive adapter for the Instagram DYI export (multi-file splits, JSON-only, typed repair errors). Versioned: `dyi-2024-json`.
  - `src/lib/analysis.ts` — relationship classification (mutuals / ghosts / fans) + age bands. Pure set math.
  - `src/lib/comparison.ts` — snapshot diffing (new ghosts / became mutual / verified unfollows / follower deltas / vanished accounts).
  - `src/lib/db.ts` + `src/lib/store.ts` — Dexie/IndexedDB persistence: snapshots, relations, decisions (username-keyed, scan-independent), comparisons, activity ledger, settings. Decisions reconcile against future scans.
  - `src/lib/copy.ts` — every user-facing string (spec copy registry).
- No Instagram credentials, sessions, or API calls anywhere. No avatars, follower counts, display names, or account types are shown — the export doesn't contain them, so we don't pretend (deterministic monogram tiles instead).
- **Deferred:** real billing/checkout (requires a payment backend — the GHOAST+ gate is implemented and honest about this), cross-device sync, CSV export. See `ENGINEERING-LOG.md` §5.

Legacy documents describing the previous credential-based architecture are archived in `docs/legacy/` and are **no longer authoritative**.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

## Verification

```bash
npm run typecheck
npm run lint
npm run test:unit  # parser, analysis, comparison, store reconciliation
npm run test:e2e   # full journey incl. "no archive bytes leave the origin"
npm run build
```

## Testing with a real export

Instagram → profile → ☰ → **Accounts Center** → **Your information and permissions** → **Download your information** → select your profile → **Some of your information** → **Followers and following** → format **JSON** → **All time**. When the email arrives, drop the ZIP onto `/upload`. Don't unzip it.

## Engineering log

All architectural decisions, spec conflicts, test results and deferred work: **`ENGINEERING-LOG.md`**.
Design authority: **`GHOAST-UX-UI-Master-Spec.md`**.
