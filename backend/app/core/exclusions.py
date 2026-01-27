import os
import time
from typing import Optional, Set, Tuple, Dict, Any

_CACHE: Dict[str, Any] = {"ts": 0.0, "sets": set(), "themes": set()}
DEFAULT_TTL_SECONDS = 60

def _normalize_set_num(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    s = s.strip()
    if not s:
        return None
    if s.isdigit():
        return s + "-1"
    return s

def _read_list_file(path: str) -> list[str]:
    out: list[str] = []
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                out.append(line.split("|", 1)[0].strip())
    except FileNotFoundError:
        return []
    return out

def load_excludes(ttl_seconds: int = DEFAULT_TTL_SECONDS) -> Tuple[Set[str], Set[int]]:
    now = time.time()
    ts = float(_CACHE.get("ts", 0.0) or 0.0)
    if now - ts < ttl_seconds:
        return _CACHE["sets"], _CACHE["themes"]  # type: ignore

    base = os.path.expanduser("~/aim2build-control/filters")
    sets_file = os.path.join(base, "exclude_sets.txt")
    themes_file = os.path.join(base, "exclude_themes.txt")

    sets_raw = _read_list_file(sets_file)
    themes_raw = _read_list_file(themes_file)

    sets: Set[str] = set()
    for v in sets_raw:
        norm = _normalize_set_num(v)
        if norm:
            sets.add(norm)

    themes: Set[int] = set()
    for v in themes_raw:
        if v.isdigit():
            themes.add(int(v))

    _CACHE["ts"] = now
    _CACHE["sets"] = sets
    _CACHE["themes"] = themes
    return sets, themes

def check_set_allowed(set_num: str, db_conn) -> Dict[str, Any]:
    set_num = _normalize_set_num(set_num) or set_num
    excl_sets, excl_themes = load_excludes()

    if set_num in excl_sets:
        return {"allowed": False, "source": "set", "theme_id": None}

    theme_id = None
    try:
        cur = db_conn.execute("SELECT theme_id FROM sets WHERE set_num = ?", (set_num,))
        row = cur.fetchone()
        if row and row[0] is not None:
            theme_id = int(row[0])
    except Exception:
        theme_id = None

    if theme_id is not None and theme_id in excl_themes:
        return {"allowed": False, "source": "theme", "theme_id": theme_id}

    return {"allowed": True, "source": None, "theme_id": theme_id}
