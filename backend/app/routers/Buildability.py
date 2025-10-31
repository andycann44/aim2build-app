from fastapi import APIRouter, HTTPException
from ..import_catalog import import_all
import sqlite3, os

router = APIRouter()

@router.post("/catalog/import")
def catalog_import():
    try:
        stats = import_all()
        return {"ok": True, "stats": stats}
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {e}")

@router.get("/catalog/stats")
def catalog_stats():
    db = os.environ.get("A2B_DB", "backend/app/aim2build.db")
    con = sqlite3.connect(db)
    cur = con.cursor()
    get = lambda sql: cur.execute(sql).fetchone()[0]
    try:
        return {
            "sets": get("SELECT COUNT(*) FROM sets"),
            "parts": get("SELECT COUNT(*) FROM parts"),
            "colors": get("SELECT COUNT(*) FROM colors"),
            "inventories": get("SELECT COUNT(*) FROM inventories"),
            "inventory_parts": get("SELECT COUNT(*) FROM inventories_parts"),
            "set_parts": get("SELECT COUNT(*) FROM set_parts"),
        }
    except sqlite3.Error:
        # likely schema not applied yet
        return {"sets": 0, "parts": 0, "colors": 0, "inventories": 0, "inventory_parts": 0, "set_parts": 0}
    finally:
        con.close()
