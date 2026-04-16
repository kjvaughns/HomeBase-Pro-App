import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import * as fs from "fs";
import * as path from "path";
import { hash as bcryptHash } from "bcryptjs";
const BCRYPT_SALT_ROUNDS = 10;
import { openai, HOMEBASE_SYSTEM_PROMPT, PROVIDER_ASSISTANT_PROMPT } from "./openai";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import { insertUserSchema, loginSchema, insertHomeSchema, insertAppointmentSchema, insertProviderSchema, insertClientSchema, insertJobSchema, insertInvoiceSchema, insertPaymentSchema } from "@shared/schema";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { db } from "./db";
import { sql, eq, and, desc, inArray, gte } from "drizzle-orm";
import { appointments, maintenanceReminders, homes, reviews } from "@shared/schema";
import { sendInvoiceEmail, sendProviderClientMessage, sendSupportTicketEmail, sendInvoiceReminderEmail, sendProviderScheduledJobEmail } from "./emailService";
import { dispatch, dispatchWithResult, dispatchNotification, sendPush } from "./notificationService";
import { 
  searchPlaces, 
  getPlaceDetails, 
  geocodeAddress, 
  fetchZillowPropertyData, 
  enrichPropertyData,
  buildHouseFaxContext 
} from "./housefaxService";
import {
  createConnectAccountLink,
  refreshConnectAccountLink,
  getConnectStatus,
  getConnectAccount,
  createInvoicePaymentIntent,
  createStripeCheckoutSession,
  createStripeInvoice,
  sendStripeInvoiceEmail,
  sendPlatformStripeInvoice,
  createDirectCheckoutSession,
  applyCreditsToInvoice,
  calculateFeePreview,
  getProviderPlan,
  calculatePlatformFee,
  getStripe,
} from "./stripeConnectService";
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
  supportTickets,
} from "@shared/schema";

interface IdParams { id: string; }
interface UserIdParams { userId: string; }
interface ProviderIdParams { providerId: string; }

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

import type { RequestHandler } from "express";
import { generateToken, authenticateJWT } from "./auth";

declare module "express-serve-static-core" {
  interface Request {
    authenticatedUserId?: string;
  }
}

const requireAuth: RequestHandler = authenticateJWT;

const aiRateLimitMap = new Map<string, { count: number; resetAt: number }>();

const insightsAiCache = new Map<string, {
  revenue: string; growth: string; rating: string; expiresAt: number;
}>();

const REVENUE_MILESTONES = [10000, 25000, 50000, 100000, 150000, 200000, 300000, 500000];

async function fireInsightNotifications(
  userId: string,
  insights: { allTimeRevenue: number; clientGrowthPct: number; rating: string; reviewCount: number }
) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const topMilestone = REVENUE_MILESTONES.slice().reverse().find(m => insights.allTimeRevenue >= m);
  if (topMilestone) {
    const milestoneType = `revenue_milestone_${topMilestone}`;
    const [existing] = await db.select({ id: notifications.id }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.type, milestoneType),
        gte(notifications.createdAt, thirtyDaysAgo))).limit(1);
    if (!existing) {
      await dispatchNotification(userId,
        "Revenue Milestone Reached",
        `You've earned $${(topMilestone / 1000).toFixed(0)}K all-time — incredible work!`,
        milestoneType, {}, "updates" as any);
    }
  }

  if (insights.clientGrowthPct >= 10) {
    const [existing] = await db.select({ id: notifications.id }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.type, "quarterly_client_growth"),
        gte(notifications.createdAt, thirtyDaysAgo))).limit(1);
    if (!existing) {
      await dispatchNotification(userId,
        "Client Growth Surge",
        `Your client base grew ${insights.clientGrowthPct}% this quarter — great momentum!`,
        "quarterly_client_growth", {}, "updates" as any);
    }
  }

  if (parseFloat(insights.rating) >= 4.8 && insights.reviewCount >= 10) {
    const [existing] = await db.select({ id: notifications.id }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.type, "top_rated_achievement"),
        gte(notifications.createdAt, thirtyDaysAgo))).limit(1);
    if (!existing) {
      await dispatchNotification(userId,
        "Top Rated Provider",
        `${insights.rating} stars from ${insights.reviewCount} reviews — you're among the best!`,
        "top_rated_achievement", {}, "updates" as any);
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
    res.status(429).json({ error: "Too many AI requests. Please wait a minute and try again." });
    return;
  }

  entry.count += 1;
  next();
};

const onboardingRateLimitMap = new Map<string, { count: number; resetAt: number }>();

