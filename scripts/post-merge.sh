#!/bin/bash
set -e
pnpm install --no-frozen-lockfile
pnpm run typecheck:libs
echo "y" | pnpm --filter db push
