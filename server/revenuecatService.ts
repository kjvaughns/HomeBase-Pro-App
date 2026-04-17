import type { Request, Response } from "express";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { providerPlans, providers } from "@shared/schema";
import { dispatchNotification } from "./notificationService";

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
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number;
  store?: string;
  entitlement_ids?: string[];
  entitlement_id?: string;
}

function sourceForStore(store?: string): string {
  switch ((store || "").toUpperCase()) {
    case "APP_STORE":
    case "MAC_APP_STORE":
      return "revenuecat_ios";
    case "PLAY_STORE":
      return "revenuecat_android";
    default:
      return "revenuecat";
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
    if (provided !== sharedSecret) {
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

  const source = sourceForStore(event.store);
  const expiresAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms)
    : null;

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
      // CANCELLATION fires when the user turns off auto-renew but they may
      // still be entitled until expiration_at_ms. Only flip isSubscribed off
      // for true loss-of-entitlement events.
      const stillEntitled =
        eventType === "CANCELLATION" &&
        expiresAt !== null &&
        expiresAt.getTime() > Date.now();

      await upsertPlan(providerId, {
        isSubscribed: stillEntitled ? true : false,
        subscriptionStatus: stillEntitled
          ? "cancel_at_period_end"
          : eventType.toLowerCase(),
        subscriptionEndedAt: stillEntitled ? null : new Date(),
        currentPeriodEnd: expiresAt,
      });
    } else {
      // Other event types (TEST, NON_RENEWING_PURCHASE, etc.) — log and ack.
      console.log(`[revenuecat] received ${eventType} (no-op)`);
    }

    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[revenuecat] webhook handler error:", err);
    res.status(500).json({ error: err?.message || "webhook handler failed" });
  }
}
