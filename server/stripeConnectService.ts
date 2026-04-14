import Stripe from "stripe";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import {
  stripeConnectAccounts,
  providerPlans,
  invoices,
  invoiceLineItems,
  payments,
  payouts,
  refunds,
  userCredits,
  creditLedger,
  stripeWebhookEvents,
  providers,
  clients,
  users,
  jobs,
  housefaxEntries,
  homes,
  appointments,
} from "../shared/schema";
import { dispatch } from "./notificationService";

let stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripe) {
    const apiKey = process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_TEST_SECRET_KEY is required. Please add it to your environment variables.");
    }
    stripe = new Stripe(apiKey);
  }
  return stripe;
}

const APP_URL = process.env.APP_URL || "https://homebase.replit.app";

export interface PlatformFee {
  percent: number;
  fixedCents: number;
  totalCents: number;
}

export async function getProviderPlan(providerId: string) {
  const [plan] = await db
    .select()
    .from(providerPlans)
    .where(eq(providerPlans.providerId, providerId));
  
  if (!plan) {
    return {
      id: null,
      providerId,
      planTier: "free" as const,
      platformFeePercent: "3.00",
      platformFeeFixedCents: 0,
    };
  }
  return plan;
}

export function calculatePlatformFee(
  totalCents: number,
  feePercent: string | number,
  fixedCents: number = 0
): PlatformFee {
  const percent = typeof feePercent === "string" ? parseFloat(feePercent) : feePercent;
  const percentFee = Math.round(totalCents * (percent / 100));
  return {
    percent,
    fixedCents,
    totalCents: percentFee + fixedCents,
  };
}

export async function getConnectAccount(providerId: string) {
  const [account] = await db
    .select()
    .from(stripeConnectAccounts)
    .where(eq(stripeConnectAccounts.providerId, providerId));
  return account;
}

export async function createConnectAccountLink(providerId: string) {
  let connectAccount = await getConnectAccount(providerId);

  if (!connectAccount) {
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, providerId));

    if (!provider) {
      throw new Error("Provider not found");
    }

    const account = await getStripe().accounts.create({
      type: "express",
      email: provider.email || undefined,
      business_type: "individual",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        providerId,
        businessName: provider.businessName,
      },
    });

    [connectAccount] = await db
      .insert(stripeConnectAccounts)
      .values({
        providerId,
        stripeAccountId: account.id,
        onboardingStatus: "pending",
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted || false,
      })
      .returning();
  }

  const accountLink = await getStripe().accountLinks.create({
    account: connectAccount.stripeAccountId,
    refresh_url: `${APP_URL}/provider/connect/refresh?providerId=${providerId}`,
    return_url: `${APP_URL}/provider/connect/complete?providerId=${providerId}`,
    type: "account_onboarding",
  });

  return {
    accountId: connectAccount.stripeAccountId,
    onboardingUrl: accountLink.url,
    expiresAt: accountLink.expires_at,
  };
}

export async function refreshConnectAccountLink(providerId: string) {
  const connectAccount = await getConnectAccount(providerId);
  
  if (!connectAccount) {
    throw new Error("Connect account not found. Create one first.");
  }

  const accountLink = await getStripe().accountLinks.create({
    account: connectAccount.stripeAccountId,
    refresh_url: `${APP_URL}/provider/connect/refresh?providerId=${providerId}`,
    return_url: `${APP_URL}/provider/connect/complete?providerId=${providerId}`,
    type: "account_onboarding",
  });

  return {
    accountId: connectAccount.stripeAccountId,
    onboardingUrl: accountLink.url,
    expiresAt: accountLink.expires_at,
  };
}

export async function getConnectStatus(providerId: string) {
  const connectAccount = await getConnectAccount(providerId);
  
  if (!connectAccount) {
    return {
      exists: false,
      onboardingStatus: "not_started" as const,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    };
  }

  const account = await getStripe().accounts.retrieve(connectAccount.stripeAccountId);

  let onboardingStatus: "not_started" | "pending" | "complete" = "pending";
  if (account.charges_enabled && account.payouts_enabled && account.details_submitted) {
    onboardingStatus = "complete";
  }

  await db
    .update(stripeConnectAccounts)
    .set({
      onboardingStatus,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted || false,
      updatedAt: new Date(),
    })
    .where(eq(stripeConnectAccounts.id, connectAccount.id));

  return {
    exists: true,
    accountId: connectAccount.stripeAccountId,
    onboardingStatus,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirements: account.requirements,
  };
}

