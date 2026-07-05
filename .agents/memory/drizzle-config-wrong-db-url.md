---
name: drizzle.config.ts must use SUPABASE_DATABASE_URL
description: lib/db/drizzle.config.ts previously read DATABASE_URL (Replit-managed Postgres) instead of SUPABASE_DATABASE_URL, so `pnpm --filter @workspace/db run push` silently pushed schema to the wrong, unused database while the app kept running against Supabase.
---

`lib/db/drizzle.config.ts` must source its connection string from `SUPABASE_DATABASE_URL`, matching `artifacts/api-server/src/db.ts`. It previously used `process.env.DATABASE_URL`, a separate Replit-managed Postgres instance that the app never reads from.

**Why:** Running `pnpm --filter @workspace/db run push` with the old config reported success and added columns/tables, but to the wrong database. The real app (Supabase-backed) kept throwing `column "..." does not exist` in production/dev until this was caught by manually diffing `information_schema.columns` on both databases.

**How to apply:** After any `clients`/schema change, verify columns actually exist by querying via a script using `process.env.SUPABASE_DATABASE_URL` directly (e.g. a one-off `pg.Pool` in `artifacts/api-server`), not just by trusting `drizzle-kit push` output. If `pnpm run push` prompts an interactive "table created or renamed?" question for an unrelated table (schema drift from other features), don't blindly answer — prefer a scoped `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` via direct SQL for small, additive changes, or temporarily set `tablesFilter` in the config to isolate the table you're changing.
