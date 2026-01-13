import os
import re
import sqlite3
from typing import Dict, List, Optional, Set, Tuple

from fastapi import APIRouter, HTTPException, Query
from rapidfuzz import fuzz

from app.paths import DATA_DIR

router = APIRouter()

DB_PATH = str(DATA_DIR / "lego_catalog.db")

# -------------------------
# Limits
# -------------------------

DEFAULT_LIMIT = 200
MAX_LIMIT = 500


def _clamp_limit(n: int) -> int:
    try:
        n2 = int(n)
    except Exception:
        n2 = DEFAULT_LIMIT
    if n2 < 1:
        n2 = 1
    if n2 > MAX_LIMIT:
        n2 = MAX_LIMIT
    return n2


# -------------------------
# DB
# -------------------------

def _db() -> sqlite3.Connection:
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="lego_catalog.db missing")
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def _has_table(con: sqlite3.Connection, table_name: str) -> bool:
    try:
        row = con.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
            (table_name,),
        ).fetchone()
        return row is not None
    except Exception:
        return False


def _filters_sql(con: sqlite3.Connection) -> Tuple[str, str]:
    """
    Returns (joins_sql, where_sql_addition) to exclude junk using:
      - theme_filters(theme_id, enabled)
      - set_filters(set_num, enabled)
    Safe if tables don't exist.
    """
    joins: List[str] = []
    wheres: List[str] = []

    has_theme_filters = _has_table(con, "theme_filters")
    if has_theme_filters:
        joins.append("LEFT JOIN theme_filters tf ON tf.theme_id = s.theme_id AND tf.enabled = 1")
        wheres.append("tf.theme_id IS NULL")

    has_set_filters = _has_table(con, "set_filters")
    if has_set_filters:
        # exclude exact set_num OR base match (e.g., 2000700 excludes 2000700-1 etc.)
        joins.append(
            """
            LEFT JOIN set_filters sf
              ON sf.enabled = 1
             AND (
                    sf.set_num = s.set_num
                 OR (CASE WHEN instr(sf.set_num,'-')>0 THEN substr(sf.set_num,1,instr(sf.set_num,'-')-1) ELSE sf.set_num END)
                    =
                    (CASE WHEN instr(s.set_num,'-')>0 THEN substr(s.set_num,1,instr(s.set_num,'-')-1) ELSE s.set_num END)
                )
            """
        )
        wheres.append("sf.set_num IS NULL")

    join_sql = "\n".join([j.strip() for j in joins if j and j.strip()])
    where_sql = ""
    if wheres:
        where_sql = " AND " + " AND ".join(wheres) + " "
    return join_sql, where_sql


# -------------------------
# Normalization helpers
# -------------------------

def _norm_q(s: str) -> str:
    s = (s or "").strip().lower()
    s = s.replace("-", " ").replace("_", " ")
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _base_set_num(s: str) -> Optional[str]:
    """
    Return the numeric base of a set number.
    Examples:
      "21330-1" -> "21330"
      "21330"   -> "21330"
    """
    if not s:
        return None
    m = re.match(r"^(\d{3,6})(?:-\d+)?$", s.strip())
    return m.group(1) if m else None


def _looks_like_set_num(s: str) -> bool:
    s = (s or "").strip()
    if not s:
        return False
    if s.isdigit():
        return True
    return bool(re.match(r"^\d{3,6}-\d+$", s))


def _norm_set_num(q: str) -> str:
    s = (q or "").strip()
    if not s:
        return s
    if s.isdigit():
        return f"{s}-1"
    return s


def _wants_figures(q_norm: str) -> bool:
    tokens = set((q_norm or "").split())
    want = {"minifig", "minifigs", "minifigure", "minifigures", "figure", "figures"}
    return any(t in want for t in tokens)


def _allow_small_sets(q_norm: str) -> bool:
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


def _order_by(sort: str) -> str:
    s = (sort or "").strip().lower()
    if s == "popular":
        return "ORDER BY COALESCE(s.num_parts,0) DESC, s.year DESC, s.set_num"
    # default = recent
    return "ORDER BY s.year DESC, s.set_num"


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
    # Extra guard: exclude minifigs/collectibles unless requested (BrickHeadz are treated as sets)
    return """
        AND (
          (t.name IS NULL) OR (
            LOWER(t.name) NOT LIKE '%minifig%'
            AND LOWER(t.name) NOT LIKE '%minifigure%'
            AND LOWER(t.name) NOT LIKE '%collectible%'
          )
        )
        AND LOWER(s.name) NOT LIKE '%minifig%'
        AND LOWER(s.name) NOT LIKE '%minifigure%'
    """


