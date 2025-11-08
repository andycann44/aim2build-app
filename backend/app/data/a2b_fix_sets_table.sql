-- Aim2Build: fix sets table to 6 columns and reimport from sets.csv

DROP TABLE IF EXISTS sets_new;
CREATE TABLE sets_new(
  set_num   TEXT PRIMARY KEY,
  name      TEXT,
  year      INTEGER,
  theme_id  INTEGER,
  num_parts INTEGER,
  extra     TEXT
);

.mode csv
.import sets.csv sets_new
DELETE FROM sets_new WHERE set_num='set_num';  -- drop header row if present

DROP TABLE IF EXISTS sets;
ALTER TABLE sets_new RENAME TO sets;
CREATE INDEX IF NOT EXISTS idx_sets_num ON sets(set_num);
