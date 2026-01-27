import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, decimal, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const propertyTypeEnum = pgEnum("property_type", ["single_family", "condo", "townhouse", "apartment", "multi_family"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["pending", "confirmed", "in_progress", "completed", "cancelled"]);
export const urgencyEnum = pgEnum("urgency", ["flexible", "soon", "urgent"]);
export const jobSizeEnum = pgEnum("job_size", ["small", "medium", "large"]);

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const providersRelations = relations(providers, ({ one, many }) => ({
  user: one(users, { fields: [providers.userId], references: [users.id] }),
  services: many(providerServices),
  appointments: many(appointments),
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

export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  homeId: varchar("home_id").notNull().references(() => homes.id, { onDelete: "cascade" }),
  providerId: varchar("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").references(() => services.id, { onDelete: "set null" }),
  serviceName: text("service_name").notNull(),
  description: text("description"),
  urgency: urgencyEnum("urgency").default("flexible"),
  jobSize: jobSizeEnum("job_size").default("small"),
  scheduledDate: timestamp("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time").notNull(),
  status: appointmentStatusEnum("status").default("pending"),
  estimatedPrice: decimal("estimated_price", { precision: 10, scale: 2 }),
  finalPrice: decimal("final_price", { precision: 10, scale: 2 }),
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

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  cancelledAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Home = typeof homes.$inferSelect;
export type InsertHome = z.infer<typeof insertHomeSchema>;
export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Review = typeof reviews.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
