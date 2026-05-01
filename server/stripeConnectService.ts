import Stripe from "stripe";
import { db } from "./db";
import { eq, and, inArray } from "drizzle-orm";
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
import { dispatch, dispatchNotification, claimNotificationDelivery, logDelivery } from "./notificationService";

let stripe: Stripe | null = null;

// In production the `STRIPE_TEST_SECRET_KEY` dev override is IGNORED — we always
// use the platform secret key set in the deployment env. Locally (any non-prod
// environment) the test-mode override is honored first so developers can run
// against Stripe test mode without swapping their live secret.
function getStripe(): Stripe {
  if (!stripe) {
    const isProd = process.env.NODE_ENV === "production";
    const apiKey = isProd
      ? process.env.STRIPE_SECRET_KEY
      : process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error(
        isProd
          ? "STRIPE_SECRET_KEY is required in production. Set the live secret key in the deployment env."
          : "STRIPE_TEST_SECRET_KEY or STRIPE_SECRET_KEY is required. Please add it to your environment variables.",
      );
    }
    if (isProd && !apiKey.startsWith("sk_live_")) {
      console.warn(
        `[stripe] WARNING: NODE_ENV=production but STRIPE_SECRET_KEY does not start with sk_live_. ` +
          `The app will run in Stripe test mode — real payments will NOT be processed.`,
      );
    }
    stripe = new Stripe(apiKey);
  }
  return stripe;
}

// Test-only seam: regression tests (server/scripts/testInvoiceConnectRouting.ts)
// inject a stub Stripe to assert request shape / connect-account routing
// without making live API calls. Pass `null` to clear and re-derive the real
// client on next call. Production code MUST NOT call this.
export function __setStripeForTesting(client: Stripe | null): void {
  stripe = client;
}

// Exposed so routes/webhooks can inspect whether the active Stripe client is
// talking to live mode — used to gate live-mode-only features (e.g. detecting
// legacy test-mode Connect accounts that must re-onboard).
export function isStripeLiveMode(): boolean {
  const isProd = process.env.NODE_ENV === "production";
  const apiKey = isProd
    ? process.env.STRIPE_SECRET_KEY
    : process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  return !!apiKey && apiKey.startsWith("sk_live_");
}

const APP_URL =
  process.env.APP_URL ||
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "https://homebase.replit.app");

// Public, branded base URL for any user-facing redirect from Stripe Checkout
// (success_url / cancel_url). MUST NOT fall back to a Replit dev domain — those
// surface as broken-looking unbranded redirects to end users.
const PUBLIC_REDIRECT_BASE =
  process.env.PUBLIC_APP_URL ||
  process.env.SUBSCRIPTION_RETURN_URL ||
  "https://homebaseproapp.com";

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
  fixedCents: number = 0,
): PlatformFee {
  const percent =
    typeof feePercent === "string" ? parseFloat(feePercent) : feePercent;
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

/**
 * Single source of truth for "is this provider allowed to be discoverable
 * and accept payments?". A provider is ready when their Connect account
 * exists AND charges are enabled. Used to gate publish, public listings,
 * and the public booking page so homeowners never land on a provider who
 * cannot collect payment.
 */
export async function isProviderReadyForCharges(
  providerId: string,
): Promise<boolean> {
  const account = await getConnectAccount(providerId);
  return !!(account && account.chargesEnabled);
}

/**
 * Bulk version of isProviderReadyForCharges — returns the subset of the
 * given provider IDs whose Connect account is ready to accept charges.
 * Used to filter homeowner-facing provider lists in one query.
 */
export async function getProviderReadinessSet(
  providerIds: string[],
): Promise<Set<string>> {
  if (providerIds.length === 0) return new Set();
  const rows = await db
    .select({ providerId: stripeConnectAccounts.providerId })
    .from(stripeConnectAccounts)
    .where(
      and(
        inArray(stripeConnectAccounts.providerId, providerIds),
        eq(stripeConnectAccounts.chargesEnabled, true),
      ),
    );
  return new Set(rows.map((r) => r.providerId));
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
        livemode: (account as any).livemode ?? isStripeLiveMode(),
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
      livemode: isStripeLiveMode(),
      needsReonboarding: false,
    };
  }

  // If the platform is running in live mode but this Connect account belongs to
  // test mode (or vice-versa), accounts.retrieve will 404 because test-mode
  // account IDs are invalid under a live API key. Catch that case and flag it
  // as a re-onboarding requirement instead of surfacing a 500.
  let account: Stripe.Account;
  try {
    account = await getStripe().accounts.retrieve(
      connectAccount.stripeAccountId,
    );
  } catch (err: any) {
    const code = err?.code || err?.raw?.code;
    if (
      code === "account_invalid" ||
      code === "resource_missing" ||
      err?.statusCode === 404
    ) {
      console.warn(
        `[stripe-connect] accounts.retrieve(${connectAccount.stripeAccountId}) failed — ` +
          `likely a ${isStripeLiveMode() ? "test-mode" : "live-mode"} account under ` +
          `${isStripeLiveMode() ? "live" : "test"} API key. Provider must re-onboard.`,
      );
      return {
        exists: true,
        accountId: connectAccount.stripeAccountId,
        onboardingStatus: "not_started" as const,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        livemode: isStripeLiveMode(),
        needsReonboarding: true,
      };
    }
    throw err;
  }

  let onboardingStatus: "not_started" | "pending" | "complete" = "pending";
  if (
    account.charges_enabled &&
    account.payouts_enabled &&
    account.details_submitted
  ) {
    onboardingStatus = "complete";
  }

  await db
    .update(stripeConnectAccounts)
    .set({
      onboardingStatus,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted || false,
      livemode: (account as any).livemode ?? isStripeLiveMode(),
      updatedAt: new Date(),
    })
    .where(eq(stripeConnectAccounts.id, connectAccount.id));

  const accountLivemode = (account as any).livemode ?? isStripeLiveMode();
  const needsReonboarding = isStripeLiveMode() && !accountLivemode;

  return {
    exists: true,
    accountId: connectAccount.stripeAccountId,
    onboardingStatus,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirements: account.requirements,
    livemode: accountLivemode,
    needsReonboarding,
  };
}

// Force-create a fresh Connect account (used when a provider's existing account
// is in the wrong mode — e.g. test-mode account under a live API key). Wipes
// the local record's Stripe IDs and issues a new onboarding link.
export async function reonboardConnectAccount(providerId: string) {
  await db
    .delete(stripeConnectAccounts)
    .where(eq(stripeConnectAccounts.providerId, providerId));
  return createConnectAccountLink(providerId);
}

