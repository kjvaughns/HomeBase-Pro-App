var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  appointmentStatusEnum: () => appointmentStatusEnum,
  appointments: () => appointments,
  appointmentsRelations: () => appointmentsRelations,
  bookingLinkStatusEnum: () => bookingLinkStatusEnum,
  bookingLinks: () => bookingLinks,
  bookingLinksRelations: () => bookingLinksRelations,
  clients: () => clients,
  clientsRelations: () => clientsRelations,
  connectOnboardingStatusEnum: () => connectOnboardingStatusEnum,
  creditLedger: () => creditLedger,
  creditLedgerRelations: () => creditLedgerRelations,
  homes: () => homes,
  homesRelations: () => homesRelations,
  insertAppointmentSchema: () => insertAppointmentSchema,
  insertBookingLinkSchema: () => insertBookingLinkSchema,
  insertClientSchema: () => insertClientSchema,
  insertCreditLedgerSchema: () => insertCreditLedgerSchema,
  insertHomeSchema: () => insertHomeSchema,
  insertIntakeSubmissionSchema: () => insertIntakeSubmissionSchema,
  insertInvoiceLineItemSchema: () => insertInvoiceLineItemSchema,
  insertInvoiceSchema: () => insertInvoiceSchema,
  insertJobSchema: () => insertJobSchema,
  insertLeadSchema: () => insertLeadSchema,
  insertMessageTemplateSchema: () => insertMessageTemplateSchema,
  insertNotificationPreferenceSchema: () => insertNotificationPreferenceSchema,
  insertPaymentSchema: () => insertPaymentSchema,
  insertPayoutSchema: () => insertPayoutSchema,
  insertProviderCustomServiceSchema: () => insertProviderCustomServiceSchema,
  insertProviderMessageSchema: () => insertProviderMessageSchema,
  insertProviderPlanSchema: () => insertProviderPlanSchema,
  insertProviderSchema: () => insertProviderSchema,
  insertStripeConnectAccountSchema: () => insertStripeConnectAccountSchema,
  insertUserCreditsSchema: () => insertUserCreditsSchema,
  insertUserSchema: () => insertUserSchema,
  intakeStatusEnum: () => intakeStatusEnum,
  intakeSubmissions: () => intakeSubmissions,
  intakeSubmissionsRelations: () => intakeSubmissionsRelations,
  invoiceLineItems: () => invoiceLineItems,
  invoiceLineItemsRelations: () => invoiceLineItemsRelations,
  invoiceStatusEnum: () => invoiceStatusEnum,
  invoices: () => invoices,
  invoicesRelations: () => invoicesRelations,
  jobSizeEnum: () => jobSizeEnum,
  jobStatusEnum: () => jobStatusEnum,
  jobs: () => jobs,
  jobsRelations: () => jobsRelations,
  leads: () => leads,
  loginSchema: () => loginSchema,
  maintenanceReminderFrequencyEnum: () => maintenanceReminderFrequencyEnum,
  maintenanceReminders: () => maintenanceReminders,
  maintenanceRemindersRelations: () => maintenanceRemindersRelations,
  messageChannelEnum: () => messageChannelEnum,
  messageStatusEnum: () => messageStatusEnum,
  messageTemplates: () => messageTemplates,
  messageTemplatesRelations: () => messageTemplatesRelations,
  notificationChannelEnum: () => notificationChannelEnum,
  notificationDeliveries: () => notificationDeliveries,
  notificationDeliveryStatusEnum: () => notificationDeliveryStatusEnum,
  notificationPreferences: () => notificationPreferences,
  notifications: () => notifications,
  notificationsRelations: () => notificationsRelations,
  paymentMethodEnum: () => paymentMethodEnum,
  paymentStatusEnum: () => paymentStatusEnum,
  payments: () => payments,
  paymentsRelations: () => paymentsRelations,
  payoutStatusEnum: () => payoutStatusEnum,
  payouts: () => payouts,
  payoutsRelations: () => payoutsRelations,
  pricingTypeEnum: () => pricingTypeEnum,
  propertyTypeEnum: () => propertyTypeEnum,
  providerCustomServices: () => providerCustomServices,
  providerCustomServicesRelations: () => providerCustomServicesRelations,
  providerMessageTemplates: () => providerMessageTemplates,
  providerMessages: () => providerMessages,
  providerMessagesRelations: () => providerMessagesRelations,
  providerPlanTierEnum: () => providerPlanTierEnum,
  providerPlans: () => providerPlans,
  providerPlansRelations: () => providerPlansRelations,
  providerServices: () => providerServices,
  providerServicesRelations: () => providerServicesRelations,
  providers: () => providers,
  providersRelations: () => providersRelations,
  pushTokens: () => pushTokens,
  quoteModeEnum: () => quoteModeEnum,
  refundStatusEnum: () => refundStatusEnum,
  refunds: () => refunds,
  refundsRelations: () => refundsRelations,
  reviews: () => reviews,
  reviewsRelations: () => reviewsRelations,
  serviceCategories: () => serviceCategories,
  serviceCategoriesRelations: () => serviceCategoriesRelations,
  services: () => services,
  servicesRelations: () => servicesRelations,
  stripeConnectAccounts: () => stripeConnectAccounts,
  stripeConnectAccountsRelations: () => stripeConnectAccountsRelations,
  stripeWebhookEvents: () => stripeWebhookEvents,
  urgencyEnum: () => urgencyEnum,
  userCredits: () => userCredits,
  userCreditsRelations: () => userCreditsRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, decimal, pgEnum, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var propertyTypeEnum, appointmentStatusEnum, urgencyEnum, jobSizeEnum, jobStatusEnum, invoiceStatusEnum, paymentMethodEnum, paymentStatusEnum, payoutStatusEnum, connectOnboardingStatusEnum, providerPlanTierEnum, users, usersRelations, homes, homesRelations, serviceCategories, serviceCategoriesRelations, services, servicesRelations, providers, providersRelations, providerServices, providerServicesRelations, pricingTypeEnum, providerCustomServices, providerCustomServicesRelations, insertProviderCustomServiceSchema, appointments, appointmentsRelations, reviews, reviewsRelations, notifications, notificationsRelations, maintenanceReminderFrequencyEnum, maintenanceReminders, maintenanceRemindersRelations, providerPlans, providerPlansRelations, stripeConnectAccounts, stripeConnectAccountsRelations, userCredits, userCreditsRelations, creditLedger, creditLedgerRelations, payouts, payoutsRelations, refundStatusEnum, refunds, refundsRelations, stripeWebhookEvents, invoiceLineItems, invoiceLineItemsRelations, clients, clientsRelations, jobs, jobsRelations, invoices, invoicesRelations, payments, paymentsRelations, bookingLinkStatusEnum, quoteModeEnum, intakeStatusEnum, bookingLinks, bookingLinksRelations, intakeSubmissions, intakeSubmissionsRelations, insertUserSchema, loginSchema, insertHomeSchema, insertAppointmentSchema, insertClientSchema, insertJobSchema, insertInvoiceSchema, insertPaymentSchema, insertProviderSchema, insertProviderPlanSchema, insertStripeConnectAccountSchema, insertInvoiceLineItemSchema, insertPayoutSchema, insertUserCreditsSchema, insertCreditLedgerSchema, insertBookingLinkSchema, insertIntakeSubmissionSchema, notificationChannelEnum, notificationDeliveryStatusEnum, pushTokens, notificationPreferences, providerMessageTemplates, notificationDeliveries, messageChannelEnum, messageStatusEnum, providerMessages, providerMessagesRelations, insertProviderMessageSchema, messageTemplates, messageTemplatesRelations, insertMessageTemplateSchema, leads, insertLeadSchema, insertNotificationPreferenceSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    propertyTypeEnum = pgEnum("property_type", ["single_family", "condo", "townhouse", "apartment", "multi_family"]);
    appointmentStatusEnum = pgEnum("appointment_status", ["pending", "confirmed", "in_progress", "completed", "cancelled"]);
    urgencyEnum = pgEnum("urgency", ["flexible", "soon", "urgent"]);
    jobSizeEnum = pgEnum("job_size", ["small", "medium", "large"]);
    jobStatusEnum = pgEnum("job_status", ["scheduled", "confirmed", "on_my_way", "arrived", "in_progress", "completed", "cancelled"]);
    invoiceStatusEnum = pgEnum("invoice_status", ["draft", "sent", "viewed", "paid", "partially_paid", "overdue", "void", "refunded", "cancelled"]);
    paymentMethodEnum = pgEnum("payment_method", ["cash", "card", "bank_transfer", "check", "stripe", "credits", "other"]);
    paymentStatusEnum = pgEnum("payment_status", ["requires_payment", "processing", "succeeded", "failed", "refunded"]);
    payoutStatusEnum = pgEnum("payout_status", ["pending", "in_transit", "paid", "failed"]);
    connectOnboardingStatusEnum = pgEnum("connect_onboarding_status", ["not_started", "pending", "complete"]);
    providerPlanTierEnum = pgEnum("provider_plan_tier", ["free", "starter", "professional", "enterprise"]);
    users = pgTable("users", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      email: text("email").notNull().unique(),
      password: text("password").notNull(),
      firstName: text("first_name"),
      lastName: text("last_name"),
      phone: text("phone"),
      avatarUrl: text("avatar_url"),
      isProvider: boolean("is_provider").default(false),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    usersRelations = relations(users, ({ many }) => ({
      homes: many(homes),
      appointments: many(appointments)
    }));
    homes = pgTable("homes", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      label: text("label").notNull(),
      street: text("street").notNull(),
      city: text("city").notNull(),
      state: text("state").notNull(),
      zip: text("zip").notNull(),
      propertyType: propertyTypeEnum("property_type").default("single_family"),
      bedrooms: integer("bedrooms"),
      bathrooms: integer("bathrooms"),
      squareFeet: integer("square_feet"),
      yearBuilt: integer("year_built"),
      isDefault: boolean("is_default").default(false),
      // HouseFax enrichment fields - Zillow data
      lotSize: integer("lot_size"),
      // in sqft
      estimatedValue: decimal("estimated_value", { precision: 12, scale: 2 }),
      zillowId: text("zillow_id"),
      zillowUrl: text("zillow_url"),
      taxAssessedValue: decimal("tax_assessed_value", { precision: 12, scale: 2 }),
      lastSoldDate: text("last_sold_date"),
      lastSoldPrice: decimal("last_sold_price", { precision: 12, scale: 2 }),
      // HouseFax enrichment fields - Google data
      latitude: decimal("latitude", { precision: 10, scale: 7 }),
      longitude: decimal("longitude", { precision: 10, scale: 7 }),
      placeId: text("place_id"),
      formattedAddress: text("formatted_address"),
      neighborhoodName: text("neighborhood_name"),
      countyName: text("county_name"),
      // HouseFax AI-accumulated data
      housefaxData: text("housefax_data"),
      // JSON: systems, materials, known issues, etc.
      housefaxScore: integer("housefax_score"),
      // Home health score (0-100)
      housefaxEnrichedAt: timestamp("housefax_enriched_at"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    homesRelations = relations(homes, ({ one, many }) => ({
      user: one(users, { fields: [homes.userId], references: [users.id] }),
      appointments: many(appointments)
    }));
    serviceCategories = pgTable("service_categories", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      name: text("name").notNull(),
      description: text("description"),
      icon: text("icon"),
      sortOrder: integer("sort_order").default(0)
    });
    serviceCategoriesRelations = relations(serviceCategories, ({ many }) => ({
      services: many(services),
      providers: many(providerServices)
    }));
    services = pgTable("services", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      categoryId: varchar("category_id").notNull().references(() => serviceCategories.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      description: text("description"),
      basePrice: decimal("base_price", { precision: 10, scale: 2 }),
      isPublic: boolean("is_public").default(true)
    });
    servicesRelations = relations(services, ({ one, many }) => ({
      category: one(serviceCategories, { fields: [services.categoryId], references: [serviceCategories.id] }),
      providerServices: many(providerServices)
    }));
    providers = pgTable("providers", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
      businessName: text("business_name").notNull(),
      description: text("description"),
      avatarUrl: text("avatar_url"),
      phone: text("phone"),
      email: text("email"),
      rating: decimal("rating", { precision: 2, scale: 1 }).default("0"),
      reviewCount: integer("review_count").default(0),
      averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0"),
      hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
      isVerified: boolean("is_verified").default(false),
      isActive: boolean("is_active").default(true),
      serviceArea: text("service_area"),
      yearsExperience: integer("years_experience").default(0),
      capabilityTags: text("capability_tags").array().default(sql`ARRAY[]::text[]`),
      businessHours: json("business_hours"),
      bookingPolicies: json("booking_policies"),
      serviceRadius: integer("service_radius"),
      serviceZipCodes: text("service_zip_codes").array(),
      serviceCities: text("service_cities").array(),
      isPublic: boolean("is_public").default(false),
      slug: text("slug").unique(),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    providersRelations = relations(providers, ({ one, many }) => ({
      user: one(users, { fields: [providers.userId], references: [users.id] }),
      services: many(providerServices),
      appointments: many(appointments),
      clients: many(clients),
      jobs: many(jobs),
      invoices: many(invoices),
      payments: many(payments)
    }));
    providerServices = pgTable("provider_services", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
      serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
      categoryId: varchar("category_id").notNull().references(() => serviceCategories.id, { onDelete: "cascade" }),
      price: decimal("price", { precision: 10, scale: 2 })
    });
    providerServicesRelations = relations(providerServices, ({ one }) => ({
      provider: one(providers, { fields: [providerServices.providerId], references: [providers.id] }),
      service: one(services, { fields: [providerServices.serviceId], references: [services.id] }),
      category: one(serviceCategories, { fields: [providerServices.categoryId], references: [serviceCategories.id] })
    }));
    pricingTypeEnum = pgEnum("pricing_type", ["fixed", "variable", "service_call", "quote"]);
    providerCustomServices = pgTable("provider_custom_services", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      category: text("category").notNull().default("General"),
      description: text("description"),
      pricingType: pricingTypeEnum("pricing_type").notNull().default("fixed"),
      basePrice: decimal("base_price", { precision: 10, scale: 2 }),
      priceFrom: decimal("price_from", { precision: 10, scale: 2 }),
      priceTo: decimal("price_to", { precision: 10, scale: 2 }),
      priceTiersJson: text("price_tiers_json"),
      duration: integer("duration").default(60),
      isPublished: boolean("is_published").default(true),
      isAddon: boolean("is_addon").default(false),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    providerCustomServicesRelations = relations(providerCustomServices, ({ one }) => ({
      provider: one(providers, { fields: [providerCustomServices.providerId], references: [providers.id] })
    }));
    insertProviderCustomServiceSchema = createInsertSchema(providerCustomServices).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    appointments = pgTable("appointments", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      homeId: varchar("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
      providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
      serviceId: varchar("service_id").references(() => services.id, { onDelete: "set null" }),
      serviceName: text("service_name").notNull(),
      description: text("description"),
      jobSummary: text("job_summary"),
      urgency: urgencyEnum("urgency").default("flexible"),
      jobSize: jobSizeEnum("job_size").default("small"),
      scheduledDate: timestamp("scheduled_date").notNull(),
      scheduledTime: text("scheduled_time").notNull(),
      status: appointmentStatusEnum("status").default("pending"),
      estimatedPrice: decimal("estimated_price", { precision: 10, scale: 2 }),
      finalPrice: decimal("final_price", { precision: 10, scale: 2 }),
      providerDiagnosis: text("provider_diagnosis"),
      statusHistory: text("status_history"),
      notes: text("notes"),
      isRecurring: boolean("is_recurring").default(false),
      recurringFrequency: text("recurring_frequency"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
      completedAt: timestamp("completed_at"),
      cancelledAt: timestamp("cancelled_at")
    });
    appointmentsRelations = relations(appointments, ({ one }) => ({
      user: one(users, { fields: [appointments.userId], references: [users.id] }),
      home: one(homes, { fields: [appointments.homeId], references: [homes.id] }),
      provider: one(providers, { fields: [appointments.providerId], references: [providers.id] }),
      service: one(services, { fields: [appointments.serviceId], references: [services.id] })
    }));
    reviews = pgTable("reviews", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      appointmentId: varchar("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
      userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
      rating: integer("rating").notNull(),
      comment: text("comment"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    reviewsRelations = relations(reviews, ({ one }) => ({
      appointment: one(appointments, { fields: [reviews.appointmentId], references: [appointments.id] }),
      user: one(users, { fields: [reviews.userId], references: [users.id] }),
      provider: one(providers, { fields: [reviews.providerId], references: [providers.id] })
    }));
    notifications = pgTable("notifications", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      title: text("title").notNull(),
      message: text("message").notNull(),
      type: text("type").notNull(),
      isRead: boolean("is_read").default(false),
      data: text("data"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    notificationsRelations = relations(notifications, ({ one }) => ({
      user: one(users, { fields: [notifications.userId], references: [users.id] })
    }));
    maintenanceReminderFrequencyEnum = pgEnum("maintenance_reminder_frequency", ["monthly", "quarterly", "biannually", "annually", "custom"]);
    maintenanceReminders = pgTable("maintenance_reminders", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      homeId: varchar("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
      userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      title: text("title").notNull(),
      description: text("description"),
      category: text("category"),
      frequency: maintenanceReminderFrequencyEnum("frequency").default("annually"),
      lastCompletedAt: timestamp("last_completed_at"),
      nextDueAt: timestamp("next_due_at").notNull(),
      isActive: boolean("is_active").default(true),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    maintenanceRemindersRelations = relations(maintenanceReminders, ({ one }) => ({
      home: one(homes, { fields: [maintenanceReminders.homeId], references: [homes.id] }),
      user: one(users, { fields: [maintenanceReminders.userId], references: [users.id] })
    }));
    providerPlans = pgTable("provider_plans", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
      planTier: providerPlanTierEnum("plan_tier").default("free"),
      platformFeePercent: decimal("platform_fee_percent", { precision: 5, scale: 2 }).default("10.00"),
      // 10% default
      platformFeeFixedCents: integer("platform_fee_fixed_cents").default(0),
      // additional fixed fee in cents
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    providerPlansRelations = relations(providerPlans, ({ one }) => ({
      provider: one(providers, { fields: [providerPlans.providerId], references: [providers.id] })
    }));
    stripeConnectAccounts = pgTable("stripe_connect_accounts", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }).unique(),
      stripeAccountId: text("stripe_account_id").notNull().unique(),
      onboardingStatus: connectOnboardingStatusEnum("onboarding_status").default("not_started"),
      chargesEnabled: boolean("charges_enabled").default(false),
      payoutsEnabled: boolean("payouts_enabled").default(false),
      detailsSubmitted: boolean("details_submitted").default(false),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    stripeConnectAccountsRelations = relations(stripeConnectAccounts, ({ one }) => ({
      provider: one(providers, { fields: [stripeConnectAccounts.providerId], references: [providers.id] })
    }));
    userCredits = pgTable("user_credits", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
      balanceCents: integer("balance_cents").default(0),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    userCreditsRelations = relations(userCredits, ({ one, many }) => ({
      user: one(users, { fields: [userCredits.userId], references: [users.id] }),
      ledger: many(creditLedger)
    }));
    creditLedger = pgTable("credit_ledger", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      deltaCents: integer("delta_cents").notNull(),
      // positive for credit, negative for debit
      reason: text("reason").notNull(),
      // e.g., "revenuecat_purchase", "invoice_payment", "refund"
      invoiceId: varchar("invoice_id"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    creditLedgerRelations = relations(creditLedger, ({ one }) => ({
      user: one(users, { fields: [creditLedger.userId], references: [users.id] }),
      credits: one(userCredits, { fields: [creditLedger.userId], references: [userCredits.userId] })
    }));
    payouts = pgTable("payouts", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
      amountCents: integer("amount_cents").notNull(),
      status: payoutStatusEnum("status").default("pending"),
      stripeTransferId: text("stripe_transfer_id"),
      stripePayoutId: text("stripe_payout_id"),
      arrivalDate: timestamp("arrival_date"),
      description: text("description"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    payoutsRelations = relations(payouts, ({ one }) => ({
      provider: one(providers, { fields: [payouts.providerId], references: [providers.id] })
    }));
    refundStatusEnum = pgEnum("refund_status", ["pending", "succeeded", "failed", "canceled"]);
    refunds = pgTable("refunds", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
      paymentId: varchar("payment_id").references(() => payments.id, { onDelete: "set null" }),
      stripeRefundId: text("stripe_refund_id").unique(),
      stripeChargeId: text("stripe_charge_id"),
      amountCents: integer("amount_cents").notNull(),
      reason: text("reason"),
      status: refundStatusEnum("status").default("pending"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    refundsRelations = relations(refunds, ({ one }) => ({
      provider: one(providers, { fields: [refunds.providerId], references: [providers.id] }),
      payment: one(payments, { fields: [refunds.paymentId], references: [payments.id] })
    }));
    stripeWebhookEvents = pgTable("stripe_webhook_events", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      stripeEventId: text("stripe_event_id").notNull().unique(),
      eventType: text("event_type").notNull(),
      processedAt: timestamp("processed_at").defaultNow().notNull(),
      payload: text("payload")
      // JSON string of event data
    });
    invoiceLineItems = pgTable("invoice_line_items", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      description: text("description"),
      quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1"),
      unitPriceCents: integer("unit_price_cents").notNull(),
      amountCents: integer("amount_cents").notNull(),
      metadata: text("metadata"),
      // JSON for additional data
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
      invoice: one(invoices, { fields: [invoiceLineItems.invoiceId], references: [invoices.id] })
    }));
    clients = pgTable("clients", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
      firstName: text("first_name").notNull(),
      lastName: text("last_name"),
      email: text("email"),
      phone: text("phone"),
      address: text("address"),
      city: text("city"),
      state: text("state"),
      zip: text("zip"),
      notes: text("notes"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    clientsRelations = relations(clients, ({ one, many }) => ({
      provider: one(providers, { fields: [clients.providerId], references: [providers.id] }),
      jobs: many(jobs),
      invoices: many(invoices)
    }));
    jobs = pgTable("jobs", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
      clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
      appointmentId: varchar("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
      serviceId: varchar("service_id").references(() => services.id, { onDelete: "set null" }),
      title: text("title").notNull(),
      description: text("description"),
      scheduledDate: timestamp("scheduled_date").notNull(),
      scheduledTime: text("scheduled_time"),
      estimatedDuration: integer("estimated_duration"),
      // in minutes
      status: jobStatusEnum("status").default("scheduled"),
      address: text("address"),
      estimatedPrice: decimal("estimated_price", { precision: 10, scale: 2 }),
      finalPrice: decimal("final_price", { precision: 10, scale: 2 }),
      notes: text("notes"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
      completedAt: timestamp("completed_at")
    });
    jobsRelations = relations(jobs, ({ one, many }) => ({
      provider: one(providers, { fields: [jobs.providerId], references: [providers.id] }),
      client: one(clients, { fields: [jobs.clientId], references: [clients.id] }),
      appointment: one(appointments, { fields: [jobs.appointmentId], references: [appointments.id] }),
      service: one(services, { fields: [jobs.serviceId], references: [services.id] }),
      invoices: many(invoices)
    }));
    invoices = pgTable("invoices", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
      clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
      homeownerUserId: varchar("homeowner_user_id").references(() => users.id, { onDelete: "set null" }),
      jobId: varchar("job_id").references(() => jobs.id, { onDelete: "set null" }),
      invoiceNumber: text("invoice_number").notNull(),
      currency: text("currency").default("usd"),
      // Amount breakdown in cents for precision
      subtotalCents: integer("subtotal_cents").notNull().default(0),
      taxCents: integer("tax_cents").default(0),
      discountCents: integer("discount_cents").default(0),
      platformFeeCents: integer("platform_fee_cents").default(0),
      totalCents: integer("total_cents").notNull().default(0),
      // Legacy decimal fields for backwards compatibility
      amount: decimal("amount", { precision: 10, scale: 2 }).notNull().default("0"),
      tax: decimal("tax", { precision: 10, scale: 2 }).default("0"),
      total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0"),
      status: invoiceStatusEnum("status").default("draft"),
      dueDate: timestamp("due_date"),
      notes: text("notes"),
      lineItems: text("line_items"),
      // JSON string of line items (legacy)
      paymentMethodsAllowed: text("payment_methods_allowed").default("stripe,credits"),
      // JSON array
      // Stripe Connect fields
      stripePaymentIntentId: text("stripe_payment_intent_id"),
      stripeCheckoutSessionId: text("stripe_checkout_session_id"),
      stripePaymentLinkId: text("stripe_payment_link_id"),
      hostedInvoiceUrl: text("hosted_invoice_url"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
      sentAt: timestamp("sent_at"),
      viewedAt: timestamp("viewed_at"),
      paidAt: timestamp("paid_at")
    });
    invoicesRelations = relations(invoices, ({ one, many }) => ({
      provider: one(providers, { fields: [invoices.providerId], references: [providers.id] }),
      client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
      homeownerUser: one(users, { fields: [invoices.homeownerUserId], references: [users.id] }),
      job: one(jobs, { fields: [invoices.jobId], references: [jobs.id] }),
      payments: many(payments),
      lineItemsNormalized: many(invoiceLineItems)
    }));
    payments = pgTable("payments", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
      providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
      amountCents: integer("amount_cents").notNull().default(0),
      amount: decimal("amount", { precision: 10, scale: 2 }).notNull().default("0"),
      // Legacy
      method: paymentMethodEnum("method").default("stripe"),
      status: paymentStatusEnum("status").default("requires_payment"),
      // Stripe fields
      stripePaymentIntentId: text("stripe_payment_intent_id"),
      stripeChargeId: text("stripe_charge_id"),
      reference: text("reference"),
      // transaction ID or check number
      notes: text("notes"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    paymentsRelations = relations(payments, ({ one }) => ({
      invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
      provider: one(providers, { fields: [payments.providerId], references: [providers.id] })
    }));
    bookingLinkStatusEnum = pgEnum("booking_link_status", ["active", "paused", "disabled"]);
    quoteModeEnum = pgEnum("quote_mode", ["range", "fixed", "estimate_after_review"]);
    intakeStatusEnum = pgEnum("intake_status", ["submitted", "confirmed", "reviewed", "converted", "declined", "expired"]);
    bookingLinks = pgTable("booking_links", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      providerId: varchar("provider_id").notNull().unique().references(() => providers.id, { onDelete: "cascade" }),
      slug: text("slug").notNull().unique(),
      status: bookingLinkStatusEnum("status").default("active"),
      isActive: boolean("is_active").default(true),
      instantBooking: boolean("instant_booking").default(false),
      showPricing: boolean("show_pricing").default(true),
      customTitle: text("custom_title"),
      customDescription: text("custom_description"),
      depositRequired: boolean("deposit_required").default(false),
      depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
      depositPercentage: integer("deposit_percentage"),
      serviceCatalog: text("service_catalog"),
      availabilityRules: text("availability_rules"),
      intakeQuestions: text("intake_questions"),
      welcomeMessage: text("welcome_message"),
      confirmationMessage: text("confirmation_message"),
      brandColor: text("brand_color"),
      logoUrl: text("logo_url"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    bookingLinksRelations = relations(bookingLinks, ({ one, many }) => ({
      provider: one(providers, { fields: [bookingLinks.providerId], references: [providers.id] }),
      intakeSubmissions: many(intakeSubmissions)
    }));
    intakeSubmissions = pgTable("intake_submissions", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      bookingLinkId: varchar("booking_link_id").notNull().references(() => bookingLinks.id, { onDelete: "cascade" }),
      providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
      homeownerUserId: varchar("homeowner_user_id").references(() => users.id, { onDelete: "set null" }),
      // Client info (may or may not have an account)
      clientName: text("client_name").notNull(),
      clientPhone: text("client_phone"),
      clientEmail: text("client_email"),
      address: text("address"),
      // Problem description
      problemDescription: text("problem_description").notNull(),
      categoryId: varchar("category_id").references(() => serviceCategories.id, { onDelete: "set null" }),
      answersJson: text("answers_json"),
      // JSON: responses to intake questions
      photosJson: text("photos_json"),
      // JSON: array of photo URLs
      preferredTimesJson: text("preferred_times_json"),
      // JSON: preferred appointment times
      // Quoting
      quoteMode: quoteModeEnum("quote_mode").default("estimate_after_review"),
      quoteLow: decimal("quote_low", { precision: 10, scale: 2 }),
      quoteHigh: decimal("quote_high", { precision: 10, scale: 2 }),
      quoteFixed: decimal("quote_fixed", { precision: 10, scale: 2 }),
      // Status and conversion
      status: intakeStatusEnum("status").default("submitted"),
      convertedJobId: varchar("converted_job_id").references(() => jobs.id, { onDelete: "set null" }),
      convertedClientId: varchar("converted_client_id").references(() => clients.id, { onDelete: "set null" }),
      // Deposit payment
      depositPaid: boolean("deposit_paid").default(false),
      depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
      depositPaymentId: varchar("deposit_payment_id"),
      reviewedAt: timestamp("reviewed_at"),
      convertedAt: timestamp("converted_at"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    intakeSubmissionsRelations = relations(intakeSubmissions, ({ one }) => ({
      bookingLink: one(bookingLinks, { fields: [intakeSubmissions.bookingLinkId], references: [bookingLinks.id] }),
      provider: one(providers, { fields: [intakeSubmissions.providerId], references: [providers.id] }),
      homeownerUser: one(users, { fields: [intakeSubmissions.homeownerUserId], references: [users.id] }),
      category: one(serviceCategories, { fields: [intakeSubmissions.categoryId], references: [serviceCategories.id] }),
      convertedJob: one(jobs, { fields: [intakeSubmissions.convertedJobId], references: [jobs.id] }),
      convertedClient: one(clients, { fields: [intakeSubmissions.convertedClientId], references: [clients.id] })
    }));
    insertUserSchema = createInsertSchema(users).pick({
      email: true,
      password: true,
      firstName: true,
      lastName: true,
      phone: true
    });
    loginSchema = z.object({
      email: z.string().email(),
      password: z.string().min(6)
    });
    insertHomeSchema = createInsertSchema(homes).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertAppointmentSchema = createInsertSchema(appointments, {
      scheduledDate: z.coerce.date()
    }).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
      cancelledAt: true
    });
    insertClientSchema = createInsertSchema(clients).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertJobSchema = createInsertSchema(jobs, {
      scheduledDate: z.coerce.date()
    }).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true
    });
    insertInvoiceSchema = createInsertSchema(invoices).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      sentAt: true,
      viewedAt: true,
      paidAt: true
    });
    insertPaymentSchema = createInsertSchema(payments).omit({
      id: true,
      createdAt: true
    });
    insertProviderSchema = createInsertSchema(providers).omit({
      id: true,
      createdAt: true
    });
    insertProviderPlanSchema = createInsertSchema(providerPlans).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertStripeConnectAccountSchema = createInsertSchema(stripeConnectAccounts).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({
      id: true,
      createdAt: true
    });
    insertPayoutSchema = createInsertSchema(payouts).omit({
      id: true,
      createdAt: true
    });
    insertUserCreditsSchema = createInsertSchema(userCredits).omit({
      id: true,
      updatedAt: true
    });
    insertCreditLedgerSchema = createInsertSchema(creditLedger).omit({
      id: true,
      createdAt: true
    });
    insertBookingLinkSchema = createInsertSchema(bookingLinks).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertIntakeSubmissionSchema = createInsertSchema(intakeSubmissions).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    notificationChannelEnum = pgEnum("notification_channel", ["email", "push", "in_app", "sms"]);
    notificationDeliveryStatusEnum = pgEnum("notification_delivery_status", ["queued", "sent", "delivered", "failed", "pending_sms"]);
    pushTokens = pgTable("push_tokens", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      token: text("token").notNull(),
      platform: text("platform").notNull(),
      // ios | android
      isActive: boolean("is_active").default(true),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    notificationPreferences = pgTable("notification_preferences", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
      emailBookingConfirmation: boolean("email_booking_confirmation").default(true),
      emailBookingReminder: boolean("email_booking_reminder").default(true),
      emailBookingCancelled: boolean("email_booking_cancelled").default(true),
      emailInvoiceCreated: boolean("email_invoice_created").default(true),
      emailInvoiceReminder: boolean("email_invoice_reminder").default(true),
      emailInvoicePaid: boolean("email_invoice_paid").default(true),
      emailPaymentFailed: boolean("email_payment_failed").default(true),
      emailReviewRequest: boolean("email_review_request").default(true),
      pushEnabled: boolean("push_enabled").default(true),
      inAppEnabled: boolean("in_app_enabled").default(true),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    providerMessageTemplates = pgTable("provider_message_templates", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      subject: text("subject"),
      body: text("body").notNull(),
      eventType: text("event_type"),
      // booking_confirmation, invoice_sent, etc.
      isDefault: boolean("is_default").default(false),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    notificationDeliveries = pgTable("notification_deliveries", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      channel: notificationChannelEnum("channel").notNull(),
      status: notificationDeliveryStatusEnum("status").default("queued"),
      eventType: text("event_type").notNull(),
      recipientUserId: varchar("recipient_user_id").references(() => users.id, { onDelete: "set null" }),
      recipientEmail: text("recipient_email"),
      relatedRecordType: text("related_record_type"),
      // invoice | job | appointment | user
      relatedRecordId: varchar("related_record_id"),
      externalMessageId: text("external_message_id"),
      error: text("error"),
      metadata: text("metadata"),
      // JSON
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    messageChannelEnum = pgEnum("message_channel", ["email", "sms"]);
    messageStatusEnum = pgEnum("message_status", ["sent", "failed", "pending_sms"]);
    providerMessages = pgTable("provider_messages", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
      clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
      jobId: varchar("job_id").references(() => jobs.id, { onDelete: "set null" }),
      invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
      channel: messageChannelEnum("channel").notNull().default("email"),
      subject: text("subject"),
      body: text("body").notNull(),
      status: messageStatusEnum("status").notNull().default("sent"),
      resendMessageId: text("resend_message_id"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    providerMessagesRelations = relations(providerMessages, ({ one }) => ({
      provider: one(providers, { fields: [providerMessages.providerId], references: [providers.id] }),
      client: one(clients, { fields: [providerMessages.clientId], references: [clients.id] }),
      job: one(jobs, { fields: [providerMessages.jobId], references: [jobs.id] }),
      invoice: one(invoices, { fields: [providerMessages.invoiceId], references: [invoices.id] })
    }));
    insertProviderMessageSchema = createInsertSchema(providerMessages).omit({
      id: true,
      createdAt: true
    });
    messageTemplates = pgTable("message_templates", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      channel: messageChannelEnum("channel").notNull().default("email"),
      subject: text("subject"),
      body: text("body").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    messageTemplatesRelations = relations(messageTemplates, ({ one }) => ({
      provider: one(providers, { fields: [messageTemplates.providerId], references: [providers.id] })
    }));
    insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    leads = pgTable("leads", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      email: text("email"),
      phone: text("phone"),
      service: text("service"),
      message: text("message"),
      status: text("status").notNull().default("new"),
      source: text("source").default("direct"),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, updatedAt: true });
    insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
  }
});

// server/bookingPage.ts
var bookingPage_exports = {};
__export(bookingPage_exports, {
  renderBookingPage: () => renderBookingPage
});
import { eq as eq5, and as and5, desc as desc3 } from "drizzle-orm";
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function safeJsonInScript(value) {
  return JSON.stringify(value).replace(/<\/script/gi, "<\\/script");
}
function formatDate(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
function renderStars(rating) {
  const r = Math.round(rating ?? 0);
  let stars = "";
  for (let i = 1; i <= 5; i++) {
    stars += `<span class="star${i <= r ? " filled" : ""}">&star;</span>`;
  }
  return stars;
}
function errorPage(status, title, message) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0a0f1e;
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: rgba(255,255,255,0.06);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 20px;
      padding: 48px 40px;
      text-align: center;
      max-width: 440px;
      width: 100%;
    }
    h1 { font-size: 1.6rem; margin-bottom: 12px; }
    p { color: rgba(255,255,255,0.65); line-height: 1.6; }
    .footer { margin-top: 40px; text-align: center; font-size: 0.8rem; color: rgba(255,255,255,0.3); }
    .footer a { color: rgba(255,255,255,0.45); text-decoration: none; }
  </style>
</head>
<body>
  <div>
    <div class="card">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    </div>
    <div class="footer">Powered by <a href="https://homebaseproapp.com" target="_blank" rel="noopener">HomeBase Pro</a></div>
  </div>
</body>
</html>`;
  return { html, status };
}
async function renderBookingPage(slug, db2) {
  const [link] = await db2.select().from(bookingLinks).where(eq5(bookingLinks.slug, slug)).limit(1);
  if (!link) {
    return errorPage(404, "Provider not found", "This booking page does not exist. Please check the link and try again.");
  }
  if (link.isActive === false || link.status !== "active") {
    return errorPage(404, "Booking page unavailable", "This booking page is currently unavailable. Please contact the provider directly.");
  }
  const [provider] = await db2.select().from(providers).where(eq5(providers.id, link.providerId)).limit(1);
  if (!provider || provider.isPublic === false) {
    return errorPage(404, "Provider not found", "The provider associated with this booking page could not be found.");
  }
  const customServices = await db2.select().from(providerCustomServices).where(
    and5(
      eq5(providerCustomServices.providerId, provider.id),
      eq5(providerCustomServices.isPublished, true)
    )
  );
  const catalogServices = await db2.select({
    id: services.id,
    name: services.name,
    description: services.description,
    basePrice: services.basePrice,
    price: providerServices.price,
    providerServiceId: providerServices.id
  }).from(providerServices).innerJoin(services, eq5(providerServices.serviceId, services.id)).where(
    and5(
      eq5(providerServices.providerId, provider.id),
      eq5(services.isPublic, true)
    )
  );
  const recentReviews = await db2.select({
    id: reviews.id,
    rating: reviews.rating,
    comment: reviews.comment,
    createdAt: reviews.createdAt,
    reviewerFirstName: users.firstName
  }).from(reviews).leftJoin(users, eq5(reviews.userId, users.id)).where(eq5(reviews.providerId, provider.id)).orderBy(desc3(reviews.createdAt)).limit(5);
  const showPricing = link.showPricing !== false;
  const businessName = escapeHtml(provider.businessName ?? "Your Provider");
  const pageTitle = link.customTitle ? escapeHtml(link.customTitle) : `Book with ${businessName}`;
  const description = link.customDescription ? escapeHtml(link.customDescription) : escapeHtml(provider.description ?? `Book a service with ${businessName}.`);
  const avatarUrl = escapeHtml(provider.avatarUrl ?? "");
  const rating = provider.averageRating ?? provider.rating ?? 0;
  const reviewCount = provider.reviewCount ?? 0;
  const serviceOptions = [
    ...customServices.map((s) => ({
      id: `custom_${s.id}`,
      name: s.name ?? "Service",
      price: s.basePrice != null ? String(s.basePrice) : s.priceFrom != null ? String(s.priceFrom) : null
    })),
    ...catalogServices.map((s) => ({
      id: `catalog_${s.id}`,
      name: s.name ?? "Service",
      price: s.price != null ? String(s.price) : s.basePrice != null ? String(s.basePrice) : null
    }))
  ];
  const allServices = [
    ...customServices.map((s) => ({
      name: s.name ?? "Service",
      description: s.description ?? "",
      price: s.basePrice != null ? String(s.basePrice) : s.priceFrom != null ? String(s.priceFrom) : null
    })),
    ...catalogServices.map((s) => ({
      name: s.name ?? "Service",
      description: s.description ?? "",
      price: s.price != null ? String(s.price) : s.basePrice != null ? String(s.basePrice) : null
    }))
  ];
  const servicesHtml = allServices.length > 0 ? allServices.map((s) => `
      <div class="service-card">
        <div class="service-info">
          <div class="service-name">${escapeHtml(s.name)}</div>
          ${s.description ? `<div class="service-desc">${escapeHtml(s.description)}</div>` : ""}
        </div>
        ${showPricing && s.price ? `<div class="service-price">$${escapeHtml(s.price)}</div>` : ""}
      </div>`).join("") : `<p class="no-services">Contact us to learn about our available services.</p>`;
  const reviewsHtml = recentReviews.length > 0 ? recentReviews.map((r) => {
    const firstName = r.reviewerFirstName ? escapeHtml(r.reviewerFirstName) : "Anonymous";
    return `
        <div class="review-card">
          <div class="review-header">
            <div class="review-stars">${renderStars(r.rating)}</div>
            <div class="review-meta">
              <span class="reviewer-name">${firstName}</span>
              <span class="review-date">${formatDate(r.createdAt)}</span>
            </div>
          </div>
          ${r.comment ? `<p class="review-comment">${escapeHtml(r.comment)}</p>` : ""}
        </div>`;
  }).join("") : "";
  const jsonLdObj = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": provider.businessName ?? "",
    "description": provider.description ?? "",
    "image": provider.avatarUrl ?? "",
    ...reviewCount > 0 ? {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": rating,
        "reviewCount": reviewCount
      }
    } : {}
  };
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${pageTitle}</title>
  <meta name="description" content="${description}" />
  <meta property="og:title" content="${pageTitle}" />
  <meta property="og:description" content="${description}" />
  ${avatarUrl ? `<meta property="og:image" content="${avatarUrl}" />` : ""}
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${pageTitle}" />
  <meta name="twitter:description" content="${description}" />
  ${avatarUrl ? `<meta name="twitter:image" content="${avatarUrl}" />` : ""}
  <script type="application/ld+json">${safeJsonInScript(jsonLdObj)}</script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0a0f1e;
      --accent: #6C63FF;
      --accent-hover: #5a52e0;
      --glass-bg: rgba(255,255,255,0.06);
      --glass-border: rgba(255,255,255,0.12);
      --text: #ffffff;
      --text-muted: rgba(255,255,255,0.6);
      --text-dim: rgba(255,255,255,0.35);
      --radius: 16px;
      --radius-sm: 10px;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.6;
    }

    .page-wrapper {
      max-width: 680px;
      margin: 0 auto;
      padding: 24px 16px 80px;
    }

    .glass {
      background: var(--glass-bg);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius);
    }

    .provider-header {
      padding: 32px 28px;
      text-align: center;
      margin-bottom: 20px;
    }

    .avatar-wrap {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      overflow: hidden;
      margin: 0 auto 16px;
      border: 3px solid var(--accent);
      background: rgba(108,99,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .avatar-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-initials {
      font-size: 2rem;
      font-weight: 700;
      color: var(--accent);
    }

    .business-name {
      font-size: 1.65rem;
      font-weight: 700;
      margin-bottom: 6px;
      letter-spacing: -0.02em;
    }

    .page-title {
      font-size: 1rem;
      color: var(--accent);
      font-weight: 500;
      margin-bottom: 10px;
    }

    .provider-desc {
      color: var(--text-muted);
      font-size: 0.95rem;
      max-width: 480px;
      margin: 0 auto 16px;
    }

    .rating-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 0.9rem;
    }

    .star { color: var(--text-dim); font-size: 1rem; }
    .star.filled { color: #f5c518; }

    .rating-score { font-weight: 700; }
    .rating-count { color: var(--text-muted); }

    .section-label {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 14px;
    }

    .section-card {
      padding: 24px;
      margin-bottom: 20px;
    }

    .service-card {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 0;
      border-bottom: 1px solid var(--glass-border);
    }

    .service-card:last-child { border-bottom: none; }

    .service-name {
      font-weight: 600;
      font-size: 0.95rem;
      margin-bottom: 2px;
    }

    .service-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .service-price {
      font-weight: 700;
      color: var(--accent);
      white-space: nowrap;
      font-size: 0.95rem;
    }

    .no-services { color: var(--text-muted); font-size: 0.9rem; }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    @media (max-width: 480px) {
      .form-grid { grid-template-columns: 1fr; }
      .provider-header { padding: 24px 18px; }
      .section-card { padding: 18px; }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group.full-width {
      grid-column: 1 / -1;
    }

    label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    input, select, textarea {
      background: rgba(255,255,255,0.07);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 0.95rem;
      padding: 11px 14px;
      outline: none;
      transition: border-color 0.2s;
      font-family: inherit;
      width: 100%;
      -webkit-appearance: none;
      appearance: none;
    }

    select {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23ffffff80' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C%2Fsvg%3E");
      background-repeat: no-repeat;
      background-position: right 14px center;
      padding-right: 36px;
    }

    select option { background: #1a2040; color: #fff; }

    textarea { resize: vertical; min-height: 90px; }

    input:focus, select:focus, textarea:focus {
      border-color: var(--accent);
    }

    input.error, select.error, textarea.error {
      border-color: #ff4d6d;
    }

    .field-error {
      font-size: 0.76rem;
      color: #ff4d6d;
      margin-top: 2px;
      display: none;
    }

    .field-error.visible { display: block; }

    .submit-btn {
      width: 100%;
      padding: 14px;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      margin-top: 20px;
      transition: background 0.2s, transform 0.1s;
      font-family: inherit;
    }

    .submit-btn:hover { background: var(--accent-hover); }
    .submit-btn:active { transform: scale(0.99); }
    .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .form-error {
      margin-top: 12px;
      padding: 12px 16px;
      background: rgba(255,77,109,0.12);
      border: 1px solid rgba(255,77,109,0.3);
      border-radius: var(--radius-sm);
      color: #ff4d6d;
      font-size: 0.88rem;
      display: none;
    }

    .form-error.visible { display: block; }

    .confirmation-card {
      padding: 40px 28px;
      text-align: center;
      display: none;
      margin-bottom: 20px;
    }

    .confirmation-card.visible { display: block; }

    .checkmark {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(108,99,255,0.2);
      border: 2px solid var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 2rem;
    }

    .confirmation-card h2 {
      font-size: 1.5rem;
      margin-bottom: 10px;
    }

    .confirmation-card p {
      color: var(--text-muted);
      margin-bottom: 6px;
      font-size: 0.95rem;
    }

    .summary-box {
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-sm);
      padding: 16px;
      margin: 20px 0;
      text-align: left;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.88rem;
      padding: 4px 0;
      color: var(--text-muted);
    }

    .summary-row strong { color: var(--text); }

    .app-cta {
      margin-top: 24px;
      padding: 14px 20px;
      background: rgba(108,99,255,0.15);
      border: 1px solid rgba(108,99,255,0.3);
      border-radius: var(--radius-sm);
    }

    .app-cta p {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 10px;
    }

    .app-cta a {
      display: inline-block;
      background: var(--accent);
      color: #fff;
      text-decoration: none;
      padding: 10px 22px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
      transition: background 0.2s;
    }

    .app-cta a:hover { background: var(--accent-hover); }

    .review-card {
      padding: 16px 0;
      border-bottom: 1px solid var(--glass-border);
    }

    .review-card:last-child { border-bottom: none; }

    .review-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 6px;
    }

    .review-stars { display: flex; gap: 2px; }

    .review-meta {
      display: flex;
      gap: 10px;
      font-size: 0.82rem;
      align-items: center;
    }

    .reviewer-name { font-weight: 600; }
    .review-date { color: var(--text-muted); }

    .review-comment {
      font-size: 0.9rem;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .footer {
      text-align: center;
      padding: 32px 0 0;
      font-size: 0.8rem;
      color: var(--text-dim);
    }

    .footer a {
      color: var(--accent);
      text-decoration: none;
    }

    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="page-wrapper">

    <!-- Provider Header -->
    <div class="glass provider-header">
      <div class="avatar-wrap">
        ${avatarUrl ? `<img src="${avatarUrl}" alt="${businessName}" loading="lazy" />` : `<span class="avatar-initials">${escapeHtml((provider.businessName ?? "P")[0].toUpperCase())}</span>`}
      </div>
      <div class="business-name">${businessName}</div>
      <div class="page-title">${pageTitle}</div>
      ${description ? `<p class="provider-desc">${description}</p>` : ""}
      ${reviewCount > 0 ? `
      <div class="rating-row">
        <div>${renderStars(Number(rating))}</div>
        <span class="rating-score">${Number(rating).toFixed(1)}</span>
        <span class="rating-count">(${reviewCount} review${reviewCount !== 1 ? "s" : ""})</span>
      </div>` : ""}
    </div>

    <!-- Services Section -->
    <div class="glass section-card">
      <div class="section-label">Services</div>
      ${servicesHtml}
    </div>

    <!-- Booking Form -->
    <div class="glass section-card" id="booking-section">
      <div class="section-label">Request an Appointment</div>
      <form id="booking-form" novalidate>
        <div class="form-grid">
          <div class="form-group">
            <label for="firstName">First Name *</label>
            <input type="text" id="firstName" name="firstName" placeholder="Jane" autocomplete="given-name" />
            <span class="field-error" id="firstName-error">Please enter your first name.</span>
          </div>
          <div class="form-group">
            <label for="lastName">Last Name *</label>
            <input type="text" id="lastName" name="lastName" placeholder="Smith" autocomplete="family-name" />
            <span class="field-error" id="lastName-error">Please enter your last name.</span>
          </div>
          <div class="form-group">
            <label for="clientEmail">Email *</label>
            <input type="email" id="clientEmail" name="clientEmail" placeholder="jane@example.com" autocomplete="email" />
            <span class="field-error" id="clientEmail-error">Please enter a valid email.</span>
          </div>
          <div class="form-group">
            <label for="clientPhone">Phone</label>
            <input type="tel" id="clientPhone" name="clientPhone" placeholder="(555) 000-0000" autocomplete="tel" />
          </div>
          <div class="form-group full-width">
            <label for="serviceSelect">Service *</label>
            <select id="serviceSelect" name="serviceSelect">
              <option value="">-- Select a service --</option>
            </select>
            <span class="field-error" id="serviceSelect-error">Please select a service.</span>
          </div>
          <div class="form-group">
            <label for="preferredDate">Preferred Date *</label>
            <input type="date" id="preferredDate" name="preferredDate" />
            <span class="field-error" id="preferredDate-error">Please select a date.</span>
          </div>
          <div class="form-group">
            <label for="preferredTime">Preferred Time *</label>
            <select id="preferredTime" name="preferredTime">
              <option value="">-- Select a time --</option>
            </select>
            <span class="field-error" id="preferredTime-error">Please select a time.</span>
          </div>
          <div class="form-group full-width">
            <label for="notes">Notes</label>
            <textarea id="notes" name="notes" placeholder="Describe what you need help with..."></textarea>
          </div>
        </div>
        <button type="submit" class="submit-btn" id="submit-btn">Request Appointment</button>
        <div class="form-error" id="form-error"></div>
      </form>
    </div>

    <!-- Confirmation Card (hidden until success) -->
    <div class="glass confirmation-card" id="confirmation-card">
      <div class="checkmark">&#10003;</div>
      <h2>You're booked!</h2>
      <p>Your request has been submitted. ${businessName} will be in touch soon.</p>
      <div class="summary-box" id="summary-box"></div>
      <div class="app-cta">
        <p>Track your appointment and get updates in the HomeBase Pro app.</p>
        <a href="https://apps.apple.com/app/homebase-pro/id6739456140" target="_blank" rel="noopener">Download on the App Store</a>
      </div>
    </div>

    ${recentReviews.length > 0 ? `
    <!-- Reviews Section -->
    <div class="glass section-card">
      <div class="section-label">Recent Reviews</div>
      ${reviewsHtml}
    </div>` : ""}

    <div class="footer">
      Powered by <a href="https://homebaseproapp.com" target="_blank" rel="noopener">HomeBase Pro</a>
    </div>
  </div>

  <script>
    (function() {
      var slug = ${safeJsonInScript(slug)};
      var serviceOptions = ${safeJsonInScript(serviceOptions)};
      var showPricing = ${showPricing ? "true" : "false"};

      // Populate service dropdown
      var serviceSelect = document.getElementById('serviceSelect');
      serviceOptions.forEach(function(s) {
        var opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name + (showPricing && s.price ? ' \u2014 $' + s.price : '');
        serviceSelect.appendChild(opt);
      });

      // Populate time dropdown (8:00 AM - 8:00 PM, 30-min increments)
      var timeSelect = document.getElementById('preferredTime');
      for (var h = 8; h <= 20; h++) {
        for (var m = 0; m < 60; m += 30) {
          if (h === 20 && m > 0) break;
          var hour12 = h % 12 || 12;
          var ampm = h < 12 ? 'AM' : 'PM';
          var minStr = m === 0 ? '00' : '30';
          var label = hour12 + ':' + minStr + ' ' + ampm;
          var value = (h < 10 ? '0' : '') + h + ':' + minStr;
          var opt = document.createElement('option');
          opt.value = value;
          opt.textContent = label;
          timeSelect.appendChild(opt);
        }
      }

      // Set min date to today
      var today = new Date();
      var yyyy = today.getFullYear();
      var mm = String(today.getMonth() + 1).padStart(2, '0');
      var dd = String(today.getDate()).padStart(2, '0');
      document.getElementById('preferredDate').min = yyyy + '-' + mm + '-' + dd;

      // Validation helpers
      function setError(fieldId, show) {
        var el = document.getElementById(fieldId);
        var err = document.getElementById(fieldId + '-error');
        if (show) {
          el.classList.add('error');
          if (err) err.classList.add('visible');
        } else {
          el.classList.remove('error');
          if (err) err.classList.remove('visible');
        }
      }

      function clearErrors() {
        ['firstName','lastName','clientEmail','serviceSelect','preferredDate','preferredTime'].forEach(function(id) {
          setError(id, false);
        });
        var fe = document.getElementById('form-error');
        fe.classList.remove('visible');
        fe.textContent = '';
      }

      function isValidEmail(email) {
        return /^[^s@]+@[^s@]+.[^s@]+$/.test(email);
      }

      function validate(data) {
        var valid = true;
        if (!data.firstName.trim()) { setError('firstName', true); valid = false; }
        if (!data.lastName.trim()) { setError('lastName', true); valid = false; }
        if (!data.clientEmail.trim() || !isValidEmail(data.clientEmail.trim())) {
          setError('clientEmail', true); valid = false;
        }
        if (!data.serviceId) { setError('serviceSelect', true); valid = false; }
        if (!data.date) { setError('preferredDate', true); valid = false; }
        if (!data.time) { setError('preferredTime', true); valid = false; }
        return valid;
      }

      function escHtml(str) {
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      // Form submit
      document.getElementById('booking-form').addEventListener('submit', function(e) {
        e.preventDefault();
        clearErrors();

        var firstName = document.getElementById('firstName').value;
        var lastName = document.getElementById('lastName').value;
        var clientEmail = document.getElementById('clientEmail').value;
        var clientPhone = document.getElementById('clientPhone').value;
        var serviceSelectEl = document.getElementById('serviceSelect');
        var serviceId = serviceSelectEl.value;
        var serviceLabel = serviceSelectEl.selectedIndex >= 0 ? serviceSelectEl.options[serviceSelectEl.selectedIndex].textContent : '';
        var date = document.getElementById('preferredDate').value;
        var timeSelectEl = document.getElementById('preferredTime');
        var time = timeSelectEl.value;
        var timeLabel = timeSelectEl.selectedIndex >= 0 ? timeSelectEl.options[timeSelectEl.selectedIndex].textContent : '';
        var notes = document.getElementById('notes').value;

        var data = { firstName: firstName, lastName: lastName, clientEmail: clientEmail, clientPhone: clientPhone, serviceId: serviceId, serviceLabel: serviceLabel, date: date, time: time, notes: notes };

        if (!validate(data)) return;

        var btn = document.getElementById('submit-btn');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        var body = {
          clientName: firstName.trim() + ' ' + lastName.trim(),
          clientEmail: clientEmail.trim(),
          clientPhone: clientPhone.trim() || undefined,
          problemDescription: notes.trim() || serviceLabel.replace(/s*\u2014s*$[d.]+$/, '').trim(),
          preferredTimesJson: JSON.stringify([{ date: date, time: time }]),
        };

        fetch('/api/book/' + slug + '/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
          .then(function(res) {
            if (!res.ok) {
              return res.text().then(function(text) {
                var msg = 'Submission failed. Please try again.';
                try { var j = JSON.parse(text); msg = j.error || msg; } catch (_) {}
                throw new Error(msg);
              });
            }
            return res.json();
          })
          .then(function() {
            document.getElementById('booking-section').style.display = 'none';

            var summary = document.getElementById('summary-box');
            summary.innerHTML =
              '<div class="summary-row"><span>Name</span><strong>' + escHtml(firstName + ' ' + lastName) + '</strong></div>' +
              '<div class="summary-row"><span>Email</span><strong>' + escHtml(clientEmail) + '</strong></div>' +
              (clientPhone.trim() ? '<div class="summary-row"><span>Phone</span><strong>' + escHtml(clientPhone) + '</strong></div>' : '') +
              '<div class="summary-row"><span>Service</span><strong>' + escHtml(serviceLabel) + '</strong></div>' +
              '<div class="summary-row"><span>Date</span><strong>' + escHtml(date) + '</strong></div>' +
              '<div class="summary-row"><span>Time</span><strong>' + escHtml(timeLabel) + '</strong></div>';

            document.getElementById('confirmation-card').classList.add('visible');
          })
          .catch(function(err) {
            btn.disabled = false;
            btn.textContent = 'Request Appointment';
            var fe = document.getElementById('form-error');
            fe.textContent = err.message || 'Something went wrong. Please try again.';
            fe.classList.add('visible');
          });
      });
    })();
  </script>
</body>
</html>`;
  return { html, status: 200 };
}
var init_bookingPage = __esm({
  "server/bookingPage.ts"() {
    "use strict";
    init_schema();
  }
});

// server/index.ts
import express from "express";
import cookieParser from "cookie-parser";
import { createProxyMiddleware } from "http-proxy-middleware";

// server/routes.ts
import { createServer } from "node:http";

// server/openai.ts
import OpenAI from "openai";
var openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
});
var HOMEBASE_SYSTEM_PROMPT = `You are HomeBase AI, a friendly and knowledgeable home services assistant. You help homeowners with:

- Finding the right service providers (plumbers, electricians, cleaners, landscapers, etc.)
- Home maintenance tips and advice
- Emergency home repair guidance
- Budget planning for home projects
- Understanding home systems and when they need attention
- Seasonal home maintenance reminders

Keep your responses concise, helpful, and focused on home-related topics. If someone asks about something unrelated to home services or maintenance, gently redirect them to home-related topics.

Be warm and supportive - homeownership can be overwhelming, and you're here to make it easier.`;
var PROVIDER_ASSISTANT_PROMPT = `You are HomeBase Pro Assistant, an AI business assistant for home service providers. You help service professionals manage and grow their business by:

- Analyzing business performance and providing insights
- Helping draft professional invoices and quotes
- Managing client relationships and communication
- Scheduling and organizing jobs efficiently
- Providing tips for growing their service business
- Answering questions about best practices in the home services industry

When the user provides business context, use it to give personalized, relevant advice. Keep responses concise and actionable.

If asked to perform an action (like creating an invoice or scheduling a job), acknowledge the request and explain what information you need to help them. Guide them through the process step by step.

Be professional yet friendly - running a service business is challenging, and you're here to help them succeed.`;

// server/storage.ts
init_schema();

// server/db.ts
init_schema();
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
var { Pool } = pg;
var databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "SUPABASE_DATABASE_URL or DATABASE_URL must be set. Did you forget to configure a database?"
  );
}
var pool = new Pool({
  connectionString: databaseUrl
});
var db = drizzle(pool, { schema: schema_exports });

// server/storage.ts
import { eq, and, desc, gte } from "drizzle-orm";
import { hash, compare } from "bcryptjs";
var SALT_ROUNDS = 10;
var DatabaseStorage = class {
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || void 0;
  }
  async createUser(insertUser) {
    const hashedPassword = await hash(insertUser.password, SALT_ROUNDS);
    const [user] = await db.insert(users).values({ ...insertUser, password: hashedPassword }).returning();
    return user;
  }
  async updateUser(id, data) {
    const updateData = { ...data, updatedAt: /* @__PURE__ */ new Date() };
    if (data.password) {
      updateData.password = await hash(data.password, SALT_ROUNDS);
    }
    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user || void 0;
  }
  async verifyPassword(email, password) {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    const valid = await compare(password, user.password);
    return valid ? user : null;
  }
  async getHomes(userId) {
    return db.select().from(homes).where(eq(homes.userId, userId)).orderBy(desc(homes.isDefault));
  }
  async getHome(id) {
    const [home] = await db.select().from(homes).where(eq(homes.id, id));
    return home || void 0;
  }
  async createHome(home) {
    if (home.isDefault) {
      await db.update(homes).set({ isDefault: false }).where(eq(homes.userId, home.userId));
    }
    const [newHome] = await db.insert(homes).values(home).returning();
    return newHome;
  }
  async updateHome(id, data) {
    const updateData = { ...data, updatedAt: /* @__PURE__ */ new Date() };
    const [home] = await db.update(homes).set(updateData).where(eq(homes.id, id)).returning();
    return home || void 0;
  }
  async deleteHome(id) {
    const result = await db.delete(homes).where(eq(homes.id, id)).returning();
    return result.length > 0;
  }
  async getCategories() {
    return db.select().from(serviceCategories).orderBy(serviceCategories.sortOrder);
  }
  async getServices(categoryId) {
    if (categoryId) {
      return db.select().from(services).where(eq(services.categoryId, categoryId));
    }
    return db.select().from(services);
  }
  async getProviders(categoryId) {
    if (categoryId) {
      const providerIds = await db.select({ providerId: providerServices.providerId }).from(providerServices).where(eq(providerServices.categoryId, categoryId));
      if (providerIds.length === 0) return [];
      const uniqueIds = [...new Set(providerIds.map((p) => p.providerId))];
      const results = [];
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
  async getProvider(id) {
    const [provider] = await db.select().from(providers).where(eq(providers.id, id));
    return provider || void 0;
  }
  async getProviderServices(providerId) {
    const ps = await db.select({ serviceId: providerServices.serviceId }).from(providerServices).where(eq(providerServices.providerId, providerId));
    const results = [];
    for (const { serviceId } of ps) {
      const [service] = await db.select().from(services).where(eq(services.id, serviceId));
      if (service) results.push(service);
    }
    return results;
  }
  async getAppointments(userId) {
    return db.select().from(appointments).where(eq(appointments.userId, userId)).orderBy(desc(appointments.scheduledDate));
  }
  async getAppointment(id) {
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, id));
    return appointment || void 0;
  }
  async createAppointment(appointment) {
    const [newAppointment] = await db.insert(appointments).values(appointment).returning();
    return newAppointment;
  }
  async updateAppointment(id, data) {
    const updateData = { ...data, updatedAt: /* @__PURE__ */ new Date() };
    const [appointment] = await db.update(appointments).set(updateData).where(eq(appointments.id, id)).returning();
    return appointment || void 0;
  }
  async cancelAppointment(id) {
    const [appointment] = await db.update(appointments).set({ status: "cancelled", cancelledAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq(appointments.id, id)).returning();
    return appointment || void 0;
  }
  async getNotifications(userId) {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }
  async getNotification(id) {
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification;
  }
  async markNotificationRead(id) {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }
  async createNotification(userId, title, message, type, data) {
    const [notification] = await db.insert(notifications).values({ userId, title, message, type, data }).returning();
    return notification;
  }
  // Provider methods
  async createProvider(provider) {
    const [newProvider] = await db.insert(providers).values(provider).returning();
    return newProvider;
  }
  async getProviderByUserId(userId) {
    const [provider] = await db.select().from(providers).where(eq(providers.userId, userId));
    return provider || void 0;
  }
  async updateProvider(id, data) {
    const [provider] = await db.update(providers).set(data).where(eq(providers.id, id)).returning();
    return provider || void 0;
  }
  // Client methods
  async getClients(providerId) {
    return db.select().from(clients).where(eq(clients.providerId, providerId)).orderBy(desc(clients.createdAt));
  }
  async getClient(id) {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || void 0;
  }
  async createClient(client) {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }
  async updateClient(id, data) {
    const updateData = { ...data, updatedAt: /* @__PURE__ */ new Date() };
    const [client] = await db.update(clients).set(updateData).where(eq(clients.id, id)).returning();
    return client || void 0;
  }
  async deleteClient(id) {
    const result = await db.delete(clients).where(eq(clients.id, id)).returning();
    return result.length > 0;
  }
  // Job methods
  async getJobs(providerId) {
    return db.select().from(jobs).where(eq(jobs.providerId, providerId)).orderBy(desc(jobs.scheduledDate));
  }
  async getJobsByClient(clientId) {
    return db.select().from(jobs).where(eq(jobs.clientId, clientId)).orderBy(desc(jobs.scheduledDate));
  }
  async getJob(id) {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job || void 0;
  }
  async createJob(job) {
    const [newJob] = await db.insert(jobs).values(job).returning();
    return newJob;
  }
  async updateJob(id, data) {
    const updateData = { ...data, updatedAt: /* @__PURE__ */ new Date() };
    const [job] = await db.update(jobs).set(updateData).where(eq(jobs.id, id)).returning();
    return job || void 0;
  }
  async completeJob(id, finalPrice) {
    const updateData = {
      status: "completed",
      completedAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (finalPrice) updateData.finalPrice = finalPrice;
    const [job] = await db.update(jobs).set(updateData).where(eq(jobs.id, id)).returning();
    return job || void 0;
  }
  async deleteJob(id) {
    const result = await db.delete(jobs).where(eq(jobs.id, id)).returning();
    return result.length > 0;
  }
  // Invoice methods
  async getInvoices(providerId) {
    return db.select().from(invoices).where(eq(invoices.providerId, providerId)).orderBy(desc(invoices.createdAt));
  }
  async getInvoicesByClient(clientId) {
    return db.select().from(invoices).where(eq(invoices.clientId, clientId)).orderBy(desc(invoices.createdAt));
  }
  async getInvoice(id) {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || void 0;
  }
  async createInvoice(invoice) {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();
    return newInvoice;
  }
  async updateInvoice(id, data) {
    const [invoice] = await db.update(invoices).set(data).where(eq(invoices.id, id)).returning();
    return invoice || void 0;
  }
  async sendInvoice(id) {
    const [invoice] = await db.update(invoices).set({ status: "sent", sentAt: /* @__PURE__ */ new Date() }).where(eq(invoices.id, id)).returning();
    return invoice || void 0;
  }
  async markInvoicePaid(id) {
    const [invoice] = await db.update(invoices).set({ status: "paid", paidAt: /* @__PURE__ */ new Date() }).where(eq(invoices.id, id)).returning();
    return invoice || void 0;
  }
  async cancelInvoice(id) {
    const [invoice] = await db.update(invoices).set({ status: "cancelled" }).where(eq(invoices.id, id)).returning();
    return invoice || void 0;
  }
  // Payment methods
  async getPayments(providerId) {
    return db.select().from(payments).where(eq(payments.providerId, providerId)).orderBy(desc(payments.createdAt));
  }
  async getPaymentsByInvoice(invoiceId) {
    return db.select().from(payments).where(eq(payments.invoiceId, invoiceId));
  }
  async createPayment(payment) {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    await this.markInvoicePaid(payment.invoiceId);
    return newPayment;
  }
  // Provider dashboard stats
  async getProviderStats(providerId) {
    const startOfMonth = /* @__PURE__ */ new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const paidInvoices = await db.select({ total: invoices.total }).from(invoices).where(
      and(
        eq(invoices.providerId, providerId),
        eq(invoices.status, "paid"),
        gte(invoices.paidAt, startOfMonth)
      )
    );
    const revenueMTD = paidInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || "0"), 0);
    const completedJobs = await db.select({ id: jobs.id }).from(jobs).where(
      and(
        eq(jobs.providerId, providerId),
        eq(jobs.status, "completed"),
        gte(jobs.completedAt, startOfMonth)
      )
    );
    const jobsCompleted = completedJobs.length;
    const clientList = await this.getClients(providerId);
    const activeClients = clientList.length;
    const now = /* @__PURE__ */ new Date();
    const upcomingJobsList = await db.select({ id: jobs.id }).from(jobs).where(
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
  async getNextInvoiceNumber(providerId) {
    const existingInvoices = await db.select({ invoiceNumber: invoices.invoiceNumber }).from(invoices).where(eq(invoices.providerId, providerId));
    const nextNum = existingInvoices.length + 1;
    return `INV-${String(nextNum).padStart(4, "0")}`;
  }
  // Booking Links
  async getBookingLink(id) {
    const [link] = await db.select().from(bookingLinks).where(eq(bookingLinks.id, id));
    return link || void 0;
  }
  async getBookingLinkBySlug(slug) {
    const [link] = await db.select().from(bookingLinks).where(eq(bookingLinks.slug, slug));
    return link || void 0;
  }
  async getBookingLinksByProvider(providerId) {
    return await db.select().from(bookingLinks).where(eq(bookingLinks.providerId, providerId));
  }
  async createBookingLink(data) {
    const [link] = await db.insert(bookingLinks).values(data).returning();
    return link;
  }
  async updateBookingLink(id, data) {
    const [link] = await db.update(bookingLinks).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(bookingLinks.id, id)).returning();
    return link || void 0;
  }
  async deleteBookingLink(id) {
    const result = await db.delete(bookingLinks).where(eq(bookingLinks.id, id));
    return true;
  }
  // Intake Submissions
  async getIntakeSubmission(id) {
    const [submission] = await db.select().from(intakeSubmissions).where(eq(intakeSubmissions.id, id));
    return submission || void 0;
  }
  async getIntakeSubmissionsByProvider(providerId) {
    return await db.select().from(intakeSubmissions).where(eq(intakeSubmissions.providerId, providerId)).orderBy(desc(intakeSubmissions.createdAt));
  }
  async getIntakeSubmissionsByBookingLink(bookingLinkId) {
    return await db.select().from(intakeSubmissions).where(eq(intakeSubmissions.bookingLinkId, bookingLinkId)).orderBy(desc(intakeSubmissions.createdAt));
  }
  async createIntakeSubmission(data) {
    const [submission] = await db.insert(intakeSubmissions).values(data).returning();
    return submission;
  }
  async updateIntakeSubmission(id, data) {
    const [submission] = await db.update(intakeSubmissions).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(intakeSubmissions.id, id)).returning();
    return submission || void 0;
  }
  async getNotificationPreferences(userId) {
    const [prefs] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
    return prefs || void 0;
  }
  async upsertNotificationPreferences(userId, data) {
    const existing = await this.getNotificationPreferences(userId);
    if (existing) {
      const [updated] = await db.update(notificationPreferences).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(notificationPreferences.userId, userId)).returning();
      return updated;
    }
    const [created] = await db.insert(notificationPreferences).values({ userId, ...data }).returning();
    return created;
  }
};
var storage = new DatabaseStorage();

// server/seed.ts
init_schema();
import bcrypt from "bcryptjs";
var TEST_USER_EMAIL = "test@homebase.com";
var TEST_USER_PASSWORD = "test123";
var TEST_USER_ID = "test-user-001";
var TEST_HOME_ID = "test-home-001";
async function seedDatabase() {
  const existingCategories = await db.select().from(serviceCategories);
  if (existingCategories.length > 0) {
    console.log("Database already seeded");
    return;
  }
  console.log("Seeding database...");
  const categoryData = [
    { id: "plumbing", name: "Plumbing", description: "Pipe repairs, water heaters, drains", icon: "droplet", sortOrder: 1 },
    { id: "hvac", name: "HVAC", description: "Heating, cooling, ventilation", icon: "thermometer", sortOrder: 2 },
    { id: "electrical", name: "Electrical", description: "Wiring, outlets, lighting", icon: "zap", sortOrder: 3 },
    { id: "cleaning", name: "Cleaning", description: "House cleaning services", icon: "home", sortOrder: 4 },
    { id: "lawn", name: "Lawn Care", description: "Mowing, landscaping, maintenance", icon: "scissors", sortOrder: 5 },
    { id: "roofing", name: "Roofing", description: "Roof repairs and installation", icon: "cloud", sortOrder: 6 },
    { id: "painting", name: "Painting", description: "Interior and exterior painting", icon: "edit-3", sortOrder: 7 },
    { id: "handyman", name: "Handyman", description: "General repairs and fixes", icon: "tool", sortOrder: 8 }
  ];
  await db.insert(serviceCategories).values(categoryData);
  const serviceData = [
    { id: "s1", categoryId: "plumbing", name: "Drain Cleaning", description: "Clear clogged drains", basePrice: "75.00" },
    { id: "s2", categoryId: "plumbing", name: "Leak Repair", description: "Fix pipe leaks", basePrice: "125.00" },
    { id: "s3", categoryId: "plumbing", name: "Water Heater Service", description: "Repair or replace water heaters", basePrice: "200.00" },
    { id: "s4", categoryId: "hvac", name: "AC Repair", description: "Air conditioning repair", basePrice: "150.00" },
    { id: "s5", categoryId: "hvac", name: "Furnace Tune-up", description: "Annual furnace maintenance", basePrice: "125.00" },
    { id: "s6", categoryId: "hvac", name: "Duct Cleaning", description: "Clean air ducts", basePrice: "300.00" },
    { id: "s7", categoryId: "electrical", name: "Outlet Installation", description: "Install new outlets", basePrice: "85.00" },
    { id: "s8", categoryId: "electrical", name: "Panel Upgrade", description: "Electrical panel upgrade", basePrice: "1500.00" },
    { id: "s9", categoryId: "cleaning", name: "Deep Clean", description: "Thorough house cleaning", basePrice: "200.00" },
    { id: "s10", categoryId: "cleaning", name: "Regular Cleaning", description: "Weekly/biweekly cleaning", basePrice: "100.00" },
    { id: "s11", categoryId: "lawn", name: "Lawn Mowing", description: "Regular lawn mowing", basePrice: "50.00" },
    { id: "s12", categoryId: "lawn", name: "Landscaping", description: "Landscape design and installation", basePrice: "500.00" },
    { id: "s13", categoryId: "roofing", name: "Roof Inspection", description: "Comprehensive roof inspection", basePrice: "150.00" },
    { id: "s14", categoryId: "roofing", name: "Roof Repair", description: "Fix roof damage", basePrice: "400.00" },
    { id: "s15", categoryId: "painting", name: "Interior Painting", description: "Paint rooms", basePrice: "300.00" },
    { id: "s16", categoryId: "painting", name: "Exterior Painting", description: "Exterior house painting", basePrice: "1200.00" },
    { id: "s17", categoryId: "handyman", name: "General Repairs", description: "Small repairs and fixes", basePrice: "75.00" },
    { id: "s18", categoryId: "handyman", name: "Furniture Assembly", description: "Assemble furniture", basePrice: "60.00" }
  ];
  await db.insert(services).values(serviceData);
  const providerData = [
    { id: "p1", businessName: "Quick Plumb Pro", description: "Fast, reliable plumbing services with 24/7 emergency availability", phone: "555-0101", email: "info@quickplumbpro.com", rating: "4.8", reviewCount: 156, hourlyRate: "85.00", isVerified: true, serviceArea: "Metro Area", yearsExperience: 12, capabilityTags: ["24/7 Emergency", "Licensed", "Insured", "Residential", "Commercial"] },
    { id: "p2", businessName: "Cool Air HVAC", description: "Expert heating and cooling solutions for your home", phone: "555-0102", email: "service@coolairhvac.com", rating: "4.9", reviewCount: 89, hourlyRate: "95.00", isVerified: true, serviceArea: "Metro Area", yearsExperience: 15, capabilityTags: ["EPA Certified", "Licensed", "Insured", "Same Day Service", "Energy Efficient"] },
    { id: "p3", businessName: "Spark Electric", description: "Licensed electricians for all your electrical needs", phone: "555-0103", email: "hello@sparkelectric.com", rating: "4.7", reviewCount: 112, hourlyRate: "90.00", isVerified: true, serviceArea: "Metro Area", yearsExperience: 8, capabilityTags: ["Master Electrician", "Licensed", "Insured", "Smart Home", "EV Chargers"] },
    { id: "p4", businessName: "Sparkle Clean Co", description: "Professional cleaning services that make your home shine", phone: "555-0104", email: "book@sparkleclean.com", rating: "4.6", reviewCount: 234, hourlyRate: "45.00", isVerified: true, serviceArea: "Metro Area", yearsExperience: 5, capabilityTags: ["Eco-Friendly", "Bonded", "Deep Clean", "Move In/Out", "Pet Friendly"] },
    { id: "p5", businessName: "Green Thumb Lawn", description: "Beautiful lawns and landscapes, guaranteed", phone: "555-0105", email: "info@greenthumb.com", rating: "4.8", reviewCount: 67, hourlyRate: "55.00", isVerified: true, serviceArea: "Metro Area", yearsExperience: 10, capabilityTags: ["Licensed", "Insured", "Organic Options", "Hardscaping", "Irrigation"] },
    { id: "p6", businessName: "Top Roof Solutions", description: "Expert roofing repairs and installations", phone: "555-0106", email: "contact@toproof.com", rating: "4.9", reviewCount: 45, hourlyRate: "100.00", isVerified: true, serviceArea: "Metro Area", yearsExperience: 20, capabilityTags: ["Licensed", "Insured", "Storm Damage", "Free Estimates", "Warranty"] },
    { id: "p7", businessName: "Color Masters Painting", description: "Transform your space with professional painting", phone: "555-0107", email: "quote@colormasters.com", rating: "4.7", reviewCount: 78, hourlyRate: "65.00", isVerified: true, serviceArea: "Metro Area", yearsExperience: 7, capabilityTags: ["Licensed", "Insured", "Low VOC", "Interior", "Exterior"] },
    { id: "p8", businessName: "Handy Helper", description: "Your go-to for all small repairs and fixes", phone: "555-0108", email: "help@handyhelper.com", rating: "4.5", reviewCount: 189, hourlyRate: "50.00", isVerified: true, serviceArea: "Metro Area", yearsExperience: 6, capabilityTags: ["Insured", "Flexible Hours", "Small Jobs", "Furniture Assembly", "Mounting"] }
  ];
  await db.insert(providers).values(providerData);
  const providerServiceData = [
    { providerId: "p1", serviceId: "s1", categoryId: "plumbing", price: "75.00" },
    { providerId: "p1", serviceId: "s2", categoryId: "plumbing", price: "125.00" },
    { providerId: "p1", serviceId: "s3", categoryId: "plumbing", price: "200.00" },
    { providerId: "p2", serviceId: "s4", categoryId: "hvac", price: "150.00" },
    { providerId: "p2", serviceId: "s5", categoryId: "hvac", price: "125.00" },
    { providerId: "p2", serviceId: "s6", categoryId: "hvac", price: "300.00" },
    { providerId: "p3", serviceId: "s7", categoryId: "electrical", price: "85.00" },
    { providerId: "p3", serviceId: "s8", categoryId: "electrical", price: "1500.00" },
    { providerId: "p4", serviceId: "s9", categoryId: "cleaning", price: "200.00" },
    { providerId: "p4", serviceId: "s10", categoryId: "cleaning", price: "100.00" },
    { providerId: "p5", serviceId: "s11", categoryId: "lawn", price: "50.00" },
    { providerId: "p5", serviceId: "s12", categoryId: "lawn", price: "500.00" },
    { providerId: "p6", serviceId: "s13", categoryId: "roofing", price: "150.00" },
    { providerId: "p6", serviceId: "s14", categoryId: "roofing", price: "400.00" },
    { providerId: "p7", serviceId: "s15", categoryId: "painting", price: "300.00" },
    { providerId: "p7", serviceId: "s16", categoryId: "painting", price: "1200.00" },
    { providerId: "p8", serviceId: "s17", categoryId: "handyman", price: "75.00" },
    { providerId: "p8", serviceId: "s18", categoryId: "handyman", price: "60.00" }
  ];
  await db.insert(providerServices).values(providerServiceData);
  const hashedPassword = await bcrypt.hash(TEST_USER_PASSWORD, 10);
  await db.insert(users).values({
    id: TEST_USER_ID,
    email: TEST_USER_EMAIL,
    password: hashedPassword,
    firstName: "Demo",
    lastName: "User",
    phone: "555-0000"
  });
  await db.insert(homes).values({
    id: TEST_HOME_ID,
    userId: TEST_USER_ID,
    label: "Main Home",
    street: "123 Test Street",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
    propertyType: "single_family",
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
    yearBuilt: 1985,
    isDefault: true
  });
  const now = /* @__PURE__ */ new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const lastWeek = new Date(now);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const appointmentData = [
    {
      id: "appt-test-1",
      userId: TEST_USER_ID,
      homeId: TEST_HOME_ID,
      providerId: "p1",
      serviceId: "s2",
      serviceName: "Leak Repair",
      description: "Kitchen sink is leaking under the cabinet",
      urgency: "soon",
      jobSize: "small",
      scheduledDate: tomorrow,
      scheduledTime: "10:00 AM",
      status: "confirmed",
      estimatedPrice: "125.00"
    },
    {
      id: "appt-test-2",
      userId: TEST_USER_ID,
      homeId: TEST_HOME_ID,
      providerId: "p2",
      serviceId: "s4",
      serviceName: "AC Repair",
      description: "Air conditioning not cooling properly",
      urgency: "urgent",
      jobSize: "medium",
      scheduledDate: nextWeek,
      scheduledTime: "2:00 PM",
      status: "pending",
      estimatedPrice: "150.00"
    },
    {
      id: "appt-test-3",
      userId: TEST_USER_ID,
      homeId: TEST_HOME_ID,
      providerId: "p4",
      serviceId: "s9",
      serviceName: "Deep Clean",
      description: "Full house deep cleaning before holiday guests",
      urgency: "flexible",
      jobSize: "large",
      scheduledDate: lastWeek,
      scheduledTime: "9:00 AM",
      status: "completed",
      estimatedPrice: "200.00",
      finalPrice: "220.00"
    }
  ];
  await db.insert(appointments).values(appointmentData);
  console.log("Database seeded successfully with test user: " + TEST_USER_EMAIL);
}

// server/routes.ts
init_schema();

// server/stripeClient.ts
import Stripe from "stripe";
var connectionSettings;
async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }
  const connectorName = "stripe";
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";
  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", connectorName);
  url.searchParams.set("environment", targetEnvironment);
  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "X_REPLIT_TOKEN": xReplitToken
    }
  });
  const data = await response.json();
  connectionSettings = data.items?.[0];
  if (!connectionSettings || (!connectionSettings.settings.publishable || !connectionSettings.settings.secret)) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }
  return {
    publishableKey: connectionSettings.settings.publishable,
    secretKey: connectionSettings.settings.secret
  };
}
async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: "2025-11-17.clover"
  });
}
async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}
async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}
var stripeSync = null;
async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import("stripe-replit-sync");
    const secretKey = await getStripeSecretKey();
    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL,
        max: 2,
        ssl: { rejectUnauthorized: false }
      },
      stripeSecretKey: secretKey
    });
  }
  return stripeSync;
}

