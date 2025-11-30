from pathlib import Path
from contextlib import contextmanager
from typing import List, Dict, Any, Optional
import sqlite3

# Path to lego_catalog.db
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data" / "lego_catalog.db"


@contextmanager
def db():
    """Simple SQLite connection helper with row dicts."""
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
    finally:
        con.close()


def _normalise_set_id(set_num: str) -> str:
    """
    Normalise a set id so both "70618" and "70618-1" work.
    Returns an empty string for falsey input.
    """
    set_id = (set_num or "").strip()
    if not set_id:
        return ""
    if "-" not in set_id:
        return f"{set_id}-1"
    return set_id

def _apply_color_to_img_url(url: Optional[str], color_id: int) -> Optional[str]:
    """
    Given a Rebrickable part_img_url and a desired color_id,
    rewrite the URL so that the colour segment matches color_id.
    Handles both .../parts/<color>/... and .../parts/ldraw/<color>/...
    """
    if not url:
        return None

    try:
        parts = url.split("/")
        # colour is usually the last numeric segment before the filename
        for i in range(len(parts) - 2, -1, -1):
            if parts[i].isdigit():
                parts[i] = str(color_id)
                break
        return "/".join(parts)
    except Exception:
        return url

def get_catalog_parts_for_set(set_num: str) -> List[Dict[str, Any]]:
    """
    Return canonical parts for a set from the SQLite catalog.

    Uses the pre-aggregated inventory_parts_summary table (spares excluded)
    and joins onto parts to get part_img_url from the master catalog.

    This is our single source of truth for images per part_num.
    """
    set_id = _normalise_set_id(set_num)
    if not set_id:
        return []

    with db() as con:
        cur = con.execute(
            """
            SELECT
                s.part_num,
                s.color_id,
                s.quantity,
                p.part_img_url
            FROM inventory_parts_summary AS s
            LEFT JOIN parts AS p
              ON p.part_num = s.part_num
            WHERE s.set_num = ?
            ORDER BY s.part_num, s.color_id
            """,
            (set_id,),
        )
        rows = cur.fetchall()

    return [
        {
            "part_num": row["part_num"],
            "color_id": row["color_id"],
            "quantity": row["quantity"],
            "part_img_url": _apply_color_to_img_url(row["part_img_url"], int(row["color_id"]))
        }
        for row in rows
    ]


def get_set_num_parts(set_num: str) -> int:
    """
    Return the official num_parts from the sets table for display purposes.
    """
    set_id = _normalise_set_id(set_num)
    if not set_id:
        return 0

    with db() as con:
        cur = con.execute(
            """
            SELECT num_parts
            FROM sets
            WHERE set_num = ?
            """,
            (set_id,),
        )
        row = cur.fetchone()

    if row is None:
        return 0
    return int(row["num_parts"] or 0)
