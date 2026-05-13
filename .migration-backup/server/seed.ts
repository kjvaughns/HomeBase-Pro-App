import { db } from "./db";
import { serviceCategories, services, providers, providerServices, users, homes, appointments } from "@shared/schema";
import bcrypt from "bcryptjs";

// Test user credentials for demo/testing purposes
export const TEST_USER_EMAIL = "test@homebase.com";
export const TEST_USER_PASSWORD = "test123";
export const TEST_USER_ID = "test-user-001";
export const TEST_HOME_ID = "test-home-001";

export async function seedDatabase() {
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
    { id: "handyman", name: "Handyman", description: "General repairs and fixes", icon: "tool", sortOrder: 8 },
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
    { id: "s18", categoryId: "handyman", name: "Furniture Assembly", description: "Assemble furniture", basePrice: "60.00" },
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
    { id: "p8", businessName: "Handy Helper", description: "Your go-to for all small repairs and fixes", phone: "555-0108", email: "help@handyhelper.com", rating: "4.5", reviewCount: 189, hourlyRate: "50.00", isVerified: true, serviceArea: "Metro Area", yearsExperience: 6, capabilityTags: ["Insured", "Flexible Hours", "Small Jobs", "Furniture Assembly", "Mounting"] },
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
    { providerId: "p8", serviceId: "s18", categoryId: "handyman", price: "60.00" },
  ];

  await db.insert(providerServices).values(providerServiceData);

  // Create test user with mock data for demo purposes
  const hashedPassword = await bcrypt.hash(TEST_USER_PASSWORD, 10);
  
  await db.insert(users).values({
    id: TEST_USER_ID,
    email: TEST_USER_EMAIL,
    password: hashedPassword,
    firstName: "Demo",
    lastName: "User",
    phone: "555-0000",
  });

  // Create test user's home
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
    isDefault: true,
  });

  // Create sample appointments for test user
  const now = new Date();
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
      urgency: "soon" as const,
      jobSize: "small" as const,
      scheduledDate: tomorrow,
      scheduledTime: "10:00 AM",
      status: "confirmed" as const,
      estimatedPrice: "125.00",
    },
    {
      id: "appt-test-2",
      userId: TEST_USER_ID,
      homeId: TEST_HOME_ID,
      providerId: "p2",
      serviceId: "s4",
      serviceName: "AC Repair",
      description: "Air conditioning not cooling properly",
      urgency: "urgent" as const,
      jobSize: "medium" as const,
      scheduledDate: nextWeek,
      scheduledTime: "2:00 PM",
      status: "pending" as const,
      estimatedPrice: "150.00",
    },
    {
      id: "appt-test-3",
      userId: TEST_USER_ID,
      homeId: TEST_HOME_ID,
      providerId: "p4",
      serviceId: "s9",
      serviceName: "Deep Clean",
      description: "Full house deep cleaning before holiday guests",
      urgency: "flexible" as const,
      jobSize: "large" as const,
      scheduledDate: lastWeek,
      scheduledTime: "9:00 AM",
      status: "completed" as const,
      estimatedPrice: "200.00",
      finalPrice: "220.00",
    },
  ];

  await db.insert(appointments).values(appointmentData);

  console.log("Database seeded successfully with test user: " + TEST_USER_EMAIL);
}
