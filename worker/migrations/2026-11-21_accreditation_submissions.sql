-- Full accreditation applications: one row per Stage 2 submission so the
-- admin table can keep the history instead of only the latest payload.
CREATE TABLE IF NOT EXISTS accreditation_submissions (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  submitted_at    TEXT NOT NULL,
  data            TEXT NOT NULL,
  stage1_data     TEXT,
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_accreditation_submissions_org
  ON accreditation_submissions (organization_id, submitted_at DESC);

-- Backfill submissions already stored in applicants.stage2.
INSERT INTO accreditation_submissions
  (id, organization_id, submitted_at, data, stage1_data, created_at)
SELECT
  'sub-' || a.id || '-' || lower(hex(randomblob(6))),
  a.id,
  json_extract(a.stage2, '$.submittedAt'),
  json_extract(a.stage2, '$.data'),
  json_extract(a.stage1, '$.data'),
  json_extract(a.stage2, '$.submittedAt')
FROM applicants a
WHERE a.stage2 IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM accreditation_submissions s
    WHERE s.organization_id = a.id
      AND s.submitted_at = json_extract(a.stage2, '$.submittedAt')
  );
