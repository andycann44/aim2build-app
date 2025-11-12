# Aim2Build — Backend Snapshot (Buildability + Inventory + MySets + Wishlist)

## Health
- GET `/api/health` → `{ "ok": true }`

## Catalog (from SQLite `backend/app/data/lego_catalog.db`)
- GET `/api/catalog/parts?set=<set_num>` (aliases: `set|set_num|id`)
  - Validates set exists in `sets`
  - Returns `{ set_num, parts: [ { part_num, color_id, quantity } ] }`
  - Uses table `inventory_parts_summary` (pre-aggregated; **spares excluded**)

### Refreshing the catalog database
- `./a2b_refresh_catalog.sh`
  - Downloads all 12 Rebrickable CSV exports, rebuilds the SQLite database, and prints table counts.
  - If a download fails with `curl: (56)`, the script now surfaces that it is a network read error—rerun or use the offline re-import helper below.
- `./backend/scripts/a2b_catalog_reimport.sh [/path/to/csvs]`
  - Rebuilds the same database from CSV files already on disk; pass the directory as the first argument or set `CSV_DIR`.
  - `minifig_parts.csv` is optional—if it is not present, the importer creates an empty table and continues.

## Inventory (JSON file `backend/app/data/inventory_parts.json`)
- GET `/api/inventory/parts` → `[ { part_num, color_id, qty_total }, ... ]`
- POST `/api/inventory/add` body: `{ part_num, color_id, qty_total }`
- POST `/api/inventory/replace` body: `[ { ... }, ... ]` (overwrites)
- DELETE `/api/inventory/part?part_num=...&color_id=...`
- DELETE `/api/inventory/clear?confirm=YES`
- POST `/api/inventory/decrement` body: `{ part_num, color_id, qty }`
- POST `/api/inventory/batch_decrement` body: `[ { part_num, color_id, qty }, ... ]`
- POST `/api/inventory/batch_delete` body: `[ { part_num, color_id }, ... ]`
- Behavior: quantities never negative; rows auto-removed at `qty_total == 0`.

## Buildability (compare set vs your inventory)
- GET `/api/buildability/compare?set=<set_num>` (aliases: `set|set_num|id`)
  - Response example (fields):
    - `set_num`, `coverage`, `total_needed`, `total_have`, `missing_parts[]`
  - `coverage = total_have / total_needed`

## My Sets (JSON file `backend/app/data/my_sets.json`)
- GET `/api/mysets` → `{ "sets": [ { set_num, name?, year?, num_parts?, img_url? }, ... ] }`
- POST `/api/mysets/add?set=<set_num>` → `{ ok, count }` (duplicate-safe)
- DELETE `/api/mysets/remove?set=<set_num>` → `{ ok, removed, count }`
- Accepts dashed (`21330-1`) **or** plain (`21330`) IDs; resolves to latest.

## Wishlist (JSON file `backend/app/data/wishlist.json`)
- GET `/api/wishlist` → `{ "sets": [ { set_num }, ... ] }`
- POST `/api/wishlist/add?set=<set_num>` → `{ ok, count }` (duplicate-safe)
- DELETE `/api/wishlist/remove?set=<set_num>` → `{ ok, removed, count }`

## Data Sources / Tables
- SQLite file: `backend/app/data/lego_catalog.db`
  - **sets**: `(set_num TEXT, name TEXT, year INT, num_parts INT, ... )`
  - **inventory_parts_summary**: `(set_num TEXT, part_num TEXT, color_id INT, quantity INT)`
    - Built from Rebrickable `inventories.csv` + `inventory_parts.csv`, **spares excluded**.
- Local inventory file: `backend/app/data/inventory_parts.json` (user-owned bricks)

## Known-good check
- Set `71819-1` returns `total_needed: 708`.
- Coverage responds to `inventory_parts.json` updates in real time.