export async function createInvoicePaymentIntent(
  invoiceId: string,
  payerUserId?: string,
) {
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

export async function createStripeInvoice(
  invoiceId: string,
): Promise<{ stripeInvoiceId: string; hostedInvoiceUrl: string }> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId));
  if (!invoice) throw new Error("Invoice not found");

  // ── Idempotency: return existing Stripe invoice if already created ───────
  if (invoice.stripeInvoiceId && invoice.hostedInvoiceUrl) {
    try {
      const connectAccount = await getConnectAccount(invoice.providerId);
      if (connectAccount?.stripeAccountId) {
        const existing = await getStripe().invoices.retrieve(
          invoice.stripeInvoiceId,
          { stripeAccount: connectAccount.stripeAccountId },
        );
        if (
          existing &&
          existing.status !== "void" &&
          existing.status !== "uncollectible"
        ) {
          const hostedInvoiceUrl =
            existing.hosted_invoice_url || invoice.hostedInvoiceUrl;
          return { stripeInvoiceId: invoice.stripeInvoiceId, hostedInvoiceUrl };
        }
      }
    } catch {
      // Stripe invoice not found or invalid — fall through to create a fresh one
    }
  }

  const connectAccount = await getConnectAccount(invoice.providerId);
  if (!connectAccount?.stripeAccountId) {
    const err = new Error(
      "Provider has not finished Stripe Connect onboarding — payments cannot be processed yet.",
    ) as Error & { code: string };
    err.code = "stripe_not_ready";
    throw err;
  }
  if (!connectAccount.chargesEnabled) {
    const err = new Error(
      "Provider Stripe Connect account is not yet enabled to accept charges.",
    ) as Error & { code: string };
    err.code = "stripe_not_ready";
    throw err;
  }

  const connectId = connectAccount.stripeAccountId;

  if (!invoice.clientId) throw new Error("Invoice has no client");
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, invoice.clientId));
  if (!client) throw new Error("Client not found");

  // ── 1. Find or create Stripe Customer on the connected account ──────────
  let stripeCustomerId = client.stripeConnectCustomerId;

  // Verify the stored customer still exists on this connected account
  if (stripeCustomerId) {
    try {
      const existingCustomer = await getStripe().customers.retrieve(
        stripeCustomerId,
        { stripeAccount: connectId },
      );
      if ((existingCustomer as any).deleted) {
        stripeCustomerId = null; // Deleted — recreate below
      }
    } catch {
      stripeCustomerId = null; // Not found on this account — recreate below
    }
  }

  if (!stripeCustomerId) {
    const customerName =
      [client.firstName, client.lastName].filter(Boolean).join(" ") ||
      undefined;
    const customer = await getStripe().customers.create(
      {
        email: client.email || undefined,
        name: customerName,
        phone: client.phone || undefined,
        metadata: {
          homebaseClientId: client.id,
          providerId: invoice.providerId,
        },
      },
      { stripeAccount: connectId },
    );
    stripeCustomerId = customer.id;
    await db
      .update(clients)
      .set({ stripeConnectCustomerId: stripeCustomerId, updatedAt: new Date() })
      .where(eq(clients.id, client.id));
  }

  // ── 2. Create Stripe Invoice Items ──────────────────────────────────────
  const rawItems = invoice.lineItems;
  const lineItems: any[] = rawItems
    ? Array.isArray(rawItems)
      ? rawItems
      : JSON.parse(rawItems as string)
    : [];

  if (lineItems.length > 0) {
    for (const item of lineItems) {
      const unitAmountCents = Math.round(
        parseFloat(item.unitPrice?.toString() || "0") * 100,
      );
      const qty = Math.max(
        1,
        Math.round(parseFloat(item.quantity?.toString() || "1")),
      );
      await getStripe().invoiceItems.create(
        {
          customer: stripeCustomerId,
          unit_amount: unitAmountCents,
          quantity: qty,
          currency: invoice.currency || "usd",
          description: item.description || item.name || "Service",
        },
        { stripeAccount: connectId },
      );
    }
  } else {
    const totalCents =
      invoice.totalCents ||
      Math.round(parseFloat(invoice.total?.toString() || "0") * 100);
    await getStripe().invoiceItems.create(
      {
        customer: stripeCustomerId,
        amount: totalCents,
        currency: invoice.currency || "usd",
        description: invoice.notes || `Invoice ${invoice.invoiceNumber}`,
      },
      { stripeAccount: connectId },
    );
  }

  // ── 3. Create and finalise the Stripe Invoice ───────────────────────────
  // NOTE on the Connect billing model: Stripe Invoices created on a connected
  // account use the *direct charge* model — funds settle directly to the
  // connected account and HomeBase takes its cut via `application_fee_amount`.
  // The Stripe Invoice API does not support `transfer_data.destination`
  // (that field is only valid on PaymentIntents / Checkout Sessions, which we
  // do use in `createInvoicePaymentIntent` and `createStripeCheckoutSession`).
  // Both routes are valid Stripe Connect payment flows for the platform.
  const platformFeeCents = invoice.platformFeeCents || 0;
  const daysUntilDue = invoice.dueDate
    ? Math.max(
        1,
        Math.ceil(
          (new Date(invoice.dueDate).getTime() - Date.now()) / 86_400_000,
        ),
      )
    : 30;

  // Hard runtime guard (Task #245): refuse to call Stripe if `connectId` is
  // not a real connected-account id. A regression that drops the
  // `stripeAccount` option here would silently route invoices to the
  // platform balance — exactly the bug we just spent a task fixing.
  if (
    typeof connectId !== "string" ||
    !connectId.startsWith("acct_") ||
    connectId.length < 10
  ) {
    throw new Error(
      `[stripe-connect-routing] refusing to create invoice without a valid connected-account id (got: ${JSON.stringify(connectId)}, providerId=${invoice.providerId}, invoiceId=${invoice.id})`,
    );
  }

  const stripeInvoice = await getStripe().invoices.create(
    {
      customer: stripeCustomerId,
      collection_method: "send_invoice",
      days_until_due: daysUntilDue,
      ...(platformFeeCents > 0
        ? { application_fee_amount: platformFeeCents }
        : {}),
      metadata: {
        homebaseInvoiceId: invoice.id,
        providerId: invoice.providerId,
      },
    },
    { stripeAccount: connectId },
  );

  const finalized = await getStripe().invoices.finalizeInvoice(
    stripeInvoice.id,
    { stripeAccount: connectId },
  );

  const hostedInvoiceUrl = finalized.hosted_invoice_url || "";

  // ── 4. Persist Stripe IDs on our invoice row ────────────────────────────
  await db
    .update(invoices)
    .set({
      stripeInvoiceId: finalized.id,
      hostedInvoiceUrl,
      updatedAt: new Date(),
    })
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
    success_url: `${PUBLIC_REDIRECT_BASE}/payment-success?invoiceId=${encodeURIComponent(invoiceId)}${invoice.jobId ? `&jobId=${encodeURIComponent(invoice.jobId)}` : ""}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${PUBLIC_REDIRECT_BASE}/payment-cancelled?invoiceId=${encodeURIComponent(invoiceId)}${invoice.jobId ? `&jobId=${encodeURIComponent(invoice.jobId)}` : ""}`,
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

/**
 * REMOVED in Task #150 — was a platform-only Checkout Session that bypassed
 * Stripe Connect. All provider checkout sessions must go through
 * `createStripeCheckoutSession` (destination charge + application_fee_amount).
 * This stub throws so any reintroduced caller fails loudly.
 */
export async function createDirectCheckoutSession(
  _invoiceId: string,
  _reqHost?: string,
): Promise<{ checkoutUrl: string; sessionId: string }> {
  // Task #150 disabled this path; all provider checkouts go through
  // `createStripeCheckoutSession` (which already uses the branded
  // `/payment-success` and `/payment-cancelled` URLs introduced in Task #153).
  throw new Error(
    "createDirectCheckoutSession is disabled — use createStripeCheckoutSession (Stripe Connect).",
  );
}