_STOP_WORDS: Set[str] = {"brick", "bricks", "lego", "set", "sets", "building", "build", "kit", "kits"}

_GENERIC_THEME_WORDS: Set[str] = {
    "home", "house", "room", "family", "school", "kitchen", "bathroom", "bedroom",
    "city", "space", "classic", "creator", "technic", "friends", "police", "fire",
    "train", "trains", "star",
}


def _strip_stopwords(q_norm: str) -> str:
    toks = [t for t in (q_norm or "").split() if t and t not in _STOP_WORDS]
    return " ".join(toks).strip()


_THEME_ALIASES: Dict[str, str] = {
    "brick headz": "brickheadz",
    "brick-headz": "brickheadz",
    "brick_headz": "brickheadz",
}


def _alias_theme_phrase(phrase_norm: str) -> str:
    p = (phrase_norm or "").strip().lower()
    return _THEME_ALIASES.get(p, p)


def _extract_theme_from_tokens(
    con: sqlite3.Connection,
    q_raw: str,
) -> Tuple[List[int], str, bool]:
    q_raw0 = (q_raw or "").strip()
    if not q_raw0:
        return [], q_raw0, False

    q_norm0 = _norm_q(q_raw0)
    toks = [t for t in q_norm0.split() if t]
    if not toks:
        return [], q_raw0, False

    best = None  # (start, end, root_theme_ids)

    # BrickHeadz priority
    for i in range(len(toks)):
        if toks[i] == "brickheadz":
            tid_bh = _theme_id_by_exact_name(con, "brickheadz")
            if tid_bh is None:
                roots_bh = _theme_ids_by_prefix(con, "brickheadz", limit=10)
                if roots_bh:
                    best = (i, i + 1, roots_bh)
                    break
            else:
                best = (i, i + 1, [tid_bh])
                break

        if i + 1 < len(toks) and toks[i] == "brick" and toks[i + 1] == "headz":
            tid_bh = _theme_id_by_exact_name(con, "brickheadz")
            if tid_bh is None:
                roots_bh = _theme_ids_by_prefix(con, "brickheadz", limit=10)
                if roots_bh:
                    best = (i, i + 2, roots_bh)
                    break
            else:
                best = (i, i + 2, [tid_bh])
                break

    if best is not None:
        i0, i1, roots = best
        theme_ids = _expand_theme_descendants(con, roots)

        remaining_toks = toks[:i0] + toks[i1:]
        remaining_q = " ".join(remaining_toks).strip()

        theme_forced = len(remaining_toks) == 0
        return theme_ids, remaining_q, theme_forced

    max_n = 3
    for n in range(max_n, 0, -1):
        for i in range(0, len(toks) - n + 1):
            phrase = " ".join(toks[i: i + n]).strip()
            phrase = _alias_theme_phrase(phrase)

            if phrase in _STOP_WORDS:
                continue
            if n == 1 and phrase in _GENERIC_THEME_WORDS:
                continue

            tid_exact = _theme_id_by_exact_name(con, phrase)
            if tid_exact is not None:
                best = (i, i + n, [tid_exact])
                break

            if len(phrase) >= 3:
                roots = _theme_ids_by_prefix(con, phrase, limit=10)
                if roots:
                    best = (i, i + n, roots)
                    break
        if best is not None:
            break

    if best is None:
        return [], q_raw0, False

    i0, i1, roots = best
    theme_ids = _expand_theme_descendants(con, roots)

    remaining_toks = toks[:i0] + toks[i1:]
    remaining_q = " ".join(remaining_toks).strip()

    theme_forced = len(remaining_toks) == 0
    return theme_ids, remaining_q, theme_forced


# -------------------------
# Theme filtering
# -------------------------

_THEME_TOKEN_RE = re.compile(r"\b(?:theme|theme_id)\s*[:=]\s*(\d+)\b", re.IGNORECASE)


def _parse_theme_token(q_raw: str) -> Tuple[Optional[int], str]:
    s = (q_raw or "").strip()
    if not s:
        return None, s

    m = _THEME_TOKEN_RE.search(s)
    if not m:
        return None, s

    theme_id = int(m.group(1))
    rest = (s[: m.start()] + " " + s[m.end():]).strip()
    rest = re.sub(r"\s+", " ", rest)
    return theme_id, rest


