-- Task #302: Crew/employee assignment on jobs.
-- Adds the `crew_members` roster table (one row per crew member per provider)
-- and a nullable `jobs.assigned_crew_member_id` foreign key so each job can
-- be routed to a single crew member. Deleting a crew member sets job
-- assignments to NULL rather than orphaning jobs.

CREATE TABLE IF NOT EXISTS "crew_members" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider_id" VARCHAR NOT NULL REFERENCES "providers"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "color" TEXT NOT NULL DEFAULT '#38AE5F',
  "invited_user_id" VARCHAR REFERENCES "users"("id") ON DELETE SET NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "crew_members_provider_idx"
  ON "crew_members" ("provider_id");

ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "assigned_crew_member_id" VARCHAR
  REFERENCES "crew_members"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "jobs_assigned_crew_member_idx"
  ON "jobs" ("assigned_crew_member_id");