// server/stripeService.ts
var StripeService = class {
  async createCustomer(email, userId) {
    const stripe2 = await getUncachableStripeClient();
    return await stripe2.customers.create({
      email,
      metadata: { userId }
    });
  }
  async createCheckoutSession(customerId, priceId, successUrl, cancelUrl) {
    const stripe2 = await getUncachableStripeClient();
    return await stripe2.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl
    });
  }
  async createPaymentIntent(amount, currency = "usd", customerId) {
    const stripe2 = await getUncachableStripeClient();
    return await stripe2.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      automatic_payment_methods: { enabled: true }
    });
  }
  async createCustomerPortalSession(customerId, returnUrl) {
    const stripe2 = await getUncachableStripeClient();
    return await stripe2.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });
  }
};
var stripeService = new StripeService();

// server/routes.ts
init_schema();
import { sql as sql3, eq as eq4, and as and4, desc as desc2 } from "drizzle-orm";

// server/emailService.ts
import { Resend } from "resend";
var connectionSettings2;
async function getCredentials2() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken) {
    throw new Error("Resend authentication token not found");
  }
  connectionSettings2 = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        "Accept": "application/json",
        "X_REPLIT_TOKEN": xReplitToken
      }
    }
  ).then((res) => res.json()).then((data) => data.items?.[0]);
  if (!connectionSettings2 || !connectionSettings2.settings.api_key) {
    throw new Error("Resend not connected - please set up the Resend integration");
  }
  return {
    apiKey: connectionSettings2.settings.api_key,
    fromEmail: connectionSettings2.settings.from_email
  };
}
async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials2();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}
function fmtUsd(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}
function buildEmailBase(title, body, ctaLabel, ctaUrl) {
  const ctaHtml = ctaLabel && ctaUrl ? `<a href="${ctaUrl}" style="display:block;background:#38AE5F;color:#fff;text-align:center;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;margin:24px 0;">${ctaLabel}</a>` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;background-color:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.08);">
      <!-- Header -->
      <div style="background:#38AE5F;padding:28px 32px;text-align:center;">
        <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.3px;">HomeBase</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">The smart way to manage home services</div>
      </div>
      <!-- Body -->
      <div style="padding:32px;">
        ${body}
        ${ctaHtml}
      </div>
      <!-- Footer -->
      <div style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af;font-size:11px;margin:0 0 4px;">Sent via HomeBase &mdash; The smart way to manage home services</p>
        <p style="color:#d1d5db;font-size:10px;margin:0;">You are receiving this because you have an account or transaction on HomeBase. <a href="#" style="color:#9ca3af;">Unsubscribe</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
