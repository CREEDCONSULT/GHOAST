# PLATFORM-COMPLIANCE.md — Ghoast App Store & Play Store Submission Guide

**Version:** 1.0
**Purpose:** Complete compliance reference for iOS App Store and Google Play Store submission. Read before beginning the mobile build.

---

## Payment Strategy — Critical Read First

**Ghoast uses the Netflix/Spotify model: ALL purchases happen on the web.**

The native mobile app contains NO in-app purchase flow. Users tap "Upgrade" → browser opens to `https://ghoast.app/billing`. The app is consumption-only for billing.

**Why this matters:**
- Apple requires IAP for any in-app digital purchase on iOS (App Store Review Guideline 3.1.1)
- Apple takes 30% (year 1) / 15% (after 12 months, Small Business Program) of IAP revenue
- Google takes 15% of Play Store IAP revenue (first $1M/year)
- Purchases made OUTSIDE the app on a website are exempt from this rule
- Precedent: Spotify, Netflix, Kindle, Patreon, and thousands of SaaS products use this model

**The rule:** The app must NOT have a "Buy" or "Subscribe" button that triggers a payment flow. It CAN have an "Upgrade" button that opens a browser to the website. It MUST NOT state pricing inside the app (to avoid Apple claiming the app is directing users away from IAP).

---

## Apple App Store — Submission Guide

### App Category

