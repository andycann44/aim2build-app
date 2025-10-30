from fastapi import APIRouter, Query
from typing import List, Dict, Any, Optional
import os, sqlite3
import requests
from backend.app.config import DB_PATH

router = APIRouter()  # mounted under /api/sets in main.py

def _apply_fields(items: List[Dict[str, Any]], fields: Optional[List[str]]) -> List[Dict[str, Any]]:
    if not fields:
        return items
    wanted = set(f.strip() for f in fields if f.strip())
    return [{k:v for k,v in it.items() if k in wanted} for it in items]

def _offline_search(q: str, limit: int,
                    theme_id: Optional[int],
                    year_min: Optional[int], year_max: Optional[int],
                    parts_min: Optional[int], parts_max: Optional[int]) -> Dict[str, Any]:
    con = sqlite3.connect(DB_PATH); cur = con.cursor()
    # ensure table exists even if import not run yet
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sets(
          set_num TEXT PRIMARY KEY,
          name TEXT,
          year INTEGER,
          theme_id INTEGER
        )
    """)
    like = f"%{q}%"
    sql = """
        SELECT set_num, name, year, theme_id
        FROM sets
        WHERE (name LIKE ? OR set_num LIKE ?)
    """
    params = [like, like]
    if theme_id is not None:
        sql += " AND theme_id = ?"; params.append(theme_id)
    if year_min is not None:
        sql += " AND year >= ?"; params.append(year_min)
    if year_max is not None:
        sql += " AND year <= ?"; params.append(year_max)
    sql += " ORDER BY year DESC, set_num DESC LIMIT ?"; params.append(limit)
    cur.execute(sql, params)
    items = [{
        "set_num": r[0],
        "name": r[1],
        "year": r[2],
        "theme_id": r[3],
        "num_parts": None,
        "set_img_url": None,
    } for r in cur.fetchall()]
    con.close()
    return {"source": "offline", "count": len(items), "items": items}

def _online_search(q: str, limit: int, api_key: str,
                   theme_id: Optional[int],
                   year_min: Optional[int], year_max: Optional[int],
                   parts_min: Optional[int], parts_max: Optional[int]) -> Dict[str, Any]:
    url = "https://rebrickable.com/api/v3/lego/sets/"
    headers = {"Authorization": f"key {api_key}"}
    params = {"search": q, "page_size": limit}
    if theme_id is not None: params["theme_id"] = theme_id
    if year_min is not None: params["min_year"] = year_min
    if year_max is not None: params["max_year"] = year_max
    if parts_min is not None: params["min_parts"] = parts_min
    if parts_max is not None: params["max_parts"] = parts_max
    r = requests.get(url, headers=headers, params=params, timeout=20)
    r.raise_for_status()
    data = r.json()
    items = [{
        "set_num": s.get("set_num"),
        "name": s.get("name"),
        "year": s.get("year"),
        "theme_id": s.get("theme_id"),
        "num_parts": s.get("num_parts"),
        "set_img_url": s.get("set_img_url"),
        "last_modified_dt": s.get("last_modified_dt"),
    } for s in data.get("results", [])]
    return {"source": "online", "count": len(items), "items": items}

@router.get("/search_sets", tags=["sets"])
def search_sets(
    q: str = Query(..., description="Search text for LEGO sets"),
    limit: int = Query(20, ge=1, le=100),
    offline: str = Query("auto", pattern="^(auto|true|false)$",
                         description="auto=true uses online if API key present; true=force offline; false=force online"),
    theme_id: Optional[int] = None,
    year_min: Optional[int] = Query(None, ge=1950, le=2100),
    year_max: Optional[int] = Query(None, ge=1950, le=2100),
    num_parts_min: Optional[int] = Query(None, ge=0),
    num_parts_max: Optional[int] = Query(None, ge=0),
    fields: Optional[List[str]] = Query(None, description="Subset fields, e.g. fields=set_num&fields=name&fields=year"),
) -> Dict[str, Any]:
    api_key = os.getenv("REBRICKABLE_API_KEY") or ""
    if offline == "true":
        result = _offline_search(q, limit, theme_id, year_min, year_max, num_parts_min, num_parts_max)
    elif offline == "false":
        if not api_key:
            result = {"source": "online", "error": "REBRICKABLE_API_KEY not set"}
        else:
            try:
                result = _online_search(q, limit, api_key, theme_id, year_min, year_max, num_parts_min, num_parts_max)
            except Exception as e:
                result = {"source": "online", "error": str(e)}
    else:  # auto
        if api_key:
            try:
                result = _online_search(q, limit, api_key, theme_id, year_min, year_max, num_parts_min, num_parts_max)
            except Exception:
                result = _offline_search(q, limit, theme_id, year_min, year_max, num_parts_min, num_parts_max)
        else:
            result = _offline_search(q, limit, theme_id, year_min, year_max, num_parts_min, num_parts_max)
    if fields:
        result["items"] = _apply_fields(result.get("items", []), fields)
    return result
