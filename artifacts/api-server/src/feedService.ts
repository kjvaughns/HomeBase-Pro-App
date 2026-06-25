import { db } from "./db";
import { eq, and, gte, count, sql, sum } from "drizzle-orm";
import {
  providers,
  jobs,
  intakeSubmissions,
  providerFeedState,
  providerServices,
  serviceCategories,
} from "@workspace/db";
import { logger } from "./lib/logger";

export type FeedCardType =
  | "nearby_demand"
  | "profile_insight"
  | "milestone_approaching"
  | "optimization_tip"
  | "recent_activity";

export interface FeedCard {
  id: string;
  type: FeedCardType;
  headline: string;
  body: string;
  ctaLabel?: string;
  ctaScreen?: string;
}

const ALL_TYPES: FeedCardType[] = [
  "nearby_demand",
  "profile_insight",
  "milestone_approaching",
  "optimization_tip",
  "recent_activity",
];

const OPTIMIZATION_TIPS = [
  "Providers who respond to leads within 1 hour book 3x more jobs.",
  "Adding before & after photos to completed jobs increases repeat bookings.",
  "Providers with 5+ reviews earn 40% more per month on average.",
  "Send a follow-up message 24 hours after a job to invite a review.",
  "Updating your availability weekly keeps you ranked higher in search results.",
  "Offering a small discount on bundled services increases average job value.",
  "Responding to every review — good or bad — builds trust with new clients.",
  "Providers who set a monthly goal hit 28% higher revenue than those who don't.",
  "A professional profile photo increases booking conversions by up to 30%.",
  "Consider peak-season pricing adjustments to maximize your busiest months.",
];

const REVENUE_MILESTONES_DOLLARS = [1000, 5000, 10000, 25000, 50000, 100000];

function pickTipIndex(providerId: string, lastShown: string[]): number {
  const dayOfYear = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const hash =
    providerId
      .split("")
      .reduce((acc, c) => acc + c.charCodeAt(0), 0) + dayOfYear;
  return hash % OPTIMIZATION_TIPS.length;
}

function selectNextTypes(lastShown: string[], count: number): FeedCardType[] {
  const selected: FeedCardType[] = [];
  const available = [...ALL_TYPES];

  for (let i = 0; i < count; i++) {
    const lastType = i === 0 ? lastShown[lastShown.length - 1] : selected[i - 1];
    const candidates = available.filter((t) => t !== lastType);
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    selected.push(pick);
    available.splice(available.indexOf(pick), 1);
  }

  return selected;
}

