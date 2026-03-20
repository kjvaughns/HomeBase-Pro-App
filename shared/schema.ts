import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, decimal, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const propertyTypeEnum = pgEnum("property_type", ["single_family", "condo", "townhouse", "apartment", "multi_family"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["pending", "confirmed", "in_progress", "completed", "cancelled"]);
export const urgencyEnum = pgEnum("urgency", ["flexible", "soon", "urgent"]);
export const jobSizeEnum = pgEnum("job_size", ["small", "medium", "large"]);
export const jobStatusEnum = pgEnum("job_status", ["scheduled", "confirmed", "on_my_way", "arrived", "in_progress", "completed", "cancelled"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "sent", "viewed", "paid", "partially_paid", "overdue", "void", "refunded", "cancelled"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "card", "bank_transfer", "check", "stripe", "credits", "other"]);
export const paymentStatusEnum = pgEnum("payment_status", ["requires_payment", "processing", "succeeded", "failed", "refunded"]);
export const payoutStatusEnum = pgEnum("payout_status", ["pending", "in_transit", "paid", "failed"]);
export const connectOnboardingStatusEnum = pgEnum("connect_onboarding_status", ["not_started", "pending", "complete"]);
export const providerPlanTierEnum = pgEnum("provider_plan_tier", ["free", "starter", "professional", "enterprise"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  isProvider: boolean("is_provider").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  homes: many(homes),
  appointments: many(appointments),
}));

export const homes = pgTable("homes", {
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
  lotSize: integer("lot_size"), // in sqft
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
  housefaxData: text("housefax_data"), // JSON: systems, materials, known issues, etc.
  housefaxScore: integer("housefax_score"), // Home health score (0-100)
  housefaxEnrichedAt: timestamp("housefax_enriched_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const homesRelations = relations(homes, ({ one, many }) => ({
  user: one(users, { fields: [homes.userId], references: [users.id] }),
  appointments: many(appointments),
}));

export const serviceCategories = pgTable("service_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  sortOrder: integer("sort_order").default(0),
});

export const serviceCategoriesRelations = relations(serviceCategories, ({ many }) => ({
  services: many(services),
  providers: many(providerServices),
}));

export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull().references(() => serviceCategories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }),
});

export const servicesRelations = relations(services, ({ one, many }) => ({
  category: one(serviceCategories, { fields: [services.categoryId], references: [serviceCategories.id] }),
  providerServices: many(providerServices),
}));

export const providers = pgTable("providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  businessName: text("business_name").notNull(),
  description: text("description"),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  email: text("email"),
  rating: decimal("rating", { precision: 2, scale: 1 }).default("0"),
  reviewCount: integer("review_count").default(0),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  isVerified: boolean("is_verified").default(false),
  isActive: boolean("is_active").default(true),
  serviceArea: text("service_area"),
  yearsExperience: integer("years_experience").default(0),
  capabilityTags: text("capability_tags").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const providersRelations = relations(providers, ({ one, many }) => ({
  user: one(users, { fields: [providers.userId], references: [users.id] }),
  services: many(providerServices),
  appointments: many(appointments),
  clients: many(clients),
  jobs: many(jobs),
  invoices: many(invoices),
  payments: many(payments),
}));

export const providerServices = pgTable("provider_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  categoryId: varchar("category_id").notNull().references(() => serviceCategories.id, { onDelete: "cascade" }),
  price: decimal("price", { precision: 10, scale: 2 }),
});

export const providerServicesRelations = relations(providerServices, ({ one }) => ({
  provider: one(providers, { fields: [providerServices.providerId], references: [providers.id] }),
  service: one(services, { fields: [providerServices.serviceId], references: [services.id] }),
  category: one(serviceCategories, { fields: [providerServices.categoryId], references: [serviceCategories.id] }),
}));

export const pricingTypeEnum = pgEnum("pricing_type", ["fixed", "variable", "service_call", "quote"]);

