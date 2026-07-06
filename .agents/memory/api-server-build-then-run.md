---
name: api-server dev script is build-then-run, not a live server
description: Why backend code changes don't show up in curl/API responses until the API Server workflow is restarted.
---

The `artifacts/api-server` `dev` script runs `pnpm run build && pnpm run start` — it bundles once with esbuild into `dist/index.mjs` and runs that bundle. It is NOT a watch-mode dev server (no tsx/nodemon reload).

**Why:** After editing server code (e.g. `storage.ts`), the running process keeps serving the old bundled `dist/` output. A curl/API test can look like a bug (missing field, old behavior) when the real cause is just a stale build.

**How to apply:** Whenever you change code under `artifacts/api-server/src/` and want to verify behavior via curl or the app, restart the `artifacts/api-server: API Server` workflow first — otherwise you're testing against stale compiled output.
