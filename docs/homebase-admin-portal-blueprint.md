# HomeBase Admin Portal — Technical Blueprint & Lovable Prompt

> Generated: 2026-05-13 | Verified against codebase as of commit a0b57d4
> Purpose: Complete reference for building a standalone HomeBase Admin Portal that connects to the existing Express.js backend API.
> Note: Endpoint paths and response field names were verified against `server/routes.ts`. As the backend evolves, re-verify Section A and the Lovable prompt against the live routes file before building.

---

# SECTION A — Current Backend Structure Summary

**Runtime:** Express.js (TypeScript) running on port 5000. Compiled to `server_dist/index.js` for production.

**Database:** PostgreSQL hosted on Supabase, accessed via Drizzle ORM. Schema defined in `shared/schema.ts`. ~39 tables.

**Authentication:** JWT Bearer tokens. Middleware `authenticateJWT` in `server/auth.ts` validates signatures and checks `tokenVersion` for revocation. Three roles:
- **Homeowner** — default authenticated user
- **Provider** — `users.isProvider = true` + a row in `providers` table
- **Admin** — `users.isAdmin = true` (or email in `ADMIN_EMAILS` env var)

**Existing Admin API Endpoints** (all behind `requireAuth + requireAdmin`):
- `GET /api/admin/providers` — list/search providers with partner status, isPartner, partnerSince
- `POST /api/admin/providers/:providerId/partner` — grant HomeBase Partner status
- `DELETE /api/admin/providers/:providerId/partner` — revoke HomeBase Partner status
- `POST /api/admin/providers/:providerId/plan/fees` — set custom platform fee rates (platformFeePercent, platformFeeFixedCents)
- `POST /api/users/:userId/credits/add` — manually add user credits (admin-gated, lives under `/api/users/` not `/api/admin/`)
- `POST /api/providers/:providerId/activate-subscription` — force-activate a provider subscription (admin-gated, non-`/api/admin/` path)
- `POST /api/payments` — create a payment record directly (admin-gated)

> **Important:** Not all admin-gated endpoints live under `/api/admin/*`. The credits and subscription-activation endpoints use non-admin URL prefixes but are protected by `requireAdmin` middleware. The Lovable portal must use the exact paths above when calling these endpoints.

**Notification Channels:**
- **Email** via Resend (`server/emailService.ts`)
- **Push** via Expo Push API (`server/notificationService.ts → sendPush`)
- **In-App** stored in `notifications` table
- **SMS** — NOT implemented (placeholder stubs only)

**Subscription Model:** Trial → Grace Period (7 days after first paid booking) → Expired. Managed via `provider_plans` table. `is_partner = true` bypasses all billing gates permanently.

---

# SECTION B — Exact Tables by Domain

### Users
| Table | Key Fields |
|-------|-----------|
| `users` | `id`, `email`, `password`, `firstName`, `lastName`, `isProvider`, `isAdmin`, `stripeCustomerId`, `tokenVersion`, `createdAt` |

### Homeowners
| Table | Key Fields |
|-------|-----------|
| `homes` | `id`, `userId`, `street`, `city`, `state`, `zip`, `propertyType`, `estimatedValue`, `housefaxScore` |
| `housefax_entries` | `id`, `homeId`, `appointmentId`, `jobId`, `providerId` |
| `maintenance_reminders` | `id`, `homeId`, `userId`, `nextDueAt`, `isActive` |
| `user_credits` | `id`, `userId`, `balanceCents` |
| `credit_ledger` | `id`, `userId`, `deltaCents`, `reason` |

### Providers
| Table | Key Fields |
|-------|-----------|
| `providers` | `id`, `userId`, `businessName`, `email`, `phone`, `rating`, `isActive`, `isPublic`, `slug`, `city`, `state` |
| `provider_services` | `id`, `providerId`, `serviceId`, `categoryId`, `price` |
| `provider_custom_services` | `id`, `providerId`, `name`, `pricingType`, `basePrice`, `isPublished`, `isRecurring` |
| `crew_members` | `id`, `providerId`, `name`, `email`, `isActive`, `invitedUserId` |
| `stripe_connect_accounts` | `id`, `providerId`, `stripeAccountId`, `onboardingStatus`, `chargesEnabled` |

