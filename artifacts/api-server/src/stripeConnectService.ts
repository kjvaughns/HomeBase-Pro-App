import Stripe from "stripe";
import { db } from "./db";
import { eq, and, inArray, gte, lte } from "drizzle-orm";
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
} from "@workspace/db";
import { dispatch, dispatchNotification, claimNotificationDelivery, logDelivery } from "./notificationService";
import { grantReferralCreditsIfFirstBooking } from "./referralService";

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

/**
 * Stripe processing fee passed through to the homeowner: 2.9% + $0.30.
 *
 * Adding this on top of the provider's quoted price means:
 *   - Provider receives their full quoted amount (untouched)
 *   - Platform keeps a clean 3% via application_fee_amount
 *   - Homeowner absorbs Stripe's processing cost as a transparent line item
 *
 * Residual: Stripe's 2.9% applies to the total charge (job + this fee), so
 * the platform absorbs a ~0.14% shortfall per transaction. The recursive
 * formula that eliminates this would charge homeowners ~6% instead of 2.9%
 * + $0.30 — not a reasonable trade-off.
 */
export function calculateStripePassthroughFee(jobCents: number): number {
  return Math.round(jobCents * 0.029 + 30);
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
  tipCents = 0,
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

  // Task #478: normalize/validate the optional gratuity. Never trust a
  // negative or non-integer value from the client.
  const safeTipCents =
    Number.isFinite(tipCents) && tipCents > 0 ? Math.round(tipCents) : 0;

  // The Stripe processing fee is passed through to the homeowner and is
  // computed on (job total + tip) since that's the actual amount charged.
  const stripeFeeCents = calculateStripePassthroughFee(
    invoice.totalCents + safeTipCents,
  );
  const homeownerTotalCents =
    invoice.totalCents + safeTipCents + stripeFeeCents;

  // In the destination-charge model the platform is the merchant of record and
  // pays Stripe's processing fee itself. To make the provider receive
  // (jobAmount - platformFee) — i.e. $97 on a $100 job — the
  // application_fee_amount must cover BOTH the platform's cut AND the Stripe
  // passthrough fee. Stripe then transfers (charge - application_fee_amount) to
  // the connected account, which equals the provider's net.
  //   transfer = homeownerTotal - (platformFee + processingFee)
  //            = (job + tip + processingFee) - platformFee - processingFee
  //            = job + tip - platformFee  ← provider receives their share
  //              plus the full tip, untouched by the platform fee.
  const platformFeeCents = invoice.platformFeeCents || 0;
  const destinationAppFee = platformFeeCents + stripeFeeCents;

  const paymentIntent = await getStripe().paymentIntents.create({
    amount: homeownerTotalCents,
    currency: invoice.currency || "usd",
    application_fee_amount: destinationAppFee,
    transfer_data: {
      destination: connectAccount.stripeAccountId,
    },
    metadata: {
      invoiceId: invoice.id,
      providerId: invoice.providerId,
      payerUserId: payerUserId || "",
      jobAmountCents: String(invoice.totalCents),
      platformFeeCents: String(platformFeeCents),
      stripeFeeCents: String(stripeFeeCents),
      tipCents: String(safeTipCents),
    },
  });

  await db
    .update(invoices)
    .set({
      stripePaymentIntentId: paymentIntent.id,
      tipCents: safeTipCents,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));

  await db.insert(payments).values({
    invoiceId: invoice.id,
    providerId: invoice.providerId,
    amountCents: homeownerTotalCents,
    amount: (homeownerTotalCents / 100).toFixed(2),
    method: "stripe",
    status: "requires_payment",
    stripePaymentIntentId: paymentIntent.id,
    tipCents: safeTipCents,
  });

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount: homeownerTotalCents,
    jobAmountCents: invoice.totalCents,
    stripeFeeCents,
    tipCents: safeTipCents,
  };
}

export interface AutopayChargeResult {
  success: boolean;
  /** Human-readable reason set whenever success is false — surfaced to the
   *  provider so the fallback to manual invoicing is never silent. */
  reason?: string;
  paymentIntentId?: string;
}

/**
 * Task #474: attempt an off-session charge against a client's saved card for
 * an autopay-generated invoice. Unlike createInvoicePaymentIntent (which
 * returns a client_secret for the homeowner to confirm in-app), this
 * confirms immediately server-side with no customer interaction — exactly
 * the "off_session: true, confirm: true" flow described in the task.
 *
 * Never throws for expected failure modes (missing card, decline, provider
 * not ready) — callers must fall back to a normal manual invoice on any
 * `success: false` result rather than surfacing a 500.
 */
