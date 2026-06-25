import cron from "node-cron";
import { db } from "./db";
import { eq, and, gte, lt, isNotNull, inArray } from "drizzle-orm";
import { providers, jobs, invoices, pushTokens, recapNotificationsSent } from "@workspace/db";
import { sendPush } from "./notificationService";
import { logger } from "./lib/logger";

function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end };
}

export interface RecapData {
  month: string;
  jobsCompleted: number;
  uniqueClients: number;
  totalRevenueCents: number;
  topService: string | null;
  prevJobsCompleted: number;
  prevUniqueClients: number;
  prevTotalRevenueCents: number;
}

export async function getProviderRecap(
  providerId: string,
  year: number,
  month: number,
): Promise<RecapData> {
  const { start, end } = getMonthRange(year, month);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const { start: prevStart, end: prevEnd } = getMonthRange(prevYear, prevMonth);

  // Filter by completedAt (not scheduledDate) so jobs are bucketed into the
  // month they were actually finished, not the month they were originally
  // scheduled. This correctly handles reschedules and delays where a job
  // crosses a month boundary between scheduling and completion.
  const completedJobsQuery = db
    .select({
      id: jobs.id,
      clientId: jobs.clientId,
      title: jobs.title,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.providerId, providerId),
        eq(jobs.status, "completed"),
        isNotNull(jobs.completedAt),
        gte(jobs.completedAt as any, start),
        lt(jobs.completedAt as any, end),
      ),
    );

  const prevCompletedJobsQuery = db
    .select({
      id: jobs.id,
      clientId: jobs.clientId,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.providerId, providerId),
        eq(jobs.status, "completed"),
        isNotNull(jobs.completedAt),
        gte(jobs.completedAt as any, prevStart),
        lt(jobs.completedAt as any, prevEnd),
      ),
    );

  const paidInvoicesQuery = db
    .select({ totalCents: invoices.totalCents })
    .from(invoices)
    .where(
      and(
        eq(invoices.providerId, providerId),
        eq(invoices.status, "paid"),
        isNotNull(invoices.paidAt),
        gte(invoices.paidAt as any, start),
        lt(invoices.paidAt as any, end),
      ),
    );

  const prevPaidInvoicesQuery = db
    .select({ totalCents: invoices.totalCents })
    .from(invoices)
    .where(
      and(
        eq(invoices.providerId, providerId),
        eq(invoices.status, "paid"),
        isNotNull(invoices.paidAt),
        gte(invoices.paidAt as any, prevStart),
        lt(invoices.paidAt as any, prevEnd),
      ),
    );

  const [completedJobRows, prevCompletedJobRows, paidInvoiceRows, prevPaidInvoiceRows] =
    await Promise.all([
      completedJobsQuery,
      prevCompletedJobsQuery,
      paidInvoicesQuery,
      prevPaidInvoicesQuery,
    ]);

  const uniqueClients = new Set(completedJobRows.map((j) => j.clientId).filter(Boolean)).size;
  const prevUniqueClients = new Set(prevCompletedJobRows.map((j) => j.clientId).filter(Boolean)).size;

  const totalRevenueCents = paidInvoiceRows.reduce((sum, inv) => sum + (inv.totalCents ?? 0), 0);
  const prevTotalRevenueCents = prevPaidInvoiceRows.reduce((sum, inv) => sum + (inv.totalCents ?? 0), 0);

  const titleCounts = new Map<string, number>();
  for (const j of completedJobRows) {
    titleCounts.set(j.title, (titleCounts.get(j.title) ?? 0) + 1);
  }
  let topService: string | null = null;
  let topCount = 0;
  for (const [title, count] of titleCounts) {
    if (count > topCount) {
      topCount = count;
      topService = title;
    }
  }

  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  return {
    month: monthStr,
    jobsCompleted: completedJobRows.length,
    uniqueClients,
    totalRevenueCents,
    topService,
    prevJobsCompleted: prevCompletedJobRows.length,
    prevUniqueClients,
    prevTotalRevenueCents,
  };
}

// Returns { day, hour } for the given IANA timezone using the Intl API
// (Node 18+ native). Returns { day: -1, hour: -1 } for invalid tz strings.
// day is the day-of-month (1–31), hour is the 0-based hour (0–23).
function localDateTimeIn(
  tz: string,
  now: Date,
): { year: number; month: number; day: number; hour: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      hour12: false,
    }).formatToParts(now);
    const get = (type: string) =>
      parseInt(parts.find((p) => p.type === type)?.value ?? "-1", 10);
    return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
  } catch {
    return { year: -1, month: -1, day: -1, hour: -1 }; // invalid timezone — skip
  }
}