export async function createInvoicePaymentIntent(invoiceId: string, payerUserId?: string) {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId));

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  if (invoice.status === "paid") {
    throw new Error("Invoice already paid");
  }

  const connectAccount = await getConnectAccount(invoice.providerId);
  if (!connectAccount) {
    throw new Error("Provider has not set up payment processing");
  }

  if (!connectAccount.chargesEnabled) {
    throw new Error("Provider payment processing is not yet enabled");
  }

  const paymentIntent = await getStripe().paymentIntents.create({
    amount: invoice.totalCents,
    currency: invoice.currency || "usd",
    application_fee_amount: invoice.platformFeeCents || 0,
    transfer_data: {
      destination: connectAccount.stripeAccountId,
    },
    metadata: {
      invoiceId: invoice.id,
      providerId: invoice.providerId,
      payerUserId: payerUserId || "",
    },
  });

  await db
    .update(invoices)
    .set({
      stripePaymentIntentId: paymentIntent.id,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));

  await db.insert(payments).values({
    invoiceId: invoice.id,
    providerId: invoice.providerId,
    amountCents: invoice.totalCents,
    amount: (invoice.totalCents / 100).toFixed(2),
    method: "stripe",
    status: "requires_payment",
    stripePaymentIntentId: paymentIntent.id,
  });

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount: invoice.totalCents,
  };
}

export async function createStripeInvoice(invoiceId: string): Promise<{ stripeInvoiceId: string; hostedInvoiceUrl: string }> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!invoice) throw new Error("Invoice not found");

  // ── Idempotency: return existing Stripe invoice if already created ───────
  if (invoice.stripeInvoiceId && invoice.hostedInvoiceUrl) {
    try {
      const connectAccount = await getConnectAccount(invoice.providerId);
      if (connectAccount?.stripeAccountId) {
        const existing = await getStripe().invoices.retrieve(
          invoice.stripeInvoiceId,
          { stripeAccount: connectAccount.stripeAccountId }
        );
        if (existing && existing.status !== "void" && existing.status !== "uncollectible") {
          const hostedInvoiceUrl = existing.hosted_invoice_url || invoice.hostedInvoiceUrl;
          return { stripeInvoiceId: invoice.stripeInvoiceId, hostedInvoiceUrl };
        }
      }
    } catch {
      // Stripe invoice not found or invalid — fall through to create a fresh one
    }
  }

  const connectAccount = await getConnectAccount(invoice.providerId);
  if (!connectAccount?.stripeAccountId) throw new Error("Provider Stripe account not connected");

  const connectId = connectAccount.stripeAccountId;

  if (!invoice.clientId) throw new Error("Invoice has no client");
  const [client] = await db.select().from(clients).where(eq(clients.id, invoice.clientId));
  if (!client) throw new Error("Client not found");

  // ── 1. Find or create Stripe Customer on the connected account ──────────
  let stripeCustomerId = client.stripeConnectCustomerId;

  // Verify the stored customer still exists on this connected account
  if (stripeCustomerId) {
    try {
      const existingCustomer = await getStripe().customers.retrieve(
        stripeCustomerId,
        { stripeAccount: connectId }
      );
      if ((existingCustomer as any).deleted) {
        stripeCustomerId = null; // Deleted — recreate below
      }
    } catch {
      stripeCustomerId = null; // Not found on this account — recreate below
    }
  }

  if (!stripeCustomerId) {
    const customerName = [client.firstName, client.lastName].filter(Boolean).join(" ") || undefined;
    const customer = await getStripe().customers.create(
      {
        email: client.email || undefined,
        name: customerName,
        phone: client.phone || undefined,
        metadata: { homebaseClientId: client.id, providerId: invoice.providerId },
      },
      { stripeAccount: connectId }
    );
    stripeCustomerId = customer.id;
    await db.update(clients)
      .set({ stripeConnectCustomerId: stripeCustomerId, updatedAt: new Date() })
      .where(eq(clients.id, client.id));
  }

  // ── 2. Create Stripe Invoice Items ──────────────────────────────────────
  const rawItems = invoice.lineItems;
  const lineItems: any[] = rawItems
    ? (Array.isArray(rawItems) ? rawItems : JSON.parse(rawItems as string))
    : [];

  if (lineItems.length > 0) {
    for (const item of lineItems) {
      const unitAmountCents = Math.round(parseFloat(item.unitPrice?.toString() || "0") * 100);
      const qty = Math.max(1, Math.round(parseFloat(item.quantity?.toString() || "1")));
      await getStripe().invoiceItems.create(
        {
          customer: stripeCustomerId,
          unit_amount: unitAmountCents,
          quantity: qty,
          currency: invoice.currency || "usd",
          description: item.description || item.name || "Service",
        },
        { stripeAccount: connectId }
      );
    }
  } else {
    const totalCents = invoice.totalCents
      || Math.round(parseFloat(invoice.total?.toString() || "0") * 100);
    await getStripe().invoiceItems.create(
      {
        customer: stripeCustomerId,
        amount: totalCents,
        currency: invoice.currency || "usd",
        description: invoice.notes || `Invoice ${invoice.invoiceNumber}`,
      },
      { stripeAccount: connectId }
    );
  }

  // ── 3. Create and finalise the Stripe Invoice ───────────────────────────
  const platformFeeCents = invoice.platformFeeCents || 0;
  const daysUntilDue = invoice.dueDate
    ? Math.max(1, Math.ceil((new Date(invoice.dueDate).getTime() - Date.now()) / 86_400_000))
    : 30;

  const stripeInvoice = await getStripe().invoices.create(
    {
      customer: stripeCustomerId,
      collection_method: "send_invoice",
      days_until_due: daysUntilDue,
      ...(platformFeeCents > 0 ? { application_fee_amount: platformFeeCents } : {}),
      metadata: {
        homebaseInvoiceId: invoice.id,
        providerId: invoice.providerId,
      },
    },
    { stripeAccount: connectId }
  );

  const finalized = await getStripe().invoices.finalizeInvoice(
    stripeInvoice.id,
    { stripeAccount: connectId }
  );

  const hostedInvoiceUrl = finalized.hosted_invoice_url || "";

  // ── 4. Persist Stripe IDs on our invoice row ────────────────────────────
  await db.update(invoices)
    .set({ stripeInvoiceId: finalized.id, hostedInvoiceUrl, updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId));

  return { stripeInvoiceId: finalized.id, hostedInvoiceUrl };
}

