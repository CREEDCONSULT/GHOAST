# GHOAST Companion (Chrome extension, MV3)

**Execution adapter only.** GHOAST Core (the web app) remains the source of selected usernames and relationship evidence; Instagram remains authoritative for actual account state; this extension is a user-started one-action-at-a-time clicker that reports receipts back.

## Threat model / invariants

- Host permissions: only `https://www.instagram.com/*` and the GHOAST app domain (`https://ghoast.up.railway.app/*`).
- Permissions: `tabs`, `storage` — **no `cookies`, no `scripting`, no `activeTab` scraping, no `webRequest`**.
- Never reads/transmits passwords, cookies, session tokens, DMs, posts, or unrelated page data. Static audit: `grep -R "cookie\|sessionid" src/` must match only this README's negations.
- Login detection is presence/absence of the login form (DOM state), never credential extraction.
- Accepts commands only from `externally_connectable` origins listed in `manifest.json` AND validated again in `src/protocol.ts` (`unauthorized_origin`).
- One unfollow at a time, on an explicit user-started session, with ≥20s randomized pacing. Immediate whole-session halt on challenge / checkpoint / rate-limit / login-required / unexpected modal / ambiguous controls.
- No CAPTCHA bypass, no anti-bot evasion, no stealth, no proxy rotation, nothing hidden.

## Build & test

```bash
npm install          # from repo root (workspace)
npm run test:unit --workspace=apps/extension
npm run build --workspace=apps/extension   # → dist/ (load unpacked in chrome://extensions)
```

## First real validation

**Maximum 5 accounts**, on an account you own, during a calm usage period, watching the tab the whole time. Stop conditions are automatic, but you are the final safety net.
