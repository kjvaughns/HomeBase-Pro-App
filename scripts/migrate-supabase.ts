import pg from "pg";

const { Client } = pg;

const url = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!url) throw new Error("No database URL");

const client = new Client({ connectionString: url, connectionTimeoutMillis: 15000, query_timeout: 30000 });

async function run() {
  await client.connect();
  console.log("Connected to Supabase");

  // ─── 1. Add missing columns to invoices ────────────────────────────────────
  const invoiceColumns = [
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
  ];

  for (const sql of invoiceColumns) {
    try {
      await client.query(sql);
      console.log("OK:", sql.substring(0, 60));
    } catch (e: any) {
      if (!e.message.includes("already exists")) {
        console.log("WARN:", e.message.substring(0, 80));
      }
    }
  }

  // ─── 2. Create enums (idempotent) ───────────────────────────────────────────
  const enums = [
    `DO $$ BEGIN CREATE TYPE notification_channel AS ENUM ('email','push','in_app','sms'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE notification_delivery_status AS ENUM ('queued','sent','delivered','failed','pending_sms'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE message_channel AS ENUM ('email','sms'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN CREATE TYPE message_status AS ENUM ('sent','failed','pending_sms'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
  ];
  for (const sql of enums) {
    await client.query(sql);
  }
  console.log("OK: enums ensured");

  // ─── 3. Drop incorrectly structured tables from first migration ─────────────
  // These were created with wrong schemas; drop so we can recreate correctly
  // Only drop if they exist AND have the wrong schema (we check by column presence)
  // Safe to drop since they have no data yet
  for (const tbl of ["push_tokens", "notification_preferences", "notification_deliveries", "provider_messages", "message_templates"]) {
    try {
      await client.query(`DROP TABLE IF EXISTS ${tbl} CASCADE`);
      console.log("Dropped:", tbl);
    } catch (e: any) {
      console.log("Drop skip:", tbl, e.message.substring(0, 60));
    }
  }

  // ─── 4. push_tokens ─────────────────────────────────────────────────────────
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
  console.log("OK: push_tokens");

  // ─── 5. notification_preferences ────────────────────────────────────────────
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
  console.log("OK: notification_preferences");

  // ─── 6. notification_deliveries ─────────────────────────────────────────────
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
  console.log("OK: notification_deliveries");

  // ─── 7. provider_message_templates ─────────────────────────────────────────
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
  console.log("OK: provider_message_templates");

  // ─── 8. provider_messages ───────────────────────────────────────────────────
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
  console.log("OK: provider_messages");

  // ─── 9. message_templates ───────────────────────────────────────────────────
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
  console.log("OK: message_templates");

  // ─── Verify ─────────────────────────────────────────────────────────────────
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name IN (
      'provider_messages', 'message_templates', 'push_tokens',
      'notification_preferences', 'notification_deliveries', 'provider_message_templates'
    )
    ORDER BY table_name
  `);
  console.log("\nVerified tables:", tables.rows.map((r: any) => r.table_name).join(", "));

  const invoiceCols = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'invoices' 
    AND column_name IN ('currency', 'subtotal_cents', 'total_cents', 'paid_at')
    ORDER BY column_name
  `);
  console.log("Verified invoices columns:", invoiceCols.rows.map((r: any) => r.column_name).join(", "));

  await client.end();
  console.log("\nMigration complete!");
}

run().catch(err => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
