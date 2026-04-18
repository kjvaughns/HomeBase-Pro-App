-- Task #143: Fix duplicate push notifications
-- Remove duplicate rows from push_tokens, then add a unique constraint on (user_id, token)
-- so the registration upsert path becomes idempotent and the send path can never
-- fan out to multiple identical tokens for the same user.

DELETE FROM "push_tokens" a
USING "push_tokens" b
WHERE a."user_id" = b."user_id"
  AND a."token" = b."token"
  AND (
    a."updated_at" < b."updated_at"
    OR (a."updated_at" = b."updated_at" AND a."id" < b."id")
  );

CREATE UNIQUE INDEX IF NOT EXISTS "push_tokens_user_id_token_unique"
  ON "push_tokens" ("user_id", "token");
