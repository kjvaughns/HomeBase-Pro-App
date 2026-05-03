-- Auto-generate recurring jobs.
--
-- Adds a `job_series` table that tracks the metadata for a recurring booking
-- (frequency, anchor date, horizon, snapshotted context) and a `series_id`
-- column on `jobs` so every materialized occurrence can be traced back to
-- its parent series. ON DELETE SET NULL on jobs.series_id preserves
-- completed-job history if the series is later cancelled.

CREATE TABLE IF NOT EXISTS "job_series" (
  "id"                 VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider_id"        VARCHAR NOT NULL REFERENCES "providers"("id") ON DELETE CASCADE,
  "client_id"          VARCHAR REFERENCES "clients"("id") ON DELETE SET NULL,
  "custom_service_id"  VARCHAR REFERENCES "provider_custom_services"("id") ON DELETE SET NULL,
  "title"              TEXT NOT NULL,
  "description"        TEXT,
  "notes"              TEXT,
  "estimated_duration" INTEGER,
  "frequency"          TEXT NOT NULL,
  "scheduled_time"     TEXT,
  "estimated_price"    NUMERIC(10, 2),
  "address"            TEXT,
  "anchor_date"        TIMESTAMP NOT NULL,
  "generated_through"  TIMESTAMP,
  "status"             TEXT NOT NULL DEFAULT 'active',
  "created_at"         TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at"         TIMESTAMP NOT NULL DEFAULT NOW(),
  "cancelled_at"       TIMESTAMP
);

-- Idempotent column adds for environments that already have an older
-- `job_series` table without the snapshotted-context columns.
ALTER TABLE "job_series" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "job_series" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "job_series" ADD COLUMN IF NOT EXISTS "estimated_duration" INTEGER;

ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "series_id" VARCHAR
  REFERENCES "job_series"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "jobs_series_id_idx" ON "jobs" ("series_id");
CREATE INDEX IF NOT EXISTS "job_series_provider_status_idx"
  ON "job_series" ("provider_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "jobs_series_id_date_unique"
  ON "jobs" ("series_id", ("scheduled_date"::date))
  WHERE "series_id" IS NOT NULL;