export async function createStripeCheckoutSession(invoiceId: string) {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId));

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const connectAccount = await getConnectAccount(invoice.providerId);
  if (!connectAccount) {
    const err = new Error("stripe_not_ready") as Error & { code: string };
    err.code = "stripe_not_ready";
    throw err;
  }

  if (!connectAccount.chargesEnabled) {
    const err = new Error("stripe_not_ready") as Error & { code: string };
    err.code = "stripe_not_ready";
    throw err;
  }

  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, invoice.providerId));

  const lineItemsData = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId));

  const stripeLineItems = lineItemsData.map((item) => ({
    price_data: {
      currency: invoice.currency || "usd",
      product_data: {
        name: item.name,
        description: item.description || undefined,
      },
      unit_amount: item.unitPriceCents,
    },
    quantity: Math.round(parseFloat(item.quantity?.toString() || "1")),
  }));

  if (stripeLineItems.length === 0) {
    stripeLineItems.push({
      price_data: {
        currency: invoice.currency || "usd",
        product_data: {
          name: `Invoice ${invoice.invoiceNumber}`,
          description: invoice.notes || undefined,
        },
        unit_amount: invoice.totalCents,
      },
      quantity: 1,
    });
  }

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: stripeLineItems,
    payment_intent_data: {
      application_fee_amount: invoice.platformFeeCents || 0,
      transfer_data: {
        destination: connectAccount.stripeAccountId,
      },
      metadata: {
        invoiceId: invoice.id,
        providerId: invoice.providerId,
      },
    },
    success_url: `${APP_URL}/invoice/${invoiceId}/success`,
    cancel_url: `${APP_URL}/invoice/${invoiceId}/cancel`,
    metadata: {
      invoiceId: invoice.id,
      providerId: invoice.providerId,
    },
  });

  await db
    .update(invoices)
    .set({
      stripeCheckoutSessionId: session.id,
      hostedInvoiceUrl: session.url,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));

  return {
    sessionId: session.id,
    checkoutUrl: session.url,
  };
}

