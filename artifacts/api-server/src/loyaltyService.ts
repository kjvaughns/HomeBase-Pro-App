import { db } from "./db";
import { eq, and, count } from "drizzle-orm";
import {
  userCredits,
  creditLedger,
  appointments,
  providerCustomServices,
} from "@workspace/db";
import { dispatchNotification } from "./notificationService";

const FIRST_BOOKING_CENTS = 500;  // $5
const REVIEW_CREDIT_CENTS = 300;  // $3
const CATEGORY_MILESTONE_CENTS = 1500; // $15
const CATEGORY_MILESTONE_COUNT = 5;

/**
 * Keyword-based fallback when an appointment has no linked providerCustomService.
 * Used only when canonical category data is unavailable.
 */
function detectServiceCategoryLocal(title: string): string {
  const t = (title || "").toLowerCase();
  if (t.includes("hvac") || t.includes("heat") || t.includes("air") || t.includes("furnace") || t.includes("ac ") || t.includes("cooling")) return "HVAC";
  if (t.includes("plumb") || t.includes("pipe") || t.includes("water") || t.includes("drain") || t.includes("toilet") || t.includes("faucet")) return "Plumbing";
  if (t.includes("electr") || t.includes("wiring") || t.includes("outlet") || t.includes("circuit")) return "Electrical";
  if (t.includes("roof") || t.includes("gutter") || t.includes("shingle")) return "Roof";
  if (t.includes("clean") || t.includes("maid") || t.includes("janitorial") || t.includes("housekeep")) return "Cleaning";
  if (t.includes("lawn") || t.includes("landscap") || t.includes("mow") || t.includes("garden") || t.includes("trim") || t.includes("sprinkler")) return "Lawn & Landscaping";
  if (t.includes("paint")) return "Painting";
  if (t.includes("carpet") || t.includes("flooring") || t.includes("hardwood") || t.includes("tile")) return "Flooring";
  if (t.includes("pest") || t.includes("bug") || t.includes("termite") || t.includes("rodent")) return "Pest Control";
  if (t.includes("window")) return "Windows";
  if (t.includes("handyman") || t.includes("repair") || t.includes("fix") || t.includes("install")) return "Handyman";
  if (t.includes("move") || t.includes("moving") || t.includes("haul") || t.includes("junk")) return "Moving & Hauling";
  if (t.includes("pool")) return "Pool";
  if (t.includes("security") || t.includes("alarm") || t.includes("camera")) return "Security";
  return "General";
}

async function addLoyaltyCredits(
  userId: string,
  amountCents: number,
  reason: string,
  idempotencyKey: string,
): Promise<boolean> {
  const inserted = await db
    .insert(creditLedger)
    .values({ userId, deltaCents: amountCents, reason, idempotencyKey })
    .onConflictDoNothing()
    .returning({ id: creditLedger.id });

  if (!inserted || inserted.length === 0) {
    return false;
  }

  const [existing] = await db
    .select()
    .from(userCredits)
    .where(eq(userCredits.userId, userId));

  if (existing) {
    await db
      .update(userCredits)
      .set({
        balanceCents: (existing.balanceCents || 0) + amountCents,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userId, userId));
  } else {
    await db.insert(userCredits).values({ userId, balanceCents: amountCents });
  }

  return true;
}

/**
 * Grant $5 credit for completing a first booking.
 * Only grants when this is genuinely the user's first completed appointment.
 * Idempotent — silently no-ops if already granted.
 */
export async function grantFirstBookingCredit(userId: string): Promise<void> {
  try {
    // Verify this is actually the first completed appointment for this user.
    // The appointment has already been marked completed before this is called,
    // so count == 1 means it was just the first one.
    const [{ completedCount }] = await db
      .select({ completedCount: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.userId, userId),
          eq(appointments.status, "completed"),
        ),
      );

    if (completedCount !== 1) return;

    const key = `loyalty_first_booking_${userId}`;
    const granted = await addLoyaltyCredits(userId, FIRST_BOOKING_CENTS, "loyalty_first_booking", key);

    if (!granted) return;

    await dispatchNotification(
      userId,
      "You earned $5 in HomeBase credits! 🎉",
      "Congrats on completing your first booking — you've earned $5 in HomeBase credits!",
      "loyalty_credit_earned",
      { type: "loyalty_credit_earned", screen: "CreditHistory", amountCents: FIRST_BOOKING_CENTS, reason: "first_booking" },
      "bookings",
    );
  } catch (err) {
    console.error("[loyaltyService] grantFirstBookingCredit error:", err);
  }
}

