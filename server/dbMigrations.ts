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

    // ── payouts: arrival_date column (missing from initial schema deployment) ──
    await runSql("payouts.arrival_date", `ALTER TABLE payouts ADD COLUMN IF NOT EXISTS arrival_date TIMESTAMP`);

    // ── enums required by messaging/notification tables ────────────────────
    const enumDefs: Array<[string, string]> = [
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

    // ── provider_message_templates ────────────────────────────────────────
    await runSql("table.provider_message_templates", `
      CREATE TABLE IF NOT EXISTS provider_message_templates (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        provider_id VARCHAR NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        subject TEXT,
        body TEXT NOT NULL,
        event_type TEXT,
        is_default BOOLEAN DEFAULT FALSE,
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

    // ── provider_custom_services: AI Blueprint fields ────────────────────
    const customServiceAlters: Array<[string, string]> = [
      ["provider_custom_services.intake_questions_json", `ALTER TABLE provider_custom_services ADD COLUMN IF NOT EXISTS intake_questions_json TEXT`],
      ["provider_custom_services.add_ons_json",          `ALTER TABLE provider_custom_services ADD COLUMN IF NOT EXISTS add_ons_json TEXT`],
      ["provider_custom_services.booking_mode",          `ALTER TABLE provider_custom_services ADD COLUMN IF NOT EXISTS booking_mode TEXT DEFAULT 'instant'`],
      ["provider_custom_services.ai_pricing_insight",    `ALTER TABLE provider_custom_services ADD COLUMN IF NOT EXISTS ai_pricing_insight TEXT`],
    ];
    for (const [label, sql] of customServiceAlters) {
      await runSql(label, sql);
    }

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

    // ── Post-migration verification ───────────────────────────────────────
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
      ["users.stripe_customer_id column",    `SELECT stripe_customer_id FROM users LIMIT 0`],
      ["users.default_payment_method_id",    `SELECT default_payment_method_id FROM users LIMIT 0`],
      ["users.token_version column",         `SELECT token_version FROM users LIMIT 0`],
      ["payouts.arrival_date column",        `SELECT arrival_date FROM payouts LIMIT 0`],
    ];

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
