-- Add admin-editable fields to organizations table
ALTER TABLE organizations ADD COLUMN risk_score INTEGER DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN risk_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN admin_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN accreditation_status TEXT NOT NULL DEFAULT 'not_started';
ALTER TABLE organizations ADD COLUMN priority_level TEXT NOT NULL DEFAULT 'normal';