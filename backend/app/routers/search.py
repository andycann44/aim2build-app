import os
import re
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


def _norm_q(s: str) -> str:
    s = (s or "").strip().lower()
    s = s.replace("-", " ").replace("_", " ")
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _looks_like_set_num(s: str) -> bool:
    s = (s or "").strip()
    if not s:
        return False
    if s.isdigit():
        return True
    # common forms: 21330-1, 10283-1 etc
    return bool(re.match(r"^\d{3,6}-\d+$", s))


def _norm_set_num(q: str) -> str:
    s = (q or "").strip()
    if not s:
        return s
    if s.isdigit():
        return f"{s}-1"
    return s


def _wants_figures(q_norm: str) -> bool:
    # Only include figures/minifigs if user asked for them
    tokens = set((q_norm or "").split())
    want = {"minifig", "minifigs", "minifigure", "minifigures", "figure", "figures", "brickheadz"}
    return any(t in want for t in tokens)


def _allow_small_sets(q_norm: str) -> bool:
    # Let small sets through only when user hints they want them (or typed a set number)
    tokens = set((q_norm or "").split())
    allow = {"polybag", "pack", "battle", "mech", "micro", "mini", "small"}
    return any(t in allow for t in tokens)


def _row_to_set(row: sqlite3.Row) -> Dict:
    set_num = (row["set_num"] or "").strip()
    name = (row["name"] or "").strip()
    img = (row["set_img_url"] or "").strip() if "set_img_url" in row.keys() else ""
    return {
        "set_num": set_num,
        "name": name,
        "year": int(row["year"]) if row["year"] is not None else None,
        "num_parts": int(row["num_parts"] or 0),
        "img_url": img,
    }


def _base_where_clause(min_parts: int) -> str:
    return f"""
        s.name IS NOT NULL
        AND TRIM(s.name) != ''
        AND COALESCE(s.num_parts, 0) >= {int(min_parts)}
        AND s.set_num LIKE '%-%'
    """


def _theme_noise_clause() -> str:
    # Use themes to drop obvious non-set lines
    return """
        AND (
          t.name IS NULL OR (
            LOWER(t.name) NOT LIKE '%gear%'
            AND LOWER(t.name) NOT LIKE '%book%'
            AND LOWER(t.name) NOT LIKE '%magazine%'
            AND LOWER(t.name) NOT LIKE '%stationery%'
            AND LOWER(t.name) NOT LIKE '%keychain%'
            AND LOWER(t.name) NOT LIKE '%key chain%'
            AND LOWER(t.name) NOT LIKE '%bag%'
            AND LOWER(t.name) NOT LIKE '%backpack%'
            AND LOWER(t.name) NOT LIKE '%watch%'
            AND LOWER(t.name) NOT LIKE '%clock%'
          )
        )
    """


def _no_figures_clause() -> str:
    # Extra guard: exclude figures/minifigs unless requested
    return """
        AND (
          (t.name IS NULL) OR (
            LOWER(t.name) NOT LIKE '%minifig%'
            AND LOWER(t.name) NOT LIKE '%minifigure%'
            AND LOWER(t.name) NOT LIKE '%collectible%'
            AND LOWER(t.name) NOT LIKE '%brickheadz%'
          )
        )
        AND LOWER(s.name) NOT LIKE '%minifig%'
        AND LOWER(s.name) NOT LIKE '%minifigure%'
        AND LOWER(s.name) NOT LIKE '%brickheadz%'
    """


