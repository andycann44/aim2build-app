#!/usr/bin/env python3
"""
Refresh inventory JSON image URLs from lego_catalog.db.

For each inventory_parts_user_*.json file in DATA_DIR:

- For each (part_num, color_id) row:
    * Resolve the best image URL from element_images (same rules as
      inventory router: exact colour first, then any colour).
    * If found, update row["part_img_url"] to that URL.

This does NOT change colour IDs or quantities.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from app.paths import DATA_DIR
from app.catalog_db import db


def resolve_img_url(part_num: str, color_id: int) -> Optional[str]:
    """Resolve a part image using element_images, matching inventory logic."""
    with db() as con:
        # 1) exact colour match when colour is known
        if color_id != 0:
            cur = con.execute(
                """
                SELECT img_url
                FROM element_images
                WHERE part_num = ?
                  AND color_id = ?
                  AND img_url IS NOT NULL
                  AND TRIM(img_url) != ''
                LIMIT 1
                """,
                (part_num, color_id),
            )
            row = cur.fetchone()
            if row and row["img_url"]:
                return row["img_url"]

        # 2) any image for that part as representative (for colour_id == 0
        #    or when that specific colour has no element image)
        cur_any = con.execute(
            """
            SELECT img_url
            FROM element_images
            WHERE part_num = ?
              AND img_url IS NOT NULL
              AND TRIM(img_url) != ''
            ORDER BY color_id
            LIMIT 1
            """,
            (part_num,),
        )
        row_any = cur_any.fetchone()
        if row_any and row_any["img_url"]:
            return row_any["img_url"]

    return None


def refresh_file(path: Path) -> None:
    print(f"Refreshing images in {path.name} ...")
    try:
        data = json.loads(path.read_text("utf-8") or "[]")
    except json.JSONDecodeError:
        print(f"  ! Skipping {path.name}: invalid JSON")
        return

    if not isinstance(data, list):
        print(f"  ! Skipping {path.name}: root is not a list")
        return

    changed = 0
    for row in data:
        part_num = str(row.get("part_num", "")).strip()
        if not part_num:
            continue

        color_id = int(row.get("color_id", 0))
        new_img = resolve_img_url(part_num, color_id)
        if not new_img:
            continue

        old_img = row.get("part_img_url") or row.get("img_url")
        if old_img != new_img:
            row["part_img_url"] = new_img
            changed += 1

    if changed:
        path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
        print(f"  ✓ Updated {changed} entries")
    else:
        print("  (no changes)")


def main() -> None:
    inv_files = sorted(DATA_DIR.glob("inventory_parts_user_*.json"))
    if not inv_files:
        print("No inventory_parts_user_*.json files found in DATA_DIR.")
        print(f"DATA_DIR = {DATA_DIR}")
        return

    print(f"Found {len(inv_files)} inventory file(s) in {DATA_DIR}")
    for f in inv_files:
        refresh_file(f)


if __name__ == "__main__":
    main()