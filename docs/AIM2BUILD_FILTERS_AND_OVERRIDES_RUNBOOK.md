# Aim2Build Image Overrides

This is the "I can't remember this" runbook for manual part image fixes.

## Source of truth

Images come from the SQLite table:

- `element_images(part_num, color_id, img_url)`
- strict match on `(part_num, color_id)`
- `color_id = 0` is valid (Black) and must be treated normally.

## Where you keep overrides

Keep a repo file:

- `backend/app/data/element_image_overrides.sql`

That file should contain `INSERT OR REPLACE` rows that patch missing images.

## How to add an override

1) Find the part_num and the exact colour_id you need (do not swap colours).
2) Grab an image URL (ideally without the `?querystring` tail).
3) Add a row like this:

```sql
INSERT OR REPLACE INTO element_images (part_num, color_id, img_url)
VALUES ('10197', 0, 'https://cdn.rebrickable.com/media/thumbs/parts/elements/6099801.jpg/250x250p.jpg');
```

## Apply overrides locally

```bash
cd ~/aim2build-app
sqlite3 backend/app/data/lego_catalog.db < backend/app/data/element_image_overrides.sql
```

## Verify it worked

```bash
cd ~/aim2build-app
sqlite3 -header -column backend/app/data/lego_catalog.db \
  "SELECT part_num, color_id, img_url FROM element_images WHERE part_num='10197' AND color_id=0;"
```

## Why you saw that bash error earlier

SQL must be run **inside sqlite3**, not pasted straight into bash.

Wrong (bash will error on parentheses):

```bash
INSERT OR REPLACE INTO element_images (...)
```

Right:

```bash
sqlite3 backend/app/data/lego_catalog.db "INSERT OR REPLACE INTO element_images (...) VALUES (...);"
```

or use the `.sql` file + redirect as shown above.

## Git workflow

```bash
cd ~/aim2build-app
git add backend/app/data/element_image_overrides.sql
git commit -m "data: add element_images overrides"
git push
```
