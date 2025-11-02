from fastapi import APIRouter, HTTPException, Query
from pathlib import Path
import json
from typing import List, Dict, Any, Tuple
import logging
logger = logging.getLogger("aim2build.inventory")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

router = APIRouter()

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
INV_FILE = DATA_DIR / "inventory.json"

def _load() -> List[Dict[str, Any]]:
    if not INV_FILE.exists():
        return []
    try:
        data = json.loads(INV_FILE.read_text() or "[]")
        return data if isinstance(data, list) else []
    except Exception:
        return []

def _save(rows: List[Dict[str, Any]]) -> None:
    rows = rows or []
    rows.sort(key=lambda r: (r.get("name") or "", r.get("set_num") or ""))
    tmp = INV_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(rows, indent=2))
    tmp.replace(INV_FILE)

@router.get("", response_model=list)
def list_inventory():
    return _load()

@router.post("/toggle")
def toggle_inventory(payload: Dict[str, Any]):
    """
    Body:
      { set_num: str, on: bool, name?: str, year?: int, img_url?: str, set_img_url?: str, num_parts?: int }
    If on==true -> ensure present with qty=1 (do not duplicate).
    If on==false -> remove if present.
    """
    set_num = str(payload.get("set_num") or "").strip()
    if not set_num:
        raise HTTPException(status_code=422, detail="set_num required")
    on = bool(payload.get("on"))

    rows = _load()
    idx = next((i for i, r in enumerate(rows) if r.get("set_num") == set_num), None)

    if on:
        if idx is None:
            # normalize image field
            img_url = payload.get("img_url") or payload.get("set_img_url") or ""
            row = {
                "set_num": set_num,
                "name": payload.get("name") or "",
                "year": int(payload["year"]) if str(payload.get("year") or "").isdigit() else None,
                "img_url": img_url,
                "num_parts": int(payload["num_parts"]) if str(payload.get("num_parts") or "").isdigit() else None,
                "qty": 1,
            }
            rows.append(row)
            _save(rows)
            return {"ok": True, "added": True}
        else:
            # already present; keep qty as-is (default 1)
            return {"ok": True, "added": False}
    else:
        if idx is not None:
            rows.pop(idx)
            _save(rows)
            return {"ok": True, "removed": True}
        return {"ok": True, "removed": False}

from typing import Tuple
from app.services.rebrickable import fetch_set_parts
AGG_FILE = DATA_DIR / "inventory_parts.json"

def _aggregate() -> list:
    # Build aggregate of {part_num,color_id} across all inventory sets
    inv = _load()
    # rows in inv have at least set_num
    buckets = {}  # (part_num,color_id) -> dict
    for row in inv:
        set_num = row.get("set_num")
        if not set_num:
            continue
        try:
            payload = fetch_set_parts(set_num)
            parts = payload.get("results", [])
            logger.info(f"[rebuild] {set_num}: fetched {len(parts)} parts")
        except Exception as e:
            logger.exception(f"[rebuild] {set_num}: fetch failed: {e}")
            parts = []
        for it in parts:
            part = (it.get("part") or {})
            color = (it.get("color") or {})
            qty = int(it.get("quantity") or 0)
            if qty <= 0: 
                continue
            key = (part.get("part_num") or "", int(color.get("id") or 0))
            if key not in buckets:
                buckets[key] = {
                    "part_num": part.get("part_num") or "",
                    "part_name": part.get("name") or "",
                    "color_id": int(color.get("id") or 0),
                    "color_name": color.get("name") or "",
                    "img_url": part.get("part_img_url") or "",
                    "qty": 0,
                }
            buckets[key]["qty"] += qty
    out = list(buckets.values())
    out.sort(key=lambda r: (-int(r["qty"]), r["part_num"], r["color_id"]))
    return out

def _agg_load() -> list:
    if AGG_FILE.exists():
        try:
            data = json.loads(AGG_FILE.read_text() or "[]")
            return data if isinstance(data, list) else []
        except Exception:
            return []
    return []

def _agg_save(rows: list):
    tmp = AGG_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(rows or [], indent=2))
    tmp.replace(AGG_FILE)

@router.post("/rebuild")
def parts_rebuild():
    rows = _aggregate()
    logger.info(f"[rebuild] aggregated unique part-color rows: {len(rows)}")
    _agg_save(rows)
    return {"ok": True, "count": len(rows)}

@router.get("/parts", response_model=list)
def parts_aggregate(min_qty: int = 1, q: str = ""):
    rows = _agg_load()
    # optional quick filter
    if min_qty > 1:
        rows = [r for r in rows if int(r.get("qty") or 0) >= min_qty]
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in (r.get("part_name","").lower()) or ql in (r.get("part_num","").lower())]
    return rows

@router.post("/clear")
def parts_clear():
    try:
        AGG_FILE.unlink(missing_ok=True)
    except Exception:
        pass
    return {"ok": True}


# A2B: inventory summary

RES_FILE = DATA_DIR / "reservations.json"

def _to_bins(rows:List[Dict[str,Any]]) -> Dict[Tuple[str,int], int]:
    bins={}
    for r in rows or []:
        pn=str(r.get("part_num") or "")
        cid=int(r.get("color_id") or 0)
        qty=int(r.get("qty") or 0)
        if pn and qty>0:
            bins[(pn,cid)] = bins.get((pn,cid),0)+qty
    return bins

def _load_json(f:Path):
    if not f.exists(): return []
    try: return json.loads(f.read_text() or "[]")
    except Exception: return []

def _free_bins():
    have=_to_bins(_load_json(AGG_FILE))
    res=_to_bins(_load_json(RES_FILE))
    for k,v in res.items():
        if k in have:
            have[k]=max(0, have[k]-v)
    return {k:v for k,v in have.items() if v>0}

@router.get("/summary", tags=["inventory"])
def inventory_summary():
    have=_to_bins(_load_json(AGG_FILE))
    res=_to_bins(_load_json(RES_FILE))
    free=_free_bins()
    have_total=sum(have.values())
    res_total=sum(res.values())
    free_total=sum(free.values())
    return {
        "ok": True,
        "totals": {
            "have_total": int(have_total),
            "reserved_total": int(res_total),
            "free_total": int(free_total),
            "distinct_parts_free": int(len(free)),
        }
    }

@router.get("/free")
def inventory_free(limit: int = Query(500, ge=1, le=5000), offset: int = 0):
    free=_free_bins()
    rows=[{"part_num":pn, "color_id":cid, "qty":qty} for (pn,cid),qty in free.items()]
    rows.sort(key=lambda r:(-r["qty"], r["part_num"], r["color_id"]))
    return {"ok": True, "rows": rows[offset:offset+limit], "total": len(rows)}
