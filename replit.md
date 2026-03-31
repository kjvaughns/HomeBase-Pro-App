# HomeBase - Unified Home Services App

## Overview
HomeBase is an iOS mobile application built with Expo React Native, providing a unified platform for homeowners and service providers. It aims to simplify home service management, from finding and booking providers to managing client relationships, jobs, and invoicing. The application integrates an Express.js backend with a PostgreSQL database, offering a comprehensive solution for the home services market with a robust authentication system, distinct user portals, AI-powered assistance, and full CRUD operations.

## User Preferences
- No emojis in the app
- Only accent color #38AE5F, everything else neutral grayscale
- Liquid Glass styling for headers, tab bars, key cards, modals
- Clean, minimal design with proper spacing

## System Architecture
The application comprises a client-side React Native Expo app (SDK 55, React Native 0.83.2, React 19.2.0) and an Express.js backend. The UI/UX features a "Liquid Glass" effect with frosted blur for key elements, supporting both Light and Dark modes. The primary accent color is `#38AE5F`, with all other elements using a neutral grayscale palette. Typography is based on SF Pro.

### Technical Implementations
- **Authentication**: Backend-driven user management with email/password signup, JWT-like session management, and password reset. Includes onboarding for first property setup.
- **Access Control**: Three distinct states: Guest, Homeowner, and Provider, each with tailored functionalities.
- **AI Integration**: "Ask HomeBase AI" uses OpenAI GPT-4o-mini via Replit AI Integrations for home maintenance queries. AI chat endpoints accept optional `homeId` for property-specific context.
- **HouseFax Intelligence Layer**: Property data enrichment system combining Zillow API (via RapidAPI Real Estate 101) and Google Places/Geocoding APIs for address autocomplete, normalization, and property details. HouseFax data is injected into AI system prompts.
- **AI Smart Intake**: AI analyzes natural language problem descriptions to classify service categories, generate follow-up questions, estimate price ranges, and match providers.
- **Dynamic Quote Engine**: AI-powered price estimates based on service type, home data, location, and complexity.
- **Smart Provider Matching**: Algorithm ranks providers using trust scores to show curated matches.
- **Provider Capability Tags**: Skill-based tags displayed on provider cards.
- **Service Summary Cards**: AI-generated scope of work summaries for booking.
- **Data Management**: Full CRUD for appointments, clients, jobs, and invoices, with real-time tracking.
- **Provider Portal**: Dashboard with real-time statistics, Clients CRM (with search, filter, sort, and quick actions), Schedule management, and an invoicing system. The `ClientDetailScreen` includes Overview, Jobs, Invoices, Notes, and Home (HouseFax) tabs.
- **Homeowner Tools**:
    - **Survival Kit**: Guided wizard for property details, generating personalized maintenance plans, cost estimates, and tips.
    - **HouseFax Ledger**: Home operating system with multi-home support, tracking expenses, maintenance history, assets, documents, and insights.
    - **Home Health Score**: Assessment wizard providing a score, risks, and action plans.
    - **Service History**: Timeline and Providers tabs for tracking past services.
    - **Saved Providers**: List of favorited providers with search and sort.
- **Help Center**: FAQ and Contact Us sections.
- **Design System**: Reusable UI components for consistent design.
- **State Management**: Uses Zustand for client-side state.
- **First-Launch Experience**: Animated welcome screen with logo reveal and smooth transitions. New users select account type (Homeowner or Service Provider) BEFORE authentication, then see tailored 3-step onboarding flows. Returning users skip directly to their appropriate dashboard.
- **Onboarding Flows**: Separate animated onboarding for each role - Homeowners set priorities and see tool highlights, Providers see business features and Stripe Connect teaser. Progress indicators and staggered animations throughout.
- **Role Gateway**: After onboarding, quick role switching available between Homeowner and Provider views.
- **Booking Links**: Providers can create public booking pages with customizable intake forms, AI quote generation, deposit support, and custom questions.
- **Database Schema**: PostgreSQL database with Drizzle ORM managing 25 tables including `users`, `homes`, `providers`, `appointments`, `clients`, `jobs`, `invoices`, `bookingLinks`, and `intakeSubmissions`. The `providers` table includes `businessHours` (jsonb), `bookingPolicies` (jsonb), `serviceRadius`, `serviceZipCodes` (text[]), `serviceCities` (text[]), and `isPublic` fields for the Business Hub feature.
- **API Endpoints**: Comprehensive RESTful API for authentication, home management, appointments, notifications, AI chat, booking links, and all provider portal functionalities.

## External Dependencies
- **Supabase**: PostgreSQL database hosting. Connected via `SUPABASE_DATABASE_URL` (session-mode pooler URL for IPv4 connectivity). All 25 tables are live. `drizzle.config.ts` uses `SUPABASE_DATABASE_URL` first, falls back to `DATABASE_URL`.
- **Drizzle ORM**: Type-safe database interaction.
- **OpenAI GPT-4o-mini**: AI chat functionality.
- **Stripe Connect**: Marketplace payment integration for invoicing, payment processing, platform fees, and credits wallet.
- **Resend**: Transactional email service for invoice delivery.
- **RevenueCat**: Mobile subscription management.
- **RapidAPI (Real Estate 101)**: Zillow property data.
- **Google APIs**: Places Autocomplete and Geocoding APIs.
- **Zustand**: Client-side state management.
- **React Query**: Data fetching and caching.
- **Expo**: React Native application framework.
- **Express.js**: Backend web application framework.

## Production API Configuration
- **Backend API domain**: `api.homebaseproapp.com` (set as `EXPO_PUBLIC_DOMAIN` in the mobile app build)
- **`getApiUrl()`**: Helper in `client/lib/query-client.ts` strips any protocol prefix from `EXPO_PUBLIC_DOMAIN` before constructing `https://` URLs — prevents double-protocol malformed URLs
- **EAS build profiles**: All four profiles (`development`, `development-simulator`, `preview`, `production`) use bare `api.homebaseproapp.com` (no protocol) as `EXPO_PUBLIC_DOMAIN`
- **Custom domain setup**: After publishing on Replit, add `api.homebaseproapp.com` as a custom domain in Replit deployment settings pointing to the Express backend. Until mapped, the Replit autoscale URL (`*.replit.app`) serves as fallback.
- **Verification script**: `./scripts/verify-api.sh [API_URL]` — checks `/api/health` (200) and `/api/auth/me` unauth (401)

## Verified API Endpoints (tested 2026-03-31, Express + Supabase)
- `GET /api/health` → `{"status":"ok","timestamp":"..."}` (no auth required)
- `GET /api/auth/me` (unauthenticated) → HTTP 401
- `POST /api/auth/login` with valid credentials → JWT token + user object
- `GET /api/auth/me` (authenticated with Bearer token) → user email and profile
- Test account credentials are stored in the Replit Secrets (do not commit to code)

## Invoice System
- **Line items**: `AddInvoiceScreen` supports multiple line items (description, qty, unit price) with auto-calculated totals
- **Backend**: `POST /api/invoices/create-and-send` and `POST /api/invoices` both accept `lineItems[]` arrays, calculate total from items, store as JSON in `line_items` column
- **Invoice detail**: `InvoiceDetailScreen` shows invoice number, line items breakdown, paid date (`paidAt`), and actions (send, mark paid, cancel)
- **Email**: Resend connector sends itemized invoice emails; `GET /api/invoices/:id/checkout` creates Stripe hosted checkout session for client payment