export async function applyCreditsToInvoice(
  invoiceId: string,
  userId: string,
  amountCents: number,
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
    .where(
      and(eq(payments.invoiceId, invoiceId), eq(payments.status, "succeeded")),
    );

  return allPayments.reduce((sum, p) => sum + (p.amountCents || 0), 0);
}

/**
 * Backwards-compat shim. The real dispatcher lives in stripeWebhookRouter.ts
 * and enforces endpoint routing, idempotency, structured logging, and
 * connected-account resolution. Defaults to the "connect" endpoint to match
 * legacy behavior (this function was only ever invoked from the Connect
 * webhook route).
 */
export async function handleStripeWebhook(event: Stripe.Event) {
  const { processStripeEvent } = await import("./stripeWebhookRouter");
  return processStripeEvent(event, "connect");
}

export async function handleAccountUpdated(account: Stripe.Account) {
  const [connectAccount] = await db
    .select()
    .from(stripeConnectAccounts)
    .where(eq(stripeConnectAccounts.stripeAccountId, account.id));

  if (!connectAccount) return;

  let onboardingStatus: "not_started" | "pending" | "complete" = "pending";
  if (
    account.charges_enabled &&
    account.payouts_enabled &&
    account.details_submitted
  ) {
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

// Helper: narrow a Stripe expandable field (`string | T | null | undefined`)
// to its plain id string so we never have to sprinkle `as any` over the
// webhook handlers (architect-review fix, Task #245).
function resolveExpandableId<T extends { id: string }>(
  value: string | T | null | undefined,
): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id ?? null;
}

export async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
) {
  // Resolve our invoice id either from explicit metadata (in-app
  // PaymentIntent flow created via createInvoicePaymentIntent) or from the
  // PaymentIntent's `invoice` link (Stripe Invoices paid via the hosted
  // page create the PI internally with no metadata — Task #245).
  let invoiceId = paymentIntent.metadata?.invoiceId;
  // The PI's `invoice` link is an expandable Stripe field — typed as
  // `string | Stripe.Invoice | null`. Narrow without a blanket `as any`
  // (architect-review fix).
  const piInvoice = resolveExpandableId<Stripe.Invoice>(
    (paymentIntent as Stripe.PaymentIntent & {
      invoice?: string | Stripe.Invoice | null;
    }).invoice,
  );
  if (!invoiceId && piInvoice) {
    const [linked] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.stripeInvoiceId, piInvoice));
    if (linked) invoiceId = linked.id;
  }
  if (!invoiceId) return;

  // Look up provider for upsert + amount fallback
  const [invForUpsert] = await db
    .select({ providerId: invoices.providerId, totalCents: invoices.totalCents })
    .from(invoices)
    .where(eq(invoices.id, invoiceId));
  if (!invForUpsert) return;

  const amountCents = paymentIntent.amount ?? invForUpsert.totalCents ?? 0;
  const stripeChargeId = paymentIntent.latest_charge?.toString() ?? null;

  // UPSERT the payments row keyed on stripe_payment_intent_id (Task #245).
  // First-time webhook delivery → INSERT. In-app PI flow already inserted a
  // row at PI-create time → UPDATE flips it to succeeded and stamps the
  // charge id. The unique partial index on stripe_payment_intent_id
  // arbitrates concurrent deliveries.
  await db
    .insert(payments)
    .values({
      invoiceId,
      providerId: invForUpsert.providerId,
      amountCents,
      amount: (amountCents / 100).toFixed(2),
      method: "stripe",
      status: "succeeded",
      stripePaymentIntentId: paymentIntent.id,
      stripeChargeId,
    })
    .onConflictDoUpdate({
      target: payments.stripePaymentIntentId,
      set: {
        status: "succeeded",
        stripeChargeId,
      },
    });

  const [updatedInvoice] = await db
    .update(invoices)
    .set({
      status: "paid",
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntent.id,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId))
    .returning();

  // First-paid trigger — start the 7-day grace period if applicable.
  if (updatedInvoice) {
    try {
      const { maybeStartGracePeriod } = await import("./subscriptionService");
      await maybeStartGracePeriod(updatedInvoice.providerId);
    } catch (e) {
      console.error("[subscription] grace start failed (webhook):", e);
    }
  }

  // Dispatch invoice.paid notification via webhook
  if (updatedInvoice) {
    try {
      const [provider] = await db
        .select()
        .from(providers)
        .where(eq(providers.id, updatedInvoice.providerId));
      let clientEmail: string | undefined;
      let clientName: string | undefined;
      if (updatedInvoice.homeownerUserId) {
        const [homeowner] = await db
          .select()
          .from(users)
          .where(eq(users.id, updatedInvoice.homeownerUserId));
        if (homeowner) {
          clientEmail = homeowner.email;
          clientName =
            `${homeowner.firstName || ""} ${homeowner.lastName || ""}`.trim() ||
            homeowner.email;
        }
      } else if (updatedInvoice.clientId) {
        const [client] = await db
          .select()
          .from(clients)
          .where(eq(clients.id, updatedInvoice.clientId));
        if (client) {
          clientEmail = client.email ?? undefined;
          clientName =
            `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
            clientEmail;
        }
      }
      // Email to homeowner/client: atomic claim on PaymentIntent id so only
      // one of the concurrent payment_intent.succeeded / invoice.paid webhooks
      // sends the email (Task #246).
      if (clientEmail && provider) {
        const emailClaimed = await claimNotificationDelivery(
          "invoice.paid.email",
          paymentIntent.id,
          "email",
        );
        if (emailClaimed) {
          dispatch("invoice.paid", {
            clientEmail,
            clientName: clientName ?? clientEmail,
            providerName: provider.businessName,
            invoiceNumber: updatedInvoice.invoiceNumber,
            amount:
              typeof updatedInvoice.total === "string"
                ? parseFloat(updatedInvoice.total)
                : (updatedInvoice.total ?? 0),
            paymentDate: new Date().toLocaleDateString(),
            relatedRecordType: "invoice",
            relatedRecordId: invoiceId,
          }).then(() =>
            logDelivery({
              channel: "email",
              status: "sent",
              eventType: "invoice.paid.email",
              recipientEmail: clientEmail,
              relatedRecordType: "invoice",
              relatedRecordId: paymentIntent.id,
            }),
          ).catch((e: unknown) =>
            console.error("invoice.paid dispatch error (webhook):", e),
          );
        }
      }

      // Provider push: atomic claim on PaymentIntent id prevents concurrent
      // payment_intent.succeeded + invoice.paid webhooks from both firing
      // (Task #246).
      if (provider?.userId) {
        const providerPushClaimed = await claimNotificationDelivery(
          "invoice.paid",
          paymentIntent.id,
          "push",
        );
        if (providerPushClaimed) {
          const amountStr = String(updatedInvoice.total ?? "0");
          dispatchNotification(
            provider.userId,
            "Payment received",
            `Invoice ${updatedInvoice.invoiceNumber} was paid — $${amountStr} is on the way to your bank account.`,
            "invoice_paid",
            {
              invoiceId,
              invoiceNumber: updatedInvoice.invoiceNumber,
              type: "invoice_paid",
              screen: "InvoiceDetail",
              params: { invoiceId },
            },
            "invoices",
          ).then(() =>
            logDelivery({
              channel: "push",
              status: "sent",
              eventType: "invoice.paid",
              recipientUserId: provider.userId,
              relatedRecordType: "invoice",
              relatedRecordId: paymentIntent.id,
            }),
          ).catch((e: unknown) =>
            console.error("provider invoice.paid push error (webhook):", e),
          );
        }
      }

      // Homeowner-side "payment confirmed" in-app + push so the notification
      // center reflects the payment and the client app invalidates its
      // invoice/job queries even if it was backgrounded (Task #235).
      // Homeowner push: atomic claim on PaymentIntent id (Task #246).
      if (updatedInvoice.homeownerUserId) {
        const homeownerPushClaimed = await claimNotificationDelivery(
          "invoice.paid.homeowner",
          paymentIntent.id,
          "push",
        );
        if (homeownerPushClaimed) {
          const amountStr = String(updatedInvoice.total ?? "0");
          const data: Record<string, unknown> = {
            type: "invoice_paid",
            invoiceId,
            invoiceNumber: updatedInvoice.invoiceNumber,
          };
          if (updatedInvoice.jobId) {
            const jobRows = await db
              .select({ appointmentId: jobs.appointmentId })
              .from(jobs)
              .where(eq(jobs.id, updatedInvoice.jobId))
              .limit(1)
              .catch((): { appointmentId: string | null }[] => []);
            const appointmentId = jobRows[0]?.appointmentId ?? null;
            if (appointmentId) {
              data.screen = "AppointmentDetail";
              data.params = { appointmentId };
              data.appointmentId = appointmentId;
            }
          }
          dispatchNotification(
            updatedInvoice.homeownerUserId,
            "Payment confirmed",
            `Your $${amountStr} payment to ${provider?.businessName || "your provider"} was received.`,
            "invoice_paid",
            data,
            "invoices",
          ).then(() =>
            logDelivery({
              channel: "push",
              status: "sent",
              eventType: "invoice.paid.homeowner",
              recipientUserId: updatedInvoice.homeownerUserId ?? undefined,
              relatedRecordType: "invoice",
              relatedRecordId: paymentIntent.id,
            }),
          ).catch((e: unknown) =>
            console.error("homeowner invoice.paid push error (webhook):", e),
          );
        }
      }

      // HouseFax: update costCents on the housefax entry for the invoice's linked job (if any)
      // Uses invoice.jobId for deterministic association (no guessing)
      (async () => {
        try {
          const jobId = updatedInvoice.jobId;
          if (!jobId) return; // Only enrich when invoice is directly linked to a job

          const costCents = updatedInvoice.total
            ? Math.round(
                (typeof updatedInvoice.total === "string"
                  ? parseFloat(updatedInvoice.total)
                  : updatedInvoice.total) * 100,
              )
            : 0;
          if (costCents <= 0) return;

          const [entry] = await db
            .select({
              id: housefaxEntries.id,
              costCents: housefaxEntries.costCents,
            })
            .from(housefaxEntries)
            .where(eq(housefaxEntries.jobId, jobId));

          if (entry) {
            // Update cost on existing entry
            await db
              .update(housefaxEntries)
              .set({ costCents })
              .where(eq(housefaxEntries.id, entry.id));
            console.log(
              `[HouseFax] Updated cost for job ${jobId} to ${costCents} cents via payment webhook`,
            );
          } else {
            // No entry yet - create HouseFax entry inline using job data + confirmed payment cost
            const [job] = await db
              .select()
              .from(jobs)
              .where(eq(jobs.id, jobId));
            if (job && job.status === "completed") {
              // Find homeId from the client
              let homeId: string | null = null;
              if (job.appointmentId) {
                const [appt] = await db
                  .select({ homeId: appointments.homeId })
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
                  const [home] = await db
                    .select({ id: homes.id })
                    .from(homes)
                    .where(eq(homes.userId, inv.homeownerUserId));
                  if (home) homeId = home.id;
                }
              }
              if (homeId) {
                // Double-check no entry was created concurrently
                const [existing] = await db
                  .select({ id: housefaxEntries.id })
                  .from(housefaxEntries)
                  .where(eq(housefaxEntries.jobId, job.id));
                if (!existing) {
                  const [provider] = job.providerId
                    ? await db
                        .select({ businessName: providers.businessName })
                        .from(providers)
                        .where(eq(providers.id, job.providerId))
                    : [null];
                  await db.insert(housefaxEntries).values({
                    homeId,
                    jobId: job.id,
                    appointmentId: job.appointmentId || null,
                    serviceCategory: "General",
                    serviceName: job.title,
                    providerId: job.providerId || null,
                    providerName: provider?.businessName || null,
                    completedAt: job.completedAt || new Date(),
                    costCents,
                    aiSummary: null,
                    photos: [],
                    systemAffected: "General",
                    notes: job.notes || null,
                  });
                  console.log(
                    `[HouseFax] Created entry for job ${jobId} with cost ${costCents} cents via payment webhook`,
                  );
                }
              }
            }
          }
        } catch (e) {
          console.error("[HouseFax] Payment webhook cost update error:", e);
        }
      })();
    } catch (err) {
      console.error("Failed to dispatch invoice.paid from webhook:", err);
    }
  }
}

export async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
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
      const [failedInvoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId));
      if (failedInvoice) {
        const [provider] = await db
          .select()
          .from(providers)
          .where(eq(providers.id, failedInvoice.providerId));
        let clientEmail: string | undefined;
        let clientName: string | undefined;
        if (failedInvoice.homeownerUserId) {
          const [homeowner] = await db
            .select()
            .from(users)
            .where(eq(users.id, failedInvoice.homeownerUserId));
          if (homeowner) {
            clientEmail = homeowner.email;
            clientName =
              `${homeowner.firstName || ""} ${homeowner.lastName || ""}`.trim() ||
              homeowner.email;
          }
        } else if (failedInvoice.clientId) {
          const [client] = await db
            .select()
            .from(clients)
            .where(eq(clients.id, failedInvoice.clientId));
          if (client) {
            clientEmail = client.email ?? undefined;
            clientName =
              `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
              clientEmail;
          }
        }
        if (clientEmail && provider) {
          dispatch("invoice.payment_failed", {
            clientEmail,
            clientName: clientName ?? clientEmail,
            providerName: provider.businessName,
            invoiceNumber: failedInvoice.invoiceNumber,
            amount:
              typeof failedInvoice.total === "string"
                ? parseFloat(failedInvoice.total)
                : (failedInvoice.total ?? 0),
            relatedRecordType: "invoice",
            relatedRecordId: invoiceId,
          }).catch((e: unknown) =>
            console.error("invoice.payment_failed dispatch error:", e),
          );
        }
      }
    } catch (err) {
      console.error(
        "Failed to dispatch invoice.payment_failed from webhook:",
        err,
      );
    }
  }
}

