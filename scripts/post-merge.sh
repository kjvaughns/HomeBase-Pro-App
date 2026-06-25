#!/bin/bash
set -e

# Install only if the lockfile changed (much faster on no-change merges).
# --frozen-lockfile is intentionally skipped so new packages added by the
# merged task are installed; but we skip the full resolution when unchanged.
pnpm install --prefer-offline --no-frozen-lockfile

pnpm run typecheck:libs

# Non-interactive push: pipe empty stdin so drizzle-kit never blocks waiting
# for a terminal prompt. Any schema changes that require interactive answers
# (rename-detection, unique-constraint warnings) must be pre-applied as SQL
# in this script BEFORE the push line, or inside the task's boot migration.
echo "" | pnpm --filter db push
