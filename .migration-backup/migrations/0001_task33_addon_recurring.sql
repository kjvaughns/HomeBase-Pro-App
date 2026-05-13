-- Task #33: Revenue growth – rebooking flow, upsell add-ons, repeat service
-- Applied via direct SQL to Supabase (drizzle-kit push requires TTY in this environment)
-- These columns were added to the live database during Task #33 implementation.

ALTER TABLE "provider_custom_services" ADD COLUMN IF NOT EXISTS "is_addon" boolean DEFAULT false NOT NULL;

ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "is_recurring" boolean DEFAULT false NOT NULL;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "recurring_frequency" varchar(32);
