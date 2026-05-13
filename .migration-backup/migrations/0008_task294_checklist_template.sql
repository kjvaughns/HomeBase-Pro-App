-- Per-service custom job checklists.
--
-- Adds `checklist_template_json` (JSONB) to `provider_custom_services`. Each
-- service can carry an ordered default checklist `[{id,label}]` that is
-- materialized (with `completed: false` per item) into a job's checklist
-- JSONB column at job-creation time.

ALTER TABLE "provider_custom_services"
  ADD COLUMN IF NOT EXISTS "checklist_template_json" JSONB;
