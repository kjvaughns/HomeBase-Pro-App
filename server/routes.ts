import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { openai, HOMEBASE_SYSTEM_PROMPT } from "./openai";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import { insertUserSchema, loginSchema, insertHomeSchema, insertAppointmentSchema } from "@shared/schema";

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

      res.json({ user: formatUserResponse(user) });
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
      
      const parsed = insertHomeSchema.safeParse(homeData);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }
      const home = await storage.createHome(parsed.data);
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
      res.json({ appointment });
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
      const { messages } = req.body as { messages: ChatMessage[] };

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      const chatMessages: ChatMessage[] = [
        { role: "system", content: HOMEBASE_SYSTEM_PROMPT },
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

  app.post("/api/chat/simple", async (req: Request, res: Response) => {
    try {
      const { message } = req.body as { message: string };

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: HOMEBASE_SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        max_tokens: 1024,
      });

      const content = response.choices[0]?.message?.content || "";
      res.json({ response: content });
    } catch (error) {
      console.error("Error in simple chat:", error);
      res.status(500).json({ error: "Failed to process chat request" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