export async function applyCreditsToInvoice(
  invoiceId: string,
  userId: string,
  amountCents: number
) {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId));

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const allowedMethods = invoice.paymentMethodsAllowed || "stripe,credits";
  if (!allowedMethods.includes("credits")) {
    throw new Error("This invoice does not accept credit payments");
  }

  const [userCredit] = await db
    .select()
    .from(userCredits)
    .where(eq(userCredits.userId, userId));

  if (!userCredit || (userCredit.balanceCents || 0) < amountCents) {
    throw new Error("Insufficient credits");
  }

  const maxPayable = invoice.totalCents - (await getPaidAmount(invoiceId));
  const actualAmount = Math.min(amountCents, maxPayable);

  if (actualAmount <= 0) {
    throw new Error("Invoice is already paid or no amount due");
  }

  await db
    .update(userCredits)
    .set({
      balanceCents: (userCredit.balanceCents || 0) - actualAmount,
      updatedAt: new Date(),
    })
    .where(eq(userCredits.userId, userId));

  await db.insert(creditLedger).values({
    userId,
    deltaCents: -actualAmount,
    reason: "invoice_payment",
    invoiceId,
  });

  await db.insert(payments).values({
    invoiceId,
    providerId: invoice.providerId,
    amountCents: actualAmount,
    amount: (actualAmount / 100).toFixed(2),
    method: "credits",
    status: "succeeded",
  });

  const newPaidAmount = await getPaidAmount(invoiceId);
  const isFullyPaid = newPaidAmount >= invoice.totalCents;

  await db
    .update(invoices)
    .set({
      status: isFullyPaid ? "paid" : "partially_paid",
      paidAt: isFullyPaid ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));

  return {
    applied: actualAmount,
    remainingBalance: (userCredit.balanceCents || 0) - actualAmount,
    invoiceStatus: isFullyPaid ? "paid" : "partially_paid",
  };
}

async function getPaidAmount(invoiceId: string): Promise<number> {
  const allPayments = await db
    .select()
    .from(payments)
    .where(and(eq(payments.invoiceId, invoiceId), eq(payments.status, "succeeded")));

  return allPayments.reduce((sum, p) => sum + (p.amountCents || 0), 0);
}

export async function handleStripeWebhook(event: Stripe.Event) {
  const [existing] = await db
    .select()
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.stripeEventId, event.id));

  if (existing) {
    console.log(`Webhook event ${event.id} already processed, skipping`);
    return { processed: false, reason: "duplicate" };
  }

  await db.insert(stripeWebhookEvents).values({
    stripeEventId: event.id,
    eventType: event.type,
    payload: JSON.stringify(event.data),
  });

  switch (event.type) {
    case "account.updated":
      await handleAccountUpdated(event.data.object as Stripe.Account);
      break;

    case "payment_intent.succeeded":
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;

    case "payment_intent.payment_failed":
      await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
      break;

    case "charge.refunded":
      await handleChargeRefunded(event.data.object as Stripe.Charge);
      break;

    case "payout.created":
      await handlePayoutCreated(event.data.object as Stripe.Payout, event.account ?? null);
      break;

    case "payout.paid":
      await handlePayoutPaid(event.data.object as Stripe.Payout, event.account ?? null);
      break;

    case "payout.failed":
      await handlePayoutFailed(event.data.object as Stripe.Payout, event.account ?? null);
      break;

    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case "invoice.paid":
      await handleStripeInvoicePaid(event.data.object as Stripe.Invoice);
      break;

    case "invoice.payment_failed":
      await handleStripeInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    default:
      console.log(`Unhandled webhook event type: ${event.type}`);
  }

  return { processed: true };
}

