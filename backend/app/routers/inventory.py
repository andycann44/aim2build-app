import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException

from app.services.rebrickable import ensure_cached_parts  # uses cached parts or fetches & caches

logger = logging.getLogger("aim2build.inventory")
router = APIRouter()

# -------------------------------
# Paths
# -------------------------------
DATA_DIR = (Path(__file__).resolve().parents[1] / "data").resolve()
CACHE_DIR = (DATA_DIR / "parts_cache").resolve()
INV_SETS_PATH = (DATA_DIR / "inventory.json").resolve()          # selected sets (ticked)
INV_PARTS_PATH = (DATA_DIR / "inventory_parts.json").resolve()   # aggregated parts


# -------------------------------
# File helpers
# -------------------------------
def _read_json(path: Path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error("Failed to read %s: %s", path, e)
        return None


def _write_json(path: Path, obj):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def _load_inventory_sets() -> List[dict]:
    """inventory.json can be {"sets":[...]} or a bare list; normalize to list."""
    data = _read_json(INV_SETS_PATH)
    if not data:
        return []
    if isinstance(data, dict) and "sets" in data:
        return list(data.get("sets") or [])
    if isinstance(data, list):
        return data
    return []


def _save_inventory_sets(rows: List[dict]) -> None:
    _write_json(INV_SETS_PATH, {"sets": rows})


def _read_inventory_parts() -> List[dict]:
    data = _read_json(INV_PARTS_PATH)
    if isinstance(data, list):
        return data
    return []


def _write_inventory_parts(rows: List[dict]) -> None:
    _write_json(INV_PARTS_PATH, rows)


# -------------------------------
# Aggregation
# -------------------------------
def _aggregate() -> List[dict]:
    """
    Merge all ticked sets' cached parts into an aggregated list of rows:

      {
        "part_num": "3001",
        "color_id": 5,
        "qty_total": 12,
        "name": "Brick 2 x 4",        # if available
        "img_url": "https://..."      # if available
      }
    """
    sets_rows = _load_inventory_sets()
    agg: Dict[Tuple[str, int], dict] = {}

    for s in sets_rows:
        sid = str(s.get("set_num", "")).strip()
        if not sid:
            continue

        try:
            parts = ensure_cached_parts(sid)  # list of dicts (from cache or fetched)
        except Exception as e:
            logger.error("[rebuild] %s: fetch failed: %s", sid, e)
            continue

        for r in parts or []:
            pn = r.get("part_num")
            cid = r.get("color_id")
            qty = r.get("quantity", r.get("qty", 0))
            try:
                qty = int(qty or 0)
            except Exception:
                qty = 0

            if not pn or cid is None:
                continue

            key = (str(pn), int(cid))
            row = agg.get(key)
            if not row:
                row = {
                    "part_num": str(pn),
                    "color_id": int(cid),
                    "qty_total": 0,
                    "name": None,
                    "img_url": None,
                }
                agg[key] = row

            row["qty_total"] += qty

            # carry first-seen metadata if present
            nm = r.get("name") or r.get("part_name")
            if nm and not row["name"]:
                row["name"] = str(nm)

            img = r.get("img_url") or r.get("part_img_url") or r.get("image")
            if img and not row["img_url"]:
                row["img_url"] = str(img)

    out = list(agg.values())
    out.sort(key=lambda x: (-int(x.get("qty_total", 0) or 0), x.get("part_num", ""), x.get("color_id", 0)))
    return out


# -------------------------------
# Endpoints
# -------------------------------
@router.get("/parts")
def list_parts(min_qty: int = 1, q: str = "") -> List[dict]:
    """
    Returns aggregated parts (from inventory_parts.json if present, otherwise aggregates on the fly).
    Supports filtering by min quantity and a simple text search across part_num and name.
    """
    rows = _read_inventory_parts()
    if not rows:
        rows = _aggregate()
        _write_inventory_parts(rows)

    min_qty = int(min_qty or 0)
    q = (q or "").strip().lower()

    out: List[dict] = []
    for r in rows:
        if int(r.get("qty_total", 0) or 0) < min_qty:
            continue
        if q:
            hay = f'{r.get("part_num","")} {r.get("name","")}'.lower()
            if q not in hay:
                continue
        out.append(r)
    return out


@router.post("/rebuild")
def rebuild_inventory():
    """Re-aggregate from the currently ticked sets and overwrite inventory_parts.json."""
    rows = _aggregate()
    _write_inventory_parts(rows)
    return {"unique": len(rows), "total": sum(int(r.get("qty_total", 0) or 0) for r in rows)}


@router.post("/toggle")
def toggle_inventory(payload: dict):
    """
    Authoritative toggle driven by the My Sets checkbox.

    payload:
      { "set_num": "21330-1", "on": true|false, "name"?, "year"?, "img_url"?, "num_parts"? }

    - on = true  -> ensure set exists in inventory.json; then rebuild parts
    - on = false -> remove set from inventory.json; then rebuild parts
    """
    set_num = str(payload.get("set_num") or "").strip()
    on = bool(payload.get("on"))
    if not set_num:
        raise HTTPException(422, "set_num required")

    rows = _load_inventory_sets()

    if on:
        # add if not present
        if not any(str(r.get("set_num")) == set_num for r in rows):
            rows.append({
                "set_num": set_num,
                "name": payload.get("name") or "",
                "year": payload.get("year") or None,
                "img_url": payload.get("img_url") or "",
                "num_parts": payload.get("num_parts") or None,
            })
    else:
        # remove if present
        rows = [r for r in rows if str(r.get("set_num")) != set_num]

    _save_inventory_sets(rows)

    # always rebuild so Inventory matches ticks
    agg = _aggregate()
    _write_inventory_parts(agg)
    return {
        "ok": True,
        "set_num": set_num,
        "on": on,
        "stats": {"unique": len(agg), "total": sum(int(r.get("qty_total", 0) or 0) for r in agg)},
    }


@router.post("/clear_files")
def clear_inventory_files():
    """
    Delete ONLY inventory.json and inventory_parts.json.
    Cached set parts under data/parts_cache are retained.
    """
    removed = []
    for p in (INV_SETS_PATH, INV_PARTS_PATH):
        try:
            if p.exists():
                p.unlink()
                removed.append(p.name)
        except Exception as e:
            logger.error("Failed to remove %s: %s", p, e)

    kept = len(list(CACHE_DIR.glob("*.json"))) if CACHE_DIR.exists() else 0
    return {"ok": True, "removed": removed, "kept_count": kept}


@router.get("/")
def inventory_root():
    """Small helper for debugging."""
    sets_rows = _load_inventory_sets()
    parts_rows = _read_inventory_parts()
    return {
        "sets_count": len(sets_rows),
        "parts_cached": len(parts_rows),
    }