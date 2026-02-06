from pathlib import Path
from contextlib import contextmanager
from typing import List, Dict, Any, Optional
import sqlite3
import os


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

def _abs_img(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    base = (os.getenv("A2B_STATIC_BASE_URL") or "").rstrip("/")
    if not base:
        return url
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if not url.startswith("/"):
        url = "/" + url
    return base + url   

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
        # Prefer instruction-derived requirements if present (currently disabled)
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
                # Prefer inventories/inventory_parts (latest version) if present
        elif _table_exists(con, "inventories") and _table_exists(con, "inventory_parts"):
            # Prefer v_inventory_parts_latest when present (dedupes by latest inventory version)
            if _table_exists(con, "v_inventory_parts_latest"):
                cur = con.execute(
                    """
                    SELECT part_num, color_id, SUM(quantity) AS quantity
                    FROM v_inventory_parts_latest
                    WHERE set_num = ? AND COALESCE(is_spare,0)=0
                    GROUP BY part_num, color_id
                    """,
                    (set_num,),
                )
                rows = cur.fetchall()
                return [
                    {"set_num": set_num, "part_num": r[0], "color_id": r[1], "quantity": r[2]}
                    for r in rows
                ]

            # Fallback: choose latest inventory_id by max(version) for this set_num
            cur = con.execute(
                "SELECT inventory_id FROM inventories WHERE set_num=? ORDER BY version DESC LIMIT 1",
                (set_num,),
            )
            hit = cur.fetchone()
            if not hit:
                return []
            inv_id = hit[0]
            cur = con.execute(
                """
                SELECT part_num, color_id, SUM(quantity) AS quantity
                FROM inventory_parts
                WHERE inventory_id = ? AND COALESCE(is_spare,0)=0
                GROUP BY part_num, color_id
                """,
                (inv_id,),
            )
            rows = cur.fetchall()
            return [
                {"set_num": set_num, "part_num": r[0], "color_id": r[1], "quantity": r[2]}
                for r in rows
            ]

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
            "part_img_url": _abs_img(row["img_url"]),
            "img_url": _abs_img(row["img_url"]),        }
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