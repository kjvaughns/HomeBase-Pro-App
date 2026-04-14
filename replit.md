# HomeBase - Unified Home Services App

## Overview
HomeBase is an iOS mobile application (built with Expo React Native) designed to be a unified platform for homeowners and service providers. Its primary purpose is to streamline home service management, encompassing tasks from finding and booking providers to managing client relationships, jobs, and invoicing. The application features a robust authentication system, distinct user portals, AI-powered assistance for home maintenance and service matching, and full CRUD operations. It integrates an Express.js backend with a PostgreSQL database to offer a comprehensive solution for the home services market.

## User Preferences
- No emojis in the app
- Only accent color #38AE5F, everything else neutral grayscale
- Liquid Glass styling for headers, tab bars, key cards, modals
- Clean, minimal design with proper spacing

## System Architecture
The application consists of a client-side React Native Expo app (SDK 55, React Native 0.83.2, React 19.2.0) and an Express.js backend. The UI/UX features a "Liquid Glass" effect with frosted blur for key elements, supporting both Light and Dark modes. The primary accent color is `#38AE5F`, with all other elements using a neutral grayscale palette. Typography is based on SF Pro.

### Technical Implementations
- **Authentication & Access Control**: Backend-driven user management with email/password, JWT-like sessions, password reset, and distinct Guest, Homeowner, and Provider roles.
- **AI Integration**: "Ask HomeBase AI" utilizes OpenAI GPT-4o-mini for home maintenance queries and property-specific context. AI Smart Intake classifies service needs, generates questions, estimates prices, and matches providers. The Dynamic Quote Engine provides AI-powered price estimates.
- **HouseFax Intelligence Layer**: Property data enrichment using Zillow (via RapidAPI Real Estate 101) and Google Places/Geocoding for address data and property details, injected into AI prompts.
- **Provider Features**: Includes a Provider Portal with CRM, schedule management, invoicing, Smart Provider Matching based on trust scores, and Provider Capability Tags. Providers can create custom services via an AI Service Blueprint Wizard, manage recurring services, and send branded messages (email/SMS) to clients using templates, including blast messaging. Booking links allow for public booking pages with customizable intake forms.
- **Homeowner Tools**: Features like "Survival Kit" for maintenance plans, "HouseFax Ledger" for expense tracking and property history, "Home Health Score" assessment, and "Service History" for past services.
- **Data Management**: Full CRUD operations for appointments, clients, jobs, and invoices, with real-time tracking.
- **Payment Processing**: Integration with Stripe Connect for invoicing, payment processing, and platform fees, including checks for `chargesEnabled` status.
- **Database**: PostgreSQL with Drizzle ORM, managing 28 tables including users, homes, providers, appointments, clients, jobs, invoices, and booking links.
- **API Endpoints**: A comprehensive RESTful API supports all application functionalities, including authentication, home management, AI interactions, and provider portal features.
- **Onboarding & First-Launch Experience**: Animated onboarding flows tailored for Homeowners and Service Providers, allowing role selection before authentication and quick role switching post-onboarding.
- **Reset Password Flow**: Full password reset via email using JWT tokens (signed with `JWT_SECRET + ":password-reset"`, 1h expiry). GET `/reset-password` serves a styled HTML form; POST `/api/auth/reset-password` validates the token and bcrypt-hashes the new password.

## Feature Audit Fixes (April 2026)
- **POST /api/appointments/:id/update-condition**: Added missing route that updates the appointment `notes` field with a new condition description.
- **Service History**: Fixed `GET /api/homes/:homeId/service-history` to LEFT JOIN providers table so `providerName` is included in each entry; fixed `ServiceHistoryScreen.tsx` to fetch real API data, map appointments to `ServiceEntry` format, and implement real category filtering.
- **SurvivalKit**: Replaced static `MOCK_TASKS` with `generateTasksFromWizardData(wizardData)` function that generates personalized maintenance tasks based on wizard answers (HVAC age, roof age, climate, risks, yard, pool, deck, etc.).
- **SmartIntake AI**: Fixed auth gate to fire before the analyze API call, so unauthenticated users are blocked before any request is made.
- **AI Chat Auth Gate**: Fixed `AIChatScreen` to check auth and show `AccountGateModal` before calling authenticated `/api/chat/simple`.
- **ProfileEditScreen**: Removed misleading "Tap to change photo" hint that had no real upload functionality.
- **Forgot Password URL**: Fixed reset URL to use the request's own host rather than a hardcoded localhost.
- **Reset Password HTML**: Created `server/templates/reset-password.html` — a styled in-app form that extracts the token from query params and POSTs to `/api/auth/reset-password`.

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