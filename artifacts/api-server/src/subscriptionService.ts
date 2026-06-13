import type { Response } from "express";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { providerPlans, providerReferrals, providers, users } from "@workspace/db";
import type { ProviderPlan } from "@workspace/db";
import {
  dispatch,
  dispatchNotification,
  hasDeliveryForRecord,
} from "./notificationService";

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
  subscriptionSource: string | null;
  currentPeriodEnd: string | null;
}

type PlanLike =
  | Partial<
      Pick<
        ProviderPlan,
        | "isSubscribed"
        | "firstPaidBookingAt"
        | "gracePeriodEndsAt"
        | "subscriptionSource"
        | "currentPeriodEnd"
        | "isPartner"
        | "partnerSince"
      >
    >
  | null
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
  const subscriptionSource = plan?.subscriptionSource ?? null;
  const currentPeriodEnd = plan?.currentPeriodEnd
    ? new Date(plan.currentPeriodEnd).toISOString()
    : null;

  // HomeBase Partner: admin-granted complimentary Pro access. Resolves to
  // "subscribed" so all gating bypasses, but reports source="partner" so the
  // client can show partner-specific copy and badges instead of billing UI.
  // Transaction fees are unaffected (handled by stripeConnectService).
  if (plan?.isPartner) {
    return {
      status: "subscribed",
      daysRemainingInGrace: null,
      firstPaidBookingAt: firstPaidAt ? firstPaidAt.toISOString() : null,
      gracePeriodEndsAt: graceEndsAt ? graceEndsAt.toISOString() : null,
      isSubscribed: true,
      subscriptionSource: "partner",
      currentPeriodEnd: null,
    };
  }

  if (isSubscribed) {
    return {
      status: "subscribed",
      daysRemainingInGrace: null,
      firstPaidBookingAt: firstPaidAt ? firstPaidAt.toISOString() : null,
      gracePeriodEndsAt: graceEndsAt ? graceEndsAt.toISOString() : null,
      isSubscribed: true,
      subscriptionSource,
      currentPeriodEnd,
    };
  }

  if (!firstPaidAt || !graceEndsAt) {
    return {
      status: "free",
      daysRemainingInGrace: null,
      firstPaidBookingAt: null,
      gracePeriodEndsAt: null,
      isSubscribed: false,
      subscriptionSource,
      currentPeriodEnd,
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
      subscriptionSource,
      currentPeriodEnd,
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
    subscriptionSource,
    currentPeriodEnd,
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
        "Your HomeBase subscription is required to continue. Open the Subscription screen to subscribe and unlock job and invoice creation.",
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
    const graceEnd = new Date(
      now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    );

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

export async function sendGraceStartNotification(
  providerId: string,
): Promise<void> {
  const ctx = await getProviderUser(providerId);
  if (!ctx) return;
  const { provider, user } = ctx;
  const dedupKey = `${providerId}:grace_start`;
  const already = await hasDeliveryForRecord(
    "subscription.grace_start",
    dedupKey,
    "push",
  );
  if (already) return;

  const title = "Congrats on your first paid booking!";
  const body = `Your 7-day HomeBase trial just started. Open the Subscription screen any time to subscribe and keep growing after the trial ends.`;

  await dispatchNotification(
    user.id,
    title,
    body,
    "subscription.grace_start",
    {
      providerId,
      daysRemaining: GRACE_PERIOD_DAYS,
    },
    "reminders",
  );

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

export async function sendGraceReminderNotification(
  providerId: string,
  daysRemaining: number,
): Promise<void> {
  const ctx = await getProviderUser(providerId);
  if (!ctx) return;
  const { provider, user } = ctx;
  const dedupKey = `${providerId}:grace_reminder`;
  const already = await hasDeliveryForRecord(
    "subscription.grace_reminder",
    dedupKey,
    "push",
  );
  if (already) return;

  const title = `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left in your trial`;
  const body = `Open the Subscription screen and subscribe before your HomeBase trial ends to keep creating jobs and invoices.`;

  await dispatchNotification(
    user.id,
    title,
    body,
    "subscription.grace_reminder",
    {
      providerId,
      daysRemaining,
    },
    "reminders",
  );

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

/**
 * Task #352 — Extend a provider's active subscription window by N days as a
 * referral reward. Covers all subscription states:
 *   - Partner → no-op (already unlimited)
 *   - Subscribed via Stripe/RevenueCat → extend currentPeriodEnd
 *   - In grace period → extend gracePeriodEndsAt
 *   - Free (no trial) → bootstrap a grace period starting now
 *
 * Also increments referralBonusDays for audit/display purposes.
 */
export async function extendSubscriptionByDays(
  providerId: string,
  days: number,
): Promise<void> {
  const [plan] = await db
    .select()
    .from(providerPlans)
    .where(eq(providerPlans.providerId, providerId));

  if (plan?.isPartner) return;

  const now = new Date();
  const msExtension = days * 24 * 60 * 60 * 1000;

  if (!plan) {
    // No plan row yet → create one with a fresh grace window
    const graceEnd = new Date(now.getTime() + msExtension);
    await db.insert(providerPlans).values({
      providerId,
      firstPaidBookingAt: now,
      gracePeriodEndsAt: graceEnd,
      referralBonusDays: days,
    });
    return;
  }

  if (plan.isSubscribed && plan.currentPeriodEnd) {
    // Extend the billing period locally
    const current = new Date(plan.currentPeriodEnd);
    const extended = new Date(current.getTime() + msExtension);
    await db
      .update(providerPlans)
      .set({
        currentPeriodEnd: extended,
        referralBonusDays: (plan.referralBonusDays ?? 0) + days,
        updatedAt: now,
      })
      .where(eq(providerPlans.id, plan.id));
    return;
  }

  if (plan.gracePeriodEndsAt) {
    // Extend existing grace window (even if already expired → gives a new lease)
    const current = new Date(plan.gracePeriodEndsAt);
    const baseline = current > now ? current : now;
    const extended = new Date(baseline.getTime() + msExtension);
    const updates: Partial<typeof providerPlans.$inferInsert> = {
      gracePeriodEndsAt: extended,
      referralBonusDays: (plan.referralBonusDays ?? 0) + days,
      updatedAt: now,
    };
    if (!plan.firstPaidBookingAt) {
      updates.firstPaidBookingAt = now;
    }
    await db
      .update(providerPlans)
      .set(updates)
      .where(eq(providerPlans.id, plan.id));
    return;
  }

  // Free provider with no grace period → bootstrap one
  const graceEnd = new Date(now.getTime() + msExtension);
  await db
    .update(providerPlans)
    .set({
      firstPaidBookingAt: now,
      gracePeriodEndsAt: graceEnd,
      referralBonusDays: (plan.referralBonusDays ?? 0) + days,
      updatedAt: now,
    })
    .where(eq(providerPlans.id, plan.id));
}

/**
 * Task #352 — Send the referral reward notification to a provider.
 * Deduped per referral row so multiple concurrent job completions can't
 * double-dispatch the same reward message.
 */
export async function sendReferralRewardNotification(
  providerId: string,
  referralId: string,
): Promise<void> {
  const ctx = await getProviderUser(providerId);
  if (!ctx) return;
  const { user } = ctx;
  const dedupKey = `referral_reward:${referralId}`;
  const already = await hasDeliveryForRecord(
    "referral.reward_earned",
    dedupKey,
    "push",
  );
  if (already) return;

  const title = "You've earned 1 free month! 🎉";
  const body =
    "A provider you referred just completed their first job. Enjoy 30 days free on your HomeBase subscription.";

  await dispatchNotification(
    user.id,
    title,
    body,
    "referral.reward_earned",
    { providerId, referralId },
    "reminders",
  );
}

export async function sendGraceExpiredNotification(
  providerId: string,
): Promise<void> {
  const ctx = await getProviderUser(providerId);
  if (!ctx) return;
  const { provider, user } = ctx;
  const dedupKey = `${providerId}:grace_expired`;
  const already = await hasDeliveryForRecord(
    "subscription.expired",
    dedupKey,
    "push",
  );
  if (already) return;

  const title = "Your HomeBase trial has ended";
  const body = `Open the Subscription screen in the HomeBase app to subscribe and continue creating jobs and sending invoices.`;

  await dispatchNotification(
    user.id,
    title,
    body,
    "subscription.expired",
    {
      providerId,
    },
    "reminders",
  );

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
