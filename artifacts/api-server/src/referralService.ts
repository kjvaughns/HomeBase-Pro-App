import { db } from "./db";
import { eq, count, and, isNull } from "drizzle-orm";
import {
  users,
  userCredits,
  creditLedger,
  homeownerReferrals,
  invoices,
} from "@workspace/db";
import { dispatchNotification, logDelivery } from "./notificationService";

const REFERRAL_CREDIT_CENTS = 1000; // $10

/**
 * Generates a deterministic but unique-enough referral code for a user.
 * Uses a short random-looking alphanumeric string derived from a UUID.
 */
export function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Returns a unique referral code not already taken in the users table.
 */
export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempts = 0; attempts < 10; attempts++) {
    const code = generateReferralCode();
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.referralCode, code))
      .limit(1);
    if (!existing) return code;
  }
  // Fallback: longer code to avoid collision
  return generateReferralCode() + generateReferralCode().slice(0, 4);
}

/**
 * Links a new homeowner as a referee of the referrer identified by `referralCode`.
 * Safe to call after user creation — silently no-ops if the code is invalid.
 */
export async function linkReferral(
  referredUserId: string,
  referralCode: string,
): Promise<void> {
  try {
    const normalised = referralCode.trim().toUpperCase();
    const [referrer] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.referralCode, normalised))
      .limit(1);

    if (!referrer) return;
    if (referrer.id === referredUserId) return;

    await db
      .insert(homeownerReferrals)
      .values({
        referrerUserId: referrer.id,
        referredUserId,
        referralCode: normalised,
      })
      .onConflictDoNothing();
  } catch (err) {
    console.error("[referralService] linkReferral error:", err);
  }
}

/**
 * Internal: upsert user_credits and log a ledger entry.
 * When idempotencyKey is provided the ledger INSERT uses ON CONFLICT DO NOTHING
 * so retries are safe — the balance is only incremented once per unique key.
 */
async function addCredits(
  userId: string,
  amountCents: number,
  reason: string,
  idempotencyKey?: string,
): Promise<void> {
  // First, attempt to insert the ledger entry. If we have an idempotency key
  // and a row with that key already exists, this is a no-op and we return early
  // without touching the balance — preventing double-credit on retries.
  const inserted = await db
    .insert(creditLedger)
    .values({ userId, deltaCents: amountCents, reason, idempotencyKey: idempotencyKey ?? null })
    .onConflictDoNothing()
    .returning({ id: creditLedger.id });

  if (idempotencyKey && (!inserted || inserted.length === 0)) {
    // Duplicate detected — ledger entry already exists, balance already updated.
    return;
  }

  // Update balance only when ledger entry was successfully inserted
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
}

/**
 * Called when a homeowner completes their first booking (invoice paid).
 * Checks whether this homeowner was referred, and if so credits both parties.
 *
 * Safe to call multiple times — idempotent via the referrer/referee_credited_at columns.
 */
export async function grantReferralCreditsIfFirstBooking(
  homeownerUserId: string,
): Promise<void> {
  try {
    // ── Claim-first idempotent grant ────────────────────────────────────────
    // Step 1: Atomically claim the referral row. The conditional UPDATE (WHERE
    // referee_credited_at IS NULL) ensures exactly one concurrent call wins.
    // Callers that lose the race get zero rows back and return immediately —
    // they never proceed to write credits.
    const now = new Date();
    const claimed = await db
      .update(homeownerReferrals)
      .set({ firstBookingAt: now, refereeCreditedAt: now, referrerCreditedAt: now })
      .where(
        and(
          eq(homeownerReferrals.referredUserId, homeownerUserId),
          isNull(homeownerReferrals.refereeCreditedAt),
        ),
      )
      .returning({ id: homeownerReferrals.id, referrerUserId: homeownerReferrals.referrerUserId });

    // No row updated → no uncredited referral exists, or another call won the race
    if (!claimed || claimed.length === 0) return;

    const referral = claimed[0];

    // Step 2: Confirm this is a first booking (≤1 paid invoices). If not,
    // roll back the claim so the row stays clean and no credits flow.
    const [paidCount] = await db
      .select({ cnt: count() })
      .from(invoices)
      .where(
        and(
          eq(invoices.homeownerUserId, homeownerUserId),
          eq(invoices.status, "paid"),
        ),
      );
    if ((paidCount?.cnt ?? 0) > 1) {
      // Not a first booking — undo the claim atomically
      await db
        .update(homeownerReferrals)
        .set({ firstBookingAt: null, refereeCreditedAt: null, referrerCreditedAt: null })
        .where(eq(homeownerReferrals.id, referral.id))
        .catch(() => {});
      return;
    }

    // Step 3: Write credits with unique idempotency keys so that even if this
    // function is somehow re-entered, the ledger entries deduplicate safely.
    const refereeKey = `referral_referee_${referral.id}`;
    const referrerKey = `referral_referrer_${referral.id}`;

    try {
      await addCredits(homeownerUserId, REFERRAL_CREDIT_CENTS, "referral_signup_credit", refereeKey);
      await addCredits(referral.referrerUserId, REFERRAL_CREDIT_CENTS, "referral_reward_credit", referrerKey);
    } catch (creditErr) {
      // Credits failed — roll back the claim so a future retry can succeed
      await db
        .update(homeownerReferrals)
        .set({ firstBookingAt: null, refereeCreditedAt: null, referrerCreditedAt: null })
        .where(eq(homeownerReferrals.id, referral.id))
        .catch(() => {});
      throw creditErr;
    }

    // Notify the referrer
    await dispatchNotification(
      referral.referrerUserId,
      "Your referral paid off!",
      "Your friend just completed their first HomeBase booking — you've earned $10 in HomeBase credits!",
      "referral_reward_earned",
      {
        type: "referral_reward_earned",
        screen: "Referrals",
        credits: REFERRAL_CREDIT_CENTS / 100,
      },
      "invoices",
    );

    await logDelivery({
      channel: "in_app",
      status: "sent",
      eventType: "referral.reward_earned",
      recipientUserId: referral.referrerUserId,
      relatedRecordType: "homeowner_referral",
      relatedRecordId: referral.id,
    });
  } catch (err) {
    console.error("[referralService] grantReferralCreditsIfFirstBooking error:", err);
  }
}

/**
 * Returns referral stats for a homeowner: their referral code, link, count, and credits earned.
 */
export async function getReferralStats(userId: string): Promise<{
  referralCode: string | null;
  referralLink: string;
  referralsCount: number;
  creditsEarnedCents: number;
}> {
  const [user] = await db
    .select({ referralCode: users.referralCode })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const referralCode = user?.referralCode ?? null;

  const baseUrl =
    process.env.PUBLIC_BASE_URL ||
    (process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://homebaseproapp.com");
  const referralLink = referralCode
    ? `${baseUrl}/signup?ref=${referralCode}`
    : `${baseUrl}/signup`;

  const [referralsCountRow] = await db
    .select({ cnt: count() })
    .from(homeownerReferrals)
    .where(eq(homeownerReferrals.referrerUserId, userId));

  const referralsCount = referralsCountRow?.cnt ?? 0;

  // Sum credits earned from referral rewards in the ledger
  const creditsRows = await db
    .select({ delta: creditLedger.deltaCents })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.userId, userId),
        eq(creditLedger.reason, "referral_reward_credit"),
      ),
    );

  const creditsEarnedCents = creditsRows.reduce(
    (sum, r) => sum + (r.delta ?? 0),
    0,
  );

  return { referralCode, referralLink, referralsCount, creditsEarnedCents };
}
