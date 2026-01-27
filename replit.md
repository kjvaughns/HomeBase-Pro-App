# Homebase - Unified Home Services App

## Overview
Homebase is an iOS mobile application built with Expo React Native, featuring a unified platform for homeowners and service providers. It aims to streamline home service management, from finding providers and booking appointments to managing client relationships, jobs, and invoicing. The application integrates an Express.js backend with a Supabase PostgreSQL database to offer a comprehensive solution for the home services market. Key capabilities include a robust authentication system, distinct homeowner and provider portals, AI-powered assistance, and full CRUD operations for appointments, clients, jobs, and invoices.

## User Preferences
- No emojis in the app
- Only accent color #38AE5F, everything else neutral grayscale
- Liquid Glass styling for headers, tab bars, key cards, modals
- Clean, minimal design with proper spacing

## System Architecture
The application is structured into a client-side React Native Expo app and an Express.js backend. The UI/UX features a "Liquid Glass" effect for iOS, incorporating frosted blur for key elements, and supports both Light and Dark modes. The primary accent color is `#38AE5F`, with all other elements utilizing a neutral grayscale palette. Typography is based on SF Pro with a defined type scale.

### Technical Implementations
- **Authentication**: Backend-driven user management with email/password signup (bcrypt hashing), JWT-like session management, and a password reset flow. Includes an onboarding process for first property setup.
- **Access Control**: Three distinct access states: Guest Mode, Homeowner Mode, and Provider Mode, each with tailored functionalities.
- **AI Integration**: "Ask Homebase AI" feature leverages OpenAI GPT-4o-mini via Replit AI Integrations for instant answers on home maintenance and repairs.
- **Data Management**: Full CRUD operations for appointments, clients, jobs, and invoices, with real-time status tracking and notifications.
- **Provider Portal**: Comprehensive dashboard displaying real-time statistics (revenue MTD, jobs completed, active clients), a Clients CRM, Schedule management with various calendar views, and a complete invoicing system.
- **Homeowner Tools**: Includes a Survival Kit, Home Health Score, HouseFax for property history, and a Budgeter.
- **Design System**: Reusable UI components like `PrimaryButton`, `GlassCard`, `ListRow`, `StatusPill`, `TextField`, `Avatar`, `EmptyState`, `SkeletonLoader`, and various cards for categories, providers, bookings, messages, and stats.
- **State Management**: Uses Zustand for client-side state management, with separate stores for authentication, homeowner, and provider data.
- **Database Schema**: PostgreSQL database with Drizzle ORM managing `users`, `homes`, `providers`, `appointments`, `notifications`, `reviews`, `clients`, `jobs`, `invoices`, and `payments` tables.
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