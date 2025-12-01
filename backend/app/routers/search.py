import os
import sqlite3
from typing import List, Dict

from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "lego_catalog.db")

def _db() -> sqlite3.Connection:
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="lego_catalog.db missing")
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con

def _guess_set_img_url(set_num: str) -> str:
    if not set_num:
        return ""
    # Simple Rebrickable-style pattern; frontend can use or ignore
    return f"https://cdn.rebrickable.com/media/sets/{set_num}.jpg"

def _do_search(q: str) -> List[Dict]:
    q = q.strip()
    if not q:
        return []
    like = f"%{q}%"
    con = _db()
    cur = con.cursor()
    cur.execute(
        """
        SELECT set_num, name, year, num_parts
        FROM sets
        WHERE set_num LIKE ? OR name LIKE ?
        ORDER BY year DESC, set_num
        LIMIT 50
        """,
        (like, like),
    )
    rows: List[Dict] = []
    for row in cur.fetchall():
        set_num = row["set_num"]
        rows.append(
            {
                "set_num": set_num,
                "name": row["name"],
                "year": int(row["year"]),
                "num_parts": int(row["num_parts"] or 0),
                "img_url": _guess_set_img_url(set_num),
            }
        )
    con.close()
    return rows

@router.get("/search")
def search(q: str = Query(..., min_length=1)) -> List[Dict]:
    """Primary search endpoint: /api/search?q=..."""
    return _do_search(q)

@router.get("/search/sets")
def search_sets(q: str = Query(..., min_length=1)) -> List[Dict]:
    """Alias: /api/search/sets?q=..."""
    return _do_search(q)

@router.get("/sets/search_sets")
def legacy_search_sets(q: str = Query(..., min_length=1)) -> List[Dict]:
    """Legacy alias: /api/sets/search_sets?q=..."""
    return _do_search(q)
