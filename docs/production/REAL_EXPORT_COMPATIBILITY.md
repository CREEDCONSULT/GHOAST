# GHOAST — Real Export Compatibility Report

**Date:** 2026-10-05 · **Adapter:** `dyi-2024-json` + real-world patch (see below)
**Method:** three genuine Instagram DYI exports found on the development machine were parsed with the production adapter logic; results recorded below. No usernames or relationship data were recorded or transmitted during validation — structure and counts only.

## Real samples validated

| Sample | Size | Contents | Result |
|---|---|---|---|
| `instagram-*-2026-07-14.zip` (full export incl. media) | 911 MB, 1102 entries | `connections/followers_and_following/` JSON lists + full media/posts | ✅ Supported — 106 followers, following list parsed; only the two needed lists are decompressed; media ignored |
| `instagram-*-2026-07-15.zip` (connections-only) | 9.5 MB | JSON; 295 followers / 3,104 following | ✅ Supported |
| `instagram-*-2026-07-15.zip` (second request, same day) | 16.4 MB | JSON | ✅ Supported |

**Timed:** the 3,104-following export parses in well under 1s; a synthetic 10k-relationship export completes <8s in the worst jsdom environment (unit-tested).

## REAL-WORLD FORMAT DRIFT FOUND (and fixed, 2026-10-05)

Two variances vs. the structure assumed in the first build:

1. **Path prefix:** real exports nest lists under `connections/followers_and_following/`, not bare `followers_and_following/`. Adapter matches by substring — unaffected.
2. **`following.json` entries omit `value`** — the username lives in the parent item's **`title`**; `string_list_data` carries only `href` + `timestamp`. The original adapter required `value` and would have parsed **zero following entries for every real export** (→ "incomplete export" error for 100% of real users). **Fixed**: `collectEntries` falls back to `title`. Guarded by regression test + the real-export suite.
3. Followers entries keep `title: ''` + `value` — both shapes coexist in the same export. Handled.

Had this phase been skipped, launch would have had a **100% first-upload failure rate**.

## Compatibility matrix

| Structure / condition | Status | Parser behavior | Confidence |
|---|---|---|---|
| JSON export, 2026 shape (connections/, title-based following) | ✅ Supported | full parse | High (3 real samples + regression tests) |
| JSON export, documented older shape (bare `followers_and_following/`, followers `[]` top-level, following under `relationships_following`, `value`-based) | ✅ Supported | full parse (also validated — synthetic fixtures mirror both shapes) | High |
| Split followers (`followers_1.json`, `followers_2.json`…) | ✅ Supported | merged + deduped | High (unit + real) |
| HTML-format export | ⚠️ Unsupported by design | typed `html_export` error → step-by-step re-request guidance | High (unit + e2e) |
| Corrupt/uninflatable ZIP | ✅ Handled | `not_zip` error + retry guidance | High (unit) |
| Valid ZIP, no export structure (e.g. photos.zip) | ✅ Handled | `wrong_file` error naming the actual filename | High (unit) |
| Missing both lists | ✅ Handled | `missing_lists` error | High (unit) |
| Only one list present (partial export) | ⚠️ Unsupported by design | `incomplete` error with repair steps (ghosts need both lists; spec §22 "partial mode" was logically impossible — see ENGINEERING-LOG §4) | High |
| Empty-but-valid lists (zero relationships) | ✅ Supported | zero-count snapshot → Board celebration state | High (unit) |
| All list files corrupt JSON | ✅ Handled | `empty_lists` error (distinguished from valid-empty) | High (unit) |
| Duplicate upload (same bytes) | ✅ Handled | SHA-256 match → "already scanned" dialog, view/scan-anyway | High (unit + e2e) |
| Stale export (>30 days old) | ✅ Handled | non-blocking SH-2 notice with use-anyway/get-fresh | Medium (UI path; not e2e-covered — `File.lastModified` is not spoofable via `setInputFiles`) |
| Interrupted processing (refresh mid-parse) | ⚠️ Implemented, untested in browser | `pendingJobFileName` resume prompt on next visit | Medium |
| Locale/date variants | ✅ N/A | timestamps are epoch seconds — locale-independent by construction | High |
| Missing timestamps on some entries | ✅ Supported | entry accepted, band shows "date unknown" | High (unit) |
| Case-variant usernames across scans | ✅ Supported | case-insensitive keys everywhere | High (unit) |
| Oversized ZIP (>2GB) | ✅ Handled | rejected pre-read | High (unit) |
| Malicious href (`javascript:` etc.) | ✅ Sanitized | non-https-instagram hrefs fall back to derived URL | High (unit) |
| Very large accounts (10k+ relationships) | ✅ Supported | parse <8s; lists render progressively (200+500 batched) | Medium-High (unit benchmark; not device-profiled) |

## Remaining unknowns → first-user validation plan must capture

- Meta sub-format variants not yet observed (e.g. other `relationships_*` wrappers, future drift). Adapter is versioned (`dyi-2024-json+real-2026`); add opt-in "weird export" sampling telemetry before scaling (see ANALYTICS_SCHEMA.md — not yet allowed by policy; flagged as required-for-v1.1).
- HTML exports beyond the observed skeleton (repair guidance assumed correct).
- `File.lastModified` reliability across browser/OS for stale detection (some platforms report download time, not export time — harmless: worst case is a spurious soft notice).

**Confidence overall: HIGH for JSON-format DYI exports as of 2026-10-05.** Recommend a replay of this matrix against fresh real exports after each Meta export-UI change cycle (~quarterly), per spec §26.2 adapter-versioning guidance.