def _theme_id_by_exact_name(con: sqlite3.Connection, q_norm: str) -> Optional[int]:
    qn = (q_norm or "").strip().lower()
    if not qn:
        return None

    row = con.execute(
        "SELECT theme_id FROM themes WHERE trim(lower(name)) = ? LIMIT 1",
        (qn,),
    ).fetchone()
    if row:
        return int(row["theme_id"])
    return None


def _theme_ids_by_prefix(con: sqlite3.Connection, q_norm: str, limit: int = 50) -> List[int]:
    qn = (q_norm or "").strip().lower()
    if not qn:
        return []
    rows = con.execute(
        """
        SELECT theme_id
        FROM themes
        WHERE trim(lower(name)) LIKE ? || '%'
        ORDER BY length(name) ASC
        LIMIT ?
        """,
        (qn, int(limit)),
    ).fetchall()
    return [int(r["theme_id"]) for r in rows]


def _expand_theme_descendants(con: sqlite3.Connection, root_ids: List[int], max_ids: int = 300) -> List[int]:
    ids = [int(x) for x in (root_ids or []) if int(x) > 0]
    if not ids:
        return []

    placeholders = ",".join(["?"] * len(ids))
    rows = con.execute(
        f"""
        WITH RECURSIVE kids(theme_id) AS (
            SELECT theme_id
            FROM themes
            WHERE theme_id IN ({placeholders})
            UNION ALL
            SELECT t.theme_id
            FROM themes t
            JOIN kids k ON t.parent_id = k.theme_id
        )
        SELECT DISTINCT theme_id
        FROM kids
        LIMIT ?
        """,
        tuple(ids + [int(max_ids)]),
    ).fetchall()

    out = [int(r["theme_id"]) for r in rows]

    root_set = set(ids)
    ordered = ids[:] + [x for x in out if x not in root_set]

    seen: Set[int] = set()
    final: List[int] = []
    for x in ordered:
        if x not in seen:
            seen.add(x)
            final.append(x)
    return final


def _theme_filter_from_query(con: sqlite3.Connection, q_raw: str) -> Tuple[List[int], str, bool]:
    q_raw0 = (q_raw or "").strip()
    if not q_raw0:
        return [], q_raw0, False

    tid, rest = _parse_theme_token(q_raw0)
    if tid is not None:
        return _expand_theme_descendants(con, [tid]), rest, True

    theme_ids, remaining_q_norm, theme_forced = _extract_theme_from_tokens(con, q_raw0)
    if theme_ids:
        return theme_ids, remaining_q_norm, theme_forced

    return [], q_raw0, False


def _in_clause_ints(col_sql: str, values: List[int]) -> Tuple[str, List[int]]:
    if not values:
        return "", []
    placeholders = ",".join(["?"] * len(values))
    return f" AND {col_sql} IN ({placeholders}) ", [int(v) for v in values]


# -------------------------
# Search
# -------------------------

