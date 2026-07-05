---
name: api-server pre-existing TypeScript error baseline
description: routes.ts has a large, pre-existing baseline of TS errors unrelated to any single change; how to tell your edit didn't add new ones.
---

`pnpm exec tsc --noEmit` in `artifacts/api-server` reports ~1600 errors on a clean checkout, dominated by two systemic, pre-existing patterns repeated across hundreds of route handlers (not caused by any specific feature work):

- `TS2769: No overload matches this call` / `Request<IdParams, ...>` vs `Request<ParamsDictionary, ...>` mismatches — every route using the `assertProviderOwnership`/typed-`IdParams` handler pattern trips this the same way.
- `TS7030: Not all code paths return a value` — recurring across handlers that mix `return res.status(...)` with bare `res.json(...)` at the end.

Plus unrelated noise in `src/scripts/*.ts`, `storage.ts`, `stripeClient.ts`, `stripeConnectService.ts` (old Stripe API version pins, nullable-vs-required field mismatches).

**Why:** Without a baseline, it's easy to mistake "this file has errors" for "my change broke something." Re-check the current count if it's been a while — the baseline drifts as the codebase changes, but the two dominant patterns above are structural and persist until someone fixes the shared handler pattern.

**How to apply:** After editing `routes.ts` or `stripeConnectService.ts`, don't judge by total error count. Instead `grep` the tsc output for the specific line numbers/symbols you touched (e.g. new route path, new function name) and confirm no *new* error references them. If your new code follows the same handler pattern as existing neighbors, it will inherit the same class of pre-existing error — that's expected, not a regression.
