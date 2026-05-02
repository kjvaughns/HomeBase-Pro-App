# Threat Model

## Project Overview

HomeBase is a production Express.js API with an Expo React Native client for homeowners and service providers. Users create accounts, manage homes, jobs, appointments, clients, invoices, provider profiles, booking links, communications, notifications, and payments. The backend uses PostgreSQL/Supabase via Drizzle, JWT bearer/cookie authentication, Stripe Connect and Stripe webhooks, RevenueCat webhooks, OpenAI, Resend, Expo push notifications, Google/RapidAPI property lookups, and optional Supabase object storage.

Production scope assumes `NODE_ENV=production`, TLS is provided by the deployment platform, and mockup/dev-only scripts or sandbox assets are not deployed unless production reachability is demonstrated.

## Assets

- **User accounts and sessions** -- emails, password hashes, reset tokens, JWTs, token versions, roles, and account state. Compromise permits impersonation and access to homeowner/provider data.
- **Homeowner PII and property data** -- names, phone numbers, home addresses, home profiles, property enrichment results, HouseFax entries, budgets, service history, payment preferences, and notification preferences.
- **Provider business data** -- provider profiles, availability, service definitions, logos, client lists, leads, jobs, invoices, payout/payment views, booking links, communications, reviews, and subscription state.
- **Payment and subscription data** -- Stripe customer IDs, Connect account IDs, invoice/payment IDs, credits, fees, webhook events, RevenueCat entitlement events, and provider subscription state. Raw card data should remain with Stripe/RevenueCat.
- **Application secrets** -- database URLs, JWT secret, Stripe keys and webhook secrets, RevenueCat webhook secrets, OpenAI/Resend/Google/RapidAPI credentials, Supabase service keys, and Expo push credentials.
- **Operational integrity** -- logs, webhook idempotency, notification delivery records, and background migration/cron processing.

## Trust Boundaries

- **Mobile/web client to API** -- all client requests are untrusted. The API must authenticate and authorize every route that reads or mutates account, home, provider, job, invoice, payment, or communication data.
- **Public internet to public API endpoints** -- signup, login, password reset, public provider listings, public booking pages/submissions, support ticket submission, onboarding AI helpers, Stripe/RevenueCat webhooks, and redirect pages are reachable without user authentication. They require rate limiting, abuse controls, input validation, and service-specific signature validation where applicable.
- **Authenticated user to owned resources** -- authenticated homeowners and providers must only access resources they own or are explicitly associated with. Route parameters such as `userId`, `homeId`, `providerId`, `jobId`, `invoiceId`, `clientId`, `leadId`, and `bookingLinkId` are attacker-controlled and require server-side ownership checks.
- **Provider/admin boundary** -- provider-only operations must verify the authenticated user owns the provider profile; admin provider-partner operations must require a server-side admin role check.
- **API to PostgreSQL/Supabase** -- database access must use parameterized Drizzle/sql templates, avoid string-built SQL, and avoid overbroad result exposure.
- **API to Stripe/RevenueCat** -- webhook requests must be cryptographically verified and idempotent; payment and subscription changes must not trust unauthenticated client-supplied status or amount data.
- **API to OpenAI and property-data providers** -- user-supplied prompts, home details, provider business details, and job descriptions cross into third-party processors. The API must minimize sensitive data and prevent unauthenticated cost abuse.
- **API to email/push notification providers** -- recipient addresses, push tokens, and message content must be scoped to the acting user/provider and must not leak in logs or responses.
- **API to filesystem/object storage** -- uploaded photos/logos and generated static pages must validate content type, size, names, storage paths, and authorization before serving or persisting.

## Scan Anchors