async function handleAccountUpdated(account: Stripe.Account) {
  const [connectAccount] = await db
    .select()
    .from(stripeConnectAccounts)
    .where(eq(stripeConnectAccounts.stripeAccountId, account.id));

  if (!connectAccount) return;

  let onboardingStatus: "not_started" | "pending" | "complete" = "pending";
  if (account.charges_enabled && account.payouts_enabled && account.details_submitted) {
    onboardingStatus = "complete";
  }

  await db
    .update(stripeConnectAccounts)
    .set({
      onboardingStatus,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted || false,
      updatedAt: new Date(),
    })
    .where(eq(stripeConnectAccounts.id, connectAccount.id));
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const invoiceId = paymentIntent.metadata?.invoiceId;
  if (!invoiceId) return;

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.stripePaymentIntentId, paymentIntent.id));

  if (payment) {
    await db
      .update(payments)
      .set({
        status: "succeeded",
        stripeChargeId: paymentIntent.latest_charge?.toString(),
      })
      .where(eq(payments.id, payment.id));
  }

  const [updatedInvoice] = await db
    .update(invoices)
    .set({
      status: "paid",
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId))
    .returning();

  // Dispatch invoice.paid notification via webhook
  if (updatedInvoice) {
    try {
      const [provider] = await db.select().from(providers).where(eq(providers.id, updatedInvoice.providerId));
      let clientEmail: string | undefined;
      let clientName: string | undefined;
      if (updatedInvoice.homeownerUserId) {
        const [homeowner] = await db.select().from(users).where(eq(users.id, updatedInvoice.homeownerUserId));
        if (homeowner) {
          clientEmail = homeowner.email;
          clientName = `${homeowner.firstName || ''} ${homeowner.lastName || ''}`.trim() || homeowner.email;
        }
      } else if (updatedInvoice.clientId) {
        const [client] = await db.select().from(clients).where(eq(clients.id, updatedInvoice.clientId));
        if (client) {
          clientEmail = client.email ?? undefined;
          clientName = `${client.firstName || ''} ${client.lastName || ''}`.trim() || clientEmail;
        }
      }
      if (clientEmail && provider) {
        dispatch('invoice.paid', {
          clientEmail,
          clientName: clientName ?? clientEmail,
          providerName: provider.businessName,
          invoiceNumber: updatedInvoice.invoiceNumber,
          amount: typeof updatedInvoice.total === 'string' ? parseFloat(updatedInvoice.total) : (updatedInvoice.total ?? 0),
          paymentDate: new Date().toLocaleDateString(),
          relatedRecordType: 'invoice',
          relatedRecordId: invoiceId,
        }).catch((e: unknown) => console.error('invoice.paid dispatch error (webhook):', e));
      }

      // HouseFax: update costCents on the housefax entry for the invoice's linked job (if any)
      // Uses invoice.jobId for deterministic association (no guessing)
      (async () => {
        try {
          const jobId = updatedInvoice.jobId;
          if (!jobId) return; // Only enrich when invoice is directly linked to a job

          const costCents = updatedInvoice.total
            ? Math.round((typeof updatedInvoice.total === 'string' ? parseFloat(updatedInvoice.total) : updatedInvoice.total) * 100)
            : 0;
          if (costCents <= 0) return;

          const [entry] = await db
            .select({ id: housefaxEntries.id, costCents: housefaxEntries.costCents })
            .from(housefaxEntries)
            .where(eq(housefaxEntries.jobId, jobId));

          if (entry) {
            // Update cost on existing entry
            await db.update(housefaxEntries)
              .set({ costCents })
              .where(eq(housefaxEntries.id, entry.id));
            console.log(`[HouseFax] Updated cost for job ${jobId} to ${costCents} cents via payment webhook`);
          } else {
            // No entry yet - create HouseFax entry inline using job data + confirmed payment cost
            const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
            if (job && job.status === 'completed') {
              // Find homeId from the client
              let homeId: string | null = null;
              if (job.appointmentId) {
                const [appt] = await db.select({ homeId: appointments.homeId })
                  .from(appointments)
                  .where(eq(appointments.id, job.appointmentId));
                if (appt) homeId = appt.homeId;
              }
              // Fall back: find homeId via the job's linked invoice (homeownerUserId -> homes)
              if (!homeId) {
                const [inv] = await db
                  .select({ homeownerUserId: invoices.homeownerUserId })
                  .from(invoices)
                  .where(eq(invoices.jobId, job.id));
                if (inv?.homeownerUserId) {
                  const [home] = await db.select({ id: homes.id })
                    .from(homes)
                    .where(eq(homes.userId, inv.homeownerUserId));
                  if (home) homeId = home.id;
                }
              }
              if (homeId) {
                // Double-check no entry was created concurrently
                const [existing] = await db.select({ id: housefaxEntries.id })
                  .from(housefaxEntries)
                  .where(eq(housefaxEntries.jobId, job.id));
                if (!existing) {
                  const [provider] = job.providerId
                    ? await db.select({ businessName: providers.businessName }).from(providers).where(eq(providers.id, job.providerId))
                    : [null];
                  await db.insert(housefaxEntries).values({
                    homeId,
                    jobId: job.id,
                    appointmentId: job.appointmentId || null,
                    serviceCategory: 'General',
                    serviceName: job.title,
                    providerId: job.providerId || null,
                    providerName: provider?.businessName || null,
                    completedAt: job.completedAt || new Date(),
                    costCents,
                    aiSummary: null,
                    photos: [],
                    systemAffected: 'General',
                    notes: job.notes || null,
                  });
                  console.log(`[HouseFax] Created entry for job ${jobId} with cost ${costCents} cents via payment webhook`);
                }
              }
            }
          }
        } catch (e) {
          console.error('[HouseFax] Payment webhook cost update error:', e);
        }
      })();
    } catch (err) {
      console.error('Failed to dispatch invoice.paid from webhook:', err);
    }
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const invoiceId = paymentIntent.metadata?.invoiceId;

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.stripePaymentIntentId, paymentIntent.id));

  if (payment) {
    await db
      .update(payments)
      .set({ status: "failed" })
      .where(eq(payments.id, payment.id));
  }

  // Dispatch payment_failed notification
  if (invoiceId) {
    try {
      const [failedInvoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (failedInvoice) {
        const [provider] = await db.select().from(providers).where(eq(providers.id, failedInvoice.providerId));
        let clientEmail: string | undefined;
        let clientName: string | undefined;
        if (failedInvoice.homeownerUserId) {
          const [homeowner] = await db.select().from(users).where(eq(users.id, failedInvoice.homeownerUserId));
          if (homeowner) {
            clientEmail = homeowner.email;
            clientName = `${homeowner.firstName || ''} ${homeowner.lastName || ''}`.trim() || homeowner.email;
          }
        } else if (failedInvoice.clientId) {
          const [client] = await db.select().from(clients).where(eq(clients.id, failedInvoice.clientId));
          if (client) {
            clientEmail = client.email ?? undefined;
            clientName = `${client.firstName || ''} ${client.lastName || ''}`.trim() || clientEmail;
          }
        }
        if (clientEmail && provider) {
          dispatch('invoice.payment_failed', {
            clientEmail,
            clientName: clientName ?? clientEmail,
            providerName: provider.businessName,
            invoiceNumber: failedInvoice.invoiceNumber,
            amount: typeof failedInvoice.total === 'string' ? parseFloat(failedInvoice.total) : (failedInvoice.total ?? 0),
            relatedRecordType: 'invoice',
            relatedRecordId: invoiceId,
          }).catch((e: unknown) => console.error('invoice.payment_failed dispatch error:', e));
        }
      }
    } catch (err) {
      console.error('Failed to dispatch invoice.payment_failed from webhook:', err);
    }
  }
}

