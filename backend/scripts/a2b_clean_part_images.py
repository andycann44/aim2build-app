#!/usr/bin/env python3
"""
a2b_clean_part_images.py

Dry-run tool to find and optionally clear broken part_img_url values
in lego_catalog.db.

Usage (dry run only):
    python backend/scripts/a2b_clean_part_images.py \
        --db backend/app/data/lego_catalog.db

Apply mode (actually clears broken URLs):
    python backend/scripts/a2b_clean_part_images.py \
        --db backend/app/data/lego_catalog.db --apply

A CSV report of broken URLs is written by default.
"""

import argparse
import csv
import sqlite3
import sys
import time
from typing import Optional, Tuple
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError


def check_url(url: str, timeout: float = 5.0) -> Tuple[Optional[int], str]:
    """
    Returns (status_code, error_message).

    status_code:
        - int HTTP status on success
        - None on network / other error

    error_message:
        - "" on OK
        - string description on error
    """
    try:
        # Many CDNs accept HEAD; if not, they'll usually error fast.
        req = Request(url, method="HEAD")
        with urlopen(req, timeout=timeout) as resp:
            return resp.status, ""
    except HTTPError as e:
        return e.code, f"HTTPError: {e}"
    except URLError as e:
        return None, f"URLError: {e}"
    except Exception as e:
        return None, f"Error: {e}"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scan parts.part_img_url and clear broken URLs."
    )
    parser.add_argument(
        "--db",
        default="backend/app/data/lego_catalog.db",
        help="Path to lego_catalog.db (default: backend/app/data/lego_catalog.db)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of parts to check (for testing).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually clear broken URLs in the database.",
    )
    parser.add_argument(
        "--csv",
        default="broken_part_images.csv",
        help="CSV output path for broken URLs (default: broken_part_images.csv)",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.05,
        help="Sleep (seconds) between requests to avoid hammering the CDN (default: 0.05).",
    )
    args = parser.parse_args()

    print(f"Opening database: {args.db}")
    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Pull parts that *claim* to have an image URL
    sql = """
        SELECT part_num, part_img_url
        FROM parts
        WHERE part_img_url IS NOT NULL
          AND TRIM(part_img_url) != ''
        ORDER BY part_num
    """
    if args.limit is not None:
        sql += " LIMIT ?"
        rows = cur.execute(sql, (args.limit,)).fetchall()
    else:
        rows = cur.execute(sql).fetchall()

    total = len(rows)
    print(f"Found {total} parts with a non-empty part_img_url")

    broken = []

    for idx, row in enumerate(rows, start=1):
        part_num = row["part_num"]
        url = row["part_img_url"].strip()

        # Basic sanity
        if not url.lower().startswith("http"):
            broken.append(
                {
                    "part_num": part_num,
                    "part_img_url": url,
                    "status": "",
                    "reason": "Not HTTP(S) URL",
                }
            )
            print(f"[{idx}/{total}] {part_num}: INVALID URL {url!r}")
            continue

        status, err = check_url(url)
        is_broken = status is None or status >= 400

        if is_broken:
            reason = err or f"HTTP {status}"
            broken.append(
                {
                    "part_num": part_num,
                    "part_img_url": url,
                    "status": status if status is not None else "",
                    "reason": reason,
                }
            )
            print(f"[{idx}/{total}] {part_num}: BROKEN ({reason})")
        else:
            if idx % 50 == 0 or idx == total:
                print(f"[{idx}/{total}] {part_num}: OK (HTTP {status})")

        if args.sleep > 0:
            time.sleep(args.sleep)

    # Write CSV report
    if broken:
        print(f"\nWriting CSV report: {args.csv}")
        with open(args.csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["part_num", "part_img_url", "status", "reason"],
            )
            writer.writeheader()
            for row in broken:
                writer.writerow(row)
        print(f"Broken URLs: {len(broken)}")
    else:
        print("\nNo broken URLs detected 🎉")
        conn.close()
        return

    # Apply mode: clear bad URLs
    if args.apply:
        print("\n--apply specified: clearing broken part_img_url values...")
        part_nums = [b["part_num"] for b in broken]

        # Use executemany inside a transaction
        conn.execute("BEGIN")
        try:
          conn.executemany(
              "UPDATE parts SET part_img_url = NULL WHERE part_num = ?",
              [(pn,) for pn in part_nums],
          )
          conn.commit()
        except Exception as e:
          conn.rollback()
          print(f"ERROR applying changes: {e}")
          sys.exit(1)

        print(f"Cleared part_img_url for {len(part_nums)} parts.")
    else:
        print(
            "\nDry run only. Re-run with --apply to clear part_img_url "
            "for the broken rows listed in the CSV."
        )

    conn.close()


if __name__ == "__main__":
    main()