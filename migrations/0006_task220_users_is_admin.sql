-- Task #220: DB-backed admin gate for HomeBase Partner activation.
-- Adds users.is_admin so admin access can be granted in-app via
-- `UPDATE users SET is_admin = true WHERE email = '...';` instead of
-- requiring an env-var redeploy. The legacy ADMIN_EMAILS env var is
-- still honored as a fallback by the requireAdmin middleware.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false NOT NULL;
