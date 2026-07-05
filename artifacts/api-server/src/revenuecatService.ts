import type { Request, Response } from "express";
import crypto from "node:crypto";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { providerPlans, providers, revenuecatWebhookEvents } from "@workspace/db";
import { dispatchNotification } from "./notificationService";

/**
 * Constant-time comparison for webhook secrets/signatures. A plain `!==`
 * leaks timing information proportional to the number of matching leading
 * characters, which an attacker can use to brute-force the secret one byte
 * at a time. crypto.timingSafeEqual requires equal-length buffers, so we
 * pad/hash first to avoid short-circuiting on a length mismatch.
 */
function constantTimeEquals(
  provided: string | null | undefined,
  expected: string,
): boolean {
  if (!provided) return false;
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) {
    // Still run a timingSafeEqual against a same-length dummy so the
    // comparison cost doesn't vary based on length either.
    crypto.timingSafeEqual(providedBuf, providedBuf);
    return false;
  }
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

const ENTITLEMENT_ID = "pro";

const ACTIVATING_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "TRANSFER",
]);

const DEACTIVATING_EVENTS = new Set([
  "CANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
  "SUBSCRIPTION_PAUSED",
]);

interface RevenueCatEvent {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number;
  event_timestamp_ms?: number;
  store?: string;
  entitlement_ids?: string[];
  entitlement_id?: string;
}

/**
 * Reserve a RevenueCat event id for idempotent processing, mirroring the
 * Stripe webhook dedup pattern in stripeWebhookRouter.ts. Returns "duplicate"
 * if this event id has already been fully processed, "retry" if a prior
 * attempt was reserved but never completed (handler threw), and "fresh" for
 * a brand-new delivery.
 */
async function reserveRevenueCatEvent(
  event: RevenueCatEvent,
): Promise<"fresh" | "retry" | "duplicate" | "unidentified"> {
  if (!event.id) return "unidentified";
  try {
    await db.insert(revenuecatWebhookEvents).values({
      revenuecatEventId: event.id,
      eventType: event.type ?? "unknown",
      payload: JSON.stringify(event),
      processedAt: null,
    });
    return "fresh";
  } catch (err: any) {
    if (!(err?.code === "23505" || /duplicate key/i.test(err?.message ?? ""))) {
      throw err;
    }
  }
  const [row] = await db
    .select({ processedAt: revenuecatWebhookEvents.processedAt })
    .from(revenuecatWebhookEvents)
    .where(eq(revenuecatWebhookEvents.revenuecatEventId, event.id));
  if (row && row.processedAt !== null) return "duplicate";
  return "retry";
}

async function markRevenueCatEventProcessed(eventId: string): Promise<void> {
  await db
    .update(revenuecatWebhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(revenuecatWebhookEvents.revenuecatEventId, eventId));
}

function sourceForStore(
  store?: string,
): "revenuecat_ios" | "revenuecat_android" | null {
  switch ((store || "").toUpperCase()) {
    case "APP_STORE":
    case "MAC_APP_STORE":
      return "revenuecat_ios";
    case "PLAY_STORE":
      return "revenuecat_android";
    default:
      return null;
  }
}

function eventEntitlements(event: RevenueCatEvent): string[] {
  if (event.entitlement_ids && event.entitlement_ids.length > 0)
    return event.entitlement_ids;
  if (event.entitlement_id) return [event.entitlement_id];
  return [];
}

async function resolveProviderId(
  event: RevenueCatEvent,
): Promise<string | null> {
  const candidate = event.app_user_id || event.original_app_user_id;
  if (!candidate) return null;
  // appUserID is the providerId itself (set by the client at logIn).
  const [match] = await db
    .select({ id: providers.id })
    .from(providers)
    .where(eq(providers.id, candidate))
    .limit(1);
  return match?.id ?? null;
}

async function upsertPlan(
  providerId: string,
  patch: Partial<typeof providerPlans.$inferInsert>,
): Promise<{ wasSubscribed: boolean; isSubscribed: boolean }> {
  const [existing] = await db
    .select()
    .from(providerPlans)
    .where(eq(providerPlans.providerId, providerId));

  const now = new Date();
  const wasSubscribed = !!existing?.isSubscribed;
  const isSubscribed = patch.isSubscribed ?? wasSubscribed;

  if (existing) {
    await db
      .update(providerPlans)
      .set({ ...patch, updatedAt: now })
      .where(eq(providerPlans.id, existing.id));
  } else {
    await db.insert(providerPlans).values({
      providerId,
      planTier: "professional",
      ...patch,
    });
  }

  return { wasSubscribed, isSubscribed };
}

async function notifyDeactivated(providerId: string) {
  try {
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, providerId));
    if (!provider?.userId) return;
    await dispatchNotification(
      provider.userId,
      "Subscription ended",
      "Your HomeBase Pro subscription has ended. Resubscribe anytime to restore Pro features.",
      "subscription.cancelled",
      { providerId },
      "reminders",
    );
  } catch (err) {
    console.error("[revenuecat] notifyDeactivated error:", err);
  }
}

async function notifyActivated(providerId: string) {
  try {
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, providerId));
    if (!provider?.userId) return;
    await dispatchNotification(
      provider.userId,
      "You're subscribed",
      "Welcome to HomeBase Pro — your subscription is active.",
      "subscription.activated",
      { providerId },
      "reminders",
    );
  } catch (err) {
    console.error("[revenuecat] notifyActivated error:", err);
  }
}

