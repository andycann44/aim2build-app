from fastapi import APIRouter, HTTPException, Query, Body, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Tuple

from app.user_db import user_db
from app.catalog_db import get_catalog_parts_for_set, db as catalog_db
from app.routers.auth import get_current_user, User
from app.image_lookup import get_strict_element_image

router = APIRouter()



def _ensure_user_sets_poured(db) -> None:
    """
    Idempotent schema guard for Option B:
      user_sets.poured INTEGER NOT NULL DEFAULT 0
    """
    cur = db.cursor()
    cur.execute("PRAGMA table_info(user_sets)")
    cols = [row[1] for row in cur.fetchall()]
    if "poured" not in cols:
        cur.execute("ALTER TABLE user_sets ADD COLUMN poured INTEGER NOT NULL DEFAULT 0")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_user_sets_user_poured ON user_sets(user_id, poured)")
    db.commit()
def _canonicalize_part_num(raw_part_num: str) -> str:
    """
    Catalog DB ONLY:
      raw part_num -> canonical_part_num via part_canonical_map.
    No guessing:
      - If no mapping row exists, returns raw part_num.
    """
    raw = (raw_part_num or "").strip()
    if not raw:
        return raw

    try:
        from app.catalog_db import db as catalog_db
    except Exception:
        return raw

    with catalog_db() as db:
        cur = db.cursor()
        cur.execute(
            "SELECT canonical_part_num FROM part_canonical_map WHERE part_num = ? LIMIT 1",
            (raw,),
        )
        row = cur.fetchone()

    if not row:
        return raw

    canon = None
    try:
        canon = row["canonical_part_num"]
    except Exception:
        try:
            canon = row[0]
        except Exception:
            canon = None

    canon = (str(canon).strip() if canon is not None else "")
    return canon if canon else raw