async function buildNearbyDemandCard(
  providerId: string,
  cardId: string,
): Promise<FeedCard | null> {
  try {
    const [providerRow] = await db
      .select({
        serviceArea: providers.serviceArea,
        serviceZipCodes: providers.serviceZipCodes,
      })
      .from(providers)
      .where(eq(providers.id, providerId))
      .limit(1);

    const [primaryService] = await db
      .select({
        categoryId: providerServices.categoryId,
        categoryName: serviceCategories.name,
      })
      .from(providerServices)
      .innerJoin(serviceCategories, eq(providerServices.categoryId, serviceCategories.id))
      .where(eq(providerServices.providerId, providerId))
      .limit(1);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Build a filter that requires the submission to match the provider's
    // primary service category. If the provider has configured service ZIP
    // codes we also require the submission address to mention at least one
    // of those ZIPs — this is a lightweight text-search heuristic because
    // intake_submissions stores address as free-form text.
    const filters: ReturnType<typeof and>[] = [
      gte(intakeSubmissions.createdAt, sevenDaysAgo) as any,
    ];

    if (primaryService?.categoryId) {
      filters.push(eq(intakeSubmissions.categoryId, primaryService.categoryId) as any);
    }

    const serviceZips = providerRow?.serviceZipCodes ?? [];
    if (serviceZips.length > 0) {
      // Match any submission whose address contains one of the provider's ZIPs.
      // We build an OR across up to 5 ZIPs to keep the query manageable.
      const zipFilters = serviceZips
        .slice(0, 5)
        .map((z) => sql`${intakeSubmissions.address} ILIKE ${"%" + z + "%"}`);
      if (zipFilters.length === 1) {
        filters.push(zipFilters[0] as any);
      } else {
        filters.push(sql`(${zipFilters.reduce((acc, f) => sql`${acc} OR ${f}`)})` as any);
      }
    }

    const [result] = await db
      .select({ cnt: count() })
      .from(intakeSubmissions)
      .where(and(...(filters as [any, ...any[]])));

    const totalRequests = result?.cnt ?? 0;

    // Suppress the card entirely when there is genuinely no nearby demand —
    // showing "1 homeowner" when the real count is zero would be misleading.
    if (totalRequests === 0) return null;

    const locationHint =
      serviceZips[0] ??
      providerRow?.serviceArea ??
      "your area";
    const categoryName = primaryService?.categoryName ?? "your service";

    // Cap display at 12 so the copy stays credible (e.g. "12+" not "347").
    const displayCount = Math.min(totalRequests, 12);
    const countLabel = totalRequests > 12 ? "12+" : String(displayCount);

    return {
      id: cardId,
      type: "nearby_demand",
      headline: `${countLabel} homeowner${displayCount !== 1 ? "s" : ""} looking for ${categoryName}`,
      body: `Homeowners in ${locationHint} have requested ${categoryName.toLowerCase()} services in the last 7 days. Make sure your profile is up to date.`,
      ctaLabel: "Update Profile",
      ctaScreen: "BusinessHub",
    };
  } catch (err) {
    logger.warn({ err, providerId }, "[feedService] buildNearbyDemandCard error");
    return null;
  }
}

async function buildProfileInsightCard(
  providerId: string,
  cardId: string,
): Promise<FeedCard | null> {
  try {
    const [providerRow] = await db
      .select({
        reviewCount: providers.reviewCount,
        avatarUrl: providers.avatarUrl,
        description: providers.description,
      })
      .from(providers)
      .where(eq(providers.id, providerId))
      .limit(1);

    const hasPhoto = !!providerRow?.avatarUrl;
    const hasBio = !!(providerRow?.description?.trim());
    const reviewCount = providerRow?.reviewCount ?? 0;

    let headline: string;
    let body: string;
    let ctaLabel: string | undefined;
    let ctaScreen: string | undefined;

    // Priority order: missing photo > missing bio > low reviews > healthy.
    // All content is derived from real DB fields — no synthetic metrics.
    if (!hasPhoto) {
      headline = "Your profile is missing a photo";
      body = "Add a profile photo to help homeowners trust you at first glance — providers with photos get 30% more bookings.";
      ctaLabel = "Add Photo";
      ctaScreen = "BusinessHub";
    } else if (!hasBio) {
      headline = "Your profile has no bio yet";
      body = "A short bio lets clients know who you are. AI can draft one in seconds — try it now.";
      ctaLabel = "Add Bio";
      ctaScreen = "BusinessHub";
    } else if (reviewCount < 5) {
      headline = `You have ${reviewCount} review${reviewCount !== 1 ? "s" : ""}`;
      body = "Ask your next client for a review to build social proof — clients read reviews before booking.";
      ctaLabel = "View Reviews";
      ctaScreen = "Reviews";
    } else {
      headline = `${reviewCount} reviews and counting`;
      body = "Providers with strong review counts convert significantly more profile visits into bookings. Keep it up!";
    }

    return {
      id: cardId,
      type: "profile_insight",
      headline,
      body,
      ctaLabel,
      ctaScreen,
    };
  } catch (err) {
    logger.warn({ err, providerId }, "[feedService] buildProfileInsightCard error");
    return null;
  }
}

