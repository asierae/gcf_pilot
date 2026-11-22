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
  extensions  TEXT NOT NULL DEFAULT '{}',
  -- Soft-delete flag for the admin submissions tables
  archived    INTEGER NOT NULL DEFAULT 0
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
  -- "Check my profile" enquiry (see the profile-assessment page).
  contact_name      TEXT NOT NULL DEFAULT '',
  contact_role      TEXT NOT NULL DEFAULT '',
  objective         TEXT NOT NULL DEFAULT '',
  financing         TEXT NOT NULL DEFAULT '',
  timeline          TEXT NOT NULL DEFAULT '',
  operating_history TEXT NOT NULL DEFAULT '',
  -- JSON array of the documents/capabilities the institution already has.
  available_documents TEXT NOT NULL DEFAULT '[]',
  project_stage     TEXT NOT NULL DEFAULT '',
  project_country   TEXT NOT NULL DEFAULT '',
  project_sector    TEXT NOT NULL DEFAULT '',
  access_type       TEXT NOT NULL DEFAULT '',
  compliance_issues TEXT NOT NULL DEFAULT '',
  challenge         TEXT NOT NULL DEFAULT '',
  engagement        TEXT NOT NULL DEFAULT '',
  consent           INTEGER NOT NULL DEFAULT 0,
  readiness_score   INTEGER NOT NULL DEFAULT 0,
  suggested_route   TEXT NOT NULL DEFAULT '',
  -- manual | import | profile
  source            TEXT NOT NULL DEFAULT 'manual',
  -- low | medium | high | critical (drives the admin leads ordering).
  priority          TEXT NOT NULL DEFAULT 'low',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  archived          INTEGER NOT NULL DEFAULT 0
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
  -- Admin-editable fields
  risk_score          INTEGER DEFAULT NULL,
  risk_notes          TEXT NOT NULL DEFAULT '',
  admin_notes         TEXT NOT NULL DEFAULT '',
  -- Last AI risk analysis (Gemini + Google Search grounding)
  ai_risk_summary     TEXT DEFAULT NULL,
  ai_risk_analyzed_at TEXT DEFAULT NULL,
  accreditation_status TEXT NOT NULL DEFAULT 'not_started',
  priority_level      TEXT NOT NULL DEFAULT 'normal',
  -- Avera audit scores (NULL factor = use the value computed from submissions)
  audit_enabled       INTEGER NOT NULL DEFAULT 0,
  audit_governance    INTEGER DEFAULT NULL,
  audit_financial     INTEGER DEFAULT NULL,
  audit_delivery      INTEGER DEFAULT NULL,
  audit_climate       INTEGER DEFAULT NULL,
  audit_transparency  INTEGER DEFAULT NULL,
  audit_benchmark     INTEGER DEFAULT NULL,
  audit_confidence    INTEGER DEFAULT NULL,
  audit_risk_band     TEXT DEFAULT NULL,
  audit_firm          TEXT NOT NULL DEFAULT '',
  audit_date          TEXT DEFAULT NULL,
  audit_report_url    TEXT NOT NULL DEFAULT '',
  audit_notes         TEXT NOT NULL DEFAULT '',
  audit_updated_at    TEXT DEFAULT NULL,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_acronym
  ON organizations (acronym_norm);