export const providerCustomServices = pgTable("provider_custom_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("General"),
  description: text("description"),
  pricingType: pricingTypeEnum("pricing_type").notNull().default("fixed"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }),
  priceFrom: decimal("price_from", { precision: 10, scale: 2 }),
  priceTo: decimal("price_to", { precision: 10, scale: 2 }),
  duration: integer("duration").default(60),
  isPublished: boolean("is_published").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const providerCustomServicesRelations = relations(providerCustomServices, ({ one }) => ({
  provider: one(providers, { fields: [providerCustomServices.providerId], references: [providers.id] }),
}));

export const insertProviderCustomServiceSchema = createInsertSchema(providerCustomServices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ProviderCustomService = typeof providerCustomServices.$inferSelect;
export type InsertProviderCustomService = z.infer<typeof insertProviderCustomServiceSchema>;

export const appointments = pgTable("appointments", {
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
});

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  user: one(users, { fields: [appointments.userId], references: [users.id] }),
  home: one(homes, { fields: [appointments.homeId], references: [homes.id] }),
  provider: one(providers, { fields: [appointments.providerId], references: [providers.id] }),
  service: one(services, { fields: [appointments.serviceId], references: [services.id] }),
}));

export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appointmentId: varchar("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reviewsRelations = relations(reviews, ({ one }) => ({
  appointment: one(appointments, { fields: [reviews.appointmentId], references: [appointments.id] }),
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
  provider: one(providers, { fields: [reviews.providerId], references: [providers.id] }),
}));

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  isRead: boolean("is_read").default(false),
  data: text("data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const maintenanceReminderFrequencyEnum = pgEnum("maintenance_reminder_frequency", ["monthly", "quarterly", "biannually", "annually", "custom"]);

export const maintenanceReminders = pgTable("maintenance_reminders", {
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const maintenanceRemindersRelations = relations(maintenanceReminders, ({ one }) => ({
  home: one(homes, { fields: [maintenanceReminders.homeId], references: [homes.id] }),
  user: one(users, { fields: [maintenanceReminders.userId], references: [users.id] }),
}));

// Provider plan tiers with platform fees
export const providerPlans = pgTable("provider_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  planTier: providerPlanTierEnum("plan_tier").default("free"),
  platformFeePercent: decimal("platform_fee_percent", { precision: 5, scale: 2 }).default("10.00"), // 10% default
  platformFeeFixedCents: integer("platform_fee_fixed_cents").default(0), // additional fixed fee in cents
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const providerPlansRelations = relations(providerPlans, ({ one }) => ({
  provider: one(providers, { fields: [providerPlans.providerId], references: [providers.id] }),
}));

// Stripe Connect accounts for providers
export const stripeConnectAccounts = pgTable("stripe_connect_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }).unique(),
  stripeAccountId: text("stripe_account_id").notNull().unique(),
  onboardingStatus: connectOnboardingStatusEnum("onboarding_status").default("not_started"),
  chargesEnabled: boolean("charges_enabled").default(false),
  payoutsEnabled: boolean("payouts_enabled").default(false),
  detailsSubmitted: boolean("details_submitted").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stripeConnectAccountsRelations = relations(stripeConnectAccounts, ({ one }) => ({
  provider: one(providers, { fields: [stripeConnectAccounts.providerId], references: [providers.id] }),
}));

// User credits wallet (for RevenueCat integration)
export const userCredits = pgTable("user_credits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  balanceCents: integer("balance_cents").default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userCreditsRelations = relations(userCredits, ({ one, many }) => ({
  user: one(users, { fields: [userCredits.userId], references: [users.id] }),
  ledger: many(creditLedger),
}));

// Credit ledger for tracking credit transactions
export const creditLedger = pgTable("credit_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deltaCents: integer("delta_cents").notNull(), // positive for credit, negative for debit
  reason: text("reason").notNull(), // e.g., "revenuecat_purchase", "invoice_payment", "refund"
  invoiceId: varchar("invoice_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const creditLedgerRelations = relations(creditLedger, ({ one }) => ({
  user: one(users, { fields: [creditLedger.userId], references: [users.id] }),
  credits: one(userCredits, { fields: [creditLedger.userId], references: [userCredits.userId] }),
}));

// Payouts to providers via Stripe Connect
export const payouts = pgTable("payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  status: payoutStatusEnum("status").default("pending"),
  stripeTransferId: text("stripe_transfer_id"),
  stripePayoutId: text("stripe_payout_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payoutsRelations = relations(payouts, ({ one }) => ({
  provider: one(providers, { fields: [payouts.providerId], references: [providers.id] }),
}));

// Stripe webhook events for idempotency
export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  payload: text("payload"), // JSON string of event data
});

