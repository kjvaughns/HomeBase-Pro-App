-- Task #376: Admin Portal — Database Migrations (Section F of homebase-admin-portal-blueprint.md)
-- All statements use IF NOT EXISTS semantics — safe to re-run on every startup.

-- Migration 1: Add columns to support_tickets
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS priority    TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS user_type   TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to VARCHAR REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;

-- Migration 2: Add last_active_at to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP;

-- Migration 3: Support ticket messages (threaded replies)
CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   VARCHAR NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id   VARCHAR REFERENCES users(id),
  sender_type TEXT NOT NULL DEFAULT 'admin',
  body        TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- Migration 4: Admin broadcast campaigns
CREATE TABLE IF NOT EXISTS admin_broadcasts (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by_user_id VARCHAR NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  audience        TEXT NOT NULL,
  channel         TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft',
  sent_at         TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

-- Migration 5: Broadcast recipient tracking
CREATE TABLE IF NOT EXISTS admin_broadcast_recipients (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id VARCHAR NOT NULL REFERENCES admin_broadcasts(id) ON DELETE CASCADE,
  user_id      VARCHAR NOT NULL REFERENCES users(id),
  channel      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'queued',
  delivered_at TIMESTAMP
);

-- Migration 6: Immutable admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id VARCHAR NOT NULL REFERENCES users(id),
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     VARCHAR,
  before_value  JSONB,
  after_value   JSONB,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_admin_broadcast_recipients_broadcast ON admin_broadcast_recipients(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at DESC);
