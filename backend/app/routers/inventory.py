from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import os
import json
from typing import List

router = APIRouter()
INV_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "data",
    "inventory_parts.json",
)


def _load() -> List[dict]:
    """Load inventory parts from JSON file."""
    if not os.path.exists(INV_PATH):
        return []
    with open(INV_PATH, "r") as f:
        try:
            data = json.load(f) or []
            if not isinstance(data, list):
                raise ValueError("inventory file is not a list")
            return data
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=500,
                detail="inventory_parts.json is not valid JSON",
            )


def _save(rows: List[dict]):
    """Save inventory parts to JSON file."""
    os.makedirs(os.path.dirname(INV_PATH), exist_ok=True)
    with open(INV_PATH, "w") as f:
        json.dump(rows, f)


class InvLine(BaseModel):
    part_num: str
    color_id: int
    qty_total: int


def _guess_part_img_url(part_num, color_id):
    """
    Fallback image URL for a given part_num + color_id.
    Uses Rebrickable's standard CDN pattern.
    """
    if not part_num or color_id is None:
        return None
    return f"https://cdn.rebrickable.com/media/parts/{color_id}/{part_num}.jpg"


def _keymatch(r: dict, part_num: str, color_id: int) -> bool:
    """Helper to match a row on (part_num, color_id)."""
    return str(r.get("part_num")) == str(part_num) and int(
        r.get("color_id", 0)
    ) == int(color_id)


@router.get("/parts")
def get_inventory():
    """
    Return all inventory parts, ensuring each has an img_url.
    """
    rows = _load()
    for row in rows:
        part_num = row.get("part_num")
        color_id = row.get("color_id")
        if not row.get("img_url"):
            row["img_url"] = _guess_part_img_url(part_num, color_id)
    return rows


@router.post("/add")
def add_inventory(lines: List[InvLine]):
    """
    Add or increment inventory lines.

    If a (part_num, color_id) already exists, its qty_total is increased.
    """
    rows = _load()
    # Build an index for quick merge
    index = {
        (str(r.get("part_num")), int(r.get("color_id", 0))): r for r in rows
    }
    for line in lines:
        key = (line.part_num, line.color_id)
        existing = index.get(key)
        if existing:
            existing["qty_total"] = int(existing.get("qty_total", 0)) + int(
                line.qty_total
            )
        else:
            rows.append(
                {
                    "part_num": line.part_num,
                    "color_id": line.color_id,
                    "qty_total": line.qty_total,
                }
            )
    _save(rows)
    return {"ok": True, "count": len(rows)}


@router.post("/replace")
def replace_inventory(lines: List[InvLine]):
    """
    Replace the entire inventory with the provided lines.
    """
    rows = [x.dict() for x in lines]
    _save(rows)
    return {"ok": True, "count": len(rows)}


@router.delete("/part")
def delete_part(
    part_num: str = Query(...),
    color_id: int = Query(...),
):
    """
    Delete all entries matching (part_num, color_id).
    """
    rows = _load()
    before = len(rows)
    rows = [
        r
        for r in rows
        if not _keymatch(r, part_num=part_num, color_id=color_id)
    ]
    removed = before - len(rows)
    _save(rows)
    if removed == 0:
        raise HTTPException(
            status_code=404,
            detail="No matching items found to delete",
        )
    return {
        "ok": True,
        "removed": removed,
        "remaining": len(rows),
    }


@router.delete("/clear")
def clear_inventory(
    confirm: str = Query(..., description='Type "YES" to confirm'),
):
    """
    Clear the entire inventory. Requires confirm=YES.
    """
    if confirm != "YES":
        raise HTTPException(
            status_code=400,
            detail='Refused. Pass confirm=YES to clear all inventory.',
        )
    _save([])
    return {"ok": True, "cleared": True, "count": 0}