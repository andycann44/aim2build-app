from fastapi import APIRouter, HTTPException, Query, Body, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Tuple
from pathlib import Path
import json

from app.user_db import user_db
from app.catalog_db import get_catalog_parts_for_set
from app.paths import DATA_DIR
from app.routers.auth import get_current_user, User
from app.image_lookup import get_strict_element_image


router = APIRouter()


def _inventory_file(user_id: int) -> Path:
    return DATA_DIR / f"inventory_parts_user_{user_id}.json"


# -----------------------
# Internal helpers
# -----------------------

def _load(user_id: int) -> List[dict]:
    """Load inventory from JSON file. Always returns a list."""
    path = _inventory_file(user_id)
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        try:
            data = json.load(f) or []
        except json.JSONDecodeError:
            return []
    if not isinstance(data, list):
        raise ValueError("inventory file is not a list")
    return data


def _save(user_id: int, rows: List[dict]) -> None:
    """Persist inventory list to JSON file."""
    path = _inventory_file(user_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2, sort_keys=True)


def _index_by_key(rows: List[dict]) -> Dict[Tuple[str, int], dict]:
    idx: Dict[Tuple[str, int], dict] = {}
    for r in rows:
        part = str(r.get("part_num"))
        color = int(r.get("color_id", 0))
        idx[(part, color)] = r
    return idx


def load_inventory_parts(user_id: int) -> List[dict]:
    """Helper exposed for other routers (e.g., buildability)"""
    return _load(user_id)


# -----------------------
# Models
# -----------------------

class InventoryPart(BaseModel):
    part_num: str
    color_id: int
    qty_total: int = Field(..., ge=0)
    part_img_url: Optional[str] = None

    class Config:
        orm_mode = True


class InvLine(BaseModel):
    part_num: str
    color_id: int
    qty_total: int = Field(..., ge=0)


class InvBatch(BaseModel):
    items: List[InvLine]


class DecrementOne(BaseModel):
    part_num: str
    color_id: int
    delta: int = Field(1, gt=0)


class DecrementBatch(BaseModel):
    items: List[DecrementOne]


class DeleteKeys(BaseModel):
    part_num: str
    color_id: int


class DeleteBatch(BaseModel):
    keys: List[DeleteKeys]
    
class AddCanonicalPayload(BaseModel):
    part_num: str
    color_id: int
    qty: int = 1
    
class DecCanonicalPayload(BaseModel):
    part_num: str
    color_id: int
    delta: int = Field(1, gt=0)    


# -----------------------
# Endpoints
# -----------------------

@router.get("/parts", response_model=List[InventoryPart])
def list_inventory_parts(
    current_user: User = Depends(get_current_user),
) -> List[InventoryPart]:
    """
    STRICT IMAGE VERSION

    Rules:
      - Only element_images (part_num, color_id) -> img_url
      - If missing / blank -> part_img_url = None
      - No fallback to parts.part_img_url
      - No parent fallback
      - No "any color" fallback
    """
    rows = _load(current_user.id)
    out: List[InventoryPart] = []

    for r in rows:
        part_num = str(r.get("part_num"))
        color_id = int(r.get("color_id", 0))
        qty_total = int(r.get("qty_total", 0))

        img = get_strict_element_image(part_num, color_id)

        out.append(
            InventoryPart(
                part_num=part_num,
                color_id=color_id,
                qty_total=qty_total,
                part_img_url=img,
            )
        )

    return out


@router.get("/parts_with_images", response_model=List[InventoryPart])
def list_inventory_parts_with_images(
    current_user: User = Depends(get_current_user),
) -> List[InventoryPart]:
    return list_inventory_parts(current_user)


@router.post("/add")
def add_inventory(
    set: Optional[str] = Query(None, description="LEGO set number to add (alias: set_num, id)"),
    set_num: Optional[str] = Query(None),
    id: Optional[str] = Query(None),
    line: Optional[InvLine] = Body(
        None,
        description="Single part line to add when no set/set_num/id is provided",
    ),
    current_user: User = Depends(get_current_user),
):
    rows = _load(current_user.id)
    index = _index_by_key(rows)

    # --------- Mode 1: add by set from catalog ---------
    chosen = set_num or set or id
    if chosen:
        set_id = chosen.strip()
        if not set_id:
            raise HTTPException(status_code=400, detail="Empty set id")

        set_parts = get_catalog_parts_for_set(set_id)
        if not set_parts:
            raise HTTPException(status_code=404, detail=f"No catalog parts found for set {set_id}")

        added_unique = 0
        for row in set_parts:
            part = str(row["part_num"])
            color = int(row["color_id"])
            need_qty = int(row["quantity"])
            key = (part, color)

            existing = index.get(key)
            if existing is None:
                index[key] = {
                    "part_num": part,
                    "color_id": color,
                    "qty_total": need_qty,
                }
                added_unique += 1
            else:
                existing_qty = int(existing.get("qty_total", 0))
                existing["qty_total"] = existing_qty + need_qty

        rows = list(index.values())
        _save(current_user.id, rows)
        return {
            "ok": True,
            "mode": "set",
            "set_num": set_id,
            "unique_parts_touched": added_unique,
            "total_rows": len(rows),
        }

    # --------- Mode 2: add a single line ---------
    if line is None:
        raise HTTPException(
            status_code=400,
            detail="Either provide set/set_num/id query or a JSON body for a single part line.",
        )

    data = line.dict()
    part = data["part_num"]
    color = int(data["color_id"])
    qty = int(data["qty_total"])
    key = (part, color)

    existing = index.get(key)
    if existing is None:
        index[key] = {
            "part_num": part,
            "color_id": color,
            "qty_total": qty,
        }
    else:
        existing_qty = int(existing.get("qty_total", 0))
        existing["qty_total"] = existing_qty + qty

    rows = list(index.values())
    _save(current_user.id, rows)
    return {"ok": True, "mode": "single", "total_rows": len(rows)}