@router.get("/search/paged")
def search_paged(
    q: str = Query("", min_length=0),
    page: int = Query(1, ge=1),
    page_size: int = Query(60, ge=1, le=200),
    fuzzy: bool = Query(False),
    sort: str = Query("recent"),
):
    q_raw_full = (q or "").strip()
    if not q_raw_full:
        return {"results": [], "page": page, "page_size": page_size, "total": 0, "has_more": False}

    # ---------- NUMERIC SET SEARCH (no theme interference) ----------
    base = _base_set_num(q_raw_full)
    if base:
        con = _db()
        cur = con.cursor()
        join_filters_sql, where_filters_sql = _filters_sql(con)

        sql = f"""
            SELECT
                s.set_num, s.name, s.year, s.num_parts, s.set_img_url
            FROM sets s
            {join_filters_sql}
            WHERE s.set_num LIKE ? || '-%'
              {where_filters_sql}
            ORDER BY
                CAST(substr(s.set_num, instr(s.set_num,'-')+1) AS INTEGER) DESC
            LIMIT 1
        """
        row = cur.execute(sql, (base,)).fetchone()
        con.close()

        if row:
            result = [_row_to_set(row)]
            return {"results": result, "page": 1, "page_size": 1, "total": 1, "has_more": False}

    # True pagination: exact search only (fuzzy slices a precomputed candidate list).
    if fuzzy:
        rows = fuzzy_search_sets(q_raw_full, limit=2500)
        total = len(rows)
        start = (page - 1) * page_size
        end = start + page_size
        results = rows[start:end]
        return {"results": results, "page": page, "page_size": page_size, "total": total, "has_more": end < total}

    con = _db()
    cur = con.cursor()

    join_filters_sql, where_filters_sql = _filters_sql(con)

    # Theme filtering (DB-driven)
    theme_ids, q_rest_raw, theme_forced = _theme_filter_from_query(con, q_raw_full)
    theme_sql, theme_params = _in_clause_ints("s.theme_id", theme_ids)

    # intent based on full query
    q_norm_full = _norm_q(q_raw_full)
    wants_figures = _wants_figures(q_norm_full)
    allow_small = _allow_small_sets(q_norm_full)
    looks_set = _looks_like_set_num(q_raw_full)
    min_parts = 20 if (looks_set or allow_small) else 50

    offset = (page - 1) * page_size

    # ---------- PURE THEME MODE ----------
    q_rest_norm = _norm_q(q_rest_raw)
    if theme_ids and not q_rest_norm:
        where_sql = f"""
            ({_base_where_clause(min_parts)})
            {_theme_noise_clause()}
            {" " if (wants_figures or theme_forced) else _no_figures_clause()}
            {theme_sql}
            {where_filters_sql}
        """

        count_sql = f"""
            SELECT COUNT(1) AS n
            FROM sets s
            LEFT JOIN themes t ON t.theme_id = s.theme_id
            {join_filters_sql}
            WHERE {where_sql}
        """
        total = int(cur.execute(count_sql, (*theme_params,)).fetchone()["n"])

        page_sql = f"""
            SELECT
                s.set_num, s.name, s.year, s.num_parts, s.set_img_url,
                t.name AS theme_name
            FROM sets s
            LEFT JOIN themes t ON t.theme_id = s.theme_id
            {join_filters_sql}
            WHERE {where_sql}
            {_order_by(sort)}
            LIMIT ? OFFSET ?
        """
        cur.execute(page_sql, (*theme_params, int(page_size), int(offset)))
        results = [_row_to_set(r) for r in cur.fetchall()]
        con.close()
        return {"results": results, "page": page, "page_size": page_size, "total": total, "has_more": (offset + len(results)) < total}

    # ---------- DEFAULT LIST MODE ----------
    q_norm = _strip_stopwords(_norm_q(q_rest_raw))
    q_tokens = [t for t in q_norm.split() if t]

    if (not theme_ids) and (not q_norm):
        where_sql = f"""
            ({_base_where_clause(min_parts)})
            {_theme_noise_clause()}
            {_no_figures_clause()}
            {where_filters_sql}
        """

        count_sql = f"""
            SELECT COUNT(1) AS n
            FROM sets s
            LEFT JOIN themes t ON t.theme_id = s.theme_id
            {join_filters_sql}
            WHERE {where_sql}
        """
        total = int(cur.execute(count_sql).fetchone()["n"])

        page_sql = f"""
            SELECT
                s.set_num, s.name, s.year, s.num_parts, s.set_img_url,
                t.name AS theme_name
            FROM sets s
            LEFT JOIN themes t ON t.theme_id = s.theme_id
            {join_filters_sql}
            WHERE {where_sql}
            {_order_by(sort)}
            LIMIT ? OFFSET ?
        """
        cur.execute(page_sql, (int(page_size), int(offset)))
        results = [_row_to_set(r) for r in cur.fetchall()]
        con.close()
        return {"results": results, "page": page, "page_size": page_size, "total": total, "has_more": (offset + len(results)) < total}

    # ---------- NORMAL MODE ----------
    token_sql_parts: List[str] = []
    token_params: List[str] = []
    for tok in q_tokens:
        like_tok = f"%{tok}%"
        token_sql_parts.append(
            "(LOWER(REPLACE(s.name, '-', ' ')) LIKE ? OR (t.name IS NOT NULL AND LOWER(REPLACE(t.name, '-', ' ')) LIKE ?))"
        )
        token_params.extend([like_tok, like_tok])

    token_sql = " AND ".join(token_sql_parts) if token_sql_parts else "1=1"

    set_like_1 = f"%{q_rest_raw}%"
    q2 = _norm_set_num(q_rest_raw)
    set_like_2 = f"%{q2}%" if q2 != q_rest_raw else set_like_1

    where_sql = f"""
        ({_base_where_clause(min_parts)})
        {_theme_noise_clause()}
        {" " if (wants_figures or theme_forced) else _no_figures_clause()}
        {theme_sql}
        {where_filters_sql}
        AND (
            s.set_num LIKE ?
            OR s.set_num LIKE ?
            OR ({token_sql})
        )
    """

    count_sql = f"""
        SELECT COUNT(1) AS n
        FROM sets s
        LEFT JOIN themes t ON t.theme_id = s.theme_id
        {join_filters_sql}
        WHERE {where_sql}
    """
    total = int(
        cur.execute(
            count_sql,
            (*theme_params, set_like_1, set_like_2, *token_params),
        ).fetchone()["n"]
    )

    page_sql = f"""
        SELECT
            s.set_num, s.name, s.year, s.num_parts, s.set_img_url,
            t.name AS theme_name
        FROM sets s
        LEFT JOIN themes t ON t.theme_id = s.theme_id
        {join_filters_sql}
        WHERE {where_sql}
        {_order_by(sort)}
        LIMIT ? OFFSET ?
    """
    cur.execute(
        page_sql,
        (*theme_params, set_like_1, set_like_2, *token_params, int(page_size), int(offset)),
    )
    results = [_row_to_set(r) for r in cur.fetchall()]
    con.close()

    return {"results": results, "page": page, "page_size": page_size, "total": total, "has_more": (offset + len(results)) < total}


