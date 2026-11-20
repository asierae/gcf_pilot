-- Replace the boolean `favorite` flag with a textual priority level.
-- SQLite has no IF NOT EXISTS for ADD COLUMN/DROP COLUMN: run this once on
-- existing databases. Fresh databases get `priority` from schema.sql.
ALTER TABLE leads ADD COLUMN priority TEXT NOT NULL DEFAULT 'low';

-- Keep the meaning of the rows that were previously starred.
UPDATE leads SET priority = 'high' WHERE favorite = 1;

-- The old flag is no longer read or written anywhere in the app.
ALTER TABLE leads DROP COLUMN favorite;
