#!/bin/bash
: "${HISTTIMEFORMAT:=}"; set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ~/aim2build-app)"
DB="backend/app/data/lego_catalog.db"
CSV_DIR="$PWD/csv"
pkill -f "uvicorn.*8000" 2>/dev/null || true
mkdir -p backend/app/data
rm -f "$DB" "$DB-shm" "$DB-wal"

sqlite3 "$DB" <<SQL
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;

DROP TABLE IF EXISTS themes_raw;      CREATE TABLE themes_raw(id TEXT, name TEXT);
DROP TABLE IF EXISTS sets_raw;        CREATE TABLE sets_raw(set_num TEXT, name TEXT, year TEXT, theme_id TEXT, num_parts TEXT, img_url TEXT);
DROP TABLE IF EXISTS inventories_raw; CREATE TABLE inventories_raw(id TEXT, set_num TEXT, version TEXT);
DROP TABLE IF EXISTS inventory_parts_raw; CREATE TABLE inventory_parts_raw(inventory_id TEXT, part_num TEXT, color_id TEXT, quantity TEXT, is_spare TEXT);
DROP TABLE IF EXISTS parts_raw;       CREATE TABLE parts_raw(part_num TEXT, name TEXT, part_cat_id TEXT);
DROP TABLE IF EXISTS colors_raw;      CREATE TABLE colors_raw(id INT, name TEXT, is_transparent INT);

.mode csv
.import '$CSV_DIR/themes.csv' themes_raw
.import '$CSV_DIR/sets.csv' sets_raw
.import '$CSV_DIR/inventories.csv' inventories_raw
.import '$CSV_DIR/inventory_parts.csv' inventory_parts_raw
.import '$CSV_DIR/parts.csv' parts_raw

-- colors: id,name,rgb,is_trans → we import wide then project D as is_trans
DROP TABLE IF EXISTS _colors_full;
CREATE TABLE _colors_full(a TEXT,b TEXT,c TEXT,d TEXT,e TEXT,f TEXT,g TEXT,h TEXT);
.import '$CSV_DIR/colors.csv' _colors_full
INSERT INTO colors_raw(id,name,is_transparent)
SELECT CAST(a AS INT), b,
       CASE LOWER(TRIM(d))
            WHEN '1' THEN 1 WHEN 't' THEN 1 WHEN 'true' THEN 1 WHEN 'yes' THEN 1 WHEN 'y' THEN 1
            ELSE 0
       END
FROM _colors_full
WHERE a GLOB '[0-9]*';

-- Live tables (typed)
DROP TABLE IF EXISTS themes;
CREATE TABLE themes(id INTEGER PRIMARY KEY, name TEXT);

DROP TABLE IF EXISTS sets;
CREATE TABLE sets(
  set_num TEXT PRIMARY KEY,
  name TEXT,
  year INT,
  theme_id INT,
  num_parts INT,
  img_url TEXT
);

DROP TABLE IF EXISTS inventory_parts;
CREATE TABLE inventory_parts(
  set_num TEXT,
  part_num TEXT,
  color_id INT,
  quantity INT,
  PRIMARY KEY(set_num, part_num, color_id)
);

-- Populate
INSERT INTO themes(id,name)
SELECT CAST(id AS INT), name FROM themes_raw
WHERE id GLOB '[0-9]*';

INSERT INTO sets(set_num,name,year,theme_id,num_parts,img_url)
SELECT set_num, name,
       CAST(year AS INT),
       CAST(theme_id AS INT),
       CAST(num_parts AS INT),
       img_url
FROM sets_raw
WHERE set_num LIKE '%-%';  -- enforce dashed ids

INSERT OR REPLACE INTO inventory_parts(set_num,part_num,color_id,quantity)
SELECT inv.set_num,
       ip.part_num,
       CAST(ip.color_id AS INT),
       CAST(SUM(CAST(ip.quantity AS INT)) AS INT)
FROM inventory_parts_raw ip
JOIN inventories_raw inv ON inv.id = ip.inventory_id
WHERE LOWER(COALESCE(ip.is_spare,'0')) NOT IN ('1','t','true','yes','y')
  AND inv.set_num IS NOT NULL
GROUP BY inv.set_num, ip.part_num, ip.color_id;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sets_name ON sets(name);
CREATE INDEX IF NOT EXISTS idx_invparts_set ON inventory_parts(set_num);
CREATE INDEX IF NOT EXISTS idx_invparts_partcolor ON inventory_parts(part_num, color_id);

-- Counts
.headers on
.mode column
SELECT 'sets' AS tbl, COUNT(*) AS rows FROM sets;
SELECT 'inventory_parts' AS tbl, COUNT(*) AS rows FROM inventory_parts;
SELECT '21330-1 sum' AS metric, COALESCE(SUM(quantity),0) FROM inventory_parts WHERE set_num='21330-1';
SQL

echo "Reimport complete -> $DB"
