from fastapi import APIRouter, HTTPException
from app.config import DB_PATH
import sqlite3, csv, pathlib, os, json
import requests
from typing import List, Dict, Any

router = APIRouter()  # mounted under /api/catalog

# --- SQLite helpers (normalized set parts) ---
def _db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con

def ensure_tables():
    with _db() as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS set_parts (
          set_num    TEXT NOT NULL,
          part_num   TEXT NOT NULL,
          color_id   INTEGER NOT NULL,
          qty        INTEGER NOT NULL,
          part_name  TEXT,
          color_name TEXT,
          img_url    TEXT,
          PRIMARY KEY (set_num, part_num, color_id)
        );
        """)


# ---- Helper: load parts for a given set_num (used by buildability.compare) ----
def get_set_parts(set_num: str) -> List[Dict[str, Any]]:
    """
    Load parts for a given set number.
    Priority:
      1) SQLite table set_parts
      2) Local JSON files under backend/app/data/catalog/
    """
    ensure_tables()
    # 1) Try DB first
    with _db() as con:
        rows = con.execute(
            "SELECT part_num, color_id, qty, part_name, color_name, img_url FROM set_parts WHERE set_num=?",
            (set_num,)
        ).fetchall()
    if rows:
        return [
            {
                "part_num": r["part_num"],
                "color_id": int(r["color_id"]),
                "qty": int(r["qty"]),
                "part_name": r["part_name"],
                "color_name": r["color_name"],
                "img_url": r["img_url"],
            }
            for r in rows
        ]
    
    # 2) Fallback to JSON files on disk
    here = pathlib.Path(__file__).resolve().parent
    base = (here / "../data/catalog").resolve()
    candidates = [
        base / f"{set_num}.json",
        base / "sets" / f"{set_num}.json",
    ]
    for p in candidates:
        if p.exists():
            with p.open("r", encoding="utf-8") as f:
                data = json.load(f)
            rows = data.get("results") if isinstance(data, dict) else data
            if rows is None and isinstance(data, dict):
                rows = data.get("parts")
            out: List[Dict[str, Any]] = []
            for r in rows or []:
                # Accept several common shapes
                part_num = r.get("part_num") or (r.get("part") or {}).get("part_num")
                color_id = (
                    r.get("color_id")
                    if r.get("color_id") is not None
                    else ((r.get("color") or {}).get("id"))
                )
                qty = r.get("quantity") or r.get("qty") or r.get("num_parts") or 0
                if not part_num or color_id is None:
                    continue
                out.append({
                    "part_num": part_num,
                    "color_id": int(color_id),
                    "qty": int(qty),
                    "part_name": r.get("part_name") or (r.get("part") or {}).get("name"),
                    "color_name": r.get("color_name") or (r.get("color") or {}).get("name"),
                    "img_url": r.get("img_url") or (r.get("part") or {}).get("part_img_url"),
                })
            return out
    raise HTTPException(status_code=404, detail=f"No parts found for {set_num} (DB or files)")

@router.get("/parts/{set_num}")
def parts_for_set(set_num: str):
    """
    API facade used for quick testing; primary consumer is buildability.compare.
    """
    rows = get_set_parts(set_num)
    return {"ok": True, "set_num": set_num, "rows": rows, "count": len(rows)}

@router.get("/ping")
def ping():
    return {"ok": True, "db": DB_PATH}

@router.post("/import")
def import_catalog():
    root = pathlib.Path("backend/app/data/catalog")
    db = sqlite3.connect(DB_PATH); c = db.cursor()
    c.executescript("""
CREATE TABLE IF NOT EXISTS colors(id INTEGER PRIMARY KEY,name TEXT,rgb TEXT,is_trans INTEGER);
CREATE TABLE IF NOT EXISTS elements(element_id TEXT PRIMARY KEY, part_num TEXT, color_id INTEGER, design_id TEXT);
CREATE TABLE IF NOT EXISTS inventories(id INTEGER PRIMARY KEY,set_num TEXT,version INTEGER);
CREATE TABLE IF NOT EXISTS inventory_minifigs(inventory_id INTEGER,minifig_num TEXT,quantity INTEGER);
CREATE TABLE IF NOT EXISTS parts(part_num TEXT PRIMARY KEY,name TEXT,part_cat_id INTEGER);
CREATE TABLE IF NOT EXISTS themes(id INTEGER PRIMARY KEY,name TEXT,parent_id INTEGER);
CREATE TABLE IF NOT EXISTS sets(set_num TEXT PRIMARY KEY,name TEXT,year INTEGER,theme_id INTEGER);
""")
    def imp(fn, table, cols):
        p = root / fn
        if not p.exists():
            return {"table": table, "rows": 0, "status": f"{fn} not found"}
        with p.open(newline='', encoding='utf-8') as f:
            r = csv.DictReader(f)
            rows = [tuple(row.get(k) or None for k in cols) for row in r]
        q = f"INSERT OR REPLACE INTO {table} ({','.join(cols)}) VALUES ({','.join(['?']*len(cols))})"
        c.executemany(q, rows)
        return {"table": table, "rows": len(rows), "status": "ok"}

    results = []
    results.append(imp("colors.csv",             "colors",             ["id","name","rgb","is_trans"]))
    results.append(imp("elements.csv",           "elements",           ["element_id","part_num","color_id","design_id"]))
    results.append(imp("inventories.csv",        "inventories",        ["id","set_num","version"]))
    results.append(imp("inventory_minifigs.csv", "inventory_minifigs", ["inventory_id","minifig_num","quantity"]))
    results.append(imp("parts.csv",              "parts",              ["part_num","name","part_cat_id"]))
    results.append(imp("themes.csv",             "themes",             ["id","name","parent_id"]))
    results.append(imp("sets.csv",               "sets",               ["set_num","name","year","theme_id"]))
    db.commit(); db.close()
    return {"ok": True, "db": DB_PATH, "results": results}

@router.post("/import/{set_num}")
def import_set_parts(set_num: str, page_size: int = 1000):
    """
    Fetch set parts from Rebrickable and store normalized rows into SQLite.
    Requires env REBRICKABLE_API_KEY (or REBRICKABLE_KEY).
    """
    ensure_tables()
    import os, requests
    api_key = os.environ.get("REBRICKABLE_API_KEY") or os.environ.get("REBRICKABLE_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="Missing REBRICKABLE_API_KEY env")

    url = f"https://rebrickable.com/api/v3/lego/sets/{set_num}/parts/"
    params = {"key": api_key, "page_size": page_size}
    r = requests.get(url, params=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    rows = data.get("results") or data.get("parts") or []
    if not isinstance(rows, list):
        raise HTTPException(status_code=500, detail="Unexpected response shape from Rebrickable")

    with _db() as con:
        cur = con.cursor()
        for x in rows:
            part = (x.get("part") or {})
            color = (x.get("color") or {})
            part_num = part.get("part_num") or x.get("part_num")
            color_id = color.get("id") or x.get("color_id")
            qty = x.get("quantity") or x.get("qty") or 0
            if not part_num or color_id is None: 
                continue
            cur.execute("""
                INSERT INTO set_parts (set_num, part_num, color_id, qty, part_name, color_name, img_url)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(set_num, part_num, color_id) DO UPDATE SET
                  qty=excluded.qty, part_name=excluded.part_name, color_name=excluded.color_name, img_url=excluded.img_url
            """, (set_num, str(part_num), int(color_id), int(qty), part.get("name"), color.get("name"), part.get("part_img_url")))
        con.commit()
    return {"ok": True, "set_num": set_num, "rows": len(rows)}
