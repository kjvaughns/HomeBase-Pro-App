import { db } from "./db";
import { and, eq, gte, ne, sql } from "drizzle-orm";
import { clients, invoices, jobs } from "@workspace/db";
import { logger } from "./lib/logger";

export type NextBestActionType = "unpaid_invoice" | "follow_up";

export interface NextBestAction {
  id: string;
  type: NextBestActionType;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaScreen: string;
  ctaParams?: Record<string, string>;
}

const FOLLOW_UP_INACTIVE_DAYS = 45;

async function buildUnpaidInvoiceAction(providerId: string): Promise<NextBestAction | null> {
  const now = new Date();

  const overdueInvoices = await db
    .select({
      id: invoices.id,
      totalCents: invoices.totalCents,
      dueDate: invoices.dueDate,
      clientId: invoices.clientId,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.providerId, providerId),
        sql`(${invoices.status} = 'overdue' OR (${invoices.status} IN ('sent', 'viewed') AND ${invoices.dueDate} < ${now}))`,
      ),
    );

  if (overdueInvoices.length === 0) return null;

  const totalOwedCents = overdueInvoices.reduce((sum, inv) => sum + (inv.totalCents ?? 0), 0);
  const mostOverdue = [...overdueInvoices].sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const db_ = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return da - db_;
  })[0];

  const totalOwedDollars = (totalOwedCents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const count = overdueInvoices.length;

  return {
    id: `unpaid-invoice-${mostOverdue.id}`,
    type: "unpaid_invoice",
    headline:
      count === 1
        ? `$${totalOwedDollars} invoice is overdue`
        : `${count} invoices totaling $${totalOwedDollars} are overdue`,
    body:
      count === 1
        ? "Send a friendly reminder to get paid faster."
        : `Your oldest overdue invoice is worth following up on first — send a reminder now.`,
    ctaLabel: "Send Reminder",
    ctaScreen: "InvoiceDetail",
    ctaParams: { invoiceId: mostOverdue.id },
  };
}

async function buildFollowUpAction(providerId: string): Promise<NextBestAction | null> {
  const cutoff = new Date(Date.now() - FOLLOW_UP_INACTIVE_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();

  const lastJobPerClient = await db
    .select({
      clientId: jobs.clientId,
      lastJobDate: sql<string>`max(${jobs.scheduledDate})`.as("last_job_date"),
    })
    .from(jobs)
    .where(and(eq(jobs.providerId, providerId), eq(jobs.status, "completed")))
    .groupBy(jobs.clientId);

  if (lastJobPerClient.length === 0) return null;

  const upcomingClientRows = await db
    .select({ clientId: jobs.clientId })
    .from(jobs)
    .where(
      and(
        eq(jobs.providerId, providerId),
        gte(jobs.scheduledDate, now),
        ne(jobs.status, "cancelled"),
      ),
    );
  const upcomingClientIds = new Set(upcomingClientRows.map((r) => r.clientId).filter(Boolean));

  const staleCandidates = lastJobPerClient
    .filter((row) => row.clientId && !upcomingClientIds.has(row.clientId))
    .filter((row) => new Date(row.lastJobDate) < cutoff)
    .sort((a, b) => new Date(a.lastJobDate).getTime() - new Date(b.lastJobDate).getTime());

  if (staleCandidates.length === 0) return null;

  const staleClientId = staleCandidates[0].clientId as string;

  const [clientRow] = await db
    .select({ id: clients.id, firstName: clients.firstName, lastName: clients.lastName })
    .from(clients)
    .where(eq(clients.id, staleClientId))
    .limit(1);

  if (!clientRow) return null;

  const daysSince = Math.floor(
    (now.getTime() - new Date(staleCandidates[0].lastJobDate).getTime()) / (24 * 60 * 60 * 1000),
  );
  const clientName = `${clientRow.firstName} ${clientRow.lastName ?? ""}`.trim();

  return {
    id: `follow-up-${clientRow.id}`,
    type: "follow_up",
    headline: `Check in with ${clientName}`,
    body: `It's been ${daysSince} days since their last job and nothing's on the books. A quick follow-up could win repeat business.`,
    ctaLabel: "Send Message",
    ctaScreen: "SendMessage",
    ctaParams: { clientId: clientRow.id, clientName },
  };
}

/**
 * Returns the single highest-priority suggested action for the provider's
 * home screen, or null when there is nothing worth surfacing right now.
 * Priority: unpaid/overdue invoices first (direct revenue impact), then
 * stale-client follow-ups (retention).
 */
export async function getNextBestAction(providerId: string): Promise<NextBestAction | null> {
  try {
    const unpaidInvoiceAction = await buildUnpaidInvoiceAction(providerId);
    if (unpaidInvoiceAction) return unpaidInvoiceAction;

    const followUpAction = await buildFollowUpAction(providerId);
    if (followUpAction) return followUpAction;

    return null;
  } catch (err) {
    logger.warn({ err, providerId }, "[nextBestActionService] getNextBestAction error");
    return null;
  }
}
