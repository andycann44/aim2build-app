from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Tuple

from app.user_db import user_db
from app.routers.auth import get_current_user, User
from app.catalog_db import db as catalog_db

router = APIRouter()


# -----------------------
# DB ensure (matches your aim2build_app.db schema)
# -----------------------


def _ensure_user_inventory_tables(con) -> None:
    """
    USER DB (aim2build_app.db) is source of truth for inventory.

    This matches the schema you showed from sqlite_master:

    user_inventory_parts:
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      part_num TEXT NOT NULL,
      color_id INTEGER NOT NULL,
      qty INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, part_num, color_id)

    user_inventory_sets:
      user_id INTEGER, set_num TEXT, count INTEGER DEFAULT 1,
      PRIMARY KEY(user_id, set_num)

    user_set_pour_lines:
      user_id INTEGER NOT NULL, set_num TEXT NOT NULL,
      part_num TEXT NOT NULL, color_id INTEGER NOT NULL,
      qty INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(user_id, set_num, part_num, color_id)
    """
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS user_inventory_parts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          part_num TEXT NOT NULL,
          color_id INTEGER NOT NULL,
          qty INTEGER NOT NULL DEFAULT 0,
          UNIQUE(user_id, part_num, color_id),
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )

    con.execute(
        """
        CREATE TABLE IF NOT EXISTS user_inventory_sets (
          user_id INTEGER,
          set_num TEXT,
          count INTEGER DEFAULT 1,
          PRIMARY KEY(user_id, set_num)
        )
        """
    )

    con.execute(
        """
        CREATE TABLE IF NOT EXISTS user_set_pour_lines (
          user_id INTEGER NOT NULL,
          set_num TEXT NOT NULL,
          part_num TEXT NOT NULL,
          color_id INTEGER NOT NULL,
          qty INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, set_num, part_num, color_id)
        )
        """
    )


# -----------------------
# Catalog spine helpers (READ ONLY)
# -----------------------


def _normalise_set_id(set_num: str) -> str:
    s = (set_num or "").strip()
    if not s:
        return ""
    if "-" not in s:
        return f"{s}-1"
    return s


def _get_catalog_recipe_parts(set_num: str) -> List[Dict[str, Any]]:
    """
    LOCKED SPINE:
    Set recipe comes ONLY from lego_catalog set_parts.
    Identity is strict (part_num, color_id). color_id=0 is valid.
    """
    sid = _normalise_set_id(set_num)
    if not sid:
        return []

    with catalog_db() as con:
        cur = con.execute(
            """
            SELECT part_num, color_id, qty_per_set
            FROM set_parts
            WHERE set_num = ?
            ORDER BY part_num, color_id
            """,
            (sid,),
        )
        rows = cur.fetchall()

    out: List[Dict[str, Any]] = []
    for r in rows:
        # sqlite Row or tuple tolerant
        if hasattr(r, "keys"):
            part_num = str(r["part_num"] or "").strip()
            qty = int(r["qty_per_set"] or 0)
            color_id = int(r["color_id"])
        else:
            part_num = str(r[0] or "").strip()
            color_id = int(r[1])
            qty = int(r[2] or 0)

        if not part_num or qty <= 0:
            continue

        out.append(
            {
                "part_num": part_num,
                "color_id": color_id,
                "quantity": qty,
            }
        )
    return out


# -----------------------
# Inventory read helpers
# -----------------------


