-- Task #34: HouseFax auto-build from real bookings
-- Creates housefax_entries table to store auto-logged service history
-- Applied via direct SQL (drizzle-kit push requires TTY in this environment)

CREATE TABLE IF NOT EXISTS "housefax_entries" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "home_id" varchar NOT NULL REFERENCES "homes"("id") ON DELETE CASCADE,
  "job_id" varchar REFERENCES "jobs"("id") ON DELETE SET NULL,
  "appointment_id" varchar REFERENCES "appointments"("id") ON DELETE SET NULL,
  "service_category" varchar NOT NULL DEFAULT 'General',
  "service_name" varchar NOT NULL,
  "provider_id" varchar REFERENCES "providers"("id") ON DELETE SET NULL,
  "provider_name" varchar,
  "completed_at" timestamp NOT NULL DEFAULT now(),
  "cost_cents" integer NOT NULL DEFAULT 0,
  "ai_summary" text,
  "photos" jsonb DEFAULT '[]'::jsonb,
  "system_affected" varchar,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "housefax_entries_home_id_idx" ON "housefax_entries" ("home_id");
CREATE INDEX IF NOT EXISTS "housefax_entries_job_id_idx" ON "housefax_entries" ("job_id");
CREATE INDEX IF NOT EXISTS "housefax_entries_completed_at_idx" ON "housefax_entries" ("completed_at" DESC);
