/**
 * Cleanup script for test account Kjvaughns1@gmail.com.
 *
 * Run to remove any synthetically-seeded provider data (ratings, reviews, bios)
 * that were not entered by the provider themselves. After running this script,
 * the test account will show only genuine provider-entered data.
 *
 * Run:
 *   npx tsx server/scripts/cleanTestAccount.ts
 */
import { db } from "../db";
import { users, providers, reviews } from "@shared/schema";
import { and, eq } from "drizzle-orm";

const TEST_EMAIL = "kjvaughns1@gmail.com";
const SEED_REVIEW_USER_EMAIL = "reviewuser@homebase.internal";

async function cleanTestAccount() {
  const [user] = await db.select().from(users).where(eq(users.email, TEST_EMAIL));
  if (!user) {
    console.log("Test account not found. Nothing to clean.");
    return;
  }

  const [provider] = await db.select().from(providers).where(eq(providers.userId, user.id));
  if (!provider) {
    console.log("Provider profile not found. Nothing to clean.");
    return;
  }

  console.log(`Found provider: ${provider.businessName} (id: ${provider.id})`);

  // Step 1: Delete synthetic reviews written by the internal seed review user only.
  // Reviews posted by real users (genuine provider clients) are preserved.
  const [seedReviewUser] = await db.select().from(users).where(eq(users.email, SEED_REVIEW_USER_EMAIL));
  if (seedReviewUser) {
    const deletedReviews = await db.delete(reviews)
      .where(and(
        eq(reviews.providerId, provider.id),
        eq(reviews.userId, seedReviewUser.id),
      ))
      .returning({ id: reviews.id });
    console.log(`Deleted ${deletedReviews.length} seeded reviews (by ${SEED_REVIEW_USER_EMAIL}).`);
  } else {
    console.log("No seed review user found; skipping review deletion.");
  }

  // Step 2: Recalculate rating/reviewCount/averageRating from remaining real reviews.
  // After deleting seeded reviews, only genuine user-submitted reviews remain.
  const { pool } = await import("../db");
  const ratingResult = await pool.query<{ count: string; avg: string | null }>(
    `SELECT COUNT(*)::int AS count, AVG(rating)::numeric(3,1) AS avg FROM reviews WHERE provider_id = $1`,
    [provider.id]
  );
  const realCount = ratingResult.rows[0].count ? parseInt(ratingResult.rows[0].count) : 0;
  const realAvg = ratingResult.rows[0].avg ?? "0";
  await db.update(providers)
    .set({ rating: realAvg, reviewCount: realCount, averageRating: realAvg })
    .where(eq(providers.id, provider.id));
  console.log(`Recalculated: reviewCount=${realCount}, rating=${realAvg} (from real reviews).`);

  // Step 3: Clear any seed-set placeholder description/bio if the provider
  // has not set their own. (Only clears if it matches the known seed text.)
  const SEED_DESCRIPTION =
    "Full-service home maintenance and repair specialists serving the greater Austin area. " +
    "From HVAC to plumbing, electrical to landscaping — we handle it all with a trusted, professional touch.";
  if (provider.description === SEED_DESCRIPTION) {
    await db.update(providers)
      .set({ description: "" })
      .where(eq(providers.id, provider.id));
    console.log("Cleared seed placeholder description.");
  } else {
    console.log("Description appears to be user-entered; preserved as-is.");
  }

  console.log("\nCleanup complete. Test account now shows only genuine provider-entered data.");
}

cleanTestAccount().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
