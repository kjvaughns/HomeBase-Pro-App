import pg from "pg";

const { Client } = pg;

/**
 * Additive-only schema sync script for Supabase.
 * 
 * This script adds missing columns and tables to bring Supabase in sync
 * with shared/schema.ts. It is safe to re-run — all operations use
 * IF NOT EXISTS / IF NOT EXISTS semantics and never drop anything.
 *
 * Run: npx tsx scripts/migrate-supabase.ts
 */

const url = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!url) throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL must be set");

const client = new Client({
  connectionString: url,
  connectionTimeoutMillis: 15000,
  query_timeout: 30000,
});

async function safeAlter(sql: string): Promise<void> {
  try {
    await client.query(sql);
    console.log("  ok:", sql.substring(0, 70));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("already exists") && !message.includes("duplicate column")) {
      console.warn("  warn:", message.substring(0, 100));
    }
  }
}

async function run(): Promise<void> {
  await client.connect();
  console.log("Connected to Supabase\n");

  // ─── 1. Add missing columns to invoices ───────────────────────────────────
  console.log("Step 1: Adding missing invoice columns…");
  await safeAlter(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'usd'`);
  await safeAlter(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal_cents INTEGER NOT NULL DEFAULT 0`);
  await safeAlter(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_cents INTEGER DEFAULT 0`);
  await safeAlter(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_cents INTEGER DEFAULT 0`);
  await safeAlter(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER DEFAULT 0`);
  await safeAlter(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_cents INTEGER NOT NULL DEFAULT 0`);
  await safeAlter(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_methods_allowed TEXT DEFAULT 'stripe,credits'`);
  await safeAlter(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT`);
  await safeAlter(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT`);
  await safeAlter(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_link_id TEXT`);
  await safeAlter(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hosted_invoice_url TEXT`);
  await safeAlter(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP`);
  await safeAlter(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP`);
  await safeAlter(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`);
  await safeAlter(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW() NOT NULL`);

  // ─── 2. Create PostgreSQL enums (idempotent) ───────────────────────────────
  console.log("\nStep 2: Ensuring enums exist…");
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
    console.log(`  ok: ${name}`);
  }

  // ─── 3. Create missing tables (additive only) ─────────────────────────────
  console.log("\nStep 3: Creating missing tables…");

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
  console.log("  ok: push_tokens");

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
  console.log("  ok: notification_preferences");

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
  console.log("  ok: notification_deliveries");

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
  console.log("  ok: provider_message_templates");

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
  console.log("  ok: provider_messages");

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
  console.log("  ok: message_templates");

  // ─── Verify ────────────────────────────────────────────────────────────────
  console.log("\nVerification:");
  const tablesRes = await client.query<{ table_name: string }>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
      'provider_messages','message_templates','push_tokens',
      'notification_preferences','notification_deliveries','provider_message_templates'
    )
    ORDER BY table_name
  `);
  console.log("  tables:", tablesRes.rows.map(r => r.table_name).join(", "));

  const colsRes = await client.query<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
    AND column_name IN ('currency','updated_at','subtotal_cents','total_cents','paid_at')
    ORDER BY column_name
  `);
  console.log("  invoices cols:", colsRes.rows.map(r => r.column_name).join(", "));

  await client.end();
  console.log("\nMigration complete!");
}

run().catch(err => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("Migration failed:", message);
  process.exit(1);
});
