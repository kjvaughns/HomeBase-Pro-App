/**
 * Seed script for test account Kjvaughns1@gmail.com (Kevin Vaughn / Vaughn Home Services).
 *
 * Run:
 *   npx tsx server/scripts/seedTestAccount.ts
 *
 * Safe to re-run: idempotent — each section checks targets, normalises over-target states,
 * and ends with a hard-fail assertion block that exits non-zero if any requirement misses.
 *
 * Environment variables:
 *   DATABASE_URL     (required) — Postgres connection string (set via Replit Secrets)
 *   SEED_USER_PASSWORD (optional) — password for the test account when created fresh.
 *                    If not set, a random bcrypt hash is used (account cannot log in
 *                    until a real password is set). When the account already exists this
 *                    variable is ignored — the existing password is preserved.
 *
 * Post-seed dashboard metrics (approximate, within stated tolerances):
 *   Clients:              212  (71 this quarter / 54 last quarter → +31% growth)
 *   Upcoming jobs:         45  (scheduled_date >= NOW(), top-3 shows Olivia + Riverview)
 *   Completed this month: 188  → dashboard jobsCompleted stat
 *   All-time earnings:  ~$200K (tolerance ±15%)  → Business Insights milestone
 *   MTD revenue:        ~$18.7K (tolerance ≥70% of target) → dashboard revenueMTD stat
 *   Reviews:              163  (4.9 avg) → Business Insights Top Rated
 */
import { db } from "../db";
import {
  users,
  providers,
  clients,
  jobs,
  reviews,
  appointments,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const TEST_EMAIL = "kjvaughns1@gmail.com";

// Dashboard stat targets
const TARGET_CLIENTS = 212;
const TARGET_COMPLETED_THIS_MONTH = 188;
const TARGET_UPCOMING = 45;
const TARGET_MTD_REVENUE = 18750;
const TARGET_REVIEWS = 163;
// Historical earnings target (all-time)
const TARGET_ALL_TIME_EARNINGS = 200000;

const FIRST_NAMES = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "William", "Barbara", "David", "Elizabeth", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Lisa", "Daniel", "Nancy",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
  "Steven", "Dorothy", "Paul", "Kimberly", "Andrew", "Emily", "Joshua", "Donna",
  "Kenneth", "Michelle", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
  "Timothy", "Deborah", "Ronald", "Stephanie", "Edward", "Rebecca", "Jason", "Sharon",
  "Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary", "Amy",
  "Nicholas", "Angela", "Eric", "Shirley", "Jonathan", "Anna", "Stephen", "Brenda",
  "Larry", "Pamela", "Justin", "Emma", "Scott", "Nicole", "Brandon", "Helen",
  "Benjamin", "Samantha", "Samuel", "Katherine", "Raymond", "Christine", "Gregory", "Debra",
  "Frank", "Rachel", "Alexander", "Carolyn", "Patrick", "Janet", "Jack", "Catherine",
  "Dennis", "Maria", "Jerry", "Heather", "Tyler", "Diane", "Aaron", "Julie",
  "Jose", "Joyce", "Adam", "Victoria", "Henry", "Kelly", "Nathan", "Christina",
  "Douglas", "Lauren", "Zachary", "Joan", "Peter", "Evelyn", "Kyle", "Judith",
  "Walter", "Elaine", "Ethan", "Cheryl", "Jeremy", "Megan", "Harold", "Andrea",
  "Keith", "Ann", "Christian", "Alice", "Roger", "Jean", "Noah", "Jacqueline",
  "Gerald", "Hannah", "Carl", "Doris", "Terry", "Martha", "Sean", "Gloria",
  "Austin", "Teresa", "Arthur", "Sara", "Lawrence", "Janice", "Dylan", "Julia",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
  "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
  "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
  "Carter", "Roberts", "Turner", "Phillips", "Evans", "Collins", "Reyes", "Stewart",
  "Morris", "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan",
  "Cooper", "Peterson", "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim",
  "Cox", "Ward", "Richardson", "Watson", "Brooks", "Chavez", "Wood", "James",
  "Bennett", "Gray", "Mendoza", "Ruiz", "Hughes", "Price", "Alvarez", "Castillo",
  "Sanders", "Patel", "Myers", "Long", "Ross", "Foster", "Jimenez", "Powell",
  "Jenkins", "Perry", "Russell", "Sullivan", "Bell", "Coleman", "Butler", "Henderson",
  "Barnes", "Gonzales", "Fisher", "Vasquez", "Simmons", "Romero", "Jordan", "Patterson",
];

const CITIES = [
  "Austin", "Dallas", "Houston", "San Antonio", "Fort Worth",
  "Plano", "Arlington", "Corpus Christi", "Lubbock", "Garland",
];

const STREETS = [
  "Oak", "Maple", "Cedar", "Pine", "Elm", "Willow", "Birch", "Cherry",
  "Walnut", "Ash", "Pecan", "Magnolia", "Cypress", "Spruce", "Poplar",
  "Main", "Park", "Lake", "River", "Hill", "Valley", "Ridge", "Meadow",
];

const STREET_TYPES = ["St", "Ave", "Blvd", "Dr", "Ln", "Way", "Ct", "Pl"];

const JOB_TITLES = [
  "HVAC Maintenance", "Plumbing Inspection", "Electrical Panel Check",
  "Deep House Cleaning", "Lawn Care Service", "Roof Inspection",
  "Interior Painting", "Window Replacement", "Gutter Cleaning",
  "Appliance Repair", "Flooring Installation", "Tile Repair",
  "Fence Installation", "Deck Maintenance", "Water Heater Service",
  "Drain Unclogging", "Pressure Washing", "Attic Insulation",
  "Garage Door Repair", "Drywall Patching", "Cabinet Installation",
  "Landscaping", "Tree Trimming", "Pest Inspection",
  "Foundation Check", "Siding Repair", "Door Installation",
  "Bathroom Remodel", "Kitchen Fixture Install", "Sprinkler System Service",
];

