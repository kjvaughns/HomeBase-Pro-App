import type { Response } from "express";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { providerPlans, providers, users } from "@shared/schema";
import type { ProviderPlan } from "@shared/schema";
import { dispatch, dispatchNotification, hasDeliveryForRecord } from "./notificationService";

export const GRACE_PERIOD_DAYS = 7;

export type SubscriptionStatus =
  | "free"
  | "grace_period"
  | "expired"
  | "subscribed";

export interface SubscriptionStatusInfo {
  status: SubscriptionStatus;
  daysRemainingInGrace: number | null;
  firstPaidBookingAt: string | null;
  gracePeriodEndsAt: string | null;
  isSubscribed: boolean;
}

type PlanLike = Partial<
  Pick<
    ProviderPlan,
    "isSubscribed" | "firstPaidBookingAt" | "gracePeriodEndsAt"
  >
> | null
  | undefined;

export function computeSubscriptionStatus(
  plan: PlanLike,
  now: Date = new Date(),
): SubscriptionStatusInfo {
  const isSubscribed = !!plan?.isSubscribed;
  const firstPaidAt = plan?.firstPaidBookingAt
    ? new Date(plan.firstPaidBookingAt)
    : null;
  const graceEndsAt = plan?.gracePeriodEndsAt
    ? new Date(plan.gracePeriodEndsAt)
    : null;

  if (isSubscribed) {
    return {
      status: "subscribed",
      daysRemainingInGrace: null,
      firstPaidBookingAt: firstPaidAt ? firstPaidAt.toISOString() : null,
      gracePeriodEndsAt: graceEndsAt ? graceEndsAt.toISOString() : null,
      isSubscribed: true,
    };
  }

  if (!firstPaidAt || !graceEndsAt) {
    return {
      status: "free",
      daysRemainingInGrace: null,
      firstPaidBookingAt: null,
      gracePeriodEndsAt: null,
      isSubscribed: false,
    };
  }

  const msRemaining = graceEndsAt.getTime() - now.getTime();
  if (msRemaining <= 0) {
    return {
      status: "expired",
      daysRemainingInGrace: 0,
      firstPaidBookingAt: firstPaidAt.toISOString(),
      gracePeriodEndsAt: graceEndsAt.toISOString(),
      isSubscribed: false,
    };
  }

  const daysRemaining = Math.max(
    0,
    Math.ceil(msRemaining / (1000 * 60 * 60 * 24)),
  );
  return {
    status: "grace_period",
    daysRemainingInGrace: daysRemaining,
    firstPaidBookingAt: firstPaidAt.toISOString(),
    gracePeriodEndsAt: graceEndsAt.toISOString(),
    isSubscribed: false,
  };
}

export async function getProviderSubscriptionStatus(
  providerId: string,
): Promise<SubscriptionStatusInfo> {
  const [plan] = await db
    .select()
    .from(providerPlans)
    .where(eq(providerPlans.providerId, providerId));
  return computeSubscriptionStatus(plan ?? null);
}

/**
 * Returns true if the provider may proceed (free, grace, or subscribed).
 * If gated (expired), writes a 403 response and returns false.
 */
export async function checkSubscriptionGate(
  providerId: string,
  res: Response,
): Promise<boolean> {
  const info = await getProviderSubscriptionStatus(providerId);
  if (info.status === "expired") {
    res.status(403).json({
      error:
        "Your HomeBase subscription is required to continue. Subscribe at homebaseproapp.com to unlock job and invoice creation.",
      code: "SUBSCRIPTION_REQUIRED",
      subscriptionStatus: info,
    });
    return false;
  }
  return true;
}

/**
 * Called when a provider's first invoice is marked paid.
 * Sets firstPaidBookingAt + a 7-day gracePeriodEndsAt, then dispatches the
 * "you've started your trial" notification. Idempotent.
 */
