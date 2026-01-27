# Homebase - Unified Home Services App

## Overview
Homebase is a unified iOS mobile app that combines homeowner and provider portals into one seamless experience. Built with Expo React Native and Express.js backend.

## Current State
- **Version**: 1.1.0
- **Last Updated**: January 27, 2026
- **Status**: Complete UI/UX implementation with AI features and homeowner tools

## Features Implemented

### Three Access States
1. **Guest Mode**: Browse marketplace, view providers, gated actions prompt sign-in
2. **Homeowner Mode**: Full access to Find, Manage bookings, Messages, More
3. **Provider Mode**: Dashboard, Leads, Schedule, Money management, More

### AI Features
- **Ask Homebase AI**: AI-powered chat assistant for home services questions
  - Uses OpenAI GPT-4o-mini via Replit AI Integrations
  - Provides instant answers about home maintenance, repairs, and finding providers
  - Suggested questions for quick access
  - Streaming-capable API (non-streaming endpoint used for mobile compatibility)

### Homeowner Tools
1. **Survival Kit**: Emergency preparedness checklist with progress tracking
   - Categories: Water & Food, Power & Light, First Aid & Medical, Documents
   - Interactive checklist with completion percentage
2. **Health Score**: Home systems assessment dashboard
   - Overall home health score
   - Individual system scores (HVAC, Plumbing, Electrical, Roof, Appliances, Safety)
   - Status indicators and service dates
3. **HouseFax**: Property history and information
   - Property details (address, year built, sq ft, beds/baths)
   - Property value tracking with appreciation percentage
   - Timeline of property events (purchases, renovations, repairs, permits)
4. **Budgeter**: Home maintenance budget tracker
   - Monthly budget summary with progress bar
   - Category-based budgeting (Repairs, Utilities, Landscaping, Cleaning, Upgrades, Emergency)
   - Recent transactions list

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
- CategoryCard (with compact mode), ProviderCard, BookingCard
- MessageRow, LeadCard, JobCard, StatCard
- AccountGateModal for authentication gating
- SectionHeader

### Screens Implemented

**Homeowner Portal:**
- FindScreen - AI chat card, Search, Homeowner Tools, Service categories, Featured providers
- ManageScreen - Booking list with status indicators
- MessagesScreen - Conversation list
- MoreScreen - Profile, settings, become provider option

**Homeowner Tools:**
- AIChatScreen - AI assistant with suggested questions and conversation interface
- SurvivalKitScreen - Emergency preparedness checklist
- HealthScoreScreen - Home systems health assessment
- HouseFaxScreen - Property history and information
- BudgeterScreen - Home maintenance budget tracking

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
- Stack navigation for AI chat and homeowner tools

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
│   │   ├── FindScreen.tsx
│   │   ├── AIChatScreen.tsx
│   │   ├── SurvivalKitScreen.tsx
│   │   ├── HealthScoreScreen.tsx
│   │   ├── HouseFaxScreen.tsx
│   │   └── BudgeterScreen.tsx
│   └── provider/          # Provider portal screens
└── state/
    ├── authStore.ts       # Zustand auth state
    └── mockData.ts        # Mock data for development

server/
├── index.ts               # Express server setup
├── routes.ts              # API routes (includes /api/chat endpoints)
├── openai.ts              # OpenAI client configuration
└── templates/
    └── landing-page.html  # Web landing page

assets/
└── images/                # App icons, empty states, illustrations
```

## API Endpoints
- `POST /api/chat` - Streaming AI chat response (SSE)
- `POST /api/chat/simple` - Non-streaming AI chat response (JSON)

## Running the App
1. Backend: `npm run server:dev` (port 5000)
2. Frontend: `npm run expo:dev` (port 8081)

## User Preferences
- No emojis in the app
- Only accent color #38AE5F, everything else neutral grayscale
- Liquid Glass styling for headers, tab bars, key cards, modals
- Clean, minimal design with proper spacing

## Recent Updates (January 27, 2026)
- Fixed infinite loop issues in Zustand selectors across 9+ screens by using useMemo with direct array access
- Pattern: `const items = useStore(s => s.items); const item = useMemo(() => items.find(...), [items, id]);`
- All screens now properly use Zustand store data instead of mockData imports
- Complete booking flow tested and working: category → providers → profile → sign-in → request → schedule
- Developer feature: Long-press on JobDetailScreen advances job through status lifecycle for testing

## Next Steps (Phase 2+)
- Real authentication backend (Replit Auth with Apple, Google, email)
- Database integration for bookings, messages, leads
- Payment processing integration
- Real-time messaging
- Push notifications
- Provider approval workflow
- Persistent storage for checklist progress and budget data
