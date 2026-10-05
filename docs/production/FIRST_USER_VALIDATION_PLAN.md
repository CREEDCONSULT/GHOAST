# GHOAST — First-User Validation Plan (20–50 users)

**Date:** 2026-10-05 · **Goal:** prove the trust loop works with real users on real exports before any spend on growth.

## Recruiting

20–50 participants; skew mobile-first, 500–10k following. Sources: founder's network, r/Instagram, privacy-tool communities (people who refuse credential apps — they are the sharpest critics and the best referrers).

## Instrumentation

All metrics come from the opt-in analytics schema (ANALYTICS_SCHEMA.md) + a 6-question post-session micro-survey. Nothing user-identifying is collected. Participants are told analytics are off unless they opt in — and we watch what they **do**, not who they follow.

## Funnel gates (pass/fail before scaling)

| Gate | Metric | Pass threshold |
|---|---|---|
| 1. Onboarding completion | `landing_view` → `/upload` reached | ≥ 70% |
| 2. Successful upload | `upload_start` → `upload_complete` | ≥ 90% (below → parser compat crisis; see REAL_EXPORT_COMPATIBILITY.md) |
| 3. Analysis comprehension | board → `triage_start` | ≥ 50% |
| 4. Triage usage | ≥10 card decisions per engaged session | ≥ 40% of engaged |
| 5. Cleanup action | `triage_start` → `cleanup_queue_open` | ≥ 25% |
| 6. GHOAST+ interest | `paywall_view` → `checkout_start` | ≥ 5% directional; `checkout_complete` any > 0 validates the flow |
| 7. Parser failures | `upload_error` codes distribution | no code > 10% of starts without immediate remediation |
| 8. Trust | survey: "Did you believe your file stayed on-device?" (1–5) | median ≥ 4; all objections logged verbatim |
| 9. Return | second scan within 14 days (`reconciliation_complete`) | ≥ 3 users |
| 10. NPS-ish | "Would you be annoyed if this disappeared?" | ≥ 30% "very" |

## Session protocol (45 min, moderated or self-guided with sheet)

1. Landing cold-read: "What does this do? Would you give it your Instagram password?" (Expected answer: password never asked.)
2. Have them get a real export (or hand them a fresh one pre-requested 24h earlier — Meta latency is the real friction; measure it).
3. Upload → board. Watch for: confusion at file picker, HTML-format selection, stale-file notice.
4. Review 15 cards. Watch for: verb comprehension (Keep vs Later), undo discovery, pacing sheet reaction.
5. Open one profile, unfollow, return → confirm. Watch: did they trust "marked as unfollowed — we'll verify"?
6. Show history gate + paywall. Ask willingness-to-pay cold, then with comparison demo data.
7. Settings → Delete everything. Confirm they believe it.

## Support/issue capture

- Every `upload_error` code + user's export date/format (collected manually in-session, never by telemetry).
- Objection log template: `[timestamp, screen, verbatim quote, severity]`.
- Any "I thought it would unfollow for me" comment is a CRITICAL copy bug — escalate to UX/trust pass.

## Exit criteria

- Gates 1–4 pass → proceed to soft launch.
- Gate 2 < 90% → parser remediation sprint before anything else.
- Gate 8 median < 4 → trust-copy iteration before spend.
