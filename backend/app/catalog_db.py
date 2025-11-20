from pathlib import Path
from contextlib import contextmanager
from typing import List, Dict, Any
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


def get_catalog_parts_for_set(set_num: str) -> List[Dict[str, Any]]:
    """
    Return canonical parts for a set from the SQLite catalog.
    Uses the pre-aggregated inventory_parts_summary table (spares excluded).
    """
    set_id = _normalise_set_id(set_num)
    if not set_id:
        return []

    with db() as con:
        cur = con.execute(
            """
            SELECT part_num,
                   color_id,
                   quantity
            FROM inventory_parts_summary
            WHERE set_num = ?
            ORDER BY part_num, color_id
            """,
            (set_id,),
        )
        rows = cur.fetchall()

    return [
        {
            "part_num": row["part_num"],
            "color_id": row["color_id"],
            "quantity": row["quantity"],
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