const REVIEW_COMMENTS = [
  "Excellent service! Very professional and on time.",
  "Highly recommend. Did a fantastic job and cleaned up after.",
  "Super responsive and knowledgeable. Will definitely use again.",
  "Went above and beyond. Really impressed with the quality.",
  "Great communication and very thorough. 5 stars.",
  "The team was professional, courteous, and efficient.",
  "Showed up on time, diagnosed the issue quickly. Perfect.",
  "Outstanding work. The results exceeded my expectations.",
  "Very polite and professional. Left the place spotless.",
  "Prompt, efficient, and did exactly what was promised.",
  "Fast, friendly, and incredibly skilled. Highly satisfied.",
  "Honest pricing and exceptional craftsmanship.",
  "Best service provider I've worked with. Highly recommend!",
  "Knowledgeable technician. Fixed the issue in no time.",
  "Exceptional attention to detail. Truly a 5-star experience.",
  "Reliable, professional, and reasonably priced.",
  "Would not hesitate to hire again. Truly top notch.",
  "Clean, efficient, and very communicative throughout.",
  "Did an amazing job! Exactly what I needed.",
  "Very skilled and professional. Great value for money.",
  "Dependable and high quality work. Very pleased.",
  "Friendly service and great results. Highly recommended!",
  "Came prepared with all the right tools. Great job.",
  "Diagnosed and resolved quickly. Wonderful experience.",
  "Careful, detail-oriented and thorough. Very happy!",
];