### Subscriptions
| Table | Key Fields |
|-------|-----------|
| `provider_plans` | `id`, `providerId`, `planTier`, `isSubscribed`, `isPartner`, `subscriptionSource`, `subscriptionStatus`, `stripeSubscriptionId`, `revenuecatProductId`, `currentPeriodEnd`, `firstPaidBookingAt`, `gracePeriodEndsAt`, `subscriptionStartedAt`, `subscriptionEndedAt` |

### Bookings / Appointments
| Table | Key Fields |
|-------|-----------|
| `appointments` | `id`, `userId`, `homeId`, `providerId`, `scheduledDate`, `status`, `depositStatus`, `createdAt` |
| `intake_submissions` | `id`, `bookingLinkId`, `providerId`, `homeownerUserId`, `status` |

### Jobs
| Table | Key Fields |
|-------|-----------|
| `jobs` | `id`, `providerId`, `clientId`, `appointmentId`, `seriesId`, `scheduledDate`, `status`, `assignedCrewMemberId`, `weatherHeldAt` |
| `job_series` | `id`, `providerId`, `clientId`, `frequency`, `anchorDate`, `status` |

### Payments & Invoices
| Table | Key Fields |
|-------|-----------|
| `invoices` | `id`, `providerId`, `clientId`, `jobId`, `invoiceNumber`, `totalCents`, `status`, `stripeInvoiceId` |
| `invoice_line_items` | `id`, `invoiceId`, `name`, `quantity`, `unitPriceCents` |
| `payments` | `id`, `invoiceId`, `providerId`, `amountCents`, `method`, `status`, `stripePaymentIntentId` |
| `payouts` | `id`, `providerId`, `amountCents`, `status`, `stripeTransferId` |
| `refunds` | `id`, `providerId`, `paymentId`, `amountCents`, `status` |
| `estimates` | `id`, `providerId`, `clientId`, `status`, `publicToken`, `convertedInvoiceId` |

### Reviews
| Table | Key Fields |
|-------|-----------|
| `reviews` | `id`, `appointmentId`, `userId`, `providerId`, `rating`, `comment`, `createdAt` |
| `review_reports` | `id`, `reviewId`, `reporterUserId`, `status` |

### Support
| Table | Key Fields |
|-------|-----------|
| `support_tickets` | `id`, `userId`, `name`, `email`, `category`, `subject`, `message`, `status` (default `"open"`), `createdAt` |

> **Note:** No `support_ticket_messages` table exists yet. Replies currently go via Resend email only.

### Notifications
| Table | Key Fields |
|-------|-----------|
| `notifications` | `id`, `userId`, `title`, `message`, `isRead`, `createdAt` |
| `notification_deliveries` | `id`, `recipientUserId`, `channel`, `status` |
| `push_tokens` | `id`, `userId`, `token`, `platform`, `isActive` |
| `notification_preferences` | `id`, `userId` (unique) |

---

# SECTION C — Missing Tables & Fields Needed for Admin Portal

### New Tables Required

