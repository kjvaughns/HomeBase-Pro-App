#!/bin/bash
set -e
pnpm install --no-frozen-lockfile
pnpm run typecheck:libs
# Use drizzle-kit push with --force and non-interactive stdin to avoid
# rename-detection prompts. All schema changes that would trigger interactive
# prompts (new tables, new columns, type changes, unique constraints) must be
# pre-applied via SQL in this script before the push runs.
echo "" | pnpm --filter db push