export async function maybeStartGracePeriod(providerId: string): Promise<void> {
  try {
    const [existing] = await db
      .select()
      .from(providerPlans)
      .where(eq(providerPlans.providerId, providerId));

    // Already started or already subscribed — nothing to do.
    if (existing?.firstPaidBookingAt || existing?.isSubscribed) return;

    const now = new Date();
    const graceEnd = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    if (existing) {
      await db
        .update(providerPlans)
        .set({
          firstPaidBookingAt: now,
          gracePeriodEndsAt: graceEnd,
          updatedAt: now,
        })
        .where(eq(providerPlans.id, existing.id));
    } else {
      await db.insert(providerPlans).values({
        providerId,
        firstPaidBookingAt: now,
        gracePeriodEndsAt: graceEnd,
      });
    }

    // Notify the provider — push + email.
    await sendGraceStartNotification(providerId);
  } catch (err) {
    console.error("[subscription] maybeStartGracePeriod error:", err);
  }
}

async function getProviderUser(providerId: string) {
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, providerId));
  if (!provider?.userId) return null;
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, provider.userId));
  if (!user) return null;
  return { provider, user };
}

export async function sendGraceStartNotification(providerId: string): Promise<void> {
  const ctx = await getProviderUser(providerId);
  if (!ctx) return;
  const { provider, user } = ctx;
  const dedupKey = `${providerId}:grace_start`;
  const already = await hasDeliveryForRecord("subscription.grace_start", dedupKey, "push");
  if (already) return;

  const title = "Congrats on your first paid booking!";
  const body = `Your 7-day HomeBase trial just started. After ${GRACE_PERIOD_DAYS} days, subscribe at homebaseproapp.com to keep growing.`;

  await dispatchNotification(user.id, title, body, "subscription.grace_start", {
    providerId,
    daysRemaining: GRACE_PERIOD_DAYS,
  }, "reminders");

  if (user.email) {
    await dispatch("subscription.grace_start", {
      recipientUserId: user.id,
      recipientEmail: user.email,
      providerName: provider.businessName,
      relatedRecordType: "subscription",
      relatedRecordId: dedupKey,
    });
  }
}

export async function sendGraceReminderNotification(providerId: string, daysRemaining: number): Promise<void> {
  const ctx = await getProviderUser(providerId);
  if (!ctx) return;
  const { provider, user } = ctx;
  const dedupKey = `${providerId}:grace_reminder`;
  const already = await hasDeliveryForRecord("subscription.grace_reminder", dedupKey, "push");
  if (already) return;

  const title = `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left in your trial`;
  const body = `Subscribe at homebaseproapp.com before your HomeBase trial ends to keep creating jobs and invoices.`;

  await dispatchNotification(user.id, title, body, "subscription.grace_reminder", {
    providerId,
    daysRemaining,
  }, "reminders");

  if (user.email) {
    await dispatch("subscription.grace_reminder", {
      recipientUserId: user.id,
      recipientEmail: user.email,
      providerName: provider.businessName,
      daysUntilDue: daysRemaining,
      relatedRecordType: "subscription",
      relatedRecordId: dedupKey,
    });
  }
}

export async function sendGraceExpiredNotification(providerId: string): Promise<void> {
  const ctx = await getProviderUser(providerId);
  if (!ctx) return;
  const { provider, user } = ctx;
  const dedupKey = `${providerId}:grace_expired`;
  const already = await hasDeliveryForRecord("subscription.expired", dedupKey, "push");
  if (already) return;

  const title = "Your HomeBase trial has ended";
  const body = `Subscribe at homebaseproapp.com to continue creating jobs and sending invoices.`;

  await dispatchNotification(user.id, title, body, "subscription.expired", {
    providerId,
  }, "reminders");

  if (user.email) {
    await dispatch("subscription.expired", {
      recipientUserId: user.id,
      recipientEmail: user.email,
      providerName: provider.businessName,
      relatedRecordType: "subscription",
      relatedRecordId: dedupKey,
    });
  }
}
