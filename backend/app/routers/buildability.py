from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Tuple
import sqlite3, os, json

router = APIRouter()
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "lego_catalog.db")
INV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "inventory_parts.json")

def _db():
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="lego_catalog.db missing")
    return sqlite3.connect(DB_PATH)

def _normalize_set_num(con, raw: str) -> str:
    if "-" in raw:
        return raw
    cur = con.cursor()
    cand = f"{raw}-1"
    cur.execute("SELECT 1 FROM sets WHERE set_num=? LIMIT 1", (cand,))
    return cand if cur.fetchone() else raw

def _load_inventory() -> Dict[Tuple[str,int], int]:
    """
    Returns { (part_num, color_id) : qty_total }
    """
    if not os.path.exists(INV_PATH):
        return {}
    with open(INV_PATH, "r") as f:
        try:
            rows = json.load(f) or []
        except Exception:
            raise HTTPException(status_code=500, detail="inventory_parts.json is invalid JSON")
    inv: Dict[Tuple[str,int], int] = {}
    for r in rows:
        try:
            key = (str(r["part_num"]), int(r["color_id"]))
            inv[key] = inv.get(key, 0) + int(r.get("qty_total", 0))
        except Exception:
            continue
    return inv

@router.get("/compare")
def compare(
    set: Optional[str] = Query(None),
    set_num: Optional[str] = Query(None),
    id: Optional[str] = Query(None),
):
    raw = set_num or set or id
    if not raw:
        raise HTTPException(status_code=422, detail="Provide set, set_num, or id")

    con = _db()
    try:
        target = _normalize_set_num(con, raw)
        cur = con.cursor()

        # Confirm set exists
        cur.execute("SELECT 1 FROM sets WHERE set_num=? LIMIT 1", (target,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail=f"Set {target} not found")

        # Required parts for this set
        cur.execute("""
            SELECT part_num, color_id, quantity
            FROM inventory_parts
            WHERE set_num=?
            ORDER BY part_num, color_id
        """, (target,))
        req_rows = cur.fetchall()
    finally:
        con.close()

    inv = _load_inventory()
    total_needed = 0
    total_have = 0
    missing_parts = []

    for part_num, color_id, qty_req in req_rows:
        total_needed += int(qty_req)
        have = int(inv.get((str(part_num), int(color_id)), 0))
        used = min(have, int(qty_req))
        total_have += used
        short = int(qty_req) - used
        if short > 0:
            missing_parts.append({
                "part_num": str(part_num),
                "color_id": int(color_id),
                "need": int(qty_req),
                "have": have,
                "short": short
            })

    coverage = (float(total_have) / float(total_needed)) if total_needed else 1.0

    return {
        "set_num": target,
        "coverage": coverage,
        "total_needed": total_needed,
        "total_have": total_have,
        "missing_parts": missing_parts
    }
