-- Email log for the admin "Send email" page: one row per send operation.
CREATE TABLE IF NOT EXISTS email_log (
  id              TEXT PRIMARY KEY,
  subject         TEXT NOT NULL DEFAULT '',
  title           TEXT NOT NULL DEFAULT '',
  sender_alias    TEXT NOT NULL DEFAULT 'contact',
  recipients      TEXT NOT NULL DEFAULT '[]',
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count      INTEGER NOT NULL DEFAULT 0,
  failed_count    INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'sent',
  created_by      TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_log_created_at
  ON email_log (created_at DESC);
