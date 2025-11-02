from fastapi import APIRouter, HTTPException, Query
from typing import Dict, List

router = APIRouter(prefix="/api/buildability", tags=["buildability"])

def _load_have_free() -> List[dict]:
    """
    Try inventory sources in order:
    1) inventory router aggregate loader (if present)
    2) inventory free endpoint service function (if present)
    3) json file fallback: backend/app/data/inventory_parts.json
    Returns list of {part_num,color_id,qty}
    """
    # 1) inventory router internal loader
    try:
        from app.routers.inventory import _agg_load  # type: ignore
        rows = _agg_load()
        if isinstance(rows, list) and rows:
            return rows
    except Exception:
        pass
    # 2) service loader (if you have app.services.inventory)
    try:
        from app.services.inventory import load_inventory_parts  # type: ignore
        rows = load_inventory_parts()
        if isinstance(rows, list) and rows:
            return rows
    except Exception:
        pass
    # 3) file fallback
    try:
        import json, pathlib
        here = pathlib.Path(__file__).resolve().parent
        f = (here / "../data/inventory_parts.json").resolve()
        if f.exists():
            with f.open("r", encoding="utf-8") as h:
                rows = json.load(h)
                if isinstance(rows, list):
                    return rows
    except Exception:
        pass
    return []

@router.get("/compare")
def compare_set(set_num: str = Query(..., description="e.g. 21330-1")):
    """
    Side-by-side: parts needed for set (from DB) vs free inventory.
    Always returns { ok, set_num, totals, rows }.
    """
    # Needed parts (DB-first)
    try:
        from app.routers.catalog import get_set_parts
        need_rows = get_set_parts(set_num)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"catalog lookup failed: {e}")

    have_rows = _load_have_free()

    # Index have by (part_num,color_id)
    have_map: Dict[tuple, int] = {}
    for r in have_rows or []:
        key = (r.get("part_num"), r.get("color_id"))
        if key[0] is None or key[1] is None:  # skip bad rows
            continue
        have_map[key] = have_map.get(key, 0) + int(r.get("qty", 0))

    rows: List[dict] = []
    have_total = 0
    need_total = 0
    missing_total = 0

    for n in need_rows or []:
        pn = n.get("part_num")
        cid = n.get("color_id")
        if pn is None or cid is None:
            continue
        need = int(n.get("qty", 0))
        have = int(have_map.get((pn, cid), 0))
        miss = max(0, need - have)

        rows.append({
            "part_num": pn,
            "part_name": n.get("part_name"),
            "color_id": cid,
            "color_name": n.get("color_name"),
            "need": need,
            "have": have,
            "missing": miss,
            "img_url": n.get("img_url"),
        })

        need_total += need
        have_total += min(have, need)
        missing_total += miss

    rows.sort(key=lambda r: (-r["missing"], r["part_num"], r["color_id"]))
    cover = round((have_total / need_total * 100.0), 1) if need_total else 0.0

    return {
        "ok": True,
        "set_num": set_num,
        "totals": {
            "need_total": need_total,
            "have_total": have_total,
            "missing_total": missing_total,
            "cover_pct": cover
        },
        "rows": rows
    }
