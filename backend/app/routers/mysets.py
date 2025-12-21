from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import List, Optional
from pathlib import Path
import json

from app.catalog_db import db as catalog_db
from app.paths import DATA_DIR
from app.routers.auth import get_current_user, User

router = APIRouter()

def _normalize_set_id(raw: str) -> str:
    sn = (raw or "").strip()
    if not sn:
        return ""
    if "-" not in sn:
        return f"{sn}-1"
    return sn

def _mysets_file(user_id: int) -> Path:
    return DATA_DIR / f"my_sets_user_{user_id}.json"

class SetEntry(BaseModel):
    set_num: str
    name: Optional[str] = None
    year: Optional[int] = None
    img_url: Optional[str] = None
    num_parts: Optional[int] = None

def _load(user_id: int):
    path = _mysets_file(user_id)
    if not path.exists(): return {"sets":[]}
    with path.open("r", encoding="utf-8") as f:
        try:
            d = json.load(f) or {"sets":[]}
            if isinstance(d, list): d = {"sets": d}  # tolerate old shape
            if "sets" not in d: d = {"sets":[]}
            return d
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="my_sets.json is invalid")

def _save(user_id: int, obj):
    path = _mysets_file(user_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(obj, f)

def _resolve_set_num(raw: str) -> str:
    sn = (raw or "").strip()
    if not sn:
        return ""

    candidates = [sn]
    normalized = _normalize_set_id(sn)
    if normalized not in candidates:
        candidates.append(normalized)

    try:
        with catalog_db() as con:
            cur = con.cursor()
            for cand in candidates:
                cur.execute("SELECT set_num FROM sets WHERE set_num=? LIMIT 1", (cand,))
                row = cur.fetchone()
                if row:
                    try:
                        return row["set_num"]
                    except Exception:
                        return row[0]

            # Fallback: best match by prefix for plain ids
            if "-" not in sn:
                cur.execute(
                    "SELECT set_num FROM sets WHERE set_num LIKE ? ORDER BY year DESC LIMIT 1",
                    (sn + "-%",),
                )
                row = cur.fetchone()
                if row:
                    try:
                        return row["set_num"]
                    except Exception:
                        return row[0]
    except Exception:
        return ""

    return ""

def _catalog_row(sn: str):
    with catalog_db() as con:
        cur = con.cursor()
        cur.execute("SELECT set_num,name,year,num_parts FROM sets WHERE set_num=? LIMIT 1", (sn,))
        row = cur.fetchone()
    if not row: return None
    # try to guess an image URL (Rebrickable pattern)
    img = f"https://cdn.rebrickable.com/media/sets/{row[0]}.jpg"
    return {"set_num": row[0], "name": row[1], "year": row[2], "num_parts": row[3], "img_url": img}

@router.get("")
def list_my_sets(current_user: User = Depends(get_current_user)):
    return _load(current_user.id)

@router.post("/add")
def add_my_set(
    set: Optional[str]=Query(None),
    set_num: Optional[str]=Query(None),
    id: Optional[str]=Query(None),
    current_user: User = Depends(get_current_user),
):
    raw = set_num or set or id
    if not raw: raise HTTPException(status_code=422, detail="Provide set, set_num, or id")
    sn = _resolve_set_num(raw)
    if not sn:
        raise HTTPException(status_code=404, detail="Unknown set_num")
    info = _catalog_row(sn)
    data = _load(current_user.id)
    if any(s.get("set_num")==sn for s in data["sets"]):
        return {"ok": True, "duplicate": True, "count": len(data["sets"])}
    data["sets"].append(info or {"set_num": sn})
    _save(current_user.id, data)
    return {"ok": True, "count": len(data["sets"])}

@router.delete("/remove")
def remove_my_set(
    set: Optional[str]=Query(None),
    set_num: Optional[str]=Query(None),
    id: Optional[str]=Query(None),
    current_user: User = Depends(get_current_user),
):
    raw = set_num or set or id
    if not raw: raise HTTPException(status_code=422, detail="Provide set, set_num, or id")
    sn = _resolve_set_num(raw)
    if not sn:
        raise HTTPException(status_code=404, detail="Unknown set_num")
    data = _load(current_user.id)
    before = len(data["sets"])
    data["sets"] = [s for s in data["sets"] if s.get("set_num") != sn]
    if len(data["sets"]) == before:
        raise HTTPException(status_code=404, detail=f"{sn} not in My Sets")
    _save(current_user.id, data)
    return {"ok": True, "removed": sn, "count": len(data["sets"])}
