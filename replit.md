# Homebase - Unified Home Services App

## Overview
Homebase is a unified iOS mobile app that combines homeowner and provider portals into one seamless experience. Built with Expo React Native and Express.js backend with Supabase PostgreSQL database.

## Current State
- **Version**: 1.3.0
- **Last Updated**: January 27, 2026
- **Status**: Complete Provider Portal MVP with database-backed clients, jobs, invoices, and payments

## Features Implemented

### Authentication System
- **Real Authentication Backend**: PostgreSQL-backed user management
  - Sign up with email/password (bcrypt hashing with 10 salt rounds)
  - Login with JWT-like session management
  - Password reset flow (forgot password screen ready for email integration)
  - Onboarding flow to add first property after signup

### Three Access States
1. **Guest Mode**: Browse marketplace, view providers, gated actions prompt sign-in
2. **Homeowner Mode**: Full access to Find, Manage bookings, Messages, More
3. **Provider Mode**: Dashboard, Clients CRM, Schedule (with List/Day/Week/Month views), Money management, More

### AI Features
- **Ask Homebase AI**: AI-powered chat assistant for home services questions
  - Uses OpenAI GPT-4o-mini via Replit AI Integrations
  - Provides instant answers about home maintenance, repairs, and finding providers
  - Suggested questions for quick access
  - Streaming-capable API (non-streaming endpoint used for mobile compatibility)

### Database-Backed Features
- **Appointments**: Full CRUD with status tracking (pending, confirmed, in_progress, completed, cancelled)
  - Create appointments through booking flow
  - View appointments in ManageScreen with sections (Upcoming, In Progress, Completed)
  - AppointmentDetailScreen with reschedule and cancel functionality
  - Real-time status updates
- **Notifications**: Database-stored notifications for booking updates
  - NotificationsScreen accessible from MoreScreen
  - Mark as read functionality
  - Navigation to related appointments
  - Automatic notification creation on booking events

### Provider Portal (NEW - Full Backend)
- **Dashboard**: Real-time stats (revenue MTD, jobs completed, active clients, upcoming jobs)
- **Clients CRM**: Full client management with search, add, detail views
  - ClientsScreen with search and list view
  - AddClientScreen for creating new clients
  - ClientDetailScreen with job/invoice history
- **Schedule**: Calendar views (List, Day, Week, Month) with real jobs data
  - AddJobScreen for creating jobs with client selection
  - Job status tracking (scheduled, in_progress, completed, cancelled)
- **Money/Invoices**: Complete invoicing system
  - MoneyScreen with revenue stats and invoice list
  - AddInvoiceScreen for creating invoices linked to clients/jobs
  - InvoiceDetailScreen for viewing, sending, marking paid, canceling
  - Invoice statuses: draft, sent, paid, overdue, cancelled

### Homeowner Tools
1. **Survival Kit**: Emergency preparedness checklist with progress tracking
2. **Health Score**: Home systems assessment dashboard
3. **HouseFax**: Property history and information
4. **Budgeter**: Home maintenance budget tracker

### Design System
- **Accent Color**: #38AE5F (the only accent color used)
- **Style**: Liquid Glass effect for iOS with frosted blur
- **Themes**: Light and Dark mode support
- **Typography**: SF Pro system font with defined type scale

### Components Built
- PrimaryButton, SecondaryButton (use `children` prop, not `label`)
- GlassCard with blur effect
- ListRow, StatusPill (use `status` prop, not `variant`)
- TextField with icons
- Avatar (use size="small"|"medium"|"large", not numeric values)
- EmptyState with illustrations
- SkeletonLoader for loading states
- CategoryCard, ProviderCard, BookingCard
- MessageRow, LeadCard, JobCard, StatCard
- AccountGateModal for authentication gating
- SectionHeader, FilterChips

### Screens Implemented

**Auth Screens:**
- WelcomeScreen - Landing page with sign in/sign up buttons
- LoginScreen - Email/password login connected to backend
- SignUpScreen - Registration with name, email, password
- ForgotPasswordScreen - Password reset flow
- OnboardingScreen - Add first property after signup

