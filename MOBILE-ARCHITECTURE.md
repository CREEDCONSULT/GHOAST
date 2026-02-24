# MOBILE-ARCHITECTURE.md — Ghoast React Native / Expo Architecture

**Version:** 1.0 | Companion to TECH-STACK.md
**Purpose:** Complete mobile app specification for the `apps/mobile/` package. Read TECH-STACK.md first.

---

## Mobile Stack Summary

| Layer | Technology |
|-------|-----------|
| Framework | React Native (via Expo Managed Workflow) |
| Router | Expo Router v3 (file-based, mirrors Next.js App Router) |
| Build service | EAS Build (cloud — no local Xcode/Android Studio required) |
| OTA updates | Expo Updates (JS-layer changes bypass App Store review) |
| Token storage | expo-secure-store (iOS Keychain / Android Keystore) |
| Push notifications | OneSignal (unified FCM + APNs) |
| WebView (Instagram login) | react-native-webview |
| HTTP client | fetch (built-in) + custom API client wrapper |
| State management | Zustand (lightweight, same as web preference) |
| Charts | react-native-gifted-charts |
| Typography | @expo-google-fonts/outfit + @expo-google-fonts/dm-mono |

---

## Monorepo Structure

```
ghoast/
├── apps/
│   ├── web/              ← Next.js (existing)
│   ├── api/              ← Fastify backend (existing)
│   └── mobile/           ← React Native + Expo (this document)
│       ├── app/          ← Expo Router screens (file-based)
│       │   ├── _layout.tsx           ← Root layout (fonts, auth gate)
│       │   ├── index.tsx             ← Redirect to /auth or /dashboard
│       │   ├── (auth)/
│       │   │   ├── _layout.tsx       ← Auth stack layout
│       │   │   ├── login.tsx         ← Ghoast email/password login
│       │   │   ├── register.tsx      ← Account creation
│       │   │   └── connect.tsx       ← Instagram WebView connection
│       │   └── (app)/
│       │       ├── _layout.tsx       ← Bottom tab layout (authenticated)
│       │       ├── dashboard.tsx     ← Stats overview (followers/ghosts/ratio)
│       │       ├── ghosts/
│       │       │   ├── index.tsx     ← Ghost list (all tiers)
│       │       │   └── [id].tsx      ← Ghost detail (profile preview)
│       │       ├── queue.tsx         ← Bulk unfollow queue status
│       │       └── settings.tsx      ← Account settings, billing link
│       ├── components/
│       │   ├── GhostRow.tsx          ← Ghost list row (photo, handle, tier badge, score)
│       │   ├── TierBadge.tsx         ← Tier colour badge component
│       │   ├── QueueStatus.tsx       ← Live queue countdown card
│       │   ├── RatioChart.tsx        ← 30-day line chart (react-native-gifted-charts)
│       │   ├── TierFilterTabs.tsx    ← Horizontal tier filter tabs
│       │   ├── UpgradePrompt.tsx     ← Paywall modal (links to ghoast.app/billing)
│       │   └── ui/                   ← Primitives (Button, Card, Badge, Input)
│       ├── lib/
│       │   ├── api.ts                ← API client (base URL + auth headers)
│       │   ├── auth.ts               ← SecureStore token management
│       │   ├── notifications.ts      ← OneSignal setup
│       │   └── store.ts              ← Zustand global state
│       ├── constants/
│       │   └── tiers.ts              ← Imports from packages/design-tokens
│       ├── app.json                  ← Expo app config
│       ├── eas.json                  ← EAS Build profiles
│       └── package.json
├── packages/
│   ├── db/               ← Shared DB schema (existing)
│   └── design-tokens/    ← Shared colours, tiers, spacing (new)
│       └── src/
│           └── index.ts  ← Consumed by both web and mobile
└── package.json          ← Workspace root
```

---

## Screen Map

### Auth Flow (unauthenticated)

| Screen | File | Description |
|--------|------|-------------|
| Login | `(auth)/login.tsx` | Ghoast email + password. JWT stored via SecureStore on success. |
| Register | `(auth)/register.tsx` | Name, email, password. Auto-login on success. |
| Connect Instagram | `(auth)/connect.tsx` | ToS disclosure + react-native-webview Instagram login. Session cookie captured server-side. |

### Main App (authenticated — Bottom Tab Navigator)

| Tab | File | Description |
|-----|------|-------------|
| Dashboard | `(app)/dashboard.tsx` | Stat cards (followers, following, ghosts, ratio). 30-day ratio chart. Last scanned timestamp. Rescan button. |
| Ghosts | `(app)/ghosts/index.tsx` | Ghost list with tier filter tabs. FlatList with GhostRow components. Search bar. Manual unfollow per row. |
| Queue | `(app)/queue.tsx` | Queue status card (position, countdown, % complete). Select tiers. Start/pause queue. Queue history (last 30 days). |
| Settings | `(app)/settings.tsx` | Connected Instagram account. Billing (opens ghoast.app/billing in browser). Sign out. Delete account. |

