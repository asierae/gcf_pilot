-- Soft-delete flags for the four admin tables that support archiving.
ALTER TABLE leads ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE applicants ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accreditation_submissions ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE readiness_applications ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