- **Production entry points**: `server/index.ts` starts the Express app, registers Stripe raw-body webhooks, body parsing, CORS, static serving, redirects, API routes, cron jobs, and production startup checks. `server/routes.ts` contains the main REST API. `server/auth.ts` implements JWT verification and token revocation checks.
- **High-risk backend areas**: authentication/password reset/account deletion (`server/routes.ts` lines ~1180-1785), resource ownership checks across homes/appointments/jobs/clients/invoices/provider routes, public booking and lead/message submission routes (`server/routes.ts` lines ~12025-12493 and ~12703-13675), payments/Stripe/RevenueCat (`server/routes.ts` lines ~9818-11884 plus `server/stripe*`, `server/revenuecatService.ts`, `server/stripeWebhookRouter.ts`), file uploads (`server/routes.ts` job photos/logo endpoints), notification/email (`server/notificationService.ts`, `server/emailService.ts`), AI endpoints (`server/openai.ts`, AI routes around ~4796-6166), and storage/DB helpers (`server/storage.ts`, `shared/schema.ts`).
- **Public unauthenticated surfaces**: health check, signup/login/password reset, provider resources/categories/services/providers, public provider/profile/booking pages, public booking submissions, public support ticket, onboarding AI helper endpoints, Stripe config/products/fee-preview, Stripe platform/connect webhooks in `server/index.ts`, and RevenueCat webhook in `server/routes.ts`.
- **Authenticated surfaces**: homes, HouseFax, appointments, notifications, chat, AI assistants, provider profile/settings, provider clients/jobs/invoices/payments, homeowner payment methods, credits, booking links, leads, messages, and templates.
- **Admin surfaces**: `/api/admin/providers`, `/api/admin/providers/:providerId/partner`, and corresponding delete route must retain `requireAdmin` after `requireAuth`.
- **Usually out of scope**: `server/scripts/*`, Expo/dev tooling, attached assets, mock data, generated `server_dist/*` when the same issue is not present in source, local-only development fallbacks, and localhost CORS allowance under production assumptions.

## Threat Categories

### Spoofing

Attackers may try to impersonate users with forged/stolen JWTs, reset tokens, webhook requests, RevenueCat entitlement events, or Stripe webhook payloads. Production must require a configured `JWT_SECRET`, validate token signatures/expiration and token version on protected routes, hash passwords appropriately, verify webhook signatures/secrets before mutating payment/subscription state, and avoid trusting client-supplied user/provider IDs as proof of identity.

### Tampering

Users can tamper with request bodies, route parameters, prices, invoice statuses, provider IDs, booking link slugs, uploaded files, and payment/subscription statuses. The backend must validate all inputs with schemas or explicit checks, compute payment amounts and platform fees server-side, enforce state-machine transitions for appointments/jobs/invoices, and reject unauthorized updates even when the client UI would normally hide them.

### Repudiation

Payment, subscription, invoice, booking, account security, and message-broadcast actions need enough durable records to resolve disputes. Logs should identify event IDs or internal record IDs without exposing sensitive payloads, and webhook processing must be idempotent to avoid duplicate financial or notification effects.

### Information Disclosure

The API stores and processes addresses, emails, phone numbers, home details, job notes, client lists, invoices, payments, Stripe account IDs, and OpenAI prompts. Responses must be ownership-scoped, public provider/booking endpoints must only expose intentionally public fields, errors must not leak secrets or stack traces, and production logs must avoid unnecessary PII or secret-like identifiers.

### Denial of Service

Unauthenticated endpoints for auth, support tickets, public booking submissions, webhook receivers, and onboarding AI helpers can be abused for traffic amplification, email/push spam, database growth, or third-party API/OpenAI/Stripe cost. Body size limits, validation, idempotency, rate limiting, bounded pagination, and external-call timeouts are required for production resilience.

### Elevation of Privilege

The main risk is broken access control/IDOR through user-controlled IDs across homes, providers, clients, jobs, invoices, credits, payment methods, leads, messages, and booking links. Every handler must verify that `req.authenticatedUserId` owns or is permitted to access the target record; admin functionality must enforce server-side admin role checks; provider-only actions must not be reachable by homeowners or other providers.
