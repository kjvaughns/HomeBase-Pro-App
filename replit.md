# HomeBase - Unified Home Services App

## Overview
HomeBase is an iOS mobile application built with Expo React Native, featuring a unified platform for homeowners and service providers. It aims to streamline home service management, from finding providers and booking appointments to managing client relationships, jobs, and invoicing. The application integrates an Express.js backend with a Supabase PostgreSQL database to offer a comprehensive solution for the home services market. Key capabilities include a robust authentication system, distinct homeowner and provider portals, AI-powered assistance, and full CRUD operations for appointments, clients, jobs, and invoices.

## User Preferences
- No emojis in the app
- Only accent color #38AE5F, everything else neutral grayscale
- Liquid Glass styling for headers, tab bars, key cards, modals
- Clean, minimal design with proper spacing

## Test Account
For demo and testing purposes, a test account is available with pre-populated data:
- **Email**: test@homebase.com
- **Password**: test123
- **User ID**: test-user-001

The test account includes:
- A pre-configured home (123 Test Street, San Francisco)
- Sample appointments (Leak Repair, AC Repair, Deep Clean)

**New user accounts start with a clean, empty state** - no mock data is pre-populated. Categories and providers are shared public data visible to all users.

### Provider Side (Service Pro Portal)
The test account also has a provider profile (Demo Pro Services) with comprehensive business data:
- **Provider ID**: test-provider-001
- **Rating**: 4.9 stars (47 reviews)
- **Clients**: 8 active clients
- **Jobs**: 10 completed, 3 scheduled
- **Revenue MTD**: ~$4,910
- **Invoices**: 10 total (8 paid, 2 pending)
- **Capability Tags**: Licensed, Insured, Background Checked, 24/7 Emergency

## System Architecture
The application is structured into a client-side React Native Expo app and an Express.js backend. The UI/UX features a "Liquid Glass" effect for iOS, incorporating frosted blur for key elements, and supports both Light and Dark modes. The primary accent color is `#38AE5F`, with all other elements utilizing a neutral grayscale palette. Typography is based on SF Pro with a defined type scale.

### Technical Implementations
- **Authentication**: Backend-driven user management with email/password signup (bcrypt hashing), JWT-like session management, and a password reset flow. Includes an onboarding process for first property setup.
- **Access Control**: Three distinct access states: Guest Mode, Homeowner Mode, and Provider Mode, each with tailored functionalities.
- **AI Integration**: "Ask HomeBase AI" feature leverages OpenAI GPT-4o-mini via Replit AI Integrations for instant answers on home maintenance and repairs.
- **AI Smart Intake**: Natural language problem descriptions are analyzed by AI to classify service categories, generate follow-up questions, estimate price ranges, and match with top providers.
- **Dynamic Quote Engine**: AI-powered price estimates based on service type, home data, location, and complexity. Generates realistic ranges with material and labor breakdowns.
- **Smart Provider Matching**: Algorithm ranks providers using trust scores (job completion rate, on-time performance, satisfaction ratings) and shows top 3-5 curated matches instead of full directory.
- **Provider Capability Tags**: Skill-based tags (Licensed, Insured, 24/7 Emergency, etc.) displayed on provider cards with years of experience.
- **Service Summary Cards**: AI-generated scope of work summaries with itemized breakdowns shown to homeowners and providers during booking.
- **Data Management**: Full CRUD operations for appointments, clients, jobs, and invoices, with real-time status tracking and notifications.
- **Provider Portal**: Comprehensive dashboard displaying real-time statistics (revenue MTD, jobs completed, active clients), a Clients CRM with HouseFax integration, Schedule management with various calendar views, and a complete invoicing system.
  - **Clients CRM**: Full client management with search, filter chips (All/Leads/Active/Inactive/Has Upcoming/Overdue), and sort options (Recent Activity/Highest LTV/Most Overdue/Newest). Enhanced client cards show avatar, status badge, address, LTV, outstanding balance, and quick actions (Call/Message).
  - **ClientDetailScreen**: Premium tabbed interface with 5 tabs:
    - **Overview**: KPI cards (LTV, Total Jobs, Avg Ticket), outstanding balance alerts, upcoming appointments, recent activity timeline
    - **Jobs**: Job history with status pills and pricing
    - **Invoices**: Invoice list with paid/pending status and due dates
    - **Notes**: Client notes with private/shared badges and add note functionality
    - **Home (HouseFax)**: Property details (beds, baths, sqft, year built), Home Health Score from homeowner, Survival Kit maintenance estimates, notable risks, access information (pets, parking, gate codes), preferred appointment windows
