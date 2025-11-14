from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import os, json, sqlite3
from typing import Dict, List, Optional, Tuple

router = APIRouter()
INV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "inventory_parts.json")
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "lego_catalog.db")

def _load() -> List[dict]:
    if not os.path.exists(INV_PATH): return []
    with open(INV_PATH, "r") as f:
        try:
            data = json.load(f) or []
            if not isinstance(data, list): raise ValueError("inventory file is not a list")
            return data
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="inventory_parts.json is not valid JSON")

def _save(rows: List[dict]):
    os.makedirs(os.path.dirname(INV_PATH), exist_ok=True)
    with open(INV_PATH, "w") as f: json.dump(rows, f)


def _load_part_images(part_nums: List[str]) -> Dict[str, Tuple[Optional[str], Optional[str]]]:
    unique = sorted({p for p in part_nums if p})
    if not unique or not os.path.exists(DB_PATH):
        return {}
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    placeholders = ",".join("?" for _ in unique)
    query = f"SELECT part_num, part_img_url, part_thumb_url FROM parts WHERE part_num IN ({placeholders})"
    cur.execute(query, unique)
    lookup: Dict[str, Tuple[Optional[str], Optional[str]]] = {}
    for part_num, part_img_url, part_thumb_url in cur.fetchall():
        lookup[str(part_num)] = (part_img_url, part_thumb_url)
    con.close()
    return lookup

class InvLine(BaseModel):
    part_num: str
    color_id: int
    qty_total: int

@router.get("/parts")
def get_inventory():
    rows = _load()
    part_nums = [str(r.get("part_num")) for r in rows if r.get("part_num")]
    image_lookup = _load_part_images(part_nums)
    enriched = []
    for row in rows:
        part_num = str(row.get("part_num")) if row.get("part_num") is not None else None
        part_img_url: Optional[str] = None
        part_thumb_url: Optional[str] = None
        if part_num and part_num in image_lookup:
            part_img_url, part_thumb_url = image_lookup[part_num]
        img_url = part_thumb_url or part_img_url or None
        enriched.append({**row, "img_url": img_url, "part_img_url": part_img_url})
    return enriched

@router.post("/add")
def add_part(line: InvLine):
    rows = _load()
    rows.append(line.dict())
    _save(rows)
    return {"ok": True, "count": len(rows)}

@router.post("/replace")
def replace_inventory(lines: List[InvLine]):
    _save([x.dict() for x in lines])
    return {"ok": True, "count": len(lines)}

@router.delete("/part")
def delete_part(part_num: str = Query(...), color_id: int = Query(...)):
    """Delete all entries matching (part_num, color_id)."""
    rows = _load()
    before = len(rows)
    rows = [r for r in rows if not (str(r.get("part_num")) == str(part_num) and int(r.get("color_id", 0)) == int(color_id))]
    removed = before - len(rows)
    if removed == 0:
        # still save to normalize file if needed
        _save(rows)
        raise HTTPException(status_code=404, detail=f"Item {part_num}/{color_id} not found")
    _save(rows)
    return {"ok": True, "removed": removed, "remaining": len(rows)}


from pydantic import Field

class DecrementOne(BaseModel):
    part_num: str
    color_id: int
    qty: int = Field(..., gt=0, description="How many to remove")

class DeleteKey(BaseModel):
    part_num: str
    color_id: int

def _keymatch(r, part_num, color_id):
    return str(r.get("part_num")) == str(part_num) and int(r.get("color_id", 0)) == int(color_id)

@router.post("/decrement")
def decrement(body: DecrementOne):
    rows = _load()
    changed = False
    for r in rows:
        if _keymatch(r, body.part_num, body.color_id):
            newq = max(0, int(r.get("qty_total",0)) - body.qty)
            r["qty_total"] = newq
            changed = True
            break
    if not changed:
        raise HTTPException(status_code=404, detail=f"Item {body.part_num}/{body.color_id} not found")
    # drop zeros
    rows = [r for r in rows if int(r.get("qty_total",0)) > 0]
    _save(rows)
    return {"ok": True, "remaining": len(rows)}

class BatchDecItem(BaseModel):
    part_num: str
    color_id: int
    qty: int = Field(..., gt=0)

@router.post("/batch_decrement")
def batch_decrement(items: List[BatchDecItem]):
    rows = _load()
    removed = 0
    touched = 0
    for it in items:
        for r in rows:
            if _keymatch(r, it.part_num, it.color_id):
                newq = max(0, int(r.get("qty_total",0)) - it.qty)
                if newq != int(r.get("qty_total",0)):
                    touched += 1
                r["qty_total"] = newq
                break
    # drop zeros
    before = len(rows)
    rows = [r for r in rows if int(r.get("qty_total",0)) > 0]
    removed = before - len(rows)
    _save(rows)
    return {"ok": True, "touched": touched, "auto_deleted_zero_qty": removed, "remaining": len(rows)}

@router.post("/batch_delete")
def batch_delete(keys: List[DeleteKey]):
    rows = _load()
    keyset = {(k.part_num, k.color_id) for k in keys}
    before = len(rows)
    rows = [r for r in rows if (str(r.get("part_num")), int(r.get("color_id",0))) not in {(str(p), int(c)) for (p,c) in keyset}]
    removed = before - len(rows)
    _save(rows)
    if removed == 0:
        raise HTTPException(status_code=404, detail="No matching items found to delete")
    return {"ok": True, "removed": removed, "remaining": len(rows)}
@router.delete("/clear")
def clear_inventory(confirm: str = Query(..., description='Type "YES" to confirm')):
    if confirm != "YES":
        raise HTTPException(status_code=400, detail='Refused. Pass confirm=YES to clear all inventory.')
    _save([])
    return {"ok": True, "cleared": True, "count": 0}