```sql
-- Threaded admin replies on support tickets
CREATE TABLE support_ticket_messages (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   VARCHAR NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id   VARCHAR REFERENCES users(id),         -- null = system/email reply
  sender_type TEXT NOT NULL DEFAULT 'admin',        -- 'admin' | 'user'
  body        TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- Admin broadcast campaigns
CREATE TABLE admin_broadcasts (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by_user_id VARCHAR NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  audience        TEXT NOT NULL,   -- 'all' | 'homeowners' | 'providers' | 'partners' | 'user:{id}'
  channel         TEXT NOT NULL,   -- 'push' | 'email' | 'in_app' | 'all'
  recipient_count INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft',   -- 'draft' | 'sent' | 'failed'
  sent_at         TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

-- Per-recipient delivery tracking
CREATE TABLE admin_broadcast_recipients (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id VARCHAR NOT NULL REFERENCES admin_broadcasts(id) ON DELETE CASCADE,
  user_id      VARCHAR NOT NULL REFERENCES users(id),
  channel      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'queued',   -- 'queued' | 'sent' | 'failed'
  delivered_at TIMESTAMP
);

-- Immutable admin action log
CREATE TABLE admin_audit_logs (
  id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id VARCHAR NOT NULL REFERENCES users(id),
  action        TEXT NOT NULL,          -- e.g. 'grant_partner', 'revoke_partner', 'close_ticket', 'send_broadcast'
  target_type   TEXT,                   -- 'provider' | 'user' | 'ticket' | 'broadcast'
  target_id     VARCHAR,
  before_value  JSONB,
  after_value   JSONB,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);
```

### Missing Columns on Existing Tables

```sql
-- Support tickets need priority, assignment, and threading timestamps
ALTER TABLE support_tickets
  ADD COLUMN priority    TEXT NOT NULL DEFAULT 'normal',  -- 'low' | 'normal' | 'high' | 'urgent'
  ADD COLUMN user_type   TEXT,                             -- 'homeowner' | 'provider'
  ADD COLUMN assigned_to VARCHAR REFERENCES users(id),
  ADD COLUMN updated_at  TIMESTAMP NOT NULL DEFAULT now(),
  ADD COLUMN resolved_at TIMESTAMP;

-- Users: track last active for the admin user list
ALTER TABLE users
  ADD COLUMN last_active_at TIMESTAMP;
```

---

# SECTION D — Safest Implementation Plan

**Phase 1 — Database (run migrations first, no downtime)**
1. Run the SQL migrations from Section F to add the four new tables and the column additions.
2. Update `shared/schema.ts` Drizzle definitions to match (required before backend code uses them).

**Phase 2 — New Express API Endpoints**
Add the following endpoints to `server/routes.ts`, all behind `requireAuth + requireAdmin`:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/admin/stats` | Dashboard aggregate counts |
| `GET /api/admin/users` | Paginated user list with filters |
| `GET /api/admin/users/:id` | User detail |
| `PATCH /api/admin/users/:id` | Lightweight edit (isAdmin toggle) |
| `GET /api/admin/providers` | Extended provider list (already exists, extend it) |
| `GET /api/admin/providers/:id` | Full provider detail |
| `PATCH /api/admin/providers/:id` | Edit provider basics |
| `GET /api/admin/support-tickets` | List with filters |
| `GET /api/admin/support-tickets/:id` | Full ticket + messages |
| `PATCH /api/admin/support-tickets/:id` | Update status/priority/assignment |
| `POST /api/admin/support-tickets/:id/messages` | Admin reply (saves to DB + sends email) |
| `POST /api/admin/broadcasts` | Create and send broadcast |
| `GET /api/admin/broadcasts` | Broadcast history |
| `GET /api/admin/analytics/top-providers` | Ranked provider analytics |
| `GET /api/admin/audit-logs` | Audit log list |

**Phase 3 — Admin Portal (Lovable)**
Build the Lovable portal to call the Express API at `https://your-backend.replit.app/api/admin/*`. All requests must include the admin user's JWT in the `Authorization: Bearer <token>` header. Admin login uses the same `/api/auth/login` endpoint — the portal simply checks `user.isAdmin` in the response.

**Partner Status — Safe Implementation**
`provider_plans.is_partner` already exists and already bypasses all subscription gates in `server/subscriptionService.ts`. The existing `POST /api/admin/providers/:id/partner` endpoint sets it. **No app code changes are needed for partner logic.** The admin portal simply calls the existing endpoint.

---

# SECTION E — FULL LOVABLE PROMPT

