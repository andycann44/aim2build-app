from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
import os, json, sqlite3

router = APIRouter()
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DB_PATH  = os.path.join(DATA_DIR, "lego_catalog.db")
FILE_PATH = os.path.join(DATA_DIR, "my_sets.json")

class SetEntry(BaseModel):
    set_num: str
    name: Optional[str] = None
    year: Optional[int] = None
    img_url: Optional[str] = None
    num_parts: Optional[int] = None

def _db():
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="lego_catalog.db missing")
    return sqlite3.connect(DB_PATH)

def _load():
    if not os.path.exists(FILE_PATH): return {"sets":[]}
    with open(FILE_PATH,"r") as f:
        try:
            d = json.load(f) or {"sets":[]}
            if isinstance(d, list): d = {"sets": d}  # tolerate old shape
            if "sets" not in d: d = {"sets":[]}
            return d
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="my_sets.json is invalid")

def _save(obj):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(FILE_PATH,"w") as f: json.dump(obj, f)

def _resolve_set_num(raw: str) -> str:
    sn = raw.strip()
    con = _db(); cur = con.cursor()
    # try exact first
    cur.execute("SELECT set_num,name,year,num_parts FROM sets WHERE set_num=? LIMIT 1", (sn,))
    row = cur.fetchone()
    if not row:
        # accept plain id like '21330' → pick latest '-1' if present
        cur.execute("SELECT set_num,name,year,num_parts FROM sets WHERE set_num LIKE ? ORDER BY year DESC LIMIT 1", (sn+'-%',))
        row = cur.fetchone()
    con.close()
    if not row: raise HTTPException(status_code=404, detail=f"Set {raw} not found in catalog")
    return row[0]

def _catalog_row(sn: str):
    con = _db(); cur = con.cursor()
    cur.execute("SELECT set_num,name,year,num_parts FROM sets WHERE set_num=? LIMIT 1", (sn,))
    row = cur.fetchone()
    con.close()
    if not row: return None
    # try to guess an image URL (Rebrickable pattern)
    img = f"https://cdn.rebrickable.com/media/sets/{row[0]}.jpg"
    return {"set_num": row[0], "name": row[1], "year": row[2], "num_parts": row[3], "img_url": img}

@router.get("")
def list_my_sets():
    return _load()

@router.post("/add")
def add_my_set(set: Optional[str]=Query(None), set_num: Optional[str]=Query(None), id: Optional[str]=Query(None)):
    raw = set_num or set or id
    if not raw: raise HTTPException(status_code=422, detail="Provide set, set_num, or id")
    sn = _resolve_set_num(raw)
    info = _catalog_row(sn)
    data = _load()
    if any(s.get("set_num")==sn for s in data["sets"]):
        return {"ok": True, "duplicate": True, "count": len(data["sets"])}
    data["sets"].append(info or {"set_num": sn})
    _save(data)
    return {"ok": True, "count": len(data["sets"])}

@router.delete("/remove")
def remove_my_set(set: Optional[str]=Query(None), set_num: Optional[str]=Query(None), id: Optional[str]=Query(None)):
    raw = set_num or set or id
    if not raw: raise HTTPException(status_code=422, detail="Provide set, set_num, or id")
    sn = _resolve_set_num(raw)
    data = _load()
    before = len(data["sets"])
    data["sets"] = [s for s in data["sets"] if s.get("set_num") != sn]
    if len(data["sets"]) == before:
        raise HTTPException(status_code=404, detail=f"{sn} not in My Sets")
    _save(data)
    return {"ok": True, "removed": sn, "count": len(data["sets"])}
