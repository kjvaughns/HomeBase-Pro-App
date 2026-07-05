---
name: Recurring job date math must use UTC getters/setters
description: recurringJobsService.ts uses a UTC-based dedup key; local-timezone Date methods there cause off-by-one-day occurrence bugs near timezone boundaries.
---

`artifacts/api-server/src/recurringJobsService.ts` dedupes materialized occurrences with a UTC-based key (`toISOString().slice(0,10)`). Any date arithmetic in that file (day-of-week checks, business-hours checks, month shifting, conflict detection, occurrence computation) must use the UTC variants of Date getters/setters (`getUTCDate`, `getUTCDay`, `getUTCMonth`, `getUTCFullYear`, `setUTCDate`, `setUTCMonth`, `setUTCHours`, etc.), never the local-timezone equivalents (`getDate`, `getDay`, ...).

**Why:** Mixing local-timezone getters with a UTC-based dedup key caused occurrences to shift by a day for users near timezone boundaries (e.g. a Monday-only recurring job silently skipping or duplicating around midnight UTC).

**How to apply:** When touching any date logic in this file, grep for local-timezone `Date.prototype` methods (`getDate(`, `getDay(`, `getMonth(`, `getFullYear(`, `setDate(`, `setMonth(`, `setHours(`) and convert to UTC equivalents to stay consistent with the rest of the module.
