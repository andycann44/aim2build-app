from fastapi import APIRouter, HTTPException, Query
from pathlib import Path
import json

router = APIRouter(prefix="/api/buildability", tags=["buildability"])

DATA_DIR  = Path(__file__).resolve().parents[2] / "app" / "data"
SET_DIRS  = [DATA_DIR / "catalog" / "sets", DATA_DIR / "cache" / "sets"]  # prefer catalog, fallback to cache
INV_PATH  = DATA_DIR / "inventory_parts.json"

def load_inventory_map():
    """
    Returns two maps:
      inv_id[(part_num, color_id)] = qty_total
      inv_name[(part_num, color_name_lower)] = qty_total   (fallback)
    """
    if not INV_PATH.is_file():
        return {}, {}
    try:
        rows = json.loads(INV_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}, {}
    inv_id, inv_name = {}, {}
    for r in rows if isinstance(rows, list) else []:
        pn = str(r.get("part_num","")).strip()
        cid = r.get("color_id", None)
        cn  = (r.get("color_name") or "").strip().lower()
        q   = int(r.get("qty_total", r.get("quantity", 0)) or 0)
        if pn and cid is not None:
            inv_id[(pn, int(cid))] = inv_id.get((pn, int(cid)), 0) + q
        if pn and cn:
            inv_name[(pn, cn)] = inv_name.get((pn, cn), 0) + q
    return inv_id, inv_name

def find_set_json(set_num: str):
    for d in SET_DIRS:
        p = d / f"{set_num}.json"
        if p.is_file():
            return p
    return None

def load_set_parts(set_num: str):
    p = find_set_json(set_num)
    if not p:
        raise HTTPException(status_code=404, detail=f"Set cache not found: {set_num}")
    obj = json.loads(p.read_text(encoding="utf-8"))
    # accept several shapes: list, {"parts":[...]}, {"results":[...]}
    rows = obj if isinstance(obj, list) else obj.get("parts") or obj.get("results") or []
    out = []
    for r in rows:
        # normalise common keys
        pn = str(r.get("part_num") or r.get("part",{}).get("part_num") or "").strip()
        qty= int(r.get("quantity") or r.get("qty") or r.get("num_sets",0) or 0)
        cid= r.get("color_id")
        cn = (r.get("color_name") or r.get("color",{}).get("name") or "").strip()
        url= r.get("img_url") or r.get("part",{}).get("part_img_url")
        if pn and qty>0:
            out.append({"part_num":pn, "quantity":qty, "color_id":cid, "color_name":cn, "img_url":url})
    return out

@router.get("/compare")
def compare(set_num: str = Query(..., description="e.g. 21330-1")):
    parts = load_set_parts(set_num)
    inv_id, inv_name = load_inventory_map()

    rows = []
    need_total = have_total = missing_total = 0

    for r in parts:
        pn   = r["part_num"]
        need = int(r["quantity"])
        cid  = r.get("color_id")
        cn   = (r.get("color_name") or "").strip().lower()
        have = 0
        if cid is not None:
            have = int(inv_id.get((pn, int(cid)), 0))
        if have == 0 and cn:
            have = int(inv_name.get((pn, cn), 0))
        miss = max(0, need - have)

        rows.append({
            "part_num": pn,
            "part_name": r.get("part_name"),
            "color_id": cid,
            "color_name": r.get("color_name"),
            "need": need, "have": have, "missing": miss,
            "img_url": r.get("img_url")
        })

        need_total   += need
        have_total   += min(have, need)
        missing_total+= miss

    cover = (have_total / need_total * 100.0) if need_total else 0.0
    return {"totals": {
                "need_total": need_total,
                "have_total": have_total,
                "missing_total": missing_total,
                "cover_pct": round(cover, 2)
            },
            "rows": rows}
