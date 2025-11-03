from fastapi import APIRouter, Query
CACHE_DIR = DATA_DIR / "cache"
from pathlib import Path
import json

router = APIRouter(prefix="/api/buildability", tags=["buildability"])

# Paths
# backend/
BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_DIR    = BACKEND_DIR / "app" / "data"
CATALOG_DIR = DATA_DIR / "catalog" / "sets"
CACHE_DIR   = DATA_DIR / "cache"   / "sets"

def _set_cache_path(set_num: str) -> Path:
    """Prefer catalog snapshot, fall back to cache."""
    p = CATALOG_DIR / f"{set_num}.json"
    if p.is_file():
        return p
    return CACHE_DIR / f"{set_num}.json"

def _load_inventory_map() -> dict:
    """
    Read aggregated inventory instantly from inventory_parts.json
    Format expected: list of { part_num, color_id, qty_total, ... }
    Returns: dict key "part|color" -> qty_total
    """
    inv_path = DATA_DIR / "inventory_parts.json"
    if not inv_path.is_file():
        return {}
    try:
        rows = json.loads(inv_path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    inv = {}
    for r in rows if isinstance(rows, list) else []:
        pn = str(r.get("part_num", "")).strip()
        cid = str(r.get("color_id", "")).strip()
        try:
            qty = int(r.get("qty_total", 0))
        except Exception:
            qty = 0
        if pn and cid:
            inv[f"{pn}|{cid}"] = qty
    return inv

def _load_set_parts_from_cache(set_num: str) -> list:
    """
    Load a set's parts from a cached JSON file. Supports shapes:
      - Array of part rows
      - { "parts": [...] } or { "results": [...] } (Rebrickable-like)
    Normalizes to list of {part_num, color_id, qty}
    """
    path = _set_cache_path(set_num)
    if not path.is_file():
        return []

    try:
        obj = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []

    # Pick rows array
    rows = []
    if isinstance(obj, list):
        rows = obj
    elif isinstance(obj, dict):
        if isinstance(obj.get("parts"), list):
            rows = obj["parts"]
        elif isinstance(obj.get("results"), list):
            rows = obj["results"]

    out = []
    for r in rows:
        # Handle both flat and nested shapes
        part = r.get("part") or {}
        color = r.get("color") or {}

        pn = r.get("part_num") or part.get("part_num") or part.get("num")
        cid = r.get("color_id") or color.get("id") or r.get("color")

        qty = (
            r.get("quantity")
            or r.get("qty")
            or r.get("count")
            or r.get("qty_total")
            or 0
        )
        try:
            qty = int(qty)
        except Exception:
            qty = 0

        if pn is None or cid is None:
            continue

        out.append({"part_num": str(pn), "color_id": str(cid), "qty": qty})

    return out

@router.get("/compare")
def compare(set_num: str = Query(..., alias="set_num")):
    inv = _load_inventory_map()
    inv_name = _load_inventory_name_map()
    parts = _load_set_parts_from_cache(set_num)

    totals = {
        "need_total": 0,
        "have_total": 0,
        "missing_total": 0,
        "cover_pct": 0.0,
    }
    rows = []

    for r in parts:
        pn = r["part_num"]
        cid = r["color_id"]
        need = int(r.get("qty", 0))
        have = int(inv.get(f"{pn}|{cid}", 0))
        missing = max(0, need - have)

        rows.append({
            "part_num": pn,
            "color_id": cid,
            "need": need,
            "have": have,
            "missing": missing,
        })

        totals["need_total"] += need
        totals["have_total"] += min(have, need)
        totals["missing_total"] += missing

    if totals["need_total"]:
        totals["cover_pct"] = 100.0 * (totals["have_total"] / totals["need_total"])

    return {"totals": totals, "rows": rows}


def _load_inventory_name_map() -> dict:
    """Index inventory by (part_num|color_name.lower()) for fallback."""
    from pathlib import Path
    import json
    DATA_DIR = (Path(__file__).resolve().parents[2] / "app" / "data")
    inv_path = DATA_DIR / "inventory_parts.json"
    if not inv_path.is_file():
        return {}
    try:
        rows = json.loads(inv_path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    out = {}
    for r in rows if isinstance(rows, list) else []:
        pn = str(r.get("part_num","")).strip()
        cn = (r.get("color_name") or "").strip().lower()
        qty = int(r.get("qty_total", r.get("qty_free", r.get("quantity", 0)) or 0))
        if pn and cn:
            out[f"{pn}|{cn}"] = out.get(f"{pn}|{cn}", 0) + qty
    return out


def _compare_cache_key(set_num: str) -> str:
    import hashlib, json
    inv_path = DATA_DIR / "inventory_parts.json"
    h = hashlib.sha256()
    try:
        h.update(inv_path.read_bytes())
    except Exception:
        pass
    return f"{set_num}-{h.hexdigest()[:16]}"

def _compare_cache_read(set_num: str):
    k = _compare_cache_key(set_num)
    path = CACHE_DIR / "compare" / f"{k}.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None

def _compare_cache_write(set_num: str, obj):
    k = _compare_cache_key(set_num)
    d = CACHE_DIR / "compare"
    d.mkdir(parents=True, exist_ok=True)
    path = d / f"{k}.json"
    try:
        path.write_text(json.dumps(obj), encoding="utf-8")
    except Exception:
        pass
