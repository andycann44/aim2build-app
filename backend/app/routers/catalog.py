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
      SELECT ips.part_num,
             ips.color_id,
             ips.quantity,
             p.part_img_url,
             p.part_thumb_url
      FROM inventory_parts_summary AS ips
      LEFT JOIN parts AS p
        ON p.part_num = ips.part_num
      WHERE ips.set_num=?
      ORDER BY ips.part_num, ips.color_id
    """,
        (raw,),
    )
    rows = []
    for part_num, color_id, quantity, part_img_url, part_thumb_url in cur.fetchall():
        img_url = part_thumb_url or part_img_url or None
        rows.append(
            {
                "part_num": str(part_num),
                "color_id": int(color_id),
                "quantity": int(quantity),
                "img_url": img_url,
                "part_img_url": part_img_url,
            }
        )
    con.close()
    return {"set_num": raw, "parts": rows}
