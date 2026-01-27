import {
  users,
  homes,
  providers,
  services,
  serviceCategories,
  appointments,
  reviews,
  notifications,
  providerServices,
  type User,
  type InsertUser,
  type Home,
  type InsertHome,
  type Provider,
  type ServiceCategory,
  type Service,
  type Appointment,
  type InsertAppointment,
  type Notification,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import { hash, compare } from "bcrypt";

const SALT_ROUNDS = 10;

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  verifyPassword(email: string, password: string): Promise<User | null>;
  
  getHomes(userId: string): Promise<Home[]>;
  getHome(id: string): Promise<Home | undefined>;
  createHome(home: InsertHome): Promise<Home>;
  updateHome(id: string, data: Partial<Home>): Promise<Home | undefined>;
  deleteHome(id: string): Promise<boolean>;
  
  getCategories(): Promise<ServiceCategory[]>;
  getServices(categoryId?: string): Promise<Service[]>;
  
  getProviders(categoryId?: string): Promise<Provider[]>;
  getProvider(id: string): Promise<Provider | undefined>;
  getProviderServices(providerId: string): Promise<Service[]>;
  
  getAppointments(userId: string): Promise<Appointment[]>;
  getAppointment(id: string): Promise<Appointment | undefined>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: string, data: Partial<Appointment>): Promise<Appointment | undefined>;
  cancelAppointment(id: string): Promise<Appointment | undefined>;
  
  getNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(id: string): Promise<void>;
  createNotification(userId: string, title: string, message: string, type: string, data?: string): Promise<Notification>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await hash(insertUser.password, SALT_ROUNDS);
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, password: hashedPassword })
      .returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    if (data.password) {
      updateData.password = await hash(data.password, SALT_ROUNDS);
    }
    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    const valid = await compare(password, user.password);
    return valid ? user : null;
  }

  async getHomes(userId: string): Promise<Home[]> {
    return db.select().from(homes).where(eq(homes.userId, userId)).orderBy(desc(homes.isDefault));
  }

  async getHome(id: string): Promise<Home | undefined> {
    const [home] = await db.select().from(homes).where(eq(homes.id, id));
    return home || undefined;
  }

  async createHome(home: InsertHome): Promise<Home> {
    if (home.isDefault) {
      await db.update(homes).set({ isDefault: false }).where(eq(homes.userId, home.userId));
    }
    const [newHome] = await db.insert(homes).values(home).returning();
    return newHome;
  }

  async updateHome(id: string, data: Partial<Home>): Promise<Home | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [home] = await db.update(homes).set(updateData).where(eq(homes.id, id)).returning();
    return home || undefined;
  }

  async deleteHome(id: string): Promise<boolean> {
    const result = await db.delete(homes).where(eq(homes.id, id)).returning();
    return result.length > 0;
  }

  async getCategories(): Promise<ServiceCategory[]> {
    return db.select().from(serviceCategories).orderBy(serviceCategories.sortOrder);
  }

  async getServices(categoryId?: string): Promise<Service[]> {
    if (categoryId) {
      return db.select().from(services).where(eq(services.categoryId, categoryId));
    }
    return db.select().from(services);
  }

  async getProviders(categoryId?: string): Promise<Provider[]> {
    if (categoryId) {
      const providerIds = await db
        .select({ providerId: providerServices.providerId })
        .from(providerServices)
        .where(eq(providerServices.categoryId, categoryId));
      
      if (providerIds.length === 0) return [];
      
      const ids = providerIds.map(p => p.providerId);
      const results: Provider[] = [];
      for (const id of ids) {
        const [provider] = await db.select().from(providers).where(eq(providers.id, id));
        if (provider && provider.isActive) {
          results.push(provider);
        }
      }
      return results;
    }
    return db.select().from(providers).where(eq(providers.isActive, true));
  }

  async getProvider(id: string): Promise<Provider | undefined> {
    const [provider] = await db.select().from(providers).where(eq(providers.id, id));
    return provider || undefined;
  }

  async getProviderServices(providerId: string): Promise<Service[]> {
    const ps = await db
      .select({ serviceId: providerServices.serviceId })
      .from(providerServices)
      .where(eq(providerServices.providerId, providerId));
    
    const results: Service[] = [];
    for (const { serviceId } of ps) {
      const [service] = await db.select().from(services).where(eq(services.id, serviceId));
      if (service) results.push(service);
    }
    return results;
  }

  async getAppointments(userId: string): Promise<Appointment[]> {
    return db.select().from(appointments).where(eq(appointments.userId, userId)).orderBy(desc(appointments.scheduledDate));
  }

  async getAppointment(id: string): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, id));
    return appointment || undefined;
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const [newAppointment] = await db.insert(appointments).values(appointment).returning();
    return newAppointment;
  }

  async updateAppointment(id: string, data: Partial<Appointment>): Promise<Appointment | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [appointment] = await db.update(appointments).set(updateData).where(eq(appointments.id, id)).returning();
    return appointment || undefined;
  }

  async cancelAppointment(id: string): Promise<Appointment | undefined> {
    const [appointment] = await db
      .update(appointments)
      .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();
    return appointment || undefined;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }

  async markNotificationRead(id: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  async createNotification(userId: string, title: string, message: string, type: string, data?: string): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values({ userId, title, message, type, data })
      .returning();
    return notification;
  }
}

export const storage = new DatabaseStorage();
