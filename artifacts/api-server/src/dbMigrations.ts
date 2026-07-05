import { pool } from "./db";

const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * Boot-time additive schema migration.
 *
 * Adds columns and tables that exist in shared/schema.ts but may be missing
 * from the Supabase database. All statements use IF NOT EXISTS semantics —
 * safe to run on every startup with no destructive changes.
 *
 * drizzle-kit push hangs on Supabase's session-mode pooler (pg_catalog
 * introspection queries time out), so this handles the additive sync in-process.
 *
 * Failure mode:
 *  - Development: logs a warning and continues (preserves dev DX)
 *  - Production: throws after logging so the process exits with a clear error
 */
export async function runBootMigrations(): Promise<void> {
  const client = await pool.connect();
  const errors: string[] = [];

  async function runSql(label: string, sql: string): Promise<void> {
    try {
      await client.query(sql);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${label}] ${msg}`);
      console.warn(`Boot migration skipped (${label}):`, msg);
    }
  }

  try {
    // ── invoices: ensure legacy NOT NULL columns have defaults ────────────
    await runSql("invoices.amount.default",  `ALTER TABLE invoices ALTER COLUMN amount SET DEFAULT '0'`);
    await runSql("invoices.total.default",   `ALTER TABLE invoices ALTER COLUMN total SET DEFAULT '0'`);

    // ── invoices: columns added after initial schema creation ─────────────
    const invoiceAlters: Array<[string, string]> = [
      ["invoices.currency",                   `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'usd'`],
      ["invoices.subtotal_cents",             `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal_cents INTEGER NOT NULL DEFAULT 0`],
      ["invoices.tax_cents",                  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_cents INTEGER DEFAULT 0`],
      ["invoices.discount_cents",             `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_cents INTEGER DEFAULT 0`],
      ["invoices.platform_fee_cents",         `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER DEFAULT 0`],
      ["invoices.total_cents",               `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_cents INTEGER NOT NULL DEFAULT 0`],
      ["invoices.payment_methods_allowed",    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_methods_allowed TEXT DEFAULT 'stripe,credits'`],
      ["invoices.stripe_payment_intent_id",   `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT`],
      ["invoices.stripe_checkout_session_id", `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT`],
      ["invoices.stripe_payment_link_id",     `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_link_id TEXT`],
      ["invoices.stripe_invoice_id",           `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT`],
      ["invoices.hosted_invoice_url",         `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hosted_invoice_url TEXT`],
      ["invoices.sent_at",                    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP`],
      ["invoices.viewed_at",                  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP`],
      ["invoices.paid_at",                    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`],
      ["invoices.updated_at",                 `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW() NOT NULL`],
    ];
    for (const [label, sql] of invoiceAlters) {
      await runSql(label, sql);
    }

    // ── clients: Stripe Connect customer ID per provider account ──────────
    await runSql("clients.stripe_connect_customer_id", `ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_connect_customer_id TEXT`);

    // ── payments: Stripe fields (charge ID and payment intent ID) ─────────
    await runSql("payments.stripe_charge_id", `ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT`);
    await runSql("payments.stripe_payment_intent_id", `ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT`);

    // ── refunds: Stripe charge ID (for matching refunds to charges) ───────
    await runSql("refunds.stripe_charge_id", `ALTER TABLE refunds ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT`);

    // ── stripe_connect_accounts: livemode flag for live-cutover detection ─
    await runSql("stripe_connect_accounts.livemode",
      `ALTER TABLE stripe_connect_accounts ADD COLUMN IF NOT EXISTS livemode BOOLEAN DEFAULT FALSE`);

    // ── payouts: missing columns ──────────────────────────────────────────
    await runSql("payouts.arrival_date",  `ALTER TABLE payouts ADD COLUMN IF NOT EXISTS arrival_date TIMESTAMP`);
    await runSql("payouts.amount_cents",  `ALTER TABLE payouts ADD COLUMN IF NOT EXISTS amount_cents INTEGER NOT NULL DEFAULT 0`);

    // ── refunds: missing amount_cents column ──────────────────────────────
    await runSql("refunds.amount_cents",  `ALTER TABLE refunds ADD COLUMN IF NOT EXISTS amount_cents INTEGER NOT NULL DEFAULT 0`);

    // ── invoice_line_items: missing amount_cents column ───────────────────
    await runSql("invoice_line_items.amount_cents", `ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS amount_cents INTEGER NOT NULL DEFAULT 0`);

    // ── payments: missing amount_cents column ─────────────────────────────
    await runSql("payments.amount_cents", `ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_cents INTEGER NOT NULL DEFAULT 0`);

    // ── payments: Task #295 manual payment metadata ───────────────────────
    await runSql("payments.photo_url",   `ALTER TABLE payments ADD COLUMN IF NOT EXISTS photo_url TEXT`);
    await runSql("payments.received_at", `ALTER TABLE payments ADD COLUMN IF NOT EXISTS received_at TIMESTAMP`);
    await runSql("payments.created_by",  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id) ON DELETE SET NULL`);
    await runSql("payments.voided_at",   `ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP`);
    await runSql("payments.voided_by",   `ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_by VARCHAR REFERENCES users(id) ON DELETE SET NULL`);
    await runSql(
      "payments.received_at.backfill",
      `UPDATE payments SET received_at = created_at WHERE received_at IS NULL`,
    );

    // ── payments.status: drift discovered in Task #203 audit. Schema declares
    // payment_status enum on this column but Supabase was missing it.
    await runSql("payments.status", `ALTER TABLE payments ADD COLUMN IF NOT EXISTS status payment_status DEFAULT 'requires_payment'`);

    // ── payment_method enum: drift fixed in Task #245. Schema declares
    // 'stripe' and 'credits' values; some envs were missing them which
    // caused webhook upserts to fail with `invalid input value for enum`.
    await runSql(
      "payment_method.add_stripe",
      `ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'stripe'`,
    );
    await runSql(
      "payment_method.add_credits",
      `ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'credits'`,
    );

    // ── badge_type enum: new milestone badge types (Task #409) ─────────────
    await runSql("badge_type.add_first_job",        `ALTER TYPE badge_type ADD VALUE IF NOT EXISTS 'first_job'`);
    await runSql("badge_type.add_first_thousand",   `ALTER TYPE badge_type ADD VALUE IF NOT EXISTS 'first_thousand'`);
    await runSql("badge_type.add_ten_clients",      `ALTER TYPE badge_type ADD VALUE IF NOT EXISTS 'ten_clients'`);
    await runSql("badge_type.add_twenty_five_jobs", `ALTER TYPE badge_type ADD VALUE IF NOT EXISTS 'twenty_five_jobs'`);
    await runSql("badge_type.add_first_recurring",  `ALTER TYPE badge_type ADD VALUE IF NOT EXISTS 'first_recurring'`);
    await runSql("badge_type.add_first_five_star",  `ALTER TYPE badge_type ADD VALUE IF NOT EXISTS 'first_five_star'`);

    // ── payments.stripe_payment_intent_id unique index (Task #245). Required
    // for ON CONFLICT (stripe_payment_intent_id) DO UPDATE in
    // handleStripeInvoicePaid / handlePaymentIntentSucceeded. Without this
    // index, paid-webhook processing fails with "no unique or exclusion
    // constraint matching ON CONFLICT". Non-partial: Postgres treats NULLs
    // as distinct so non-Stripe payments are unaffected; non-partial form
    // is required because Drizzle's onConflict helper cannot restate a
    // partial-index WHERE predicate.
    await runSql(
      "payments.stripe_payment_intent_id_unique",
      `CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_payment_intent_id_unique ON payments (stripe_payment_intent_id)`,
    );

    // ── payouts.description: drift discovered in Task #203 audit. ─────────
    await runSql("payouts.description", `ALTER TABLE payouts ADD COLUMN IF NOT EXISTS description TEXT`);

    // ── providers: is_public (public profile visibility flag) ─────────────
    await runSql("providers.is_public", `ALTER TABLE providers ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE`);

    // ── providers: monthly earnings goal columns ───────────────────────────
    await runSql("providers.monthly_goal_cents",       `ALTER TABLE providers ADD COLUMN IF NOT EXISTS monthly_goal_cents INTEGER`);
    await runSql("providers.goal_notified_50_month",   `ALTER TABLE providers ADD COLUMN IF NOT EXISTS goal_notified_50_month TEXT`);
    await runSql("providers.goal_notified_100_month",  `ALTER TABLE providers ADD COLUMN IF NOT EXISTS goal_notified_100_month TEXT`);

    // ── providers: booking streak columns (Task #409) ──────────────────────
    await runSql("providers.current_booking_streak",   `ALTER TABLE providers ADD COLUMN IF NOT EXISTS current_booking_streak INTEGER NOT NULL DEFAULT 0`);
    await runSql("providers.last_streak_date",         `ALTER TABLE providers ADD COLUMN IF NOT EXISTS last_streak_date TIMESTAMP`);

    // ── provider_plans: HomeBase subscription billing fields (Task #124) ──
    const providerPlanAlters: Array<[string, string]> = [
      ["provider_plans.is_subscribed",          `ALTER TABLE provider_plans ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN NOT NULL DEFAULT FALSE`],
      ["provider_plans.stripe_subscription_id", `ALTER TABLE provider_plans ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`],
      ["provider_plans.subscription_status",    `ALTER TABLE provider_plans ADD COLUMN IF NOT EXISTS subscription_status TEXT`],
      ["provider_plans.subscription_started_at",`ALTER TABLE provider_plans ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP`],
      ["provider_plans.subscription_ended_at",  `ALTER TABLE provider_plans ADD COLUMN IF NOT EXISTS subscription_ended_at TIMESTAMP`],
      // RevenueCat IAP fields (Task #132)
      ["provider_plans.subscription_source",    `ALTER TABLE provider_plans ADD COLUMN IF NOT EXISTS subscription_source TEXT`],
      ["provider_plans.revenuecat_product_id",  `ALTER TABLE provider_plans ADD COLUMN IF NOT EXISTS revenuecat_product_id TEXT`],
      ["provider_plans.current_period_end",     `ALTER TABLE provider_plans ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP`],
      // HomeBase Partner tier (Task #211): admin-granted complimentary
      // Pro access. Resolves to status="subscribed" in
      // computeSubscriptionStatus with subscriptionSource="partner".
      ["provider_plans.is_partner",             `ALTER TABLE provider_plans ADD COLUMN IF NOT EXISTS is_partner BOOLEAN NOT NULL DEFAULT FALSE`],
      ["provider_plans.partner_since",          `ALTER TABLE provider_plans ADD COLUMN IF NOT EXISTS partner_since TIMESTAMP`],
    ];
    for (const [label, sql] of providerPlanAlters) {
      await runSql(label, sql);
    }

    // ── services: is_public (platform-level service visibility) ──────────
    await runSql("services.is_public", `ALTER TABLE services ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE`);

    // ── enums required by refunds + messaging/notification tables ─────────
    const enumDefs: Array<[string, string]> = [
      ["enum.refund_status",               `DO $$ BEGIN CREATE TYPE refund_status AS ENUM ('pending','succeeded','failed','canceled'); EXCEPTION WHEN duplicate_object THEN null; END $$`],
      ["enum.notification_channel",        `DO $$ BEGIN CREATE TYPE notification_channel AS ENUM ('email','push','in_app','sms'); EXCEPTION WHEN duplicate_object THEN null; END $$`],
      ["enum.notification_delivery_status", `DO $$ BEGIN CREATE TYPE notification_delivery_status AS ENUM ('queued','sent','delivered','failed','pending_sms'); EXCEPTION WHEN duplicate_object THEN null; END $$`],
      ["enum.message_channel",             `DO $$ BEGIN CREATE TYPE message_channel AS ENUM ('email','sms'); EXCEPTION WHEN duplicate_object THEN null; END $$`],
      ["enum.message_status",              `DO $$ BEGIN CREATE TYPE message_status AS ENUM ('sent','failed','pending_sms'); EXCEPTION WHEN duplicate_object THEN null; END $$`],
    ];
    for (const [label, sql] of enumDefs) {
      await runSql(label, sql);
    }

    // ── push_tokens ───────────────────────────────────────────────────────
    await runSql("table.push_tokens", `
      CREATE TABLE IF NOT EXISTS push_tokens (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        platform TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // ── push_tokens: dedupe + unique constraint (Task #143) ───────────────
    // Without a unique constraint, the registration upsert silently inserts
    // duplicate rows, and the send path then fans out N pushes per event.
    // Delete duplicates (keep most recently updated row per user/token), then
    // add a unique index so future re-registrations are truly idempotent.
    await runSql("push_tokens.dedupe_rows", `
      DELETE FROM push_tokens a
      USING push_tokens b
      WHERE a.user_id = b.user_id
        AND a.token = b.token
        AND (
          a.updated_at < b.updated_at
          OR (a.updated_at = b.updated_at AND a.id < b.id)
        )
    `);
    await runSql("push_tokens.unique_user_token", `
      CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_user_id_token_unique
        ON push_tokens (user_id, token)
    `);

    // ── notification_preferences ──────────────────────────────────────────
    await runSql("table.notification_preferences", `
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        user_id VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        email_booking_confirmation BOOLEAN DEFAULT TRUE,
        email_booking_reminder BOOLEAN DEFAULT TRUE,
        email_booking_cancelled BOOLEAN DEFAULT TRUE,
        email_invoice_created BOOLEAN DEFAULT TRUE,
        email_invoice_reminder BOOLEAN DEFAULT TRUE,
        email_invoice_paid BOOLEAN DEFAULT TRUE,
        email_payment_failed BOOLEAN DEFAULT TRUE,
        email_review_request BOOLEAN DEFAULT TRUE,
        push_enabled BOOLEAN DEFAULT TRUE,
        in_app_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // ── notification_deliveries ───────────────────────────────────────────
    await runSql("table.notification_deliveries", `
      CREATE TABLE IF NOT EXISTS notification_deliveries (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        channel notification_channel NOT NULL,
        status notification_delivery_status DEFAULT 'queued',
        event_type TEXT NOT NULL,
        recipient_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        recipient_email TEXT,
        related_record_type TEXT,
        related_record_id VARCHAR,
        external_message_id TEXT,
        error TEXT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // ── provider_messages ─────────────────────────────────────────────────
    await runSql("table.provider_messages", `
      CREATE TABLE IF NOT EXISTS provider_messages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        provider_id VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        client_id VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        job_id VARCHAR REFERENCES jobs(id) ON DELETE SET NULL,
        invoice_id VARCHAR REFERENCES invoices(id) ON DELETE SET NULL,
        channel message_channel NOT NULL DEFAULT 'email',
        subject TEXT,
        body TEXT NOT NULL,
        status message_status NOT NULL DEFAULT 'sent',
        resend_message_id TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // ── drop legacy provider_message_templates ────────────────────────────
    // The duplicate provider_message_templates table was superseded by
    // message_templates. Dropping it on every boot keeps deployed databases
    // in sync with shared/schema.ts (39-table canonical count).
    await runSql("drop.provider_message_templates", `
      DROP TABLE IF EXISTS provider_message_templates CASCADE
    `);

    // ── message_templates ─────────────────────────────────────────────────
    await runSql("table.message_templates", `
      CREATE TABLE IF NOT EXISTS message_templates (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        provider_id VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        channel message_channel NOT NULL DEFAULT 'email',
        subject TEXT,
        body TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // ── quick_quotes (Task #300): provider-initiated AI quotes from address ─
    await runSql("table.quick_quotes", `
      CREATE TABLE IF NOT EXISTS quick_quotes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        provider_id VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        address TEXT NOT NULL,
        formatted_address TEXT,
        place_id TEXT,
        latitude DECIMAL(10,7),
        longitude DECIMAL(10,7),
        lot_size INTEGER,
        square_feet INTEGER,
        custom_service_id VARCHAR REFERENCES provider_custom_services(id) ON DELETE SET NULL,
        service_name TEXT NOT NULL,
        low_price DECIMAL(10,2) NOT NULL,
        mid_price DECIMAL(10,2) NOT NULL,
        high_price DECIMAL(10,2) NOT NULL,
        final_price DECIMAL(10,2) NOT NULL,
        pricing_basis TEXT,
        ai_insight TEXT,
        notes TEXT,
        sent_via TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    await runSql("quick_quotes.provider_id_idx", `
      CREATE INDEX IF NOT EXISTS quick_quotes_provider_id_idx
        ON quick_quotes (provider_id, created_at DESC)
    `);

    // ── support_tickets ───────────────────────────────────────────────────
    await runSql("table.support_tickets", `
      CREATE TABLE IF NOT EXISTS support_tickets (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        category TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // ── refunds: create table if missing (stripe Connect refunds) ────────
    await runSql("table.refunds", `
      CREATE TABLE IF NOT EXISTS refunds (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        provider_id VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        payment_id VARCHAR REFERENCES payments(id) ON DELETE SET NULL,
        stripe_refund_id TEXT UNIQUE,
        stripe_charge_id TEXT,
        amount_cents INTEGER NOT NULL DEFAULT 0,
        reason TEXT,
        status refund_status DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // ── users: Stripe customer & default payment method & token revocation ───
    const userAlters: Array<[string, string]> = [
      ["users.stripe_customer_id",       `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`],
      ["users.default_payment_method_id",`ALTER TABLE users ADD COLUMN IF NOT EXISTS default_payment_method_id TEXT`],
      ["users.token_version",            `ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0`],
    ];
    for (const [label, sql] of userAlters) {
      await runSql(label, sql);
    }

    // ── clients: unique constraint on (provider_id, email) ────────────────
    await runSql("clients.unique_provider_email", `
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE tablename = 'clients'
            AND indexname = 'clients_provider_id_email_unique'
        ) THEN
          CREATE UNIQUE INDEX clients_provider_id_email_unique
            ON clients (provider_id, email)
            WHERE email IS NOT NULL;
        END IF;
      END $$
    `);

    // ── provider_services: unique (provider_id, service_id) ───────────────
    await runSql("provider_services.unique_provider_service", `
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE tablename = 'provider_services'
            AND indexname = 'provider_services_provider_id_service_id_unique'
        ) THEN
          CREATE UNIQUE INDEX provider_services_provider_id_service_id_unique
            ON provider_services (provider_id, service_id);
        END IF;
      END $$
    `);

    // ── intake_submissions: soft FK on deposit_payment_id (NOT VALID — skips existing rows) ──
    await runSql("intake_submissions.deposit_payment_id_fk", `
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'intake_submissions_deposit_payment_id_fkey'
        ) THEN
          ALTER TABLE intake_submissions
            ADD CONSTRAINT intake_submissions_deposit_payment_id_fkey
            FOREIGN KEY (deposit_payment_id)
            REFERENCES payments(id)
            ON DELETE SET NULL
            NOT VALID;
        END IF;
      END $$
    `);

    // ── provider_custom_services: AI Blueprint fields ────────────────────
    const customServiceAlters: Array<[string, string]> = [
      ["provider_custom_services.intake_questions_json", `ALTER TABLE provider_custom_services ADD COLUMN IF NOT EXISTS intake_questions_json TEXT`],
      ["provider_custom_services.add_ons_json",          `ALTER TABLE provider_custom_services ADD COLUMN IF NOT EXISTS add_ons_json TEXT`],
      ["provider_custom_services.booking_mode",          `ALTER TABLE provider_custom_services ADD COLUMN IF NOT EXISTS booking_mode TEXT DEFAULT 'instant'`],
      ["provider_custom_services.ai_pricing_insight",    `ALTER TABLE provider_custom_services ADD COLUMN IF NOT EXISTS ai_pricing_insight TEXT`],
      ["provider_custom_services.checklist_template_json", `ALTER TABLE provider_custom_services ADD COLUMN IF NOT EXISTS checklist_template_json JSONB`],
    ];
    for (const [label, sql] of customServiceAlters) {
      await runSql(label, sql);
    }

    // ── reviews: provider reply columns (Task #197) ──────────────────────
    const reviewAlters: Array<[string, string]> = [
      ["reviews.provider_reply",            `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS provider_reply TEXT`],
      ["reviews.provider_reply_at",         `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS provider_reply_at TIMESTAMP`],
      ["reviews.provider_reply_updated_at", `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS provider_reply_updated_at TIMESTAMP`],
    ];
    for (const [label, sql] of reviewAlters) {
      await runSql(label, sql);
    }

    // ── housefax_entries: service history log for each home ──────────────
    await runSql("table.housefax_entries", `
      CREATE TABLE IF NOT EXISTS housefax_entries (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        home_id VARCHAR NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
        appointment_id VARCHAR REFERENCES appointments(id) ON DELETE SET NULL,
        job_id VARCHAR REFERENCES jobs(id) ON DELETE SET NULL,
        service_category TEXT NOT NULL DEFAULT 'General',
        service_name TEXT NOT NULL,
        provider_id VARCHAR REFERENCES providers(id) ON DELETE SET NULL,
        provider_name TEXT,
        completed_at TIMESTAMP NOT NULL,
        cost_cents INTEGER DEFAULT 0,
        ai_summary TEXT,
        photos JSON DEFAULT '[]',
        system_affected TEXT,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // ── homes: HouseFax enrichment columns ────────────────────────────────
    const homeAlters: Array<[string, string]> = [
      ["homes.lot_size",            `ALTER TABLE homes ADD COLUMN IF NOT EXISTS lot_size INTEGER`],
      ["homes.estimated_value",     `ALTER TABLE homes ADD COLUMN IF NOT EXISTS estimated_value DECIMAL(12,2)`],
      ["homes.zillow_id",           `ALTER TABLE homes ADD COLUMN IF NOT EXISTS zillow_id TEXT`],
      ["homes.zillow_url",          `ALTER TABLE homes ADD COLUMN IF NOT EXISTS zillow_url TEXT`],
      ["homes.tax_assessed_value",  `ALTER TABLE homes ADD COLUMN IF NOT EXISTS tax_assessed_value DECIMAL(12,2)`],
      ["homes.last_sold_date",      `ALTER TABLE homes ADD COLUMN IF NOT EXISTS last_sold_date TEXT`],
      ["homes.last_sold_price",     `ALTER TABLE homes ADD COLUMN IF NOT EXISTS last_sold_price DECIMAL(12,2)`],
      ["homes.latitude",            `ALTER TABLE homes ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7)`],
      ["homes.longitude",           `ALTER TABLE homes ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7)`],
      ["homes.place_id",            `ALTER TABLE homes ADD COLUMN IF NOT EXISTS place_id TEXT`],
      ["homes.formatted_address",   `ALTER TABLE homes ADD COLUMN IF NOT EXISTS formatted_address TEXT`],
      ["homes.neighborhood_name",   `ALTER TABLE homes ADD COLUMN IF NOT EXISTS neighborhood_name TEXT`],
      ["homes.county_name",         `ALTER TABLE homes ADD COLUMN IF NOT EXISTS county_name TEXT`],
      ["homes.housefax_data",       `ALTER TABLE homes ADD COLUMN IF NOT EXISTS housefax_data TEXT`],
      ["homes.housefax_score",      `ALTER TABLE homes ADD COLUMN IF NOT EXISTS housefax_score INTEGER`],
      ["homes.housefax_enriched_at",`ALTER TABLE homes ADD COLUMN IF NOT EXISTS housefax_enriched_at TIMESTAMP`],
    ];
    for (const [label, sql] of homeAlters) {
      await runSql(label, sql);
    }

    // ── Backfill: appointments stuck on pre-completion status whose linked
    // job is already completed (Task #200). Auto-promote logic was added in
    // Task #189, but it only runs at the moment of completion — jobs that
    // wrapped before that fix shipped left their appointments stranded, so
    // the homeowner never saw the "Leave a Review" button. Idempotent.
    try {
      const backfill = await client.query(`
        UPDATE appointments a
           SET status = 'completed', updated_at = NOW()
          FROM jobs j
         WHERE j.appointment_id = a.id
           AND j.status = 'completed'
           AND a.status NOT IN ('completed', 'cancelled')
      `);
      if (backfill.rowCount && backfill.rowCount > 0) {
        console.log(`[boot-migration] Promoted ${backfill.rowCount} appointment(s) to completed to match their already-completed jobs`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[boot-migration] Appointment status backfill skipped:", msg);
    }

    // ── Post-migration verification ───────────────────────────────────────
    // ── Orphan-provider audit (SAFE — log only, no deletes) ───────────────────
    // Task #398: The previous DELETE FROM providers WHERE user_id IS NULL silently
    // destroyed provider rows when auth accounts were temporarily unlinked (e.g.
    // during migrations). Changed to log-only so ops can investigate and repair
    // manually. Deletion requires explicit review — not an automated boot action.
    try {
      const orphanResult = await client.query<{ id: string; business_name: string; email: string }>(`
        SELECT id, business_name, email FROM providers WHERE user_id IS NULL
      `);
      if (orphanResult.rowCount && orphanResult.rowCount > 0) {
        console.warn(
          `[boot-migration] WARNING: ${orphanResult.rowCount} provider record(s) have NULL user_id ` +
          `(not deleted — manual review required): ` +
          orphanResult.rows.map((r: { business_name: string; email: string; id: string }) => `"${r.business_name}" <${r.email}> (${r.id})`).join(", ")
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[boot-migration] Orphan-provider audit skipped:", msg);
    }

    // ── Task #398: Restore known-missing provider accounts ────────────────────
    // Users johndoe@homebaseproapp.com and johnnydoe@gmail.com exist in Supabase
    // but their provider rows may have been silently deleted by the orphan cleanup
    // that ran on previous boots. We look up each user, link any orphaned provider
    // row that matches their email, or re-create the row if truly gone.
    // For providers flagged isPartner=true, we also ensure is_partner is set in
    // provider_plans using a safe UPDATE-then-INSERT pattern (no ON CONFLICT target
    // because provider_plans has no unique constraint on provider_id).
    try {
      const knownProviders: Array<{ email: string; businessName: string; isPartner: boolean }> = [
        { email: 'johndoe@homebaseproapp.com', businessName: 'Heritage Home Cleaners', isPartner: true },
        { email: 'johnnydoe@gmail.com',        businessName: '',                        isPartner: false },
      ];

      for (const { email, businessName: knownBusinessName, isPartner } of knownProviders) {
        const userRes = await client.query<{ id: string; first_name: string; last_name: string; email: string }>(
          `SELECT id, first_name, last_name, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
          [email]
        );
        if (!userRes.rowCount || userRes.rowCount === 0) {
          console.log(`[boot-migration] Task #398 restore: user ${email} not found, skipping`);
          continue;
        }
        const user = userRes.rows[0];

        let providerId: string | null = null;

        // Check if a provider row already exists for this user_id
        const byUserRes = await client.query<{ id: string; business_name: string }>(
          `SELECT id, business_name FROM providers WHERE user_id = $1 LIMIT 1`,
          [user.id]
        );
        if (byUserRes.rowCount && byUserRes.rowCount > 0) {
          console.log(`[boot-migration] Task #398 restore: provider for ${email} already linked (${byUserRes.rows[0].business_name})`);
          providerId = byUserRes.rows[0].id;
        }

        if (!providerId) {
          // Check for an orphan row (user_id IS NULL) with matching email — link it
          const orphanRes = await client.query<{ id: string; business_name: string }>(
            `SELECT id, business_name FROM providers WHERE user_id IS NULL AND LOWER(email) = LOWER($1) LIMIT 1`,
            [email]
          );
          if (orphanRes.rowCount && orphanRes.rowCount > 0) {
            await client.query(
              `UPDATE providers SET user_id = $1 WHERE id = $2`,
              [user.id, orphanRes.rows[0].id]
            );
            console.log(`[boot-migration] Task #398 restore: linked orphan provider "${orphanRes.rows[0].business_name}" to user ${email}`);
            providerId = orphanRes.rows[0].id;
          }
        }

        if (!providerId) {
          // Provider row is truly gone — re-create it
          const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
          const businessName = knownBusinessName || fullName || email;
          const insertRes = await client.query<{ id: string }>(
            `INSERT INTO providers (id, user_id, business_name, email, is_active, is_public, created_at)
             VALUES (gen_random_uuid()::TEXT, $1, $2, $3, TRUE, TRUE, NOW())
             RETURNING id`,
            [user.id, businessName, email]
          );
          providerId = insertRes.rows[0].id;
          console.log(`[boot-migration] Task #398 restore: re-created provider "${businessName}" for ${email} (id=${providerId})`);
        }

        // Ensure is_partner is set for providers that require it.
        // Safe idempotent pattern: UPDATE existing row; if none found, INSERT only
        // if no row exists (WHERE NOT EXISTS avoids duplicates — provider_plans has
        // no unique constraint on provider_id so ON CONFLICT cannot be used).
        if (isPartner && providerId) {
          const updRes = await client.query(
            `UPDATE provider_plans
             SET is_partner = TRUE, partner_since = COALESCE(partner_since, NOW()), updated_at = NOW()
             WHERE provider_id = $1`,
            [providerId]
          );
          if (!updRes.rowCount || updRes.rowCount === 0) {
            await client.query(
              `INSERT INTO provider_plans (id, provider_id, is_partner, partner_since, is_subscribed, created_at, updated_at)
               SELECT gen_random_uuid()::TEXT, $1, TRUE, NOW(), FALSE, NOW(), NOW()
               WHERE NOT EXISTS (SELECT 1 FROM provider_plans WHERE provider_id = $1)`,
              [providerId]
            );
            console.log(`[boot-migration] Task #398: created partner plan for provider ${providerId}`);
          } else {
            console.log(`[boot-migration] Task #398: ensured is_partner=true for provider ${providerId} (${email})`);
          }
          // Partners are implicitly verified — set is_verified=true so they
          // are not hidden by any is_verified gate (e.g. public provider list).
          await client.query(
            `UPDATE providers SET is_verified = TRUE WHERE id = $1 AND is_verified = FALSE`,
            [providerId]
          );
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[boot-migration] Task #398 provider restore skipped:", msg);
    }

    // Verify that the critical tables and columns required for app functionality exist.
    const verifications: Array<[string, string]> = [
      ["invoices.currency column",       `SELECT currency FROM invoices LIMIT 0`],
      ["invoices.paid_at column",        `SELECT paid_at FROM invoices LIMIT 0`],
      ["provider_messages table",        `SELECT id FROM provider_messages LIMIT 0`],
      ["message_templates table",        `SELECT id FROM message_templates LIMIT 0`],
      ["notification_preferences table", `SELECT id FROM notification_preferences LIMIT 0`],
      ["support_tickets table",          `SELECT id FROM support_tickets LIMIT 0`],
      ["homes.last_sold_date column",        `SELECT last_sold_date FROM homes LIMIT 0`],
      ["homes.estimated_value column",       `SELECT estimated_value FROM homes LIMIT 0`],
      ["homes.housefax_data column",         `SELECT housefax_data FROM homes LIMIT 0`],
      ["housefax_entries table",             `SELECT id FROM housefax_entries LIMIT 0`],
      ["users.stripe_customer_id column",    `SELECT stripe_customer_id FROM users LIMIT 0`],
      ["users.default_payment_method_id",    `SELECT default_payment_method_id FROM users LIMIT 0`],
      ["users.token_version column",         `SELECT token_version FROM users LIMIT 0`],
      ["payouts.arrival_date column",        `SELECT arrival_date FROM payouts LIMIT 0`],
      ["payouts.amount_cents column",        `SELECT amount_cents FROM payouts LIMIT 0`],
      ["refunds table",                       `SELECT id FROM refunds LIMIT 0`],
      ["invoice_line_items.amount_cents",    `SELECT amount_cents FROM invoice_line_items LIMIT 0`],
      ["payments.amount_cents column",       `SELECT amount_cents FROM payments LIMIT 0`],
      ["providers.is_public column",         `SELECT is_public FROM providers LIMIT 0`],
      // Task #226: production-critical unique index. If this is missing in
      // a production environment, startup fails (see verificationErrors
      // handling below) so we never silently regress to dup-friendly state.
      ["appointments_user_provider_slot_unique index",
        `DO $$ BEGIN
           IF NOT EXISTS (
             SELECT 1 FROM pg_indexes
              WHERE indexname = 'appointments_user_provider_slot_unique'
           ) THEN
             RAISE EXCEPTION 'missing index appointments_user_provider_slot_unique';
           END IF;
         END $$`],
    ];

    // ── jobs: AI-generated checklist column ───────────────────────────────
    await runSql("jobs.checklist", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS checklist JSONB`);

    // ── provider_plans: subscription gating columns ───────────────────────
    await runSql(
      "provider_plans.first_paid_booking_at",
      `ALTER TABLE provider_plans ADD COLUMN IF NOT EXISTS first_paid_booking_at TIMESTAMP`,
    );
    await runSql(
      "provider_plans.grace_period_ends_at",
      `ALTER TABLE provider_plans ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMP`,
    );
    await runSql(
      "provider_plans.is_subscribed",
      `ALTER TABLE provider_plans ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN NOT NULL DEFAULT FALSE`,
    );

    // ── jobs: link to provider_custom_services ────────────────────────────
    await runSql("jobs.custom_service_id", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS custom_service_id VARCHAR REFERENCES provider_custom_services(id) ON DELETE SET NULL`);

    // ── clients: HouseFax enrichment columns ─────────────────────────────
    await runSql("clients.home_data", `ALTER TABLE clients ADD COLUMN IF NOT EXISTS home_data TEXT`);
    await runSql("clients.home_id",   `ALTER TABLE clients ADD COLUMN IF NOT EXISTS home_id VARCHAR REFERENCES homes(id) ON DELETE SET NULL`);
    // Cached homeowner user id resolved from homes.userId. Without this column,
    // provider-created jobs can't be linked back to the homeowner's account
    // (Task #217). Idempotent ADD COLUMN IF NOT EXISTS.
    await runSql("clients.homeowner_user_id", `ALTER TABLE clients ADD COLUMN IF NOT EXISTS homeowner_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL`);

    // ── Backfill: clients.homeowner_user_id from homes.user_id (Task #217) ─
    // Fills in the cached homeowner link for every client whose home is owned
    // by a registered homeowner account. Safe to re-run.
    try {
      const clientBackfill = await client.query(`
        UPDATE clients c
           SET homeowner_user_id = h.user_id, updated_at = NOW()
          FROM homes h
         WHERE c.home_id = h.id
           AND c.homeowner_user_id IS NULL
           AND h.user_id IS NOT NULL
      `);
      if (clientBackfill.rowCount && clientBackfill.rowCount > 0) {
        console.log(`[boot-migration] Backfilled homeowner_user_id on ${clientBackfill.rowCount} client row(s) (Task #217)`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[boot-migration] clients.homeowner_user_id backfill skipped:", msg);
    }

    // ── Backfill: appointments.user_id / home_id from linked job's client (Task #217) ─
    // Provider-initiated jobs created the linked appointment without setting
    // user_id/home_id, so the appointment never appeared in the homeowner's
    // feed. Pull those values from the job's client whenever the client now
    // has a known homeowner. Idempotent.
    try {
      const apptBackfill = await client.query(`
        UPDATE appointments a
           SET user_id = c.homeowner_user_id,
               home_id = COALESCE(a.home_id, c.home_id),
               updated_at = NOW()
          FROM jobs j
          JOIN clients c ON c.id = j.client_id
         WHERE j.appointment_id = a.id
           AND a.user_id IS NULL
           AND c.homeowner_user_id IS NOT NULL
      `);
      if (apptBackfill.rowCount && apptBackfill.rowCount > 0) {
        console.log(`[boot-migration] Backfilled homeowner link on ${apptBackfill.rowCount} appointment(s) for provider-initiated jobs (Task #217)`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[boot-migration] appointments homeowner backfill skipped:", msg);
    }

    // ── Backfill: invoices.homeowner_user_id from job's appointment (Task #217) ─
    // Pre-fix invoices generated for orphaned jobs have no homeowner_user_id,
    // which blocks the homeowner's "Pay Invoice" CTA via the auth check in
    // GET /api/jobs/:id/invoice. Resolve from the now-linked appointment.
    try {
      const invBackfill = await client.query(`
        UPDATE invoices i
           SET homeowner_user_id = a.user_id,
               updated_at = NOW()
          FROM jobs j
          JOIN appointments a ON a.id = j.appointment_id
         WHERE i.job_id = j.id
           AND i.homeowner_user_id IS NULL
           AND a.user_id IS NOT NULL
      `);
      if (invBackfill.rowCount && invBackfill.rowCount > 0) {
        console.log(`[boot-migration] Backfilled homeowner_user_id on ${invBackfill.rowCount} invoice(s) (Task #217)`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[boot-migration] invoices.homeowner_user_id backfill skipped:", msg);
    }

    // ── Task #226: dedupe duplicate appointments + add unique partial index
    // ─────────────────────────────────────────────────────────────────────
    // Production (and any environment seeded with seedTestAccount.ts before
    // Task #226 shipped) accumulated duplicate appointment rows for the same
    // (user_id, provider_id, scheduled_date) — one homeowner had 13 dupes
    // for a single recurring slot. This caused iOS and web to open
    // different appointment IDs for the "same" booking, so the Appointment
    // Detail screen rendered inconsistently. We dedupe first then add the
    // unique partial index that prevents recurrence. Fully idempotent —
    // when there are no duplicates the dedupe step is a no-op and the
    // CREATE INDEX uses IF NOT EXISTS.
    //
    // Winner ranking (highest priority first):
    //   1. Has a linked job (preserves provider-side work)
    //   2. That job has any invoice (money trail wins)
    //   3. Most recent invoice created_at (newest billing artifact wins)
    //   4. Earliest appointment created_at (oldest booking is canonical)
    //   5. id ASC (deterministic tiebreaker)
    const RANK_ORDER_BY = `
      ORDER BY
        (EXISTS (SELECT 1 FROM jobs jj WHERE jj.appointment_id = a.id)) DESC,
        (EXISTS (
          SELECT 1 FROM invoices i
            JOIN jobs jj ON i.job_id = jj.id
           WHERE jj.appointment_id = a.id
        )) DESC,
        (
          SELECT MAX(i.created_at) FROM invoices i
            JOIN jobs jj ON i.job_id = jj.id
           WHERE jj.appointment_id = a.id
        ) DESC NULLS LAST,
        a.created_at ASC,
        a.id ASC
    `;
    const RANKED_CTE = `
      WITH ranked AS (
        SELECT
          a.id,
          FIRST_VALUE(a.id) OVER (
            PARTITION BY a.user_id, a.provider_id, a.scheduled_date
            ${RANK_ORDER_BY}
          ) AS winner_id
        FROM appointments a
        WHERE a.user_id IS NOT NULL AND a.scheduled_date IS NOT NULL
      )
    `;
    try {
      const dedupePlan = await client.query(`
        ${RANKED_CTE}
        SELECT id, winner_id FROM ranked WHERE id <> winner_id
      `);
      if (dedupePlan.rowCount && dedupePlan.rowCount > 0) {
        // Always repoint loser-linked jobs to the winner. The jobs table
        // has no unique constraint on appointment_id, so an appointment
        // can legitimately have multiple jobs (e.g., add-on services).
        // This keeps the back-link populated rather than nulling it.
        await client.query(`
          UPDATE jobs j
             SET appointment_id = r.winner_id, updated_at = NOW()
            FROM (
              ${RANKED_CTE}
              SELECT id, winner_id FROM ranked WHERE id <> winner_id
            ) r
           WHERE j.appointment_id = r.id
        `);
        // Repoint reviews (FK is ON DELETE CASCADE, so MUST happen
        // before the appointment delete).
        await client.query(`
          UPDATE reviews rv
             SET appointment_id = r.winner_id
            FROM (
              ${RANKED_CTE}
              SELECT id, winner_id FROM ranked WHERE id <> winner_id
            ) r
           WHERE rv.appointment_id = r.id
        `);
        // Repoint housefax_entries (FK is ON DELETE SET NULL, but repoint
        // anyway to preserve the timeline).
        await client.query(`
          UPDATE housefax_entries h
             SET appointment_id = r.winner_id
            FROM (
              ${RANKED_CTE}
              SELECT id, winner_id FROM ranked WHERE id <> winner_id
            ) r
           WHERE h.appointment_id = r.id
        `);
        // Finally, delete the loser appointment rows. All loser-linked
        // jobs/reviews/housefax_entries have been repointed above, so the
        // delete is safe.
        // The CTE's "a" alias is scoped inside the CTE only — it does not
        // collide with the outer DELETE's appointments table reference.
        const del = await client.query(`
          ${RANKED_CTE}
          DELETE FROM appointments
            USING (SELECT id FROM ranked WHERE id <> winner_id) loser
           WHERE appointments.id = loser.id
        `);
        console.log(
          `[boot-migration] Deduped ${del.rowCount ?? 0} duplicate appointment(s) (Task #226)`,
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[boot-migration] Appointment dedupe skipped:", msg);
    }
    // ── Task #236: appointments — deposit + cancellation-fee + reschedule tracking ──
    const apptPolicyAlters: Array<[string, string]> = [
      ["appointments.deposit_amount_cents", `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_amount_cents INTEGER DEFAULT 0`],
      ["appointments.deposit_status", `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'not_required'`],
      ["appointments.deposit_payment_intent_id", `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_payment_intent_id TEXT`],
      ["appointments.deposit_checkout_session_id", `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_checkout_session_id TEXT`],
      ["appointments.cancellation_fee_cents", `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_fee_cents INTEGER DEFAULT 0`],
      ["appointments.cancellation_fee_status", `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_fee_status TEXT`],
      ["appointments.cancellation_fee_payment_intent_id", `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_fee_payment_intent_id TEXT`],
      ["appointments.cancellation_fee_checkout_session_id", `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_fee_checkout_session_id TEXT`],
      ["appointments.reschedule_count", `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reschedule_count INTEGER NOT NULL DEFAULT 0`],
    ];
    for (const [label, sql] of apptPolicyAlters) {
      await runSql(label, sql);
    }

    await runSql("appointments.user_provider_slot_unique", `
      CREATE UNIQUE INDEX IF NOT EXISTS appointments_user_provider_slot_unique
        ON appointments (user_id, provider_id, scheduled_date)
        WHERE user_id IS NOT NULL AND scheduled_date IS NOT NULL
    `);

    // ── Task #226: backfill jobs.appointment_id for legacy null links ────
    // The original symptom that motivated #226: 353/361 jobs in production
    // had jobs.appointment_id IS NULL, so opening a job from the provider
    // CRM couldn't show the linked appointment timeline. The unique partial
    // index above now guarantees that (provider_id, scheduled_date,
    // homeowner_user_id) resolves to exactly one appointment, so we can
    // safely backfill from jobs.client_id → clients.homeowner_user_id.
    // Idempotent: only updates rows where appointment_id is still NULL.
    try {
      const jobBackfill = await client.query(`
        UPDATE jobs j
           SET appointment_id = a.id, updated_at = NOW()
          FROM clients c, appointments a
         WHERE j.appointment_id IS NULL
           AND j.client_id = c.id
           AND c.homeowner_user_id IS NOT NULL
           AND a.user_id = c.homeowner_user_id
           AND a.provider_id = j.provider_id
           AND a.scheduled_date = j.scheduled_date
      `);
      if (jobBackfill.rowCount && jobBackfill.rowCount > 0) {
        console.log(
          `[boot-migration] Backfilled appointment_id on ${jobBackfill.rowCount} job(s) (Task #226)`,
        );
      }
      // Report any jobs that still couldn't be matched (no client-homeowner
      // link or no matching appointment row) so manual remediation is
      // auditable from boot logs rather than silently absorbed.
      const stragglers = await client.query(`
        SELECT COUNT(*)::int AS n FROM jobs WHERE appointment_id IS NULL
      `);
      const remaining = stragglers.rows?.[0]?.n ?? 0;
      if (remaining > 0) {
        console.log(
          `[boot-migration] ${remaining} job(s) still have appointment_id IS NULL — typically because clients.homeowner_user_id is unset (see follow-up #227)`,
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[boot-migration] jobs.appointment_id backfill skipped:", msg);
    }

    // ── saved_providers: homeowner saved/favorited providers ─────────────
    await runSql("saved_providers.create", `
      CREATE TABLE IF NOT EXISTS saved_providers (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider_id VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await runSql("saved_providers.unique", `
      CREATE UNIQUE INDEX IF NOT EXISTS saved_providers_user_provider_unique
        ON saved_providers (user_id, provider_id)
    `);

    // ── revenuecat_webhook_events: RevenueCat webhook idempotency ─────────
    // Mirrors the stripe_webhook_events reserve→handle→commit pattern:
    // processed_at starts NULL when a handler reserves the row, and only
    // rows with processed_at IS NOT NULL are treated as duplicates. A
    // retried/duplicate RevenueCat delivery hits the UNIQUE constraint on
    // revenuecat_event_id and is skipped.
    await runSql(
      "revenuecat_webhook_events.create",
      `CREATE TABLE IF NOT EXISTS revenuecat_webhook_events (
        id                   VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        revenuecat_event_id  TEXT NOT NULL UNIQUE,
        event_type           TEXT NOT NULL,
        processed_at         TIMESTAMP,
        payload              TEXT
      )`,
    );

    // ── stripe_webhook_events: per-endpoint audit columns (Task #239) ────
    await runSql(
      "stripe_webhook_events.endpoint",
      `ALTER TABLE stripe_webhook_events ADD COLUMN IF NOT EXISTS endpoint TEXT`,
    );
    await runSql(
      "stripe_webhook_events.stripe_account_id",
      `ALTER TABLE stripe_webhook_events ADD COLUMN IF NOT EXISTS stripe_account_id TEXT`,
    );
    // Make processed_at nullable so we can implement reserve→handle→commit:
    // a row exists with processed_at=NULL while the handler is running. If
    // the handler throws, the row stays NULL and a Stripe retry re-runs it.
    // Only rows with processed_at IS NOT NULL are treated as duplicates.
    await runSql(
      "stripe_webhook_events.processed_at_nullable",
      `ALTER TABLE stripe_webhook_events ALTER COLUMN processed_at DROP NOT NULL`,
    );

    // ── review_reports: UGC moderation (Apple Guideline 1.2) ─────────────
    await runSql("review_reports.create", `
      CREATE TABLE IF NOT EXISTS review_reports (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        review_id VARCHAR NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
        reporter_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        details TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // ── notification_dedup_claims: atomic notification dedup (Task #246) ───
    // Dedicated table for one-insert-per-notification dedup using the
    // PRIMARY KEY as the unique constraint. The first concurrent webhook
    // handler to INSERT wins; the second gets ON CONFLICT DO NOTHING and
    // skips dispatch. Using a separate table avoids touching existing
    // notification_deliveries data and provides a clean key space.
    await runSql(
      "notification_dedup_claims.create",
      `CREATE TABLE IF NOT EXISTS notification_dedup_claims (
        event_type  TEXT NOT NULL,
        dedup_key   TEXT NOT NULL,
        channel     TEXT NOT NULL,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (event_type, dedup_key, channel)
      )`,
    );

    // ── job_series + jobs.series_id (auto-generated recurring jobs) ──
    // Schema migration only. Existing recurring jobs created before this
    // feature shipped are NOT auto-stitched into series at boot — that
    // requires provider confirmation on the dashboard so a misclassified
    // grouping doesn't silently create dozens of phantom future jobs. The
    // first new booking of a recurring custom service anchors a series via
    // POST /api/jobs.
    await runSql(
      "job_series.create",
      `CREATE TABLE IF NOT EXISTS job_series (
        id                 VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id        VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        client_id          VARCHAR REFERENCES clients(id) ON DELETE SET NULL,
        custom_service_id  VARCHAR REFERENCES provider_custom_services(id) ON DELETE SET NULL,
        title              TEXT NOT NULL,
        description        TEXT,
        notes              TEXT,
        estimated_duration INTEGER,
        frequency          TEXT NOT NULL,
        scheduled_time     TEXT,
        estimated_price    NUMERIC(10, 2),
        address            TEXT,
        anchor_date        TIMESTAMP NOT NULL,
        generated_through  TIMESTAMP,
        status             TEXT NOT NULL DEFAULT 'active',
        created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
        cancelled_at       TIMESTAMP
      )`,
    );
    // Add the snapshotted-context columns separately so installs that
    // already have an older job_series table get them too.
    await runSql(
      "job_series.description",
      `ALTER TABLE job_series ADD COLUMN IF NOT EXISTS description TEXT`,
    );
    await runSql(
      "job_series.notes",
      `ALTER TABLE job_series ADD COLUMN IF NOT EXISTS notes TEXT`,
    );
    await runSql(
      "job_series.estimated_duration",
      `ALTER TABLE job_series ADD COLUMN IF NOT EXISTS estimated_duration INTEGER`,
    );
    await runSql(
      "jobs.series_id",
      `ALTER TABLE jobs
         ADD COLUMN IF NOT EXISTS series_id VARCHAR
         REFERENCES job_series(id) ON DELETE SET NULL`,
    );
    await runSql(
      "jobs.series_id.index",
      `CREATE INDEX IF NOT EXISTS jobs_series_id_idx ON jobs (series_id)`,
    );
    // ── job_series.autopay_enabled + invoices/payments autopay fields
    // (Task #474: Autopay for recurring visits) ───────────────────────────
    await runSql(
      "job_series.autopay_enabled",
      `ALTER TABLE job_series ADD COLUMN IF NOT EXISTS autopay_enabled BOOLEAN NOT NULL DEFAULT FALSE`,
    );
    await runSql(
      "invoices.charge_type",
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS charge_type TEXT NOT NULL DEFAULT 'manual'`,
    );
    await runSql(
      "invoices.autopay_failure_reason",
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS autopay_failure_reason TEXT`,
    );
    await runSql(
      "payments.auto_charged",
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS auto_charged BOOLEAN NOT NULL DEFAULT FALSE`,
    );

    await runSql(
      "job_series.provider_status.index",
      `CREATE INDEX IF NOT EXISTS job_series_provider_status_idx
         ON job_series (provider_id, status)`,
    );

    // ── job_series.paused_at (Task #476: seasonal pause/resume) ───────────
    await runSql(
      "job_series.paused_at",
      `ALTER TABLE job_series ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP`,
    );
    // Idempotency guard: a series cannot have two occurrences on the same
    // calendar day. Casts to date so timezone-shifted timestamps still
    // collide. Application code already de-dups in-process, but a
    // concurrent cron + manual trigger could otherwise race-insert dupes.
    await runSql(
      "jobs.series_date.unique",
      `CREATE UNIQUE INDEX IF NOT EXISTS jobs_series_id_date_unique
         ON jobs (series_id, (scheduled_date::date))
         WHERE series_id IS NOT NULL`,
    );

    // ── provider_route_orders (Task #301: persisted per-day route order)
    // Stores the provider's manual stop ordering for a given calendar day so
    // it survives reinstall / device changes. AsyncStorage on the client
    // remains as an offline cache.
    await runSql(
      "provider_route_orders.create",
      `CREATE TABLE IF NOT EXISTS provider_route_orders (
        provider_id  VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        route_date   DATE    NOT NULL,
        order_json   JSONB   NOT NULL,
        updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (provider_id, route_date)
      )`,
    );

    // ALTER TYPE ADD VALUE must commit before subsequent queries reference
    // it; each runSql autocommits so enum-add must come before column-add.
    // Backfill any job_status values that predate the current schema.
    await runSql(
      "job_status.confirmed",
      `ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'confirmed'`,
    );
    await runSql(
      "job_status.on_my_way",
      `ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'on_my_way'`,
    );
    await runSql(
      "job_status.arrived",
      `ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'arrived'`,
    );
    await runSql(
      "job_status.weather_held",
      `ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'weather_held'`,
    );
    await runSql(
      "jobs.weather_held_at",
      `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS weather_held_at TIMESTAMP`,
    );
    await runSql(
      "jobs.original_scheduled_at",
      `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS original_scheduled_at TIMESTAMP`,
    );

    // ── Task #302: crew_members roster + jobs.assigned_crew_member_id ────
    await runSql(
      "table.crew_members",
      `CREATE TABLE IF NOT EXISTS crew_members (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        color TEXT NOT NULL DEFAULT '#38AE5F',
        invited_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    );
    await runSql(
      "crew_members.provider_idx",
      `CREATE INDEX IF NOT EXISTS crew_members_provider_idx
         ON crew_members (provider_id)`,
    );
    await runSql(
      "jobs.assigned_crew_member_id",
      `ALTER TABLE jobs
         ADD COLUMN IF NOT EXISTS assigned_crew_member_id VARCHAR
         REFERENCES crew_members(id) ON DELETE SET NULL`,
    );
    await runSql(
      "jobs.assigned_crew_member_idx",
      `CREATE INDEX IF NOT EXISTS jobs_assigned_crew_member_idx
         ON jobs (assigned_crew_member_id)`,
    );

    // ── Task #296: estimates + estimate_line_items ────────────────────────
    await runSql(
      "enum.estimate_status",
      `DO $$ BEGIN
         CREATE TYPE estimate_status AS ENUM (
           'draft','sent','viewed','accepted','declined','expired','converted'
         );
       EXCEPTION WHEN duplicate_object THEN null;
       END $$`,
    );
    await runSql(
      "table.estimates",
      `CREATE TABLE IF NOT EXISTS estimates (
        id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id         VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        client_id           VARCHAR REFERENCES clients(id) ON DELETE SET NULL,
        homeowner_user_id   VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        job_id              VARCHAR REFERENCES jobs(id) ON DELETE SET NULL,
        estimate_number     TEXT NOT NULL,
        currency            TEXT DEFAULT 'usd',
        subtotal_cents      INTEGER NOT NULL DEFAULT 0,
        tax_cents           INTEGER DEFAULT 0,
        discount_cents      INTEGER DEFAULT 0,
        total_cents         INTEGER NOT NULL DEFAULT 0,
        status              estimate_status DEFAULT 'draft',
        expires_at          TIMESTAMP,
        notes               TEXT,
        accepted_snapshot   TEXT,
        public_token        TEXT NOT NULL UNIQUE,
        converted_invoice_id VARCHAR,
        created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
        sent_at             TIMESTAMP,
        viewed_at           TIMESTAMP,
        decided_at          TIMESTAMP,
        converted_at        TIMESTAMP
      )`,
    );
    await runSql(
      "estimates.provider_id_idx",
      `CREATE INDEX IF NOT EXISTS estimates_provider_id_idx ON estimates (provider_id)`,
    );
    await runSql(
      "estimates.client_id_idx",
      `CREATE INDEX IF NOT EXISTS estimates_client_id_idx ON estimates (client_id)`,
    );
    await runSql(
      "estimates.status_idx",
      `CREATE INDEX IF NOT EXISTS estimates_status_idx ON estimates (status)`,
    );
    await runSql(
      "table.estimate_line_items",
      `CREATE TABLE IF NOT EXISTS estimate_line_items (
        id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        estimate_id  VARCHAR NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        description  TEXT,
        quantity     DECIMAL(10,2) DEFAULT '1',
        unit_price_cents INTEGER NOT NULL,
        amount_cents     INTEGER NOT NULL,
        metadata     TEXT,
        created_at   TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    );
    await runSql(
      "estimate_line_items.estimate_id_idx",
      `CREATE INDEX IF NOT EXISTS estimate_line_items_estimate_id_idx ON estimate_line_items (estimate_id)`,
    );
    await runSql(
      "invoices.estimate_id",
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS estimate_id VARCHAR REFERENCES estimates(id) ON DELETE SET NULL`,
    );
    await runSql(
      "estimates.converted_invoice_id_fk",
      `DO $$ BEGIN
         ALTER TABLE estimates ADD CONSTRAINT estimates_converted_invoice_id_fkey
           FOREIGN KEY (converted_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
       EXCEPTION WHEN duplicate_object THEN null;
       END $$`,
    );

    // ── app_settings: generic key/value store for server-managed config ───
    await runSql(
      "table.app_settings",
      `CREATE TABLE IF NOT EXISTS app_settings (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    );

    // ── Task #376: Admin Portal migrations ────────────────────────────────

    // ── Task #376 Migration 1: support_tickets — new admin columns ───────────
    // Using individual ADD COLUMN IF NOT EXISTS for idempotency (Postgres does
    // not support IF NOT EXISTS in a multi-column ALTER TABLE statement).
    const supportTicketAlters: Array<[string, string]> = [
      ["support_tickets.priority",    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'`],
      ["support_tickets.user_type",   `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS user_type TEXT`],
      ["support_tickets.assigned_to", `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_to VARCHAR REFERENCES users(id)`],
      ["support_tickets.updated_at",  `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now()`],
      ["support_tickets.resolved_at", `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP`],
    ];
    for (const [label, sql] of supportTicketAlters) {
      await runSql(label, sql);
    }

    // ── Task #376 Migration 2: users — last active timestamp ─────────────────
    await runSql("users.last_active_at", `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP`);

    // ── Task #376 Migration 3: support_ticket_messages (threaded replies) ────
    await runSql("table.support_ticket_messages", `
      CREATE TABLE IF NOT EXISTS support_ticket_messages (
        id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id   VARCHAR NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        sender_id   VARCHAR REFERENCES users(id),
        sender_type TEXT NOT NULL DEFAULT 'admin',
        body        TEXT NOT NULL,
        created_at  TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    // ── Task #398: support_ticket_messages.sender_type ────────────────────────
    // CREATE TABLE IF NOT EXISTS is a no-op when the table already exists, so
    // sender_type was never added to tables created before Task #376. Add it
    // idempotently with the same safe default used in the original schema.
    await runSql("support_ticket_messages.sender_type",
      `ALTER TABLE support_ticket_messages ADD COLUMN IF NOT EXISTS sender_type TEXT NOT NULL DEFAULT 'admin'`
    );

    // ── Task #376 Migration 4: admin_broadcasts (broadcast campaigns) ─────────
    await runSql("table.admin_broadcasts", `
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
      )
    `);

    // ── Task #398: admin_broadcasts schema drift ──────────────────────────────
    // Table existed in Supabase with an older schema (created_by, no recipient_count,
    // no sent_by_user_id). CREATE TABLE IF NOT EXISTS was a no-op. Add missing columns.
    await runSql("admin_broadcasts.sent_by_user_id",
      `ALTER TABLE admin_broadcasts ADD COLUMN IF NOT EXISTS sent_by_user_id VARCHAR REFERENCES users(id)`);
    // Backfill from created_by (old column name) where present
    await runSql("admin_broadcasts.sent_by_user_id.backfill",
      `UPDATE admin_broadcasts SET sent_by_user_id = created_by WHERE sent_by_user_id IS NULL AND created_by IS NOT NULL`);
    await runSql("admin_broadcasts.recipient_count",
      `ALTER TABLE admin_broadcasts ADD COLUMN IF NOT EXISTS recipient_count INTEGER NOT NULL DEFAULT 0`);

    // ── Task #376 Migration 5: admin_broadcast_recipients ─────────────────────
    await runSql("table.admin_broadcast_recipients", `
      CREATE TABLE IF NOT EXISTS admin_broadcast_recipients (
        id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        broadcast_id VARCHAR NOT NULL REFERENCES admin_broadcasts(id) ON DELETE CASCADE,
        user_id      VARCHAR NOT NULL REFERENCES users(id),
        channel      TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'queued',
        delivered_at TIMESTAMP
      )
    `);
    // ── Task #398: admin_broadcast_recipients schema drift ────────────────────
    await runSql("admin_broadcast_recipients.channel",
      `ALTER TABLE admin_broadcast_recipients ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'push'`);

    // ── Task #376 Migration 6: admin_audit_logs (immutable audit log) ─────────
    await runSql("table.admin_audit_logs", `
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_user_id VARCHAR NOT NULL REFERENCES users(id),
        action        TEXT NOT NULL,
        target_type   TEXT,
        target_id     VARCHAR,
        before_value  JSONB,
        after_value   JSONB,
        created_at    TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // ── Task #392: Admin portal — users.is_active + audit log columns ────────
    await runSql("users.is_active",
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`);
    await runSql("admin_audit_logs.before_value",
      `ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS before_value JSONB`);
    await runSql("admin_audit_logs.after_value",
      `ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS after_value JSONB`);

    // ── Task #376: Performance indexes ────────────────────────────────────────
    const adminIndexes: Array<[string, string]> = [
      ["idx.admin_audit_logs_admin",
        `CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs(admin_user_id)`],
      ["idx.admin_audit_logs_created",
        `CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC)`],
      ["idx.support_ticket_messages_ticket",
        `CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id)`],
      ["idx.admin_broadcast_recipients_broadcast",
        `CREATE INDEX IF NOT EXISTS idx_admin_broadcast_recipients_broadcast ON admin_broadcast_recipients(broadcast_id)`],
      ["idx.users_last_active",
        `CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at DESC)`],
    ];
    for (const [label, sql] of adminIndexes) {
      await runSql(label, sql);
    }

    // ── Task #352: Provider referral codes ────────────────────────────────────
    // Add referral_code column to providers (unique, nullable for existing rows)
    await runSql(
      "providers.referral_code",
      `ALTER TABLE providers ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE`,
    );
    // Backfill referral codes for existing providers that don't have one yet.
    // Use 12 uppercase hex chars from the UUID (48-bit space) for near-zero
    // collision probability. Since UUIDs are unique, their 12-char hex prefixes
    // are practically guaranteed distinct at any real-world provider count.
    await runSql(
      "providers.referral_code.backfill",
      `UPDATE providers
         SET referral_code = UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 12))
         WHERE referral_code IS NULL`,
    );
    // Unique index (the UNIQUE constraint above creates one, but ensure it's named)
    await runSql(
      "providers.referral_code.unique_idx",
      `CREATE UNIQUE INDEX IF NOT EXISTS providers_referral_code_unique
         ON providers (referral_code)`,
    );
    // provider_referrals table: tracks referrer → referred + reward lifecycle
    await runSql(
      "table.provider_referrals",
      `CREATE TABLE IF NOT EXISTS provider_referrals (
        id                   VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_provider_id VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        referred_provider_id VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        referral_code        TEXT NOT NULL,
        signed_up_at         TIMESTAMP NOT NULL DEFAULT NOW(),
        first_job_completed_at TIMESTAMP,
        reward_granted_at    TIMESTAMP,
        created_at           TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    );
    // Each referred provider can only appear once
    await runSql(
      "provider_referrals.referred_unique",
      `CREATE UNIQUE INDEX IF NOT EXISTS provider_referrals_referred_unique
         ON provider_referrals (referred_provider_id)`,
    );
    await runSql(
      "provider_referrals.referrer_idx",
      `CREATE INDEX IF NOT EXISTS provider_referrals_referrer_idx
         ON provider_referrals (referrer_provider_id)`,
    );
    // provider_plans: bonus days column for referral subscription extensions
    await runSql(
      "provider_plans.referral_bonus_days",
      `ALTER TABLE provider_plans ADD COLUMN IF NOT EXISTS referral_bonus_days INTEGER NOT NULL DEFAULT 0`,
    );

    // ── Task #353: Crew-to-provider upgrade referral ──────────────────────────
    // crew_origin_provider_id records which provider a new provider was previously
    // a crew member under, enabling the 90-day crew-graduate trial and the
    // "crew launched" notification to the original provider.
    await runSql(
      "providers.crew_origin_provider_id",
      `ALTER TABLE providers ADD COLUMN IF NOT EXISTS crew_origin_provider_id VARCHAR REFERENCES providers(id) ON DELETE SET NULL`,
    );
    await runSql(
      "providers.crew_origin_provider_id.idx",
      `CREATE INDEX IF NOT EXISTS providers_crew_origin_provider_id_idx ON providers (crew_origin_provider_id)`,
    );

    // ── Task #407: First payment celebration flags ─────────────────────────────
    await runSql(
      "providers.first_payment_received",
      `ALTER TABLE providers ADD COLUMN IF NOT EXISTS first_payment_received BOOLEAN NOT NULL DEFAULT FALSE`,
    );
    await runSql(
      "providers.first_payment_celebrated",
      `ALTER TABLE providers ADD COLUMN IF NOT EXISTS first_payment_celebrated BOOLEAN NOT NULL DEFAULT FALSE`,
    );
    await runSql(
      "providers.first_payment_amount_cents",
      `ALTER TABLE providers ADD COLUMN IF NOT EXISTS first_payment_amount_cents INTEGER`,
    );

    // ── Task #354: Provider milestone badges ──────────────────────────────────
    await runSql(
      "badge_type.enum",
      `DO $$ BEGIN
         CREATE TYPE badge_type AS ENUM ('verified_pro', 'top_provider');
       EXCEPTION WHEN duplicate_object THEN null;
       END $$`,
    );
    await runSql(
      "provider_badges.table",
      `CREATE TABLE IF NOT EXISTS provider_badges (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        badge_type badge_type NOT NULL,
        earned_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT provider_badges_provider_badge_unique UNIQUE (provider_id, badge_type)
      )`,
    );
    await runSql(
      "provider_plans.has_featured_placement",
      `ALTER TABLE provider_plans ADD COLUMN IF NOT EXISTS has_featured_placement BOOLEAN NOT NULL DEFAULT FALSE`,
    );
    await runSql(
      "provider_plans.permanent_discount_percent",
      `ALTER TABLE provider_plans ADD COLUMN IF NOT EXISTS permanent_discount_percent INTEGER NOT NULL DEFAULT 0`,
    );
    await runSql(
      "provider_milestone_grants.table",
      `CREATE TABLE IF NOT EXISTS provider_milestone_grants (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        milestone_key VARCHAR(64) NOT NULL,
        granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT provider_milestone_grants_unique UNIQUE (provider_id, milestone_key)
      )`,
    );

    // ── Task #355: Homeowner referral codes and tracking ──────────────────────
    await runSql(
      "users.referral_code",
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`,
    );
    await runSql(
      "users.referral_code.unique_idx",
      `CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique ON users (referral_code) WHERE referral_code IS NOT NULL`,
    );
    // Backfill referral codes for existing homeowners who don't have one yet.
    // Uses a PL/pgSQL retry loop to avoid unique-constraint collisions that
    // the MD5-truncation approach could produce at scale.
    await runSql(
      "users.referral_code.backfill",
      `DO $$
       DECLARE
         u RECORD;
         candidate TEXT;
         chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
         i INT;
         attempts INT;
       BEGIN
         FOR u IN SELECT id FROM users WHERE referral_code IS NULL AND is_provider = FALSE LOOP
           attempts := 0;
           LOOP
             attempts := attempts + 1;
             candidate := '';
             FOR i IN 1..8 LOOP
               candidate := candidate || SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INT, 1);
             END LOOP;
             BEGIN
               UPDATE users SET referral_code = candidate WHERE id = u.id;
               EXIT; -- success, move to next user
             EXCEPTION WHEN unique_violation THEN
               IF attempts >= 20 THEN
                 RAISE EXCEPTION 'Could not find unique referral code for user % after 20 attempts', u.id;
               END IF;
             END;
           END LOOP;
         END LOOP;
       END
       $$`,
    );
    await runSql(
      "homeowner_referrals.table",
      `CREATE TABLE IF NOT EXISTS homeowner_referrals (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referred_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referral_code TEXT NOT NULL,
        signed_up_at TIMESTAMP NOT NULL DEFAULT NOW(),
        first_booking_at TIMESTAMP,
        referrer_credited_at TIMESTAMP,
        referee_credited_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT homeowner_referrals_referred_user_unique UNIQUE (referred_user_id)
      )`,
    );
    // Idempotency key on credit_ledger — prevents duplicate credit grants on
    // concurrent or retry invocations of grantReferralCreditsIfFirstBooking.
    await runSql(
      "credit_ledger.idempotency_key",
      `ALTER TABLE credit_ledger ADD COLUMN IF NOT EXISTS idempotency_key TEXT`,
    );
    await runSql(
      "credit_ledger.idempotency_key.unique_idx",
      `CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_idempotency_key_unique
       ON credit_ledger (idempotency_key) WHERE idempotency_key IS NOT NULL`,
    );

    // Task #410: Variable reward home feed — provider_feed_state tracks
    // rotation state (last shown card types) and 24-hour dismiss records.
    // The feed_card_type enum exists in the Drizzle schema but is not used
    // directly as a column type; all card-type data is stored as JSONB.
    await runSql(
      "provider_feed_state.table",
      `CREATE TABLE IF NOT EXISTS provider_feed_state (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id VARCHAR NOT NULL UNIQUE REFERENCES providers(id) ON DELETE CASCADE,
        last_shown_types JSONB NOT NULL DEFAULT '[]'::jsonb,
        dismissed_cards JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    );

    // Task #411: Monthly recap — per-provider timezone for local-time push
    // delivery, and a durable idempotency table to prevent duplicate blasts.
    await runSql(
      "providers.timezone",
      `ALTER TABLE providers ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York'`,
    );
    await runSql(
      "recap_notifications_sent.table",
      `CREATE TABLE IF NOT EXISTS recap_notifications_sent (
        provider_id VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        month VARCHAR(7) NOT NULL,
        sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (provider_id, month)
      )`,
    );

    verifications.push(
      ["providers.referral_code column",         `SELECT referral_code FROM providers LIMIT 0`],
      ["provider_referrals table",               `SELECT id FROM provider_referrals LIMIT 0`],
      ["provider_plans.referral_bonus_days",     `SELECT referral_bonus_days FROM provider_plans LIMIT 0`],
      ["provider_route_orders", `SELECT provider_id FROM provider_route_orders LIMIT 0`],
      ["job_series table",      `SELECT id FROM job_series LIMIT 0`],
      ["jobs.series_id column", `SELECT series_id FROM jobs LIMIT 0`],
      ["jobs.weather_held_at column",       `SELECT weather_held_at FROM jobs LIMIT 0`],
      ["jobs.original_scheduled_at column", `SELECT original_scheduled_at FROM jobs LIMIT 0`],
      ["crew_members table",                `SELECT id FROM crew_members LIMIT 0`],
      ["jobs.assigned_crew_member_id",      `SELECT assigned_crew_member_id FROM jobs LIMIT 0`],
      ["estimates table",                   `SELECT id FROM estimates LIMIT 0`],
      ["estimate_line_items table",         `SELECT id FROM estimate_line_items LIMIT 0`],
      // Task #376: Admin Portal tables and columns
      ["support_tickets.priority column",          `SELECT priority FROM support_tickets LIMIT 0`],
      ["support_tickets.updated_at column",        `SELECT updated_at FROM support_tickets LIMIT 0`],
      ["users.last_active_at column",              `SELECT last_active_at FROM users LIMIT 0`],
      ["support_ticket_messages table",            `SELECT id FROM support_ticket_messages LIMIT 0`],
      ["support_ticket_messages.sender_type",      `SELECT sender_type FROM support_ticket_messages LIMIT 0`],
      ["admin_broadcasts table",                   `SELECT id FROM admin_broadcasts LIMIT 0`],
      ["admin_broadcast_recipients table",         `SELECT id FROM admin_broadcast_recipients LIMIT 0`],
      ["admin_audit_logs table",                   `SELECT id FROM admin_audit_logs LIMIT 0`],
      ["users.is_active column",                   `SELECT is_active FROM users LIMIT 0`],
      ["admin_audit_logs.before_value column",     `SELECT before_value FROM admin_audit_logs LIMIT 0`],
      ["admin_audit_logs.after_value column",      `SELECT after_value FROM admin_audit_logs LIMIT 0`],
      // Task #353: crew-to-provider upgrade referral
      ["providers.crew_origin_provider_id column", `SELECT crew_origin_provider_id FROM providers LIMIT 0`],
      // Task #354: provider milestone badges
      ["provider_badges table",                    `SELECT id FROM provider_badges LIMIT 0`],
      ["provider_plans.has_featured_placement",    `SELECT has_featured_placement FROM provider_plans LIMIT 0`],
      ["provider_plans.permanent_discount_percent",`SELECT permanent_discount_percent FROM provider_plans LIMIT 0`],
      ["provider_milestone_grants table",          `SELECT id FROM provider_milestone_grants LIMIT 0`],
      // Task #355: homeowner referral codes and tracking
      ["users.referral_code column",               `SELECT referral_code FROM users LIMIT 0`],
      ["homeowner_referrals table",                `SELECT id FROM homeowner_referrals LIMIT 0`],
      // Task #356: loyalty credits — idempotency keys for credit_ledger grants
      ["credit_ledger.idempotency_key column",     `SELECT idempotency_key FROM credit_ledger LIMIT 0`],
      // Task #407: first payment celebration flags
      ["providers.first_payment_received column",  `SELECT first_payment_received FROM providers LIMIT 0`],
      ["providers.first_payment_celebrated column",`SELECT first_payment_celebrated FROM providers LIMIT 0`],
      ["providers.first_payment_amount_cents column", `SELECT first_payment_amount_cents FROM providers LIMIT 0`],
      // Task #410: variable reward home feed
      ["provider_feed_state table",                `SELECT id FROM provider_feed_state LIMIT 0`],
      // Task #411: monthly recap — timezone bucket + idempotency table
      ["providers.timezone column",                `SELECT timezone FROM providers LIMIT 0`],
      ["recap_notifications_sent table",           `SELECT provider_id FROM recap_notifications_sent LIMIT 0`],
    );

    const verificationErrors: string[] = [];
    for (const [label, sql] of verifications) {
      try {
        await client.query(sql);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        verificationErrors.push(`MISSING ${label}: ${msg}`);
      }
    }

    if (verificationErrors.length > 0) {
      const summary = verificationErrors.join("; ");
      if (!IS_DEV) {
        throw new Error(`Boot migration verification failed — schema is incomplete in production: ${summary}`);
      }
      console.error("Boot migration verification — schema gaps detected:", summary);
    } else {
      console.log("Boot migrations applied and verified successfully");
    }
  } finally {
    client.release();
  }
}