function infoRow(label, value) {
  return `<div style="display:flex;justify-content:space-between;margin-bottom:10px;">
    <span style="color:#6b7280;font-size:14px;">${label}</span>
    <span style="color:#111827;font-weight:600;font-size:14px;">${value}</span>
  </div>`;
}
function infoBox(rows) {
  return `<div style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">${rows}</div>`;
}
function greeting(name) {
  return `<p style="color:#374151;font-size:16px;margin:0 0 20px;">Hi ${name},</p>`;
}
function paragraph(text2) {
  return `<p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 20px;">${text2}</p>`;
}
function appDownloadSection() {
  return `<div style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);border-radius:8px;padding:20px;margin-top:24px;text-align:center;">
    <p style="color:#166534;font-weight:600;margin:0 0 6px;font-size:14px;">Manage your home services with HomeBase</p>
    <p style="color:#15803d;font-size:13px;margin:0 0 14px;">Track invoices, book services, and get instant quotes &mdash; all in one app.</p>
    <div>
      <a href="https://apps.apple.com/app/homebase" style="display:inline-block;background:#111827;color:#fff;padding:9px 18px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:500;margin:0 4px;">App Store</a>
      <a href="https://play.google.com/store/apps/details?id=com.homebase" style="display:inline-block;background:#111827;color:#fff;padding:9px 18px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:500;margin:0 4px;">Google Play</a>
    </div>
  </div>`;
}
async function sendEmail(to, subject, html) {
  try {
    const { client, fromEmail } = await getResendClient();
    const result = await client.emails.send({
      from: fromEmail || "HomeBase <noreply@resend.dev>",
      to,
      subject,
      html
    });
    if (result.error) {
      console.error("Resend error:", result.error);
      return { success: false, error: result.error.message };
    }
    return { success: true, messageId: result.data?.id };
  } catch (err) {
    console.error("sendEmail error:", err);
    return { success: false, error: err.message || "Failed to send email" };
  }
}
async function sendWelcomeEmail(to, name) {
  const body = greeting(name) + paragraph("Welcome to HomeBase! We're thrilled to have you. HomeBase helps you manage your home services, track invoices, and connect with trusted providers &mdash; all in one place.") + `<h2 style="color:#111827;font-size:18px;margin:0 0 12px;">What you can do</h2><ul style="color:#6b7280;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
      <li>Book local service providers</li>
      <li>Manage invoices and payments</li>
      <li>Track your home maintenance history</li>
      <li>Get smart reminders for recurring services</li>
    </ul>` + appDownloadSection();
  return sendEmail(to, "Welcome to HomeBase!", buildEmailBase("Welcome to HomeBase", body, "Open HomeBase", "https://homebaseproapp.com"));
}
async function sendBookingConfirmationEmail(data) {
  const priceRow = data.estimatedPrice ? infoRow("Est. Price", fmtUsd(data.estimatedPrice)) : "";
  const body = greeting(data.clientName) + paragraph("Great news! Your service appointment has been confirmed. Here are your booking details:") + infoBox(
    (data.confirmationNumber ? infoRow("Confirmation #", data.confirmationNumber) : "") + infoRow("Service", data.serviceName) + infoRow("Provider", data.providerName) + infoRow("Date", data.appointmentDate) + infoRow("Time", data.appointmentTime) + (data.address ? infoRow("Location", data.address) : "") + priceRow
  ) + `<div style="background:#fffbeb;border-radius:8px;padding:14px 16px;margin-bottom:20px;border-left:4px solid #f59e0b;">
      <p style="color:#92400e;font-size:13px;margin:0;"><strong>Need to reschedule?</strong> Contact ${data.providerName} at least 24 hours before your appointment.</p>
    </div>` + appDownloadSection();
  return sendEmail(
    data.clientEmail,
    `Booking Confirmed: ${data.serviceName} with ${data.providerName}`,
    buildEmailBase("Booking Confirmed", body)
  );
}
async function sendBookingReminderEmail(data, hoursUntil) {
  const label = hoursUntil <= 2 ? "in 2 hours" : "tomorrow";
  const body = greeting(data.clientName) + paragraph(`This is a reminder that your appointment is coming up ${label}. Here are the details:`) + infoBox(
    infoRow("Service", data.serviceName) + infoRow("Provider", data.providerName) + infoRow("Date", data.appointmentDate) + infoRow("Time", data.appointmentTime) + (data.address ? infoRow("Location", data.address) : "")
  ) + appDownloadSection();
  return sendEmail(
    data.clientEmail,
    `Reminder: ${data.serviceName} with ${data.providerName} ${label}`,
    buildEmailBase("Appointment Reminder", body)
  );
}
async function sendBookingCancelledEmail(data, reason) {
  const body = greeting(data.clientName) + paragraph(`Your ${data.serviceName} appointment with ${data.providerName} has been cancelled.`) + infoBox(
    infoRow("Service", data.serviceName) + infoRow("Provider", data.providerName) + infoRow("Date", data.appointmentDate) + infoRow("Time", data.appointmentTime) + (reason ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:14px;">Reason: </span><span style="color:#111827;font-size:14px;">${reason}</span></div>` : "")
  ) + paragraph("If you would like to rebook, please contact the provider or visit HomeBase to schedule a new appointment.") + appDownloadSection();
  return sendEmail(
    data.clientEmail,
    `Booking Cancelled: ${data.serviceName} with ${data.providerName}`,
    buildEmailBase("Booking Cancelled", body)
  );
}
async function sendBookingRescheduledEmail(data, oldDate, oldTime) {
  const body = greeting(data.clientName) + paragraph(`Your ${data.serviceName} appointment with ${data.providerName} has been rescheduled.`) + `<p style="color:#6b7280;font-size:13px;text-decoration:line-through;margin:0 0 4px;">Previously: ${oldDate} at ${oldTime}</p>` + infoBox(
    `<p style="color:#38AE5F;font-weight:600;font-size:13px;margin:0 0 12px;">New schedule</p>` + infoRow("Service", data.serviceName) + infoRow("Provider", data.providerName) + infoRow("Date", data.appointmentDate) + infoRow("Time", data.appointmentTime) + (data.address ? infoRow("Location", data.address) : "")
  ) + appDownloadSection();
  return sendEmail(
    data.clientEmail,
    `Rescheduled: ${data.serviceName} with ${data.providerName}`,
    buildEmailBase("Appointment Rescheduled", body)
  );
}
async function sendInvoiceEmail(data) {
  const lineItemsHtml = data.lineItems.map((item) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px;">${item.description}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#374151;font-size:13px;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;font-size:13px;">$${item.unitPrice.toFixed(2)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;font-size:13px;">$${item.total.toFixed(2)}</td>
    </tr>`).join("");
  const body = greeting(data.clientName) + paragraph(`You have received a new invoice from <strong>${data.providerName}</strong>. Please find the details below.`) + infoBox(
    infoRow("Invoice #", data.invoiceNumber) + infoRow("Due Date", data.dueDate) + `<div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid #e5e7eb;">
        <span style="color:#6b7280;font-size:14px;">Total Amount</span>
        <span style="color:#38AE5F;font-weight:700;font-size:20px;">${fmtUsd(data.amount)}</span>
      </div>`
  ) + `<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:10px 12px;text-align:left;color:#374151;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Description</th>
          <th style="padding:10px 12px;text-align:center;color:#374151;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Qty</th>
          <th style="padding:10px 12px;text-align:right;color:#374151;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Price</th>
          <th style="padding:10px 12px;text-align:right;color:#374151;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Total</th>
        </tr>
      </thead>
      <tbody>${lineItemsHtml}</tbody>
    </table>` + (data.paymentLink ? `<a href="${data.paymentLink}" style="display:block;background:#38AE5F;color:#fff;text-align:center;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;margin-bottom:24px;">Pay Now</a>` : "") + appDownloadSection();
  return sendEmail(
    data.clientEmail,
    `Invoice ${data.invoiceNumber} from ${data.providerName} &ndash; ${fmtUsd(data.amount)}`,
    buildEmailBase(`Invoice from ${data.providerName}`, body)
  );
}
async function sendInvoiceCreatedEmail(data) {
  return sendInvoiceEmail(data);
}
async function sendInvoiceReminderEmail(data) {
  const isOverdue = (data.daysOverdue ?? 0) > 0;
  const urgencyText = isOverdue ? `Your invoice is <strong>${data.daysOverdue} day${data.daysOverdue === 1 ? "" : "s"} overdue</strong>. Please arrange payment as soon as possible to avoid any service interruptions.` : `Your invoice is due in <strong>${data.daysUntilDue} day${data.daysUntilDue === 1 ? "" : "s"}</strong>. Please arrange payment before the due date.`;
  const body = greeting(data.clientName) + `<div style="background:${isOverdue ? "#fef2f2" : "#fffbeb"};border-radius:8px;padding:14px 16px;margin-bottom:20px;border-left:4px solid ${isOverdue ? "#ef4444" : "#f59e0b"};">
      <p style="color:${isOverdue ? "#991b1b" : "#92400e"};font-size:14px;margin:0;">${urgencyText}</p>
    </div>` + infoBox(
    infoRow("Invoice #", data.invoiceNumber) + infoRow("Provider", data.providerName) + infoRow("Due Date", data.dueDate) + `<div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid #e5e7eb;">
        <span style="color:#6b7280;font-size:14px;">Amount Due</span>
        <span style="color:${isOverdue ? "#ef4444" : "#38AE5F"};font-weight:700;font-size:20px;">${fmtUsd(data.amount)}</span>
      </div>`
  ) + (data.paymentLink ? `<a href="${data.paymentLink}" style="display:block;background:#38AE5F;color:#fff;text-align:center;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;margin-bottom:24px;">Pay Now</a>` : "") + appDownloadSection();
  const subject = isOverdue ? `Overdue: Invoice ${data.invoiceNumber} from ${data.providerName}` : `Reminder: Invoice ${data.invoiceNumber} due in ${data.daysUntilDue} day${data.daysUntilDue === 1 ? "" : "s"}`;
  return sendEmail(data.clientEmail, subject, buildEmailBase("Invoice Reminder", body));
}
async function sendPaymentReceiptEmail(data) {
  const body = greeting(data.clientName) + `<div style="text-align:center;margin-bottom:24px;">
      <div style="width:60px;height:60px;background:#f0fdf4;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
        <div style="font-size:28px;color:#38AE5F;">&#10003;</div>
      </div>
      <p style="color:#166534;font-weight:600;margin:0;">Payment confirmed</p>
    </div>` + paragraph("Thank you for your payment! This email confirms we've received your payment for the following:") + infoBox(
    infoRow("Invoice #", data.invoiceNumber) + infoRow("Payment Date", data.paymentDate) + infoRow("Provider", data.providerName) + (data.paymentMethod ? infoRow("Payment Method", data.paymentMethod) : "") + `<div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid #e5e7eb;">
        <span style="color:#6b7280;font-size:14px;">Amount Paid</span>
        <span style="color:#38AE5F;font-weight:700;font-size:20px;">${fmtUsd(data.amount)}</span>
      </div>`
  ) + paragraph(`Keep this email as your receipt. If you have any questions about this payment, please contact ${data.providerName} directly.`) + appDownloadSection();
  return sendEmail(
    data.clientEmail,
    `Payment Receipt &ndash; ${fmtUsd(data.amount)} to ${data.providerName}`,
    buildEmailBase("Payment Receipt", body)
  );
}
async function sendInvoicePaidEmail(data) {
  return sendPaymentReceiptEmail(data);
}
async function sendPaymentFailedEmail(data) {
  const body = greeting(data.clientName) + `<div style="background:#fef2f2;border-radius:8px;padding:14px 16px;margin-bottom:20px;border-left:4px solid #ef4444;">
      <p style="color:#991b1b;font-size:14px;margin:0;"><strong>Payment failed.</strong> We were unable to process your payment for invoice ${data.invoiceNumber}.</p>
    </div>` + infoBox(
    infoRow("Invoice #", data.invoiceNumber) + infoRow("Provider", data.providerName) + `<div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid #e5e7eb;">
        <span style="color:#6b7280;font-size:14px;">Amount Due</span>
        <span style="color:#ef4444;font-weight:700;font-size:20px;">${fmtUsd(data.amount)}</span>
      </div>`
  ) + paragraph("Please update your payment method and try again. If you need assistance, contact your service provider directly.") + (data.paymentLink ? `<a href="${data.paymentLink}" style="display:block;background:#38AE5F;color:#fff;text-align:center;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;margin-bottom:24px;">Retry Payment</a>` : "") + appDownloadSection();
  return sendEmail(
    data.clientEmail,
    `Payment Failed: Invoice ${data.invoiceNumber} from ${data.providerName}`,
    buildEmailBase("Payment Failed", body)
  );
}
async function sendReviewRequestEmail(data) {
  const body = greeting(data.clientName) + paragraph(`Thank you for choosing ${data.providerName} for your ${data.serviceName}! We hope everything went smoothly. Your feedback helps other homeowners find great service providers.`) + paragraph("Would you mind leaving a quick review? It only takes a minute and means a lot to your provider.") + appDownloadSection();
  return sendEmail(
    data.clientEmail,
    `How did your ${data.serviceName} go? Leave a review for ${data.providerName}`,
    buildEmailBase("Leave a Review", body, data.reviewUrl ? "Leave a Review" : void 0, data.reviewUrl)
  );
}
async function sendStripeOnboardingNeededEmail(to, providerName, onboardingUrl) {
  const body = greeting(providerName) + paragraph("To start accepting online payments through HomeBase, you need to complete your Stripe payout account setup. This takes about 5 minutes.") + `<ul style="color:#6b7280;font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 20px;">
      <li>Accept card payments from clients</li>
      <li>Receive automatic payouts to your bank account</li>
      <li>Issue refunds directly from HomeBase</li>
    </ul>`;
  return sendEmail(to, "Complete your payout setup to get paid faster", buildEmailBase("Set Up Payouts", body, "Set Up Stripe Payouts", onboardingUrl));
}
async function sendStripeConnectedEmail(to, providerName) {
  const body = greeting(providerName) + paragraph("Your Stripe payout account has been successfully connected to HomeBase. You can now accept online payments from clients and receive payouts directly to your bank account.") + `<div style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:20px;border-left:4px solid #38AE5F;">
      <p style="color:#166534;font-weight:600;margin:0;">Payments are now active</p>
      <p style="color:#15803d;font-size:13px;margin:6px 0 0;">Send invoices with &ldquo;Pay Now&rdquo; links and get paid faster.</p>
    </div>` + appDownloadSection();
  return sendEmail(to, "Your Stripe payout account is connected", buildEmailBase("Payouts Connected", body));
}
async function sendProviderBookingNotificationEmail(data) {
  const body = greeting(data.providerName) + paragraph(`${data.clientName} has booked a ${data.serviceName} with you. Here are the details:`) + infoBox(
    infoRow("Client", data.clientName) + infoRow("Service", data.serviceName) + infoRow("Date", data.appointmentDate) + infoRow("Time", data.appointmentTime) + (data.address ? infoRow("Location", data.address) : "")
  );
  return sendEmail(
    data.providerEmail,
    `New Booking: ${data.serviceName} with ${data.clientName}`,
    buildEmailBase("New Booking", body, "View in HomeBase", "https://homebaseproapp.com")
  );
}
async function sendJobStatusChangedEmail(data) {
  const statusLabel = {
    scheduled: "Scheduled",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
    on_hold: "On Hold"
  };
  const label = statusLabel[data.newStatus] ?? data.newStatus;
  const body = greeting(data.clientName) + paragraph(`We wanted to let you know that the status of your ${data.serviceName} job with ${data.providerName} has been updated to <strong>${label}</strong>.`) + (data.scheduledDate || data.notes ? infoBox(
    (data.scheduledDate ? infoRow("Scheduled Date", data.scheduledDate) : "") + (data.notes ? infoRow("Notes", data.notes) : "")
  ) : "") + paragraph(`If you have any questions, please reach out through the HomeBase app.`);
  return sendEmail(
    data.clientEmail,
    `Job Update: ${data.serviceName} is now ${label}`,
    buildEmailBase("Job Status Update", body, "View in HomeBase", "https://homebaseproapp.com")
  );
}
async function sendRebookingNudgeEmail(data) {
  const body = greeting(data.clientName) + paragraph(`Great news \u2014 your ${data.serviceName} with ${data.providerName} is complete! Ready to schedule your next visit?`) + paragraph(`Keeping up with regular maintenance can save you money in the long run. Book ${data.providerName} again in just a few taps.`);
  return sendEmail(
    data.clientEmail,
    `Your service is complete \u2014 book ${data.providerName} again?`,
    buildEmailBase("Service Complete", body, "Book Again", data.rebookLink || "https://homebaseproapp.com")
  );
}
async function sendProviderClientMessage(data) {
  try {
    const { client, fromEmail } = await getResendClient();
    const bodyHtml = data.body.replace(/\n/g, "<br/>");
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: #38AE5F; padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px;">${data.providerName}</h1>
              <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px;">Sent via HomeBase</p>
            </div>

            <div style="padding: 32px;">
              <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
                Hi ${data.clientName},
              </p>

              <div style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 24px;">
                ${bodyHtml}
              </div>

              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 24px;">
                <p style="color: #6b7280; font-size: 13px; margin: 0;">
                  This message was sent to you by <strong>${data.providerName}</strong> through HomeBase. To reply, simply respond to this email.
                </p>
              </div>
            </div>

            <div style="background: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                Powered by HomeBase &mdash; The smart way to manage home services
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    const result = await client.emails.send({
      from: fromEmail || "HomeBase <noreply@resend.dev>",
      to: data.clientEmail,
      subject: data.subject || `Message from ${data.providerName}`,
      html
    });
    if (result.error) {
      console.error("Resend error:", result.error);
      return { success: false, error: result.error.message };
    }
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error("Send provider client message error:", error);
    return { success: false, error: error.message || "Failed to send message" };
  }
}

// server/notificationService.ts
init_schema();
import { eq as eq2, and as and2 } from "drizzle-orm";
async function logDelivery(opts) {
  try {
    const [row] = await db.insert(notificationDeliveries).values({
      channel: opts.channel,
      status: opts.status,
      eventType: opts.eventType,
      recipientUserId: opts.recipientUserId ?? null,
      recipientEmail: opts.recipientEmail ?? null,
      relatedRecordType: opts.relatedRecordType ?? null,
      relatedRecordId: opts.relatedRecordId ?? null,
      externalMessageId: opts.externalMessageId ?? null,
      error: opts.error ?? null,
      metadata: opts.metadata ? JSON.stringify(opts.metadata) : null
    }).returning();
    return row.id;
  } catch (err) {
    console.error("Failed to log notification delivery:", err);
    return "";
  }
}
async function updateDelivery(id, status, externalMessageId, error) {
  if (!id) return;
  try {
    await db.update(notificationDeliveries).set({ status, externalMessageId: externalMessageId ?? null, error: error ?? null, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(notificationDeliveries.id, id));
  } catch (err) {
    console.error("Failed to update notification delivery:", err);
  }
}
var EVENT_PREF_FIELD = {
  "booking.created": "emailBookingConfirmation",
  "booking.updated": "emailBookingConfirmation",
  "booking.cancelled": "emailBookingCancelled",
  "booking.rescheduled": "emailBookingConfirmation",
  "booking.reminder_24h": "emailBookingReminder",
  "booking.reminder_2h": "emailBookingReminder",
  "invoice.sent": "emailInvoiceCreated",
  "invoice.reminder_3d": "emailInvoiceReminder",
  "invoice.overdue_1d": "emailInvoiceReminder",
  "invoice.paid": "emailInvoicePaid",
  "invoice.payment_failed": "emailPaymentFailed",
  "review.request": "emailReviewRequest"
};
async function isEmailAllowed(event, recipientUserId) {
  const prefField = EVENT_PREF_FIELD[event];
  if (!prefField || !recipientUserId) return true;
  try {
    const [prefs] = await db.select().from(notificationPreferences).where(eq2(notificationPreferences.userId, recipientUserId));
    if (!prefs) return true;
    const allowed = prefs[prefField];
    return allowed !== false;
  } catch {
    return true;
  }
}
async function dispatch(event, payload) {
  try {
    await _dispatch(event, payload);
  } catch (err) {
    console.error(`Notification dispatch failed for event ${event}:`, err);
  }
}
async function dispatchWithResult(event, payload) {
  try {
    const result = await _dispatch(event, payload);
    return result ?? { emailSent: false, emailError: "No email send attempted for this event" };
  } catch (err) {
    console.error(`Notification dispatch failed for event ${event}:`, err);
    return { emailSent: false, emailError: err?.message || "Email send failed" };
  }
}
async function _dispatch(event, payload) {
  if (event !== "booking.created") {
    const emailOk = await isEmailAllowed(event, payload.recipientUserId);
    if (!emailOk) {
      console.log(`[notification] Skipped ${event} for user ${payload.recipientUserId} (preference opt-out)`);
      return { emailSent: false, emailError: "Opted out of this notification type" };
    }
  }
  switch (event) {
    case "user.signup": {
      if (!payload.recipientEmail || !payload.clientName) break;
      const deliveryId = await logDelivery({
        channel: "email",
        status: "queued",
        eventType: event,
        recipientUserId: payload.recipientUserId,
        recipientEmail: payload.recipientEmail
      });
      const result = await sendWelcomeEmail(payload.recipientEmail, payload.clientName);
      await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
      break;
    }
    case "booking.updated": {
      const { clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: "email",
        status: "queued",
        eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId
      });
      const result = await sendBookingConfirmationEmail({ clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime, address: payload.address, estimatedPrice: payload.estimatedPrice, confirmationNumber: payload.relatedRecordId });
      await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
      break;
    }
    case "booking.created": {
      const { clientEmail, clientName, providerEmail, providerName, serviceName, appointmentDate, appointmentTime, address, estimatedPrice, confirmationNumber } = payload;
      if (clientEmail && clientName && providerName) {
        const clientEmailOk = await isEmailAllowed(event, payload.recipientUserId);
        if (clientEmailOk) {
          const deliveryId = await logDelivery({
            channel: "email",
            status: "queued",
            eventType: event,
            recipientEmail: clientEmail,
            recipientUserId: payload.recipientUserId,
            relatedRecordType: payload.relatedRecordType,
            relatedRecordId: payload.relatedRecordId
          });
          const result = await sendBookingConfirmationEmail({ clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime, address, estimatedPrice, confirmationNumber });
          await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
        }
      }
      if (providerEmail && providerName && clientName) {
        const providerEmailOk = await isEmailAllowed(event, payload.providerUserId);
        if (providerEmailOk) {
          const deliveryId = await logDelivery({
            channel: "email",
            status: "queued",
            eventType: `${event}.provider`,
            recipientEmail: providerEmail,
            recipientUserId: payload.providerUserId,
            relatedRecordType: payload.relatedRecordType,
            relatedRecordId: payload.relatedRecordId
          });
          const result = await sendProviderBookingNotificationEmail({ providerEmail, providerName, clientName, serviceName, appointmentDate, appointmentTime, address });
          await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
        }
      }
      break;
    }
    case "booking.cancelled": {
      const { clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime, address, reason } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: "email",
        status: "queued",
        eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId
      });
      const result = await sendBookingCancelledEmail({ clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime, address }, reason);
      await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
      break;
    }
    case "booking.rescheduled": {
      const { clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime, address, oldDate, oldTime } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: "email",
        status: "queued",
        eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId
      });
      const result = await sendBookingRescheduledEmail({ clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime, address }, oldDate, oldTime);
      await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
      break;
    }
    case "booking.reminder_24h":
    case "booking.reminder_2h": {
      const { clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime, address } = payload;
      if (!clientEmail || !clientName) break;
      const hours = event === "booking.reminder_2h" ? 2 : 24;
      const deliveryId = await logDelivery({
        channel: "email",
        status: "queued",
        eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId
      });
      const result = await sendBookingReminderEmail({ clientEmail, clientName, providerName, serviceName, appointmentDate, appointmentTime, address }, hours);
      await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
      break;
    }
    case "invoice.created": {
      const { clientEmail, clientName, providerName, invoiceNumber, amount, dueDate } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: "email",
        status: "queued",
        eventType: event,
        recipientEmail: clientEmail,
        recipientUserId: payload.recipientUserId,
        relatedRecordType: "invoice",
        relatedRecordId: payload.relatedRecordId
      });
      const result = await sendInvoiceCreatedEmail({ clientEmail, clientName, providerName, invoiceNumber, amount, dueDate, lineItems: payload.lineItems || [] });
      await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
      break;
    }
    case "invoice.sent": {
      const { clientEmail, clientName, providerName, invoiceNumber, amount, dueDate, lineItems, paymentLink } = payload;
      if (!clientEmail || !clientName) {
        return { emailSent: false, emailError: "Missing client email or name" };
      }
      const deliveryId = await logDelivery({
        channel: "email",
        status: "queued",
        eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: "invoice",
        relatedRecordId: payload.relatedRecordId
      });
      const result = await sendInvoiceEmail({ clientEmail, clientName, providerName, invoiceNumber, amount, dueDate, lineItems: lineItems || [], paymentLink });
      await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
      return { emailSent: result.success, emailError: result.error };
    }
    case "invoice.reminder_3d": {
      const { clientEmail, clientName, providerName, invoiceNumber, amount, dueDate, paymentLink, daysUntilDue } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: "email",
        status: "queued",
        eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: "invoice",
        relatedRecordId: payload.relatedRecordId
      });
      const result = await sendInvoiceReminderEmail({ clientEmail, clientName, providerName, invoiceNumber, amount, dueDate, paymentLink, daysUntilDue });
      await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
      break;
    }
    case "invoice.overdue_1d": {
      const { clientEmail, clientName, providerName, invoiceNumber, amount, dueDate, paymentLink, daysOverdue } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: "email",
        status: "queued",
        eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: "invoice",
        relatedRecordId: payload.relatedRecordId
      });
      const result = await sendInvoiceReminderEmail({ clientEmail, clientName, providerName, invoiceNumber, amount, dueDate, paymentLink, daysOverdue });
      await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
      break;
    }
    case "invoice.paid": {
      const { clientEmail, clientName, providerName, invoiceNumber, amount, paymentDate, paymentMethod } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: "email",
        status: "queued",
        eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: "invoice",
        relatedRecordId: payload.relatedRecordId
      });
      const result = await sendInvoicePaidEmail({ clientEmail, clientName, providerName, invoiceNumber, amount, paymentDate, paymentMethod });
      await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
      break;
    }
    case "invoice.payment_failed": {
      const { clientEmail, clientName, providerName, invoiceNumber, amount, paymentLink } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: "email",
        status: "queued",
        eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: "invoice",
        relatedRecordId: payload.relatedRecordId
      });
      const result = await sendPaymentFailedEmail({ clientEmail, clientName, providerName, invoiceNumber, amount, paymentLink });
      await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
      break;
    }
    case "review.request": {
      const { clientEmail, clientName, providerName, serviceName, reviewUrl } = payload;
      if (!clientEmail || !clientName) break;
      const deliveryId = await logDelivery({
        channel: "email",
        status: "queued",
        eventType: event,
        recipientEmail: clientEmail,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId
      });
      const result = await sendReviewRequestEmail({ clientEmail, clientName, providerName, serviceName, reviewUrl });
      await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
      break;
    }
    case "stripe.onboarding_needed": {
      const { recipientEmail, providerName, onboardingUrl } = payload;
      if (!recipientEmail || !providerName) break;
      const deliveryId = await logDelivery({
        channel: "email",
        status: "queued",
        eventType: event,
        recipientEmail,
        recipientUserId: payload.recipientUserId
      });
      const result = await sendStripeOnboardingNeededEmail(recipientEmail, providerName, onboardingUrl || "https://homebaseproapp.com");
      await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
      break;
    }
    case "stripe.connected": {
      const { recipientEmail, providerName } = payload;
      if (!recipientEmail || !providerName) break;
      const deliveryId = await logDelivery({
        channel: "email",
        status: "queued",
        eventType: event,
        recipientEmail,
        recipientUserId: payload.recipientUserId
      });
      const result = await sendStripeConnectedEmail(recipientEmail, providerName);
      await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
      break;
    }
    case "job.status_changed": {
      const { clientEmail, clientName, providerName, serviceName, newStatus, scheduledDate, notes } = payload;
      if (!clientEmail || !clientName || !providerName || !serviceName || !newStatus) break;
      const deliveryId = await logDelivery({
        channel: "email",
        status: "queued",
        eventType: event,
        recipientEmail: clientEmail,
        recipientUserId: payload.recipientUserId,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId
      });
      const result = await sendJobStatusChangedEmail({ clientEmail, clientName, providerName, serviceName, newStatus, scheduledDate, notes });
      await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
      break;
    }
    case "rebook.prompt": {
      const { clientEmail, clientName, providerName, serviceName, rebookLink } = payload;
      if (!clientEmail || !clientName || !providerName || !serviceName) break;
      const deliveryId = await logDelivery({
        channel: "email",
        status: "queued",
        eventType: event,
        recipientEmail: clientEmail,
        recipientUserId: payload.recipientUserId,
        relatedRecordType: payload.relatedRecordType,
        relatedRecordId: payload.relatedRecordId
      });
      const result = await sendRebookingNudgeEmail({ clientEmail, clientName, providerName, serviceName, rebookLink });
      await updateDelivery(deliveryId, result.success ? "sent" : "failed", result.messageId, result.error);
      break;
    }
    default:
      console.warn(`Unknown notification event: ${event}`);
  }
  const SMS_PLACEHOLDER_EVENTS = [
    "booking.created",
    "booking.cancelled",
    "booking.reminder_24h",
    "invoice.paid",
    "job.status_changed"
  ];
  if (SMS_PLACEHOLDER_EVENTS.includes(event) && (payload.clientPhone || payload.recipientPhone)) {
    await logDelivery({
      channel: "sms",
      status: "pending_sms",
      eventType: event,
      recipientUserId: payload.recipientUserId,
      relatedRecordType: payload.relatedRecordType,
      relatedRecordId: payload.relatedRecordId,
      metadata: { phone: payload.clientPhone || payload.recipientPhone }
    });
  }
  return null;
}
async function hasDeliveryForRecord(eventType, relatedRecordId, channel = "email") {
  try {
    const rows = await db.select({ id: notificationDeliveries.id }).from(notificationDeliveries).where(
      and2(
        eq2(notificationDeliveries.eventType, eventType),
        eq2(notificationDeliveries.relatedRecordId, relatedRecordId),
        eq2(notificationDeliveries.channel, channel),
        eq2(notificationDeliveries.status, "sent")
      )
    ).limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}
async function sendExpoPushNotifications(messages) {
  if (messages.length === 0) return;
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(messages)
    });
    if (!response.ok) {
      console.error("Expo push API error:", response.status, await response.text());
      return;
    }
    const result = await response.json();
    for (const ticket of result.data || []) {
      if (ticket.status === "error") {
        console.error("Push notification error:", ticket.message, ticket.details);
        if (ticket.details?.error === "DeviceNotRegistered") {
          console.log("Device not registered, token should be cleaned up");
        }
      }
    }
  } catch (err) {
    console.error("Failed to send push notifications:", err);
  }
}
async function sendPush(userId, title, body, data = {}, _category = "bookings") {
  try {
    const [prefs] = await db.select().from(notificationPreferences).where(eq2(notificationPreferences.userId, userId));
    if (prefs && prefs.pushEnabled === false) {
      return;
    }
    const tokens = await db.select({ token: pushTokens.token }).from(pushTokens).where(and2(eq2(pushTokens.userId, userId), eq2(pushTokens.isActive, true)));
    if (tokens.length === 0) return;
    const messages = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      data,
      sound: "default"
    }));
    await sendExpoPushNotifications(messages);
  } catch (err) {
    console.error("sendPush error:", err);
  }
}
async function dispatchNotification(userId, title, message, type, data = {}, category = "bookings") {
  try {
    await db.insert(notifications).values({
      userId,
      title,
      message,
      type,
      isRead: false,
      data: JSON.stringify(data)
    });
    await sendPush(userId, title, message, data, category);
  } catch (err) {
    console.error("dispatchNotification error:", err);
  }
}

// server/housefaxService.ts
async function fetchZillowPropertyData(address) {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  if (!rapidApiKey) {
    console.error("RAPIDAPI_KEY not configured");
    return null;
  }
  try {
    const formattedAddress = address.replace(/,/g, "").replace(/\s+/g, "-").replace(/--+/g, "-");
    const apiUrl = `https://real-estate101.p.rapidapi.com/api/property-details/byaddress?address=${encodeURIComponent(formattedAddress)}`;
    console.log("Calling Real Estate 101 API for:", address, "-> Formatted:", formattedAddress);
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": rapidApiKey,
        "X-RapidAPI-Host": "real-estate101.p.rapidapi.com"
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Zillow API failed:", response.status, errorText);
      return null;
    }
    const data = await response.json();
    if (!data || data.error || !data.success === false) {
      console.log("No property data returned for:", address);
      if (data.error) console.log("API error:", data.error);
    }
    const property = data.property || data.data || data;
    if (!property || typeof property !== "object") {
      console.log("Invalid property data structure for:", address);
      return null;
    }
    console.log("Zillow data received for property");
    let addressStr = "";
    if (typeof property.address === "object" && property.address) {
      const addr = property.address;
      addressStr = [addr.streetAddress, addr.city, addr.state, addr.zipcode].filter(Boolean).join(", ");
    } else {
      addressStr = property.streetAddress || property.address || property.fullAddress || "";
    }
    let livingAreaValue;
    if (typeof property.livingArea === "object" && property.livingArea) {
      livingAreaValue = property.livingArea.value;
    } else {
      livingAreaValue = property.livingArea || property.livingAreaValue || property.sqft || property.squareFeet;
    }
    let lotSizeValue;
    if (typeof property.lotSize === "object" && property.lotSize) {
      lotSizeValue = property.lotSize.value;
    } else {
      lotSizeValue = property.lotSize || property.lotAreaValue || property.lotSqft;
    }
    return {
      zpid: String(property.zpid || property.zillowId || property.id || ""),
      address: addressStr,
      bedrooms: property.bedrooms || property.beds || property.bedroomCount,
      bathrooms: property.bathrooms || property.baths || property.bathroomCount,
      livingArea: livingAreaValue,
      lotSize: lotSizeValue,
      yearBuilt: property.yearBuilt || property.yearBuiltRange,
      propertyType: property.homeType || property.propertyType || property.propertyTypeDimension,
      zestimate: property.zestimate || property.price || property.estimatedValue || property.priceEstimate,
      taxAssessedValue: property.taxAssessedValue || property.taxAssessment,
      lastSoldDate: property.lastSoldDate || property.dateSold,
      lastSoldPrice: property.lastSoldPrice || property.soldPrice,
      homeStatus: property.homeStatus || property.status,
      url: property.url || property.hdpUrl || property.zillowUrl
    };
  } catch (error) {
    console.error("Zillow API error:", error);
    return null;
  }
}
async function geocodeAddress(address) {
  const googleApiKey = process.env.GOOGLE_API_KEY;
  if (!googleApiKey) {
    console.error("GOOGLE_API_KEY not configured");
    return null;
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleApiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      console.log("Google geocoding failed:", data.status);
      return null;
    }
    const result = data.results[0];
    const location = result.geometry.location;
    let neighborhood;
    let county;
    let city;
    let state;
    let zipCode;
    for (const component of result.address_components) {
      if (component.types.includes("neighborhood")) {
        neighborhood = component.long_name;
      }
      if (component.types.includes("administrative_area_level_2")) {
        county = component.long_name;
      }
      if (component.types.includes("locality")) {
        city = component.long_name;
      }
      if (component.types.includes("administrative_area_level_1")) {
        state = component.short_name;
      }
      if (component.types.includes("postal_code")) {
        zipCode = component.long_name;
      }
    }
    return {
      formattedAddress: result.formatted_address,
      latitude: location.lat,
      longitude: location.lng,
      placeId: result.place_id,
      neighborhood,
      county,
      city,
      state,
      zipCode
    };
  } catch (error) {
    console.error("Google Geocoding API error:", error);
    return null;
  }
}
async function searchPlaces(query) {
  const googleApiKey = process.env.GOOGLE_API_KEY;
  if (!googleApiKey) {
    console.error("GOOGLE_API_KEY not configured");
    return [];
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=address&components=country:us&key=${googleApiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status !== "OK" || !data.predictions) {
      return [];
    }
    return data.predictions.map((p) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text || "",
      secondaryText: p.structured_formatting?.secondary_text || ""
    }));
  } catch (error) {
    console.error("Google Places API error:", error);
    return [];
  }
}
async function getPlaceDetails(placeId) {
  const googleApiKey = process.env.GOOGLE_API_KEY;
  if (!googleApiKey) {
    console.error("GOOGLE_API_KEY not configured");
    return null;
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,geometry,address_components&key=${googleApiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status !== "OK" || !data.result) {
      return null;
    }
    const result = data.result;
    const location = result.geometry?.location;
    let neighborhood;
    let county;
    let city;
    let state;
    let zipCode;
    for (const component of result.address_components || []) {
      if (component.types.includes("neighborhood")) {
        neighborhood = component.long_name;
      }
      if (component.types.includes("administrative_area_level_2")) {
        county = component.long_name;
      }
      if (component.types.includes("locality")) {
        city = component.long_name;
      }
      if (component.types.includes("administrative_area_level_1")) {
        state = component.short_name;
      }
      if (component.types.includes("postal_code")) {
        zipCode = component.long_name;
      }
    }
    return {
      formattedAddress: result.formatted_address,
      latitude: location?.lat || 0,
      longitude: location?.lng || 0,
      placeId,
      neighborhood,
      county,
      city,
      state,
      zipCode
    };
  } catch (error) {
    console.error("Google Place Details API error:", error);
    return null;
  }
}
async function enrichPropertyData(address) {
  const errors = [];
  const [zillowData, googleData] = await Promise.all([
    fetchZillowPropertyData(address),
    geocodeAddress(address)
  ]);
  if (!zillowData) {
    errors.push("Could not fetch Zillow property data");
  }
  if (!googleData) {
    errors.push("Could not geocode address");
  }
  return {
    zillow: zillowData || void 0,
    google: googleData || void 0,
    success: !!(zillowData || googleData),
    errors: errors.length > 0 ? errors : void 0
  };
}
function buildHouseFaxContext(home) {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const homeAge = home.yearBuilt ? currentYear - home.yearBuilt : null;
  let context = `Property: ${home.street || "Unknown"}, ${home.city || ""} ${home.state || ""} ${home.zip || ""}
`;
  if (home.propertyType) {
    context += `Type: ${home.propertyType.replace("_", " ")}
`;
  }
  if (home.bedrooms || home.bathrooms) {
    context += `Layout: ${home.bedrooms || "?"} bed, ${home.bathrooms || "?"} bath
`;
  }
  if (home.squareFeet) {
    context += `Size: ${home.squareFeet.toLocaleString()} sqft
`;
  }
  if (home.lotSize) {
    context += `Lot: ${home.lotSize.toLocaleString()} sqft
`;
  }
  if (home.yearBuilt) {
    context += `Built: ${home.yearBuilt} (${homeAge} years old)
`;
  }
  if (home.estimatedValue) {
    const value = parseFloat(home.estimatedValue);
    if (!isNaN(value)) {
      context += `Estimated Value: $${value.toLocaleString()}
`;
    }
  }
  if (home.neighborhoodName) {
    context += `Neighborhood: ${home.neighborhoodName}
`;
  }
  if (home.housefaxData) {
    try {
      const faxData = JSON.parse(home.housefaxData);
      if (faxData.systems) {
        context += `
Home Systems:
`;
        for (const [system, info] of Object.entries(faxData.systems)) {
          context += `- ${system}: ${JSON.stringify(info)}
`;
        }
      }
      if (faxData.knownIssues && faxData.knownIssues.length > 0) {
        context += `
Known Issues: ${faxData.knownIssues.join(", ")}
`;
      }
      if (faxData.recentWork && faxData.recentWork.length > 0) {
        context += `
Recent Work: ${faxData.recentWork.join(", ")}
`;
      }
    } catch (e) {
    }
  }
  return context;
}