Copy and paste the following prompt directly into Lovable to generate the admin portal:

---

```
Build a HomeBase Admin Portal — a secure, desktop-optimized SaaS command center for the HomeBase founder.

HomeBase is a home services marketplace. The backend is an Express.js API (TypeScript) with PostgreSQL via Drizzle ORM. The admin portal is a separate standalone web app (React + Vite) that communicates exclusively with the Express API. It does NOT connect to Supabase directly.

## IMPORTANT: API Contract vs Database Schema
This portal calls the Express API — it does NOT talk to Supabase directly.
All field names in API responses follow camelCase JavaScript conventions, NOT the
snake_case column names in the database. For example:
- DB column `first_name` → API field `firstName`
- DB column `is_active` → API field `isActive`
- DB column `created_at` → API field `createdAt`
- DB column `provider_id` → API field `providerId`
When wiring data to the UI, always bind to the API response field names, not the
raw DB column names shown in this blueprint's schema tables.

## Base API URL
All API calls go to: https://[HOMEBASE_BACKEND_URL]/api
All authenticated requests send: Authorization: Bearer <jwt_token>

## Authentication
Use POST /api/auth/login with { email, password }.
Response includes { token, user: { id, email, firstName, lastName, isAdmin } }.
If isAdmin is not true, show "Access denied — admin only" and redirect to login.
Store the token in localStorage. Attach it as a Bearer token on every request.
On 401/403, clear storage and redirect to login.

## Design System
- Primary accent: #38AE5F (HomeBase green)
- Neutral grayscale for everything else
- Clean dark/light mode toggle
- Modern cards with subtle shadow
- Left sidebar navigation, fixed
- Tables with clean borders, hover states, sortable columns
- Search bars and filters on every list view
- No emojis anywhere
- Font: Inter or similar clean sans-serif
- Mobile responsive but desktop-first

## Sidebar Navigation
- Dashboard
- Homeowners
- Providers
- HomeBase Partners (filtered provider view)
- Support Tickets
- Broadcasts
- Analytics / Top Providers
- Audit Logs
- Settings (admin account)

---

## 1. LOGIN PAGE
Route: /login
Fields: Email, Password
On submit: POST /api/auth/login
On success: store token, check isAdmin, route to /dashboard
On fail: show inline error message

---

## 2. DASHBOARD — GET /api/admin/stats
Route: /dashboard
Show metric cards in a responsive grid:
- Total Users (homeowners)
- Total Providers
- Active Providers (providers.is_active = true AND is_public = true)
- Inactive Providers
- HomeBase Partners (provider_plans.is_partner = true)
- Total Appointments (appointments table count)
- Total Jobs (jobs table count)
- Total Paid Revenue (SUM of payments.amount_cents WHERE status = 'succeeded', display in dollars)
- Open Support Tickets (support_tickets WHERE status = 'open')
- Total Support Tickets

Below the cards, show two panels side by side:
- Recent Signups (last 10 users, show name + email + signup date)
- Recent Bookings (last 10 appointments, show homeowner + provider + date + status)

---

## 3. HOMEOWNERS — GET /api/admin/users?role=homeowner
Route: /homeowners
Table columns: Name | Email | Phone | Signup Date | Last Active | Total Homes | Total Bookings | Credits Balance | Actions
Features: search by name/email, sort by signup date or booking count, paginate (25/page)
Row click → /homeowners/:id

### Homeowner Detail — GET /api/admin/users/:id
Show:
- Profile card: name, email, phone, signup date, last active
- Homes list: address, city, state, housefax score
- Appointments: date, provider, service, status
- Credit balance and ledger history
- Support tickets submitted by this user

---

## 4. PROVIDERS — GET /api/admin/providers
Route: /providers
Table columns: Business Name | Owner | Email | Category | City | Subscription Status | Partner | Active | Public | Bookings | Revenue | Rating | Created | Actions
Features: search, filter by subscription status, partner status, active/inactive; sort by bookings or revenue; paginate (25/page)

Subscription status values: 'free' | 'grace_period' | 'subscribed' | 'expired'
Partner badge: show green "PARTNER" pill if provider_plans.is_partner = true

Row click → /providers/:id

### Provider Detail — GET /api/admin/providers/:id
Show full provider profile:
- Business name, owner name, email, phone, city, state
- Service category list (from provider_services + service_categories)
- Subscription status card: source (stripe_web / revenuecat_ios / revenuecat_android), status, current period end, first paid booking, grace period end
- Partner status toggle (calls POST/DELETE /api/admin/providers/:id/partner)
- Active/Public toggle (calls PATCH /api/admin/providers/:id with { isActive, isPublic })
- Stripe Connect card: account ID, onboarding status, charges enabled
- Public booking link: show slug URL and copy button
- Bookings tab: list of appointments linked to this provider
- Jobs tab: list of jobs
- Invoices tab: list of invoices with totals and status
- Reviews tab: rating, review text, reviewer name, date
- Crew tab: crew members list

### Partner Toggle
When toggling ON: call POST /api/admin/providers/:id/partner
When toggling OFF: call DELETE /api/admin/providers/:id/partner
Show confirmation modal before both actions.
Show toast on success: "Partner status updated"
Partner status means: provider gets full Pro access at no cost, badge appears on their public profile.

---

## 5. HOMEBASE PARTNERS — GET /api/admin/providers?isPartner=true
Route: /partners
Identical to Providers view but pre-filtered to is_partner = true.
Show a prominent green "HomeBase Partner" banner at the top.
Same detail page as /providers/:id.

---

## 6. SUPPORT TICKETS — GET /api/admin/support-tickets
Route: /support
Table columns: Subject | User | User Type | Category | Priority | Status | Created | Updated | Actions
Features:
- Filter tabs: All | Open | Pending | Resolved | Closed
- Filter by user type: All | Homeowner | Provider
- Search by subject or email
- Sort by created date or priority
- Paginate (25/page)

Priority colors: urgent=red, high=orange, normal=neutral, low=grey

Row click → /support/:id

### Ticket Detail — GET /api/admin/support-tickets/:id
Left panel: ticket metadata
- Subject, category, priority, status, created, updated, resolved at
- User info: name, email, user type, link to user detail page

Right panel: conversation thread
- Original message at top
- Admin replies below (from support_ticket_messages)
- Reply box at bottom with Send button

Admin actions (top right):
- Status dropdown: open | pending | resolved | closed → PATCH /api/admin/support-tickets/:id
- Priority dropdown: low | normal | high | urgent → PATCH /api/admin/support-tickets/:id

Reply submit: POST /api/admin/support-tickets/:id/messages
Body: { body: "..." }
On success: append reply to thread, send email to user automatically (backend handles this)

---

## 7. BROADCASTS — POST /api/admin/broadcasts, GET /api/admin/broadcasts
Route: /broadcasts

### Broadcast History List
Table: Title | Audience | Channel | Recipients | Status | Sent Date | Sent By

### New Broadcast Button → Broadcast Composer Modal
Fields:
1. Audience (select):
   - All Users
   - All Homeowners
   - All Providers
   - HomeBase Partners Only
   - Individual User (show user search field)

2. Channel (multi-select):
   - Push Notification
   - Email
   - In-App Notification

3. Title (text input, max 100 chars)

4. Message Body (textarea, max 1000 chars)

5. Preview panel: shows how the message will look

6. Send Now button → POST /api/admin/broadcasts with:
   {
     title: string,
     body: string,
     audience: 'all' | 'homeowners' | 'providers' | 'partners' | 'user:{id}',
     channel: 'push' | 'email' | 'in_app' | 'all'
   }

Show confirmation dialog before sending.
On success: close modal, refresh history list, show toast "Broadcast sent to X recipients"

---

## 8. ANALYTICS — TOP PROVIDERS — GET /api/admin/analytics/top-providers
Route: /analytics

Filters:
- Time period: Last 7d | 30d | 90d | All Time
- Category (from service_categories)
- City (text search)
- Partner status: All | Partners | Non-partners
- Subscription status: All | Subscribed | Expired | Free

Display:
- Ranked table: Rank | Business Name | Category | City | Bookings | Revenue | Avg Rating | Reviews | Partner | Subscription
- Each row links to /providers/:id
- Export to CSV button

---

## 9. AUDIT LOGS — GET /api/admin/audit-logs
Route: /audit-logs
Table: Admin | Action | Target Type | Target | Before | After | Timestamp
Features: filter by admin user, action type, date range; paginate (50/page)
Read-only view. No editing.

---

## 10. SETTINGS
Route: /settings
Show current admin user profile.
Allow changing password via: POST /api/auth/change-password
No other settings needed in v1.

---

## API Error Handling
- 401: "Session expired. Please log in again." → redirect to /login
- 403: "You don't have permission to perform this action."
- 404: Show inline empty state, not a full error page
- 500: Show toast "Something went wrong. Please try again."

## Loading States
Every list and detail page should show a skeleton loader while data is fetching.

## Confirmation Modals
Use a modal with confirm/cancel for: partner toggle, broadcast send, ticket status changes to "closed".

## Toast Notifications
Success: green toast (bottom right), 3s auto-dismiss
Error: red toast, 5s auto-dismiss, manual dismiss
```