// Invoice line items (normalized from JSON)
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1"),
  unitPriceCents: integer("unit_price_cents").notNull(),
  amountCents: integer("amount_cents").notNull(),
  metadata: text("metadata"), // JSON for additional data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLineItems.invoiceId], references: [invoices.id] }),
}));

// Provider's clients (their customers)
export const clients = pgTable("clients", {
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
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clientsRelations = relations(clients, ({ one, many }) => ({
  provider: one(providers, { fields: [clients.providerId], references: [providers.id] }),
  jobs: many(jobs),
  invoices: many(invoices),
}));

// Provider-initiated jobs (work orders)
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  appointmentId: varchar("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
  serviceId: varchar("service_id").references(() => services.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  scheduledDate: timestamp("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time"),
  estimatedDuration: integer("estimated_duration"), // in minutes
  status: jobStatusEnum("status").default("scheduled"),
  address: text("address"),
  estimatedPrice: decimal("estimated_price", { precision: 10, scale: 2 }),
  finalPrice: decimal("final_price", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  provider: one(providers, { fields: [jobs.providerId], references: [providers.id] }),
  client: one(clients, { fields: [jobs.clientId], references: [clients.id] }),
  appointment: one(appointments, { fields: [jobs.appointmentId], references: [appointments.id] }),
  service: one(services, { fields: [jobs.serviceId], references: [services.id] }),
  invoices: many(invoices),
}));

// Invoices for jobs (enhanced for Stripe Connect)
export const invoices = pgTable("invoices", {
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
  lineItems: text("line_items"), // JSON string of line items (legacy)
  paymentMethodsAllowed: text("payment_methods_allowed").default("stripe,credits"), // JSON array
  
  // Stripe Connect fields
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentLinkId: text("stripe_payment_link_id"),
  hostedInvoiceUrl: text("hosted_invoice_url"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  paidAt: timestamp("paid_at"),
});

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  provider: one(providers, { fields: [invoices.providerId], references: [providers.id] }),
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  homeownerUser: one(users, { fields: [invoices.homeownerUserId], references: [users.id] }),
  job: one(jobs, { fields: [invoices.jobId], references: [jobs.id] }),
  payments: many(payments),
  lineItemsNormalized: many(invoiceLineItems),
}));

// Payments received (enhanced for Stripe Connect)
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull().default(0),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull().default("0"), // Legacy
  method: paymentMethodEnum("method").default("stripe"),
  status: paymentStatusEnum("status").default("requires_payment"),
  
  // Stripe fields
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeChargeId: text("stripe_charge_id"),
  
  reference: text("reference"), // transaction ID or check number
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
  provider: one(providers, { fields: [payments.providerId], references: [providers.id] }),
}));

// Booking link status enum
export const bookingLinkStatusEnum = pgEnum("booking_link_status", ["active", "paused", "disabled"]);

// Quote mode enum for intake submissions
export const quoteModeEnum = pgEnum("quote_mode", ["range", "fixed", "estimate_after_review"]);

// Intake submission status enum
export const intakeStatusEnum = pgEnum("intake_status", ["submitted", "reviewed", "converted", "declined", "expired"]);

