-- One-shot migration: global AI risk-analysis skills + AI analysis summary
-- stored on each organization.
CREATE TABLE IF NOT EXISTS risk_skills (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

ALTER TABLE organizations ADD COLUMN ai_risk_summary TEXT;
ALTER TABLE organizations ADD COLUMN ai_risk_analyzed_at TEXT;