**Primary category: Utilities**
Do NOT submit under "Social Networking" — this triggers additional scrutiny on Instagram ToS compliance. "Utilities" is accurate (it's a follower management tool) and has a lower review bar.

### App Store Metadata

| Field | Value |
|-------|-------|
| App Name | Ghoast |
| Subtitle | Know who ghosted you |
| Category | Utilities |
| Age Rating | 4+ (no objectionable content) |
| Price | Free (no IAP in app) |

**App description — what to emphasise:**
- Follower analytics and management tool
- See who doesn't follow you back
- Priority ranking system to identify which accounts to cut
- Background queue for hands-free ghost removal
- Do NOT mention "automation" in store copy — use "queue" and "scheduled"

**Keywords (100 character limit):**
`ghost,followers,unfollow,instagram,ratio,tracker,analytics,clean,manage,audience`

### Apple Privacy Nutrition Label

Required under App Store Connect. Declare ALL data types Ghoast collects.

| Data Type | Collected | Linked to Identity | Used for Tracking | Notes |
|-----------|-----------|-------------------|-------------------|-------|
| Email address | Yes | Yes | No | Ghoast account registration |
| User ID | Yes | Yes | No | Ghoast user ID + Instagram user ID |
| Purchase history | Yes | Yes | No | Subscription/credit pack status |
| Product interaction | Yes | Yes | No | Feature usage (PostHog analytics) |
| Crash data | Yes | No | No | Sentry error reports |
| Performance data | Yes | No | No | API response times, scan performance |
| Identifiers (Device ID) | Yes | No | No | OneSignal push notification token |
| Sensitive info (Instagram session) | Yes | Yes | No | Session token — AES-256 encrypted, used solely to authenticate Instagram API calls |

**Important:** The Instagram session token must be declared as "Sensitive Information" linked to identity. Failure to declare it is grounds for rejection on review or post-launch removal.

**"Used for Tracking":** Ghoast does NOT sell data or use it for cross-app advertising. All data is used solely to provide the service. Answer "No" for tracking on all fields.

### App Review Notes (include with every submission)

Include these notes in the "App Review Information" section of App Store Connect. This prevents delays and rejections:

```
TEST ACCOUNT:
Email: review@ghoast.app
Password: [set a static test account]
Instagram: [connect a test Instagram account pre-loaded with ghost data]

APP NOTES FOR REVIEW:
- Ghoast is a follower analytics tool for Instagram users.
- It displays which accounts a user follows that do not follow them back ("ghosts"), ranked by a priority scoring algorithm.
- Instagram connection uses a session cookie method (not the official Meta API). Users are shown a full disclosure of this before connecting.
- No passwords are captured or stored. Only the session cookie (sessionid) is used, encrypted at rest.
- The bulk unfollow feature uses randomised delays (8-45 seconds between actions) and daily caps (150/day) to prevent Instagram rate limiting.
- All purchases (subscriptions, credit packs) are made at ghoast.app — there are no in-app purchases.
- The "Upgrade" button opens the user's browser to ghoast.app/billing.

KNOWN INSTAGRAM RESTRICTION:
The app uses Instagram's private API (same method used by many third-party Instagram tools). This technically violates Instagram's Terms of Service. Users are shown a disclosure and must accept before connecting. The app does not hide this.
```

### Common Rejection Reasons and Mitigations

| Rejection Reason | Mitigation |
|-----------------|------------|
| Guideline 5.2 — Intellectual Property (Instagram ToS) | Include ToS disclosure. Disclose use of private API in review notes. Submit under Utilities. |
| Guideline 3.1.1 — In-App Purchases | Ensure NO pricing is shown in-app. "Upgrade" button opens browser only. |
| Guideline 4.3 — Spam / Copycat | Ensure app name, icon, and design are original. Do not reference "Instagram" in the app name. |
| Missing Privacy Policy URL | Add Privacy Policy at ghoast.app/privacy BEFORE first submission. Required. |
| Missing account deletion flow | Settings screen must include "Delete Account" that calls DELETE /api/v1/users/me and wipes all data. |

### iOS App Review Timeline

- First submission: 24-48 hours (sometimes up to 7 days for new apps)
- Updates after first approval: typically 24-48 hours
- Expedited review (use for critical bugs): available via App Store Connect — use sparingly

---

## Google Play Store — Submission Guide

### App Category

**Category: Tools**
Do NOT use "Social" — same reason as iOS. "Tools" is the Play Store equivalent of "Utilities."

### Play Store Listing

| Field | Value |
|-------|-------|
| App Name | Ghoast |
| Short Description (80 chars) | See who ghosted your Instagram. Ranked, scored, cleared. |
| Category | Tools |
| Content Rating | Everyone |
| Price | Free |

### Google Data Safety Section

Required in the Play Store Console. Be accurate — false declarations are policy violations.

**Data collected and shared:**

| Data type | Collected | Shared | Encrypted in transit | User can delete |
|-----------|-----------|--------|---------------------|----------------|
| Email address | Yes | No | Yes (HTTPS) | Yes |
| User IDs | Yes | No | Yes (HTTPS) | Yes |
| Purchase history | Yes | No | Yes (HTTPS) | Yes |
| App activity (feature usage) | Yes | No | Yes (HTTPS) | Yes |
| Crash logs | Yes | No | Yes (HTTPS) | No (anonymised) |
| Device identifiers | Yes | No | Yes (HTTPS) | Yes |

**Security practices to declare:**
- Data encrypted in transit: Yes (TLS 1.2+)
- Data encrypted at rest: Yes (AES-256-CBC for session tokens, bcrypt for passwords)
- Users can request data deletion: Yes (Settings → Delete Account)
- App follows Families Policy: No
- Data collection is optional: No (email required for account)

### Account Deletion Flow — Required by Both Stores

Since November 2023 (Apple) and Q1 2024 (Google), both stores require apps with accounts to provide in-app account deletion.

**Required implementation:**

Settings screen → "Delete Account" button → confirmation dialog → calls:

```
DELETE /api/v1/users/me
Authorization: Bearer {token}
```

**What this endpoint must do:**
1. Delete all ghost records for this user
2. Delete all instagram_account records (encrypted tokens included)
3. Delete all queue_jobs records
4. Delete all snapshots
5. Delete all credit_transactions
6. Delete the user record itself
7. Cancel any active Stripe subscription (via Stripe API)
8. Send account deletion confirmation email

**Also required:** A web-based account deletion page at `ghoast.app/account/delete` — some users may not have the app installed when they want to delete.

### Google Play Review Timeline

- Initial review: 3-7 days (new apps go through enhanced review)
- Updates: 1-3 days
- Internal testing track → Closed testing → Open testing → Production (recommended release path)

---

## Privacy Policy Requirements

A privacy policy at a stable URL is required by both stores. Minimum required content:

1. What data is collected (email, Instagram session token, usage data)
2. How data is used (to provide the service)
3. How data is stored (AES-256 encrypted, hosted on [cloud provider])
4. How long data is retained (account data until deletion, snapshots 90 days Pro / indefinite Pro+)
5. Third parties with access (Stripe for payments, Sentry for errors, PostHog for analytics)
6. User rights (access, correction, deletion — GDPR/CCPA)
7. Contact email for privacy requests
8. Date last updated

**URL:** `https://ghoast.app/privacy`

---

## Instagram ToS Risk Assessment for Mobile

### Risk Level by Action

| Action | Risk Level | Notes |
|--------|-----------|-------|
| Displaying ghost list (read-only) | Low | No Instagram API calls |
| Running ghost scan | Medium | Multiple API calls — always server-side |
| Running bulk unfollow queue | Medium-High | Repeated actions — mitigated by delays and caps |
| Instagram WebView login | Medium | Blocked more frequently on mobile than web; use realistic UA |

### Mitigation Strategy

1. **All Instagram API calls are server-side** — the mobile app never calls Instagram directly. This is the single most important mitigation. Instagram cannot detect "app" behaviour because calls come from a server with a rotating IP (if needed).

2. **Realistic mobile user agent in WebView** — Use the exact UA string from a current iPhone Safari browser:
   ```
   Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1
   ```
   Update this with each major iOS release.

3. **Never mention "automation" in App Store copy** — use "queue", "scheduled", "background processing."

4. **ToS disclosure screen before any Instagram connection** — this is both a legal protection and an App Store review requirement. The disclosure must clearly state the app uses private Instagram API methods.

5. **Rate limits are enforced server-side** — even if a user tries to bypass limits via API calls, the server enforces daily caps.

6. **Incident response:** If users report Instagram account restrictions linked to Ghoast usage, the engineering team must be alerted immediately. Have a kill switch for the queue worker that can be flipped without a code deploy (feature flag in Redis or environment variable).

---

## App Store Account Requirements

### Apple Developer Account

- Cost: $99/year
- Required before ANY TestFlight or App Store submission
- Set up at: developer.apple.com
- Entity type: Individual or Organisation (Organisation requires D-U-N-S number — takes 1-2 weeks)
- Bundle ID to register: `app.ghoast.mobile`

### Google Play Developer Account

- Cost: $25 one-time fee
- Required before any Play Store submission
- Set up at: play.google.com/console
- Account type: Individual or Organisation
- Package name to register: `app.ghoast.mobile`

---

## Pre-Submission Checklist

### Both Stores
- [ ] Privacy policy live at `ghoast.app/privacy`
- [ ] Terms of service live at `ghoast.app/terms`
- [ ] Account deletion flow implemented (in-app + web)
- [ ] All data types accurately declared in privacy labels / data safety
- [ ] Test account created with pre-loaded ghost data for reviewers
- [ ] App icon provided in all required sizes
- [ ] Screenshots prepared for all required device sizes
- [ ] App description written without prohibited keywords ("automation", "bot")

### iOS Only
- [ ] Apple Developer account active ($99/year)
- [ ] Bundle ID `app.ghoast.mobile` registered in App Store Connect
- [ ] App Store Connect app record created
- [ ] TestFlight build uploaded and tested
- [ ] App Review notes prepared (see template above)
- [ ] Privacy Nutrition Labels completed in App Store Connect
- [ ] No in-app pricing displayed anywhere in the app
- [ ] Support URL provided (`ghoast.app/support`)
- [ ] Marketing URL provided (`ghoast.app`)

### Android Only
- [ ] Google Play Developer account active ($25 one-time)
- [ ] App created in Play Console with package `app.ghoast.mobile`
- [ ] Data Safety section completed accurately
- [ ] Content rating questionnaire completed (IARC rating)
- [ ] Internal testing track → Closed testing track → Open testing → Production
- [ ] Target API level meets current Google requirements (API 34+ for 2024 submissions)
- [ ] AAB (Android App Bundle) format used — not APK for production

---

## Post-Launch Compliance Monitoring

- Monitor App Store Connect and Play Console reviews weekly for mentions of account restrictions
- If any user reports an Instagram account ban linked to Ghoast: trigger incident response, consider temporarily disabling bulk queue
- Review Apple and Google policy change announcements quarterly — IAP rules and data privacy requirements evolve
- Re-review Privacy Nutrition Labels whenever a new data type is collected or a new third-party service is added
