import os
import sqlite3
from typing import List, Dict

from fastapi import APIRouter, HTTPException, Query
from rapidfuzz import fuzz
from app.paths import DATA_DIR

router = APIRouter()

DB_PATH = str(DATA_DIR / "lego_catalog.db")


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
        WHERE (set_num LIKE ? OR name LIKE ?)
          AND lower(name) NOT LIKE '%adidas%'
          AND lower(name) NOT LIKE '%trainer%'
          AND lower(name) NOT LIKE '%shoe%'
          AND lower(name) NOT LIKE '%bag%'
          AND lower(name) NOT LIKE '%backpack%'
          AND lower(name) NOT LIKE '%key chain%'
          AND lower(name) NOT LIKE '%keychain%'
          AND lower(name) NOT LIKE '%key ring%'
          AND lower(name) NOT LIKE '%magazine%'
          AND lower(name) NOT LIKE '%pencil%'
          AND lower(name) NOT LIKE '%pencil case%'
          AND lower(name) NOT LIKE '%notebook%'
          AND lower(name) NOT LIKE '%pen%'
          AND lower(name) NOT LIKE '%storage box%'
          AND lower(name) NOT LIKE '%lunch box%'
          AND lower(name) NOT LIKE '%watch%'
          AND lower(name) NOT LIKE '%alarm clock%'
          AND lower(name) NOT LIKE '%magnet%'
          AND lower(name) NOT LIKE '%ps4%'
          AND lower(name) NOT LIKE '%playstation%'
          AND lower(name) NOT LIKE '%xbox%'
          AND lower(name) NOT LIKE '%switch%'
          AND lower(name) NOT LIKE '%console%'
          AND num_parts >= 20
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


def fuzzy_search_sets(q: str, limit: int = 30, min_score: int = 65) -> List[Dict]:
    q_norm = q.strip().lower()
    if not q_norm:
        return []

    like = f"%{q_norm}%"
    con = _db()
    cur = con.cursor()

    # First: cheap LIKE pre-filter
    cur.execute(
        """
        SELECT set_num, name, year, num_parts
        FROM sets
        WHERE lower(name) LIKE ?
           OR set_num LIKE ?
        LIMIT 5000
        """,
        (like, like),
    )
    rows = cur.fetchall()

    # Fallback: if nothing matches LIKE, scan all sets
    if not rows:
        cur.execute(
            """
            SELECT set_num, name, year, num_parts
            FROM sets
            """
        )
        rows = cur.fetchall()

    candidates: List[Dict] = []
    for row in rows:
        set_num = row["set_num"]
        name = row["name"] or ""
        score = fuzz.token_set_ratio(q_norm, f"{set_num} {name}".lower())
        if score >= min_score:
            candidates.append(
                {
                    "set_num": set_num,
                    "name": name,
                    "year": int(row["year"]),
                    "num_parts": int(row["num_parts"] or 0),
                    "img_url": _guess_set_img_url(set_num),
                    "_score": score,
                }
            )

    con.close()

    # Sort by fuzzy score, trim, and drop the internal score field
    candidates.sort(key=lambda x: x["_score"], reverse=True)
    trimmed = candidates[:limit]
    for item in trimmed:
        item.pop("_score", None)
    return trimmed


def _search_with_fuzzy(q: str, fuzzy: bool = False) -> List[Dict]:
    if fuzzy:
        return fuzzy_search_sets(q)

    exact = _do_search(q)
    if exact:
        return exact

    return fuzzy_search_sets(q)


@router.get("/search")
def search(
    q: str = Query(..., min_length=1),
    fuzzy: bool = Query(False),
) -> List[Dict]:
    """Primary search endpoint: /api/search?q=..."""
    return _search_with_fuzzy(q, fuzzy=fuzzy)


@router.get("/search/sets")
def search_sets(
    q: str = Query(..., min_length=1),
    fuzzy: bool = Query(False),
) -> List[Dict]:
    """Alias: /api/search/sets?q=..."""
    return _search_with_fuzzy(q, fuzzy=fuzzy)


@router.get("/sets/search_sets")
def legacy_search_sets(
    q: str = Query(..., min_length=1),
) -> List[Dict]:
    """Legacy alias: /api/sets/search_sets?q=..."""
    return _do_search(q)
