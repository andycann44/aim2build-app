# Aim2Build Data Spine (LOCKED)

## One truth
- The only source of truth is **loose parts inventory**:
  - `user_inventory_parts (user_id, part_num, color_id, qty)`

## Catalog recipe (read-only)
- Set requirements (the BOM) come ONLY from:
  - `lego_catalog.inventories` -> `lego_catalog.inventory_parts`
  - Filter: `COALESCE(inventory_parts.is_spare, 0) = 0`

## Meaning of actions
- "Add set to inventory" means: **I built it, then took it to bits** (parts become loose).
- "My Sets" is a tracking list only; it does **not** imply parts exist in inventory.

## Buildability (strict + capped)
For each required `(part_num, color_id)`:
- `have_for_part = MIN(inventory_qty, required_qty)`
- `total_have = SUM(have_for_part)`
- `total_needed = SUM(required_qty)` (non-spares only)
- `coverage = total_have / total_needed`

## Spares
- Spares are excluded by default (do not pour, do not count as needed).
- If we ever add spares, it must be an explicit toggle (default OFF).

## Images + colors
- Images source of truth:
  - `lego_catalog.element_images (part_num, color_id, img_url)`
- Color id `0` is valid and must be displayed as `0` (never treated as unknown).
