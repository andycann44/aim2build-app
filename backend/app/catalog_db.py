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

def _table_exists(con: sqlite3.Connection, name: str) -> bool:
    cur = con.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
        (name,),
    )
    return cur.fetchone() is not None


def get_set_requirements(set_num: str) -> Dict[str, Any]:
    """
    Truth-first requirements resolver (LOCKED RULE B):
      - If instruction_set_requirements exists AND has rows for set -> use it (source="truth")
      - Else -> fallback to inventory_parts_summary (source="catalog")

    Returns:
      {
        "set_num": "21330-1",
        "source": "truth" | "catalog",
        "rows": [
          {"part_num": "...", "color_id": 0, "quantity": 2, "part_img_url": Optional[str]},
          ...
        ]
      }

    IMPORTANT (LOCKED RULE A/C/D):
      - No canonical/family collapsing.
      - color_id=0 is valid.
      - sticker lines (e.g., color_id=9999) are preserved.
    """
    set_id = _normalise_set_id(set_num)
    if not set_id:
        return {"set_num": set_id, "source": "catalog", "rows": []}

    with db() as con:
        # 1) Try instruction truth table if present
        if _table_exists(con, "instruction_set_requirements"):
            cur = con.execute(
                """
                SELECT part_num, color_id, quantity
                FROM instruction_set_requirements
                WHERE set_num = ?
                ORDER BY part_num, color_id
                """,
                (set_id,),
            )
            truth_rows = cur.fetchall()
            if truth_rows:
                # optional image join (UI only)
                out = []
                for r in truth_rows:
                    pn = str(r["part_num"])
                    cid = int(r["color_id"])
                    qty = int(r["quantity"])
                    # join parts for base url, then rewrite color segment
                    img = None
                    try:
                        c2 = con.execute(
                            "SELECT part_img_url FROM parts WHERE part_num = ? LIMIT 1",
                            (pn,),
                        ).fetchone()
                        if c2 is not None:
                            img = _apply_color_to_img_url(c2["part_img_url"], cid)
                    except Exception:
                        img = None

                    out.append({"part_num": pn, "color_id": cid, "quantity": qty, "part_img_url": img})

                return {"set_num": set_id, "source": "truth", "rows": out}

        # 2) Fallback: catalog aggregated parts (spares excluded)
        cur = con.execute(
            """
            SELECT s.part_num, s.color_id, s.quantity, p.part_img_url
            FROM inventory_parts_summary AS s
            LEFT JOIN parts AS p
              ON p.part_num = s.part_num
            WHERE s.set_num = ?
            ORDER BY s.part_num, s.color_id
            """,
            (set_id,),
        )
        rows = cur.fetchall()

    out = []
    for r in rows:
        pn = str(r["part_num"])
        cid = int(r["color_id"])
        qty = int(r["quantity"])
        img = _apply_color_to_img_url(r["part_img_url"], cid)
        out.append({"part_num": pn, "color_id": cid, "quantity": qty, "part_img_url": img})

    return {"set_num": set_id, "source": "catalog", "rows": out}




# -----------------------
# Truth-first STRICT requirements resolver
# -----------------------

def get_set_requirements(set_num: str) -> Dict[str, Any]:
    """Truth-first requirements for STRICT buildability.

    Returns:
      {"set_num": "21330-1", "source": "truth"|"catalog", "rows": [{"part_num": str, "color_id": int, "quantity": int}, ...]}

    LOCKED:
      - strict keys only (part_num, color_id)
      - truth-first: instruction_set_requirements if present
      - fallback: inventory_parts_summary
      - color_id=0 valid
      - stickers valid
    """
    set_id = _normalise_set_id(set_num)
    if not set_id:
        return {"set_num": "", "source": "none", "rows": []}

    # 1) TRUTH
    with db() as con:
        cur = con.execute(
            """
            SELECT family_part_num AS part_num, color_id, qty AS quantity
            FROM instruction_set_requirements
            WHERE set_num = ?
            ORDER BY family_part_num, color_id
            """,
            (set_id,),
        )
        rows = cur.fetchall()

    if rows:
        out = []
        for r in rows:
            out.append({
                "part_num": str(r["part_num"]),
                "color_id": int(r["color_id"]),
                "quantity": int(r["quantity"]),
            })
        return {"set_num": set_id, "source": "truth", "rows": out}

    # 2) FALLBACK
    with db() as con:
        cur = con.execute(
            """
            SELECT part_num, color_id, quantity
            FROM inventory_parts_summary
            WHERE set_num = ?
            ORDER BY part_num, color_id
            """,
            (set_id,),
        )
        rows = cur.fetchall()

    out = []
    for r in rows:
        out.append({
            "part_num": str(r["part_num"]),
            "color_id": int(r["color_id"]),
            "quantity": int(r["quantity"]),
        })
    return {"set_num": set_id, "source": "catalog", "rows": out}



# -----------------------
# Truth-first STRICT requirements resolver
# -----------------------

def get_set_requirements(set_num: str) -> Dict[str, Any]:
    """Truth-first requirements for STRICT buildability.

    Returns:
      {"set_num": "21330-1", "source": "truth"|"catalog", "rows": [{"part_num": str, "color_id": int, "quantity": int}, ...]}

    LOCKED:
      - strict keys only (part_num, color_id)
      - truth-first: instruction_set_requirements if present
      - fallback: inventory_parts_summary
      - color_id=0 valid
      - stickers valid
    """
    set_id = _normalise_set_id(set_num)
    if not set_id:
        return {"set_num": "", "source": "none", "rows": []}

    # 1) TRUTH
    with db() as con:
        cur = con.execute(
            """
            SELECT family_part_num AS part_num, color_id, qty AS quantity
            FROM instruction_set_requirements
            WHERE set_num = ?
            ORDER BY family_part_num, color_id
            """,
            (set_id,),
        )
        rows = cur.fetchall()

    if rows:
        out = []
        for r in rows:
            out.append({
                "part_num": str(r["part_num"]),
                "color_id": int(r["color_id"]),
                "quantity": int(r["quantity"]),
            })
        return {"set_num": set_id, "source": "truth", "rows": out}

    # 2) FALLBACK
    with db() as con:
        cur = con.execute(
            """
            SELECT part_num, color_id, quantity
            FROM inventory_parts_summary
            WHERE set_num = ?
            ORDER BY part_num, color_id
            """,
            (set_id,),
        )
        rows = cur.fetchall()

    out = []
    for r in rows:
        out.append({
            "part_num": str(r["part_num"]),
            "color_id": int(r["color_id"]),
            "quantity": int(r["quantity"]),
        })
    return {"set_num": set_id, "source": "catalog", "rows": out}
