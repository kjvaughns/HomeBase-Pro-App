import type { Express, Request, Response, RequestHandler } from "express";
import { createServer, type Server } from "node:http";
import * as fs from "fs";
import * as path from "path";
import { hash as bcryptHash, compare as bcryptCompare } from "bcryptjs";
import {
  openai,
  HOMEBASE_SYSTEM_PROMPT,
  PROVIDER_ASSISTANT_PROMPT,
  SUPPORT_AI_SYSTEM_PROMPT,
} from "../openai";
import { storage } from "../storage";
import { seedDatabase } from "../seed";
import { runBootMigrations } from "../dbMigrations";
import {
  formatJobSummary,
  parseIntakeAnswers,
  parseIntakeQuestions,
} from "@workspace/db";
import {
  insertUserSchema,
  loginSchema,
  insertHomeSchema,
  insertAppointmentSchema,
  insertProviderSchema,
  insertClientSchema,
  insertJobSchema,
  insertCrewMemberSchema,
  insertInvoiceSchema,
  insertEstimateSchema,
  estimates as estimatesTbl,
  estimateLineItems as estimateLineItemsTbl,
  insertPaymentSchema,
  appointments,
  crewMembers,
  maintenanceReminders,
  homes,
  reviews,
  type Provider,
} from "@workspace/db";
import { stripeService } from "../stripeService";
import { getStripePublishableKey } from "../stripeClient";
import { db, pool } from "../db";
import { sql, eq, and, or, desc, asc, inArray, notInArray, gte, lte as lteOp, lt, ilike, isNull } from "drizzle-orm";
import {
  sendInvoiceEmail,
  sendProviderClientMessage,
  sendSupportTicketEmail,
  sendInvoiceReminderEmail,
  sendProviderScheduledJobEmail,
  sendAdminSupportReplyEmail,
  sendAiSupportReplyEmail,
  sendAdminBroadcastEmail,
} from "../emailService";
import {
  dispatch,
  dispatchWithResult,
  dispatchNotification,
  sendPush,
  sendReviewNudge,
} from "../notificationService";
import { haversineMiles } from "../lib/distance";
import {
  generateUniqueReferralCode,
  linkReferral,
  getReferralStats,
  grantReferralCreditsIfFirstBooking,
} from "../referralService";
import {
  grantFirstBookingCredit,
  grantReviewCredit,
  checkAndGrantServiceCategoryMilestone,
  formatLedgerEntry,
} from "../loyaltyService";
import {
  searchPlaces,
  getPlaceDetails,
  geocodeAddress,
  fetchZillowPropertyData,
  enrichPropertyData,
  buildHouseFaxContext,
} from "../housefaxService";
import { buildTrackingPageHtml } from "../trackingPage";
import {
  updateHomeWithChangeLog,
  getHomeFieldChanges,
} from "../homeProfileService";
import {
  createConnectAccountLink,
  refreshConnectAccountLink,
  getConnectStatus,
  isProviderReadyForCharges,
  reonboardConnectAccount,
  getConnectAccount,
  createInvoicePaymentIntent,
  createStripeCheckoutSession,
  attemptNoShowFeeCharge,
  createStripeInvoice,
  sendStripeInvoiceEmail,
  resendStripeInvoice,
  createDirectCheckoutSession,
  applyCreditsToInvoice,
  calculateFeePreview,
  getProviderPlan,
  calculatePlatformFee,
  calculateStripePassthroughFee,
  getStripe,
  createSubscriptionCheckoutSession,
  createSubscriptionPortalSession,
  createDepositCheckoutSession,
  createCancellationFeeCheckoutSession,
} from "../stripeConnectService";
import {
  normalizeBookingPolicy,
  computeDepositCents,
  computeCancellationFee,
  checkRescheduleAllowed,
  dollarsToCents,
  summarizePolicy,
  combineDateAndTime,
} from "@workspace/db";
import {
  checkSubscriptionGate,
  getProviderSubscriptionStatus,
  maybeStartGracePeriod,
  extendSubscriptionByDays,
  sendReferralRewardNotification,
  sendCrewLaunchedNotification,
} from "../subscriptionService";
import {
  invoices,
  invoiceLineItems,
  providerPlans,
  stripeConnectAccounts,
  userCredits,
  creditLedger,
  payments,
  payouts,
  providerCustomServices,
  insertProviderCustomServiceSchema,
  users,
  clients,
  jobs,
  bookingLinks,
  leads,
  intakeSubmissions,
  notifications,
  providerServices,
  services,
  providers,
  providerMessages,
  messageTemplates,
  type Job,
  pushTokens,
  notificationPreferences,
  housefaxEntries,
  quickQuotes,
  supportTickets,
  supportTicketMessages,
  adminAuditLogs,
  adminBroadcasts,
  adminBroadcastRecipients,
  savedProviders,
  reviewReports,
  homeProfileUpdateSchema,
  jobSeries,
  providerReferrals,
  providerBadges,
  crewTimeEntries,
  jobPhotoPairs,
} from "@workspace/db";
import {
  createSeriesForJob,
  cancelSeries as cancelSeriesService,
  pauseSeries as pauseSeriesService,
  resumeSeries as resumeSeriesService,
  applyToFollowing as applyToFollowingService,
  isSupportedFrequency,
} from "../recurringJobsService";
import { checkAndAwardMilestones } from "../milestoneService";
import { updateProviderStreak, effectiveStreak } from "../streakService";
import { getProviderFeed, dismissFeedCard } from "../feedService";
import { computeHomeHealth } from "../homeHealthService";
import {
  buildRoute,
  geocodeJobs,
  type JobInput,
  type RoutePoint,
} from "../routeOptimizationService";
import {
  computeQuoteRange,
  generatePricingInsight,
  type CustomServiceLite,
} from "../quickQuoteService";

import { generateToken, authenticateJWT } from "../auth";
const BCRYPT_SALT_ROUNDS = 10;

interface IdParams {
  id: string;
}
interface UserIdParams {
  userId: string;
}
interface ProviderIdParams {
  providerId: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

declare module "express-serve-static-core" {
  interface Request {
    authenticatedUserId?: string;
  }
}

const requireAuth: RequestHandler = authenticateJWT;

/**
 * Admin gate (Task #220). DB-backed: checks `users.is_admin` first so the
 * signed-in account can be promoted in-app/by ops without an env redeploy.
 * Falls back to the legacy ADMIN_EMAILS env list for backward compatibility
 * with existing deployments.
 */
const requireAdmin: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.authenticatedUserId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(403).json({ error: "Admin access required" });
    if ((user as { isAdmin?: boolean | null }).isAdmin === true) {
      return next();
    }
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const email = user.email?.toLowerCase();
    if (email && adminEmails.includes(email)) {
      return next();
    }
    return res.status(403).json({ error: "Admin access required" });
  } catch (err) {
    console.error("[admin] requireAdmin error:", err);
    res.status(500).json({ error: "Failed to verify admin access" });
  }
};

const aiRateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Task #352 — Generate a collision-safe referral code.
 * Format: 8 chars from [A-Z0-9] (36^8 ≈ 2.8 trillion combinations).
 * Callers should verify uniqueness in the DB and retry on collision.
 */
function generateReferralCode(): string {
  const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars (no 0/O/I/1 ambiguity)
  const bytes = require("crypto").randomBytes(8) as Buffer;
  return Array.from(bytes)
    .map((b: number) => CHARS[b % CHARS.length])
    .join("");
}

/**
 * Task #352 — Generate a unique PROVIDER referral code with DB collision retry.
 * Checks uniqueness against the providers table.
 * Tries up to `maxAttempts` times before throwing.
 */
async function generateUniqueProviderReferralCode(maxAttempts = 5): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateReferralCode();
    const [existing] = await db
      .select({ id: providers.id })
      .from(providers)
      .where(eq(providers.referralCode, code))
      .limit(1);
    if (!existing) return code;
  }
  throw new Error("generateUniqueProviderReferralCode: max attempts exceeded");
}

const REVENUE_MILESTONES = [
  10000, 25000, 50000, 100000, 150000, 200000, 300000, 500000,
];

async function fireInsightNotifications(
  userId: string,
  insights: {
    allTimeRevenue: number;
    clientGrowthPct: number;
    rating: string;
    reviewCount: number;
  },
) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const topMilestone = REVENUE_MILESTONES.slice()
    .reverse()
    .find((m) => insights.allTimeRevenue >= m);
  if (topMilestone) {
    const milestoneType = `revenue_milestone_${topMilestone}`;
    const [existing] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, milestoneType),
          gte(notifications.createdAt, thirtyDaysAgo),
        ),
      )
      .limit(1);
    if (!existing) {
      await dispatchNotification(
        userId,
        "Revenue Milestone Reached",
        `You've earned $${(topMilestone / 1000).toFixed(0)}K all-time — incredible work!`,
        milestoneType,
        {},
        "updates" as any,
      );
    }
  }

  if (insights.clientGrowthPct >= 10) {
    const [existing] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, "quarterly_client_growth"),
          gte(notifications.createdAt, thirtyDaysAgo),
        ),
      )
      .limit(1);
    if (!existing) {
      await dispatchNotification(
        userId,
        "Client Growth Surge",
        `Your client base grew ${insights.clientGrowthPct}% this quarter — great momentum!`,
        "quarterly_client_growth",
        {},
        "updates" as any,
      );
    }
  }

  if (parseFloat(insights.rating) >= 4.8 && insights.reviewCount >= 10) {
    const [existing] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, "top_rated_achievement"),
          gte(notifications.createdAt, thirtyDaysAgo),
        ),
      )
      .limit(1);
    if (!existing) {
      await dispatchNotification(
        userId,
        "Top Rated Provider",
        `${insights.rating} stars from ${insights.reviewCount} reviews — you're among the best!`,
        "top_rated_achievement",
        {},
        "updates" as any,
      );
    }
  }
}

const aiRateLimit: RequestHandler = (req, res, next) => {
  const userId = req.authenticatedUserId!;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = 20;

  const entry = aiRateLimitMap.get(userId);
  if (!entry || entry.resetAt < now) {
    aiRateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }

  if (entry.count >= limit) {
    res.status(429).json({
      error: "Too many AI requests. Please wait a minute and try again.",
    });
    return;
  }

  entry.count += 1;
  next();
};

const onboardingRateLimitMap = new Map<
  string,
  { count: number; resetAt: number }
>();

// IP-based rate limiter factory for unauthenticated abuse-prone endpoints
// (forgot-password, support/ticket). Uses req.socket.remoteAddress only —
// X-Forwarded-For is intentionally ignored because clients can spoof it to
// bypass per-IP limits. Each endpoint gets its own bucket so they don't
// interfere with each other.
function createIpRateLimit(opts: {
  bucket: Map<string, { count: number; resetAt: number }>;
  windowMs: number;
  limit: number;
  message?: string;
}): RequestHandler {
  return (req, res, next) => {
    const ip = req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const entry = opts.bucket.get(ip);
    if (!entry || entry.resetAt < now) {
      opts.bucket.set(ip, { count: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }
    if (entry.count >= opts.limit) {
      res.status(429).json({
        error:
          opts.message ||
          "Too many requests. Please wait a few minutes and try again.",
      });
      return;
    }
    entry.count += 1;
    next();
  };
}

const forgotPasswordRateLimitMap = new Map<
  string,
  { count: number; resetAt: number }
>();
const forgotPasswordRateLimit = createIpRateLimit({
  bucket: forgotPasswordRateLimitMap,
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  message:
    "Too many password reset requests. Please wait an hour and try again.",
});

const supportTicketRateLimitMap = new Map<
  string,
  { count: number; resetAt: number }
>();
const supportTicketRateLimit = createIpRateLimit({
  bucket: supportTicketRateLimitMap,
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  message:
    "Too many support requests. Please wait an hour and try again.",
});

// Task #487: iOS WidgetKit extensions poll this on their own timeline
// schedule (roughly every 15-30 min per iOS's budget), so allow a generous
// per-IP ceiling while still bounding abuse of the token-guessing surface.
const widgetSnapshotRateLimitMap = new Map<
  string,
  { count: number; resetAt: number }
>();
const widgetSnapshotRateLimit = createIpRateLimit({
  bucket: widgetSnapshotRateLimitMap,
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30,
  message: "Too many widget refresh requests. Please try again shortly.",
});

const publicBookingRateLimitMap = new Map<
  string,
  { count: number; resetAt: number }
>();
const publicBookingRateLimit = createIpRateLimit({
  bucket: publicBookingRateLimitMap,
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10,
  message:
    "Too many booking submissions. Please wait an hour and try again.",
});

const onboardingRateLimit: RequestHandler = (req, res, next) => {
  // Use only the socket address — X-Forwarded-For is spoofable and must not
  // be trusted for rate-limit keying on unauthenticated public routes.
  const ip = req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const limit = 30;

  const entry = onboardingRateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    onboardingRateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }

  if (entry.count >= limit) {
    res.status(429).json({ error: "Too many requests. Please slow down." });
    return;
  }

  entry.count += 1;
  next();
};

function formatUserResponse(user: {
  firstName?: string | null;
  lastName?: string | null;
  [key: string]: unknown;
}) {
  const { firstName, lastName, password, ...rest } = user;
  const name = [firstName, lastName].filter(Boolean).join(" ") || null;
  return { ...rest, name };
}

function parseUserName(name?: string): {
  firstName?: string;
  lastName?: string;
} {
  if (!name) return {};
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

/**
 * Serialize a provider row for client consumption: tolerantly parse jsonb
 * columns whether the driver returns strings or already-parsed objects
 * (no double-parse). `capabilityTags` is always an array; the optional
 * service-area arrays are normalized to arrays when present and left null
 * when absent (Business Hub treats null as "not configured").
 */
function normalizeProviderForResponse(provider: Provider) {
  const tolerantParse = (value: unknown): unknown => {
    if (value == null) return null;
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };
  return {
    ...provider,
    bookingPolicies: tolerantParse(provider.bookingPolicies) ?? null,
    businessHours: tolerantParse(provider.businessHours) ?? null,
    capabilityTags: Array.isArray(provider.capabilityTags)
      ? provider.capabilityTags
      : [],
    serviceZipCodes: Array.isArray(provider.serviceZipCodes)
      ? provider.serviceZipCodes
      : null,
    serviceCities: Array.isArray(provider.serviceCities)
      ? provider.serviceCities
      : null,
  };
}

function formatHomeResponse(home: {
  label: string;
  street: string;
  zip: string;
  [key: string]: unknown;
}) {
  const { label, street, zip, ...rest } = home;
  return {
    ...rest,
    label,
    street,
    zip,
    nickname: label,
    address: street,
    zipCode: zip,
  };
}

/**
 * Shared conversion helper — upsert client, create job, and mark intake submission as converted.
 * Used by both the manual accept endpoint and the instant booking flow.
 */
async function convertIntakeToClientJob(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: {
    submissionId: string;
    providerId: string;
    clientName: string;
    clientEmail: string | null | undefined;
    clientPhone: string | null | undefined;
    address: string | null | undefined;
    problemDescription: string | null | undefined;
    scheduledDate?: Date;
    scheduledTime?: string | null;
    estimatedPrice?: string | null;
    notes?: string | null;
    targetStatus?: "converted" | "confirmed";
    appointmentId?: string | null;
    serviceName?: string | null;
    /** Raw intake answers map (q.id → answer) so the job description can
     * include the configured intake questions, matching the in-app flows. */
    intakeAnswers?: unknown;
    /** Optional intake question definitions for resolving labels. */
    intakeQuestionsJson?: string | null;
  },
): Promise<{ clientId: string; job: typeof jobs.$inferSelect }> {
  const {
    submissionId,
    providerId,
    clientName,
    clientEmail,
    clientPhone,
    address,
    problemDescription,
    scheduledDate,
    scheduledTime,
    estimatedPrice,
    notes,
    targetStatus = "converted",
    appointmentId,
    serviceName,
    intakeAnswers,
    intakeQuestionsJson,
  } = params;

  const nameParts = (clientName || "").trim().split(" ");
  const firstName = nameParts[0] || "Unknown";
  const lastName = nameParts.slice(1).join(" ") || "";

  // Match an existing client by (provider, email) first, then fall back to
  // (provider, phone) so repeat marketplace bookings from the same household
  // — even if they leave email blank but reuse a phone number — link to the
  // existing client record instead of creating a duplicate.
  let clientId: string;
  if (clientEmail) {
    // Upsert by provider+email using ON CONFLICT (race-safe via partial unique index).
    const result = await tx.execute(sql`
      INSERT INTO clients (id, provider_id, first_name, last_name, email, phone, address, created_at, updated_at)
      VALUES (gen_random_uuid(), ${providerId}, ${firstName}, ${lastName || null}, ${clientEmail}, ${clientPhone || null}, ${address || null}, NOW(), NOW())
      ON CONFLICT (provider_id, email) WHERE email IS NOT NULL
      DO UPDATE SET
        phone = COALESCE(EXCLUDED.phone, clients.phone),
        address = COALESCE(EXCLUDED.address, clients.address),
        updated_at = NOW()
      RETURNING id
    `);
    clientId = (result.rows[0] as { id: string }).id;
  } else if (clientPhone) {
    // Fall back to provider+phone match.
    const existing = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(eq(clients.providerId, providerId), eq(clients.phone, clientPhone)),
      )
      .limit(1);
    if (existing.length > 0) {
      clientId = existing[0].id;
      await tx
        .update(clients)
        .set({ address: address || undefined, updatedAt: new Date() })
        .where(eq(clients.id, clientId));
    } else {
      const [newC] = await tx
        .insert(clients)
        .values({
          providerId,
          firstName,
          lastName: lastName || null,
          email: null,
          phone: clientPhone,
          address: address || null,
        })
        .returning({ id: clients.id });
      clientId = newC.id;
    }
  } else {
    // No identifier at all — cannot dedup; insert a fresh record.
    const [newC] = await tx
      .insert(clients)
      .values({
        providerId,
        firstName,
        lastName: lastName || null,
        email: null,
        phone: null,
        address: address || null,
      })
      .returning({ id: clients.id });
    clientId = newC.id;
  }

  // Create job (linked to appointment when provided, matching portal flow).
  // Description is composed via the shared formatter so it has the same shape
  // regardless of which entry point produced the underlying intake submission.
  const jobDate = scheduledDate ?? new Date();
  const composedDescription = formatJobSummary({
    serviceName: serviceName ?? null,
    problemDescription: problemDescription ?? null,
    intakeAnswers: parseIntakeAnswers(intakeAnswers),
    intakeQuestions: parseIntakeQuestions(intakeQuestionsJson),
  });
  const [newJob] = await tx
    .insert(jobs)
    .values({
      providerId,
      clientId,
      appointmentId: appointmentId || null,
      title:
        serviceName || problemDescription?.slice(0, 100) || "Service Request",
      description: composedDescription || problemDescription || null,
      scheduledDate: jobDate,
      scheduledTime: scheduledTime || null,
      status: "scheduled",
      address: address || null,
      estimatedPrice: estimatedPrice || null,
      notes: notes || null,
      checklist: [],
    })
    .returning();

  // Mark submission with full conversion fields
  const now = new Date();
  await tx
    .update(intakeSubmissions)
    .set({
      status: targetStatus,
      convertedClientId: clientId,
      convertedJobId: newJob.id,
      convertedAt: now,
      updatedAt: now,
    })
    .where(eq(intakeSubmissions.id, submissionId));

  return { clientId, job: newJob };
}

/**
 * Shared marketplace booking handler.
 *
 * Used by both the public `/api/providers/:slug/submit` and `/api/booking/:slug`
 * endpoints so a marketplace booking always: writes an intake submission,
 * upserts a lead, dispatches notifications to both sides, and (when the
 * provider has instant booking enabled) creates the client + job atomically
 * — matching the homeowner portal's `/api/appointments` automations.
 */
async function handleMarketplaceBooking(params: {
  slug: string;
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  address?: string | null;
  problemDescription: string;
  answersJson?: unknown;
  photosJson?: unknown;
  preferredTimesJson?: unknown;
  categoryId?: string | null;
  homeownerUserId?: string | null;
}): Promise<
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      submission: typeof intakeSubmissions.$inferSelect;
      clientId?: string;
      job?: typeof jobs.$inferSelect;
      appointmentId?: string;
      instantBooking: boolean;
    }
> {
  const {
    slug,
    clientName,
    clientPhone,
    clientEmail,
    address,
    problemDescription,
    answersJson,
    photosJson,
    preferredTimesJson,
    categoryId,
    homeownerUserId,
  } = params;

  if (!clientName || !problemDescription) {
    return {
      ok: false,
      status: 400,
      error: "Name and problem description are required",
    };
  }

  const [link] = await db
    .select()
    .from(bookingLinks)
    .where(eq(bookingLinks.slug, slug))
    .limit(1);
  if (!link || link.isActive === false || link.status !== "active") {
    return { ok: false, status: 404, error: "Booking page not found" };
  }

  // Mirror SSR/list gating: don't accept submissions for unpublished or
  // not-yet-Stripe-ready providers — they can't be paid, so they can't
  // accept bookings.
  const [bookingProvider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, link.providerId))
    .limit(1);
  if (!bookingProvider || bookingProvider.isPublic !== true) {
    return { ok: false, status: 404, error: "Booking page not found" };
  }
  const providerStripeReady = await isProviderReadyForCharges(link.providerId);
  if (!providerStripeReady) {
    return { ok: false, status: 404, error: "Booking page not found" };
  }

  const isInstant = link.instantBooking === true;

  // Resolve preferred date/time once, used for both job creation and notifications.
  // Tolerate either an array or a JSON-encoded string from the client.
  let preferredTimes: string[] = [];
  let parsedPreferred: unknown = preferredTimesJson;
  if (typeof parsedPreferred === "string") {
    try {
      parsedPreferred = JSON.parse(parsedPreferred);
    } catch {
      /* leave as-is */
    }
  }
  if (Array.isArray(parsedPreferred)) {
    preferredTimes = (parsedPreferred as unknown[]).filter(
      (s): s is string => typeof s === "string",
    );
  }
  const firstPreferredDate = preferredTimes[0]
    ? new Date(preferredTimes[0])
    : undefined;
  const validPreferredDate =
    firstPreferredDate && !isNaN(firstPreferredDate.getTime())
      ? firstPreferredDate
      : undefined;

  // Persist submission (+ appointment/client/job when instant) atomically
  let submission!: typeof intakeSubmissions.$inferSelect;
  let clientId: string | undefined;
  let job: typeof jobs.$inferSelect | undefined;
  let appointmentId: string | undefined;

  await db.transaction(async (tx) => {
    const [sub] = await tx
      .insert(intakeSubmissions)
      .values({
        bookingLinkId: link.id,
        providerId: link.providerId,
        homeownerUserId: homeownerUserId || null,
        clientName,
        clientPhone: clientPhone || null,
        clientEmail: clientEmail || null,
        address: address || null,
        problemDescription,
        categoryId: categoryId || null,
        answersJson:
          answersJson != null
            ? typeof answersJson === "string"
              ? answersJson
              : JSON.stringify(answersJson)
            : null,
        photosJson:
          photosJson != null
            ? typeof photosJson === "string"
              ? photosJson
              : JSON.stringify(photosJson)
            : null,
        preferredTimesJson:
          preferredTimesJson != null
            ? typeof preferredTimesJson === "string"
              ? preferredTimesJson
              : JSON.stringify(preferredTimesJson)
            : null,
        status: isInstant ? ("confirmed" as const) : ("submitted" as const),
      })
      .returning();
    submission = sub;

    // Upsert lead (dedup by provider+email; only one open lead per email)
    if (clientEmail) {
      const existing = await tx
        .select({ id: leads.id })
        .from(leads)
        .where(
          and(
            eq(leads.providerId, link.providerId),
            eq(leads.email, clientEmail),
          ),
        )
        .limit(1);
      if (existing.length === 0) {
        await tx.insert(leads).values({
          providerId: link.providerId,
          name: clientName,
          email: clientEmail,
          phone: clientPhone || null,
          service: null,
          message: problemDescription,
          status: isInstant ? "won" : "new",
          source: "booking_page",
        });
      } else if (isInstant) {
        await tx
          .update(leads)
          .set({ status: "won", updatedAt: new Date() })
          .where(eq(leads.id, existing[0].id));
      }
    } else {
      await tx.insert(leads).values({
        providerId: link.providerId,
        name: clientName,
        email: null,
        phone: clientPhone || null,
        service: null,
        message: problemDescription,
        status: isInstant ? "won" : "new",
        source: "booking_page",
      });
    }

    // Instant booking: create appointment + client + job (matching portal flow)
    if (isInstant) {
      const apptDate = validPreferredDate ?? new Date();
      // Task #226: race-safe insert. The new unique partial index would
      // otherwise turn a duplicate-tap into a 500. Mirror the same
      // pre-check + onConflictDoNothing + reselect pattern used by
      // storage.createAppointment, scoped to this transaction.
      let appt: { id: string } | undefined;
      if (homeownerUserId) {
        const [pre] = await tx
          .select({ id: appointments.id })
          .from(appointments)
          .where(
            and(
              eq(appointments.userId, homeownerUserId),
              eq(appointments.providerId, link.providerId),
              eq(appointments.scheduledDate, apptDate),
            ),
          )
          .limit(1);
        if (pre) appt = pre;
      }
      if (!appt) {
        const inserted = await tx
          .insert(appointments)
          .values({
            userId: homeownerUserId || null,
            providerId: link.providerId,
            serviceName: link.customTitle ?? "Home Service",
            description: problemDescription,
            scheduledDate: apptDate,
            status: "confirmed",
          })
          .onConflictDoNothing()
          .returning({ id: appointments.id });
        if (inserted[0]) {
          appt = inserted[0];
        } else if (homeownerUserId) {
          // Conflict raced past the pre-check — re-select the winner.
          const [winner] = await tx
            .select({ id: appointments.id })
            .from(appointments)
            .where(
              and(
                eq(appointments.userId, homeownerUserId),
                eq(appointments.providerId, link.providerId),
                eq(appointments.scheduledDate, apptDate),
              ),
            )
            .limit(1);
          appt = winner;
        }
        if (!appt) {
          throw new Error("public booking: appointment insert produced no row");
        }
      }

      const converted = await convertIntakeToClientJob(tx, {
        submissionId: sub.id,
        providerId: link.providerId,
        clientName,
        clientEmail,
        clientPhone,
        address,
        problemDescription,
        scheduledDate: validPreferredDate,
        targetStatus: "confirmed",
        appointmentId: appt.id,
        serviceName: link.customTitle ?? null,
        intakeAnswers: answersJson,
        intakeQuestionsJson: link.intakeQuestions,
      });
      clientId = converted.clientId;
      job = converted.job;
      appointmentId = appt.id;
    }
  });

  // ── Notifications (fire-and-forget) ───────────────────────────────────────
  // Provider: in-app notification + push (always); email handled per-mode below
  const [providerRow] = await db
    .select({
      userId: providers.userId,
      businessName: providers.businessName,
      email: providers.email,
    })
    .from(providers)
    .where(eq(providers.id, link.providerId))
    .limit(1);

  const providerName =
    providerRow?.businessName ?? link.customTitle ?? "Your Provider";
  const bookingLinkName = link.customTitle ?? providerName;
  const preferredDateStr = validPreferredDate
    ? validPreferredDate.toLocaleDateString()
    : undefined;
  const preferredTimeStr = validPreferredDate
    ? validPreferredDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : undefined;

  if (providerRow?.userId) {
    const inAppTitle = isInstant
      ? "New Booking Confirmed"
      : "New Booking Request";
    const inAppMessage = isInstant
      ? `${clientName} booked ${link.customTitle ?? "a service"}. View details in Schedule.`
      : `${clientName} submitted a new booking request. Review it in Intake Submissions.`;
    dispatchNotification(
      providerRow.userId,
      inAppTitle,
      inAppMessage,
      isInstant ? "booking_confirmed" : "booking_request",
      {
        intakeSubmissionId: submission.id,
        clientName,
        ...(job ? { jobId: job.id } : {}),
        screen: isInstant ? "ProviderJobDetail" : "ProviderIntakeSubmissions",
      },
      "bookings",
    ).catch((e: unknown) =>
      console.error("provider in-app/push dispatch error:", e),
    );
  }

  if (isInstant) {
    // Match the portal flow: client confirmation + provider booking notification email
    if (clientEmail || providerRow?.email) {
      dispatch("booking.created", {
        clientEmail: clientEmail || undefined,
        clientName,
        providerEmail: providerRow?.email ?? undefined,
        providerName,
        providerUserId: providerRow?.userId ?? undefined,
        recipientUserId: homeownerUserId || undefined,
        serviceName: link.customTitle ?? "Home Service",
        appointmentDate: preferredDateStr ?? "To be confirmed",
        appointmentTime: preferredTimeStr ?? "",
        address: address || undefined,
        description: problemDescription,
        confirmationNumber: appointmentId ?? submission.id,
        relatedRecordType: appointmentId
          ? "appointment"
          : job
            ? "job"
            : "intake_submission",
        relatedRecordId: appointmentId ?? job?.id ?? submission.id,
      }).catch((e: unknown) =>
        console.error("booking.created dispatch error:", e),
      );
    }
  } else {
    // Request mode: notify provider of new lead, confirm receipt to homeowner
    if (providerRow?.email) {
      dispatch("booking.request_provider", {
        providerEmail: providerRow.email,
        providerName,
        providerUserId: providerRow.userId ?? undefined,
        clientName,
        clientEmail: clientEmail || undefined,
        clientPhone: clientPhone || undefined,
        address: address || undefined,
        problemDescription,
        bookingLinkName,
        relatedRecordType: "intake_submission",
        relatedRecordId: submission.id,
      }).catch((e: unknown) =>
        console.error("booking.request_provider dispatch error:", e),
      );
    }
    if (clientEmail) {
      dispatch("booking.request_received", {
        clientEmail,
        clientName,
        providerName,
        recipientUserId: homeownerUserId || undefined,
        serviceName: link.customTitle ?? undefined,
        preferredDate: preferredDateStr,
        preferredTime: preferredTimeStr,
        address: address || undefined,
        problemDescription,
        relatedRecordType: "intake_submission",
        relatedRecordId: submission.id,
      }).catch((e: unknown) =>
        console.error("booking.request_received dispatch error:", e),
      );
    }
  }

  return {
    ok: true,
    submission,
    clientId,
    job,
    appointmentId,
    instantBooking: isInstant,
  };
}

// ─── HouseFax Category Mapper ────────────────────────────────────────────────
function detectServiceCategory(title: string): string {
  const t = (title || "").toLowerCase();
  if (
    t.includes("hvac") ||
    t.includes("heat") ||
    t.includes("air") ||
    t.includes("furnace") ||
    t.includes("ac ") ||
    t.includes("cooling")
  )
    return "HVAC";
  if (
    t.includes("plumb") ||
    t.includes("pipe") ||
    t.includes("water") ||
    t.includes("drain") ||
    t.includes("toilet") ||
    t.includes("faucet")
  )
    return "Plumbing";
  if (
    t.includes("electr") ||
    t.includes("wiring") ||
    t.includes("outlet") ||
    t.includes("circuit")
  )
    return "Electrical";
  if (t.includes("roof") || t.includes("gutter") || t.includes("shingle"))
    return "Roof";
  if (
    t.includes("pest") ||
    t.includes("termite") ||
    t.includes("rodent") ||
    t.includes("insect")
  )
    return "Pest Control";
  if (
    t.includes("lawn") ||
    t.includes("garden") ||
    t.includes("landscap") ||
    t.includes("grass") ||
    t.includes("mow")
  )
    return "Lawn";
  if (t.includes("paint") || t.includes("coat")) return "Painting";
  if (t.includes("clean")) return "Cleaning";
  if (
    t.includes("appliance") ||
    t.includes("washer") ||
    t.includes("dryer") ||
    t.includes("dishwash") ||
    t.includes("refriger")
  )
    return "Appliances";
  return "General";
}

// Auto-log a HouseFax entry when a job completes
async function autoLogHouseFaxEntry(job: Job): Promise<void> {
  try {
    // Find the homeId via the appointment linked to this job, or via client's home
    let homeId: string | null = null;

    // Try job's appointmentId first
    if (job.appointmentId) {
      const [appt] = await db
        .select({ homeId: appointments.homeId })
        .from(appointments)
        .where(eq(appointments.id, job.appointmentId));
      if (appt) homeId = appt.homeId;
    }

    // Fall back: find homeId via the job's linked invoice (homeownerUserId -> homes)
    if (!homeId && job.id) {
      const [inv] = await db
        .select({ homeownerUserId: invoices.homeownerUserId })
        .from(invoices)
        .where(eq(invoices.jobId, job.id));
      if (inv?.homeownerUserId) {
        const [defaultHome] = await db
          .select({ id: homes.id })
          .from(homes)
          .where(
            and(
              eq(homes.userId, inv.homeownerUserId),
              eq(homes.isDefault, true),
            ),
          );
        if (defaultHome) homeId = defaultHome.id;
        else {
          const [anyHome] = await db
            .select({ id: homes.id })
            .from(homes)
            .where(eq(homes.userId, inv.homeownerUserId));
          if (anyHome) homeId = anyHome.id;
        }
      }
    }

    if (!homeId) {
      console.log(
        `[HouseFax] No home found for job ${job.id}, skipping auto-log`,
      );
      return;
    }

    // Check if entry already exists for this job
    const [existing] = await db
      .select({ id: housefaxEntries.id })
      .from(housefaxEntries)
      .where(eq(housefaxEntries.jobId, job.id));
    if (existing) {
      console.log(`[HouseFax] Entry already exists for job ${job.id}`);
      return;
    }

    // Get provider info
    const [provider] = job.providerId
      ? await db
          .select({ businessName: providers.businessName })
          .from(providers)
          .where(eq(providers.id, job.providerId))
      : [null];

    const serviceCategory = detectServiceCategory(job.title);
    const costCents = job.finalPrice
      ? Math.round(parseFloat(job.finalPrice) * 100)
      : 0;

    // Generate AI summary
    let aiSummary: string | null = null;
    try {
      const prompt = `Write a 1-2 sentence plain-English summary of this home service job for a homeowner's records:

Service: ${job.title}
Category: ${serviceCategory}
Description: ${job.description || "No additional details"}
Notes: ${job.notes || "None"}
Provider: ${provider?.businessName || "Unknown provider"}
Cost: ${costCents > 0 ? "$" + (costCents / 100).toFixed(2) : "Not specified"}

Be concise and factual. No bullet points. Just 1-2 sentences.`;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
      });
      aiSummary = aiResponse.choices[0]?.message?.content?.trim() || null;
    } catch (e) {
      console.error("[HouseFax] AI summary generation failed:", e);
    }

    await db.insert(housefaxEntries).values({
      homeId,
      jobId: job.id,
      appointmentId: job.appointmentId || null,
      serviceCategory,
      serviceName: job.title,
      providerId: job.providerId || null,
      providerName: provider?.businessName || null,
      completedAt: job.completedAt || new Date(),
      costCents,
      aiSummary,
      photos: [],
      systemAffected: serviceCategory,
      notes: job.notes || null,
    });

    console.log(
      `[HouseFax] Auto-logged entry for job ${job.id} (${job.title}) -> home ${homeId}`,
    );

    // Persist the updated score on write (not just on read)
    calculateAndPersistHouseFaxScore(homeId).catch((e: unknown) =>
      console.error("[HouseFax] Score persistence failed:", e),
    );
  } catch (error) {
    console.error("[HouseFax] Auto-log failed:", error);
    throw error;
  }
}

// Calculates health score from all housefax entries for a home and persists it
async function calculateAndPersistHouseFaxScore(
  homeId: string,
): Promise<number> {
  const KEY_SYSTEMS = [
    "HVAC",
    "Plumbing",
    "Electrical",
    "Roof",
    "Pest Control",
    "Lawn",
  ];
  const allEntries = await db
    .select()
    .from(housefaxEntries)
    .where(eq(housefaxEntries.homeId, homeId));

  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
  let score = 50;

  for (const sys of KEY_SYSTEMS) {
    const sysEntries = allEntries.filter((e) => {
      const s = (e.systemAffected || e.serviceCategory || "").toLowerCase();
      return s.includes(sys.toLowerCase().split(" ")[0]);
    });
    if (sysEntries.length > 0) {
      score += sysEntries.find((e) => e.completedAt >= oneYearAgo) ? 6 : 2;
    }
    if (sysEntries.length === 0) score -= 3;
    else if (!sysEntries.find((e) => e.completedAt >= twoYearsAgo)) score -= 2;
  }

  const withPhotos = allEntries.filter(
    (e) => Array.isArray(e.photos) && (e.photos as string[]).length > 0,
  ).length;
  const withSummaries = allEntries.filter((e) => e.aiSummary).length;
  score += Math.min(withPhotos * 2, 10);
  score += Math.min(withSummaries, 10);
  score = Math.max(0, Math.min(100, score));

  await storage.updateHome(homeId, { housefaxScore: score });
  return score;
}

// ─── Crew portal helpers (Task #328) ───────────────────────────────────────
// Module-scoped because both /login and /me need them, and they predate the
// registerRoutes closure. They use the singleton db import at the top of file.

type CrewMembership = {
  providerId: string;
  providerName: string;
  crewMemberId: string;
};

async function getCrewMembershipsForUser(
  userId: string,
): Promise<CrewMembership[]> {
  try {
    const rows = await db
      .select({
        crewMemberId: crewMembers.id,
        providerId: crewMembers.providerId,
        providerName: providers.businessName,
      })
      .from(crewMembers)
      .innerJoin(providers, eq(providers.id, crewMembers.providerId))
      .where(
        and(
          eq(crewMembers.invitedUserId, userId),
          eq(crewMembers.isActive, true),
        ),
      );
    return rows.map((r) => ({
      crewMemberId: r.crewMemberId,
      providerId: r.providerId,
      providerName: r.providerName ?? "Provider",
    }));
  } catch (e) {
    console.error("getCrewMembershipsForUser error:", e);
    return [];
  }
}

async function autoLinkCrewByEmail(
  userId: string,
  email: string,
): Promise<void> {
  if (!email) return;
  try {
    await db
      .update(crewMembers)
      .set({ invitedUserId: userId })
      .where(
        and(
          isNull(crewMembers.invitedUserId),
          sql`lower(${crewMembers.email}) = lower(${email})`,
        ),
      );
  } catch (e) {
    console.error("autoLinkCrewByEmail error:", e);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Run additive boot migrations on every startup (idempotent, IF NOT EXISTS).
  // Must run before seedDatabase so tables like admin_broadcasts exist.
  await runBootMigrations();

  // Only seed in development — never in production to prevent demo data leakage
  if (process.env.NODE_ENV !== "production") {
    await seedDatabase();
  }

  // Health check endpoint (no auth required — used by load balancers and verification scripts)
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const { name, referralCode: incomingReferralCode, ...restBody } = req.body;
      const nameFields = parseUserName(name);
      const userData = { ...restBody, ...nameFields };

      const parsed = insertUserSchema.safeParse(userData);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid input", details: parsed.error.issues });
      }

      const existing = await storage.getUserByEmail(parsed.data.email);
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }

      // Generate a unique referral code for this new homeowner
      const referralCode = await generateUniqueReferralCode();
      const user = await storage.createUser({ ...parsed.data, referralCode });
      const token = generateToken(
        user.id,
        user.isProvider ? "provider" : "homeowner",
        user.tokenVersion ?? 0,
      );
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.status(201).json({ user: formatUserResponse(user), token });

      // Link referrer if a referral code was supplied at signup
      if (incomingReferralCode && typeof incomingReferralCode === "string") {
        linkReferral(user.id, incomingReferralCode).catch((err: unknown) =>
          console.error("[SIGNUP] linkReferral failed:", err),
        );
      }

      // Welcome email — awaited with explicit failure logging (no silent discard)
      const fullName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
      dispatch("user.signup", {
        recipientUserId: user.id,
        recipientEmail: user.email,
        clientName: fullName,
      }).catch((emailErr: unknown) => {
        console.error(
          "[SIGNUP_EMAIL_FAILURE] Welcome email failed for user",
          user.id,
          ":",
          emailErr,
        );
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  // POST /api/provider/onboard-complete — atomic provider account creation
  // Creates user + provider profile + initial service in a single DB transaction.
  // Replaces the three-step client-driven signup/register/service flow that could leave
  // broken partial accounts on failure.
  app.post(
    "/api/provider/onboard-complete",
    async (req: Request, res: Response) => {
      try {
        const {
          name,
          email,
          password,
          phone,
          businessName,
          description,
          serviceArea,
          serviceZipCodes,
          serviceCities,
          serviceRadius,
          capabilityTags,
          businessHours,
          initialService,
          monthlyGoalCents,
        } = req.body;

        if (!email || !password || !businessName) {
          return res
            .status(400)
            .json({ error: "email, password, and businessName are required" });
        }

        // Pre-check duplicate email before entering transaction
        const existing = await storage.getUserByEmail(
          email.trim().toLowerCase(),
        );
        if (existing) {
          return res.status(409).json({ error: "Email already registered" });
        }

        const nameFields = parseUserName(name);
        const hashedPassword = await bcryptHash(password, BCRYPT_SALT_ROUNDS);

        // Atomic transaction: user + provider + service all-or-nothing
        const { user, provider, service } = await db.transaction(async (tx) => {
          // 1. Create user
          const [newUser] = await tx
            .insert(users)
            .values({
              ...nameFields,
              email: email.trim().toLowerCase(),
              password: hashedPassword,
              phone: phone?.trim() || null,
              isProvider: true,
            })
            .returning();

          // 2. Create provider profile
          // Default booking policy settings applied at creation so the provider
          // portal has sane defaults without requiring a separate settings step.
          const defaultBookingPolicies = {
            instantBooking: false,
            depositRequired: false,
            depositPercentage: 0,
            cancellationWindowHours: 24,
            advanceBookingDays: 60,
          };
          const parsedServiceZipCodes = Array.isArray(serviceZipCodes)
            ? serviceZipCodes
            : serviceZipCodes
              ? String(serviceZipCodes)
                  .split(",")
                  .map((s: string) => s.trim())
                  .filter(Boolean)
              : null;
          const parsedServiceCities = Array.isArray(serviceCities)
            ? serviceCities
            : serviceCities
              ? String(serviceCities)
                  .split(",")
                  .map((s: string) => s.trim())
                  .filter(Boolean)
              : null;
          const [newProvider] = await tx
            .insert(providers)
            .values({
              userId: newUser.id,
              businessName: businessName.trim(),
              description: description?.trim() || null,
              serviceArea: serviceArea?.trim() || null,
              serviceZipCodes: parsedServiceZipCodes,
              serviceCities: parsedServiceCities,
              serviceRadius: serviceRadius ? Number(serviceRadius) : null,
              capabilityTags: Array.isArray(capabilityTags)
                ? capabilityTags
                : [],
              businessHours: businessHours ?? null,
              bookingPolicies: defaultBookingPolicies,
              isActive: true, // schema-aligned: no "status" column in providers table
              isPublic: true, // make discoverable immediately post-onboarding
              email: email.trim().toLowerCase(),
              phone: phone?.trim() || null,
              monthlyGoalCents: typeof monthlyGoalCents === "number" && monthlyGoalCents > 0
                ? monthlyGoalCents
                : null,
            })
            .returning();

          // 3. Create initial service (if provided)
          let newService = null;
          if (initialService?.name?.trim()) {
            const [svc] = await tx
              .insert(providerCustomServices)
              .values({
                providerId: newProvider.id,
                name: initialService.name.trim(),
                category: initialService.category || "General",
                description: initialService.description?.trim() || null,
                pricingType: initialService.quoteRequired ? "quote" : "fixed",
                basePrice:
                  !initialService.quoteRequired && initialService.price
                    ? String(initialService.price)
                    : null,
                duration: initialService.duration || 60,
                isPublished: true,
              })
              .returning();
            newService = svc;
          }

          // 3b. Create a default booking link so the provider has a shareable
          //     URL the moment onboarding completes (Task #298).
          const slugBase = (businessName || "pro")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 40) || "pro";
          const slugSuffix = Math.random().toString(36).slice(2, 8);
          await tx.insert(bookingLinks).values({
            providerId: newProvider.id,
            slug: `${slugBase}-${slugSuffix}`,
            status: "active",
            isActive: true,
            instantBooking: false,
            showPricing: true,
          });

          // 4. Seed 5 default message templates so the provider has a starting
          //    point for client-facing comms (Settings → Message Templates).
          await tx.insert(messageTemplates).values([
            {
              providerId: newProvider.id,
              name: "Booking Confirmation",
              channel: "email",
              subject: "Your booking is confirmed",
              body: "Hi {{client_first_name}},\n\nThanks for booking {{service_name}} with {{business_name}}. We're confirmed for {{appointment_date}} at {{appointment_time}}.\n\nReply to this email if you need to make changes.\n\n— {{business_name}}",
            },
            {
              providerId: newProvider.id,
              name: "Reminder",
              channel: "sms",
              subject: null,
              body: "Hi {{client_first_name}}, this is a reminder of your {{service_name}} appointment with {{business_name}} on {{appointment_date}} at {{appointment_time}}. Reply if you need to reschedule.",
            },
            {
              providerId: newProvider.id,
              name: "Quote",
              channel: "email",
              subject: "Your quote from {{business_name}}",
              body: "Hi {{client_first_name}},\n\nThanks for your interest in {{service_name}}. Here is your quote:\n\n{{quote_details}}\n\nReply to this email to accept the quote or ask any questions.\n\n— {{business_name}}",
            },
            {
              providerId: newProvider.id,
              name: "Invoice",
              channel: "email",
              subject: "Your invoice from {{business_name}}",
              body: "Hi {{client_first_name}},\n\nAttached is your invoice for {{service_name}}. You can pay securely using the link in the email.\n\nThanks!\n— {{business_name}}",
            },
            {
              providerId: newProvider.id,
              name: "Review Request",
              channel: "email",
              subject: "How did we do?",
              body: "Hi {{client_first_name}},\n\nThanks for choosing {{business_name}} for your {{service_name}}. Would you mind taking a minute to leave us a review? It really helps.\n\n{{review_url}}\n\n— {{business_name}}",
            },
          ]);

          return { user: newUser, provider: newProvider, service: newService };
        });

        const token = generateToken(
          user.id,
          "provider",
          user.tokenVersion ?? 0,
        );
        res.cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(201).json({
          user: formatUserResponse(user),
          provider,
          service,
          token,
        });

        // Welcome email — awaited and explicitly logged on failure
        const fullName =
          [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
        dispatch("user.signup", {
          recipientUserId: user.id,
          recipientEmail: user.email,
          clientName: fullName,
        }).catch((emailErr: unknown) => {
          console.error(
            "[ONBOARD_EMAIL_FAILURE] Welcome email failed for user",
            user.id,
            ":",
            emailErr,
          );
        });
      } catch (error) {
        console.error("Provider onboard-complete error:", error);
        res.status(500).json({ error: "Failed to create provider account" });
      }
    },
  );

  // GET /api/provider/recap?month=YYYY-MM — monthly effort summary for the authenticated provider
  app.get(
    "/api/provider/recap",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const providerRow = await storage.getProviderByUserId(req.authenticatedUserId!);
        if (!providerRow) {
          res.status(404).json({ error: "Provider not found" });
          return;
        }

        const monthParam = String(req.query.month ?? "");
        if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
          res.status(400).json({ error: "month query param required in YYYY-MM format" });
          return;
        }

        const [yearStr, monthStr] = monthParam.split("-");
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        if (month < 1 || month > 12) {
          res.status(400).json({ error: "Invalid month value" });
          return;
        }

        const { getProviderRecap } = await import("../monthlyRecapService");
        const recap = await getProviderRecap(providerRow.id, year, month);
        res.json({ recap });
      } catch (error) {
        req.log.error({ error }, "GET /api/provider/recap error");
        res.status(500).json({ error: "Failed to load recap" });
      }
    },
  );

  // PATCH /api/provider/goal — set or update the authenticated provider's monthly earnings goal
  app.patch(
    "/api/provider/goal",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const providerRow = await storage.getProviderByUserId(req.authenticatedUserId!);
        if (!providerRow) {
          res.status(404).json({ error: "Provider not found" });
          return;
        }
        const { monthlyGoalCents } = req.body;
        if (
          monthlyGoalCents !== null &&
          (typeof monthlyGoalCents !== "number" || !Number.isInteger(monthlyGoalCents) || monthlyGoalCents < 0)
        ) {
          res.status(400).json({ error: "monthlyGoalCents must be a non-negative integer or null" });
          return;
        }
        await db
          .update(providers)
          .set({ monthlyGoalCents: monthlyGoalCents ?? null })
          .where(eq(providers.id, providerRow.id));
        res.json({ success: true, monthlyGoalCents: monthlyGoalCents ?? null });
      } catch (error) {
        req.log.error({ error }, "PATCH /api/provider/goal error");
        res.status(500).json({ error: "Failed to update monthly goal" });
      }
    },
  );

  // PATCH /api/provider/timezone — persist the device's IANA timezone so the
  // monthly recap scheduler can send pushes at 9am in the provider's local time.
  // Called once on login from the mobile app via Intl.DateTimeFormat().resolvedOptions().
  app.patch(
    "/api/provider/timezone",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const providerRow = await storage.getProviderByUserId(req.authenticatedUserId!);
        if (!providerRow) {
          res.status(404).json({ error: "Provider not found" });
          return;
        }
        const { timezone } = req.body;
        if (typeof timezone !== "string" || timezone.trim().length === 0) {
          res.status(400).json({ error: "timezone must be a non-empty IANA string" });
          return;
        }
        const trimmedTz = timezone.trim();
        // Validate via Intl — rejects any string that Node's ICU database
        // does not recognise as a valid IANA timezone identifier.
        try {
          Intl.DateTimeFormat(undefined, { timeZone: trimmedTz });
        } catch {
          res.status(400).json({ error: "timezone is not a recognised IANA identifier" });
          return;
        }
        await db
          .update(providers)
          .set({ timezone: trimmedTz })
          .where(eq(providers.id, providerRow.id));
        res.json({ success: true, timezone: trimmedTz });
      } catch (error) {
        req.log.error({ error }, "PATCH /api/provider/timezone error");
        res.status(500).json({ error: "Failed to update provider timezone" });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // Brute-force protection for login
  // Tracks failed attempts per IP (primary) and per email (secondary).
  // After LOGIN_MAX_FAILURES failures within LOGIN_WINDOW_MS the caller is
  // locked out for LOGIN_LOCKOUT_MS.
  // ---------------------------------------------------------------------------
  const LOGIN_MAX_FAILURES = 5;
  const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

  interface LoginAttemptRecord {
    count: number;
    firstAttemptAt: number;
    lockedUntil?: number;
  }

  const loginAttempts = new Map<string, LoginAttemptRecord>();

  function getLoginKey(req: Request, email: string): string[] {
    // req.ip is set by Express from X-Forwarded-For when trust proxy is enabled
    // (configured in index.ts), giving a reliable, non-spoofable value for the
    // first hop behind our known proxy.
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    return [`ip:${ip}`, `email:${email.trim().toLowerCase()}`];
  }

  function isLoginBlocked(keys: string[]): boolean {
    const now = Date.now();
    for (const key of keys) {
      const record = loginAttempts.get(key);
      if (!record) continue;
      if (record.lockedUntil && now < record.lockedUntil) return true;
      // Reset stale window
      if (now - record.firstAttemptAt > LOGIN_WINDOW_MS) {
        loginAttempts.delete(key);
      }
    }
    return false;
  }

  function recordLoginFailure(keys: string[]): void {
    const now = Date.now();
    for (const key of keys) {
      let record = loginAttempts.get(key);
      if (!record || now - record.firstAttemptAt > LOGIN_WINDOW_MS) {
        record = { count: 0, firstAttemptAt: now };
      }
      record.count += 1;
      if (record.count >= LOGIN_MAX_FAILURES) {
        record.lockedUntil = now + LOGIN_LOCKOUT_MS;
      }
      loginAttempts.set(key, record);
    }
  }

  function recordLoginSuccess(keys: string[]): void {
    for (const key of keys) loginAttempts.delete(key);
  }

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid credentials" });
      }

      const attemptKeys = getLoginKey(req, parsed.data.email);
      if (isLoginBlocked(attemptKeys)) {
        return res.status(429).json({
          error: "Too many failed login attempts. Please try again later.",
        });
      }

      const user = await storage.verifyPassword(
        parsed.data.email,
        parsed.data.password,
      );
      if (!user) {
        recordLoginFailure(attemptKeys);
        return res.status(401).json({ error: "Invalid email or password" });
      }

      recordLoginSuccess(attemptKeys);

      // Always try to fetch provider profile (authoritative source for role)
      let providerProfile = await storage.getProviderByUserId(user.id);

      // Bidirectional sync: keep isProvider flag consistent with provider record existence
      if (providerProfile && !user.isProvider) {
        await storage.updateUser(user.id, { isProvider: true });
        user.isProvider = true;
      } else if (!providerProfile && user.isProvider) {
        await storage.updateUser(user.id, { isProvider: false });
        user.isProvider = false;
      }

      // Derive role from authoritative provider record (not stale isProvider flag)
      const role = providerProfile ? "provider" : "homeowner";
      const token = generateToken(user.id, role, user.tokenVersion ?? 0);
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Task #220: enrich providerProfile with isPartner so the client's
      // auth store has Partner status from the moment of login (mirrors
      // the enrichment already done in /api/auth/me).
      let enrichedProfile:
        | (typeof providerProfile & { isPartner: boolean })
        | typeof providerProfile = providerProfile;
      if (providerProfile) {
        try {
          const [planRow] = await db
            .select({ isPartner: providerPlans.isPartner })
            .from(providerPlans)
            .where(eq(providerPlans.providerId, providerProfile.id));
          enrichedProfile = {
            ...providerProfile,
            isPartner: planRow?.isPartner ?? false,
          };
        } catch (err) {
          console.error("[auth/login] partner lookup failed:", err);
        }
      }

      // Task #328: link any pending crew_members rows whose email matches
      // this account, then load all crew memberships so the client can offer
      // "Switch to Crew" without a separate round trip.
      await autoLinkCrewByEmail(user.id, user.email);
      const crewMemberships = await getCrewMembershipsForUser(user.id);

      res.json({
        user: formatUserResponse(user),
        providerProfile: enrichedProfile,
        crewMemberships,
        token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.authenticatedUserId!;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const providerProfile = await storage.getProviderByUserId(userId);
      // Attach the HomeBase Partner flag (Task #211) so the provider can see
      // their own badge in the More tab and ProviderProfile screens.
      type ProviderProfileWithPartner =
        NonNullable<Awaited<ReturnType<typeof storage.getProviderByUserId>>> & {
          isPartner: boolean;
        };
      let enrichedProfile: ProviderProfileWithPartner | null = null;
      if (providerProfile) {
        const [planRow] = await db
          .select({ isPartner: providerPlans.isPartner })
          .from(providerPlans)
          .where(eq(providerPlans.providerId, providerProfile.id));
        enrichedProfile = {
          ...providerProfile,
          isPartner: planRow?.isPartner ?? false,
        };
      }
      // Task #328: include crew memberships so a refresh / cold launch
      // restores the "Switch to Crew" UX and re-validates the active scope.
      await autoLinkCrewByEmail(user.id, user.email);
      const crewMemberships = await getCrewMembershipsForUser(user.id);

      res.json({
        user: formatUserResponse(user),
        providerProfile: enrichedProfile,
        crewMemberships,
      });
    } catch (error) {
      console.error("Auth me error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  app.post(
    "/api/auth/logout-all",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.authenticatedUserId!;
        await db
          .update(users)
          .set({ tokenVersion: sql`token_version + 1` })
          .where(eq(users.id, userId));
        res.clearCookie("token");
        res.json({ success: true });
      } catch (error) {
        console.error("Logout-all error:", error);
        res.status(500).json({ error: "Failed to revoke sessions" });
      }
    },
  );

  app.post(
    "/api/auth/refresh",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.authenticatedUserId!;
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(401).json({ error: "User not found" });
        }
        // Derive role from provider record (authoritative source), not stale flag
        const providerRecord = await db
          .select({ id: providers.id })
          .from(providers)
          .where(eq(providers.userId, userId))
          .limit(1);
        const hasProviderRecord = providerRecord.length > 0;
        // Bidirectional sync: keep isProvider flag consistent with provider record existence
        if (hasProviderRecord && !user.isProvider) {
          await storage.updateUser(userId, { isProvider: true });
        } else if (!hasProviderRecord && user.isProvider) {
          await storage.updateUser(userId, { isProvider: false });
        }
        const role = hasProviderRecord ? "provider" : "homeowner";
        const token = generateToken(user.id, role, user.tokenVersion ?? 0);
        res.cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.json({ token, role });
      } catch (error) {
        console.error("Token refresh error:", error);
        res.status(500).json({ error: "Failed to refresh token" });
      }
    },
  );

  app.post("/api/auth/forgot-password", forgotPasswordRateLimit, async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await storage.getUserByEmail(email.trim().toLowerCase());

      if (user) {
        const { JWT_SECRET } = await import("../auth");
        const jwt = await import("jsonwebtoken");
        const RESET_SECRET = `${JWT_SECRET}:password-reset`;
        // Embed the user's current tokenVersion so the token is automatically
        // invalidated (single-use) once the password is reset and tokenVersion bumps.
        const resetToken = jwt.default.sign(
          {
            userId: user.id,
            purpose: "password_reset",
            tv: user.tokenVersion ?? 0,
          },
          RESET_SECRET,
          { expiresIn: "1h" },
        );
        // Build the reset URL from a server-controlled origin, never from
        // attacker-supplied Host / X-Forwarded-Host headers.
        const appOrigin =
          process.env.APP_ORIGIN ||
          (process.env.EXPO_PUBLIC_DOMAIN
            ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
            : "https://home-base-pro-app.replit.app");
        const resetUrl = `${appOrigin}/reset-password?token=${resetToken}`;
        const fullName =
          [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
        const { sendPasswordResetEmail } = await import("../emailService");
        sendPasswordResetEmail(user.email, fullName, resetUrl).catch(
          (err: unknown) => {
            console.error("[FORGOT_PASSWORD] Email send failed:", err);
          },
        );
      }

      res.json({
        success: true,
        message:
          "If an account exists for that email, a reset link has been sent.",
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Reset token is required" });
      }
      if (!password || typeof password !== "string" || password.length < 8) {
        return res
          .status(400)
          .json({ error: "Password must be at least 8 characters" });
      }
      const { JWT_SECRET } = await import("../auth");
      const jwt = await import("jsonwebtoken");
      const RESET_SECRET = `${JWT_SECRET}:password-reset`;
      let decoded: any;
      try {
        decoded = jwt.default.verify(token, RESET_SECRET);
      } catch {
        return res.status(400).json({
          error: "Invalid or expired reset link. Please request a new one.",
        });
      }
      if (decoded.purpose !== "password_reset" || !decoded.userId) {
        return res.status(400).json({ error: "Invalid reset token" });
      }

      const claimedTv = decoded.tv ?? 0;
      const hashed = await bcryptHash(password, 10);

      // Atomic compare-and-swap: the UPDATE matches BOTH the user id AND the
      // current tokenVersion that was embedded in the reset JWT.  If the reset
      // link was already used (tokenVersion was bumped) or was never valid, zero
      // rows are updated and we reject.  This eliminates the read-then-update
      // race that would allow concurrent submissions of the same link to both
      // succeed.
      const updated = await db
        .update(users)
        .set({
          password: hashed,
          // Bump tokenVersion to:
          //  (a) invalidate all outstanding session JWTs (revoke existing logins)
          //  (b) make every other copy of this reset link unusable immediately
          tokenVersion: sql`token_version + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(users.id, decoded.userId),
            eq(users.tokenVersion, claimedTv),
          ),
        )
        .returning({ id: users.id });

      if (updated.length === 0) {
        return res.status(400).json({
          error: "Invalid or expired reset link. Please request a new one.",
        });
      }

      res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.post(
    "/api/auth/change-password",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.authenticatedUserId!;
        const { currentPassword, newPassword } = req.body ?? {};

        if (!currentPassword || typeof currentPassword !== "string") {
          return res
            .status(400)
            .json({ error: "Current password is required" });
        }
        if (!newPassword || typeof newPassword !== "string") {
          return res.status(400).json({ error: "New password is required" });
        }
        if (newPassword.length < 8) {
          return res
            .status(400)
            .json({ error: "New password must be at least 8 characters" });
        }
        if (newPassword === currentPassword) {
          return res.status(400).json({
            error: "New password must be different from current password",
          });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        const valid = await bcryptCompare(currentPassword, user.password);
        if (!valid) {
          return res
            .status(401)
            .json({ error: "Current password is incorrect" });
        }

        const hashed = await bcryptHash(newPassword, BCRYPT_SALT_ROUNDS);

        // Update password and bump tokenVersion to invalidate other sessions
        await db
          .update(users)
          .set({
            password: hashed,
            tokenVersion: sql`token_version + 1`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));

        // Issue a fresh token for the current session so it keeps working
        const refreshed = await storage.getUser(userId);
        const role = (await storage.getProviderByUserId(userId))
          ? "provider"
          : "homeowner";
        const newToken = generateToken(
          userId,
          role,
          refreshed?.tokenVersion ?? 0,
        );
        res.cookie("token", newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({ success: true, token: newToken });
      } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({ error: "Failed to change password" });
      }
    },
  );

  app.post(
    "/api/auth/change-email",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.authenticatedUserId!;
        const { currentPassword, newEmail } = req.body ?? {};

        if (!currentPassword || typeof currentPassword !== "string") {
          return res
            .status(400)
            .json({ error: "Current password is required" });
        }
        if (!newEmail || typeof newEmail !== "string") {
          return res.status(400).json({ error: "New email is required" });
        }
        const cleaned = newEmail.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleaned)) {
          return res
            .status(400)
            .json({ error: "Please enter a valid email address" });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        if (cleaned === user.email.toLowerCase()) {
          return res
            .status(400)
            .json({ error: "That is already your email address" });
        }

        const valid = await bcryptCompare(currentPassword, user.password);
        if (!valid) {
          return res
            .status(401)
            .json({ error: "Current password is incorrect" });
        }

        const existing = await storage.getUserByEmail(cleaned);
        if (existing && existing.id !== userId) {
          return res
            .status(409)
            .json({ error: "That email is already in use" });
        }

        const [updated] = await db
          .update(users)
          .set({ email: cleaned, updatedAt: new Date() })
          .where(eq(users.id, userId))
          .returning();

        res.json({ success: true, email: updated.email });
      } catch (error) {
        console.error("Change email error:", error);
        res.status(500).json({ error: "Failed to change email" });
      }
    },
  );

  app.delete(
    "/api/auth/account",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.authenticatedUserId!;

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        await db.transaction(async (tx) => {
          const providerRow = await tx
            .select({
              id: providers.id,
              stripeAccountId: stripeConnectAccounts.stripeAccountId,
            })
            .from(providers)
            .leftJoin(
              stripeConnectAccounts,
              eq(stripeConnectAccounts.providerId, providers.id),
            )
            .where(eq(providers.userId, userId))
            .limit(1);

          if (providerRow.length > 0) {
            const provId = providerRow[0].id;

            await tx
              .delete(invoiceLineItems)
              .where(
                sql`invoice_id IN (SELECT id FROM invoices WHERE provider_id = ${provId})`,
              );
            await tx
              .delete(payments)
              .where(
                sql`invoice_id IN (SELECT id FROM invoices WHERE provider_id = ${provId})`,
              );
            await tx.delete(invoices).where(eq(invoices.providerId, provId));
            await tx.delete(jobs).where(eq(jobs.providerId, provId));
            await tx.delete(clients).where(eq(clients.providerId, provId));
            await tx
              .delete(bookingLinks)
              .where(eq(bookingLinks.providerId, provId));
            await tx
              .delete(intakeSubmissions)
              .where(eq(intakeSubmissions.providerId, provId));
            await tx.delete(leads).where(eq(leads.providerId, provId));
            await tx
              .delete(providerMessages)
              .where(eq(providerMessages.providerId, provId));
            await tx
              .delete(messageTemplates)
              .where(eq(messageTemplates.providerId, provId));
            await tx
              .delete(providerCustomServices)
              .where(eq(providerCustomServices.providerId, provId));
            await tx
              .delete(providerServices)
              .where(eq(providerServices.providerId, provId));
            await tx
              .delete(providerPlans)
              .where(eq(providerPlans.providerId, provId));
            await tx
              .delete(stripeConnectAccounts)
              .where(eq(stripeConnectAccounts.providerId, provId));
            await tx.delete(payouts).where(eq(payouts.providerId, provId));
            await tx.delete(reviews).where(eq(reviews.providerId, provId));
            await tx.delete(providers).where(eq(providers.id, provId));
          }

          await tx
            .delete(notifications)
            .where(eq(notifications.userId, userId));
          await tx.delete(pushTokens).where(eq(pushTokens.userId, userId));
          await tx
            .delete(notificationPreferences)
            .where(eq(notificationPreferences.userId, userId));
          await tx.delete(userCredits).where(eq(userCredits.userId, userId));
          await tx.delete(creditLedger).where(eq(creditLedger.userId, userId));
          await tx
            .delete(supportTickets)
            .where(eq(supportTickets.userId, userId));

          const userHomes = await tx
            .select({ id: homes.id })
            .from(homes)
            .where(eq(homes.userId, userId));
          if (userHomes.length > 0) {
            const homeIds = userHomes.map((h) => h.id);
            await tx
              .delete(housefaxEntries)
              .where(sql`home_id = ANY(${homeIds})`);
            await tx
              .delete(maintenanceReminders)
              .where(sql`home_id = ANY(${homeIds})`);
            await tx.delete(appointments).where(sql`home_id = ANY(${homeIds})`);
          }
          await tx.delete(homes).where(eq(homes.userId, userId));

          if (user.stripeCustomerId) {
            try {
              const stripe = getStripe();
              await stripe.customers.del(user.stripeCustomerId);
            } catch (stripeErr) {
              console.error(
                "[DELETE_ACCOUNT] Stripe customer deletion failed (non-fatal):",
                stripeErr,
              );
            }
          }

          await tx.delete(users).where(eq(users.id, userId));
        });

        res.clearCookie("token");
        res.json({ success: true });
      } catch (error) {
        console.error("Delete account error:", error);
        res.status(500).json({ error: "Failed to delete account" });
      }
    },
  );

  app.get(
    "/api/user/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        if (req.params.id !== authUserId) {
          return res.status(403).json({ error: "Access denied" });
        }
        const user = await storage.getUser(req.params.id);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        res.json({ user: formatUserResponse(user) });
      } catch (error) {
        console.error("Get user error:", error);
        res.status(500).json({ error: "Failed to get user" });
      }
    },
  );

  app.put(
    "/api/user/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        if (req.params.id !== authUserId) {
          return res.status(403).json({ error: "Access denied" });
        }

        const { name, phone, avatarUrl } = req.body;
        const nameFields = name ? parseUserName(name) : {};
        const safeUpdate: Record<string, unknown> = { ...nameFields };
        if (phone !== undefined) safeUpdate.phone = phone;
        if (avatarUrl !== undefined) safeUpdate.avatarUrl = avatarUrl;

        const user = await storage.updateUser(req.params.id, safeUpdate);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        res.json({ user: formatUserResponse(user) });
      } catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({ error: "Failed to update user" });
      }
    },
  );

  // Upload homeowner avatar — accepts a base64 data URL, saves to Supabase
  // Storage (or local /uploads in dev), and persists the public URL on the
  // user row. Mirrors the provider logo endpoint at /api/provider/:id/logo.
  app.post(
    "/api/user/:id/avatar",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        if (req.params.id !== authUserId) {
          return res.status(403).json({ error: "Access denied" });
        }

        const { base64 } = req.body as { base64?: string };
        if (!base64 || typeof base64 !== "string") {
          return res.status(400).json({ error: "base64 image data required" });
        }

        const ALLOWED_MIME_PREFIXES_AVATAR = [
          "data:image/jpeg;base64,",
          "data:image/jpg;base64,",
          "data:image/png;base64,",
          "data:image/webp;base64,",
        ];
        const prefix = ALLOWED_MIME_PREFIXES_AVATAR.find((p) =>
          base64.startsWith(p),
        );
        if (!prefix) {
          return res
            .status(400)
            .json({ error: "Invalid image format. Use JPEG, PNG, or WebP." });
        }

        const ext =
          prefix.includes("jpeg") || prefix.includes("jpg")
            ? "jpg"
            : prefix.includes("png")
              ? "png"
              : "webp";
        const mimeType =
          ext === "jpg"
            ? "image/jpeg"
            : ext === "png"
              ? "image/png"
              : "image/webp";
        const base64Data = base64.slice(prefix.length);
        const buffer = Buffer.from(base64Data, "base64");

        // Cap at 5 MB to prevent storage abuse.
        const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
        if (buffer.length > MAX_AVATAR_BYTES) {
          return res
            .status(413)
            .json({ error: "Image is too large (max 5 MB)" });
        }

        const filename = `user-${req.params.id}-avatar-${Date.now()}.${ext}`;
        let avatarUrl: string;

        const isDev = process.env.NODE_ENV === "development";
        let supabaseClient: typeof import("../lib/supabase").supabase | null =
          null;
        try {
          supabaseClient = (await import("../lib/supabase")).supabase;
        } catch {}

        if (supabaseClient) {
          const { error: uploadError } = await supabaseClient.storage
            .from("job-photos")
            .upload(`avatars/${filename}`, buffer, {
              contentType: mimeType,
              upsert: true,
            });
          if (uploadError) {
            console.error("Avatar Supabase upload error:", uploadError);
            throw new Error("Failed to upload avatar to storage");
          }
          const { data: publicUrlData } = supabaseClient.storage
            .from("job-photos")
            .getPublicUrl(`avatars/${filename}`);
          avatarUrl = publicUrlData.publicUrl;
        } else if (isDev) {
          const uploadDir = path.resolve(process.cwd(), "uploads", "avatars");
          if (!fs.existsSync(uploadDir))
            fs.mkdirSync(uploadDir, { recursive: true });
          fs.writeFileSync(path.join(uploadDir, filename), buffer);
          const protocol = req.protocol;
          const host = req.get("host") || "";
          avatarUrl = `${protocol}://${host}/uploads/avatars/${filename}`;
        } else {
          return res.status(503).json({ error: "Storage not configured" });
        }

        const updated = await storage.updateUser(req.params.id, { avatarUrl });
        if (!updated) {
          return res.status(404).json({ error: "User not found" });
        }
        res.json({ avatarUrl, user: formatUserResponse(updated) });
      } catch (error: any) {
        console.error("User avatar upload error:", error);
        res
          .status(500)
          .json({ error: error?.message || "Failed to upload avatar" });
      }
    },
  );

  app.get(
    "/api/homes/:userId",
    requireAuth,
    async (req: Request<UserIdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        if (req.params.userId !== authUserId) {
          return res.status(403).json({ error: "Access denied" });
        }
        const homes = await storage.getHomes(req.params.userId);
        res.json({ homes: homes.map(formatHomeResponse) });
      } catch (error) {
        console.error("Get homes error:", error);
        res.status(500).json({ error: "Failed to get homes" });
      }
    },
  );

  app.post("/api/homes", requireAuth, async (req: Request, res: Response) => {
    try {
      const { nickname, address, zipCode, label, street, zip, ...rest } =
        req.body;
      const homeData = {
        ...rest,
        userId: req.authenticatedUserId,
        label: nickname || label || "My Home",
        street: address || street,
        zip: zipCode || zip,
      };

      console.log(
        "Creating home with data:",
        JSON.stringify(homeData, null, 2),
      );

      const parsed = insertHomeSchema.safeParse(homeData);
      if (!parsed.success) {
        console.error(
          "Home validation failed:",
          JSON.stringify(parsed.error.issues, null, 2),
        );
        return res
          .status(400)
          .json({ error: "Invalid input", details: parsed.error.issues });
      }
      const home = await storage.createHome(parsed.data);

      // Auto-enrich the home with property data (fire and forget)
      if (home.street && home.city && home.state && home.zip) {
        const fullAddress = `${home.street}, ${home.city}, ${home.state} ${home.zip}`;
        enrichPropertyData(fullAddress)
          .then(async (enrichment) => {
            try {
              const zillowUpdates: Record<string, unknown> = {};
              const otherUpdates: Record<string, unknown> = {
                housefaxEnrichedAt: new Date(),
              };

              if (enrichment.zillow) {
                const z = enrichment.zillow as Record<string, unknown> & {
                  stories?: number;
                  propertyType?: string;
                };
                if (z.bedrooms) zillowUpdates.bedrooms = z.bedrooms;
                if (z.bathrooms) zillowUpdates.bathrooms = z.bathrooms;
                if (z.livingArea) zillowUpdates.squareFeet = z.livingArea;
                if (z.yearBuilt) zillowUpdates.yearBuilt = z.yearBuilt;
                if (z.lotSize) zillowUpdates.lotSize = z.lotSize;
                if (z.propertyType) zillowUpdates.propertyType = z.propertyType;
                if (z.zestimate)
                  zillowUpdates.estimatedValue = String(z.zestimate);
                if (z.zpid) zillowUpdates.zillowId = z.zpid;
                if (z.url) zillowUpdates.zillowUrl = z.url;
                if (z.taxAssessedValue)
                  zillowUpdates.taxAssessedValue = String(z.taxAssessedValue);
                if (z.lastSoldDate)
                  zillowUpdates.lastSoldDate = z.lastSoldDate;
                if (z.lastSoldPrice)
                  zillowUpdates.lastSoldPrice = String(z.lastSoldPrice);
                if (z.stories) zillowUpdates.stories = z.stories;
              }

              if (enrichment.google) {
                const g = enrichment.google;
                if (g.latitude) otherUpdates.latitude = String(g.latitude);
                if (g.longitude) otherUpdates.longitude = String(g.longitude);
                if (g.placeId) otherUpdates.placeId = g.placeId;
                if (g.formattedAddress)
                  otherUpdates.formattedAddress = g.formattedAddress;
                if (g.neighborhood)
                  otherUpdates.neighborhoodName = g.neighborhood;
                if (g.county) otherUpdates.countyName = g.county;
              }

              // Apply Zillow fields with change-log entries
              if (Object.keys(zillowUpdates).length > 0) {
                await updateHomeWithChangeLog({
                  homeId: home.id,
                  updates: zillowUpdates,
                  source: "zillow_import",
                });
              }
              await storage.updateHome(home.id, otherUpdates);
              console.log(
                `Auto-enriched home ${home.id} with ${Object.keys(zillowUpdates).length + Object.keys(otherUpdates).length - 1} fields`,
              );
            } catch (err) {
              console.error("Auto-enrichment update failed:", err);
            }
          })
          .catch((err) => {
            console.error("Auto-enrichment failed:", err);
          });
      }

      res.status(201).json({ home: formatHomeResponse(home) });
    } catch (error) {
      console.error("Create home error:", error);
      res.status(500).json({ error: "Failed to create home" });
    }
  });

  app.put(
    "/api/homes/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const existing = await storage.getHome(req.params.id);
        if (!existing) {
          return res.status(404).json({ error: "Home not found" });
        }
        if (existing.userId !== authUserId) {
          return res.status(403).json({ error: "Access denied" });
        }
        const { nickname, address, zipCode, ...rest } = req.body;
        const updateData: Record<string, unknown> = { ...rest };
        if (nickname !== undefined) updateData.label = nickname;
        if (address !== undefined) updateData.street = address;
        if (zipCode !== undefined) updateData.zip = zipCode;

        const home = await storage.updateHome(req.params.id, updateData);
        if (!home) {
          return res.status(404).json({ error: "Home not found" });
        }
        res.json({ home: formatHomeResponse(home) });
      } catch (error) {
        console.error("Update home error:", error);
        res.status(500).json({ error: "Failed to update home" });
      }
    },
  );

  app.delete(
    "/api/homes/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const home = await storage.getHome(req.params.id);
        if (!home) {
          return res.status(404).json({ error: "Home not found" });
        }
        if (home.userId !== authUserId) {
          return res.status(403).json({ error: "Access denied" });
        }
        const deleted = await storage.deleteHome(req.params.id);
        if (!deleted) {
          return res.status(404).json({ error: "Home not found" });
        }
        res.json({ success: true });
      } catch (error) {
        console.error("Delete home error:", error);
        res.status(500).json({ error: "Failed to delete home" });
      }
    },
  );

  // ============ HouseFax API Endpoints ============

  // Google Places autocomplete for address input
  app.get(
    "/api/housefax/autocomplete",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const query = req.query.q as string;
        if (!query || query.length < 3) {
          return res.json({ predictions: [] });
        }
        const predictions = await searchPlaces(query);
        res.json({ predictions });
      } catch (error) {
        console.error("Address autocomplete error:", error);
        res.status(500).json({ error: "Failed to search addresses" });
      }
    },
  );

  // Get place details from Google place ID
  app.get(
    "/api/housefax/place/:placeId",
    requireAuth,
    async (req: Request<{ placeId: string }>, res: Response) => {
      try {
        const details = await getPlaceDetails(req.params.placeId);
        if (!details) {
          return res.status(404).json({ error: "Place not found" });
        }
        res.json({ place: details });
      } catch (error) {
        console.error("Get place details error:", error);
        res.status(500).json({ error: "Failed to get place details" });
      }
    },
  );

  // Geocode an address
  app.post(
    "/api/housefax/geocode",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { address } = req.body;
        if (!address) {
          return res.status(400).json({ error: "Address is required" });
        }
        const result = await geocodeAddress(address);
        if (!result) {
          return res.status(404).json({ error: "Could not geocode address" });
        }
        res.json({ result });
      } catch (error) {
        console.error("Geocode error:", error);
        res.status(500).json({ error: "Failed to geocode address" });
      }
    },
  );

  // Fetch Zillow property data
  app.post(
    "/api/housefax/zillow",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { address } = req.body;
        if (!address) {
          return res.status(400).json({ error: "Address is required" });
        }
        const property = await fetchZillowPropertyData(address);
        if (!property) {
          return res.json({
            property: null,
            message: "No property data found",
          });
        }
        res.json({ property });
      } catch (error) {
        console.error("Zillow fetch error:", error);
        res.status(500).json({ error: "Failed to fetch property data" });
      }
    },
  );

  // Full property enrichment (Zillow + Google)
  app.post(
    "/api/housefax/enrich",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { address } = req.body;
        if (!address) {
          return res.status(400).json({ error: "Address is required" });
        }
        const enrichment = await enrichPropertyData(address);
        res.json(enrichment);
      } catch (error) {
        console.error("Property enrichment error:", error);
        res.status(500).json({ error: "Failed to enrich property data" });
      }
    },
  );

  // Enrich an existing home with HouseFax data
  app.post(
    "/api/homes/:id/enrich",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const home = await storage.getHome(req.params.id);
        if (!home) {
          return res.status(404).json({ error: "Home not found" });
        }
        if (home.userId !== req.authenticatedUserId) {
          return res.status(403).json({ error: "Access denied" });
        }

        const fullAddress = `${home.street}, ${home.city}, ${home.state} ${home.zip}`;
        const enrichment = await enrichPropertyData(fullAddress);

        const zillowUpdates: Record<string, unknown> = {};
        const otherUpdates: Record<string, unknown> = {
          housefaxEnrichedAt: new Date(),
        };

        if (enrichment.zillow) {
          const z = enrichment.zillow as Record<string, unknown> & {
            stories?: number;
            propertyType?: string;
          };
          if (z.bedrooms) zillowUpdates.bedrooms = z.bedrooms;
          if (z.bathrooms) zillowUpdates.bathrooms = z.bathrooms;
          if (z.livingArea) zillowUpdates.squareFeet = z.livingArea;
          if (z.yearBuilt) zillowUpdates.yearBuilt = z.yearBuilt;
          if (z.lotSize) zillowUpdates.lotSize = z.lotSize;
          if (z.propertyType) zillowUpdates.propertyType = z.propertyType;
          if (z.zestimate) zillowUpdates.estimatedValue = String(z.zestimate);
          if (z.zpid) zillowUpdates.zillowId = z.zpid;
          if (z.url) zillowUpdates.zillowUrl = z.url;
          if (z.taxAssessedValue)
            zillowUpdates.taxAssessedValue = String(z.taxAssessedValue);
          if (z.lastSoldDate) zillowUpdates.lastSoldDate = z.lastSoldDate;
          if (z.lastSoldPrice)
            zillowUpdates.lastSoldPrice = String(z.lastSoldPrice);
          if (z.stories) zillowUpdates.stories = z.stories;
        }

        if (enrichment.google) {
          const g = enrichment.google;
          if (g.latitude) otherUpdates.latitude = String(g.latitude);
          if (g.longitude) otherUpdates.longitude = String(g.longitude);
          if (g.placeId) otherUpdates.placeId = g.placeId;
          if (g.formattedAddress)
            otherUpdates.formattedAddress = g.formattedAddress;
          if (g.neighborhood) otherUpdates.neighborhoodName = g.neighborhood;
          if (g.county) otherUpdates.countyName = g.county;
        }

        // Apply Zillow values without overwriting homeowner-supplied data
        if (Object.keys(zillowUpdates).length > 0) {
          await updateHomeWithChangeLog({
            homeId: home.id,
            updates: zillowUpdates,
            source: "zillow_import",
            onlyIfEmpty: true,
          });
        }
        const updatedHome = await storage.updateHome(home.id, otherUpdates);

        res.json({
          home: updatedHome ? formatHomeResponse(updatedHome) : null,
          enrichment,
          fieldsUpdated:
            Object.keys(zillowUpdates).length +
            Object.keys(otherUpdates).length -
            1,
        });
      } catch (error) {
        console.error("Home enrichment error:", error);
        res.status(500).json({ error: "Failed to enrich home" });
      }
    },
  );

  // ============ Home Profile editor endpoints ============

  // GET /api/homes/:homeId/profile - read full home profile
  app.get(
    "/api/homes/:homeId/profile",
    requireAuth,
    async (req: Request<{ homeId: string }>, res: Response) => {
      try {
        const home = await storage.getHome(req.params.homeId);
        if (!home) return res.status(404).json({ error: "Home not found" });
        if (home.userId !== req.authenticatedUserId) {
          return res.status(403).json({ error: "Access denied" });
        }
        const recentChanges = await getHomeFieldChanges(home.id, 20);
        res.json({ home: formatHomeResponse(home), changes: recentChanges });
      } catch (error) {
        console.error("Get home profile error:", error);
        res.status(500).json({ error: "Failed to load home profile" });
      }
    },
  );

  // PATCH /api/homes/:homeId/profile - homeowner edits to the profile
  app.patch(
    "/api/homes/:homeId/profile",
    requireAuth,
    async (req: Request<{ homeId: string }>, res: Response) => {
      try {
        const home = await storage.getHome(req.params.homeId);
        if (!home) return res.status(404).json({ error: "Home not found" });
        if (home.userId !== req.authenticatedUserId) {
          return res.status(403).json({ error: "Access denied" });
        }
        const parsed = homeProfileUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "Invalid input", details: parsed.error.issues });
        }
        const sourceParam = (req.body?.source as string) || "homeowner";
        const allowedSources = new Set([
          "homeowner",
          "health_score",
          "survival_kit",
        ]);
        const source = (
          allowedSources.has(sourceParam) ? sourceParam : "homeowner"
        ) as "homeowner" | "health_score" | "survival_kit";
        const result = await updateHomeWithChangeLog({
          homeId: home.id,
          updates: parsed.data as Record<string, unknown>,
          source,
          changedByUserId: req.authenticatedUserId,
        });
        res.json({
          home: result ? formatHomeResponse(result.home) : null,
          changes: result?.changes ?? [],
        });
      } catch (error) {
        console.error("Update home profile error:", error);
        res.status(500).json({ error: "Failed to update home profile" });
      }
    },
  );

  // GET /api/homes/:homeId/profile/provider-view - read-only profile for providers
  // who have a job or appointment tied to this home.
  app.get(
    "/api/homes/:homeId/profile/provider-view",
    requireAuth,
    async (req: Request<{ homeId: string }>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const home = await storage.getHome(req.params.homeId);
        if (!home) return res.status(404).json({ error: "Home not found" });

        const providerRecord = await storage.getProviderByUserId(authUserId);
        if (!providerRecord) {
          return res.status(403).json({ error: "Access denied" });
        }
        const [linkedJob] = await db
          .select({ id: jobs.id })
          .from(jobs)
          .where(
            and(
              eq(jobs.homeId, home.id),
              eq(jobs.providerId, providerRecord.id),
            ),
          )
          .limit(1);
        const [linkedAppt] = linkedJob
          ? [null]
          : await db
              .select({ id: appointments.id })
              .from(appointments)
              .where(
                and(
                  eq(appointments.homeId, home.id),
                  eq(appointments.providerId, providerRecord.id),
                ),
              )
              .limit(1);
        if (!linkedJob && !linkedAppt) {
          return res.status(403).json({ error: "Access denied" });
        }
        res.json({ home: formatHomeResponse(home) });
      } catch (error) {
        console.error("Provider home profile error:", error);
        res.status(500).json({ error: "Failed to load home profile" });
      }
    },
  );

  // GET /api/homes/:homeId/changes - audit log
  app.get(
    "/api/homes/:homeId/changes",
    requireAuth,
    async (req: Request<{ homeId: string }>, res: Response) => {
      try {
        const home = await storage.getHome(req.params.homeId);
        if (!home) return res.status(404).json({ error: "Home not found" });
        if (home.userId !== req.authenticatedUserId) {
          return res.status(403).json({ error: "Access denied" });
        }
        const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
        const changes = await getHomeFieldChanges(home.id, limit);
        res.json({ changes });
      } catch (error) {
        console.error("Get home changes error:", error);
        res.status(500).json({ error: "Failed to load change log" });
      }
    },
  );

  // Get HouseFax context for AI
  app.get(
    "/api/homes/:id/housefax-context",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const home = await storage.getHome(req.params.id);
        if (!home) {
          return res.status(404).json({ error: "Home not found" });
        }
        if (home.userId !== req.authenticatedUserId) {
          return res.status(403).json({ error: "Access denied" });
        }
        const context = buildHouseFaxContext(home);
        res.json({ context });
      } catch (error) {
        console.error("Get HouseFax context error:", error);
        res.status(500).json({ error: "Failed to get HouseFax context" });
      }
    },
  );

  // GET /api/housefax/:homeId - full HouseFax data for a home
  app.get(
    "/api/housefax/:homeId",
    requireAuth,
    async (req: Request<{ homeId: string }>, res: Response) => {
      try {
        const { homeId } = req.params;
        const authUserId = req.authenticatedUserId!;

        const home = await storage.getHome(homeId);
        if (!home) return res.status(404).json({ error: "Home not found" });
        if (home.userId !== authUserId)
          return res.status(403).json({ error: "Access denied" });

        const entries = await db
          .select()
          .from(housefaxEntries)
          .where(eq(housefaxEntries.homeId, homeId))
          .orderBy(desc(housefaxEntries.completedAt));

        // Derive assets from service history (one per unique systemAffected)
        const systemMap = new Map<
          string,
          { lastServiced: Date; count: number; entries: typeof entries }
        >();
        for (const entry of entries) {
          const sys =
            entry.systemAffected || entry.serviceCategory || "General";
          if (!systemMap.has(sys))
            systemMap.set(sys, {
              lastServiced: entry.completedAt,
              count: 0,
              entries: [],
            });
          const data = systemMap.get(sys)!;
          data.count += 1;
          data.entries.push(entry);
          if (entry.completedAt > data.lastServiced)
            data.lastServiced = entry.completedAt;
        }

        const KEY_SYSTEMS = [
          "HVAC",
          "Plumbing",
          "Electrical",
          "Roof",
          "Pest Control",
          "Lawn",
        ];

        // Recommended service intervals in months per system
        const SERVICE_INTERVALS: Record<string, number> = {
          HVAC: 12,
          Plumbing: 24,
          Electrical: 36,
          Roof: 60,
          "Pest Control": 12,
          Lawn: 3,
          Painting: 84,
          Cleaning: 3,
          Appliances: 24,
          General: 12,
        };

        const assets = Array.from(systemMap.entries()).map(([system, data]) => {
          const sortedEntries = data.entries.sort(
            (a, b) => b.completedAt.getTime() - a.completedAt.getTime(),
          );
          const lastEntry = sortedEntries[0];
          const intervalMonths = SERVICE_INTERVALS[system] || 12;
          const nextDueDate = new Date(
            data.lastServiced.getTime() +
              intervalMonths * 30 * 24 * 60 * 60 * 1000,
          );
          return {
            system,
            lastServiced: data.lastServiced.toISOString(),
            serviceCount: data.count,
            lastServiceName: lastEntry?.serviceName || system,
            lastProviderName: lastEntry?.providerName || null,
            nextDue: nextDueDate.toISOString(),
            recommendedIntervalMonths: intervalMonths,
          };
        });

        // Calculate and persist health score (using shared helper for consistency)
        const score = await calculateAndPersistHouseFaxScore(homeId);

        // Build documents list from real paid invoice records tied to this home's jobs only
        // Scope strictly to jobIds from this home's HouseFax entries to avoid cross-home leakage
        const jobIds = entries.map((e) => e.jobId).filter(Boolean) as string[];
        const allInvoices =
          jobIds.length > 0
            ? await db
                .select()
                .from(invoices)
                .where(
                  and(
                    inArray(invoices.jobId, jobIds),
                    inArray(invoices.status, ["paid", "partially_paid"]),
                  ),
                )
            : [];

        // Map invoices to document records; fall back to HouseFax entries for jobs without invoices
        const invoiceJobIds = new Set(
          allInvoices.map((i) => i.jobId).filter(Boolean),
        );
        const documentsFromInvoices = allInvoices.map((inv) => {
          const matchingEntry = entries.find((e) => e.jobId === inv.jobId);
          const totalAmt = inv.totalCents
            ? inv.totalCents / 100
            : parseFloat((inv.total as string) || "0");
          return {
            id: inv.id,
            name: matchingEntry
              ? `${matchingEntry.serviceName} - ${new Date(matchingEntry.completedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
              : `Invoice #${inv.invoiceNumber}`,
            type: "invoice" as const,
            date: inv.paidAt
              ? new Date(inv.paidAt).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })
              : new Date(inv.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                }),
            amount: totalAmt,
            providerId: matchingEntry?.providerId || null,
            providerName: matchingEntry?.providerName || null,
            hasPhotos:
              Array.isArray(matchingEntry?.photos) &&
              (matchingEntry?.photos as string[]).length > 0,
            invoiceId: inv.id,
          };
        });

        // For entries without a real invoice (e.g., free jobs, or no invoice yet), add as receipt
        const documentsFromFreeJobs = entries
          .filter((e) => !e.jobId || !invoiceJobIds.has(e.jobId))
          .filter((e) => (e.costCents || 0) === 0) // Only include free services as receipts
          .map((e) => ({
            id: e.id,
            name: `${e.serviceName} - ${new Date(e.completedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
            type: "receipt" as const,
            date: new Date(e.completedAt).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            }),
            amount: 0,
            providerId: e.providerId,
            providerName: e.providerName,
            hasPhotos:
              Array.isArray(e.photos) && (e.photos as string[]).length > 0,
            invoiceId: null,
          }));

        const documents = [
          ...documentsFromInvoices,
          ...documentsFromFreeJobs,
        ].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );

        // Calculate total spent
        const totalSpentCents = entries.reduce(
          (sum, e) => sum + (e.costCents || 0),
          0,
        );

        // Generate AI insights if there are entries
        let insights: string[] = [];
        if (entries.length > 0) {
          try {
            const systemsServiced = [...systemMap.keys()].join(", ");
            const missingKey = KEY_SYSTEMS.filter((sys) => {
              return !entries.some((e) => {
                const s = (
                  e.systemAffected ||
                  e.serviceCategory ||
                  ""
                ).toLowerCase();
                return s.includes(sys.toLowerCase().split(" ")[0]);
              });
            });
            const prompt = `You are a home maintenance advisor. Based on this homeowner's service history, provide exactly 3 concise bullet point recommendations (no bullet symbols, just text, one per line).

Systems serviced: ${systemsServiced || "none yet"}
Key systems not yet documented: ${missingKey.join(", ") || "all covered"}
Total jobs documented: ${entries.length}
Home age: ${home.yearBuilt ? new Date().getFullYear() - home.yearBuilt + " years" : "unknown"}

Give actionable, specific recommendations. Be brief (1 sentence each).`;
            const aiResponse = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              max_tokens: 200,
            });
            const content = aiResponse.choices[0]?.message?.content || "";
            insights = content
              .split("\n")
              .filter((l) => l.trim())
              .slice(0, 3);
          } catch (e) {
            console.error("Insights generation error:", e);
            insights = [];
          }
        }

        res.json({
          entries,
          assets,
          score,
          totalSpentCents,
          documents,
          insights,
        });
      } catch (error) {
        console.error("HouseFax get error:", error);
        res.status(500).json({ error: "Failed to get HouseFax data" });
      }
    },
  );

  // POST /api/housefax/:homeId/score - recalculate and persist health score
  app.post(
    "/api/housefax/:homeId/score",
    requireAuth,
    async (req: Request<{ homeId: string }>, res: Response) => {
      try {
        const { homeId } = req.params;
        const home = await storage.getHome(homeId);
        if (!home) return res.status(404).json({ error: "Home not found" });
        if (home.userId !== req.authenticatedUserId)
          return res.status(403).json({ error: "Access denied" });

        const score = await calculateAndPersistHouseFaxScore(homeId);
        res.json({ score });
      } catch (error) {
        console.error("HouseFax score error:", error);
        res.status(500).json({ error: "Failed to calculate score" });
      }
    },
  );

  // GET /api/jobs/:id/photos - list job photos (provider OR assigned crew).
  app.get(
    "/api/jobs/:id/photos",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const gate = await requireCrewOrProviderForJob(req, req.params.id, res);
        if (!gate) return;
        const [entry] = await db
          .select({ photos: housefaxEntries.photos })
          .from(housefaxEntries)
          .where(eq(housefaxEntries.jobId, gate.job.id));
        const photos = Array.isArray(entry?.photos)
          ? (entry!.photos as string[])
          : [];
        res.json({ photos });
      } catch (error) {
        console.error("Get job photos error:", error);
        res.status(500).json({ error: "Failed to load photos" });
      }
    },
  );

  // POST /api/jobs/:id/photos - add photos to a job's housefax entry (provider only)
  // Accepts base64-encoded images, saves to /uploads/photos/, stores HTTPS URLs in DB
  app.post(
    "/api/jobs/:id/photos",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      const MAX_PHOTOS_PER_JOB = 10;
      const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB per image
      const ALLOWED_MIME_PREFIXES = [
        "data:image/jpeg;base64,",
        "data:image/png;base64,",
        "data:image/webp;base64,",
      ];

      try {
        // Task #328: provider OR assigned crew member may upload field photos.
        const gate = await requireCrewOrProviderForJob(req, req.params.id, res);
        if (!gate) return;
        const job = gate.job;

        const { photos } = req.body as { photos: string[] };
        if (!Array.isArray(photos) || photos.length === 0) {
          return res.status(400).json({ error: "photos array is required" });
        }
        if (photos.length > MAX_PHOTOS_PER_JOB) {
          return res
            .status(400)
            .json({ error: `Maximum ${MAX_PHOTOS_PER_JOB} photos per upload` });
        }

        // Validate each image: MIME type and size
        for (const photo of photos) {
          const validPrefix = ALLOWED_MIME_PREFIXES.find((p) =>
            photo.startsWith(p),
          );
          if (!validPrefix) {
            return res
              .status(400)
              .json({ error: "Only JPEG, PNG, and WebP images are allowed" });
          }
          const base64Data = photo.slice(validPrefix.length);
          const sizeBytes = Math.ceil((base64Data.length * 3) / 4);
          if (sizeBytes > MAX_PHOTO_BYTES) {
            return res
              .status(400)
              .json({ error: "Each photo must be smaller than 5 MB" });
          }
        }

        // Find or create the housefax entry for this job (durable: may not exist yet if auto-log is still processing)
        let [entry] = await db
          .select()
          .from(housefaxEntries)
          .where(eq(housefaxEntries.jobId, job.id));

        if (!entry) {
          // Auto-log entry may not be created yet (fire-and-forget race), create it now synchronously
          await autoLogHouseFaxEntry(job);
          const [newEntry] = await db
            .select()
            .from(housefaxEntries)
            .where(eq(housefaxEntries.jobId, job.id));
          if (!newEntry) {
            return res.status(404).json({
              error:
                "Could not create HouseFax entry for this job. No home found for client.",
            });
          }
          entry = newEntry;
        }

        // Enforce total photo limit per job
        const existingPhotos = Array.isArray(entry.photos)
          ? (entry.photos as string[])
          : [];
        if (existingPhotos.length + photos.length > MAX_PHOTOS_PER_JOB) {
          return res.status(400).json({
            error: `This job already has ${existingPhotos.length} photos. Maximum is ${MAX_PHOTOS_PER_JOB} total.`,
          });
        }

        // Upload each base64 image to Supabase Storage for persistent cloud storage
        const savedUrls: string[] = [];
        const isDev = process.env.NODE_ENV === "development";

        let supabaseClient: typeof import("../lib/supabase").supabase | null =
          null;
        try {
          supabaseClient = (await import("../lib/supabase")).supabase;
        } catch (importErr) {
          if (!isDev) {
            throw new Error(
              "Photo storage is not configured. Please set SUPABASE_SERVICE_KEY and EXPO_PUBLIC_SUPABASE_URL.",
            );
          }
          // Only allow local fallback in development
        }

        for (const photo of photos) {
          const prefix = ALLOWED_MIME_PREFIXES.find((p) =>
            photo.startsWith(p),
          )!;
          const ext = prefix.includes("jpeg")
            ? "jpg"
            : prefix.includes("png")
              ? "png"
              : "webp";
          const mimeType = prefix.includes("jpeg")
            ? "image/jpeg"
            : prefix.includes("png")
              ? "image/png"
              : "image/webp";
          const base64Data = photo.slice(prefix.length);
          const buffer = Buffer.from(base64Data, "base64");
          const filename = `${job.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

          if (supabaseClient) {
            const { data: uploadData, error: uploadError } =
              await supabaseClient.storage
                .from("job-photos")
                .upload(`photos/${filename}`, buffer, {
                  contentType: mimeType,
                  upsert: false,
                });
            if (uploadError) {
              console.error("Supabase upload error:", uploadError);
              throw new Error("Failed to upload photo to storage");
            }
            const { data: publicUrlData } = supabaseClient.storage
              .from("job-photos")
              .getPublicUrl(`photos/${filename}`);
            savedUrls.push(publicUrlData.publicUrl);
          } else if (isDev) {
            // Fallback: save to local disk (dev only — not persistent across deploys)
            const uploadDir = path.resolve(process.cwd(), "uploads", "photos");
            if (!fs.existsSync(uploadDir))
              fs.mkdirSync(uploadDir, { recursive: true });
            const filePath = path.join(uploadDir, filename);
            fs.writeFileSync(filePath, buffer);
            const protocol = req.protocol;
            const host = req.get("host") || "";
            savedUrls.push(`${protocol}://${host}/uploads/photos/${filename}`);
          } else {
            throw new Error(
              "Photo storage is not available. Please configure Supabase Storage.",
            );
          }
        }

        const updatedPhotos = [...existingPhotos, ...savedUrls];
        await db
          .update(housefaxEntries)
          .set({ photos: updatedPhotos })
          .where(eq(housefaxEntries.id, entry.id));

        res.json({
          success: true,
          photosCount: updatedPhotos.length,
          urls: savedUrls,
        });
      } catch (error) {
        console.error("Job photos upload error:", error);
        res.status(500).json({ error: "Failed to upload photos" });
      }
    },
  );

  // ============ BEFORE/AFTER PHOTO PAIRS (Task #485) ============
  // A single capture action feeds three surfaces: the job's invoice, the
  // client's review request, and a branded shareable comparison image.

  const PAIR_MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB per image
  const PAIR_ALLOWED_MIME_PREFIXES = [
    "data:image/jpeg;base64,",
    "data:image/png;base64,",
    "data:image/webp;base64,",
  ];

  async function uploadJobPhotoBase64(
    jobId: string,
    photo: string,
    req: Request,
  ): Promise<string> {
    const isDev = process.env.NODE_ENV === "development";
    const prefix = PAIR_ALLOWED_MIME_PREFIXES.find((p) => photo.startsWith(p));
    if (!prefix) {
      throw new Error("Only JPEG, PNG, and WebP images are allowed");
    }
    const base64Data = photo.slice(prefix.length);
    const sizeBytes = Math.ceil((base64Data.length * 3) / 4);
    if (sizeBytes > PAIR_MAX_PHOTO_BYTES) {
      throw new Error("Each photo must be smaller than 5 MB");
    }
    const ext = prefix.includes("jpeg")
      ? "jpg"
      : prefix.includes("png")
        ? "png"
        : "webp";
    const mimeType = prefix.includes("jpeg")
      ? "image/jpeg"
      : prefix.includes("png")
        ? "image/png"
        : "image/webp";
    const buffer = Buffer.from(base64Data, "base64");
    const filename = `${jobId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    let supabaseClient: typeof import("../lib/supabase").supabase | null = null;
    try {
      supabaseClient = (await import("../lib/supabase")).supabase;
    } catch (importErr) {
      if (!isDev) {
        throw new Error(
          "Photo storage is not configured. Please set SUPABASE_SERVICE_KEY and EXPO_PUBLIC_SUPABASE_URL.",
        );
      }
    }

    if (supabaseClient) {
      const { error: uploadError } = await supabaseClient.storage
        .from("job-photos")
        .upload(`photos/${filename}`, buffer, {
          contentType: mimeType,
          upsert: false,
        });
      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        throw new Error("Failed to upload photo to storage");
      }
      const { data: publicUrlData } = supabaseClient.storage
        .from("job-photos")
        .getPublicUrl(`photos/${filename}`);
      return publicUrlData.publicUrl;
    }

    if (isDev) {
      const uploadDir = path.resolve(process.cwd(), "uploads", "photos");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, buffer);
      const protocol = req.protocol;
      const host = req.get("host") || "";
      return `${protocol}://${host}/uploads/photos/${filename}`;
    }

    throw new Error("Photo storage is not available. Please configure Supabase Storage.");
  }

  // GET /api/jobs/:id/photo-pairs - list before/after pairs for a job.
  // Readable by the provider, assigned crew, OR the homeowner on the job's
  // linked appointment (Task #485: photos are attached to the review
  // request sent to the customer, so the customer must be able to view them).
  app.get(
    "/api/jobs/:id/photo-pairs",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const job = await storage.getJob(req.params.id);
        if (!job) return res.status(404).json({ error: "Job not found" });

        let isHomeowner = false;
        if (job.appointmentId) {
          const appointment = await storage.getAppointment(job.appointmentId);
          isHomeowner = !!appointment && appointment.userId === authUserId;
        }

        if (!isHomeowner) {
          const gate = await requireCrewOrProviderForJob(req, req.params.id, res);
          if (!gate) return;
        }

        const pairs = await db
          .select()
          .from(jobPhotoPairs)
          .where(eq(jobPhotoPairs.jobId, job.id))
          .orderBy(desc(jobPhotoPairs.createdAt));
        res.json({ pairs });
      } catch (error) {
        console.error("Get job photo pairs error:", error);
        res.status(500).json({ error: "Failed to load photo pairs" });
      }
    },
  );

  // POST /api/jobs/:id/photo-pairs - capture a before/after pair for a job.
  // Accepts base64-encoded before + after images, uploads both to Supabase
  // Storage, and stores the pair against the job record.
  app.post(
    "/api/jobs/:id/photo-pairs",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const gate = await requireCrewOrProviderForJob(req, req.params.id, res);
        if (!gate) return;
        const job = gate.job;

        const { beforePhoto, afterPhoto, label } = req.body as {
          beforePhoto?: string;
          afterPhoto?: string;
          label?: string;
        };
        if (!beforePhoto || !afterPhoto) {
          return res.status(400).json({
            error: "Both beforePhoto and afterPhoto are required",
          });
        }

        const [beforeUrl, afterUrl] = await Promise.all([
          uploadJobPhotoBase64(job.id, beforePhoto, req),
          uploadJobPhotoBase64(job.id, afterPhoto, req),
        ]);

        const [pair] = await db
          .insert(jobPhotoPairs)
          .values({
            jobId: job.id,
            providerId: job.providerId,
            beforePhotoUrl: beforeUrl,
            afterPhotoUrl: afterUrl,
            label: label?.trim() || null,
          })
          .returning();

        res.status(201).json({ pair });
      } catch (error) {
        console.error("Create job photo pair error:", error);
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Failed to save before/after photos",
        });
      }
    },
  );

  // DELETE /api/job-photo-pairs/:id - remove a before/after pair (provider only).
  app.delete(
    "/api/job-photo-pairs/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const [pair] = await db
          .select()
          .from(jobPhotoPairs)
          .where(eq(jobPhotoPairs.id, req.params.id))
          .limit(1);
        if (!pair) return res.status(404).json({ error: "Photo pair not found" });
        if (!(await assertProviderOwnership(req, pair.providerId, res))) return;
        await db.delete(jobPhotoPairs).where(eq(jobPhotoPairs.id, pair.id));
        res.json({ success: true });
      } catch (error) {
        console.error("Delete job photo pair error:", error);
        res.status(500).json({ error: "Failed to delete photo pair" });
      }
    },
  );

  // ============ CREW TIME TRACKING ROUTES (Task #479) ============
  // Simple clock-in/clock-out for a crew member on a job. No GPS, no
  // payroll integration — just timestamps for hours-worked/job-costing
  // visibility on the provider side.

  // GET /api/jobs/:id/time-entries - list time entries for a job (provider
  // OR the assigned crew member). Includes crewMemberName for display.
  app.get(
    "/api/jobs/:id/time-entries",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const gate = await requireCrewOrProviderForJob(req, req.params.id, res);
        if (!gate) return;
        const rows = await db
          .select({
            id: crewTimeEntries.id,
            jobId: crewTimeEntries.jobId,
            crewMemberId: crewTimeEntries.crewMemberId,
            crewMemberName: crewMembers.name,
            clockInAt: crewTimeEntries.clockInAt,
            clockOutAt: crewTimeEntries.clockOutAt,
          })
          .from(crewTimeEntries)
          .innerJoin(crewMembers, eq(crewMembers.id, crewTimeEntries.crewMemberId))
          .where(eq(crewTimeEntries.jobId, gate.job.id))
          .orderBy(desc(crewTimeEntries.clockInAt));
        res.json({ timeEntries: rows });
      } catch (error) {
        console.error("Get job time entries error:", error);
        res.status(500).json({ error: "Failed to load time entries" });
      }
    },
  );

  // POST /api/jobs/:id/clock-in - crew member clocks in on a job. Only the
  // assigned crew member may clock in (a provider has no crewMemberId to
  // attribute hours to).
  app.post(
    "/api/jobs/:id/clock-in",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const gate = await requireCrewOrProviderForJob(req, req.params.id, res);
        if (!gate) return;
        if (gate.role !== "crew" || !gate.crewMemberId) {
          return res
            .status(400)
            .json({ error: "Only the assigned crew member can clock in" });
        }
        const [openEntry] = await db
          .select({ id: crewTimeEntries.id })
          .from(crewTimeEntries)
          .where(
            and(
              eq(crewTimeEntries.jobId, gate.job.id),
              eq(crewTimeEntries.crewMemberId, gate.crewMemberId),
              isNull(crewTimeEntries.clockOutAt),
            ),
          );
        if (openEntry) {
          return res
            .status(409)
            .json({ error: "You're already clocked in on this job" });
        }
        const [created] = await db
          .insert(crewTimeEntries)
          .values({
            jobId: gate.job.id,
            crewMemberId: gate.crewMemberId,
            providerId: gate.job.providerId,
            clockInAt: new Date(),
          })
          .returning();
        res.json({ timeEntry: created });
      } catch (error) {
        console.error("Clock in error:", error);
        res.status(500).json({ error: "Failed to clock in" });
      }
    },
  );

  // POST /api/jobs/:id/clock-out - crew member clocks out of their open
  // time entry on this job.
  app.post(
    "/api/jobs/:id/clock-out",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const gate = await requireCrewOrProviderForJob(req, req.params.id, res);
        if (!gate) return;
        if (gate.role !== "crew" || !gate.crewMemberId) {
          return res
            .status(400)
            .json({ error: "Only the assigned crew member can clock out" });
        }
        const [openEntry] = await db
          .select()
          .from(crewTimeEntries)
          .where(
            and(
              eq(crewTimeEntries.jobId, gate.job.id),
              eq(crewTimeEntries.crewMemberId, gate.crewMemberId),
              isNull(crewTimeEntries.clockOutAt),
            ),
          )
          .orderBy(desc(crewTimeEntries.clockInAt))
          .limit(1);
        if (!openEntry) {
          return res
            .status(409)
            .json({ error: "You're not clocked in on this job" });
        }
        const [updated] = await db
          .update(crewTimeEntries)
          .set({ clockOutAt: new Date() })
          .where(eq(crewTimeEntries.id, openEntry.id))
          .returning();
        res.json({ timeEntry: updated });
      } catch (error) {
        console.error("Clock out error:", error);
        res.status(500).json({ error: "Failed to clock out" });
      }
    },
  );

  // GET /api/provider/:providerId/time-entries - all time entries for a
  // provider's crew, joined with job title + crew member name, for hours
  // worked per job / per crew member costing views.
  app.get(
    "/api/provider/:providerId/time-entries",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res)))
          return;
        const rows = await db
          .select({
            id: crewTimeEntries.id,
            jobId: crewTimeEntries.jobId,
            jobTitle: jobs.title,
            crewMemberId: crewTimeEntries.crewMemberId,
            crewMemberName: crewMembers.name,
            crewMemberColor: crewMembers.color,
            clockInAt: crewTimeEntries.clockInAt,
            clockOutAt: crewTimeEntries.clockOutAt,
          })
          .from(crewTimeEntries)
          .innerJoin(jobs, eq(jobs.id, crewTimeEntries.jobId))
          .innerJoin(crewMembers, eq(crewMembers.id, crewTimeEntries.crewMemberId))
          .where(eq(crewTimeEntries.providerId, req.params.providerId))
          .orderBy(desc(crewTimeEntries.clockInAt));
        res.json({ timeEntries: rows });
      } catch (error) {
        console.error("Get provider time entries error:", error);
        res.status(500).json({ error: "Failed to load time entries" });
      }
    },
  );

  // POST /api/appointments/:id/complete - complete an appointment and trigger HouseFax auto-log
  app.post(
    "/api/appointments/:id/complete",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const appointment = await storage.getAppointment(req.params.id);
        if (!appointment)
          return res.status(404).json({ error: "Appointment not found" });

        // Only provider or homeowner can complete
        const providerRecord = await storage.getProviderByUserId(authUserId);
        const isProvider =
          providerRecord && appointment.providerId === providerRecord.id;
        const isOwner = appointment.userId === authUserId;
        if (!isProvider && !isOwner)
          return res.status(403).json({ error: "Access denied" });

        // Update appointment to completed
        const updatedAppointment = await storage.updateAppointment(
          req.params.id,
          {
            status: "completed",
          },
        );

        if (!updatedAppointment)
          return res
            .status(500)
            .json({ error: "Failed to update appointment" });

        // If a job exists for this appointment, complete it too (to trigger HouseFax via job path)
        const [linkedJob] = await db
          .select()
          .from(jobs)
          .where(eq(jobs.appointmentId, req.params.id));

        if (linkedJob && linkedJob.status !== "completed") {
          const { finalPrice } = req.body as { finalPrice?: string };
          const completedJob = await storage.updateJob(linkedJob.id, {
            status: "completed",
            completedAt: new Date(),
            finalPrice: finalPrice || linkedJob.estimatedPrice,
          });
          if (completedJob) {
            // Trigger HouseFax auto-log via job completion path (idempotent)
            autoLogHouseFaxEntry(completedJob).catch((e: unknown) =>
              console.error("housefax auto-log error:", e),
            );
          }
        } else {
          // No linked job - auto-log from appointment directly
          const { finalPrice } = req.body as { finalPrice?: string };
          const [provider] = appointment.providerId
            ? await db
                .select({ businessName: providers.businessName })
                .from(providers)
                .where(eq(providers.id, appointment.providerId))
            : [null];

          const serviceCategory = detectServiceCategory(
            appointment.serviceName || "General Service",
          );
          const costCents = finalPrice
            ? Math.round(parseFloat(finalPrice) * 100)
            : 0;

          // Check idempotency - if appointment already logged, skip
          const [existingByAppt] = await db
            .select({ id: housefaxEntries.id })
            .from(housefaxEntries)
            .where(eq(housefaxEntries.appointmentId, req.params.id));

          if (!existingByAppt) {
            let aiSummary: string | null = null;
            try {
              const aiResponse = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                  {
                    role: "user",
                    content: `Write a 1-2 sentence summary for a homeowner's records: Service: ${appointment.serviceName}, Provider: ${provider?.businessName || "Unknown"}. Be concise and factual.`,
                  },
                ],
                max_tokens: 80,
              });
              aiSummary =
                aiResponse.choices[0]?.message?.content?.trim() || null;
            } catch (e) {
              console.error("[HouseFax] AI summary error:", e);
            }

            await db
              .insert(housefaxEntries)
              .values({
                homeId: appointment.homeId,
                jobId: null,
                appointmentId: req.params.id,
                serviceCategory,
                serviceName: appointment.serviceName || "Service",
                providerId: appointment.providerId || null,
                providerName: provider?.businessName || null,
                completedAt: new Date(),
                costCents,
                aiSummary,
                photos: [],
                systemAffected: serviceCategory,
                notes: null,
              })
              .onConflictDoNothing();

            // Persist score after appointment-only entry creation (same as job path)
            calculateAndPersistHouseFaxScore(appointment.homeId).catch(
              (e: unknown) =>
                console.error(
                  "[HouseFax] Score persistence failed (appointment path):",
                  e,
                ),
            );
          }
        }

        // Nudge homeowner to leave a review now that the appointment is in
        // a reviewable state. Fire-and-forget; helper is deduped per-appointment
        // and skips cancelled/already-reviewed appointments.
        sendReviewNudge(req.params.id).catch((e: unknown) =>
          console.error("review nudge dispatch error:", e),
        );

        // Loyalty credits — fire-and-forget, idempotent
        if (updatedAppointment.userId) {
          const homeownerUserId = updatedAppointment.userId;
          grantFirstBookingCredit(homeownerUserId).catch((e: unknown) =>
            console.error("loyalty first_booking credit error:", e),
          );
          checkAndGrantServiceCategoryMilestone(homeownerUserId).catch((e: unknown) =>
            console.error("loyalty category milestone error:", e),
          );
        }

        res.json({ appointment: updatedAppointment });
      } catch (error) {
        console.error("Complete appointment error:", error);
        res.status(500).json({ error: "Failed to complete appointment" });
      }
    },
  );

  // ============ End HouseFax API Endpoints ============

  app.get("/api/provider-resources", async (_req: Request, res: Response) => {
    try {
      const { getProviderResources } = await import("../providerResources");
      const { resources, source, fetchedAt } = await getProviderResources();
      res.set("Cache-Control", "public, max-age=300");
      res.json({ resources, source, fetchedAt });
    } catch (error) {
      console.error("Get provider resources error:", error);
      res.status(500).json({ error: "Failed to get provider resources" });
    }
  });

  app.get("/api/categories", async (req: Request, res: Response) => {
    try {
      const categories = await storage.getCategories();
      res.json({ categories });
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ error: "Failed to get categories" });
    }
  });

  app.get("/api/services", async (req: Request, res: Response) => {
    try {
      const categoryId = req.query.categoryId as string | undefined;
      const services = await storage.getServices(categoryId);
      res.json({ services });
    } catch (error) {
      console.error("Get services error:", error);
      res.status(500).json({ error: "Failed to get services" });
    }
  });

  app.get("/api/providers", async (req: Request, res: Response) => {
    try {
      const categoryId = req.query.categoryId as string | undefined;
      const latRaw = req.query.lat as string | undefined;
      const lngRaw = req.query.lng as string | undefined;
      const userLat = latRaw !== undefined ? parseFloat(latRaw) : NaN;
      const userLng = lngRaw !== undefined ? parseFloat(lngRaw) : NaN;
      const hasUserCoords =
        Number.isFinite(userLat) && Number.isFinite(userLng);

      const providersList = await storage.getProviders(categoryId);

      if (!providersList.length) {
        return res.json({ providers: [] });
      }

      const providerIds = providersList.map((p: any) => p.id);

      // Augment each provider with plan flags and badges (Task #211, #354)
      const [planRows, badgeRows] = await Promise.all([
        db
          .select({
            providerId: providerPlans.providerId,
            isPartner: providerPlans.isPartner,
            hasFeaturedPlacement: providerPlans.hasFeaturedPlacement,
          })
          .from(providerPlans)
          .where(inArray(providerPlans.providerId, providerIds)),
        db
          .select({ providerId: providerBadges.providerId, badgeType: providerBadges.badgeType })
          .from(providerBadges)
          .where(inArray(providerBadges.providerId, providerIds)),
      ]);

      const planMap = new Map(planRows.map((r) => [r.providerId, r]));
      const badgeMap = new Map<string, string[]>();
      for (const { providerId, badgeType } of badgeRows) {
        if (!badgeMap.has(providerId)) badgeMap.set(providerId, []);
        badgeMap.get(providerId)!.push(badgeType);
      }

      // Badge tier score for search ordering (Task #354):
      // top_provider = 3, featured+verified_pro = 2, verified_pro only = 1, none = 0
      function badgeTier(pid: string): number {
        const plan = planMap.get(pid);
        const badges = badgeMap.get(pid) ?? [];
        if (badges.includes("top_provider")) return 3;
        if (plan?.hasFeaturedPlacement && badges.includes("verified_pro")) return 2;
        if (plan?.hasFeaturedPlacement || badges.includes("verified_pro")) return 1;
        return 0;
      }

      const withPlanAndBadges = providersList
        .map((p: any) => {
          const plan = planMap.get(p.id);
          return {
            ...p,
            isPartner: plan?.isPartner ?? false,
            hasFeaturedPlacement: plan?.hasFeaturedPlacement ?? false,
            badges: (badgeMap.get(p.id) ?? []).map((b) => ({ badgeType: b })),
          };
        })
        .sort((a: any, b: any) => badgeTier(b.id) - badgeTier(a.id));

      if (!hasUserCoords) {
        return res.json({ providers: withPlanAndBadges });
      }

      const enriched = withPlanAndBadges.map((p: any) => {
        const pLat =
          p.latitude !== null && p.latitude !== undefined
            ? parseFloat(p.latitude)
            : NaN;
        const pLng =
          p.longitude !== null && p.longitude !== undefined
            ? parseFloat(p.longitude)
            : NaN;
        if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) {
          return { ...p, distance: null };
        }
        const miles = haversineMiles(userLat, userLng, pLat, pLng);
        return { ...p, distance: Math.round(miles * 10) / 10 };
      });

      res.json({ providers: enriched });
    } catch (error) {
      console.error("Get providers error:", error);
      res.status(500).json({ error: "Failed to get providers" });
    }
  });

  app.get(
    "/api/providers/:id",
    async (req: Request<IdParams>, res: Response) => {
      try {
        const provider = await storage.getProvider(req.params.id);
        if (!provider) {
          return res.status(404).json({ error: "Provider not found" });
        }
        const providerServices = await storage.getProviderServices(
          req.params.id,
        );
        const bookingPolicies =
          provider.bookingPolicies &&
          typeof provider.bookingPolicies === "string"
            ? (() => {
                try {
                  return JSON.parse(provider.bookingPolicies as string);
                } catch {
                  return provider.bookingPolicies;
                }
              })()
            : provider.bookingPolicies;
        const businessHours =
          provider.businessHours && typeof provider.businessHours === "string"
            ? (() => {
                try {
                  return JSON.parse(provider.businessHours as string);
                } catch {
                  return provider.businessHours;
                }
              })()
            : provider.businessHours;
        // Surface HomeBase Partner status (Task #211) so the homeowner-
        // facing profile screen can render the Partner badge.
        const [planRow] = await db
          .select({
            isPartner: providerPlans.isPartner,
            hasFeaturedPlacement: providerPlans.hasFeaturedPlacement,
          })
          .from(providerPlans)
          .where(eq(providerPlans.providerId, req.params.id));

        // Compute distance (Task #207) when the homeowner passes their
        // coordinates, mirroring /api/providers list behavior so the
        // "Miles Away" stat on the profile matches the marketplace cards.
        const latRaw = req.query.lat as string | undefined;
        const lngRaw = req.query.lng as string | undefined;
        const userLat = latRaw !== undefined ? parseFloat(latRaw) : NaN;
        const userLng = lngRaw !== undefined ? parseFloat(lngRaw) : NaN;
        const pLat =
          provider.latitude !== null && provider.latitude !== undefined
            ? parseFloat(provider.latitude as unknown as string)
            : NaN;
        const pLng =
          provider.longitude !== null && provider.longitude !== undefined
            ? parseFloat(provider.longitude as unknown as string)
            : NaN;
        const distance =
          Number.isFinite(userLat) &&
          Number.isFinite(userLng) &&
          Number.isFinite(pLat) &&
          Number.isFinite(pLng)
            ? Math.round(haversineMiles(userLat, userLng, pLat, pLng) * 10) / 10
            : null;

        const providerBadgeRows = await db
          .select({ badgeType: providerBadges.badgeType, earnedAt: providerBadges.earnedAt })
          .from(providerBadges)
          .where(eq(providerBadges.providerId, req.params.id));

        res.json({
          provider: {
            ...provider,
            bookingPolicies,
            businessHours,
            isPartner: planRow?.isPartner ?? false,
            hasFeaturedPlacement: planRow?.hasFeaturedPlacement ?? false,
            badges: providerBadgeRows.map((r) => ({ badgeType: r.badgeType, earnedAt: r.earnedAt })),
            distance,
          },
          services: providerServices,
        });
      } catch (error) {
        console.error("Get provider error:", error);
        res.status(500).json({ error: "Failed to get provider" });
      }
    },
  );

  // ─── Neighborhood Social Proof ─────────────────────────────────────────
  // Returns aggregate booking counts filtered to a homeowner's zip code so
  // the discovery screen and provider profiles can show localized social proof.
  // Results are cached in-process for 2 hours to avoid repeated heavy joins.
  const neighborhoodStatsCache = new Map<
    string,
    { data: { areaBookingCount: number; providerCounts: Record<string, number> }; expiresAt: number }
  >();

  app.get("/api/neighborhood-stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const zip = (req.query.zip as string | undefined)?.trim();
      if (!zip) {
        return res.status(400).json({ error: "zip is required" });
      }

      // Validate that the requesting homeowner actually has a home in the
      // supplied zip code. This prevents unauthenticated or cross-zip probing
      // of aggregate booking activity.
      const authUserId = req.authenticatedUserId!;
      const callerHomes = await db
        .select({ zip: homes.zip })
        .from(homes)
        .where(eq(homes.userId, authUserId));
      const callerZips = new Set(callerHomes.map((h) => h.zip));
      if (!callerZips.has(zip)) {
        // Return empty rather than 403 — caller may not have homes yet
        return res.json({ areaBookingCount: 0, providerCounts: {} });
      }

      const now = Date.now();
      const cached = neighborhoodStatsCache.get(zip);
      if (cached && cached.expiresAt > now) {
        return res.json(cached.data);
      }

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const whereClause = and(
        eq(homes.zip, zip),
        gte(appointments.createdAt, monthStart),
        sql`${appointments.status} != 'cancelled'`,
        sql`${appointments.homeId} IS NOT NULL`,
      );

      // Count distinct homes (unique neighbor households) per provider and
      // area-wide. Using COUNT(DISTINCT homeId) ensures a homeowner who books
      // the same provider twice still counts as one neighbor.
      const [perProviderRows, areaRow] = await Promise.all([
        db
          .select({
            providerId: appointments.providerId,
            count: sql<number>`count(distinct ${appointments.homeId})::int`,
          })
          .from(appointments)
          .innerJoin(homes, eq(appointments.homeId, homes.id))
          .where(whereClause)
          .groupBy(appointments.providerId),
        db
          .select({
            count: sql<number>`count(distinct ${appointments.homeId})::int`,
          })
          .from(appointments)
          .innerJoin(homes, eq(appointments.homeId, homes.id))
          .where(whereClause),
      ]);

      const providerCounts: Record<string, number> = {};
      for (const row of perProviderRows) {
        providerCounts[row.providerId] = row.count;
      }
      const areaBookingCount = areaRow[0]?.count ?? 0;

      const data = { areaBookingCount, providerCounts };
      // Cache for 2 hours
      neighborhoodStatsCache.set(zip, { data, expiresAt: now + 2 * 60 * 60 * 1000 });

      res.json(data);
    } catch (error) {
      req.log?.error({ err: error }, "neighborhood-stats error");
      res.status(500).json({ error: "Failed to get neighborhood stats" });
    }
  });

  // ─── Provider Achievements (Task #354) ────────────────────────────────
  // Returns earned badges, stats, and progress toward next milestones for
  // the authenticated provider's own achievements screen.
  app.get(
    "/api/provider/:id/achievements",
    requireAuth,
    async (req: Request<{ id: string }>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const provider = await storage.getProvider(req.params.id);
        if (!provider || provider.userId !== authUserId) {
          return res.status(403).json({ error: "Forbidden" });
        }
        const providerId = req.params.id;

        const [badgeRows, plan, completedJobsRes, revenueRes, referralRes, fiveStarRes] =
          await Promise.all([
            db
              .select({ badgeType: providerBadges.badgeType, earnedAt: providerBadges.earnedAt })
              .from(providerBadges)
              .where(eq(providerBadges.providerId, providerId)),
            db
              .select({
                hasFeaturedPlacement: providerPlans.hasFeaturedPlacement,
                permanentDiscountPercent: providerPlans.permanentDiscountPercent,
              })
              .from(providerPlans)
              .where(eq(providerPlans.providerId, providerId))
              .limit(1)
              .then((r) => r[0] ?? null),
            db
              .select({ cnt: sql<number>`count(*)::int` })
              .from(jobs)
              .where(and(eq(jobs.providerId, providerId), eq(jobs.status, "completed")))
              .then((r) => r[0]?.cnt ?? 0),
            db
              .select({ total: sql<string>`coalesce(sum(final_price), 0)` })
              .from(jobs)
              .where(and(eq(jobs.providerId, providerId), eq(jobs.status, "completed")))
              .then((r) => r[0]?.total ?? "0"),
            db
              .select({ cnt: sql<number>`count(*)::int` })
              .from(providerReferrals)
              .where(
                and(
                  eq(providerReferrals.referrerProviderId, providerId),
                  sql`${providerReferrals.rewardGrantedAt} IS NOT NULL`,
                ),
              )
              .then((r) => r[0]?.cnt ?? 0),
            db
              .select({ id: reviews.id })
              .from(reviews)
              .where(and(eq(reviews.providerId, providerId), eq(reviews.rating, 5)))
              .limit(1)
              .then((r) => r.length > 0),
          ]);

        const completedJobs = completedJobsRes;
        const totalRevenueDollars = parseFloat(String(revenueRes));
        const totalRevenueCents = isNaN(totalRevenueDollars) ? 0 : Math.round(totalRevenueDollars * 100);
        const referralCount = referralRes;
        const hasFiveStar = fiveStarRes;

        const earnedBadgeTypes = new Set(badgeRows.map((b) => b.badgeType));

        // Also fetch unique client count and recurring job presence for new badge milestones
        const [uniqueClientsRes, hasRecurringRes, providerRow] = await Promise.all([
          db
            .select({ cnt: sql<number>`count(distinct client_id)::int` })
            .from(jobs)
            .where(and(eq(jobs.providerId, providerId), eq(jobs.status, "completed")))
            .then((r) => r[0]?.cnt ?? 0),
          db
            .select({ id: jobs.id })
            .from(jobs)
            .where(and(eq(jobs.providerId, providerId), sql`${jobs.seriesId} IS NOT NULL`))
            .limit(1)
            .then((r) => r.length > 0),
          db
            .select({ currentBookingStreak: providers.currentBookingStreak, lastStreakDate: providers.lastStreakDate })
            .from(providers)
            .where(eq(providers.id, providerId))
            .limit(1)
            .then((r) => r[0] ?? null),
        ]);

        const uniqueClients = uniqueClientsRes;
        const hasRecurring = hasRecurringRes;
        const displayStreak = providerRow
          ? effectiveStreak(providerRow.currentBookingStreak ?? 0, providerRow.lastStreakDate ?? null)
          : 0;

        const nextMilestones: Array<{
          key: string;
          label: string;
          description: string;
          progress: number;
          target: number;
          rewardLabel: string;
          earned: boolean;
          badgeType?: string;
        }> = [
          {
            key: "first_job",
            label: "First Job",
            description: "Complete your first job",
            progress: Math.min(completedJobs, 1),
            target: 1,
            rewardLabel: "First Job badge on your profile",
            earned: earnedBadgeTypes.has("first_job"),
            badgeType: "first_job",
          },
          {
            key: "first_thousand",
            label: "First $1K",
            description: "Earn your first $1,000",
            progress: Math.min(totalRevenueCents, 1000 * 100),
            target: 1000 * 100,
            rewardLabel: "First $1K badge on your profile",
            earned: earnedBadgeTypes.has("first_thousand"),
            badgeType: "first_thousand",
          },
          {
            key: "ten_clients",
            label: "10 Clients",
            description: "Complete jobs for 10 different clients",
            progress: Math.min(uniqueClients, 10),
            target: 10,
            rewardLabel: "10 Clients badge on your profile",
            earned: earnedBadgeTypes.has("ten_clients"),
            badgeType: "ten_clients",
          },
          {
            key: "first_recurring",
            label: "Recurring Pro",
            description: "Land your first recurring job",
            progress: hasRecurring ? 1 : 0,
            target: 1,
            rewardLabel: "Recurring Pro badge on your profile",
            earned: earnedBadgeTypes.has("first_recurring"),
            badgeType: "first_recurring",
          },
          {
            key: "first_five_star",
            label: "5-Star",
            description: "Earn your first 5-star review",
            progress: hasFiveStar ? 1 : 0,
            target: 1,
            rewardLabel: "5-Star badge + featured placement in search",
            earned: earnedBadgeTypes.has("first_five_star"),
            badgeType: "first_five_star",
          },
          {
            key: "10_jobs",
            label: "Verified Pro",
            description: "Complete 10 jobs",
            progress: Math.min(completedJobs, 10),
            target: 10,
            rewardLabel: "Verified Pro badge on your profile",
            earned: earnedBadgeTypes.has("verified_pro"),
            badgeType: "verified_pro",
          },
          {
            key: "25_jobs",
            label: "1 Free Month",
            description: "Complete 25 jobs",
            progress: Math.min(completedJobs, 25),
            target: 25,
            rewardLabel: "1 free month added to your subscription",
            earned: completedJobs >= 25,
            badgeType: "twenty_five_jobs",
          },
          {
            key: "3_referrals",
            label: "Permanent 10% Discount",
            description: "Refer 3 providers who complete their first job",
            progress: Math.min(referralCount, 3),
            target: 3,
            rewardLabel: "Permanent 10% discount on your subscription",
            earned: (plan?.permanentDiscountPercent ?? 0) >= 10,
          },
          {
            key: "10k_revenue",
            label: "Top Provider",
            description: "Process $10,000 through HomeBase",
            progress: Math.min(totalRevenueCents, 10000 * 100),
            target: 10000 * 100,
            rewardLabel: "Top Provider badge + priority search listing",
            earned: earnedBadgeTypes.has("top_provider"),
            badgeType: "top_provider",
          },
        ];

        res.json({
          badges: badgeRows.map((b) => ({ badgeType: b.badgeType, earnedAt: b.earnedAt })),
          stats: {
            completedJobs,
            totalRevenueCents,
            referralCount,
            hasFiveStar,
            hasFeaturedPlacement: plan?.hasFeaturedPlacement ?? false,
            permanentDiscountPercent: plan?.permanentDiscountPercent ?? 0,
            uniqueClients,
            displayStreak,
          },
          nextMilestones,
        });
      } catch (error) {
        console.error("Get achievements error:", error);
        res.status(500).json({ error: "Failed to get achievements" });
      }
    },
  );

  // ─── Home Health Score ─────────────────────────────────────────────────
  // Computes a 0–100 score for the authenticated homeowner based on how
  // recently each tracked service category was last serviced.
  app.get(
    "/api/homeowner/home-health",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.authenticatedUserId!;
        const result = await computeHomeHealth(userId);
        res.json(result);
      } catch (error) {
        console.error("Home health score error:", error);
        res.status(500).json({ error: "Failed to compute home health score" });
      }
    },
  );

  // ─── Saved Providers ──────────────────────────────────────────────────
  // Homeowner's list of saved/favorited providers, joined with provider data
  // so the SavedProvidersScreen can render without a second round-trip.
  app.get(
    "/api/saved-providers",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const rows = await db
          .select({
            id: providers.id,
            name: providers.businessName,
            avatarUrl: providers.avatarUrl,
            rating: providers.rating,
            reviewCount: providers.reviewCount,
            serviceArea: providers.serviceArea,
            hourlyRate: providers.hourlyRate,
            capabilityTags: providers.capabilityTags,
            savedAt: savedProviders.createdAt,
          })
          .from(savedProviders)
          .innerJoin(providers, eq(savedProviders.providerId, providers.id))
          .where(eq(savedProviders.userId, authUserId))
          .orderBy(desc(savedProviders.createdAt));

        const items = rows.map((r) => ({
          id: r.id,
          name: r.name,
          category: Array.isArray(r.capabilityTags) && r.capabilityTags.length > 0 ? r.capabilityTags[0] : "Service Provider",
          rating: r.rating ? Number(r.rating) : 0,
          reviewCount: r.reviewCount ?? 0,
          serviceArea: r.serviceArea ?? "",
          startingPrice: r.hourlyRate ? Number(r.hourlyRate) : null,
          avatarUrl: r.avatarUrl ?? undefined,
          tags: Array.isArray(r.capabilityTags) ? r.capabilityTags.slice(0, 3) : [],
          savedAt: (r.savedAt instanceof Date ? r.savedAt : new Date(r.savedAt)).toISOString(),
        }));
        res.json({ providers: items });
      } catch (error) {
        console.error("Get saved providers error:", error);
        res.status(500).json({ error: "Failed to get saved providers" });
      }
    },
  );

  app.post(
    "/api/saved-providers/:providerId",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const provider = await storage.getProvider(req.params.providerId);
        if (!provider) return res.status(404).json({ error: "Provider not found" });
        await db
          .insert(savedProviders)
          .values({ userId: authUserId, providerId: req.params.providerId })
          .onConflictDoNothing();
        res.status(201).json({ ok: true });
      } catch (error) {
        console.error("Save provider error:", error);
        res.status(500).json({ error: "Failed to save provider" });
      }
    },
  );

  app.delete(
    "/api/saved-providers/:providerId",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        await db
          .delete(savedProviders)
          .where(and(eq(savedProviders.userId, authUserId), eq(savedProviders.providerId, req.params.providerId)));
        res.json({ ok: true });
      } catch (error) {
        console.error("Unsave provider error:", error);
        res.status(500).json({ error: "Failed to unsave provider" });
      }
    },
  );

  // ─── Review Reports (UGC moderation, Apple Guideline 1.2) ─────────────
  app.post(
    "/api/reviews/:id/report",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const reason = String(req.body?.reason ?? "").trim();
        const details = req.body?.details ? String(req.body.details).trim().slice(0, 1000) : null;
        if (!reason) {
          return res.status(400).json({ error: "Reason is required" });
        }
        const [review] = await db.select().from(reviews).where(eq(reviews.id, req.params.id)).limit(1);
        if (!review) return res.status(404).json({ error: "Review not found" });

        const [report] = await db
          .insert(reviewReports)
          .values({
            reviewId: req.params.id,
            reporterUserId: authUserId,
            reason,
            details,
          })
          .returning();

        // Email the moderation team so a human can act within 24h (App Store req).
        (async () => {
          try {
            const [reporter] = await db.select().from(users).where(eq(users.id, authUserId)).limit(1);
            const reporterName = reporter ? `${reporter.firstName || ""} ${reporter.lastName || ""}`.trim() || reporter.email : authUserId;
            await sendSupportTicketEmail({
              ticketId: report.id,
              email: reporter?.email || "unknown@homebaseproapp.com",
              name: reporterName,
              subject: `Review report: ${reason}`,
              message:
                `Review ID: ${req.params.id}\n` +
                `Provider ID: ${review.providerId}\n` +
                `Reason: ${reason}\n` +
                (details ? `Details: ${details}\n` : "") +
                `Original review: ${review.comment ?? "(no text)"}`,
              category: "moderation",
            });
          } catch (e) {
            console.error("review.report email failed:", e);
          }
        })();

        res.status(201).json({ report });
      } catch (error) {
        console.error("Report review error:", error);
        res.status(500).json({ error: "Failed to report review" });
      }
    },
  );

  app.get(
    "/api/users/:userId/appointments",
    requireAuth,
    async (req: Request<UserIdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        if (req.params.userId !== authUserId) {
          return res.status(403).json({ error: "Access denied" });
        }
        const appointments = await storage.getAppointments(req.params.userId);
        res.json({ appointments });
      } catch (error) {
        console.error("Get appointments error:", error);
        res.status(500).json({ error: "Failed to get appointments" });
      }
    },
  );

  app.get(
    "/api/appointment/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const appointment = await storage.getAppointment(req.params.id);
        if (!appointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }
        const providerRecord = await storage.getProviderByUserId(authUserId);
        const isOwner = appointment.userId === authUserId;
        const isProvider =
          providerRecord && appointment.providerId === providerRecord.id;
        if (!isOwner && !isProvider) {
          return res.status(403).json({ error: "Access denied" });
        }
        const provider = await storage.getProvider(appointment.providerId);

        let statusHistory = [];
        if (appointment.statusHistory) {
          try {
            statusHistory = JSON.parse(appointment.statusHistory);
          } catch (e) {
            statusHistory = [];
          }
        }

        let [linkedJob] = await db
          .select()
          .from(jobs)
          .where(eq(jobs.appointmentId, appointment.id))
          .orderBy(desc(jobs.createdAt))
          .limit(1);

        // Task #226: defense-in-depth fallback for legacy rows where
        // `jobs.appointment_id` was never back-linked at insert time. Match
        // by (provider_id, scheduled_date) restricted to clients owned by
        // this homeowner (clients.homeowner_user_id = appointment.user_id).
        // Ensures iOS and web render identical Appointment Detail screens
        // even for unlinked historical bookings.
        if (
          !linkedJob &&
          appointment.userId &&
          appointment.scheduledDate
        ) {
          const candidateClients = await db
            .select({ id: clients.id })
            .from(clients)
            .where(
              and(
                eq(clients.providerId, appointment.providerId),
                eq(clients.homeownerUserId, appointment.userId),
              ),
            );
          if (candidateClients.length > 0) {
            const clientIds = candidateClients.map((c) => c.id);
            const [fallbackJob] = await db
              .select()
              .from(jobs)
              .where(
                and(
                  eq(jobs.providerId, appointment.providerId),
                  eq(jobs.scheduledDate, appointment.scheduledDate),
                  inArray(jobs.clientId, clientIds),
                ),
              )
              .orderBy(desc(jobs.createdAt))
              .limit(1);
            if (fallbackJob) linkedJob = fallbackJob;
          }
        }

        let linkedInvoice = null;
        if (linkedJob) {
          const [inv] = await db
            .select()
            .from(invoices)
            .where(eq(invoices.jobId, linkedJob.id))
            .orderBy(desc(invoices.createdAt))
            .limit(1);
          if (inv) linkedInvoice = inv;
        }

        // Task #230: broaden invoice discoverability for the homeowner.
        // Many invoices are not back-linked to the appointment's job, so also
        // try matching by (provider_id, homeowner_user_id) — preferring the
        // most recent unpaid one — so the homeowner sees the invoice their
        // provider has already sent on Stripe.
        if (!linkedInvoice && appointment.userId) {
          const candidateInvoices = await db
            .select()
            .from(invoices)
            .where(
              and(
                eq(invoices.providerId, appointment.providerId),
                eq(invoices.homeownerUserId, appointment.userId),
              ),
            )
            .orderBy(desc(invoices.createdAt))
            .limit(10);
          // Only consider invoices the homeowner can actually act on — i.e.
          // ones the provider has sent (sent/overdue) or already settled
          // (paid/closed). Skip drafts and cancelled invoices so the
          // homeowner never sees an in-progress or aborted invoice.
          const VISIBLE_STATUSES = new Set([
            "sent",
            "overdue",
            "paid",
            "closed",
          ]);
          const visible = candidateInvoices.filter((inv) =>
            VISIBLE_STATUSES.has(inv.status),
          );
          // Prefer payable (sent/overdue), and within that prefer one whose
          // due date is closest to the appointment date (±60d).
          const apptTime = appointment.scheduledDate
            ? new Date(appointment.scheduledDate).getTime()
            : null;
          const sixtyDays = 60 * 24 * 60 * 60 * 1000;
          const payable = visible.filter(
            (inv) => inv.status === "sent" || inv.status === "overdue",
          );
          const nearPayable = apptTime
            ? payable.find((inv) => {
                const dt = inv.dueDate ? new Date(inv.dueDate).getTime() : 0;
                return dt && Math.abs(dt - apptTime) <= sixtyDays;
              })
            : null;
          linkedInvoice =
            nearPayable ?? payable[0] ?? visible[0] ?? null;
        }

        // Task #230 (legacy): older invoices were created before the
        // `homeowner_user_id` column on `invoices` was wired up, so they may
        // be linked only via `clients` (provider's CRM record). When the
        // primary lookup found nothing, walk the appointment client → clients
        // table and find invoices for that client (or any client whose
        // cached homeowner matches this appointment's homeowner) so legacy
        // invoices still surface for the homeowner.
        if (!linkedInvoice && appointment.userId) {
          const matchingClients = await db
            .select({ id: clients.id })
            .from(clients)
            .where(
              and(
                eq(clients.providerId, appointment.providerId),
                eq(clients.homeownerUserId, appointment.userId),
              ),
            );
          const clientIds = matchingClients.map((c) => c.id);
          if (clientIds.length > 0) {
            const legacyCandidates = await db
              .select()
              .from(invoices)
              .where(
                and(
                  eq(invoices.providerId, appointment.providerId),
                  inArray(invoices.clientId, clientIds),
                  isNull(invoices.homeownerUserId),
                ),
              )
              .orderBy(desc(invoices.createdAt))
              .limit(10);
            const VISIBLE_STATUSES = new Set([
              "sent",
              "overdue",
              "paid",
              "closed",
            ]);
            const visible = legacyCandidates.filter((inv) =>
              VISIBLE_STATUSES.has(inv.status),
            );
            const apptTime = appointment.scheduledDate
              ? new Date(appointment.scheduledDate).getTime()
              : null;
            const sixtyDays = 60 * 24 * 60 * 60 * 1000;
            const payable = visible.filter(
              (inv) => inv.status === "sent" || inv.status === "overdue",
            );
            const nearPayable = apptTime
              ? payable.find((inv) => {
                  const dt = inv.dueDate
                    ? new Date(inv.dueDate).getTime()
                    : 0;
                  return dt && Math.abs(dt - apptTime) <= sixtyDays;
                })
              : null;
            linkedInvoice =
              nearPayable ?? payable[0] ?? visible[0] ?? null;
          }
        }

        // Make sure the invoice carries a usable hostedInvoiceUrl. If it
        // hasn't been generated yet (or got cleared), generate it on demand
        // using the same Stripe helper the provider's "Get Payment Link"
        // route uses, then persist it. Failures are non-fatal — the client
        // can retry on tap.
        if (
          linkedInvoice &&
          !linkedInvoice.hostedInvoiceUrl &&
          linkedInvoice.status !== "draft" &&
          linkedInvoice.status !== "cancelled"
        ) {
          try {
            const result = await sendStripeInvoiceEmail(linkedInvoice.id);
            if (result?.hostedInvoiceUrl) {
              linkedInvoice = {
                ...linkedInvoice,
                hostedInvoiceUrl: result.hostedInvoiceUrl,
              };
            }
          } catch (err) {
            console.warn(
              "[appointment] hosted invoice URL generation skipped:",
              (err as Error)?.message,
            );
          }
        }

        // Surface the homeowner's review (if any) so the appointment screen
        // can switch the "Leave a Review" affordance to "View your review".
        const [reviewRow] = await db
          .select()
          .from(reviews)
          .where(eq(reviews.appointmentId, appointment.id))
          .limit(1);

        res.json({
          appointment: {
            ...appointment,
            statusHistory,
            provider: provider
              ? {
                  id: provider.id,
                  businessName: provider.businessName,
                  rating: provider.rating,
                  reviewCount: provider.reviewCount,
                  phone: provider.phone,
                  email: provider.email,
                  avatarUrl: provider.avatarUrl,
                  slug: provider.slug ?? null,
                }
              : null,
            job: linkedJob
              ? {
                  id: linkedJob.id,
                  status: linkedJob.status,
                  title: linkedJob.title,
                  description: linkedJob.description,
                  address: linkedJob.address,
                  estimatedDuration: linkedJob.estimatedDuration,
                  estimatedPrice: linkedJob.estimatedPrice,
                  finalPrice: linkedJob.finalPrice,
                  notes: linkedJob.notes,
                  scheduledDate: linkedJob.scheduledDate,
                  scheduledTime: linkedJob.scheduledTime,
                  completedAt: linkedJob.completedAt,
                  checklistCount: Array.isArray(linkedJob.checklist)
                    ? linkedJob.checklist.length
                    : 0,
                }
              : null,
            invoice: linkedInvoice,
            review: reviewRow ?? null,
          },
        });
      } catch (error) {
        console.error("Get appointment error:", error);
        res.status(500).json({ error: "Failed to get appointment" });
      }
    },
  );

  app.post(
    "/api/appointments",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const parsed = insertAppointmentSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "Invalid input", details: parsed.error.issues });
        }
        const VALID_FREQUENCIES = ["biweekly", "monthly", "quarterly"];
        if (
          parsed.data.recurringFrequency &&
          !VALID_FREQUENCIES.includes(parsed.data.recurringFrequency)
        ) {
          return res.status(400).json({
            error: "Invalid recurringFrequency",
            allowed: VALID_FREQUENCIES,
          });
        }

        // Enforce that the appointment is created for the authenticated user only.
        // Override any client-supplied userId with the authenticated user's ID.
        const authUserId = req.authenticatedUserId!;
        parsed.data.userId = authUserId;

        // If a homeId was supplied, verify it belongs to the authenticated user.
        if (parsed.data.homeId) {
          const home = await storage.getHome(parsed.data.homeId);
          if (!home || home.userId !== authUserId) {
            return res.status(403).json({ error: "Access denied to the specified home" });
          }
        }

        // Task #226: route-level idempotency. If an appointment already
        // exists for this (user, provider, slot), return it immediately
        // without re-running the downstream client-create / job-create /
        // notification side-effects. Without this short-circuit, a
        // double-tapped Book button would still produce a duplicate Job
        // even though the underlying storage layer dedupes the appointment.
        if (parsed.data.userId && parsed.data.scheduledDate) {
          const [preExisting] = await db
            .select()
            .from(appointments)
            .where(
              and(
                eq(appointments.userId, parsed.data.userId),
                eq(appointments.providerId, parsed.data.providerId),
                eq(
                  appointments.scheduledDate,
                  parsed.data.scheduledDate as Date,
                ),
              ),
            )
            .limit(1);
          if (preExisting) {
            return res.json({ appointment: preExisting, reused: true });
          }
        }

        const { appointment, created: appointmentCreated } =
          await storage.createAppointment(parsed.data);

        // Task #226: if storage layer detected a duplicate slot (race
        // window between the route pre-check and the insert), short-circuit
        // before re-running the client/job/notification side-effects so we
        // don't double-fire downstream work.
        if (!appointmentCreated) {
          return res.json({ appointment, reused: true });
        }

        // ── Task #236: deposit policy enforcement ────────────────────────
        // If the provider requires a deposit, hold the appointment in
        // `pending` with `depositStatus = 'awaiting'`, mint a Stripe
        // Checkout Session, and return its URL. The webhook flips the
        // appointment to `confirmed` + `depositStatus = paid` once the
        // homeowner completes payment.
        //
        // Hard-enforcement: if Checkout Session creation fails for any
        // reason OTHER than the provider simply not having Stripe set up
        // (`stripe_not_ready`), we ROLL BACK the appointment and surface
        // a 502 — it is better to fail the booking than to leave a
        // dangling record that the homeowner thinks is confirmed without
        // having paid the required deposit.
        let depositCheckoutUrl: string | null = null;
        let depositAmountCents = 0;
        const [policyProvider] = await db
          .select({ bookingPolicies: providers.bookingPolicies })
          .from(providers)
          .where(eq(providers.id, parsed.data.providerId));
        const policy = normalizeBookingPolicy(
          policyProvider?.bookingPolicies,
        );
        const totalCents = dollarsToCents(parsed.data.estimatedPrice);
        depositAmountCents = computeDepositCents(policy, totalCents);
        if (depositAmountCents > 0) {
          await db
            .update(appointments)
            .set({
              depositStatus: "awaiting",
              depositAmountCents,
              status: "pending",
              updatedAt: new Date(),
            })
            .where(eq(appointments.id, appointment.id));
          try {
            const session = await createDepositCheckoutSession({
              appointmentId: appointment.id,
              providerId: parsed.data.providerId,
              amountCents: depositAmountCents,
              description: `${parsed.data.serviceName} on ${
                typeof parsed.data.scheduledDate === "string"
                  ? parsed.data.scheduledDate
                  : (parsed.data.scheduledDate as Date)
                      .toISOString()
                      .slice(0, 10)
              } at ${parsed.data.scheduledTime}`,
            });
            depositCheckoutUrl = session.checkoutUrl;
          } catch (depositErr: unknown) {
            const code =
              typeof depositErr === "object" &&
              depositErr !== null &&
              "code" in depositErr
                ? (depositErr as { code?: string }).code
                : undefined;
            if (code === "stripe_not_ready") {
              // Provider hasn't completed Stripe Connect; degrade
              // gracefully — confirm the booking without a deposit so
              // the homeowner isn't blocked. Mark depositStatus so
              // providers can see the policy was bypassed.
              console.warn(
                "[booking-deposit] provider not Stripe-ready, skipping deposit",
                parsed.data.providerId,
              );
              await db
                .update(appointments)
                .set({
                  depositStatus: "skipped_no_stripe",
                  depositAmountCents: 0,
                  status: "confirmed",
                  updatedAt: new Date(),
                })
                .where(eq(appointments.id, appointment.id));
              depositAmountCents = 0;
              depositCheckoutUrl = null;
            } else {
              // Hard fail: roll back the appointment so the slot is
              // freed and the homeowner gets a clear error rather than
              // a "confirmed" appointment they never paid for.
              console.error(
                "[booking-deposit] Stripe Checkout session creation failed",
                depositErr,
              );
              await db
                .delete(appointments)
                .where(eq(appointments.id, appointment.id));
              return res.status(502).json({
                error: "deposit_charge_failed",
                message:
                  "We couldn't set up the deposit payment for this booking. Please try again in a moment.",
              });
            }
          }
        }

        // Find or create a client record in the provider's client list
        let clientId: string | null = null;
        try {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, parsed.data.userId));
          if (user) {
            const existingClients = await db
              .select()
              .from(clients)
              .where(eq(clients.providerId, parsed.data.providerId));
            const matchingClient = existingClients.find(
              (c) =>
                c.email === user.email ||
                (c.firstName === (user.firstName || "") &&
                  c.phone === user.phone),
            );
            if (matchingClient) {
              clientId = matchingClient.id;
            } else {
              const [newClient] = await db
                .insert(clients)
                .values({
                  providerId: parsed.data.providerId,
                  firstName: user.firstName || "Unknown",
                  lastName: user.lastName || "",
                  email: user.email,
                  phone: user.phone || "",
                })
                .returning();
              clientId = newClient.id;
            }
          }
        } catch (clientErr) {
          console.error("Client find/create error (non-fatal):", clientErr);
        }

        // Create a provider job record linked to this appointment
        if (clientId) {
          try {
            // Validate customServiceId belongs to this provider before persisting to jobs.
            // Also pull intakeQuestionsJson so we can resolve answer labels via
            // the shared formatter and store a description that matches the
            // shape produced by both the provider and public booking flows.
            const rawCustomSvcId =
              typeof req.body.customServiceId === "string"
                ? req.body.customServiceId
                : null;
            let apptCustomServiceId: string | null = null;
            let apptSvcIntakeQuestionsJson: string | null = null;
            let apptSvcChecklistTemplate:
              | { id: string; label: string }[]
              | null = null;
            if (rawCustomSvcId) {
              const [ownedSvc] = await db
                .select({
                  id: providerCustomServices.id,
                  intakeQuestionsJson:
                    providerCustomServices.intakeQuestionsJson,
                  checklistTemplateJson:
                    providerCustomServices.checklistTemplateJson,
                })
                .from(providerCustomServices)
                .where(
                  and(
                    eq(providerCustomServices.id, rawCustomSvcId),
                    eq(
                      providerCustomServices.providerId,
                      parsed.data.providerId,
                    ),
                  ),
                )
                .catch(() => [null]);
              if (ownedSvc) {
                apptCustomServiceId = rawCustomSvcId;
                apptSvcIntakeQuestionsJson = ownedSvc.intakeQuestionsJson;
                apptSvcChecklistTemplate = Array.isArray(
                  ownedSvc.checklistTemplateJson,
                )
                  ? ownedSvc.checklistTemplateJson
                  : null;
              }
            }

            // Recompose description via the shared formatter as the canonical
            // server-side source of truth. Add-ons sent by the client (when
            // present) are included so the description mirrors what the
            // provider sees in Add Job and the public booking page produces.
            const apptAddOns = Array.isArray(req.body.addOns)
              ? (req.body.addOns as unknown[])
                  .filter(
                    (a): a is Record<string, unknown> =>
                      typeof a === "object" && a !== null,
                  )
                  .map((a) => ({
                    name: String(a.name ?? "").slice(0, 200),
                    price:
                      typeof a.price === "number"
                        ? a.price
                        : parseFloat(String(a.price ?? "0")) || 0,
                  }))
                  .filter((a) => a.name.length > 0)
              : [];
            // Normalize service name to base form (strip " + addon" suffix)
            // so jobs.title and the formatter input are consistent across all
            // entry points; add-ons are conveyed via the structured array.
            const baseApptServiceName = (parsed.data.serviceName ?? "")
              .split(" + ")[0]
              .trim();
            const composedApptDescription = formatJobSummary({
              serviceName: baseApptServiceName || null,
              problemDescription: parsed.data.description ?? null,
              intakeAnswers: parseIntakeAnswers(req.body.answersJson),
              intakeQuestions: parseIntakeQuestions(apptSvcIntakeQuestionsJson),
              addOns: apptAddOns,
            });

            // Materialize the service's checklist template (or []) so this
            // homeowner-portal-originated job carries the same per-service
            // checklist snapshot as provider-created jobs.
            const apptInitialChecklist = Array.isArray(apptSvcChecklistTemplate)
              ? apptSvcChecklistTemplate
                  .filter(
                    (it) =>
                      it &&
                      typeof it.label === "string" &&
                      it.label.trim().length > 0,
                  )
                  .map((it, i) => ({
                    id: String(it.id ?? `c_${Date.now()}_${i}`),
                    label: String(it.label).slice(0, 200),
                    completed: false,
                  }))
              : [];

            await db.insert(jobs).values({
              providerId: parsed.data.providerId,
              clientId,
              appointmentId: appointment.id,
              customServiceId: apptCustomServiceId,
              title: baseApptServiceName || parsed.data.serviceName,
              description:
                composedApptDescription || parsed.data.description || null,
              scheduledDate: parsed.data.scheduledDate,
              scheduledTime: parsed.data.scheduledTime,
              estimatedDuration: 60,
              status: "scheduled",
              estimatedPrice: parsed.data.estimatedPrice ?? null,
              notes: `Booked via homeowner portal.`,
              checklist: apptInitialChecklist,
            });
            // Advance streak for the provider on a new scheduled booking day.
            if (parsed.data.providerId) {
              updateProviderStreak(parsed.data.providerId).catch((e: unknown) =>
                console.error("streak update (booking scheduled) error:", e),
              );
            }
          } catch (jobErr) {
            console.error("Job creation error (non-fatal):", jobErr);
          }
        }

        // Task #236: when a deposit is required, the booking is held in
        // `pending` until the webhook confirms payment — don't claim
        // "Booking Confirmed" yet. The webhook fires the confirmed
        // notification + booking.created email once the deposit clears.
        const depositPending = !!depositCheckoutUrl;
        if (depositPending) {
          await storage.createNotification(
            parsed.data.userId,
            "Deposit Required",
            `Complete the deposit payment to confirm your ${parsed.data.serviceName} booking.`,
            "booking_deposit_pending",
            JSON.stringify({
              appointmentId: appointment.id,
              depositCheckoutUrl,
              depositAmountCents,
            }),
          );
        } else {
          await storage.createNotification(
            parsed.data.userId,
            "Booking Confirmed",
            `Your ${parsed.data.serviceName} appointment has been scheduled.`,
            "booking_confirmed",
            JSON.stringify({ appointmentId: appointment.id }),
          );
        }

        // Fire booking confirmation emails (fire-and-forget). Skip when a
        // deposit is still awaiting — the webhook fires the email once
        // the deposit payment clears so we don't email "Booking
        // Confirmed!" before the homeowner has actually paid.
        const [bookedUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, parsed.data.userId))
          .catch(() => [null]);
        const [bookedProvider] = await db
          .select()
          .from(providers)
          .where(eq(providers.id, parsed.data.providerId))
          .catch(() => [null]);
        if (bookedUser && bookedProvider && !depositPending) {
          // Extract base service name (before " + " add-on suffix) for DB lookup
          const baseServiceName = parsed.data.serviceName
            .split(" + ")[0]
            .trim();

          // Resolve add-on names: explicit structured array takes priority over service-name suffix parsing
          const explicitAddOns = req.body.addOns;
          const derivedAddOnNames: string[] | undefined = (() => {
            if (Array.isArray(explicitAddOns) && explicitAddOns.length > 0) {
              return explicitAddOns
                .map((a: unknown) =>
                  typeof a === "string"
                    ? a
                    : typeof a === "object" && a !== null && "name" in a
                      ? String((a as { name: unknown }).name)
                      : null,
                )
                .filter((n): n is string => Boolean(n));
            }
            // Fall back to parsing add-on suffix from service name ("Base + Addon1, Addon2")
            if (parsed.data.serviceName.includes(" + ")) {
              const addonSuffix = parsed.data.serviceName
                .split(" + ")
                .slice(1)
                .join(" + ");
              const names = addonSuffix
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              return names.length > 0 ? names : undefined;
            }
            // Final fallback: attempt to parse structured add-ons from appointment notes JSON
            if (appointment.notes) {
              try {
                const notesData = JSON.parse(appointment.notes);
                if (notesData.addOns && Array.isArray(notesData.addOns)) {
                  const names = notesData.addOns
                    .map((a: unknown) =>
                      typeof a === "string"
                        ? a
                        : typeof a === "object" && a !== null && "name" in a
                          ? String((a as { name: unknown }).name)
                          : null,
                    )
                    .filter(
                      (n: unknown): n is string =>
                        typeof n === "string" && n.length > 0,
                    );
                  return names.length > 0 ? names : undefined;
                }
              } catch {
                /* notes is not JSON */
              }
            }
            return undefined;
          })();

          // Look up custom service: prefer ID-based match (if customServiceId sent), fall back to name
          // Note: req.body.customServiceId references provider_custom_services.id (not appointments.serviceId FK)
          const bodyServiceId =
            typeof req.body.customServiceId === "string"
              ? req.body.customServiceId
              : undefined;
          const [matchedSvc] = await db
            .select({
              description: providerCustomServices.description,
            })
            .from(providerCustomServices)
            .where(
              and(
                eq(providerCustomServices.providerId, bookedProvider.id),
                bodyServiceId
                  ? eq(providerCustomServices.id, bodyServiceId)
                  : and(
                      eq(providerCustomServices.name, baseServiceName),
                      eq(providerCustomServices.isPublished, true),
                    ),
              ),
            )
            .catch(() => [null]);

          // Build intakeAnswers from answersJson (raw body field) — accept both string-encoded and object shapes
          const rawAnswersJson = req.body.answersJson;
          let intakeAnswersSummary: string | undefined;
          const formatAnswersObj = (
            obj: Record<string, unknown>,
          ): string | undefined => {
            const lines = Object.entries(obj)
              .filter(([, v]) => v != null && v !== "")
              .map(([k, v]) => `${k}: ${v}`);
            return lines.length > 0 ? lines.join("\n") : undefined;
          };
          if (rawAnswersJson) {
            if (
              typeof rawAnswersJson === "object" &&
              rawAnswersJson !== null &&
              !Array.isArray(rawAnswersJson)
            ) {
              // Already parsed by express body-parser
              intakeAnswersSummary = formatAnswersObj(
                rawAnswersJson as Record<string, unknown>,
              );
            } else if (typeof rawAnswersJson === "string") {
              try {
                const answersObj = JSON.parse(rawAnswersJson);
                if (
                  typeof answersObj === "object" &&
                  answersObj !== null &&
                  !Array.isArray(answersObj)
                ) {
                  intakeAnswersSummary = formatAnswersObj(answersObj);
                } else if (typeof answersObj === "string") {
                  intakeAnswersSummary = answersObj;
                }
              } catch {
                /* ignore invalid JSON */
              }
            }
          }
          // Secondary fallback: customer problem description
          if (!intakeAnswersSummary && parsed.data.description) {
            intakeAnswersSummary = parsed.data.description;
          }
          // Tertiary fallback: appointment notes (may contain additional context in alternate flows)
          if (
            !intakeAnswersSummary &&
            appointment.notes &&
            appointment.notes !== "Booked via homeowner portal."
          ) {
            intakeAnswersSummary = appointment.notes;
          }

          dispatch("booking.created", {
            clientEmail: bookedUser.email,
            clientName:
              `${bookedUser.firstName || ""} ${bookedUser.lastName || ""}`.trim() ||
              bookedUser.email,
            providerEmail: bookedProvider.email ?? undefined,
            providerName: bookedProvider.businessName,
            serviceName: parsed.data.serviceName,
            appointmentDate: parsed.data.scheduledDate,
            appointmentTime: parsed.data.scheduledTime,
            estimatedPrice: parsed.data.estimatedPrice ?? undefined,
            confirmationNumber: appointment.id,
            description: parsed.data.description ?? undefined,
            serviceDescription: matchedSvc?.description ?? undefined,
            intakeAnswers: intakeAnswersSummary,
            addOns: derivedAddOnNames,
            relatedRecordType: "appointment",
            relatedRecordId: appointment.id,
            recipientUserId: bookedUser.id,
          }).catch((e: unknown) =>
            console.error("booking.created dispatch error:", e),
          );
        }

        // Re-fetch the appointment so the response reflects the latest
        // depositStatus / depositAmountCents written above.
        const [finalAppt] = await db
          .select()
          .from(appointments)
          .where(eq(appointments.id, appointment.id));
        res.status(201).json({
          appointment: finalAppt ?? appointment,
          requiresDeposit: depositAmountCents > 0 && !!depositCheckoutUrl,
          depositAmountCents,
          depositCheckoutUrl,
        });
      } catch (error) {
        console.error("Create appointment error:", error);
        res.status(500).json({ error: "Failed to create appointment" });
      }
    },
  );

  app.put(
    "/api/appointments/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const existing = await storage.getAppointment(req.params.id);
        if (!existing)
          return res.status(404).json({ error: "Appointment not found" });
        const providerRecord = await storage.getProviderByUserId(authUserId);
        const isOwner = existing.userId === authUserId;
        const isProvider =
          providerRecord && existing.providerId === providerRecord.id;
        if (!isOwner && !isProvider)
          return res.status(403).json({ error: "Access denied" });
        const appointment = await storage.updateAppointment(
          req.params.id,
          req.body,
        );
        if (!appointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }
        // Dispatch booking.updated notification (fire-and-forget)
        const [updatedApptUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, appointment.userId))
          .catch(() => [null]);
        const [updatedApptProvider] = await db
          .select()
          .from(providers)
          .where(eq(providers.id, appointment.providerId))
          .catch(() => [null]);
        if (updatedApptUser && updatedApptProvider) {
          dispatch("booking.updated", {
            clientEmail: updatedApptUser.email,
            clientName:
              `${updatedApptUser.firstName || ""} ${updatedApptUser.lastName || ""}`.trim() ||
              updatedApptUser.email,
            providerName: updatedApptProvider.businessName,
            serviceName: appointment.serviceName,
            appointmentDate: appointment.scheduledDate,
            appointmentTime: appointment.scheduledTime,
            relatedRecordType: "appointment",
            relatedRecordId: appointment.id,
            recipientUserId: updatedApptUser.id,
          }).catch((e: unknown) =>
            console.error("booking.updated dispatch error:", e),
          );
        }
        res.json({ appointment });
      } catch (error) {
        console.error("Update appointment error:", error);
        res.status(500).json({ error: "Failed to update appointment" });
      }
    },
  );

  // Task #236: preview the cancellation fee (if any) without actually
  // cancelling. The client uses this to render an "are you sure?" modal
  // showing the late-cancel charge before the homeowner confirms.
  app.get(
    "/api/appointments/:id/cancellation-preview",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const existing = await storage.getAppointment(req.params.id);
        if (!existing)
          return res.status(404).json({ error: "Appointment not found" });
        const providerRecord = await storage.getProviderByUserId(authUserId);
        const isOwner = existing.userId === authUserId;
        const isProvider =
          providerRecord && existing.providerId === providerRecord.id;
        if (!isOwner && !isProvider)
          return res.status(403).json({ error: "Access denied" });

        const [policyProvider] = await db
          .select({ bookingPolicies: providers.bookingPolicies })
          .from(providers)
          .where(eq(providers.id, existing.providerId));
        const policy = normalizeBookingPolicy(policyProvider?.bookingPolicies);
        const totalCents = dollarsToCents(existing.estimatedPrice ?? null);
        const quote = computeCancellationFee(
          policy,
          totalCents,
          combineDateAndTime(existing.scheduledDate, existing.scheduledTime),
        );
        // Providers cancelling on a homeowner's behalf never owe a fee.
        const feeCents = isProvider ? 0 : quote.feeCents;
        res.json({
          feeCents,
          insideCancellationWindow: quote.insideCancellationWindow,
          hoursBefore: Math.round(quote.hoursBefore * 10) / 10,
          policySummary: summarizePolicy(policy),
        });
      } catch (error) {
        console.error("Cancellation preview error:", error);
        res.status(500).json({ error: "Failed to compute cancellation fee" });
      }
    },
  );

  app.post(
    "/api/appointments/:id/cancel",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const existing = await storage.getAppointment(req.params.id);
        if (!existing)
          return res.status(404).json({ error: "Appointment not found" });
        const providerRecord = await storage.getProviderByUserId(authUserId);
        const isOwner = existing.userId === authUserId;
        const isProvider =
          providerRecord && existing.providerId === providerRecord.id;
        if (!isOwner && !isProvider)
          return res.status(403).json({ error: "Access denied" });

        // ── Task #236: cancellation fee enforcement ──────────────────────
        // Compute the fee BEFORE flipping status so the scheduled-date
        // window check is honest. Only homeowners are charged; providers
        // cancelling never owe a fee. If the homeowner has not explicitly
        // acknowledged the fee (acceptFee !== true), return a 409 so the
        // client can show a confirmation modal.
        let cancellationFeeCheckoutUrl: string | null = null;
        let cancellationFeeCents = 0;
        if (isOwner && !isProvider) {
          const [policyProvider] = await db
            .select({ bookingPolicies: providers.bookingPolicies })
            .from(providers)
            .where(eq(providers.id, existing.providerId));
          const policy = normalizeBookingPolicy(
            policyProvider?.bookingPolicies,
          );
          const totalCents = dollarsToCents(existing.estimatedPrice ?? null);
          const quote = computeCancellationFee(
            policy,
            totalCents,
            combineDateAndTime(existing.scheduledDate, existing.scheduledTime),
          );
          if (quote.feeCents > 0) {
            const acceptFee = req.body?.acceptFee === true;
            if (!acceptFee) {
              return res.status(409).json({
                error: "fee_acknowledgement_required",
                feeCents: quote.feeCents,
                insideCancellationWindow: true,
                message: `Cancelling now incurs a fee of $${(quote.feeCents / 100).toFixed(2)}. Confirm to proceed.`,
              });
            }
            cancellationFeeCents = quote.feeCents;
            try {
              const session = await createCancellationFeeCheckoutSession({
                appointmentId: existing.id,
                providerId: existing.providerId,
                amountCents: quote.feeCents,
                description: `Late cancellation fee for ${existing.serviceName}`,
              });
              cancellationFeeCheckoutUrl = session.checkoutUrl;
              await db
                .update(appointments)
                .set({
                  cancellationFeeCents: quote.feeCents,
                  updatedAt: new Date(),
                })
                .where(eq(appointments.id, existing.id));
            } catch (feeErr: unknown) {
              const code =
                typeof feeErr === "object" &&
                feeErr !== null &&
                "code" in feeErr
                  ? (feeErr as { code?: string }).code
                  : undefined;
              if (code !== "stripe_not_ready") {
                console.error("Cancellation fee charge error:", feeErr);
              }
              // If Stripe isn't ready, proceed with cancel and skip the
              // fee — better to honor the cancel than block it.
              cancellationFeeCheckoutUrl = null;
            }
          }
        }

        const appointment = await storage.cancelAppointment(req.params.id);
        if (!appointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }

        await storage.createNotification(
          appointment.userId,
          "Appointment Cancelled",
          `Your ${appointment.serviceName} appointment has been cancelled.`,
          "booking_cancelled",
          JSON.stringify({ appointmentId: appointment.id }),
        );

        // Fire cancellation email (fire-and-forget)
        const [cancelledUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, appointment.userId))
          .catch(() => [null]);
        const [cancelledProvider] = await db
          .select()
          .from(providers)
          .where(eq(providers.id, appointment.providerId))
          .catch(() => [null]);
        if (cancelledUser && cancelledProvider) {
          dispatch("booking.cancelled", {
            clientEmail: cancelledUser.email,
            clientName:
              `${cancelledUser.firstName || ""} ${cancelledUser.lastName || ""}`.trim() ||
              cancelledUser.email,
            providerName: cancelledProvider.businessName,
            serviceName: appointment.serviceName,
            appointmentDate: appointment.scheduledDate,
            appointmentTime: appointment.scheduledTime,
            relatedRecordType: "appointment",
            relatedRecordId: appointment.id,
            recipientUserId: cancelledUser.id,
          }).catch((e: unknown) =>
            console.error("booking.cancelled dispatch error:", e),
          );
        }

        res.json({
          appointment,
          cancellationFeeCents,
          cancellationFeeCheckoutUrl,
        });
      } catch (error) {
        console.error("Cancel appointment error:", error);
        res.status(500).json({ error: "Failed to cancel appointment" });
      }
    },
  );

  app.post(
    "/api/appointments/:id/reschedule",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const existing = await storage.getAppointment(req.params.id);
        if (!existing)
          return res.status(404).json({ error: "Appointment not found" });
        const providerRecord = await storage.getProviderByUserId(authUserId);
        const isOwner = existing.userId === authUserId;
        const isProvider =
          providerRecord && existing.providerId === providerRecord.id;
        if (!isOwner && !isProvider)
          return res.status(403).json({ error: "Access denied" });
        const { scheduledDate, scheduledTime } = req.body;

        if (!scheduledDate || !scheduledTime) {
          return res
            .status(400)
            .json({ error: "New date and time are required" });
        }

        // ── Task #236: reschedule policy enforcement ─────────────────────
        // Homeowners are bound by the provider's reschedule window and
        // max-reschedules count. Providers can always reschedule.
        if (isOwner && !isProvider) {
          const [policyProvider] = await db
            .select({ bookingPolicies: providers.bookingPolicies })
            .from(providers)
            .where(eq(providers.id, existing.providerId));
          const policy = normalizeBookingPolicy(
            policyProvider?.bookingPolicies,
          );
          const check = checkRescheduleAllowed(
            policy,
            combineDateAndTime(existing.scheduledDate, existing.scheduledTime),
            existing.rescheduleCount ?? 0,
          );
          if (!check.allowed) {
            return res.status(409).json({
              error: check.reason,
              message: check.message,
              rescheduleCount: existing.rescheduleCount ?? 0,
              maxReschedules: policy.maxReschedules,
            });
          }
        }

        const appointment = await storage.updateAppointment(req.params.id, {
          scheduledDate,
          scheduledTime,
          status: "pending", // Reset to pending when rescheduled
          rescheduleCount: (existing.rescheduleCount ?? 0) + 1,
        });

        if (!appointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }

        await storage.createNotification(
          appointment.userId,
          "Appointment Rescheduled",
          `Your ${appointment.serviceName} appointment has been rescheduled to ${scheduledDate} at ${scheduledTime}.`,
          "booking_update",
          JSON.stringify({ appointmentId: appointment.id }),
        );

        // Fire rescheduled email (fire-and-forget)
        const [rescheduledUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, appointment.userId))
          .catch(() => [null]);
        const [rescheduledProvider] = await db
          .select()
          .from(providers)
          .where(eq(providers.id, appointment.providerId))
          .catch(() => [null]);
        if (rescheduledUser && rescheduledProvider) {
          dispatch("booking.rescheduled", {
            clientEmail: rescheduledUser.email,
            clientName:
              `${rescheduledUser.firstName || ""} ${rescheduledUser.lastName || ""}`.trim() ||
              rescheduledUser.email,
            providerName: rescheduledProvider.businessName,
            serviceName: appointment.serviceName,
            appointmentDate: scheduledDate,
            appointmentTime: scheduledTime,
            oldDate: existing.scheduledDate,
            oldTime: existing.scheduledTime,
            relatedRecordType: "appointment",
            relatedRecordId: appointment.id,
            recipientUserId: rescheduledUser.id,
          }).catch((e: unknown) =>
            console.error("booking.rescheduled dispatch error:", e),
          );
        }

        res.json({ appointment });
      } catch (error) {
        console.error("Reschedule appointment error:", error);
        res.status(500).json({ error: "Failed to reschedule appointment" });
      }
    },
  );

  app.post(
    "/api/appointments/:id/update-condition",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const { description } = req.body;
        if (
          !description ||
          typeof description !== "string" ||
          !description.trim()
        ) {
          return res.status(400).json({ error: "Description is required" });
        }
        const existing = await storage.getAppointment(req.params.id);
        if (!existing)
          return res.status(404).json({ error: "Appointment not found" });
        if (existing.userId !== authUserId)
          return res.status(403).json({ error: "Access denied" });
        const updated = await storage.updateAppointment(req.params.id, {
          notes: description.trim(),
        });
        res.json({ appointment: updated, success: true });
      } catch (error) {
        console.error("Update condition error:", error);
        res.status(500).json({ error: "Failed to update condition" });
      }
    },
  );

  app.get(
    "/api/appointments/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const appointment = await storage.getAppointment(req.params.id);
        if (!appointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }
        const providerRecord = await storage.getProviderByUserId(authUserId);
        const isOwner = appointment.userId === authUserId;
        const isProvider =
          providerRecord && appointment.providerId === providerRecord.id;
        if (!isOwner && !isProvider) {
          return res.status(403).json({ error: "Access denied" });
        }
        // Enrich with provider identity so homeowner can see who is doing the work
        const provider = await storage.getProvider(appointment.providerId);
        const providerInfo = provider
          ? {
              businessName: provider.businessName,
              phone: provider.phone,
              email: provider.email,
            }
          : null;
        // Include the homeowner's review (if any) with the provider's reply so
        // both parties can see the latest state on the appointment screen.
        const [reviewRow] = await db
          .select()
          .from(reviews)
          .where(eq(reviews.appointmentId, appointment.id))
          .limit(1);
        // Task #485: surface the linked job's id so the client can
        // independently fetch before/after photo pairs to render alongside
        // the review request, without this route needing to know about
        // photo pairs itself.
        const [jobRow] = await db
          .select({ id: jobs.id })
          .from(jobs)
          .where(eq(jobs.appointmentId, appointment.id))
          .limit(1);
        res.json({
          appointment,
          provider: providerInfo,
          review: reviewRow ?? null,
          job: jobRow ?? null,
        });
      } catch (error) {
        console.error("Get appointment error:", error);
        res.status(500).json({ error: "Failed to get appointment" });
      }
    },
  );

  app.get(
    "/api/notifications/:userId",
    requireAuth,
    async (req: Request<UserIdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        if (req.params.userId !== authUserId) {
          return res.status(403).json({ error: "Access denied" });
        }
        const notifications = await storage.getNotifications(req.params.userId);
        res.json({ notifications });
      } catch (error) {
        console.error("Get notifications error:", error);
        res.status(500).json({ error: "Failed to get notifications" });
      }
    },
  );

  app.post(
    "/api/notifications/:id/read",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const notification = await storage.getNotification(req.params.id);
        if (!notification)
          return res.status(404).json({ error: "Notification not found" });
        if (notification.userId !== req.authenticatedUserId)
          return res.status(403).json({ error: "Access denied" });
        await storage.markNotificationRead(req.params.id);
        res.json({ success: true });
      } catch (error) {
        console.error("Mark notification read error:", error);
        res.status(500).json({ error: "Failed to mark notification as read" });
      }
    },
  );

  app.post(
    "/api/notifications/:userId/read-all",
    requireAuth,
    async (req: Request<UserIdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        if (req.params.userId !== authUserId) {
          return res.status(403).json({ error: "Access denied" });
        }
        await db
          .update(notifications)
          .set({ isRead: true })
          .where(
            and(
              eq(notifications.userId, authUserId),
              eq(notifications.isRead, false),
            ),
          );
        res.json({ success: true });
      } catch (error) {
        console.error("Mark all notifications read error:", error);
        res
          .status(500)
          .json({ error: "Failed to mark all notifications as read" });
      }
    },
  );

  app.get(
    "/api/notifications/:userId/unread-count",
    requireAuth,
    async (req: Request<UserIdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        if (req.params.userId !== authUserId) {
          return res.status(403).json({ error: "Access denied" });
        }
        const result = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, authUserId),
              eq(notifications.isRead, false),
            ),
          );
        const count = result[0]?.count || 0;
        res.json({ count });
      } catch (error) {
        console.error("Get unread count error:", error);
        res.status(500).json({ error: "Failed to get unread count" });
      }
    },
  );

  app.post(
    "/api/push-tokens",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.authenticatedUserId!;
        const { token, platform } = req.body;
        if (!token) {
          return res.status(400).json({ error: "token is required" });
        }
        await db
          .insert(pushTokens)
          .values({
            userId,
            token,
            platform: platform || "expo",
            isActive: true,
          })
          .onConflictDoUpdate({
            target: [pushTokens.userId, pushTokens.token],
            set: {
              isActive: true,
              platform: platform || "expo",
              updatedAt: new Date(),
            },
          });
        res.json({ success: true });
      } catch (error) {
        console.error("Register push token error:", error);
        res.status(500).json({ error: "Failed to register push token" });
      }
    },
  );

  app.delete(
    "/api/push-tokens",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.authenticatedUserId!;
        const { token } = req.body;
        if (token) {
          await db
            .update(pushTokens)
            .set({ isActive: false, updatedAt: new Date() })
            .where(
              and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)),
            );
        } else {
          await db
            .update(pushTokens)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(pushTokens.userId, userId));
        }
        res.json({ success: true });
      } catch (error) {
        console.error("Delete push token error:", error);
        res.status(500).json({ error: "Failed to delete push token" });
      }
    },
  );

  app.get(
    "/api/notification-preferences/:userId",
    requireAuth,
    async (req: Request<UserIdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        if (req.params.userId !== authUserId) {
          return res.status(403).json({ error: "Access denied" });
        }
        const [prefs] = await db
          .select()
          .from(notificationPreferences)
          .where(eq(notificationPreferences.userId, authUserId));
        if (!prefs) {
          const defaults = {
            emailBookingConfirmation: true,
            emailBookingReminder: true,
            emailBookingCancelled: true,
            emailInvoiceCreated: true,
            emailInvoiceReminder: true,
            emailInvoicePaid: true,
            emailPaymentFailed: true,
            emailReviewRequest: true,
            pushEnabled: true,
            inAppEnabled: true,
          };
          res.json({ preferences: { userId: authUserId, ...defaults } });
        } else {
          res.json({ preferences: prefs });
        }
      } catch (error) {
        console.error("Get notification preferences error:", error);
        res
          .status(500)
          .json({ error: "Failed to get notification preferences" });
      }
    },
  );

  app.post(
    "/api/notification-preferences",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.authenticatedUserId!;
        const updates = req.body;
        const allowed = [
          "emailBookingConfirmation",
          "emailBookingReminder",
          "emailBookingCancelled",
          "emailInvoiceCreated",
          "emailInvoiceReminder",
          "emailInvoicePaid",
          "emailPaymentFailed",
          "emailReviewRequest",
          "pushEnabled",
          "inAppEnabled",
        ];
        const safeUpdates: Record<string, unknown> = {
          userId,
          updatedAt: new Date(),
        };
        for (const key of allowed) {
          if (updates[key] !== undefined) safeUpdates[key] = updates[key];
        }
        const [existing] = await db
          .select()
          .from(notificationPreferences)
          .where(eq(notificationPreferences.userId, userId));
        if (existing) {
          const [updated] = await db
            .update(notificationPreferences)
            .set(safeUpdates)
            .where(eq(notificationPreferences.userId, userId))
            .returning();
          res.json({ preferences: updated });
        } else {
          const [created] = await db
            .insert(notificationPreferences)
            .values(safeUpdates as any)
            .returning();
          res.json({ preferences: created });
        }
      } catch (error) {
        console.error("Update notification preferences error:", error);
        res
          .status(500)
          .json({ error: "Failed to update notification preferences" });
      }
    },
  );

  app.post(
    "/api/chat",
    requireAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { messages, homeId } = req.body as {
          messages: ChatMessage[];
          homeId?: string;
        };

        if (!messages || !Array.isArray(messages)) {
          return res.status(400).json({ error: "Messages array is required" });
        }

        // Build system prompt with optional HouseFax context
        let systemPrompt = HOMEBASE_SYSTEM_PROMPT;

        if (homeId) {
          const home = await storage.getHome(homeId);
          if (home && home.userId === req.authenticatedUserId) {
            const houseFaxContext = buildHouseFaxContext(home);
            systemPrompt = `${HOMEBASE_SYSTEM_PROMPT}\n\n## Current Home Context (HouseFax)\nYou are speaking with a homeowner about their property. Reference this information naturally in your responses:\n\n${houseFaxContext}`;
          }
        }

        const chatMessages: ChatMessage[] = [
          { role: "system", content: systemPrompt },
          ...messages,
        ];

        // Buffered response — SSE not supported on native iOS/Android
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: chatMessages,
          max_tokens: 1024,
        });

        const content =
          completion.choices[0]?.message?.content || "I'm here to help.";
        res.json({ content, done: true });
      } catch (error) {
        console.error("Error in chat:", error);
        res.status(500).json({ error: "Failed to process chat request" });
      }
    },
  );

  const ENHANCED_CHAT_PROMPT = `You are HomeBase AI, a helpful home assistant. Answer questions about home maintenance, repairs, and services.

IMPORTANT: If the user describes a home problem, issue, or mentions needing service (leak, broken, not working, repair, install, fix, etc.), you MUST:
1. Provide helpful initial guidance about the issue
2. Set "needsService": true in your response
3. Set "category" to the relevant service type: plumbing, electrical, hvac, cleaning, landscaping, painting, roofing, or handyman
4. Set "problemSummary" to a brief description of their issue

Always respond with valid JSON in this format:
{
  "response": "Your helpful response text here",
  "needsService": boolean,
  "category": "service category if applicable" or null,
  "problemSummary": "brief issue summary" or null
}

Be conversational and helpful. If they just have a question, answer it. If they have a problem needing professional help, guide them AND offer to connect with pros.`;

  app.post(
    "/api/chat/simple",
    requireAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { message, history, homeId } = req.body as {
          message: string;
          history?: { role: string; content: string }[];
          homeId?: string;
        };

        if (!message) {
          return res.status(400).json({ error: "Message is required" });
        }

        // Build system prompt with optional HouseFax context
        let systemPrompt = ENHANCED_CHAT_PROMPT;

        if (homeId) {
          const home = await storage.getHome(homeId);
          if (home && home.userId === req.authenticatedUserId) {
            const houseFaxContext = buildHouseFaxContext(home);
            systemPrompt = `${ENHANCED_CHAT_PROMPT}\n\n## Current Home Context (HouseFax)\nYou are speaking with a homeowner about their property. Use this information to give personalized advice:\n\n${houseFaxContext}`;
          }
        }

        const messages: {
          role: "system" | "user" | "assistant";
          content: string;
        }[] = [{ role: "system", content: systemPrompt }];

        if (history) {
          messages.push(
            ...history.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          );
        }

        messages.push({ role: "user", content: message });

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 1024,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || "{}";

        try {
          const parsed = JSON.parse(content);
          res.json({
            response:
              parsed.response || "I'm here to help with your home questions.",
            needsService: parsed.needsService || false,
            category: parsed.category || null,
            problemSummary: parsed.problemSummary || null,
          });
        } catch {
          res.json({
            response: content,
            needsService: false,
            category: null,
            problemSummary: null,
          });
        }
      } catch (error) {
        console.error("Error in simple chat:", error);
        res.status(500).json({ error: "Failed to process chat request" });
      }
    },
  );

  // ============ PROVIDER AI ASSISTANT ============

  app.post(
    "/api/ai/provider-assistant",
    requireAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { message, businessContext, conversationHistory } = req.body as {
          message: string;
          businessContext?: string;
          conversationHistory?: { role: string; content: string }[];
        };

        if (!message) {
          return res.status(400).json({ error: "Message is required" });
        }

        const systemPrompt = businessContext
          ? `${PROVIDER_ASSISTANT_PROMPT}\n\nCurrent Business Context:\n${businessContext}`
          : PROVIDER_ASSISTANT_PROMPT;

        const messages: {
          role: "system" | "user" | "assistant";
          content: string;
        }[] = [{ role: "system", content: systemPrompt }];

        if (conversationHistory) {
          messages.push(
            ...conversationHistory.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          );
        }

        messages.push({ role: "user", content: message });

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 1024,
        });

        const content =
          response.choices[0]?.message?.content ||
          "I'm here to help with your business questions.";

        res.json({ response: content });
      } catch (error) {
        console.error("Provider assistant error:", error);
        res.status(500).json({ error: "Failed to process request" });
      }
    },
  );

  // ============ AI PRICING ASSISTANT ============

  app.post(
    "/api/ai/pricing-assistant",
    requireAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { providerId, serviceName, description, clientId } = req.body as {
          providerId?: string;
          serviceName: string;
          description?: string;
          clientId?: string;
        };

        if (!serviceName) {
          return res.status(400).json({ error: "Service name is required" });
        }

        let businessContext = "";

        if (providerId) {
          const [provider, jobs] = await Promise.all([
            storage.getProvider(providerId),
            storage.getJobs(providerId),
          ]);

          if (provider) {
            businessContext += `Provider: ${provider.businessName}\n`;
            if (provider.hourlyRate) {
              businessContext += `Hourly Rate: $${provider.hourlyRate}\n`;
            }
          }

          if (jobs && jobs.length > 0) {
            const completedJobs = jobs.filter(
              (j) => j.status === "completed" && j.finalPrice,
            );
            if (completedJobs.length > 0) {
              const avgPrice =
                completedJobs.reduce(
                  (sum, j) => sum + parseFloat(j.finalPrice || "0"),
                  0,
                ) / completedJobs.length;
              businessContext += `Average completed job price: $${avgPrice.toFixed(2)}\n`;
              businessContext += `Total completed jobs: ${completedJobs.length}\n`;
            }
          }
        }

        const prompt = `You are a pricing expert for home service providers. Based on the service and context, suggest an appropriate price.

Service: ${serviceName}
${description ? `Description: ${description}` : ""}
${businessContext ? `\nBusiness Context:\n${businessContext}` : ""}

Industry pricing guidelines:
- General Repair: $75-200 depending on complexity
- Installation: $100-500+ depending on scope
- Maintenance: $50-150 for routine work
- Inspection: $50-100 standard rate
- Emergency Service: 1.5-2x normal rates
- Consultation: $50-100/hour

Respond with a JSON object ONLY (no markdown, no explanation):
{
  "suggestedPrice": <number>,
  "minPrice": <number>,
  "maxPrice": <number>,
  "reasoning": "<brief 1-2 sentence explanation>"
}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 256,
        });

        const content = response.choices[0]?.message?.content || "";

        try {
          const suggestion = JSON.parse(
            content.replace(/```json\n?|\n?```/g, "").trim(),
          );
          res.json({ suggestion });
        } catch {
          res.json({
            suggestion: {
              suggestedPrice: 150,
              minPrice: 100,
              maxPrice: 250,
              reasoning:
                "Based on typical service rates in the home services industry.",
            },
          });
        }
      } catch (error) {
        console.error("Pricing assistant error:", error);
        res
          .status(500)
          .json({ error: "Failed to generate pricing suggestion" });
      }
    },
  );

  // ============ INLINE AI SUGGESTION ROUTES ============

  app.post(
    "/api/ai/suggest-description",
    requireAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { serviceName, category } = req.body as {
          serviceName: string;
          category: string;
        };
        if (!serviceName || !category) {
          return res
            .status(400)
            .json({ error: "serviceName and category are required" });
        }

        const prompt = `You are a professional copywriter for home service businesses. Write a concise, compelling service description for a provider listing.

Service Name: ${serviceName}
Category: ${category}

Write a 2-3 sentence professional description that:
- Highlights key benefits for the homeowner
- Mentions quality and reliability
- Sounds natural and specific to this service type

Respond with ONLY the description text, no quotes, no extra formatting.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 200,
        });

        const description = response.choices[0]?.message?.content?.trim() || "";
        res.json({ description });
      } catch (error) {
        console.error("Suggest description error:", error);
        res.status(500).json({ error: "Failed to generate description" });
      }
    },
  );

  app.post(
    "/api/ai/suggest-service-names",
    requireAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { category } = req.body as { category: string };
        if (!category) {
          return res.status(400).json({ error: "category is required" });
        }

        const prompt = `You are a home services expert. Suggest 3 popular, specific service names for a "${category}" provider.

Rules:
- Each name should be 3-6 words, specific and professional
- Focus on high-demand services homeowners commonly book
- No generic names like "General Service" or "Home Service"

Respond with ONLY a JSON array of exactly 3 strings, example: ["Drain Cleaning & Unclogging","Water Heater Installation","Emergency Pipe Repair"]`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 120,
          response_format: { type: "json_object" },
        });

        let names: string[] = [];
        try {
          const raw = response.choices[0]?.message?.content?.trim() || "{}";
          const parsed = JSON.parse(raw);
          const arr = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.names)
              ? parsed.names
              : Object.values(parsed)[0];
          names = (arr as string[])
            .slice(0, 3)
            .filter((n) => typeof n === "string");
        } catch {
          names = [];
        }
        res.json({ names });
      } catch (error) {
        console.error("Suggest service names error:", error);
        res.status(500).json({ error: "Failed to generate service names" });
      }
    },
  );

  app.post(
    "/api/ai/suggest-price",
    requireAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { serviceName, category, pricingType, location } = req.body as {
          serviceName: string;
          category: string;
          pricingType: string;
          location?: string;
        };

        if (!serviceName || !category || !pricingType) {
          return res.status(400).json({
            error: "serviceName, category, and pricingType are required",
          });
        }

        const pricingContext: Record<string, string> = {
          flat: "a single flat rate for the entire job",
          variable:
            "tier-based pricing (e.g., small/medium/large with different rates)",
          service_call: "a service call fee plus hourly labor",
          quote: "custom quote only — no upfront price",
        };

        const prompt = `You are a pricing expert for home service providers. Suggest a competitive price range for this service.

Service Name: ${serviceName}
Category: ${category}
Pricing Type: ${pricingType} (${pricingContext[pricingType] || pricingType})
${location ? `Location: ${location}` : ""}

Industry benchmarks:
- HVAC: $89-149 service call, $85-150/hour, $150-400 flat jobs
- Plumbing: $75-125/hour, $150-300 drain cleaning, $75-125 service call
- Electrical: $80-130/hour, 2-hour minimum
- Cleaning: $30-50/hour, $120-200 flat visit, $0.10-0.25/sqft
- Landscaping: $40-80/visit, $125-200/month subscription
- Handyman: $55-85/hour, $100-300 per job
- Painting: $2.50-5.00/sqft, $300-600/room
- Roofing: $350-600/square, $4,000-12,000 project

Respond ONLY with a JSON object:
{"minPrice": <number>, "maxPrice": <number>, "unit": "<string, e.g. 'per hour', 'flat rate', 'per visit'>", "hint": "<1 short sentence tip>"}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 150,
        });

        const content = response.choices[0]?.message?.content || "";
        try {
          const suggestion = JSON.parse(
            content.replace(/```json\n?|\n?```/g, "").trim(),
          );
          res.json({ suggestion });
        } catch {
          res.json({
            suggestion: {
              minPrice: 50,
              maxPrice: 150,
              unit: "per job",
              hint: "Price competitively to win your first bookings.",
            },
          });
        }
      } catch (error) {
        console.error("Suggest price error:", error);
        res.status(500).json({ error: "Failed to generate price suggestion" });
      }
    },
  );

  app.post(
    "/api/ai/improve-bio",
    requireAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { currentBio, businessName, category } = req.body as {
          currentBio: string;
          businessName?: string;
          category?: string;
        };
        if (!currentBio || !currentBio.trim()) {
          return res.status(400).json({ error: "currentBio is required" });
        }

        const prompt = `You are a professional copywriter who helps home service providers craft compelling business bios. Rewrite the following bio to be professional, clear, and trustworthy while keeping the provider's voice and specific details intact.

Business Name: ${businessName || "Not provided"}
Category: ${category || "Home Services"}
Current Bio: ${currentBio}

Rewrite the bio to:
- Sound professional and confident
- Highlight what makes them stand out (use their specific details)
- Be concise (2–3 sentences max)
- Appeal to homeowners looking for reliable help
- Keep their actual experience, years, and specifics

Respond ONLY with the improved bio text, no quotes, no explanations.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 200,
        });

        const improvedBio =
          response.choices[0]?.message?.content?.trim() || currentBio;
        res.json({ improvedBio });
      } catch (error) {
        console.error("Improve bio error:", error);
        res.status(500).json({ error: "Failed to improve bio" });
      }
    },
  );

  // ============ PUBLIC AI ONBOARDING ROUTES (no auth required) ============

  app.post(
    "/api/ai/onboarding/suggest-business-names",
    onboardingRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { category } = req.body as { category: string };
        if (!category)
          return res.status(400).json({ error: "category is required" });

        const prompt = `You are a branding expert for home service businesses. Suggest 3 professional, memorable business names for a "${category}" service provider.

Rules:
- Each name should be 2-4 words
- Sound established and trustworthy (not generic like "Best Service Co")
- Mix styles: one classic, one modern, one clever
- Real business names that a homeowner would trust

Respond with ONLY a JSON object: {"names": ["Name One", "Name Two", "Name Three"]}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 100,
          response_format: { type: "json_object" },
        });

        const raw =
          response.choices[0]?.message?.content?.trim() || '{"names":[]}';
        const parsed = JSON.parse(raw);
        res.json({
          names: Array.isArray(parsed.names) ? parsed.names.slice(0, 3) : [],
        });
      } catch (error) {
        console.error("Suggest business names error:", error);
        res.status(500).json({ error: "Failed to suggest business names" });
      }
    },
  );

  app.post(
    "/api/ai/onboarding/suggest-service-names",
    onboardingRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { category } = req.body as { category: string };
        if (!category)
          return res.status(400).json({ error: "category is required" });

        const prompt = `You are a home services expert. Suggest 3 popular, specific service names for a "${category}" provider.

Rules:
- Each name should be 3-6 words, specific and professional
- Focus on high-demand services homeowners commonly book
- No generic names like "General Service" or "Home Service"

Respond with ONLY a JSON object: {"names": ["Service One", "Service Two", "Service Three"]}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 120,
          response_format: { type: "json_object" },
        });

        const raw =
          response.choices[0]?.message?.content?.trim() || '{"names":[]}';
        const parsed = JSON.parse(raw);
        res.json({
          names: Array.isArray(parsed.names) ? parsed.names.slice(0, 3) : [],
        });
      } catch (error) {
        console.error("Suggest service names error:", error);
        res.status(500).json({ error: "Failed to suggest service names" });
      }
    },
  );

  // ── AI Service Blueprint Endpoints ──────────────────────────────────────

  app.post(
    "/api/ai/suggest-service-types",
    requireAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { businessDescription } = req.body as {
          businessDescription: string;
        };
        if (!businessDescription?.trim()) {
          return res
            .status(400)
            .json({ error: "businessDescription is required" });
        }

        const prompt = `You are an expert home services business consultant. Based on this business description, suggest 4-6 specific service types the provider could offer.

Business Description: ${businessDescription}

Return a JSON object with a "services" array. Each item must have:
- "name": specific service name (3-6 words)
- "category": one of [Cleaning, HVAC, Plumbing, Electrical, Landscaping, Handyman, Painting, Roofing, Pest Control, Pressure Washing, Junk Removal, Other]
- "description": one compelling sentence describing the service
- "icon": a simple icon keyword (home, thermometer, droplet, zap, sun, tool, edit-3, triangle, shield, wind, trash-2, package)

Focus on high-demand services that match the business description. Be specific and realistic.

Example output format:
{"services": [{"name": "Standard Home Cleaning", "category": "Cleaning", "description": "Thorough top-to-bottom cleaning of all living areas, kitchens, and bathrooms.", "icon": "home"}]}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 600,
          response_format: { type: "json_object" },
        });

        let services: unknown[] = [];
        try {
          const parsed = JSON.parse(
            response.choices[0]?.message?.content || "{}",
          );
          services = Array.isArray(parsed.services) ? parsed.services : [];
        } catch {
          services = [];
        }
        res.json({ services });
      } catch (error) {
        console.error("Suggest service types error:", error);
        res.status(500).json({ error: "Failed to suggest service types" });
      }
    },
  );

  app.post(
    "/api/ai/service-blueprint",
    requireAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { businessDescription, serviceType, category, providerLocation } =
          req.body as {
            businessDescription: string;
            serviceType: string;
            category: string;
            providerLocation?: string;
          };
        if (!serviceType || !category) {
          return res
            .status(400)
            .json({ error: "serviceType and category are required" });
        }

        const CATEGORY_CONTEXT: Record<string, string> = {
          Cleaning:
            "residential/commercial cleaning services. Common intake questions: home size, number of bedrooms/bathrooms, pets, special areas. Common add-ons: inside fridge, inside oven, laundry, windows.",
          HVAC: "heating, cooling, and ventilation services. Common intake questions: system age, brand, symptoms, last service date. Common add-ons: filter replacement, UV light, duct cleaning.",
          Plumbing:
            "pipe, drain, and fixture services. Common intake questions: issue type, location in home, urgency. Common add-ons: drain cleaning, water heater flush, leak inspection.",
          Electrical:
            "wiring, panel, and fixture services. Common intake questions: panel type, issue description, home age. Common add-ons: GFCI outlets, surge protection, smoke detectors.",
          Landscaping:
            "lawn, garden, and outdoor services. Common intake questions: yard size, grass type, frequency. Common add-ons: edging, fertilizing, leaf removal, mulching.",
          Handyman:
            "general repairs and installations. Common intake questions: task description, materials needed, estimated time. Common add-ons: supply pickup, furniture assembly, caulking.",
          Painting:
            "interior/exterior painting. Common intake questions: rooms or areas, ceiling height, current color, prep needed. Common add-ons: trim, closets, ceiling, primer coat.",
          Roofing:
            "roofing repair and replacement. Common intake questions: roof type, age, leak location, sq footage. Common add-ons: gutter cleaning, soffit/fascia, attic inspection.",
          "Pest Control":
            "pest elimination and prevention. Common intake questions: pest type, infestation severity, home size. Common add-ons: termite inspection, rodent exclusion, quarterly service.",
          "Pressure Washing":
            "exterior surface cleaning. Common intake questions: surface type, square footage, stain type. Common add-ons: sealing, gutter flush, deck/fence.",
          "Junk Removal":
            "debris and junk hauling. Common intake questions: volume estimate, item types, hazardous materials. Common add-ons: dumpster rental, same-day service, donation drop-off.",
        };

        const prompt = `You are a home services business expert. Generate a complete service blueprint for a provider offering this service.

Business: ${businessDescription || "Home service provider"}
Service: ${serviceType}
Category: ${category}
Location: ${providerLocation || "local area"}
Category Context: ${CATEGORY_CONTEXT[category] || "home service"}

Return a JSON object with exactly these fields:
{
  "pricingModel": {
    "type": "flat" | "variable" | "service_call" | "quote",
    "basePrice": number (null if quote),
    "priceTiers": [{"label": string, "price": number}] (for variable pricing, 2-4 tiers),
    "unit": "per job" | "per hour" | "per sqft" | "per visit",
    "description": "one sentence explaining the pricing logic"
  },
  "intakeQuestions": [
    {"id": string, "question": string, "type": "text" | "select" | "number", "options": string[] | null, "required": boolean}
  ],
  "addOns": [
    {"id": string, "name": string, "description": string, "price": number}
  ],
  "checklistTemplate": [string],
  "bookingMode": "instant" | "starts_at" | "quote_only",
  "aiPricingInsight": "one sentence identifying a specific profit leak or pricing opportunity for this service type"
}

Rules:
- intakeQuestions: 3-5 questions specific to this exact service. Include property size where relevant.
- addOns: 2-4 high-value add-ons with realistic prices for ${providerLocation || "US"} market
- checklistTemplate: 5-8 short, ordered, on-site steps a tech would actually do for this service (e.g., "Lay drop cloths", "Mask trim", "Cut in edges"). Plain strings, no numbering.
- bookingMode: use "instant" for straightforward flat-rate services, "starts_at" for variable pricing, "quote_only" for complex/large jobs
- priceTiers: only include if type is "variable"
- All prices in USD, no $ sign, just numbers
- aiPricingInsight: be specific about the profit opportunity (e.g., "Large homes over 3,000 sqft take 40% longer but your flat rate doesn't capture that extra labor cost.")`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000,
          response_format: { type: "json_object" },
        });

        let blueprint: unknown = {};
        try {
          blueprint = JSON.parse(response.choices[0]?.message?.content || "{}");
        } catch {
          blueprint = {};
        }
        res.json({ blueprint });
      } catch (error) {
        console.error("Service blueprint error:", error);
        res.status(500).json({ error: "Failed to generate service blueprint" });
      }
    },
  );

  app.post(
    "/api/ai/edit-blueprint",
    requireAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { blueprint, instruction } = req.body as {
          blueprint: unknown;
          instruction: string;
        };
        if (!blueprint || !instruction?.trim()) {
          return res
            .status(400)
            .json({ error: "blueprint and instruction are required" });
        }

        const prompt = `You are a home services business expert. Update this service blueprint based on the provider's instruction.

Current Blueprint:
${JSON.stringify(blueprint, null, 2)}

Provider Instruction: "${instruction}"

Apply the instruction to the blueprint and return the complete updated blueprint as a JSON object with the same structure. Preserve all existing fields unless the instruction modifies them. Make the changes precise and realistic.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000,
          response_format: { type: "json_object" },
        });

        let updatedBlueprint: unknown = blueprint;
        try {
          updatedBlueprint = JSON.parse(
            response.choices[0]?.message?.content || "{}",
          );
        } catch {
          updatedBlueprint = blueprint;
        }
        res.json({ blueprint: updatedBlueprint });
      } catch (error) {
        console.error("Edit blueprint error:", error);
        res.status(500).json({ error: "Failed to edit blueprint" });
      }
    },
  );

  app.post(
    "/api/ai/onboarding/suggest-description",
    onboardingRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { serviceName, category } = req.body as {
          serviceName: string;
          category: string;
        };
        if (!serviceName || !category)
          return res
            .status(400)
            .json({ error: "serviceName and category are required" });

        const prompt = `You are a professional copywriter for home service businesses. Write a concise, compelling service description for a provider listing.

Service Name: ${serviceName}
Category: ${category}

Write a 2-3 sentence professional description that:
- Highlights key benefits for the homeowner
- Mentions quality and reliability
- Sounds natural and specific to this service type

Respond with ONLY the description text, no quotes, no extra formatting.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 150,
        });

        const description = response.choices[0]?.message?.content?.trim() || "";
        res.json({ description });
      } catch (error) {
        console.error("Suggest description error:", error);
        res.status(500).json({ error: "Failed to suggest description" });
      }
    },
  );

  app.post(
    "/api/ai/onboarding/suggest-price",
    onboardingRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { serviceName, category, pricingType, location } = req.body as {
          serviceName: string;
          category: string;
          pricingType: string;
          location?: string;
        };
        if (!serviceName || !category || !pricingType) {
          return res.status(400).json({
            error: "serviceName, category, and pricingType are required",
          });
        }

        const prompt = `You are a pricing expert for home service providers. Suggest a competitive price range for this service.

Service: ${serviceName}
Category: ${category}
Pricing Type: ${pricingType}
${location ? `Location: ${location}` : ""}

Respond ONLY with a JSON object:
{"suggestion": {"minPrice": 80, "maxPrice": 150, "unit": "per job", "hint": "one short sentence on pricing context"}}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 120,
          response_format: { type: "json_object" },
        });

        const raw = response.choices[0]?.message?.content?.trim() || "{}";
        const parsed = JSON.parse(raw);
        res.json(parsed);
      } catch (error) {
        console.error("Suggest price error:", error);
        res.status(500).json({ error: "Failed to suggest price" });
      }
    },
  );

  app.post(
    "/api/ai/onboarding/service-blueprint",
    onboardingRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { businessDescription, serviceType, category, providerLocation } =
          req.body as {
            businessDescription: string;
            serviceType: string;
            category: string;
            providerLocation?: string;
          };
        if (!serviceType || !category) {
          return res
            .status(400)
            .json({ error: "serviceType and category are required" });
        }

        const prompt = `You are a home services business expert. Generate a complete service blueprint for a provider offering this service.

Business: ${businessDescription || "Home service provider"}
Service: ${serviceType}
Category: ${category}
Location: ${providerLocation || "local area"}

Return a JSON object with exactly these fields:
{
  "pricingModel": {
    "type": "flat" | "variable" | "service_call" | "quote",
    "basePrice": number (null if quote),
    "priceTiers": [{"label": string, "price": number}],
    "unit": "per job" | "per hour" | "per sqft" | "per visit",
    "description": "one sentence explaining the pricing logic"
  },
  "intakeQuestions": [
    {"id": string, "question": string, "type": "text" | "select" | "number", "options": string[] | null, "required": boolean}
  ],
  "addOns": [
    {"id": string, "name": string, "description": string, "price": number}
  ],
  "checklistTemplate": [string],
  "bookingMode": "instant" | "starts_at" | "quote_only",
  "aiPricingInsight": "one sentence identifying a pricing opportunity for this service type"
}

Rules:
- intakeQuestions: 3-5 questions specific to this exact service
- addOns: 2-4 high-value add-ons with realistic prices
- checklistTemplate: 5-8 short, ordered, on-site steps a tech would actually do for this service. Plain strings, no numbering.
- bookingMode: use "instant" for flat-rate, "starts_at" for variable, "quote_only" for complex jobs
- priceTiers: only include if type is "variable"
- All prices in USD as numbers only`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 800,
          response_format: { type: "json_object" },
        });

        const raw = response.choices[0]?.message?.content?.trim() || "{}";
        const blueprint = JSON.parse(raw);
        res.json({ blueprint });
      } catch (error) {
        console.error("Onboarding service blueprint error:", error);
        res.status(500).json({ error: "Failed to generate service blueprint" });
      }
    },
  );

  app.post(
    "/api/ai/onboarding/generate-bio",
    onboardingRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { businessName, category, serviceName } = req.body as {
          businessName: string;
          category: string;
          serviceName?: string;
        };
        if (!businessName || !category)
          return res
            .status(400)
            .json({ error: "businessName and category are required" });

        const prompt = `You are a professional copywriter who helps home service providers craft compelling business bios.

Write a confident, professional 2-3 sentence bio for:
- Business: ${businessName}
- Category: ${category}
- Specializes in: ${serviceName || category}

The bio should:
- Sound established and trustworthy
- Highlight commitment to quality and homeowner satisfaction
- Feel personal, not like a template
- Use proper grammar and punctuation

Respond ONLY with the bio text. No quotes, no labels, no extra formatting.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 200,
        });

        const bio = response.choices[0]?.message?.content?.trim() || "";
        res.json({ bio });
      } catch (error) {
        console.error("Generate bio error:", error);
        res.status(500).json({ error: "Failed to generate bio" });
      }
    },
  );

  app.post(
    "/api/ai/onboarding/polish-text",
    onboardingRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { text, context } = req.body as {
          text: string;
          context?: string;
        };
        if (!text || !text.trim())
          return res.status(400).json({ error: "text is required" });

        const prompt = `You are a professional editor. Fix the grammar, punctuation, capitalization, and clarity of the following text written by a home service provider${context ? ` (context: ${context})` : ""}.

Original text:
"${text.trim()}"

Rules:
- Fix all grammar, spelling, and punctuation errors
- Improve sentence structure if needed
- Keep the meaning and voice intact — do not add new information
- Use proper capitalization
- Keep it the same length or shorter

Respond ONLY with the polished text. No quotes, no explanations.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 300,
        });

        const rawPolished =
          response.choices[0]?.message?.content?.trim() || text;
        const polished = rawPolished.replace(/^["']|["']$/g, "").trim();
        res.json({ polished });
      } catch (error) {
        console.error("Polish text error:", error);
        res.status(500).json({ error: "Failed to polish text" });
      }
    },
  );

  app.post(
    "/api/ai/suggest-cities",
    requireAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { zipCodes } = req.body as { zipCodes: string[] };
        if (!Array.isArray(zipCodes) || zipCodes.length === 0) {
          return res.status(400).json({ error: "zipCodes array is required" });
        }
        const validZips = zipCodes
          .filter((z) => /^\d{5}$/.test(String(z).trim()))
          .slice(0, 50);
        if (validZips.length === 0) {
          return res
            .status(400)
            .json({ error: "No valid 5-digit ZIP codes provided" });
        }

        const prompt = `You are a US geography expert. Given the following US ZIP codes, return the unique city and state names they belong to.

ZIP codes: ${validZips.join(", ")}

Respond ONLY with a valid JSON array of strings in the format ["City, ST", "City, ST"]. Include only unique city names. No explanations, no markdown, no extra text.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 300,
        });

        const raw = response.choices[0]?.message?.content?.trim() || "[]";
        let cities: string[] = [];
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            // Deduplicate and normalize city names server-side
            const seen = new Set<string>();
            cities = parsed
              .filter((c) => typeof c === "string" && c.trim().length > 0)
              .map((c) => c.trim().replace(/\s+/g, " "))
              .filter((c) => {
                const key = c.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
          }
        } catch {
          cities = [];
        }
        res.json({ cities });
      } catch (error) {
        console.error("Suggest cities error:", error);
        res.status(500).json({ error: "Failed to detect cities" });
      }
    },
  );

  // ============ SMART INTAKE ROUTES ============

  const INTAKE_SYSTEM_PROMPT = `You are HomeBase's Smart Intake AI. Your job is to understand home service problems and gather key details that help service professionals provide accurate quotes and close leads.

Available service categories:
- plumbing: Pipes, fixtures, water heaters, drainage, leaks, toilets, sinks, showers
- electrical: Wiring, outlets, lighting, panels, switches, circuits, ceiling fans
- hvac: Heating, cooling, ventilation, AC, furnace, air quality, thermostats
- cleaning: Deep cleaning, regular maintenance, move-in/out cleaning
- landscaping: Lawn care, gardening, tree services, irrigation, outdoor lighting
- painting: Interior painting, exterior painting, staining, wallpaper
- roofing: Repairs, replacements, inspections, gutters, leaks
- handyman: General repairs, installations, assembly, minor fixes

You must respond with valid JSON only, no markdown. Generate 3-6 smart follow-up questions with appropriate input types.

JSON fields required:
- category: one of the category IDs above
- confidence: number 0-100 for classification confidence
- summary: brief 1-sentence summary of the issue
- severity: "low", "medium", "high", or "emergency"
- questions: array of 3-6 question objects with structure:
  {
    "id": "q1",
    "text": "Question text here",
    "type": "single_choice" | "multiple_choice" | "text" | "number" | "yes_no",
    "options": ["Option 1", "Option 2", "Option 3"], // Required for single_choice/multiple_choice
    "placeholder": "Hint text", // Optional, for text/number inputs
    "required": true
  }
- estimatedPriceRange: { "min": number, "max": number } in USD

Question type guidelines:
- single_choice: "Pick one" questions (Which room? How soon do you need this?)
- multiple_choice: "Select all that apply" (What symptoms? Which fixtures affected?)
- yes_no: Simple yes/no questions (Is this an emergency? Is there visible damage?)
- text: Open-ended details (Describe the sound, Additional notes)
- number: Quantities (How many rooms? Approximate square footage?)

Focus questions on details that affect pricing and help pros close the lead: scope, urgency, accessibility, age of systems, previous repair attempts.`;

  const ESTIMATE_SYSTEM_PROMPT = `You are HomeBase's pricing AI. Based on service details, provide realistic price estimates.

Respond with valid JSON only containing:
- priceRange: object with "min" and "max" in USD
- confidence: number 0-100
- factors: array of strings explaining what affects the price
- recommendation: brief recommendation for the homeowner`;

  app.post(
    "/api/intake/analyze",
    requireAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { problem, conversationHistory } = req.body as {
          problem: string;
          conversationHistory?: { role: string; content: string }[];
        };

        if (!problem) {
          return res
            .status(400)
            .json({ error: "Problem description is required" });
        }

        const messages: {
          role: "system" | "user" | "assistant";
          content: string;
        }[] = [{ role: "system", content: INTAKE_SYSTEM_PROMPT }];

        if (conversationHistory && conversationHistory.length > 0) {
          for (const msg of conversationHistory) {
            messages.push({
              role: msg.role as "user" | "assistant",
              content: msg.content,
            });
          }
        }

        messages.push({ role: "user", content: problem });

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 1024,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || "{}";
        const analysis = JSON.parse(content);

        res.json({
          success: true,
          analysis: {
            category: analysis.category || "handyman",
            confidence: analysis.confidence || 70,
            summary: analysis.summary || "General home service request",
            severity: analysis.severity || "medium",
            questions: analysis.questions || [],
            estimatedPriceRange: analysis.estimatedPriceRange || {
              min: 100,
              max: 300,
            },
          },
        });
      } catch (error) {
        console.error("Error in intake analysis:", error);
        res.status(500).json({ error: "Failed to analyze problem" });
      }
    },
  );

  app.post(
    "/api/intake/refine",
    requireAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { originalAnalysis, answers } = req.body as {
          originalAnalysis: {
            category: string;
            summary: string;
            severity: string;
          };
          answers: { question: string; answer: string }[];
        };

        if (!originalAnalysis || !answers) {
          return res
            .status(400)
            .json({ error: "Original analysis and answers required" });
        }

        const refinementPrompt = `Based on this home service issue:
Category: ${originalAnalysis.category}
Summary: ${originalAnalysis.summary}
Severity: ${originalAnalysis.severity}

The homeowner answered these clarifying questions:
${answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n")}

Provide a comprehensive JSON analysis with:
- refinedSummary: detailed summary incorporating all the answers
- severity: updated severity (low/medium/high/emergency)
- recommendedUrgency: "flexible", "soon", "urgent", or "emergency"
- scopeOfWork: array of specific tasks the job includes
- scopeExclusions: array of what might require extra charges
- serviceOptions: array of 2-3 package options to help close the lead, each with:
  {
    "name": "Basic" | "Standard" | "Premium",
    "description": "What's included in this tier",
    "priceRange": { "min": number, "max": number },
    "includes": ["item1", "item2", "item3"],
    "recommended": boolean (true for the best value option)
  }
- materialEstimate: optional breakdown { "materials": min-max, "labor": min-max }
- timeEstimate: estimated duration (e.g., "2-3 hours", "1-2 days")
- confidence: 0-100 confidence in these estimates`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are HomeBase's pricing AI. Generate realistic estimates with service package options to help pros close leads. Respond with valid JSON only.",
            },
            { role: "user", content: refinementPrompt },
          ],
          max_tokens: 1500,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || "{}";
        const refinedAnalysis = JSON.parse(content);

        res.json({
          success: true,
          refinedAnalysis: {
            refinedSummary:
              refinedAnalysis.refinedSummary || originalAnalysis.summary,
            severity: refinedAnalysis.severity || originalAnalysis.severity,
            recommendedUrgency:
              refinedAnalysis.recommendedUrgency || "flexible",
            scopeOfWork: refinedAnalysis.scopeOfWork || [],
            scopeExclusions: refinedAnalysis.scopeExclusions || [],
            serviceOptions: refinedAnalysis.serviceOptions || [],
            materialEstimate: refinedAnalysis.materialEstimate || null,
            timeEstimate: refinedAnalysis.timeEstimate || null,
            confidence: refinedAnalysis.confidence || 75,
          },
        });
      } catch (error) {
        console.error("Error refining intake:", error);
        res.status(500).json({ error: "Failed to refine analysis" });
      }
    },
  );

  app.post(
    "/api/intake/match-providers",
    requireAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { category, zipCode } = req.body as {
          category: string;
          zipCode?: string;
        };

        if (!category) {
          return res.status(400).json({ error: "Category is required" });
        }

        const categoryMap: Record<string, string> = {
          plumbing: "plumbing",
          electrical: "electrical",
          hvac: "hvac",
          cleaning: "cleaning",
          landscaping: "lawn",
          painting: "painting",
          roofing: "roofing",
          handyman: "handyman",
        };

        const categoryId = categoryMap[category.toLowerCase()] || "handyman";
        const allProviders = await storage.getProviders(categoryId);

        const rankedProviders = allProviders
          .map((provider) => ({
            ...provider,
            trustScore: calculateTrustScore(provider),
          }))
          .sort((a, b) => b.trustScore - a.trustScore)
          .slice(0, 5);

        res.json({
          success: true,
          providers: rankedProviders,
          totalAvailable: allProviders.length,
        });
      } catch (error) {
        console.error("Error matching providers:", error);
        res.status(500).json({ error: "Failed to match providers" });
      }
    },
  );

  function calculateTrustScore(provider: {
    rating?: string | number | null;
    reviewCount?: number | null;
    yearsExperience?: number | null;
    isVerified?: boolean | null;
  }): number {
    const rating =
      typeof provider.rating === "string"
        ? parseFloat(provider.rating)
        : provider.rating || 4;
    const ratingScore = rating * 15;
    const reviewScore = Math.min((provider.reviewCount || 0) / 5, 20);
    const experienceScore = Math.min((provider.yearsExperience || 0) * 2, 20);
    const verifiedBonus = provider.isVerified ? 15 : 0;
    return Math.round(
      ratingScore + reviewScore + experienceScore + verifiedBonus,
    );
  }

  app.post(
    "/api/intake/explain-issue",
    requireAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const { problem, category, answers, service, providerName } =
          req.body as {
            problem: string;
            category: string;
            answers: Record<string, string | string[]>;
            service?: string;
            providerName?: string;
          };

        if (!problem || !category) {
          return res
            .status(400)
            .json({ error: "Problem and category are required" });
        }

        const answersSummary = Object.entries(answers)
          .map(
            ([key, value]) =>
              `${key}: ${Array.isArray(value) ? value.join(", ") : value}`,
          )
          .join("\n");

        const prompt = `Based on the following home service issue, provide a clear explanation for the homeowner.

Problem: ${problem}
Service Category: ${category}
${service ? `Requested Service: ${service}` : ""}
${providerName ? `Service Provider: ${providerName}` : ""}

Additional Details:
${answersSummary}

Respond with JSON only:
{
  "explanation": "A 2-3 sentence explanation of the issue in simple terms that helps the homeowner understand what's likely happening",
  "recommendedService": "The specific service that best matches their needs",
  "whatToExpect": ["Step 1 the professional will take", "Step 2", "Step 3"],
  "estimatedDuration": "How long the assessment/repair typically takes",
  "priceRange": { "min": number, "max": number }
}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a home services expert helping homeowners understand their issues. Be clear, helpful, and reassuring.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 800,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(content);

        res.json({
          explanation:
            parsed.explanation ||
            "Based on your description, we understand your situation and will connect you with a qualified professional.",
          recommendedService: parsed.recommendedService || service || category,
          whatToExpect: parsed.whatToExpect || [
            "A professional will contact you to confirm the appointment",
            "They'll assess the situation at your location",
            "You'll receive a final quote before work begins",
          ],
          estimatedDuration: parsed.estimatedDuration || "1-2 hours",
          priceRange: parsed.priceRange || { min: 100, max: 300 },
        });
      } catch (error) {
        console.error("Error explaining issue:", error);
        res.status(500).json({ error: "Failed to explain issue" });
      }
    },
  );

  // ============ HOME SERVICE HISTORY & REMINDERS ============

  // Get service history for a home (completed appointments)
  app.get(
    "/api/homes/:homeId/service-history",
    requireAuth,
    async (req: Request<{ homeId: string }>, res: Response) => {
      try {
        const { homeId } = req.params;
        const home = await storage.getHome(homeId);
        if (!home || home.userId !== req.authenticatedUserId) {
          return res.status(404).json({ error: "Home not found" });
        }
        const serviceHistory = await db
          .select({
            id: appointments.id,
            homeId: appointments.homeId,
            providerId: appointments.providerId,
            serviceName: appointments.serviceName,
            description: appointments.description,
            status: appointments.status,
            estimatedPrice: appointments.estimatedPrice,
            finalPrice: appointments.finalPrice,
            notes: appointments.notes,
            scheduledDate: appointments.scheduledDate,
            completedAt: appointments.completedAt,
            cancelledAt: appointments.cancelledAt,
            isRecurring: appointments.isRecurring,
            createdAt: appointments.createdAt,
            providerName: providers.businessName,
          })
          .from(appointments)
          .leftJoin(providers, eq(appointments.providerId, providers.id))
          .where(eq(appointments.homeId, homeId))
          .orderBy(
            sql`${appointments.completedAt} DESC NULLS LAST, ${appointments.scheduledDate} DESC`,
          );

        res.json({ serviceHistory });
      } catch (error) {
        console.error("Error fetching service history:", error);
        res.status(500).json({ error: "Failed to fetch service history" });
      }
    },
  );

  // Get maintenance reminders for a home
  app.get(
    "/api/homes/:homeId/reminders",
    requireAuth,
    async (req: Request<{ homeId: string }>, res: Response) => {
      try {
        const { homeId } = req.params;
        const home = await storage.getHome(homeId);
        if (!home || home.userId !== req.authenticatedUserId) {
          return res.status(404).json({ error: "Home not found" });
        }
        const reminders = await db
          .select()
          .from(maintenanceReminders)
          .where(eq(maintenanceReminders.homeId, homeId))
          .orderBy(maintenanceReminders.nextDueAt);

        res.json({ reminders });
      } catch (error) {
        console.error("Error fetching reminders:", error);
        res.status(500).json({ error: "Failed to fetch reminders" });
      }
    },
  );

  // Create maintenance reminder
  app.post(
    "/api/homes/:homeId/reminders",
    requireAuth,
    async (req: Request<{ homeId: string }>, res: Response) => {
      try {
        const { homeId } = req.params;
        const home = await storage.getHome(homeId);
        if (!home || home.userId !== req.authenticatedUserId) {
          return res.status(404).json({ error: "Home not found" });
        }
        const { title, description, category, frequency, nextDueAt } =
          req.body;
        const userId = req.authenticatedUserId!;

        const [reminder] = await db
          .insert(maintenanceReminders)
          .values({
            homeId,
            userId,
            title,
            description,
            category,
            frequency,
            nextDueAt: new Date(nextDueAt),
          })
          .returning();

        res.json({ reminder });
      } catch (error) {
        console.error("Error creating reminder:", error);
        res.status(500).json({ error: "Failed to create reminder" });
      }
    },
  );

  // Mark reminder as completed (updates lastCompletedAt and nextDueAt)
  app.put(
    "/api/reminders/:id/complete",
    requireAuth,
    async (req: Request<{ id: string }>, res: Response) => {
      try {
        const { id } = req.params;

        const [existing] = await db
          .select()
          .from(maintenanceReminders)
          .where(eq(maintenanceReminders.id, id));
        if (!existing) {
          return res.status(404).json({ error: "Reminder not found" });
        }

        // Verify the authenticated user owns the home this reminder belongs to
        const home = await storage.getHome(existing.homeId);
        if (!home || home.userId !== req.authenticatedUserId) {
          return res.status(404).json({ error: "Reminder not found" });
        }

        const frequencyToMonths: Record<string, number> = {
          monthly: 1,
          quarterly: 3,
          biannually: 6,
          annually: 12,
          custom: 12,
        };

        const months = frequencyToMonths[existing.frequency || "annually"];
        const nextDue = new Date();
        nextDue.setMonth(nextDue.getMonth() + months);

        const [updated] = await db
          .update(maintenanceReminders)
          .set({
            lastCompletedAt: new Date(),
            nextDueAt: nextDue,
          })
          .where(eq(maintenanceReminders.id, id))
          .returning();

        res.json({ reminder: updated });
      } catch (error) {
        console.error("Error completing reminder:", error);
        res.status(500).json({ error: "Failed to complete reminder" });
      }
    },
  );

  // ============ PROVIDER AVAILABILITY ENDPOINT ============

  app.get(
    "/api/provider/:providerId/availability",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        const { date } = req.query as { date?: string };

        // Load availability rules from the provider's active booking link
        const [link] = await db
          .select()
          .from(bookingLinks)
          .where(eq(bookingLinks.providerId, req.params.providerId))
          .limit(1);

        type AvailabilityRules = {
          workingHours?: { start: string; end: string; days?: number[] };
          startHour?: number;
          endHour?: number;
          slotIntervalMinutes?: number;
          blackoutDates?: string[];
        };

        let rules: AvailabilityRules = {};
        if (link?.availabilityRules) {
          try {
            rules = JSON.parse(link.availabilityRules) as AvailabilityRules;
          } catch {
            /* ignore */
          }
        }

        // Check blackout dates
        const blackoutDates: string[] = rules.blackoutDates || [];
        if (date && blackoutDates.includes(date)) {
          return res.json({ slots: [] });
        }

        // Determine working hours — default Mon-Fri, 8am-5pm
        const startHour = rules.workingHours?.start
          ? parseInt(rules.workingHours.start.split(":")[0], 10)
          : (rules.startHour ?? 8);
        const endHour = rules.workingHours?.end
          ? parseInt(rules.workingHours.end.split(":")[0], 10)
          : (rules.endHour ?? 17);
        const intervalMinutes = rules.slotIntervalMinutes ?? 60;

        // If date provided, check day-of-week against working days
        if (date) {
          const d = new Date(date + "T12:00:00Z"); // Noon UTC to avoid timezone flips
          const dayOfWeek = d.getUTCDay(); // 0=Sun, 6=Sat
          const workingDays = rules.workingHours?.days ?? [1, 2, 3, 4, 5]; // Mon-Fri
          if (!workingDays.includes(dayOfWeek)) {
            return res.json({ slots: [] });
          }
        }

        // Generate time slots
        const slots: { startTime: string; label: string }[] = [];
        for (let h = startHour; h < endHour; h += intervalMinutes / 60) {
          const hour = Math.floor(h);
          const minute = Math.round((h - hour) * 60);
          const startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
          const ampm = hour < 12 ? "AM" : "PM";
          const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
          const label =
            minute === 0
              ? `${displayHour} ${ampm}`
              : `${displayHour}:${String(minute).padStart(2, "0")} ${ampm}`;
          slots.push({ startTime, label });
        }

        res.json({
          slots,
          workingDays: rules.workingHours?.days ?? [1, 2, 3, 4, 5],
        });
      } catch (error) {
        console.error("Provider availability error:", error);
        res.status(500).json({ error: "Failed to get availability" });
      }
    },
  );

  // ============ PROVIDER CUSTOM SERVICES ROUTES ============

  app.get(
    "/api/provider/:providerId/custom-services",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        const publishedOnly = req.query.publishedOnly === "true";
        // Non-published services are private — require ownership when returning all services
        if (!publishedOnly) {
          if (!(await assertProviderOwnership(req, req.params.providerId, res)))
            return;
        }
        const conditions = publishedOnly
          ? and(
              eq(providerCustomServices.providerId, req.params.providerId),
              eq(providerCustomServices.isPublished, true),
            )
          : eq(providerCustomServices.providerId, req.params.providerId);
        const svcList = await db
          .select()
          .from(providerCustomServices)
          .where(conditions)
          .orderBy(providerCustomServices.createdAt);
        res.json({ services: svcList });
      } catch (error) {
        console.error("Get custom services error:", error);
        res.status(500).json({ error: "Failed to get services" });
      }
    },
  );

  app.post(
    "/api/provider/:providerId/custom-services",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        // Verify provider exists and belongs to authenticated user
        const provider = await storage.getProvider(req.params.providerId);
        if (!provider) {
          return res.status(404).json({ error: "Provider not found" });
        }
        if (provider.userId !== authUserId) {
          return res
            .status(403)
            .json({ error: "Access denied: provider does not belong to you" });
        }
        const parsed = insertProviderCustomServiceSchema.safeParse({
          ...req.body,
          providerId: req.params.providerId,
        });
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "Invalid input", details: parsed.error.issues });
        }
        const [svc] = await db
          .insert(providerCustomServices)
          .values(parsed.data)
          .returning();
        res.status(201).json({ service: svc });
      } catch (error) {
        console.error("Create custom service error:", error);
        res.status(500).json({ error: "Failed to create service" });
      }
    },
  );

  app.put(
    "/api/provider/:providerId/custom-services/:id",
    requireAuth,
    async (req: Request<ProviderIdParams & IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const [existing] = await db
          .select()
          .from(providerCustomServices)
          .where(eq(providerCustomServices.id, req.params.id));
        if (!existing)
          return res.status(404).json({ error: "Service not found" });
        if (existing.providerId !== req.params.providerId) {
          return res.status(403).json({ error: "Forbidden" });
        }
        // Verify ownership: the provider must belong to the authenticated user
        const provider = await storage.getProvider(req.params.providerId);
        if (!provider || provider.userId !== authUserId) {
          return res
            .status(403)
            .json({ error: "Access denied: provider does not belong to you" });
        }
        // Allowlist mutable fields only — prevent mass-assignment of id/providerId/createdAt
        const {
          name,
          category,
          description,
          pricingType,
          basePrice,
          priceFrom,
          priceTo,
          priceTiersJson,
          duration,
          isPublished,
          isAddon,
          isRecurring,
          recurringFrequency,
          recurringPrice,
          intakeQuestionsJson,
          addOnsJson,
          checklistTemplateJson,
          bookingMode,
          aiPricingInsight,
          applyChecklistToFutureJobs,
        } = req.body;
        const allowedUpdate: Partial<
          typeof providerCustomServices.$inferInsert
        > = {};
        if (name !== undefined) allowedUpdate.name = name;
        if (category !== undefined) allowedUpdate.category = category;
        if (description !== undefined) allowedUpdate.description = description;
        if (pricingType !== undefined) allowedUpdate.pricingType = pricingType;
        if (basePrice !== undefined) allowedUpdate.basePrice = basePrice;
        if (priceFrom !== undefined) allowedUpdate.priceFrom = priceFrom;
        if (priceTo !== undefined) allowedUpdate.priceTo = priceTo;
        if (priceTiersJson !== undefined)
          allowedUpdate.priceTiersJson = priceTiersJson;
        if (duration !== undefined) allowedUpdate.duration = duration;
        if (isPublished !== undefined) allowedUpdate.isPublished = isPublished;
        if (isAddon !== undefined) allowedUpdate.isAddon = isAddon;
        if (isRecurring !== undefined) allowedUpdate.isRecurring = isRecurring;
        if (recurringFrequency !== undefined)
          allowedUpdate.recurringFrequency = recurringFrequency;
        if (recurringPrice !== undefined)
          allowedUpdate.recurringPrice = recurringPrice;
        if (intakeQuestionsJson !== undefined)
          allowedUpdate.intakeQuestionsJson = intakeQuestionsJson;
        if (addOnsJson !== undefined) allowedUpdate.addOnsJson = addOnsJson;
        if (checklistTemplateJson !== undefined)
          allowedUpdate.checklistTemplateJson = checklistTemplateJson;
        const VALID_BOOKING_MODES = ["instant", "starts_at", "quote_only"];
        if (bookingMode !== undefined) {
          if (!VALID_BOOKING_MODES.includes(bookingMode)) {
            return res.status(400).json({
              error: `Invalid bookingMode. Must be one of: ${VALID_BOOKING_MODES.join(", ")}`,
            });
          }
          allowedUpdate.bookingMode = bookingMode;
        }
        if (aiPricingInsight !== undefined)
          allowedUpdate.aiPricingInsight = aiPricingInsight;
        const [svc] = await db
          .update(providerCustomServices)
          .set({ ...allowedUpdate, updatedAt: new Date() })
          .where(eq(providerCustomServices.id, req.params.id))
          .returning();

        // Optional bulk-apply: when the provider opted in via the wizard's
        // "Apply to existing future jobs" toggle and a checklist template
        // was sent in the same payload, propagate it to every future job
        // created from this service that hasn't started yet (status not
        // completed/cancelled, scheduled today or later). Existing
        // checklists are overwritten on purpose — that is the explicit
        // intent of the opt-in. Failures are logged but don't fail the
        // service update itself.
        let appliedToJobs = 0;
        if (
          applyChecklistToFutureJobs === true &&
          Array.isArray(checklistTemplateJson)
        ) {
          const templateItems = (checklistTemplateJson as unknown[])
            .filter(
              (it): it is { id?: unknown; label?: unknown } =>
                typeof it === "object" && it !== null,
            )
            .map((it, i) => ({
              id: String(it.id ?? `c_${Date.now()}_${i}`),
              label: String(it.label ?? "").slice(0, 200),
              completed: false,
            }))
            .filter((it) => it.label.length > 0);
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const updated = await db
            .update(jobs)
            .set({ checklist: templateItems })
            .where(
              and(
                eq(jobs.customServiceId, req.params.id),
                eq(jobs.providerId, req.params.providerId),
                notInArray(jobs.status, ["completed", "cancelled", "weather_held"]),
                gte(jobs.scheduledDate, todayStart),
              ),
            )
            .returning({ id: jobs.id });
          appliedToJobs = updated.length;
        }

        res.json({ service: svc, appliedToJobs });
      } catch (error) {
        console.error("Update custom service error:", error);
        res.status(500).json({ error: "Failed to update service" });
      }
    },
  );

  app.delete(
    "/api/provider/:providerId/custom-services/:id",
    requireAuth,
    async (req: Request<ProviderIdParams & IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const [existing] = await db
          .select()
          .from(providerCustomServices)
          .where(eq(providerCustomServices.id, req.params.id));
        if (!existing)
          return res.status(404).json({ error: "Service not found" });
        if (existing.providerId !== req.params.providerId) {
          return res.status(403).json({ error: "Forbidden" });
        }
        // Verify ownership: the provider must belong to the authenticated user
        const provider = await storage.getProvider(req.params.providerId);
        if (!provider || provider.userId !== authUserId) {
          return res
            .status(403)
            .json({ error: "Access denied: provider does not belong to you" });
        }
        await db
          .delete(providerCustomServices)
          .where(eq(providerCustomServices.id, req.params.id));
        res.json({ success: true });
      } catch (error) {
        console.error("Delete custom service error:", error);
        res.status(500).json({ error: "Failed to delete service" });
      }
    },
  );

  // ============ PROVIDER PORTAL ROUTES ============

  // Provider registration/onboarding
  app.post(
    "/api/provider/register",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const parsed = insertProviderSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "Invalid input", details: parsed.error.issues });
        }

        // Enforce that the caller can only register a provider profile for themselves
        if (parsed.data.userId && parsed.data.userId !== authUserId) {
          return res.status(403).json({
            error: "Cannot register provider profile for another user",
          });
        }

        // Task #352: strip the inviter's referral code from the provider insert data
        // so it never collides with the new provider's own referral_code column.
        // The field is intentionally named to match what BecomeProviderScreen sends;
        // it is handled separately below.
        const { referralCode: submittedInviterCode, ...providerFields } = parsed.data;

        // Task #352: generate a unique referral code BEFORE creating the provider so
        // it is included in the INSERT — avoiding a separate UPDATE step and the
        // partial-state window if that UPDATE failed.
        const referralCode = await generateUniqueProviderReferralCode();

        // Ensure userId is always the authenticated user (even if not in body)
        const providerData = { ...providerFields, userId: authUserId, referralCode };

        // Check if user already has a provider profile
        const existing = await storage.getProviderByUserId(authUserId);
        if (existing) {
          return res
            .status(409)
            .json({ error: "User already has a provider profile" });
        }

        const provider = await storage.createProvider(providerData);

        // Task #353: if the registering user was previously a crew member,
        // grant them a 90-day extended trial and notify the original provider.
        try {
          const [crewRecord] = await db
            .select({ providerId: crewMembers.providerId })
            .from(crewMembers)
            .where(eq(crewMembers.invitedUserId, authUserId))
            .limit(1);

          if (crewRecord) {
            await db
              .update(providers)
              .set({ crewOriginProviderId: crewRecord.providerId })
              .where(eq(providers.id, provider.id));
            await extendSubscriptionByDays(provider.id, 90);
            await sendCrewLaunchedNotification(
              provider.businessName,
              crewRecord.providerId,
            );
          }
        } catch (crewErr) {
          console.error("[crew-upgrade] Failed to process crew origin:", crewErr);
        }

        // Task #352: if the registering provider used a referral code, record it
        const incomingCode = (submittedInviterCode as string | undefined)?.trim().toUpperCase();
        if (incomingCode) {
          try {
            const [referrerProvider] = await db
              .select({ id: providers.id })
              .from(providers)
              .where(eq(providers.referralCode, incomingCode))
              .limit(1);
            if (referrerProvider && referrerProvider.id !== provider.id) {
              await db.insert(providerReferrals).values({
                referrerProviderId: referrerProvider.id,
                referredProviderId: provider.id,
                referralCode: incomingCode,
              });
            }
          } catch (refErr) {
            // Non-fatal — log and continue
            console.error("[referral] Failed to record referral at signup:", refErr);
          }
        }

        // Mark user as provider
        await storage.updateUser(authUserId, { isProvider: true });

        res.status(201).json({ provider: { ...provider, referralCode } });
      } catch (error) {
        console.error("Provider registration error:", error);
        res.status(500).json({ error: "Failed to register provider" });
      }
    },
  );

  // Task #352: Referral info — GET /api/providers/me/referral
  // Returns the authenticated provider's referral code, shareable link,
  // and a list of referred providers with their conversion status.
  app.get(
    "/api/providers/me/referral",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const [provider] = await db
          .select({ id: providers.id, referralCode: providers.referralCode })
          .from(providers)
          .where(eq(providers.userId, authUserId))
          .limit(1);
        if (!provider) {
          return res.status(404).json({ error: "Provider not found" });
        }

        // Ensure referral code exists (lazy backfill for providers created before Task #352)
        let code = provider.referralCode;
        if (!code) {
          code = await generateUniqueProviderReferralCode();
          await db
            .update(providers)
            .set({ referralCode: code })
            .where(eq(providers.id, provider.id));
        }

        const shareLink = `https://homebaseproapp.com/join?ref=${code}`;

        // Fetch referrals where this provider is the referrer
        const referrals = await db
          .select({
            id: providerReferrals.id,
            referredProviderId: providerReferrals.referredProviderId,
            signedUpAt: providerReferrals.signedUpAt,
            firstJobCompletedAt: providerReferrals.firstJobCompletedAt,
            rewardGrantedAt: providerReferrals.rewardGrantedAt,
            businessName: providers.businessName,
          })
          .from(providerReferrals)
          .leftJoin(providers, eq(providerReferrals.referredProviderId, providers.id))
          .where(eq(providerReferrals.referrerProviderId, provider.id))
          .orderBy(desc(providerReferrals.signedUpAt));

        res.json({
          referralCode: code,
          shareLink,
          referrals: referrals.map((r) => ({
            id: r.id,
            referredProviderId: r.referredProviderId,
            businessName: r.businessName ?? "Unknown",
            signedUpAt: r.signedUpAt,
            firstJobCompletedAt: r.firstJobCompletedAt,
            rewardGrantedAt: r.rewardGrantedAt,
            status: r.rewardGrantedAt
              ? "rewarded"
              : r.firstJobCompletedAt
                ? "converted"
                : "signed_up",
          })),
        });
      } catch (error) {
        console.error("Referral info error:", error);
        res.status(500).json({ error: "Failed to fetch referral info" });
      }
    },
  );

  // POST /api/provider/me/first-payment-celebrated — mark the first-payment
  // celebration as shown so it never fires again (Task #407).
  app.post(
    "/api/provider/me/first-payment-celebrated",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const [provider] = await db
          .select({ id: providers.id })
          .from(providers)
          .where(eq(providers.userId, authUserId));
        if (!provider) {
          return res.status(404).json({ error: "Provider not found" });
        }
        await db
          .update(providers)
          .set({ firstPaymentCelebrated: true })
          .where(eq(providers.id, provider.id));
        res.json({ ok: true });
      } catch (error) {
        req.log.error(error, "first-payment-celebrated error");
        res.status(500).json({ error: "Failed to mark celebration" });
      }
    },
  );

  // Get provider by user ID
  app.get(
    "/api/provider/user/:userId",
    requireAuth,
    async (req: Request<UserIdParams>, res: Response) => {
      try {
        // Owner-only: this endpoint resolves the signed-in user's own
        // provider record (used to recover from a stale local providerId).
        if (req.params.userId !== req.authenticatedUserId) {
          return res
            .status(403)
            .json({ error: "Forbidden: you may only look up your own provider record" });
        }
        const provider = await storage.getProviderByUserId(req.params.userId);
        if (!provider) {
          return res.status(404).json({ error: "Provider not found" });
        }
        res.json({ provider: normalizeProviderForResponse(provider) });
      } catch (error) {
        console.error("Get provider error:", error);
        res.status(500).json({ error: "Failed to get provider" });
      }
    },
  );

  // Get provider by provider ID (owner-only)
  app.get(
    "/api/provider/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const provider = await storage.getProvider(req.params.id);
        if (!provider) {
          return res.status(404).json({ error: "Provider not found" });
        }
        if (provider.userId !== req.authenticatedUserId) {
          return res
            .status(403)
            .json({ error: "Forbidden: you do not own this provider profile" });
        }
        res.json({ provider: normalizeProviderForResponse(provider) });
      } catch (error) {
        console.error("Get provider by ID error:", error);
        res.status(500).json({ error: "Failed to get provider" });
      }
    },
  );

  // Update provider profile (PUT - full update)
  app.put(
    "/api/provider/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        // Ownership check: only the provider's own user account may update this profile
        const existing = await storage.getProvider(req.params.id);
        if (!existing) {
          return res.status(404).json({ error: "Provider not found" });
        }
        if (existing.userId !== req.authenticatedUserId) {
          return res
            .status(403)
            .json({ error: "Forbidden: you do not own this provider profile" });
        }
        const provider = await storage.updateProvider(req.params.id, req.body);
        if (!provider) {
          return res.status(404).json({ error: "Provider not found" });
        }
        res.json({ provider });
      } catch (error) {
        console.error("Update provider error:", error);
        res.status(500).json({ error: "Failed to update provider" });
      }
    },
  );

  // Update provider profile (PATCH - partial update, serializes JSON fields)
  app.patch(
    "/api/provider/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const { id } = req.params;

        // Ownership check: only the provider's own user account may update this profile
        const ownerCheck = await storage.getProvider(id);
        if (!ownerCheck) {
          return res.status(404).json({ error: "Provider not found" });
        }
        if (ownerCheck.userId !== req.authenticatedUserId) {
          return res
            .status(403)
            .json({ error: "Forbidden: you do not own this provider profile" });
        }

        const body = req.body;
        const update: Record<string, any> = {};

        const directFields = [
          "businessName",
          "description",
          "phone",
          "email",
          "serviceArea",
          "avatarUrl",
          "hourlyRate",
          "yearsExperience",
          "serviceRadius",
          "serviceZipCodes",
          "serviceCities",
          "isPublic",
          "isActive",
        ];
        for (const field of directFields) {
          if (body[field] !== undefined) update[field] = body[field];
        }

        // Gate publishing on Stripe Connect readiness. A provider may only
        // flip isPublic=true if their Connect account has chargesEnabled,
        // otherwise homeowners would land on a profile that cannot accept
        // payment. Setting isPublic=false (unpublishing) is always allowed.
        if (update.isPublic === true) {
          const ready = await isProviderReadyForCharges(id);
          if (!ready) {
            return res.status(422).json({
              error: "stripe_not_ready",
              message:
                "Set up payments with Stripe before publishing your profile so clients can book and pay you.",
            });
          }
        }

        // Same gate for the "Available for Work" toggle (top-level isActive).
        // Flipping availability ON without Stripe ready would put the toggle
        // out of sync with the unlisted state and silently fail discovery.
        // Setting isActive=false (going unavailable) is always allowed.
        if (update.isActive === true) {
          const ready = await isProviderReadyForCharges(id);
          if (!ready) {
            return res.status(422).json({
              error: "stripe_not_ready",
              message:
                "Finish Stripe setup to start accepting bookings.",
            });
          }
        }

        // Store JSON object fields as objects (Supabase jsonb columns)
        // instantBooking and advanceBookingDays are stored inside bookingPolicies JSON (not top-level columns)
        if (
          body.bookingPolicies !== undefined ||
          body.instantBooking !== undefined ||
          body.advanceBookingDays !== undefined
        ) {
          const existingProvider = await storage.getProvider(id);
          let currentPolicies: Record<string, any> = {};
          if (existingProvider?.bookingPolicies) {
            currentPolicies =
              typeof existingProvider.bookingPolicies === "string"
                ? (() => {
                    try {
                      return JSON.parse(
                        existingProvider.bookingPolicies as string,
                      );
                    } catch {
                      return {};
                    }
                  })()
                : (existingProvider.bookingPolicies as Record<string, any>) ||
                  {};
          }
          const incomingPolicies =
            body.bookingPolicies !== undefined
              ? typeof body.bookingPolicies === "string"
                ? JSON.parse(body.bookingPolicies)
                : body.bookingPolicies
              : {};
          const merged: Record<string, any> = {
            ...currentPolicies,
            ...incomingPolicies,
          };
          if (body.instantBooking !== undefined)
            merged.instantBooking = body.instantBooking;
          if (body.advanceBookingDays !== undefined)
            merged.advanceBookingDays = body.advanceBookingDays;
          update.bookingPolicies = merged;
        }
        if (body.businessHours !== undefined) {
          update.businessHours =
            typeof body.businessHours === "string"
              ? JSON.parse(body.businessHours)
              : body.businessHours;
        }
        // Note: legacy `availability` payload is intentionally ignored here.
        // The "Available for Work" toggle is the top-level `isActive` column.
        // Hours/availability JSON is managed via `bookingPolicies` / `businessHours`.

        if (Object.keys(update).length === 0) {
          return res.status(400).json({ error: "No valid fields to update" });
        }

        const provider = await storage.updateProvider(id, update);
        if (!provider) {
          return res.status(404).json({ error: "Provider not found" });
        }
        res.json({ provider: normalizeProviderForResponse(provider) });
      } catch (error: any) {
        console.error("Patch provider error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to update provider" });
      }
    },
  );

  // Upload provider logo/avatar — accepts base64 data URL, saves to Supabase Storage
  app.post(
    "/api/provider/:id/logo",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const { id } = req.params;
        const { base64 } = req.body as { base64?: string };

        if (!base64) {
          return res.status(400).json({ error: "base64 image data required" });
        }

        // Ownership check
        const existing = await storage.getProvider(id);
        if (!existing) {
          return res.status(404).json({ error: "Provider not found" });
        }
        if (existing.userId !== req.authenticatedUserId) {
          return res.status(403).json({ error: "Forbidden" });
        }

        const ALLOWED_MIME_PREFIXES_LOGO = [
          "data:image/jpeg;base64,",
          "data:image/jpg;base64,",
          "data:image/png;base64,",
          "data:image/webp;base64,",
        ];
        const prefix = ALLOWED_MIME_PREFIXES_LOGO.find((p) =>
          base64.startsWith(p),
        );
        if (!prefix) {
          return res
            .status(400)
            .json({ error: "Invalid image format. Use JPEG, PNG, or WebP." });
        }

        const ext =
          prefix.includes("jpeg") || prefix.includes("jpg")
            ? "jpg"
            : prefix.includes("png")
              ? "png"
              : "webp";
        const mimeType =
          ext === "jpg"
            ? "image/jpeg"
            : ext === "png"
              ? "image/png"
              : "image/webp";
        const base64Data = base64.slice(prefix.length);
        const buffer = Buffer.from(base64Data, "base64");
        const filename = `provider-${id}-logo-${Date.now()}.${ext}`;

        let logoUrl: string;

        const isDev = process.env.NODE_ENV === "development";
        let supabaseClient: typeof import("../lib/supabase").supabase | null =
          null;
        try {
          supabaseClient = (await import("../lib/supabase")).supabase;
        } catch {}

        if (supabaseClient) {
          const { error: uploadError } = await supabaseClient.storage
            .from("job-photos")
            .upload(`logos/${filename}`, buffer, {
              contentType: mimeType,
              upsert: true,
            });
          if (uploadError) throw new Error("Failed to upload logo to storage");
          const { data: publicUrlData } = supabaseClient.storage
            .from("job-photos")
            .getPublicUrl(`logos/${filename}`);
          logoUrl = publicUrlData.publicUrl;
        } else if (isDev) {
          const uploadDir = path.resolve(process.cwd(), "uploads", "logos");
          if (!fs.existsSync(uploadDir))
            fs.mkdirSync(uploadDir, { recursive: true });
          fs.writeFileSync(path.join(uploadDir, filename), buffer);
          const protocol = req.protocol;
          const host = req.get("host") || "";
          logoUrl = `${protocol}://${host}/uploads/logos/${filename}`;
        } else {
          return res.status(503).json({ error: "Storage not configured" });
        }

        const updated = await storage.updateProvider(id, {
          avatarUrl: logoUrl,
        });
        res.json({ avatarUrl: logoUrl, provider: updated });
      } catch (error: any) {
        console.error("Provider logo upload error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to upload logo" });
      }
    },
  );

  // Provider dashboard stats
  app.get(
    "/api/provider/:id/stats",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        // Verify the authenticated user owns this provider record
        const providerRow = await storage.getProviderByUserId(
          req.authenticatedUserId!,
        );
        if (!providerRow || providerRow.id !== req.params.id) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }

        const { startDate, endDate } = req.query;
        let start: Date | undefined;
        let end: Date | undefined;

        if (startDate) {
          start = new Date(startDate as string);
          if (isNaN(start.getTime())) {
            res.status(400).json({ error: "Invalid startDate" });
            return;
          }
        }
        if (endDate) {
          end = new Date(endDate as string);
          if (isNaN(end.getTime())) {
            res.status(400).json({ error: "Invalid endDate" });
            return;
          }
        }
        if (start && end && start > end) {
          res.status(400).json({ error: "startDate must be before endDate" });
          return;
        }

        const stats = await storage.getProviderStats(req.params.id, start, end);
        res.json({ stats });
      } catch (error) {
        console.error("Get provider stats error:", error);
        res.status(500).json({ error: "Failed to get provider stats" });
      }
    },
  );

  // Task #487: Home/lock-screen iOS widgets. The app fetches (or creates) a
  // long-lived opaque token, then embeds {providerId, token} into the shared
  // App Group storage the WidgetKit extension reads from — the extension
  // presents that token to the public snapshot route below instead of a
  // full session/JWT so it can refresh itself without the app running.
  app.post(
    "/api/provider/:id/widget-token",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const providerRow = await storage.getProviderByUserId(
          req.authenticatedUserId!,
        );
        if (!providerRow || providerRow.id !== req.params.id) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        const token = await storage.getOrCreateProviderWidgetToken(req.params.id);
        res.json({ token });
      } catch (error) {
        console.error("Get widget token error:", error);
        res.status(500).json({ error: "Failed to get widget token" });
      }
    },
  );

  // Public, unauthenticated: guarded only by the opaque per-provider token
  // above. Returns the minimal fields the Next Job / Earnings widgets show.
  app.get(
    "/api/public/widget-snapshot",
    widgetSnapshotRateLimit,
    async (req: Request, res: Response) => {
      try {
        const providerId = String(req.query.providerId || "");
        const token = String(req.query.token || "");
        if (!providerId || !token) {
          res.status(400).json({ error: "providerId and token are required" });
          return;
        }
        const provider = await storage.getProviderByWidgetToken(token);
        if (!provider || provider.id !== providerId) {
          res.status(401).json({ error: "Invalid widget token" });
          return;
        }
        const snapshot = await storage.getProviderWidgetSnapshot(providerId);
        res.json({
          businessName: provider.businessName,
          ...snapshot,
        });
      } catch (error) {
        console.error("Get widget snapshot error:", error);
        res.status(500).json({ error: "Failed to get widget snapshot" });
      }
    },
  );

  // Provider business insights — authenticated user must own this provider record
  app.get(
    "/api/provider/:id/insights",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const providerRow = await storage.getProviderByUserId(
          req.authenticatedUserId!,
        );
        if (!providerRow || providerRow.id !== req.params.id) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        const insights = await storage.getProviderInsights(req.params.id);

        fireInsightNotifications(req.authenticatedUserId!, {
          allTimeRevenue: insights.allTimeRevenue,
          clientGrowthPct: insights.clientGrowthPct,
          rating: insights.rating,
          reviewCount: insights.reviewCount,
        }).catch(console.error);

        const {
          allTimeRevenue,
          clientGrowthPct,
          rating,
          reviewCount,
          ...dashboardInsights
        } = insights;
        res.json({ insights: dashboardInsights });
      } catch (error) {
        console.error("Get provider insights error:", error);
        res.status(500).json({ error: "Failed to get provider insights" });
      }
    },
  );

  // Task #488: locked-in recurring revenue tile + forward calendar heatmap
  // data. Authenticated user must own this provider record.
  app.get(
    "/api/provider/:id/recurring-revenue",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const providerRow = await storage.getProviderByUserId(
          req.authenticatedUserId!,
        );
        if (!providerRow || providerRow.id !== req.params.id) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        const summary = await storage.getRecurringRevenueSummary(
          req.params.id,
        );
        res.json(summary);
      } catch (error) {
        req.log.error({ error }, "Get recurring revenue summary error");
        res
          .status(500)
          .json({ error: "Failed to get recurring revenue summary" });
      }
    },
  );

  // Provider variable-reward home feed (Task #410)
  // Returns 1–3 rotating highlight cards for the provider's home screen.
  // Card types rotate so no two consecutive visits show the same type.
  app.get(
    "/api/provider/:id/feed",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const providerRow = await storage.getProviderByUserId(
          req.authenticatedUserId!,
        );
        if (!providerRow || providerRow.id !== req.params.id) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        const cards = await getProviderFeed(req.params.id);
        res.json({ cards });
      } catch (error) {
        req.log.error({ error }, "Get provider feed error");
        res.status(500).json({ error: "Failed to get provider feed" });
      }
    },
  );

  // Dismiss a feed card so it doesn't appear for the next 24 hours
  app.post(
    "/api/provider/:id/feed/dismiss",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const providerRow = await storage.getProviderByUserId(
          req.authenticatedUserId!,
        );
        if (!providerRow || providerRow.id !== req.params.id) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        const { cardId } = req.body;
        if (!cardId || typeof cardId !== "string") {
          res.status(400).json({ error: "cardId is required" });
          return;
        }
        await dismissFeedCard(req.params.id, cardId);
        res.json({ ok: true });
      } catch (error) {
        req.log.error({ error }, "Dismiss feed card error");
        res.status(500).json({ error: "Failed to dismiss feed card" });
      }
    },
  );

  // Provider reviews
  app.get(
    "/api/provider/:id/reviews",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const reviewRows = await db
          .select({
            id: reviews.id,
            rating: reviews.rating,
            comment: reviews.comment,
            createdAt: reviews.createdAt,
            providerReply: reviews.providerReply,
            providerReplyAt: reviews.providerReplyAt,
            providerReplyUpdatedAt: reviews.providerReplyUpdatedAt,
            reviewerName: sql<string>`TRIM(CONCAT(COALESCE(${users.firstName}, ''), ' ', COALESCE(${users.lastName}, '')))`,
          })
          .from(reviews)
          .innerJoin(users, eq(reviews.userId, users.id))
          .where(eq(reviews.providerId, req.params.id))
          .orderBy(desc(reviews.createdAt));
        res.json({ reviews: reviewRows });
      } catch (error) {
        console.error("Get provider reviews error:", error);
        res.status(500).json({ error: "Failed to fetch reviews" });
      }
    },
  );

  // Provider reply to a review (create/update/delete) — only the provider
  // who owns the review may reply. On create, notify the homeowner.
  const REPLY_MAX_LENGTH = 1000;

  async function loadReviewForReply(reviewId: string, authUserId: string) {
    const [row] = await db
      .select({
        review: reviews,
        provider: providers,
      })
      .from(reviews)
      .innerJoin(providers, eq(reviews.providerId, providers.id))
      .where(eq(reviews.id, reviewId))
      .limit(1);
    if (!row) return { error: "not_found" as const };
    if (row.provider.userId !== authUserId) return { error: "forbidden" as const };
    return { review: row.review, provider: row.provider };
  }

  app.post(
    "/api/reviews/:id/reply",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const reply = String(req.body?.reply ?? "").trim();
        if (!reply) {
          return res.status(400).json({ error: "Reply text is required" });
        }
        if (reply.length > REPLY_MAX_LENGTH) {
          return res.status(400).json({ error: `Reply must be ${REPLY_MAX_LENGTH} characters or fewer` });
        }
        const loaded = await loadReviewForReply(req.params.id, authUserId);
        if ("error" in loaded) {
          return res.status(loaded.error === "not_found" ? 404 : 403).json({
            error: loaded.error === "not_found" ? "Review not found" : "Access denied",
          });
        }
        if (loaded.review.providerReply) {
          return res.status(409).json({ error: "Reply already exists. Use PATCH to edit." });
        }
        const now = new Date();
        const [updated] = await db
          .update(reviews)
          .set({ providerReply: reply, providerReplyAt: now, providerReplyUpdatedAt: now })
          .where(eq(reviews.id, req.params.id))
          .returning();

        // Notify the homeowner (push + email). Fire-and-forget.
        (async () => {
          try {
            const [homeowner] = await db
              .select()
              .from(users)
              .where(eq(users.id, loaded.review.userId))
              .limit(1);
            const [appt] = await db
              .select()
              .from(appointments)
              .where(eq(appointments.id, loaded.review.appointmentId))
              .limit(1);
            const providerName = loaded.provider.businessName || "Your provider";
            const serviceName = appt?.serviceName || undefined;
            const baseUrl =
              process.env.PUBLIC_BASE_URL ||
              (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://homebaseproapp.com");
            // Deep-link the homeowner back to their own review screen via /open-app
            // (which falls back to the App Store on desktop). The Review route
            // takes the appointment id as `jobId`.
            const reviewUrl = `${baseUrl}/open-app?path=review&jobId=${encodeURIComponent(loaded.review.appointmentId)}`;
            if (homeowner) {
              const clientName = `${homeowner.firstName || ""} ${homeowner.lastName || ""}`.trim() || homeowner.email;
              dispatch("review.reply", {
                clientEmail: homeowner.email,
                clientName,
                providerName,
                serviceName,
                description: reply,
                reviewUrl,
                relatedRecordType: "review",
                relatedRecordId: updated.id,
                recipientUserId: homeowner.id,
              }).catch((e) => console.error("review.reply dispatch error:", e));
              dispatchNotification(
                homeowner.id,
                `${providerName} replied to your review`,
                reply.length > 140 ? `${reply.slice(0, 140)}…` : reply,
                "review.reply",
                { reviewId: updated.id, providerId: loaded.provider.id, appointmentId: loaded.review.appointmentId, reviewUrl },
                "messages",
              ).catch((e) => console.error("review.reply push error:", e));
            }
          } catch (notifyErr) {
            console.error("review.reply notify failed:", notifyErr);
          }
        })();

        res.status(201).json({ review: updated });
      } catch (error) {
        console.error("Reply to review error:", error);
        res.status(500).json({ error: "Failed to post reply" });
      }
    },
  );

  app.patch(
    "/api/reviews/:id/reply",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const reply = String(req.body?.reply ?? "").trim();
        if (!reply) {
          return res.status(400).json({ error: "Reply text is required" });
        }
        if (reply.length > REPLY_MAX_LENGTH) {
          return res.status(400).json({ error: `Reply must be ${REPLY_MAX_LENGTH} characters or fewer` });
        }
        const loaded = await loadReviewForReply(req.params.id, authUserId);
        if ("error" in loaded) {
          return res.status(loaded.error === "not_found" ? 404 : 403).json({
            error: loaded.error === "not_found" ? "Review not found" : "Access denied",
          });
        }
        if (!loaded.review.providerReply) {
          return res.status(404).json({ error: "No existing reply to edit" });
        }
        const [updated] = await db
          .update(reviews)
          .set({ providerReply: reply, providerReplyUpdatedAt: new Date() })
          .where(eq(reviews.id, req.params.id))
          .returning();
        res.json({ review: updated });
      } catch (error) {
        console.error("Edit review reply error:", error);
        res.status(500).json({ error: "Failed to edit reply" });
      }
    },
  );

  app.delete(
    "/api/reviews/:id/reply",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const loaded = await loadReviewForReply(req.params.id, authUserId);
        if ("error" in loaded) {
          return res.status(loaded.error === "not_found" ? 404 : 403).json({
            error: loaded.error === "not_found" ? "Review not found" : "Access denied",
          });
        }
        await db
          .update(reviews)
          .set({ providerReply: null, providerReplyAt: null, providerReplyUpdatedAt: null })
          .where(eq(reviews.id, req.params.id));
        res.json({ success: true });
      } catch (error) {
        console.error("Delete review reply error:", error);
        res.status(500).json({ error: "Failed to delete reply" });
      }
    },
  );

  // Provider-initiated: ask a client to leave a review for a completed
  // appointment. Accepts { appointmentId } and/or { clientId }; if only a
  // clientId is provided, the most recent completed appointment for that
  // client is used.
  app.post(
    "/api/reviews/request",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const { appointmentId, clientId } = req.body ?? {};

        let appointment: typeof appointments.$inferSelect | undefined;

        if (appointmentId && typeof appointmentId === "string") {
          const [row] = await db
            .select()
            .from(appointments)
            .where(eq(appointments.id, appointmentId))
            .limit(1);
          appointment = row;
        }

        if (!appointment && clientId && typeof clientId === "string") {
          const client = await storage.getClient(clientId);
          if (!client) {
            return res.status(404).json({ error: "Client not found" });
          }
          if (!(await assertProviderOwnership(req, client.providerId, res))) return;
          if (!client.homeownerUserId) {
            return res.status(400).json({
              error: "This client has no linked homeowner account yet, so we can't send a review request.",
            });
          }
          const [row] = await db
            .select()
            .from(appointments)
            .where(
              and(
                eq(appointments.providerId, client.providerId),
                eq(appointments.userId, client.homeownerUserId),
                eq(appointments.status, "completed"),
              ),
            )
            .orderBy(desc(appointments.scheduledDate))
            .limit(1);
          appointment = row;
        }

        if (!appointment) {
          return res.status(400).json({
            error: "No completed appointment found for this client. Mark a job complete first.",
          });
        }

        // Ownership: caller must own the provider on the appointment.
        if (!(await assertProviderOwnership(req, appointment.providerId, res))) return;

        // Don't re-request if a review already exists.
        const [existingReview] = await db
          .select({ id: reviews.id })
          .from(reviews)
          .where(eq(reviews.appointmentId, appointment.id))
          .limit(1);
        if (existingReview) {
          return res.status(409).json({ error: "This client already submitted a review." });
        }

        const [homeowner] = appointment.userId
          ? await db.select().from(users).where(eq(users.id, appointment.userId)).limit(1)
          : [];
        const [provider] = await db
          .select()
          .from(providers)
          .where(eq(providers.id, appointment.providerId))
          .limit(1);

        if (!homeowner?.email) {
          return res.status(400).json({
            error: "This client doesn't have an email on file, so we can't send a review request.",
          });
        }

        const baseUrl =
          process.env.PUBLIC_BASE_URL ||
          (process.env.REPLIT_DEV_DOMAIN
            ? `https://${process.env.REPLIT_DEV_DOMAIN}`
            : "https://homebaseproapp.com");
        const reviewUrl = `${baseUrl}/open-app?path=review&jobId=${encodeURIComponent(appointment.id)}`;
        const providerName = provider?.businessName || "your provider";
        const serviceName = appointment.serviceName || "your service";
        const clientName =
          `${homeowner.firstName || ""} ${homeowner.lastName || ""}`.trim() ||
          homeowner.email;

        await dispatch("review.request", {
          clientEmail: homeowner.email,
          clientName,
          providerName,
          serviceName,
          reviewUrl,
          recipientUserId: homeowner.id,
          relatedRecordType: "appointment",
          relatedRecordId: appointment.id,
        });

        res.status(200).json({ success: true, appointmentId: appointment.id });
      } catch (error) {
        console.error("Request review error:", error);
        res.status(500).json({ error: "Failed to send review request" });
      }
    },
  );

  // Submit a review for an appointment
  app.post(
    "/api/appointments/:id/review",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const appointmentId = req.params.id;
        const { rating, comment } = req.body;

        if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
          return res
            .status(400)
            .json({ error: "Rating must be a number between 1 and 5" });
        }

        const [appointment] = await db
          .select()
          .from(appointments)
          .where(eq(appointments.id, appointmentId))
          .limit(1);

        if (!appointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }

        if (appointment.userId !== authUserId) {
          return res.status(403).json({ error: "Access denied" });
        }

        const reviewableStatuses = [
          "completed",
          "paid",
          "closed",
          "awaiting_payment",
        ];
        if (!reviewableStatuses.includes(appointment.status || "")) {
          return res.status(400).json({
            error: "Reviews can only be submitted for completed appointments",
          });
        }

        const [existingReview] = await db
          .select({ id: reviews.id })
          .from(reviews)
          .where(eq(reviews.appointmentId, appointmentId))
          .limit(1);

        if (existingReview) {
          return res
            .status(409)
            .json({ error: "Review already submitted for this appointment" });
        }

        const [review] = await db
          .insert(reviews)
          .values({
            appointmentId,
            userId: authUserId,
            providerId: appointment.providerId,
            rating,
            comment: comment?.trim() || null,
          })
          .returning();

        // Recalculate provider's average rating and review count
        const providerReviews = await db
          .select({ rating: reviews.rating })
          .from(reviews)
          .where(eq(reviews.providerId, appointment.providerId));

        const totalReviews = providerReviews.length;
        const avgRating =
          totalReviews > 0
            ? providerReviews.reduce((sum, r) => sum + r.rating, 0) /
              totalReviews
            : 0;

        await db
          .update(providers)
          .set({
            reviewCount: totalReviews,
            rating: avgRating.toFixed(1),
            averageRating: avgRating.toFixed(2),
          })
          .where(eq(providers.id, appointment.providerId));

        // Fire-and-forget milestone check (Task #354): first 5-star review
        // may unlock featured placement for the provider.
        if (appointment.providerId) {
          checkAndAwardMilestones(appointment.providerId).catch((e: unknown) =>
            console.error("milestone check (review) error:", e),
          );
        }

        // Loyalty: $3 credit for leaving a review (idempotent per appointment)
        grantReviewCredit(authUserId, appointmentId).catch((e: unknown) =>
          console.error("loyalty review credit error:", e),
        );

        res.status(201).json({ review });
      } catch (error) {
        console.error("Submit review error:", error);
        res.status(500).json({ error: "Failed to submit review" });
      }
    },
  );

  // ============ CREW ROUTES (Task #302) ============

  // Task #328: gate handler for endpoints that may be called by EITHER the
  // provider owner OR the assigned crew member. Returns the job + the caller
  // role; null means access denied (response already written).
  async function requireCrewOrProviderForJob(
    req: Request,
    jobId: string,
    res: Response,
  ): Promise<
    | { job: Job; role: "provider" | "crew"; crewMemberId?: string }
    | null
  > {
    const authUserId = req.authenticatedUserId!;
    const job = await storage.getJob(jobId);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return null;
    }
    const providerProfile = await storage.getProviderByUserId(authUserId);
    if (providerProfile && providerProfile.id === job.providerId) {
      return { job, role: "provider" };
    }
    if (job.assignedCrewMemberId) {
      const [crew] = await db
        .select({
          id: crewMembers.id,
          providerId: crewMembers.providerId,
          invitedUserId: crewMembers.invitedUserId,
          isActive: crewMembers.isActive,
        })
        .from(crewMembers)
        .where(eq(crewMembers.id, job.assignedCrewMemberId))
        .catch(() => [null]);
      if (
        crew &&
        crew.isActive &&
        crew.invitedUserId === authUserId &&
        crew.providerId === job.providerId
      ) {
        return { job, role: "crew", crewMemberId: crew.id };
      }
    }
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  // Helper: validate that a crew member exists and belongs to the given
  // provider. Returns the row or null.
  async function loadCrewForProvider(
    crewMemberId: string,
    providerId: string,
  ): Promise<{ id: string; providerId: string } | null> {
    const [row] = await db
      .select({
        id: crewMembers.id,
        providerId: crewMembers.providerId,
      })
      .from(crewMembers)
      .where(eq(crewMembers.id, crewMemberId))
      .catch(() => [null]);
    if (!row || row.providerId !== providerId) return null;
    return row;
  }

  app.get(
    "/api/provider/:providerId/crew",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res)))
          return;
        const crew = await storage.getCrewMembers(req.params.providerId);
        res.json({ crew });
      } catch (error) {
        console.error("Get crew error:", error);
        res.status(500).json({ error: "Failed to get crew" });
      }
    },
  );

  app.post(
    "/api/provider/:providerId/crew",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res)))
          return;
        const parsed = insertCrewMemberSchema.safeParse({
          ...req.body,
          providerId: req.params.providerId,
        });
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "Invalid input", details: parsed.error.issues });
        }
        const created = await storage.createCrewMember(parsed.data);
        res.status(201).json({ crewMember: created });
      } catch (error) {
        console.error("Create crew member error:", error);
        res.status(500).json({ error: "Failed to create crew member" });
      }
    },
  );

  app.put(
    "/api/crew/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const existing = await storage.getCrewMember(req.params.id);
        if (!existing)
          return res.status(404).json({ error: "Crew member not found" });
        if (!(await assertProviderOwnership(req, existing.providerId, res)))
          return;
        const { name, phone, email, color, isActive } = req.body;
        const update: Record<string, unknown> = {};
        if (typeof name === "string" && name.trim().length > 0)
          update.name = name.trim();
        if (phone !== undefined)
          update.phone = phone === null ? null : String(phone).trim();
        if (email !== undefined)
          update.email = email === null ? null : String(email).trim();
        if (typeof color === "string" && /^#[0-9A-Fa-f]{6}$/.test(color))
          update.color = color;
        if (typeof isActive === "boolean") update.isActive = isActive;
        const updated = await storage.updateCrewMember(req.params.id, update);
        res.json({ crewMember: updated });
      } catch (error) {
        console.error("Update crew member error:", error);
        res.status(500).json({ error: "Failed to update crew member" });
      }
    },
  );

  app.delete(
    "/api/crew/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const existing = await storage.getCrewMember(req.params.id);
        if (!existing)
          return res.status(404).json({ error: "Crew member not found" });
        if (!(await assertProviderOwnership(req, existing.providerId, res)))
          return;
        // Guardrail: refuse to delete while jobs are still assigned. The
        // provider must reassign or unassign first so we never silently lose
        // attribution on the schedule.
        const assigned = await storage.countJobsAssignedToCrewMember(
          req.params.id,
        );
        if (assigned > 0) {
          return res.status(409).json({
            error: "Crew member still has assigned jobs",
            assignedJobCount: assigned,
          });
        }
        const ok = await storage.deleteCrewMember(req.params.id);
        if (!ok) return res.status(404).json({ error: "Crew member not found" });
        res.json({ success: true });
      } catch (error) {
        console.error("Delete crew member error:", error);
        res.status(500).json({ error: "Failed to delete crew member" });
      }
    },
  );

  // ============ CREW PORTAL (Task #328) ============
  // Email-invite + per-crew-member job views so a crew member can sign in
  // with their own HomeBase account and work the schedule from a minimized
  // 3-tab portal. "Crew" is a capability flag (crewMembers.invitedUserId),
  // not a user role; one user may simultaneously be homeowner, provider,
  // and crew of N providers.

  app.post(
    "/api/crew/:id/invite",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const crew = await storage.getCrewMember(req.params.id);
        if (!crew)
          return res.status(404).json({ error: "Crew member not found" });
        if (!(await assertProviderOwnership(req, crew.providerId, res)))
          return;
        if (!crew.email) {
          return res
            .status(400)
            .json({ error: "Crew member has no email on file" });
        }
        const [provider] = await db
          .select({
            id: providers.id,
            businessName: providers.businessName,
          })
          .from(providers)
          .where(eq(providers.id, crew.providerId));
        if (!provider) {
          return res.status(404).json({ error: "Provider not found" });
        }

        const { JWT_SECRET } = await import("../auth");
        const jwt = await import("jsonwebtoken");
        const INVITE_SECRET = `${JWT_SECRET}:crew-invite`;
        const inviteToken = jwt.default.sign(
          {
            purpose: "crew_invite",
            crewMemberId: crew.id,
            providerId: crew.providerId,
            email: crew.email,
          },
          INVITE_SECRET,
          { expiresIn: "14d" },
        );

        const appOrigin =
          process.env.APP_ORIGIN ||
          (process.env.EXPO_PUBLIC_DOMAIN
            ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
            : "https://home-base-pro-app.replit.app");
        const acceptUrl = `${appOrigin}/crew-invite?token=${inviteToken}`;

        const { sendCrewInviteEmail } = await import("../emailService");
        const result = await sendCrewInviteEmail(
          crew.email,
          crew.name,
          provider.businessName,
          acceptUrl,
        );
        if (!result.success) {
          return res
            .status(502)
            .json({ error: result.error || "Failed to send invite email" });
        }
        res.json({ success: true });
      } catch (error) {
        console.error("Send crew invite error:", error);
        res.status(500).json({ error: "Failed to send invite" });
      }
    },
  );

  app.post(
    "/api/crew/invites/accept",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { token } = req.body;
        if (!token || typeof token !== "string") {
          return res.status(400).json({ error: "Invite token is required" });
        }
        const { JWT_SECRET } = await import("../auth");
        const jwt = await import("jsonwebtoken");
        const INVITE_SECRET = `${JWT_SECRET}:crew-invite`;
        let decoded: any;
        try {
          decoded = jwt.default.verify(token, INVITE_SECRET);
        } catch {
          return res
            .status(400)
            .json({ error: "Invalid or expired invite link." });
        }
        if (
          decoded.purpose !== "crew_invite" ||
          !decoded.crewMemberId ||
          !decoded.email
        ) {
          return res.status(400).json({ error: "Invalid invite token" });
        }
        const authUserId = req.authenticatedUserId!;
        const user = await storage.getUser(authUserId);
        if (!user) return res.status(401).json({ error: "Not signed in" });
        // Email match is required: the invite is bound to the email the
        // provider added to the roster row.
        if (user.email.toLowerCase() !== String(decoded.email).toLowerCase()) {
          return res.status(403).json({
            error:
              "This invite is for a different email address. Sign in with the invited email and try again.",
          });
        }
        const crew = await storage.getCrewMember(decoded.crewMemberId);
        if (!crew)
          return res.status(404).json({ error: "Crew row no longer exists" });
        if (crew.invitedUserId && crew.invitedUserId !== authUserId) {
          return res
            .status(409)
            .json({ error: "This invite is already linked to another account" });
        }
        if (!crew.invitedUserId) {
          await storage.updateCrewMember(crew.id, {
            invitedUserId: authUserId,
          });
        }
        const memberships = await getCrewMembershipsForUser(authUserId);
        res.json({ success: true, crewMemberships: memberships });
      } catch (error) {
        console.error("Accept crew invite error:", error);
        res.status(500).json({ error: "Failed to accept invite" });
      }
    },
  );

  // Task #328 follow-up: public crew-only signup. Accepts an invite token +
  // password (and optional name) and either creates a new account or signs in
  // an existing one whose email matches the invite. Returns an auth token
  // alongside the crew memberships so the app can boot directly into the
  // crew portal — no homeowner detour required.
  app.post(
    "/api/crew/invites/accept-public",
    async (req: Request, res: Response) => {
      try {
        const { token, password, name, phone } = req.body ?? {};
        if (!token || typeof token !== "string") {
          return res.status(400).json({ error: "Invite token is required" });
        }
        if (!password || typeof password !== "string" || password.length < 8) {
          return res
            .status(400)
            .json({ error: "Password must be at least 8 characters" });
        }
        const { JWT_SECRET } = await import("../auth");
        const jwt = await import("jsonwebtoken");
        const INVITE_SECRET = `${JWT_SECRET}:crew-invite`;
        let decoded: { purpose?: string; crewMemberId?: string; email?: string };
        try {
          decoded = jwt.default.verify(token, INVITE_SECRET) as typeof decoded;
        } catch {
          return res
            .status(400)
            .json({ error: "Invalid or expired invite link." });
        }
        if (
          decoded.purpose !== "crew_invite" ||
          !decoded.crewMemberId ||
          !decoded.email
        ) {
          return res.status(400).json({ error: "Invalid invite token" });
        }
        const inviteEmail = String(decoded.email).trim().toLowerCase();

        const crew = await storage.getCrewMember(decoded.crewMemberId);
        if (!crew)
          return res.status(404).json({ error: "Crew row no longer exists" });

        const existing = await storage.getUserByEmail(inviteEmail);
        if (existing) {
          // Don't silently overwrite an existing password — that would let a
          // stolen invite hijack the account. Send the user to the regular
          // login flow; the standard accept endpoint handles linking after.
          return res.status(409).json({
            error:
              "An account with this email already exists. Please sign in instead.",
            existingAccount: true,
          });
        }

        if (crew.invitedUserId) {
          return res.status(409).json({
            error: "This invite is already linked to another account",
          });
        }

        const nameFields = parseUserName(
          typeof name === "string" && name.trim() ? name : crew.name,
        );
        const hashedPassword = await bcryptHash(password, BCRYPT_SALT_ROUNDS);
        const user = await storage.createUser({
          ...nameFields,
          email: inviteEmail,
          password: hashedPassword,
          phone:
            typeof phone === "string" && phone.trim()
              ? phone.trim()
              : crew.phone || null,
          isProvider: false,
        });

        await storage.updateCrewMember(crew.id, { invitedUserId: user.id });

        const authToken = generateToken(
          user.id,
          "homeowner",
          user.tokenVersion ?? 0,
        );
        res.cookie("token", authToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        const memberships = await getCrewMembershipsForUser(user.id);
        res.status(201).json({
          user: formatUserResponse(user),
          token: authToken,
          crewMemberships: memberships,
        });
      } catch (error) {
        console.error("Public crew invite accept error:", error);
        res.status(500).json({ error: "Failed to accept invite" });
      }
    },
  );

  app.get(
    "/api/crew/me/memberships",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.authenticatedUserId!;
        const user = await storage.getUser(userId);
        if (user) await autoLinkCrewByEmail(userId, user.email);
        const memberships = await getCrewMembershipsForUser(userId);
        res.json({ crewMemberships: memberships });
      } catch (error) {
        console.error("Get crew memberships error:", error);
        res.status(500).json({ error: "Failed to load crew memberships" });
      }
    },
  );

  app.get(
    "/api/crew/me/jobs",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.authenticatedUserId!;
        const providerId =
          typeof req.query.providerId === "string"
            ? req.query.providerId
            : undefined;
        if (!providerId) {
          return res.status(400).json({ error: "providerId is required" });
        }
        // Confirm the caller is the linked + active crew member of this
        // provider before exposing any job rows.
        const [crew] = await db
          .select({ id: crewMembers.id })
          .from(crewMembers)
          .where(
            and(
              eq(crewMembers.providerId, providerId),
              eq(crewMembers.invitedUserId, userId),
              eq(crewMembers.isActive, true),
            ),
          );
        if (!crew) {
          return res
            .status(403)
            .json({ error: "You are not on this provider's crew" });
        }
        const rows = await db
          .select()
          .from(jobs)
          .where(
            and(
              eq(jobs.providerId, providerId),
              eq(jobs.assignedCrewMemberId, crew.id),
            ),
          )
          .orderBy(desc(jobs.scheduledDate));
        res.json({ jobs: rows });
      } catch (error) {
        console.error("Get crew jobs error:", error);
        res.status(500).json({ error: "Failed to load crew jobs" });
      }
    },
  );

  // ============ CLIENTS ROUTES ============

  app.get(
    "/api/provider/:providerId/clients",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res)))
          return;
        const clients = await storage.getClients(req.params.providerId);

        // Compute lifetime value per client the same way as GET /api/clients/:id:
        // completed-job final prices + actual amounts collected via payments
        // (excluding voided payments), batched across all clients in two
        // grouped queries instead of one round trip per client.
        let ltvByClientId = new Map<string, number>();
        if (clients.length > 0) {
          const clientIds = clients.map((c) => c.id);
          const [completedJobRows, collectedRows] = await Promise.all([
            db
              .select({
                clientId: jobs.clientId,
                total: sql<string>`COALESCE(SUM(${jobs.finalPrice}), 0)`,
              })
              .from(jobs)
              .where(
                and(
                  inArray(jobs.clientId, clientIds),
                  eq(jobs.status, "completed"),
                ),
              )
              .groupBy(jobs.clientId),
            db
              .select({
                clientId: invoices.clientId,
                total: sql<string>`COALESCE(SUM(${payments.amountCents}), 0)`,
              })
              .from(payments)
              .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
              .where(
                and(
                  inArray(invoices.clientId, clientIds),
                  sql`${payments.voidedAt} IS NULL`,
                ),
              )
              .groupBy(invoices.clientId),
          ]);

          const completedJobsByClient = new Map<string, number>();
          for (const row of completedJobRows) {
            if (!row.clientId) continue;
            completedJobsByClient.set(row.clientId, parseFloat(row.total) || 0);
          }
          const collectedByClient = new Map<string, number>();
          for (const row of collectedRows) {
            if (!row.clientId) continue;
            collectedByClient.set(row.clientId, (parseFloat(row.total) || 0) / 100);
          }

          ltvByClientId = new Map(
            clientIds.map((id) => [
              id,
              Math.round(
                ((completedJobsByClient.get(id) ?? 0) +
                  (collectedByClient.get(id) ?? 0)) *
                  100,
              ) / 100,
            ]),
          );
        }

        const clientsWithLtv = clients.map((c) => ({
          ...c,
          ltv: ltvByClientId.get(c.id) ?? 0,
        }));

        res.json({ clients: clientsWithLtv });
      } catch (error) {
        console.error("Get clients error:", error);
        res.status(500).json({ error: "Failed to get clients" });
      }
    },
  );

  app.get(
    "/api/clients/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const client = await storage.getClient(req.params.id);
        if (!client) {
          return res.status(404).json({ error: "Client not found" });
        }
        // Verify the authenticated user owns the provider that this client belongs to
        if (!(await assertProviderOwnership(req, client.providerId, res))) return;
        // Get client's jobs and invoices
        const jobs = await storage.getJobsByClient(req.params.id);
        const invoices = await storage.getInvoicesByClient(req.params.id);

        // Load linked home record (from homeId FK) and map to HomeDetailRecord shape
        let home = null;
        if (client.homeId) {
          const [homeRow] = await db
            .select()
            .from(homes)
            .where(eq(homes.id, client.homeId))
            .limit(1);
          if (homeRow) {
            home = {
              beds: homeRow.bedrooms ?? null,
              baths: homeRow.bathrooms ?? null,
              sqft: homeRow.squareFeet ?? null,
              yearBuilt: homeRow.yearBuilt ?? null,
              estimatedValue: homeRow.estimatedValue
                ? parseFloat(homeRow.estimatedValue)
                : null,
              propertyType: homeRow.propertyType ?? null,
              formattedAddress: homeRow.formattedAddress ?? null,
            };
          }
        }

        // Compute lifetime value server-side: sum of completed-job final
        // prices + actual amounts collected on this client's invoices
        // (paid in full *or* partial). Sourcing from the payments table
        // (Task #295) keeps partially-paid invoices counted at the real
        // collected amount instead of zero. Voided manual payments are
        // excluded.
        const completedJobsTotal = jobs.reduce((sum, j) => {
          if (j.status !== "completed") return sum;
          const v = j.finalPrice ? parseFloat(String(j.finalPrice)) : 0;
          return sum + (Number.isFinite(v) ? v : 0);
        }, 0);
        let collectedTotal = 0;
        if (invoices.length > 0) {
          const invoiceIds = invoices.map((i) => i.id);
          const collectedRows = await db
            .select({ amountCents: payments.amountCents })
            .from(payments)
            .where(
              and(
                inArray(payments.invoiceId, invoiceIds),
                sql`${payments.voidedAt} IS NULL`,
              ),
            );
          collectedTotal =
            collectedRows.reduce((s, r) => s + (r.amountCents ?? 0), 0) / 100;
        }
        const ltv = Math.round((completedJobsTotal + collectedTotal) * 100) / 100;

        // Task #488: surface autopay status for this client's active
        // recurring series so the detail screen can show a calm
        // "Auto-pay on" badge instead of leaving it invisible.
        const [autopaySeries] = await db
          .select({
            frequency: jobSeries.frequency,
            autopayEnabled: jobSeries.autopayEnabled,
          })
          .from(jobSeries)
          .where(
            and(
              eq(jobSeries.clientId, req.params.id),
              eq(jobSeries.status, "active"),
              eq(jobSeries.autopayEnabled, true),
            ),
          )
          .limit(1);
        const autopay = autopaySeries
          ? { enabled: true, frequency: autopaySeries.frequency }
          : { enabled: false, frequency: null };

        res.json({ client: { ...client, home, ltv, autopay }, jobs, invoices });
      } catch (error) {
        console.error("Get client error:", error);
        res.status(500).json({ error: "Failed to get client" });
      }
    },
  );

  app.post("/api/clients", requireAuth, async (req: Request, res: Response) => {
    try {
      // Extract housefaxData before schema validation (it's not a client field)
      const { housefaxData, ...clientBody } = req.body;

      const parsed = insertClientSchema.safeParse(clientBody);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid input", details: parsed.error.issues });
      }

      // Verify the authenticated user owns the provider they are creating a client for
      if (parsed.data.providerId) {
        if (!(await assertProviderOwnership(req, parsed.data.providerId, res))) return;
      }

      // Check for existing client with same email for this provider
      if (parsed.data.email && parsed.data.providerId) {
        const existingClients = await storage.getClients(
          parsed.data.providerId,
        );
        const duplicate = existingClients.find(
          (c) => c.email?.toLowerCase() === parsed.data.email?.toLowerCase(),
        );
        if (duplicate) {
          return res
            .status(409)
            .json({ error: "A client with this email already exists" });
        }
      }

      // If HouseFax enrichment data was provided, create a homes record and link it
      let homeId: string | undefined;
      if (
        housefaxData &&
        typeof housefaxData === "object" &&
        req.authenticatedUserId
      ) {
        try {
          const street =
            housefaxData.street || parsed.data.address || "Unknown";
          const city = housefaxData.city || parsed.data.city || "Unknown";
          const state = housefaxData.state || parsed.data.state || "Unknown";
          const zip = housefaxData.zipCode || parsed.data.zip || "00000";
          const clientName =
            `${parsed.data.firstName || ""} ${parsed.data.lastName || ""}`.trim();
          const newHome = await storage.createHome({
            userId: req.authenticatedUserId,
            label: `${clientName}'s Home`,
            street,
            city,
            state,
            zip,
            propertyType: housefaxData.propertyType || "single_family",
            bedrooms: housefaxData.bedrooms ?? undefined,
            bathrooms: housefaxData.bathrooms ?? undefined,
            squareFeet: housefaxData.squareFeet ?? undefined,
            yearBuilt: housefaxData.yearBuilt ?? undefined,
            lotSize: housefaxData.lotSize ?? undefined,
            estimatedValue: housefaxData.estimatedValue
              ? String(housefaxData.estimatedValue)
              : undefined,
            zillowId: housefaxData.zillowId ?? undefined,
            zillowUrl: housefaxData.zillowUrl ?? undefined,
            taxAssessedValue: housefaxData.taxAssessedValue
              ? String(housefaxData.taxAssessedValue)
              : undefined,
            lastSoldDate: housefaxData.lastSoldDate ?? undefined,
            lastSoldPrice: housefaxData.lastSoldPrice
              ? String(housefaxData.lastSoldPrice)
              : undefined,
            latitude: housefaxData.latitude
              ? String(housefaxData.latitude)
              : undefined,
            longitude: housefaxData.longitude
              ? String(housefaxData.longitude)
              : undefined,
            placeId: housefaxData.placeId ?? undefined,
            formattedAddress: housefaxData.formattedAddress ?? undefined,
            neighborhoodName: housefaxData.neighborhoodName ?? undefined,
            countyName: housefaxData.countyName ?? undefined,
            housefaxEnrichedAt: new Date(),
          });
          homeId = newHome.id;
        } catch (homeErr) {
          console.error(
            "Failed to create home record from HouseFax data:",
            homeErr,
          );
          // Non-fatal — continue without home linkage
        }
      }

      const client = await storage.createClient({ ...parsed.data, homeId });
      res.status(201).json({ client });
    } catch (error) {
      console.error("Create client error:", error);
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.put(
    "/api/clients/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const existing = await storage.getClient(req.params.id);
        if (!existing)
          return res.status(404).json({ error: "Client not found" });
        // Ownership: verify the requesting user owns the provider that this client belongs to
        if (!(await assertProviderOwnership(req, existing.providerId, res)))
          return;

        // Allowlist mutable fields to prevent mass-assignment
        const {
          firstName,
          lastName,
          email,
          phone,
          address,
          city,
          state,
          zip,
          notes,
          tags,
          gateCode,
          entryInstructions,
          pets,
          parkingNotes,
          trashDay,
        } = req.body;
        const update: Record<string, unknown> = {};
        if (firstName !== undefined) update.firstName = firstName;
        if (lastName !== undefined) update.lastName = lastName;
        if (email !== undefined) update.email = email;
        if (phone !== undefined) update.phone = phone;
        if (address !== undefined) update.address = address;
        if (city !== undefined) update.city = city;
        if (state !== undefined) update.state = state;
        if (zip !== undefined) update.zip = zip;
        if (notes !== undefined) update.notes = notes;
        if (tags !== undefined) update.tags = tags;
        if (gateCode !== undefined) update.gateCode = gateCode;
        if (entryInstructions !== undefined)
          update.entryInstructions = entryInstructions;
        if (pets !== undefined) update.pets = pets;
        if (parkingNotes !== undefined) update.parkingNotes = parkingNotes;
        if (trashDay !== undefined) update.trashDay = trashDay;

        const client = await storage.updateClient(req.params.id, update);
        if (!client) {
          return res.status(404).json({ error: "Client not found" });
        }
        res.json({ client });
      } catch (error) {
        console.error("Update client error:", error);
        res.status(500).json({ error: "Failed to update client" });
      }
    },
  );

  app.delete(
    "/api/clients/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const existing = await storage.getClient(req.params.id);
        if (!existing) {
          return res.status(404).json({ error: "Client not found" });
        }
        if (!(await assertProviderOwnership(req, existing.providerId, res)))
          return;
        const deleted = await storage.deleteClient(req.params.id);
        if (!deleted) {
          return res.status(404).json({ error: "Client not found" });
        }
        res.json({ success: true });
      } catch (error) {
        console.error("Delete client error:", error);
        res.status(500).json({ error: "Failed to delete client" });
      }
    },
  );

  // ============ JOBS ROUTES ============

  app.get(
    "/api/provider/:providerId/jobs",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res)))
          return;
        const rawJobs = await storage.getJobs(req.params.providerId);
        // Enrich with isRecurring/recurringFrequency from linked appointment
        const enrichedJobs = await Promise.all(
          rawJobs.map(async (job) => {
            if (!job.appointmentId)
              return { ...job, isRecurring: false, recurringFrequency: null };
            const [appt] = await db
              .select({
                isRecurring: appointments.isRecurring,
                recurringFrequency: appointments.recurringFrequency,
              })
              .from(appointments)
              .where(eq(appointments.id, job.appointmentId))
              .limit(1)
              .catch(() => [null]);
            return {
              ...job,
              isRecurring: appt?.isRecurring ?? false,
              recurringFrequency: appt?.recurringFrequency ?? null,
            };
          }),
        );
        res.json({ jobs: enrichedJobs });
      } catch (error) {
        console.error("Get jobs error:", error);
        res.status(500).json({ error: "Failed to get jobs" });
      }
    },
  );

  // POST /api/provider/:providerId/route/optimize  (Task #301)
  // Computes a one-day field-service route. The body specifies which day to
  // route, optionally an origin (provider's current GPS or a manually-entered
  // starting address), and optionally a manual `order` (jobIds) so the
  // provider's drag-reorder result can be re-priced without re-optimizing.
  // Returns: { origin, stops[], totalMinutes, totalMiles, driveTimeSource,
  //           missing[] (jobs whose address could not be geocoded) }.
  app.post(
    "/api/provider/:providerId/route/optimize",
    requireAuth,
    async (
      req: Request<
        ProviderIdParams,
        unknown,
        {
          date?: string;
          originLat?: number;
          originLng?: number;
          originAddress?: string;
          order?: string[];
        }
      >,
      res: Response,
    ) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res)))
          return;
        const { date, originLat, originLng, originAddress, order } = req.body;
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return res
            .status(400)
            .json({ error: "date (YYYY-MM-DD) is required" });
        }
        // Resolve the day window in the server's local time (matches how
        // jobs.scheduledDate is stored — date-only).
        const dayStart = new Date(`${date}T00:00:00`);
        const dayEnd = new Date(`${date}T23:59:59`);

        const allJobs = await storage.getJobs(req.params.providerId);
        const dayJobs = allJobs.filter((j) => {
          const d = new Date(j.scheduledDate);
          return (
            d >= dayStart &&
            d <= dayEnd &&
            j.status !== "cancelled" &&
            j.status !== "weather_held"
          );
        });

        if (dayJobs.length === 0) {
          return res.json({
            origin: null,
            stops: [],
            totalMinutes: 0,
            totalMiles: 0,
            driveTimeSource: "haversine",
            missing: [],
          });
        }

        // Pre-load client names so we can return them with each stop.
        const clientIds = Array.from(
          new Set(dayJobs.map((j) => j.clientId).filter(Boolean) as string[]),
        );
        const clientMap = new Map<
          string,
          { firstName: string | null; lastName: string | null }
        >();
        for (const cid of clientIds) {
          const c = await storage.getClient(cid);
          if (c) {
            clientMap.set(cid, {
              firstName: c.firstName ?? null,
              lastName: c.lastName ?? null,
            });
          }
        }

        const inputs: JobInput[] = dayJobs.map((j) => {
          const c = j.clientId ? clientMap.get(j.clientId) : null;
          const clientName = c
            ? [c.firstName, c.lastName].filter(Boolean).join(" ") || null
            : null;
          return {
            jobId: j.id,
            title: j.title || "Job",
            scheduledTime: j.scheduledTime ?? null,
            clientName,
            address: j.address ?? "",
          };
        });

        const { resolved, missing } = await geocodeJobs(inputs);
        if (resolved.length === 0) {
          return res.json({
            origin: null,
            stops: [],
            totalMinutes: 0,
            totalMiles: 0,
            driveTimeSource: "haversine",
            missing: missing.map((m) => ({
              jobId: m.jobId,
              title: m.title,
              address: m.address,
            })),
          });
        }

        // Determine origin: explicit lat/lng > geocoded originAddress > the
        // first resolved stop (so the route still has a valid starting point
        // even when the provider hasn't shared location).
        let origin: RoutePoint | null = null;
        // Validate coords: finite, in WGS-84 range, and not the (0,0) null
        // island sentinel that would otherwise produce nonsense routes.
        const validCoords =
          typeof originLat === "number" &&
          typeof originLng === "number" &&
          Number.isFinite(originLat) &&
          Number.isFinite(originLng) &&
          originLat >= -90 &&
          originLat <= 90 &&
          originLng >= -180 &&
          originLng <= 180 &&
          !(originLat === 0 && originLng === 0);
        if (validCoords) {
          origin = {
            lat: originLat,
            lng: originLng,
            address: originAddress?.trim() || "Current location",
          };
        } else if (originAddress && originAddress.trim().length >= 3) {
          const g = await geocodeAddress(originAddress.trim());
          if (g) {
            origin = {
              lat: g.latitude,
              lng: g.longitude,
              address: g.formattedAddress,
            };
          }
        }
        if (!origin) {
          origin = {
            lat: resolved[0].lat,
            lng: resolved[0].lng,
            address: resolved[0].address,
          };
        }

        const route = await buildRoute({
          origin,
          jobs: resolved,
          manualOrder: Array.isArray(order) ? order : undefined,
        });

        return res.json({
          origin: route.origin,
          stops: route.stops,
          totalMinutes: route.totalMinutes,
          totalMiles: route.totalMiles,
          driveTimeSource: route.driveTimeSource,
          missing: missing.map((m) => ({
            jobId: m.jobId,
            title: m.title,
            address: m.address,
          })),
        });
      } catch (err) {
        console.error("[route/optimize] error:", err);
        res.status(500).json({ error: "Failed to optimize route" });
      }
    },
  );

  // GET /api/provider/:providerId/route/order/:date — read persisted
  // manual stop order (returns { order: string[] | null }). 404 == no order.
  app.get(
    "/api/provider/:providerId/route/order/:date",
    requireAuth,
    async (
      req: Request<{ providerId: string; date: string }>,
      res: Response,
    ) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res)))
          return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.date)) {
          return res.status(400).json({ error: "date must be YYYY-MM-DD" });
        }
        const r = await pool.query<{ order_json: string[] }>(
          `SELECT order_json FROM provider_route_orders
            WHERE provider_id = $1 AND route_date = $2`,
          [req.params.providerId, req.params.date],
        );
        return res.json({ order: r.rows[0]?.order_json ?? null });
      } catch (err) {
        console.error("[route/order GET] error:", err);
        res.status(500).json({ error: "Failed to load route order" });
      }
    },
  );

  // PUT /api/provider/:providerId/route/order/:date — upsert order, or
  // pass an empty array / { clear: true } to delete (re-optimize next time).
  app.put(
    "/api/provider/:providerId/route/order/:date",
    requireAuth,
    async (
      req: Request<
        { providerId: string; date: string },
        unknown,
        { order?: string[]; clear?: boolean }
      >,
      res: Response,
    ) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res)))
          return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.date)) {
          return res.status(400).json({ error: "date must be YYYY-MM-DD" });
        }
        const { order, clear } = req.body;
        if (clear || !order || order.length === 0) {
          await pool.query(
            `DELETE FROM provider_route_orders
              WHERE provider_id = $1 AND route_date = $2`,
            [req.params.providerId, req.params.date],
          );
          return res.json({ ok: true, cleared: true });
        }
        if (
          !Array.isArray(order) ||
          order.some((s) => typeof s !== "string" || s.length === 0)
        ) {
          return res.status(400).json({ error: "order must be string[]" });
        }
        await pool.query(
          `INSERT INTO provider_route_orders (provider_id, route_date, order_json, updated_at)
           VALUES ($1, $2, $3::jsonb, NOW())
           ON CONFLICT (provider_id, route_date)
           DO UPDATE SET order_json = EXCLUDED.order_json, updated_at = NOW()`,
          [req.params.providerId, req.params.date, JSON.stringify(order)],
        );
        return res.json({ ok: true });
      } catch (err) {
        console.error("[route/order PUT] error:", err);
        res.status(500).json({ error: "Failed to save route order" });
      }
    },
  );

  app.get(
    "/api/jobs/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const job = await storage.getJob(req.params.id);
        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }
        // Allow access to the provider who owns the job, the homeowner linked
        // via appointment, or an assigned active crew member (Task #328).
        const providerRecord = await storage.getProviderByUserId(req.authenticatedUserId!);
        const isProvider = providerRecord != null && job.providerId === providerRecord.id;
        let isHomeowner = false;
        if (!isProvider && job.appointmentId) {
          const linkedAppointment = await storage.getAppointment(job.appointmentId);
          isHomeowner = linkedAppointment?.userId === req.authenticatedUserId;
        }
        let isCrew = false;
        if (!isProvider && !isHomeowner && job.assignedCrewMemberId) {
          const [crew] = await db
            .select({
              invitedUserId: crewMembers.invitedUserId,
              isActive: crewMembers.isActive,
              providerId: crewMembers.providerId,
            })
            .from(crewMembers)
            .where(eq(crewMembers.id, job.assignedCrewMemberId))
            .catch(() => [null]);
          isCrew = !!(
            crew &&
            crew.isActive &&
            crew.invitedUserId === req.authenticatedUserId &&
            crew.providerId === job.providerId
          );
        }
        if (!isProvider && !isHomeowner && !isCrew) {
          return res.status(403).json({ error: "Access denied" });
        }
        let isRecurring = false;
        let recurringFrequency: string | null = null;
        if (job.appointmentId) {
          const [appt] = await db
            .select({
              isRecurring: appointments.isRecurring,
              recurringFrequency: appointments.recurringFrequency,
            })
            .from(appointments)
            .where(eq(appointments.id, job.appointmentId))
            .limit(1)
            .catch(() => [null]);
          if (appt) {
            isRecurring = appt.isRecurring ?? false;
            recurringFrequency = appt.recurringFrequency ?? null;
          }
        }
        // Surface structured client property details (gate code, entry
        // instructions, pets, parking, trash day) so crew can see on-site
        // reference info without needing access to the full client record.
        let clientPropertyDetails: {
          gateCode: string | null;
          entryInstructions: string | null;
          pets: string | null;
          parkingNotes: string | null;
          trashDay: string | null;
        } | null = null;
        if (job.clientId) {
          const clientRecord = await storage.getClient(job.clientId);
          if (clientRecord) {
            clientPropertyDetails = {
              gateCode: clientRecord.gateCode ?? null,
              entryInstructions: clientRecord.entryInstructions ?? null,
              pets: clientRecord.pets ?? null,
              parkingNotes: clientRecord.parkingNotes ?? null,
              trashDay: clientRecord.trashDay ?? null,
            };
          }
        }

        res.json({
          job: { ...job, isRecurring, recurringFrequency },
          clientPropertyDetails,
        });
      } catch (error) {
        console.error("Get job error:", error);
        res.status(500).json({ error: "Failed to get job" });
      }
    },
  );

  // Get job linked to an appointment (by appointmentId FK)
  app.get(
    "/api/appointments/:id/job",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const appointment = await storage.getAppointment(req.params.id);
        if (!appointment) return res.json({ job: null });
        const providerRecord = await storage.getProviderByUserId(authUserId);
        const isOwner = appointment.userId === authUserId;
        const isProvider =
          providerRecord && appointment.providerId === providerRecord.id;
        if (!isOwner && !isProvider)
          return res.status(403).json({ error: "Access denied" });
        const [job] = await db
          .select()
          .from(jobs)
          .where(eq(jobs.appointmentId, req.params.id))
          .limit(1);
        if (!job) return res.json({ job: null });
        res.json({ job });
      } catch (error) {
        console.error("Get appointment job error:", error);
        res.status(500).json({ error: "Failed to get job" });
      }
    },
  );

  // Generate or return cached AI checklist for a job
  app.post(
    "/api/jobs/:id/generate-checklist",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const job = await storage.getJob(req.params.id);
        if (!job) return res.status(404).json({ error: "Job not found" });

        // Authorization: requester must own the provider account that owns this job
        const providerRecord = await storage.getProviderByUserId(authUserId);
        if (!providerRecord || job.providerId !== providerRecord.id) {
          return res.status(403).json({ error: "Access denied" });
        }

        // The job's persisted checklist is authoritative — even an empty
        // array is a valid intentional state. Only legacy rows where the
        // column is null get a one-time backfill from the parent
        // service's template. No AI fallback.
        const existingChecklist = job.checklist as
          | { id: string; label: string; completed: boolean }[]
          | null;
        if (Array.isArray(existingChecklist)) {
          return res.json({ checklist: existingChecklist });
        }

        let checklist: { id: string; label: string; completed: boolean }[] = [];
        if (job.customServiceId) {
          const [svcRow] = await db
            .select({
              checklistTemplateJson:
                providerCustomServices.checklistTemplateJson,
            })
            .from(providerCustomServices)
            .where(eq(providerCustomServices.id, job.customServiceId));
          if (Array.isArray(svcRow?.checklistTemplateJson)) {
            checklist = svcRow!
              .checklistTemplateJson!.filter(
                (it) =>
                  it && typeof it.label === "string" && it.label.trim().length > 0,
              )
              .map((it, i) => ({
                id: String(it.id ?? `c_${Date.now()}_${i}`),
                label: String(it.label).slice(0, 200),
                completed: false,
              }));
          }
        }

        await db
          .update(jobs)
          .set({ checklist })
          .where(eq(jobs.id, req.params.id));

        res.json({ checklist });
      } catch (error) {
        console.error("Generate checklist error:", error);
        res.status(500).json({ error: "Failed to generate checklist" });
      }
    },
  );

  // Persist checklist toggle state
  app.patch(
    "/api/jobs/:id/checklist-state",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const job = await storage.getJob(req.params.id);
        if (!job) return res.status(404).json({ error: "Job not found" });

        // Authorization: requester must own the provider account that owns this job
        const providerRecord = await storage.getProviderByUserId(authUserId);
        if (!providerRecord || job.providerId !== providerRecord.id) {
          return res.status(403).json({ error: "Access denied" });
        }

        const { checklist } = req.body as {
          checklist: { id: string; label: string; completed: boolean }[];
        };
        if (!Array.isArray(checklist))
          return res.status(400).json({ error: "checklist must be an array" });

        await db
          .update(jobs)
          .set({ checklist })
          .where(eq(jobs.id, req.params.id));
        res.json({ ok: true });
      } catch (error) {
        console.error("Checklist state error:", error);
        res.status(500).json({ error: "Failed to save checklist state" });
      }
    },
  );

  // Get invoice linked to a job
  app.get(
    "/api/jobs/:id/invoice",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const providerRecord = await storage.getProviderByUserId(authUserId);
        let [invoice] = await db
          .select()
          .from(invoices)
          .where(eq(invoices.jobId, req.params.id))
          .orderBy(desc(invoices.createdAt))
          .limit(1);

        // Task #230: when the job has no invoice tightly linked, walk
        // job → appointment → (provider, homeowner) and surface the most
        // recent invoice from that provider for this homeowner. Mirrors the
        // broader lookup used by `/api/appointment/:id` so homeowners always
        // see the same invoice regardless of which screen they land on.
        if (!invoice) {
          const [linkedJob] = await db
            .select({
              appointmentId: jobs.appointmentId,
              providerId: jobs.providerId,
            })
            .from(jobs)
            .where(eq(jobs.id, req.params.id))
            .limit(1);
          if (linkedJob?.appointmentId) {
            const [appt] = await db
              .select({
                userId: appointments.userId,
                providerId: appointments.providerId,
                scheduledDate: appointments.scheduledDate,
              })
              .from(appointments)
              .where(eq(appointments.id, linkedJob.appointmentId))
              .limit(1);
            if (appt?.userId) {
              const candidates = await db
                .select()
                .from(invoices)
                .where(
                  and(
                    eq(invoices.providerId, appt.providerId),
                    eq(invoices.homeownerUserId, appt.userId),
                  ),
                )
                .orderBy(desc(invoices.createdAt))
                .limit(10);
              const VISIBLE_STATUSES = new Set([
                "sent",
                "overdue",
                "paid",
                "closed",
              ]);
              const visible = candidates.filter((inv) =>
                VISIBLE_STATUSES.has(inv.status),
              );
              const apptTime = appt.scheduledDate
                ? new Date(appt.scheduledDate).getTime()
                : null;
              const sixtyDays = 60 * 24 * 60 * 60 * 1000;
              const payable = visible.filter(
                (inv) =>
                  inv.status === "sent" || inv.status === "overdue",
              );
              const nearPayable = apptTime
                ? payable.find((inv) => {
                    const dt = inv.dueDate
                      ? new Date(inv.dueDate).getTime()
                      : 0;
                    return dt && Math.abs(dt - apptTime) <= sixtyDays;
                  })
                : null;
              invoice =
                nearPayable ?? payable[0] ?? visible[0] ?? undefined;
            }
            // Legacy fallback: invoices created before homeowner_user_id
            // backfill — match via clients.homeowner_user_id.
            if (!invoice && appt?.userId) {
              const matchingClients = await db
                .select({ id: clients.id })
                .from(clients)
                .where(
                  and(
                    eq(clients.providerId, appt.providerId),
                    eq(clients.homeownerUserId, appt.userId),
                  ),
                );
              const clientIds = matchingClients.map((c) => c.id);
              if (clientIds.length > 0) {
                const legacyCandidates = await db
                  .select()
                  .from(invoices)
                  .where(
                    and(
                      eq(invoices.providerId, appt.providerId),
                      inArray(invoices.clientId, clientIds),
                      isNull(invoices.homeownerUserId),
                    ),
                  )
                  .orderBy(desc(invoices.createdAt))
                  .limit(10);
                const VISIBLE_STATUSES = new Set([
                  "sent",
                  "overdue",
                  "paid",
                  "closed",
                ]);
                const visible = legacyCandidates.filter((inv) =>
                  VISIBLE_STATUSES.has(inv.status),
                );
                const payable = visible.filter(
                  (inv) =>
                    inv.status === "sent" || inv.status === "overdue",
                );
                invoice = payable[0] ?? visible[0] ?? undefined;
              }
            }
          }
        }
        if (!invoice) return res.json({ invoice: null });
        let isHomeowner = invoice.homeownerUserId === authUserId;
        // Fallback for legacy invoices (Task #217): some invoices were created
        // before the homeowner link was wired up and have a null
        // homeowner_user_id. Treat the homeowner of the linked appointment as
        // the rightful viewer, and opportunistically backfill so future calls
        // hit the fast path.
        if (!isHomeowner && !invoice.homeownerUserId) {
          const [linkedJob] = await db
            .select({ appointmentId: jobs.appointmentId })
            .from(jobs)
            .where(eq(jobs.id, req.params.id))
            .limit(1);
          if (linkedJob?.appointmentId) {
            const [appt] = await db
              .select({ userId: appointments.userId })
              .from(appointments)
              .where(eq(appointments.id, linkedJob.appointmentId))
              .limit(1);
            if (appt?.userId && appt.userId === authUserId) {
              isHomeowner = true;
              await db
                .update(invoices)
                .set({ homeownerUserId: appt.userId, updatedAt: new Date() })
                .where(eq(invoices.id, invoice.id))
                .catch((e) =>
                  console.error("invoice.homeowner_user_id backfill skipped:", e),
                );
            }
          }
        }
        const isProvider =
          providerRecord && invoice.providerId === providerRecord.id;
        if (!isHomeowner && !isProvider)
          return res.status(403).json({ error: "Access denied" });

        // Task #230: ensure the homeowner gets the same Stripe-hosted URL
        // the provider sees. Generate-on-demand and persist if missing.
        if (
          !invoice.hostedInvoiceUrl &&
          invoice.status !== "draft" &&
          invoice.status !== "cancelled"
        ) {
          try {
            const result = await sendStripeInvoiceEmail(invoice.id);
            if (result?.hostedInvoiceUrl) {
              invoice = {
                ...invoice,
                hostedInvoiceUrl: result.hostedInvoiceUrl,
              } as typeof invoice;
            }
          } catch (err) {
            console.warn(
              "[jobs/invoice] hosted invoice URL generation skipped:",
              (err as Error)?.message,
            );
          }
        }
        res.json({ invoice });
      } catch (error) {
        console.error("Get job invoice error:", error);
        res.status(500).json({ error: "Failed to get invoice" });
      }
    },
  );

  // Task #486: how long a live "On My Way" tracking session stays active
  // if the job status never advances (safety timeout).
  const TRACKING_SESSION_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3 hours

  function getPublicBaseUrl(): string {
    return process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://homebaseproapp.com";
  }

  // Task #486: manage the lifecycle of live-location tracking sessions
  // alongside job status changes. Called from every status-changing code
  // path via dispatchJobStatusEmail so it can't be missed by a new route.
  // Returns the shareable tracking URL when a new session is started.
  async function syncJobTrackingSession(
    job: Job,
    newStatus: string,
  ): Promise<string | undefined> {
    try {
      if (newStatus === "on_my_way") {
        const existingSession = await storage.getActiveJobTrackingSession(
          job.id,
        );
        if (existingSession) {
          return `${getPublicBaseUrl()}/api/track/${existingSession.token}/page`;
        }
        const token = (require("crypto").randomBytes(16) as Buffer).toString(
          "hex",
        );
        const session = await storage.createJobTrackingSession({
          jobId: job.id,
          providerId: job.providerId,
          token,
          status: "active",
          expiresAt: new Date(Date.now() + TRACKING_SESSION_TIMEOUT_MS),
        });
        return `${getPublicBaseUrl()}/api/track/${session.token}/page`;
      }
      // Any other status transition ends live sharing for this job.
      await storage.endActiveJobTrackingSessions(job.id);
      return undefined;
    } catch (e) {
      console.error("[tracking] syncJobTrackingSession error:", e);
      return undefined;
    }
  }

  async function dispatchJobStatusEmail(
    job: Job,
    newStatus: string,
    extra?: { wasRescheduled?: boolean },
  ): Promise<void> {
    const trackingUrl = await syncJobTrackingSession(job, newStatus);
    if (!job.clientId || !job.providerId) return;
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, job.clientId))
      .catch(() => [null]);
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, job.providerId))
      .catch(() => [null]);
    if (!client || !provider) return;
    const clientEmail = client.email ?? undefined;
    const clientName =
      `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
      clientEmail;
    await dispatch("job.status_changed", {
      clientEmail,
      clientName,
      clientPhone: client.phone ?? undefined,
      providerName: provider.businessName,
      serviceName: job.title ?? "your job",
      newStatus,
      scheduledDate: job.scheduledDate ? String(job.scheduledDate) : undefined,
      scheduledTime: job.scheduledTime ?? undefined,
      notes: job.notes ?? undefined,
      wasRescheduled: extra?.wasRescheduled,
      trackingUrl,
      relatedRecordType: "job",
      relatedRecordId: job.id,
      recipientUserId: client.homeownerUserId ?? undefined,
    });

    // Task #302: also notify the assigned crew member when their roster row
    // is linked to a HomeBase user account. Best-effort; never blocks the
    // homeowner-facing dispatch above.
    if (job.assignedCrewMemberId) {
      try {
        const [crew] = await db
          .select({
            id: crewMembers.id,
            name: crewMembers.name,
            invitedUserId: crewMembers.invitedUserId,
          })
          .from(crewMembers)
          .where(eq(crewMembers.id, job.assignedCrewMemberId));
        if (crew?.invitedUserId) {
          const friendly = newStatus.replace(/_/g, " ");
          await dispatchNotification(
            crew.invitedUserId,
            `Job update: ${job.title ?? "Assigned job"}`,
            `Status changed to ${friendly}.`,
            "job.crew_status_changed",
            {
              screen: "ProviderJobDetail",
              params: { jobId: job.id },
              jobId: job.id,
              providerId: job.providerId,
              newStatus,
            },
            "bookings",
          );
        }
      } catch (e) {
        console.error("crew notification dispatch error:", e);
      }
    }
  }

  app.post("/api/jobs", requireAuth, async (req: Request, res: Response) => {
    try {
      // Convert scheduledDate string to Date
      const jobData = {
        ...req.body,
        scheduledDate: req.body.scheduledDate
          ? new Date(req.body.scheduledDate)
          : undefined,
      };
      const parsed = insertJobSchema.safeParse(jobData);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid input", details: parsed.error.issues });
      }

      // Assert caller owns the provider account they are creating a job for
      const authUserId = req.authenticatedUserId!;
      const [callerProvider] = await db
        .select({ id: providers.id, userId: providers.userId })
        .from(providers)
        .where(eq(providers.id, parsed.data.providerId))
        .catch(() => [null]);
      if (!callerProvider || callerProvider.userId !== authUserId) {
        return res
          .status(403)
          .json({ error: "Forbidden: you do not own this provider account" });
      }

      // Task #302: validate any assigned crew member belongs to this provider
      // so a hostile client can't attach a job to another provider's roster.
      if (parsed.data.assignedCrewMemberId) {
        const ok = await loadCrewForProvider(
          parsed.data.assignedCrewMemberId,
          parsed.data.providerId,
        );
        if (!ok) {
          return res
            .status(400)
            .json({ error: "Invalid crew member for this provider" });
        }
      }

      // Subscription gate — block job creation if grace period has expired
      if (!(await checkSubscriptionGate(parsed.data.providerId, res))) return;

      // Fetch custom service snapshot before transaction for description/price enrichment.
      // Ownership check: verify the service belongs to the same provider as the job being created.
      let svcSnapshot: {
        description: string | null;
        pricingType: string;
        basePrice: string | null;
        priceFrom: string | null;
        intakeQuestionsJson: string | null;
        checklistTemplateJson: { id: string; label: string }[] | null;
        isRecurring: boolean | null;
        recurringFrequency: string | null;
        recurringPrice: string | null;
      } | null = null;
      let verifiedCustomServiceId: string | null = null;
      if (parsed.data.customServiceId) {
        const [svcRow] = await db
          .select({
            description: providerCustomServices.description,
            pricingType: providerCustomServices.pricingType,
            basePrice: providerCustomServices.basePrice,
            priceFrom: providerCustomServices.priceFrom,
            intakeQuestionsJson: providerCustomServices.intakeQuestionsJson,
            checklistTemplateJson: providerCustomServices.checklistTemplateJson,
            isRecurring: providerCustomServices.isRecurring,
            recurringFrequency: providerCustomServices.recurringFrequency,
            recurringPrice: providerCustomServices.recurringPrice,
          })
          .from(providerCustomServices)
          .where(
            and(
              eq(providerCustomServices.id, parsed.data.customServiceId),
              eq(providerCustomServices.providerId, parsed.data.providerId),
            ),
          )
          .catch(() => [null]);
        if (svcRow) {
          svcSnapshot = svcRow;
          verifiedCustomServiceId = parsed.data.customServiceId;
        }
        // If svcRow is null, the service doesn't belong to this provider — silently ignore it
      }

      // Recompose the canonical job description server-side via the shared
      // formatter so it never depends on client behavior or version. Provider-
      // entered description, intake answers, and selected add-ons are merged
      // into the same shape used by the homeowner flow and public booking page.
      const rawJobAddOns = Array.isArray(req.body.selectedAddOns)
        ? (req.body.selectedAddOns as unknown[])
            .filter(
              (a): a is Record<string, unknown> =>
                typeof a === "object" && a !== null,
            )
            .map((a) => ({
              name: String(a.name ?? "").slice(0, 200),
              price:
                typeof a.price === "number"
                  ? a.price
                  : parseFloat(String(a.price ?? "0")) || 0,
            }))
            .filter((a) => a.name.length > 0)
        : [];
      const composedJobDescription = formatJobSummary({
        serviceName: parsed.data.title ?? null,
        problemDescription: parsed.data.description ?? null,
        intakeAnswers: parseIntakeAnswers(
          req.body.intakeAnswers ?? req.body.answersJson,
        ),
        intakeQuestions: parseIntakeQuestions(svcSnapshot?.intakeQuestionsJson),
        addOns: rawJobAddOns,
      });
      const finalJobDescription =
        composedJobDescription || parsed.data.description || null;

      // Compute effective estimatedPrice: provider manual entry takes precedence, then service price
      const effectivePrice =
        parsed.data.estimatedPrice ||
        (svcSnapshot?.pricingType === "fixed" ||
        svcSnapshot?.pricingType === "service_call"
          ? (svcSnapshot?.basePrice ?? undefined)
          : undefined) ||
        (svcSnapshot?.pricingType === "variable"
          ? (svcSnapshot?.priceFrom ?? undefined)
          : undefined);

      // Resolve homeowner identity from the job's client BEFORE the transaction.
      // If the client record is linked to a home that has a registered homeowner
      // user, propagate that user_id + home_id onto the appointment row so the
      // homeowner's `getAppointments(userId)` query surfaces the new job and
      // the downstream "Pay Invoice" CTA renders for them. (Task #217)
      let resolvedHomeownerUserId: string | null = null;
      let resolvedHomeId: string | null = null;
      if (parsed.data.clientId) {
        // SECURITY: Scope the lookup to (clientId, providerId) so a provider
        // cannot reference another provider's client and accidentally (or
        // maliciously) attach a job/appointment/invoice to an unrelated
        // homeowner account. callerProvider.id was already proven to belong
        // to authUserId above, so this is the right tenant boundary.
        const [jobClientRow] = await db
          .select({
            id: clients.id,
            homeId: clients.homeId,
            homeownerUserId: clients.homeownerUserId,
          })
          .from(clients)
          .where(
            and(
              eq(clients.id, parsed.data.clientId),
              eq(clients.providerId, callerProvider.id),
            ),
          );
        if (!jobClientRow) {
          return res
            .status(403)
            .json({ error: "Forbidden: client does not belong to this provider" });
        }
        if (jobClientRow.homeId) {
          resolvedHomeId = jobClientRow.homeId;
          if (jobClientRow.homeownerUserId) {
            resolvedHomeownerUserId = jobClientRow.homeownerUserId;
          } else {
            // Cached link not yet populated — derive from homes.userId. The
            // read intentionally does NOT swallow errors: a transient failure
            // here used to silently fall back to a null homeowner link and
            // reintroduce the original sync miss (Task #217). The cache write
            // below is still best-effort because it's just an optimization.
            const [homeRow] = await db
              .select({ userId: homes.userId })
              .from(homes)
              .where(eq(homes.id, jobClientRow.homeId));
            if (homeRow?.userId) {
              resolvedHomeownerUserId = homeRow.userId;
              await db
                .update(clients)
                .set({ homeownerUserId: homeRow.userId, updatedAt: new Date() })
                .where(eq(clients.id, jobClientRow.id))
                .catch((e) =>
                  console.error("client.homeowner_user_id cache write skipped:", e),
                );
            }
          }
        }
      }

      // Atomic transaction: create job and appointment together so booking data model is
      // always consistent. If appointment creation fails the job is rolled back too.
      // Materialize the new job's checklist into an array (never null) so
      // the column unambiguously records the provider's intent at
      // creation time. Client-supplied items win; otherwise copy the
      // snapshotted service template; otherwise []. The "apply to
      // existing future jobs" opt-in is the only mechanism that rewrites
      // a job's checklist after creation.
      let initialChecklist: { id: string; label: string; completed: boolean }[] = [];
      const incomingChecklist = (parsed.data as { checklist?: unknown })
        .checklist;
      if (Array.isArray(incomingChecklist)) {
        initialChecklist = (incomingChecklist as unknown[])
          .filter(
            (it): it is { id?: unknown; label?: unknown; completed?: unknown } =>
              typeof it === "object" && it !== null,
          )
          .map((it, i) => ({
            id: String(it.id ?? `c_${Date.now()}_${i}`),
            label: String(it.label ?? "").slice(0, 200),
            completed: Boolean(it.completed),
          }))
          .filter((it) => it.label.length > 0);
      } else if (Array.isArray(svcSnapshot?.checklistTemplateJson)) {
        initialChecklist = svcSnapshot!.checklistTemplateJson!
          .filter((it) => it && typeof it.label === "string" && it.label.trim().length > 0)
          .map((it, i) => ({
            id: String(it.id ?? `c_${Date.now()}_${i}`),
            label: String(it.label).slice(0, 200),
            completed: false,
          }));
      }

      const { job: newJob, appointment } = await db.transaction(async (tx) => {
        const jobValues = {
          ...parsed.data,
          customServiceId: verifiedCustomServiceId,
          estimatedPrice: effectivePrice ?? parsed.data.estimatedPrice,
          description: finalJobDescription,
          checklist: initialChecklist,
          // Belt-and-suspenders: insertJobSchema already strips seriesId,
          // but null it out here too so any future schema regression can't
          // let a client attach the new job to another provider's series.
          seriesId: null,
        };
        const [job] = await tx.insert(jobs).values(jobValues).returning();

        // Create a linked appointment row for every provider-added job so all booking
        // paths produce the same normalized structure (appointments → jobs → clients → invoices).
        // userId/homeId are populated from the resolved homeowner above so the
        // appointment is visible to the homeowner's feed (Task #217). When the
        // client has no linked home (no registered homeowner), both stay null.
        // description: prefer provider-entered "client's issue", fall back to service description
        const apptDescription =
          job.description || svcSnapshot?.description || undefined;
        const [apptRow] = await tx
          .insert(appointments)
          .values({
            userId: resolvedHomeownerUserId ?? undefined,
            homeId: resolvedHomeId ?? undefined,
            providerId: job.providerId,
            serviceName: job.title,
            description: apptDescription,
            scheduledDate: job.scheduledDate!,
            scheduledTime: job.scheduledTime || undefined,
            estimatedPrice: job.estimatedPrice || undefined,
            status: "confirmed" as const,
            notes: job.notes || undefined,
          })
          .returning();

        // Back-link appointment ID on the job row
        const [linkedJob] = await tx
          .update(jobs)
          .set({ appointmentId: apptRow.id })
          .where(eq(jobs.id, job.id))
          .returning();

        return { job: linkedJob, appointment: apptRow };
      });

      // If the job came from a recurring custom service, anchor a job_series
      // and materialize the next ~90 days of occurrences. Awaited (not
      // fire-and-forget) so the create-job response only succeeds once the
      // series row exists — the recurring badge / series detail screen are
      // immediately consistent with the response. Materialization itself is
      // bounded (≤90 inserts) so this stays well under request budgets.
      let responseJob = newJob;
      if (
        svcSnapshot?.isRecurring &&
        svcSnapshot.recurringFrequency &&
        isSupportedFrequency(svcSnapshot.recurringFrequency) &&
        !newJob.seriesId
      ) {
        // Series creation is part of the create-job contract for recurring
        // services. We do NOT swallow failures: if anchoring/materialization
        // fails the request returns 500 so the client can retry, rather than
        // silently producing a one-off job and orphaned promise of a series.
        await createSeriesForJob({
          job: newJob,
          frequency: svcSnapshot.recurringFrequency,
          recurringPrice: svcSnapshot.recurringPrice,
        });
        // Refetch so the response carries the newly-assigned series_id —
        // the schedule UI uses it to deep-link to the Series detail screen
        // immediately after creation.
        const [refreshed] = await db
          .select()
          .from(jobs)
          .where(eq(jobs.id, newJob.id));
        if (refreshed) responseJob = refreshed;
      }

      // Fire client confirmation email (fire-and-forget) if client has an email on record
      if (newJob.clientId) {
        (async () => {
          try {
            const [jobClient] = await db
              .select()
              .from(clients)
              .where(eq(clients.id, newJob.clientId!))
              .catch(() => [null]);
            const [jobProvider] = await db
              .select()
              .from(providers)
              .where(eq(providers.id, newJob.providerId))
              .catch(() => [null]);
            if (jobClient?.email && jobProvider) {
              const clientName =
                `${jobClient.firstName || ""} ${jobClient.lastName || ""}`.trim() ||
                jobClient.email;
              const scheduledDateStr = newJob.scheduledDate
                ? new Date(newJob.scheduledDate).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "To be confirmed";
              const scheduledTimeStr = newJob.scheduledTime
                ? (() => {
                    const [h, m] = newJob.scheduledTime.split(":");
                    const hour = parseInt(h);
                    const ampm = hour >= 12 ? "PM" : "AM";
                    const displayHour = hour % 12 || 12;
                    return `${displayHour}:${m} ${ampm}`;
                  })()
                : undefined;

              // Use already-fetched service snapshot (if customServiceId was set and passed ownership check)
              const fullSvcData: {
                description: string | null;
                pricingType: string;
              } | null = svcSnapshot
                ? {
                    description: svcSnapshot.description,
                    pricingType: svcSnapshot.pricingType,
                  }
                : null;

              // Parse selected add-ons from req.body — frontend sends a structured array
              let rawAddOns: unknown[] | undefined;
              if (Array.isArray(req.body.selectedAddOns)) {
                rawAddOns = req.body.selectedAddOns;
              } else if (typeof req.body.selectedAddOns === "string") {
                try {
                  const parsed = JSON.parse(req.body.selectedAddOns);
                  if (Array.isArray(parsed)) rawAddOns = parsed;
                } catch {
                  /* ignore malformed JSON */
                }
              }
              const selectedAddOns:
                | { name: string; price: number }[]
                | undefined = rawAddOns
                ? rawAddOns
                    .filter(
                      (a): a is Record<string, unknown> =>
                        typeof a === "object" && a !== null,
                    )
                    .map((a) => ({
                      name: String(a.name ?? "").slice(0, 200),
                      price: Math.max(0, Number(a.price ?? 0)),
                    }))
                    .filter((a) => a.name.length > 0)
                : undefined;

              // Normalize email-enrichment fields from req.body (fallback when snapshot unavailable)
              const ALLOWED_PRICING_TYPES = [
                "fixed",
                "variable",
                "service_call",
                "quote",
                "by_quote",
              ];
              const rawPricingType =
                typeof req.body.pricingType === "string"
                  ? req.body.pricingType
                  : undefined;
              const pricingTypeFromBody =
                rawPricingType && ALLOWED_PRICING_TYPES.includes(rawPricingType)
                  ? rawPricingType
                  : undefined;
              const rawServiceDesc =
                typeof req.body.serviceDescription === "string"
                  ? req.body.serviceDescription.trim()
                  : undefined;
              const serviceDescFromBody = rawServiceDesc
                ? rawServiceDesc.slice(0, 1000)
                : undefined;

              await sendProviderScheduledJobEmail({
                clientEmail: jobClient.email,
                clientName,
                providerName: jobProvider.businessName,
                providerPhone: jobProvider.phone || undefined,
                providerEmail: jobProvider.email || undefined,
                serviceName: newJob.title,
                scheduledDate: scheduledDateStr,
                scheduledTime: scheduledTimeStr,
                address: newJob.address || jobClient.address || undefined,
                estimatedPrice: newJob.estimatedPrice || undefined,
                description: newJob.description || undefined,
                serviceDescription:
                  fullSvcData?.description || serviceDescFromBody || undefined,
                pricingType:
                  fullSvcData?.pricingType || pricingTypeFromBody || undefined,
                addOns: selectedAddOns,
              });
            }
          } catch (emailErr) {
            console.error(
              "Provider job client email error (non-fatal):",
              emailErr,
            );
          }
        })();
      }

      return res.status(201).json({ job: responseJob, appointment });
    } catch (error) {
      console.error("Create job error:", error);
      res.status(500).json({ error: "Failed to create job" });
    }
  });

  app.put(
    "/api/jobs/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        // Task #328: provider owner OR assigned crew member may PUT this row.
        // Crew callers are restricted below to {status, notes} so they cannot
        // reschedule, reprice, or reassign jobs from the field.
        const gate = await requireCrewOrProviderForJob(req, req.params.id, res);
        if (!gate) return;
        const existing = gate.job;
        const isCrewCaller = gate.role === "crew";

        // Allowlist mutable fields to prevent mass-assignment
        let {
          title,
          description,
          status,
          scheduledDate,
          scheduledTime,
          estimatedPrice,
          finalPrice,
          notes,
          address,
          assignedCrewMemberId,
        } = req.body;
        if (isCrewCaller) {
          // Strip every field crew may not change. Only status + notes survive.
          title = undefined;
          description = undefined;
          scheduledDate = undefined;
          scheduledTime = undefined;
          estimatedPrice = undefined;
          finalPrice = undefined;
          address = undefined;
          assignedCrewMemberId = undefined;
          // Crew may only push the job between in-flight states they actually
          // perform. Anything else (cancellation, weather hold, scheduling
          // changes) requires the provider.
          const ALLOWED_CREW_STATUSES = new Set([
            "in_progress",
            "completed",
          ]);
          if (status !== undefined && !ALLOWED_CREW_STATUSES.has(status)) {
            return res.status(403).json({
              error: "Crew members may only mark jobs in_progress or completed",
            });
          }
        }
        // Transitions into/out of weather_held must go through the dedicated
        // /weather-hold and /restore endpoints so the hold metadata,
        // appointment mirroring, and customer notification stay in sync.
        if (status === "weather_held") {
          return res.status(400).json({
            error: "Use POST /api/jobs/:id/weather-hold to place a job on weather hold",
          });
        }
        if (existing.status === "weather_held" && status && status !== "weather_held") {
          return res.status(400).json({
            error: "Use POST /api/jobs/:id/restore to take a job off weather hold",
          });
        }
        const update: Record<string, unknown> = {};
        const isFollowing =
          req.query.scope === "following" && !!existing.seriesId;

        // Compute the cadence shift (if any) BEFORE mutating the pivot row
        // so applyToFollowing can compare against the OLD scheduled_date.
        // Use calendar-date arithmetic (Y/M/D-only) rather than millisecond
        // deltas so DST transitions and time-of-day differences between the
        // two timestamps don't sneak an extra ±1 day into the shift.
        let shiftDays = 0;
        if (
          isFollowing &&
          scheduledDate !== undefined &&
          existing.scheduledDate
        ) {
          const oldD = new Date(existing.scheduledDate);
          const newD = new Date(scheduledDate);
          if (
            !Number.isNaN(oldD.getTime()) &&
            !Number.isNaN(newD.getTime())
          ) {
            const oldUtc = Date.UTC(
              oldD.getFullYear(),
              oldD.getMonth(),
              oldD.getDate(),
            );
            const newUtc = Date.UTC(
              newD.getFullYear(),
              newD.getMonth(),
              newD.getDate(),
            );
            shiftDays = Math.round(
              (newUtc - oldUtc) / (24 * 60 * 60 * 1000),
            );
          }
        }
        const oldPivotDate = existing.scheduledDate
          ? new Date(existing.scheduledDate)
          : undefined;

        if (title !== undefined) update.title = title;
        if (description !== undefined) update.description = description;
        if (status !== undefined) update.status = status;
        // For scope=following, applyToFollowing handles the date+time shift
        // across the pivot AND every later occurrence. Skip the per-pivot
        // mutation here so the row isn't moved twice (route + SQL interval).
        if (scheduledDate !== undefined && !isFollowing)
          update.scheduledDate = scheduledDate;
        if (scheduledTime !== undefined && !isFollowing)
          update.scheduledTime = scheduledTime;
        if (estimatedPrice !== undefined)
          update.estimatedPrice = estimatedPrice;
        if (finalPrice !== undefined) update.finalPrice = finalPrice;
        if (notes !== undefined) update.notes = notes;
        if (address !== undefined) update.address = address;
        // Task #302: crew assignment. Accept null to clear, or validate the
        // crew member belongs to this job's provider before persisting.
        if (assignedCrewMemberId !== undefined) {
          if (assignedCrewMemberId === null) {
            update.assignedCrewMemberId = null;
          } else if (typeof assignedCrewMemberId === "string") {
            const ok = await loadCrewForProvider(
              assignedCrewMemberId,
              existing.providerId,
            );
            if (!ok) {
              return res
                .status(400)
                .json({ error: "Invalid crew member for this provider" });
            }
            update.assignedCrewMemberId = assignedCrewMemberId;
          }
        }

        const job = await storage.updateJob(req.params.id, update);
        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }

        // scope=following propagates safe field edits (and an optional date
        // shift) to the pivot + every future occurrence in the same series
        // and to the series template, so newly-generated occurrences inherit
        // them too.
        if (isFollowing) {
          const hasFieldEdit =
            title !== undefined ||
            description !== undefined ||
            notes !== undefined ||
            scheduledTime !== undefined ||
            estimatedPrice !== undefined ||
            address !== undefined;
          if (hasFieldEdit || shiftDays !== 0) {
            try {
              await applyToFollowingService(req.params.id, {
                title,
                description,
                notes,
                scheduledTime,
                estimatedPrice,
                address,
                shiftDays,
                pivotDateOverride: oldPivotDate,
              });
            } catch (err) {
              // Surface conflict / constraint failures to the client instead
              // of silently succeeding — otherwise the UI thinks the spread
              // worked when later occurrences are still on the old schedule.
              console.error("[recurring] applyToFollowing failed:", err);
              return res.status(409).json({
                error: "Failed to update following occurrences",
              });
            }
          }
        } else if (
          job.appointmentId &&
          (scheduledDate !== undefined ||
            scheduledTime !== undefined ||
            (status !== undefined && status === "cancelled"))
        ) {
          // Single-occurrence edit: mirror date/time/cancellation to the
          // homeowner-facing appointment so it doesn't drift out of sync.
          // Other "this+following" cases are handled by applyToFollowing,
          // and series-cancel mirrors via cancelSeries.
          const apptUpdate: Record<string, unknown> = {};
          if (scheduledDate !== undefined)
            apptUpdate.scheduledDate = scheduledDate;
          if (scheduledTime !== undefined)
            apptUpdate.scheduledTime = scheduledTime;
          if (status === "cancelled") apptUpdate.status = "cancelled";
          if (Object.keys(apptUpdate).length > 0) {
            try {
              await storage.updateAppointment(job.appointmentId, apptUpdate);
            } catch (err) {
              console.error(
                "[recurring] mirror appointment update failed:",
                err,
              );
            }
          }
        }

        // Dispatch job.status_changed when status field changes
        if (status && existing.status !== status) {
          dispatchJobStatusEmail(job, status).catch((e: unknown) =>
            console.error("job.status_changed dispatch error:", e),
          );
        }
        // Defense-in-depth (Task #200): if the generic job updater is used to
        // transition a job to "completed", mirror the same appointment-promote
        // behavior as POST /api/jobs/:id/complete so the homeowner can leave
        // a review. Fire-and-forget; never blocks the response.
        if (
          status === "completed" &&
          existing.status !== "completed" &&
          job.appointmentId
        ) {
          const apptId = job.appointmentId;
          (async () => {
            try {
              const [appt] = await db
                .select({ id: appointments.id, status: appointments.status })
                .from(appointments)
                .where(eq(appointments.id, apptId))
                .limit(1);
              if (appt) {
                // Mirror the REVIEWABLE set used by POST /api/jobs/:id/complete
                // so the two completion paths stay in lock-step.
                const REVIEWABLE = new Set([
                  "completed",
                  "paid",
                  "closed",
                  "awaiting_payment",
                ]);
                if (
                  appt.status !== "cancelled" &&
                  !REVIEWABLE.has(appt.status || "")
                ) {
                  await storage.updateAppointment(apptId, {
                    status: "completed",
                  });
                }
              }
              await sendReviewNudge(apptId);
            } catch (e) {
              console.error("review nudge (job update) error:", e);
            }
          })();
        }
        // Milestone check for the provider when a job is marked complete via
        // generic PATCH (defense-in-depth path, Task #354).
        if (status === "completed" && existing.status !== "completed" && job.providerId) {
          checkAndAwardMilestones(job.providerId).catch((e: unknown) =>
            console.error("milestone check (job update) error:", e),
          );
          updateProviderStreak(job.providerId).catch((e: unknown) =>
            console.error("streak update (job update) error:", e),
          );
        }
        res.json({ job });
      } catch (error) {
        console.error("Update job error:", error);
        res.status(500).json({ error: "Failed to update job" });
      }
    },
  );

  const formatTimeFromDate = (d: Date): string => {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  // scheduledDate (timestamp) and scheduledTime ("HH:MM") are stored
  // independently; combine them so the snapshot reflects the booked slot
  // even when scheduledDate is stored at midnight.
  const combineDateAndTime = (
    date: Date | string | null | undefined,
    time: string | null | undefined,
  ): Date | null => {
    if (!date) return null;
    const base = new Date(date);
    if (Number.isNaN(base.getTime())) return null;
    if (time) {
      const m = /^(\d{1,2}):(\d{2})/.exec(time);
      if (m) {
        base.setHours(Number(m[1]), Number(m[2]), 0, 0);
      }
    }
    return base;
  };

  app.post(
    "/api/jobs/:id/weather-hold",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const existing = await storage.getJob(req.params.id);
        if (!existing) return res.status(404).json({ error: "Job not found" });
        if (!(await assertProviderOwnership(req, existing.providerId, res)))
          return;
        if (existing.status === "completed" || existing.status === "cancelled") {
          return res
            .status(400)
            .json({ error: "Cannot weather-hold a completed or cancelled job" });
        }

        const body = req.body as {
          newDate?: string;
          newTime?: string;
        };

        let parsedNewDate: Date | undefined;
        if (body.newDate) {
          parsedNewDate = new Date(body.newDate);
          if (Number.isNaN(parsedNewDate.getTime())) {
            return res.status(400).json({ error: "Invalid newDate" });
          }
        }

        // No-op when the job is already held and the caller isn't asking to
        // move it — return the existing record without re-notifying.
        if (
          existing.status === "weather_held" &&
          !parsedNewDate &&
          body.newTime === undefined
        ) {
          return res.json({ job: existing, idempotent: true });
        }

        const wasAlreadyHeld = existing.status === "weather_held";

        const update: Record<string, unknown> = {
          status: "weather_held",
        };
        if (!wasAlreadyHeld) {
          update.weatherHeldAt = new Date();
        }
        // Snapshot only the first hold so repeated holds during an extended
        // rainy stretch don't overwrite the true original slot.
        if (!existing.originalScheduledAt) {
          const snapshot = combineDateAndTime(
            existing.scheduledDate,
            existing.scheduledTime,
          );
          if (snapshot) update.originalScheduledAt = snapshot;
        }
        if (parsedNewDate) update.scheduledDate = parsedNewDate;
        if (body.newTime !== undefined) update.scheduledTime = body.newTime;

        const job = await db.transaction(async (tx) => {
          const [updated] = await tx
            .update(jobs)
            .set(update)
            .where(eq(jobs.id, req.params.id))
            .returning();
          if (!updated) throw new Error("Job update returned no row");

          if (
            updated.appointmentId &&
            (parsedNewDate || body.newTime !== undefined)
          ) {
            const apptUpdate: Record<string, unknown> = {};
            if (parsedNewDate) apptUpdate.scheduledDate = parsedNewDate;
            if (body.newTime !== undefined) apptUpdate.scheduledTime = body.newTime;
            await tx
              .update(appointments)
              .set(apptUpdate)
              .where(eq(appointments.id, updated.appointmentId));
          }
          return updated;
        });

        if (!wasAlreadyHeld) {
          const wasRescheduled = Boolean(parsedNewDate || body.newTime !== undefined);
          dispatchJobStatusEmail(job, "weather_held", { wasRescheduled }).catch(
            (e: unknown) =>
              console.error("weather-hold dispatch error:", e),
          );
        }

        res.json({ job });
      } catch (error) {
        console.error("Weather-hold job error:", error);
        res.status(500).json({ error: "Failed to place job on weather hold" });
      }
    },
  );

  // Task #478: mark a job as a no-show, optionally charging a fee against
  // the client's saved card or noting an existing deposit as covering it.
  // Provider-only (not crew) — this is a financial action.
  app.post(
    "/api/jobs/:id/no-show",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const existing = await storage.getJob(req.params.id);
        if (!existing) return res.status(404).json({ error: "Job not found" });
        if (!(await assertProviderOwnership(req, existing.providerId, res)))
          return;
        if (
          existing.status === "completed" ||
          existing.status === "cancelled" ||
          existing.status === "no_show"
        ) {
          // Task #478 code review: block re-entry. Without this guard a
          // provider (or a retried request) could call this endpoint
          // repeatedly against an already-no-show job and trigger
          // `attemptNoShowFeeCharge` more than once, overcharging the client.
          return res.status(409).json({
            error: `Cannot mark a ${existing.status} job as a no-show`,
          });
        }

        const rawFee = Number(req.body?.feeCents);
        const feeCents =
          Number.isFinite(rawFee) && rawFee > 0 ? Math.round(rawFee) : 0;

        let feeStatus: "charged_card" | "covered_by_deposit" | "failed" | null =
          null;
        let feePaymentIntentId: string | null = null;
        let feeFailureReason: string | undefined;

        if (feeCents > 0) {
          const result = await attemptNoShowFeeCharge({
            jobId: existing.id,
            clientId: existing.clientId,
            appointmentId: existing.appointmentId,
            providerId: existing.providerId,
            amountCents: feeCents,
            // Task #478 code review: deterministic idempotency key so a
            // network retry of this request can never create a second
            // Stripe PaymentIntent for the same job's no-show fee.
            idempotencyKey: `no-show-fee:${existing.id}`,
          });
          if (result.success) {
            feeStatus = result.method ?? "charged_card";
            feePaymentIntentId = result.paymentIntentId ?? null;
          } else {
            feeStatus = "failed";
            feeFailureReason = result.reason;
          }
        }

        const job = await db
          .update(jobs)
          .set({
            status: "no_show",
            noShowAt: new Date(),
            noShowFeeCents: feeCents > 0 ? feeCents : null,
            noShowFeeStatus: feeStatus,
            noShowFeePaymentIntentId: feePaymentIntentId,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, req.params.id))
          .returning()
          .then((rows) => rows[0]);
        if (!job) return res.status(404).json({ error: "Job not found" });

        // Notify the homeowner (best-effort, non-fatal).
        (async () => {
          try {
            if (!existing.clientId) return;
            const [client] = await db
              .select({ homeownerUserId: clients.homeownerUserId })
              .from(clients)
              .where(eq(clients.id, existing.clientId));
            if (!client?.homeownerUserId) return;
            const feeNote =
              feeStatus === "charged_card"
                ? ` A $${(feeCents / 100).toFixed(2)} no-show fee was charged to your card on file.`
                : feeStatus === "covered_by_deposit"
                  ? ` Your deposit will cover the no-show fee.`
                  : "";
            await dispatchNotification(
              client.homeownerUserId,
              "Marked as a no-show",
              `Your appointment "${job.title}" was marked as a no-show.${feeNote}`,
              "job.no_show",
              { jobId: job.id, screen: "JobDetail" },
              "bookings",
            );
          } catch (e) {
            console.error("no-show notify error:", e);
          }
        })();

        res.json({
          job,
          fee:
            feeCents > 0
              ? { status: feeStatus, amountCents: feeCents, reason: feeFailureReason }
              : null,
        });
      } catch (error) {
        console.error("No-show job error:", error);
        res.status(500).json({ error: "Failed to mark job as a no-show" });
      }
    },
  );

  app.post(
    "/api/jobs/:id/restore",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const existing = await storage.getJob(req.params.id);
        if (!existing) return res.status(404).json({ error: "Job not found" });
        if (!(await assertProviderOwnership(req, existing.providerId, res)))
          return;

        // Idempotent restore — succeed quietly if the job is already off
        // weather hold so retries/double-taps don't raise errors.
        if (existing.status !== "weather_held") {
          return res.json({ job: existing, idempotent: true });
        }

        // Restore = unpause at the job's *current* scheduled slot. If the
        // provider held & moved the job to a tentative new date, "Restore"
        // confirms that new slot rather than rolling back to the rainy
        // original. The originalScheduledAt snapshot is cleared and kept
        // only on the held record for any future undo-move flow.
        const update: Record<string, unknown> = {
          status: "scheduled",
          weatherHeldAt: null,
          originalScheduledAt: null,
        };

        const job = await db.transaction(async (tx) => {
          const [updated] = await tx
            .update(jobs)
            .set(update)
            .where(eq(jobs.id, req.params.id))
            .returning();
          if (!updated) throw new Error("Job update returned no row");
          return updated;
        });

        dispatchJobStatusEmail(job, "scheduled").catch((e: unknown) =>
          console.error("restore dispatch error:", e),
        );

        if (job.providerId) {
          updateProviderStreak(job.providerId).catch((e: unknown) =>
            console.error("streak update (job restore) error:", e),
          );
        }

        res.json({ job });
      } catch (error) {
        console.error("Restore job error:", error);
        res.status(500).json({ error: "Failed to restore job" });
      }
    },
  );

  app.post(
    "/api/jobs/:id/complete",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        // Task #328: provider owner OR assigned crew member.
        const gate = await requireCrewOrProviderForJob(req, req.params.id, res);
        if (!gate) return;
        const prior = gate.job;
        // Crew callers can mark complete but cannot set/override pricing.
        const finalPrice =
          gate.role === "crew" ? undefined : req.body.finalPrice;
        const job = await storage.completeJob(req.params.id, finalPrice);
        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }
        // Fire job status change email only if status actually transitioned (prevents duplicates)
        if (prior?.status !== "completed") {
          dispatchJobStatusEmail(job, "completed").catch((e: unknown) =>
            console.error("job.status_changed dispatch error:", e),
          );
        }
        // Fire rebooking nudge push + email to homeowner (fire-and-forget)
        (async () => {
          try {
            if (!job.clientId || !job.providerId) return;
            const [client] = await db
              .select()
              .from(clients)
              .where(eq(clients.id, job.clientId))
              .catch(() => [null]);
            const [provider] = await db
              .select()
              .from(providers)
              .where(eq(providers.id, job.providerId))
              .catch(() => [null]);
            if (!client?.email || !provider) return;
            const homeownerUserId = client.homeownerUserId ?? undefined;
            const encodedName = encodeURIComponent(provider.businessName);
            const rebookLink = `homebase://SimpleBooking?providerId=${provider.id}&providerName=${encodedName}`;
            // In-app push notification so homeowner sees it immediately
            if (homeownerUserId) {
              await dispatchNotification(
                homeownerUserId,
                "Time to rebook?",
                `Your ${job.title ?? "service"} with ${provider.businessName} is done. Ready to schedule again?`,
                "rebook.prompt",
                {
                  providerId: provider.id,
                  providerName: provider.businessName,
                  screen: "SimpleBooking",
                },
                "bookings",
              ).catch((e: unknown) => console.error("rebook push error:", e));
            }
            await dispatch("rebook.prompt", {
              clientEmail: client.email,
              clientName:
                `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
                client.email,
              providerName: provider.businessName,
              serviceName: job.title ?? "your service",
              rebookLink,
              recipientUserId: homeownerUserId,
              relatedRecordType: "job",
              relatedRecordId: job.id,
            });
          } catch (e) {
            console.error("rebook.prompt dispatch error:", e);
          }
        })();
        // HouseFax auto-log pipeline (fire-and-forget)
        autoLogHouseFaxEntry(job).catch((e: unknown) =>
          console.error("housefax auto-log error:", e),
        );

        // Task #352: referral reward — when the referred provider completes their
        // first job, extend the referrer's subscription by 30 days.
        //
        // Three-step protocol:
        // 1. CAS claim: UPDATE SET first_job_completed_at WHERE BOTH timestamps null.
        //    PostgreSQL row lock + WHERE re-evaluation ensures only one concurrent
        //    caller wins (second caller finds first_job_completed_at already set → 0
        //    rows returned → bails out).
        // 2. Extend referrer's subscription (may throw).
        // 3. Set reward_granted_at ONLY after successful extension.
        //
        // If extension fails: first_job_completed_at is set but reward_granted_at is
        // null, leaving a recoverable signal in the DB. The error is logged with full
        // context (referralId + referrerProviderId) so ops can manually complete the
        // credit. This is intentionally NOT silently swallowed.
        if (job.providerId) {
          (async () => {
            const now = new Date();
            let referralId: string | undefined;
            let referrerProviderId: string | undefined;
            try {
              // Step 1: Atomic CAS claim — sets firstJobCompletedAt only if both
              // timestamps are null. Concurrent callers get 0 rows and bail.
              const claimed = await db
                .update(providerReferrals)
                .set({ firstJobCompletedAt: now })
                .where(
                  and(
                    eq(providerReferrals.referredProviderId, job.providerId!),
                    isNull(providerReferrals.firstJobCompletedAt),
                    isNull(providerReferrals.rewardGrantedAt),
                  ),
                )
                .returning({
                  id: providerReferrals.id,
                  referrerProviderId: providerReferrals.referrerProviderId,
                });

              if (!claimed.length) return; // already rewarded or no referral record

              referralId = claimed[0].id;
              referrerProviderId = claimed[0].referrerProviderId;

              // Step 2: Extend referrer's subscription. If this throws, rewardGrantedAt
              // stays null — the row is detectable via first_job_completed_at IS NOT
              // NULL AND reward_granted_at IS NULL for manual ops recovery.
              await extendSubscriptionByDays(referrerProviderId, 30);

              // Step 3: Mark reward as granted only after successful extension.
              await db
                .update(providerReferrals)
                .set({ rewardGrantedAt: now })
                .where(eq(providerReferrals.id, referralId));

              // Notify the referrer.
              await sendReferralRewardNotification(referrerProviderId, referralId);

              // Check milestones for the referrer: the new reward may push them
              // past the 3-referral discount threshold (Task #354).
              await checkAndAwardMilestones(referrerProviderId);
            } catch (e) {
              // Log with enough context for manual recovery.
              console.error(
                "[referral] REWARD GRANT FAILED — manual recovery needed",
                { referralId, referrerProviderId, jobId: job.id, error: String(e) },
              );
            }
          })();
        }

        // Milestone check for the provider completing the job (Task #354):
        // job count milestones (10 jobs / 25 jobs) and revenue milestone ($10K).
        if (job.providerId) {
          checkAndAwardMilestones(job.providerId).catch((e: unknown) =>
            console.error("milestone check (job complete) error:", e),
          );
          updateProviderStreak(job.providerId).catch((e: unknown) =>
            console.error("streak update (job complete) error:", e),
          );
        }

        // Provider-side completion does not currently flip the linked
        // appointment to "completed" automatically — but as soon as the job is
        // done the homeowner can leave a review. Promote the appointment to
        // "completed" if it isn't already in a reviewable/cancelled state, and
        // fire the (deduped) review nudge for the linked appointment.
        if (job.appointmentId) {
          const apptId = job.appointmentId;
          (async () => {
            try {
              const [appt] = await db
                .select({ id: appointments.id, status: appointments.status })
                .from(appointments)
                .where(eq(appointments.id, apptId))
                .limit(1);
              if (appt) {
                const REVIEWABLE = new Set([
                  "completed",
                  "paid",
                  "closed",
                  "awaiting_payment",
                ]);
                if (
                  appt.status !== "cancelled" &&
                  !REVIEWABLE.has(appt.status || "")
                ) {
                  await storage.updateAppointment(apptId, {
                    status: "completed",
                  });
                }
              }
              await sendReviewNudge(apptId);
            } catch (e) {
              console.error("review nudge (job complete) error:", e);
            }
          })();
        }

        // Task #480: one-tap auto-draft invoice. When a provider marks a job
        // complete, automatically create a DRAFT invoice for the job's price
        // if one doesn't already exist, so the mobile app can route the
        // provider straight into it instead of rebuilding one in AddInvoice.
        // Sending is intentionally NOT triggered here — the provider must
        // explicitly tap "Send Invoice" on InvoiceDetail (the single-action
        // send flow), so drafts are never emailed to clients without review.
        let autoInvoiceId: string | null = null;
        if (job.providerId && job.clientId && prior?.status !== "completed") {
          try {
            const providerId = job.providerId!;
            const [existingInvoice] = await db
              .select({ id: invoices.id })
              .from(invoices)
              .where(eq(invoices.jobId, job.id))
              .limit(1);

            if (existingInvoice) {
              autoInvoiceId = existingInvoice.id;
            } else {
              const priceStr = job.finalPrice ?? job.estimatedPrice;
              const amount = priceStr ? parseFloat(priceStr) : 0;
              const subStatus = Number.isFinite(amount) && amount > 0
                ? await getProviderSubscriptionStatus(providerId)
                : null;

              if (Number.isFinite(amount) && amount > 0 && subStatus?.status !== "expired") {
                const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                const lineItems = [
                  {
                    description: job.title || "Service",
                    quantity: 1,
                    unitPrice: amount,
                    total: amount,
                  },
                ];
                const subtotalCents = Math.round(amount * 100);
                const autoPlan = await getProviderPlan(providerId);
                const autoFee = calculatePlatformFee(
                  subtotalCents,
                  autoPlan.platformFeePercent || "3.00",
                  autoPlan.platformFeeFixedCents || 0,
                );
                const invoiceData = {
                  providerId,
                  clientId: job.clientId!,
                  jobId: job.id,
                  invoiceNumber,
                  currency: "usd",
                  subtotalCents,
                  taxCents: 0,
                  discountCents: 0,
                  platformFeeCents: autoFee.totalCents,
                  totalCents: subtotalCents,
                  amount: amount.toFixed(2),
                  total: amount.toFixed(2),
                  lineItems: JSON.stringify(lineItems),
                  notes: null,
                  status: "draft",
                  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                };
                const parsedAuto = insertInvoiceSchema.safeParse(invoiceData);
                if (!parsedAuto.success) {
                  console.error(
                    "auto-invoice (job complete): invalid invoice data",
                    parsedAuto.error.issues,
                  );
                } else {
                  const autoInvoice = await storage.createInvoice(parsedAuto.data);
                  autoInvoiceId = autoInvoice.id;
                  // Intentionally no Stripe send / notification here — the
                  // invoice stays a draft until the provider explicitly taps
                  // "Send Invoice" on InvoiceDetail.
                }
              }
            }
          } catch (e) {
            console.error("auto-invoice (job complete) error:", e);
          }
        }

        res.json({ job, invoiceId: autoInvoiceId });
      } catch (error) {
        console.error("Complete job error:", error);
        res.status(500).json({ error: "Failed to complete job" });
      }
    },
  );

  app.post(
    "/api/jobs/:id/start",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        // Task #328: provider OR assigned crew member may start a job.
        const gate = await requireCrewOrProviderForJob(req, req.params.id, res);
        if (!gate) return;
        const prior = gate.job;
        // Crew may only start jobs that are in a pre-start state. Providers
        // retain full latitude (e.g. restarting a completed job).
        if (gate.role === "crew") {
          const allowed = new Set(["scheduled", "confirmed", "in_progress"]);
          if (!allowed.has(prior.status)) {
            return res
              .status(409)
              .json({ error: `Cannot start a ${prior.status} job` });
          }
        }
        const job = await storage.updateJob(req.params.id, {
          status: "in_progress",
        });
        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }
        // Fire job status change email only if status actually transitioned (prevents duplicates)
        if (prior.status !== "in_progress") {
          dispatchJobStatusEmail(job, "in_progress").catch((e: unknown) =>
            console.error("job.status_changed dispatch error:", e),
          );
        }
        res.json({ job });
      } catch (error) {
        console.error("Start job error:", error);
        res.status(500).json({ error: "Failed to start job" });
      }
    },
  );

  // --- Task #486: Live ETA "On My Way" tracking -----------------------

  // Provider/crew fetch the current tracking session for a job so the app
  // can show a "Share tracking link" affordance without waiting on the
  // status-change notification.
  app.get(
    "/api/jobs/:id/tracking",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const gate = await requireCrewOrProviderForJob(req, req.params.id, res);
        if (!gate) return;
        const session = await storage.getActiveJobTrackingSession(
          req.params.id,
        );
        if (!session) {
          return res.json({ active: false });
        }
        res.json({
          active: true,
          trackingUrl: `${getPublicBaseUrl()}/api/track/${session.token}/page`,
          expiresAt: session.expiresAt,
        });
      } catch (error) {
        console.error("Get job tracking error:", error);
        res.status(500).json({ error: "Failed to load tracking session" });
      }
    },
  );

  // Provider/crew post their current GPS location while "On My Way" so the
  // public tracking page can render a live map + ETA. No-ops (200) if
  // there's no active session (e.g. it already expired/ended) so the
  // client's periodic location watcher doesn't need special-case handling.
  app.post(
    "/api/jobs/:id/tracking/location",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const gate = await requireCrewOrProviderForJob(req, req.params.id, res);
        if (!gate) return;
        const { lat, lng } = req.body ?? {};
        if (typeof lat !== "number" || typeof lng !== "number") {
          return res.status(400).json({ error: "lat and lng are required numbers" });
        }
        const session = await storage.getActiveJobTrackingSession(
          req.params.id,
        );
        if (!session) {
          return res.json({ active: false });
        }
        if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
          await storage.endActiveJobTrackingSessions(req.params.id);
          return res.json({ active: false, expired: true });
        }
        await storage.updateJobTrackingSessionLocation(session.id, lat, lng);
        res.json({ active: true });
      } catch (error) {
        console.error("Update tracking location error:", error);
        res.status(500).json({ error: "Failed to update location" });
      }
    },
  );

  // Resolve the {lat,lng,address} of a job's destination for ETA math on
  // the public tracking page. Mirrors the geocode-on-demand pattern used
  // by routeOptimizationService.geocodeJobs, but for a single job.
  async function resolveJobDestination(
    job: Job,
  ): Promise<{ lat: number; lng: number; address: string } | null> {
    const address = job.address?.trim();
    if (!address || address.length < 3) return null;
    const g = await geocodeAddress(address);
    if (!g) return null;
    return { lat: g.latitude, lng: g.longitude, address: g.formattedAddress };
  }

  async function computeTrackingEta(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<{ etaMinutes: number; distanceMiles: number; source: "google" | "haversine" }> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (apiKey) {
      try {
        const url = new URL(
          "https://maps.googleapis.com/maps/api/distancematrix/json",
        );
        url.searchParams.set("origins", `${from.lat},${from.lng}`);
        url.searchParams.set("destinations", `${to.lat},${to.lng}`);
        url.searchParams.set("units", "imperial");
        url.searchParams.set("key", apiKey);
        const r = await fetch(url.toString());
        const data = (await r.json()) as {
          status?: string;
          rows?: { elements?: { status?: string; distance?: { value: number }; duration?: { value: number } }[] }[];
        };
        const el = data.rows?.[0]?.elements?.[0];
        if (data.status === "OK" && el?.status === "OK" && el.distance && el.duration) {
          return {
            distanceMiles: el.distance.value / 1609.344,
            etaMinutes: el.duration.value / 60,
            source: "google",
          };
        }
      } catch (err) {
        console.error("[tracking] Distance Matrix error:", err);
      }
    }
    const FALLBACK_SPEED_MPH = 30;
    const FALLBACK_DETOUR_FACTOR = 1.35;
    const miles = haversineMiles(from.lat, from.lng, to.lat, to.lng) * FALLBACK_DETOUR_FACTOR;
    return {
      distanceMiles: miles,
      etaMinutes: (miles / FALLBACK_SPEED_MPH) * 60,
      source: "haversine",
    };
  }

  // Public, unauthenticated JSON endpoint backing the tracking page. No
  // app install or login required — the token itself is the credential
  // (time-boxed + single-purpose, so this is an acceptable capability URL).
  app.get(
    "/api/track/:token",
    async (req: Request<{ token: string }>, res: Response) => {
      try {
        const session = await storage.getJobTrackingSessionByToken(
          req.params.token,
        );
        if (!session) {
          return res.status(404).json({ error: "Tracking link not found" });
        }
        const isExpired =
          session.status !== "active" ||
          (session.expiresAt ? session.expiresAt.getTime() < Date.now() : false);
        if (isExpired && session.status === "active") {
          await storage.endActiveJobTrackingSessions(session.jobId);
        }
        const job = await storage.getJob(session.jobId);
        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }
        const [provider] = await db
          .select({ businessName: providers.businessName })
          .from(providers)
          .where(eq(providers.id, session.providerId))
          .catch(() => [null]);

        const base = {
          active: !isExpired,
          providerName: provider?.businessName ?? "Your provider",
          serviceName: job.title ?? "your appointment",
          jobStatus: job.status,
          destinationAddress: job.address ?? null,
        };

        if (isExpired) {
          return res.json({ ...base, active: false });
        }

        if (session.lastLat == null || session.lastLng == null) {
          return res.json({
            ...base,
            hasLocation: false,
          });
        }

        const destination = await resolveJobDestination(job);
        let eta: Awaited<ReturnType<typeof computeTrackingEta>> | null = null;
        if (destination) {
          eta = await computeTrackingEta(
            { lat: session.lastLat, lng: session.lastLng },
            destination,
          );
        }

        res.json({
          ...base,
          hasLocation: true,
          providerLat: session.lastLat,
          providerLng: session.lastLng,
          lastLocationAt: session.lastLocationAt,
          destinationLat: destination?.lat ?? null,
          destinationLng: destination?.lng ?? null,
          etaMinutes: eta ? Math.round(eta.etaMinutes) : null,
          distanceMiles: eta ? Math.round(eta.distanceMiles * 10) / 10 : null,
        });
      } catch (error) {
        console.error("Get tracking session error:", error);
        res.status(500).json({ error: "Failed to load tracking session" });
      }
    },
  );

  // Public HTML page: a lightweight Leaflet/OpenStreetMap view that polls
  // the JSON endpoint above. No API key or app install required.
  app.get(
    "/api/track/:token/page",
    async (req: Request<{ token: string }>, res: Response) => {
      const token = req.params.token.replace(/[^a-zA-Z0-9]/g, "");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(buildTrackingPageHtml(token));
    },
  );

  app.delete(
    "/api/jobs/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const existing = await storage.getJob(req.params.id);
        if (!existing) {
          return res.status(404).json({ error: "Job not found" });
        }
        if (!(await assertProviderOwnership(req, existing.providerId, res)))
          return;

        // scope=series cancels every future occurrence + the series itself,
        // leaving the current job + completed history alone. The recurring
        // service marks future scheduled/confirmed jobs as cancelled.
        if (req.query.scope === "series" && existing.seriesId) {
          let cancelled = 0;
          try {
            cancelled = await cancelSeriesService(existing.seriesId);
          } catch (err) {
            console.error("[recurring] cancelSeries failed:", err);
            return res
              .status(500)
              .json({ error: "Failed to cancel series" });
          }
          return res.json({
            success: true,
            scope: "series",
            seriesId: existing.seriesId,
            cancelledOccurrences: cancelled,
          });
        }

        const deleted = await storage.deleteJob(req.params.id);
        if (!deleted) {
          return res.status(404).json({ error: "Job not found" });
        }
        res.json({ success: true });
      } catch (error) {
        console.error("Delete job error:", error);
        res.status(500).json({ error: "Failed to delete job" });
      }
    },
  );

  // ============ JOB SERIES ROUTES ============

  // Fetch a series + its materialized occurrences. Provider-scoped.
  app.get(
    "/api/series/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const [series] = await db
          .select()
          .from(jobSeries)
          .where(eq(jobSeries.id, req.params.id));
        if (!series) {
          return res.status(404).json({ error: "Series not found" });
        }
        if (!(await assertProviderOwnership(req, series.providerId, res)))
          return;

        const occurrences = await db
          .select()
          .from(jobs)
          .where(eq(jobs.seriesId, series.id))
          .orderBy(jobs.scheduledDate);

        res.json({ series, occurrences });
      } catch (error) {
        console.error("Get series error:", error);
        res.status(500).json({ error: "Failed to get series" });
      }
    },
  );

  // Task #474: opt a series in/out of autopay. When enabled, each newly
  // due occurrence is auto-charged off-session against the client's saved
  // card instead of requiring a manual invoice send.
  app.patch(
    "/api/series/:id/autopay",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const [series] = await db
          .select({ id: jobSeries.id, providerId: jobSeries.providerId })
          .from(jobSeries)
          .where(eq(jobSeries.id, req.params.id));
        if (!series) {
          return res.status(404).json({ error: "Series not found" });
        }
        if (!(await assertProviderOwnership(req, series.providerId, res)))
          return;

        const autopayEnabled = Boolean(req.body?.autopayEnabled);
        const [updated] = await db
          .update(jobSeries)
          .set({ autopayEnabled, updatedAt: new Date() })
          .where(eq(jobSeries.id, series.id))
          .returning();
        res.json({ series: updated });
      } catch (error) {
        console.error("Update series autopay error:", error);
        res.status(500).json({ error: "Failed to update autopay setting" });
      }
    },
  );

  // Cancel a series (and all future not-yet-touched occurrences).
  app.post(
    "/api/series/:id/cancel",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const [series] = await db
          .select({ id: jobSeries.id, providerId: jobSeries.providerId })
          .from(jobSeries)
          .where(eq(jobSeries.id, req.params.id));
        if (!series) {
          return res.status(404).json({ error: "Series not found" });
        }
        if (!(await assertProviderOwnership(req, series.providerId, res)))
          return;
        const cancelledOccurrences = await cancelSeriesService(series.id);
        res.json({ success: true, cancelledOccurrences });
      } catch (error) {
        console.error("Cancel series error:", error);
        res.status(500).json({ error: "Failed to cancel series" });
      }
    },
  );

  // Task #476: pause an active series for a seasonal hiatus. Removes
  // not-yet-touched future occurrences so the calendar doesn't show visits
  // during the pause; history is preserved.
  app.post(
    "/api/series/:id/pause",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const [series] = await db
          .select({ id: jobSeries.id, providerId: jobSeries.providerId })
          .from(jobSeries)
          .where(eq(jobSeries.id, req.params.id));
        if (!series) {
          return res.status(404).json({ error: "Series not found" });
        }
        if (!(await assertProviderOwnership(req, series.providerId, res)))
          return;
        const removedOccurrences = await pauseSeriesService(series.id);
        if (removedOccurrences < 0) {
          return res
            .status(409)
            .json({ error: "Only active series can be paused" });
        }
        res.json({ success: true, removedOccurrences });
      } catch (error) {
        console.error("Pause series error:", error);
        res.status(500).json({ error: "Failed to pause series" });
      }
    },
  );

  // Task #476: resume a paused series. Re-materializes the rolling horizon
  // from today forward using the series' existing cadence/settings.
  app.post(
    "/api/series/:id/resume",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const [series] = await db
          .select({ id: jobSeries.id, providerId: jobSeries.providerId })
          .from(jobSeries)
          .where(eq(jobSeries.id, req.params.id));
        if (!series) {
          return res.status(404).json({ error: "Series not found" });
        }
        if (!(await assertProviderOwnership(req, series.providerId, res)))
          return;
        const result = await resumeSeriesService(series.id);
        if (!result) {
          return res
            .status(409)
            .json({ error: "Only paused series can be resumed" });
        }
        res.json({ success: true, materializedOccurrences: result.materialized });
      } catch (error) {
        console.error("Resume series error:", error);
        res.status(500).json({ error: "Failed to resume series" });
      }
    },
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Recurring-series backfill (provider-confirmed).
  //
  // Existing recurring jobs (created before this feature shipped, or by the
  // generic POST /api/jobs path with a non-recurring custom service) aren't
  // auto-stitched into series at boot — that would silently fabricate
  // dozens of phantom future occurrences. Instead we expose a preview /
  // confirm pair the provider opts into from the schedule screen.
  // ──────────────────────────────────────────────────────────────────────────

  // Returns groups of jobs that look like an unstitched recurring series for
  // the calling provider: same custom_service_id + client_id, ≥1 historical
  // occurrence, custom service is flagged is_recurring with a known cadence.
  app.get(
    "/api/recurring/backfill-candidates",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.authenticatedUserId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const provider = await storage.getProviderByUserId(userId);
        if (!provider) return res.json({ candidates: [] });
        const result = await pool.query(
          `SELECT j.custom_service_id,
                  j.client_id,
                  COUNT(*)::int      AS occurrences,
                  MIN(j.scheduled_date) AS anchor_date,
                  MIN(j.title)       AS title,
                  MIN(pcs.recurring_frequency) AS frequency,
                  MIN(c.first_name || ' ' || c.last_name) AS client_name
             FROM jobs j
             JOIN provider_custom_services pcs
               ON pcs.id = j.custom_service_id
             LEFT JOIN clients c ON c.id = j.client_id
            WHERE j.provider_id = $1
              AND j.series_id IS NULL
              AND pcs.is_recurring = true
              AND pcs.recurring_frequency IN
                  ('daily','weekly','biweekly','monthly','quarterly')
            GROUP BY j.custom_service_id, j.client_id
            HAVING COUNT(*) >= 1`,
          [provider.id],
        );
        res.json({ candidates: result.rows });
      } catch (error) {
        console.error("Backfill candidates error:", error);
        res.status(500).json({ error: "Failed to load candidates" });
      }
    },
  );

  // Stitches a single confirmed group into a job_series and links existing
  // jobs to it. The most recent occurrence becomes the series anchor and
  // future occurrences are then materialized through the standard generator.
  app.post(
    "/api/recurring/backfill-confirm",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const provider = await storage.getProviderByUserId(userId);
        if (!provider) return res.status(403).json({ error: "Forbidden" });
        const { customServiceId, clientId } = req.body as {
          customServiceId?: string;
          clientId?: string | null;
        };
        if (!customServiceId) {
          return res.status(400).json({ error: "customServiceId required" });
        }
        // Most recent unstitched job becomes the series anchor. We query
        // through Drizzle (not raw SQL) so the resulting Job row keeps its
        // camelCase shape — createSeriesForJob reads providerId /
        // scheduledDate / customServiceId, not snake_case columns.
        const [anchor] = await db
          .select()
          .from(jobs)
          .where(
            and(
              eq(jobs.providerId, provider.id),
              eq(jobs.customServiceId, customServiceId),
              clientId
                ? eq(jobs.clientId, clientId)
                : isNull(jobs.clientId),
              isNull(jobs.seriesId),
            ),
          )
          .orderBy(desc(jobs.scheduledDate))
          .limit(1);
        if (!anchor) {
          return res.status(404).json({ error: "No candidate jobs" });
        }
        const [svc] = await db
          .select()
          .from(providerCustomServices)
          .where(eq(providerCustomServices.id, customServiceId));
        if (!svc?.isRecurring || !svc.recurringFrequency) {
          return res.status(400).json({ error: "Service not recurring" });
        }
        const result = await createSeriesForJob({
          job: anchor,
          frequency: svc.recurringFrequency,
          recurringPrice: svc.recurringPrice,
        });
        if (!result) {
          return res.status(400).json({ error: "Unsupported frequency" });
        }
        // Link any other historical unstitched jobs in the same group to the
        // freshly-created series so they show the recurring badge too.
        await pool.query(
          `UPDATE jobs
              SET series_id = $1, updated_at = NOW()
            WHERE provider_id = $2
              AND custom_service_id = $3
              AND client_id IS NOT DISTINCT FROM $4
              AND series_id IS NULL`,
          [result.seriesId, provider.id, customServiceId, clientId ?? null],
        );
        res.json({
          success: true,
          seriesId: result.seriesId,
          materialized: result.materialized,
        });
      } catch (error) {
        console.error("Backfill confirm error:", error);
        res.status(500).json({ error: "Failed to backfill" });
      }
    },
  );

  // ============ INVOICES ROUTES ============

  app.get(
    "/api/provider/:providerId/invoices",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res)))
          return;
        const invoices = await storage.getInvoices(req.params.providerId);
        res.json({ invoices });
      } catch (error) {
        console.error("Get invoices error:", error);
        res.status(500).json({ error: "Failed to get invoices" });
      }
    },
  );

  app.get(
    "/api/invoices/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const invoice = await storage.getInvoice(req.params.id);
        if (!invoice) {
          return res.status(404).json({ error: "Invoice not found" });
        }
        const providerRecord = await storage.getProviderByUserId(authUserId);
        const isProvider =
          providerRecord && invoice.providerId === providerRecord.id;
        const isHomeowner = invoice.homeownerUserId === authUserId;
        if (!isProvider && !isHomeowner) {
          return res.status(403).json({ error: "Access denied" });
        }
        res.json({ invoice });
      } catch (error) {
        console.error("Get invoice error:", error);
        res.status(500).json({ error: "Failed to get invoice" });
      }
    },
  );

  app.get(
    "/api/provider/:providerId/next-invoice-number",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res)))
          return;
        const invoiceNumber = await storage.getNextInvoiceNumber(
          req.params.providerId,
        );
        res.json({ invoiceNumber });
      } catch (error) {
        console.error("Get next invoice number error:", error);
        res.status(500).json({ error: "Failed to get invoice number" });
      }
    },
  );

  app.post(
    "/api/invoices",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const invoiceNumber =
          req.body.invoiceNumber ||
          `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        // Ownership: caller must own the provider they are creating an invoice for
        if (
          req.body.providerId &&
          !(await assertProviderOwnership(req, req.body.providerId, res))
        )
          return;

        // Subscription gate — block invoice creation if grace period has expired
        if (
          req.body.providerId &&
          !(await checkSubscriptionGate(req.body.providerId, res))
        )
          return;

        // Calculate total from line items if provided
        const lineItemsInput: any[] = Array.isArray(req.body.lineItems)
          ? req.body.lineItems
          : [];
        let total = parseFloat(req.body.amount || "0");
        if (lineItemsInput.length > 0) {
          total = lineItemsInput.reduce((sum: number, item: any) => {
            return (
              sum +
              (parseFloat(item.unitPrice) || 0) *
                (parseFloat(item.quantity) || 1)
            );
          }, 0);
        }
        const lineItemsJson =
          lineItemsInput.length > 0
            ? JSON.stringify(lineItemsInput)
            : req.body.amount
              ? JSON.stringify([
                  {
                    description: req.body.notes || "Service",
                    quantity: 1,
                    unitPrice: parseFloat(req.body.amount),
                    total: parseFloat(req.body.amount),
                  },
                ])
              : undefined;

        const subtotalCents = Math.round(total * 100);
        // Compute the platform fee at draft time so the eventual Connect
        // destination charge / invoice carries the correct application_fee
        // (Task #150).
        const draftPlan = req.body.providerId
          ? await getProviderPlan(req.body.providerId)
          : { platformFeePercent: "3.00", platformFeeFixedCents: 0 };
        const draftFee = calculatePlatformFee(
          subtotalCents,
          draftPlan.platformFeePercent || "3.00",
          draftPlan.platformFeeFixedCents || 0,
        );
        const invoiceData = {
          providerId: req.body.providerId,
          clientId: req.body.clientId,
          jobId: req.body.jobId || null,
          invoiceNumber,
          currency: "usd",
          subtotalCents,
          taxCents: 0,
          discountCents: 0,
          platformFeeCents: draftFee.totalCents,
          totalCents: subtotalCents,
          amount: total.toFixed(2),
          total: total.toFixed(2),
          status: "draft",
          notes: req.body.notes || null,
          lineItems: lineItemsJson,
          dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        };
        const parsed = insertInvoiceSchema.safeParse(invoiceData);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "Invalid input", details: parsed.error.issues });
        }
        const invoice = await storage.createInvoice(parsed.data);
        // Dispatch invoice.created for provider bookkeeping (fire-and-forget, draft invoices)
        if (invoice.clientId) {
          const [draftClient] = await db
            .select()
            .from(clients)
            .where(eq(clients.id, invoice.clientId))
            .catch(() => [null]);
          const [draftProvider] = await db
            .select()
            .from(providers)
            .where(eq(providers.id, invoice.providerId))
            .catch(() => [null]);
          if (draftClient?.email && draftProvider) {
            dispatch("invoice.created", {
              clientEmail: draftClient.email,
              clientName:
                [draftClient.firstName, draftClient.lastName]
                  .filter(Boolean)
                  .join(" ") || "Client",
              providerName: draftProvider.businessName,
              invoiceNumber: invoice.invoiceNumber,
              amount: parseFloat(invoice.total?.toString() || "0"),
              dueDate: invoice.dueDate
                ? new Date(invoice.dueDate).toLocaleDateString()
                : "Due on receipt",
              relatedRecordType: "invoice",
              relatedRecordId: invoice.id,
              recipientUserId: draftClient.homeownerUserId ?? undefined,
            }).catch((e: unknown) =>
              console.error("invoice.created dispatch error:", e),
            );
          }
        }
        res.status(201).json({ invoice });
      } catch (error) {
        console.error("Create invoice error:", error);
        res.status(500).json({ error: "Failed to create invoice" });
      }
    },
  );

  // Task #230: send the homeowner a push + in-app notification when a
  // provider sends them an invoice. Prefers the invoice's linked
  // homeownerUserId (most reliable), falls back to client.email →
  // users.email for legacy invoices missing the back-link. Routes the
  // tap-through to AppointmentDetail so the homeowner lands on the
  // screen with the new "Pay $X.XX" button.
  async function notifyHomeownerInvoiceSent(args: {
    invoice: {
      id: string;
      invoiceNumber: string | null;
      homeownerUserId: string | null;
      jobId: string | null;
    };
    providerName: string;
    amount: number;
    clientEmail: string | null;
  }): Promise<void> {
    let homeownerUserId = args.invoice.homeownerUserId ?? null;
    if (!homeownerUserId && args.clientEmail) {
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, args.clientEmail))
        .limit(1)
        .catch((): { id: string }[] => []);
      const u = rows[0];
      if (u?.id) homeownerUserId = u.id;
    }
    if (!homeownerUserId) return;

    // Find the appointment so the notification can deep-link to a screen
    // that surfaces the invoice and the Pay button.
    let appointmentId: string | null = null;
    if (args.invoice.jobId) {
      const rows = await db
        .select({ appointmentId: jobs.appointmentId })
        .from(jobs)
        .where(eq(jobs.id, args.invoice.jobId))
        .limit(1)
        .catch((): { appointmentId: string | null }[] => []);
      const j = rows[0];
      if (j?.appointmentId) appointmentId = j.appointmentId;
    }

    const title = `Invoice from ${args.providerName}`;
    const body = `Invoice ${args.invoice.invoiceNumber || args.invoice.id.slice(0, 8)} for $${args.amount.toFixed(2)} is ready. Tap to pay.`;
    const data: Record<string, unknown> = {
      type: "invoice_sent",
      invoiceId: args.invoice.id,
    };
    if (appointmentId) {
      data.screen = "AppointmentDetail";
      data.params = { appointmentId };
      data.appointmentId = appointmentId;
    }
    await dispatchNotification(
      homeownerUserId,
      title,
      body,
      "invoice_sent",
      data,
      "invoices",
    );
  }

  // Task #235: when a provider sends a reminder for an unpaid invoice, push +
  // in-app notify the homeowner so they aren't relying solely on email.
  // Mirrors notifyHomeownerInvoiceSent for consistency.
  async function notifyHomeownerInvoiceReminder(args: {
    invoice: {
      id: string;
      invoiceNumber: string | null;
      homeownerUserId: string | null;
      jobId: string | null;
    };
    providerName: string;
    amount: number;
    clientEmail: string | null;
  }): Promise<void> {
    let homeownerUserId = args.invoice.homeownerUserId ?? null;
    if (!homeownerUserId && args.clientEmail) {
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, args.clientEmail))
        .limit(1)
        .catch((): { id: string }[] => []);
      const u = rows[0];
      if (u?.id) homeownerUserId = u.id;
    }
    if (!homeownerUserId) return;

    let appointmentId: string | null = null;
    if (args.invoice.jobId) {
      const rows = await db
        .select({ appointmentId: jobs.appointmentId })
        .from(jobs)
        .where(eq(jobs.id, args.invoice.jobId))
        .limit(1)
        .catch((): { appointmentId: string | null }[] => []);
      const j = rows[0];
      if (j?.appointmentId) appointmentId = j.appointmentId;
    }

    const title = `Payment reminder from ${args.providerName}`;
    const body = `Invoice ${args.invoice.invoiceNumber || args.invoice.id.slice(0, 8)} for $${args.amount.toFixed(2)} is still unpaid. Tap to pay.`;
    const data: Record<string, unknown> = {
      type: "invoice_reminder",
      invoiceId: args.invoice.id,
    };
    if (appointmentId) {
      data.screen = "AppointmentDetail";
      data.params = { appointmentId };
      data.appointmentId = appointmentId;
    }
    await dispatchNotification(
      homeownerUserId,
      title,
      body,
      "invoice_reminder",
      data,
      "invoices",
    );
  }

  // Create and immediately send invoice (one-step flow)
  app.post(
    "/api/invoices/create-and-send",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { providerId: bodyProviderId } = req.body;
        if (!bodyProviderId)
          return res.status(400).json({ error: "providerId is required" });
        if (!(await assertProviderOwnership(req, bodyProviderId, res))) return;
        if (!(await checkSubscriptionGate(bodyProviderId, res))) return;
        const authProviderRecord = await storage.getProvider(bodyProviderId);

        const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        // Accept line items from frontend or fall back to single amount
        const lineItemsInput: any[] = Array.isArray(req.body.lineItems)
          ? req.body.lineItems
          : [];
        let amount: number;
        let lineItems: any[];

        if (lineItemsInput.length > 0) {
          lineItems = lineItemsInput.map((item: any) => ({
            description: item.description || "Service",
            quantity: parseFloat(item.quantity) || 1,
            unitPrice: parseFloat(item.unitPrice) || 0,
            total:
              (parseFloat(item.quantity) || 1) *
              (parseFloat(item.unitPrice) || 0),
          }));
          amount = lineItems.reduce(
            (sum: number, item: any) => sum + item.total,
            0,
          );
        } else {
          amount = parseFloat(req.body.amount) || 0;
          lineItems = [
            {
              description: req.body.notes || "Service",
              quantity: 1,
              unitPrice: amount,
              total: amount,
            },
          ];
        }

        const subtotalCents = Math.round(amount * 100);
        if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) {
          return res.status(400).json({
            error: "Invoice total must be greater than zero.",
          });
        }
        // Compute platform fee so the eventual Connect destination charge
        // / Stripe Invoice carries the right application_fee (Task #150).
        const sendPlan = await getProviderPlan(bodyProviderId);
        const sendFee = calculatePlatformFee(
          subtotalCents,
          sendPlan.platformFeePercent || "3.00",
          sendPlan.platformFeeFixedCents || 0,
        );
        const invoiceData = {
          providerId: bodyProviderId,
          clientId: req.body.clientId,
          jobId: req.body.jobId || null,
          invoiceNumber,
          currency: "usd",
          subtotalCents,
          taxCents: 0,
          discountCents: 0,
          platformFeeCents: sendFee.totalCents,
          totalCents: subtotalCents,
          amount: amount.toFixed(2),
          total: amount.toFixed(2),
          lineItems: JSON.stringify(lineItems),
          notes: req.body.notes || null,
          // Inserted as draft FIRST (Task #245). Promoted to "sent" only
          // after Stripe successfully creates+finalizes the hosted
          // invoice. If sendStripeInvoiceEmail throws stripe_not_ready,
          // the row stays draft and the route returns 409 — the
          // homeowner is never billed and the provider sees a clear
          // error instead of a fake "sent" state.
          status: "draft",
          dueDate: req.body.dueDate
            ? new Date(req.body.dueDate)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        };

        const parsed = insertInvoiceSchema.safeParse(invoiceData);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "Invalid input", details: parsed.error.issues });
        }

        const invoice = await storage.createInvoice(parsed.data);

        // Send proper Stripe Invoice — Stripe emails the client at invoice.stripe.com
        // FAIL CLOSED on stripe_not_ready (Task #245): if the provider's
        // Connect account isn't ready, refuse the entire request rather
        // than persisting "sent" state with no actual Stripe Invoice
        // behind it. The invoice row was created above as "draft", so
        // the homeowner is never billed for nothing.
        let hostedUrl: string | undefined;
        let stripeError: string | undefined;
        let stripeErrorCode: string | undefined;
        const platformResult = await sendStripeInvoiceEmail(
          invoice.id,
        ).catch((err: any) => {
          stripeError = err?.message || "Stripe invoice send failed";
          stripeErrorCode = err?.code;
          console.error("[stripe-invoice-send] create-and-send:", stripeError);
          return null;
        });
        if (stripeErrorCode === "stripe_not_ready") {
          return res.status(409).json({
            code: "stripe_not_ready",
            error:
              "Provider Stripe Connect account is not ready to accept charges. Finish onboarding before sending invoices.",
            invoiceId: invoice.id,
          });
        }
        if (platformResult?.hostedInvoiceUrl)
          hostedUrl = platformResult.hostedInvoiceUrl;

        // Send email via dispatcher
        let emailSent = false;
        let emailError: string | undefined;

        if (invoice.clientId) {
          const client = await storage.getClient(invoice.clientId);
          const provider = await storage.getProvider(invoice.providerId);

          if (client?.email && provider) {
            const clientName =
              [client.firstName, client.lastName].filter(Boolean).join(" ") ||
              "Client";

            const sendResult = await dispatchWithResult("invoice.sent", {
              clientEmail: client.email,
              clientName,
              providerName:
                provider.businessName || provider.userId || "Service Provider",
              invoiceNumber: invoice.invoiceNumber || invoiceNumber,
              amount,
              dueDate: invoice.dueDate
                ? new Date(invoice.dueDate).toLocaleDateString()
                : "Due on receipt",
              lineItems: lineItems.map((item: any) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
              })),
              paymentLink: hostedUrl,
              relatedRecordType: "invoice",
              relatedRecordId: invoice.id,
            });
            emailSent = sendResult.emailSent;
            emailError = sendResult.emailError;

            // Push + in-app notification to the homeowner (Task #230).
            // Use the invoice's linked homeownerUserId when available — more
            // reliable than matching client.email → users.email — and fall
            // back to the email lookup for legacy clients without a link.
            notifyHomeownerInvoiceSent({
              invoice,
              providerName: provider.businessName || "Your Provider",
              amount,
              clientEmail: client?.email ?? null,
            }).catch((e) =>
              console.error("[invoice.sent] homeowner notify failed:", e),
            );
          } else if (!client?.email) {
            emailError = "Client has no email address on file.";
          }
        }

        // Promote draft → sent ONLY when Stripe actually produced a
        // hosted invoice URL (Task #245, architect comment). Any other
        // failure mode — transient Stripe outage, network blip, etc. —
        // leaves the invoice in `draft` so it can be retried without
        // creating a "sent" row that has no hosted URL behind it.
        let promoted = invoice;
        if (hostedUrl && !stripeError) {
          const [updated] = await db
            .update(invoices)
            .set({
              status: "sent",
              sentAt: new Date(),
              hostedInvoiceUrl: hostedUrl,
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, invoice.id))
            .returning();
          if (updated) promoted = updated;
        }

        res.status(201).json({
          invoice: promoted,
          emailSent,
          emailError,
          stripeError,
        });
      } catch (error) {
        console.error("Create and send invoice error:", error);
        res.status(500).json({ error: "Failed to create invoice" });
      }
    },
  );

  app.put(
    "/api/invoices/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const existing = await storage.getInvoice(req.params.id);
        if (!existing) {
          return res.status(404).json({ error: "Invoice not found" });
        }
        // Ownership: only the issuing provider may update the invoice
        if (!(await assertProviderOwnership(req, existing.providerId, res)))
          return;

        // Validate update payload — only allow known mutable fields
        const allowedFields = [
          "status",
          "notes",
          "dueDate",
          "lineItems",
          "amount",
          "total",
          "subtotalCents",
          "taxCents",
          "discountCents",
          "totalCents",
          "paymentMethodsAllowed",
        ] as const;
        const update: Record<string, unknown> = {};
        for (const field of allowedFields) {
          if (req.body[field] !== undefined) update[field] = req.body[field];
        }
        if (Object.keys(update).length === 0) {
          return res
            .status(400)
            .json({ error: "No valid fields provided for update" });
        }

        const invoice = await storage.updateInvoice(req.params.id, update);
        if (!invoice) {
          return res.status(404).json({ error: "Invoice not found" });
        }
        res.json({ invoice });
      } catch (error) {
        console.error("Update invoice error:", error);
        res.status(500).json({ error: "Failed to update invoice" });
      }
    },
  );

  app.post(
    "/api/invoices/:id/send",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const invoiceId = req.params.id;
        const authUserId = req.authenticatedUserId!;

        // Get the invoice first
        const invoice = await storage.getInvoice(invoiceId);
        if (!invoice) {
          return res.status(404).json({ error: "Invoice not found" });
        }

        // Verify the authenticated user owns this invoice's provider account
        const authProviderRecord =
          await storage.getProviderByUserId(authUserId);
        if (
          !authProviderRecord ||
          invoice.providerId !== authProviderRecord.id
        ) {
          return res.status(403).json({
            error:
              "Access denied: you can only send invoices for your own provider account",
          });
        }

        // Send a proper Stripe Invoice — Stripe emails the client at invoice.stripe.com.
        // Always route through sendStripeInvoiceEmail so the idempotency guard in
        // createStripeInvoice can detect and replace any stale $0 Stripe invoice
        // created under the old unit_amount bug. The function is fully idempotent:
        // it returns an existing valid invoice (total > 0) unchanged, recreates only
        // corrupt $0 ones, and always emails the client the correct amount.
        let hostedUrl: string | undefined;
        let stripeError: string | undefined;

        // FAIL CLOSED on stripe_not_ready (Task #245). We must never
        // mark this invoice as `sent` when the provider's Connect
        // account is not ready. Mirror the behavior already added to
        // POST /api/stripe/invoices/:invoiceId/send.
        let stripeErrorCode: string | undefined;
        const platformResult = await sendStripeInvoiceEmail(
          invoiceId,
        ).catch((err: any) => {
          stripeError = err?.message || "Stripe invoice send failed";
          stripeErrorCode = err?.code;
          console.error("[stripe-invoice-send] platform:", stripeError);
          return null;
        });
        if (platformResult?.hostedInvoiceUrl)
          hostedUrl = platformResult.hostedInvoiceUrl;
        else if (!hostedUrl)
          hostedUrl = invoice.hostedInvoiceUrl || undefined;
        if (stripeErrorCode === "stripe_not_ready") {
          return res.status(409).json({
            code: "stripe_not_ready",
            error:
              "Provider Stripe Connect account is not ready to accept charges. Finish onboarding before sending invoices.",
            invoiceId,
          });
        }

        // Get client and provider details for email
        let emailSent = false;
        let emailError: string | undefined;

        if (invoice.clientId) {
          const client = await storage.getClient(invoice.clientId);
          const provider = await storage.getProvider(invoice.providerId);

          if (client?.email && provider) {
            const rawLineItems = invoice.lineItems;
            const lineItems = Array.isArray(rawLineItems)
              ? rawLineItems
              : typeof rawLineItems === "string"
                ? JSON.parse(rawLineItems)
                : [];
            const clientName =
              [client.firstName, client.lastName].filter(Boolean).join(" ") ||
              "Client";

            const sendResult = await dispatchWithResult("invoice.sent", {
              clientEmail: client.email,
              clientName,
              providerName:
                provider.businessName || provider.userId || "Service Provider",
              invoiceNumber:
                invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`,
              amount: parseFloat(invoice.total?.toString() || "0"),
              dueDate: invoice.dueDate
                ? new Date(invoice.dueDate).toLocaleDateString()
                : "Due on receipt",
              lineItems: lineItems.map((item: any) => ({
                description: item.description || item.name || "Service",
                quantity: item.quantity || 1,
                unitPrice: parseFloat(
                  item.unitPrice?.toString() || item.price?.toString() || "0",
                ),
                total: parseFloat(item.total?.toString() || "0"),
              })),
              paymentLink: hostedUrl,
              relatedRecordType: "invoice",
              relatedRecordId: invoice.id,
            });
            emailSent = sendResult.emailSent;
            emailError = sendResult.emailError;

            // Push + in-app notification to the homeowner (Task #230).
            const invoiceTotal = parseFloat(invoice.total?.toString() || "0");
            notifyHomeownerInvoiceSent({
              invoice,
              providerName: provider.businessName || "Your Provider",
              amount: invoiceTotal,
              clientEmail: client?.email ?? null,
            }).catch((e) =>
              console.error("[invoice.sent] homeowner notify failed:", e),
            );
          }
        }

        // Update invoice status to sent and persist hostedInvoiceUrl if generated
        const [updatedInvoice] = await db
          .update(invoices)
          .set({
            status: "sent",
            sentAt: new Date(),
            ...(hostedUrl ? { hostedInvoiceUrl: hostedUrl } : {}),
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoiceId))
          .returning();

        res.json({
          invoice: updatedInvoice,
          paymentUrl: hostedUrl,
          emailSent,
          emailError,
          stripeError,
        });
      } catch (error) {
        console.error("Send invoice error:", error);
        res.status(500).json({ error: "Failed to send invoice" });
      }
    },
  );

  app.post(
    "/api/invoices/:id/mark-paid",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const { providerId } = req.body;
        if (!providerId) {
          return res.status(400).json({ error: "providerId is required" });
        }
        const existingInvoice = await storage.getInvoice(req.params.id);
        if (!existingInvoice) {
          return res.status(404).json({ error: "Invoice not found" });
        }
        if (existingInvoice.providerId !== providerId) {
          return res.status(403).json({ error: "Forbidden" });
        }
        if (existingInvoice.status === "paid") {
          return res.json({ invoice: existingInvoice });
        }
        const invoice = await storage.markInvoicePaid(req.params.id);
        res.json({ invoice });

        // First-paid trigger — start the 7-day grace period if this is the
        // provider's first paid invoice. Wrapped to never break invoice payment.
        if (invoice) {
          maybeStartGracePeriod(invoice.providerId).catch((e) =>
            console.error("[subscription] grace start failed:", e),
          );
        }

        // Referral credits — same idempotent call as the Stripe webhook path
        if (invoice?.homeownerUserId) {
          grantReferralCreditsIfFirstBooking(invoice.homeownerUserId).catch(
            (e) => console.error("[referral] mark-paid credits failed:", e),
          );
        }

        // Dispatch paid notification (fire-and-forget)
        if (invoice && invoice.clientId) {
          try {
            const [paidClient, paidProvider] = await Promise.all([
              storage.getClient(invoice.clientId),
              storage.getProvider(invoice.providerId),
            ]);
            if (paidClient?.email && paidProvider) {
              const clientName =
                [paidClient.firstName, paidClient.lastName]
                  .filter(Boolean)
                  .join(" ") || "Client";
              dispatch("invoice.paid", {
                clientEmail: paidClient.email,
                clientName,
                providerName: paidProvider.businessName || "Service Provider",
                invoiceNumber:
                  invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`,
                amount: parseFloat(invoice.total?.toString() || "0"),
                paymentDate: new Date().toLocaleDateString(),
                relatedRecordType: "invoice",
                relatedRecordId: invoice.id,
                recipientUserId: paidClient.homeownerUserId ?? undefined,
              });
            }
          } catch (_) {}
        }
      } catch (error) {
        console.error("Mark invoice paid error:", error);
        res.status(500).json({ error: "Failed to mark invoice as paid" });
      }
    },
  );

  // ── Task #295: Manual (cash/check/other) payment recording ────────────
  //
  // Photo proof is sent as a base64 data URI (same shape as the user
  // avatar / job photo endpoints). Files land in the existing `job-photos`
  // Supabase bucket under `payment-receipts/`.
  async function uploadPaymentPhoto(
    dataUri: string,
    invoiceId: string,
  ): Promise<string | null> {
    if (!dataUri || !dataUri.startsWith("data:")) return null;
    const match = dataUri.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/);
    if (!match) return null;
    const mimeType = match[1];
    const ext = match[2] === "jpeg" ? "jpg" : match[2];
    const buffer = Buffer.from(match[3], "base64");
    const MAX_BYTES = 5 * 1024 * 1024;
    if (buffer.length > MAX_BYTES) {
      throw new Error("Photo is too large (max 5 MB)");
    }
    let supabaseClient: typeof import("../lib/supabase").supabase | null = null;
    try {
      supabaseClient = (await import("../lib/supabase")).supabase;
    } catch {}
    const filename = `payment-receipts/inv-${invoiceId}-${Date.now()}.${ext}`;
    if (supabaseClient) {
      const { error: upErr } = await supabaseClient.storage
        .from("job-photos")
        .upload(filename, buffer, { contentType: mimeType, upsert: false });
      if (upErr) {
        console.error("Payment photo upload error:", upErr);
        throw new Error("Failed to upload payment photo");
      }
      const { data } = supabaseClient.storage
        .from("job-photos")
        .getPublicUrl(filename);
      return data.publicUrl;
    }
    if (process.env.NODE_ENV === "development") {
      const dir = path.resolve(process.cwd(), "uploads", "payment-receipts");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const base = path.basename(filename);
      fs.writeFileSync(path.join(dir, base), buffer);
      return `/uploads/payment-receipts/${base}`;
    }
    return null;
  }

  // List payments for an invoice (provider or homeowner of the invoice).
  app.get(
    "/api/invoices/:id/payments",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const inv = await assertInvoiceAccess(req, req.params.id, res);
        if (!inv) return;
        const list = await storage.getPaymentsByInvoice(req.params.id);
        res.json({ payments: list });
      } catch (error) {
        console.error("List invoice payments error:", error);
        res.status(500).json({ error: "Failed to load payments" });
      }
    },
  );

  // Record a manual (non-Stripe) payment against an invoice.
  // Body: { amountCents, method, receivedAt?, reference?, notes?, photoDataUri? }
  app.post(
    "/api/invoices/:id/payments",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const invoice = await storage.getInvoice(req.params.id);
        if (!invoice) {
          return res.status(404).json({ error: "Invoice not found" });
        }
        if (!(await assertProviderOwnership(req, invoice.providerId, res))) return;
        if (invoice.status === "cancelled" || invoice.status === "void") {
          return res
            .status(400)
            .json({ error: "Cannot record a payment on a closed invoice" });
        }

        const {
          amountCents,
          method,
          receivedAt,
          reference,
          notes,
          photoDataUri,
        } = req.body ?? {};

        const cents = Number(amountCents);
        if (!Number.isFinite(cents) || cents <= 0) {
          return res
            .status(400)
            .json({ error: "amountCents must be a positive number" });
        }
        const allowedMethods = ["cash", "check", "card", "bank_transfer", "other"];
        if (!allowedMethods.includes(method)) {
          return res.status(400).json({
            error: `method must be one of ${allowedMethods.join(", ")}`,
          });
        }

        let photoUrl: string | null = null;
        if (photoDataUri) {
          try {
            photoUrl = await uploadPaymentPhoto(photoDataUri, invoice.id);
          } catch (e: any) {
            return res
              .status(400)
              .json({ error: e?.message || "Failed to upload photo" });
          }
        }

        const payment = await storage.createManualPayment({
          invoiceId: invoice.id,
          providerId: invoice.providerId,
          amountCents: Math.round(cents),
          amount: (cents / 100).toFixed(2),
          method,
          status: "succeeded",
          reference: reference || null,
          notes: notes || null,
          photoUrl,
          receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
          createdBy: req.authenticatedUserId ?? null,
        } as any);

        const updatedInvoice = await storage.getInvoice(invoice.id);
        res.status(201).json({ payment, invoice: updatedInvoice });

        // Referral credits — fire if recording this payment caused the invoice
        // to flip to "paid" (storage may auto-mark it based on total collected).
        if (updatedInvoice?.status === "paid" && updatedInvoice.homeownerUserId) {
          grantReferralCreditsIfFirstBooking(updatedInvoice.homeownerUserId).catch(
            (e) => console.error("[referral] manual-payment credits failed:", e),
          );
        }
      } catch (error) {
        console.error("Record manual payment error:", error);
        res.status(500).json({ error: "Failed to record payment" });
      }
    },
  );

  // Edit a manual payment (provider-owned, non-stripe, non-voided).
  app.patch(
    "/api/payments/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const existing = await storage.getPayment(req.params.id);
        if (!existing) {
          return res.status(404).json({ error: "Payment not found" });
        }
        if (!(await assertProviderOwnership(req, existing.providerId, res))) return;
        if (existing.method === "stripe") {
          return res
            .status(400)
            .json({ error: "Stripe payments cannot be edited manually" });
        }
        if (existing.voidedAt) {
          return res
            .status(400)
            .json({ error: "Voided payments cannot be edited" });
        }

        const patch: Record<string, unknown> = {};
        const { amountCents, method, receivedAt, reference, notes, photoDataUri } =
          req.body ?? {};
        if (amountCents !== undefined) {
          const cents = Number(amountCents);
          if (!Number.isFinite(cents) || cents <= 0) {
            return res
              .status(400)
              .json({ error: "amountCents must be a positive number" });
          }
          patch.amountCents = Math.round(cents);
          patch.amount = (cents / 100).toFixed(2);
        }
        if (method !== undefined) {
          const allowed = ["cash", "check", "card", "bank_transfer", "other"];
          if (!allowed.includes(method)) {
            return res.status(400).json({
              error: `method must be one of ${allowed.join(", ")}`,
            });
          }
          patch.method = method;
        }
        if (receivedAt !== undefined) {
          patch.receivedAt = receivedAt ? new Date(receivedAt) : null;
        }
        if (reference !== undefined) patch.reference = reference || null;
        if (notes !== undefined) patch.notes = notes || null;
        if (photoDataUri !== undefined) {
          if (photoDataUri === null || photoDataUri === "") {
            patch.photoUrl = null;
          } else {
            try {
              patch.photoUrl = await uploadPaymentPhoto(
                photoDataUri,
                existing.invoiceId,
              );
            } catch (e: any) {
              return res
                .status(400)
                .json({ error: e?.message || "Failed to upload photo" });
            }
          }
        }

        const payment = await storage.updateManualPayment(existing.id, patch as any);
        const invoice = await storage.getInvoice(existing.invoiceId);
        res.json({ payment, invoice });
      } catch (error) {
        console.error("Edit payment error:", error);
        res.status(500).json({ error: "Failed to update payment" });
      }
    },
  );

  // Void a manual payment. Soft-delete + audit trail.
  app.post(
    "/api/payments/:id/void",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const existing = await storage.getPayment(req.params.id);
        if (!existing) {
          return res.status(404).json({ error: "Payment not found" });
        }
        if (!(await assertProviderOwnership(req, existing.providerId, res))) return;
        if (existing.method === "stripe") {
          return res
            .status(400)
            .json({ error: "Stripe payments must be refunded via Stripe" });
        }
        if (existing.voidedAt) {
          return res.json({ payment: existing });
        }
        const payment = await storage.voidPayment(
          existing.id,
          req.authenticatedUserId!,
        );
        const invoice = await storage.getInvoice(existing.invoiceId);
        res.json({ payment, invoice });
      } catch (error) {
        console.error("Void payment error:", error);
        res.status(500).json({ error: "Failed to void payment" });
      }
    },
  );

  // List a provider's manual payments (excludes Stripe — those show up in
  // the Stripe payouts feed). Powers the Financials "Payments" tab.
  app.get(
    "/api/providers/:providerId/manual-payments",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res)))
          return;
        const list = await storage.getManualPayments(req.params.providerId);
        res.json({ payments: list });
      } catch (error) {
        console.error("List manual payments error:", error);
        res.status(500).json({ error: "Failed to load payments" });
      }
    },
  );

  app.post(
    "/api/invoices/:id/cancel",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const existing = await storage.getInvoice(req.params.id);
        if (!existing) {
          return res.status(404).json({ error: "Invoice not found" });
        }
        if (!(await assertProviderOwnership(req, existing.providerId, res)))
          return;

        // Cancel in our DB first
        const invoice = await storage.cancelInvoice(req.params.id);
        if (!invoice) {
          return res.status(404).json({ error: "Invoice not found" });
        }

        // Mirror cancellation to Stripe if a Stripe invoice exists
        if (existing.stripeInvoiceId) {
          try {
            const connectAccount = await getConnectAccount(existing.providerId);
            if (connectAccount?.stripeAccountId) {
              const stripeInv = await getStripe().invoices.retrieve(
                existing.stripeInvoiceId,
                { stripeAccount: connectAccount.stripeAccountId },
              );
              if (stripeInv.status === "draft") {
                // Draft invoices can be hard-deleted
                await getStripe().invoices.del(existing.stripeInvoiceId, {
                  stripeAccount: connectAccount.stripeAccountId,
                });
              } else if (stripeInv.status === "open") {
                // Open/sent invoices must be voided
                await getStripe().invoices.voidInvoice(
                  existing.stripeInvoiceId,
                  { stripeAccount: connectAccount.stripeAccountId },
                );
              } else if (stripeInv.status === "paid") {
                // Paid invoices cannot be voided — mark uncollectible instead
                await getStripe().invoices.markUncollectible(
                  existing.stripeInvoiceId,
                  { stripeAccount: connectAccount.stripeAccountId },
                );
              }
              // void / uncollectible / deleted → already cancelled, nothing to do
            }
          } catch (stripeErr: any) {
            // Log but don't fail the request — our DB cancel already succeeded
            console.error(
              "[invoice-cancel] Stripe sync failed:",
              stripeErr?.message,
            );
          }
        }

        res.json({ invoice });
      } catch (error) {
        console.error("Cancel invoice error:", error);
        res.status(500).json({ error: "Failed to cancel invoice" });
      }
    },
  );

  // Send a payment reminder email for an existing invoice
  app.post(
    "/api/invoices/:id/remind",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const invoiceId = req.params.id;
        const authUserId = req.authenticatedUserId!;

        const invoice = await storage.getInvoice(invoiceId);
        if (!invoice)
          return res.status(404).json({ error: "Invoice not found" });

        const authProvider = await storage.getProviderByUserId(authUserId);
        if (!authProvider || invoice.providerId !== authProvider.id) {
          return res.status(403).json({ error: "Access denied" });
        }

        if (!invoice.clientId) {
          return res
            .status(400)
            .json({ error: "No client associated with this invoice" });
        }

        const client = await storage.getClient(invoice.clientId);
        if (!client?.email) {
          return res
            .status(400)
            .json({ error: "No email address on file for this client" });
        }

        const provider = await storage.getProvider(invoice.providerId);
        const clientName =
          [client.firstName, client.lastName].filter(Boolean).join(" ") ||
          "Client";
        const providerName = provider?.businessName || "Your Service Provider";

        const now = new Date();
        const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
        const diffMs = dueDate ? dueDate.getTime() - now.getTime() : 0;
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        // Use existing Stripe invoice URL for reminder, or generate one now
        let reminderPaymentLink: string | undefined =
          invoice.hostedInvoiceUrl || undefined;
        if (!reminderPaymentLink) {
          const platformResult = await sendStripeInvoiceEmail(
            invoiceId,
          ).catch(() => null);
          if (platformResult?.hostedInvoiceUrl)
            reminderPaymentLink = platformResult.hostedInvoiceUrl;
        }

        await sendInvoiceReminderEmail({
          clientEmail: client.email,
          clientName,
          providerName,
          invoiceNumber:
            invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`,
          amount: parseFloat(invoice.total?.toString() || "0"),
          dueDate: dueDate
            ? dueDate.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : "Due on receipt",
          daysUntilDue: diffDays > 0 ? diffDays : undefined,
          daysOverdue: diffDays < 0 ? Math.abs(diffDays) : undefined,
          paymentLink: reminderPaymentLink,
        });

        // Task #235: also fire a push + in-app notification to the homeowner
        // so the reminder shows up in the app, not just email.
        notifyHomeownerInvoiceReminder({
          invoice: {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            homeownerUserId: invoice.homeownerUserId,
            jobId: invoice.jobId,
          },
          providerName,
          amount: parseFloat(invoice.total?.toString() || "0"),
          clientEmail: client.email,
        }).catch((e) =>
          console.error("[invoice.reminder] homeowner notify failed:", e),
        );

        res.json({ sent: true });
      } catch (error) {
        console.error("Invoice remind error:", error);
        res.status(500).json({ error: "Failed to send reminder" });
      }
    },
  );

  app.post(
    "/api/invoices/:id/payment-link",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const invoiceId = req.params.id;
        const authUserId = req.authenticatedUserId!;

        const invoice = await storage.getInvoice(invoiceId);
        if (!invoice)
          return res.status(404).json({ error: "Invoice not found" });

        // Task #230: allow the homeowner who owns this invoice to fetch the
        // hosted payment URL too — same Stripe link the provider sees. This
        // backs the Pay button on the homeowner Job/Appointment screens.
        const authProvider = await storage.getProviderByUserId(authUserId);
        const isProvider =
          !!authProvider && invoice.providerId === authProvider.id;
        let isHomeowner = invoice.homeownerUserId === authUserId;

        // Legacy resolution (Task #230): if invoice.homeownerUserId is null,
        // resolve via the linked client (provider's CRM record cached
        // homeowner) or the linked job → appointment homeowner. Opportunistically
        // backfill invoices.homeownerUserId so future calls hit the fast path.
        if (!isProvider && !isHomeowner && !invoice.homeownerUserId) {
          let resolvedHomeownerId: string | null = null;
          if (invoice.clientId) {
            const [c] = await db
              .select({ homeownerUserId: clients.homeownerUserId })
              .from(clients)
              .where(eq(clients.id, invoice.clientId))
              .limit(1);
            if (c?.homeownerUserId) resolvedHomeownerId = c.homeownerUserId;
          }
          if (!resolvedHomeownerId && invoice.jobId) {
            const [j] = await db
              .select({ appointmentId: jobs.appointmentId })
              .from(jobs)
              .where(eq(jobs.id, invoice.jobId))
              .limit(1);
            if (j?.appointmentId) {
              const [a] = await db
                .select({ userId: appointments.userId })
                .from(appointments)
                .where(eq(appointments.id, j.appointmentId))
                .limit(1);
              if (a?.userId) resolvedHomeownerId = a.userId;
            }
          }
          if (resolvedHomeownerId === authUserId) {
            isHomeowner = true;
            try {
              await db
                .update(invoices)
                .set({ homeownerUserId: authUserId })
                .where(eq(invoices.id, invoiceId));
            } catch (err) {
              // Backfill is best-effort — don't block the payment link.
              console.warn(
                "[payment-link] homeowner backfill failed:",
                (err as Error)?.message,
              );
            }
          }
        }

        if (!isProvider && !isHomeowner) {
          return res.status(403).json({ error: "Access denied" });
        }

        let checkoutUrl: string | undefined;
        let method: "stripe_invoice" | "checkout_session" | "existing" =
          "checkout_session";

        // Return existing URL if already generated
        if (invoice.hostedInvoiceUrl) {
          checkoutUrl = invoice.hostedInvoiceUrl;
          method = "existing";
        } else {
          // Send a proper Stripe Invoice (platform account — no Connect required)
          const result = await sendStripeInvoiceEmail(invoiceId);
          checkoutUrl = result.hostedInvoiceUrl;
          method = "stripe_invoice";
        }

        res.json({ url: checkoutUrl, method });
      } catch (error: any) {
        console.error("Generate payment link error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to generate payment link" });
      }
    },
  );

  // ============ ESTIMATES ROUTES (Task #296) ============
  // Estimates mirror the invoice CRUD shape but never touch Stripe.
  // Lifecycle: draft → sent → viewed (when public viewer is opened) →
  // accepted | declined | expired. Once accepted, the provider may
  // POST /api/estimates/:id/convert to spawn a real invoice.

  // Build a normalized line-item array from a free-form request body.
  function normalizeEstimateLineItems(input: any[]): {
    items: { name: string; description: string | null; quantity: number; unitPriceCents: number; amountCents: number }[];
    subtotalCents: number;
  } {
    const items = (Array.isArray(input) ? input : []).map((raw: any) => {
      const name = String(raw.name || raw.description || "Service").slice(0, 200);
      const description = raw.description ? String(raw.description) : null;
      const qty = Number(raw.quantity) || 1;
      const unitPrice = Number(raw.unitPrice) || 0;
      const unitPriceCents = Math.round(unitPrice * 100);
      const amountCents = Math.round(qty * unitPriceCents);
      return { name, description, quantity: qty, unitPriceCents, amountCents };
    });
    const subtotalCents = items.reduce((s, it) => s + it.amountCents, 0);
    return { items, subtotalCents };
  }

  function generateEstimateToken(): string {
    // 32 random bytes → 43-char base64url. Public viewer URL is
    // /estimates/<token>, so unguessability is the only protection.
    const { randomBytes } = require("crypto");
    return randomBytes(32)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  function publicEstimateUrl(req: Request, token: string): string {
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const host = req.headers.host;
    return `${proto}://${host}/estimates/${token}`;
  }

  // List estimates for a provider
  app.get(
    "/api/provider/:providerId/estimates",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res))) return;
        const rows = await storage.getEstimates(req.params.providerId);
        res.json({ estimates: rows });
      } catch (error) {
        console.error("Get estimates error:", error);
        res.status(500).json({ error: "Failed to get estimates" });
      }
    },
  );

  // List estimates for a single client (used by ClientDetail)
  app.get(
    "/api/clients/:clientId/estimates",
    requireAuth,
    async (req: Request<{ clientId: string }>, res: Response) => {
      try {
        const client = await storage.getClient(req.params.clientId);
        if (!client) return res.status(404).json({ error: "Client not found" });
        if (!(await assertProviderOwnership(req, client.providerId, res))) return;
        const rows = await storage.getEstimatesByClient(req.params.clientId);
        res.json({ estimates: rows });
      } catch (error) {
        console.error("Get client estimates error:", error);
        res.status(500).json({ error: "Failed to get estimates" });
      }
    },
  );

  // Next estimate number — provider-scoped sequence
  app.get(
    "/api/provider/:providerId/next-estimate-number",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res))) return;
        const estimateNumber = await storage.getNextEstimateNumber(req.params.providerId);
        res.json({ estimateNumber });
      } catch (error) {
        console.error("Get next estimate number error:", error);
        res.status(500).json({ error: "Failed to get estimate number" });
      }
    },
  );

  // Get a single estimate (provider or homeowner with the same auth model
  // as invoices). Includes normalized line items.
  app.get(
    "/api/estimates/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;
        const estimate = await storage.getEstimate(req.params.id);
        if (!estimate) return res.status(404).json({ error: "Estimate not found" });
        const providerRecord = await storage.getProviderByUserId(authUserId);
        const isProvider = providerRecord && estimate.providerId === providerRecord.id;
        const isHomeowner = estimate.homeownerUserId === authUserId;
        if (!isProvider && !isHomeowner) {
          return res.status(403).json({ error: "Access denied" });
        }
        const lineItems = await storage.getEstimateLineItems(estimate.id);
        res.json({ estimate, lineItems });
      } catch (error) {
        console.error("Get estimate error:", error);
        res.status(500).json({ error: "Failed to get estimate" });
      }
    },
  );

  // Create estimate (draft). Stripe is NEVER touched.
  app.post(
    "/api/estimates",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const providerId: string | undefined = req.body.providerId;
        if (!providerId) return res.status(400).json({ error: "providerId is required" });
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        if (!(await checkSubscriptionGate(providerId, res))) return;

        const estimateNumber: string =
          req.body.estimateNumber || (await storage.getNextEstimateNumber(providerId));
        const { items, subtotalCents } = normalizeEstimateLineItems(req.body.lineItems);

        const data = {
          providerId,
          clientId: req.body.clientId || null,
          homeownerUserId: req.body.homeownerUserId || null,
          jobId: req.body.jobId || null,
          estimateNumber,
          currency: "usd",
          subtotalCents,
          taxCents: 0,
          discountCents: 0,
          totalCents: subtotalCents,
          status: "draft" as const,
          notes: req.body.notes || null,
          expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
        };
        const parsed = insertEstimateSchema.safeParse(data);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
        }
        const created = await storage.createEstimate({
          ...parsed.data,
          publicToken: generateEstimateToken(),
        });
        await storage.replaceEstimateLineItems(created.id, items);
        res.status(201).json({ estimate: created });
      } catch (error) {
        console.error("Create estimate error:", error);
        res.status(500).json({ error: "Failed to create estimate" });
      }
    },
  );

  // Update an estimate (draft or sent only — locked once accepted/declined/converted).
  app.put(
    "/api/estimates/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const existing = await storage.getEstimate(req.params.id);
        if (!existing) return res.status(404).json({ error: "Estimate not found" });
        if (!(await assertProviderOwnership(req, existing.providerId, res))) return;

        const TERMINAL = new Set(["accepted", "declined", "expired", "converted"]);
        if (TERMINAL.has(existing.status as string)) {
          return res.status(409).json({
            error: `Estimate is ${existing.status} and can no longer be edited`,
          });
        }

        const update: Partial<typeof existing> = {};
        if (req.body.notes !== undefined) update.notes = req.body.notes;
        if (req.body.expiresAt !== undefined) {
          update.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
        }
        if (Array.isArray(req.body.lineItems)) {
          const { items, subtotalCents } = normalizeEstimateLineItems(req.body.lineItems);
          update.subtotalCents = subtotalCents;
          update.totalCents = subtotalCents;
          await storage.replaceEstimateLineItems(existing.id, items);
        }
        const updated = await storage.updateEstimate(existing.id, update);
        res.json({ estimate: updated });
      } catch (error) {
        console.error("Update estimate error:", error);
        res.status(500).json({ error: "Failed to update estimate" });
      }
    },
  );

  // Delete a draft estimate.
  app.delete(
    "/api/estimates/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const existing = await storage.getEstimate(req.params.id);
        if (!existing) return res.status(404).json({ error: "Estimate not found" });
        if (!(await assertProviderOwnership(req, existing.providerId, res))) return;
        if (existing.status !== "draft") {
          return res.status(409).json({ error: "Only draft estimates can be deleted" });
        }
        await storage.deleteEstimate(existing.id);
        res.status(204).end();
      } catch (error) {
        console.error("Delete estimate error:", error);
        res.status(500).json({ error: "Failed to delete estimate" });
      }
    },
  );

  // Send estimate — emails the homeowner with the public viewer link.
  app.post(
    "/api/estimates/:id/send",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const existing = await storage.getEstimate(req.params.id);
        if (!existing) return res.status(404).json({ error: "Estimate not found" });
        if (!(await assertProviderOwnership(req, existing.providerId, res))) return;
        if (
          existing.status !== "draft" &&
          existing.status !== "sent" &&
          existing.status !== "viewed"
        ) {
          return res.status(409).json({
            error: `Cannot send estimate in status ${existing.status}`,
          });
        }

        const updated = await storage.updateEstimate(existing.id, {
          status: "sent",
          sentAt: existing.sentAt ?? new Date(),
        });

        // Best-effort email — we don't fail the request if SMTP is unhappy.
        let emailSent = false;
        let emailError: string | undefined;
        try {
          if (existing.clientId) {
            const client = await storage.getClient(existing.clientId);
            const provider = await storage.getProvider(existing.providerId);
            if (client?.email && provider) {
              const lineItems = await storage.getEstimateLineItems(existing.id);
              const result = await dispatchWithResult("estimate.sent", {
                clientEmail: client.email,
                clientName: [client.firstName, client.lastName].filter(Boolean).join(" ") || "Client",
                providerName: provider.businessName || "Service Provider",
                invoiceNumber: existing.estimateNumber, // reused field
                amount: (existing.totalCents ?? 0) / 100,
                dueDate: existing.expiresAt
                  ? new Date(existing.expiresAt).toLocaleDateString()
                  : undefined,
                lineItems: lineItems.map((li) => ({
                  description: li.name,
                  quantity: Number(li.quantity ?? 1),
                  unitPrice: (li.unitPriceCents ?? 0) / 100,
                  total: (li.amountCents ?? 0) / 100,
                })),
                paymentLink: publicEstimateUrl(req, existing.publicToken),
                relatedRecordType: "estimate",
                relatedRecordId: existing.id,
              });
              emailSent = result.emailSent;
              emailError = result.emailError;
            }
          }
        } catch (e: any) {
          emailError = e?.message || "Failed to send estimate email";
        }

        res.json({
          estimate: updated,
          viewerUrl: publicEstimateUrl(req, existing.publicToken),
          emailSent,
          emailError,
        });
      } catch (error) {
        console.error("Send estimate error:", error);
        res.status(500).json({ error: "Failed to send estimate" });
      }
    },
  );

  // Public estimate JSON (used by the SSR viewer page).
  app.get(
    "/api/estimates/public/:token",
    async (req: Request<{ token: string }>, res: Response) => {
      try {
        const estimate = await storage.getEstimateByPublicToken(req.params.token);
        if (!estimate) return res.status(404).json({ error: "Estimate not found" });
        // Mark as viewed the first time someone opens it (only if currently sent).
        if (estimate.status === "sent") {
          await storage.updateEstimate(estimate.id, {
            status: "viewed",
            viewedAt: new Date(),
          });
        }
        const lineItems = await storage.getEstimateLineItems(estimate.id);
        const provider = await storage.getProvider(estimate.providerId);
        res.json({
          estimate,
          lineItems,
          providerName: provider?.businessName || "Service Provider",
        });
      } catch (error) {
        console.error("Public estimate fetch error:", error);
        res.status(500).json({ error: "Failed to load estimate" });
      }
    },
  );

  // Public accept/decline (called from the SSR viewer page; no auth).
  app.post(
    "/api/estimates/public/:token/decision",
    async (req: Request<{ token: string }>, res: Response) => {
      try {
        const decision = String(req.body.decision || "");
        if (decision !== "accepted" && decision !== "declined") {
          return res.status(400).json({ error: "decision must be 'accepted' or 'declined'" });
        }
        const estimate = await storage.getEstimateByPublicToken(req.params.token);
        if (!estimate) return res.status(404).json({ error: "Estimate not found" });
        if (
          estimate.status === "accepted" ||
          estimate.status === "declined" ||
          estimate.status === "converted"
        ) {
          return res.status(409).json({ error: `Estimate already ${estimate.status}` });
        }
        if (estimate.expiresAt && new Date(estimate.expiresAt) < new Date()) {
          await storage.updateEstimate(estimate.id, {
            status: "expired",
            decidedAt: new Date(),
          });
          return res.status(410).json({ error: "Estimate has expired" });
        }

        const lineItems = await storage.getEstimateLineItems(estimate.id);
        const updated = await storage.updateEstimate(estimate.id, {
          status: decision,
          decidedAt: new Date(),
          acceptedSnapshot: JSON.stringify({
            lineItems,
            totalCents: estimate.totalCents,
          }),
        });

        // Notify the provider asynchronously.
        try {
          const provider = await storage.getProvider(estimate.providerId);
          const providerUser = provider ? await storage.getUser(provider.userId) : null;
          const client = estimate.clientId ? await storage.getClient(estimate.clientId) : null;
          if (providerUser?.email) {
            dispatch(decision === "accepted" ? "estimate.accepted" : "estimate.declined", {
              providerEmail: providerUser.email,
              providerName: provider?.businessName || "there",
              clientName: client
                ? [client.firstName, client.lastName].filter(Boolean).join(" ") || "Your client"
                : "Your client",
              invoiceNumber: estimate.estimateNumber,
              amount: (estimate.totalCents ?? 0) / 100,
              relatedRecordType: "estimate",
              relatedRecordId: estimate.id,
            }).catch((e) => console.error("estimate decision dispatch:", e));

            // In-app + push for the provider, surfaced in the Notifications tab.
            if (provider) {
              dispatchNotification(
                provider.userId,
                decision === "accepted" ? "Estimate accepted" : "Estimate declined",
                `${client ? [client.firstName, client.lastName].filter(Boolean).join(" ") || "A client" : "A client"} ${decision} estimate ${estimate.estimateNumber}.`,
                decision === "accepted" ? "estimate_accepted" : "estimate_declined",
                { type: decision === "accepted" ? "estimate_accepted" : "estimate_declined", estimateId: estimate.id, screen: "EstimateDetail", params: { estimateId: estimate.id } },
                "invoices",
              ).catch((e) => console.error("estimate notification:", e));
            }
          }
        } catch (e) {
          console.error("Estimate decision side-effects failed:", e);
        }

        res.json({ estimate: updated });
      } catch (error) {
        console.error("Estimate decision error:", error);
        res.status(500).json({ error: "Failed to record decision" });
      }
    },
  );

  // Convert an accepted estimate into a real invoice. Stripe is still NOT
  // touched here — the resulting invoice is a regular draft that the
  // provider can then send through the existing invoice flow (which IS
  // backed by Stripe).
  app.post(
    "/api/estimates/:id/convert",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const existing = await storage.getEstimate(req.params.id);
        if (!existing) return res.status(404).json({ error: "Estimate not found" });
        if (!(await assertProviderOwnership(req, existing.providerId, res))) return;
        if (existing.status !== "accepted") {
          return res.status(409).json({
            error: "Only accepted estimates can be converted to an invoice",
          });
        }
        if (existing.convertedInvoiceId) {
          const invoice = await storage.getInvoice(existing.convertedInvoiceId);
          return res.json({ invoice, estimate: existing });
        }

        const lineItems = await storage.getEstimateLineItems(existing.id);
        const lineItemsJson = JSON.stringify(
          lineItems.map((li) => ({
            description: li.name,
            quantity: Number(li.quantity ?? 1),
            unitPrice: (li.unitPriceCents ?? 0) / 100,
            total: (li.amountCents ?? 0) / 100,
          })),
        );

        const subtotalCents = existing.totalCents ?? 0;
        const plan = await getProviderPlan(existing.providerId);
        const fee = calculatePlatformFee(
          subtotalCents,
          plan.platformFeePercent || "3.00",
          plan.platformFeeFixedCents || 0,
        );
        const invoiceNumber = await storage.getNextInvoiceNumber(existing.providerId);
        const invoice = await storage.createInvoice({
          providerId: existing.providerId,
          clientId: existing.clientId,
          homeownerUserId: existing.homeownerUserId,
          jobId: existing.jobId,
          invoiceNumber,
          currency: "usd",
          subtotalCents,
          taxCents: 0,
          discountCents: 0,
          platformFeeCents: fee.totalCents,
          totalCents: subtotalCents,
          amount: (subtotalCents / 100).toFixed(2),
          total: (subtotalCents / 100).toFixed(2),
          status: "draft",
          notes: existing.notes,
          lineItems: lineItemsJson,
        } as any);

        // Link both directions and flip the estimate to converted.
        await db
          .update(invoices)
          .set({ estimateId: existing.id })
          .where(eq(invoices.id, invoice.id));
        const updated = await storage.updateEstimate(existing.id, {
          status: "converted",
          convertedAt: new Date(),
          convertedInvoiceId: invoice.id,
        });

        res.status(201).json({ invoice, estimate: updated });
      } catch (error) {
        console.error("Convert estimate error:", error);
        res.status(500).json({ error: "Failed to convert estimate" });
      }
    },
  );

  // ============ PAYMENTS ROUTES ============

  app.get(
    "/api/provider/:providerId/payments",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res)))
          return;
        const payments = await storage.getPayments(req.params.providerId);
        res.json({ payments });
      } catch (error) {
        console.error("Get payments error:", error);
        res.status(500).json({ error: "Failed to get payments" });
      }
    },
  );

  app.post(
    "/api/payments",
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const parsed = insertPaymentSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "Invalid input", details: parsed.error.issues });
        }
        const payment = await storage.createPayment(parsed.data);
        res.status(201).json({ payment });
      } catch (error) {
        console.error("Create payment error:", error);
        res.status(500).json({ error: "Failed to create payment" });
      }
    },
  );

  // Stripe Routes
  app.get("/api/stripe/config", async (req: Request, res: Response) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Get Stripe config error:", error);
      res.status(500).json({ error: "Failed to get Stripe configuration" });
    }
  });

  app.get("/api/stripe/products", async (req: Request, res: Response) => {
    try {
      const result = await db.execute(
        sql`SELECT * FROM stripe.products WHERE active = true`,
      );
      res.json({ products: result.rows });
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({ error: "Failed to get products" });
    }
  });

  app.get(
    "/api/stripe/products-with-prices",
    async (req: Request, res: Response) => {
      try {
        const result = await db.execute(
          sql`
          SELECT 
            p.id as product_id,
            p.name as product_name,
            p.description as product_description,
            p.active as product_active,
            p.metadata as product_metadata,
            pr.id as price_id,
            pr.unit_amount,
            pr.currency,
            pr.recurring,
            pr.active as price_active
          FROM stripe.products p
          LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
          WHERE p.active = true
          ORDER BY p.id, pr.unit_amount
        `,
        );

        const productsMap = new Map();
        for (const row of result.rows as any[]) {
          if (!productsMap.has(row.product_id)) {
            productsMap.set(row.product_id, {
              id: row.product_id,
              name: row.product_name,
              description: row.product_description,
              active: row.product_active,
              metadata: row.product_metadata,
              prices: [],
            });
          }
          if (row.price_id) {
            productsMap.get(row.product_id).prices.push({
              id: row.price_id,
              unit_amount: row.unit_amount,
              currency: row.currency,
              recurring: row.recurring,
              active: row.price_active,
            });
          }
        }

        res.json({ products: Array.from(productsMap.values()) });
      } catch (error) {
        console.error("Get products with prices error:", error);
        res.status(500).json({ error: "Failed to get products" });
      }
    },
  );

  // REMOVED in Task #150 — was an unscoped legacy endpoint that created a
  // platform-account PaymentIntent with no providerId/invoiceId metadata, so
  // funds would have landed on HomeBase's platform account instead of the
  // provider's connected account. Customer-facing payments must go through
  // /api/invoices/:invoiceId/checkout (Connect destination charge) or the
  // homeowner payment-sheet flow.
  app.post(
    "/api/stripe/create-payment-intent",
    requireAuth,
    async (_req: Request, res: Response) => {
      res.status(410).json({
        error: "endpoint_removed",
        message:
          "This endpoint was removed. Use /api/invoices/:invoiceId/checkout for provider invoice payments.",
      });
    },
  );

  app.post(
    "/api/stripe/create-customer",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { email, userId } = req.body;
        if (!email || !userId) {
          return res
            .status(400)
            .json({ error: "Email and userId are required" });
        }
        const customer = await stripeService.createCustomer(email, userId);
        res.json({ customerId: customer.id });
      } catch (error) {
        console.error("Create customer error:", error);
        res.status(500).json({ error: "Failed to create customer" });
      }
    },
  );

  // Apple App Store policy: in-app subscriptions on iOS must use IAP, not
  // Stripe Checkout / Customer Portal. We hard-block iOS clients from these
  // legacy Stripe subscription endpoints based on the X-Client-Platform
  // header (sent by apiRequest in client/lib/query-client.ts).
  function rejectIosSubscriptionFlow(req: Request, res: Response): boolean {
    const platform = String(
      req.headers["x-client-platform"] || "",
    ).toLowerCase();
    if (platform === "ios") {
      res.status(403).json({
        error:
          "Subscriptions on iOS must be purchased through the App Store. Open the Subscription screen in the app to subscribe.",
        code: "ios_use_iap",
      });
      return true;
    }
    return false;
  }

  app.post(
    "/api/stripe/create-checkout-session",
    requireAuth,
    async (req: Request, res: Response) => {
      if (rejectIosSubscriptionFlow(req, res)) return;
      try {
        const { customerId, priceId, successUrl, cancelUrl } = req.body;
        if (!customerId || !priceId) {
          return res
            .status(400)
            .json({ error: "customerId and priceId are required" });
        }
        const session = await stripeService.createCheckoutSession(
          customerId,
          priceId,
          successUrl || `${req.protocol}://${req.get("host")}/checkout/success`,
          cancelUrl || `${req.protocol}://${req.get("host")}/checkout/cancel`,
        );
        res.json({ url: session.url, sessionId: session.id });
      } catch (error) {
        console.error("Create checkout session error:", error);
        res.status(500).json({ error: "Failed to create checkout session" });
      }
    },
  );

  app.post(
    "/api/stripe/customer-portal",
    requireAuth,
    async (req: Request, res: Response) => {
      if (rejectIosSubscriptionFlow(req, res)) return;
      try {
        const { customerId, returnUrl } = req.body;
        if (!customerId) {
          return res.status(400).json({ error: "customerId is required" });
        }
        const session = await stripeService.createCustomerPortalSession(
          customerId,
          returnUrl || `${req.protocol}://${req.get("host")}/`,
        );
        res.json({ url: session.url });
      } catch (error) {
        console.error("Create customer portal error:", error);
        res
          .status(500)
          .json({ error: "Failed to create customer portal session" });
      }
    },
  );

  // ============================================
  // HOMEBASE PRO PROVIDER SUBSCRIPTIONS (Task #124)
  // ============================================
  app.post(
    "/api/subscriptions/create-checkout",
    requireAuth,
    async (req: Request, res: Response) => {
      if (rejectIosSubscriptionFlow(req, res)) return;
      try {
        const userId =
          (req as any).authenticatedUserId ?? (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: "unauthorized" });

        const [provider] = await db
          .select({ id: providers.id })
          .from(providers)
          .where(eq(providers.userId, userId))
          .limit(1);
        if (!provider) {
          return res
            .status(403)
            .json({ error: "Only providers can subscribe to HomeBase Pro" });
        }

        const { url, sessionId } = await createSubscriptionCheckoutSession({
          userId,
          providerId: provider.id,
        });
        res.json({ url, sessionId });
      } catch (error: any) {
        console.error("[subscriptions] create-checkout error:", error);
        const status = error?.code === "forbidden" ? 403 : 500;
        res.status(status).json({
          error: error?.message || "Failed to create subscription checkout",
        });
      }
    },
  );

  app.post(
    "/api/subscriptions/portal",
    requireAuth,
    async (req: Request, res: Response) => {
      if (rejectIosSubscriptionFlow(req, res)) return;
      try {
        const userId =
          (req as any).authenticatedUserId ?? (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: "unauthorized" });

        const { url } = await createSubscriptionPortalSession({ userId });
        res.json({ url });
      } catch (error: any) {
        console.error("[subscriptions] portal error:", error);
        const status = error?.code === "no_subscription" ? 404 : 500;
        res
          .status(status)
          .json({ error: error?.message || "Failed to open billing portal" });
      }
    },
  );

  // Note: subscription status reads go through the existing
  // GET /api/providers/:providerId/subscription-status endpoint, which returns
  // the rich free/grace_period/expired/subscribed state from subscriptionService.

  // ============================================
  // REVENUECAT WEBHOOK (Task #132 — Apple/Google IAP)
  // RevenueCat POSTs subscription lifecycle events here. Authentication is a
  // shared-secret Bearer token (set REVENUECAT_WEBHOOK_SECRET) — RevenueCat
  // does not sign payloads, so we use their recommended Authorization header.
  // ============================================
  app.post("/api/revenuecat/webhook", async (req: Request, res: Response) => {
    const { handleRevenueCatWebhook } = await import("../revenuecatService");
    await handleRevenueCatWebhook(req, res);
  });

  // ============================================
  // STRIPE CONNECT RETURN PAGES (after Stripe redirects the browser back)
  const connectPageHtml = (
    title: string,
    message: string,
    isRefresh = false,
  ) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} – HomeBase Pro</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f1117;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#1c1f2b;border-radius:20px;padding:40px 32px;max-width:440px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.5)}
    .icon{font-size:56px;margin-bottom:20px}
    h1{font-size:24px;font-weight:700;margin-bottom:12px}
    p{color:#a0a8c0;font-size:15px;line-height:1.6;margin-bottom:28px}
    a.btn{display:inline-block;background:#38AE5F;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:16px}
    a.btn:hover{background:#2e9a52}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isRefresh ? "🔄" : "✅"}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a class="btn" href="homebase://">Return to HomeBase Pro</a>
  </div>
</body>
</html>`;

  // ────────────────────────────────────────────────────────────────────────
  // Stripe Checkout return bridges (web fallback that triggers homebase://)
  // ────────────────────────────────────────────────────────────────────────
  // These pages are loaded by Stripe after a Checkout Session finishes.
  // They auto-redirect to the app via the homebase:// scheme, and show a
  // visible button for users whose browser doesn't open the app.
  const invoiceReturnHtml = (
    invoiceId: string,
    jobId: string | null,
    status: "paid" | "cancelled",
  ) => {
    const params = new URLSearchParams({ invoiceId, status });
    if (jobId) params.set("jobId", jobId);
    const deepLink = `homebase://payment-result?${params.toString()}`;
    const isPaid = status === "paid";
    const title = isPaid ? "Payment Received" : "Payment Cancelled";
    const message = isPaid
      ? "Thanks — your payment was processed successfully. Returning you to the HomeBase app."
      : "No charge was made. You can return to the HomeBase app to try again or pick a different payment method.";
    const icon = isPaid ? "✓" : "✕";
    const accent = isPaid ? "#38AE5F" : "#E0856F";

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — HomeBase</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0e1322;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
    .card{background:#1a2236;border-radius:20px;padding:40px 32px;max-width:420px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.4)}
    .icon{width:72px;height:72px;border-radius:36px;background:${accent};color:#fff;font-size:36px;line-height:72px;margin:0 auto 20px;font-weight:600}
    h1{font-size:24px;margin:0 0 12px;font-weight:700}
    p{color:#a0a8c0;font-size:15px;line-height:1.6;margin:0 0 28px}
    a.btn{display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:16px}
    a.btn:hover{filter:brightness(1.1)}
    .small{font-size:13px;color:#6b7280;margin-top:18px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a class="btn" id="open" href="${deepLink}">Open HomeBase App</a>
    <p class="small">If the app doesn't open automatically, tap the button above.</p>
  </div>
  <script>
    // Auto-trigger the deep link on load. Mobile browsers will hand the URL
    // to the OS, which switches to the HomeBase app if installed.
    (function(){
      var url = ${JSON.stringify(deepLink)};
      try { window.location.replace(url); } catch (_) {}
      setTimeout(function(){
        // Some browsers block the auto-open; the visible button is the fallback.
      }, 250);
    })();
  </script>
</body>
</html>`;
  };

  async function lookupInvoiceJobId(
    invoiceId: string,
  ): Promise<string | null> {
    try {
      const [inv] = await db
        .select({ jobId: invoices.jobId })
        .from(invoices)
        .where(eq(invoices.id, invoiceId));
      return inv?.jobId ?? null;
    } catch {
      return null;
    }
  }

  app.get(
    "/r/invoice/:invoiceId/paid",
    async (req: Request<{ invoiceId: string }>, res: Response) => {
      const { invoiceId } = req.params;
      const jobId = await lookupInvoiceJobId(invoiceId);
      res.setHeader("Content-Type", "text/html");
      res.send(invoiceReturnHtml(invoiceId, jobId, "paid"));
    },
  );

  app.get(
    "/r/invoice/:invoiceId/cancelled",
    async (req: Request<{ invoiceId: string }>, res: Response) => {
      const { invoiceId } = req.params;
      const jobId = await lookupInvoiceJobId(invoiceId);
      res.setHeader("Content-Type", "text/html");
      res.send(invoiceReturnHtml(invoiceId, jobId, "cancelled"));
    },
  );

  app.get("/provider/connect/complete", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(
      connectPageHtml(
        "Stripe Setup Complete",
        "Your payment account is connected. Return to the app to start accepting payments and receiving payouts.",
      ),
    );
  });

  app.get("/provider/connect/refresh", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(
      connectPageHtml(
        "Continue Stripe Setup",
        'Your onboarding link has expired. Return to the app and tap "Continue Onboarding" to generate a fresh link.',
        true,
      ),
    );
  });

  // STRIPE CONNECT ENDPOINTS
  // ============================================

  // Start Stripe Connect onboarding for provider (frontend uses this path)
  app.post(
    "/api/stripe/connect/onboard/:providerId",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const result = await createConnectAccountLink(providerId);
        res.json(result);
      } catch (error: any) {
        console.error("Create connect onboarding error:", error);
        res.status(500).json({
          error: error.message || "Failed to start Stripe onboarding",
        });
      }
    },
  );

  // Refresh Stripe Connect onboarding link
  app.post(
    "/api/stripe/connect/refresh-link/:providerId",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const result = await refreshConnectAccountLink(providerId);
        res.json(result);
      } catch (error: any) {
        console.error("Refresh connect link error:", error);
        res.status(500).json({
          error: error.message || "Failed to refresh onboarding link",
        });
      }
    },
  );

  // Force re-onboarding — wipes the local Connect record and issues a fresh
  // onboarding link. Used when a provider's existing account is test-mode and
  // the platform has cut over to live mode.
  app.post(
    "/api/stripe/connect/reonboard/:providerId",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const result = await reonboardConnectAccount(providerId);
        res.json(result);
      } catch (error: any) {
        console.error("Re-onboard connect error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to start re-onboarding" });
      }
    },
  );

  // Get Stripe Connect status for provider
  app.get(
    "/api/stripe/connect/status/:providerId",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const result = await getConnectStatus(providerId);
        res.json(result);
      } catch (error: any) {
        console.error("Get connect status error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to get connect status" });
      }
    },
  );

  // Preview platform fee (GET endpoint for frontend)
  app.get("/api/stripe/fee-preview", async (req: Request, res: Response) => {
    try {
      const { providerId, amountCents } = req.query;
      if (!providerId || amountCents === undefined) {
        return res
          .status(400)
          .json({ error: "providerId and amountCents are required" });
      }
      const preview = await calculateFeePreview(
        providerId as string,
        parseInt(amountCents as string, 10),
      );
      res.json(preview);
    } catch (error: any) {
      console.error("Fee preview error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to calculate fee preview" });
    }
  });

  // Create invoice with line items (frontend path)
  app.post(
    "/api/stripe/invoices",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const {
          providerId,
          clientId,
          homeownerUserId,
          jobId,
          lineItems: lineItemsInput,
          taxCents,
          discountCents,
          dueDate,
          notes,
        } = req.body;

        if (!providerId) {
          return res.status(400).json({ error: "providerId is required" });
        }

        // Ownership: caller must own the provider they are creating an invoice for
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        if (!(await checkSubscriptionGate(providerId, res))) return;

        // Calculate subtotal from line items
        let subtotalCents = 0;
        const parsedLineItems = Array.isArray(lineItemsInput)
          ? lineItemsInput
          : [];
        for (const item of parsedLineItems) {
          const qty = parseFloat(item.quantity || "1");
          const unitPrice = parseInt(item.unitPriceCents || "0", 10);
          subtotalCents += Math.round(qty * unitPrice);
        }

        // Calculate platform fee
        const plan = await getProviderPlan(providerId);
        const fee = calculatePlatformFee(
          subtotalCents,
          plan.platformFeePercent || "3.00",
          plan.platformFeeFixedCents || 0,
        );

        const totalBeforeTax = subtotalCents - (discountCents || 0);
        const totalCents = totalBeforeTax + (taxCents || 0);

        // Generate invoice number
        const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

        // Create the invoice
        const [invoice] = await db
          .insert(invoices)
          .values({
            providerId,
            clientId: clientId || null,
            homeownerUserId: homeownerUserId || null,
            jobId: jobId || null,
            invoiceNumber,
            currency: "usd",
            subtotalCents,
            taxCents: taxCents || 0,
            discountCents: discountCents || 0,
            platformFeeCents: fee.totalCents,
            totalCents,
            amount: (subtotalCents / 100).toFixed(2),
            tax: ((taxCents || 0) / 100).toFixed(2),
            total: (totalCents / 100).toFixed(2),
            status: "draft",
            dueDate: dueDate ? new Date(dueDate) : null,
            notes: notes || null,
            paymentMethodsAllowed: "stripe,credits",
          })
          .returning();

        // Create line items
        if (parsedLineItems.length > 0) {
          await db.insert(invoiceLineItems).values(
            parsedLineItems.map((item: any) => ({
              invoiceId: invoice.id,
              name: item.description || item.name || "Service",
              description: item.description || null,
              quantity: String(item.quantity || "1"),
              unitPriceCents: parseInt(item.unitPriceCents || "0", 10),
              amountCents: Math.round(
                parseFloat(item.quantity || "1") *
                  parseInt(item.unitPriceCents || "0", 10),
              ),
            })),
          );
        }

        res.status(201).json({
          invoice,
          platformFee: fee,
        });
      } catch (error: any) {
        console.error("Create invoice error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to create invoice" });
      }
    },
  );

  // Get invoices for provider
  app.get(
    "/api/stripe/invoices",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { providerId } = req.query;
        if (!providerId) {
          return res.status(400).json({ error: "providerId is required" });
        }
        // Ownership: caller must own the provider whose invoices they are listing
        if (!(await assertProviderOwnership(req, providerId as string, res)))
          return;
        const providerInvoices = await db
          .select()
          .from(invoices)
          .where(eq(invoices.providerId, providerId as string))
          .orderBy(desc(invoices.createdAt));
        res.json({ invoices: providerInvoices });
      } catch (error: any) {
        console.error("Get invoices error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to get invoices" });
      }
    },
  );

  // Send invoice — Stripe send + HomeBase notification email
  app.post(
    "/api/stripe/invoices/:invoiceId/send",
    requireAuth,
    async (req: Request<{ invoiceId: string }>, res: Response) => {
      try {
        const { invoiceId } = req.params;
        const authUserId = req.authenticatedUserId!;

        // Load invoice
        const invoice = await storage.getInvoice(invoiceId);
        if (!invoice)
          return res.status(404).json({ error: "Invoice not found" });

        // Verify the authenticated user owns this invoice's provider account
        const authProviderRecord =
          await storage.getProviderByUserId(authUserId);
        if (
          !authProviderRecord ||
          invoice.providerId !== authProviderRecord.id
        ) {
          return res.status(403).json({
            error:
              "Access denied: you can only send invoices for your own provider account",
          });
        }

        // Send a proper Stripe Invoice — Stripe emails the client at invoice.stripe.com
        let hostedUrl: string | undefined;
        let stripeError: string | undefined;

        // FAIL CLOSED on stripe_not_ready (Task #245): refuse the send and
        // do NOT mark the invoice as "sent" if the provider's Connect
        // account isn't ready. Returning 2xx with a soft `stripeError`
        // would leave the invoice in "sent" state with no hosted URL,
        // which silently breaks the homeowner's payment flow.
        let stripeErrorCode: string | undefined;
        if (!invoice.stripeInvoiceId) {
          const platformResult = await sendStripeInvoiceEmail(
            invoiceId,
          ).catch((err: any) => {
            stripeError = err?.message || "Stripe invoice send failed";
            stripeErrorCode = err?.code;
            console.error(
              "[stripe-invoice-send] stripe/invoices/:id/send:",
              stripeError,
            );
            return null;
          });
          if (platformResult?.hostedInvoiceUrl)
            hostedUrl = platformResult.hostedInvoiceUrl;
        } else {
          // Resend via Connect-aware helper (Task #150) — invoice lives on
          // the connected account, not the platform account.
          hostedUrl = invoice.hostedInvoiceUrl || undefined;
          await resendStripeInvoice(invoiceId).catch((err: any) => {
            stripeError = err?.message;
            stripeErrorCode = err?.code;
          });
        }
        if (stripeErrorCode === "stripe_not_ready") {
          return res.status(409).json({
            code: "stripe_not_ready",
            error:
              "Provider Stripe Connect account is not ready to accept charges. Finish onboarding before sending invoices.",
            invoiceId,
          });
        }

        // Send HomeBase notification email as secondary notification
        let emailSent = false;
        let emailError: string | undefined;
        if (invoice.clientId) {
          const client = await storage.getClient(invoice.clientId);
          const provider = await storage.getProvider(invoice.providerId);
          if (client?.email && provider) {
            const rawLineItems = invoice.lineItems;
            const lineItems = Array.isArray(rawLineItems)
              ? rawLineItems
              : typeof rawLineItems === "string"
                ? JSON.parse(rawLineItems)
                : [];
            const clientName =
              [client.firstName, client.lastName].filter(Boolean).join(" ") ||
              "Client";
            const sendResult = await dispatchWithResult("invoice.sent", {
              clientEmail: client.email,
              clientName,
              providerName:
                provider.businessName || provider.userId || "Service Provider",
              invoiceNumber:
                invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`,
              amount: parseFloat(invoice.total?.toString() || "0"),
              dueDate: invoice.dueDate
                ? new Date(invoice.dueDate).toLocaleDateString()
                : "Due on receipt",
              lineItems: lineItems.map((item: any) => ({
                description: item.description || item.name || "Service",
                quantity: item.quantity || 1,
                unitPrice: parseFloat(
                  item.unitPrice?.toString() || item.price?.toString() || "0",
                ),
                total: parseFloat(item.total?.toString() || "0"),
              })),
              paymentLink: hostedUrl,
              relatedRecordType: "invoice",
              relatedRecordId: invoice.id,
            });
            emailSent = sendResult.emailSent;
            emailError = sendResult.emailError;

            // Push notification — non-fatal
            const [clientUser] = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.email, client.email))
              .limit(1)
              .catch(() => [null]);
            if (clientUser) {
              const invoiceTotal = parseFloat(invoice.total?.toString() || "0");
              sendPush(
                clientUser.id,
                `Invoice from ${provider.businessName || "Your Provider"}`,
                `Invoice ${invoice.invoiceNumber || invoiceId.slice(0, 8)} for $${invoiceTotal.toFixed(2)} is ready. Tap to view.`,
                { type: "invoice_sent", invoiceId },
                "invoices",
              ).catch(() => {});
            }
          }
        }

        const [updated] = await db
          .update(invoices)
          .set({
            status: "sent",
            sentAt: new Date(),
            ...(hostedUrl ? { hostedInvoiceUrl: hostedUrl } : {}),
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoiceId))
          .returning();

        res.json({
          invoice: updated,
          paymentUrl: hostedUrl,
          emailSent,
          emailError,
          stripeError,
        });
      } catch (error: any) {
        console.error("Send invoice error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to send invoice" });
      }
    },
  );

  // Create Stripe Invoice for invoice payment (replaces checkout session)
  app.post(
    "/api/stripe/invoices/:invoiceId/checkout",
    requireAuth,
    async (req: Request<{ invoiceId: string }>, res: Response) => {
      try {
        const { invoiceId } = req.params;
        if (!(await assertInvoiceAccess(req, invoiceId, res))) return;

        // Use existing Stripe invoice URL, or send one now via platform account
        const [inv] = await db
          .select({
            stripeInvoiceId: invoices.stripeInvoiceId,
            hostedInvoiceUrl: invoices.hostedInvoiceUrl,
          })
          .from(invoices)
          .where(eq(invoices.id, invoiceId));
        if (!inv) return res.status(404).json({ error: "Invoice not found" });

        let url = inv.hostedInvoiceUrl;
        if (!url) {
          try {
            const result = await sendStripeInvoiceEmail(invoiceId);
            url = result.hostedInvoiceUrl;
          } catch (err: any) {
            // FAIL CLOSED on stripe_not_ready (Task #245).
            if (err?.code === "stripe_not_ready") {
              return res.status(409).json({
                code: "stripe_not_ready",
                error:
                  "Provider Stripe Connect account is not ready to accept charges.",
                invoiceId,
              });
            }
            throw err;
          }
        }

        res.json({ url, stripeInvoiceId: inv.stripeInvoiceId });
      } catch (error: any) {
        console.error("Create Stripe invoice error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to create checkout" });
      }
    },
  );

  // Apply credits to invoice
  app.post(
    "/api/stripe/invoices/:invoiceId/apply-credits",
    requireAuth,
    async (req: Request<{ invoiceId: string }>, res: Response) => {
      try {
        const { invoiceId } = req.params;
        if (!(await assertInvoiceAccess(req, invoiceId, res))) return;
        const { amountCents } = req.body;
        // Bind userId to the authenticated user — never trust body-supplied userId
        const userId = req.authenticatedUserId!;
        if (
          !amountCents ||
          isNaN(Number(amountCents)) ||
          Number(amountCents) <= 0
        ) {
          return res
            .status(400)
            .json({ error: "amountCents must be a positive number" });
        }
        const result = await applyCreditsToInvoice(
          invoiceId,
          userId,
          amountCents,
        );
        res.json(result);
      } catch (error: any) {
        console.error("Apply credits error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to apply credits" });
      }
    },
  );

  // Create Connect account and onboarding link for provider
  app.post(
    "/api/connect/account-link",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { providerId } = req.body;
        if (!providerId) {
          return res.status(400).json({ error: "providerId is required" });
        }
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const result = await createConnectAccountLink(providerId);
        res.json(result);
      } catch (error: any) {
        console.error("Create connect account link error:", error);
        res.status(500).json({
          error: error.message || "Failed to create connect account link",
        });
      }
    },
  );

  // Refresh Connect account onboarding link
  app.post(
    "/api/connect/refresh-link",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { providerId } = req.body;
        if (!providerId) {
          return res.status(400).json({ error: "providerId is required" });
        }
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const result = await refreshConnectAccountLink(providerId);
        res.json(result);
      } catch (error: any) {
        console.error("Refresh connect account link error:", error);
        res.status(500).json({
          error: error.message || "Failed to refresh connect account link",
        });
      }
    },
  );

  // Get Connect account status for provider
  app.get(
    "/api/connect/status/:providerId",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const result = await getConnectStatus(providerId);
        res.json(result);
      } catch (error: any) {
        console.error("Get connect status error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to get connect status" });
      }
    },
  );

  // Create or update provider plan
  // NOTE: platformFeePercent and platformFeeFixedCents are platform-controlled
  // billing policy. Providers may only set planTier on their own record.
  // Fee fields can only be changed by an admin.
  app.post(
    "/api/providers/:providerId/plan",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;

        // Providers may only update planTier — never fee rates.
        // Reject requests that attempt to set admin-controlled fee fields.
        const { planTier, platformFeePercent, platformFeeFixedCents } = req.body;
        if (platformFeePercent !== undefined || platformFeeFixedCents !== undefined) {
          return res.status(403).json({
            error: "Platform fee rates are not provider-configurable",
          });
        }

        const [existing] = await db
          .select()
          .from(providerPlans)
          .where(eq(providerPlans.providerId, providerId));

        if (existing) {
          const [updated] = await db
            .update(providerPlans)
            .set({
              planTier: planTier || existing.planTier,
              updatedAt: new Date(),
            })
            .where(eq(providerPlans.id, existing.id))
            .returning();
          res.json({ plan: updated });
        } else {
          const [created] = await db
            .insert(providerPlans)
            .values({
              providerId,
              planTier: planTier || "free",
            })
            .returning();
          res.status(201).json({ plan: created });
        }
      } catch (error: any) {
        console.error("Update provider plan error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to update provider plan" });
      }
    },
  );

  // Admin-only endpoint to set platform fee rates for a provider plan
  app.post(
    "/api/admin/providers/:providerId/plan/fees",
    requireAuth,
    requireAdmin,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        const { platformFeePercent, platformFeeFixedCents } = req.body;

        const [existing] = await db
          .select()
          .from(providerPlans)
          .where(eq(providerPlans.providerId, providerId));

        if (existing) {
          const [updated] = await db
            .update(providerPlans)
            .set({
              platformFeePercent:
                platformFeePercent ?? existing.platformFeePercent,
              platformFeeFixedCents:
                platformFeeFixedCents ?? existing.platformFeeFixedCents,
              updatedAt: new Date(),
            })
            .where(eq(providerPlans.id, existing.id))
            .returning();
          res.json({ plan: updated });
        } else {
          const [created] = await db
            .insert(providerPlans)
            .values({
              providerId,
              platformFeePercent: platformFeePercent || "3.00",
              platformFeeFixedCents: platformFeeFixedCents || 0,
            })
            .returning();
          res.status(201).json({ plan: created });
        }
      } catch (error: any) {
        console.error("Admin update provider fee error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to update provider fees" });
      }
    },
  );

  // Get provider plan
  app.get(
    "/api/providers/:providerId/plan",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const plan = await getProviderPlan(providerId);
        res.json({ plan });
      } catch (error: any) {
        console.error("Get provider plan error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to get provider plan" });
      }
    },
  );

  // ============================================
  // SUBSCRIPTION GATE ENDPOINTS
  // ============================================

  // Get subscription status for a provider
  app.get(
    "/api/providers/:providerId/subscription-status",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const status = await getProviderSubscriptionStatus(providerId);
        res.json(status);
      } catch (error: any) {
        console.error("Get subscription status error:", error);
        res.status(500).json({
          error: error.message || "Failed to get subscription status",
        });
      }
    },
  );

  // Mark provider as subscribed (admin-only — must be triggered by verified billing event, not self-service)
  app.post(
    "/api/providers/:providerId/activate-subscription",
    requireAuth,
    requireAdmin,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        const [existing] = await db
          .select()
          .from(providerPlans)
          .where(eq(providerPlans.providerId, providerId));
        if (existing) {
          await db
            .update(providerPlans)
            .set({
              isSubscribed: true,
              planTier: "professional",
              updatedAt: new Date(),
            })
            .where(eq(providerPlans.id, existing.id));
        } else {
          await db.insert(providerPlans).values({
            providerId,
            planTier: "professional",
            isSubscribed: true,
          });
        }
        const status = await getProviderSubscriptionStatus(providerId);
        res.json(status);
      } catch (error: any) {
        console.error("Activate subscription error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to activate subscription" });
      }
    },
  );

  // ─── HomeBase Partner admin endpoints (Task #211) ───────────────────────
  // Admin-only: grant or revoke complimentary "HomeBase Partner" Pro access
  // for a provider. Partners bypass the subscription paywall but standard
  // platform transaction fees still apply (handled in stripeConnectService).
  app.get(
    "/api/admin/providers",
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const search = (req.query.q as string | undefined)?.trim() ?? "";
        const subscriptionStatus = (req.query.subscriptionStatus as string | undefined)?.trim() ?? "";
        const isPartnerRaw = req.query.isPartner as string | undefined;
        const isPartner = isPartnerRaw === "true" ? true : isPartnerRaw === "false" ? false : null;
        const limit = Math.min(Math.max(parseInt((req.query.limit as string) ?? "50", 10) || 50, 1), 200);
        const offset = Math.max(parseInt((req.query.offset as string) ?? "0", 10) || 0, 0);

        const sortBy = (req.query.sortBy as string | undefined)?.trim() ?? "";
        const isActiveRaw = req.query.isActive as string | undefined;
        const isActiveParsed = isActiveRaw === "true" ? true : isActiveRaw === "false" ? false : null;
        const { rows: enriched, total } = await storage.getAdminProviders({ search, subscriptionStatus, isPartner, isActive: isActiveParsed, sortBy, limit, offset });
        res.json({ providers: enriched, total, limit, offset });
      } catch (err: any) {
        console.error("[admin] list providers error:", err);
        res.status(500).json({ error: err.message || "Failed to list providers" });
      }
    },
  );

  app.post(
    "/api/admin/providers/:providerId/partner",
    requireAuth,
    requireAdmin,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        const adminUserId = req.authenticatedUserId!;
        const [provider] = await db
          .select({ id: providers.id })
          .from(providers)
          .where(eq(providers.id, providerId));
        if (!provider) return res.status(404).json({ error: "Provider not found" });

        const now = new Date();
        const [existing] = await db
          .select()
          .from(providerPlans)
          .where(eq(providerPlans.providerId, providerId));
        if (existing) {
          await db
            .update(providerPlans)
            .set({ isPartner: true, partnerSince: now, updatedAt: now })
            .where(eq(providerPlans.id, existing.id));
        } else {
          await db.insert(providerPlans).values({
            providerId,
            isPartner: true,
            partnerSince: now,
          });
        }
        // Audit log
        await db.insert(adminAuditLogs).values({
          adminUserId,
          action: "partner.grant",
          targetType: "provider",
          targetId: providerId,
          beforeValue: { isPartner: false },
          afterValue: { isPartner: true, partnerSince: now.toISOString() },
        });
        const status = await getProviderSubscriptionStatus(providerId);
        res.json({ success: true, providerId, isPartner: true, partnerSince: now.toISOString(), subscriptionStatus: status });
      } catch (err: any) {
        console.error("[admin] grant partner error:", err);
        res.status(500).json({ error: err.message || "Failed to grant Partner status" });
      }
    },
  );

  app.delete(
    "/api/admin/providers/:providerId/partner",
    requireAuth,
    requireAdmin,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        const adminUserId = req.authenticatedUserId!;
        const [existing] = await db
          .select()
          .from(providerPlans)
          .where(eq(providerPlans.providerId, providerId));
        if (existing) {
          await db
            .update(providerPlans)
            .set({ isPartner: false, partnerSince: null, updatedAt: new Date() })
            .where(eq(providerPlans.id, existing.id));
        }
        // Audit log
        await db.insert(adminAuditLogs).values({
          adminUserId,
          action: "partner.revoke",
          targetType: "provider",
          targetId: providerId,
          beforeValue: { isPartner: true },
          afterValue: { isPartner: false },
        });
        const status = await getProviderSubscriptionStatus(providerId);
        res.json({ success: true, providerId, isPartner: false, subscriptionStatus: status });
      } catch (err: any) {
        console.error("[admin] revoke partner error:", err);
        res.status(500).json({ error: err.message || "Failed to revoke Partner status" });
      }
    },
  );

  // Preview platform fee for a given amount
  app.post(
    "/api/connect/fee-preview",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { providerId, totalCents } = req.body;
        if (!providerId || totalCents === undefined) {
          return res
            .status(400)
            .json({ error: "providerId and totalCents are required" });
        }
        const preview = await calculateFeePreview(providerId, totalCents);
        res.json(preview);
      } catch (error: any) {
        console.error("Fee preview error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to calculate fee preview" });
      }
    },
  );

  // ============================================
  // ENHANCED INVOICE ENDPOINTS (with Stripe Connect)
  // ============================================

  // Create invoice with line items and platform fee calculation
  app.post(
    "/api/invoices/create",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const {
          providerId,
          clientId,
          homeownerUserId,
          jobId,
          lineItems: lineItemsInput,
          taxCents,
          discountCents,
          dueDate,
          notes,
          paymentMethodsAllowed,
        } = req.body;

        if (!providerId) {
          return res.status(400).json({ error: "providerId is required" });
        }

        // Ownership: caller must own the provider they are creating an invoice for
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        if (!(await checkSubscriptionGate(providerId, res))) return;

        // Calculate subtotal from line items
        let subtotalCents = 0;
        const parsedLineItems = Array.isArray(lineItemsInput)
          ? lineItemsInput
          : [];
        for (const item of parsedLineItems) {
          const qty = parseFloat(item.quantity || "1");
          const unitPrice = parseInt(item.unitPriceCents || "0", 10);
          subtotalCents += Math.round(qty * unitPrice);
        }

        // Calculate platform fee
        const plan = await getProviderPlan(providerId);
        const fee = calculatePlatformFee(
          subtotalCents,
          plan.platformFeePercent || "3.00",
          plan.platformFeeFixedCents || 0,
        );

        const totalBeforeTax = subtotalCents - (discountCents || 0);
        const totalCents = totalBeforeTax + (taxCents || 0);

        // Generate invoice number
        const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

        // Create the invoice
        const [invoice] = await db
          .insert(invoices)
          .values({
            providerId,
            clientId: clientId || null,
            homeownerUserId: homeownerUserId || null,
            jobId: jobId || null,
            invoiceNumber,
            currency: "usd",
            subtotalCents,
            taxCents: taxCents || 0,
            discountCents: discountCents || 0,
            platformFeeCents: fee.totalCents,
            totalCents,
            amount: (subtotalCents / 100).toFixed(2),
            tax: ((taxCents || 0) / 100).toFixed(2),
            total: (totalCents / 100).toFixed(2),
            status: "draft",
            dueDate: dueDate ? new Date(dueDate) : null,
            notes: notes || null,
            paymentMethodsAllowed: paymentMethodsAllowed || "stripe,credits",
          })
          .returning();

        // Create line items
        if (parsedLineItems.length > 0) {
          await db.insert(invoiceLineItems).values(
            parsedLineItems.map((item: any) => ({
              invoiceId: invoice.id,
              name: item.name,
              description: item.description || null,
              quantity: item.quantity || "1",
              unitPriceCents: parseInt(item.unitPriceCents || "0", 10),
              amountCents: Math.round(
                parseFloat(item.quantity || "1") *
                  parseInt(item.unitPriceCents || "0", 10),
              ),
              metadata: item.metadata ? JSON.stringify(item.metadata) : null,
            })),
          );
        }

        // Fetch line items for response
        const createdLineItems = await db
          .select()
          .from(invoiceLineItems)
          .where(eq(invoiceLineItems.invoiceId, invoice.id));

        res.status(201).json({
          invoice,
          lineItems: createdLineItems,
          platformFee: fee,
        });
      } catch (error: any) {
        console.error("Create invoice error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to create invoice" });
      }
    },
  );

  // Create payment intent for invoice (for in-app payment sheet)
  app.post(
    "/api/invoices/:invoiceId/payment-intent",
    requireAuth,
    async (req: Request<{ invoiceId: string }>, res: Response) => {
      try {
        const { invoiceId } = req.params;
        // Verify caller is associated with this invoice (homeowner or issuing provider)
        if (!(await assertInvoiceAccess(req, invoiceId, res))) return;
        // Never accept payerUserId from the request body — bind to the authenticated caller
        const authUserId = req.authenticatedUserId!;
        // Task #478: optional gratuity from the homeowner. Sanitize here too
        // (service layer also clamps) so malformed input never reaches Stripe.
        const rawTip = Number(req.body?.tipCents);
        const tipCents = Number.isFinite(rawTip) && rawTip > 0 ? Math.round(rawTip) : 0;
        const result = await createInvoicePaymentIntent(invoiceId, authUserId, tipCents);
        res.json(result);
      } catch (error: any) {
        console.error("Create payment intent error:", error);
        // Standardize stripe_not_ready propagation (Task #150) — provider
        // Connect onboarding gates surface here too.
        if (
          error?.code === "stripe_not_ready" ||
          error?.message?.includes("not enabled") ||
          error?.message?.includes("not set up") ||
          error?.message?.includes("Stripe Connect onboarding") ||
          error?.message?.includes("charges are not enabled")
        ) {
          return res.status(402).json({
            error: "stripe_not_ready",
            message: error.message,
          });
        }
        res
          .status(500)
          .json({ error: error.message || "Failed to create payment intent" });
      }
    },
  );

  // ── Homeowner card-on-file & PaymentSheet routes ─────────────────────────

  // Get or create Stripe customer for homeowner + return SetupIntent for saving a card
  app.post(
    "/api/homeowner/setup-payment-sheet",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, authUserId));
        if (!user) return res.status(404).json({ error: "User not found" });

        const stripe = getStripe();
        let customerId = user.stripeCustomerId;

        if (!customerId) {
          const customer = await stripe.customers.create({
            email: user.email,
            name:
              [user.firstName, user.lastName].filter(Boolean).join(" ") ||
              user.email,
            metadata: { userId: user.id },
          });
          customerId = customer.id;
          await db
            .update(users)
            .set({ stripeCustomerId: customerId, updatedAt: new Date() })
            .where(eq(users.id, authUserId));
        }

        const ephemeralKey = await stripe.ephemeralKeys.create(
          { customer: customerId },
          { apiVersion: "2023-10-16" },
        );
        const setupIntent = await stripe.setupIntents.create({
          customer: customerId,
          payment_method_types: ["card"],
        });

        res.json({
          setupIntentClientSecret: setupIntent.client_secret,
          ephemeralKeySecret: ephemeralKey.secret,
          customerId,
        });
      } catch (error: any) {
        console.error("Setup payment sheet error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to create setup sheet" });
      }
    },
  );

  // Get homeowner's saved payment methods
  app.get(
    "/api/homeowner/payment-methods",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, authUserId));
        if (!user?.stripeCustomerId)
          return res.json({ paymentMethods: [], defaultPaymentMethodId: null });

        const stripe = getStripe();
        const pms = await stripe.paymentMethods.list({
          customer: user.stripeCustomerId,
          type: "card",
        });

        const customer = (await stripe.customers.retrieve(
          user.stripeCustomerId,
        )) as any;
        const defaultPmId =
          user.defaultPaymentMethodId ||
          customer?.invoice_settings?.default_payment_method ||
          (pms.data.length === 1 ? pms.data[0].id : null);

        res.json({
          paymentMethods: pms.data.map((pm) => ({
            id: pm.id,
            brand: pm.card?.brand ?? "card",
            last4: pm.card?.last4 ?? "••••",
            expMonth: pm.card?.exp_month,
            expYear: pm.card?.exp_year,
            isDefault: pm.id === defaultPmId,
          })),
          defaultPaymentMethodId: defaultPmId,
        });
      } catch (error: any) {
        console.error("List payment methods error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to list payment methods" });
      }
    },
  );

  // Detach a saved payment method
  app.delete(
    "/api/homeowner/payment-methods/:pmId",
    requireAuth,
    async (req: Request<{ pmId: string }>, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, authUserId));

        if (!user?.stripeCustomerId) {
          return res.status(400).json({ error: "No Stripe customer found" });
        }

        const { pmId } = req.params;
        const stripe = getStripe();

        // Verify the payment method belongs to this user's Stripe customer
        // before detaching, to prevent IDOR attacks on other users' cards.
        const pm = await stripe.paymentMethods.retrieve(pmId);
        if (pm.customer !== user.stripeCustomerId) {
          return res.status(403).json({ error: "Forbidden" });
        }

        await stripe.paymentMethods.detach(pmId);

        if (user.defaultPaymentMethodId === pmId) {
          await db
            .update(users)
            .set({ defaultPaymentMethodId: null, updatedAt: new Date() })
            .where(eq(users.id, authUserId));
        }

        res.json({ success: true });
      } catch (error: any) {
        console.error("Detach payment method error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to remove payment method" });
      }
    },
  );

  // Set default payment method for homeowner
  app.patch(
    "/api/homeowner/default-payment-method",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;

        const { paymentMethodId } = req.body;
        if (!paymentMethodId)
          return res.status(400).json({ error: "paymentMethodId required" });

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, authUserId));
        if (!user?.stripeCustomerId)
          return res.status(400).json({ error: "No Stripe customer found" });

        const stripe = getStripe();
        await stripe.customers.update(user.stripeCustomerId, {
          invoice_settings: { default_payment_method: paymentMethodId },
        });

        await db
          .update(users)
          .set({
            defaultPaymentMethodId: paymentMethodId,
            updatedAt: new Date(),
          })
          .where(eq(users.id, authUserId));
        res.json({ success: true });
      } catch (error: any) {
        console.error("Set default PM error:", error);
        res.status(500).json({
          error: error.message || "Failed to set default payment method",
        });
      }
    },
  );

  // Create PaymentSheet params for paying an invoice in-app (with optional saved card)
  app.post(
    "/api/homeowner/payment-sheet",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const authUserId = req.authenticatedUserId!;

        const { invoiceId } = req.body;
        if (!invoiceId)
          return res.status(400).json({ error: "invoiceId required" });

        // Verify caller is associated with this invoice (homeowner or issuing provider)
        if (!(await assertInvoiceAccess(req, invoiceId, res))) return;

        const [invoice] = await db
          .select()
          .from(invoices)
          .where(eq(invoices.id, invoiceId));
        if (!invoice)
          return res.status(404).json({ error: "Invoice not found" });
        if (invoice.status === "paid")
          return res.status(400).json({ error: "Invoice already paid" });

        const connectAccount = await getConnectAccount(invoice.providerId);
        if (!connectAccount?.chargesEnabled) {
          return res.status(402).json({
            error: "stripe_not_ready",
            message: "Provider payment processing is not yet enabled",
          });
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, authUserId));
        if (!user) return res.status(404).json({ error: "User not found" });

        const stripe = getStripe();
        let customerId = user.stripeCustomerId;

        if (!customerId) {
          const customer = await stripe.customers.create({
            email: user.email,
            name:
              [user.firstName, user.lastName].filter(Boolean).join(" ") ||
              user.email,
            metadata: { userId: user.id },
          });
          customerId = customer.id;
          await db
            .update(users)
            .set({ stripeCustomerId: customerId, updatedAt: new Date() })
            .where(eq(users.id, authUserId));
        }

        const paymentSheetStripeFeeCents = calculateStripePassthroughFee(invoice.totalCents);
        const paymentSheetTotalCents = invoice.totalCents + paymentSheetStripeFeeCents;

        const paymentIntent = await stripe.paymentIntents.create({
          amount: paymentSheetTotalCents,
          currency: invoice.currency || "usd",
          customer: customerId,
          application_fee_amount: invoice.platformFeeCents || 0,
          transfer_data: { destination: connectAccount.stripeAccountId },
          setup_future_usage: "off_session",
          metadata: {
            invoiceId: invoice.id,
            providerId: invoice.providerId,
            payerUserId: authUserId,
            jobAmountCents: String(invoice.totalCents),
            stripeFeeCents: String(paymentSheetStripeFeeCents),
          },
        });

        const ephemeralKey = await stripe.ephemeralKeys.create(
          { customer: customerId },
          { apiVersion: "2023-10-16" },
        );

        await db
          .update(invoices)
          .set({
            stripePaymentIntentId: paymentIntent.id,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoiceId));

        res.json({
          paymentIntentClientSecret: paymentIntent.client_secret,
          ephemeralKeySecret: ephemeralKey.secret,
          customerId,
          amount: paymentSheetTotalCents,
          jobAmountCents: invoice.totalCents,
          stripeFeeCents: paymentSheetStripeFeeCents,
        });
      } catch (error: any) {
        console.error("Payment sheet error:", error);
        if (
          error.message?.includes("not enabled") ||
          error.message?.includes("not set up")
        ) {
          return res
            .status(402)
            .json({ error: "stripe_not_ready", message: error.message });
        }
        res
          .status(500)
          .json({ error: error.message || "Failed to create payment sheet" });
      }
    },
  );

  // Create Stripe Checkout Session for invoice payment.
  // Prefers a Checkout Session (which supports success_url/cancel_url that
  // deep-link back into the app via the homebase:// scheme). Falls back to
  // creating a Stripe Invoice's hosted payment page only if the provider's
  // Connect account isn't ready — in that case we lose the deep-link return,
  // but the homeowner can still pay.
  app.post(
    "/api/invoices/:invoiceId/checkout",
    requireAuth,
    async (req: Request<{ invoiceId: string }>, res: Response) => {
      try {
        const { invoiceId } = req.params;
        if (!(await assertInvoiceAccess(req, invoiceId, res))) return;

        const userId = req.authenticatedUserId!;

        // Auto-apply any available HomeBase credits before creating a Stripe
        // session, so the homeowner is only charged the net balance due.
        // Always base amounts on outstanding balance (totalCents minus already-
        // paid), never raw totalCents, to prevent overcharging on invoices that
        // have prior partial payments.
        let remainingCents: number | undefined;
        try {
          const [inv] = await db
            .select({ totalCents: invoices.totalCents })
            .from(invoices)
            .where(eq(invoices.id, invoiceId));

          if (!inv) throw new Error("Invoice not found");

          // Compute outstanding balance from succeeded payment records.
          const succeededPayments = await db
            .select({ amountCents: payments.amountCents })
            .from(payments)
            .where(and(eq(payments.invoiceId, invoiceId), eq(payments.status, "succeeded")));
          const alreadyPaid = succeededPayments.reduce((s, p) => s + (p.amountCents || 0), 0);
          const outstandingCents = inv.totalCents - alreadyPaid;

          if (outstandingCents <= 0) {
            // Invoice already fully paid (e.g. prior credits-only payment).
            return res.json({ status: "paid", appliedCreditsCents: 0 });
          }

          const [creditRow] = await db
            .select({ balanceCents: userCredits.balanceCents })
            .from(userCredits)
            .where(eq(userCredits.userId, userId));

          const availableCents = creditRow?.balanceCents ?? 0;

          if (availableCents > 0) {
            const creditResult = await applyCreditsToInvoice(
              invoiceId,
              userId,
              Math.min(availableCents, outstandingCents),
            );

            if (creditResult.invoiceStatus === "paid") {
              // Credits covered the full invoice — no Stripe charge needed.
              return res.json({
                status: "paid",
                appliedCreditsCents: creditResult.applied,
              });
            }

            // Partially covered — pass the actual remaining amount to Stripe.
            remainingCents = outstandingCents - creditResult.applied;
          }
        } catch (creditErr: any) {
          // Only swallow expected "credits not applicable" errors — re-throw
          // anything unexpected so it surfaces via the outer error handler.
          const msg: string = creditErr?.message ?? "";
          const isExpected =
            msg.includes("does not accept credit payments") ||
            msg.includes("Insufficient credits") ||
            msg.includes("already paid");
          if (!isExpected) throw creditErr;
          // Expected: invoice disallows credits or user has none — proceed
          // with full Stripe checkout for the outstanding amount.
          remainingCents = undefined;
        }

        // Task #478: optional gratuity from the homeowner.
        const rawTip = Number(req.body?.tipCents);
        const tipCents = Number.isFinite(rawTip) && rawTip > 0 ? Math.round(rawTip) : 0;

        // Try Connect-backed Checkout Session first (proper deep-link return).
        try {
          const session = await createStripeCheckoutSession(invoiceId, remainingCents, tipCents);
          return res.json({
            url: session.checkoutUrl,
            sessionId: session.sessionId,
          });
        } catch (sessionErr: any) {
          // Fall through to hosted invoice only if Stripe Connect isn't ready.
          const code = sessionErr?.code || sessionErr?.message;
          if (code !== "stripe_not_ready") throw sessionErr;
        }

        // Fallback: hosted Stripe invoice (no deep-link return after payment).
        const result = await createStripeInvoice(invoiceId);
        res.json({
          url: result.hostedInvoiceUrl,
          stripeInvoiceId: result.stripeInvoiceId,
        });
      } catch (error: any) {
        console.error("Create Stripe invoice error:", error);
        // Standardize stripe_not_ready propagation (Task #150) — match by
        // structured error code first, falling back to legacy message sniffing
        // for any third-party errors that don't carry our code.
        if (
          error?.code === "stripe_not_ready" ||
          error?.message?.includes("not enabled") ||
          error?.message?.includes("not set up") ||
          error?.message?.includes("Stripe Connect onboarding")
        ) {
          return res.status(402).json({
            error: "stripe_not_ready",
            message: error.message,
          });
        }
        res
          .status(500)
          .json({ error: error.message || "Failed to create Stripe invoice" });
      }
    },
  );

  // Apply credits to invoice
  app.post(
    "/api/invoices/:invoiceId/apply-credits",
    requireAuth,
    async (req: Request<{ invoiceId: string }>, res: Response) => {
      try {
        const { invoiceId } = req.params;
        if (!(await assertInvoiceAccess(req, invoiceId, res))) return;
        const { amountCents } = req.body;
        // Bind userId to the authenticated user — never trust body-supplied userId
        const userId = req.authenticatedUserId!;
        if (
          !amountCents ||
          isNaN(Number(amountCents)) ||
          Number(amountCents) <= 0
        ) {
          return res
            .status(400)
            .json({ error: "amountCents must be a positive number" });
        }
        const result = await applyCreditsToInvoice(
          invoiceId,
          userId,
          amountCents,
        );
        res.json(result);
      } catch (error: any) {
        console.error("Apply credits error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to apply credits" });
      }
    },
  );

  // Get user credits balance
  app.get(
    "/api/users/:userId/credits",
    requireAuth,
    async (req: Request<{ userId: string }>, res: Response) => {
      try {
        const { userId } = req.params;
        if (userId !== req.authenticatedUserId) {
          return res.status(403).json({ error: "Access denied" });
        }
        const [credits] = await db
          .select()
          .from(userCredits)
          .where(eq(userCredits.userId, userId));

        res.json({
          balanceCents: credits?.balanceCents || 0,
          balance: ((credits?.balanceCents || 0) / 100).toFixed(2),
        });
      } catch (error: any) {
        console.error("Get user credits error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to get user credits" });
      }
    },
  );

  // Credit history — returns balance + chronological ledger for the authenticated user
  app.get(
    "/api/users/me/credits/history",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.authenticatedUserId!;
        const [credits] = await db
          .select()
          .from(userCredits)
          .where(eq(userCredits.userId, userId));

        const ledgerEntries = await db
          .select()
          .from(creditLedger)
          .where(eq(creditLedger.userId, userId))
          .orderBy(desc(creditLedger.createdAt));

        res.json({
          balanceCents: credits?.balanceCents ?? 0,
          balance: ((credits?.balanceCents ?? 0) / 100).toFixed(2),
          history: ledgerEntries.map(formatLedgerEntry),
        });
      } catch (error: any) {
        console.error("Get credits history error:", error);
        res.status(500).json({ error: error.message || "Failed to get credits history" });
      }
    },
  );

  // Homeowner referral stats — returns referral code, link, count, credits earned
  app.get(
    "/api/users/me/referrals",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.authenticatedUserId!;
        const stats = await getReferralStats(userId);
        res.json(stats);
      } catch (error: any) {
        console.error("Get referral stats error:", error);
        res.status(500).json({ error: error.message || "Failed to get referral stats" });
      }
    },
  );

  // Add credits to user wallet (admin-only — credits must originate from verified
  // RevenueCat webhooks or other trusted server-side billing events, never
  // from a self-service client call)
  app.post(
    "/api/users/:userId/credits/add",
    requireAuth,
    requireAdmin,
    async (req: Request<{ userId: string }>, res: Response) => {
      try {
        const { userId } = req.params;
        const { amountCents, reason } = req.body;

        if (!amountCents || amountCents <= 0) {
          return res
            .status(400)
            .json({ error: "amountCents must be a positive number" });
        }

        // Upsert user credits
        const [existing] = await db
          .select()
          .from(userCredits)
          .where(eq(userCredits.userId, userId));

        let newBalance: number;
        if (existing) {
          newBalance = (existing.balanceCents || 0) + amountCents;
          await db
            .update(userCredits)
            .set({ balanceCents: newBalance, updatedAt: new Date() })
            .where(eq(userCredits.userId, userId));
        } else {
          newBalance = amountCents;
          await db.insert(userCredits).values({
            userId,
            balanceCents: newBalance,
          });
        }

        // Record in ledger
        await db.insert(creditLedger).values({
          userId,
          deltaCents: amountCents,
          reason: reason || "revenuecat_purchase",
        });

        res.json({
          balanceCents: newBalance,
          balance: (newBalance / 100).toFixed(2),
        });
      } catch (error: any) {
        console.error("Add credits error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to add credits" });
      }
    },
  );


  // Get payouts for provider
  app.get(
    "/api/providers/:providerId/payouts",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const providerPayouts = await db
          .select()
          .from(payouts)
          .where(eq(payouts.providerId, providerId));

        res.json({ payouts: providerPayouts });
      } catch (error: any) {
        console.error("Get payouts error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to get payouts" });
      }
    },
  );

  // Helper: verify calling user owns the given providerId
  async function assertProviderOwnership(
    req: Request,
    providerId: string,
    res: Response,
  ): Promise<boolean> {
    const authUserId = req.authenticatedUserId;
    const [provider] = await db
      .select({ userId: providers.userId })
      .from(providers)
      .where(eq(providers.id, providerId));
    if (!provider || provider.userId !== authUserId) {
      res.status(403).json({ error: "Forbidden" });
      return false;
    }
    return true;
  }

  /**
   * assertInvoiceAccess — verifies the authenticated user is allowed to act on an invoice.
   * Returns the invoice row on success, null (+ 403/404 sent) on failure.
   * Access is granted if:
   *   - The caller is the homeowner who owns the invoice (homeownerUserId === authUserId), OR
   *   - The caller is the provider who issued the invoice (via providers.userId === authUserId)
   */
  async function assertInvoiceAccess(
    req: Request,
    invoiceId: string,
    res: Response,
  ): Promise<{
    id: string;
    providerId: string;
    homeownerUserId: string | null;
  } | null> {
    const authUserId = req.authenticatedUserId!;
    const [inv] = await db
      .select({
        id: invoices.id,
        providerId: invoices.providerId,
        homeownerUserId: invoices.homeownerUserId,
      })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    if (!inv) {
      res.status(404).json({ error: "Invoice not found" });
      return null;
    }
    // Homeowner access
    if (inv.homeownerUserId && inv.homeownerUserId === authUserId) return inv;
    // Provider access — look up provider record
    const [provider] = await db
      .select({ userId: providers.userId })
      .from(providers)
      .where(eq(providers.id, inv.providerId))
      .limit(1);
    if (provider && provider.userId === authUserId) return inv;
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  // GET /api/providers/:providerId/next-payout — plain-English next-payout
  // summary for the Financials screen. Combines the Connect account's
  // pending/in-transit payouts and current balance with the default bank
  // account so the client can render a single sentence like
  //   "Friday, Nov 8 — $610.00 → Chase ••4421"
  // States returned via `status`:
  //   - "not_onboarded"          — no Connect account yet
  //   - "onboarding_incomplete"  — account exists but payouts not enabled
  //   - "ready"                  — usable response (nextPayout may still be null)
  app.get(
    "/api/providers/:providerId/next-payout",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;

        const subInfo = await getProviderSubscriptionStatus(providerId);
        const subscriptionGated = subInfo.status === "expired";

        const connectAccount = await getConnectAccount(providerId);
        if (!connectAccount?.stripeAccountId) {
          return res.json({ status: "not_onboarded", subscriptionGated });
        }
        if (!connectAccount.payoutsEnabled) {
          return res.json({ status: "onboarding_incomplete", subscriptionGated });
        }

        const stripe = getStripe();
        const acctId = connectAccount.stripeAccountId;

        // Default external bank account (for "Chase ••4421" line). Stripe
        // returns up to 10 bank accounts per Connect account; we prefer the
        // one flagged default_for_currency, falling back to the first.
        let bankName: string | null = null;
        let last4: string | null = null;
        try {
          const banks = await stripe.accounts.listExternalAccounts(acctId, {
            object: "bank_account",
            limit: 10,
          });
          type BankRow = {
            bank_name?: string | null;
            last4?: string | null;
            default_for_currency?: boolean | null;
          };
          const list = banks.data as unknown as BankRow[];
          const defaultBank =
            list.find((b) => b.default_for_currency === true) ?? list[0];
          if (defaultBank) {
            bankName = defaultBank.bank_name ?? null;
            last4 = defaultBank.last4 ?? null;
          }
        } catch (err) {
          console.warn(
            "[next-payout] listExternalAccounts failed:",
            err instanceof Error ? err.message : err,
          );
        }

        // Find the soonest scheduled payout. Stripe doesn't accept multi-status
        // filters in one call, so query each pending state and merge.
        const [pending, inTransit] = await Promise.all([
          stripe.payouts.list(
            { status: "pending", limit: 5 },
            { stripeAccount: acctId },
          ),
          stripe.payouts.list(
            { status: "in_transit", limit: 5 },
            { stripeAccount: acctId },
          ),
        ]);
        const next = [...pending.data, ...inTransit.data].sort(
          (a, b) => (a.arrival_date ?? 0) - (b.arrival_date ?? 0),
        )[0];

        if (next) {
          return res.json({
            status: "ready",
            subscriptionGated,
            nextPayout: {
              id: next.id,
              amountCents: next.amount,
              currency: next.currency,
              arrivalDate: next.arrival_date
                ? new Date(next.arrival_date * 1000).toISOString()
                : null,
              bankName,
              last4,
              payoutStatus: next.status,
            },
            pendingBalanceCents: 0,
          });
        }

        // No scheduled payout — report the current pending balance so the
        // card can read "New payments since your last payout: $X."
        let pendingBalanceCents = 0;
        try {
          const balance = await stripe.balance.retrieve(undefined, {
            stripeAccount: acctId,
          });
          pendingBalanceCents = (balance.pending ?? []).reduce(
            (sum, b) => sum + (b.amount ?? 0),
            0,
          );
        } catch (err) {
          console.warn(
            "[next-payout] balance.retrieve failed:",
            err instanceof Error ? err.message : err,
          );
        }

        return res.json({
          status: "ready",
          subscriptionGated,
          nextPayout: null,
          pendingBalanceCents,
          bankName,
          last4,
        });
      } catch (error) {
        console.error("[next-payout] error:", error);
        const message =
          error instanceof Error ? error.message : "Failed to load next payout";
        res.status(500).json({ error: message });
      }
    },
  );

  // GET /api/providers/:providerId/stripe-payouts — live Stripe payout list
  app.get(
    "/api/providers/:providerId/stripe-payouts",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;

        const connectAccount = await getConnectAccount(providerId);
        if (!connectAccount?.stripeAccountId) {
          return res.status(404).json({ error: "stripe_not_connected" });
        }
        const stripe = getStripe();
        const stripePayouts = await stripe.payouts.list(
          { limit: 50, expand: ["data.destination"] },
          { stripeAccount: connectAccount.stripeAccountId },
        );
        const result = stripePayouts.data.map((p) => {
          // destination is expanded — may be an ExternalAccount object with last4
          const dest = p.destination;
          let bankLast4: string | null = null;
          if (dest && typeof dest === "object" && "last4" in dest) {
            bankLast4 = (dest as { last4?: string | null }).last4 ?? null;
          }
          return {
            id: p.id,
            amountCents: p.amount,
            currency: p.currency,
            status: p.status,
            arrivalDate: p.arrival_date
              ? new Date(p.arrival_date * 1000).toISOString()
              : null,
            description: p.description,
            createdAt: new Date(p.created * 1000).toISOString(),
            bankLast4,
          };
        });
        res.json({ payouts: result });
      } catch (error: any) {
        console.error("Stripe payouts error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to fetch Stripe payouts" });
      }
    },
  );

  // POST /api/providers/:providerId/stripe-instant-payout — trigger an instant
  // payout to the provider's default bank account. Requires an active
  // subscription (expired grace period → 403 SUBSCRIPTION_REQUIRED).
  app.post(
    "/api/providers/:providerId/stripe-instant-payout",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;

        if (!(await checkSubscriptionGate(providerId, res))) return;

        const connectAccount = await getConnectAccount(providerId);
        if (!connectAccount?.stripeAccountId) {
          return res.status(400).json({ error: "stripe_not_connected" });
        }
        if (!connectAccount.payoutsEnabled) {
          return res.status(400).json({ error: "stripe_payouts_not_enabled" });
        }

        const stripe = getStripe();
        const acctId = connectAccount.stripeAccountId;

        const balance = await stripe.balance.retrieve(undefined, {
          stripeAccount: acctId,
        });
        const availableCents = (balance.available ?? []).reduce(
          (sum, b) => (b.currency === "usd" ? sum + b.amount : sum),
          0,
        );

        if (availableCents <= 0) {
          return res.status(400).json({ error: "no_available_balance" });
        }

        const payout = await stripe.payouts.create(
          {
            amount: availableCents,
            currency: "usd",
            method: "instant",
          },
          { stripeAccount: acctId },
        );

        return res.json({
          id: payout.id,
          amountCents: payout.amount,
          status: payout.status,
          arrivalDate: payout.arrival_date
            ? new Date(payout.arrival_date * 1000).toISOString()
            : null,
        });
      } catch (error: any) {
        console.error("[stripe-instant-payout] error:", error);
        res.status(500).json({ error: error.message || "Failed to initiate instant payout" });
      }
    },
  );

  // GET /api/providers/:providerId/stripe-payments — live Stripe charges list
  app.get(
    "/api/providers/:providerId/stripe-payments",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;

        const connectAccount = await getConnectAccount(providerId);
        if (!connectAccount?.stripeAccountId) {
          return res.status(404).json({ error: "stripe_not_connected" });
        }
        const stripe = getStripe();
        const charges = await stripe.charges.list(
          { limit: 50 },
          { stripeAccount: connectAccount.stripeAccountId },
        );

        // Enrich with local invoice/client data by matching stripeChargeId or paymentIntent
        const localPayments = await db
          .select({
            stripeChargeId: payments.stripeChargeId,
            stripePaymentIntentId: payments.stripePaymentIntentId,
            invoiceId: payments.invoiceId,
          })
          .from(payments)
          .where(eq(payments.providerId, providerId));

        const localInvoices = await db
          .select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            clientId: invoices.clientId,
          })
          .from(invoices)
          .where(eq(invoices.providerId, providerId));

        const localClients = await db
          .select({
            id: clients.id,
            firstName: clients.firstName,
            lastName: clients.lastName,
          })
          .from(clients)
          .where(eq(clients.providerId, providerId));

        // Only include charges that are linked to a HomeBase invoice/payment record
        const result = charges.data
          .filter((charge) =>
            localPayments.some(
              (p) =>
                p.stripeChargeId === charge.id ||
                p.stripePaymentIntentId === charge.payment_intent?.toString(),
            ),
          )
          .map((charge) => {
            const localPayment = localPayments.find(
              (p) =>
                p.stripeChargeId === charge.id ||
                p.stripePaymentIntentId === charge.payment_intent?.toString(),
            );
            const invoice = localPayment
              ? localInvoices.find((inv) => inv.id === localPayment.invoiceId)
              : null;
            const client = invoice
              ? localClients.find((c) => c.id === invoice.clientId)
              : null;
            return {
              chargeId: charge.id,
              amountCents: charge.amount,
              currency: charge.currency,
              status: charge.status,
              invoiceId: invoice?.id ?? null,
              invoiceNumber: invoice?.invoiceNumber ?? null,
              clientName: client
                ? `${client.firstName} ${client.lastName}`
                : (charge.billing_details?.name ?? null),
              createdAt: new Date(charge.created * 1000).toISOString(),
              refunded: charge.refunded,
            };
          });
        res.json({ payments: result });
      } catch (error: any) {
        console.error("Stripe payments error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to fetch Stripe payments" });
      }
    },
  );

  // GET /api/providers/:providerId/stripe-refunds — live Stripe refund list
  app.get(
    "/api/providers/:providerId/stripe-refunds",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;

        const connectAccount = await getConnectAccount(providerId);
        if (!connectAccount?.stripeAccountId) {
          return res.status(404).json({ error: "stripe_not_connected" });
        }
        const stripe = getStripe();
        const stripeRefunds = await stripe.refunds.list(
          { limit: 50, expand: ["data.charge"] },
          { stripeAccount: connectAccount.stripeAccountId },
        );
        const result = stripeRefunds.data.map((r) => {
          // charge is expanded — may be a full Charge object with original amount
          const expandedCharge =
            r.charge && typeof r.charge === "object"
              ? (r.charge as import("stripe").Stripe.Charge)
              : null;
          return {
            refundId: r.id,
            chargeId: expandedCharge?.id ?? r.charge?.toString() ?? null,
            amountCents: r.amount,
            originalAmountCents: expandedCharge?.amount ?? null,
            currency: r.currency,
            reason: r.reason,
            status: r.status,
            createdAt: new Date(r.created * 1000).toISOString(),
          };
        });
        res.json({ refunds: result });
      } catch (error: any) {
        console.error("Stripe refunds error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to fetch Stripe refunds" });
      }
    },
  );

  // ============================================
  // BOOKING LINKS & INTAKE SUBMISSIONS
  // ============================================

  // Get booking links for provider
  app.get(
    "/api/providers/:providerId/booking-links",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const links = await storage.getBookingLinksByProvider(providerId);
        res.json({ bookingLinks: links });
      } catch (error: any) {
        console.error("Get booking links error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to get booking links" });
      }
    },
  );

  // Create booking link for provider
  app.post(
    "/api/providers/:providerId/booking-links",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const {
          slug,
          customTitle,
          customDescription,
          welcomeMessage,
          confirmationMessage,
          instantBooking,
          showPricing,
          depositRequired,
          depositAmount,
          depositPercentage,
          intakeQuestions,
          serviceCatalog,
          availabilityRules,
          brandColor,
          logoUrl,
        } = req.body;

        if (!slug) {
          return res.status(400).json({ error: "slug is required" });
        }

        // Check if slug is already taken
        const existing = await storage.getBookingLinkBySlug(slug);
        if (existing) {
          return res
            .status(409)
            .json({ error: "This booking link URL is already taken" });
        }

        const link = await storage.createBookingLink({
          providerId,
          slug,
          customTitle: customTitle || null,
          customDescription: customDescription || null,
          welcomeMessage: welcomeMessage || null,
          confirmationMessage: confirmationMessage || null,
          instantBooking: instantBooking || false,
          showPricing: showPricing !== undefined ? showPricing : true,
          depositRequired: depositRequired || false,
          depositAmount,
          depositPercentage,
          intakeQuestions: intakeQuestions
            ? JSON.stringify(intakeQuestions)
            : null,
          serviceCatalog: serviceCatalog
            ? JSON.stringify(serviceCatalog)
            : null,
          availabilityRules: availabilityRules
            ? JSON.stringify(availabilityRules)
            : null,
          brandColor,
          logoUrl,
        });

        res.status(201).json({ bookingLink: link });
      } catch (error: any) {
        console.error("Create booking link error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to create booking link" });
      }
    },
  );

  // Backward-compatible aliases: old /api/book/ routes redirect to /api/providers/
  app.get(
    "/api/book/:slug",
    (req: Request<{ slug: string }>, res: Response) => {
      res.redirect(301, `/api/providers/${req.params.slug}`);
    },
  );
  app.post(
    "/api/book/:slug/submit",
    (req: Request<{ slug: string }>, res: Response) => {
      res.redirect(308, `/api/providers/${req.params.slug}/submit`);
    },
  );

  // Get public booking link by slug (no auth required)
  app.get(
    "/api/providers/:slug",
    async (req: Request<{ slug: string }>, res: Response) => {
      try {
        const { slug } = req.params;
        const link = await storage.getBookingLinkBySlug(slug);

        if (!link || link.status !== "active") {
          return res.status(404).json({ error: "Booking page not found" });
        }

        // Get provider info for the booking page
        const provider = await storage.getProvider(link.providerId);
        if (!provider) {
          return res.status(404).json({ error: "Provider not found" });
        }

        // Don't surface unpublished or not-yet-payable providers to the
        // public booking client — same gate as homeowner discovery.
        if (provider.isPublic !== true) {
          return res.status(404).json({ error: "Booking page not found" });
        }
        if (!(await isProviderReadyForCharges(provider.id))) {
          return res.status(404).json({ error: "Booking page not found" });
        }

        res.json({
          bookingLink: {
            ...link,
            intakeQuestions: link.intakeQuestions
              ? JSON.parse(link.intakeQuestions)
              : [],
            serviceCatalog: link.serviceCatalog
              ? JSON.parse(link.serviceCatalog)
              : [],
            availabilityRules: link.availabilityRules
              ? JSON.parse(link.availabilityRules)
              : null,
          },
          provider: {
            id: provider.id,
            businessName: provider.businessName,
            avatarUrl: provider.avatarUrl,
            rating: provider.rating,
            reviewCount: provider.reviewCount,
            capabilityTags: provider.capabilityTags,
          },
        });
      } catch (error: any) {
        console.error("Get booking link error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to get booking page" });
      }
    },
  );

  // Update booking link
  app.put(
    "/api/booking-links/:id",
    requireAuth,
    async (req: Request<{ id: string }>, res: Response) => {
      try {
        const { id } = req.params;
        const existingLink = await storage.getBookingLink(id);
        if (!existingLink) {
          return res.status(404).json({ error: "Booking link not found" });
        }
        if (!(await assertProviderOwnership(req, existingLink.providerId, res)))
          return;
        const updates = req.body;

        if (
          updates.intakeQuestions &&
          typeof updates.intakeQuestions !== "string"
        ) {
          updates.intakeQuestions = JSON.stringify(updates.intakeQuestions);
        }
        if (
          updates.serviceCatalog &&
          typeof updates.serviceCatalog !== "string"
        ) {
          updates.serviceCatalog = JSON.stringify(updates.serviceCatalog);
        }
        if (
          updates.availabilityRules &&
          typeof updates.availabilityRules !== "string"
        ) {
          updates.availabilityRules = JSON.stringify(updates.availabilityRules);
        }

        const link = await storage.updateBookingLink(id, updates);
        if (!link) {
          return res.status(404).json({ error: "Booking link not found" });
        }
        res.json({ bookingLink: link });
      } catch (error: any) {
        console.error("Update booking link error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to update booking link" });
      }
    },
  );

  // Delete booking link
  app.delete(
    "/api/booking-links/:id",
    requireAuth,
    async (req: Request<{ id: string }>, res: Response) => {
      try {
        const { id } = req.params;
        const existingLink = await storage.getBookingLink(id);
        if (!existingLink) {
          return res.status(404).json({ error: "Booking link not found" });
        }
        if (!(await assertProviderOwnership(req, existingLink.providerId, res)))
          return;
        await storage.deleteBookingLink(id);
        res.json({ success: true });
      } catch (error: any) {
        console.error("Delete booking link error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to delete booking link" });
      }
    },
  );

  // Submit intake form (public - creates intake submission)
  app.post(
    "/api/providers/:slug/submit",
    publicBookingRateLimit,
    async (req: Request<{ slug: string }>, res: Response) => {
      try {
        const { slug } = req.params;
        const {
          clientName,
          clientPhone,
          clientEmail,
          address,
          problemDescription,
          answersJson,
          photosJson,
          preferredTimesJson,
          categoryId,
        } = req.body;

        // homeownerUserId from an unauthenticated request body cannot be
        // verified and is stripped to prevent identity forgery.
        const result = await handleMarketplaceBooking({
          slug,
          clientName,
          clientPhone,
          clientEmail,
          address,
          problemDescription,
          answersJson,
          photosJson,
          preferredTimesJson,
          categoryId,
          homeownerUserId: null,
        });

        if (!result.ok) {
          return res.status(result.status).json({ error: result.error });
        }

        res.status(201).json({
          submission: result.submission,
          ...(result.clientId ? { clientId: result.clientId } : {}),
          ...(result.job ? { job: result.job } : {}),
          ...(result.appointmentId
            ? { appointmentId: result.appointmentId }
            : {}),
          message: result.instantBooking
            ? "Your booking has been confirmed!"
            : "Your request has been submitted!",
        });
      } catch (error: any) {
        console.error("Submit intake error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to submit request" });
      }
    },
  );

  // ── Public booking link endpoints (new /api/booking/:slug) ──────────────────

  // GET /api/booking/:slug — returns full public profile payload
  app.get(
    "/api/booking/:slug",
    async (req: Request<{ slug: string }>, res: Response) => {
      try {
        const { slug } = req.params;

        const [link] = await db
          .select()
          .from(bookingLinks)
          .where(eq(bookingLinks.slug, slug))
          .limit(1);

        if (!link || link.isActive === false || link.status !== "active") {
          return res.status(404).json({ error: "Booking page not found" });
        }

        const [provider] = await db
          .select()
          .from(providers)
          .where(eq(providers.id, link.providerId))
          .limit(1);

        if (!provider) {
          return res.status(404).json({ error: "Provider not found" });
        }

        // Public-facing gate: provider must be published AND Stripe-ready
        // (mirrors the SSR booking page and homeowner-listing rule).
        if (provider.isPublic !== true) {
          return res.status(404).json({ error: "Booking page not found" });
        }
        if (!(await isProviderReadyForCharges(provider.id))) {
          return res.status(404).json({ error: "Booking page not found" });
        }

        // Fetch public custom services (isPublished = true)
        const customServices = await db
          .select()
          .from(providerCustomServices)
          .where(
            and(
              eq(providerCustomServices.providerId, provider.id),
              eq(providerCustomServices.isPublished, true),
            ),
          );

        // Fetch catalog services via providerServices join where service isPublic = true
        const catalogServices = await db
          .select({
            id: services.id,
            name: services.name,
            description: services.description,
            basePrice: services.basePrice,
            categoryId: services.categoryId,
            price: providerServices.price,
            providerServiceId: providerServices.id,
          })
          .from(providerServices)
          .innerJoin(services, eq(providerServices.serviceId, services.id))
          .where(
            and(
              eq(providerServices.providerId, provider.id),
              eq(services.isPublic, true),
            ),
          );

        // Fetch 5 most recent reviews
        const recentReviews = await db
          .select({
            id: reviews.id,
            rating: reviews.rating,
            comment: reviews.comment,
            createdAt: reviews.createdAt,
          })
          .from(reviews)
          .where(eq(reviews.providerId, provider.id))
          .orderBy(desc(reviews.createdAt))
          .limit(5);

        res.json({
          provider: {
            id: provider.id,
            businessName: provider.businessName,
            description: provider.description,
            avatarUrl: provider.avatarUrl,
            serviceArea: provider.serviceArea,
            businessHours: provider.businessHours
              ? (() => {
                  try {
                    return JSON.parse(provider.businessHours!);
                  } catch {
                    return provider.businessHours;
                  }
                })()
              : null,
            bookingPolicies: provider.bookingPolicies
              ? (() => {
                  try {
                    return JSON.parse(provider.bookingPolicies as string);
                  } catch {
                    return provider.bookingPolicies;
                  }
                })()
              : null,
            averageRating: provider.averageRating ?? provider.rating,
            reviewCount: provider.reviewCount,
          },
          bookingLink: {
            id: link.id,
            slug: link.slug,
            instantBooking: link.instantBooking,
            showPricing: link.showPricing,
            customTitle: link.customTitle,
            customDescription: link.customDescription,
            welcomeMessage: link.welcomeMessage,
            brandColor: link.brandColor,
            logoUrl: link.logoUrl,
            intakeQuestions: link.intakeQuestions
              ? (() => {
                  try {
                    return JSON.parse(link.intakeQuestions!);
                  } catch {
                    return [];
                  }
                })()
              : [],
          },
          services: {
            custom: customServices,
            catalog: catalogServices,
          },
          reviews: recentReviews,
        });
      } catch (error: any) {
        console.error("Get public booking page error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to get booking page" });
      }
    },
  );

  // POST /api/booking/:slug — submit a booking request
  app.post(
    "/api/booking/:slug",
    publicBookingRateLimit,
    async (req: Request<{ slug: string }>, res: Response) => {
      try {
        const { slug } = req.params;
        const {
          clientName,
          clientPhone,
          clientEmail,
          address,
          problemDescription,
          preferredTimesJson,
          categoryId,
          answersJson,
          photosJson,
        } = req.body;

        // homeownerUserId from an unauthenticated request body cannot be
        // verified and is stripped to prevent identity forgery.
        const result = await handleMarketplaceBooking({
          slug,
          clientName,
          clientPhone,
          clientEmail,
          address,
          problemDescription,
          answersJson,
          photosJson,
          preferredTimesJson,
          categoryId,
          homeownerUserId: null,
        });

        if (!result.ok) {
          return res.status(result.status).json({ error: result.error });
        }

        res.status(201).json({
          submission: result.submission,
          ...(result.clientId ? { clientId: result.clientId } : {}),
          ...(result.job ? { job: result.job } : {}),
          ...(result.appointmentId
            ? { appointmentId: result.appointmentId }
            : {}),
          message: result.instantBooking
            ? "Your booking has been confirmed!"
            : "Your request has been submitted!",
        });
      } catch (error: any) {
        console.error("Public booking submission error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to submit booking request" });
      }
    },
  );

  // Get intake submissions for provider — ownership check
  app.get(
    "/api/providers/:providerId/intake-submissions",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        const authUserId = req.authenticatedUserId;
        const [providerRow] = await db
          .select({ userId: providers.userId })
          .from(providers)
          .where(eq(providers.id, providerId))
          .limit(1);
        if (!providerRow || providerRow.userId !== authUserId) {
          return res.status(403).json({ error: "Forbidden" });
        }
        const submissions =
          await storage.getIntakeSubmissionsByProvider(providerId);
        res.json({ submissions });
      } catch (error: any) {
        console.error("Get intake submissions error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to get intake submissions" });
      }
    },
  );

  // Update intake submission (review, convert, decline) — ownership check
  app.put(
    "/api/intake-submissions/:id",
    requireAuth,
    async (req: Request<{ id: string }>, res: Response) => {
      try {
        const { id } = req.params;
        const updates = req.body;
        const authUserId = req.authenticatedUserId;

        const existing = await storage.getIntakeSubmission(id);
        if (!existing) {
          return res.status(404).json({ error: "Submission not found" });
        }
        const [providerRow] = await db
          .select({ userId: providers.userId })
          .from(providers)
          .where(eq(providers.id, existing.providerId))
          .limit(1);
        if (!providerRow || providerRow.userId !== authUserId) {
          return res.status(403).json({ error: "Forbidden" });
        }

        const submission = await storage.updateIntakeSubmission(id, updates);
        if (!submission) {
          return res.status(404).json({ error: "Submission not found" });
        }
        res.json({ submission });
      } catch (error: any) {
        console.error("Update intake submission error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to update submission" });
      }
    },
  );

  // Accept intake submission — creates a client + job record and marks submission as "confirmed"
  app.post(
    "/api/intake-submissions/:id/accept",
    requireAuth,
    async (req: Request<{ id: string }>, res: Response) => {
      try {
        const { id } = req.params;
        const { scheduledDate, scheduledTime, estimatedPrice, notes } =
          req.body;
        const authUserId = req.authenticatedUserId;

        const submission = await storage.getIntakeSubmission(id);
        if (!submission) {
          return res.status(404).json({ error: "Submission not found" });
        }

        // Authorization: verify the authenticated user owns this provider
        const [providerOwner] = await db
          .select({ userId: providers.userId })
          .from(providers)
          .where(eq(providers.id, submission.providerId));
        if (!providerOwner || providerOwner.userId !== authUserId) {
          return res.status(403).json({ error: "Forbidden" });
        }

        // Optimistic early check (outside transaction) — recheck with row lock inside transaction
        if (
          submission.status === "converted" ||
          submission.status === "confirmed"
        ) {
          return res
            .status(400)
            .json({ error: "Submission has already been accepted" });
        }

        // Resolve scheduled date: use request body value if provided and valid, else fall back to
        // the first preferred time the client requested in the original submission
        let resolvedScheduledDate: Date | undefined;
        if (scheduledDate) {
          const parsed = new Date(scheduledDate);
          if (!isNaN(parsed.getTime())) resolvedScheduledDate = parsed;
        }
        if (!resolvedScheduledDate && submission.preferredTimesJson) {
          try {
            const preferred = JSON.parse(
              submission.preferredTimesJson,
            ) as string[];
            if (preferred.length > 0) {
              const parsed = new Date(preferred[0]);
              if (!isNaN(parsed.getTime())) resolvedScheduledDate = parsed;
            }
          } catch {
            // ignore
          }
        }

        // Look up the originating booking link's intake question definitions so
        // the shared formatter can resolve human-readable labels for each
        // answer. Fetched outside the transaction since it's read-only.
        let acceptLinkIntakeQuestions: string | null = null;
        if (submission.bookingLinkId) {
          const [linkRow] = await db
            .select({ intakeQuestions: bookingLinks.intakeQuestions })
            .from(bookingLinks)
            .where(eq(bookingLinks.id, submission.bookingLinkId))
            .catch(() => [null]);
          acceptLinkIntakeQuestions = linkRow?.intakeQuestions ?? null;
        }

        // Run conversion in a transaction using the shared helper.
        // SELECT FOR UPDATE on the submission row serializes concurrent accept requests —
        // the second request will see the updated status and abort idempotently.
        let alreadyAccepted = false;
        const result = await db.transaction(async (tx) => {
          const locked = await tx.execute(sql`
          SELECT status FROM intake_submissions WHERE id = ${id} FOR UPDATE
        `);
          const lockedStatus = (
            locked.rows[0] as { status: string } | undefined
          )?.status;
          if (lockedStatus === "converted" || lockedStatus === "confirmed") {
            alreadyAccepted = true;
            return null;
          }

          const converted = await convertIntakeToClientJob(tx, {
            submissionId: id,
            providerId: submission.providerId,
            clientName: submission.clientName || "Unknown",
            clientEmail: submission.clientEmail,
            clientPhone: submission.clientPhone,
            address: submission.address,
            problemDescription: submission.problemDescription,
            scheduledDate: resolvedScheduledDate,
            scheduledTime: scheduledTime || null,
            estimatedPrice: estimatedPrice ? String(estimatedPrice) : null,
            notes: notes || null,
            targetStatus: "converted",
            intakeAnswers: submission.answersJson,
            intakeQuestionsJson: acceptLinkIntakeQuestions,
          });

          // Mark related lead as won (if one exists with matching email)
          if (submission.clientEmail) {
            const now = new Date();
            await tx
              .update(leads)
              .set({ status: "won", updatedAt: now })
              .where(
                and(
                  eq(leads.providerId, submission.providerId),
                  eq(leads.email, submission.clientEmail),
                ),
              );
          }

          return converted;
        });

        if (alreadyAccepted) {
          return res
            .status(400)
            .json({ error: "Submission has already been accepted" });
        }

        // Fire booking confirmation notifications now that the request is accepted —
        // mirrors the instant-booking dispatch so the homeowner gets a confirmation
        // email and the provider's portal updates with the same booking.created event.
        try {
          const [providerRow] = await db
            .select({
              userId: providers.userId,
              businessName: providers.businessName,
              email: providers.email,
            })
            .from(providers)
            .where(eq(providers.id, submission.providerId))
            .limit(1);
          const providerName = providerRow?.businessName ?? "Your Provider";
          const job = result!.job;
          const apptDate = job.scheduledDate
            ? new Date(job.scheduledDate)
            : new Date();
          const apptDateStr = apptDate.toLocaleDateString();
          const apptTimeStr =
            job.scheduledTime ||
            apptDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

          if (submission.clientEmail || providerRow?.email) {
            dispatch("booking.created", {
              clientEmail: submission.clientEmail || undefined,
              clientName: submission.clientName,
              providerEmail: providerRow?.email ?? undefined,
              providerName,
              providerUserId: providerRow?.userId ?? undefined,
              recipientUserId: submission.homeownerUserId || undefined,
              serviceName: job.title || "Home Service",
              appointmentDate: apptDateStr,
              appointmentTime: apptTimeStr,
              address: submission.address || undefined,
              description: submission.problemDescription,
              confirmationNumber: job.id,
              relatedRecordType: "job",
              relatedRecordId: job.id,
            }).catch((e: unknown) =>
              console.error(
                "Accept submission booking.created dispatch error:",
                e,
              ),
            );
          }

          if (submission.homeownerUserId) {
            dispatchNotification(
              submission.homeownerUserId,
              "Booking Confirmed",
              `${providerName} confirmed your booking. View it in your appointments.`,
              "booking_confirmed",
              { jobId: job.id, screen: "AppointmentDetail" },
              "bookings",
            ).catch((e: unknown) =>
              console.error("Accept homeowner push error:", e),
            );
          }
        } catch (notifyErr) {
          console.error(
            "Accept submission notification error (non-fatal):",
            notifyErr,
          );
        }

        res.status(201).json({
          message: "Booking accepted",
          clientId: result!.clientId,
          job: result!.job,
        });
      } catch (error: any) {
        console.error("Accept intake submission error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to accept submission" });
      }
    },
  );

  // ─── Leads ────────────────────────────────────────────────────────────────────

  // GET all leads for a provider
  app.get(
    "/api/providers/:providerId/leads",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const rows = await db
          .select()
          .from(leads)
          .where(eq(leads.providerId, providerId))
          .orderBy(desc(leads.createdAt));
        res.json({ leads: rows });
      } catch (error: any) {
        console.error("Get leads error:", error);
        res.status(500).json({ error: error.message || "Failed to get leads" });
      }
    },
  );

  // POST create a lead manually
  app.post(
    "/api/providers/:providerId/leads",
    requireAuth,
    async (req: Request<{ providerId: string }>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const { name, email, phone, service, message, status, source } =
          req.body;
        if (!name || typeof name !== "string" || !name.trim()) {
          return res.status(400).json({ error: "Name is required" });
        }
        const [lead] = await db
          .insert(leads)
          .values({
            providerId,
            name: name.trim(),
            email: email || null,
            phone: phone || null,
            service: service || null,
            message: message || null,
            status: status || "new",
            source: source || "manual",
          })
          .returning();
        res.status(201).json({ lead });
      } catch (error: any) {
        console.error("Create lead error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to create lead" });
      }
    },
  );

  // PATCH update a lead's status or fields
  app.patch(
    "/api/leads/:id",
    requireAuth,
    async (req: Request<{ id: string }>, res: Response) => {
      try {
        const { id } = req.params;
        // Ownership: look up lead's providerId and verify caller owns that provider
        const [existing] = await db
          .select({ providerId: leads.providerId })
          .from(leads)
          .where(eq(leads.id, id))
          .limit(1);
        if (!existing) return res.status(404).json({ error: "Lead not found" });
        if (!(await assertProviderOwnership(req, existing.providerId, res)))
          return;

        const updates: Partial<typeof leads.$inferInsert> = {};
        const { name, email, phone, service, message, status, source } =
          req.body;
        if (name !== undefined) updates.name = name;
        if (email !== undefined) updates.email = email;
        if (phone !== undefined) updates.phone = phone;
        if (service !== undefined) updates.service = service;
        if (message !== undefined) updates.message = message;
        if (status !== undefined) updates.status = status;
        if (source !== undefined) updates.source = source;
        updates.updatedAt = new Date();
        const [lead] = await db
          .update(leads)
          .set(updates)
          .where(eq(leads.id, id))
          .returning();
        if (!lead) return res.status(404).json({ error: "Lead not found" });
        res.json({ lead });
      } catch (error: any) {
        console.error("Update lead error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to update lead" });
      }
    },
  );

  // Accept a lead — creates client + job record and marks lead as "won"
  app.post(
    "/api/leads/:id/accept",
    requireAuth,
    async (req: Request<{ id: string }>, res: Response) => {
      try {
        const { id } = req.params;
        const { scheduledDate, scheduledTime, estimatedPrice, notes } =
          req.body;
        const authUserId = req.authenticatedUserId;

        const [lead] = await db
          .select()
          .from(leads)
          .where(eq(leads.id, id))
          .limit(1);
        if (!lead) return res.status(404).json({ error: "Lead not found" });

        // Authorization: verify ownership via providers.userId
        const [providerRow] = await db
          .select({ userId: providers.userId })
          .from(providers)
          .where(eq(providers.id, lead.providerId))
          .limit(1);
        if (!providerRow || providerRow.userId !== authUserId) {
          return res.status(403).json({ error: "Forbidden" });
        }

        if (lead.status === "won") {
          return res
            .status(400)
            .json({ error: "Lead has already been accepted" });
        }

        // Resolve scheduled date from request body
        const resolvedDate = scheduledDate
          ? new Date(scheduledDate)
          : new Date();

        // Create client + job in a transaction and mark lead as won
        const result = await db.transaction(async (tx) => {
          const nameParts = (lead.name || "").trim().split(" ");
          const firstName = nameParts[0] || "Unknown";
          const lastName = nameParts.slice(1).join(" ") || null;

          // Upsert client by email
          let clientId: string;
          if (lead.email) {
            const [found] = await tx
              .select({ id: clients.id })
              .from(clients)
              .where(
                and(
                  eq(clients.providerId, lead.providerId),
                  eq(clients.email, lead.email),
                ),
              );
            if (found) {
              clientId = found.id;
            } else {
              const [newC] = await tx
                .insert(clients)
                .values({
                  providerId: lead.providerId,
                  firstName,
                  lastName,
                  email: lead.email,
                  phone: lead.phone || null,
                })
                .returning({ id: clients.id });
              clientId = newC.id;
            }
          } else {
            const [newC] = await tx
              .insert(clients)
              .values({
                providerId: lead.providerId,
                firstName,
                lastName,
                email: null,
                phone: lead.phone || null,
              })
              .returning({ id: clients.id });
            clientId = newC.id;
          }

          // Create job. Leads are not bound to a custom service, so
          // initialize checklist to [] (provider can add steps inline).
          const [newJob] = await tx
            .insert(jobs)
            .values({
              providerId: lead.providerId,
              clientId,
              title:
                lead.service ||
                lead.message?.slice(0, 100) ||
                "Service Request",
              description: lead.message || null,
              scheduledDate: resolvedDate,
              scheduledTime: scheduledTime || null,
              status: "scheduled",
              estimatedPrice: estimatedPrice ? String(estimatedPrice) : null,
              notes: notes || null,
              checklist: [],
            })
            .returning();

          // Mark lead as won
          const now = new Date();
          await tx
            .update(leads)
            .set({ status: "won", updatedAt: now })
            .where(eq(leads.id, id));

          return { clientId, job: newJob };
        });

        res.status(201).json({
          message: "Lead accepted",
          clientId: result.clientId,
          job: result.job,
        });
      } catch (error: any) {
        console.error("Accept lead error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to accept lead" });
      }
    },
  );

  // DELETE a lead
  app.delete(
    "/api/leads/:id",
    requireAuth,
    async (req: Request<{ id: string }>, res: Response) => {
      try {
        const { id } = req.params;
        const [existingLead] = await db
          .select({ providerId: leads.providerId })
          .from(leads)
          .where(eq(leads.id, id))
          .limit(1);
        if (!existingLead) {
          return res.status(404).json({ error: "Lead not found" });
        }
        if (!(await assertProviderOwnership(req, existingLead.providerId, res)))
          return;
        const [deleted] = await db
          .delete(leads)
          .where(eq(leads.id, id))
          .returning();
        if (!deleted) return res.status(404).json({ error: "Lead not found" });
        res.json({ success: true });
      } catch (error: any) {
        console.error("Delete lead error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to delete lead" });
      }
    },
  );

  // ============ Provider Messages Routes ============

  // Rate limit map for provider messages (10/client/24h)
  const messageLimitMap = new Map<string, { count: number; resetAt: number }>();

  function checkMessageRateLimit(
    providerId: string,
    clientId: string,
  ): boolean {
    const key = `${providerId}:${clientId}`;
    const now = Date.now();
    const window = 24 * 60 * 60 * 1000;
    const limit = 10;
    const entry = messageLimitMap.get(key);
    if (!entry || entry.resetAt < now) {
      messageLimitMap.set(key, { count: 1, resetAt: now + window });
      return true;
    }
    if (entry.count >= limit) return false;
    entry.count += 1;
    return true;
  }

  // POST /api/providers/:providerId/messages — send a message
  app.post(
    "/api/providers/:providerId/messages",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const providerRecord = await storage.getProvider(providerId);

        const { clientId, channel, subject, body, jobId, invoiceId } = req.body;

        if (!clientId || !body) {
          return res
            .status(400)
            .json({ error: "clientId and body are required" });
        }

        // Verify client belongs to this provider
        const [client] = await db
          .select()
          .from(clients)
          .where(
            and(eq(clients.id, clientId), eq(clients.providerId, providerId)),
          );
        if (!client) {
          return res
            .status(403)
            .json({ error: "Client does not belong to this provider" });
        }

        // Rate limit
        if (!checkMessageRateLimit(providerId, clientId)) {
          return res.status(429).json({
            error:
              "Rate limit exceeded: max 10 messages per client per 24 hours",
          });
        }

        // Substitute merge variables
        const clientName = [client.firstName, client.lastName]
          .filter(Boolean)
          .join(" ");
        let processedBody = body
          .replace(/\{\{client_name\}\}/g, clientName)
          .replace(/\{\{provider_name\}\}/g, providerRecord.businessName);
        let processedSubject = (
          subject || `Message from ${providerRecord.businessName}`
        )
          .replace(/\{\{client_name\}\}/g, clientName)
          .replace(/\{\{provider_name\}\}/g, providerRecord.businessName);

        if (jobId) {
          const [jobRecord] = await db
            .select()
            .from(jobs)
            .where(eq(jobs.id, jobId));
          if (jobRecord) {
            processedBody = processedBody
              .replace(/\{\{service\}\}/g, jobRecord.title || "")
              .replace(
                /\{\{booking_date\}\}/g,
                jobRecord.scheduledDate
                  ? new Date(jobRecord.scheduledDate).toLocaleDateString(
                      "en-US",
                      { month: "long", day: "numeric", year: "numeric" },
                    )
                  : "",
              );
            processedSubject = processedSubject
              .replace(/\{\{service\}\}/g, jobRecord.title || "")
              .replace(
                /\{\{booking_date\}\}/g,
                jobRecord.scheduledDate
                  ? new Date(jobRecord.scheduledDate).toLocaleDateString()
                  : "",
              );
          }
        }

        if (invoiceId) {
          const [invoiceRecord] = await db
            .select()
            .from(invoices)
            .where(eq(invoices.id, invoiceId));
          if (invoiceRecord) {
            const amount = invoiceRecord.total || invoiceRecord.amount || "0";
            processedBody = processedBody.replace(
              /\{\{amount_due\}\}/g,
              `$${parseFloat(amount).toFixed(2)}`,
            );
            processedSubject = processedSubject.replace(
              /\{\{amount_due\}\}/g,
              `$${parseFloat(amount).toFixed(2)}`,
            );
          }
        }

        let status: "sent" | "failed" | "pending_sms" = "sent";
        let resendMessageId: string | undefined;

        if (channel === "email") {
          if (!client.email) {
            return res
              .status(400)
              .json({ error: "Client does not have an email address" });
          }
          const emailResult = await sendProviderClientMessage({
            clientEmail: client.email,
            clientName,
            providerName: providerRecord.businessName,
            subject: processedSubject,
            body: processedBody,
          });
          status = emailResult.success ? "sent" : "failed";
          resendMessageId = emailResult.messageId;
        } else if (channel === "sms") {
          status = "pending_sms";
        }

        const [message] = await db
          .insert(providerMessages)
          .values({
            providerId,
            clientId,
            jobId: jobId || null,
            invoiceId: invoiceId || null,
            channel: channel || "email",
            subject: processedSubject,
            body: processedBody,
            status,
            resendMessageId: resendMessageId || null,
          })
          .returning();

        res.status(201).json({ message });
      } catch (error: any) {
        console.error("Send provider message error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to send message" });
      }
    },
  );

  // POST /api/providers/:providerId/messages/blast — send a message to multiple clients
  app.post(
    "/api/providers/:providerId/messages/blast",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const providerRecord = await storage.getProvider(providerId);

        const { clientIds, channel, subject, body } = req.body;

        if (!Array.isArray(clientIds) || clientIds.length === 0) {
          return res
            .status(400)
            .json({ error: "clientIds (array) is required" });
        }
        if (!body) {
          return res.status(400).json({ error: "body is required" });
        }
        if (clientIds.length > 100) {
          return res
            .status(400)
            .json({ error: "Cannot blast more than 100 clients at once" });
        }

        const results: { clientId: string; status: string; error?: string }[] =
          [];

        for (const clientId of clientIds) {
          try {
            // Verify client belongs to this provider
            const [client] = await db
              .select()
              .from(clients)
              .where(
                and(
                  eq(clients.id, clientId),
                  eq(clients.providerId, providerId),
                ),
              );
            if (!client) {
              results.push({
                clientId,
                status: "skipped",
                error: "Client not found",
              });
              continue;
            }

            if (!checkMessageRateLimit(providerId, clientId)) {
              results.push({
                clientId,
                status: "skipped",
                error: "Rate limit exceeded",
              });
              continue;
            }

            const clientName = [client.firstName, client.lastName]
              .filter(Boolean)
              .join(" ");
            const processedBody = body
              .replace(/\{\{client_name\}\}/g, clientName)
              .replace(/\{\{provider_name\}\}/g, providerRecord.businessName);
            const processedSubject = (
              subject || `Message from ${providerRecord.businessName}`
            )
              .replace(/\{\{client_name\}\}/g, clientName)
              .replace(/\{\{provider_name\}\}/g, providerRecord.businessName);

            let status: "sent" | "failed" | "pending_sms" = "sent";
            let resendMessageId: string | undefined;

            if (channel === "email") {
              if (!client.email) {
                results.push({
                  clientId,
                  status: "skipped",
                  error: "No email on file",
                });
                continue;
              }
              const emailResult = await sendProviderClientMessage({
                clientEmail: client.email,
                clientName,
                providerName: providerRecord.businessName,
                subject: processedSubject,
                body: processedBody,
              });
              status = emailResult.success ? "sent" : "failed";
              resendMessageId = emailResult.messageId;
            } else if (channel === "sms") {
              status = "pending_sms";
            }

            await db.insert(providerMessages).values({
              providerId,
              clientId,
              channel: channel || "email",
              subject: processedSubject,
              body: processedBody,
              status,
              resendMessageId: resendMessageId || null,
            });

            results.push({ clientId, status });
          } catch (clientErr: any) {
            results.push({
              clientId,
              status: "failed",
              error: clientErr.message || "Unknown error",
            });
          }
        }

        const sent = results.filter(
          (r) => r.status === "sent" || r.status === "pending_sms",
        ).length;
        const failed = results.filter((r) => r.status === "failed").length;
        const skipped = results.filter((r) => r.status === "skipped").length;

        res.status(201).json({
          results,
          summary: { sent, failed, skipped, total: clientIds.length },
        });
      } catch (error: any) {
        console.error("Blast message error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to send blast" });
      }
    },
  );

  // GET /api/providers/:providerId/clients/:clientId/messages — message history
  app.get(
    "/api/providers/:providerId/clients/:clientId/messages",
    requireAuth,
    async (
      req: Request<{ providerId: string; clientId: string }>,
      res: Response,
    ) => {
      try {
        const { providerId, clientId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;

        const messages = await db
          .select()
          .from(providerMessages)
          .where(
            and(
              eq(providerMessages.providerId, providerId),
              eq(providerMessages.clientId, clientId),
            ),
          )
          .orderBy(desc(providerMessages.createdAt));

        res.json({ messages });
      } catch (error: any) {
        console.error("Get provider messages error:", error);
        res.status(500).json({ error: "Failed to get messages" });
      }
    },
  );

  // GET /api/providers/:providerId/message-templates — list templates
  app.get(
    "/api/providers/:providerId/message-templates",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;

        const templates = await db
          .select()
          .from(messageTemplates)
          .where(eq(messageTemplates.providerId, providerId))
          .orderBy(desc(messageTemplates.createdAt));

        res.json({ templates });
      } catch (error: any) {
        console.error("Get message templates error:", error);
        res.status(500).json({ error: "Failed to get templates" });
      }
    },
  );

  // POST /api/providers/:providerId/message-templates — create template
  app.post(
    "/api/providers/:providerId/message-templates",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;

        const { name, channel, subject, body } = req.body;
        if (!name || !body) {
          return res.status(400).json({ error: "name and body are required" });
        }

        const [template] = await db
          .insert(messageTemplates)
          .values({
            providerId,
            name,
            channel: channel || "email",
            subject: subject || null,
            body,
          })
          .returning();

        res.status(201).json({ template });
      } catch (error: any) {
        console.error("Create message template error:", error);
        res.status(500).json({ error: "Failed to create template" });
      }
    },
  );

  // PATCH /api/providers/:providerId/message-templates/:templateId — update template
  app.patch(
    "/api/providers/:providerId/message-templates/:templateId",
    requireAuth,
    async (
      req: Request<{ providerId: string; templateId: string }>,
      res: Response,
    ) => {
      try {
        const { providerId, templateId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;

        const { name, channel, subject, body } = req.body;
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (name !== undefined) updates.name = name;
        if (channel !== undefined) updates.channel = channel;
        if (subject !== undefined) updates.subject = subject;
        if (body !== undefined) updates.body = body;

        const [template] = await db
          .update(messageTemplates)
          .set(updates)
          .where(
            and(
              eq(messageTemplates.id, templateId),
              eq(messageTemplates.providerId, providerId),
            ),
          )
          .returning();

        if (!template)
          return res.status(404).json({ error: "Template not found" });
        res.json({ template });
      } catch (error: any) {
        console.error("Update message template error:", error);
        res.status(500).json({ error: "Failed to update template" });
      }
    },
  );

  // DELETE /api/providers/:providerId/message-templates/:templateId — delete template
  app.delete(
    "/api/providers/:providerId/message-templates/:templateId",
    requireAuth,
    async (
      req: Request<{ providerId: string; templateId: string }>,
      res: Response,
    ) => {
      try {
        const { providerId, templateId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;

        const [deleted] = await db
          .delete(messageTemplates)
          .where(
            and(
              eq(messageTemplates.id, templateId),
              eq(messageTemplates.providerId, providerId),
            ),
          )
          .returning();

        if (!deleted)
          return res.status(404).json({ error: "Template not found" });
        res.json({ success: true });
      } catch (error: any) {
        console.error("Delete message template error:", error);
        res.status(500).json({ error: "Failed to delete template" });
      }
    },
  );

  // GET /api/providers/:providerId/clients/:clientId/last-message — get last message for client list
  app.get(
    "/api/providers/:providerId/clients/last-messages",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;

        // Get the most recent message per client
        const lastMessages = await db.execute(sql`
        SELECT DISTINCT ON (client_id) 
          client_id as "clientId",
          body,
          created_at as "createdAt",
          channel,
          status
        FROM provider_messages
        WHERE provider_id = ${providerId}
        ORDER BY client_id, created_at DESC
      `);

        res.json({ lastMessages: lastMessages.rows });
      } catch (error: any) {
        console.error("Get last messages error:", error);
        res.status(500).json({ error: "Failed to get last messages" });
      }
    },
  );

  // ─── Provider Communications endpoints ──────────────────────────────────────

  // POST /api/providers/:providerId/communicate/individual — send to one client by userId
  app.post(
    "/api/providers/:providerId/communicate/individual",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const providerRecord = await storage.getProvider(providerId);

        const { clientId, subject, body, channels } = req.body;
        const VALID_CHANNELS = ["push", "email"];
        if (
          !clientId ||
          !body ||
          !channels ||
          !Array.isArray(channels) ||
          channels.length === 0
        ) {
          return res
            .status(400)
            .json({ error: "clientId, body, and channels are required" });
        }
        const validatedChannels = channels.filter((ch: string) =>
          VALID_CHANNELS.includes(ch),
        );
        if (validatedChannels.length === 0) {
          return res.status(400).json({
            error: "channels must include at least one of: push, email",
          });
        }

        const [client] = await db
          .select()
          .from(clients)
          .where(
            and(eq(clients.id, clientId), eq(clients.providerId, providerId)),
          );
        if (!client) {
          return res.status(404).json({ error: "Client not found" });
        }

        const providerName = providerRecord.businessName;
        const clientName = [client.firstName, client.lastName]
          .filter(Boolean)
          .join(" ");
        const results: { channel: string; success: boolean; error?: string }[] =
          [];

        if (validatedChannels.includes("email") && client.email) {
          const result = await sendProviderClientMessage({
            clientEmail: client.email,
            clientName,
            providerName,
            subject: subject || `Message from ${providerName}`,
            body,
          });
          results.push({
            channel: "email",
            success: result.success,
            error: result.error,
          });
        }

        if (validatedChannels.includes("push")) {
          // Only send push to users who have a confirmed appointment with this provider,
          // establishing a platform-verified provider-client relationship.
          if (client.email) {
            const [verifiedUser] = await db
              .select({ id: users.id })
              .from(users)
              .innerJoin(
                appointments,
                and(
                  eq(appointments.userId, users.id),
                  eq(appointments.providerId, providerId),
                ),
              )
              .where(eq(users.email, client.email))
              .limit(1);
            if (verifiedUser) {
              await sendPush(
                verifiedUser.id,
                subject || providerName,
                body,
                { type: "provider_message", providerId },
                "messages",
              );
              results.push({ channel: "push", success: true });
            } else {
              results.push({
                channel: "push",
                success: false,
                error: "Client has no verified app account with this provider",
              });
            }
          } else {
            results.push({
              channel: "push",
              success: false,
              error: "Client has no email on file",
            });
          }
        }

        res.json({ success: true, results });
      } catch (error: any) {
        console.error("Communicate individual error:", error);
        res.status(500).json({ error: "Failed to send message" });
      }
    },
  );

  // POST /api/providers/:providerId/communicate/broadcast — send to all clients
  app.post(
    "/api/providers/:providerId/communicate/broadcast",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        const { providerId } = req.params;
        if (!(await assertProviderOwnership(req, providerId, res))) return;
        const providerRecord = await storage.getProvider(providerId);

        const { subject, body, channels } = req.body;
        const VALID_CHANNELS_BROADCAST = ["push", "email"];
        if (
          !body ||
          !channels ||
          !Array.isArray(channels) ||
          channels.length === 0
        ) {
          return res
            .status(400)
            .json({ error: "body and channels are required" });
        }
        const validatedChannels = channels.filter((ch: string) =>
          VALID_CHANNELS_BROADCAST.includes(ch),
        );
        if (validatedChannels.length === 0) {
          return res.status(400).json({
            error: "channels must include at least one of: push, email",
          });
        }

        const allClients = await db
          .select()
          .from(clients)
          .where(eq(clients.providerId, providerId));
        const providerName = providerRecord.businessName;

        let emailSent = 0;
        let pushSent = 0;
        let emailFailed = 0;
        let pushFailed = 0;

        for (const client of allClients) {
          const clientName = [client.firstName, client.lastName]
            .filter(Boolean)
            .join(" ");

          if (validatedChannels.includes("email") && client.email) {
            const result = await sendProviderClientMessage({
              clientEmail: client.email,
              clientName,
              providerName,
              subject: subject || `Message from ${providerName}`,
              body,
            });
            if (result.success) emailSent++;
            else emailFailed++;
          }

          if (validatedChannels.includes("push") && client.email) {
            const [verifiedUser] = await db
              .select({ id: users.id })
              .from(users)
              .innerJoin(
                appointments,
                and(
                  eq(appointments.userId, users.id),
                  eq(appointments.providerId, providerId),
                ),
              )
              .where(eq(users.email, client.email))
              .limit(1);
            if (verifiedUser) {
              await sendPush(
                verifiedUser.id,
                subject || providerName,
                body,
                { type: "provider_broadcast", providerId },
                "messages",
              );
              pushSent++;
            } else {
              pushFailed++;
            }
          }
        }

        res.json({
          success: true,
          totalClients: allClients.length,
          emailSent,
          emailFailed,
          pushSent,
          pushFailed,
        });
      } catch (error: any) {
        console.error("Communicate broadcast error:", error);
        res.status(500).json({ error: "Failed to send broadcast" });
      }
    },
  );

  // ─── Support Ticket endpoint ─────────────────────────────────────────────────

  app.post("/api/support/ticket", supportTicketRateLimit, async (req: Request, res: Response) => {
    try {
      const { name, email, category, subject, message } = req.body;

      if (!name || !email || !category || !subject || !message) {
        return res.status(400).json({ error: "All fields are required" });
      }

      // Enforce field length limits to prevent oversized payloads from
      // creating unbounded DB rows or outbound email content.
      if (
        String(name).length > 200 ||
        String(email).length > 254 ||
        String(category).length > 100 ||
        String(subject).length > 300 ||
        String(message).length > 5000
      ) {
        return res.status(400).json({ error: "One or more fields exceed the allowed length." });
      }

      // Optionally read userId from auth token (non-fatal if absent)
      let userId: string | null = null;
      try {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
          const { verifyToken } = await import("../auth");
          const payload = verifyToken(authHeader.slice(7));
          if (payload?.userId) userId = payload.userId;
        }
      } catch {
        // Non-authenticated requests are allowed
      }

      const [ticket] = await db
        .insert(supportTickets)
        .values({
          userId: userId || null,
          name: name.trim(),
          email: email.trim(),
          category: category.trim(),
          subject: subject.trim(),
          message: message.trim(),
          status: "open",
        })
        .returning();

      // Send admin inbox notification non-fatally
      sendSupportTicketEmail({
        ticketId: ticket.id,
        name: ticket.name,
        email: ticket.email,
        category: ticket.category,
        subject: ticket.subject,
        message: ticket.message,
      }).catch((err: unknown) => {
        console.error(
          "[SUPPORT_EMAIL] Failed to send support ticket email:",
          err,
        );
      });

      // AI auto-response: generate and email within seconds, fire-and-forget
      setImmediate(async () => {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            max_tokens: 350,
            messages: [
              { role: "system", content: SUPPORT_AI_SYSTEM_PROMPT },
              {
                role: "user",
                content: `Category: ${ticket.category}\nSubject: ${ticket.subject}\n\n${ticket.message}`,
              },
            ],
          });
          const aiReply = completion.choices[0]?.message?.content?.trim();
          if (aiReply) {
            await storage.addAiSupportTicketMessage(ticket.id, aiReply);
            await sendAiSupportReplyEmail({
              to: ticket.email,
              recipientName: ticket.name,
              ticketSubject: ticket.subject,
              ticketId: ticket.id,
              replyBody: aiReply,
            });
          }
        } catch (aiErr) {
          console.error("[SUPPORT_AI] Failed to generate AI auto-response:", aiErr);
        }
      });

      res.status(201).json({ success: true, ticketId: ticket.id });
    } catch (error: any) {
      console.error("Support ticket error:", error);
      res.status(500).json({ error: "Failed to submit support ticket" });
    }
  });

  // GET /api/support/tickets — authenticated user's own tickets (newest first)
  app.get(
    "/api/support/tickets",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.authenticatedUserId!;
        const rows = await db
          .select()
          .from(supportTickets)
          .where(eq(supportTickets.userId, userId))
          .orderBy(desc(supportTickets.updatedAt));
        res.json({ tickets: rows });
      } catch (err: any) {
        console.error("[support] list user tickets error:", err);
        res.status(500).json({ error: "Failed to fetch tickets" });
      }
    },
  );

  // GET /api/support/tickets/:id — full ticket + thread for the owning user
  app.get(
    "/api/support/tickets/:id",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const userId = req.authenticatedUserId!;
        const { id } = req.params;
        const [ticket] = await db
          .select()
          .from(supportTickets)
          .where(and(eq(supportTickets.id, id), eq(supportTickets.userId, userId)))
          .limit(1);
        if (!ticket) return res.status(404).json({ error: "Ticket not found" });
        const messages = await db
          .select()
          .from(supportTicketMessages)
          .where(eq(supportTicketMessages.ticketId, id))
          .orderBy(asc(supportTicketMessages.createdAt));
        res.json({ ticket, messages });
      } catch (err: any) {
        console.error("[support] get user ticket error:", err);
        res.status(500).json({ error: "Failed to fetch ticket" });
      }
    },
  );

  // POST /api/support/tickets/:id/messages — user sends a follow-up reply
  app.post(
    "/api/support/tickets/:id/messages",
    requireAuth,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const userId = req.authenticatedUserId!;
        const { id } = req.params;
        const { body: messageBody } = req.body;

        if (!messageBody?.trim()) {
          return res.status(400).json({ error: "Message body is required" });
        }
        if (String(messageBody).length > 5000) {
          return res.status(400).json({ error: "Message exceeds maximum length" });
        }

        // Verify ownership
        const [ticket] = await db
          .select()
          .from(supportTickets)
          .where(and(eq(supportTickets.id, id), eq(supportTickets.userId, userId)))
          .limit(1);
        if (!ticket) return res.status(404).json({ error: "Ticket not found" });

        // Insert the user message
        const [newMsg] = await db
          .insert(supportTicketMessages)
          .values({
            ticketId: id,
            senderId: userId,
            senderType: "user",
            body: messageBody.trim(),
          })
          .returning();

        // Re-open resolved/closed tickets so the admin sees the new reply
        if (ticket.status === "resolved" || ticket.status === "closed") {
          await db
            .update(supportTickets)
            .set({ status: "open", updatedAt: new Date() })
            .where(eq(supportTickets.id, id));
        } else {
          await db
            .update(supportTickets)
            .set({ updatedAt: new Date() })
            .where(eq(supportTickets.id, id));
        }

        res.status(201).json({ message: newMsg });
      } catch (err: any) {
        console.error("[support] post user ticket message error:", err);
        res.status(500).json({ error: "Failed to send reply" });
      }
    },
  );

  // ============ QUICK QUOTES (Task #300) ============
  // Provider-initiated quote generator. Given an address + a custom service,
  // compute a low/mid/high price range from the service's pricing rules and
  // (optionally) lot size from HouseFax enrichment. Quotes are persisted so
  // the provider can see a "Recent quotes" list on home screen.

  app.post(
    "/api/provider/:providerId/quick-quotes/preview",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res)))
          return;

        const { address, customServiceId } = req.body as {
          address?: string;
          customServiceId?: string;
        };
        if (!address || !customServiceId) {
          return res
            .status(400)
            .json({ error: "address and customServiceId are required" });
        }

        const [service] = await db
          .select()
          .from(providerCustomServices)
          .where(eq(providerCustomServices.id, customServiceId));
        if (!service) {
          return res.status(404).json({ error: "Service not found" });
        }
        if (service.providerId !== req.params.providerId) {
          return res.status(403).json({ error: "Forbidden" });
        }

        // Best-effort enrichment — tolerate failure so a quote can still be
        // produced when Zillow/Google are down or the address is unmappable.
        // Caller may also pass overrideLotSize / overrideSquareFeet for the
        // manual-entry fallback when no enrichment data is available.
        const overrideLot = Number((req.body as { overrideLotSize?: unknown }).overrideLotSize);
        const overrideSqft = Number((req.body as { overrideSquareFeet?: unknown }).overrideSquareFeet);
        type Enrichment = {
          zillow?: {
            lotSize?: number;
            livingArea?: number;
            bedrooms?: number;
            bathrooms?: number;
            yearBuilt?: number;
            propertyType?: string;
          };
          google?: { formattedAddress?: string; placeId?: string; latitude?: number; longitude?: number };
        };
        let enrichment: Enrichment | null = null;
        try {
          enrichment = (await enrichPropertyData(address)) as Enrichment;
        } catch (err) {
          console.warn(
            "[quick-quotes] enrichment failed:",
            err instanceof Error ? err.message : err,
          );
        }
        const zillow = enrichment?.zillow ?? {};
        const google = enrichment?.google ?? {};
        const lotSize: number | null = Number.isFinite(overrideLot) && overrideLot > 0
          ? overrideLot
          : typeof zillow.lotSize === "number" ? zillow.lotSize : null;
        const livingSqft: number | null = Number.isFinite(overrideSqft) && overrideSqft > 0
          ? overrideSqft
          : typeof zillow.livingArea === "number" ? zillow.livingArea : null;

        const lite: CustomServiceLite = {
          id: service.id,
          name: service.name,
          category: service.category,
          pricingType: service.pricingType as CustomServiceLite["pricingType"],
          basePrice: service.basePrice,
          priceFrom: service.priceFrom,
          priceTo: service.priceTo,
          priceTiersJson: service.priceTiersJson,
          duration: service.duration,
        };
        const range = computeQuoteRange(lite, lotSize, livingSqft);
        const insight = await generatePricingInsight({
          serviceName: service.name,
          category: service.category,
          lotSizeSqft: lotSize,
          livingSqft,
          range,
          property: {
            bedrooms: zillow.bedrooms ?? null,
            bathrooms: zillow.bathrooms ?? null,
            yearBuilt: zillow.yearBuilt ?? null,
            propertyType: zillow.propertyType ?? null,
          },
        });

        res.json({
          formattedAddress: google.formattedAddress ?? address,
          placeId: google.placeId ?? null,
          latitude: google.latitude ?? null,
          longitude: google.longitude ?? null,
          lotSize,
          squareFeet: livingSqft,
          service: {
            id: service.id,
            name: service.name,
            category: service.category,
            pricingType: service.pricingType,
          },
          range,
          aiInsight: insight,
        });
      } catch (error) {
        console.error("Quick quote preview error:", error);
        res.status(500).json({ error: "Failed to generate quote" });
      }
    },
  );

  app.get(
    "/api/provider/:providerId/quick-quotes",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res)))
          return;
        const rows = await db
          .select()
          .from(quickQuotes)
          .where(eq(quickQuotes.providerId, req.params.providerId))
          .orderBy(desc(quickQuotes.createdAt))
          .limit(50);
        res.json({ quotes: rows });
      } catch (error) {
        console.error("List quick quotes error:", error);
        res.status(500).json({ error: "Failed to list quotes" });
      }
    },
  );

  app.post(
    "/api/provider/:providerId/quick-quotes",
    requireAuth,
    async (req: Request<ProviderIdParams>, res: Response) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res)))
          return;

        const {
          address,
          formattedAddress,
          placeId,
          latitude,
          longitude,
          lotSize,
          squareFeet,
          customServiceId,
          serviceName,
          lowPrice,
          midPrice,
          highPrice,
          finalPrice,
          pricingBasis,
          aiInsight,
          notes,
          sentVia,
          status,
        } = req.body ?? {};

        if (!address || !serviceName) {
          return res
            .status(400)
            .json({ error: "address and serviceName are required" });
        }
        // Verify the customServiceId (if supplied) belongs to this provider so
        // a caller can't store a quote referencing another provider's service.
        if (customServiceId) {
          const [svc] = await db
            .select({ providerId: providerCustomServices.providerId })
            .from(providerCustomServices)
            .where(eq(providerCustomServices.id, String(customServiceId)));
          if (!svc) return res.status(404).json({ error: "Service not found" });
          if (svc.providerId !== req.params.providerId) {
            return res.status(403).json({ error: "Forbidden" });
          }
        }
        const lp = parseFloat(String(lowPrice ?? 0));
        const mp = parseFloat(String(midPrice ?? 0));
        const hp = parseFloat(String(highPrice ?? 0));
        const fp = parseFloat(String(finalPrice ?? mp));
        if (![lp, mp, hp, fp].every((n) => Number.isFinite(n) && n >= 0)) {
          return res.status(400).json({ error: "Invalid price values" });
        }

        const [row] = await db
          .insert(quickQuotes)
          .values({
            providerId: req.params.providerId,
            address: String(address),
            formattedAddress: formattedAddress ?? null,
            placeId: placeId ?? null,
            latitude: latitude != null ? String(latitude) : null,
            longitude: longitude != null ? String(longitude) : null,
            lotSize: typeof lotSize === "number" ? lotSize : null,
            squareFeet: typeof squareFeet === "number" ? squareFeet : null,
            customServiceId: customServiceId ?? null,
            serviceName: String(serviceName),
            lowPrice: lp.toFixed(2),
            midPrice: mp.toFixed(2),
            highPrice: hp.toFixed(2),
            finalPrice: fp.toFixed(2),
            pricingBasis: pricingBasis ?? null,
            aiInsight: aiInsight ?? null,
            notes: notes ?? null,
            sentVia: sentVia ?? null,
            status: status ?? "draft",
          })
          .returning();
        res.status(201).json({ quote: row });
      } catch (error) {
        console.error("Create quick quote error:", error);
        res.status(500).json({ error: "Failed to save quote" });
      }
    },
  );

  app.delete(
    "/api/provider/:providerId/quick-quotes/:id",
    requireAuth,
    async (req: Request<ProviderIdParams & IdParams>, res: Response) => {
      try {
        if (!(await assertProviderOwnership(req, req.params.providerId, res)))
          return;
        const [row] = await db
          .select({ id: quickQuotes.id, providerId: quickQuotes.providerId })
          .from(quickQuotes)
          .where(eq(quickQuotes.id, req.params.id));
        if (!row) return res.status(404).json({ error: "Quote not found" });
        if (row.providerId !== req.params.providerId) {
          return res.status(403).json({ error: "Forbidden" });
        }
        await db.delete(quickQuotes).where(eq(quickQuotes.id, req.params.id));
        res.json({ success: true });
      } catch (error) {
        console.error("Delete quick quote error:", error);
        res.status(500).json({ error: "Failed to delete quote" });
      }
    },
  );

  // ─── Admin Portal Endpoints ──────────────────────────────────────────────

  // GET /api/admin/stats — aggregate dashboard counts + recent signups/bookings
  app.get(
    "/api/admin/stats",
    requireAuth,
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const [stats, recentSignups, recentBookings] = await Promise.all([
          storage.getAdminStats(),
          db
            .select({
              id: users.id,
              email: users.email,
              firstName: users.firstName,
              lastName: users.lastName,
              isProvider: users.isProvider,
              createdAt: users.createdAt,
            })
            .from(users)
            .orderBy(desc(users.createdAt))
            .limit(8),
          db
            .select({
              id: appointments.id,
              scheduledDate: appointments.scheduledDate,
              status: appointments.status,
              providerName: providers.businessName,
              homeownerName: users.firstName,
              homeownerEmail: users.email,
            })
            .from(appointments)
            .leftJoin(users, eq(users.id, appointments.userId))
            .leftJoin(providers, eq(providers.id, appointments.providerId))
            .orderBy(desc(appointments.createdAt))
            .limit(8),
        ]);
        res.json({ stats, recentSignups, recentBookings });
      } catch (err: any) {
        console.error("[admin] stats error:", err);
        res.status(500).json({ error: err.message || "Failed to fetch stats" });
      }
    },
  );

  // GET /api/admin/users — paginated user list, filterable by role, searchable
  app.get(
    "/api/admin/users",
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const search = (req.query.q as string | undefined)?.trim() ?? "";
        const role = (req.query.role as string | undefined)?.trim() ?? "";
        const limit = Math.min(Math.max(parseInt((req.query.limit as string) ?? "50", 10) || 50, 1), 200);
        const offset = Math.max(parseInt((req.query.offset as string) ?? "0", 10) || 0, 0);

        const VALID_ROLES = ["admin", "provider", "homeowner", ""] as const;
        if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
          return res.status(400).json({ error: "role must be one of: admin, provider, homeowner" });
        }

        const sortBy = (req.query.sortBy as string | undefined)?.trim() ?? "";
        const { rows, total } = await storage.getAdminUsers({ search, role, sortBy, limit, offset });
        res.json({ users: rows, total, limit, offset });
      } catch (err: any) {
        console.error("[admin] list users error:", err);
        res.status(500).json({ error: err.message || "Failed to list users" });
      }
    },
  );

  // GET /api/admin/users/:id — full user detail
  app.get(
    "/api/admin/users/:id",
    requireAuth,
    requireAdmin,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const { id } = req.params;
        const detail = await storage.getAdminUserDetail(id);
        if (!detail.user) return res.status(404).json({ error: "User not found" });
        res.json(detail);
      } catch (err: any) {
        console.error("[admin] get user error:", err);
        res.status(500).json({ error: err.message || "Failed to fetch user" });
      }
    },
  );

  // PATCH /api/admin/users/:id — lightweight edits (isAdmin toggle) with self-demotion guard
  app.patch(
    "/api/admin/users/:id",
    requireAuth,
    requireAdmin,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const { id } = req.params;
        const adminUserId = req.authenticatedUserId!;

        if (req.body.isAdmin === false && id === adminUserId) {
          return res.status(400).json({ error: "You cannot remove your own admin access" });
        }
        if (req.body.isAdmin !== undefined && typeof req.body.isAdmin !== "boolean") {
          return res.status(400).json({ error: "isAdmin must be a boolean" });
        }
        if (req.body.isActive !== undefined && typeof req.body.isActive !== "boolean") {
          return res.status(400).json({ error: "isActive must be a boolean" });
        }

        const allowed: Array<keyof typeof users.$inferSelect> = ["isAdmin", "isActive"];
        const patch: Record<string, unknown> = {};
        for (const key of allowed) {
          if (req.body[key] !== undefined) patch[key] = req.body[key];
        }
        if (Object.keys(patch).length === 0) {
          return res.status(400).json({ error: "No valid fields to update" });
        }

        const { before, updated } = await storage.updateAdminUser(id, patch, adminUserId);
        if (!before) return res.status(404).json({ error: "User not found" });
        res.json({ user: updated });
      } catch (err: any) {
        console.error("[admin] patch user error:", err);
        res.status(500).json({ error: err.message || "Failed to update user" });
      }
    },
  );

  // GET /api/admin/providers/:id — full provider detail
  app.get(
    "/api/admin/providers/:id",
    requireAuth,
    requireAdmin,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const { id } = req.params;
        const detail = await storage.getAdminProviderDetail(id);
        if (!detail.provider) return res.status(404).json({ error: "Provider not found" });
        res.json({ ...detail, provider: normalizeProviderForResponse(detail.provider) });
      } catch (err: any) {
        console.error("[admin] get provider error:", err);
        res.status(500).json({ error: err.message || "Failed to fetch provider" });
      }
    },
  );

  // PATCH /api/admin/providers/:id — edit isActive, isPublic, basic profile fields
  app.patch(
    "/api/admin/providers/:id",
    requireAuth,
    requireAdmin,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const { id } = req.params;
        const adminUserId = req.authenticatedUserId!;

        const ALLOWED_FIELDS = ["isActive", "isPublic", "businessName", "description", "phone", "email", "isVerified"] as const;
        const BOOL_FIELDS = new Set(["isActive", "isPublic", "isVerified"]);
        const STRING_FIELDS = new Set(["businessName", "description", "phone", "email"]);
        const patch: Record<string, unknown> = {};
        for (const key of ALLOWED_FIELDS) {
          if (req.body[key] !== undefined) patch[key] = req.body[key];
        }
        if (Object.keys(patch).length === 0) {
          return res.status(400).json({ error: "No valid fields to update" });
        }
        for (const [k, v] of Object.entries(patch)) {
          if (BOOL_FIELDS.has(k) && typeof v !== "boolean") {
            return res.status(400).json({ error: `${k} must be a boolean` });
          }
          if (STRING_FIELDS.has(k) && typeof v !== "string") {
            return res.status(400).json({ error: `${k} must be a string` });
          }
        }

        const { before, updated } = await storage.updateAdminProvider(id, patch, adminUserId, ALLOWED_FIELDS);
        if (!before) return res.status(404).json({ error: "Provider not found" });
        res.json({ provider: normalizeProviderForResponse(updated!) });
      } catch (err: any) {
        console.error("[admin] patch provider error:", err);
        res.status(500).json({ error: err.message || "Failed to update provider" });
      }
    },
  );

  // GET /api/admin/support-tickets — paginated list with filters
  app.get(
    "/api/admin/support-tickets",
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const status = (req.query.status as string | undefined)?.trim() ?? "";
        const priority = (req.query.priority as string | undefined)?.trim() ?? "";
        const userType = (req.query.userType as string | undefined)?.trim() ?? "";
        const limit = Math.min(Math.max(parseInt((req.query.limit as string) ?? "50", 10) || 50, 1), 200);
        const offset = Math.max(parseInt((req.query.offset as string) ?? "0", 10) || 0, 0);

        const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"];
        const TICKET_PRIORITIES = ["low", "medium", "normal", "high", "urgent"];
        const TICKET_USER_TYPES = ["homeowner", "provider"];
        if (status && !TICKET_STATUSES.includes(status)) {
          return res.status(400).json({ error: `status must be one of: ${TICKET_STATUSES.join(", ")}` });
        }
        if (priority && !TICKET_PRIORITIES.includes(priority)) {
          return res.status(400).json({ error: `priority must be one of: ${TICKET_PRIORITIES.join(", ")}` });
        }
        if (userType && !TICKET_USER_TYPES.includes(userType)) {
          return res.status(400).json({ error: `userType must be one of: ${TICKET_USER_TYPES.join(", ")}` });
        }

        const q = (req.query.q as string | undefined)?.trim() ?? "";
        const { rows, total } = await storage.listSupportTickets({ q, status, priority, userType, limit, offset });
        res.json({ tickets: rows, total, limit, offset });
      } catch (err: any) {
        console.error("[admin] list support tickets error:", err);
        res.status(500).json({ error: err.message || "Failed to list tickets" });
      }
    },
  );

  // GET /api/admin/support-tickets/:id — full ticket with message thread
  app.get(
    "/api/admin/support-tickets/:id",
    requireAuth,
    requireAdmin,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const { id } = req.params;
        const { ticket, messages } = await storage.getSupportTicketWithMessages(id);
        if (!ticket) return res.status(404).json({ error: "Ticket not found" });
        res.json({ ticket, messages });
      } catch (err: any) {
        console.error("[admin] get support ticket error:", err);
        res.status(500).json({ error: err.message || "Failed to fetch ticket" });
      }
    },
  );

  // PATCH /api/admin/support-tickets/:id — update status/priority/assignedTo
  app.patch(
    "/api/admin/support-tickets/:id",
    requireAuth,
    requireAdmin,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const { id } = req.params;
        const adminUserId = req.authenticatedUserId!;

        const VALID_STATUSES = ["open", "in_progress", "resolved", "closed"];
        const VALID_PRIORITIES = ["low", "medium", "normal", "high", "urgent"];
        const ALLOWED = ["status", "priority", "assignedTo"] as const;
        const patch: Record<string, unknown> = {};
        for (const key of ALLOWED) {
          if (req.body[key] !== undefined) patch[key] = req.body[key];
        }
        if (Object.keys(patch).length === 0) {
          return res.status(400).json({ error: "No valid fields to update" });
        }
        if (patch.status !== undefined && !VALID_STATUSES.includes(patch.status as string)) {
          return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
        }
        if (patch.priority !== undefined && !VALID_PRIORITIES.includes(patch.priority as string)) {
          return res.status(400).json({ error: `priority must be one of: ${VALID_PRIORITIES.join(", ")}` });
        }
        if (patch.assignedTo !== undefined && patch.assignedTo !== null && typeof patch.assignedTo !== "string") {
          return res.status(400).json({ error: "assignedTo must be a string or null" });
        }

        const { before, updated } = await storage.updateSupportTicket(id, patch, adminUserId);
        if (!before) return res.status(404).json({ error: "Ticket not found" });
        res.json({ ticket: updated });
      } catch (err: any) {
        console.error("[admin] patch support ticket error:", err);
        res.status(500).json({ error: err.message || "Failed to update ticket" });
      }
    },
  );

  // POST /api/admin/support-tickets/:id/messages — save admin reply and send email
  app.post(
    "/api/admin/support-tickets/:id/messages",
    requireAuth,
    requireAdmin,
    async (req: Request<IdParams>, res: Response) => {
      try {
        const { id } = req.params;
        const adminUserId = req.authenticatedUserId!;
        const { body: messageBody } = req.body;

        if (!messageBody?.trim()) {
          return res.status(400).json({ error: "Message body is required" });
        }

        const { message, ticket } = await storage.addSupportTicketMessage(id, adminUserId, messageBody.trim());
        if (!ticket) return res.status(404).json({ error: "Ticket not found" });

        // Send reply email fire-and-forget, threaded after AI first response
        setImmediate(async () => {
          try {
            await sendAdminSupportReplyEmail({
              to: ticket.email,
              recipientName: ticket.name,
              ticketSubject: ticket.subject,
              ticketId: id,
              replyBody: messageBody.trim(),
              inReplyTo: `<ticket-${id}@homebaseproapp.com>`,
            });
          } catch (emailErr) {
            console.error("[admin] support reply email error:", emailErr);
          }
        });

        res.status(201).json({ message });
      } catch (err: any) {
        console.error("[admin] post support ticket message error:", err);
        res.status(500).json({ error: err.message || "Failed to send reply" });
      }
    },
  );

  // POST /api/admin/broadcasts — fan out message to users by audience
  app.post(
    "/api/admin/broadcasts",
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { title, body: broadcastBody, audience, channels: rawChannels, channel: rawChannel } = req.body;
        const adminUserId = req.authenticatedUserId!;

        const VALID_AUDIENCES = ["all", "homeowners", "providers"] as const;
        const VALID_CHANNELS = ["push", "in_app", "email"] as const;

        if (!title?.trim() || !broadcastBody?.trim()) {
          return res.status(400).json({ error: "title and body are required" });
        }
        if (!VALID_AUDIENCES.includes(audience)) {
          return res.status(400).json({ error: `audience must be one of: ${VALID_AUDIENCES.join(", ")}` });
        }

        // Accept channels array (multi-select) or legacy single channel string
        const channelList: string[] = Array.isArray(rawChannels) && rawChannels.length > 0
          ? rawChannels
          : (rawChannel ? [rawChannel] : []);

        if (channelList.length === 0) {
          return res.status(400).json({ error: "at least one channel is required" });
        }
        const invalidChannel = channelList.find(c => !VALID_CHANNELS.includes(c as typeof VALID_CHANNELS[number]));
        if (invalidChannel) {
          return res.status(400).json({ error: `channel must be one of: ${VALID_CHANNELS.join(", ")}` });
        }

        const recipientIds = await storage.resolveBroadcastRecipientIds(audience);

        // Create one broadcast record per channel and fan out each
        const broadcasts = await Promise.all(
          channelList.map(ch =>
            storage.createBroadcast({
              sentByUserId: adminUserId,
              title: title.trim(),
              body: broadcastBody.trim(),
              audience,
              channel: ch,
              recipientCount: recipientIds.length,
            }),
          ),
        );

        // Return 202 immediately; all remaining work runs in background
        res.status(202).json({ broadcast: broadcasts[0], recipientCount: recipientIds.length });

        const capturedTitle = title.trim();
        const capturedBody = broadcastBody.trim();
        const capturedRecipientIds = recipientIds.slice();

        setImmediate(async () => {
          for (const broadcast of broadcasts) {
            const capturedChannel = broadcast.channel as string;
            try {
              if (capturedRecipientIds.length === 0) {
                await storage.updateBroadcastStatus(broadcast.id, "sent");
                continue;
              }

              const userEmailMap = capturedChannel === "email"
                ? await storage.fetchBroadcastEmailMap(capturedRecipientIds)
                : new Map<string, { email: string; firstName: string | null }>();

              const batchSize = 50;
              for (let i = 0; i < capturedRecipientIds.length; i += batchSize) {
                const batch = capturedRecipientIds.slice(i, i + batchSize);
                for (const userId of batch) {
                  try {
                    if (capturedChannel === "push" || capturedChannel === "in_app") {
                      await dispatchNotification(
                        userId,
                        capturedTitle,
                        capturedBody,
                        "admin.broadcast",
                        { broadcastId: broadcast.id },
                        "reminders",
                      );
                    } else if (capturedChannel === "email") {
                      const userInfo = userEmailMap.get(userId);
                      if (!userInfo?.email) throw new Error("No email for user");
                      await sendAdminBroadcastEmail({
                        to: userInfo.email,
                        recipientName: userInfo.firstName ?? "there",
                        title: capturedTitle,
                        body: capturedBody,
                      });
                    }
                    await storage.recordBroadcastRecipient(broadcast.id, userId, capturedChannel, "delivered", new Date());
                  } catch {
                    await storage.recordBroadcastRecipient(broadcast.id, userId, capturedChannel, "failed");
                  }
                }
              }
              await storage.updateBroadcastStatus(broadcast.id, "sent");
            } catch (fanoutErr) {
              console.error("[admin] broadcast fan-out error:", fanoutErr);
              await storage.updateBroadcastStatus(broadcast.id, "failed");
            }
          }
        });
      } catch (err: any) {
        console.error("[admin] broadcast error:", err);
        res.status(500).json({ error: err.message || "Failed to send broadcast" });
      }
    },
  );

  // GET /api/admin/broadcasts — broadcast history
  app.get(
    "/api/admin/broadcasts",
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const limit = Math.min(Math.max(parseInt((req.query.limit as string) ?? "50", 10) || 50, 1), 200);
        const offset = Math.max(parseInt((req.query.offset as string) ?? "0", 10) || 0, 0);
        const rows = await storage.listBroadcasts({ limit, offset });
        res.json({ broadcasts: rows, limit, offset });
      } catch (err: any) {
        console.error("[admin] list broadcasts error:", err);
        res.status(500).json({ error: err.message || "Failed to list broadcasts" });
      }
    },
  );

  // GET /api/admin/analytics/top-providers — ranked provider data with filters
  app.get(
    "/api/admin/analytics/top-providers",
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const VALID_PERIODS = ["7d", "30d", "90d", "365d"] as const;
        const periodRaw = (req.query.period as string | undefined)?.trim() ?? "30d";
        const period = VALID_PERIODS.includes(periodRaw as typeof VALID_PERIODS[number]) ? periodRaw : "30d";
        const category = (req.query.category as string | undefined)?.trim() ?? "";
        const city = (req.query.city as string | undefined)?.trim() ?? "";
        const partnerOnly = req.query.partner === "true";
        const subscribedOnly = req.query.subscribed === "true";
        const limitN = Math.min(Math.max(parseInt((req.query.limit as string) ?? "20", 10) || 20, 1), 100);

        const periodDays: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
        const days = periodDays[period] ?? 30;

        const result = await storage.getAdminTopProviders({ days, category, city, partnerOnly, subscribedOnly, limit: limitN });
        res.json({ providers: result, period, days });
      } catch (err: any) {
        console.error("[admin] top-providers analytics error:", err);
        res.status(500).json({ error: err.message || "Failed to fetch analytics" });
      }
    },
  );

  // GET /api/admin/audit-logs — paginated, filterable
  app.get(
    "/api/admin/audit-logs",
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const adminUserId = (req.query.adminUserId as string | undefined)?.trim() ?? "";
        const action = (req.query.action as string | undefined)?.trim() ?? "";
        const since = (req.query.since as string | undefined)?.trim() ?? "";
        const until = (req.query.until as string | undefined)?.trim() ?? "";
        const limit = Math.min(Math.max(parseInt((req.query.limit as string) ?? "50", 10) || 50, 1), 200);
        const offset = Math.max(parseInt((req.query.offset as string) ?? "0", 10) || 0, 0);

        if (since && isNaN(new Date(since).getTime())) {
          return res.status(400).json({ error: "since must be a valid ISO 8601 date string" });
        }
        if (until && isNaN(new Date(until).getTime())) {
          return res.status(400).json({ error: "until must be a valid ISO 8601 date string" });
        }

        const { rows, total } = await storage.listAdminAuditLogs({ adminUserId, action, since, until, limit, offset });
        res.json({ logs: rows, total, limit, offset });
      } catch (err: any) {
        console.error("[admin] audit logs error:", err);
        res.status(500).json({ error: err.message || "Failed to fetch audit logs" });
      }
    },
  );

  // DELETE /api/admin/audit-logs — bulk delete by IDs
  app.delete(
    "/api/admin/audit-logs",
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const ids = req.body?.ids;
        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ error: "ids must be a non-empty array" });
        }
        const deleted = await storage.deleteAdminAuditLogs(ids as string[]);
        res.json({ deleted });
      } catch (err: any) {
        console.error("[admin] delete audit logs error:", err);
        res.status(500).json({ error: err.message || "Failed to delete audit logs" });
      }
    },
  );

  const httpServer = createServer(app);

  return httpServer;
}
