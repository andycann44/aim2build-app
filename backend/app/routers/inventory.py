from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import os, json
from typing import List

router = APIRouter()
INV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "inventory_parts.json")

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

class InvLine(BaseModel):
    part_num: str
    color_id: int
    qty_total: int

@router.get("/parts")
def get_inventory():
    return _load()

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

@router.delete("/clear")
def clear_inventory(confirm: str = Query(..., description='Type "YES" to confirm')):
    if confirm != "YES":
        raise HTTPException(status_code=400, detail='Refused. Pass confirm=YES to clear all inventory.')
    _save([])
    return {"ok": True, "cleared": True, "count": 0}
