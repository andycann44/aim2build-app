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


@router.post("/set-canonical")
def set_canonical(payload: dict, current_user: User = Depends(get_current_user)):
    """
    LOCKED: canonical-only mutation.
    Set exact qty for (part_num, color_id).
    qty=0 removes the row.
    """
    part_num = str(payload.get("part_num") or "").strip()
    color_id = payload.get("color_id")
    qty = payload.get("qty")

    if not part_num:
        raise HTTPException(status_code=400, detail="part_num required")

    try:
        color_id = int(color_id)
        qty = int(qty)
    except Exception:
        raise HTTPException(status_code=400, detail="color_id and qty must be ints")

    if qty < 0:
        raise HTTPException(status_code=400, detail="qty must be >= 0")

    from app.user_db import user_db

    with user_db() as con:
        con.execute(
            "CREATE TABLE IF NOT EXISTS user_inventory_parts ("
            "user_id INTEGER, part_num TEXT, color_id INTEGER, qty INTEGER, "
            "PRIMARY KEY(user_id, part_num, color_id))"
        )

        if qty == 0:
            con.execute(
                "DELETE FROM user_inventory_parts "
                "WHERE user_id=? AND part_num=? AND color_id=?",
                (current_user.id, part_num, color_id),
            )
        else:
            con.execute(
                "INSERT INTO user_inventory_parts(user_id, part_num, color_id, qty) "
                "VALUES (?,?,?,?) "
                "ON CONFLICT(user_id, part_num, color_id) DO UPDATE SET qty=excluded.qty",
                (current_user.id, part_num, color_id, qty),
            )

        con.commit()

    return {"ok": True, "part_num": part_num, "color_id": color_id, "qty": qty}

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


@router.post("/clear-canonical")
def clear_canonical(current_user: User = Depends(get_current_user)):
    """LOCKED: canonical-only mutation. Clears ALL inventory parts for this user."""
    from app.user_db import user_db
    with user_db() as con:
        con.execute(
            "DELETE FROM user_inventory_parts WHERE user_id=?",
            (current_user.id,),
        )
        con.commit()
    return {"ok": True}