---

# SECTION F — SQL Migrations Needed

Run these in order against the HomeBase Supabase project:

```sql
-- Migration 1: Add columns to support_tickets
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS priority    TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS user_type   TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to VARCHAR REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;

-- Migration 2: Add last_active_at to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP;

-- Migration 3: Support ticket messages (threaded replies)
CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   VARCHAR NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id   VARCHAR REFERENCES users(id),
  sender_type TEXT NOT NULL DEFAULT 'admin',
  body        TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- Migration 4: Admin broadcast campaigns
CREATE TABLE IF NOT EXISTS admin_broadcasts (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by_user_id VARCHAR NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  audience        TEXT NOT NULL,
  channel         TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft',
  sent_at         TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

-- Migration 5: Broadcast recipient tracking
CREATE TABLE IF NOT EXISTS admin_broadcast_recipients (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id VARCHAR NOT NULL REFERENCES admin_broadcasts(id) ON DELETE CASCADE,
  user_id      VARCHAR NOT NULL REFERENCES users(id),
  channel      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'queued',
  delivered_at TIMESTAMP
);

-- Migration 6: Immutable admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id VARCHAR NOT NULL REFERENCES users(id),
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     VARCHAR,
  before_value  JSONB,
  after_value   JSONB,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_admin_broadcast_recipients_broadcast ON admin_broadcast_recipients(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at DESC);
```