-- Skills used by the admin AI risk analysis. Shared by all organizations.
CREATE TABLE IF NOT EXISTS risk_skills (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

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

-- Stage 2 drafts: one autosaved draft per organization. `year` is a legacy
-- column kept for schema compatibility and is always 0 (migration consolidates
-- the old per-year drafts into a single row).
CREATE TABLE IF NOT EXISTS stage2_drafts (
  organization_id TEXT NOT NULL,
  year            INTEGER NOT NULL DEFAULT 0,
  data            TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (organization_id, year)
);

CREATE INDEX IF NOT EXISTS idx_stage2_drafts_updated_at
  ON stage2_drafts (organization_id, updated_at DESC);

-- Full accreditation applications. A new row is written on every Stage 2
-- submission so the admin keeps the history; applicants.stage2 stays the
-- latest submission used by the dashboards.
CREATE TABLE IF NOT EXISTS accreditation_submissions (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  submitted_at    TEXT NOT NULL,
  data            TEXT NOT NULL,
  stage1_data     TEXT,
  created_at      TEXT NOT NULL,
  archived        INTEGER NOT NULL DEFAULT 0,
  -- Pending | Passed | Failed, same set as the pre-screening status
  status          TEXT NOT NULL DEFAULT 'Pending'
);

CREATE INDEX IF NOT EXISTS idx_accreditation_submissions_org
  ON accreditation_submissions (organization_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS readiness_applications (
  organization_id TEXT PRIMARY KEY,
  submitted_at    TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  data            TEXT NOT NULL,
  archived        INTEGER NOT NULL DEFAULT 0
);

-- Sent-email log for the admin "Send email" page. One row per send
-- operation: `recipients` holds the JSON array of addresses.
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

-- ---------------------------------------------------------------------------
-- Portal accounts
--
-- Passwords are PBKDF2-SHA256 (100k iterations) hashes:
--   pbkdf2$<iterations>$<salt hex>$<hash hex>
-- NULL means the account still needs an invitation/reset to set a password.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
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

CREATE INDEX IF NOT EXISTS idx_users_email ON users (lower(email));

-- One-time links for password resets and account invitations.
CREATE TABLE IF NOT EXISTS user_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  kind       TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_tokens_user
  ON user_tokens (user_id);

-- Seed the accounts that used to live in the Angular demo store so existing
-- users keep working after the move to D1. Passwords are the old demo ones;
-- reset or re-invite them from the Users screen.
INSERT OR IGNORE INTO users (id, username, email, password_hash, role, status, organization_id, organization_name, organization_acronym, created_at, updated_at) VALUES ('usr-001', 'hatyja', 'hatyja@averacapitalaccess.com', 'pbkdf2$100000$b7830e82ed519413b4b2c746d3f58446$7307a17736af57aa4287eef2dc6f4aa5f85bbb41bc0466306c4d143f76d7ce1e', 'admin', 'active', NULL, NULL, NULL, '2024-01-15T09:00:00.000Z', '2024-01-15T09:00:00.000Z');
INSERT OR IGNORE INTO users (id, username, email, password_hash, role, status, organization_id, organization_name, organization_acronym, created_at, updated_at) VALUES ('usr-002', 'sarah.admin', 'sarah.chen@averacapitalaccess.com', 'pbkdf2$100000$79f01530095141fe717031ab76ea0879$18802e3fa1bcf91fc4c2395ddfd3ef2d32083696d3340d2ec71b0b5d30c24f65', 'admin', 'active', NULL, NULL, NULL, '2024-01-15T09:00:00.000Z', '2024-01-15T09:00:00.000Z');
INSERT OR IGNORE INTO users (id, username, email, password_hash, role, status, organization_id, organization_name, organization_acronym, created_at, updated_at) VALUES ('usr-003', 'hatyja2', 'marcos@greenenergy.org', 'pbkdf2$100000$305638622aa1fd96870db5416c5fde63$078addb38456041a042db01ded8f474aa97fc899811c7b181100d162bbfcd63c', 'applicant', 'active', 'org-green-energy-corp', 'Green Energy Corp', 'GEC', '2024-01-15T09:00:00.000Z', '2024-01-15T09:00:00.000Z');
INSERT OR IGNORE INTO users (id, username, email, password_hash, role, status, organization_id, organization_name, organization_acronym, created_at, updated_at) VALUES ('usr-004', 'marcos.oliveira', 'marcos.oliveira@amazonbasin.org', 'pbkdf2$100000$7539fa6d3b98c27415b5ef36eb330b3b$8f3f0cc47d39a29e465abf3b3eab239c3a24e6c83e8707cad7f8736d9127f211', 'applicant', 'active', 'org-amazon-basin', 'Amazon Basin Climate Fund', 'ABCF', '2024-01-15T09:00:00.000Z', '2024-01-15T09:00:00.000Z');
INSERT OR IGNORE INTO users (id, username, email, password_hash, role, status, organization_id, organization_name, organization_acronym, created_at, updated_at) VALUES ('usr-005', 'priya.sharma', 'priya.sharma@saclimate.in', NULL, 'applicant', 'pending', 'org-south-asia', 'South Asia Resilience Initiative', 'SARI', '2024-01-15T09:00:00.000Z', '2024-01-15T09:00:00.000Z');
INSERT OR IGNORE INTO users (id, username, email, password_hash, role, status, organization_id, organization_name, organization_acronym, created_at, updated_at) VALUES ('usr-006', 'james.okoye', 'j.okoye@waga.ng', 'pbkdf2$100000$70bd9ba257981f0b0fb2df7cbcbc6a2c$9b55d8aabdafa8dc608b4c399dee70dfe3c8fc66a04973a4619e9fe4e721fc26', 'applicant', 'active', 'org-west-africa', 'West Africa Green Alliance', 'WAGA', '2024-01-15T09:00:00.000Z', '2024-01-15T09:00:00.000Z');
INSERT OR IGNORE INTO users (id, username, email, password_hash, role, status, organization_id, organization_name, organization_acronym, created_at, updated_at) VALUES ('usr-007', 'fatima.rashid', 'fatima@gulfclimate.ae', NULL, 'applicant', 'pending', 'org-gulf-climate', 'Gulf Region Climate Center', 'GRCC', '2024-01-15T09:00:00.000Z', '2024-01-15T09:00:00.000Z');

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
