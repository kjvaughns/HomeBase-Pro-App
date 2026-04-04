-- Task #35: HomeBase full product audit & bug fix
-- 1. Adds recurring service fields to provider_custom_services table
-- 2. Makes appointments.user_id and appointments.home_id nullable for provider-added jobs

ALTER TABLE "provider_custom_services" ADD COLUMN IF NOT EXISTS "is_recurring" boolean DEFAULT false NOT NULL;
ALTER TABLE "provider_custom_services" ADD COLUMN IF NOT EXISTS "recurring_frequency" text;
ALTER TABLE "provider_custom_services" ADD COLUMN IF NOT EXISTS "recurring_price" decimal(10,2);

-- Allow provider-added jobs to create appointments without homeowner user/home context
ALTER TABLE "appointments" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "appointments" ALTER COLUMN "home_id" DROP NOT NULL;
ALTER TABLE "appointments" ALTER COLUMN "scheduled_time" DROP NOT NULL;
