from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pathlib import Path
from typing import Dict, Any, List, Tuple
import json
from app.services.rebrickable import fetch_set_parts

router = APIRouter()

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
AGG_FILE = DATA_DIR / "inventory_parts.json"
RES_FILE = DATA_DIR / "reservations.json"

def _to_bins(rows: List[Dict[str, Any]]) -> Dict[Tuple[str,int], int]:
    bins: Dict[Tuple[str,int], int] = {}
    for r in rows:
        pn = str(r.get("part_num") or "")
        cid = int(r.get("color_id") or 0)
        qty = int(r.get("qty") or 0)
        if not pn or qty <= 0: 
            continue
        bins[(pn, cid)] = bins.get((pn, cid), 0) + qty
    return bins

def _load_have_bins() -> Dict[Tuple[str,int], int]:
    if not AGG_FILE.exists():
        return {}
    try:
        rows = json.loads(AGG_FILE.read_text() or "[]")
    except Exception:
        rows = []
    return _to_bins(rows)

def _load_reserved_bins() -> Dict[Tuple[str,int], int]:
    if not RES_FILE.exists():
        return {}
    try:
        rows = json.loads(RES_FILE.read_text() or "[]")
    except Exception:
        rows = []
    return _to_bins(rows)

def _free_bins() -> Dict[Tuple[str,int], int]:
    have = _load_have_bins()
    res = _load_reserved_bins()
    # free = have - reserved (clamp at 0)
    for k, rq in res.items():
        if k in have:
            have[k] = max(0, have[k] - rq)
    # drop zeros
    have = {k:v for k,v in have.items() if v > 0}
    return have

def _need_for_set(set_num: str) -> List[Dict[str,Any]]:
    payload = fetch_set_parts(set_num)
    res = payload.get("results")
    return res if isinstance(res, list) else []

@router.get("/check")
def check_buildability(set_num: str) -> Dict[str,Any]:
    set_num = (set_num or "").strip()
    if not set_num:
        raise HTTPException(status_code=422, detail="set_num required")

    have = _free_bins()   # <-- free bricks (have - reserved)
    need = _need_for_set(set_num)

    total_needed = 0
    total_have = 0
    missing_list: List[Dict[str,Any]] = []

    for it in need:
        qty = int(it.get("quantity") or 0)
        part = (it.get("part") or {})
        color = (it.get("color") or {})
        pn = str(part.get("part_num") or "")
        cid = int(color.get("id") or 0)
        if not pn: 
            continue
        have_qty = int(have.get((pn, cid), 0))
        use_qty = min(have_qty, qty)
        total_needed += qty
        total_have += use_qty
        if use_qty < qty:
            missing_list.append({
                "part_num": pn,
                "part_name": str(part.get("name") or ""),
                "color_id": cid,
                "color_name": str(color.get("name") or ""),
                "needed": qty,
                "have": have_qty,
                "short": max(0, qty - have_qty),
                "img_url": str(part.get("part_img_url") or "")
            })

    coverage = 0.0 if total_needed == 0 else (100.0 * float(total_have) / float(total_needed))
    missing_list.sort(key=lambda r: (-int(r["short"]), r["part_num"], int(r["color_id"])))
    return {
        "ok": True,
        "set_num": set_num,
        "total_needed": int(total_needed),
        "total_have": int(total_have),
        "coverage_pct": float(round(coverage, 2)),
        "missing_count": int(len(missing_list)),
        "missing": missing_list[:200],
    }