**Homeowner Portal:**
- FindScreen - AI chat card, Search, Homeowner Tools, Service categories, Featured providers
- ManageScreen - Real appointments from database with status sections
- MessagesScreen - Conversation list
- MoreScreen - Profile, notifications link, settings, become provider option
- AppointmentDetailScreen - View appointment details, reschedule, cancel
- NotificationsScreen - View and manage notifications

**Booking Flow (Database-Connected):**
- ProviderListScreen - Browse providers by category
- ProviderProfileScreen - Provider details and reviews
- BookingRequestScreen - Describe the job
- BookingScheduleScreen - Select date and time
- BookingAddressScreen - Select home address (fetches from API)
- BookingConfirmScreen - Creates real appointment in database
- BookingSuccessScreen - Confirmation with navigation to ManageScreen

**Homeowner Tools:**
- AIChatScreen, SurvivalKitScreen, HealthScoreScreen, HouseFaxScreen, BudgeterScreen

**Provider Portal (Database-Connected):**
- ProviderHomeScreen - Dashboard with real stats from API
- ClientsScreen - Client list with search, fetches from API
- AddClientScreen - Create new client form
- ClientDetailScreen - Client details with job/invoice history
- ScheduleScreen - Calendar views with real jobs from API
- AddJobScreen - Create job with client picker
- MoneyScreen - Revenue stats and invoice list from API
- AddInvoiceScreen - Create invoice linked to client/job
- InvoiceDetailScreen - View/manage invoice (send, mark paid, cancel)
- ProviderMoreScreen - Provider settings

## Database Schema

### Database Configuration
- **Provider**: Supabase (PostgreSQL)
- **Connection**: Uses connection pooler (Transaction mode) via SUPABASE_DATABASE_URL
- **ORM**: Drizzle ORM with SSL enabled
- **Pooler endpoint**: aws-1-us-east-2.pooler.supabase.com:5432

### Tables (PostgreSQL with Drizzle ORM)
- **users**: id, email, password, firstName, lastName, phone, isProvider, createdAt, updatedAt
- **homes**: id, userId, label (nickname), street (address), city, state, zip (zipCode), homeType, squareFeet, yearBuilt, bedrooms, bathrooms
- **providers**: id, userId, businessName, category, description, rating, reviewCount, hourlyRate, isVerified
- **appointments**: id, userId, homeId, providerId, serviceName, description, scheduledDate, scheduledTime, urgency, jobSize, estimatedPrice, status
- **notifications**: id, userId, title, message, type, isRead, data, createdAt
- **reviews**: id, appointmentId, userId, providerId, rating, comment, createdAt

**Provider Portal Tables:**
- **clients**: id, providerId, firstName, lastName, email, phone, address, notes, createdAt, updatedAt
- **jobs**: id, providerId, clientId, title, description, scheduledDate, scheduledTime, status, estimatedPrice, address, createdAt, updatedAt
- **invoices**: id, providerId, clientId, jobId, amount, status (draft/sent/paid/overdue/cancelled), dueDate, sentAt, paidAt, notes, createdAt
- **payments**: id, providerId, invoiceId, amount, paymentMethod, transactionId, createdAt

### Field Mappings
- **User**: Frontend uses `name`, backend stores as `firstName`/`lastName` (formatUserResponse helper)
- **Home**: Frontend uses `nickname`/`address`/`zipCode`, backend stores as `label`/`street`/`zip` (formatHomeResponse helper)

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Homes
- `GET /api/homes/:userId` - Get user's homes
- `POST /api/homes` - Create new home
- `PUT /api/homes/:id` - Update home
- `DELETE /api/homes/:id` - Delete home

### Appointments
- `GET /api/appointments/:userId` - Get user's appointments
- `GET /api/appointments/:id` - Get single appointment
- `POST /api/appointments` - Create appointment
- `PUT /api/appointments/:id` - Update appointment
- `POST /api/appointments/:id/cancel` - Cancel appointment
- `POST /api/appointments/:id/reschedule` - Reschedule appointment

### Notifications
- `GET /api/notifications/:userId` - Get user's notifications
- `POST /api/notifications/:id/read` - Mark notification as read

### AI Chat
- `POST /api/chat` - Streaming AI chat response (SSE)
- `POST /api/chat/simple` - Non-streaming AI chat response

### Provider Portal
**Provider Registration:**
- `POST /api/providers/register` - Register as provider (creates provider profile)
- `GET /api/providers/:userId` - Get provider by user ID

