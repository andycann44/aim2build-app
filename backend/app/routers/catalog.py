import os, sqlite3
from fastapi import APIRouter
router = APIRouter()
DB = os.getenv("A2B_DB","data/aim2build.db")
def db(): 
    con = sqlite3.connect(DB); con.row_factory = sqlite3.Row; return con

@router.get("/catalog/sets")
def catalog_sets():
    with db() as con:
        rows = con.execute("""
          SELECT s.set_num, COUNT(*) AS parts_rows, SUM(qty) AS total_qty
          FROM set_bom s WHERE COALESCE(is_spare,0)=0
          GROUP BY s.set_num ORDER BY s.set_num
        """).fetchall()
        return {"results":[dict(r) for r in rows]}

@router.get("/catalog/parts")
def catalog_parts():
    with db() as con:
        rows = con.execute("""
          SELECT part_num, color_id, SUM(qty) AS total_qty, COUNT(DISTINCT set_num) AS in_sets
          FROM set_bom WHERE COALESCE(is_spare,0)=0
          GROUP BY part_num, color_id
          ORDER BY part_num, color_id
        """).fetchall()
        return {"results":[dict(r) for r in rows]}