async function handleStripeInvoicePaid(stripeInvoice: Stripe.Invoice) {
  const homebaseInvoiceId = stripeInvoice.metadata?.homebaseInvoiceId;
  if (!homebaseInvoiceId) return;

  const [updatedInvoice] = await db
    .update(invoices)
    .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
    .where(eq(invoices.id, homebaseInvoiceId))
    .returning();

  if (!updatedInvoice) return;

  try {
    const [provider] = await db.select().from(providers).where(eq(providers.id, updatedInvoice.providerId));
    let clientEmail: string | undefined;
    let clientName: string | undefined;
    if (updatedInvoice.clientId) {
      const [client] = await db.select().from(clients).where(eq(clients.id, updatedInvoice.clientId));
      if (client) {
        clientEmail = client.email ?? undefined;
        clientName = `${client.firstName || ''} ${client.lastName || ''}`.trim() || clientEmail;
      }
    } else if (updatedInvoice.homeownerUserId) {
      const [homeowner] = await db.select().from(users).where(eq(users.id, updatedInvoice.homeownerUserId));
      if (homeowner) {
        clientEmail = homeowner.email;
        clientName = `${homeowner.firstName || ''} ${homeowner.lastName || ''}`.trim() || homeowner.email;
      }
    }
    if (clientEmail && provider) {
      dispatch('invoice.paid', {
        clientEmail,
        clientName: clientName ?? clientEmail,
        providerName: provider.businessName,
        invoiceNumber: updatedInvoice.invoiceNumber,
        amount: typeof updatedInvoice.total === 'string' ? parseFloat(updatedInvoice.total) : (updatedInvoice.total ?? 0),
        paymentDate: new Date().toLocaleDateString(),
        relatedRecordType: 'invoice',
        relatedRecordId: homebaseInvoiceId,
      }).catch((e: unknown) => console.error('invoice.paid dispatch error (stripe invoice webhook):', e));
    }
  } catch (err) {
    console.error('Failed to dispatch invoice.paid from stripe invoice webhook:', err);
  }
}

