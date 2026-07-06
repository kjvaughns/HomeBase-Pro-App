---
name: HomeBase safe-area insets convention
description: How top-of-screen bleed bugs happen in the homebase Expo app and where to look for them
---

`useScreenOptions.ts` defaults `headerTransparent: true` for the whole app, so
no screen gets automatic top padding from React Navigation. Every screen and
every globally-mounted absolute-positioned overlay must add its own top
offset via `useHeaderHeight()` (screens with a nav header) or
`useSafeAreaInsets().top` (custom-header or overlay components), combined
with the `Spacing.*` scale.

**Why:** This is an easy bug class because TypeScript won't catch a variable
that's computed (e.g. `const headerHeight = useHeaderHeight()`) but never
applied to a style — the bleed only shows up visually on-device. Also easy to
miss: global overlays mounted once at the app root (e.g. an offline banner or
error-fallback UI) don't get individual screen review, so hardcoded pixel
offsets (`top: 60`, `paddingTop: 120`) silently ship instead of dynamic
insets.

**How to apply:** When auditing for safe-area bleed, check three patterns
across the whole app, not just per-screen:
1. `useHeaderHeight()`/`useSafeAreaInsets()` called but the result variable is
   unused in any style (grep for the variable name after declaration).
2. Hardcoded magic-number `paddingTop`/`top` values on outermost
   containers or absolute-positioned elements, instead of
   `insets.top + Spacing.*`.
3. Global overlays rendered once in the root layout (banners, toasts, error
   fallbacks) — these bypass per-screen review and are easy to forget.

One caveat found in this codebase: an `ErrorBoundary` class component can sit
*outside* `SafeAreaProvider` in the provider tree (rendered as a sibling
above it), so its fallback UI cannot safely call `useSafeAreaInsets()` — it
would throw with no provider mounted. Fixing that requires reordering
providers, which is a separate, larger change from a normal insets fix.

**Double-counting is the opposite bug, and just as common:** `useHeaderHeight()`
already bakes in `insets.top` whenever a header exists anywhere in the
ancestor navigator chain (stack or tab) — confirmed via
`@react-navigation/elements` `Screen.tsx` source. Writing
`headerHeight + insets.top` on the same container over-pads (found in
SubscriptionScreen and ReviewsScreen). Never add both raw; use one or the
other, or use the guardrail hook below.

**Guardrail hook:** `artifacts/homebase/hooks/useTopInset.ts` exposes
`useTopInset(extra?)` = `Math.max(useHeaderHeight(), useSafeAreaInsets().top) + extra`.
This is safe whether or not a header exists in the ancestor chain (header
present → headerHeight already covers insets.top; no header anywhere above,
e.g. a tab screen configured with `headerShown: false` → headerHeight falls
back to 0 and insets.top wins). Prefer this hook over manually combining
`headerHeight`/`insets.top` in new top-padding code so screens stay correct
if a header gets added/removed later in the navigator tree.