@router.post("/add_batch")
def add_inventory_batch(
    payload: InvBatch,
    current_user: User = Depends(get_current_user),
):
    """
    Add or increment multiple inventory lines in one call.

    Each item:
      { part_num, color_id, qty_total }

    (No part_img_url is accepted/stored — image is derived strictly.)
    """
    rows = _load(current_user.id)
    index = _index_by_key(rows)
    touched = 0

    for line in payload.items:
        data = line.dict()
        part = data["part_num"]
        color = int(data["color_id"])
        qty = int(data["qty_total"])

        if qty <= 0:
            continue

        key = (part, color)
        existing = index.get(key)

        if existing is None:
            index[key] = {
                "part_num": part,
                "color_id": color,
                "qty_total": qty,
            }
        else:
            existing_qty = int(existing.get("qty_total", 0))
            existing["qty_total"] = existing_qty + qty

        touched += 1

    rows = list(index.values())
    _save(current_user.id, rows)
    return {"ok": True, "mode": "batch", "touched": touched, "total_rows": len(rows)}


@router.post("/replace")
def replace_inventory(
    lines: List[InvLine],
    current_user: User = Depends(get_current_user),
):
    rows: List[dict] = []
    for line in lines:
        d = line.dict()
        d["qty_total"] = int(d.get("qty_total", 0))
        rows.append(d)
    _save(current_user.id, rows)
    return {"ok": True, "count": len(rows)}


@router.delete("/part")
def delete_part(
    part_num: str,
    color_id: int,
    current_user: User = Depends(get_current_user),
):
    rows = _load(current_user.id)
    key = (str(part_num), int(color_id))
    before = len(rows)
    rows = [r for r in rows if (str(r.get("part_num")), int(r.get("color_id", 0))) != key]
    removed = before - len(rows)
    if removed == 0:
        raise HTTPException(status_code=404, detail=f"Item {part_num}/{color_id} not found")
    _save(current_user.id, rows)
    return {"ok": True, "removed": removed, "remaining": len(rows)}


@router.post("/decrement")
def decrement_one(
    payload: DecrementOne,
    current_user: User = Depends(get_current_user),
):
    rows = _load(current_user.id)
    index = _index_by_key(rows)
    key = (payload.part_num, int(payload.color_id))
    existing = index.get(key)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Item {payload.part_num}/{payload.color_id} not found")

    current = int(existing.get("qty_total", 0))
    new_qty = current - payload.delta
    if new_qty <= 0:
        index.pop(key, None)
    else:
        existing["qty_total"] = new_qty

    rows = list(index.values())
    _save(current_user.id, rows)
    return {"ok": True, "remaining": len(rows)}


@router.post("/batch_decrement")
def batch_decrement(
    payload: DecrementBatch,
    current_user: User = Depends(get_current_user),
):
    rows = _load(current_user.id)
    index = _index_by_key(rows)

    for item in payload.items:
        key = (item.part_num, int(item.color_id))
        existing = index.get(key)
        if existing is None:
            continue
        current = int(existing.get("qty_total", 0))
        new_qty = current - item.delta
        if new_qty <= 0:
            index.pop(key, None)
        else:
            existing["qty_total"] = new_qty

    rows = list(index.values())
    _save(current_user.id, rows)
    return {"ok": True, "remaining": len(rows)}


@router.post("/batch_delete")
def batch_delete(
    payload: DeleteBatch,
    current_user: User = Depends(get_current_user),
):
    rows = _load(current_user.id)
    keyset = {(k.part_num, int(k.color_id)) for k in payload.keys}
    before = len(rows)
    rows = [r for r in rows if (str(r.get("part_num")), int(r.get("color_id", 0))) not in keyset]
    removed = before - len(rows)
    _save(current_user.id, rows)
    if removed == 0:
        raise HTTPException(status_code=404, detail="No matching items found to delete")
    return {"ok": True, "removed": removed, "remaining": len(rows)}


