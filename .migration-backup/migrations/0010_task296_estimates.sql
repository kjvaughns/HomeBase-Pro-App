-- Task #296: Estimates as a first-class object (separate from invoices).
--
-- Adds the `estimate_status` enum, the `estimates` parent table and the
-- normalized `estimate_line_items` child table. Also adds a back-reference
-- `estimate_id` column on `invoices` so a converted estimate is linked to
-- the resulting invoice.
--
-- Stripe is intentionally NOT touched: there are no payment_intent /
-- checkout_session / hosted_url columns on estimates. Charging happens
-- only after conversion to an invoice.

DO $$ BEGIN
  CREATE TYPE "estimate_status" AS ENUM (
    'draft',
    'sent',
    'viewed',
    'accepted',
    'declined',
    'expired',
    'converted'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "estimates" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider_id" varchar NOT NULL REFERENCES "providers"("id") ON DELETE CASCADE,
  "client_id" varchar REFERENCES "clients"("id") ON DELETE SET NULL,
  "homeowner_user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "job_id" varchar REFERENCES "jobs"("id") ON DELETE SET NULL,
  "estimate_number" text NOT NULL,
  "currency" text DEFAULT 'usd',
  "subtotal_cents" integer NOT NULL DEFAULT 0,
  "tax_cents" integer DEFAULT 0,
  "discount_cents" integer DEFAULT 0,
  "total_cents" integer NOT NULL DEFAULT 0,
  "status" "estimate_status" DEFAULT 'draft',
  "expires_at" timestamp,
  "notes" text,
  "accepted_snapshot" text,
  "public_token" text NOT NULL UNIQUE,
  "converted_invoice_id" varchar,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "sent_at" timestamp,
  "viewed_at" timestamp,
  "decided_at" timestamp,
  "converted_at" timestamp
);

CREATE INDEX IF NOT EXISTS "estimates_provider_id_idx"
  ON "estimates" ("provider_id");
CREATE INDEX IF NOT EXISTS "estimates_client_id_idx"
  ON "estimates" ("client_id");
CREATE INDEX IF NOT EXISTS "estimates_status_idx"
  ON "estimates" ("status");

CREATE TABLE IF NOT EXISTS "estimate_line_items" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "estimate_id" varchar NOT NULL REFERENCES "estimates"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "quantity" decimal(10, 2) DEFAULT '1',
  "unit_price_cents" integer NOT NULL,
  "amount_cents" integer NOT NULL,
  "metadata" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "estimate_line_items_estimate_id_idx"
  ON "estimate_line_items" ("estimate_id");

-- Back-pointer on invoices so converted estimates link to their invoice.
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "estimate_id" varchar
    REFERENCES "estimates"("id") ON DELETE SET NULL;

-- Wire up the FK on estimates.converted_invoice_id only after invoices.id
-- exists (it does — invoices is created in earlier migrations). We do this
-- as a separate ALTER so the table CREATE above stays self-contained.
DO $$ BEGIN
  ALTER TABLE "estimates"
    ADD CONSTRAINT "estimates_converted_invoice_id_fkey"
    FOREIGN KEY ("converted_invoice_id")
    REFERENCES "invoices"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
