from fastapi import APIRouter
from backend.app.config import DB_PATH
import sqlite3, csv, pathlib

router = APIRouter()  # mounted under /api/catalog

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