export async function attemptAutopayCharge(
  invoiceId: string,
): Promise<AutopayChargeResult> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId));
  if (!invoice) return { success: false, reason: "Invoice not found" };
  if (invoice.status === "paid") return { success: true };

  const connectAccount = await getConnectAccount(invoice.providerId);
  if (!connectAccount?.chargesEnabled) {
    return {
      success: false,
      reason: "Provider payment processing is not yet enabled",
    };
  }

  if (!invoice.homeownerUserId) {
    return {
      success: false,
      reason:
        "No homeowner account linked to this client — a saved card is required for autopay",
    };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, invoice.homeownerUserId));
  if (!user?.stripeCustomerId || !user.defaultPaymentMethodId) {
    return {
      success: false,
      reason: "No saved card on file for this client",
    };
  }

  // Same fee math as createInvoicePaymentIntent — see comment there.
  const stripeFeeCents = calculateStripePassthroughFee(invoice.totalCents);
  const homeownerTotalCents = invoice.totalCents + stripeFeeCents;
  const platformFeeCents = invoice.platformFeeCents || 0;
  const destinationAppFee = platformFeeCents + stripeFeeCents;

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await getStripe().paymentIntents.create({
      amount: homeownerTotalCents,
      currency: invoice.currency || "usd",
      customer: user.stripeCustomerId,
      payment_method: user.defaultPaymentMethodId,
      off_session: true,
      confirm: true,
      application_fee_amount: destinationAppFee,
      transfer_data: {
        destination: connectAccount.stripeAccountId,
      },
      metadata: {
        invoiceId: invoice.id,
        providerId: invoice.providerId,
        payerUserId: invoice.homeownerUserId,
        jobAmountCents: String(invoice.totalCents),
        platformFeeCents: String(platformFeeCents),
        stripeFeeCents: String(stripeFeeCents),
        autopay: "true",
      },
    });
  } catch (err: any) {
    const declineReason =
      err?.raw?.decline_code ||
      err?.decline_code ||
      err?.raw?.message ||
      err?.message ||
      "Card was declined";
    return { success: false, reason: String(declineReason) };
  }

  await db
    .update(invoices)
    .set({ stripePaymentIntentId: paymentIntent.id, updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId));

  if (paymentIntent.status === "succeeded") {
    // Mark paid immediately rather than waiting on the async webhook —
    // handlePaymentIntentSucceeded is idempotent (upserts on PI id) so it's
    // safe if the webhook also delivers this event later.
    await handlePaymentIntentSucceeded(paymentIntent);
    return { success: true, paymentIntentId: paymentIntent.id };
  }

  // An off-session confirmation should resolve to 'succeeded' or throw; any
  // other terminal status (e.g. requires_action for a card that turned out
  // to need 3DS) can't be resolved without the customer present, so treat it
  // as a failure requiring manual follow-up.
  return {
    success: false,
    reason: `Card requires additional authentication (status: ${paymentIntent.status})`,
    paymentIntentId: paymentIntent.id,
  };
}

export interface NoShowFeeChargeResult {
  success: boolean;
  /** How the fee was resolved. Mirrors jobs.no_show_fee_status. */
  method?: "charged_card" | "covered_by_deposit";
  reason?: string;
  paymentIntentId?: string;
}

/**
 * Task #478: charge a provider-set no-show fee against the client's saved
 * card, falling back to treating an existing paid booking deposit as
 * covering the fee (the deposit already sits with the provider — no new
 * Stripe call is needed in that case). Never throws for expected failure
 * modes; callers should surface `reason` to the provider rather than a 500.
 */
