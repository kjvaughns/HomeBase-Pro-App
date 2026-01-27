# Homebase - Unified Home Services App

## Overview
Homebase is a unified iOS mobile app that combines homeowner and provider portals into one seamless experience. Built with Expo React Native and Express.js backend.

## Current State
- **Version**: 1.0.0
- **Last Updated**: January 27, 2026
- **Status**: Complete UI/UX implementation with mock data

## Features Implemented

### Three Access States
1. **Guest Mode**: Browse marketplace, view providers, gated actions prompt sign-in
2. **Homeowner Mode**: Full access to Find, Manage bookings, Messages, More
3. **Provider Mode**: Dashboard, Leads, Schedule, Money management, More

### Design System
- **Accent Color**: #38AE5F (the only accent color used)
- **Style**: Liquid Glass effect for iOS with frosted blur
- **Themes**: Light and Dark mode support
- **Typography**: SF Pro system font with defined type scale

### Components Built
- PrimaryButton, SecondaryButton
- GlassCard with blur effect
- ListRow, StatusPill
- TextField with icons
- Avatar with initials fallback
- EmptyState with illustrations
- SkeletonLoader for loading states
- CategoryCard, ProviderCard, BookingCard
- MessageRow, LeadCard, JobCard, StatCard
- AccountGateModal for authentication gating
- SectionHeader

### Screens Implemented

**Homeowner Portal:**
- FindScreen - Service categories, featured providers, search
- ManageScreen - Booking list with status indicators
- MessagesScreen - Conversation list
- MoreScreen - Profile, settings, become provider option

**Provider Portal:**
- ProviderHomeScreen - Dashboard with stats and upcoming jobs
- LeadsScreen - Lead cards with contact/decline actions
- ScheduleScreen - Job list with filter tabs
- MoneyScreen - Earnings, balance, transaction history
- ProviderMoreScreen - Business settings, role switching

**Shared Screens:**
- RoleSwitchConfirmationScreen - Confirmation before switching roles
- BecomeProviderScreen - Provider onboarding flow

### Navigation Architecture
- **Floating Liquid Glass Tab Bar**: Pill-shaped, floating nav bar with rounded corners (24px radius)
  - Positioned 24px from bottom, 16px from sides
  - Semi-transparent glass background with subtle border
  - BlurView on iOS, solid rgba background on web
- Role-based tab bars that change based on authentication and active role
- Homeowner tabs: Find, Manage, Messages (when auth'd), More
- Provider tabs: Home, Leads, Schedule, Money, More
- Modal presentations for role switching and account gate

## Project Structure
```
client/
├── App.tsx                 # Root app component
├── components/             # Reusable UI components
├── constants/
│   └── theme.ts           # Colors, spacing, typography
├── hooks/                  # Custom React hooks
├── lib/
│   └── query-client.ts    # API client configuration
├── navigation/            # Navigation configuration
│   ├── RootStackNavigator.tsx
│   ├── HomeownerTabNavigator.tsx
│   └── ProviderTabNavigator.tsx
├── screens/
│   ├── homeowner/         # Homeowner portal screens
│   └── provider/          # Provider portal screens
└── state/
    ├── authStore.ts       # Zustand auth state
    └── mockData.ts        # Mock data for development

server/
├── index.ts               # Express server setup
├── routes.ts              # API routes
└── templates/
    └── landing-page.html  # Web landing page

assets/
└── images/                # App icons, empty states, illustrations
```

## Running the App
1. Backend: `npm run server:dev` (port 5000)
2. Frontend: `npm run expo:dev` (port 8081)

## User Preferences
- No emojis in the app
- Only accent color #38AE5F, everything else neutral grayscale
- Liquid Glass styling for headers, tab bars, key cards, modals
- Clean, minimal design with proper spacing

## Next Steps (Phase 2+)
- Real authentication backend (Replit Auth with Apple, Google, email)
- Database integration for bookings, messages, leads
- Payment processing integration
- Real-time messaging
- Push notifications
- Provider approval workflow
