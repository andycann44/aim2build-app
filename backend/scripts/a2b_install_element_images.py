#!/usr/bin/env python3
"""
a2b_install_element_images.py

Scan Rebrickable element image URLs and cache working ones in lego_catalog.db.

- Reads from:   app/data/lego_catalog.db
- Uses table:   elements(element_id, part_num, color_id, ...)
- Writes to:    element_images(part_num, color_id, img_url)

We DO NOT touch parts.part_img_url here.
"""

import sqlite3
from pathlib import Path
import time

import requests


# Adjust if your path is different, but this should work from repo root.
DB_PATH = Path(__file__).resolve().parents[1] / "app" / "data" / "lego_catalog.db"

ELEMENT_URL = "https://cdn.rebrickable.com/media/parts/elements/{eid}.jpg"
BATCH_SIZE = 500
SLEEP_BETWEEN_REQUESTS = 0.02  # 20ms – tweak if needed


def main() -> None:
    print(f"Using DB: {DB_PATH}")
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    # Helper table: one row per (part_num, color_id)
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS element_images (
            part_num TEXT NOT NULL,
            color_id INTEGER NOT NULL,
            img_url  TEXT NOT NULL,
            PRIMARY KEY (part_num, color_id)
        )
        """
    )
    con.commit()

    # All distinct part/color combos from elements
    cur.execute(
        """
        SELECT MIN(element_id) AS element_id, part_num, color_id
        FROM elements
        GROUP BY part_num, color_id
        """
    )
    rows = cur.fetchall()
    print(f"Distinct (part_num, color_id) combos in elements: {len(rows)}")

    # Which ones we already have cached
    cur.execute("SELECT part_num, color_id FROM element_images")
    existing = {(r["part_num"], r["color_id"]) for r in cur.fetchall()}
    print(f"Already cached rows in element_images: {len(existing)}")

    todo = [r for r in rows if (r["part_num"], r["color_id"]) not in existing]
    print(f"Remaining to test: {len(todo)}")

    session = requests.Session()
    tested = 0
    inserted = 0

    for i in range(0, len(todo), BATCH_SIZE):
        batch = todo[i : i + BATCH_SIZE]
        upserts = []

        for r in batch:
            eid = str(r["element_id"])
            part_num = r["part_num"]
            color_id = int(r["color_id"])
            url = ELEMENT_URL.format(eid=eid)

            ok = False
            try:
                # HEAD is usually enough; swap to GET if needed
                resp = session.head(url, timeout=3)
                ok = resp.status_code == 200
            except Exception:
                ok = False

            tested += 1
            if ok:
                upserts.append((part_num, color_id, url))
                inserted += 1

            time.sleep(SLEEP_BETWEEN_REQUESTS)

        if upserts:
            cur.executemany(
                """
                INSERT OR REPLACE INTO element_images (part_num, color_id, img_url)
                VALUES (?, ?, ?)
                """,
                upserts,
            )
            con.commit()

        print(
            f"Progress: tested={tested}, working={inserted}, "
            f"done={min(tested, len(todo))}/{len(todo)}"
        )

    con.close()
    print("Done populating element_images.")


if __name__ == "__main__":
    main()