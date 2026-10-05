# GHOAST Batch Cleanup Assistant v1 — Implementation Report

**Branch:** `feat/batch-cleanup-assistant-v1` · **Base commit:** `911704ac0dfe8e81f17c8381a1d8a6f69c5351a3`
**Date:** 2026-10-05 · **Status:** vertical slice demonstrably working (manual driver end-to-end in e2e; extension logic fully unit-tested against mock Instagram DOM). **Not deployed. No real-account batches run.**

---

## 1. Invariants preserved (verified, not asserted)

- No Instagram credentials, session cookies, private APIs, scraping, or server-side export storage reintroduced anywhere (grep + manifest audit tests enforce).
- A browser action can only ever become **`handled_self`**; `handled_verified` is produced exclusively by `ingestParsedExport()` during a later real export reconciliation — covered by a dedicated unit test.
- The extension carries **no cookies permission**, no `webRequest`, no `scripting` injection — host access is restricted to `instagram.com` + the GHOAST app domain; command acceptance is origin-validated twice (`manifest.externally_connectable` + `protocol.validateExternalCommand`).
- Extension **stops rather than guesses**: login screen / challenge / rate-limit / unexpected modal / ambiguous controls / wrong-profile all halt the entire session with a typed receipt.

## 2. Delivered surfaces

### A. GHOAST Web (`apps/web`)
- **Batch primitives** (`src/lib/cleanup.ts` + Dexie v2 `cleanupBatches` store): durable `CleanupBatch { id, sourceSnapshotId, createdAt, status, usernames[], currentIndex, completed/skipped/failed, pacing, receipts[], driver }`. Duplicate-free construction (in-batch dedupe + cross-active-batch exclusion), kept/protected accounts can never enter.
- **First-N selection** (`AccountList` batch toolbar on the Ghosts list): 5/10/25/50/100/200/custom-N chips operate on the **currently filtered + sorted** result set (the exact list order the user sees, including band filters/search/sort).
- **`/cleanup` page**: selected count, current account card, progress (`processed/total`) + remaining + pace-derived ETA, Start / Pause / Resume (extension driver) / Skip / Stop, failures list, receipts ledger, pacing control, honest "self-reported until next scan" note.
- **Manual driver**: Start opens the profile via the existing safe deep-link path (`noopener`), records an `opened` receipt; the return-confirm sheet turns the user's answer into `confirmed` (→ `handled_self`) / `skipped` receipts with cursor advancement.
- **Nav**: Cleanup added to the desktop rail (mobile economy of 4 tabs preserved).
- **Bug found by the new tests:** `deleteEverything()` didn't clear the new batch table — fixed (deletion completeness is part of the privacy promise).

### B. Chrome Companion Extension (`apps/extension`, MV3)
- `manifest.json` — minimal permissions (`tabs`, `storage`), tight hosts, `externally_connectable` allowlist.
- `src/protocol.ts` — origin + command validation with username-shape and pacing bounds (≥20s floor), duplicate rejection.
- `src/insta-dom.ts` — conservative visible-text control detection (`Following` → dialog → `Unfollow` → verify flip to `Follow`), halt taxonomy, "already not following" → skipped.
- `src/background.ts` — one user-started session, one tab, sequential loop, jittered pacing, session state in `chrome.storage.session`, receipts streamed back via `GHOAST_BATCH_STATUS` polling.
- `src/content.ts` — single-action actor; async message reply; every outcome typed: `opened | requested | confirmed | skipped | failed | stopped`.
- Build: esbuild → `dist/{manifest.json, background.js (ESM SW), content.js (IIFE)}`; load-unpackable.

### C. Security boundary
Honored as specified: extension = execution adapter; web = decision authority; Instagram = state authority. Receipts are self-report evidence only.

## 3. Validation matrix (all run, all green)

| Gate | Result |
|---|---|
| typecheck (web + extension) | ✅ |
| lint (web) | ✅ |
| unit — web (incl. 10 new batch-guarantee + manifest-audit tests) | ✅ 38/38 |
| unit — extension (protocol/origins/pacing + DOM fixtures) | ✅ 20/20 |
| build — web (Next) + extension (esbuild) | ✅ |
| existing e2e suite | ✅ 66 tests green |
| new cleanup e2e | ✅ 4/4 (first-N → /cleanup → manual run → confirm → skip → stop → persistence) |
| **total e2e** | ✅ **70/70** (chromium + Mobile Chrome) |

## 4. Deliberate limits of the slice (documented, not hidden)

- **No real-account batches were run** (max-5 rule applied to first real validation, which remains outstanding and founder-supervised).
- Extension↔web live messaging exercised only via unit tests of both ends (the KV/handshake contract is tested; Chrome-channel E2E requires loading an unpacked extension in a controlled browser profile — done manually at first validation).
- `NEXT_PUBLIC_GHOAST_EXTENSION_ID` env var + production domain substitution in `manifest.json` are required before the assistant button lights up on production (manual mode works fully without it).
- Pause applies between actions (a mid-click halt is not interruptible) — conservative and honest.
- Manual driver "Pause" is not offered (manual pacing is inherently user-paced); copy says so.

## 5. First real validation protocol (5 accounts MAX)

1. Chrome profile you control → load unpacked `apps/extension/dist`.
2. Deploy/point GHOAST web or run locally; set `NEXT_PUBLIC_GHOAST_EXTENSION_ID`.
3. Create a batch of exactly 5 non-protected accounts you genuinely intend to unfollow.
4. Start the assistant; watch the entire session; confirm receipts land on `/cleanup`; confirm each shows `handled_self` (not verified).
5. Next day: fresh export → confirm reconciliation flips them to `handled_verified`.
6. Any challenge/rate-limit → confirm whole-session halt fired without further clicks.
