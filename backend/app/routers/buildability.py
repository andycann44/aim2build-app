import sqlite3, os
from typing import List, Tuple, Dict
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()
DB = os.getenv("A2B_DB", "data/aim2build.db")

def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con

def load_inventory(con) -> Dict[Tuple[str,int], int]:
    con.execute("""
    CREATE TABLE IF NOT EXISTS inventory (
      part_num TEXT NOT NULL,
      color_id INTEGER NOT NULL,
      qty_total INTEGER NOT NULL DEFAULT 0,
      qty_loose INTEGER NOT NULL DEFAULT 0,
      qty_in_sets INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      PRIMARY KEY (part_num, color_id)
    )""")
    rows = con.execute("SELECT part_num,color_id,qty_total FROM inventory").fetchall()
    return {(r["part_num"], int(r["color_id"])): int(r["qty_total"]) for r in rows}

def load_bom(con, set_num: str):
    rows = con.execute("""
        SELECT part_num,color_id,qty
        FROM set_bom
        WHERE set_num=? AND COALESCE(is_spare,0)=0
    """, (set_num,)).fetchall()
    if not rows:
        raise HTTPException(404, f"BOM not cached for {set_num}")
    return [(r["part_num"], int(r["color_id"]), int(r["qty"])) for r in rows]

def coverage(inv, bom_rows):
    total_req = 0; total_have = 0; missing = []
    for p,c,req in bom_rows:
        have = inv.get((p,c), 0)
        total_req += req
        total_have += min(have, req)
        if have < req:
            missing.append({"part_num": p, "color_id": c, "need": req-have})
    pct = 0.0 if total_req == 0 else round(100.0 * total_have / total_req, 2)
    return pct, missing

@router.get("/buildability/sets")
def buildability_sets(targets: List[str] = Query(..., alias="targets")):
    with db() as con:
        inv = load_inventory(con)
        out = []
        for set_num in targets:
            bom = load_bom(con, set_num)
            pct, missing = coverage(inv, bom)
            out.append({"set_num": set_num, "coverage_pct": pct, "buildable": pct==100.0, "missing": missing})
        out.sort(key=lambda x: (not x["buildable"], -x["coverage_pct"]))
        return {"results": out}