export async function handleStripeInvoicePaid(stripeInvoice: Stripe.Invoice) {
  const homebaseInvoiceId = stripeInvoice.metadata?.homebaseInvoiceId;
  if (!homebaseInvoiceId) return;

  // Resolve the PaymentIntent + charge that paid this Stripe Invoice so we
  // can record a payments row tied to the homeowner's funds movement
  // (Task #245). For Stripe Invoices paid via the hosted page these are
  // populated by Stripe at finalize/pay time.
  // `payment_intent` and `charge` are expandable Stripe Invoice fields.
  // Narrow safely without `as any` (architect-review fix).
  const invoiceWithLinks = stripeInvoice as Stripe.Invoice & {
    payment_intent?: string | Stripe.PaymentIntent | null;
    charge?: string | Stripe.Charge | null;
  };
  const stripePaymentIntentId = resolveExpandableId<Stripe.PaymentIntent>(
    invoiceWithLinks.payment_intent,
  );
  const stripeChargeId = resolveExpandableId<Stripe.Charge>(
    invoiceWithLinks.charge,
  );

  const [updatedInvoice] = await db
    .update(invoices)
    .set({
      status: "paid",
      paidAt: new Date(),
      ...(stripePaymentIntentId
        ? { stripePaymentIntentId }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, homebaseInvoiceId))
    .returning();

  if (!updatedInvoice) return;

  // Persist a payments row keyed on the PI (idempotent UPSERT against the
  // unique partial index from Task #245). Skipped only if Stripe didn't
  // give us a PI id — defensive; should not happen for a paid invoice.
  if (stripePaymentIntentId) {
    const amountCents =
      stripeInvoice.amount_paid ??
      stripeInvoice.amount_due ??
      updatedInvoice.totalCents ??
      0;
    try {
      await db
        .insert(payments)
        .values({
          invoiceId: homebaseInvoiceId,
          providerId: updatedInvoice.providerId,
          amountCents,
          amount: (amountCents / 100).toFixed(2),
          method: "stripe",
          status: "succeeded",
          stripePaymentIntentId,
          stripeChargeId,
        })
        .onConflictDoUpdate({
          target: payments.stripePaymentIntentId,
          set: {
            status: "succeeded",
            stripeChargeId,
          },
        });
    } catch (e) {
      console.error(
        `[invoice.paid] failed to upsert payments row for invoice ${homebaseInvoiceId}:`,
        e,
      );
    }
  }

  try {
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, updatedInvoice.providerId));
    let clientEmail: string | undefined;
    let clientName: string | undefined;
    if (updatedInvoice.clientId) {
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, updatedInvoice.clientId));
      if (client) {
        clientEmail = client.email ?? undefined;
        clientName =
          `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
          clientEmail;
      }
    } else if (updatedInvoice.homeownerUserId) {
      const [homeowner] = await db
        .select()
        .from(users)
        .where(eq(users.id, updatedInvoice.homeownerUserId));
      if (homeowner) {
        clientEmail = homeowner.email;
        clientName =
          `${homeowner.firstName || ""} ${homeowner.lastName || ""}`.trim() ||
          homeowner.email;
      }
    }
    // Email to homeowner/client: atomic claim on PaymentIntent id (shared with
    // payment_intent.succeeded) so only one email fires per payment (Task #246).
    // Fall back to homebaseInvoiceId when no PI id is available.
    if (clientEmail && provider) {
      const emailDedupeKey = stripePaymentIntentId ?? homebaseInvoiceId;
      const emailClaimed = await claimNotificationDelivery(
        "invoice.paid.email",
        emailDedupeKey,
        "email",
      );
      if (emailClaimed) {
        dispatch("invoice.paid", {
          clientEmail,
          clientName: clientName ?? clientEmail,
          providerName: provider.businessName,
          invoiceNumber: updatedInvoice.invoiceNumber,
          amount:
            typeof updatedInvoice.total === "string"
              ? parseFloat(updatedInvoice.total)
              : (updatedInvoice.total ?? 0),
          paymentDate: new Date().toLocaleDateString(),
          relatedRecordType: "invoice",
          relatedRecordId: homebaseInvoiceId,
        }).then(() =>
          logDelivery({
            channel: "email",
            status: "sent",
            eventType: "invoice.paid.email",
            recipientEmail: clientEmail,
            relatedRecordType: "invoice",
            relatedRecordId: emailDedupeKey,
          }),
        ).catch((e: unknown) =>
          console.error(
            "invoice.paid dispatch error (stripe invoice webhook):",
            e,
          ),
        );
      }
    }

    // Provider push: atomic claim on PaymentIntent id prevents concurrent
    // payment_intent.succeeded + invoice.paid webhooks from both firing
    // (Task #246).
    if (provider?.userId) {
      const pushDedupeKey = stripePaymentIntentId ?? homebaseInvoiceId;
      const providerPushClaimed = await claimNotificationDelivery(
        "invoice.paid",
        pushDedupeKey,
        "push",
      );
      if (providerPushClaimed) {
        const amountStr = String(updatedInvoice.total ?? "0");
        dispatchNotification(
          provider.userId,
          "Payment received",
          `Invoice ${updatedInvoice.invoiceNumber} was paid — $${amountStr} is on the way to your bank account.`,
          "invoice_paid",
          {
            invoiceId: homebaseInvoiceId,
            invoiceNumber: updatedInvoice.invoiceNumber,
            type: "invoice_paid",
            screen: "InvoiceDetail",
            params: { invoiceId: homebaseInvoiceId },
          },
          "invoices",
        ).then(() =>
          logDelivery({
            channel: "push",
            status: "sent",
            eventType: "invoice.paid",
            recipientUserId: provider.userId,
            relatedRecordType: "invoice",
            relatedRecordId: pushDedupeKey,
          }),
        ).catch((e: unknown) =>
          console.error(
            "provider invoice.paid push error (stripe invoice webhook):",
            e,
          ),
        );
      }
    }

    // Homeowner push: atomic claim on PaymentIntent id (Task #246).
    if (updatedInvoice.homeownerUserId) {
      const homeownerDedupeKey = stripePaymentIntentId ?? homebaseInvoiceId;
      const homeownerPushClaimed = await claimNotificationDelivery(
        "invoice.paid.homeowner",
        homeownerDedupeKey,
        "push",
      );
      if (homeownerPushClaimed) {
        const amountStr = String(updatedInvoice.total ?? "0");
        const data: Record<string, unknown> = {
          type: "invoice_paid",
          invoiceId: homebaseInvoiceId,
          invoiceNumber: updatedInvoice.invoiceNumber,
        };
        if (updatedInvoice.jobId) {
          const jobRows = await db
            .select({ appointmentId: jobs.appointmentId })
            .from(jobs)
            .where(eq(jobs.id, updatedInvoice.jobId))
            .limit(1)
            .catch((): { appointmentId: string | null }[] => []);
          const appointmentId = jobRows[0]?.appointmentId ?? null;
          if (appointmentId) {
            data.screen = "AppointmentDetail";
            data.params = { appointmentId };
            data.appointmentId = appointmentId;
          }
        }
        dispatchNotification(
          updatedInvoice.homeownerUserId,
          "Payment confirmed",
          `Your $${amountStr} payment to ${provider?.businessName || "your provider"} was received.`,
          "invoice_paid",
          data,
          "invoices",
        ).then(() =>
          logDelivery({
            channel: "push",
            status: "sent",
            eventType: "invoice.paid.homeowner",
            recipientUserId: updatedInvoice.homeownerUserId ?? undefined,
            relatedRecordType: "invoice",
            relatedRecordId: homeownerDedupeKey,
          }),
        ).catch((e: unknown) =>
          console.error(
            "homeowner invoice.paid push error (stripe invoice webhook):",
            e,
          ),
        );
      }
    }
  } catch (err) {
    console.error(
      "Failed to dispatch invoice.paid from stripe invoice webhook:",
      err,
    );
  }
}

export async function handleStripeInvoicePaymentFailed(stripeInvoice: Stripe.Invoice) {
  const homebaseInvoiceId = stripeInvoice.metadata?.homebaseInvoiceId;
  if (!homebaseInvoiceId) return;

  try {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, homebaseInvoiceId));
    if (!invoice) return;
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, invoice.providerId));
    let clientEmail: string | undefined;
    let clientName: string | undefined;
    if (invoice.clientId) {
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, invoice.clientId));
      if (client) {
        clientEmail = client.email ?? undefined;
        clientName =
          `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
          clientEmail;
      }
    } else if (invoice.homeownerUserId) {
      const [homeowner] = await db
        .select()
        .from(users)
        .where(eq(users.id, invoice.homeownerUserId));
      if (homeowner) {
        clientEmail = homeowner.email;
        clientName =
          `${homeowner.firstName || ""} ${homeowner.lastName || ""}`.trim() ||
          homeowner.email;
      }
    }
    if (clientEmail && provider) {
      dispatch("invoice.payment_failed", {
        clientEmail,
        clientName: clientName ?? clientEmail,
        providerName: provider.businessName,
        invoiceNumber: invoice.invoiceNumber,
        amount:
          typeof invoice.total === "string"
            ? parseFloat(invoice.total)
            : (invoice.total ?? 0),
        relatedRecordType: "invoice",
        relatedRecordId: homebaseInvoiceId,
      }).catch((e: unknown) =>
        console.error(
          "invoice.payment_failed dispatch error (stripe invoice webhook):",
          e,
        ),
      );
    }
  } catch (err) {
    console.error(
      "Failed to dispatch invoice.payment_failed from stripe invoice webhook:",
      err,
    );
  }
}