// server/stripeConnectService.ts
import Stripe2 from "stripe";
init_schema();
import { eq as eq3, and as and3 } from "drizzle-orm";
var stripe = null;
function getStripe() {
  if (!stripe) {
    const apiKey = process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_TEST_SECRET_KEY is required. Please add it to your environment variables.");
    }
    stripe = new Stripe2(apiKey);
  }
  return stripe;
}
var APP_URL = process.env.APP_URL || "https://homebase.replit.app";
async function getProviderPlan(providerId) {
  const [plan] = await db.select().from(providerPlans).where(eq3(providerPlans.providerId, providerId));
  if (!plan) {
    return {
      id: null,
      providerId,
      planTier: "free",
      platformFeePercent: "10.00",
      platformFeeFixedCents: 0
    };
  }
  return plan;
}
function calculatePlatformFee(totalCents, feePercent, fixedCents = 0) {
  const percent = typeof feePercent === "string" ? parseFloat(feePercent) : feePercent;
  const percentFee = Math.round(totalCents * (percent / 100));
  return {
    percent,
    fixedCents,
    totalCents: percentFee + fixedCents
  };
}
async function getConnectAccount(providerId) {
  const [account] = await db.select().from(stripeConnectAccounts).where(eq3(stripeConnectAccounts.providerId, providerId));
  return account;
}
async function createConnectAccountLink(providerId) {
  let connectAccount = await getConnectAccount(providerId);
  if (!connectAccount) {
    const [provider] = await db.select().from(providers).where(eq3(providers.id, providerId));
    if (!provider) {
      throw new Error("Provider not found");
    }
    const account = await getStripe().accounts.create({
      type: "express",
      email: provider.email || void 0,
      business_type: "individual",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      metadata: {
        providerId,
        businessName: provider.businessName
      }
    });
    [connectAccount] = await db.insert(stripeConnectAccounts).values({
      providerId,
      stripeAccountId: account.id,
      onboardingStatus: "pending",
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted || false
    }).returning();
  }
  const accountLink = await getStripe().accountLinks.create({
    account: connectAccount.stripeAccountId,
    refresh_url: `${APP_URL}/provider/connect/refresh?providerId=${providerId}`,
    return_url: `${APP_URL}/provider/connect/complete?providerId=${providerId}`,
    type: "account_onboarding"
  });
  return {
    accountId: connectAccount.stripeAccountId,
    onboardingUrl: accountLink.url,
    expiresAt: accountLink.expires_at
  };
}
async function refreshConnectAccountLink(providerId) {
  const connectAccount = await getConnectAccount(providerId);
  if (!connectAccount) {
    throw new Error("Connect account not found. Create one first.");
  }
  const accountLink = await getStripe().accountLinks.create({
    account: connectAccount.stripeAccountId,
    refresh_url: `${APP_URL}/provider/connect/refresh?providerId=${providerId}`,
    return_url: `${APP_URL}/provider/connect/complete?providerId=${providerId}`,
    type: "account_onboarding"
  });
  return {
    accountId: connectAccount.stripeAccountId,
    onboardingUrl: accountLink.url,
    expiresAt: accountLink.expires_at
  };
}
async function getConnectStatus(providerId) {
  const connectAccount = await getConnectAccount(providerId);
  if (!connectAccount) {
    return {
      exists: false,
      onboardingStatus: "not_started",
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false
    };
  }
  const account = await getStripe().accounts.retrieve(connectAccount.stripeAccountId);
  let onboardingStatus = "pending";
  if (account.charges_enabled && account.payouts_enabled && account.details_submitted) {
    onboardingStatus = "complete";
  }
  await db.update(stripeConnectAccounts).set({
    onboardingStatus,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted || false,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq3(stripeConnectAccounts.id, connectAccount.id));
  return {
    exists: true,
    accountId: connectAccount.stripeAccountId,
    onboardingStatus,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirements: account.requirements
  };
}
async function createInvoicePaymentIntent(invoiceId, payerUserId) {
  const [invoice] = await db.select().from(invoices).where(eq3(invoices.id, invoiceId));
  if (!invoice) {
    throw new Error("Invoice not found");
  }
  if (invoice.status === "paid") {
    throw new Error("Invoice already paid");
  }
  const connectAccount = await getConnectAccount(invoice.providerId);
  if (!connectAccount) {
    throw new Error("Provider has not set up payment processing");
  }
  if (!connectAccount.chargesEnabled) {
    throw new Error("Provider payment processing is not yet enabled");
  }
  const paymentIntent = await getStripe().paymentIntents.create({
    amount: invoice.totalCents,
    currency: invoice.currency || "usd",
    application_fee_amount: invoice.platformFeeCents || 0,
    transfer_data: {
      destination: connectAccount.stripeAccountId
    },
    metadata: {
      invoiceId: invoice.id,
      providerId: invoice.providerId,
      payerUserId: payerUserId || ""
    }
  });
  await db.update(invoices).set({
    stripePaymentIntentId: paymentIntent.id,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq3(invoices.id, invoiceId));
  await db.insert(payments).values({
    invoiceId: invoice.id,
    providerId: invoice.providerId,
    amountCents: invoice.totalCents,
    amount: (invoice.totalCents / 100).toFixed(2),
    method: "stripe",
    status: "requires_payment",
    stripePaymentIntentId: paymentIntent.id
  });
  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount: invoice.totalCents
  };
}
async function createStripeCheckoutSession(invoiceId) {
  const [invoice] = await db.select().from(invoices).where(eq3(invoices.id, invoiceId));
  if (!invoice) {
    throw new Error("Invoice not found");
  }
  const connectAccount = await getConnectAccount(invoice.providerId);
  if (!connectAccount) {
    const err = new Error("stripe_not_ready");
    err.code = "stripe_not_ready";
    throw err;
  }
  if (!connectAccount.chargesEnabled) {
    const err = new Error("stripe_not_ready");
    err.code = "stripe_not_ready";
    throw err;
  }
  const [provider] = await db.select().from(providers).where(eq3(providers.id, invoice.providerId));
  const lineItemsData = await db.select().from(invoiceLineItems).where(eq3(invoiceLineItems.invoiceId, invoiceId));
  const stripeLineItems = lineItemsData.map((item) => ({
    price_data: {
      currency: invoice.currency || "usd",
      product_data: {
        name: item.name,
        description: item.description || void 0
      },
      unit_amount: item.unitPriceCents
    },
    quantity: Math.round(parseFloat(item.quantity?.toString() || "1"))
  }));
  if (stripeLineItems.length === 0) {
    stripeLineItems.push({
      price_data: {
        currency: invoice.currency || "usd",
        product_data: {
          name: `Invoice ${invoice.invoiceNumber}`,
          description: invoice.notes || void 0
        },
        unit_amount: invoice.totalCents
      },
      quantity: 1
    });
  }
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: stripeLineItems,
    payment_intent_data: {
      application_fee_amount: invoice.platformFeeCents || 0,
      transfer_data: {
        destination: connectAccount.stripeAccountId
      },
      metadata: {
        invoiceId: invoice.id,
        providerId: invoice.providerId
      }
    },
    success_url: `${APP_URL}/invoice/${invoiceId}/success`,
    cancel_url: `${APP_URL}/invoice/${invoiceId}/cancel`,
    metadata: {
      invoiceId: invoice.id,
      providerId: invoice.providerId
    }
  });
  await db.update(invoices).set({
    stripeCheckoutSessionId: session.id,
    hostedInvoiceUrl: session.url,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq3(invoices.id, invoiceId));
  return {
    sessionId: session.id,
    checkoutUrl: session.url
  };
}
async function applyCreditsToInvoice(invoiceId, userId, amountCents) {
  const [invoice] = await db.select().from(invoices).where(eq3(invoices.id, invoiceId));
  if (!invoice) {
    throw new Error("Invoice not found");
  }
  const allowedMethods = invoice.paymentMethodsAllowed || "stripe,credits";
  if (!allowedMethods.includes("credits")) {
    throw new Error("This invoice does not accept credit payments");
  }
  const [userCredit] = await db.select().from(userCredits).where(eq3(userCredits.userId, userId));
  if (!userCredit || (userCredit.balanceCents || 0) < amountCents) {
    throw new Error("Insufficient credits");
  }
  const maxPayable = invoice.totalCents - await getPaidAmount(invoiceId);
  const actualAmount = Math.min(amountCents, maxPayable);
  if (actualAmount <= 0) {
    throw new Error("Invoice is already paid or no amount due");
  }
  await db.update(userCredits).set({
    balanceCents: (userCredit.balanceCents || 0) - actualAmount,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq3(userCredits.userId, userId));
  await db.insert(creditLedger).values({
    userId,
    deltaCents: -actualAmount,
    reason: "invoice_payment",
    invoiceId
  });
  await db.insert(payments).values({
    invoiceId,
    providerId: invoice.providerId,
    amountCents: actualAmount,
    amount: (actualAmount / 100).toFixed(2),
    method: "credits",
    status: "succeeded"
  });
  const newPaidAmount = await getPaidAmount(invoiceId);
  const isFullyPaid = newPaidAmount >= invoice.totalCents;
  await db.update(invoices).set({
    status: isFullyPaid ? "paid" : "partially_paid",
    paidAt: isFullyPaid ? /* @__PURE__ */ new Date() : void 0,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq3(invoices.id, invoiceId));
  return {
    applied: actualAmount,
    remainingBalance: (userCredit.balanceCents || 0) - actualAmount,
    invoiceStatus: isFullyPaid ? "paid" : "partially_paid"
  };
}
async function getPaidAmount(invoiceId) {
  const allPayments = await db.select().from(payments).where(and3(eq3(payments.invoiceId, invoiceId), eq3(payments.status, "succeeded")));
  return allPayments.reduce((sum, p) => sum + (p.amountCents || 0), 0);
}
async function handleStripeWebhook(event) {
  const [existing] = await db.select().from(stripeWebhookEvents).where(eq3(stripeWebhookEvents.stripeEventId, event.id));
  if (existing) {
    console.log(`Webhook event ${event.id} already processed, skipping`);
    return { processed: false, reason: "duplicate" };
  }
  await db.insert(stripeWebhookEvents).values({
    stripeEventId: event.id,
    eventType: event.type,
    payload: JSON.stringify(event.data)
  });
  switch (event.type) {
    case "account.updated":
      await handleAccountUpdated(event.data.object);
      break;
    case "payment_intent.succeeded":
      await handlePaymentIntentSucceeded(event.data.object);
      break;
    case "payment_intent.payment_failed":
      await handlePaymentIntentFailed(event.data.object);
      break;
    case "charge.refunded":
      await handleChargeRefunded(event.data.object);
      break;
    case "payout.created":
      await handlePayoutCreated(event.data.object, event.account ?? null);
      break;
    case "payout.paid":
      await handlePayoutPaid(event.data.object, event.account ?? null);
      break;
    case "payout.failed":
      await handlePayoutFailed(event.data.object, event.account ?? null);
      break;
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event.data.object);
      break;
    default:
      console.log(`Unhandled webhook event type: ${event.type}`);
  }
  return { processed: true };
}
async function handleAccountUpdated(account) {
  const [connectAccount] = await db.select().from(stripeConnectAccounts).where(eq3(stripeConnectAccounts.stripeAccountId, account.id));
  if (!connectAccount) return;
  let onboardingStatus = "pending";
  if (account.charges_enabled && account.payouts_enabled && account.details_submitted) {
    onboardingStatus = "complete";
  }
  await db.update(stripeConnectAccounts).set({
    onboardingStatus,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted || false,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq3(stripeConnectAccounts.id, connectAccount.id));
}
async function handlePaymentIntentSucceeded(paymentIntent) {
  const invoiceId = paymentIntent.metadata?.invoiceId;
  if (!invoiceId) return;
  const [payment] = await db.select().from(payments).where(eq3(payments.stripePaymentIntentId, paymentIntent.id));
  if (payment) {
    await db.update(payments).set({
      status: "succeeded",
      stripeChargeId: paymentIntent.latest_charge?.toString()
    }).where(eq3(payments.id, payment.id));
  }
  const [updatedInvoice] = await db.update(invoices).set({
    status: "paid",
    paidAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq3(invoices.id, invoiceId)).returning();
  if (updatedInvoice) {
    try {
      const [provider] = await db.select().from(providers).where(eq3(providers.id, updatedInvoice.providerId));
      let clientEmail;
      let clientName;
      if (updatedInvoice.homeownerUserId) {
        const [homeowner] = await db.select().from(users).where(eq3(users.id, updatedInvoice.homeownerUserId));
        if (homeowner) {
          clientEmail = homeowner.email;
          clientName = `${homeowner.firstName || ""} ${homeowner.lastName || ""}`.trim() || homeowner.email;
        }
      } else if (updatedInvoice.clientId) {
        const [client] = await db.select().from(clients).where(eq3(clients.id, updatedInvoice.clientId));
        if (client) {
          clientEmail = client.email ?? void 0;
          clientName = `${client.firstName || ""} ${client.lastName || ""}`.trim() || clientEmail;
        }
      }
      if (clientEmail && provider) {
        dispatch("invoice.paid", {
          clientEmail,
          clientName: clientName ?? clientEmail,
          providerName: provider.businessName,
          invoiceNumber: updatedInvoice.invoiceNumber,
          amount: typeof updatedInvoice.total === "string" ? parseFloat(updatedInvoice.total) : updatedInvoice.total ?? 0,
          paymentDate: (/* @__PURE__ */ new Date()).toLocaleDateString(),
          relatedRecordType: "invoice",
          relatedRecordId: invoiceId
        }).catch((e) => console.error("invoice.paid dispatch error (webhook):", e));
      }
    } catch (err) {
      console.error("Failed to dispatch invoice.paid from webhook:", err);
    }
  }
}
async function handlePaymentIntentFailed(paymentIntent) {
  const invoiceId = paymentIntent.metadata?.invoiceId;
  const [payment] = await db.select().from(payments).where(eq3(payments.stripePaymentIntentId, paymentIntent.id));
  if (payment) {
    await db.update(payments).set({ status: "failed" }).where(eq3(payments.id, payment.id));
  }
  if (invoiceId) {
    try {
      const [failedInvoice] = await db.select().from(invoices).where(eq3(invoices.id, invoiceId));
      if (failedInvoice) {
        const [provider] = await db.select().from(providers).where(eq3(providers.id, failedInvoice.providerId));
        let clientEmail;
        let clientName;
        if (failedInvoice.homeownerUserId) {
          const [homeowner] = await db.select().from(users).where(eq3(users.id, failedInvoice.homeownerUserId));
          if (homeowner) {
            clientEmail = homeowner.email;
            clientName = `${homeowner.firstName || ""} ${homeowner.lastName || ""}`.trim() || homeowner.email;
          }
        } else if (failedInvoice.clientId) {
          const [client] = await db.select().from(clients).where(eq3(clients.id, failedInvoice.clientId));
          if (client) {
            clientEmail = client.email ?? void 0;
            clientName = `${client.firstName || ""} ${client.lastName || ""}`.trim() || clientEmail;
          }
        }
        if (clientEmail && provider) {
          dispatch("invoice.payment_failed", {
            clientEmail,
            clientName: clientName ?? clientEmail,
            providerName: provider.businessName,
            invoiceNumber: failedInvoice.invoiceNumber,
            amount: typeof failedInvoice.total === "string" ? parseFloat(failedInvoice.total) : failedInvoice.total ?? 0,
            relatedRecordType: "invoice",
            relatedRecordId: invoiceId
          }).catch((e) => console.error("invoice.payment_failed dispatch error:", e));
        }
      }
    } catch (err) {
      console.error("Failed to dispatch invoice.payment_failed from webhook:", err);
    }
  }
}
async function handleChargeRefunded(charge) {
  const paymentIntentId = charge.payment_intent?.toString() ?? null;
  const chargeId = charge.id;
  let payment;
  if (paymentIntentId) {
    const [byIntent] = await db.select().from(payments).where(eq3(payments.stripePaymentIntentId, paymentIntentId));
    payment = byIntent;
  }
  if (!payment) {
    const [byCharge] = await db.select().from(payments).where(eq3(payments.stripeChargeId, chargeId));
    payment = byCharge;
  }
  if (payment) {
    await db.update(payments).set({ status: "refunded" }).where(eq3(payments.id, payment.id));
    await db.update(invoices).set({
      status: "refunded",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq3(invoices.id, payment.invoiceId));
    if (charge.refunds?.data?.length) {
      for (const stripeRefund of charge.refunds.data) {
        const existing = await db.select().from(refunds).where(eq3(refunds.stripeRefundId, stripeRefund.id));
        if (existing.length === 0) {
          await db.insert(refunds).values({
            providerId: payment.providerId,
            paymentId: payment.id,
            stripeRefundId: stripeRefund.id,
            stripeChargeId: charge.id,
            amountCents: stripeRefund.amount,
            reason: stripeRefund.reason ?? null,
            status: stripeRefund.status ?? "pending"
          });
        } else {
          await db.update(refunds).set({ status: stripeRefund.status ?? "pending" }).where(eq3(refunds.stripeRefundId, stripeRefund.id));
        }
      }
    }
  }
}
async function resolveProviderFromConnectAccount(connectedAccountId) {
  if (!connectedAccountId) return null;
  const [connectAccount] = await db.select({ providerId: stripeConnectAccounts.providerId }).from(stripeConnectAccounts).where(eq3(stripeConnectAccounts.stripeAccountId, connectedAccountId));
  return connectAccount?.providerId ?? null;
}
async function handlePayoutCreated(payout, connectedAccountId) {
  const providerId = await resolveProviderFromConnectAccount(connectedAccountId);
  if (!providerId) {
    console.warn(`handlePayoutCreated: no provider found for account ${connectedAccountId}`);
    return;
  }
  const arrivalDate = payout.arrival_date ? new Date(payout.arrival_date * 1e3) : null;
  const [existingPayout] = await db.select().from(payouts).where(eq3(payouts.stripePayoutId, payout.id));
  const stripeStatus = payout.status;
  if (!existingPayout) {
    await db.insert(payouts).values({
      providerId,
      amountCents: payout.amount,
      status: stripeStatus,
      stripePayoutId: payout.id,
      arrivalDate,
      description: payout.description ?? null
    }).onConflictDoNothing();
  } else {
    await db.update(payouts).set({ status: stripeStatus, arrivalDate, description: payout.description ?? null }).where(eq3(payouts.id, existingPayout.id));
  }
}
async function handlePayoutPaid(payout, connectedAccountId) {
  const arrivalDate = payout.arrival_date ? new Date(payout.arrival_date * 1e3) : null;
  const [existingPayout] = await db.select().from(payouts).where(eq3(payouts.stripePayoutId, payout.id));
  if (existingPayout) {
    await db.update(payouts).set({
      status: "paid",
      arrivalDate: arrivalDate ?? existingPayout.arrivalDate,
      description: payout.description ?? existingPayout.description
    }).where(eq3(payouts.id, existingPayout.id));
  } else {
    const providerId = await resolveProviderFromConnectAccount(connectedAccountId);
    if (providerId) {
      await db.insert(payouts).values({
        providerId,
        amountCents: payout.amount,
        status: "paid",
        stripePayoutId: payout.id,
        arrivalDate,
        description: payout.description ?? null
      }).onConflictDoNothing();
    }
  }
}
async function handlePayoutFailed(payout, _connectedAccountId) {
  const [existingPayout] = await db.select().from(payouts).where(eq3(payouts.stripePayoutId, payout.id));
  if (existingPayout) {
    await db.update(payouts).set({ status: "failed" }).where(eq3(payouts.id, existingPayout.id));
  }
}
async function handleCheckoutSessionCompleted(session) {
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) return;
  await db.update(invoices).set({
    status: "paid",
    paidAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq3(invoices.id, invoiceId));
  const paymentIntentId = session.payment_intent?.toString();
  if (paymentIntentId) {
    const [invoice] = await db.select().from(invoices).where(eq3(invoices.id, invoiceId));
    if (invoice) {
      await db.insert(payments).values({
        invoiceId,
        providerId: invoice.providerId,
        amountCents: invoice.totalCents,
        amount: (invoice.totalCents / 100).toFixed(2),
        method: "stripe",
        status: "succeeded",
        stripePaymentIntentId: paymentIntentId
      });
    }
  }
}
async function calculateFeePreview(providerId, totalCents) {
  const plan = await getProviderPlan(providerId);
  const fee = calculatePlatformFee(
    totalCents,
    plan.platformFeePercent || "10.00",
    plan.platformFeeFixedCents || 0
  );
  return {
    planTier: plan.planTier,
    feePercent: fee.percent,
    feeFixedCents: fee.fixedCents,
    totalFeeCents: fee.totalCents,
    providerReceivesCents: totalCents - fee.totalCents
  };
}

// server/routes.ts
init_schema();

// server/auth.ts
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET || "homebase-jwt-secret-change-in-production";
function generateToken(userId, role) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "30d" });
}
function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}
var authenticateJWT = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const headerToken = raw?.startsWith("Bearer ") ? raw.slice(7) : void 0;
  const cookieToken = req.cookies?.token;
  const token = headerToken || cookieToken;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.authenticatedUserId = payload.userId;
  next();
};

