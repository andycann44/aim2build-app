from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional

from app.user_db import user_db
from app.routers.auth import get_current_user, User
from app.catalog_db import db as catalog_db

router = APIRouter()


def _ensure_user_inventory_tables(con) -> None:
    """
    Ensure the writable user inventory tables exist.
    - user_inventory_parts: source of truth for parts owned
    - user_inventory_sets: optional tracker (kept for future, but we only clear it on clear-canonical)
    """
    con.execute(
        "CREATE TABLE IF NOT EXISTS user_inventory_parts ("
        "user_id INTEGER, part_num TEXT, color_id INTEGER, qty INTEGER, "
        "PRIMARY KEY(user_id, part_num, color_id))"
    )
    con.execute(
        "CREATE TABLE IF NOT EXISTS user_inventory_sets ("
        "user_id INTEGER, set_num TEXT, count INTEGER DEFAULT 1, "
        "PRIMARY KEY(user_id, set_num))"
    )


def _load_db_parts(user_id: int) -> List[dict]:
    # Canonical inventory source of truth: user_inventory_parts (DB)
    with user_db() as con:
        _ensure_user_inventory_tables(con)
        cur = con.cursor()
        cur.execute(
            """
            SELECT part_num, color_id, qty
            FROM user_inventory_parts
            WHERE user_id = ?
            ORDER BY part_num, color_id
            """,
            (user_id,),
        )
        rows = cur.fetchall()

    out: List[dict] = []
    for r in rows:
        # tolerate both sqlite3.Row and tuples
        if hasattr(r, "keys"):
            part_num = str(r["part_num"])
            color_id = int(r["color_id"])
            qty = int(r["qty"])
        else:
            part_num = str(r[0])
            color_id = int(r[1])
            qty = int(r[2])

        out.append(
            {
                "part_num": part_num,
                "color_id": color_id,
                "qty": qty,
                "qty_total": qty,
            }
        )
    return out


def _img_for(part_num: str, color_id: int) -> Optional[str]:
    # Images source of truth: catalog DB table element_images(part_num,color_id,img_url)
    try:
        with catalog_db() as con:
            cur = con.cursor()
            cur.execute(
                "SELECT img_url FROM element_images WHERE part_num = ? AND color_id = ? LIMIT 1",
                (part_num, int(color_id)),
            )
            row = cur.fetchone()
            if not row:
                return None
            if hasattr(row, "keys"):
                return row["img_url"]
            return row[0]
    except Exception:
        return None


def load_inventory_parts(user_id: int) -> List[dict]:
    """
    Helper exposed for other routers (e.g., buildability).
    DB-backed inventory only.
    """
    return _load_db_parts(user_id)


# -----------------------
# Models
# -----------------------

class InventoryPart(BaseModel):
    part_num: str
    color_id: int
    qty_total: int = Field(..., ge=0)
    part_img_url: Optional[str] = None


class AddCanonicalPayload(BaseModel):
    part_num: str
    color_id: int
    qty: int = Field(1, ge=1)


class DecCanonicalPayload(BaseModel):
    part_num: str
    color_id: int
    delta: int = Field(1, gt=0)


# -----------------------
# Read endpoints
# -----------------------

@router.get("/parts", response_model=List[InventoryPart])
def get_parts(current_user: User = Depends(get_current_user)):
    parts = _load_db_parts(current_user.id)
    for p in parts:
        p["part_img_url"] = _img_for(p["part_num"], int(p["color_id"]))
    return parts


@router.get("/parts_with_images", response_model=List[InventoryPart])
def get_parts_with_images(current_user: User = Depends(get_current_user)):
    parts = _load_db_parts(current_user.id)
    for p in parts:
        p["part_img_url"] = _img_for(p["part_num"], int(p["color_id"]))
    return parts


@router.get("/canonical-parts")
def list_canonical_inventory_parts(current_user: User = Depends(get_current_user)):
    """
    DB-backed canonical inventory (source of truth).
    Returns ONLY what is in user_inventory_parts.
    """
    with user_db() as con:
        _ensure_user_inventory_tables(con)
        cur = con.cursor()
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

    out = []
    for row in rows:
        if hasattr(row, "keys"):
            out.append(
                {
                    "part_num": row["part_num"],
                    "color_id": int(row["color_id"]),
                    "qty": int(row["qty"]),
                }
            )
        else:
            out.append(
                {
                    "part_num": row[0],
                    "color_id": int(row[1]),
                    "qty": int(row[2]),
                }
            )
    return out