- **Homeowner Tools**: Comprehensive home management features accessible from the More tab's Tools section and Home screen quick tiles:
  - **Survival Kit**: 17-step guided wizard that gathers property details (type, year built, square footage), home systems (HVAC type/age, water heater, roof), exterior features, location/climate info, and service preferences. Generates personalized results with 5 tabs: Summary (estimated yearly costs, top cost drivers), Plan (scheduled maintenance tasks with Book Now CTAs), Costs (category breakdown), Tips (money-saving suggestions), and Export (PDF/CSV options).
  - **HouseFax Ledger**: Home operating system with multi-home selector and 4 summary cards (Total Spent, Total Saved, Upcoming Tasks, Health Trend). Features 5 tabs: Overview (forecast, recent activity), History (filterable timeline of jobs/invoices/assessments), Assets (registry with 6+ items including install dates, warranty info, service cycles, and booking CTAs), Documents (uploads with categories), and Insights (predictive costs, upcoming risks, savings suggestions). Integrates all spending and savings tracking within the ledger.
  - **Home Health Score**: 14-step assessment wizard evaluating home age, systems (HVAC, water heater, roof), visible symptoms, safety checks, and maintenance habits. Features entry screen with last score/trend, results screen with animated score ring, 4 tabs (Overview, Risks, Action Plan, History), transparent scoring drawer with confidence indicator, and convert-to-booking CTAs for high-severity items.
  - **Service History**: Two-tab structure with Timeline (monthly grouped ledger, filters for All/Completed/Upcoming/Invoices/DIY/Warranties) and Providers tab (past providers with spend totals, ratings). Includes home selector and service entry detail modal.
  - **Saved Providers**: Full list page with search functionality, sort options (Recent/Rating/Most Booked/Closest), enhanced provider cards showing tags, ratings, and action buttons (Book/Message/Remove/Share). Features empty state with CTA to browse providers.
- **Saved Providers**: Homeowners can save/favorite providers by tapping the heart icon on provider profiles. Saved providers are persisted and accessible from the More screen.
- **Help Center**: FAQ screen with expandable sections covering Getting Started, Bookings & Appointments, Payments & Pricing, and About Providers.
- **Contact Us**: Contact options including Email Support, Phone Support, Live Chat, and social media links with support hours.
- **Design System**: Reusable UI components like `PrimaryButton`, `GlassCard`, `ListRow`, `StatusPill`, `TextField`, `Avatar`, `EmptyState`, `SkeletonLoader`, and various cards for categories, providers, bookings, messages, and stats.
- **State Management**: Uses Zustand for client-side state management, with separate stores for authentication, homeowner, and provider data.
- **Database Schema**: PostgreSQL database with Drizzle ORM managing `users`, `homes`, `providers`, `appointments`, `notifications`, `reviews`, `clients`, `jobs`, `invoices`, `payments`, and `maintenanceReminders` tables.
- **API Endpoints**: A comprehensive set of RESTful API endpoints for authentication, managing homes, appointments, notifications, AI chat, and all provider portal functionalities (clients, jobs, invoices, payments).

### Project Structure
- `client/`: Contains the Expo React Native application, including components, hooks, navigation, screens (auth, homeowner, provider), and state management.
- `server/`: Houses the Express.js backend, including server setup, routes, database connection, OpenAI client, and templates.
- `shared/`: Contains shared Drizzle schema definitions.

## External Dependencies
- **Supabase**: Provides PostgreSQL database hosting and connection pooling.
- **Drizzle ORM**: Used for type-safe interaction with the PostgreSQL database.
- **OpenAI GPT-4o-mini**: Integrated via Replit AI Integrations for the AI chat functionality.
- **Stripe**: Backend integration for payment processing, including product management, payment intents, customer creation, checkout sessions, and customer portals. Uses `stripe-replit-sync`.
- **RevenueCat**: Mobile subscription management using `react-native-purchases` for offerings, purchases, restores, and customer information.
- **Zustand**: Client-side state management library.
- **React Query**: Used for data fetching and caching in the client application, especially within the Provider Portal.
- **Expo**: Framework for building universal React applications.
- **Express.js**: Backend web application framework.