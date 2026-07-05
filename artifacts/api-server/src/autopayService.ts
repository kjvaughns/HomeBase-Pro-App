/**
 * Task #474: Autopay for recurring visits.
 *
 * When a provider opts a job_series into autopay, each newly-due occurrence
 * (a materialized `jobs` row with no invoice yet, whose scheduled date has
 * arrived) gets an invoice auto-generated and immediately charged
 * off-session against the client's saved card via
 * stripeConnectService.attemptAutopayCharge.
 *
 * On decline/failure we never fail silently: the invoice falls back to a
 * normal manual invoice (chargeType stays queryable, autopayFailureReason is
 * populated) and the provider is notified in-app + push. If the client has
 * an email on file, they're also notified their payment failed so they can
 * pay manually — mirroring the existing invoice.payment_failed flow.
 */
import cron from "node-cron";
import { and, eq, isNull, lte, ne } from "drizzle-orm";
import { db } from "./db";
import {
  clients,
  invoiceLineItems,
  invoices,
  jobs,
  jobSeries,
  payments,
  providers,
  type InsertInvoice,
} from "@workspace/db";
import {
  attemptAutopayCharge,
  calculatePlatformFee,
  getProviderPlan,
} from "./stripeConnectService";
import { dispatch, dispatchNotification } from "./notificationService";
import { logger } from "./lib/logger";

/**
 * Finds occurrences that are due for autopay: materialized jobs belonging to
 * an active, autopay-enabled series, scheduled at/before now, not cancelled,
 * and without an invoice yet.
 */
async function findDueAutopayOccurrences() {
  return db
    .select({
      id: jobs.id,
      providerId: jobs.providerId,
      clientId: jobs.clientId,
      seriesId: jobs.seriesId,
      title: jobs.title,
      estimatedPrice: jobs.estimatedPrice,
      finalPrice: jobs.finalPrice,
      status: jobs.status,
    })
    .from(jobs)
    .innerJoin(jobSeries, eq(jobs.seriesId, jobSeries.id))
    .leftJoin(invoices, eq(invoices.jobId, jobs.id))
    .where(
      and(
        eq(jobSeries.autopayEnabled, true),
        eq(jobSeries.status, "active"),
        lte(jobs.scheduledDate, new Date()),
        ne(jobs.status, "cancelled"),
        isNull(invoices.id),
      ),
    );
}

async function createDraftInvoiceForOccurrence(job: {
  id: string;
  providerId: string;
  clientId: string | null;
  title: string;
  estimatedPrice: string | null;
  finalPrice: string | null;
}) {
  const amount = parseFloat(job.finalPrice || job.estimatedPrice || "0") || 0;
  const subtotalCents = Math.round(amount * 100);

  const plan = await getProviderPlan(job.providerId);
  const fee = calculatePlatformFee(
    subtotalCents,
    plan.platformFeePercent || "3.00",
    plan.platformFeeFixedCents || 0,
  );

  let homeownerUserId: string | null = null;
  if (job.clientId) {
    const [client] = await db
      .select({ homeownerUserId: clients.homeownerUserId })
      .from(clients)
      .where(eq(clients.id, job.clientId));
    homeownerUserId = client?.homeownerUserId ?? null;
  }

  const existingInvoices = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.providerId, job.providerId));
  const invoiceNumber = `INV-${String(existingInvoices.length + 1).padStart(4, "0")}`;

  const invoiceData: InsertInvoice = {
    providerId: job.providerId,
    clientId: job.clientId,
    homeownerUserId,
    jobId: job.id,
    invoiceNumber,
    currency: "usd",
    subtotalCents,
    taxCents: 0,
    discountCents: 0,
    platformFeeCents: fee.totalCents,
    totalCents: subtotalCents,
    amount: amount.toFixed(2),
    total: amount.toFixed(2),
    status: "sent",
    notes: null,
    chargeType: "autopay",
  };

  const [invoice] = await db.insert(invoices).values(invoiceData).returning();

  await db.insert(invoiceLineItems).values({
    invoiceId: invoice.id,
    name: job.title || "Recurring service",
    quantity: "1",
    unitPriceCents: subtotalCents,
    amountCents: subtotalCents,
  });

  return invoice;
}

async function notifyAutopayFailure(invoice: {
  id: string;
  providerId: string;
  clientId: string | null;
  invoiceNumber: string;
  total: string | null;
}, reason: string) {
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, invoice.providerId));

  if (provider?.userId) {
    await dispatchNotification(
      provider.userId,
      "Autopay charge failed",
      `We couldn't auto-charge the saved card for invoice ${invoice.invoiceNumber} ($${invoice.total}). An invoice was sent instead. Reason: ${reason}`,
      "invoice.autopay_failed",
      { invoiceId: invoice.id, reason },
      "invoices",
    );
  }

  if (invoice.clientId) {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, invoice.clientId));
    if (client?.email && provider) {
      dispatch("invoice.payment_failed", {
        clientEmail: client.email,
        clientName:
          [client.firstName, client.lastName].filter(Boolean).join(" ") ||
          "Client",
        providerName: provider.businessName,
        invoiceNumber: invoice.invoiceNumber,
        amount: parseFloat(invoice.total || "0"),
        relatedRecordType: "invoice",
        relatedRecordId: invoice.id,
        recipientUserId: client.homeownerUserId ?? undefined,
      }).catch((e: unknown) =>
        logger.error({ err: e }, "autopay: invoice.payment_failed dispatch failed"),
      );
    }
  }
}

/**
 * Processes every occurrence currently due for autopay: creates its invoice
 * and attempts the off-session charge, falling back to a manual invoice
 * (with provider notification) on any failure.
 */
export async function processDueAutopayOccurrences(): Promise<{
  processed: number;
  charged: number;
  failed: number;
}> {
  const dueJobs = await findDueAutopayOccurrences();
  let charged = 0;
  let failed = 0;

  for (const job of dueJobs) {
    try {
      const invoice = await createDraftInvoiceForOccurrence(job);
      const result = await attemptAutopayCharge(invoice.id);

      if (result.success) {
        charged += 1;
        continue;
      }

      failed += 1;
      await db
        .update(invoices)
        .set({
          autopayFailureReason: result.reason || "Autopay charge failed",
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoice.id));

      await db.insert(payments).values({
        invoiceId: invoice.id,
        providerId: invoice.providerId,
        amountCents: invoice.totalCents,
        amount: invoice.total,
        method: "stripe",
        status: "failed",
        autoCharged: true,
        notes: result.reason || "Autopay charge failed",
      });

      await notifyAutopayFailure(invoice, result.reason || "Card declined");
    } catch (err) {
      logger.error({ err, jobId: job.id }, "autopay: failed to process occurrence");
    }
  }

  return { processed: dueJobs.length, charged, failed };
}

/**
 * Runs every hour looking for newly-due autopay occurrences. Occurrences are
 * materialized well ahead of time by recurringJobsService, so this only
 * needs to catch up once each one's scheduled date arrives.
 */
export function startAutopayScheduler(): void {
  cron.schedule("0 * * * *", async () => {
    try {
      const result = await processDueAutopayOccurrences();
      if (result.processed > 0) {
        logger.info(result, "autopay: processed due occurrences");
      }
    } catch (err) {
      logger.error({ err }, "autopay scheduler failed");
    }
  });
}