**Provider Stats:**
- `GET /api/provider/:providerId/stats` - Get dashboard stats (revenueMTD, jobsCompleted, activeClients, upcomingJobs)

**Clients:**
- `GET /api/provider/:providerId/clients` - Get provider's clients
- `GET /api/clients/:id` - Get single client with jobs/invoices
- `POST /api/clients` - Create new client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

**Jobs:**
- `GET /api/provider/:providerId/jobs` - Get provider's jobs
- `GET /api/jobs/:id` - Get single job
- `POST /api/jobs` - Create new job
- `PUT /api/jobs/:id` - Update job

**Invoices:**
- `GET /api/provider/:providerId/invoices` - Get provider's invoices
- `GET /api/invoices/:id` - Get single invoice
- `POST /api/invoices` - Create new invoice
- `PUT /api/invoices/:id` - Update invoice
- `POST /api/invoices/:id/send` - Send invoice (status -> sent)
- `POST /api/invoices/:id/mark-paid` - Mark invoice as paid
- `POST /api/invoices/:id/cancel` - Cancel invoice

**Payments:**
- `GET /api/provider/:providerId/payments` - Get provider's payments
- `POST /api/payments` - Record a payment

## Project Structure
```
client/
├── App.tsx                 # Root app component
├── components/             # Reusable UI components
├── constants/theme.ts      # Colors, spacing, typography
├── hooks/                  # Custom React hooks
├── lib/query-client.ts     # API client (apiRequest helper)
├── navigation/             # Navigation configuration
├── screens/
│   ├── auth/              # Authentication screens
│   ├── homeowner/         # Homeowner portal screens
│   └── provider/          # Provider portal screens
└── state/
    ├── authStore.ts       # Zustand auth state with AsyncStorage
    ├── homeownerStore.ts  # Homeowner state
    ├── providerStore.ts   # Provider state
    └── types.ts           # TypeScript types

server/
├── index.ts               # Express server setup
├── routes.ts              # API routes
├── storage.ts             # DatabaseStorage with IStorage interface
├── db.ts                  # Drizzle database connection
├── openai.ts              # OpenAI client configuration
└── templates/             # Web templates

shared/
└── schema.ts              # Drizzle schema definitions
```

## Running the App
1. Backend: `npm run server:dev` (port 5000)
2. Frontend: `npm run expo:dev` (port 8081)
3. Database: PostgreSQL via DATABASE_URL environment variable

## User Preferences
- No emojis in the app
- Only accent color #38AE5F, everything else neutral grayscale
- Liquid Glass styling for headers, tab bars, key cards, modals
- Clean, minimal design with proper spacing

## Recent Updates (January 27, 2026)
- **Provider Portal Backend**: Complete data model with clients, jobs, invoices, payments tables
- **Provider Dashboard**: Real-time stats from database (revenue MTD, jobs completed, active clients)
- **Clients CRM**: Full CRUD with search, detail views including job/invoice history
- **Job Management**: Create jobs with client picker, calendar views with real data
- **Invoice System**: Create, send, mark paid, cancel invoices with full status tracking
- **React Query Integration**: All Provider Portal screens use react-query for data fetching
- **Navigation Routes**: AddClient, AddJob, AddInvoice, InvoiceDetail screens added

## Technical Notes
- **StatusPill**: Use `status` prop (not `variant`): "success", "info", "warning", "neutral", "cancelled"
- **Buttons**: Use `children` for label: `<PrimaryButton>Click Me</PrimaryButton>`
- **Avatar**: Use size="small"|"medium"|"large" (not numeric)
- **apiRequest**: Takes (method, route, data?) params
- **React Query Keys**: Provider data uses pattern `["/api/provider", providerId, resource]`
- **Date Handling**: Backend converts ISO strings to Date objects for Drizzle ORM
- **Provider Stats Calculation**: revenueMTD from paid invoices this month, jobsCompleted, activeClients (unique), upcomingJobs
- **Expo Web**: Known compatibility issues in Replit browser - test on mobile via Expo Go

## Next Steps (Phase 2+)
- Real-time messaging with WebSockets
- Push notifications (expo-notifications)
- Payment processing integration (Stripe)
- Provider approval workflow
- Email notifications for password reset
- Job status change notifications for providers
