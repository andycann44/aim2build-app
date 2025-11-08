from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import os, json, sqlite3

router = APIRouter()
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DB_PATH  = os.path.join(DATA_DIR, "lego_catalog.db")
FILE_PATH = os.path.join(DATA_DIR, "wishlist.json")

def _db():
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="lego_catalog.db missing")
    return sqlite3.connect(DB_PATH)

def _load():
    if not os.path.exists(FILE_PATH): return {"sets":[]}
    with open(FILE_PATH,"r") as f:
        try:
            d = json.load(f) or {"sets":[]}
            if isinstance(d, list): d = {"sets": d}
            if "sets" not in d: d = {"sets":[]}
            return d
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="wishlist.json is invalid")

def _save(obj):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(FILE_PATH,"w") as f: json.dump(obj, f)

def _resolve_set_num(raw: str) -> str:
    sn = raw.strip()
    con = _db(); cur = con.cursor()
    cur.execute("SELECT set_num FROM sets WHERE set_num=? LIMIT 1", (sn,))
    row = cur.fetchone()
    if not row:
        cur.execute("SELECT set_num FROM sets WHERE set_num LIKE ? ORDER BY year DESC LIMIT 1", (sn+'-%',))
        row = cur.fetchone()
    con.close()
    if not row: raise HTTPException(status_code=404, detail=f"Set {raw} not found in catalog")
    return row[0]

@router.get("")
def list_wishlist():
    return _load()

@router.post("/add")
def add_wishlist(set: Optional[str]=Query(None), set_num: Optional[str]=Query(None), id: Optional[str]=Query(None)):
    raw = set_num or set or id
    if not raw: raise HTTPException(status_code=422, detail="Provide set, set_num, or id")
    sn = _resolve_set_num(raw)
    data = _load()
    if any(s == sn or (isinstance(s,dict) and s.get("set_num")==sn) for s in data["sets"]):
        return {"ok": True, "duplicate": True, "count": len(data["sets"])}
    data["sets"].append({"set_num": sn})
    _save(data)
    return {"ok": True, "count": len(data["sets"])}

@router.delete("/remove")
def remove_wishlist(set: Optional[str]=Query(None), set_num: Optional[str]=Query(None), id: Optional[str]=Query(None)):
    raw = set_num or set or id
    if not raw: raise HTTPException(status_code=422, detail="Provide set, set_num, or id")
    sn = _resolve_set_num(raw)
    data = _load()
    before = len(data["sets"])
    data["sets"] = [s for s in data["sets"] if (s != sn and (not isinstance(s,dict) or s.get("set_num") != sn))]
    if len(data["sets"]) == before:
        raise HTTPException(status_code=404, detail=f"{sn} not in wishlist")
    _save(data)
    return {"ok": True, "removed": sn, "count": len(data["sets"])}