async function buildMilestoneApproachingCard(
  providerId: string,
  cardId: string,
): Promise<FeedCard | null> {
  try {
    const [revenueRow] = await db
      .select({ total: sum(jobs.finalPrice) })
      .from(jobs)
      .where(and(eq(jobs.providerId, providerId), eq(jobs.status, "completed")));

    const revenueDollars = parseFloat(revenueRow?.total ?? "0") || 0;
    const nextMilestone = REVENUE_MILESTONES_DOLLARS.find((m) => m > revenueDollars);

    if (!nextMilestone) {
      return {
        id: cardId,
        type: "milestone_approaching",
        headline: "You've hit all revenue milestones! 🏆",
        body: "Outstanding achievement. Keep building — the HomeBase community celebrates your success.",
      };
    }

    const remaining = nextMilestone - revenueDollars;
    const pct = Math.round((revenueDollars / nextMilestone) * 100);

    return {
      id: cardId,
      type: "milestone_approaching",
      headline: `$${remaining.toLocaleString()} away from your next milestone`,
      body: `You're at ${pct}% of the $${nextMilestone.toLocaleString()} milestone. Completing a few more jobs this week could get you there.`,
      ctaLabel: "View Financials",
      ctaScreen: "FinancialsTab",
    };
  } catch (err) {
    logger.warn({ err, providerId }, "[feedService] buildMilestoneApproachingCard error");
    return null;
  }
}

async function buildOptimizationTipCard(
  lastShown: string[],
  providerId: string,
  cardId: string,
): Promise<FeedCard | null> {
  const tipIndex = pickTipIndex(providerId, lastShown);
  const tip = OPTIMIZATION_TIPS[tipIndex];

  return {
    id: cardId,
    type: "optimization_tip",
    headline: "Business tip of the day",
    body: tip,
  };
}

async function buildRecentActivityCard(
  providerId: string,
  cardId: string,
): Promise<FeedCard | null> {
  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [thisWeekResult, thisMonthResult] = await Promise.all([
      db
        .select({ cnt: count() })
        .from(jobs)
        .where(
          and(
            eq(jobs.providerId, providerId),
            eq(jobs.status, "completed"),
            gte(jobs.updatedAt as any, startOfWeek),
          ),
        ),
      db
        .select({ cnt: count() })
        .from(jobs)
        .where(
          and(
            eq(jobs.providerId, providerId),
            eq(jobs.status, "completed"),
            gte(jobs.updatedAt as any, startOfMonth),
          ),
        ),
    ]);

    const thisWeek = thisWeekResult[0]?.cnt ?? 0;
    const thisMonth = thisMonthResult[0]?.cnt ?? 0;

    if (thisWeek === 0 && thisMonth === 0) {
      return {
        id: cardId,
        type: "recent_activity",
        headline: "Your week is just getting started",
        body: "Complete your first job this week to start building your activity streak.",
        ctaLabel: "View Schedule",
        ctaScreen: "ScheduleTab",
      };
    }

    if (thisWeek === 0) {
      return {
        id: cardId,
        type: "recent_activity",
        headline: `${thisMonth} job${thisMonth !== 1 ? "s" : ""} completed this month`,
        body: "You have no jobs completed yet this week. You've got time to make it your best week.",
        ctaLabel: "View Schedule",
        ctaScreen: "ScheduleTab",
      };
    }

    const isWeekBest = thisWeek >= Math.ceil(thisMonth / 4);

    return {
      id: cardId,
      type: "recent_activity",
      headline: `You completed ${thisWeek} job${thisWeek !== 1 ? "s" : ""} this week`,
      body: isWeekBest
        ? "That's your best week this month — great momentum! Keep the streak going."
        : `You've done ${thisMonth} job${thisMonth !== 1 ? "s" : ""} this month total. Strong pace — keep it going.`,
      ctaLabel: "View Jobs",
      ctaScreen: "ScheduleTab",
    };
  } catch (err) {
    logger.warn({ err, providerId }, "[feedService] buildRecentActivityCard error");
    return null;
  }
}

const ALL_CARD_TYPES: FeedCardType[] = [
  "profile_insight",
  "optimization_tip",
  "recent_activity",
  "nearby_demand",
  "milestone_approaching",
];

