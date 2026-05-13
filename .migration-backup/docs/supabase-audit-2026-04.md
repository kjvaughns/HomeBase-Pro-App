# Supabase Sync Audit — April 2026 (Task #203)

Audit run: 2026-04-19. Connection target: `SUPABASE_DATABASE_URL` (Supabase
Postgres), confirmed live via `[db] Connecting to Supabase` boot log.

Reproducible scripts (committed):
- `scripts/audit-supabase.ts` — schema + row-count diff against `shared/schema.ts`
- `scripts/audit-spot-check.ts` — latest record per major entity
- `scripts/migrate-supabase.ts` — additive-only schema sync (extended in this audit)

Run with:
```
npx tsx scripts/audit-supabase.ts
npx tsx scripts/audit-spot-check.ts
npx tsx scripts/migrate-supabase.ts
```

---

## 1. Schema status

### Tables
- **Expected** (declared in `shared/schema.ts`): **36**
- **Live in Supabase**: **38**
- **Missing in Supabase**: **none** ✅
- **Extra in Supabase (not in schema)**: `app_reviews`, `booking_requests` — see "Legacy tables" below.

### Columns
After running the additive migration, the diff is:

| Table | Drift | Resolution |
|---|---|---|
| `payments` | `status` column missing in Supabase, declared as `payment_status` enum in schema | **Fixed** — added via `dbMigrations.ts` and `scripts/migrate-supabase.ts` |
| `payouts` | `description` column missing in Supabase, declared as `text` in schema | **Fixed** — added via `dbMigrations.ts` and `scripts/migrate-supabase.ts` |
| `invoices` | Extra in live: `deposit_amount`, `deposit_paid`, `discount_amount`, `tax_rate` | Legacy — code uses `*_cents` columns. Flagged for human review (no destructive drop). |
| `providers` | Extra in live: `license_number`, `website`, `stripe_account_id`, `stripe_onboarding_complete` | Legacy — Stripe Connect data lives in `stripe_connect_accounts`; no code reads these. Flagged for review. |
| `users` | Extra in live: `role` | Legacy — current authz uses `is_provider` and JWT claims. Flagged for review. |

No columns the code expects are missing from Supabase after the migration.

### Enums
All 21 expected enums exist in Supabase with the expected values:
`appointment_status, booking_link_status, connect_onboarding_status, intake_status,
invoice_status, job_size, job_status, maintenance_reminder_frequency, message_channel,
message_status, notification_channel, notification_delivery_status, payment_method,
payment_status, payout_status, pricing_type, property_type, provider_plan_tier,
quote_mode, refund_status, urgency`.

### Foreign keys & indexes
- 65 foreign keys present
- 55 indexes present (including the unique constraints declared by the schema:
  `saved_providers_user_provider_unique`, `clients_provider_id_email_unique`,
  `provider_services_provider_id_service_id_unique`, `push_tokens_user_id_token_unique`)

### Migrations applied during this audit
Added to both `server/dbMigrations.ts` (boot-time additive sync) and
`scripts/migrate-supabase.ts` (manual run):

```sql
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status payment_status DEFAULT 'requires_payment';
ALTER TABLE payouts  ADD COLUMN IF NOT EXISTS description TEXT;
```

Boot log confirms: `Boot migrations applied and verified successfully`.

---

## 2. Wiring status

Every backend feature area persists through the Supabase-backed Drizzle
connection (`server/db.ts` → `pg.Pool` over `SUPABASE_DATABASE_URL` with SSL).

| Area | Source | Persistence |
|---|---|---|
| Auth (JWT) | `server/auth.ts` | `db.select(users)` for token-version revocation check |
| Users / homes / appointments / reviews | `server/storage.ts` (`DatabaseStorage`) | All methods use `db` |
| Providers / clients / jobs / invoices / payments / booking links | `server/storage.ts` + `server/routes.ts` | All `db.insert/update/select` |
| Marketplace requests (intake submissions) | `server/routes.ts` | `intakeSubmissions` table via `db.transaction` |
| Subscriptions | `server/subscriptionService.ts` | `provider_plans` table via `db` |
| Stripe Connect | `server/stripeConnectService.ts` | `stripe_connect_accounts`, `invoices`, `payments`, `payouts`, `refunds` via `db` |
| Notifications | `server/notificationService.ts`, `server/routes.ts` | `notifications`, `notification_deliveries`, `notification_preferences`, `push_tokens` via `db` |
| Email delivery records | `server/emailService.ts` | `notification_deliveries`, `provider_messages` via `db` |
| HouseFax history | `server/housefaxService.ts`, `server/routes.ts` | `housefax_entries` via `db` |
| Webhooks | `server/webhookHandlers.ts` | `stripe_webhook_events`, related entities via `db` |
| Seed | `server/seed.ts` | `db.insert` against Supabase |

**No in-memory or local-only stores are used as a source of truth.** The only
in-memory `Map` instances are short-lived caches and rate limiters
(`aiRateLimitMap`, `insightsAiCache`, `onboardingRateLimitMap`, an in-request
`productsMap`) — none is the durable record for any entity.