### Bottom Tab Structure

```
[ Dashboard ]  [ Ghosts ]  [ Queue ]  [ Settings ]
```

- Icons: use `@expo/vector-icons` (Ionicons set)
- Active tab uses `--violet` (#7B4FFF)
- Tab bar background: `--slate` (#111120)
- No custom header — each screen manages its own header via Expo Router

---

## Authentication — Mobile Implementation

### Token Storage

```typescript
// lib/auth.ts
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'ghoast_access_token';
const REFRESH_TOKEN_KEY = 'ghoast_refresh_token';

export async function saveTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
```

### API Client

```typescript
// lib/api.ts
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './auth';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL; // e.g. https://api.ghoast.app

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Platform': 'mobile',          // tells API to return refresh token in body
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Attempt token refresh
    const refreshed = await refreshTokens();
    if (!refreshed) {
      await clearTokens();
      // Trigger re-auth (handled by root _layout.tsx auth gate)
      throw new Error('SESSION_EXPIRED');
    }
    return request<T>(path, options); // retry once
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'API_ERROR');
  }

  return response.json();
}

async function refreshTokens(): Promise<boolean> {
  const refresh = await getRefreshToken();
  if (!refresh) return false;

  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Platform': 'mobile' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) return false;
    const { accessToken, refreshToken } = await res.json();
    await saveTokens(accessToken, refreshToken);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
```

### API Auth Endpoint — Platform-Aware Response

The `/api/v1/auth/login` and `/api/v1/auth/refresh` endpoints check the `X-Platform` header:

```javascript
// apps/api/routes/auth.js
const isMobile = req.headers['x-platform'] === 'mobile';

if (isMobile) {
  // Return refresh token in body — mobile stores in SecureStore
  return res.send({ accessToken, refreshToken, user });
} else {
  // Set httpOnly cookie — web handles it transparently
  res.setCookie('refreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'strict' });
  return res.send({ accessToken, user });
}
```

---

## Instagram WebView Session Capture — Mobile

```typescript
// app/(auth)/connect.tsx
import { WebView } from 'react-native-webview';
import { api } from '@/lib/api';

const INSTAGRAM_LOGIN_URL = 'https://www.instagram.com/accounts/login/';
const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

export default function ConnectScreen() {
  async function handleNavigationChange(navState: { url: string; title: string }) {
    // Detect successful Instagram login by URL change to home
    if (navState.url.includes('instagram.com') && !navState.url.includes('/accounts/login')) {
      // Signal server to extract session cookie from the authenticated webview
      // The session cookie is captured server-side — never exposed to mobile client
      await api.post('/api/v1/accounts/connect-mobile', {
        // Server uses its own cookie extraction from the shared webview session
      });
    }
  }

  return (
    <WebView
      source={{ uri: INSTAGRAM_LOGIN_URL }}
      userAgent={USER_AGENT}
      onNavigationStateChange={handleNavigationChange}
      sharedCookiesEnabled={true}
      thirdPartyCookiesEnabled={true}
    />
  );
}
```

**Note:** All Instagram API calls happen server-side. The mobile app NEVER calls Instagram directly. This keeps the detection surface minimal and the session token off the device.

---

## Push Notifications — Mobile Setup

```typescript
// lib/notifications.ts
import OneSignal from 'react-native-onesignal';

export function initNotifications(userId: string) {
  OneSignal.initialize(process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID!);
  OneSignal.login(userId);                    // Link push token to Ghoast user
  OneSignal.User.addTag('user_id', userId);   // For server-side targeting
  OneSignal.Notifications.requestPermission(true); // Prompt for permission
}

export function cleanupNotifications() {
  OneSignal.logout();
}
```

```typescript
// app/_layout.tsx — call after auth
import { initNotifications } from '@/lib/notifications';
import { useAuthStore } from '@/lib/store';

export default function RootLayout() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user) initNotifications(user.id);
  }, [user?.id]);

  // ...
}
```

### Push Notification Event Handlers

```typescript
// lib/notifications.ts (continued)
export function registerNotificationHandlers() {
  // Foreground: show in-app alert
  OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event) => {
    event.preventDefault(); // prevent auto-display
    // Show custom in-app banner
    showInAppBanner(event.notification.title, event.notification.body);
    event.notification.display();
  });

  // Background tap: navigate to relevant screen
  OneSignal.Notifications.addEventListener('click', (event) => {
    const { screen } = event.notification.additionalData as { screen?: string };
    if (screen === 'queue') router.push('/(app)/queue');
    if (screen === 'dashboard') router.push('/(app)/dashboard');
  });
}
```

---

## EAS Build Configuration

```json
// apps/mobile/eas.json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "android": { "buildType": "apk" }
    },
    "production": {
      "ios": { "buildConfiguration": "Release" },
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_APPLE_ID",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

```json
// apps/mobile/app.json (key sections)
{
  "expo": {
    "name": "Ghoast",
    "slug": "ghoast",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "ghoast",
    "splash": {
      "image": "./assets/splash.png",
      "backgroundColor": "#080810"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "app.ghoast.mobile",
      "infoPlist": {
        "NSCameraUsageDescription": "Not used",
        "NSPhotoLibraryUsageDescription": "Not used"
      }
    },
    "android": {
      "package": "app.ghoast.mobile",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#080810"
      }
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "react-native-webview",
      ["onesignal-expo-plugin", { "mode": "production" }]
    ],
    "extra": {
      "eas": { "projectId": "YOUR_EAS_PROJECT_ID" }
    }
  }
}
```

---

## OTA Update Strategy

Expo Updates allows shipping JS-only changes without App Store review (typically 24-72h delay).

**What can ship via OTA:**
- Bug fixes in React components
- Copy changes
- Ghost scoring logic changes (if logic moves to API, this is moot)
- UI tweaks, style updates

**What requires a full store build + review:**
- Native module changes (adding a new Expo plugin)
- app.json config changes (permissions, bundle ID, etc.)
- Changes to `eas.json`

**OTA release in EAS:**
```bash
eas update --branch production --message "fix: ghost list sort order"
```

---

## Mobile Environment Variables

Add to `apps/mobile/.env`:

```
EXPO_PUBLIC_API_URL=https://api.ghoast.app
EXPO_PUBLIC_ONESIGNAL_APP_ID=your-onesignal-app-id
```

**Note:** Variables prefixed `EXPO_PUBLIC_` are bundled into the app and visible in the client. Never put secrets here. All secrets (encryption keys, Stripe keys, Instagram session tokens) stay in `apps/api/.env` only.

---

## Key Mobile Packages

```json
{
  "dependencies": {
    "expo": "~51.0.0",
    "expo-router": "~3.5.0",
    "expo-secure-store": "~13.0.0",
    "expo-updates": "~0.25.0",
    "react-native": "0.74.x",
    "react-native-webview": "^13.0.0",
    "react-native-onesignal": "^5.0.0",
    "onesignal-expo-plugin": "^2.0.0",
    "react-native-gifted-charts": "^1.3.0",
    "zustand": "^4.5.0",
    "@expo-google-fonts/outfit": "^0.2.3",
    "@expo-google-fonts/dm-mono": "^0.2.3",
    "@expo/vector-icons": "^14.0.0"
  }
}
```

---

## Mobile Build Commands

```bash
# Development
cd apps/mobile
npx expo start                    # Start dev server (Expo Go or dev client)
npx expo start --ios              # iOS simulator
npx expo start --android          # Android emulator

# EAS builds
eas build --platform ios --profile preview     # TestFlight build
eas build --platform android --profile preview # APK for testing
eas build --platform all --profile production  # Production store build

# Submit to stores
eas submit --platform ios         # Submit to App Store Connect
eas submit --platform android     # Submit to Google Play

# OTA update (JS only, no review needed)
eas update --branch production --message "fix: ..."
```

---

## Navigation Structure

```
Root Stack
├── (auth) — Stack Navigator (no tab bar)
│   ├── login
│   ├── register
│   └── connect  ← Instagram WebView
└── (app) — Bottom Tab Navigator
    ├── dashboard
    ├── ghosts (nested stack)
    │   ├── index   ← Ghost list
    │   └── [id]    ← Ghost detail
    ├── queue
    └── settings
```

Auth gate lives in `app/_layout.tsx` — checks SecureStore for a valid access token. If absent, redirects to `/(auth)/login`. If present but expired, attempts refresh via `lib/auth.ts`. If refresh fails, clears tokens and redirects to login.

---

## Design Notes for Mobile

All colour tokens come from `packages/design-tokens/src/index.ts`. Do not hardcode hex values in component files.

**Native equivalents for web patterns:**
- `button` → `Pressable` with `onPressIn`/`onPressOut` opacity animation
- `flex layout` → React Native `View` with `flexDirection`
- `overflow-y: scroll` → `ScrollView` or `FlatList`
- Ghost list → always `FlatList` (not `ScrollView`) — handles virtualization for 5,000 items
- `position: fixed` (bottom nav) → Expo Router Bottom Tabs handles this natively
- CSS `@keyframes` → `react-native-reanimated` `useAnimatedStyle`

**Typography:**
```typescript
import { useFonts } from 'expo-font';
import { Outfit_400Regular, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { DMMono_400Regular } from '@expo-google-fonts/dm-mono';
```

All numeric values (scores, counts, timestamps) use DM Mono. All body and UI text uses Outfit.
