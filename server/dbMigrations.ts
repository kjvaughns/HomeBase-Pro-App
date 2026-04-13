import { pool } from "./db";

/**
 * Boot-time additive schema migration.
 *
 * Adds columns and tables that exist in shared/schema.ts but may be missing
 * from the Supabase database. All statements use IF NOT EXISTS semantics —
 * this is safe to run on every startup and makes no destructive changes.
 *
 * drizzle-kit push requires an interactive TTY and hangs on Supabase's
 * session-mode pooler, so this script handles the additive sync in-process.
 */
export async function runBootMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // ── invoices: columns added after initial schema creation ─────────────
    const invoiceAlters = [
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'usd'`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal_cents INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_cents INTEGER DEFAULT 0`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_cents INTEGER DEFAULT 0`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER DEFAULT 0`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_cents INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_methods_allowed TEXT DEFAULT 'stripe,credits'`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_link_id TEXT`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hosted_invoice_url TEXT`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW() NOT NULL`,
    ];
    for (const sql of invoiceAlters) {
      await client.query(sql);
    }

    // ── enums required by messaging tables ────────────────────────────────
    const enumDefs: Array<[string, string]> = [
      ["notification_channel", "'email','push','in_app','sms'"],
      ["notification_delivery_status", "'queued','sent','delivered','failed','pending_sms'"],
      ["message_channel", "'email','sms'"],
      ["message_status", "'sent','failed','pending_sms'"],
    ];
    for (const [name, values] of enumDefs) {
      await client.query(
        `DO $$ BEGIN CREATE TYPE ${name} AS ENUM (${values}); EXCEPTION WHEN duplicate_object THEN null; END $$`
      );
    }

    // ── push_tokens ───────────────────────────────────────────────────────
    await client.query(`
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
    await client.query(`
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
    await client.query(`
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
    await client.query(`
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
    await client.query(`
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
    await client.query(`
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

    console.log("Boot migrations applied successfully");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Log but don't crash — server can still run if migrations partially fail
    console.warn("Boot migration warning:", message);
  } finally {
    client.release();
  }
}
