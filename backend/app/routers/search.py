import os
import re
import sqlite3
from typing import Dict, List, Optional, Set, Tuple

from fastapi import APIRouter, HTTPException, Query
from rapidfuzz import fuzz

from app.paths import DATA_DIR

router = APIRouter()

DB_PATH = str(DATA_DIR / "lego_catalog.db")
CONFIG_DB_PATH = str(DATA_DIR / "aim2build_config.db")

# -------------------------
# Limits
# -------------------------

DEFAULT_LIMIT = 200
MAX_LIMIT = 500

MAX_Q_LEN = 80
MAX_PAGE = 200
MAX_PAGE_SIZE = 60


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


def _clamp_page(n: int) -> int:
    try:
        n2 = int(n)
    except Exception:
        n2 = 1
    if n2 < 1:
        n2 = 1
    if n2 > MAX_PAGE:
        n2 = MAX_PAGE
    return n2


def _clamp_page_size(n: int) -> int:
    try:
        n2 = int(n)
    except Exception:
        n2 = 60
    if n2 < 1:
        n2 = 1
    if n2 > MAX_PAGE_SIZE:
        n2 = MAX_PAGE_SIZE
    return n2


def _trim_q(s: str) -> str:
    s = (s or "").strip()
    if len(s) > MAX_Q_LEN:
        s = s[:MAX_Q_LEN]
    return s


def _like_escape(s: str) -> str:
    # Escape LIKE wildcards so user cannot force broad scans with % or _
    return (s or "").replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


# -------------------------
# DB
# -------------------------

def _db() -> sqlite3.Connection:
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="lego_catalog.db missing")
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row

    # Attach config DB for overrides if present
    try:
        if os.path.exists(CONFIG_DB_PATH):
            con.execute("ATTACH DATABASE ? AS cfg", (CONFIG_DB_PATH,))
    except Exception:
        # Optional; search still works without cfg DB
        pass

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


