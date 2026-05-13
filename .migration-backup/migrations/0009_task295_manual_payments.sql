-- Task #295: Manual cash/check/other payment recording.
--
-- Adds metadata columns to `payments` so providers can record offline
-- (cash/check/other) payments with optional photo proof and a void/audit
-- trail. Photo files live in the existing `job-photos` Supabase bucket
-- under an `payment-receipts/` prefix.

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "photo_url" text,
  ADD COLUMN IF NOT EXISTS "received_at" timestamp,
  ADD COLUMN IF NOT EXISTS "created_by" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "voided_at" timestamp,
  ADD COLUMN IF NOT EXISTS "voided_by" varchar REFERENCES "users"("id") ON DELETE SET NULL;

-- Backfill received_at from created_at so existing rows have a sensible
-- "received on" date for the Financials list.
UPDATE "payments"
  SET "received_at" = "created_at"
  WHERE "received_at" IS NULL;
