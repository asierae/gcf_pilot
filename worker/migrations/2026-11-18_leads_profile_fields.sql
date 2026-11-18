-- Add the "Check my profile" enquiry fields to the existing leads table.
--
-- schema.sql creates these columns for fresh databases; this migration adds
-- them to a database created before the profile assessment existed.
-- Re-running it fails on the second attempt ("duplicate column name"), which is
-- expected — just ignore that error, or apply it once.

ALTER TABLE leads ADD COLUMN contact_name TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN contact_role TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN objective TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN financing TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN timeline TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN operating_history TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN available_documents TEXT NOT NULL DEFAULT '[]';
ALTER TABLE leads ADD COLUMN project_stage TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN project_country TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN project_sector TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN access_type TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN compliance_issues TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN challenge TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN engagement TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN readiness_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN suggested_route TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
