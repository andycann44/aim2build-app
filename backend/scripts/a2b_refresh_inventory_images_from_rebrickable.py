#!/usr/bin/env python3
"""
Refresh parts.part_img_url for *inventory* parts only using Rebrickable API.

- Finds all part_nums in backend/app/data/inventory_parts.json
- For those part_nums only, checks parts.part_img_url in lego_catalog.db
- If missing/blank, calls:
    GET https://rebrickable.com/api/v3/lego/parts/{part_num}/
  with your REBRICKABLE_API_KEY
- If part_img_url is returned, updates the DB.
"""

import json
import os
import sqlite3
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]  # backend/
DB_PATH = ROOT / "app" / "data" / "lego_catalog.db"
INV_PATH = ROOT / "app" / "data" / "inventory_parts.json"

API_BASE = "https://rebrickable.com/api/v3/lego/parts/{part_num}/"
API_KEY = os.environ.get("REBRICKABLE_API_KEY")

BATCH_SIZE = 50
SLEEP_BETWEEN_CALLS = 0.2  # ~5 calls/sec
TIMEOUT = 5


def load_inventory_part_nums() -> set[str]:
    if not INV_PATH.exists():
        print(f"Inventory file not found: {INV_PATH}")
        return set()

    with INV_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    # Canonical shape is a list of rows with at least { "part_num": ... }
    part_nums: set[str] = set()
    if isinstance(data, list):
        for row in data:
            pn = str(row.get("part_num") or "").strip()
            if pn:
                part_nums.add(pn)
    elif isinstance(data, dict):
        parts = data.get("parts") or data.get("items") or []
        for row in parts:
            pn = str(row.get("part_num") or "").strip()
            if pn:
                part_nums.add(pn)

    return part_nums


def main() -> None:
    if not API_KEY:
        raise SystemExit("Set REBRICKABLE_API_KEY in your environment first.")

    inv_part_nums = load_inventory_part_nums()
    print(f"Inventory part_nums found: {len(inv_part_nums)}")

    if not inv_part_nums:
        print("No inventory parts to process. Exiting.")
        return

    print(f"Using DB: {DB_PATH}")
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    placeholders = ",".join("?" for _ in inv_part_nums)
    cur.execute(
        f"""
        SELECT part_num
        FROM parts
        WHERE (part_img_url IS NULL OR TRIM(part_img_url) = '')
          AND part_num IN ({placeholders})
          AND part_cat_id NOT IN (
             SELECT part_cat_id
             FROM part_categories
             WHERE lower(name) LIKE '%sticker%'
         )
        """,
        tuple(inv_part_nums),
    )
    missing_rows = cur.fetchall()
    missing_part_nums = [r["part_num"] for r in missing_rows]
    print(f"Inventory parts with missing part_img_url: {len(missing_part_nums)}")

    if not missing_part_nums:
        print("Nothing to update. All inventory parts already have images.")
        con.close()
        return

    session = requests.Session()
    headers = {"Authorization": f"key {API_KEY}"}

    updated = 0
    tested = 0

    for i in range(0, len(missing_part_nums), BATCH_SIZE):
        batch = missing_part_nums[i : i + BATCH_SIZE]

        for part_num in batch:
            url = API_BASE.format(part_num=part_num)
            try:
                resp = session.get(url, headers=headers, timeout=TIMEOUT)
                tested += 1

                if resp.status_code == 200:
                    data = resp.json()
                    img = (data.get("part_img_url") or "").strip()
                    if img:
                        cur.execute(
                            "UPDATE parts SET part_img_url = ? WHERE part_num = ?",
                            (img, part_num),
                        )
                        updated += 1
                elif resp.status_code == 404:
                    # Part not found in Rebrickable API; ignore
                    pass
                else:
                    print(f"Warning: {part_num} -> HTTP {resp.status_code}")
            except Exception as e:
                print(f"Error fetching {part_num}: {e}")

            time.sleep(SLEEP_BETWEEN_CALLS)

        con.commit()
        print(f"Progress: tested={tested}, updated={updated}")

    con.close()
    print(f"Done. Updated {updated} inventory parts with image URLs.")


if __name__ == "__main__":
    main()