export async function handleChargeRefunded(charge: Stripe.Charge) {
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
            status:
              (stripeRefund.status as
                | "pending"
                | "succeeded"
                | "failed"
                | "canceled") ?? "pending",
          });
        } else {
          await db
            .update(refunds)
            .set({
              status:
                (stripeRefund.status as
                  | "pending"
                  | "succeeded"
                  | "failed"
                  | "canceled") ?? "pending",
            })
            .where(eq(refunds.stripeRefundId, stripeRefund.id));
        }
      }
    }
  }
}

async function resolveProviderFromConnectAccount(
  connectedAccountId: string | null,
): Promise<string | null> {
  if (!connectedAccountId) return null;
  const [connectAccount] = await db
    .select({ providerId: stripeConnectAccounts.providerId })
    .from(stripeConnectAccounts)
    .where(eq(stripeConnectAccounts.stripeAccountId, connectedAccountId));
  return connectAccount?.providerId ?? null;
}

export async function handlePayoutCreated(
  payout: Stripe.Payout,
  connectedAccountId: string | null,
) {
  const providerId =
    await resolveProviderFromConnectAccount(connectedAccountId);
  if (!providerId) {
    console.warn(
      `handlePayoutCreated: no provider found for account ${connectedAccountId}`,
    );
    return;
  }

  const arrivalDate = payout.arrival_date
    ? new Date(payout.arrival_date * 1000)
    : null;

  const [existingPayout] = await db
    .select()
    .from(payouts)
    .where(eq(payouts.stripePayoutId, payout.id));

  const stripeStatus = payout.status as
    | "paid"
    | "pending"
    | "in_transit"
    | "canceled"
    | "failed";

  if (!existingPayout) {
    await db
      .insert(payouts)
      .values({
        providerId,
        amountCents: payout.amount,
        status: stripeStatus,
        stripePayoutId: payout.id,
        arrivalDate,
        description: payout.description ?? null,
      })
      .onConflictDoNothing();
  } else {
    await db
      .update(payouts)
      .set({
        status: stripeStatus,
        arrivalDate,
        description: payout.description ?? null,
      })
      .where(eq(payouts.id, existingPayout.id));
  }
}