const onboardingRateLimit: RequestHandler = (req, res, next) => {
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
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

function formatUserResponse(user: { firstName?: string | null; lastName?: string | null; [key: string]: unknown }) {
  const { firstName, lastName, password, ...rest } = user;
  const name = [firstName, lastName].filter(Boolean).join(" ") || null;
  return { ...rest, name };
}

function parseUserName(name?: string): { firstName?: string; lastName?: string } {
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

function formatHomeResponse(home: { label: string; street: string; zip: string; [key: string]: unknown }) {
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
  }
): Promise<{ clientId: string; job: typeof jobs.$inferSelect }> {
  const {
    submissionId, providerId, clientName, clientEmail, clientPhone, address,
    problemDescription, scheduledDate, scheduledTime, estimatedPrice, notes,
    targetStatus = "converted",
  } = params;

  const nameParts = (clientName || "").trim().split(" ");
  const firstName = nameParts[0] || "Unknown";
  const lastName = nameParts.slice(1).join(" ") || "";

  // Upsert client by provider+email using ON CONFLICT to prevent race conditions.
  // Uses the partial unique index: clients(provider_id, email) WHERE email IS NOT NULL.
  // On conflict, updates contact info so the record reflects the latest submission.
  let clientId: string;
  if (clientEmail) {
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
  } else {
    // No email — cannot deduplicate; always insert a new record
    const [newC] = await tx
      .insert(clients)
      .values({ providerId, firstName, lastName: lastName || null, email: null, phone: clientPhone || null, address: address || null })
      .returning({ id: clients.id });
    clientId = newC.id;
  }

  // Create job
  const jobDate = scheduledDate ?? new Date();
  const [newJob] = await tx
    .insert(jobs)
    .values({
      providerId,
      clientId,
      title: problemDescription?.slice(0, 100) || "Service Request",
      description: problemDescription || null,
      scheduledDate: jobDate,
      scheduledTime: scheduledTime || null,
      status: "scheduled",
      address: address || null,
      estimatedPrice: estimatedPrice || null,
      notes: notes || null,
    })
    .returning();

  // Mark submission with full conversion fields
  const now = new Date();
  await tx
    .update(intakeSubmissions)
    .set({ status: targetStatus, convertedClientId: clientId, convertedJobId: newJob.id, convertedAt: now, updatedAt: now })
    .where(eq(intakeSubmissions.id, submissionId));

  return { clientId, job: newJob };
}

// ─── HouseFax Category Mapper ────────────────────────────────────────────────
function detectServiceCategory(title: string): string {
  const t = (title || "").toLowerCase();
  if (t.includes("hvac") || t.includes("heat") || t.includes("air") || t.includes("furnace") || t.includes("ac ") || t.includes("cooling")) return "HVAC";
  if (t.includes("plumb") || t.includes("pipe") || t.includes("water") || t.includes("drain") || t.includes("toilet") || t.includes("faucet")) return "Plumbing";
  if (t.includes("electr") || t.includes("wiring") || t.includes("outlet") || t.includes("circuit")) return "Electrical";
  if (t.includes("roof") || t.includes("gutter") || t.includes("shingle")) return "Roof";
  if (t.includes("pest") || t.includes("termite") || t.includes("rodent") || t.includes("insect")) return "Pest Control";
  if (t.includes("lawn") || t.includes("garden") || t.includes("landscap") || t.includes("grass") || t.includes("mow")) return "Lawn";
  if (t.includes("paint") || t.includes("coat")) return "Painting";
  if (t.includes("clean")) return "Cleaning";
  if (t.includes("appliance") || t.includes("washer") || t.includes("dryer") || t.includes("dishwash") || t.includes("refriger")) return "Appliances";
  return "General";
}

// Auto-log a HouseFax entry when a job completes
async function autoLogHouseFaxEntry(job: Job): Promise<void> {
  try {
    // Find the homeId via the appointment linked to this job, or via client's home
    let homeId: string | null = null;

    // Try job's appointmentId first
    if (job.appointmentId) {
      const [appt] = await db.select({ homeId: appointments.homeId }).from(appointments).where(eq(appointments.id, job.appointmentId));
      if (appt) homeId = appt.homeId;
    }

    // Fall back: find homeId via the job's linked invoice (homeownerUserId -> homes)
    if (!homeId && job.id) {
      const [inv] = await db
        .select({ homeownerUserId: invoices.homeownerUserId })
        .from(invoices)
        .where(eq(invoices.jobId, job.id));
      if (inv?.homeownerUserId) {
        const [defaultHome] = await db.select({ id: homes.id })
          .from(homes)
          .where(and(eq(homes.userId, inv.homeownerUserId), eq(homes.isDefault, true)));
        if (defaultHome) homeId = defaultHome.id;
        else {
          const [anyHome] = await db.select({ id: homes.id })
            .from(homes)
            .where(eq(homes.userId, inv.homeownerUserId));
          if (anyHome) homeId = anyHome.id;
        }
      }
    }

    if (!homeId) {
      console.log(`[HouseFax] No home found for job ${job.id}, skipping auto-log`);
      return;
    }

    // Check if entry already exists for this job
    const [existing] = await db.select({ id: housefaxEntries.id }).from(housefaxEntries).where(eq(housefaxEntries.jobId, job.id));
    if (existing) {
      console.log(`[HouseFax] Entry already exists for job ${job.id}`);
      return;
    }

    // Get provider info
    const [provider] = job.providerId ? await db.select({ businessName: providers.businessName }).from(providers).where(eq(providers.id, job.providerId)) : [null];

    const serviceCategory = detectServiceCategory(job.title);
    const costCents = job.finalPrice ? Math.round(parseFloat(job.finalPrice) * 100) : 0;

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

    console.log(`[HouseFax] Auto-logged entry for job ${job.id} (${job.title}) -> home ${homeId}`);

    // Persist the updated score on write (not just on read)
    calculateAndPersistHouseFaxScore(homeId).catch((e: unknown) =>
      console.error("[HouseFax] Score persistence failed:", e)
    );
  } catch (error) {
    console.error("[HouseFax] Auto-log failed:", error);
    throw error;
  }
}

// Calculates health score from all housefax entries for a home and persists it
async function calculateAndPersistHouseFaxScore(homeId: string): Promise<number> {
  const KEY_SYSTEMS = ["HVAC", "Plumbing", "Electrical", "Roof", "Pest Control", "Lawn"];
  const allEntries = await db
    .select()
    .from(housefaxEntries)
    .where(eq(housefaxEntries.homeId, homeId));

  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
  let score = 50;

  for (const sys of KEY_SYSTEMS) {
    const sysEntries = allEntries.filter(e => {
      const s = (e.systemAffected || e.serviceCategory || "").toLowerCase();
      return s.includes(sys.toLowerCase().split(" ")[0]);
    });
    if (sysEntries.length > 0) {
      score += sysEntries.find(e => e.completedAt >= oneYearAgo) ? 6 : 2;
    }
    if (sysEntries.length === 0) score -= 3;
    else if (!sysEntries.find(e => e.completedAt >= twoYearsAgo)) score -= 2;
  }

  const withPhotos = allEntries.filter(e => Array.isArray(e.photos) && (e.photos as string[]).length > 0).length;
  const withSummaries = allEntries.filter(e => e.aiSummary).length;
  score += Math.min(withPhotos * 2, 10);
  score += Math.min(withSummaries, 10);
  score = Math.max(0, Math.min(100, score));

  await storage.updateHome(homeId, { housefaxScore: score });
  return score;
}

export async function registerRoutes(app: Express): Promise<Server> {
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
      const { name, ...restBody } = req.body;
      const nameFields = parseUserName(name);
      const userData = { ...restBody, ...nameFields };
      
      const parsed = insertUserSchema.safeParse(userData);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }

      const existing = await storage.getUserByEmail(parsed.data.email);
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const user = await storage.createUser(parsed.data);
      const token = generateToken(user.id, user.isProvider ? "provider" : "homeowner", user.tokenVersion ?? 0);
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.status(201).json({ user: formatUserResponse(user), token });

      // Welcome email — awaited with explicit failure logging (no silent discard)
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
      dispatch('user.signup', { recipientUserId: user.id, recipientEmail: user.email, clientName: fullName })
        .catch((emailErr: unknown) => {
          console.error("[SIGNUP_EMAIL_FAILURE] Welcome email failed for user", user.id, ":", emailErr);
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
  app.post("/api/provider/onboard-complete", async (req: Request, res: Response) => {
    try {
      const {
        name, email, password, phone,
        businessName, description, serviceArea, serviceZipCodes, serviceCities, serviceRadius,
        capabilityTags, businessHours,
        initialService,
      } = req.body;

      if (!email || !password || !businessName) {
        return res.status(400).json({ error: "email, password, and businessName are required" });
      }

      // Pre-check duplicate email before entering transaction
      const existing = await storage.getUserByEmail(email.trim().toLowerCase());
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const nameFields = parseUserName(name);
      const hashedPassword = await bcryptHash(password, BCRYPT_SALT_ROUNDS);

      // Atomic transaction: user + provider + service all-or-nothing
      const { user, provider, service } = await db.transaction(async (tx) => {
        // 1. Create user
        const [newUser] = await tx.insert(users).values({
          ...nameFields,
          email: email.trim().toLowerCase(),
          password: hashedPassword,
          phone: phone?.trim() || null,
          isProvider: true,
        }).returning();

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
          : (serviceZipCodes ? String(serviceZipCodes).split(",").map((s: string) => s.trim()).filter(Boolean) : null);
        const parsedServiceCities = Array.isArray(serviceCities)
          ? serviceCities
          : (serviceCities ? String(serviceCities).split(",").map((s: string) => s.trim()).filter(Boolean) : null);
        const [newProvider] = await tx.insert(providers).values({
          userId: newUser.id,
          businessName: businessName.trim(),
          description: description?.trim() || null,
          serviceArea: serviceArea?.trim() || null,
          serviceZipCodes: parsedServiceZipCodes,
          serviceCities: parsedServiceCities,
          serviceRadius: serviceRadius ? Number(serviceRadius) : null,
          capabilityTags: Array.isArray(capabilityTags) ? capabilityTags : [],
          businessHours: businessHours ?? null,
          bookingPolicies: defaultBookingPolicies,
          isActive: true,    // schema-aligned: no "status" column in providers table
          isPublic: true,    // make discoverable immediately post-onboarding
          email: email.trim().toLowerCase(),
          phone: phone?.trim() || null,
        }).returning();

        // 3. Create initial service (if provided)
        let newService = null;
        if (initialService?.name?.trim()) {
          const [svc] = await tx.insert(providerCustomServices).values({
            providerId: newProvider.id,
            name: initialService.name.trim(),
            category: initialService.category || "General",
            description: initialService.description?.trim() || null,
            pricingType: initialService.quoteRequired ? "quote" : "fixed",
            basePrice: !initialService.quoteRequired && initialService.price
              ? String(initialService.price)
              : null,
            duration: initialService.duration || 60,
            isPublished: true,
          }).returning();
          newService = svc;
        }

        return { user: newUser, provider: newProvider, service: newService };
      });

      const token = generateToken(user.id, "provider", user.tokenVersion ?? 0);
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
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
      dispatch('user.signup', { recipientUserId: user.id, recipientEmail: user.email, clientName: fullName })
        .catch((emailErr: unknown) => {
          console.error("[ONBOARD_EMAIL_FAILURE] Welcome email failed for user", user.id, ":", emailErr);
        });
    } catch (error) {
      console.error("Provider onboard-complete error:", error);
      res.status(500).json({ error: "Failed to create provider account" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid credentials" });
      }

      const user = await storage.verifyPassword(parsed.data.email, parsed.data.password);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

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
      res.json({ user: formatUserResponse(user), providerProfile, token });
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
      res.json({ user: formatUserResponse(user), providerProfile });
    } catch (error) {
      console.error("Auth me error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  app.post("/api/auth/logout-all", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.authenticatedUserId!;
      await db.update(users)
        .set({ tokenVersion: sql`token_version + 1` })
        .where(eq(users.id, userId));
      res.clearCookie("token");
      res.json({ success: true });
    } catch (error) {
      console.error("Logout-all error:", error);
      res.status(500).json({ error: "Failed to revoke sessions" });
    }
  });

  app.post("/api/auth/refresh", requireAuth, async (req: Request, res: Response) => {
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
  });

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await storage.getUserByEmail(email.trim().toLowerCase());

      if (user) {
        const { JWT_SECRET } = await import("./auth");
        const jwt = await import("jsonwebtoken");
        const RESET_SECRET = `${JWT_SECRET}:password-reset`;
        const resetToken = jwt.default.sign(
          { userId: user.id, purpose: "password_reset" },
          RESET_SECRET,
          { expiresIn: "1h" }
        );
        const host = (req.headers["x-forwarded-host"] || req.get("host") || "home-base-pro-app.replit.app") as string;
        const protocol = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || req.protocol || "https";
        const resetUrl = `${protocol}://${host}/reset-password?token=${resetToken}`;
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
        const { sendPasswordResetEmail } = await import("./emailService");
        sendPasswordResetEmail(user.email, fullName, resetUrl).catch((err: unknown) => {
          console.error("[FORGOT_PASSWORD] Email send failed:", err);
        });
      }

      res.json({ success: true, message: "If an account exists for that email, a reset link has been sent." });
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
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      const { JWT_SECRET } = await import("./auth");
      const jwt = await import("jsonwebtoken");
      const RESET_SECRET = `${JWT_SECRET}:password-reset`;
      let decoded: any;
      try {
        decoded = jwt.default.verify(token, RESET_SECRET);
      } catch {
        return res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
      }
      if (decoded.purpose !== "password_reset" || !decoded.userId) {
        return res.status(400).json({ error: "Invalid reset token" });
      }
      const hashed = await bcryptHash(password, 10);
      await db.update(users).set({ password: hashed, updatedAt: new Date() }).where(eq(users.id, decoded.userId));
      res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.delete("/api/auth/account", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.authenticatedUserId!;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await db.transaction(async (tx) => {
        const providerRow = await tx.select({ id: providers.id, stripeAccountId: stripeConnectAccounts.stripeAccountId })
          .from(providers)
          .leftJoin(stripeConnectAccounts, eq(stripeConnectAccounts.providerId, providers.id))
          .where(eq(providers.userId, userId))
          .limit(1);

        if (providerRow.length > 0) {
          const provId = providerRow[0].id;

          await tx.delete(invoiceLineItems).where(
            sql`invoice_id IN (SELECT id FROM invoices WHERE provider_id = ${provId})`
          );
          await tx.delete(payments).where(
            sql`invoice_id IN (SELECT id FROM invoices WHERE provider_id = ${provId})`
          );
          await tx.delete(invoices).where(eq(invoices.providerId, provId));
          await tx.delete(jobs).where(eq(jobs.providerId, provId));
          await tx.delete(clients).where(eq(clients.providerId, provId));
          await tx.delete(bookingLinks).where(eq(bookingLinks.providerId, provId));
          await tx.delete(intakeSubmissions).where(eq(intakeSubmissions.providerId, provId));
          await tx.delete(leads).where(eq(leads.providerId, provId));
          await tx.delete(providerMessages).where(eq(providerMessages.providerId, provId));
          await tx.delete(messageTemplates).where(eq(messageTemplates.providerId, provId));
          await tx.delete(providerCustomServices).where(eq(providerCustomServices.providerId, provId));
          await tx.delete(providerServices).where(eq(providerServices.providerId, provId));
          await tx.delete(providerPlans).where(eq(providerPlans.providerId, provId));
          await tx.delete(stripeConnectAccounts).where(eq(stripeConnectAccounts.providerId, provId));
          await tx.delete(payouts).where(eq(payouts.providerId, provId));
          await tx.delete(reviews).where(eq(reviews.providerId, provId));
          await tx.delete(providers).where(eq(providers.id, provId));
        }

        await tx.delete(notifications).where(eq(notifications.userId, userId));
        await tx.delete(pushTokens).where(eq(pushTokens.userId, userId));
        await tx.delete(notificationPreferences).where(eq(notificationPreferences.userId, userId));
        await tx.delete(userCredits).where(eq(userCredits.userId, userId));
        await tx.delete(creditLedger).where(eq(creditLedger.userId, userId));
        await tx.delete(supportTickets).where(eq(supportTickets.userId, userId));

        const userHomes = await tx.select({ id: homes.id }).from(homes).where(eq(homes.userId, userId));
        if (userHomes.length > 0) {
          const homeIds = userHomes.map((h) => h.id);
          await tx.delete(housefaxEntries).where(sql`home_id = ANY(${homeIds})`);
          await tx.delete(maintenanceReminders).where(sql`home_id = ANY(${homeIds})`);
          await tx.delete(appointments).where(sql`home_id = ANY(${homeIds})`);
        }
        await tx.delete(homes).where(eq(homes.userId, userId));

        if (user.stripeCustomerId) {
          try {
            const stripe = getStripe();
            await stripe.customers.del(user.stripeCustomerId);
          } catch (stripeErr) {
            console.error("[DELETE_ACCOUNT] Stripe customer deletion failed (non-fatal):", stripeErr);
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
  });

  app.get("/api/user/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
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
  });

  app.put("/api/user/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
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
  });

  app.get("/api/homes/:userId", requireAuth, async (req: Request<UserIdParams>, res: Response) => {
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
  });

  app.post("/api/homes", requireAuth, async (req: Request, res: Response) => {
    try {
      const { nickname, address, zipCode, label, street, zip, ...rest } = req.body;
      const homeData = {
        ...rest,
        userId: req.authenticatedUserId,
        label: nickname || label || "My Home",
        street: address || street,
        zip: zipCode || zip,
      };
      
      console.log("Creating home with data:", JSON.stringify(homeData, null, 2));
      
      const parsed = insertHomeSchema.safeParse(homeData);
      if (!parsed.success) {
        console.error("Home validation failed:", JSON.stringify(parsed.error.issues, null, 2));
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }
      const home = await storage.createHome(parsed.data);
      
      // Auto-enrich the home with property data (fire and forget)
      if (home.street && home.city && home.state && home.zip) {
        const fullAddress = `${home.street}, ${home.city}, ${home.state} ${home.zip}`;
        enrichPropertyData(fullAddress).then(async (enrichment) => {
          try {
            const updateData: Record<string, unknown> = {
              housefaxEnrichedAt: new Date()
            };
            
            if (enrichment.zillow) {
              const z = enrichment.zillow;
              if (z.bedrooms) updateData.bedrooms = z.bedrooms;
              if (z.bathrooms) updateData.bathrooms = z.bathrooms;
              if (z.livingArea) updateData.squareFeet = z.livingArea;
              if (z.yearBuilt) updateData.yearBuilt = z.yearBuilt;
              if (z.lotSize) updateData.lotSize = z.lotSize;
              if (z.zestimate) updateData.estimatedValue = String(z.zestimate);
              if (z.zpid) updateData.zillowId = z.zpid;
              if (z.url) updateData.zillowUrl = z.url;
              if (z.taxAssessedValue) updateData.taxAssessedValue = String(z.taxAssessedValue);
              if (z.lastSoldDate) updateData.lastSoldDate = z.lastSoldDate;
              if (z.lastSoldPrice) updateData.lastSoldPrice = String(z.lastSoldPrice);
            }
            
            if (enrichment.google) {
              const g = enrichment.google;
              if (g.latitude) updateData.latitude = String(g.latitude);
              if (g.longitude) updateData.longitude = String(g.longitude);
              if (g.placeId) updateData.placeId = g.placeId;
              if (g.formattedAddress) updateData.formattedAddress = g.formattedAddress;
              if (g.neighborhood) updateData.neighborhoodName = g.neighborhood;
              if (g.county) updateData.countyName = g.county;
            }
            
            await storage.updateHome(home.id, updateData);
            console.log(`Auto-enriched home ${home.id} with ${Object.keys(updateData).length - 1} fields`);
          } catch (err) {
            console.error("Auto-enrichment update failed:", err);
          }
        }).catch((err) => {
          console.error("Auto-enrichment failed:", err);
        });
      }
      
      res.status(201).json({ home: formatHomeResponse(home) });
    } catch (error) {
      console.error("Create home error:", error);
      res.status(500).json({ error: "Failed to create home" });
    }
  });

  app.put("/api/homes/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
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
  });

  app.delete("/api/homes/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
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
  });

  // ============ HouseFax API Endpoints ============

  // Google Places autocomplete for address input
  app.get("/api/housefax/autocomplete", requireAuth, async (req: Request, res: Response) => {
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
  });

  // Get place details from Google place ID
  app.get("/api/housefax/place/:placeId", requireAuth, async (req: Request<{ placeId: string }>, res: Response) => {
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
  });

  // Geocode an address
  app.post("/api/housefax/geocode", requireAuth, async (req: Request, res: Response) => {
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
  });

  // Fetch Zillow property data
  app.post("/api/housefax/zillow", requireAuth, async (req: Request, res: Response) => {
    try {
      const { address } = req.body;
      if (!address) {
        return res.status(400).json({ error: "Address is required" });
      }
      const property = await fetchZillowPropertyData(address);
      if (!property) {
        return res.json({ property: null, message: "No property data found" });
      }
      res.json({ property });
    } catch (error) {
      console.error("Zillow fetch error:", error);
      res.status(500).json({ error: "Failed to fetch property data" });
    }
  });

  // Full property enrichment (Zillow + Google)
  app.post("/api/housefax/enrich", requireAuth, async (req: Request, res: Response) => {
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
  });

  // Enrich an existing home with HouseFax data
  app.post("/api/homes/:id/enrich", requireAuth, async (req: Request<IdParams>, res: Response) => {
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

      // Prepare update data
      const updateData: Record<string, unknown> = {
        housefaxEnrichedAt: new Date()
      };

      // Apply Zillow data if available
      if (enrichment.zillow) {
        const z = enrichment.zillow;
        if (z.bedrooms && !home.bedrooms) updateData.bedrooms = z.bedrooms;
        if (z.bathrooms && !home.bathrooms) updateData.bathrooms = z.bathrooms;
        if (z.livingArea && !home.squareFeet) updateData.squareFeet = z.livingArea;
        if (z.yearBuilt && !home.yearBuilt) updateData.yearBuilt = z.yearBuilt;
        if (z.lotSize) updateData.lotSize = z.lotSize;
        if (z.zestimate) updateData.estimatedValue = String(z.zestimate);
        if (z.zpid) updateData.zillowId = z.zpid;
        if (z.url) updateData.zillowUrl = z.url;
        if (z.taxAssessedValue) updateData.taxAssessedValue = String(z.taxAssessedValue);
        if (z.lastSoldDate) updateData.lastSoldDate = z.lastSoldDate;
        if (z.lastSoldPrice) updateData.lastSoldPrice = String(z.lastSoldPrice);
      }

      // Apply Google data if available
      if (enrichment.google) {
        const g = enrichment.google;
        if (g.latitude) updateData.latitude = String(g.latitude);
        if (g.longitude) updateData.longitude = String(g.longitude);
        if (g.placeId) updateData.placeId = g.placeId;
        if (g.formattedAddress) updateData.formattedAddress = g.formattedAddress;
        if (g.neighborhood) updateData.neighborhoodName = g.neighborhood;
        if (g.county) updateData.countyName = g.county;
      }

      // Update the home
      const updatedHome = await storage.updateHome(req.params.id, updateData);
      
      res.json({ 
        home: updatedHome ? formatHomeResponse(updatedHome) : null,
        enrichment,
        fieldsUpdated: Object.keys(updateData).length - 1 // -1 for timestamp
      });
    } catch (error) {
      console.error("Home enrichment error:", error);
      res.status(500).json({ error: "Failed to enrich home" });
    }
  });

  // Get HouseFax context for AI
  app.get("/api/homes/:id/housefax-context", requireAuth, async (req: Request<IdParams>, res: Response) => {
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
  });

  // GET /api/housefax/:homeId - full HouseFax data for a home
  app.get("/api/housefax/:homeId", requireAuth, async (req: Request<{ homeId: string }>, res: Response) => {
    try {
      const { homeId } = req.params;
      const authUserId = req.authenticatedUserId!;

      const home = await storage.getHome(homeId);
      if (!home) return res.status(404).json({ error: "Home not found" });
      if (home.userId !== authUserId) return res.status(403).json({ error: "Access denied" });

      const entries = await db
        .select()
        .from(housefaxEntries)
        .where(eq(housefaxEntries.homeId, homeId))
        .orderBy(desc(housefaxEntries.completedAt));

      // Derive assets from service history (one per unique systemAffected)
      const systemMap = new Map<string, { lastServiced: Date; count: number; entries: typeof entries }>();
      for (const entry of entries) {
        const sys = entry.systemAffected || entry.serviceCategory || "General";
        if (!systemMap.has(sys)) systemMap.set(sys, { lastServiced: entry.completedAt, count: 0, entries: [] });
        const data = systemMap.get(sys)!;
        data.count += 1;
        data.entries.push(entry);
        if (entry.completedAt > data.lastServiced) data.lastServiced = entry.completedAt;
      }

      const KEY_SYSTEMS = ["HVAC", "Plumbing", "Electrical", "Roof", "Pest Control", "Lawn"];

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
        const sortedEntries = data.entries.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
        const lastEntry = sortedEntries[0];
        const intervalMonths = SERVICE_INTERVALS[system] || 12;
        const nextDueDate = new Date(data.lastServiced.getTime() + intervalMonths * 30 * 24 * 60 * 60 * 1000);
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
      const jobIds = entries.map(e => e.jobId).filter(Boolean) as string[];
      const allInvoices = jobIds.length > 0
        ? await db
            .select()
            .from(invoices)
            .where(and(
              inArray(invoices.jobId, jobIds),
              inArray(invoices.status, ["paid", "partially_paid"])
            ))
        : [];

      // Map invoices to document records; fall back to HouseFax entries for jobs without invoices
      const invoiceJobIds = new Set(allInvoices.map(i => i.jobId).filter(Boolean));
      const documentsFromInvoices = allInvoices.map(inv => {
        const matchingEntry = entries.find(e => e.jobId === inv.jobId);
        const totalAmt = inv.totalCents
          ? inv.totalCents / 100
          : parseFloat(inv.total as string || "0");
        return {
          id: inv.id,
          name: matchingEntry
            ? `${matchingEntry.serviceName} - ${new Date(matchingEntry.completedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
            : `Invoice #${inv.invoiceNumber}`,
          type: "invoice" as const,
          date: inv.paidAt
            ? new Date(inv.paidAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
            : new Date(inv.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          amount: totalAmt,
          providerId: matchingEntry?.providerId || null,
          providerName: matchingEntry?.providerName || null,
          hasPhotos: Array.isArray(matchingEntry?.photos) && (matchingEntry?.photos as string[]).length > 0,
          invoiceId: inv.id,
        };
      });

      // For entries without a real invoice (e.g., free jobs, or no invoice yet), add as receipt
      const documentsFromFreeJobs = entries
        .filter(e => !e.jobId || !invoiceJobIds.has(e.jobId))
        .filter(e => (e.costCents || 0) === 0) // Only include free services as receipts
        .map(e => ({
          id: e.id,
          name: `${e.serviceName} - ${new Date(e.completedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
          type: "receipt" as const,
          date: new Date(e.completedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          amount: 0,
          providerId: e.providerId,
          providerName: e.providerName,
          hasPhotos: Array.isArray(e.photos) && (e.photos as string[]).length > 0,
          invoiceId: null,
        }));

      const documents = [...documentsFromInvoices, ...documentsFromFreeJobs]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Calculate total spent
      const totalSpentCents = entries.reduce((sum, e) => sum + (e.costCents || 0), 0);

      // Generate AI insights if there are entries
      let insights: string[] = [];
      if (entries.length > 0) {
        try {
          const systemsServiced = [...systemMap.keys()].join(", ");
          const missingKey = KEY_SYSTEMS.filter(sys => {
            return !entries.some(e => {
              const s = (e.systemAffected || e.serviceCategory || "").toLowerCase();
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
          insights = content.split("\n").filter(l => l.trim()).slice(0, 3);
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
  });

  // POST /api/housefax/:homeId/score - recalculate and persist health score
  app.post("/api/housefax/:homeId/score", requireAuth, async (req: Request<{ homeId: string }>, res: Response) => {
    try {
      const { homeId } = req.params;
      const home = await storage.getHome(homeId);
      if (!home) return res.status(404).json({ error: "Home not found" });
      if (home.userId !== req.authenticatedUserId) return res.status(403).json({ error: "Access denied" });

      const score = await calculateAndPersistHouseFaxScore(homeId);
      res.json({ score });
    } catch (error) {
      console.error("HouseFax score error:", error);
      res.status(500).json({ error: "Failed to calculate score" });
    }
  });

  // POST /api/jobs/:id/photos - add photos to a job's housefax entry (provider only)
  // Accepts base64-encoded images, saves to /uploads/photos/, stores HTTPS URLs in DB
  app.post("/api/jobs/:id/photos", requireAuth, async (req: Request<IdParams>, res: Response) => {
    const MAX_PHOTOS_PER_JOB = 10;
    const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB per image
    const ALLOWED_MIME_PREFIXES = ["data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,"];

    try {
      const authUserId = req.authenticatedUserId!;
      const job = await storage.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });

      // Only allow the assigned provider to upload photos
      const providerProfile = await storage.getProviderByUserId(authUserId);
      if (!providerProfile || job.providerId !== providerProfile.id) {
        return res.status(403).json({ error: "Only the assigned provider can upload photos for this job" });
      }

      const { photos } = req.body as { photos: string[] };
      if (!Array.isArray(photos) || photos.length === 0) {
        return res.status(400).json({ error: "photos array is required" });
      }
      if (photos.length > MAX_PHOTOS_PER_JOB) {
        return res.status(400).json({ error: `Maximum ${MAX_PHOTOS_PER_JOB} photos per upload` });
      }

      // Validate each image: MIME type and size
      for (const photo of photos) {
        const validPrefix = ALLOWED_MIME_PREFIXES.find(p => photo.startsWith(p));
        if (!validPrefix) {
          return res.status(400).json({ error: "Only JPEG, PNG, and WebP images are allowed" });
        }
        const base64Data = photo.slice(validPrefix.length);
        const sizeBytes = Math.ceil((base64Data.length * 3) / 4);
        if (sizeBytes > MAX_PHOTO_BYTES) {
          return res.status(400).json({ error: "Each photo must be smaller than 5 MB" });
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
          return res.status(404).json({ error: "Could not create HouseFax entry for this job. No home found for client." });
        }
        entry = newEntry;
      }

      // Enforce total photo limit per job
      const existingPhotos = Array.isArray(entry.photos) ? (entry.photos as string[]) : [];
      if (existingPhotos.length + photos.length > MAX_PHOTOS_PER_JOB) {
        return res.status(400).json({ error: `This job already has ${existingPhotos.length} photos. Maximum is ${MAX_PHOTOS_PER_JOB} total.` });
      }

      // Upload each base64 image to Supabase Storage for persistent cloud storage
      const savedUrls: string[] = [];
      const isDev = process.env.NODE_ENV === "development";

      let supabaseClient: typeof import("./lib/supabase").supabase | null = null;
      try {
        supabaseClient = (await import("./lib/supabase")).supabase;
      } catch (importErr) {
        if (!isDev) {
          throw new Error("Photo storage is not configured. Please set SUPABASE_SERVICE_KEY and EXPO_PUBLIC_SUPABASE_URL.");
        }
        // Only allow local fallback in development
      }

      for (const photo of photos) {
        const prefix = ALLOWED_MIME_PREFIXES.find(p => photo.startsWith(p))!;
        const ext = prefix.includes("jpeg") ? "jpg" : prefix.includes("png") ? "png" : "webp";
        const mimeType = prefix.includes("jpeg") ? "image/jpeg" : prefix.includes("png") ? "image/png" : "image/webp";
        const base64Data = photo.slice(prefix.length);
        const buffer = Buffer.from(base64Data, "base64");
        const filename = `${job.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        if (supabaseClient) {
          const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from("job-photos")
            .upload(`photos/${filename}`, buffer, { contentType: mimeType, upsert: false });
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
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
          const filePath = path.join(uploadDir, filename);
          fs.writeFileSync(filePath, buffer);
          const protocol = req.protocol;
          const host = req.get("host") || "";
          savedUrls.push(`${protocol}://${host}/uploads/photos/${filename}`);
        } else {
          throw new Error("Photo storage is not available. Please configure Supabase Storage.");
        }
      }

      const updatedPhotos = [...existingPhotos, ...savedUrls];
      await db
        .update(housefaxEntries)
        .set({ photos: updatedPhotos })
        .where(eq(housefaxEntries.id, entry.id));

      res.json({ success: true, photosCount: updatedPhotos.length, urls: savedUrls });
    } catch (error) {
      console.error("Job photos upload error:", error);
      res.status(500).json({ error: "Failed to upload photos" });
    }
  });

  // POST /api/appointments/:id/complete - complete an appointment and trigger HouseFax auto-log
  app.post("/api/appointments/:id/complete", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      const appointment = await storage.getAppointment(req.params.id);
      if (!appointment) return res.status(404).json({ error: "Appointment not found" });

      // Only provider or homeowner can complete
      const providerRecord = await storage.getProviderByUserId(authUserId);
      const isProvider = providerRecord && appointment.providerId === providerRecord.id;
      const isOwner = appointment.userId === authUserId;
      if (!isProvider && !isOwner) return res.status(403).json({ error: "Access denied" });

      // Update appointment to completed
      const updatedAppointment = await storage.updateAppointment(req.params.id, {
        status: "completed",
      });

      if (!updatedAppointment) return res.status(500).json({ error: "Failed to update appointment" });

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
          autoLogHouseFaxEntry(completedJob).catch((e: unknown) => console.error("housefax auto-log error:", e));
        }
      } else {
        // No linked job - auto-log from appointment directly
        const { finalPrice } = req.body as { finalPrice?: string };
        const [provider] = appointment.providerId
          ? await db.select({ businessName: providers.businessName }).from(providers).where(eq(providers.id, appointment.providerId))
          : [null];

        const serviceCategory = detectServiceCategory(appointment.serviceName || "General Service");
        const costCents = finalPrice ? Math.round(parseFloat(finalPrice) * 100) : 0;

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
              messages: [{
                role: "user",
                content: `Write a 1-2 sentence summary for a homeowner's records: Service: ${appointment.serviceName}, Provider: ${provider?.businessName || "Unknown"}. Be concise and factual.`,
              }],
              max_tokens: 80,
            });
            aiSummary = aiResponse.choices[0]?.message?.content?.trim() || null;
          } catch (e) {
            console.error("[HouseFax] AI summary error:", e);
          }

          await db.insert(housefaxEntries).values({
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
          }).onConflictDoNothing();

          // Persist score after appointment-only entry creation (same as job path)
          calculateAndPersistHouseFaxScore(appointment.homeId).catch((e: unknown) =>
            console.error("[HouseFax] Score persistence failed (appointment path):", e)
          );
        }
      }

      res.json({ appointment: updatedAppointment });
    } catch (error) {
      console.error("Complete appointment error:", error);
      res.status(500).json({ error: "Failed to complete appointment" });
    }
  });

  // ============ End HouseFax API Endpoints ============

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
      const providers = await storage.getProviders(categoryId);
      res.json({ providers });
    } catch (error) {
      console.error("Get providers error:", error);
      res.status(500).json({ error: "Failed to get providers" });
    }
  });

  app.get("/api/providers/:id", async (req: Request<IdParams>, res: Response) => {
    try {
      const provider = await storage.getProvider(req.params.id);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }
      const providerServices = await storage.getProviderServices(req.params.id);
      const bookingPolicies = provider.bookingPolicies && typeof provider.bookingPolicies === "string"
        ? (() => { try { return JSON.parse(provider.bookingPolicies as string); } catch { return provider.bookingPolicies; } })()
        : provider.bookingPolicies;
      const businessHours = provider.businessHours && typeof provider.businessHours === "string"
        ? (() => { try { return JSON.parse(provider.businessHours as string); } catch { return provider.businessHours; } })()
        : provider.businessHours;
      res.json({ provider: { ...provider, bookingPolicies, businessHours }, services: providerServices });
    } catch (error) {
      console.error("Get provider error:", error);
      res.status(500).json({ error: "Failed to get provider" });
    }
  });

  app.get("/api/users/:userId/appointments", requireAuth, async (req: Request<UserIdParams>, res: Response) => {
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
  });

  app.get("/api/appointment/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      const appointment = await storage.getAppointment(req.params.id);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      const providerRecord = await storage.getProviderByUserId(authUserId);
      const isOwner = appointment.userId === authUserId;
      const isProvider = providerRecord && appointment.providerId === providerRecord.id;
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
      
      res.json({ 
        appointment: {
          ...appointment,
          statusHistory,
          provider: provider ? {
            id: provider.id,
            businessName: provider.businessName,
            rating: provider.rating,
            reviewCount: provider.reviewCount,
            phone: provider.phone,
            avatarUrl: provider.avatarUrl,
          } : null,
        }
      });
    } catch (error) {
      console.error("Get appointment error:", error);
      res.status(500).json({ error: "Failed to get appointment" });
    }
  });

  app.post("/api/appointments", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = insertAppointmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }
      const VALID_FREQUENCIES = ["biweekly", "monthly", "quarterly"];
      if (parsed.data.recurringFrequency && !VALID_FREQUENCIES.includes(parsed.data.recurringFrequency)) {
        return res.status(400).json({ error: "Invalid recurringFrequency", allowed: VALID_FREQUENCIES });
      }
      const appointment = await storage.createAppointment(parsed.data);

      // Find or create a client record in the provider's client list
      let clientId: string | null = null;
      try {
        const [user] = await db.select().from(users).where(eq(users.id, parsed.data.userId));
        if (user) {
          const existingClients = await db.select().from(clients)
            .where(eq(clients.providerId, parsed.data.providerId));
          const matchingClient = existingClients.find(
            (c) => c.email === user.email || (c.firstName === (user.firstName || "") && c.phone === user.phone)
          );
          if (matchingClient) {
            clientId = matchingClient.id;
          } else {
            const [newClient] = await db.insert(clients).values({
              providerId: parsed.data.providerId,
              firstName: user.firstName || "Unknown",
              lastName: user.lastName || "",
              email: user.email,
              phone: user.phone || "",
            }).returning();
            clientId = newClient.id;
          }
        }
      } catch (clientErr) {
        console.error("Client find/create error (non-fatal):", clientErr);
      }

      // Create a provider job record linked to this appointment
      if (clientId) {
        try {
          await db.insert(jobs).values({
            providerId: parsed.data.providerId,
            clientId,
            appointmentId: appointment.id,
            serviceId: parsed.data.serviceId ?? null,
            title: parsed.data.serviceName,
            description: parsed.data.description || null,
            scheduledDate: parsed.data.scheduledDate,
            scheduledTime: parsed.data.scheduledTime,
            estimatedDuration: 60,
            status: "scheduled",
            estimatedPrice: parsed.data.estimatedPrice ?? null,
            notes: `Booked via homeowner portal.`,
          });
        } catch (jobErr) {
          console.error("Job creation error (non-fatal):", jobErr);
        }
      }

      await storage.createNotification(
        parsed.data.userId,
        "Booking Confirmed",
        `Your ${parsed.data.serviceName} appointment has been scheduled.`,
        "booking_confirmed",
        JSON.stringify({ appointmentId: appointment.id })
      );

      // Fire booking confirmation emails (fire-and-forget)
      const [bookedUser] = await db.select().from(users).where(eq(users.id, parsed.data.userId)).catch(() => [null]);
      const [bookedProvider] = await db.select().from(providers).where(eq(providers.id, parsed.data.providerId)).catch(() => [null]);
      if (bookedUser && bookedProvider) {
        dispatch('booking.created', {
          clientEmail: bookedUser.email,
          clientName: `${bookedUser.firstName || ''} ${bookedUser.lastName || ''}`.trim() || bookedUser.email,
          providerEmail: bookedProvider.email ?? undefined,
          providerName: bookedProvider.businessName,
          serviceName: parsed.data.serviceName,
          appointmentDate: parsed.data.scheduledDate,
          appointmentTime: parsed.data.scheduledTime,
          estimatedPrice: parsed.data.estimatedPrice ?? undefined,
          confirmationNumber: appointment.id,
          description: parsed.data.description ?? undefined,
          relatedRecordType: 'appointment',
          relatedRecordId: appointment.id,
          recipientUserId: bookedUser.id,
        }).catch((e: unknown) => console.error('booking.created dispatch error:', e));
      }

      res.status(201).json({ appointment });
    } catch (error) {
      console.error("Create appointment error:", error);
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  app.put("/api/appointments/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      const existing = await storage.getAppointment(req.params.id);
      if (!existing) return res.status(404).json({ error: "Appointment not found" });
      const providerRecord = await storage.getProviderByUserId(authUserId);
      const isOwner = existing.userId === authUserId;
      const isProvider = providerRecord && existing.providerId === providerRecord.id;
      if (!isOwner && !isProvider) return res.status(403).json({ error: "Access denied" });
      const appointment = await storage.updateAppointment(req.params.id, req.body);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      // Dispatch booking.updated notification (fire-and-forget)
      const [updatedApptUser] = await db.select().from(users).where(eq(users.id, appointment.userId)).catch(() => [null]);
      const [updatedApptProvider] = await db.select().from(providers).where(eq(providers.id, appointment.providerId)).catch(() => [null]);
      if (updatedApptUser && updatedApptProvider) {
        dispatch('booking.updated', {
          clientEmail: updatedApptUser.email,
          clientName: `${updatedApptUser.firstName || ''} ${updatedApptUser.lastName || ''}`.trim() || updatedApptUser.email,
          providerName: updatedApptProvider.businessName,
          serviceName: appointment.serviceName,
          appointmentDate: appointment.scheduledDate,
          appointmentTime: appointment.scheduledTime,
          relatedRecordType: 'appointment',
          relatedRecordId: appointment.id,
          recipientUserId: updatedApptUser.id,
        }).catch((e: unknown) => console.error('booking.updated dispatch error:', e));
      }
      res.json({ appointment });
    } catch (error) {
      console.error("Update appointment error:", error);
      res.status(500).json({ error: "Failed to update appointment" });
    }
  });

  app.post("/api/appointments/:id/cancel", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      const existing = await storage.getAppointment(req.params.id);
      if (!existing) return res.status(404).json({ error: "Appointment not found" });
      const providerRecord = await storage.getProviderByUserId(authUserId);
      const isOwner = existing.userId === authUserId;
      const isProvider = providerRecord && existing.providerId === providerRecord.id;
      if (!isOwner && !isProvider) return res.status(403).json({ error: "Access denied" });
      const appointment = await storage.cancelAppointment(req.params.id);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      await storage.createNotification(
        appointment.userId,
        "Appointment Cancelled",
        `Your ${appointment.serviceName} appointment has been cancelled.`,
        "booking_cancelled",
        JSON.stringify({ appointmentId: appointment.id })
      );

      // Fire cancellation email (fire-and-forget)
      const [cancelledUser] = await db.select().from(users).where(eq(users.id, appointment.userId)).catch(() => [null]);
      const [cancelledProvider] = await db.select().from(providers).where(eq(providers.id, appointment.providerId)).catch(() => [null]);
      if (cancelledUser && cancelledProvider) {
        dispatch('booking.cancelled', {
          clientEmail: cancelledUser.email,
          clientName: `${cancelledUser.firstName || ''} ${cancelledUser.lastName || ''}`.trim() || cancelledUser.email,
          providerName: cancelledProvider.businessName,
          serviceName: appointment.serviceName,
          appointmentDate: appointment.scheduledDate,
          appointmentTime: appointment.scheduledTime,
          relatedRecordType: 'appointment',
          relatedRecordId: appointment.id,
          recipientUserId: cancelledUser.id,
        }).catch((e: unknown) => console.error('booking.cancelled dispatch error:', e));
      }

      res.json({ appointment });
    } catch (error) {
      console.error("Cancel appointment error:", error);
      res.status(500).json({ error: "Failed to cancel appointment" });
    }
  });

  app.post("/api/appointments/:id/reschedule", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      const existing = await storage.getAppointment(req.params.id);
      if (!existing) return res.status(404).json({ error: "Appointment not found" });
      const providerRecord = await storage.getProviderByUserId(authUserId);
      const isOwner = existing.userId === authUserId;
      const isProvider = providerRecord && existing.providerId === providerRecord.id;
      if (!isOwner && !isProvider) return res.status(403).json({ error: "Access denied" });
      const { scheduledDate, scheduledTime } = req.body;
      
      if (!scheduledDate || !scheduledTime) {
        return res.status(400).json({ error: "New date and time are required" });
      }
      
      const appointment = await storage.updateAppointment(req.params.id, {
        scheduledDate,
        scheduledTime,
        status: "pending", // Reset to pending when rescheduled
      });
      
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      await storage.createNotification(
        appointment.userId,
        "Appointment Rescheduled",
        `Your ${appointment.serviceName} appointment has been rescheduled to ${scheduledDate} at ${scheduledTime}.`,
        "booking_update",
        JSON.stringify({ appointmentId: appointment.id })
      );

      // Fire rescheduled email (fire-and-forget)
      const [rescheduledUser] = await db.select().from(users).where(eq(users.id, appointment.userId)).catch(() => [null]);
      const [rescheduledProvider] = await db.select().from(providers).where(eq(providers.id, appointment.providerId)).catch(() => [null]);
      if (rescheduledUser && rescheduledProvider) {
        dispatch('booking.rescheduled', {
          clientEmail: rescheduledUser.email,
          clientName: `${rescheduledUser.firstName || ''} ${rescheduledUser.lastName || ''}`.trim() || rescheduledUser.email,
          providerName: rescheduledProvider.businessName,
          serviceName: appointment.serviceName,
          appointmentDate: scheduledDate,
          appointmentTime: scheduledTime,
          oldDate: existing.scheduledDate,
          oldTime: existing.scheduledTime,
          relatedRecordType: 'appointment',
          relatedRecordId: appointment.id,
          recipientUserId: rescheduledUser.id,
        }).catch((e: unknown) => console.error('booking.rescheduled dispatch error:', e));
      }

      res.json({ appointment });
    } catch (error) {
      console.error("Reschedule appointment error:", error);
      res.status(500).json({ error: "Failed to reschedule appointment" });
    }
  });

  app.post("/api/appointments/:id/update-condition", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      const { description } = req.body;
      if (!description || typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ error: "Description is required" });
      }
      const existing = await storage.getAppointment(req.params.id);
      if (!existing) return res.status(404).json({ error: "Appointment not found" });
      if (existing.userId !== authUserId) return res.status(403).json({ error: "Access denied" });
      const updated = await storage.updateAppointment(req.params.id, { notes: description.trim() });
      res.json({ appointment: updated, success: true });
    } catch (error) {
      console.error("Update condition error:", error);
      res.status(500).json({ error: "Failed to update condition" });
    }
  });

  app.get("/api/appointments/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      const appointment = await storage.getAppointment(req.params.id);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      const providerRecord = await storage.getProviderByUserId(authUserId);
      const isOwner = appointment.userId === authUserId;
      const isProvider = providerRecord && appointment.providerId === providerRecord.id;
      if (!isOwner && !isProvider) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Enrich with provider identity so homeowner can see who is doing the work
      const provider = await storage.getProvider(appointment.providerId);
      const providerInfo = provider
        ? { businessName: provider.businessName, phone: provider.phone, email: provider.email }
        : null;
      res.json({ appointment, provider: providerInfo });
    } catch (error) {
      console.error("Get appointment error:", error);
      res.status(500).json({ error: "Failed to get appointment" });
    }
  });

  app.get("/api/notifications/:userId", requireAuth, async (req: Request<UserIdParams>, res: Response) => {
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
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const notification = await storage.getNotification(req.params.id);
      if (!notification) return res.status(404).json({ error: "Notification not found" });
      if (notification.userId !== req.authenticatedUserId) return res.status(403).json({ error: "Access denied" });
      await storage.markNotificationRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/:userId/read-all", requireAuth, async (req: Request<UserIdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      if (req.params.userId !== authUserId) {
        return res.status(403).json({ error: "Access denied" });
      }
      await db.update(notifications).set({ isRead: true }).where(
        and(eq(notifications.userId, authUserId), eq(notifications.isRead, false))
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Mark all notifications read error:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  app.get("/api/notifications/:userId/unread-count", requireAuth, async (req: Request<UserIdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      if (req.params.userId !== authUserId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(eq(notifications.userId, authUserId), eq(notifications.isRead, false)));
      const count = result[0]?.count || 0;
      res.json({ count });
    } catch (error) {
      console.error("Get unread count error:", error);
      res.status(500).json({ error: "Failed to get unread count" });
    }
  });

  app.post("/api/push-tokens", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.authenticatedUserId!;
      const { token, platform } = req.body;
      if (!token) {
        return res.status(400).json({ error: "token is required" });
      }
      await db
        .insert(pushTokens)
        .values({ userId, token, platform: platform || "expo", isActive: true })
        .onConflictDoNothing();
      await db.update(pushTokens).set({ isActive: true, updatedAt: new Date() }).where(
        and(eq(pushTokens.userId, userId), eq(pushTokens.token, token))
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Register push token error:", error);
      res.status(500).json({ error: "Failed to register push token" });
    }
  });

  app.delete("/api/push-tokens", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.authenticatedUserId!;
      const { token } = req.body;
      if (token) {
        await db.update(pushTokens).set({ isActive: false, updatedAt: new Date() }).where(
          and(eq(pushTokens.userId, userId), eq(pushTokens.token, token))
        );
      } else {
        await db.update(pushTokens).set({ isActive: false, updatedAt: new Date() }).where(
          eq(pushTokens.userId, userId)
        );
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete push token error:", error);
      res.status(500).json({ error: "Failed to delete push token" });
    }
  });

  app.get("/api/notification-preferences/:userId", requireAuth, async (req: Request<UserIdParams>, res: Response) => {
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
          emailBookingConfirmation: true, emailBookingReminder: true, emailBookingCancelled: true,
          emailInvoiceCreated: true, emailInvoiceReminder: true, emailInvoicePaid: true,
          emailPaymentFailed: true, emailReviewRequest: true,
          pushEnabled: true, inAppEnabled: true,
        };
        res.json({ preferences: { userId: authUserId, ...defaults } });
      } else {
        res.json({ preferences: prefs });
      }
    } catch (error) {
      console.error("Get notification preferences error:", error);
      res.status(500).json({ error: "Failed to get notification preferences" });
    }
  });

  app.post("/api/notification-preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.authenticatedUserId!;
      const updates = req.body;
      const allowed = [
        "emailBookingConfirmation", "emailBookingReminder", "emailBookingCancelled",
        "emailInvoiceCreated", "emailInvoiceReminder", "emailInvoicePaid",
        "emailPaymentFailed", "emailReviewRequest",
        "pushEnabled", "inAppEnabled",
      ];
      const safeUpdates: Record<string, unknown> = { userId, updatedAt: new Date() };
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
      res.status(500).json({ error: "Failed to update notification preferences" });
    }
  });

  app.post("/api/chat", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
    try {
      const { messages, homeId } = req.body as { messages: ChatMessage[]; homeId?: string };

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      // Build system prompt with optional HouseFax context
      let systemPrompt = HOMEBASE_SYSTEM_PROMPT;
      
      if (homeId) {
        const home = await storage.getHome(homeId);
        if (home) {
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

      const content = completion.choices[0]?.message?.content || "I'm here to help.";
      res.json({ content, done: true });
    } catch (error) {
      console.error("Error in chat:", error);
      res.status(500).json({ error: "Failed to process chat request" });
    }
  });

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

  app.post("/api/chat/simple", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
    try {
      const { message, history, homeId } = req.body as { 
        message: string; 
        history?: Array<{ role: string; content: string }>;
        homeId?: string;
      };

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Build system prompt with optional HouseFax context
      let systemPrompt = ENHANCED_CHAT_PROMPT;
      
      if (homeId) {
        const home = await storage.getHome(homeId);
        if (home) {
          const houseFaxContext = buildHouseFaxContext(home);
          systemPrompt = `${ENHANCED_CHAT_PROMPT}\n\n## Current Home Context (HouseFax)\nYou are speaking with a homeowner about their property. Use this information to give personalized advice:\n\n${houseFaxContext}`;
        }
      }

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt },
      ];
      
      if (history) {
        messages.push(...history.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content
        })));
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
          response: parsed.response || "I'm here to help with your home questions.",
          needsService: parsed.needsService || false,
          category: parsed.category || null,
          problemSummary: parsed.problemSummary || null,
        });
      } catch {
        res.json({ response: content, needsService: false, category: null, problemSummary: null });
      }
    } catch (error) {
      console.error("Error in simple chat:", error);
      res.status(500).json({ error: "Failed to process chat request" });
    }
  });

  // ============ PROVIDER AI ASSISTANT ============

  app.post("/api/ai/provider-assistant", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
    try {
      const { message, businessContext, conversationHistory } = req.body as {
        message: string;
        businessContext?: string;
        conversationHistory?: Array<{ role: string; content: string }>;
      };

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const systemPrompt = businessContext
        ? `${PROVIDER_ASSISTANT_PROMPT}\n\nCurrent Business Context:\n${businessContext}`
        : PROVIDER_ASSISTANT_PROMPT;

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt },
      ];

      if (conversationHistory) {
        messages.push(
          ...conversationHistory.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }))
        );
      }

      messages.push({ role: "user", content: message });

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 1024,
      });

      const content = response.choices[0]?.message?.content || "I'm here to help with your business questions.";

      res.json({ response: content });
    } catch (error) {
      console.error("Provider assistant error:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  // ============ AI PRICING ASSISTANT ============

  app.post("/api/ai/pricing-assistant", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
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
          const completedJobs = jobs.filter(j => 
            j.status === 'completed' && j.finalPrice
          );
          if (completedJobs.length > 0) {
            const avgPrice = completedJobs.reduce((sum, j) => 
              sum + parseFloat(j.finalPrice || '0'), 0
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
        const suggestion = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
        res.json({ suggestion });
      } catch {
        res.json({
          suggestion: {
            suggestedPrice: 150,
            minPrice: 100,
            maxPrice: 250,
            reasoning: "Based on typical service rates in the home services industry.",
          },
        });
      }
    } catch (error) {
      console.error("Pricing assistant error:", error);
      res.status(500).json({ error: "Failed to generate pricing suggestion" });
    }
  });

  // ============ INLINE AI SUGGESTION ROUTES ============

  app.post("/api/ai/suggest-description", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
    try {
      const { serviceName, category } = req.body as { serviceName: string; category: string };
      if (!serviceName || !category) {
        return res.status(400).json({ error: "serviceName and category are required" });
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
  });

  app.post("/api/ai/suggest-service-names", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
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
        const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.names) ? parsed.names : Object.values(parsed)[0]);
        names = (arr as string[]).slice(0, 3).filter((n) => typeof n === "string");
      } catch {
        names = [];
      }
      res.json({ names });
    } catch (error) {
      console.error("Suggest service names error:", error);
      res.status(500).json({ error: "Failed to generate service names" });
    }
  });

  app.post("/api/ai/suggest-price", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
    try {
      const { serviceName, category, pricingType, location } = req.body as {
        serviceName: string;
        category: string;
        pricingType: string;
        location?: string;
      };

      if (!serviceName || !category || !pricingType) {
        return res.status(400).json({ error: "serviceName, category, and pricingType are required" });
      }

      const pricingContext: Record<string, string> = {
        "flat": "a single flat rate for the entire job",
        "variable": "tier-based pricing (e.g., small/medium/large with different rates)",
        "service_call": "a service call fee plus hourly labor",
        "quote": "custom quote only — no upfront price",
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
        const suggestion = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
        res.json({ suggestion });
      } catch {
        res.json({
          suggestion: { minPrice: 50, maxPrice: 150, unit: "per job", hint: "Price competitively to win your first bookings." },
        });
      }
    } catch (error) {
      console.error("Suggest price error:", error);
      res.status(500).json({ error: "Failed to generate price suggestion" });
    }
  });

  app.post("/api/ai/improve-bio", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
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

      const improvedBio = response.choices[0]?.message?.content?.trim() || currentBio;
      res.json({ improvedBio });
    } catch (error) {
      console.error("Improve bio error:", error);
      res.status(500).json({ error: "Failed to improve bio" });
    }
  });

  // ============ PUBLIC AI ONBOARDING ROUTES (no auth required) ============

  app.post("/api/ai/onboarding/suggest-business-names", onboardingRateLimit, async (req: Request, res: Response) => {
    try {
      const { category } = req.body as { category: string };
      if (!category) return res.status(400).json({ error: "category is required" });

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

      const raw = response.choices[0]?.message?.content?.trim() || '{"names":[]}';
      const parsed = JSON.parse(raw);
      res.json({ names: Array.isArray(parsed.names) ? parsed.names.slice(0, 3) : [] });
    } catch (error) {
      console.error("Suggest business names error:", error);
      res.status(500).json({ error: "Failed to suggest business names" });
    }
  });

  app.post("/api/ai/onboarding/suggest-service-names", onboardingRateLimit, async (req: Request, res: Response) => {
    try {
      const { category } = req.body as { category: string };
      if (!category) return res.status(400).json({ error: "category is required" });

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

      const raw = response.choices[0]?.message?.content?.trim() || '{"names":[]}';
      const parsed = JSON.parse(raw);
      res.json({ names: Array.isArray(parsed.names) ? parsed.names.slice(0, 3) : [] });
    } catch (error) {
      console.error("Suggest service names error:", error);
      res.status(500).json({ error: "Failed to suggest service names" });
    }
  });

  // ── AI Service Blueprint Endpoints ──────────────────────────────────────

  app.post("/api/ai/suggest-service-types", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
    try {
      const { businessDescription } = req.body as { businessDescription: string };
      if (!businessDescription?.trim()) {
        return res.status(400).json({ error: "businessDescription is required" });
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
        const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
        services = Array.isArray(parsed.services) ? parsed.services : [];
      } catch { services = []; }
      res.json({ services });
    } catch (error) {
      console.error("Suggest service types error:", error);
      res.status(500).json({ error: "Failed to suggest service types" });
    }
  });

  app.post("/api/ai/service-blueprint", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
    try {
      const { businessDescription, serviceType, category, providerLocation } = req.body as {
        businessDescription: string;
        serviceType: string;
        category: string;
        providerLocation?: string;
      };
      if (!serviceType || !category) {
        return res.status(400).json({ error: "serviceType and category are required" });
      }

      const CATEGORY_CONTEXT: Record<string, string> = {
        Cleaning: "residential/commercial cleaning services. Common intake questions: home size, number of bedrooms/bathrooms, pets, special areas. Common add-ons: inside fridge, inside oven, laundry, windows.",
        HVAC: "heating, cooling, and ventilation services. Common intake questions: system age, brand, symptoms, last service date. Common add-ons: filter replacement, UV light, duct cleaning.",
        Plumbing: "pipe, drain, and fixture services. Common intake questions: issue type, location in home, urgency. Common add-ons: drain cleaning, water heater flush, leak inspection.",
        Electrical: "wiring, panel, and fixture services. Common intake questions: panel type, issue description, home age. Common add-ons: GFCI outlets, surge protection, smoke detectors.",
        Landscaping: "lawn, garden, and outdoor services. Common intake questions: yard size, grass type, frequency. Common add-ons: edging, fertilizing, leaf removal, mulching.",
        Handyman: "general repairs and installations. Common intake questions: task description, materials needed, estimated time. Common add-ons: supply pickup, furniture assembly, caulking.",
        Painting: "interior/exterior painting. Common intake questions: rooms or areas, ceiling height, current color, prep needed. Common add-ons: trim, closets, ceiling, primer coat.",
        Roofing: "roofing repair and replacement. Common intake questions: roof type, age, leak location, sq footage. Common add-ons: gutter cleaning, soffit/fascia, attic inspection.",
        "Pest Control": "pest elimination and prevention. Common intake questions: pest type, infestation severity, home size. Common add-ons: termite inspection, rodent exclusion, quarterly service.",
        "Pressure Washing": "exterior surface cleaning. Common intake questions: surface type, square footage, stain type. Common add-ons: sealing, gutter flush, deck/fence.",
        "Junk Removal": "debris and junk hauling. Common intake questions: volume estimate, item types, hazardous materials. Common add-ons: dumpster rental, same-day service, donation drop-off.",
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
  "bookingMode": "instant" | "starts_at" | "quote_only",
  "aiPricingInsight": "one sentence identifying a specific profit leak or pricing opportunity for this service type"
}

Rules:
- intakeQuestions: 3-5 questions specific to this exact service. Include property size where relevant.
- addOns: 2-4 high-value add-ons with realistic prices for ${providerLocation || "US"} market
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
      } catch { blueprint = {}; }
      res.json({ blueprint });
    } catch (error) {
      console.error("Service blueprint error:", error);
      res.status(500).json({ error: "Failed to generate service blueprint" });
    }
  });

  app.post("/api/ai/edit-blueprint", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
    try {
      const { blueprint, instruction } = req.body as { blueprint: unknown; instruction: string };
      if (!blueprint || !instruction?.trim()) {
        return res.status(400).json({ error: "blueprint and instruction are required" });
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
        updatedBlueprint = JSON.parse(response.choices[0]?.message?.content || "{}");
      } catch { updatedBlueprint = blueprint; }
      res.json({ blueprint: updatedBlueprint });
    } catch (error) {
      console.error("Edit blueprint error:", error);
      res.status(500).json({ error: "Failed to edit blueprint" });
    }
  });

  app.post("/api/ai/onboarding/suggest-description", onboardingRateLimit, async (req: Request, res: Response) => {
    try {
      const { serviceName, category } = req.body as { serviceName: string; category: string };
      if (!serviceName || !category) return res.status(400).json({ error: "serviceName and category are required" });

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
  });

  app.post("/api/ai/onboarding/suggest-price", onboardingRateLimit, async (req: Request, res: Response) => {
    try {
      const { serviceName, category, pricingType, location } = req.body as {
        serviceName: string;
        category: string;
        pricingType: string;
        location?: string;
      };
      if (!serviceName || !category || !pricingType) {
        return res.status(400).json({ error: "serviceName, category, and pricingType are required" });
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
  });

  app.post("/api/ai/onboarding/service-blueprint", onboardingRateLimit, async (req: Request, res: Response) => {
    try {
      const { businessDescription, serviceType, category, providerLocation } = req.body as {
        businessDescription: string;
        serviceType: string;
        category: string;
        providerLocation?: string;
      };
      if (!serviceType || !category) {
        return res.status(400).json({ error: "serviceType and category are required" });
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
  "bookingMode": "instant" | "starts_at" | "quote_only",
  "aiPricingInsight": "one sentence identifying a pricing opportunity for this service type"
}

Rules:
- intakeQuestions: 3-5 questions specific to this exact service
- addOns: 2-4 high-value add-ons with realistic prices
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
  });

  app.post("/api/ai/onboarding/generate-bio", onboardingRateLimit, async (req: Request, res: Response) => {
    try {
      const { businessName, category, serviceName } = req.body as {
        businessName: string;
        category: string;
        serviceName?: string;
      };
      if (!businessName || !category) return res.status(400).json({ error: "businessName and category are required" });

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
  });

  app.post("/api/ai/onboarding/polish-text", onboardingRateLimit, async (req: Request, res: Response) => {
    try {
      const { text, context } = req.body as { text: string; context?: string };
      if (!text || !text.trim()) return res.status(400).json({ error: "text is required" });

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

      const rawPolished = response.choices[0]?.message?.content?.trim() || text;
      const polished = rawPolished.replace(/^["']|["']$/g, "").trim();
      res.json({ polished });
    } catch (error) {
      console.error("Polish text error:", error);
      res.status(500).json({ error: "Failed to polish text" });
    }
  });

  app.post("/api/ai/suggest-cities", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
    try {
      const { zipCodes } = req.body as { zipCodes: string[] };
      if (!Array.isArray(zipCodes) || zipCodes.length === 0) {
        return res.status(400).json({ error: "zipCodes array is required" });
      }
      const validZips = zipCodes.filter((z) => /^\d{5}$/.test(String(z).trim())).slice(0, 50);
      if (validZips.length === 0) {
        return res.status(400).json({ error: "No valid 5-digit ZIP codes provided" });
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
  });

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

  app.post("/api/intake/analyze", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
    try {
      const { problem, conversationHistory } = req.body as { 
        problem: string; 
        conversationHistory?: { role: string; content: string }[];
      };

      if (!problem) {
        return res.status(400).json({ error: "Problem description is required" });
      }

      const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: INTAKE_SYSTEM_PROMPT },
      ];

      if (conversationHistory && conversationHistory.length > 0) {
        for (const msg of conversationHistory) {
          messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
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
          estimatedPriceRange: analysis.estimatedPriceRange || { min: 100, max: 300 },
        }
      });
    } catch (error) {
      console.error("Error in intake analysis:", error);
      res.status(500).json({ error: "Failed to analyze problem" });
    }
  });

  app.post("/api/intake/refine", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
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
        return res.status(400).json({ error: "Original analysis and answers required" });
      }

      const refinementPrompt = `Based on this home service issue:
Category: ${originalAnalysis.category}
Summary: ${originalAnalysis.summary}
Severity: ${originalAnalysis.severity}

The homeowner answered these clarifying questions:
${answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n")}

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
          { role: "system", content: "You are HomeBase's pricing AI. Generate realistic estimates with service package options to help pros close leads. Respond with valid JSON only." },
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
          refinedSummary: refinedAnalysis.refinedSummary || originalAnalysis.summary,
          severity: refinedAnalysis.severity || originalAnalysis.severity,
          recommendedUrgency: refinedAnalysis.recommendedUrgency || "flexible",
          scopeOfWork: refinedAnalysis.scopeOfWork || [],
          scopeExclusions: refinedAnalysis.scopeExclusions || [],
          serviceOptions: refinedAnalysis.serviceOptions || [],
          materialEstimate: refinedAnalysis.materialEstimate || null,
          timeEstimate: refinedAnalysis.timeEstimate || null,
          confidence: refinedAnalysis.confidence || 75,
        }
      });
    } catch (error) {
      console.error("Error refining intake:", error);
      res.status(500).json({ error: "Failed to refine analysis" });
    }
  });

  app.post("/api/intake/match-providers", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
    try {
      const { category, zipCode } = req.body as { category: string; zipCode?: string };

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
        .map(provider => ({
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
  });

  function calculateTrustScore(provider: { rating?: string | number | null; reviewCount?: number | null; yearsExperience?: number | null; isVerified?: boolean | null }): number {
    const rating = typeof provider.rating === 'string' ? parseFloat(provider.rating) : (provider.rating || 4);
    const ratingScore = rating * 15;
    const reviewScore = Math.min((provider.reviewCount || 0) / 5, 20);
    const experienceScore = Math.min((provider.yearsExperience || 0) * 2, 20);
    const verifiedBonus = provider.isVerified ? 15 : 0;
    return Math.round(ratingScore + reviewScore + experienceScore + verifiedBonus);
  }

  app.post("/api/intake/explain-issue", requireAuth, aiRateLimit, async (req: Request, res: Response) => {
    try {
      const { problem, category, answers, service, providerName } = req.body as {
        problem: string;
        category: string;
        answers: Record<string, string | string[]>;
        service?: string;
        providerName?: string;
      };

      if (!problem || !category) {
        return res.status(400).json({ error: "Problem and category are required" });
      }

      const answersSummary = Object.entries(answers)
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
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
          { role: "system", content: "You are a home services expert helping homeowners understand their issues. Be clear, helpful, and reassuring." },
          { role: "user", content: prompt },
        ],
        max_tokens: 800,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);

      res.json({
        explanation: parsed.explanation || "Based on your description, we understand your situation and will connect you with a qualified professional.",
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
  });

  // ============ HOME SERVICE HISTORY & REMINDERS ============
  
  // Get service history for a home (completed appointments)
  app.get("/api/homes/:homeId/service-history", requireAuth, async (req: Request<{ homeId: string }>, res: Response) => {
    try {
      const { homeId } = req.params;
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
        .orderBy(sql`${appointments.completedAt} DESC NULLS LAST, ${appointments.scheduledDate} DESC`);

      res.json({ serviceHistory });
    } catch (error) {
      console.error("Error fetching service history:", error);
      res.status(500).json({ error: "Failed to fetch service history" });
    }
  });
  
  // Get maintenance reminders for a home
  app.get("/api/homes/:homeId/reminders", requireAuth, async (req: Request<{ homeId: string }>, res: Response) => {
    try {
      const { homeId } = req.params;
      const reminders = await db.select()
        .from(maintenanceReminders)
        .where(eq(maintenanceReminders.homeId, homeId))
        .orderBy(maintenanceReminders.nextDueAt);
      
      res.json({ reminders });
    } catch (error) {
      console.error("Error fetching reminders:", error);
      res.status(500).json({ error: "Failed to fetch reminders" });
    }
  });
  
  // Create maintenance reminder
  app.post("/api/homes/:homeId/reminders", requireAuth, async (req: Request<{ homeId: string }>, res: Response) => {
    try {
      const { homeId } = req.params;
      const { title, description, category, frequency, nextDueAt, userId } = req.body;
      
      const [reminder] = await db.insert(maintenanceReminders)
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
  });
  
  // Mark reminder as completed (updates lastCompletedAt and nextDueAt)
  app.put("/api/reminders/:id/complete", requireAuth, async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      
      const [existing] = await db.select().from(maintenanceReminders).where(eq(maintenanceReminders.id, id));
      if (!existing) {
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
      
      const [updated] = await db.update(maintenanceReminders)
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
  });

  // ============ PROVIDER AVAILABILITY ENDPOINT ============

  app.get("/api/provider/:providerId/availability", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      const { date } = req.query as { date?: string };

      // Load availability rules from the provider's active booking link
      const [link] = await db.select().from(bookingLinks)
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
        try { rules = JSON.parse(link.availabilityRules) as AvailabilityRules; } catch { /* ignore */ }
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
        const label = minute === 0 ? `${displayHour} ${ampm}` : `${displayHour}:${String(minute).padStart(2, "0")} ${ampm}`;
        slots.push({ startTime, label });
      }

      res.json({ slots, workingDays: rules.workingHours?.days ?? [1, 2, 3, 4, 5] });
    } catch (error) {
      console.error("Provider availability error:", error);
      res.status(500).json({ error: "Failed to get availability" });
    }
  });

  // ============ PROVIDER CUSTOM SERVICES ROUTES ============

  app.get("/api/provider/:providerId/custom-services", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      const publishedOnly = req.query.publishedOnly === "true";
      // Non-published services are private — require ownership when returning all services
      if (!publishedOnly) {
        if (!(await assertProviderOwnership(req, req.params.providerId, res))) return;
      }
      const conditions = publishedOnly
        ? and(eq(providerCustomServices.providerId, req.params.providerId), eq(providerCustomServices.isPublished, true))
        : eq(providerCustomServices.providerId, req.params.providerId);
      const svcList = await db.select().from(providerCustomServices)
        .where(conditions)
        .orderBy(providerCustomServices.createdAt);
      res.json({ services: svcList });
    } catch (error) {
      console.error("Get custom services error:", error);
      res.status(500).json({ error: "Failed to get services" });
    }
  });

  app.post("/api/provider/:providerId/custom-services", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      // Verify provider exists and belongs to authenticated user
      const provider = await storage.getProvider(req.params.providerId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }
      if (provider.userId !== authUserId) {
        return res.status(403).json({ error: "Access denied: provider does not belong to you" });
      }
      const parsed = insertProviderCustomServiceSchema.safeParse({ ...req.body, providerId: req.params.providerId });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }
      const [svc] = await db.insert(providerCustomServices).values(parsed.data).returning();
      res.status(201).json({ service: svc });
    } catch (error) {
      console.error("Create custom service error:", error);
      res.status(500).json({ error: "Failed to create service" });
    }
  });

  app.put("/api/provider/:providerId/custom-services/:id", requireAuth, async (req: Request<ProviderIdParams & IdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      const [existing] = await db.select().from(providerCustomServices)
        .where(eq(providerCustomServices.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Service not found" });
      if (existing.providerId !== req.params.providerId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      // Verify ownership: the provider must belong to the authenticated user
      const provider = await storage.getProvider(req.params.providerId);
      if (!provider || provider.userId !== authUserId) {
        return res.status(403).json({ error: "Access denied: provider does not belong to you" });
      }
      // Allowlist mutable fields only — prevent mass-assignment of id/providerId/createdAt
      const { name, category, description, pricingType, basePrice, priceFrom, priceTo, priceTiersJson, duration, isPublished, isAddon, isRecurring, recurringFrequency, recurringPrice, intakeQuestionsJson, addOnsJson, bookingMode, aiPricingInsight } = req.body;
      const allowedUpdate: Partial<typeof providerCustomServices.$inferInsert> = {};
      if (name !== undefined) allowedUpdate.name = name;
      if (category !== undefined) allowedUpdate.category = category;
      if (description !== undefined) allowedUpdate.description = description;
      if (pricingType !== undefined) allowedUpdate.pricingType = pricingType;
      if (basePrice !== undefined) allowedUpdate.basePrice = basePrice;
      if (priceFrom !== undefined) allowedUpdate.priceFrom = priceFrom;
      if (priceTo !== undefined) allowedUpdate.priceTo = priceTo;
      if (priceTiersJson !== undefined) allowedUpdate.priceTiersJson = priceTiersJson;
      if (duration !== undefined) allowedUpdate.duration = duration;
      if (isPublished !== undefined) allowedUpdate.isPublished = isPublished;
      if (isAddon !== undefined) allowedUpdate.isAddon = isAddon;
      if (isRecurring !== undefined) allowedUpdate.isRecurring = isRecurring;
      if (recurringFrequency !== undefined) allowedUpdate.recurringFrequency = recurringFrequency;
      if (recurringPrice !== undefined) allowedUpdate.recurringPrice = recurringPrice;
      if (intakeQuestionsJson !== undefined) allowedUpdate.intakeQuestionsJson = intakeQuestionsJson;
      if (addOnsJson !== undefined) allowedUpdate.addOnsJson = addOnsJson;
      const VALID_BOOKING_MODES = ["instant", "starts_at", "quote_only"];
      if (bookingMode !== undefined) {
        if (!VALID_BOOKING_MODES.includes(bookingMode)) {
          return res.status(400).json({ error: `Invalid bookingMode. Must be one of: ${VALID_BOOKING_MODES.join(", ")}` });
        }
        allowedUpdate.bookingMode = bookingMode;
      }
      if (aiPricingInsight !== undefined) allowedUpdate.aiPricingInsight = aiPricingInsight;
      const [svc] = await db.update(providerCustomServices)
        .set({ ...allowedUpdate, updatedAt: new Date() })
        .where(eq(providerCustomServices.id, req.params.id))
        .returning();
      res.json({ service: svc });
    } catch (error) {
      console.error("Update custom service error:", error);
      res.status(500).json({ error: "Failed to update service" });
    }
  });

  app.delete("/api/provider/:providerId/custom-services/:id", requireAuth, async (req: Request<ProviderIdParams & IdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      const [existing] = await db.select().from(providerCustomServices)
        .where(eq(providerCustomServices.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Service not found" });
      if (existing.providerId !== req.params.providerId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      // Verify ownership: the provider must belong to the authenticated user
      const provider = await storage.getProvider(req.params.providerId);
      if (!provider || provider.userId !== authUserId) {
        return res.status(403).json({ error: "Access denied: provider does not belong to you" });
      }
      await db.delete(providerCustomServices)
        .where(eq(providerCustomServices.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Delete custom service error:", error);
      res.status(500).json({ error: "Failed to delete service" });
    }
  });

  // ============ PROVIDER PORTAL ROUTES ============

  // Provider registration/onboarding
  app.post("/api/provider/register", requireAuth, async (req: Request, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      const parsed = insertProviderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }

      // Enforce that the caller can only register a provider profile for themselves
      if (parsed.data.userId && parsed.data.userId !== authUserId) {
        return res.status(403).json({ error: "Cannot register provider profile for another user" });
      }

      // Ensure userId is always the authenticated user (even if not in body)
      const providerData = { ...parsed.data, userId: authUserId };

      // Check if user already has a provider profile
      const existing = await storage.getProviderByUserId(authUserId);
      if (existing) {
        return res.status(409).json({ error: "User already has a provider profile" });
      }

      const provider = await storage.createProvider(providerData);
      
      // Mark user as provider
      await storage.updateUser(authUserId, { isProvider: true });

      res.status(201).json({ provider });
    } catch (error) {
      console.error("Provider registration error:", error);
      res.status(500).json({ error: "Failed to register provider" });
    }
  });

  // Get provider by user ID
  app.get("/api/provider/user/:userId", requireAuth, async (req: Request<UserIdParams>, res: Response) => {
    try {
      const provider = await storage.getProviderByUserId(req.params.userId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }
      const parsed = { ...provider } as any;
      if (parsed.bookingPolicies && typeof parsed.bookingPolicies === "string") {
        try { parsed.bookingPolicies = JSON.parse(parsed.bookingPolicies); } catch {}
      }
      if (parsed.businessHours && typeof parsed.businessHours === "string") {
        try { parsed.businessHours = JSON.parse(parsed.businessHours); } catch {}
      }
      res.json({ provider: parsed });
    } catch (error) {
      console.error("Get provider error:", error);
      res.status(500).json({ error: "Failed to get provider" });
    }
  });

  // Get provider by provider ID (owner-only)
  app.get("/api/provider/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const provider = await storage.getProvider(req.params.id);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }
      if (provider.userId !== req.authenticatedUserId) {
        return res.status(403).json({ error: "Forbidden: you do not own this provider profile" });
      }
      const bookingPolicies =
        provider.bookingPolicies && typeof provider.bookingPolicies === "string"
          ? (() => { try { return JSON.parse(provider.bookingPolicies as string); } catch { return provider.bookingPolicies; } })()
          : provider.bookingPolicies;
      const businessHours =
        provider.businessHours && typeof provider.businessHours === "string"
          ? (() => { try { return JSON.parse(provider.businessHours as string); } catch { return provider.businessHours; } })()
          : provider.businessHours;
      res.json({ provider: { ...provider, bookingPolicies, businessHours } });
    } catch (error) {
      console.error("Get provider by ID error:", error);
      res.status(500).json({ error: "Failed to get provider" });
    }
  });

  // Update provider profile (PUT - full update)
  app.put("/api/provider/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      // Ownership check: only the provider's own user account may update this profile
      const existing = await storage.getProvider(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Provider not found" });
      }
      if (existing.userId !== req.authenticatedUserId) {
        return res.status(403).json({ error: "Forbidden: you do not own this provider profile" });
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
  });

  // Update provider profile (PATCH - partial update, serializes JSON fields)
  app.patch("/api/provider/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const { id } = req.params;

      // Ownership check: only the provider's own user account may update this profile
      const ownerCheck = await storage.getProvider(id);
      if (!ownerCheck) {
        return res.status(404).json({ error: "Provider not found" });
      }
      if (ownerCheck.userId !== req.authenticatedUserId) {
        return res.status(403).json({ error: "Forbidden: you do not own this provider profile" });
      }

      const body = req.body;
      const update: Record<string, any> = {};

      const directFields = [
        "businessName", "description", "phone", "email", "serviceArea",
        "avatarUrl", "hourlyRate", "yearsExperience", "serviceRadius",
        "serviceZipCodes", "serviceCities", "isPublic",
      ];
      for (const field of directFields) {
        if (body[field] !== undefined) update[field] = body[field];
      }

      // Store JSON object fields as objects (Supabase jsonb columns)
      // instantBooking and advanceBookingDays are stored inside bookingPolicies JSON (not top-level columns)
      if (body.bookingPolicies !== undefined || body.instantBooking !== undefined || body.advanceBookingDays !== undefined) {
        const existingProvider = await storage.getProvider(id);
        let currentPolicies: Record<string, any> = {};
        if (existingProvider?.bookingPolicies) {
          currentPolicies = typeof existingProvider.bookingPolicies === "string"
            ? (() => { try { return JSON.parse(existingProvider.bookingPolicies as string); } catch { return {}; } })()
            : (existingProvider.bookingPolicies as Record<string, any>) || {};
        }
        const incomingPolicies = body.bookingPolicies !== undefined
          ? (typeof body.bookingPolicies === "string" ? JSON.parse(body.bookingPolicies) : body.bookingPolicies)
          : {};
        const merged: Record<string, any> = { ...currentPolicies, ...incomingPolicies };
        if (body.instantBooking !== undefined) merged.instantBooking = body.instantBooking;
        if (body.advanceBookingDays !== undefined) merged.advanceBookingDays = body.advanceBookingDays;
        update.bookingPolicies = merged;
      }
      if (body.businessHours !== undefined) {
        update.businessHours =
          typeof body.businessHours === "string"
            ? JSON.parse(body.businessHours)
            : body.businessHours;
      }
      if (body.availability !== undefined) {
        // Store availability merged into bookingPolicies to keep schema simple
        const existing = await storage.getProvider(id);
        let existingPolicies: Record<string, any> = {};
        if (existing?.bookingPolicies) {
          existingPolicies = typeof existing.bookingPolicies === "string"
            ? JSON.parse(existing.bookingPolicies as string)
            : (existing.bookingPolicies as Record<string, any>) || {};
        }
        const availability =
          typeof body.availability === "string"
            ? JSON.parse(body.availability)
            : body.availability;
        update.bookingPolicies = { ...existingPolicies, availability };
      }

      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const provider = await storage.updateProvider(id, update);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      // Parse JSON fields back to objects for the response
      const parsed = { ...provider } as any;
      if (parsed.bookingPolicies && typeof parsed.bookingPolicies === "string") {
        try { parsed.bookingPolicies = JSON.parse(parsed.bookingPolicies); } catch {}
      }
      if (parsed.businessHours && typeof parsed.businessHours === "string") {
        try { parsed.businessHours = JSON.parse(parsed.businessHours); } catch {}
      }

      res.json({ provider: parsed });
    } catch (error: any) {
      console.error("Patch provider error:", error);
      res.status(500).json({ error: error.message || "Failed to update provider" });
    }
  });

  // Upload provider logo/avatar — accepts base64 data URL, saves to Supabase Storage
  app.post("/api/provider/:id/logo", requireAuth, async (req: Request<IdParams>, res: Response) => {
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
      const prefix = ALLOWED_MIME_PREFIXES_LOGO.find((p) => base64.startsWith(p));
      if (!prefix) {
        return res.status(400).json({ error: "Invalid image format. Use JPEG, PNG, or WebP." });
      }

      const ext = prefix.includes("jpeg") || prefix.includes("jpg") ? "jpg" : prefix.includes("png") ? "png" : "webp";
      const mimeType = ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : "image/webp";
      const base64Data = base64.slice(prefix.length);
      const buffer = Buffer.from(base64Data, "base64");
      const filename = `provider-${id}-logo-${Date.now()}.${ext}`;

      let logoUrl: string;

      const isDev = process.env.NODE_ENV === "development";
      let supabaseClient: typeof import("./lib/supabase").supabase | null = null;
      try {
        supabaseClient = (await import("./lib/supabase")).supabase;
      } catch {}

      if (supabaseClient) {
        const { error: uploadError } = await supabaseClient.storage
          .from("job-photos")
          .upload(`logos/${filename}`, buffer, { contentType: mimeType, upsert: true });
        if (uploadError) throw new Error("Failed to upload logo to storage");
        const { data: publicUrlData } = supabaseClient.storage
          .from("job-photos")
          .getPublicUrl(`logos/${filename}`);
        logoUrl = publicUrlData.publicUrl;
      } else if (isDev) {
        const uploadDir = path.resolve(process.cwd(), "uploads", "logos");
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        fs.writeFileSync(path.join(uploadDir, filename), buffer);
        const protocol = req.protocol;
        const host = req.get("host") || "";
        logoUrl = `${protocol}://${host}/uploads/logos/${filename}`;
      } else {
        return res.status(503).json({ error: "Storage not configured" });
      }

      const updated = await storage.updateProvider(id, { avatarUrl: logoUrl });
      res.json({ avatarUrl: logoUrl, provider: updated });
    } catch (error: any) {
      console.error("Provider logo upload error:", error);
      res.status(500).json({ error: error.message || "Failed to upload logo" });
    }
  });

  // Provider dashboard stats
  app.get("/api/provider/:id/stats", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      // Verify the authenticated user owns this provider record
      const providerRow = await storage.getProviderByUserId(req.authenticatedUserId!);
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
  });

  // Provider business insights — authenticated user must own this provider record
  app.get("/api/provider/:id/insights", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const providerRow = await storage.getProviderByUserId(req.authenticatedUserId!);
      if (!providerRow || providerRow.id !== req.params.id) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const insights = await storage.getProviderInsights(req.params.id);
      const businessName = providerRow.businessName || "your business";

      // Generate AI messages (cached per provider for 1 hour)
      let aiMessages: { revenue: string; growth: string; rating: string };
      const cached = insightsAiCache.get(req.params.id);
      if (cached && cached.expiresAt > Date.now()) {
        aiMessages = { revenue: cached.revenue, growth: cached.growth, rating: cached.rating };
      } else {
        try {
          const aiResp = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "You are a business coach for home service providers. Write short, specific, motivating insight captions (max 10 words each). Celebrate real numbers. No emojis. No bullet points. No numbering.",
              },
              {
                role: "user",
                content:
                  `Business: ${businessName}\n` +
                  `All-time revenue: $${Math.round(insights.allTimeRevenue).toLocaleString()}\n` +
                  `New clients this quarter: ${insights.clientCountThisQuarter} (${insights.clientGrowthPct > 0 ? "+" : ""}${insights.clientGrowthPct}% vs last quarter)\n` +
                  `Rating: ${insights.rating} stars from ${insights.reviewCount} reviews\n\n` +
                  `Write exactly 3 lines:\n` +
                  `Line 1: revenue caption celebrating $${Math.round(insights.allTimeRevenue / 1000)}K milestone\n` +
                  `Line 2: client growth caption for ${insights.clientGrowthPct > 0 ? "+" : ""}${insights.clientGrowthPct}% growth\n` +
                  `Line 3: rating caption for ${insights.rating} stars`,
              },
            ],
            max_tokens: 120,
            temperature: 0.75,
          });
          const lines = (aiResp.choices[0]?.message?.content || "")
            .split("\n")
            .map((l) => l.replace(/^[\d\.\-\*\s]+/, "").trim())
            .filter(Boolean);
          aiMessages = {
            revenue: lines[0] || `$${Math.round(insights.allTimeRevenue / 1000)}K earned all-time`,
            growth: lines[1] || `${insights.clientGrowthPct > 0 ? "+" : ""}${insights.clientGrowthPct}% client growth this quarter`,
            rating: lines[2] || `${insights.rating} stars from ${insights.reviewCount} reviews`,
          };
          insightsAiCache.set(req.params.id, { ...aiMessages, expiresAt: Date.now() + 60 * 60 * 1000 });
        } catch (aiErr) {
          console.error("Insights AI generation error:", aiErr);
          aiMessages = {
            revenue: `$${Math.round(insights.allTimeRevenue / 1000)}K earned all-time`,
            growth: `${insights.clientGrowthPct > 0 ? "+" : ""}${insights.clientGrowthPct}% client growth this quarter`,
            rating: `${insights.rating} stars from ${insights.reviewCount} reviews`,
          };
        }
      }

      // Fire milestone notifications fire-and-forget
      fireInsightNotifications(req.authenticatedUserId!, insights).catch(console.error);

      res.json({ insights: { ...insights, aiMessages } });
    } catch (error) {
      console.error("Get provider insights error:", error);
      res.status(500).json({ error: "Failed to get provider insights" });
    }
  });

  // Provider reviews
  app.get("/api/provider/:id/reviews", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const reviewRows = await db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          comment: reviews.comment,
          createdAt: reviews.createdAt,
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
  });

  // Submit a review for an appointment
  app.post("/api/appointments/:id/review", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      const appointmentId = req.params.id;
      const { rating, comment } = req.body;

      if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be a number between 1 and 5" });
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

      const reviewableStatuses = ["completed", "paid", "closed", "awaiting_payment"];
      if (!reviewableStatuses.includes(appointment.status || "")) {
        return res.status(400).json({ error: "Reviews can only be submitted for completed appointments" });
      }

      const [existingReview] = await db
        .select({ id: reviews.id })
        .from(reviews)
        .where(eq(reviews.appointmentId, appointmentId))
        .limit(1);

      if (existingReview) {
        return res.status(409).json({ error: "Review already submitted for this appointment" });
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
      const avgRating = totalReviews > 0
        ? providerReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

      await db
        .update(providers)
        .set({
          reviewCount: totalReviews,
          rating: avgRating.toFixed(1),
          averageRating: avgRating.toFixed(2),
        })
        .where(eq(providers.id, appointment.providerId));

      res.status(201).json({ review });
    } catch (error) {
      console.error("Submit review error:", error);
      res.status(500).json({ error: "Failed to submit review" });
    }
  });

  // ============ CLIENTS ROUTES ============

  app.get("/api/provider/:providerId/clients", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      if (!(await assertProviderOwnership(req, req.params.providerId, res))) return;
      const clients = await storage.getClients(req.params.providerId);
      res.json({ clients });
    } catch (error) {
      console.error("Get clients error:", error);
      res.status(500).json({ error: "Failed to get clients" });
    }
  });

  app.get("/api/clients/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      // Get client's jobs and invoices
      const jobs = await storage.getJobsByClient(req.params.id);
      const invoices = await storage.getInvoicesByClient(req.params.id);

      // Load linked home record (from homeId FK) and map to HomeDetailRecord shape
      let home = null;
      if (client.homeId) {
        const [homeRow] = await db.select().from(homes).where(eq(homes.id, client.homeId)).limit(1);
        if (homeRow) {
          home = {
            beds: homeRow.bedrooms ?? null,
            baths: homeRow.bathrooms ?? null,
            sqft: homeRow.squareFeet ?? null,
            yearBuilt: homeRow.yearBuilt ?? null,
            estimatedValue: homeRow.estimatedValue ? parseFloat(homeRow.estimatedValue) : null,
            propertyType: homeRow.propertyType ?? null,
            formattedAddress: homeRow.formattedAddress ?? null,
          };
        }
      }

      res.json({ client: { ...client, home }, jobs, invoices });
    } catch (error) {
      console.error("Get client error:", error);
      res.status(500).json({ error: "Failed to get client" });
    }
  });

  app.post("/api/clients", requireAuth, async (req: Request, res: Response) => {
    try {
      // Extract housefaxData before schema validation (it's not a client field)
      const { housefaxData, ...clientBody } = req.body;

      const parsed = insertClientSchema.safeParse(clientBody);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }
      
      // Check for existing client with same email for this provider
      if (parsed.data.email && parsed.data.providerId) {
        const existingClients = await storage.getClients(parsed.data.providerId);
        const duplicate = existingClients.find(c => c.email?.toLowerCase() === parsed.data.email?.toLowerCase());
        if (duplicate) {
          return res.status(409).json({ error: "A client with this email already exists" });
        }
      }

      // If HouseFax enrichment data was provided, create a homes record and link it
      let homeId: string | undefined;
      if (housefaxData && typeof housefaxData === "object" && req.authenticatedUserId) {
        try {
          const street = housefaxData.street || parsed.data.address || "Unknown";
          const city = housefaxData.city || parsed.data.city || "Unknown";
          const state = housefaxData.state || parsed.data.state || "Unknown";
          const zip = housefaxData.zipCode || parsed.data.zip || "00000";
          const clientName = `${parsed.data.firstName || ""} ${parsed.data.lastName || ""}`.trim();
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
            estimatedValue: housefaxData.estimatedValue ? String(housefaxData.estimatedValue) : undefined,
            zillowId: housefaxData.zillowId ?? undefined,
            zillowUrl: housefaxData.zillowUrl ?? undefined,
            taxAssessedValue: housefaxData.taxAssessedValue ? String(housefaxData.taxAssessedValue) : undefined,
            lastSoldDate: housefaxData.lastSoldDate ?? undefined,
            lastSoldPrice: housefaxData.lastSoldPrice ? String(housefaxData.lastSoldPrice) : undefined,
            latitude: housefaxData.latitude ? String(housefaxData.latitude) : undefined,
            longitude: housefaxData.longitude ? String(housefaxData.longitude) : undefined,
            placeId: housefaxData.placeId ?? undefined,
            formattedAddress: housefaxData.formattedAddress ?? undefined,
            neighborhoodName: housefaxData.neighborhoodName ?? undefined,
            countyName: housefaxData.countyName ?? undefined,
            housefaxEnrichedAt: new Date(),
          });
          homeId = newHome.id;
        } catch (homeErr) {
          console.error("Failed to create home record from HouseFax data:", homeErr);
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

  app.put("/api/clients/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const existing = await storage.getClient(req.params.id);
      if (!existing) return res.status(404).json({ error: "Client not found" });
      // Ownership: verify the requesting user owns the provider that this client belongs to
      if (!(await assertProviderOwnership(req, existing.providerId, res))) return;

      // Allowlist mutable fields to prevent mass-assignment
      const { firstName, lastName, email, phone, address, notes, tags } = req.body;
      const update: Record<string, unknown> = {};
      if (firstName !== undefined) update.firstName = firstName;
      if (lastName !== undefined) update.lastName = lastName;
      if (email !== undefined) update.email = email;
      if (phone !== undefined) update.phone = phone;
      if (address !== undefined) update.address = address;
      if (notes !== undefined) update.notes = notes;
      if (tags !== undefined) update.tags = tags;

      const client = await storage.updateClient(req.params.id, update);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json({ client });
    } catch (error) {
      console.error("Update client error:", error);
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const deleted = await storage.deleteClient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete client error:", error);
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // ============ JOBS ROUTES ============

  app.get("/api/provider/:providerId/jobs", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      if (!(await assertProviderOwnership(req, req.params.providerId, res))) return;
      const rawJobs = await storage.getJobs(req.params.providerId);
      // Enrich with isRecurring/recurringFrequency from linked appointment
      const enrichedJobs = await Promise.all(
        rawJobs.map(async (job) => {
          if (!job.appointmentId) return { ...job, isRecurring: false, recurringFrequency: null };
          const [appt] = await db.select({ isRecurring: appointments.isRecurring, recurringFrequency: appointments.recurringFrequency })
            .from(appointments)
            .where(eq(appointments.id, job.appointmentId))
            .limit(1)
            .catch(() => [null]);
          return {
            ...job,
            isRecurring: appt?.isRecurring ?? false,
            recurringFrequency: appt?.recurringFrequency ?? null,
          };
        })
      );
      res.json({ jobs: enrichedJobs });
    } catch (error) {
      console.error("Get jobs error:", error);
      res.status(500).json({ error: "Failed to get jobs" });
    }
  });

  app.get("/api/jobs/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      let isRecurring = false;
      let recurringFrequency: string | null = null;
      if (job.appointmentId) {
        const [appt] = await db.select({ isRecurring: appointments.isRecurring, recurringFrequency: appointments.recurringFrequency })
          .from(appointments)
          .where(eq(appointments.id, job.appointmentId))
          .limit(1)
          .catch(() => [null]);
        if (appt) {
          isRecurring = appt.isRecurring ?? false;
          recurringFrequency = appt.recurringFrequency ?? null;
        }
      }
      res.json({ job: { ...job, isRecurring, recurringFrequency } });
    } catch (error) {
      console.error("Get job error:", error);
      res.status(500).json({ error: "Failed to get job" });
    }
  });

  // Get job linked to an appointment (by appointmentId FK)
  app.get("/api/appointments/:id/job", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      const appointment = await storage.getAppointment(req.params.id);
      if (!appointment) return res.json({ job: null });
      const providerRecord = await storage.getProviderByUserId(authUserId);
      const isOwner = appointment.userId === authUserId;
      const isProvider = providerRecord && appointment.providerId === providerRecord.id;
      if (!isOwner && !isProvider) return res.status(403).json({ error: "Access denied" });
      const [job] = await db.select().from(jobs)
        .where(eq(jobs.appointmentId, req.params.id))
        .limit(1);
      if (!job) return res.json({ job: null });
      res.json({ job });
    } catch (error) {
      console.error("Get appointment job error:", error);
      res.status(500).json({ error: "Failed to get job" });
    }
  });

  // Generate or return cached AI checklist for a job
  app.post("/api/jobs/:id/generate-checklist", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      const job = await storage.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });

      // Authorization: requester must own the provider account that owns this job
      const providerRecord = await storage.getProviderByUserId(authUserId);
      if (!providerRecord || job.providerId !== providerRecord.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Return cached checklist if it exists
      const existingChecklist = job.checklist as { id: string; label: string; completed: boolean }[] | null;
      if (existingChecklist && Array.isArray(existingChecklist) && existingChecklist.length > 0) {
        return res.json({ checklist: existingChecklist });
      }

      // Generate checklist with OpenAI
      const prompt = [
        `You are a home services task manager. Generate a practical 6-8 step checklist for a service provider performing this job.`,
        `Job type: ${job.title}`,
        job.description ? `Client's issue: ${job.description}` : "",
        `Return ONLY a valid JSON array of strings with no markdown, no extra keys, and no explanation. Each string is a clear, actionable step.`,
        `Example: ["Arrive and introduce yourself", "Assess the issue", "Complete the repair", ...]`,
      ].filter(Boolean).join("\n");

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 400,
      });

      const raw = aiResponse.choices[0]?.message?.content?.trim() || "[]";
      let labels: string[] = [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) labels = parsed.filter((s: unknown) => typeof s === "string");
      } catch {
        // Fallback if GPT returns non-JSON
        labels = raw.split("\n").map(l => l.replace(/^[-\d.]+\s*/, "").trim()).filter(Boolean).slice(0, 8);
      }

      if (labels.length === 0) {
        labels = ["Arrive at location", "Assess the issue", "Discuss scope with client", "Complete main work", "Clean up area", "Walkthrough with client"];
      }

      const checklist = labels.map((label, i) => ({ id: String(i + 1), label, completed: false }));

      // Persist to DB
      await db.update(jobs).set({ checklist }).where(eq(jobs.id, req.params.id));

      res.json({ checklist });
    } catch (error) {
      console.error("Generate checklist error:", error);
      res.status(500).json({ error: "Failed to generate checklist" });
    }
  });

  // Persist checklist toggle state
  app.patch("/api/jobs/:id/checklist-state", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      const job = await storage.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });

      // Authorization: requester must own the provider account that owns this job
      const providerRecord = await storage.getProviderByUserId(authUserId);
      if (!providerRecord || job.providerId !== providerRecord.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { checklist } = req.body as { checklist: { id: string; label: string; completed: boolean }[] };
      if (!Array.isArray(checklist)) return res.status(400).json({ error: "checklist must be an array" });

      await db.update(jobs).set({ checklist }).where(eq(jobs.id, req.params.id));
      res.json({ ok: true });
    } catch (error) {
      console.error("Checklist state error:", error);
      res.status(500).json({ error: "Failed to save checklist state" });
    }
  });

  // Get invoice linked to a job
  app.get("/api/jobs/:id/invoice", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      const providerRecord = await storage.getProviderByUserId(authUserId);
      const [invoice] = await db.select().from(invoices)
        .where(eq(invoices.jobId, req.params.id))
        .limit(1);
      if (!invoice) return res.json({ invoice: null });
      const isHomeowner = invoice.homeownerUserId === authUserId;
      const isProvider = providerRecord && invoice.providerId === providerRecord.id;
      if (!isHomeowner && !isProvider) return res.status(403).json({ error: "Access denied" });
      res.json({ invoice });
    } catch (error) {
      console.error("Get job invoice error:", error);
      res.status(500).json({ error: "Failed to get invoice" });
    }
  });

  async function dispatchJobStatusEmail(job: Job, newStatus: string): Promise<void> {
    if (!job.clientId || !job.providerId) return;
    const [client] = await db.select().from(clients).where(eq(clients.id, job.clientId)).catch(() => [null]);
    const [provider] = await db.select().from(providers).where(eq(providers.id, job.providerId)).catch(() => [null]);
    if (!client || !provider || !client.email) return;
    await dispatch('job.status_changed', {
      clientEmail: client.email,
      clientName: `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.email,
      providerName: provider.businessName,
      serviceName: job.title ?? 'your job',
      newStatus,
      scheduledDate: job.scheduledDate ? String(job.scheduledDate) : undefined,
      notes: job.notes ?? undefined,
      relatedRecordType: 'job',
      relatedRecordId: job.id,
      recipientUserId: client.homeownerUserId ?? undefined,
    });
  }

  app.post("/api/jobs", requireAuth, async (req: Request, res: Response) => {
    try {
      // Convert scheduledDate string to Date
      const jobData = {
        ...req.body,
        scheduledDate: req.body.scheduledDate ? new Date(req.body.scheduledDate) : undefined,
      };
      const parsed = insertJobSchema.safeParse(jobData);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }

      // Atomic transaction: create job and appointment together so booking data model is
      // always consistent. If appointment creation fails the job is rolled back too.
      const { job: newJob, appointment } = await db.transaction(async (tx) => {
        const [job] = await tx.insert(jobs).values(parsed.data).returning();

        // Create a linked appointment row for every provider-added job so all booking
        // paths produce the same normalized structure (appointments → jobs → clients → invoices).
        // userId and homeId are optional because this is a provider-initiated entry.
        const [apptRow] = await tx.insert(appointments).values({
          providerId: job.providerId,
          serviceName: job.title,
          description: job.description || undefined,
          scheduledDate: job.scheduledDate!,
          scheduledTime: job.scheduledTime || undefined,
          estimatedPrice: job.estimatedPrice || undefined,
          status: "confirmed" as const,
          notes: job.notes || undefined,
        }).returning();

        // Back-link appointment ID on the job row
        const [linkedJob] = await tx.update(jobs)
          .set({ appointmentId: apptRow.id })
          .where(eq(jobs.id, job.id))
          .returning();

        return { job: linkedJob, appointment: apptRow };
      });

      // Fire client confirmation email (fire-and-forget) if client has an email on record
      if (newJob.clientId) {
        (async () => {
          try {
            const [jobClient] = await db.select().from(clients).where(eq(clients.id, newJob.clientId!)).catch(() => [null]);
            const [jobProvider] = await db.select().from(providers).where(eq(providers.id, newJob.providerId)).catch(() => [null]);
            if (jobClient?.email && jobProvider) {
              const clientName = `${jobClient.firstName || ''} ${jobClient.lastName || ''}`.trim() || jobClient.email;
              const scheduledDateStr = newJob.scheduledDate
                ? new Date(newJob.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                : 'To be confirmed';
              const scheduledTimeStr = newJob.scheduledTime
                ? (() => {
                    const [h, m] = newJob.scheduledTime.split(':');
                    const hour = parseInt(h);
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const displayHour = hour % 12 || 12;
                    return `${displayHour}:${m} ${ampm}`;
                  })()
                : undefined;
              await sendProviderScheduledJobEmail({
                clientEmail: jobClient.email,
                clientName,
                providerName: jobProvider.businessName,
                providerPhone: jobProvider.phone || undefined,
                serviceName: newJob.title,
                scheduledDate: scheduledDateStr,
                scheduledTime: scheduledTimeStr,
                address: newJob.address || jobClient.address || undefined,
                estimatedPrice: newJob.estimatedPrice || undefined,
                description: newJob.description || undefined,
              });
            }
          } catch (emailErr) {
            console.error('Provider job client email error (non-fatal):', emailErr);
          }
        })();
      }

      return res.status(201).json({ job: newJob, appointment });
    } catch (error) {
      console.error("Create job error:", error);
      res.status(500).json({ error: "Failed to create job" });
    }
  });

  app.put("/api/jobs/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const existing = await storage.getJob(req.params.id);
      if (!existing) return res.status(404).json({ error: "Job not found" });
      // Ownership: verify the requesting user owns the provider that issued this job
      if (!(await assertProviderOwnership(req, existing.providerId, res))) return;

      // Allowlist mutable fields to prevent mass-assignment
      const { title, description, status, scheduledDate, scheduledTime,
        estimatedPrice, finalPrice, notes, address } = req.body;
      const update: Record<string, unknown> = {};
      if (title !== undefined) update.title = title;
      if (description !== undefined) update.description = description;
      if (status !== undefined) update.status = status;
      if (scheduledDate !== undefined) update.scheduledDate = scheduledDate;
      if (scheduledTime !== undefined) update.scheduledTime = scheduledTime;
      if (estimatedPrice !== undefined) update.estimatedPrice = estimatedPrice;
      if (finalPrice !== undefined) update.finalPrice = finalPrice;
      if (notes !== undefined) update.notes = notes;
      if (address !== undefined) update.address = address;

      const job = await storage.updateJob(req.params.id, update);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      // Dispatch job.status_changed when status field changes
      if (status && existing.status !== status) {
        dispatchJobStatusEmail(job, status).catch((e: unknown) => console.error('job.status_changed dispatch error:', e));
      }
      res.json({ job });
    } catch (error) {
      console.error("Update job error:", error);
      res.status(500).json({ error: "Failed to update job" });
    }
  });

  app.post("/api/jobs/:id/complete", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const { finalPrice } = req.body;
      const job = await storage.completeJob(req.params.id, finalPrice);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      // Fire job status change email (fire-and-forget)
      dispatchJobStatusEmail(job, 'completed').catch((e: unknown) => console.error('job.status_changed dispatch error:', e));
      // Fire rebooking nudge push + email to homeowner (fire-and-forget)
      (async () => {
        try {
          if (!job.clientId || !job.providerId) return;
          const [client] = await db.select().from(clients).where(eq(clients.id, job.clientId)).catch(() => [null]);
          const [provider] = await db.select().from(providers).where(eq(providers.id, job.providerId)).catch(() => [null]);
          if (!client?.email || !provider) return;
          const homeownerUserId = client.homeownerUserId ?? undefined;
          const encodedName = encodeURIComponent(provider.businessName);
          const rebookLink = `homebase://SimpleBooking?providerId=${provider.id}&providerName=${encodedName}`;
          // In-app push notification so homeowner sees it immediately
          if (homeownerUserId) {
            await dispatchNotification(
              homeownerUserId,
              'Time to rebook?',
              `Your ${job.title ?? 'service'} with ${provider.businessName} is done. Ready to schedule again?`,
              'rebook.prompt',
              { providerId: provider.id, providerName: provider.businessName, screen: 'SimpleBooking' },
              'bookings',
            ).catch((e: unknown) => console.error('rebook push error:', e));
          }
          await dispatch('rebook.prompt', {
            clientEmail: client.email,
            clientName: `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.email,
            providerName: provider.businessName,
            serviceName: job.title ?? 'your service',
            rebookLink,
            recipientUserId: homeownerUserId,
            relatedRecordType: 'job',
            relatedRecordId: job.id,
          });
        } catch (e) {
          console.error('rebook.prompt dispatch error:', e);
        }
      })();
      // HouseFax auto-log pipeline (fire-and-forget)
      autoLogHouseFaxEntry(job).catch((e: unknown) => console.error('housefax auto-log error:', e));
      res.json({ job });
    } catch (error) {
      console.error("Complete job error:", error);
      res.status(500).json({ error: "Failed to complete job" });
    }
  });

  app.post("/api/jobs/:id/start", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const job = await storage.updateJob(req.params.id, { status: "in_progress" });
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      // Fire job status change email (fire-and-forget)
      dispatchJobStatusEmail(job, 'in_progress').catch((e: unknown) => console.error('job.status_changed dispatch error:', e));
      res.json({ job });
    } catch (error) {
      console.error("Start job error:", error);
      res.status(500).json({ error: "Failed to start job" });
    }
  });

  app.delete("/api/jobs/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const deleted = await storage.deleteJob(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete job error:", error);
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  // ============ INVOICES ROUTES ============

  app.get("/api/provider/:providerId/invoices", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      if (!(await assertProviderOwnership(req, req.params.providerId, res))) return;
      const invoices = await storage.getInvoices(req.params.providerId);
      res.json({ invoices });
    } catch (error) {
      console.error("Get invoices error:", error);
      res.status(500).json({ error: "Failed to get invoices" });
    }
  });

  app.get("/api/invoices/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const providerRecord = await storage.getProviderByUserId(authUserId);
      const isProvider = providerRecord && invoice.providerId === providerRecord.id;
      const isHomeowner = invoice.homeownerUserId === authUserId;
      if (!isProvider && !isHomeowner) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json({ invoice });
    } catch (error) {
      console.error("Get invoice error:", error);
      res.status(500).json({ error: "Failed to get invoice" });
    }
  });

  app.get("/api/provider/:providerId/next-invoice-number", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      if (!(await assertProviderOwnership(req, req.params.providerId, res))) return;
      const invoiceNumber = await storage.getNextInvoiceNumber(req.params.providerId);
      res.json({ invoiceNumber });
    } catch (error) {
      console.error("Get next invoice number error:", error);
      res.status(500).json({ error: "Failed to get invoice number" });
    }
  });

  app.post("/api/invoices", requireAuth, async (req: Request, res: Response) => {
    try {
      const invoiceNumber = req.body.invoiceNumber || `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Ownership: caller must own the provider they are creating an invoice for
      if (req.body.providerId && !(await assertProviderOwnership(req, req.body.providerId, res))) return;

      // Calculate total from line items if provided
      const lineItemsInput: any[] = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];
      let total = parseFloat(req.body.amount || "0");
      if (lineItemsInput.length > 0) {
        total = lineItemsInput.reduce((sum: number, item: any) => {
          return sum + (parseFloat(item.unitPrice) || 0) * (parseFloat(item.quantity) || 1);
        }, 0);
      }
      const lineItemsJson = lineItemsInput.length > 0
        ? JSON.stringify(lineItemsInput)
        : (req.body.amount ? JSON.stringify([{ description: req.body.notes || "Service", quantity: 1, unitPrice: parseFloat(req.body.amount), total: parseFloat(req.body.amount) }]) : undefined);

      const subtotalCents = Math.round(total * 100);
      const invoiceData = {
        providerId: req.body.providerId,
        clientId: req.body.clientId,
        jobId: req.body.jobId || null,
        invoiceNumber,
        currency: "usd",
        subtotalCents,
        taxCents: 0,
        discountCents: 0,
        platformFeeCents: 0,
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
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }
      const invoice = await storage.createInvoice(parsed.data);
      // Dispatch invoice.created for provider bookkeeping (fire-and-forget, draft invoices)
      if (invoice.clientId) {
        const [draftClient] = await db.select().from(clients).where(eq(clients.id, invoice.clientId)).catch(() => [null]);
        const [draftProvider] = await db.select().from(providers).where(eq(providers.id, invoice.providerId)).catch(() => [null]);
        if (draftClient?.email && draftProvider) {
          dispatch('invoice.created', {
            clientEmail: draftClient.email,
            clientName: [draftClient.firstName, draftClient.lastName].filter(Boolean).join(' ') || 'Client',
            providerName: draftProvider.businessName,
            invoiceNumber: invoice.invoiceNumber,
            amount: parseFloat(invoice.total?.toString() || '0'),
            dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Due on receipt',
            relatedRecordType: 'invoice',
            relatedRecordId: invoice.id,
            recipientUserId: draftClient.homeownerUserId ?? undefined,
          }).catch((e: unknown) => console.error('invoice.created dispatch error:', e));
        }
      }
      res.status(201).json({ invoice });
    } catch (error) {
      console.error("Create invoice error:", error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  // Create and immediately send invoice (one-step flow)
  app.post("/api/invoices/create-and-send", requireAuth, async (req: Request, res: Response) => {
    try {
      const { providerId: bodyProviderId } = req.body;
      if (!bodyProviderId) return res.status(400).json({ error: "providerId is required" });
      if (!(await assertProviderOwnership(req, bodyProviderId, res))) return;
      const authProviderRecord = await storage.getProvider(bodyProviderId);

      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Accept line items from frontend or fall back to single amount
      const lineItemsInput: any[] = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];
      let amount: number;
      let lineItems: any[];

      if (lineItemsInput.length > 0) {
        lineItems = lineItemsInput.map((item: any) => ({
          description: item.description || "Service",
          quantity: parseFloat(item.quantity) || 1,
          unitPrice: parseFloat(item.unitPrice) || 0,
          total: (parseFloat(item.quantity) || 1) * (parseFloat(item.unitPrice) || 0),
        }));
        amount = lineItems.reduce((sum: number, item: any) => sum + item.total, 0);
      } else {
        amount = parseFloat(req.body.amount) || 0;
        lineItems = [{
          description: req.body.notes || "Service",
          quantity: 1,
          unitPrice: amount,
          total: amount,
        }];
      }

      const subtotalCents = Math.round(amount * 100);
      const invoiceData = {
        providerId: bodyProviderId,
        clientId: req.body.clientId,
        jobId: req.body.jobId || null,
        invoiceNumber,
        currency: "usd",
        subtotalCents,
        taxCents: 0,
        discountCents: 0,
        platformFeeCents: 0,
        totalCents: subtotalCents,
        amount: amount.toFixed(2),
        total: amount.toFixed(2),
        lineItems: JSON.stringify(lineItems),
        notes: req.body.notes || null,
        status: "sent",
        dueDate: req.body.dueDate
          ? new Date(req.body.dueDate)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      const parsed = insertInvoiceSchema.safeParse(invoiceData);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }

      const invoice = await storage.createInvoice(parsed.data);

      // Send proper Stripe Invoice — Stripe emails the client at invoice.stripe.com
      let hostedUrl: string | undefined;
      let stripeError: string | undefined;
      const platformResult = await sendPlatformStripeInvoice(invoice.id).catch((err: any) => {
        stripeError = err?.message || "Stripe invoice send failed";
        console.error("[stripe-invoice-send] create-and-send:", stripeError);
        return null;
      });
      if (platformResult?.hostedInvoiceUrl) hostedUrl = platformResult.hostedInvoiceUrl;

      // Send email via dispatcher
      let emailSent = false;
      let emailError: string | undefined;

      if (invoice.clientId) {
        const client = await storage.getClient(invoice.clientId);
        const provider = await storage.getProvider(invoice.providerId);

        if (client?.email && provider) {
          const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ") || "Client";

          const sendResult = await dispatchWithResult('invoice.sent', {
            clientEmail: client.email,
            clientName,
            providerName: provider.businessName || provider.userId || "Service Provider",
            invoiceNumber: invoice.invoiceNumber || invoiceNumber,
            amount,
            dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "Due on receipt",
            lineItems: lineItems.map((item: any) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            })),
            paymentLink: hostedUrl,
            relatedRecordType: 'invoice',
            relatedRecordId: invoice.id,
          });
          emailSent = sendResult.emailSent;
          emailError = sendResult.emailError;

          // Push notification — non-fatal, only fires if client has a HomeBase account
          if (client?.email) {
            const [clientUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, client.email)).limit(1).catch(() => [null]);
            if (clientUser) {
              sendPush(clientUser.id, `Invoice from ${provider.businessName || "Your Provider"}`, `Invoice ${invoice.invoiceNumber} for $${amount.toFixed(2)} is ready. Tap to view.`, { type: "invoice", invoiceId: invoice.id }, "invoices").catch(() => {});
            }
          }
        } else if (!client?.email) {
          emailError = "Client has no email address on file.";
        }
      }

      const invoiceWithStripe = hostedUrl ? { ...invoice, hostedInvoiceUrl: hostedUrl } : invoice;
      res.status(201).json({ invoice: invoiceWithStripe, emailSent, emailError, stripeError });
    } catch (error) {
      console.error("Create and send invoice error:", error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  app.put("/api/invoices/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const existing = await storage.getInvoice(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      // Ownership: only the issuing provider may update the invoice
      if (!(await assertProviderOwnership(req, existing.providerId, res))) return;

      // Validate update payload — only allow known mutable fields
      const allowedFields = ["status", "notes", "dueDate", "lineItems", "amount", "total",
        "subtotalCents", "taxCents", "discountCents", "totalCents", "paymentMethodsAllowed"] as const;
      const update: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) update[field] = req.body[field];
      }
      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: "No valid fields provided for update" });
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
  });

  app.post("/api/invoices/:id/send", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const invoiceId = req.params.id;
      const authUserId = req.authenticatedUserId!;
      
      // Get the invoice first
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Verify the authenticated user owns this invoice's provider account
      const authProviderRecord = await storage.getProviderByUserId(authUserId);
      if (!authProviderRecord || invoice.providerId !== authProviderRecord.id) {
        return res.status(403).json({ error: "Access denied: you can only send invoices for your own provider account" });
      }
      
      // Send a proper Stripe Invoice — Stripe emails the client at invoice.stripe.com
      // Primary: platform account (no Connect required). Fallback: existing Connect flow.
      let hostedUrl: string | undefined;
      let stripeError: string | undefined;

      if (!invoice.stripeInvoiceId) {
        // No existing Stripe invoice — create and send one now
        const platformResult = await sendPlatformStripeInvoice(invoiceId).catch((err: any) => {
          stripeError = err?.message || "Stripe invoice send failed";
          console.error("[stripe-invoice-send] platform:", stripeError);
          return null;
        });
        if (platformResult?.hostedInvoiceUrl) hostedUrl = platformResult.hostedInvoiceUrl;
      } else {
        // Stripe invoice already exists — just resend it
        hostedUrl = invoice.hostedInvoiceUrl || undefined;
        await getStripe().invoices.sendInvoice(invoice.stripeInvoiceId).catch((err: any) => {
          stripeError = err?.message;
          console.warn("[stripe-invoice-resend]", stripeError);
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
          const lineItems = Array.isArray(rawLineItems) ? rawLineItems : (typeof rawLineItems === 'string' ? JSON.parse(rawLineItems) : []);
          const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ") || "Client";
          
          const sendResult = await dispatchWithResult('invoice.sent', {
            clientEmail: client.email,
            clientName,
            providerName: provider.businessName || provider.userId || "Service Provider",
            invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`,
            amount: parseFloat(invoice.total?.toString() || "0"),
            dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "Due on receipt",
            lineItems: lineItems.map((item: any) => ({
              description: item.description || item.name || "Service",
              quantity: item.quantity || 1,
              unitPrice: parseFloat(item.unitPrice?.toString() || item.price?.toString() || "0"),
              total: parseFloat(item.total?.toString() || "0"),
            })),
            paymentLink: hostedUrl,
            relatedRecordType: 'invoice',
            relatedRecordId: invoice.id,
          });
          emailSent = sendResult.emailSent;
          emailError = sendResult.emailError;

          // Push notification — non-fatal
          if (client?.email) {
            const [clientUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, client.email)).limit(1).catch(() => [null]);
            if (clientUser) {
              const invoiceTotal = parseFloat(invoice.total?.toString() || "0");
              sendPush(clientUser.id, `Invoice from ${provider.businessName || "Your Provider"}`, `Invoice ${invoice.invoiceNumber || invoiceId.slice(0, 8)} for $${invoiceTotal.toFixed(2)} is ready. Tap to view.`, { type: "invoice", invoiceId }, "invoices").catch(() => {});
            }
          }
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
  });

  app.post("/api/invoices/:id/mark-paid", requireAuth, async (req: Request<IdParams>, res: Response) => {
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

      // Dispatch paid notification (fire-and-forget)
      if (invoice && invoice.clientId) {
        try {
          const [paidClient, paidProvider] = await Promise.all([
            storage.getClient(invoice.clientId),
            storage.getProvider(invoice.providerId),
          ]);
          if (paidClient?.email && paidProvider) {
            const clientName = [paidClient.firstName, paidClient.lastName].filter(Boolean).join(" ") || "Client";
            dispatch('invoice.paid', {
              clientEmail: paidClient.email,
              clientName,
              providerName: paidProvider.businessName || "Service Provider",
              invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`,
              amount: parseFloat(invoice.total?.toString() || "0"),
              paymentDate: new Date().toLocaleDateString(),
              relatedRecordType: 'invoice',
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
  });

  app.post("/api/invoices/:id/cancel", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const invoice = await storage.cancelInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json({ invoice });
    } catch (error) {
      console.error("Cancel invoice error:", error);
      res.status(500).json({ error: "Failed to cancel invoice" });
    }
  });

  // Send a payment reminder email for an existing invoice
  app.post("/api/invoices/:id/remind", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const invoiceId = req.params.id;
      const authUserId = req.authenticatedUserId!;

      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });

      const authProvider = await storage.getProviderByUserId(authUserId);
      if (!authProvider || invoice.providerId !== authProvider.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!invoice.clientId) {
        return res.status(400).json({ error: "No client associated with this invoice" });
      }

      const client = await storage.getClient(invoice.clientId);
      if (!client?.email) {
        return res.status(400).json({ error: "No email address on file for this client" });
      }

      const provider = await storage.getProvider(invoice.providerId);
      const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ") || "Client";
      const providerName = provider?.businessName || "Your Service Provider";

      const now = new Date();
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
      const diffMs = dueDate ? dueDate.getTime() - now.getTime() : 0;
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Use existing Stripe invoice URL for reminder, or generate one now
      let reminderPaymentLink: string | undefined = invoice.hostedInvoiceUrl || undefined;
      if (!reminderPaymentLink) {
        const platformResult = await sendPlatformStripeInvoice(invoiceId).catch(() => null);
        if (platformResult?.hostedInvoiceUrl) reminderPaymentLink = platformResult.hostedInvoiceUrl;
      }

      await sendInvoiceReminderEmail({
        clientEmail: client.email,
        clientName,
        providerName,
        invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`,
        amount: parseFloat(invoice.total?.toString() || "0"),
        dueDate: dueDate ? dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Due on receipt",
        daysUntilDue: diffDays > 0 ? diffDays : undefined,
        daysOverdue: diffDays < 0 ? Math.abs(diffDays) : undefined,
        paymentLink: reminderPaymentLink,
      });

      res.json({ sent: true });
    } catch (error) {
      console.error("Invoice remind error:", error);
      res.status(500).json({ error: "Failed to send reminder" });
    }
  });

  app.post("/api/invoices/:id/payment-link", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const invoiceId = req.params.id;
      const authUserId = req.authenticatedUserId!;

      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });

      const authProvider = await storage.getProviderByUserId(authUserId);
      if (!authProvider || invoice.providerId !== authProvider.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      let checkoutUrl: string | undefined;
      let method: "stripe_invoice" | "checkout_session" | "existing" = "checkout_session";

      // Return existing URL if already generated
      if (invoice.hostedInvoiceUrl) {
        checkoutUrl = invoice.hostedInvoiceUrl;
        method = "existing";
      } else {
        // Send a proper Stripe Invoice (platform account — no Connect required)
        const result = await sendPlatformStripeInvoice(invoiceId);
        checkoutUrl = result.hostedInvoiceUrl;
        method = "stripe_invoice";
      }

      res.json({ url: checkoutUrl, method });
    } catch (error: any) {
      console.error("Generate payment link error:", error);
      res.status(500).json({ error: error.message || "Failed to generate payment link" });
    }
  });

  // ============ PAYMENTS ROUTES ============

  app.get("/api/provider/:providerId/payments", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      if (!(await assertProviderOwnership(req, req.params.providerId, res))) return;
      const payments = await storage.getPayments(req.params.providerId);
      res.json({ payments });
    } catch (error) {
      console.error("Get payments error:", error);
      res.status(500).json({ error: "Failed to get payments" });
    }
  });

  app.post("/api/payments", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = insertPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }
      const payment = await storage.createPayment(parsed.data);
      res.status(201).json({ payment });
    } catch (error) {
      console.error("Create payment error:", error);
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

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
        sql`SELECT * FROM stripe.products WHERE active = true`
      );
      res.json({ products: result.rows });
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({ error: "Failed to get products" });
    }
  });

  app.get("/api/stripe/products-with-prices", async (req: Request, res: Response) => {
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
        `
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
            prices: []
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
  });

  app.post("/api/stripe/create-payment-intent", requireAuth, async (req: Request, res: Response) => {
    try {
      const { amount, currency = 'usd', customerId } = req.body;
      if (!amount) {
        return res.status(400).json({ error: "Amount is required" });
      }
      const paymentIntent = await stripeService.createPaymentIntent(amount, currency, customerId);
      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id 
      });
    } catch (error) {
      console.error("Create payment intent error:", error);
      res.status(500).json({ error: "Failed to create payment intent" });
    }
  });

  app.post("/api/stripe/create-customer", requireAuth, async (req: Request, res: Response) => {
    try {
      const { email, userId } = req.body;
      if (!email || !userId) {
        return res.status(400).json({ error: "Email and userId are required" });
      }
      const customer = await stripeService.createCustomer(email, userId);
      res.json({ customerId: customer.id });
    } catch (error) {
      console.error("Create customer error:", error);
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.post("/api/stripe/create-checkout-session", requireAuth, async (req: Request, res: Response) => {
    try {
      const { customerId, priceId, successUrl, cancelUrl } = req.body;
      if (!customerId || !priceId) {
        return res.status(400).json({ error: "customerId and priceId are required" });
      }
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        successUrl || `${req.protocol}://${req.get('host')}/checkout/success`,
        cancelUrl || `${req.protocol}://${req.get('host')}/checkout/cancel`
      );
      res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      console.error("Create checkout session error:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/customer-portal", requireAuth, async (req: Request, res: Response) => {
    try {
      const { customerId, returnUrl } = req.body;
      if (!customerId) {
        return res.status(400).json({ error: "customerId is required" });
      }
      const session = await stripeService.createCustomerPortalSession(
        customerId,
        returnUrl || `${req.protocol}://${req.get('host')}/`
      );
      res.json({ url: session.url });
    } catch (error) {
      console.error("Create customer portal error:", error);
      res.status(500).json({ error: "Failed to create customer portal session" });
    }
  });

  // ============================================
  // STRIPE CONNECT RETURN PAGES (after Stripe redirects the browser back)
  const connectPageHtml = (title: string, message: string, isRefresh = false) => `<!DOCTYPE html>
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

  app.get("/provider/connect/complete", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(connectPageHtml(
      "Stripe Setup Complete",
      "Your payment account is connected. Return to the app to start accepting payments and receiving payouts."
    ));
  });

  app.get("/provider/connect/refresh", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(connectPageHtml(
      "Continue Stripe Setup",
      "Your onboarding link has expired. Return to the app and tap \"Continue Onboarding\" to generate a fresh link.",
      true
    ));
  });

  // STRIPE CONNECT ENDPOINTS
  // ============================================

  // Start Stripe Connect onboarding for provider (frontend uses this path)
  app.post("/api/stripe/connect/onboard/:providerId", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
    try {
      const { providerId } = req.params;
      if (!(await assertProviderOwnership(req, providerId, res))) return;
      const result = await createConnectAccountLink(providerId);
      res.json(result);
    } catch (error: any) {
      console.error("Create connect onboarding error:", error);
      res.status(500).json({ error: error.message || "Failed to start Stripe onboarding" });
    }
  });

  // Refresh Stripe Connect onboarding link
  app.post("/api/stripe/connect/refresh-link/:providerId", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
    try {
      const { providerId } = req.params;
      if (!(await assertProviderOwnership(req, providerId, res))) return;
      const result = await refreshConnectAccountLink(providerId);
      res.json(result);
    } catch (error: any) {
      console.error("Refresh connect link error:", error);
      res.status(500).json({ error: error.message || "Failed to refresh onboarding link" });
    }
  });

  // Get Stripe Connect status for provider
  app.get("/api/stripe/connect/status/:providerId", async (req: Request<{ providerId: string }>, res: Response) => {
    try {
      const { providerId } = req.params;
      const result = await getConnectStatus(providerId);
      res.json(result);
    } catch (error: any) {
      console.error("Get connect status error:", error);
      res.status(500).json({ error: error.message || "Failed to get connect status" });
    }
  });

  // Preview platform fee (GET endpoint for frontend)
  app.get("/api/stripe/fee-preview", async (req: Request, res: Response) => {
    try {
      const { providerId, amountCents } = req.query;
      if (!providerId || amountCents === undefined) {
        return res.status(400).json({ error: "providerId and amountCents are required" });
      }
      const preview = await calculateFeePreview(providerId as string, parseInt(amountCents as string, 10));
      res.json(preview);
    } catch (error: any) {
      console.error("Fee preview error:", error);
      res.status(500).json({ error: error.message || "Failed to calculate fee preview" });
    }
  });

  // Create invoice with line items (frontend path)
  app.post("/api/stripe/invoices", requireAuth, async (req: Request, res: Response) => {
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

      // Calculate subtotal from line items
      let subtotalCents = 0;
      const parsedLineItems = Array.isArray(lineItemsInput) ? lineItemsInput : [];
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
        plan.platformFeeFixedCents || 0
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
              parseFloat(item.quantity || "1") * parseInt(item.unitPriceCents || "0", 10)
            ),
          }))
        );
      }

      res.status(201).json({
        invoice,
        platformFee: fee,
      });
    } catch (error: any) {
      console.error("Create invoice error:", error);
      res.status(500).json({ error: error.message || "Failed to create invoice" });
    }
  });

  // Get invoices for provider
  app.get("/api/stripe/invoices", requireAuth, async (req: Request, res: Response) => {
    try {
      const { providerId } = req.query;
      if (!providerId) {
        return res.status(400).json({ error: "providerId is required" });
      }
      // Ownership: caller must own the provider whose invoices they are listing
      if (!(await assertProviderOwnership(req, providerId as string, res))) return;
      const providerInvoices = await db
        .select()
        .from(invoices)
        .where(eq(invoices.providerId, providerId as string))
        .orderBy(desc(invoices.createdAt));
      res.json({ invoices: providerInvoices });
    } catch (error: any) {
      console.error("Get invoices error:", error);
      res.status(500).json({ error: error.message || "Failed to get invoices" });
    }
  });

  // Send invoice — Stripe send + HomeBase notification email
  app.post("/api/stripe/invoices/:invoiceId/send", requireAuth, async (req: Request<{ invoiceId: string }>, res: Response) => {
    try {
      const { invoiceId } = req.params;
      const authUserId = req.authenticatedUserId!;

      // Load invoice
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });

      // Verify the authenticated user owns this invoice's provider account
      const authProviderRecord = await storage.getProviderByUserId(authUserId);
      if (!authProviderRecord || invoice.providerId !== authProviderRecord.id) {
        return res.status(403).json({ error: "Access denied: you can only send invoices for your own provider account" });
      }

      // Send a proper Stripe Invoice — Stripe emails the client at invoice.stripe.com
      let hostedUrl: string | undefined;
      let stripeError: string | undefined;

      if (!invoice.stripeInvoiceId) {
        const platformResult = await sendPlatformStripeInvoice(invoiceId).catch((err: any) => {
          stripeError = err?.message || "Stripe invoice send failed";
          console.error("[stripe-invoice-send] stripe/invoices/:id/send:", stripeError);
          return null;
        });
        if (platformResult?.hostedInvoiceUrl) hostedUrl = platformResult.hostedInvoiceUrl;
      } else {
        hostedUrl = invoice.hostedInvoiceUrl || undefined;
        await getStripe().invoices.sendInvoice(invoice.stripeInvoiceId).catch((err: any) => {
          stripeError = err?.message;
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
          const lineItems = Array.isArray(rawLineItems) ? rawLineItems : (typeof rawLineItems === 'string' ? JSON.parse(rawLineItems) : []);
          const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ") || "Client";
          const sendResult = await dispatchWithResult('invoice.sent', {
            clientEmail: client.email,
            clientName,
            providerName: provider.businessName || provider.userId || "Service Provider",
            invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`,
            amount: parseFloat(invoice.total?.toString() || "0"),
            dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "Due on receipt",
            lineItems: lineItems.map((item: any) => ({
              description: item.description || item.name || "Service",
              quantity: item.quantity || 1,
              unitPrice: parseFloat(item.unitPrice?.toString() || item.price?.toString() || "0"),
              total: parseFloat(item.total?.toString() || "0"),
            })),
            paymentLink: hostedUrl,
            relatedRecordType: 'invoice',
            relatedRecordId: invoice.id,
          });
          emailSent = sendResult.emailSent;
          emailError = sendResult.emailError;

          // Push notification — non-fatal
          const [clientUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, client.email)).limit(1).catch(() => [null]);
          if (clientUser) {
            const invoiceTotal = parseFloat(invoice.total?.toString() || "0");
            sendPush(clientUser.id, `Invoice from ${provider.businessName || "Your Provider"}`, `Invoice ${invoice.invoiceNumber || invoiceId.slice(0, 8)} for $${invoiceTotal.toFixed(2)} is ready. Tap to view.`, { type: "invoice", invoiceId }, "invoices").catch(() => {});
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

      res.json({ invoice: updated, paymentUrl: hostedUrl, emailSent, emailError, stripeError });
    } catch (error: any) {
      console.error("Send invoice error:", error);
      res.status(500).json({ error: error.message || "Failed to send invoice" });
    }
  });

  // Create Stripe Invoice for invoice payment (replaces checkout session)
  app.post("/api/stripe/invoices/:invoiceId/checkout", requireAuth, async (req: Request<{ invoiceId: string }>, res: Response) => {
    try {
      const { invoiceId } = req.params;
      if (!(await assertInvoiceAccess(req, invoiceId, res))) return;

      // Use existing Stripe invoice URL, or send one now via platform account
      const [inv] = await db.select({ stripeInvoiceId: invoices.stripeInvoiceId, hostedInvoiceUrl: invoices.hostedInvoiceUrl }).from(invoices).where(eq(invoices.id, invoiceId));
      if (!inv) return res.status(404).json({ error: "Invoice not found" });

      let url = inv.hostedInvoiceUrl;
      if (!url) {
        const result = await sendPlatformStripeInvoice(invoiceId);
        url = result.hostedInvoiceUrl;
      }

      res.json({ url, stripeInvoiceId: inv.stripeInvoiceId });
    } catch (error: any) {
      console.error("Create Stripe invoice error:", error);
      res.status(500).json({ error: error.message || "Failed to create checkout" });
    }
  });

  // Apply credits to invoice
  app.post("/api/stripe/invoices/:invoiceId/apply-credits", requireAuth, async (req: Request<{ invoiceId: string }>, res: Response) => {
    try {
      const { invoiceId } = req.params;
      if (!(await assertInvoiceAccess(req, invoiceId, res))) return;
      const { amountCents } = req.body;
      // Bind userId to the authenticated user — never trust body-supplied userId
      const userId = req.authenticatedUserId!;
      if (!amountCents || isNaN(Number(amountCents)) || Number(amountCents) <= 0) {
        return res.status(400).json({ error: "amountCents must be a positive number" });
      }
      const result = await applyCreditsToInvoice(invoiceId, userId, amountCents);
      res.json(result);
    } catch (error: any) {
      console.error("Apply credits error:", error);
      res.status(500).json({ error: error.message || "Failed to apply credits" });
    }
  });

  // Create Connect account and onboarding link for provider
  app.post("/api/connect/account-link", requireAuth, async (req: Request, res: Response) => {
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
      res.status(500).json({ error: error.message || "Failed to create connect account link" });
    }
  });

  // Refresh Connect account onboarding link
  app.post("/api/connect/refresh-link", requireAuth, async (req: Request, res: Response) => {
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
      res.status(500).json({ error: error.message || "Failed to refresh connect account link" });
    }
  });

  // Get Connect account status for provider
  app.get("/api/connect/status/:providerId", async (req: Request<{ providerId: string }>, res: Response) => {
    try {
      const { providerId } = req.params;
      const result = await getConnectStatus(providerId);
      res.json(result);
    } catch (error: any) {
      console.error("Get connect status error:", error);
      res.status(500).json({ error: error.message || "Failed to get connect status" });
    }
  });

  // Create or update provider plan
  app.post("/api/providers/:providerId/plan", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
    try {
      const { providerId } = req.params;
      if (!(await assertProviderOwnership(req, providerId, res))) return;
      const { planTier, platformFeePercent, platformFeeFixedCents } = req.body;

      const [existing] = await db
        .select()
        .from(providerPlans)
        .where(eq(providerPlans.providerId, providerId));

      if (existing) {
        const [updated] = await db
          .update(providerPlans)
          .set({
            planTier: planTier || existing.planTier,
            platformFeePercent: platformFeePercent || existing.platformFeePercent,
            platformFeeFixedCents: platformFeeFixedCents ?? existing.platformFeeFixedCents,
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
            platformFeePercent: platformFeePercent || "3.00",
            platformFeeFixedCents: platformFeeFixedCents || 0,
          })
          .returning();
        res.status(201).json({ plan: created });
      }
    } catch (error: any) {
      console.error("Update provider plan error:", error);
      res.status(500).json({ error: error.message || "Failed to update provider plan" });
    }
  });

  // Get provider plan
  app.get("/api/providers/:providerId/plan", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
    try {
      const { providerId } = req.params;
      if (!(await assertProviderOwnership(req, providerId, res))) return;
      const plan = await getProviderPlan(providerId);
      res.json({ plan });
    } catch (error: any) {
      console.error("Get provider plan error:", error);
      res.status(500).json({ error: error.message || "Failed to get provider plan" });
    }
  });

  // Preview platform fee for a given amount
  app.post("/api/connect/fee-preview", requireAuth, async (req: Request, res: Response) => {
    try {
      const { providerId, totalCents } = req.body;
      if (!providerId || totalCents === undefined) {
        return res.status(400).json({ error: "providerId and totalCents are required" });
      }
      const preview = await calculateFeePreview(providerId, totalCents);
      res.json(preview);
    } catch (error: any) {
      console.error("Fee preview error:", error);
      res.status(500).json({ error: error.message || "Failed to calculate fee preview" });
    }
  });

  // ============================================
  // ENHANCED INVOICE ENDPOINTS (with Stripe Connect)
  // ============================================

  // Create invoice with line items and platform fee calculation
  app.post("/api/invoices/create", requireAuth, async (req: Request, res: Response) => {
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

      // Calculate subtotal from line items
      let subtotalCents = 0;
      const parsedLineItems = Array.isArray(lineItemsInput) ? lineItemsInput : [];
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
        plan.platformFeeFixedCents || 0
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
              parseFloat(item.quantity || "1") * parseInt(item.unitPriceCents || "0", 10)
            ),
            metadata: item.metadata ? JSON.stringify(item.metadata) : null,
          }))
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
      res.status(500).json({ error: error.message || "Failed to create invoice" });
    }
  });

  // Create payment intent for invoice (for in-app payment sheet)
  app.post("/api/invoices/:invoiceId/payment-intent", requireAuth, async (req: Request<{ invoiceId: string }>, res: Response) => {
    try {
      const { invoiceId } = req.params;
      // Verify caller is associated with this invoice (homeowner or issuing provider)
      if (!(await assertInvoiceAccess(req, invoiceId, res))) return;
      // Never accept payerUserId from the request body — bind to the authenticated caller
      const authUserId = req.authenticatedUserId!;
      const result = await createInvoicePaymentIntent(invoiceId, authUserId);
      res.json(result);
    } catch (error: any) {
      console.error("Create payment intent error:", error);
      res.status(500).json({ error: error.message || "Failed to create payment intent" });
    }
  });

  // ── Homeowner card-on-file & PaymentSheet routes ─────────────────────────

  // Get or create Stripe customer for homeowner + return SetupIntent for saving a card
  app.post("/api/homeowner/setup-payment-sheet", requireAuth, async (req: Request, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;

      const [user] = await db.select().from(users).where(eq(users.id, authUserId));
      if (!user) return res.status(404).json({ error: "User not found" });

      const stripe = getStripe();
      let customerId = user.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
          metadata: { userId: user.id },
        });
        customerId = customer.id;
        await db.update(users).set({ stripeCustomerId: customerId, updatedAt: new Date() }).where(eq(users.id, authUserId));
      }

      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: "2023-10-16" }
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
      res.status(500).json({ error: error.message || "Failed to create setup sheet" });
    }
  });

  // Get homeowner's saved payment methods
  app.get("/api/homeowner/payment-methods", requireAuth, async (req: Request, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;

      const [user] = await db.select().from(users).where(eq(users.id, authUserId));
      if (!user?.stripeCustomerId) return res.json({ paymentMethods: [], defaultPaymentMethodId: null });

      const stripe = getStripe();
      const pms = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: "card" });

      const customer = await stripe.customers.retrieve(user.stripeCustomerId) as any;
      const defaultPmId = user.defaultPaymentMethodId ||
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
      res.status(500).json({ error: error.message || "Failed to list payment methods" });
    }
  });

  // Detach a saved payment method
  app.delete("/api/homeowner/payment-methods/:pmId", requireAuth, async (req: Request<{ pmId: string }>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;

      const { pmId } = req.params;
      const stripe = getStripe();
      await stripe.paymentMethods.detach(pmId);

      const [user] = await db.select().from(users).where(eq(users.id, authUserId));
      if (user?.defaultPaymentMethodId === pmId) {
        await db.update(users).set({ defaultPaymentMethodId: null, updatedAt: new Date() }).where(eq(users.id, authUserId));
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Detach payment method error:", error);
      res.status(500).json({ error: error.message || "Failed to remove payment method" });
    }
  });

  // Set default payment method for homeowner
  app.patch("/api/homeowner/default-payment-method", requireAuth, async (req: Request, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;

      const { paymentMethodId } = req.body;
      if (!paymentMethodId) return res.status(400).json({ error: "paymentMethodId required" });

      const [user] = await db.select().from(users).where(eq(users.id, authUserId));
      if (!user?.stripeCustomerId) return res.status(400).json({ error: "No Stripe customer found" });

      const stripe = getStripe();
      await stripe.customers.update(user.stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      await db.update(users).set({ defaultPaymentMethodId: paymentMethodId, updatedAt: new Date() }).where(eq(users.id, authUserId));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Set default PM error:", error);
      res.status(500).json({ error: error.message || "Failed to set default payment method" });
    }
  });

  // Create PaymentSheet params for paying an invoice in-app (with optional saved card)
  app.post("/api/homeowner/payment-sheet", requireAuth, async (req: Request, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;

      const { invoiceId } = req.body;
      if (!invoiceId) return res.status(400).json({ error: "invoiceId required" });

      // Verify caller is associated with this invoice (homeowner or issuing provider)
      if (!(await assertInvoiceAccess(req, invoiceId, res))) return;

      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      if (invoice.status === "paid") return res.status(400).json({ error: "Invoice already paid" });

      const connectAccount = await getConnectAccount(invoice.providerId);
      if (!connectAccount?.chargesEnabled) {
        return res.status(402).json({ error: "stripe_not_ready", message: "Provider payment processing is not yet enabled" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, authUserId));
      if (!user) return res.status(404).json({ error: "User not found" });

      const stripe = getStripe();
      let customerId = user.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
          metadata: { userId: user.id },
        });
        customerId = customer.id;
        await db.update(users).set({ stripeCustomerId: customerId, updatedAt: new Date() }).where(eq(users.id, authUserId));
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: invoice.totalCents,
        currency: invoice.currency || "usd",
        customer: customerId,
        application_fee_amount: invoice.platformFeeCents || 0,
        transfer_data: { destination: connectAccount.stripeAccountId },
        setup_future_usage: "off_session",
        metadata: { invoiceId: invoice.id, providerId: invoice.providerId, payerUserId: authUserId },
      });

      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: "2023-10-16" }
      );

      await db.update(invoices).set({ stripePaymentIntentId: paymentIntent.id, updatedAt: new Date() }).where(eq(invoices.id, invoiceId));

      res.json({
        paymentIntentClientSecret: paymentIntent.client_secret,
        ephemeralKeySecret: ephemeralKey.secret,
        customerId,
        amount: invoice.totalCents,
      });
    } catch (error: any) {
      console.error("Payment sheet error:", error);
      if (error.message?.includes("not enabled") || error.message?.includes("not set up")) {
        return res.status(402).json({ error: "stripe_not_ready", message: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to create payment sheet" });
    }
  });

  // Create Stripe Invoice for invoice (hosted payment page)
  app.post("/api/invoices/:invoiceId/checkout", requireAuth, async (req: Request<{ invoiceId: string }>, res: Response) => {
    try {
      const { invoiceId } = req.params;
      if (!(await assertInvoiceAccess(req, invoiceId, res))) return;
      const result = await createStripeInvoice(invoiceId);
      res.json({ url: result.hostedInvoiceUrl, stripeInvoiceId: result.stripeInvoiceId });
    } catch (error: any) {
      console.error("Create Stripe invoice error:", error);
      if (error.message?.includes("not enabled") || error.message?.includes("not set up")) {
        return res.status(402).json({ error: "stripe_not_ready", message: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to create Stripe invoice" });
    }
  });

  // Apply credits to invoice
  app.post("/api/invoices/:invoiceId/apply-credits", requireAuth, async (req: Request<{ invoiceId: string }>, res: Response) => {
    try {
      const { invoiceId } = req.params;
      if (!(await assertInvoiceAccess(req, invoiceId, res))) return;
      const { amountCents } = req.body;
      // Bind userId to the authenticated user — never trust body-supplied userId
      const userId = req.authenticatedUserId!;
      if (!amountCents || isNaN(Number(amountCents)) || Number(amountCents) <= 0) {
        return res.status(400).json({ error: "amountCents must be a positive number" });
      }
      const result = await applyCreditsToInvoice(invoiceId, userId, amountCents);
      res.json(result);
    } catch (error: any) {
      console.error("Apply credits error:", error);
      res.status(500).json({ error: error.message || "Failed to apply credits" });
    }
  });

  // Get user credits balance
  app.get("/api/users/:userId/credits", requireAuth, async (req: Request<{ userId: string }>, res: Response) => {
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
      res.status(500).json({ error: error.message || "Failed to get user credits" });
    }
  });

  // Add credits to user wallet (for RevenueCat integration)
  app.post("/api/users/:userId/credits/add", requireAuth, async (req: Request<{ userId: string }>, res: Response) => {
    try {
      const { userId } = req.params;
      if (userId !== req.authenticatedUserId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { amountCents, reason } = req.body;

      if (!amountCents || amountCents <= 0) {
        return res.status(400).json({ error: "amountCents must be a positive number" });
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
      res.status(500).json({ error: error.message || "Failed to add credits" });
    }
  });

  // NOTE: /api/webhooks/stripe-connect is registered in server/index.ts BEFORE
  // express.json() middleware so req.body is the raw Buffer needed for signature verification.

  // Get payouts for provider
  app.get("/api/providers/:providerId/payouts", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
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
      res.status(500).json({ error: error.message || "Failed to get payouts" });
    }
  });

  // Helper: verify calling user owns the given providerId
  async function assertProviderOwnership(req: Request, providerId: string, res: Response): Promise<boolean> {
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
  ): Promise<{ id: string; providerId: string; homeownerUserId: string | null } | null> {
    const authUserId = req.authenticatedUserId!;
    const [inv] = await db
      .select({ id: invoices.id, providerId: invoices.providerId, homeownerUserId: invoices.homeownerUserId })
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

  // GET /api/providers/:providerId/stripe-payouts — live Stripe payout list
  app.get("/api/providers/:providerId/stripe-payouts", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
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
        { stripeAccount: connectAccount.stripeAccountId }
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
          arrivalDate: p.arrival_date ? new Date(p.arrival_date * 1000).toISOString() : null,
          description: p.description,
          createdAt: new Date(p.created * 1000).toISOString(),
          bankLast4,
        };
      });
      res.json({ payouts: result });
    } catch (error: any) {
      console.error("Stripe payouts error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Stripe payouts" });
    }
  });

  // GET /api/providers/:providerId/stripe-payments — live Stripe charges list
  app.get("/api/providers/:providerId/stripe-payments", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
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
        { stripeAccount: connectAccount.stripeAccountId }
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
        .select({ id: clients.id, firstName: clients.firstName, lastName: clients.lastName })
        .from(clients)
        .where(eq(clients.providerId, providerId));

      // Only include charges that are linked to a HomeBase invoice/payment record
      const result = charges.data
        .filter((charge) =>
          localPayments.some(
            (p) => p.stripeChargeId === charge.id || p.stripePaymentIntentId === charge.payment_intent?.toString()
          )
        )
        .map((charge) => {
          const localPayment = localPayments.find(
            (p) => p.stripeChargeId === charge.id || p.stripePaymentIntentId === charge.payment_intent?.toString()
          );
          const invoice = localPayment ? localInvoices.find((inv) => inv.id === localPayment.invoiceId) : null;
          const client = invoice ? localClients.find((c) => c.id === invoice.clientId) : null;
          return {
            chargeId: charge.id,
            amountCents: charge.amount,
            currency: charge.currency,
            status: charge.status,
            invoiceId: invoice?.id ?? null,
            invoiceNumber: invoice?.invoiceNumber ?? null,
            clientName: client ? `${client.firstName} ${client.lastName}` : (charge.billing_details?.name ?? null),
            createdAt: new Date(charge.created * 1000).toISOString(),
            refunded: charge.refunded,
          };
        });
      res.json({ payments: result });
    } catch (error: any) {
      console.error("Stripe payments error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Stripe payments" });
    }
  });

  // GET /api/providers/:providerId/stripe-refunds — live Stripe refund list
  app.get("/api/providers/:providerId/stripe-refunds", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
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
        { stripeAccount: connectAccount.stripeAccountId }
      );
      const result = stripeRefunds.data.map((r) => {
        // charge is expanded — may be a full Charge object with original amount
        const expandedCharge = r.charge && typeof r.charge === "object" ? r.charge as import("stripe").Stripe.Charge : null;
        return {
          refundId: r.id,
          chargeId: expandedCharge?.id ?? (r.charge?.toString() ?? null),
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
      res.status(500).json({ error: error.message || "Failed to fetch Stripe refunds" });
    }
  });

  // ============================================
  // BOOKING LINKS & INTAKE SUBMISSIONS
  // ============================================

  // Get booking links for provider
  app.get("/api/providers/:providerId/booking-links", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
    try {
      const { providerId } = req.params;
      if (!(await assertProviderOwnership(req, providerId, res))) return;
      const links = await storage.getBookingLinksByProvider(providerId);
      res.json({ bookingLinks: links });
    } catch (error: any) {
      console.error("Get booking links error:", error);
      res.status(500).json({ error: error.message || "Failed to get booking links" });
    }
  });

  // Create booking link for provider
  app.post("/api/providers/:providerId/booking-links", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
    try {
      const { providerId } = req.params;
      if (!(await assertProviderOwnership(req, providerId, res))) return;
      const { slug, customTitle, customDescription, welcomeMessage, confirmationMessage, instantBooking, showPricing, depositRequired, depositAmount, depositPercentage, intakeQuestions, serviceCatalog, availabilityRules, brandColor, logoUrl } = req.body;

      if (!slug) {
        return res.status(400).json({ error: "slug is required" });
      }

      // Check if slug is already taken
      const existing = await storage.getBookingLinkBySlug(slug);
      if (existing) {
        return res.status(409).json({ error: "This booking link URL is already taken" });
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
        intakeQuestions: intakeQuestions ? JSON.stringify(intakeQuestions) : null,
        serviceCatalog: serviceCatalog ? JSON.stringify(serviceCatalog) : null,
        availabilityRules: availabilityRules ? JSON.stringify(availabilityRules) : null,
        brandColor,
        logoUrl,
      });

      res.status(201).json({ bookingLink: link });
    } catch (error: any) {
      console.error("Create booking link error:", error);
      res.status(500).json({ error: error.message || "Failed to create booking link" });
    }
  });

  // Backward-compatible aliases: old /api/book/ routes redirect to /api/providers/
  app.get("/api/book/:slug", (req: Request<{ slug: string }>, res: Response) => {
    res.redirect(301, `/api/providers/${req.params.slug}`);
  });
  app.post("/api/book/:slug/submit", (req: Request<{ slug: string }>, res: Response) => {
    res.redirect(308, `/api/providers/${req.params.slug}/submit`);
  });

  // Get public booking link by slug (no auth required)
  app.get("/api/providers/:slug", async (req: Request<{ slug: string }>, res: Response) => {
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

      res.json({ 
        bookingLink: {
          ...link,
          intakeQuestions: link.intakeQuestions ? JSON.parse(link.intakeQuestions) : [],
          serviceCatalog: link.serviceCatalog ? JSON.parse(link.serviceCatalog) : [],
          availabilityRules: link.availabilityRules ? JSON.parse(link.availabilityRules) : null,
        },
        provider: {
          id: provider.id,
          businessName: provider.businessName,
          avatarUrl: provider.avatarUrl,
          rating: provider.rating,
          reviewCount: provider.reviewCount,
          capabilityTags: provider.capabilityTags,
        }
      });
    } catch (error: any) {
      console.error("Get booking link error:", error);
      res.status(500).json({ error: error.message || "Failed to get booking page" });
    }
  });

  // Update booking link
  app.put("/api/booking-links/:id", requireAuth, async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      if (updates.intakeQuestions && typeof updates.intakeQuestions !== "string") {
        updates.intakeQuestions = JSON.stringify(updates.intakeQuestions);
      }
      if (updates.serviceCatalog && typeof updates.serviceCatalog !== "string") {
        updates.serviceCatalog = JSON.stringify(updates.serviceCatalog);
      }
      if (updates.availabilityRules && typeof updates.availabilityRules !== "string") {
        updates.availabilityRules = JSON.stringify(updates.availabilityRules);
      }

      const link = await storage.updateBookingLink(id, updates);
      if (!link) {
        return res.status(404).json({ error: "Booking link not found" });
      }
      res.json({ bookingLink: link });
    } catch (error: any) {
      console.error("Update booking link error:", error);
      res.status(500).json({ error: error.message || "Failed to update booking link" });
    }
  });

  // Delete booking link
  app.delete("/api/booking-links/:id", requireAuth, async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteBookingLink(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete booking link error:", error);
      res.status(500).json({ error: error.message || "Failed to delete booking link" });
    }
  });

  // Submit intake form (public - creates intake submission)
  app.post("/api/providers/:slug/submit", async (req: Request<{ slug: string }>, res: Response) => {
    try {
      const { slug } = req.params;
      const { clientName, clientPhone, clientEmail, address, problemDescription, answersJson, photosJson, preferredTimesJson, homeownerUserId } = req.body;

      if (!clientName || !problemDescription) {
        return res.status(400).json({ error: "Name and problem description are required" });
      }

      const link = await storage.getBookingLinkBySlug(slug);
      if (!link || link.status !== "active") {
        return res.status(404).json({ error: "Booking page not found" });
      }

      const submission = await storage.createIntakeSubmission({
        bookingLinkId: link.id,
        providerId: link.providerId,
        homeownerUserId: homeownerUserId || null,
        clientName,
        clientPhone,
        clientEmail,
        address,
        problemDescription,
        answersJson: answersJson ? JSON.stringify(answersJson) : null,
        photosJson: photosJson ? JSON.stringify(photosJson) : null,
        preferredTimesJson: preferredTimesJson ? JSON.stringify(preferredTimesJson) : null,
      });

      // Auto-create a lead for the provider if one doesn't already exist for this email
      try {
        const existingLeads = clientEmail
          ? await db.select().from(leads)
              .where(and(
                eq(leads.providerId, link.providerId),
                eq(leads.email, clientEmail)
              ))
              .limit(1)
          : [];
        if (existingLeads.length === 0) {
          await db.insert(leads).values({
            providerId: link.providerId,
            name: clientName,
            email: clientEmail || null,
            phone: clientPhone || null,
            service: null,
            message: problemDescription || null,
            status: "new",
            source: "booking_page",
          });
        }
      } catch (leadErr) {
        console.error("Lead auto-create error (non-fatal):", leadErr);
      }

      res.status(201).json({ submission, message: "Your request has been submitted!" });
    } catch (error: any) {
      console.error("Submit intake error:", error);
      res.status(500).json({ error: error.message || "Failed to submit request" });
    }
  });

  // ── Public booking link endpoints (new /api/booking/:slug) ──────────────────

  // GET /api/booking/:slug — returns full public profile payload
  app.get("/api/booking/:slug", async (req: Request<{ slug: string }>, res: Response) => {
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

      // Fetch public custom services (isPublished = true)
      const customServices = await db
        .select()
        .from(providerCustomServices)
        .where(
          and(
            eq(providerCustomServices.providerId, provider.id),
            eq(providerCustomServices.isPublished, true)
          )
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
            eq(services.isPublic, true)
          )
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
            ? (() => { try { return JSON.parse(provider.businessHours!); } catch { return provider.businessHours; } })()
            : null,
          bookingPolicies: provider.bookingPolicies
            ? (() => { try { return JSON.parse(provider.bookingPolicies as string); } catch { return provider.bookingPolicies; } })()
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
          intakeQuestions: link.intakeQuestions ? (() => { try { return JSON.parse(link.intakeQuestions!); } catch { return []; } })() : [],
        },
        services: {
          custom: customServices,
          catalog: catalogServices,
        },
        reviews: recentReviews,
      });
    } catch (error: any) {
      console.error("Get public booking page error:", error);
      res.status(500).json({ error: error.message || "Failed to get booking page" });
    }
  });

  // POST /api/booking/:slug — submit a booking request
  app.post("/api/booking/:slug", async (req: Request<{ slug: string }>, res: Response) => {
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
      } = req.body;

      if (!clientName || !problemDescription) {
        return res.status(400).json({ error: "clientName and problemDescription are required" });
      }

      const [link] = await db
        .select()
        .from(bookingLinks)
        .where(eq(bookingLinks.slug, slug))
        .limit(1);

      if (!link || link.isActive === false || link.status !== "active") {
        return res.status(404).json({ error: "Booking page not found" });
      }

      // For instant bookings: create submission + client + job atomically in a single transaction
      let submission: typeof intakeSubmissions.$inferSelect;
      let instantClientId: string | undefined;
      let instantJob: (typeof jobs.$inferSelect) | undefined;

      if (link.instantBooking) {
        const txResult = await db.transaction(async (tx) => {
          // Insert submission first with "confirmed" status
          const [sub] = await tx
            .insert(intakeSubmissions)
            .values({
              bookingLinkId: link.id,
              providerId: link.providerId,
              homeownerUserId: null,
              clientName,
              clientPhone: clientPhone || null,
              clientEmail: clientEmail || null,
              address: address || null,
              problemDescription,
              categoryId: categoryId || null,
              answersJson: answersJson ? JSON.stringify(answersJson) : null,
              preferredTimesJson: preferredTimesJson ? JSON.stringify(preferredTimesJson) : null,
              status: "confirmed" as const,
            })
            .returning();

          // Use shared helper to upsert client, create job, and stamp conversion fields
          const preferredDate = preferredTimesJson?.[0] ? new Date(preferredTimesJson[0]) : undefined;
          const converted = await convertIntakeToClientJob(tx, {
            submissionId: sub.id,
            providerId: link.providerId,
            clientName,
            clientEmail,
            clientPhone,
            address,
            problemDescription,
            scheduledDate: preferredDate,
            targetStatus: "confirmed",
          });

          return { sub, clientId: converted.clientId, job: converted.job };
        });

        submission = txResult.sub;
        instantClientId = txResult.clientId;
        instantJob = txResult.job;
      } else {
        const [sub] = await db
          .insert(intakeSubmissions)
          .values({
            bookingLinkId: link.id,
            providerId: link.providerId,
            homeownerUserId: null,
            clientName,
            clientPhone: clientPhone || null,
            clientEmail: clientEmail || null,
            address: address || null,
            problemDescription,
            categoryId: categoryId || null,
            answersJson: answersJson ? JSON.stringify(answersJson) : null,
            preferredTimesJson: preferredTimesJson ? JSON.stringify(preferredTimesJson) : null,
            status: "submitted" as const,
          })
          .returning();
        submission = sub;
      }

      // Notify the provider's linked user and (for instant bookings) send confirmation email to client
      try {
        const [providerRow] = await db
          .select({ userId: providers.userId, businessName: providers.businessName, email: providers.email })
          .from(providers)
          .where(eq(providers.id, link.providerId))
          .limit(1);

        if (providerRow?.userId) {
          const notificationTitle = link.instantBooking
            ? "New Booking Confirmed"
            : "New Booking Request";
          const notificationMessage = link.instantBooking
            ? `${clientName} has booked an appointment. Check your intake submissions for details.`
            : `${clientName} submitted a new booking request. Review it in your intake submissions.`;

          await db.insert(notifications).values({
            userId: providerRow.userId,
            title: notificationTitle,
            message: notificationMessage,
            type: "booking_request",
            isRead: false,
            data: JSON.stringify({ intakeSubmissionId: submission.id, clientName }),
          });

          // For instant bookings, send a booking confirmation email to the client
          if (link.instantBooking && clientEmail) {
            const preferredDateStr = preferredTimesJson?.[0]
              ? new Date(preferredTimesJson[0]).toLocaleDateString()
              : "To be confirmed";
            dispatch("booking.created", {
              clientEmail,
              clientName,
              providerEmail: providerRow.email ?? undefined,
              providerName: providerRow.businessName ?? link.title ?? "Your Provider",
              serviceName: link.title ?? "Home Service",
              appointmentDate: preferredDateStr,
              appointmentTime: preferredTimesJson?.[0]
                ? new Date(preferredTimesJson[0]).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : undefined,
              confirmationNumber: submission.id,
              relatedRecordType: "intake_submission",
              relatedRecordId: submission.id,
            }).catch((e: unknown) => console.error("Instant booking email dispatch error:", e));
          }
        }
      } catch (notifyErr) {
        console.error("Notification create error (non-fatal):", notifyErr);
      }

      res.status(201).json({
        submission,
        ...(instantClientId ? { clientId: instantClientId } : {}),
        ...(instantJob ? { job: instantJob } : {}),
        message: link.instantBooking
          ? "Your booking has been confirmed!"
          : "Your request has been submitted!",
      });
    } catch (error: any) {
      console.error("Public booking submission error:", error);
      res.status(500).json({ error: error.message || "Failed to submit booking request" });
    }
  });

  // Get intake submissions for provider — ownership check
  app.get("/api/providers/:providerId/intake-submissions", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
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
      const submissions = await storage.getIntakeSubmissionsByProvider(providerId);
      res.json({ submissions });
    } catch (error: any) {
      console.error("Get intake submissions error:", error);
      res.status(500).json({ error: error.message || "Failed to get intake submissions" });
    }
  });

  // Update intake submission (review, convert, decline) — ownership check
  app.put("/api/intake-submissions/:id", requireAuth, async (req: Request<{ id: string }>, res: Response) => {
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
      res.status(500).json({ error: error.message || "Failed to update submission" });
    }
  });

  // Accept intake submission — creates a client + job record and marks submission as "confirmed"
  app.post("/api/intake-submissions/:id/accept", requireAuth, async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const { scheduledDate, scheduledTime, estimatedPrice, notes } = req.body;
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
      if (submission.status === "converted" || submission.status === "confirmed") {
        return res.status(400).json({ error: "Submission has already been accepted" });
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
          const preferred = JSON.parse(submission.preferredTimesJson) as string[];
          if (preferred.length > 0) {
            const parsed = new Date(preferred[0]);
            if (!isNaN(parsed.getTime())) resolvedScheduledDate = parsed;
          }
        } catch {
          // ignore
        }
      }

      // Run conversion in a transaction using the shared helper.
      // SELECT FOR UPDATE on the submission row serializes concurrent accept requests —
      // the second request will see the updated status and abort idempotently.
      let alreadyAccepted = false;
      const result = await db.transaction(async (tx) => {
        const locked = await tx.execute(sql`
          SELECT status FROM intake_submissions WHERE id = ${id} FOR UPDATE
        `);
        const lockedStatus = (locked.rows[0] as { status: string } | undefined)?.status;
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
                eq(leads.email, submission.clientEmail)
              )
            );
        }

        return converted;
      });

      if (alreadyAccepted) {
        return res.status(400).json({ error: "Submission has already been accepted" });
      }

      res.status(201).json({
        message: "Booking accepted",
        clientId: result!.clientId,
        job: result!.job,
      });
    } catch (error: any) {
      console.error("Accept intake submission error:", error);
      res.status(500).json({ error: error.message || "Failed to accept submission" });
    }
  });

  // ─── Leads ────────────────────────────────────────────────────────────────────

  // GET all leads for a provider
  app.get("/api/providers/:providerId/leads", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
    try {
      const { providerId } = req.params;
      if (!(await assertProviderOwnership(req, providerId, res))) return;
      const rows = await db.select().from(leads)
        .where(eq(leads.providerId, providerId))
        .orderBy(desc(leads.createdAt));
      res.json({ leads: rows });
    } catch (error: any) {
      console.error("Get leads error:", error);
      res.status(500).json({ error: error.message || "Failed to get leads" });
    }
  });

  // POST create a lead manually
  app.post("/api/providers/:providerId/leads", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
    try {
      const { providerId } = req.params;
      if (!(await assertProviderOwnership(req, providerId, res))) return;
      const { name, email, phone, service, message, status, source } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
      }
      const [lead] = await db.insert(leads).values({
        providerId,
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        service: service || null,
        message: message || null,
        status: status || "new",
        source: source || "manual",
      }).returning();
      res.status(201).json({ lead });
    } catch (error: any) {
      console.error("Create lead error:", error);
      res.status(500).json({ error: error.message || "Failed to create lead" });
    }
  });

  // PATCH update a lead's status or fields
  app.patch("/api/leads/:id", requireAuth, async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      // Ownership: look up lead's providerId and verify caller owns that provider
      const [existing] = await db.select({ providerId: leads.providerId }).from(leads).where(eq(leads.id, id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Lead not found" });
      if (!(await assertProviderOwnership(req, existing.providerId, res))) return;

      const updates: Partial<typeof leads.$inferInsert> = {};
      const { name, email, phone, service, message, status, source } = req.body;
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (service !== undefined) updates.service = service;
      if (message !== undefined) updates.message = message;
      if (status !== undefined) updates.status = status;
      if (source !== undefined) updates.source = source;
      updates.updatedAt = new Date();
      const [lead] = await db.update(leads).set(updates).where(eq(leads.id, id)).returning();
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      res.json({ lead });
    } catch (error: any) {
      console.error("Update lead error:", error);
      res.status(500).json({ error: error.message || "Failed to update lead" });
    }
  });

  // Accept a lead — creates client + job record and marks lead as "won"
  app.post("/api/leads/:id/accept", requireAuth, async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const { scheduledDate, scheduledTime, estimatedPrice, notes } = req.body;
      const authUserId = req.authenticatedUserId;

      const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
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
        return res.status(400).json({ error: "Lead has already been accepted" });
      }

      // Resolve scheduled date from request body
      const resolvedDate = scheduledDate ? new Date(scheduledDate) : new Date();

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
            .where(and(eq(clients.providerId, lead.providerId), eq(clients.email, lead.email)));
          if (found) {
            clientId = found.id;
          } else {
            const [newC] = await tx
              .insert(clients)
              .values({ providerId: lead.providerId, firstName, lastName, email: lead.email, phone: lead.phone || null })
              .returning({ id: clients.id });
            clientId = newC.id;
          }
        } else {
          const [newC] = await tx
            .insert(clients)
            .values({ providerId: lead.providerId, firstName, lastName, email: null, phone: lead.phone || null })
            .returning({ id: clients.id });
          clientId = newC.id;
        }

        // Create job
        const [newJob] = await tx
          .insert(jobs)
          .values({
            providerId: lead.providerId,
            clientId,
            title: lead.service || lead.message?.slice(0, 100) || "Service Request",
            description: lead.message || null,
            scheduledDate: resolvedDate,
            scheduledTime: scheduledTime || null,
            status: "scheduled",
            estimatedPrice: estimatedPrice ? String(estimatedPrice) : null,
            notes: notes || null,
          })
          .returning();

        // Mark lead as won
        const now = new Date();
        await tx.update(leads).set({ status: "won", updatedAt: now }).where(eq(leads.id, id));

        return { clientId, job: newJob };
      });

      res.status(201).json({ message: "Lead accepted", clientId: result.clientId, job: result.job });
    } catch (error: any) {
      console.error("Accept lead error:", error);
      res.status(500).json({ error: error.message || "Failed to accept lead" });
    }
  });

  // DELETE a lead
  app.delete("/api/leads/:id", requireAuth, async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const [deleted] = await db.delete(leads).where(eq(leads.id, id)).returning();
      if (!deleted) return res.status(404).json({ error: "Lead not found" });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete lead error:", error);
      res.status(500).json({ error: error.message || "Failed to delete lead" });
    }
  });

  // ============ Provider Messages Routes ============

  // Rate limit map for provider messages (10/client/24h)
  const messageLimitMap = new Map<string, { count: number; resetAt: number }>();

  function checkMessageRateLimit(providerId: string, clientId: string): boolean {
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
  app.post("/api/providers/:providerId/messages", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      const { providerId } = req.params;
      if (!(await assertProviderOwnership(req, providerId, res))) return;
      const providerRecord = await storage.getProvider(providerId);

      const { clientId, channel, subject, body, jobId, invoiceId } = req.body;

      if (!clientId || !body) {
        return res.status(400).json({ error: "clientId and body are required" });
      }

      // Verify client belongs to this provider
      const [client] = await db.select().from(clients).where(
        and(eq(clients.id, clientId), eq(clients.providerId, providerId))
      );
      if (!client) {
        return res.status(403).json({ error: "Client does not belong to this provider" });
      }

      // Rate limit
      if (!checkMessageRateLimit(providerId, clientId)) {
        return res.status(429).json({ error: "Rate limit exceeded: max 10 messages per client per 24 hours" });
      }

      // Substitute merge variables
      const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ");
      let processedBody = body
        .replace(/\{\{client_name\}\}/g, clientName)
        .replace(/\{\{provider_name\}\}/g, providerRecord.businessName);
      let processedSubject = (subject || `Message from ${providerRecord.businessName}`)
        .replace(/\{\{client_name\}\}/g, clientName)
        .replace(/\{\{provider_name\}\}/g, providerRecord.businessName);

      if (jobId) {
        const [jobRecord] = await db.select().from(jobs).where(eq(jobs.id, jobId));
        if (jobRecord) {
          processedBody = processedBody
            .replace(/\{\{service\}\}/g, jobRecord.title || "")
            .replace(/\{\{booking_date\}\}/g, jobRecord.scheduledDate ? new Date(jobRecord.scheduledDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");
          processedSubject = processedSubject
            .replace(/\{\{service\}\}/g, jobRecord.title || "")
            .replace(/\{\{booking_date\}\}/g, jobRecord.scheduledDate ? new Date(jobRecord.scheduledDate).toLocaleDateString() : "");
        }
      }

      if (invoiceId) {
        const [invoiceRecord] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
        if (invoiceRecord) {
          const amount = invoiceRecord.total || invoiceRecord.amount || "0";
          processedBody = processedBody.replace(/\{\{amount_due\}\}/g, `$${parseFloat(amount).toFixed(2)}`);
          processedSubject = processedSubject.replace(/\{\{amount_due\}\}/g, `$${parseFloat(amount).toFixed(2)}`);
        }
      }

      let status: "sent" | "failed" | "pending_sms" = "sent";
      let resendMessageId: string | undefined;

      if (channel === "email") {
        if (!client.email) {
          return res.status(400).json({ error: "Client does not have an email address" });
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

      const [message] = await db.insert(providerMessages).values({
        providerId,
        clientId,
        jobId: jobId || null,
        invoiceId: invoiceId || null,
        channel: channel || "email",
        subject: processedSubject,
        body: processedBody,
        status,
        resendMessageId: resendMessageId || null,
      }).returning();

      res.status(201).json({ message });
    } catch (error: any) {
      console.error("Send provider message error:", error);
      res.status(500).json({ error: error.message || "Failed to send message" });
    }
  });

  // POST /api/providers/:providerId/messages/blast — send a message to multiple clients
  app.post("/api/providers/:providerId/messages/blast", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      const { providerId } = req.params;
      if (!(await assertProviderOwnership(req, providerId, res))) return;
      const providerRecord = await storage.getProvider(providerId);

      const { clientIds, channel, subject, body } = req.body;

      if (!Array.isArray(clientIds) || clientIds.length === 0) {
        return res.status(400).json({ error: "clientIds (array) is required" });
      }
      if (!body) {
        return res.status(400).json({ error: "body is required" });
      }
      if (clientIds.length > 100) {
        return res.status(400).json({ error: "Cannot blast more than 100 clients at once" });
      }

      const results: { clientId: string; status: string; error?: string }[] = [];

      for (const clientId of clientIds) {
        try {
          // Verify client belongs to this provider
          const [client] = await db.select().from(clients).where(
            and(eq(clients.id, clientId), eq(clients.providerId, providerId))
          );
          if (!client) {
            results.push({ clientId, status: "skipped", error: "Client not found" });
            continue;
          }

          if (!checkMessageRateLimit(providerId, clientId)) {
            results.push({ clientId, status: "skipped", error: "Rate limit exceeded" });
            continue;
          }

          const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ");
          const processedBody = body
            .replace(/\{\{client_name\}\}/g, clientName)
            .replace(/\{\{provider_name\}\}/g, providerRecord.businessName);
          const processedSubject = (subject || `Message from ${providerRecord.businessName}`)
            .replace(/\{\{client_name\}\}/g, clientName)
            .replace(/\{\{provider_name\}\}/g, providerRecord.businessName);

          let status: "sent" | "failed" | "pending_sms" = "sent";
          let resendMessageId: string | undefined;

          if (channel === "email") {
            if (!client.email) {
              results.push({ clientId, status: "skipped", error: "No email on file" });
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
          results.push({ clientId, status: "failed", error: clientErr.message || "Unknown error" });
        }
      }

      const sent = results.filter(r => r.status === "sent" || r.status === "pending_sms").length;
      const failed = results.filter(r => r.status === "failed").length;
      const skipped = results.filter(r => r.status === "skipped").length;

      res.status(201).json({ results, summary: { sent, failed, skipped, total: clientIds.length } });
    } catch (error: any) {
      console.error("Blast message error:", error);
      res.status(500).json({ error: error.message || "Failed to send blast" });
    }
  });

  // GET /api/providers/:providerId/clients/:clientId/messages — message history
  app.get("/api/providers/:providerId/clients/:clientId/messages", requireAuth, async (req: Request<{ providerId: string; clientId: string }>, res: Response) => {
    try {
      const { providerId, clientId } = req.params;
      if (!(await assertProviderOwnership(req, providerId, res))) return;

      const messages = await db.select().from(providerMessages)
        .where(and(eq(providerMessages.providerId, providerId), eq(providerMessages.clientId, clientId)))
        .orderBy(desc(providerMessages.createdAt));

      res.json({ messages });
    } catch (error: any) {
      console.error("Get provider messages error:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  // GET /api/providers/:providerId/message-templates — list templates
  app.get("/api/providers/:providerId/message-templates", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      const { providerId } = req.params;
      if (!(await assertProviderOwnership(req, providerId, res))) return;

      const templates = await db.select().from(messageTemplates)
        .where(eq(messageTemplates.providerId, providerId))
        .orderBy(desc(messageTemplates.createdAt));

      res.json({ templates });
    } catch (error: any) {
      console.error("Get message templates error:", error);
      res.status(500).json({ error: "Failed to get templates" });
    }
  });

  // POST /api/providers/:providerId/message-templates — create template
  app.post("/api/providers/:providerId/message-templates", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      const { providerId } = req.params;
      if (!(await assertProviderOwnership(req, providerId, res))) return;

      const { name, channel, subject, body } = req.body;
      if (!name || !body) {
        return res.status(400).json({ error: "name and body are required" });
      }

      const [template] = await db.insert(messageTemplates).values({
        providerId,
        name,
        channel: channel || "email",
        subject: subject || null,
        body,
      }).returning();

      res.status(201).json({ template });
    } catch (error: any) {
      console.error("Create message template error:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  // PATCH /api/providers/:providerId/message-templates/:templateId — update template
  app.patch("/api/providers/:providerId/message-templates/:templateId", requireAuth, async (req: Request<{ providerId: string; templateId: string }>, res: Response) => {
    try {
      const { providerId, templateId } = req.params;
      if (!(await assertProviderOwnership(req, providerId, res))) return;

      const { name, channel, subject, body } = req.body;
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (channel !== undefined) updates.channel = channel;
      if (subject !== undefined) updates.subject = subject;
      if (body !== undefined) updates.body = body;

      const [template] = await db.update(messageTemplates)
        .set(updates)
        .where(and(eq(messageTemplates.id, templateId), eq(messageTemplates.providerId, providerId)))
        .returning();

      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json({ template });
    } catch (error: any) {
      console.error("Update message template error:", error);
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  // DELETE /api/providers/:providerId/message-templates/:templateId — delete template
  app.delete("/api/providers/:providerId/message-templates/:templateId", requireAuth, async (req: Request<{ providerId: string; templateId: string }>, res: Response) => {
    try {
      const { providerId, templateId } = req.params;
      if (!(await assertProviderOwnership(req, providerId, res))) return;

      const [deleted] = await db.delete(messageTemplates)
        .where(and(eq(messageTemplates.id, templateId), eq(messageTemplates.providerId, providerId)))
        .returning();

      if (!deleted) return res.status(404).json({ error: "Template not found" });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete message template error:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // GET /api/providers/:providerId/clients/:clientId/last-message — get last message for client list
  app.get("/api/providers/:providerId/clients/last-messages", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
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
  });

  // ─── Provider Communications endpoints ──────────────────────────────────────

  // POST /api/providers/:providerId/communicate/individual — send to one client by userId
  app.post("/api/providers/:providerId/communicate/individual", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      const { providerId } = req.params;
      if (!(await assertProviderOwnership(req, providerId, res))) return;
      const providerRecord = await storage.getProvider(providerId);

      const { clientId, subject, body, channels } = req.body;
      const VALID_CHANNELS = ["push", "email"];
      if (!clientId || !body || !channels || !Array.isArray(channels) || channels.length === 0) {
        return res.status(400).json({ error: "clientId, body, and channels are required" });
      }
      const validatedChannels = channels.filter((ch: string) => VALID_CHANNELS.includes(ch));
      if (validatedChannels.length === 0) {
        return res.status(400).json({ error: "channels must include at least one of: push, email" });
      }

      const [client] = await db.select().from(clients).where(and(eq(clients.id, clientId), eq(clients.providerId, providerId)));
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const providerName = providerRecord.businessName;
      const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ");
      const results: { channel: string; success: boolean; error?: string }[] = [];

      if (validatedChannels.includes("email") && client.email) {
        const result = await sendProviderClientMessage({
          clientEmail: client.email,
          clientName,
          providerName,
          subject: subject || `Message from ${providerName}`,
          body,
        });
        results.push({ channel: "email", success: result.success, error: result.error });
      }

      if (validatedChannels.includes("push")) {
        // Only send push to users who have a confirmed appointment with this provider,
        // establishing a platform-verified provider-client relationship.
        if (client.email) {
          const [verifiedUser] = await db
            .select({ id: users.id })
            .from(users)
            .innerJoin(appointments, and(eq(appointments.userId, users.id), eq(appointments.providerId, providerId)))
            .where(eq(users.email, client.email))
            .limit(1);
          if (verifiedUser) {
            await sendPush(verifiedUser.id, subject || providerName, body, { type: "provider_message", providerId }, "messages");
            results.push({ channel: "push", success: true });
          } else {
            results.push({ channel: "push", success: false, error: "Client has no verified app account with this provider" });
          }
        } else {
          results.push({ channel: "push", success: false, error: "Client has no email on file" });
        }
      }

      res.json({ success: true, results });
    } catch (error: any) {
      console.error("Communicate individual error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // POST /api/providers/:providerId/communicate/broadcast — send to all clients
  app.post("/api/providers/:providerId/communicate/broadcast", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      const { providerId } = req.params;
      if (!(await assertProviderOwnership(req, providerId, res))) return;
      const providerRecord = await storage.getProvider(providerId);

      const { subject, body, channels } = req.body;
      const VALID_CHANNELS_BROADCAST = ["push", "email"];
      if (!body || !channels || !Array.isArray(channels) || channels.length === 0) {
        return res.status(400).json({ error: "body and channels are required" });
      }
      const validatedChannels = channels.filter((ch: string) => VALID_CHANNELS_BROADCAST.includes(ch));
      if (validatedChannels.length === 0) {
        return res.status(400).json({ error: "channels must include at least one of: push, email" });
      }

      const allClients = await db.select().from(clients).where(eq(clients.providerId, providerId));
      const providerName = providerRecord.businessName;

      let emailSent = 0;
      let pushSent = 0;
      let emailFailed = 0;
      let pushFailed = 0;

      for (const client of allClients) {
        const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ");

        if (validatedChannels.includes("email") && client.email) {
          const result = await sendProviderClientMessage({
            clientEmail: client.email,
            clientName,
            providerName,
            subject: subject || `Message from ${providerName}`,
            body,
          });
          if (result.success) emailSent++; else emailFailed++;
        }

        if (validatedChannels.includes("push") && client.email) {
          const [verifiedUser] = await db
            .select({ id: users.id })
            .from(users)
            .innerJoin(appointments, and(eq(appointments.userId, users.id), eq(appointments.providerId, providerId)))
            .where(eq(users.email, client.email))
            .limit(1);
          if (verifiedUser) {
            await sendPush(verifiedUser.id, subject || providerName, body, { type: "provider_broadcast", providerId }, "messages");
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
  });

  // ─── Support Ticket endpoint ─────────────────────────────────────────────────

  app.post("/api/support/ticket", async (req: Request, res: Response) => {
    try {
      const { name, email, category, subject, message } = req.body;

      if (!name || !email || !category || !subject || !message) {
        return res.status(400).json({ error: "All fields are required" });
      }

      // Optionally read userId from auth token (non-fatal if absent)
      let userId: string | null = null;
      try {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
          const { verifyToken } = await import("./auth");
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

      // Send email non-fatally
      sendSupportTicketEmail({
        ticketId: ticket.id,
        name: ticket.name,
        email: ticket.email,
        category: ticket.category,
        subject: ticket.subject,
        message: ticket.message,
      }).catch((err: unknown) => {
        console.error("[SUPPORT_EMAIL] Failed to send support ticket email:", err);
      });

      res.status(201).json({ success: true, ticketId: ticket.id });
    } catch (error: any) {
      console.error("Support ticket error:", error);
      res.status(500).json({ error: "Failed to submit support ticket" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
