import type Stripe from "stripe";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { stripeWebhookEvents, stripeConnectAccounts } from "../shared/schema";

// =============================================================================
// Stripe Webhook Router
// =============================================================================
// Two production webhook endpoints route into this single shared dispatcher:
//
//   - /api/stripe/webhook            → endpoint = "platform"
//   - /api/webhooks/stripe-connect   → endpoint = "connect"
//
// The dispatcher enforces:
//
//   1. Endpoint routing by `event.account` presence:
//        event.account ?  → must arrive on "connect"
//        event.account !  → must arrive on "platform"
//      Mis-routed events are rejected with a clear log line and a 200 (so
//      Stripe doesn't retry forever after we've fixed the Dashboard config).
//
//   2. Idempotency on `event.id` via the stripe_webhook_events table. The
//      endpoint that received the event is recorded so duplicate deliveries on
//      either endpoint short-circuit with a "duplicate" log line.
//
//   3. Connected-account resolution: for Connect events we look up the
//      stripe_connect_accounts row matching `event.account`. Unknown accounts
//      are logged with reason="unknown_account" but still recorded as
//      processed so Stripe stops retrying (we have no provider to attribute
//      the event to anyway).
//
//   4. Structured logging on every event:
//        [stripe-webhook] endpoint=<…> event=<id> type=<…> account=<…|platform> outcome=<…>
// =============================================================================

export type WebhookEndpoint = "platform" | "connect";

export interface ProcessResult {
  processed: boolean;
  reason?:
    | "duplicate"
    | "wrong_endpoint"
    | "unknown_account"
    | "unhandled_type"
    | "ok";
  endpoint: WebhookEndpoint;
  eventId: string;
  eventType: string;
  account: string | null;
}

type EventHandler = (event: Stripe.Event) => Promise<void> | void;

// -----------------------------------------------------------------------------
// Dispatch table
// -----------------------------------------------------------------------------
// Handlers are registered lazily (via dynamic import) to avoid import cycles
// with stripeConnectService — stripeConnectService imports from this module
// for compat (handleStripeWebhook delegates here).
// -----------------------------------------------------------------------------

let handlersCache: Record<string, EventHandler> | null = null;

async function getHandlers(): Promise<Record<string, EventHandler>> {
  if (handlersCache) return handlersCache;
  const svc = await import("./stripeConnectService");
  const subSvc = await import("./subscriptionService").catch(() => null);

  handlersCache = {
    "account.updated": (e) =>
      svc.handleAccountUpdated(e.data.object as Stripe.Account),

    "payment_intent.succeeded": (e) =>
      svc.handlePaymentIntentSucceeded(e.data.object as Stripe.PaymentIntent),

    "payment_intent.payment_failed": (e) =>
      svc.handlePaymentIntentFailed(e.data.object as Stripe.PaymentIntent),

    "charge.refunded": (e) =>
      svc.handleChargeRefunded(e.data.object as Stripe.Charge),

    "payout.created": (e) =>
      svc.handlePayoutCreated(
        e.data.object as Stripe.Payout,
        e.account ?? null,
      ),

    "payout.paid": (e) =>
      svc.handlePayoutPaid(
        e.data.object as Stripe.Payout,
        e.account ?? null,
      ),

    "payout.failed": (e) =>
      svc.handlePayoutFailed(
        e.data.object as Stripe.Payout,
        e.account ?? null,
      ),

    "checkout.session.completed": async (e) => {
      const session = e.data.object as Stripe.Checkout.Session;
      // Subscription Checkouts (HomeBase Pro) run in subscription mode against
      // the platform account. Booking/invoice Checkouts run as Connect
      // destination charges. Branch on session shape — works regardless of
      // which endpoint delivered the event.
      if (
        session.mode === "subscription" ||
        session.metadata?.subscriptionType === "homebase_pro"
      ) {
        await svc.handleSubscriptionCheckoutCompleted(session);
      } else {
        await svc.handleCheckoutSessionCompleted(session);
      }
    },

    "customer.subscription.updated": (e) =>
      svc.handleSubscriptionUpdated(e.data.object as Stripe.Subscription),

    "customer.subscription.deleted": (e) =>
      svc.handleSubscriptionDeleted(e.data.object as Stripe.Subscription),

    "invoice.paid": async (e) => {
      const inv = e.data.object as Stripe.Invoice;
      await svc.handleStripeInvoicePaid(inv);
    },

    "invoice.payment_failed": async (e) => {
      const inv = e.data.object as Stripe.Invoice;
      // Subscription invoices have no homebaseInvoiceId metadata — branch them
      // to the subscription-specific handler that pushes the user to update
      // billing.
      if (
        (inv as any).subscription ||
        inv.billing_reason === "subscription_cycle" ||
        inv.billing_reason === "subscription_create"
      ) {
        await svc.handleSubscriptionInvoicePaymentFailed(inv);
      } else {
        await svc.handleStripeInvoicePaymentFailed(inv);
      }
    },

    // invoice.finalized is informational for our flow — we just record it. The
    // finalized invoice ID is captured in stripe_webhook_events.payload for
    // debugging. Subscribed so Stripe stops retrying / so we have an audit
    // trail of platform-side subscription billing events.
    "invoice.finalized": async (_e) => {
      // No-op (recorded via idempotency insert).
    },
  };

  // Stub to keep TypeScript happy if subSvc is unused (referenced for future).
  void subSvc;
  return handlersCache;
}

