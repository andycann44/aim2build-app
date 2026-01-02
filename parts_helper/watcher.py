# parts_helper/watcher.py

import sqlite3
import json
from pathlib import Path
from typing import Set

from config import (
    USER_DB_PATH,
    CATALOG_DB_PATH,
    WISHLIST_JSON_PATH,
    HARVEST_QUEUE_PATH,
)


def load_user_sets() -> Set[str]:
    """Get distinct set_num from user_sets table."""
    if not USER_DB_PATH.exists():
        print(f"[watcher] User DB not found: {USER_DB_PATH}")
        return set()

    conn = sqlite3.connect(USER_DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT set_num FROM user_sets")
        rows = cur.fetchall()
        return {row["set_num"] for row in rows if row["set_num"]}
    except sqlite3.Error as e:
        print(f"[watcher] Error reading user_sets: {e}")
        return set()
    finally:
        conn.close()


def load_wishlist_sets() -> Set[str]:
    """Get set_nums from wishlist.json if present."""
    path = WISHLIST_JSON_PATH
    if not path.exists():
        return set()

    try:
        data = json.loads(path.read_text())
    except Exception as e:
        print(f"[watcher] Failed to read wishlist.json: {e}")
        return set()

    sets: Set[str] = set()

    # Shape we remembered:
    # THIS IS JSON
    # {
    #   "sets": [
    #     {
    #       "set_num": "21330-1",
    #       "name": "...",
    #       "year": 2021,
    #       "img_url": "...",
    #       "num_parts": 3955
    #     }
    #   ]
    # }
    items = data.get("sets", [])
    for item in items:
        set_num = item.get("set_num")
        if set_num:
            sets.add(set_num)

    return sets


def load_whitelisted_sets() -> Set[str]:
    """Load allowed set_nums from lego_core_v2.db.sets."""
    if not CATALOG_DB_PATH.exists():
        print(f"[watcher] Catalog DB not found: {CATALOG_DB_PATH}")
        return set()

    conn = sqlite3.connect(CATALOG_DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        cur = conn.cursor()
        # Simple: all rows in sets table are considered valid.
        # If you later add is_valid/is_core columns, we can filter by that.
        cur.execute("SELECT DISTINCT set_num FROM sets")
        rows = cur.fetchall()
        return {row["set_num"] for row in rows if row["set_num"]}
    except sqlite3.Error as e:
        print(f"[watcher] Error reading catalog sets: {e}")
        return set()
    finally:
        conn.close()


def load_existing_queue() -> Set[str]:
    """Load current queue file if present."""
    path = HARVEST_QUEUE_PATH
    if not path.exists():
        return set()
    lines = [line.strip() for line in path.read_text().splitlines()]
    return {line for line in lines if line}


def save_queue(set_nums: Set[str]) -> None:
    """Write queue file."""
    path = HARVEST_QUEUE_PATH
    content = "\n".join(sorted(set_nums)) + "\n" if set_nums else ""
    path.write_text(content)
    print(f"[watcher] Queue updated: {len(set_nums)} set(s)")


def main() -> None:
    print("[watcher] Starting")

    user_sets = load_user_sets()
    wishlist_sets = load_wishlist_sets()
    in_use = user_sets.union(wishlist_sets)

    print(f"[watcher] Sets in use (user_sets + wishlist): {len(in_use)}")

    whitelist = load_whitelisted_sets()
    if not whitelist:
        print("[watcher] No whitelist sets found; aborting.")
        return

    valid_in_use = in_use.intersection(whitelist)
    print(f"[watcher] Valid sets after whitelist filter: {len(valid_in_use)}")

    existing_queue = load_existing_queue()
    new_queue = existing_queue.union(valid_in_use)

    save_queue(new_queue)
    print("[watcher] Done")


if __name__ == "__main__":
    main()