def _do_search(q: str, limit: int = DEFAULT_LIMIT, sort: str = "recent") -> List[Dict]:
    q_raw_full = (q or "").strip()
    if not q_raw_full:
        return []

    con = _db()
    cur = con.cursor()
    limit = _clamp_limit(limit)

    join_filters_sql, where_filters_sql = _filters_sql(con)

    theme_ids, q_rest_raw, theme_forced = _theme_filter_from_query(con, q_raw_full)
    theme_sql, theme_params = _in_clause_ints("s.theme_id", theme_ids)

    q_norm_full = _norm_q(q_raw_full)
    wants_figures = _wants_figures(q_norm_full)
    allow_small = _allow_small_sets(q_norm_full)
    looks_set = _looks_like_set_num(q_raw_full)
    min_parts = 20 if (looks_set or allow_small) else 50

    q_rest_norm = _norm_q(q_rest_raw)
    if theme_ids and not q_rest_norm:
        sql = f"""
            SELECT
                s.set_num, s.name, s.year, s.num_parts, s.set_img_url,
                t.name AS theme_name
            FROM sets s
            LEFT JOIN themes t ON t.theme_id = s.theme_id
            {join_filters_sql}
            WHERE
                ({_base_where_clause(min_parts)})
                {_theme_noise_clause()}
                {" " if (wants_figures or theme_forced) else _no_figures_clause()}
                {theme_sql}
                {where_filters_sql}
            {_order_by(sort)}
            LIMIT ?
        """
        cur.execute(sql, (*theme_params, int(limit)))
        out: List[Dict] = [_row_to_set(r) for r in cur.fetchall()]
        con.close()
        return out

    q_norm = _strip_stopwords(_norm_q(q_rest_raw))
    q_tokens = [t for t in q_norm.split() if t]

    if (not theme_ids) and (not q_norm):
        sql = f"""
            SELECT
                s.set_num, s.name, s.year, s.num_parts, s.set_img_url,
                t.name AS theme_name
            FROM sets s
            LEFT JOIN themes t ON t.theme_id = s.theme_id
            {join_filters_sql}
            WHERE
                ({_base_where_clause(min_parts)})
                {_theme_noise_clause()}
                {_no_figures_clause()}
                {where_filters_sql}
            {_order_by(sort)}
            LIMIT ?
        """
        cur.execute(sql, (int(limit),))
        out: List[Dict] = [_row_to_set(r) for r in cur.fetchall()]
        con.close()
        return out

    token_sql_parts: List[str] = []
    token_params: List[str] = []
    for tok in q_tokens:
        like_tok = f"%{tok}%"
        token_sql_parts.append(
            "(LOWER(REPLACE(s.name, '-', ' ')) LIKE ? OR (t.name IS NOT NULL AND LOWER(REPLACE(t.name, '-', ' ')) LIKE ?))"
        )
        token_params.extend([like_tok, like_tok])

    token_sql = " AND ".join(token_sql_parts) if token_sql_parts else "1=1"

    set_like_1 = f"%{q_rest_raw}%"
    q2 = _norm_set_num(q_rest_raw)
    set_like_2 = f"%{q2}%" if q2 != q_rest_raw else set_like_1

    sql = f"""
        SELECT
            s.set_num, s.name, s.year, s.num_parts, s.set_img_url,
            t.name AS theme_name
        FROM sets s
        LEFT JOIN themes t ON t.theme_id = s.theme_id
        {join_filters_sql}
        WHERE
            ({_base_where_clause(min_parts)})
            {_theme_noise_clause()}
            {" " if (wants_figures or theme_forced) else _no_figures_clause()}
            {theme_sql}
            {where_filters_sql}
            AND (
                s.set_num LIKE ?
                OR s.set_num LIKE ?
                OR ({token_sql})
            )
        {_order_by(sort)}
        LIMIT ?
    """
    cur.execute(sql, (*theme_params, set_like_1, set_like_2, *token_params, int(limit)))
    out: List[Dict] = [_row_to_set(r) for r in cur.fetchall()]
    con.close()
    return out


