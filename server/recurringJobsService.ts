/**
 * Auto-generate recurring jobs on the calendar.
 *
 * A `provider_custom_services` row flagged isRecurring=true is the *template*.
 * The first booking the provider creates anchors a `job_series` row, and this
 * service materializes subsequent occurrences as real `jobs` (+ paired
 * `appointments`) on a rolling horizon. A daily cron extends the horizon as
 * time moves forward so the calendar always shows a few months out.
 *
 * Out of scope: RRULE, customer-facing recurring booking, crew assignment,
 * holiday calendars.
 */
import { and, eq, gte, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "./db";
import {
  appointments,
  clients,
  homes,
  jobs,
  jobSeries,
  providerCustomServices,
  providers,
  type Job,
} from "../shared/schema";

export const HORIZON_DAYS = 90;
const DEFAULT_DURATION_MIN = 60;

export type Frequency =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly";

const SUPPORTED_FREQUENCIES: ReadonlyArray<Frequency> = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
];

export function isSupportedFrequency(value: unknown): value is Frequency {
  return (
    typeof value === "string" &&
    SUPPORTED_FREQUENCIES.includes(value as Frequency)
  );
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

interface BusinessHoursDay {
  enabled?: boolean;
  open?: string;
  close?: string;
}

function parseBusinessHours(
  raw: unknown,
): Partial<Record<(typeof DAY_KEYS)[number], BusinessHoursDay>> | null {
  if (!raw) return null;
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  return value as Partial<
    Record<(typeof DAY_KEYS)[number], BusinessHoursDay>
  >;
}

function isClosedDay(
  hours: ReturnType<typeof parseBusinessHours>,
  date: Date,
): boolean {
  if (!hours) return false;
  const day = hours[DAY_KEYS[date.getDay()]];
  if (!day) return false;
  return day.enabled === false;
}

/**
 * If business hours specify open/close times for the given weekday and the
 * proposed scheduledTime + duration fall outside that window, treat the day
 * as unavailable so we shift to the next business day.
 */
function isOutsideBusinessHours(
  hours: ReturnType<typeof parseBusinessHours>,
  date: Date,
  scheduledTime: string | null,
  durationMin: number,
): boolean {
  if (!hours || !scheduledTime) return false;
  const day = hours[DAY_KEYS[date.getDay()]];
  if (!day || day.enabled === false) return false;
  const open = parseHHMM(day.open ?? null);
  const close = parseHHMM(day.close ?? null);
  const start = parseHHMM(scheduledTime);
  if (open == null || close == null || start == null) return false;
  const end = start + durationMin;
  return start < open || end > close;
}

/**
 * Parse a time string into minutes-since-midnight. Accepts both 24-hour
 * "HH:MM" (used by jobs.scheduled_time / TimePickerSheet) and the 12-hour
 * "h:mm AM/PM" / "Closed" format that BusinessHubScreen stores in
 * provider.business_hours. Returns null on bad input.
 */
function parseHHMM(time: string | null | undefined): number | null {
  if (!time) return null;
  const trimmed = time.trim();
  if (!trimmed || /^closed$/i.test(trimmed)) return null;
  const m = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  const ampm = m[3]?.toUpperCase();
  if (ampm === "AM") {
    if (h === 12) h = 0;
  } else if (ampm === "PM") {
    if (h !== 12) h += 12;
  }
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Inverse of computeOccurrence — returns the smallest n>=1 such that
 * computeOccurrence(anchor, frequency, n) >= minDate. This lets the
 * generator skip past historical occurrences without iterating one at a
 * time (critical for daily series with old anchors).
 */
function computeStartN(
  anchor: Date,
  frequency: Frequency,
  minDate: Date,
): number {
  if (minDate <= anchor) return 1;
  switch (frequency) {
    case "daily": {
      const diffDays = Math.floor(
        (minDate.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000),
      );
      return Math.max(1, diffDays);
    }
    case "weekly": {
      const diffDays = Math.floor(
        (minDate.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000),
      );
      return Math.max(1, Math.floor(diffDays / 7));
    }
    case "biweekly": {
      const diffDays = Math.floor(
        (minDate.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000),
      );
      return Math.max(1, Math.floor(diffDays / 14));
    }
    case "monthly": {
      const months =
        (minDate.getFullYear() - anchor.getFullYear()) * 12 +
        (minDate.getMonth() - anchor.getMonth());
      return Math.max(1, months);
    }
    case "quarterly": {
      const months =
        (minDate.getFullYear() - anchor.getFullYear()) * 12 +
        (minDate.getMonth() - anchor.getMonth());
      return Math.max(1, Math.floor(months / 3));
    }
  }
}

/**
 * Compute the n-th occurrence date for a given frequency, anchored at
 * `anchor`. Monthly/quarterly preserve day-of-month; weekly/biweekly add
 * fixed day offsets so weekday is preserved naturally.
 */
export function computeOccurrence(
  anchor: Date,
  frequency: Frequency,
  n: number,
): Date {
  const d = new Date(anchor);
  switch (frequency) {
    case "daily":
      d.setDate(d.getDate() + n);
      return d;
    case "weekly":
      d.setDate(d.getDate() + 7 * n);
      return d;
    case "biweekly":
      d.setDate(d.getDate() + 14 * n);
      return d;
    case "monthly":
      return shiftMonths(d, n);
    case "quarterly":
      return shiftMonths(d, 3 * n);
  }
}

/**
 * Add `months` to a date while clamping the day-of-month to the last valid
 * day of the target month. Without this, JavaScript's `setMonth` overflows:
 * Jan 31 + 1 month = March 3 (because Feb has 28 days). Anchoring the day
 * to 1 before shifting the month avoids the overflow, then we re-set the
 * day to min(originalDay, lastDayOfTargetMonth).
 */
function shiftMonths(d: Date, months: number): Date {
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

/**
 * If the proposed date lands on a day the provider is closed OR a day on
 * which the provider already has a non-cancelled job/appointment that
 * overlaps the desired time slot, push forward one day at a time until a
 * conflict-free open day is found (max 6 attempts).
 */
async function adjustToAvailableDay(
  date: Date,
  hours: ReturnType<typeof parseBusinessHours>,
  ctx: {
    providerId: string;
    seriesId: string;
    scheduledTime: string | null;
    durationMin: number;
  },
): Promise<Date | null> {
  const candidate = new Date(date);
  for (let i = 0; i < 7; i++) {
    if (
      !isClosedDay(hours, candidate) &&
      !isOutsideBusinessHours(
        hours,
        candidate,
        ctx.scheduledTime,
        ctx.durationMin,
      ) &&
      !(await hasConflictingJob(candidate, ctx))
    ) {
      return new Date(candidate);
    }
    candidate.setDate(candidate.getDate() + 1);
  }
  return null;
}

/**
 * Returns true if the provider already has a non-cancelled job at this date
 * whose time window overlaps the proposed slot. Jobs in the same series are
 * ignored (they're handled by the per-series occupied-dates set in the
 * caller). When either side has no scheduled_time we treat any existing job
 * on that date as a conflict, since we can't prove they don't overlap.
 */
async function hasConflictingJob(
  date: Date,
  ctx: {
    providerId: string;
    seriesId: string;
    scheduledTime: string | null;
    durationMin: number;
  },
): Promise<boolean> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const sameDay = await db
    .select({
      id: jobs.id,
      scheduledTime: jobs.scheduledTime,
      estimatedDuration: jobs.estimatedDuration,
      seriesId: jobs.seriesId,
      status: jobs.status,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.providerId, ctx.providerId),
        gte(jobs.scheduledDate, dayStart),
        sql`${jobs.scheduledDate} < ${dayEnd}`,
      ),
    );

  const newStart = parseHHMM(ctx.scheduledTime);
  const newEnd = newStart != null ? newStart + ctx.durationMin : null;

  for (const j of sameDay) {
    if (j.seriesId === ctx.seriesId) continue;
    if (j.status === "cancelled") continue;
    // No times on either side → assume conflict (be conservative).
    if (newStart == null || !j.scheduledTime) return true;
    const otherStart = parseHHMM(j.scheduledTime);
    if (otherStart == null) return true;
    const otherEnd =
      otherStart + (j.estimatedDuration ?? DEFAULT_DURATION_MIN);
    if (newStart < otherEnd && otherStart < (newEnd as number)) return true;
  }
  return false;
}

/** Resolve homeowner user_id + home_id from the series' linked client, so
 *  the materialized appointment row is visible in the homeowner's feed
 *  exactly the way one created via POST /api/jobs would be. */
async function resolveHomeowner(
  clientId: string | null,
): Promise<{ userId: string | null; homeId: string | null }> {
  if (!clientId) return { userId: null, homeId: null };
  const [row] = await db
    .select({
      homeId: clients.homeId,
      homeownerUserId: clients.homeownerUserId,
    })
    .from(clients)
    .where(eq(clients.id, clientId));
  if (!row) return { userId: null, homeId: null };
  if (row.homeownerUserId) {
    return { userId: row.homeownerUserId, homeId: row.homeId ?? null };
  }
  if (row.homeId) {
    const [home] = await db
      .select({ userId: homes.userId })
      .from(homes)
      .where(eq(homes.id, row.homeId));
    if (home?.userId) {
      return { userId: home.userId, homeId: row.homeId };
    }
    return { userId: null, homeId: row.homeId };
  }
  return { userId: null, homeId: null };
}

interface SeriesRow {
  id: string;
  providerId: string;
  clientId: string | null;
  customServiceId: string | null;
  title: string;
  description: string | null;
  notes: string | null;
  estimatedDuration: number | null;
  frequency: string;
  scheduledTime: string | null;
  estimatedPrice: string | null;
  address: string | null;
  anchorDate: Date;
  generatedThrough: Date | null;
  status: string;
}

/**
 * Materialize occurrences for a given series up to `now + HORIZON_DAYS`.
 * Idempotent on (series, date). Skips closed business-hours days and any
 * date with an overlapping non-series job; on conflict, walks forward up to
 * a week looking for an available slot.
 *
 * Returns the number of new occurrences inserted.
 */
export async function materializeOccurrences(
  series: SeriesRow,
  opts: { horizonDays?: number } = {},
): Promise<number> {
  if (series.status !== "active") return 0;
  if (!isSupportedFrequency(series.frequency)) return 0;

  const horizonDays = opts.horizonDays ?? HORIZON_DAYS;
  const horizonEnd = new Date();
  horizonEnd.setDate(horizonEnd.getDate() + horizonDays);

  // Provider business hours for closed-day skipping.
  const [provider] = await db
    .select({ businessHours: providers.businessHours })
    .from(providers)
    .where(eq(providers.id, series.providerId));
  const hours = parseBusinessHours(provider?.businessHours);

  // Snapshot the parent service's checklist template once per generation
  // pass so each materialized occurrence is initialized with the same
  // per-service steps a one-off provider-created job would get. Use [] when
  // the series is not bound to a custom service or the template is empty.
  let seriesInitialChecklist: { id: string; label: string; completed: boolean }[] = [];
  if (series.customServiceId) {
    const [svcRow] = await db
      .select({
        checklistTemplateJson: providerCustomServices.checklistTemplateJson,
      })
      .from(providerCustomServices)
      .where(eq(providerCustomServices.id, series.customServiceId));
    if (Array.isArray(svcRow?.checklistTemplateJson)) {
      seriesInitialChecklist = svcRow!
        .checklistTemplateJson!.filter(
          (it) => it && typeof it.label === "string" && it.label.trim().length > 0,
        )
        .map((it, i) => ({
          id: String(it.id ?? `c_${Date.now()}_${i}`),
          label: String(it.label).slice(0, 200),
          completed: false,
        }));
    }
  }

  // Resolve homeowner once per generation pass — the client-home linkage
  // does not change between occurrences in the same series.
  const homeowner = await resolveHomeowner(series.clientId);

  // Existing jobs in this series, keyed by ISO date so we never double-book.
  const existingJobs = await db
    .select({ id: jobs.id, scheduledDate: jobs.scheduledDate })
    .from(jobs)
    .where(eq(jobs.seriesId, series.id));
  const occupiedDates = new Set(
    existingJobs.map((j) =>
      new Date(j.scheduledDate).toISOString().slice(0, 10),
    ),
  );

  const durationMin = series.estimatedDuration ?? DEFAULT_DURATION_MIN;

  let inserted = 0;
  let lastGenerated: Date | null = null;

  // Skip past occurrences we don't care about: anything strictly before the
  // later of `generatedThrough` and "yesterday". For daily series with an
  // old anchor this jumps n past hundreds of historical occurrences so the
  // bounded loop below still reaches the horizon.
  const minDate = new Date(
    Math.max(
      (series.generatedThrough ?? new Date(0)).getTime(),
      Date.now() - 24 * 60 * 60 * 1000,
    ),
  );
  const startN = computeStartN(
    series.anchorDate,
    series.frequency as Frequency,
    minDate,
  );

  // Walk forward from the anchor until we exceed the horizon. Cap iterations
  // at a sane upper bound so a corrupted anchor can never spin forever
  // (horizon=90d so daily needs ~90 iterations at most after the skip).
  const MAX_ITERATIONS = startN + 400;
  for (let n = startN; n < MAX_ITERATIONS; n++) {
    const raw = computeOccurrence(series.anchorDate, series.frequency, n);
    if (raw > horizonEnd) break;

    const adjusted = await adjustToAvailableDay(raw, hours, {
      providerId: series.providerId,
      seriesId: series.id,
      scheduledTime: series.scheduledTime,
      durationMin,
    });
    if (!adjusted) continue;

    const key = adjusted.toISOString().slice(0, 10);
    if (occupiedDates.has(key)) {
      lastGenerated = adjusted;
      continue;
    }

    // Skip dates in the past so a long-paused horizon-extender doesn't
    // backfill stale occurrences.
    if (adjusted.getTime() < Date.now() - 24 * 60 * 60 * 1000) continue;

    try {
      await db.transaction(async (tx) => {
        const [job] = await tx
          .insert(jobs)
          .values({
            providerId: series.providerId,
            clientId: series.clientId ?? undefined,
            customServiceId: series.customServiceId ?? undefined,
            seriesId: series.id,
            title: series.title,
            description: series.description ?? undefined,
            notes: series.notes ?? undefined,
            estimatedDuration: series.estimatedDuration ?? undefined,
            scheduledDate: adjusted,
            scheduledTime: series.scheduledTime ?? undefined,
            address: series.address ?? undefined,
            estimatedPrice: series.estimatedPrice ?? undefined,
            status: "scheduled",
            checklist: seriesInitialChecklist,
          })
          .returning();

        const [appt] = await tx
          .insert(appointments)
          .values({
            userId: homeowner.userId ?? undefined,
            homeId: homeowner.homeId ?? undefined,
            providerId: series.providerId,
            serviceName: series.title,
            description: series.description ?? undefined,
            scheduledDate: adjusted,
            scheduledTime: series.scheduledTime ?? undefined,
            estimatedPrice: series.estimatedPrice ?? undefined,
            status: "confirmed" as const,
            notes: series.notes ?? undefined,
            isRecurring: true,
            recurringFrequency: series.frequency,
          })
          .returning();

        await tx
          .update(jobs)
          .set({ appointmentId: appt.id })
          .where(eq(jobs.id, job.id));
      });
      inserted++;
      occupiedDates.add(key);
      lastGenerated = adjusted;
    } catch (err) {
      console.error(
        `[recurring] materialize failed for series ${series.id} @ ${key}:`,
        err,
      );
    }
  }

  if (lastGenerated || series.generatedThrough == null) {
    await db
      .update(jobSeries)
      .set({
        generatedThrough: lastGenerated ?? horizonEnd,
        updatedAt: new Date(),
      })
      .where(eq(jobSeries.id, series.id));
  }

  return inserted;
}

/**
 * Upsert a series for a freshly-created job whose service is recurring.
 * The originating job becomes occurrence #1 (the anchor) and is back-linked
 * via jobs.series_id. Subsequent occurrences are materialized immediately.
 *
 * The anchor job's description / notes / duration are snapshotted onto the
 * series row so future generated occurrences inherit the same context (intake
 * answers summary, special instructions, expected duration).
 */
export async function createSeriesForJob(params: {
  job: Job;
  frequency: string;
  recurringPrice?: string | null;
}): Promise<{ seriesId: string; materialized: number } | null> {
  if (!isSupportedFrequency(params.frequency)) return null;
  const job = params.job;
  if (!job.scheduledDate) return null;

  // If this job is already linked to a series (e.g., re-trigger), no-op.
  if (job.seriesId) {
    return { seriesId: job.seriesId, materialized: 0 };
  }

  const [series] = await db
    .insert(jobSeries)
    .values({
      providerId: job.providerId,
      clientId: job.clientId ?? undefined,
      customServiceId: job.customServiceId ?? undefined,
      title: job.title,
      description: job.description ?? undefined,
      notes: job.notes ?? undefined,
      estimatedDuration: job.estimatedDuration ?? undefined,
      frequency: params.frequency,
      scheduledTime: job.scheduledTime ?? undefined,
      estimatedPrice:
        params.recurringPrice ?? job.estimatedPrice ?? undefined,
      address: job.address ?? undefined,
      anchorDate: job.scheduledDate,
      status: "active",
    })
    .returning();

  await db
    .update(jobs)
    .set({ seriesId: series.id, updatedAt: new Date() })
    .where(eq(jobs.id, job.id));

  // Mark the anchor's linked appointment as recurring so the homeowner-facing
  // detail page consistently flags the first occurrence the same way every
  // generated occurrence is flagged in materializeOccurrences().
  if (job.appointmentId) {
    await db
      .update(appointments)
      .set({
        isRecurring: true,
        recurringFrequency: params.frequency,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, job.appointmentId));
  }

  const materialized = await materializeOccurrences({
    id: series.id,
    providerId: series.providerId,
    clientId: series.clientId,
    customServiceId: series.customServiceId,
    title: series.title,
    description: series.description,
    notes: series.notes,
    estimatedDuration: series.estimatedDuration,
    frequency: series.frequency,
    scheduledTime: series.scheduledTime,
    estimatedPrice: series.estimatedPrice,
    address: series.address,
    anchorDate: series.anchorDate,
    generatedThrough: series.generatedThrough,
    status: series.status,
  });

  return { seriesId: series.id, materialized };
}

/**
 * Cancel a series: mark status='cancelled' and cancel all future
 * not-yet-completed jobs in the series. Past/completed jobs are preserved.
 * Returns the count of jobs cancelled.
 */
export async function cancelSeries(seriesId: string): Promise<number> {
  const now = new Date();
  await db
    .update(jobSeries)
    .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
    .where(eq(jobSeries.id, seriesId));

  const futureJobs = await db
    .select({ id: jobs.id, appointmentId: jobs.appointmentId, status: jobs.status })
    .from(jobs)
    .where(and(eq(jobs.seriesId, seriesId), gte(jobs.scheduledDate, now)));

  let cancelled = 0;
  for (const j of futureJobs) {
    if (j.status !== "scheduled" && j.status !== "confirmed") continue;
    await db
      .update(jobs)
      .set({ status: "cancelled", updatedAt: now })
      .where(eq(jobs.id, j.id));
    if (j.appointmentId) {
      await db
        .update(appointments)
        .set({ status: "cancelled", updatedAt: now })
        .where(eq(appointments.id, j.appointmentId))
        .catch(() => {});
    }
    cancelled++;
  }
  return cancelled;
}

export interface SeriesPatch {
  title?: string;
  description?: string | null;
  notes?: string | null;
  estimatedDuration?: number | null;
  scheduledTime?: string | null;
  estimatedPrice?: string | null;
  address?: string | null;
  /** Shift every following occurrence by this many days (positive or
   *  negative). Used by reschedule UX to slide the recurring cadence. */
  shiftDays?: number;
  /** Pivot's scheduled_date BEFORE the route mutated it. Required so the
   *  ">= pivot.scheduledDate" filter selects the right window even though
   *  the caller may already have updated the pivot row. */
  pivotDateOverride?: Date;
}

/**
 * Apply an edit to "this and following" occurrences in a series. The job
 * identified by `fromJobId` and every later job in the same series receive
 * the patch. Mirrors safe fields back to the series template so newly-
 * generated occurrences inherit them.
 *
 * IMPORTANT: callers in PUT /api/jobs/:id?scope=following must NOT also
 * mutate the pivot's scheduled_date or scheduled_time on the same request —
 * pass them in the patch so applyToFollowing can update pivot + future in
 * one atomic step. Otherwise the pivot would be moved twice (once by the
 * route's storage.updateJob and again by the SQL interval shift here).
 */
export async function applyToFollowing(
  fromJobId: string,
  patch: SeriesPatch,
): Promise<number> {
  const [pivotRow] = await db
    .select({
      seriesId: jobs.seriesId,
      scheduledDate: jobs.scheduledDate,
    })
    .from(jobs)
    .where(eq(jobs.id, fromJobId));
  if (!pivotRow?.seriesId) return 0;

  // Use the explicit OLD date when caller provided one (route already
  // updated pivot.scheduledDate). Otherwise trust the value in the row.
  const pivotDate = patch.pivotDateOverride ?? pivotRow.scheduledDate;

  const now = new Date();
  const setData: Record<string, unknown> = { updatedAt: now };
  if (patch.title !== undefined) setData.title = patch.title;
  if (patch.description !== undefined) setData.description = patch.description;
  if (patch.notes !== undefined) setData.notes = patch.notes;
  if (patch.estimatedDuration !== undefined)
    setData.estimatedDuration = patch.estimatedDuration;
  if (patch.scheduledTime !== undefined)
    setData.scheduledTime = patch.scheduledTime;
  if (patch.estimatedPrice !== undefined)
    setData.estimatedPrice = patch.estimatedPrice;
  if (patch.address !== undefined) setData.address = patch.address;

  // Bulk update all future jobs (including the pivot itself) when there's
  // any same-row field to patch.
  let changed = 0;
  if (Object.keys(setData).length > 1) {
    const result = await db
      .update(jobs)
      .set(setData)
      .where(
        and(
          eq(jobs.seriesId, pivotRow.seriesId),
          gte(jobs.scheduledDate, pivotDate),
          ne(jobs.status, "cancelled"),
          ne(jobs.status, "completed"),
          // Task #303: weather-held jobs sit on a custom date set by the
          // provider; don't trample that with a series-wide field/time edit.
          ne(jobs.status, "weather_held"),
        ),
      )
      .returning({
        id: jobs.id,
        appointmentId: jobs.appointmentId,
        scheduledTime: jobs.scheduledTime,
      });
    changed = result.length;

    // Mirror time/notes onto each occurrence's paired appointment so the
    // homeowner-facing row stays in lock-step with the provider's job.
    if (patch.scheduledTime !== undefined || patch.notes !== undefined) {
      const apptPatch: Record<string, unknown> = { updatedAt: now };
      if (patch.scheduledTime !== undefined)
        apptPatch.scheduledTime = patch.scheduledTime;
      if (patch.notes !== undefined) apptPatch.notes = patch.notes;
      for (const r of result) {
        if (!r.appointmentId) continue;
        await db
          .update(appointments)
          .set(apptPatch)
          .where(eq(appointments.id, r.appointmentId))
          .catch(() => {});
      }
    }
  }

  // Date shift for cadence reschedule. Done as a SQL expression so we don't
  // round-trip every row through Node. Uses the OLD pivot date as the >=
  // anchor so backwards shifts don't accidentally pick up earlier rows.
  //
  // Two-phase shift to dodge the (series_id, scheduled_date::date) unique
  // index: shifting by exactly one cadence (e.g., +7d for weekly) would
  // otherwise collide with the next existing occurrence row mid-update.
  // Phase 1 parks every affected row 100000 days in the future (uniform
  // offset preserves spacing → no inter-row collisions, and 100000d is
  // far beyond any unshifted occurrence). Phase 2 brings them back to the
  // intended date by id, so we never touch anything outside this set.
  if (patch.shiftDays && patch.shiftDays !== 0) {
    const days = Math.trunc(patch.shiftDays);
    const PARK_DAYS = 100000;
    const phase1 = await db
      .update(jobs)
      .set({
        scheduledDate: sql`${jobs.scheduledDate} + (${days + PARK_DAYS} || ' days')::interval`,
        updatedAt: now,
      })
      .where(
        and(
          eq(jobs.seriesId, pivotRow.seriesId),
          gte(jobs.scheduledDate, pivotDate),
          ne(jobs.status, "cancelled"),
          ne(jobs.status, "completed"),
          // Task #303: weather-held jobs hold their custom date; skip the
          // bulk shift so a "Restore" still puts them back in their slot.
          ne(jobs.status, "weather_held"),
        ),
      )
      .returning({ id: jobs.id, appointmentId: jobs.appointmentId });
    let result: typeof phase1 = phase1;
    if (phase1.length > 0) {
      result = await db
        .update(jobs)
        .set({
          scheduledDate: sql`${jobs.scheduledDate} - (${PARK_DAYS} || ' days')::interval`,
          updatedAt: now,
        })
        .where(
          inArray(
            jobs.id,
            phase1.map((r) => r.id),
          ),
        )
        .returning({ id: jobs.id, appointmentId: jobs.appointmentId });
    }
    changed = Math.max(changed, result.length);

    // Mirror the same shift on the paired appointments table so homeowner
    // and provider calendars stay aligned.
    for (const r of result) {
      if (!r.appointmentId) continue;
      await db
        .update(appointments)
        .set({
          scheduledDate: sql`${appointments.scheduledDate} + (${days} || ' days')::interval`,
          updatedAt: now,
        })
        .where(eq(appointments.id, r.appointmentId))
        .catch(() => {});
    }

    // Slide the series anchor forward too so the horizon extender keeps
    // generating occurrences on the new cadence.
    await db
      .update(jobSeries)
      .set({
        anchorDate: sql`${jobSeries.anchorDate} + (${days} || ' days')::interval`,
        updatedAt: now,
      })
      .where(eq(jobSeries.id, pivotRow.seriesId));
  }

  // Mirror series-level fields so future generated occurrences inherit edits.
  const seriesPatch: Record<string, unknown> = { updatedAt: now };
  if (patch.title !== undefined) seriesPatch.title = patch.title;
  if (patch.description !== undefined)
    seriesPatch.description = patch.description;
  if (patch.notes !== undefined) seriesPatch.notes = patch.notes;
  if (patch.estimatedDuration !== undefined)
    seriesPatch.estimatedDuration = patch.estimatedDuration;
  if (patch.scheduledTime !== undefined)
    seriesPatch.scheduledTime = patch.scheduledTime;
  if (patch.estimatedPrice !== undefined)
    seriesPatch.estimatedPrice = patch.estimatedPrice;
  if (patch.address !== undefined) seriesPatch.address = patch.address;
  if (Object.keys(seriesPatch).length > 1) {
    await db
      .update(jobSeries)
      .set(seriesPatch)
      .where(eq(jobSeries.id, pivotRow.seriesId));
  }

  return changed;
}

/**
 * Daily horizon sweep: walk every active series and top it up to
 * `now + HORIZON_DAYS`. Safe to run repeatedly — `materializeOccurrences`
 * is idempotent on (series_id, scheduled_date).
 */
export async function extendAllSeriesHorizons(): Promise<{
  scanned: number;
  inserted: number;
}> {
  const active = await db
    .select()
    .from(jobSeries)
    .where(eq(jobSeries.status, "active"));
  let inserted = 0;
  for (const s of active) {
    try {
      inserted += await materializeOccurrences(s as SeriesRow);
    } catch (err) {
      console.error(`[recurring] horizon extend failed for ${s.id}:`, err);
    }
  }
  return { scanned: active.length, inserted };
}

// Re-export for tests / scripts that want the raw drizzle signature.
export { jobSeries as jobSeriesTable };
export type { SeriesRow };
