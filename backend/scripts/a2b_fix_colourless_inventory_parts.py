#!/usr/bin/env python3
"""
Fix 'Colour —' inventory rows using lego_catalog.db.

For each inventory_parts_user_*.json:

- For rows with color_id == 0:
    * Look up all distinct colours for that part_num in the `elements` table.
    * If there is exactly ONE colour, change color_id to that value.

- After updating colours, merge duplicate (part_num, color_id) rows by
  summing qty_total and keeping the first part_img_url.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple

from app.paths import DATA_DIR
from app.catalog_db import db


def get_unique_colour_for_part(part_num: str) -> int | None:
    """
    Return the single colour_id for this part from `elements`
    if and only if there is exactly one non-zero colour.
    Otherwise return None.
    """
    with db() as con:
        cur = con.execute(
            """
            SELECT DISTINCT color_id
            FROM elements
            WHERE part_num = ?
              AND color_id IS NOT NULL
              AND color_id != 0
            """,
            (part_num,),
        )
        colours = [int(r["color_id"]) for r in cur.fetchall()]

    if len(colours) == 1:
        return colours[0]
    return None


def load_inventory(path: Path) -> List[dict]:
    try:
        data = json.loads(path.read_text("utf-8") or "[]")
    except json.JSONDecodeError:
        print(f"  ! Skipping {path.name}: invalid JSON")
        return []
    if not isinstance(data, list):
        print(f"  ! Skipping {path.name}: root is not a list")
        return []
    return data


def save_inventory(path: Path, rows: List[dict]) -> None:
    path.write_text(json.dumps(rows, indent=2, sort_keys=True), encoding="utf-8")


def merge_rows(rows: List[dict]) -> List[dict]:
    """
    Merge rows with the same (part_num, color_id), summing qty_total.
    Prefer the first non-empty part_img_url.
    """
    idx: Dict[Tuple[str, int], dict] = {}

    for r in rows:
        part_num = str(r.get("part_num", "")).strip()
        if not part_num:
            continue
        color_id = int(r.get("color_id", 0))
        qty = int(r.get("qty_total", r.get("qty", r.get("quantity", 0)) or 0))
        key = (part_num, color_id)

        existing = idx.get(key)
        if existing is None:
            # normalise fields
            row = {
                "part_num": part_num,
                "color_id": color_id,
                "qty_total": qty,
            }
            img = r.get("part_img_url") or r.get("img_url")
            if img:
                row["part_img_url"] = img
            idx[key] = row
        else:
            existing["qty_total"] = int(existing.get("qty_total", 0)) + qty
            if not existing.get("part_img_url"):
                img = r.get("part_img_url") or r.get("img_url")
                if img:
                    existing["part_img_url"] = img

    return list(idx.values())


def fix_file(path: Path) -> None:
    print(f"Processing {path.name} ...")
    rows = load_inventory(path)
    if not rows:
        print("  (empty or invalid)")
        return

    changed = 0

    for r in rows:
        part_num = str(r.get("part_num", "")).strip()
        if not part_num:
            continue

        color_id = int(r.get("color_id", 0))
        if color_id != 0:
            continue  # already has a colour

        new_colour = get_unique_colour_for_part(part_num)
        if new_colour is None:
            continue  # ambiguous, leave as Colour —

        r["color_id"] = new_colour
        changed += 1

    if not changed:
        print("  (no colourless rows could be upgraded)")
        return

    # Merge any duplicates created by the colour updates
    merged = merge_rows(rows)
    save_inventory(path, merged)
    print(f"  ✓ Upgraded {changed} colourless rows, {len(rows)} → {len(merged)} rows")


def main() -> None:
    inv_files = sorted(DATA_DIR.glob("inventory_parts_user_*.json"))
    if not inv_files:
        print(f"No inventory_parts_user_*.json files found in {DATA_DIR}")
        return

    print(f"Found {len(inv_files)} inventory file(s) in {DATA_DIR}")
    for path in inv_files:
        fix_file(path)


if __name__ == "__main__":
    main()