---

# SECTION G — RLS Policy Changes

The HomeBase backend does **not** currently use Supabase Row Level Security (RLS) for its Express API — authorization is enforced entirely by Express middleware (`requireAuth`, `requireAdmin`). This means:

- No RLS changes are strictly required for the admin portal to work.
- All admin data access goes through the Express API, which already gates every route.

**If you want defense-in-depth RLS anyway (recommended for production):**

```sql
-- Restrict direct Supabase admin_audit_logs access to service role only
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON admin_audit_logs
  USING (auth.role() = 'service_role');

-- Same for broadcasts
ALTER TABLE admin_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON admin_broadcasts
  USING (auth.role() = 'service_role');
```

**CRITICAL:** Do NOT enable RLS on core tables (`users`, `providers`, `appointments`, etc.) unless you also add the corresponding policies — enabling RLS without policies will lock out the Express backend.

---

# SECTION H — Express App Code Changes Needed

The admin portal requires these new or modified endpoints in `server/routes.ts`:

1. **`GET /api/admin/stats`** — Aggregate counts query across users, providers, appointments, payments, support_tickets. New endpoint.

2. **`GET /api/admin/users`** — Paginated user list with `role`, `search`, `sort`, `page` query params. New endpoint.

3. **`GET /api/admin/users/:id`** — Full user detail including homes, appointments, credits. New endpoint.

