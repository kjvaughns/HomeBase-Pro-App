---
name: expo-notifications web crash
description: expo-notifications' NotificationsEmitter.js crashes at module level on web; fix with .web.ts no-op stubs.
---

## Rule
Any hook or module that imports `expo-notifications` needs a `.web.ts` platform stub, or the entire lazy-load chain crashes on web with a blank screen.

**Why:** `expo-notifications/build/NotificationsEmitter.js` line 5 calls `new LegacyEventEmitter(NotificationsEmitterModule)` at **module level** (not inside a function). `NotificationsEmitterModule` is `null` on web. The `LegacyEventEmitter` constructor throws immediately, which rejects the dynamic import for `RootStackNavigator` → `app/index.tsx` lazy route → blank white screen.

**How to apply:** Create a `.web.ts` sibling for any file that imports `expo-notifications`. Metro's platform-extension resolution (`file.web.ts` > `file.ts`) automatically substitutes it for web builds. The stub only needs to export the same surface as what consumers import — no-op implementations are sufficient.

## Current stubs
- `artifacts/homebase/hooks/usePushNotifications.web.ts` — `export function usePushNotifications() {}`
- `artifacts/homebase/lib/analytics.web.ts` — no-op exports for `initAnalytics`, `trackEvent`, `identifyUser`, `resetAnalytics`, `AnalyticsEvents` (posthog-react-native prevention)

## Diagnostic signal
Bundle drops from **2107 → 1883 modules** when the stubs are in place. The missing ~224 modules are the `expo-notifications` chain that was previously being pulled in.