export async function attemptNoShowFeeCharge(params: {
  jobId: string;
  clientId: string | null;
  appointmentId: string | null;
  providerId: string;
  amountCents: number;
  /**
   * Task #478 code review: pass a deterministic key (e.g. `no-show-fee:<jobId>`)
   * so a network retry of the calling request can never create a second
   * Stripe PaymentIntent for the same no-show fee.
   */
  idempotencyKey?: string;
}): Promise<NoShowFeeChargeResult> {
  const { clientId, appointmentId, providerId, amountCents, idempotencyKey } = params;

  const connectAccount = await getConnectAccount(providerId);
  if (!connectAccount?.chargesEnabled) {
    return {
      success: false,
      reason: "Provider payment processing is not yet enabled",
    };
  }

  // Prefer charging the client's saved card, since that's an active charge
  // for the exact fee amount the provider specified.
  let homeownerUserId: string | null = null;
  if (clientId) {
    const [client] = await db
      .select({ homeownerUserId: clients.homeownerUserId })
      .from(clients)
      .where(eq(clients.id, clientId));
    homeownerUserId = client?.homeownerUserId ?? null;
  }

  let user: { stripeCustomerId: string | null; defaultPaymentMethodId: string | null } | undefined;
  if (homeownerUserId) {
    [user] = await db
      .select({
        stripeCustomerId: users.stripeCustomerId,
        defaultPaymentMethodId: users.defaultPaymentMethodId,
      })
      .from(users)
      .where(eq(users.id, homeownerUserId));
  }

  if (user?.stripeCustomerId && user?.defaultPaymentMethodId) {
    // No platform fee/tip math here — this is a standalone fee charge, not
    // tied to an invoice. The full amount is charged to the client; the
    // application fee is intentionally $0 so the provider keeps the entire
    // no-show fee (they're the one absorbing the missed-appointment cost).
    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await getStripe().paymentIntents.create(
        {
          amount: amountCents,
          currency: "usd",
          customer: user.stripeCustomerId,
          payment_method: user.defaultPaymentMethodId,
          off_session: true,
          confirm: true,
          transfer_data: {
            destination: connectAccount.stripeAccountId,
          },
          metadata: {
            jobId: params.jobId,
            providerId,
            noShowFee: "true",
          },
        },
        idempotencyKey ? { idempotencyKey } : undefined,
      );
    } catch (err: any) {
      const declineReason =
        err?.raw?.decline_code ||
        err?.decline_code ||
        err?.raw?.message ||
        err?.message ||
        "Card was declined";
      return { success: false, reason: String(declineReason) };
    }

    if (paymentIntent.status === "succeeded") {
      return {
        success: true,
        method: "charged_card",
        paymentIntentId: paymentIntent.id,
      };
    }
    return {
      success: false,
      reason: `Card requires additional authentication (status: ${paymentIntent.status})`,
      paymentIntentId: paymentIntent.id,
    };
  }

  // No saved card — fall back to an already-collected deposit, if any. The
  // deposit already transferred to the provider's Connect balance when it
  // was paid, so "charging" it just means the provider keeps it instead of
  // refunding it; no new Stripe action is required.
  if (appointmentId) {
    const [appt] = await db
      .select({
        depositStatus: appointments.depositStatus,
        depositAmountCents: appointments.depositAmountCents,
      })
      .from(appointments)
      .where(eq(appointments.id, appointmentId));
    const depositAmountCents = appt?.depositAmountCents || 0;
    if (appt?.depositStatus === "paid" && depositAmountCents > 0) {
      // Task #478 code review: only report the fee as fully "covered" when
      // the deposit actually meets or exceeds the requested amount. A
      // smaller deposit must not be presented as covering the full fee.
      if (depositAmountCents >= amountCents) {
        return { success: true, method: "covered_by_deposit" };
      }
      return {
        success: false,
        reason: `Deposit on file ($${(depositAmountCents / 100).toFixed(2)}) is less than the requested fee ($${(amountCents / 100).toFixed(2)}); no saved card to charge the remainder`,
      };
    }
  }

  return {
    success: false,
    reason: "No saved card or deposit on file for this client",
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
          existing.status !== "uncollectible" &&
          // A Stripe invoice with total === 0 was auto-marked as paid by Stripe
          // when it was created under the old `unit_amount` bug (Stripe ignores
          // unknown params and creates $0 items, then auto-closes the invoice).
          // Treat any $0 invoice as corrupt and fall through to create a fresh
          // one with the correct amounts.
          existing.total > 0
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

  // actualServiceCents tracks the exact cents being sent to Stripe so that
  // the passthrough fee and platform fee are both computed from the same base.
  let actualServiceCents = 0;

  if (lineItems.length > 0) {
    let validItemCount = 0;
    for (const item of lineItems) {
      // FIX: Use the pre-calculated line total (qty × unitPrice with real float
      // precision) stored as `item.total` rather than recomputing from
      // integer-rounded qty. The old `Math.max(1, Math.round(rawQty))` rounding
      // inflated Stripe amounts for fractional quantities (e.g. qty=0.265 billed
      // as qty=1 × unitPrice, 4× the intended amount), while the DB correctly
      // stored the real total — causing a mismatch between what Stripe charged
      // and what `platformFeeCents` was calculated on.
      const rawLineTotal = parseFloat(item.total?.toString() || "0");
      const rawUnitPrice = parseFloat(item.unitPrice?.toString() || "0");
      const rawQty = parseFloat(item.quantity?.toString() || "1");

      let lineTotalCents: number;
      if (Number.isFinite(rawLineTotal) && rawLineTotal > 0) {
        // Primary path: stored total exactly matches what the DB used for
        // subtotalCents, so both amounts are always in sync.
        lineTotalCents = Math.round(rawLineTotal * 100);
      } else {
        // Fallback for older line items without a `total` field: use real float
        // qty (not rounded to integer) so Stripe still gets the correct amount.
        const unitAmountCents = Math.round(
          (Number.isFinite(rawUnitPrice) ? rawUnitPrice : 0) * 100,
        );
        const qty = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1;
        lineTotalCents = Math.round(unitAmountCents * qty);
      }

      // Stripe requires a finite positive integer for `amount`.
      if (!Number.isFinite(lineTotalCents) || !Number.isInteger(lineTotalCents) || lineTotalCents <= 0) {
        continue;
      }
      actualServiceCents += lineTotalCents;
      validItemCount++;
      await getStripe().invoiceItems.create(
        {
          customer: stripeCustomerId,
          // `amount` is the total for this line in the smallest currency unit
          // (cents for USD). Using `amount` (not `unit_amount`) is the correct
          // Stripe Invoice Items API field for a pre-calculated total.
          amount: lineTotalCents,
          currency: invoice.currency || "usd",
          description: item.description || item.name || "Service",
        },
        { stripeAccount: connectId },
      );
    }
    // Fail closed: if every line item was invalid, refuse to create a partial
    // invoice that would contain only a processing fee with no service lines.
    if (validItemCount === 0) {
      throw new Error(
        "Invoice has no valid billable line items — all amounts are zero or invalid.",
      );
    }
  } else {
    const rawTotal =
      invoice.totalCents ||
      Math.round(parseFloat(invoice.total?.toString() || "0") * 100);
    const totalCents = Number.isFinite(rawTotal) ? rawTotal : 0;
    if (!Number.isFinite(totalCents) || !Number.isInteger(totalCents) || totalCents <= 0) {
      throw new Error(
        "Invoice total must be a valid positive amount to create a Stripe invoice.",
      );
    }
    actualServiceCents = totalCents;
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

  // ── 2b. Add Stripe processing fee as a transparent line item ────────────
  // Use actualServiceCents (sum of what was actually sent to Stripe) rather than
  // the stored invoice.totalCents, which may be stale from an earlier draft.
  const stripePassthroughFeeCentsForInvoice = calculateStripePassthroughFee(
    actualServiceCents,
  );
  if (
    Number.isFinite(stripePassthroughFeeCentsForInvoice) &&
    Number.isInteger(stripePassthroughFeeCentsForInvoice) &&
    stripePassthroughFeeCentsForInvoice > 0
  ) {
    await getStripe().invoiceItems.create(
      {
        customer: stripeCustomerId,
        amount: stripePassthroughFeeCentsForInvoice,
        currency: invoice.currency || "usd",
        description: "Processing fee (2.9% + $0.30)",
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

  // FIX: Recalculate platform fee from actualServiceCents rather than using the
  // stored invoice.platformFeeCents, which may be stale (set when the invoice
  // was first drafted) and might not match the real line items being billed now.
  const plan = await getProviderPlan(invoice.providerId);
  const platformFeeCents = calculatePlatformFee(
    actualServiceCents,
    plan.platformFeePercent,
    plan.platformFeeFixedCents,
  ).totalCents;

  // Persist the corrected platform fee so DB stays in sync with Stripe.
  if (platformFeeCents !== (invoice.platformFeeCents ?? 0)) {
    await db
      .update(invoices)
      .set({ platformFeeCents, updatedAt: new Date() })
      .where(eq(invoices.id, invoice.id));
  }
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
      // Stripe SDK v20+ changed standalone invoice behaviour: pending invoice
      // items are NOT automatically included unless explicitly requested.
      // Without this flag every invoice we create is $0 because the items
      // we added above sit in the pending pool and are never attached.
      pending_invoice_items_behavior: "include",
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

  console.log(
    `[stripe-invoice] created draft ${stripeInvoice.id} for customer ${stripeCustomerId} on ${connectId} — finalizing`,
  );

  const finalized = await getStripe().invoices.finalizeInvoice(
    stripeInvoice.id,
    { stripeAccount: connectId },
  );

  console.log(
    `[stripe-invoice] finalized ${finalized.id} | total=${finalized.total} | lines=${finalized.lines?.total_count ?? "?"} | status=${finalized.status} | invoiceId=${invoiceId}`,
  );

  // Hard guard: never send a $0 invoice — it means items were not attached.
  if (!finalized.total || finalized.total <= 0) {
    // Void the empty invoice to keep the Stripe dashboard clean.
    await getStripe()
      .invoices.voidInvoice(finalized.id, { stripeAccount: connectId })
      .catch(() => {});
    throw new Error(
      `[stripe-invoice] Invoice ${finalized.id} finalized with total=${finalized.total} — refusing to send a $0 invoice. Pending items were not attached. (invoiceId=${invoiceId})`,
    );
  }

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

export async function createStripeCheckoutSession(
  invoiceId: string,
  chargeAmountCents?: number,
  tipCents = 0,
) {
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

  // When a partial credit has been applied, chargeAmountCents is the remaining
  // balance after credits. Use a single line item for that amount so Stripe
  // only charges the net amount due.
  const effectiveAmount = chargeAmountCents ?? invoice.totalCents;
  const isPartialCharge =
    chargeAmountCents !== undefined && chargeAmountCents < invoice.totalCents;

  let stripeLineItems: {
    price_data: {
      currency: string;
      product_data: { name: string; description?: string };
      unit_amount: number;
    };
    quantity: number;
  }[];

  if (isPartialCharge) {
    // Credits already applied — single item for the net remaining amount.
    stripeLineItems = [
      {
        price_data: {
          currency: invoice.currency || "usd",
          product_data: {
            name: `Invoice ${invoice.invoiceNumber} (after credits)`,
            description: invoice.notes || undefined,
          },
          unit_amount: effectiveAmount,
        },
        quantity: 1,
      },
    ];
  } else {
    const lineItemsData = await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId));

    stripeLineItems = lineItemsData.map((item) => ({
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
  }

  // Task #478: normalize/validate the optional gratuity. Never trust a
  // negative or non-integer value from the client. Tips flow 100% to the
  // provider, so they're added as their own line item and excluded from the
  // application_fee_amount base below.
  const safeTipCents =
    Number.isFinite(tipCents) && tipCents! > 0 ? Math.round(tipCents!) : 0;
  if (safeTipCents > 0) {
    stripeLineItems.push({
      price_data: {
        currency: invoice.currency || "usd",
        product_data: { name: "Tip" },
        unit_amount: safeTipCents,
      },
      quantity: 1,
    });
  }

  // Pass Stripe processing fee through to the homeowner as a visible line item
  // so the provider receives their full quoted amount untouched.
  // Fee is calculated on the effective charge amount (after any credit
  // reduction) plus any tip, since that's the actual amount charged.
  const checkoutStripeFeeCents = calculateStripePassthroughFee(
    effectiveAmount + safeTipCents,
  );
  stripeLineItems.push({
    price_data: {
      currency: invoice.currency || "usd",
      product_data: { name: "Processing fee (2.9% + $0.30)" },
      unit_amount: checkoutStripeFeeCents,
    },
    quantity: 1,
  });

  // Destination-charge model: application_fee_amount = platformFee + processingFee
  // so the transfer to the connected account = jobAmount + tip - platformFee.
  // Scale platform fee proportionally when credits reduced the charge amount.
  // The tip is deliberately excluded from this base so it passes through
  // untouched to the provider.
  const scaledPlatformFee = isPartialCharge
    ? Math.round((invoice.platformFeeCents || 0) * (effectiveAmount / invoice.totalCents))
    : (invoice.platformFeeCents || 0);
  const checkoutAppFee = scaledPlatformFee + checkoutStripeFeeCents;

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: stripeLineItems,
    payment_intent_data: {
      application_fee_amount: checkoutAppFee,
      transfer_data: {
        destination: connectAccount.stripeAccountId,
      },
      metadata: {
        invoiceId: invoice.id,
        providerId: invoice.providerId,
        platformFeeCents: String(invoice.platformFeeCents || 0),
        stripeFeeCents: String(checkoutStripeFeeCents),
        tipCents: String(safeTipCents),
      },
    },
    success_url: `${PUBLIC_REDIRECT_BASE}/payment-success?invoiceId=${encodeURIComponent(invoiceId)}${invoice.jobId ? `&jobId=${encodeURIComponent(invoice.jobId)}` : ""}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${PUBLIC_REDIRECT_BASE}/payment-cancelled?invoiceId=${encodeURIComponent(invoiceId)}${invoice.jobId ? `&jobId=${encodeURIComponent(invoice.jobId)}` : ""}`,
    metadata: {
      invoiceId: invoice.id,
      providerId: invoice.providerId,
      tipCents: String(safeTipCents),
    },
  });

  await db
    .update(invoices)
    .set({
      stripeCheckoutSessionId: session.id,
      hostedInvoiceUrl: session.url,
      tipCents: safeTipCents,
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
  // Wrap all reads + writes in a single transaction so no partial state is
  // committed if any step fails. This prevents balance deductions without
  // matching ledger/payment records.
  return await db.transaction(async (tx) => {
    const [invoice] = await tx
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

    const [userCredit] = await tx
      .select()
      .from(userCredits)
      .where(eq(userCredits.userId, userId));

    if (!userCredit || (userCredit.balanceCents || 0) < amountCents) {
      throw new Error("Insufficient credits");
    }

    // Compute outstanding balance within the transaction for consistent reads.
    const succeededPayments = await tx
      .select({ amountCents: payments.amountCents })
      .from(payments)
      .where(and(eq(payments.invoiceId, invoiceId), eq(payments.status, "succeeded")));
    const alreadyPaid = succeededPayments.reduce((s, p) => s + (p.amountCents || 0), 0);

    const maxPayable = invoice.totalCents - alreadyPaid;
    const actualAmount = Math.min(amountCents, maxPayable);

    if (actualAmount <= 0) {
      throw new Error("Invoice is already paid or no amount due");
    }

    await tx
      .update(userCredits)
      .set({
        balanceCents: (userCredit.balanceCents || 0) - actualAmount,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userId, userId));

    await tx.insert(creditLedger).values({
      userId,
      deltaCents: -actualAmount,
      reason: "invoice_payment",
      invoiceId,
    });

    await tx.insert(payments).values({
      invoiceId,
      providerId: invoice.providerId,
      amountCents: actualAmount,
      amount: (actualAmount / 100).toFixed(2),
      method: "credits",
      status: "succeeded",
    });

    const newPaidTotal = alreadyPaid + actualAmount;
    const isFullyPaid = newPaidTotal >= invoice.totalCents;

    await tx
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
  });
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
  // Task #474: the autopay off-session charge stamps this metadata flag when
  // it creates the PaymentIntent — surface it on the payment row so provider
  // UI (financials/invoice detail) can distinguish auto-charged payments
  // from ones the homeowner confirmed manually via Checkout / in-app.
  const isAutopay = paymentIntent.metadata?.autopay === "true";
  // Task #478: tip amount stamped in metadata by createInvoicePaymentIntent.
  const rawTip = Number(paymentIntent.metadata?.tipCents);
  const tipCents = Number.isFinite(rawTip) && rawTip > 0 ? Math.round(rawTip) : 0;

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
      autoCharged: isAutopay,
      tipCents,
    })
    .onConflictDoUpdate({
      target: payments.stripePaymentIntentId,
      set: {
        status: "succeeded",
        stripeChargeId,
        autoCharged: isAutopay,
        tipCents,
      },
    });

  const [updatedInvoice] = await db
    .update(invoices)
    .set({
      status: "paid",
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntent.id,
      updatedAt: new Date(),
      ...(isAutopay ? { chargeType: "autopay" as const } : {}),
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

  // First payment celebration flag — set once per provider (Task #407).
  // Only fires on the very first payment; all subsequent payments skip this.
  if (updatedInvoice) {
    try {
      const [currentProvider] = await db
        .select({ firstPaymentReceived: providers.firstPaymentReceived })
        .from(providers)
        .where(eq(providers.id, updatedInvoice.providerId));
      if (currentProvider && !currentProvider.firstPaymentReceived) {
        await db
          .update(providers)
          .set({
            firstPaymentReceived: true,
            firstPaymentAmountCents: amountCents,
          })
          .where(eq(providers.id, updatedInvoice.providerId));
      }
    } catch (e) {
      console.error("[first-payment] celebration flag failed (webhook):", e);
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

      // Monthly goal milestone notifications (Task #408)
      // Check if the provider has crossed 50% or 100% of their monthly goal
      // after this payment. Uses per-month flags to fire each milestone once.
      if (updatedInvoice) {
        (async () => {
          try {
            const [providerGoalRow] = await db
              .select({
                userId: providers.userId,
                businessName: providers.businessName,
                monthlyGoalCents: providers.monthlyGoalCents,
                goalNotified50Month: providers.goalNotified50Month,
                goalNotified100Month: providers.goalNotified100Month,
              })
              .from(providers)
              .where(eq(providers.id, updatedInvoice.providerId));

            if (!providerGoalRow?.monthlyGoalCents || !providerGoalRow.userId) return;

            const goalCents = providerGoalRow.monthlyGoalCents;

            // MTD revenue: sum paid invoices from the 1st of the current month
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

            const mtdRows = await db
              .select({ total: invoices.total })
              .from(invoices)
              .where(
                and(
                  eq(invoices.providerId, updatedInvoice.providerId),
                  eq(invoices.status, "paid"),
                  gte(invoices.paidAt, monthStart),
                  lte(invoices.paidAt, now),
                ),
              );

            const mtdCents = Math.round(
              mtdRows.reduce((sum, r) => sum + parseFloat(r.total || "0"), 0) * 100,
            );

            const pct = mtdCents / goalCents;
            const goalDollars = Math.round(goalCents / 100).toLocaleString();
            const mtdDollars = Math.round(mtdCents / 100).toLocaleString();

            // 50% milestone
            if (
              pct >= 0.5 &&
              pct < 1.0 &&
              providerGoalRow.goalNotified50Month !== monthKey
            ) {
              await db
                .update(providers)
                .set({ goalNotified50Month: monthKey })
                .where(eq(providers.id, updatedInvoice.providerId));
              dispatchNotification(
                providerGoalRow.userId,
                "Halfway there! 🎯",
                `You've earned $${mtdDollars} of your $${goalDollars} goal this month — keep it up!`,
                "goal_milestone_50",
                { type: "goal_milestone", milestone: "50", screen: "HomeTab" },
                "earnings",
              ).catch((e: unknown) =>
                console.error("[goal-milestone] 50% push error:", e),
              );
            }

            // 100% milestone
            if (
              pct >= 1.0 &&
              providerGoalRow.goalNotified100Month !== monthKey
            ) {
              await db
                .update(providers)
                .set({ goalNotified100Month: monthKey })
                .where(eq(providers.id, updatedInvoice.providerId));
              dispatchNotification(
                providerGoalRow.userId,
                "Goal reached! 🎉",
                `You hit your $${goalDollars} goal this month! Amazing work.`,
                "goal_milestone_100",
                { type: "goal_milestone", milestone: "100", screen: "HomeTab" },
                "earnings",
              ).catch((e: unknown) =>
                console.error("[goal-milestone] 100% push error:", e),
              );
            }
          } catch (e) {
            console.error("[goal-milestone] Monthly goal notification error:", e);
          }
        })();
      }

      // $1,000 lifetime earnings referral milestone
      // Each time a provider crosses a new $1,000 threshold in lifetime paid
      // revenue, send a push nudging them to refer another pro. Fire-and-forget.
      if (updatedInvoice) {
        (async () => {
          try {
            const [providerInfo] = await db
              .select({ userId: providers.userId, businessName: providers.businessName })
              .from(providers)
              .where(eq(providers.id, updatedInvoice.providerId));

            if (!providerInfo?.userId) return;

            // Sum all paid invoices for this provider (includes the just-paid one)
            const lifetimeRows = await db
              .select({ total: invoices.total })
              .from(invoices)
              .where(
                and(
                  eq(invoices.providerId, updatedInvoice.providerId),
                  eq(invoices.status, "paid"),
                ),
              );

            const lifetimeDollars = lifetimeRows.reduce(
              (sum, r) => sum + parseFloat(r.total || "0"),
              0,
            );

            // Amount of this specific invoice (what was just paid)
            const thisInvoiceDollars = parseFloat(updatedInvoice.total || "0");
            const previousDollars = lifetimeDollars - thisInvoiceDollars;

            // Check if we crossed a $1,000 boundary
            const prevThreshold = Math.floor(previousDollars / 1000);
            const newThreshold = Math.floor(lifetimeDollars / 1000);

            if (newThreshold > prevThreshold && newThreshold >= 1) {
              const milestoneAmount = newThreshold * 1000;
              dispatchNotification(
                providerInfo.userId,
                `You just hit $${milestoneAmount.toLocaleString()} through HomeBase 🎉`,
                "Know another pro who'd love this? Give them a month free.",
                "referral_revenue_milestone",
                {
                  type: "referral_revenue_milestone",
                  screen: "ReferAPro",
                  milestoneAmount,
                },
                "earnings",
              ).catch((e: unknown) =>
                console.error("[referral-milestone] push error:", e),
              );
            }
          } catch (e) {
            console.error("[referral-milestone] Lifetime earnings milestone error:", e);
          }
        })();
      }
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

    // Referral credit check — if this homeowner was referred, credit both parties
    // on their first paid invoice (fire-and-forget, idempotent)
    if (updatedInvoice.homeownerUserId) {
      grantReferralCreditsIfFirstBooking(updatedInvoice.homeownerUserId).catch(
        (e: unknown) =>
          console.error("[invoice.paid] referral credit check failed:", e),
      );
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
    // A `charge.refunded` event fires for both partial and full refunds.
    // Stripe's own `charge.refunded` boolean (and amount_refunded ===
    // amount) tells us whether the *entire* charge has now been refunded.
    // Only a full refund should flip the payment/invoice to "refunded" —
    // a partial refund must leave the payment "succeeded" and the invoice
    // in its paid/partially-paid state so the remaining balance still
    // shows as collected.
    const isFullRefund =
      charge.refunded === true ||
      (typeof charge.amount_refunded === "number" &&
        typeof charge.amount === "number" &&
        charge.amount_refunded >= charge.amount);

    if (isFullRefund) {
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
    }

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
      // Task #478: tip is already reflected in invoice.tipCents (set at
      // checkout-session creation time) and in the Stripe session's own
      // amount_total (which includes the tip line item).
      const tipCents = invoice.tipCents || 0;
      const amountCents = session.amount_total ?? invoice.totalCents + tipCents;
      await db.insert(payments).values({
        invoiceId,
        providerId: invoice.providerId,
        amountCents,
        amount: (amountCents / 100).toFixed(2),
        method: "stripe",
        status: "succeeded",
        stripePaymentIntentId: paymentIntentId,
        tipCents,
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

  const depositStripeFeeCents = calculateStripePassthroughFee(amountCents);

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
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Processing fee (2.9% + $0.30)" },
          unit_amount: depositStripeFeeCents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      // Destination-charge model: include processingFee in application_fee_amount
      // so provider receives amountCents - platformFee (e.g. $97 on $100 deposit).
      application_fee_amount: fee.totalCents + depositStripeFeeCents,
      transfer_data: { destination: connectAccount.stripeAccountId },
      metadata: {
        depositForAppointment: appointmentId,
        providerId,
        jobAmountCents: String(amountCents),
        platformFeeCents: String(fee.totalCents),
        stripeFeeCents: String(depositStripeFeeCents),
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

  const cancelStripeFeeCents = calculateStripePassthroughFee(amountCents);

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
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Processing fee (2.9% + $0.30)" },
          unit_amount: cancelStripeFeeCents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      // Destination-charge model: include processingFee in application_fee_amount
      // so provider receives amountCents - platformFee (e.g. $97 on $100 fee).
      application_fee_amount: fee.totalCents + cancelStripeFeeCents,
      transfer_data: { destination: connectAccount.stripeAccountId },
      metadata: {
        cancellationFeeForAppointment: appointmentId,
        providerId,
        jobAmountCents: String(amountCents),
        platformFeeCents: String(fee.totalCents),
        stripeFeeCents: String(cancelStripeFeeCents),
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

  const stripePassthroughFeeCents = calculateStripePassthroughFee(totalCents);

  return {
    planTier: plan.planTier,
    feePercent: fee.percent,
    feeFixedCents: fee.fixedCents,
    platformFeeCents: fee.totalCents,
    stripePassthroughFeeCents,
    homeownerTotalCents: totalCents + stripePassthroughFeeCents,
    // Provider receives the job amount minus the 3% platform fee.
    // The homeowner's processing fee covers Stripe's cost — it does not
    // reach the provider's account.
    providerReceivesCents: totalCents - fee.totalCents,
    totalFeeCents: fee.totalCents,
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
// ── Task #354: Permanent 10% discount coupon (referral milestone) ────────────
//
// Stripe coupon ID is deterministic so the call is idempotent — if it already
// exists we just retrieve it; if it doesn't we create it.
const PERMANENT_DISCOUNT_COUPON_ID = "homebase_pro_permanent_10pct";

async function getOrCreatePermanentDiscountCoupon(): Promise<string> {
  const stripe = getStripe();
  try {
    const existing = await stripe.coupons.retrieve(PERMANENT_DISCOUNT_COUPON_ID);
    return existing.id;
  } catch (_notFound) {
    // 404 → create it
  }
  const coupon = await stripe.coupons.create({
    id: PERMANENT_DISCOUNT_COUPON_ID,
    percent_off: 10,
    duration: "forever",
    name: "HomeBase Referral Reward — 10% forever",
  });
  return coupon.id;
}

/**
 * Apply the permanent 10% referral discount to a provider's EXISTING Stripe
 * subscription (called when the provider crosses the 3-referral milestone after
 * they are already subscribed). No-op if the provider has no Stripe subscription
 * stored or if Stripe is not configured.
 */
export async function applyPermanentDiscountToExistingSubscription(
  providerId: string,
): Promise<void> {
  try {
    if (!process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_TEST_SECRET_KEY) return;

    const [plan] = await db
      .select({ stripeSubscriptionId: providerPlans.stripeSubscriptionId })
      .from(providerPlans)
      .where(eq(providerPlans.providerId, providerId));

    const subId = plan?.stripeSubscriptionId;
    if (!subId) return; // not yet on a Stripe subscription

    const couponId = await getOrCreatePermanentDiscountCoupon();
    await getStripe().subscriptions.update(subId, {
      discounts: [{ coupon: couponId }],
    });
  } catch (err) {
    // Non-fatal — the discount will be applied the next time the provider
    // creates a new checkout session.
    console.error("[stripeConnectService] applyPermanentDiscountToExistingSubscription error:", {
      providerId,
      err: String(err),
    });
  }
}

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

  // Task #354: apply permanent 10% discount coupon if the provider has earned
  // the 3-referral milestone reward.
  const [plan] = await db
    .select({ permanentDiscountPercent: providerPlans.permanentDiscountPercent })
    .from(providerPlans)
    .where(eq(providerPlans.providerId, opts.providerId));

  let discountCouponId: string | null = null;
  if ((plan?.permanentDiscountPercent ?? 0) >= 10) {
    try {
      discountCouponId = await getOrCreatePermanentDiscountCoupon();
    } catch (couponErr) {
      // Non-fatal — proceed without discount rather than blocking checkout.
      console.error("[stripeConnectService] failed to load discount coupon:", couponErr);
    }
  }

  const customerId = await getOrCreateUserStripeCustomer(opts.userId);

  // Stripe rejects sessions that have both allow_promotion_codes and explicit
  // discounts — when we apply the earned coupon, disable promo code entry.
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
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
  };

  if (discountCouponId) {
    sessionParams.discounts = [{ coupon: discountCouponId }];
  } else {
    sessionParams.allow_promotion_codes = true;
  }

  const session = await getStripe().checkout.sessions.create(sessionParams);

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
  isActive?: boolean,
): "free" | "professional" {
  if (!status) return "free";
  if (isActive !== undefined) return isActive ? "professional" : "free";
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

  const periodEndUnix = (subscription as any).current_period_end;
  const currentPeriodEnd =
    typeof periodEndUnix === "number" ? new Date(periodEndUnix * 1000) : null;

  // `past_due` means Stripe is still retrying the card (Smart Retries) —
  // the provider hasn't actually lost access yet. Keep them subscribed
  // until the current billing period actually ends, mirroring the grace
  // period we give RevenueCat's BILLING_ISSUE event. Only flip access off
  // once currentPeriodEnd has passed (or Stripe gives up and moves the
  // subscription to `canceled`/`unpaid`).
  const isPastDueInGrace =
    status === "past_due" &&
    currentPeriodEnd !== null &&
    currentPeriodEnd.getTime() > Date.now();
  const isActive =
    status === "active" || status === "trialing" || isPastDueInGrace;

  await upsertProviderPlanSubscription(providerId, {
    planTier: planTierForStatus(status, isActive),
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
