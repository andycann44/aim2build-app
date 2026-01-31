from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Dict, Any

from app.user_db import user_db
from app.catalog_db import db as catalog_db
from app.routers.auth import get_current_user, User
from app.core.image_resolver import resolve_image_url

router = APIRouter()


def _ensure_user_mysets_table(con) -> None:
    """
    USER DB (aim2build_app.db) source of truth for My Sets.
    """
    con.execute(
        "CREATE TABLE IF NOT EXISTS user_mysets ("
        "user_id INTEGER NOT NULL, "
        "set_num TEXT NOT NULL, "
        "created_at TEXT DEFAULT (datetime('now')) NOT NULL, "
        "PRIMARY KEY(user_id, set_num)"
        ")"
    )


def _norm_set_id(raw: str) -> str:
    sn = (raw or "").strip()
    if not sn:
        return sn
    if "-" not in sn and sn.isdigit():
        return f"{sn}-1"
    return sn


def _catalog_set_meta(set_num: str) -> Dict[str, Any]:
    """
    READ-ONLY: lego_catalog.db lookup for tile metadata.
    """
    sn = _norm_set_id(set_num)
    if not sn:
        return {"set_num": sn}

    try:
        with catalog_db() as con:
            cur = con.cursor()
            cur.execute(
                "SELECT set_num, name, year, num_parts, set_img_url "
                "FROM sets WHERE set_num = ? LIMIT 1",
                (sn,),
            )
            row = cur.fetchone()
            if not row:
                return {"set_num": sn}

            set_img_url = (row[4] or "").strip()

            return {
                "set_num": row[0] or sn,
                "name": row[1],
                "year": int(row[2]) if row[2] is not None else None,
                "num_parts": int(row[3] or 0),
                "img_url": resolve_image_url(set_img_url),
            }
    except Exception:
        return {"set_num": sn}


@router.get("")
def list_mysets(current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Returns { sets: [...] } from USER DB, enriched from catalog DB.
    """
    with user_db() as con:
        _ensure_user_mysets_table(con)
        cur = con.cursor()
        cur.execute(
            "SELECT set_num FROM user_mysets "
            "WHERE user_id = ? "
            "ORDER BY created_at DESC",
            (current_user.id,),
        )
        rows = cur.fetchall()

    sets: List[Dict[str, Any]] = []
    for r in rows:
        sn = r["set_num"] if hasattr(r, "keys") else r[0]
        sets.append(_catalog_set_meta(sn))

    return {"sets": sets}


@router.post("/add")
def add_myset(
    set: str = Query(""),
    set_num: str = Query(""),
    id: str = Query(""),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    raw = set or set_num or id
    sn = _norm_set_id(raw)
    if not sn:
        raise HTTPException(status_code=422, detail="Missing set id")

    with user_db() as con:
        _ensure_user_mysets_table(con)
        con.execute(
            "INSERT OR IGNORE INTO user_mysets (user_id, set_num) VALUES (?, ?)",
            (current_user.id, sn),
        )
        con.commit()

    return {"ok": True, "set_num": sn}


@router.delete("/remove")
def remove_myset(
    set: str = Query(""),
    set_num: str = Query(""),
    id: str = Query(""),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    raw = set or set_num or id
    sn = _norm_set_id(raw)
    if not sn:
        raise HTTPException(status_code=422, detail="Missing set id")

    with user_db() as con:
        _ensure_user_mysets_table(con)
        con.execute(
            "DELETE FROM user_mysets WHERE user_id = ? AND set_num = ?",
            (current_user.id, sn),
        )
        con.commit()

    return {"ok": True, "set_num": sn}