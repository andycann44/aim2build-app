#!/usr/bin/env python3
"""
Refill missing part_img_url values in lego_catalog.db using Rebrickable API.

- Looks for parts where part_img_url is NULL or empty.
- For each part, calls Rebrickable /api/v3/lego/parts/{part_num}/
- Writes back any part_img_url it finds.
- Skips parts where the API has no image.

Requires environment variable:
  REBRICKABLE_API_KEY=1ec366df51f8768ac72f5d2947ddb4ac
"""

import argparse
import os
import sqlite3
import sys
import time
import json
from typing import Optional
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

API_BASE = "https://rebrickable.com/api/v3/lego/parts/"


def fetch_part_img_url(part_num: str, api_key: str) -> Optional[str]:
  url = f"{API_BASE}{part_num}/"
  headers = {
    "Accept": "application/json",
    "Authorization": f"key {api_key}",
  }
  req = Request(url, headers=headers)
  try:
    with urlopen(req, timeout=10) as resp:
      data = json.loads(resp.read().decode("utf-8"))
  except HTTPError as e:
    print(f"  {part_num}: HTTP {e.code} {e.reason}", file=sys.stderr)
    return None
  except URLError as e:
    print(f"  {part_num}: URL error {e}", file=sys.stderr)
    return None
  except Exception as e:
    print(f"  {part_num}: error {e}", file=sys.stderr)
    return None

  # Rebrickable returns "part_img_url" and sometimes "part_img_url" only for some parts
  img_url = data.get("part_img_url") or data.get("part_img_url")
  if not img_url:
    # Some parts have only element_img_url; we can optionally use that as fallback
    img_url = data.get("element_img_url")

  return img_url or None


def main() -> int:
  parser = argparse.ArgumentParser()
  parser.add_argument(
    "--db",
    default="backend/app/data/lego_catalog.db",
    help="Path to lego_catalog.db",
  )
  parser.add_argument(
    "--limit",
    type=int,
    default=500,
    help="Max parts to process in this run (default 500)",
  )
  parser.add_argument(
    "--sleep",
    type=float,
    default=0.2,
    help="Seconds to sleep between API calls (default 0.2)",
  )
  args = parser.parse_args()

  api_key = os.environ.get("REBRICKABLE_API_KEY")
  if not api_key:
    print("ERROR: REBRICKABLE_API_KEY env var is not set.", file=sys.stderr)
    return 1

  db_path = args.db
  print(f"Opening database: {db_path}")
  conn = sqlite3.connect(db_path)
  conn.row_factory = sqlite3.Row

  cur = conn.cursor()
  cur.execute(
    """
    SELECT part_num
    FROM parts
    WHERE part_img_url IS NULL
       OR TRIM(part_img_url) = ''
    ORDER BY part_num
    LIMIT ?
    """,
    (args.limit,),
  )
  rows = cur.fetchall()
  total = len(rows)
  print(f"Found {total} parts with missing part_img_url (limit {args.limit}).")

  if not rows:
    conn.close()
    return 0

  updated = 0
  skipped = 0

  for idx, row in enumerate(rows, start=1):
    part_num = row["part_num"]
    print(f"[{idx}/{total}] {part_num}: fetching image URL...")

    img_url = fetch_part_img_url(part_num, api_key)
    if img_url:
      cur.execute(
        "UPDATE parts SET part_img_url = ? WHERE part_num = ?",
        (img_url, part_num),
      )
      updated += 1
      print(f"  -> updated to {img_url}")
    else:
      skipped += 1
      print("  -> no image from API, leaving blank")

    conn.commit()
    time.sleep(args.sleep)

  conn.close()
  print(f"Done. Updated {updated} parts, skipped {skipped} (no image).")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())