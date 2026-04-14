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

    // ── Post-migration verification ───────────────────────────────────────
    // Verify that the critical tables and columns required for app functionality exist.
    const verifications: Array<[string, string]> = [
      ["invoices.currency column",       `SELECT currency FROM invoices LIMIT 0`],
      ["invoices.paid_at column",        `SELECT paid_at FROM invoices LIMIT 0`],
      ["provider_messages table",        `SELECT id FROM provider_messages LIMIT 0`],
      ["message_templates table",        `SELECT id FROM message_templates LIMIT 0`],
      ["notification_preferences table", `SELECT id FROM notification_preferences LIMIT 0`],
      ["support_tickets table",          `SELECT id FROM support_tickets LIMIT 0`],
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
