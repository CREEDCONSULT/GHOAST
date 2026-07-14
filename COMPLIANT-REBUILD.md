# Ghoast — Compliant Rebuild Plan

**Status:** In progress (branch `feat/compliant-export-rebuild`)
**Decision owner:** Claude (delegated), business direction confirmed by Dante Creed on 2026-07-13.

---

## Why this rebuild exists

The original architecture connected to Instagram by capturing each user's `sessionid`
cookie and driving Instagram's **private mobile API** (`i.instagram.com/api/v1`) to read
follower lists and to **auto-unfollow** accounts on the user's behalf, using a spoofed
Android app User-Agent and randomized delays explicitly designed to avoid bot detection.

That approach is not shippable as a real SaaS:

1. **It violates Instagram's Terms of Use** (automated private-API access + acting on the account via bot).
2. **It gets paying customers' accounts flagged/banned** — Instagram detects this exact fingerprint.
3. **It stores thousands of users' live Instagram session cookies** (full account access) server-side — a severe security & legal liability.
4. The **official Instagram Graph API does not expose follower/following lists at all**, so there is no compliant "just connect your account" path that yields this data.

## The compliant approach

**Data source:** Instagram's official **"Download Your Information"** export (the user's own
data, fully ToS-compliant). The user requests the export from Instagram, downloads it, and
uploads it to Ghoast. Ghoast parses it entirely server-side. **No session cookies, no
passwords, no private-API calls, no automation against Instagram.**

**Unfollowing:** Ghoast never unfollows on the user's behalf. Instead it produces a ranked,
organized **ghost list** and a **guided manual cleanup** flow — deep links straight to each
profile plus per-account progress tracking. The user does the taps; Ghoast does the intelligence.

### What the export gives us (and what it doesn't)

The export **does** contain, per account:
- `following.json` — everyone you follow (username + the timestamp you followed them)
- `followers_1.json` (+ `_2`, …) — everyone who follows you (username + timestamp)
- `close_friends.json` — your Close Friends list
- `liked_posts.json` — every post you liked (with the post owner's username)
- `post_comments_1.json` — comments you left
- `recently_unfollowed_profiles.json`, `pending_follow_requests.json`, etc.

The export **does not** contain, for the accounts you follow: their follower/following counts,
post recency, verification status, or account category. Those fed the old private-API scoring,
so the scoring is **redesigned** (below) around signals the export actually provides.

### Redesigned scoring (still 5 tiers, same colors)

`priorityScore` 0–100 → higher = stronger reason to KEEP (matches existing schema/tiers/colors).
Everyone in the ghost list already fails the follow-back test; scoring ranks *how much you
seem to want them anyway*:

| Dimension | Points | Source | Signal |
|-----------|-------:|--------|--------|
| Your engagement toward them | 0–45 | `liked_posts` + `post_comments` counts | You like/comment on their posts → you want to keep them |
| Close-friend / special list | 0–25 | `close_friends.json` | On your Close Friends list → strong keep |
| Follow recency | 0–20 | `following` timestamp | Just followed → give them time; followed long ago, still no follow-back → safe to cut |
| Reciprocity context | 0–10 | export cross-refs | e.g. recently-unfollowed-you context, mutual-list hints |

Tiers unchanged: 1 Safe to Cut (0–20) · 2 Probably Cut (21–40) · 3 Your Call (41–60) ·
4 Might Keep (61–80) · 5 Keep Following (81–100). Tier 5 stays auto-protected.
`engagementUnknown` is set when likes/comments were not included in the upload, so the UI can
say so honestly rather than fabricate a score.

## What is preserved from the existing codebase

- Auth (email/password, JWT), the whole DB schema (minor: session-token fields become nullable),
  billing/credits, the dashboard, ghost list UI, snapshots/tracking, tier colors & vocabulary.

## What is removed / neutralized

- `apps/api/src/lib/instagram.ts` private-API client (kept only as a stub / deleted)
- `unfollow.worker.ts` automated unfollow engine → replaced by manual-cleanup progress tracking
- Session-cookie capture on the connect page → replaced by the export-upload flow
- Queue timing/evasion config becomes irrelevant (kept out of the runtime path)

## Build phases

1. Data-export parser (tolerant, TDD) — the heart of the pivot
2. Redesigned scoring
3. Import service + `POST /api/v1/import` route + schema migration (nullable session fields)
4. Frontend: guided export-request + drag-and-drop upload
5. Auto-unfollow queue → guided manual cleanup
6. Verify (typecheck/lint/test/build) + deployment prep

See `HUMAN-INPUT-NEEDED.md` for the items only you can provide (keys, hosting, store).