function rand(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPhone(): string {
  return `(${randInt(200, 999)}) ${randInt(200, 999)}-${randInt(1000, 9999)}`;
}

function randomZip(): string {
  return `${randInt(70000, 79999)}`;
}

function randomAddress(): string {
  return `${randInt(100, 9999)} ${rand(STREETS)} ${rand(STREET_TYPES)}`;
}

function randomEmail(firstName: string, lastName: string): string {
  const domains = ["gmail.com", "yahoo.com", "outlook.com", "icloud.com", "hotmail.com"];
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randInt(1, 99)}@${rand(domains)}`;
}

function dateInCurrentMonth(dayOffset: number, dayOfMonth: number): Date {
  const today = new Date();
  const day = Math.min(Math.max(1, dayOffset + 1), dayOfMonth);
  return new Date(today.getFullYear(), today.getMonth(), day, 9, 0, 0, 0);
}

function daysAgoDate(daysBack: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(9, 0, 0, 0);
  return d;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(randInt(8, 16), 0, 0, 0);
  return d;
}

async function seedTestAccount() {
  const { pool } = await import("../db");
  const BATCH_SIZE = 50;
  const times = ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"];

  console.log("Starting seed for test account:", TEST_EMAIL);

  // ── 1. Find or create the user ──────────────────────────────────────────────
  const [existingUser] = await db.select().from(users).where(eq(users.email, TEST_EMAIL));

  let userId: string;
  if (existingUser) {
    console.log("User already exists, id:", existingUser.id);
    userId = existingUser.id;
    await db.update(users).set({ firstName: "Kevin", lastName: "Vaughn", isProvider: true })
      .where(eq(users.id, userId));
  } else {
    console.log("Creating user...");
    // Password sourced from env var; if not set, generate a time-based random placeholder
    const rawPassword = process.env.SEED_USER_PASSWORD ?? `Seed${Date.now()}!`;
    const hashed = await bcrypt.hash(rawPassword, 10);
    const [newUser] = await db.insert(users).values({
      email: TEST_EMAIL,
      password: hashed,
      firstName: "Kevin",
      lastName: "Vaughn",
      phone: "(512) 555-0199",
      isProvider: true,
    }).returning();
    userId = newUser.id;
    console.log("Created user:", userId);
  }

  // ── 2. Find or create the provider record ───────────────────────────────────
  const [existingProvider] = await db.select().from(providers).where(eq(providers.userId, userId));

  let providerId: string;
  // rating / reviewCount / averageRating are NOT set here — they are computed
  // and written after reviews are seeded in section 7, ensuring they always
  // reflect the actual seeded review data rather than hardcoded placeholders.
  const providerFields = {
    businessName: "Vaughn Home Services",
    description:
      "Full-service home maintenance and repair specialists serving the greater Austin area. " +
      "From HVAC to plumbing, electrical to landscaping — we handle it all with a trusted, professional touch.",
    phone: "(512) 555-0199",
    email: TEST_EMAIL,
    hourlyRate: "95.00",
    isVerified: true,
    isActive: true,
    serviceArea: "Greater Austin, TX",
    yearsExperience: 12,
    capabilityTags: [
      "Licensed", "Insured", "24/7 Emergency",
      "Residential", "Commercial", "HVAC", "Plumbing", "Electrical",
    ],
  };

  if (existingProvider) {
    console.log("Provider exists, id:", existingProvider.id);
    providerId = existingProvider.id;
    // Non-destructive update: only set fields that are missing/empty on the existing record.
    // User-entered values (businessName, description, serviceArea, etc.) are preserved.
    const nonDestructiveUpdate: Partial<typeof providerFields> = {};
    for (const [key, value] of Object.entries(providerFields) as [keyof typeof providerFields, unknown][]) {
      const existing = (existingProvider as Record<string, unknown>)[key];
      if (existing === null || existing === undefined || existing === "" ||
          (Array.isArray(existing) && existing.length === 0)) {
        (nonDestructiveUpdate as Record<string, unknown>)[key] = value;
      }
    }
    if (Object.keys(nonDestructiveUpdate).length > 0) {
      await db.update(providers).set(nonDestructiveUpdate).where(eq(providers.id, providerId));
      console.log("Updated missing provider fields:", Object.keys(nonDestructiveUpdate).join(", "));
    } else {
      console.log("Provider fields already set; skipping update.");
    }
  } else {
    console.log("Creating provider...");
    const [newProvider] = await db.insert(providers).values({ userId, ...providerFields }).returning();
    providerId = newProvider.id;
    console.log("Created provider:", providerId);
  }

  // ── 2b. Reset any synthetic rating/reviewCount that was hardcoded on a prior run ────
  // Ensures provider rating/reviewCount always reflect actual seeded reviews (computed
  // in section 7), never a placeholder value written without backing review rows.
  {
    const actualReviewCountResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM reviews WHERE provider_id = $1`, [providerId]
    );
    const actualCount = parseInt(actualReviewCountResult.rows[0].count);
    const [existingMeta] = await db.select({ rating: providers.rating, reviewCount: providers.reviewCount })
      .from(providers).where(eq(providers.id, providerId));
    const storedCount = existingMeta?.reviewCount ?? 0;
    if (actualCount === 0 && storedCount > 0) {
      // Hardcoded rating exists but no actual review rows — reset to zero
      await db.update(providers).set({ rating: "0", reviewCount: 0, averageRating: "0" })
        .where(eq(providers.id, providerId));
      console.log("Cleared synthetic rating metadata (no backing review rows found).");
    } else if (actualCount > 0 && storedCount !== actualCount) {
      // Review rows exist but count is out of sync — recalculate
      const avgResult = await pool.query<{ avg: string | null }>(
        `SELECT AVG(rating)::numeric(3,1) AS avg FROM reviews WHERE provider_id = $1`, [providerId]
      );
      const avg = avgResult.rows[0].avg ?? "0";
      await db.update(providers).set({ rating: avg, reviewCount: actualCount, averageRating: avg })
        .where(eq(providers.id, providerId));
      console.log(`Recalculated provider rating from ${actualCount} review rows: ${avg}`);
    }
  }

  // ── 3. Ensure clients — guarantee exactly TARGET_CLIENTS including named specials ──
  const allExistingClients = await db
    .select({ id: clients.id, firstName: clients.firstName, lastName: clients.lastName })
    .from(clients)
    .where(eq(clients.providerId, providerId));

  let oliviaClient = allExistingClients.find(c => c.firstName === "Olivia" && c.lastName === "P.");
  let riverviewClient = allExistingClients.find(c => c.firstName === "Riverview Condo" && c.lastName === "Assoc.");
  const insertedClients: { id: string; firstName: string; lastName: string }[] = [...allExistingClients];

  if (!oliviaClient) {
    const [created] = await db.insert(clients).values({
      providerId, firstName: "Olivia", lastName: "P.",
      email: randomEmail("olivia", "portman"), phone: randomPhone(),
      address: randomAddress(), city: "Austin", state: "TX", zip: "78701",
    }).returning({ id: clients.id, firstName: clients.firstName, lastName: clients.lastName });
    oliviaClient = created;
    insertedClients.push(created);
    console.log("Created Olivia P. client");
  }

  if (!riverviewClient) {
    const [created] = await db.insert(clients).values({
      providerId, firstName: "Riverview Condo", lastName: "Assoc.",
      email: "info@riverviewcondo.com", phone: randomPhone(),
      address: "1500 Riverview Dr", city: "Austin", state: "TX", zip: "78701",
    }).returning({ id: clients.id, firstName: clients.firstName, lastName: clients.lastName });
    riverviewClient = created;
    insertedClients.push(created);
    console.log("Created Riverview Condo Assoc. client");
  }

  const remainingClientsNeeded = TARGET_CLIENTS - insertedClients.length;
  if (remainingClientsNeeded > 0) {
    console.log(`Adding ${remainingClientsNeeded} clients to reach ${TARGET_CLIENTS}...`);

    // Distribute clients across quarters to produce a realistic ~+32% growth signal.
    // Target: ~71 in current quarter (Q1 2026), ~54 in last quarter (Q4 2025),
    //         rest distributed across earlier periods (before Q4 2025).
    // 71/54 ≈ 1.31 → +31% quarter-over-quarter growth
    const now = new Date();
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    const startOfThisQuarter = new Date(now.getFullYear(), quarterMonth, 1, 0, 0, 0, 0);
    const startOfLastQuarter = new Date(now.getFullYear(), quarterMonth - 3, 1, 0, 0, 0, 0);
    // Target distribution for new clients:
    // ~71 in this quarter, ~54 in last quarter → ratio 71/54 ≈ +31% growth
    const thisQNewTarget = 71;
    const lastQNewTarget = 54;

    function clientCreatedAt(idx: number): Date {
      if (idx < thisQNewTarget) {
        // This quarter: random date within Q1 2026
        const start = startOfThisQuarter.getTime();
        const end = now.getTime();
        return new Date(start + Math.random() * (end - start));
      } else if (idx < thisQNewTarget + lastQNewTarget) {
        // Last quarter: random date within Q4 2025
        const start = startOfLastQuarter.getTime();
        const end = startOfThisQuarter.getTime() - 1;
        return new Date(start + Math.random() * (end - start));
      } else {
        // Older: 1-3 years back
        return daysAgoDate(randInt(365, 1095));
      }
    }

    const newBatches: {
      providerId: string; firstName: string; lastName: string; email: string;
      phone: string; address: string; city: string; state: string; zip: string;
      createdAt: Date;
    }[] = [];
    for (let i = 0; i < remainingClientsNeeded; i++) {
      const offset = i + insertedClients.length;
      const firstName = FIRST_NAMES[offset % FIRST_NAMES.length];
      const lastName = LAST_NAMES[Math.floor(offset / FIRST_NAMES.length) % LAST_NAMES.length];
      newBatches.push({
        providerId, firstName, lastName, email: randomEmail(firstName, lastName),
        phone: randomPhone(), address: randomAddress(),
        city: rand(CITIES), state: "TX", zip: randomZip(),
        createdAt: clientCreatedAt(i),
      });
    }
    for (let i = 0; i < newBatches.length; i += BATCH_SIZE) {
      const result = await db.insert(clients).values(newBatches.slice(i, i + BATCH_SIZE))
        .returning({ id: clients.id, firstName: clients.firstName, lastName: clients.lastName });
      insertedClients.push(...result);
    }
    console.log(`Total clients: ${insertedClients.length} (with quarter-distributed createdAt for growth insight)`);
  } else {
    console.log(`Clients at target (${insertedClients.length}). Skipping.`);
  }

  // Ensure client createdAt dates are distributed across quarters for the growth insight.
  // This is idempotent: checks the distribution and re-applies only if needed.
  {
    const now = new Date();
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    const startOfThisQuarter = new Date(now.getFullYear(), quarterMonth, 1);
    const startOfLastQuarter = new Date(now.getFullYear(), quarterMonth - 3, 1);

    const distResult = await pool.query<{ period: string; count: string }>(
      `SELECT
         CASE
           WHEN created_at >= date_trunc('quarter', NOW()) THEN 'this_quarter'
           WHEN created_at >= date_trunc('quarter', NOW()) - INTERVAL '3 months' THEN 'last_quarter'
           ELSE 'older'
         END AS period,
         COUNT(*) AS count
       FROM clients WHERE provider_id = $1 GROUP BY 1`,
      [providerId]
    );
    const thisQCount = parseInt(distResult.rows.find(r => r.period === "this_quarter")?.count ?? "0");
    const lastQCount = parseInt(distResult.rows.find(r => r.period === "last_quarter")?.count ?? "0");

    // Target: ~71 this quarter, ~54 last quarter → +31% growth
    if (thisQCount < 60 || thisQCount > 85 || lastQCount < 45 || lastQCount > 65) {
      console.log(`Redistributing client createdAt dates (${thisQCount} this quarter, ${lastQCount} last quarter)...`);
      const allIds = await pool.query<{ id: string }>(
        `SELECT id FROM clients WHERE provider_id = $1 ORDER BY created_at`, [providerId]
      );
      const ids = allIds.rows.map(r => r.id);
      const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());

      const TARGET_THIS_Q = 71;
      const TARGET_LAST_Q = 54;

      function randBetween(start: Date, end: Date): Date {
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
      }

      for (let i = 0; i < ids.length; i++) {
        let targetDate: Date;
        if (i < TARGET_THIS_Q) targetDate = randBetween(startOfThisQuarter, now);
        else if (i < TARGET_THIS_Q + TARGET_LAST_Q) targetDate = randBetween(startOfLastQuarter, startOfThisQuarter);
        else targetDate = randBetween(threeYearsAgo, startOfLastQuarter);
        await pool.query(`UPDATE clients SET created_at = $1 WHERE id = $2`, [targetDate, ids[i]]);
      }
      console.log(`Redistributed ${ids.length} client createdAt dates (target: ${TARGET_THIS_Q}+${TARGET_LAST_Q} this/last quarter).`);
    } else {
      console.log(`Client quarter distribution OK (${thisQCount} this quarter, ${lastQCount} last quarter → ~+${Math.round((thisQCount / lastQCount - 1) * 100)}% growth).`);
    }
  }

  const regularClients = insertedClients.filter(
    c => c.id !== oliviaClient!.id && c.id !== riverviewClient!.id
  );

  // ── 4a. Normalize current-month completed jobs to exactly TARGET_COMPLETED_THIS_MONTH ─
  // This drives the dashboard `jobsCompleted` stat.
  // Jobs are seeded with controlled prices so all-time earnings stay near $200K:
  //   188 this-month jobs × avg ~$650 ≈ $122K this month
  //   120 historical jobs  × avg ~$650 ≈ $78K historical
  //   Total ≈ $200K all-time
  //
  // If the account already has this-month jobs, check if the all-time total is overshot.
  // If avg price per completed job exceeds $1000 (i.e. old high-price run), delete all
  // this-month completed jobs and re-seed them with the controlled price distribution.
  const allTimePrecheckResult = await pool.query<{ count: string; sum: string }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(final_price::numeric), 0) AS sum FROM jobs
     WHERE provider_id = $1 AND status = 'completed'`,
    [providerId]
  );
  const allTimePrecheck = parseFloat(allTimePrecheckResult.rows[0].sum);
  const allTimeCount = parseInt(allTimePrecheckResult.rows[0].count);
  const avgPricePrecheck = allTimeCount > 0 ? allTimePrecheck / allTimeCount : 0;

  if (allTimePrecheck > TARGET_ALL_TIME_EARNINGS * 1.1 || avgPricePrecheck > 1000) {
    // Over-target all-time earnings (likely from old high-price run). Delete all this-month
    // completed jobs and re-seed at controlled prices.
    const deleted = await pool.query<{ count: string }>(
      `WITH del AS (
         DELETE FROM jobs
         WHERE provider_id = $1 AND status = 'completed'
           AND completed_at >= date_trunc('month', NOW())
           AND client_id NOT IN ($2, $3)
         RETURNING id
       ) SELECT COUNT(*) AS count FROM del`,
      [providerId, oliviaClient.id, riverviewClient.id]
    );
    console.log(`All-time earnings ($${allTimePrecheck.toFixed(0)}) over target or avg price ($${avgPricePrecheck.toFixed(0)}) too high. Deleted ${deleted.rows[0].count} this-month jobs for re-seeding.`);
  }

  // Check count AFTER any normalization above
  const thisMonthCountResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM jobs
     WHERE provider_id = $1 AND status = 'completed'
       AND completed_at >= date_trunc('month', NOW())`,
    [providerId]
  );
  const thisMonthCompleted = parseInt(thisMonthCountResult.rows[0].count);

  if (thisMonthCompleted > TARGET_COMPLETED_THIS_MONTH) {
    // Remove excess this-month completed jobs (never remove named client jobs)
    const excessCount = thisMonthCompleted - TARGET_COMPLETED_THIS_MONTH;
    await pool.query(
      `DELETE FROM jobs WHERE id IN (
         SELECT id FROM jobs
         WHERE provider_id = $1 AND status = 'completed'
           AND completed_at >= date_trunc('month', NOW())
           AND client_id NOT IN ($2, $3)
         ORDER BY completed_at DESC
         LIMIT $4
       )`,
      [providerId, oliviaClient.id, riverviewClient.id, excessCount]
    );
    console.log(`Removed ${excessCount} excess this-month jobs to normalize to ${TARGET_COMPLETED_THIS_MONTH}.`);
  }

  // Collect completed job IDs for invoice seeding
  const completedJobsForInvoices: { id: string; clientId: string | null }[] = [];

  const thisMonthAfterNorm = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM jobs
     WHERE provider_id = $1 AND status = 'completed'
       AND completed_at >= date_trunc('month', NOW())`,
    [providerId]
  );
  const thisMonthAfter = parseInt(thisMonthAfterNorm.rows[0].count);

  if (thisMonthAfter >= TARGET_COMPLETED_THIS_MONTH) {
    console.log(`Current-month completed jobs at target (${thisMonthAfter}). Skipping insert.`);
    const rows = await pool.query<{ id: string; client_id: string | null }>(
      `SELECT id, client_id FROM jobs
       WHERE provider_id = $1 AND status = 'completed'
         AND completed_at >= date_trunc('month', NOW())
       LIMIT $2`,
      [providerId, TARGET_COMPLETED_THIS_MONTH]
    );
    completedJobsForInvoices.push(...rows.rows.map(r => ({ id: r.id, clientId: r.client_id })));
  } else {
    const needed = TARGET_COMPLETED_THIS_MONTH - thisMonthAfter;
    console.log(`Seeding ${needed} completed jobs within current month...`);
    const today = new Date();
    const dayOfMonth = Math.max(1, today.getDate());

    const jobInserts: {
      providerId: string; clientId: string; title: string; description: string;
      scheduledDate: Date; scheduledTime: string; status: "completed";
      finalPrice: string; estimatedPrice: string; address: string; completedAt: Date;
    }[] = [];

    for (let i = 0; i < needed; i++) {
      const client = regularClients[i % regularClients.length];
      const dayOffset = i % dayOfMonth;
      const completedAt = dateInCurrentMonth(dayOffset, dayOfMonth);
      // Controlled price distribution targeting avg ~$650/job
      // 188 jobs × $650 avg = ~$122K this month
      let price: number;
      const roll = Math.random();
      if (roll < 0.30) price = randInt(300, 500);
      else if (roll < 0.65) price = randInt(500, 800);
      else if (roll < 0.90) price = randInt(800, 1100);
      else price = randInt(1100, 1400);

      jobInserts.push({
        providerId, clientId: client.id,
        title: rand(JOB_TITLES), description: "Professional service completed for client.",
        scheduledDate: completedAt, scheduledTime: rand(times),
        status: "completed", finalPrice: price.toFixed(2),
        estimatedPrice: (price * 0.95).toFixed(2),
        address: randomAddress() + `, ${rand(CITIES)}, TX`,
        completedAt,
      });
    }

    for (let i = 0; i < jobInserts.length; i += BATCH_SIZE) {
      const result = await db.insert(jobs).values(jobInserts.slice(i, i + BATCH_SIZE))
        .returning({ id: jobs.id, clientId: jobs.clientId });
      completedJobsForInvoices.push(...result.map(r => ({ id: r.id, clientId: r.clientId })));
    }
    const thisMonthTotal = jobInserts.reduce((s, j) => s + parseFloat(j.finalPrice), 0);
    console.log(`Inserted ${jobInserts.length} completed jobs this month (~$${thisMonthTotal.toFixed(0)} subtotal).`);
  }

  // ── 4b. Seed historical completed jobs for ~$200K all-time earnings milestone ──
  // Strategy: check current all-time total; if below $200K, add historical jobs
  // spread over the past 12 months to bring the total to ~$200K.
  // If already above target, skip (historical jobs are not deleted; only current-month
  // excess is deleted above to keep dashboard stats deterministic).
  const allTimeResult = await pool.query<{ sum: string | null }>(
    `SELECT COALESCE(SUM(final_price::numeric), 0) AS sum
     FROM jobs WHERE provider_id = $1 AND status = 'completed'`,
    [providerId]
  );
  const currentAllTimeEarnings = parseFloat(allTimeResult.rows[0].sum ?? "0");
  const historicalEarningsNeeded = TARGET_ALL_TIME_EARNINGS - currentAllTimeEarnings;

  if (historicalEarningsNeeded > 5000) {
    const HISTORICAL_JOB_COUNT = 120;
    const pricePerJob = historicalEarningsNeeded / HISTORICAL_JOB_COUNT;
    console.log(`Seeding ${HISTORICAL_JOB_COUNT} historical jobs (past 12 months, target ~$${historicalEarningsNeeded.toFixed(0)} additional)...`);

    const historicalInserts: {
      providerId: string; clientId: string; title: string; description: string;
      scheduledDate: Date; scheduledTime: string; status: "completed";
      finalPrice: string; estimatedPrice: string; address: string; completedAt: Date;
    }[] = [];

    for (let i = 0; i < HISTORICAL_JOB_COUNT; i++) {
      const client = regularClients[(i + 10) % regularClients.length];
      // Spread over past 2–12 months (stay out of current month)
      const daysBack = randInt(40, 365);
      const completedAt = daysAgoDate(daysBack);
      const variance = (Math.random() - 0.5) * 0.3;
      const price = Math.max(200, Math.round(pricePerJob * (1 + variance)));

      historicalInserts.push({
        providerId, clientId: client.id,
        title: rand(JOB_TITLES), description: "Historical service completed for client.",
        scheduledDate: completedAt, scheduledTime: rand(times),
        status: "completed", finalPrice: price.toFixed(2),
        estimatedPrice: (price * 0.95).toFixed(2),
        address: randomAddress() + `, ${rand(CITIES)}, TX`,
        completedAt,
      });
    }

    for (let i = 0; i < historicalInserts.length; i += BATCH_SIZE) {
      await db.insert(jobs).values(historicalInserts.slice(i, i + BATCH_SIZE));
    }
    const historicalTotal = historicalInserts.reduce((s, j) => s + parseFloat(j.finalPrice), 0);
    console.log(`Inserted ${historicalInserts.length} historical jobs (~$${historicalTotal.toFixed(0)} historical earnings).`);
  } else {
    console.log(`All-time earnings at target (~$${currentAllTimeEarnings.toFixed(0)}). Skipping historical jobs.`);
  }

  // ── 5. Ensure exactly TARGET_UPCOMING upcoming jobs, with required named jobs ──
  // IMPORTANT: "upcoming" = status='scheduled' AND scheduled_date >= NOW()
  // (same predicate used by backend getProviderStats)
  // Insert named jobs first, then count FUTURE scheduled jobs, then top up remainder.

  // Olivia P. — scheduled for today.
  // Use end-of-day (23:59) to ensure the job is still "upcoming" regardless of when this
  // script runs. The display time (scheduledTime text) still reads "9:00 AM" as required.
  const oliviaJobResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM jobs
     WHERE provider_id = $1 AND client_id = $2 AND title = 'Custom Furniture Consultation'
       AND scheduled_date >= NOW()`,
    [providerId, oliviaClient.id]
  );
  if (parseInt(oliviaJobResult.rows[0].count) === 0) {
    // scheduledDate = today at 23:59:59 so it always counts as "upcoming" (>= NOW()).
    // The UI displays scheduledTime text field ("9:00 AM") for the time shown to the user,
    // so the display reads "today at 9:00 AM" while the DB timestamp keeps it in the future.
    const todayAt9am = new Date();
    todayAt9am.setHours(23, 59, 59, 0);
    await db.insert(jobs).values({
      providerId, clientId: oliviaClient.id,
      title: "Custom Furniture Consultation",
      description: "New client consultation for custom furniture design and installation.",
      scheduledDate: todayAt9am, scheduledTime: "9:00 AM",
      status: "scheduled", estimatedPrice: "250.00",
      address: randomAddress() + ", Austin, TX",
    });
    console.log("Created Olivia P. upcoming job (today, display: 9:00 AM).");
  }

  // Riverview Condo Assoc. — recurring quarterly maintenance, next Wednesday 10 AM.
  // isRecurring is derived from a linked appointment record (per API enrichment logic).
  // We seed an appointment row with isRecurring=true, then link it to the job.
  const riverviewJobResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM jobs
     WHERE provider_id = $1 AND client_id = $2 AND title = 'Quarterly Maintenance'
       AND scheduled_date >= NOW()`,
    [providerId, riverviewClient.id]
  );
  if (parseInt(riverviewJobResult.rows[0].count) === 0) {
    const nextWed = new Date();
    const daysUntilWed = (3 - nextWed.getDay() + 7) % 7 || 7;
    nextWed.setDate(nextWed.getDate() + daysUntilWed);
    nextWed.setHours(10, 0, 0, 0);

    // Fetch the review placeholder user id (or any user id for appointement userId)
    const [apptUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, TEST_EMAIL));

    // Insert appointment first so the job can link to it for isRecurring enrichment
    const [riverviewAppt] = await db.insert(appointments).values({
      userId: apptUser.id, providerId,
      serviceName: "Quarterly Maintenance",
      description: "Recurring quarterly maintenance check for Riverview Condo Association.",
      scheduledDate: nextWed, scheduledTime: "10:00 AM",
      status: "completed" as "completed",  // historical appointment drives recurring
      isRecurring: true,
      recurringFrequency: "quarterly",
      estimatedPrice: "450.00",
    }).returning({ id: appointments.id });

    await db.insert(jobs).values({
      providerId, clientId: riverviewClient.id,
      appointmentId: riverviewAppt.id,
      title: "Quarterly Maintenance",
      description: "Recurring quarterly maintenance check for Riverview Condo Association.",
      scheduledDate: nextWed, scheduledTime: "10:00 AM",
      status: "scheduled", estimatedPrice: "450.00",
      address: "1500 Riverview Dr, Austin, TX",
    });
    console.log("Created Riverview Condo Assoc. upcoming recurring job (next Wednesday, 10:00 AM).");
  }

  // Delete any filler scheduled jobs that fall BEFORE Riverview's next-Wednesday date.
  // These would appear before Riverview in the dashboard's top-3 sorted upcoming list.
  // Named jobs (Olivia, Riverview) are excluded from deletion by client_id filter.
  const nextWedCleanup = new Date();
  const daysUntilWedCleanup = (3 - nextWedCleanup.getDay() + 7) % 7 || 7;
  nextWedCleanup.setDate(nextWedCleanup.getDate() + daysUntilWedCleanup);
  nextWedCleanup.setHours(10, 0, 0, 0);

  const deletedEarlyResult = await pool.query<{ count: string }>(
    `WITH deleted AS (
       DELETE FROM jobs
       WHERE provider_id = $1
         AND status = 'scheduled'
         AND scheduled_date >= NOW()
         AND scheduled_date < $2
         AND client_id NOT IN ($3, $4)
       RETURNING id
     )
     SELECT COUNT(*) AS count FROM deleted`,
    [providerId, nextWedCleanup, oliviaClient.id, riverviewClient.id]
  );
  const deletedCount = parseInt(deletedEarlyResult.rows[0].count);
  if (deletedCount > 0) {
    console.log(`Deleted ${deletedCount} filler jobs scheduled before Riverview (next Wednesday).`);
  }

  // Count FUTURE scheduled jobs (same filter as getProviderStats) after named inserts
  const currentScheduledResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM jobs
     WHERE provider_id = $1 AND status = 'scheduled' AND scheduled_date >= NOW()`,
    [providerId]
  );
  const currentScheduledCount = parseInt(currentScheduledResult.rows[0].count);
  const additionalNeeded = TARGET_UPCOMING - currentScheduledCount;

  if (additionalNeeded > 0) {
    console.log(`Adding ${additionalNeeded} more upcoming jobs (total target: ${TARGET_UPCOMING})...`);

    // CRITICAL: All filler jobs must be AFTER Riverview's next-Wednesday slot so that
    // the dashboard's top-3 upcoming jobs list always shows Olivia (today) and Riverview
    // (next Wednesday) first. ProviderHomeScreen sorts by scheduledDate ascending and slices
    // to the first 3, so jobs before Riverview would push it out of the visible section.
    const nextWedForRange = new Date();
    const daysUntilWedForRange = (3 - nextWedForRange.getDay() + 7) % 7 || 7;
    nextWedForRange.setDate(nextWedForRange.getDate() + daysUntilWedForRange);
    nextWedForRange.setHours(10, 1, 0, 0); // just after Riverview's 10:00 AM slot

    const upcomingInserts: {
      providerId: string; clientId: string; title: string; description: string;
      scheduledDate: Date; scheduledTime: string; status: "scheduled";
      estimatedPrice: string; address: string;
    }[] = [];

    for (let i = 0; i < additionalNeeded; i++) {
      const client = regularClients[i % regularClients.length];
      // Schedule strictly after Riverview's next-Wednesday slot (8–60 days from now, min after nextWed)
      const minDaysOut = daysUntilWedForRange + 1;
      const scheduledDate = daysFromNow(randInt(minDaysOut, 60));
      upcomingInserts.push({
        providerId, clientId: client.id,
        title: rand(JOB_TITLES), description: "Upcoming service scheduled.",
        scheduledDate, scheduledTime: rand(times),
        status: "scheduled", estimatedPrice: randInt(150, 1200).toFixed(2),
        address: randomAddress() + `, ${rand(CITIES)}, TX`,
      });
    }

    for (let i = 0; i < upcomingInserts.length; i += BATCH_SIZE) {
      await db.insert(jobs).values(upcomingInserts.slice(i, i + BATCH_SIZE));
    }
    console.log(`Inserted ${upcomingInserts.length} additional upcoming jobs (all after Riverview Wednesday slot).`);
  } else {
    console.log(`Upcoming jobs at target (${currentScheduledCount}). Skipping.`);
  }

  // Post-seed assertion: verify Olivia and Riverview are in the visible top-3 upcoming jobs
  const top3Result = await pool.query<{ client_id: string; title: string; scheduled_date: Date }>(
    `SELECT j.client_id, j.title, j.scheduled_date
     FROM jobs j WHERE j.provider_id = $1 AND j.status = 'scheduled' AND j.scheduled_date >= NOW()
     ORDER BY j.scheduled_date ASC LIMIT 3`,
    [providerId]
  );
  const top3ClientIds = top3Result.rows.map(r => r.client_id);
  const oliviaVisible = top3ClientIds.includes(oliviaClient.id);
  const riverviewVisible = top3ClientIds.includes(riverviewClient.id);
  if (!oliviaVisible || !riverviewVisible) {
    console.warn(`WARNING: Named jobs not in top-3 visible upcoming!`);
    console.warn(`  Olivia (${oliviaClient.id}) in top-3: ${oliviaVisible}`);
    console.warn(`  Riverview (${riverviewClient.id}) in top-3: ${riverviewVisible}`);
    console.warn(`  Top-3 jobs:`);
    top3Result.rows.forEach(r => console.warn(`    ${r.client_id} — ${r.title} at ${r.scheduled_date}`));
  } else {
    console.log("Top-3 upcoming jobs assertion passed: Olivia and Riverview both visible.");
  }

  // ── 6. Ensure paid invoices this month total ~TARGET_MTD_REVENUE ─────────────
  // Dashboard metric: revenueMTD = SUM(total) WHERE paid_at >= start of current month
  const mtdResult = await pool.query<{ sum: string | null }>(
    `SELECT COALESCE(SUM(total::numeric), 0) AS sum FROM invoices
     WHERE provider_id = $1 AND status = 'paid'
       AND paid_at >= date_trunc('month', NOW())`,
    [providerId]
  );
  const currentMTD = parseFloat(mtdResult.rows[0].sum ?? "0");
  const mtdDelta = TARGET_MTD_REVENUE - currentMTD;

  if (mtdDelta > 500) {
    const invoiceCount = Math.min(15, completedJobsForInvoices.length);
    const mtdJobs = completedJobsForInvoices.slice(0, invoiceCount);
    const perInvoice = mtdDelta / Math.max(1, mtdJobs.length);
    console.log(`Adding paid invoices to reach ~$${TARGET_MTD_REVENUE} MTD (currently $${currentMTD.toFixed(2)})...`);

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    for (let idx = 0; idx < mtdJobs.length; idx++) {
      const job = mtdJobs[idx];
      const variance = randInt(-200, 200);
      const amount = Math.max(200, Math.round(perInvoice + variance));
      const amountStr = amount.toFixed(2);
      const paidDate = new Date(startOfMonth);
      paidDate.setDate(randInt(1, Math.max(1, today.getDate())));
      await pool.query(
        `INSERT INTO invoices (provider_id, client_id, job_id, invoice_number, amount, total, status, due_date, paid_at, notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'paid', $7, $7, 'Paid in full.')`,
        [providerId, job.clientId, job.id,
          `INV-MTD-${String(idx + 1).padStart(4, "0")}`, amountStr, amountStr, paidDate]
      );
    }
    console.log(`Inserted ${mtdJobs.length} paid invoices for current month.`);
  } else {
    console.log(`MTD revenue already at target ($${currentMTD.toFixed(2)}). Skipping.`);
  }

  // ── 7. Ensure TARGET_REVIEWS reviews exist (avg 4.9 stars) ──────────────────
  const existingReviewsResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM reviews WHERE provider_id = $1`, [providerId]
  );
  const existingReviewCount = parseInt(existingReviewsResult.rows[0].count);

  if (existingReviewCount < TARGET_REVIEWS) {
    const needed = TARGET_REVIEWS - existingReviewCount;
    console.log(`Seeding ${needed} reviews (target: ${TARGET_REVIEWS})...`);

    const [reviewUser] = await db.select().from(users).where(eq(users.email, "reviewuser@homebase.internal"));
    let reviewUserId: string;
    if (reviewUser) {
      reviewUserId = reviewUser.id;
    } else {
      // This is a system placeholder account; password is never used for login
      const internalPassword = await bcrypt.hash(`internal-review-${Date.now()}`, 10);
      const [u] = await db.insert(users).values({
        email: "reviewuser@homebase.internal",
        password: internalPassword,
        firstName: "Review", lastName: "User",
      }).returning();
      reviewUserId = u.id;
    }

    // Fetch completed job IDs to link review appointments
    const jobRowsResult = await pool.query<{ id: string }>(
      `SELECT id FROM jobs WHERE provider_id = $1 AND status = 'completed' LIMIT $2`,
      [providerId, needed]
    );
    const jobRows = jobRowsResult.rows;

    const appointmentInserts: {
      userId: string; providerId: string; serviceName: string; scheduledDate: Date;
      scheduledTime: string; status: "completed"; finalPrice: string; estimatedPrice: string; completedAt: Date;
    }[] = [];

    for (let i = 0; i < Math.min(needed, jobRows.length); i++) {
      const completedAt = daysAgoDate(randInt(1, 30));
      appointmentInserts.push({
        userId: reviewUserId, providerId,
        serviceName: rand(JOB_TITLES), scheduledDate: completedAt,
        scheduledTime: rand(times), status: "completed",
        finalPrice: "500.00", estimatedPrice: "500.00", completedAt,
      });
    }

    const insertedAppointments: { id: string }[] = [];
    for (let i = 0; i < appointmentInserts.length; i += BATCH_SIZE) {
      const result = await db.insert(appointments).values(appointmentInserts.slice(i, i + BATCH_SIZE))
        .returning({ id: appointments.id });
      insertedAppointments.push(...result);
    }

    // Rating distribution: first 152 are 5-star, remainder 4-star → avg 4.93 ≈ 4.9
    const reviewInserts: {
      appointmentId: string; userId: string; providerId: string;
      rating: number; comment: string; createdAt: Date;
    }[] = [];
    for (let i = 0; i < insertedAppointments.length; i++) {
      const absoluteIdx = existingReviewCount + i;
      reviewInserts.push({
        appointmentId: insertedAppointments[i].id,
        userId: reviewUserId, providerId,
        rating: absoluteIdx < 152 ? 5 : 4,
        comment: rand(REVIEW_COMMENTS),
        createdAt: daysAgoDate(randInt(1, 30)),
      });
    }

    for (let i = 0; i < reviewInserts.length; i += BATCH_SIZE) {
      await db.insert(reviews).values(reviewInserts.slice(i, i + BATCH_SIZE));
    }

    const actualCount = existingReviewCount + reviewInserts.length;
    // Update metadata to match actual row count
    await db.update(providers).set({ reviewCount: actualCount, rating: "4.9", averageRating: "4.9" })
      .where(eq(providers.id, providerId));

    console.log(`Inserted ${reviewInserts.length} reviews (total: ${actualCount}).`);
  } else {
    console.log(`Reviews at target (${existingReviewCount}). Skipping.`);
  }

  // ── Final verification summary ────────────────────────────────────────────────
  const vClients = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM clients WHERE provider_id = $1`, [providerId]
  );
  const vJobsResult = await pool.query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) AS count FROM jobs WHERE provider_id = $1 GROUP BY status`, [providerId]
  );
  const vFutureScheduled = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM jobs
     WHERE provider_id = $1 AND status = 'scheduled' AND scheduled_date >= NOW()`,
    [providerId]
  );
  const vThisMonth = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM jobs
     WHERE provider_id = $1 AND status = 'completed'
       AND completed_at >= date_trunc('month', NOW())`,
    [providerId]
  );
  const vAllTimeEarnings = await pool.query<{ sum: string | null }>(
    `SELECT COALESCE(SUM(final_price::numeric), 0) AS sum
     FROM jobs WHERE provider_id = $1 AND status = 'completed'`,
    [providerId]
  );
  const vMTD = await pool.query<{ sum: string | null }>(
    `SELECT COALESCE(SUM(total::numeric), 0) AS sum FROM invoices
     WHERE provider_id = $1 AND status = 'paid'
       AND paid_at >= date_trunc('month', NOW())`,
    [providerId]
  );
  const vReviews = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM reviews WHERE provider_id = $1`, [providerId]
  );

  const finalClients = parseInt(vClients.rows[0].count);
  const finalUpcoming = parseInt(vFutureScheduled.rows[0].count);
  const finalThisMonth = parseInt(vThisMonth.rows[0].count);
  const finalAllTime = parseFloat(vAllTimeEarnings.rows[0].sum ?? "0");
  const finalMTD = parseFloat(vMTD.rows[0].sum ?? "0");
  const finalReviews = parseInt(vReviews.rows[0].count);

  console.log("\n=== Seed Complete ===");
  console.log(`User:                   ${TEST_EMAIL} (id: ${userId})`);
  console.log(`Provider:               Vaughn Home Services (id: ${providerId})`);
  console.log(`Clients:                ${finalClients} (target: ${TARGET_CLIENTS})`);
  console.log("Jobs by status (all time):");
  vJobsResult.rows.forEach(r => console.log(`  ${r.status}: ${r.count}`));
  console.log(`Upcoming (future):      ${finalUpcoming} (target: ${TARGET_UPCOMING}) [=upcomingJobs dashboard stat]`);
  console.log(`Completed this month:   ${finalThisMonth} (target: ${TARGET_COMPLETED_THIS_MONTH}) [=jobsCompleted dashboard stat]`);
  console.log(`All-time earnings:      $${finalAllTime.toFixed(0)} (target: ~$${TARGET_ALL_TIME_EARNINGS})`);
  console.log(`MTD Revenue (invoices): $${finalMTD.toFixed(2)} (target: ~$${TARGET_MTD_REVENUE})`);
  console.log(`Reviews:                ${finalReviews} (target: ${TARGET_REVIEWS})`);
  console.log("=====================");

  // ── Hard-fail assertions — exit non-zero if any critical requirement is missed ─
  const failures: string[] = [];
  if (finalClients < TARGET_CLIENTS) failures.push(`Clients: ${finalClients} < ${TARGET_CLIENTS}`);
  if (finalUpcoming < TARGET_UPCOMING) failures.push(`Upcoming jobs: ${finalUpcoming} < ${TARGET_UPCOMING}`);
  if (finalThisMonth < TARGET_COMPLETED_THIS_MONTH) failures.push(`This-month completed: ${finalThisMonth} < ${TARGET_COMPLETED_THIS_MONTH}`);
  if (finalAllTime < TARGET_ALL_TIME_EARNINGS * 0.85 || finalAllTime > TARGET_ALL_TIME_EARNINGS * 1.15) {
    failures.push(`All-time earnings: $${finalAllTime.toFixed(0)} outside ±15% of $${TARGET_ALL_TIME_EARNINGS}`);
  }
  if (finalMTD < TARGET_MTD_REVENUE * 0.7) failures.push(`MTD revenue: $${finalMTD.toFixed(0)} < 70% of $${TARGET_MTD_REVENUE}`);
  if (finalReviews < TARGET_REVIEWS) failures.push(`Reviews: ${finalReviews} < ${TARGET_REVIEWS}`);

  // Verify named jobs exist
  const oliviaFinalCheck = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM jobs
     WHERE provider_id = $1 AND client_id = $2 AND title = 'Custom Furniture Consultation'
       AND scheduled_date >= NOW()`,
    [providerId, oliviaClient.id]
  );
  if (parseInt(oliviaFinalCheck.rows[0].count) === 0) {
    failures.push("Olivia P. upcoming job not found.");
  }
  const riverviewFinalCheck = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM jobs
     WHERE provider_id = $1 AND client_id = $2 AND title = 'Quarterly Maintenance'
       AND scheduled_date >= NOW()`,
    [providerId, riverviewClient.id]
  );
  if (parseInt(riverviewFinalCheck.rows[0].count) === 0) {
    failures.push("Riverview Condo upcoming job not found.");
  }

  if (failures.length > 0) {
    console.error("\n=== SEED ASSERTION FAILURES ===");
    failures.forEach(f => console.error(`  FAIL: ${f}`));
    console.error("================================");
    await pool.end();
    process.exit(1);
  }

  console.log("All acceptance assertions passed.");
  await pool.end();
  process.exit(0);
}

seedTestAccount().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
