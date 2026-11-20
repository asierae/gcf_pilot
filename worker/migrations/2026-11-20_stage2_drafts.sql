-- Stage 2 autosave: one draft per organization and application year.
-- Fresh databases get this table from schema.sql; run once on existing ones.
CREATE TABLE IF NOT EXISTS stage2_drafts (
  organization_id TEXT NOT NULL,
  year            INTEGER NOT NULL,
  data            TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (organization_id, year)
);

CREATE INDEX IF NOT EXISTS idx_stage2_drafts_updated_at
  ON stage2_drafts (organization_id, updated_at DESC);
