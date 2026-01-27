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
  clients,
  jobs,
  invoices,
  payments,
  type User,
  type InsertUser,
  type Home,
  type InsertHome,
  type Provider,
  type InsertProvider,
  type ServiceCategory,
  type Service,
  type Appointment,
  type InsertAppointment,
  type Notification,
  type Client,
  type InsertClient,
  type Job,
  type InsertJob,
  type Invoice,
  type InsertInvoice,
  type Payment,
  type InsertPayment,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
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
      
      // Deduplicate provider IDs
      const uniqueIds = [...new Set(providerIds.map(p => p.providerId))];
      const results: Provider[] = [];
      for (const id of uniqueIds) {
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

  // Provider methods
  async createProvider(provider: InsertProvider): Promise<Provider> {
    const [newProvider] = await db.insert(providers).values(provider).returning();
    return newProvider;
  }

  async getProviderByUserId(userId: string): Promise<Provider | undefined> {
    const [provider] = await db.select().from(providers).where(eq(providers.userId, userId));
    return provider || undefined;
  }

  async updateProvider(id: string, data: Partial<Provider>): Promise<Provider | undefined> {
    const [provider] = await db.update(providers).set(data).where(eq(providers.id, id)).returning();
    return provider || undefined;
  }

  // Client methods
  async getClients(providerId: string): Promise<Client[]> {
    return db.select().from(clients).where(eq(clients.providerId, providerId)).orderBy(desc(clients.createdAt));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(id: string, data: Partial<Client>): Promise<Client | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [client] = await db.update(clients).set(updateData).where(eq(clients.id, id)).returning();
    return client || undefined;
  }

  async deleteClient(id: string): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id)).returning();
    return result.length > 0;
  }

  // Job methods
  async getJobs(providerId: string): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.providerId, providerId)).orderBy(desc(jobs.scheduledDate));
  }

  async getJobsByClient(clientId: string): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.clientId, clientId)).orderBy(desc(jobs.scheduledDate));
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job || undefined;
  }

  async createJob(job: InsertJob): Promise<Job> {
    const [newJob] = await db.insert(jobs).values(job).returning();
    return newJob;
  }

  async updateJob(id: string, data: Partial<Job>): Promise<Job | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [job] = await db.update(jobs).set(updateData).where(eq(jobs.id, id)).returning();
    return job || undefined;
  }

  async completeJob(id: string, finalPrice?: string): Promise<Job | undefined> {
    const updateData: Partial<Job> = {
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    };
    if (finalPrice) updateData.finalPrice = finalPrice;
    const [job] = await db.update(jobs).set(updateData).where(eq(jobs.id, id)).returning();
    return job || undefined;
  }

  async deleteJob(id: string): Promise<boolean> {
    const result = await db.delete(jobs).where(eq(jobs.id, id)).returning();
    return result.length > 0;
  }

  // Invoice methods
  async getInvoices(providerId: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.providerId, providerId)).orderBy(desc(invoices.createdAt));
  }

  async getInvoicesByClient(clientId: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.clientId, clientId)).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();
    return newInvoice;
  }

  async updateInvoice(id: string, data: Partial<Invoice>): Promise<Invoice | undefined> {
    const [invoice] = await db.update(invoices).set(data).where(eq(invoices.id, id)).returning();
    return invoice || undefined;
  }

  async sendInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db
      .update(invoices)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return invoice || undefined;
  }

  async markInvoicePaid(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db
      .update(invoices)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return invoice || undefined;
  }

  async cancelInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db
      .update(invoices)
      .set({ status: "cancelled" })
      .where(eq(invoices.id, id))
      .returning();
    return invoice || undefined;
  }

  // Payment methods
  async getPayments(providerId: string): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.providerId, providerId)).orderBy(desc(payments.createdAt));
  }

  async getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.invoiceId, invoiceId));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    // Also mark invoice as paid
    await this.markInvoicePaid(payment.invoiceId);
    return newPayment;
  }

  // Provider dashboard stats
  async getProviderStats(providerId: string): Promise<{
    revenueMTD: number;
    jobsCompleted: number;
    activeClients: number;
    upcomingJobs: number;
  }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Revenue MTD - sum of paid invoices this month
    const paidInvoices = await db
      .select({ total: invoices.total })
      .from(invoices)
      .where(
        and(
          eq(invoices.providerId, providerId),
          eq(invoices.status, "paid"),
          gte(invoices.paidAt, startOfMonth)
        )
      );
    const revenueMTD = paidInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || "0"), 0);

    // Jobs completed this month
    const completedJobs = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.providerId, providerId),
          eq(jobs.status, "completed"),
          gte(jobs.completedAt, startOfMonth)
        )
      );
    const jobsCompleted = completedJobs.length;

    // Active clients (clients with at least one job)
    const clientList = await this.getClients(providerId);
    const activeClients = clientList.length;

    // Upcoming jobs (scheduled in the future)
    const now = new Date();
    const upcomingJobsList = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.providerId, providerId),
          eq(jobs.status, "scheduled"),
          gte(jobs.scheduledDate, now)
        )
      );
    const upcomingJobs = upcomingJobsList.length;

    return { revenueMTD, jobsCompleted, activeClients, upcomingJobs };
  }

  // Get next invoice number
  async getNextInvoiceNumber(providerId: string): Promise<string> {
    const existingInvoices = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.providerId, providerId));
    const nextNum = existingInvoices.length + 1;
    return `INV-${String(nextNum).padStart(4, "0")}`;
  }
}

export const storage = new DatabaseStorage();
