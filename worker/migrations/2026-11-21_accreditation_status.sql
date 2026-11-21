-- Editable accreditation status with the same values as the pre-screening status.
ALTER TABLE accreditation_submissions
  ADD COLUMN status TEXT NOT NULL DEFAULT 'Pending';
