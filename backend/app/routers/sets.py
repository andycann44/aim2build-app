from fastapi import APIRouter, Query
from typing import List, Dict, Any
import os, sqlite3
import requests
from backend.app.config import DB_PATH

router = APIRouter()  # mounted under /api/sets in main.py

def _offline_search(q: str, limit: int) -> Dict[str, Any]:
    con = sqlite3.connect(DB_PATH); cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sets(
          set_num TEXT PRIMARY KEY,
          name TEXT, year INTEGER, theme_id INTEGER
        )
    """)
    like = f"%{q}%"
    cur.execute("""
        SELECT set_num, name, year, theme_id
        FROM sets
        WHERE name LIKE ? OR set_num LIKE ?
        ORDER BY year DESC, set_num DESC
        LIMIT ?
    """, (like, like, limit))
    items = [
        {"set_num": r[0], "name": r[1], "year": r[2], "theme_id": r[3], "set_img_url": None, "num_parts": None}
        for r in cur.fetchall()
    ]
    con.close()
    return {"source": "offline", "count": len(items), "items": items}

def _online_search(q: str, limit: int, api_key: str) -> Dict[str, Any]:
    url = "https://rebrickable.com/api/v3/lego/sets/"
    headers = {"Authorization": f"key {api_key}"}
    params = {"search": q, "page_size": limit}
    r = requests.get(url, headers=headers, params=params, timeout=20)
    r.raise_for_status()
    data = r.json()
    items = []
    for s in data.get("results", []):
        items.append({
            "set_num": s.get("set_num"),
            "name": s.get("name"),
            "year": s.get("year"),
            "theme_id": s.get("theme_id"),
            "num_parts": s.get("num_parts"),
            "set_img_url": s.get("set_img_url"),
        })
    return {"source": "online", "count": len(items), "items": items}

@router.get("/search_sets", tags=["sets"])
def search_sets(
    q: str = Query(..., description="Search text for LEGO sets"),
    limit: int = Query(20, ge=1, le=100),
    offline: str = Query("auto", regex="^(auto|true|false)$",
                         description="auto=true uses online if API key present; true=force offline; false=force online")
) -> Dict[str, Any]:
    """
    Search LEGO sets. Priority:
    - offline=auto: use Rebrickable if REBRICKABLE_API_KEY is set; else offline DB
    - offline=true: use offline DB
    - offline=false: require Rebrickable (fails if no key)
    """
    api_key = os.getenv("REBRICKABLE_API_KEY") or ""
    if offline == "true":
        return _offline_search(q, limit)
    if offline == "false":
        if not api_key:
            return {"source": "online", "error": "REBRICKABLE_API_KEY not set"}
        try:
            return _online_search(q, limit, api_key)
        except Exception as e:
            return {"source": "online", "error": str(e)}
    # auto
    if api_key:
        try:
            return _online_search(q, limit, api_key)
        except Exception:
            # silent fallback offline if online fails
            return _offline_search(q, limit)
    return _offline_search(q, limit)