`server/stripeClient.ts` opens its own `pg.Pool` to the same
`SUPABASE_DATABASE_URL` for the Stripe-sync helper; that's intentional
(separate pool for the Stripe sync subsystem, not a bypass).

### Reviewed during this audit
- `server/lib/supabase.ts` — Supabase JS client (`@supabase/supabase-js`).
  **Kept.** Two upload endpoints in `server/routes.ts` (photo upload around
  line 2530, provider logo upload around line 6210) dynamically import this
  module to write image objects into a Supabase Storage bucket. The dynamic
  `await import("./lib/supabase")` pattern hid these references from the
  initial grep; they are real and in production. Documented here so it isn't
  removed in the future.
- `client/lib/supabase.ts` — Supabase JS client on the mobile app.
  Confirmed dead code via grep (no imports anywhere in `client/`). **Removed.**

Supabase usage in this app:
- **Postgres** via Drizzle (`server/db.ts`, `pg.Pool` over `SUPABASE_DATABASE_URL`)
  for everything persisted by the backend.
- **Storage** via the JS client in `server/lib/supabase.ts` for photo uploads
  on the two endpoints noted above.
- Supabase Auth, Realtime, and RLS are **not** used.

---

## 3. Live data spot-check (2026-04-19)

Row counts pulled from Supabase via `SELECT COUNT(*)` on every public table:

| Table | Rows | Latest record |
|---|---:|---|
| users | 24 | `johndoe@homebaseproapp.com` (provider) — 2026-04-16 |
| providers | 15 | "Heritage Home Cleaners" (public, active) — 2026-04-16 |
| homes | 4 | "KJ Vaughns's Home", Dallas TX — 2026-04-18 |
| clients | 217 | "John Doe" — 2026-04-18 |
| appointments | 173 | "Test Cleaning" (completed) — 2026-04-18 |
| jobs | 359 | "Test Cleaning" (completed) — 2026-04-18 |
| invoices | 30 | status `sent`, $1.00 — 2026-04-18 |
| invoice_line_items | 6 | "Test Service" $50.00 |
| payments | 0 | — |
| payouts | 0 | — |
| refunds | 0 | — |
| reviews | 1 | rating 5 — 2026-04-19 |
| review_reports | 0 | — |
| saved_providers | 0 | — |
| notifications | 8 | type `quarterly_client_growth` — 2026-04-18 |
| notification_deliveries | 53 | email `invoice.sent` (sent) — 2026-04-18 |
| notification_preferences | 1 | — |
| push_tokens | 2 | platform `expo`, active — 2026-04-17 |
| provider_plans | 1 | tier `free`, not subscribed |
| stripe_connect_accounts | 2 | onboarding `pending`, livemode `true` |
| stripe_webhook_events | 0 | — |
| service_categories | 8 | seeded |
| services | 18 | seeded |
| provider_services | 0 | — (providers use `provider_custom_services` instead) |
| provider_custom_services | 13 | — |
| provider_messages | 3 | email, sent — 2026-04-18 |
| message_templates | 0 | — |
| provider_message_templates | 0 | — |
| booking_links | 2 | — |
| intake_submissions | 0 | — |
| housefax_entries | 1 | "Test Cleaning" — 2026-04-18 |
| support_tickets | 3 | "Account & Login", open — 2026-04-13 |
| credit_ledger / user_credits | 0 / 0 | — |
| maintenance_reminders | 0 | — |
| leads | 0 | — |
| **app_reviews** (legacy) | 0 | columns: id, name, email, role, title, comment, rating, is_published, created_at |
| **booking_requests** (legacy) | 2 | columns: id, customer_name/phone/email/address, service_summary, preferred_date/time, notes, status, appointment_id, provider_id/name/category |

The running app is unambiguously talking to Supabase: every entity created in
recent QA runs (test cleaning appointment, invoice, review, housefax entry)
appears with its expected timestamps.

---

## 4. Findings to flag for follow-up (out of scope here — destructive)

None of these block the app, but each is dead weight that should be cleaned up
in a separate, human-reviewed task.

1. **Drop legacy tables** `app_reviews` (0 rows) and `booking_requests` (2
   rows). No code path references either table. `booking_requests` rows
   should be exported first if any historical value is wanted.
2. **Drop legacy columns**:
   - `invoices.deposit_amount`, `invoices.deposit_paid`,
     `invoices.discount_amount`, `invoices.tax_rate` (replaced by `*_cents`)
   - `providers.license_number`, `providers.website`,
     `providers.stripe_account_id`, `providers.stripe_onboarding_complete`
     (Stripe Connect data lives in `stripe_connect_accounts`)
   - `users.role` (auth uses `is_provider` + JWT claims)
3. **Empty tables that never get written**: `provider_services` (0 rows) is
   superseded by `provider_custom_services`. Either backfill or remove its
   write paths from the schema and storage layer.

These are intentionally listed instead of executed — destructive schema
changes are explicitly out of scope per the task brief.