def _load_db_parts(user_id: int) -> List[dict]:
    """
    Canonical inventory source of truth: user_inventory_parts (DB).
    Returns list of dicts with qty_total for frontend compat.
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
            (user_id,),
        )
        rows = cur.fetchall()

    out: List[dict] = []
    for r in rows:
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
    """
    Images source of truth: catalog DB element_images(part_num,color_id,img_url)
    """
    try:
        with catalog_db() as con:
            cur = con.cursor()
            cur.execute(
                "SELECT img_url FROM element_images WHERE part_num=? AND color_id=? LIMIT 1",
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


@router.get("/sets")
def list_poured_sets(current_user: User = Depends(get_current_user)) -> List[str]:
    """
    Source of truth for the green pill / toggle.
    Returns set_nums that are currently poured (ON).
    """
    with user_db() as con:
        _ensure_user_inventory_tables(con)
        cur = con.execute(
            "SELECT set_num FROM user_inventory_sets WHERE user_id=? ORDER BY set_num",
            (current_user.id,),
        )
        rows = cur.fetchall()

    out: List[str] = []
    for r in rows:
        if hasattr(r, "keys"):
            out.append(str(r["set_num"]))
        else:
            out.append(str(r[0]))
    return out


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
                {"part_num": row[0], "color_id": int(row[1]), "qty": int(row[2])}
            )
    return out


# -----------------------
# Pour / Unpour endpoints (SET TOGGLE SPINE)
# -----------------------


@router.post("/pour-set")
def pour_set(
    set: str = Query(..., description="LEGO set number, e.g. 75405 or 75405-1"),
    current_user: User = Depends(get_current_user),
):
    """
    Toggle ON:
    - Idempotent: if already poured, no-op.
    - Reads catalog recipe (non-spares only).
    - Writes receipt lines to user_set_pour_lines.
    - Adds to user_inventory_parts.
    - Marks user_inventory_sets.
    """
    set_id = _normalise_set_id(set)
    if not set_id:
        raise HTTPException(status_code=400, detail="set required")

    recipe = _get_catalog_recipe_parts(set_id)
    if not recipe:
        raise HTTPException(
            status_code=404, detail=f"set not found in catalog: {set_id}"
        )

    with user_db() as con:
        _ensure_user_inventory_tables(con)
        cur = con.cursor()

        # Idempotent guard
        cur.execute(
            "SELECT count FROM user_inventory_sets WHERE user_id=? AND set_num=?",
            (current_user.id, set_id),
        )
        row = cur.fetchone()
        if row is not None:
            already = int(row["count"] if hasattr(row, "keys") else row[0] or 0)
            if already > 0:
                return {"ok": True, "set_num": set_id, "already_poured": True}

        # Mark poured set
        cur.execute(
            """
            INSERT INTO user_inventory_sets(user_id, set_num, count)
            VALUES (?,?,1)
            ON CONFLICT(user_id, set_num) DO UPDATE SET count=1
            """,
            (current_user.id, set_id),
        )

        # Apply recipe lines as receipt + inventory increments
        poured_lines = 0
        total_qty = 0

        for p in recipe:
            part_num = str(p["part_num"]).strip()
            color_id = int(p["color_id"])
            qty = int(p["quantity"])

            if not part_num or qty <= 0:
                continue

            # Receipt line (per set)
            cur.execute(
                """
                INSERT INTO user_set_pour_lines(user_id, set_num, part_num, color_id, qty)
                VALUES (?,?,?,?,?)
                ON CONFLICT(user_id, set_num, part_num, color_id) DO UPDATE SET qty=excluded.qty
                """,
                (current_user.id, set_id, part_num, color_id, qty),
            )

            # Inventory increment
            cur.execute(
                """
                INSERT INTO user_inventory_parts(user_id, part_num, color_id, qty)
                VALUES (?,?,?,?)
                ON CONFLICT(user_id, part_num, color_id) DO UPDATE SET qty = qty + excluded.qty
                """,
                (current_user.id, part_num, color_id, qty),
            )

            poured_lines += 1
            total_qty += qty

        con.commit()

    return {
        "ok": True,
        "set_num": set_id,
        "already_poured": False,
        "lines": poured_lines,
        "total_qty": total_qty,
    }


@router.post("/unpour-set")
def unpour_set(
    set: str = Query(..., description="LEGO set number, e.g. 75405 or 75405-1"),
    current_user: User = Depends(get_current_user),
):
    """
    Toggle OFF:
    - Reads receipt lines from user_set_pour_lines for that set.
    - Subtracts exactly those quantities from user_inventory_parts (clamped at 0).
    - Deletes receipt lines.
    - Removes user_inventory_sets marker.
    """
    set_id = _normalise_set_id(set)
    if not set_id:
        raise HTTPException(status_code=400, detail="set required")

    with user_db() as con:
        _ensure_user_inventory_tables(con)
        cur = con.cursor()

        cur.execute(
            """
            SELECT part_num, color_id, qty
            FROM user_set_pour_lines
            WHERE user_id=? AND set_num=?
            ORDER BY part_num, color_id
            """,
            (current_user.id, set_id),
        )
        lines = cur.fetchall()

        if not lines:
            # Ensure marker is gone anyway
            cur.execute(
                "DELETE FROM user_inventory_sets WHERE user_id=? AND set_num=?",
                (current_user.id, set_id),
            )
            con.commit()
            return {
                "ok": True,
                "set_num": set_id,
                "already_unpoured": True,
                "lines": 0,
                "total_qty": 0,
            }

        removed_lines = 0
        total_qty = 0

        for r in lines:
            if hasattr(r, "keys"):
                part_num = str(r["part_num"])
                color_id = int(r["color_id"])
                delta = int(r["qty"])
            else:
                part_num = str(r[0])
                color_id = int(r[1])
                delta = int(r[2])

            if not part_num or delta <= 0:
                continue

            # Read current qty
            cur.execute(
                """
                SELECT qty
                FROM user_inventory_parts
                WHERE user_id=? AND part_num=? AND color_id=?
                """,
                (current_user.id, part_num, color_id),
            )
            row = cur.fetchone()
            if row is None:
                # Nothing to subtract (inventory already changed). Still proceed.
                removed_lines += 1
                total_qty += delta
                continue

            current_qty = int(row["qty"] if hasattr(row, "keys") else row[0])
            new_qty = current_qty - delta

            if new_qty <= 0:
                cur.execute(
                    """
                    DELETE FROM user_inventory_parts
                    WHERE user_id=? AND part_num=? AND color_id=?
                    """,
                    (current_user.id, part_num, color_id),
                )
            else:
                cur.execute(
                    """
                    UPDATE user_inventory_parts
                    SET qty=?
                    WHERE user_id=? AND part_num=? AND color_id=?
                    """,
                    (new_qty, current_user.id, part_num, color_id),
                )

            removed_lines += 1
            total_qty += delta

        # Delete receipt + marker
        cur.execute(
            "DELETE FROM user_set_pour_lines WHERE user_id=? AND set_num=?",
            (current_user.id, set_id),
        )
        cur.execute(
            "DELETE FROM user_inventory_sets WHERE user_id=? AND set_num=?",
            (current_user.id, set_id),
        )

        con.commit()

    return {
        "ok": True,
        "set_num": set_id,
        "already_unpoured": False,
        "lines": removed_lines,
        "total_qty": total_qty,
    }


# -----------------------
# Canonical-only mutation endpoints (parts)
# -----------------------


@router.post("/add-canonical")
def add_canonical_part(
    payload: AddCanonicalPayload, current_user: User = Depends(get_current_user)
):
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
        raise HTTPException(
            status_code=500, detail="insert succeeded but row not found"
        )

    if hasattr(row, "keys"):
        return dict(row)
    return {"user_id": row[0], "part_num": row[1], "color_id": row[2], "qty": row[3]}


@router.post("/set-canonical")
def set_canonical(payload: dict, current_user: User = Depends(get_current_user)):
    """
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
        cur = con.cursor()
        if qty == 0:
            cur.execute(
                "DELETE FROM user_inventory_parts WHERE user_id=? AND part_num=? AND color_id=?",
                (current_user.id, part_num, color_id),
            )
        else:
            cur.execute(
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
def decrement_canonical_part(
    payload: DecCanonicalPayload, current_user: User = Depends(get_current_user)
):
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
                "floor": 0,
                "changed": False,
            }

        current_qty = int(row["qty"]) if hasattr(row, "keys") else int(row[0])

        delta = int(payload.delta)
        color_id = int(payload.color_id)

        # Floor = total qty that came from poured sets (receipt lines)
        cur.execute(
            """
            SELECT COALESCE(SUM(qty), 0)
            FROM user_set_pour_lines
            WHERE user_id = ? AND part_num = ? AND color_id = ?
            """,
            (current_user.id, part_num, color_id),
        )
        floor = int(cur.fetchone()[0] or 0)

        requested = current_qty - delta
        new_qty = max(requested, floor)  # ✅ allow down to floor, never below
        changed = (new_qty != current_qty)

        # If floor is 0 and qty hits 0 -> safe delete
        if new_qty <= 0:
            cur.execute(
                """
                DELETE FROM user_inventory_parts
                WHERE user_id = ? AND part_num = ? AND color_id = ?
                """,
                (current_user.id, part_num, color_id),
            )
            con.commit()
            return {
                "user_id": current_user.id,
                "part_num": part_num,
                "color_id": color_id,
                "qty": 0,
                "floor": floor,
                "changed": changed,
            }

        cur.execute(
            """
            UPDATE user_inventory_parts
            SET qty = ?
            WHERE user_id = ? AND part_num = ? AND color_id = ?
            """,
            (new_qty, current_user.id, part_num, color_id),
        )
        con.commit()

        return {
            "user_id": current_user.id,
            "part_num": part_num,
            "color_id": color_id,
            "qty": new_qty,
            "floor": floor,
            "changed": changed,
        }
        
@router.post("/clear-canonical")
def clear_canonical(current_user: User = Depends(get_current_user)):
    """
    Clears ALL inventory parts AND poured-set tracker rows AND pour receipts for this user.
    This guarantees the frontend pills/toggles reset after a clear.
    """
    with user_db() as con:
        _ensure_user_inventory_tables(con)
        con.execute(
            "DELETE FROM user_inventory_parts WHERE user_id=?", (current_user.id,)
        )
        con.execute(
            "DELETE FROM user_inventory_sets WHERE user_id=?", (current_user.id,)
        )
        con.execute(
            "DELETE FROM user_set_pour_lines WHERE user_id=?", (current_user.id,)
        )
        con.commit()
    return {"ok": True}
