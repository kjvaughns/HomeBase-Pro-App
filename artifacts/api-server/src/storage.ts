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
  providerCustomServices,
  clients,
  jobs,
  invoices,
  estimates,
  estimateLineItems,
  payments,
  bookingLinks,
  intakeSubmissions,
  notificationPreferences,
  crewMembers,
  supportTickets,
  supportTicketMessages,
  adminBroadcasts,
  adminBroadcastRecipients,
  adminAuditLogs,
  providerPlans,
  stripeConnectAccounts,
  userCredits,
  creditLedger,
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
  type Estimate,
  type InsertEstimate,
  type EstimateLineItem,
  type InsertEstimateLineItem,
  type Payment,
  type InsertPayment,
  type BookingLink,
  type InsertBookingLink,
  type IntakeSubmission,
  type InsertIntakeSubmission,
  type NotificationPreference,
  type CrewMember,
  type InsertCrewMember,
  type SupportTicket,
  type SupportTicketMessage,
  type AdminBroadcast,
} from "@workspace/db";
import { db, pool } from "./db";
import { eq, and, or, desc, asc, sql, gte, lte, ilike, inArray, lt, SQL } from "drizzle-orm";
import { getProviderReadinessSet } from "./stripeConnectService";
import { hash, compare } from "bcryptjs";

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
  createAppointment(appointment: InsertAppointment): Promise<{ appointment: Appointment; created: boolean }>;
  updateAppointment(id: string, data: Partial<Appointment>): Promise<Appointment | undefined>;
  cancelAppointment(id: string): Promise<Appointment | undefined>;
  
  getNotifications(userId: string): Promise<Notification[]>;
  getNotification(id: string): Promise<Notification | undefined>;
  markNotificationRead(id: string): Promise<void>;
  createNotification(userId: string, title: string, message: string, type: string, data?: string): Promise<Notification>;

  getNotificationPreferences(userId: string): Promise<NotificationPreference | undefined>;
  upsertNotificationPreferences(userId: string, data: Partial<NotificationPreference>): Promise<NotificationPreference>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      sql`LOWER(${users.email}) = LOWER(${email})`
    );
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
      // Path A: global catalog linkage (provider_services → service_categories)
      const catalogIds = await db
        .select({ providerId: providerServices.providerId })
        .from(providerServices)
        .where(eq(providerServices.categoryId, categoryId));

      // Path B: onboarding-created services (provider_custom_services.category text)
      // Look up the human-readable category name so we can match against the text field.
      const [catRow] = await db
        .select({ name: serviceCategories.name })
        .from(serviceCategories)
        .where(eq(serviceCategories.id, categoryId));

      // Case-insensitive match: onboarding stores slug ("plumbing"), DB name is title-case ("Plumbing")
      const customIds: { providerId: string }[] = catRow
        ? await db
            .select({ providerId: providerCustomServices.providerId })
            .from(providerCustomServices)
            .where(sql`lower(${providerCustomServices.category}) = lower(${catRow.name})`)
        : [];

      // Path C: business name keyword match — catches e.g. "Vaughns Plumbing" when no services exist
      const nameIds: { providerId: string }[] = catRow
        ? await db
            .select({ providerId: providers.id })
            .from(providers)
            .where(
              and(
                sql`lower(${providers.businessName}) like ${'%' + catRow.name.toLowerCase() + '%'}`,
                eq(providers.isActive, true)
              )
            )
        : [];

      // Union all three sets of provider IDs
      const allProviderIds = [
        ...catalogIds.map(r => r.providerId),
        ...customIds.map(r => r.providerId),
        ...nameIds.map(r => r.providerId),
      ];
      if (allProviderIds.length === 0) return [];

      const uniqueIds = [...new Set(allProviderIds)];
      // Bulk-load expired-subscription provider IDs once.
      const expiredRows = await db
        .select({ providerId: providerPlans.providerId })
        .from(providerPlans)
        .where(
          and(
            eq(providerPlans.isSubscribed, false),
            eq(providerPlans.isPartner, false),
            sql`${providerPlans.gracePeriodEndsAt} IS NOT NULL`,
            sql`${providerPlans.gracePeriodEndsAt} < NOW()`,
          ),
        );
      const expiredSet = new Set(expiredRows.map((r) => r.providerId));
      const results: Provider[] = [];
      for (const id of uniqueIds) {
        if (expiredSet.has(id)) continue;
        const [provider] = await db.select().from(providers).where(eq(providers.id, id));
        if (provider && provider.isActive && provider.isPublic && provider.userId) {
          results.push(provider);
        }
      }
      return results;
    }
    // No filter — return only providers that are active, public, and owned by a real user.
    // Also exclude providers whose subscription grace period has expired.
    return db.select().from(providers).where(
      and(
        eq(providers.isActive, true),
        eq(providers.isPublic, true),
        sql`${providers.userId} IS NOT NULL`,
        sql`NOT EXISTS (SELECT 1 FROM provider_plans pp WHERE pp.provider_id = ${providers.id} AND COALESCE(pp.is_subscribed, false) = false AND COALESCE(pp.is_partner, false) = false AND pp.grace_period_ends_at IS NOT NULL AND pp.grace_period_ends_at < NOW())`
      )
    );
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

  async createAppointment(appointment: InsertAppointment): Promise<{ appointment: Appointment; created: boolean }> {
    // Task #226: race-safe idempotency. The DB has a unique partial index
    // appointments_user_provider_slot_unique on (user_id, provider_id,
    // scheduled_date) for non-null user/slot combos. We use a pre-check for
    // the fast path, then attempt an insert with ON CONFLICT DO NOTHING so
    // two concurrent requests can never produce duplicate rows. If the
    // insert is skipped due to conflict, we re-select the winning row.
    if (
      appointment.userId &&
      appointment.providerId &&
      appointment.scheduledDate
    ) {
      const slotFilter = and(
        eq(appointments.userId, appointment.userId),
        eq(appointments.providerId, appointment.providerId),
        eq(appointments.scheduledDate, appointment.scheduledDate as Date),
      );

      // Fast path: existing row already there
      const [existing] = await db
        .select()
        .from(appointments)
        .where(slotFilter)
        .limit(1);
      if (existing) return { appointment: existing, created: false };

      // Race-safe insert: returns [] on conflict, populated on success
      const inserted = await db
        .insert(appointments)
        .values(appointment)
        .onConflictDoNothing()
        .returning();
      if (inserted[0]) return { appointment: inserted[0], created: true };

      // Conflict happened between the SELECT and INSERT — another request
      // created the same slot. Re-select the winner.
      const [winner] = await db
        .select()
        .from(appointments)
        .where(slotFilter)
        .limit(1);
      if (winner) return { appointment: winner, created: false };
      throw new Error(
        "createAppointment: insert skipped on conflict but no existing row found",
      );
    }

    const [newAppointment] = await db.insert(appointments).values(appointment).returning();
    return { appointment: newAppointment, created: true };
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

  async getNotification(id: string): Promise<Notification | undefined> {
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification;
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

  // Crew member methods (Task #302)
  async getCrewMembers(providerId: string): Promise<CrewMember[]> {
    return db
      .select()
      .from(crewMembers)
      .where(eq(crewMembers.providerId, providerId))
      .orderBy(desc(crewMembers.createdAt));
  }

  async getCrewMember(id: string): Promise<CrewMember | undefined> {
    const [member] = await db
      .select()
      .from(crewMembers)
      .where(eq(crewMembers.id, id));
    return member || undefined;
  }

  async createCrewMember(member: InsertCrewMember): Promise<CrewMember> {
    const [newMember] = await db.insert(crewMembers).values(member).returning();
    return newMember;
  }

  async updateCrewMember(
    id: string,
    data: Partial<CrewMember>,
  ): Promise<CrewMember | undefined> {
    const [member] = await db
      .update(crewMembers)
      .set(data)
      .where(eq(crewMembers.id, id))
      .returning();
    return member || undefined;
  }

  async deleteCrewMember(id: string): Promise<boolean> {
    const result = await db
      .delete(crewMembers)
      .where(eq(crewMembers.id, id))
      .returning();
    return result.length > 0;
  }

  async countJobsAssignedToCrewMember(id: string): Promise<number> {
    const rows = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.assignedCrewMemberId, id));
    return rows.length;
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
    return db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId))
      .orderBy(desc(payments.receivedAt));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    // Also mark invoice as paid (legacy stripe path)
    await this.markInvoicePaid(payment.invoiceId);
    return newPayment;
  }

  // ── Task #295: manual (cash/check/other) payment helpers ──────────────
  // The plain `createPayment` above auto-marks the invoice as fully paid,
  // which is correct for Stripe webhook upserts (one payment == full
  // settlement). Manual payments support partial collection, so we
  // recompute status from the sum of non-voided rows instead.

  async recomputeInvoiceStatusFromPayments(invoiceId: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!invoice) return undefined;
    // void / cancelled / refunded invoices should not auto-flip back.
    if (
      invoice.status === "void" ||
      invoice.status === "cancelled" ||
      invoice.status === "refunded"
    ) {
      return invoice;
    }

    const rows = await db
      .select({ amountCents: payments.amountCents })
      .from(payments)
      .where(and(eq(payments.invoiceId, invoiceId), sql`${payments.voidedAt} IS NULL`));
    const collectedCents = rows.reduce((sum, r) => sum + (r.amountCents ?? 0), 0);
    const totalCents = invoice.totalCents ?? 0;

    let nextStatus: Invoice["status"] = invoice.status;
    let nextPaidAt: Date | null = invoice.paidAt ?? null;
    if (totalCents > 0 && collectedCents >= totalCents) {
      nextStatus = "paid";
      nextPaidAt = invoice.paidAt ?? new Date();
    } else if (collectedCents > 0) {
      nextStatus = "partially_paid";
      nextPaidAt = null;
    } else {
      // No payments left (e.g. all voided) — revert to sent or draft.
      nextStatus = invoice.sentAt ? "sent" : "draft";
      nextPaidAt = null;
    }

    if (nextStatus === invoice.status && nextPaidAt === invoice.paidAt) {
      return invoice;
    }
    const [updated] = await db
      .update(invoices)
      .set({ status: nextStatus, paidAt: nextPaidAt })
      .where(eq(invoices.id, invoiceId))
      .returning();
    return updated;
  }

  async createManualPayment(payment: InsertPayment): Promise<Payment> {
    const [row] = await db.insert(payments).values(payment).returning();
    await this.recomputeInvoiceStatusFromPayments(payment.invoiceId);
    return row;
  }

  async updateManualPayment(
    id: string,
    patch: Partial<Pick<Payment, "amountCents" | "method" | "receivedAt" | "reference" | "notes" | "photoUrl">>,
  ): Promise<Payment | undefined> {
    const [row] = await db.update(payments).set(patch).where(eq(payments.id, id)).returning();
    if (row) await this.recomputeInvoiceStatusFromPayments(row.invoiceId);
    return row || undefined;
  }

  async voidPayment(id: string, voidedBy: string): Promise<Payment | undefined> {
    const [row] = await db
      .update(payments)
      .set({ voidedAt: new Date(), voidedBy, status: "refunded" })
      .where(eq(payments.id, id))
      .returning();
    if (row) await this.recomputeInvoiceStatusFromPayments(row.invoiceId);
    return row || undefined;
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const [row] = await db.select().from(payments).where(eq(payments.id, id));
    return row || undefined;
  }

  async getManualPayments(providerId: string): Promise<Payment[]> {
    // Excludes Stripe (those are tracked via the Stripe payouts feed).
    return db
      .select()
      .from(payments)
      .where(and(eq(payments.providerId, providerId), sql`${payments.method} <> 'stripe'`))
      .orderBy(desc(payments.receivedAt));
  }

  // Provider dashboard stats
  async getProviderStats(
    providerId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    revenueMTD: number;
    jobsCompleted: number;
    activeClients: number;
    upcomingJobs: number;
    averageJobValue: number;
    revenueByPeriod: { label: string; value: number }[];
  }> {
    const start = startDate ?? (() => {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    })();
    const end = endDate ?? new Date();

    // Revenue for the period - sum of paid invoices
    const paidInvoices = await db
      .select({ total: invoices.total, paidAt: invoices.paidAt })
      .from(invoices)
      .where(
        and(
          eq(invoices.providerId, providerId),
          eq(invoices.status, "paid"),
          gte(invoices.paidAt, start),
          lte(invoices.paidAt, end)
        )
      );
    const revenueMTD = paidInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || "0"), 0);
    const averageJobValue = paidInvoices.length > 0 ? revenueMTD / paidInvoices.length : 0;

    // Build revenue breakdown by period (weekly buckets within the range)
    const diffMs = end.getTime() - start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const bucketCount = diffDays <= 7 ? 7 : diffDays <= 31 ? Math.ceil(diffDays / 7) : diffDays <= 92 ? 13 : 12;
    const bucketSizeMs = diffMs / bucketCount;

    const revenueByPeriod: { label: string; value: number }[] = [];
    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = new Date(start.getTime() + i * bucketSizeMs);
      const bucketEnd = new Date(start.getTime() + (i + 1) * bucketSizeMs);
      const bucketRevenue = paidInvoices
        .filter((inv) => {
          if (!inv.paidAt) return false;
          const t = new Date(inv.paidAt).getTime();
          return t >= bucketStart.getTime() && t < bucketEnd.getTime();
        })
        .reduce((sum, inv) => sum + parseFloat(inv.total || "0"), 0);

      let label: string;
      if (diffDays <= 7) {
        label = bucketStart.toLocaleDateString("en-US", { weekday: "short" });
      } else if (diffDays <= 31) {
        label = bucketStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      } else if (diffDays <= 92) {
        label = `W${i + 1}`;
      } else {
        label = bucketStart.toLocaleDateString("en-US", { month: "short" });
      }
      revenueByPeriod.push({ label, value: bucketRevenue });
    }

    // Jobs completed in the period
    const completedJobs = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.providerId, providerId),
          eq(jobs.status, "completed"),
          gte(jobs.completedAt, start),
          lte(jobs.completedAt, end)
        )
      );
    const jobsCompleted = completedJobs.length;

    // Active clients (clients with at least one job)
    const clientList = await this.getClients(providerId);
    const activeClients = clientList.length;

    // Upcoming jobs: future-dated scheduled OR any in-progress (active work).
    // Mirrors client/lib/jobUtils.ts isUpcomingJob so the Provider Home tile,
    // the upcoming list, and downstream consumers (Money/Financials/AI) agree.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    // weather_held jobs are paused: excluded from "upcoming" until restored.
    const upcomingJobsList = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.providerId, providerId),
          or(
            eq(jobs.status, "in_progress"),
            and(eq(jobs.status, "scheduled"), gte(jobs.scheduledDate, startOfToday))
          )
        )
      );
    const upcomingJobs = upcomingJobsList.length;

    return { revenueMTD, jobsCompleted, activeClients, upcomingJobs, averageJobValue, revenueByPeriod };
  }

  // Provider business insights — real numbers for the dashboard metric grid
  // and an 8-week revenue trend. Also returns internal fields used by the
  // milestone-notification pipeline (allTimeRevenue, clientGrowthPct, rating,
  // reviewCount) so the route handler can fire those without a second query.
  async getProviderInsights(providerId: string): Promise<{
    revenueMtd: number;
    revenueMtdDelta: number | null;
    jobsCompleted: number;
    jobsCompletedDelta: number | null;
    activeClients: number;
    activeClientsDelta: number | null;
    avgJobValue: number;
    avgJobValueDelta: number | null;
    weeklyRevenueSeries: { label: string; value: number }[];
    hasAnyData: boolean;
    allTimeRevenue: number;
    clientGrowthPct: number;
    rating: string;
    reviewCount: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    // Same-day-of-month cutoff so MTD is compared against the matching window
    // of the prior month rather than the full prior month.
    const prevMonthCutoff = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    const completedJobRows = await db
      .select({
        finalPrice: jobs.finalPrice,
        completedAt: jobs.completedAt,
        clientId: jobs.clientId,
      })
      .from(jobs)
      .where(and(eq(jobs.providerId, providerId), eq(jobs.status, "completed")));

    const allTimeRevenue = completedJobRows.reduce(
      (sum, j) => sum + parseFloat(j.finalPrice || "0"),
      0,
    );

    const inWindow = (d: Date | null, start: Date, end: Date) =>
      !!d && d >= start && d <= end;

    const currentJobs = completedJobRows.filter((j) =>
      inWindow(j.completedAt as Date | null, startOfMonth, now),
    );
    const priorJobs = completedJobRows.filter((j) =>
      inWindow(j.completedAt as Date | null, startOfPrevMonth, prevMonthCutoff),
    );

    const sumPrices = (rows: typeof completedJobRows) =>
      rows.reduce((s, j) => s + parseFloat(j.finalPrice || "0"), 0);

    const revenueMtd = sumPrices(currentJobs);
    const revenuePrev = sumPrices(priorJobs);
    const jobsCompleted = currentJobs.length;
    const jobsCompletedPrev = priorJobs.length;
    const avgJobValue = jobsCompleted > 0 ? revenueMtd / jobsCompleted : 0;
    const avgJobValuePrev =
      jobsCompletedPrev > 0 ? revenuePrev / jobsCompletedPrev : 0;

    const activeClientsThis = new Set(
      currentJobs.map((j) => j.clientId).filter(Boolean) as string[],
    ).size;
    const activeClientsPrev = new Set(
      priorJobs.map((j) => j.clientId).filter(Boolean) as string[],
    ).size;

    const pctDelta = (current: number, prior: number): number | null => {
      if (prior <= 0) {
        if (current <= 0) return null;
        return 100;
      }
      return Math.round(((current - prior) / prior) * 100);
    };

    // 8-week revenue trend ending this week. Week boundary = Monday.
    const startOfThisWeek = (() => {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      const day = d.getDay();
      const diffToMonday = (day + 6) % 7;
      d.setDate(d.getDate() - diffToMonday);
      return d;
    })();
    const weeklyRevenueSeries: { label: string; value: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(startOfThisWeek);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      const value = completedJobRows
        .filter((j) => inWindow(j.completedAt as Date | null, weekStart, weekEnd))
        .reduce((s, j) => s + parseFloat(j.finalPrice || "0"), 0);
      const label = weekStart.toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
      });
      weeklyRevenueSeries.push({ label, value });
    }

    // Quarterly client-growth metric kept for the existing milestone
    // notification pipeline (not exposed in the dashboard tiles anymore).
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    const startOfThisQuarter = new Date(now.getFullYear(), quarterMonth, 1, 0, 0, 0, 0);
    const startOfLastQuarter = new Date(now.getFullYear(), quarterMonth - 3, 1, 0, 0, 0, 0);
    const endOfLastQuarter = new Date(startOfThisQuarter.getTime() - 1);
    const clientsThisQuarter = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.providerId, providerId), gte(clients.createdAt, startOfThisQuarter)));
    const clientsLastQuarter = await db
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(
          eq(clients.providerId, providerId),
          gte(clients.createdAt, startOfLastQuarter),
          lte(clients.createdAt, endOfLastQuarter),
        ),
      );
    const clientGrowthPct =
      clientsLastQuarter.length > 0
        ? Math.round(
            ((clientsThisQuarter.length - clientsLastQuarter.length) /
              clientsLastQuarter.length) *
              100,
          )
        : clientsThisQuarter.length > 0
        ? 100
        : 0;

    const [providerRow] = await db
      .select({ rating: providers.rating, reviewCount: providers.reviewCount })
      .from(providers)
      .where(eq(providers.id, providerId));

    const totalClientsRow = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.providerId, providerId));

    const hasAnyData =
      completedJobRows.length > 0 || totalClientsRow.length > 0;

    return {
      revenueMtd,
      revenueMtdDelta: pctDelta(revenueMtd, revenuePrev),
      jobsCompleted,
      jobsCompletedDelta: pctDelta(jobsCompleted, jobsCompletedPrev),
      activeClients: activeClientsThis,
      activeClientsDelta: pctDelta(activeClientsThis, activeClientsPrev),
      avgJobValue,
      avgJobValueDelta: pctDelta(avgJobValue, avgJobValuePrev),
      weeklyRevenueSeries,
      hasAnyData,
      allTimeRevenue,
      clientGrowthPct,
      rating: providerRow?.rating ?? "0",
      reviewCount: providerRow?.reviewCount ?? 0,
    };
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

  // ── Task #296: Estimate methods ───────────────────────────────────────
  async getNextEstimateNumber(providerId: string): Promise<string> {
    const rows = await db
      .select({ estimateNumber: estimates.estimateNumber })
      .from(estimates)
      .where(eq(estimates.providerId, providerId));
    const nextNum = rows.length + 1;
    return `EST-${String(nextNum).padStart(4, "0")}`;
  }

  async getEstimates(providerId: string): Promise<Estimate[]> {
    return db
      .select()
      .from(estimates)
      .where(eq(estimates.providerId, providerId))
      .orderBy(desc(estimates.createdAt));
  }

  async getEstimatesByClient(clientId: string): Promise<Estimate[]> {
    return db
      .select()
      .from(estimates)
      .where(eq(estimates.clientId, clientId))
      .orderBy(desc(estimates.createdAt));
  }

  async getEstimate(id: string): Promise<Estimate | undefined> {
    const [row] = await db.select().from(estimates).where(eq(estimates.id, id));
    return row || undefined;
  }

  async getEstimateByPublicToken(token: string): Promise<Estimate | undefined> {
    const [row] = await db
      .select()
      .from(estimates)
      .where(eq(estimates.publicToken, token));
    return row || undefined;
  }

  async createEstimate(
    data: InsertEstimate & { publicToken: string },
  ): Promise<Estimate> {
    const [row] = await db.insert(estimates).values(data).returning();
    return row;
  }

  async updateEstimate(
    id: string,
    data: Partial<Estimate>,
  ): Promise<Estimate | undefined> {
    const [row] = await db
      .update(estimates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(estimates.id, id))
      .returning();
    return row || undefined;
  }

  async deleteEstimate(id: string): Promise<boolean> {
    const result = await db
      .delete(estimates)
      .where(eq(estimates.id, id))
      .returning();
    return result.length > 0;
  }

  async getEstimateLineItems(estimateId: string): Promise<EstimateLineItem[]> {
    return db
      .select()
      .from(estimateLineItems)
      .where(eq(estimateLineItems.estimateId, estimateId))
      .orderBy(estimateLineItems.createdAt);
  }

  async replaceEstimateLineItems(
    estimateId: string,
    items: InsertEstimateLineItem[],
  ): Promise<EstimateLineItem[]> {
    await db
      .delete(estimateLineItems)
      .where(eq(estimateLineItems.estimateId, estimateId));
    if (items.length === 0) return [];
    const inserted = await db
      .insert(estimateLineItems)
      .values(items.map((it) => ({ ...it, estimateId })))
      .returning();
    return inserted;
  }

  // Booking Links
  async getBookingLink(id: string): Promise<BookingLink | undefined> {
    const [link] = await db.select().from(bookingLinks).where(eq(bookingLinks.id, id));
    return link || undefined;
  }

  async getBookingLinkBySlug(slug: string): Promise<BookingLink | undefined> {
    const [link] = await db.select().from(bookingLinks).where(eq(bookingLinks.slug, slug));
    return link || undefined;
  }

  async getBookingLinksByProvider(providerId: string): Promise<BookingLink[]> {
    return await db.select().from(bookingLinks).where(eq(bookingLinks.providerId, providerId));
  }

  async createBookingLink(data: InsertBookingLink): Promise<BookingLink> {
    const [link] = await db.insert(bookingLinks).values(data).returning();
    return link;
  }

  async updateBookingLink(id: string, data: Partial<BookingLink>): Promise<BookingLink | undefined> {
    const [link] = await db.update(bookingLinks).set({ ...data, updatedAt: new Date() }).where(eq(bookingLinks.id, id)).returning();
    return link || undefined;
  }

  async deleteBookingLink(id: string): Promise<boolean> {
    const result = await db.delete(bookingLinks).where(eq(bookingLinks.id, id));
    return true;
  }

  // Intake Submissions
  async getIntakeSubmission(id: string): Promise<IntakeSubmission | undefined> {
    const [submission] = await db.select().from(intakeSubmissions).where(eq(intakeSubmissions.id, id));
    return submission || undefined;
  }

  async getIntakeSubmissionsByProvider(providerId: string): Promise<IntakeSubmission[]> {
    return await db.select().from(intakeSubmissions).where(eq(intakeSubmissions.providerId, providerId)).orderBy(desc(intakeSubmissions.createdAt));
  }

  async getIntakeSubmissionsByBookingLink(bookingLinkId: string): Promise<IntakeSubmission[]> {
    return await db.select().from(intakeSubmissions).where(eq(intakeSubmissions.bookingLinkId, bookingLinkId)).orderBy(desc(intakeSubmissions.createdAt));
  }

  async createIntakeSubmission(data: InsertIntakeSubmission): Promise<IntakeSubmission> {
    const [submission] = await db.insert(intakeSubmissions).values(data).returning();
    return submission;
  }

  async updateIntakeSubmission(id: string, data: Partial<IntakeSubmission>): Promise<IntakeSubmission | undefined> {
    const [submission] = await db.update(intakeSubmissions).set({ ...data, updatedAt: new Date() }).where(eq(intakeSubmissions.id, id)).returning();
    return submission || undefined;
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreference | undefined> {
    const [prefs] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
    return prefs || undefined;
  }

  async upsertNotificationPreferences(userId: string, data: Partial<NotificationPreference>): Promise<NotificationPreference> {
    const existing = await this.getNotificationPreferences(userId);
    if (existing) {
      const [updated] = await db.update(notificationPreferences)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(notificationPreferences)
      .values({ userId, ...data })
      .returning();
    return created;
  }

  // ─── Admin Storage Helpers ────────────────────────────────────────────────

  async getAdminStats(): Promise<{
    totalUsers: number;
    totalProviders: number;
    activeProviders: number;
    inactiveProviders: number;
    partnerProviders: number;
    totalAppointments: number;
    totalJobs: number;
    totalRevenueCents: number;
    openTickets: number;
    totalTickets: number;
  }> {
    const [counts] = await db
      .select({
        totalUsers: sql<number>`(SELECT COUNT(*) FROM users)`,
        totalProviders: sql<number>`(SELECT COUNT(*) FROM providers)`,
        activeProviders: sql<number>`(SELECT COUNT(*) FROM providers WHERE is_active = true)`,
        inactiveProviders: sql<number>`(SELECT COUNT(*) FROM providers WHERE is_active = false)`,
        partnerProviders: sql<number>`(SELECT COUNT(*) FROM provider_plans WHERE is_partner = true)`,
        totalAppointments: sql<number>`(SELECT COUNT(*) FROM appointments)`,
        totalJobs: sql<number>`(SELECT COUNT(*) FROM jobs)`,
        totalRevenueCents: sql<number>`COALESCE((SELECT SUM(amount_cents) FROM payments WHERE status = 'succeeded'), 0)`,
        openTickets: sql<number>`(SELECT COUNT(*) FROM support_tickets WHERE status = 'open')`,
        totalTickets: sql<number>`(SELECT COUNT(*) FROM support_tickets)`,
      })
      .from(sql`(SELECT 1) AS dual`);
    return {
      totalUsers: Number(counts.totalUsers),
      totalProviders: Number(counts.totalProviders),
      activeProviders: Number(counts.activeProviders),
      inactiveProviders: Number(counts.inactiveProviders),
      partnerProviders: Number(counts.partnerProviders),
      totalAppointments: Number(counts.totalAppointments),
      totalJobs: Number(counts.totalJobs),
      totalRevenueCents: Number(counts.totalRevenueCents),
      openTickets: Number(counts.openTickets),
      totalTickets: Number(counts.totalTickets),
    };
  }

  async getAdminUsers(params: {
    search: string;
    role: string;
    sortBy: string;
    limit: number;
    offset: number;
  }): Promise<{
    rows: Array<{
      id: string; email: string; firstName: string | null; lastName: string | null;
      phone: string | null; isProvider: boolean; isAdmin: boolean;
      lastActiveAt: Date | null; createdAt: Date;
    }>;
    total: number;
  }> {
    const { search, role, sortBy, limit, offset } = params;
    type Condition = ReturnType<typeof eq>;
    const conditions: Condition[] = [];
    if (search) {
      conditions.push(
        or(
          ilike(users.email, `%${search}%`),
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`),
        ) as Condition,
      );
    }
    if (role === "admin") conditions.push(eq(users.isAdmin, true));
    if (role === "provider") conditions.push(eq(users.isProvider, true));
    if (role === "homeowner") conditions.push(eq(users.isProvider, false));

    const orderClause =
      sortBy === "name_asc" ? asc(users.firstName) :
      sortBy === "name_desc" ? desc(users.firstName) :
      sortBy === "oldest" ? asc(users.createdAt) :
      desc(users.createdAt); // default: newest

    const rowsQuery = db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        isProvider: users.isProvider,
        isAdmin: users.isAdmin,
        lastActiveAt: users.lastActiveAt,
        createdAt: users.createdAt,
        homeCount: sql<number>`(SELECT COUNT(*)::int FROM homes WHERE homes.user_id = ${users.id})`,
        bookingCount: sql<number>`(SELECT COUNT(*)::int FROM appointments WHERE appointments.user_id = ${users.id})`,
        creditBalanceCents: sql<number>`(SELECT COALESCE(balance_cents, 0) FROM user_credits WHERE user_credits.user_id = ${users.id} LIMIT 1)`,
      })
      .from(users);

    const countQuery = db.select({ count: sql<number>`COUNT(*)` }).from(users);

    const [rows, [countRow]] = await Promise.all([
      (conditions.length > 0 ? rowsQuery.where(and(...conditions)) : rowsQuery)
        .orderBy(orderClause)
        .limit(limit)
        .offset(offset),
      conditions.length > 0 ? countQuery.where(and(...conditions)) : countQuery,
    ]);

    return {
      rows: rows.map(r => ({
        ...r,
        homeCount: Number(r.homeCount ?? 0),
        bookingCount: Number(r.bookingCount ?? 0),
        creditBalanceCents: Number(r.creditBalanceCents ?? 0),
      })),
      total: Number(countRow?.count ?? 0),
    };
  }

  async getAdminUserDetail(id: string): Promise<{
    user: {
      id: string; email: string; firstName: string | null; lastName: string | null;
      phone: string | null; avatarUrl: string | null; isProvider: boolean; isAdmin: boolean;
      stripeCustomerId: string | null; lastActiveAt: Date | null; createdAt: Date; updatedAt: Date;
    } | null;
    homes: typeof homes.$inferSelect[];
    appointments: typeof appointments.$inferSelect[];
    creditBalance: string;
    creditLedger: typeof creditLedger.$inferSelect[];
    supportTickets: typeof supportTickets.$inferSelect[];
  }> {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        isProvider: users.isProvider,
        isAdmin: users.isAdmin,
        stripeCustomerId: users.stripeCustomerId,
        lastActiveAt: users.lastActiveAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id));

    if (!user) return { user: null, homes: [], appointments: [], creditBalance: "0", creditLedger: [], supportTickets: [] };

    const [userHomes, userAppointments, userTickets] = await Promise.all([
      db.select().from(homes).where(eq(homes.userId, id)).orderBy(desc(homes.createdAt)),
      db.select().from(appointments).where(eq(appointments.userId, id)).orderBy(desc(appointments.scheduledDate)).limit(20),
      db.select().from(supportTickets).where(eq(supportTickets.userId, id)).orderBy(desc(supportTickets.createdAt)),
    ]);

    const [creditRow] = await db
      .select({ balanceCents: userCredits.balanceCents })
      .from(userCredits)
      .where(eq(userCredits.userId, id));

    const ledgerRows = await db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.userId, id))
      .orderBy(desc(creditLedger.createdAt))
      .limit(20);

    return {
      user,
      homes: userHomes,
      appointments: userAppointments,
      creditBalance: (Number(creditRow?.balanceCents ?? 0) / 100).toFixed(2),
      creditLedger: ledgerRows,
      supportTickets: userTickets,
    };
  }

  async updateAdminUser(
    id: string,
    patch: Record<string, unknown>,
    adminUserId: string,
  ): Promise<{ before: { isAdmin: boolean } | null; updated: User | null }> {
    const [before] = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, id));
    if (!before) return { before: null, updated: null };

    const [updated] = await db
      .update(users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    await db.insert(adminAuditLogs).values({
      adminUserId,
      action: "user.update",
      targetType: "user",
      targetId: id,
      beforeValue: { isAdmin: before.isAdmin } as Record<string, unknown>,
      afterValue: patch as Record<string, unknown>,
    });

    return { before, updated };
  }

  async getAdminProviderDetail(id: string): Promise<{
    provider: Provider | null;
    plan: typeof providerPlans.$inferSelect | null;
    connectAccount: typeof stripeConnectAccounts.$inferSelect | null;
    jobs: typeof jobs.$inferSelect[];
    invoices: typeof invoices.$inferSelect[];
    reviews: typeof reviews.$inferSelect[];
    crew: typeof crewMembers.$inferSelect[];
    bookings: typeof appointments.$inferSelect[];
    customServices: typeof providerCustomServices.$inferSelect[];
    services: Array<{ id: string; serviceId: string | null; categoryId: string | null; price: string | null; serviceName: string | null; categoryName: string | null }>;
    totalRevenueCents: number;
  }> {
    const [provider] = await db.select().from(providers).where(eq(providers.id, id));
    if (!provider) {
      return { provider: null, plan: null, connectAccount: null, jobs: [], invoices: [], reviews: [], crew: [], bookings: [], customServices: [], services: [], totalRevenueCents: 0 };
    }

    const [
      plan,
      connectAccount,
      providerJobList,
      providerInvoiceList,
      providerReviews,
      providerCrewList,
      providerBookings,
      customServiceList,
      catalogServiceLinks,
      revenueRow,
    ] = await Promise.all([
      db.select().from(providerPlans).where(eq(providerPlans.providerId, id)).then(r => r[0] ?? null),
      db.select().from(stripeConnectAccounts).where(eq(stripeConnectAccounts.providerId, id)).then(r => r[0] ?? null),
      db.select().from(jobs).where(eq(jobs.providerId, id)).orderBy(desc(jobs.scheduledDate)).limit(20),
      db.select().from(invoices).where(eq(invoices.providerId, id)).orderBy(desc(invoices.createdAt)).limit(20),
      db.select().from(reviews).where(eq(reviews.providerId, id)).orderBy(desc(reviews.createdAt)).limit(20),
      db.select().from(crewMembers).where(eq(crewMembers.providerId, id)).orderBy(desc(crewMembers.createdAt)),
      db.select().from(appointments).where(eq(appointments.providerId, id)).orderBy(desc(appointments.scheduledDate)).limit(20),
      db.select().from(providerCustomServices).where(eq(providerCustomServices.providerId, id)),
      db
        .select({
          id: providerServices.id,
          serviceId: providerServices.serviceId,
          categoryId: providerServices.categoryId,
          price: providerServices.price,
          serviceName: services.name,
          categoryName: serviceCategories.name,
        })
        .from(providerServices)
        .leftJoin(services, eq(services.id, providerServices.serviceId))
        .leftJoin(serviceCategories, eq(serviceCategories.id, providerServices.categoryId))
        .where(eq(providerServices.providerId, id)),
      db
        .select({ totalRevenueCents: sql<number>`COALESCE(SUM(${payments.amountCents}), 0)` })
        .from(payments)
        .where(and(eq(payments.providerId, id), eq(payments.status, "succeeded")))
        .then(r => r[0]),
    ]);

    return {
      provider,
      plan,
      connectAccount,
      jobs: providerJobList,
      invoices: providerInvoiceList,
      reviews: providerReviews,
      crew: providerCrewList,
      bookings: providerBookings,
      customServices: customServiceList,
      services: catalogServiceLinks,
      totalRevenueCents: Number(revenueRow?.totalRevenueCents ?? 0),
    };
  }

  async updateAdminProvider(
    id: string,
    patch: Record<string, unknown>,
    adminUserId: string,
    allowedFields: readonly string[],
  ): Promise<{ before: Provider | null; updated: Provider | null }> {
    const [before] = await db.select().from(providers).where(eq(providers.id, id));
    if (!before) return { before: null, updated: null };

    const [updated] = await db.update(providers).set(patch).where(eq(providers.id, id)).returning();

    const beforeSnapshot: Record<string, unknown> = {};
    for (const k of allowedFields) {
      if (k in patch) beforeSnapshot[k] = before[k as keyof typeof before];
    }
    await db.insert(adminAuditLogs).values({
      adminUserId,
      action: "provider.update",
      targetType: "provider",
      targetId: id,
      beforeValue: beforeSnapshot as Record<string, unknown>,
      afterValue: patch as Record<string, unknown>,
    });

    return { before, updated };
  }

  async listSupportTickets(params: {
    q: string;
    status: string;
    priority: string;
    userType: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: SupportTicket[]; total: number }> {
    const { q, status, priority, userType, limit, offset } = params;
    type Condition = ReturnType<typeof eq>;
    const conditions: Condition[] = [];
    if (q) {
      conditions.push(
        or(
          ilike(supportTickets.subject, `%${q}%`),
          ilike(supportTickets.message, `%${q}%`),
          ilike(supportTickets.email, `%${q}%`),
          ilike(supportTickets.name, `%${q}%`),
        ) as unknown as Condition,
      );
    }
    if (status) conditions.push(eq(supportTickets.status, status));
    if (priority) conditions.push(eq(supportTickets.priority, priority));
    if (userType) conditions.push(eq(supportTickets.userType, userType));

    const rowsQuery = db.select().from(supportTickets);
    const countQuery = db.select({ count: sql<number>`COUNT(*)` }).from(supportTickets);

    const [rows, [countRow]] = await Promise.all([
      (conditions.length > 0 ? rowsQuery.where(and(...conditions)) : rowsQuery)
        .orderBy(desc(supportTickets.createdAt))
        .limit(limit)
        .offset(offset),
      conditions.length > 0 ? countQuery.where(and(...conditions)) : countQuery,
    ]);

    return { rows, total: Number(countRow?.count ?? 0) };
  }

  async getSupportTicketWithMessages(
    id: string,
  ): Promise<{ ticket: SupportTicket | null; messages: SupportTicketMessage[] }> {
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    if (!ticket) return { ticket: null, messages: [] };

    const messages = await db
      .select()
      .from(supportTicketMessages)
      .where(eq(supportTicketMessages.ticketId, id))
      .orderBy(asc(supportTicketMessages.createdAt));

    return { ticket, messages };
  }

  async updateSupportTicket(
    id: string,
    patch: Record<string, unknown>,
    adminUserId: string,
  ): Promise<{ before: SupportTicket | null; updated: SupportTicket | null }> {
    const [before] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    if (!before) return { before: null, updated: null };

    // Auto-manage resolvedAt based on status transition
    const fullPatch = { ...patch };
    if (fullPatch.status === "resolved" || fullPatch.status === "closed") {
      if (!before.resolvedAt) fullPatch.resolvedAt = new Date();
    } else if (fullPatch.status && fullPatch.status !== "resolved" && fullPatch.status !== "closed") {
      fullPatch.resolvedAt = null;
    }

    const [updated] = await db
      .update(supportTickets)
      .set({ ...fullPatch, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();

    await db.insert(adminAuditLogs).values({
      adminUserId,
      action: "support_ticket.update",
      targetType: "support_ticket",
      targetId: id,
      beforeValue: { status: before.status, priority: before.priority, assignedTo: before.assignedTo } as Record<string, unknown>,
      afterValue: patch as Record<string, unknown>,
    });

    return { before, updated };
  }

  async addSupportTicketMessage(
    ticketId: string,
    adminUserId: string,
    messageBody: string,
  ): Promise<{ message: SupportTicketMessage; ticket: SupportTicket | null }> {
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId));
    if (!ticket) return { message: null as unknown as SupportTicketMessage, ticket: null };

    const [message] = await db
      .insert(supportTicketMessages)
      .values({ ticketId, senderId: adminUserId, senderType: "admin", body: messageBody })
      .returning();

    if (ticket.status === "open") {
      await db
        .update(supportTickets)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where(eq(supportTickets.id, ticketId));
    }

    return { message, ticket };
  }

  async resolveBroadcastRecipientIds(audience: string): Promise<string[]> {
    if (audience === "all") {
      const rows = await db.select({ id: users.id }).from(users);
      return rows.map(r => r.id);
    }
    if (audience === "homeowners") {
      const rows = await db.select({ id: users.id }).from(users).where(eq(users.isProvider, false));
      return rows.map(r => r.id);
    }
    if (audience === "providers") {
      const rows = await db
        .select({ userId: providers.userId })
        .from(providers)
        .where(and(eq(providers.isActive, true), sql`${providers.userId} IS NOT NULL`));
      return rows.map(r => r.userId).filter(Boolean) as string[];
    }
    return [];
  }

  async createBroadcast(data: {
    sentByUserId: string;
    title: string;
    body: string;
    audience: string;
    channel: string;
    recipientCount: number;
  }): Promise<AdminBroadcast> {
    const [broadcast] = await db
      .insert(adminBroadcasts)
      .values({ ...data, status: "sending", sentAt: new Date() })
      .returning();
    return broadcast;
  }

  async updateBroadcastStatus(id: string, status: string): Promise<void> {
    await db.update(adminBroadcasts).set({ status }).where(eq(adminBroadcasts.id, id));
  }

  async fetchBroadcastEmailMap(
    recipientIds: string[],
  ): Promise<Map<string, { email: string; firstName: string | null }>> {
    const map = new Map<string, { email: string; firstName: string | null }>();
    if (recipientIds.length === 0) return map;
    const rows = await db
      .select({ id: users.id, email: users.email, firstName: users.firstName })
      .from(users)
      .where(inArray(users.id, recipientIds));
    for (const u of rows) map.set(u.id, { email: u.email, firstName: u.firstName });
    return map;
  }

  async recordBroadcastRecipient(
    broadcastId: string,
    userId: string,
    channel: string,
    status: "delivered" | "failed",
    deliveredAt?: Date,
  ): Promise<void> {
    await db.insert(adminBroadcastRecipients).values({
      broadcastId,
      userId,
      channel,
      status,
      ...(deliveredAt ? { deliveredAt } : {}),
    });
  }

  async listBroadcasts(params: { limit: number; offset: number }): Promise<AdminBroadcast[]> {
    return db
      .select()
      .from(adminBroadcasts)
      .orderBy(desc(adminBroadcasts.createdAt))
      .limit(params.limit)
      .offset(params.offset);
  }

  async getAdminTopProviders(params: {
    days: number;
    category: string;
    city: string;
    partnerOnly: boolean;
    subscribedOnly: boolean;
    limit: number;
  }): Promise<Array<{
    id: string; businessName: string | null; email: string | null;
    averageRating: string | null; reviewCount: number | null;
    serviceArea: string | null; createdAt: Date;
    isPartner: boolean; isSubscribed: boolean; subscriptionStatus: string | null;
    totalRevenueCents: number; bookingCount: number;
  }>> {
    const since = new Date(Date.now() - params.days * 24 * 60 * 60 * 1000);

    type Condition = ReturnType<typeof eq>;
    const baseConditions: Condition[] = [
      eq(providers.isActive, true),
      sql`${providers.userId} IS NOT NULL` as unknown as Condition,
    ];
    if (params.city) baseConditions.push(ilike(providers.serviceArea, `%${params.city}%`) as unknown as Condition);

    const providerList = await db
      .select({
        id: providers.id,
        businessName: providers.businessName,
        email: providers.email,
        averageRating: providers.averageRating,
        reviewCount: providers.reviewCount,
        serviceArea: providers.serviceArea,
        createdAt: providers.createdAt,
      })
      .from(providers)
      .where(and(...baseConditions));

    if (providerList.length === 0) return [];

    const allIds = providerList.map(p => p.id);

    const [planRows, revenueRows, bookingRows] = await Promise.all([
      db
        .select({
          providerId: providerPlans.providerId,
          isPartner: providerPlans.isPartner,
          isSubscribed: providerPlans.isSubscribed,
          subscriptionStatus: providerPlans.subscriptionStatus,
        })
        .from(providerPlans)
        .where(inArray(providerPlans.providerId, allIds)),
      db
        .select({
          providerId: payments.providerId,
          totalCents: sql<number>`COALESCE(SUM(${payments.amountCents}), 0)`,
        })
        .from(payments)
        .where(
          and(
            inArray(payments.providerId, allIds),
            eq(payments.status, "succeeded"),
            gte(payments.createdAt, since),
          ),
        )
        .groupBy(payments.providerId),
      db
        .select({
          providerId: appointments.providerId,
          bookingCount: sql<number>`COUNT(*)`,
        })
        .from(appointments)
        .where(and(inArray(appointments.providerId, allIds), gte(appointments.createdAt, since)))
        .groupBy(appointments.providerId),
    ]);

    const planMap = new Map(planRows.map(r => [r.providerId, r]));
    const revenueMap = new Map(revenueRows.map(r => [r.providerId, r]));
    const bookingMap = new Map(bookingRows.map(r => [r.providerId, r]));

    let enriched = providerList.map(p => ({
      ...p,
      isPartner: planMap.get(p.id)?.isPartner ?? false,
      isSubscribed: planMap.get(p.id)?.isSubscribed ?? false,
      subscriptionStatus: planMap.get(p.id)?.subscriptionStatus ?? null,
      totalRevenueCents: Number(revenueMap.get(p.id)?.totalCents ?? 0),
      bookingCount: Number(bookingMap.get(p.id)?.bookingCount ?? 0),
    }));

    if (params.partnerOnly) enriched = enriched.filter(p => p.isPartner);
    if (params.subscribedOnly) enriched = enriched.filter(p => p.isSubscribed);

    if (params.category) {
      const catProviderRows = await db
        .select({ providerId: providerServices.providerId })
        .from(providerServices)
        .innerJoin(services, eq(services.id, providerServices.serviceId))
        .innerJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
        .where(ilike(serviceCategories.name, `%${params.category}%`));
      const catSet = new Set(catProviderRows.map(r => r.providerId));
      enriched = enriched.filter(p => catSet.has(p.id));
    }

    enriched.sort((a, b) => b.totalRevenueCents - a.totalRevenueCents);
    return enriched.slice(0, params.limit);
  }

  async deleteAdminAuditLogs(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const deleted = await db
      .delete(adminAuditLogs)
      .where(inArray(adminAuditLogs.id, ids))
      .returning({ id: adminAuditLogs.id });
    return deleted.length;
  }

  async listAdminAuditLogs(params: {
    adminUserId: string;
    action: string;
    since: string;
    until: string;
    limit: number;
    offset: number;
  }): Promise<{
    rows: Array<typeof adminAuditLogs.$inferSelect & { adminName: string | null; adminEmail: string | null }>;
    total: number;
  }> {
    const { limit, offset } = params;
    type Condition = ReturnType<typeof eq>;
    const conditions: Condition[] = [];
    if (params.adminUserId) conditions.push(eq(adminAuditLogs.adminUserId, params.adminUserId));
    if (params.action) conditions.push(ilike(adminAuditLogs.action, `%${params.action}%`) as unknown as Condition);
    if (params.since) conditions.push(gte(adminAuditLogs.createdAt, new Date(params.since)) as unknown as Condition);
    if (params.until) conditions.push(lt(adminAuditLogs.createdAt, new Date(params.until)) as unknown as Condition);

    const rowsQuery = db
      .select({
        id: adminAuditLogs.id,
        adminUserId: adminAuditLogs.adminUserId,
        action: adminAuditLogs.action,
        targetType: adminAuditLogs.targetType,
        targetId: adminAuditLogs.targetId,
        beforeValue: adminAuditLogs.beforeValue,
        afterValue: adminAuditLogs.afterValue,
        createdAt: adminAuditLogs.createdAt,
        adminName: sql<string | null>`CONCAT(COALESCE(${users.firstName}, ''), ' ', COALESCE(${users.lastName}, ''))`,
        adminEmail: users.email,
      })
      .from(adminAuditLogs)
      .leftJoin(users, eq(users.id, adminAuditLogs.adminUserId));

    const countQuery = db.select({ count: sql<number>`COUNT(*)` }).from(adminAuditLogs);

    const [rows, [countRow]] = await Promise.all([
      (conditions.length > 0 ? rowsQuery.where(and(...conditions)) : rowsQuery)
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      conditions.length > 0 ? countQuery.where(and(...conditions)) : countQuery,
    ]);

    return {
      rows: rows.map(r => ({
        ...r,
        adminName: r.adminName?.trim() || null,
        adminEmail: r.adminEmail ?? null,
      })),
      total: Number(countRow?.count ?? 0),
    };
  }

  async getAdminProviders(params: {
    search: string;
    subscriptionStatus: string;
    isPartner: boolean | null;
    isActive: boolean | null;
    sortBy: string;
    limit: number;
    offset: number;
  }): Promise<{
    rows: Array<{
      id: string;
      userId: string | null;
      businessName: string;
      email: string | null;
      phone: string | null;
      description: string | null;
      isActive: boolean | null;
      isPublic: boolean | null;
      isVerified: boolean | null;
      averageRating: string | null;
      reviewCount: number | null;
      serviceArea: string | null;
      createdAt: Date;
      subscriptionStatus: string | null;
      isSubscribed: boolean;
      isPartner: boolean;
      partnerSince: Date | null;
      bookingCount: number;
      totalRevenueCents: number;
    }>;
    total: number;
  }> {
    // Raw SQL avoids Drizzle 0.45.2 orderSelectedFields crash on LEFT JOIN
    // with correlated-subquery columns mixed in the select list.
    const { search, subscriptionStatus, isPartner, isActive, limit, offset } = params;

    const whereParts: string[] = [];
    const queryValues: unknown[] = [];

    if (search) {
      queryValues.push(`%${search}%`);
      whereParts.push(`(p.business_name ILIKE $${queryValues.length} OR p.email ILIKE $${queryValues.length})`);
    }
    if (isActive !== null) {
      queryValues.push(isActive);
      whereParts.push(`p.is_active = $${queryValues.length}`);
    }
    if (isPartner !== null) {
      queryValues.push(isPartner);
      whereParts.push(`COALESCE(pp.is_partner, FALSE) = $${queryValues.length}`);
      if (isPartner === true) {
        whereParts.push(`p.is_verified = TRUE`);
      }
    }
    if (subscriptionStatus) {
      queryValues.push(subscriptionStatus);
      whereParts.push(`pp.subscription_status = $${queryValues.length}`);
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const orderClause =
      params.sortBy === "bookings" ? "ORDER BY booking_count DESC NULLS LAST" :
      params.sortBy === "revenue"  ? "ORDER BY total_revenue_cents DESC NULLS LAST" :
      "ORDER BY pp.partner_since DESC NULLS LAST, p.business_name ASC";

    const mainQuery = `
      SELECT
        p.id,
        p.user_id                                                            AS "userId",
        p.business_name                                                      AS "businessName",
        p.email,
        p.phone,
        p.description,
        p.is_active                                                          AS "isActive",
        p.is_public                                                          AS "isPublic",
        p.is_verified                                                        AS "isVerified",
        p.average_rating                                                     AS "averageRating",
        p.review_count                                                       AS "reviewCount",
        p.service_area                                                       AS "serviceArea",
        p.created_at                                                         AS "createdAt",
        pp.subscription_status                                               AS "subscriptionStatus",
        COALESCE(pp.is_subscribed, FALSE)                                    AS "isSubscribed",
        COALESCE(pp.is_partner, FALSE)                                       AS "isPartner",
        pp.partner_since                                                     AS "partnerSince",
        (SELECT COUNT(*)::int  FROM appointments WHERE provider_id = p.id)   AS "bookingCount",
        (SELECT COALESCE(SUM(amount_cents), 0)::bigint
           FROM payments WHERE provider_id = p.id AND status = 'succeeded') AS "totalRevenueCents"
      FROM providers p
      LEFT JOIN provider_plans pp ON pp.provider_id = p.id
      ${whereClause}
      ${orderClause}
      LIMIT $${queryValues.length + 1} OFFSET $${queryValues.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM providers p
      LEFT JOIN provider_plans pp ON pp.provider_id = p.id
      ${whereClause}
    `;

    const client = await pool.connect();
    try {
      const [rowsResult, countResult] = await Promise.all([
        client.query(mainQuery, [...queryValues, limit, offset]),
        client.query(countQuery, queryValues),
      ]);

      return {
        rows: rowsResult.rows.map((r: Record<string, unknown>) => ({
          id: r["id"] as string,
          userId: (r["userId"] as string | null) ?? null,
          businessName: r["businessName"] as string,
          email: (r["email"] as string | null) ?? null,
          phone: (r["phone"] as string | null) ?? null,
          description: (r["description"] as string | null) ?? null,
          isActive: (r["isActive"] as boolean | null) ?? null,
          isPublic: (r["isPublic"] as boolean | null) ?? null,
          isVerified: (r["isVerified"] as boolean | null) ?? null,
          averageRating: (r["averageRating"] as string | null) ?? null,
          reviewCount: (r["reviewCount"] as number | null) ?? null,
          serviceArea: (r["serviceArea"] as string | null) ?? null,
          createdAt: r["createdAt"] instanceof Date ? r["createdAt"] : new Date(r["createdAt"] as string),
          subscriptionStatus: (r["subscriptionStatus"] as string | null) ?? null,
          isSubscribed: Boolean(r["isSubscribed"]),
          isPartner: Boolean(r["isPartner"]),
          partnerSince: r["partnerSince"]
            ? (r["partnerSince"] instanceof Date ? r["partnerSince"] : new Date(r["partnerSince"] as string))
            : null,
          bookingCount: Number(r["bookingCount"] ?? 0),
          totalRevenueCents: Number(r["totalRevenueCents"] ?? 0),
        })),
        total: Number(countResult.rows[0]?.["total"] ?? 0),
      };
    } finally {
      client.release();
    }
  }
}

export const storage = new DatabaseStorage();
