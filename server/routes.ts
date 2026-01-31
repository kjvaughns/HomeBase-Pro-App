import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { openai, HOMEBASE_SYSTEM_PROMPT, PROVIDER_ASSISTANT_PROMPT } from "./openai";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import { insertUserSchema, loginSchema, insertHomeSchema, insertAppointmentSchema, insertProviderSchema, insertClientSchema, insertJobSchema, insertInvoiceSchema, insertPaymentSchema } from "@shared/schema";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { db } from "./db";
import { sql, eq } from "drizzle-orm";
import { appointments, maintenanceReminders, homes } from "@shared/schema";
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
} from "@shared/schema";

interface IdParams { id: string; }
interface UserIdParams { userId: string; }

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

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
      res.status(201).json({ user: formatUserResponse(user) });
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

      res.json({ user: formatUserResponse(user), providerProfile });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  app.get("/api/user/:id", async (req: Request<IdParams>, res: Response) => {
    try {
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

  app.put("/api/user/:id", async (req: Request<IdParams>, res: Response) => {
    try {
      const { name, ...restBody } = req.body;
      const nameFields = name ? parseUserName(name) : {};
      const updateData = { ...restBody, ...nameFields };
      
      const user = await storage.updateUser(req.params.id, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ user: formatUserResponse(user) });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.get("/api/homes/:userId", async (req: Request<UserIdParams>, res: Response) => {
    try {
      const homes = await storage.getHomes(req.params.userId);
      res.json({ homes: homes.map(formatHomeResponse) });
    } catch (error) {
      console.error("Get homes error:", error);
      res.status(500).json({ error: "Failed to get homes" });
    }
  });

  app.post("/api/homes", async (req: Request, res: Response) => {
    try {
      const { nickname, address, zipCode, label, street, zip, ...rest } = req.body;
      const homeData = {
        ...rest,
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

  app.put("/api/homes/:id", async (req: Request<IdParams>, res: Response) => {
    try {
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

  app.delete("/api/homes/:id", async (req: Request<IdParams>, res: Response) => {
    try {
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
  app.get("/api/housefax/autocomplete", async (req: Request, res: Response) => {
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
  app.get("/api/housefax/place/:placeId", async (req: Request<{ placeId: string }>, res: Response) => {
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
  app.post("/api/housefax/geocode", async (req: Request, res: Response) => {
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
  app.post("/api/housefax/zillow", async (req: Request, res: Response) => {
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
  app.post("/api/housefax/enrich", async (req: Request, res: Response) => {
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
  app.post("/api/homes/:id/enrich", async (req: Request<IdParams>, res: Response) => {
    try {
      const home = await storage.getHome(req.params.id);
      if (!home) {
        return res.status(404).json({ error: "Home not found" });
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
  app.get("/api/homes/:id/housefax-context", async (req: Request<IdParams>, res: Response) => {
    try {
      const home = await storage.getHome(req.params.id);
      if (!home) {
        return res.status(404).json({ error: "Home not found" });
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

  app.get("/api/appointments/:userId", async (req: Request<UserIdParams>, res: Response) => {
    try {
      const appointments = await storage.getAppointments(req.params.userId);
      res.json({ appointments });
    } catch (error) {
      console.error("Get appointments error:", error);
      res.status(500).json({ error: "Failed to get appointments" });
    }
  });

  app.get("/api/appointment/:id", async (req: Request<IdParams>, res: Response) => {
    try {
      const appointment = await storage.getAppointment(req.params.id);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
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

  app.post("/api/appointments", async (req: Request, res: Response) => {
    try {
      const parsed = insertAppointmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }
      const appointment = await storage.createAppointment(parsed.data);
      
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

  app.put("/api/appointments/:id", async (req: Request<IdParams>, res: Response) => {
    try {
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

  app.post("/api/appointments/:id/cancel", async (req: Request<IdParams>, res: Response) => {
    try {
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

  app.post("/api/appointments/:id/reschedule", async (req: Request<IdParams>, res: Response) => {
    try {
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

  app.get("/api/appointments/:id", async (req: Request<IdParams>, res: Response) => {
    try {
      const appointment = await storage.getAppointment(req.params.id);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      res.json({ appointment });
    } catch (error) {
      console.error("Get appointment error:", error);
      res.status(500).json({ error: "Failed to get appointment" });
    }
  });

  app.get("/api/notifications/:userId", async (req: Request<UserIdParams>, res: Response) => {
    try {
      const notifications = await storage.getNotifications(req.params.userId);
      res.json({ notifications });
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  app.post("/api/notifications/:id/read", async (req: Request<IdParams>, res: Response) => {
    try {
      await storage.markNotificationRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.post("/api/chat", async (req: Request, res: Response) => {
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

  app.post("/api/chat/simple", async (req: Request, res: Response) => {
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

  app.post("/api/ai/provider-assistant", async (req: Request, res: Response) => {
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

  app.post("/api/ai/pricing-assistant", async (req: Request, res: Response) => {
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

  // ============ SERVICE BUILDER ROUTES ============

  const SERVICE_BUILDER_PROMPT = `You are HomeBase's AI Service Builder assistant. Help service providers create optimized, professional service listings.

Industry-specific pricing models:
- HVAC: Service call fee + hourly labor + parts markup. Typical: $79-149 service call, $85-150/hour labor
- Plumbing: Service call + hourly OR flat rate for common jobs. Typical: $75-125/hour, drain cleaning $150-300
- Electrical: Hourly with minimum call fee. Typical: $80-120/hour, 1-2 hour minimum
- Cleaning: Hourly OR per square foot OR flat rate packages. Typical: $25-50/hour, $0.10-0.25/sqft
- Landscaping: Per visit, per acre, or subscription/package. Typical: mowing $30-80/visit
- Handyman: Hourly with minimum. Typical: $50-100/hour, 2-hour minimum
- Painting: Per room, per sqft, or project quote. Typical: $300-800/room, $2-6/sqft
- Roofing: Per square (100 sqft) or project-based. Typical: $300-700/square

Always respond with valid JSON containing:
- message: Your conversational response text
- nextStep: "type" | "name" | "pricing" | "details" | "review"
- options: array of {id, label, description, icon} if showing choices (optional)
- showInput: boolean if text input needed (optional)
- inputType: "text" | "price" | "select" (optional)
- serviceDraft: partial service object to update (optional)

Be encouraging and professional. Use industry knowledge to suggest optimal pricing and descriptions.`;

  app.post("/api/service-builder/next", async (req: Request, res: Response) => {
    try {
      const { step, input, serviceDraft } = req.body;

      const businessType = serviceDraft?.businessType || input;
      let responseData;

      if (step === "type") {
        const pricingOptions = getPricingOptionsForType(businessType);
        responseData = {
          message: `Great choice! ${getBusinessTypeIntro(businessType)} Let's set up your first service. What would you like to call it?`,
          nextStep: "name",
          showInput: true,
          inputType: "text",
        };
      } else if (step === "name") {
        const pricingOptions = getPricingOptionsForType(serviceDraft?.businessType || "general");
        responseData = {
          message: `"${input}" - nice! Now let's set your pricing. Based on ${getBusinessTypeName(serviceDraft?.businessType)} industry standards, here are the most effective pricing models:`,
          nextStep: "pricing",
          options: pricingOptions,
          serviceDraft: { serviceName: input },
        };
      } else if (step === "pricing") {
        const pricingInfo = getPricingDefaults(serviceDraft?.businessType, input);
        const description = generateServiceDescription(serviceDraft?.serviceName, serviceDraft?.businessType, input);
        
        responseData = {
          message: `Perfect! I've set up ${pricingInfo.label} pricing for you. Based on market rates for ${getBusinessTypeName(serviceDraft?.businessType)}, I recommend starting at ${pricingInfo.suggestedPrice}. Here's a professional description I created for your service:`,
          nextStep: "review",
          serviceDraft: { 
            pricingModel: input, 
            basePrice: pricingInfo.defaultPrice,
            priceUnit: pricingInfo.unit,
            description: description,
          },
        };
      } else {
        responseData = {
          message: "Your service is ready to publish!",
          nextStep: "review",
        };
      }

      res.json(responseData);
    } catch (error) {
      console.error("Service builder error:", error);
      res.status(500).json({ error: "Failed to process service builder request" });
    }
  });

  function getBusinessTypeIntro(type: string): string {
    const intros: Record<string, string> = {
      hvac: "HVAC is a high-demand field with great earning potential.",
      plumbing: "Plumbing services are always in demand, especially for emergencies.",
      electrical: "Electrical work commands premium rates due to licensing requirements.",
      cleaning: "Cleaning services offer flexible scheduling and recurring revenue.",
      landscaping: "Lawn care is perfect for building subscription-based income.",
      handyman: "Handyman services are versatile and always needed.",
      painting: "Painting projects offer great margins on labor.",
      roofing: "Roofing is seasonal but highly profitable per project.",
    };
    return intros[type] || "Home services are always in demand.";
  }

  function getBusinessTypeName(type: string): string {
    const names: Record<string, string> = {
      hvac: "HVAC",
      plumbing: "plumbing",
      electrical: "electrical",
      cleaning: "cleaning",
      landscaping: "landscaping",
      handyman: "handyman",
      painting: "painting",
      roofing: "roofing",
    };
    return names[type] || "home services";
  }

  function getPricingOptionsForType(type: string) {
    const options: Record<string, Array<{id: string; label: string; description: string; icon: string}>> = {
      hvac: [
        { id: "service_call", label: "Service Call + Hourly", description: "Diagnostic fee plus labor rate", icon: "clock" },
        { id: "flat", label: "Flat Rate", description: "Fixed price per job type", icon: "tag" },
      ],
      plumbing: [
        { id: "hourly", label: "Hourly Rate", description: "Charge by the hour", icon: "clock" },
        { id: "flat", label: "Flat Rate", description: "Fixed price for common jobs", icon: "tag" },
        { id: "service_call", label: "Service Call + Labor", description: "Call fee plus hourly", icon: "phone" },
      ],
      electrical: [
        { id: "hourly", label: "Hourly Rate", description: "Standard hourly billing", icon: "clock" },
        { id: "flat", label: "Flat Rate", description: "Per-project pricing", icon: "tag" },
      ],
      cleaning: [
        { id: "hourly", label: "Hourly Rate", description: "Great for deep cleans", icon: "clock" },
        { id: "per_sqft", label: "Per Square Foot", description: "Scale with home size", icon: "maximize" },
        { id: "flat", label: "Package Rate", description: "Fixed weekly/monthly packages", icon: "package" },
      ],
      landscaping: [
        { id: "flat", label: "Per Visit", description: "Fixed price each visit", icon: "calendar" },
        { id: "subscription", label: "Monthly Subscription", description: "Recurring revenue", icon: "repeat" },
      ],
      handyman: [
        { id: "hourly", label: "Hourly Rate", description: "Flexible for varied tasks", icon: "clock" },
        { id: "flat", label: "Per Job", description: "Quote per project", icon: "clipboard" },
      ],
      painting: [
        { id: "per_sqft", label: "Per Square Foot", description: "Industry standard", icon: "maximize" },
        { id: "flat", label: "Per Room", description: "Easy for clients", icon: "home" },
      ],
      roofing: [
        { id: "per_sqft", label: "Per Square", description: "Per 100 sq ft roofing", icon: "triangle" },
        { id: "flat", label: "Project Quote", description: "Custom per job", icon: "file-text" },
      ],
    };
    return options[type] || [
      { id: "hourly", label: "Hourly Rate", description: "Charge by the hour", icon: "clock" },
      { id: "flat", label: "Flat Rate", description: "Fixed price per job", icon: "tag" },
    ];
  }

  function getPricingDefaults(businessType: string, pricingModel: string) {
    const defaults: Record<string, Record<string, {defaultPrice: number; unit: string; label: string; suggestedPrice: string}>> = {
      hvac: {
        service_call: { defaultPrice: 89, unit: "service call", label: "service call + hourly", suggestedPrice: "$89 service call + $95/hour" },
        flat: { defaultPrice: 150, unit: "job", label: "flat rate", suggestedPrice: "$150-400 per job type" },
        hourly: { defaultPrice: 95, unit: "hour", label: "hourly", suggestedPrice: "$85-120/hour" },
      },
      plumbing: {
        hourly: { defaultPrice: 95, unit: "hour", label: "hourly", suggestedPrice: "$85-125/hour" },
        flat: { defaultPrice: 175, unit: "job", label: "flat rate", suggestedPrice: "$175-350 for common jobs" },
        service_call: { defaultPrice: 75, unit: "service call", label: "service call", suggestedPrice: "$75 call fee + $90/hour" },
      },
      electrical: {
        hourly: { defaultPrice: 100, unit: "hour", label: "hourly", suggestedPrice: "$90-130/hour" },
        flat: { defaultPrice: 200, unit: "job", label: "flat rate", suggestedPrice: "$150-500 per project" },
      },
      cleaning: {
        hourly: { defaultPrice: 35, unit: "hour", label: "hourly", suggestedPrice: "$30-50/hour" },
        per_sqft: { defaultPrice: 0.15, unit: "sq ft", label: "per square foot", suggestedPrice: "$0.10-0.25/sq ft" },
        flat: { defaultPrice: 150, unit: "visit", label: "package", suggestedPrice: "$120-200 per visit" },
      },
      landscaping: {
        flat: { defaultPrice: 50, unit: "visit", label: "per visit", suggestedPrice: "$40-80 per visit" },
        subscription: { defaultPrice: 150, unit: "month", label: "monthly", suggestedPrice: "$125-200/month" },
      },
      handyman: {
        hourly: { defaultPrice: 65, unit: "hour", label: "hourly", suggestedPrice: "$55-85/hour" },
        flat: { defaultPrice: 150, unit: "job", label: "per job", suggestedPrice: "$100-300 per project" },
      },
      painting: {
        per_sqft: { defaultPrice: 3.5, unit: "sq ft", label: "per square foot", suggestedPrice: "$2.50-5.00/sq ft" },
        flat: { defaultPrice: 400, unit: "room", label: "per room", suggestedPrice: "$300-600 per room" },
      },
      roofing: {
        per_sqft: { defaultPrice: 450, unit: "square", label: "per square", suggestedPrice: "$350-600 per square" },
        flat: { defaultPrice: 5000, unit: "project", label: "project", suggestedPrice: "$4,000-12,000 per project" },
      },
    };

    return defaults[businessType]?.[pricingModel] || { defaultPrice: 75, unit: "hour", label: "standard", suggestedPrice: "$50-100/hour" };
  }

  function generateServiceDescription(serviceName: string, businessType: string, pricingModel: string): string {
    const templates: Record<string, string> = {
      hvac: `Professional ${serviceName || "HVAC service"} with fast response times. Licensed and insured technicians provide quality workmanship on all heating, cooling, and ventilation systems. Same-day appointments available for urgent issues.`,
      plumbing: `Expert ${serviceName || "plumbing service"} for residential and commercial properties. From minor repairs to major installations, we deliver reliable solutions. Available for emergency calls 24/7.`,
      electrical: `Licensed ${serviceName || "electrical service"} ensuring safety and code compliance. Experienced electricians handle everything from outlet repairs to panel upgrades. Free estimates provided.`,
      cleaning: `Thorough ${serviceName || "cleaning service"} that leaves your space spotless. We use eco-friendly products and pay attention to every detail. Flexible scheduling to fit your needs.`,
      landscaping: `Professional ${serviceName || "lawn care"} to keep your outdoor space beautiful. Regular maintenance, seasonal cleanup, and custom landscaping solutions. Reliable weekly service available.`,
      handyman: `Versatile ${serviceName || "handyman service"} for all your home repair needs. No job too small. From quick fixes to weekend projects, we get it done right the first time.`,
      painting: `Quality ${serviceName || "painting service"} with meticulous prep work and clean lines. Premium paints, professional results. Interior and exterior work with color consultation included.`,
      roofing: `Trusted ${serviceName || "roofing service"} protecting your home from the elements. Expert repairs, replacements, and inspections. Comprehensive warranties on all work performed.`,
    };
    return templates[businessType] || `Professional ${serviceName || "service"} delivered with expertise and care. Quality workmanship guaranteed.`;
  }

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

  app.post("/api/intake/analyze", async (req: Request, res: Response) => {
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

  app.post("/api/intake/refine", async (req: Request, res: Response) => {
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

  app.post("/api/intake/match-providers", async (req: Request, res: Response) => {
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

  app.post("/api/intake/explain-issue", async (req: Request, res: Response) => {
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
  app.get("/api/homes/:homeId/service-history", async (req: Request<{ homeId: string }>, res: Response) => {
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
  app.get("/api/homes/:homeId/reminders", async (req: Request<{ homeId: string }>, res: Response) => {
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
  app.post("/api/homes/:homeId/reminders", async (req: Request<{ homeId: string }>, res: Response) => {
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
  app.put("/api/reminders/:id/complete", async (req: Request<{ id: string }>, res: Response) => {
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

  // ============ PROVIDER PORTAL ROUTES ============

  // Provider registration/onboarding
  app.post("/api/provider/register", async (req: Request, res: Response) => {
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
  app.get("/api/provider/user/:userId", async (req: Request<UserIdParams>, res: Response) => {
    try {
      const provider = await storage.getProviderByUserId(req.params.userId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }
      res.json({ provider });
    } catch (error) {
      console.error("Get provider error:", error);
      res.status(500).json({ error: "Failed to get provider" });
    }
  });

  // Update provider profile
  app.put("/api/provider/:id", async (req: Request<IdParams>, res: Response) => {
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

  // Provider dashboard stats
  app.get("/api/provider/:id/stats", async (req: Request<IdParams>, res: Response) => {
    try {
      const stats = await storage.getProviderStats(req.params.id);
      res.json({ stats });
    } catch (error) {
      console.error("Get provider stats error:", error);
      res.status(500).json({ error: "Failed to get provider stats" });
    }
  });

  // ============ CLIENTS ROUTES ============

  interface ProviderIdParams { providerId: string; }

  app.get("/api/provider/:providerId/clients", async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      const clients = await storage.getClients(req.params.providerId);
      res.json({ clients });
    } catch (error) {
      console.error("Get clients error:", error);
      res.status(500).json({ error: "Failed to get clients" });
    }
  });

  app.get("/api/clients/:id", async (req: Request<IdParams>, res: Response) => {
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

  app.post("/api/clients", async (req: Request, res: Response) => {
    try {
      const parsed = insertClientSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }
      const client = await storage.createClient(parsed.data);
      res.status(201).json({ client });
    } catch (error) {
      console.error("Create client error:", error);
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.put("/api/clients/:id", async (req: Request<IdParams>, res: Response) => {
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

  app.delete("/api/clients/:id", async (req: Request<IdParams>, res: Response) => {
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

  app.get("/api/provider/:providerId/jobs", async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      const jobs = await storage.getJobs(req.params.providerId);
      res.json({ jobs });
    } catch (error) {
      console.error("Get jobs error:", error);
      res.status(500).json({ error: "Failed to get jobs" });
    }
  });

  app.get("/api/jobs/:id", async (req: Request<IdParams>, res: Response) => {
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

  app.post("/api/jobs", async (req: Request, res: Response) => {
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

  app.put("/api/jobs/:id", async (req: Request<IdParams>, res: Response) => {
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

  app.post("/api/jobs/:id/complete", async (req: Request<IdParams>, res: Response) => {
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

  app.post("/api/jobs/:id/start", async (req: Request<IdParams>, res: Response) => {
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

  app.delete("/api/jobs/:id", async (req: Request<IdParams>, res: Response) => {
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

  app.get("/api/provider/:providerId/invoices", async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      const invoices = await storage.getInvoices(req.params.providerId);
      res.json({ invoices });
    } catch (error) {
      console.error("Get invoices error:", error);
      res.status(500).json({ error: "Failed to get invoices" });
    }
  });

  app.get("/api/invoices/:id", async (req: Request<IdParams>, res: Response) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const payments = await storage.getPaymentsByInvoice(req.params.id);
      res.json({ invoice, payments });
    } catch (error) {
      console.error("Get invoice error:", error);
      res.status(500).json({ error: "Failed to get invoice" });
    }
  });

  app.get("/api/provider/:providerId/next-invoice-number", async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      const invoiceNumber = await storage.getNextInvoiceNumber(req.params.providerId);
      res.json({ invoiceNumber });
    } catch (error) {
      console.error("Get next invoice number error:", error);
      res.status(500).json({ error: "Failed to get invoice number" });
    }
  });

  app.post("/api/invoices", async (req: Request, res: Response) => {
    try {
      // Convert dueDate string to Date
      const invoiceData = {
        ...req.body,
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

  app.put("/api/invoices/:id", async (req: Request<IdParams>, res: Response) => {
    try {
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

  app.post("/api/invoices/:id/send", async (req: Request<IdParams>, res: Response) => {
    try {
      const invoice = await storage.sendInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json({ invoice });
    } catch (error) {
      console.error("Send invoice error:", error);
      res.status(500).json({ error: "Failed to send invoice" });
    }
  });

  app.post("/api/invoices/:id/mark-paid", async (req: Request<IdParams>, res: Response) => {
    try {
      const invoice = await storage.markInvoicePaid(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json({ invoice });
    } catch (error) {
      console.error("Mark invoice paid error:", error);
      res.status(500).json({ error: "Failed to mark invoice as paid" });
    }
  });

  app.post("/api/invoices/:id/cancel", async (req: Request<IdParams>, res: Response) => {
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

  app.get("/api/provider/:providerId/payments", async (req: Request<ProviderIdParams>, res: Response) => {
    try {
      const payments = await storage.getPayments(req.params.providerId);
      res.json({ payments });
    } catch (error) {
      console.error("Get payments error:", error);
      res.status(500).json({ error: "Failed to get payments" });
    }
  });

  app.post("/api/payments", async (req: Request, res: Response) => {
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

  app.post("/api/stripe/create-payment-intent", async (req: Request, res: Response) => {
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

  app.post("/api/stripe/create-customer", async (req: Request, res: Response) => {
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

  app.post("/api/stripe/create-checkout-session", async (req: Request, res: Response) => {
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

  app.post("/api/stripe/customer-portal", async (req: Request, res: Response) => {
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
  app.post("/api/stripe/connect/onboard/:providerId", async (req: Request<{ providerId: string }>, res: Response) => {
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
  app.post("/api/stripe/connect/refresh-link/:providerId", async (req: Request<{ providerId: string }>, res: Response) => {
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
  app.post("/api/stripe/invoices", async (req: Request, res: Response) => {
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
  app.get("/api/stripe/invoices", async (req: Request, res: Response) => {
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
  app.post("/api/stripe/invoices/:invoiceId/send", async (req: Request<{ invoiceId: string }>, res: Response) => {
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
  app.post("/api/stripe/invoices/:invoiceId/checkout", async (req: Request<{ invoiceId: string }>, res: Response) => {
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
  app.post("/api/stripe/invoices/:invoiceId/apply-credits", async (req: Request<{ invoiceId: string }>, res: Response) => {
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
  app.post("/api/connect/account-link", async (req: Request, res: Response) => {
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
  app.post("/api/connect/refresh-link", async (req: Request, res: Response) => {
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
  app.post("/api/providers/:providerId/plan", async (req: Request<{ providerId: string }>, res: Response) => {
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
  app.get("/api/providers/:providerId/plan", async (req: Request<{ providerId: string }>, res: Response) => {
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
  app.post("/api/connect/fee-preview", async (req: Request, res: Response) => {
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
  app.post("/api/invoices/create", async (req: Request, res: Response) => {
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

  // Send invoice (mark as sent and optionally generate payment link)
  app.post("/api/invoices/:invoiceId/send", async (req: Request<{ invoiceId: string }>, res: Response) => {
    try {
      const { invoiceId } = req.params;
      const { deliveryMethod, generatePaymentLink } = req.body;

      let hostedUrl: string | null = null;

      if (generatePaymentLink) {
        const checkoutResult = await createStripeCheckoutSession(invoiceId);
        hostedUrl = checkoutResult.checkoutUrl;
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
      });
    } catch (error: any) {
      console.error("Send invoice error:", error);
      res.status(500).json({ error: error.message || "Failed to send invoice" });
    }
  });

  // Create payment intent for invoice (for in-app payment sheet)
  app.post("/api/invoices/:invoiceId/payment-intent", async (req: Request<{ invoiceId: string }>, res: Response) => {
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
  app.post("/api/invoices/:invoiceId/checkout", async (req: Request<{ invoiceId: string }>, res: Response) => {
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
  app.post("/api/invoices/:invoiceId/apply-credits", async (req: Request<{ invoiceId: string }>, res: Response) => {
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
  app.get("/api/users/:userId/credits", async (req: Request<{ userId: string }>, res: Response) => {
    try {
      const { userId } = req.params;
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
  app.post("/api/users/:userId/credits/add", async (req: Request<{ userId: string }>, res: Response) => {
    try {
      const { userId } = req.params;
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
  app.get("/api/providers/:providerId/payouts", async (req: Request<{ providerId: string }>, res: Response) => {
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

  const httpServer = createServer(app);

  return httpServer;
}
