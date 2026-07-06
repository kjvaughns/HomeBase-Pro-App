---
name: Parallel subagent refactors need a dedicated verification pass
description: Dispatching multiple parallel subagents to adopt a shared component/util across many files reliably leaves dangling references; budget a manual fix pass before considering the work done.
---

When 5-7 async subagents are each assigned a slice of "replace local pattern X with shared component/util Y" across many files in the same app, each subagent tends to:
- Remove/rename the old local helper (e.g. `formatCurrency`, `formatCents`, `renderStars`) in some call sites but miss others in the same file.
- Reference a shared component (`EmptyState`, `GlassCard`, `ThemedView`, `RatingStars`) without adding the import.
- Leave a stray local variable/type reference (e.g. `theme`, `HomeProfile`) undefined after restructuring a function during an unrelated task (e.g. converting a spinner to a skeleton touched a neighboring function that used `useTheme()` implicitly).

**Why:** Each subagent only sees its own slice and doesn't run a full `tsc --noEmit` against the whole package before returning, so these gaps surface only in the orchestrator's aggregate verification pass, not per-task.

**How to apply:** After any multi-subagent adoption sweep, immediately run `pnpm exec tsc --noEmit` (or full `pnpm run typecheck`) once as a dedicated final task/step, and expect real work fixing it — not just a formality. Common fixes: add the missing import, replace the dangling old-helper call with the new shared util's equivalent call shape, or add back a hook call (`useTheme()`) that got orphaned. Also consider extending the shared util (e.g. add a `compact` option to a formatter) rather than reintroducing a local one-off implementation, to keep it a true single source of truth.