export async function handlePayoutPaid(
  payout: Stripe.Payout,
  connectedAccountId: string | null,
) {
  const arrivalDate = payout.arrival_date
    ? new Date(payout.arrival_date * 1000)
    : null;

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
    const providerId =
      await resolveProviderFromConnectAccount(connectedAccountId);
    if (providerId) {
      await db
        .insert(payouts)
        .values({
          providerId,
          amountCents: payout.amount,
          status: "paid",
          stripePayoutId: payout.id,
          arrivalDate,
          description: payout.description ?? null,
        })
        .onConflictDoNothing();
    }
  }
}

export async function handlePayoutFailed(
  payout: Stripe.Payout,
  _connectedAccountId: string | null,
) {
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

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
) {
  // Task #236: route by metadata so booking-deposit and cancellation-fee
  // checkouts share the same Stripe webhook plumbing as invoice payments.
  const depositForAppointment = session.metadata?.depositForAppointment;
  if (depositForAppointment) {
    await handleDepositCheckoutCompleted(depositForAppointment, session);
    return;
  }
  const cancellationFeeForAppointment =
    session.metadata?.cancellationFeeForAppointment;
  if (cancellationFeeForAppointment) {
    await handleCancellationFeeCheckoutCompleted(
      cancellationFeeForAppointment,
      session,
    );
    return;
  }

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

async function handleDepositCheckoutCompleted(
  appointmentId: string,
  session: Stripe.Checkout.Session,
) {
  const [appt] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId));
  if (!appt) {
    console.warn(
      "[stripe-webhook] deposit completion for unknown appointment",
      appointmentId,
    );
    return;
  }
  const paymentIntentId = session.payment_intent?.toString() || null;
  await db
    .update(appointments)
    .set({
      depositStatus: "paid",
      depositPaymentIntentId: paymentIntentId,
      // Flip the booking to confirmed once deposit clears, mirroring how an
      // appointment with no deposit policy lands in `confirmed` immediately.
      status: appt.status === "pending" ? "confirmed" : appt.status,
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, appointmentId));

  // Task #236: now that the deposit has cleared, fire the
  // "Booking Confirmed" notification + booking.created email that the
  // POST /api/appointments handler intentionally deferred. This is what
  // the homeowner expects to see — they only get the confirmation
  // touchpoints once their payment has actually gone through.
  try {
    if (appt.userId) {
      await dispatchNotification(
        appt.userId,
        "Booking Confirmed",
        `Your ${appt.serviceName} appointment is confirmed — deposit received.`,
        "booking_confirmed",
        { appointmentId },
        "bookings",
      );
    }
    const [bookedUser] = appt.userId
      ? await db.select().from(users).where(eq(users.id, appt.userId))
      : [null];
    const [bookedProvider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, appt.providerId));
    if (bookedUser && bookedProvider) {
      await dispatch("booking.created", {
        clientEmail: bookedUser.email,
        clientName:
          `${bookedUser.firstName || ""} ${bookedUser.lastName || ""}`.trim() ||
          bookedUser.email,
        providerEmail: bookedProvider.email ?? undefined,
        providerName: bookedProvider.businessName,
        serviceName: appt.serviceName,
        appointmentDate: appt.scheduledDate as unknown as string,
        appointmentTime: appt.scheduledTime ?? "",
        estimatedPrice: appt.estimatedPrice
          ? parseFloat(String(appt.estimatedPrice)) || undefined
          : undefined,
        confirmationNumber: appt.id,
        relatedRecordType: "appointment",
        relatedRecordId: appt.id,
        recipientUserId: bookedUser.id,
      });
    }
  } catch (notifyErr) {
    console.error(
      "[stripe-webhook] deposit-paid notify error (non-fatal):",
      notifyErr,
    );
  }
}