// Validates that a string is a recognised IANA timezone identifier.
// Returns true if Intl accepts it without throwing.
export function isValidIANATimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Send recap pushes for all active providers in a given timezone (tz)
// for the specified year/month.
//
// Idempotency strategy (claim-first):
//  1. Atomically insert (provider_id, month) into recap_notifications_sent.
//  2. ON CONFLICT → row already exists → provider already received (or is
//     receiving) a push → skip. This prevents duplicate blasts in multi-
//     instance / server-restart overlap scenarios because only one worker
//     can successfully insert the claim row.
//  3. After a successful claim, attempt sendPush.
//  4. If sendPush returns false (no tokens / push disabled) → delete the
//     claim row so the provider can be retried later in the same month.
export async function sendMonthlyRecapNotifications(
  year: number,
  month: number,
  tz: string,
): Promise<void> {
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" });

  const activeProviders = await db
    .select({ id: providers.id, userId: providers.userId })
    .from(providers)
    .where(and(eq(providers.isActive, true), eq(providers.timezone, tz)));

  const providerUserIds = activeProviders.map((p) => p.userId).filter(Boolean) as string[];
  if (providerUserIds.length === 0) {
    logger.info({ tz, month: monthStr }, "No active providers in timezone, skipping");
    return;
  }

  const providersWithTokens = await db
    .selectDistinct({ userId: pushTokens.userId })
    .from(pushTokens)
    .where(
      and(
        eq(pushTokens.isActive, true),
        inArray(pushTokens.userId, providerUserIds),
      ),
    );

  const userIdsWithTokens = new Set(providersWithTokens.map((p) => p.userId));

  let sent = 0;
  let skipped = 0;
  for (const provider of activeProviders) {
    if (!provider.userId || !userIdsWithTokens.has(provider.userId)) continue;

    // Step 1: Claim the (provider, month) slot atomically.
    // If another instance already inserted this row, claim.length === 0 and
    // we skip — preventing duplicate blasts under concurrent execution.
    const claim = await db
      .insert(recapNotificationsSent)
      .values({ providerId: provider.id, month: monthStr })
      .onConflictDoNothing()
      .returning({ providerId: recapNotificationsSent.providerId });

    if (claim.length === 0) {
      skipped++;
      continue;
    }

    // Step 2: Dispatch the push. sendPush returns true if tokens were found
    // and the message was handed to Expo, false if skipped (no tokens / prefs
    // disabled) or a transport error occurred.
    const dispatched = await sendPush(
      provider.userId,
      `Your ${monthName} recap is ready 🎉`,
      "Tap to see your jobs, clients, and revenue for last month.",
      { screen: "MonthlyRecap", month: monthStr },
      "reminders",
    );

    if (dispatched) {
      sent++;
    } else {
      // Step 3: Release the claim so this provider can be retried the next
      // time the cron fires within the same month (e.g. if token registration
      // arrives later or the Expo gateway recovers).
      await db
        .delete(recapNotificationsSent)
        .where(
          and(
            eq(recapNotificationsSent.providerId, provider.id),
            eq(recapNotificationsSent.month, monthStr),
          ),
        )
        .catch(() => {/* best-effort release */});
      logger.warn({ providerId: provider.id, tz }, "Recap push not dispatched; claim released for retry");
    }
  }

  logger.info(
    { tz, month: monthStr, sent, skipped, total: activeProviders.length },
    "Monthly recap pushes sent",
  );
}

// A single UTC cron fires at minute 0 of every hour on the 1st of each month.
// For each fire, the job discovers all distinct IANA timezones currently stored
// in the providers table, checks which ones have local hour === 9 right now,
// and sends recap pushes only to providers in matching zones.
//
// This covers any IANA timezone (US, EU, Asia, …) without hardcoding a fixed
// list — new zones are automatically picked up once a provider stores one.
export function startMonthlyRecapScheduler(): void {
  cron.schedule(
    "0 * * * *", // every hour, every day — gate on local day=1 hour=9 below
    async () => {
      const now = new Date();

      // Identify whose local time is exactly 9am right now
      let tzRows: { timezone: string }[];
      try {
        tzRows = await db
          .selectDistinct({ timezone: providers.timezone })
          .from(providers)
          .where(eq(providers.isActive, true));
      } catch (err) {
        logger.error({ err }, "Monthly recap scheduler: failed to load timezones");
        return;
      }

      // Build a list of { tz, recapYear, recapMonth } for every timezone where
      // the local date is the 1st of the month at 9am.
      //
      // Critically, both the day-check AND the recap month derivation use the
      // timezone's own local date — NOT UTC. This matters for UTC+10 to +14:
      //   e.g. UTC 2024-12-31 23:00 → Pacific/Auckland local 2025-01-01 12:00
      //   UTC-derived prevMonth = December ✓  but only because we also read
      //   the local month=1 → prevMonth = month-1 = 12. Had UTC been 2025-01-01
      //   at the same local boundary, UTC-derived = December but local = January,
      //   so local-derived is correct and UTC-derived would be wrong.
      type EligibleEntry = { tz: string; recapYear: number; recapMonth: number };
      const eligible: EligibleEntry[] = [];

      for (const { timezone: tz } of tzRows) {
        const { year: localYear, month: localMonth, day, hour } = localDateTimeIn(tz, now);
        if (day !== 1 || hour !== 9) continue;
        // The recap covers the month that just ended — one month before local day=1.
        const recapMonth = localMonth === 1 ? 12 : localMonth - 1;
        const recapYear = localMonth === 1 ? localYear - 1 : localYear;
        eligible.push({ tz, recapYear, recapMonth });
      }

      if (eligible.length === 0) return;

      logger.info(
        { eligible: eligible.map((e) => `${e.tz} → ${e.recapYear}-${String(e.recapMonth).padStart(2, "0")}`) },
        "Monthly recap: dispatching for timezone batch",
      );

      for (const { tz, recapYear, recapMonth } of eligible) {
        try {
          await sendMonthlyRecapNotifications(recapYear, recapMonth, tz);
        } catch (err) {
          logger.error({ err, tz }, "Monthly recap notification job failed");
        }
      }
    },
  );

  logger.info("Monthly recap scheduler registered (0 * * * * UTC — hourly, gates on local day=1 hour=9)");
}
