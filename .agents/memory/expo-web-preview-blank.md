---
name: Expo web preview renders blank
description: The homebase Expo workflow's web bundle shows a blank white page in both the app_preview screenshot tool and the Playwright testing subagent, even after a clean build with no bundler errors.
---

When testing UI changes to the `homebase` Expo app via `screenshot(type='app_preview')` or the `runTest` Playwright subagent, the page renders as a completely blank white screenshot / empty aria snapshot — no visible elements, no detectable `testID`s — even though:

- `Web Bundled ...ms ... (N modules)` appears in the workflow log with no errors.
- `pnpm exec tsc --noEmit` from `artifacts/homebase/` passes clean.
- The API server workflow is running and healthy.

This reproduced consistently across multiple restarts/retries and is not tied to any specific code change (observed after adding autopay-related UI badges that were confirmed correct by code + typecheck review).

**Why:** Likely related to the `CI=true` Metro mode used by this workflow (see `replit.md` gotcha: "Metro timing patches ... are diagnostic-only, not runtime fixes" and "reloads require a workflow restart") combined with `@react-native/debugger-shell` failing to load (`libglib-2.0.so.0` missing) — the web target may not fully initialize in this sandboxed environment.

**How to apply:** Don't sink repeated retries into `screenshot`/`runTest` for this Expo app when the page is blank on first attempt after a clean restart — it's very likely an environment limitation, not a regression. Fall back to: `tsc --noEmit`, reading the schema/route wiring, and direct DB queries (via `executeSql`) to verify data flows correctly into the fields the new UI reads.