def _normalize_set_id(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        return s
    if "-" not in s:
        return f"{s}-1"
    return s


def _lookup_img_url(part_num: str, color_id: int) -> Optional[str]:
    """
    Try strict element image, then canonical mapping, then aliases sharing the same canonical.
    """

    def _try_lookup(cur, pn: str, cid: int) -> Optional[str]:
        cur.execute(
            "SELECT img_url FROM element_images WHERE part_num = ? AND color_id = ? LIMIT 1",
            (pn, cid),
        )
        row = cur.fetchone()
        if row:
            try:
                return row["img_url"]
            except Exception:
                return row[0]
        return None

    with catalog_db() as con:
        cur = con.cursor()

        img = _try_lookup(cur, part_num, color_id)
        if img:
            return img

        canonical = _canonicalize_part_num(part_num)
        if canonical != part_num:
            img = _try_lookup(cur, canonical, color_id)
            if img:
                return img

        target = canonical if canonical else part_num
        cur.execute(
            "SELECT part_num FROM part_canonical_map WHERE canonical_part_num = ?",
            (target,),
        )
        for row in cur.fetchall():
            alias = str(row["part_num"])
            img = _try_lookup(cur, alias, color_id)
            if img:
                return img

    return None


def _fetch_user_inventory(user_id: int) -> List[dict]:
    """
    Read inventory from user_inventory_parts and attach part_img_url with alias fallback.
    """
    rows: List[dict] = []
    with user_db() as db:
        cur = db.cursor()
        cur.execute(
            """
            SELECT part_num, color_id, qty
            FROM user_inventory_parts
            WHERE user_id = ?
            ORDER BY part_num, color_id
            """,
            (user_id,),
        )
        db_rows = cur.fetchall()

    for r in db_rows:
        part_num = str(r["part_num"])
        color_id = int(r["color_id"])
        qty = int(r["qty"])
        img = get_strict_element_image(part_num, color_id)
        if img is None:
            img = _lookup_img_url(part_num, color_id)
        rows.append(
            {
                "part_num": part_num,
                "color_id": color_id,
                "qty_total": qty,
                "part_img_url": img,
            }
        )
    return rows


def load_inventory_parts(user_id: int) -> List[dict]:
    """Helper exposed for other routers (canonical DB source)."""
    return _fetch_user_inventory(user_id)


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
# Canonical DB inventory list (SOURCE OF TRUTH for UI)
# -----------------------

def _list_db_inventory_parts(user_id: int) -> List[InventoryPart]:
    """
    Reads canonical inventory from user DB (user_inventory_parts),
    and attaches images with alias fallback.
    """
    rows = _fetch_user_inventory(user_id)
    return [InventoryPart(**r) for r in rows]


# -----------------------
# Endpoints (Inventory list)
# -----------------------

@router.get("/parts", response_model=List[InventoryPart])
def list_inventory_parts(
    current_user: User = Depends(get_current_user),
) -> List[InventoryPart]:
    """
    Canonical DB-backed inventory list + STRICT images.
    """
    return _list_db_inventory_parts(current_user.id)


@router.get("/parts_with_images", response_model=List[InventoryPart])
def list_inventory_parts_with_images(
    current_user: User = Depends(get_current_user),
) -> List[InventoryPart]:
    """
    Keep this route name for existing frontend calls.
    """
    return _list_db_inventory_parts(current_user.id)


# -----------------------
# Legacy JSON endpoints (kept)
# -----------------------

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
    raise HTTPException(
        status_code=410,
        detail="Legacy JSON inventory removed. Use /add-set-canonical or /add-canonical.",
    )


@router.post("/remove_set")
def remove_set(
    set: Optional[str] = Query(None, alias="set", description="LEGO set number (alias: set_num, id)"),
    set_num: Optional[str] = Query(None),
    id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    raise HTTPException(
        status_code=410,
        detail="Legacy JSON inventory removed. Use /add-set-canonical or /add-canonical.",
    )


@router.delete("/clear")
def clear_inventory(
    confirm: str = Query(..., description='Type "YES" to confirm'),
    current_user: User = Depends(get_current_user),
):
    if confirm != "YES":
        raise HTTPException(
            status_code=400,
            detail='Refused. Pass confirm=YES to clear all inventory.',
        )

    user_id = current_user.id

    # Clear canonical DB inventory + set markers (SOURCE OF TRUTH)
    with user_db() as db:
        cur = db.cursor()

        # ----- count inventory parts -----
        cur.execute(
            "SELECT COUNT(1) AS n FROM user_inventory_parts WHERE user_id = ?",
            (user_id,),
        )
        row = cur.fetchone()
        if row is None:
            inv_n = 0
        else:
            try:
                inv_n = int(row["n"])
            except Exception:
                inv_n = int(row[0])

        # ----- count sets -----
        cur.execute(
            "SELECT COUNT(1) AS n FROM user_sets WHERE user_id = ?",
            (user_id,),
        )
        row = cur.fetchone()
        if row is None:
            sets_n = 0
        else:
            try:
                sets_n = int(row["n"])
            except Exception:
                sets_n = int(row[0])

        # ----- delete -----
        cur.execute("DELETE FROM user_inventory_parts WHERE user_id = ?", (user_id,))
        cur.execute("DELETE FROM user_sets WHERE user_id = ?", (user_id,))
        db.commit()

    return {
        "ok": True,
        "cleared": True,
        "deleted_parts_rows": inv_n,
        "deleted_sets_rows": sets_n,
    }

@router.delete("/part")
def delete_inventory_part(
    part_num: str = Query(...),
    color_id: int = Query(...),
    current_user: User = Depends(get_current_user),
):
    """
    Hard-delete one inventory row (canonical DB).
    """
    pn = _canonicalize_part_num((part_num or "").strip())
    if not pn:
        raise HTTPException(status_code=400, detail="part_num required")

    with user_db() as db:
        cur = db.cursor()
        cur.execute(
            """
            DELETE FROM user_inventory_parts
            WHERE user_id = ? AND part_num = ? AND color_id = ?
            """,
            (current_user.id, pn, int(color_id)),
        )
        deleted = cur.rowcount
        db.commit()

    return {"ok": True, "deleted": int(deleted)}

@router.get("/sets")
def list_inventory_sets(
    current_user: User = Depends(get_current_user),
):
    """
    Returns the set_nums already added to inventory for this user.
    Source of truth: user DB table user_sets.
    """
    with user_db() as db:
        cur = db.cursor()
        _ensure_user_sets_poured(db)
        cur.execute(
            "SELECT set_num FROM user_sets WHERE user_id = ? AND poured = 1 ORDER BY set_num",
            (current_user.id,),
        )
        rows = cur.fetchall()

    return {"sets": [str(r["set_num"]) for r in rows]}


@router.post("/add-set-canonical")
def add_set_canonical(
    set: Optional[str] = Query(None, description="LEGO set number to add (alias: set_num, id)"),
    set_num: Optional[str] = Query(None),
    id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """
    Add a set to inventory ONCE (idempotent):
      - Reads set parts from Catalog DB (get_catalog_parts_for_set)
      - Canonicalizes part_num via part_canonical_map (no guessing)
      - Writes ONLY canonical parts into user DB user_inventory_parts
      - Marks the set in user DB user_sets
    """
    chosen_raw = (set_num or set or id or "").strip()
    if not chosen_raw:
        raise HTTPException(status_code=400, detail="Provide set/set_num/id")
    chosen = _normalize_set_id(chosen_raw)

    user_id = current_user.id

    # If already added, do nothing (prevents double-add)
    with user_db() as db:
        cur = db.cursor()
        _ensure_user_sets_poured(db)
        cur.execute(
            "SELECT 1 FROM user_sets WHERE user_id = ? AND set_num = ? AND poured = 1 LIMIT 1",
            (user_id, chosen),
        )
        if cur.fetchone() is not None:
            return {"ok": True, "set_num": chosen, "already_owned": True}

    set_parts = get_catalog_parts_for_set(chosen)
    if not set_parts:
        raise HTTPException(status_code=404, detail=f"No catalog parts found for set {chosen}")

    lines_written = 0
    with user_db() as db:
        cur = db.cursor()

        for row in set_parts:
            raw_part = str(row["part_num"])
            color_id = int(row["color_id"])
            qty = int(row["quantity"])

            canonical_part = _canonicalize_part_num(raw_part)

            cur.execute(
                """
                INSERT INTO user_inventory_parts (user_id, part_num, color_id, qty)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id, part_num, color_id)
                DO UPDATE SET qty = qty + excluded.qty
                """,
                (user_id, canonical_part, color_id, qty),
            )
            lines_written += 1

        _ensure_user_sets_poured(db)
        cur.execute(
            """
            INSERT OR IGNORE INTO user_sets (user_id, set_num, qty, poured)
            VALUES (?, ?, 1, 1)
            """,
            (user_id, chosen),
        )
        cur.execute(
            "UPDATE user_sets SET poured = 1 WHERE user_id = ? AND set_num = ?",
            (user_id, chosen),
        )

        db.commit()

    return {"ok": True, "set_num": chosen, "already_owned": False, "lines_written": lines_written}


@router.post("/add-canonical")
def add_canonical_part(
    payload: AddCanonicalPayload,
    current_user: User = Depends(get_current_user),
):
    user_id = current_user.id

    part_num = _canonicalize_part_num((payload.part_num or "").strip())
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

@router.post("/remove-set-canonical")
def remove_set_canonical(
    set: Optional[str] = Query(None, description="LEGO set number (alias: set_num, id)"),
    set_num: Optional[str] = Query(None),
    id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    chosen_raw = (set_num or set or id or "").strip()
    if not chosen_raw:
        raise HTTPException(status_code=400, detail="Provide set/set_num/id")

    chosen = _normalize_set_id(chosen_raw)
    user_id = current_user.id

    # Only remove if this set was actually poured into inventory
    with user_db() as db:
        cur = db.cursor()
        _ensure_user_sets_poured(db)
        cur.execute(
            "SELECT 1 FROM user_sets WHERE user_id = ? AND set_num = ? AND poured = 1 LIMIT 1",
            (user_id, chosen),
        )
        if cur.fetchone() is None:
            return {"ok": True, "set_num": chosen, "was_in_inventory": False}

    set_parts = get_catalog_parts_for_set(chosen)
    if not set_parts:
        raise HTTPException(status_code=404, detail=f"No catalog parts found for set {chosen}")

    touched = 0
    removed_rows = 0

    with user_db() as db:
        cur = db.cursor()

        for row in set_parts:
            raw_part = str(row["part_num"])
            color_id = int(row["color_id"])
            need = int(row["quantity"])
            part_num = _canonicalize_part_num(raw_part)

            cur.execute(
                """
                SELECT qty FROM user_inventory_parts
                WHERE user_id = ? AND part_num = ? AND color_id = ?
                """,
                (user_id, part_num, color_id),
            )
            r = cur.fetchone()
            if r is None:
                continue

            current_qty = int(r["qty"])
            new_qty = current_qty - need
            if new_qty < 0:
                new_qty = 0

            if new_qty != current_qty:
                touched += 1

            if new_qty == 0:
                cur.execute(
                    """
                    DELETE FROM user_inventory_parts
                    WHERE user_id = ? AND part_num = ? AND color_id = ?
                    """,
                    (user_id, part_num, color_id),
                )
                removed_rows += 1
            else:
                cur.execute(
                    """
                    UPDATE user_inventory_parts
                    SET qty = ?
                    WHERE user_id = ? AND part_num = ? AND color_id = ?
                    """,
                    (new_qty, user_id, part_num, color_id),
                )

        # Unmark poured, but keep row (My Sets uses the same table)
        cur.execute(
            "UPDATE user_sets SET poured = 0 WHERE user_id = ? AND set_num = ?",
            (user_id, chosen),
        )

        db.commit()

    return {
        "ok": True,
        "set_num": chosen,
        "was_in_inventory": True,
        "touched": touched,
        "removed_rows": removed_rows,
    }

@router.post("/decrement-canonical")
def decrement_canonical_part(
    payload: DecCanonicalPayload,
    current_user: User = Depends(get_current_user),
):
    part_num = _canonicalize_part_num((payload.part_num or "").strip())
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
        {"part_num": row["part_num"], "color_id": row["color_id"], "qty": int(row["qty"])}
        for row in rows
    ]
