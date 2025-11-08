#!/bin/bash
: "${HISTTIMEFORMAT:=}"; set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh
cd "$(dirname "$0")"

mkdir -p csv backend/app/data
pushd csv >/dev/null
curl -fsSLO https://rebrickable.com/media/downloads/sets.csv.gz
curl -fsSLO https://rebrickable.com/media/downloads/inventories.csv.gz
curl -fsSLO https://rebrickable.com/media/downloads/inventory_parts.csv.gz
gunzip -f sets.csv.gz inventories.csv.gz inventory_parts.csv.gz
popd >/dev/null

DB=backend/app/data/lego_catalog.db
rm -f "$DB"

sqlite3 "$DB" <<'SQL'
.mode csv
.headers off

-- Sets (6 cols, keep extra field)
DROP TABLE IF EXISTS sets_new;
CREATE TABLE sets_new(
  set_num   TEXT PRIMARY KEY,
  name      TEXT,
  year      INTEGER,
  theme_id  INTEGER,
  num_parts INTEGER,
  extra     TEXT
);
.import csv/sets.csv sets_new
DELETE FROM sets_new WHERE set_num='set_num';
DROP TABLE IF EXISTS sets;
ALTER TABLE sets_new RENAME TO sets;
CREATE INDEX IF NOT EXISTS idx_sets_num ON sets(set_num);

-- Raw inventories
DROP TABLE IF EXISTS inventories_raw;
CREATE TABLE inventories_raw(
  id INTEGER,
  version INTEGER,
  set_num TEXT
);
.import csv/inventories.csv inventories_raw
DELETE FROM inventories_raw WHERE id='id';

DROP TABLE IF EXISTS inventory_parts_raw;
CREATE TABLE inventory_parts_raw(
  inventory_id INTEGER,
  part_num TEXT,
  color_id INTEGER,
  quantity INTEGER,
  is_spare INTEGER
);
.import csv/inventory_parts.csv inventory_parts_raw
DELETE FROM inventory_parts_raw WHERE inventory_id='inventory_id';

-- Choose the LATEST inventory version per set, exclude spares
WITH latest AS (
  SELECT set_num, MAX(COALESCE(version,0)) AS version
  FROM inventories_raw
  GROUP BY set_num
)
, chosen AS (
  SELECT i.id, i.set_num
  FROM inventories_raw i
  JOIN latest l ON l.set_num=i.set_num AND COALESCE(l.version,0)=COALESCE(i.version,0)
)
DROP TABLE IF EXISTS inventory_parts_new;
CREATE TABLE inventory_parts_new(
  set_num  TEXT,
  part_num TEXT,
  color_id INTEGER,
  quantity INTEGER
);
INSERT INTO inventory_parts_new(set_num, part_num, color_id, quantity)
SELECT c.set_num,
       p.part_num,
       p.color_id,
       SUM(p.quantity) AS qty
FROM inventory_parts_raw p
JOIN chosen c ON c.id = p.inventory_id
WHERE IFNULL(p.is_spare,0)=0
GROUP BY c.set_num, p.part_num, p.color_id;

DROP TABLE IF EXISTS inventory_parts;
ALTER TABLE inventory_parts_new RENAME TO inventory_parts;
CREATE INDEX IF NOT EXISTS idx_invparts_set ON inventory_parts(set_num);
CREATE INDEX IF NOT EXISTS idx_invparts_part_color ON inventory_parts(part_num, color_id);
SQL

echo "✅ Catalog refreshed: $DB"
echo -n "Home Alone total_needed now = "
sqlite3 "$DB" "SELECT SUM(quantity) FROM inventory_parts WHERE set_num='21330-1';"
