BEGIN;

CREATE TABLE IF NOT EXISTS brick_category_images (
  key TEXT,
  label TEXT,
  img_url TEXT,
  sort_order INTEGER,
  is_enabled INTEGER,
  part_cat_id INTEGER,
  parent_key TEXT
);

CREATE TABLE IF NOT EXISTS brick_quickfilter_images (
  key TEXT NOT NULL,
  filter_key TEXT NOT NULL,
  label TEXT NOT NULL,
  img_url TEXT,
  sort_order INTEGER,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  child_part_cat_id INTEGER NOT NULL DEFAULT -1,
  scope_kind TEXT NOT NULL DEFAULT 'cat',
  scope_id INTEGER NOT NULL DEFAULT -1,
  PRIMARY KEY (key, filter_key, scope_kind, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_bqf_key_scope
  ON brick_quickfilter_images(key, scope_kind, scope_id, sort_order);

COMMIT;
