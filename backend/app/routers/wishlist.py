from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
from pathlib import Path
import json

from app.catalog_db import db as catalog_db
from app.paths import DATA_DIR
from app.routers.auth import get_current_user, User

router = APIRouter()

def _wishlist_file(user_id: int) -> Path:
    return DATA_DIR / f"wishlist_user_{user_id}.json"

def _load(user_id: int):
    path = _wishlist_file(user_id)
    if not path.exists(): return {"sets":[]}
    with path.open("r", encoding="utf-8") as f:
        try:
            d = json.load(f) or {"sets":[]}
            if isinstance(d, list): d = {"sets": d}
            if "sets" not in d: d = {"sets":[]}
            return d
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="wishlist.json is invalid")

def _save(user_id: int, obj):
    path = _wishlist_file(user_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(obj, f)

def _normalize_set_id(raw: str) -> str:
    sn = (raw or "").strip()
    if not sn:
        return ""
    if "-" not in sn and sn.isdigit():
        return f"{sn}-1"
    return sn

def _resolve_set_num(raw: str) -> str:
    trimmed = (raw or "").strip()
    sn = _normalize_set_id(trimmed)
    with catalog_db() as con:
        cur = con.cursor()
        cur.execute("SELECT set_num FROM sets WHERE set_num=? LIMIT 1", (sn,))
        row = cur.fetchone()
        if not row:
            base = trimmed.split("-")[0] if "-" in trimmed else trimmed
            cur.execute("SELECT set_num FROM sets WHERE set_num LIKE ? ORDER BY year DESC LIMIT 1", (base+'-%',))
            row = cur.fetchone()
    if not row: raise HTTPException(status_code=404, detail=f"Set {raw} not found in catalog")
    return row[0]

@router.get("")
def list_wishlist(current_user: User = Depends(get_current_user)):
    return _load(current_user.id)

@router.post("/add")
def add_wishlist(
    set: Optional[str]=Query(None),
    set_num: Optional[str]=Query(None),
    id: Optional[str]=Query(None),
    current_user: User = Depends(get_current_user),
):
    raw = set_num or set or id
    if not raw: raise HTTPException(status_code=422, detail="Provide set, set_num, or id")
    sn = _resolve_set_num(raw)
    data = _load(current_user.id)
    if any(s == sn or (isinstance(s,dict) and s.get("set_num")==sn) for s in data["sets"]):
        return {"ok": True, "duplicate": True, "count": len(data["sets"])}
    data["sets"].append({"set_num": sn})
    _save(current_user.id, data)
    return {"ok": True, "count": len(data["sets"])}

@router.delete("/remove")
def remove_wishlist(
    set: Optional[str]=Query(None),
    set_num: Optional[str]=Query(None),
    id: Optional[str]=Query(None),
    current_user: User = Depends(get_current_user),
):
    raw = set_num or set or id
    if not raw: raise HTTPException(status_code=422, detail="Provide set, set_num, or id")
    sn = _resolve_set_num(raw)
    data = _load(current_user.id)
    before = len(data["sets"])
    data["sets"] = [s for s in data["sets"] if (s != sn and (not isinstance(s,dict) or s.get("set_num") != sn))]
    if len(data["sets"]) == before:
        raise HTTPException(status_code=404, detail=f"{sn} not in wishlist")
    _save(current_user.id, data)
    return {"ok": True, "removed": sn, "count": len(data["sets"])}