4. **`PATCH /api/admin/users/:id`** — Lightweight update (e.g., toggle `isAdmin`). New endpoint. **Guard: prevent removing `isAdmin` from the currently authenticated admin user.**

5. **`GET /api/admin/providers`** — Already exists; extend response to include `subscriptionStatus`, `bookingCount`, `totalRevenueCents`, `reviewCount`, `isPartner`.

6. **`GET /api/admin/providers/:id`** — Full provider detail. New endpoint.

7. **`PATCH /api/admin/providers/:id`** — Edit `isActive`, `isPublic`, basic fields. New endpoint.

8. **`GET /api/admin/support-tickets`** — Paginated list with status/priority/userType filters. New endpoint.

9. **`GET /api/admin/support-tickets/:id`** — Ticket + messages thread. New endpoint.

10. **`PATCH /api/admin/support-tickets/:id`** — Update status, priority, assignedTo. New endpoint. Should update `updated_at` and set `resolved_at` when status → resolved/closed. Should write to `admin_audit_logs`.

11. **`POST /api/admin/support-tickets/:id/messages`** — Append admin reply to `support_ticket_messages`, send reply email via Resend. New endpoint.

12. **`POST /api/admin/broadcasts`** — Create broadcast, fan out to users by audience, call `notificationService.dispatch` per channel, write to `admin_broadcasts` + `admin_broadcast_recipients`. **Run fan-out in a background worker — return 202 Accepted immediately.** New endpoint.

13. **`GET /api/admin/broadcasts`** — List broadcast history. New endpoint.

14. **`GET /api/admin/analytics/top-providers`** — Ranked provider query with time-period and filter params. New endpoint.

15. **`GET /api/admin/audit-logs`** — Paginated audit log list. New endpoint.

16. **Middleware touch: update `last_active_at`** — In `authenticateJWT`, after successful validation, update `users.last_active_at = now()` in the background (fire-and-forget, non-blocking). **Debounce: only update if `last_active_at` is null or > 5 min old** to avoid excess DB writes.

17. **Audit logging** — Wrap the existing `POST/DELETE /api/admin/providers/:id/partner` endpoints to write to `admin_audit_logs` after each toggle.

18. **CORS** — Add the Lovable admin portal domain to the `CORS_ORIGINS` environment variable before going live.

---

# SECTION I — Risks and Things That Could Break

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Admin portal hits backend with CORS errors | High | Ensure `CORS_ORIGINS` env var includes the Lovable admin portal domain |
| Broadcast fan-out to large user base blocks the request | High | Run broadcast delivery in a background worker / queue, return 202 Accepted immediately |
| Updating `last_active_at` on every request adds DB write load | Medium | Debounce: only update if `last_active_at` is null or > 5 min old |
| Partner toggle without audit log = no accountability | Medium | Always write to `admin_audit_logs` before returning 200; wrap in a DB transaction |
| Support ticket email reply reveals admin email address | Medium | Use a no-reply Resend sender address; never expose admin personal email |
| Enabling RLS on existing tables without policies | Critical | Never enable RLS without simultaneously adding all required policies — it will lock out the Express backend |
| Admin portal JWT has no expiry enforcement | Medium | Use short-lived tokens (already 7-day default); add logout-on-inactivity in the portal |
| Bulk stats query times out on large dataset | Medium | Add DB indexes on `created_at` columns; consider materialized counts table if dataset grows |
| `isAdmin` toggled via PATCH /api/admin/users/:id could lock out last admin | High | Add guard: prevent removing `isAdmin` from the currently authenticated admin user |
| Lovable-generated portal makes direct Supabase calls | High | Strictly enforce API-only architecture in the Lovable prompt — include the warning explicitly |
