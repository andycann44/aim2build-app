-- Reference (catalog)
CREATE TABLE IF NOT EXISTS sets (set_num TEXT PRIMARY KEY, name TEXT, year INTEGER);
CREATE TABLE IF NOT EXISTS parts (part_num TEXT PRIMARY KEY, name TEXT);
CREATE TABLE IF NOT EXISTS colors (color_id INTEGER PRIMARY KEY, name TEXT);

-- Rebrickable dump staging
CREATE TABLE IF NOT EXISTS inventories (id INTEGER PRIMARY KEY, version INTEGER NOT NULL, set_num TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS inventory_parts (
  inventory_id INTEGER NOT NULL,
  part_num TEXT NOT NULL,
  color_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  is_spare INTEGER NOT NULL,
  PRIMARY KEY (inventory_id, part_num, color_id, is_spare)
);

-- Derived per-set parts (latest version, non-spare)
CREATE TABLE IF NOT EXISTS set_parts (
  set_num TEXT NOT NULL,
  part_num TEXT NOT NULL,
  color_id INTEGER NOT NULL,
  qty_per_set INTEGER NOT NULL,
  PRIMARY KEY (set_num, part_num, color_id)
);

-- User state
CREATE TABLE IF NOT EXISTS owned_sets (set_num TEXT PRIMARY KEY, qty_owned INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS loose_parts (
  part_num TEXT NOT NULL,
  color_id INTEGER NOT NULL,
  qty_loose INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (part_num, color_id)
);

-- Materialised aggregate
CREATE TABLE IF NOT EXISTS inventory (
  part_num TEXT NOT NULL,
  color_id INTEGER NOT NULL,
  qty_in_sets INTEGER NOT NULL DEFAULT 0,
  qty_loose  INTEGER NOT NULL DEFAULT 0,
  qty_total  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (part_num, color_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_set_parts_set ON set_parts(set_num);
CREATE INDEX IF NOT EXISTS idx_inventory_part_color ON inventory(part_num, color_id);
