-- Add UNIQUE constraint to email column in users table
-- Note: SQLite doesn't support adding UNIQUE to existing column directly
-- We need to recreate the table
CREATE TABLE users_new (
  id                   TEXT PRIMARY KEY,
  username             TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email                TEXT NOT NULL DEFAULT '' COLLATE NOCASE UNIQUE,
  password_hash        TEXT,
  role                 TEXT NOT NULL DEFAULT 'applicant',
  status               TEXT NOT NULL DEFAULT 'pending',
  organization_id      TEXT,
  organization_name    TEXT,
  organization_acronym TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

INSERT INTO users_new (id, username, email, password_hash, role, status, organization_id, organization_name, organization_acronym, created_at, updated_at)
SELECT id, username, email, password_hash, role, status, organization_id, organization_name, organization_acronym, created_at, updated_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_email ON users (lower(email));