def fuzzy_search_sets(q: str, limit: int = 80, min_score: int = 70) -> List[Dict]:
    q_raw_full = (q or "").strip()
    if not q_raw_full:
        return []

    con = _db()
    cur = con.cursor()
    limit = _clamp_limit(limit)

    join_filters_sql, where_filters_sql = _filters_sql(con)

    theme_ids, q_rest_raw, theme_forced = _theme_filter_from_query(con, q_raw_full)
    theme_sql, theme_params = _in_clause_ints("s.theme_id", theme_ids)

    q_norm_full = _norm_q(q_raw_full)
    wants_figures = _wants_figures(q_norm_full)
    allow_small = _allow_small_sets(q_norm_full)
    looks_set = _looks_like_set_num(q_raw_full)
    min_parts = 20 if (looks_set or allow_small) else 50

    q_norm = _norm_q(q_rest_raw)

    if theme_ids and not q_norm:
        cur.execute(
            f"""
            SELECT
                s.set_num, s.name, s.year, s.num_parts, s.set_img_url,
                t.name AS theme_name
            FROM sets s
            LEFT JOIN themes t ON t.theme_id = s.theme_id
            {join_filters_sql}
            WHERE
                ({_base_where_clause(min_parts)})
                {_theme_noise_clause()}
                {" " if (wants_figures or theme_forced) else _no_figures_clause()}
                {theme_sql}
                {where_filters_sql}
            LIMIT 2500
            """,
            (*theme_params,),
        )
    else:
        like = f"%{q_norm}%"
        cur.execute(
            f"""
            SELECT
                s.set_num, s.name, s.year, s.num_parts, s.set_img_url,
                t.name AS theme_name
            FROM sets s
            LEFT JOIN themes t ON t.theme_id = s.theme_id
            {join_filters_sql}
            WHERE
                ({_base_where_clause(min_parts)})
                {_theme_noise_clause()}
                {" " if (wants_figures or theme_forced) else _no_figures_clause()}
                {theme_sql}
                {where_filters_sql}
                AND (
                    LOWER(REPLACE(s.name, '-', ' ')) LIKE ?
                    OR s.set_num LIKE ?
                    OR (t.name IS NOT NULL AND LOWER(REPLACE(t.name, '-', ' ')) LIKE ?)
                )
            LIMIT 2500
            """,
            (*theme_params, like, like, like),
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

        if theme_ids and not q_norm:
            score = 100
        else:
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


def _search_with_fuzzy(q: str, fuzzy: bool = False, limit: int = DEFAULT_LIMIT, sort: str = "recent") -> List[Dict]:
    limit = _clamp_limit(limit)
    if fuzzy:
        return fuzzy_search_sets(q, limit=limit)

    exact = _do_search(q, limit=limit, sort=sort)
    if exact:
        return exact

    return fuzzy_search_sets(q, limit=limit)


@router.get("/search")
def search(
    q: str = Query(..., min_length=1),
    fuzzy: bool = Query(False),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    sort: str = Query("recent"),
) -> List[Dict]:
    return _search_with_fuzzy(q, fuzzy=fuzzy, limit=limit, sort=sort)


@router.get("/search/sets")
def search_sets(
    q: str = Query(..., min_length=1),
    fuzzy: bool = Query(False),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    sort: str = Query("recent"),
) -> List[Dict]:
    return _search_with_fuzzy(q, fuzzy=fuzzy, limit=limit, sort=sort)


@router.get("/sets/search_sets")
def legacy_search_sets(
    q: str = Query(..., min_length=1),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    sort: str = Query("recent"),
) -> List[Dict]:
    return _do_search(q, limit=limit, sort=sort)