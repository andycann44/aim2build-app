from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Tuple, Optional
from collections import defaultdict
import os, json

router = APIRouter()

# ---- paths & files
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
INV_SETS_PATH = os.path.join(DATA_DIR, "inventory.json")
INV_PARTS_PATH = os.path.join(DATA_DIR, "inventory_parts.json")
PARTS_CACHE_DIR = os.path.join(DATA_DIR, "parts_cache")

# lazy import so file loads without the service in tests
def _ensure_cached_parts(set_num: str) -> List[dict]:
    try:
        from app.services.rebrickable import ensure_cached_parts
        return ensure_cached_parts(set_num)
    except Exception as e:
        # non-fatal; aggregation will just not include it yet
        print(f"[inventory] ensure_cached_parts failed for {set_num}: {e}")
        return []

# ---- models
class TogglePayload(BaseModel):
    set_num: Optional[str] = None
    set: Optional[str] = None
    id: Optional[str] = None
    name: Optional[str] = None
    year: Optional[int] = None
    img_url: Optional[str] = None
    num_parts: Optional[int] = None
    on: bool

# ---- small io helpers
def _read_json(path: str, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default

def _write_json(path: str, obj) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)

def _canon_set_id(v: str) -> str:
    s = str(v).strip()
    return s if "-" in s else f"{s}-1"

# ---- inventory sets (which sets are toggled on)
@router.get("")
@router.get("/")
def list_inventory_sets():
    raw = _read_json(INV_SETS_PATH, {"sets": []})
    return raw.get("sets", []) if isinstance(raw, dict) else raw

@router.post("/toggle")
def toggle_inventory(payload: TogglePayload):
    sid = payload.set_num or payload.set or payload.id
    if not sid:
        raise HTTPException(422, "set_num required")
    sid = _canon_set_id(sid)

    store = _read_json(INV_SETS_PATH, {"sets": []})
    rows = store.get("sets", []) if isinstance(store, dict) else (store if isinstance(store, list) else [])

    if payload.on:
        if not any(r.get("set_num") == sid for r in rows):
            rows.append({
                "set_num": sid,
                "name": payload.name or "",
                "year": payload.year or 0,
                "img_url": payload.img_url or "",
                "num_parts": payload.num_parts,
                "qty": 1
            })
        # fetch/cache parts for this set (non-fatal if it fails)
        _ensure_cached_parts(sid)
    else:
        rows = [r for r in rows if r.get("set_num") != sid]

    _write_json(INV_SETS_PATH, {"sets": rows})

    # always rebuild aggregated parts on toggle so UI shows qty immediately
    _rebuild_inventory_parts()
    return {"ok": True, "count": len(rows)}

# ---- aggregation (build inventory_parts.json with qty_total)
def _load_set_parts_from_cache(set_num: str) -> List[dict]:
    dash = set_num if "-" in set_num else f"{set_num}-1"
    plain = dash.split("-")[0]
    for name in (f"{dash}.json", f"{plain}.json"):
        p = os.path.join(PARTS_CACHE_DIR, name)
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
    return []

def _aggregate_inventory_parts() -> List[dict]:
    inv = _read_json(INV_SETS_PATH, {"sets": []})
    sets = inv.get("sets", []) if isinstance(inv, dict) else inv

    counts: Dict[Tuple[str, int], int] = defaultdict(int)
    img_map: Dict[Tuple[str, int], str] = {}

    for s in sets:
        sid = str(s.get("set_num") or "").strip()
        if not sid:
            continue
        qty = int(s.get("qty") or 1)
        parts = _load_set_parts_from_cache(sid)
        # expected each: {"part_num","color_id","quantity", "part_img_url"?}
        for r in parts:
            pn = r.get("part_num")
            cid = r.get("color_id")
            need = r.get("quantity") or r.get("qty") or 0
            if not pn or cid is None:
                continue
            key = (pn, int(cid))
            counts[key] += int(need) * qty
            img = r.get("part_img_url") or r.get("img_url") or ""
            if img and key not in img_map:
                img_map[key] = img

    rows = [{
        "part_num": pn,
        "color_id": cid,
        "qty_total": total,
        **({"img_url": img_map[(pn, cid)]} if (pn, cid) in img_map else {})
    } for (pn, cid), total in counts.items()]

    rows.sort(key=lambda x: (-x["qty_total"], x["part_num"], x["color_id"]))
    return rows

def _rebuild_inventory_parts() -> int:
    rows = _aggregate_inventory_parts()
    _write_json(INV_PARTS_PATH, rows)
    return len(rows)

@router.post("/rebuild")
def rebuild_inventory():
    n = _rebuild_inventory_parts()
    return {"ok": True, "rows": n}

# ---- query parts for UI
@router.get("/parts")
def list_parts(min_qty: int = Query(1), q: str = Query("")):
    rows = _read_json(INV_PARTS_PATH, [])
    if not isinstance(rows, list):
        rows = []
    ql = q.strip().lower()
    out = []
    for r in rows:
        if r.get("qty_total", 0) < int(min_qty):
            continue
        if ql:
            if ql not in str(r.get("part_num", "")).lower():
                continue
        out.append(r)
    return out