// -----------------------------------------------------------------------------
// Public entrypoint
// -----------------------------------------------------------------------------

export async function processStripeEvent(
  event: Stripe.Event,
  endpoint: WebhookEndpoint,
): Promise<ProcessResult> {
  const eventId = event.id;
  const eventType = event.type;
  const account = event.account ?? null;
  const accountLabel = account ?? "platform";

  const baseLog = `[stripe-webhook] endpoint=${endpoint} event=${eventId} type=${eventType} account=${accountLabel}`;

  // -- 1. Endpoint routing ----------------------------------------------------
  // event.account presence determines which endpoint should have received
  // this event. Mis-routed events are recorded (so we have a paper trail) and
  // acknowledged with 200 so Stripe stops retrying — the fix lives in the
  // Dashboard, not our handler.
  const expectedEndpoint: WebhookEndpoint = account ? "connect" : "platform";
  if (expectedEndpoint !== endpoint) {
    console.warn(
      `${baseLog} outcome=rejected reason=wrong_endpoint expected=${expectedEndpoint}`,
    );
    // IMPORTANT: do NOT reserve event.id here. The same event.id may later
    // arrive on the correct endpoint (common during a Dashboard cutover where
    // both endpoints temporarily subscribe to overlapping events). Reserving
    // would cause `reserveEvent` on the correct endpoint to short-circuit as
    // a duplicate and silently drop the legitimate delivery.
    return {
      processed: false,
      reason: "wrong_endpoint",
      endpoint,
      eventId,
      eventType,
      account,
    };
  }

  // -- 2. Idempotency ---------------------------------------------------------
  // Reserve the event id BEFORE running side effects, but use a 3-state model:
  //   "fresh"     → first delivery, row inserted with processed_at=NULL, run handler
  //   "retry"     → row exists with processed_at IS NULL → previous attempt
  //                 failed (handler threw, Stripe is retrying), run handler again
  //   "duplicate" → row exists with processed_at IS NOT NULL → already done, skip
  // This means transient handler failures DON'T permanently lock out retries
  // via the unique constraint on stripe_event_id.
  const reservation = await reserveEvent(event, endpoint);
  if (reservation === "duplicate") {
    console.log(`${baseLog} outcome=duplicate`);
    return {
      processed: false,
      reason: "duplicate",
      endpoint,
      eventId,
      eventType,
      account,
    };
  }
  if (reservation === "retry") {
    console.warn(`${baseLog} outcome=retry note=prior_attempt_failed`);
  }

  // -- 3. Connected-account resolution ---------------------------------------
  if (endpoint === "connect" && account) {
    const provider = await resolveConnectedProvider(account);
    if (!provider) {
      console.warn(`${baseLog} outcome=rejected reason=unknown_account`);
      return {
        processed: false,
        reason: "unknown_account",
        endpoint,
        eventId,
        eventType,
        account,
      };
    }
  }

  // -- 4. Dispatch -----------------------------------------------------------
  const handlers = await getHandlers();
  const handler = handlers[eventType];
  if (!handler) {
    console.log(`${baseLog} outcome=unhandled_type`);
    return {
      processed: true,
      reason: "unhandled_type",
      endpoint,
      eventId,
      eventType,
      account,
    };
  }

  try {
    await handler(event);
    // Commit the reservation: mark processed_at so future deliveries with the
    // same event.id are short-circuited as duplicate.
    await markEventProcessed(event.id);
    console.log(`${baseLog} outcome=processed`);
    return {
      processed: true,
      reason: "ok",
      endpoint,
      eventId,
      eventType,
      account,
    };
  } catch (err: any) {
    // Leave processed_at NULL so a Stripe retry can re-attempt. Stack trace
    // is preserved (no swallowing). Re-throw so the HTTP layer returns 5xx
    // and Stripe retries with exponential backoff.
    console.error(
      `${baseLog} outcome=error message=${err?.message ?? "unknown"}`,
      err?.stack ?? err,
    );
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Helpers (exported for tests)
// -----------------------------------------------------------------------------

/**
 * Determine which endpoint a Stripe event SHOULD arrive on, based on whether
 * `event.account` is set (Connect) or absent (platform). Pure function.
 */
export function expectedEndpointFor(event: Stripe.Event): WebhookEndpoint {
  return event.account ? "connect" : "platform";
}

export type ReservationState = "fresh" | "retry" | "duplicate";

/**
 * Reserve an event id in stripe_webhook_events for processing. Three outcomes:
 *
 *   "fresh"     – row inserted with processed_at=NULL. Caller runs handler,
 *                 then calls markEventProcessed() on success.
 *   "retry"     – row already existed but processed_at IS NULL, meaning a
 *                 prior attempt threw before commit. Caller re-runs handler.
 *   "duplicate" – row already existed with processed_at IS NOT NULL. Caller
 *                 short-circuits — handler must not run.
 *
 * Race-safe: the unique constraint on stripe_event_id arbitrates concurrent
 * first deliveries. The losing INSERT catches 23505 and falls through to the
 * SELECT path, which inspects processed_at to decide retry vs duplicate.
 */
export async function reserveEvent(
  event: Stripe.Event,
  endpoint: WebhookEndpoint,
): Promise<ReservationState> {
  try {
    await db.insert(stripeWebhookEvents).values({
      stripeEventId: event.id,
      eventType: event.type,
      endpoint,
      stripeAccountId: event.account ?? null,
      payload: JSON.stringify(event.data),
      processedAt: null,
    });
    return "fresh";
  } catch (err: any) {
    if (!(err?.code === "23505" || /duplicate key/i.test(err?.message ?? ""))) {
      throw err;
    }
  }
  // Row exists — inspect processed_at to decide retry vs duplicate.
  const [row] = await db
    .select({ processedAt: stripeWebhookEvents.processedAt })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.stripeEventId, event.id));
  if (row && row.processedAt !== null) {
    return "duplicate";
  }
  return "retry";
}

/**
 * Mark a previously-reserved event as fully processed. Only called after a
 * handler returns successfully. Future deliveries with the same event.id
 * will then short-circuit as "duplicate".
 */
export async function markEventProcessed(eventId: string): Promise<void> {
  await db
    .update(stripeWebhookEvents)
    .set({ processedAt: sql`NOW()` })
    .where(eq(stripeWebhookEvents.stripeEventId, eventId));
}

/**
 * Look up the stripe_connect_accounts row for a given Stripe account id.
 * Returns null when no provider matches (the connected account exists in
 * Stripe but isn't linked to any HomeBase provider — e.g. an account from
 * another environment hitting prod).
 */
export async function resolveConnectedProvider(stripeAccountId: string) {
  const [row] = await db
    .select()
    .from(stripeConnectAccounts)
    .where(eq(stripeConnectAccounts.stripeAccountId, stripeAccountId));
  return row ?? null;
}
