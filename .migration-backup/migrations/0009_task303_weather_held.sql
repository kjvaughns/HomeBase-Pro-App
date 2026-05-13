-- Weather-hold job state, distinct from cancellation. Adds the
-- `weather_held` enum value and two timestamp columns on `jobs` so a held
-- job can be restored back to its original date+time in one tap.

ALTER TYPE "job_status" ADD VALUE IF NOT EXISTS 'weather_held';

ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "weather_held_at" TIMESTAMP;

ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "original_scheduled_at" TIMESTAMP;
