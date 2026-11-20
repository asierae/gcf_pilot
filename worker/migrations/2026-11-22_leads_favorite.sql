-- Starred leads: shown first in the admin leads table.
-- Safe to re-run on databases that already have the column? SQLite has no
-- IF NOT EXISTS for ADD COLUMN, so this migration is meant to run once.
ALTER TABLE leads ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