// Provider booking links (public intake pages)
export const bookingLinks = pgTable("booking_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  status: bookingLinkStatusEnum("status").default("active"),
  depositRequired: boolean("deposit_required").default(false),
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
  depositPercentage: integer("deposit_percentage"), // Alternative to fixed amount
  serviceCatalog: text("service_catalog"), // JSON: list of services with pricing
  availabilityRules: text("availability_rules"), // JSON: working hours, blackout dates
  intakeQuestions: text("intake_questions"), // JSON: custom questions to ask
  welcomeMessage: text("welcome_message"),
  confirmationMessage: text("confirmation_message"),
  brandColor: text("brand_color"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bookingLinksRelations = relations(bookingLinks, ({ one, many }) => ({
  provider: one(providers, { fields: [bookingLinks.providerId], references: [providers.id] }),
  intakeSubmissions: many(intakeSubmissions),
}));

// Intake submissions from booking links
export const intakeSubmissions = pgTable("intake_submissions", {
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
  answersJson: text("answers_json"), // JSON: responses to intake questions
  photosJson: text("photos_json"), // JSON: array of photo URLs
  preferredTimesJson: text("preferred_times_json"), // JSON: preferred appointment times
  
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
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const intakeSubmissionsRelations = relations(intakeSubmissions, ({ one }) => ({
  bookingLink: one(bookingLinks, { fields: [intakeSubmissions.bookingLinkId], references: [bookingLinks.id] }),
  provider: one(providers, { fields: [intakeSubmissions.providerId], references: [providers.id] }),
  homeownerUser: one(users, { fields: [intakeSubmissions.homeownerUserId], references: [users.id] }),
  category: one(serviceCategories, { fields: [intakeSubmissions.categoryId], references: [serviceCategories.id] }),
  convertedJob: one(jobs, { fields: [intakeSubmissions.convertedJobId], references: [jobs.id] }),
  convertedClient: one(clients, { fields: [intakeSubmissions.convertedClientId], references: [clients.id] }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  firstName: true,
  lastName: true,
  phone: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const insertHomeSchema = createInsertSchema(homes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments, {
  scheduledDate: z.coerce.date(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  cancelledAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobSchema = createInsertSchema(jobs, {
  scheduledDate: z.coerce.date(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  viewedAt: true,
  paidAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
});

export const insertProviderSchema = createInsertSchema(providers).omit({
  id: true,
  createdAt: true,
});

export const insertProviderPlanSchema = createInsertSchema(providerPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStripeConnectAccountSchema = createInsertSchema(stripeConnectAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({
  id: true,
  createdAt: true,
});

export const insertPayoutSchema = createInsertSchema(payouts).omit({
  id: true,
  createdAt: true,
});

export const insertUserCreditsSchema = createInsertSchema(userCredits).omit({
  id: true,
  updatedAt: true,
});

export const insertCreditLedgerSchema = createInsertSchema(creditLedger).omit({
  id: true,
  createdAt: true,
});

export const insertBookingLinkSchema = createInsertSchema(bookingLinks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntakeSubmissionSchema = createInsertSchema(intakeSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Home = typeof homes.$inferSelect;
export type InsertHome = z.infer<typeof insertHomeSchema>;
export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type InsertProvider = z.infer<typeof insertProviderSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Review = typeof reviews.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type ProviderPlan = typeof providerPlans.$inferSelect;
export type InsertProviderPlan = z.infer<typeof insertProviderPlanSchema>;
export type StripeConnectAccount = typeof stripeConnectAccounts.$inferSelect;
export type InsertStripeConnectAccount = z.infer<typeof insertStripeConnectAccountSchema>;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;
export type Payout = typeof payouts.$inferSelect;
export type InsertPayout = z.infer<typeof insertPayoutSchema>;
export type UserCredits = typeof userCredits.$inferSelect;
export type InsertUserCredits = z.infer<typeof insertUserCreditsSchema>;
export type CreditLedgerEntry = typeof creditLedger.$inferSelect;
export type InsertCreditLedgerEntry = z.infer<typeof insertCreditLedgerSchema>;
export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;
export type BookingLink = typeof bookingLinks.$inferSelect;
export type InsertBookingLink = z.infer<typeof insertBookingLinkSchema>;
export type IntakeSubmission = typeof intakeSubmissions.$inferSelect;
export type InsertIntakeSubmission = z.infer<typeof insertIntakeSubmissionSchema>;
