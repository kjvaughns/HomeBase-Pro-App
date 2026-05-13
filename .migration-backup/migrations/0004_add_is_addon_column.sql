-- Task #35: Add missing is_addon column to provider_custom_services
-- This column was defined in schema.ts but never included in a migration
ALTER TABLE "provider_custom_services" ADD COLUMN IF NOT EXISTS "is_addon" boolean DEFAULT false NOT NULL;

-- Also make jobs.client_id nullable to support provider-initiated jobs (no homeowner link)
ALTER TABLE "jobs" ALTER COLUMN "client_id" DROP NOT NULL;

-- Add is_recurring and recurring_frequency to appointments table (were in schema but never migrated)
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "is_recurring" boolean DEFAULT false;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "recurring_frequency" text;