// Build a single card by type. Card IDs are stable per (type, provider) —
// the 24-hour suppression window is enforced entirely by the `dismissedAt`
// timestamp stored in dismissed_cards JSONB, so the ID does not need a time
// component. This means a card dismissed at 11:58 pm stays hidden past
// midnight until the wall-clock 24 h window expires.
async function buildCard(
  type: FeedCardType,
  providerId: string,
  lastShown: string[],
): Promise<FeedCard | null> {
  const cardId = `${type}-${providerId.slice(0, 8)}`;
  switch (type) {
    case "nearby_demand":
      return buildNearbyDemandCard(providerId, cardId);
    case "profile_insight":
      return buildProfileInsightCard(providerId, cardId);
    case "milestone_approaching":
      return buildMilestoneApproachingCard(providerId, cardId);
    case "optimization_tip":
      return buildOptimizationTipCard(lastShown, providerId, cardId);
    case "recent_activity":
      return buildRecentActivityCard(providerId, cardId);
    default:
      return null;
  }
}

export async function getProviderFeed(providerId: string): Promise<FeedCard[]> {
  const [stateRow] = await db
    .select()
    .from(providerFeedState)
    .where(eq(providerFeedState.providerId, providerId))
    .limit(1);

  const lastShown: string[] = stateRow?.lastShownTypes ?? [];
  const dismissed: Array<{ cardId: string; dismissedAt: string }> =
    stateRow?.dismissedCards ?? [];

  // 24 h suppression window keyed on dismissedAt timestamp, NOT on a date-
  // bucketed card ID. This ensures a card dismissed late at night stays hidden
  // until the true 24 h wall-clock period ends regardless of calendar day.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const activeDismissals = new Set(
    dismissed
      .filter((d) => new Date(d.dismissedAt) > cutoff)
      .map((d) => d.cardId),
  );

  const targetCount = 1 + Math.floor(Math.random() * 3); // 1–3

  // Build cards in rotation order, skipping dismissed ones, then backfill
  // with remaining types until we have at least 1 (up to targetCount).
  const primary = selectNextTypes(lastShown, targetCount);
  const fallback = ALL_CARD_TYPES.filter((t) => !primary.includes(t));
  const orderedTypes = [...primary, ...fallback];

  const cards: FeedCard[] = [];
  const usedTypes: FeedCardType[] = [];

  for (const type of orderedTypes) {
    if (cards.length >= targetCount) break;

    const cardId = `${type}-${providerId.slice(0, 8)}`;
    if (activeDismissals.has(cardId)) continue;

    const card = await buildCard(type, providerId, lastShown);
    if (card) {
      cards.push(card);
      usedTypes.push(type);
    }
  }

  // Persist rotation state — record which types were shown this session so
  // the next fetch can avoid immediate repeats. Clean up expired dismissals.
  const newLastShown = [...lastShown, ...usedTypes].slice(-3);
  const cleanedDismissals = dismissed.filter(
    (d) => new Date(d.dismissedAt) > cutoff,
  );

  await db
    .insert(providerFeedState)
    .values({
      providerId,
      lastShownTypes: newLastShown,
      dismissedCards: cleanedDismissals,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: providerFeedState.providerId,
      set: {
        lastShownTypes: newLastShown,
        dismissedCards: cleanedDismissals,
        updatedAt: new Date(),
      },
    });

  return cards;
}

export async function dismissFeedCard(
  providerId: string,
  cardId: string,
): Promise<void> {
  const [stateRow] = await db
    .select()
    .from(providerFeedState)
    .where(eq(providerFeedState.providerId, providerId))
    .limit(1);

  const existing: Array<{ cardId: string; dismissedAt: string }> =
    stateRow?.dismissedCards ?? [];

  const alreadyDismissed = existing.some((d) => d.cardId === cardId);
  if (alreadyDismissed) return;

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const fresh = existing.filter((d) => new Date(d.dismissedAt) > cutoff);
  fresh.push({ cardId, dismissedAt: new Date().toISOString() });

  await db
    .insert(providerFeedState)
    .values({
      providerId,
      lastShownTypes: stateRow?.lastShownTypes ?? [],
      dismissedCards: fresh,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: providerFeedState.providerId,
      set: {
        dismissedCards: fresh,
        updatedAt: new Date(),
      },
    });
}
