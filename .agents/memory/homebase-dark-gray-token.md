---
name: HomeBase dark-mode gray token confusion
description: Where reported "washed-out gray in dark mode" bugs actually live in the HomeBase theme system, and which token to use instead.
---

In `artifacts/homebase/constants/theme.ts`, dark mode has three near-black grays that are easy to conflate:

- `backgroundRoot` — true black, page-level background.
- `cardBackground` — ~#1C1C1E, used by the confirmed-correct reference components (`StatCard`, `GlassCard`). Intended for elevated cards/surfaces.
- `backgroundSecondary` — ~#2C2C2E, distinctly lighter. Meant for small interactive elements that need to contrast against cards/accents (toggle buttons, filter chips, badges, Switch trackColor).

**Why this matters:** when a user reports screens "looking washed-out gray" in dark mode, the root containers are usually already fine (they use `ThemedView`/`backgroundRoot`). The actual bug tends to be persistent, full-width panels (offline banners, segmented date-range bars, inline picker containers, dismissible nudge cards) using `backgroundSecondary` where they should use `cardBackground` to match the reference stat-card look. Small chips/toggles/badges legitimately keep `backgroundSecondary`/`backgroundTertiary` — don't touch those.

**How to apply:** when auditing a "gray instead of black" dark-mode report, grep for `backgroundSecondary`/`backgroundTertiary` usage, not `backgroundRoot`. Classify each hit as (a) a persistent panel/banner — likely a bug, switch to `cardBackground` — vs (b) a small interactive contrast element — leave it alone.
