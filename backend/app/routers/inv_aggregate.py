import os, sqlite3
from fastapi import APIRouter
router = APIRouter()
DB = os.getenv("A2B_DB","data/aim2build.db")
def db(): 
    con = sqlite3.connect(DB); con.row_factory = sqlite3.Row; return con

@router.post("/inventory/aggregate")
def aggregate_inventory():
    with db() as con:
        con.execute("""
          CREATE TABLE IF NOT EXISTS inventory(
            part_num TEXT NOT NULL,
            color_id INTEGER NOT NULL,
            qty_total INTEGER NOT NULL DEFAULT 0,
            qty_loose INTEGER NOT NULL DEFAULT 0,
            qty_in_sets INTEGER NOT NULL DEFAULT 0,
            notes TEXT,
            PRIMARY KEY(part_num,color_id)
          )
        """)
        # recompute from set_bom (all cached sets count as owned qty=1)
        con.execute("DELETE FROM inventories")
        con.execute("""
          INSERT INTO inventory(part_num,color_id,qty_total,qty_in_sets,qty_loose)
          SELECT part_num, color_id, SUM(qty) AS qty_total, SUM(qty) AS qty_in_sets, 0
          FROM set_bom WHERE COALESCE(is_spare,0)=0
          GROUP BY part_num,color_id
        """)
        n = con.execute("SELECT COUNT(*) FROM inventories").fetchone()[0]
        return {"ok": True, "rows": n}
