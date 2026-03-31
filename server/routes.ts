import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { openai, HOMEBASE_SYSTEM_PROMPT, PROVIDER_ASSISTANT_PROMPT } from "./openai";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import { insertUserSchema, loginSchema, insertHomeSchema, insertAppointmentSchema, insertProviderSchema, insertClientSchema, insertJobSchema, insertInvoiceSchema, insertPaymentSchema } from "@shared/schema";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { db } from "./db";
import { sql, eq, and, desc } from "drizzle-orm";
import { appointments, maintenanceReminders, homes, reviews } from "@shared/schema";
import { sendInvoiceEmail } from "./emailService";
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
  createInvoicePaymentIntent,
  createStripeCheckoutSession,
  applyCreditsToInvoice,
  handleStripeWebhook,
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

export async function registerRoutes(app: Express): Promise<Server> {
  await seedDatabase();

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
      const token = generateToken(user.id, user.isProvider ? "provider" : "homeowner");
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      res.status(201).json({ user: formatUserResponse(user), token });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Failed to create account" });
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

      // Always try to fetch provider profile (in case isProvider flag is out of sync)
      let providerProfile = await storage.getProviderByUserId(user.id);
      
      // If provider profile found but user.isProvider is false, update the user flag
      if (providerProfile && !user.isProvider) {
        await storage.updateUser(user.id, { isProvider: true });
        user.isProvider = true;
      }

      const token = generateToken(user.id, user.isProvider ? "provider" : "homeowner");
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000,
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
      res.json({ provider, services: providerServices });
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
      
      res.json({ appointment });
    } catch (error) {
      console.error("Reschedule appointment error:", error);
      res.status(500).json({ error: "Failed to reschedule appointment" });
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

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: chatMessages,
        stream: true,
        max_tokens: 1024,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in chat:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to get response" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process chat request" });
      }
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
      const serviceHistory = await db.select()
        .from(appointments)
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
      // Verify provider exists before creating service
      const provider = await storage.getProvider(req.params.providerId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
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
      const [existing] = await db.select().from(providerCustomServices)
        .where(eq(providerCustomServices.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Service not found" });
      if (existing.providerId !== req.params.providerId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      // Allowlist mutable fields only — prevent mass-assignment of id/providerId/createdAt
      const { name, category, description, pricingType, basePrice, priceFrom, priceTo, priceTiersJson, duration, isPublished } = req.body;
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
      const [existing] = await db.select().from(providerCustomServices)
        .where(eq(providerCustomServices.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Service not found" });
      if (existing.providerId !== req.params.providerId) {
        return res.status(403).json({ error: "Forbidden" });
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
      const parsed = insertProviderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }

      // Check if user already has a provider profile
      if (parsed.data.userId) {
        const existing = await storage.getProviderByUserId(parsed.data.userId);
        if (existing) {
          return res.status(409).json({ error: "User already has a provider profile" });
        }
      }

      const provider = await storage.createProvider(parsed.data);
      
      // Mark user as provider
      if (parsed.data.userId) {
        await storage.updateUser(parsed.data.userId, { isProvider: true });
      }

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
      if (parsed.bookingPolicies) {
        try { parsed.bookingPolicies = JSON.parse(parsed.bookingPolicies); } catch {}
      }
      if (parsed.businessHours) {
        try { parsed.businessHours = JSON.parse(parsed.businessHours); } catch {}
      }
      res.json({ provider: parsed });
    } catch (error) {
      console.error("Get provider error:", error);
      res.status(500).json({ error: "Failed to get provider" });
    }
  });

  // Update provider profile (PUT - full update)
  app.put("/api/provider/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
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
      const body = req.body;
      const update: Record<string, any> = {};

      const directFields = [
        "businessName", "description", "phone", "email", "serviceArea",
        "avatarUrl", "hourlyRate", "yearsExperience", "serviceRadius",
        "serviceZipCodes", "serviceCities", "isPublicProfile",
        "instantBooking", "advanceBookingDays",
      ];
      for (const field of directFields) {
        if (body[field] !== undefined) update[field] = body[field];
      }

      // Serialize JSON object fields to text
      if (body.bookingPolicies !== undefined) {
        update.bookingPolicies =
          typeof body.bookingPolicies === "string"
            ? body.bookingPolicies
            : JSON.stringify(body.bookingPolicies);
      }
      if (body.businessHours !== undefined) {
        update.businessHours =
          typeof body.businessHours === "string"
            ? body.businessHours
            : JSON.stringify(body.businessHours);
      }
      if (body.availability !== undefined) {
        // Store availability merged into bookingPolicies to keep schema simple
        const existing = await storage.getProvider(id);
        let existingPolicies: Record<string, any> = {};
        if (existing?.bookingPolicies) {
          try { existingPolicies = JSON.parse(existing.bookingPolicies); } catch {}
        }
        const availability =
          typeof body.availability === "string"
            ? JSON.parse(body.availability)
            : body.availability;
        update.bookingPolicies = JSON.stringify({ ...existingPolicies, availability });
      }

      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const provider = await storage.updateProvider(id, update);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      // Parse bookingPolicies back to object for the response
      const parsed = { ...provider } as any;
      if (parsed.bookingPolicies) {
        try { parsed.bookingPolicies = JSON.parse(parsed.bookingPolicies); } catch {}
      }

      res.json({ provider: parsed });
    } catch (error: any) {
      console.error("Patch provider error:", error);
      res.status(500).json({ error: error.message || "Failed to update provider" });
    }
  });

  // Provider dashboard stats
  app.get("/api/provider/:id/stats", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const stats = await storage.getProviderStats(req.params.id);
      res.json({ stats });
    } catch (error) {
      console.error("Get provider stats error:", error);
      res.status(500).json({ error: "Failed to get provider stats" });
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

  // ============ CLIENTS ROUTES ============

  app.get("/api/provider/:providerId/clients", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
    try {
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
      res.json({ client, jobs, invoices });
    } catch (error) {
      console.error("Get client error:", error);
      res.status(500).json({ error: "Failed to get client" });
    }
  });

  app.post("/api/clients", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = insertClientSchema.safeParse(req.body);
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
      
      const client = await storage.createClient(parsed.data);
      res.status(201).json({ client });
    } catch (error) {
      console.error("Create client error:", error);
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.put("/api/clients/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const client = await storage.updateClient(req.params.id, req.body);
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
      const jobs = await storage.getJobs(req.params.providerId);
      res.json({ jobs });
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
      res.json({ job });
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
      const job = await storage.createJob(parsed.data);
      res.status(201).json({ job });
    } catch (error) {
      console.error("Create job error:", error);
      res.status(500).json({ error: "Failed to create job" });
    }
  });

  app.put("/api/jobs/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const job = await storage.updateJob(req.params.id, req.body);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
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
      const payments = await storage.getPaymentsByInvoice(req.params.id);
      res.json({ invoice, payments });
    } catch (error) {
      console.error("Get invoice error:", error);
      res.status(500).json({ error: "Failed to get invoice" });
    }
  });

  app.get("/api/provider/:providerId/next-invoice-number", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      const invoiceNumber = await storage.getNextInvoiceNumber(req.params.providerId);
      res.json({ invoiceNumber });
    } catch (error) {
      console.error("Get next invoice number error:", error);
      res.status(500).json({ error: "Failed to get invoice number" });
    }
  });

  app.post("/api/invoices", requireAuth, async (req: Request, res: Response) => {
    try {
      // Auto-generate invoice number if not provided
      const invoiceNumber = req.body.invoiceNumber || `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      
      // Convert dueDate string to Date
      const invoiceData = {
        ...req.body,
        invoiceNumber,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      };
      const parsed = insertInvoiceSchema.safeParse(invoiceData);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }
      const invoice = await storage.createInvoice(parsed.data);
      res.status(201).json({ invoice });
    } catch (error) {
      console.error("Create invoice error:", error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  // Create and immediately send invoice (one-step flow)
  app.post("/api/invoices/create-and-send", requireAuth, async (req: Request, res: Response) => {
    try {
      // Auto-generate invoice number
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      
      // Build line items from amount
      const amount = parseFloat(req.body.amount);
      const lineItems = [{
        description: req.body.notes || "Service",
        quantity: 1,
        unitPrice: amount,
        total: amount
      }];
      
      // Create invoice data
      const invoiceData = {
        providerId: req.body.providerId,
        clientId: req.body.clientId,
        jobId: req.body.jobId || null,
        invoiceNumber,
        total: amount.toString(),
        lineItems,
        status: "sent",
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      };
      
      const parsed = insertInvoiceSchema.safeParse(invoiceData);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }
      
      // Create the invoice
      const invoice = await storage.createInvoice(parsed.data);
      
      // Now send the email
      let emailSent = false;
      let emailError: string | undefined;
      
      if (invoice.clientId) {
        const client = await storage.getClient(invoice.clientId);
        const provider = await storage.getProvider(invoice.providerId);
        
        if (client?.email && provider) {
          const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ") || "Client";
          
          const emailResult = await sendInvoiceEmail({
            clientEmail: client.email,
            clientName,
            providerName: provider.businessName || provider.userId || "Service Provider",
            invoiceNumber: invoice.invoiceNumber || invoiceNumber,
            amount: amount,
            dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "Due on receipt",
            lineItems,
          });
          
          emailSent = emailResult.success;
          emailError = emailResult.error;
          console.log("Invoice email result:", emailResult);
        } else if (!client?.email) {
          emailError = "Client has no email address on file.";
        }
      }
      
      res.status(201).json({ 
        invoice, 
        emailSent,
        emailError 
      });
    } catch (error) {
      console.error("Create and send invoice error:", error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  app.put("/api/invoices/:id", requireAuth, async (req: Request<IdParams>, res: Response) => {
    try {
      const authUserId = req.authenticatedUserId!;
      const existing = await storage.getInvoice(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const provider = await storage.getProviderByUserId(authUserId);
      if (!provider || existing.providerId !== provider.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const invoice = await storage.updateInvoice(req.params.id, req.body);
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
      
      // Get the invoice first
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
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
          
          const emailResult = await sendInvoiceEmail({
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
              total: parseFloat(item.total?.toString() || "0")
            })),
          });
          
          emailSent = emailResult.success;
          emailError = emailResult.error;
          console.log("Invoice email result:", emailResult);
        }
      }
      
      // Update invoice status to sent
      const updatedInvoice = await storage.sendInvoice(invoiceId);
      
      res.json({ 
        invoice: updatedInvoice, 
        emailSent,
        emailError 
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

  // ============ PAYMENTS ROUTES ============

  app.get("/api/provider/:providerId/payments", requireAuth, async (req: Request<ProviderIdParams>, res: Response) => {
    try {
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
  // STRIPE CONNECT ENDPOINTS
  // ============================================

  // Start Stripe Connect onboarding for provider (frontend uses this path)
  app.post("/api/stripe/connect/onboard/:providerId", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
    try {
      const { providerId } = req.params;
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
        plan.platformFeePercent || "10.00",
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
      const providerInvoices = await db
        .select()
        .from(invoices)
        .where(eq(invoices.providerId, providerId as string))
        .orderBy(invoices.createdAt);
      res.json({ invoices: providerInvoices });
    } catch (error: any) {
      console.error("Get invoices error:", error);
      res.status(500).json({ error: error.message || "Failed to get invoices" });
    }
  });

  // Send invoice
  app.post("/api/stripe/invoices/:invoiceId/send", requireAuth, async (req: Request<{ invoiceId: string }>, res: Response) => {
    try {
      const { invoiceId } = req.params;

      const [updated] = await db
        .update(invoices)
        .set({
          status: "sent",
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId))
        .returning();

      res.json({ invoice: updated });
    } catch (error: any) {
      console.error("Send invoice error:", error);
      res.status(500).json({ error: error.message || "Failed to send invoice" });
    }
  });

  // Create Stripe checkout session for invoice payment
  app.post("/api/stripe/invoices/:invoiceId/checkout", requireAuth, async (req: Request<{ invoiceId: string }>, res: Response) => {
    try {
      const { invoiceId } = req.params;
      const result = await createStripeCheckoutSession(invoiceId);
      res.json({ url: result.checkoutUrl, sessionId: result.sessionId });
    } catch (error: any) {
      console.error("Create checkout session error:", error);
      res.status(500).json({ error: error.message || "Failed to create checkout session" });
    }
  });

  // Apply credits to invoice
  app.post("/api/stripe/invoices/:invoiceId/apply-credits", requireAuth, async (req: Request<{ invoiceId: string }>, res: Response) => {
    try {
      const { invoiceId } = req.params;
      const { userId, amountCents } = req.body;
      if (!userId || amountCents === undefined) {
        return res.status(400).json({ error: "userId and amountCents are required" });
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
            platformFeePercent: platformFeePercent || "10.00",
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
        plan.platformFeePercent || "10.00",
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

  // Send invoice (mark as sent and optionally generate payment link + send email)
  app.post("/api/invoices/:invoiceId/send", requireAuth, async (req: Request<{ invoiceId: string }>, res: Response) => {
    try {
      const { invoiceId } = req.params;
      const { deliveryMethod, generatePaymentLink } = req.body;

      // Get invoice details
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Get client details
      if (!invoice.clientId) {
        return res.status(400).json({ error: "Invoice has no client" });
      }
      const client = await storage.getClient(invoice.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Get provider details
      const provider = await storage.getProvider(invoice.providerId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      let hostedUrl: string | null = null;

      if (generatePaymentLink) {
        const checkoutResult = await createStripeCheckoutSession(invoiceId);
        hostedUrl = checkoutResult.checkoutUrl;
      }

      // Send email if client has email
      let emailSent = false;
      let emailError: string | undefined;
      
      if (client.email && (deliveryMethod === "email" || deliveryMethod === "both")) {
        const rawLineItems = invoice.lineItems;
        const lineItems = Array.isArray(rawLineItems) ? rawLineItems : (typeof rawLineItems === 'string' ? JSON.parse(rawLineItems) : []);
        const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ") || "Client";
        
        const emailResult = await sendInvoiceEmail({
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
            total: parseFloat(item.total?.toString() || "0")
          })),
          paymentLink: hostedUrl || undefined
        });
        
        emailSent = emailResult.success;
        emailError = emailResult.error;
        
        if (!emailResult.success) {
          console.error("Failed to send invoice email:", emailResult.error);
        }
      }

      const [updated] = await db
        .update(invoices)
        .set({
          status: "sent",
          sentAt: new Date(),
          hostedInvoiceUrl: hostedUrl || undefined,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId))
        .returning();

      res.json({
        invoice: updated,
        paymentUrl: hostedUrl,
        deliveryMethod: deliveryMethod || "link",
        emailSent,
        emailError
      });
    } catch (error: any) {
      console.error("Send invoice error:", error);
      res.status(500).json({ error: error.message || "Failed to send invoice" });
    }
  });

  // Create payment intent for invoice (for in-app payment sheet)
  app.post("/api/invoices/:invoiceId/payment-intent", requireAuth, async (req: Request<{ invoiceId: string }>, res: Response) => {
    try {
      const { invoiceId } = req.params;
      const { payerUserId } = req.body;
      const result = await createInvoicePaymentIntent(invoiceId, payerUserId);
      res.json(result);
    } catch (error: any) {
      console.error("Create payment intent error:", error);
      res.status(500).json({ error: error.message || "Failed to create payment intent" });
    }
  });

  // Create Stripe checkout session for invoice (hosted payment page)
  app.post("/api/invoices/:invoiceId/checkout", requireAuth, async (req: Request<{ invoiceId: string }>, res: Response) => {
    try {
      const { invoiceId } = req.params;
      const result = await createStripeCheckoutSession(invoiceId);
      res.json(result);
    } catch (error: any) {
      console.error("Create checkout session error:", error);
      res.status(500).json({ error: error.message || "Failed to create checkout session" });
    }
  });

  // Apply credits to invoice
  app.post("/api/invoices/:invoiceId/apply-credits", requireAuth, async (req: Request<{ invoiceId: string }>, res: Response) => {
    try {
      const { invoiceId } = req.params;
      const { userId, amountCents } = req.body;

      if (!userId || !amountCents) {
        return res.status(400).json({ error: "userId and amountCents are required" });
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

  // Stripe Connect webhook handler
  app.post("/api/webhooks/stripe-connect", async (req: Request, res: Response) => {
    try {
      const sig = req.headers["stripe-signature"];
      const endpointSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

      let event: any;

      if (endpointSecret && sig) {
        try {
          event = getStripe().webhooks.constructEvent(
            req.body,
            sig,
            endpointSecret
          );
        } catch (err: any) {
          console.error("Webhook signature verification failed:", err.message);
          return res.status(400).json({ error: `Webhook Error: ${err.message}` });
        }
      } else {
        // In development without webhook secret, parse body directly
        event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      }

      const result = await handleStripeWebhook(event);
      res.json(result);
    } catch (error: any) {
      console.error("Stripe webhook error:", error);
      res.status(500).json({ error: error.message || "Webhook processing failed" });
    }
  });

  // Get payouts for provider
  app.get("/api/providers/:providerId/payouts", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
    try {
      const { providerId } = req.params;
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

  // ============================================
  // BOOKING LINKS & INTAKE SUBMISSIONS
  // ============================================

  // Get booking links for provider
  app.get("/api/providers/:providerId/booking-links", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
    try {
      const { providerId } = req.params;
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
      const { slug, welcomeMessage, confirmationMessage, depositRequired, depositAmount, depositPercentage, intakeQuestions, serviceCatalog, availabilityRules, brandColor, logoUrl } = req.body;

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
        welcomeMessage,
        confirmationMessage,
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

  // Get public booking link by slug (no auth required)
  app.get("/api/book/:slug", async (req: Request<{ slug: string }>, res: Response) => {
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
  app.post("/api/book/:slug/submit", async (req: Request<{ slug: string }>, res: Response) => {
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

  // Get intake submissions for provider
  app.get("/api/providers/:providerId/intake-submissions", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
    try {
      const { providerId } = req.params;
      const submissions = await storage.getIntakeSubmissionsByProvider(providerId);
      res.json({ submissions });
    } catch (error: any) {
      console.error("Get intake submissions error:", error);
      res.status(500).json({ error: error.message || "Failed to get intake submissions" });
    }
  });

  // Update intake submission (review, convert, decline)
  app.put("/api/intake-submissions/:id", requireAuth, async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
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

  // ─── Leads ────────────────────────────────────────────────────────────────────

  // GET all leads for a provider
  app.get("/api/providers/:providerId/leads", requireAuth, async (req: Request<{ providerId: string }>, res: Response) => {
    try {
      const { providerId } = req.params;
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
      const { name, email, phone, service, message, status, source } = req.body;
      if (!name) return res.status(400).json({ error: "Name is required" });
      const [lead] = await db.insert(leads).values({
        providerId,
        name,
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
      const updates: Partial<typeof leads.$inferInsert> = {};
      const allowed = ["name", "email", "phone", "service", "message", "status", "source"] as const;
      for (const key of allowed) {
        if (req.body[key] !== undefined) (updates as any)[key] = req.body[key];
      }
      updates.updatedAt = new Date();
      const [lead] = await db.update(leads).set(updates).where(eq(leads.id, id)).returning();
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      res.json({ lead });
    } catch (error: any) {
      console.error("Update lead error:", error);
      res.status(500).json({ error: error.message || "Failed to update lead" });
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

  const httpServer = createServer(app);

  return httpServer;
}
