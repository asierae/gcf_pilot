-- D1 schema for the Averacapital GCF portal.
-- Apply locally:  npx wrangler d1 execute averacapital-db --local --file=worker/schema.sql
-- Apply remotely: npx wrangler d1 execute averacapital-db --remote --file=worker/schema.sql

CREATE TABLE IF NOT EXISTS applicants (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  -- JSON: { submittedAt: string, data: object } | NULL
  stage1      TEXT,
  -- JSON: { submittedAt: string, data: object } | NULL
  stage2      TEXT,
  -- JSON: { status, reviewNotes, lastReviewSent }
  admin       TEXT NOT NULL,
  -- JSON: reserved for future structured data
  extensions  TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_applicants_created_at
  ON applicants (created_at DESC);

CREATE TABLE IF NOT EXISTS leads (
  id                TEXT PRIMARY KEY,
  region            TEXT NOT NULL DEFAULT '',
  country           TEXT NOT NULL DEFAULT '',
  organization      TEXT NOT NULL DEFAULT '',
  acronym           TEXT NOT NULL DEFAULT '',
  entity_type       TEXT NOT NULL DEFAULT '',
  website           TEXT NOT NULL DEFAULT '',
  contact_email     TEXT NOT NULL DEFAULT '',
  climate_specialty TEXT NOT NULL DEFAULT '',
  comments          TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'Pending',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at
  ON leads (created_at DESC);