export async function handleRevenueCatWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  const sharedSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!sharedSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[revenuecat] REVENUECAT_WEBHOOK_SECRET is not set — rejecting webhook in production",
      );
      res.status(503).json({ error: "webhook secret not configured" });
      return;
    }
    console.warn(
      "[revenuecat] REVENUECAT_WEBHOOK_SECRET not set — accepting unsigned webhook (dev only)",
    );
  } else {
    const authHeader =
      req.headers.authorization || req.headers["authorization"];
    const provided =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : (authHeader as string | undefined);
    if (!constantTimeEquals(provided, sharedSecret)) {
      console.warn("[revenuecat] webhook unauthorized");
      res.status(401).json({ error: "unauthorized" });
      return;
    }
  }

  const event: RevenueCatEvent = req.body?.event ?? req.body ?? {};
  const eventType = (event.type || "").toUpperCase();

  if (!eventType) {
    res.status(400).json({ error: "missing event type" });
    return;
  }

  // Ignore unrelated entitlements; only act on our "pro" entitlement.
  const entitlements = eventEntitlements(event);
  if (entitlements.length > 0 && !entitlements.includes(ENTITLEMENT_ID)) {
    res.status(200).json({ ok: true, ignored: "unrelated entitlement" });
    return;
  }

  const providerId = await resolveProviderId(event);
  if (!providerId) {
    console.warn(
      "[revenuecat] webhook could not resolve providerId for app_user_id:",
      event.app_user_id,
    );
    // 200 so RevenueCat doesn't retry forever; we logged it.
    res.status(200).json({ ok: true, ignored: "unknown provider" });
    return;
  }

  // Idempotency: dedupe by RevenueCat's event id. If the event has no id
  // (shouldn't happen in practice) we fall through and process it — we can't
  // dedupe what we can't identify.
  const reservation = await reserveRevenueCatEvent(event);
  if (reservation === "duplicate") {
    console.log(`[revenuecat] duplicate event id=${event.id} type=${eventType} — skipped`);
    res.status(200).json({ ok: true, ignored: "duplicate" });
    return;
  }

  const source = sourceForStore(event.store);
  const expiresAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms)
    : null;

  // Out-of-order protection: RevenueCat doesn't guarantee delivery order, so
  // a late/delayed event with an older expiration than what we already have
  // stored must not clobber a newer, more-current period end (e.g. a delayed
  // BILLING_ISSUE arriving after a RENEWAL already extended the period).
  const [existingPlan] = await db
    .select({ currentPeriodEnd: providerPlans.currentPeriodEnd })
    .from(providerPlans)
    .where(eq(providerPlans.providerId, providerId));
  if (
    expiresAt !== null &&
    existingPlan?.currentPeriodEnd &&
    expiresAt.getTime() < new Date(existingPlan.currentPeriodEnd).getTime()
  ) {
    console.warn(
      `[revenuecat] ignoring stale event id=${event.id} type=${eventType} providerId=${providerId} — event expiresAt is older than stored currentPeriodEnd`,
    );
    if (event.id) await markRevenueCatEventProcessed(event.id);
    res.status(200).json({ ok: true, ignored: "stale event" });
    return;
  }

  try {
    if (ACTIVATING_EVENTS.has(eventType)) {
      const { wasSubscribed } = await upsertPlan(providerId, {
        isSubscribed: true,
        subscriptionSource: source,
        subscriptionStatus: "active",
        subscriptionStartedAt: new Date(),
        subscriptionEndedAt: null,
        revenuecatProductId: event.product_id ?? null,
        currentPeriodEnd: expiresAt,
      });
      if (!wasSubscribed) await notifyActivated(providerId);
    } else if (DEACTIVATING_EVENTS.has(eventType)) {
      // CANCELLATION fires when the user turns off auto-renew, and
      // BILLING_ISSUE/SUBSCRIPTION_PAUSED fire while a payment retries or a
      // Play Store subscription is paused — in all three cases the user may
      // still be entitled until expiration_at_ms. Only flip isSubscribed off
      // for true loss-of-entitlement events (EXPIRATION, or any of these
      // once expiresAt has actually passed).
      const GRACE_EVENTS = new Set([
        "CANCELLATION",
        "BILLING_ISSUE",
        "SUBSCRIPTION_PAUSED",
      ]);
      const stillEntitled =
        GRACE_EVENTS.has(eventType) &&
        expiresAt !== null &&
        expiresAt.getTime() > Date.now();

      const statusForEvent: Record<string, string> = {
        CANCELLATION: "cancel_at_period_end",
        BILLING_ISSUE: "past_due",
        SUBSCRIPTION_PAUSED: "paused",
      };

      const { wasSubscribed, isSubscribed } = await upsertPlan(providerId, {
        isSubscribed: stillEntitled ? true : false,
        subscriptionStatus: stillEntitled
          ? (statusForEvent[eventType] ?? "cancel_at_period_end")
          : eventType.toLowerCase(),
        subscriptionEndedAt: stillEntitled ? null : new Date(),
        currentPeriodEnd: expiresAt,
      });
      // Mirror activation behavior: only fire on a true flip subscribed→unsubscribed.
      if (wasSubscribed && !isSubscribed) await notifyDeactivated(providerId);
    } else {
      // Other event types (TEST, NON_RENEWING_PURCHASE, etc.) — log and ack.
      console.log(`[revenuecat] received ${eventType} (no-op)`);
    }

    if (event.id) await markRevenueCatEventProcessed(event.id);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    // Leave processed_at NULL (if reserved) so a RevenueCat retry can
    // re-attempt, mirroring the Stripe webhook dedup pattern.
    console.error("[revenuecat] webhook handler error:", err);
    res.status(500).json({ error: err?.message || "webhook handler failed" });
  }
}
