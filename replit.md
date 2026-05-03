# HomeBase - Unified Home Services App

## Overview
HomeBase is an iOS mobile application (built with Expo React Native) designed to be a unified platform for homeowners and service providers. Its primary purpose is to streamline home service management, encompassing tasks from finding and booking providers to managing client relationships, jobs, and invoicing. The application features a robust authentication system, distinct user portals, AI-powered assistance for home maintenance and service matching, and full CRUD operations. It integrates an Express.js backend with a PostgreSQL database to offer a comprehensive solution for the home services market.

## User Preferences
- No emojis in the app
- Only accent color #38AE5F, everything else neutral grayscale
- Liquid Glass styling for headers, tab bars, key cards, modals
- Clean, minimal design with proper spacing

## System Architecture
The application consists of a client-side React Native Expo app and an Express.js backend. The UI/UX features a "Liquid Glass" effect with frosted blur for key elements, supporting both Light and Dark modes. The primary accent color is `#38AE5F`, with all other elements using a neutral grayscale palette. Typography is based on SF Pro.

### Technical Implementations
- **Authentication & Access Control**: Backend-driven user management with email/password, JWT-like sessions, password reset, and distinct Guest, Homeowner, and Provider roles.
- **AI Integration**: Utilizes OpenAI GPT-4o-mini for home maintenance queries, property-specific context, service classification, question generation, price estimation, and provider matching.
- **HouseFax Intelligence Layer**: Property data enrichment using Zillow and Google Places/Geocoding for address data and property details, integrated into AI prompts.
- **Provider Features**: Includes a Provider Portal with CRM, schedule management, invoicing, Smart Provider Matching, Provider Capability Tags, AI Service Blueprint Wizard for custom services, recurring service management, and branded messaging (email/SMS) with booking links and customizable intake forms.
- **Homeowner Tools**: Features include a "Survival Kit" for maintenance plans, "HouseFax Ledger" for expense tracking and property history, "Home Health Score" assessment, and "Service History."
- **Data Management**: Full CRUD operations for appointments, clients, jobs, and invoices, with real-time tracking.
- **Payment Processing**: Integration with Stripe Connect for invoicing, payment processing, and platform fees.
- **Database**: PostgreSQL with Drizzle ORM, managing 39 tables including users, homes, providers, appointments, clients, jobs, invoices, and booking links.
- **API Endpoints**: A comprehensive RESTful API supports all application functionalities.
- **Onboarding & First-Launch Experience**: Animated onboarding flows tailored for Homeowners and Service Providers, allowing role selection and quick role switching.
- **Reset Password Flow**: Full password reset via email using JWT tokens and a styled in-app form.
- **iPad Responsive UI**: Implemented responsive layouts for iPad, including dynamic content width, optimized tab bar dimensions, and improved grid column layouts.
- **Stripe Webhook Architecture**: Features two webhook endpoints (`/api/stripe/webhook/platform` and `/api/stripe/webhook/connect`) for platform and Connect events, with a unified dispatcher for signature verification, idempotency, and connected-account resolution.

## Recent Changes
- 2026-05-03: Task #292 — Auto-generate recurring jobs on the calendar. New `job_series` table + `jobs.series_id` FK; `server/recurringJobsService.ts` materializes occurrences over a 90-day horizon (weekly/biweekly/monthly/quarterly), respects business-hours closed days, and is idempotent on (series, date). Daily 04:00 cron in `server/index.ts` extends horizons. `POST /api/jobs` auto-creates a series when the linked custom service is recurring. `PUT /api/jobs/:id?scope=following` edits this+future occurrences; `DELETE /api/jobs/:id?scope=series` cancels a whole series. New `GET /api/series/:id` and `POST /api/series/:id/cancel`. UI: schedule cards show a recurring icon, job detail offers "This Occurrence / Entire Series" cancel and a tappable badge linking to the new `SeriesDetailScreen` (lists upcoming + history of occurrences with cancel-series action). Idempotent backfill in `server/dbMigrations.ts` groups existing recurring jobs into series.
- 2026-05-02: New canonical design audit at `docs/homebase-design-audit-2026-05.md` supersedes the April 14 design audits; feeds the queued "HomeBase design fixes pass (P0 / P1 / P2)" task.

## External Dependencies
- **Supabase**: PostgreSQL database hosting.
- **Drizzle ORM**: Type-safe database interaction.
- **OpenAI GPT-4o-mini**: AI chat and intelligence.
- **Stripe Connect**: Marketplace payment processing, invoicing, and platform fees.
- **Resend**: Transactional email service.
- **RapidAPI (Real Estate 101)**: Zillow property data.
- **Google APIs**: Places Autocomplete and Geocoding.
- **Zustand**: Client-side state management.
- **React Query**: Data fetching and caching.
- **Expo**: React Native application framework.
- **Express.js**: Backend web application framework.