# GHOAST — Analytics Schema (privacy-safe)

**Date:** 2026-10-05 · **Position:** product-funnel telemetry only, OPT-IN (Settings → Analytics, default OFF), event-level, anonymous, first-party relay.

## Transport & enforcement

```
browser → POST /api/analytics (same-origin; CSP connect-src 'self' allows) 
        → whitelist validation (event name + prop key/type) 
        → PostHog capture (only if POSTHOG_API_KEY configured; else 204 accept-and-drop)
```

- Unknown event names → **400**. Unknown/non-scalar props → stripped.
- `distinct_id` = random UUID stored in local settings (regenerable; deleted by Delete-everything; never tied to any account or Instagram identity).
- Client `track()` is a silent no-op when the user has not opted in.

## Event taxonomy (the ONLY allowed events)

| Event | Fired when | Allowed props |
|---|---|---|
| `landing_view` | landing page mounts | — |
| `export_guide_open` | guide page mounts | — |
| `upload_start` | analysis begins | — |
| `upload_error` (distinct from success funnel) | parse/validation fails | `error_code` (taxonomy string only — never filename or contents) |
| `upload_complete` | ingest succeeded | `counts_following`, `counts_ghosts`, `duration_ms_bucket` (`under_1s`/`1_3s`/`3_8s`/`over_8s`) |
| `analysis_complete` | same moment; kept separable for funnel granularity vs future pre-upload analysis | `counts_ghosts` |
| `triage_start` | a non-empty review deck is shown | — |
| `cleanup_queue_open` | activity/queue screen mounts | — |
| `reconciliation_complete` | a scan with a previous snapshot completes | `reconciled_verified`, `still_present` (counts only) |
| `comparison_view` | a comparison detail renders | — |
| `paywall_view` | paywall sheet opens | — |
| `checkout_start` | user continues to Stripe | `interval` (monthly/annual) |
| `checkout_complete` | Stripe verification grants plus | `plan` |

## Explicitly forbidden (enforced by whitelist; listed so no one "adds just one more")

Usernames, follower/following lists, any single relationship, archive bytes, file names, file hashes, Instagram user IDs, profile URLs, timestamps of individual relationships, IP-derived anything, emails, Stripe customer IDs in analytics events.

## Founder actions

1. Create a PostHog project (or self-host); set `POSTHOG_API_KEY`, optionally `POSTHOG_HOST`.
2. Nothing else — relay excludes everything else by construction.