@router.post("/remove_set")
def remove_set(
    set: Optional[str] = Query(None, alias="set", description="LEGO set number (alias: set_num, id)"),
    set_num: Optional[str] = Query(None),
    id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    raw = set_num or set or id
    if not raw:
        raise HTTPException(status_code=400, detail="Provide one of set, set_num or id query parameters.")

    catalog_parts = get_catalog_parts_for_set(raw)
    if not catalog_parts:
        raise HTTPException(status_code=404, detail=f"No catalog parts found for set {raw}")

    rows = _load(current_user.id)
    idx = _index_by_key(rows)
    touched = 0

    for p in catalog_parts:
        key = (str(p["part_num"]), int(p["color_id"]))
        need = int(p["quantity"])
        existing = idx.get(key)
        if existing is None:
            continue

        current = int(existing.get("qty_total", 0))
        new_qty = current - need
        if new_qty < 0:
            new_qty = 0
        if new_qty != current:
            touched += 1
        if new_qty == 0:
            idx.pop(key, None)
        else:
            existing["qty_total"] = new_qty

    rows = list(idx.values())
    _save(current_user.id, rows)

    return {
        "ok": True,
        "set_num": raw,
        "touched": touched,
        "remaining": len(rows),
    }


@router.delete("/clear")
def clear_inventory(
    confirm: str = Query(..., description='Type "YES" to confirm'),
    current_user: User = Depends(get_current_user),
):
    if confirm != "YES":
        raise HTTPException(status_code=400, detail='Refused. Pass confirm=YES to clear all inventory.')
    _save(current_user.id, [])
    return {"ok": True, "cleared": True, "count": 0}

@router.post("/add-canonical")
def add_canonical_part(
    payload: AddCanonicalPayload,
    current_user: User = Depends(get_current_user),
):
    user_id = current_user.id

    part_num = (payload.part_num or "").strip()
    if not part_num:
        raise HTTPException(status_code=400, detail="part_num required")

    if payload.qty <= 0:
        raise HTTPException(status_code=400, detail="qty must be >= 1")

    with user_db() as db:
        cur = db.cursor()
        cur.execute(
            """
            INSERT INTO user_inventory_parts (user_id, part_num, color_id, qty)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, part_num, color_id)
            DO UPDATE SET qty = qty + excluded.qty
            """,
            (user_id, part_num, int(payload.color_id), int(payload.qty)),
        )
        db.commit()

        cur.execute(
            """
            SELECT user_id, part_num, color_id, qty
            FROM user_inventory_parts
            WHERE user_id = ? AND part_num = ? AND color_id = ?
            """,
            (user_id, part_num, int(payload.color_id)),
        )
        row = cur.fetchone()

    if row is None:
        raise HTTPException(status_code=500, detail="insert succeeded but row not found")

    return dict(row)
@router.post("/decrement-canonical")
def decrement_canonical_part(
    payload: DecCanonicalPayload,
    current_user: User = Depends(get_current_user),
):
    part_num = (payload.part_num or "").strip()
    if not part_num:
        raise HTTPException(status_code=400, detail="part_num required")

    with user_db() as db:
        cur = db.cursor()

        cur.execute(
            """
            SELECT qty
            FROM user_inventory_parts
            WHERE user_id = ? AND part_num = ? AND color_id = ?
            """,
            (current_user.id, part_num, int(payload.color_id)),
        )
        row = cur.fetchone()

        if row is None:
            # already 0 effectively
            return {
                "user_id": current_user.id,
                "part_num": part_num,
                "color_id": int(payload.color_id),
                "qty": 0,
                "changed": False,
            }

        current_qty = int(row["qty"])
        new_qty = current_qty - int(payload.delta)

        if new_qty <= 0:
            cur.execute(
                """
                DELETE FROM user_inventory_parts
                WHERE user_id = ? AND part_num = ? AND color_id = ?
                """,
                (current_user.id, part_num, int(payload.color_id)),
            )
            db.commit()
            return {
                "user_id": current_user.id,
                "part_num": part_num,
                "color_id": int(payload.color_id),
                "qty": 0,
                "changed": True,
            }

        cur.execute(
            """
            UPDATE user_inventory_parts
            SET qty = ?
            WHERE user_id = ? AND part_num = ? AND color_id = ?
            """,
            (new_qty, current_user.id, part_num, int(payload.color_id)),
        )
        db.commit()

        return {
            "user_id": current_user.id,
            "part_num": part_num,
            "color_id": int(payload.color_id),
            "qty": new_qty,
            "changed": True,
        }
        @router.get("/canonical-parts")
def list_canonical_inventory_parts(
    current_user: User = Depends(get_current_user),
):
    """
    DB-backed canonical inventory (source of truth).
    Returns ONLY what is in user_inventory_parts.
    """
    with user_db() as db:
        cur = db.cursor()
        cur.execute(
            """
            SELECT part_num, color_id, qty
            FROM user_inventory_parts
            WHERE user_id = ?
            ORDER BY part_num, color_id
            """,
            (current_user.id,),
        )
        rows = cur.fetchall()

    return [
        {
            "part_num": row["part_num"],
            "color_id": row["color_id"],
            "qty": int(row["qty"]),
        }
        for row in rows
    ]