async function handleStripeInvoicePaymentFailed(stripeInvoice: Stripe.Invoice) {
  const homebaseInvoiceId = stripeInvoice.metadata?.homebaseInvoiceId;
  if (!homebaseInvoiceId) return;

  try {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, homebaseInvoiceId));
    if (!invoice) return;
    const [provider] = await db.select().from(providers).where(eq(providers.id, invoice.providerId));
    let clientEmail: string | undefined;
    let clientName: string | undefined;
    if (invoice.clientId) {
      const [client] = await db.select().from(clients).where(eq(clients.id, invoice.clientId));
      if (client) {
        clientEmail = client.email ?? undefined;
        clientName = `${client.firstName || ''} ${client.lastName || ''}`.trim() || clientEmail;
      }
    } else if (invoice.homeownerUserId) {
      const [homeowner] = await db.select().from(users).where(eq(users.id, invoice.homeownerUserId));
      if (homeowner) {
        clientEmail = homeowner.email;
        clientName = `${homeowner.firstName || ''} ${homeowner.lastName || ''}`.trim() || homeowner.email;
      }
    }
    if (clientEmail && provider) {
      dispatch('invoice.payment_failed', {
        clientEmail,
        clientName: clientName ?? clientEmail,
        providerName: provider.businessName,
        invoiceNumber: invoice.invoiceNumber,
        amount: typeof invoice.total === 'string' ? parseFloat(invoice.total) : (invoice.total ?? 0),
        relatedRecordType: 'invoice',
        relatedRecordId: homebaseInvoiceId,
      }).catch((e: unknown) => console.error('invoice.payment_failed dispatch error (stripe invoice webhook):', e));
    }
  } catch (err) {
    console.error('Failed to dispatch invoice.payment_failed from stripe invoice webhook:', err);
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId = charge.payment_intent?.toString() ?? null;
  const chargeId = charge.id;

  // Look up payment by paymentIntentId first, fall back to chargeId for legacy records
  let payment: typeof payments.$inferSelect | undefined;
  if (paymentIntentId) {
    const [byIntent] = await db
      .select()
      .from(payments)
      .where(eq(payments.stripePaymentIntentId, paymentIntentId));
    payment = byIntent;
  }
  if (!payment) {
    const [byCharge] = await db
      .select()
      .from(payments)
      .where(eq(payments.stripeChargeId, chargeId));
    payment = byCharge;
  }

  if (payment) {
    await db
      .update(payments)
      .set({ status: "refunded" })
      .where(eq(payments.id, payment.id));

    await db
      .update(invoices)
      .set({
        status: "refunded",
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, payment.invoiceId));

    // Upsert refund records for each Stripe refund on this charge
    if (charge.refunds?.data?.length) {
      for (const stripeRefund of charge.refunds.data) {
        const existing = await db
          .select()
          .from(refunds)
          .where(eq(refunds.stripeRefundId, stripeRefund.id));

        if (existing.length === 0) {
          await db.insert(refunds).values({
            providerId: payment.providerId,
            paymentId: payment.id,
            stripeRefundId: stripeRefund.id,
            stripeChargeId: charge.id,
            amountCents: stripeRefund.amount,
            reason: stripeRefund.reason ?? null,
            status: (stripeRefund.status as "pending" | "succeeded" | "failed" | "canceled") ?? "pending",
          });
        } else {
          await db
            .update(refunds)
            .set({ status: (stripeRefund.status as "pending" | "succeeded" | "failed" | "canceled") ?? "pending" })
            .where(eq(refunds.stripeRefundId, stripeRefund.id));
        }
      }
    }
  }
}

async function resolveProviderFromConnectAccount(connectedAccountId: string | null): Promise<string | null> {
  if (!connectedAccountId) return null;
  const [connectAccount] = await db
    .select({ providerId: stripeConnectAccounts.providerId })
    .from(stripeConnectAccounts)
    .where(eq(stripeConnectAccounts.stripeAccountId, connectedAccountId));
  return connectAccount?.providerId ?? null;
}

