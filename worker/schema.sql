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

-- ---------------------------------------------------------------------------
-- Organizations
--
-- One row per organization. The id is also the R2 folder
-- (`organizations/<id>/...`) and the id of the pre-screening applicant row.
-- The acronym is unique: `acronym_norm` (lower + trim) carries the constraint.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organizations (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL DEFAULT '',
  acronym             TEXT NOT NULL DEFAULT '',
  acronym_norm        TEXT NOT NULL DEFAULT '',
  legal_address       TEXT NOT NULL DEFAULT '',
  operational_address TEXT NOT NULL DEFAULT '',
  website             TEXT NOT NULL DEFAULT '',
  country             TEXT NOT NULL DEFAULT '',
  entity_type         TEXT NOT NULL DEFAULT '',
  contact_name        TEXT NOT NULL DEFAULT '',
  contact_email       TEXT NOT NULL DEFAULT '',
  contact_phone       TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_acronym
  ON organizations (acronym_norm);

-- Drafts. The identifier is the organization id: anonymous visitors get a
-- generated one in the URL (`?org=<id>`), signed-in users use their own.
CREATE TABLE IF NOT EXISTS stage1_drafts (
  organization_id TEXT PRIMARY KEY,
  data            TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS readiness_drafts (
  organization_id TEXT PRIMARY KEY,
  data            TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS readiness_applications (
  organization_id TEXT PRIMARY KEY,
  submitted_at    TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  data            TEXT NOT NULL
);

-- Backfill organizations for pre-screening submissions created before the
-- organizations table existed.
INSERT OR IGNORE INTO organizations (
  id, name, acronym, acronym_norm, created_at, updated_at
)
SELECT
  a.id,
  COALESCE(json_extract(a.stage1, '$.data.applicantName'), ''),
  COALESCE(json_extract(a.stage1, '$.data.applicantAcronym'), ''),
  lower(trim(COALESCE(json_extract(a.stage1, '$.data.applicantAcronym'), ''))),
  a.created_at,
  a.updated_at
FROM applicants a
WHERE a.stage1 IS NOT NULL
  AND COALESCE(json_extract(a.stage1, '$.data.applicantAcronym'), '') <> '';
