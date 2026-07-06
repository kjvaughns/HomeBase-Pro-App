---
name: RevenueCat "configured" must be a real boolean, not a resolved promise
description: Why awaiting the RevenueCat configure() promise is not proof it's safe to call native SDK/UI methods, and how that caused an uncatchable native crash.
---

A `configurePromise` (or any "setup" promise) resolving does not mean the
underlying work actually happened — it can resolve early from guard clauses
(missing API key, native module failed to load) without ever performing the
real setup call.

**Why:** In HomeBase's paywall, `waitForConfiguration()` awaited a promise
that could resolve successfully even when `Purchases.configure()` was never
called (e.g. missing `EXPO_PUBLIC_REVENUECAT_API_KEY`). The caller then
invoked `RevenueCatUI.presentPaywall()`, which — like many native SDKs that
hold an internal singleton — crashes at the native layer (below the JS
bridge) if the SDK's `configure()` was never actually run. A JS `try/catch`
around the call cannot intercept this; it is not a JS exception.

**How to apply:** For any SDK with an explicit `configure()`/`init()` step
gating other native calls, track success with an explicit boolean flag set
*only* inside the success branch of the real setup call (never in early-exit
guard clauses), and expose a synchronous `isConfigured()` check. Every
function that calls into the native SDK — not just the "main" one — must
check this flag before proceeding, since any of them can independently
trigger the same class of crash.
