#!/usr/bin/env python3
"""
One-off helper: fill inventory_parts_user_*.json with part_img_url
from lego_catalog.db element_images.

- For each user inventory JSON file:
    backend/app/data/inventory_parts_user_<user_id>.json

  For each row:
    {
      "part_num": "2395",
      "color_id": 72,
      "qty_total": 2,
      "part_img_url": null/absent
    }

  If part_img_url is missing/empty:
    look up element_images(part_num, color_id) and, if found,
    write that img_url into part_img_url.
"""

import json
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "app" / "data"

CATALOG_DB = DATA_DIR / "lego_catalog.db"


def load_inventory_files():
    # inventory_parts_user_*.json
    pattern = "inventory_parts_user_*.json"
    return sorted(DATA_DIR.glob(pattern))


def open_catalog():
    con = sqlite3.connect(str(CATALOG_DB))
    con.row_factory = sqlite3.Row
    return con


def find_element_image(con, part_num: str, color_id: int) -> str | None:
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
    return row["img_url"] if row else None


def enrich_file(path: Path, con: sqlite3.Connection) -> None:
    print(f"Processing {path.name} ...")
    try:
        data = json.loads(path.read_text("utf-8") or "[]")
    except json.JSONDecodeError:
        print(f"  !! Skipping {path.name}: invalid JSON")
        return

    if not isinstance(data, list):
        print(f"  !! Skipping {path.name}: not a list")
        return

    changed = 0
    for row in data:
        part_num = str(row.get("part_num", "")).strip()
        if not part_num:
            continue
        try:
            color_id = int(row.get("color_id", 0))
        except (TypeError, ValueError):
            color_id = 0

        # already has an image? leave it alone
        img = (row.get("part_img_url") or row.get("img_url") or "").strip()
        if img:
            continue

        img_from_db = find_element_image(con, part_num, color_id)
        if img_from_db:
            row["part_img_url"] = img_from_db
            changed += 1

    if changed:
        backup = path.with_suffix(path.suffix + ".bak")
        if not backup.exists():
            backup.write_text(path.read_text("utf-8"), encoding="utf-8")
        path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
        print(f"  Updated {changed} rows, backup saved as {backup.name}")
    else:
        print("  No rows updated.")


def main():
    inv_files = load_inventory_files()
    if not inv_files:
        print("No inventory_parts_user_*.json files found.")
        return

    if not CATALOG_DB.exists():
        print(f"Catalog DB not found at {CATALOG_DB}")
        return

    con = open_catalog()
    try:
        for path in inv_files:
            enrich_file(path, con)
    finally:
        con.close()


if __name__ == "__main__":
    main()