def _has_cfg_table(con: sqlite3.Connection, table_name: str) -> bool:
    try:
        row = con.execute(
            "SELECT 1 FROM cfg.sqlite_master WHERE type='table' AND name=? LIMIT 1",
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


def _theme_override_sql(con: sqlite3.Connection) -> Tuple[str, str]:
    """
    Returns (join_sql, effective_theme_sql) for config-driven theme overrides.
    If cfg DB or table isn't present, returns no-op join and "s.theme_id".
    """
    try:
        if _has_cfg_table(con, "set_theme_overrides"):
            join_sql = """
            LEFT JOIN cfg.set_theme_overrides sto
              ON sto.enabled = 1
             AND sto.set_num = s.set_num
            """.strip()
            eff = "COALESCE(sto.theme_id_override, s.theme_id)"
            return join_sql, eff
    except Exception:
        pass
    return "", "s.theme_id"


def _theme_includes_clause(con: sqlite3.Connection, theme_id: int, eff_theme_sql: str) -> Tuple[str, List[int]]:
    """
    Adds theme includes + per-set theme overrides for theme browsing.

    Effective match rules for a requested theme_id:
      - eff_theme = theme_id
      - OR eff_theme IN cfg.theme_includes(include_theme_id)
      - OR s.set_num IN cfg.theme_set_overrides(set_num)
    """
    params: List[int] = []

    include_sql = ""
    if _has_cfg_table(con, "theme_includes"):
        include_sql = f"""
            OR {eff_theme_sql} IN (
                SELECT include_theme_id
                FROM cfg.theme_includes
                WHERE theme_id = ?
                  AND enabled = 1
            )
        """
        params.append(int(theme_id))

    set_sql = ""
    if _has_cfg_table(con, "theme_set_overrides"):
        set_sql = """
            OR s.set_num IN (
                SELECT set_num
                FROM cfg.theme_set_overrides
                WHERE theme_id = ?
                  AND enabled = 1
            )
        """
        params.append(int(theme_id))

    clause = f"(({eff_theme_sql} = ?) {include_sql} {set_sql})"
    return clause, [int(theme_id), *params]
# -------------------------
# Normalization helpers
# -------------------------

def _norm_q(s: str) -> str:
    s = (s or "").strip().lower()
    s = s.replace("+", " ")
    s = s.replace("-", " ").replace("_", " ")
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _base_set_num(s: str) -> Optional[str]:
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
    return "ORDER BY s.year DESC, s.set_num"


def _base_where_clause(min_parts: int) -> str:
    return f"""
        s.name IS NOT NULL
        AND TRIM(s.name) != ''
        AND COALESCE(s.num_parts, 0) >= {int(min_parts)}
        AND s.set_num LIKE '%-%'
    """


def _theme_noise_clause() -> str:
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


# -------------------------
# Search
# -------------------------

@router.get("/search/paged")
def search_paged(
    q: str = Query("", min_length=0),
    page: int = Query(1, ge=1),
    page_size: int = Query(60, ge=1),
    fuzzy: bool = Query(False),
    sort: str = Query("recent"),
):
    q_raw_full = _trim_q((q or "").strip())
    if not q_raw_full:
        return {"results": [], "page": 1, "page_size": 0, "total": 0, "has_more": False}

    page = _clamp_page(page)
    page_size = _clamp_page_size(page_size)
    offset = (page - 1) * page_size

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
    join_theme_sql, eff_theme_sql = _theme_override_sql(con)

    # Theme filtering (DB-driven)
    theme_ids, q_rest_raw, theme_forced = _theme_filter_from_query(con, q_raw_full)

    # intent based on full query
    q_norm_full = _norm_q(q_raw_full)
    wants_figures = _wants_figures(q_norm_full)
    allow_small = _allow_small_sets(q_norm_full)
    looks_set = _looks_like_set_num(q_raw_full)
    min_parts = 20 if (looks_set or allow_small) else 50

    # ---------- PURE THEME MODE ----------
    q_rest_norm = _norm_q(q_rest_raw)
    if theme_ids and not q_rest_norm:
        # If multiple theme_ids detected (descendants), keep simple IN() on eff theme
        # (theme_includes applies only for single-theme root browsing)
        if len(theme_ids) == 1:
            theme_clause, theme_clause_params = _theme_includes_clause(con, theme_ids[0], eff_theme_sql)
        else:
            placeholders = ",".join(["?"] * len(theme_ids))
            theme_clause = f"({eff_theme_sql} IN ({placeholders}))"
            theme_clause_params = [int(x) for x in theme_ids]

        where_sql = f"""
            ({_base_where_clause(min_parts)})
            {_theme_noise_clause()}
            {" " if (wants_figures or theme_forced) else _no_figures_clause()}
            AND {theme_clause}
            {where_filters_sql}
        """

        count_sql = f"""
            SELECT COUNT(1) AS n
            FROM sets s
            {join_theme_sql}
            LEFT JOIN themes t ON t.theme_id = {eff_theme_sql}
            LEFT JOIN themes traw ON traw.theme_id = s.theme_id
            {join_filters_sql}
            WHERE {where_sql}
        """
        total = int(cur.execute(count_sql, (*theme_clause_params,)).fetchone()["n"])

        page_sql = f"""
            SELECT
                s.set_num, s.name, s.year, s.num_parts, s.set_img_url,
                t.name AS theme_name
            FROM sets s
            {join_theme_sql}
            LEFT JOIN themes t ON t.theme_id = {eff_theme_sql}
            LEFT JOIN themes traw ON traw.theme_id = s.theme_id
            {join_filters_sql}
            WHERE {where_sql}
            {_order_by(sort)}
            LIMIT ? OFFSET ?
        """
        cur.execute(page_sql, (*theme_clause_params, int(page_size), int(offset)))
        results = [_row_to_set(r) for r in cur.fetchall()]
        con.close()
        return {"results": results, "page": page, "page_size": page_size, "total": total, "has_more": (offset + len(results)) < total}

    # ---------- DEFAULT LIST MODE ----------
    q_norm = _strip_stopwords(_norm_q(q_rest_raw))
    q_tokens = [t for t in q_norm.split() if t]

    if theme_ids:
        generic = {"house", "set", "lego", "kit", "model"}
        q_tokens = [t for t in q_tokens if t not in generic]

    # If nothing meaningful remains, treat it as a theme-only PAGED search
    if not q_tokens:
        if theme_ids:
            if len(theme_ids) == 1:
                theme_clause, theme_clause_params = _theme_includes_clause(con, theme_ids[0], eff_theme_sql)
            else:
                placeholders = ",".join(["?"] * len(theme_ids))
                theme_clause = f"({eff_theme_sql} IN ({placeholders}))"
                theme_clause_params = [int(x) for x in theme_ids]
            theme_filter_sql = f" AND {theme_clause} "
            theme_params = theme_clause_params
        else:
            theme_filter_sql = ""
            theme_params = []

        where_sql = f"""
            ({_base_where_clause(min_parts)})
            {_theme_noise_clause()}
            {" " if (wants_figures or theme_forced) else _no_figures_clause()}
            {theme_filter_sql}
            {where_filters_sql}
        """

        count_sql = f"""
            SELECT COUNT(1) AS n
            FROM sets s
            {join_theme_sql}
            LEFT JOIN themes t ON t.theme_id = {eff_theme_sql}
            LEFT JOIN themes traw ON traw.theme_id = s.theme_id
            {join_filters_sql}
            WHERE {where_sql}
        """
        total = int(cur.execute(count_sql, (*theme_params,)).fetchone()["n"])

        page_sql = f"""
            SELECT
                s.set_num, s.name, s.year, s.num_parts, s.set_img_url,
                t.name AS theme_name
            FROM sets s
            {join_theme_sql}
            LEFT JOIN themes t ON t.theme_id = {eff_theme_sql}
            LEFT JOIN themes traw ON traw.theme_id = s.theme_id
            {join_filters_sql}
            WHERE {where_sql}
            {_order_by(sort)}
            LIMIT ? OFFSET ?
        """
        cur.execute(page_sql, (*theme_params, int(page_size), int(offset)))
        results = [_row_to_set(r) for r in cur.fetchall()]
        con.close()
        return {"results": results, "page": page, "page_size": page_size, "total": total, "has_more": (offset + len(results)) < total}

    # ---------- NORMAL MODE ----------
    token_sql_parts: List[str] = []
    token_params: List[str] = []
    for tok in q_tokens:
        like_tok = f"%{tok}%"
        token_sql_parts.append(
            "("
            "LOWER(REPLACE(s.name, '-', ' ')) LIKE ? "
            "OR (t.name IS NOT NULL AND LOWER(REPLACE(t.name, '-', ' ')) LIKE ?) "
            "OR (traw.name IS NOT NULL AND LOWER(REPLACE(traw.name, '-', ' ')) LIKE ?)"
            ")"
        )
        token_params.extend([like_tok, like_tok, like_tok])

    token_sql = " AND ".join(token_sql_parts) if token_sql_parts else "1=1"

    q_rest_raw_esc = _like_escape(q_rest_raw)
    set_like_1 = f"%{q_rest_raw_esc}%"
    q2 = _norm_set_num(q_rest_raw)
    q2_esc = _like_escape(q2)
    set_like_2 = f"%{q2_esc}%" if q2 != q_rest_raw else set_like_1

    # Theme filter for NORMAL MODE
    theme_params: List[int] = []
    theme_filter_sql = ""
    if theme_ids:
        if len(theme_ids) == 1:
            theme_clause, theme_clause_params = _theme_includes_clause(con, theme_ids[0], eff_theme_sql)
            theme_filter_sql = f" AND {theme_clause} "
            theme_params = theme_clause_params
        else:
            placeholders = ",".join(["?"] * len(theme_ids))
            theme_filter_sql = f" AND {eff_theme_sql} IN ({placeholders}) "
            theme_params = [int(x) for x in theme_ids]

    where_sql = f"""
        ({_base_where_clause(min_parts)})
        {_theme_noise_clause()}
        {" " if (wants_figures or theme_forced) else _no_figures_clause()}
        {where_filters_sql}
        {theme_filter_sql}
        AND (
            s.set_num LIKE ? ESCAPE '\\'
            OR s.set_num LIKE ? ESCAPE '\\'
            OR ({token_sql})
        )
    """

    count_sql = f"""
        SELECT COUNT(1) AS n
        FROM sets s
        {join_theme_sql}
        LEFT JOIN themes t ON t.theme_id = {eff_theme_sql}
        LEFT JOIN themes traw ON traw.theme_id = s.theme_id
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
        {join_theme_sql}
        LEFT JOIN themes t ON t.theme_id = {eff_theme_sql}
        LEFT JOIN themes traw ON traw.theme_id = s.theme_id
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
    q_raw_full = _trim_q((q or "").strip())
    if not q_raw_full:
        return []

    con = _db()
    cur = con.cursor()
    limit = _clamp_limit(limit)

    join_filters_sql, where_filters_sql = _filters_sql(con)
    join_theme_sql, eff_theme_sql = _theme_override_sql(con)

    theme_ids, q_rest_raw, theme_forced = _theme_filter_from_query(con, q_raw_full)

    q_norm_full = _norm_q(q_raw_full)
    wants_figures = _wants_figures(q_norm_full)
    allow_small = _allow_small_sets(q_norm_full)
    looks_set = _looks_like_set_num(q_raw_full)
    min_parts = 20 if (looks_set or allow_small) else 50

    q_rest_norm = _norm_q(q_rest_raw)
    if theme_ids and not q_rest_norm:
        if len(theme_ids) == 1:
            theme_clause, theme_clause_params = _theme_includes_clause(con, theme_ids[0], eff_theme_sql)
            theme_filter_sql = f" AND {theme_clause} "
            theme_params = theme_clause_params
        else:
            placeholders = ",".join(["?"] * len(theme_ids))
            theme_filter_sql = f" AND {eff_theme_sql} IN ({placeholders}) "
            theme_params = [int(x) for x in theme_ids]

        sql = f"""
            SELECT
                s.set_num, s.name, s.year, s.num_parts, s.set_img_url,
                t.name AS theme_name
            FROM sets s
            {join_theme_sql}
            LEFT JOIN themes t ON t.theme_id = {eff_theme_sql}
            LEFT JOIN themes traw ON traw.theme_id = s.theme_id
            {join_filters_sql}
            WHERE
                ({_base_where_clause(min_parts)})
                {_theme_noise_clause()}
                {" " if (wants_figures or theme_forced) else _no_figures_clause()}
                {where_filters_sql}
                {theme_filter_sql}
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
            {join_theme_sql}
            LEFT JOIN themes t ON t.theme_id = {eff_theme_sql}
            LEFT JOIN themes traw ON traw.theme_id = s.theme_id
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
            "("
            "LOWER(REPLACE(s.name, '-', ' ')) LIKE ? "
            "OR (t.name IS NOT NULL AND LOWER(REPLACE(t.name, '-', ' ')) LIKE ?) "
            "OR (traw.name IS NOT NULL AND LOWER(REPLACE(traw.name, '-', ' ')) LIKE ?)"
            ")"
        )
        token_params.extend([like_tok, like_tok, like_tok])

    token_sql = " AND ".join(token_sql_parts) if token_sql_parts else "1=1"

    q_rest_raw_esc = _like_escape(q_rest_raw)
    set_like_1 = f"%{q_rest_raw_esc}%"
    q2 = _norm_set_num(q_rest_raw)
    q2_esc = _like_escape(q2)
    set_like_2 = f"%{q2_esc}%" if q2 != q_rest_raw else set_like_1

    # Theme filter for NORMAL MODE
    theme_params: List[int] = []
    theme_filter_sql = ""
    if theme_ids:
        if len(theme_ids) == 1:
            theme_clause, theme_clause_params = _theme_includes_clause(con, theme_ids[0], eff_theme_sql)
            theme_filter_sql = f" AND {theme_clause} "
            theme_params = theme_clause_params
        else:
            placeholders = ",".join(["?"] * len(theme_ids))
            theme_filter_sql = f" AND {eff_theme_sql} IN ({placeholders}) "
            theme_params = [int(x) for x in theme_ids]

    sql = f"""
        SELECT
            s.set_num, s.name, s.year, s.num_parts, s.set_img_url,
            t.name AS theme_name
        FROM sets s
        {join_theme_sql}
        LEFT JOIN themes t ON t.theme_id = {eff_theme_sql}
        LEFT JOIN themes traw ON traw.theme_id = s.theme_id
        {join_filters_sql}
        WHERE
            ({_base_where_clause(min_parts)})
            {_theme_noise_clause()}
            {" " if (wants_figures or theme_forced) else _no_figures_clause()}
            {where_filters_sql}
            {theme_filter_sql}
            AND (
                s.set_num LIKE ? ESCAPE '\\'
                OR s.set_num LIKE ? ESCAPE '\\'
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
    q_raw_full = _trim_q((q or "").strip())
    if not q_raw_full:
        return []

    con = _db()
    cur = con.cursor()
    limit = _clamp_limit(limit)

    join_filters_sql, where_filters_sql = _filters_sql(con)
    join_theme_sql, eff_theme_sql = _theme_override_sql(con)

    theme_ids, q_rest_raw, theme_forced = _theme_filter_from_query(con, q_raw_full)

    q_norm_full = _norm_q(q_raw_full)
    wants_figures = _wants_figures(q_norm_full)
    allow_small = _allow_small_sets(q_norm_full)
    looks_set = _looks_like_set_num(q_raw_full)
    min_parts = 20 if (looks_set or allow_small) else 50

    q_norm = _norm_q(q_rest_raw)

    # Build theme filter for fuzzy candidate pull
    theme_params: List[int] = []
    theme_filter_sql = ""
    if theme_ids:
        if len(theme_ids) == 1:
            theme_clause, theme_clause_params = _theme_includes_clause(con, theme_ids[0], eff_theme_sql)
            theme_filter_sql = f" AND {theme_clause} "
            theme_params = theme_clause_params
        else:
            placeholders = ",".join(["?"] * len(theme_ids))
            theme_filter_sql = f" AND {eff_theme_sql} IN ({placeholders}) "
            theme_params = [int(x) for x in theme_ids]

    if theme_ids and not q_norm:
        cur.execute(
            f"""
            SELECT
                s.set_num, s.name, s.year, s.num_parts, s.set_img_url,
                t.name AS theme_name
            FROM sets s
            {join_theme_sql}
            LEFT JOIN themes t ON t.theme_id = {eff_theme_sql}
            LEFT JOIN themes traw ON traw.theme_id = s.theme_id
            {join_filters_sql}
            WHERE
                ({_base_where_clause(min_parts)})
                {_theme_noise_clause()}
                {" " if (wants_figures or theme_forced) else _no_figures_clause()}
                {where_filters_sql}
                {theme_filter_sql}
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
            {join_theme_sql}
            LEFT JOIN themes t ON t.theme_id = {eff_theme_sql}
            LEFT JOIN themes traw ON traw.theme_id = s.theme_id
            {join_filters_sql}
            WHERE
                ({_base_where_clause(min_parts)})
                {_theme_noise_clause()}
                {" " if (wants_figures or theme_forced) else _no_figures_clause()}
                {where_filters_sql}
                {theme_filter_sql}
                AND (
                    LOWER(REPLACE(s.name, '-', ' ')) LIKE ?
                    OR s.set_num LIKE ? ESCAPE '\\'
                    OR (t.name IS NOT NULL AND LOWER(REPLACE(t.name, '-', ' ')) LIKE ?)
                    OR (traw.name IS NOT NULL AND LOWER(REPLACE(traw.name, '-', ' ')) LIKE ?)
                )
            LIMIT 2500
            """,
            (*theme_params, like, like, like, like),
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
                # Base fuzzy score
                base_score = fuzz.token_set_ratio(q_norm, hay)

                # Strong boost for exact / near-exact set number queries
                q_base = _base_set_num(q_norm)  # works for "11370" or "11370-1"
                if q_base:
                    sn_base = _base_set_num(set_num) or ""
                    if q_base == sn_base:
                        base_score += 40

                # Boost if query appears directly in set name
                name_norm = _norm_q(name)
                if q_norm and q_norm in name_norm:
                    base_score += 25

                # Boost if query appears directly in resolved theme name
                theme_norm = _norm_q(theme_name)
                if theme_norm and q_norm in theme_norm:
                    base_score += 15

                # Prefix boost (helps short queries like "creel")
                if q_norm and name_norm.startswith(q_norm):
                    base_score += 10

                score = min(int(base_score), 100)

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