// server/routes.ts
var requireAuth = authenticateJWT;
var aiRateLimitMap = /* @__PURE__ */ new Map();
var aiRateLimit = (req, res, next) => {
  const userId = req.authenticatedUserId;
  const now = Date.now();
  const windowMs = 60 * 1e3;
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
var onboardingRateLimitMap = /* @__PURE__ */ new Map();
var onboardingRateLimit = (req, res, next) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 10 * 60 * 1e3;
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
function formatUserResponse(user) {
  const { firstName, lastName, password, ...rest } = user;
  const name = [firstName, lastName].filter(Boolean).join(" ") || null;
  return { ...rest, name };
}
function parseUserName(name) {
  if (!name) return {};
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" ")
  };
}
function formatHomeResponse(home) {
  const { label, street, zip, ...rest } = home;
  return {
    ...rest,
    label,
    street,
    zip,
    nickname: label,
    address: street,
    zipCode: zip
  };
}
async function convertIntakeToClientJob(tx, params) {
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
    targetStatus = "converted"
  } = params;
  const nameParts = (clientName || "").trim().split(" ");
  const firstName = nameParts[0] || "Unknown";
  const lastName = nameParts.slice(1).join(" ") || "";
  let clientId;
  if (clientEmail) {
    const [found] = await tx.select({ id: clients.id }).from(clients).where(and4(eq4(clients.providerId, providerId), eq4(clients.email, clientEmail)));
    if (found) {
      clientId = found.id;
    } else {
      const [newC] = await tx.insert(clients).values({ providerId, firstName, lastName: lastName || null, email: clientEmail, phone: clientPhone || null, address: address || null }).returning({ id: clients.id });
      clientId = newC.id;
    }
  } else {
    const [newC] = await tx.insert(clients).values({ providerId, firstName, lastName: lastName || null, email: null, phone: clientPhone || null, address: address || null }).returning({ id: clients.id });
    clientId = newC.id;
  }
  const jobDate = scheduledDate ?? /* @__PURE__ */ new Date();
  const [newJob] = await tx.insert(jobs).values({
    providerId,
    clientId,
    title: problemDescription?.slice(0, 100) || "Service Request",
    description: problemDescription || null,
    scheduledDate: jobDate,
    scheduledTime: scheduledTime || null,
    status: "scheduled",
    address: address || null,
    estimatedPrice: estimatedPrice || null,
    notes: notes || null
  }).returning();
  const now = /* @__PURE__ */ new Date();
  await tx.update(intakeSubmissions).set({ status: targetStatus, convertedClientId: clientId, convertedJobId: newJob.id, convertedAt: now, updatedAt: now }).where(eq4(intakeSubmissions.id, submissionId));
  return { clientId, job: newJob };
}
async function registerRoutes(app2) {
  await seedDatabase();
  app2.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app2.post("/api/auth/signup", async (req, res) => {
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
        maxAge: 30 * 24 * 60 * 60 * 1e3
      });
      res.status(201).json({ user: formatUserResponse(user), token });
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
      dispatch("user.signup", { recipientUserId: user.id, recipientEmail: user.email, clientName: fullName });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Failed to create account" });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid credentials" });
      }
      const user = await storage.verifyPassword(parsed.data.email, parsed.data.password);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      let providerProfile = await storage.getProviderByUserId(user.id);
      if (providerProfile && !user.isProvider) {
        await storage.updateUser(user.id, { isProvider: true });
        user.isProvider = true;
      }
      const token = generateToken(user.id, user.isProvider ? "provider" : "homeowner");
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1e3
      });
      res.json({ user: formatUserResponse(user), providerProfile, token });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });
  app2.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const userId = req.authenticatedUserId;
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
  app2.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });
  app2.get("/api/user/:id", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
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
  app2.put("/api/user/:id", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
      if (req.params.id !== authUserId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { name, phone, avatarUrl } = req.body;
      const nameFields = name ? parseUserName(name) : {};
      const safeUpdate = { ...nameFields };
      if (phone !== void 0) safeUpdate.phone = phone;
      if (avatarUrl !== void 0) safeUpdate.avatarUrl = avatarUrl;
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
  app2.get("/api/homes/:userId", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
      if (req.params.userId !== authUserId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const homes3 = await storage.getHomes(req.params.userId);
      res.json({ homes: homes3.map(formatHomeResponse) });
    } catch (error) {
      console.error("Get homes error:", error);
      res.status(500).json({ error: "Failed to get homes" });
    }
  });
  app2.post("/api/homes", requireAuth, async (req, res) => {
    try {
      const { nickname, address, zipCode, label, street, zip, ...rest } = req.body;
      const homeData = {
        ...rest,
        userId: req.authenticatedUserId,
        label: nickname || label || "My Home",
        street: address || street,
        zip: zipCode || zip
      };
      console.log("Creating home with data:", JSON.stringify(homeData, null, 2));
      const parsed = insertHomeSchema.safeParse(homeData);
      if (!parsed.success) {
        console.error("Home validation failed:", JSON.stringify(parsed.error.issues, null, 2));
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }
      const home = await storage.createHome(parsed.data);
      if (home.street && home.city && home.state && home.zip) {
        const fullAddress = `${home.street}, ${home.city}, ${home.state} ${home.zip}`;
        enrichPropertyData(fullAddress).then(async (enrichment) => {
          try {
            const updateData = {
              housefaxEnrichedAt: /* @__PURE__ */ new Date()
            };
            if (enrichment.zillow) {
              const z2 = enrichment.zillow;
              if (z2.bedrooms) updateData.bedrooms = z2.bedrooms;
              if (z2.bathrooms) updateData.bathrooms = z2.bathrooms;
              if (z2.livingArea) updateData.squareFeet = z2.livingArea;
              if (z2.yearBuilt) updateData.yearBuilt = z2.yearBuilt;
              if (z2.lotSize) updateData.lotSize = z2.lotSize;
              if (z2.zestimate) updateData.estimatedValue = String(z2.zestimate);
              if (z2.zpid) updateData.zillowId = z2.zpid;
              if (z2.url) updateData.zillowUrl = z2.url;
              if (z2.taxAssessedValue) updateData.taxAssessedValue = String(z2.taxAssessedValue);
              if (z2.lastSoldDate) updateData.lastSoldDate = z2.lastSoldDate;
              if (z2.lastSoldPrice) updateData.lastSoldPrice = String(z2.lastSoldPrice);
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
  app2.put("/api/homes/:id", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
      const existing = await storage.getHome(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Home not found" });
      }
      if (existing.userId !== authUserId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { nickname, address, zipCode, ...rest } = req.body;
      const updateData = { ...rest };
      if (nickname !== void 0) updateData.label = nickname;
      if (address !== void 0) updateData.street = address;
      if (zipCode !== void 0) updateData.zip = zipCode;
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
  app2.delete("/api/homes/:id", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
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
  app2.get("/api/housefax/autocomplete", requireAuth, async (req, res) => {
    try {
      const query = req.query.q;
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
  app2.get("/api/housefax/place/:placeId", requireAuth, async (req, res) => {
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
  app2.post("/api/housefax/geocode", requireAuth, async (req, res) => {
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
  app2.post("/api/housefax/zillow", requireAuth, async (req, res) => {
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
  app2.post("/api/housefax/enrich", requireAuth, async (req, res) => {
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
  app2.post("/api/homes/:id/enrich", requireAuth, async (req, res) => {
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
      const updateData = {
        housefaxEnrichedAt: /* @__PURE__ */ new Date()
      };
      if (enrichment.zillow) {
        const z2 = enrichment.zillow;
        if (z2.bedrooms && !home.bedrooms) updateData.bedrooms = z2.bedrooms;
        if (z2.bathrooms && !home.bathrooms) updateData.bathrooms = z2.bathrooms;
        if (z2.livingArea && !home.squareFeet) updateData.squareFeet = z2.livingArea;
        if (z2.yearBuilt && !home.yearBuilt) updateData.yearBuilt = z2.yearBuilt;
        if (z2.lotSize) updateData.lotSize = z2.lotSize;
        if (z2.zestimate) updateData.estimatedValue = String(z2.zestimate);
        if (z2.zpid) updateData.zillowId = z2.zpid;
        if (z2.url) updateData.zillowUrl = z2.url;
        if (z2.taxAssessedValue) updateData.taxAssessedValue = String(z2.taxAssessedValue);
        if (z2.lastSoldDate) updateData.lastSoldDate = z2.lastSoldDate;
        if (z2.lastSoldPrice) updateData.lastSoldPrice = String(z2.lastSoldPrice);
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
      const updatedHome = await storage.updateHome(req.params.id, updateData);
      res.json({
        home: updatedHome ? formatHomeResponse(updatedHome) : null,
        enrichment,
        fieldsUpdated: Object.keys(updateData).length - 1
        // -1 for timestamp
      });
    } catch (error) {
      console.error("Home enrichment error:", error);
      res.status(500).json({ error: "Failed to enrich home" });
    }
  });
  app2.get("/api/homes/:id/housefax-context", requireAuth, async (req, res) => {
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
  app2.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json({ categories });
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ error: "Failed to get categories" });
    }
  });
  app2.get("/api/services", async (req, res) => {
    try {
      const categoryId = req.query.categoryId;
      const services2 = await storage.getServices(categoryId);
      res.json({ services: services2 });
    } catch (error) {
      console.error("Get services error:", error);
      res.status(500).json({ error: "Failed to get services" });
    }
  });
  app2.get("/api/providers", async (req, res) => {
    try {
      const categoryId = req.query.categoryId;
      const providers2 = await storage.getProviders(categoryId);
      res.json({ providers: providers2 });
    } catch (error) {
      console.error("Get providers error:", error);
      res.status(500).json({ error: "Failed to get providers" });
    }
  });
  app2.get("/api/providers/:id", async (req, res) => {
    try {
      const provider = await storage.getProvider(req.params.id);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }
      const providerServices2 = await storage.getProviderServices(req.params.id);
      res.json({ provider, services: providerServices2 });
    } catch (error) {
      console.error("Get provider error:", error);
      res.status(500).json({ error: "Failed to get provider" });
    }
  });
  app2.get("/api/users/:userId/appointments", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
      if (req.params.userId !== authUserId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const appointments2 = await storage.getAppointments(req.params.userId);
      res.json({ appointments: appointments2 });
    } catch (error) {
      console.error("Get appointments error:", error);
      res.status(500).json({ error: "Failed to get appointments" });
    }
  });
  app2.get("/api/appointment/:id", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
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
            avatarUrl: provider.avatarUrl
          } : null
        }
      });
    } catch (error) {
      console.error("Get appointment error:", error);
      res.status(500).json({ error: "Failed to get appointment" });
    }
  });
  app2.post("/api/appointments", requireAuth, async (req, res) => {
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
      let clientId = null;
      try {
        const [user] = await db.select().from(users).where(eq4(users.id, parsed.data.userId));
        if (user) {
          const existingClients = await db.select().from(clients).where(eq4(clients.providerId, parsed.data.providerId));
          const matchingClient = existingClients.find(
            (c) => c.email === user.email || c.firstName === (user.firstName || "") && c.phone === user.phone
          );
          if (matchingClient) {
            clientId = matchingClient.id;
          } else {
            const [newClient] = await db.insert(clients).values({
              providerId: parsed.data.providerId,
              firstName: user.firstName || "Unknown",
              lastName: user.lastName || "",
              email: user.email,
              phone: user.phone || ""
            }).returning();
            clientId = newClient.id;
          }
        }
      } catch (clientErr) {
        console.error("Client find/create error (non-fatal):", clientErr);
      }
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
            notes: `Booked via homeowner portal.`
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
      const [bookedUser] = await db.select().from(users).where(eq4(users.id, parsed.data.userId)).catch(() => [null]);
      const [bookedProvider] = await db.select().from(providers).where(eq4(providers.id, parsed.data.providerId)).catch(() => [null]);
      if (bookedUser && bookedProvider) {
        dispatch("booking.created", {
          clientEmail: bookedUser.email,
          clientName: `${bookedUser.firstName || ""} ${bookedUser.lastName || ""}`.trim() || bookedUser.email,
          providerEmail: bookedProvider.email ?? void 0,
          providerName: bookedProvider.businessName,
          serviceName: parsed.data.serviceName,
          appointmentDate: parsed.data.scheduledDate,
          appointmentTime: parsed.data.scheduledTime,
          estimatedPrice: parsed.data.estimatedPrice ?? void 0,
          confirmationNumber: appointment.id,
          relatedRecordType: "appointment",
          relatedRecordId: appointment.id,
          recipientUserId: bookedUser.id
        }).catch((e) => console.error("booking.created dispatch error:", e));
      }
      res.status(201).json({ appointment });
    } catch (error) {
      console.error("Create appointment error:", error);
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });
  app2.put("/api/appointments/:id", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
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
      const [updatedApptUser] = await db.select().from(users).where(eq4(users.id, appointment.userId)).catch(() => [null]);
      const [updatedApptProvider] = await db.select().from(providers).where(eq4(providers.id, appointment.providerId)).catch(() => [null]);
      if (updatedApptUser && updatedApptProvider) {
        dispatch("booking.updated", {
          clientEmail: updatedApptUser.email,
          clientName: `${updatedApptUser.firstName || ""} ${updatedApptUser.lastName || ""}`.trim() || updatedApptUser.email,
          providerName: updatedApptProvider.businessName,
          serviceName: appointment.serviceName,
          appointmentDate: appointment.scheduledDate,
          appointmentTime: appointment.scheduledTime,
          relatedRecordType: "appointment",
          relatedRecordId: appointment.id,
          recipientUserId: updatedApptUser.id
        }).catch((e) => console.error("booking.updated dispatch error:", e));
      }
      res.json({ appointment });
    } catch (error) {
      console.error("Update appointment error:", error);
      res.status(500).json({ error: "Failed to update appointment" });
    }
  });
  app2.post("/api/appointments/:id/cancel", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
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
      const [cancelledUser] = await db.select().from(users).where(eq4(users.id, appointment.userId)).catch(() => [null]);
      const [cancelledProvider] = await db.select().from(providers).where(eq4(providers.id, appointment.providerId)).catch(() => [null]);
      if (cancelledUser && cancelledProvider) {
        dispatch("booking.cancelled", {
          clientEmail: cancelledUser.email,
          clientName: `${cancelledUser.firstName || ""} ${cancelledUser.lastName || ""}`.trim() || cancelledUser.email,
          providerName: cancelledProvider.businessName,
          serviceName: appointment.serviceName,
          appointmentDate: appointment.scheduledDate,
          appointmentTime: appointment.scheduledTime,
          relatedRecordType: "appointment",
          relatedRecordId: appointment.id,
          recipientUserId: cancelledUser.id
        }).catch((e) => console.error("booking.cancelled dispatch error:", e));
      }
      res.json({ appointment });
    } catch (error) {
      console.error("Cancel appointment error:", error);
      res.status(500).json({ error: "Failed to cancel appointment" });
    }
  });
  app2.post("/api/appointments/:id/reschedule", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
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
        status: "pending"
        // Reset to pending when rescheduled
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
      const [rescheduledUser] = await db.select().from(users).where(eq4(users.id, appointment.userId)).catch(() => [null]);
      const [rescheduledProvider] = await db.select().from(providers).where(eq4(providers.id, appointment.providerId)).catch(() => [null]);
      if (rescheduledUser && rescheduledProvider) {
        dispatch("booking.rescheduled", {
          clientEmail: rescheduledUser.email,
          clientName: `${rescheduledUser.firstName || ""} ${rescheduledUser.lastName || ""}`.trim() || rescheduledUser.email,
          providerName: rescheduledProvider.businessName,
          serviceName: appointment.serviceName,
          appointmentDate: scheduledDate,
          appointmentTime: scheduledTime,
          oldDate: existing.scheduledDate,
          oldTime: existing.scheduledTime,
          relatedRecordType: "appointment",
          relatedRecordId: appointment.id,
          recipientUserId: rescheduledUser.id
        }).catch((e) => console.error("booking.rescheduled dispatch error:", e));
      }
      res.json({ appointment });
    } catch (error) {
      console.error("Reschedule appointment error:", error);
      res.status(500).json({ error: "Failed to reschedule appointment" });
    }
  });
  app2.get("/api/appointments/:id", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
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
      const providerInfo = provider ? { businessName: provider.businessName, phone: provider.phone, email: provider.email } : null;
      res.json({ appointment, provider: providerInfo });
    } catch (error) {
      console.error("Get appointment error:", error);
      res.status(500).json({ error: "Failed to get appointment" });
    }
  });
  app2.get("/api/notifications/:userId", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
      if (req.params.userId !== authUserId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const notifications2 = await storage.getNotifications(req.params.userId);
      res.json({ notifications: notifications2 });
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });
  app2.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
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
  app2.post("/api/notifications/:userId/read-all", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
      if (req.params.userId !== authUserId) {
        return res.status(403).json({ error: "Access denied" });
      }
      await db.update(notifications).set({ isRead: true }).where(
        and4(eq4(notifications.userId, authUserId), eq4(notifications.isRead, false))
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Mark all notifications read error:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });
  app2.get("/api/notifications/:userId/unread-count", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
      if (req.params.userId !== authUserId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const result = await db.select({ count: sql3`count(*)::int` }).from(notifications).where(and4(eq4(notifications.userId, authUserId), eq4(notifications.isRead, false)));
      const count = result[0]?.count || 0;
      res.json({ count });
    } catch (error) {
      console.error("Get unread count error:", error);
      res.status(500).json({ error: "Failed to get unread count" });
    }
  });
  app2.post("/api/push-tokens", requireAuth, async (req, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { token, platform } = req.body;
      if (!token) {
        return res.status(400).json({ error: "token is required" });
      }
      await db.insert(pushTokens).values({ userId, token, platform: platform || "expo", isActive: true }).onConflictDoNothing();
      await db.update(pushTokens).set({ isActive: true, updatedAt: /* @__PURE__ */ new Date() }).where(
        and4(eq4(pushTokens.userId, userId), eq4(pushTokens.token, token))
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Register push token error:", error);
      res.status(500).json({ error: "Failed to register push token" });
    }
  });
  app2.delete("/api/push-tokens", requireAuth, async (req, res) => {
    try {
      const userId = req.authenticatedUserId;
      const { token } = req.body;
      if (token) {
        await db.update(pushTokens).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(
          and4(eq4(pushTokens.userId, userId), eq4(pushTokens.token, token))
        );
      } else {
        await db.update(pushTokens).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(
          eq4(pushTokens.userId, userId)
        );
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete push token error:", error);
      res.status(500).json({ error: "Failed to delete push token" });
    }
  });
  app2.get("/api/notification-preferences/:userId", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
      if (req.params.userId !== authUserId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const [prefs] = await db.select().from(notificationPreferences).where(eq4(notificationPreferences.userId, authUserId));
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
          inAppEnabled: true
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
  app2.post("/api/notification-preferences", requireAuth, async (req, res) => {
    try {
      const userId = req.authenticatedUserId;
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
        "inAppEnabled"
      ];
      const safeUpdates = { userId, updatedAt: /* @__PURE__ */ new Date() };
      for (const key of allowed) {
        if (updates[key] !== void 0) safeUpdates[key] = updates[key];
      }
      const [existing] = await db.select().from(notificationPreferences).where(eq4(notificationPreferences.userId, userId));
      if (existing) {
        const [updated] = await db.update(notificationPreferences).set(safeUpdates).where(eq4(notificationPreferences.userId, userId)).returning();
        res.json({ preferences: updated });
      } else {
        const [created] = await db.insert(notificationPreferences).values(safeUpdates).returning();
        res.json({ preferences: created });
      }
    } catch (error) {
      console.error("Update notification preferences error:", error);
      res.status(500).json({ error: "Failed to update notification preferences" });
    }
  });
  app2.post("/api/chat", requireAuth, aiRateLimit, async (req, res) => {
    try {
      const { messages, homeId } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }
      let systemPrompt = HOMEBASE_SYSTEM_PROMPT;
      if (homeId) {
        const home = await storage.getHome(homeId);
        if (home) {
          const houseFaxContext = buildHouseFaxContext(home);
          systemPrompt = `${HOMEBASE_SYSTEM_PROMPT}

## Current Home Context (HouseFax)
You are speaking with a homeowner about their property. Reference this information naturally in your responses:

${houseFaxContext}`;
        }
      }
      const chatMessages = [
        { role: "system", content: systemPrompt },
        ...messages
      ];
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: chatMessages,
        stream: true,
        max_tokens: 1024
      });
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}

`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}

`);
      res.end();
    } catch (error) {
      console.error("Error in chat:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to get response" })}

`);
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
  app2.post("/api/chat/simple", requireAuth, aiRateLimit, async (req, res) => {
    try {
      const { message, history, homeId } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      let systemPrompt = ENHANCED_CHAT_PROMPT;
      if (homeId) {
        const home = await storage.getHome(homeId);
        if (home) {
          const houseFaxContext = buildHouseFaxContext(home);
          systemPrompt = `${ENHANCED_CHAT_PROMPT}

## Current Home Context (HouseFax)
You are speaking with a homeowner about their property. Use this information to give personalized advice:

${houseFaxContext}`;
        }
      }
      const messages = [
        { role: "system", content: systemPrompt }
      ];
      if (history) {
        messages.push(...history.map((m) => ({
          role: m.role,
          content: m.content
        })));
      }
      messages.push({ role: "user", content: message });
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 1024,
        response_format: { type: "json_object" }
      });
      const content = response.choices[0]?.message?.content || "{}";
      try {
        const parsed = JSON.parse(content);
        res.json({
          response: parsed.response || "I'm here to help with your home questions.",
          needsService: parsed.needsService || false,
          category: parsed.category || null,
          problemSummary: parsed.problemSummary || null
        });
      } catch {
        res.json({ response: content, needsService: false, category: null, problemSummary: null });
      }
    } catch (error) {
      console.error("Error in simple chat:", error);
      res.status(500).json({ error: "Failed to process chat request" });
    }
  });
  app2.post("/api/ai/provider-assistant", requireAuth, aiRateLimit, async (req, res) => {
    try {
      const { message, businessContext, conversationHistory } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      const systemPrompt = businessContext ? `${PROVIDER_ASSISTANT_PROMPT}

Current Business Context:
${businessContext}` : PROVIDER_ASSISTANT_PROMPT;
      const messages = [
        { role: "system", content: systemPrompt }
      ];
      if (conversationHistory) {
        messages.push(
          ...conversationHistory.map((m) => ({
            role: m.role,
            content: m.content
          }))
        );
      }
      messages.push({ role: "user", content: message });
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 1024
      });
      const content = response.choices[0]?.message?.content || "I'm here to help with your business questions.";
      res.json({ response: content });
    } catch (error) {
      console.error("Provider assistant error:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });
  app2.post("/api/ai/pricing-assistant", requireAuth, aiRateLimit, async (req, res) => {
    try {
      const { providerId, serviceName, description, clientId } = req.body;
      if (!serviceName) {
        return res.status(400).json({ error: "Service name is required" });
      }
      let businessContext = "";
      if (providerId) {
        const [provider, jobs2] = await Promise.all([
          storage.getProvider(providerId),
          storage.getJobs(providerId)
        ]);
        if (provider) {
          businessContext += `Provider: ${provider.businessName}
`;
          if (provider.hourlyRate) {
            businessContext += `Hourly Rate: $${provider.hourlyRate}
`;
          }
        }
        if (jobs2 && jobs2.length > 0) {
          const completedJobs = jobs2.filter(
            (j) => j.status === "completed" && j.finalPrice
          );
          if (completedJobs.length > 0) {
            const avgPrice = completedJobs.reduce(
              (sum, j) => sum + parseFloat(j.finalPrice || "0"),
              0
            ) / completedJobs.length;
            businessContext += `Average completed job price: $${avgPrice.toFixed(2)}
`;
            businessContext += `Total completed jobs: ${completedJobs.length}
`;
          }
        }
      }
      const prompt = `You are a pricing expert for home service providers. Based on the service and context, suggest an appropriate price.

Service: ${serviceName}
${description ? `Description: ${description}` : ""}
${businessContext ? `
Business Context:
${businessContext}` : ""}

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
        max_tokens: 256
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
            reasoning: "Based on typical service rates in the home services industry."
          }
        });
      }
    } catch (error) {
      console.error("Pricing assistant error:", error);
      res.status(500).json({ error: "Failed to generate pricing suggestion" });
    }
  });
  app2.post("/api/ai/suggest-description", requireAuth, aiRateLimit, async (req, res) => {
    try {
      const { serviceName, category } = req.body;
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
        max_tokens: 200
      });
      const description = response.choices[0]?.message?.content?.trim() || "";
      res.json({ description });
    } catch (error) {
      console.error("Suggest description error:", error);
      res.status(500).json({ error: "Failed to generate description" });
    }
  });
  app2.post("/api/ai/suggest-service-names", requireAuth, aiRateLimit, async (req, res) => {
    try {
      const { category } = req.body;
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
        response_format: { type: "json_object" }
      });
      let names = [];
      try {
        const raw = response.choices[0]?.message?.content?.trim() || "{}";
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.names) ? parsed.names : Object.values(parsed)[0];
        names = arr.slice(0, 3).filter((n) => typeof n === "string");
      } catch {
        names = [];
      }
      res.json({ names });
    } catch (error) {
      console.error("Suggest service names error:", error);
      res.status(500).json({ error: "Failed to generate service names" });
    }
  });
  app2.post("/api/ai/suggest-price", requireAuth, aiRateLimit, async (req, res) => {
    try {
      const { serviceName, category, pricingType, location } = req.body;
      if (!serviceName || !category || !pricingType) {
        return res.status(400).json({ error: "serviceName, category, and pricingType are required" });
      }
      const pricingContext = {
        "flat": "a single flat rate for the entire job",
        "variable": "tier-based pricing (e.g., small/medium/large with different rates)",
        "service_call": "a service call fee plus hourly labor",
        "quote": "custom quote only \u2014 no upfront price"
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
        max_tokens: 150
      });
      const content = response.choices[0]?.message?.content || "";
      try {
        const suggestion = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
        res.json({ suggestion });
      } catch {
        res.json({
          suggestion: { minPrice: 50, maxPrice: 150, unit: "per job", hint: "Price competitively to win your first bookings." }
        });
      }
    } catch (error) {
      console.error("Suggest price error:", error);
      res.status(500).json({ error: "Failed to generate price suggestion" });
    }
  });
  app2.post("/api/ai/improve-bio", requireAuth, aiRateLimit, async (req, res) => {
    try {
      const { currentBio, businessName, category } = req.body;
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
- Be concise (2\u20133 sentences max)
- Appeal to homeowners looking for reliable help
- Keep their actual experience, years, and specifics

Respond ONLY with the improved bio text, no quotes, no explanations.`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200
      });
      const improvedBio = response.choices[0]?.message?.content?.trim() || currentBio;
      res.json({ improvedBio });
    } catch (error) {
      console.error("Improve bio error:", error);
      res.status(500).json({ error: "Failed to improve bio" });
    }
  });
  app2.post("/api/ai/onboarding/suggest-business-names", onboardingRateLimit, async (req, res) => {
    try {
      const { category } = req.body;
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
        response_format: { type: "json_object" }
      });
      const raw = response.choices[0]?.message?.content?.trim() || '{"names":[]}';
      const parsed = JSON.parse(raw);
      res.json({ names: Array.isArray(parsed.names) ? parsed.names.slice(0, 3) : [] });
    } catch (error) {
      console.error("Suggest business names error:", error);
      res.status(500).json({ error: "Failed to suggest business names" });
    }
  });
  app2.post("/api/ai/onboarding/suggest-service-names", onboardingRateLimit, async (req, res) => {
    try {
      const { category } = req.body;
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
        response_format: { type: "json_object" }
      });
      const raw = response.choices[0]?.message?.content?.trim() || '{"names":[]}';
      const parsed = JSON.parse(raw);
      res.json({ names: Array.isArray(parsed.names) ? parsed.names.slice(0, 3) : [] });
    } catch (error) {
      console.error("Suggest service names error:", error);
      res.status(500).json({ error: "Failed to suggest service names" });
    }
  });
  app2.post("/api/ai/onboarding/suggest-description", onboardingRateLimit, async (req, res) => {
    try {
      const { serviceName, category } = req.body;
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
        max_tokens: 150
      });
      const description = response.choices[0]?.message?.content?.trim() || "";
      res.json({ description });
    } catch (error) {
      console.error("Suggest description error:", error);
      res.status(500).json({ error: "Failed to suggest description" });
    }
  });
  app2.post("/api/ai/onboarding/suggest-price", onboardingRateLimit, async (req, res) => {
    try {
      const { serviceName, category, pricingType, location } = req.body;
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
        response_format: { type: "json_object" }
      });
      const raw = response.choices[0]?.message?.content?.trim() || "{}";
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (error) {
      console.error("Suggest price error:", error);
      res.status(500).json({ error: "Failed to suggest price" });
    }
  });
  app2.post("/api/ai/onboarding/generate-bio", onboardingRateLimit, async (req, res) => {
    try {
      const { businessName, category, serviceName } = req.body;
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
        max_tokens: 200
      });
      const bio = response.choices[0]?.message?.content?.trim() || "";
      res.json({ bio });
    } catch (error) {
      console.error("Generate bio error:", error);
      res.status(500).json({ error: "Failed to generate bio" });
    }
  });
  app2.post("/api/ai/onboarding/polish-text", onboardingRateLimit, async (req, res) => {
    try {
      const { text: text2, context } = req.body;
      if (!text2 || !text2.trim()) return res.status(400).json({ error: "text is required" });
      const prompt = `You are a professional editor. Fix the grammar, punctuation, capitalization, and clarity of the following text written by a home service provider${context ? ` (context: ${context})` : ""}.

Original text:
"${text2.trim()}"

Rules:
- Fix all grammar, spelling, and punctuation errors
- Improve sentence structure if needed
- Keep the meaning and voice intact \u2014 do not add new information
- Use proper capitalization
- Keep it the same length or shorter

Respond ONLY with the polished text. No quotes, no explanations.`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300
      });
      const rawPolished = response.choices[0]?.message?.content?.trim() || text2;
      const polished = rawPolished.replace(/^["']|["']$/g, "").trim();
      res.json({ polished });
    } catch (error) {
      console.error("Polish text error:", error);
      res.status(500).json({ error: "Failed to polish text" });
    }
  });
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
  app2.post("/api/intake/analyze", requireAuth, aiRateLimit, async (req, res) => {
    try {
      const { problem, conversationHistory } = req.body;
      if (!problem) {
        return res.status(400).json({ error: "Problem description is required" });
      }
      const messages = [
        { role: "system", content: INTAKE_SYSTEM_PROMPT }
      ];
      if (conversationHistory && conversationHistory.length > 0) {
        for (const msg of conversationHistory) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
      messages.push({ role: "user", content: problem });
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 1024,
        response_format: { type: "json_object" }
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
          estimatedPriceRange: analysis.estimatedPriceRange || { min: 100, max: 300 }
        }
      });
    } catch (error) {
      console.error("Error in intake analysis:", error);
      res.status(500).json({ error: "Failed to analyze problem" });
    }
  });
  app2.post("/api/intake/refine", requireAuth, aiRateLimit, async (req, res) => {
    try {
      const { originalAnalysis, answers } = req.body;
      if (!originalAnalysis || !answers) {
        return res.status(400).json({ error: "Original analysis and answers required" });
      }
      const refinementPrompt = `Based on this home service issue:
Category: ${originalAnalysis.category}
Summary: ${originalAnalysis.summary}
Severity: ${originalAnalysis.severity}

The homeowner answered these clarifying questions:
${answers.map((a) => `Q: ${a.question}
A: ${a.answer}`).join("\n\n")}

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
          { role: "user", content: refinementPrompt }
        ],
        max_tokens: 1500,
        response_format: { type: "json_object" }
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
          confidence: refinedAnalysis.confidence || 75
        }
      });
    } catch (error) {
      console.error("Error refining intake:", error);
      res.status(500).json({ error: "Failed to refine analysis" });
    }
  });
  app2.post("/api/intake/match-providers", requireAuth, aiRateLimit, async (req, res) => {
    try {
      const { category, zipCode } = req.body;
      if (!category) {
        return res.status(400).json({ error: "Category is required" });
      }
      const categoryMap = {
        plumbing: "plumbing",
        electrical: "electrical",
        hvac: "hvac",
        cleaning: "cleaning",
        landscaping: "lawn",
        painting: "painting",
        roofing: "roofing",
        handyman: "handyman"
      };
      const categoryId = categoryMap[category.toLowerCase()] || "handyman";
      const allProviders = await storage.getProviders(categoryId);
      const rankedProviders = allProviders.map((provider) => ({
        ...provider,
        trustScore: calculateTrustScore(provider)
      })).sort((a, b) => b.trustScore - a.trustScore).slice(0, 5);
      res.json({
        success: true,
        providers: rankedProviders,
        totalAvailable: allProviders.length
      });
    } catch (error) {
      console.error("Error matching providers:", error);
      res.status(500).json({ error: "Failed to match providers" });
    }
  });
  function calculateTrustScore(provider) {
    const rating = typeof provider.rating === "string" ? parseFloat(provider.rating) : provider.rating || 4;
    const ratingScore = rating * 15;
    const reviewScore = Math.min((provider.reviewCount || 0) / 5, 20);
    const experienceScore = Math.min((provider.yearsExperience || 0) * 2, 20);
    const verifiedBonus = provider.isVerified ? 15 : 0;
    return Math.round(ratingScore + reviewScore + experienceScore + verifiedBonus);
  }
  app2.post("/api/intake/explain-issue", requireAuth, aiRateLimit, async (req, res) => {
    try {
      const { problem, category, answers, service, providerName } = req.body;
      if (!problem || !category) {
        return res.status(400).json({ error: "Problem and category are required" });
      }
      const answersSummary = Object.entries(answers).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`).join("\n");
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
          { role: "user", content: prompt }
        ],
        max_tokens: 800,
        response_format: { type: "json_object" }
      });
      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      res.json({
        explanation: parsed.explanation || "Based on your description, we understand your situation and will connect you with a qualified professional.",
        recommendedService: parsed.recommendedService || service || category,
        whatToExpect: parsed.whatToExpect || [
          "A professional will contact you to confirm the appointment",
          "They'll assess the situation at your location",
          "You'll receive a final quote before work begins"
        ],
        estimatedDuration: parsed.estimatedDuration || "1-2 hours",
        priceRange: parsed.priceRange || { min: 100, max: 300 }
      });
    } catch (error) {
      console.error("Error explaining issue:", error);
      res.status(500).json({ error: "Failed to explain issue" });
    }
  });
  app2.get("/api/homes/:homeId/service-history", requireAuth, async (req, res) => {
    try {
      const { homeId } = req.params;
      const serviceHistory = await db.select().from(appointments).where(eq4(appointments.homeId, homeId)).orderBy(sql3`${appointments.completedAt} DESC NULLS LAST, ${appointments.scheduledDate} DESC`);
      res.json({ serviceHistory });
    } catch (error) {
      console.error("Error fetching service history:", error);
      res.status(500).json({ error: "Failed to fetch service history" });
    }
  });
  app2.get("/api/homes/:homeId/reminders", requireAuth, async (req, res) => {
    try {
      const { homeId } = req.params;
      const reminders = await db.select().from(maintenanceReminders).where(eq4(maintenanceReminders.homeId, homeId)).orderBy(maintenanceReminders.nextDueAt);
      res.json({ reminders });
    } catch (error) {
      console.error("Error fetching reminders:", error);
      res.status(500).json({ error: "Failed to fetch reminders" });
    }
  });
  app2.post("/api/homes/:homeId/reminders", requireAuth, async (req, res) => {
    try {
      const { homeId } = req.params;
      const { title, description, category, frequency, nextDueAt, userId } = req.body;
      const [reminder] = await db.insert(maintenanceReminders).values({
        homeId,
        userId,
        title,
        description,
        category,
        frequency,
        nextDueAt: new Date(nextDueAt)
      }).returning();
      res.json({ reminder });
    } catch (error) {
      console.error("Error creating reminder:", error);
      res.status(500).json({ error: "Failed to create reminder" });
    }
  });
  app2.put("/api/reminders/:id/complete", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const [existing] = await db.select().from(maintenanceReminders).where(eq4(maintenanceReminders.id, id));
      if (!existing) {
        return res.status(404).json({ error: "Reminder not found" });
      }
      const frequencyToMonths = {
        monthly: 1,
        quarterly: 3,
        biannually: 6,
        annually: 12,
        custom: 12
      };
      const months = frequencyToMonths[existing.frequency || "annually"];
      const nextDue = /* @__PURE__ */ new Date();
      nextDue.setMonth(nextDue.getMonth() + months);
      const [updated] = await db.update(maintenanceReminders).set({
        lastCompletedAt: /* @__PURE__ */ new Date(),
        nextDueAt: nextDue
      }).where(eq4(maintenanceReminders.id, id)).returning();
      res.json({ reminder: updated });
    } catch (error) {
      console.error("Error completing reminder:", error);
      res.status(500).json({ error: "Failed to complete reminder" });
    }
  });
  app2.get("/api/provider/:providerId/availability", requireAuth, async (req, res) => {
    try {
      const { date } = req.query;
      const [link] = await db.select().from(bookingLinks).where(eq4(bookingLinks.providerId, req.params.providerId)).limit(1);
      let rules = {};
      if (link?.availabilityRules) {
        try {
          rules = JSON.parse(link.availabilityRules);
        } catch {
        }
      }
      const blackoutDates = rules.blackoutDates || [];
      if (date && blackoutDates.includes(date)) {
        return res.json({ slots: [] });
      }
      const startHour = rules.workingHours?.start ? parseInt(rules.workingHours.start.split(":")[0], 10) : rules.startHour ?? 8;
      const endHour = rules.workingHours?.end ? parseInt(rules.workingHours.end.split(":")[0], 10) : rules.endHour ?? 17;
      const intervalMinutes = rules.slotIntervalMinutes ?? 60;
      if (date) {
        const d = /* @__PURE__ */ new Date(date + "T12:00:00Z");
        const dayOfWeek = d.getUTCDay();
        const workingDays = rules.workingHours?.days ?? [1, 2, 3, 4, 5];
        if (!workingDays.includes(dayOfWeek)) {
          return res.json({ slots: [] });
        }
      }
      const slots = [];
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
  app2.get("/api/provider/:providerId/custom-services", requireAuth, async (req, res) => {
    try {
      const publishedOnly = req.query.publishedOnly === "true";
      const conditions = publishedOnly ? and4(eq4(providerCustomServices.providerId, req.params.providerId), eq4(providerCustomServices.isPublished, true)) : eq4(providerCustomServices.providerId, req.params.providerId);
      const svcList = await db.select().from(providerCustomServices).where(conditions).orderBy(providerCustomServices.createdAt);
      res.json({ services: svcList });
    } catch (error) {
      console.error("Get custom services error:", error);
      res.status(500).json({ error: "Failed to get services" });
    }
  });
  app2.post("/api/provider/:providerId/custom-services", requireAuth, async (req, res) => {
    try {
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
  app2.put("/api/provider/:providerId/custom-services/:id", requireAuth, async (req, res) => {
    try {
      const [existing] = await db.select().from(providerCustomServices).where(eq4(providerCustomServices.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Service not found" });
      if (existing.providerId !== req.params.providerId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { name, category, description, pricingType, basePrice, priceFrom, priceTo, priceTiersJson, duration, isPublished, isAddon } = req.body;
      const allowedUpdate = {};
      if (name !== void 0) allowedUpdate.name = name;
      if (category !== void 0) allowedUpdate.category = category;
      if (description !== void 0) allowedUpdate.description = description;
      if (pricingType !== void 0) allowedUpdate.pricingType = pricingType;
      if (basePrice !== void 0) allowedUpdate.basePrice = basePrice;
      if (priceFrom !== void 0) allowedUpdate.priceFrom = priceFrom;
      if (priceTo !== void 0) allowedUpdate.priceTo = priceTo;
      if (priceTiersJson !== void 0) allowedUpdate.priceTiersJson = priceTiersJson;
      if (duration !== void 0) allowedUpdate.duration = duration;
      if (isPublished !== void 0) allowedUpdate.isPublished = isPublished;
      if (isAddon !== void 0) allowedUpdate.isAddon = isAddon;
      const [svc] = await db.update(providerCustomServices).set({ ...allowedUpdate, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(providerCustomServices.id, req.params.id)).returning();
      res.json({ service: svc });
    } catch (error) {
      console.error("Update custom service error:", error);
      res.status(500).json({ error: "Failed to update service" });
    }
  });
  app2.delete("/api/provider/:providerId/custom-services/:id", requireAuth, async (req, res) => {
    try {
      const [existing] = await db.select().from(providerCustomServices).where(eq4(providerCustomServices.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Service not found" });
      if (existing.providerId !== req.params.providerId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await db.delete(providerCustomServices).where(eq4(providerCustomServices.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Delete custom service error:", error);
      res.status(500).json({ error: "Failed to delete service" });
    }
  });
  app2.post("/api/provider/register", requireAuth, async (req, res) => {
    try {
      const parsed = insertProviderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }
      if (parsed.data.userId) {
        const existing = await storage.getProviderByUserId(parsed.data.userId);
        if (existing) {
          return res.status(409).json({ error: "User already has a provider profile" });
        }
      }
      const provider = await storage.createProvider(parsed.data);
      if (parsed.data.userId) {
        await storage.updateUser(parsed.data.userId, { isProvider: true });
      }
      res.status(201).json({ provider });
    } catch (error) {
      console.error("Provider registration error:", error);
      res.status(500).json({ error: "Failed to register provider" });
    }
  });
  app2.get("/api/provider/user/:userId", requireAuth, async (req, res) => {
    try {
      const provider = await storage.getProviderByUserId(req.params.userId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }
      const parsed = { ...provider };
      if (parsed.bookingPolicies && typeof parsed.bookingPolicies === "string") {
        try {
          parsed.bookingPolicies = JSON.parse(parsed.bookingPolicies);
        } catch {
        }
      }
      if (parsed.businessHours && typeof parsed.businessHours === "string") {
        try {
          parsed.businessHours = JSON.parse(parsed.businessHours);
        } catch {
        }
      }
      res.json({ provider: parsed });
    } catch (error) {
      console.error("Get provider error:", error);
      res.status(500).json({ error: "Failed to get provider" });
    }
  });
  app2.put("/api/provider/:id", requireAuth, async (req, res) => {
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
  app2.patch("/api/provider/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body;
      const update = {};
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
        "instantBooking",
        "advanceBookingDays"
      ];
      for (const field of directFields) {
        if (body[field] !== void 0) update[field] = body[field];
      }
      if (body.bookingPolicies !== void 0) {
        update.bookingPolicies = typeof body.bookingPolicies === "string" ? JSON.parse(body.bookingPolicies) : body.bookingPolicies;
      }
      if (body.businessHours !== void 0) {
        update.businessHours = typeof body.businessHours === "string" ? JSON.parse(body.businessHours) : body.businessHours;
      }
      if (body.availability !== void 0) {
        const existing = await storage.getProvider(id);
        let existingPolicies = {};
        if (existing?.bookingPolicies) {
          existingPolicies = typeof existing.bookingPolicies === "string" ? JSON.parse(existing.bookingPolicies) : existing.bookingPolicies || {};
        }
        const availability = typeof body.availability === "string" ? JSON.parse(body.availability) : body.availability;
        update.bookingPolicies = { ...existingPolicies, availability };
      }
      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      const provider = await storage.updateProvider(id, update);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }
      const parsed = { ...provider };
      if (parsed.bookingPolicies) {
        try {
          parsed.bookingPolicies = JSON.parse(parsed.bookingPolicies);
        } catch {
        }
      }
      res.json({ provider: parsed });
    } catch (error) {
      console.error("Patch provider error:", error);
      res.status(500).json({ error: error.message || "Failed to update provider" });
    }
  });
  app2.get("/api/provider/:id/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getProviderStats(req.params.id);
      res.json({ stats });
    } catch (error) {
      console.error("Get provider stats error:", error);
      res.status(500).json({ error: "Failed to get provider stats" });
    }
  });
  app2.get("/api/provider/:id/reviews", requireAuth, async (req, res) => {
    try {
      const reviewRows = await db.select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        reviewerName: sql3`TRIM(CONCAT(COALESCE(${users.firstName}, ''), ' ', COALESCE(${users.lastName}, '')))`
      }).from(reviews).innerJoin(users, eq4(reviews.userId, users.id)).where(eq4(reviews.providerId, req.params.id)).orderBy(desc2(reviews.createdAt));
      res.json({ reviews: reviewRows });
    } catch (error) {
      console.error("Get provider reviews error:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });
  app2.get("/api/provider/:providerId/clients", requireAuth, async (req, res) => {
    try {
      const clients2 = await storage.getClients(req.params.providerId);
      res.json({ clients: clients2 });
    } catch (error) {
      console.error("Get clients error:", error);
      res.status(500).json({ error: "Failed to get clients" });
    }
  });
  app2.get("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      const jobs2 = await storage.getJobsByClient(req.params.id);
      const invoices2 = await storage.getInvoicesByClient(req.params.id);
      res.json({ client, jobs: jobs2, invoices: invoices2 });
    } catch (error) {
      console.error("Get client error:", error);
      res.status(500).json({ error: "Failed to get client" });
    }
  });
  app2.post("/api/clients", requireAuth, async (req, res) => {
    try {
      const parsed = insertClientSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }
      if (parsed.data.email && parsed.data.providerId) {
        const existingClients = await storage.getClients(parsed.data.providerId);
        const duplicate = existingClients.find((c) => c.email?.toLowerCase() === parsed.data.email?.toLowerCase());
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
  app2.put("/api/clients/:id", requireAuth, async (req, res) => {
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
  app2.delete("/api/clients/:id", requireAuth, async (req, res) => {
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
  app2.get("/api/provider/:providerId/jobs", requireAuth, async (req, res) => {
    try {
      const rawJobs = await storage.getJobs(req.params.providerId);
      const enrichedJobs = await Promise.all(
        rawJobs.map(async (job) => {
          if (!job.appointmentId) return { ...job, isRecurring: false, recurringFrequency: null };
          const [appt] = await db.select({ isRecurring: appointments.isRecurring, recurringFrequency: appointments.recurringFrequency }).from(appointments).where(eq4(appointments.id, job.appointmentId)).limit(1).catch(() => [null]);
          return {
            ...job,
            isRecurring: appt?.isRecurring ?? false,
            recurringFrequency: appt?.recurringFrequency ?? null
          };
        })
      );
      res.json({ jobs: enrichedJobs });
    } catch (error) {
      console.error("Get jobs error:", error);
      res.status(500).json({ error: "Failed to get jobs" });
    }
  });
  app2.get("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      let isRecurring = false;
      let recurringFrequency = null;
      if (job.appointmentId) {
        const [appt] = await db.select({ isRecurring: appointments.isRecurring, recurringFrequency: appointments.recurringFrequency }).from(appointments).where(eq4(appointments.id, job.appointmentId)).limit(1).catch(() => [null]);
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
  app2.get("/api/appointments/:id/job", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
      const appointment = await storage.getAppointment(req.params.id);
      if (!appointment) return res.json({ job: null });
      const providerRecord = await storage.getProviderByUserId(authUserId);
      const isOwner = appointment.userId === authUserId;
      const isProvider = providerRecord && appointment.providerId === providerRecord.id;
      if (!isOwner && !isProvider) return res.status(403).json({ error: "Access denied" });
      const [job] = await db.select().from(jobs).where(eq4(jobs.appointmentId, req.params.id)).limit(1);
      if (!job) return res.json({ job: null });
      res.json({ job });
    } catch (error) {
      console.error("Get appointment job error:", error);
      res.status(500).json({ error: "Failed to get job" });
    }
  });
  app2.get("/api/jobs/:id/invoice", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
      const providerRecord = await storage.getProviderByUserId(authUserId);
      const [invoice] = await db.select().from(invoices).where(eq4(invoices.jobId, req.params.id)).limit(1);
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
  async function dispatchJobStatusEmail(job, newStatus) {
    if (!job.clientId || !job.providerId) return;
    const [client] = await db.select().from(clients).where(eq4(clients.id, job.clientId)).catch(() => [null]);
    const [provider] = await db.select().from(providers).where(eq4(providers.id, job.providerId)).catch(() => [null]);
    if (!client || !provider || !client.email) return;
    await dispatch("job.status_changed", {
      clientEmail: client.email,
      clientName: `${client.firstName || ""} ${client.lastName || ""}`.trim() || client.email,
      providerName: provider.businessName,
      serviceName: job.title ?? "your job",
      newStatus,
      scheduledDate: job.scheduledDate ? String(job.scheduledDate) : void 0,
      notes: job.notes ?? void 0,
      relatedRecordType: "job",
      relatedRecordId: job.id,
      recipientUserId: client.homeownerUserId ?? void 0
    });
  }
  app2.post("/api/jobs", requireAuth, async (req, res) => {
    try {
      const jobData = {
        ...req.body,
        scheduledDate: req.body.scheduledDate ? new Date(req.body.scheduledDate) : void 0
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
  app2.put("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getJob(req.params.id);
      const job = await storage.updateJob(req.params.id, req.body);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      if (req.body.status && existing && req.body.status !== existing.status) {
        dispatchJobStatusEmail(job, req.body.status).catch((e) => console.error("job.status_changed dispatch error:", e));
      }
      res.json({ job });
    } catch (error) {
      console.error("Update job error:", error);
      res.status(500).json({ error: "Failed to update job" });
    }
  });
  app2.post("/api/jobs/:id/complete", requireAuth, async (req, res) => {
    try {
      const { finalPrice } = req.body;
      const job = await storage.completeJob(req.params.id, finalPrice);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      dispatchJobStatusEmail(job, "completed").catch((e) => console.error("job.status_changed dispatch error:", e));
      (async () => {
        try {
          if (!job.clientId || !job.providerId) return;
          const [client] = await db.select().from(clients).where(eq4(clients.id, job.clientId)).catch(() => [null]);
          const [provider] = await db.select().from(providers).where(eq4(providers.id, job.providerId)).catch(() => [null]);
          if (!client?.email || !provider) return;
          const homeownerUserId = client.homeownerUserId ?? void 0;
          const encodedName = encodeURIComponent(provider.businessName);
          const rebookLink = `homebase://SimpleBooking?providerId=${provider.id}&providerName=${encodedName}`;
          if (homeownerUserId) {
            await dispatchNotification(
              homeownerUserId,
              "Time to rebook?",
              `Your ${job.title ?? "service"} with ${provider.businessName} is done. Ready to schedule again?`,
              "rebook.prompt",
              { providerId: provider.id, providerName: provider.businessName, screen: "SimpleBooking" },
              "bookings"
            ).catch((e) => console.error("rebook push error:", e));
          }
          await dispatch("rebook.prompt", {
            clientEmail: client.email,
            clientName: `${client.firstName || ""} ${client.lastName || ""}`.trim() || client.email,
            providerName: provider.businessName,
            serviceName: job.title ?? "your service",
            rebookLink,
            recipientUserId: homeownerUserId,
            relatedRecordType: "job",
            relatedRecordId: job.id
          });
        } catch (e) {
          console.error("rebook.prompt dispatch error:", e);
        }
      })();
      res.json({ job });
    } catch (error) {
      console.error("Complete job error:", error);
      res.status(500).json({ error: "Failed to complete job" });
    }
  });
  app2.post("/api/jobs/:id/start", requireAuth, async (req, res) => {
    try {
      const job = await storage.updateJob(req.params.id, { status: "in_progress" });
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      dispatchJobStatusEmail(job, "in_progress").catch((e) => console.error("job.status_changed dispatch error:", e));
      res.json({ job });
    } catch (error) {
      console.error("Start job error:", error);
      res.status(500).json({ error: "Failed to start job" });
    }
  });
  app2.delete("/api/jobs/:id", requireAuth, async (req, res) => {
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
  app2.get("/api/provider/:providerId/invoices", requireAuth, async (req, res) => {
    try {
      const invoices2 = await storage.getInvoices(req.params.providerId);
      res.json({ invoices: invoices2 });
    } catch (error) {
      console.error("Get invoices error:", error);
      res.status(500).json({ error: "Failed to get invoices" });
    }
  });
  app2.get("/api/invoices/:id", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
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
      const payments2 = await storage.getPaymentsByInvoice(req.params.id);
      res.json({ invoice, payments: payments2 });
    } catch (error) {
      console.error("Get invoice error:", error);
      res.status(500).json({ error: "Failed to get invoice" });
    }
  });
  app2.get("/api/provider/:providerId/next-invoice-number", requireAuth, async (req, res) => {
    try {
      const invoiceNumber = await storage.getNextInvoiceNumber(req.params.providerId);
      res.json({ invoiceNumber });
    } catch (error) {
      console.error("Get next invoice number error:", error);
      res.status(500).json({ error: "Failed to get invoice number" });
    }
  });
  app2.post("/api/invoices", requireAuth, async (req, res) => {
    try {
      const invoiceNumber = req.body.invoiceNumber || `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const lineItemsInput = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];
      let total = parseFloat(req.body.amount || "0");
      if (lineItemsInput.length > 0) {
        total = lineItemsInput.reduce((sum, item) => {
          return sum + (parseFloat(item.unitPrice) || 0) * (parseFloat(item.quantity) || 1);
        }, 0);
      }
      const lineItemsJson = lineItemsInput.length > 0 ? JSON.stringify(lineItemsInput) : req.body.amount ? JSON.stringify([{ description: req.body.notes || "Service", quantity: 1, unitPrice: parseFloat(req.body.amount), total: parseFloat(req.body.amount) }]) : void 0;
      const invoiceData = {
        providerId: req.body.providerId,
        clientId: req.body.clientId,
        jobId: req.body.jobId || null,
        invoiceNumber,
        total: total.toFixed(2),
        status: "draft",
        notes: req.body.notes || null,
        lineItems: lineItemsJson,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : void 0
      };
      const parsed = insertInvoiceSchema.safeParse(invoiceData);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }
      const invoice = await storage.createInvoice(parsed.data);
      if (invoice.clientId) {
        const [draftClient] = await db.select().from(clients).where(eq4(clients.id, invoice.clientId)).catch(() => [null]);
        const [draftProvider] = await db.select().from(providers).where(eq4(providers.id, invoice.providerId)).catch(() => [null]);
        if (draftClient?.email && draftProvider) {
          dispatch("invoice.created", {
            clientEmail: draftClient.email,
            clientName: [draftClient.firstName, draftClient.lastName].filter(Boolean).join(" ") || "Client",
            providerName: draftProvider.businessName,
            invoiceNumber: invoice.invoiceNumber,
            amount: parseFloat(invoice.total?.toString() || "0"),
            dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "Due on receipt",
            relatedRecordType: "invoice",
            relatedRecordId: invoice.id,
            recipientUserId: draftClient.homeownerUserId ?? void 0
          }).catch((e) => console.error("invoice.created dispatch error:", e));
        }
      }
      res.status(201).json({ invoice });
    } catch (error) {
      console.error("Create invoice error:", error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });
  app2.post("/api/invoices/create-and-send", requireAuth, async (req, res) => {
    try {
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const lineItemsInput = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];
      let amount;
      let lineItems;
      if (lineItemsInput.length > 0) {
        lineItems = lineItemsInput.map((item) => ({
          description: item.description || "Service",
          quantity: parseFloat(item.quantity) || 1,
          unitPrice: parseFloat(item.unitPrice) || 0,
          total: (parseFloat(item.quantity) || 1) * (parseFloat(item.unitPrice) || 0)
        }));
        amount = lineItems.reduce((sum, item) => sum + item.total, 0);
      } else {
        amount = parseFloat(req.body.amount) || 0;
        lineItems = [{
          description: req.body.notes || "Service",
          quantity: 1,
          unitPrice: amount,
          total: amount
        }];
      }
      const invoiceData = {
        providerId: req.body.providerId,
        clientId: req.body.clientId,
        jobId: req.body.jobId || null,
        invoiceNumber,
        total: amount.toFixed(2),
        lineItems: JSON.stringify(lineItems),
        notes: req.body.notes || null,
        status: "sent",
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3)
      };
      const parsed = insertInvoiceSchema.safeParse(invoiceData);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }
      const invoice = await storage.createInvoice(parsed.data);
      let emailSent = false;
      let emailError;
      if (invoice.clientId) {
        const client = await storage.getClient(invoice.clientId);
        const provider = await storage.getProvider(invoice.providerId);
        if (client?.email && provider) {
          const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ") || "Client";
          const sendResult = await dispatchWithResult("invoice.sent", {
            clientEmail: client.email,
            clientName,
            providerName: provider.businessName || provider.userId || "Service Provider",
            invoiceNumber: invoice.invoiceNumber || invoiceNumber,
            amount,
            dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "Due on receipt",
            lineItems: lineItems.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total
            })),
            relatedRecordType: "invoice",
            relatedRecordId: invoice.id
          });
          emailSent = sendResult.emailSent;
          emailError = sendResult.emailError;
        } else if (!client?.email) {
          emailError = "Client has no email address on file.";
        }
      }
      res.status(201).json({ invoice, emailSent, emailError });
    } catch (error) {
      console.error("Create and send invoice error:", error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });
  app2.put("/api/invoices/:id", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
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
  app2.post("/api/invoices/:id/send", requireAuth, async (req, res) => {
    try {
      const invoiceId = req.params.id;
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      let emailSent = false;
      let emailError;
      if (invoice.clientId) {
        const client = await storage.getClient(invoice.clientId);
        const provider = await storage.getProvider(invoice.providerId);
        if (client?.email && provider) {
          const rawLineItems = invoice.lineItems;
          const lineItems = Array.isArray(rawLineItems) ? rawLineItems : typeof rawLineItems === "string" ? JSON.parse(rawLineItems) : [];
          const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ") || "Client";
          const sendResult = await dispatchWithResult("invoice.sent", {
            clientEmail: client.email,
            clientName,
            providerName: provider.businessName || provider.userId || "Service Provider",
            invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`,
            amount: parseFloat(invoice.total?.toString() || "0"),
            dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "Due on receipt",
            lineItems: lineItems.map((item) => ({
              description: item.description || item.name || "Service",
              quantity: item.quantity || 1,
              unitPrice: parseFloat(item.unitPrice?.toString() || item.price?.toString() || "0"),
              total: parseFloat(item.total?.toString() || "0")
            })),
            relatedRecordType: "invoice",
            relatedRecordId: invoice.id
          });
          emailSent = sendResult.emailSent;
          emailError = sendResult.emailError;
        }
      }
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
  app2.post("/api/invoices/:id/mark-paid", requireAuth, async (req, res) => {
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
      if (invoice && invoice.clientId) {
        try {
          const [paidClient, paidProvider] = await Promise.all([
            storage.getClient(invoice.clientId),
            storage.getProvider(invoice.providerId)
          ]);
          if (paidClient?.email && paidProvider) {
            const clientName = [paidClient.firstName, paidClient.lastName].filter(Boolean).join(" ") || "Client";
            dispatch("invoice.paid", {
              clientEmail: paidClient.email,
              clientName,
              providerName: paidProvider.businessName || "Service Provider",
              invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`,
              amount: parseFloat(invoice.total?.toString() || "0"),
              paymentDate: (/* @__PURE__ */ new Date()).toLocaleDateString(),
              relatedRecordType: "invoice",
              relatedRecordId: invoice.id,
              recipientUserId: paidClient.homeownerUserId ?? void 0
            });
          }
        } catch (_) {
        }
      }
    } catch (error) {
      console.error("Mark invoice paid error:", error);
      res.status(500).json({ error: "Failed to mark invoice as paid" });
    }
  });
  app2.post("/api/invoices/:id/cancel", requireAuth, async (req, res) => {
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
  app2.get("/api/provider/:providerId/payments", requireAuth, async (req, res) => {
    try {
      const payments2 = await storage.getPayments(req.params.providerId);
      res.json({ payments: payments2 });
    } catch (error) {
      console.error("Get payments error:", error);
      res.status(500).json({ error: "Failed to get payments" });
    }
  });
  app2.post("/api/payments", requireAuth, async (req, res) => {
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
  app2.get("/api/stripe/config", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Get Stripe config error:", error);
      res.status(500).json({ error: "Failed to get Stripe configuration" });
    }
  });
  app2.get("/api/stripe/products", async (req, res) => {
    try {
      const result = await db.execute(
        sql3`SELECT * FROM stripe.products WHERE active = true`
      );
      res.json({ products: result.rows });
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({ error: "Failed to get products" });
    }
  });
  app2.get("/api/stripe/products-with-prices", async (req, res) => {
    try {
      const result = await db.execute(
        sql3`
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
      const productsMap = /* @__PURE__ */ new Map();
      for (const row of result.rows) {
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
            active: row.price_active
          });
        }
      }
      res.json({ products: Array.from(productsMap.values()) });
    } catch (error) {
      console.error("Get products with prices error:", error);
      res.status(500).json({ error: "Failed to get products" });
    }
  });
  app2.post("/api/stripe/create-payment-intent", requireAuth, async (req, res) => {
    try {
      const { amount, currency = "usd", customerId } = req.body;
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
  app2.post("/api/stripe/create-customer", requireAuth, async (req, res) => {
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
  app2.post("/api/stripe/create-checkout-session", requireAuth, async (req, res) => {
    try {
      const { customerId, priceId, successUrl, cancelUrl } = req.body;
      if (!customerId || !priceId) {
        return res.status(400).json({ error: "customerId and priceId are required" });
      }
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        successUrl || `${req.protocol}://${req.get("host")}/checkout/success`,
        cancelUrl || `${req.protocol}://${req.get("host")}/checkout/cancel`
      );
      res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      console.error("Create checkout session error:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });
  app2.post("/api/stripe/customer-portal", requireAuth, async (req, res) => {
    try {
      const { customerId, returnUrl } = req.body;
      if (!customerId) {
        return res.status(400).json({ error: "customerId is required" });
      }
      const session = await stripeService.createCustomerPortalSession(
        customerId,
        returnUrl || `${req.protocol}://${req.get("host")}/`
      );
      res.json({ url: session.url });
    } catch (error) {
      console.error("Create customer portal error:", error);
      res.status(500).json({ error: "Failed to create customer portal session" });
    }
  });
  app2.post("/api/stripe/connect/onboard/:providerId", requireAuth, async (req, res) => {
    try {
      const { providerId } = req.params;
      const result = await createConnectAccountLink(providerId);
      res.json(result);
    } catch (error) {
      console.error("Create connect onboarding error:", error);
      res.status(500).json({ error: error.message || "Failed to start Stripe onboarding" });
    }
  });
  app2.post("/api/stripe/connect/refresh-link/:providerId", requireAuth, async (req, res) => {
    try {
      const { providerId } = req.params;
      const result = await refreshConnectAccountLink(providerId);
      res.json(result);
    } catch (error) {
      console.error("Refresh connect link error:", error);
      res.status(500).json({ error: error.message || "Failed to refresh onboarding link" });
    }
  });
  app2.get("/api/stripe/connect/status/:providerId", async (req, res) => {
    try {
      const { providerId } = req.params;
      const result = await getConnectStatus(providerId);
      res.json(result);
    } catch (error) {
      console.error("Get connect status error:", error);
      res.status(500).json({ error: error.message || "Failed to get connect status" });
    }
  });
  app2.get("/api/stripe/fee-preview", async (req, res) => {
    try {
      const { providerId, amountCents } = req.query;
      if (!providerId || amountCents === void 0) {
        return res.status(400).json({ error: "providerId and amountCents are required" });
      }
      const preview = await calculateFeePreview(providerId, parseInt(amountCents, 10));
      res.json(preview);
    } catch (error) {
      console.error("Fee preview error:", error);
      res.status(500).json({ error: error.message || "Failed to calculate fee preview" });
    }
  });
  app2.post("/api/stripe/invoices", requireAuth, async (req, res) => {
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
        notes
      } = req.body;
      if (!providerId) {
        return res.status(400).json({ error: "providerId is required" });
      }
      let subtotalCents = 0;
      const parsedLineItems = Array.isArray(lineItemsInput) ? lineItemsInput : [];
      for (const item of parsedLineItems) {
        const qty = parseFloat(item.quantity || "1");
        const unitPrice = parseInt(item.unitPriceCents || "0", 10);
        subtotalCents += Math.round(qty * unitPrice);
      }
      const plan = await getProviderPlan(providerId);
      const fee = calculatePlatformFee(
        subtotalCents,
        plan.platformFeePercent || "10.00",
        plan.platformFeeFixedCents || 0
      );
      const totalBeforeTax = subtotalCents - (discountCents || 0);
      const totalCents = totalBeforeTax + (taxCents || 0);
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
      const [invoice] = await db.insert(invoices).values({
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
        paymentMethodsAllowed: "stripe,credits"
      }).returning();
      if (parsedLineItems.length > 0) {
        await db.insert(invoiceLineItems).values(
          parsedLineItems.map((item) => ({
            invoiceId: invoice.id,
            name: item.description || item.name || "Service",
            description: item.description || null,
            quantity: String(item.quantity || "1"),
            unitPriceCents: parseInt(item.unitPriceCents || "0", 10),
            amountCents: Math.round(
              parseFloat(item.quantity || "1") * parseInt(item.unitPriceCents || "0", 10)
            )
          }))
        );
      }
      res.status(201).json({
        invoice,
        platformFee: fee
      });
    } catch (error) {
      console.error("Create invoice error:", error);
      res.status(500).json({ error: error.message || "Failed to create invoice" });
    }
  });
  app2.get("/api/stripe/invoices", requireAuth, async (req, res) => {
    try {
      const { providerId } = req.query;
      if (!providerId) {
        return res.status(400).json({ error: "providerId is required" });
      }
      const providerInvoices = await db.select().from(invoices).where(eq4(invoices.providerId, providerId)).orderBy(invoices.createdAt);
      res.json({ invoices: providerInvoices });
    } catch (error) {
      console.error("Get invoices error:", error);
      res.status(500).json({ error: error.message || "Failed to get invoices" });
    }
  });
  app2.post("/api/stripe/invoices/:invoiceId/send", requireAuth, async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const [updated] = await db.update(invoices).set({
        status: "sent",
        sentAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(invoices.id, invoiceId)).returning();
      res.json({ invoice: updated });
    } catch (error) {
      console.error("Send invoice error:", error);
      res.status(500).json({ error: error.message || "Failed to send invoice" });
    }
  });
  app2.post("/api/stripe/invoices/:invoiceId/checkout", requireAuth, async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const [inv] = await db.select({ providerId: invoices.providerId }).from(invoices).where(eq4(invoices.id, invoiceId));
      if (inv) {
        const [connectAcct] = await db.select({ chargesEnabled: stripeConnectAccounts.chargesEnabled }).from(stripeConnectAccounts).where(eq4(stripeConnectAccounts.providerId, inv.providerId));
        if (!connectAcct || !connectAcct.chargesEnabled) {
          return res.status(402).json({ error: "stripe_not_ready", message: "Provider has not completed Stripe onboarding" });
        }
      }
      const result = await createStripeCheckoutSession(invoiceId);
      res.json({ url: result.checkoutUrl, sessionId: result.sessionId });
    } catch (error) {
      console.error("Create checkout session error:", error);
      if (error.code === "stripe_not_ready" || error.message === "stripe_not_ready") {
        return res.status(402).json({ error: "stripe_not_ready", message: "Provider has not completed Stripe onboarding" });
      }
      res.status(500).json({ error: error.message || "Failed to create checkout session" });
    }
  });
  app2.post("/api/stripe/invoices/:invoiceId/apply-credits", requireAuth, async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const { userId, amountCents } = req.body;
      if (!userId || amountCents === void 0) {
        return res.status(400).json({ error: "userId and amountCents are required" });
      }
      const result = await applyCreditsToInvoice(invoiceId, userId, amountCents);
      res.json(result);
    } catch (error) {
      console.error("Apply credits error:", error);
      res.status(500).json({ error: error.message || "Failed to apply credits" });
    }
  });
  app2.post("/api/connect/account-link", requireAuth, async (req, res) => {
    try {
      const { providerId } = req.body;
      if (!providerId) {
        return res.status(400).json({ error: "providerId is required" });
      }
      const result = await createConnectAccountLink(providerId);
      res.json(result);
    } catch (error) {
      console.error("Create connect account link error:", error);
      res.status(500).json({ error: error.message || "Failed to create connect account link" });
    }
  });
  app2.post("/api/connect/refresh-link", requireAuth, async (req, res) => {
    try {
      const { providerId } = req.body;
      if (!providerId) {
        return res.status(400).json({ error: "providerId is required" });
      }
      const result = await refreshConnectAccountLink(providerId);
      res.json(result);
    } catch (error) {
      console.error("Refresh connect account link error:", error);
      res.status(500).json({ error: error.message || "Failed to refresh connect account link" });
    }
  });
  app2.get("/api/connect/status/:providerId", async (req, res) => {
    try {
      const { providerId } = req.params;
      const result = await getConnectStatus(providerId);
      res.json(result);
    } catch (error) {
      console.error("Get connect status error:", error);
      res.status(500).json({ error: error.message || "Failed to get connect status" });
    }
  });
  app2.post("/api/providers/:providerId/plan", requireAuth, async (req, res) => {
    try {
      const { providerId } = req.params;
      const { planTier, platformFeePercent, platformFeeFixedCents } = req.body;
      const [existing] = await db.select().from(providerPlans).where(eq4(providerPlans.providerId, providerId));
      if (existing) {
        const [updated] = await db.update(providerPlans).set({
          planTier: planTier || existing.planTier,
          platformFeePercent: platformFeePercent || existing.platformFeePercent,
          platformFeeFixedCents: platformFeeFixedCents ?? existing.platformFeeFixedCents,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq4(providerPlans.id, existing.id)).returning();
        res.json({ plan: updated });
      } else {
        const [created] = await db.insert(providerPlans).values({
          providerId,
          planTier: planTier || "free",
          platformFeePercent: platformFeePercent || "10.00",
          platformFeeFixedCents: platformFeeFixedCents || 0
        }).returning();
        res.status(201).json({ plan: created });
      }
    } catch (error) {
      console.error("Update provider plan error:", error);
      res.status(500).json({ error: error.message || "Failed to update provider plan" });
    }
  });
  app2.get("/api/providers/:providerId/plan", requireAuth, async (req, res) => {
    try {
      const { providerId } = req.params;
      const plan = await getProviderPlan(providerId);
      res.json({ plan });
    } catch (error) {
      console.error("Get provider plan error:", error);
      res.status(500).json({ error: error.message || "Failed to get provider plan" });
    }
  });
  app2.post("/api/connect/fee-preview", requireAuth, async (req, res) => {
    try {
      const { providerId, totalCents } = req.body;
      if (!providerId || totalCents === void 0) {
        return res.status(400).json({ error: "providerId and totalCents are required" });
      }
      const preview = await calculateFeePreview(providerId, totalCents);
      res.json(preview);
    } catch (error) {
      console.error("Fee preview error:", error);
      res.status(500).json({ error: error.message || "Failed to calculate fee preview" });
    }
  });
  app2.post("/api/invoices/create", requireAuth, async (req, res) => {
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
        paymentMethodsAllowed
      } = req.body;
      if (!providerId) {
        return res.status(400).json({ error: "providerId is required" });
      }
      let subtotalCents = 0;
      const parsedLineItems = Array.isArray(lineItemsInput) ? lineItemsInput : [];
      for (const item of parsedLineItems) {
        const qty = parseFloat(item.quantity || "1");
        const unitPrice = parseInt(item.unitPriceCents || "0", 10);
        subtotalCents += Math.round(qty * unitPrice);
      }
      const plan = await getProviderPlan(providerId);
      const fee = calculatePlatformFee(
        subtotalCents,
        plan.platformFeePercent || "10.00",
        plan.platformFeeFixedCents || 0
      );
      const totalBeforeTax = subtotalCents - (discountCents || 0);
      const totalCents = totalBeforeTax + (taxCents || 0);
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
      const [invoice] = await db.insert(invoices).values({
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
        paymentMethodsAllowed: paymentMethodsAllowed || "stripe,credits"
      }).returning();
      if (parsedLineItems.length > 0) {
        await db.insert(invoiceLineItems).values(
          parsedLineItems.map((item) => ({
            invoiceId: invoice.id,
            name: item.name,
            description: item.description || null,
            quantity: item.quantity || "1",
            unitPriceCents: parseInt(item.unitPriceCents || "0", 10),
            amountCents: Math.round(
              parseFloat(item.quantity || "1") * parseInt(item.unitPriceCents || "0", 10)
            ),
            metadata: item.metadata ? JSON.stringify(item.metadata) : null
          }))
        );
      }
      const createdLineItems = await db.select().from(invoiceLineItems).where(eq4(invoiceLineItems.invoiceId, invoice.id));
      res.status(201).json({
        invoice,
        lineItems: createdLineItems,
        platformFee: fee
      });
    } catch (error) {
      console.error("Create invoice error:", error);
      res.status(500).json({ error: error.message || "Failed to create invoice" });
    }
  });
  app2.post("/api/invoices/:invoiceId/send", requireAuth, async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const { deliveryMethod, generatePaymentLink } = req.body;
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      if (!invoice.clientId) {
        return res.status(400).json({ error: "Invoice has no client" });
      }
      const client = await storage.getClient(invoice.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      const provider = await storage.getProvider(invoice.providerId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }
      let hostedUrl = null;
      if (generatePaymentLink) {
        const checkoutResult = await createStripeCheckoutSession(invoiceId);
        hostedUrl = checkoutResult.checkoutUrl;
      }
      let emailSent = false;
      let emailError;
      if (client.email && (deliveryMethod === "email" || deliveryMethod === "both")) {
        const rawLineItems = invoice.lineItems;
        const lineItems = Array.isArray(rawLineItems) ? rawLineItems : typeof rawLineItems === "string" ? JSON.parse(rawLineItems) : [];
        const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ") || "Client";
        const sendResult = await dispatchWithResult("invoice.sent", {
          clientEmail: client.email,
          clientName,
          providerName: provider.businessName || provider.userId || "Service Provider",
          invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`,
          amount: parseFloat(invoice.total?.toString() || "0"),
          dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "Due on receipt",
          lineItems: lineItems.map((item) => ({
            description: item.description || item.name || "Service",
            quantity: item.quantity || 1,
            unitPrice: parseFloat(item.unitPrice?.toString() || item.price?.toString() || "0"),
            total: parseFloat(item.total?.toString() || "0")
          })),
          paymentLink: hostedUrl || void 0,
          relatedRecordType: "invoice",
          relatedRecordId: invoice.id
        });
        emailSent = sendResult.emailSent;
        emailError = sendResult.emailError;
      }
      const [updated] = await db.update(invoices).set({
        status: "sent",
        sentAt: /* @__PURE__ */ new Date(),
        hostedInvoiceUrl: hostedUrl || void 0,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(invoices.id, invoiceId)).returning();
      res.json({
        invoice: updated,
        paymentUrl: hostedUrl,
        deliveryMethod: deliveryMethod || "link",
        emailSent,
        emailError
      });
    } catch (error) {
      console.error("Send invoice error:", error);
      res.status(500).json({ error: error.message || "Failed to send invoice" });
    }
  });
  app2.post("/api/invoices/:invoiceId/payment-intent", requireAuth, async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const { payerUserId } = req.body;
      const result = await createInvoicePaymentIntent(invoiceId, payerUserId);
      res.json(result);
    } catch (error) {
      console.error("Create payment intent error:", error);
      res.status(500).json({ error: error.message || "Failed to create payment intent" });
    }
  });
  app2.post("/api/invoices/:invoiceId/checkout", requireAuth, async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const [inv] = await db.select({ providerId: invoices.providerId }).from(invoices).where(eq4(invoices.id, invoiceId));
      if (inv) {
        const [connectAcct] = await db.select({ chargesEnabled: stripeConnectAccounts.chargesEnabled }).from(stripeConnectAccounts).where(eq4(stripeConnectAccounts.providerId, inv.providerId));
        if (!connectAcct || !connectAcct.chargesEnabled) {
          return res.status(402).json({ error: "stripe_not_ready", message: "Provider has not completed Stripe onboarding" });
        }
      }
      const result = await createStripeCheckoutSession(invoiceId);
      res.json(result);
    } catch (error) {
      console.error("Create checkout session error:", error);
      if (error.code === "stripe_not_ready" || error.message === "stripe_not_ready") {
        return res.status(402).json({ error: "stripe_not_ready", message: "Provider has not completed Stripe onboarding" });
      }
      res.status(500).json({ error: error.message || "Failed to create checkout session" });
    }
  });
  app2.post("/api/invoices/:invoiceId/apply-credits", requireAuth, async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const { userId, amountCents } = req.body;
      if (!userId || !amountCents) {
        return res.status(400).json({ error: "userId and amountCents are required" });
      }
      const result = await applyCreditsToInvoice(invoiceId, userId, amountCents);
      res.json(result);
    } catch (error) {
      console.error("Apply credits error:", error);
      res.status(500).json({ error: error.message || "Failed to apply credits" });
    }
  });
  app2.get("/api/users/:userId/credits", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      if (userId !== req.authenticatedUserId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const [credits] = await db.select().from(userCredits).where(eq4(userCredits.userId, userId));
      res.json({
        balanceCents: credits?.balanceCents || 0,
        balance: ((credits?.balanceCents || 0) / 100).toFixed(2)
      });
    } catch (error) {
      console.error("Get user credits error:", error);
      res.status(500).json({ error: error.message || "Failed to get user credits" });
    }
  });
  app2.post("/api/users/:userId/credits/add", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      if (userId !== req.authenticatedUserId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { amountCents, reason } = req.body;
      if (!amountCents || amountCents <= 0) {
        return res.status(400).json({ error: "amountCents must be a positive number" });
      }
      const [existing] = await db.select().from(userCredits).where(eq4(userCredits.userId, userId));
      let newBalance;
      if (existing) {
        newBalance = (existing.balanceCents || 0) + amountCents;
        await db.update(userCredits).set({ balanceCents: newBalance, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(userCredits.userId, userId));
      } else {
        newBalance = amountCents;
        await db.insert(userCredits).values({
          userId,
          balanceCents: newBalance
        });
      }
      await db.insert(creditLedger).values({
        userId,
        deltaCents: amountCents,
        reason: reason || "revenuecat_purchase"
      });
      res.json({
        balanceCents: newBalance,
        balance: (newBalance / 100).toFixed(2)
      });
    } catch (error) {
      console.error("Add credits error:", error);
      res.status(500).json({ error: error.message || "Failed to add credits" });
    }
  });
  app2.post("/api/webhooks/stripe-connect", async (req, res) => {
    try {
      const sig = req.headers["stripe-signature"];
      const endpointSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
      let event;
      if (endpointSecret && sig) {
        try {
          event = getStripe().webhooks.constructEvent(
            req.body,
            sig,
            endpointSecret
          );
        } catch (err) {
          console.error("Webhook signature verification failed:", err.message);
          return res.status(400).json({ error: `Webhook Error: ${err.message}` });
        }
      } else {
        event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      }
      const result = await handleStripeWebhook(event);
      res.json(result);
    } catch (error) {
      console.error("Stripe webhook error:", error);
      res.status(500).json({ error: error.message || "Webhook processing failed" });
    }
  });
  app2.get("/api/providers/:providerId/payouts", requireAuth, async (req, res) => {
    try {
      const { providerId } = req.params;
      const providerPayouts = await db.select().from(payouts).where(eq4(payouts.providerId, providerId));
      res.json({ payouts: providerPayouts });
    } catch (error) {
      console.error("Get payouts error:", error);
      res.status(500).json({ error: error.message || "Failed to get payouts" });
    }
  });
  async function assertProviderOwnership(req, providerId, res) {
    const authUserId = req.authenticatedUserId;
    const [provider] = await db.select({ userId: providers.userId }).from(providers).where(eq4(providers.id, providerId));
    if (!provider || provider.userId !== authUserId) {
      res.status(403).json({ error: "Forbidden" });
      return false;
    }
    return true;
  }
  app2.get("/api/providers/:providerId/stripe-payouts", requireAuth, async (req, res) => {
    try {
      const { providerId } = req.params;
      if (!await assertProviderOwnership(req, providerId, res)) return;
      const connectAccount = await getConnectAccount(providerId);
      if (!connectAccount?.stripeAccountId) {
        return res.status(404).json({ error: "stripe_not_connected" });
      }
      const stripe2 = getStripe();
      const stripePayouts = await stripe2.payouts.list(
        { limit: 50, expand: ["data.destination"] },
        { stripeAccount: connectAccount.stripeAccountId }
      );
      const result = stripePayouts.data.map((p) => {
        const dest = p.destination;
        let bankLast4 = null;
        if (dest && typeof dest === "object" && "last4" in dest) {
          bankLast4 = dest.last4 ?? null;
        }
        return {
          id: p.id,
          amountCents: p.amount,
          currency: p.currency,
          status: p.status,
          arrivalDate: p.arrival_date ? new Date(p.arrival_date * 1e3).toISOString() : null,
          description: p.description,
          createdAt: new Date(p.created * 1e3).toISOString(),
          bankLast4
        };
      });
      res.json({ payouts: result });
    } catch (error) {
      console.error("Stripe payouts error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Stripe payouts" });
    }
  });
  app2.get("/api/providers/:providerId/stripe-payments", requireAuth, async (req, res) => {
    try {
      const { providerId } = req.params;
      if (!await assertProviderOwnership(req, providerId, res)) return;
      const connectAccount = await getConnectAccount(providerId);
      if (!connectAccount?.stripeAccountId) {
        return res.status(404).json({ error: "stripe_not_connected" });
      }
      const stripe2 = getStripe();
      const charges = await stripe2.charges.list(
        { limit: 50 },
        { stripeAccount: connectAccount.stripeAccountId }
      );
      const localPayments = await db.select({
        stripeChargeId: payments.stripeChargeId,
        stripePaymentIntentId: payments.stripePaymentIntentId,
        invoiceId: payments.invoiceId
      }).from(payments).where(eq4(payments.providerId, providerId));
      const localInvoices = await db.select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        clientId: invoices.clientId
      }).from(invoices).where(eq4(invoices.providerId, providerId));
      const localClients = await db.select({ id: clients.id, firstName: clients.firstName, lastName: clients.lastName }).from(clients).where(eq4(clients.providerId, providerId));
      const result = charges.data.filter(
        (charge) => localPayments.some(
          (p) => p.stripeChargeId === charge.id || p.stripePaymentIntentId === charge.payment_intent?.toString()
        )
      ).map((charge) => {
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
          clientName: client ? `${client.firstName} ${client.lastName}` : charge.billing_details?.name ?? null,
          createdAt: new Date(charge.created * 1e3).toISOString(),
          refunded: charge.refunded
        };
      });
      res.json({ payments: result });
    } catch (error) {
      console.error("Stripe payments error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Stripe payments" });
    }
  });
  app2.get("/api/providers/:providerId/stripe-refunds", requireAuth, async (req, res) => {
    try {
      const { providerId } = req.params;
      if (!await assertProviderOwnership(req, providerId, res)) return;
      const connectAccount = await getConnectAccount(providerId);
      if (!connectAccount?.stripeAccountId) {
        return res.status(404).json({ error: "stripe_not_connected" });
      }
      const stripe2 = getStripe();
      const stripeRefunds = await stripe2.refunds.list(
        { limit: 50, expand: ["data.charge"] },
        { stripeAccount: connectAccount.stripeAccountId }
      );
      const result = stripeRefunds.data.map((r) => {
        const expandedCharge = r.charge && typeof r.charge === "object" ? r.charge : null;
        return {
          refundId: r.id,
          chargeId: expandedCharge?.id ?? (r.charge?.toString() ?? null),
          amountCents: r.amount,
          originalAmountCents: expandedCharge?.amount ?? null,
          currency: r.currency,
          reason: r.reason,
          status: r.status,
          createdAt: new Date(r.created * 1e3).toISOString()
        };
      });
      res.json({ refunds: result });
    } catch (error) {
      console.error("Stripe refunds error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Stripe refunds" });
    }
  });
  app2.get("/api/providers/:providerId/booking-links", requireAuth, async (req, res) => {
    try {
      const { providerId } = req.params;
      const links = await storage.getBookingLinksByProvider(providerId);
      res.json({ bookingLinks: links });
    } catch (error) {
      console.error("Get booking links error:", error);
      res.status(500).json({ error: error.message || "Failed to get booking links" });
    }
  });
  app2.post("/api/providers/:providerId/booking-links", requireAuth, async (req, res) => {
    try {
      const { providerId } = req.params;
      const { slug, customTitle, customDescription, welcomeMessage, confirmationMessage, instantBooking, showPricing, depositRequired, depositAmount, depositPercentage, intakeQuestions, serviceCatalog, availabilityRules, brandColor, logoUrl } = req.body;
      if (!slug) {
        return res.status(400).json({ error: "slug is required" });
      }
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
        showPricing: showPricing !== void 0 ? showPricing : true,
        depositRequired: depositRequired || false,
        depositAmount,
        depositPercentage,
        intakeQuestions: intakeQuestions ? JSON.stringify(intakeQuestions) : null,
        serviceCatalog: serviceCatalog ? JSON.stringify(serviceCatalog) : null,
        availabilityRules: availabilityRules ? JSON.stringify(availabilityRules) : null,
        brandColor,
        logoUrl
      });
      res.status(201).json({ bookingLink: link });
    } catch (error) {
      console.error("Create booking link error:", error);
      res.status(500).json({ error: error.message || "Failed to create booking link" });
    }
  });
  app2.get("/api/book/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const link = await storage.getBookingLinkBySlug(slug);
      if (!link || link.status !== "active") {
        return res.status(404).json({ error: "Booking page not found" });
      }
      const provider = await storage.getProvider(link.providerId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }
      res.json({
        bookingLink: {
          ...link,
          intakeQuestions: link.intakeQuestions ? JSON.parse(link.intakeQuestions) : [],
          serviceCatalog: link.serviceCatalog ? JSON.parse(link.serviceCatalog) : [],
          availabilityRules: link.availabilityRules ? JSON.parse(link.availabilityRules) : null
        },
        provider: {
          id: provider.id,
          businessName: provider.businessName,
          avatarUrl: provider.avatarUrl,
          rating: provider.rating,
          reviewCount: provider.reviewCount,
          capabilityTags: provider.capabilityTags
        }
      });
    } catch (error) {
      console.error("Get booking link error:", error);
      res.status(500).json({ error: error.message || "Failed to get booking page" });
    }
  });
  app2.put("/api/booking-links/:id", requireAuth, async (req, res) => {
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
    } catch (error) {
      console.error("Update booking link error:", error);
      res.status(500).json({ error: error.message || "Failed to update booking link" });
    }
  });
  app2.delete("/api/booking-links/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteBookingLink(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete booking link error:", error);
      res.status(500).json({ error: error.message || "Failed to delete booking link" });
    }
  });
  app2.post("/api/book/:slug/submit", async (req, res) => {
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
        preferredTimesJson: preferredTimesJson ? JSON.stringify(preferredTimesJson) : null
      });
      try {
        const existingLeads = clientEmail ? await db.select().from(leads).where(and4(
          eq4(leads.providerId, link.providerId),
          eq4(leads.email, clientEmail)
        )).limit(1) : [];
        if (existingLeads.length === 0) {
          await db.insert(leads).values({
            providerId: link.providerId,
            name: clientName,
            email: clientEmail || null,
            phone: clientPhone || null,
            service: null,
            message: problemDescription || null,
            status: "new",
            source: "booking_page"
          });
        }
      } catch (leadErr) {
        console.error("Lead auto-create error (non-fatal):", leadErr);
      }
      res.status(201).json({ submission, message: "Your request has been submitted!" });
    } catch (error) {
      console.error("Submit intake error:", error);
      res.status(500).json({ error: error.message || "Failed to submit request" });
    }
  });
  app2.get("/api/booking/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const [link] = await db.select().from(bookingLinks).where(eq4(bookingLinks.slug, slug)).limit(1);
      if (!link || link.isActive === false || link.status !== "active") {
        return res.status(404).json({ error: "Booking page not found" });
      }
      const [provider] = await db.select().from(providers).where(eq4(providers.id, link.providerId)).limit(1);
      if (!provider || provider.isPublic === false) {
        return res.status(404).json({ error: "Provider not found" });
      }
      const customServices = await db.select().from(providerCustomServices).where(
        and4(
          eq4(providerCustomServices.providerId, provider.id),
          eq4(providerCustomServices.isPublished, true)
        )
      );
      const catalogServices = await db.select({
        id: services.id,
        name: services.name,
        description: services.description,
        basePrice: services.basePrice,
        categoryId: services.categoryId,
        price: providerServices.price,
        providerServiceId: providerServices.id
      }).from(providerServices).innerJoin(services, eq4(providerServices.serviceId, services.id)).where(
        and4(
          eq4(providerServices.providerId, provider.id),
          eq4(services.isPublic, true)
        )
      );
      const recentReviews = await db.select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt
      }).from(reviews).where(eq4(reviews.providerId, provider.id)).orderBy(desc2(reviews.createdAt)).limit(5);
      res.json({
        provider: {
          id: provider.id,
          businessName: provider.businessName,
          description: provider.description,
          avatarUrl: provider.avatarUrl,
          serviceArea: provider.serviceArea,
          businessHours: provider.businessHours ? (() => {
            try {
              return JSON.parse(provider.businessHours);
            } catch {
              return provider.businessHours;
            }
          })() : null,
          bookingPolicies: provider.bookingPolicies,
          averageRating: provider.averageRating ?? provider.rating,
          reviewCount: provider.reviewCount
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
          intakeQuestions: link.intakeQuestions ? (() => {
            try {
              return JSON.parse(link.intakeQuestions);
            } catch {
              return [];
            }
          })() : []
        },
        services: {
          custom: customServices,
          catalog: catalogServices
        },
        reviews: recentReviews
      });
    } catch (error) {
      console.error("Get public booking page error:", error);
      res.status(500).json({ error: error.message || "Failed to get booking page" });
    }
  });
  app2.post("/api/booking/:slug", async (req, res) => {
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
        answersJson
      } = req.body;
      if (!clientName || !problemDescription) {
        return res.status(400).json({ error: "clientName and problemDescription are required" });
      }
      const [link] = await db.select().from(bookingLinks).where(eq4(bookingLinks.slug, slug)).limit(1);
      if (!link || link.isActive === false || link.status !== "active") {
        return res.status(404).json({ error: "Booking page not found" });
      }
      let submission;
      let instantClientId;
      let instantJob;
      if (link.instantBooking) {
        const txResult = await db.transaction(async (tx) => {
          const [sub] = await tx.insert(intakeSubmissions).values({
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
            status: "confirmed"
          }).returning();
          const preferredDate = preferredTimesJson?.[0] ? new Date(preferredTimesJson[0]) : void 0;
          const converted = await convertIntakeToClientJob(tx, {
            submissionId: sub.id,
            providerId: link.providerId,
            clientName,
            clientEmail,
            clientPhone,
            address,
            problemDescription,
            scheduledDate: preferredDate,
            targetStatus: "confirmed"
          });
          return { sub, clientId: converted.clientId, job: converted.job };
        });
        submission = txResult.sub;
        instantClientId = txResult.clientId;
        instantJob = txResult.job;
      } else {
        const [sub] = await db.insert(intakeSubmissions).values({
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
          status: "submitted"
        }).returning();
        submission = sub;
      }
      try {
        const [providerRow] = await db.select({ userId: providers.userId, businessName: providers.businessName, email: providers.email }).from(providers).where(eq4(providers.id, link.providerId)).limit(1);
        if (providerRow?.userId) {
          const notificationTitle = link.instantBooking ? "New Booking Confirmed" : "New Booking Request";
          const notificationMessage = link.instantBooking ? `${clientName} has booked an appointment. Check your intake submissions for details.` : `${clientName} submitted a new booking request. Review it in your intake submissions.`;
          await db.insert(notifications).values({
            userId: providerRow.userId,
            title: notificationTitle,
            message: notificationMessage,
            type: "booking_request",
            isRead: false,
            data: JSON.stringify({ intakeSubmissionId: submission.id, clientName })
          });
          if (link.instantBooking && clientEmail) {
            const preferredDateStr = preferredTimesJson?.[0] ? new Date(preferredTimesJson[0]).toLocaleDateString() : "To be confirmed";
            dispatch("booking.created", {
              clientEmail,
              clientName,
              providerEmail: providerRow.email ?? void 0,
              providerName: providerRow.businessName ?? link.title ?? "Your Provider",
              serviceName: link.title ?? "Home Service",
              appointmentDate: preferredDateStr,
              appointmentTime: preferredTimesJson?.[0] ? new Date(preferredTimesJson[0]).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : void 0,
              confirmationNumber: submission.id,
              relatedRecordType: "intake_submission",
              relatedRecordId: submission.id
            }).catch((e) => console.error("Instant booking email dispatch error:", e));
          }
        }
      } catch (notifyErr) {
        console.error("Notification create error (non-fatal):", notifyErr);
      }
      res.status(201).json({
        submission,
        ...instantClientId ? { clientId: instantClientId } : {},
        ...instantJob ? { job: instantJob } : {},
        message: link.instantBooking ? "Your booking has been confirmed!" : "Your request has been submitted!"
      });
    } catch (error) {
      console.error("Public booking submission error:", error);
      res.status(500).json({ error: error.message || "Failed to submit booking request" });
    }
  });
  app2.get("/api/providers/:providerId/intake-submissions", requireAuth, async (req, res) => {
    try {
      const { providerId } = req.params;
      const authUserId = req.authenticatedUserId;
      const [providerRow] = await db.select({ userId: providers.userId }).from(providers).where(eq4(providers.id, providerId)).limit(1);
      if (!providerRow || providerRow.userId !== authUserId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const submissions = await storage.getIntakeSubmissionsByProvider(providerId);
      res.json({ submissions });
    } catch (error) {
      console.error("Get intake submissions error:", error);
      res.status(500).json({ error: error.message || "Failed to get intake submissions" });
    }
  });
  app2.put("/api/intake-submissions/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const authUserId = req.authenticatedUserId;
      const existing = await storage.getIntakeSubmission(id);
      if (!existing) {
        return res.status(404).json({ error: "Submission not found" });
      }
      const [providerRow] = await db.select({ userId: providers.userId }).from(providers).where(eq4(providers.id, existing.providerId)).limit(1);
      if (!providerRow || providerRow.userId !== authUserId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const submission = await storage.updateIntakeSubmission(id, updates);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      res.json({ submission });
    } catch (error) {
      console.error("Update intake submission error:", error);
      res.status(500).json({ error: error.message || "Failed to update submission" });
    }
  });
  app2.post("/api/intake-submissions/:id/accept", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { scheduledDate, scheduledTime, estimatedPrice, notes } = req.body;
      const authUserId = req.authenticatedUserId;
      const submission = await storage.getIntakeSubmission(id);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      const [providerOwner] = await db.select({ userId: providers.userId }).from(providers).where(eq4(providers.id, submission.providerId));
      if (!providerOwner || providerOwner.userId !== authUserId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (submission.status === "converted" || submission.status === "confirmed") {
        return res.status(400).json({ error: "Submission has already been accepted" });
      }
      let resolvedScheduledDate;
      if (scheduledDate) {
        const parsed = new Date(scheduledDate);
        if (!isNaN(parsed.getTime())) resolvedScheduledDate = parsed;
      }
      if (!resolvedScheduledDate && submission.preferredTimesJson) {
        try {
          const preferred = JSON.parse(submission.preferredTimesJson);
          if (preferred.length > 0) {
            const parsed = new Date(preferred[0]);
            if (!isNaN(parsed.getTime())) resolvedScheduledDate = parsed;
          }
        } catch {
        }
      }
      const result = await db.transaction(async (tx) => {
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
          targetStatus: "converted"
        });
        if (submission.clientEmail) {
          const now = /* @__PURE__ */ new Date();
          await tx.update(leads).set({ status: "won", updatedAt: now }).where(
            and4(
              eq4(leads.providerId, submission.providerId),
              eq4(leads.email, submission.clientEmail)
            )
          );
        }
        return converted;
      });
      res.status(201).json({
        message: "Booking accepted",
        clientId: result.clientId,
        job: result.job
      });
    } catch (error) {
      console.error("Accept intake submission error:", error);
      res.status(500).json({ error: error.message || "Failed to accept submission" });
    }
  });
  app2.get("/api/providers/:providerId/leads", requireAuth, async (req, res) => {
    try {
      const { providerId } = req.params;
      const rows = await db.select().from(leads).where(eq4(leads.providerId, providerId)).orderBy(desc2(leads.createdAt));
      res.json({ leads: rows });
    } catch (error) {
      console.error("Get leads error:", error);
      res.status(500).json({ error: error.message || "Failed to get leads" });
    }
  });
  app2.post("/api/providers/:providerId/leads", requireAuth, async (req, res) => {
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
        source: source || "manual"
      }).returning();
      res.status(201).json({ lead });
    } catch (error) {
      console.error("Create lead error:", error);
      res.status(500).json({ error: error.message || "Failed to create lead" });
    }
  });
  app2.patch("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = {};
      const allowed = ["name", "email", "phone", "service", "message", "status", "source"];
      for (const key of allowed) {
        if (req.body[key] !== void 0) updates[key] = req.body[key];
      }
      updates.updatedAt = /* @__PURE__ */ new Date();
      const [lead] = await db.update(leads).set(updates).where(eq4(leads.id, id)).returning();
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      res.json({ lead });
    } catch (error) {
      console.error("Update lead error:", error);
      res.status(500).json({ error: error.message || "Failed to update lead" });
    }
  });
  app2.post("/api/leads/:id/accept", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { scheduledDate, scheduledTime, estimatedPrice, notes } = req.body;
      const authUserId = req.authenticatedUserId;
      const [lead] = await db.select().from(leads).where(eq4(leads.id, id)).limit(1);
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      const [providerRow] = await db.select({ userId: providers.userId }).from(providers).where(eq4(providers.id, lead.providerId)).limit(1);
      if (!providerRow || providerRow.userId !== authUserId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (lead.status === "won") {
        return res.status(400).json({ error: "Lead has already been accepted" });
      }
      const resolvedDate = scheduledDate ? new Date(scheduledDate) : /* @__PURE__ */ new Date();
      const result = await db.transaction(async (tx) => {
        const nameParts = (lead.name || "").trim().split(" ");
        const firstName = nameParts[0] || "Unknown";
        const lastName = nameParts.slice(1).join(" ") || null;
        let clientId;
        if (lead.email) {
          const [found] = await tx.select({ id: clients.id }).from(clients).where(and4(eq4(clients.providerId, lead.providerId), eq4(clients.email, lead.email)));
          if (found) {
            clientId = found.id;
          } else {
            const [newC] = await tx.insert(clients).values({ providerId: lead.providerId, firstName, lastName, email: lead.email, phone: lead.phone || null }).returning({ id: clients.id });
            clientId = newC.id;
          }
        } else {
          const [newC] = await tx.insert(clients).values({ providerId: lead.providerId, firstName, lastName, email: null, phone: lead.phone || null }).returning({ id: clients.id });
          clientId = newC.id;
        }
        const [newJob] = await tx.insert(jobs).values({
          providerId: lead.providerId,
          clientId,
          title: lead.service || lead.message?.slice(0, 100) || "Service Request",
          description: lead.message || null,
          scheduledDate: resolvedDate,
          scheduledTime: scheduledTime || null,
          status: "scheduled",
          estimatedPrice: estimatedPrice ? String(estimatedPrice) : null,
          notes: notes || null
        }).returning();
        const now = /* @__PURE__ */ new Date();
        await tx.update(leads).set({ status: "won", updatedAt: now }).where(eq4(leads.id, id));
        return { clientId, job: newJob };
      });
      res.status(201).json({ message: "Lead accepted", clientId: result.clientId, job: result.job });
    } catch (error) {
      console.error("Accept lead error:", error);
      res.status(500).json({ error: error.message || "Failed to accept lead" });
    }
  });
  app2.delete("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const [deleted] = await db.delete(leads).where(eq4(leads.id, id)).returning();
      if (!deleted) return res.status(404).json({ error: "Lead not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Delete lead error:", error);
      res.status(500).json({ error: error.message || "Failed to delete lead" });
    }
  });
  const messageLimitMap = /* @__PURE__ */ new Map();
  function checkMessageRateLimit(providerId, clientId) {
    const key = `${providerId}:${clientId}`;
    const now = Date.now();
    const window = 24 * 60 * 60 * 1e3;
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
  app2.post("/api/providers/:providerId/messages", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
      const { providerId } = req.params;
      const providerRecord = await storage.getProviderByUserId(authUserId);
      if (!providerRecord || providerRecord.id !== providerId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { clientId, channel, subject, body, jobId, invoiceId } = req.body;
      if (!clientId || !body) {
        return res.status(400).json({ error: "clientId and body are required" });
      }
      const [client] = await db.select().from(clients).where(
        and4(eq4(clients.id, clientId), eq4(clients.providerId, providerId))
      );
      if (!client) {
        return res.status(403).json({ error: "Client does not belong to this provider" });
      }
      if (!checkMessageRateLimit(providerId, clientId)) {
        return res.status(429).json({ error: "Rate limit exceeded: max 10 messages per client per 24 hours" });
      }
      const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ");
      let processedBody = body.replace(/\{\{client_name\}\}/g, clientName).replace(/\{\{provider_name\}\}/g, providerRecord.businessName);
      let processedSubject = (subject || `Message from ${providerRecord.businessName}`).replace(/\{\{client_name\}\}/g, clientName).replace(/\{\{provider_name\}\}/g, providerRecord.businessName);
      if (jobId) {
        const [jobRecord] = await db.select().from(jobs).where(eq4(jobs.id, jobId));
        if (jobRecord) {
          processedBody = processedBody.replace(/\{\{service\}\}/g, jobRecord.title || "").replace(/\{\{booking_date\}\}/g, jobRecord.scheduledDate ? new Date(jobRecord.scheduledDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");
          processedSubject = processedSubject.replace(/\{\{service\}\}/g, jobRecord.title || "").replace(/\{\{booking_date\}\}/g, jobRecord.scheduledDate ? new Date(jobRecord.scheduledDate).toLocaleDateString() : "");
        }
      }
      if (invoiceId) {
        const [invoiceRecord] = await db.select().from(invoices).where(eq4(invoices.id, invoiceId));
        if (invoiceRecord) {
          const amount = invoiceRecord.total || invoiceRecord.amount || "0";
          processedBody = processedBody.replace(/\{\{amount_due\}\}/g, `$${parseFloat(amount).toFixed(2)}`);
          processedSubject = processedSubject.replace(/\{\{amount_due\}\}/g, `$${parseFloat(amount).toFixed(2)}`);
        }
      }
      let status = "sent";
      let resendMessageId;
      if (channel === "email") {
        if (!client.email) {
          return res.status(400).json({ error: "Client does not have an email address" });
        }
        const emailResult = await sendProviderClientMessage({
          clientEmail: client.email,
          clientName,
          providerName: providerRecord.businessName,
          subject: processedSubject,
          body: processedBody
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
        resendMessageId: resendMessageId || null
      }).returning();
      res.status(201).json({ message });
    } catch (error) {
      console.error("Send provider message error:", error);
      res.status(500).json({ error: error.message || "Failed to send message" });
    }
  });
  app2.get("/api/providers/:providerId/clients/:clientId/messages", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
      const { providerId, clientId } = req.params;
      const providerRecord = await storage.getProviderByUserId(authUserId);
      if (!providerRecord || providerRecord.id !== providerId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const messages = await db.select().from(providerMessages).where(and4(eq4(providerMessages.providerId, providerId), eq4(providerMessages.clientId, clientId))).orderBy(desc2(providerMessages.createdAt));
      res.json({ messages });
    } catch (error) {
      console.error("Get provider messages error:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });
  app2.get("/api/providers/:providerId/message-templates", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
      const { providerId } = req.params;
      const providerRecord = await storage.getProviderByUserId(authUserId);
      if (!providerRecord || providerRecord.id !== providerId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const templates = await db.select().from(messageTemplates).where(eq4(messageTemplates.providerId, providerId)).orderBy(desc2(messageTemplates.createdAt));
      res.json({ templates });
    } catch (error) {
      console.error("Get message templates error:", error);
      res.status(500).json({ error: "Failed to get templates" });
    }
  });
  app2.post("/api/providers/:providerId/message-templates", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
      const { providerId } = req.params;
      const providerRecord = await storage.getProviderByUserId(authUserId);
      if (!providerRecord || providerRecord.id !== providerId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { name, channel, subject, body } = req.body;
      if (!name || !body) {
        return res.status(400).json({ error: "name and body are required" });
      }
      const [template] = await db.insert(messageTemplates).values({
        providerId,
        name,
        channel: channel || "email",
        subject: subject || null,
        body
      }).returning();
      res.status(201).json({ template });
    } catch (error) {
      console.error("Create message template error:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });
  app2.patch("/api/providers/:providerId/message-templates/:templateId", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
      const { providerId, templateId } = req.params;
      const providerRecord = await storage.getProviderByUserId(authUserId);
      if (!providerRecord || providerRecord.id !== providerId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { name, channel, subject, body } = req.body;
      const updates = { updatedAt: /* @__PURE__ */ new Date() };
      if (name !== void 0) updates.name = name;
      if (channel !== void 0) updates.channel = channel;
      if (subject !== void 0) updates.subject = subject;
      if (body !== void 0) updates.body = body;
      const [template] = await db.update(messageTemplates).set(updates).where(and4(eq4(messageTemplates.id, templateId), eq4(messageTemplates.providerId, providerId))).returning();
      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json({ template });
    } catch (error) {
      console.error("Update message template error:", error);
      res.status(500).json({ error: "Failed to update template" });
    }
  });
  app2.delete("/api/providers/:providerId/message-templates/:templateId", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
      const { providerId, templateId } = req.params;
      const providerRecord = await storage.getProviderByUserId(authUserId);
      if (!providerRecord || providerRecord.id !== providerId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const [deleted] = await db.delete(messageTemplates).where(and4(eq4(messageTemplates.id, templateId), eq4(messageTemplates.providerId, providerId))).returning();
      if (!deleted) return res.status(404).json({ error: "Template not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Delete message template error:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });
  app2.get("/api/providers/:providerId/clients/last-messages", requireAuth, async (req, res) => {
    try {
      const authUserId = req.authenticatedUserId;
      const { providerId } = req.params;
      const providerRecord = await storage.getProviderByUserId(authUserId);
      if (!providerRecord || providerRecord.id !== providerId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const lastMessages = await db.execute(sql3`
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
    } catch (error) {
      console.error("Get last messages error:", error);
      res.status(500).json({ error: "Failed to get last messages" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { runMigrations } from "stripe-replit-sync";

// server/webhookHandlers.ts
var WebhookHandlers = class {
  static async processWebhook(payload, signature) {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. Received type: " + typeof payload + ". This usually means express.json() parsed the body before reaching this handler. FIX: Ensure webhook route is registered BEFORE app.use(express.json())."
      );
    }
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }
};

// server/index.ts
init_schema();
import cron from "node-cron";
import { eq as eq6, and as and6, gte as gte2, lte as lte2, lt } from "drizzle-orm";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    origins.add("https://api.homebaseproapp.com");
    origins.add("https://homebaseproapp.com");
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupStripeWebhook(app2) {
  app2.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const signature = req.headers["stripe-signature"];
      if (!signature) {
        return res.status(400).json({ error: "Missing stripe-signature" });
      }
      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;
        if (!Buffer.isBuffer(req.body)) {
          console.error("STRIPE WEBHOOK ERROR: req.body is not a Buffer.");
          return res.status(500).json({ error: "Webhook processing error" });
        }
        await WebhookHandlers.processWebhook(req.body, sig);
        res.status(200).json({ received: true });
      } catch (error) {
        console.error("Webhook error:", error.message);
        res.status(400).json({ error: "Webhook processing error" });
      }
    }
  );
}
function setupBodyParsing(app2) {
  app2.use(cookieParser());
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
async function initStripe() {
  const databaseUrl2 = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl2) {
    console.log("DATABASE_URL not found, skipping Stripe initialization");
    return;
  }
  try {
    console.log("Initializing Stripe schema...");
    try {
      const client = await pool.connect();
      try {
        await client.query(`CREATE SCHEMA IF NOT EXISTS stripe;`);
        await client.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_type t
              JOIN pg_namespace n ON t.typnamespace = n.oid
              WHERE t.typname = 'invoice_status' AND n.nspname = 'stripe'
            ) THEN
              CREATE TYPE "stripe"."invoice_status" AS ENUM ('draft', 'open', 'paid', 'uncollectible', 'void');
            END IF;
          END$$;
        `);
      } finally {
        client.release();
      }
    } catch (preFixError) {
      console.log("Stripe pre-migration setup note:", preFixError.message?.slice(0, 100));
    }
    try {
      await runMigrations({ databaseUrl: databaseUrl2 });
      console.log("Stripe schema ready");
    } catch (migrationError) {
      console.log("Stripe migration skipped (may already exist or pending setup):", migrationError.message?.slice(0, 100));
    }
    try {
      const stripeSync2 = await getStripeSync();
      console.log("Setting up managed webhook...");
      const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
      const { webhook } = await stripeSync2.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`
      );
      console.log(`Webhook configured: ${webhook.url}`);
      console.log("Syncing Stripe data...");
      stripeSync2.syncBackfill().then(() => {
        console.log("Stripe data synced");
      }).catch((err) => {
        console.log("Stripe data sync skipped:", err.message?.slice(0, 100));
      });
    } catch (syncError) {
      console.log("Stripe sync setup skipped:", syncError.message?.slice(0, 100));
    }
  } catch (error) {
    console.log("Stripe initialization skipped:", error.message?.slice(0, 100));
  }
}
var SENSITIVE_FIELDS = /* @__PURE__ */ new Set(["password", "token", "secret", "accessToken", "refreshToken"]);
function redactSensitive(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitive);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = SENSITIVE_FIELDS.has(key) ? "[REDACTED]" : redactSensitive(value);
  }
  return result;
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      const requestBody = req.body && typeof req.body === "object" ? req.body : void 0;
      if (requestBody && Object.keys(requestBody).length > 0) {
        const redactedBody = JSON.stringify(redactSensitive(requestBody));
        if (redactedBody.length < 200) {
          logLine += ` body:${redactedBody}`;
        }
      }
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(redactSensitive(capturedJsonResponse))}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  let expFullUrl = `exps://${expsUrl}`;
  try {
    const tunnelUrl = fs.readFileSync("/tmp/expo-tunnel-url.txt", "utf8").trim();
    if (tunnelUrl) expFullUrl = tunnelUrl;
  } catch (_) {
  }
  log(`baseUrl`, baseUrl);
  log(`expFullUrl`, expFullUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXP_FULL_URL_PLACEHOLDER/g, expFullUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function setupMetroProxy(app2) {
  const METRO_PORT = 8081;
  const metroProxy = createProxyMiddleware({
    pathFilter: (path2, req) => path2.startsWith("/_expo") || path2.startsWith("/index.bundle") || path2.startsWith("/index.map") || path2.startsWith("/__metro__") || path2.startsWith("/__hmr") || path2.startsWith("/hot") || path2.startsWith("/debugger-ui") || path2.startsWith("/client/") || path2.startsWith("/assets/") && !!(req.query?.platform || req.query?.hash || req.headers?.["expo-platform"]) || path2 === "/" && !!(req.headers && req.headers["expo-platform"]),
    target: `http://localhost:${METRO_PORT}`,
    changeOrigin: true,
    ws: true,
    proxyTimeout: 10 * 60 * 1e3,
    timeout: 10 * 60 * 1e3,
    on: {
      error: (_err, _req, res) => {
        if (res && typeof res.status === "function" && !res.headersSent) {
          res.status(502).send("Metro dev server not reachable");
        }
      }
    }
  });
  app2.use(metroProxy);
  log("Metro proxy configured: /_expo/*, /client/*, /assets/* \u2192 localhost:8081");
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  app2.get("/book/:slug", async (req, res) => {
    try {
      const { renderBookingPage: renderBookingPage2 } = await Promise.resolve().then(() => (init_bookingPage(), bookingPage_exports));
      const { html, status } = await renderBookingPage2(req.params.slug, db);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.status(status).send(html);
    } catch (err) {
      console.error("Booking page render error:", err);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(500).send("<!DOCTYPE html><html><body><h1>Internal Server Error</h1></body></html>");
    }
  });
  log("Serving static Expo files with dynamic manifest routing");
  app2.get("/qr", (_req, res) => {
    let tunnelUrl = "";
    try {
      tunnelUrl = fs.readFileSync("/tmp/expo-tunnel-url.txt", "utf8").trim();
    } catch (_) {
    }
    const ready = !!tunnelUrl;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="5">
  <title>HomeBase - Open in Expo Go</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #111;
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 20px;
    }
    .card {
      background: #1c1c1e;
      border-radius: 20px;
      padding: 40px 32px;
      text-align: center;
      max-width: 360px;
      width: 100%;
    }
    .dot {
      width: 10px; height: 10px; border-radius: 50%;
      display: inline-block; margin-right: 8px;
      background: ${ready ? "#38AE5F" : "#f59e0b"};
    }
    .status {
      font-size: 13px;
      color: ${ready ? "#38AE5F" : "#f59e0b"};
      margin-bottom: 24px;
      display: flex; align-items: center; justify-content: center;
    }
    h1 { font-size: 22px; font-weight: 600; margin-bottom: 8px; }
    .sub { font-size: 14px; color: #888; margin-bottom: 28px; line-height: 1.5; }
    #qr-wrap {
      background: #fff;
      border-radius: 12px;
      padding: 16px;
      display: inline-block;
      margin-bottom: 24px;
    }
    .url-box {
      background: #2c2c2e;
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 13px;
      color: #aaa;
      word-break: break-all;
      margin-bottom: 8px;
    }
    .hint { font-size: 12px; color: #555; }
    .spinner {
      width: 48px; height: 48px;
      border: 3px solid #333;
      border-top-color: #38AE5F;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="status"><span class="dot"></span>${ready ? "Tunnel ready" : "Waiting for Metro..."}</div>
    <h1>Open in Expo Go</h1>
    <p class="sub">Scan with your iPhone camera to open HomeBase in Expo Go</p>
    ${ready ? `
    <div id="qr-wrap"><canvas id="qr"></canvas></div>
    <div class="url-box">${tunnelUrl}</div>
    <p class="hint">Page refreshes automatically</p>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
    <script>
      QRCode.toCanvas(document.getElementById('qr'), '${tunnelUrl}', {
        width: 220, margin: 0, color: { dark: '#000', light: '#fff' }
      });
    </script>
    ` : `
    <div class="spinner"></div>
    <p class="hint">Metro is starting up. This page refreshes every 5 seconds.</p>
    `}
  </div>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });
  app2.get("/api/tunnel-url", (_req, res) => {
    let tunnelUrl = null;
    try {
      const content = fs.readFileSync("/tmp/expo-tunnel-url.txt", "utf8").trim();
      if (content) tunnelUrl = content;
    } catch (_) {
    }
    res.json({ url: tunnelUrl, ready: !!tunnelUrl });
  });
  app2.get("/web", (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} - Web Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(135deg, #0F1419 0%, #1a2633 100%);
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      max-width: 480px;
      text-align: center;
    }
    .icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      background: #38AE5F;
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon svg { width: 40px; height: 40px; fill: #fff; }
    h1 { font-size: 28px; margin-bottom: 12px; }
    p { color: #888; font-size: 16px; line-height: 1.6; margin-bottom: 24px; }
    .steps {
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      padding: 24px;
      text-align: left;
      margin-bottom: 24px;
    }
    .step {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
    }
    .step:last-child { margin-bottom: 0; }
    .step-num {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #38AE5F;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
      flex-shrink: 0;
    }
    .step-text { font-size: 15px; color: #ccc; padding-top: 3px; }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      background: #38AE5F;
      color: #fff;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 500;
      font-size: 16px;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    .back { margin-top: 16px; }
    .back a { color: #666; font-size: 14px; text-decoration: none; }
    .back a:hover { color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg viewBox="0 0 24 24"><path d="M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z"/></svg>
    </div>
    <h1>Mobile App Preview</h1>
    <p>This is a native mobile app built with React Native. For the best experience, view it on your phone using Expo Go.</p>
    
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Download Expo Go from the App Store or Google Play</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">Return to the landing page and scan the QR code</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">The app will open instantly on your phone</div>
      </div>
    </div>
    
    <a href="/" class="btn">Back to QR Code</a>
    <div class="back"><a href="/">Return to landing page</a></div>
  </div>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function maybeStartMetro() {
  if (process.env.NODE_ENV !== "production") return;
  const manifestPath = path.resolve(process.cwd(), "static-build", "ios", "manifest.json");
  if (fs.existsSync(manifestPath)) {
    log("Static Expo bundle found \u2014 skipping dynamic Metro startup.");
    return;
  }
  log("No static Expo bundle found \u2014 starting Metro dynamically for production...");
  const devToolsCandidates = [
    path.resolve(
      process.cwd(),
      "node_modules/expo/node_modules/@react-native/debugger-shell/bin/react-native-devtools"
    ),
    path.resolve(
      process.cwd(),
      "node_modules/@react-native/debugger-shell/bin/react-native-devtools"
    )
  ];
  for (const bin of devToolsCandidates) {
    if (fs.existsSync(bin)) {
      try {
        fs.writeFileSync(bin, "#!/bin/sh\nexit 0\n", { mode: 493 });
        log(`Stubbed DevTools binary: ${bin}`);
      } catch (_) {
      }
    }
  }
  const domain = (process.env.REPLIT_INTERNAL_APP_DOMAIN || process.env.REPLIT_DEV_DOMAIN || process.env.EXPO_PUBLIC_DOMAIN || "localhost").replace(/^https?:\/\//i, "");
  const metro = spawn(
    "npx",
    ["expo", "start", "--no-dev", "--minify", "--localhost"],
    {
      stdio: "inherit",
      detached: false,
      env: {
        ...process.env,
        EXPO_PUBLIC_DOMAIN: domain,
        CI: "1",
        REACT_NATIVE_DEBUGGER_OPEN: "0",
        EXPO_NO_INSPECTOR_PROXY: "1",
        NODE_OPTIONS: "--max-old-space-size=4096"
      }
    }
  );
  metro.on("error", (err) => {
    log(`Metro spawn error (non-fatal): ${err.message}`);
  });
  metro.on("exit", (code) => {
    log(`Metro process exited with code ${code}`);
  });
  const cleanup = () => {
    try {
      metro.kill("SIGTERM");
    } catch (_) {
    }
  };
  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
  process.on("exit", cleanup);
  log(`Metro started (PID ${metro.pid}) \u2014 proxy will route Expo Go requests.`);
}
function parseAppointmentDatetime(scheduledDate, scheduledTime) {
  if (!scheduledTime) return scheduledDate;
  const base = new Date(scheduledDate);
  const match12 = scheduledTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const match24 = scheduledTime.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === "AM" && hours === 12) hours = 0;
    if (period === "PM" && hours !== 12) hours += 12;
    base.setHours(hours, minutes, 0, 0);
  } else if (match24) {
    base.setHours(parseInt(match24[1], 10), parseInt(match24[2], 10), 0, 0);
  }
  return base;
}
async function runBookingReminder24h() {
  try {
    const now = /* @__PURE__ */ new Date();
    const broadFrom = new Date(now.getTime() + 22 * 60 * 60 * 1e3);
    const broadTo = new Date(now.getTime() + 26 * 60 * 60 * 1e3);
    const upcoming = await db.select().from(appointments).where(
      and6(gte2(appointments.scheduledDate, broadFrom), lte2(appointments.scheduledDate, broadTo), eq6(appointments.status, "confirmed"))
    );
    const windowFrom = new Date(now.getTime() + 23 * 60 * 60 * 1e3);
    const windowTo = new Date(now.getTime() + 25 * 60 * 60 * 1e3);
    for (const appt of upcoming) {
      const apptDatetime = parseAppointmentDatetime(appt.scheduledDate, appt.scheduledTime);
      if (apptDatetime < windowFrom || apptDatetime > windowTo) continue;
      const alreadySent = await hasDeliveryForRecord("booking.reminder_24h", appt.id);
      if (alreadySent) continue;
      const [user, provider] = await Promise.all([
        db.select().from(users).where(eq6(users.id, appt.userId)).then((r) => r[0]),
        db.select().from(providers).where(eq6(providers.id, appt.providerId)).then((r) => r[0])
      ]);
      if (!user?.email) continue;
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
      dispatch("booking.reminder_24h", {
        recipientUserId: user.id,
        clientEmail: user.email,
        clientName: name,
        providerName: provider?.businessName || "Your provider",
        serviceName: appt.serviceName,
        appointmentDate: apptDatetime.toLocaleDateString(),
        appointmentTime: appt.scheduledTime,
        relatedRecordType: "appointment",
        relatedRecordId: appt.id
      });
    }
    console.log(`[cron:24h-reminder] checked ${upcoming.length} upcoming appointments`);
  } catch (err) {
    console.error("[cron:24h-reminder] error:", err);
  }
}
async function runBookingReminder2h() {
  try {
    const now = /* @__PURE__ */ new Date();
    const broadFrom = new Date(now.getTime() + 60 * 60 * 1e3);
    const broadTo = new Date(now.getTime() + 3 * 60 * 60 * 1e3);
    const upcoming = await db.select().from(appointments).where(
      and6(gte2(appointments.scheduledDate, broadFrom), lte2(appointments.scheduledDate, broadTo), eq6(appointments.status, "confirmed"))
    );
    const windowFrom = new Date(now.getTime() + 90 * 60 * 1e3);
    const windowTo = new Date(now.getTime() + 150 * 60 * 1e3);
    for (const appt of upcoming) {
      const apptDatetime = parseAppointmentDatetime(appt.scheduledDate, appt.scheduledTime);
      if (apptDatetime < windowFrom || apptDatetime > windowTo) continue;
      const alreadySent = await hasDeliveryForRecord("booking.reminder_2h", appt.id);
      if (alreadySent) continue;
      const [user, provider] = await Promise.all([
        db.select().from(users).where(eq6(users.id, appt.userId)).then((r) => r[0]),
        db.select().from(providers).where(eq6(providers.id, appt.providerId)).then((r) => r[0])
      ]);
      if (!user?.email) continue;
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
      dispatch("booking.reminder_2h", {
        recipientUserId: user.id,
        clientEmail: user.email,
        clientName: name,
        providerName: provider?.businessName || "Your provider",
        serviceName: appt.serviceName,
        appointmentDate: apptDatetime.toLocaleDateString(),
        appointmentTime: appt.scheduledTime,
        relatedRecordType: "appointment",
        relatedRecordId: appt.id
      });
    }
    console.log(`[cron:2h-reminder] checked ${upcoming.length} upcoming appointments`);
  } catch (err) {
    console.error("[cron:2h-reminder] error:", err);
  }
}
async function runInvoiceDueReminder() {
  try {
    const now = /* @__PURE__ */ new Date();
    const from = new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1e3);
    const to = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1e3);
    const dueInvoices = await db.select().from(invoices).where(
      and6(
        gte2(invoices.dueDate, from),
        lte2(invoices.dueDate, to),
        eq6(invoices.status, "sent")
      )
    );
    for (const invoice of dueInvoices) {
      if (!invoice.clientId && !invoice.homeownerUserId) continue;
      const alreadySent = await hasDeliveryForRecord("invoice.reminder_3d", invoice.id);
      if (alreadySent) continue;
      const [client, provider] = await Promise.all([
        invoice.clientId ? db.select().from(clients).where(eq6(clients.id, invoice.clientId)).then((r) => r[0]) : Promise.resolve(void 0),
        db.select().from(providers).where(eq6(providers.id, invoice.providerId)).then((r) => r[0])
      ]);
      let recipientEmail = client?.email;
      let recipientName = [client?.firstName, client?.lastName].filter(Boolean).join(" ") || "Client";
      let recipientUserId;
      if (invoice.homeownerUserId) {
        const homeowner = await db.select().from(users).where(eq6(users.id, invoice.homeownerUserId)).then((r) => r[0]);
        if (homeowner?.email) {
          recipientEmail = homeowner.email;
          recipientName = [homeowner.firstName, homeowner.lastName].filter(Boolean).join(" ") || "Client";
          recipientUserId = homeowner.id;
        }
      }
      if (!recipientEmail) continue;
      const msUntilDue = invoice.dueDate ? invoice.dueDate.getTime() - now.getTime() : 0;
      const daysUntilDue = Math.ceil(msUntilDue / (1e3 * 60 * 60 * 24));
      dispatch("invoice.reminder_3d", {
        recipientUserId,
        clientEmail: recipientEmail,
        clientName: recipientName,
        providerName: provider?.businessName || "Service Provider",
        invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`,
        amount: parseFloat(invoice.total?.toString() || "0"),
        dueDate: invoice.dueDate ? invoice.dueDate.toLocaleDateString() : "Soon",
        daysUntilDue,
        paymentLink: invoice.hostedInvoiceUrl || void 0,
        relatedRecordType: "invoice",
        relatedRecordId: invoice.id
      });
    }
    console.log(`[cron:invoice-due-reminder] checked ${dueInvoices.length} invoices`);
  } catch (err) {
    console.error("[cron:invoice-due-reminder] error:", err);
  }
}
async function runInvoiceOverdueReminder() {
  try {
    const now = /* @__PURE__ */ new Date();
    const from = new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1e3);
    const to = new Date(now.getTime() - 0.5 * 24 * 60 * 60 * 1e3);
    const overdueInvoices = await db.select().from(invoices).where(
      and6(
        gte2(invoices.dueDate, from),
        lt(invoices.dueDate, to),
        eq6(invoices.status, "sent")
      )
    );
    for (const invoice of overdueInvoices) {
      if (!invoice.clientId && !invoice.homeownerUserId) continue;
      const alreadySent = await hasDeliveryForRecord("invoice.overdue_1d", invoice.id);
      if (alreadySent) continue;
      const [client, provider] = await Promise.all([
        invoice.clientId ? db.select().from(clients).where(eq6(clients.id, invoice.clientId)).then((r) => r[0]) : Promise.resolve(void 0),
        db.select().from(providers).where(eq6(providers.id, invoice.providerId)).then((r) => r[0])
      ]);
      let recipientEmail = client?.email;
      let recipientName = [client?.firstName, client?.lastName].filter(Boolean).join(" ") || "Client";
      let recipientUserId;
      if (invoice.homeownerUserId) {
        const homeowner = await db.select().from(users).where(eq6(users.id, invoice.homeownerUserId)).then((r) => r[0]);
        if (homeowner?.email) {
          recipientEmail = homeowner.email;
          recipientName = [homeowner.firstName, homeowner.lastName].filter(Boolean).join(" ") || "Client";
          recipientUserId = homeowner.id;
        }
      }
      if (!recipientEmail) continue;
      const msOverdue = now.getTime() - (invoice.dueDate ? invoice.dueDate.getTime() : now.getTime());
      const daysOverdue = Math.ceil(msOverdue / (1e3 * 60 * 60 * 24));
      dispatch("invoice.overdue_1d", {
        recipientUserId,
        clientEmail: recipientEmail,
        clientName: recipientName,
        providerName: provider?.businessName || "Service Provider",
        invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`,
        amount: parseFloat(invoice.total?.toString() || "0"),
        dueDate: invoice.dueDate ? invoice.dueDate.toLocaleDateString() : "Past due",
        daysOverdue,
        paymentLink: invoice.hostedInvoiceUrl || void 0,
        relatedRecordType: "invoice",
        relatedRecordId: invoice.id
      });
    }
    console.log(`[cron:invoice-overdue-reminder] checked ${overdueInvoices.length} invoices`);
  } catch (err) {
    console.error("[cron:invoice-overdue-reminder] error:", err);
  }
}
function setupReminderJobs() {
  cron.schedule("0 * * * *", runBookingReminder24h);
  cron.schedule("*/30 * * * *", runBookingReminder2h);
  cron.schedule("0 9 * * *", runInvoiceDueReminder);
  cron.schedule("0 10 * * *", runInvoiceOverdueReminder);
  console.log("[cron] reminder jobs scheduled: 24h/2h booking reminders, 3d/1d invoice reminders");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupMetroProxy(app);
  setupStripeWebhook(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  await initStripe();
  setupReminderJobs();
  maybeStartMetro();
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
