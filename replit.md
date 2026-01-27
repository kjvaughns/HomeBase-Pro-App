# Homebase - Unified Home Services App

## Overview
Homebase is a unified iOS mobile app that combines homeowner and provider portals into one seamless experience. Built with Expo React Native and Express.js backend with PostgreSQL database.

## Current State
- **Version**: 1.2.0
- **Last Updated**: January 27, 2026
- **Status**: Complete UI/UX with database-backed authentication, booking, and notifications

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

**Provider Portal:**
- ProviderHomeScreen, ClientsScreen, ClientDetailScreen, ScheduleScreen, MoneyScreen, ProviderMoreScreen

## Database Schema

### Tables (PostgreSQL with Drizzle ORM)
- **users**: id, email, password, firstName, lastName, phone, isProvider, createdAt, updatedAt
- **homes**: id, userId, label (nickname), street (address), city, state, zip (zipCode), homeType, squareFeet, yearBuilt, bedrooms, bathrooms
- **providers**: id, userId, businessName, category, description, rating, reviewCount, hourlyRate, isVerified
- **appointments**: id, userId, homeId, providerId, serviceName, description, scheduledDate, scheduledTime, urgency, jobSize, estimatedPrice, status
- **notifications**: id, userId, title, message, type, isRead, data, createdAt
- **reviews**: id, appointmentId, userId, providerId, rating, comment, createdAt

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
- **Full Authentication System**: Sign up, login, forgot password screens connected to PostgreSQL backend
- **Onboarding Flow**: Add first property after signup
- **Database-Connected Booking Flow**: Complete flow from provider selection to appointment creation
- **Appointment Management**: ManageScreen shows real appointments, AppointmentDetailScreen for viewing/rescheduling/canceling
- **Notification System**: NotificationsScreen with database-backed notifications, mark as read, navigation to appointments
- **API Endpoints**: Full REST API for auth, homes, appointments, notifications
- **Field Mapping Helpers**: formatUserResponse, formatHomeResponse for frontend/backend compatibility
- **Component Prop Fixes**: StatusPill uses `status` prop, buttons use `children`, Avatar uses string sizes

## Technical Notes
- **StatusPill**: Use `status` prop (not `variant`): "success", "info", "warning", "neutral", "cancelled"
- **Buttons**: Use `children` for label: `<PrimaryButton>Click Me</PrimaryButton>`
- **Avatar**: Use size="small"|"medium"|"large" (not numeric)
- **apiRequest**: Takes (method, route, data?) params
- **Expo Web**: Known compatibility issues in Replit browser - test on mobile via Expo Go

## Next Steps (Phase 2+)
- Real-time messaging with WebSockets
- Push notifications (expo-notifications)
- Payment processing integration
- Provider approval workflow
- Email notifications for password reset
