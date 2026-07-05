---
name: This project's DB tooling defaults to the wrong database
description: lib/db/drizzle.config.ts AND the agent's built-in `executeSql`/database-skill tool both default to DATABASE_URL (Replit-managed Postgres), but this app only reads/writes SUPABASE_DATABASE_URL (Supabase). Any manual migration or verification query issued through the default tool silently hits an empty, unused database.
---

`lib/db/drizzle.config.ts` must source its connection string from `SUPABASE_DATABASE_URL`, matching `artifacts/api-server/src/db.ts`. Separately, the agent's own `executeSql` tool (and the `database` skill by default) also connects to `DATABASE_URL`, not `SUPABASE_DATABASE_URL` — this is a project-wide gotcha, not just a config bug in one file.

**Why:** Running `pnpm --filter @workspace/db run push`, or running `executeSql`/`ALTER TABLE ...` via the agent's SQL tool, reports success and appears to add columns/rows — but to the wrong, empty database. The real app (Supabase-backed) kept throwing `column "..." does not exist` until this was caught by manually diffing `information_schema.columns` on both databases. This cost real time twice in the same task: once for a schema migration, once for seeding test rows for manual verification.

**How to apply:** For this project, NEVER trust `executeSql` / the default `database` skill connection for either schema changes or data checks — it targets the wrong DB. Instead, run a one-off `pg.Pool({ connectionString: process.env.SUPABASE_DATABASE_URL })` script (e.g. via `node --input-type=module -e "..."` from `artifacts/api-server`, where the env var is available) for ALTER TABLE, INSERT test data, and SELECT verification alike. If `pnpm run push` prompts an interactive "table created or renamed?" question for an unrelated table (schema drift from other features), don't blindly answer — prefer a scoped `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` via the SUPABASE_DATABASE_URL pool for small, additive changes.
