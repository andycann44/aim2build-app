from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os, json

router = APIRouter()
INV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "inventory_parts.json")

class InvLine(BaseModel):
    part_num: str
    color_id: int
    qty_total: int

@router.get("/parts")
def get_inventory():
    if not os.path.exists(INV_PATH): return []
    with open(INV_PATH,"r") as f: return json.load(f)

@router.post("/add")
def add_part(line: InvLine):
    rows = []
    if os.path.exists(INV_PATH):
        with open(INV_PATH,"r") as f: rows = json.load(f) or []
    rows.append(line.dict())
    with open(INV_PATH,"w") as f: json.dump(rows, f)
    return {"ok": True, "count": len(rows)}

@router.post("/replace")
def replace_inventory(lines: list[InvLine]):
    with open(INV_PATH,"w") as f: json.dump([x.dict() for x in lines], f)
    return {"ok": True, "count": len(lines)}
