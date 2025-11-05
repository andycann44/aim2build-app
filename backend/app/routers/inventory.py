from __future__ import annotations
import json, os
from pathlib import Path
from typing import Dict, Tuple, List
from fastapi import APIRouter, HTTPException

# ---- paths -------------------------------------------------
router = APIRouter()
DATA_DIR        = Path(__file__).resolve().parents[1] / "data"
INV_SETS_PATH   = DATA_DIR / "inventory.json"          # { "sets": [ { set_num, name?, year?, img_url?, qty? } ] }
INV_PARTS_PATH  = DATA_DIR / "inventory_parts.json"    # [ { part_num, color_id, qty_total, img_url? } ]
CACHE_DIR       = DATA_DIR / "parts_cache"

# optional: use API when cache is missing
def _ensure_cached_parts(set_num: str) -> List[dict]:
    """
    Return list of parts for set_num. Prefer local cache; if missing try to fetch via services.rebrickable.
    Each row shape: { part_num, color_id, quantity, part_img_url? }
    """
    sid_dash = set_num if "-" in set_num else f"{set_num}-1"
    sid_plain = sid_dash.split("-")[0]
    for key in (f"{sid_dash}.json", f"{sid_plain}.json"):
        p = CACHE_DIR / key
        if p.exists():
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                if isinstance(data, list) and data and isinstance(data[0], dict):
                    return data
            except Exception:
                pass

    # fallback: try fetch
    try:
        from app.services.rebrickable import ensure_cached_parts
        parts = ensure_cached_parts(sid_dash)
        # persist under both names for tolerance
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        (CACHE_DIR / f"{sid_dash}.json").write_text(json.dumps(parts, ensure_ascii=False, indent=2), encoding="utf-8")
        (CACHE_DIR / f"{sid_plain}.json").write_text(json.dumps(parts, ensure_ascii=False, indent=2), encoding="utf-8")
        return parts
    except Exception:
        # final fallback: empty
        return []

# ---- small JSON helpers -----------------------------------
def _read_json(path: Path, default):
    if not path.exists(): return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default

def _load_inventory_sets() -> List[dict]:
    obj = _read_json(INV_SETS_PATH, {"sets": []})
    if isinstance(obj, dict) and "sets" in obj and isinstance(obj["sets"], list):
        return obj["sets"]
    if isinstance(obj, list):
        return obj
    return []

def _save_inventory_sets(rows: List[dict]):
    INV_SETS_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = INV_SETS_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps({"sets": rows}, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(INV_SETS_PATH)

# ---- aggregation (authoritative) --------------------------
def _rebuild_inventory_parts() -> List[dict]:
    """
    Read inventory sets -> load each set's cached parts -> aggregate to unique (part_num,color_id).
    Write to inventory_parts.json and return the list.
    """
    sets = _load_inventory_sets()
    tally: Dict[Tuple[str,int], Dict[str, int | str]] = {}

    for s in sets:
        sid = str(s.get("set_num") or "").strip()
        if not sid:
            continue
        parts = _ensure_cached_parts(sid)
        for row in parts:
            pn = row.get("part_num")
            cid = row.get("color_id")
            qty = row.get("quantity") or row.get("qty") or 0
            if pn is None or cid is None: 
                continue
            key = (str(pn), int(cid))
            item = tally.get(key)
            if not item:
                item = {"part_num": str(pn), "color_id": int(cid), "qty_total": 0}
                # carry an image if present
                img = row.get("part_img_url") or row.get("img_url") or row.get("element_img_url")
                if img: item["img_url"] = img
                tally[key] = item
            item["qty_total"] = int(item["qty_total"]) + int(qty)

    out = list(tally.values())
    INV_PARTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    INV_PARTS_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    return out

# ---- routes ------------------------------------------------
@router.get("")      # /api/inventory
@router.get("/")     # /api/inventory/
def list_inventory_sets():
    """Return sets currently marked as 'in inventory'."""
    return _load_inventory_sets()

@router.get("/parts")
def list_inventory_parts(min_qty: int = 1, q: str = ""):
    """
    UI reader: return aggregated parts, filtered by min_qty and optional name/num query (client does the name filter).
    """
    rows = _read_json(INV_PARTS_PATH, [])
    # backwards-compat: if file missing, rebuild once
    if not rows:
        rows = _rebuild_inventory_parts()

    # apply min filter
    rows = [r for r in rows if int(r.get("qty_total") or 0) >= int(min_qty)]
    return rows

@router.post("/rebuild")
def force_rebuild():
    """Manual/UIButton: force rebuild from current inventory sets."""
    out = _rebuild_inventory_parts()
    return {"ok": True, "count": len(out)}

@router.post("/toggle")
def toggle_inventory(payload: dict):
    """
    Authoritative toggle:
    - on=true  => add set (if not present)
    - on=false => remove set
    Always followed by a rebuild so parts match the ticks.
    """
    set_num = str(payload.get("set_num") or "").strip()
    on = bool(payload.get("on"))
    if not set_num:
        raise HTTPException(422, "set_num required")

    rows = _load_inventory_sets()

    if on:
        if not any(str(r.get("set_num")) == set_num for r in rows):
            rows.append({
                "set_num": set_num,
                "name": payload.get("name") or "",
                "year": payload.get("year") or None,
                "img_url": payload.get("img_url") or "",
                "num_parts": payload.get("num_parts") or None,
                "qty": payload.get("qty") or 1,
            })
        # warm cache so rebuild is instantaneous
        _ensure_cached_parts(set_num)
    else:
        rows = [r for r in rows if str(r.get("set_num")) != set_num]

    _save_inventory_sets(rows)
    _rebuild_inventory_parts()
    return {"ok": True, "on": on, "sets": rows}