async function handlePayoutCreated(payout: Stripe.Payout, connectedAccountId: string | null) {
  const providerId = await resolveProviderFromConnectAccount(connectedAccountId);
  if (!providerId) {
    console.warn(`handlePayoutCreated: no provider found for account ${connectedAccountId}`);
    return;
  }

  const arrivalDate = payout.arrival_date ? new Date(payout.arrival_date * 1000) : null;

  const [existingPayout] = await db
    .select()
    .from(payouts)
    .where(eq(payouts.stripePayoutId, payout.id));

  const stripeStatus = payout.status as "paid" | "pending" | "in_transit" | "canceled" | "failed";

  if (!existingPayout) {
    await db.insert(payouts).values({
      providerId,
      amountCents: payout.amount,
      status: stripeStatus,
      stripePayoutId: payout.id,
      arrivalDate,
      description: payout.description ?? null,
    }).onConflictDoNothing();
  } else {
    await db
      .update(payouts)
      .set({ status: stripeStatus, arrivalDate, description: payout.description ?? null })
      .where(eq(payouts.id, existingPayout.id));
  }
}

async function handlePayoutPaid(payout: Stripe.Payout, connectedAccountId: string | null) {
  const arrivalDate = payout.arrival_date ? new Date(payout.arrival_date * 1000) : null;

  const [existingPayout] = await db
    .select()
    .from(payouts)
    .where(eq(payouts.stripePayoutId, payout.id));

  if (existingPayout) {
    await db
      .update(payouts)
      .set({
        status: "paid",
        arrivalDate: arrivalDate ?? existingPayout.arrivalDate,
        description: payout.description ?? existingPayout.description,
      })
      .where(eq(payouts.id, existingPayout.id));
  } else {
    // Payout created outside our system — create the record now
    const providerId = await resolveProviderFromConnectAccount(connectedAccountId);
    if (providerId) {
      await db.insert(payouts).values({
        providerId,
        amountCents: payout.amount,
        status: "paid",
        stripePayoutId: payout.id,
        arrivalDate,
        description: payout.description ?? null,
      }).onConflictDoNothing();
    }
  }
}

async function handlePayoutFailed(payout: Stripe.Payout, _connectedAccountId: string | null) {
  const [existingPayout] = await db
    .select()
    .from(payouts)
    .where(eq(payouts.stripePayoutId, payout.id));

  if (existingPayout) {
    await db
      .update(payouts)
      .set({ status: "failed" })
      .where(eq(payouts.id, existingPayout.id));
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) return;

  await db
    .update(invoices)
    .set({
      status: "paid",
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));

  const paymentIntentId = session.payment_intent?.toString();
  if (paymentIntentId) {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId));

    if (invoice) {
      await db.insert(payments).values({
        invoiceId,
        providerId: invoice.providerId,
        amountCents: invoice.totalCents,
        amount: (invoice.totalCents / 100).toFixed(2),
        method: "stripe",
        status: "succeeded",
        stripePaymentIntentId: paymentIntentId,
      });
    }
  }
}

export async function calculateFeePreview(providerId: string, totalCents: number) {
  const plan = await getProviderPlan(providerId);
  const fee = calculatePlatformFee(
    totalCents,
    plan.platformFeePercent || "3.00",
    plan.platformFeeFixedCents || 0
  );

  return {
    planTier: plan.planTier,
    feePercent: fee.percent,
    feeFixedCents: fee.fixedCents,
    totalFeeCents: fee.totalCents,
    providerReceivesCents: totalCents - fee.totalCents,
  };
}

/**
 * Creates (idempotent) and actually sends a Stripe invoice to the client.
 * After finalizing, calls stripe.invoices.sendInvoice so Stripe emails the
 * client a hosted payment page directly.
 */
export async function sendStripeInvoiceEmail(invoiceId: string): Promise<{ stripeInvoiceId: string; hostedInvoiceUrl: string }> {
  // Create + finalize (idempotent — returns existing if already done)
  const { stripeInvoiceId, hostedInvoiceUrl } = await createStripeInvoice(invoiceId);

  // Look up the connected account so we can send on behalf of it
  const [inv] = await db.select({ providerId: invoices.providerId }).from(invoices).where(eq(invoices.id, invoiceId));
  if (!inv) throw new Error("Invoice not found");
  const connectAccount = await getConnectAccount(inv.providerId);
  if (!connectAccount?.stripeAccountId) throw new Error("Provider Stripe account not found");

  // This makes Stripe email the client a branded hosted payment page
  await getStripe().invoices.sendInvoice(stripeInvoiceId, { stripeAccount: connectAccount.stripeAccountId });

  return { stripeInvoiceId, hostedInvoiceUrl };
}

export { getStripe };
