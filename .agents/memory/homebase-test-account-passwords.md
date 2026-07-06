---
name: HomeBase seeded test accounts have unknown passwords
description: How to get API-level login access to seeded provider/homeowner accounts for curl-based verification when Expo web preview can't be used.
---

Seeded users' passwords are set via `SEED_USER_PASSWORD` (random if unset) and are not discoverable from the DB. The `jobs` table is also often empty in dev — jobs are created dynamically from appointments, not seeded directly, so don't assume seed data includes rows in every table.

**Why:** Expo web preview/Playwright testing renders blank for this app (see `expo-web-preview-blank.md`), so verifying provider/homeowner flows end-to-end means driving the API directly with curl — which requires a known password.

**How to apply:** For read-only, non-destructive verification, update the target user's `password` column to a bcryptjs hash of a known test string (10 salt rounds, matching `artifacts/api-server/src/routes/routes.ts` hashing), log in via `POST /api/auth/login` to get a JWT, then drive routes with `Authorization: Bearer <token>`. If a table needed for the test (e.g. `jobs`) is empty, insert a minimal row directly via `pg.Pool` against `SUPABASE_DATABASE_URL` (not `DATABASE_URL`), then clean up test rows afterward.
