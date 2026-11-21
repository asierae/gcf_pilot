-- One Stage 2 draft per organization: keep the most recently saved draft,
-- drop older per-year rows and normalise the legacy `year` column to 0.
DELETE FROM stage2_drafts
WHERE EXISTS (
  SELECT 1 FROM stage2_drafts newer
  WHERE newer.organization_id = stage2_drafts.organization_id
    AND (
      newer.updated_at > stage2_drafts.updated_at
      OR (newer.updated_at = stage2_drafts.updated_at AND newer.rowid > stage2_drafts.rowid)
    )
);

UPDATE stage2_drafts SET year = 0 WHERE year <> 0;