def _do_search(q: str, limit: int = 60) -> List[Dict]:
    q_raw = (q or "").strip()
    if not q_raw:
        return []

    q_norm = _norm_q(q_raw)
    like_raw = f"%{q_raw}%"
    like_norm = f"%{q_norm}%"

    set_like_1 = f"%{q_raw}%"
    q2 = _norm_set_num(q_raw)
    set_like_2 = f"%{q2}%" if q2 != q_raw else set_like_1

    wants_figures = _wants_figures(q_norm)
    allow_small = _allow_small_sets(q_norm)
    looks_set = _looks_like_set_num(q_raw)

    # Default: 50 parts minimum (filters loads of tiny/figure-like stuff)
    # If they typed a set number or asked for small stuff, relax to 20.
    min_parts = 20 if (looks_set or allow_small) else 50

    con = _db()
    cur = con.cursor()

    sql = f"""
        SELECT
            s.set_num, s.name, s.year, s.num_parts, s.set_img_url,
            t.name AS theme_name
        FROM sets s
        LEFT JOIN themes t ON t.theme_id = s.theme_id
        WHERE
            ({_base_where_clause(min_parts)})
            {_theme_noise_clause()}
            {" " if wants_figures else _no_figures_clause()}
            AND (
                s.set_num LIKE ?
                OR s.set_num LIKE ?
                OR s.name LIKE ?
                OR LOWER(REPLACE(s.name, '-', ' ')) LIKE ?
                OR (t.name IS NOT NULL AND (
                    t.name LIKE ? COLLATE NOCASE
                    OR LOWER(REPLACE(t.name, '-', ' ')) LIKE ?
                ))
            )
        ORDER BY s.year DESC, s.set_num
        LIMIT ?
    """

    cur.execute(
        sql,
        (
            set_like_1,
            set_like_2,
            like_raw,
            like_norm,
            like_raw,
            like_norm,
            int(limit),
        ),
    )

    out: List[Dict] = [ _row_to_set(r) for r in cur.fetchall() ]
    con.close()
    return out


def fuzzy_search_sets(q: str, limit: int = 40, min_score: int = 70) -> List[Dict]:
    q_raw = (q or "").strip()
    q_norm = _norm_q(q_raw)
    if not q_norm:
        return []

    wants_figures = _wants_figures(q_norm)
    allow_small = _allow_small_sets(q_norm)
    looks_set = _looks_like_set_num(q_raw)
    min_parts = 20 if (looks_set or allow_small) else 50

    # Prefilter only (fast). No full-table scan fallback.
    like = f"%{q_norm}%"
    con = _db()
    cur = con.cursor()

    cur.execute(
        f"""
        SELECT
            s.set_num, s.name, s.year, s.num_parts, s.set_img_url,
            t.name AS theme_name
        FROM sets s
        LEFT JOIN themes t ON t.theme_id = s.theme_id
        WHERE
            ({_base_where_clause(min_parts)})
            {_theme_noise_clause()}
            {" " if wants_figures else _no_figures_clause()}
            AND (
                LOWER(REPLACE(s.name, '-', ' ')) LIKE ?
                OR s.set_num LIKE ?
                OR (t.name IS NOT NULL AND LOWER(REPLACE(t.name, '-', ' ')) LIKE ?)
            )
        LIMIT 2500
        """,
        (like, like, like),
    )
    rows = cur.fetchall()
    con.close()

    if not rows:
        return []

    candidates: List[Dict] = []
    for row in rows:
        set_num = (row["set_num"] or "").strip()
        name = (row["name"] or "").strip()
        theme_name = (row["theme_name"] or "").strip()
        hay = _norm_q(f"{set_num} {name} {theme_name}")

        score = fuzz.token_set_ratio(q_norm, hay)
        if score >= int(min_score):
            item = _row_to_set(row)
            item["_score"] = score
            candidates.append(item)

    candidates.sort(key=lambda x: x.get("_score", 0), reverse=True)
    trimmed = candidates[: int(limit)]
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
    return _search_with_fuzzy(q, fuzzy=fuzzy)


@router.get("/search/sets")
def search_sets(
    q: str = Query(..., min_length=1),
    fuzzy: bool = Query(False),
) -> List[Dict]:
    return _search_with_fuzzy(q, fuzzy=fuzzy)


@router.get("/sets/search_sets")
def legacy_search_sets(
    q: str = Query(..., min_length=1),
) -> List[Dict]:
    return _do_search(q)