# -----------------------
# Canonical-only mutation endpoints (LOCKED)
# -----------------------

@router.post("/add-canonical")
def add_canonical_part(payload: AddCanonicalPayload, current_user: User = Depends(get_current_user)):
    part_num = (payload.part_num or "").strip()
    if not part_num:
        raise HTTPException(status_code=400, detail="part_num required")

    with user_db() as con:
        _ensure_user_inventory_tables(con)
        cur = con.cursor()
        cur.execute(
            """
            INSERT INTO user_inventory_parts (user_id, part_num, color_id, qty)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, part_num, color_id)
            DO UPDATE SET qty = qty + excluded.qty
            """,
            (current_user.id, part_num, int(payload.color_id), int(payload.qty)),
        )
        con.commit()

        cur.execute(
            """
            SELECT user_id, part_num, color_id, qty
            FROM user_inventory_parts
            WHERE user_id = ? AND part_num = ? AND color_id = ?
            """,
            (current_user.id, part_num, int(payload.color_id)),
        )
        row = cur.fetchone()

    if row is None:
        raise HTTPException(status_code=500, detail="insert succeeded but row not found")

    if hasattr(row, "keys"):
        return dict(row)
    return {"user_id": row[0], "part_num": row[1], "color_id": row[2], "qty": row[3]}


@router.post("/set-canonical")
def set_canonical(payload: dict, current_user: User = Depends(get_current_user)):
    """
    LOCKED: canonical-only mutation.
    Set exact qty for (part_num, color_id).
    qty=0 removes the row.
    """
    part_num = str(payload.get("part_num") or "").strip()
    if not part_num:
        raise HTTPException(status_code=400, detail="part_num required")

    try:
        color_id = int(payload.get("color_id"))
        qty = int(payload.get("qty"))
    except Exception:
        raise HTTPException(status_code=400, detail="color_id and qty must be ints")

    if qty < 0:
        raise HTTPException(status_code=400, detail="qty must be >= 0")

    with user_db() as con:
        _ensure_user_inventory_tables(con)
        if qty == 0:
            con.execute(
                "DELETE FROM user_inventory_parts WHERE user_id=? AND part_num=? AND color_id=?",
                (current_user.id, part_num, color_id),
            )
        else:
            con.execute(
                """
                INSERT INTO user_inventory_parts(user_id, part_num, color_id, qty)
                VALUES (?,?,?,?)
                ON CONFLICT(user_id, part_num, color_id) DO UPDATE SET qty=excluded.qty
                """,
                (current_user.id, part_num, color_id, qty),
            )
        con.commit()

    return {"ok": True, "part_num": part_num, "color_id": color_id, "qty": qty}


@router.post("/decrement-canonical")
def decrement_canonical_part(payload: DecCanonicalPayload, current_user: User = Depends(get_current_user)):
    part_num = (payload.part_num or "").strip()
    if not part_num:
        raise HTTPException(status_code=400, detail="part_num required")

    with user_db() as con:
        _ensure_user_inventory_tables(con)
        cur = con.cursor()

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
            return {
                "user_id": current_user.id,
                "part_num": part_num,
                "color_id": int(payload.color_id),
                "qty": 0,
                "changed": False,
            }

        current_qty = int(row["qty"]) if hasattr(row, "keys") else int(row[0])
        new_qty = current_qty - int(payload.delta)

        if new_qty <= 0:
            cur.execute(
                """
                DELETE FROM user_inventory_parts
                WHERE user_id = ? AND part_num = ? AND color_id = ?
                """,
                (current_user.id, part_num, int(payload.color_id)),
            )
            con.commit()
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
        con.commit()

    return {
        "user_id": current_user.id,
        "part_num": part_num,
        "color_id": int(payload.color_id),
        "qty": new_qty,
        "changed": True,
    }


@router.post("/clear-canonical")
def clear_canonical(current_user: User = Depends(get_current_user)):
    """
    LOCKED: DB-backed clear.
    Clears ALL inventory parts AND poured-set tracker rows for this user.
    """
    with user_db() as con:
        _ensure_user_inventory_tables(con)
        con.execute("DELETE FROM user_inventory_parts WHERE user_id=?", (current_user.id,))
        con.execute("DELETE FROM user_inventory_sets WHERE user_id=?", (current_user.id,))
        con.commit()
    return {"ok": True}