PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS set_parts;
DROP TABLE IF EXISTS inventory_parts;
DROP TABLE IF EXISTS inventories;
DROP TABLE IF EXISTS colors;
DROP TABLE IF EXISTS parts;
DROP TABLE IF EXISTS sets;

CREATE TABLE sets (
    set_num   TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    year      INTEGER NOT NULL,
    theme_id  INTEGER NOT NULL,
    num_parts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE parts (
    part_num    TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    part_cat_id INTEGER NOT NULL
);

CREATE TABLE colors (
    color_id INTEGER PRIMARY KEY,
    name     TEXT NOT NULL,
    rgb      TEXT NOT NULL,
    is_trans INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE inventories (
    id      INTEGER PRIMARY KEY,
    version INTEGER NOT NULL,
    set_num TEXT NOT NULL REFERENCES sets(set_num)
);

CREATE TABLE inventory_parts (
    inventory_id INTEGER NOT NULL REFERENCES inventories(id),
    part_num     TEXT NOT NULL,
    color_id     INTEGER NOT NULL,
    quantity     INTEGER NOT NULL,
    is_spare     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (inventory_id, part_num, color_id, is_spare)
);

CREATE TABLE set_parts (
    set_num     TEXT NOT NULL,
    part_num    TEXT NOT NULL,
    color_id    INTEGER NOT NULL,
    qty_per_set INTEGER NOT NULL,
    PRIMARY KEY (set_num, part_num, color_id)
);

CREATE INDEX IF NOT EXISTS idx_set_parts_lookup
    ON set_parts(set_num, part_num, color_id);
