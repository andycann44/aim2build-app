-- Aim2Build: set_filters seed list
-- --------------------------------
-- Purpose:
--   A human-editable list of specific set numbers you want Discover to hide.
--   This is applied into lego_catalog.db table: set_filters
--
-- How to apply (from repo root):
--   cd ~/aim2build-app
--   sqlite3 backend/app/data/lego_catalog.db < backend/app/data/seed_set_filters.sql
--
-- Notes:
--   - enabled=1 means "exclude" (hide from Discover)
--   - enabled=0 means "include" (not excluded)
--   - You can add comments at end of a line with -- like this
--
-- Example rows (edit/remove as you like):
INSERT OR REPLACE INTO set_filters(set_num, enabled, reason) VALUES('42141-2', 1, 'Duplicate edition');
INSERT OR REPLACE INTO set_filters(set_num, enabled, reason) VALUES('501-1', 1, 'Bad data / rubbish result');
INSERT OR REPLACE INTO set_filters(set_num, enabled, reason) VALUES('501', 1, 'Duplicate base set');
INSERT OR REPLACE INTO set_filters(set_num, enabled, reason) VALUES('991336-1', 1, 'Parts pack, not a real set');
INSERT OR REPLACE INTO set_filters(set_num, enabled, reason) VALUES('5004059-1', 1, 'Parts pack, not a real set');
INSERT OR REPLACE INTO set_filters(set_num, enabled, reason) VALUES('9943-1', 1, 'axels and wheels pack, not a real set');
INSERT OR REPLACE INTO set_filters(set_num, enabled, reason) VALUES('5003200-1', 1, 'Parts pack, not a real set');
INSERT OR REPLACE INTO set_filters(set_num, enabled, reason) VALUES('5020-1', 1, 'Parts pack, not a real set');
INSERT OR REPLACE INTO set_filters(set_num, enabled, reason) VALUES('10065-1', 1, 'Parts pack, not a real set');