/**
 * Grant $3 credit for leaving a review.
 * Idempotent per appointment — only one credit per review.
 */
export async function grantReviewCredit(userId: string, appointmentId: string): Promise<void> {
  try {
    const key = `loyalty_review_${appointmentId}`;
    const granted = await addLoyaltyCredits(userId, REVIEW_CREDIT_CENTS, "loyalty_review_left", key);

    if (!granted) return;

    await dispatchNotification(
      userId,
      "You earned $3 in HomeBase credits!",
      "Thanks for leaving a review — you've earned $3 in HomeBase credits!",
      "loyalty_credit_earned",
      { type: "loyalty_credit_earned", screen: "CreditHistory", amountCents: REVIEW_CREDIT_CENTS, reason: "review_left" },
      "bookings",
    );
  } catch (err) {
    console.error("[loyaltyService] grantReviewCredit error:", err);
  }
}

/**
 * Check whether a homeowner has now booked 5 distinct service categories.
 * Uses canonical category from providerCustomServices when a serviceId is
 * present; falls back to keyword heuristic on serviceName only when no linked
 * service record is found.
 * Idempotent — silently no-ops if milestone already granted.
 */
export async function checkAndGrantServiceCategoryMilestone(userId: string): Promise<void> {
  try {
    const key = `loyalty_category_milestone_5_${userId}`;

    // Join to providerCustomServices for canonical category name.
    // LEFT JOIN so appointments without a serviceId are still included.
    const completedAppts = await db
      .select({
        canonicalCategory: providerCustomServices.category,
        serviceName: appointments.serviceName,
      })
      .from(appointments)
      .leftJoin(
        providerCustomServices,
        eq(appointments.serviceId, providerCustomServices.id),
      )
      .where(
        and(
          eq(appointments.userId, userId),
          eq(appointments.status, "completed"),
        ),
      );

    // Use canonical category when available; heuristic only as last resort.
    const distinctCategories = new Set(
      completedAppts.map((a) =>
        a.canonicalCategory ?? detectServiceCategoryLocal(a.serviceName || ""),
      ),
    );

    if (distinctCategories.size < CATEGORY_MILESTONE_COUNT) return;

    const granted = await addLoyaltyCredits(userId, CATEGORY_MILESTONE_CENTS, "loyalty_category_milestone", key);

    if (!granted) return;

    await dispatchNotification(
      userId,
      "You earned $15 in HomeBase credits! 🌟",
      "You've booked 5 different types of home services — here's $15 in HomeBase credits to celebrate!",
      "loyalty_credit_earned",
      { type: "loyalty_credit_earned", screen: "CreditHistory", amountCents: CATEGORY_MILESTONE_CENTS, reason: "service_category_milestone" },
      "bookings",
    );
  } catch (err) {
    console.error("[loyaltyService] checkAndGrantServiceCategoryMilestone error:", err);
  }
}

const REASON_LABELS: Record<string, string> = {
  loyalty_first_booking: "First booking completed",
  loyalty_review_left: "Left a provider review",
  loyalty_category_milestone: "Booked 5 service types",
  referral_signup_credit: "Signed up with a referral",
  referral_reward_credit: "Friend completed first booking",
  invoice_payment: "Credits applied to invoice",
  revenuecat_purchase: "Credits purchased",
  manual_admin_credit: "Credit adjustment",
};

export function formatLedgerEntry(entry: {
  id: string;
  deltaCents: number;
  reason: string;
  createdAt: Date;
  invoiceId?: string | null;
}): {
  id: string;
  amountCents: number;
  label: string;
  isCredit: boolean;
  createdAt: string;
  invoiceId?: string | null;
} {
  return {
    id: entry.id,
    amountCents: Math.abs(entry.deltaCents),
    label: REASON_LABELS[entry.reason] ?? entry.reason,
    isCredit: entry.deltaCents > 0,
    createdAt: entry.createdAt.toISOString(),
    invoiceId: entry.invoiceId ?? null,
  };
}