async function handleCancellationFeeCheckoutCompleted(
  appointmentId: string,
  session: Stripe.Checkout.Session,
) {
  const [appt] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId));
  if (!appt) return;
  await db
    .update(appointments)
    .set({
      cancellationFeeStatus: "paid",
      cancellationFeePaymentIntentId:
        session.payment_intent?.toString() || null,
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, appointmentId));
}

/**
 * Task #236: create a Stripe Checkout Session that collects the booking
 * deposit. Mirrors `createStripeCheckoutSession` (destination charge with
 * application_fee_amount → provider Connect account) but is tied to an
 * appointment instead of an invoice. The webhook flips the appointment to
 * `confirmed` + `depositStatus = paid` once the homeowner completes payment.
 */
export async function createDepositCheckoutSession(params: {
  appointmentId: string;
  providerId: string;
  amountCents: number;
  description: string;
}): Promise<{ sessionId: string; checkoutUrl: string | null }> {
  const { appointmentId, providerId, amountCents, description } = params;

  const connectAccount = await getConnectAccount(providerId);
  if (!connectAccount || !connectAccount.chargesEnabled) {
    const err = new Error("stripe_not_ready") as Error & { code: string };
    err.code = "stripe_not_ready";
    throw err;
  }

  const plan = await getProviderPlan(providerId);
  const fee = calculatePlatformFee(
    amountCents,
    plan.platformFeePercent || "3.00",
    plan.platformFeeFixedCents || 0,
  );

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Booking deposit",
            description,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: fee.totalCents,
      transfer_data: { destination: connectAccount.stripeAccountId },
      metadata: {
        depositForAppointment: appointmentId,
        providerId,
      },
    },
    success_url: `${PUBLIC_REDIRECT_BASE}/payment-success?appointmentId=${encodeURIComponent(appointmentId)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${PUBLIC_REDIRECT_BASE}/payment-cancelled?appointmentId=${encodeURIComponent(appointmentId)}`,
    metadata: {
      depositForAppointment: appointmentId,
      providerId,
    },
  });

  await db
    .update(appointments)
    .set({
      depositCheckoutSessionId: session.id,
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, appointmentId));

  return { sessionId: session.id, checkoutUrl: session.url };
}

/**
 * Task #236: create a Stripe Checkout Session that collects a late-cancel
 * fee. Same destination-charge shape as the deposit/invoice flows.
 */
export async function createCancellationFeeCheckoutSession(params: {
  appointmentId: string;
  providerId: string;
  amountCents: number;
  description: string;
}): Promise<{ sessionId: string; checkoutUrl: string | null }> {
  const { appointmentId, providerId, amountCents, description } = params;

  const connectAccount = await getConnectAccount(providerId);
  if (!connectAccount || !connectAccount.chargesEnabled) {
    const err = new Error("stripe_not_ready") as Error & { code: string };
    err.code = "stripe_not_ready";
    throw err;
  }

  const plan = await getProviderPlan(providerId);
  const fee = calculatePlatformFee(
    amountCents,
    plan.platformFeePercent || "3.00",
    plan.platformFeeFixedCents || 0,
  );

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Late cancellation fee",
            description,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: fee.totalCents,
      transfer_data: { destination: connectAccount.stripeAccountId },
      metadata: {
        cancellationFeeForAppointment: appointmentId,
        providerId,
      },
    },
    success_url: `${PUBLIC_REDIRECT_BASE}/payment-success?appointmentId=${encodeURIComponent(appointmentId)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${PUBLIC_REDIRECT_BASE}/payment-cancelled?appointmentId=${encodeURIComponent(appointmentId)}`,
    metadata: {
      cancellationFeeForAppointment: appointmentId,
      providerId,
    },
  });

  await db
    .update(appointments)
    .set({
      cancellationFeeCheckoutSessionId: session.id,
      cancellationFeeStatus: "awaiting",
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, appointmentId));

  return { sessionId: session.id, checkoutUrl: session.url };
}

export async function calculateFeePreview(
  providerId: string,
  totalCents: number,
) {
  const plan = await getProviderPlan(providerId);
  const fee = calculatePlatformFee(
    totalCents,
    plan.platformFeePercent || "3.00",
    plan.platformFeeFixedCents || 0,
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
/**
 * Re-send a Stripe Invoice that was already created on the provider's
 * connected account (Task #150). The platform-level `invoices.sendInvoice`
 * call would 404 because the invoice doesn't exist on the platform account,
 * so this helper looks up the connected account and forwards the call with
 * the correct `stripeAccount` header. Throws `stripe_not_ready` if no
 * connected account is on file.
 */
export async function resendStripeInvoice(invoiceId: string): Promise<void> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId));
  if (!invoice) throw new Error("Invoice not found");
  if (!invoice.stripeInvoiceId)
    throw new Error("Invoice has no Stripe invoice yet — call send first");

  const connectAccount = await getConnectAccount(invoice.providerId);
  if (!connectAccount?.stripeAccountId) {
    const err = new Error(
      "Provider Stripe Connect account is not on file — cannot resend invoice.",
    ) as Error & { code: string };
    err.code = "stripe_not_ready";
    throw err;
  }
  await getStripe().invoices.sendInvoice(invoice.stripeInvoiceId, {
    stripeAccount: connectAccount.stripeAccountId,
  });
}

export async function sendStripeInvoiceEmail(
  invoiceId: string,
): Promise<{ stripeInvoiceId: string; hostedInvoiceUrl: string }> {
  // Create + finalize (idempotent — returns existing if already done)
  const { stripeInvoiceId, hostedInvoiceUrl } =
    await createStripeInvoice(invoiceId);

  // Look up the connected account so we can send on behalf of it
  const [inv] = await db
    .select({ providerId: invoices.providerId })
    .from(invoices)
    .where(eq(invoices.id, invoiceId));
  if (!inv) throw new Error("Invoice not found");
  const connectAccount = await getConnectAccount(inv.providerId);
  if (!connectAccount?.stripeAccountId)
    throw new Error("Provider Stripe account not found");

  // This makes Stripe email the client a branded hosted payment page
  await getStripe().invoices.sendInvoice(stripeInvoiceId, {
    stripeAccount: connectAccount.stripeAccountId,
  });

  return { stripeInvoiceId, hostedInvoiceUrl };
}


