-- Avera risk & reputation audit: optional per-factor scores assigned by Avera.
-- NULL factor scores mean "not audited", so the computed value is kept.
-- Run once on existing databases; fresh databases get these from schema.sql.
ALTER TABLE organizations ADD COLUMN audit_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organizations ADD COLUMN audit_governance INTEGER DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN audit_financial INTEGER DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN audit_delivery INTEGER DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN audit_climate INTEGER DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN audit_transparency INTEGER DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN audit_benchmark INTEGER DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN audit_confidence INTEGER DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN audit_risk_band TEXT DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN audit_firm TEXT NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN audit_date TEXT DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN audit_report_url TEXT NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN audit_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN audit_updated_at TEXT DEFAULT NULL;
