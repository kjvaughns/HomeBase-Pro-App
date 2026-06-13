import { db } from './db';
import { eq, and, sql, count, sum } from 'drizzle-orm';
import {
  providers,
  providerBadges,
  providerMilestoneGrants,
  providerPlans,
  providerReferrals,
  jobs,
  reviews,
  type BadgeType,
} from '@workspace/db';
import { dispatchNotification } from './notificationService';
import { extendSubscriptionByDays } from './subscriptionService';
import { applyPermanentDiscountToExistingSubscription } from './stripeConnectService';

const BADGE_LABELS: Record<BadgeType, string> = {
  verified_pro: 'Verified Pro',
  top_provider: 'Top Provider',
};

async function awardBadge(
  providerId: string,
  providerUserId: string,
  badgeType: BadgeType,
): Promise<void> {
  const label = BADGE_LABELS[badgeType];
  await db
    .insert(providerBadges)
    .values({ providerId, badgeType })
    .onConflictDoNothing();

  await dispatchNotification(
    providerUserId,
    `You've earned the ${label} badge! 🏆`,
    `Your ${label} badge is now visible on your public profile. Keep up the great work!`,
    `milestone.badge.${badgeType}`,
    { badgeType },
    'updates' as any,
  );
}

async function getProviderUserId(providerId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: providers.userId })
    .from(providers)
    .where(eq(providers.id, providerId))
    .limit(1);
  return row?.userId ?? null;
}

async function getEarnedBadgeSet(providerId: string): Promise<Set<BadgeType>> {
  const rows = await db
    .select({ badgeType: providerBadges.badgeType })
    .from(providerBadges)
    .where(eq(providerBadges.providerId, providerId));
  return new Set(rows.map((r) => r.badgeType));
}

async function getCompletedJobCount(providerId: string): Promise<number> {
  const [row] = await db
    .select({ cnt: count() })
    .from(jobs)
    .where(and(eq(jobs.providerId, providerId), eq(jobs.status, 'completed')));
  return row?.cnt ?? 0;
}

async function getTotalRevenueDollars(providerId: string): Promise<number> {
  const [row] = await db
    .select({ total: sum(jobs.finalPrice) })
    .from(jobs)
    .where(and(eq(jobs.providerId, providerId), eq(jobs.status, 'completed')));
  const raw = row?.total;
  if (!raw) return 0;
  const v = parseFloat(String(raw));
  return isNaN(v) ? 0 : v;
}

async function hasFiveStarReview(providerId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.providerId, providerId), eq(reviews.rating, 5)))
    .limit(1);
  return !!row;
}

async function getRewardedReferralCount(providerId: string): Promise<number> {
  const [row] = await db
    .select({ cnt: count() })
    .from(providerReferrals)
    .where(
      and(
        eq(providerReferrals.referrerProviderId, providerId),
        sql`${providerReferrals.rewardGrantedAt} IS NOT NULL`,
      ),
    );
  return row?.cnt ?? 0;
}

async function getPlan(
  providerId: string,
): Promise<{ id: string; hasFeaturedPlacement: boolean; permanentDiscountPercent: number } | null> {
  const [row] = await db
    .select({
      id: providerPlans.id,
      hasFeaturedPlacement: providerPlans.hasFeaturedPlacement,
      permanentDiscountPercent: providerPlans.permanentDiscountPercent,
    })
    .from(providerPlans)
    .where(eq(providerPlans.providerId, providerId))
    .limit(1);
  return row ?? null;
}

/**
 * Atomically record a one-time milestone grant.
 * Returns true if the grant was newly inserted (reward should be issued),
 * false if the row already existed (reward already issued — skip).
 * The unique DB constraint on (provider_id, milestone_key) is the idempotency
 * guard; concurrent calls are safe.
 */
async function tryClaimMilestoneGrant(
  providerId: string,
  milestoneKey: string,
): Promise<boolean> {
  const rows = await db
    .insert(providerMilestoneGrants)
    .values({ providerId, milestoneKey })
    .onConflictDoNothing()
    .returning({ id: providerMilestoneGrants.id });
  return rows.length > 0;
}