// ─────────────────────────────────────────────────────────────────────────────
// HomeBase Pro provider subscription billing (Task #124)
// ─────────────────────────────────────────────────────────────────────────────

const SUBSCRIPTION_RETURN_BASE =
  process.env.SUBSCRIPTION_RETURN_URL || "https://homebaseproapp.com";

/**
 * Find or create the Stripe customer for a user, persisting `users.stripeCustomerId`.
 * Re-used so each user has at most one platform Stripe customer across all flows.
 */
async function getOrCreateUserStripeCustomer(userId: string): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error("User not found");

  const stripe = getStripe();

  if (user.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(user.stripeCustomerId);
      if (!(existing as any).deleted) return user.stripeCustomerId;
    } catch {
      // fall through and create a fresh one
    }
  }

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;
  const customer = await stripe.customers.create({
    email: user.email,
    name: fullName,
    metadata: { userId, source: "homebase_pro_subscription" },
  });

  await db
    .update(users)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return customer.id;
}

/**
 * Create a Stripe Checkout Session for a HomeBase Pro provider subscription.
 * Returns the hosted Checkout URL the app opens via Linking.
 */
export async function createSubscriptionCheckoutSession(opts: {
  userId: string;
  providerId: string;
}): Promise<{ url: string; sessionId: string }> {
  const priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID;
  if (!priceId) {
    throw new Error("STRIPE_SUBSCRIPTION_PRICE_ID is not configured");
  }

  // Verify the provider belongs to the caller
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, opts.providerId));
  if (!provider) throw new Error("Provider not found");
  if (provider.userId !== opts.userId) {
    const err = new Error("forbidden") as Error & { code?: string };
    err.code = "forbidden";
    throw err;
  }

  const customerId = await getOrCreateUserStripeCustomer(opts.userId);

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${PUBLIC_REDIRECT_BASE}/payment-success?subscription=success`,
    cancel_url: `${PUBLIC_REDIRECT_BASE}/payment-cancelled?subscription=cancelled`,
    metadata: {
      subscriptionType: "homebase_pro",
      userId: opts.userId,
      providerId: opts.providerId,
    },
    subscription_data: {
      metadata: {
        subscriptionType: "homebase_pro",
        userId: opts.userId,
        providerId: opts.providerId,
      },
    },
  });

  if (!session.url) throw new Error("Stripe did not return a Checkout URL");
  return { url: session.url, sessionId: session.id };
}

/**
 * Create a Stripe Billing Portal session so the provider can manage card,
 * download invoices, and cancel.
 */
export async function createSubscriptionPortalSession(opts: {
  userId: string;
}): Promise<{ url: string }> {
  const [user] = await db.select().from(users).where(eq(users.id, opts.userId));
  if (!user) throw new Error("User not found");
  if (!user.stripeCustomerId) {
    const err = new Error("no_subscription") as Error & { code?: string };
    err.code = "no_subscription";
    throw err;
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${SUBSCRIPTION_RETURN_BASE}/?subscription=managed`,
  });

  return { url: session.url };
}

function planTierForStatus(
  status: string | null | undefined,
): "free" | "professional" {
  if (!status) return "free";
  return status === "active" || status === "trialing" ? "professional" : "free";
}

async function upsertProviderPlanSubscription(
  providerId: string,
  patch: Partial<typeof providerPlans.$inferInsert>,
) {
  const existing = await db
    .select()
    .from(providerPlans)
    .where(eq(providerPlans.providerId, providerId));

  if (existing.length === 0) {
    await db.insert(providerPlans).values({
      providerId,
      planTier: patch.planTier ?? "free",
      ...patch,
    } as any);
  } else {
    await db
      .update(providerPlans)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(providerPlans.providerId, providerId));
  }
}

async function notifyProviderUser(
  providerId: string,
  title: string,
  message: string,
  type: string,
) {
  try {
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, providerId));
    if (!provider?.userId) return;
    const { dispatchNotification } = await import("./notificationService");
    await dispatchNotification(
      provider.userId,
      title,
      message,
      type,
      { providerId },
      "invoices",
    );
  } catch (err) {
    console.error("[subscription] notifyProviderUser error:", err);
  }
}

export async function handleSubscriptionCheckoutCompleted(
  session: Stripe.Checkout.Session,
) {
  const providerId = session.metadata?.providerId;
  const subscriptionId = session.subscription?.toString();
  if (!providerId) {
    console.warn(
      "[subscription] checkout.session.completed missing providerId metadata",
    );
    return;
  }

  await upsertProviderPlanSubscription(providerId, {
    planTier: "professional",
    isSubscribed: true,
    stripeSubscriptionId: subscriptionId ?? null,
    subscriptionStatus: "active",
    subscriptionStartedAt: new Date(),
    subscriptionEndedAt: null,
    subscriptionSource: "stripe_web",
  } as any);

  await notifyProviderUser(
    providerId,
    "You're subscribed",
    "Welcome to HomeBase Pro — your subscription is active.",
    "subscription.activated",
  );
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const providerId = subscription.metadata?.providerId;
  if (!providerId) return;

  const status = subscription.status; // active | trialing | past_due | canceled | unpaid | incomplete...
  const isActive = status === "active" || status === "trialing";

  const periodEndUnix = (subscription as any).current_period_end;
  const currentPeriodEnd =
    typeof periodEndUnix === "number" ? new Date(periodEndUnix * 1000) : null;

  await upsertProviderPlanSubscription(providerId, {
    planTier: planTierForStatus(status),
    isSubscribed: isActive,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: status,
    subscriptionEndedAt: isActive ? null : new Date(),
    subscriptionSource: "stripe_web",
    currentPeriodEnd,
  } as any);
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const providerId = subscription.metadata?.providerId;
  if (!providerId) return;

  await upsertProviderPlanSubscription(providerId, {
    planTier: "free",
    isSubscribed: false,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: "canceled",
    subscriptionEndedAt: new Date(),
    subscriptionSource: "stripe_web",
  } as any);

  await notifyProviderUser(
    providerId,
    "Subscription cancelled",
    "Your HomeBase Pro subscription has been cancelled. You can resubscribe anytime.",
    "subscription.cancelled",
  );
}

export async function handleSubscriptionInvoicePaymentFailed(
  stripeInvoice: Stripe.Invoice,
) {
  const subscriptionId = (stripeInvoice as any).subscription?.toString();
  if (!subscriptionId) return;

  // Look up the subscription via metadata or via our stored stripe_subscription_id
  let providerId = stripeInvoice.subscription_details?.metadata?.providerId;
  if (!providerId) {
    const [plan] = await db
      .select()
      .from(providerPlans)
      .where(eq(providerPlans.stripeSubscriptionId, subscriptionId));
    providerId = plan?.providerId;
  }
  if (!providerId) {
    console.warn(
      "[subscription] invoice.payment_failed could not resolve providerId for subscription",
      subscriptionId,
    );
    return;
  }

  await upsertProviderPlanSubscription(providerId, {
    subscriptionStatus: "past_due",
  } as any);

  await notifyProviderUser(
    providerId,
    "Payment failed",
    "We couldn't charge your card for HomeBase Pro. Please update your billing info to keep your subscription active.",
    "subscription.payment_failed",
  );
}

export { getStripe };
