from pathlib import Path
from contextlib import contextmanager
from typing import List, Dict, Any, Optional
import sqlite3

from app.core.image_resolver import resolve_image_url

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
    Return parts for a set from the SQLite catalog.

    IMPORTANT CONTRACT (used by buildability):
      each row must include: part_num, color_id, quantity (int)

    Image source of truth:
      element_images(part_num, color_id, img_url)
    """
    set_id = _normalise_set_id(set_num)
    if not set_id:
        return []

    def _table_exists(con: sqlite3.Connection, name: str) -> bool:
        row = con.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
            (name,),
        ).fetchone()
        return row is not None

    with db() as con:
        # Prefer instruction-derived requirements if present
        if False and _table_exists(con, "instruction_set_requirements"):
            cur = con.execute(
                """
                SELECT
                    r.part_num,
                    r.color_id,
                    r.qty AS quantity,
                    ei.img_url AS img_url
                FROM instruction_set_requirements AS r
                LEFT JOIN element_images AS ei
                  ON ei.part_num = r.part_num AND ei.color_id = r.color_id
                WHERE r.set_num = ?
                ORDER BY r.part_num, r.color_id
                """,
                (set_id,),
            )
            rows = cur.fetchall()

        # Otherwise fall back to set_parts
        elif _table_exists(con, "set_parts"):
            cur = con.execute(
                """
                SELECT
                    sp.part_num,
                    sp.color_id,
                    sp.qty_per_set AS quantity,
                    ei.img_url AS img_url
                FROM set_parts AS sp
                LEFT JOIN element_images AS ei
                  ON ei.part_num = sp.part_num AND ei.color_id = sp.color_id
                WHERE sp.set_num = ?
                ORDER BY sp.part_num, sp.color_id
                """,
                (set_id,),
            )
            rows = cur.fetchall()

        else:
            # Last resort: inventory_parts_summary, but keep the same contract
            cur = con.execute(
                """
                SELECT
                    s.part_num,
                    s.color_id,
                    s.quantity AS quantity,
                    ei.img_url AS img_url
                FROM inventory_parts_summary AS s
                LEFT JOIN element_images AS ei
                  ON ei.part_num = s.part_num AND ei.color_id = s.color_id
                WHERE s.set_num = ?
                ORDER BY s.part_num, s.color_id
                """,
                (set_id,),
            )
            rows = cur.fetchall()

    return [
        {
            "part_num": row["part_num"],
            "color_id": int(row["color_id"]),
            "quantity": int(row["quantity"] or 0),
            # keep legacy key too (some callers still expect it)
            "part_img_url": resolve_image_url(row["img_url"]),
            # preferred key
            "img_url": resolve_image_url(row["img_url"]),
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