/**
 * Evaluate all milestone conditions for a provider and grant any newly
 * unlocked rewards. Safe to call multiple times — already-granted badges
 * and plan flags are idempotent.
 *
 * Call fire-and-forget after: job completion, review creation, referral reward.
 */
export async function checkAndAwardMilestones(providerId: string): Promise<void> {
  try {
    const userId = await getProviderUserId(providerId);
    if (!userId) return;

    const [earnedBadges, jobCount, revenueDollars, fiveStar, referralCount, plan] =
      await Promise.all([
        getEarnedBadgeSet(providerId),
        getCompletedJobCount(providerId),
        getTotalRevenueDollars(providerId),
        hasFiveStarReview(providerId),
        getRewardedReferralCount(providerId),
        getPlan(providerId),
      ]);

    // ── Milestone: 10 completed jobs → Verified Pro badge ─────────────────
    if (jobCount >= 10 && !earnedBadges.has('verified_pro')) {
      await awardBadge(providerId, userId, 'verified_pro');
    }

    // ── Milestone: first 5-star review → featured placement boost ─────────
    if (fiveStar && plan && !plan.hasFeaturedPlacement) {
      await db
        .update(providerPlans)
        .set({ hasFeaturedPlacement: true, updatedAt: new Date() })
        .where(eq(providerPlans.id, plan.id));

      await dispatchNotification(
        userId,
        "You're now Featured! ⭐",
        'Your first 5-star review earned you featured placement in homeowner search results.',
        'milestone.featured_placement',
        {},
        'updates' as any,
      );
    }

    // ── Milestone: 25 completed jobs → 1 free month ────────────────────────
    // tryClaimMilestoneGrant is atomic: concurrent calls race on the unique DB
    // constraint — only one returns true and actually fulfills the reward.
    if (jobCount >= 25 && (await tryClaimMilestoneGrant(providerId, '25_jobs_free_month'))) {
      await extendSubscriptionByDays(providerId, 30);
      await dispatchNotification(
        userId,
        '1 Free Month Unlocked! 🎉',
        "You've completed 25 jobs — we've added a free month to your HomeBase Pro subscription!",
        'milestone.25_jobs_free_month',
        {},
        'updates' as any,
      );
    }

    // ── Milestone: 3 referred providers rewarded → permanent 10% discount ──
    if (referralCount >= 3 && plan && plan.permanentDiscountPercent < 10) {
      await db
        .update(providerPlans)
        .set({ permanentDiscountPercent: 10, updatedAt: new Date() })
        .where(eq(providerPlans.id, plan.id));

      // Apply the coupon to any existing Stripe subscription immediately so
      // the discount is reflected on the very next billing cycle (fire-and-
      // forget; non-fatal if provider has no Stripe subscription yet).
      applyPermanentDiscountToExistingSubscription(providerId).catch((e: unknown) =>
        console.error('[milestoneService] applyPermanentDiscount error:', String(e)),
      );

      await dispatchNotification(
        userId,
        'Permanent 10% Discount Unlocked! 💰',
        "You've referred 3 providers who completed their first jobs. You now get a permanent 10% discount on your subscription.",
        'milestone.referral_3x_discount',
        {},
        'updates' as any,
      );
    }

    // ── Milestone: $10K processed → Top Provider badge + priority listing ──
    if (revenueDollars >= 10000 && !earnedBadges.has('top_provider')) {
      await awardBadge(providerId, userId, 'top_provider');

      if (plan && !plan.hasFeaturedPlacement) {
        await db
          .update(providerPlans)
          .set({ hasFeaturedPlacement: true, updatedAt: new Date() })
          .where(eq(providerPlans.id, plan.id));
      }
    }
  } catch (err) {
    console.error('[milestoneService] checkAndAwardMilestones error:', {
      providerId,
      err: String(err),
    });
  }
}
