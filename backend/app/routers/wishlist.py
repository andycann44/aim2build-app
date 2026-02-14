from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, List, Dict, Any
from pathlib import Path
import json

from app.catalog_db import db as catalog_db
from app.user_db import user_db
from app.paths import DATA_DIR
from app.routers.auth import get_current_user, User

router = APIRouter()

def _wishlist_file(user_id: int) -> Path:
    return DATA_DIR / f"wishlist_user_{user_id}.json"

def _load_json(user_id: int):
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

def _list_wishlist(user_id: int) -> List[Dict[str, Any]]:
    with user_db() as con:
        rows = con.execute(
            "SELECT set_num FROM wishlist WHERE user_id = ? ORDER BY id ASC",
            (int(user_id),),
        ).fetchall()
    return [{"set_num": (r["set_num"] if hasattr(r, "keys") else r[0])} for r in rows]

def _import_json_if_present(user_id: int) -> None:
    path = _wishlist_file(user_id)
    if not path.exists():
        return

    data = _load_json(user_id)
    sets = data.get("sets") or []
    normalized: List[str] = []
    for s in sets:
        if isinstance(s, dict):
            raw = s.get("set_num") or s.get("set") or s.get("id")
        else:
            raw = s
        sn = _normalize_set_id(str(raw or "").strip())
        if sn:
            normalized.append(sn)

    if not normalized:
        return

    with user_db() as con:
        inserted = 0
        for sn in normalized:
            cur = con.execute(
                "INSERT OR IGNORE INTO wishlist (user_id, set_num) VALUES (?, ?)",
                (int(user_id), sn),
            )
            if cur.rowcount:
                inserted += 1
        con.commit()

    if inserted:
        print(f"[wishlist] imported {inserted} item(s) for user {user_id} from {path.name}")

@router.get("")
def list_wishlist(current_user: User = Depends(get_current_user)):
    _import_json_if_present(current_user.id)
    return {"sets": _list_wishlist(current_user.id)}

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
    _import_json_if_present(current_user.id)
    with user_db() as con:
        exists = con.execute(
            "SELECT 1 FROM wishlist WHERE user_id = ? AND set_num = ? LIMIT 1",
            (int(current_user.id), sn),
        ).fetchone()
        if exists:
            count = con.execute(
                "SELECT COUNT(*) AS c FROM wishlist WHERE user_id = ?",
                (int(current_user.id),),
            ).fetchone()
            return {"ok": True, "duplicate": True, "count": int(count["c"] if hasattr(count, "keys") else count[0])}

        con.execute(
            "INSERT OR IGNORE INTO wishlist (user_id, set_num) VALUES (?, ?)",
            (int(current_user.id), sn),
        )
        con.commit()
        count = con.execute(
            "SELECT COUNT(*) AS c FROM wishlist WHERE user_id = ?",
            (int(current_user.id),),
        ).fetchone()
    return {"ok": True, "count": int(count["c"] if hasattr(count, "keys") else count[0])}

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
    _import_json_if_present(current_user.id)
    with user_db() as con:
        cur = con.execute(
            "DELETE FROM wishlist WHERE user_id = ? AND set_num = ?",
            (int(current_user.id), sn),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"{sn} not in wishlist")
        con.commit()
        count = con.execute(
            "SELECT COUNT(*) AS c FROM wishlist WHERE user_id = ?",
            (int(current_user.id),),
        ).fetchone()
    return {"ok": True, "removed": sn, "count": int(count["c"] if hasattr(count, "keys") else count[0])}
