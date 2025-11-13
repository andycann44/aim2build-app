from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import sqlite3, os

router = APIRouter()
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "lego_catalog.db")

def _db():
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="lego_catalog.db missing")
    return sqlite3.connect(DB_PATH)

@router.get("/parts")
def parts(set: Optional[str] = Query(None), set_num: Optional[str] = Query(None), id: Optional[str] = Query(None)):
    raw = set_num or set or id
    if not raw: raise HTTPException(status_code=422, detail="Provide set, set_num, or id")
    con = _db(); cur = con.cursor()
    cur.execute("SELECT 1 FROM sets WHERE set_num=? LIMIT 1", (raw,))
    if not cur.fetchone():
        con.close(); raise HTTPException(status_code=404, detail=f"Set {raw} not found")
    cur.execute(
        """
      SELECT part_num, color_id, quantity, part_img_url
      FROM inventory_parts_summary
      WHERE set_num=?
      ORDER BY part_num, color_id
    """,
        (raw,),
    )
    rows = [
        {
            "part_num": str(p),
            "color_id": int(c),
            "quantity": int(q),
            "part_img_url": img,
        }
        for (p, c, q, img) in cur.fetchall()
    ]
    con.close()
    return {"set_num": raw, "parts": rows}
