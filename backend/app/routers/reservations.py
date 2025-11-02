from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pathlib import Path
from typing import Dict, Any, List, Tuple
import json

from app.services.rebrickable import fetch_set_parts

router = APIRouter()

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
RES_FILE = DATA_DIR / "reservations.json"

def _load_reservations() -> List[Dict[str, Any]]:
    if not RES_FILE.exists():
        return []
    try:
        return json.loads(RES_FILE.read_text() or "[]")
    except Exception:
        return []

def _save_reservations(items: List[Dict[str, Any]]) -> None:
    RES_FILE.write_text(json.dumps(items, indent=2))

def _to_bins(items: List[Dict[str, Any]]) -> Dict[Tuple[str,int], int]:
    bins: Dict[Tuple[str,int], int] = {}
    for r in items:
        pn = str(r.get("part_num") or "")
        cid = int(r.get("color_id") or 0)
        qty = int(r.get("qty") or 0)
        if not pn or qty <= 0: 
            continue
        bins[(pn, cid)] = bins.get((pn, cid), 0) + qty
    return bins

def _from_bins(bins: Dict[Tuple[str,int], int]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for (pn,cid), qty in bins.items():
        if qty > 0:
            out.append({"part_num": pn, "color_id": cid, "qty": int(qty)})
    return out

def _bom_bins_for_set(set_num: str) -> Dict[Tuple[str,int], int]:
    payload = fetch_set_parts(set_num)
    res = payload.get("results") or []
    bins: Dict[Tuple[str,int], int] = {}
    for it in res:
        qty = int(it.get("quantity") or 0)
        part = it.get("part") or {}
        color = it.get("color") or {}
        pn = str(part.get("part_num") or "")
        cid = int(color.get("id") or 0)
        if not pn or qty <= 0: 
            continue
        bins[(pn,cid)] = bins.get((pn,cid), 0) + qty
    return bins

@router.post("/clear")
def clear_reservations() -> Dict[str, Any]:
    _save_reservations([])
    return {"ok": True, "cleared": True}

@router.post("/plan_build")
def reserve_for_build(set_num: str) -> Dict[str, Any]:
    set_num = (set_num or "").strip()
    if not set_num:
        raise HTTPException(status_code=422, detail="set_num required")
    cur_bins = _to_bins(_load_reservations())
    need_bins = _bom_bins_for_set(set_num)
    # add needed parts to reservations
    for k, add in need_bins.items():
        cur_bins[k] = cur_bins.get(k, 0) + int(add)
    items = _from_bins(cur_bins)
    _save_reservations(items)
    return {"ok": True, "reserved_parts": sum(need_bins.values()), "reservations_count": len(items)}

@router.delete("/plan_build")
def release_reservation(set_num: str) -> Dict[str, Any]:
    set_num = (set_num or "").strip()
    if not set_num:
        raise HTTPException(status_code=422, detail="set_num required")
    cur_bins = _to_bins(_load_reservations())
    need_bins = _bom_bins_for_set(set_num)
    # subtract; clamp to zero
    for k, sub in need_bins.items():
        cur_bins[k] = max(0, cur_bins.get(k, 0) - int(sub))
        if cur_bins[k] == 0:
            cur_bins.pop(k, None)
    items = _from_bins(cur_bins)
    _save_reservations(items)
    return {"ok": True, "released": True, "reservations_count": len(items)}
